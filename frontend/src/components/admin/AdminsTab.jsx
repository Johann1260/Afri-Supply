import React from 'react';
import { useLocale } from '../../context/LocaleContext';
import { adminMgmtAPI } from '../../lib/api';
import { toast } from 'sonner';

const ROLE_KEYS = ['superadmin', 'moderator', 'support', 'finance'];
const ROLE_COLORS = {
  superadmin: 'bg-purple-100 text-purple-700',
  moderator:  'bg-blue-100 text-blue-700',
  support:    'bg-green-100 text-green-700',
  finance:    'bg-amber-100 text-amber-700',
};

const AdminsTab = ({ currentAdminId }) => {
  const { t } = useLocale();
  const ROLES = React.useMemo(() => ROLE_KEYS.map(v => ({
    value: v,
    label: t(`admin.admins.role.${v}`),
    desc:  t(`admin.admins.desc.${v}`),
  // eslint-disable-next-line react-hooks/exhaustive-deps
  })), [t]);
  const [admins, setAdmins]     = React.useState([]);
  const [loading, setLoading]   = React.useState(true);
  const [showForm, setShowForm] = React.useState(false);
  const [saving, setSaving]     = React.useState(false);
  const [form, setForm]         = React.useState({ full_name: '', email: '', password: '', admin_role: 'superadmin' });
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const load = React.useCallback(async () => {
    setLoading(true);
    try { const r = await adminMgmtAPI.listAdmins(); setAdmins(r.data || []); }
    catch { toast.error(t('admin.admins.loadErr')); }
    finally { setLoading(false); }
  }, [t]);
  React.useEffect(() => { load(); }, [load]);

  async function handleCreate(e) {
    e.preventDefault();
    if (!form.full_name || !form.email || !form.password) return toast.error(t('admin.admins.err_required'));
    if (form.password.length < 8) return toast.error(t('admin.admins.err_password'));
    setSaving(true);
    try {
      await adminMgmtAPI.createAdmin(form);
      toast.success(t('admin.admins.created'));
      setShowForm(false);
      setForm({ full_name: '', email: '', password: '', admin_role: 'superadmin' });
      load();
    } catch (err) { toast.error(err.response?.data?.detail || 'Erreur'); }
    finally { setSaving(false); }
  }

  async function handleDeactivate(admin) {
    if (!window.confirm(`${t('admin.admins.deactivate_confirm')} ${admin.full_name} ?`)) return;
    try { await adminMgmtAPI.deactivateAdmin(admin.id); toast.success(t('admin.admins.deactivate')); load(); }
    catch (err) { toast.error(err.response?.data?.detail || 'Erreur'); }
  }

  async function handleRoleChange(admin, newRole) {
    const roleLabel = ROLES.find(r => r.value === newRole)?.label || newRole;
    if (!window.confirm(`${t('admin.admins.role_confirm')} ${admin.full_name} → "${roleLabel}" ?`)) return;
    try { await adminMgmtAPI.updateAdmin(admin.id, { admin_role: newRole }); toast.success(t('admin.admins.role_updated')); load(); }
    catch { toast.error('Erreur'); }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-bold text-slate-900">{t('admin.admins.title')} ({admins.length})</h2>
        <button onClick={() => setShowForm(v => !v)}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg text-sm font-semibold hover:bg-primary/90">
          {t('admin.admins.add')}
        </button>
      </div>

      {showForm && (
        <div className="bg-white border border-slate-200 rounded-xl p-6">
          <h3 className="text-sm font-bold text-slate-800 mb-4">{t('admin.admins.new_account')}</h3>
          <form onSubmit={handleCreate} className="space-y-3">
            <div className="grid sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-slate-600 block mb-1">{t('admin.admins.full_name')}</label>
                <input className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/30"
                  value={form.full_name} onChange={e => set('full_name', e.target.value)} required />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-600 block mb-1">{t('admin.admins.email')}</label>
                <input type="email" className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/30"
                  value={form.email} onChange={e => set('email', e.target.value)} required />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-600 block mb-1">{t('admin.admins.password')}</label>
                <input type="password" className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/30"
                  value={form.password} onChange={e => set('password', e.target.value)} required minLength={8} />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-600 block mb-1">{t('admin.admins.role')}</label>
                <select className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/30"
                  value={form.admin_role} onChange={e => set('admin_role', e.target.value)}>
                  {ROLES.map(r => <option key={r.value} value={r.value}>{r.label} — {r.desc}</option>)}
                </select>
              </div>
            </div>
            <div className="flex gap-2 pt-1">
              <button type="button" onClick={() => setShowForm(false)}
                className="px-4 py-2 border border-slate-200 rounded-lg text-sm text-slate-600 hover:bg-slate-50">{t('admin.admins.cancel')}</button>
              <button type="submit" disabled={saving}
                className="px-5 py-2 bg-primary text-white rounded-lg text-sm font-semibold hover:bg-primary/90 disabled:opacity-60">
                {saving ? t('admin.admins.creating') : t('admin.admins.create')}
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-slate-400">Chargement…</div>
        ) : (
          <div className="divide-y divide-slate-100">
            {admins.map(a => (
              <div key={a.id} className="px-6 py-4 flex items-center gap-4">
                <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center shrink-0">
                  <span className="text-primary font-bold text-sm">{a.full_name?.[0]?.toUpperCase()}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-semibold text-slate-900 text-sm">{a.full_name}</p>
                    {a.id === currentAdminId && <span className="px-1.5 py-0.5 bg-blue-100 text-blue-600 text-xs rounded">{t('admin.admins.you')}</span>}
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${ROLE_COLORS[a.admin_role] || 'bg-slate-100 text-slate-600'}`}>
                      {ROLES.find(r => r.value === a.admin_role)?.label || a.admin_role}
                    </span>
                    <span className={`px-1.5 py-0.5 rounded text-xs ${a.account_status === 'active' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'}`}>
                      {a.account_status === 'active' ? t('admin.status.active') : t('admin.status.suspended')}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">{a.email}</p>
                  <p className="text-xs text-slate-400">{t('admin.admins.created_on')} {a.created_at?.slice(0, 10)}</p>
                </div>
                {a.id !== currentAdminId && (
                  <div className="flex items-center gap-2 shrink-0">
                    <select value={a.admin_role || 'superadmin'} onChange={e => handleRoleChange(a, e.target.value)}
                      className="border border-slate-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none">
                      {ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                    </select>
                    {a.account_status === 'active' ? (
                      <button onClick={() => handleDeactivate(a)}
                        className="px-3 py-1.5 bg-red-100 text-red-600 rounded-lg text-xs font-medium hover:bg-red-200">
                        {t('admin.admins.deactivate')}
                      </button>
                    ) : (
                      <button onClick={async () => { try { await adminMgmtAPI.updateAdmin(a.id, { is_active: true }); toast.success(t('admin.admins.reactivate')); load(); } catch { toast.error('Erreur'); } }}
                        className="px-3 py-1.5 bg-green-100 text-green-700 rounded-lg text-xs font-medium hover:bg-green-200">
                        {t('admin.admins.reactivate')}
                      </button>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminsTab;
