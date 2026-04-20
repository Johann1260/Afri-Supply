import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { authAPI } from '../lib/api';

let _resetFavoritesCache = null;
export const registerFavoritesCacheReset = (fn) => { _resetFavoritesCache = fn; };

const AuthContext = createContext(null);

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser]                     = useState(null);
  const [loading, setLoading]               = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authReady, setAuthReady]           = useState(false);

  const logout = useCallback(() => {
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    localStorage.removeItem('user');
    if (_resetFavoritesCache) _resetFavoritesCache();
    setUser(null);
    setIsAuthenticated(false);
  }, []);

  const loadUserFromStorage = useCallback(() => {
    try {
      const accessToken = localStorage.getItem('access_token');
      const storedUser  = localStorage.getItem('user');
      if (accessToken && storedUser) {
        setUser(JSON.parse(storedUser));
        setIsAuthenticated(true);
      }
    } catch {
      logout();
    } finally {
      setAuthReady(true);
      setLoading(false);
    }
  }, [logout]);

  useEffect(() => { loadUserFromStorage(); }, [loadUserFromStorage]);

  // FIX CRITIQUE : stocke user + tokens en localStorage
  const login = async (credentials) => {
    const response = await authAPI.login(credentials);
    const { access_token, refresh_token, user: userData } = response.data;
    if (access_token) localStorage.setItem('access_token', access_token);
    if (refresh_token) localStorage.setItem('refresh_token', refresh_token);
    if (userData) localStorage.setItem('user', JSON.stringify(userData));
    setUser(userData);
    setIsAuthenticated(true);
    setAuthReady(true);
    return userData;
  };

  const register = async (data) => {
    const response = await authAPI.register(data);
    const { access_token, refresh_token, user: userData } = response.data;
    if (access_token) localStorage.setItem('access_token', access_token);
    if (refresh_token) localStorage.setItem('refresh_token', refresh_token);
    if (userData) localStorage.setItem('user', JSON.stringify(userData));
    setUser(userData);
    setIsAuthenticated(true);
    return userData;
  };

  const updateUser = useCallback((updatedFields) => {
    setUser((prev) => {
      if (!prev) return prev;
      const merged = { ...prev, ...updatedFields };
      localStorage.setItem('user', JSON.stringify(merged));
      return merged;
    });
  }, []);

  const normalizedUserType = user?.user_type
    ? String(user.user_type).trim().toLowerCase()
    : null;

  const accountStatus   = user?.account_status;
  const emailVerified   = user?.email_verified !== false;
  const isPendingReview = accountStatus === 'pending_review';
  const isPendingEmail  = accountStatus === 'pending_email' || emailVerified === false;

  const value = {
    user, loading, isAuthenticated, authReady,
    accountStatus, emailVerified, isPendingReview, isPendingEmail,
    login, register, logout, updateUser,
    user_type:  normalizedUserType,
    isBuyer:    normalizedUserType === 'buyer',
    isSupplier: normalizedUserType === 'supplier',
    isAdmin:    normalizedUserType === 'admin',
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};