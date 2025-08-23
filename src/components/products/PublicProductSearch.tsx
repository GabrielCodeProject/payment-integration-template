"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { SearchFilters } from "./SearchFilters";
import { SearchResults } from "./SearchResults";
import { FilterBadges } from "./FilterBadges";
import { useDebounce } from "@/hooks/use-debounce";

interface Product {
  id: string;
  name: string;
  description?: string;
  shortDescription?: string;
  price: number;
  currency: string;
  compareAtPrice?: number;
  slug: string;
  images?: string[];
  thumbnail?: string;
  type: string;
  isActive: boolean;
  isDigital: boolean;
  inStock: boolean;
  isOnSale: boolean;
  discountPercentage?: number;
  categories: Array<{ id: string; name: string; slug: string }>;
  tags: Array<{ id: string; name: string; slug: string; color?: string }>;
  createdAt: string;
}

interface SearchState {
  query: string;
  filters: {
    type?: string;
    priceMin?: number;
    priceMax?: number;
    categoryIds?: string[];
    tagIds?: string[];
    inStock?: boolean;
    availability?: string[];
  };
  sort: string;
  page: number;
}

interface SearchResults {
  products: Product[];
  pagination: {
    page: number;
    pages: number;
    total: number;
    hasNextPage: boolean;
    hasPrevPage: boolean;
  };
  facets?: {
    types: Array<{ value: string; count: number; label: string }>;
    priceRanges: Array<{ label: string; range: { min: number; max: number | null }; count: number }>;
    availability: Array<{ label: string; value: string; count: number }>;
    categories: Array<{ id: string; name: string; slug: string; count: number }>;
    tags: Array<{ id: string; name: string; slug: string; color?: string; count: number }>;
  };
}

/**
 * Public Product Search Component
 * 
 * Provides customer-facing product search with:
 * - Real-time search with debouncing
 * - Advanced filtering with faceted counts
 * - Pagination and sorting
 * - URL state management
 * - Responsive design
 */
export function PublicProductSearch() {
  const searchParams = useSearchParams();
  const router = useRouter();

  // Initialize search state from URL parameters
  const [searchState, setSearchState] = useState<SearchState>(() => ({
    query: searchParams.get('q') || '',
    filters: {
      type: searchParams.get('type') || undefined,
      priceMin: searchParams.get('priceMin') ? Number(searchParams.get('priceMin')) : undefined,
      priceMax: searchParams.get('priceMax') ? Number(searchParams.get('priceMax')) : undefined,
      categoryIds: searchParams.get('categories')?.split(',').filter(Boolean) || [],
      tagIds: searchParams.get('tags')?.split(',').filter(Boolean) || [],
      inStock: searchParams.get('inStock') === 'true' ? true : undefined,
      availability: searchParams.get('availability')?.split(',').filter(Boolean) || [],
    },
    sort: searchParams.get('sort') || 'relevance',
    page: Number(searchParams.get('page')) || 1,
  }));

  const [results, setResults] = useState<SearchResults | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Debounce search query to avoid excessive API calls
  const debouncedQuery = useDebounce(searchState.query, 300);

  // Build API URL from search state
  const buildApiUrl = useCallback((state: SearchState, includeFacets = false) => {
    const params = new URLSearchParams();
    
    if (state.query.trim()) {
      params.set('q', state.query.trim());
    }
    
    if (state.filters.type) {
      params.set('type', state.filters.type);
    }
    
    if (state.filters.priceMin !== undefined) {
      params.set('priceMin', state.filters.priceMin.toString());
    }
    
    if (state.filters.priceMax !== undefined) {
      params.set('priceMax', state.filters.priceMax.toString());
    }
    
    if (state.filters.categoryIds && state.filters.categoryIds.length > 0) {
      params.set('categoryIds', state.filters.categoryIds.join(','));
    }
    
    if (state.filters.tagIds && state.filters.tagIds.length > 0) {
      params.set('tagIds', state.filters.tagIds.join(','));
    }
    
    if (state.filters.inStock !== undefined) {
      params.set('inStock', state.filters.inStock.toString());
    }
    
    params.set('sort', state.sort);
    params.set('page', state.page.toString());
    params.set('limit', '20');
    
    if (includeFacets) {
      params.set('facets', 'true');
    }

    // Use search endpoint if there's a query, otherwise use products endpoint
    const baseUrl = state.query.trim() ? '/api/products/search' : '/api/products';
    return `${baseUrl}?${params.toString()}`;
  }, []);

  // Update URL when search state changes
  useEffect(() => {
    const params = new URLSearchParams();
    
    if (searchState.query.trim()) {
      params.set('q', searchState.query.trim());
    }
    
    if (searchState.filters.type) {
      params.set('type', searchState.filters.type);
    }
    
    if (searchState.filters.priceMin !== undefined) {
      params.set('priceMin', searchState.filters.priceMin.toString());
    }
    
    if (searchState.filters.priceMax !== undefined) {
      params.set('priceMax', searchState.filters.priceMax.toString());
    }
    
    if (searchState.filters.categoryIds && searchState.filters.categoryIds.length > 0) {
      params.set('categories', searchState.filters.categoryIds.join(','));
    }
    
    if (searchState.filters.tagIds && searchState.filters.tagIds.length > 0) {
      params.set('tags', searchState.filters.tagIds.join(','));
    }
    
    if (searchState.filters.inStock !== undefined) {
      params.set('inStock', searchState.filters.inStock.toString());
    }
    
    if (searchState.sort !== 'relevance') {
      params.set('sort', searchState.sort);
    }
    
    if (searchState.page !== 1) {
      params.set('page', searchState.page.toString());
    }

    const newUrl = params.toString() ? `?${params.toString()}` : '';
    router.replace(`${window.location.pathname}${newUrl}`, { scroll: false });
  }, [searchState.query, searchState.filters, searchState.sort, searchState.page, router]);

  // Perform search API call
  const performSearch = useCallback(async (state: SearchState, includeFacets = false) => {
    try {
      setIsLoading(true);
      setError(null);

      const response = await fetch(buildApiUrl(state, includeFacets));
      
      if (!response.ok) {
        throw new Error(`Search failed: ${response.statusText}`);
      }

      const data = await response.json();
      
      return {
        products: data.products || data.results || [],
        pagination: data.pagination,
        facets: data.facets,
      };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Search failed';
      setError(errorMessage);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [buildApiUrl]);

  // Search effect for query and filter changes
  useEffect(() => {
    const searchWithCurrentState = async () => {
      // Reset to page 1 when search query or filters change (but not when just page changes)
      const stateForSearch = searchState.page === 1 ? searchState : { ...searchState, page: 1 };
      
      const results = await performSearch(stateForSearch, true);
      if (results) {
        setResults(results);
      }
    };

    searchWithCurrentState();
  }, [debouncedQuery, searchState.filters, searchState.sort, searchState.page, performSearch]);

  // Update search query
  const handleSearchChange = (query: string) => {
    setSearchState(prev => ({
      ...prev,
      query,
      page: 1, // Reset to first page on new search
    }));
  };

  // Clear search
  const handleClearSearch = () => {
    setSearchState(prev => ({
      ...prev,
      query: '',
      page: 1,
    }));
  };

  // Update filters
  const handleFiltersChange = (newFilters: Partial<SearchState['filters']>) => {
    setSearchState(prev => ({
      ...prev,
      filters: { ...prev.filters, ...newFilters },
      page: 1, // Reset to first page on filter change
    }));
  };

  // Update sort
  const handleSortChange = (sort: string) => {
    setSearchState(prev => ({
      ...prev,
      sort,
      page: 1,
    }));
  };

  // Update page
  const handlePageChange = (page: number) => {
    setSearchState(prev => ({
      ...prev,
      page,
    }));
  };

  // Remove individual filter
  const handleRemoveFilter = (filterType: string, value?: string) => {
    setSearchState(prev => {
      const newFilters = { ...prev.filters };
      
      switch (filterType) {
        case 'type':
          delete newFilters.type;
          break;
        case 'priceRange':
          delete newFilters.priceMin;
          delete newFilters.priceMax;
          break;
        case 'category':
          if (value && newFilters.categoryIds) {
            newFilters.categoryIds = newFilters.categoryIds.filter(id => id !== value);
            if (newFilters.categoryIds.length === 0) {
              delete newFilters.categoryIds;
            }
          }
          break;
        case 'tag':
          if (value && newFilters.tagIds) {
            newFilters.tagIds = newFilters.tagIds.filter(id => id !== value);
            if (newFilters.tagIds.length === 0) {
              delete newFilters.tagIds;
            }
          }
          break;
        case 'inStock':
          delete newFilters.inStock;
          break;
        default:
          break;
      }
      
      return {
        ...prev,
        filters: newFilters,
        page: 1,
      };
    });
  };

  // Clear all filters
  const handleClearAllFilters = () => {
    setSearchState(prev => ({
      ...prev,
      filters: {},
      page: 1,
    }));
  };

  return (
    <div className="space-y-6">
      {/* Search Input */}
      <Card className="p-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={searchState.query}
            onChange={(e) => handleSearchChange(e.target.value)}
            placeholder="Search products..."
            className="pl-10 pr-10"
          />
          {searchState.query && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleClearSearch}
              className="absolute right-2 top-1/2 h-6 w-6 -translate-y-1/2 p-0"
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
      </Card>

      {/* Filters and Results */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Sidebar Filters */}
        <div className="lg:col-span-1">
          <SearchFilters
            filters={searchState.filters}
            facets={results?.facets}
            onFiltersChange={handleFiltersChange}
            isLoading={isLoading}
          />
        </div>

        {/* Main Content */}
        <div className="lg:col-span-3 space-y-4">
          {/* Filter Badges */}
          <FilterBadges
            filters={searchState.filters}
            facets={results?.facets}
            onRemoveFilter={handleRemoveFilter}
            onClearAllFilters={handleClearAllFilters}
          />

          {/* Search Results */}
          <SearchResults
            results={results}
            isLoading={isLoading}
            error={error}
            sort={searchState.sort}
            onSortChange={handleSortChange}
            onPageChange={handlePageChange}
            searchQuery={searchState.query}
          />
        </div>
      </div>
    </div>
  );
}