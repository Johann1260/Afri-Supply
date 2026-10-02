// src/components/products/SpecsBuilder.jsx
// Composant partagé — utilisé par NewProductPage et EditProductPage
import React from 'react';

const SUGGESTIONS = [
  'Norme','Matière','Dimensions','Poids','Résistance','Longueur','Largeur',
  'Hauteur','Épaisseur','Diamètre','Pression max','Température max',
  'Débit','Puissance','Tension','Capacité','Traitement surface','Certification',
];

const SpecsBuilder = ({ value, onChange, t }) => {
  const [rows, setRows] = React.useState(() => {
    try {
      const parsed = typeof value === 'string' ? JSON.parse(value || '{}') : (value || {});
      const entries = Object.entries(parsed);
      return entries.length > 0
        ? entries.map(([k, v]) => ({ key: k, val: String(v) }))
        : [{ key: '', val: '' }];
    } catch {
      return [{ key: '', val: '' }];
    }
  });

  const sync = (updated) => {
    const obj = {};
    updated.forEach(({ key, val }) => { if (key.trim()) obj[key.trim()] = val; });
    onChange(JSON.stringify(obj));
    setRows(updated);
  };

  const update = (idx, field, v) => sync(rows.map((r, i) => i === idx ? { ...r, [field]: v } : r));
  const add    = () => sync([...rows, { key: '', val: '' }]);
  const remove = (idx) => sync(rows.filter((_, i) => i !== idx));

  return (
    <div className="space-y-2">
      {rows.map((row, idx) => (
        <div key={idx} className="flex gap-2 items-center">
          <input
            list={`sk-${idx}`}
            value={row.key}
            onChange={(e) => update(idx, 'key', e.target.value)}
            placeholder="Ex: Norme, Dimensions…"
            className="flex-1 h-9 rounded-md border border-slate-200 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-accent/50 min-w-0"
          />
          <datalist id={`sk-${idx}`}>
            {SUGGESTIONS.map((s) => <option key={s} value={s} />)}
          </datalist>
          <input
            value={row.val}
            onChange={(e) => update(idx, 'val', e.target.value)}
            placeholder="Valeur"
            className="flex-1 h-9 rounded-md border border-slate-200 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-accent/50 min-w-0"
          />
          <button
            type="button"
            onClick={() => remove(idx)}
            className="text-red-400 hover:text-red-600 px-2 text-lg leading-none flex-shrink-0"
            aria-label="Supprimer"
          >×</button>
        </div>
      ))}
      <button
        type="button"
        onClick={add}
        className="text-sm text-accent hover:underline"
      >
        {t ? t('sheet.specs.add') : '+ Ajouter une caractéristique'}
      </button>
      <p className="text-xs text-slate-400 mt-1">
        💡 Incluses dans la fiche produit PDF téléchargeable par vos clients.
      </p>
    </div>
  );
};

export default SpecsBuilder;