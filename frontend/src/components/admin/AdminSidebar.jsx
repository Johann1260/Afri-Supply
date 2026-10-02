import React from 'react';
import {
  Users, Package, ShoppingCart, ShieldWarning, Buildings, ChartBar,
  FileText, Newspaper, List, Wallet, SignOut, Bell,
} from '@phosphor-icons/react';
import { useLocale } from '../../context/LocaleContext';

const TABS = [
  { id: 'overview',   icon: ChartBar,      labelKey: 'admin.tab.overview' },
  { id: 'suppliers',  icon: Buildings,     labelKey: 'admin.tab.suppliers',  badgeKey: 'suppliers' },
  { id: 'products',   icon: Package,       labelKey: 'admin.tab.products' },
  { id: 'users',      icon: Users,         labelKey: 'admin.tab.users' },
  { id: 'orders',     icon: ShoppingCart,  labelKey: 'admin.tab.orders' },
  { id: 'momo',       icon: Wallet,        labelKey: 'admin.tab.momo',       badgeKey: 'momo' },
  { id: 'bypass',     icon: ShieldWarning, labelKey: 'admin.tab.bypass' },
  { id: 'escrow',     icon: ShieldWarning, labelKey: 'admin.tab.escrow' },
  { id: 'actualites', icon: Newspaper,     labelKey: 'admin.tab.actualites' },
  { id: 'admins',     icon: Users,         labelKey: 'admin.tab.admins' },
  { id: 'logs',       icon: List,          labelKey: 'admin.tab.logs' },
];

const SidebarContent = ({ active, setActive, badges, user, onLogout, onClose }) => {
  const { t } = useLocale();
  return (
    <div className="flex flex-col h-full">
      <div className="px-4 py-5 border-b border-white/10">
        <p className="text-white font-bold text-lg">AfriSupply</p>
        <p className="text-white/60 text-xs mt-0.5">Admin Panel</p>
      </div>
      <nav className="flex-1 py-3 overflow-y-auto">
        {TABS.map(({ id, icon: Icon, labelKey, badgeKey }) => {
          const count = badgeKey ? (badges[badgeKey] || 0) : 0;
          return (
            <button
              key={id}
              onClick={() => { setActive(id); onClose?.(); }}
              className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm font-medium transition-colors ${
                active === id ? 'bg-white/20 text-white' : 'text-white/70 hover:bg-white/10 hover:text-white'
              }`}
            >
              <Icon className="w-4 h-4 flex-shrink-0" weight={active === id ? 'fill' : 'regular'} />
              <span className="flex-1 text-left">{t(labelKey)}</span>
              {count > 0 && (
                <span className="bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center">
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </nav>
      <div className="px-4 py-4 border-t border-white/10">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center shrink-0">
            <span className="text-white text-sm font-bold">{user?.full_name?.[0]?.toUpperCase()}</span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-white text-xs font-semibold truncate">{user?.full_name}</p>
            <p className="text-white/50 text-[10px] truncate">{user?.email}</p>
          </div>
        </div>
        <button
          onClick={onLogout}
          className="w-full flex items-center gap-2 text-white/70 hover:text-white text-xs py-1.5 transition-colors"
        >
          <SignOut className="w-4 h-4" />
          {t('admin.logout')}
        </button>
      </div>
    </div>
  );
};

const AdminSidebar = ({ active, setActive, badges, user, onLogout, mobileOpen, onMobileClose }) => (
  <>
    <aside className="hidden lg:flex w-60 bg-primary flex-col min-h-screen flex-shrink-0">
      <SidebarContent active={active} setActive={setActive} badges={badges} user={user} onLogout={onLogout} />
    </aside>
    {mobileOpen && (
      <div className="lg:hidden fixed inset-0 z-50 flex">
        <div className="fixed inset-0 bg-black/50" onClick={onMobileClose} aria-hidden="true" />
        <aside className="relative w-72 bg-primary flex flex-col h-full z-10 shadow-2xl">
          <SidebarContent active={active} setActive={setActive} badges={badges} user={user} onLogout={onLogout} onClose={onMobileClose} />
        </aside>
      </div>
    )}
  </>
);

export default AdminSidebar;
