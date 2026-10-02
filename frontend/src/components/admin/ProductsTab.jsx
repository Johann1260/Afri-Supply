import React, { useState } from 'react';
import { Package, CheckCircle, XCircle } from '@phosphor-icons/react';
import { useLocale } from '../../context/LocaleContext';
import { formatPrice, formatDate } from '../../lib/utils';
import { adminAPI } from '../../lib/api';
import { toast } from 'sonner';
import { Skeleton } from '../ui/skeleton';
import { BACKEND_URL } from './shared';

const OrphanProductsPanel = () => {
  const { t } = useLocale();
  const [orphans, setOrphans] = React.useState(null);
  const [busy, setBusy] = React.useState(false);
  const [open, setOpen] = React.useState(false);

  const load = async () => {
    setBusy(true);
    try { const r = await adminAPI.getOrphanProducts(); setOrphans(r.data); setOpen(true); }
    catch { toast.error(t('admin.diag.err')); }
    finally { setBusy(false); }
  };

  const deleteAll = async () => {
    if (!window.confirm(`Supprimer ${orphans?.total_orphan_products} produit(s) orphelins ? Action irréversible.`)) return;
    setBusy(true);
    try {
      const r = await adminAPI.deleteOrphanProducts();
      toast.success(`${r.data.deleted} produit(s) supprimés`);
      setOrphans(null); setOpen(false);
    } catch { toast.error('Erreur suppression'); }
    finally { setBusy(false); }
  };

  return (
    <div className="mb-5 border border-amber-200 bg-amber-50 rounded-xl p-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-amber-800">{t('admin.orphans.title')}</p>
          <p className="text-xs text-amber-600 mt-0.5">Produits dont le fournisseur n'existe plus en base</p>
        </div>
        <button onClick={load} disabled={busy}
          className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white text-xs font-medium rounded-lg disabled:opacity-40">
          {busy ? '...' : '🔍 Diagnostiquer'}
        </button>
      </div>
      {open && orphans && (
        <div className="mt-4 pt-4 border-t border-amber-200">
          {orphans.total_orphan_products === 0 ? (
            <p className="text-sm text-green-700 font-medium">✓ {t('admin.orphans.none')}</p>
          ) : (
            <>
              <p className="text-sm font-semibold text-red-700 mb-2">
                {orphans.total_orphan_products} produit(s) orphelins sur {orphans.orphan_groups.length} supplier_id invalide(s)
              </p>
              <div className="space-y-2 max-h-48 overflow-y-auto mb-3">
                {orphans.orphan_groups.map(g => (
                  <div key={g.orphan_supplier_id} className="bg-white rounded-lg border border-red-100 p-3">
                    <p className="text-xs font-mono text-red-500 mb-1">supplier_id fantôme : {g.orphan_supplier_id.slice(0, 16)}…</p>
                    <div className="flex flex-wrap gap-1">
                      {g.products.map(p => (
                        <span key={p.id} className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded">{p.name}</span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
              <button onClick={deleteAll} disabled={busy}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-medium rounded-lg disabled:opacity-40">
                {busy ? '...' : `🗑 Supprimer les ${orphans.total_orphan_products} produits orphelins`}
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
};

const ProductsTab = ({ products, loading, onApprove, onReject, actionId }) => {
  const { t } = useLocale();
  const [filter, setFilter] = useState('pending');
  const filtered = React.useMemo(() => products.filter(p => {
    if (filter === 'pending')  return p.is_approved === false && p.is_available !== false;
    if (filter === 'approved') return p.is_approved === true;
    return true;
  }), [products, filter]);

  return (
    <div>
      <OrphanProductsPanel />
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <h2 className="text-base font-bold text-slate-900">{t('admin.tab.products')} ({filtered.length})</h2>
        <div className="flex gap-1 bg-slate-100 rounded-lg p-1">
          {[
            { id: 'pending',  label: t('admin.status.pending_review') },
            { id: 'approved', label: t('product.status.approved') },
            { id: 'all',      label: t('admin.users.all') },
          ].map(f => (
            <button key={f.id} onClick={() => setFilter(f.id)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                filter === f.id ? 'bg-white text-primary shadow-sm' : 'text-slate-600 hover:text-slate-900'
              }`}>
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="space-y-3">{[1, 2, 3].map(i => <Skeleton key={i} className="h-20" />)}</div>
      ) : filtered.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-xl p-12 text-center">
          <Package className="w-12 h-12 mx-auto text-slate-300 mb-3" weight="duotone" />
          <p className="font-semibold text-slate-600">{t('admin.no_pending')}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(p => (
            <div key={p.id} className="bg-white border border-slate-200 rounded-xl p-5 flex items-center gap-4">
              <div className="w-14 h-14 rounded-lg bg-slate-100 overflow-hidden shrink-0">
                {p.images?.[0] ? (
                  <img src={p.images[0].startsWith('http') ? p.images[0] : `${BACKEND_URL}${p.images[0]}`}
                    alt={p.name} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-slate-300">
                    <Package className="w-6 h-6" />
                  </div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-slate-900 truncate">{p.name}</p>
                <p className="text-sm text-slate-500">{formatPrice(p.price)} · {p.unit}</p>
                <div className="flex gap-2 mt-1 text-[11px] text-slate-400">
                  <span className="font-mono">{p.id?.slice(0, 8).toUpperCase()}</span>
                  <span>· {formatDate(p.created_at)}</span>
                </div>
              </div>
              <div className="flex gap-2 shrink-0">
                {!p.is_approved && (
                  <button type="button" disabled={actionId === p.id} onClick={() => onApprove(p.id)}
                    className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-semibold rounded-lg flex items-center gap-1">
                    <CheckCircle className="w-3.5 h-3.5" /> {t('admin.products.approve')}
                  </button>
                )}
                {p.is_approved && (
                  <button type="button" disabled={actionId === p.id} onClick={() => onReject(p.id)}
                    className="px-3 py-1.5 bg-red-100 hover:bg-red-200 disabled:opacity-50 text-red-700 text-xs font-semibold rounded-lg flex items-center gap-1">
                    <XCircle className="w-3.5 h-3.5" /> {t('admin.products.reject')}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default ProductsTab;
