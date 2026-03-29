import api from './index.js';

export const portalApi = {
  // Admin routes (authenticated)
  create: (data) => api.post('/api/portal', data),
  getByProject: (projectId) => api.get(`/api/portal/${projectId}`),
  update: (id, data) => api.patch(`/api/portal/${id}`, data),
  addStep: (portalId, data) => api.post(`/api/portal/${portalId}/steps`, data),
  updateStep: (stepId, data) => api.patch(`/api/portal/steps/${stepId}`, data),
  reviewStep: (stepId, data) => api.post(`/api/portal/steps/${stepId}/review`, data),
  // Public client routes (no auth)
  getPublic: (token) => api.get(`/api/portal/p/${token}`),
  submitForm: (token, stepId, data) => api.post(`/api/portal/p/${token}/steps/${stepId}/submit`, data),
  uploadFile: (token, stepId, formData) => api.post(`/api/portal/p/${token}/steps/${stepId}/upload`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }),
  signStep: (token, stepId, data) => api.post(`/api/portal/p/${token}/steps/${stepId}/sign`, data),
  getStepDocs: (token, stepId) => api.get(`/api/portal/p/${token}/steps/${stepId}/docs`),
  downloadDoc: (token, docId) => `/api/portal/p/${token}/docs/${docId}/download`,
  // Admin: generate PDF for a sign step
  generatePdf: (stepId, docType) => api.post(`/api/portal/steps/${stepId}/generate-pdf`, { doc_type: docType }),
};
