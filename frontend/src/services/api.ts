import axios from 'axios'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'

const api = axios.create({
  baseURL: `${API_URL}/api/v1`,
  headers: {
    'Content-Type': 'application/json',
  },
})

// Add auth token to requests
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('access_token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// Handle responses and global errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    // Handle 401 Unauthorized (Expired JWT)
    if (error.response && error.response.status === 401) {
      localStorage.removeItem('access_token')
      localStorage.removeItem('user')
      if (window.location.pathname !== '/login') {
        window.location.href = '/login'
      }
    }
    
    // Handle 503 or Network Timeouts
    if (!error.response || error.response.status >= 500) {
      console.error('Backend Service Unavailable or Network Error:', error)
      // We do not crash the app, just reject the promise cleanly so components can catch it
    }
    
    return Promise.reject(error)
  }
)

// Auth API
export const authApi = {
  login: (email: string, password: string) =>
    api.post('/auth/login', new URLSearchParams({ username: email, password }), { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }),
  register: (data: { email: string; password: string; org_id: string; role: string }) =>
    api.post('/auth/register', data),
  me: () => api.get('/auth/me'),
  logout: () => api.post('/auth/logout'),
}

// Dashboard API
export const dashboardApi = {
  getStats: (orgId: string) => api.get('/dashboard/stats', { params: { org_id: orgId } }),
}

// Circulars API
export const circularsApi = {
  list: (orgId: string) => api.get('/circulars/', { params: { org_id: orgId } }),
  get: (id: string) => api.get(`/circulars/${id}`),
  create: (data: { title: string; org_id: string; effective_date?: string }) =>
    api.post('/circulars/', data),
  upload: (id: string, file: File, onUploadProgress?: (progressEvent: any) => void) => {
    const formData = new FormData()
    formData.append('file', file)
    return api.post(`/circulars/${id}/upload`, formData, {
      onUploadProgress,
    })
  },
  delete: (id: string) => api.delete(`/circulars/${id}`),
}

// Obligations API
export const obligationsApi = {
  list: (circularId: string) => api.get(`/obligations/circular/${circularId}`),
  create: (data: { circular_id: string; description: string; deadline?: string; applicability?: string; source_ref?: string }) =>
    api.post('/obligations/', data),
  update: (id: string, data: Partial<{ description: string; deadline: string; applicability: string; source_ref: string; status: string }>) =>
    api.patch(`/obligations/${id}`, data),
  delete: (id: string) => api.delete(`/obligations/${id}`),
}

// Findings API
export const findingsApi = {
  list: (orgId: string, filters?: { severity?: string; type?: string }) =>
    api.get('/findings/', { params: { org_id: orgId, ...filters } }),
  get: (id: string) => api.get(`/findings/${id}`),
  update: (id: string, data: { status: string }) => api.patch(`/findings/${id}`, data),
  runStressTest: (circularId: string) => api.post(`/findings/${circularId}/run-stress-test`),
}

// Readiness API
export const readinessApi = {
  getCurrent: (orgId: string) => api.get(`/readiness/${orgId}`),
  getTrend: (orgId: string, limit?: number) =>
    api.get(`/readiness/${orgId}/trend`, { params: { limit } }),
  recalculate: (orgId: string, circularId?: string) =>
    api.post(`/readiness/${orgId}/recalculate`, null, { params: { circular_id: circularId } }),
}

// Replay API
export const replayApi = {
  get: (findingId: string) => api.get(`/replay/${findingId}`),
}

// Advisor API
export const advisorApi = {
  query: (question: string, orgId?: string) =>
    api.post('/advisor/query', { question, org_id: orgId }),
}

// Action Plan API
export const actionPlanApi = {
  list: (orgId: string) => api.get('/action-plan/', { params: { org_id: orgId } }),
  update: (id: string, status: string) => api.patch(`/action-plan/${id}`, { status }),
}

// Reports API
export const reportsApi = {
  list: (orgId: string) => api.get('/reports/', { params: { org_id: orgId } }),
  generate: (circularId: string) => api.post(`/reports/generate/${circularId}`),
}

// Departments API
export const departmentsApi = {
  list: (orgId: string) => api.get('/departments/', { params: { org_id: orgId } }),
}

export default api
