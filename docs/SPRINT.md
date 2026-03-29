# OpenAdeia — Current Sprint

**Sprint:** 2026-03-29 (Sprint 2)  
**Goal:** Email templates + Billing tests + Frontend refactor  
**Status:** ✅ COMPLETE — Deployed 2026-03-29 20:30

---

## Completed Tasks

| ID | Task | Builder | Status | Commit |
|----|------|---------|--------|--------|
| H01 | Email templates (welcome, reset, verify) | `openadeia-email-templates` | ✅ DONE | `8ce2ec8` |
| H03 | Integration tests for billing routes | `openadeia-billing-tests` | ✅ DONE | `8dfad0c` |
| M01 | Split ProjectDetail.jsx into tab components | `openadeia-refactor-tabs` | ✅ DONE | `742d8d5` |

---

## Task Details

### H01: Email Templates

**Scope:**
- Create HTML email templates for: welcome, password reset, email verification
- Greek text, responsive design, OpenAdeia branding
- Create email template service to render templates with variables

**Files:**
- `backend/src/templates/welcome.html` (new)
- `backend/src/templates/reset-password.html` (new)
- `backend/src/templates/verify-email.html` (new)
- `backend/src/services/email-templates.js` (new)

**Acceptance:**
- [ ] Templates render with dynamic variables (name, link, etc.)
- [ ] Responsive design (mobile-friendly)
- [ ] Greek text throughout
- [ ] Service exports render functions for each template

---

### H03: Billing Integration Tests

**Scope:**
- Add comprehensive tests for billing routes
- Test Stripe webhook handling
- Mock Stripe API calls

**Files:**
- `backend/test/routes/billing.test.js` (enhance existing)

**Acceptance:**
- [ ] Test checkout session creation
- [ ] Test portal session creation
- [ ] Test webhook event handling (checkout.completed, subscription.updated, etc.)
- [ ] All tests pass

---

### M01: Split ProjectDetail.jsx

**Scope:**
- Extract tab components from monolithic ProjectDetail
- Create separate files for each tab
- Improve maintainability

**Files:**
- `frontend/src/pages/ProjectDetail.jsx` (simplify)
- `frontend/src/components/projects/tabs/OverviewTab.jsx` (new)
- `frontend/src/components/projects/tabs/TimelineTab.jsx` (new)
- `frontend/src/components/projects/tabs/DocumentsTab.jsx` (new)
- `frontend/src/components/projects/tabs/EmailTab.jsx` (new)

**Acceptance:**
- [ ] Each tab is a separate component
- [ ] ProjectDetail orchestrates tabs only
- [ ] No functionality changes
- [ ] Build succeeds

---

## Completion Checklist

When all builders complete:
1. [ ] Orchestrator reviews commits
2. [ ] Spawn REVIEWER agent for code audit
3. [ ] If approved: commit, push, deploy
4. [ ] Update BACKLOG.md (move to DONE)
5. [ ] Plan next sprint
