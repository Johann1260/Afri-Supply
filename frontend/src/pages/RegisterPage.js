import React, { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Eye, EyeSlash, Storefront, User, Buildings } from '@phosphor-icons/react';
import { Layout } from '../components/layout';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '../components/ui/select';
import { useAuth } from '../context/AuthContext';
import { toast } from 'sonner';

const RegisterPage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { register } = useAuth();
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
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

  const countries = [
    'Cameroun',
    'Gabon',
    'Congo',
    'Tchad',
    'Guinée Équatoriale',
    'Centrafrique',
  ];

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const user = await register(formData);
      toast.success('Compte créé avec succès!');
      navigate('/dashboard');
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Erreur lors de l\'inscription');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Layout>
      <div className="min-h-[80vh] flex items-center justify-center py-12 px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-lg"
        >
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
              Créer un compte
            </h1>
            <p className="text-slate-500 text-center mb-6">
              Rejoignez la marketplace B2B industrielle
            </p>

            {/* Account type selector */}
            <div className="flex gap-4 mb-6">
              <button
                type="button"
                onClick={() => setFormData({ ...formData, user_type: 'buyer' })}
                className={`flex-1 p-4 rounded-lg border-2 transition-colors ${
                  formData.user_type === 'buyer'
                    ? 'border-accent bg-accent/5'
                    : 'border-slate-200 hover:border-slate-300'
                }`}
                data-testid="type-buyer"
              >
                <User className={`w-8 h-8 mx-auto mb-2 ${formData.user_type === 'buyer' ? 'text-accent' : 'text-slate-400'}`} />
                <p className="font-semibold">Acheteur</p>
                <p className="text-xs text-slate-500">Acheter des produits</p>
              </button>
              <button
                type="button"
                onClick={() => setFormData({ ...formData, user_type: 'supplier' })}
                className={`flex-1 p-4 rounded-lg border-2 transition-colors ${
                  formData.user_type === 'supplier'
                    ? 'border-accent bg-accent/5'
                    : 'border-slate-200 hover:border-slate-300'
                }`}
                data-testid="type-supplier"
              >
                <Buildings className={`w-8 h-8 mx-auto mb-2 ${formData.user_type === 'supplier' ? 'text-accent' : 'text-slate-400'}`} />
                <p className="font-semibold">Fournisseur</p>
                <p className="text-xs text-slate-500">Vendre des produits</p>
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <Label htmlFor="full_name">Nom complet *</Label>
                  <Input
                    id="full_name"
                    value={formData.full_name}
                    onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                    placeholder="Jean Dupont"
                    required
                    data-testid="register-name"
                  />
                </div>

                <div className="col-span-2">
                  <Label htmlFor="company_name">Nom de l'entreprise</Label>
                  <Input
                    id="company_name"
                    value={formData.company_name}
                    onChange={(e) => setFormData({ ...formData, company_name: e.target.value })}
                    placeholder="Entreprise SARL"
                    data-testid="register-company"
                  />
                </div>

                <div className="col-span-2">
                  <Label htmlFor="email">Email *</Label>
                  <Input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="votre@email.com"
                    required
                    data-testid="register-email"
                  />
                </div>

                <div className="col-span-2">
                  <Label htmlFor="phone">Téléphone</Label>
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
                  <Label htmlFor="country">Pays</Label>
                  <Select 
                    value={formData.country} 
                    onValueChange={(val) => setFormData({ ...formData, country: val })}
                  >
                    <SelectTrigger data-testid="register-country">
                      <SelectValue placeholder="Sélectionner" />
                    </SelectTrigger>
                    <SelectContent>
                      {countries.map((c) => (
                        <SelectItem key={c} value={c}>{c}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="city">Ville</Label>
                  <Input
                    id="city"
                    value={formData.city}
                    onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                    placeholder="Douala"
                    data-testid="register-city"
                  />
                </div>

                <div className="col-span-2">
                  <Label htmlFor="password">Mot de passe *</Label>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPassword ? 'text' : 'password'}
                      value={formData.password}
                      onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                      placeholder="••••••••"
                      required
                      minLength={6}
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
                </div>
              </div>

              <div className="flex items-start gap-2 text-sm">
                <input type="checkbox" required className="rounded border-slate-300 mt-1" />
                <span className="text-slate-600">
                  J'accepte les{' '}
                  <Link to="/terms" className="text-accent hover:underline">conditions générales</Link>
                  {' '}et la{' '}
                  <Link to="/privacy" className="text-accent hover:underline">politique de confidentialité</Link>
                </span>
              </div>

              <Button 
                type="submit" 
                className="w-full bg-accent hover:bg-accent-hover"
                disabled={loading}
                data-testid="register-submit"
              >
                {loading ? 'Création...' : 'Créer mon compte'}
              </Button>
            </form>

            <p className="text-center text-sm text-slate-500 mt-6">
              Déjà un compte?{' '}
              <Link to="/login" className="text-accent font-medium hover:underline">
                Se connecter
              </Link>
            </p>
          </div>
        </motion.div>
      </div>
    </Layout>
  );
};

export default RegisterPage;
