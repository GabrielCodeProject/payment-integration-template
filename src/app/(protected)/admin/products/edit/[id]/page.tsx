'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { toast } from 'sonner';

import { ProductForm } from '@/components/admin/products/ProductForm';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';

import type { Product } from '@/lib/validations/base/product';

export default function EditProductPage() {
  const params = useParams();
  const productId = params.id as string;
  
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch product data
  const fetchProduct = async () => {
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
      const errorMessage = error instanceof Error ? _error.message : 'Failed to fetch product';
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (productId) {
      fetchProduct();
    }
  }, [productId]);

  // Loading skeleton
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
        
        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="p-6">
                <div className="space-y-4">
                  <Skeleton className="h-6 w-32" />
                  <div className="grid grid-cols-2 gap-4">
                    <Skeleton className="h-10 w-full" />
                    <Skeleton className="h-10 w-full" />
                  </div>
                  <Skeleton className="h-20 w-full" />
                </div>
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
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="outline" onClick={() => window.history.back()}>
            ← Back
          </Button>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Edit Product</h1>
            <p className="text-muted-foreground">
              Update product details and settings
            </p>
          </div>
        </div>

        <Alert variant="destructive">
          <AlertDescription>
            {error}
          </AlertDescription>
        </Alert>

        <div className="flex gap-2">
          <Button onClick={fetchProduct}>
            Try Again
          </Button>
          <Button variant="outline" onClick={() => window.history.back()}>
            Go Back
          </Button>
        </div>
      </div>
    );
  }

  // Product not found
  if (!product) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="outline" onClick={() => window.history.back()}>
            ← Back
          </Button>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Product Not Found</h1>
            <p className="text-muted-foreground">
              The requested product could not be found
            </p>
          </div>
        </div>

        <Alert>
          <AlertDescription>
            The product you&apos;re looking for doesn&apos;t exist or may have been deleted.
          </AlertDescription>
        </Alert>

        <Button variant="outline" onClick={() => window.history.back()}>
          Go Back
        </Button>
      </div>
    );
  }

  return (
    <ProductForm 
      mode="edit"
      product={product}
    />
  );
}