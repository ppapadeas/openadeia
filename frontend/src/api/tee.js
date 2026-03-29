import api from './index.js';

export const teeApi = {
  status: () => api.get('/api/tee/status'),
  // Kicks off async sync — returns { jobId, status: 'running' }.
  // Use sync() for the full flow.
  _startSync: () => api.post('/api/tee/sync'),
  _pollJob: (jobId) => api.get(`/api/tee/sync/${jobId}`),
  // Full sync: start job, poll until done, return final result or throw.
  sync: async () => {
    const { jobId } = await api.post('/api/tee/sync');
    const POLL_INTERVAL = 2000;
    const MAX_POLLS = 90; // 3 minutes max
    for (let i = 0; i < MAX_POLLS; i++) {
      await new Promise(r => setTimeout(r, POLL_INTERVAL));
      const job = await api.get(`/api/tee/sync/${jobId}`);
      if (job.status === 'completed') return job;
      if (job.status === 'failed') throw new Error(job.error || 'Σφάλμα συγχρονισμού');
      // still running — continue polling
    }
    throw new Error('Ο συγχρονισμός υπερέβη τον μέγιστο χρόνο αναμονής');
  },
  import: (applications) => api.post('/api/tee/import', { applications }),
  refresh: (id) => api.post(`/api/tee/refresh/${id}`),
  submit: (id) => api.post(`/api/tee/submit/${id}`),
};
