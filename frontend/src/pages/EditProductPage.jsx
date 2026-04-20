import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Upload, X } from '@phosphor-icons/react';
import { Layout } from '../components/layout/Layout';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { productsAPI, categoriesAPI } from '../lib/api';
import { toast } from 'sonner';
import { getImageUrl } from '../lib/utils';
import { useLocale } from '../context/LocaleContext';
import { useAuth } from '../context/AuthContext';


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
  const update = (idx, field, v) => sync(rows.map((r, i) => i === idx ? { ...r, [field]: v } : r));
  const add = () => sync([...rows, { key: '', val: '' }]);
  const remove = (idx) => sync(rows.filter((_, i) => i !== idx));
  const SUGGESTIONS = ['Norme','Matière','Dimensions','Poids','Résistance','Longueur','Largeur','Hauteur','Épaisseur','Diamètre','Pression max','Température max','Débit','Puissance','Tension','Capacité','Traitement surface','Certification'];
  return (
    <div className="space-y-2">
      {rows.map((row, idx) => (
        <div key={idx} className="flex gap-2 items-center">
          <input list={`sk-${idx}`} value={row.key} onChange={(e) => update(idx, 'key', e.target.value)}
            placeholder="Ex: Norme, Dimensions…"
            className="flex-1 h-9 rounded-md border border-slate-200 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-accent/50" />
          <datalist id={`sk-${idx}`}>{SUGGESTIONS.map((s) => <option key={s} value={s} />)}</datalist>
          <input value={row.val} onChange={(e) => update(idx, 'val', e.target.value)} placeholder="Valeur"
            className="flex-1 h-9 rounded-md border border-slate-200 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-accent/50" />
          <button type="button" onClick={() => remove(idx)} className="text-red-400 hover:text-red-600 px-2 text-lg">×</button>
        </div>
      ))}
      <button type="button" onClick={add} className="text-sm text-accent hover:underline">{t('sheet.specs.add')}</button>
      <p className="text-xs text-slate-400 mt-1">💡 Incluses dans la fiche produit PDF de vos clients.</p>
    </div>
  );
};

export default function EditProductPage() {
  const { t } = useLocale();
  const { id } = useParams();
  const navigate = useNavigate();
  const { isSupplier } = useAuth();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [categories, setCategories] = useState([]);
  const [imageFiles, setImageFiles] = useState([]);
  const [imagePreviews, setImagePreviews] = useState([]);
  const [existingImages, setExistingImages] = useState([]);

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    price: '',
    unit: 'unité',
    min_order_quantity: '1',
    stock_quantity: '0',
    category_id: '',
    specifications: '{}',
    is_available: true,
  });

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [productRes, catRes] = await Promise.all([
          productsAPI.getById(id),
          categoriesAPI.getAll(),
        ]);

        const p = productRes.data;

        setFormData({
          name: p.name || '',
          description: p.description || '',
          price: p.price?.toString() || '',
          unit: p.unit || 'unité',
          min_order_quantity: p.min_order_quantity?.toString() || '1',
          stock_quantity: p.stock_quantity?.toString() || '0',
          category_id: p.category_id || '',
          specifications: JSON.stringify(p.specifications || {}),
          is_available: p.is_available !== false,
        });

        setExistingImages(p.images || []);
        setCategories(catRes.data || []);
      } catch (err) {
        toast.error('Produit non trouvé');
        navigate('/dashboard');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [id, navigate]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleNewImageChange = (e) => {
    const files = Array.from(e.target.files);
    setImageFiles((prev) => [...prev, ...files]);
    const previews = files.map((f) => URL.createObjectURL(f));
    setImagePreviews((prev) => [...prev, ...previews]);
  };

  const removeNewImage = (index) => {
    URL.revokeObjectURL(imagePreviews[index]);
    setImageFiles((prev) => prev.filter((_, i) => i !== index));
    setImagePreviews((prev) => prev.filter((_, i) => i !== index));
  };

  const removeExistingImage = (index) => {
    setExistingImages((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name || !formData.price || !formData.category_id) {
      toast.error('Nom, prix et catégorie sont obligatoires');
      return;
    }

    setSaving(true);

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
      form.append('existing_images', JSON.stringify(existingImages || []));
      imageFiles.forEach((file) => form.append('images', file));

      await productsAPI.update(id, form);

      toast.success('Produit mis à jour avec succès !');
      navigate(`/products/${id}`);
    } catch (err) {
      console.error('Erreur mise à jour produit:', err.response?.data);

      let errorMessage = "Erreur lors de la mise à jour du produit";

      if (err.response?.data?.detail) {
        const detail = err.response.data.detail;
        if (Array.isArray(detail)) {
          errorMessage = detail.map((d) => d.msg || d.type).join(' • ');
        } else if (typeof detail === 'string') {
          errorMessage = detail;
        } else if (typeof detail === 'object') {
          errorMessage = detail.msg || JSON.stringify(detail);
        }
      } else if (err.message) {
        errorMessage = err.message;
      }

      toast.error(errorMessage);
    } finally {
      // P3-19 FIX: était setLoading(false) — doit être setSaving(false)
      setSaving(false);
    }
  };

  if (loading) return <Layout><div className="p-12 text-center">Chargement...</div></Layout>;

  return (
    <Layout>
      <div className="max-w-4xl mx-auto px-4 py-8">
        <Button variant="ghost" onClick={() => navigate('/dashboard')} className="mb-6">
          <ArrowLeft className="mr-2 h-4 w-4" /> Retour au tableau de bord
        </Button>

        <Card>
          <CardHeader>
            <CardTitle className="text-3xl">Modifier le produit</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-8">

              <div>
                <Label>Nom du produit *</Label>
                <Input name="name" value={formData.name} onChange={handleChange} required />
              </div>

              <div className="grid grid-cols-2 gap-6">
                <div>
                  <Label>Prix (XAF) *</Label>
                  <Input type="number" name="price" value={formData.price} onChange={handleChange} required />
                </div>
                <div>
                  <Label>Unité</Label>
                  <Select value={formData.unit} onValueChange={(v) => setFormData((p) => ({ ...p, unit: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="unité">Unité</SelectItem>
                      <SelectItem value="kg">kg</SelectItem>
                      <SelectItem value="tonne">Tonne</SelectItem>
                      <SelectItem value="m²">m²</SelectItem>
                      <SelectItem value="m">Mètre</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-6">
                <div>
                  <Label>Qté minimum</Label>
                  <Input type="number" name="min_order_quantity" value={formData.min_order_quantity} onChange={handleChange} />
                </div>
                <div>
                  <Label>Stock</Label>
                  <Input type="number" name="stock_quantity" value={formData.stock_quantity} onChange={handleChange} />
                </div>
              </div>

              <div>
                <Label>Catégorie *</Label>
                <Select value={formData.category_id} onValueChange={(v) => setFormData((p) => ({ ...p, category_id: v }))} required>
                  <SelectTrigger><SelectValue placeholder="Sélectionner" /></SelectTrigger>
                  <SelectContent>
                    {categories.map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Description</Label>
                <Textarea name="description" value={formData.description} onChange={handleChange} rows={5} />
              </div>

              <div>
                <Label>Spécifications techniques</Label>
                <p className="text-xs text-slate-500 mb-2">
                  Données clés du produit (norme, dimensions, matière…) — incluses dans la fiche PDF client.
                </p>
                <SpecsBuilder
                  value={formData.specifications}
                  onChange={(v) => setFormData((p) => ({ ...p, specifications: v }))}
                  t={t}
                />
              </div>

              {/* Images existantes */}
              {existingImages.length > 0 && (
                <div>
                  <Label>Images actuelles</Label>
                  <div className="grid grid-cols-4 gap-4 mt-3">
                    {existingImages.map((url, i) => (
                      <div key={i} className="relative">
                        <img src={getImageUrl(url)} alt="" className="w-full h-32 object-cover rounded border" />
                        <button
                          type="button"
                          onClick={() => removeExistingImage(i)}
                          className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-1"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Nouvelles images */}
              <div>
                <Label>Ajouter de nouvelles images</Label>
                <label className="mt-3 block w-full h-40 border-2 border-dashed border-slate-300 rounded-xl cursor-pointer hover:border-accent text-center pt-12">
                  <Upload className="mx-auto w-10 h-10 text-slate-400" />
                  <input type="file" multiple accept="image/*" onChange={handleNewImageChange} className="hidden" />
                </label>

                {imagePreviews.length > 0 && (
                  <div className="grid grid-cols-4 gap-4 mt-6">
                    {imagePreviews.map((p, i) => (
                      <div key={i} className="relative">
                        <img src={p} alt="" className="w-full h-32 object-cover rounded border" />
                        <button
                          type="button"
                          onClick={() => removeNewImage(i)}
                          className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-1"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <Button type="submit" className="w-full py-6 text-lg" disabled={saving}>
                {saving ? t('common.loading').replace('..','') : t('profile.save')}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}