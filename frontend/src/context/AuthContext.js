import React, { createContext, useContext, useState, useEffect } from 'react';
import { authAPI } from '../lib/api';

const AuthContext = createContext(null);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authReady, setAuthReady] = useState(false);   // ← NOUVEAU

  const loadUserFromStorage = () => {
    try {
      const accessToken = localStorage.getItem('access_token');
      const storedUser = localStorage.getItem('user');

      if (accessToken && storedUser) {
        const parsedUser = JSON.parse(storedUser);
        setUser(parsedUser);
        setIsAuthenticated(true);
        console.log('User chargé depuis storage:', parsedUser.user_type);
      }
    } catch (err) {
      console.error(err);
      logout();
    } finally {
      setAuthReady(true);   // ← Important
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUserFromStorage();
  }, []);

  const login = async (credentials) => {
    try {
      const response = await authAPI.login(credentials);
      const { user: userData } = response.data;

      setUser(userData);
      setIsAuthenticated(true);
      setAuthReady(true);

      return userData;
    } catch (err) {
      console.error(err);
      throw err;
    }
  };

  const register = async (data) => {
    const response = await authAPI.register(data);
    const { access_token, refresh_token, user: userData } = response.data;

    localStorage.setItem('access_token', access_token);
    localStorage.setItem('refresh_token', refresh_token);
    localStorage.setItem('user', JSON.stringify(userData));

    setUser(userData);
    setIsAuthenticated(true);

    return userData;
  };

  const logout = () => {
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    localStorage.removeItem('user');
    setUser(null);
    setIsAuthenticated(false);
  };

  // Normalisation du user_type (tolérance casse + espaces)
  const normalizedUserType = user?.user_type 
    ? String(user.user_type).trim().toLowerCase() 
    : null;

  const value = {
    user,
    loading,
    isAuthenticated,
    authReady,
    login,
    register,
    logout,
    user_type: normalizedUserType,
    isBuyer: normalizedUserType === 'buyer',
    isSupplier: normalizedUserType === 'supplier',
    isAdmin: normalizedUserType === 'admin',
  };

  // // Debug utile
  // console.log('AuthContext render →', {
  //   isAuthenticated,
  //   isBuyer: value.isBuyer,
  //   isSupplier: value.isSupplier,
  //   user_type_raw: user?.user_type,
  //   normalized: normalizedUserType,
  //   loading
  // });

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};