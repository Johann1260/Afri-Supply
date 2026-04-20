import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000';;

export const getImageUrl = (path) => {
  if (!path) return '';
  if (path.startsWith('http://') || path.startsWith('https://')) return path;
  if (path.startsWith('/uploads/')) return `${BACKEND_URL}${path}`;
  return `${BACKEND_URL}${path.startsWith('/') ? '' : '/'}${path}`;
};

export function cn(...inputs) {
  return twMerge(clsx(inputs));
}

/**
 * Formate un prix en XAF.
 * La devise est toujours XAF indépendamment de la locale UI —
 * les prix sont contractuels et ne se convertissent pas.
 */
export function formatPrice(price, currency = 'XAF') {
  if (price === null || price === undefined || isNaN(price)) return '—';
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(price);
}

/**
 * Formate une date selon la locale UI stockée dans localStorage.
 * Appelé sans argument de locale → utilise 'fr-FR' par défaut,
 * se met à jour automatiquement grâce à localStorage.
 */
export function formatDate(dateString) {
  if (!dateString) return '';
  const uiLocale = localStorage.getItem('afrisupply_locale') || 'fr';
  const bcp47 = uiLocale === 'en' ? 'en-GB' : 'fr-FR';
  try {
    return new Date(dateString).toLocaleDateString(bcp47, {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  } catch {
    return dateString;
  }
}

export function truncateText(text, maxLength = 100) {
  if (!text || text.length <= maxLength) return text;
  return text.substring(0, maxLength) + '...';
}

export function getStatusColor(status) {
  const colors = {
    pending:    'bg-yellow-100 text-yellow-800 border-yellow-200',
    confirmed:  'bg-blue-100 text-blue-800 border-blue-200',
    processing: 'bg-purple-100 text-purple-800 border-purple-200',
    shipped:    'bg-indigo-100 text-indigo-800 border-indigo-200',
    delivered:  'bg-green-100 text-green-800 border-green-200',
    cancelled:  'bg-red-100 text-red-800 border-red-200',
    paid:       'bg-green-100 text-green-800 border-green-200',
    initiated:  'bg-slate-100 text-slate-800 border-slate-200',
  };
  return colors[status] || 'bg-slate-100 text-slate-800 border-slate-200';
}

/**
 * Retourne le label traduit d'un statut de commande.
 * Lit la locale depuis localStorage pour être synchrone
 * (utilisé hors de React dans des contextes non-hook).
 */
export function getStatusLabel(status) {
  const uiLocale = localStorage.getItem('afrisupply_locale') || 'fr';

  const labels = {
    fr: {
      pending:    'En attente',
      confirmed:  'Confirmée',
      processing: 'En traitement',
      shipped:    'Expédiée',
      delivered:  'Livrée',
      cancelled:  'Annulée',
      paid:       'Payé',
      initiated:  'Initié',
      quoted:     'Devis reçu',
      accepted:   'Accepté',
      rejected:   'Refusé',
    },
    en: {
      pending:    'Pending',
      confirmed:  'Confirmed',
      processing: 'Processing',
      shipped:    'Shipped',
      delivered:  'Delivered',
      cancelled:  'Cancelled',
      paid:       'Paid',
      initiated:  'Initiated',
      quoted:     'Quote received',
      accepted:   'Accepted',
      rejected:   'Rejected',
    },
  };

  return (labels[uiLocale] || labels.fr)[status] || status;
}