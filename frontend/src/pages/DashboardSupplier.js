import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { 
  Package, 
  ShoppingCart, 
  Clock, 
  TrendUp, 
  Plus,
  FileText,
  PencilSimple,
  Trash,
  Eye,
  CaretDown,
  DownloadSimple
} from "@phosphor-icons/react";
import { Layout } from "../components/layout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ordersAPI, productsAPI, supplierAPI, rfqAPI } from "../lib/api";
import { formatPrice, formatDate, getStatusColor, getStatusLabel, getImageUrl } from "../lib/utils";
import { exportSupplierOrders, exportSupplierProducts } from "../lib/exportUtils";
import { useAuth } from "@/context/AuthContext";
import { useLocale } from '../context/LocaleContext';
import { toast } from "sonner";

// P2-7: statuts que le fournisseur peut définir, dans l'ordre logique
const SUPPLIER_STATUSES = [
  { value: "pending",    label: "En attente" },
  { value: "confirmed",  label: "Confirmée" },
  { value: "processing", label: "En traitement" },
  { value: "shipped",    label: "Expédiée" },
  { value: "delivered",  label: "Livrée" },
  { value: "cancelled",  label: "Annulée" },
];

export default function DashboardSupplier() {
  const { isSupplier } = useAuth();
  const { t } = useLocale();
  const navigate = useNavigate();

  const [orders, setOrders] = useState([]);
  const [products, setProducts] = useState([]);
  const [rfqs, setRfqs] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // P2-6: AlertDialog state pour suppression produit
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // P2-7: suivi des mises à jour de statut en cours par order id
  const [updatingStatus, setUpdatingStatus] = useState({});

  // Pagination produits
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 9;

  useEffect(() => {
    if (isSupplier) fetchData();
  }, [isSupplier]);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);
      const [ordersRes, productsRes, statsRes, rfqsRes] = await Promise.all([
        ordersAPI.getAll(),
        productsAPI.getSupplierProducts(),
        supplierAPI.getStats(),
        rfqAPI.getAll(),
      ]);
      setOrders(ordersRes.data || []);
      setProducts(productsRes.data || []);
      setStats(statsRes.data || {});
      setRfqs(rfqsRes.data || []);
      setCurrentPage(1);
    } catch (err) {
      console.error("Erreur chargement dashboard fournisseur:", err);
      setError("Impossible de charger les données.");
      toast.error("Erreur de chargement du tableau de bord");
    } finally {
      setLoading(false);
    }
  };

  // P2-6: suppression avec AlertDialog (plus de window.confirm)
  const confirmDeleteProduct = (productId) => setDeleteTarget(productId);

  const handleDeleteProduct = async () => {
    if (!deleteTarget) return;
    setDeleteLoading(true);
    try {
      await productsAPI.delete(deleteTarget);
      toast.success("Produit supprimé avec succès");
      setProducts((prev) => prev.filter((p) => p.id !== deleteTarget));
      setStats((prev) => prev ? { ...prev, products_count: (prev.products_count || 1) - 1 } : prev);
    } catch (err) {
      toast.error("Erreur lors de la suppression");
    } finally {
      setDeleteLoading(false);
      setDeleteTarget(null);
    }
  };

  // P2-7: mise à jour du statut d'une commande
  const handleUpdateStatus = async (orderId, newStatus) => {
    setUpdatingStatus((prev) => ({ ...prev, [orderId]: true }));
    try {
      await ordersAPI.updateStatus(orderId, newStatus);
      setOrders((prev) =>
        prev.map((o) => (o.id === orderId ? { ...o, status: newStatus } : o))
      );
      toast.success(`Statut mis à jour : ${getStatusLabel(newStatus)}`);
    } catch (err) {
      toast.error("Erreur lors de la mise à jour du statut");
    } finally {
      setUpdatingStatus((prev) => ({ ...prev, [orderId]: false }));
    }
  };

  const handlePageChange = (page) => {
    setCurrentPage(page);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const totalPages = Math.max(1, Math.ceil(products.length / itemsPerPage));
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
                <CardHeader className="pb-2"><Skeleton className="h-4 w-24" /></CardHeader>
                <CardContent><Skeleton className="h-8 w-16 mb-2" /><Skeleton className="h-4 w-32" /></CardContent>
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
          <Button onClick={fetchData} className="mt-4">Réessayer</Button>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold">{t('dash.supplier.title')}</h1>
          <Button asChild className="bg-accent hover:bg-accent-hover">
            <Link to="/dashboard/products/new">
              <Plus className="w-4 h-4 mr-2" />
              Ajouter un produit
            </Link>
          </Button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center">
                <Package className="w-5 h-5 mr-2 text-primary" />Produits
              </CardTitle>
            </CardHeader>
            <CardContent><p className="text-3xl font-bold">{stats?.products_count || 0}</p></CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center">
                <ShoppingCart className="w-5 h-5 mr-2 text-primary" />Commandes
              </CardTitle>
            </CardHeader>
            <CardContent><p className="text-3xl font-bold">{stats?.total_orders || 0}</p></CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center">
                <Clock className="w-5 h-5 mr-2 text-yellow-600" />En attente
              </CardTitle>
            </CardHeader>
            <CardContent><p className="text-3xl font-bold">{stats?.pending_orders || 0}</p></CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center">
                <TrendUp className="w-5 h-5 mr-2 text-green-600" />Revenus
              </CardTitle>
            </CardHeader>
            <CardContent><p className="text-3xl font-bold">{formatPrice(stats?.total_revenue || 0)}</p></CardContent>
          </Card>
        </div>

        <Tabs defaultValue="orders" className="space-y-6">
          <TabsList>
            <TabsTrigger value="orders">
              Commandes
              {orders.filter((o) => o.status === "pending").length > 0 && (
                <span className="ml-2 bg-accent text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                  {orders.filter((o) => o.status === "pending").length}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="products">{t('dash.supplier.products')}</TabsTrigger>
            <TabsTrigger value="rfqs">Demandes de devis</TabsTrigger>
          </TabsList>

          {/* P2-7: Orders Tab avec changement de statut */}
          <TabsContent value="orders">
            <Card>
              <CardHeader>
                <div className="flex justify-between items-center">
                  <CardTitle>{t('dash.supplier.orders')} ({orders.length})</CardTitle>
                  {/* P4-23: export CSV commandes */}
                  {orders.length > 0 && (
                    <Button variant="outline" size="sm" onClick={() => exportSupplierOrders(orders)}>
                      <DownloadSimple className="w-4 h-4 mr-2" />
                      Exporter CSV
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                {orders.length === 0 ? (
                  <div className="text-center py-12 text-slate-500">
                    {t('common.noResults')}
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-slate-50 border-b">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600">Commande</th>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600">Acheteur</th>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600">Total</th>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600">Statut</th>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600">Paiement</th>
                          <th className="px-4 py-3"></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {orders.map((order) => (
                          <tr key={order.id} className="hover:bg-slate-50">
                            <td className="px-4 py-4">
                              <p className="font-mono text-sm">{order.order_number}</p>
                              <p className="text-xs text-slate-400 mt-0.5">{formatDate(order.created_at)}</p>
                            </td>
                            <td className="px-4 py-4 text-sm">{order.buyer_name}</td>
                            <td className="px-4 py-4 font-medium">{formatPrice(order.total)}</td>
                            <td className="px-4 py-4">
                              {/* P2-7: Select pour changer le statut directement */}
                              <Select
                                value={order.status}
                                onValueChange={(val) => handleUpdateStatus(order.id, val)}
                                disabled={
                                  updatingStatus[order.id] ||
                                  order.status === "delivered" ||
                                  order.status === "cancelled"
                                }
                              >
                                <SelectTrigger className={`w-40 h-8 text-xs ${getStatusColor(order.status)}`}>
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {SUPPLIER_STATUSES.map((s) => (
                                    <SelectItem key={s.value} value={s.value} className="text-xs">
                                      {s.label}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              {updatingStatus[order.id] && (
                                <p className="text-xs text-slate-400 mt-1">Mise à jour...</p>
                              )}
                            </td>
                            <td className="px-4 py-4">
                              <span className={`text-xs px-2 py-1 rounded-full ${getStatusColor(order.payment_status)}`}>
                                {order.payment_status === "paid" ? "Payé" : "En attente"}
                              </span>
                            </td>
                            <td className="px-4 py-4 text-right">
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
              </CardContent>
            </Card>
          </TabsContent>

          {/* Products Tab */}
          <TabsContent value="products">
            <Card>
              <CardHeader>
                <div className="flex justify-between items-center">
                  <CardTitle>Mes produits ({products.length})</CardTitle>
                  <div className="flex gap-2">
                    {/* P4-23: export catalogue */}
                    {products.length > 0 && (
                      <Button variant="outline" size="sm" onClick={() => exportSupplierProducts(products)}>
                        <DownloadSimple className="w-4 h-4 mr-2" />
                        Exporter CSV
                      </Button>
                    )}
                    <Button variant="outline" size="sm" onClick={fetchData}>
                      Rafraîchir
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {products.length === 0 ? (
                  <div className="text-center py-12 text-slate-500">
                    {t('common.noResults')}
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
                                <img
                                  src={getImageUrl(product.images[0])}
                                  alt={product.name}
                                  className="w-full h-full object-cover"
                                />
                              )}
                            </div>
                            <div className="p-4">
                              <h3 className="font-medium line-clamp-1">{product.name}</h3>
                              <p className="text-accent font-bold mt-1">{formatPrice(product.price)}</p>
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
                            {/* P2-6: AlertDialog au lieu de window.confirm */}
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={(e) => {
                                e.preventDefault();
                                confirmDeleteProduct(product.id);
                              }}
                            >
                              <Trash className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>

                    {totalPages > 1 && (
                      <div className="mt-8 flex justify-center">
                        <Pagination>
                          <PaginationContent>
                            <PaginationItem>
                              <PaginationPrevious
                                onClick={() => handlePageChange(currentPage - 1)}
                                className={currentPage === 1 ? "pointer-events-none opacity-50" : "cursor-pointer"}
                              />
                            </PaginationItem>
                            {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                              <PaginationItem key={page}>
                                <PaginationLink
                                  isActive={page === currentPage}
                                  onClick={() => handlePageChange(page)}
                                  className="cursor-pointer"
                                >
                                  {page}
                                </PaginationLink>
                              </PaginationItem>
                            ))}
                            <PaginationItem>
                              <PaginationNext
                                onClick={() => handlePageChange(currentPage + 1)}
                                className={currentPage === totalPages ? "pointer-events-none opacity-50" : "cursor-pointer"}
                              />
                            </PaginationItem>
                          </PaginationContent>
                        </Pagination>
                      </div>
                    )}
                  </>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* RFQ Tab */}
          <TabsContent value="rfqs">
            <Card>
              <CardHeader>
                <CardTitle>{t('dash.supplier.rfqsRec')} ({rfqs.length})</CardTitle>
              </CardHeader>
              <CardContent>
                {rfqs.length === 0 ? (
                  <div className="text-center py-12 text-slate-500">
                    {t('common.noResults')}
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
                          <span className={`px-3 py-1 text-xs rounded-full ${
                            rfq.status === "pending" ? "bg-yellow-100 text-yellow-700" :
                            rfq.status === "quoted" ? "bg-blue-100 text-blue-700" :
                            rfq.status === "accepted" ? "bg-green-100 text-green-700" :
                            "bg-red-100 text-red-700"
                          }`}>
                            {rfq.status === "pending" ? "En attente" :
                             rfq.status === "quoted" ? "Devis envoyé" :
                             rfq.status === "accepted" ? "Accepté" : "Refusé"}
                          </span>
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

      {/* P2-6: AlertDialog de confirmation suppression */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer ce produit ?</AlertDialogTitle>
            <AlertDialogDescription>
              Cette action est irréversible. Le produit sera définitivement supprimé de votre catalogue.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteLoading}>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteProduct}
              disabled={deleteLoading}
              className="bg-red-600 hover:bg-red-700 focus:ring-red-600"
            >
              {deleteLoading ? "Suppression..." : "Supprimer"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Layout>
  );
}