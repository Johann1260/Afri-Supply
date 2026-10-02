import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Trash, Plus, Minus, ShoppingCart, ArrowRight } from '@phosphor-icons/react';
import { Layout } from '../components/layout';
import { Button } from '../components/ui/button';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';
import { useLocale } from '../context/LocaleContext';
import { formatPrice, getImageUrl } from '../lib/utils';
import { toast } from 'sonner';

const CartPage = () => {
  const navigate = useNavigate();
  const { cart, updateQuantity, removeFromCart, loading } = useCart();
  const { isAuthenticated } = useAuth();
  const { t, localizeAnon } = useLocale();

  const handleQuantityChange = async (productId, newQuantity) => {
    try {
      await updateQuantity(productId, newQuantity);
    } catch {
      toast.error(t('cart.update.err'));
    }
  };

  const handleRemove = async (productId) => {
    try {
      await removeFromCart(productId);
      toast.success(t('cart.remove.ok'));
    } catch {
      toast.error(t('cart.remove.err'));
    }
  };

  const handleCheckout = () => {
    if (!isAuthenticated) {
      toast.error(t('cart.login.required'));
      navigate('/login');
      return;
    }
    navigate('/checkout');
  };

  return (
    <Layout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <h1 className="section-heading mb-8">{t('cart.title')}</h1>

        {cart.items.length === 0 ? (
          <div className="text-center py-16">
            <ShoppingCart className="w-16 h-16 mx-auto text-slate-300 mb-4" />
            <h2 className="font-heading font-bold text-xl text-slate-900 mb-2">
              {t('cart.empty')}
            </h2>
            <p className="text-slate-500 mb-6">{t('cart.empty.sub')}</p>
            <Link to="/products">
              <Button className="bg-accent hover:bg-accent-hover" data-testid="continue-shopping">
                {t('cart.empty.cta')}
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </Link>
          </div>
        ) : (
          <div className="grid lg:grid-cols-3 gap-8">
            {/* Items */}
            <div className="lg:col-span-2 space-y-4">
              {cart.items.map((item) => (
                <div
                  key={item.product_id}
                  className="flex gap-4 p-4 bg-white border border-slate-200 rounded-lg"
                  data-testid={`cart-item-${item.product_id}`}
                >
                  <div className="w-24 h-24 flex-shrink-0 bg-slate-100 rounded-lg overflow-hidden">
                    {item.product_image ? (
                      <img src={getImageUrl(item.product_image)} alt={item.product_name} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <ShoppingCart className="w-8 h-8 text-slate-300" />
                      </div>
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <Link
                      to={`/products/${item.product_id}`}
                      className="font-semibold text-slate-900 hover:text-accent line-clamp-1"
                    >
                      {item.product_name}
                    </Link>
                    <p className="text-sm text-slate-500 mt-1">{t('cart.seller')}: {localizeAnon(item.supplier_name)}</p>
                    <p className="text-sm text-slate-500">{formatPrice(item.price)} / {item.unit}</p>

                    <div className="flex items-center gap-4 mt-3">
                      <div className="flex items-center border border-slate-200 rounded-md">
                        <button
                          onClick={() => handleQuantityChange(item.product_id, item.quantity - 1)}
                          disabled={item.quantity <= 1 || loading}
                          className="p-2 hover:bg-slate-50 disabled:opacity-50"
                          data-testid={`decrease-${item.product_id}`}
                        >
                          <Minus className="w-4 h-4" />
                        </button>
                        <span className="w-12 text-center font-medium">{item.quantity}</span>
                        <button
                          onClick={() => handleQuantityChange(item.product_id, item.quantity + 1)}
                          disabled={loading}
                          className="p-2 hover:bg-slate-50 disabled:opacity-50"
                          data-testid={`increase-${item.product_id}`}
                        >
                          <Plus className="w-4 h-4" />
                        </button>
                      </div>
                      <button
                        onClick={() => handleRemove(item.product_id)}
                        disabled={loading}
                        className="text-red-500 hover:text-red-600 p-2"
                        data-testid={`remove-${item.product_id}`}
                      >
                        <Trash className="w-5 h-5" />
                      </button>
                    </div>
                  </div>

                  <div className="text-right">
                    <p className="font-heading font-bold text-lg text-primary">
                      {formatPrice(item.subtotal)}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            {/* Summary */}
            <div className="lg:col-span-1">
              <div className="bg-white border border-slate-200 rounded-lg p-6 sticky top-24">
                <h2 className="font-heading font-bold text-lg mb-4">{t('cart.summary')}</h2>
                <div className="space-y-3 mb-6">
                  <div className="flex justify-between text-slate-600">
                    <span>{t('cart.subtotal')} ({cart.item_count} {t('cart.items')})</span>
                    <span>{formatPrice(cart.total)}</span>
                  </div>
                  <div className="border-t pt-3 flex justify-between font-heading font-bold text-lg">
                    <span>{t('cart.total')}</span>
                    <span className="text-primary">{formatPrice(cart.total)}</span>
                  </div>
                </div>
                <Button
                  className="w-full bg-accent hover:bg-accent-hover"
                  onClick={handleCheckout}
                  disabled={loading}
                  data-testid="checkout-button"
                >
                  {t('cart.checkout')}
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
                <p className="text-xs text-slate-500 text-center mt-4">{t('cart.secure')}</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
};

export default CartPage;