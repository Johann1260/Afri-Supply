import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { useLocale } from '@/context/LocaleContext';

export default function DashboardRedirect() {
  const { loading, isAuthenticated, isBuyer, isSupplier } = useAuth();
  const { t } = useLocale();

  if (loading) {
    return (
      <div style={{ padding: '120px', textAlign: 'center' }}>
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-600 mx-auto" />
        <p className="mt-6 text-lg text-slate-500">{t('common.loading')}</p>
      </div>
    );
  }

  if (!isAuthenticated) return <Navigate to="/login" replace />;

  // Rediriger vers les routes protégées par leurs guards respectifs
  if (isSupplier) return <Navigate to="/dashboard/supplier" replace />;
  if (isBuyer)    return <Navigate to="/dashboard/buyer" replace />;

  // Rôle inconnu
  return <Navigate to="/" replace />;
}