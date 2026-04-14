import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  CaretLeft,
  Package,
  Truck,
  CheckCircle,
  Clock,
  XCircle,
  CreditCard,
  MapPin,
  FileText,
  Star,
} from '@phosphor-icons/react';
import { Layout } from '../components/layout';
import { Button } from '../components/ui/button';
import { Textarea } from '../components/ui/textarea';
import { Label } from '../components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '../components/ui/dialog';
import { ordersAPI, supplierAPI } from '../lib/api';
import { useLocale } from '../context/LocaleContext';
import { formatPrice, formatDate, getStatusColor, getStatusLabel, getImageUrl } from '../lib/utils';
import { toast } from 'sonner';

const STATUS_STEPS = ['pending', 'confirmed', 'processing', 'shipped', 'delivered'];

const StatusTimeline = ({ currentStatus }) => {
  const currentIndex = STATUS_STEPS.indexOf(currentStatus);
  const isCancelled = currentStatus === 'cancelled';

  return (
    <div className="flex items-center gap-0 w-full">
      {STATUS_STEPS.map((step, i) => {
        const done = !isCancelled && i <= currentIndex;
        const active = !isCancelled && i === currentIndex;
        return (
          <React.Fragment key={step}>
            <div className="flex flex-col items-center flex-shrink-0">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center border-2 transition-colors ${
                  isCancelled
                    ? 'border-slate-200 bg-white text-slate-300'
                    : done
                    ? active
                      ? 'border-accent bg-accent text-white'
                      : 'border-green-500 bg-green-500 text-white'
                    : 'border-slate-200 bg-white text-slate-300'
                }`}
              >
                {done && !active ? (
                  <CheckCircle weight="fill" className="w-4 h-4" />
                ) : (
                  <span className="text-xs font-medium">{i + 1}</span>
                )}
              </div>
              <p className={`text-xs mt-1 font-medium text-center w-16 ${
                active ? 'text-accent' : done ? 'text-green-600' : 'text-slate-400'
              }`}>
                {getStatusLabel(step)}
              </p>
            </div>
            {i < STATUS_STEPS.length - 1 && (
              <div
                className={`flex-1 h-0.5 mb-4 transition-colors ${
                  !isCancelled && i < currentIndex ? 'bg-green-500' : 'bg-slate-200'
                }`}
              />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
};

const OrderDetailPage = () => {
  const { t } = useLocale();
  const { id } = useParams();
  const navigate = useNavigate();
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);

  // P3-14: notation fournisseur
  const [ratingDialogOpen, setRatingDialogOpen] = useState(false);
  const [supplierRating, setSupplierRating] = useState(0);
  const [supplierRatingData, setSupplierRatingData] = useState({
    communication_rating: 0,
    quality_rating: 0,
    delivery_rating: 0,
    comment: '',
  });
  const [ratingLoading, setRatingLoading] = useState(false);
  const [alreadyRated, setAlreadyRated] = useState(false);

  useEffect(() => {
    const fetchOrder = async () => {
      try {
        const res = await ordersAPI.getById(id);
        setOrder(res.data);
      } catch (err) {
        toast.error('Commande introuvable');
        navigate('/dashboard');
      } finally {
        setLoading(false);
      }
    };
    fetchOrder();
  }, [id, navigate]);

  // P3-14: soumettre la notation du fournisseur
  const handleSubmitSupplierRating = async () => {
    if (supplierRating === 0 || supplierRatingData.communication_rating === 0 ||
        supplierRatingData.quality_rating === 0 || supplierRatingData.delivery_rating === 0) {
      toast.error('Veuillez remplir toutes les notes');
      return;
    }
    setRatingLoading(true);
    try {
      await supplierAPI.rateSupplier(order.supplier_id, {
        supplier_id: order.supplier_id,
        order_id: order.id,
        rating: supplierRating,
        communication_rating: supplierRatingData.communication_rating,
        quality_rating: supplierRatingData.quality_rating,
        delivery_rating: supplierRatingData.delivery_rating,
        comment: supplierRatingData.comment || null,
      });
      toast.success('Évaluation envoyée, merci !');
      setAlreadyRated(true);
      setRatingDialogOpen(false);
    } catch (err) {
      const msg = err.response?.data?.detail || 'Erreur lors de l\'envoi';
      toast.error(typeof msg === 'string' ? msg : 'Erreur lors de l\'envoi');
    } finally {
      setRatingLoading(false);
    }
  };

  const StarRow = ({ label, value, onChange }) => (
    <div className="flex items-center justify-between">
      <span className="text-sm text-slate-600 w-32">{label}</span>
      <div className="flex gap-1">
        {[1,2,3,4,5].map((s) => (
          <button key={s} type="button" onClick={() => onChange(s)} className="focus:outline-none">
            <Star
              className={`w-6 h-6 ${s <= value ? 'text-yellow-500' : 'text-slate-200'}`}
              weight={s <= value ? 'fill' : 'regular'}
            />
          </button>
        ))}
      </div>
    </div>
  );

  if (loading) {
    return (
      <Layout>
        <div className="max-w-4xl mx-auto px-4 py-12 animate-pulse space-y-4">
          <div className="h-6 bg-slate-200 rounded w-1/3" />
          <div className="h-40 bg-slate-200 rounded" />
          <div className="h-40 bg-slate-200 rounded" />
        </div>
      </Layout>
    );
  }

  if (!order) return null;

  const isCancelled = order.status === 'cancelled';

  return (
    <Layout>
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Back */}
        <button
          onClick={() => navigate('/dashboard')}
          className="flex items-center gap-2 text-slate-600 hover:text-primary mb-6 transition-colors"
        >
          <CaretLeft className="w-5 h-5" />
          Retour au tableau de bord
        </button>

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
          <div>
            <p className="text-sm text-slate-500 font-mono">{order.order_number}</p>
            <h1 className="font-heading font-bold text-2xl text-slate-900 mt-1">
              Détail de la commande
            </h1>
            <p className="text-sm text-slate-500 mt-1">Passée le {formatDate(order.created_at)}</p>
          </div>
          <div className="flex items-center gap-3">
            <span
              className={`px-4 py-1.5 rounded-full text-sm font-semibold ${getStatusColor(order.status)}`}
            >
              {getStatusLabel(order.status)}
            </span>
            <span
              className={`px-4 py-1.5 rounded-full text-sm font-semibold ${getStatusColor(order.payment_status)}`}
            >
              {order.payment_status === 'paid' ? 'Payé' : 'En attente de paiement'}
            </span>
          </div>
        </div>

        {/* Timeline */}
        {!isCancelled && (
          <div className="bg-white border border-slate-200 rounded-xl p-6 mb-6">
            <h2 className="font-heading font-semibold text-base mb-6 text-slate-700">
              Suivi de la commande
            </h2>
            <StatusTimeline currentStatus={order.status} />
          </div>
        )}

        {isCancelled && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-5 mb-6 flex items-center gap-3">
            <XCircle className="w-6 h-6 text-red-500 flex-shrink-0" weight="fill" />
            <p className="text-red-700 font-medium">Cette commande a été annulée.</p>
          </div>
        )}

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Items */}
          <div className="lg:col-span-2 space-y-4">
            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-100">
                <h2 className="font-heading font-semibold text-base text-slate-700">
                  Articles ({order.items?.length || 0})
                </h2>
              </div>
              <div className="divide-y divide-slate-100">
                {(order.items || []).map((item, i) => (
                  <div key={i} className="flex gap-4 p-5">
                    <div className="w-16 h-16 bg-slate-100 rounded-lg flex-shrink-0 overflow-hidden">
                      {item.product_image ? (
                        <img
                          src={getImageUrl(item.product_image)}
                          alt={item.product_name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Package className="w-7 h-7 text-slate-300" />
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <Link
                        to={`/products/${item.product_id}`}
                        className="font-medium text-slate-900 hover:text-accent line-clamp-1"
                      >
                        {item.product_name}
                      </Link>
                      <p className="text-sm text-slate-500 mt-0.5">
                        {formatPrice(item.price)} / {item.unit} × {item.quantity}
                      </p>
                    </div>
                    <p className="font-heading font-bold text-slate-900 flex-shrink-0">
                      {formatPrice(item.subtotal)}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            {/* Notes */}
            {order.notes && (
              <div className="bg-white border border-slate-200 rounded-xl p-5">
                <div className="flex items-center gap-2 mb-2">
                  <FileText className="w-4 h-4 text-slate-400" />
                  <h2 className="font-semibold text-sm text-slate-700">Notes</h2>
                </div>
                <p className="text-sm text-slate-600">{order.notes}</p>
              </div>
            )}
          </div>

          {/* Summary */}
          <div className="space-y-4">
            {/* Totals */}
            <div className="bg-white border border-slate-200 rounded-xl p-5">
              <h2 className="font-heading font-semibold text-base mb-4 text-slate-700">
                Récapitulatif
              </h2>
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
            </div>

            {/* Supplier */}
            <div className="bg-white border border-slate-200 rounded-xl p-5">
              <div className="flex items-center gap-2 mb-3">
                <Truck className="w-4 h-4 text-slate-400" />
                <h2 className="font-semibold text-sm text-slate-700">{t('orders.detail.supplier')}</h2>
              </div>
              <p className="text-sm font-medium text-slate-900">{order.supplier_name}</p>
              <Link
                to={`/messages`}
                className="text-xs text-accent hover:underline mt-1 block"
              >
                {t('orders.detail.contact')}
              </Link>
              {/* P3-14: bouton évaluation fournisseur visible uniquement si commande livrée */}
              {order.status === 'delivered' && (
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-3 w-full text-xs"
                  onClick={() => setRatingDialogOpen(true)}
                  disabled={alreadyRated}
                >
                  <Star className="w-3.5 h-3.5 mr-1.5" weight={alreadyRated ? 'fill' : 'regular'} />
                  {alreadyRated ? t('orders.rate.done') : t('orders.rate.title')}
                </Button>
              )}
            </div>

            {/* Adresse de livraison */}
            {(order.shipping_address || order.shipping_city) && (
              <div className="bg-white border border-slate-200 rounded-xl p-5">
                <div className="flex items-center gap-2 mb-3">
                  <MapPin className="w-4 h-4 text-slate-400" />
                  <h2 className="font-semibold text-sm text-slate-700">{t('checkout.address')}</h2>
                </div>
                {order.shipping_address && (
                  <p className="text-sm text-slate-600">{order.shipping_address}</p>
                )}
                <p className="text-sm text-slate-600">
                  {[order.shipping_city, order.shipping_country].filter(Boolean).join(', ')}
                </p>
              </div>
            )}

            {/* Payment */}
            <div className="bg-white border border-slate-200 rounded-xl p-5">
              <div className="flex items-center gap-2 mb-3">
                <CreditCard className="w-4 h-4 text-slate-400" />
                <h2 className="font-semibold text-sm text-slate-700">{t('orders.detail.payment')}</h2>
              </div>
              <p className="text-sm text-slate-600 capitalize">
                {order.payment_method === 'stripe' ? 'Carte bancaire' : 'Mobile Money'}
              </p>
              <span
                className={`inline-block mt-1 px-2 py-0.5 rounded-full text-xs font-medium ${getStatusColor(
                  order.payment_status
                )}`}
              >
                {order.payment_status === 'paid' ? 'Payé' : 'En attente'}
              </span>
            </div>

            {/* Retry payment if pending */}
            {order.payment_status !== 'paid' && !isCancelled && (
              <Button
                className="w-full bg-accent hover:bg-accent-hover"
                onClick={() => navigate('/checkout')}
              >
                Reprendre le paiement
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* P3-14: Dialog notation fournisseur */}
      <Dialog open={ratingDialogOpen} onOpenChange={setRatingDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Évaluer {order?.supplier_name}</DialogTitle>
            <DialogDescription>
              Votre avis aide la communauté AfriSupply à identifier les meilleurs fournisseurs.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <StarRow label="Note globale" value={supplierRating} onChange={setSupplierRating} />
            <div className="border-t pt-4 space-y-3">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Critères détaillés</p>
              <StarRow
                label="Communication"
                value={supplierRatingData.communication_rating}
                onChange={(v) => setSupplierRatingData((p) => ({ ...p, communication_rating: v }))}
              />
              <StarRow
                label="Qualité produits"
                value={supplierRatingData.quality_rating}
                onChange={(v) => setSupplierRatingData((p) => ({ ...p, quality_rating: v }))}
              />
              <StarRow
                label="Respect délais"
                value={supplierRatingData.delivery_rating}
                onChange={(v) => setSupplierRatingData((p) => ({ ...p, delivery_rating: v }))}
              />
            </div>
            <div>
              <Label htmlFor="supplier-comment">{t('orders.rate.comment')}</Label>
              <Textarea
                id="supplier-comment"
                value={supplierRatingData.comment}
                onChange={(e) => setSupplierRatingData((p) => ({ ...p, comment: e.target.value }))}
                placeholder="Décrivez votre expérience avec ce fournisseur..."
                rows={3}
                className="mt-1"
              />
            </div>
            <div className="flex gap-3 pt-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => setRatingDialogOpen(false)}
                disabled={ratingLoading}
              >
                Annuler
              </Button>
              <Button
                className="flex-1 bg-accent hover:bg-accent-hover"
                onClick={handleSubmitSupplierRating}
                disabled={
                  ratingLoading ||
                  supplierRating === 0 ||
                  supplierRatingData.communication_rating === 0 ||
                  supplierRatingData.quality_rating === 0 ||
                  supplierRatingData.delivery_rating === 0
                }
              >
                {ratingLoading ? "Envoi..." : "Envoyer l'évaluation"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
      </Layout>
  );
};

export default OrderDetailPage;