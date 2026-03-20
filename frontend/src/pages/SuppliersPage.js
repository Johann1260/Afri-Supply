import React, { useState, useEffect } from 'react';
import { Link, useParams } from 'react-router-dom';
import { 
  Star,
  MapPin,
  Package,
  ShoppingCart,
  ChatCircle,
  Calendar,
  TrendUp,
  Users
} from '@phosphor-icons/react';
import { Layout } from '../components/layout';
import { ProductGrid } from '../components/products';
import { Button } from '../components/ui/button';
import { Progress } from '../components/ui/progress';
import api from '../lib/api';
import { productsAPI } from '../lib/api';
import { formatDate } from '../lib/utils';

const SuppliersPage = () => {
  const { supplierId } = useParams();
  const [suppliers, setSuppliers] = useState([]);
  const [selectedSupplier, setSelectedSupplier] = useState(null);
  const [supplierProducts, setSupplierProducts] = useState([]);
  const [supplierRatings, setSupplierRatings] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (supplierId) {
      fetchSupplierProfile(supplierId);
    } else {
      fetchSuppliers();
    }
  }, [supplierId]);

  const fetchSuppliers = async () => {
    try {
      const res = await api.get('/suppliers');
      setSuppliers(res.data);
    } catch (error) {
      console.error('Failed to fetch suppliers:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchSupplierProfile = async (id) => {
    try {
      const [profileRes, productsRes, ratingsRes] = await Promise.all([
        api.get(`/suppliers/${id}/profile`),
        productsAPI.getAll({ supplier_id: id, limit: 12 }),
        api.get(`/suppliers/${id}/ratings`)
      ]);
      
      setSelectedSupplier(profileRes.data);
      setSupplierProducts(productsRes.data);
      setSupplierRatings(ratingsRes.data);
    } catch (error) {
      console.error('Failed to fetch supplier profile:', error);
    } finally {
      setLoading(false);
    }
  };

  const RatingStars = ({ rating, size = 'md' }) => {
    const starSize = size === 'sm' ? 'w-4 h-4' : 'w-5 h-5';
    return (
      <div className="flex items-center gap-0.5">
        {[...Array(5)].map((_, i) => (
          <Star 
            key={i}
            className={`${starSize} ${i < Math.round(rating) ? 'text-yellow-500' : 'text-slate-200'}`}
            weight={i < Math.round(rating) ? 'fill' : 'regular'}
          />
        ))}
      </div>
    );
  };

  const RatingBar = ({ label, value, max = 5 }) => (
    <div className="flex items-center gap-3">
      <span className="text-sm text-slate-600 w-32">{label}</span>
      <Progress value={(value / max) * 100} className="flex-1 h-2" />
      <span className="text-sm font-medium w-8">{value.toFixed(1)}</span>
    </div>
  );

  // Supplier detail view
  if (supplierId && selectedSupplier) {
    return (
      <Layout>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Header */}
          <div className="bg-white border border-slate-200 rounded-lg p-6 mb-8">
            <div className="flex flex-col md:flex-row gap-6">
              {/* Avatar */}
              <div className="w-24 h-24 bg-primary/10 rounded-xl flex items-center justify-center flex-shrink-0">
                <Users className="w-12 h-12 text-primary" weight="duotone" />
              </div>
              
              {/* Info */}
              <div className="flex-1">
                <h1 className="font-heading font-bold text-2xl mb-1">
                  {selectedSupplier.company_name || selectedSupplier.full_name}
                </h1>
                <p className="text-slate-500">{selectedSupplier.full_name}</p>
                
                <div className="flex flex-wrap gap-4 mt-3">
                  {selectedSupplier.city && (
                    <span className="flex items-center gap-1 text-sm text-slate-600">
                      <MapPin className="w-4 h-4" />
                      {selectedSupplier.city}, {selectedSupplier.country}
                    </span>
                  )}
                  <span className="flex items-center gap-1 text-sm text-slate-600">
                    <Calendar className="w-4 h-4" />
                    Membre depuis {formatDate(selectedSupplier.member_since)}
                  </span>
                </div>

                {/* Rating */}
                <div className="flex items-center gap-3 mt-4">
                  <RatingStars rating={selectedSupplier.rating} />
                  <span className="font-bold text-lg">{selectedSupplier.rating.toFixed(1)}</span>
                  <span className="text-slate-500">({selectedSupplier.rating_count} avis)</span>
                </div>
              </div>

              {/* Stats */}
              <div className="flex gap-6 md:gap-8">
                <div className="text-center">
                  <p className="text-2xl font-bold text-primary">{selectedSupplier.products_count}</p>
                  <p className="text-sm text-slate-500">Produits</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-green-600">{selectedSupplier.orders_completed}</p>
                  <p className="text-sm text-slate-500">Commandes</p>
                </div>
              </div>
            </div>
          </div>

          <div className="grid lg:grid-cols-3 gap-8">
            {/* Left - Ratings breakdown */}
            <div className="lg:col-span-1 space-y-6">
              <div className="bg-white border border-slate-200 rounded-lg p-6">
                <h2 className="font-heading font-bold text-lg mb-4">Évaluation détaillée</h2>
                <div className="space-y-3">
                  <RatingBar label="Note globale" value={selectedSupplier.rating} />
                  <RatingBar label="Communication" value={selectedSupplier.communication_avg} />
                  <RatingBar label="Qualité produits" value={selectedSupplier.quality_avg} />
                  <RatingBar label="Respect délais" value={selectedSupplier.delivery_avg} />
                </div>
              </div>

              {/* Recent reviews */}
              <div className="bg-white border border-slate-200 rounded-lg p-6">
                <h2 className="font-heading font-bold text-lg mb-4">Avis récents</h2>
                {supplierRatings.length === 0 ? (
                  <p className="text-slate-500 text-sm">Aucun avis pour le moment</p>
                ) : (
                  <div className="space-y-4">
                    {supplierRatings.slice(0, 5).map((rating) => (
                      <div key={rating.id} className="border-b border-slate-100 pb-4 last:border-0 last:pb-0">
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-medium">{rating.buyer_name}</span>
                          <RatingStars rating={rating.rating} size="sm" />
                        </div>
                        {rating.comment && (
                          <p className="text-sm text-slate-600">{rating.comment}</p>
                        )}
                        <p className="text-xs text-slate-400 mt-1">{formatDate(rating.created_at)}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Right - Products */}
            <div className="lg:col-span-2">
              <h2 className="font-heading font-bold text-lg mb-4">Produits ({supplierProducts.length})</h2>
              <ProductGrid products={supplierProducts} loading={loading} />
            </div>
          </div>
        </div>
      </Layout>
    );
  }

  // Suppliers list view
  return (
    <Layout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="section-heading">Nos Fournisseurs</h1>
          <p className="text-slate-500 mt-2">
            Découvrez nos fournisseurs industriels certifiés en zone CEMAC
          </p>
        </div>

        {loading ? (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="bg-white border border-slate-200 rounded-lg p-6 animate-pulse">
                <div className="flex gap-4">
                  <div className="w-16 h-16 bg-slate-200 rounded-xl" />
                  <div className="flex-1 space-y-2">
                    <div className="h-5 bg-slate-200 rounded w-3/4" />
                    <div className="h-4 bg-slate-200 rounded w-1/2" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : suppliers.length === 0 ? (
          <div className="text-center py-12">
            <Users className="w-12 h-12 mx-auto text-slate-300 mb-4" />
            <p className="text-slate-500">Aucun fournisseur trouvé</p>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {suppliers.map((supplier) => (
              <Link
                key={supplier.id}
                to={`/suppliers/${supplier.id}`}
                className="bg-white border border-slate-200 rounded-lg p-6 hover:border-accent hover:shadow-md transition-all group"
                data-testid={`supplier-card-${supplier.id}`}
              >
                <div className="flex gap-4">
                  {/* Avatar */}
                  <div className="w-16 h-16 bg-primary/10 rounded-xl flex items-center justify-center flex-shrink-0 group-hover:bg-primary/20 transition-colors">
                    <Users className="w-8 h-8 text-primary" weight="duotone" />
                  </div>
                  
                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <h3 className="font-heading font-bold text-lg truncate group-hover:text-accent transition-colors">
                      {supplier.company_name || supplier.full_name}
                    </h3>
                    {supplier.city && (
                      <p className="text-sm text-slate-500 flex items-center gap-1">
                        <MapPin className="w-3 h-3" />
                        {supplier.city}, {supplier.country}
                      </p>
                    )}
                  </div>
                </div>

                {/* Rating */}
                <div className="flex items-center gap-2 mt-4">
                  <RatingStars rating={supplier.rating} size="sm" />
                  <span className="font-medium">{supplier.rating.toFixed(1)}</span>
                  <span className="text-slate-400 text-sm">({supplier.rating_count})</span>
                </div>

                {/* Stats */}
                <div className="flex gap-4 mt-4 pt-4 border-t border-slate-100">
                  <div className="flex items-center gap-1 text-sm text-slate-600">
                    <Package className="w-4 h-4" />
                    {supplier.products_count} produits
                  </div>
                  <div className="flex items-center gap-1 text-sm text-slate-600">
                    <ShoppingCart className="w-4 h-4" />
                    {supplier.orders_completed} commandes
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
};

export default SuppliersPage;
