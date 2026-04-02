import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import DashboardBuyer from './DashboardBuyer';
import DashboardSupplier from './DashboardSupplier';

export default function DashboardRedirect() {
  const { loading, isAuthenticated, isBuyer, isSupplier, user } = useAuth();

  console.log("DashboardRedirect →", { 
    loading, 
    isAuthenticated, 
    isBuyer, 
    isSupplier, 
    user_type: user?.user_type 
  });

  // 1. Tant que loading est true → on attend
  if (loading) {
    return (
      <div style={{ padding: '120px', textAlign: 'center' }}>
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-600 mx-auto"></div>
        <p className="mt-6 text-lg">Vérification de la session...</p>
      </div>
    );
  }

  // 2. Si pas authentifié → login
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  // 3. Si on est authentifié → on regarde le rôle (avec tolérance)
  const userType = (user?.user_type || '').trim().toLowerCase();

  if (isSupplier || userType === 'supplier' || userType.includes('supplier')) {
    console.log("→ Rendu DashboardSupplier");
    return <DashboardSupplier />;
  }

  if (isBuyer || userType === 'buyer') {
    console.log("→ Rendu DashboardBuyer");
    return <DashboardBuyer />;
  }

  // Fallback
  console.log("→ Rôle non reconnu");
  return <Navigate to="/" replace />;
}