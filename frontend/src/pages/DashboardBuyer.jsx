import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import {
  ShoppingCart, Heart, Clock, CheckCircle, Eye,
  FileText, Star, DownloadSimple, Receipt, Package
} from "@phosphor-icons/react";
import { Layout } from "../components/layout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "../components/ui/dialog";
import { Textarea } from "../components/ui/textarea";
import { Label } from "../components/ui/label";
import { ordersAPI, favoritesAPI, reviewsAPI } from "../lib/api";
import { formatPrice, formatDate, getStatusColor, getStatusLabel, getImageUrl } from "../lib/utils";
import { exportBuyerOrders } from "../lib/exportUtils";
import { useLocale } from "../context/LocaleContext";
import { toast } from "sonner";

export default function DashboardBuyer() {
  const { t, localizeAnon } = useLocale();
  const [orders, setOrders]               = useState([]);
  const [favorites, setFavorites]         = useState([]);
  const [pendingReviews, setPendingReviews] = useState([]);
  const [loading, setLoading]             = useState(true);

  const [reviewTarget, setReviewTarget]   = useState(null);
  const [reviewRating, setReviewRating]   = useState(0);
  const [reviewComment, setReviewComment] = useState("");
  const [reviewLoading, setReviewLoading] = useState(false);

  useEffect(() => {
    Promise.allSettled([
      ordersAPI.getAll(),
      favoritesAPI.getAll(),
      reviewsAPI.getPending(),
    ]).then(([ordersRes, favRes, reviewsRes]) => {
      if (ordersRes.status === 'fulfilled')  setOrders(ordersRes.value.data || []);
      else toast.error(t('common.error'));
      if (favRes.status === 'fulfilled')     setFavorites(favRes.value.data || []);
      if (reviewsRes.status === 'fulfilled') setPendingReviews(reviewsRes.value.data || []);
    }).finally(() => setLoading(false));
  }, []);

  const handleSubmitReview = async () => {
    if (reviewRating === 0) { toast.error(t('review.selectRating')); return; }
    setReviewLoading(true);
    try {
      await reviewsAPI.create({
        product_id: reviewTarget.product_id,
        order_id:   reviewTarget.order_id,
        rating:     reviewRating,
        comment:    reviewComment.trim() || undefined,
      });
      toast.success(t('review.published'));
      setPendingReviews((p) => p.filter(
        (r) => !(r.product_id === reviewTarget.product_id && r.order_id === reviewTarget.order_id)
      ));
      setReviewTarget(null); setReviewRating(0); setReviewComment("");
    } catch {
      toast.error(t('review.error'));
    } finally {
      setReviewLoading(false);
    }
  };

  const ratingLabels = ['', t('review.bad'), t('review.ok'), t('review.good'), t('review.vgood'), t('review.excellent')];
  const paidOrders = orders.filter((o) => o.payment_status === 'paid');

  if (loading) return (
    <Layout>
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-8">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="bg-white border border-slate-200 rounded-xl p-6 animate-pulse">
              <div className="h-4 bg-slate-200 rounded w-1/2 mb-4" />
              <div className="h-8 bg-slate-200 rounded w-1/3" />
            </div>
          ))}
        </div>
      </div>
    </Layout>
  );

  return (
    <Layout>
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="flex justify-between items-center mb-8">
          <h1 className="section-heading">{t('dash.buyer.title')}</h1>
          <div className="flex gap-2">
            <Link to="/invoices">
              <Button variant="outline" className="hidden sm:flex items-center gap-2">
                <Receipt className="w-4 h-4" />
                {t('dash.buyer.invoicesBtn')}
              </Button>
            </Link>
            <Button asChild className="bg-accent hover:bg-accent-hover">
              <Link to="/rfq">
                <FileText className="w-4 h-4 mr-2" />
                {t('dash.buyer.newRfq')}
              </Link>
            </Button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-10">
          {[
            { icon: ShoppingCart, label: t('dash.buyer.orders'),    value: orders.length,                                      color: 'text-primary' },
            { icon: Clock,        label: t('dash.buyer.ongoing'),   value: orders.filter((o) => !['delivered','cancelled'].includes(o.status)).length, color: 'text-yellow-600' },
            { icon: CheckCircle,  label: t('dash.buyer.delivered'), value: orders.filter((o) => o.status === 'delivered').length, color: 'text-green-600' },
            { icon: Heart,        label: t('dash.buyer.favorites'), value: favorites.length,                                   color: 'text-red-500' },
          ].map(({ icon: Icon, label, value, color }) => (
            <Card key={label}>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Icon className={`w-5 h-5 ${color}`} />{label}
                </CardTitle>
              </CardHeader>
              <CardContent><p className="text-3xl font-bold">{value}</p></CardContent>
            </Card>
          ))}
        </div>

        {/* Produits à noter */}
        {pendingReviews.length > 0 && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-8">
            <div className="flex items-center gap-2 mb-3">
              <Star className="w-5 h-5 text-amber-500" weight="fill" />
              <p className="font-medium text-amber-800">
                {pendingReviews.length} {t('dash.buyer.ratePrompt')}
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              {pendingReviews.slice(0, 3).map((item) => (
                <button
                  key={`${item.order_id}-${item.product_id}`}
                  onClick={() => setReviewTarget(item)}
                  className="flex items-center gap-2 bg-white border border-amber-200 rounded-lg px-3 py-2 text-sm hover:border-amber-400 transition-colors"
                >
                  {item.product_image && (
                    <img src={getImageUrl(item.product_image)} alt="" className="w-8 h-8 rounded object-cover" />
                  )}
                  <span className="font-medium line-clamp-1 max-w-[160px]">{item.product_name}</span>
                  <span className="text-amber-600 text-xs flex-shrink-0">{t('review.rateBtn')}</span>
                </button>
              ))}
              {pendingReviews.length > 3 && (
                <span className="text-sm text-amber-700 self-center">+{pendingReviews.length - 3} {t('dash.buyer.moreItems')}</span>
              )}
            </div>
          </div>
        )}

        {/* Factures rapides */}
        {paidOrders.length > 0 && (
          <div className="bg-green-50 border border-green-200 rounded-xl p-4 mb-8">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Receipt className="w-5 h-5 text-green-600" />
                <p className="font-medium text-green-800">
                  {paidOrders.length} {t('dash.buyer.invoicesAvail')}
                </p>
              </div>
              <Link to="/invoices">
                <button className="text-sm text-green-700 font-medium hover:text-green-900 underline underline-offset-2">
                  {t('dash.buyer.seeInvoices')}
                </button>
              </Link>
            </div>
          </div>
        )}

        {/* Tabs */}
        <Tabs defaultValue="orders" className="space-y-6">
          <TabsList>
            <TabsTrigger value="orders" className="flex items-center gap-2">
              <ShoppingCart className="w-4 h-4" />{t('dash.buyer.ordersTab')}
            </TabsTrigger>
            <TabsTrigger value="favorites" className="flex items-center gap-2">
              <Heart className="w-4 h-4" />{t('dash.buyer.favoritesTab')}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="orders">
            <Card>
              <CardHeader>
                <div className="flex justify-between items-center">
                  <CardTitle>{t('dash.buyer.recentOrders')}</CardTitle>
                  {orders.length > 0 && (
                    <Button variant="outline" size="sm" onClick={() => exportBuyerOrders(orders)}>
                      <DownloadSimple className="w-4 h-4 mr-2" />{t('dash.buyer.exportCsv')}
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                {orders.length === 0 ? (
                  <div className="text-center py-12">
                    <Package className="w-12 h-12 mx-auto text-slate-300 mb-4" weight="duotone" />
                    <p className="text-slate-500 mb-4">{t('common.noResults')}</p>
                    <Link to="/products">
                      <Button className="bg-accent hover:bg-accent-hover">{t('dash.buyer.explore')}</Button>
                    </Link>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[520px]">
                      <thead className="bg-slate-50 border-b">
                        <tr>
                          {[t('dash.buyer.orderCol'), t('dash.buyer.supplierCol'), t('dash.buyer.totalCol'), t('dash.buyer.statusCol'), ''].map((h) => (
                            <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-slate-600">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {orders.map((order) => (
                          <tr key={order.id} className="hover:bg-slate-50">
                            <td className="px-4 py-4">
                              <p className="font-mono text-sm">{order.order_number}</p>
                              <p className="text-xs text-slate-400 mt-0.5">{formatDate(order.created_at)}</p>
                            </td>
                            <td className="px-4 py-4 text-sm">{localizeAnon(order.supplier_name)}</td>
                            <td className="px-4 py-4 font-medium">{formatPrice(order.total)}</td>
                            <td className="px-6 py-4">
                              <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(order.status)}`}>
                                {getStatusLabel(order.status)}
                              </span>
                            </td>
                            <td className="px-6 py-4 text-right flex items-center gap-2 justify-end">
                              {order.status === "delivered" && pendingReviews.some((r) => r.order_id === order.id) && (
                                <Button variant="ghost" size="sm" className="text-amber-600"
                                  onClick={() => setReviewTarget(pendingReviews.find((r) => r.order_id === order.id))}>
                                  <Star className="w-4 h-4" />
                                </Button>
                              )}
                              {order.payment_status === 'paid' && (
                                <a href={ordersAPI.getInvoice(order.id)} target="_blank" rel="noopener noreferrer"
                                  className="p-1.5 text-slate-400 hover:text-red-500 transition-colors" title={t('dash.buyer.downloadInvoice')}>
                                  <Receipt className="w-4 h-4" />
                                </a>
                              )}
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

          <TabsContent value="favorites">
            <Card>
              <CardHeader><CardTitle>{t('dash.buyer.myFavorites')}</CardTitle></CardHeader>
              <CardContent>
                {favorites.length === 0 ? (
                  <div className="text-center py-12">
                    <Heart className="w-12 h-12 mx-auto text-slate-300 mb-4" weight="duotone" />
                    <p className="text-slate-500 mb-4">{t('common.noResults')}</p>
                    <Link to="/products">
                      <Button className="bg-accent hover:bg-accent-hover">{t('dash.buyer.explore')}</Button>
                    </Link>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                    {favorites.map((product) => (
                      <Link key={product.id} to={`/products/${product.id}`}
                        className="border border-slate-200 rounded-xl p-4 hover:border-accent transition-colors">
                        <div className="aspect-video bg-slate-100 rounded-lg mb-3 overflow-hidden">
                          {product.images?.[0] && (
                            <img src={getImageUrl(product.images[0])} alt={product.name} className="w-full h-full object-cover" />
                          )}
                        </div>
                        <h4 className="font-medium line-clamp-2">{product.name}</h4>
                        <p className="text-accent font-bold mt-1">{formatPrice(product.price)}</p>
                      </Link>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Dialog notation */}
      <Dialog open={!!reviewTarget} onOpenChange={(open) => !open && setReviewTarget(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t('review.title')}</DialogTitle>
            <DialogDescription>
              {reviewTarget?.product_name}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-5 pt-2">
            <div>
              <Label className="mb-2 block">{t('review.ratingLabel')} *</Label>
              <div className="flex gap-2">
                {[1,2,3,4,5].map((star) => (
                  <button key={star} type="button" onClick={() => setReviewRating(star)}
                    className="focus:outline-none transition-transform hover:scale-110">
                    <Star className={`w-8 h-8 ${star <= reviewRating ? "text-yellow-500" : "text-slate-200"}`}
                      weight={star <= reviewRating ? "fill" : "regular"} />
                  </button>
                ))}
              </div>
              {reviewRating > 0 && (
                <p className="text-sm text-slate-500 mt-1">{ratingLabels[reviewRating]}</p>
              )}
            </div>
            <div>
              <Label htmlFor="review-comment">{t('review.commentLabel')}</Label>
              <Textarea id="review-comment" value={reviewComment}
                onChange={(e) => setReviewComment(e.target.value)}
                placeholder={t('review.commentPh')} rows={3} className="mt-1" />
            </div>
            <div className="flex gap-3">
              <Button variant="outline" className="flex-1" onClick={() => setReviewTarget(null)} disabled={reviewLoading}>
                {t('common.cancel')}
              </Button>
              <Button className="flex-1 bg-accent hover:bg-accent-hover" onClick={handleSubmitReview}
                disabled={reviewLoading || reviewRating === 0}>
                {reviewLoading ? t('review.submitting') : t('review.submit')}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}
