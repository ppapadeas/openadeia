import { create } from 'zustand';
import { getFeaturesForPlan } from '../hooks/useFeature.js';

/**
 * Enrich a user object with a `features` array derived from their plan,
 * unless an explicit features array is already provided by the backend.
 */
function enrichUser(user) {
  if (!user) return null;
  if (Array.isArray(user.features)) return user; // backend already sent features
  return { ...user, features: getFeaturesForPlan(user.plan) };
}

// Load persisted auth from localStorage
function loadAuth() {
  try {
    const token = localStorage.getItem('token');
    const user = localStorage.getItem('user');
    const parsed = user ? JSON.parse(user) : null;
    return { token, user: enrichUser(parsed) };
  } catch {
    return { token: null, user: null };
  }
}

const { token: initialToken, user: initialUser } = loadAuth();

const useAppStore = create((set) => ({
  // ── Auth state ──────────────────────────────────────────────────
  token: initialToken,
  user: initialUser,
  isAuthenticated: !!initialToken,

  setAuth: (token, user) => {
    const enriched = enrichUser(user);
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(enriched));
    set({ token, user: enriched, isAuthenticated: true });
  },

  updateUser: (user) => {
    const enriched = enrichUser(user);
    localStorage.setItem('user', JSON.stringify(enriched));
    set({ user: enriched });
  },

  logout: () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    set({ token: null, user: null, isAuthenticated: false });
  },

  // ── UI state ─────────────────────────────────────────────────────
  sidebarCollapsed: false,
  toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),

  // ── Project filters ───────────────────────────────────────────────
  filters: { stage: '', type: '', q: '' },
  setFilter: (key, val) => set((s) => ({ filters: { ...s.filters, [key]: val } })),
  clearFilters: () => set({ filters: { stage: '', type: '', q: '' } }),
}));

export default useAppStore;
