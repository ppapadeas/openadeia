import api from './index.js';

export const projectsApi = {
  list: (params) => api.get('/api/projects', { params }),
  get: (id) => api.get(`/api/projects/${id}`),
  create: (data) => api.post('/api/projects', data),
  update: (id, data) => api.patch(`/api/projects/${id}`, data),
  remove: (id) => api.delete(`/api/projects/${id}`),
  // Workflow
  advance: (id) => api.post(`/api/projects/${id}/advance`),
  reject: (id, data) => api.post(`/api/projects/${id}/reject`, data),
  timeline: (id) => api.get(`/api/projects/${id}/timeline`),
  // Documents
  listDocs: (id) => api.get(`/api/projects/${id}/documents`),
  uploadDoc: (id, formData) => api.post(`/api/projects/${id}/documents`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }),
  updateDoc: (id, did, data) => api.patch(`/api/projects/${id}/documents/${did}`, data),
  deleteDoc: (id, did) => api.delete(`/api/projects/${id}/documents/${did}`),
  downloadDoc: (id, did) => api.get(`/api/projects/${id}/documents/${did}/download`),
  // Studies
  listStudies: (id) => api.get(`/api/projects/${id}/studies`),
  updateStudy: (id, sid, data) => api.patch(`/api/projects/${id}/studies/${sid}`, data),
  // Email
  listEmails: (id) => api.get(`/api/projects/${id}/emails`),
  sendEmail: (id, data) => api.post(`/api/projects/${id}/email`, data),
  // XML
  getXml: (id) => api.get(`/api/projects/${id}/xml`, { responseType: 'text' }),
};

export const nokApi = {
  types: () => api.get('/api/nok/types'),
  rules: (type) => api.get(`/api/nok/rules/${type}`),
  checklist: (type) => api.get(`/api/nok/checklist/${type}`),
};

export const clientsApi = {
  list: (params) => api.get('/api/clients', { params }),
  get: (id) => api.get(`/api/clients/${id}`),
  create: (data) => api.post('/api/clients', data),
  update: (id, data) => api.patch(`/api/clients/${id}`, data),
};

export const searchApi = {
  search: (q) => api.get('/api/search', { params: { q } }),
};

export const authApi = {
  register: (data) => api.post('/api/auth/register', data),
  login: (data) => api.post('/api/auth/login', data),
  me: () => api.get('/api/auth/me'),
  updateProfile: (data) => api.patch('/api/auth/profile', data),
};

export const teeApi = {
  status: () => api.get('/api/tee/status'),
  sync: () => api.post('/api/tee/sync'),
  import: (applications) => api.post('/api/tee/import', { applications }),
  refresh: (id) => api.post(`/api/tee/refresh/${id}`),
};
