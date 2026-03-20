import axios from 'axios';

const API_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8001';

const api = axios.create({
  baseURL: `${API_URL}/api`,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor for auth token
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Response interceptor for error handling
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// Auth
export const authAPI = {
  register: (data) => api.post('/auth/register', data),
  login: (data) => api.post('/auth/login', data),
  getMe: () => api.get('/auth/me'),
};

// Categories
export const categoriesAPI = {
  getAll: () => api.get('/categories'),
  create: (data) => api.post('/categories', data),
};

// Products
export const productsAPI = {
  getAll: (params) => api.get('/products', { params }),
  getPopular: (limit = 8) => api.get('/products/popular', { params: { limit } }),
  getRecommendations: () => api.get('/products/recommendations'),
  getById: (id) => api.get(`/products/${id}`),
  create: (data) => api.post('/products', data),
  update: (id, data) => api.put(`/products/${id}`, data),
  delete: (id) => api.delete(`/products/${id}`),
  getSupplierProducts: () => api.get('/supplier/products'),
};

// Cart
export const cartAPI = {
  get: () => api.get('/cart'),
  addItem: (productId, quantity) => api.post('/cart/items', { product_id: productId, quantity }),
  updateItem: (productId, quantity) => api.put(`/cart/items/${productId}`, null, { params: { quantity } }),
  removeItem: (productId) => api.delete(`/cart/items/${productId}`),
  clear: () => api.delete('/cart'),
};

// Orders
export const ordersAPI = {
  create: (data) => api.post('/orders', data),
  getAll: () => api.get('/orders'),
  getById: (id) => api.get(`/orders/${id}`),
  updateStatus: (id, status) => api.put(`/orders/${id}/status`, null, { params: { status } }),
};

// Payment
export const paymentAPI = {
  createCheckoutSession: (originUrl) => api.post('/checkout/session', { origin_url: originUrl }),
  getCheckoutStatus: (sessionId) => api.get(`/checkout/status/${sessionId}`),
};

// Reviews
export const reviewsAPI = {
  create: (data) => api.post('/reviews', data),
  getByProduct: (productId) => api.get(`/products/${productId}/reviews`),
};

// Favorites
export const favoritesAPI = {
  getAll: () => api.get('/favorites'),
  add: (productId) => api.post(`/favorites/${productId}`),
  remove: (productId) => api.delete(`/favorites/${productId}`),
};

// Messages
export const messagesAPI = {
  send: (data) => api.post('/messages', data),
  getConversations: () => api.get('/messages/conversations'),
  getMessages: (partnerId) => api.get(`/messages/${partnerId}`),
};

// Blog
export const blogAPI = {
  getAll: (params) => api.get('/blog', { params }),
  getById: (id) => api.get(`/blog/${id}`),
  create: (data) => api.post('/blog', data),
};

// Supplier Stats
export const supplierAPI = {
  getStats: () => api.get('/supplier/stats'),
};

// Seed Data
export const seedAPI = {
  seed: () => api.post('/seed'),
};

export default api;
