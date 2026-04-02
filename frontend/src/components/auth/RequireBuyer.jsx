// src/components/auth/RequireBuyer.jsx
import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

export const RequireBuyer = () => {
  const { isAuthenticated, isBuyer, loading } = useAuth();

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center">Vérification du rôle...</div>;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (!isBuyer) {
    return <Navigate to="/" replace />;
  }

  return <Outlet />;
};