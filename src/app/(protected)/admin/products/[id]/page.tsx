'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { formatDistanceToNow, format } from 'date-fns';
import { 
  ArrowLeft, 
  Edit, 
  Trash2, 
  Copy, 
  Eye, 
  EyeOff,
  ExternalLink,
  MoreHorizontal
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
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

import { StockIndicator, StockLevelBar, StockAlert } from '@/components/admin/products/StockIndicator';
import { PricingTierManager } from '@/components/admin/products/PricingTierManager';
import type { Product } from '@/lib/validations/base/product';

interface ProductAnalytics {
  totalSales: number;
  totalRevenue: number;
  averageOrderValue: number;
  conversionRate: number;
  viewsLastMonth: number;
  ordersLastMonth: number;
  revenueLastMonth: number;
}

export default function ProductDetailPage() {
  const params = useParams();
  const router = useRouter();
  const productId = params.id as string;
  
  const [product, setProduct] = useState<Product | null>(null);
  const [analytics, setAnalytics] = useState<ProductAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  // Fetch product data
  const fetchProduct = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`/api/products/${productId}`);
      
      if (!response.ok) {
        if (response.status === 404) {
          throw new Error('Product not found');
        }
        throw new Error('Failed to fetch product');
      }

      const data = await response.json();
      setProduct(data.product);
    } catch (_error) {
      // console.error('Error fetching product:', error);
      const errorMessage = _error instanceof Error ? _error.message : 'Failed to fetch product';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  }, [productId]);

  // Fetch analytics data (mock for now)
  const fetchAnalytics = useCallback(async () => {
    try {
      // Mock analytics data - in real app, this would come from your analytics API
      setAnalytics({
        totalSales: 156,
        totalRevenue: 15600,
        averageOrderValue: 100,
        conversionRate: 3.2,
        viewsLastMonth: 1250,
        ordersLastMonth: 23,
        revenueLastMonth: 2300,
      });
    } catch (_error) {
      // console.error('Error fetching analytics:', error);
    }
  }, []);

  useEffect(() => {
    if (productId) {
      fetchProduct();
      fetchAnalytics();
    }
  }, [productId, fetchProduct, fetchAnalytics]);

  // Handle delete
  const handleDelete = async () => {
    try {
      const response = await fetch(`/api/products/${productId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to delete product');
      }

      toast.success('Product deleted successfully');
      router.push('/admin/products');
    } catch (_error) {
      // console.error('Error deleting product:', error);
      toast.error('Failed to delete product');
    }
  };

  // Handle duplicate
  const handleDuplicate = () => {
    if (!product) return;
    
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

  // Toggle active status
  const toggleActiveStatus = async () => {
    if (!product) return;

    try {
      const response = await fetch(`/api/products/${productId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: productId,
          isActive: !product.isActive,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to update product status');
      }

      setProduct(prev => prev ? { ...prev, isActive: !prev.isActive } : null);
      toast.success(`Product ${!product.isActive ? 'activated' : 'deactivated'} successfully`);
    } catch (_error) {
      // console.error('Error updating product status:', error);
      toast.error('Failed to update product status');
    }
  };

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
      <Badge variant={variants[type as keyof typeof variants] || 'default'}>
        {type.replace('_', ' ')}
      </Badge>
    );
  };

  // Loading state
  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Skeleton className="h-10 w-20" />
          <div className="space-y-2">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-4 w-64" />
          </div>
        </div>
        
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            {Array.from({ length: 3 }).map((_, i) => (
              <Card key={i}>
                <CardContent className="p-6">
                  <Skeleton className="h-48 w-full" />
                </CardContent>
              </Card>
            ))}
          </div>
          <div className="space-y-6">
            {Array.from({ length: 2 }).map((_, i) => (
              <Card key={i}>
                <CardContent className="p-6">
                  <Skeleton className="h-32 w-full" />
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="outline" onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Product Details</h1>
            <p className="text-muted-foreground">View product information and analytics</p>
          </div>
        </div>

        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>

        <div className="flex gap-2">
          <Button onClick={fetchProduct}>Try Again</Button>
          <Button variant="outline" onClick={() => router.back()}>Go Back</Button>
        </div>
      </div>
    );
  }

  if (!product) {
    return null;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="outline" onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">{product.name}</h1>
            <p className="text-muted-foreground">Product Details & Analytics</p>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => router.push(`/admin/products/edit/${product.id}`)}>
            <Edit className="h-4 w-4 mr-2" />
            Edit
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={toggleActiveStatus}>
                {product.isActive ? (
                  <>
                    <EyeOff className="h-4 w-4 mr-2" />
                    Deactivate
                  </>
                ) : (
                  <>
                    <Eye className="h-4 w-4 mr-2" />
                    Activate
                  </>
                )}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleDuplicate}>
                <Copy className="h-4 w-4 mr-2" />
                Duplicate
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => window.open(`/products/${product.slug}`, '_blank')}>
                <ExternalLink className="h-4 w-4 mr-2" />
                View Public Page
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
      </div>

      {/* Stock Alert */}
      <StockAlert product={product} />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Product Overview */}
          <Card>
            <CardHeader>
              <CardTitle>Product Overview</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Product Images */}
              {product.images && product.images.length > 0 && (
                <div className="space-y-4">
                  <h4 className="font-medium">Product Images</h4>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                    {product.images.map((image, index) => (
                      <div key={index} className="relative aspect-square rounded-lg overflow-hidden bg-muted">
                        <img
                          src={image}
                          alt={`${product.name} ${index + 1}`}
                          className="h-full w-full object-cover"
                        />
                        {index === 0 && (
                          <Badge className="absolute top-2 left-2">Primary</Badge>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Description */}
              <div className="space-y-2">
                <h4 className="font-medium">Description</h4>
                {product.shortDescription && (
                  <p className="text-sm text-muted-foreground">{product.shortDescription}</p>
                )}
                {product.description && (
                  <div className="prose prose-sm max-w-none">
                    <p>{product.description}</p>
                  </div>
                )}
              </div>

              {/* Tags */}
              {product.tags && product.tags.length > 0 && (
                <div className="space-y-2">
                  <h4 className="font-medium">Tags</h4>
                  <div className="flex flex-wrap gap-2">
                    {product.tags.map((tag) => (
                      <Badge key={tag} variant="secondary">{tag}</Badge>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Analytics */}
          {analytics && (
            <Card>
              <CardHeader>
                <CardTitle>Performance Analytics</CardTitle>
                <CardDescription>
                  Sales and performance metrics for this product
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="text-center">
                    <div className="text-2xl font-bold">{analytics.totalSales}</div>
                    <div className="text-sm text-muted-foreground">Total Sales</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold">
                      {formatPrice(analytics.totalRevenue, product.currency)}
                    </div>
                    <div className="text-sm text-muted-foreground">Total Revenue</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold">
                      {formatPrice(analytics.averageOrderValue, product.currency)}
                    </div>
                    <div className="text-sm text-muted-foreground">Avg Order Value</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold">{analytics.conversionRate}%</div>
                    <div className="text-sm text-muted-foreground">Conversion Rate</div>
                  </div>
                </div>
                
                <Separator className="my-4" />
                
                <div className="grid grid-cols-3 gap-4">
                  <div className="text-center">
                    <div className="text-lg font-semibold">{analytics.viewsLastMonth}</div>
                    <div className="text-xs text-muted-foreground">Views (30d)</div>
                  </div>
                  <div className="text-center">
                    <div className="text-lg font-semibold">{analytics.ordersLastMonth}</div>
                    <div className="text-xs text-muted-foreground">Orders (30d)</div>
                  </div>
                  <div className="text-center">
                    <div className="text-lg font-semibold">
                      {formatPrice(analytics.revenueLastMonth, product.currency)}
                    </div>
                    <div className="text-xs text-muted-foreground">Revenue (30d)</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Product Info */}
          <Card>
            <CardHeader>
              <CardTitle>Product Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Status</span>
                <Badge variant={product.isActive ? 'default' : 'secondary'}>
                  {product.isActive ? 'Active' : 'Inactive'}
                </Badge>
              </div>
              
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Type</span>
                {getTypeBadge(product.type)}
              </div>
              
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">SKU</span>
                <code className="text-sm bg-muted px-2 py-1 rounded">{product.sku}</code>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Format</span>
                <Badge variant={product.isDigital ? 'secondary' : 'outline'}>
                  {product.isDigital ? 'Digital' : 'Physical'}
                </Badge>
              </div>

              {product.type === 'SUBSCRIPTION' && product.billingInterval && (
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Billing</span>
                  <span className="text-sm">{product.billingInterval.toLowerCase()}ly</span>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Pricing */}
          <Card>
            <CardHeader>
              <CardTitle>Pricing</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Price</span>
                  <span className="text-lg font-bold">
                    {formatPrice(Number(product.price), product.currency)}
                  </span>
                </div>
                
                {product.compareAtPrice && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Compare at</span>
                    <span className="text-sm line-through text-muted-foreground">
                      {formatPrice(Number(product.compareAtPrice), product.currency)}
                    </span>
                  </div>
                )}
                
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Currency</span>
                  <span className="text-sm">{product.currency}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Inventory */}
          <Card>
            <CardHeader>
              <CardTitle>Inventory</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <StockIndicator product={product} showLabel={true} />
              {!product.isDigital && (
                <StockLevelBar product={product} showPercentage={true} />
              )}
            </CardContent>
          </Card>

          {/* SEO */}
          <Card>
            <CardHeader>
              <CardTitle>SEO & URL</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <span className="text-sm font-medium">URL Slug</span>
                <code className="text-sm bg-muted px-2 py-1 rounded block">
                  /products/{product.slug}
                </code>
              </div>
              
              {product.metaTitle && (
                <div className="space-y-2">
                  <span className="text-sm font-medium">Meta Title</span>
                  <p className="text-sm text-muted-foreground">{product.metaTitle}</p>
                </div>
              )}
              
              {product.metaDescription && (
                <div className="space-y-2">
                  <span className="text-sm font-medium">Meta Description</span>
                  <p className="text-sm text-muted-foreground">{product.metaDescription}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Timestamps */}
          <Card>
            <CardHeader>
              <CardTitle>Timeline</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Created</span>
                <span className="text-sm text-muted-foreground">
                  {formatDistanceToNow(new Date(product.createdAt), { addSuffix: true })}
                </span>
              </div>
              
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Updated</span>
                <span className="text-sm text-muted-foreground">
                  {formatDistanceToNow(new Date(product.updatedAt), { addSuffix: true })}
                </span>
              </div>
              
              <div className="text-xs text-muted-foreground space-y-1">
                <div>Created: {format(new Date(product.createdAt), 'PPP')}</div>
                <div>Updated: {format(new Date(product.updatedAt), 'PPP')}</div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Pricing Tier Management */}
      <div className="mt-8">
        <PricingTierManager 
          productId={product.id}
          productName={product.name}
          productType={product.type}
        />
      </div>

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
    </div>
  );
}