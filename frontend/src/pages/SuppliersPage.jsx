import React, { useState, useEffect } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Star, MapPin, Package, ShoppingCart, Calendar, Users, SealCheck, Buildings } from '@phosphor-icons/react';
import { Layout } from '../components/layout';
import { ProductGrid } from '../components/products';
import { Button } from '../components/ui/button';
import { Progress } from '../components/ui/progress';
import { supplierAPI, productsAPI, badgesAPI } from '../lib/api';
import { useLocale } from '../context/LocaleContext';
import { formatDate } from '../lib/utils';

const BADGE_LABELS = {
  verified:          { fr: 'Fournisseur Vérifié',   en: 'Verified Supplier',   icon: '✓',  color: '#0ea5e9' },
  docs_verified:     { fr: 'Documents Vérifiés',    en: 'Docs Verified',        icon: '📄', color: '#6366f1' },
  identity_verified: { fr: 'Identité Vérifiée',     en: 'Identity Verified',    icon: '🪪', color: '#0d9488' },
  certified:         { fr: 'Certifié AfriSupply',   en: 'AfriSupply Certified', icon: '🏅', color: '#dc2626' },
  gold:              { fr: 'Gold Supplier',           en: 'Gold Supplier',        icon: '🥇', color: '#f59e0b' },
  silver:            { fr: 'Silver Supplier',         en: 'Silver Supplier',      icon: '🥈', color: '#94a3b8' },
  platinum:          { fr: 'Platinum Supplier',       en: 'Platinum Supplier',    icon: '💎', color: '#8b5cf6' },
  top_rated:         { fr: 'Top Évalué',              en: 'Top Rated',            icon: '⭐', color: '#f97316' },
  quick_responder:   { fr: 'Réponse Rapide',          en: 'Quick Responder',      icon: '⚡', color: '#10b981' },
  trade_assurance:   { fr: 'Trade Assurance',         en: 'Trade Assurance',      icon: '🛡️', color: '#034168' },
};

const BadgePill = ({ badge, lang = 'fr' }) => {
  const meta = BADGE_LABELS[badge] || { fr: badge, en: badge, icon: '•', color: '#94a3b8' };
  return (
    <span
      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium"
      style={{ background: `${meta.color}15`, color: meta.color, border: `1px solid ${meta.color}40` }}
      title={lang === 'en' ? meta.en : meta.fr}
    >
      <span>{meta.icon}</span>
      <span>{lang === 'en' ? meta.en : meta.fr}</span>
    </span>
  );
};

const RatingStars = ({ rating, size = 'md' }) => {
  const sz = size === 'sm' ? 'w-3.5 h-3.5' : 'w-5 h-5';
  return (
    <div className="flex items-center gap-0.5">
      {[...Array(5)].map((_, i) => (
        <Star key={i} className={`${sz} ${i < Math.round(rating) ? 'text-yellow-500' : 'text-slate-200'}`}
          weight={i < Math.round(rating) ? 'fill' : 'regular'} />
      ))}
    </div>
  );
};

const RatingBar = ({ label, value }) => (
  <div className="flex items-center gap-3">
    <span className="text-sm text-slate-600 w-32 shrink-0">{label}</span>
    <Progress value={(value / 5) * 100} className="flex-1 h-2" />
    <span className="text-sm font-medium w-8 text-right">{(value || 0).toFixed(1)}</span>
  </div>
);

const SuppliersPage = () => {
  const { supplierId } = useParams();
  const { t, locale, localizeAnon }  = useLocale();
  const lang = locale?.startsWith('en') ? 'en' : 'fr';

  const [suppliers, setSuppliers]         = useState([]);
  const [selectedSupplier, setSelected]   = useState(null);
  const [supplierProducts, setProducts]   = useState([]);
  const [supplierRatings, setRatings]     = useState([]);
  const [loading, setLoading]             = useState(true);

  useEffect(() => {
    if (supplierId) fetchProfile(supplierId);
    else fetchList();
  }, [supplierId]);

  const fetchList = async () => {
    try {
      const res = await supplierAPI.getAll();
      setSuppliers(res.data || []);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  const fetchProfile = async (id) => {
    try {
      const [profileRes, productsRes, ratingsRes] = await Promise.allSettled([
        supplierAPI.getProfile(id),
        productsAPI.getAll({ supplier_id: id, limit: 12 }),
        supplierAPI.getRatings(id),
      ]);
      if (profileRes.status === 'fulfilled') setSelected(profileRes.value.data);
      setProducts(productsRes.status === 'fulfilled' ? productsRes.value.data || [] : []);
      setRatings(ratingsRes.status === 'fulfilled' ? ratingsRes.value.data || [] : []);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  // ── Profile view ──────────────────────────────────────────────────────────
  if (supplierId && selectedSupplier) {
    const s = selectedSupplier;
    const badges = s.badges || [];
    const rating = s.rating || s.avg_rating || 0;
    const ratingCount = s.rating_count || s.review_count || 0;

    return (
      <Layout>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">

          {/* Header card */}
          <div className="bg-white border border-slate-200 rounded-xl p-6">
            <div className="flex flex-col md:flex-row gap-6">
              <div className="w-20 h-20 bg-primary/10 rounded-xl flex items-center justify-center shrink-0">
                <Buildings className="w-10 h-10 text-primary" weight="duotone" />
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2 mb-1">
                  <h1 className="font-heading font-bold text-2xl">{localizeAnon(s.company_name)}</h1>
                  {badges.includes('certified') && (
                    <SealCheck className="w-6 h-6 text-red-600" weight="fill" title="Certifié AfriSupply" />
                  )}
                </div>
                <p className="text-slate-400 text-xs font-mono">ID: {s.id?.slice(0, 8).toUpperCase()}</p>

                <div className="flex flex-wrap gap-4 mt-2 text-sm text-slate-600">
                  {s.city && (
                    <span className="flex items-center gap-1">
                      <MapPin className="w-4 h-4" />{s.city}, {s.country}
                    </span>
                  )}
                  <span className="flex items-center gap-1">
                    <Calendar className="w-4 h-4" />
                    {lang === 'fr' ? 'Membre depuis' : 'Member since'} {formatDate(s.member_since)}
                  </span>
                </div>

                <div className="flex items-center gap-3 mt-3">
                  <RatingStars rating={rating} />
                  <span className="font-bold text-lg">{rating.toFixed(1)}</span>
                  <span className="text-slate-400 text-sm">({ratingCount} avis)</span>
                </div>

                {/* Badges */}
                {badges.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-3">
                    {badges.map(b => <BadgePill key={b} badge={b} lang={lang} />)}
                  </div>
                )}
              </div>

              {/* Stats */}
              <div className="flex gap-6 shrink-0">
                <div className="text-center">
                  <p className="text-2xl font-bold text-primary">{s.products_count || s.product_count || 0}</p>
                  <p className="text-xs text-slate-500 mt-0.5">{lang === 'fr' ? 'Produits' : 'Products'}</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-green-600">{s.orders_completed || 0}</p>
                  <p className="text-xs text-slate-500 mt-0.5">{lang === 'fr' ? 'Commandes' : 'Orders'}</p>
                </div>
              </div>
            </div>

            {/* NUI + RC — identifiants légaux visibles si renseignés */}
            {(s.nui || s.rc_number) && (
              <div className="mt-4 pt-4 border-t border-slate-100 flex flex-wrap gap-6 text-sm">
                {s.nui && (
                  <div>
                    <span className="text-slate-400 text-xs uppercase tracking-wide">NUI</span>
                    <p className="font-mono font-semibold text-slate-700">{s.nui}</p>
                  </div>
                )}
                {s.rc_number && (
                  <div>
                    <span className="text-slate-400 text-xs uppercase tracking-wide">
                      {lang === 'fr' ? 'Registre de Commerce' : 'Business Registry'}
                    </span>
                    <p className="font-mono font-semibold text-slate-700">{s.rc_number}</p>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="grid lg:grid-cols-3 gap-6">
            {/* Left: ratings + reviews */}
            <div className="space-y-5">
              <div className="bg-white border border-slate-200 rounded-xl p-5">
                <h2 className="font-heading font-semibold mb-4">
                  {lang === 'fr' ? 'Évaluations' : 'Ratings'}
                </h2>
                <div className="space-y-2.5">
                  <RatingBar label={lang === 'fr' ? 'Note globale' : 'Overall'} value={rating} />
                  <RatingBar label={lang === 'fr' ? 'Communication' : 'Communication'} value={s.communication_avg || rating} />
                  <RatingBar label={lang === 'fr' ? 'Qualité' : 'Quality'} value={s.quality_avg || rating} />
                  <RatingBar label={lang === 'fr' ? 'Livraison' : 'Delivery'} value={s.delivery_avg || rating} />
                </div>
              </div>

              <div className="bg-white border border-slate-200 rounded-xl p-5">
                <h2 className="font-heading font-semibold mb-4">
                  {lang === 'fr' ? 'Avis clients' : 'Customer Reviews'}
                </h2>
                {supplierRatings.length === 0 ? (
                  <p className="text-slate-400 text-sm">{lang === 'fr' ? 'Aucun avis pour l\'instant.' : 'No reviews yet.'}</p>
                ) : (
                  <div className="space-y-4">
                    {supplierRatings.slice(0, 5).map((r) => (
                      <div key={r.id} className="border-b border-slate-100 pb-4 last:border-0">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm font-medium text-slate-500 font-mono">
                            {localizeAnon(r.buyer_name) || '—'}
                          </span>
                          <RatingStars rating={r.rating} size="sm" />
                        </div>
                        {r.comment && <p className="text-sm text-slate-600">{r.comment}</p>}
                        <p className="text-xs text-slate-400 mt-1">{formatDate(r.created_at)}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Right: products */}
            <div className="lg:col-span-2">
              <h2 className="font-heading font-semibold mb-4">
                {lang === 'fr' ? 'Produits' : 'Products'} ({supplierProducts.length})
              </h2>
              <ProductGrid products={supplierProducts} loading={loading} />
            </div>
          </div>
        </div>
      </Layout>
    );
  }

  // ── List view ──────────────────────────────────────────────────────────────
  return (
    <Layout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6">
          <h1 className="section-heading">{t('suppliers.title')}</h1>
          <p className="text-slate-500 mt-1 text-sm">{t('suppliers.subtitle')}</p>
        </div>

        {loading ? (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="bg-white border border-slate-200 rounded-xl p-5 animate-pulse">
                <div className="flex gap-4">
                  <div className="w-14 h-14 bg-slate-200 rounded-xl" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 bg-slate-200 rounded w-3/4" />
                    <div className="h-3 bg-slate-200 rounded w-1/2" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : suppliers.length === 0 ? (
          <div className="text-center py-16">
            <Users className="w-12 h-12 mx-auto text-slate-300 mb-3" />
            <p className="text-slate-500">{t('common.noResults')}</p>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
            {suppliers.map((sup) => (
              <Link key={sup.id} to={`/suppliers/${sup.id}`}
                className="bg-white border border-slate-200 rounded-xl p-5 hover:border-accent hover:shadow-md transition-all group block">
                <div className="flex gap-3">
                  <div className="w-14 h-14 bg-primary/10 rounded-xl flex items-center justify-center shrink-0 group-hover:bg-primary/20 transition-colors">
                    <Users className="w-7 h-7 text-primary" weight="duotone" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-heading font-semibold truncate group-hover:text-accent transition-colors">
                      {localizeAnon(sup.company_name)}
                    </h3>
                    {sup.city && (
                      <p className="text-xs text-slate-500 flex items-center gap-0.5 mt-0.5">
                        <MapPin className="w-3 h-3" />{sup.city}, {sup.country}
                      </p>
                    )}
                  </div>
                </div>

                {/* Badges (top 3) */}
                {(sup.badges || []).length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-3">
                    {(sup.badges || []).slice(0, 3).map(b => <BadgePill key={b} badge={b} lang={lang} />)}
                    {(sup.badges || []).length > 3 && (
                      <span className="text-xs text-slate-400 self-center">+{sup.badges.length - 3}</span>
                    )}
                  </div>
                )}

                <div className="flex items-center gap-2 mt-3">
                  <RatingStars rating={sup.rating || 0} size="sm" />
                  <span className="text-sm font-medium">{(sup.rating || 0).toFixed(1)}</span>
                  <span className="text-xs text-slate-400">({sup.rating_count || 0})</span>
                </div>

                <div className="flex gap-4 mt-3 pt-3 border-t border-slate-100 text-xs text-slate-500">
                  <span className="flex items-center gap-1">
                    <Package className="w-3.5 h-3.5" />{sup.products_count || 0} {lang === 'fr' ? 'produits' : 'products'}
                  </span>
                  <span className="flex items-center gap-1">
                    <ShoppingCart className="w-3.5 h-3.5" />{sup.orders_completed || 0} {lang === 'fr' ? 'commandes' : 'orders'}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
};

export default SuppliersPage;
