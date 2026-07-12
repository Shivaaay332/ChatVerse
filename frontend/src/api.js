import axios from 'axios';

// Render URL (Jab backend live hoga tab ye URL use hoga)
// Local testing ke liye: 'http://localhost:5000/api'
export const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
export const SOCKET_URL = import.meta.env.VITE_API_URL ? import.meta.env.VITE_API_URL.replace('/api', '') : 'http://localhost:5000';

const api = axios.create({
  baseURL: API_URL,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('chatverse_token');
  if (token) { config.headers.Authorization = `Bearer ${token}`; }
  return config;
});

export default api;