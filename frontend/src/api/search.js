import api from './index.js';

export const searchApi = {
  search: (q) => api.get('/api/search', { params: { q } }),
};
