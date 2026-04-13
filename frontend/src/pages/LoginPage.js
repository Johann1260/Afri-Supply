import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Eye, EyeSlash, Storefront } from '@phosphor-icons/react';
import { Layout } from '../components/layout';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { useAuth } from '../context/AuthContext';
import { useLocale } from '../context/LocaleContext';
import { toast } from 'sonner';

const LoginPage = () => {
  const navigate = useNavigate();
  const { login } = useAuth();
  const { t, locale } = useLocale();
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [formData, setFormData] = useState({ email: '', password: '' });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const user = await login(formData);
      toast.success(locale === 'fr' ? `Bienvenue ${user.full_name}!` : `Welcome ${user.full_name}!`);
      navigate('/dashboard');
    } catch (error) {
      const raw = error.response?.data?.detail;
      let message = locale === 'fr' ? 'Identifiants incorrects' : 'Invalid credentials';

      if (typeof raw === 'string') message = raw;
      else if (Array.isArray(raw)) message = raw[0]?.msg || message;
      else if (raw?.msg) message = raw.msg;

      toast.error(message);
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
          className="w-full max-w-md"
        >
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
              {t('auth.login.title')}
            </h1>
            <p className="text-slate-500 text-center mb-6">{t('auth.login.subtitle')}</p>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="email">{t('auth.login.email')}</Label>
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
                <Label htmlFor="password">{t('auth.login.password')}</Label>
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
                  <span className="text-slate-600">{t('auth.login.remember')}</span>
                </label>
                <Link to="/forgot-password" className="text-accent hover:underline">
                  {t('auth.login.forgot')}
                </Link>
              </div>

              <Button
                type="submit"
                className="w-full bg-accent hover:bg-accent-hover"
                disabled={loading}
                data-testid="login-submit"
              >
                {loading ? t('auth.login.loading') : t('auth.login.submit')}
              </Button>
            </form>

            <p className="text-center text-sm text-slate-500 mt-6">
              {t('auth.login.noAccount')}{' '}
              <Link to="/register" className="text-accent font-medium hover:underline">
                {t('auth.login.register')}
              </Link>
            </p>
          </div>
        </motion.div>
      </div>
    </Layout>
  );
};

export default LoginPage;