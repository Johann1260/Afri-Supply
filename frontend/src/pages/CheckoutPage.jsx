import React, { useState, useEffect } from 'react';
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

  const checkPaymentStatus = async (sid) => {
    setPaymentStatus('checking');
    let attempts = 0;
    const maxAttempts = 5;

    const poll = async () => {
      try {
        const res = await paymentAPI.getCheckoutStatus(sid);
        
        if (res.data.payment_status === 'paid') {
          setPaymentStatus('success');
          refreshCart();
          return;
        } else if (res.data.status === 'expired') {
          setPaymentStatus('failed');
          return;
        }

        attempts++;
        if (attempts < maxAttempts) {
          setTimeout(poll, 2000);
        } else {
          setPaymentStatus('pending');
        }
      } catch (error) {
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
      await ordersAPI.create(formData);

      if (formData.payment_method === 'mobile_money') {
        setMobileMoneyDialogOpen(true);
        setLoading(false);
      } else {
        const originUrl = window.location.origin;
        const res = await paymentAPI.createCheckoutSession(originUrl);
        window.location.href = res.data.url;
      }
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Erreur lors de la commande');
      setLoading(false);
    }
  };

  const handleMobileMoneyPayment = async () => {
    if (!mobileMoneyData.phone_number) {
      toast.error('Veuillez entrer votre numéro de téléphone');
      return;
    }

    setLoading(true);
    try {
      const res = await mobileMoneyAPI.createPayment(mobileMoneyData);
      setMobileMoneyTransaction(res.data);
      toast.success('Demande de paiement envoyée');
    } catch (error) {
      toast.error("Erreur lors de l'initialisation du paiement");
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmMobileMoneyPayment = async () => {
    if (!mobileMoneyTransaction) return;

    setLoading(true);
    try {
      await mobileMoneyAPI.confirmPayment(mobileMoneyTransaction.transaction_id);
      setPaymentStatus('success');
      refreshCart();
      setMobileMoneyDialogOpen(false);
    } catch (error) {
      toast.error('Erreur lors de la confirmation');
    } finally {
      setLoading(false);
    }
  };

  // Payment status screens
  if (paymentStatus === 'checking') {
    return (
      <Layout>
        <div className="max-w-md mx-auto px-4 py-20 text-center">
          <Spinner className="w-12 h-12 mx-auto text-accent animate-spin mb-4" />
          <h1 className="font-heading font-bold text-2xl mb-2">{t('checkout.checking')}</h1>
          <p className="text-slate-500">Veuillez patienter</p>
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
            Votre commande a été confirmée. Vous recevrez un email de confirmation.
          </p>
          <Button 
            onClick={() => navigate('/dashboard')}
            className="bg-accent hover:bg-accent-hover"
            data-testid="view-orders"
          >
            Voir mes commandes
          </Button>
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
            Une erreur est survenue lors du paiement. Veuillez réessayer.
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

  if (cart.items.length === 0 && !sessionId) {
    navigate('/cart');
    return null;
  }

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
                          <SelectValue placeholder="Sélectionner un pays" />
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
            <DialogTitle>Paiement Mobile Money</DialogTitle>
            <DialogDescription>
              {mobileMoneyTransaction 
                ? 'Suivez les instructions pour finaliser le paiement'
                : 'Entrez vos informations de paiement'}
            </DialogDescription>
          </DialogHeader>
          
          {!mobileMoneyTransaction ? (
            <div className="space-y-4 pt-4">
              <div>
                <Label>Opérateur *</Label>
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
                <Label>Numéro de téléphone *</Label>
                <Input
                  value={mobileMoneyData.phone_number}
                  onChange={(e) => setMobileMoneyData({ ...mobileMoneyData, phone_number: e.target.value })}
                  placeholder="+237 6XX XXX XXX"
                  data-testid="mobile-money-phone"
                />
              </div>
              <div className="bg-slate-50 rounded-lg p-4">
                <p className="text-sm text-slate-600">Montant à payer:</p>
                <p className="text-2xl font-heading font-bold text-primary">{formatPrice(total)}</p>
              </div>
              <Button 
                className="w-full bg-accent hover:bg-accent-hover"
                onClick={handleMobileMoneyPayment}
                disabled={loading}
                data-testid="initiate-mobile-money"
              >
                {loading ? 'Envoi en cours...' : 'Initier le paiement'}
              </Button>
            </div>
          ) : (
            <div className="space-y-4 pt-4">
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <p className="font-semibold text-yellow-800 mb-2">Instructions de paiement</p>
                <p className="text-sm text-yellow-700">{mobileMoneyTransaction.payment_instruction}</p>
              </div>
              <div className="bg-slate-50 rounded-lg p-4 text-center">
                <p className="text-sm text-slate-600">Transaction ID:</p>
                <p className="font-mono text-sm">{mobileMoneyTransaction.transaction_id.slice(0, 8)}...</p>
                <p className="text-sm text-slate-600 mt-2">Montant:</p>
                <p className="text-xl font-bold text-primary">{formatPrice(mobileMoneyTransaction.amount)}</p>
              </div>
              <p className="text-sm text-slate-500 text-center">
                Une fois le paiement effectué sur votre téléphone, cliquez sur le bouton ci-dessous.
              </p>
              <Button 
                className="w-full bg-green-600 hover:bg-green-700"
                onClick={handleConfirmMobileMoneyPayment}
                disabled={loading}
                data-testid="confirm-mobile-money"
              >
                {loading ? 'Vérification...' : "J'ai effectué le paiement"}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </Layout>
  );
};

export default CheckoutPage;