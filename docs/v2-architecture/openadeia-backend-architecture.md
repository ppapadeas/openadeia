# OpenAdeia Backend — Modularity & Plugin Architecture Review

**Date:** 2026-03-28  
**Scope:** `backend/src/app.js`, `backend/src/routes/*.js`, `backend/src/services/*.js`  
**Stack:** Fastify + Knex + PostgreSQL  
**Goal:** Make features toggleable for SaaS deployment

---

## 1. Current State Analysis

### 1.1 What's Actually There (Positive Notes)

The codebase is cleaner than many projects at this stage:
- `app.js` uses `buildApp()` factory — already decoupled from server startup
- Services are mostly pure logic files (no circular deps detected)
- Routes are cleanly separated by feature domain
- `nok-rules.js` already uses a JSON config file — good precedent
- Async job pattern in `tee.js` (202 + poll) shows awareness of infrastructure constraints

### 1.2 Problems for SaaS/Multi-Tenant Deployment

#### Problem 1: Monolithic Route Loading (Critical)
`app.js` unconditionally imports and registers **all** 13 routes at startup. Features like TEE sync (Playwright + heavy deps), Client Portal (MinIO + PDFs), and Fees cannot be disabled without code changes:

```js
// All of these are imported regardless of config
import teeRoute from './routes/tee.js';
import portalRoutes from './routes/portal.js';
import feesRoute from './routes/fees.js';
import nokRoute from './routes/nok.js';
```

For a SaaS offering where some tiers don't include TEE sync or the Client Portal, this means every instance loads Playwright binaries, MinIO clients, and PDF generation libs even if unused.

#### Problem 2: Static Imports Create Hard Dependencies
Services are imported at module parse time. If `tee-client.js` is imported, Node will resolve `playwright-core` at startup even if the TEE feature is off. Same for:
- `portal-document.js` → `pdf-lib`, `@pdf-lib/fontkit`
- `portal-email.js` → `nodemailer`
- `tee-client.js` → `playwright-core` (dynamic import inside, but the module itself still loads)

#### Problem 3: No Feature Flag System
Zero mechanism to disable features. No `features.json`, no `FEATURE_*` env vars, no conditional logic. Enabling/disabling requires editing `app.js` manually.

#### Problem 4: Services Have Hardcoded DB Access
Every service directly imports `db` from `../config/database.js`. This is fine for a single-tenant app, but makes multi-tenant (per-tenant DB schema, row-level tenancy) impossible without a rewrite:

```js
// workflow-engine.js
import db from '../config/database.js';
import { getRules } from './nok-rules.js';
// both are module-level singletons — no injection point
```

For single-tenant SaaS this is acceptable for now. For multi-tenant, this needs DI.

#### Problem 5: Cross-Service Coupling
`tee.js` route imports from `auth.js` route (`decryptTeePassword`) — a route importing from another route:

```js
// routes/tee.js
import { decryptTeePassword } from './auth.js';
```

This is a layering violation. Auth utilities should live in a service or util, not in a route file.

#### Problem 6: Portal Email Config Hit on Every Request
`portal-email.js` does a DB query on `portal_settings` to get the Resend API key on **every email send** — no caching, no startup initialization.

#### Problem 7: No Health/Feature-Capability Endpoint
`GET /health` returns `{status: ok}` but doesn't surface which features are enabled. Useful for ops tooling, monitoring, and frontend feature flags.

---

## 2. Proposed Architecture

### 2.1 Feature Flag System

**Two levels of feature control:**
1. **Compile-time** (env vars at startup) — decides which routes/plugins load
2. **Runtime** (DB/config settings) — fine-grained per-tenant control (future)

#### `backend/src/config/features.js`

```js
// Reads from env vars with sensible defaults
// FEATURE_* = "true" | "false" | "1" | "0"

function flag(name, defaultValue = true) {
  const val = process.env[`FEATURE_${name.toUpperCase()}`];
  if (val === undefined) return defaultValue;
  return val === 'true' || val === '1';
}

export const features = {
  // Core (always on)
  auth:      true,
  projects:  true,
  documents: true,
  clients:   true,
  search:    true,

  // Optional features
  nok:       flag('NOK', true),      // Greek building regulation rules & checklist
  workflow:  flag('WORKFLOW', true), // Stage advancement logic
  tee:       flag('TEE', true),      // TEE e-Adeies sync (Playwright, heavy)
  fees:      flag('FEES', true),     // Engineer fee calculator (PD 696/74)
  portal:    flag('PORTAL', true),   // Client portal (MinIO, PDF generation)
  sign:      flag('SIGN', true),     // Digital signature on documents
  email:     flag('EMAIL', true),    // Email notifications
};

export function isEnabled(feature) {
  return !!features[feature];
}
```

Then in `.env` for a lite SaaS tier:
```
FEATURE_TEE=false
FEATURE_PORTAL=false
FEATURE_SIGN=false
```

### 2.2 Refactored `app.js` — Conditional Route Loading

Replace static top-level imports with dynamic conditional loading:

```js
// backend/src/app.js
import Fastify from 'fastify';
import cors from '@fastify/cors';
import jwt from '@fastify/jwt';
import multipart from '@fastify/multipart';
import rateLimit from '@fastify/rate-limit';
import errorMonitor from './plugins/error-monitor.js';
import { features } from './config/features.js';

export async function buildApp(opts = {}) {
  const isTest = process.env.NODE_ENV === 'test';

  const app = Fastify({ /* ... same logger config ... */ });

  // Core plugins (always registered)
  await app.register(errorMonitor);
  await app.register(cors, { origin: process.env.FRONTEND_URL || 'http://localhost:3000', credentials: true });
  await app.register(jwt, { secret: process.env.JWT_SECRET || 'dev-secret-change-in-production' });
  await app.register(multipart, { limits: { fileSize: 100 * 1024 * 1024 } });
  await app.register(rateLimit, { max: 200, timeWindow: '1 minute' });

  app.decorate('authenticate', async (request, reply) => {
    try {
      await request.jwtVerify();
    } catch (err) {
      reply.code(401).send({ error: 'Δεν είστε συνδεδεμένος', detail: err.message });
    }
  });

  // Core routes (always loaded)
  const { default: authRoute }     = await import('./routes/auth.js');
  const { default: projectsRoute } = await import('./routes/projects.js');
  const { default: documentsRoute }= await import('./routes/documents.js');
  const { default: clientsRoute }  = await import('./routes/clients.js');
  const { default: searchRoute }   = await import('./routes/search.js');

  await app.register(authRoute,      { prefix: '/api/auth' });
  await app.register(projectsRoute,  { prefix: '/api/projects' });
  await app.register(documentsRoute, { prefix: '/api/projects' });
  await app.register(clientsRoute,   { prefix: '/api/clients' });
  await app.register(searchRoute,    { prefix: '/api/search' });

  // Optional: NOK rules
  if (features.nok) {
    const { default: nokRoute } = await import('./routes/nok.js');
    await app.register(nokRoute, { prefix: '/api/nok' });
  }

  // Optional: Workflow
  if (features.workflow) {
    const { default: workflowRoute } = await import('./routes/workflow.js');
    await app.register(workflowRoute, { prefix: '/api/projects' });
  }

  // Optional: TEE sync (loads Playwright — expensive)
  if (features.tee) {
    const { default: teeRoute } = await import('./routes/tee.js');
    await app.register(teeRoute, { prefix: '/api/tee' });
    app.log.info('TEE sync feature: enabled');
  }

  // Optional: Fee calculator
  if (features.fees) {
    const { default: feesRoute } = await import('./routes/fees.js');
    await app.register(feesRoute, { prefix: '/api/fees' });
  }

  // Optional: Client portal (loads MinIO + PDF libs)
  if (features.portal) {
    const { default: portalRoutes } = await import('./routes/portal.js');
    await app.register(portalRoutes, { prefix: '/api/portal' });
    app.log.info('Client portal feature: enabled');
  }

  // Optional: Digital signing
  if (features.sign) {
    const { default: signRoute } = await import('./routes/sign.js');
    await app.register(signRoute, { prefix: '/api/sign' });
  }

  // Optional: Email (project-level email sending)
  if (features.email) {
    const { default: emailRoute } = await import('./routes/email.js');
    await app.register(emailRoute, { prefix: '/api/projects' });
  }

  // Health check — surfaces enabled features
  app.get('/health', async () => ({
    status: 'ok',
    ts: new Date().toISOString(),
    features: Object.fromEntries(
      Object.entries(features).filter(([, v]) => v)
    ),
  }));

  return app;
}
```

### 2.3 Fix the Route→Route Layering Violation

Move `decryptTeePassword` out of `routes/auth.js` into a utility module:

```js
// backend/src/utils/crypto.js
import { createDecipheriv } from 'crypto';

const TEE_ENC_KEY = Buffer.from(
  process.env.TEE_ENCRYPTION_KEY || '0000000000000000000000000000000000000000000000000000000000000000',
  'hex'
);

export function decryptTeePassword(encrypted) {
  try {
    const [ivHex, cipherHex] = encrypted.split(':');
    const iv = Buffer.from(ivHex, 'hex');
    const decipher = createDecipheriv('aes-256-cbc', TEE_ENC_KEY, iv);
    return decipher.update(cipherHex, 'hex', 'utf8') + decipher.final('utf8');
  } catch {
    return null;
  }
}
```

Then both `auth.js` and `tee.js` routes import from `../utils/crypto.js`, removing the inter-route coupling.

### 2.4 Service Container (Lightweight DI)

For the current single-tenant use case, a simple service container is enough — no need for a full IoC framework. This prepares the ground for multi-tenant without a full rewrite:

```js
// backend/src/container.js
import db from './config/database.js';
import { features } from './config/features.js';

/**
 * Application service container.
 * Centralizes service instantiation and makes dependencies explicit.
 * In the future, this can accept a `tenantDb` parameter for multi-tenancy.
 */
export function createContainer({ database = db } = {}) {
  // Lazy-load services (only import if feature is enabled)
  const services = {};

  services.db = database;

  if (features.nok) {
    // nok-rules is stateless — just re-export
    services.nok = () => import('./services/nok-rules.js');
  }

  if (features.workflow) {
    // workflow-engine needs db injected
    services.workflow = {
      advanceStage: (projectId, userId) => {
        const { advanceStage } = require('./services/workflow-engine.js');
        return advanceStage(projectId, userId, database); // pass db as arg
      },
    };
  }

  if (features.tee) {
    services.teeClient = (username, password) => {
      const { TeeClient } = require('./services/tee-client.js');
      return new TeeClient(username, password);
    };
  }

  if (features.fees) {
    services.fees = () => import('./services/fee-calculator.js');
  }

  if (features.portal) {
    services.portalDocument = () => import('./services/portal-document.js');
    services.portalEmail = () => import('./services/portal-email.js');
  }

  return services;
}
```

Then in `buildApp`, create one container and pass it to routes via Fastify's `decorate`:

```js
// In buildApp():
import { createContainer } from './container.js';
const container = createContainer();
app.decorate('services', container);
```

Routes can then use `fastify.services.fees()` instead of direct imports.

> **Note:** For now this is optional infrastructure. The bigger win is feature flags + conditional route loading (§2.2). The container becomes critical only when multi-tenancy or testing isolation is needed.

### 2.5 Portal Email — Cache the Transporter

```js
// portal-email.js — add module-level transporter cache

let _transporterCache = null;
let _transporterCacheKey = null;

async function getTransporter() {
  const resendKey = await getSetting('resend_api_key') || process.env.RESEND_API_KEY;
  const cacheKey = resendKey || 'default';

  if (_transporterCache && _transporterCacheKey === cacheKey) {
    return _transporterCache;
  }

  // Build transporter (existing logic)...
  _transporterCache = newTransporter;
  _transporterCacheKey = cacheKey;
  return _transporterCache;
}
```

### 2.6 Feature-Gated Health Endpoint

The proposed `GET /health` in §2.2 already handles this. Additionally, expose a dedicated endpoint for frontends:

```js
app.get('/api/features', async () => ({
  features: Object.fromEntries(
    Object.entries(features).map(([k, v]) => [k, Boolean(v)])
  ),
}));
```

Frontend can call this on boot and hide/show TEE, portal, and fee UI sections accordingly.

---

## 3. Priority Ranking

### 🟢 Quick Wins (< 1 day each)

| # | Change | File | Impact |
|---|--------|------|--------|
| 1 | Create `config/features.js` with env-based flags | New file | Unlocks all other changes; no breaking change |
| 2 | Add `/api/features` endpoint | `app.js` | Frontend can hide disabled features |
| 3 | Move `decryptTeePassword` to `utils/crypto.js` | `routes/auth.js` + `routes/tee.js` | Fixes layering violation |
| 4 | Cache portal email transporter | `services/portal-email.js` | Reduces DB hit on every email |
| 5 | Add feature labels to `/health` | `app.js` | Better ops visibility |

### 🟡 Medium Effort (1–2 days)

| # | Change | File | Impact |
|---|--------|------|--------|
| 6 | Convert route imports to conditional dynamic imports | `app.js` | TEE/Portal can be disabled without loading Playwright/pdf-lib |
| 7 | Add `features.tee` / `features.portal` guards on route load | `app.js` | Enables true feature isolation |
| 8 | Write `features.md` documenting which env vars control what | Docs | Essential for SaaS ops |

### 🔴 Major Refactors (multi-day, do when needed)

| # | Change | Files | Impact |
|---|--------|-------|--------|
| 9 | Service container / DI pattern | New `container.js` + all services | Needed for multi-tenancy or test isolation |
| 10 | Thread `db` as a parameter through workflow-engine and tee-client | `workflow-engine.js`, `tee-client.js` | Enables per-tenant DB isolation |
| 11 | Extract portal into a Fastify plugin package | `routes/portal.js` + services | Full plugin encapsulation for marketplace |
| 12 | Per-tenant feature flags from DB | `config/features.js` + DB migration | True SaaS tier differentiation |

---

## 4. Proposed File Structure After Changes

```
backend/src/
├── app.js                      ← conditional route loading
├── index.js                    ← unchanged
├── config/
│   ├── database.js
│   ├── email.js
│   ├── features.js             ← NEW: env-based feature flags
│   ├── minio.js
│   └── redis.js
├── utils/
│   ├── crypto.js               ← NEW: moved from routes/auth.js
│   └── xml-generator.js
├── plugins/
│   └── error-monitor.js
├── middleware/
│   └── validate.js
├── routes/
│   ├── auth.js                 ← remove decryptTeePassword
│   ├── clients.js
│   ├── documents.js
│   ├── email.js
│   ├── fees.js
│   ├── nok.js
│   ├── portal.js
│   ├── projects.js
│   ├── search.js
│   ├── sign.js
│   ├── studies.js
│   ├── tee.js                  ← import from utils/crypto.js
│   └── workflow.js
├── services/
│   ├── fee-calculator.js
│   ├── job-store.js
│   ├── nok-rules.js
│   ├── portal-document.js      ← add transporter cache
│   ├── portal-email.js         ← add transporter cache
│   ├── portal-translations.js
│   ├── tee-client.js
│   └── workflow-engine.js
└── container.js                ← NEW (optional DI, implement when needed)
```

---

## 5. Example `.env` Configurations

**Full install (default):**
```env
# All features on by default — nothing needed
```

**Lite tier (no TEE, no portal, no signing):**
```env
FEATURE_TEE=false
FEATURE_PORTAL=false
FEATURE_SIGN=false
FEATURE_EMAIL=false
```

**Permit calculator only:**
```env
FEATURE_TEE=false
FEATURE_PORTAL=false
FEATURE_SIGN=false
FEATURE_EMAIL=false
FEATURE_FEES=true
FEATURE_NOK=true
FEATURE_WORKFLOW=false
```

---

## 6. Summary

The backend is well-structured for a single-tenant tool but needs three specific changes to become SaaS-ready:

1. **Feature flags** (`config/features.js`) — the foundation for everything else  
2. **Conditional route loading** (`app.js`) — so disabled features don't bloat startup (especially Playwright)  
3. **Fix the `auth.js` → `tee.js` layering violation** (`utils/crypto.js`) — this is a correctness issue regardless of SaaS

The rest (service container, DI, multi-tenant DB) can wait until the business actually needs it. Over-engineering a DI system now would add complexity without immediate payoff.
