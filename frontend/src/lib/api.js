import axios from 'axios';

const API_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8000';

const api = axios.create({
  baseURL: `${API_URL}/api`,
  headers: { 'Content-Type': 'application/json' },
});

// Request interceptor
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('access_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Response interceptor - Refresh amélioré
// Response interceptor - Version simplifiée et robuste
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      const refreshToken = localStorage.getItem('refresh_token');

      if (!refreshToken) {
        localStorage.clear();
        window.location.href = '/login?expired=true';
        return Promise.reject(error);
      }

      try {
        const res = await axios.post(`${API_URL}/api/auth/refresh`, {}, {
          headers: { Authorization: `Bearer ${refreshToken}` }
        });

        const { access_token, refresh_token } = res.data;

        localStorage.setItem('access_token', access_token);
        localStorage.setItem('refresh_token', refresh_token);

        originalRequest.headers.Authorization = `Bearer ${access_token}`;
        return api(originalRequest);
      } catch (refreshError) {
        console.error('Refresh failed');
        localStorage.clear();
        window.location.href = '/login?expired=true';
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);
// Auth
export const authAPI = {
  login: async (data) => {
    const response = await api.post('/auth/login', data);
    const { access_token, refresh_token, user } = response.data;

    localStorage.setItem('access_token', access_token);
    localStorage.setItem('refresh_token', refresh_token);
    localStorage.setItem('user', JSON.stringify(user));

    return response;
  },

  register: (data) => api.post('/auth/register', data),
};
// Les autres APIs restent identiques
export const categoriesAPI = {
  getAll: () => api.get('/categories'),
  create: (data) => api.post('/categories', data),
};

export const productsAPI = {
  getAll: (params) => api.get('/products', { params }),
  getPopular: (limit = 8) => api.get('/products/popular', { params: { limit } }),
  getRecommendations: () => api.get('/products/recommendations'),
  getById: (id) => api.get(`/products/${id}`),
  
  // Création avec support upload images (FormData)
  create: (data) => {
    if (data instanceof FormData) {
      return api.post('/products', data, {
        headers: { 'Content-Type': 'multipart/form-data' }, // Important
      });
    }
    return api.post('/products', data);
  },

  update: (id, data) => api.put(`/products/${id}`, data),
  delete: (id) => api.delete(`/products/${id}`),
  
  // Pour le dashboard supplier
  getSupplierProducts: () => api.get('/supplier/products'),
};

export const cartAPI = {
  get: () => api.get('/cart'),
  addItem: (productId, quantity) => api.post('/cart/items', { product_id: productId, quantity }),
  updateItem: (productId, quantity) => api.put(`/cart/items/${productId}`, null, { params: { quantity } }),
  removeItem: (productId) => api.delete(`/cart/items/${productId}`),
  clear: () => api.delete('/cart'),
};

export const ordersAPI = {
  create: (data) => api.post('/orders', data),
  getAll: () => api.get('/orders'),
  getById: (id) => api.get(`/orders/${id}`),
  updateStatus: (id, status) => api.put(`/orders/${id}/status`, null, { params: { status } }),
};

export const paymentAPI = {
  createCheckoutSession: (originUrl) => api.post('/checkout/session', { origin_url: originUrl }),
  getCheckoutStatus: (sessionId) => api.get(`/checkout/status/${sessionId}`),
};

export const reviewsAPI = {
  create: (data) => api.post('/reviews', data),
  getByProduct: (productId) => api.get(`/products/${productId}/reviews`),
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
  confirmPayment: (transactionId) => api.post(`/checkout/mobile-money/${transactionId}/confirm`),
};

export const seedAPI = {
  seed: () => api.post('/seed'),
};

export default api;