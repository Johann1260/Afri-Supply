import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { 
  FileText, Plus, Package, MapPin, CalendarBlank, 
  CheckCircle, XCircle 
} from '@phosphor-icons/react';
import { Layout } from '../components/layout';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { useAuth } from '../context/AuthContext';
import { rfqAPI, productsAPI } from '../lib/api';
import { formatPrice } from '../lib/utils';
import { toast } from 'sonner';

export default function RFQPage() {
  const navigate = useNavigate();
  const { isBuyer, isSupplier } = useAuth();

  const [rfqs, setRfqs] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);

  // Modal création RFQ (Buyer)
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newRfq, setNewRfq] = useState({
    product_id: '',
    quantity: 10,
    target_price: '',
    delivery_location: '',
    delivery_deadline: '',
    specifications: '',
    notes: ''
  });

  // Modal soumission devis (Supplier)
  const [showQuoteModal, setShowQuoteModal] = useState(false);
  const [selectedRfqForQuote, setSelectedRfqForQuote] = useState(null);
  const [quoteForm, setQuoteForm] = useState({
    quoted_price: '',
    delivery_time: '',
    response_notes: ''
  });

  const [searchParams] = useSearchParams();
  const preselectedProductId = searchParams.get('productId');

  // Pré-remplissage automatique si on vient d'un produit
  useEffect(() => {
    if (preselectedProductId && isBuyer) {
      setNewRfq(prev => ({ ...prev, product_id: preselectedProductId }));
      setShowCreateModal(true);
      toast.info("Produit pré-sélectionné pour votre devis");
    }
  }, [preselectedProductId, isBuyer]);

  useEffect(() => {
    fetchRFQs();
    if (isBuyer) fetchProducts();
  }, [isBuyer]);

  const fetchRFQs = async () => {
    try {
      const res = await rfqAPI.getAll();
      setRfqs(res.data || []);
    } catch (err) {
      console.error(err);
      toast.error("Impossible de charger les RFQ");
    } finally {
      setLoading(false);
    }
  };

  const fetchProducts = async () => {
    try {
      const res = await productsAPI.getAll({ is_available: true });
      setProducts(res.data || []);
    } catch (err) {
      console.error(err);
    }
  };

  const handleCreateRFQ = async (e) => {
    e.preventDefault();

    if (!newRfq.product_id) {
      toast.error("Veuillez sélectionner un produit");
      return;
    }

    if (!newRfq.delivery_location) {
      toast.error("Le lieu de livraison est obligatoire");
      return;
    }

    try {
      // Récupérer le produit pour obtenir le supplier_id
      const productRes = await productsAPI.getById(newRfq.product_id);
      const product = productRes.data;

      if (!product?.supplier_id) {
        toast.error("Impossible de trouver le fournisseur de ce produit");
        return;
      }

      const payload = {
        product_id: newRfq.product_id,
        supplier_id: product.supplier_id,
        quantity: parseInt(newRfq.quantity) || 1,
        target_price: newRfq.target_price && newRfq.target_price.trim() !== '' 
          ? parseFloat(newRfq.target_price) 
          : null,
        delivery_location: newRfq.delivery_location,
        delivery_deadline: newRfq.delivery_deadline || null,
        specifications: newRfq.specifications || null,
        notes: newRfq.notes || null
      };

      console.log("Payload RFQ envoyé :", payload);

      await rfqAPI.create(payload);

      toast.success("Demande de devis envoyée avec succès !");
      setShowCreateModal(false);
      
      setNewRfq({
        product_id: '',
        quantity: 10,
        target_price: '',
        delivery_location: '',
        delivery_deadline: '',
        specifications: '',
        notes: ''
      });

      fetchRFQs();
    } catch (err) {
      console.error("Erreur création RFQ:", err.response?.data || err);
      const errorMsg = err.response?.data?.detail?.[0]?.msg || "Erreur lors de l'envoi de la demande";
      toast.error(errorMsg);
    }
  };

  const openQuoteModal = (rfq) => {
    setSelectedRfqForQuote(rfq);
    setQuoteForm({ quoted_price: '', delivery_time: '', response_notes: '' });
    setShowQuoteModal(true);
  };

  const handleSubmitQuote = async () => {
    if (!quoteForm.quoted_price) {
      toast.error("Le prix est obligatoire");
      return;
    }

    try {
      await rfqAPI.submitQuote(selectedRfqForQuote.id, {
        quoted_price: parseFloat(quoteForm.quoted_price),
        delivery_time: quoteForm.delivery_time,
        response_notes: quoteForm.response_notes
      });
      toast.success("Devis envoyé avec succès");
      setShowQuoteModal(false);
      fetchRFQs();
    } catch (err) {
      toast.error("Erreur lors de l'envoi du devis");
    }
  };

  const handleAccept = async (rfqId) => {
    try {
      await rfqAPI.acceptQuote(rfqId);
      toast.success("Devis accepté ✓");
      fetchRFQs();
    } catch (err) {
      toast.error("Erreur lors de l'acceptation");
    }
  };

  const handleReject = async (rfqId) => {
    try {
      await rfqAPI.rejectQuote(rfqId);
      toast.success("Devis refusé");
      fetchRFQs();
    } catch (err) {
      toast.error("Erreur lors du refus");
    }
  };

  const getStatusBadge = (status) => {
    const map = {
      pending: "bg-yellow-100 text-yellow-700",
      quoted: "bg-blue-100 text-blue-700",
      accepted: "bg-green-100 text-green-700",
      rejected: "bg-red-100 text-red-700",
    };
    const labels = { 
      pending: "En attente", 
      quoted: "Devis reçu", 
      accepted: "Accepté", 
      rejected: "Refusé" 
    };
    return (
      <span className={`px-3 py-1 rounded-full text-xs font-medium ${map[status] || "bg-gray-100"}`}>
        {labels[status] || status}
      </span>
    );
  };

  if (loading) {
    return <Layout><div className="p-12 text-center">Chargement des RFQ...</div></Layout>;
  }

  return (
    <Layout>
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold">Demandes de Devis (RFQ)</h1>
          
          {isBuyer && (
            <Button onClick={() => setShowCreateModal(true)}>
              <Plus className="mr-2 h-4 w-4" /> Nouvelle RFQ
            </Button>
          )}
        </div>

        {rfqs.length === 0 ? (
          <Card className="p-16 text-center">
            <FileText className="mx-auto h-16 w-16 text-slate-300" />
            <p className="mt-4 text-lg">Aucune demande de devis pour le moment</p>
          </Card>
        ) : (
          <div className="space-y-6">
            {rfqs.map((rfq) => (
              <Card key={rfq.id} className="overflow-hidden">
                <CardHeader>
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="text-sm text-slate-500">{rfq.rfq_number}</p>
                      <h3 className="font-semibold text-lg">{rfq.product_name}</h3>
                    </div>
                    {getStatusBadge(rfq.status)}
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div><strong>Quantité :</strong> {rfq.quantity}</div>
                    {rfq.target_price && <div><strong>Prix cible :</strong> {formatPrice(rfq.target_price)}</div>}
                    <div><strong>Lieu :</strong> {rfq.delivery_location}</div>
                  </div>

                  {rfq.quoted_price && (
                    <div className="p-4 bg-green-50 rounded-lg">
                      <p className="font-medium">Devis reçu : <span className="text-xl font-bold text-green-600">{formatPrice(rfq.quoted_price)}</span></p>
                    </div>
                  )}

                  <div className="flex gap-3 pt-4 border-t">
                    {isSupplier && rfq.status === 'pending' && (
                      <Button onClick={() => openQuoteModal(rfq)}>
                        Soumettre un devis
                      </Button>
                    )}

                    {isBuyer && rfq.status === 'quoted' && (
                      <>
                        <Button onClick={() => handleAccept(rfq.id)} className="bg-green-600">Accepter</Button>
                        <Button variant="outline" onClick={() => handleReject(rfq.id)} className="text-red-600">Refuser</Button>
                      </>
                    )}

                    {rfq.status === 'accepted' && (
                      <div className="flex items-center text-green-600 font-medium">
                        <CheckCircle className="mr-2 h-5 w-5" /> Devis accepté
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Modal Création RFQ (Buyer) */}
        <Dialog open={showCreateModal} onOpenChange={setShowCreateModal}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Nouvelle Demande de Devis</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleCreateRFQ} className="space-y-5">
              <div>
                <Label>Produit souhaité *</Label>
                <Select 
                  value={newRfq.product_id} 
                  onValueChange={(v) => setNewRfq({ ...newRfq, product_id: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Choisir un produit" />
                  </SelectTrigger>
                  <SelectContent>
                    {products.map(p => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name} — {formatPrice(p.price)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Quantité *</Label>
                  <Input 
                    type="number" 
                    min="1"
                    value={newRfq.quantity} 
                    onChange={e => setNewRfq({...newRfq, quantity: parseInt(e.target.value) || 1})} 
                    required
                  />
                </div>
                <div>
                  <Label>Prix cible (XAF) - optionnel</Label>
                  <Input 
                    type="number" 
                    value={newRfq.target_price} 
                    onChange={e => setNewRfq({...newRfq, target_price: e.target.value})} 
                  />
                </div>
              </div>

              <div>
                <Label>Lieu de livraison *</Label>
                <Input 
                  value={newRfq.delivery_location} 
                  onChange={e => setNewRfq({...newRfq, delivery_location: e.target.value})} 
                  placeholder="Ex: Douala, Cameroun"
                  required 
                />
              </div>

              <div>
                <Label>Date limite de livraison (optionnel)</Label>
                <Input 
                  type="date"
                  value={newRfq.delivery_deadline}
                  onChange={e => setNewRfq({...newRfq, delivery_deadline: e.target.value})}
                />
              </div>

              <div>
                <Label>Spécifications particulières</Label>
                <Textarea 
                  value={newRfq.specifications}
                  onChange={e => setNewRfq({...newRfq, specifications: e.target.value})}
                  placeholder="Dimensions, matière, normes requises..."
                  rows={3}
                />
              </div>

              <div>
                <Label>Notes supplémentaires</Label>
                <Textarea 
                  value={newRfq.notes}
                  onChange={e => setNewRfq({...newRfq, notes: e.target.value})}
                  placeholder="Conditions particulières, délai souhaité..."
                  rows={2}
                />
              </div>

              <Button type="submit" className="w-full bg-accent hover:bg-accent-hover" size="lg">
                Envoyer la demande de devis
              </Button>
            </form>
          </DialogContent>
        </Dialog>

        {/* Modal Soumission Devis (Supplier) */}
        <Dialog open={showQuoteModal} onOpenChange={setShowQuoteModal}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Soumettre un devis pour {selectedRfqForQuote?.product_name}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Prix proposé (XAF) *</Label>
                <Input 
                  type="number" 
                  value={quoteForm.quoted_price} 
                  onChange={e => setQuoteForm({...quoteForm, quoted_price: e.target.value})} 
                />
              </div>
              <div>
                <Label>Délai de livraison</Label>
                <Input 
                  value={quoteForm.delivery_time} 
                  onChange={e => setQuoteForm({...quoteForm, delivery_time: e.target.value})} 
                  placeholder="Ex: 10 jours" 
                />
              </div>
              <div>
                <Label>Notes / Conditions</Label>
                <Textarea 
                  value={quoteForm.response_notes} 
                  onChange={e => setQuoteForm({...quoteForm, response_notes: e.target.value})} 
                />
              </div>
              <Button onClick={handleSubmitQuote} className="w-full">Envoyer le devis</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
}