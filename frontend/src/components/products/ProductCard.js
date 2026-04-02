import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Heart, ShoppingCart, Star, FileText } from '@phosphor-icons/react';
import { formatPrice } from '../../lib/utils';
import { useCart } from '../../context/CartContext';
import { useAuth } from '../../context/AuthContext';
import { favoritesAPI } from '../../lib/api';
import { toast } from 'sonner';
import { Button } from '../ui/button';

export const ProductCard = ({ product, onFavoriteToggle }) => {
  const navigate = useNavigate();
  const { addToCart, loading: cartLoading } = useCart();
  const { isAuthenticated } = useAuth();

  const [isFavorite, setIsFavorite] = useState(false);
  const [isAddingToCart, setIsAddingToCart] = useState(false);

  const handleAddToCart = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (!isAuthenticated) {
      toast.error('Veuillez vous connecter pour ajouter au panier');
      return;
    }

    setIsAddingToCart(true);
    try {
      await addToCart(product.id, product.min_order_quantity || 1);
      toast.success('Produit ajouté au panier');
    } catch (error) {
      toast.error('Erreur lors de l\'ajout au panier');
    } finally {
      setIsAddingToCart(false);
    }
  };

  const handleRequestQuote = (e) => {
    e.preventDefault();
    e.stopPropagation();

    if (!isAuthenticated) {
      toast.error('Veuillez vous connecter pour demander un devis');
      return;
    }

    navigate(`/rfq?productId=${product.id}`);
  };

  const handleToggleFavorite = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (!isAuthenticated) {
      toast.error('Veuillez vous connecter pour ajouter aux favoris');
      return;
    }

    try {
      if (isFavorite) {
        await favoritesAPI.remove(product.id);
        setIsFavorite(false);
        toast.success('Retiré des favoris');
      } else {
        await favoritesAPI.add(product.id);
        setIsFavorite(true);
        toast.success('Ajouté aux favoris');
      }
      onFavoriteToggle?.();
    } catch (error) {
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
            src={product.images[0]}
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
            isFavorite 
              ? 'text-red-500' 
              : 'text-slate-600 hover:text-red-500'
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
          <p className="text-xs uppercase tracking-widest text-accent mb-1">{product.category_name}</p>
        )}

        <h3 className="font-heading font-semibold text-slate-900 mb-2 line-clamp-2 leading-tight flex-grow">
          {product.name}
        </h3>

        {product.supplier_company && (
          <p className="text-sm text-slate-500 mb-4 line-clamp-1">
            {product.supplier_company}
          </p>
        )}

        {product.rating > 0 && (
          <div className="flex items-center gap-1 mb-4">
            <Star className="w-4 h-4 text-yellow-500" weight="fill" />
            <span className="text-sm font-medium">{product.rating.toFixed(1)}</span>
            <span className="text-xs text-slate-400">({product.review_count})</span>
          </div>
        )}

        {/* Price & Buttons - toujours alignés en bas */}
        <div className="mt-auto pt-4 border-t border-slate-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="pr-1 font-heading font-bold text-xl text-primary">
                {formatPrice(product.price)}
              </p>
              <p className="text-xs text-slate-500">
                Min. {product.min_order_quantity} {product.unit}
              </p>
            </div>

            <div className="flex gap-1.5">
              {/* <Button
                size="sm"
                variant="outline"
                onClick={handleRequestQuote}
                className="border-accent text-accent hover:bg-accent hover:text-white h-9 w-9 p-0"
                title="Demander un devis"
              >
                <FileText className="w-4 h-4" />
              </Button> */}

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
      </div>
    </Link>
  );
};