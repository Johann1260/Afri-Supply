import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useSearchParams, Link, useNavigate } from 'react-router-dom';
import { Funnel, SortAscending, MagnifyingGlass } from '@phosphor-icons/react';
import { Layout } from '../components/layout';
import { ProductGrid } from '../components/products';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Slider } from '../components/ui/slider';
import { Pagination, PaginationContent, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious } from '../components/ui/pagination';
import { productsAPI, categoriesAPI } from '../lib/api';
import { formatPrice } from '../lib/utils';
import { useLocale } from '../context/LocaleContext';
import { toast } from 'sonner';

const ITEMS_PER_PAGE = 12;

const ProductsPage = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const { t } = useLocale();

  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [totalCount, setTotalCount] = useState(0);
  const [showFilters, setShowFilters] = useState(false);

  const [search, setSearch] = useState(searchParams.get('search') || '');
  const [debouncedSearch, setDebouncedSearch] = useState(search);
  const debounceTimer = useRef(null);
  const [categoryId, setCategoryId] = useState(searchParams.get('category_id') || '');
  const [priceRange, setPriceRange] = useState([0, 10000000]);
  const [sortBy, setSortBy] = useState('created_at');
  const [sortOrder, setSortOrder] = useState('desc');
  const [currentPage, setCurrentPage] = useState(1);

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

  const fetchProducts = useCallback(async () => {
    setLoading(true);
    try {
      const base = {
        search: debouncedSearch || undefined,
        category_id: categoryId || undefined,
        min_price: priceRange[0] > 0 ? priceRange[0] : undefined,
        max_price: priceRange[1] < 10000000 ? priceRange[1] : undefined,
        sort_by: sortBy, sort_order: sortOrder,
      };
      const [pageRes, countRes] = await Promise.all([
        productsAPI.getAll({ ...base, skip: (currentPage - 1) * ITEMS_PER_PAGE, limit: ITEMS_PER_PAGE }),
        productsAPI.getCount(base),
      ]);
      setProducts(pageRes.data || []);
      setTotalCount((countRes.data || []).length);
    } catch { setProducts([]); setTotalCount(0); }
    finally { setLoading(false); }
  }, [debouncedSearch, categoryId, priceRange, sortBy, sortOrder, currentPage]);

  useEffect(() => { fetchProducts(); }, [fetchProducts]);

  const handleSearch = (e) => {
    e.preventDefault();
    clearTimeout(debounceTimer.current);
    setDebouncedSearch(search);
    setCurrentPage(1);
    setSearchParams((p) => { search ? p.set('search', search) : p.delete('search'); return p; });
  };

  const clearFilters = () => {
    setSearch(''); setDebouncedSearch(''); setCategoryId('');
    setPriceRange([0, 10000000]); setSortBy('created_at'); setSortOrder('desc');
    setCurrentPage(1); setSearchParams({});
  };

  const handlePageChange = (page) => {
    if (page < 1 || page > totalPages) return;
    setCurrentPage(page);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const totalPages = Math.max(1, Math.ceil(totalCount / ITEMS_PER_PAGE));

  const getPageNumbers = () => {
    const pages = [];
    for (let i = Math.max(1, currentPage - 2); i <= Math.min(totalPages, currentPage + 2); i++) pages.push(i);
    return pages;
  };

  const handleFinishRfqSelection = () => {
    if (selectedForRfq.length === 0) { toast.error('Sélectionnez au moins un produit'); return; }
    navigate('/rfq', { state: { selectedProducts: selectedForRfq } });
  };

  const activeFiltersCount = [search, categoryId, priceRange[0] > 0 || priceRange[1] < 10000000].filter(Boolean).length;
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
                <Slider value={priceRange} onValueChange={(v) => { setPriceRange(v); setCurrentPage(1); }} min={0} max={10000000} step={50000} className="mb-4" />
                <div className="flex justify-between text-sm text-slate-600">
                  <span>{formatPrice(priceRange[0])}</span><span>{formatPrice(priceRange[1])}</span>
                </div>
              </div>
              <Button className="w-full lg:hidden mt-4" onClick={() => setShowFilters(false)}>{t('products.filter.apply')}</Button>
            </div>
          </aside>

          <div className="flex-1">
            <ProductGrid products={products} loading={loading} />
            {!loading && totalPages > 1 && (
              <div className="mt-12 flex justify-center">
                <Pagination>
                  <PaginationContent>
                    <PaginationItem>
                      <PaginationPrevious onClick={() => handlePageChange(currentPage - 1)}
                        className={currentPage === 1 ? 'pointer-events-none opacity-50' : 'cursor-pointer'} />
                    </PaginationItem>
                    {currentPage > 3 && <>
                      <PaginationItem><PaginationLink onClick={() => handlePageChange(1)}>1</PaginationLink></PaginationItem>
                      {currentPage > 4 && <PaginationItem><span className="px-3 py-2 text-slate-400">…</span></PaginationItem>}
                    </>}
                    {getPageNumbers().map((page) => (
                      <PaginationItem key={page}>
                        <PaginationLink isActive={page === currentPage} onClick={() => handlePageChange(page)} className="cursor-pointer">{page}</PaginationLink>
                      </PaginationItem>
                    ))}
                    {currentPage < totalPages - 2 && <>
                      {currentPage < totalPages - 3 && <PaginationItem><span className="px-3 py-2 text-slate-400">…</span></PaginationItem>}
                      <PaginationItem><PaginationLink onClick={() => handlePageChange(totalPages)}>{totalPages}</PaginationLink></PaginationItem>
                    </>}
                    <PaginationItem>
                      <PaginationNext onClick={() => handlePageChange(currentPage + 1)}
                        className={currentPage === totalPages ? 'pointer-events-none opacity-50' : 'cursor-pointer'} />
                    </PaginationItem>
                  </PaginationContent>
                </Pagination>
              </div>
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