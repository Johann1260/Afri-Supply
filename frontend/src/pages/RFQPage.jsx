import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FileText, Plus, ArrowRight, MagnifyingGlass, Globe, Lock,
  ClockCountdown, CheckCircle, XCircle, Spinner, Tag, Buildings
} from '@phosphor-icons/react';
import { Layout } from '../components/layout';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import { Badge } from '../components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { useAuth } from '../context/AuthContext';
import { useLocale } from '../context/LocaleContext';
import { rfqAPI, quotationsAPI, productsAPI, categoriesAPI } from '../lib/api';
import { formatPrice } from '../lib/utils';
import { toast } from 'sonner';

// ── Status meta (labels resolved via t() at render time) ─────────────────────
const STATUS_KEYS = {
  open:      { tKey: 'rfq.status.open',      color: 'bg-blue-100 text-blue-800' },
  comparing: { tKey: 'rfq.status.comparing', color: 'bg-yellow-100 text-yellow-800' },
  accepted:  { tKey: 'rfq.status.accepted',  color: 'bg-green-100 text-green-800' },
  ordered:   { tKey: 'rfq.status.ordered',   color: 'bg-purple-100 text-purple-800' },
  cancelled: { tKey: 'rfq.status.cancelled', color: 'bg-red-100 text-red-800' },
  closed:    { tKey: 'rfq.status.closed',    color: 'bg-gray-100 text-gray-700' },
};

function StatusBadge({ status }) {
  const { t } = useLocale();
  const m = STATUS_KEYS[status] || { tKey: null, color: 'bg-gray-100 text-gray-700' };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${m.color}`}>
      {m.tKey ? t(m.tKey) : status}
    </span>
  );
}

// ── RFQ card ──────────────────────────────────────────────────────────────────
function RFQCard({ rfq, onView, isBuyer, isSupplier, onSubmitQuote }) {
  const { t } = useLocale();
  const isPublic = rfq.rfq_type === 'public';
  return (
    <Card className="hover:shadow-md transition-shadow cursor-pointer" onClick={() => onView(rfq.id)}>
      <CardContent className="p-4 space-y-2">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            {isPublic
              ? <Globe size={16} className="text-blue-500 shrink-0" />
              : <Lock size={16} className="text-gray-400 shrink-0" />}
            <span className="font-medium text-sm truncate">
              {rfq.title || rfq.product_name || rfq.rfq_number}
            </span>
          </div>
          <StatusBadge status={rfq.status} />
        </div>

        <div className="flex flex-wrap gap-3 text-xs text-gray-500">
          <span>{t('rfq.qty')} : <strong className="text-gray-800">{rfq.quantity} {rfq.unit || 'unités'}</strong></span>
          {rfq.target_price && <span>{t('rfq.budget')} : <strong className="text-gray-800">{formatPrice(rfq.target_price)}</strong></span>}
          {rfq.quote_count > 0 && <span>{t('rfq.quote')} : <strong className="text-blue-600">{rfq.quote_count}</strong></span>}
          {rfq.best_price && <span>{t('rfq.bestPrice')} : <strong className="text-green-600">{formatPrice(rfq.best_price)}</strong></span>}
        </div>

        <div className="flex items-center justify-between pt-1">
          <span className="text-xs text-gray-400">{rfq.rfq_number}</span>
          <div className="flex gap-2" onClick={e => e.stopPropagation()}>
            {isSupplier && rfq.status === 'open' && (
              <Button size="sm" variant="outline" onClick={() => onSubmitQuote(rfq)}>
                {t('rfq.submitQuote')}
              </Button>
            )}
            <Button size="sm" variant="ghost" onClick={() => onView(rfq.id)}>
              {t('rfq.view')} <ArrowRight size={14} className="ml-1" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ── QuotationModal (supplier submit) ─────────────────────────────────────────
function QuotationModal({ rfq, open, onClose, onSuccess }) {
  const { t } = useLocale();
  const [form, setForm] = useState({
    unit_price: '', quantity: rfq?.quantity || 1,
    currency: 'XAF', delivery_time_days: 14,
    validity_days: 30, moq: '', conditions: '', notes: '',
  });
  const [submitting, setSubmitting] = useState(false);

  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.unit_price) return toast.error(t('rfq.unitRequired'));
    setSubmitting(true);
    try {
      await quotationsAPI.submit(rfq.id, {
        ...form,
        unit_price: parseFloat(form.unit_price),
        quantity: parseInt(form.quantity),
        moq: form.moq ? parseInt(form.moq) : undefined,
      });
      toast.success(t('rfq.submitted.ok'));
      onSuccess();
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.detail || t('rfq.submitError'));
    } finally {
      setSubmitting(false);
    }
  }

  if (!rfq) return null;
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{t('rfq.quoteDialog')}</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-gray-500 -mt-2">
          {rfq.title || rfq.product_name} — {rfq.quantity} {rfq.unit || 'unités'}
        </p>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>{t('rfq.unitPriceLabel')} *</Label>
              <Input type="number" min="1" value={form.unit_price}
                onChange={e => set('unit_price', e.target.value)} required />
            </div>
            <div>
              <Label>{t('rfq.quantityLabel')}</Label>
              <Input type="number" min="1" value={form.quantity}
                onChange={e => set('quantity', e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>{t('rfq.deliveryLabel')}</Label>
              <Input type="number" min="1" value={form.delivery_time_days}
                onChange={e => set('delivery_time_days', parseInt(e.target.value))} />
            </div>
            <div>
              <Label>{t('rfq.validityLabel')}</Label>
              <Input type="number" min="1" value={form.validity_days}
                onChange={e => set('validity_days', parseInt(e.target.value))} />
            </div>
          </div>
          <div>
            <Label>{t('rfq.moqLabel')}</Label>
            <Input type="number" min="1" placeholder={t('rfq.moqPh')} value={form.moq}
              onChange={e => set('moq', e.target.value)} />
          </div>
          <div>
            <Label>{t('rfq.conditionsLabel')}</Label>
            <Textarea rows={2} placeholder={t('rfq.conditionsPh')} value={form.conditions}
              onChange={e => set('conditions', e.target.value)} />
          </div>
          <div>
            <Label>{t('rfq.notes')}</Label>
            <Textarea rows={2} placeholder={t('rfq.notesPh')} value={form.notes}
              onChange={e => set('notes', e.target.value)} />
          </div>
          {form.unit_price && (
            <div className="bg-blue-50 rounded p-2 text-sm">
              {t('rfq.totalEstimate')} : <strong>{formatPrice(parseFloat(form.unit_price || 0) * parseInt(form.quantity || 0))}</strong>
            </div>
          )}
          <div className="flex gap-2 pt-1">
            <Button type="button" variant="outline" className="flex-1" onClick={onClose}>{t('common.cancel')}</Button>
            <Button type="submit" className="flex-1" disabled={submitting}>
              {submitting ? <Spinner size={16} className="animate-spin mr-1" /> : null}
              {t('rfq.quote.submit')}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ── CreateRFQModal ────────────────────────────────────────────────────────────
function CreateRFQModal({ open, onClose, onSuccess }) {
  const { t } = useLocale();
  const [rfqType, setRfqType] = useState('public');
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    title: '', description: '', category_id: '',
    product_id: '', quantity: 1, unit: 'unité',
    target_price: '', delivery_location: '',
    delivery_deadline: '', specifications: '',
  });

  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  useEffect(() => {
    if (!open) return;
    Promise.allSettled([
      productsAPI.getAll({ limit: 200 }),
      categoriesAPI.getAll(),
    ]).then(([p, c]) => {
      if (p.status === 'fulfilled') setProducts(p.value.data?.items || p.value.data || []);
      if (c.status === 'fulfilled') setCategories(c.value.data || []);
    }).catch(() => {});
  }, [open]);

  async function handleSubmit(e) {
    e.preventDefault();
    if (rfqType === 'private' && !form.product_id) return toast.error(t('rfq.productLabel'));
    if (rfqType === 'public' && !form.title) return toast.error(t('rfq.titleLabel'));
    if (!form.quantity || form.quantity < 1) return toast.error(t('rfq.quantityLabel'));
    if (!form.delivery_location) return toast.error(t('rfq.location'));

    setSubmitting(true);
    try {
      const payload = {
        quantity: parseInt(form.quantity),
        delivery_location: form.delivery_location,
        target_price: form.target_price ? parseFloat(form.target_price) : undefined,
        delivery_deadline: form.delivery_deadline || undefined,
        specifications: form.specifications || undefined,
      };
      if (rfqType === 'public') {
        await rfqAPI.createPublic({ ...payload, title: form.title, description: form.description, unit: form.unit, category_id: form.category_id || undefined });
      } else {
        await rfqAPI.create({ ...payload, product_id: form.product_id });
      }
      toast.success(t('rfq.published.ok'));
      onSuccess();
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.detail || t('common.error'));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t('rfq.newDialog')}</DialogTitle>
        </DialogHeader>

        {/* Type selector */}
        <div className="flex gap-2 p-1 bg-gray-100 rounded-lg">
          {[
            ['public', t('rfq.publicType'), t('rfq.publicTypeSub')],
            ['private', t('rfq.privateType'), t('rfq.privateTypeSub')],
          ].map(([v, label, sub]) => (
            <button key={v} type="button"
              className={`flex-1 py-2 px-3 rounded-md text-sm transition-colors ${rfqType === v ? 'bg-white shadow font-medium' : 'text-gray-500'}`}
              onClick={() => setRfqType(v)}>
              {label}
              <div className="text-xs font-normal text-gray-400">{sub}</div>
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          {rfqType === 'public' ? (
            <>
              <div>
                <Label>{t('rfq.titleLabel')} *</Label>
                <Input placeholder={t('rfq.titlePh')} value={form.title}
                  onChange={e => set('title', e.target.value)} required />
              </div>
              <div>
                <Label>{t('rfq.descLabel')}</Label>
                <Textarea rows={3} placeholder={t('rfq.descPh')}
                  value={form.description} onChange={e => set('description', e.target.value)} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>{t('rfq.unitLabel')}</Label>
                  <Input placeholder={t('rfq.unitPh')} value={form.unit}
                    onChange={e => set('unit', e.target.value)} />
                </div>
                <div>
                  <Label>{t('rfq.categoryLabel')}</Label>
                  <Select value={form.category_id} onValueChange={v => set('category_id', v)}>
                    <SelectTrigger><SelectValue placeholder={t('rfq.categoryPh')} /></SelectTrigger>
                    <SelectContent>
                      {categories.map(c => (
                        <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </>
          ) : (
            <div>
              <Label>{t('rfq.productLabel')} *</Label>
              <Select value={form.product_id} onValueChange={v => set('product_id', v)}>
                <SelectTrigger><SelectValue placeholder={t('rfq.productPh')} /></SelectTrigger>
                <SelectContent>
                  {products.map(p => (
                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>{t('rfq.quantityLabel')} *</Label>
              <Input type="number" min="1" value={form.quantity}
                onChange={e => set('quantity', e.target.value)} required />
            </div>
            <div>
              <Label>{t('rfq.budgetLabel')}</Label>
              <Input type="number" min="0" placeholder={t('rfq.moqPh')} value={form.target_price}
                onChange={e => set('target_price', e.target.value)} />
            </div>
          </div>

          <div>
            <Label>{t('rfq.location')} *</Label>
            <Input placeholder={t('rfq.locationPh')} value={form.delivery_location}
              onChange={e => set('delivery_location', e.target.value)} required />
          </div>

          <div>
            <Label>{t('rfq.deadlineLabel')}</Label>
            <Input type="date" value={form.delivery_deadline}
              onChange={e => set('delivery_deadline', e.target.value)} />
          </div>

          <div>
            <Label>{t('rfq.specsLabel')}</Label>
            <Textarea rows={2} placeholder={t('rfq.specsPh')}
              value={form.specifications} onChange={e => set('specifications', e.target.value)} />
          </div>

          <div className="flex gap-2 pt-1">
            <Button type="button" variant="outline" className="flex-1" onClick={onClose}>{t('common.cancel')}</Button>
            <Button type="submit" className="flex-1" disabled={submitting}>
              {submitting ? <Spinner size={16} className="animate-spin mr-1" /> : null}
              {t('rfq.publish')}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function RFQPage() {
  const navigate = useNavigate();
  const { user, isBuyer, isSupplier, isAdmin } = useAuth();
  const { t } = useLocale();

  const [rfqs, setRfqs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);

  const [showCreate, setShowCreate] = useState(false);
  const [quoteTarget, setQuoteTarget] = useState(null);

  const LIMIT = 20;

  const fetchRfqs = useCallback(async () => {
    setLoading(true);
    try {
      const params = { page, limit: LIMIT, ...(statusFilter && { status: statusFilter }) };
      let res;
      if (isSupplier) {
        res = await rfqAPI.getPublic(params);
      } else {
        res = await rfqAPI.getMine(params);
      }
      const data = res.data;
      setRfqs(Array.isArray(data) ? data : (data.items ?? []));
      setTotal(data.total ?? 0);
    } catch {
      toast.error(t('common.error'));
    } finally {
      setLoading(false);
    }
  }, [page, statusFilter, isSupplier]);

  useEffect(() => { fetchRfqs(); }, [fetchRfqs]);

  const filtered = rfqs.filter(r => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (r.title || r.product_name || r.rfq_number || '').toLowerCase().includes(q);
  });

  const totalPages = Math.ceil(total / LIMIT);

  return (
    <Layout>
      <div className="max-w-5xl mx-auto px-4 py-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold">
              {isSupplier ? t('rfq.publicTitle') : t('rfq.myTitle')}
            </h1>
            <p className="text-sm text-gray-500 mt-0.5">
              {isSupplier ? t('rfq.publicSub') : t('rfq.mySub')}
            </p>
          </div>
          {(isBuyer || isAdmin) && (
            <Button onClick={() => setShowCreate(true)}>
              <Plus size={16} className="mr-1" /> {t('rfq.newRequest')}
            </Button>
          )}
        </div>

        {/* Filters */}
        <div className="flex gap-3 flex-wrap">
          <div className="relative flex-1 min-w-48">
            <MagnifyingGlass size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <Input className="pl-9" placeholder={t('common.search') + '...'} value={search}
              onChange={e => setSearch(e.target.value)} />
          </div>
          <Select value={statusFilter} onValueChange={v => { setStatusFilter(v === 'all' ? '' : v); setPage(1); }}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder={t('rfq.allStatuses')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('rfq.allStatuses')}</SelectItem>
              {Object.entries(STATUS_KEYS).map(([k, v]) => (
                <SelectItem key={k} value={k}>{t(v.tKey)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Stats bar (buyer only) */}
        {isBuyer && !loading && (
          <div className="flex gap-4 text-sm text-gray-500 flex-wrap">
            {Object.entries(STATUS_KEYS).map(([k, v]) => {
              const count = rfqs.filter(r => r.status === k).length;
              if (!count) return null;
              return (
                <span key={k}>
                  <span className={`inline-block w-2 h-2 rounded-full mr-1 ${v.color.split(' ')[0]}`} />
                  {t(v.tKey)} : <strong>{count}</strong>
                </span>
              );
            })}
          </div>
        )}

        {/* List */}
        {loading ? (
          <div className="flex justify-center py-16">
            <Spinner size={32} className="animate-spin text-blue-500" />
          </div>
        ) : filtered.length === 0 ? (
          <Card>
            <CardContent className="py-16 text-center text-gray-400">
              <FileText size={48} className="mx-auto mb-3 opacity-30" />
              <p className="font-medium">{t('rfq.none')}</p>
              {isBuyer && (
                <Button className="mt-4" onClick={() => setShowCreate(true)}>
                  <Plus size={16} className="mr-1" /> {t('rfq.create')}
                </Button>
              )}
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {filtered.map(rfq => (
              <RFQCard key={rfq.id} rfq={rfq}
                isBuyer={isBuyer} isSupplier={isSupplier}
                onView={id => navigate(`/rfq/${id}`)}
                onSubmitQuote={r => setQuoteTarget(r)}
              />
            ))}
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-3 pt-2">
            <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage(p => p - 1)}>{t('rfq.prev')}</Button>
            <span className="text-sm text-gray-500">{page} / {totalPages}</span>
            <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>{t('rfq.next')}</Button>
          </div>
        )}
      </div>

      {/* Modals */}
      <CreateRFQModal open={showCreate} onClose={() => setShowCreate(false)} onSuccess={fetchRfqs} />
      <QuotationModal rfq={quoteTarget} open={!!quoteTarget} onClose={() => setQuoteTarget(null)} onSuccess={fetchRfqs} />
    </Layout>
  );
}
