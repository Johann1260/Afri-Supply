import React from 'react';
import {
  Users, Buildings, ShoppingCart, TrendUp, Clock, ShieldWarning,
  Package, FileText, Bell,
} from '@phosphor-icons/react';
import { useLocale } from '../../context/LocaleContext';
import { formatPrice, formatDate } from '../../lib/utils';
import { StatCard } from './shared';

const AdminOverview = ({ stats }) => {
  const { t } = useLocale();
  if (!stats) return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {[...Array(8)].map((_, i) => (
        <div key={i} className="bg-white border border-slate-200 rounded-xl p-6 animate-pulse">
          <div className="w-10 h-10 bg-slate-100 rounded-lg mb-4" />
          <div className="h-6 bg-slate-100 rounded w-16 mb-1" />
          <div className="h-4 bg-slate-100 rounded w-24" />
        </div>
      ))}
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={Users}        label={t('admin.kpi.users')}    value={stats.total_users ?? 0}      color="primary" trend={12} />
        <StatCard icon={Buildings}    label={t('admin.kpi.suppliers')} value={stats.active_suppliers ?? 0} color="green"   trend={8}  />
        <StatCard icon={ShoppingCart} label={t('admin.kpi.orders')}   value={stats.total_orders ?? 0}     color="blue"    trend={23} />
        <StatCard icon={TrendUp}      label={t('admin.kpi.revenue')}  value={formatPrice(stats.total_revenue ?? 0)} color="green" trend={15} />
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={Clock}         label={t('admin.kpi.pending')}  value={stats.pending_suppliers ?? 0} color="amber" />
        <StatCard icon={ShieldWarning} label={t('admin.kpi.bypass')}   value={stats.bypass_attempts ?? 0}  color="red"   />
        <StatCard icon={Package}       label={t('admin.kpi.products')} value={stats.total_products ?? 0}   color="primary" />
        <StatCard icon={FileText}      label={t('admin.kpi.rfqs')}     value={stats.active_rfqs ?? 0}      color="blue"  />
      </div>
      {stats.recent_activity?.length > 0 && (
        <div>
          <h3 className="text-sm font-bold text-slate-700 mb-3 uppercase tracking-wide">Activité récente</h3>
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            {stats.recent_activity.slice(0, 8).map((item, i) => (
              <div key={i} className={`flex items-center gap-4 px-5 py-3.5 ${i < stats.recent_activity.length - 1 ? 'border-b border-slate-100' : ''}`}>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                  item.type === 'order' ? 'bg-blue-50' : item.type === 'user' ? 'bg-green-50' : 'bg-slate-100'
                }`}>
                  {item.type === 'order' ? <ShoppingCart className="w-4 h-4 text-blue-500" /> :
                   item.type === 'user'  ? <Users className="w-4 h-4 text-green-500" /> :
                   <Bell className="w-4 h-4 text-slate-400" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-slate-800">{item.title || item.message}</p>
                  <p className="text-xs text-slate-500">{item.description}</p>
                  <p className="text-xs text-slate-400">{formatDate(item.time || item.created_at)}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminOverview;
