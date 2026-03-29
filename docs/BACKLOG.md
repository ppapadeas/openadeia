# OpenAdeia — Development Backlog

**Last Updated:** 2026-03-29  
**Maintainer:** Mitsaras (Orchestrator Agent)

---

## Status Legend

- 🔴 **CRITICAL** — Blocks launch
- 🟡 **HIGH** — Important for SaaS readiness
- 🟢 **MEDIUM** — Nice to have, can defer
- ⚪ **LOW** — Polish/refactor

| Status | Meaning |
|--------|---------|
| `TODO` | Not started |
| `SPRINT` | In current sprint |
| `WIP` | Builder working on it |
| `REVIEW` | Awaiting review |
| `DONE` | Merged to main |

---

## Backlog

### 🔴 CRITICAL

| ID | Task | Est. | Status | Owner | Files |
|----|------|------|--------|-------|-------|
| C01 | Feature flag system (useFeature hook + FeatureRoute guard) | 4h | DONE | Sprint 1 | `frontend/src/hooks/useFeature.js`, `frontend/src/components/FeatureRoute.jsx`, `frontend/src/api/index.js` |
| C02 | Admin /api/admin/tenants query real DB (not hardcoded) | 2h | DONE | Sprint 1 | `backend/src/routes/admin.js` |
| C03 | Frontend lazy loading (React.lazy for routes) | 2h | DONE | Sprint 1 | `frontend/src/App.jsx` |

### 🟡 HIGH

| ID | Task | Est. | Status | Owner | Files |
|----|------|------|--------|-------|-------|
| H01 | Email templates (welcome, reset, verify) with Greek text | 3h | DONE | Sprint 2 | `backend/src/templates/*.html`, `backend/src/services/email-templates.js` |
| H02 | Subdomain routing (tenant.openadeia.gr) | 4h | TODO | - | `backend/src/hooks/tenant.js`, nginx config |
| H03 | Integration tests for billing routes | 2h | DONE | Sprint 2 | `backend/test/routes/billing.test.js` |
| H04 | Stripe webhook raw body handler verification | 1h | DONE | backend-v2 | `backend/src/app.js` |

### 🟢 MEDIUM

| ID | Task | Est. | Status | Owner | Files |
|----|------|------|--------|-------|-------|
| M01 | Split ProjectDetail.jsx into tab components | 3h | DONE | Sprint 2 | `frontend/src/pages/ProjectDetail.jsx`, `frontend/src/components/projects/tabs/*` |
| M02 | Split api/projects.js into domain files | 2h | DONE | Sprint 3 | `frontend/src/api/*.js` |
| M03 | Demo data seeder with realistic Greek data | 2h | DONE | Sprint 3 | `backend/src/services/demo-seeder.js` |
| M04 | UsageBar collapsed mode polish | 1h | DONE | Sprint 3 | `frontend/src/components/usage/UsageBar.jsx` |

### ⚪ LOW

| ID | Task | Est. | Status | Owner | Files |
|----|------|------|--------|-------|-------|
| L01 | Add Storybook for component documentation | 4h | TODO | - | `frontend/.storybook/*` |
| L02 | PWA manifest + service worker | 3h | TODO | - | `frontend/public/manifest.json` |
| L03 | Dark/light theme toggle | 2h | TODO | - | `frontend/src/store/theme.js` |

---

## Completed (Recent)

| ID | Task | Completed | Commit |
|----|------|-----------|--------|
| - | Phase 1: Multi-tenancy | 2026-03-29 | `dbd9e53` |
| - | Phase 2: Billing | 2026-03-29 | `4bbd3b7` |
| - | Phase 3: Onboarding | 2026-03-29 | `4f3c0db` |
| - | Phase 4: Metering | 2026-03-29 | `02c1848` |
| - | Phase 5: Audit/GDPR | 2026-03-29 | `15964dc` |
| - | Phase 6: Admin Panel | 2026-03-29 | `dbd9e53` |
| - | UX Review fixes | 2026-03-29 | `0ca0258` |
| - | Code review fixes | 2026-03-29 | `cab3479` |

---

## Notes

- **Conflict avoidance:** Tasks are scoped to specific files. Don't assign overlapping files to parallel builders.
- **Test requirement:** All builders must run `npm test` before committing.
- **Commit format:** `feat|fix|chore(scope): description [TASK-ID]`
