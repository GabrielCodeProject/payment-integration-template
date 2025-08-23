"use client";

import React from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { X, Filter } from "lucide-react";

interface FilterBadgesProps {
  filters: {
    type?: string;
    priceMin?: number;
    priceMax?: number;
    categoryIds?: string[];
    tagIds?: string[];
    inStock?: boolean;
    availability?: string[];
  };
  facets?: {
    types: Array<{ value: string; count: number; label: string }>;
    priceRanges: Array<{ label: string; range: { min: number; max: number | null }; count: number }>;
    availability: Array<{ label: string; value: string; count: number }>;
    categories: Array<{ id: string; name: string; slug: string; count: number }>;
    tags: Array<{ id: string; name: string; slug: string; color?: string; count: number }>;
  };
  onRemoveFilter: (filterType: string, value?: string) => void;
  onClearAllFilters: () => void;
}

/**
 * Filter Badges Component
 * 
 * Displays active filters as removable badges with:
 * - Visual representation of all active filters
 * - Individual filter removal
 * - Clear all filters action
 * - Human-readable filter labels using facet data
 */
export function FilterBadges({ 
  filters, 
  facets, 
  onRemoveFilter, 
  onClearAllFilters 
}: FilterBadgesProps) {
  
  // Helper function to get product type label
  const getProductTypeLabel = (value: string) => {
    const typeInfo = facets?.types.find(type => type.value === value);
    return typeInfo?.label || value;
  };

  // Helper function to get category name
  const getCategoryName = (id: string) => {
    const category = facets?.categories.find(cat => cat.id === id);
    return category?.name || id;
  };

  // Helper function to get tag name and color
  const getTagInfo = (id: string) => {
    const tag = facets?.tags.find(t => t.id === id);
    return { name: tag?.name || id, color: tag?.color };
  };

  // Helper function to format price range
  const formatPriceRange = (min?: number, max?: number) => {
    if (min !== undefined && max !== undefined) {
      return `$${min} - $${max}`;
    } else if (min !== undefined) {
      return `From $${min}`;
    } else if (max !== undefined) {
      return `Up to $${max}`;
    }
    return '';
  };

  // Count total active filters
  const getActiveFilterCount = () => {
    let count = 0;
    if (filters.type) count++;
    if (filters.priceMin !== undefined || filters.priceMax !== undefined) count++;
    if (filters.categoryIds?.length) count += filters.categoryIds.length;
    if (filters.tagIds?.length) count += filters.tagIds.length;
    if (filters.inStock !== undefined) count++;
    return count;
  };

  const activeFilterCount = getActiveFilterCount();

  // Don't render if no filters are active
  if (activeFilterCount === 0) {
    return null;
  }

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">
            Active Filters ({activeFilterCount})
          </span>
        </div>
        
        {/* Clear All Button */}
        <Button 
          variant="ghost" 
          size="sm" 
          onClick={onClearAllFilters}
          className="text-xs text-muted-foreground hover:text-foreground"
        >
          Clear All
        </Button>
      </div>

      {/* Filter Badges */}
      <div className="flex flex-wrap gap-2">
        {/* Product Type Filter */}
        {filters.type && (
          <Badge variant="secondary" className="flex items-center gap-1">
            <span className="text-xs">Type: {getProductTypeLabel(filters.type)}</span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onRemoveFilter('type')}
              className="h-auto p-0 w-4 h-4 hover:bg-transparent"
            >
              <X className="h-3 w-3" />
            </Button>
          </Badge>
        )}

        {/* Price Range Filter */}
        {(filters.priceMin !== undefined || filters.priceMax !== undefined) && (
          <Badge variant="secondary" className="flex items-center gap-1">
            <span className="text-xs">
              Price: {formatPriceRange(filters.priceMin, filters.priceMax)}
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onRemoveFilter('priceRange')}
              className="h-auto p-0 w-4 h-4 hover:bg-transparent"
            >
              <X className="h-3 w-3" />
            </Button>
          </Badge>
        )}

        {/* In Stock Filter */}
        {filters.inStock && (
          <Badge variant="secondary" className="flex items-center gap-1">
            <span className="text-xs">In Stock</span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onRemoveFilter('inStock')}
              className="h-auto p-0 w-4 h-4 hover:bg-transparent"
            >
              <X className="h-3 w-3" />
            </Button>
          </Badge>
        )}

        {/* Category Filters */}
        {filters.categoryIds?.map((categoryId) => (
          <Badge 
            key={`category-${categoryId}`} 
            variant="secondary" 
            className="flex items-center gap-1"
          >
            <span className="text-xs">
              Category: {getCategoryName(categoryId)}
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onRemoveFilter('category', categoryId)}
              className="h-auto p-0 w-4 h-4 hover:bg-transparent"
            >
              <X className="h-3 w-3" />
            </Button>
          </Badge>
        ))}

        {/* Tag Filters */}
        {filters.tagIds?.map((tagId) => {
          const tagInfo = getTagInfo(tagId);
          return (
            <Badge 
              key={`tag-${tagId}`} 
              variant="outline"
              className="flex items-center gap-1"
              style={tagInfo.color ? { 
                borderColor: tagInfo.color, 
                color: tagInfo.color 
              } : {}}
            >
              <span className="text-xs flex items-center gap-1">
                {tagInfo.color && (
                  <div 
                    className="w-2 h-2 rounded-full" 
                    style={{ backgroundColor: tagInfo.color }}
                  />
                )}
                {tagInfo.name}
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onRemoveFilter('tag', tagId)}
                className="h-auto p-0 w-4 h-4 hover:bg-transparent"
                style={tagInfo.color ? { color: tagInfo.color } : {}}
              >
                <X className="h-3 w-3" />
              </Button>
            </Badge>
          );
        })}
      </div>
    </div>
  );
}