import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { useLocale } from '@/context/LocaleContext';
import DashboardBuyer from './DashboardBuyer';
import DashboardSupplier from './DashboardSupplier';

export default function DashboardRedirect() {
  const { loading, isAuthenticated, isBuyer, isSupplier, user } = useAuth();
  const { t } = useLocale();

  // Attendre la résolution de la session
  if (loading) {
    return (
      <div style={{ padding: '120px', textAlign: 'center' }}>
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-600 mx-auto" />
        <p className="mt-6 text-lg text-slate-500">{t('common.loading')}</p>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  const userType = (user?.user_type || '').trim().toLowerCase();

  if (isSupplier || userType === 'supplier' || userType.includes('supplier')) {
    return <DashboardSupplier />;
  }

  if (isBuyer || userType === 'buyer') {
    return <DashboardBuyer />;
  }

  return <Navigate to="/" replace />;
}