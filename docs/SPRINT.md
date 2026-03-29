# OpenAdeia — Current Sprint

**Sprint:** 2026-03-29 (Sprint 4)  
**Goal:** Subdomain routing + PWA + Theme toggle  
**Status:** ✅ COMPLETE — Deployed 2026-03-29 22:02

---

## Completed Tasks

| ID | Task | Builder | Status | Commit |
|----|------|---------|--------|--------|
| H02 | Subdomain routing (tenant.openadeia.gr) | `openadeia-subdomain` | ✅ DONE | `aba0c25` |
| L02 | PWA manifest + service worker | `openadeia-pwa` | ✅ DONE | `43795f9` |
| L03 | Dark/light theme toggle | `openadeia-theme` | ✅ DONE | `0d41edd` |

---

## Task Details

### H02: Subdomain Routing

**Scope:**
- Extract tenant slug from subdomain (tenant.openadeia.gr)
- Backend middleware to resolve tenant from subdomain
- Support for both subdomain and header-based tenant identification

**Files:**
- `backend/src/hooks/tenant.js` (enhance)
- `backend/src/middleware/subdomain.js` (new)

**Acceptance:**
- [ ] Request to forma.openadeia.gr resolves tenant "forma"
- [ ] Fallback to X-Tenant-Slug header for localhost dev
- [ ] Tests pass

---

### L02: PWA Manifest

**Scope:**
- Add web app manifest for installable PWA
- Basic service worker for offline caching
- App icons

**Files:**
- `frontend/public/manifest.json` (new)
- `frontend/public/sw.js` (new)
- `frontend/public/icons/` (new)
- `frontend/index.html` (add manifest link)

**Acceptance:**
- [ ] App installable on mobile/desktop
- [ ] Manifest includes name, icons, theme color
- [ ] Build succeeds

---

### L03: Theme Toggle

**Scope:**
- Add dark/light theme toggle
- Persist preference in localStorage
- System preference detection

**Files:**
- `frontend/src/store/useThemeStore.js` (new)
- `frontend/src/components/layout/ThemeToggle.jsx` (new)
- `frontend/src/components/layout/Header.jsx` (add toggle)
- `frontend/tailwind.config.js` (ensure dark mode class)

**Acceptance:**
- [ ] Toggle switches between dark/light
- [ ] Preference persists across sessions
- [ ] Respects system preference initially
- [ ] Build succeeds

---

## Completion Checklist

When all builders complete:
1. [ ] Orchestrator reviews commits
2. [ ] Spawn REVIEWER agent for code audit
3. [ ] If approved: commit, push, deploy
4. [ ] Update BACKLOG.md (move to DONE)
5. [ ] Plan next sprint
