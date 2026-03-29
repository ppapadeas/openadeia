# OpenAdeia — SaaS Readiness Review
**Date:** 2026-03-28  
**Reviewer:** Μητσάρας (Mitsaras) subagent  
**Codebase:** `/home/pierros/git/openadeia`  
**Stack:** Fastify + Knex + PostgreSQL (PostGIS) + Redis + MinIO + React (Zustand) + BullMQ

---

## Executive Summary

OpenAdeia is a well-structured single-tenant app for Greek building permit management. The core domain logic (TEE integration, NOK rules, fee calculator, client portal) is solid and feature-complete for the Forma Architecture use case. Converting it to multi-tenant hosted SaaS requires **no rewrites** but **significant new infrastructure**: a tenant layer, billing integration, feature gates, and isolation guarantees. Estimated total effort: **~14–18 developer-weeks**.

---

## SaaS Readiness Checklist

### ✅ What Exists

| Area | Status | Notes |
|------|--------|-------|
| Auth (JWT, bcrypt) | ✅ Done | `backend/src/routes/auth.js` |
| Role system (`engineer`, `admin`, `viewer`) | ✅ Done | In `users.role` |
| Project CRUD with soft-delete | ✅ Done | `routes/projects.js` |
| TEE integration (Playwright sync/submit) | ✅ Done | `routes/tee.js`, `services/tee-client.js` |
| NOK checker (per permit type) | ✅ Done | `services/nok-rules.js` + config JSON |
| Fee calculator (ΠΔ 696/74 full implementation) | ✅ Done | `services/fee-calculator.js` + `fee_calculations` table |
| Client Portal (token-based, multilingual) | ✅ Done | `routes/portal.js`, migration 006 |
| Workflow engine (stage-based, rule-validated) | ✅ Done | `services/workflow-engine.js` |
| Document storage (MinIO) | ✅ Done | `config/minio.js` + `documents` table |
| Email queue (BullMQ + nodemailer) | ✅ Done | `jobs/email-sender.js` |
| Activity logs (workflow_logs, portal_activity_log) | ✅ Partial | Exists but not GDPR-complete |
| Sentry error monitoring | ✅ Done | `plugins/error-monitor.js` |
| Rate limiting | ✅ Done | `@fastify/rate-limit`, 200 req/min global |
| Docker Compose | ✅ Done | Full stack incl. Keycloak (unused), Meilisearch |
| CI/CD pipeline | ✅ Done | `.github/workflows/ci-cd.yml` |
| Health check endpoint | ✅ Done | `GET /health` |

### ❌ What's Missing (SaaS Critical)

| Area | Gap | Priority |
|------|-----|----------|
| **Multi-tenancy** | No `tenant_id` on any table; all data is global | 🔴 Critical |
| **Subscription/billing** | No Stripe/Paddle, no plan enforcement | 🔴 Critical |
| **Feature flags** | No gate enforcement anywhere in code | 🔴 Critical |
| **Tenant signup flow** | No self-registration for organizations | 🔴 Critical |
| **Per-tenant config** | `portal_settings` is global, not per-tenant | 🔴 Critical |
| **Usage metering** | No project/API/storage counters | 🟡 High |
| **Trial/expiry logic** | No trial period tracking | 🟡 High |
| **Data export (GDPR)** | No tenant data export endpoint | 🟡 High |
| **Tenant isolation audit** | No RLS or tenant-scoped queries | 🟡 High |
| **Onboarding wizard** | No guided first-run experience | 🟡 High |
| **Admin panel** | No super-admin view across tenants | 🟡 High |
| **Webhook handling** | No Stripe webhook receiver | 🟠 Medium |
| **Demo data seeding** | No per-tenant demo project/client | 🟠 Medium |
| **Audit log completeness** | `user_id` sometimes null; no IP/UA tracking | 🟠 Medium |
| **Password reset flow** | Auth routes have no reset/forgot | 🟠 Medium |
| **Email verification** | No verify-on-register | 🟠 Medium |
| **Subdomain routing** | No `tenant.openadeia.gr` routing | 🟠 Medium |

---

## Feature Tier Design

### Tier Definitions

```
FREE tier      — Self-hosted only / limited cloud trial
PRO tier       — Primary SaaS target (~€49/mo per firm)
ENTERPRISE     — Multi-engineer firms + client portal (~€149/mo)
```

| Feature | Free | Pro | Enterprise |
|---------|------|-----|------------|
| Projects | Up to 5 | Unlimited | Unlimited |
| Clients | Up to 10 | Unlimited | Unlimited |
| Document storage | 500MB | 10GB | Unlimited |
| NOK Checker | ✅ | ✅ | ✅ |
| Fee Calculator (basic) | ✅ | ✅ | ✅ |
| Fee Calculator (official/PDF) | ❌ | ✅ | ✅ |
| TEE e-Adeies integration | ❌ | ✅ | ✅ |
| TEE XML submit | ❌ | ✅ | ✅ |
| Client Portal | ❌ | ❌ | ✅ |
| Custom workflow stages | ❌ | ❌ | ✅ |
| Team members | 1 | 3 | Unlimited |
| Email tracking | ❌ | ✅ | ✅ |
| Meilisearch full-text | ❌ | ✅ | ✅ |
| API access | ❌ | ❌ | ✅ |
| Priority support | ❌ | ❌ | ✅ |
| Data export (GDPR) | ✅ | ✅ | ✅ |
| SLA | — | 99.5% | 99.9% |

### Feature Flag Implementation

**Backend: `src/services/features.js`** (new file)

```js
// Feature flag definitions per tier
const TIER_FEATURES = {
  free: new Set([
    'projects:basic',
    'clients:basic',
    'nok:checker',
    'fees:basic',
    'documents:upload',
    'data:export',
  ]),
  pro: new Set([
    // includes all free
    'projects:basic', 'clients:basic', 'nok:checker',
    'fees:basic', 'documents:upload', 'data:export',
    // pro extras
    'fees:official',      // fee_calculations.is_official = true
    'tee:sync',           // TEE Playwright sync
    'tee:submit',         // TEE XML submission
    'email:tracking',
    'search:fulltext',
    'projects:unlimited',
    'team:up_to_3',
  ]),
  enterprise: new Set([
    // includes all pro + extras
    'portal:client',      // routes/portal.js
    'workflow:custom',    // custom stage definitions
    'team:unlimited',
    'api:external',
    'storage:unlimited',
    'tee:sync', 'tee:submit',
    'fees:official',
    'email:tracking',
    'search:fulltext',
    'projects:unlimited',
    'clients:unlimited',
  ]),
};

export function hasFeature(tenantPlan, featureKey) {
  const features = TIER_FEATURES[tenantPlan] || TIER_FEATURES.free;
  return features.has(featureKey);
}

export function requireFeature(tenantPlan, featureKey) {
  if (!hasFeature(tenantPlan, featureKey)) {
    const err = new Error(`Feature '${featureKey}' not available on ${tenantPlan} plan`);
    err.statusCode = 402;  // Payment Required
    err.featureKey = featureKey;
    throw err;
  }
}
```

**Usage pattern in routes:**

```js
// routes/tee.js — gate TEE sync behind pro
fastify.post('/sync', auth, async (req, reply) => {
  const tenant = await getTenant(req.user.tenant_id);
  requireFeature(tenant.plan, 'tee:sync');
  // ... existing sync logic
});

// routes/portal.js — gate client portal behind enterprise  
fastify.post('/', auth, async (req, reply) => {
  const tenant = await getTenant(req.user.tenant_id);
  requireFeature(tenant.plan, 'portal:client');
  // ... existing portal logic
});
```

**Frontend: `src/utils/features.js`** (new file)

```js
// Store plan in auth token payload
// JWT payload: { id, email, role, tenant_id, plan }

export function useFeature(featureKey) {
  const user = useAppStore((s) => s.user);
  return hasFeature(user?.plan || 'free', featureKey);
}

// Usage in components:
// const canUseTEE = useFeature('tee:sync');
// {canUseTEE ? <TeeSyncPanel /> : <UpgradeBanner feature="tee" />}
```

---

## Multi-Tenancy Architecture

### Database Schema Changes

**New migration: `007_multitenancy.js`**

```js
// New table: tenants
knex.schema.createTable('tenants', (t) => {
  t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
  t.string('slug', 63).unique().notNullable(); // subdomain: firma.openadeia.gr
  t.string('name', 255).notNullable();
  t.string('plan', 20).notNullable().defaultTo('free'); // free | pro | enterprise
  t.string('stripe_customer_id', 100);
  t.string('stripe_subscription_id', 100);
  t.string('subscription_status', 20).defaultTo('trialing'); // trialing | active | past_due | canceled
  t.timestamp('trial_ends_at');
  t.timestamp('current_period_end');
  t.integer('projects_used').defaultTo(0);  // cached counter
  t.bigInteger('storage_used_bytes').defaultTo(0);  // cached counter
  t.string('billing_email', 255);
  t.jsonb('settings').defaultTo('{}');  // replaces portal_settings
  t.timestamp('created_at').defaultTo(knex.fn.now());
  t.timestamp('updated_at').defaultTo(knex.fn.now());
});

// Add tenant_id to all data tables
for (const table of ['users', 'projects', 'clients', 'documents', 'fee_calculations',
                      'portal_projects', 'portal_templates', 'emails']) {
  await knex.schema.alterTable(table, (t) => {
    t.uuid('tenant_id').references('id').inTable('tenants').onDelete('CASCADE');
  });
}

// Composite indexes for tenant-scoped queries
await knex.raw('CREATE INDEX idx_projects_tenant ON projects(tenant_id, deleted)');
await knex.raw('CREATE INDEX idx_users_tenant ON users(tenant_id)');
await knex.raw('CREATE INDEX idx_clients_tenant ON clients(tenant_id)');
```

### Query Isolation Strategy

All data queries must include `tenant_id`. Add a Fastify decorator:

```js
// src/plugins/tenant.js
fastify.addHook('onRequest', async (req, reply) => {
  if (req.user?.tenant_id) {
    req.tenantId = req.user.tenant_id;
  }
});

// Enforce: all db queries on tenant-scoped tables must use:
db('projects').where({ tenant_id: req.tenantId, deleted: false })
```

> **PostgreSQL RLS** (Row Level Security) is the gold standard for full isolation but adds complexity. For initial SaaS launch, application-level tenant scoping (above) is sufficient and auditable. Add RLS in Phase 3.

---

## Billing Integration

### Stripe Integration Plan

**New file: `src/services/billing.js`**

```js
import Stripe from 'stripe';
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

export const STRIPE_PRICE_IDS = {
  pro_monthly: process.env.STRIPE_PRO_MONTHLY_PRICE_ID,
  pro_annual: process.env.STRIPE_PRO_ANNUAL_PRICE_ID,
  enterprise_monthly: process.env.STRIPE_ENT_MONTHLY_PRICE_ID,
  enterprise_annual: process.env.STRIPE_ENT_ANNUAL_PRICE_ID,
};

export async function createCheckoutSession(tenant, priceId, successUrl, cancelUrl) {
  return stripe.checkout.sessions.create({
    customer: tenant.stripe_customer_id || undefined,
    customer_email: tenant.billing_email,
    mode: 'subscription',
    line_items: [{ price: priceId, quantity: 1 }],
    metadata: { tenant_id: tenant.id },
    success_url: successUrl,
    cancel_url: cancelUrl,
    trial_period_days: 14,
    subscription_data: { metadata: { tenant_id: tenant.id } },
  });
}

export async function createPortalSession(tenant, returnUrl) {
  return stripe.billingPortal.sessions.create({
    customer: tenant.stripe_customer_id,
    return_url: returnUrl,
  });
}
```

### Webhook Handler: `src/routes/billing.js` (new)

```js
fastify.post('/api/billing/webhook', {
  config: { rawBody: true },  // need raw body for Stripe signature
}, async (req, reply) => {
  const sig = req.headers['stripe-signature'];
  let event;
  try {
    event = stripe.webhooks.constructEvent(req.rawBody, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    return reply.code(400).send({ error: err.message });
  }

  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object;
      const tenantId = session.metadata.tenant_id;
      await db('tenants').where({ id: tenantId }).update({
        stripe_customer_id: session.customer,
        stripe_subscription_id: session.subscription,
        subscription_status: 'active',
      });
      break;
    }
    case 'customer.subscription.updated': {
      const sub = event.data.object;
      const tenant = await db('tenants').where({ stripe_subscription_id: sub.id }).first();
      if (tenant) {
        const plan = getPlanFromPriceId(sub.items.data[0].price.id);
        await db('tenants').where({ id: tenant.id }).update({
          plan,
          subscription_status: sub.status,
          current_period_end: new Date(sub.current_period_end * 1000),
        });
      }
      break;
    }
    case 'customer.subscription.deleted': {
      const sub = event.data.object;
      const tenant = await db('tenants').where({ stripe_subscription_id: sub.id }).first();
      if (tenant) {
        await db('tenants').where({ id: tenant.id }).update({
          plan: 'free',
          subscription_status: 'canceled',
        });
      }
      break;
    }
    case 'invoice.payment_failed': {
      // Send dunning email, update status
      break;
    }
  }

  reply.send({ received: true });
});
```

### Usage Metering

Track in the `tenants` table (cached counters, updated on each write):

```js
// After inserting a project:
await db('tenants').where({ id: tenantId }).increment('projects_used', 1);

// After uploading a document:
await db('tenants').where({ id: tenantId }).increment('storage_used_bytes', fileSize);

// Check limits before insert:
async function checkProjectLimit(tenantId) {
  const tenant = await db('tenants').where({ id: tenantId }).first();
  if (tenant.plan === 'free' && tenant.projects_used >= 5) {
    throw Object.assign(new Error('Project limit reached on free plan'), {
      statusCode: 402, limitType: 'projects'
    });
  }
}
```

For accurate API call metering (enterprise tier), use a `usage_events` table and aggregate daily with a cron job.

---

## Configuration Management

### Current State

- All configuration via `.env` / Docker Compose environment variables
- `portal_settings` table stores **engineer-specific** defaults (hardcoded to Pierros's details!)
- No per-tenant configuration storage

### Proposed: `tenants.settings` JSONB

Replace `portal_settings` table with a JSONB column on `tenants`:

```json
{
  "engineer_name": "...",
  "engineer_am": "...",
  "company_name": "...",
  "company_afm": "...",
  "portal_base_url": "...",
  "email_from": "...",
  "email_signature": "...",
  "default_language": "el",
  "nok_custom_rules": {},
  "workflow_custom_stages": {}
}
```

### Environment Variables Needed for SaaS

```env
# Existing (keep)
DATABASE_URL=...
REDIS_URL=...
MINIO_ENDPOINT=...
JWT_SECRET=...
SMTP_*=...

# New for SaaS
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRO_MONTHLY_PRICE_ID=price_...
STRIPE_PRO_ANNUAL_PRICE_ID=price_...
STRIPE_ENT_MONTHLY_PRICE_ID=price_...
STRIPE_ENT_ANNUAL_PRICE_ID=price_...

APP_BASE_URL=https://openadeia.gr
SAAS_MODE=true  # enables multi-tenancy middleware

# Optional: feature flag overrides (JSON)
FEATURE_OVERRIDES='{"tenant_id_xyz": ["portal:client"]}'
```

### Feature Flag Service Design

For a clean service abstraction:

```js
// src/services/feature-flags.js
// Priority: DB override → plan features → defaults

export class FeatureFlagService {
  constructor(db) { this.db = db; }
  
  async getFlags(tenantId) {
    const tenant = await this.db('tenants').where({ id: tenantId }).first();
    const planFlags = TIER_FEATURES[tenant.plan] || TIER_FEATURES.free;
    const overrides = tenant.settings?.feature_overrides || {};
    return { planFlags, overrides, plan: tenant.plan };
  }
  
  async check(tenantId, featureKey) {
    const { planFlags, overrides } = await this.getFlags(tenantId);
    if (overrides[featureKey] === false) return false;  // explicit deny
    if (overrides[featureKey] === true) return true;    // explicit grant
    return planFlags.has(featureKey);
  }
}
```

Cache this with Redis (TTL 5 minutes) to avoid DB hit on every request.

---

## Onboarding Flow

### Tenant Signup: `POST /api/auth/signup-org` (new)

```
1. User provides: email, name, org name, password
2. Create tenant (slug = org-name-slug, plan='free', trial_ends_at = now+14d)
3. Create user (role='admin', tenant_id)
4. Send verification email
5. Return JWT with tenant_id + plan
6. Redirect to /setup wizard
```

### Setup Wizard (4 steps, frontend)

```
Step 1: Firm Profile
  - Engineer name, AMH, specialty
  - Company name, AFM, address, phone

Step 2: Portal Branding (skippable)
  - Upload logo
  - Set portal URL slug
  - Company email signature

Step 3: Import from TEE (skippable)
  - TEE credentials
  - One-click sync → select projects to import

Step 4: Done
  - Show plan limitations + upgrade CTA
  - Link to demo project
  - Link to docs
```

### Demo Data Seeding

```js
// src/seeds/demo.js — per-tenant demo seed
export async function seedDemoTenant(tenantId) {
  const demoClient = await db('clients').insert({
    tenant_id: tenantId,
    surname: 'Παπαδόπουλος',
    name: 'Γεώργιος',
    owner_type: 1,
    email: 'demo@example.com',
    phone: '2101234567',
  }).returning('id');

  const [demoProject] = await db('projects').insert({
    tenant_id: tenantId,
    code: 'DEMO-001',
    title: 'Νέα Οικοδομική Άδεια — Demo',
    type: 'new_building',
    stage: 'data_collection',
    client_id: demoClient[0].id,
    notes: 'Αυτό είναι ένα demo project για να εξοικειωθείτε με την εφαρμογή.',
  }).returning('*');

  // Add demo workflow log
  await db('workflow_logs').insert({
    tenant_id: tenantId,
    project_id: demoProject.id,
    action: 'Δημιουργία demo φακέλου',
    to_stage: 'data_collection',
  });
}
```

---

## Audit & Compliance (GDPR)

### Current Logging Assessment

**`workflow_logs`** — ✅ Good: captures stage transitions with `user_id` and `metadata`  
**`portal_activity_log`** — ✅ Good: actor (client/admin/system) + action  
**`emails`** table — ✅ Tracks sent/received emails per project  

**Gaps:**
- No IP address or User-Agent capture
- Login events not logged
- Document downloads not logged
- `user_id` is nullable and sometimes NULL (portal client actions)
- No centralized audit log table (split across 2 tables)

### Proposed: Unified Audit Log (`008_audit_log.js`)

```js
knex.schema.createTable('audit_log', (t) => {
  t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
  t.uuid('tenant_id').references('id').inTable('tenants').onDelete('CASCADE');
  t.uuid('user_id').references('id').inTable('users').onDelete('SET NULL');
  t.string('actor_type', 20).notNullable(); // user | portal_client | system | api
  t.string('actor_id', 100);  // user.id or portal token or 'system'
  t.string('action', 100).notNullable(); // login | project.create | document.download etc
  t.string('resource_type', 50);  // project | document | client | portal_step
  t.uuid('resource_id');
  t.jsonb('metadata');  // before/after for updates, file info for downloads
  t.string('ip_address', 45);
  t.text('user_agent');
  t.timestamp('created_at').defaultTo(knex.fn.now());
});
// Partition by month in production for performance
// CREATE INDEX idx_audit_tenant_created ON audit_log(tenant_id, created_at DESC);
```

### GDPR Data Export: `GET /api/tenant/export` (new)

```js
fastify.get('/api/tenant/export', auth, async (req, reply) => {
  requireRole(req.user, 'admin');
  const tenantId = req.user.tenant_id;
  
  const [projects, clients, documents, users, auditLog] = await Promise.all([
    db('projects').where({ tenant_id: tenantId, deleted: false }),
    db('clients').where({ tenant_id: tenantId }),
    db('documents').where({ tenant_id: tenantId }),
    db('users').where({ tenant_id: tenantId }).select('id', 'email', 'name', 'role', 'created_at'),
    db('audit_log').where({ tenant_id: tenantId }).orderBy('created_at', 'desc').limit(10000),
  ]);

  reply
    .header('Content-Disposition', `attachment; filename="openadeia-export-${Date.now()}.json"`)
    .header('Content-Type', 'application/json')
    .send(JSON.stringify({ exported_at: new Date(), projects, clients, documents, users, auditLog }, null, 2));
});
```

Also: add `DELETE /api/tenant` for GDPR right-to-erasure (cascades via DB foreign keys if `onDelete('CASCADE')` is set).

### Tenant Data Isolation Verification

Current risk: queries like `db('projects').where({ id: req.params.id })` without `tenant_id` check — a crafted UUID could expose another tenant's data.

**Fix pattern (add to all routes):**
```js
// Before: 
const project = await db('projects').where({ id: req.params.id }).first();

// After:
const project = await db('projects').where({ id: req.params.id, tenant_id: req.tenantId }).first();
// Missing tenant_id → returns null → 404 (no data leak)
```

Use a helper:
```js
export function scopedQuery(tableName, tenantId) {
  return db(tableName).where({ tenant_id: tenantId });
}
// scopedQuery('projects', req.tenantId).where({ id: req.params.id }).first()
```

---

## Implementation Roadmap

### Phase 1 — Multi-Tenancy Foundation (3–4 weeks)
**Goal: Data isolation + tenant model**

1. `007_multitenancy.js` migration — add `tenants` table + `tenant_id` to all tables
2. One-time data migration: create a "default tenant" for existing Forma Architecture data
3. Update JWT payload to include `tenant_id` + `plan`
4. Add `req.tenantId` Fastify decorator/hook
5. Audit and update all route queries to include `tenant_id` scope
6. Replace `portal_settings` with `tenants.settings` JSONB
7. Update `portal_settings` reads throughout codebase
8. Tests: add tenant isolation test suite

**Effort:** ~3 weeks  
**Risk:** Query audit is tedious but mechanical. Main risk: missing a query path.

---

### Phase 2 — Billing & Subscription (2–3 weeks)
**Goal: Stripe integration + plan enforcement**

1. Add Stripe dependency + `src/services/billing.js`
2. `POST /api/billing/checkout` — create Stripe checkout session
3. `POST /api/billing/portal` — Stripe billing portal link
4. `POST /api/billing/webhook` — handle subscription lifecycle events
5. Add plan column to `tenants` + update on webhook
6. Implement `src/services/features.js` flag service
7. Add feature gates to all Pro/Enterprise routes (TEE, portal, fees:official)
8. Frontend: upgrade banners when feature locked
9. Stripe webhook testing with Stripe CLI

**Effort:** ~2 weeks  
**Risk:** Stripe webhooks require HTTPS + public endpoint. Use ngrok for dev.

---

### Phase 3 — Tenant Signup & Onboarding (2 weeks)
**Goal: Self-service signup + wizard**

1. `POST /api/auth/signup-org` — org + admin user creation
2. Email verification flow (token-based, BullMQ)
3. Frontend: `/signup` page (org name, email, password)
4. Frontend: `/setup` wizard (4 steps)
5. Demo data seeding on signup
6. Forgot password flow
7. Subdomain routing (if applicable): Nginx config + `X-Tenant-Slug` header parsing

**Effort:** ~2 weeks

---

### Phase 4 — Usage Metering & Limits (1 week)
**Goal: Enforce plan limits**

1. Increment `projects_used` counter on project create/delete
2. Track `storage_used_bytes` on document upload
3. Enforce limits: free=5 projects, 500MB; pro=10GB; enterprise=unlimited
4. Dashboard usage indicator (storage bar, project count)
5. Over-limit email notifications

**Effort:** ~1 week

---

### Phase 5 — Audit Log & GDPR (1–2 weeks)
**Goal: Compliance baseline**

1. `008_audit_log.js` migration
2. Audit log middleware (auto-capture on write routes)
3. Capture: login/logout, project CRUD, document upload/download, portal access
4. `GET /api/tenant/export` — full data export
5. `DELETE /api/tenant` — tenant data erasure
6. Frontend: audit log view for admin role
7. Privacy policy + cookie consent (frontend)

**Effort:** ~1.5 weeks

---

### Phase 6 — Admin Panel (2 weeks)
**Goal: Super-admin visibility**

1. New role: `superadmin` (not per-tenant)
2. `GET /api/admin/tenants` — list all tenants, plans, usage
3. `PATCH /api/admin/tenants/:id` — manually adjust plan/limits
4. `GET /api/admin/metrics` — MRR, churn, active users
5. Simple frontend admin at `/admin` (separate from main app)

**Effort:** ~2 weeks

---

## Summary Table

| Phase | Focus | Effort | Priority |
|-------|-------|--------|----------|
| 1 | Multi-tenancy foundation | 3 weeks | 🔴 Must |
| 2 | Billing & Stripe | 2 weeks | 🔴 Must |
| 3 | Signup & onboarding | 2 weeks | 🔴 Must |
| 4 | Usage metering | 1 week | 🟡 High |
| 5 | Audit & GDPR | 1.5 weeks | 🟡 High |
| 6 | Admin panel | 2 weeks | 🟠 Medium |
| **Total** | | **~14–18 weeks** | |

---

## Quick Wins (Do First, <1 day each)

1. **Password reset flow** — add `forgot_password` tokens table + email flow (currently completely missing)
2. **Email verification** — add `email_verified_at` to users, send verify link on register
3. **Remove hardcoded Pierros data** from `migration 006` default settings — parameterize via env
4. **Add `tenant_id` to JWT payload** — prep work, even before migration
5. **Rate limit per-user** — current rate limit is global (200 req/min), add per-user limit for authenticated routes

---

## Key Observations

1. **The app is well-architected** — clean separation of routes/services/migrations, good use of Fastify plugins. Multi-tenancy can be layered in cleanly.

2. **Keycloak is in docker-compose but unused** — auth is custom JWT. Either remove Keycloak or integrate it as the identity provider. Keeping it around adds confusion.

3. **`portal_settings` has Pierros's personal data hardcoded** in the migration seed — this must move to per-tenant config before any SaaS deployment.

4. **Meilisearch is set up but it's unclear if search routes use it** — `routes/search.js` exists, verify it's actually wired to Meilisearch and add tenant scoping to search indices.

5. **The fee calculator is a genuine competitive moat** — the full ΠΔ 696/74 implementation with all coefficient tables is non-trivial. This should be the flagship Pro feature differentiator.

6. **TEE integration via Playwright is fragile** — it scrapes a government portal. This is the highest-risk feature for SaaS: TEE portal changes can break it silently. Need monitoring/alerting on TEE sync failures by tenant.

7. **No password reset** — this is a blocker for any SaaS launch. Users who forget their password have no recovery path.
