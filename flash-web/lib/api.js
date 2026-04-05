import axios from 'axios';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'https://flashdataexpress.onrender.com/api';

const api = axios.create({
  baseURL: API_BASE,
  timeout: 30000,
  headers: { 'Content-Type': 'application/json' }
});

// Attach token to every request
api.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('ds_token');
    if (token) {
      config.headers['x-auth-token'] = token;
    }
  }
  return config;
});

// Handle auth errors globally
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      if (typeof window !== 'undefined') {
        const isSubAgent = localStorage.getItem('ds_is_subagent') === 'true';
        localStorage.removeItem('ds_token');
        localStorage.removeItem('ds_user');
        if (isSubAgent) {
          localStorage.removeItem('ds_subagent');
          localStorage.removeItem('ds_is_subagent');
          window.location.href = '/subagent/login';
        } else {
          window.location.href = '/sign-in';
        }
      }
    }
    return Promise.reject(error);
  }
);

export default api;
