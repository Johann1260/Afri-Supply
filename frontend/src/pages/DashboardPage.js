import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { 
  Package, 
  ShoppingCart, 
  Heart,
  ChatCircle,
  TrendUp,
  Plus,
  Clock,
  CheckCircle,
  Truck,
  Eye
} from '@phosphor-icons/react';
import { Layout } from '../components/layout';
import { Button } from '../components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { useAuth } from '../context/AuthContext';
import { ordersAPI, productsAPI, supplierAPI, favoritesAPI } from '../lib/api';
import { formatPrice, formatDate, getStatusColor, getStatusLabel } from '../lib/utils';

const DashboardPage = () => {
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuth();
  const [orders, setOrders] = useState([]);
  const [products, setProducts] = useState([]);
  const [favorites, setFavorites] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/login');
      return;
    }

    const fetchData = async () => {
      try {
        const ordersRes = await ordersAPI.getAll();
        setOrders(ordersRes.data);

        if (user?.user_type === 'supplier') {
          const [productsRes, statsRes] = await Promise.all([
            productsAPI.getSupplierProducts(),
            supplierAPI.getStats()
          ]);
          setProducts(productsRes.data);
          setStats(statsRes.data);
        } else {
          const favRes = await favoritesAPI.getAll();
          setFavorites(favRes.data);
        }
      } catch (error) {
        console.error('Failed to fetch data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [isAuthenticated, user, navigate]);

  const isSupplier = user?.user_type === 'supplier';

  const StatCard = ({ icon: Icon, label, value, color = 'primary' }) => (
    <div className="bg-white border border-slate-200 rounded-lg p-6">
      <div className={`w-12 h-12 bg-${color}/10 rounded-lg flex items-center justify-center mb-4`}>
        <Icon className={`w-6 h-6 text-${color}`} weight="duotone" />
      </div>
      <p className="text-2xl font-heading font-bold">{value}</p>
      <p className="text-sm text-slate-500">{label}</p>
    </div>
  );

  if (loading) {
    return (
      <Layout>
        <div className="max-w-7xl mx-auto px-4 py-8">
          <div className="animate-pulse space-y-6">
            <div className="h-8 bg-slate-200 rounded w-1/4" />
            <div className="grid grid-cols-4 gap-6">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="h-32 bg-slate-200 rounded-lg" />
              ))}
            </div>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-8">
          <div>
            <h1 className="section-heading">
              Bonjour, {user?.full_name?.split(' ')[0]}
            </h1>
            <p className="text-slate-500">
              {isSupplier ? 'Gérez votre boutique et vos commandes' : 'Suivez vos commandes et favoris'}
            </p>
          </div>
          
          {isSupplier && (
            <Link to="/dashboard/products/new">
              <Button className="bg-accent hover:bg-accent-hover" data-testid="add-product">
                <Plus className="w-4 h-4 mr-2" />
                Ajouter un produit
              </Button>
            </Link>
          )}
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {isSupplier ? (
            <>
              <StatCard 
                icon={Package} 
                label="Produits" 
                value={stats?.products_count || 0} 
              />
              <StatCard 
                icon={ShoppingCart} 
                label="Commandes" 
                value={stats?.total_orders || 0} 
              />
              <StatCard 
                icon={Clock} 
                label="En attente" 
                value={stats?.pending_orders || 0}
                color="yellow-500"
              />
              <StatCard 
                icon={TrendUp} 
                label="Revenus" 
                value={formatPrice(stats?.total_revenue || 0)} 
                color="green-500"
              />
            </>
          ) : (
            <>
              <StatCard 
                icon={ShoppingCart} 
                label="Commandes" 
                value={orders.length} 
              />
              <StatCard 
                icon={Clock} 
                label="En cours" 
                value={orders.filter(o => !['delivered', 'cancelled'].includes(o.status)).length}
                color="yellow-500"
              />
              <StatCard 
                icon={CheckCircle} 
                label="Livrées" 
                value={orders.filter(o => o.status === 'delivered').length}
                color="green-500"
              />
              <StatCard 
                icon={Heart} 
                label="Favoris" 
                value={favorites.length} 
              />
            </>
          )}
        </div>

        {/* Main content */}
        <Tabs defaultValue="orders" className="space-y-6">
          <TabsList>
            <TabsTrigger value="orders">
              <ShoppingCart className="w-4 h-4 mr-2" />
              Commandes
            </TabsTrigger>
            {isSupplier ? (
              <TabsTrigger value="products">
                <Package className="w-4 h-4 mr-2" />
                Produits
              </TabsTrigger>
            ) : (
              <TabsTrigger value="favorites">
                <Heart className="w-4 h-4 mr-2" />
                Favoris
              </TabsTrigger>
            )}
          </TabsList>

          {/* Orders tab */}
          <TabsContent value="orders">
            <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
              {orders.length === 0 ? (
                <div className="text-center py-12">
                  <ShoppingCart className="w-12 h-12 mx-auto text-slate-300 mb-4" />
                  <p className="text-slate-500">Aucune commande pour le moment</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-slate-50 border-b border-slate-200">
                      <tr>
                        <th className="text-left px-6 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">
                          Commande
                        </th>
                        <th className="text-left px-6 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">
                          {isSupplier ? 'Acheteur' : 'Fournisseur'}
                        </th>
                        <th className="text-left px-6 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">
                          Total
                        </th>
                        <th className="text-left px-6 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">
                          Statut
                        </th>
                        <th className="text-left px-6 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">
                          Date
                        </th>
                        <th className="px-6 py-3"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {orders.map((order) => (
                        <tr key={order.id} className="hover:bg-slate-50" data-testid={`order-row-${order.id}`}>
                          <td className="px-6 py-4">
                            <p className="font-mono text-sm font-medium">{order.order_number}</p>
                            <p className="text-xs text-slate-500">{order.items?.length} article(s)</p>
                          </td>
                          <td className="px-6 py-4">
                            <p className="font-medium">
                              {isSupplier ? order.buyer_name : order.supplier_name}
                            </p>
                          </td>
                          <td className="px-6 py-4 font-medium">
                            {formatPrice(order.total)}
                          </td>
                          <td className="px-6 py-4">
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${getStatusColor(order.status)}`}>
                              {getStatusLabel(order.status)}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-sm text-slate-500">
                            {formatDate(order.created_at)}
                          </td>
                          <td className="px-6 py-4">
                            <Link to={`/orders/${order.id}`}>
                              <Button variant="ghost" size="sm">
                                <Eye className="w-4 h-4" />
                              </Button>
                            </Link>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </TabsContent>

          {/* Products tab (supplier) */}
          {isSupplier && (
            <TabsContent value="products">
              <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
                {products.length === 0 ? (
                  <div className="text-center py-12">
                    <Package className="w-12 h-12 mx-auto text-slate-300 mb-4" />
                    <p className="text-slate-500 mb-4">Vous n'avez pas encore de produits</p>
                    <Link to="/dashboard/products/new">
                      <Button className="bg-accent hover:bg-accent-hover">
                        <Plus className="w-4 h-4 mr-2" />
                        Ajouter un produit
                      </Button>
                    </Link>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-slate-50 border-b border-slate-200">
                        <tr>
                          <th className="text-left px-6 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">
                            Produit
                          </th>
                          <th className="text-left px-6 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">
                            Prix
                          </th>
                          <th className="text-left px-6 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">
                            Stock
                          </th>
                          <th className="text-left px-6 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">
                            Note
                          </th>
                          <th className="px-6 py-3"></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {products.map((product) => (
                          <tr key={product.id} className="hover:bg-slate-50">
                            <td className="px-6 py-4">
                              <div className="flex items-center gap-3">
                                <div className="w-12 h-12 bg-slate-100 rounded overflow-hidden flex-shrink-0">
                                  {product.images?.[0] && (
                                    <img 
                                      src={product.images[0]} 
                                      alt="" 
                                      className="w-full h-full object-cover"
                                    />
                                  )}
                                </div>
                                <div>
                                  <p className="font-medium line-clamp-1">{product.name}</p>
                                  <p className="text-xs text-slate-500">{product.category_name}</p>
                                </div>
                              </div>
                            </td>
                            <td className="px-6 py-4 font-medium">
                              {formatPrice(product.price)}
                            </td>
                            <td className="px-6 py-4">
                              <span className={`px-2 py-1 rounded text-xs font-medium ${
                                product.stock_quantity > 10 
                                  ? 'bg-green-100 text-green-800' 
                                  : product.stock_quantity > 0 
                                    ? 'bg-yellow-100 text-yellow-800'
                                    : 'bg-red-100 text-red-800'
                              }`}>
                                {product.stock_quantity}
                              </span>
                            </td>
                            <td className="px-6 py-4 text-sm">
                              {product.rating > 0 ? `${product.rating.toFixed(1)} ⭐` : '-'}
                            </td>
                            <td className="px-6 py-4">
                              <Link to={`/dashboard/products/${product.id}/edit`}>
                                <Button variant="ghost" size="sm">Modifier</Button>
                              </Link>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </TabsContent>
          )}

          {/* Favorites tab (buyer) */}
          {!isSupplier && (
            <TabsContent value="favorites">
              <div className="bg-white border border-slate-200 rounded-lg p-6">
                {favorites.length === 0 ? (
                  <div className="text-center py-12">
                    <Heart className="w-12 h-12 mx-auto text-slate-300 mb-4" />
                    <p className="text-slate-500 mb-4">Vous n'avez pas encore de favoris</p>
                    <Link to="/products">
                      <Button className="bg-accent hover:bg-accent-hover">
                        Explorer les produits
                      </Button>
                    </Link>
                  </div>
                ) : (
                  <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    {favorites.map((product) => (
                      <Link 
                        key={product.id}
                        to={`/products/${product.id}`}
                        className="border border-slate-200 rounded-lg p-4 hover:border-accent transition-colors"
                      >
                        <div className="aspect-square bg-slate-100 rounded mb-3 overflow-hidden">
                          {product.images?.[0] && (
                            <img 
                              src={product.images[0]} 
                              alt="" 
                              className="w-full h-full object-cover"
                            />
                          )}
                        </div>
                        <p className="font-medium line-clamp-1">{product.name}</p>
                        <p className="text-accent font-bold">{formatPrice(product.price)}</p>
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            </TabsContent>
          )}
        </Tabs>
      </div>
    </Layout>
  );
};

export default DashboardPage;
