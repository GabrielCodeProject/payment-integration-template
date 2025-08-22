'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Search, Filter, Download, MoreHorizontal } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';

import { ProductTable } from '@/components/admin/products/ProductTable';
import { ProductFilters } from '@/components/admin/products/ProductFilters';
import { ProductStats } from '@/components/admin/products/ProductStats';

import type { Product, ProductFilter, ProductSort } from '@/lib/validations/base/product';

interface ProductsData {
  products: Product[];
  pagination: {
    page: number;
    pages: number;
    limit: number;
    total: number;
    hasNextPage: boolean;
    hasPrevPage: boolean;
  };
  filters: ProductFilter;
}

interface ProductStatsData {
  total: number;
  active: number;
  inactive: number;
  digital: number;
  physical: number;
  subscription: number;
  oneTime: number;
  lowStock: number;
  outOfStock: number;
}

export default function AdminProductsPage() {
  const router = useRouter();
  
  // State management
  const [productsData, setProductsData] = useState<ProductsData | null>(null);
  const [stats, setStats] = useState<ProductStatsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Filter and search state
  const [searchQuery, setSearchQuery] = useState('');
  const [filters, setFilters] = useState<ProductFilter>({});
  const [showFilters, setShowFilters] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize] = useState(20);
  const [sortField, setSortField] = useState<ProductSort>('createdAt');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  
  // Selection state for bulk operations
  const [selectedProducts, setSelectedProducts] = useState<string[]>([]);
  const [bulkLoading, setBulkLoading] = useState(false);

  // Build query parameters
  const queryParams = useMemo(() => {
    const params = new URLSearchParams();
    
    if (searchQuery) params.set('search', searchQuery);
    if (filters.name) params.set('name', filters.name);
    if (filters.type) params.set('type', filters.type);
    if (filters.isActive !== undefined) params.set('isActive', filters.isActive.toString());
    if (filters.isDigital !== undefined) params.set('isDigital', filters.isDigital.toString());
    if (filters.inStock !== undefined) params.set('inStock', filters.inStock.toString());
    if (filters.priceMin !== undefined) params.set('priceMin', filters.priceMin.toString());
    if (filters.priceMax !== undefined) params.set('priceMax', filters.priceMax.toString());
    if (filters.tags && filters.tags.length > 0) params.set('tags', filters.tags.join(','));
    if (filters.createdAfter) params.set('createdAfter', filters.createdAfter.toISOString());
    if (filters.createdBefore) params.set('createdBefore', filters.createdBefore.toISOString());
    
    params.set('page', currentPage.toString());
    params.set('limit', pageSize.toString());
    params.set('sort', sortField);
    params.set('sortDirection', sortDirection);
    
    return params.toString();
  }, [searchQuery, filters, currentPage, pageSize, sortField, sortDirection]);

  // Fetch products data
  const fetchProducts = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await fetch(`/api/products?${queryParams}`);
      if (!response.ok) {
        throw new Error('Failed to fetch products');
      }
      
      const data = await response.json();
      setProductsData(data);
    } catch (error) {
      console.error('Error fetching products:', error);
      setError(error instanceof Error ? error.message : 'Failed to fetch products');
      toast.error('Failed to load products');
    } finally {
      setLoading(false);
    }
  };

  // Fetch product statistics
  const fetchStats = async () => {
    try {
      const response = await fetch('/api/admin/products/stats');
      if (!response.ok) {
        throw new Error('Failed to fetch product statistics');
      }
      
      const data = await response.json();
      setStats(data.stats);
    } catch (error) {
      console.error('Error fetching product stats:', error);
    }
  };

  // Fetch data on component mount and when query params change
  useEffect(() => {
    fetchProducts();
  }, [queryParams]);

  // Fetch stats on mount
  useEffect(() => {
    fetchStats();
  }, []);

  // Handle search
  const handleSearch = (query: string) => {
    setSearchQuery(query);
    setCurrentPage(1);
  };

  // Handle filter changes
  const handleFiltersChange = (newFilters: ProductFilter) => {
    setFilters(newFilters);
    setCurrentPage(1);
  };

  // Handle sorting
  const handleSort = (field: ProductSort, direction: 'asc' | 'desc') => {
    setSortField(field);
    setSortDirection(direction);
    setCurrentPage(1);
  };

  // Handle pagination
  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  // Handle selection
  const handleSelectionChange = (selectedIds: string[]) => {
    setSelectedProducts(selectedIds);
  };

  // Handle product deletion
  const handleDeleteProduct = async (productId: string) => {
    try {
      const response = await fetch(`/api/products/${productId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to delete product');
      }

      toast.success('Product deleted successfully');
      fetchProducts();
      fetchStats();
    } catch (error) {
      console.error('Error deleting product:', error);
      toast.error('Failed to delete product');
    }
  };

  // Handle bulk operations
  const handleBulkOperation = async (operation: string, data?: any) => {
    if (selectedProducts.length === 0) {
      toast.error('Please select at least one product');
      return;
    }

    try {
      setBulkLoading(true);
      
      const endpoint = '/api/products/bulk';
      let method = 'PATCH';
      const body = { productIds: selectedProducts };

      switch (operation) {
        case 'activate':
          body.updates = { isActive: true };
          break;
        case 'deactivate':
          body.updates = { isActive: false };
          break;
        case 'delete':
          method = 'DELETE';
          break;
        case 'priceUpdate':
          body.priceAdjustment = data;
          break;
        default:
          throw new Error('Unknown bulk operation');
      }

      const response = await fetch(endpoint, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        throw new Error(`Failed to ${operation} products`);
      }

      const result = await response.json();
      toast.success(`Successfully ${operation}d ${result.count || selectedProducts.length} products`);
      
      setSelectedProducts([]);
      fetchProducts();
      fetchStats();
    } catch (error) {
      console.error(`Error ${operation} products:`, error);
      toast.error(`Failed to ${operation} products`);
    } finally {
      setBulkLoading(false);
    }
  };

  // Handle export
  const handleExport = async () => {
    try {
      const response = await fetch(`/api/admin/products/export?${queryParams}`);
      if (!response.ok) {
        throw new Error('Failed to export products');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = url;
      a.download = `products-${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      
      toast.success('Products exported successfully');
    } catch (error) {
      console.error('Error exporting products:', error);
      toast.error('Failed to export products');
    }
  };

  if (error) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold tracking-tight">Products</h1>
        </div>
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <p className="text-muted-foreground">Error loading products: {error}</p>
              <Button 
                onClick={fetchProducts} 
                className="mt-4"
                variant="outline"
              >
                Try Again
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Products</h1>
          <p className="text-muted-foreground">
            Manage your product catalog and inventory
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button 
            variant="outline" 
            onClick={handleExport}
            disabled={loading}
          >
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
          <Button onClick={() => router.push('/admin/products/create')}>
            <Plus className="h-4 w-4 mr-2" />
            Add Product
          </Button>
        </div>
      </div>

      {/* Statistics */}
      {stats && <ProductStats stats={stats} />}

      {/* Search and Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Search & Filter</CardTitle>
          <CardDescription>
            Find and filter products by various criteria
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search products by name, SKU, or description..."
                value={searchQuery}
                onChange={(e) => handleSearch(e.target.value)}
                className="pl-10"
              />
            </div>
            <Button
              variant="outline"
              onClick={() => setShowFilters(!showFilters)}
            >
              <Filter className="h-4 w-4 mr-2" />
              Filters
              {Object.keys(filters).length > 0 && (
                <Badge variant="secondary" className="ml-2">
                  {Object.keys(filters).length}
                </Badge>
              )}
            </Button>
          </div>

          {showFilters && (
            <ProductFilters
              filters={filters}
              onFiltersChange={handleFiltersChange}
            />
          )}
        </CardContent>
      </Card>

      {/* Bulk Operations */}
      {selectedProducts.length > 0 && (
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <Badge variant="secondary">
                  {selectedProducts.length} selected
                </Badge>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleBulkOperation('activate')}
                    disabled={bulkLoading}
                  >
                    Activate
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleBulkOperation('deactivate')}
                    disabled={bulkLoading}
                  >
                    Deactivate
                  </Button>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" size="sm" disabled={bulkLoading}>
                        <MoreHorizontal className="h-4 w-4 mr-2" />
                        More Actions
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent>
                      <DropdownMenuItem
                        onClick={() => handleBulkOperation('delete')}
                        className="text-destructive"
                      >
                        Delete Selected
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSelectedProducts([])}
              >
                Clear Selection
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Products Table */}
      <Card>
        <CardHeader>
          <CardTitle>Products</CardTitle>
          <CardDescription>
            {productsData ? (
              `Showing ${productsData.products.length} of ${productsData.pagination.total} products`
            ) : (
              'Loading products...'
            )}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ProductTable
            products={productsData?.products || []}
            loading={loading}
            selectedProducts={selectedProducts}
            onSelectionChange={handleSelectionChange}
            onSort={handleSort}
            currentSort={{ field: sortField, direction: sortDirection }}
            onDeleteProduct={handleDeleteProduct}
            pagination={productsData?.pagination}
            onPageChange={handlePageChange}
          />
        </CardContent>
      </Card>
    </div>
  );
}