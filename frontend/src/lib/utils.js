import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs) {
  return twMerge(clsx(inputs));
}

export function formatPrice(price, currency = 'XAF') {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(price);
}

export function formatDate(dateString) {
  return new Date(dateString).toLocaleDateString('fr-FR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

export function truncateText(text, maxLength = 100) {
  if (!text || text.length <= maxLength) return text;
  return text.substring(0, maxLength) + '...';
}

export function getStatusColor(status) {
  const colors = {
    pending: 'bg-yellow-100 text-yellow-800 border-yellow-200',
    confirmed: 'bg-blue-100 text-blue-800 border-blue-200',
    processing: 'bg-purple-100 text-purple-800 border-purple-200',
    shipped: 'bg-indigo-100 text-indigo-800 border-indigo-200',
    delivered: 'bg-green-100 text-green-800 border-green-200',
    cancelled: 'bg-red-100 text-red-800 border-red-200',
    paid: 'bg-green-100 text-green-800 border-green-200',
  };
  return colors[status] || 'bg-slate-100 text-slate-800 border-slate-200';
}

export function getStatusLabel(status) {
  const labels = {
    pending: 'En attente',
    confirmed: 'Confirmé',
    processing: 'En traitement',
    shipped: 'Expédié',
    delivered: 'Livré',
    cancelled: 'Annulé',
    paid: 'Payé',
    initiated: 'Initié',
  };
  return labels[status] || status;
}
