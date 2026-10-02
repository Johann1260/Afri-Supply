import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { FileText, DownloadSimple, MagnifyingGlass, Receipt, Eye } from '@phosphor-icons/react';
import { Layout } from '../components/layout';
import { Button } from '../components/ui/button';
import { useAuth } from '../context/AuthContext';
import { useLocale } from '../context/LocaleContext';
import { ordersAPI } from '../lib/api';
import { formatPrice, formatDate, getStatusColor } from '../lib/utils';
import { toast } from 'sonner';

export default function InvoicesPage() {
  const { isAuthenticated } = useAuth();
  const { t, localizeAnon } = useLocale();
  const [orders, setOrders]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch]   = useState('');
  const [downloading, setDownloading] = useState(null);

  useEffect(() => {
    ordersAPI.getAll()
      .then((r) => setOrders((r.data || []).filter((o) => o.payment_status === 'paid')))
      .catch(() => {})
      .catch((err) => { console.error(err); toast.error(t('common.error')); })
      .finally(() => setLoading(false));
  }, [t]);

  const handleDownload = (orderId, orderNumber) => {
    setDownloading(orderId);
    const url = ordersAPI.getInvoice(orderId);
    window.open(url, '_blank');
    setTimeout(() => setDownloading(null), 2000);
    toast.success(`${t('invoices.download')} ${orderNumber} ${t('invoices.downloaded.msg')}`);
  };

  const filtered = orders.filter((o) =>
    !search || o.order_number?.toLowerCase().includes(search.toLowerCase()) ||
    o.supplier_name?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <Layout>
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="font-heading font-bold text-2xl text-slate-900 flex items-center gap-3">
              <Receipt className="w-7 h-7 text-primary" weight="duotone" />
              {t('invoices.title')}
            </h1>
            <p className="text-slate-500 text-sm mt-1">
              {t('invoices.subtitle')}
            </p>
          </div>
          <div className="relative hidden sm:block">
            <MagnifyingGlass className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t('invoices.search')}
              className="pl-9 pr-4 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-primary w-56"
            />
          </div>
        </div>

        {loading ? (
          <div className="space-y-3">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="bg-white border border-slate-200 rounded-xl p-6 animate-pulse">
                <div className="flex justify-between">
                  <div className="space-y-2">
                    <div className="h-4 bg-slate-200 rounded w-32" />
                    <div className="h-3 bg-slate-100 rounded w-48" />
                  </div>
                  <div className="h-8 bg-slate-200 rounded w-32" />
                </div>
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-xl p-16 text-center">
            <FileText className="w-16 h-16 mx-auto text-slate-300 mb-4" weight="duotone" />
            <p className="font-semibold text-slate-600 text-lg">
              {search ? t('invoices.notFound') : t('invoices.empty')}
            </p>
            <p className="text-slate-400 text-sm mt-2">
              {search ? t('invoices.notFound.sub') : t('invoices.empty.sub')}
            </p>
            {!search && (
              <Link to="/products">
                <Button className="mt-6 bg-accent hover:bg-accent-hover">
                  {t('dash.buyer.explore')}
                </Button>
              </Link>
            )}
          </div>
        ) : (
          <>
            {/* Total */}
            <div className="bg-primary/5 border border-primary/20 rounded-xl px-6 py-4 mb-6 flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600">{filtered.length} {t('invoices.count')}</p>
                <p className="font-bold text-primary text-lg">
                  {formatPrice(filtered.reduce((s, o) => s + o.total, 0))} {t('invoices.total')}
                </p>
              </div>
              <Receipt className="w-8 h-8 text-primary/30" weight="duotone" />
            </div>

            {/* Liste */}
            <div className="space-y-3">
              {filtered.map((order) => (
                <div
                  key={order.id}
                  className="bg-white border border-slate-200 hover:border-slate-300 rounded-xl px-6 py-5 flex items-center gap-4 transition-colors"
                >
                  {/* Icône */}
                  <div className="w-10 h-10 bg-red-50 rounded-lg flex items-center justify-center flex-shrink-0">
                    <FileText className="w-5 h-5 text-red-500" weight="duotone" />
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 flex-wrap">
                      <p className="font-mono font-bold text-slate-900 text-sm">{order.order_number}</p>
                      <span className="px-2 py-0.5 bg-green-100 text-green-700 text-xs font-medium rounded-full">
                        {t('invoices.paid')}
                      </span>
                    </div>
                    <p className="text-sm text-slate-500 mt-0.5">
                      {localizeAnon(order.supplier_name)} · {formatDate(order.created_at)}
                    </p>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {order.items?.length || 0} article{(order.items?.length || 0) !== 1 ? 's' : ''}
                    </p>
                  </div>

                  {/* Montant */}
                  <div className="text-right flex-shrink-0 hidden sm:block">
                    <p className="font-heading font-bold text-lg text-primary">{formatPrice(order.total)}</p>
                    <p className="text-xs text-slate-400">HT XAF</p>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2 flex-shrink-0">
                    <Link
                      to={`/orders/${order.id}`}
                      className="p-2 border border-slate-200 rounded-lg text-slate-400 hover:text-slate-700 hover:border-slate-300 transition-colors"
                      title={t('invoices.viewOrder')}
                    >
                      <Eye className="w-4 h-4" />
                    </Link>
                    <button
                      onClick={() => handleDownload(order.id, order.order_number)}
                      disabled={downloading === order.id}
                      className="flex items-center gap-2 px-4 py-2 bg-primary hover:bg-primary/90 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
                      title={t('invoices.download')}
                    >
                      <DownloadSimple className="w-4 h-4" />
                      <span className="hidden sm:inline">
                        {downloading === order.id ? t('invoices.downloading') : t('invoices.download')}
                      </span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </Layout>
  );
}
