import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { useLocale } from '@/context/LocaleContext';

export default function DashboardRedirect() {
  const { loading, isAuthenticated, isBuyer, isSupplier, accountStatus } = useAuth();
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

  // Bloquer les comptes en attente de validation
  if (accountStatus === 'pending_review' || accountStatus === 'pending_email') {
    return (
      <div className="min-h-screen flex items-center justify-center p-8 text-center">
        <div>
          <p className="text-4xl mb-4">⏳</p>
          <h2 className="font-bold text-xl text-slate-800 mb-2">Compte en cours de vérification</h2>
          <p className="text-slate-500 max-w-sm">Votre compte est en attente de validation (48h). Vous recevrez un email à l'activation.</p>
        </div>
      </div>
    );
  }

  if (isSupplier) return <Navigate to="/dashboard/supplier" replace />;
  if (isBuyer)    return <Navigate to="/dashboard/buyer" replace />;
  return <Navigate to="/" replace />;
}