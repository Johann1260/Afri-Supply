import React, { useState, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { 
  Funnel, 
  SortAscending, 
  X,
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
import { productsAPI, categoriesAPI } from '../lib/api';
import { formatPrice } from '../lib/utils';

const ProductsPage = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showFilters, setShowFilters] = useState(false);
  
  // Filters
  const [search, setSearch] = useState(searchParams.get('search') || '');
  const [categoryId, setCategoryId] = useState(searchParams.get('category_id') || '');
  const [priceRange, setPriceRange] = useState([0, 10000000]);
  const [sortBy, setSortBy] = useState('created_at');
  const [sortOrder, setSortOrder] = useState('desc');

  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const res = await categoriesAPI.getAll();
        setCategories(res.data);
      } catch (error) {
        console.error('Failed to fetch categories:', error);
      }
    };
    fetchCategories();
  }, []);

  useEffect(() => {
    const fetchProducts = async () => {
      setLoading(true);
      try {
        const params = {
          search: search || undefined,
          category_id: categoryId || undefined,
          min_price: priceRange[0] > 0 ? priceRange[0] : undefined,
          max_price: priceRange[1] < 10000000 ? priceRange[1] : undefined,
          sort_by: sortBy,
          sort_order: sortOrder,
          limit: 24,
        };
        
        const res = await productsAPI.getAll(params);
        setProducts(res.data);
      } catch (error) {
        console.error('Failed to fetch products:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchProducts();
  }, [search, categoryId, priceRange, sortBy, sortOrder]);

  const handleSearch = (e) => {
    e.preventDefault();
    setSearchParams(prev => {
      if (search) {
        prev.set('search', search);
      } else {
        prev.delete('search');
      }
      return prev;
    });
  };

  const clearFilters = () => {
    setSearch('');
    setCategoryId('');
    setPriceRange([0, 10000000]);
    setSortBy('created_at');
    setSortOrder('desc');
    setSearchParams({});
  };

  const activeFiltersCount = [
    search,
    categoryId,
    priceRange[0] > 0 || priceRange[1] < 10000000,
  ].filter(Boolean).length;

  return (
    <Layout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Breadcrumb */}
        <nav className="flex items-center gap-2 text-sm mb-6">
          <Link to="/" className="text-slate-500 hover:text-primary">Accueil</Link>
          <span className="text-slate-400">/</span>
          <span className="text-slate-900">Produits</span>
          {categoryId && categories.find(c => c.id === categoryId) && (
            <>
              <span className="text-slate-400">/</span>
              <span className="text-slate-900">
                {categories.find(c => c.id === categoryId)?.name}
              </span>
            </>
          )}
        </nav>

        {/* Header */}
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mb-8">
          <div>
            <h1 className="section-heading">
              {categoryId && categories.find(c => c.id === categoryId)
                ? categories.find(c => c.id === categoryId)?.name
                : 'Tous les produits'}
            </h1>
            <p className="text-slate-500 mt-1">
              {products.length} produit{products.length > 1 ? 's' : ''} trouvé{products.length > 1 ? 's' : ''}
            </p>
          </div>

          <div className="flex items-center gap-3">
            {/* Sort */}
            <Select value={`${sortBy}-${sortOrder}`} onValueChange={(val) => {
              const [by, order] = val.split('-');
              setSortBy(by);
              setSortOrder(order);
            }}>
              <SelectTrigger className="w-[180px]" data-testid="sort-select">
                <SortAscending className="w-4 h-4 mr-2" />
                <SelectValue placeholder="Trier par" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="created_at-desc">Plus récents</SelectItem>
                <SelectItem value="price-asc">Prix croissant</SelectItem>
                <SelectItem value="price-desc">Prix décroissant</SelectItem>
                <SelectItem value="rating-desc">Mieux notés</SelectItem>
              </SelectContent>
            </Select>

            {/* Filter toggle (mobile) */}
            <Button 
              variant="outline" 
              className="lg:hidden"
              onClick={() => setShowFilters(!showFilters)}
              data-testid="filter-toggle"
            >
              <Funnel className="w-4 h-4 mr-2" />
              Filtres
              {activeFiltersCount > 0 && (
                <span className="ml-2 w-5 h-5 bg-accent text-white text-xs rounded-full flex items-center justify-center">
                  {activeFiltersCount}
                </span>
              )}
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
                  <button 
                    onClick={clearFilters}
                    className="text-sm text-accent hover:underline"
                    data-testid="clear-filters"
                  >
                    Effacer tout
                  </button>
                )}
              </div>

              {/* Search */}
              <div className="mb-6">
                <label className="text-sm font-semibold text-slate-700 mb-2 block">
                  Recherche
                </label>
                <form onSubmit={handleSearch} className="relative">
                  <Input
                    type="text"
                    placeholder="Mot-clé..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pr-10"
                    data-testid="search-filter-input"
                  />
                  <button 
                    type="submit"
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-primary"
                  >
                    <MagnifyingGlass className="w-5 h-5" />
                  </button>
                </form>
              </div>

              {/* Category */}
              <div className="mb-6">
                <label className="text-sm font-semibold text-slate-700 mb-2 block">
                  Catégorie
                </label>
                <Select value={categoryId || "all"} onValueChange={(value) => setCategoryId(value === "all" ? "" : value)}>
                  <SelectTrigger data-testid="category-filter">
                    <SelectValue placeholder="Toutes les catégories" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Toutes les catégories</SelectItem>
                    {categories.map((cat) => (
                      <SelectItem key={cat.id} value={cat.id}>
                        {cat.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Price range */}
              <div className="mb-6">
                <label className="text-sm font-semibold text-slate-700 mb-4 block">
                  Prix (XAF)
                </label>
                <Slider
                  value={priceRange}
                  onValueChange={setPriceRange}
                  min={0}
                  max={10000000}
                  step={50000}
                  className="mb-4"
                  data-testid="price-slider"
                />
                <div className="flex items-center justify-between text-sm text-slate-600">
                  <span>{formatPrice(priceRange[0])}</span>
                  <span>{formatPrice(priceRange[1])}</span>
                </div>
              </div>

              {/* Close button (mobile) */}
              <Button 
                className="w-full lg:hidden mt-4"
                onClick={() => setShowFilters(false)}
              >
                Appliquer les filtres
              </Button>
            </div>
          </aside>

          {/* Products grid */}
          <div className="flex-1">
            {/* Active filters */}
            {activeFiltersCount > 0 && (
              <div className="flex flex-wrap gap-2 mb-6">
                {search && (
                  <span className="inline-flex items-center gap-1 px-3 py-1 bg-primary/10 text-primary rounded-full text-sm">
                    "{search}"
                    <button onClick={() => setSearch('')}>
                      <X className="w-4 h-4" />
                    </button>
                  </span>
                )}
                {categoryId && (
                  <span className="inline-flex items-center gap-1 px-3 py-1 bg-primary/10 text-primary rounded-full text-sm">
                    {categories.find(c => c.id === categoryId)?.name}
                    <button onClick={() => setCategoryId('')}>
                      <X className="w-4 h-4" />
                    </button>
                  </span>
                )}
              </div>
            )}

            <ProductGrid products={products} loading={loading} />
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default ProductsPage;
