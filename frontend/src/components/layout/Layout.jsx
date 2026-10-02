import React, { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { MemoizedHeader as Header } from './Header';
import { Footer } from './Footer';
import { Toaster } from '../ui/sonner';
import { useLocale } from '../../context/LocaleContext';

const SEO_META = (locale) => ({
  '/': {
    title: locale === 'en' ? 'AfriSupply — B2B Industrial Marketplace Central Africa | CEMAC' : 'AfriSupply — Marketplace B2B Industrielle Afrique Centrale | CEMAC',
    description: locale === 'en' ? 'Buy wholesale from verified industrial suppliers in Cameroon, Gabon, Congo, Chad. MTN Money payment. CEMAC delivery.' : 'Achetez en gros auprès de fournisseurs industriels vérifiés au Cameroun, Gabon, Congo, Tchad. Paiement MTN Money. Livraison CEMAC.',
  },
  '/products': {
    title: locale === 'en' ? 'Industrial products wholesale — Verified CEMAC suppliers | AfriSupply' : 'Produits industriels en gros — Fournisseurs vérifiés CEMAC | AfriSupply',
    description: locale === 'en' ? '10,000+ industrial products. Certified suppliers. Mobile Money. CEMAC delivery.' : '10 000+ produits industriels. Fournisseurs certifiés. Mobile Money. Livraison CEMAC.',
  },
  '/categories': {
    title: locale === 'en' ? 'Industrial Categories — AfriSupply CEMAC' : 'Catégories industrielles — AfriSupply CEMAC',
    description: locale === 'en' ? 'Browse all industrial sectors: construction, metallurgy, maintenance.' : 'Parcourez tous les secteurs industriels : construction, métallurgie, maintenance.',
  },
});

const DEFAULT_META = (locale) => ({
  title: locale === 'en' ? 'AfriSupply — B2B Industrial Marketplace for Central Africa' : "AfriSupply — Marketplace B2B Industrielle pour l'Afrique Centrale",
  description: locale === 'en' ? 'The B2B industrial marketplace of the CEMAC zone.' : 'La marketplace B2B industrielle de la zone CEMAC.',
});

const SCHEMA = {
  "@context": "https://schema.org", "@type": "Organization",
  "name": "AfriSupply", "url": "https://www.afrisupply.com",
  "logo": "https://www.afrisupply.com/logo.webp",
  "areaServed": ["CM","GA","CG","TD","GQ","CF"],
  "contactPoint": { "@type": "ContactPoint", "telephone": "+237-656-179-221", "contactType": "customer service" }
};

const useSEO = (pathname, locale) => {
  useEffect(() => {
    const seo = SEO_META(locale);
    const meta = seo[pathname]
      || Object.entries(seo).find(([k]) => k !== '/' && pathname.startsWith(k))?.[1]
      || DEFAULT_META(locale);
    document.title = meta.title;
    const setMeta = (name, content, prop = false) => {
      const attr = prop ? 'property' : 'name';
      let el = document.querySelector(`meta[${attr}="${name}"]`);
      if (!el) { el = document.createElement('meta'); el.setAttribute(attr, name); document.head.appendChild(el); }
      el.setAttribute('content', content);
    };
    setMeta('description', meta.description);
    setMeta('og:title', meta.title, true);
    setMeta('og:description', meta.description, true);
    setMeta('og:type', 'website', true);
    let ld = document.getElementById('schema-org');
    if (!ld) { ld = document.createElement('script'); ld.id = 'schema-org'; ld.type = 'application/ld+json'; document.head.appendChild(ld); }
    ld.textContent = JSON.stringify(SCHEMA);
  }, [pathname, locale]);
};

// FIX CRITIQUE : WhatsAppButton utilise useLocale via hook correctement
const WhatsAppButton = ({ t }) => (
  <a
    href="https://wa.me/237656179221?text=Bonjour%2C%20j%27ai%20besoin%20d%27aide%20sur%20AfriSupply"
    target="_blank"
    rel="noopener noreferrer"
    aria-label={t('whatsapp.label')}
    className="fixed bottom-6 right-6 z-50 flex items-center gap-2 bg-green-500 hover:bg-green-600 text-white rounded-full shadow-lg transition-all hover:scale-105 px-4 py-3"
  >
    <svg viewBox="0 0 24 24" className="w-5 h-5 fill-current flex-shrink-0">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z" />
      <path d="M12 0C5.373 0 0 5.373 0 12c0 2.124.554 4.118 1.527 5.845L0 24l6.303-1.506A11.954 11.954 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.8a9.8 9.8 0 01-5.003-1.37l-.36-.213-3.737.893.924-3.638-.234-.374A9.762 9.762 0 012.2 12C2.2 6.587 6.587 2.2 12 2.2S21.8 6.587 21.8 12 17.413 21.8 12 21.8z" />
    </svg>
    <span className="text-sm font-medium hidden sm:block">{t('whatsapp.help')}</span>
  </a>
);

export const Layout = ({ children, title, description }) => {
  const location = useLocation();
  const { locale, t } = useLocale();
  useSEO(location.pathname, locale);

  useEffect(() => {
    if (title) document.title = title + ' | AfriSupply';
    if (description) {
      const el = document.querySelector('meta[name="description"]');
      if (el) el.setAttribute('content', description);
    }
  }, [title, description]);

  return (
    <div className="min-h-screen flex flex-col bg-background overflow-x-hidden w-full">
      <Header />
      <main className="flex-1">{children}</main>
      <Footer />
      <WhatsAppButton t={t} />
      <Toaster position="top-right" richColors />
    </div>
  );
};

export default Layout;