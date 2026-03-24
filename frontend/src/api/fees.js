import api from './index.js';

export const feesApi = {
  lambdaCurrent: () => api.get('/api/fees/lambda/current'),
  calculate: (body) => api.post('/api/fees/calculate', body),
  saveCalculation: (projectId, body) =>
    api.post(`/api/fees/projects/${projectId}/calculations`, body),
  listCalculations: (projectId) =>
    api.get(`/api/fees/projects/${projectId}/calculations`),
};
