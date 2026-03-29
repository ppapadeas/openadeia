# OpenAdeia Frontend — Architecture Review
**Date:** 2026-03-28  
**Stack:** React 18 + Vite + Zustand + TanStack Query v5  
**Reviewer:** Mitsaras (subagent)

---

## Table of Contents
1. [Current State Analysis](#1-current-state-analysis)
2. [Feature Flags in UI](#2-feature-flags-in-ui)
3. [Component Modularity](#3-component-modularity)
4. [State Management](#4-state-management)
5. [API Layer](#5-api-layer)
6. [Code Splitting](#6-code-splitting)
7. [Priority Ranking](#7-priority-ranking)

---

## 1. Current State Analysis

### Overall Assessment
The codebase is **clean and well-organized** for a solo/small-team project. Naming is consistent, the API layer is properly abstracted, and TanStack Query is used correctly for server state. The main gaps are all about **SaaS scalability** — no feature flags, no lazy loading, no code splitting, and some components are doing too much.

### What's Working Well
- **API layer is clean:** `api/index.js` (axios instance + interceptors) + `api/projects.js` (domain APIs) + `api/fees.js` — good separation
- **TanStack Query usage is correct:** queries have proper keys, mutations invalidate the right caches, conditional fetching (`enabled: tab === 'timeline'`) is already in use
- **Zustand store is minimal and appropriate** — auth + UI state only, no server data polluting it
- **`ClientPortal.jsx` is properly isolated** as a public page with its own route, no auth required

### Key Issues for SaaS

| Issue | Location | Severity |
|-------|----------|----------|
| No feature flag system | App-wide | 🔴 High |
| `ProjectDetail.jsx` is a 350+ line god component | `components/projects/ProjectDetail.jsx` | 🟡 Medium |
| All routes eagerly imported — no code splitting | `App.jsx` | 🟡 Medium |
| `clientsApi`, `nokApi`, `portalApi`, `teeApi`, `searchApi`, `authApi` all in `projects.js` | `api/projects.js` | 🟡 Medium |
| Sidebar NAV is a hardcoded array — no feature awareness | `components/layout/Sidebar.jsx` | 🔴 High |
| Filter state duplicated between Dashboard local state and Zustand `filters` | `Dashboard.jsx` + `useAppStore.js` | 🟢 Low |
| No error boundaries | App-wide | 🟡 Medium |
| `user.role`/`user.features` not used anywhere yet | `useAppStore.js` | 🔴 High (future) |

---

## 2. Feature Flags in UI

### Current State
Zero feature flag infrastructure. The NOK tab is always visible in the sidebar (`NAV` array in `Sidebar.jsx`) and in `App.jsx` routing. The Portal, Fees, and TEE Sync features are always rendered inside `ProjectDetail.jsx` with no gating.

### Proposed: Feature Flag System

**Step 1 — Server-side flags on the user object**

The backend should include a `features` array (or object) on the JWT payload / `/api/auth/me` response:

```json
{
  "id": 1,
  "name": "Pierros Papadeas",
  "amh": "163860",
  "features": ["nok", "tee_sync", "fees_calculator", "client_portal"],
  "plan": "pro"
}
```

**Step 2 — Feature flag hook**

```js
// src/hooks/useFeature.js
import useAppStore from '../store/useAppStore.js';

const DEFAULT_FEATURES = {
  nok: true,
  tee_sync: true,
  fees_calculator: true,
  client_portal: true,
};

export function useFeature(flag) {
  const user = useAppStore((s) => s.user);
  // If user has explicit features array, use it; otherwise default to all-on
  if (!user?.features) return DEFAULT_FEATURES[flag] ?? true;
  return user.features.includes(flag);
}
```

**Step 3 — Feature-aware Sidebar**

```js
// src/components/layout/Sidebar.jsx
import { useFeature } from '../../hooks/useFeature.js';

export default function Sidebar() {
  const hasNok = useFeature('nok');
  const hasTeeSync = useFeature('tee_sync');

  const NAV = [
    { to: '/projects', icon: '📁', label: 'Φάκελοι' },
    { to: '/clients',  icon: '👤', label: 'Πελάτες' },
    hasNok && { to: '/nok', icon: '📋', label: 'ΝΟΚ Κανόνες' },
  ].filter(Boolean);

  // ... rest of sidebar
}
```

**Step 4 — Feature-aware Routes**

```jsx
// src/App.jsx
function FeatureRoute({ flag, children }) {
  const enabled = useFeature(flag);
  if (!enabled) return <Navigate to="/projects" replace />;
  return children;
}

// In Routes:
<Route path="nok" element={
  <FeatureRoute flag="nok"><NokRulesViewer /></FeatureRoute>
} />
```

**Step 5 — Feature-aware Tabs in ProjectDetail**

```js
// src/components/projects/ProjectDetail.jsx
export default function ProjectDetail() {
  const hasNok = useFeature('nok');
  const hasFees = useFeature('fees_calculator');
  const hasPortal = useFeature('client_portal');

  const TABS = [
    { id: 'overview',  label: 'Επισκόπηση' },
    { id: 'documents', label: 'Έγγραφα' },
    { id: 'studies',   label: 'Μελέτες' },
    hasNok   && { id: 'checklist', label: 'Checklist' },
    { id: 'timeline',  label: 'Ιστορικό' },
    { id: 'email',     label: 'Email' },
    hasFees  && { id: 'fees',     label: 'Αμοιβές' },
    hasPortal && { id: 'portal',  label: 'Portal' },
  ].filter(Boolean);

  // ...
}
```

**Step 6 — Role-based guards for admin actions**

```js
// src/hooks/useRole.js
import useAppStore from '../store/useAppStore.js';

export function useRole() {
  const user = useAppStore((s) => s.user);
  return {
    isAdmin: user?.role === 'admin',
    isMember: ['admin', 'member'].includes(user?.role),
    role: user?.role,
  };
}
```

---

## 3. Component Modularity

### Current State

**`ProjectDetail.jsx` is doing too much:**
- Owns all tab state + all mutations (advance, delete, TEE submit)
- Embeds `OverviewTab`, `TimelineTab`, `EmailTab` as local functions
- Renders `Checklist`, `DocList`, `FeeCalculator`, `PortalTab` all eagerly imported

**`FeeCalculator.jsx` is well-isolated** — separate file, own state, own API calls. Good.

**`PortalTab.jsx` is well-isolated** — but has an embedded `RevisionDialog` (minor, fine).

**`ClientPortal.jsx` (public page)** has `FormStep`, `UploadStep`, `SignStep` as local functions. These are long enough to deserve their own files.

### Proposed Refactoring

**Split `ProjectDetail.jsx` into feature folders:**

```
src/features/
  projects/
    ProjectDetail.jsx         (orchestrator only — tabs + layout)
    tabs/
      OverviewTab.jsx
      TimelineTab.jsx
      EmailTab.jsx
    hooks/
      useProjectMutations.js  (advance, delete, tee submit mutations)
  clients/
    ClientList.jsx
    ClientDetail.jsx
    ClientForm.jsx
  nok/
    RulesViewer.jsx
    Checklist.jsx
  fees/
    FeeCalculator.jsx
  portal/
    PortalTab.jsx
    RevisionDialog.jsx
  tee/
    TeeSyncPanel.jsx
```

**Extract mutations from ProjectDetail into a custom hook:**

```js
// src/features/projects/hooks/useProjectMutations.js
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { projectsApi, teeApi } from '../../../api/projects.js';

export function useProjectMutations(id) {
  const qc = useQueryClient();
  const navigate = useNavigate();

  const advance = useMutation({
    mutationFn: () => projectsApi.advance(id),
    onSuccess: (r) => {
      qc.invalidateQueries({ queryKey: ['project', id] });
      qc.invalidateQueries({ queryKey: ['projects'] });
      toast.success(`Μετάβαση: ${r.fromStage} → ${r.toStage}`);
    },
    onError: (e) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: () => projectsApi.remove(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['projects'] });
      toast.success('Ο φάκελος διαγράφηκε.');
      navigate('/projects');
    },
    onError: (e) => toast.error(e.message),
  });

  const submitToTee = useMutation({
    mutationFn: () => teeApi.submit(id),
    onSuccess: (r) => {
      qc.invalidateQueries({ queryKey: ['project', id] });
      qc.invalidateQueries({ queryKey: ['projects'] });
      const code = r.data?.tee_permit_code;
      toast.success(code ? `Κωδικός ΤΕΕ: ${code}` : 'Υποβολή επιτυχής!');
    },
    onError: (e) => toast.error(e.response?.data?.error || e.message),
  });

  return { advance, remove, submitToTee };
}
```

**Split `ClientPortal.jsx` step sub-components into a `portal/client/` folder:**

```
src/pages/portal/
  ClientPortal.jsx
  steps/
    FormStep.jsx
    UploadStep.jsx
    SignStep.jsx
```

---

## 4. State Management

### Current State Analysis

**Zustand store — what's in it:**
- `token`, `user`, `isAuthenticated` — auth (correct: needs to survive re-renders, persisted to localStorage)
- `sidebarCollapsed`, `toggleSidebar` — UI state (correct: cross-component UI state)
- `filters` (stage, type, q) — project filters

**Issue: `filters` in Zustand vs local state in Dashboard**

`Dashboard.jsx` has its own local `stageFilter`, `typeFilter`, `search` state — and there's a parallel `filters` in Zustand that's **never read anywhere**. This is dead code or a design inconsistency.

**Fix options:**
- **Option A (simple):** Delete `filters` from Zustand; Dashboard's local state is fine since it doesn't need to persist across navigation.
- **Option B (URL state):** Use `useSearchParams()` for filters — better for bookmarking/sharing filtered views:

```js
// Dashboard.jsx — URL-based filters
import { useSearchParams } from 'react-router-dom';

export default function Dashboard() {
  const [params, setParams] = useSearchParams();
  const stageFilter = params.get('stage') || '';
  const typeFilter = params.get('type') || '';
  const search = params.get('q') || '';

  const setFilter = (key, val) => {
    const next = new URLSearchParams(params);
    val ? next.set(key, val) : next.delete(key);
    setParams(next, { replace: true });
  };
}
```

**What should NOT go in Zustand:**
- Server data (projects list, project details, clients) → TanStack Query ✅ already correct
- Per-component UI toggles (showForm, showSync, tab) → local state ✅ already correct
- Form data → local state ✅ already correct

**What should stay in Zustand:**
- Auth token + user → ✅ correct
- `sidebarCollapsed` → ✅ correct (shared across Shell + layout components)

**Recommended addition: `userFeatures` selector**

When feature flags land, add a derived selector to avoid repeated `.user?.features?.includes()` calls:

```js
// useAppStore.js addition
hasFeature: (flag) => {
  const user = get().user;
  if (!user?.features) return true; // all-on by default
  return user.features.includes(flag);
},
```

### TanStack Query: Minor Improvements

**1. Query key consistency** — use array objects (v5 style) for invalidation predictability:

```js
// Current (works but mixing styles):
queryKey: ['projects', stageFilter, typeFilter, search]

// Better (structured, easier to invalidate subtrees):
queryKey: ['projects', { stage: stageFilter, type: typeFilter, q: search }]
```

**2. `staleTime` tuning** — the global 30s is fine, but NOK rules / fee lambda never change → should be `Infinity`:

```js
// In RulesViewer.jsx and FeeCalculator.jsx:
const { data: rules } = useQuery({
  queryKey: ['nok-rules', selected],
  queryFn: () => nokApi.rules(selected),
  staleTime: Infinity, // NOK rules don't change
});

const { data: lambda } = useQuery({
  queryKey: ['fee-lambda-current'],
  queryFn: feesApi.lambdaCurrent,
  staleTime: 1000 * 60 * 60 * 24, // 24h — frozen value per ΦΕΚ
});
```

**3. Remove the polling loop in `teeApi.sync`** — the current implementation uses a `for` loop with `setTimeout` inside the API layer. This is an anti-pattern. Move the polling to a TanStack Query `refetchInterval`:

```js
// api/projects.js — just expose start + poll
export const teeApi = {
  startSync: () => api.post('/api/tee/sync'),
  pollJob: (jobId) => api.get(`/api/tee/sync/${jobId}`),
  // ...
};

// TeeSyncPanel.jsx — polling via TanStack Query
const [jobId, setJobId] = useState(null);

const startMutation = useMutation({
  mutationFn: teeApi.startSync,
  onSuccess: (data) => setJobId(data.jobId),
});

const { data: job } = useQuery({
  queryKey: ['tee-job', jobId],
  queryFn: () => teeApi.pollJob(jobId),
  enabled: !!jobId,
  refetchInterval: (data) => {
    if (!data) return 2000;
    if (['completed', 'failed'].includes(data.status)) return false;
    return 2000;
  },
});
```

---

## 5. API Layer

### Current State

**`api/index.js`** — solid. Axios instance, JWT injection via interceptor, 401 auto-logout. The only minor issue: direct `window.location.href` manipulation inside an interceptor couples the API layer to the browser environment (makes testing harder).

**`api/projects.js`** — well-structured domain APIs, but the filename is misleading. It contains:
- `projectsApi` (projects)
- `nokApi` (NOK rules)
- `clientsApi` (clients)
- `searchApi` (search)
- `authApi` (authentication)
- `portalApi` (client portal)
- `teeApi` (TEE integration)

**`api/fees.js`** — correctly split out already.

### Proposed: Split API files by domain

```
src/api/
  index.js          (axios instance + interceptors — unchanged)
  projects.js       (projectsApi only)
  clients.js        (clientsApi)
  nok.js            (nokApi)
  tee.js            (teeApi)
  portal.js         (portalApi)
  auth.js           (authApi)
  search.js         (searchApi)
  fees.js           (feesApi — already done ✅)
```

This makes tree-shaking more effective and makes it obvious which features import which API modules.

### Error Handling: Add a Standard Error Boundary

Currently there are no React error boundaries. If `ProjectDetail` crashes during render (bad data shape from API), the whole app whites out.

```jsx
// src/components/ui/ErrorBoundary.jsx
import { Component } from 'react';

export default class ErrorBoundary extends Component {
  state = { error: null };

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error('Boundary caught:', error, info);
    // Sentry.captureException(error) if Sentry is configured
  }

  render() {
    if (this.state.error) {
      return (
        <div className="p-7 text-center">
          <div className="text-4xl mb-3">⚠️</div>
          <div className="font-semibold mb-2">Κάτι πήγε στραβά</div>
          <div className="text-text-muted text-sm mb-4">{this.state.error.message}</div>
          <button className="btn-secondary" onClick={() => this.setState({ error: null })}>
            Δοκιμή ξανά
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
```

```jsx
// App.jsx — wrap each route in an ErrorBoundary
<Route path="projects/:id" element={
  <ErrorBoundary><ProjectDetail /></ErrorBoundary>
} />
```

### Minor: Decouple 401 redirect from API layer

```js
// api/index.js — emit event instead of hard redirect
api.interceptors.response.use(
  (r) => r.data,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.dispatchEvent(new CustomEvent('auth:expired'));
    }
    const msg = err.response?.data?.error || err.message || 'Unknown error';
    return Promise.reject(new Error(msg));
  }
);

// App.jsx or a hook — listen for the event
useEffect(() => {
  const handler = () => navigate('/login', { replace: true });
  window.addEventListener('auth:expired', handler);
  return () => window.removeEventListener('auth:expired', handler);
}, []);
```

---

## 6. Code Splitting

### Current State

`App.jsx` eagerly imports every route component. With the current codebase size this is fine, but `FeeCalculator.jsx` is ~400 lines with inline constants and `ClientPortal.jsx` is ~500+ lines. As SaaS features grow, initial bundle size will bloat.

### Proposed: Route-based Lazy Loading

```jsx
// src/App.jsx — lazy imports
import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';

// Always-needed (login, shell structure)
import LoginPage from './components/auth/LoginPage.jsx';
import Shell from './components/layout/Shell.jsx';

// Lazy-loaded routes
const Dashboard       = lazy(() => import('./components/projects/Dashboard.jsx'));
const ProjectDetail   = lazy(() => import('./components/projects/ProjectDetail.jsx'));
const ClientList      = lazy(() => import('./components/clients/ClientList.jsx'));
const ClientDetail    = lazy(() => import('./components/clients/ClientDetail.jsx'));
const NokRulesViewer  = lazy(() => import('./components/nok/RulesViewer.jsx'));
const ProfilePage     = lazy(() => import('./components/auth/ProfilePage.jsx'));
const ClientPortal    = lazy(() => import('./pages/ClientPortal.jsx'));

function PageLoader() {
  return (
    <div className="flex-1 flex items-center justify-center text-text-muted text-sm">
      Φόρτωση…
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Suspense fallback={<PageLoader />}>
        <Routes>
          <Route path="/portal/:token" element={<ClientPortal />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/" element={<RequireAuth><Shell /></RequireAuth>}>
            <Route index element={<Navigate to="/projects" replace />} />
            <Route path="projects" element={<Dashboard />} />
            <Route path="projects/:id" element={<ProjectDetail />} />
            <Route path="clients" element={<ClientList />} />
            <Route path="clients/:id" element={<ClientDetail />} />
            <Route path="nok" element={<NokRulesViewer />} />
            <Route path="profile" element={<ProfilePage />} />
          </Route>
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}
```

### Tab-level Lazy Loading (advanced, for later)

Heavy tab components like `FeeCalculator` and `PortalTab` can be lazy-loaded within `ProjectDetail`:

```jsx
// ProjectDetail.jsx
const FeeCalculator = lazy(() => import('../fees/FeeCalculator.jsx'));
const PortalTab     = lazy(() => import('../portal/PortalTab.jsx'));

// In render:
{tab === 'fees' && (
  <Suspense fallback={<div className="text-text-muted text-sm">Φόρτωση…</div>}>
    <FeeCalculator projectId={id} />
  </Suspense>
)}
```

---

## 7. Priority Ranking

| # | Task | Impact | Effort | Notes |
|---|------|--------|--------|-------|
| 1 | **Feature flag system** (hook + Sidebar + route guard + tab gating) | 🔴 Critical | S | Foundational for SaaS — everything else builds on this |
| 2 | **Route-based lazy loading** in `App.jsx` | 🟡 High | XS | 15 lines of code, immediate bundle improvement |
| 3 | **Split `api/projects.js`** into per-domain files | 🟡 High | S | Clean up the biggest debt in the API layer |
| 4 | **Extract mutations to `useProjectMutations` hook** | 🟡 High | S | Makes `ProjectDetail` maintainable |
| 5 | **Add `ErrorBoundary`** around route components | 🟡 High | XS | One component, wrap 2-3 routes |
| 6 | **Remove dead `filters` from Zustand** (or switch to URL params) | 🟢 Medium | XS | Eliminates confusing dead code |
| 7 | **Move `OverviewTab`, `TimelineTab`, `EmailTab`** to separate files | 🟢 Medium | S | Readability, not a bug |
| 8 | **Set `staleTime: Infinity`** for NOK rules + fee lambda queries | 🟢 Medium | XS | Prevents unnecessary refetches of static data |
| 9 | **Refactor TEE sync polling** out of API layer into TanStack Query `refetchInterval` | 🟢 Medium | M | Better UX (cancellable, React-aware) |
| 10 | **Decouple 401 redirect** from axios interceptor | 🟢 Low | XS | Testability improvement |
| 11 | **Tab-level lazy loading** for FeeCalculator + PortalTab | 🟢 Low | XS | Only matters once bundles are large |

### Immediate Quick Wins (< 1 hour each)
1. Route lazy loading in `App.jsx` — just `lazy()` wrapping existing imports
2. Delete unused `filters` from Zustand store
3. Set `staleTime: Infinity` on NOK rules and fee lambda queries
4. Add error boundary component and wrap 2-3 key routes

### Sprint 1 (SaaS readiness)
1. Feature flags: backend `features` array → `useFeature` hook → Sidebar + FeatureRoute + TABS array
2. API file split
3. `useProjectMutations` hook extraction

### Sprint 2 (polish)
1. URL-based filter state
2. TEE sync polling refactor
3. Tab component file extraction
