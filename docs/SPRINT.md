# OpenAdeia — Current Sprint

**Sprint:** 2026-03-29 (Sprint 3)  
**Goal:** API split + Demo seeder + UsageBar polish  
**Status:** ✅ COMPLETE — Deployed 2026-03-29 21:48

---

## Completed Tasks

| ID | Task | Builder | Status | Commit |
|----|------|---------|--------|--------|
| M02 | Split api/projects.js into domain files | `openadeia-api-split` | ✅ DONE | `e7bcdd0` |
| M03 | Demo data seeder with realistic Greek data | `openadeia-demo-seeder` | ✅ DONE | `f23c577` |
| M04 | UsageBar collapsed mode polish | `openadeia-usagebar-polish` | ✅ DONE | `7bd3e10` |

---

## Task Details

### M02: API Split

**Scope:**
- Split monolithic `frontend/src/api/projects.js` into domain-specific files
- Each domain gets its own file with related API calls

**Files:**
- `frontend/src/api/projects.js` (keep project-related only)
- `frontend/src/api/clients.js` (new)
- `frontend/src/api/auth.js` (new)
- `frontend/src/api/nok.js` (new)
- `frontend/src/api/portal.js` (new)
- `frontend/src/api/tee.js` (new)
- `frontend/src/api/index.js` (re-export all)

**Acceptance:**
- [ ] Each domain in separate file
- [ ] Clean re-exports from index.js
- [ ] Build succeeds
- [ ] No runtime errors

---

### M03: Demo Seeder

**Scope:**
- Improve demo data seeder with realistic Greek data
- More diverse sample projects, clients, documents

**Files:**
- `backend/src/services/demo-seeder.js` (enhance)

**Acceptance:**
- [ ] 3-5 sample clients with Greek names
- [ ] 2-3 sample projects with different types/stages
- [ ] Sample workflow logs
- [ ] Tests pass

---

### M04: UsageBar Polish

**Scope:**
- Improve collapsed mode styling
- Add tooltips
- Better mobile responsiveness

**Files:**
- `frontend/src/components/usage/UsageBar.jsx` (enhance)

**Acceptance:**
- [ ] Collapsed mode shows icon + progress ring
- [ ] Hover shows tooltip with details
- [ ] Mobile-friendly
- [ ] Build succeeds

---

## Completion Checklist

When all builders complete:
1. [ ] Orchestrator reviews commits
2. [ ] Spawn REVIEWER agent for code audit
3. [ ] If approved: commit, push, deploy
4. [ ] Update BACKLOG.md (move to DONE)
5. [ ] Plan next sprint
