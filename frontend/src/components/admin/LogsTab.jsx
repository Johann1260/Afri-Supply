import React from 'react';
import { FileText } from '@phosphor-icons/react';
import { useLocale } from '../../context/LocaleContext';
import { formatDate } from '../../lib/utils';
import { adminMgmtAPI } from '../../lib/api';
import { toast } from 'sonner';

const ACTION_COLORS = {
  approve_supplier: 'bg-green-100 text-green-700',
  reject_supplier:  'bg-red-100 text-red-700',
  approve_product:  'bg-green-100 text-green-700',
  reject_product:   'bg-red-100 text-red-700',
  suspend_user:     'bg-amber-100 text-amber-700',
  ban_user:         'bg-red-100 text-red-700',
  reactivate_user:  'bg-green-100 text-green-700',
  reset_password:   'bg-blue-100 text-blue-700',
  create_admin:     'bg-purple-100 text-purple-700',
  update_admin:     'bg-purple-100 text-purple-700',
  deactivate_admin: 'bg-red-100 text-red-700',
  create_actualite: 'bg-blue-100 text-blue-700',
  delete_actualite: 'bg-red-100 text-red-700',
  confirm_momo:     'bg-emerald-100 text-emerald-700',
};

const LIMIT = 50;

const LogsTab = () => {
  const { t } = useLocale();
  const [logs, setLogs]         = React.useState([]);
  const [total, setTotal]       = React.useState(0);
  const [loading, setLoading]   = React.useState(true);
  const [page, setPage]         = React.useState(0);
  const [actionFilter, setActionFilter] = React.useState('');

  const load = React.useCallback(async (p = 0, action = '') => {
    setLoading(true);
    try {
      const r = await adminMgmtAPI.getLogs({ skip: p * LIMIT, limit: LIMIT, ...(action ? { action } : {}) });
      setLogs(r.data.logs || []);
      setTotal(r.data.total || 0);
    } catch { toast.error(t('admin.logs.empty')); }
    finally { setLoading(false); }
  }, [t]);

  React.useEffect(() => { load(page, actionFilter); }, [load, page, actionFilter]);

  const totalPages = Math.max(1, Math.ceil(total / LIMIT));

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3 flex-wrap">
        <h2 className="text-base font-bold text-slate-900 flex-1">{t('admin.logs.title')} ({total})</h2>
        <select value={actionFilter} onChange={e => { setActionFilter(e.target.value); setPage(0); }}
          className="border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none">
          <option value="">{t('admin.logs.all_actions')}</option>
          {Object.keys(ACTION_COLORS).map(k => {
            const label = t(`admin.logs.${k}`);
            return (
              <option key={k} value={k}>
                {label === `admin.logs.${k}` ? k : label}
              </option>
            );
          })}
        </select>
        <button onClick={() => load(page, actionFilter)}
          className="px-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-600 hover:bg-slate-50">
          {t('admin.logs.refresh')}
        </button>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-slate-400">{t('admin.logs.loading')}</div>
        ) : logs.length === 0 ? (
          <div className="p-12 text-center">
            <FileText className="w-10 h-10 mx-auto text-slate-300 mb-3" weight="duotone" />
            <p className="font-semibold text-slate-600">{t('admin.logs.empty')}</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {logs.map((log, i) => {
              const actionLabel = t(`admin.logs.${log.action}`) !== `admin.logs.${log.action}` ? t(`admin.logs.${log.action}`) : log.action;
              const actionColor = ACTION_COLORS[log.action] || 'bg-slate-100 text-slate-600';
              return (
                <div key={log.id || i} className="px-5 py-3.5 flex items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-0.5">
                      <span className={`px-2 py-0.5 rounded text-xs font-semibold ${actionColor}`}>{actionLabel}</span>
                      <span className="text-xs font-medium text-slate-700">{log.admin_name}</span>
                      {log.target_type && <span className="text-xs text-slate-400">→ {log.target_type}</span>}
                    </div>
                    <p className="text-sm text-slate-600">{log.detail}</p>
                  </div>
                  <span className="text-xs text-slate-400 shrink-0 whitespace-nowrap">{formatDate(log.created_at)}</span>
                </div>
              );
            })}
          </div>
        )}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-5 py-3 border-t bg-slate-50/50">
            <p className="text-xs text-slate-500">{t('admin.logs.page')} {page + 1} {t('admin.logs.of')} {totalPages} — {total} {t('admin.logs.entries')}</p>
            <div className="flex gap-1">
              <button onClick={() => setPage(0)} disabled={page === 0} className="px-2 py-1 rounded text-xs text-slate-600 hover:bg-slate-200 disabled:opacity-30">«</button>
              <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0} className="px-2 py-1 rounded text-xs text-slate-600 hover:bg-slate-200 disabled:opacity-30">‹</button>
              <button onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1} className="px-2 py-1 rounded text-xs text-slate-600 hover:bg-slate-200 disabled:opacity-30">›</button>
              <button onClick={() => setPage(totalPages - 1)} disabled={page >= totalPages - 1} className="px-2 py-1 rounded text-xs text-slate-600 hover:bg-slate-200 disabled:opacity-30">»</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default LogsTab;
