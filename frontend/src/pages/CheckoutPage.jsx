import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { 
  CreditCard, 
  ShieldCheck,
  CheckCircle,
  XCircle,
  Spinner,
  DeviceMobile,
  MapPin
} from '@phosphor-icons/react';
import { Layout } from '../components/layout';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '../components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '../components/ui/dialog';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';
import { useLocale } from '../context/LocaleContext';
import { ordersAPI, paymentAPI, mobileMoneyAPI } from '../lib/api';
import { formatPrice, getImageUrl } from '../lib/utils';
import { toast } from 'sonner';

// P1 FIX: liste des pays CEMAC pour le sélecteur d'adresse
const CEMAC_COUNTRIES = [
  'Cameroun',
  'Gabon',
  'Congo',
  'Tchad',
  'Guinée Équatoriale',
  'Centrafrique',
];

const CheckoutPage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { cart, refreshCart } = useCart();
  const { user, isAuthenticated } = useAuth();
  const { t } = useLocale();
  const [loading, setLoading] = useState(false);
  const [paymentStatus, setPaymentStatus] = useState(null);
  const [orderIds, setOrderIds] = useState([]);
  const [mobileMoneyDialogOpen, setMobileMoneyDialogOpen] = useState(false);
  // Mapper pays CEMAC → code ISO pour Mobile Money
  const COUNTRY_CODES = {
    'Cameroun': 'CM', 'Gabon': 'GA', 'Congo': 'CG',
    'Tchad': 'TD', 'Guinée Équatoriale': 'GQ', 'Centrafrique': 'CF',
  };
  const [mobileMoneyData, setMobileMoneyData] = useState({
    phone_number: user?.phone || '',
    network: 'MTN',
    country_code: COUNTRY_CODES[user?.country] || 'CM',
  });
  const [mobileMoneyTransaction, setMobileMoneyTransaction] = useState(null);
  
  // P1 FIX: ajout des champs d'adresse de livraison (shipping_address, shipping_city, shipping_country)
  const [formData, setFormData] = useState({
    shipping_address: '',
    shipping_city: user?.city || '',
    shipping_country: user?.country || '',
    payment_method: 'stripe',
    notes: '',
  });

  const sessionId = searchParams.get('session_id');

  useEffect(() => {
    if (sessionId) {
      checkPaymentStatus(sessionId);
    }
  }, [sessionId]);

  const _pollTimerRef = useRef(null);

  // Cleanup polling on unmount
  useEffect(() => () => { if (_pollTimerRef.current) clearTimeout(_pollTimerRef.current); }, []);

  const checkPaymentStatus = async (sid) => {
    setPaymentStatus('checking');
    let attempts = 0;
    const MAX_ATTEMPTS = 12;  // 12 × backoff ≈ ~45s max

    const poll = async () => {
      try {
        const res = await paymentAPI.getCheckoutStatus(sid);
        const { payment_status, status, order_ids } = res.data;

        if (payment_status === 'paid') {
          setOrderIds(order_ids || []);
          setPaymentStatus('success');
          refreshCart();
          return;
        }
        if (status === 'expired') {
          setPaymentStatus('failed');
          return;
        }

        attempts++;
        if (attempts < MAX_ATTEMPTS) {
          // Backoff exponentiel plafonné à 5s — adapté faible bande passante africaine
          const delay = Math.min(1000 * Math.pow(1.4, attempts), 5000);
          _pollTimerRef.current = setTimeout(poll, delay);
        } else {
          setPaymentStatus('pending');  // webhook Stripe delayed — afficher message attente
        }
      } catch {
        setPaymentStatus('failed');
      }
    };

    poll();
  };

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/login');
    }
  }, [isAuthenticated, navigate]);

  const total = cart.total;

  // P1 FIX: validation des champs d'adresse avant soumission
  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.shipping_address.trim()) {
      toast.error(t('checkout.err.address'));
      return;
    }
    if (!formData.shipping_city.trim()) {
      toast.error(t('checkout.err.city'));
      return;
    }
    if (!formData.shipping_country) {
      toast.error(t('checkout.err.country'));
      return;
    }

    setLoading(true);

    try {
      // Orders are now created server-side after payment confirmation (webhook/mobile confirm)
      const checkoutExtra = {
        shipping_address: formData.shipping_address,
        shipping_city: formData.shipping_city,
        shipping_country: formData.shipping_country,
        notes: formData.notes,
      };
      if (formData.payment_method === 'mobile_money') {
        setMobileMoneyDialogOpen(true);
        setLoading(false);
      } else {
        const res = await paymentAPI.createCheckoutSession({ origin_url: window.location.origin, ...checkoutExtra });
        window.location.href = res.data.url;
      }
    } catch (error) {
      toast.error(error.response?.data?.detail || t('checkout.order.error'));
      setLoading(false);
    }
  };

  const handleMobileMoneyPayment = async () => {
    if (!mobileMoneyData.phone_number) {
      toast.error(t('checkout.momo.phone.required'));
      return;
    }

    setLoading(true);
    try {
      const res = await mobileMoneyAPI.createPayment({
        ...mobileMoneyData,
        shipping_address: formData.shipping_address,
        shipping_city: formData.shipping_city,
        shipping_country: formData.shipping_country,
        notes: formData.notes,
      });
      setMobileMoneyTransaction(res.data);
      toast.success(t('common.sent'));
    } catch (error) {
      toast.error(t('checkout.momo.error'));
    } finally {
      setLoading(false);
    }
  };

  // La confirmation Mobile Money est faite par l'admin uniquement (require_admin).
  // Le buyer ferme juste le dialog et attend la validation (24-48h).
  const handleCloseMobileMoneyPending = () => {
    setMobileMoneyDialogOpen(false);
    toast.success(t('checkout.pending.msg'));
    navigate('/dashboard');
  };

  // Payment status screens
  if (paymentStatus === 'checking') {
    return (
      <Layout>
        <div className="max-w-md mx-auto px-4 py-20 text-center">
          <Spinner className="w-12 h-12 mx-auto text-accent animate-spin mb-4" />
          <h1 className="font-heading font-bold text-2xl mb-2">{t('checkout.checking')}</h1>
          <p className="text-slate-500">{t('checkout.please.wait')}</p>
        </div>
      </Layout>
    );
  }

  if (paymentStatus === 'success') {
    return (
      <Layout>
        <div className="max-w-md mx-auto px-4 py-20 text-center">
          <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle className="w-10 h-10 text-green-600" weight="fill" />
          </div>
          <h1 className="font-heading font-bold text-2xl mb-2">{t('checkout.success.title')}</h1>
          <p className="text-slate-500 mb-6">
            {t('checkout.success.sub')}
          </p>
          <div className="flex flex-col gap-3">
            {orderIds.length > 0 ? (
              orderIds.map((oid) => (
                <Button key={oid} onClick={() => navigate(`/orders/${oid}`)}
                  className="bg-accent hover:bg-accent-hover" data-testid="view-order">
                  Voir ma commande
                </Button>
              ))
            ) : (
              <Button onClick={() => navigate('/dashboard')}
                className="bg-accent hover:bg-accent-hover" data-testid="view-orders">
                Voir mes commandes
              </Button>
            )}
          </div>
        </div>
      </Layout>
    );
  }

  if (paymentStatus === 'failed') {
    return (
      <Layout>
        <div className="max-w-md mx-auto px-4 py-20 text-center">
          <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <XCircle className="w-10 h-10 text-red-600" weight="fill" />
          </div>
          <h1 className="font-heading font-bold text-2xl mb-2">{t('checkout.failed.title')}</h1>
          <p className="text-slate-500 mb-6">
            {t('checkout.failed.sub')}
          </p>
          <Button 
            onClick={() => navigate('/cart')}
            className="bg-accent hover:bg-accent-hover"
          >
            Retour au panier
          </Button>
        </div>
      </Layout>
    );
  }

  useEffect(() => {
    if (cart.items.length === 0 && !sessionId && paymentStatus === null) {
      navigate('/cart');
    }
  }, [cart.items.length, sessionId, paymentStatus, navigate]);

  if (cart.items.length === 0 && !sessionId && paymentStatus === null) return null;

  return (
    <Layout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <h1 className="section-heading mb-8">{t('checkout.title')}</h1>

        <div className="grid lg:grid-cols-3 gap-8">
          {/* Checkout form */}
          <div className="lg:col-span-2">
            <form onSubmit={handleSubmit} className="space-y-6">

              {/* P1 FIX: Adresse de livraison */}
              <div className="bg-white border border-slate-200 rounded-lg p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center">
                    <MapPin className="w-5 h-5 text-primary" />
                  </div>
                  <h2 className="font-heading font-bold text-lg">{t('checkout.address')}</h2>
                </div>

                <div className="space-y-4">
                  <div>
                    <Label htmlFor="shipping_address">{t('checkout.address.street')} *</Label>
                    <Input
                      id="shipping_address"
                      value={formData.shipping_address}
                      onChange={(e) => setFormData({ ...formData, shipping_address: e.target.value })}
                      placeholder="Rue, quartier, numéro..."
                      required
                      data-testid="shipping-address"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="shipping_city">{t('checkout.address.city')} *</Label>
                      <Input
                        id="shipping_city"
                        value={formData.shipping_city}
                        onChange={(e) => setFormData({ ...formData, shipping_city: e.target.value })}
                        placeholder="Douala"
                        required
                        data-testid="shipping-city"
                      />
                    </div>
                    <div>
                      <Label htmlFor="shipping_country">{t('checkout.address.country')} *</Label>
                      <Select
                        value={formData.shipping_country}
                        onValueChange={(val) => setFormData({ ...formData, shipping_country: val })}
                      >
                        <SelectTrigger data-testid="shipping-country">
                          <SelectValue {...{placeholder: t('checkout.country.ph')}} />
                        </SelectTrigger>
                        <SelectContent>
                          {CEMAC_COUNTRIES.map((c) => (
                            <SelectItem key={c} value={c}>{c}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
              </div>

              {/* Payment method */}
              <div className="bg-white border border-slate-200 rounded-lg p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center">
                    <CreditCard className="w-5 h-5 text-primary" />
                  </div>
                  <h2 className="font-heading font-bold text-lg">{t('checkout.payment')}</h2>
                </div>

                <div className="space-y-3">
                  <label className={`flex items-center gap-4 p-4 border rounded-lg cursor-pointer transition-colors ${
                    formData.payment_method === 'stripe' ? 'border-accent bg-accent/5' : 'border-slate-200'
                  }`}>
                    <input
                      type="radio"
                      name="payment_method"
                      value="stripe"
                      checked={formData.payment_method === 'stripe'}
                      onChange={(e) => setFormData({ ...formData, payment_method: e.target.value })}
                      className="w-4 h-4 text-accent"
                    />
                    <CreditCard className="w-6 h-6 text-slate-600" />
                    <div>
                      <p className="font-medium">{t('checkout.card')}</p>
                      <p className="text-sm text-slate-500">{t('checkout.card.sub')}</p>
                    </div>
                  </label>

                  <label className={`flex items-center gap-4 p-4 border rounded-lg cursor-pointer transition-colors ${
                    formData.payment_method === 'mobile_money' ? 'border-accent bg-accent/5' : 'border-slate-200'
                  }`}>
                    <input
                      type="radio"
                      name="payment_method"
                      value="mobile_money"
                      checked={formData.payment_method === 'mobile_money'}
                      onChange={(e) => setFormData({ ...formData, payment_method: e.target.value })}
                      className="w-4 h-4 text-accent"
                    />
                    <DeviceMobile className="w-6 h-6 text-slate-600" />
                    <div>
                      <p className="font-medium">{t('checkout.mobile')}</p>
                      <p className="text-sm text-slate-500">{t('checkout.mobile.sub')}</p>
                    </div>
                  </label>
                </div>
              </div>

              {/* Notes */}
              <div className="bg-white border border-slate-200 rounded-lg p-6">
                <Label htmlFor="notes">{t('checkout.notes')}</Label>
                <Textarea
                  id="notes"
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder={t('checkout.notes.ph')}
                  data-testid="order-notes"
                />
              </div>

              <Button 
                type="submit"
                size="lg"
                className="w-full bg-accent hover:bg-accent-hover"
                disabled={loading}
                data-testid="submit-order"
              >
                {loading ? t('checkout.processing') : t('checkout.submit')}
              </Button>
            </form>
          </div>

          {/* Order summary */}
          <div className="lg:col-span-1">
            <div className="bg-white border border-slate-200 rounded-lg p-6 sticky top-24">
              <h2 className="font-heading font-bold text-lg mb-4">{t('cart.summary')}</h2>
              
              <div className="space-y-3 mb-4 max-h-64 overflow-y-auto">
                {cart.items.map((item) => (
                  <div key={item.product_id} className="flex gap-3">
                    <div className="w-12 h-12 bg-slate-100 rounded overflow-hidden flex-shrink-0">
                      {item.product_image && (
                        <img src={getImageUrl(item.product_image)} alt="" className="w-full h-full object-cover" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium line-clamp-1">{item.product_name}</p>
                      <p className="text-xs text-slate-500">x{item.quantity}</p>
                    </div>
                    <p className="text-sm font-medium">{formatPrice(item.subtotal)}</p>
                  </div>
                ))}
              </div>

              <div className="border-t pt-4 space-y-2">
                <div className="flex justify-between text-sm text-slate-600">
                  <span>{t('cart.subtotal')}</span>
                  <span>{formatPrice(total)}</span>
                </div>
                <div className="flex justify-between text-sm text-slate-500">
                  <span>{t('delivery.fee')}</span>
                  <span className="text-xs italic">{t('delivery.discuss')}</span>
                </div>

                {/* Trade Assurance option */}
                <div className="flex items-start gap-2 bg-blue-50 rounded-lg p-3 mt-2">
                  <input type="checkbox" id="ta-checkout" className="mt-1 accent-blue-600"
                    checked={formData.trade_assurance || false}
                    onChange={(e) => setFormData(f => ({...f, trade_assurance: e.target.checked}))} />
                  <label htmlFor="ta-checkout" className="cursor-pointer">
                    <span className="text-sm font-medium text-blue-800 flex items-center gap-1">🛡️ {t('ta.title')}</span>
                    <span className="text-xs text-blue-600 block mt-0.5">{t('ta.desc')}</span>
                  </label>
                </div>

                <div className="border-t pt-2 flex justify-between font-heading font-bold text-lg">
                  <span>{t('cart.total')}</span>
                  <span className="text-primary">{formatPrice(total)}</span>
                </div>
              </div>

              <div className="flex items-center justify-center gap-4 mt-6 pt-4 border-t">
                <div className="flex items-center gap-2 text-slate-500">
                  <ShieldCheck className="w-5 h-5" />
                  <span className="text-xs">{t('checkout.secure')}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Mobile Money Dialog */}
      <Dialog open={mobileMoneyDialogOpen} onOpenChange={setMobileMoneyDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t('checkout.momo.title')}</DialogTitle>
            <DialogDescription>
              {mobileMoneyTransaction 
                ? t('checkout.momo.desc.pending')
                : t('checkout.momo.desc.init')}
            </DialogDescription>
          </DialogHeader>
          
          {!mobileMoneyTransaction ? (
            <div className="space-y-4 pt-4">
              <div>
                <Label>{t('checkout.momo.operator')}</Label>
                <Select 
                  value={mobileMoneyData.network} 
                  onValueChange={(val) => setMobileMoneyData({ ...mobileMoneyData, network: val })}
                >
                  <SelectTrigger data-testid="mobile-money-network">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="MTN">MTN Mobile Money</SelectItem>
                    <SelectItem value="Orange">Orange Money</SelectItem>
                    <SelectItem value="Airtel">Airtel Money</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>{t('checkout.momo.phone.label')}</Label>
                <Input
                  value={mobileMoneyData.phone_number}
                  onChange={(e) => setMobileMoneyData({ ...mobileMoneyData, phone_number: e.target.value })}
                  placeholder="+237 6XX XXX XXX"
                  data-testid="mobile-money-phone"
                />
              </div>
              <div className="bg-slate-50 rounded-lg p-4">
                <p className="text-sm text-slate-600">{t('checkout.momo.amount')}</p>
                <p className="text-2xl font-heading font-bold text-primary">{formatPrice(total)}</p>
              </div>
              <Button 
                className="w-full bg-accent hover:bg-accent-hover"
                onClick={handleMobileMoneyPayment}
                disabled={loading}
                data-testid="initiate-mobile-money"
              >
                {loading ? t('checkout.momo.sending') : t('checkout.momo.init')}
              </Button>
            </div>
          ) : (
            <div className="space-y-4 pt-4">
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <p className="font-semibold text-yellow-800 mb-2">{t('checkout.momo.instructions')}</p>
                <p className="text-sm text-yellow-700">{mobileMoneyTransaction.payment_instruction}</p>
              </div>
              <div className="bg-slate-50 rounded-lg p-4 text-center">
                <p className="text-sm text-slate-600">{t('checkout.momo.ref')}</p>
                <p className="font-mono text-sm font-bold">{mobileMoneyTransaction.transaction_id.slice(0, 8).toUpperCase()}</p>
                <p className="text-sm text-slate-600 mt-2">{t('checkout.momo.amount.label')}</p>
                <p className="text-xl font-bold text-primary">{formatPrice(mobileMoneyTransaction.amount)}</p>
              </div>
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-center">
                <p className="text-sm font-semibold text-blue-800 mb-1">{t('checkout.momo.waiting.title')}</p>
                <p className="text-xs text-blue-700">
                  {t('checkout.momo.waiting.desc')}
                </p>
              </div>
              <Button
                className="w-full bg-accent hover:bg-accent-hover"
                onClick={handleCloseMobileMoneyPending}
                data-testid="close-mobile-money-pending"
              >
                Compris, retour au tableau de bord
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </Layout>
  );
};

export default CheckoutPage;