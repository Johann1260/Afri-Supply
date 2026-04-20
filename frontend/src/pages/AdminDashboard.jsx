import React, { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Users, Package, ShoppingCart, TrendUp, ShieldWarning,
  CheckCircle, XCircle, Eye, ArrowLeft, Bell, SignOut,
  Buildings, Clock, Warning, ChartBar, FileText,
  MagnifyingGlass, CaretDown, CaretUp, DownloadSimple,
  Envelope, Phone, MapPin, Calendar
} from '@phosphor-icons/react';
import { useAuth } from '../context/AuthContext';
import { adminAPI } from '../lib/api';
import { formatPrice, formatDate, getStatusColor, getStatusLabel } from '../lib/utils';
import { toast } from 'sonner';
import { Toaster } from '../components/ui/sonner';

// ── Stat Card ──────────────────────────────────────────────────────────────────
const StatCard = ({ icon: Icon, label, value, color = 'primary', trend }) => {
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

const StatusBadge = ({ status }) => {
  const map = {
    active:         ['bg-green-100 text-green-700',   'Actif'],
    pending_email:  ['bg-blue-100 text-blue-700',     'Email en attente'],
    pending_review: ['bg-amber-100 text-amber-700',   'En attente'],
    rejected:       ['bg-red-100 text-red-700',       'Rejeté'],
    inactive:       ['bg-slate-100 text-slate-500',   'Inactif'],
    suspended:      ['bg-orange-100 text-orange-700', 'Suspendu'],
    banned:         ['bg-red-200 text-red-800',       'Banni'],
  };
  const [cls, lbl] = map[status] || ['bg-slate-100 text-slate-500', status];
  return <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${cls}`}>{lbl}</span>;
};

// ── Sidebar ────────────────────────────────────────────────────────────────────
const TABS = [
  { id: 'overview',  icon: ChartBar,       label: 'Vue d\'ensemble' },
  { id: 'suppliers', icon: Buildings,      label: 'Fournisseurs',   hasBadge: true },
  { id: 'users',     icon: Users,          label: 'Utilisateurs' },
  { id: 'orders',    icon: ShoppingCart,   label: 'Commandes' },
  { id: 'bypass',    icon: ShieldWarning,  label: 'Anti-bypass' },
];

const Sidebar = ({ active, setActive, pendingCount, user, onLogout }) => (
  <aside className="w-60 bg-primary flex flex-col min-h-screen flex-shrink-0">
    <div className="p-5 border-b border-white/10">
      <div className="flex items-center gap-2.5">
        <div className="w-8 h-8 bg-accent rounded-lg flex items-center justify-center">
          <ShieldWarning className="w-4 h-4 text-white" weight="fill" />
        </div>
        <div>
          <p className="font-bold text-white text-sm leading-tight">AfriSupply</p>
          <p className="text-white/40 text-xs">Administration</p>
        </div>
      </div>
    </div>

    <nav className="flex-1 p-3 space-y-0.5">
      {TABS.map(({ id, icon: Icon, label, hasBadge }) => (
        <button
          key={id}
          onClick={() => setActive(id)}
          className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
            active === id
              ? 'bg-white/15 text-white'
              : 'text-white/55 hover:text-white hover:bg-white/8'
          }`}
        >
          <Icon className="w-4 h-4 flex-shrink-0" weight={active === id ? 'fill' : 'regular'} />
          <span className="flex-1 text-left">{label}</span>
          {hasBadge && pendingCount > 0 && (
            <span className="bg-accent text-white text-[10px] font-bold rounded-full w-5 h-5 flex items-center justify-center">
              {pendingCount > 9 ? '9+' : pendingCount}
            </span>
          )}
        </button>
      ))}
    </nav>

    <div className="p-4 border-t border-white/10">
      <div className="flex items-center gap-2.5 mb-3">
        <div className="w-8 h-8 bg-white/10 rounded-full flex items-center justify-center">
          <Users className="w-4 h-4 text-white/70" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-white text-xs font-semibold truncate">{user?.full_name}</p>
          <p className="text-white/40 text-[10px]">Admin</p>
        </div>
      </div>
      <div className="flex gap-2">
        <Link
          to="/"
          className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white/70 hover:text-white text-xs transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Site
        </Link>
        <button
          onClick={onLogout}
          className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg bg-white/10 hover:bg-red-500/30 text-white/70 hover:text-white text-xs transition-colors"
        >
          <SignOut className="w-3.5 h-3.5" />
          Quitter
        </button>
      </div>
    </div>
  </aside>
);

// ── Overview ───────────────────────────────────────────────────────────────────
const Overview = ({ stats }) => {
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
        <StatCard icon={Users}        label="Utilisateurs total"    value={stats.total_users ?? 0}      color="primary" trend={12} />
        <StatCard icon={Buildings}    label="Fournisseurs actifs"   value={stats.active_suppliers ?? 0} color="green"   trend={8}  />
        <StatCard icon={ShoppingCart} label="Commandes totales"     value={stats.total_orders ?? 0}     color="blue"    trend={23} />
        <StatCard icon={TrendUp}      label="Revenus"               value={formatPrice(stats.total_revenue ?? 0)} color="green" trend={15} />
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={Clock}         label="En attente validation" value={stats.pending_suppliers ?? 0} color="amber" />
        <StatCard icon={ShieldWarning} label="Tentatives bypass"     value={stats.bypass_attempts ?? 0}  color="red"   />
        <StatCard icon={Package}       label="Produits publiés"      value={stats.total_products ?? 0}   color="primary" />
        <StatCard icon={FileText}      label="RFQs actives"          value={stats.active_rfqs ?? 0}      color="blue"  />
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
                   item.type === 'user'  ? <Users className="w-4 h-4 text-green-500" />       :
                   <Bell className="w-4 h-4 text-slate-400" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-slate-800">{item.message}</p>
                  <p className="text-xs text-slate-400">{formatDate(item.created_at)}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

// ── Suppliers ──────────────────────────────────────────────────────────────────
const SuppliersTab = ({ suppliers, onApprove, onReject, loadingId }) => (
  <div className="space-y-5">
    <div className="flex items-center justify-between">
      <h2 className="text-base font-bold text-slate-900">Fournisseurs en attente</h2>
      <span className="px-3 py-1 bg-amber-100 text-amber-700 text-sm font-semibold rounded-full">
        {suppliers.length} dossier{suppliers.length !== 1 ? 's' : ''}
      </span>
    </div>

    {suppliers.length === 0 ? (
      <div className="bg-white border border-slate-200 rounded-xl p-16 text-center">
        <CheckCircle className="w-12 h-12 mx-auto text-green-400 mb-3" weight="fill" />
        <p className="font-semibold text-slate-600">Aucun dossier en attente</p>
        <p className="text-sm text-slate-400 mt-1">Tous les fournisseurs ont été traités.</p>
      </div>
    ) : suppliers.map((s) => (
      <div key={s.id} className="bg-white border border-slate-200 rounded-xl p-6">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 bg-primary/8 rounded-xl flex items-center justify-center flex-shrink-0">
            <Buildings className="w-6 h-6 text-primary" weight="duotone" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <h3 className="font-bold text-slate-900">{s.company_name || s.full_name}</h3>
              <StatusBadge status={s.account_status} />
            </div>
            <div className="grid grid-cols-2 gap-x-6 gap-y-1 mt-2 text-xs text-slate-500">
              {s.email    && <span className="flex items-center gap-1"><Envelope className="w-3 h-3" />{s.email}</span>}
              {s.phone    && <span className="flex items-center gap-1"><Phone className="w-3 h-3" />{s.phone}</span>}
              {s.city     && <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{s.city}, {s.country}</span>}
              <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />Inscrit le {formatDate(s.created_at)}</span>
            </div>

            {s.company_documents?.length > 0 && (
              <div className="mt-3">
                <p className="text-xs font-semibold text-slate-600 mb-1.5">
                  {s.company_documents.length} document{s.company_documents.length !== 1 ? 's' : ''} soumis :
                </p>
                <div className="flex flex-wrap gap-2">
                  {s.company_documents.map((doc, i) => (
                    <a
                      key={i}
                      href={`${process.env.REACT_APP_BACKEND_URL || 'http://localhost:8000'}${doc}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg text-xs font-medium transition-colors"
                    >
                      <FileText className="w-3.5 h-3.5 text-red-500" />
                      Document {i + 1}
                    </a>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="flex gap-2 flex-shrink-0 pt-1">
            <button
              onClick={() => onReject(s.id)}
              disabled={loadingId === s.id}
              className="flex items-center gap-1.5 px-4 py-2 border border-red-200 text-red-600 hover:bg-red-50 rounded-lg text-sm font-medium transition-colors disabled:opacity-40"
            >
              <XCircle className="w-4 h-4" />
              Rejeter
            </button>
            <button
              onClick={() => onApprove(s.id)}
              disabled={loadingId === s.id}
              className="flex items-center gap-1.5 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-40"
            >
              <CheckCircle className="w-4 h-4" />
              {loadingId === s.id ? 'Traitement...' : 'Approuver'}
            </button>
          </div>
        </div>
      </div>
    ))}
  </div>
);

// ── Users ──────────────────────────────────────────────────────────────────────
const UsersTab = ({ users, loading }) => {
  const [search, setSearch]     = useState('');
  const [typeFilter, setTypeFilter] = useState('all');

  const filtered = users.filter((u) => {
    const q = search.toLowerCase();
    const match = !q || u.full_name?.toLowerCase().includes(q) || u.email?.toLowerCase().includes(q) || u.company_name?.toLowerCase().includes(q);
    const typeOk = typeFilter === 'all' || u.user_type === typeFilter;
    return match && typeOk;
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <h2 className="text-base font-bold text-slate-900 flex-1">Utilisateurs ({users.length})</h2>
        <div className="relative">
          <MagnifyingGlass className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher..."
            className="pl-9 pr-4 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-primary w-52"
          />
        </div>
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-primary"
        >
          <option value="all">Tous</option>
          <option value="buyer">Acheteurs</option>
          <option value="supplier">Fournisseurs</option>
          <option value="admin">Admins</option>
        </select>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <table className="w-full">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              {['Utilisateur', 'Type', 'Statut', 'Localisation', 'Inscrit le'].map((h) => (
                <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading ? [...Array(6)].map((_, i) => (
              <tr key={i}>{[...Array(5)].map((_, j) => (
                <td key={j} className="px-4 py-4"><div className="h-4 bg-slate-100 rounded animate-pulse" /></td>
              ))}</tr>
            )) : filtered.length === 0 ? (
              <tr><td colSpan={5} className="px-4 py-12 text-center text-slate-400 text-sm">Aucun résultat</td></tr>
            ) : filtered.map((u) => (
              <tr key={u.id} className="hover:bg-slate-50/50">
                <td className="px-4 py-4">
                  <p className="font-medium text-slate-900 text-sm">{u.full_name}</p>
                  <p className="text-xs text-slate-400">{u.email}</p>
                  {u.company_name && <p className="text-xs text-slate-500 mt-0.5">{u.company_name}</p>}
                </td>
                <td className="px-4 py-4">
                  <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                    u.user_type === 'supplier' ? 'bg-blue-50 text-blue-700' :
                    u.user_type === 'admin'    ? 'bg-purple-50 text-purple-700' :
                    'bg-slate-100 text-slate-600'
                  }`}>
                    {u.user_type === 'supplier' ? 'Fournisseur' : u.user_type === 'admin' ? 'Admin' : 'Acheteur'}
                  </span>
                </td>
                <td className="px-4 py-4"><StatusBadge status={u.account_status || 'active'} /></td>
                <td className="px-4 py-4 text-sm text-slate-500">
                  {u.city ? `${u.city}, ` : ''}{u.country || '—'}
                </td>
                <td className="px-4 py-4 text-xs text-slate-400">{formatDate(u.created_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

// ── Orders ─────────────────────────────────────────────────────────────────────
const OrdersTab = ({ orders, loading }) => {
  const [statusFilter, setStatusFilter] = useState('all');
  const filtered = statusFilter === 'all' ? orders : orders.filter((o) => o.status === statusFilter);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <h2 className="text-base font-bold text-slate-900 flex-1">Toutes les commandes ({orders.length})</h2>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-primary"
        >
          <option value="all">Tous les statuts</option>
          {['pending','confirmed','processing','shipped','delivered','cancelled'].map((s) => (
            <option key={s} value={s}>{getStatusLabel(s)}</option>
          ))}
        </select>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <table className="w-full">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              {['N° commande','Acheteur','Fournisseur','Total','Statut','Paiement','Date'].map((h) => (
                <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading ? [...Array(8)].map((_, i) => (
              <tr key={i}>{[...Array(7)].map((_, j) => (
                <td key={j} className="px-4 py-4"><div className="h-4 bg-slate-100 rounded animate-pulse" /></td>
              ))}</tr>
            )) : filtered.length === 0 ? (
              <tr><td colSpan={7} className="px-4 py-12 text-center text-slate-400 text-sm">Aucune commande</td></tr>
            ) : filtered.map((o) => (
              <tr key={o.id} className="hover:bg-slate-50/50">
                <td className="px-4 py-3">
                  <p className="font-mono text-xs text-slate-700 font-medium">{o.order_number}</p>
                </td>
                <td className="px-4 py-3 text-sm text-slate-700">{o.buyer_name}</td>
                <td className="px-4 py-3 text-sm text-slate-700">{o.supplier_name}</td>
                <td className="px-4 py-3 text-sm font-semibold text-slate-900">{formatPrice(o.total)}</td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${getStatusColor(o.status)}`}>
                    {getStatusLabel(o.status)}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${getStatusColor(o.payment_status)}`}>
                    {o.payment_status === 'paid' ? 'Payé' : 'En attente'}
                  </span>
                </td>
                <td className="px-4 py-3 text-xs text-slate-400">{formatDate(o.created_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

// ── Bypass ─────────────────────────────────────────────────────────────────────
const BypassTab = ({ attempts, loading }) => (
  <div className="space-y-4">
    <div className="flex items-center gap-3">
      <h2 className="text-base font-bold text-slate-900 flex-1">Tentatives de contournement</h2>
      {attempts.length > 0 && (
        <span className="px-3 py-1 bg-red-100 text-red-700 text-sm font-semibold rounded-full">
          {attempts.length} détectée{attempts.length !== 1 ? 's' : ''}
        </span>
      )}
    </div>

    <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
      <Warning className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" weight="fill" />
      <p className="text-sm text-amber-800">
        <strong>Moteur anti-bypass actif.</strong> Tout message contenant un numéro, email,
        lien ou phrase de contournement est bloqué et enregistré ici pour audit.
      </p>
    </div>

    {loading ? (
      <div className="space-y-3">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="bg-white border border-slate-200 rounded-xl p-5 animate-pulse">
            <div className="h-4 bg-slate-200 rounded w-1/3 mb-2" />
            <div className="h-3 bg-slate-100 rounded w-2/3" />
          </div>
        ))}
      </div>
    ) : attempts.length === 0 ? (
      <div className="bg-white border border-slate-200 rounded-xl p-16 text-center">
        <ShieldWarning className="w-12 h-12 mx-auto text-green-400 mb-3" weight="fill" />
        <p className="font-semibold text-slate-600">Aucune tentative détectée</p>
        <p className="text-sm text-slate-400 mt-1">Tous les utilisateurs respectent les règles de la plateforme.</p>
      </div>
    ) : (
      <div className="space-y-3">
        {attempts.map((a, i) => (
          <div key={a.id || i} className="bg-white border border-red-100 rounded-xl p-5">
            <div className="flex items-center gap-2 mb-3">
              <span className="px-2 py-0.5 bg-red-100 text-red-700 text-xs font-bold rounded uppercase tracking-wide">
                {(a.reason || 'bypass').replace(/_/g, ' ')}
              </span>
              <span className="text-xs text-slate-400">{formatDate(a.created_at)}</span>
              {a.channel && (
                <span className="px-2 py-0.5 bg-slate-100 text-slate-600 text-xs rounded">
                  {a.channel === 'ws_bypass' ? 'WebSocket' : 'REST'}
                </span>
              )}
            </div>
            <div className="bg-red-50 border border-red-100 rounded-lg px-4 py-3 mb-3">
              <p className="text-sm text-slate-700 font-mono break-all leading-relaxed">{a.original_content}</p>
            </div>
            <div className="flex gap-6 text-xs text-slate-400">
              <span>Expéditeur : <span className="font-semibold text-slate-600 font-mono">{a.user_id?.slice(0, 8).toUpperCase()}</span></span>
              <span>Destinataire : <span className="font-semibold text-slate-600 font-mono">{a.target_id?.slice(0, 8).toUpperCase()}</span></span>
            </div>
          </div>
        ))}
      </div>
    )}
  </div>
);

// ── Page principale ────────────────────────────────────────────────────────────
export default function AdminDashboard() {
  const { user, isAdmin, loading: authLoading, logout } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState('overview');

  const [stats,     setStats]     = useState(null);
  const [users,     setUsers]     = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [orders,    setOrders]    = useState([]);
  const [bypass,    setBypass]    = useState([]);
  const [dataLoading, setDataLoading] = useState(true);
  const [actionId,  setActionId]  = useState(null);

  useEffect(() => {
    if (!authLoading && !isAdmin) navigate('/login', { replace: true });
  }, [authLoading, isAdmin, navigate]);

  const fetchAll = useCallback(async () => {
    if (!isAdmin) return;
    setDataLoading(true);
    const results = await Promise.allSettled([
      adminAPI.getStats(),
      adminAPI.getUsers({ limit: 500 }),
      adminAPI.getPendingSuppliers(),
      adminAPI.getAllOrders({ limit: 200 }),
      adminAPI.getBypassAttempts(),
    ]);
    if (results[0].status === 'fulfilled') setStats(results[0].value.data);
    if (results[1].status === 'fulfilled') setUsers(results[1].value.data || []);
    if (results[2].status === 'fulfilled') setSuppliers(results[2].value.data || []);
    if (results[3].status === 'fulfilled') setOrders(results[3].value.data || []);
    if (results[4].status === 'fulfilled') setBypass(results[4].value.data || []);
    setDataLoading(false);
  }, [isAdmin]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const handleApprove = async (id) => {
    setActionId(id);
    try {
      await adminAPI.approveSupplier(id);
      toast.success('Fournisseur approuvé — email de confirmation envoyé');
      setSuppliers((p) => p.filter((s) => s.id !== id));
      setStats((p) => p ? { ...p, pending_suppliers: (p.pending_suppliers || 1) - 1, active_suppliers: (p.active_suppliers || 0) + 1 } : p);
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Erreur lors de l\'approbation');
    } finally {
      setActionId(null);
    }
  };

  const handleReject = async (id) => {
    if (!window.confirm('Rejeter ce fournisseur ? Un email de notification lui sera envoyé.')) return;
    setActionId(id);
    try {
      await adminAPI.rejectSupplier(id);
      toast.success('Fournisseur rejeté');
      setSuppliers((p) => p.filter((s) => s.id !== id));
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Erreur');
    } finally {
      setActionId(null);
    }
  };

  if (authLoading) return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
    </div>
  );

  if (!isAdmin) return null;

  return (
    <div className="min-h-screen flex bg-slate-50">
      <Sidebar
        active={tab}
        setActive={setTab}
        pendingCount={suppliers.length}
        user={user}
        onLogout={() => { logout(); navigate('/'); }}
      />

      <main className="flex-1 overflow-auto">
        {/* Header */}
        <div className="bg-white border-b border-slate-200 px-8 py-4 flex items-center justify-between sticky top-0 z-10">
          <div>
            <h1 className="text-lg font-bold text-slate-900">
              {TABS.find((t) => t.id === tab)?.label}
            </h1>
            <p className="text-xs text-slate-400 mt-0.5">Panneau d'administration AfriSupply</p>
          </div>
          <button
            onClick={fetchAll}
            className="flex items-center gap-2 px-4 py-2 border border-slate-200 rounded-lg text-sm text-slate-600 hover:bg-slate-50 transition-colors"
          >
            Actualiser
          </button>
        </div>

        {/* Content */}
        <div className="p-8">
          {tab === 'overview'  && <Overview stats={stats} />}
          {tab === 'suppliers' && <SuppliersTab suppliers={suppliers} onApprove={handleApprove} onReject={handleReject} loadingId={actionId} />}
          {tab === 'users'     && <UsersTab users={users} loading={dataLoading} />}
          {tab === 'orders'    && <OrdersTab orders={orders} loading={dataLoading} />}
          {tab === 'bypass'    && <BypassTab attempts={bypass} loading={dataLoading} />}
        </div>
      </main>

      <Toaster position="top-right" richColors />
    </div>
  );
}