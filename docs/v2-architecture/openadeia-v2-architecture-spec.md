# OpenAdeia v2.0 — Architecture Specification

**Version:** 2.0.0-draft  
**Date:** 2026-03-28  
**Author:** Μητσάρας (Architecture Review Agent)  
**Status:** RFC (Request for Comments)

---

## Table of Contents

1. [Vision & Goals](#1-vision--goals)
2. [Architecture Principles](#2-architecture-principles)
3. [System Overview](#3-system-overview)
4. [Multi-Tenancy Design](#4-multi-tenancy-design)
5. [Feature Flag System](#5-feature-flag-system)
6. [Module Architecture](#6-module-architecture)
7. [Database Schema v2](#7-database-schema-v2)
8. [API Design](#8-api-design)
9. [Security Model](#9-security-model)
10. [Billing & Subscription](#10-billing--subscription)
11. [Deployment Architecture](#11-deployment-architecture)
12. [Migration Path](#12-migration-path)
13. [Appendices](#13-appendices)

---

## 1. Vision & Goals

### 1.1 Product Vision

OpenAdeia v2.0 transforms from a single-engineer tool into a **multi-tenant SaaS platform** for Greek architectural/engineering firms to manage building permits (οικοδομικές άδειες), while maintaining the option for **self-hosted deployment**.

### 1.2 Design Goals

| Goal | Description |
|------|-------------|
| **G1: Multi-tenant by default** | All data isolated by tenant; single codebase serves all |
| **G2: Feature modularity** | TEE, Portal, Fees are optional modules, not core dependencies |
| **G3: Self-host parity** | Same Docker image works for SaaS and self-hosted |
| **G4: Horizontal scalability** | Stateless API servers behind load balancer |
| **G5: Graceful degradation** | App works offline; TEE sync is async |
| **G6: Open source core** | AGPL-3.0 with optional commercial modules |

### 1.3 Non-Goals (v2.0)

- Mobile native apps (PWA is sufficient)
- Real-time collaboration (not needed for permit workflow)
- AI-powered document analysis (future v3)
- Multi-region deployment (single EU region is fine)

---

## 2. Architecture Principles

### 2.1 Core Principles

```
┌─────────────────────────────────────────────────────────────────┐
│  P1: TENANT ISOLATION                                          │
│  Every request, query, and file access is scoped to a tenant.  │
│  Zero cross-tenant data leakage by design.                     │
└─────────────────────────────────────────────────────────────────┘
┌─────────────────────────────────────────────────────────────────┐
│  P2: FEATURE AS PLUGIN                                         │
│  Optional features (TEE, Portal, Fees) are Fastify plugins     │
│  that register only when enabled. No phantom dependencies.     │
└─────────────────────────────────────────────────────────────────┘
┌─────────────────────────────────────────────────────────────────┐
│  P3: CONFIG OVER CODE                                          │
│  Behavior changes via env vars and tenant settings, not        │
│  code branches. Same image, different behavior.                │
└─────────────────────────────────────────────────────────────────┘
┌─────────────────────────────────────────────────────────────────┐
│  P4: ASYNC BY DEFAULT                                          │
│  Long operations (TEE sync, PDF gen, email) are queued jobs.   │
│  API returns 202 + job ID, client polls or gets webhook.       │
└─────────────────────────────────────────────────────────────────┘
┌─────────────────────────────────────────────────────────────────┐
│  P5: AUDIT EVERYTHING                                          │
│  Every state change is logged with actor, timestamp, and       │
│  before/after state. GDPR-compliant by design.                 │
└─────────────────────────────────────────────────────────────────┘
```

### 2.2 Technology Choices

| Layer | v1.0 | v2.0 | Rationale |
|-------|------|------|-----------|
| Runtime | Node 20 | Node 22 LTS | Latest LTS, native fetch |
| Framework | Fastify 4 | Fastify 5 | ESM-first, better TS |
| ORM | Knex (raw) | Knex + Kysely types | Type-safe queries |
| Queue | BullMQ | BullMQ | No change needed |
| Cache | Redis | Redis + Keyv | Keyv for feature flags |
| Search | Meilisearch | Meilisearch | Multi-tenant indices |
| Storage | MinIO | MinIO | Tenant-prefixed buckets |
| Auth | Custom JWT | Custom JWT + OIDC option | Enterprise SSO |
| Frontend | React 18 | React 19 | Actions, Server Components ready |
| State | Zustand | Zustand + TanStack Query | Clear separation |
| Billing | — | Stripe | Best API, Greece support |

---

## 3. System Overview

### 3.1 High-Level Architecture

```
                                    ┌──────────────────┐
                                    │   Cloudflare     │
                                    │   (CDN + WAF)    │
                                    └────────┬─────────┘
                                             │
                    ┌────────────────────────┼────────────────────────┐
                    │                        │                        │
              ┌─────▼─────┐           ┌──────▼──────┐          ┌──────▼──────┐
              │  Frontend │           │   API v2    │          │   Portal    │
              │   (SPA)   │           │  (Fastify)  │          │   (Public)  │
              │ React 19  │           │             │          │             │
              └─────┬─────┘           └──────┬──────┘          └──────┬──────┘
                    │                        │                        │
                    │         ┌──────────────┼──────────────┐         │
                    │         │              │              │         │
              ┌─────▼─────────▼──┐    ┌──────▼──────┐  ┌────▼─────────▼────┐
              │    PostgreSQL    │    │    Redis    │  │      MinIO        │
              │   (Multi-tenant) │    │  (Sessions  │  │  (Tenant Buckets) │
              │                  │    │   + Jobs)   │  │                   │
              └──────────────────┘    └─────────────┘  └───────────────────┘
                       │
              ┌────────┴────────┐
              │   Meilisearch   │
              │ (Tenant Indices)│
              └─────────────────┘

              ┌─────────────────────────────────────────────────────────────┐
              │                      Job Workers                            │
              │  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────────────┐ │
              │  │  Email  │  │   TEE   │  │   PDF   │  │  Subscription   │ │
              │  │  Worker │  │  Worker │  │  Worker │  │     Worker      │ │
              │  └─────────┘  └─────────┘  └─────────┘  └─────────────────┘ │
              └─────────────────────────────────────────────────────────────┘
```

### 3.2 Request Flow

```
┌──────┐     ┌───────────┐     ┌──────────┐     ┌──────────┐     ┌────────┐
│Client│────▶│ Cloudflare│────▶│  Nginx   │────▶│ Fastify  │────▶│   DB   │
└──────┘     └───────────┘     └──────────┘     └──────────┘     └────────┘
                                     │               │
                                     │          ┌────▼────┐
                                     │          │  Hooks  │
                                     │          ├─────────┤
                                     │          │ 1. Auth │
                                     │          │ 2. Tenant│
                                     │          │ 3. Feature│
                                     │          │ 4. Audit │
                                     │          └─────────┘
```

**Hook Chain:**
1. **Auth Hook** — Verify JWT, extract user
2. **Tenant Hook** — Load tenant from `user.tenant_id`, attach to request
3. **Feature Hook** — Load enabled features for tenant's plan
4. **Audit Hook** — Log request start (onRequest) and end (onResponse)

---

## 4. Multi-Tenancy Design

### 4.1 Tenant Model

```
┌─────────────────────────────────────────────────────────────────────────┐
│                              TENANT                                     │
├─────────────────────────────────────────────────────────────────────────┤
│ id: UUID (PK)                                                           │
│ slug: VARCHAR(63) UNIQUE  ─────────────▶  firma.openadeia.gr            │
│ name: VARCHAR(255)                                                      │
│ plan: ENUM('free', 'pro', 'enterprise', 'self_hosted')                 │
│ status: ENUM('trialing', 'active', 'past_due', 'canceled', 'suspended')│
├─────────────────────────────────────────────────────────────────────────┤
│ stripe_customer_id: VARCHAR(100)                                        │
│ stripe_subscription_id: VARCHAR(100)                                    │
│ trial_ends_at: TIMESTAMP                                                │
│ current_period_end: TIMESTAMP                                           │
├─────────────────────────────────────────────────────────────────────────┤
│ settings: JSONB  ──────────────────────▶  {                             │
│                                             "engineer_name": "...",     │
│                                             "engineer_am": "...",       │
│                                             "company": {...},           │
│                                             "portal": {...},            │
│                                             "email": {...},             │
│                                             "feature_overrides": {}     │
│                                           }                             │
├─────────────────────────────────────────────────────────────────────────┤
│ limits: JSONB  ────────────────────────▶  {                             │
│                                             "projects_max": 5,          │
│                                             "storage_max_bytes": 5e8,   │
│                                             "team_max": 1               │
│                                           }                             │
├─────────────────────────────────────────────────────────────────────────┤
│ usage: JSONB  ─────────────────────────▶  {                             │
│                                             "projects_count": 3,        │
│                                             "storage_bytes": 1234567,   │
│                                             "team_count": 1             │
│                                           }                             │
├─────────────────────────────────────────────────────────────────────────┤
│ created_at: TIMESTAMP                                                   │
│ updated_at: TIMESTAMP                                                   │
└─────────────────────────────────────────────────────────────────────────┘
```

### 4.2 Tenant Resolution

```
┌─────────────────────────────────────────────────────────────────┐
│                    TENANT RESOLUTION ORDER                      │
├─────────────────────────────────────────────────────────────────┤
│ 1. JWT payload: user.tenant_id (authenticated requests)        │
│ 2. Subdomain: {slug}.openadeia.gr → lookup by slug              │
│ 3. Header: X-Tenant-ID (API/webhook requests)                  │
│ 4. Portal token: /portal/:token → token contains tenant_id     │
└─────────────────────────────────────────────────────────────────┘
```

### 4.3 Data Isolation

**Every tenant-scoped table has:**
```sql
tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE
```

**Query helper (mandatory for all data access):**
```typescript
// src/lib/db.ts
export function tenantQuery<T extends keyof Tables>(
  table: T,
  tenantId: string
): Kysely<Tables[T]> {
  return db.selectFrom(table).where('tenant_id', '=', tenantId);
}

// Usage - compile error if tenant_id forgotten
const projects = await tenantQuery('projects', req.tenantId)
  .where('deleted', '=', false)
  .selectAll()
  .execute();
```

**Row-Level Security (defense in depth):**
```sql
-- Enable RLS on all tenant tables
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;

-- Policy: users can only see their tenant's data
CREATE POLICY tenant_isolation ON projects
  USING (tenant_id = current_setting('app.current_tenant_id')::uuid);

-- Set tenant context at connection level
SET LOCAL app.current_tenant_id = 'uuid-here';
```

### 4.4 Storage Isolation

```
MinIO Bucket Structure:
┌────────────────────────────────────────┐
│ openadeia-documents/                   │
│ ├── tenant-{uuid-1}/                   │
│ │   ├── project-{uuid}/                │
│ │   │   ├── doc-001.pdf                │
│ │   │   └── doc-002.dwg                │
│ │   └── portal/                        │
│ │       └── signed-forms/              │
│ ├── tenant-{uuid-2}/                   │
│ │   └── ...                            │
│ └── tenant-{uuid-3}/                   │
│       └── ...                          │
└────────────────────────────────────────┘
```

**Signed URL generation always includes tenant prefix:**
```typescript
function getDocumentUrl(tenantId: string, documentPath: string): string {
  const key = `tenant-${tenantId}/${documentPath}`;
  return minio.presignedGetObject('openadeia-documents', key, 3600);
}
```

---

## 5. Feature Flag System

### 5.1 Feature Definition

```typescript
// src/config/features.ts

export const FEATURES = {
  // Core (always on)
  'core:projects': { tier: 'free', description: 'Project management' },
  'core:clients': { tier: 'free', description: 'Client database' },
  'core:documents': { tier: 'free', description: 'Document upload' },
  
  // NOK Module
  'nok:checker': { tier: 'free', description: 'Building regulation checker' },
  'nok:custom_rules': { tier: 'enterprise', description: 'Custom NOK rules' },
  
  // Fees Module
  'fees:basic': { tier: 'free', description: 'Basic fee estimation' },
  'fees:pd696': { tier: 'pro', description: 'Full ΠΔ 696/74 calculator' },
  'fees:pdf_export': { tier: 'pro', description: 'Official fee PDF' },
  
  // TEE Module
  'tee:sync': { tier: 'pro', description: 'TEE e-Adeies sync' },
  'tee:submit': { tier: 'pro', description: 'TEE XML submission' },
  'tee:auto_sync': { tier: 'enterprise', description: 'Scheduled auto-sync' },
  
  // Portal Module
  'portal:client': { tier: 'enterprise', description: 'Client portal' },
  'portal:signatures': { tier: 'enterprise', description: 'Digital signatures' },
  'portal:multilingual': { tier: 'enterprise', description: 'Multi-language portal' },
  
  // Team & Collaboration
  'team:multiple': { tier: 'pro', description: 'Multiple team members' },
  'team:roles': { tier: 'enterprise', description: 'Custom roles & permissions' },
  
  // API & Integration
  'api:external': { tier: 'enterprise', description: 'External API access' },
  'api:webhooks': { tier: 'enterprise', description: 'Outbound webhooks' },
  
  // Search
  'search:fulltext': { tier: 'pro', description: 'Full-text search' },
} as const;

export type FeatureKey = keyof typeof FEATURES;
export type Tier = 'free' | 'pro' | 'enterprise' | 'self_hosted';
```

### 5.2 Feature Resolution

```typescript
// src/services/features.ts

const TIER_HIERARCHY: Record<Tier, number> = {
  'free': 0,
  'pro': 1,
  'enterprise': 2,
  'self_hosted': 99, // All features
};

export class FeatureService {
  constructor(private cache: Keyv) {}
  
  async hasFeature(tenantId: string, feature: FeatureKey): Promise<boolean> {
    const cacheKey = `features:${tenantId}`;
    
    // Check cache first (5 min TTL)
    let features = await this.cache.get<Set<FeatureKey>>(cacheKey);
    
    if (!features) {
      features = await this.computeFeatures(tenantId);
      await this.cache.set(cacheKey, features, 5 * 60 * 1000);
    }
    
    return features.has(feature);
  }
  
  private async computeFeatures(tenantId: string): Promise<Set<FeatureKey>> {
    const tenant = await db('tenants').where({ id: tenantId }).first();
    const tierLevel = TIER_HIERARCHY[tenant.plan];
    const overrides = tenant.settings?.feature_overrides || {};
    
    const enabled = new Set<FeatureKey>();
    
    for (const [key, config] of Object.entries(FEATURES)) {
      const featureKey = key as FeatureKey;
      const requiredLevel = TIER_HIERARCHY[config.tier];
      
      // Check override first
      if (overrides[featureKey] === true) {
        enabled.add(featureKey);
      } else if (overrides[featureKey] === false) {
        // Explicitly disabled
      } else if (tierLevel >= requiredLevel) {
        enabled.add(featureKey);
      }
    }
    
    return enabled;
  }
  
  async requireFeature(tenantId: string, feature: FeatureKey): Promise<void> {
    if (!await this.hasFeature(tenantId, feature)) {
      throw new FeatureNotAvailableError(feature);
    }
  }
}

export class FeatureNotAvailableError extends Error {
  statusCode = 402;
  constructor(public feature: FeatureKey) {
    super(`Feature '${feature}' requires plan upgrade`);
  }
}
```

### 5.3 Route-Level Gating

```typescript
// src/plugins/feature-gate.ts

export function requireFeatures(...features: FeatureKey[]) {
  return async function(request: FastifyRequest, reply: FastifyReply) {
    for (const feature of features) {
      await request.features.require(feature);
    }
  };
}

// Usage in routes
fastify.post('/tee/sync', {
  preHandler: [fastify.authenticate, requireFeatures('tee:sync')]
}, async (request, reply) => {
  // Handler code
});
```

### 5.4 Frontend Feature Hook

```typescript
// src/hooks/useFeature.ts

export function useFeature(feature: FeatureKey): boolean {
  const features = useAppStore((s) => s.features);
  return features?.includes(feature) ?? false;
}

export function useFeatures(): FeatureKey[] {
  return useAppStore((s) => s.features) ?? [];
}

// Usage
function TeeSyncPanel() {
  const canSync = useFeature('tee:sync');
  
  if (!canSync) {
    return <UpgradeBanner feature="tee:sync" />;
  }
  
  return <ActualTeeSyncPanel />;
}
```

---

## 6. Module Architecture

### 6.1 Module Structure

```
backend/src/
├── index.ts                 # Entry point
├── app.ts                   # App factory
├── config/
│   ├── database.ts
│   ├── redis.ts
│   ├── features.ts          # Feature definitions
│   └── env.ts               # Validated env vars
├── lib/
│   ├── db.ts                # Kysely + tenant helpers
│   ├── errors.ts            # Error classes
│   └── logger.ts            # Pino config
├── hooks/
│   ├── auth.ts              # JWT verification
│   ├── tenant.ts            # Tenant loading
│   ├── features.ts          # Feature flag injection
│   └── audit.ts             # Request/response logging
├── modules/                  # Feature modules (plugins)
│   ├── core/                 # Always loaded
│   │   ├── index.ts         # Plugin export
│   │   ├── routes/
│   │   │   ├── auth.ts
│   │   │   ├── projects.ts
│   │   │   ├── clients.ts
│   │   │   └── documents.ts
│   │   └── services/
│   │       └── ...
│   ├── nok/                  # NOK module
│   │   ├── index.ts         # Plugin: registers if nok:* enabled
│   │   ├── routes/
│   │   │   └── nok.ts
│   │   └── services/
│   │       └── nok-rules.ts
│   ├── fees/                 # Fees module
│   │   ├── index.ts
│   │   ├── routes/
│   │   │   └── fees.ts
│   │   └── services/
│   │       ├── fee-calculator.ts
│   │       └── pd696-tables.ts
│   ├── tee/                  # TEE module (heavy: Playwright)
│   │   ├── index.ts
│   │   ├── routes/
│   │   │   └── tee.ts
│   │   ├── services/
│   │   │   └── tee-client.ts
│   │   └── workers/
│   │       └── tee-sync.worker.ts
│   ├── portal/               # Portal module (heavy: PDF)
│   │   ├── index.ts
│   │   ├── routes/
│   │   │   ├── portal-admin.ts
│   │   │   └── portal-public.ts
│   │   ├── services/
│   │   │   ├── portal-document.ts
│   │   │   └── portal-email.ts
│   │   └── workers/
│   │       └── portal-pdf.worker.ts
│   └── billing/              # SaaS-only module
│       ├── index.ts
│       ├── routes/
│       │   └── billing.ts
│       └── services/
│           └── stripe.ts
└── workers/
    ├── runner.ts             # Worker process entry
    └── email.worker.ts       # Email queue processor
```

### 6.2 Module Registration

```typescript
// src/app.ts

import { core } from './modules/core';
import { features } from './config/features';

export async function buildApp(opts: AppOptions = {}): Promise<FastifyInstance> {
  const app = Fastify({ logger: opts.logger ?? true });
  
  // Core plugins (always)
  await app.register(cors);
  await app.register(jwt);
  await app.register(multipart);
  
  // Core hooks
  await app.register(authHook);
  await app.register(tenantHook);
  await app.register(featureHook);
  await app.register(auditHook);
  
  // Core module (always)
  await app.register(core, { prefix: '/api' });
  
  // Optional modules (load only if any tenant could use them)
  // In SaaS mode, load all; in self-hosted, check env
  
  if (shouldLoadModule('nok')) {
    const { nok } = await import('./modules/nok');
    await app.register(nok, { prefix: '/api/nok' });
  }
  
  if (shouldLoadModule('fees')) {
    const { fees } = await import('./modules/fees');
    await app.register(fees, { prefix: '/api/fees' });
  }
  
  if (shouldLoadModule('tee')) {
    const { tee } = await import('./modules/tee');
    await app.register(tee, { prefix: '/api/tee' });
    app.log.info('TEE module loaded (Playwright available)');
  }
  
  if (shouldLoadModule('portal')) {
    const { portal } = await import('./modules/portal');
    await app.register(portal, { prefix: '/api/portal' });
    app.log.info('Portal module loaded (PDF generation available)');
  }
  
  if (process.env.SAAS_MODE === 'true') {
    const { billing } = await import('./modules/billing');
    await app.register(billing, { prefix: '/api/billing' });
  }
  
  return app;
}

function shouldLoadModule(module: string): boolean {
  if (process.env.SAAS_MODE === 'true') return true;
  
  // Self-hosted: check env
  const envKey = `MODULE_${module.toUpperCase()}`;
  return process.env[envKey] !== 'false';
}
```

### 6.3 Module Interface

Each module exports a Fastify plugin:

```typescript
// src/modules/tee/index.ts

import fp from 'fastify-plugin';
import teeRoutes from './routes/tee';
import { TeeClient } from './services/tee-client';

export const tee = fp(async (fastify) => {
  // Module-specific decorators
  fastify.decorate('teeClient', (username: string, password: string) => {
    return new TeeClient(username, password);
  });
  
  // Routes
  await fastify.register(teeRoutes);
  
}, {
  name: 'openadeia-tee',
  dependencies: ['openadeia-core'],
});
```

---

## 7. Database Schema v2

### 7.1 Core Tables

```sql
-- ══════════════════════════════════════════════════════════════════
-- TENANTS
-- ══════════════════════════════════════════════════════════════════
CREATE TABLE tenants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug VARCHAR(63) UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,
  plan VARCHAR(20) NOT NULL DEFAULT 'free'
    CHECK (plan IN ('free', 'pro', 'enterprise', 'self_hosted')),
  status VARCHAR(20) NOT NULL DEFAULT 'trialing'
    CHECK (status IN ('trialing', 'active', 'past_due', 'canceled', 'suspended')),
  
  -- Stripe
  stripe_customer_id VARCHAR(100),
  stripe_subscription_id VARCHAR(100),
  trial_ends_at TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,
  
  -- Settings (replaces portal_settings)
  settings JSONB NOT NULL DEFAULT '{}',
  
  -- Limits (per-plan, can be overridden)
  limits JSONB NOT NULL DEFAULT '{"projects_max": 5, "storage_max_bytes": 524288000, "team_max": 1}',
  
  -- Usage counters (cached, updated on writes)
  usage JSONB NOT NULL DEFAULT '{"projects_count": 0, "storage_bytes": 0, "team_count": 0}',
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_tenants_slug ON tenants(slug);
CREATE INDEX idx_tenants_stripe ON tenants(stripe_customer_id);

-- ══════════════════════════════════════════════════════════════════
-- USERS
-- ══════════════════════════════════════════════════════════════════
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  
  email VARCHAR(255) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  name VARCHAR(255) NOT NULL,
  role VARCHAR(20) NOT NULL DEFAULT 'engineer'
    CHECK (role IN ('admin', 'engineer', 'viewer')),
  
  -- TEE credentials (encrypted)
  tee_username VARCHAR(255),
  tee_password_enc TEXT,
  
  -- Auth state
  email_verified_at TIMESTAMPTZ,
  last_login_at TIMESTAMPTZ,
  password_reset_token VARCHAR(100),
  password_reset_expires TIMESTAMPTZ,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  UNIQUE(tenant_id, email)
);

CREATE INDEX idx_users_tenant ON users(tenant_id);
CREATE INDEX idx_users_email ON users(email);

-- ══════════════════════════════════════════════════════════════════
-- CLIENTS (Ιδιοκτήτες/Εντολείς)
-- ══════════════════════════════════════════════════════════════════
CREATE TABLE clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  
  -- Identity
  owner_type SMALLINT NOT NULL DEFAULT 1, -- 1=φυσικό, 2=νομικό
  surname VARCHAR(255),        -- επώνυμο (φυσικό)
  name VARCHAR(255) NOT NULL,  -- όνομα / επωνυμία
  father_name VARCHAR(255),
  afm VARCHAR(9),
  adt VARCHAR(20),
  
  -- Contact
  address TEXT,
  phone VARCHAR(20),
  email VARCHAR(255),
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_clients_tenant ON clients(tenant_id);
CREATE INDEX idx_clients_afm ON clients(tenant_id, afm);

-- ══════════════════════════════════════════════════════════════════
-- PROJECTS (Φάκελοι Αδειών)
-- ══════════════════════════════════════════════════════════════════
CREATE TABLE projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  
  -- Basic info
  code VARCHAR(50) NOT NULL,
  title VARCHAR(500) NOT NULL,
  type VARCHAR(50) NOT NULL,  -- new_building, renovation, legalization, etc.
  
  -- Location
  municipality VARCHAR(255),
  address TEXT,
  kaek VARCHAR(14),
  coordinates GEOMETRY(Point, 4326),
  
  -- Workflow
  stage VARCHAR(50) NOT NULL DEFAULT 'data_collection',
  stage_updated_at TIMESTAMPTZ,
  
  -- Relations
  client_id UUID REFERENCES clients(id) ON DELETE SET NULL,
  assigned_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  
  -- TEE sync
  tee_protocol VARCHAR(50),
  tee_last_synced_at TIMESTAMPTZ,
  tee_metadata JSONB,
  
  -- Soft delete
  deleted BOOLEAN NOT NULL DEFAULT false,
  deleted_at TIMESTAMPTZ,
  
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  UNIQUE(tenant_id, code)
);

CREATE INDEX idx_projects_tenant ON projects(tenant_id, deleted);
CREATE INDEX idx_projects_client ON projects(client_id);
CREATE INDEX idx_projects_tee ON projects(tenant_id, tee_protocol);

-- ══════════════════════════════════════════════════════════════════
-- DOCUMENTS
-- ══════════════════════════════════════════════════════════════════
CREATE TABLE documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  
  filename VARCHAR(255) NOT NULL,
  original_filename VARCHAR(255) NOT NULL,
  mime_type VARCHAR(100) NOT NULL,
  size_bytes BIGINT NOT NULL,
  storage_path TEXT NOT NULL,  -- MinIO path within tenant bucket
  
  category VARCHAR(50),  -- architectural, static, mep, legal, etc.
  description TEXT,
  
  uploaded_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_documents_project ON documents(project_id);
CREATE INDEX idx_documents_tenant ON documents(tenant_id);

-- ══════════════════════════════════════════════════════════════════
-- FEE CALCULATIONS
-- ══════════════════════════════════════════════════════════════════
CREATE TABLE fee_calculations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  
  -- Input parameters
  input_data JSONB NOT NULL,  -- areas, categories, coefficients
  
  -- Calculated results
  results JSONB NOT NULL,     -- per-study fees, totals
  
  -- ΠΔ 696/74 specific
  is_official BOOLEAN NOT NULL DEFAULT false,
  pd696_version VARCHAR(20),  -- calculation version for reproducibility
  
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_fees_project ON fee_calculations(project_id);

-- ══════════════════════════════════════════════════════════════════
-- WORKFLOW LOGS (Audit trail)
-- ══════════════════════════════════════════════════════════════════
CREATE TABLE workflow_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  
  action VARCHAR(100) NOT NULL,
  from_stage VARCHAR(50),
  to_stage VARCHAR(50),
  
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  metadata JSONB,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_workflow_logs_project ON workflow_logs(project_id);

-- ══════════════════════════════════════════════════════════════════
-- AUDIT LOG (GDPR compliance)
-- ══════════════════════════════════════════════════════════════════
CREATE TABLE audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  
  actor_type VARCHAR(20) NOT NULL,  -- user, portal_client, system, api
  actor_id VARCHAR(100),
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  
  action VARCHAR(100) NOT NULL,
  resource_type VARCHAR(50),
  resource_id UUID,
  
  metadata JSONB,
  ip_address INET,
  user_agent TEXT,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
) PARTITION BY RANGE (created_at);

-- Monthly partitions
CREATE TABLE audit_log_2026_01 PARTITION OF audit_log
  FOR VALUES FROM ('2026-01-01') TO ('2026-02-01');
CREATE TABLE audit_log_2026_02 PARTITION OF audit_log
  FOR VALUES FROM ('2026-02-01') TO ('2026-03-01');
-- ... etc (automate with pg_partman)

CREATE INDEX idx_audit_tenant_created ON audit_log(tenant_id, created_at DESC);
```

### 7.2 Portal Tables

```sql
-- ══════════════════════════════════════════════════════════════════
-- PORTAL PROJECTS (Client-facing portal instances)
-- ══════════════════════════════════════════════════════════════════
CREATE TABLE portal_projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  
  token VARCHAR(64) UNIQUE NOT NULL,  -- Public access token
  
  client_name VARCHAR(255) NOT NULL,
  client_email VARCHAR(255),
  client_phone VARCHAR(20),
  
  language VARCHAR(5) NOT NULL DEFAULT 'el',
  status VARCHAR(20) NOT NULL DEFAULT 'draft',
  
  completed_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_portal_projects_token ON portal_projects(token);
CREATE INDEX idx_portal_projects_tenant ON portal_projects(tenant_id);

-- ══════════════════════════════════════════════════════════════════
-- PORTAL TEMPLATES
-- ══════════════════════════════════════════════════════════════════
CREATE TABLE portal_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  
  name VARCHAR(255) NOT NULL,
  description TEXT,
  steps JSONB NOT NULL,  -- Array of step definitions
  
  is_default BOOLEAN NOT NULL DEFAULT false,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ══════════════════════════════════════════════════════════════════
-- PORTAL FORM DATA
-- ══════════════════════════════════════════════════════════════════
CREATE TABLE portal_form_data (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  portal_project_id UUID NOT NULL REFERENCES portal_projects(id) ON DELETE CASCADE,
  
  step_id VARCHAR(100) NOT NULL,
  field_id VARCHAR(100) NOT NULL,
  value JSONB,
  
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  UNIQUE(portal_project_id, step_id, field_id)
);

-- ══════════════════════════════════════════════════════════════════
-- PORTAL SIGNATURES
-- ══════════════════════════════════════════════════════════════════
CREATE TABLE portal_signatures (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  portal_project_id UUID NOT NULL REFERENCES portal_projects(id) ON DELETE CASCADE,
  
  document_type VARCHAR(100) NOT NULL,
  signature_image TEXT NOT NULL,  -- Base64 PNG
  
  ip_address INET,
  user_agent TEXT,
  
  signed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

---

## 8. API Design

### 8.1 API Principles

```
┌─────────────────────────────────────────────────────────────────┐
│                       API DESIGN RULES                          │
├─────────────────────────────────────────────────────────────────┤
│ 1. RESTful resource naming: /api/{resource}/{id}/{sub-resource} │
│ 2. Consistent response envelope: { data, meta, errors }        │
│ 3. Pagination: cursor-based (not offset) for large collections │
│ 4. Async operations return 202 + Location header               │
│ 5. Errors follow RFC 7807 Problem Details                       │
│ 6. API versioning via URL: /api/v2/...                          │
└─────────────────────────────────────────────────────────────────┘
```

### 8.2 Endpoint Map

```
AUTH
  POST   /api/v2/auth/login
  POST   /api/v2/auth/logout
  POST   /api/v2/auth/register          # SaaS: org + admin signup
  POST   /api/v2/auth/forgot-password
  POST   /api/v2/auth/reset-password
  POST   /api/v2/auth/verify-email
  GET    /api/v2/auth/me
  PATCH  /api/v2/auth/me

PROJECTS
  GET    /api/v2/projects
  POST   /api/v2/projects
  GET    /api/v2/projects/:id
  PATCH  /api/v2/projects/:id
  DELETE /api/v2/projects/:id
  
  # Sub-resources
  GET    /api/v2/projects/:id/documents
  POST   /api/v2/projects/:id/documents
  GET    /api/v2/projects/:id/fees
  POST   /api/v2/projects/:id/fees
  GET    /api/v2/projects/:id/workflow
  POST   /api/v2/projects/:id/workflow/advance

CLIENTS
  GET    /api/v2/clients
  POST   /api/v2/clients
  GET    /api/v2/clients/:id
  PATCH  /api/v2/clients/:id
  DELETE /api/v2/clients/:id
  GET    /api/v2/clients/:id/projects

DOCUMENTS
  GET    /api/v2/documents/:id
  DELETE /api/v2/documents/:id
  GET    /api/v2/documents/:id/download    # Returns signed URL

NOK (feature-gated)
  GET    /api/v2/nok/rules
  GET    /api/v2/nok/rules/:permitType
  POST   /api/v2/nok/check                 # Check project compliance

FEES (feature-gated)
  GET    /api/v2/fees/calculate            # Query params input
  POST   /api/v2/fees/calculate            # JSON body input
  GET    /api/v2/fees/:id
  GET    /api/v2/fees/:id/pdf              # Pro feature

TEE (feature-gated)
  POST   /api/v2/tee/sync                  # Returns 202 + job ID
  GET    /api/v2/tee/jobs/:jobId
  POST   /api/v2/tee/submit/:projectId     # Returns 202 + job ID
  GET    /api/v2/tee/credentials
  PUT    /api/v2/tee/credentials

PORTAL (feature-gated)
  # Admin endpoints
  GET    /api/v2/portal/projects
  POST   /api/v2/portal/projects
  GET    /api/v2/portal/projects/:id
  PATCH  /api/v2/portal/projects/:id
  POST   /api/v2/portal/projects/:id/send  # Send invite email
  
  # Public endpoints (token auth)
  GET    /api/v2/portal/p/:token
  POST   /api/v2/portal/p/:token/form
  POST   /api/v2/portal/p/:token/sign
  POST   /api/v2/portal/p/:token/submit

BILLING (SaaS only)
  GET    /api/v2/billing/subscription
  POST   /api/v2/billing/checkout
  POST   /api/v2/billing/portal
  POST   /api/v2/billing/webhook           # Stripe webhook

ADMIN (SaaS superadmin)
  GET    /api/v2/admin/tenants
  GET    /api/v2/admin/tenants/:id
  PATCH  /api/v2/admin/tenants/:id
  GET    /api/v2/admin/metrics

TENANT SETTINGS
  GET    /api/v2/settings
  PATCH  /api/v2/settings
  GET    /api/v2/settings/users
  POST   /api/v2/settings/users
  DELETE /api/v2/settings/users/:id

META
  GET    /api/v2/features                  # Enabled features for tenant
  GET    /health
  GET    /api/v2/export                    # GDPR data export
```

### 8.3 Response Envelope

```typescript
// Success
{
  "data": { ... } | [ ... ],
  "meta": {
    "pagination": {
      "cursor": "abc123",
      "hasMore": true,
      "total": 150
    },
    "timing_ms": 42
  }
}

// Error (RFC 7807)
{
  "type": "https://openadeia.gr/errors/feature-not-available",
  "title": "Feature Not Available",
  "status": 402,
  "detail": "Feature 'tee:sync' requires Pro plan or higher",
  "instance": "/api/v2/tee/sync",
  "feature": "tee:sync",
  "currentPlan": "free",
  "requiredPlan": "pro"
}
```

---

## 9. Security Model

### 9.1 Authentication

```
┌─────────────────────────────────────────────────────────────────┐
│                    AUTHENTICATION FLOWS                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────────┐                                            │
│  │  Password Auth  │  Email + Password → JWT (access + refresh) │
│  └─────────────────┘                                            │
│                                                                 │
│  ┌─────────────────┐                                            │
│  │  Portal Token   │  /portal/:token → Limited access           │
│  └─────────────────┘                                            │
│                                                                 │
│  ┌─────────────────┐                                            │
│  │  API Key        │  X-API-Key header (enterprise tier)        │
│  └─────────────────┘                                            │
│                                                                 │
│  ┌─────────────────┐                                            │
│  │  OIDC/SAML      │  Enterprise SSO (v2.1)                    │
│  └─────────────────┘                                            │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 9.2 JWT Structure

```typescript
// Access token (15 min TTL)
{
  "sub": "user-uuid",
  "tid": "tenant-uuid",      // Tenant ID
  "email": "user@example.com",
  "role": "engineer",
  "plan": "pro",             // Cached for quick feature checks
  "iat": 1711648200,
  "exp": 1711649100
}

// Refresh token (7 day TTL, stored in httpOnly cookie)
{
  "sub": "user-uuid",
  "tid": "tenant-uuid",
  "type": "refresh",
  "iat": 1711648200,
  "exp": 1712253000
}
```

### 9.3 Authorization Matrix

```
┌────────────────────┬───────┬──────────┬────────┐
│ Resource           │ Admin │ Engineer │ Viewer │
├────────────────────┼───────┼──────────┼────────┤
│ Projects (own)     │ CRUD  │ CRUD     │ R      │
│ Projects (others)  │ CRUD  │ R        │ R      │
│ Clients            │ CRUD  │ CRUD     │ R      │
│ Documents          │ CRUD  │ CRUD     │ R      │
│ Fee calculations   │ CRUD  │ CRUD     │ R      │
│ TEE sync           │ ✓     │ ✓        │ ✗      │
│ Portal management  │ CRUD  │ CRUD     │ R      │
│ Team management    │ CRUD  │ ✗        │ ✗      │
│ Billing            │ ✓     │ ✗        │ ✗      │
│ Tenant settings    │ CRUD  │ R        │ ✗      │
│ Audit logs         │ R     │ ✗        │ ✗      │
└────────────────────┴───────┴──────────┴────────┘
```

### 9.4 Rate Limiting

```typescript
const rateLimits = {
  // Global
  global: { max: 1000, window: '1 minute' },
  
  // Auth (prevent brute force)
  'POST /auth/login': { max: 5, window: '15 minutes' },
  'POST /auth/forgot-password': { max: 3, window: '1 hour' },
  
  // Heavy operations
  'POST /tee/sync': { max: 10, window: '1 hour' },
  'POST /fees/calculate': { max: 100, window: '1 hour' },
  
  // Portal (public, stricter)
  'POST /portal/p/:token/*': { max: 30, window: '1 minute' },
};
```

### 9.5 Data Encryption

```
┌─────────────────────────────────────────────────────────────────┐
│                       ENCRYPTION LAYERS                         │
├─────────────────────────────────────────────────────────────────┤
│ Transport:  TLS 1.3 (Cloudflare → Nginx → App)                 │
│ At Rest:    PostgreSQL TDE + MinIO server-side encryption      │
│ Secrets:    TEE passwords encrypted with AES-256-GCM           │
│             Key from env: TEE_ENCRYPTION_KEY (32 bytes hex)    │
│ Tokens:     JWT signed with RS256 (rotate keys monthly)        │
└─────────────────────────────────────────────────────────────────┘
```

---

## 10. Billing & Subscription

### 10.1 Subscription Lifecycle

```
┌─────────────────────────────────────────────────────────────────┐
│                   SUBSCRIPTION STATE MACHINE                    │
└─────────────────────────────────────────────────────────────────┘

     ┌──────────────┐
     │   SIGNUP     │
     └──────┬───────┘
            │
            ▼
     ┌──────────────┐     14 days      ┌──────────────┐
     │   TRIALING   │─────────────────▶│   EXPIRED    │
     └──────┬───────┘                  └──────┬───────┘
            │                                 │
            │ checkout                        │ checkout
            ▼                                 ▼
     ┌──────────────┐                  ┌──────────────┐
     │    ACTIVE    │◀─────────────────│              │
     └──────┬───────┘    payment       └──────────────┘
            │
            │ payment_failed
            ▼
     ┌──────────────┐     7 days       ┌──────────────┐
     │   PAST_DUE   │─────────────────▶│  SUSPENDED   │
     └──────┬───────┘                  └──────┬───────┘
            │                                 │
            │ payment_succeeded               │ 30 days
            ▼                                 ▼
     ┌──────────────┐                  ┌──────────────┐
     │    ACTIVE    │                  │   DELETED    │
     └──────────────┘                  └──────────────┘

```

### 10.2 Plan Limits

```typescript
export const PLAN_LIMITS: Record<Plan, PlanLimits> = {
  free: {
    projects_max: 5,
    storage_max_bytes: 500 * 1024 * 1024,  // 500 MB
    team_max: 1,
    api_calls_per_day: 0,
  },
  pro: {
    projects_max: -1,  // unlimited
    storage_max_bytes: 10 * 1024 * 1024 * 1024,  // 10 GB
    team_max: 3,
    api_calls_per_day: 0,
  },
  enterprise: {
    projects_max: -1,
    storage_max_bytes: -1,  // unlimited
    team_max: -1,
    api_calls_per_day: 10000,
  },
  self_hosted: {
    projects_max: -1,
    storage_max_bytes: -1,
    team_max: -1,
    api_calls_per_day: -1,
  },
};
```

### 10.3 Usage Tracking

```typescript
// Increment on writes
async function trackProjectCreated(tenantId: string): Promise<void> {
  await db('tenants')
    .where({ id: tenantId })
    .update({
      usage: db.raw(`
        jsonb_set(usage, '{projects_count}', 
          to_jsonb((usage->>'projects_count')::int + 1))
      `),
    });
}

// Check before action
async function checkProjectLimit(tenantId: string): Promise<void> {
  const tenant = await db('tenants').where({ id: tenantId }).first();
  const limit = tenant.limits.projects_max;
  const current = tenant.usage.projects_count;
  
  if (limit !== -1 && current >= limit) {
    throw new LimitExceededError('projects', current, limit);
  }
}
```

---

## 11. Deployment Architecture

### 11.1 Infrastructure (SaaS)

```
┌─────────────────────────────────────────────────────────────────┐
│                         HETZNER (EU)                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐             │
│  │   API-1     │  │   API-2     │  │   API-3     │             │
│  │  (Docker)   │  │  (Docker)   │  │  (Docker)   │             │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘             │
│         │                │                │                     │
│         └────────────────┼────────────────┘                     │
│                          │                                      │
│                   ┌──────▼──────┐                               │
│                   │   Traefik   │                               │
│                   │ (LB + TLS)  │                               │
│                   └──────┬──────┘                               │
│                          │                                      │
│  ┌───────────────────────┼───────────────────────┐             │
│  │                       │                       │             │
│  │  ┌─────────────┐  ┌───▼───────┐  ┌──────────┐ │             │
│  │  │  Postgres   │  │   Redis   │  │  MinIO   │ │             │
│  │  │  (Primary)  │  │ (Cluster) │  │ (Cluster)│ │             │
│  │  └──────┬──────┘  └───────────┘  └──────────┘ │             │
│  │         │                                      │             │
│  │  ┌──────▼──────┐                              │             │
│  │  │  Postgres   │         DATA LAYER           │             │
│  │  │  (Replica)  │                              │             │
│  │  └─────────────┘                              │             │
│  └───────────────────────────────────────────────┘             │
│                                                                 │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐             │
│  │  Worker-1   │  │  Worker-2   │  │ Meilisearch │             │
│  │ (TEE/Email) │  │ (PDF/Sync)  │  │             │             │
│  └─────────────┘  └─────────────┘  └─────────────┘             │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
                          │
                          │
                   ┌──────▼──────┐
                   │ Cloudflare  │
                   │ (CDN + WAF) │
                   └─────────────┘
```

### 11.2 Docker Compose (Self-Hosted)

```yaml
# docker-compose.yml (self-hosted production)
version: '3.9'

services:
  api:
    image: ghcr.io/openadeia/openadeia:2.0
    environment:
      - DATABASE_URL=postgres://openadeia:${DB_PASSWORD}@db:5432/openadeia
      - REDIS_URL=redis://redis:6379
      - MINIO_ENDPOINT=minio:9000
      - MINIO_ACCESS_KEY=${MINIO_ACCESS_KEY}
      - MINIO_SECRET_KEY=${MINIO_SECRET_KEY}
      - JWT_SECRET=${JWT_SECRET}
      - SAAS_MODE=false
      - MODULE_TEE=true
      - MODULE_PORTAL=true
      - MODULE_FEES=true
    ports:
      - "4000:4000"
    depends_on:
      - db
      - redis
      - minio

  worker:
    image: ghcr.io/openadeia/openadeia:2.0
    command: ["node", "src/workers/runner.js"]
    environment:
      # Same as api
    depends_on:
      - db
      - redis
      - minio

  db:
    image: postgis/postgis:15-3.4
    volumes:
      - pgdata:/var/lib/postgresql/data
    environment:
      - POSTGRES_USER=openadeia
      - POSTGRES_PASSWORD=${DB_PASSWORD}
      - POSTGRES_DB=openadeia

  redis:
    image: redis:7-alpine
    volumes:
      - redisdata:/data

  minio:
    image: minio/minio:latest
    command: server /data --console-address ":9001"
    volumes:
      - miniodata:/data
    environment:
      - MINIO_ROOT_USER=${MINIO_ACCESS_KEY}
      - MINIO_ROOT_PASSWORD=${MINIO_SECRET_KEY}

  meilisearch:
    image: getmeili/meilisearch:v1.6
    volumes:
      - meilidata:/meili_data
    environment:
      - MEILI_MASTER_KEY=${MEILI_MASTER_KEY}

volumes:
  pgdata:
  redisdata:
  miniodata:
  meilidata:
```

### 11.3 CI/CD Pipeline

```yaml
# .github/workflows/release.yml
name: Release

on:
  push:
    tags: ['v*']

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 22 }
      - run: npm ci
      - run: npm test

  build:
    needs: test
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: docker/setup-buildx-action@v3
      - uses: docker/login-action@v3
        with:
          registry: ghcr.io
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}
      - uses: docker/build-push-action@v5
        with:
          push: true
          tags: |
            ghcr.io/openadeia/openadeia:${{ github.ref_name }}
            ghcr.io/openadeia/openadeia:latest
          cache-from: type=gha
          cache-to: type=gha,mode=max

  deploy-staging:
    needs: build
    runs-on: ubuntu-latest
    environment: staging
    steps:
      - run: |
          curl -X POST ${{ secrets.DEPLOY_WEBHOOK_STAGING }}

  deploy-production:
    needs: deploy-staging
    runs-on: ubuntu-latest
    environment: production
    steps:
      - run: |
          curl -X POST ${{ secrets.DEPLOY_WEBHOOK_PRODUCTION }}
```

---

## 12. Migration Path

### 12.1 Phase Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                    V1 → V2 MIGRATION PATH                       │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Phase 0: Preparation (1 week)                                  │
│  ├── Backup everything                                          │
│  ├── Document current state                                     │
│  └── Set up staging environment                                 │
│                                                                 │
│  Phase 1: Schema Migration (2 days)                             │
│  ├── Run migration 007 (tenants + tenant_id columns)           │
│  ├── Create default tenant for existing data                   │
│  └── Backfill tenant_id on all rows                            │
│                                                                 │
│  Phase 2: Code Migration (1 week)                               │
│  ├── Replace portal_settings reads with tenant.settings        │
│  ├── Add tenant_id to all queries                              │
│  ├── Update JWT to include tenant_id                           │
│  └── Add feature flag checks                                    │
│                                                                 │
│  Phase 3: API v2 (1 week)                                       │
│  ├── Implement new endpoints alongside v1                      │
│  ├── Add /api/v2 prefix                                        │
│  └── Deprecate /api/v1 (but keep working)                      │
│                                                                 │
│  Phase 4: Frontend Migration (1 week)                           │
│  ├── Update API calls to v2                                    │
│  ├── Add feature flag UI                                       │
│  └── Add lazy loading                                          │
│                                                                 │
│  Phase 5: Billing Integration (2 weeks)                         │
│  ├── Stripe setup                                              │
│  ├── Webhook handlers                                          │
│  └── Checkout flow                                             │
│                                                                 │
│  Phase 6: Launch (1 week)                                       │
│  ├── Public signup                                             │
│  ├── Marketing site                                            │
│  └── Documentation                                             │
│                                                                 │
│  Total: ~8 weeks                                                │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 12.2 Data Migration Script

```typescript
// migrations/007_multitenancy.ts

export async function up(knex: Knex): Promise<void> {
  // 1. Create tenants table
  await knex.schema.createTable('tenants', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.string('slug', 63).unique().notNullable();
    t.string('name', 255).notNullable();
    t.string('plan', 20).notNullable().defaultTo('self_hosted');
    t.string('status', 20).notNullable().defaultTo('active');
    t.jsonb('settings').notNullable().defaultTo('{}');
    t.jsonb('limits').notNullable().defaultTo('{}');
    t.jsonb('usage').notNullable().defaultTo('{}');
    t.timestamps(true, true);
  });

  // 2. Create default tenant from existing portal_settings
  const existingSettings = await knex('portal_settings').first();
  
  const [defaultTenant] = await knex('tenants').insert({
    slug: 'forma-architecture',
    name: existingSettings?.engineer_name || 'Default Tenant',
    plan: 'self_hosted',
    status: 'active',
    settings: {
      engineer_name: existingSettings?.engineer_name,
      engineer_am: existingSettings?.engineer_am,
      company_name: existingSettings?.company_name,
      // ... migrate all portal_settings fields
    },
  }).returning('id');

  const tenantId = defaultTenant.id;

  // 3. Add tenant_id to all tables
  const tables = ['users', 'projects', 'clients', 'documents', 
                  'fee_calculations', 'emails', 'workflow_logs'];
  
  for (const table of tables) {
    await knex.schema.alterTable(table, (t) => {
      t.uuid('tenant_id').references('id').inTable('tenants');
    });
    
    // Backfill
    await knex(table).update({ tenant_id: tenantId });
    
    // Make NOT NULL after backfill
    await knex.schema.alterTable(table, (t) => {
      t.uuid('tenant_id').notNullable().alter();
    });
  }

  // 4. Create indexes
  for (const table of tables) {
    await knex.schema.alterTable(table, (t) => {
      t.index(['tenant_id']);
    });
  }

  // 5. Migrate portal tables similarly
  // ...
}

export async function down(knex: Knex): Promise<void> {
  // Reverse migration (for safety, keep tenant_id columns)
  await knex.schema.dropTableIfExists('tenants');
}
```

### 12.3 Zero-Downtime Deploy

```
┌─────────────────────────────────────────────────────────────────┐
│                  ZERO-DOWNTIME MIGRATION                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  1. Deploy new API version alongside old                        │
│     ├── api-v1.openadeia.gr (existing)                         │
│     └── api-v2.openadeia.gr (new)                              │
│                                                                 │
│  2. Run migration with TENANT_ID optional                       │
│     └── Old code continues working                              │
│                                                                 │
│  3. Backfill tenant_id in batches                               │
│     └── 1000 rows at a time, with sleep                        │
│                                                                 │
│  4. Switch traffic to v2                                        │
│     └── Traefik config change                                   │
│                                                                 │
│  5. Make tenant_id NOT NULL                                     │
│     └── Final migration                                         │
│                                                                 │
│  6. Decommission v1                                             │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 13. Appendices

### A. Environment Variables

```bash
# ═══════════════════════════════════════════════════════════════
# CORE
# ═══════════════════════════════════════════════════════════════
NODE_ENV=production
PORT=4000
HOST=0.0.0.0

# ═══════════════════════════════════════════════════════════════
# DATABASE
# ═══════════════════════════════════════════════════════════════
DATABASE_URL=postgres://user:pass@host:5432/openadeia

# ═══════════════════════════════════════════════════════════════
# REDIS
# ═══════════════════════════════════════════════════════════════
REDIS_URL=redis://host:6379

# ═══════════════════════════════════════════════════════════════
# OBJECT STORAGE
# ═══════════════════════════════════════════════════════════════
MINIO_ENDPOINT=minio:9000
MINIO_ACCESS_KEY=...
MINIO_SECRET_KEY=...
MINIO_USE_SSL=false
MINIO_BUCKET=openadeia-documents

# ═══════════════════════════════════════════════════════════════
# AUTH
# ═══════════════════════════════════════════════════════════════
JWT_SECRET=...                    # Min 32 chars
JWT_ACCESS_TTL=15m
JWT_REFRESH_TTL=7d
TEE_ENCRYPTION_KEY=...            # 32 bytes hex

# ═══════════════════════════════════════════════════════════════
# EMAIL
# ═══════════════════════════════════════════════════════════════
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USER=...
SMTP_PASS=...
SMTP_FROM=noreply@openadeia.gr
# OR
RESEND_API_KEY=re_...

# ═══════════════════════════════════════════════════════════════
# SEARCH
# ═══════════════════════════════════════════════════════════════
MEILISEARCH_HOST=http://meilisearch:7700
MEILISEARCH_API_KEY=...

# ═══════════════════════════════════════════════════════════════
# SAAS MODE
# ═══════════════════════════════════════════════════════════════
SAAS_MODE=true                    # Enable multi-tenancy
APP_BASE_URL=https://openadeia.gr
FRONTEND_URL=https://app.openadeia.gr

# ═══════════════════════════════════════════════════════════════
# STRIPE (SaaS only)
# ═══════════════════════════════════════════════════════════════
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRO_MONTHLY_PRICE_ID=price_...
STRIPE_PRO_ANNUAL_PRICE_ID=price_...
STRIPE_ENT_MONTHLY_PRICE_ID=price_...
STRIPE_ENT_ANNUAL_PRICE_ID=price_...

# ═══════════════════════════════════════════════════════════════
# MODULES (self-hosted, all true by default)
# ═══════════════════════════════════════════════════════════════
MODULE_TEE=true
MODULE_PORTAL=true
MODULE_FEES=true
MODULE_NOK=true

# ═══════════════════════════════════════════════════════════════
# MONITORING
# ═══════════════════════════════════════════════════════════════
SENTRY_DSN=https://...@sentry.io/...
LOG_LEVEL=info
```

### B. Glossary

| Term | Greek | Description |
|------|-------|-------------|
| TEE | ΤΕΕ | Τεχνικό Επιμελητήριο Ελλάδος — Technical Chamber of Greece |
| NOK | ΝΟΚ | Νέος Οικοδομικός Κανονισμός — New Building Code |
| ΠΔ 696/74 | — | Presidential Decree 696/1974 (engineer fee calculation) |
| ΚΑΕΚ | — | Κωδικός Αριθμός Εθνικού Κτηματολογίου (Land Registry ID) |
| e-Άδειες | — | Electronic building permit system |
| ΑΦΜ | — | Tax ID number |
| ΑΜ/ΑΜΗ | — | TEE registration number |

### C. Decision Log

| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-03-28 | Row-level tenant_id over schema-per-tenant | Simpler migrations, Knex compatibility |
| 2026-03-28 | Kysely for type-safe queries | Catch tenant_id omissions at compile time |
| 2026-03-28 | Stripe over Paddle | Better API, Greece support, known to work |
| 2026-03-28 | Keep Fastify (not NestJS) | Already invested, team knows it, fast enough |
| 2026-03-28 | AGPL-3.0 license | Prevent proprietary forks, allow self-hosted |

---

## Changelog

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 2.0.0-draft | 2026-03-28 | Μητσάρας | Initial architecture spec |

---

*End of specification. Ready for review.*
