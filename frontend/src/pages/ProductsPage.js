import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { 
  Funnel, 
  SortAscending, 
  MagnifyingGlass
} from '@phosphor-icons/react';
import { Layout } from '../components/layout';
import { ProductGrid } from '../components/products';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '../components/ui/select';
import { Slider } from '../components/ui/slider';
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from '../components/ui/pagination';
import { productsAPI, categoriesAPI } from '../lib/api';
import { formatPrice } from '../lib/utils';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

const ITEMS_PER_PAGE = 12;

const ProductsPage = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showFilters, setShowFilters] = useState(false);

  // P1 FIX: totalCount vient du serveur, pas du tableau local
  const [totalCount, setTotalCount] = useState(0);

  // P3-15: valeur tapée (immédiate) vs valeur debouncée (déclenchant la recherche)
  const [search, setSearch] = useState(searchParams.get('search') || '');
  const [debouncedSearch, setDebouncedSearch] = useState(search);
  const debounceTimer = useRef(null);

  // Mettre à jour debouncedSearch 400ms après la dernière frappe
  useEffect(() => {
    clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => {
      setDebouncedSearch(search);
      setCurrentPage(1);
    }, 400);
    return () => clearTimeout(debounceTimer.current);
  }, [search]);
  const [categoryId, setCategoryId] = useState(searchParams.get('category_id') || '');
  const [priceRange, setPriceRange] = useState([0, 10000000]);
  const [sortBy, setSortBy] = useState('created_at');
  const [sortOrder, setSortOrder] = useState('desc');
  const [currentPage, setCurrentPage] = useState(1);

  const isRfqMode = searchParams.get('rfq') === 'true';
  const [selectedForRfq, setSelectedForRfq] = useState([]);

  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const res = await categoriesAPI.getAll();
        setCategories(res.data || []);
      } catch (error) {
        console.error('Failed to fetch categories:', error);
      }
    };
    fetchCategories();
  }, []);

  // P1 FIX: on fait deux appels — la page courante + un count sans limit
  const fetchProducts = useCallback(async () => {
    setLoading(true);
    try {
      const baseParams = {
        // P3-15: on utilise debouncedSearch (pas search) pour ne déclencher la requête
        // qu'après 400ms sans frappe
        search: debouncedSearch || undefined,
        category_id: categoryId || undefined,
        min_price: priceRange[0] > 0 ? priceRange[0] : undefined,
        max_price: priceRange[1] < 10000000 ? priceRange[1] : undefined,
        sort_by: sortBy,
        sort_order: sortOrder,
      };

      const [pageRes, countRes] = await Promise.all([
        productsAPI.getAll({
          ...baseParams,
          skip: (currentPage - 1) * ITEMS_PER_PAGE,
          limit: ITEMS_PER_PAGE,
        }),
        productsAPI.getCount(baseParams),
      ]);

      setProducts(pageRes.data || []);
      setTotalCount((countRes.data || []).length);
    } catch (error) {
      console.error('Failed to fetch products:', error);
      setProducts([]);
      setTotalCount(0);
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch, categoryId, priceRange, sortBy, sortOrder, currentPage]);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  const handleSearch = (e) => {
    e.preventDefault();
    // Forcer la recherche immédiate sur soumission du formulaire
    clearTimeout(debounceTimer.current);
    setDebouncedSearch(search);
    setCurrentPage(1);
    setSearchParams((prev) => {
      if (search) prev.set('search', search);
      else prev.delete('search');
      return prev;
    });
  };

  const clearFilters = () => {
    setSearch('');
    setDebouncedSearch('');
    setCategoryId('');
    setPriceRange([0, 10000000]);
    setSortBy('created_at');
    setSortOrder('desc');
    setCurrentPage(1);
    setSearchParams({});
  };

  const handlePageChange = (page) => {
    if (page < 1 || page > totalPages) return;
    setCurrentPage(page);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const activeFiltersCount = [
    search,
    categoryId,
    priceRange[0] > 0 || priceRange[1] < 10000000,
  ].filter(Boolean).length;

  const toggleProductForRfq = (product) => {
    setSelectedForRfq((prev) => {
      const exists = prev.findIndex((item) => item.product_id === product.id);
      if (exists !== -1) return prev.filter((item) => item.product_id !== product.id);
      return [...prev, {
        product_id: product.id,
        product_name: product.name,
        quantity: product.min_order_quantity || 1,
        price: product.price,
      }];
    });
  };

  // P1 FIX: navigate est maintenant correctement déclaré via useNavigate()
  const handleFinishRfqSelection = () => {
    if (selectedForRfq.length === 0) {
      toast.error('Sélectionnez au moins un produit');
      return;
    }
    navigate('/rfq', { state: { selectedProducts: selectedForRfq } });
  };

  // P1 FIX: totalPages calculé à partir du vrai count serveur
  const totalPages = Math.max(1, Math.ceil(totalCount / ITEMS_PER_PAGE));

  // Génère les numéros de pages à afficher (max 5, avec ellipsis)
  const getPageNumbers = () => {
    const pages = [];
    const delta = 2;
    for (let i = Math.max(1, currentPage - delta); i <= Math.min(totalPages, currentPage + delta); i++) {
      pages.push(i);
    }
    return pages;
  };

  return (
    <Layout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Breadcrumb */}
        <nav className="flex items-center gap-2 text-sm mb-6">
          <Link to="/" className="text-slate-500 hover:text-primary">Accueil</Link>
          <span className="text-slate-400">/</span>
          <span className="text-slate-900">Produits</span>
          {categoryId && categories.find((c) => c.id === categoryId) && (
            <>
              <span className="text-slate-400">/</span>
              <span className="text-slate-900">
                {categories.find((c) => c.id === categoryId)?.name}
              </span>
            </>
          )}
        </nav>

        {/* Header */}
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mb-8">
          <div>
            <h1 className="section-heading">
              {categoryId && categories.find((c) => c.id === categoryId)
                ? categories.find((c) => c.id === categoryId)?.name
                : 'Tous les produits'}
            </h1>
            <p className="text-slate-500 mt-1">
              {totalCount} produit{totalCount > 1 ? 's' : ''} trouvé{totalCount > 1 ? 's' : ''}
            </p>
          </div>

          <div className="flex items-center gap-3">
            <Select
              value={`${sortBy}-${sortOrder}`}
              onValueChange={(val) => {
                const [by, order] = val.split('-');
                setSortBy(by);
                setSortOrder(order);
                setCurrentPage(1);
              }}
            >
              <SelectTrigger className="w-[180px]">
                <SortAscending className="w-4 h-4 mr-2" />
                <SelectValue placeholder="Trier par" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="created_at-desc">Plus récents</SelectItem>
                <SelectItem value="price-asc">Prix croissant</SelectItem>
                <SelectItem value="price-desc">Prix décroissant</SelectItem>
              </SelectContent>
            </Select>

            <Button
              variant="outline"
              className="lg:hidden"
              onClick={() => setShowFilters(!showFilters)}
            >
              <Funnel className="w-4 h-4 mr-2" />
              Filtres {activeFiltersCount > 0 && `(${activeFiltersCount})`}
            </Button>
          </div>
        </div>

        <div className="flex flex-col lg:flex-row gap-8">
          {/* Filters sidebar */}
          <aside className={`lg:w-64 flex-shrink-0 ${showFilters ? 'block' : 'hidden lg:block'}`}>
            <div className="bg-white border border-slate-200 rounded-lg p-6 sticky top-24">
              <div className="flex items-center justify-between mb-6">
                <h2 className="font-heading font-bold text-lg">Filtres</h2>
                {activeFiltersCount > 0 && (
                  <button onClick={clearFilters} className="text-sm text-accent hover:underline">
                    Effacer tout
                  </button>
                )}
              </div>

              <div className="mb-6">
                <label className="text-sm font-semibold text-slate-700 mb-2 block">Recherche</label>
                <form onSubmit={handleSearch} className="relative">
                  <Input
                    type="text"
                    placeholder="Mot-clé..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pr-10"
                  />
                  <button
                    type="submit"
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-primary"
                  >
                    <MagnifyingGlass className="w-5 h-5" />
                  </button>
                </form>
              </div>

              <div className="mb-6">
                <label className="text-sm font-semibold text-slate-700 mb-2 block">Catégorie</label>
                <Select
                  value={categoryId || 'all'}
                  onValueChange={(value) => {
                    setCategoryId(value === 'all' ? '' : value);
                    setCurrentPage(1);
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Toutes les catégories" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Toutes les catégories</SelectItem>
                    {categories.map((cat) => (
                      <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="mb-6">
                <label className="text-sm font-semibold text-slate-700 mb-4 block">Prix (XAF)</label>
                <Slider
                  value={priceRange}
                  onValueChange={(v) => { setPriceRange(v); setCurrentPage(1); }}
                  min={0}
                  max={10000000}
                  step={50000}
                  className="mb-4"
                />
                <div className="flex items-center justify-between text-sm text-slate-600">
                  <span>{formatPrice(priceRange[0])}</span>
                  <span>{formatPrice(priceRange[1])}</span>
                </div>
              </div>

              <Button
                className="w-full lg:hidden mt-4"
                onClick={() => setShowFilters(false)}
              >
                Appliquer les filtres
              </Button>
            </div>
          </aside>

          {/* Products Grid + Pagination */}
          <div className="flex-1">
            <ProductGrid products={products} loading={loading} />

            {/* P1 FIX: pagination correcte basée sur totalCount serveur */}
            {!loading && totalPages > 1 && (
              <div className="mt-12 flex justify-center">
                <Pagination>
                  <PaginationContent>
                    <PaginationItem>
                      <PaginationPrevious
                        onClick={() => handlePageChange(currentPage - 1)}
                        className={currentPage === 1 ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                      />
                    </PaginationItem>

                    {currentPage > 3 && (
                      <>
                        <PaginationItem>
                          <PaginationLink onClick={() => handlePageChange(1)}>1</PaginationLink>
                        </PaginationItem>
                        {currentPage > 4 && (
                          <PaginationItem>
                            <span className="px-3 py-2 text-slate-400">…</span>
                          </PaginationItem>
                        )}
                      </>
                    )}

                    {getPageNumbers().map((page) => (
                      <PaginationItem key={page}>
                        <PaginationLink
                          isActive={page === currentPage}
                          onClick={() => handlePageChange(page)}
                          className="cursor-pointer"
                        >
                          {page}
                        </PaginationLink>
                      </PaginationItem>
                    ))}

                    {currentPage < totalPages - 2 && (
                      <>
                        {currentPage < totalPages - 3 && (
                          <PaginationItem>
                            <span className="px-3 py-2 text-slate-400">…</span>
                          </PaginationItem>
                        )}
                        <PaginationItem>
                          <PaginationLink onClick={() => handlePageChange(totalPages)}>
                            {totalPages}
                          </PaginationLink>
                        </PaginationItem>
                      </>
                    )}

                    <PaginationItem>
                      <PaginationNext
                        onClick={() => handlePageChange(currentPage + 1)}
                        className={currentPage === totalPages ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                      />
                    </PaginationItem>
                  </PaginationContent>
                </Pagination>
              </div>
            )}
          </div>
        </div>

        {/* RFQ floating bar */}
        {isRfqMode && selectedForRfq.length > 0 && (
          <div className="fixed bottom-6 right-6 bg-white shadow-2xl border border-accent rounded-2xl p-6 z-50 min-w-[320px]">
            <p className="font-medium mb-3">
              {selectedForRfq.length} produit{selectedForRfq.length > 1 ? 's' : ''} sélectionné
              {selectedForRfq.length > 1 ? 's' : ''}
            </p>
            <Button
              onClick={handleFinishRfqSelection}
              className="w-full bg-accent hover:bg-accent-hover"
            >
              Terminer ma demande de devis
            </Button>
          </div>
        )}
      </div>
    </Layout>
  );
};

export default ProductsPage;