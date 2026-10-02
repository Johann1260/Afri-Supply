import React from 'react';
import { CaretUp, CaretDown } from '@phosphor-icons/react';
import { useLocale } from '../../context/LocaleContext';

export const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000';

export const StatCard = ({ icon: Icon, label, value, color = 'primary', trend }) => {
  const colorMap = {
    primary: { bg: 'bg-primary/10', text: 'text-primary' },
    green:   { bg: 'bg-green-50',   text: 'text-green-600' },
    amber:   { bg: 'bg-amber-50',   text: 'text-amber-600' },
    red:     { bg: 'bg-red-50',     text: 'text-red-600' },
    blue:    { bg: 'bg-blue-50',    text: 'text-blue-600' },
  };
  const c = colorMap[color] || colorMap.primary;
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-6">
      <div className="flex items-center justify-between mb-4">
        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${c.bg}`}>
          <Icon className={`w-5 h-5 ${c.text}`} weight="duotone" />
        </div>
        {trend !== undefined && (
          <span className={`text-xs font-semibold flex items-center gap-0.5 ${trend >= 0 ? 'text-green-600' : 'text-red-500'}`}>
            {trend >= 0 ? <CaretUp className="w-3 h-3" weight="bold" /> : <CaretDown className="w-3 h-3" weight="bold" />}
            {Math.abs(trend)}%
          </span>
        )}
      </div>
      <p className="text-2xl font-bold text-slate-900">{value}</p>
      <p className="text-sm text-slate-500 mt-0.5">{label}</p>
    </div>
  );
};

export const StatusBadge = ({ status }) => {
  const { t } = useLocale();
  const map = {
    active:         ['bg-green-100 text-green-700',   t('admin.status.active')],
    pending_email:  ['bg-blue-100 text-blue-700',     t('admin.status.pending_email')],
    pending_review: ['bg-amber-100 text-amber-700',   t('admin.status.pending_review')],
    rejected:       ['bg-red-100 text-red-700',       t('admin.status.rejected')],
    inactive:       ['bg-slate-100 text-slate-500',   t('admin.status.inactive')],
    suspended:      ['bg-orange-100 text-orange-700', t('admin.status.suspended')],
    banned:         ['bg-red-200 text-red-800',       t('admin.status.banned')],
  };
  const [cls, lbl] = map[status] || ['bg-slate-100 text-slate-500', status];
  return <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${cls}`}>{lbl}</span>;
};

export const MediaIcon = ({ type }) => {
  if (type === 'image') return <span className="text-blue-500 text-sm">🖼</span>;
  if (type === 'video') return <span className="text-purple-500 text-sm">▶</span>;
  return <span className="text-red-500 text-sm">📄</span>;
};
