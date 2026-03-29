import api from './index.js';

export const adminApi = {
  /** List all tenants with usage stats */
  listTenants: () => api.get('/api/admin/tenants'),

  /** Get single tenant details */
  getTenant: (id) => api.get(`/api/admin/tenants/${id}`),

  /** Update tenant plan/status/limits */
  updateTenant: (id, updates) => api.patch(`/api/admin/tenants/${id}`, updates),

  /** Platform metrics dashboard */
  getMetrics: () => api.get('/api/admin/metrics'),
};
