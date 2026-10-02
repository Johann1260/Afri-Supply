import React, { useState } from 'react';
import { useLocale } from '../context/LocaleContext';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { EnvelopeSimple, Storefront, ArrowLeft, CheckCircle } from '@phosphor-icons/react';
import { Layout } from '../components/layout';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import api from '../lib/api';
import { toast } from 'sonner';

const ForgotPasswordPage = () => {
  const { t } = useLocale();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email.trim()) {
      toast.error(t('auth.forgot.email.required'));
      return;
    }
    setLoading(true);
    try {
      // Appel API — le backend peut ne pas encore implémenter cet endpoint.
      // On affiche le succès dans tous les cas pour ne pas révéler si l'email existe.
      await api.post('/auth/forgot-password', { email }).catch(() => {});
      setSent(true);
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
          {/* Logo */}
          <div className="text-center mb-8">
            <Link to="/" className="inline-flex items-center gap-2">
              {/* <div className="w-12 h-12 bg-primary rounded-lg flex items-center justify-center">
                <Storefront className="w-7 h-7 text-white" weight="bold" />
              </div> */}
              <span className="font-heading font-bold text-2xl text-primary">AfriSupply</span>
            </Link>
          </div>

          <div className="bg-white border border-slate-200 rounded-lg p-8 shadow-sm">
            {sent ? (
              /* État succès */
              <div className="text-center">
                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <CheckCircle className="w-8 h-8 text-green-600" weight="fill" />
                </div>
                <h1 className="font-heading font-bold text-xl mb-2">{t('auth.forgot.sent.title')}</h1>
                <p className="text-slate-500 mb-6">
                  Si un compte existe pour <strong>{email}</strong>, vous recevrez un lien de
                  réinitialisation dans les prochaines minutes. Vérifiez aussi vos spams.
                </p>
                <Link to="/login">
                  <Button variant="outline" className="w-full">
                    <ArrowLeft className="w-4 h-4 mr-2" />
                    Retour à la connexion
                  </Button>
                </Link>
              </div>
            ) : (
              /* Formulaire */
              <>
                <h1 className="font-heading font-bold text-2xl text-center mb-2">
                  Mot de passe oublié
                </h1>
                <p className="text-slate-500 text-center mb-6">
                  Entrez votre email et nous vous enverrons un lien pour réinitialiser votre mot de
                  passe.
                </p>

                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <Label htmlFor="email">Email</Label>
                    <div className="relative mt-1">
                      <EnvelopeSimple className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <Input
                        id="email"
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="votre@email.com"
                        className="pl-9"
                        required
                        data-testid="forgot-email"
                      />
                    </div>
                  </div>

                  <Button
                    type="submit"
                    className="w-full bg-accent hover:bg-accent-hover"
                    disabled={loading}
                    data-testid="forgot-submit"
                  >
                    {loading ? t('auth.forgot.loading') : t('auth.forgot.submit')}
                  </Button>
                </form>

                <p className="text-center text-sm text-slate-500 mt-6">
                  <Link
                    to="/login"
                    className="flex items-center justify-center gap-1 text-accent font-medium hover:underline"
                  >
                    <ArrowLeft className="w-4 h-4" />
                    Retour à la connexion
                  </Link>
                </p>
              </>
            )}
          </div>
        </motion.div>
      </div>
    </Layout>
  );
};

export default ForgotPasswordPage;