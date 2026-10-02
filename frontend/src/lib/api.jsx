/**
 * api.js — Client HTTP sécurisé AfriSupply (complet MVP)
 */
import axios from 'axios';

// Use Vite's import.meta.env instead of process.env
const API_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000';

const api = axios.create({
  baseURL: `${API_URL}/api`,
  headers: { 'Content-Type': 'application/json' },
  timeout: 15000,
  withCredentials: true,  // ← envoie les cookies httpOnly automatiquement
});

// ── Request interceptor ───────────────────────────────────────────────────────
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('access_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  config.headers['X-Requested-With'] = 'XMLHttpRequest';
  // Localization — backend reads Accept-Language to translate anonymous IDs
  const lang = localStorage.getItem('afrisupply_locale') || 'fr';
  config.headers['Accept-Language'] = lang;
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

// ── Refresh token ─────────────────────────────────────────────────────────────
let _isRefreshing = false;
let _waitQueue = [];

const flushQueue = (err, token) => {
  _waitQueue.forEach((p) => (err ? p.reject(err) : p.resolve(token)));
  _waitQueue = [];
};

const hardLogout = async () => {
  // Appeler /auth/logout pour supprimer les cookies httpOnly côté serveur
  try { await axios.post(`${API_URL}/api/auth/logout`, {}, { withCredentials: true }); } catch { /* ignore */ }
  localStorage.removeItem('access_token');
  localStorage.removeItem('refresh_token');
  localStorage.removeItem('user');
  if (!window.location.pathname.startsWith('/login')) {
    window.location.href = '/login?expired=true';
  }
};

api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const orig = error.config;
    if ([502, 503, 504].includes(error.response?.status) && !orig._retried) {
      orig._retried = true;
      await new Promise((r) => setTimeout(r, 1200));
      return api(orig);
    }
    if (error.response?.status !== 401 || orig._retry) return Promise.reject(error);
    if (orig.url?.includes('/auth/refresh')) { hardLogout(); return Promise.reject(error); }
    orig._retry = true;
    const refreshToken = localStorage.getItem('refresh_token');
    if (!refreshToken) { hardLogout(); return Promise.reject(error); }
    if (_isRefreshing) {
      return new Promise((resolve, reject) => {
        _waitQueue.push({
          resolve: (newToken) => { orig.headers.Authorization = `Bearer ${newToken}`; resolve(api(orig)); },
          reject,
        });
      });
    }
    _isRefreshing = true;
    try {
      const res = await axios.post(`${API_URL}/api/auth/refresh`, { refresh_token: refreshToken }, { withCredentials: true });
      const newAccess  = res.data.access_token;
      const newRefresh = res.data.refresh_token;
      if (!newAccess) throw new Error('Missing access_token');
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
// AUTH
// ═══════════════════════════════════════════════════════════════════════════════
export const authAPI = {
  login:              (data) => api.post('/auth/login', data),
  logout:             ()     => api.post('/auth/logout'),
  register:           (data) => api.post('/auth/register', data),
  getMe:              ()     => api.get('/auth/me'),
  updateMe:           (data) => api.put('/auth/me', data),
  changePassword:     (data) => api.put('/auth/password', data),
  uploadDocuments:    (userId, files) => {
    const form = new FormData();
    files.forEach((f) => form.append('documents', f));
    return api.post(`/auth/documents/${userId}`, form, { headers: { 'Content-Type': 'multipart/form-data' } });
  },
  verifyEmail:        (token)  => api.get('/auth/verify-email', { params: { token } }),
  resendVerification: (email)  => api.post('/auth/resend-verification', { email }),
  forgotPassword:     (email)  => api.post('/auth/forgot-password', { email }),
  resetPassword:      (token, password) => api.post('/auth/reset-password', { token, password }),
};

// ═══════════════════════════════════════════════════════════════════════════════
// CATEGORIES
// ═══════════════════════════════════════════════════════════════════════════════
export const categoriesAPI = {
  getAll:  ()     => api.get('/categories'),
  create:  (data) => api.post('/categories', data),
};

// ═══════════════════════════════════════════════════════════════════════════════
// PRODUCTS
// ═══════════════════════════════════════════════════════════════════════════════
export const productsAPI = {
  getAll:              (params) => api.get('/products', { params }),
  getPopular:          (limit = 8) => api.get('/products/popular', { params: { limit } }),
  getRecommendations:  ()     => api.get('/products/recommendations'),
  getById:             (id)   => api.get(`/products/${id}`),
  getCount:            (params) => api.get('/products/count', { params }),
  getProductSheet:     (id)   => `${API_URL}/api/products/${id}/sheet`,
  getSupplierProducts: ()     => api.get('/supplier/products'),
  create: (data) =>
    data instanceof FormData
      ? api.post('/products', data, { headers: { 'Content-Type': 'multipart/form-data' } })
      : api.post('/products', data),
  update: (id, data) =>
    data instanceof FormData
      ? api.put(`/products/${id}`, data, { headers: { 'Content-Type': 'multipart/form-data' } })
      : api.put(`/products/${id}`, data),
  delete: (id) => api.delete(`/products/${id}`),
  // Autocomplete search
  search: (q) => api.get('/products', { params: { search: q, limit: 6 } }),
};

// ═══════════════════════════════════════════════════════════════════════════════
// CART
// ═══════════════════════════════════════════════════════════════════════════════
export const cartAPI = {
  get:        ()                   => api.get('/cart'),
  addItem:    (productId, quantity) => api.post('/cart/items', { product_id: productId, quantity }),
  updateItem: (productId, quantity) => api.put(`/cart/items/${productId}`, null, { params: { quantity } }),
  removeItem: (productId)          => api.delete(`/cart/items/${productId}`),
  clear:      ()                   => api.delete('/cart'),
};

// ═══════════════════════════════════════════════════════════════════════════════
// ORDERS
// ═══════════════════════════════════════════════════════════════════════════════
export const ordersAPI = {
  create:       (data) => api.post('/orders', data),
  getAll:       ()     => api.get('/orders'),
  getById:      (id)   => api.get(`/orders/${id}`),
  updateStatus: (id, status) => api.put(`/orders/${id}/status`, null, { params: { status } }),
  // Facture PDF
  getInvoice:   (id)   => `${API_URL}/api/orders/${id}/invoice`,
  // Tracking livraison
  getTracking:  (id)   => api.get(`/orders/${id}/tracking`),
  addTracking:  (id, data) => api.post(`/orders/${id}/tracking`, data),
  setDeliveryFee: (id, fee) => api.put(`/orders/${id}/delivery-fee`, { delivery_fee: fee }),
};

// ═══════════════════════════════════════════════════════════════════════════════
// PAYMENT
// ═══════════════════════════════════════════════════════════════════════════════
export const paymentAPI = {
  createCheckoutSession: (data) => api.post('/checkout/session', data),
  getCheckoutStatus:     (sessionId) => api.get(`/checkout/status/${sessionId}`),
};

export const mobileMoneyAPI = {
  createPayment:  (data)          => api.post('/checkout/mobile-money', data),
  confirmPayment: (transactionId) => api.post(`/checkout/mobile-money/${transactionId}/confirm`),
};

// ═══════════════════════════════════════════════════════════════════════════════
// REVIEWS & FAVORITES
// ═══════════════════════════════════════════════════════════════════════════════
export const reviewsAPI = {
  create:       (data)      => api.post('/reviews', data),
  getByProduct: (productId) => api.get(`/products/${productId}/reviews`),
  getPending:   ()          => api.get('/reviews/pending'),
};

export const favoritesAPI = {
  getAll: ()          => api.get('/favorites'),
  add:    (productId) => api.post(`/favorites/${productId}`),
  remove: (productId) => api.delete(`/favorites/${productId}`),
};

// ═══════════════════════════════════════════════════════════════════════════════
// MESSAGES
// ═══════════════════════════════════════════════════════════════════════════════
export const messagesAPI = {
  send:             (data)      => api.post('/messages', data),
  getConversations: ()          => api.get('/messages/conversations'),
  getMessages:      (partnerId) => api.get(`/messages/${partnerId}`),
};

// ═══════════════════════════════════════════════════════════════════════════════
// BLOG
// ═══════════════════════════════════════════════════════════════════════════════
export const blogAPI = {
  getAll:  (params) => api.get('/blog', { params }),
  getById: (id)     => api.get(`/blog/${id}`),
  create:  (data)   => api.post('/blog', data),
};

// ═══════════════════════════════════════════════════════════════════════════════
// SUPPLIERS
// ═══════════════════════════════════════════════════════════════════════════════
export const supplierAPI = {
  getStats:       ()           => api.get('/supplier/stats'),
  getAll:         (params)     => api.get('/suppliers', { params }),
  getProfile:     (id)         => api.get(`/suppliers/${id}/profile`),
  getRatings:     (id)         => api.get(`/suppliers/${id}/ratings`),
  rateSupplier:   (id, data)   => api.post(`/suppliers/${id}/rate`, data),
  updateProfile:  (data)       => api.put('/supplier/profile', data),
};

export const storefrontAPI = {
  getMine:    ()     => api.get('/storefront/mine'),
  updateMine: (data) => api.put('/storefront/mine', data),
  getBySlug:  (slug) => api.get(`/storefront/${slug}`),
};

export const badgesAPI = {
  getMeta: () => api.get('/badges/meta'),
};

// ═══════════════════════════════════════════════════════════════════════════════
// RFQ
// ═══════════════════════════════════════════════════════════════════════════════
export const rfqAPI = {
  // Acheteur
  getMine:       (params)   => api.get('/rfq/mine', { params }),
  getById:       (id)       => api.get(`/rfq/${id}`),
  create:        (data)     => api.post('/rfq', data),
  createPublic:  (data)     => api.post('/rfq/public', data),
  cancel:        (id)       => api.post(`/rfq/${id}/cancel`),
  // Fournisseur
  getPublic:     (params)   => api.get('/rfq/public', { params }),
  // Compat
  getAll:        ()         => api.get('/rfq'),
};

export const quotationsAPI = {
  submit:        (rfqId, data)  => api.post(`/quotations/${rfqId}`, data),
  listByRfq:     (rfqId)        => api.get(`/quotations/rfq/${rfqId}`),
  accept:        (qId)          => api.post(`/quotations/${qId}/accept`),
  reject:        (qId, reason)  => api.post(`/quotations/${qId}/reject`, { reason }),
  getMy:         (params)       => api.get('/quotations/my', { params }),
};

export const actualitesAPI = {
  list:        (params)     => api.get('/admin/actualites', { params }),
  create:      (data)       => api.post('/admin/actualites', data),
  update:      (id, d)      => api.put(`/admin/actualites/${id}`, d),
  remove:      (id)         => api.delete(`/admin/actualites/${id}`),
  uploadMedia: (id, file, onProgress)   => {
    const fd = new FormData();
    fd.append('file', file);
    return api.post(`/admin/actualites/${id}/upload`, fd, {
      headers: { 'Content-Type': 'multipart/form-data' },
      onUploadProgress: onProgress
        ? (e) => onProgress(Math.round((e.loaded * 100) / (e.total || 1)))
        : undefined,
    });
  },
  deleteMedia: (id, url)    => api.delete(`/admin/actualites/${id}/media`, { params: { url } }),
};

// ═══════════════════════════════════════════════════════════════════════════════
// NOTIFICATIONS
// ═══════════════════════════════════════════════════════════════════════════════
export const notificationsAPI = {
  getAll:         ()    => api.get('/notifications'),
  getUnreadCount: ()    => api.get('/notifications/unread-count'),
  markAsRead:     (id)  => api.post(`/notifications/${id}/read`),
  markAllAsRead:  ()    => api.post('/notifications/read-all'),
};

// ═══════════════════════════════════════════════════════════════════════════════
// CONTACT UNLOCK
// ═══════════════════════════════════════════════════════════════════════════════
export const contactAPI = {
  getUnlockStatus: (partnerId) => api.get(`/contacts/${partnerId}/unlock-status`),
};

// ═══════════════════════════════════════════════════════════════════════════════
// ADMIN
// ═══════════════════════════════════════════════════════════════════════════════
export const adminAPI = {
  getStats:            ()       => api.get('/admin/stats'),
  getUsers:            (params) => api.get('/admin/users', { params }),
  getPendingSuppliers: ()       => api.get('/admin/suppliers/pending'),
  approveSupplier:     (id)     => api.post(`/admin/approve-supplier/${id}`),
  rejectSupplier:      (id)     => api.post(`/admin/reject-supplier/${id}`),
  getAllOrders:         (params) => api.get('/admin/orders', { params }),
  getBypassAttempts:   ()       => api.get('/admin/bypass-attempts'),
  getEscrows:          ()       => api.get('/admin/trade-assurance'),
  getDisputes:         ()       => api.get('/admin/disputes'),
  resolveDispute:      (id, data) => api.put(`/admin/disputes/${id}/resolve`, data),
  getRevenue:          ()       => api.get('/admin/revenue'),
  // Mobile Money manual validation queue
  getPendingMomo:      ()       => api.get('/admin/payment-transactions/pending-momo'),
  confirmMomo:         (txId)   => api.post(`/checkout/mobile-money/${txId}/confirm`),
  // Product moderation
  getAdminProducts:    (params) => api.get('/admin/products', { params }),
  getOrphanProducts:   ()       => api.get('/admin/products/orphans'),
  deleteOrphanProducts:()       => api.delete('/admin/products/orphans'),
  reassignOrphanProducts: (orphan_supplier_id, new_supplier_id) => api.post('/admin/products/orphans/reassign', { orphan_supplier_id, new_supplier_id }),
  approveProduct:      (id)     => api.put(`/admin/products/${id}/approve`),
  rejectProduct:       (id)     => api.put(`/admin/products/${id}/reject`),
  deleteUser:          (id)     => api.delete(`/admin/users/${id}`),
  suspendUser:         (id)     => api.put(`/admin/users/${id}/suspend`),
  approveUser:         (id)     => api.put(`/admin/users/${id}/approve`),
  rejectUser:          (id)     => api.put(`/admin/users/${id}/reject`),
  deleteCategory:      (id, force=false) => api.delete(`/admin/categories/${id}`, force ? { params: { force: true } } : undefined),
};

// ═══════════════════════════════════════════════════════════════════════════════
// SEED
// ═══════════════════════════════════════════════════════════════════════════════
export const seedAPI = { seed: () => api.post('/seed') };

// ═══════════════════════════════════════════════════════════════════════════════
// OTP
// ═══════════════════════════════════════════════════════════════════════════════
export const otpAPI = {
  send:   (data) => api.post('/otp/send', data),
  verify: (data) => api.post('/otp/verify', data),
};

// ═══════════════════════════════════════════════════════════════════════════════
// EMAIL CHANGE
// ═══════════════════════════════════════════════════════════════════════════════
export const emailChangeAPI = {
  initiate: ()     => api.post('/auth/change-email/initiate'),
  confirm:  (data) => api.post('/auth/change-email/confirm', data),
  activate: (token)=> api.get(`/auth/change-email/activate`, { params: { token } }),
};

// ═══════════════════════════════════════════════════════════════════════════════
// TRADE ASSURANCE
// ═══════════════════════════════════════════════════════════════════════════════
export const tradeAssuranceAPI = {
  create:         (data)  => api.post('/trade-assurance', data),
  get:            (ordId) => api.get(`/trade-assurance/${ordId}`),
  confirmDelivery:(taId)  => api.post(`/trade-assurance/${taId}/confirm`),
  openDispute:    (taId, data) => api.post(`/trade-assurance/${taId}/dispute`, data),
};

// ════════════════════════════════════════════════════════

// ── Admin Management ──────────────────────────────────────────────────────────
export const adminMgmtAPI = {
  // Comptes admin
  listAdmins:        ()           => api.get('/admin/admins'),
  createAdmin:       (data)       => api.post('/admin/admins', data),
  updateAdmin:       (id, data)   => api.put(`/admin/admins/${id}`, data),
  deactivateAdmin:   (id)         => api.delete(`/admin/admins/${id}`),

  // Actions utilisateurs
  suspendUser:       (id)         => api.post(`/admin/users/${id}/suspend`),
  banUser:           (id)         => api.post(`/admin/users/${id}/ban`),
  reactivateUser:    (id)         => api.post(`/admin/users/${id}/reactivate`),
  resetPassword:     (id)         => api.post(`/admin/users/${id}/reset-password`),

  // Logs
  getLogs:           (params)     => api.get('/admin/logs', { params }),

  // Badges
  getNotifSummary:   ()           => api.get('/admin/notifications/summary'),

  // Badge attribution
  setBadge: (supplierId, badge, action) => api.post(`/admin/suppliers/${supplierId}/badge`, { badge, action }),
};


export default api;
