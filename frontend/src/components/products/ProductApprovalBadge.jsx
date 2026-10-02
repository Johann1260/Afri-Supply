import React from 'react';
import { Clock, CheckCircle2, XCircle } from 'lucide-react';
import { useLocale } from '@/context/LocaleContext';

/**
 * Badge d'approbation produit (visible uniquement par le supplier propriétaire et l'admin).
 * - is_approved === true  → "Publié" (vert)
 * - is_approved === false → "En attente d'approbation" (orange)
 * - is_available === false && is_approved === false → "Rejeté" (gris)
 */
export default function ProductApprovalBadge({ product, className = '' }) {
  const { t } = useLocale();
  if (!product || product.is_approved === undefined) return null;

  const rejected = product.is_approved === false && product.is_available === false;
  const pending = product.is_approved === false && !rejected;

  const cfg = rejected
    ? { Icon: XCircle, label: t('product.status.rejected'), cls: 'bg-gray-100 text-gray-700 border-gray-300' }
    : pending
      ? { Icon: Clock, label: t('product.status.pending'), cls: 'bg-orange-50 text-orange-700 border-orange-200' }
      : { Icon: CheckCircle2, label: t('product.status.approved'), cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' };

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium ${cfg.cls} ${className}`}
      role="status"
      aria-label={cfg.label}
    >
      <cfg.Icon className="h-3 w-3" aria-hidden="true" />
      {cfg.label}
    </span>
  );
}
