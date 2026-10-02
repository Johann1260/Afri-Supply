import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { storefrontAPI } from '../lib/api';
import { useLocale } from '../context/LocaleContext';
import { formatPrice, getImageUrl } from '../lib/utils';
import Layout from '../components/layout/Layout';
import { Star, MapPin, Buildings, Calendar, ShieldCheck, Package } from '@phosphor-icons/react';

const BADGE_COLORS = {
  verified: 'bg-sky-100 text-sky-700', gold: 'bg-amber-100 text-amber-700',
  silver: 'bg-slate-100 text-slate-600', platinum: 'bg-violet-100 text-violet-700',
  top_rated: 'bg-orange-100 text-orange-700', quick_responder: 'bg-emerald-100 text-emerald-700',
  trade_assurance: 'bg-blue-100 text-blue-700', docs_verified: 'bg-indigo-100 text-indigo-700',
};

const StorefrontPage = () => {
  const { slug } = useParams();
  const { t, tf, localizeAnon } = useLocale();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    storefrontAPI.getBySlug(slug)
      .then((r) => setData(r.data))
      .catch((e) => setError(e.response?.data?.detail || t('storefront.not.found')))
      .finally(() => setLoading(false));
  }, [slug]);

  if (loading) return (
    <Layout><div className="max-w-6xl mx-auto px-4 py-12 animate-pulse space-y-6">
      <div className="h-48 bg-slate-200 rounded-xl" />
      <div className="h-8 bg-slate-200 rounded w-1/3" />
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">{[...Array(4)].map((_,i) => <div key={i} className="h-48 bg-slate-200 rounded-xl" />)}</div>
    </div></Layout>
  );

  if (error) return (
    <Layout><div className="max-w-2xl mx-auto px-4 py-20 text-center">
      <p className="text-5xl mb-4">🏪</p>
      <h1 className="text-2xl font-bold text-slate-800 mb-2">{t('store.notFound')}</h1>
      <p className="text-slate-500">{error}</p>
      <Link to="/suppliers" className="text-accent hover:underline mt-4 inline-block">{t('store.seeSuppliers')}</Link>
    </div></Layout>
  );

  const s = data;

  return (
    <Layout>
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Banner */}
        {s.banner_image ? (
          <div className="h-48 sm:h-64 rounded-xl overflow-hidden mb-6 bg-slate-100">
            <img src={getImageUrl(s.banner_image)} alt="" className="w-full h-full object-cover" />
          </div>
        ) : (
          <div className="h-48 sm:h-64 rounded-xl mb-6 bg-gradient-to-r from-primary to-accent/80 flex items-center justify-center">
            <h1 className="text-3xl sm:text-4xl font-bold text-white">{localizeAnon(s.company_name)}</h1>
          </div>
        )}

        {/* Profile header */}
        <div className="flex flex-col sm:flex-row gap-6 mb-8">
          <div className="flex-1">
            <h1 className="text-2xl font-bold text-slate-900">{localizeAnon(s.company_name)}</h1>
            {s.headline && <p className="text-slate-600 mt-1">{tf(s, 'headline')}</p>}
            <div className="flex flex-wrap items-center gap-3 mt-3 text-sm text-slate-500">
              {s.country && <span className="flex items-center gap-1"><MapPin className="w-4 h-4" />{s.city ? `${s.city}, ` : ''}{s.country}</span>}
              {s.year_established && <span className="flex items-center gap-1"><Calendar className="w-4 h-4" />{t('store.since')} {s.year_established}</span>}
              {s.employee_count && <span className="flex items-center gap-1"><Buildings className="w-4 h-4" />{s.employee_count} {t('store.employees')}</span>}
            </div>
            {/* Badges */}
            {s.badges?.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-4">
                {(s.badge_details || []).map((b, i) => (
                  <span key={i} className={`px-3 py-1 rounded-full text-xs font-medium ${BADGE_COLORS[s.badges[i]] || 'bg-slate-100 text-slate-600'}`}>
                    {b.icon} {b.label}
                  </span>
                ))}
              </div>
            )}
          </div>
          <div className="flex flex-col items-end gap-2 min-w-[140px]">
            <div className="flex items-center gap-1">
              <Star className="w-5 h-5 text-yellow-500" weight="fill" />
              <span className="font-bold text-lg">{(s.avg_rating || 0).toFixed(1)}</span>
              <span className="text-slate-400 text-sm">({s.review_count || 0})</span>
            </div>
            <span className="text-sm text-slate-500"><Package className="w-4 h-4 inline mr-1" />{s.product_count || 0} produits</span>
            <Link to={`/messages/${s.supplier_id}`} className="mt-2 px-4 py-2 bg-accent text-white rounded-lg text-sm font-medium hover:bg-accent/90 transition-colors">
              {t('store.contact')}
            </Link>
          </div>
        </div>

        {/* About */}
        {s.about && (
          <div className="bg-white border border-slate-200 rounded-xl p-6 mb-6">
            <h2 className="font-semibold text-lg mb-3">{t('store.about')}</h2>
            <p className="text-slate-600 text-sm whitespace-pre-line">{tf(s, 'about')}</p>
            {s.certifications?.length > 0 && (
              <div className="mt-4">
                <h3 className="text-sm font-medium text-slate-700 mb-2">{t('store.certifications')}</h3>
                <div className="flex flex-wrap gap-2">
                  {s.certifications.map((c, i) => (
                    <span key={i} className="px-3 py-1 bg-green-50 text-green-700 rounded-full text-xs font-medium">
                      <ShieldCheck className="w-3 h-3 inline mr-1" />{c}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Products */}
        <h2 className="font-semibold text-lg mb-4">{t('store.products')} ({s.products?.length || 0})</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {(s.products || []).map((p) => (
            <Link key={p.id} to={`/products/${p.id}`}
              className="bg-white border border-slate-200 rounded-xl overflow-hidden hover:shadow-md transition-shadow group">
              <div className="aspect-square bg-slate-100 overflow-hidden">
                {p.images?.[0] ? (
                  <img src={getImageUrl(p.images[0])} alt={p.name} loading="lazy"
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-slate-300"><Package className="w-12 h-12" /></div>
                )}
              </div>
              <div className="p-3">
                <p className="text-sm font-medium text-slate-800 line-clamp-2">{p.name}</p>
                <p className="text-accent font-bold text-sm mt-1">{formatPrice(p.price)}</p>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </Layout>
  );
};

export default StorefrontPage;