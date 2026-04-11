// src/context/LocaleContext.js
// P4-24: Internationalisation FR / EN
// Usage: const { t, locale, setLocale } = useLocale();
// t(object, 'name') → retourne object.name_en si locale='en' et object.name_en existe, sinon object.name

import React, { createContext, useContext, useState, useCallback } from 'react';

// ── Dictionnaire des labels UI ────────────────────────────────────────────────
const TRANSLATIONS = {
  fr: {
    // Navigation
    'nav.products': 'Produits',
    'nav.categories': 'Catégories',
    'nav.suppliers': 'Fournisseurs',
    'nav.news': 'Actualités',
    'nav.dashboard': 'Tableau de bord',
    'nav.profile': 'Mon profil',
    'nav.favorites': 'Favoris',
    'nav.messages': 'Messages',
    'nav.rfq': 'Demandes de devis',
    'nav.logout': 'Déconnexion',
    'nav.login': 'Connexion',
    'nav.register': "S'inscrire",

    // Hero
    'hero.badge': 'Zone CEMAC',
    'hero.title': 'La marketplace B2B industrielle pour l\'Afrique centrale',
    'hero.subtitle': 'Connectez-vous avec les meilleurs fournisseurs industriels du Cameroun, Gabon, Congo, Tchad, Guinée Équatoriale et Centrafrique.',
    'hero.cta.products': 'Explorer les produits',
    'hero.cta.supplier': 'Devenir fournisseur',

    // Products
    'products.addToCart': 'Ajouter au panier',
    'products.minOrder': 'Min.',
    'products.inStock': 'En stock',
    'products.outOfStock': 'Rupture de stock',
    'products.requestQuote': 'Demander un devis',
    'products.contact': 'Contacter',
    'products.reviews': 'avis',
    'products.description': 'Description',
    'products.specifications': 'Spécifications',

    // Cart
    'cart.title': 'Mon panier',
    'cart.empty': 'Votre panier est vide',
    'cart.checkout': 'Passer la commande',
    'cart.total': 'Total',
    'cart.items': 'articles',

    // Checkout
    'checkout.title': 'Finaliser la commande',
    'checkout.address': 'Adresse de livraison',
    'checkout.payment': 'Mode de paiement',
    'checkout.submit': 'Procéder au paiement',
    'checkout.success': 'Paiement réussi !',

    // Orders
    'orders.status.pending': 'En attente',
    'orders.status.confirmed': 'Confirmée',
    'orders.status.processing': 'En traitement',
    'orders.status.shipped': 'Expédiée',
    'orders.status.delivered': 'Livrée',
    'orders.status.cancelled': 'Annulée',

    // Common
    'common.loading': 'Chargement...',
    'common.error': 'Une erreur est survenue',
    'common.save': 'Enregistrer',
    'common.cancel': 'Annuler',
    'common.confirm': 'Confirmer',
    'common.back': 'Retour',
    'common.seeAll': 'Voir tout',
    'common.optional': 'optionnel',
  },

  en: {
    // Navigation
    'nav.products': 'Products',
    'nav.categories': 'Categories',
    'nav.suppliers': 'Suppliers',
    'nav.news': 'News',
    'nav.dashboard': 'Dashboard',
    'nav.profile': 'My profile',
    'nav.favorites': 'Favorites',
    'nav.messages': 'Messages',
    'nav.rfq': 'Quote requests',
    'nav.logout': 'Sign out',
    'nav.login': 'Log in',
    'nav.register': 'Sign up',

    // Hero
    'hero.badge': 'CEMAC Zone',
    'hero.title': 'The B2B industrial marketplace for Central Africa',
    'hero.subtitle': 'Connect with the best industrial suppliers in Cameroon, Gabon, Congo, Chad, Equatorial Guinea and Central African Republic.',
    'hero.cta.products': 'Browse products',
    'hero.cta.supplier': 'Become a supplier',

    // Products
    'products.addToCart': 'Add to cart',
    'products.minOrder': 'Min.',
    'products.inStock': 'In stock',
    'products.outOfStock': 'Out of stock',
    'products.requestQuote': 'Request a quote',
    'products.contact': 'Contact',
    'products.reviews': 'reviews',
    'products.description': 'Description',
    'products.specifications': 'Specifications',

    // Cart
    'cart.title': 'My cart',
    'cart.empty': 'Your cart is empty',
    'cart.checkout': 'Proceed to checkout',
    'cart.total': 'Total',
    'cart.items': 'items',

    // Checkout
    'checkout.title': 'Checkout',
    'checkout.address': 'Shipping address',
    'checkout.payment': 'Payment method',
    'checkout.submit': 'Pay now',
    'checkout.success': 'Payment successful!',

    // Orders
    'orders.status.pending': 'Pending',
    'orders.status.confirmed': 'Confirmed',
    'orders.status.processing': 'Processing',
    'orders.status.shipped': 'Shipped',
    'orders.status.delivered': 'Delivered',
    'orders.status.cancelled': 'Cancelled',

    // Common
    'common.loading': 'Loading...',
    'common.error': 'An error occurred',
    'common.save': 'Save',
    'common.cancel': 'Cancel',
    'common.confirm': 'Confirm',
    'common.back': 'Back',
    'common.seeAll': 'See all',
    'common.optional': 'optional',
  },
};

// ── Context ───────────────────────────────────────────────────────────────────
const LocaleContext = createContext(null);

export const LocaleProvider = ({ children }) => {
  const [locale, setLocale] = useState(() => {
    return localStorage.getItem('afrisupply_locale') || 'fr';
  });

  const changeLocale = (newLocale) => {
    localStorage.setItem('afrisupply_locale', newLocale);
    setLocale(newLocale);
  };

  // t(key) → traduit une clé UI
  const t = useCallback(
    (key) => {
      return TRANSLATIONS[locale]?.[key] ?? TRANSLATIONS.fr[key] ?? key;
    },
    [locale]
  );

  // tf(obj, field) → traduit un champ de données API (ex: product.name)
  // Retourne obj[field + '_en'] si locale='en' et que le champ existe, sinon obj[field]
  const tf = useCallback(
    (obj, field) => {
      if (!obj) return '';
      if (locale === 'en' && obj[`${field}_en`]) return obj[`${field}_en`];
      return obj[field] ?? '';
    },
    [locale]
  );

  return (
    <LocaleContext.Provider value={{ locale, setLocale: changeLocale, t, tf }}>
      {children}
    </LocaleContext.Provider>
  );
};

export const useLocale = () => {
  const ctx = useContext(LocaleContext);
  if (!ctx) throw new Error('useLocale must be used within a LocaleProvider');
  return ctx;
};

export default LocaleContext;