// src/components/auth/RequireSupplier.jsx
import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

export const RequireSupplier = () => {
  const { isAuthenticated, isSupplier, loading } = useAuth();

  console.log('RequireSupplier → isSupplier:', isSupplier, 'isAuthenticated:', isAuthenticated, 'loading:', loading);

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center">Vérification du rôle...</div>;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (!isSupplier) {
    console.log('RequireSupplier → Accès refusé (pas supplier)');
    return <Navigate to="/" replace />;
  }

  return <Outlet />;
};