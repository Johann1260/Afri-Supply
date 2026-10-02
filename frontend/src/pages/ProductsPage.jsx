import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useSearchParams, Link, useNavigate } from 'react-router-dom';
import { Funnel, SortAscending, MagnifyingGlass, ArrowDown } from '@phosphor-icons/react';
import { Layout } from '../components/layout';
import { ProductGrid } from '../components/products';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Slider } from '../components/ui/slider';
import { productsAPI, categoriesAPI } from '../lib/api';
import { formatPrice } from '../lib/utils';
import { useLocale } from '../context/LocaleContext';
import { toast } from 'sonner';

const ITEMS_PER_PAGE = 24; // plus grand batch pour le load-more

const ProductsPage = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const { t } = useLocale();

  const [products, setProducts]     = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading]       = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [totalCount, setTotalCount] = useState(0);
  const [hasMore, setHasMore]       = useState(false);
  const [afterCursor, setAfterCursor] = useState(null); // ISO datetime du dernier produit reçu
  const [showFilters, setShowFilters] = useState(false);

  const [search, setSearch] = useState(searchParams.get('search') || '');
  const [debouncedSearch, setDebouncedSearch] = useState(search);
  const debounceTimer = useRef(null);
  const [categoryId, setCategoryId] = useState(searchParams.get('category_id') || '');
  const [priceRange, setPriceRange] = useState([0, 10000000]);
  const [committedPrice, setCommittedPrice] = useState([0, 10000000]);
  const [sortBy, setSortBy] = useState('created_at');
  const [sortOrder, setSortOrder] = useState('desc');

  // Cursor mode actif quand sort par date (défaut) et pas de recherche texte
  const useCursor = sortBy === 'created_at' && !debouncedSearch;

  const isRfqMode = searchParams.get('rfq') === 'true';
  const [selectedForRfq, setSelectedForRfq] = useState([]);

  useEffect(() => {
    clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => { setDebouncedSearch(search); setCurrentPage(1); }, 400);
    return () => clearTimeout(debounceTimer.current);
  }, [search]);

  useEffect(() => {
    categoriesAPI.getAll().then((r) => setCategories(r.data || [])).catch(() => {});
  }, []);

  // Fetch initial / reset (quand les filtres changent)
  const fetchProducts = useCallback(async () => {
    setLoading(true);
    setAfterCursor(null);
    try {
      const base = {
        search: debouncedSearch || undefined,
        category_id: categoryId || undefined,
        min_price: committedPrice[0] > 0 ? committedPrice[0] : undefined,
        max_price: committedPrice[1] < 10000000 ? committedPrice[1] : undefined,
        sort_by: sortBy, sort_order: sortOrder,
        limit: ITEMS_PER_PAGE,
      };
      const [pageRes, countRes] = await Promise.all([
        productsAPI.getAll(base),
        productsAPI.getCount({
          search: base.search, category_id: base.category_id,
          min_price: base.min_price, max_price: base.max_price,
        }),
      ]);
      const fetched = pageRes.data || [];
      setProducts(fetched);
      setTotalCount(countRes.data?.count ?? 0);
      setHasMore(fetched.length === ITEMS_PER_PAGE);
      // Stocker le curseur = created_at du dernier élément
      if (fetched.length > 0 && useCursor) {
        setAfterCursor(fetched[fetched.length - 1].created_at);
      }
    } catch { setProducts([]); setTotalCount(0); setHasMore(false); }
    finally { setLoading(false); }
  }, [debouncedSearch, categoryId, committedPrice, sortBy, sortOrder, useCursor]);

  useEffect(() => { fetchProducts(); }, [fetchProducts]);

  // Load More — cursor si possible, sinon skip
  const loadMore = useCallback(async () => {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    try {
      const params = {
        search: debouncedSearch || undefined,
        category_id: categoryId || undefined,
        min_price: committedPrice[0] > 0 ? committedPrice[0] : undefined,
        max_price: committedPrice[1] < 10000000 ? committedPrice[1] : undefined,
        sort_by: sortBy, sort_order: sortOrder,
        limit: ITEMS_PER_PAGE,
        ...(useCursor && afterCursor
          ? { after_cursor: afterCursor }
          : { skip: products.length }),
      };
      const res = await productsAPI.getAll(params);
      const fetched = res.data || [];
      setProducts((prev) => [...prev, ...fetched]);
      setHasMore(fetched.length === ITEMS_PER_PAGE);
      if (fetched.length > 0 && useCursor) {
        setAfterCursor(fetched[fetched.length - 1].created_at);
      }
    } catch { toast.error(t('common.error')); }
    finally { setLoadingMore(false); }
  }, [loadingMore, hasMore, debouncedSearch, categoryId, committedPrice, sortBy, sortOrder, useCursor, afterCursor, products.length]);

  const handleSearch = (e) => {
    e.preventDefault();
    clearTimeout(debounceTimer.current);
    setDebouncedSearch(search);
    setCurrentPage(1);
    setSearchParams((p) => { search ? p.set('search', search) : p.delete('search'); return p; });
  };

  const clearFilters = () => {
    setSearch(''); setDebouncedSearch(''); setCategoryId('');
    setPriceRange([0, 10000000]); setCommittedPrice([0, 10000000]);
    setSortBy('created_at'); setSortOrder('desc');
    setAfterCursor(null); setSearchParams({});
  };

  const handleFinishRfqSelection = () => {
    if (selectedForRfq.length === 0) { toast.error(t('product.selectAtLeastOne')); return; }
    navigate('/rfq', { state: { selectedProducts: selectedForRfq } });
  };

  const activeFiltersCount = [search, categoryId, committedPrice[0] > 0 || committedPrice[1] < 10000000].filter(Boolean).length;
  const currentCategoryName = categories.find((c) => c.id === categoryId)?.name;

  return (
    <Layout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <nav className="flex items-center gap-2 text-sm mb-6">
          <Link to="/" className="text-slate-500 hover:text-primary">Accueil</Link>
          <span className="text-slate-400">/</span>
          <span className="text-slate-900">{currentCategoryName || t('products.title')}</span>
        </nav>

        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mb-8">
          <div>
            <h1 className="section-heading">{currentCategoryName || t('products.title')}</h1>
            <p className="text-slate-500 mt-1">{totalCount} {t('products.count')}</p>
          </div>
          <div className="flex items-center gap-3">
            <Select value={`${sortBy}-${sortOrder}`} onValueChange={(val) => {
              const [by, order] = val.split('-'); setSortBy(by); setSortOrder(order); setCurrentPage(1);
            }}>
              <SelectTrigger className="w-[180px]">
                <SortAscending className="w-4 h-4 mr-2" />
                <SelectValue placeholder={t('common.sort')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="created_at-desc">{t('products.sort.recent')}</SelectItem>
                <SelectItem value="price-asc">{t('products.sort.priceAsc')}</SelectItem>
                <SelectItem value="price-desc">{t('products.sort.priceDesc')}</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" className="lg:hidden" onClick={() => setShowFilters(!showFilters)}>
              <Funnel className="w-4 h-4 mr-2" />{t('common.filters')} {activeFiltersCount > 0 && `(${activeFiltersCount})`}
            </Button>
          </div>
        </div>

        <div className="flex flex-col lg:flex-row gap-8">
          <aside className={`lg:w-64 flex-shrink-0 ${showFilters ? 'block' : 'hidden lg:block'}`}>
            <div className="bg-white border border-slate-200 rounded-lg p-6 sticky top-24">
              <div className="flex items-center justify-between mb-6">
                <h2 className="font-heading font-bold text-lg">{t('common.filters')}</h2>
                {activeFiltersCount > 0 && (
                  <button onClick={clearFilters} className="text-sm text-accent hover:underline">{t('products.filter.clear')}</button>
                )}
              </div>
              <div className="mb-6">
                <label className="text-sm font-semibold text-slate-700 mb-2 block">{t('common.search')}</label>
                <form onSubmit={handleSearch} className="relative">
                  <Input placeholder={t('products.filter.search')} value={search} onChange={(e) => setSearch(e.target.value)} className="pr-10" />
                  <button type="submit" className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-primary">
                    <MagnifyingGlass className="w-5 h-5" />
                  </button>
                </form>
              </div>
              <div className="mb-6">
                <label className="text-sm font-semibold text-slate-700 mb-2 block">{t('products.filter.category')}</label>
                <Select value={categoryId || 'all'} onValueChange={(v) => { setCategoryId(v === 'all' ? '' : v); setCurrentPage(1); }}>
                  <SelectTrigger><SelectValue placeholder={t('products.filter.all')} /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t('products.filter.all')}</SelectItem>
                    {categories.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="mb-6">
                <label className="text-sm font-semibold text-slate-700 mb-4 block">{t('products.filter.price')}</label>
                <Slider value={priceRange} onValueChange={setPriceRange} onValueCommit={(v) => { setCommittedPrice(v); setCurrentPage(1); }} min={0} max={10000000} step={50000} className="mb-4" />
                <div className="flex justify-between text-sm text-slate-600">
                  <span>{formatPrice(priceRange[0])}</span><span>{formatPrice(priceRange[1])}</span>
                </div>
              </div>
              <Button className="w-full lg:hidden mt-4" onClick={() => setShowFilters(false)}>{t('products.filter.apply')}</Button>
            </div>
          </aside>

          <div className="flex-1">
            <ProductGrid products={products} loading={loading} />
            {/* Load More — cursor-based (O(log N)) quand sort=date, sinon skip */}
            {!loading && hasMore && (
              <div className="mt-10 flex flex-col items-center gap-2">
                <Button
                  onClick={loadMore}
                  disabled={loadingMore}
                  variant="outline"
                  className="px-8 py-3 border-slate-300 hover:border-primary hover:text-primary transition-colors"
                >
                  {loadingMore ? (
                    <span className="flex items-center gap-2">
                      <span className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                      Chargement…
                    </span>
                  ) : (
                    <span className="flex items-center gap-2">
                      <ArrowDown className="w-4 h-4" />
                      Voir plus de produits
                    </span>
                  )}
                </Button>
                <p className="text-xs text-slate-400">
                  {products.length} / {totalCount} produits
                </p>
              </div>
            )}
            {!loading && !hasMore && products.length > 0 && (
              <p className="mt-10 text-center text-sm text-slate-400">
                {products.length} produit{products.length !== 1 ? 's' : ''} affiché{products.length !== 1 ? 's' : ''}
              </p>
            )}
          </div>
        </div>

        {isRfqMode && selectedForRfq.length > 0 && (
          <div className="fixed bottom-6 right-6 bg-white shadow-2xl border border-accent rounded-2xl p-6 z-50 min-w-[320px]">
            <p className="font-medium mb-3">{selectedForRfq.length} produit(s) sélectionné(s)</p>
            <Button onClick={handleFinishRfqSelection} className="w-full bg-accent hover:bg-accent-hover">Terminer ma demande de devis</Button>
          </div>
        )}
      </div>
    </Layout>
  );
};

export default ProductsPage;