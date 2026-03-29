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

// Re-exports for backward compatibility — consumers may import any API from this file
export { nokApi } from './nok.js';
export { clientsApi } from './clients.js';
export { searchApi } from './search.js';
export { authApi } from './auth.js';
export { portalApi } from './portal.js';
export { teeApi } from './tee.js';
