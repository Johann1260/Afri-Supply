import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { 
  FileText,
  Plus,
  Clock,
  CheckCircle,
  XCircle,
  ArrowRight,
  Package,
  MapPin,
  CalendarBlank
} from '@phosphor-icons/react';
import { Layout } from '../components/layout';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '../components/ui/dialog';
import { useAuth } from '../context/AuthContext';
import api from '../lib/api';
import { formatPrice, formatDate, getStatusColor } from '../lib/utils';
import { toast } from 'sonner';

const RFQPage = () => {
  const navigate = useNavigate();
  const { rfqId } = useParams();
  const { user, isAuthenticated, loading: authLoading } = useAuth();
  const [rfqs, setRfqs] = useState([]);
  const [selectedRfq, setSelectedRfq] = useState(null);
  const [loading, setLoading] = useState(true);
  const [quoteDialogOpen, setQuoteDialogOpen] = useState(false);
  const [quoteData, setQuoteData] = useState({
    quoted_price: '',
    delivery_time: '',
    response_notes: ''
  });

  useEffect(() => {
    if (authLoading) return; // Wait for auth to initialize
    
    if (!isAuthenticated) {
      navigate('/login');
      return;
    }
    fetchRFQs();
  }, [isAuthenticated, authLoading, navigate]);

  useEffect(() => {
    if (rfqId && rfqs.length > 0) {
      const rfq = rfqs.find(r => r.id === rfqId);
      setSelectedRfq(rfq);
    }
  }, [rfqId, rfqs]);

  const fetchRFQs = async () => {
    try {
      const res = await api.get('/rfq');
      setRfqs(res.data);
    } catch (error) {
      console.error('Failed to fetch RFQs:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitQuote = async () => {
    if (!quoteData.quoted_price) {
      toast.error('Veuillez entrer un prix');
      return;
    }

    try {
      await api.post(`/rfq/${selectedRfq.id}/quote`, {
        quoted_price: parseFloat(quoteData.quoted_price),
        delivery_time: quoteData.delivery_time,
        response_notes: quoteData.response_notes
      });
      toast.success('Devis envoyé');
      setQuoteDialogOpen(false);
      fetchRFQs();
    } catch (error) {
      toast.error('Erreur lors de l\'envoi du devis');
    }
  };

  const handleAcceptQuote = async (rfqId) => {
    try {
      await api.post(`/rfq/${rfqId}/accept`);
      toast.success('Devis accepté');
      fetchRFQs();
    } catch (error) {
      toast.error('Erreur');
    }
  };

  const handleRejectQuote = async (rfqId) => {
    try {
      await api.post(`/rfq/${rfqId}/reject`);
      toast.success('Devis refusé');
      fetchRFQs();
    } catch (error) {
      toast.error('Erreur');
    }
  };

  const getStatusBadge = (status) => {
    const styles = {
      pending: 'bg-yellow-100 text-yellow-800 border-yellow-200',
      quoted: 'bg-blue-100 text-blue-800 border-blue-200',
      accepted: 'bg-green-100 text-green-800 border-green-200',
      rejected: 'bg-red-100 text-red-800 border-red-200',
      expired: 'bg-slate-100 text-slate-800 border-slate-200'
    };
    
    const labels = {
      pending: 'En attente',
      quoted: 'Devis reçu',
      accepted: 'Accepté',
      rejected: 'Refusé',
      expired: 'Expiré'
    };

    return (
      <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium border ${styles[status] || styles.pending}`}>
        {labels[status] || status}
      </span>
    );
  };

  const isSupplier = user?.user_type === 'supplier';

  return (
    <Layout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="section-heading">Demandes de Devis (RFQ)</h1>
            <p className="text-slate-500 mt-1">
              {isSupplier ? 'Gérez les demandes de devis reçues' : 'Suivez vos demandes de devis'}
            </p>
          </div>
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          {/* RFQ List */}
          <div className="lg:col-span-1">
            <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
              <div className="p-4 border-b border-slate-200">
                <h2 className="font-semibold">Mes demandes</h2>
              </div>
              
              {loading ? (
                <div className="p-4 space-y-4">
                  {[...Array(3)].map((_, i) => (
                    <div key={i} className="animate-pulse space-y-2">
                      <div className="h-4 bg-slate-200 rounded w-3/4" />
                      <div className="h-3 bg-slate-200 rounded w-1/2" />
                    </div>
                  ))}
                </div>
              ) : rfqs.length === 0 ? (
                <div className="p-8 text-center">
                  <FileText className="w-12 h-12 mx-auto text-slate-300 mb-4" />
                  <p className="text-slate-500">Aucune demande de devis</p>
                  {!isSupplier && (
                    <Link to="/products">
                      <Button className="mt-4 bg-accent hover:bg-accent-hover" size="sm">
                        Parcourir les produits
                      </Button>
                    </Link>
                  )}
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {rfqs.map((rfq) => (
                    <button
                      key={rfq.id}
                      onClick={() => {
                        setSelectedRfq(rfq);
                        navigate(`/rfq/${rfq.id}`);
                      }}
                      className={`w-full p-4 text-left hover:bg-slate-50 transition-colors ${
                        selectedRfq?.id === rfq.id ? 'bg-primary/5' : ''
                      }`}
                      data-testid={`rfq-item-${rfq.id}`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="font-medium truncate">{rfq.product_name}</p>
                          <p className="text-sm text-slate-500">
                            {isSupplier ? rfq.buyer_name : rfq.supplier_name}
                          </p>
                          <p className="text-xs text-slate-400 mt-1">
                            Qté: {rfq.quantity}
                          </p>
                        </div>
                        {getStatusBadge(rfq.status)}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* RFQ Detail */}
          <div className="lg:col-span-2">
            {selectedRfq ? (
              <div className="bg-white border border-slate-200 rounded-lg p-6">
                <div className="flex items-start justify-between mb-6">
                  <div>
                    <p className="text-sm text-slate-500">{selectedRfq.rfq_number}</p>
                    <h2 className="font-heading font-bold text-xl mt-1">{selectedRfq.product_name}</h2>
                    <p className="text-slate-600 mt-1">
                      {isSupplier ? `De: ${selectedRfq.buyer_name}` : `À: ${selectedRfq.supplier_name}`}
                      {selectedRfq.buyer_company && !isSupplier && ` (${selectedRfq.buyer_company})`}
                    </p>
                  </div>
                  {getStatusBadge(selectedRfq.status)}
                </div>

                <div className="grid md:grid-cols-2 gap-6 mb-6">
                  <div className="space-y-4">
                    <div className="flex items-center gap-3">
                      <Package className="w-5 h-5 text-slate-400" />
                      <div>
                        <p className="text-sm text-slate-500">Quantité demandée</p>
                        <p className="font-semibold">{selectedRfq.quantity}</p>
                      </div>
                    </div>
                    
                    {selectedRfq.target_price && (
                      <div className="flex items-center gap-3">
                        <FileText className="w-5 h-5 text-slate-400" />
                        <div>
                          <p className="text-sm text-slate-500">Prix cible</p>
                          <p className="font-semibold">{formatPrice(selectedRfq.target_price)}</p>
                        </div>
                      </div>
                    )}

                    <div className="flex items-center gap-3">
                      <MapPin className="w-5 h-5 text-slate-400" />
                      <div>
                        <p className="text-sm text-slate-500">Lieu de livraison</p>
                        <p className="font-semibold">{selectedRfq.delivery_location}</p>
                      </div>
                    </div>

                    {selectedRfq.delivery_deadline && (
                      <div className="flex items-center gap-3">
                        <CalendarBlank className="w-5 h-5 text-slate-400" />
                        <div>
                          <p className="text-sm text-slate-500">Date limite</p>
                          <p className="font-semibold">{selectedRfq.delivery_deadline}</p>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Quote info */}
                  {selectedRfq.quoted_price && (
                    <div className="bg-slate-50 rounded-lg p-4">
                      <h3 className="font-semibold mb-3">Devis du fournisseur</h3>
                      <p className="text-2xl font-heading font-bold text-accent">
                        {formatPrice(selectedRfq.quoted_price)}
                      </p>
                      {selectedRfq.supplier_response && (
                        <p className="text-slate-600 mt-2">{selectedRfq.supplier_response}</p>
                      )}
                    </div>
                  )}
                </div>

                {selectedRfq.specifications && (
                  <div className="mb-6">
                    <h3 className="font-semibold mb-2">Spécifications</h3>
                    <p className="text-slate-600">{selectedRfq.specifications}</p>
                  </div>
                )}

                {selectedRfq.notes && (
                  <div className="mb-6">
                    <h3 className="font-semibold mb-2">Notes</h3>
                    <p className="text-slate-600">{selectedRfq.notes}</p>
                  </div>
                )}

                {/* Actions */}
                <div className="flex gap-3 pt-4 border-t border-slate-200">
                  {/* Supplier actions */}
                  {isSupplier && selectedRfq.status === 'pending' && (
                    <Dialog open={quoteDialogOpen} onOpenChange={setQuoteDialogOpen}>
                      <DialogTrigger asChild>
                        <Button className="bg-accent hover:bg-accent-hover" data-testid="submit-quote-btn">
                          Soumettre un devis
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Soumettre un devis</DialogTitle>
                          <DialogDescription>
                            Proposez votre prix pour cette demande
                          </DialogDescription>
                        </DialogHeader>
                        <div className="space-y-4 pt-4">
                          <div>
                            <Label>Prix proposé (XAF) *</Label>
                            <Input
                              type="number"
                              value={quoteData.quoted_price}
                              onChange={(e) => setQuoteData({ ...quoteData, quoted_price: e.target.value })}
                              placeholder="Ex: 500000"
                              data-testid="quote-price-input"
                            />
                          </div>
                          <div>
                            <Label>Délai de livraison</Label>
                            <Input
                              value={quoteData.delivery_time}
                              onChange={(e) => setQuoteData({ ...quoteData, delivery_time: e.target.value })}
                              placeholder="Ex: 2 semaines"
                            />
                          </div>
                          <div>
                            <Label>Notes</Label>
                            <Textarea
                              value={quoteData.response_notes}
                              onChange={(e) => setQuoteData({ ...quoteData, response_notes: e.target.value })}
                              placeholder="Conditions, remarques..."
                            />
                          </div>
                          <Button 
                            className="w-full bg-accent hover:bg-accent-hover"
                            onClick={handleSubmitQuote}
                            data-testid="confirm-quote"
                          >
                            Envoyer le devis
                          </Button>
                        </div>
                      </DialogContent>
                    </Dialog>
                  )}

                  {/* Buyer actions */}
                  {!isSupplier && selectedRfq.status === 'quoted' && (
                    <>
                      <Button 
                        className="bg-green-600 hover:bg-green-700"
                        onClick={() => handleAcceptQuote(selectedRfq.id)}
                        data-testid="accept-quote"
                      >
                        <CheckCircle className="w-4 h-4 mr-2" />
                        Accepter
                      </Button>
                      <Button 
                        variant="outline"
                        className="text-red-600 border-red-600 hover:bg-red-50"
                        onClick={() => handleRejectQuote(selectedRfq.id)}
                        data-testid="reject-quote"
                      >
                        <XCircle className="w-4 h-4 mr-2" />
                        Refuser
                      </Button>
                    </>
                  )}

                  {selectedRfq.status === 'accepted' && (
                    <div className="flex items-center gap-2 text-green-600">
                      <CheckCircle className="w-5 h-5" weight="fill" />
                      <span className="font-medium">Devis accepté</span>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="bg-white border border-slate-200 rounded-lg p-12 text-center">
                <FileText className="w-16 h-16 mx-auto text-slate-300 mb-4" />
                <p className="text-slate-500">Sélectionnez une demande pour voir les détails</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default RFQPage;
