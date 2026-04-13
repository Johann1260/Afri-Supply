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

              <div>
                <Label>Spécifications techniques (JSON)</Label>
                <Textarea name="specifications" value={formData.specifications} onChange={handleInputChange} rows={3} />
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
                {loading ? t('common.loading') : 'Publier le produit'}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}