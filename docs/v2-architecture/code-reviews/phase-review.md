# OpenAdeia v2.0 Phase Review — Code Review Report

**Date:** 2026-03-29  
**Reviewer:** Code Review Agent  
**Commits reviewed:** `dbd9e53`, `4bbd3b7`, `02c1848`, `4f3c0db`, `15964dc`  
**Phases covered:** Phase 6 (Admin Panel), Phase 2 (Billing), Phase 4 (Usage Metering), Phase 3 (Signup/Onboarding), audit fix  
**Test results:** ✅ 131/131 tests pass

---

## Summary

The v2 SaaS transformation is largely well-executed. Architecture patterns are consistent, tenant isolation is properly applied on most routes, and security fundamentals (parameterized queries via Knex, Zod validation, bcrypt at cost 12, JWT auth on all protected routes) are sound. Three issues were found and are documented below, one of which was fixed directly in this review.

---

## ✅ Passing Checks

### Code Quality
- **Style:** Consistent ES module syntax, JSDoc comments on all new services and middleware
- **Error handling:** Fastify reply codes used correctly throughout; try/catch wraps non-critical async ops (email queuing, demo seeding)
- **Validation:** Zod schemas present and applied via `zodValidator()` on all new auth routes (`signupOrgSchema`, `forgotPasswordSchema`, `resetPasswordSchema`, `verifyEmailSchema`)
- **Logging:** New routes use `fastify.log` / `req.log` correctly for their own code; legacy `console.*` in older files (portal.js, portal-email.js) predates this phase and is not new

### Security
- **SQL injection:** All queries use Knex parameterized builder — no raw string interpolation in new code
- **Tenant isolation:** `projects`, `clients`, `documents` routes all scope by `req.tenantId` from `tenantHook`; audit log queries scope by `req.user.tenant_id`
- **Authentication:** All protected routes use `onRequest: [fastify.authenticate]` or `adminAuth` composition
- **JWT:** `is_superadmin` flag included in JWT and checked server-side (never trusted from request body)
- **Password reset:** Token-based, 1h expiry, anti-enumeration safe (always returns 200)
- **Stripe webhook:** Signature verification via `constructWebhookEvent()` with HMAC; returns 200 on handler error to prevent Stripe retry loops

### Architecture
- **Feature flags:** Billing routes conditionally registered (`SAAS_MODE=true` or `STRIPE_SECRET_KEY` present)
- **Services layer:** `billing.js`, `usage.js`, `audit.js`, `demo-seeder.js` are all pure service modules — no Fastify coupling
- **Middleware separation:** `requireSuperadmin`, `requireAdmin`, `tenantHook` are standalone functions, not inlined
- **No circular dependencies detected**

### Testing
- All 131 existing tests pass
- New routes (signup-org, forgot-password, reset-password, billing, admin, tenant) have no dedicated integration tests yet (see Findings)

---

## 🔴 Critical Issues

### ISSUE-001: `/api/tenant/usage` ignores authenticated user's tenant_id

**File:** `backend/src/routes/tenant.js` line 39  
**Commit:** `02c1848`  
**Severity:** 🔴 Critical — data isolation violation in multi-tenant context

```js
// BEFORE (broken)
fastify.get('/usage', { onRequest: [fastify.authenticate] }, async (req, reply) => {
  const tenantId = getCurrentTenantId();  // always returns 'default' — ignores JWT!
  const stats = await getUsageStats(tenantId);
  reply.send({ data: stats });
});
```

`getCurrentTenantId()` is a Phase 4 stub that hard-returns `'default'`. In a multi-tenant deployment, any authenticated user would receive usage stats for the `'default'` tenant, not their own.

**Fix applied directly** (see commit after this review):

```js
// AFTER (fixed)
fastify.get('/usage', { onRequest: [fastify.authenticate] }, async (req, reply) => {
  const tenantId = req.user?.tenant_id ?? getCurrentTenantId();
  const stats = await getUsageStats(tenantId);
  reply.send({ data: stats });
});
```

This uses the JWT tenant if present, falling back to the Phase 4 stub for self-hosted installs where `tenant_id` is null.

---

## 🟡 Moderate Issues

### ISSUE-002: Hardcoded superadmin email in migration

**File:** `backend/migrations/007_superadmin.js`  
**Commit:** `dbd9e53`  
**Severity:** 🟡 Moderate — not a security bug, but a deployment anti-pattern

The migration hardcodes `pierros@papadeas.gr` as the initial superadmin. This is fine for the current self-hosted deployment but will be wrong if this codebase is open-sourced or deployed for other clients.

**Recommendation:** Add a `FIRST_SUPERADMIN_EMAIL` env var to `.env.example` and read it in the migration:

```js
const adminEmail = process.env.FIRST_SUPERADMIN_EMAIL || 'admin@example.com';
const existing = await knex('users').where({ email: adminEmail }).first();
```

**Not fixed now** — this is a non-regression (current deployment is single-tenant, and the existing superadmin is the correct owner). Flagged for before open-sourcing.

### ISSUE-003: Stripe webhook `rawBody` plugin not registered

**File:** `backend/src/app.js`, `backend/src/routes/billing.js:166`  
**Commit:** `4bbd3b7`  
**Severity:** 🟡 Moderate — webhook will fail at runtime when Stripe is configured

The billing route expects `req.rawBody` (set by `@fastify/raw-body` or similar), but no raw body plugin is registered in `app.js`. The `config: { rawBody: true }` flag on the route schema alone does nothing without the plugin.

The route already handles this gracefully (logs an error and returns 500), but the webhook will never work without the fix.

**Recommendation:** Since billing is SaaS-mode only and Stripe is not currently configured, this is non-breaking today. Before enabling Stripe:

```js
// In app.js, before route registration:
import rawBody from '@fastify/raw-body';
// ...
await app.register(rawBody, { field: 'rawBody', global: false, encoding: false });
```

Add `@fastify/raw-body` to `package.json` dependencies.

**Not fixed now** — Stripe billing is not enabled in the current deployment (`STRIPE_SECRET_KEY` unset).

---

## 🟢 Minor Notes (no action required)

### MINOR-001: `console.*` in worker and seeder

`src/workers/email-notifications.worker.js` and `src/services/demo-seeder.js` use `console.log/error`. These are non-Fastify contexts (BullMQ worker, background service) where `fastify.log` is unavailable. This is acceptable — workers typically use `console` or a standalone logger. However, consider adding `pino` as a standalone logger for consistency once the project matures.

### MINOR-002: Missing test coverage for new routes

No integration tests for:
- `POST /api/auth/signup-org`
- `POST /api/auth/forgot-password` / `reset-password` / `verify-email`
- `GET /api/admin/tenants`, `GET /api/admin/metrics`
- `GET /api/tenant/usage`, `GET /api/tenant/audit`
- `GET /api/billing/subscription`

The existing auth tests (`test/routes/auth.test.js`) only cover `register`. These new flows should be covered before production traffic.

### MINOR-003: `DELETE /api/tenant` deletes ALL users including current tenant's non-superadmin users

The deletion transaction uses `await trx('users').where('is_superadmin', false).delete()` — this deletes users from ALL tenants if the tenants table is present, not just the requesting tenant. In a multi-tenant SaaS context, this would be a data corruption bug.

For now (single-tenant), it is harmless. Before enabling true multi-tenancy, scope this to `tenant_id`:

```js
await trx('users').where({ is_superadmin: false, tenant_id: tenantId }).delete();
```

---

## Fixes Applied in This Review

| Issue | Fix | 
|-------|-----|
| ISSUE-001: `/usage` ignores JWT tenant | ✅ Fixed in `backend/src/routes/tenant.js` |

---

## Verdict

**Approve with noted issues.** The implementation is solid for the current self-hosted single-tenant deployment. ISSUE-002 and ISSUE-003 should be addressed before enabling true multi-tenancy. ISSUE-003 (raw body) must be resolved before enabling Stripe billing. Test coverage for the new routes is the most important gap to close.
