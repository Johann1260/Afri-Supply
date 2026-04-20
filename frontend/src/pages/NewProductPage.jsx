import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Upload, X } from '@phosphor-icons/react';
import { Layout } from '../components/layout';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { productsAPI, categoriesAPI } from '../lib/api';
import { getImageUrl } from '../lib/utils';
import { useLocale } from '../context/LocaleContext';
import { useAuth } from '../context/AuthContext';
import { toast } from 'sonner';

const UNITS = ['unité', 'kg', 'tonne', 'm²', 'm'];


// ── Composant Spécifications Structurées ─────────────────────────────────────
const SpecsBuilder = ({ value, onChange, t }) => {
  const [rows, setRows] = React.useState(() => {
    try {
      const parsed = typeof value === 'string' ? JSON.parse(value || '{}') : (value || {});
      const entries = Object.entries(parsed);
      return entries.length > 0 ? entries.map(([k, v]) => ({ key: k, val: String(v) })) : [{ key: '', val: '' }];
    } catch {
      return [{ key: '', val: '' }];
    }
  });

  const sync = (updated) => {
    const obj = {};
    updated.forEach(({ key, val }) => { if (key.trim()) obj[key.trim()] = val; });
    onChange(JSON.stringify(obj));
    setRows(updated);
  };

  const update = (idx, field, v) => {
    const next = rows.map((r, i) => i === idx ? { ...r, [field]: v } : r);
    sync(next);
  };
  const add = () => sync([...rows, { key: '', val: '' }]);
  const remove = (idx) => sync(rows.filter((_, i) => i !== idx));

  // Suggestions de clés communes par industrie
  const SUGGESTIONS = [
    'Norme', 'Matière', 'Dimensions', 'Poids', 'Résistance', 'Longueur', 'Largeur',
    'Hauteur', 'Épaisseur', 'Diamètre', 'Pression max', 'Température max',
    'Débit', 'Puissance', 'Tension', 'Capacité', 'Traitement surface', 'Certification',
  ];

  return (
    <div className="space-y-2">
      {rows.map((row, idx) => (
        <div key={idx} className="flex gap-2 items-center">
          <input
            list={`specs-keys-${idx}`}
            value={row.key}
            onChange={(e) => update(idx, 'key', e.target.value)}
            placeholder="Ex: Norme, Dimensions…"
            className="flex-1 h-9 rounded-md border border-slate-200 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-accent/50"
          />
          <datalist id={`specs-keys-${idx}`}>
            {SUGGESTIONS.map((s) => <option key={s} value={s} />)}
          </datalist>
          <input
            value={row.val}
            onChange={(e) => update(idx, 'val', e.target.value)}
            placeholder="Valeur"
            className="flex-1 h-9 rounded-md border border-slate-200 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-accent/50"
          />
          <button
            type="button"
            onClick={() => remove(idx)}
            className="text-red-400 hover:text-red-600 px-2 text-lg leading-none"
          >×</button>
        </div>
      ))}
      <button
        type="button"
        onClick={add}
        className="text-sm text-accent hover:underline"
      >{t('sheet.specs.add')}</button>
      <p className="text-xs text-slate-400 mt-1">
        💡 Ces spécifications seront incluses dans la fiche produit PDF téléchargeable par vos clients.
      </p>
    </div>
  );
};

export default function NewProductPage() {
  const navigate = useNavigate();
  const { isSupplier } = useAuth();
  const { t } = useLocale();

  const [loading, setLoading] = useState(false);
  const [categories, setCategories] = useState([]);
  const [imageFiles, setImageFiles] = useState([]);
  const [imagePreviews, setImagePreviews] = useState([]);

  const [formData, setFormData] = useState({
    name: '', description: '', price: '', unit: 'unité',
    min_order_quantity: '1', stock_quantity: '0',
    category_id: '', specifications: '{}', is_available: true,
  });

  useEffect(() => {
    categoriesAPI.getAll()
      .then((r) => setCategories(r.data || []))
      .catch(() => toast.error(t('common.error')));
  }, []);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((p) => ({ ...p, [name]: value }));
  };

  const handleImageChange = (e) => {
    const files = Array.from(e.target.files);
    setImageFiles((p) => [...p, ...files]);
    setImagePreviews((p) => [...p, ...files.map((f) => URL.createObjectURL(f))]);
  };

  const removeImage = (i) => {
    URL.revokeObjectURL(imagePreviews[i]);
    setImageFiles((p) => p.filter((_, idx) => idx !== i));
    setImagePreviews((p) => p.filter((_, idx) => idx !== i));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name || !formData.price || !formData.category_id) {
      toast.error('Nom, prix et catégorie sont obligatoires');
      return;
    }

    setLoading(true);
    try {
      const form = new FormData();
      form.append('name', formData.name);
      form.append('description', formData.description || '');
      form.append('price', formData.price);
      form.append('unit', formData.unit);
      form.append('min_order_quantity', formData.min_order_quantity);
      form.append('stock_quantity', formData.stock_quantity);
      form.append('category_id', formData.category_id);
      form.append('specifications', formData.specifications || '{}');
      form.append('is_available', formData.is_available);
      imageFiles.forEach((f) => form.append('images', f));

      const res = await productsAPI.create(form);
      toast.success('Produit ajouté avec succès !');
      navigate(`/products/${res.data.id || res.data._id}`);
    } catch (err) {
      const detail = err.response?.data?.detail;
      let msg = t('common.error');
      if (Array.isArray(detail)) msg = detail.map((d) => d.msg || d.type).join(' • ');
      else if (typeof detail === 'string') msg = detail;
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Layout>
      <div className="max-w-4xl mx-auto px-4 py-8">
        <Button variant="ghost" onClick={() => navigate('/dashboard')} className="mb-6">
          <ArrowLeft className="mr-2 h-4 w-4" /> {t('common.back')}
        </Button>

        <Card>
          <CardHeader>
            <CardTitle className="text-3xl">Ajouter un nouveau produit</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-8">
              <div>
                <Label>Nom du produit *</Label>
                <Input name="name" value={formData.name} onChange={handleInputChange} required />
              </div>

              <div className="grid grid-cols-2 gap-6">
                <div>
                  <Label>Prix unitaire (XAF) *</Label>
                  <Input type="number" name="price" value={formData.price} onChange={handleInputChange} required />
                </div>
                <div>
                  <Label>Unité</Label>
                  <Select value={formData.unit} onValueChange={(v) => setFormData((p) => ({ ...p, unit: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {UNITS.map((u) => <SelectItem key={u} value={u}>{u}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-6">
                <div>
                  <Label>Quantité minimum</Label>
                  <Input type="number" name="min_order_quantity" value={formData.min_order_quantity} onChange={handleInputChange} />
                </div>
                <div>
                  <Label>Stock disponible</Label>
                  <Input type="number" name="stock_quantity" value={formData.stock_quantity} onChange={handleInputChange} />
                </div>
              </div>

              <div>
                <Label>Catégorie *</Label>
                <Select value={formData.category_id} onValueChange={(v) => setFormData((p) => ({ ...p, category_id: v }))} required>
                  <SelectTrigger><SelectValue placeholder="Choisir une catégorie" /></SelectTrigger>
                  <SelectContent>
                    {categories.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>{t('products.description')}</Label>
                <Textarea name="description" value={formData.description} onChange={handleInputChange} rows={5} />
              </div>

              {/* Spécifications techniques structurées */}
              <div>
                <Label>Spécifications techniques</Label>
                <p className="text-xs text-slate-500 mb-2">
                  Ajoutez les caractéristiques clés du produit (norme, dimensions, matière, résistance…).
                  Ces données apparaissent dans la fiche produit PDF générée automatiquement.
                </p>
                <SpecsBuilder
                  value={formData.specifications}
                  onChange={(v) => setFormData((p) => ({ ...p, specifications: v }))}
                  t={t}
                />
              </div>

              {/* Upload images */}
              <div>
                <Label>Images du produit</Label>
                <label className="mt-3 flex flex-col items-center justify-center w-full h-40 border-2 border-dashed border-slate-300 rounded-xl cursor-pointer hover:border-accent">
                  <Upload className="w-10 h-10 text-slate-400 mb-2" />
                  <span className="text-sm text-slate-600">Cliquez pour ajouter des images</span>
                  <input type="file" multiple accept="image/*" onChange={handleImageChange} className="hidden" />
                </label>
                {imagePreviews.length > 0 && (
                  <div className="grid grid-cols-4 gap-4 mt-6">
                    {imagePreviews.map((p, i) => (
                      <div key={i} className="relative">
                        <img src={getImageUrl(p)} alt="" className="w-full h-32 object-cover rounded-lg border" />
                        <button type="button" onClick={() => removeImage(i)}
                          className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1">
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <Button type="submit" className="w-full py-6 text-lg" disabled={loading}>
                {loading ? t('common.loading') : t('product.form.publish')}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}