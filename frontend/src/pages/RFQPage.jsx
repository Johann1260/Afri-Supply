import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { FileText, Plus, CheckCircle, XCircle } from '@phosphor-icons/react';
import { Layout } from '../components/layout';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { useAuth } from '../context/AuthContext';
import { useLocale } from '../context/LocaleContext';
import { rfqAPI, productsAPI } from '../lib/api';
import { formatPrice } from '../lib/utils';
import { toast } from 'sonner';

export default function RFQPage() {
  const navigate = useNavigate();
  const { isBuyer, isSupplier } = useAuth();
  const { t } = useLocale();

  const [rfqs, setRfqs] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newRfq, setNewRfq] = useState({
    product_id: '', quantity: 10, target_price: '',
    delivery_location: '', delivery_deadline: '', specifications: '', notes: ''
  });

  const [showQuoteModal, setShowQuoteModal] = useState(false);
  const [selectedRfqForQuote, setSelectedRfqForQuote] = useState(null);
  const [quoteForm, setQuoteForm] = useState({ quoted_price: '', delivery_time: '', response_notes: '' });

  const [searchParams] = useSearchParams();
  const preselectedProductId = searchParams.get('productId');

  useEffect(() => {
    if (preselectedProductId && isBuyer) {
      setNewRfq(prev => ({ ...prev, product_id: preselectedProductId }));
      setShowCreateModal(true);
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
    } catch { toast.error(t('common.error')); }
    finally { setLoading(false); }
  };

  const fetchProducts = async () => {
    try {
      const res = await productsAPI.getAll({ is_available: true });
      setProducts(res.data || []);
    } catch { console.error('fetchProducts'); }
  };

  // Patterns de détection de contournement (miroir light du backend)
  const BYPASS_REGEX = /\+?\d[\s\-.]?\d{6,}|@|whatsapp|telegram|appelle|call me|contact.?me|en priv|directly|mon num|my phone|www\.|https?:/i;

  const handleCreateRFQ = async (e) => {
    e.preventDefault();
    if (!newRfq.product_id) { toast.error(t('rfq.product')); return; }
    if (!newRfq.delivery_location) { toast.error(t('rfq.location')); return; }

    // Vérification anti-contournement côté client
    const fieldsToCheck = [newRfq.specifications, newRfq.notes, newRfq.delivery_location].filter(Boolean);
    for (const field of fieldsToCheck) {
      if (BYPASS_REGEX.test(field)) {
        toast.error(
          '🚫 Votre demande contient des coordonnées personnelles (téléphone, email, WhatsApp…). ' +
          'Retirez-les — les contacts sont partagés automatiquement après paiement.',
          { duration: 6000 }
        );
        return;
      }
    }

    try {
      const productRes = await productsAPI.getById(newRfq.product_id);
      const product = productRes.data;
      if (!product?.supplier_id) { toast.error(t('common.error')); return; }

      await rfqAPI.create({
        product_id: newRfq.product_id,
        supplier_id: product.supplier_id,
        quantity: parseInt(newRfq.quantity) || 1,
        target_price: newRfq.target_price?.trim() ? parseFloat(newRfq.target_price) : null,
        delivery_location: newRfq.delivery_location,
        delivery_deadline: newRfq.delivery_deadline || null,
        specifications: newRfq.specifications || null,
        notes: newRfq.notes || null,
      });

      toast.success(t('rfq.submit') + ' ✓');
      setShowCreateModal(false);
      setNewRfq({ product_id: '', quantity: 10, target_price: '', delivery_location: '', delivery_deadline: '', specifications: '', notes: '' });
      fetchRFQs();
    } catch (err) {
      toast.error(err.response?.data?.detail?.[0]?.msg || t('common.error'));
    }
  };

  const openQuoteModal = (rfq) => {
    setSelectedRfqForQuote(rfq);
    setQuoteForm({ quoted_price: '', delivery_time: '', response_notes: '' });
    setShowQuoteModal(true);
  };

  const handleSubmitQuote = async () => {
    if (!quoteForm.quoted_price) { toast.error(t('rfq.quote.price')); return; }
    try {
      await rfqAPI.submitQuote(selectedRfqForQuote.id, {
        quoted_price: parseFloat(quoteForm.quoted_price),
        delivery_time: quoteForm.delivery_time,
        response_notes: quoteForm.response_notes,
      });
      toast.success(t('rfq.quote.submit') + ' ✓');
      setShowQuoteModal(false);
      fetchRFQs();
    } catch { toast.error(t('common.error')); }
  };

  const handleAccept = async (rfqId) => {
    try { await rfqAPI.acceptQuote(rfqId); toast.success(t('rfq.status.accepted')); fetchRFQs(); }
    catch { toast.error(t('common.error')); }
  };

  const handleReject = async (rfqId) => {
    try { await rfqAPI.rejectQuote(rfqId); toast.success(t('rfq.status.rejected')); fetchRFQs(); }
    catch { toast.error(t('common.error')); }
  };

  const statusBadge = (status) => {
    const styles = {
      pending:  'bg-yellow-100 text-yellow-700',
      quoted:   'bg-blue-100 text-blue-700',
      accepted: 'bg-green-100 text-green-700',
      rejected: 'bg-red-100 text-red-700',
    };
    const labels = {
      pending:  t('rfq.status.pending'),
      quoted:   t('rfq.status.quoted'),
      accepted: t('rfq.status.accepted'),
      rejected: t('rfq.status.rejected'),
    };
    return (
      <span className={`px-3 py-1 rounded-full text-xs font-medium ${styles[status] || 'bg-gray-100'}`}>
        {labels[status] || status}
      </span>
    );
  };

  if (loading) return <Layout><div className="p-12 text-center">{t('common.loading')}</div></Layout>;

  return (
    <Layout>
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold">{t('rfq.title')}</h1>
          {isBuyer && (
            <Button onClick={() => setShowCreateModal(true)}>
              <Plus className="mr-2 h-4 w-4" /> {t('rfq.new')}
            </Button>
          )}
        </div>

        {rfqs.length === 0 ? (
          <Card className="p-16 text-center">
            <FileText className="mx-auto h-16 w-16 text-slate-300" />
            <p className="mt-4 text-lg text-slate-500">{t('rfq.none')}</p>
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
                    {statusBadge(rfq.status)}
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div><strong>{t('rfq.quantity')} :</strong> {rfq.quantity}</div>
                    {rfq.target_price && <div><strong>{t('rfq.targetPrice')} :</strong> {formatPrice(rfq.target_price)}</div>}
                    <div><strong>{t('rfq.location')} :</strong> {rfq.delivery_location}</div>
                  </div>

                  {rfq.quoted_price && (
                    <div className="p-4 bg-green-50 rounded-lg">
                      <p className="font-medium">
                        {t('rfq.status.quoted')} : <span className="text-xl font-bold text-green-600">{formatPrice(rfq.quoted_price)}</span>
                      </p>
                    </div>
                  )}

                  <div className="flex gap-3 pt-4 border-t">
                    {isSupplier && rfq.status === 'pending' && (
                      <Button onClick={() => openQuoteModal(rfq)}>{t('rfq.quote')}</Button>
                    )}
                    {isBuyer && rfq.status === 'quoted' && (
                      <>
                        <Button onClick={() => handleAccept(rfq.id)} className="bg-green-600 hover:bg-green-700">
                          <CheckCircle className="w-4 h-4 mr-1" /> {t('rfq.accept')}
                        </Button>
                        <Button variant="outline" onClick={() => handleReject(rfq.id)} className="text-red-600 border-red-300 hover:bg-red-50">
                          <XCircle className="w-4 h-4 mr-1" /> {t('rfq.reject')}
                        </Button>
                      </>
                    )}
                    {rfq.status === 'accepted' && (
                      <div className="flex items-center text-green-600 font-medium">
                        <CheckCircle className="mr-2 h-5 w-5" /> {t('rfq.status.accepted')}
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Modal Création RFQ */}
        <Dialog open={showCreateModal} onOpenChange={setShowCreateModal}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>{t('rfq.new')}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleCreateRFQ} className="space-y-5">
              <div>
                <Label>{t('rfq.product')} *</Label>
                <Select value={newRfq.product_id} onValueChange={(v) => setNewRfq({ ...newRfq, product_id: v })}>
                  <SelectTrigger><SelectValue placeholder={t('rfq.product')} /></SelectTrigger>
                  <SelectContent>
                    {products.map((p) => (
                      <SelectItem key={p.id} value={p.id}>{p.name} — {formatPrice(p.price)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>{t('rfq.quantity')} *</Label>
                  <Input type="number" min="1" value={newRfq.quantity}
                    onChange={(e) => setNewRfq({ ...newRfq, quantity: parseInt(e.target.value) || 1 })} required />
                </div>
                <div>
                  <Label>{t('rfq.targetPrice')}</Label>
                  <Input type="number" value={newRfq.target_price}
                    onChange={(e) => setNewRfq({ ...newRfq, target_price: e.target.value })} />
                </div>
              </div>
              <div>
                <Label>{t('rfq.location')} *</Label>
                <Input value={newRfq.delivery_location}
                  onChange={(e) => setNewRfq({ ...newRfq, delivery_location: e.target.value })}
                  placeholder="Ex: Douala, Cameroun" required />
              </div>
              <div>
                <Label>{t('rfq.deadline')}</Label>
                <Input type="date" value={newRfq.delivery_deadline}
                  onChange={(e) => setNewRfq({ ...newRfq, delivery_deadline: e.target.value })} />
              </div>
              <div>
                <Label>{t('rfq.specs')}</Label>
                <Textarea value={newRfq.specifications}
                  onChange={(e) => setNewRfq({ ...newRfq, specifications: e.target.value })} rows={3} />
              </div>
              <div>
                <Label>{t('rfq.notes')}</Label>
                <Textarea value={newRfq.notes}
                  onChange={(e) => setNewRfq({ ...newRfq, notes: e.target.value })} rows={2} />
              </div>
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-800">
                🔒 <strong>Protection AfriSupply :</strong> Ne partagez pas vos coordonnées dans ce formulaire.
                Les contacts sont échangés automatiquement après confirmation du paiement.
              </div>
              <Button type="submit" className="w-full bg-accent hover:bg-accent-hover" size="lg">
                {t('rfq.submit')}
              </Button>
            </form>
          </DialogContent>
        </Dialog>

        {/* Modal Devis Fournisseur */}
        <Dialog open={showQuoteModal} onOpenChange={setShowQuoteModal}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t('rfq.quote')} — {selectedRfqForQuote?.product_name}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-2">
              <div>
                <Label>{t('rfq.quote.price')} *</Label>
                <Input type="number" value={quoteForm.quoted_price}
                  onChange={(e) => setQuoteForm({ ...quoteForm, quoted_price: e.target.value })} />
              </div>
              <div>
                <Label>{t('rfq.quote.delivery')}</Label>
                <Input value={quoteForm.delivery_time}
                  onChange={(e) => setQuoteForm({ ...quoteForm, delivery_time: e.target.value })}
                  placeholder="Ex: 10 jours" />
              </div>
              <div>
                <Label>{t('rfq.quote.notes')}</Label>
                <Textarea value={quoteForm.response_notes}
                  onChange={(e) => setQuoteForm({ ...quoteForm, response_notes: e.target.value })} />
              </div>
              <Button onClick={handleSubmitQuote} className="w-full bg-accent hover:bg-accent-hover">
                {t('rfq.quote.submit')}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
}