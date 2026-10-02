import React, { useState } from 'react';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Eye, EyeSlash, Storefront, CheckCircle, XCircle } from '@phosphor-icons/react';
import { Layout } from '../components/layout';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import api from '../lib/api';
import { useLocale } from '../context/LocaleContext';
import { toast } from 'sonner';

const ResetPasswordPage = () => {
  const { t } = useLocale();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState('form'); // form | success | error

  if (!token) {
    return (
      <Layout>
        <div className="min-h-[80vh] flex items-center justify-center py-12 px-4">
          <div className="w-full max-w-md text-center">
            <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <XCircle className="w-10 h-10 text-red-600" weight="fill" />
            </div>
            <h1 className="font-heading font-bold text-2xl mb-3">{t('auth.reset.error')}</h1>
            <Link to="/forgot-password">
              <Button className="w-full bg-accent hover:bg-accent-hover mt-4">
                {t('auth.forgot.submit')}
              </Button>
            </Link>
          </div>
        </div>
      </Layout>
    );
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (password.length < 8) { toast.error(t('auth.reset.short')); return; }
    if (password !== confirm) { toast.error(t('auth.reset.mismatch')); return; }

    setLoading(true);
    try {
      await api.post('/auth/reset-password', { token, password });
      setStatus('success');
    } catch (err) {
      const msg = err.response?.data?.detail || t('auth.reset.error');
      toast.error(typeof msg === 'string' ? msg : t('auth.reset.error'));
      setStatus('error');
    } finally {
      setLoading(false);
    }
  };

  if (status === 'success') {
    return (
      <Layout>
        <div className="min-h-[80vh] flex items-center justify-center py-12 px-4">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-md text-center">
            <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <CheckCircle className="w-10 h-10 text-green-600" weight="fill" />
            </div>
            <h1 className="font-heading font-bold text-2xl mb-3">{t('auth.reset.success')}</h1>
            <Button onClick={() => navigate('/login')} className="w-full bg-accent hover:bg-accent-hover mt-4">
              {t('auth.reset.goLogin')}
            </Button>
          </motion.div>
        </div>
      </Layout>
    );
  }

  const strength = [
    password.length >= 8,
    /[A-Z]/.test(password),
    /[0-9]/.test(password),
    /[^A-Za-z0-9]/.test(password),
  ];
  const strengthCount = strength.filter(Boolean).length;

  return (
    <Layout>
      <div className="min-h-[80vh] flex items-center justify-center py-12 px-4">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-md">
          <div className="text-center mb-8">
            <Link to="/" className="inline-flex items-center gap-2">
              {/* <div className="w-12 h-12 bg-primary rounded-lg flex items-center justify-center">
                <Storefront className="w-7 h-7 text-white" weight="bold" />
              </div> */}
              <span className="font-heading font-bold text-2xl text-primary">AfriSupply</span>
            </Link>
          </div>

          <div className="bg-white border border-slate-200 rounded-lg p-8 shadow-sm">
            <h1 className="font-heading font-bold text-2xl text-center mb-2">{t('auth.reset.title')}</h1>
            <p className="text-slate-500 text-center mb-6">{t('auth.reset.subtitle')}</p>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="password">{t('auth.reset.pwd')} *</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPwd ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    className="pr-10"
                  />
                  <button type="button" onClick={() => setShowPwd(!showPwd)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                    {showPwd ? <EyeSlash className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
                {password && (
                  <div className="mt-2 flex gap-1">
                    {strength.map((ok, i) => (
                      <div key={i} className={`h-1 flex-1 rounded ${ok ? 'bg-green-500' : 'bg-slate-200'}`} />
                    ))}
                  </div>
                )}
              </div>

              <div>
                <Label htmlFor="confirm">{t('auth.reset.confirm')} *</Label>
                <Input
                  id="confirm"
                  type="password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  placeholder="••••••••"
                  required
                />
                {confirm && password !== confirm && (
                  <p className="text-xs text-red-500 mt-1">{t('auth.reset.mismatch')}</p>
                )}
              </div>

              <Button
                type="submit"
                className="w-full bg-accent hover:bg-accent-hover"
                disabled={loading || (!!confirm && password !== confirm)}
              >
                {loading ? t('auth.reset.loading') : t('auth.reset.submit')}
              </Button>
            </form>

            <p className="text-center text-sm text-slate-500 mt-6">
              <Link to="/login" className="text-accent hover:underline">{t('auth.reset.goLogin')}</Link>
            </p>
          </div>
        </motion.div>
      </div>
    </Layout>
  );
};

export default ResetPasswordPage;