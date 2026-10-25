import axios from 'axios';
import { useAuthStore } from '../stores/auth.store';
import { refreshAccessToken } from './token-refresh';

const api = axios.create({
  baseURL: '/api',
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().accessToken;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config;
    if (error.response?.status !== 401 || !original || original._retry) {
      return Promise.reject(error);
    }
    original._retry = true;

    // A refresh may have completed while this request was in flight, in which
    // case its 401 is stale: retry with the current token rather than spending
    // another rotation on a token the server has already replaced.
    const sentWith = String(original.headers?.Authorization ?? '').replace(/^Bearer /, '');
    const current = useAuthStore.getState().accessToken;
    if (current && current !== sentWith) {
      original.headers.Authorization = `Bearer ${current}`;
      return api(original);
    }

    // Single-flight across this tab and, where supported, across tabs.
    const fresh = await refreshAccessToken();
    if (!fresh) return Promise.reject(error);

    original.headers.Authorization = `Bearer ${fresh}`;
    return api(original);
  },
);

export default api;
