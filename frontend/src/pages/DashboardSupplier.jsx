import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Package, ShoppingCart, Clock, TrendUp, Plus,
  FileText, PencilSimple, Trash, Eye, DownloadSimple, Rocket
} from "@phosphor-icons/react";
import { Layout } from "../components/layout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Skeleton } from "../components/ui/skeleton";
import { Pagination, PaginationContent, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious } from "../components/ui/pagination";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "../components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
// FIX : imports groupés, plus de const entre imports
import { ordersAPI, productsAPI, supplierAPI, rfqAPI, storefrontAPI, badgesAPI } from "../lib/api";
import { formatPrice, formatDate, getStatusColor, getStatusLabel, getImageUrl } from "../lib/utils";
import { exportSupplierOrders, exportSupplierProducts } from "../lib/exportUtils";
import { useAuth } from "../context/AuthContext";
import { useLocale } from "../context/LocaleContext";
import { toast } from "sonner";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import ProductApprovalBadge from "../components/products/ProductApprovalBadge";

const SUPPLIER_STATUSES = [
  { value: "pending",    label: "En attente"    },
  { value: "confirmed",  label: "Confirmée"     },
  { value: "processing", label: "En traitement" },
  { value: "shipped",    label: "Expédiée"      },
  { value: "delivered",  label: "Livrée"        },
  { value: "cancelled",  label: "Annulée"       },
];

export default function DashboardSupplier() {
  const { isSupplier } = useAuth();
  const { t, localizeAnon } = useLocale();
  const navigate         = useNavigate();

  const [orders, setOrders]   = useState([]);
  const [products, setProducts] = useState([]);
  const [rfqs, setRfqs]       = useState([]);
  const [stats, setStats]     = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(null);
  const [deleteTarget, setDeleteTarget]   = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState({});
  const [currentPage, setCurrentPage]     = useState(1);
  const [storefront, setStorefront]       = useState({});
  const [badges, setBadges]               = useState([]);
  const [badgeMeta, setBadgeMeta]         = useState({});
  const [sfSaving, setSfSaving]           = useState(false);
  const [identity, setIdentity]           = useState({ nui: '', rc_number: '' });
  const [idSaving, setIdSaving]           = useState(false);
  const itemsPerPage = 9;

  useEffect(() => { if (isSupplier) fetchData(); }, [isSupplier]);

  const fetchData = async () => {
    try {
      setLoading(true); setError(null);
      const [ordersRes, productsRes, statsRes, rfqsRes, sfRes, badgeMetaRes] = await Promise.all([
        ordersAPI.getAll(), productsAPI.getSupplierProducts(),
        supplierAPI.getStats(), rfqAPI.getAll(),
        storefrontAPI.getMine().catch(() => ({ data: {} })),
        badgesAPI.getMeta().catch(() => ({ data: {} })),
      ]);
      setOrders(ordersRes.data || []);
      setProducts(productsRes.data || []);
      setStats(statsRes.data || {});
      setRfqs(rfqsRes.data || []);
      const sfData = sfRes.data || {};
      setStorefront(sfData);
      setBadges(sfData?.badges || []);
      setIdentity({ nui: sfData?.nui || '', rc_number: sfData?.rc_number || '' });
      setBadgeMeta(badgeMetaRes.data || {});
      setCurrentPage(1);
    } catch {
      setError("Impossible de charger les données.");
      toast.error(t('dash.supplier.loadError'));
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteProduct = async () => {
    if (!deleteTarget) return;
    setDeleteLoading(true);
    try {
      await productsAPI.delete(deleteTarget);
      toast.success(t('dash.supplier.deleted'));
      setProducts((p) => p.filter((x) => x.id !== deleteTarget));
    } catch { toast.error(t('dash.supplier.deleteError')); }
    finally { setDeleteLoading(false); setDeleteTarget(null); }
  };

  const handleUpdateStatus = async (orderId, newStatus) => {
    setUpdatingStatus((p) => ({ ...p, [orderId]: true }));
    try {
      await ordersAPI.updateStatus(orderId, newStatus);
      setOrders((p) => p.map((o) => o.id === orderId ? { ...o, status: newStatus } : o));
      toast.success(`Statut : ${getStatusLabel(newStatus)}`);
    } catch { toast.error(t('dash.supplier.updateError')); }
    finally { setUpdatingStatus((p) => ({ ...p, [orderId]: false })); }
  };

  const totalPages = Math.max(1, Math.ceil(products.length / itemsPerPage));
  const paginatedProducts = products.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  if (!isSupplier) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-2xl font-bold mb-4">{t('dash.supplier.unauthorized')}</h1>
        <p>{t('dash.supplier.notSupplier')}</p>
      </div>
    </div>
  );

  if (loading) return (
    <Layout>
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {[...Array(4)].map((_, i) => (
            <Card key={i}><CardHeader><Skeleton className="h-4 w-24" /></CardHeader><CardContent><Skeleton className="h-8 w-16" /></CardContent></Card>
          ))}
        </div>
      </div>
    </Layout>
  );

  if (error) return (
    <Layout>
      <div className="max-w-7xl mx-auto px-4 py-8 text-center">
        <p className="text-red-600 font-bold mb-4">{error}</p>
        <Button onClick={fetchData}>{t('dash.supplier.retry')}</Button>
      </div>
    </Layout>
  );

  return (
    <Layout>
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold">{t('dash.supplier.title')}</h1>
          <div className="flex gap-2">
            {/* Onboarding link si pas encore de produits */}
            {products.length === 0 && (
              <Link to="/onboarding/supplier">
                <Button variant="outline" className="border-accent text-accent hover:bg-accent/5">
                  <Rocket className="w-4 h-4 mr-2" />
                  Guide de démarrage
                </Button>
              </Link>
            )}
            <Button asChild className="bg-accent hover:bg-accent-hover">
              <Link to="/dashboard/products/new">
                <Plus className="w-4 h-4 mr-2" />
                {t('dash.supplier.addProduct')}
              </Link>
            </Button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
          {[
            { icon: Package,      label: t('dash.supplier.products'), value: stats?.products_count || 0, color: 'text-primary' },
            { icon: ShoppingCart, label: t('dash.supplier.orders'),   value: stats?.total_orders  || 0, color: 'text-primary' },
            { icon: Clock,        label: t('dash.supplier.pending'),  value: stats?.pending_orders || 0, color: 'text-yellow-600' },
            { icon: TrendUp,      label: t('dash.supplier.revenue'),  value: formatPrice(stats?.total_revenue || 0), color: 'text-green-600' },
          ].map(({ icon: Icon, label, value, color }) => (
            <Card key={label}>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Icon className={`w-5 h-5 ${color}`} />
                  {label}
                </CardTitle>
              </CardHeader>
              <CardContent><p className="text-3xl font-bold">{value}</p></CardContent>
            </Card>
          ))}
        </div>

        <Tabs defaultValue="orders" className="space-y-6">
          <TabsList>
            <TabsTrigger value="orders">
              {t('dash.supplier.orders')}
              {orders.filter((o) => o.status === "pending").length > 0 && (
                <span className="ml-2 bg-accent text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                  {orders.filter((o) => o.status === "pending").length}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="products">{t('dash.supplier.products')}</TabsTrigger>
            {/* FIX CRITIQUE : t() appelé correctement */}
            <TabsTrigger value="rfqs">{t('dash.supplier.rfqTab')}</TabsTrigger>
            <TabsTrigger value="storefront">{t('dash.supplier.storefrontTab')}</TabsTrigger>
          </TabsList>

          {/* Orders */}
          <TabsContent value="orders">
            <Card>
              <CardHeader>
                <div className="flex justify-between items-center">
                  {/* FIX CRITIQUE */}
                  <CardTitle>{t('dash.supplier.orders')} ({orders.length})</CardTitle>
                  {orders.length > 0 && (
                    <Button variant="outline" size="sm" onClick={() => exportSupplierOrders(orders)}>
                      <DownloadSimple className="w-4 h-4 mr-2" />{t('common.export')}
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                {orders.length === 0 ? (
                  <div className="text-center py-12 text-slate-500">{t('common.noResults')}</div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[600px]">
                      <thead className="bg-slate-50 border-b">
                        <tr>
                          {[t('dash.supplier.orderNum'), t('dash.supplier.buyer'), t('dash.supplier.total'), t('dash.supplier.statusCol'), t('dash.supplier.payment'), ''].map((h) => (
                            <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-slate-600">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {orders.map((order) => (
                          <tr key={order.id} className="hover:bg-slate-50">
                            <td className="px-4 py-4">
                              <p className="font-mono text-sm">{order.order_number}</p>
                              <p className="text-xs text-slate-400">{formatDate(order.created_at)}</p>
                            </td>
                            <td className="px-4 py-4 text-sm">{localizeAnon(order.buyer_name)}</td>
                            <td className="px-4 py-4 font-medium">{formatPrice(order.total)}</td>
                            <td className="px-4 py-4">
                              <Select
                                value={order.status}
                                onValueChange={(val) => handleUpdateStatus(order.id, val)}
                                disabled={updatingStatus[order.id] || order.status === "delivered" || order.status === "cancelled"}
                              >
                                <SelectTrigger className={`w-40 h-8 text-xs ${getStatusColor(order.status)}`}>
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {SUPPLIER_STATUSES.map((s) => (
                                    <SelectItem key={s.value} value={s.value} className="text-xs">{s.label}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              {updatingStatus[order.id] && <p className="text-xs text-slate-400 mt-1">{t('dash.supplier.updating')}</p>}
                            </td>
                            <td className="px-4 py-4">
                              <span className={`text-xs px-2 py-1 rounded-full ${getStatusColor(order.payment_status)}`}>
                                {order.payment_status === "paid" ? "Payé" : "En attente"}
                              </span>
                            </td>
                            <td className="px-4 py-4 text-right">
                              <Link to={`/orders/${order.id}`}>
                                <Button variant="ghost" size="sm"><Eye className="w-4 h-4" /></Button>
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

          {/* Products */}
          <TabsContent value="products">
            <Card>
              <CardHeader>
                <div className="flex justify-between items-center">
                  <CardTitle>{t('dash.supplier.myProducts')} ({products.length})</CardTitle>
                  <div className="flex gap-2">
                    {products.length > 0 && (
                      <Button variant="outline" size="sm" onClick={() => exportSupplierProducts(products)}>
                        <DownloadSimple className="w-4 h-4 mr-2" />{t('common.export')}
                      </Button>
                    )}
                    <Button variant="outline" size="sm" onClick={fetchData}>{t('common.refresh')}</Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {products.length === 0 ? (
                  <div className="text-center py-12">
                    <Package className="w-12 h-12 mx-auto text-slate-300 mb-4" weight="duotone" />
                    <p className="text-slate-500 mb-4">{t('common.noResults')}</p>
                    <Link to="/dashboard/products/new">
                      <Button className="bg-accent hover:bg-accent-hover">
                        <Plus className="w-4 h-4 mr-2" />Ajouter mon premier produit
                      </Button>
                    </Link>
                  </div>
                ) : (
                  <>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                      {paginatedProducts.map((product) => (
                        <div key={product.id} className="border rounded-lg overflow-hidden hover:shadow-md transition-shadow group relative">
                          <Link to={`/products/${product.id}`} className="block">
                            <div className="aspect-video bg-slate-100">
                              {product.images?.[0] && (
                                <img src={getImageUrl(product.images[0])} alt={product.name} className="w-full h-full object-cover" />
                              )}
                            </div>
                            <div className="p-4">
                              <h3 className="font-medium line-clamp-1">{product.name}</h3>
                              <div className="mt-1 flex items-center justify-between gap-2">
                                <p className="text-accent font-bold">{formatPrice(product.price)}</p>
                                <ProductApprovalBadge product={product} />
                              </div>
                            </div>
                          </Link>
                          <div className="absolute top-3 right-3 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            <Button size="sm" variant="outline" title="Fiche PDF"
                              onClick={(e) => { e.preventDefault(); window.open(productsAPI.getProductSheet(product.id), '_blank'); }}
                              className="text-red-500 border-red-200 hover:bg-red-50">
                              <FileText className="w-4 h-4" />
                            </Button>
                            <Button size="sm" variant="outline"
                              onClick={(e) => { e.preventDefault(); navigate(`/dashboard/products/edit/${product.id}`); }}>
                              <PencilSimple className="w-4 h-4" />
                            </Button>
                            <Button size="sm" variant="destructive"
                              onClick={(e) => { e.preventDefault(); setDeleteTarget(product.id); }}>
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
                              <PaginationPrevious onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                                className={currentPage === 1 ? "pointer-events-none opacity-50" : "cursor-pointer"} />
                            </PaginationItem>
                            {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                              <PaginationItem key={page}>
                                <PaginationLink isActive={page === currentPage} onClick={() => setCurrentPage(page)} className="cursor-pointer">
                                  {page}
                                </PaginationLink>
                              </PaginationItem>
                            ))}
                            <PaginationItem>
                              <PaginationNext onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                                className={currentPage === totalPages ? "pointer-events-none opacity-50" : "cursor-pointer"} />
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

          {/* RFQs */}
          <TabsContent value="rfqs">
            <Card>
              {/* FIX CRITIQUE */}
              <CardHeader>
                <CardTitle>{t('dash.supplier.rfqsRec')} ({rfqs.length})</CardTitle>
              </CardHeader>
              <CardContent>
                {rfqs.length === 0 ? (
                  <div className="text-center py-12 text-slate-500">{t('common.noResults')}</div>
                ) : (
                  <div className="space-y-4">
                    {rfqs.map((rfq) => (
                      <div key={rfq.id} className="border rounded-lg p-4 hover:bg-slate-50">
                        <div className="flex justify-between items-start">
                          <div>
                            <p className="font-medium">{rfq.product_name}</p>
                            <p className="text-sm text-slate-500">De : {localizeAnon(rfq.buyer_name)}</p>
                            <p className="text-xs text-slate-400 mt-1">Qté : {rfq.quantity} · {formatDate(rfq.created_at)}</p>
                          </div>
                          <span className={`px-3 py-1 text-xs rounded-full ${
                            rfq.status === "pending"  ? "bg-yellow-100 text-yellow-700" :
                            rfq.status === "quoted"   ? "bg-blue-100 text-blue-700"    :
                            rfq.status === "accepted" ? "bg-green-100 text-green-700"  :
                            "bg-red-100 text-red-700"
                          }`}>
                            {t(`rfq.status.${rfq.status}`) || rfq.status}
                          </span>
                        </div>
                        {rfq.target_price && <p className="text-sm mt-2">Prix cible : {formatPrice(rfq.target_price)}</p>}
                        <Link to={`/rfq/${rfq.id}`}>
                          <Button variant="outline" size="sm" className="mt-3">Voir détails</Button>
                        </Link>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
          {/* Storefront & Badges */}
          <TabsContent value="storefront">
            <div className="grid lg:grid-cols-4 gap-6">
              {/* Badges */}
              <Card>
                <CardHeader><CardTitle className="text-sm">{t('dash.supplier.myBadges')}</CardTitle></CardHeader>
                <CardContent>
                  {badges.length === 0 ? (
                    <p className="text-sm text-slate-400">{t('dash.supplier.noBadges')}</p>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {badges.map((b) => {
                        const meta = badgeMeta[b] || {};
                        return (
                          <span key={b} className="px-3 py-1.5 rounded-full text-xs font-medium bg-slate-100 text-slate-700" style={{ borderLeft: `3px solid ${meta.color || '#ccc'}` }}>
                            {meta.icon} {t(`badge.${b}`)}
                          </span>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Identité légale — NUI + RC */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Identité Légale 🪪</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-xs text-slate-500 leading-relaxed">
                    {t('dash.supplier.legal.desc')}
                  </p>
                  <div>
                    <Label className="text-xs font-medium">NUI (Numéro Unique d'Identification)</Label>
                    <Input
                      value={identity.nui}
                      onChange={e => setIdentity(s => ({ ...s, nui: e.target.value.toUpperCase() }))}
                      className="h-8 text-sm font-mono mt-1"
                      {...{placeholder: t('dash.supplier.nui.ph')}}
                    />
                  </div>
                  <div>
                    <Label className="text-xs font-medium">N° Registre de Commerce</Label>
                    <Input
                      value={identity.rc_number}
                      onChange={e => setIdentity(s => ({ ...s, rc_number: e.target.value.toUpperCase() }))}
                      className="h-8 text-sm font-mono mt-1"
                      {...{placeholder: t('dash.supplier.rc.ph')}}
                    />
                  </div>
                  <Button
                    size="sm"
                    disabled={idSaving || (!identity.nui && !identity.rc_number)}
                    onClick={async () => {
                      setIdSaving(true);
                      try {
                        await supplierAPI.updateProfile(identity);
                        toast.success(t('dash.supplier.legalSaved'));
                        fetchData();
                      } catch (e) {
                        toast.error(e.response?.data?.detail || t('common.error'));
                      } finally { setIdSaving(false); }
                    }}
                  >
                    {idSaving ? '...' : t('dash.supplier.save.id')}
                  </Button>
                </CardContent>
              </Card>

              {/* Storefront editor */}
              <Card className="lg:col-span-2">
                <CardHeader><CardTitle className="text-sm">{t('dash.supplier.storefrontEdit')}</CardTitle></CardHeader>
                <CardContent>
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div>
                      <Label className="text-xs">{t('dash.supplier.sfSlug')}</Label>
                      <div className="flex items-center gap-1">
                        <span className="text-xs text-slate-400">/store/</span>
                        <Input value={storefront.slug || ''} onChange={(e) => setStorefront(s => ({...s, slug: e.target.value}))} className="h-8 text-sm" />
                      </div>
                    </div>
                    <div>
                      <Label className="text-xs">{t('dash.supplier.sfHeadline')}</Label>
                      <Input value={storefront.headline || ''} onChange={(e) => setStorefront(s => ({...s, headline: e.target.value}))} className="h-8 text-sm" placeholder={t('dash.supplier.sfHeadlinePh')} />
                    </div>
                    <div className="sm:col-span-2">
                      <Label className="text-xs">{t('dash.supplier.sfAbout')}</Label>
                      <textarea value={storefront.about || ''} onChange={(e) => setStorefront(s => ({...s, about: e.target.value}))} rows={3}
                        className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent/50" placeholder={t('dash.supplier.sfAboutPh')} />
                    </div>
                    <div>
                      <Label className="text-xs">{t('dash.supplier.sfCerts')}</Label>
                      <Input value={(storefront.certifications || []).join(', ')} onChange={(e) => setStorefront(s => ({...s, certifications: e.target.value.split(',').map(c => c.trim()).filter(Boolean)}))} className="h-8 text-sm" placeholder="ISO 9001, CE, NF" />
                    </div>
                    <div>
                      <Label className="text-xs">{t('dash.supplier.sfYear')}</Label>
                      <Input type="number" value={storefront.year_established || ''} onChange={(e) => setStorefront(s => ({...s, year_established: parseInt(e.target.value) || null}))} className="h-8 text-sm" placeholder="2015" />
                    </div>
                  </div>
                  <div className="flex items-center justify-between mt-4 pt-4 border-t">
                    {storefront.slug && (
                      <a href={`/store/${storefront.slug}`} target="_blank" rel="noopener noreferrer" className="text-xs text-accent hover:underline">
                        {t('dash.supplier.sfPreview')} →
                      </a>
                    )}
                    <Button size="sm" disabled={sfSaving} onClick={async () => {
                      setSfSaving(true);
                      try {
                        const r = await storefrontAPI.updateMine(storefront);
                        setStorefront(r.data);
                        toast.success(t('dash.supplier.sfSaved'));
                      } catch (e) { toast.error(e.response?.data?.detail || t('common.error')); }
                      finally { setSfSaving(false); }
                    }}>
                      {sfSaving ? '...' : t('common.save')}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

        </Tabs>
      </div>

      {/* FIX CRITIQUE : AlertDialog avec t() correct */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('dash.supplier.deleteTitle')}</AlertDialogTitle>
            <AlertDialogDescription>{t('dash.supplier.deleteDesc')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteLoading}>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteProduct} disabled={deleteLoading} className="bg-red-600 hover:bg-red-700">
              {/* FIX : pas d'objet JSX entre accolades */}
              {deleteLoading ? t('dash.supplier.deleting') : t('dash.supplier.deleteConfirm')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Layout>
  );
}