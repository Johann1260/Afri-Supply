import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  CheckCircle, Buildings, Package, Camera, ArrowRight, ArrowLeft,
  Upload, X, FileText, Star, Rocket
} from '@phosphor-icons/react';
import { Layout } from '../components/layout';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import { useAuth } from '../context/AuthContext';
import { useLocale } from '../context/LocaleContext';
import { authAPI, categoriesAPI, productsAPI } from '../lib/api';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';

const STEPS = [
  { id: 1, label: 'Profil',     icon: Buildings, desc: 'Informations entreprise' },
  { id: 2, label: 'Documents',  icon: FileText,  desc: 'Vérification légale'     },
  { id: 3, label: '1er produit',icon: Package,   desc: 'Publiez votre catalogue' },
  { id: 4, label: 'Terminé',    icon: Rocket,    desc: 'Vous êtes prêt !'        },
];

// ── Step 1 — Profil ────────────────────────────────────────────────────────────
const StepProfile = ({ data, onChange }) => (
  <div className="space-y-5">
    <div>
      <Label htmlFor="company_name">Nom de l'entreprise *</Label>
      <Input
        id="company_name"
        value={data.company_name}
        onChange={(e) => onChange('company_name', e.target.value)}
        placeholder="ACIER PLUS SARL"
      />
    </div>
    <div className="grid grid-cols-2 gap-4">
      <div>
        <Label htmlFor="phone">Téléphone</Label>
        <Input
          id="phone"
          value={data.phone}
          onChange={(e) => onChange('phone', e.target.value)}
          placeholder="+237 690 000 000"
        />
      </div>
      <div>
        <Label htmlFor="city">Ville</Label>
        <Input
          id="city"
          value={data.city}
          onChange={(e) => onChange('city', e.target.value)}
          placeholder="Douala"
        />
      </div>
    </div>
    <div>
      <Label htmlFor="bio">Présentation de votre activité</Label>
      <Textarea
        id="bio"
        value={data.bio}
        onChange={(e) => onChange('bio', e.target.value)}
        placeholder="Décrivez vos produits, votre expérience, vos certifications..."
        rows={4}
      />
    </div>
    <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm text-blue-800">
      <strong>Conseil :</strong> Une présentation complète augmente vos chances d'être
      contacté par les acheteurs de 3x.
    </div>
  </div>
);

// ── Step 2 — Documents ─────────────────────────────────────────────────────────
const StepDocuments = ({ files, onAddFiles, onRemove, userId, onSkip }) => {
  const fileInputRef = React.useRef(null);

  const handleFiles = (e) => {
    const newFiles = Array.from(e.target.files).filter((f) => {
      if (f.size > 10 * 1024 * 1024) { toast.error(`${f.name} dépasse 10 Mo`); return false; }
      return true;
    });
    onAddFiles(newFiles);
  };

  return (
    <div className="space-y-5">
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800">
        <strong>Documents requis :</strong> RCCM, patente fiscale, ou pièce d'identité du dirigeant.
        Votre compte sera activé sous 48h après vérification.
      </div>

      <div
        className="border-2 border-dashed border-slate-300 hover:border-accent rounded-xl p-10 text-center cursor-pointer transition-colors"
        onClick={() => fileInputRef.current?.click()}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          onAddFiles(Array.from(e.dataTransfer.files).filter((f) => f.size <= 10 * 1024 * 1024));
        }}
      >
        <Upload className="w-10 h-10 text-slate-400 mx-auto mb-3" />
        <p className="font-medium text-slate-600">Glissez vos documents ici</p>
        <p className="text-sm text-slate-400 mt-1">PDF, JPG, PNG — max 10 Mo</p>
        <input ref={fileInputRef} type="file" multiple accept=".pdf,.jpg,.jpeg,.png" className="hidden" onChange={handleFiles} />
      </div>

      {files.length > 0 && (
        <div className="space-y-2">
          {files.map((f, i) => (
            <div key={i} className="flex items-center gap-3 bg-slate-50 rounded-lg px-4 py-2.5">
              <FileText className="w-4 h-4 text-red-500 flex-shrink-0" />
              <span className="text-sm text-slate-700 flex-1 truncate">{f.name}</span>
              <span className="text-xs text-slate-400">{(f.size / 1024).toFixed(0)} Ko</span>
              <button onClick={() => onRemove(i)} className="text-slate-400 hover:text-red-500 transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}

      <button onClick={onSkip} className="text-sm text-slate-400 hover:text-slate-600 underline underline-offset-2 transition-colors">
        Je soumettrai les documents plus tard
      </button>
    </div>
  );
};

// ── Step 3 — Premier produit ───────────────────────────────────────────────────
const StepFirstProduct = ({ data, onChange, categories }) => (
  <div className="space-y-5">
    <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-sm text-green-800">
      <strong>Commencez par votre meilleur produit</strong> — celui que vous vendez le plus,
      ou votre spécialité. Vous pourrez en ajouter d'autres depuis votre tableau de bord.
    </div>
    <div>
      <Label>Nom du produit *</Label>
      <Input value={data.name} onChange={(e) => onChange('name', e.target.value)} placeholder="Ex: Poutrelles IPE 200, Ciment CEM I 42.5..." />
    </div>
    <div className="grid grid-cols-2 gap-4">
      <div>
        <Label>Prix unitaire (XAF) *</Label>
        <Input type="number" value={data.price} onChange={(e) => onChange('price', e.target.value)} placeholder="125000" />
      </div>
      <div>
        <Label>Unité</Label>
        <select
          value={data.unit}
          onChange={(e) => onChange('unit', e.target.value)}
          className="w-full h-10 border border-slate-200 rounded-lg px-3 text-sm focus:outline-none focus:border-primary"
        >
          {['unité','kg','tonne','m²','m','sac','pièce'].map((u) => <option key={u}>{u}</option>)}
        </select>
      </div>
    </div>
    <div>
      <Label>Catégorie *</Label>
      <select
        value={data.category_id}
        onChange={(e) => onChange('category_id', e.target.value)}
        className="w-full h-10 border border-slate-200 rounded-lg px-3 text-sm focus:outline-none focus:border-primary"
      >
        <option value="">Sélectionner une catégorie</option>
        {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
      </select>
    </div>
    <div>
      <Label>Description</Label>
      <Textarea
        value={data.description}
        onChange={(e) => onChange('description', e.target.value)}
        placeholder="Décrivez les caractéristiques, normes, dimensions..."
        rows={3}
      />
    </div>
  </div>
);

// ── Step 4 — Succès ────────────────────────────────────────────────────────────
const StepSuccess = ({ onDashboard }) => (
  <div className="text-center py-8">
    <motion.div
      initial={{ scale: 0 }}
      animate={{ scale: 1 }}
      transition={{ type: 'spring', stiffness: 200, damping: 15 }}
      className="w-24 h-24 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6"
    >
      <CheckCircle className="w-12 h-12 text-green-600" weight="fill" />
    </motion.div>
    <h2 className="font-heading font-bold text-2xl text-slate-900 mb-3">
      Votre espace fournisseur est prêt !
    </h2>
    <p className="text-slate-500 max-w-sm mx-auto mb-8">
      Vos documents sont en cours de vérification (48h). En attendant, vous pouvez
      continuer à compléter votre catalogue.
    </p>
    <div className="grid grid-cols-3 gap-4 max-w-sm mx-auto mb-8">
      {[
        { icon: FileText, label: 'Documents soumis', ok: true },
        { icon: Package,  label: 'Produit publié',   ok: true },
        { icon: Star,     label: 'Badge vérifié',    ok: false, sub: 'sous 48h' },
      ].map(({ icon: Icon, label, ok, sub }) => (
        <div key={label} className="text-center">
          <div className={`w-10 h-10 rounded-full flex items-center justify-center mx-auto mb-2 ${ok ? 'bg-green-100' : 'bg-slate-100'}`}>
            <Icon className={`w-5 h-5 ${ok ? 'text-green-600' : 'text-slate-400'}`} />
          </div>
          <p className="text-xs font-medium text-slate-700">{label}</p>
          {sub && <p className="text-xs text-slate-400">{sub}</p>}
        </div>
      ))}
    </div>
    <Button onClick={onDashboard} className="bg-accent hover:bg-accent-hover px-8">
      <Rocket className="w-4 h-4 mr-2" />
      Accéder à mon tableau de bord
    </Button>
  </div>
);

// ── Page principale ────────────────────────────────────────────────────────────
export default function SupplierOnboardingPage() {
  const { user } = useAuth();
  const { t }    = useLocale();
  const navigate  = useNavigate();

  const [step, setStep]       = useState(1);
  const [loading, setLoading] = useState(false);
  const [categories, setCategories] = useState([]);

  const [profileData, setProfileData] = useState({
    company_name: user?.company_name || '',
    phone: user?.phone || '',
    city: user?.city || '',
    bio: '',
  });
  const [docFiles, setDocFiles] = useState([]);
  const [productData, setProductData] = useState({
    name: '', price: '', unit: 'unité', category_id: '', description: '',
  });

  React.useEffect(() => {
    categoriesAPI.getAll().then((r) => setCategories(r.data || [])).catch(() => {});
  }, []);

  const updateProfile = (k, v) => setProfileData((p) => ({ ...p, [k]: v }));
  const updateProduct = (k, v) => setProductData((p) => ({ ...p, [k]: v }));

  // Step 1 → 2
  const handleProfileNext = async () => {
    if (!profileData.company_name) { toast.error('Le nom de l\'entreprise est requis'); return; }
    setLoading(true);
    try {
      await authAPI.updateMe({ company_name: profileData.company_name, phone: profileData.phone, city: profileData.city });
    } catch { /* non-bloquant */ }
    setLoading(false);
    setStep(2);
  };

  // Step 2 → 3
  const handleDocsNext = async () => {
    if (docFiles.length > 0 && user?.id) {
      setLoading(true);
      try {
        await authAPI.uploadDocuments(user.id, docFiles);
        toast.success('Documents soumis !');
      } catch { toast.error('Erreur upload documents (vous pouvez réessayer plus tard)'); }
      setLoading(false);
    }
    setStep(3);
  };

  // Step 3 → 4
  const handleProductNext = async () => {
    if (!productData.name || !productData.price || !productData.category_id) {
      toast.error('Nom, prix et catégorie sont requis'); return;
    }
    setLoading(true);
    try {
      const form = new FormData();
      form.append('name', productData.name);
      form.append('description', productData.description || '');
      form.append('price', productData.price);
      form.append('unit', productData.unit);
      form.append('category_id', productData.category_id);
      form.append('min_order_quantity', '1');
      form.append('stock_quantity', '0');
      form.append('specifications', '{}');
      form.append('is_available', 'true');
      await productsAPI.create(form);
      toast.success('Produit publié avec succès !');
    } catch { toast.error('Erreur lors de la publication du produit'); }
    setLoading(false);
    setStep(4);
  };

  const canSkipProduct = () => setStep(4);

  return (
    <Layout>
      <div className="max-w-2xl mx-auto px-4 py-12">
        {/* Progress stepper */}
        <div className="mb-10">
          <div className="flex items-center justify-between relative">
            <div className="absolute left-0 right-0 top-5 h-0.5 bg-slate-200 -z-0">
              <div
                className="h-full bg-accent transition-all duration-500"
                style={{ width: `${((step - 1) / (STEPS.length - 1)) * 100}%` }}
              />
            </div>
            {STEPS.map(({ id, label, icon: Icon }) => (
              <div key={id} className="flex flex-col items-center relative z-10">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center border-2 transition-all duration-300 ${
                  id < step  ? 'border-accent bg-accent text-white' :
                  id === step ? 'border-accent bg-white text-accent' :
                  'border-slate-200 bg-white text-slate-400'
                }`}>
                  {id < step ? <CheckCircle className="w-5 h-5" weight="fill" /> : <Icon className="w-5 h-5" />}
                </div>
                <p className={`text-xs font-medium mt-2 ${id <= step ? 'text-slate-900' : 'text-slate-400'}`}>
                  {label}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Card */}
        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
          <div className="px-8 py-6 border-b border-slate-100 bg-slate-50/50">
            <h2 className="font-heading font-bold text-xl text-slate-900">
              {STEPS[step - 1]?.label}
            </h2>
            <p className="text-slate-500 text-sm mt-0.5">{STEPS[step - 1]?.desc}</p>
          </div>

          <div className="px-8 py-6">
            <AnimatePresence mode="wait">
              <motion.div
                key={step}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.2 }}
              >
                {step === 1 && <StepProfile data={profileData} onChange={updateProfile} />}
                {step === 2 && (
                  <StepDocuments
                    files={docFiles}
                    onAddFiles={(f) => setDocFiles((p) => [...p, ...f])}
                    onRemove={(i) => setDocFiles((p) => p.filter((_, idx) => idx !== i))}
                    userId={user?.id}
                    onSkip={() => setStep(3)}
                  />
                )}
                {step === 3 && <StepFirstProduct data={productData} onChange={updateProduct} categories={categories} />}
                {step === 4 && <StepSuccess onDashboard={() => navigate('/dashboard/supplier')} />}
              </motion.div>
            </AnimatePresence>
          </div>

          {step < 4 && (
            <div className="px-8 py-5 border-t border-slate-100 flex items-center justify-between">
              {step > 1 ? (
                <button
                  onClick={() => setStep((s) => s - 1)}
                  disabled={loading}
                  className="flex items-center gap-2 text-slate-500 hover:text-slate-700 text-sm font-medium transition-colors"
                >
                  <ArrowLeft className="w-4 h-4" />
                  Retour
                </button>
              ) : <div />}

              <div className="flex gap-3">
                {step === 3 && (
                  <button
                    onClick={canSkipProduct}
                    disabled={loading}
                    className="text-sm text-slate-400 hover:text-slate-600 transition-colors"
                  >
                    Passer cette étape
                  </button>
                )}
                <Button
                  onClick={step === 1 ? handleProfileNext : step === 2 ? handleDocsNext : handleProductNext}
                  disabled={loading}
                  className="bg-accent hover:bg-accent-hover"
                >
                  {loading ? 'Traitement...' : step === 3 ? 'Publier et terminer' : 'Continuer'}
                  {!loading && <ArrowRight className="w-4 h-4 ml-2" />}
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}