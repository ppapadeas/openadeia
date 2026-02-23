import { create } from 'zustand';

// Load persisted auth from localStorage
function loadAuth() {
  try {
    const token = localStorage.getItem('token');
    const user = localStorage.getItem('user');
    return { token, user: user ? JSON.parse(user) : null };
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
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(user));
    set({ token, user, isAuthenticated: true });
  },

  updateUser: (user) => {
    localStorage.setItem('user', JSON.stringify(user));
    set({ user });
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
