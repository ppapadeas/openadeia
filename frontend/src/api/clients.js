import api from './index.js';

export const clientsApi = {
  list: (params) => api.get('/api/clients', { params }),
  get: (id) => api.get(`/api/clients/${id}`),
  create: (data) => api.post('/api/clients', data),
  update: (id, data) => api.patch(`/api/clients/${id}`, data),
};
