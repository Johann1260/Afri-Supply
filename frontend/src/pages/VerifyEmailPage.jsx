import React, { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { CheckCircle, XCircle, Spinner, Storefront } from '@phosphor-icons/react';
import { Layout } from '../components/layout';
import { Button } from '../components/ui/button';
import { authAPI } from '../lib/api';
import { useLocale } from '../context/LocaleContext';

const VerifyEmailPage = () => {
  const [searchParams] = useSearchParams();
  const { t } = useLocale();
  const token = searchParams.get('token');

  const [status, setStatus] = useState('checking'); // checking | success | error

  useEffect(() => {
    if (!token) {
      setStatus('error');
      return;
    }

    const verify = async () => {
      try {
        await authAPI.verifyEmail(token);
        setStatus('success');
      } catch (err) {
        setStatus('error');
      }
    };

    verify();
  }, [token]);

  return (
    <Layout>
      <div className="min-h-[80vh] flex items-center justify-center py-12 px-4">
        <div className="w-full max-w-md text-center">
          {/* Logo */}
          <Link to="/" className="inline-flex items-center gap-2 justify-center mb-10">
            <div className="w-12 h-12 bg-primary rounded-lg flex items-center justify-center">
              <Storefront className="w-7 h-7 text-white" weight="bold" />
            </div>
            <span className="font-heading font-bold text-2xl text-primary">AfriSupply</span>
          </Link>

          {status === 'checking' && (
            <div>
              <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-6">
                <Spinner className="w-8 h-8 text-primary animate-spin" />
              </div>
              <h1 className="font-heading font-bold text-xl mb-2">{t('auth.verify.check')}</h1>
              <p className="text-slate-500">Veuillez patienter...</p>
            </div>
          )}

          {status === 'success' && (
            <div>
              <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
                <CheckCircle className="w-10 h-10 text-green-600" weight="fill" />
              </div>
              <h1 className="font-heading font-bold text-2xl mb-3">{t('auth.verify.success')}</h1>
              <p className="text-slate-500 mb-8">
                Votre adresse email a été confirmée. Vous pouvez maintenant accéder à toutes les
                fonctionnalités d'AfriSupply.
              </p>
              <Link to="/login">
                <Button className="w-full bg-accent hover:bg-accent-hover">
                  Se connecter
                </Button>
              </Link>
            </div>
          )}

          {status === 'error' && (
            <div>
              <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
                <XCircle className="w-10 h-10 text-red-600" weight="fill" />
              </div>
              <h1 className="font-heading font-bold text-2xl mb-3">{t('auth.verify.error')}</h1>
              <p className="text-slate-500 mb-8">
                Le lien de confirmation est invalide ou a expiré (durée de validité : 24h).
                Veuillez vous réinscrire ou demander un nouveau lien depuis la page de connexion.
              </p>
              <div className="flex flex-col gap-3">
                <Link to="/login">
                  <Button className="w-full bg-accent hover:bg-accent-hover">
                    Aller à la connexion
                  </Button>
                </Link>
                <Link to="/register">
                  <Button variant="outline" className="w-full">
                    Créer un nouveau compte
                  </Button>
                </Link>
              </div>
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
};

export default VerifyEmailPage;