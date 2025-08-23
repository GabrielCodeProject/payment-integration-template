'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { Save, ArrowLeft, X, Plus, Package } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Skeleton } from '@/components/ui/skeleton';
// import { Separator } from '@/components/ui/separator'; // Reserved for future use
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';

import { ProductImageUpload } from './ProductImageUpload';
import { StockAlert } from './StockIndicator';

import { createProductSchema, updateProductSchema } from '@/lib/validations/base/product';
import type { CreateProduct, UpdateProduct, Product } from '@/lib/validations/base/product';
import { createAPIHeaders } from '@/lib/utils';

interface ProductFormProps {
  product?: Product;
  mode: 'create' | 'edit';
  onSubmit?: (data: CreateProduct | UpdateProduct) => Promise<void>;
  loading?: boolean;
}

export function ProductForm({ product, mode, onSubmit, loading = false }: ProductFormProps) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [availableCategories, setAvailableCategories] = useState<any[]>([]);
  const [availableTags, setAvailableTags] = useState<any[]>([]);
  const [loadingCategories, setLoadingCategories] = useState(true);
  const [loadingTags, setLoadingTags] = useState(true);
  const [images, setImages] = useState<string[]>(product?.images || []);

  const schema = mode === 'create' ? createProductSchema : updateProductSchema;
  
  const form = useForm<CreateProduct | UpdateProduct>({
    resolver: zodResolver(schema),
    defaultValues: product ? {
      ...product,
      id: product.id,
      price: Number(product.price),
      compareAtPrice: product.compareAtPrice ? Number(product.compareAtPrice) : undefined,
      stockQuantity: product.stockQuantity ?? undefined,
      lowStockThreshold: product.lowStockThreshold ?? undefined,
    } : {
      name: '',
      description: '',
      shortDescription: '',
      price: 0,
      currency: 'USD',
      sku: '',
      slug: '',
      isActive: true,
      isDigital: false,
      requiresShipping: true,
      type: 'ONE_TIME',
      categoryIds: [],
      tagIds: [],
      images: [],
      stockQuantity: undefined,
      lowStockThreshold: undefined,
    },
  });

  const watchedFields = form.watch();
  const isDigital = form.watch('isDigital');
  const productType = form.watch('type');

  // Generate slug from name
  const generateSlug = (name: string) => {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)+/g, '');
  };

  // Generate SKU
  const generateSKU = () => {
    const prefix = isDigital ? 'DIG' : 'PHY';
    const timestamp = Date.now().toString().slice(-6);
    const random = Math.random().toString(36).substring(2, 5).toUpperCase();
    return `${prefix}-${timestamp}-${random}`;
  };

  // Auto-generate slug when name changes
  useEffect(() => {
    if (mode === 'create' && watchedFields.name && !form.getValues('slug')) {
      form.setValue('slug', generateSlug(watchedFields.name));
    }
  }, [watchedFields.name, mode, form]);

  // Fetch available categories
  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const response = await fetch('/api/categories?limit=100');
        if (response.ok) {
          const data = await response.json();
          setAvailableCategories(data.categories);
        }
      } catch (_error) {
        // console.error('Error fetching categories:', error);
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
        const response = await fetch('/api/tags?limit=100');
        if (response.ok) {
          const data = await response.json();
          setAvailableTags(data.tags);
        }
      } catch (_error) {
        // console.error('Error fetching tags:', error);
      } finally {
        setLoadingTags(false);
      }
    };

    fetchTags();
  }, []);

  // Initialize selected categories and tags for edit mode
  useEffect(() => {
    if (product && mode === 'edit') {
      if (product.categories) {
        const categoryIds = product.categories.map((cat: any) => cat.id);
        setSelectedCategories(categoryIds);
        form.setValue('categoryIds', categoryIds);
      }
      if (product.tags) {
        const tagIds = product.tags.map((tag: any) => tag.id);
        setSelectedTags(tagIds);
        form.setValue('tagIds', tagIds);
      }
    }
  }, [product, mode, form]);

  // Handle category operations
  const handleCategoryChange = (categoryId: string, checked: boolean) => {
    let newCategories: string[];
    if (checked) {
      newCategories = [...selectedCategories, categoryId];
    } else {
      newCategories = selectedCategories.filter(id => id !== categoryId);
    }
    setSelectedCategories(newCategories);
    form.setValue('categoryIds', newCategories);
  };

  // Handle tag operations
  const handleTagChange = (tagId: string, checked: boolean) => {
    let newTags: string[];
    if (checked) {
      newTags = [...selectedTags, tagId];
    } else {
      newTags = selectedTags.filter(id => id !== tagId);
    }
    setSelectedTags(newTags);
    form.setValue('tagIds', newTags);
  };

  // Handle image operations
  const handleImagesChange = (newImages: string[]) => {
    setImages(newImages);
    form.setValue('images', newImages);
  };

  // Form submission
  const handleSubmit = async (data: CreateProduct | UpdateProduct) => {
    try {
      setIsSubmitting(true);
      
      // Add categories, tags and images to form data
      data.categoryIds = selectedCategories;
      data.tagIds = selectedTags;
      data.images = images;

      if (onSubmit) {
        await onSubmit(data);
      } else {
        // Default submission logic
        const url = mode === 'create' ? '/api/products' : `/api/products/${product?.id}`;
        const method = mode === 'create' ? 'POST' : 'PATCH';

        const response = await fetch(url, {
          method,
          headers: createAPIHeaders(),
          body: JSON.stringify(data),
        });

        if (!response.ok) {
          const error = await response.json();
          
          // Handle CSRF-specific errors with helpful messages
          if (response.status === 403 && error.message?.includes('CSRF')) {
            throw new Error('Security validation failed. Please refresh the page and try again.');
          }
          
          throw new Error(error.message || `Failed to ${mode} product`);
        }

        toast.success(`Product ${mode === 'create' ? 'created' : 'updated'} successfully`);
        router.push('/admin/products');
      }
    } catch (_error) {
      // console.error(`Error ${mode}ing product:`, error);
      toast.error(_error instanceof Error ? _error.message : `Failed to ${mode} product`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="outline" size="sm" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            {mode === 'create' ? 'Create Product' : 'Edit Product'}
          </h1>
          <p className="text-muted-foreground">
            {mode === 'create' 
              ? 'Add a new product to your catalog'
              : `Update ${product?.name || 'product'} details`
            }
          </p>
        </div>
      </div>

      {/* Stock Alert for existing products */}
      {product && <StockAlert product={product} />}

      <Form {...form}>
        <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
          <Tabs defaultValue="basic" className="space-y-6">
            <TabsList>
              <TabsTrigger value="basic">Basic Info</TabsTrigger>
              <TabsTrigger value="pricing">Pricing</TabsTrigger>
              <TabsTrigger value="inventory">Inventory</TabsTrigger>
              <TabsTrigger value="media">Media</TabsTrigger>
              <TabsTrigger value="seo">SEO</TabsTrigger>
              <TabsTrigger value="advanced">Advanced</TabsTrigger>
            </TabsList>

            {/* Basic Information */}
            <TabsContent value="basic" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Basic Information</CardTitle>
                  <CardDescription>
                    Essential product details and descriptions
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="name"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Product Name *</FormLabel>
                          <FormControl>
                            <Input placeholder="Enter product name" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="sku"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>SKU *</FormLabel>
                          <FormControl>
                            <div className="flex gap-2">
                              <Input placeholder="Enter SKU" {...field} />
                              <Button
                                type="button"
                                variant="outline"
                                onClick={() => form.setValue('sku', generateSKU())}
                              >
                                Generate
                              </Button>
                            </div>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={form.control}
                    name="shortDescription"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Short Description</FormLabel>
                        <FormControl>
                          <Textarea 
                            placeholder="Brief product description (will appear in product listings)"
                            className="resize-none"
                            rows={3}
                            {...field}
                          />
                        </FormControl>
                        <FormDescription>
                          A brief description that appears in product listings (recommended: 50-160 characters)
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="description"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Full Description</FormLabel>
                        <FormControl>
                          <Textarea 
                            placeholder="Detailed product description"
                            className="resize-none"
                            rows={6}
                            {...field}
                          />
                        </FormControl>
                        <FormDescription>
                          Complete product description with features, benefits, and details
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Product Type & Settings</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="type"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Product Type</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select product type" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="ONE_TIME">One-time Purchase</SelectItem>
                              <SelectItem value="SUBSCRIPTION">Subscription</SelectItem>
                              <SelectItem value="USAGE_BASED">Usage-based</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    {productType === 'SUBSCRIPTION' && (
                      <FormField
                        control={form.control}
                        name="billingInterval"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Billing Interval</FormLabel>
                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Select billing interval" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="DAY">Daily</SelectItem>
                                <SelectItem value="WEEK">Weekly</SelectItem>
                                <SelectItem value="MONTH">Monthly</SelectItem>
                                <SelectItem value="YEAR">Yearly</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="isDigital"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                          <div className="space-y-0.5">
                            <FormLabel className="text-base">Digital Product</FormLabel>
                            <FormDescription>
                              This product is delivered digitally (no shipping required)
                            </FormDescription>
                          </div>
                          <FormControl>
                            <Switch
                              checked={field.value}
                              onCheckedChange={field.onChange}
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="isActive"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                          <div className="space-y-0.5">
                            <FormLabel className="text-base">Active</FormLabel>
                            <FormDescription>
                              Product is visible and available for purchase
                            </FormDescription>
                          </div>
                          <FormControl>
                            <Switch
                              checked={field.value}
                              onCheckedChange={field.onChange}
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                  </div>

                  {!isDigital && (
                    <FormField
                      control={form.control}
                      name="requiresShipping"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                          <div className="space-y-0.5">
                            <FormLabel className="text-base">Requires Shipping</FormLabel>
                            <FormDescription>
                              This physical product needs to be shipped to customers
                            </FormDescription>
                          </div>
                          <FormControl>
                            <Switch
                              checked={field.value}
                              onCheckedChange={field.onChange}
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Pricing */}
            <TabsContent value="pricing" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Pricing Information</CardTitle>
                  <CardDescription>
                    Set the product price and compare-at price for sales
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-3 gap-4">
                    <FormField
                      control={form.control}
                      name="price"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Price *</FormLabel>
                          <FormControl>
                            <Input 
                              type="number" 
                              step="0.01" 
                              placeholder="0.00"
                              {...field}
                              onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="currency"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Currency</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select currency" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="USD">USD ($)</SelectItem>
                              <SelectItem value="EUR">EUR (€)</SelectItem>
                              <SelectItem value="GBP">GBP (£)</SelectItem>
                              <SelectItem value="CAD">CAD (C$)</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="compareAtPrice"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Compare at Price</FormLabel>
                          <FormControl>
                            <Input 
                              type="number" 
                              step="0.01" 
                              placeholder="0.00"
                              {...field}
                              onChange={(e) => field.onChange(parseFloat(e.target.value) || undefined)}
                            />
                          </FormControl>
                          <FormDescription>
                            Original price to show savings (optional)
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Inventory */}
            <TabsContent value="inventory" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Inventory Management</CardTitle>
                  <CardDescription>
                    {isDigital 
                      ? 'Digital products don\'t require inventory tracking'
                      : 'Track and manage physical product inventory'
                    }
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {isDigital ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <Package className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <p>Digital products have unlimited inventory</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="stockQuantity"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Stock Quantity</FormLabel>
                            <FormControl>
                              <Input 
                                type="number" 
                                placeholder="0"
                                {...field}
                                value={field.value ?? ''}
                                onChange={(e) => {
                                  const value = e.target.value;
                                  if (value === '') {
                                    field.onChange(undefined);
                                  } else {
                                    const numValue = parseInt(value, 10);
                                    field.onChange(isNaN(numValue) ? undefined : numValue);
                                  }
                                }}
                              />
                            </FormControl>
                            <FormDescription>
                              Current number of units in stock
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="lowStockThreshold"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Low Stock Threshold</FormLabel>
                            <FormControl>
                              <Input 
                                type="number" 
                                placeholder="10"
                                {...field}
                                value={field.value ?? ''}
                                onChange={(e) => {
                                  const value = e.target.value;
                                  if (value === '') {
                                    field.onChange(undefined);
                                  } else {
                                    const numValue = parseInt(value, 10);
                                    field.onChange(isNaN(numValue) ? undefined : numValue);
                                  }
                                }}
                              />
                            </FormControl>
                            <FormDescription>
                              Alert when stock falls below this level
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Media */}
            <TabsContent value="media" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Product Images</CardTitle>
                  <CardDescription>
                    Upload and manage product images
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ProductImageUpload
                    images={images}
                    onImagesChange={handleImagesChange}
                    maxImages={10}
                  />
                </CardContent>
              </Card>
            </TabsContent>

            {/* SEO */}
            <TabsContent value="seo" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>SEO & URL</CardTitle>
                  <CardDescription>
                    Optimize for search engines and set the product URL
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <FormField
                    control={form.control}
                    name="slug"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>URL Slug *</FormLabel>
                        <FormControl>
                          <Input placeholder="product-url-slug" {...field} />
                        </FormControl>
                        <FormDescription>
                          This will be the URL path: /products/{field.value || 'product-slug'}
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="metaTitle"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Meta Title</FormLabel>
                        <FormControl>
                          <Input placeholder="SEO title for search engines" {...field} />
                        </FormControl>
                        <FormDescription>
                          Recommended: 50-60 characters
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="metaDescription"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Meta Description</FormLabel>
                        <FormControl>
                          <Textarea 
                            placeholder="SEO description for search engines"
                            className="resize-none"
                            rows={3}
                            {...field}
                          />
                        </FormControl>
                        <FormDescription>
                          Recommended: 120-160 characters
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Categories */}
                  <div className="space-y-3">
                    <Label>Product Categories</Label>
                    {loadingCategories ? (
                      <div className="space-y-2">
                        {Array.from({ length: 3 }).map((_, i) => (
                          <Skeleton key={i} className="h-4 w-full" />
                        ))}
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-48 overflow-y-auto">
                        {availableCategories.map((category) => (
                          <div key={category.id} className="flex items-center space-x-2">
                            <Checkbox
                              id={`category-${category.id}`}
                              checked={selectedCategories.includes(category.id)}
                              onCheckedChange={(checked) => 
                                handleCategoryChange(category.id, checked as boolean)
                              }
                            />
                            <Label 
                              htmlFor={`category-${category.id}`}
                              className="flex-1 cursor-pointer"
                            >
                              <div>
                                <p className="font-medium">{category.name}</p>
                                {category.description && (
                                  <p className="text-xs text-muted-foreground">
                                    {category.description}
                                  </p>
                                )}
                              </div>
                            </Label>
                          </div>
                        ))}
                      </div>
                    )}
                    <p className="text-sm text-muted-foreground">
                      Categories help organize products into groups
                    </p>
                  </div>

                  {/* Tags */}
                  <div className="space-y-3">
                    <Label>Product Tags</Label>
                    {loadingTags ? (
                      <div className="space-y-2">
                        {Array.from({ length: 4 }).map((_, i) => (
                          <Skeleton key={i} className="h-4 w-full" />
                        ))}
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-48 overflow-y-auto">
                        {availableTags.map((tag) => (
                          <div key={tag.id} className="flex items-center space-x-2">
                            <Checkbox
                              id={`tag-${tag.id}`}
                              checked={selectedTags.includes(tag.id)}
                              onCheckedChange={(checked) => 
                                handleTagChange(tag.id, checked as boolean)
                              }
                            />
                            <Label 
                              htmlFor={`tag-${tag.id}`}
                              className="flex-1 cursor-pointer flex items-center gap-2"
                            >
                              <div
                                className="w-3 h-3 rounded-full"
                                style={{ backgroundColor: tag.color || '#6366f1' }}
                              />
                              <span>{tag.name}</span>
                            </Label>
                          </div>
                        ))}
                      </div>
                    )}
                    <p className="text-sm text-muted-foreground">
                      Tags help with filtering and organization
                    </p>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Advanced */}
            <TabsContent value="advanced" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Advanced Settings</CardTitle>
                  <CardDescription>
                    Stripe integration and advanced product configuration
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Stripe Product ID</Label>
                      <Input 
                        placeholder="Will be auto-generated"
                        value={product?.stripeProductId || ''}
                        disabled
                      />
                      <p className="text-sm text-muted-foreground">
                        Automatically created when product is saved
                      </p>
                    </div>

                    <div className="space-y-2">
                      <Label>Stripe Price ID</Label>
                      <Input 
                        placeholder="Will be auto-generated"
                        value={product?.stripePriceId || ''}
                        disabled
                      />
                      <p className="text-sm text-muted-foreground">
                        Automatically created based on price settings
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-4 pt-6 border-t">
            <Button 
              type="button" 
              variant="outline" 
              onClick={() => router.back()}
              disabled={isSubmitting || loading}
            >
              Cancel
            </Button>
            <Button 
              type="submit" 
              disabled={isSubmitting || loading}
              className="min-w-[120px]"
            >
              {isSubmitting ? (
                'Saving...'
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  {mode === 'create' ? 'Create Product' : 'Save Changes'}
                </>
              )}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}