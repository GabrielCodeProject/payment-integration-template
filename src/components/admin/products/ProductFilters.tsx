"use client";

import { format } from "date-fns";
import { CalendarIcon, X } from "lucide-react";
import { useEffect, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";

import type { ProductFilter } from "@/lib/validations/base/product";

interface ProductFiltersProps {
  filters: ProductFilter;
  onFiltersChange: (filters: ProductFilter) => void;
}

export function ProductFilters({
  filters,
  onFiltersChange,
}: ProductFiltersProps) {
  const [localFilters, setLocalFilters] = useState<ProductFilter>(filters);
  const [priceRange, setPriceRange] = useState({
    min: filters.priceMin?.toString() || "",
    max: filters.priceMax?.toString() || "",
  });
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<string[]>(
    filters.categoryIds || []
  );
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>(
    filters.tagIds || []
  );
  const [availableCategories, setAvailableCategories] = useState<any[]>([]);
  const [availableTags, setAvailableTags] = useState<any[]>([]);
  const [loadingCategories, setLoadingCategories] = useState(true);
  const [loadingTags, setLoadingTags] = useState(true);

  // Fetch available categories
  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const response = await fetch("/api/categories?limit=100");
        if (response.ok) {
          const data = await response.json();
          setAvailableCategories(data.categories);
        }
      } catch (_error) {
        console.error("Error fetching categories:", _error);
      } finally {
        setLoadingCategories(false);
      }
    };

    fetchCategories();
  }, []);

  // Fetch available tags
  useEffect(() => {
    const fetchTags = async () => {
      try {
        const response = await fetch("/api/tags?limit=100");
        if (response.ok) {
          const data = await response.json();
          setAvailableTags(data.tags);
        }
      } catch (_error) {
        console.error("Error fetching tags:", _error);
      } finally {
        setLoadingTags(false);
      }
    };

    fetchTags();
  }, []);

  // Update local state when filters prop changes
  useEffect(() => {
    setLocalFilters(filters);
    setPriceRange({
      min: filters.priceMin?.toString() || "",
      max: filters.priceMax?.toString() || "",
    });
    setSelectedCategoryIds(filters.categoryIds || []);
    setSelectedTagIds(filters.tagIds || []);
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

    // Handle categories
    if (selectedCategoryIds.length > 0) {
      newFilters.categoryIds = selectedCategoryIds;
    } else {
      delete newFilters.categoryIds;
    }

    // Handle tags
    if (selectedTagIds.length > 0) {
      newFilters.tagIds = selectedTagIds;
    } else {
      delete newFilters.tagIds;
    }

    onFiltersChange(newFilters);
  };

  // Clear all filters
  const clearFilters = () => {
    setLocalFilters({});
    setPriceRange({ min: "", max: "" });
    setSelectedCategoryIds([]);
    setSelectedTagIds([]);
    onFiltersChange({});
  };

  // Clear individual filter
  const clearFilter = (key: keyof ProductFilter) => {
    const newFilters = { ...localFilters };
    delete newFilters[key];
    setLocalFilters(newFilters);

    if (key === "priceMin") {
      setPriceRange((prev) => ({ ...prev, min: "" }));
    } else if (key === "priceMax") {
      setPriceRange((prev) => ({ ...prev, max: "" }));
    } else if (key === "categoryIds") {
      setSelectedCategoryIds([]);
    } else if (key === "tagIds") {
      setSelectedTagIds([]);
    }

    onFiltersChange(newFilters);
  };

  // Update local filter
  const updateFilter = (key: keyof ProductFilter, value: any) => {
    setLocalFilters((prev) => ({
      ...prev,
      [key]: value,
    }));
  };

  // Get active filters count
  const activeFiltersCount = Object.keys(filters).length;

  return (
    <div className="bg-muted/50 space-y-6 rounded-lg border p-4">
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

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {/* Product Name */}
        <div className="space-y-2">
          <Label htmlFor="filter-name">Product Name</Label>
          <div className="relative">
            <Input
              id="filter-name"
              placeholder="Filter by name..."
              value={localFilters.name || ""}
              onChange={(e) =>
                updateFilter("name", e.target.value || undefined)
              }
            />
            {localFilters.name && (
              <Button
                variant="ghost"
                size="sm"
                className="absolute top-1 right-1 h-6 w-6 p-0"
                onClick={() => clearFilter("name")}
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
            value={localFilters.type || "all"}
            onValueChange={(value) =>
              updateFilter("type", value === "all" ? undefined : value)
            }
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

        {/* Status - Note: Main status filtering is now handled by quick filters above */}
        <div className="space-y-2">
          <Label>Status (Advanced)</Label>
          <Select
            value={
              localFilters.isActive === undefined
                ? "all"
                : localFilters.isActive.toString()
            }
            onValueChange={(value) =>
              updateFilter(
                "isActive",
                value === "all" ? undefined : value === "true"
              )
            }
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
          <p className="text-muted-foreground text-xs">
            Use the quick status filters above for common filtering tasks
          </p>
        </div>

        {/* Digital/Physical */}
        <div className="space-y-2">
          <Label>Product Format</Label>
          <Select
            value={
              localFilters.isDigital === undefined
                ? "all"
                : localFilters.isDigital.toString()
            }
            onValueChange={(value) =>
              updateFilter(
                "isDigital",
                value === "all" ? undefined : value === "true"
              )
            }
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
            value={
              localFilters.inStock === undefined
                ? "all"
                : localFilters.inStock.toString()
            }
            onValueChange={(value) =>
              updateFilter(
                "inStock",
                value === "all" ? undefined : value === "true"
              )
            }
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
            onChange={(e) =>
              setPriceRange((prev) => ({ ...prev, min: e.target.value }))
            }
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
            onChange={(e) =>
              setPriceRange((prev) => ({ ...prev, max: e.target.value }))
            }
          />
        </div>

        {/* Categories */}
        <div className="space-y-2">
          <Label>Categories</Label>
          {loadingCategories ? (
            <Skeleton className="h-10 w-full" />
          ) : (
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="w-full justify-start">
                  {selectedCategoryIds.length === 0
                    ? "Select categories..."
                    : `${selectedCategoryIds.length} selected`}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-80 p-3">
                <div className="space-y-2">
                  <Label className="text-sm font-medium">
                    Select Categories
                  </Label>
                  <div className="max-h-48 space-y-2 overflow-y-auto">
                    {availableCategories.map((category) => (
                      <div
                        key={category.id}
                        className="flex items-center space-x-2"
                      >
                        <Checkbox
                          id={`filter-category-${category.id}`}
                          checked={selectedCategoryIds.includes(category.id)}
                          onCheckedChange={(checked) => {
                            if (checked) {
                              setSelectedCategoryIds([
                                ...selectedCategoryIds,
                                category.id,
                              ]);
                            } else {
                              setSelectedCategoryIds(
                                selectedCategoryIds.filter(
                                  (id) => id !== category.id
                                )
                              );
                            }
                          }}
                        />
                        <Label
                          htmlFor={`filter-category-${category.id}`}
                          className="cursor-pointer text-sm"
                        >
                          {category.name}
                        </Label>
                      </div>
                    ))}
                  </div>
                </div>
              </PopoverContent>
            </Popover>
          )}
        </div>

        {/* Tags */}
        <div className="space-y-2">
          <Label>Tags</Label>
          {loadingTags ? (
            <Skeleton className="h-10 w-full" />
          ) : (
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="w-full justify-start">
                  {selectedTagIds.length === 0
                    ? "Select tags..."
                    : `${selectedTagIds.length} selected`}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-80 p-3">
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Select Tags</Label>
                  <div className="max-h-48 space-y-2 overflow-y-auto">
                    {availableTags.map((tag) => (
                      <div key={tag.id} className="flex items-center space-x-2">
                        <Checkbox
                          id={`filter-tag-${tag.id}`}
                          checked={selectedTagIds.includes(tag.id)}
                          onCheckedChange={(checked) => {
                            if (checked) {
                              setSelectedTagIds([...selectedTagIds, tag.id]);
                            } else {
                              setSelectedTagIds(
                                selectedTagIds.filter((id) => id !== tag.id)
                              );
                            }
                          }}
                        />
                        <div
                          className="h-3 w-3 rounded-full"
                          style={{ backgroundColor: tag.color || "#6366f1" }}
                        />
                        <Label
                          htmlFor={`filter-tag-${tag.id}`}
                          className="cursor-pointer text-sm"
                        >
                          {tag.name}
                        </Label>
                      </div>
                    ))}
                  </div>
                </div>
              </PopoverContent>
            </Popover>
          )}
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
                  format(localFilters.createdAfter, "PPP")
                ) : (
                  <span>Pick a date</span>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0">
              <Calendar
                mode="single"
                selected={localFilters.createdAfter}
                onSelect={(date) => updateFilter("createdAfter", date)}
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
                  format(localFilters.createdBefore, "PPP")
                ) : (
                  <span>Pick a date</span>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0">
              <Calendar
                mode="single"
                selected={localFilters.createdBefore}
                onSelect={(date) => updateFilter("createdBefore", date)}
                initialFocus
              />
            </PopoverContent>
          </Popover>
        </div>
      </div>

      {/* Apply/Clear Actions */}
      <div className="flex items-center justify-end gap-2 border-t pt-4">
        <Button variant="outline" onClick={clearFilters}>
          Clear All
        </Button>
        <Button onClick={applyFilters}>Apply Filters</Button>
      </div>

      {/* Active Filters Display */}
      {activeFiltersCount > 0 && (
        <div className="space-y-2">
          <Label className="text-muted-foreground text-xs">
            Active Filters:
          </Label>
          <div className="flex flex-wrap gap-1">
            {filters.name && (
              <Badge variant="secondary" className="gap-1">
                Name: {filters.name}
                <Button
                  variant="ghost"
                  size="sm"
                  className="ml-1 h-auto w-auto p-0"
                  onClick={() => clearFilter("name")}
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
                  className="ml-1 h-auto w-auto p-0"
                  onClick={() => clearFilter("type")}
                >
                  <X className="h-3 w-3" />
                </Button>
              </Badge>
            )}
            {filters.isActive !== undefined && (
              <Badge variant="secondary" className="gap-1">
                Status: {filters.isActive ? "Active" : "Inactive"}
                <Button
                  variant="ghost"
                  size="sm"
                  className="ml-1 h-auto w-auto p-0"
                  onClick={() => clearFilter("isActive")}
                >
                  <X className="h-3 w-3" />
                </Button>
              </Badge>
            )}
            {filters.isDigital !== undefined && (
              <Badge variant="secondary" className="gap-1">
                Format: {filters.isDigital ? "Digital" : "Physical"}
                <Button
                  variant="ghost"
                  size="sm"
                  className="ml-1 h-auto w-auto p-0"
                  onClick={() => clearFilter("isDigital")}
                >
                  <X className="h-3 w-3" />
                </Button>
              </Badge>
            )}
            {filters.inStock !== undefined && (
              <Badge variant="secondary" className="gap-1">
                Stock: {filters.inStock ? "In Stock" : "Out of Stock"}
                <Button
                  variant="ghost"
                  size="sm"
                  className="ml-1 h-auto w-auto p-0"
                  onClick={() => clearFilter("inStock")}
                >
                  <X className="h-3 w-3" />
                </Button>
              </Badge>
            )}
            {(filters.priceMin !== undefined ||
              filters.priceMax !== undefined) && (
              <Badge variant="secondary" className="gap-1">
                Price: {filters.priceMin || "0"} - {filters.priceMax || "∞"}
                <Button
                  variant="ghost"
                  size="sm"
                  className="ml-1 h-auto w-auto p-0"
                  onClick={() => {
                    clearFilter("priceMin");
                    clearFilter("priceMax");
                  }}
                >
                  <X className="h-3 w-3" />
                </Button>
              </Badge>
            )}
            {filters.categoryIds && filters.categoryIds.length > 0 && (
              <Badge variant="secondary" className="gap-1">
                Categories: {filters.categoryIds.length} selected
                <Button
                  variant="ghost"
                  size="sm"
                  className="ml-1 h-auto w-auto p-0"
                  onClick={() => clearFilter("categoryIds")}
                >
                  <X className="h-3 w-3" />
                </Button>
              </Badge>
            )}
            {filters.tagIds && filters.tagIds.length > 0 && (
              <Badge variant="secondary" className="gap-1">
                Tags: {filters.tagIds.length} selected
                <Button
                  variant="ghost"
                  size="sm"
                  className="ml-1 h-auto w-auto p-0"
                  onClick={() => clearFilter("tagIds")}
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
