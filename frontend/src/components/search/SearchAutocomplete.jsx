// src/components/search/SearchAutocomplete.jsx
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { MagnifyingGlass, Package, X, Clock } from '@phosphor-icons/react';
import { productsAPI } from '../../lib/api';
import { getImageUrl, formatPrice } from '../../lib/utils';
import { useLocale } from '../../context/LocaleContext';

const RECENT_KEY = 'afrisupply_recent_searches';
const MAX_RECENT = 5;

const getRecent = () => {
  try { return JSON.parse(localStorage.getItem(RECENT_KEY) || '[]'); }
  catch { return []; }
};

const saveRecent = (q) => {
  const prev = getRecent().filter((r) => r !== q);
  localStorage.setItem(RECENT_KEY, JSON.stringify([q, ...prev].slice(0, MAX_RECENT)));
};

const SearchAutocomplete = ({ className = '', onClose }) => {
  const navigate  = useNavigate();
  const { locale } = useLocale();
  const [query,   setQuery]   = useState('');
  const [results, setResults] = useState([]);
  const [recent,  setRecent]  = useState(getRecent());
  const [loading, setLoading] = useState(false);
  const [open,    setOpen]    = useState(false);
  const inputRef  = useRef(null);
  const timer     = useRef(null);

  const search = useCallback(async (q) => {
    if (!q || q.length < 2) { setResults([]); return; }
    setLoading(true);
    try {
      const res = await productsAPI.search(q);
      setResults(res.data?.slice(0, 6) || []);
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    clearTimeout(timer.current);
    if (query.length >= 2) {
      timer.current = setTimeout(() => search(query), 300);
    } else {
      setResults([]);
    }
    return () => clearTimeout(timer.current);
  }, [query, search]);

  const handleSelect = (q) => {
    saveRecent(q);
    setRecent(getRecent());
    setOpen(false);
    setQuery('');
    navigate(`/products?search=${encodeURIComponent(q)}`);
    onClose?.();
  };

  const handleProductClick = (productId) => {
    setOpen(false);
    setQuery('');
    navigate(`/products/${productId}`);
    onClose?.();
  };

  return (
    <div className={`relative ${className}`}>
      <div className="relative">
        <MagnifyingGlass className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && query.trim()) handleSelect(query.trim());
            if (e.key === 'Escape') { setOpen(false); setQuery(''); }
          }}
          placeholder={locale === 'fr' ? 'Rechercher des produits, fournisseurs...' : 'Search products, suppliers...'}
          className="w-full pl-10 pr-10 py-2.5 border border-slate-300 focus:border-primary focus:ring-1 focus:ring-primary/20 rounded-lg text-sm outline-none transition-all bg-white"
          data-testid="search-input"
          autoComplete="off"
        />
        {query && (
          <button
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => setQuery('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Dropdown */}
      {open && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-xl z-50 overflow-hidden">
          {/* Recherches récentes */}
          {!query && recent.length > 0 && (
            <div>
              <p className="px-4 py-2 text-xs font-semibold text-slate-400 uppercase tracking-wide border-b border-slate-100">
                Récents
              </p>
              {recent.map((r) => (
                <button
                  key={r}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => handleSelect(r)}
                  className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-slate-50 text-left"
                >
                  <Clock className="w-4 h-4 text-slate-400 flex-shrink-0" />
                  <span className="text-sm text-slate-700">{r}</span>
                </button>
              ))}
            </div>
          )}

          {/* Résultats */}
          {query.length >= 2 && (
            <>
              {loading ? (
                <div className="px-4 py-8 text-center">
                  <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
                </div>
              ) : results.length === 0 ? (
                <div className="px-4 py-6 text-center text-slate-400 text-sm">
                  Aucun résultat pour « {query} »
                </div>
              ) : (
                <>
                  <p className="px-4 py-2 text-xs font-semibold text-slate-400 uppercase tracking-wide border-b border-slate-100">
                    Produits
                  </p>
                  {results.map((p) => (
                    <button
                      key={p.id}
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => handleProductClick(p.id)}
                      className="w-full flex items-center gap-3 px-4 py-3 hover:bg-slate-50 text-left border-b border-slate-50 last:border-0"
                    >
                      <div className="w-10 h-10 bg-slate-100 rounded-lg overflow-hidden flex-shrink-0">
                        {p.images?.[0] ? (
                          <img src={getImageUrl(p.images[0])} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <Package className="w-5 h-5 text-slate-400 m-auto" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-slate-900 truncate">{p.name}</p>
                        <p className="text-xs text-slate-400 truncate">{p.category_name}</p>
                      </div>
                      <p className="text-sm font-bold text-primary flex-shrink-0">{formatPrice(p.price)}</p>
                    </button>
                  ))}
                  <button
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => handleSelect(query)}
                    className="w-full flex items-center gap-2 px-4 py-3 text-accent hover:bg-accent/5 text-sm font-medium"
                  >
                    <MagnifyingGlass className="w-4 h-4" />
                    Voir tous les résultats pour « {query} »
                  </button>
                </>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
};
export default React.memo(SearchAutocomplete);
export { SearchAutocomplete };
