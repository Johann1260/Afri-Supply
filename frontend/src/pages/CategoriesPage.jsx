import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Buildings, Wrench, HardHat, Gear, ArrowRight, Package } from '@phosphor-icons/react';
import { Layout } from '../components/layout';
import { categoriesAPI, productsAPI } from '../lib/api';
import { useLocale } from '../context/LocaleContext';
import { motion } from 'framer-motion';
import { toast } from 'sonner';

const ICON_MAP = { Wrench, HardHat, Gear, Buildings };
const SECTOR_IMAGES = [
 '/cons-bg.webp',
  '/bt-bg.webp',
  '/maintenance-bg.webp',
  '/hero-bg.webp',
];

export default function CategoriesPage() {
  const { t, tf } = useLocale();
  const [categories, setCategories]     = useState([]);
  const [counts, setCounts]             = useState({});
  const [loading, setLoading]           = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const catRes = await categoriesAPI.getAll();
        const cats = catRes.data || [];
        setCategories(cats);

        // Comptage exact par catégorie via l'endpoint dédié (pas de limite arbitraire)
        const countResults = await Promise.allSettled(
          cats.map((c) => productsAPI.getCount({ category_id: c.id, is_available: true }))
        );
        const countMap = {};
        cats.forEach((c, i) => {
          const r = countResults[i];
          countMap[c.id] = r.status === 'fulfilled' ? (r.value.data?.count ?? 0) : 0;
        });
        setCounts(countMap);
      } catch (e) {
        console.error(e);
        toast.error(t('common.error'));
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [t]);

  return (
    <Layout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Hero */}
        <div className="mb-12">
          <p className="overline text-accent mb-2 uppercase tracking-widest text-xs font-bold">
            {t('categories.title')}
          </p>
          <h1 className="font-heading font-black text-3xl lg:text-4xl text-slate-900 leading-tight">
            {t('nav.categories')}
          </h1>
          <p className="text-slate-500 mt-3 max-w-xl">
            {t('categories.subtitle')}
          </p>
        </div>

        {loading ? (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="bg-white border border-slate-200 rounded-xl overflow-hidden animate-pulse">
                <div className="aspect-video bg-slate-200" />
                <div className="p-6 space-y-3">
                  <div className="h-5 bg-slate-200 rounded w-1/2" />
                  <div className="h-4 bg-slate-100 rounded w-3/4" />
                  <div className="h-4 bg-slate-100 rounded w-1/3" />
                </div>
              </div>
            ))}
          </div>
        ) : categories.length === 0 ? (
          <div className="text-center py-20">
            <Package className="w-16 h-16 mx-auto text-slate-300 mb-4" weight="duotone" />
            <p className="text-slate-500">{t('categories.noneavailable')}</p>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {categories.map((cat, i) => {
              const Icon = ICON_MAP[cat.icon] || Buildings;
              const img = cat.image_url || SECTOR_IMAGES[i % SECTOR_IMAGES.length];
              const count = counts[cat.id] ?? 0;

              return (
                <motion.div
                  key={cat.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: i * 0.08 }}
                >
                  <Link
                    to={`/products?category_id=${cat.id}`}
                    className="group block bg-white border border-slate-200 rounded-xl overflow-hidden hover:border-accent/50 hover:shadow-lg transition-all duration-300"
                    data-testid={`category-${cat.id}`}
                  >
                    {/* Image */}
                    <div className="relative aspect-video overflow-hidden bg-slate-100">
                      <img
                        src={img}
                        alt={tf(cat, 'name')}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-primary/80 via-primary/20 to-transparent" />
                      <div className="absolute bottom-4 left-4 text-accent">
                        <Icon className="w-8 h-8" weight="duotone" />
                      </div>
                    </div>

                    {/* Content */}
                    <div className="p-6">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <h3 className="font-heading font-bold text-lg text-slate-900 group-hover:text-accent transition-colors leading-tight">
                            {tf(cat, 'name')}
                          </h3>
                          {tf(cat, 'description') && (
                            <p className="text-slate-500 text-sm mt-2 line-clamp-2">
                              {tf(cat, 'description')}
                            </p>
                          )}
                        </div>
                        <ArrowRight className="w-5 h-5 text-slate-300 group-hover:text-accent group-hover:translate-x-1 transition-all flex-shrink-0 mt-1" />
                      </div>

                      <div className="mt-4 pt-4 border-t border-slate-100 flex items-center justify-between">
                        <span className="text-xs font-semibold text-slate-400 uppercase tracking-widest">
                          {count > 0 ? `${count} ${t('cta.products')}${count !== 1 ? 's' : ''}` : t('cta.seeProducts')}
                        </span>
                        <div className="flex gap-1">
                          {[...Array(Math.min(3, Math.ceil(count / 50) + 1))].map((_, j) => (
                            <div key={j} className={`w-1.5 h-1.5 rounded-full ${j === 0 ? 'bg-accent' : 'bg-slate-200'}`} />
                          ))}
                        </div>
                      </div>
                    </div>
                  </Link>
                </motion.div>
              );
            })}
          </div>
        )}

        {/* CTA section */}
        <div className="mt-16 bg-primary rounded-2xl p-8 text-center">
          <h2 className="font-heading font-bold text-2xl text-white mb-3">
            {t('categories.cta.title')}
          </h2>
          <p className="text-white/70 mb-6">
            {t('categories.cta.sub')}
          </p>
          <Link
            to="/rfq"
            className="inline-flex items-center gap-2 px-6 py-3 bg-accent hover:bg-accent-hover text-white font-semibold rounded-lg transition-colors"
          >
            {t('categories.cta.btn')}
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
    </Layout>
  );
}