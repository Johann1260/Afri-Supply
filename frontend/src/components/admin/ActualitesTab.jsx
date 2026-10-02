import React from 'react';
import { ArrowLeft, Trash, Upload, Newspaper } from '@phosphor-icons/react';
import { useLocale } from '../../context/LocaleContext';
import { actualitesAPI } from '../../lib/api';
import { toast } from 'sonner';
import { MediaIcon, BACKEND_URL } from './shared';

const EMPTY_FORM = { title: '', content: '', excerpt: '', category: '', is_published: false };
const CATEGORIES = ['marche', 'reglementation', 'logistique', 'technologie', 'partenariat'];

const ActualitesTab = () => {
  const { t } = useLocale();
  const [items, setItems]         = React.useState([]);
  const [loadingList, setLoadingList] = React.useState(true);
  const [form, setForm]           = React.useState(EMPTY_FORM);
  const [editId, setEditId]       = React.useState(null);
  const [saving, setSaving]       = React.useState(false);
  const [uploading, setUploading] = React.useState(false);
  const [view, setView]           = React.useState('list');
  const fileRef = React.useRef(null);
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const load = React.useCallback(async () => {
    setLoadingList(true);
    try { const res = await actualitesAPI.list(); setItems(Array.isArray(res.data) ? res.data : []); }
    catch { toast.error(t('admin.news.loadErr')); }
    finally { setLoadingList(false); }
  }, [t]);
  React.useEffect(() => { load(); }, [load]);

  const curItem = editId ? items.find(i => i.id === editId) : null;

  function openCreate() { setEditId(null); setForm(EMPTY_FORM); setView('form'); window.scrollTo({ top: 0, behavior: 'smooth' }); }
  function openEdit(item) {
    setEditId(item.id);
    setForm({ title: item.title || '', content: item.content || '', excerpt: item.excerpt || '', category: item.category || '', is_published: item.is_published || false });
    setView('form');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
  function cancelForm() { setEditId(null); setForm(EMPTY_FORM); setView('list'); }

  async function handleSave(e) {
    e.preventDefault();
    if (!form.title.trim() || !form.content.trim()) return toast.error(t('admin.news.required'));
    setSaving(true);
    try {
      if (editId) {
        await actualitesAPI.update(editId, form);
        toast.success(t('admin.news.updated'));
        await load();
      } else {
        const res = await actualitesAPI.create(form);
        const newId = res.data?.id;
        toast.success(t('admin.news.created'));
        await load();
        if (newId) setEditId(newId); else cancelForm();
      }
    } catch (err) { toast.error(err.response?.data?.detail || t('admin.err')); }
    finally { setSaving(false); }
  }

  async function handleUploadMedia(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!editId) { toast.error(t('admin.news.savFirst')); e.target.value = ''; return; }
    setUploading(true);
    try { await actualitesAPI.uploadMedia(editId, file); toast.success(t('admin.news.mediaAdded')); await load(); }
    catch (err) { toast.error(err.response?.data?.detail || t('admin.news.mediaErr')); }
    finally { setUploading(false); if (fileRef.current) fileRef.current.value = ''; }
  }

  async function handleDeleteMedia(url) {
    if (!window.confirm(t('admin.news.mediaDelCfm'))) return;
    try { await actualitesAPI.deleteMedia(editId, url); toast.success(t('admin.news.mediaDel')); await load(); }
    catch { toast.error(t('admin.err')); }
  }

  async function handleDelete(id) {
    if (!window.confirm(t('admin.news.delCfm'))) return;
    try { await actualitesAPI.remove(id); toast.success(t('admin.news.deleted')); if (editId === id) cancelForm(); await load(); }
    catch { toast.error(t('admin.err')); }
  }

  async function togglePublish(item) {
    try { await actualitesAPI.update(item.id, { is_published: !item.is_published }); toast.success(item.is_published ? t('admin.news.unpublished') : t('admin.news.published')); await load(); }
    catch { toast.error(t('admin.err')); }
  }

  if (view === 'form') {
    const media = curItem?.media || [];
    return (
      <div className="space-y-6 max-w-3xl">
        <div className="flex items-center gap-3">
          <button onClick={cancelForm} className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800">
            <ArrowLeft className="w-4 h-4" />Retour
          </button>
          <h2 className="text-base font-bold text-slate-900 flex-1">
            {editId ? t('admin.news.editTitle') : t('admin.news.newTitle')}
          </h2>
          {editId && (
            <button onClick={() => handleDelete(editId)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-red-100 text-red-600 rounded-lg text-xs font-medium hover:bg-red-200">
              <Trash className="w-3.5 h-3.5" />Supprimer
            </button>
          )}
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-6">
          <form onSubmit={handleSave} className="space-y-4">
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-semibold text-slate-600 block mb-1">Titre *</label>
                <input className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                  value={form.title} onChange={e => set('title', e.target.value)} required placeholder={t('admin.news.titlePh')} />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-600 block mb-1">Catégorie</label>
                <select className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                  value={form.category} onChange={e => set('category', e.target.value)}>
                  <option value="">— Sélectionner —</option>
                  {CATEGORIES.map(c => <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>)}
                </select>
              </div>
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-600 block mb-1">Extrait</label>
              <input className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                placeholder={t('admin.news.excerptPh')} value={form.excerpt} onChange={e => set('excerpt', e.target.value)} />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-600 block mb-1">Contenu *</label>
              <textarea rows={8} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none resize-y"
                value={form.content} onChange={e => set('content', e.target.value)} required placeholder={t('admin.news.contentPh')} />
            </div>
            <div className="flex items-center gap-2">
              <input type="checkbox" id="pub-check" checked={form.is_published} onChange={e => set('is_published', e.target.checked)} className="w-4 h-4 accent-blue-600" />
              <label htmlFor="pub-check" className="text-sm text-slate-700 select-none cursor-pointer">Publier immédiatement</label>
            </div>
            <div className="flex gap-2 pt-1">
              <button type="button" onClick={cancelForm} className="px-4 py-2 border border-slate-200 rounded-lg text-sm text-slate-600 hover:bg-slate-50">Annuler</button>
              <button type="submit" disabled={saving}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 disabled:opacity-60 flex items-center gap-2">
                {saving && <span className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />}
                {saving ? t('admin.news.saving') : editId ? t('admin.news.saveEdit') : t('admin.news.createCta')}
              </button>
            </div>
          </form>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-bold text-slate-900">Médias {media.length > 0 && <span className="text-slate-400 font-normal">({media.length})</span>}</h3>
              <p className="text-xs text-slate-500 mt-0.5">{editId ? t('admin.news.mediaDesc') : t('admin.news.mediaSavFirst')}</p>
            </div>
            {editId && (
              <label className={`flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold cursor-pointer hover:bg-blue-700 ${uploading ? 'opacity-60 pointer-events-none' : ''}`}>
                {uploading ? <><span className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />Upload…</> : <><Upload className="w-4 h-4" />Ajouter un média</>}
                <input ref={fileRef} type="file" className="hidden"
                  accept="image/*,video/mp4,video/webm,video/quicktime,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                  onChange={handleUploadMedia} />
              </label>
            )}
          </div>
          {!editId ? (
            <div className="border-2 border-dashed border-slate-200 rounded-xl p-8 text-center text-slate-400">
              <Upload className="w-8 h-8 mx-auto mb-2 opacity-40" />
              <p className="text-sm">Créez d'abord l'actualité</p>
            </div>
          ) : media.length === 0 ? (
            <div className="border-2 border-dashed border-slate-200 rounded-xl p-8 text-center text-slate-400">
              <Upload className="w-8 h-8 mx-auto mb-2 opacity-40" />
              <p className="text-sm">Aucun média — cliquez "Ajouter un média"</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {media.map((m, idx) => (
                <div key={idx} className="relative group border border-slate-200 rounded-xl overflow-hidden bg-slate-50">
                  {m.type === 'image' ? (
                    <a href={`${BACKEND_URL}${m.url}`} target="_blank" rel="noopener noreferrer">
                      <img src={`${BACKEND_URL}${m.url}`} alt={m.filename} className="w-full h-28 object-cover" />
                    </a>
                  ) : (
                    <a href={`${BACKEND_URL}${m.url}`} target="_blank" rel="noopener noreferrer"
                      className="flex flex-col items-center justify-center h-28 gap-2 hover:bg-slate-100 transition-colors">
                      <MediaIcon type={m.type} />
                      <span className="text-xs text-slate-500 px-2 text-center truncate w-full">{m.filename}</span>
                    </a>
                  )}
                  <div className="flex items-center justify-between px-2 py-1.5 border-t border-slate-200 bg-white">
                    <span className="text-[10px] text-slate-400 truncate flex-1">{m.filename}</span>
                    <button type="button" onClick={() => handleDeleteMedia(m.url)}
                      className="ml-1 p-1 text-red-400 hover:text-red-600 rounded hover:bg-red-50">
                      <Trash className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-bold text-slate-900">
          Actualités {!loadingList && <span className="text-slate-400 font-normal">({items.length})</span>}
        </h2>
        <button onClick={openCreate} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700">
          + Nouvelle actualité
        </button>
      </div>
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        {loadingList ? (
          <div className="p-12 text-center text-slate-400">Chargement…</div>
        ) : items.length === 0 ? (
          <div className="p-12 text-center">
            <Newspaper className="w-10 h-10 mx-auto text-slate-300 mb-3" weight="duotone" />
            <p className="font-semibold text-slate-600 mb-1">Aucune actualité</p>
            <button onClick={openCreate} className="text-sm text-blue-600 hover:underline">Créer la première</button>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {items.map(item => (
              <div key={item.id} className="px-6 py-4 flex items-start gap-4">
                {item.media?.find(m => m.type === 'image') ? (
                  <img src={`${BACKEND_URL}${item.media.find(m => m.type === 'image').url}`} alt=""
                    className="w-16 h-14 object-cover rounded-lg border border-slate-200 shrink-0" />
                ) : (
                  <div className="w-16 h-14 bg-slate-100 rounded-lg border border-slate-200 shrink-0 flex items-center justify-center">
                    <Newspaper className="w-6 h-6 text-slate-300" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-0.5">
                    <span className="font-semibold text-sm text-slate-900 truncate max-w-xs">{item.title}</span>
                    {item.category && <span className="px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded text-xs">{item.category}</span>}
                    <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${item.is_published ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                      {item.is_published ? t('admin.news.published.badge') : t('admin.news.draft')}
                    </span>
                  </div>
                  {item.excerpt && <p className="text-xs text-slate-500 truncate">{item.excerpt}</p>}
                  <p className="text-xs text-slate-400 mt-0.5">{item.created_at?.slice(0, 10)}</p>
                </div>
                <div className="flex gap-1.5 shrink-0 flex-wrap justify-end">
                  <button onClick={() => togglePublish(item)}
                    className={`px-2.5 py-1.5 rounded text-xs font-medium ${item.is_published ? 'bg-amber-100 text-amber-700 hover:bg-amber-200' : 'bg-green-100 text-green-700 hover:bg-green-200'}`}>
                    {item.is_published ? t('admin.news.unpublish') : t('admin.news.publish')}
                  </button>
                  <button onClick={() => openEdit(item)} className="px-2.5 py-1.5 bg-blue-100 text-blue-700 rounded text-xs font-medium hover:bg-blue-200">Modifier</button>
                  <button onClick={() => handleDelete(item.id)} className="px-2.5 py-1.5 bg-red-100 text-red-600 rounded text-xs font-medium hover:bg-red-200">Supprimer</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default ActualitesTab;
