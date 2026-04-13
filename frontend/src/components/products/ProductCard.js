import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Heart, ShoppingCart, Star } from '@phosphor-icons/react';
import { formatPrice, getImageUrl } from '../../lib/utils';
import { useCart } from '../../context/CartContext';
import { useAuth } from '../../context/AuthContext';
import { useLocale } from '../../context/LocaleContext';
import { favoritesAPI } from '../../lib/api';
import { registerFavoritesCacheReset } from '../../context/AuthContext';
import { toast } from 'sonner';
import { Button } from '../ui/button';

let _favoritesCache = null;
let _favoritesLoading = false;
let _favoritesCallbacks = [];

// Expose reset to AuthContext
registerFavoritesCacheReset(() => { _favoritesCache = null; });

const loadFavoritesOnce = (callback) => {
  if (_favoritesCache !== null) {
    callback(_favoritesCache);
    return;
  }
  _favoritesCallbacks.push(callback);
  if (_favoritesLoading) return;

  _favoritesLoading = true;
  favoritesAPI
    .getAll()
    .then((res) => {
      _favoritesCache = new Set((res.data || []).map((p) => p.id));
      _favoritesCallbacks.forEach((cb) => cb(_favoritesCache));
      _favoritesCallbacks = [];
    })
    .catch(() => {
      _favoritesCache = new Set();
      _favoritesCallbacks.forEach((cb) => cb(_favoritesCache));
      _favoritesCallbacks = [];
    })
    .finally(() => {
      _favoritesLoading = false;
    });
};

// Invalider le cache quand on ajoute/supprime un favori
const invalidateFavoritesCache = () => {
  _favoritesCache = null;
};

export const ProductCard = ({ product, onFavoriteToggle }) => {
  const navigate = useNavigate();
  const { addToCart, loading: cartLoading } = useCart();
  const { isAuthenticated } = useAuth();
  const { t } = useLocale();

  const [isFavorite, setIsFavorite] = useState(false);
  const [isAddingToCart, setIsAddingToCart] = useState(false);

  // P2-10: charger l'état favori initial depuis l'API (via cache partagé)
  useEffect(() => {
    if (!isAuthenticated) return;
    loadFavoritesOnce((favSet) => {
      setIsFavorite(favSet.has(product.id));
    });
  }, [isAuthenticated, product.id]);

  const handleAddToCart = async (e) => {
    e.preventDefault();
    e.stopPropagation();

    if (!isAuthenticated) {
      toast.error(t('products.addToCart') + ' — connexion requise');
      return;
    }

    setIsAddingToCart(true);
    try {
      await addToCart(product.id, product.min_order_quantity || 1);
      toast.success('Produit ajouté au panier');
    } catch (error) {
      toast.error(t('common.error'));
    } finally {
      setIsAddingToCart(false);
    }
  };

  const handleToggleFavorite = async (e) => {
    e.preventDefault();
    e.stopPropagation();

    if (!isAuthenticated) {
      toast.error(t('nav.login'));
      return;
    }

    const newState = !isFavorite;
    setIsFavorite(newState); // optimiste

    try {
      if (isFavorite) {
        await favoritesAPI.remove(product.id);
        toast.success('Retiré des favoris');
      } else {
        await favoritesAPI.add(product.id);
        toast.success('Ajouté aux favoris');
      }
      // Invalider le cache pour la prochaine lecture
      invalidateFavoritesCache();
      onFavoriteToggle?.();
    } catch (error) {
      setIsFavorite(!newState); // rollback
      toast.error('Erreur');
    }
  };

  return (
    <Link
      to={`/products/${product.id}`}
      className="card-product group h-full flex flex-col bg-white border border-slate-200 rounded-xl overflow-hidden hover:shadow-lg transition-all duration-300"
      data-testid={`product-card-${product.id}`}
    >
      {/* Image */}
      <div className="relative aspect-square overflow-hidden bg-slate-100 flex-shrink-0">
        {product.images?.[0] ? (
          <img
            src={getImageUrl(product.images[0])}
            alt={product.name}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-slate-400">
            <ShoppingCart className="w-12 h-12" />
          </div>
        )}

        {/* Favorite button */}
        <button
          onClick={handleToggleFavorite}
          className={`absolute top-3 right-3 p-2 rounded-full bg-white/90 backdrop-blur-sm transition-all ${
            isFavorite ? 'text-red-500' : 'text-slate-600 hover:text-red-500'
          }`}
        >
          <Heart className="w-5 h-5" weight={isFavorite ? 'fill' : 'regular'} />
        </button>

        {!product.is_available && (
          <div className="absolute top-3 left-3 px-3 py-1 bg-red-500 text-white text-xs font-bold rounded">
            Rupture
          </div>
        )}
      </div>

      {/* Content */}
      <div className="p-5 flex flex-col flex-grow">
        {product.category_name && (
          <p className="text-xs uppercase tracking-widest text-accent mb-1">
            {product.category_name}
          </p>
        )}

        <h3 className="font-heading font-semibold text-slate-900 mb-2 line-clamp-2 leading-tight flex-grow">
          {product.name}
        </h3>

        {product.supplier_company && (
          <p className="text-sm text-slate-500 mb-4 line-clamp-1">{product.supplier_company}</p>
        )}

        {product.rating > 0 && (
          <div className="flex items-center gap-1 mb-4">
            <Star className="w-4 h-4 text-yellow-500" weight="fill" />
            <span className="text-sm font-medium">{product.rating.toFixed(1)}</span>
            <span className="text-xs text-slate-400">({product.review_count})</span>
          </div>
        )}

        {/* Price & Buttons */}
        <div className="mt-auto pt-4 border-t border-slate-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-heading font-bold text-xl text-primary">
                {formatPrice(product.price)}
              </p>
              <p className="text-xs text-slate-500">
                {t('products.minOrder')} {product.min_order_quantity} {product.unit}
              </p>
            </div>

            <Button
              size="sm"
              onClick={handleAddToCart}
              disabled={!product.is_available || isAddingToCart || cartLoading}
              className="bg-accent hover:bg-accent-hover h-9 w-9"
            >
              <ShoppingCart className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>
    </Link>
  );
};