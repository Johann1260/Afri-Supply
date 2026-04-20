import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  CaretLeft, Package, Truck, CheckCircle, Clock, XCircle,
  CreditCard, MapPin, FileText, Star, Receipt, MapTrifold
} from '@phosphor-icons/react';
import { Layout } from '../components/layout';
import { Button } from '../components/ui/button';
import { Textarea } from '../components/ui/textarea';
import { Label } from '../components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '../components/ui/dialog';
import { ordersAPI, supplierAPI } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { useLocale } from '../context/LocaleContext';
import { formatPrice, formatDate, getStatusColor, getStatusLabel, getImageUrl } from '../lib/utils';
import { toast } from 'sonner';

const ORDER_STEPS = ['pending','confirmed','processing','shipped','delivered'];

const StatusTimeline = ({ currentStatus }) => {
  const idx = ORDER_STEPS.indexOf(currentStatus);
  const cancelled = currentStatus === 'cancelled';
  return (
    <div className="flex items-center gap-0 w-full">
      {ORDER_STEPS.map((step, i) => {
        const done   = !cancelled && i <= idx;
        const active = !cancelled && i === idx;
        return (
          <React.Fragment key={step}>
            <div className="flex flex-col items-center flex-shrink-0">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 transition-colors ${
                cancelled ? 'border-slate-200 bg-white text-slate-300' :
                done ? (active ? 'border-accent bg-accent text-white' : 'border-green-500 bg-green-500 text-white') :
                'border-slate-200 bg-white text-slate-300'
              }`}>
                {done && !active
                  ? <CheckCircle weight="fill" className="w-4 h-4" />
                  : <span className="text-xs font-medium">{i + 1}</span>}
              </div>
              <p className={`text-xs mt-1 font-medium text-center w-16 ${
                active ? 'text-accent' : done ? 'text-green-600' : 'text-slate-400'
              }`}>{getStatusLabel(step)}</p>
            </div>
            {i < ORDER_STEPS.length - 1 && (
              <div className={`flex-1 h-0.5 mb-4 transition-colors ${
                !cancelled && i < idx ? 'bg-green-500' : 'bg-slate-200'
              }`} />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
};

// ── Tracking timeline ──────────────────────────────────────────────────────────
const TRACKING_ICONS = {
  preparing:  { icon: Package,      color: 'text-blue-500',   bg: 'bg-blue-50' },
  ready:      { icon: CheckCircle,  color: 'text-green-500',  bg: 'bg-green-50' },
  shipped:    { icon: Truck,        color: 'text-primary',    bg: 'bg-primary/10' },
  in_transit: { icon: MapTrifold,   color: 'text-amber-500',  bg: 'bg-amber-50' },
  delivered:  { icon: CheckCircle,  color: 'text-green-600',  bg: 'bg-green-100' },
  issue:      { icon: XCircle,      color: 'text-red-500',    bg: 'bg-red-50' },
};

const TRACKING_LABELS = {
  preparing:  'En préparation',
  ready:      'Prêt pour expédition',
  shipped:    'Expédié',
  in_transit: 'En transit',
  delivered:  'Livré',
  issue:      'Problème signalé',
};

const TrackingTimeline = ({ events }) => {
  if (!events || events.length === 0) return (
    <p className="text-sm text-slate-400 italic">Aucun événement de tracking pour le moment.</p>
  );
  return (
    <div className="relative">
      <div className="absolute left-5 top-0 bottom-0 w-0.5 bg-slate-100" />
      <div className="space-y-4">
        {events.map((event, i) => {
          const cfg = TRACKING_ICONS[event.status] || { icon: Clock, color: 'text-slate-400', bg: 'bg-slate-100' };
          const Icon = cfg.icon;
          return (
            <div key={event.id || i} className="flex gap-4 relative">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 z-10 ${cfg.bg}`}>
                <Icon className={`w-5 h-5 ${cfg.color}`} weight={i === 0 ? 'fill' : 'regular'} />
              </div>
              <div className="flex-1 pb-4">
                <p className={`font-semibold text-sm ${i === 0 ? 'text-slate-900' : 'text-slate-600'}`}>
                  {TRACKING_LABELS[event.status] || event.status}
                </p>
                {event.location && <p className="text-xs text-slate-500 flex items-center gap-1 mt-0.5"><MapPin className="w-3 h-3" />{event.location}</p>}
                {event.note && <p className="text-xs text-slate-400 mt-1">{event.note}</p>}
                <p className="text-xs text-slate-400 mt-1">{formatDate(event.created_at)}</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

// ── Page principale ────────────────────────────────────────────────────────────
const OrderDetailPage = () => {
  const { t }    = useLocale();
  const { id }   = useParams();
  const navigate  = useNavigate();
  const { user }  = useAuth();

  const [order, setOrder]     = useState(null);
  const [tracking, setTracking] = useState([]);
  const [loading, setLoading] = useState(true);

  const [ratingOpen, setRatingOpen]     = useState(false);
  const [supplierRating, setSupplierRating] = useState(0);
  const [ratingData, setRatingData]     = useState({ communication_rating: 0, quality_rating: 0, delivery_rating: 0, comment: '' });
  const [ratingLoading, setRatingLoading] = useState(false);
  const [alreadyRated, setAlreadyRated] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        const [orderRes, trackingRes] = await Promise.allSettled([
          ordersAPI.getById(id),
          ordersAPI.getTracking(id),
        ]);
        if (orderRes.status === 'fulfilled') setOrder(orderRes.value.data);
        else { toast.error('Commande introuvable'); navigate('/dashboard'); }
        if (trackingRes.status === 'fulfilled') setTracking(trackingRes.value.data || []);
      } finally { setLoading(false); }
    };
    load();
  }, [id, navigate]);

  const handleSubmitRating = async () => {
    if (!supplierRating || !ratingData.communication_rating || !ratingData.quality_rating || !ratingData.delivery_rating) {
      toast.error('Veuillez remplir toutes les notes'); return;
    }
    setRatingLoading(true);
    try {
      await supplierAPI.rateSupplier(order.supplier_id, {
        supplier_id: order.supplier_id, order_id: order.id,
        rating: supplierRating, ...ratingData,
      });
      toast.success('Évaluation envoyée, merci !');
      setAlreadyRated(true); setRatingOpen(false);
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Erreur lors de l\'envoi');
    } finally { setRatingLoading(false); }
  };

  const StarRow = ({ label, value, onChange }) => (
    <div className="flex items-center justify-between">
      <span className="text-sm text-slate-600 w-36">{label}</span>
      <div className="flex gap-1">
        {[1,2,3,4,5].map((s) => (
          <button key={s} type="button" onClick={() => onChange(s)}>
            <Star className={`w-6 h-6 ${s <= value ? 'text-yellow-500' : 'text-slate-200'}`}
              weight={s <= value ? 'fill' : 'regular'} />
          </button>
        ))}
      </div>
    </div>
  );

  if (loading) return (
    <Layout>
      <div className="max-w-4xl mx-auto px-4 py-12 animate-pulse space-y-4">
        <div className="h-6 bg-slate-200 rounded w-1/3" />
        <div className="h-40 bg-slate-200 rounded" />
        <div className="h-40 bg-slate-200 rounded" />
      </div>
    </Layout>
  );

  if (!order) return null;

  const isCancelled = order.status === 'cancelled';
  const isMyOrder   = order.buyer_id === user?.id;

  return (
    <Layout>
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <button onClick={() => navigate('/dashboard')}
          className="flex items-center gap-2 text-slate-600 hover:text-primary mb-6 transition-colors">
          <CaretLeft className="w-5 h-5" />{t('orders.detail.back')}
        </button>

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
          <div>
            <p className="text-sm text-slate-500 font-mono">{order.order_number}</p>
            <h1 className="font-heading font-bold text-2xl text-slate-900 mt-1">{t('orders.detail.title')}</h1>
            <p className="text-sm text-slate-500 mt-1">{t('orders.detail.placedOn')} {formatDate(order.created_at)}</p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`px-4 py-1.5 rounded-full text-sm font-semibold ${getStatusColor(order.status)}`}>
              {getStatusLabel(order.status)}
            </span>
            <span className={`px-4 py-1.5 rounded-full text-sm font-semibold ${getStatusColor(order.payment_status)}`}>
              {order.payment_status === 'paid' ? 'Payé' : 'En attente de paiement'}
            </span>
          </div>
        </div>

        {/* Timeline statut */}
        {!isCancelled && (
          <div className="bg-white border border-slate-200 rounded-xl p-6 mb-6">
            <h2 className="font-semibold text-base mb-6 text-slate-700">{t('orders.detail.tracking')}</h2>
            <StatusTimeline currentStatus={order.status} />
          </div>
        )}

        {isCancelled && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-5 mb-6 flex items-center gap-3">
            <XCircle className="w-6 h-6 text-red-500 flex-shrink-0" weight="fill" />
            <p className="text-red-700 font-medium">{t('orders.detail.cancelled')}</p>
          </div>
        )}

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Articles + Tracking */}
          <div className="lg:col-span-2 space-y-4">
            {/* Articles */}
            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-100">
                <h2 className="font-semibold text-base text-slate-700">{t('orders.detail.items')} ({order.items?.length || 0})</h2>
              </div>
              <div className="divide-y divide-slate-100">
                {(order.items || []).map((item, i) => (
                  <div key={i} className="flex gap-4 p-5">
                    <div className="w-16 h-16 bg-slate-100 rounded-lg flex-shrink-0 overflow-hidden">
                      {item.product_image
                        ? <img src={getImageUrl(item.product_image)} alt={item.product_name} className="w-full h-full object-cover" />
                        : <div className="w-full h-full flex items-center justify-center"><Package className="w-7 h-7 text-slate-300" /></div>}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Link to={`/products/${item.product_id}`} className="font-medium text-slate-900 hover:text-accent line-clamp-1">
                          {item.product_name}
                        </Link>
                        {order.payment_status === 'paid' && (
                          <a href={ordersAPI.getInvoice(order.id)} target="_blank" rel="noopener noreferrer"
                            className="flex items-center gap-1 text-xs text-red-500 hover:text-red-700 border border-red-200 rounded px-1.5 py-0.5 hover:bg-red-50 transition-colors">
                            <Receipt className="w-3 h-3" />Facture
                          </a>
                        )}
                      </div>
                      <p className="text-sm text-slate-500 mt-0.5">
                        {formatPrice(item.price)} / {item.unit} × {item.quantity}
                      </p>
                    </div>
                    <p className="font-heading font-bold text-slate-900 flex-shrink-0">{formatPrice(item.subtotal)}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Tracking livraison */}
            <div className="bg-white border border-slate-200 rounded-xl p-6">
              <h2 className="font-semibold text-base text-slate-700 mb-4 flex items-center gap-2">
                <Truck className="w-4 h-4" />Suivi de livraison
              </h2>
              <TrackingTimeline events={tracking} />
            </div>

            {/* Notes */}
            {order.notes && (
              <div className="bg-white border border-slate-200 rounded-xl p-5">
                <div className="flex items-center gap-2 mb-2">
                  <FileText className="w-4 h-4 text-slate-400" />
                  <h2 className="font-semibold text-sm text-slate-700">{t('orders.detail.notes.title')}</h2>
                </div>
                <p className="text-sm text-slate-600">{order.notes}</p>
              </div>
            )}
          </div>

          {/* Sidebar récapitulatif */}
          <div className="space-y-4">
            <div className="bg-white border border-slate-200 rounded-xl p-5">
              <h2 className="font-semibold text-base mb-4 text-slate-700">Récapitulatif</h2>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between text-slate-600">
                  <span>{t('orders.detail.subtotal')}</span>
                  <span>{formatPrice(order.subtotal)}</span>
                </div>
                <div className="border-t pt-2 flex justify-between font-heading font-bold text-base">
                  <span>{t('orders.detail.total')}</span>
                  <span className="text-primary">{formatPrice(order.total)}</span>
                </div>
              </div>
              {/* Télécharger facture */}
              {order.payment_status === 'paid' && isMyOrder && (
                <a href={ordersAPI.getInvoice(order.id)} target="_blank" rel="noopener noreferrer"
                  className="mt-4 w-full flex items-center justify-center gap-2 px-4 py-2 border border-primary text-primary hover:bg-primary hover:text-white rounded-lg text-sm font-medium transition-colors">
                  <Receipt className="w-4 h-4" />Télécharger la facture PDF
                </a>
              )}
            </div>

            <div className="bg-white border border-slate-200 rounded-xl p-5">
              <div className="flex items-center gap-2 mb-3">
                <Truck className="w-4 h-4 text-slate-400" />
                <h2 className="font-semibold text-sm text-slate-700">{t('orders.detail.supplier')}</h2>
              </div>
              <p className="text-sm font-medium text-slate-900">{order.supplier_name}</p>
              <Link to="/messages" className="text-xs text-accent hover:underline mt-1 block">
                {t('orders.detail.contact')}
              </Link>
              {order.status === 'delivered' && isMyOrder && (
                <Button variant="outline" size="sm" className="mt-3 w-full text-xs"
                  onClick={() => setRatingOpen(true)} disabled={alreadyRated}>
                  <Star className="w-3.5 h-3.5 mr-1.5" weight={alreadyRated ? 'fill' : 'regular'} />
                  {alreadyRated ? t('orders.rate.done') : t('orders.rate.title')}
                </Button>
              )}
            </div>

            <div className="bg-white border border-slate-200 rounded-xl p-5">
              <div className="flex items-center gap-2 mb-3">
                <CreditCard className="w-4 h-4 text-slate-400" />
                <h2 className="font-semibold text-sm text-slate-700">{t('orders.detail.payment')}</h2>
              </div>
              <p className="text-sm text-slate-600 capitalize">
                {order.payment_method === 'stripe' ? 'Carte bancaire' : 'Mobile Money'}
              </p>
              <span className={`inline-block mt-1 px-2 py-0.5 rounded-full text-xs font-medium ${getStatusColor(order.payment_status)}`}>
                {order.payment_status === 'paid' ? 'Payé' : 'En attente'}
              </span>
            </div>

            {order.payment_status !== 'paid' && !isCancelled && isMyOrder && (
              <Button className="w-full bg-accent hover:bg-accent-hover" onClick={() => navigate('/checkout')}>
                {t('orders.detail.retry')}
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Dialog notation fournisseur */}
      <Dialog open={ratingOpen} onOpenChange={setRatingOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Évaluer {order?.supplier_name}</DialogTitle>
            <DialogDescription>Votre avis aide la communauté AfriSupply.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <StarRow label="Note globale" value={supplierRating} onChange={setSupplierRating} />
            <div className="border-t pt-4 space-y-3">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">{t('orders.rate.criteria')}</p>
              <StarRow label="Communication"   value={ratingData.communication_rating} onChange={(v) => setRatingData((p) => ({ ...p, communication_rating: v }))} />
              <StarRow label="Qualité produits" value={ratingData.quality_rating}       onChange={(v) => setRatingData((p) => ({ ...p, quality_rating: v }))} />
              <StarRow label="Respect délais"   value={ratingData.delivery_rating}      onChange={(v) => setRatingData((p) => ({ ...p, delivery_rating: v }))} />
            </div>
            <div>
              <Label htmlFor="sup-comment">{t('orders.rate.comment')}</Label>
              <Textarea id="sup-comment" value={ratingData.comment}
                onChange={(e) => setRatingData((p) => ({ ...p, comment: e.target.value }))}
                placeholder="Décrivez votre expérience..." rows={3} className="mt-1" />
            </div>
            <div className="flex gap-3 pt-2">
              <Button variant="outline" className="flex-1" onClick={() => setRatingOpen(false)} disabled={ratingLoading}>
                Annuler
              </Button>
              <Button className="flex-1 bg-accent hover:bg-accent-hover" onClick={handleSubmitRating}
                disabled={ratingLoading || !supplierRating || !ratingData.communication_rating || !ratingData.quality_rating || !ratingData.delivery_rating}>
                {ratingLoading ? t('orders.rate.sending') : t('orders.rate.send')}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </Layout>
  );
};

export default OrderDetailPage;