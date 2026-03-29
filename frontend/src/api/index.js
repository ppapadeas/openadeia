import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '',
  headers: { 'Content-Type': 'application/json' },
});

// Attach JWT token to every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (r) => r.data,
  (err) => {
    // Auto-logout on 401
    if (err.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      if (!window.location.pathname.startsWith('/login')) {
        window.location.href = '/login';
      }
    }

    // 402 Payment Required — plan limit exceeded
    if (err.response?.status === 402) {
      const data = err.response?.data || {};
      const limitError = new Error(data.error || 'Έχετε φτάσει το όριο του πλάνου σας');
      limitError.isLimitExceeded = true;
      limitError.limitType = data.limitType;
      limitError.current = data.current;
      limitError.max = data.max;
      return Promise.reject(limitError);
    }

    const msg = err.response?.data?.error || err.message || 'Unknown error';
    return Promise.reject(new Error(msg));
  }
);

export default api;
