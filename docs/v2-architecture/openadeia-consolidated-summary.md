# OpenAdeia Code Review — Consolidated Summary
**Date:** 2026-03-28  
**Reviewers:** 4 parallel agents (Backend, Frontend, Database, SaaS)  
**Total LOC:** ~12K

---

## Executive Summary

OpenAdeia has **solid domain logic** (TEE integration, ΠΔ 696/74 fee calculator, NOK checker, Client Portal) but is **strictly single-tenant** with **zero feature flag infrastructure**. Converting to hosted SaaS requires ~14-18 developer-weeks across 6 phases.

**The fee calculator is a genuine competitive moat** — full ΠΔ 696/74 implementation with all κ/μ coefficients. This should be the flagship Pro tier differentiator.

---

## 🚨 Critical Issues (Fix First)

| # | Issue | Location | Impact |
|---|-------|----------|--------|
| 1 | **Zero multi-tenancy** — no `tenant_id` anywhere | All tables | Complete data isolation failure |
| 2 | **Pierros's data hardcoded** in migration 006 | `backend/migrations/006_client_portal.js` | Production hazard for SaaS |
| 3 | **No password reset flow** | `routes/auth.js` | Blocker for SaaS launch |
| 4 | **No feature flags** | Entire codebase | Can't disable TEE/Portal per tier |
| 5 | **Route-to-route import** | `tee.js` imports from `auth.js` | Layering violation |

---

## 🔧 Quick Wins (< 1 day each)

### Backend
1. Create `config/features.js` with `FEATURE_*` env vars
2. Add `/api/features` endpoint for frontend
3. Move `decryptTeePassword` to `utils/crypto.js`
4. Cache portal email transporter (stops DB hit per email)
5. Add enabled features to `/health` response

### Frontend
1. Add `React.lazy()` wrapping for routes
2. Delete dead `filters` state in Zustand
3. Set `staleTime: Infinity` on NOK rules + fee lambda
4. Add ErrorBoundary wrapper

### Database
1. Fix N+1 in XML route (`Promise.all` instead of 7 awaits)
2. Fix portal form upsert (use `onConflict().merge()`)

---

## 📊 Architecture Improvements (Medium Effort)

### Backend — Conditional Route Loading

```js
// app.js — only load routes if feature enabled
if (features.tee) {
  const { default: teeRoute } = await import('./routes/tee.js');
  await app.register(teeRoute, { prefix: '/api/tee' });
}
```
**Why:** TEE loads Playwright, Portal loads pdf-lib — don't load heavy deps if disabled.

### Frontend — Feature Flag Hook

```js
// src/utils/features.js
export function useFeature(featureKey) {
  const user = useAppStore((s) => s.user);
  return hasFeature(user?.plan || 'free', featureKey);
}

// Usage:
const canUseTEE = useFeature('tee:sync');
{canUseTEE ? <TeeSyncPanel /> : <UpgradeBanner feature="tee" />}
```

### Database — Multi-Tenancy Strategy

**Recommended: Row-level `tenant_id`** (not schema-per-tenant)

```sql
-- New table
CREATE TABLE tenants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug VARCHAR(63) UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,
  plan VARCHAR(20) DEFAULT 'free',
  stripe_customer_id VARCHAR(100),
  settings JSONB DEFAULT '{}'
);

-- Add to all existing tables
ALTER TABLE projects ADD COLUMN tenant_id UUID REFERENCES tenants(id);
ALTER TABLE users ADD COLUMN tenant_id UUID REFERENCES tenants(id);
-- ... etc for all 10 tenant-sensitive tables
```

---

## 💳 SaaS Tier Design

| Feature | Free | Pro (€49/mo) | Enterprise (€149/mo) |
|---------|------|--------------|----------------------|
| Projects | 5 | Unlimited | Unlimited |
| Storage | 500MB | 10GB | Unlimited |
| NOK Checker | ✅ | ✅ | ✅ |
| Fee Calculator (basic) | ✅ | ✅ | ✅ |
| Fee Calculator (official PDF) | ❌ | ✅ | ✅ |
| TEE e-Adeies sync | ❌ | ✅ | ✅ |
| Client Portal | ❌ | ❌ | ✅ |
| Team members | 1 | 3 | Unlimited |
| API access | ❌ | ❌ | ✅ |

---

## 📅 Implementation Roadmap

| Phase | Focus | Effort | Priority |
|-------|-------|--------|----------|
| 1 | Multi-tenancy foundation | 3 weeks | 🔴 Critical |
| 2 | Billing (Stripe) | 2 weeks | 🔴 Critical |
| 3 | Signup & onboarding | 2 weeks | 🔴 Critical |
| 4 | Usage metering | 1 week | 🟡 High |
| 5 | Audit & GDPR | 1.5 weeks | 🟡 High |
| 6 | Admin panel | 2 weeks | 🟠 Medium |
| **Total** | | **14-18 weeks** | |

---

## 📁 Generated Reports

- `memory/reviews/openadeia-backend-architecture.md` — Plugin system, DI, feature flags (16KB)
- `memory/reviews/openadeia-frontend-architecture.md` — Components, state, lazy loading
- `memory/reviews/openadeia-database-multitenancy.md` — Schema, RLS, N+1 fixes
- `memory/reviews/openadeia-saas-readiness.md` — Billing, tiers, config, GDPR (25KB)

---

## Recommended Next Steps

1. **Today:** Fix the 5 quick wins (< 4 hours total)
2. **This week:** Create `config/features.js` + conditional route loading
3. **Next sprint:** Migration 007 (tenants table + tenant_id columns)
4. **Decision needed:** Stripe vs Paddle for billing (Greece tax handling)

---

## Notes

- Keycloak is in docker-compose but unused — remove or integrate
- TEE Playwright scraping is fragile — needs monitoring for gov portal changes
- Meilisearch is set up but unclear if search routes actually use it
