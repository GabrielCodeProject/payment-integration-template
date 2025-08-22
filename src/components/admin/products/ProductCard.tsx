'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { MoreHorizontal, Edit, Trash2, Eye, Copy, ExternalLink } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

import { Card, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

import { StockIndicator } from './StockIndicator';
import type { Product } from '@/lib/validations/base/product';

interface ProductCardProps {
  product: Product;
  onDelete?: (productId: string) => void;
  onUpdate?: (product: Product) => void;
  selectable?: boolean;
  selected?: boolean;
  onSelect?: (selected: boolean) => void;
}

export function ProductCard({ 
  product, 
  onDelete, 
  onUpdate: _onUpdate,
  selectable = false,
  selected = false,
  onSelect 
}: ProductCardProps) {
  const router = useRouter();
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  // Format price
  const formatPrice = (price: number, currency: string = 'USD') => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency,
    }).format(price);
  };

  // Get product type badge
  const getTypeBadge = (type: string) => {
    const variants = {
      ONE_TIME: 'default',
      SUBSCRIPTION: 'secondary',
      USAGE_BASED: 'outline',
    } as const;
    
    return (
      <Badge variant={variants[type as keyof typeof variants] || 'default'} className="text-xs">
        {type.replace('_', ' ')}
      </Badge>
    );
  };

  // Get status badge
  const getStatusBadge = (isActive: boolean) => {
    return (
      <Badge variant={isActive ? 'default' : 'secondary'} className="text-xs">
        {isActive ? 'Active' : 'Inactive'}
      </Badge>
    );
  };

  // Handle delete
  const handleDelete = () => {
    if (onDelete) {
      onDelete(product.id);
    }
    setDeleteDialogOpen(false);
  };

  // Handle duplicate
  const handleDuplicate = () => {
    const duplicateData = {
      ...product,
      name: `${product.name} (Copy)`,
      sku: `${product.sku}-copy-${Date.now()}`,
      slug: `${product.slug}-copy-${Date.now()}`,
    };
    
    const params = new URLSearchParams();
    params.set('duplicate', JSON.stringify(duplicateData));
    router.push(`/admin/products/create?${params.toString()}`);
  };

  const discountPercentage = product.compareAtPrice 
    ? Math.round((1 - Number(product.price) / Number(product.compareAtPrice)) * 100)
    : undefined;

  return (
    <>
      <Card className={`group transition-all duration-200 hover:shadow-lg ${
        selected ? 'ring-2 ring-primary' : ''
      }`}>
        {/* Selectable Checkbox */}
        {selectable && (
          <div className="absolute top-2 left-2 z-10">
            <input
              type="checkbox"
              checked={selected}
              onChange={(e) => onSelect?.(e.target.checked)}
              className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
            />
          </div>
        )}

        <CardContent className="p-4">
          {/* Product Image */}
          <div className="relative aspect-square rounded-lg overflow-hidden bg-muted mb-4">
            {product.thumbnail || (product.images && product.images.length > 0) ? (
              <img
                src={product.thumbnail || product.images![0]}
                alt={product.name}
                className="h-full w-full object-cover transition-transform duration-200 group-hover:scale-105"
              />
            ) : (
              <div className="h-full w-full flex items-center justify-center text-muted-foreground">
                <span className="text-xs">No image</span>
              </div>
            )}
            
            {/* Overlay badges */}
            <div className="absolute top-2 right-2 space-y-1">
              {getStatusBadge(product.isActive)}
            </div>

            {/* Sale badge */}
            {discountPercentage && (
              <div className="absolute bottom-2 left-2">
                <Badge variant="destructive" className="text-xs">
                  -{discountPercentage}%
                </Badge>
              </div>
            )}
          </div>

          {/* Product Info */}
          <div className="space-y-3">
            {/* Title and Type */}
            <div className="space-y-1">
              <div className="flex items-start justify-between gap-2">
                <h3 className="font-semibold text-sm line-clamp-2 flex-1">{product.name}</h3>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="sm" className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100">
                      <MoreHorizontal className="h-3 w-3" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => router.push(`/admin/products/${product.id}`)}>
                      <Eye className="h-4 w-4 mr-2" />
                      View Details
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => router.push(`/admin/products/edit/${product.id}`)}>
                      <Edit className="h-4 w-4 mr-2" />
                      Edit
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={handleDuplicate}>
                      <Copy className="h-4 w-4 mr-2" />
                      Duplicate
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => window.open(`/products/${product.slug}`, '_blank')}>
                      <ExternalLink className="h-4 w-4 mr-2" />
                      View Public
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem 
                      onClick={() => setDeleteDialogOpen(true)}
                      className="text-destructive"
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
              
              <div className="flex items-center gap-2">
                {getTypeBadge(product.type)}
                <Badge variant="outline" className="text-xs">
                  {product.isDigital ? 'Digital' : 'Physical'}
                </Badge>
              </div>
            </div>

            {/* Description */}
            {product.shortDescription && (
              <p className="text-xs text-muted-foreground line-clamp-2">
                {product.shortDescription}
              </p>
            )}

            {/* SKU */}
            <div className="text-xs text-muted-foreground">
              SKU: <code className="bg-muted px-1 py-0.5 rounded text-xs">{product.sku}</code>
            </div>

            {/* Pricing */}
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="font-bold text-sm">
                  {formatPrice(Number(product.price), product.currency)}
                </span>
                {product.compareAtPrice && (
                  <span className="text-xs line-through text-muted-foreground">
                    {formatPrice(Number(product.compareAtPrice), product.currency)}
                  </span>
                )}
              </div>
              
              {product.type === 'SUBSCRIPTION' && product.billingInterval && (
                <div className="text-xs text-muted-foreground">
                  per {product.billingInterval.toLowerCase()}
                </div>
              )}
            </div>

            {/* Stock Status */}
            <StockIndicator product={product} showLabel={true} variant="compact" />

            {/* Tags */}
            {product.tags && product.tags.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {product.tags.slice(0, 3).map((tag) => (
                  <Badge key={tag} variant="outline" className="text-xs px-1 py-0">
                    {tag}
                  </Badge>
                ))}
                {product.tags.length > 3 && (
                  <Badge variant="outline" className="text-xs px-1 py-0">
                    +{product.tags.length - 3}
                  </Badge>
                )}
              </div>
            )}
          </div>
        </CardContent>

        <CardFooter className="p-4 pt-0">
          <div className="flex items-center justify-between w-full text-xs text-muted-foreground">
            <span>
              Created {formatDistanceToNow(new Date(product.createdAt), { addSuffix: true })}
            </span>
            <Button
              variant="ghost"
              size="sm"
              className="h-auto p-1 text-xs"
              onClick={() => router.push(`/admin/products/${product.id}`)}
            >
              View Details
            </Button>
          </div>
        </CardFooter>
      </Card>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Product</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete &quot;{product.name}&quot;? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}