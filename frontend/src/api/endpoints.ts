import axios from 'axios';

const API_BASE = process.env.REACT_APP_API_BASE_URL || 'http://localhost:3001/api';

const api = axios.create({
  baseURL: API_BASE,
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('authToken');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export const certificateApi = {
  getAll: (params?: Record<string, unknown>) =>
    api.get('/certificates', { params }).then((r) => r.data),
  getById: (id: string) =>
    api.get(`/certificates/${id}`).then((r) => r.data),
  issue: (data: Record<string, unknown>) =>
    api.post('/certificates', data).then((r) => r.data),
  revoke: (id: string, reason: string) =>
    api.patch(`/certificates/${id}/revoke`, { reason }).then((r) => r.data),
  verify: (certificateId: string) =>
    api.get(`/certificates/verify/${certificateId}`).then((r) => r.data),
};

export const userApi = {
  getAll: (params?: Record<string, unknown>) =>
    api.get('/users', { params }).then((r) => r.data),
  getById: (id: string) =>
    api.get(`/users/${id}`).then((r) => r.data),
  updateRole: (id: string, role: string) =>
    api.patch(`/users/${id}/role`, { role }).then((r) => r.data),
  toggleStatus: (id: string, isActive: boolean) =>
    api.patch(`/users/${id}/status`, { isActive }).then((r) => r.data),
  delete: (id: string) =>
    api.delete(`/users/${id}`).then((r) => r.data),
};

export const issuerProfileApi = {
  getProfile: (issuerId: string) =>
    api.get(`/issuers/${issuerId}/profile`).then((r) => r.data),
  updateProfile: (issuerId: string, data: Record<string, unknown>) =>
    api.put(`/issuers/${issuerId}/profile`, data).then((r) => r.data),
  getStats: (issuerId: string) =>
    api.get(`/issuers/${issuerId}/stats`).then((r) => r.data),
  getActivity: (issuerId: string, params?: Record<string, unknown>) =>
    api.get(`/issuers/${issuerId}/activity`, { params }).then((r) => r.data),
};

export default api;
