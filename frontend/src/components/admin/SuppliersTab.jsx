import React from 'react';
import {
  Buildings, Envelope, Phone, MapPin, Calendar, FileText,
  CheckCircle, XCircle,
} from '@phosphor-icons/react';
import { useLocale } from '../../context/LocaleContext';
import { formatDate } from '../../lib/utils';
import { StatusBadge, BACKEND_URL } from './shared';

const SuppliersTab = ({ suppliers, onApprove, onReject, loadingId, onBadge }) => {
  const { t } = useLocale();
  const [badgingId, setBadgingId] = React.useState(null);

  const ASSIGNABLE_BADGES = React.useMemo(() => [
    { key: 'certified',         label: t('admin.suppliers.badge.certified') },
    { key: 'docs_verified',     label: t('admin.suppliers.badge.docs_verified') },
    { key: 'identity_verified', label: t('admin.suppliers.badge.identity_verified') },
  // eslint-disable-next-line react-hooks/exhaustive-deps
  ], [t]);

  const pending  = suppliers.filter(s => s.account_status === 'pending_review');
  const approved = suppliers.filter(s => s.account_status === 'active');

  const handleBadge = async (supplierId, badge, action) => {
    setBadgingId(supplierId + badge);
    try { await onBadge(supplierId, badge, action); }
    finally { setBadgingId(null); }
  };

  const SupplierCard = ({ s }) => (
    <div className="bg-white border border-slate-200 rounded-xl p-6">
      <div className="flex items-start gap-4">
        <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center flex-shrink-0">
          <Buildings className="w-6 h-6 text-primary" weight="duotone" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <div>
              <h3 className="font-bold text-slate-900">{s.company_name || s.full_name}</h3>
              {s.anonymous_id && (
                <p className="text-xs font-mono text-teal-600 mt-0.5">
                  {s.anonymous_id}
                  {(s.badges || []).slice(0, 4).map(b => {
                    const icons = { verified:'✓', docs_verified:'📄', identity_verified:'🪪', certified:'🏅', gold:'🥇', silver:'🥈', platinum:'💎', top_rated:'⭐', quick_responder:'⚡', trade_assurance:'🛡️' };
                    return <span key={b} className="ml-1" title={b}>{icons[b] || '•'}</span>;
                  })}
                </p>
              )}
            </div>
            <StatusBadge status={s.account_status} />
          </div>
          <div className="grid grid-cols-2 gap-x-6 gap-y-1 mt-2 text-xs text-slate-500">
            {s.email && <span className="flex items-center gap-1"><Envelope className="w-3 h-3" />{s.email}</span>}
            {s.phone && <span className="flex items-center gap-1"><Phone className="w-3 h-3" />{s.phone}</span>}
            {s.city  && <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{s.city}, {s.country}</span>}
            <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />{t('admin.suppliers.registered')} {formatDate(s.created_at)}</span>
          </div>
          {s.nui && <p className="text-xs text-slate-500 mt-1">NUI: <span className="font-mono font-semibold text-slate-700">{s.nui}</span></p>}
          {s.rc_number && <p className="text-xs text-slate-500">RC: <span className="font-mono font-semibold text-slate-700">{s.rc_number}</span></p>}

          {s.company_documents?.length > 0 && (
            <div className="mt-3">
              <p className="text-xs font-semibold text-slate-600 mb-1.5">{s.company_documents.length} {s.company_documents.length !== 1 ? t('admin.suppliers.docs_submitted_pl') : t('admin.suppliers.docs_submitted')} :</p>
              <div className="flex flex-wrap gap-2">
                {s.company_documents.map((doc, i) => (
                  <a key={i} href={`${BACKEND_URL}${doc}`} target="_blank" rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg text-xs font-medium transition-colors">
                    <FileText className="w-3.5 h-3.5 text-red-500" />Document {i + 1}
                  </a>
                ))}
              </div>
            </div>
          )}

          {s.account_status === 'active' && (
            <div className="mt-3 pt-3 border-t border-slate-100">
              <p className="text-xs font-semibold text-slate-500 mb-2">{t('admin.suppliers.manual_badges')}</p>
              <div className="flex flex-wrap gap-2">
                {ASSIGNABLE_BADGES.map(({ key, label }) => {
                  const has = (s.admin_badges || []).includes(key);
                  const isLoading = badgingId === (s.id + key);
                  if (has) {
                    return (
                      <span key={key} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-primary/10 border border-primary/30 text-primary">
                        <span>✓ {label}</span>
                        <button disabled={isLoading} onClick={() => handleBadge(s.id, key, 'remove')}
                          className="ml-0.5 text-primary/60 hover:text-red-500 transition-colors disabled:opacity-40">
                          {isLoading ? '…' : '×'}
                        </button>
                      </span>
                    );
                  }
                  return (
                    <button key={key} disabled={isLoading} onClick={() => handleBadge(s.id, key, 'add')}
                      className="px-2.5 py-1 rounded-full text-xs font-medium border bg-slate-100 border-slate-200 text-slate-500 hover:border-primary/30 transition-all disabled:opacity-40">
                      {isLoading ? '...' : `+ ${label}`}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {s.account_status === 'pending_review' && (
          <div className="flex gap-2 flex-shrink-0 pt-1">
            <button onClick={() => onReject(s.id)} disabled={loadingId === s.id}
              className="flex items-center gap-1.5 px-4 py-2 border border-red-200 text-red-600 hover:bg-red-50 rounded-lg text-sm font-medium transition-colors disabled:opacity-40">
              <XCircle className="w-4 h-4" />{t('admin.reject')}
            </button>
            <button onClick={() => onApprove(s.id)} disabled={loadingId === s.id}
              className="flex items-center gap-1.5 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-40">
              <CheckCircle className="w-4 h-4" />{loadingId === s.id ? t('admin.suppliers.processing') : t('admin.approve')}
            </button>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-slate-900">{t('admin.suppliers.pending_title')}</h2>
          <span className="px-3 py-1 bg-amber-100 text-amber-700 text-sm font-semibold rounded-full">
            {pending.length} {pending.length !== 1 ? t('admin.suppliers.files') : t('admin.suppliers.file')}
          </span>
        </div>
        {pending.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-xl p-12 text-center">
            <CheckCircle className="w-10 h-10 mx-auto text-green-400 mb-3" weight="fill" />
            <p className="font-semibold text-slate-600">{t('admin.suppliers.no_pending')}</p>
          </div>
        ) : pending.map(s => <SupplierCard key={s.id} s={s} />)}
      </div>

      {approved.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-slate-900">{t('admin.suppliers.approved_title')}</h2>
            <span className="px-3 py-1 bg-green-100 text-green-700 text-sm font-semibold rounded-full">{approved.length}</span>
          </div>
          {approved.map(s => <SupplierCard key={s.id} s={s} />)}
        </div>
      )}
    </div>
  );
};

export default SuppliersTab;
