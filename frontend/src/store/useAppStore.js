import { create } from 'zustand';

const useAppStore = create((set) => ({
  // UI state
  sidebarCollapsed: false,
  toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),

  // Project filters
  filters: { stage: '', type: '', q: '' },
  setFilter: (key, val) => set((s) => ({ filters: { ...s.filters, [key]: val } })),
  clearFilters: () => set({ filters: { stage: '', type: '', q: '' } }),
}));

export default useAppStore;
