import React from 'react';
import { CheckCircle } from '@phosphor-icons/react';
import { useLocale } from '../../context/LocaleContext';
import { formatPrice, formatDate } from '../../lib/utils';

const EscrowTab = ({ escrows, disputes, loading }) => {
  const { t } = useLocale();
  return (
    <div className="space-y-8">
      <div>
        <div className="flex items-center gap-3 mb-4">
          <h2 className="text-base font-bold text-slate-900 flex-1">{t('admin.escrow.held_title')}</h2>
          {escrows.length > 0 && (
            <span className="px-3 py-1 bg-blue-100 text-blue-700 text-sm font-semibold rounded-full">
              {escrows.length} escrow{escrows.length !== 1 ? 's' : ''}
            </span>
          )}
        </div>
        {loading ? (
          <div className="space-y-3">{[...Array(3)].map((_, i) => <div key={i} className="bg-white border rounded-xl p-5 animate-pulse h-20" />)}</div>
        ) : escrows.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-xl p-12 text-center">
            <CheckCircle className="w-10 h-10 mx-auto text-green-400 mb-3" weight="fill" />
            <p className="font-semibold text-slate-600">{t('admin.escrow.no_escrow')}</p>
          </div>
        ) : (
          <div className="space-y-3">
            {escrows.map((e) => (
              <div key={e.id} className="bg-white border border-slate-200 rounded-xl p-5 flex flex-wrap items-center gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span className="font-mono text-xs bg-slate-100 px-1.5 py-0.5 rounded">{e.id?.slice(0, 8).toUpperCase()}</span>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                      e.status === 'held'     ? 'bg-blue-100 text-blue-700' :
                      e.status === 'released' ? 'bg-green-100 text-green-700' :
                      e.status === 'disputed' ? 'bg-red-100 text-red-700' :
                      'bg-slate-100 text-slate-600'
                    }`}>{e.status}</span>
                    <span className="text-xs text-slate-400">{formatDate(e.created_at)}</span>
                  </div>
                  <p className="text-sm font-semibold text-slate-900">{formatPrice(e.amount)}</p>
                  {e.hold_until && <p className="text-xs text-slate-400">{t('admin.escrow.expires')} {formatDate(e.hold_until)}</p>}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div>
        <div className="flex items-center gap-3 mb-4">
          <h2 className="text-base font-bold text-slate-900 flex-1">{t('admin.escrow.disputes_title')}</h2>
          {disputes.length > 0 && (
            <span className="px-3 py-1 bg-red-100 text-red-700 text-sm font-semibold rounded-full">
              {disputes.length} litige{disputes.length !== 1 ? 's' : ''}
            </span>
          )}
        </div>
        {loading ? (
          <div className="space-y-3">{[...Array(2)].map((_, i) => <div key={i} className="bg-white border rounded-xl p-5 animate-pulse h-20" />)}</div>
        ) : disputes.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-xl p-12 text-center">
            <CheckCircle className="w-10 h-10 mx-auto text-green-400 mb-3" weight="fill" />
            <p className="font-semibold text-slate-600">{t('admin.escrow.no_disputes')}</p>
          </div>
        ) : (
          <div className="space-y-3">
            {disputes.map((d, i) => (
              <div key={d.id || i} className="bg-white border border-red-100 rounded-xl p-5">
                <div className="flex items-center gap-2 flex-wrap mb-2">
                  <span className="font-mono text-xs bg-slate-100 px-1.5 py-0.5 rounded">{d.id?.slice(0, 8).toUpperCase()}</span>
                  <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700">{d.status || 'open'}</span>
                  <span className="text-xs text-slate-400">{formatDate(d.created_at)}</span>
                </div>
                <p className="text-sm text-slate-700">{d.reason || d.description || '—'}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default EscrowTab;
