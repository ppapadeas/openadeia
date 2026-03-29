# OpenAdeia v2.0 — Integration Report

**Date:** 2026-03-29  
**Reviewer:** Integration Reviewer Agent  
**Working directory:** `/home/pierros/git/openadeia`

---

## Summary

| Area | Status | Notes |
|------|--------|-------|
| Database migrations | ✅ PASS | All 10 migrations current |
| Backend startup | ✅ PASS | Running on :4000 (already active) |
| Auth / JWT flow | ✅ PASS | JWT includes `tenant_id`, `is_superadmin` |
| Tenant isolation (projects) | ✅ PASS | All queries scoped by `tenant_id` |
| Admin endpoints | ⚠️ PARTIAL | Metrics/tenants work; uses synthetic `default` instead of real tenant table |
| Metering / usage | ✅ PASS | `/api/tenant/usage` returns plan limits correctly |
| Audit log | ✅ PASS | `audit_log` table populated; `/api/tenant/audit` works |
| Billing routes | ✅ PASS | Correctly disabled when STRIPE_SECRET_KEY unset |
| Frontend build | ✅ PASS | Vite build clean, 404 modules, 392 kB bundle |
| Test suite | ✅ PASS | 131/131 tests pass (6 test files) |

**Overall: 9/10 PASS, 1 PARTIAL**

---

## 1. Database Migrations

```
$ cd backend && npm run migrate
Already up to date
```

All 10 migrations applied (batch 1–5):

| # | File | Batch | Phase |
|---|------|-------|-------|
| 001 | `001_initial.js` | 1 | Core schema |
| 002 | `002_auth_and_types.js` | 1 | Auth |
| 003 | `003_tee_sync.js` | 1 | TEE |
| 004 | `004_tee_submission.js` | 1 | TEE submission |
| 005 | `005_fee_engine.js` | 1 | Fee engine |
| 006 | `006_client_portal.js` | 2 | Client portal |
| 007 | `007_superadmin.js` | 3 | Superadmin flag |
| 008 | `008_onboarding.js` | 4 | Multi-tenancy + onboarding |
| 009 | `009_audit_log.js` | 4 | Audit log table |
| 010 | `010_tenant_backfill.js` | 5 | Tenant backfill |

**Tables present:** `tenants`, `users`, `projects`, `clients`, `documents`, `audit_log`, `workflow_logs`, `fee_calculations`, `portal_*` (7 tables), plus `knex_migrations`.

> ⚠️ **Note:** Table is named `audit_log` (singular), not `audit_logs`. All service code uses the correct name.

---

## 2. Backend Startup

Backend was already running on `0.0.0.0:4000`. Test launch via `timeout 10 npm run dev` showed:
- Migrations check: `Migrations up to date` ✅
- `EADDRINUSE :4000` — expected, server already live ✅

Health check:
```
GET /health → {"status":"ok","ts":"2026-03-29T07:25:08.698Z"}
```

---

## 3. API Flow Tests

### 3a. Login → JWT with tenant_id

```
POST /api/auth/login
{"email":"pierros@papadeas.gr","password":"..."}
```

Response includes:
```json
{
  "token": "eyJ...",
  "user": {
    "id": "12a3cd62-...",
    "role": "admin",
    "tenant_id": "95ed486f-...",
    "is_superadmin": true
  },
  "tenant": {
    "id": "95ed486f-...",
    "slug": "forma-architecture",
    "name": "ΜΠΟΥΡΑΣ ΠΑΠΑΔΕΑΣ Ι.Κ.Ε.",
    "plan": "self_hosted",
    "status": "active"
  }
}
```

✅ JWT payload contains `tenant_id`, `plan`, and `is_superadmin`.

### 3b. Project Creation (tenant isolation)

```
POST /api/projects
{"title":"Test Integration Project","type":"new_building",...}
```

Response confirms `tenant_id` is automatically set from JWT:
```json
{
  "id": "98447395-...",
  "code": "PRJ-2026-005",
  "tenant_id": "95ed486f-bd3b-4b19-aadc-40e23c90c217"
}
```

All project queries in `routes/projects.js` are scoped with `WHERE tenant_id = ?`. ✅

### 3c. Admin Endpoints (superadmin)

| Endpoint | Status | Notes |
|----------|--------|-------|
| `GET /api/admin/tenants` | ✅ | Returns list (synthetic 'default' — see issue below) |
| `GET /api/admin/tenants/:id` | ✅ | Works for id='default' |
| `GET /api/admin/metrics` | ✅ | Full metrics: totals, 30d stats, breakdown by stage/type |
| `GET /api/admin/users` | ❌ 404 | Route not implemented (uses tenants list instead) |
| `GET /api/admin/audit-logs` | ❌ 404 | Endpoint not registered |

**Admin metrics sample:**
```json
{
  "total_tenants": 1,
  "active_tenants": 1,
  "total_users": 1,
  "superadmin_users": 1,
  "total_projects": 5,
  "new_projects_30d": 5
}
```

> ⚠️ **Issue:** `GET /api/admin/tenants` returns a synthetic `{id: "default"}` entry hardcoded in the route, instead of querying the real `tenants` table (which has `id: "95ed486f-..."`, `slug: "forma-architecture"`). This is a Phase 6 placeholder — the comment in the code says "tenants table not yet fully wired to admin route." Functionally harmless for self-hosted single-tenant, but the admin UI shows `Default Tenant` instead of `ΜΠΟΥΡΑΣ ΠΑΠΑΔΕΑΣ Ι.Κ.Ε.`

---

## 4. Frontend Build

```
$ cd frontend && npm run build
vite v5.4.21 building for production...
✓ 404 modules transformed.
dist/index.html                   0.90 kB │ gzip:  0.47 kB
dist/assets/index.css            26.64 kB │ gzip:  5.44 kB
dist/assets/index.js            392.26 kB │ gzip: 118.27 kB
✓ built in 2.65s
```

**Result: ✅ PASS — Zero errors, zero warnings.**

---

## 5. Cross-Phase Dependency Check

| Phase | Description | Status | Evidence |
|-------|-------------|--------|---------|
| Phase 1 — Tenants | `tenants` table, `tenant_id` on all entities | ✅ | Migration 008 + 010 backfill confirmed |
| Phase 2 — Billing | Stripe routes (SaaS only), depends on `tenants` | ✅ | Routes conditional on `STRIPE_SECRET_KEY`; `billing.js` queries `tenants` by id |
| Phase 3 — Onboarding | Creates tenant on registration | ✅ | `007_superadmin.js` + `008_onboarding.js` add `is_superadmin`, `tenant_id` to users |
| Phase 4 — Metering | Reads tenant limits, enforces project cap | ✅ | `usage.js` → `getLimitsForPlan()`, `checkProjectLimit()` called on project creation |
| Phase 5 — Audit | Logs all write ops with `tenant_id` | ✅ | `audit_log` table with 5 entries; `onResponse` hook active; `/api/tenant/audit` works |
| Phase 6 — Admin | Superadmin views, requires `is_superadmin` | ⚠️ | Superadmin check works; but admin tenants view uses synthetic data (see §3c) |

---

## 6. Test Suite

```
$ cd backend && npm test

 ✓ test/routes/tee.test.js           (35 tests)  698ms
 ✓ test/unit/xml-generator.test.js   (32 tests)   10ms
 ✓ src/services/fee-calculator.test.js (20 tests)   3ms
 ✓ test/unit/tee-client.test.js      (31 tests)    3ms
 ✓ test/routes/auth.test.js          ( 8 tests)  485ms
 ✓ test/unit/auth-crypto.test.js     ( 5 tests)    1ms

 Test Files: 6 passed (6)
      Tests: 131 passed (131)
   Duration: 2.84s
```

**Result: ✅ 131/131 PASS**

> **Coverage note:** No tests exist for billing, audit, tenant, or admin routes. These are untested at the unit/integration test level.

---

## Issues & Recommendations

### 🔴 Missing Tests for v2 Routes

New v2 routes (billing, audit, tenant, admin) have **zero test coverage**. Recommend adding:
- `test/routes/admin.test.js` — superadmin gate, tenant listing
- `test/routes/tenant.test.js` — usage, audit log, export, deletion
- `test/routes/billing.test.js` — subscription flow (mock Stripe)

### 🟡 Admin Tenants Route Stale (Phase 6 TODO)

`GET /api/admin/tenants` returns hardcoded `{id: "default", name: "Default Tenant"}` instead of querying the real `tenants` table. Should be updated to:
```js
const tenants = await db('tenants').select(...).orderBy('created_at', 'desc');
```

### 🟡 Missing Admin Routes

- `GET /api/admin/users` → 404 (not implemented)
- `GET /api/admin/audit-logs` → 404 (not implemented, but audit accessible via `/api/tenant/audit`)

### 🟢 Billing Correctly Gated

Billing routes only register when `SAAS_MODE=true` or `STRIPE_SECRET_KEY` is set — correct behavior for self-hosted installs.

### 🟢 Tenant Isolation Solid

All project, client, document, and audit queries include `WHERE tenant_id = ?` derived from the JWT. The `tenantHook` correctly resolves from JWT first, then `X-Tenant-Slug` header.

---

## Conclusion

OpenAdeia v2.0 integration is **functionally healthy**. All 10 migrations are applied, all 131 tests pass, the frontend builds clean, and the core multi-tenant data model is working correctly in production. The main gap is the Phase 6 admin route still using placeholder/synthetic tenant data and missing coverage for new v2 endpoints in the test suite.
