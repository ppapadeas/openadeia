import api from './index.js';

export const nokApi = {
  types: () => api.get('/api/nok/types'),
  rules: (type) => api.get(`/api/nok/rules/${type}`),
  checklist: (type) => api.get(`/api/nok/checklist/${type}`),
};
