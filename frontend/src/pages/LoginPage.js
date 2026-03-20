import React, { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Eye, EyeSlash, Storefront, User, Buildings } from '@phosphor-icons/react';
import { Layout } from '../components/layout';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { useAuth } from '../context/AuthContext';
import { toast } from 'sonner';

const LoginPage = () => {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [formData, setFormData] = useState({
    email: '',
    password: '',
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const user = await login(formData.email, formData.password);
      toast.success(`Bienvenue ${user.full_name}!`);
      navigate('/dashboard');
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Identifiants incorrects');
    } finally {
      setLoading(false);
    }
  };

  // Demo credentials
  const fillDemo = (type) => {
    if (type === 'supplier') {
      setFormData({ email: 'supplier@afrisupply.com', password: 'supplier123' });
    } else {
      setFormData({ email: 'buyer@afrisupply.com', password: 'buyer123' });
    }
  };

  return (
    <Layout>
      <div className="min-h-[80vh] flex items-center justify-center py-12 px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-md"
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
              Connexion
            </h1>
            <p className="text-slate-500 text-center mb-6">
              Accédez à votre compte AfriSupply
            </p>

            {/* Demo accounts */}
            <div className="mb-6 p-4 bg-slate-50 rounded-lg">
              <p className="text-sm text-slate-600 mb-3">Comptes de démonstration:</p>
              <div className="flex gap-2">
                <Button 
                  type="button"
                  variant="outline" 
                  size="sm" 
                  onClick={() => fillDemo('buyer')}
                  className="flex-1"
                  data-testid="demo-buyer"
                >
                  <User className="w-4 h-4 mr-1" />
                  Acheteur
                </Button>
                <Button 
                  type="button"
                  variant="outline" 
                  size="sm" 
                  onClick={() => fillDemo('supplier')}
                  className="flex-1"
                  data-testid="demo-supplier"
                >
                  <Buildings className="w-4 h-4 mr-1" />
                  Fournisseur
                </Button>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="votre@email.com"
                  required
                  data-testid="login-email"
                />
              </div>

              <div>
                <Label htmlFor="password">Mot de passe</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    placeholder="••••••••"
                    required
                    className="pr-10"
                    data-testid="login-password"
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

              <div className="flex items-center justify-between text-sm">
                <label className="flex items-center gap-2">
                  <input type="checkbox" className="rounded border-slate-300" />
                  <span className="text-slate-600">Se souvenir de moi</span>
                </label>
                <Link to="/forgot-password" className="text-accent hover:underline">
                  Mot de passe oublié?
                </Link>
              </div>

              <Button 
                type="submit" 
                className="w-full bg-accent hover:bg-accent-hover"
                disabled={loading}
                data-testid="login-submit"
              >
                {loading ? 'Connexion...' : 'Se connecter'}
              </Button>
            </form>

            <p className="text-center text-sm text-slate-500 mt-6">
              Pas encore de compte?{' '}
              <Link to="/register" className="text-accent font-medium hover:underline">
                S'inscrire
              </Link>
            </p>
          </div>
        </motion.div>
      </div>
    </Layout>
  );
};

export default LoginPage;
