/**
 * api.js — Client HTTP sécurisé AfriSupply
 *
 * Corrections :
 * - Refresh token envoyé en QUERY PARAM (FastAPI: `async def refresh_token(refresh_token: str)`)
 * - File d'attente pendant le refresh (évite les rafales de refreshs concurrents)
 * - Timeout 15s, retry auto 503/504
 * - Headers de sécurité sur chaque requête
 * - Sanitisation XSS basique des query params
 */

import axios from 'axios';

const API_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8000';

// ── Instance Axios ────────────────────────────────────────────────────────────
const api = axios.create({
  baseURL: `${API_URL}/api`,
  headers: { 'Content-Type': 'application/json' },
  timeout: 15000,
});

// ── Request interceptor — token + sécurité ────────────────────────────────────
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('access_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;

  // Indiquer que c'est un appel XHR (aide les WAF à filtrer)
  config.headers['X-Requested-With'] = 'XMLHttpRequest';

  // Sanitiser les query params (strip balises HTML basiques)
  if (config.params) {
    const clean = {};
    for (const [k, v] of Object.entries(config.params)) {
      if (v !== undefined && v !== null) {
        clean[k] = typeof v === 'string' ? v.replace(/<[^>]*>/g, '').trim() : v;
      }
    }
    config.params = clean;
  }

  return config;
});

// ── Refresh token — état singleton ───────────────────────────────────────────
let _isRefreshing = false;
let _waitQueue = []; // { resolve, reject }[]

const flushQueue = (err, token) => {
  _waitQueue.forEach((p) => (err ? p.reject(err) : p.resolve(token)));
  _waitQueue = [];
};

const hardLogout = () => {
  localStorage.removeItem('access_token');
  localStorage.removeItem('refresh_token');
  localStorage.removeItem('user');
  if (!window.location.pathname.startsWith('/login')) {
    window.location.href = '/login?expired=true';
  }
};

// ── Response interceptor — refresh + retry ───────────────────────────────────
api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const orig = error.config;

    // Retry automatique sur erreurs serveur temporaires
    if ([502, 503, 504].includes(error.response?.status) && !orig._retried) {
      orig._retried = true;
      await new Promise((r) => setTimeout(r, 1200));
      return api(orig);
    }

    // Pas un 401, ou déjà retenté → rejeter directement
    if (error.response?.status !== 401 || orig._retry) {
      return Promise.reject(error);
    }

    // Ne pas boucler sur l'endpoint refresh lui-même
    if (orig.url?.includes('/auth/refresh')) {
      hardLogout();
      return Promise.reject(error);
    }

    orig._retry = true;

    const refreshToken = localStorage.getItem('refresh_token');
    if (!refreshToken) {
      hardLogout();
      return Promise.reject(error);
    }

    // Déjà un refresh en cours → mettre en attente
    if (_isRefreshing) {
      return new Promise((resolve, reject) => {
        _waitQueue.push({
          resolve: (newToken) => {
            orig.headers.Authorization = `Bearer ${newToken}`;
            resolve(api(orig));
          },
          reject,
        });
      });
    }

    _isRefreshing = true;

    try {
      // ✅ CORRECTION CLÉE : FastAPI déclare `refresh_token: str` sans body/header annotation
      // → FastAPI le lit comme un QUERY PARAMETER.
      // On envoie donc : POST /api/auth/refresh?refresh_token=<token>
      const res = await axios.post(
        `${API_URL}/api/auth/refresh`,
        null,                                        // body vide
        { params: { refresh_token: refreshToken } }  // ← query param
      );

      const newAccess = res.data.access_token;
      const newRefresh = res.data.refresh_token;

      if (!newAccess) throw new Error('Refresh response missing access_token');

      localStorage.setItem('access_token', newAccess);
      if (newRefresh) localStorage.setItem('refresh_token', newRefresh);

      api.defaults.headers.common['Authorization'] = `Bearer ${newAccess}`;
      orig.headers.Authorization = `Bearer ${newAccess}`;

      flushQueue(null, newAccess);
      return api(orig);
    } catch (refreshErr) {
      flushQueue(refreshErr, null);
      hardLogout();
      return Promise.reject(refreshErr);
    } finally {
      _isRefreshing = false;
    }
  }
);

// ═══════════════════════════════════════════════════════════════════════════════
// APIs
// ═══════════════════════════════════════════════════════════════════════════════

export const authAPI = {
  login: async (data) => {
    const res = await api.post('/auth/login', data);
    const { access_token, refresh_token, user } = res.data;
    if (access_token) localStorage.setItem('access_token', access_token);
    if (refresh_token) localStorage.setItem('refresh_token', refresh_token);
    if (user) localStorage.setItem('user', JSON.stringify(user));
    return res;
  },
  register: (data) => api.post('/auth/register', data),
  uploadDocuments: (userId, files) => {
    const form = new FormData();
    files.forEach((f) => form.append('documents', f));
    return api.post(`/auth/documents/${userId}`, form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
  verifyEmail: (token) => api.get(`/auth/verify-email`, { params: { token } }),
  resendVerification: (email) => api.post('/auth/resend-verification', { email }),
  forgotPassword: (email) => api.post('/auth/forgot-password', { email }),
  resetPassword: (token, password) =>
    api.post('/auth/reset-password', { token, password }),
};

export const categoriesAPI = {
  getAll: () => api.get('/categories'),
  create: (data) => api.post('/categories', data),
};

export const productsAPI = {
  getAll: (params) => api.get('/products', { params }),
  getPopular: (limit = 8) => api.get('/products/popular', { params: { limit } }),
  getRecommendations: () => api.get('/products/recommendations'),
  getById: (id) => api.get(`/products/${id}`),
  getCount: (params) => api.get('/products/count', { params }),
  create: (data) =>
    data instanceof FormData
      ? api.post('/products', data, {
          headers: { 'Content-Type': 'multipart/form-data' },
        })
      : api.post('/products', data),
  update: (id, data) =>
    data instanceof FormData
      ? api.put(`/products/${id}`, data, {
          headers: { 'Content-Type': 'multipart/form-data' },
        })
      : api.put(`/products/${id}`, data),
  delete: (id) => api.delete(`/products/${id}`),
  getSupplierProducts: () => api.get('/supplier/products'),
};

export const cartAPI = {
  get: () => api.get('/cart'),
  addItem: (productId, quantity) =>
    api.post('/cart/items', { product_id: productId, quantity }),
  updateItem: (productId, quantity) =>
    api.put(`/cart/items/${productId}`, null, { params: { quantity } }),
  removeItem: (productId) => api.delete(`/cart/items/${productId}`),
  clear: () => api.delete('/cart'),
};

export const ordersAPI = {
  create: (data) => api.post('/orders', data),
  getAll: () => api.get('/orders'),
  getById: (id) => api.get(`/orders/${id}`),
  updateStatus: (id, status) =>
    api.put(`/orders/${id}/status`, null, { params: { status } }),
};

export const paymentAPI = {
  createCheckoutSession: (originUrl) =>
    api.post('/checkout/session', { origin_url: originUrl }),
  getCheckoutStatus: (sessionId) => api.get(`/checkout/status/${sessionId}`),
};

export const reviewsAPI = {
  create: (data) => api.post('/reviews', data),
  getByProduct: (productId) => api.get(`/products/${productId}/reviews`),
  getPending: () => api.get('/reviews/pending'),
};

export const favoritesAPI = {
  getAll: () => api.get('/favorites'),
  add: (productId) => api.post(`/favorites/${productId}`),
  remove: (productId) => api.delete(`/favorites/${productId}`),
};

export const messagesAPI = {
  send: (data) => api.post('/messages', data),
  getConversations: () => api.get('/messages/conversations'),
  getMessages: (partnerId) => api.get(`/messages/${partnerId}`),
};

export const blogAPI = {
  getAll: (params) => api.get('/blog', { params }),
  getById: (id) => api.get(`/blog/${id}`),
  create: (data) => api.post('/blog', data),
};

export const supplierAPI = {
  getStats: () => api.get('/supplier/stats'),
  getAll: (params) => api.get('/suppliers', { params }),
  getProfile: (id) => api.get(`/suppliers/${id}/profile`),
  getRatings: (id) => api.get(`/suppliers/${id}/ratings`),
  rateSupplier: (id, data) => api.post(`/suppliers/${id}/rate`, data),
};

export const rfqAPI = {
  getAll: () => api.get('/rfq'),
  getById: (id) => api.get(`/rfq/${id}`),
  create: (data) => api.post('/rfq', data),
  submitQuote: (id, data) => api.post(`/rfq/${id}/quote`, data),
  acceptQuote: (id) => api.post(`/rfq/${id}/accept`),
  rejectQuote: (id) => api.post(`/rfq/${id}/reject`),
};

export const notificationsAPI = {
  getAll: () => api.get('/notifications'),
  getUnreadCount: () => api.get('/notifications/unread-count'),
  markAsRead: (id) => api.post(`/notifications/${id}/read`),
  markAllAsRead: () => api.post('/notifications/read-all'),
};

export const mobileMoneyAPI = {
  createPayment: (data) => api.post('/checkout/mobile-money', data),
  confirmPayment: (transactionId) =>
    api.post(`/checkout/mobile-money/${transactionId}/confirm`),
};

export const seedAPI = {
  seed: () => api.post('/seed'),
};

export default api;