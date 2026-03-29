# OpenAdeia v2.0 — UX Review

**Reviewer:** Automated UX/UI Subagent  
**Date:** 2026-03-29  
**Scope:** New components introduced in v2.0 — auth flow, usage metering, and admin panel  
**Method:** Static code analysis of JSX + routing audit (no backend was running)

---

## Component Existence Checklist ✅

| Component | Path | Status |
|-----------|------|--------|
| SignupPage | `frontend/src/components/auth/SignupPage.jsx` | ✅ Exists |
| ForgotPasswordPage | `frontend/src/components/auth/ForgotPasswordPage.jsx` | ✅ Exists |
| UsageBar | `frontend/src/components/usage/UsageBar.jsx` | ✅ Exists |
| AuditLog | `frontend/src/components/admin/AuditLog.jsx` | ✅ Exists |
| AdminDashboard | `frontend/src/pages/AdminDashboard.jsx` | ✅ Exists |

All routes are properly wired in `App.jsx`:  
- `/signup` → `SignupPage`  
- `/forgot-password` → `ForgotPasswordPage`  
- `/reset-password/:token` → `ResetPasswordPage`  
- `/admin` → `AdminDashboard` (behind `RequireSuperadmin` guard)

---

## Findings by Severity

### 🔴 Critical — Blocks User Flow

#### C1: `LoginPage` still has inline register mode — conflicts with `/signup`
**File:** `frontend/src/components/auth/LoginPage.jsx`

The old `LoginPage` contains a built-in `register` tab that calls `authApi.register()` (single-user endpoint), while the new `SignupPage` calls `/api/auth/signup-org` (org creation endpoint). Users who click "Εγγραφή" on the login page land on the *wrong* registration flow — no org is created, no trial is started.

**Suggested fix:**
```jsx
// In LoginPage.jsx — replace the register tab with a link to /signup
import { Link } from 'react-router-dom';
// Remove the mode toggle entirely. Add below the form:
<p className="text-center text-sm text-text-muted mt-4">
  Δεν έχετε λογαριασμό;{' '}
  <Link to="/signup" className="text-indigo-400 hover:underline">
    Δημιουργία Λογαριασμού
  </Link>
</p>
```
And add a "Ξεχάσατε κωδικό;" link pointing to `/forgot-password`.

---

#### C2: `AdminDashboard` uses `formatBytes` and `PlanBadge`/`StatusBadge` defined *after* use in JSX
**File:** `frontend/src/pages/AdminDashboard.jsx`

`formatBytes`, `PlanBadge`, and `StatusBadge` are defined at the bottom of the file but used inside `AdminDashboard`'s JSX. While JS hoisting means `function` declarations work, the `formatBytes` used in the Tenants table is a `function` declaration so it hoists fine — **however** `PlanBadge` and `StatusBadge` are also function declarations and technically safe, but violates readability conventions and is a maintenance risk. More critically, if any of these are ever refactored to `const` arrow functions, the build will silently fail at runtime only in production order.

**Suggested fix:** Move all helper components and `formatBytes` to the top of the file, before `AdminDashboard`.

---

### 🟠 Major — Confusing UX

#### M1: `SignupPage` — no "show password" toggle
**File:** `frontend/src/components/auth/SignupPage.jsx`

Both password fields are `type="password"` with no way to reveal what was typed. Users filling a 5-field registration form (org name, name, email, password ×2) cannot verify their password before submitting, leading to failed logins immediately after signup.

**Suggested fix:**
```jsx
const [showPassword, setShowPassword] = useState(false);
// Add toggle button inside the input wrapper:
<button type="button" onClick={() => setShowPassword(v => !v)} 
  className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-primary"
  aria-label={showPassword ? 'Απόκρυψη κωδικού' : 'Εμφάνιση κωδικού'}>
  {showPassword ? '🙈' : '👁'}
</button>
```

---

#### M2: `AuditLog` — entirely in English for a Greek-facing admin panel
**File:** `frontend/src/components/admin/AuditLog.jsx`

All UI labels are English: "Timestamp", "Actor", "Action", "Resource", "IP", "Filter by action…", "Filter by resource…", "Clear", "Previous", "Next", "No audit entries found", "Loading…", "Page X of Y · N entries", "GDPR Export". The rest of the app is Greek. This creates a jarring inconsistency even for a superadmin screen.

**Suggested fix:** Translate UI strings to Greek. The action codes themselves (e.g. `resource.created`) can remain in English as they are technical identifiers.

```jsx
// Examples:
"Timestamp" → "Χρονική Σήμανση"
"Actor" → "Χρήστης"
"Action" → "Ενέργεια"
"Resource" → "Αντικείμενο"
"Filter by action…" → "Φίλτρο ενέργειας…"
"Filter by resource…" → "Φίλτρο αντικειμένου…"
"Clear" → "Καθαρισμός"
"Previous" → "← Προηγούμενη"
"Next" → "Επόμενη →"
"No audit entries found" → "Δεν βρέθηκαν εγγραφές"
"Loading…" → "Φόρτωση…"
"Page {n} of {total}" → "Σελίδα {n} από {total}"
"GDPR Export" → "Εξαγωγή GDPR"
"total entries" → "εγγραφές συνολικά"
```

---

#### M3: `AdminDashboard` — header text is English in a Greek app
**File:** `frontend/src/pages/AdminDashboard.jsx`

The following strings are English with no Greek equivalent:
- `"Admin Panel"` / `"Platform superadmin dashboard"`
- `"Platform Overview"`, `"Tenants"`, `"Projects by Stage"`, `"Projects by Type"`, `"Recent Projects"`
- Tab labels: `"📊 Overview"`, `"🔍 Audit Log"`
- Table headers: `"Total Projects"`, `"Total Users"`, `"Total Documents"`, `"Active Tenants"`, `"Tenant"`, `"Plan"`, `"Status"`, `"Projects"`, `"Users"`, `"Storage"`, `"Code"`, `"Title"`, `"Type"`, `"Stage"`, `"Created"`
- `"Computed at …"`

**Suggested fix:** Same approach as AuditLog — translate UI labels while keeping enum values (stage codes, type codes) in their native form.

---

#### M4: `UsageBar` — silent failure on API error
**File:** `frontend/src/components/usage/UsageBar.jsx`

When the `/api/tenant/usage` call fails, the component returns `null` — the usage bar silently disappears from the sidebar. Users see nothing, not even a reduced/skeleton state. This is especially bad for the warning case (approaching storage limit): if the API fails, the warning is lost.

```jsx
// Current:
if (error || !usage) return null;
```

**Suggested fix:**
```jsx
// Show a subtle degraded state on error:
if (error) return (
  <div className="px-4 py-3 border-t border-border-subtle">
    <span className="text-[10px] text-text-muted">⚠️ Μη διαθέσιμα στοιχεία χρήσης</span>
  </div>
);
// Keep null for loading (no usage yet):
if (!usage) return null;
```

---

#### M5: `SignupPage` — no link to "Forgot Password" from `LoginPage`
**File:** `frontend/src/components/auth/LoginPage.jsx`

The ForgotPasswordPage exists and is routed, but there is no link to it from the LoginPage. Users who forget their password have no discoverable path to recovery without knowing the URL directly.

**Suggested fix:** Add below the submit button in LoginPage's login mode:
```jsx
{mode === 'login' && (
  <div className="text-right">
    <Link to="/forgot-password" className="text-xs text-text-muted hover:text-indigo-400">
      Ξεχάσατε τον κωδικό;
    </Link>
  </div>
)}
```

---

#### M6: `AuditLog` — row click to expand has no visual affordance
**File:** `frontend/src/components/admin/AuditLog.jsx`

Rows are clickable to expand metadata, and have `cursor-pointer` class, but there is no expand indicator (no chevron, no `▶` icon, no tooltip). First-time admins will not discover this feature.

**Suggested fix:** Add a disclosure icon in a dedicated column:
```jsx
<td className="px-2 py-2.5 text-text-muted text-xs w-6">
  {expandedId === entry.id ? '▾' : '▸'}
</td>
```

---

### 🟡 Minor — Polish Issues

#### m1: `SignupPage` — `<label>` elements missing `htmlFor`
**File:** `frontend/src/components/auth/SignupPage.jsx`

All `<label>` elements use the `label` CSS class but have no `htmlFor` attribute linking them to their input. This breaks screen-reader association and clicking a label won't focus the input.

**Suggested fix:**
```jsx
<label htmlFor="orgName" className="label">Επωνυμία Μελέτης / Εταιρεία *</label>
<input id="orgName" className="input" ... />
```
Apply to all 5 fields (orgName, name, email, password, confirmPassword).

Same issue exists in `ForgotPasswordPage` (email field) and `ResetPasswordPage` (both password fields).

---

#### m2: `ForgotPasswordPage` — no rate-limit / cooldown UI
**File:** `frontend/src/components/auth/ForgotPasswordPage.jsx`

After `setSent(true)` the form disappears and the user sees the success state. However, there is no cooldown message or disabled re-send option. If the user reopens the page (e.g. navigates back and forth), they can trigger multiple reset emails in rapid succession.

**Suggested fix:** Consider adding a "Δεν λάβατε email; [Αποστολή ξανά]" link after a 60-second delay, or at minimum prevent re-submission by disabling the button for 60s after success.

---

#### m3: `UsageBar` — `PLAN_LABELS` uses English for `free`, `pro`, `enterprise`
**File:** `frontend/src/components/usage/UsageBar.jsx`

The plan labels shown to end-users in the Greek sidebar are English brand names. While these are often kept as-is internationally, for a Greek-facing product it may be desirable to localize at least the `free` tier.

**Current:**
```js
const PLAN_LABELS = { free: 'Free', pro: 'Pro', enterprise: 'Enterprise', self_hosted: 'Self-Hosted' };
```

**Consideration:** At minimum `self_hosted` could be `'Ιδιωτική Εγκατάσταση'` for clarity to non-technical users.

---

#### m4: `AdminDashboard` loading spinner uses emoji only
**File:** `frontend/src/pages/AdminDashboard.jsx`

The loading state uses `⏳` emoji + "Loading admin panel…" text with no proper spinner animation. This looks unpolished next to the data-dense dashboard.

**Suggested fix:** Use a CSS spinner consistent with the rest of the app:
```jsx
<div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent-blue mx-auto mb-3" />
```

---

#### m5: `AuditLog` — `res.data.data` double-unwrap pattern is fragile
**File:** `frontend/src/components/admin/AuditLog.jsx`

```js
setEntries(res.data.data || []);
setMeta(res.data.meta || { ... });
```

The `api` client in `UsageBar` uses `res?.data ?? res` pattern (handles both wrapped/unwrapped). `AuditLog` assumes `res.data.data` (double-nested). If the API client is updated or the response shape changes, this will silently return empty entries. **This is likely a bug** — `api.get()` probably already unwraps one level of `.data`.

**Suggested fix:** Check what `api.get()` returns and use consistent unwrapping. If the client returns the raw axios response, use `res.data.data`. If it already unwraps, use `res.data` or `res.entries`.

---

#### m6: `AuditLog` — `<>` fragment inside `<tbody>` map
**File:** `frontend/src/components/admin/AuditLog.jsx`

```jsx
{!loading && entries.map((entry) => (
  <>
    <tr key={entry.id} ...>...</tr>
    {expandedId === entry.id && (
      <tr key={`${entry.id}-expand`}>...</tr>
    )}
  </>
))}
```

React fragments inside `<tbody>` can cause DOM warnings in some React versions and may break hydration. The `key` should be on the fragment, not on the `<tr>`.

**Suggested fix:**
```jsx
{!loading && entries.map((entry) => (
  <React.Fragment key={entry.id}>
    <tr className="..." onClick={() => toggleExpand(entry.id)}>...</tr>
    {expandedId === entry.id && <tr key={`${entry.id}-expand`}>...</tr>}
  </React.Fragment>
))}
```

---

#### m7: `SignupPage` — missing `autocomplete` attributes
**File:** `frontend/src/components/auth/SignupPage.jsx`

None of the inputs have `autoComplete` attributes. Browsers and password managers rely on these to pre-fill and offer to save credentials.

**Suggested fix:**
```jsx
<input autoComplete="organization" ... />  // orgName
<input autoComplete="name" ... />          // name
<input autoComplete="email" ... />         // email
<input autoComplete="new-password" ... />  // password
<input autoComplete="new-password" ... />  // confirmPassword
```

---

## Accessibility Summary

| Component | Issues |
|-----------|--------|
| SignupPage | Missing `htmlFor` on all labels, no `autoComplete`, password fields lack `aria-describedby` for hint text |
| ForgotPasswordPage | Missing `htmlFor` on email label |
| ResetPasswordPage | Missing `htmlFor` on both password labels |
| UsageBar | Collapsed view uses `title` attribute (OK for mouse, not screen readers); emoji-only content lacks `aria-label` |
| AuditLog | Filter inputs have no `aria-label`, expand affordance invisible to screen readers, no `scope` on `<th>` |
| AdminDashboard | Tab buttons missing `role="tab"` / `aria-selected`, no `role="tabpanel"` on content areas |

---

## Greek Text Verification

| Component | Assessment |
|-----------|-----------|
| SignupPage | ✅ Fully Greek. All user-visible text is correct Greek. |
| ForgotPasswordPage | ✅ Fully Greek. Success/error states in Greek. |
| ResetPasswordPage | ✅ Fully Greek. Error for missing token is in Greek. |
| UsageBar | ⚠️ Mixed — "Πλάνο", "Αποθηκευτικός χώρος", "Φάκελοι" are Greek, but plan names (Free/Pro/Enterprise) are English. Acceptable if intentional. |
| AuditLog | ❌ Entirely English UI — see M2 above. |
| AdminDashboard | ❌ Mostly English UI — see M3 above. |

---

## Priority Fix List

| Priority | ID | Issue | Effort |
|----------|-----|-------|--------|
| 🔴 P0 | C1 | LoginPage register tab bypasses org signup | Low (remove tab, add link to /signup) |
| 🔴 P0 | C2 | Helper components defined after use (maintenance risk) | Low (reorder code) |
| 🟠 P1 | M5 | No "Forgot Password" link from LoginPage | Low (one Link component) |
| 🟠 P1 | M2 | AuditLog entirely in English | Medium (translate strings) |
| 🟠 P1 | M3 | AdminDashboard mostly in English | Medium (translate strings) |
| 🟠 P1 | M1 | No show/hide password toggle on SignupPage | Medium (add toggle) |
| 🟠 P1 | M4 | UsageBar silently disappears on API error | Low (add degraded state) |
| 🟠 P1 | M6 | AuditLog expand rows have no affordance | Low (add chevron icon) |
| 🟡 P2 | m1 | Missing htmlFor on labels (all auth pages) | Low (add id+htmlFor pairs) |
| 🟡 P2 | m5 | AuditLog double-unwrap API response bug | Low (verify api client behavior) |
| 🟡 P2 | m6 | Fragment key in tbody map | Low (use React.Fragment) |
| 🟡 P3 | m2 | ForgotPassword no resend cooldown | Medium |
| 🟡 P3 | m7 | Missing autoComplete attributes | Low |
| 🟡 P3 | m4 | Emoji-only loading spinner | Low |

---

## Overall Assessment

The new v2.0 auth components (SignupPage, ForgotPasswordPage, ResetPasswordPage) are **well-structured and production-ready** with good Greek localization, proper loading states, toast feedback, and client-side validation. The main risk is the **dual registration path conflict** in LoginPage (C1).

The admin components (AuditLog, AdminDashboard) are **functionally solid** but shipped in English while the rest of the app is Greek — this is likely an oversight rather than a design decision. The AuditLog's expandable rows and color-coded badges are a good UX pattern, just needs the language pass.

UsageBar is a clean, well-designed component. The silent failure on error is the only notable gap.

**Recommended immediate actions before first user-facing deploy:**
1. Fix C1 (LoginPage dual registration path)
2. Fix M5 (add Forgot Password link to LoginPage)
3. Translate AuditLog and AdminDashboard to Greek (M2, M3)
4. Add htmlFor to all labels (m1) — quick wins for accessibility
