import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  ArrowLeft, CheckCircle, XCircle, ChatCircle, Package,
  ClockCountdown, Spinner, Trophy, Warning, CurrencyDollar,
  Truck, Seal, ArrowRight
} from '@phosphor-icons/react';
import { Layout } from '../components/layout';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { useAuth } from '../context/AuthContext';
import { useLocale } from '../context/LocaleContext';
import { rfqAPI, quotationsAPI } from '../lib/api';
import { formatPrice } from '../lib/utils';
import { toast } from 'sonner';

// ── status helpers ────────────────────────────────────────────────────────────
const STATUS_COLOR = {
  open:      'bg-blue-100 text-blue-800',
  comparing: 'bg-yellow-100 text-yellow-800',
  accepted:  'bg-green-100 text-green-800',
  ordered:   'bg-purple-100 text-purple-800',
  cancelled: 'bg-red-100 text-red-800',
  closed:    'bg-gray-100 text-gray-700',
};
const QUOTE_STATUS_COLOR = {
  pending:  'bg-yellow-100 text-yellow-800',
  accepted: 'bg-green-100 text-green-800',
  rejected: 'bg-red-100 text-red-700',
};

function StatusBadge({ status, map }) {
  const color = (map || STATUS_COLOR)[status] || 'bg-gray-100 text-gray-700';
  return <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${color}`}>{status}</span>;
}

// ── Quotation comparison table ────────────────────────────────────────────────
function QuotationsTable({ quotes, rfq, isBuyer, onAccept, onReject, onMessage, accepting, localizeAnon }) {
  if (!quotes.length) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-gray-400">
          <ClockCountdown size={40} className="mx-auto mb-2 opacity-30" />
          <p>{t('rfq.detail.waiting')}</p>
        </CardContent>
      </Card>
    );
  }

  const best = Math.min(...quotes.map(q => q.unit_price));

  return (
    <div className="space-y-3">
      <h2 className="text-base font-semibold">
        {quotes.length} devis reçu{quotes.length > 1 ? 's' : ''}
      </h2>
      <div className="overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="bg-gray-50 text-gray-500 text-left">
              <th className="px-3 py-2 font-medium">Fournisseur</th>
              <th className="px-3 py-2 font-medium text-right">Prix unitaire</th>
              <th className="px-3 py-2 font-medium text-right">Total</th>
              <th className="px-3 py-2 font-medium text-center">Délai</th>
              <th className="px-3 py-2 font-medium text-center">Validité</th>
              <th className="px-3 py-2 font-medium">Statut</th>
              {isBuyer && rfq.status === 'comparing' && <th className="px-3 py-2" />}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {quotes.map(q => {
              const isBest = q.unit_price === best && q.status !== 'rejected';
              return (
                <tr key={q.id} className={`${q.status === 'accepted' ? 'bg-green-50' : ''} hover:bg-gray-50 transition-colors`}>
                  <td className="px-3 py-3">
                    <div className="flex items-center gap-2">
                      {isBest && q.status !== 'rejected' && (
                        <Trophy size={14} className="text-yellow-500 shrink-0" />
                      )}
                      <span className="font-mono text-xs text-gray-600">{localizeAnon(q.supplier_name) || localizeAnon('Partenaire-???')}</span>
                    </div>
                    {q.moq && <div className="text-xs text-gray-400 mt-0.5">MOQ: {q.moq}</div>}
                    {q.conditions && <div className="text-xs text-gray-400 truncate max-w-[140px]">{q.conditions}</div>}
                  </td>
                  <td className="px-3 py-3 text-right font-semibold">
                    {formatPrice(q.unit_price)}
                    {isBest && q.status !== 'rejected' && (
                      <div className="text-xs text-green-600 font-normal">Meilleur prix</div>
                    )}
                  </td>
                  <td className="px-3 py-3 text-right text-gray-700">{formatPrice(q.total_price)}</td>
                  <td className="px-3 py-3 text-center">
                    <span className="flex items-center justify-center gap-1">
                      <Truck size={13} className="text-gray-400" />
                      {q.delivery_time_days}j
                    </span>
                  </td>
                  <td className="px-3 py-3 text-center text-gray-500">{q.validity_days}j</td>
                  <td className="px-3 py-3">
                    <StatusBadge status={q.status} map={QUOTE_STATUS_COLOR} />
                  </td>
                  {isBuyer && rfq.status === 'comparing' && (
                    <td className="px-3 py-3">
                      {q.status === 'pending' && (
                        <div className="flex gap-1.5">
                          <Button size="sm" variant="ghost"
                            className="text-green-600 hover:bg-green-50 h-7 px-2"
                            disabled={accepting === q.id}
                            onClick={() => onAccept(q.id)}>
                            {accepting === q.id
                              ? <Spinner size={13} className="animate-spin" />
                              : <CheckCircle size={15} weight="fill" />}
                          </Button>
                          <Button size="sm" variant="ghost"
                            className="text-gray-400 hover:bg-gray-100 h-7 px-2"
                            onClick={() => onMessage(q.supplier_id)}>
                            <ChatCircle size={15} />
                          </Button>
                          <Button size="sm" variant="ghost"
                            className="text-red-400 hover:bg-red-50 h-7 px-2"
                            onClick={() => onReject(q.id)}>
                            <XCircle size={15} />
                          </Button>
                        </div>
                      )}
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Notes column (expand below table for readability) */}
      {quotes.some(q => q.notes) && (
        <div className="space-y-2 mt-2">
          {quotes.filter(q => q.notes).map(q => (
            <div key={q.id + '_note'} className="bg-gray-50 rounded p-3 text-xs text-gray-600">
              <span className="font-medium">{localizeAnon(q.supplier_name)} :</span> {q.notes}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── RFQ info panel ────────────────────────────────────────────────────────────
function RFQInfo({ rfq }) {
  const { t } = useLocale();
  const fields = [
    [t('rfq.ref'), rfq.rfq_number],
    [t('rfq.typeLabel'), rfq.rfq_type === 'public' ? t('rfq.publicType') : t('rfq.privateType')],
    [t('rfq.quantityLabel'), `${rfq.quantity} ${rfq.unit || t('rfq.unitPh')}`],
    [t('rfq.locationLabel'), rfq.delivery_location],
    rfq.target_price && [t('rfq.budgetLabel'), formatPrice(rfq.target_price)],
    rfq.delivery_deadline && [t('rfq.deadlineLabel'), rfq.delivery_deadline],
  ].filter(Boolean);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold text-gray-500 uppercase tracking-wide">{t('rfq.detailsLabel')}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {fields.map(([label, val]) => (
          <div key={label} className="flex justify-between text-sm">
            <span className="text-gray-500">{label}</span>
            <span className="font-medium text-right max-w-[60%]">{val}</span>
          </div>
        ))}
        {rfq.specifications && (
          <div className="pt-2 border-t text-xs text-gray-500">
            <div className="font-medium mb-1">Spécifications</div>
            <p className="whitespace-pre-wrap">{rfq.specifications}</p>
          </div>
        )}
        {rfq.description && (
          <div className="pt-2 border-t text-xs text-gray-500">
            <p className="whitespace-pre-wrap">{rfq.description}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function RFQDetailPage() {
  const { rfqId } = useParams();
  const navigate = useNavigate();
  const { user, isBuyer, isSupplier, isAdmin } = useAuth();
  const { localizeAnon } = useLocale();

  const [rfq, setRfq] = useState(null);
  const [quotes, setQuotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [accepting, setAccepting] = useState(null);
  const [cancelling, setCancelling] = useState(false);

  const load = useCallback(async () => {
    try {
      const [rfqRes, quotesRes] = await Promise.allSettled([
        rfqAPI.getById(rfqId),
        quotationsAPI.listByRfq(rfqId),
      ]);
      if (rfqRes.status === 'fulfilled') setRfq(rfqRes.value.data);
      if (quotesRes.status === 'fulfilled') {
        const d = quotesRes.value.data;
        setQuotes(Array.isArray(d) ? d : []);
      }
    } catch {
      toast.error(t('rfq.notFound'));
      navigate('/rfq');
    } finally {
      setLoading(false);
    }
  }, [rfqId, navigate]);

  useEffect(() => { load(); }, [load]);

  async function handleAccept(quotationId) {
    setAccepting(quotationId);
    try {
      const res = await quotationsAPI.accept(quotationId);
      toast.success(t('rfq.detail.accepted'));
      const orderId = res.data?.order_id;
      if (orderId) {
        setTimeout(() => navigate(`/orders/${orderId}`), 1200);
      } else {
        load();
      }
    } catch (err) {
      toast.error(err.response?.data?.detail || t('common.error'));
    } finally {
      setAccepting(null);
    }
  }

  async function handleReject(quotationId) {
    try {
      await quotationsAPI.reject(quotationId, t('rfq.detail.rejected'));
      toast.success(t('rfq.detail.rejected'));
      load();
    } catch (err) {
      toast.error(err.response?.data?.detail || t('common.error'));
    }
  }

  async function handleCancel() {
    if (!window.confirm(t('rfq.cancel.confirm'))) return;
    setCancelling(true);
    try {
      await rfqAPI.cancel(rfqId);
      toast.success(t('rfq.detail.cancelled'));
      navigate('/rfq');
    } catch (err) {
      toast.error(err.response?.data?.detail || t('common.error'));
    } finally {
      setCancelling(false);
    }
  }

  function handleMessage(supplierId) {
    if (!supplierId) return toast.error(t('rfq.detail.anonMsg'));
    navigate(`/messages/${supplierId}`);
  }

  if (loading) {
    return (
      <Layout>
        <div className="flex justify-center items-center min-h-[50vh]">
          <Spinner size={32} className="animate-spin text-blue-500" />
        </div>
      </Layout>
    );
  }

  if (!rfq) return null;

  const canCancel = isBuyer && ['open', 'comparing'].includes(rfq.status);
  const isAccepted = rfq.status === 'accepted';

  return (
    <Layout>
      <div className="max-w-5xl mx-auto px-4 py-6 space-y-6">
        {/* Back + header */}
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <button onClick={() => navigate('/rfq')}
              className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 mb-2">
              <ArrowLeft size={15} /> Mes demandes
            </button>
            <h1 className="text-xl font-bold">
              {rfq.title || rfq.product_name || rfq.rfq_number}
            </h1>
            <div className="flex items-center gap-2 mt-1">
              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLOR[rfq.status] || 'bg-gray-100 text-gray-700'}`}>
                {rfq.status}
              </span>
              <span className="text-xs text-gray-400">{rfq.rfq_number}</span>
              <span className="text-xs text-gray-400">
                {rfq.rfq_type === 'public' ? '🌐 Public' : '🔒 Privé'}
              </span>
            </div>
          </div>

          {canCancel && (
            <Button variant="outline" size="sm" className="text-red-500 border-red-200 hover:bg-red-50"
              disabled={cancelling} onClick={handleCancel}>
              {cancelling ? <Spinner size={14} className="animate-spin mr-1" /> : null}
              Annuler la demande
            </Button>
          )}
        </div>

        {/* Accepted → link to order */}
        {isAccepted && (
          <div className="flex items-center gap-3 bg-green-50 border border-green-200 rounded-lg px-4 py-3">
            <Seal size={20} weight="fill" className="text-green-600 shrink-0" />
            <div className="flex-1 text-sm text-green-800">
              Devis accepté — <strong>commande créée</strong>. Procédez au paiement pour lancer la production.
            </div>
            <Link to="/orders" className="text-sm font-medium text-green-700 underline flex items-center gap-1">
              Mes commandes <ArrowRight size={13} />
            </Link>
          </div>
        )}

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Quotations (main) */}
          <div className="lg:col-span-2">
            <QuotationsTable
              quotes={quotes}
              rfq={rfq}
              isBuyer={isBuyer || isAdmin}
              onAccept={handleAccept}
              onReject={handleReject}
              onMessage={handleMessage}
              accepting={accepting}
              localizeAnon={localizeAnon}
            />
          </div>

          {/* Sidebar */}
          <div className="space-y-4">
            <RFQInfo rfq={rfq} />

            {/* Negotiation hint */}
            {quotes.length > 0 && isBuyer && rfq.status === 'comparing' && (
              <Card className="bg-blue-50 border-blue-200">
                <CardContent className="p-4 text-sm text-blue-800 space-y-1">
                  <p className="font-medium flex items-center gap-1.5">
                    <ChatCircle size={16} weight="fill" /> Négociation anonymisée
                  </p>
                  <p className="text-xs">Cliquez sur l'icône message d'un devis pour discuter avec le fournisseur. Votre identité reste masquée jusqu'au paiement.</p>
                </CardContent>
              </Card>
            )}

            {/* Trade assurance reminder */}
            {isBuyer && (
              <Card className="bg-amber-50 border-amber-200">
                <CardContent className="p-4 text-xs text-amber-800 space-y-1">
                  <p className="font-medium flex items-center gap-1.5">
                    <Seal size={15} weight="fill" /> Trade Assurance
                  </p>
                  <p>{t('rfq.detail.ta.desc')}</p>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
}
