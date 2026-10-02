import React, { useState, useEffect, useCallback } from 'react';
import { ArrowLeft, CheckCircle, Phone, DeviceMobile, Wallet, SpinnerGap } from '@phosphor-icons/react';
import { Link } from 'react-router-dom';
import { adminAPI } from '../lib/api';
import { useLocale } from '../context/LocaleContext';
import { useAuth } from '../context/AuthContext';
import { formatPrice, formatDate } from '../lib/utils';
import { toast } from 'sonner';

/**
 * Admin page : valider manuellement les paiements Mobile Money en attente.
 * L'admin doit avoir vérifié sur le portail opérateur (MTN/Orange/Airtel)
 * que le paiement a bien été crédité avant de cliquer "Valider".
 */
export default function AdminMobileMoneyPage() {
  const { t } = useLocale();
  const { user } = useAuth();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [confirming, setConfirming] = useState(null);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const { data } = await adminAPI.getPendingMomo();
      setItems(Array.isArray(data) ? data : []);
    } catch (e) {
      toast.error(e?.response?.data?.detail || t('common.error'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => { load(); }, [load]);

  const onConfirm = async (txId) => {
    if (!window.confirm(`${t('admin.momo.confirm')} ?`)) return;
    try {
      setConfirming(txId);
      await adminAPI.confirmMomo(txId);
      toast.success(t('admin.momo.confirmed'));
      setItems(prev => prev.filter(i => i.id !== txId));
    } catch (e) {
      toast.error(e?.response?.data?.detail || t('common.error'));
    } finally {
      setConfirming(null);
    }
  };

  if (!user || user.user_type !== 'admin') {
    return <div className="p-8 text-center text-slate-500">403</div>;
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-5xl mx-auto px-4 py-8">
        <Link to="/admin" className="inline-flex items-center gap-2 text-sm text-slate-600 hover:text-slate-900 mb-6">
          <ArrowLeft className="w-4 h-4" /> {t('common.back')}
        </Link>

        <header className="mb-8">
          <div className="inline-flex items-center gap-2 mb-2">
            <Wallet className="w-5 h-5 text-orange-600" />
            <span className="text-xs font-semibold uppercase tracking-wider text-orange-600">
              {t('admin.momo.cta')}
            </span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900">{t('admin.momo.title')}</h1>
          <p className="text-sm text-slate-500 mt-1">
            {items.length} {items.length > 1 ? 'transactions' : 'transaction'}
          </p>
        </header>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <SpinnerGap className="w-6 h-6 animate-spin text-slate-400" />
          </div>
        ) : items.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-xl p-12 text-center">
            <CheckCircle className="w-10 h-10 text-emerald-500 mx-auto mb-3" weight="fill" />
            <p className="text-slate-600">{t('admin.momo.empty')}</p>
          </div>
        ) : (
          <div className="space-y-3">
            {items.map(tx => (
              <div key={tx.id} className="bg-white border border-slate-200 rounded-xl p-5 flex items-center justify-between gap-4">
                <div className="flex items-center gap-4 min-w-0 flex-1">
                  <div className="w-10 h-10 rounded-lg bg-orange-50 flex items-center justify-center shrink-0">
                    <DeviceMobile className="w-5 h-5 text-orange-600" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono text-xs bg-slate-100 px-1.5 py-0.5 rounded text-slate-600">
                        {tx.id.slice(0, 8).toUpperCase()}
                      </span>
                      <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-orange-50 text-orange-700">
                        {tx.network}
                      </span>
                      <span className="text-xs text-slate-500">{formatDate(tx.created_at)}</span>
                    </div>
                    <p className="text-sm font-semibold text-slate-900 mt-1 truncate">
                      {formatPrice(tx.amount)}
                    </p>
                    <p className="text-xs text-slate-500 truncate inline-flex items-center gap-1">
                      <Phone className="w-3 h-3" /> {tx.phone_number}
                      {tx.buyer_email && <span className="ml-2 truncate">· {tx.buyer_email}</span>}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => onConfirm(tx.id)}
                  disabled={confirming === tx.id}
                  className="shrink-0 inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors"
                >
                  {confirming === tx.id ? (
                    <SpinnerGap className="w-4 h-4 animate-spin" />
                  ) : (
                    <CheckCircle className="w-4 h-4" weight="fill" />
                  )}
                  {t('admin.momo.confirm')}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
