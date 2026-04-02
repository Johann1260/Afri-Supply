import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { 
  Package, 
  ShoppingCart, 
  Clock, 
  TrendUp, 
  Plus,
  FileText,
  ArrowRight,
  PencilSimple,
  Trash 
} from "@phosphor-icons/react";
import { Layout } from "../components/layout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Pagination } from "@/components/ui/pagination";
import { ordersAPI, productsAPI, supplierAPI, rfqAPI } from "../lib/api";
import { formatPrice, formatDate } from "../lib/utils";
import { useAuth } from "@/context/AuthContext";
import { toast } from "sonner";

export default function DashboardSupplier() {
  const { isSupplier } = useAuth();
  const navigate = useNavigate();

  const [orders, setOrders] = useState([]);
  const [products, setProducts] = useState([]);
  const [rfqs, setRfqs] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 9;

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);

        const [ordersRes, productsRes, statsRes, rfqsRes] = await Promise.all([
          ordersAPI.getAll(),
          productsAPI.getSupplierProducts(),
          supplierAPI.getStats(),
          rfqAPI.getAll()
        ]);

        setOrders(ordersRes.data || []);
        setProducts(productsRes.data || []);
        setStats(statsRes.data || {});
        setRfqs(rfqsRes.data || []);
        setCurrentPage(1); // Reset à la première page
      } catch (err) {
        console.error("Erreur chargement dashboard fournisseur:", err);
        setError("Impossible de charger les données.");
        toast.error("Erreur de chargement du tableau de bord");
      } finally {
        setLoading(false);
      }
    };

    if (isSupplier) {
      fetchData();
    }
  }, [isSupplier]);

  const refreshDashboard = () => {
    setCurrentPage(1);
    window.location.reload();
  };

  const handleDeleteProduct = async (productId) => {
    if (!window.confirm("Voulez-vous vraiment supprimer ce produit ?")) return;

    try {
      await productsAPI.delete(productId);
      toast.success("Produit supprimé avec succès");
      refreshDashboard();
    } catch (err) {
      toast.error("Erreur lors de la suppression");
    }
  };

  const handlePageChange = (page) => {
    setCurrentPage(page);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Calcul pagination
  const totalPages = Math.ceil(products.length / itemsPerPage) || 1;
  const paginatedProducts = products.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  if (!isSupplier) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">Accès non autorisé</h1>
          <p>Vous n'êtes pas un fournisseur.</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <Layout>
        <div className="max-w-7xl mx-auto px-4 py-8">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
            {[...Array(4)].map((_, i) => (
              <Card key={i}>
                <CardHeader className="pb-2">
                  <Skeleton className="h-4 w-24" />
                </CardHeader>
                <CardContent>
                  <Skeleton className="h-8 w-16 mb-2" />
                  <Skeleton className="h-4 w-32" />
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </Layout>
    );
  }

  if (error) {
    return (
      <Layout>
        <div className="max-w-7xl mx-auto px-4 py-8 text-center">
          <h2 className="text-2xl font-bold text-red-600 mb-4">Erreur</h2>
          <p>{error}</p>
          <Button onClick={refreshDashboard} className="mt-4">Réessayer</Button>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold">Tableau de bord Fournisseur</h1>

          <Button asChild className="bg-accent hover:bg-accent-hover">
            <Link to="/dashboard/products/new">
              <Plus className="w-4 h-4 mr-2" />
              Ajouter un produit
            </Link>
          </Button>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center">
                <Package className="w-5 h-5 mr-2 text-primary" />
                Produits
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold">{stats?.products_count || 0}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center">
                <ShoppingCart className="w-5 h-5 mr-2 text-primary" />
                Commandes
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold">{stats?.total_orders || 0}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center">
                <Clock className="w-5 h-5 mr-2 text-yellow-600" />
                En attente
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold">{stats?.pending_orders || 0}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center">
                <TrendUp className="w-5 h-5 mr-2 text-green-600" />
                Revenus
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold">
                {formatPrice(stats?.total_revenue || 0)}
              </p>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="orders" className="space-y-6">
          <TabsList>
            <TabsTrigger value="orders">Commandes</TabsTrigger>
            <TabsTrigger value="products">Produits</TabsTrigger>
            <TabsTrigger value="rfqs">Demandes de devis</TabsTrigger>
          </TabsList>

          {/* Products Tab avec Pagination */}
          <TabsContent value="products">
            <Card>
              <CardHeader>
                <div className="flex justify-between items-center">
                  <CardTitle>Mes produits ({products.length})</CardTitle>
                  <Button variant="outline" size="sm" onClick={refreshDashboard}>
                    Rafraîchir
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {products.length === 0 ? (
                  <div className="text-center py-12 text-slate-500">
                    Aucun produit ajouté pour le moment
                  </div>
                ) : (
                  <>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                      {paginatedProducts.map((product) => (
                        <div 
                          key={product.id} 
                          className="border rounded-lg overflow-hidden hover:shadow-md transition-shadow group relative"
                        >
                          <Link to={`/products/${product.id}`} className="block">
                            <div className="aspect-video bg-slate-100">
                              {product.images?.[0] && (
                                <img src={product.images[0]} alt={product.name} className="w-full h-full object-cover" />
                              )}
                            </div>
                            <div className="p-4">
                              <h3 className="font-medium line-clamp-1">{product.name}</h3>
                              <p className="text-accent font-bold mt-1">
                                {formatPrice(product.price)}
                              </p>
                            </div>
                          </Link>

                          <div className="absolute top-3 right-3 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={(e) => {
                                e.preventDefault();
                                navigate(`/dashboard/products/edit/${product.id}`);
                              }}
                            >
                              <PencilSimple className="w-4 h-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={(e) => {
                                e.preventDefault();
                                handleDeleteProduct(product.id);
                              }}
                            >
                              <Trash className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Pagination */}
                    <Pagination 
                      currentPage={currentPage}
                      totalPages={totalPages}
                      onPageChange={handlePageChange}
                    />
                  </>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Orders Tab */}
          <TabsContent value="orders">
            <Card>
              <CardHeader>
                <CardTitle>Dernières commandes</CardTitle>
              </CardHeader>
              <CardContent>
                {orders.length === 0 ? (
                  <div className="text-center py-12 text-slate-500">
                    Aucune commande pour le moment
                  </div>
                ) : (
                  <div className="space-y-4">
                    {orders.slice(0, 5).map((order) => (
                      <div key={order.id} className="flex justify-between items-center border-b pb-3 last:border-0">
                        <div>
                          <p className="font-medium">Commande #{order.id.slice(-6)}</p>
                          <p className="text-sm text-slate-500">
                            {formatDate(order.created_at)}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="font-medium">{formatPrice(order.total)}</p>
                          <span className={`text-xs px-2 py-1 rounded-full ${getStatusColor(order.status)}`}>
                            {getStatusLabel(order.status)}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* RFQ Tab */}
          <TabsContent value="rfqs">
            <Card>
              <CardHeader>
                <CardTitle>Demandes de devis reçues</CardTitle>
              </CardHeader>
              <CardContent>
                {rfqs.length === 0 ? (
                  <div className="text-center py-12 text-slate-500">
                    Aucune demande de devis reçue pour le moment
                  </div>
                ) : (
                  <div className="space-y-4">
                    {rfqs.map((rfq) => (
                      <div key={rfq.id} className="border rounded-lg p-4 hover:bg-slate-50">
                        <div className="flex justify-between items-start">
                          <div>
                            <p className="font-medium">{rfq.product_name}</p>
                            <p className="text-sm text-slate-500">De : {rfq.buyer_name}</p>
                            <p className="text-xs text-slate-400 mt-1">
                              Qté : {rfq.quantity} • {formatDate(rfq.created_at)}
                            </p>
                          </div>
                          <div>
                            <span className="px-3 py-1 text-xs rounded-full bg-yellow-100 text-yellow-700">
                              {rfq.status === 'pending' ? 'En attente' : rfq.status}
                            </span>
                          </div>
                        </div>
                        {rfq.target_price && (
                          <p className="text-sm mt-2">Prix cible : {formatPrice(rfq.target_price)}</p>
                        )}
                        <Link to={`/rfq/${rfq.id}`}>
                          <Button variant="outline" size="sm" className="mt-3">
                            Voir détails
                          </Button>
                        </Link>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
}

