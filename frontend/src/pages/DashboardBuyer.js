import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { ShoppingCart, Heart, Clock, CheckCircle, Eye, Plus, FileText } from "@phosphor-icons/react";
import { Layout } from "../components/layout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { ordersAPI, favoritesAPI } from "../lib/api";
import { formatPrice, formatDate, getStatusColor, getStatusLabel } from "../lib/utils";

export default function DashboardBuyer() {
  const [orders, setOrders] = useState([]);
  const [favorites, setFavorites] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [ordersRes, favRes] = await Promise.all([
          ordersAPI.getAll(),
          favoritesAPI.getAll()
        ]);

        setOrders(ordersRes.data || []);
        setFavorites(favRes.data || []);
      } catch (err) {
        console.error("Erreur chargement dashboard buyer:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

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

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-10">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <ShoppingCart className="w-5 h-5" />
                Commandes
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold">{orders.length}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Clock className="w-5 h-5 text-yellow-600" />
                En cours
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold">
                {orders.filter(o => !["delivered", "cancelled"].includes(o.status)).length}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <CheckCircle className="w-5 h-5 text-green-600" />
                Livrées
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold">
                {orders.filter(o => o.status === "delivered").length}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Heart className="w-5 h-5 text-red-600" />
                Favoris
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold">{favorites.length}</p>
            </CardContent>
          </Card>
        </div>

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
              <CardHeader>
                <CardTitle>Dernières commandes</CardTitle>
              </CardHeader>
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
                            <td className="px-6 py-4 font-mono text-sm">{order.order_number}</td>
                            <td className="px-6 py-4">{order.supplier_name}</td>
                            <td className="px-6 py-4 font-medium">{formatPrice(order.total)}</td>
                            <td className="px-6 py-4">
                              <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(order.status)}`}>
                                {getStatusLabel(order.status)}
                              </span>
                            </td>
                            <td className="px-6 py-4 text-right">
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
              <CardHeader>
                <CardTitle>Mes produits favoris</CardTitle>
              </CardHeader>
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
                              src={product.images[0]}
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
    </Layout>
  );
}