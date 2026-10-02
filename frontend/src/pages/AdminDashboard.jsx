import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useLocale } from '../context/LocaleContext';
import { adminAPI, adminMgmtAPI } from '../lib/api';
import { toast } from 'sonner';

import AdminSidebar    from '../components/admin/AdminSidebar';
import AdminOverview   from '../components/admin/AdminOverview';
import SuppliersTab    from '../components/admin/SuppliersTab';
import ProductsTab     from '../components/admin/ProductsTab';
import OrdersTab       from '../components/admin/OrdersTab';
import UsersTab        from '../components/admin/UsersTab';
import MobileMoneyTab  from '../components/admin/MobileMoneyTab';
import BypassTab       from '../components/admin/BypassTab';
import EscrowTab       from '../components/admin/EscrowTab';
import ActualitesTab   from '../components/admin/ActualitesTab';
import AdminsTab       from '../components/admin/AdminsTab';
import LogsTab         from '../components/admin/LogsTab';

export default function AdminDashboard() {
  const { user, isAdmin, loading: authLoading, logout } = useAuth();
  const { t } = useLocale();
  const navigate = useNavigate();
  const [tab, setTab] = useState('overview');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const [stats,     setStats]     = useState(null);
  const [users,     setUsers]     = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [orders,    setOrders]    = useState([]);
  const [bypass,    setBypass]    = useState([]);
  const [escrows,   setEscrows]   = useState([]);
  const [disputes,  setDisputes]  = useState([]);
  const [products,  setProducts]  = useState([]);
  const [momo,      setMomo]      = useState([]);
  const [dataLoading, setDataLoading] = useState(true);
  const [actionId,  setActionId]  = useState(null);

  useEffect(() => {
    if (!authLoading && !isAdmin) navigate('/login', { replace: true });
  }, [authLoading, isAdmin, navigate]);

  const badges = {
    suppliers: suppliers.filter(s => s.account_status === 'pending_review').length,
    momo: momo.length,
  };

  const fetchAll = useCallback(async () => {
    if (!isAdmin || authLoading) return;
    setDataLoading(true);
    try {
      const results = await Promise.allSettled([
        adminAPI.getStats(),
        adminAPI.getUsers({ limit: 500 }),
        adminAPI.getUsers({ user_type: 'supplier', limit: 500 }),
        adminAPI.getAllOrders({ limit: 200 }),
        adminAPI.getBypassAttempts(),
        adminAPI.getEscrows(),
        adminAPI.getDisputes(),
        adminAPI.getAdminProducts({ limit: 200 }),
        adminAPI.getPendingMomo(),
      ]);
      if (results.every(r => r.status === 'rejected')) {
        toast.error(t('admin.load.connErr'));
      } else {
        if (results[0].status === 'fulfilled') setStats(results[0].value.data);
        if (results[1].status === 'fulfilled') setUsers(results[1].value.data || []);
        if (results[2].status === 'fulfilled') setSuppliers(results[2].value.data?.users || results[2].value.data || []);
        if (results[3].status === 'fulfilled') setOrders(results[3].value.data || []);
        if (results[4].status === 'fulfilled') setBypass(results[4].value.data || []);
        if (results[5].status === 'fulfilled') setEscrows(results[5].value.data || []);
        if (results[6].status === 'fulfilled') setDisputes(results[6].value.data || []);
        if (results[7].status === 'fulfilled') setProducts(results[7].value.data || []);
        if (results[8].status === 'fulfilled') setMomo(results[8].value.data || []);
      }
    } catch (e) {
      console.error('[Admin] fetchAll error:', e);
      toast.error(t('admin.load.unexpErr'));
    } finally {
      setDataLoading(false);
    }
  }, [isAdmin, authLoading, t]);

  useEffect(() => {
    if (!authLoading && isAdmin) fetchAll();
  }, [authLoading, isAdmin]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleApproveSupplier = useCallback(async (id) => {
    setActionId(id);
    try { await adminAPI.approveSupplier(id); toast.success(t('admin.approve')); setSuppliers(p => p.map(s => s.id === id ? { ...s, is_approved: true, account_status: 'active' } : s)); }
    catch (err) { toast.error(err.response?.data?.detail || 'Erreur'); }
    finally { setActionId(null); }
  }, [t]);

  const handleRejectSupplier = useCallback(async (id) => {
    setActionId(id);
    try { await adminAPI.rejectSupplier(id); toast.success(t('admin.reject')); setSuppliers(p => p.filter(s => s.id !== id)); }
    catch (err) { toast.error(err.response?.data?.detail || 'Erreur'); }
    finally { setActionId(null); }
  }, [t]);

  const handleConfirmMomo = useCallback(async (id) => {
    setActionId(id);
    try { await adminAPI.confirmMomo(id); toast.success(t('admin.momo.confirmed')); setMomo(p => p.filter(m => m.id !== id)); }
    catch (err) { toast.error(err.response?.data?.detail || 'Erreur'); }
    finally { setActionId(null); }
  }, [t]);

  const handleBadge = useCallback(async (supplierId, badge, action) => {
    setSuppliers(prev => prev.map(s => {
      if (s.id !== supplierId) return s;
      const current = Array.isArray(s.admin_badges) ? s.admin_badges : [];
      const updated = action === 'add' ? [...new Set([...current, badge])] : current.filter(b => b !== badge);
      return { ...s, admin_badges: updated };
    }));
    try { await adminMgmtAPI.setBadge(supplierId, badge, action); toast.success(action === 'add' ? `✓ ${badge}` : `✕ ${badge}`); }
    catch (err) {
      try { const res = await adminAPI.getUsers({ user_type: 'supplier', limit: 500 }); setSuppliers(res.data?.users || res.data || []); } catch { /* silencieux */ }
      toast.error(err.response?.data?.detail || 'Erreur badge');
    }
  }, []);

  const handleApproveProduct = useCallback(async (id) => {
    setActionId(id);
    try { await adminAPI.approveProduct(id); toast.success(t('admin.products.approve')); setProducts(p => p.map(x => x.id === id ? { ...x, is_approved: true } : x)); }
    catch (err) { toast.error(err.response?.data?.detail || 'Erreur'); }
    finally { setActionId(null); }
  }, [t]);

  const handleRejectProduct = useCallback(async (id) => {
    setActionId(id);
    try { await adminAPI.rejectProduct(id); toast.success(t('admin.products.reject')); setProducts(p => p.filter(x => x.id !== id)); }
    catch (err) { toast.error(err.response?.data?.detail || 'Erreur'); }
    finally { setActionId(null); }
  }, [t]);

  return (
    <div className="min-h-screen bg-slate-50 flex">
      <AdminSidebar active={tab} setActive={setTab} badges={badges} user={user} onLogout={logout}
        mobileOpen={mobileMenuOpen} onMobileClose={() => setMobileMenuOpen(false)} />
      <main className="flex-1 overflow-auto p-6">
        {tab === 'overview'   && <AdminOverview stats={stats} />}
        {tab === 'suppliers'  && <SuppliersTab suppliers={suppliers} onApprove={handleApproveSupplier} onReject={handleRejectSupplier} loadingId={actionId} onBadge={handleBadge} />}
        {tab === 'products'   && <ProductsTab products={products} onApprove={handleApproveProduct} onReject={handleRejectProduct} actionId={actionId} loading={dataLoading} />}
        {tab === 'orders'     && <OrdersTab orders={orders} loading={dataLoading} />}
        {tab === 'users'      && <UsersTab users={users} loading={dataLoading} onRefreshUsers={fetchAll} />}
        {tab === 'momo'       && <MobileMoneyTab items={momo} loading={dataLoading} onConfirm={handleConfirmMomo} confirmingId={actionId} />}
        {tab === 'bypass'     && <BypassTab attempts={bypass} loading={dataLoading} />}
        {tab === 'escrow'     && <EscrowTab escrows={escrows} disputes={disputes} loading={dataLoading} />}
        {tab === 'actualites' && <ActualitesTab />}
        {tab === 'admins'     && <AdminsTab currentAdminId={user?.id} />}
        {tab === 'logs'       && <LogsTab />}
      </main>
    </div>
  );
}
