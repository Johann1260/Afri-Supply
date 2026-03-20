import React from 'react';
import { Link } from 'react-router-dom';
import { Heart, ShoppingCart, Star } from '@phosphor-icons/react';
import { formatPrice, truncateText } from '../../lib/utils';
import { useCart } from '../../context/CartContext';
import { useAuth } from '../../context/AuthContext';
import { favoritesAPI } from '../../lib/api';
import { toast } from 'sonner';
import { Button } from '../ui/button';

export const ProductCard = ({ product, onFavoriteToggle }) => {
  const { addToCart, loading: cartLoading } = useCart();
  const { isAuthenticated } = useAuth();
  const [isFavorite, setIsFavorite] = React.useState(false);
  const [isAddingToCart, setIsAddingToCart] = React.useState(false);

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
      className="card-product group block"
      data-testid={`product-card-${product.id}`}
    >
      {/* Image */}
      <div className="relative aspect-square overflow-hidden bg-slate-100">
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
          className={`absolute top-3 right-3 p-2 rounded-full transition-colors ${
            isFavorite 
              ? 'bg-red-500 text-white' 
              : 'bg-white/90 text-slate-600 hover:bg-white hover:text-red-500'
          }`}
          data-testid={`favorite-btn-${product.id}`}
        >
          <Heart className="w-5 h-5" weight={isFavorite ? 'fill' : 'regular'} />
        </button>

        {/* Stock badge */}
        {!product.is_available && (
          <div className="absolute top-3 left-3 px-2 py-1 bg-red-500 text-white text-xs font-bold rounded">
            Rupture
          </div>
        )}
      </div>

      {/* Content */}
      <div className="p-4">
        {/* Category */}
        {product.category_name && (
          <p className="overline text-accent mb-1">{product.category_name}</p>
        )}
        
        {/* Name */}
        <h3 className="font-heading font-bold text-slate-900 mb-1 line-clamp-2">
          {product.name}
        </h3>
        
        {/* Supplier */}
        {product.supplier_company && (
          <p className="text-sm text-slate-500 mb-2">
            {product.supplier_company}
          </p>
        )}

        {/* Rating */}
        {product.rating > 0 && (
          <div className="flex items-center gap-1 mb-2">
            <Star className="w-4 h-4 text-yellow-500" weight="fill" />
            <span className="text-sm font-medium">{product.rating.toFixed(1)}</span>
            <span className="text-sm text-slate-400">({product.review_count})</span>
          </div>
        )}

        {/* Price & CTA */}
        <div className="flex items-end justify-between mt-3 pt-3 border-t border-slate-100">
          <div>
            <p className="font-heading font-bold text-lg text-primary">
              {formatPrice(product.price)}
            </p>
            <p className="text-xs text-slate-500">
              Min. {product.min_order_quantity} {product.unit}
            </p>
          </div>
          
          <Button
            size="sm"
            onClick={handleAddToCart}
            disabled={!product.is_available || isAddingToCart || cartLoading}
            className="bg-accent hover:bg-accent-hover"
            data-testid={`add-to-cart-${product.id}`}
          >
            <ShoppingCart className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </Link>
  );
};
