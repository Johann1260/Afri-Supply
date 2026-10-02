import React, { useState, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { emailChangeAPI } from '../lib/api';
import { useLocale } from '../context/LocaleContext';
import Layout from '../components/layout/Layout';

const ConfirmEmailChangePage = () => {
  const [params] = useSearchParams();
  const { t } = useLocale();
  const token = params.get('token');
  const [status, setStatus] = useState('loading');
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!token) { setStatus('error'); setMessage(t('email.change.tokenMissing')); return; }
    emailChangeAPI.activate(token)
      .then((r) => { setStatus('success'); setMessage(r.data.message); })
      .catch((e) => { setStatus('error'); setMessage(e.response?.data?.detail || t('email.change.invalidLink')); });
  }, [token, t]);

  return (
    <Layout>
      <div className="min-h-[60vh] flex items-center justify-center p-8">
        <div className="max-w-md w-full text-center">
          {status === 'loading' && <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-accent mx-auto" />}
          {status === 'success' && (<>
            <p className="text-5xl mb-4">✅</p>
            <h1 className="text-2xl font-bold text-slate-800 mb-2">{t('email.change.success')}</h1>
            <p className="text-slate-500 mb-6">{message}</p>
            <Link to="/login" className="text-accent hover:underline font-medium">{t('email.change.reconnect')}</Link>
          </>)}
          {status === 'error' && (<>
            <p className="text-5xl mb-4">⚠️</p>
            <h1 className="text-2xl font-bold text-slate-800 mb-2">{t('email.change.error')}</h1>
            <p className="text-slate-500 mb-6">{message}</p>
            <Link to="/profile" className="text-accent hover:underline font-medium">{t('email.change.backProfile')}</Link>
          </>)}
        </div>
      </div>
    </Layout>
  );
};

export default ConfirmEmailChangePage;