import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '',
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.response.use(
  (r) => r.data,
  (err) => {
    const msg = err.response?.data?.error || err.message || 'Unknown error';
    return Promise.reject(new Error(msg));
  }
);

export default api;
