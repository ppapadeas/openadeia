# OpenAdeia — Current Sprint

**Sprint:** 2026-03-29 (Sprint 1)  
**Goal:** Frontend performance + Admin fixes + Feature flags  
**Status:** ✅ COMPLETE — Deployed 2026-03-29 20:12

---

## Completed Tasks

| ID | Task | Builder | Status | Commit |
|----|------|---------|--------|--------|
| C01 | Feature flag system (useFeature hook) | `openadeia-feature-flags` | ✅ DONE | `417f2d8` |
| C02 | Admin /api/admin/tenants real DB query | `openadeia-admin-fix` | ✅ DONE | `3aa2fc8` |
| C03 | Frontend lazy loading | `openadeia-lazy-routes` | ✅ DONE | `4160672` |

---

## Task Details

### C01: Feature Flag System

**Scope:**
- Create `useFeature(flag)` hook that checks user's feature array
- Create `<FeatureRoute>` guard component
- Update Sidebar to conditionally show NOK, Portal, TEE based on features
- User object must include `features: string[]` from backend

**Files:**
- `frontend/src/hooks/useFeature.js` (new)
- `frontend/src/components/guards/FeatureRoute.jsx` (new)
- `frontend/src/components/layout/Sidebar.jsx` (modify)
- `frontend/src/api/index.js` (extend user type)

**Acceptance:**
- [ ] `useFeature('tee')` returns true/false based on user.features
- [ ] Routes wrapped in FeatureRoute redirect if feature disabled
- [ ] Sidebar hides TEE/Portal/NOK when not in features array
- [ ] Tests pass

---

### C02: Admin Tenants Real Query

**Scope:**
- `/api/admin/tenants` currently returns hardcoded `{id: 'default'}` 
- Change to query actual `tenants` table with counts

**Files:**
- `backend/src/routes/admin.js` (modify)

**Acceptance:**
- [ ] GET /api/admin/tenants returns real tenant rows from DB
- [ ] Each tenant includes project_count, user_count, storage_used
- [ ] Tests pass (add/update test in admin.test.js)

---

### C03: Frontend Lazy Loading

**Scope:**
- Wrap route components in React.lazy()
- Add Suspense fallback
- Reduces initial bundle size

**Files:**
- `frontend/src/App.jsx` (modify)
- `frontend/src/components/common/PageLoader.jsx` (new, optional)

**Acceptance:**
- [ ] Dashboard, ProjectDetail, AdminDashboard are lazy-loaded
- [ ] Network tab shows separate chunks on navigation
- [ ] No flash of unstyled content
- [ ] Tests pass, build succeeds

---

## Completion Checklist

When all builders complete:
1. [ ] Orchestrator reviews commits
2. [ ] Spawn REVIEWER agent for code audit
3. [ ] If approved: commit, push, deploy
4. [ ] Update BACKLOG.md (move to DONE)
5. [ ] Plan next sprint
