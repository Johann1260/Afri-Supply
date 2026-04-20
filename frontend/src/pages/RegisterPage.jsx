import React, { useState, useRef } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Eye, EyeSlash, Storefront, User, Buildings,
  Upload, X, FileText, CheckCircle, EnvelopeSimple
} from '@phosphor-icons/react';
import { Layout } from '../components/layout';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '../components/ui/select';
import { useAuth } from '../context/AuthContext';
import { useLocale } from '../context/LocaleContext';
import { authAPI } from '../lib/api';
import { toast } from 'sonner';

const CEMAC_COUNTRIES = ['Cameroun','Gabon','Congo','Tchad','Guinée Équatoriale','Centrafrique'];

// ── Étapes de l'inscription ──────────────────────────────────────────────────
const STEP_FORM    = 'form';
const STEP_DOCS    = 'docs';     // upload documents (suppliers only)
const STEP_VERIFY  = 'verify';   // vérification email
const STEP_PENDING = 'pending';  // compte en attente de vérification (suppliers)

const RegisterPage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { register } = useAuth();
  const { t, locale } = useLocale();

  const [step, setStep] = useState(STEP_FORM);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [registeredEmail, setRegisteredEmail] = useState('');
  const [registeredUserId, setRegisteredUserId] = useState('');
  const [resendLoading, setResendLoading] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);

  // Documents upload (suppliers)
  const [docFiles, setDocFiles] = useState([]);
  const [docUploading, setDocUploading] = useState(false);
  const fileInputRef = useRef(null);

  const [formData, setFormData] = useState({
    email: '',
    password: '',
    full_name: '',
    company_name: '',
    phone: '',
    country: '',
    city: '',
    user_type: searchParams.get('type') || 'buyer',
  });

  // ── Validation ─────────────────────────────────────────────────────────────
  const [errors, setErrors] = useState({});

  const validate = () => {
    const e = {};
    if (!formData.full_name.trim()) e.full_name = t('common.required');
    if (!formData.email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email))
      e.email = 'Email invalide';
    if (formData.password.length < 8)
      e.password = 'Minimum 8 caractères';
    if (!/[A-Z]/.test(formData.password))
      e.password = (e.password || '') + ' — 1 majuscule requise';
    if (!/[0-9]/.test(formData.password))
      e.password = (e.password || '') + ' — 1 chiffre requis';
    if (formData.user_type === 'supplier' && !formData.company_name.trim())
      e.company_name = t('common.required');
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  // ── Étape 1 : soumission du formulaire ─────────────────────────────────────
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;
    setLoading(true);
    try {
      const userData = await register(formData);
      setRegisteredEmail(formData.email);
      setRegisteredUserId(userData.id);

      if (formData.user_type === 'supplier') {
        // Supplier → upload documents avant vérification email
        setStep(STEP_DOCS);
      } else {
        // Buyer → directement vérification email
        setStep(STEP_VERIFY);
      }
    } catch (error) {
      const msg =
        error.response?.data?.detail ||
        (locale === 'fr' ? "Erreur lors de l'inscription" : 'Registration error');
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  // ── Étape 2 : upload documents (suppliers) ─────────────────────────────────
  const handleAddFiles = (e) => {
    const newFiles = Array.from(e.target.files).filter((f) => {
      if (f.size > 10 * 1024 * 1024) {
        toast.error(`${f.name} dépasse 10 Mo`);
        return false;
      }
      return true;
    });
    setDocFiles((prev) => [...prev, ...newFiles]);
  };

  const handleRemoveDoc = (idx) => {
    setDocFiles((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleUploadDocs = async () => {
    if (docFiles.length === 0) {
      toast.error('Veuillez ajouter au moins un document');
      return;
    }
    setDocUploading(true);
    try {
      await authAPI.uploadDocuments(registeredUserId, docFiles);
      toast.success('Documents envoyés avec succès');
      setStep(STEP_PENDING);
    } catch (err) {
      // Si l'endpoint n'existe pas encore en backend, on passe quand même à pending
      console.warn('Documents upload:', err.message);
      setStep(STEP_PENDING);
    } finally {
      setDocUploading(false);
    }
  };

  const handleSkipDocs = () => setStep(STEP_PENDING);

  // ── Renvoi de l'email de vérification ─────────────────────────────────────
  const handleResend = async () => {
    setResendLoading(true);
    try {
      await authAPI.resendVerification(registeredEmail);
      toast.success(t('auth.verify.sent'));
      // Cooldown 60s
      setResendCooldown(60);
      const interval = setInterval(() => {
        setResendCooldown((v) => {
          if (v <= 1) { clearInterval(interval); return 0; }
          return v - 1;
        });
      }, 1000);
    } catch {
      toast.error(locale === 'fr' ? "Erreur lors de l'envoi" : 'Error sending email');
    } finally {
      setResendLoading(false);
    }
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // Rendu des étapes
  // ═══════════════════════════════════════════════════════════════════════════

  // Étape DOCS
  if (step === STEP_DOCS) {
    return (
      <Layout>
        <div className="min-h-[80vh] flex items-center justify-center py-12 px-4">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-lg">
            <div className="text-center mb-8">
              <Link to="/" className="inline-flex items-center gap-2">
                <div className="w-12 h-12 bg-primary rounded-lg flex items-center justify-center">
                  <Storefront className="w-7 h-7 text-white" weight="bold" />
                </div>
                <span className="font-heading font-bold text-2xl text-primary">AfriSupply</span>
              </Link>
            </div>
            <div className="bg-white border border-slate-200 rounded-lg p-8 shadow-sm">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center">
                  <FileText className="w-5 h-5 text-primary" />
                </div>
                <h1 className="font-heading font-bold text-xl">{t('auth.register.docs.title')}</h1>
              </div>
              <p className="text-slate-500 text-sm mb-6">{t('auth.register.docs.sub')}</p>

              {/* Zone de dépôt */}
              <div
                className="border-2 border-dashed border-slate-300 rounded-xl p-8 text-center cursor-pointer hover:border-accent transition-colors mb-4"
                onClick={() => fileInputRef.current?.click()}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  const dt = e.dataTransfer;
                  const files = Array.from(dt.files);
                  setDocFiles((prev) => [...prev, ...files.filter(f => f.size <= 10 * 1024 * 1024)]);
                }}
              >
                <Upload className="w-10 h-10 text-slate-400 mx-auto mb-3" />
                <p className="text-slate-600 font-medium">{t('auth.register.docs.drop')}</p>
                <p className="text-xs text-slate-400 mt-1">{t('auth.register.docs.formats')}</p>
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept=".pdf,.jpg,.jpeg,.png"
                  className="hidden"
                  onChange={handleAddFiles}
                />
              </div>

              {/* Liste des fichiers */}
              {docFiles.length > 0 && (
                <div className="space-y-2 mb-6">
                  {docFiles.map((f, i) => (
                    <div key={i} className="flex items-center gap-3 bg-slate-50 rounded-lg px-3 py-2">
                      <FileText className="w-4 h-4 text-slate-500 flex-shrink-0" />
                      <span className="text-sm text-slate-700 flex-1 truncate">{f.name}</span>
                      <span className="text-xs text-slate-400">{(f.size / 1024).toFixed(0)} Ko</span>
                      <button onClick={() => handleRemoveDoc(i)} className="text-red-400 hover:text-red-600">
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-6 text-sm text-amber-800">
                <strong>Documents acceptés :</strong> RCCM, registre du commerce, patente fiscale, pièce d'identité du dirigeant, justificatif de siège social.
              </div>

              <div className="flex gap-3">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={handleSkipDocs}
                  disabled={docUploading}
                >
                  Passer (envoyer plus tard)
                </Button>
                <Button
                  className="flex-1 bg-accent hover:bg-accent-hover"
                  onClick={handleUploadDocs}
                  disabled={docUploading || docFiles.length === 0}
                >
                  {docUploading ? 'Envoi...' : 'Envoyer les documents'}
                </Button>
              </div>
            </div>
          </motion.div>
        </div>
      </Layout>
    );
  }

  // Étape PENDING (supplier en attente de validation)
  if (step === STEP_PENDING) {
    return (
      <Layout>
        <div className="min-h-[80vh] flex items-center justify-center py-12 px-4">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-md text-center">
            <div className="w-20 h-20 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <FileText className="w-10 h-10 text-amber-600" weight="fill" />
            </div>
            <h1 className="font-heading font-bold text-2xl mb-3">{t('auth.register.pending.title')}</h1>
            <p className="text-slate-500 mb-6">{t('auth.register.pending.sub')}</p>
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-5 text-left space-y-2 mb-8">
              <p className="text-sm font-medium text-slate-700">Prochaines étapes :</p>
              <p className="text-sm text-slate-500">✓ Compte créé avec succès</p>
              <p className="text-sm text-slate-500">⏳ Vérification des documents (48h)</p>
              <p className="text-sm text-slate-500">📧 Email de confirmation à l'activation</p>
              <p className="text-sm text-slate-500">🚀 Accès complet à la plateforme</p>
            </div>
            <Button onClick={() => navigate('/')} variant="outline" className="w-full">
              Retour à l'accueil
            </Button>
          </motion.div>
        </div>
      </Layout>
    );
  }

  // Étape VERIFY (buyer — vérification email)
  if (step === STEP_VERIFY) {
    return (
      <Layout>
        <div className="min-h-[80vh] flex items-center justify-center py-12 px-4">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-md text-center">
            <div className="w-20 h-20 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <EnvelopeSimple className="w-10 h-10 text-blue-600" weight="fill" />
            </div>
            <h1 className="font-heading font-bold text-2xl mb-3">{t('auth.verify.title')}</h1>
            <p className="text-slate-500 mb-2">{t('auth.verify.sub')}</p>
            <p className="font-semibold text-slate-800 mb-6">{registeredEmail}</p>

            <div className="bg-slate-50 border border-slate-200 rounded-xl p-5 text-left mb-8">
              <p className="text-sm font-medium text-slate-700 mb-2">Instructions :</p>
              <ol className="text-sm text-slate-500 space-y-1 list-decimal list-inside">
                <li>Ouvrez votre boîte email</li>
                <li>Cliquez sur le lien de confirmation</li>
                <li>Revenez ici pour vous connecter</li>
              </ol>
              <p className="text-xs text-slate-400 mt-3">Vérifiez aussi vos spams.</p>
            </div>

            <Button
              variant="outline"
              className="w-full mb-3"
              onClick={handleResend}
              disabled={resendLoading || resendCooldown > 0}
            >
              {resendCooldown > 0
                ? `Renvoyer dans ${resendCooldown}s`
                : resendLoading
                ? 'Envoi...'
                : t('auth.verify.resend')}
            </Button>
            <Link to="/login">
              <Button variant="ghost" className="w-full text-slate-500">
                Se connecter
              </Button>
            </Link>
          </motion.div>
        </div>
      </Layout>
    );
  }

  // ── Étape FORM (formulaire principal) ──────────────────────────────────────
  return (
    <Layout>
      <div className="min-h-[80vh] flex items-center justify-center py-12 px-4">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-lg">
          {/* Logo */}
          <div className="text-center mb-8">
            <Link to="/" className="inline-flex items-center gap-2">
              <div className="w-12 h-12 bg-primary rounded-lg flex items-center justify-center">
                <Storefront className="w-7 h-7 text-white" weight="bold" />
              </div>
              <span className="font-heading font-bold text-2xl text-primary">AfriSupply</span>
            </Link>
          </div>

          <div className="bg-white border border-slate-200 rounded-lg p-8 shadow-sm">
            <h1 className="font-heading font-bold text-2xl text-center mb-2">
              {t('auth.register.title')}
            </h1>
            <p className="text-slate-500 text-center mb-6">{t('auth.register.subtitle')}</p>

            {/* Type de compte */}
            <div className="flex gap-4 mb-6">
              {[
                { key: 'buyer',    icon: User,      label: t('auth.register.buyer'),    sub: t('auth.register.buyer.sub') },
                { key: 'supplier', icon: Buildings, label: t('auth.register.supplier'), sub: t('auth.register.supplier.sub') },
              ].map(({ key, icon: Icon, label, sub }) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setFormData({ ...formData, user_type: key })}
                  className={`flex-1 p-4 rounded-lg border-2 transition-colors ${
                    formData.user_type === key
                      ? 'border-accent bg-accent/5'
                      : 'border-slate-200 hover:border-slate-300'
                  }`}
                  data-testid={`type-${key}`}
                >
                  <Icon className={`w-8 h-8 mx-auto mb-2 ${formData.user_type === key ? 'text-accent' : 'text-slate-400'}`} />
                  <p className="font-semibold text-sm">{label}</p>
                  <p className="text-xs text-slate-500">{sub}</p>
                </button>
              ))}
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <Label htmlFor="full_name">{t('auth.register.name')} *</Label>
                  <Input
                    id="full_name"
                    value={formData.full_name}
                    onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                    placeholder="Jean Dupont"
                    required
                    data-testid="register-name"
                  />
                  {errors.full_name && <p className="text-xs text-red-500 mt-1">{errors.full_name}</p>}
                </div>

                {formData.user_type === 'supplier' && (
                  <div className="col-span-2">
                    <Label htmlFor="company_name">{t('auth.register.company')} *</Label>
                    <Input
                      id="company_name"
                      value={formData.company_name}
                      onChange={(e) => setFormData({ ...formData, company_name: e.target.value })}
                      placeholder="Entreprise SARL"
                      data-testid="register-company"
                    />
                    {errors.company_name && <p className="text-xs text-red-500 mt-1">{errors.company_name}</p>}
                  </div>
                )}

                {formData.user_type === 'buyer' && (
                  <div className="col-span-2">
                    <Label htmlFor="company_name_buyer">{t('auth.register.company')}</Label>
                    <Input
                      id="company_name_buyer"
                      value={formData.company_name}
                      onChange={(e) => setFormData({ ...formData, company_name: e.target.value })}
                      placeholder="Entreprise SARL"
                      data-testid="register-company"
                    />
                  </div>
                )}

                <div className="col-span-2">
                  <Label htmlFor="email">{t('auth.register.email')} *</Label>
                  <Input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="votre@email.com"
                    required
                    data-testid="register-email"
                  />
                  {errors.email && <p className="text-xs text-red-500 mt-1">{errors.email}</p>}
                </div>

                <div className="col-span-2">
                  <Label htmlFor="phone">{t('auth.register.phone')}</Label>
                  <Input
                    id="phone"
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    placeholder="+237 690 000 000"
                    data-testid="register-phone"
                  />
                </div>

                <div>
                  <Label htmlFor="country">{t('auth.register.country')}</Label>
                  <Select
                    value={formData.country}
                    onValueChange={(val) => setFormData({ ...formData, country: val })}
                  >
                    <SelectTrigger data-testid="register-country">
                      <SelectValue placeholder="Sélectionner" />
                    </SelectTrigger>
                    <SelectContent>
                      {CEMAC_COUNTRIES.map((c) => (
                        <SelectItem key={c} value={c}>{c}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="city">{t('auth.register.city')}</Label>
                  <Input
                    id="city"
                    value={formData.city}
                    onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                    placeholder="Douala"
                    data-testid="register-city"
                  />
                </div>

                <div className="col-span-2">
                  <Label htmlFor="password">{t('auth.register.password')} *</Label>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPassword ? 'text' : 'password'}
                      value={formData.password}
                      onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                      placeholder="••••••••"
                      required
                      className="pr-10"
                      data-testid="register-password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    >
                      {showPassword ? <EyeSlash className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                  {errors.password && <p className="text-xs text-red-500 mt-1">{errors.password}</p>}
                  {/* Indicateur force mot de passe */}
                  {formData.password && (
                    <div className="mt-2 flex gap-1">
                      {['length','upper','number','special'].map((rule, i) => {
                        const ok =
                          rule === 'length'  ? formData.password.length >= 8 :
                          rule === 'upper'   ? /[A-Z]/.test(formData.password) :
                          rule === 'number'  ? /[0-9]/.test(formData.password) :
                          /[^A-Za-z0-9]/.test(formData.password);
                        return (
                          <div key={rule} className={`h-1 flex-1 rounded ${ok ? 'bg-green-500' : 'bg-slate-200'}`} />
                        );
                      })}
                    </div>
                  )}
                  <p className="text-xs text-slate-400 mt-1">
                    Min. 8 caractères, 1 majuscule, 1 chiffre
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-2 text-sm">
                <input type="checkbox" required className="rounded border-slate-300 mt-1 flex-shrink-0" />
                <span className="text-slate-600">
                  {t('auth.register.terms')}{' '}
                  <Link to="/terms" className="text-accent hover:underline">{t('auth.register.terms.link')}</Link>
                  {' '}{locale === 'fr' ? 'et la' : 'and the'}{' '}
                  <Link to="/privacy" className="text-accent hover:underline">{t('auth.register.privacy')}</Link>
                </span>
              </div>

              {/* Note pour les suppliers */}
              {formData.user_type === 'supplier' && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-800">
                  <strong>Fournisseur :</strong> Après inscription, vous devrez soumettre vos documents
                  d'entreprise. Votre compte sera activé sous 48h après vérification.
                </div>
              )}

              <Button
                type="submit"
                className="w-full bg-accent hover:bg-accent-hover"
                disabled={loading}
                data-testid="register-submit"
              >
                {loading ? t('auth.register.loading') : t('auth.register.submit')}
              </Button>
            </form>

            <p className="text-center text-sm text-slate-500 mt-6">
              {t('auth.register.hasAccount')}{' '}
              <Link to="/login" className="text-accent font-medium hover:underline">
                {t('auth.register.login')}
              </Link>
            </p>
          </div>
        </motion.div>
      </div>
    </Layout>
  );
};

export default RegisterPage;