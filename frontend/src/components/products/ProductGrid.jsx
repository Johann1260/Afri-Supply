import React from 'react';
import { ProductCard } from './ProductCard';
import { useLocale } from '../../context/LocaleContext';

export const ProductGrid = ({ products, loading, onFavoriteToggle }) => {
  const { t } = useLocale();

  if (loading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {[...Array(8)].map((_, i) => (
          <div key={i} className="bg-white border border-slate-200 rounded-lg overflow-hidden animate-pulse">
            <div className="aspect-square bg-slate-200" />
            <div className="p-4 space-y-3">
              <div className="h-3 bg-slate-200 rounded w-1/4" />
              <div className="h-5 bg-slate-200 rounded w-3/4" />
              <div className="h-4 bg-slate-200 rounded w-1/2" />
              <div className="flex justify-between items-end pt-3 border-t border-slate-100">
                <div className="space-y-1">
                  <div className="h-5 bg-slate-200 rounded w-20" />
                  <div className="h-3 bg-slate-200 rounded w-16" />
                </div>
                <div className="w-10 h-10 bg-slate-200 rounded" />
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (!products || products.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-slate-500">{t('common.noResults')}</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
      {products.map((product) => (
        <ProductCard key={product.id} product={product} onFavoriteToggle={onFavoriteToggle} />
      ))}
    </div>
  );
};