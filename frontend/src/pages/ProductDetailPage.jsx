import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import {
  ShoppingCart, Heart, Star, Minus, Plus, MapPin, Package,
  Truck, Shield, ChatCircle, CaretLeft, FileText, FilePdf, CheckCircle
} from '@phosphor-icons/react';
import { Layout } from '../components/layout';
import { ProductGrid } from '../components/products';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger,
} from '../components/ui/dialog';
import { productsAPI, reviewsAPI, favoritesAPI, rfqAPI, messagesAPI } from '../lib/api';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';
import { useLocale } from '../context/LocaleContext';
import { formatPrice, formatDate, getImageUrl } from '../lib/utils';
import { toast } from 'sonner';

const ProductDetailPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { addToCart, loading: cartLoading } = useCart();
  const { isAuthenticated } = useAuth();
  const { t, tf } = useLocale();

  const [product, setProduct] = useState(null);
  const [reviews, setReviews] = useState([]);
  const [relatedProducts, setRelatedProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [quantity, setQuantity] = useState(1);
  const [selectedImage, setSelectedImage] = useState(0);
  const [isFavorite, setIsFavorite] = useState(false);
  const [rfqDialogOpen, setRfqDialogOpen] = useState(false);
  const [contactDialogOpen, setContactDialogOpen] = useState(false);
  const [downloadingSheet, setDownloadingSheet] = useState(false);
  const [sheetDownloaded, setSheetDownloaded] = useState(false);
  const [rfqData, setRfqData] = useState({
    quantity: '', target_price: '', delivery_location: '',
    delivery_deadline: '', specifications: '', notes: ''
  });
  const [contactMessage, setContactMessage] = useState('');

  useEffect(() => {
    const fetchProduct = async () => {
      try {
        setLoading(true);
        const [productRes, reviewsRes] = await Promise.all([
          productsAPI.getById(id),
          reviewsAPI.getByProduct(id),
        ]);
        setProduct(productRes.data);
        setReviews(reviewsRes.data);
        setQuantity(productRes.data.min_order_quantity || 1);

        if (productRes.data.category_id) {
          const relatedRes = await productsAPI.getAll({
            category_id: productRes.data.category_id, limit: 4
          });
          setRelatedProducts(relatedRes.data.filter((p) => p.id !== id));
        }
      } catch {
        toast.error('Produit non trouvé');
        navigate('/products');
      } finally {
        setLoading(false);
      }
    };
    fetchProduct();
  }, [id, navigate]);

  const handleAddToCart = async () => {
    if (!isAuthenticated) { toast.error('Veuillez vous connecter'); navigate('/login'); return; }
    try {
      await addToCart(product.id, quantity);
      toast.success(t('products.addToCart') + ' ✓');
    } catch { toast.error('Erreur'); }
  };

  const handleToggleFavorite = async () => {
    if (!isAuthenticated) { toast.error('Veuillez vous connecter'); return; }
    try {
      if (isFavorite) { await favoritesAPI.remove(product.id); setIsFavorite(false); }
      else { await favoritesAPI.add(product.id); setIsFavorite(true); }
    } catch { toast.error('Erreur'); }
  };

  const handleSubmitRFQ = async () => {
    if (!isAuthenticated) { navigate('/login'); return; }
    if (!rfqData.quantity || !rfqData.delivery_location) {
      toast.error('Quantité et lieu de livraison sont obligatoires'); return;
    }
    try {
      await rfqAPI.create({
        product_id: product.id, supplier_id: product.supplier_id,
        quantity: parseInt(rfqData.quantity),
        target_price: rfqData.target_price ? parseFloat(rfqData.target_price) : null,
        delivery_location: rfqData.delivery_location,
        delivery_deadline: rfqData.delivery_deadline || null,
        specifications: rfqData.specifications || null,
        notes: rfqData.notes || null,
      });
      toast.success('Demande de devis envoyée !');
      setRfqDialogOpen(false);
      setRfqData({ quantity: '', target_price: '', delivery_location: '', delivery_deadline: '', specifications: '', notes: '' });
    } catch (error) {
      toast.error(error.response?.data?.detail?.[0]?.msg || 'Erreur');
    }
  };

  const handleSendMessage = async () => {
    if (!isAuthenticated) { navigate('/login'); return; }
    if (!contactMessage.trim()) { toast.error('Veuillez entrer un message'); return; }
    try {
      await messagesAPI.send({ receiver_id: product.supplier_id, content: contactMessage.trim(), product_id: product.id });
      toast.success('Message envoyé');
      setContactDialogOpen(false);
      setContactMessage('');
    } catch { toast.error("Erreur lors de l'envoi"); }
  };

  // FIX: downloadSheet simplifié, ouverture dans nouvel onglet
  const handleDownloadSheet = () => {
    setDownloadingSheet(true);
    const url = productsAPI.getProductSheet(product.id);
    window.open(url, '_blank');
    setDownloadingSheet(false);
    setSheetDownloaded(true);
    setTimeout(() => setSheetDownloaded(false), 3000);
  };

  if (loading) {
    return (
      <Layout>
        <div className="max-w-7xl mx-auto px-4 py-8">
          <div className="animate-pulse grid lg:grid-cols-2 gap-12">
            <div className="aspect-square bg-slate-200 rounded-lg" />
            <div className="space-y-4">
              <div className="h-4 bg-slate-200 rounded w-1/4" />
              <div className="h-8 bg-slate-200 rounded w-3/4" />
              <div className="h-32 bg-slate-200 rounded" />
            </div>
          </div>
        </div>
      </Layout>
    );
  }

  if (!product) return null;

  return (
    <Layout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 text-slate-600 hover:text-primary mb-6 transition-colors"
          data-testid="back-button"
        >
          <CaretLeft className="w-5 h-5" />
          {t('common.back')}
        </button>

        <div className="grid lg:grid-cols-2 gap-8 lg:gap-12">
          {/* Images */}
          <div className="space-y-4">
            <div className="aspect-square bg-slate-100 rounded-lg overflow-hidden">
              {product.images?.[selectedImage] ? (
                <img src={getImageUrl(product.images[selectedImage])} alt={tf(product, 'name')} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-slate-400">
                  <Package className="w-24 h-24" />
                </div>
              )}
            </div>
            {product.images?.length > 1 && (
              <div className="flex gap-3">
                {product.images.map((img, i) => (
                  <button key={i} onClick={() => setSelectedImage(i)}
                    className={`w-20 h-20 rounded-lg overflow-hidden border-2 transition-colors ${selectedImage === i ? 'border-accent' : 'border-slate-200'}`}
                  >
                    <img src={getImageUrl(img)} alt="" className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Info */}
          <div>
            {product.category_name && (
              <Link to={`/products?category_id=${product.category_id}`} className="overline text-accent hover:underline">
                {product.category_name}
              </Link>
            )}

            <h1 className="font-heading font-bold text-2xl lg:text-3xl text-slate-900 mt-2 mb-4">
              {tf(product, 'name')}
            </h1>

            {product.rating > 0 && (
              <div className="flex items-center gap-2 mb-4">
                <div className="flex items-center">
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} className={`w-5 h-5 ${i < Math.round(product.rating) ? 'text-yellow-500' : 'text-slate-200'}`}
                      weight={i < Math.round(product.rating) ? 'fill' : 'regular'} />
                  ))}
                </div>
                <span className="font-medium">{product.rating.toFixed(1)}</span>
                <span className="text-slate-500">({product.review_count} {t('products.reviews')})</span>
              </div>
            )}

            {/* Supplier */}
            <div className="flex items-center gap-3 p-4 bg-slate-50 rounded-lg mb-6">
              <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center">
                <Package className="w-6 h-6 text-primary" />
              </div>
              <div>
                <p className="text-sm text-slate-500">{t('products.supplier')}</p>
                <p className="font-semibold">{product.supplier_company || product.supplier_name}</p>
              </div>
              <Dialog open={contactDialogOpen} onOpenChange={setContactDialogOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline" size="sm" className="ml-auto" data-testid="contact-supplier">
                    <ChatCircle className="w-4 h-4 mr-2" />
                    {t('products.contact')}
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Contacter le fournisseur</DialogTitle>
                    <DialogDescription>Envoyez un message à {product.supplier_company || product.supplier_name}</DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 pt-4">
                    <Textarea value={contactMessage} onChange={(e) => setContactMessage(e.target.value)}
                      placeholder="Bonjour, je suis intéressé par votre produit..." rows={4} data-testid="contact-message-input" />
                    <Button className="w-full bg-accent hover:bg-accent-hover" onClick={handleSendMessage} data-testid="send-contact-message">
                      {t('common.send')}
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>

            {/* Price */}
            <div className="mb-6">
              <p className="font-heading font-bold text-3xl text-primary">{formatPrice(product.price)}</p>
              <p className="text-slate-500 mt-1">
                {t('products.price')} / {product.unit} • {t('products.minOrder')} {product.min_order_quantity} {product.unit}s
              </p>
            </div>

            {/* Stock */}
            <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-sm font-medium mb-6 ${
              product.is_available ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
            }`}>
              <span className={`w-2 h-2 rounded-full ${product.is_available ? 'bg-green-500' : 'bg-red-500'}`} />
              {product.is_available ? `${t('products.inStock')} (${product.stock_quantity})` : t('products.outOfStock')}
            </div>

            {/* Quantity */}
            <div className="flex items-center gap-4 mb-6">
              <label className="text-sm font-semibold text-slate-700">{t('products.quantity')}:</label>
              <div className="flex items-center border border-slate-200 rounded-lg">
                <button onClick={() => setQuantity(Math.max(product.min_order_quantity, quantity - 1))}
                  className="p-3 hover:bg-slate-50" data-testid="quantity-decrease"><Minus className="w-4 h-4" /></button>
                <span className="w-16 text-center font-medium">{quantity}</span>
                <button onClick={() => setQuantity(Math.min(product.stock_quantity, quantity + 1))}
                  className="p-3 hover:bg-slate-50" data-testid="quantity-increase"><Plus className="w-4 h-4" /></button>
              </div>
              <span className="text-slate-500">= {formatPrice(product.price * quantity)}</span>
            </div>

            {/* Actions */}
            <div className="flex flex-wrap gap-3 mb-4">
              <Button size="lg" className="flex-1 bg-accent hover:bg-accent-hover"
                onClick={handleAddToCart} disabled={!product.is_available || cartLoading} data-testid="add-to-cart-main">
                <ShoppingCart className="w-5 h-5 mr-2" />
                {t('products.addToCart')}
              </Button>
              <Button size="lg" variant="outline" onClick={handleToggleFavorite}
                className={isFavorite ? 'text-red-500 border-red-500' : ''} data-testid="add-to-favorites">
                <Heart className="w-5 h-5" weight={isFavorite ? 'fill' : 'regular'} />
              </Button>
            </div>

            {/* RFQ */}
            <Dialog open={rfqDialogOpen} onOpenChange={setRfqDialogOpen}>
              <DialogTrigger asChild>
                <Button size="lg" variant="outline"
                  className="w-full mb-6 border-accent text-accent hover:bg-accent/5 font-medium"
                  data-testid="request-quote-btn">
                  <FileText className="w-5 h-5 mr-2" />
                  {t('products.requestQuote')}
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>{t('rfq.new')} — {tf(product, 'name')}</DialogTitle>
                  <DialogDescription>Remplissez les informations pour recevoir un devis personnalisé.</DialogDescription>
                </DialogHeader>
                <div className="space-y-5 py-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>{t('rfq.quantity')} *</Label>
                      <Input type="number" min={product.min_order_quantity || 1}
                        value={rfqData.quantity} onChange={(e) => setRfqData({ ...rfqData, quantity: e.target.value })}
                        placeholder={`Min. ${product.min_order_quantity}`} />
                    </div>
                    <div>
                      <Label>{t('rfq.targetPrice')}</Label>
                      <Input type="number" value={rfqData.target_price}
                        onChange={(e) => setRfqData({ ...rfqData, target_price: e.target.value })} />
                    </div>
                  </div>
                  <div>
                    <Label>{t('rfq.location')} *</Label>
                    <Input value={rfqData.delivery_location}
                      onChange={(e) => setRfqData({ ...rfqData, delivery_location: e.target.value })}
                      placeholder="Ex: Douala, Cameroun" />
                  </div>
                  <div>
                    <Label>{t('rfq.deadline')}</Label>
                    <Input type="date" value={rfqData.delivery_deadline}
                      onChange={(e) => setRfqData({ ...rfqData, delivery_deadline: e.target.value })} />
                  </div>
                  <div>
                    <Label>{t('rfq.specs')}</Label>
                    <Textarea value={rfqData.specifications}
                      onChange={(e) => setRfqData({ ...rfqData, specifications: e.target.value })} rows={3} />
                  </div>
                  <div>
                    <Label>{t('rfq.notes')}</Label>
                    <Textarea value={rfqData.notes}
                      onChange={(e) => setRfqData({ ...rfqData, notes: e.target.value })} rows={2} />
                  </div>
                  <Button onClick={handleSubmitRFQ} className="w-full bg-accent hover:bg-accent-hover" size="lg">
                    {t('rfq.submit')}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>

            {/* FIX: Un seul bloc fiche produit PDF (doublon supprimé) */}
            <div className="border border-slate-200 rounded-xl p-4 bg-slate-50 mb-6">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-semibold text-sm text-slate-800 flex items-center gap-1.5">
                    <FilePdf className="w-4 h-4 text-red-500 flex-shrink-0" />
                    {t('sheet.title')}
                  </p>
                  <p className="text-xs text-slate-500 mt-0.5">{t('sheet.subtitle')}</p>
                </div>
                <button
                  onClick={handleDownloadSheet}
                  disabled={downloadingSheet}
                  className="flex-shrink-0 flex items-center gap-1.5 px-3 py-2 bg-primary hover:bg-primary/90 text-white text-xs font-medium rounded-lg transition-colors disabled:opacity-60 whitespace-nowrap"
                  data-testid="download-sheet"
                >
                  {sheetDownloaded ? (
                    <><CheckCircle className="w-3.5 h-3.5" weight="fill" /> {t('sheet.downloaded')}</>
                  ) : downloadingSheet ? t('sheet.generating') : (
                    <><FilePdf className="w-3.5 h-3.5" /> {t('sheet.download')}</>
                  )}
                </button>
              </div>
            </div>

            {/* Benefits */}
            <div className="grid grid-cols-3 gap-4 pt-6 border-t border-slate-200">
              <div className="text-center"><Truck className="w-6 h-6 mx-auto mb-2 text-primary" /><p className="text-xs text-slate-600">Livraison CEMAC</p></div>
              <div className="text-center"><Shield className="w-6 h-6 mx-auto mb-2 text-primary" /><p className="text-xs text-slate-600">{t('checkout.secure')}</p></div>
              <div className="text-center"><MapPin className="w-6 h-6 mx-auto mb-2 text-primary" /><p className="text-xs text-slate-600">Suivi temps réel</p></div>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="mt-12">
          <Tabs defaultValue="description">
            <TabsList className="w-full justify-start border-b rounded-none bg-transparent h-auto p-0">
              <TabsTrigger value="description" className="rounded-none border-b-2 border-transparent data-[state=active]:border-accent data-[state=active]:shadow-none">
                {t('products.description')}
              </TabsTrigger>
              <TabsTrigger value="specifications" className="rounded-none border-b-2 border-transparent data-[state=active]:border-accent data-[state=active]:shadow-none">
                {t('products.specifications')}
              </TabsTrigger>
              <TabsTrigger value="reviews" className="rounded-none border-b-2 border-transparent data-[state=active]:border-accent data-[state=active]:shadow-none">
                Avis ({reviews.length})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="description" className="py-6">
              <p className="text-slate-600 whitespace-pre-wrap">{tf(product, 'description')}</p>
            </TabsContent>

            <TabsContent value="specifications" className="py-6">
              {product.specifications && Object.keys(product.specifications).length > 0 ? (
                <div className="bg-slate-50 rounded-lg overflow-hidden">
                  <table className="w-full">
                    <tbody>
                      {Object.entries(product.specifications).map(([key, value], i) => (
                        <tr key={key} className={i % 2 === 0 ? 'bg-white' : ''}>
                          <td className="px-4 py-3 font-medium text-slate-700 capitalize w-1/3">{key.replace(/_/g, ' ')}</td>
                          <td className="px-4 py-3 text-slate-600">{value}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-slate-500">Aucune spécification disponible</p>
              )}
            </TabsContent>

            <TabsContent value="reviews" className="py-6">
              {reviews.length > 0 ? (
                <div className="space-y-6">
                  {reviews.map((review) => (
                    <div key={review.id} className="border-b border-slate-100 pb-6">
                      <div className="flex items-center gap-3 mb-2">
                        <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center">
                          <span className="font-semibold text-primary">{review.user_name?.[0]?.toUpperCase()}</span>
                        </div>
                        <div>
                          <p className="font-medium">{review.user_name}</p>
                          <p className="text-sm text-slate-500">{formatDate(review.created_at)}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 mb-2">
                        {[...Array(5)].map((_, i) => (
                          <Star key={i} className={`w-4 h-4 ${i < review.rating ? 'text-yellow-500' : 'text-slate-200'}`}
                            weight={i < review.rating ? 'fill' : 'regular'} />
                        ))}
                      </div>
                      {review.comment && <p className="text-slate-600">{review.comment}</p>}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-slate-500">Aucun avis pour ce produit</p>
              )}
            </TabsContent>
          </Tabs>
        </div>

        {relatedProducts.length > 0 && (
          <div className="mt-16">
            <h2 className="section-heading mb-8">{t('products.related')}</h2>
            <ProductGrid products={relatedProducts} loading={false} />
          </div>
        )}
      </div>
    </Layout>
  );
};

export default ProductDetailPage;