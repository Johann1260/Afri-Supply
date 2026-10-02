import React from 'react';
import { Warning, CheckCircle, DeviceMobile, Phone } from '@phosphor-icons/react';
import { useLocale } from '../../context/LocaleContext';
import { formatPrice, formatDate } from '../../lib/utils';

const MobileMoneyTab = ({ items, loading, onConfirm, confirmingId }) => {
  const { t } = useLocale();
  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <h2 className="text-base font-bold text-slate-900 flex-1">{t('admin.momo.title')}</h2>
        {items.length > 0 && (
          <span className="px-3 py-1 bg-orange-100 text-orange-700 text-sm font-semibold rounded-full">
            {items.length} transaction{items.length > 1 ? 's' : ''}
          </span>
        )}
      </div>
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
        <Warning className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" weight="fill" />
        <p className="text-sm text-amber-800">
          <strong>Validation manuelle requise.</strong> Vérifiez sur le portail opérateur (MTN/Orange/Airtel) que le paiement a bien été crédité avant de valider.
        </p>
      </div>
      {loading ? (
        <div className="space-y-3">{[...Array(3)].map((_, i) => <div key={i} className="bg-white border rounded-xl p-5 animate-pulse h-20" />)}</div>
      ) : items.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-xl p-16 text-center">
          <CheckCircle className="w-12 h-12 mx-auto text-green-400 mb-3" weight="fill" />
          <p className="font-semibold text-slate-600">{t('admin.momo.empty')}</p>
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
                    <span className="font-mono text-xs bg-slate-100 px-1.5 py-0.5 rounded">{tx.id?.slice(0, 8).toUpperCase()}</span>
                    <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-orange-50 text-orange-700">{tx.network}</span>
                    <span className="text-xs text-slate-500">{formatDate(tx.created_at)}</span>
                  </div>
                  <p className="text-sm font-semibold text-slate-900 mt-1">{formatPrice(tx.amount)}</p>
                  <p className="text-xs text-slate-500 flex items-center gap-1">
                    <Phone className="w-3 h-3" />{tx.phone_number}
                    {tx.buyer_email && <span className="ml-2">· {tx.buyer_email}</span>}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => onConfirm(tx.id)}
                disabled={confirmingId === tx.id}
                className="shrink-0 flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-sm font-semibold px-4 py-2 rounded-lg"
              >
                <CheckCircle className="w-4 h-4" weight="fill" />
                {confirmingId === tx.id ? t('admin.suppliers.processing') : t('admin.momo.confirm')}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default MobileMoneyTab;
