"use client";

import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  Pagination, 
  PaginationContent, 
  PaginationEllipsis, 
  PaginationItem, 
  PaginationLink, 
  PaginationNext, 
  PaginationPrevious 
} from "@/components/ui/pagination";
import { 
  Search, 
  ShoppingCart, 
  Heart, 
  Package, 
  Truck, 
  AlertCircle,
  Grid3X3,
  List
} from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { useState } from "react";

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

interface SearchResultsProps {
  results: {
    products: Product[];
    pagination: {
      page: number;
      pages: number;
      total: number;
      hasNextPage: boolean;
      hasPrevPage: boolean;
    };
  } | null;
  isLoading: boolean;
  error: string | null;
  sort: string;
  onSortChange: (sort: string) => void;
  onPageChange: (page: number) => void;
  searchQuery?: string;
}

/**
 * Search Results Component
 * 
 * Displays search results with:
 * - Product cards with images, pricing, and metadata
 * - Sorting options
 * - Pagination
 * - Loading and error states
 * - Empty state handling
 * - Grid/list view toggle
 */
export function SearchResults({ 
  results, 
  isLoading, 
  error, 
  sort, 
  onSortChange, 
  onPageChange, 
  searchQuery 
}: SearchResultsProps) {
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  // Format price with currency
  const formatPrice = (price: number, currency: string = 'USD') => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
    }).format(price);
  };


  // Product Card Component
  const ProductCard = ({ product }: { product: Product }) => (
    <Card className="group hover:shadow-lg transition-all duration-200 overflow-hidden">
      <div className="relative">
        {/* Product Image */}
        <div className="aspect-square relative bg-muted">
          {product.thumbnail || product.images?.[0] ? (
            <Image
              src={product.thumbnail || product.images![0]}
              alt={product.name}
              fill
              className="object-cover group-hover:scale-105 transition-transform duration-200"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <Package className="h-12 w-12 text-muted-foreground" />
            </div>
          )}
          
          {/* Sale Badge */}
          {product.isOnSale && product.discountPercentage && (
            <Badge 
              variant="destructive" 
              className="absolute top-2 left-2 z-10"
            >
              -{product.discountPercentage}%
            </Badge>
          )}

          {/* Stock Status */}
          {!product.inStock && (
            <Badge 
              variant="secondary" 
              className="absolute top-2 right-2 z-10"
            >
              Out of Stock
            </Badge>
          )}

          {/* Action Buttons Overlay */}
          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors duration-200 flex items-center justify-center opacity-0 group-hover:opacity-100">
            <div className="flex gap-2">
              <Button size="sm" variant="secondary">
                <Heart className="h-4 w-4" />
              </Button>
              <Button size="sm" disabled={!product.inStock}>
                <ShoppingCart className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>

        <CardContent className="p-4">
          <div className="space-y-2">
            {/* Product Name */}
            <Link 
              href={`/products/${product.slug}`}
              className="font-semibold hover:text-primary transition-colors line-clamp-2"
            >
              {product.name}
            </Link>

            {/* Product Description */}
            {product.shortDescription && (
              <p className="text-sm text-muted-foreground line-clamp-2">
                {product.shortDescription}
              </p>
            )}

            {/* Product Type & Shipping Info */}
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              {product.isDigital ? (
                <Badge variant="outline" className="text-xs">
                  <Package className="h-3 w-3 mr-1" />
                  Digital
                </Badge>
              ) : (
                <Badge variant="outline" className="text-xs">
                  <Truck className="h-3 w-3 mr-1" />
                  Physical
                </Badge>
              )}
              
              {product.type === 'SUBSCRIPTION' && (
                <Badge variant="outline" className="text-xs">
                  Subscription
                </Badge>
              )}
            </div>

            {/* Categories & Tags */}
            <div className="flex flex-wrap gap-1">
              {product.categories.slice(0, 2).map((category) => (
                <Badge key={category.id} variant="secondary" className="text-xs">
                  {category.name}
                </Badge>
              ))}
              {product.tags.slice(0, 2).map((tag) => (
                <Badge 
                  key={tag.id} 
                  variant="outline" 
                  className="text-xs"
                  style={tag.color ? { borderColor: tag.color, color: tag.color } : {}}
                >
                  {tag.name}
                </Badge>
              ))}
            </div>

            {/* Pricing */}
            <div className="flex items-center gap-2">
              <span className="font-bold text-lg">
                {formatPrice(product.price, product.currency)}
              </span>
              {product.compareAtPrice && (
                <span className="text-sm text-muted-foreground line-through">
                  {formatPrice(product.compareAtPrice, product.currency)}
                </span>
              )}
            </div>

            {/* Action Button */}
            <Button 
              className="w-full" 
              size="sm" 
              disabled={!product.inStock}
            >
              {product.inStock ? 'Add to Cart' : 'Out of Stock'}
            </Button>
          </div>
        </CardContent>
      </div>
    </Card>
  );

  // List View Product Component
  const ProductListItem = ({ product }: { product: Product }) => (
    <Card className="p-4 hover:shadow-md transition-shadow duration-200">
      <div className="flex gap-4">
        {/* Product Image */}
        <div className="w-24 h-24 relative bg-muted rounded flex-shrink-0">
          {product.thumbnail || product.images?.[0] ? (
            <Image
              src={product.thumbnail || product.images![0]}
              alt={product.name}
              fill
              className="object-cover rounded"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <Package className="h-8 w-8 text-muted-foreground" />
            </div>
          )}
        </div>

        {/* Product Details */}
        <div className="flex-1 space-y-2">
          <div className="flex items-start justify-between">
            <div>
              <Link 
                href={`/products/${product.slug}`}
                className="font-semibold hover:text-primary transition-colors"
              >
                {product.name}
              </Link>
              {product.shortDescription && (
                <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                  {product.shortDescription}
                </p>
              )}
            </div>

            {/* Pricing */}
            <div className="text-right">
              <div className="font-bold text-lg">
                {formatPrice(product.price, product.currency)}
              </div>
              {product.compareAtPrice && (
                <div className="text-sm text-muted-foreground line-through">
                  {formatPrice(product.compareAtPrice, product.currency)}
                </div>
              )}
            </div>
          </div>

          {/* Meta Information */}
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            {product.isDigital ? (
              <Badge variant="outline" className="text-xs">
                <Package className="h-3 w-3 mr-1" />
                Digital
              </Badge>
            ) : (
              <Badge variant="outline" className="text-xs">
                <Truck className="h-3 w-3 mr-1" />
                Physical
              </Badge>
            )}
            
            {!product.inStock && (
              <Badge variant="secondary" className="text-xs">
                Out of Stock
              </Badge>
            )}

            {product.isOnSale && product.discountPercentage && (
              <Badge variant="destructive" className="text-xs">
                -{product.discountPercentage}% Off
              </Badge>
            )}
          </div>

          {/* Categories & Tags */}
          <div className="flex flex-wrap gap-1">
            {product.categories.slice(0, 3).map((category) => (
              <Badge key={category.id} variant="secondary" className="text-xs">
                {category.name}
              </Badge>
            ))}
            {product.tags.slice(0, 3).map((tag) => (
              <Badge 
                key={tag.id} 
                variant="outline" 
                className="text-xs"
                style={tag.color ? { borderColor: tag.color, color: tag.color } : {}}
              >
                {tag.name}
              </Badge>
            ))}
          </div>

          {/* Actions */}
          <div className="flex gap-2 pt-2">
            <Button size="sm" disabled={!product.inStock}>
              <ShoppingCart className="h-4 w-4 mr-2" />
              {product.inStock ? 'Add to Cart' : 'Out of Stock'}
            </Button>
            <Button size="sm" variant="outline">
              <Heart className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </Card>
  );

  // Loading skeleton
  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <Skeleton className="h-8 w-32" />
          <Skeleton className="h-10 w-40" />
        </div>
        <div className={`grid ${viewMode === 'grid' ? 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3' : 'grid-cols-1'} gap-4`}>
          {[...Array(6)].map((_, i) => (
            <Card key={i} className="overflow-hidden">
              <Skeleton className="aspect-square" />
              <CardContent className="p-4 space-y-2">
                <Skeleton className="h-5 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
                <Skeleton className="h-6 w-20" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          {error}
        </AlertDescription>
      </Alert>
    );
  }

  // No results
  if (!results || results.products.length === 0) {
    return (
      <Card className="p-12 text-center">
        <div className="space-y-4">
          <Search className="h-12 w-12 text-muted-foreground mx-auto" />
          <div>
            <h3 className="text-lg font-semibold">No products found</h3>
            <p className="text-muted-foreground">
              {searchQuery 
                ? `No products match your search for "${searchQuery}"` 
                : "No products match your current filters"}
            </p>
          </div>
          <div className="space-y-2 text-sm text-muted-foreground">
            <p>Try:</p>
            <ul className="list-disc list-inside space-y-1">
              <li>Checking your spelling</li>
              <li>Using different keywords</li>
              <li>Removing some filters</li>
              <li>Browsing our categories</li>
            </ul>
          </div>
        </div>
      </Card>
    );
  }

  // Generate pagination items
  const generatePaginationItems = () => {
    const items = [];
    const { page, pages } = results.pagination;
    
    // Always show first page
    items.push(
      <PaginationItem key={1}>
        <PaginationLink 
          onClick={() => onPageChange(1)}
          isActive={page === 1}
        >
          1
        </PaginationLink>
      </PaginationItem>
    );

    // Add ellipsis if there's a gap
    if (page > 3) {
      items.push(<PaginationEllipsis key="ellipsis-start" />);
    }

    // Add pages around current page
    const start = Math.max(2, page - 1);
    const end = Math.min(pages - 1, page + 1);

    for (let i = start; i <= end; i++) {
      items.push(
        <PaginationItem key={i}>
          <PaginationLink 
            onClick={() => onPageChange(i)}
            isActive={page === i}
          >
            {i}
          </PaginationLink>
        </PaginationItem>
      );
    }

    // Add ellipsis if there's a gap
    if (page < pages - 2) {
      items.push(<PaginationEllipsis key="ellipsis-end" />);
    }

    // Always show last page (if more than 1 page)
    if (pages > 1) {
      items.push(
        <PaginationItem key={pages}>
          <PaginationLink 
            onClick={() => onPageChange(pages)}
            isActive={page === pages}
          >
            {pages}
          </PaginationLink>
        </PaginationItem>
      );
    }

    return items;
  };

  return (
    <div className="space-y-4">
      {/* Results Header */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div>
          <p className="text-sm text-muted-foreground">
            {searchQuery && `Search results for "${searchQuery}" • `}
            {results.pagination.total} product{results.pagination.total !== 1 ? 's' : ''} found
            {results.pagination.pages > 1 && ` • Page ${results.pagination.page} of ${results.pagination.pages}`}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* View Mode Toggle */}
          <div className="flex border rounded-md">
            <Button 
              variant={viewMode === 'grid' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('grid')}
              className="rounded-r-none"
            >
              <Grid3X3 className="h-4 w-4" />
            </Button>
            <Button 
              variant={viewMode === 'list' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('list')}
              className="rounded-l-none"
            >
              <List className="h-4 w-4" />
            </Button>
          </div>

          {/* Sort Dropdown */}
          <Select value={sort} onValueChange={onSortChange}>
            <SelectTrigger className="w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="relevance">Relevance</SelectItem>
              <SelectItem value="name">Name A-Z</SelectItem>
              <SelectItem value="price">Price: Low to High</SelectItem>
              <SelectItem value="createdAt">Newest First</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Products Grid/List */}
      <div className={`grid gap-4 ${
        viewMode === 'grid' 
          ? 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3' 
          : 'grid-cols-1'
      }`}>
        {results.products.map((product) => (
          viewMode === 'grid' ? (
            <ProductCard key={product.id} product={product} />
          ) : (
            <ProductListItem key={product.id} product={product} />
          )
        ))}
      </div>

      {/* Pagination */}
      {results.pagination.pages > 1 && (
        <div className="flex justify-center">
          <Pagination>
            <PaginationContent>
              <PaginationItem>
                <PaginationPrevious 
                  onClick={() => onPageChange(results.pagination.page - 1)}
                  className={!results.pagination.hasPrevPage ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                />
              </PaginationItem>
              
              {generatePaginationItems()}
              
              <PaginationItem>
                <PaginationNext 
                  onClick={() => onPageChange(results.pagination.page + 1)}
                  className={!results.pagination.hasNextPage ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                />
              </PaginationItem>
            </PaginationContent>
          </Pagination>
        </div>
      )}
    </div>
  );
}