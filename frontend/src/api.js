import axios from 'axios'

// Single axios instance — the Vite dev proxy forwards /api to the backend.
const http = axios.create({
  baseURL: '/api',
  timeout: 180000
})

http.interceptors.response.use(
  (res) => res,
  (err) => {
    // Surface a readable message instead of a raw axios error string.
    const message = err.response?.data?.error || err.message || '请求失败'
    err.friendlyMessage = message
    return Promise.reject(err)
  }
)

export const api = {
  health: () => http.get('/health').then(r => r.data),
  meta: () => http.get('/meta').then(r => r.data),

  latestDigest: () => http.get('/digests/latest').then(r => r.data),
  digests: (limit = 30) => http.get('/digests', { params: { limit } }).then(r => r.data),
  digest: (id) => http.get(`/digests/${id}`).then(r => r.data),

  articles: (params = {}) => http.get('/articles', { params }).then(r => r.data),
  bookmarks: (params = {}) => http.get('/articles/bookmarks/all', { params }).then(r => r.data),
  tags: () => http.get('/articles/tags').then(r => r.data),
  search: (params = {}) => http.get('/articles/search', { params }).then(r => r.data),
  bulk: (payload) => http.post('/articles/bulk', payload).then(r => r.data),

  setStar: (id, star) => http.post(`/articles/${id}/star`, { star }).then(r => r.data),
  setRead: (id, read) => http.post(`/articles/${id}/read`, { read }).then(r => r.data),

  sources: () => http.get('/sources').then(r => r.data),
  sourceHealth: () => http.get('/sources/health').then(r => r.data),
  updateSource: (key, patch) => http.put(`/sources/${key}`, patch).then(r => r.data),

  settings: () => http.get('/settings').then(r => r.data),
  saveSettings: (patch) => http.put('/settings', patch).then(r => r.data),

  stats: () => http.get('/stats').then(r => r.data),
  prune: (confirm = false) => http.post('/prune', { confirm }).then(r => r.data),

  generate: (opts = {}) => http.post('/digests/generate', opts).then(r => r.data),
  fetchSources: (sources) => http.post('/fetch', { sources }).then(r => r.data)
}

export default http
