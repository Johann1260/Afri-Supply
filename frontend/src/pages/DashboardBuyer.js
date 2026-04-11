import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import {
  ShoppingCart,
  Heart,
  Clock,
  CheckCircle,
  Eye,
  FileText,
  Star,
} from "@phosphor-icons/react";
import { Layout } from "../components/layout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "../components/ui/dialog";
import { Textarea } from "../components/ui/textarea";
import { Label } from "../components/ui/label";
import { ordersAPI, favoritesAPI, reviewsAPI } from "../lib/api";
import { formatPrice, formatDate, getStatusColor, getStatusLabel, getImageUrl } from "../lib/utils";
import { toast } from "sonner";

export default function DashboardBuyer() {
  const [orders, setOrders] = useState([]);
  const [favorites, setFavorites] = useState([]);
  const [pendingReviews, setPendingReviews] = useState([]);
  const [loading, setLoading] = useState(true);

  // P2-8: état du dialog de notation
  const [reviewTarget, setReviewTarget] = useState(null); // { order_id, product_id, product_name }
  const [reviewRating, setReviewRating] = useState(0);
  const [reviewComment, setReviewComment] = useState("");
  const [reviewLoading, setReviewLoading] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [ordersRes, favRes, reviewsRes] = await Promise.all([
          ordersAPI.getAll(),
          favoritesAPI.getAll(),
          reviewsAPI.getPending(),
        ]);
        setOrders(ordersRes.data || []);
        setFavorites(favRes.data || []);
        setPendingReviews(reviewsRes.data || []);
      } catch (err) {
        console.error("Erreur chargement dashboard buyer:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  // P2-8: soumettre un avis produit
  const handleSubmitReview = async () => {
    if (reviewRating === 0) {
      toast.error("Veuillez sélectionner une note");
      return;
    }
    setReviewLoading(true);
    try {
      await reviewsAPI.create({
        product_id: reviewTarget.product_id,
        order_id: reviewTarget.order_id,
        rating: reviewRating,
        comment: reviewComment.trim() || undefined,
      });
      toast.success("Avis publié avec succès !");
      // Retirer l'item noté de la liste
      setPendingReviews((prev) =>
        prev.filter(
          (r) =>
            !(r.product_id === reviewTarget.product_id && r.order_id === reviewTarget.order_id)
        )
      );
      setReviewTarget(null);
      setReviewRating(0);
      setReviewComment("");
    } catch (err) {
      toast.error("Erreur lors de la publication de l'avis");
    } finally {
      setReviewLoading(false);
    }
  };

  if (loading) {
    return (
      <Layout>
        <div className="max-w-7xl mx-auto px-4 py-8">
          Chargement du tableau de bord...
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="flex justify-between items-center mb-8">
          <h1 className="section-heading">Tableau de bord Acheteur</h1>
          <Button asChild className="bg-accent hover:bg-accent-hover">
            <Link to="/rfq">
              <FileText className="w-4 h-4 mr-2" />
              Nouvelle demande de devis
            </Link>
          </Button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-10">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <ShoppingCart className="w-5 h-5" />Commandes
              </CardTitle>
            </CardHeader>
            <CardContent><p className="text-3xl font-bold">{orders.length}</p></CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Clock className="w-5 h-5 text-yellow-600" />En cours
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold">
                {orders.filter((o) => !["delivered", "cancelled"].includes(o.status)).length}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <CheckCircle className="w-5 h-5 text-green-600" />Livrées
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold">
                {orders.filter((o) => o.status === "delivered").length}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Heart className="w-5 h-5 text-red-600" />Favoris
              </CardTitle>
            </CardHeader>
            <CardContent><p className="text-3xl font-bold">{favorites.length}</p></CardContent>
          </Card>
        </div>

        {/* P2-8: bandeau avis en attente */}
        {pendingReviews.length > 0 && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-8">
            <div className="flex items-center gap-2 mb-3">
              <Star className="w-5 h-5 text-amber-500" weight="fill" />
              <p className="font-medium text-amber-800">
                {pendingReviews.length} produit{pendingReviews.length > 1 ? "s" : ""} à noter
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
                    <img
                      src={getImageUrl(item.product_image)}
                      alt=""
                      className="w-8 h-8 rounded object-cover"
                    />
                  )}
                  <span className="font-medium line-clamp-1 max-w-[160px]">{item.product_name}</span>
                  <span className="text-amber-600 text-xs flex-shrink-0">Noter →</span>
                </button>
              ))}
              {pendingReviews.length > 3 && (
                <span className="text-sm text-amber-700 self-center">
                  +{pendingReviews.length - 3} autres
                </span>
              )}
            </div>
          </div>
        )}

        {/* Tabs */}
        <Tabs defaultValue="orders" className="space-y-6">
          <TabsList>
            <TabsTrigger value="orders" className="flex items-center gap-2">
              <ShoppingCart className="w-4 h-4" />
              Mes Commandes
            </TabsTrigger>
            <TabsTrigger value="favorites" className="flex items-center gap-2">
              <Heart className="w-4 h-4" />
              Mes Favoris
            </TabsTrigger>
          </TabsList>

          {/* Orders Tab */}
          <TabsContent value="orders">
            <Card>
              <CardHeader><CardTitle>Dernières commandes</CardTitle></CardHeader>
              <CardContent>
                {orders.length === 0 ? (
                  <div className="text-center py-12 text-slate-500">
                    Aucune commande pour le moment
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-slate-50 border-b">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600">Commande</th>
                          <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600">Fournisseur</th>
                          <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600">Total</th>
                          <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600">Statut</th>
                          <th className="px-6 py-3"></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {orders.slice(0, 8).map((order) => (
                          <tr key={order.id} className="hover:bg-slate-50">
                            <td className="px-6 py-4">
                              <p className="font-mono text-sm">{order.order_number}</p>
                              <p className="text-xs text-slate-400 mt-0.5">{formatDate(order.created_at)}</p>
                            </td>
                            <td className="px-6 py-4 text-sm">{order.supplier_name}</td>
                            <td className="px-6 py-4 font-medium">{formatPrice(order.total)}</td>
                            <td className="px-6 py-4">
                              <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(order.status)}`}>
                                {getStatusLabel(order.status)}
                              </span>
                            </td>
                            <td className="px-6 py-4 text-right">
                              {/* P2-8: bouton "Noter" pour les commandes livrées avec avis en attente */}
                              {order.status === "delivered" &&
                                pendingReviews.some((r) => r.order_id === order.id) && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="mr-1 text-amber-600 hover:text-amber-700"
                                    onClick={() =>
                                      setReviewTarget(
                                        pendingReviews.find((r) => r.order_id === order.id)
                                      )
                                    }
                                  >
                                    <Star className="w-4 h-4" />
                                  </Button>
                                )}
                              {/* P2-1 fix: lien vers OrderDetailPage */}
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

          {/* Favorites Tab */}
          <TabsContent value="favorites">
            <Card>
              <CardHeader><CardTitle>Mes produits favoris</CardTitle></CardHeader>
              <CardContent>
                {favorites.length === 0 ? (
                  <div className="text-center py-12 text-slate-500">
                    Aucun produit dans vos favoris
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                    {favorites.map((product) => (
                      <Link
                        key={product.id}
                        to={`/products/${product.id}`}
                        className="border border-slate-200 rounded-xl p-4 hover:border-accent transition-colors"
                      >
                        <div className="aspect-video bg-slate-100 rounded-lg mb-3 overflow-hidden">
                          {product.images?.[0] && (
                            <img
                              src={getImageUrl(product.images[0])}
                              alt={product.name}
                              className="w-full h-full object-cover"
                            />
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

      {/* P2-8: Dialog de notation produit */}
      <Dialog open={!!reviewTarget} onOpenChange={(open) => !open && setReviewTarget(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Noter ce produit</DialogTitle>
            <DialogDescription>
              {reviewTarget?.product_name} — commande {reviewTarget?.order_number}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-5 pt-2">
            {/* Étoiles */}
            <div>
              <Label className="mb-2 block">Note *</Label>
              <div className="flex gap-2">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    type="button"
                    onClick={() => setReviewRating(star)}
                    className="focus:outline-none transition-transform hover:scale-110"
                  >
                    <Star
                      className={`w-8 h-8 ${
                        star <= reviewRating ? "text-yellow-500" : "text-slate-200"
                      }`}
                      weight={star <= reviewRating ? "fill" : "regular"}
                    />
                  </button>
                ))}
              </div>
              {reviewRating > 0 && (
                <p className="text-sm text-slate-500 mt-1">
                  {["", "Mauvais", "Passable", "Bien", "Très bien", "Excellent"][reviewRating]}
                </p>
              )}
            </div>

            <div>
              <Label htmlFor="review-comment">Commentaire (optionnel)</Label>
              <Textarea
                id="review-comment"
                value={reviewComment}
                onChange={(e) => setReviewComment(e.target.value)}
                placeholder="Partagez votre expérience avec ce produit..."
                rows={3}
                className="mt-1"
              />
            </div>

            <div className="flex gap-3">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => setReviewTarget(null)}
                disabled={reviewLoading}
              >
                Annuler
              </Button>
              <Button
                className="flex-1 bg-accent hover:bg-accent-hover"
                onClick={handleSubmitReview}
                disabled={reviewLoading || reviewRating === 0}
              >
                {reviewLoading ? "Publication..." : "Publier l'avis"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}