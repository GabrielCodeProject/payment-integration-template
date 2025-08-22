'use client';

import { useState, useEffect } from 'react';
import { X, CalendarIcon } from 'lucide-react';
import { format } from 'date-fns';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

import type { ProductFilter } from '@/lib/validations/base/product';

interface ProductFiltersProps {
  filters: ProductFilter;
  onFiltersChange: (filters: ProductFilter) => void;
}

export function ProductFilters({ filters, onFiltersChange }: ProductFiltersProps) {
  const [localFilters, setLocalFilters] = useState<ProductFilter>(filters);
  const [priceRange, setPriceRange] = useState({
    min: filters.priceMin?.toString() || '',
    max: filters.priceMax?.toString() || '',
  });
  const [tagsInput, setTagsInput] = useState(filters.tags?.join(', ') || '');

  // Update local state when filters prop changes
  useEffect(() => {
    setLocalFilters(filters);
    setPriceRange({
      min: filters.priceMin?.toString() || '',
      max: filters.priceMax?.toString() || '',
    });
    setTagsInput(filters.tags?.join(', ') || '');
  }, [filters]);

  // Apply filters
  const applyFilters = () => {
    const newFilters: ProductFilter = { ...localFilters };
    
    // Handle price range
    if (priceRange.min) {
      newFilters.priceMin = parseFloat(priceRange.min);
    } else {
      delete newFilters.priceMin;
    }
    
    if (priceRange.max) {
      newFilters.priceMax = parseFloat(priceRange.max);
    } else {
      delete newFilters.priceMax;
    }

    // Handle tags
    if (tagsInput.trim()) {
      newFilters.tags = tagsInput
        .split(',')
        .map(tag => tag.trim())
        .filter(Boolean);
    } else {
      delete newFilters.tags;
    }

    onFiltersChange(newFilters);
  };

  // Clear all filters
  const clearFilters = () => {
    setLocalFilters({});
    setPriceRange({ min: '', max: '' });
    setTagsInput('');
    onFiltersChange({});
  };

  // Clear individual filter
  const clearFilter = (key: keyof ProductFilter) => {
    const newFilters = { ...localFilters };
    delete newFilters[key];
    setLocalFilters(newFilters);
    
    if (key === 'priceMin') {
      setPriceRange(prev => ({ ...prev, min: '' }));
    } else if (key === 'priceMax') {
      setPriceRange(prev => ({ ...prev, max: '' }));
    } else if (key === 'tags') {
      setTagsInput('');
    }
    
    onFiltersChange(newFilters);
  };

  // Update local filter
  const updateFilter = (key: keyof ProductFilter, value: any) => {
    setLocalFilters(prev => ({
      ...prev,
      [key]: value,
    }));
  };

  // Get active filters count
  const activeFiltersCount = Object.keys(filters).length;

  return (
    <div className="space-y-6 p-4 border rounded-lg bg-muted/50">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium">Filters</h3>
        {activeFiltersCount > 0 && (
          <div className="flex items-center gap-2">
            <Badge variant="secondary">{activeFiltersCount} active</Badge>
            <Button variant="ghost" size="sm" onClick={clearFilters}>
              Clear All
            </Button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {/* Product Name */}
        <div className="space-y-2">
          <Label htmlFor="filter-name">Product Name</Label>
          <div className="relative">
            <Input
              id="filter-name"
              placeholder="Filter by name..."
              value={localFilters.name || ''}
              onChange={(e) => updateFilter('name', e.target.value || undefined)}
            />
            {localFilters.name && (
              <Button
                variant="ghost"
                size="sm"
                className="absolute right-1 top-1 h-6 w-6 p-0"
                onClick={() => clearFilter('name')}
              >
                <X className="h-3 w-3" />
              </Button>
            )}
          </div>
        </div>

        {/* Product Type */}
        <div className="space-y-2">
          <Label>Product Type</Label>
          <Select
            value={localFilters.type || 'all'}
            onValueChange={(value) => updateFilter('type', value === 'all' ? undefined : value)}
          >
            <SelectTrigger>
              <SelectValue placeholder="All types" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              <SelectItem value="ONE_TIME">One Time</SelectItem>
              <SelectItem value="SUBSCRIPTION">Subscription</SelectItem>
              <SelectItem value="USAGE_BASED">Usage Based</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Status */}
        <div className="space-y-2">
          <Label>Status</Label>
          <Select
            value={localFilters.isActive === undefined ? 'all' : localFilters.isActive.toString()}
            onValueChange={(value) => updateFilter('isActive', value === 'all' ? undefined : value === 'true')}
          >
            <SelectTrigger>
              <SelectValue placeholder="All statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="true">Active</SelectItem>
              <SelectItem value="false">Inactive</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Digital/Physical */}
        <div className="space-y-2">
          <Label>Product Format</Label>
          <Select
            value={localFilters.isDigital === undefined ? 'all' : localFilters.isDigital.toString()}
            onValueChange={(value) => updateFilter('isDigital', value === 'all' ? undefined : value === 'true')}
          >
            <SelectTrigger>
              <SelectValue placeholder="All formats" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Formats</SelectItem>
              <SelectItem value="true">Digital</SelectItem>
              <SelectItem value="false">Physical</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Stock Status */}
        <div className="space-y-2">
          <Label>Stock Status</Label>
          <Select
            value={localFilters.inStock === undefined ? 'all' : localFilters.inStock.toString()}
            onValueChange={(value) => updateFilter('inStock', value === 'all' ? undefined : value === 'true')}
          >
            <SelectTrigger>
              <SelectValue placeholder="All stock levels" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Stock Levels</SelectItem>
              <SelectItem value="true">In Stock</SelectItem>
              <SelectItem value="false">Out of Stock</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Price Range - Min */}
        <div className="space-y-2">
          <Label htmlFor="filter-price-min">Min Price</Label>
          <Input
            id="filter-price-min"
            type="number"
            placeholder="0.00"
            value={priceRange.min}
            onChange={(e) => setPriceRange(prev => ({ ...prev, min: e.target.value }))}
          />
        </div>

        {/* Price Range - Max */}
        <div className="space-y-2">
          <Label htmlFor="filter-price-max">Max Price</Label>
          <Input
            id="filter-price-max"
            type="number"
            placeholder="999.99"
            value={priceRange.max}
            onChange={(e) => setPriceRange(prev => ({ ...prev, max: e.target.value }))}
          />
        </div>

        {/* Tags */}
        <div className="space-y-2">
          <Label htmlFor="filter-tags">Tags</Label>
          <Input
            id="filter-tags"
            placeholder="tag1, tag2, tag3"
            value={tagsInput}
            onChange={(e) => setTagsInput(e.target.value)}
          />
        </div>

        {/* Created After */}
        <div className="space-y-2">
          <Label>Created After</Label>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className="w-full justify-start text-left font-normal"
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {localFilters.createdAfter ? (
                  format(localFilters.createdAfter, 'PPP')
                ) : (
                  <span>Pick a date</span>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0">
              <Calendar
                mode="single"
                selected={localFilters.createdAfter}
                onSelect={(date) => updateFilter('createdAfter', date)}
                initialFocus
              />
            </PopoverContent>
          </Popover>
        </div>

        {/* Created Before */}
        <div className="space-y-2">
          <Label>Created Before</Label>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className="w-full justify-start text-left font-normal"
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {localFilters.createdBefore ? (
                  format(localFilters.createdBefore, 'PPP')
                ) : (
                  <span>Pick a date</span>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0">
              <Calendar
                mode="single"
                selected={localFilters.createdBefore}
                onSelect={(date) => updateFilter('createdBefore', date)}
                initialFocus
              />
            </PopoverContent>
          </Popover>
        </div>
      </div>

      {/* Apply/Clear Actions */}
      <div className="flex items-center justify-end gap-2 pt-4 border-t">
        <Button variant="outline" onClick={clearFilters}>
          Clear All
        </Button>
        <Button onClick={applyFilters}>
          Apply Filters
        </Button>
      </div>

      {/* Active Filters Display */}
      {activeFiltersCount > 0 && (
        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground">Active Filters:</Label>
          <div className="flex flex-wrap gap-1">
            {filters.name && (
              <Badge variant="secondary" className="gap-1">
                Name: {filters.name}
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-auto w-auto p-0 ml-1"
                  onClick={() => clearFilter('name')}
                >
                  <X className="h-3 w-3" />
                </Button>
              </Badge>
            )}
            {filters.type && (
              <Badge variant="secondary" className="gap-1">
                Type: {filters.type}
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-auto w-auto p-0 ml-1"
                  onClick={() => clearFilter('type')}
                >
                  <X className="h-3 w-3" />
                </Button>
              </Badge>
            )}
            {filters.isActive !== undefined && (
              <Badge variant="secondary" className="gap-1">
                Status: {filters.isActive ? 'Active' : 'Inactive'}
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-auto w-auto p-0 ml-1"
                  onClick={() => clearFilter('isActive')}
                >
                  <X className="h-3 w-3" />
                </Button>
              </Badge>
            )}
            {filters.isDigital !== undefined && (
              <Badge variant="secondary" className="gap-1">
                Format: {filters.isDigital ? 'Digital' : 'Physical'}
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-auto w-auto p-0 ml-1"
                  onClick={() => clearFilter('isDigital')}
                >
                  <X className="h-3 w-3" />
                </Button>
              </Badge>
            )}
            {filters.inStock !== undefined && (
              <Badge variant="secondary" className="gap-1">
                Stock: {filters.inStock ? 'In Stock' : 'Out of Stock'}
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-auto w-auto p-0 ml-1"
                  onClick={() => clearFilter('inStock')}
                >
                  <X className="h-3 w-3" />
                </Button>
              </Badge>
            )}
            {(filters.priceMin !== undefined || filters.priceMax !== undefined) && (
              <Badge variant="secondary" className="gap-1">
                Price: {filters.priceMin || '0'} - {filters.priceMax || '∞'}
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-auto w-auto p-0 ml-1"
                  onClick={() => {
                    clearFilter('priceMin');
                    clearFilter('priceMax');
                  }}
                >
                  <X className="h-3 w-3" />
                </Button>
              </Badge>
            )}
            {filters.tags && filters.tags.length > 0 && (
              <Badge variant="secondary" className="gap-1">
                Tags: {filters.tags.join(', ')}
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-auto w-auto p-0 ml-1"
                  onClick={() => clearFilter('tags')}
                >
                  <X className="h-3 w-3" />
                </Button>
              </Badge>
            )}
          </div>
        </div>
      )}
    </div>
  );
}