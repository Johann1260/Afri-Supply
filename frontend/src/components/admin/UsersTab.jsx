import React, { useState } from 'react';
import { MagnifyingGlass } from '@phosphor-icons/react';
import { useLocale } from '../../context/LocaleContext';
import { formatDate } from '../../lib/utils';
import { adminMgmtAPI } from '../../lib/api';
import { toast } from 'sonner';
import { StatusBadge } from './shared';

const USERS_PER_PAGE = 15;

const UserActions = ({ u, onRefresh }) => {
  const { t } = useLocale();
  const [busy, setBusy] = useState(false);

  async function run(fn, successMsg) {
    setBusy(true);
    try { await fn(); toast.success(successMsg); onRefresh(); }
    catch (err) { toast.error(err.response?.data?.detail || 'Erreur'); }
    finally { setBusy(false); }
  }

  if (u.user_type === 'admin') return <span className="text-xs text-slate-400 italic">{t('admin.users.type.admin')}</span>;

  return (
    <div className="flex flex-wrap items-center gap-1">
      {['suspended', 'banned', 'rejected'].includes(u.account_status) && (
        <button disabled={busy} onClick={() => run(() => adminMgmtAPI.reactivateUser(u.id), t('admin.action.reactivate'))}
          className="px-2 py-1 bg-green-100 text-green-700 rounded text-xs font-medium hover:bg-green-200 disabled:opacity-50">
          {t('admin.action.reactivate')}
        </button>
      )}
      {u.account_status === 'active' && (
        <button disabled={busy} onClick={() => run(() => adminMgmtAPI.suspendUser(u.id), t('admin.action.suspend'))}
          className="px-2 py-1 bg-amber-100 text-amber-700 rounded text-xs font-medium hover:bg-amber-200 disabled:opacity-50">
          {t('admin.action.suspend')}
        </button>
      )}
      {u.account_status !== 'banned' && (
        <button disabled={busy}
          onClick={() => { if (!window.confirm(`${t('admin.action.ban_confirm')} ${u.full_name} ?`)) return; run(() => adminMgmtAPI.banUser(u.id), t('admin.action.ban')); }}
          className="px-2 py-1 bg-red-100 text-red-700 rounded text-xs font-medium hover:bg-red-200 disabled:opacity-50">
          {t('admin.action.ban')}
        </button>
      )}
    </div>
  );
};

const UsersTab = ({ users, loading, onRefreshUsers }) => {
  const { t } = useLocale();
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [page, setPage] = useState(1);

  const filtered = users.filter((u) => {
    const q = search.toLowerCase();
    const match = !q || u.full_name?.toLowerCase().includes(q) || u.email?.toLowerCase().includes(q) || u.company_name?.toLowerCase().includes(q);
    const typeOk = typeFilter === 'all' || u.user_type === typeFilter;
    return match && typeOk;
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / USERS_PER_PAGE));
  const currentPage = Math.min(page, totalPages);
  const paginated = filtered.slice((currentPage - 1) * USERS_PER_PAGE, currentPage * USERS_PER_PAGE);

  const handleSearch = (v) => { setSearch(v); setPage(1); };
  const handleType   = (v) => { setTypeFilter(v); setPage(1); };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="text-base font-bold text-slate-900 flex-1 min-w-0">
          Utilisateurs
          <span className="ml-2 text-slate-400 font-normal text-sm">
            ({filtered.length}{filtered.length !== users.length ? `/${users.length}` : ''})
          </span>
        </h2>
        <div className="relative">
          <MagnifyingGlass className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input value={search} onChange={(e) => handleSearch(e.target.value)}
            placeholder={t('admin.users.search')}
            className="pl-9 pr-4 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-primary w-44 sm:w-52" />
        </div>
        <select value={typeFilter} onChange={(e) => handleType(e.target.value)}
          className="px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-primary">
          <option value="all">{t('admin.users.all')}</option>
          <option value="buyer">{t('admin.users.buyers')}</option>
          <option value="supplier">{t('admin.users.fournisseurs')}</option>
          <option value="admin">{t('admin.users.admins')}</option>
        </select>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px]">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                {[t('admin.users.col.user'), t('admin.users.col.type'), t('admin.users.col.status'), t('admin.users.col.location'), t('admin.users.col.joined'), t('admin.users.col.actions')].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? [...Array(USERS_PER_PAGE)].map((_, i) => (
                <tr key={i}>{[...Array(6)].map((_, j) => (
                  <td key={j} className="px-4 py-4"><div className="h-4 bg-slate-100 rounded animate-pulse" /></td>
                ))}</tr>
              )) : paginated.length === 0 ? (
                <tr><td colSpan={6} className="px-4 py-12 text-center text-slate-400 text-sm">{t('admin.users.no_results')}</td></tr>
              ) : paginated.map((u) => (
                <tr key={u.id} className="hover:bg-slate-50/50">
                  <td className="px-4 py-4 min-w-[160px]">
                    <p className="font-medium text-slate-900 text-sm truncate max-w-[200px]">{u.full_name}</p>
                    <p className="text-xs text-slate-400 truncate max-w-[200px]">{u.email}</p>
                    {u.company_name && <p className="text-xs text-slate-500 mt-0.5 truncate max-w-[200px]">{u.company_name}</p>}
                    {u.anonymous_id && <p className="text-xs font-mono text-teal-600 mt-0.5">{u.anonymous_id}</p>}
                  </td>
                  <td className="px-4 py-4 whitespace-nowrap">
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                      u.user_type === 'supplier' ? 'bg-blue-50 text-blue-700' :
                      u.user_type === 'admin'    ? 'bg-purple-50 text-purple-700' :
                      'bg-slate-100 text-slate-600'
                    }`}>
                      {u.user_type === 'supplier' ? t('admin.users.type.supplier') :
                       u.user_type === 'admin'    ? t('admin.users.type.admin') :
                       t('admin.users.type.buyer')}
                    </span>
                  </td>
                  <td className="px-4 py-4 whitespace-nowrap"><StatusBadge status={u.account_status || 'active'} /></td>
                  <td className="px-4 py-4 text-sm text-slate-500 whitespace-nowrap">{u.city ? `${u.city}, ` : ''}{u.country || '—'}</td>
                  <td className="px-4 py-4 text-xs text-slate-400 whitespace-nowrap">{formatDate(u.created_at)}</td>
                  <td className="px-4 py-4 whitespace-nowrap"><UserActions u={u} onRefresh={onRefreshUsers || (() => {})} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100 bg-slate-50/50">
            <p className="text-xs text-slate-500">
              {(currentPage - 1) * USERS_PER_PAGE + 1}–{Math.min(currentPage * USERS_PER_PAGE, filtered.length)} sur {filtered.length}
            </p>
            <div className="flex items-center gap-1">
              <button onClick={() => setPage(1)} disabled={currentPage === 1}
                className="px-2 py-1 rounded text-xs text-slate-600 hover:bg-slate-200 disabled:opacity-30">«</button>
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}
                className="px-2 py-1 rounded text-xs text-slate-600 hover:bg-slate-200 disabled:opacity-30">‹</button>
              {Array.from({ length: totalPages }, (_, i) => i + 1)
                .filter(p => p === 1 || p === totalPages || Math.abs(p - currentPage) <= 1)
                .reduce((acc, p, i, arr) => { if (i > 0 && p - arr[i - 1] > 1) acc.push('…'); acc.push(p); return acc; }, [])
                .map((p, i) => p === '…'
                  ? <span key={`e${i}`} className="px-1 text-xs text-slate-400">…</span>
                  : <button key={p} onClick={() => setPage(p)}
                      className={`w-7 h-7 rounded text-xs font-medium transition-colors ${p === currentPage ? 'bg-primary text-white' : 'text-slate-600 hover:bg-slate-200'}`}
                    >{p}</button>
                )
              }
              <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}
                className="px-2 py-1 rounded text-xs text-slate-600 hover:bg-slate-200 disabled:opacity-30">›</button>
              <button onClick={() => setPage(totalPages)} disabled={currentPage === totalPages}
                className="px-2 py-1 rounded text-xs text-slate-600 hover:bg-slate-200 disabled:opacity-30">»</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default UsersTab;
