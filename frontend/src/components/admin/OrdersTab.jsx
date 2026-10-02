import React, { useState } from 'react';
import { useLocale } from '../../context/LocaleContext';
import { formatPrice, formatDate, getStatusColor, getStatusLabel } from '../../lib/utils';

const ORDERS_PER_PAGE = 15;

const OrdersTab = ({ orders, loading }) => {
  const { t, localizeAnon } = useLocale();
  const [statusFilter, setStatusFilter] = useState('all');
  const [page, setPage] = useState(1);

  const filtered = statusFilter === 'all' ? orders : orders.filter((o) => o.status === statusFilter);
  const totalPages = Math.max(1, Math.ceil(filtered.length / ORDERS_PER_PAGE));
  const currentPage = Math.min(page, totalPages);
  const paginated = filtered.slice((currentPage - 1) * ORDERS_PER_PAGE, currentPage * ORDERS_PER_PAGE);

  const handleFilter = (v) => { setStatusFilter(v); setPage(1); };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="text-base font-bold text-slate-900 flex-1 min-w-0">
          Commandes
          <span className="ml-2 text-slate-400 font-normal text-sm">
            ({filtered.length}{filtered.length !== orders.length ? `/${orders.length}` : ''})
          </span>
        </h2>
        <select value={statusFilter} onChange={(e) => handleFilter(e.target.value)}
          className="px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-primary">
          <option value="all">Tous les statuts</option>
          {['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled'].map((s) => (
            <option key={s} value={s}>{getStatusLabel(s)}</option>
          ))}
        </select>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px]">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                {(t('admin.orders.cols') || 'N°,Acheteur,Fournisseur,Montant,Statut,Paiement,Date').split(',').map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? [...Array(ORDERS_PER_PAGE)].map((_, i) => (
                <tr key={i}>{[...Array(7)].map((_, j) => (
                  <td key={j} className="px-4 py-4"><div className="h-4 bg-slate-100 rounded animate-pulse" /></td>
                ))}</tr>
              )) : paginated.length === 0 ? (
                <tr><td colSpan={7} className="px-4 py-12 text-center text-slate-400 text-sm">Aucune commande</td></tr>
              ) : paginated.map((o) => (
                <tr key={o.id} className="hover:bg-slate-50/50">
                  <td className="px-4 py-3 whitespace-nowrap">
                    <p className="font-mono text-xs text-slate-700 font-medium">{o.order_number}</p>
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-700 max-w-[120px] truncate">{localizeAnon(o.buyer_name)}</td>
                  <td className="px-4 py-3 text-sm text-slate-700 max-w-[120px] truncate">{localizeAnon(o.supplier_name)}</td>
                  <td className="px-4 py-3 text-sm font-semibold text-slate-900 whitespace-nowrap">{formatPrice(o.total)}</td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${getStatusColor(o.status)}`}>
                      {getStatusLabel(o.status)}
                    </span>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${getStatusColor(o.payment_status)}`}>
                      {o.payment_status === 'paid' ? t('admin.orders.paid') : t('admin.orders.pending')}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-400 whitespace-nowrap">{formatDate(o.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100 bg-slate-50/50">
            <p className="text-xs text-slate-500">
              {(currentPage - 1) * ORDERS_PER_PAGE + 1}–{Math.min(currentPage * ORDERS_PER_PAGE, filtered.length)} sur {filtered.length}
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

export default OrdersTab;
