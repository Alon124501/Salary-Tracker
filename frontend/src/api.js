import axios from 'axios';
import { clearCache } from './hooks/useFetch.js';

const api = axios.create({ baseURL: '/api' });

api.interceptors.request.use(config => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  r => r,
  async err => {
    if (err.response?.status === 401) {
      clearCache();
      localStorage.removeItem('token');
      localStorage.removeItem('username');
      window.location.href = '/login';
      return Promise.reject(err);
    }
    // Transient backend/DB hiccups (intermittent Supabase connection errors) succeed
    // on an immediate retry far more often than a user is willing to manually retry.
    const status = err.response?.status;
    if (status >= 500 && !err.config._retried) {
      err.config._retried = true;
      await new Promise(r => setTimeout(r, 400));
      return api(err.config);
    }
    return Promise.reject(err);
  }
);

export default api;
