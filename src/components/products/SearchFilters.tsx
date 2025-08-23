"use client";

import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Filter, ChevronDown, ChevronUp } from "lucide-react";
import { useState } from "react";

interface SearchFiltersProps {
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
  onFiltersChange: (filters: Record<string, any>) => void;
  isLoading: boolean;
}

/**
 * Search Filters Component
 * 
 * Provides faceted filtering interface with:
 * - Product type filtering
 * - Price range filtering
 * - Availability filtering
 * - Category filtering
 * - Tag filtering
 * - Filter counts from faceted search
 * - Collapsible sections
 */
export function SearchFilters({ filters, facets, onFiltersChange, isLoading }: SearchFiltersProps) {
  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({});

  const toggleSection = (sectionKey: string) => {
    setCollapsedSections(prev => ({
      ...prev,
      [sectionKey]: !prev[sectionKey],
    }));
  };

  const handleTypeChange = (type: string) => {
    onFiltersChange({
      type: filters.type === type ? undefined : type,
    });
  };

  const handlePriceRangeChange = (range: { min: number; max: number | null }) => {
    onFiltersChange({
      priceMin: range.min,
      priceMax: range.max,
    });
  };

  const handleCustomPriceChange = (type: 'min' | 'max', value: string) => {
    const numValue = value === '' ? undefined : Number(value);
    
    if (type === 'min') {
      onFiltersChange({
        priceMin: numValue,
      });
    } else {
      onFiltersChange({
        priceMax: numValue,
      });
    }
  };

  const handleAvailabilityChange = (value: string, checked: boolean) => {
    if (value === 'inStock') {
      onFiltersChange({
        inStock: checked ? true : undefined,
      });
    }
  };

  const handleCategoryChange = (categoryId: string, checked: boolean) => {
    const currentCategories = filters.categoryIds || [];
    
    if (checked) {
      onFiltersChange({
        categoryIds: [...currentCategories, categoryId],
      });
    } else {
      onFiltersChange({
        categoryIds: currentCategories.filter(id => id !== categoryId),
      });
    }
  };

  const handleTagChange = (tagId: string, checked: boolean) => {
    const currentTags = filters.tagIds || [];
    
    if (checked) {
      onFiltersChange({
        tagIds: [...currentTags, tagId],
      });
    } else {
      onFiltersChange({
        tagIds: currentTags.filter(id => id !== tagId),
      });
    }
  };

  const FilterSection = ({ 
    title, 
    sectionKey, 
    children, 
    count 
  }: { 
    title: string; 
    sectionKey: string; 
    children: React.ReactNode; 
    count?: number;
  }) => {
    const isCollapsed = collapsedSections[sectionKey];
    
    return (
      <div className="space-y-3">
        <Button
          variant="ghost"
          onClick={() => toggleSection(sectionKey)}
          className="w-full justify-between p-0 h-auto font-medium text-left"
        >
          <span className="flex items-center gap-2">
            {title}
            {count !== undefined && count > 0 && (
              <Badge variant="secondary" className="text-xs">
                {count}
              </Badge>
            )}
          </span>
          {isCollapsed ? (
            <ChevronDown className="h-4 w-4" />
          ) : (
            <ChevronUp className="h-4 w-4" />
          )}
        </Button>
        
        {!isCollapsed && (
          <div className="space-y-2">
            {children}
          </div>
        )}
      </div>
    );
  };

  if (isLoading && !facets) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-sm">
            <Filter className="h-4 w-4" />
            Filters
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="space-y-2">
              <Skeleton className="h-4 w-20" />
              <div className="space-y-1">
                {[...Array(3)].map((_, j) => (
                  <div key={j} className="flex items-center gap-2">
                    <Skeleton className="h-4 w-4" />
                    <Skeleton className="h-4 flex-1" />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-sm">
          <Filter className="h-4 w-4" />
          Filters
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Product Type Filter */}
        {facets?.types && facets.types.length > 0 && (
          <>
            <FilterSection 
              title="Product Type" 
              sectionKey="type"
              count={filters.type ? 1 : 0}
            >
              <div className="space-y-2">
                {facets.types.map((type) => (
                  <div key={type.value} className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id={`type-${type.value}`}
                        checked={filters.type === type.value}
                        onCheckedChange={() => handleTypeChange(type.value)}
                      />
                      <Label 
                        htmlFor={`type-${type.value}`}
                        className="text-sm font-normal cursor-pointer"
                      >
                        {type.label}
                      </Label>
                    </div>
                    <Badge variant="outline" className="text-xs">
                      {type.count}
                    </Badge>
                  </div>
                ))}
              </div>
            </FilterSection>
            <Separator />
          </>
        )}

        {/* Price Range Filter */}
        <FilterSection 
          title="Price Range" 
          sectionKey="price"
          count={(filters.priceMin !== undefined || filters.priceMax !== undefined) ? 1 : 0}
        >
          <div className="space-y-3">
            {/* Predefined Price Ranges */}
            {facets?.priceRanges && facets.priceRanges.length > 0 && (
              <div className="space-y-2">
                {facets.priceRanges.map((range, index) => {
                  const isSelected = filters.priceMin === range.range.min && 
                                   filters.priceMax === range.range.max;
                  
                  return (
                    <div key={index} className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id={`price-${index}`}
                          checked={isSelected}
                          onCheckedChange={() => handlePriceRangeChange(range.range)}
                        />
                        <Label 
                          htmlFor={`price-${index}`}
                          className="text-sm font-normal cursor-pointer"
                        >
                          {range.label}
                        </Label>
                      </div>
                      <Badge variant="outline" className="text-xs">
                        {range.count}
                      </Badge>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Custom Price Range */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">Custom Range</Label>
              <div className="flex gap-2 items-center">
                <Input
                  type="number"
                  placeholder="Min"
                  value={filters.priceMin || ''}
                  onChange={(e) => handleCustomPriceChange('min', e.target.value)}
                  className="text-sm"
                />
                <span className="text-sm text-muted-foreground">to</span>
                <Input
                  type="number"
                  placeholder="Max"
                  value={filters.priceMax || ''}
                  onChange={(e) => handleCustomPriceChange('max', e.target.value)}
                  className="text-sm"
                />
              </div>
            </div>
          </div>
        </FilterSection>
        <Separator />

        {/* Availability Filter */}
        {facets?.availability && facets.availability.length > 0 && (
          <>
            <FilterSection 
              title="Availability" 
              sectionKey="availability"
              count={filters.inStock ? 1 : 0}
            >
              <div className="space-y-2">
                {facets.availability.map((item) => (
                  <div key={item.value} className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id={`availability-${item.value}`}
                        checked={
                          (item.value === 'inStock' && filters.inStock === true) ||
                          (filters.availability?.includes(item.value) ?? false)
                        }
                        onCheckedChange={(checked) => handleAvailabilityChange(item.value, checked as boolean)}
                      />
                      <Label 
                        htmlFor={`availability-${item.value}`}
                        className="text-sm font-normal cursor-pointer"
                      >
                        {item.label}
                      </Label>
                    </div>
                    <Badge variant="outline" className="text-xs">
                      {item.count}
                    </Badge>
                  </div>
                ))}
              </div>
            </FilterSection>
            <Separator />
          </>
        )}

        {/* Categories Filter */}
        {facets?.categories && facets.categories.length > 0 && (
          <>
            <FilterSection 
              title="Categories" 
              sectionKey="categories"
              count={filters.categoryIds?.length || 0}
            >
              <div className="space-y-2 max-h-40 overflow-y-auto">
                {facets.categories.map((category) => (
                  <div key={category.id} className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id={`category-${category.id}`}
                        checked={filters.categoryIds?.includes(category.id) ?? false}
                        onCheckedChange={(checked) => handleCategoryChange(category.id, checked as boolean)}
                      />
                      <Label 
                        htmlFor={`category-${category.id}`}
                        className="text-sm font-normal cursor-pointer"
                      >
                        {category.name}
                      </Label>
                    </div>
                    <Badge variant="outline" className="text-xs">
                      {category.count}
                    </Badge>
                  </div>
                ))}
              </div>
            </FilterSection>
            <Separator />
          </>
        )}

        {/* Tags Filter */}
        {facets?.tags && facets.tags.length > 0 && (
          <FilterSection 
            title="Tags" 
            sectionKey="tags"
            count={filters.tagIds?.length || 0}
          >
            <div className="space-y-2 max-h-40 overflow-y-auto">
              {facets.tags.map((tag) => (
                <div key={tag.id} className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id={`tag-${tag.id}`}
                      checked={filters.tagIds?.includes(tag.id) ?? false}
                      onCheckedChange={(checked) => handleTagChange(tag.id, checked as boolean)}
                    />
                    <Label 
                      htmlFor={`tag-${tag.id}`}
                      className="text-sm font-normal cursor-pointer flex items-center gap-2"
                    >
                      {tag.color && (
                        <div 
                          className="w-2 h-2 rounded-full" 
                          style={{ backgroundColor: tag.color }}
                        />
                      )}
                      {tag.name}
                    </Label>
                  </div>
                  <Badge variant="outline" className="text-xs">
                    {tag.count}
                  </Badge>
                </div>
              ))}
            </div>
          </FilterSection>
        )}
      </CardContent>
    </Card>
  );
}