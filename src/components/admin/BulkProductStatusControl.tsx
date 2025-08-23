'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogFooter, 
  DialogHeader, 
  DialogTitle 
} from '@/components/ui/dialog';
import { Package, Calendar, Settings2, CheckSquare, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';

interface Product {
  id: string;
  name: string;
  status: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED' | 'SCHEDULED';
  isPublished: boolean;
  publishedAt?: string;
  availableFrom?: string;
  availableTo?: string;
}

interface BulkProductStatusControlProps {
  products: Product[];
  selectedProductIds?: string[];
  onSelectionChange?: (selectedIds: string[]) => void;
  onUpdate?: () => void;
}

export function BulkProductStatusControl({
  products,
  selectedProductIds = [],
  onSelectionChange,
  onUpdate
}: BulkProductStatusControlProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [showBulkDialog, setShowBulkDialog] = useState(false);
  const [bulkUpdate, setBulkUpdate] = useState({
    status: 'PUBLISHED' as const,
    isPublished: true,
    availableFrom: '',
    availableTo: '',
  });

  const handleProductSelection = (productId: string, isSelected: boolean) => {
    const newSelection = isSelected
      ? [...selectedProductIds, productId]
      : selectedProductIds.filter(id => id !== productId);
    
    onSelectionChange?.(newSelection);
  };

  const handleSelectAll = (isSelected: boolean) => {
    const newSelection = isSelected ? products.map(p => p.id) : [];
    onSelectionChange?.(newSelection);
  };

  const handleBulkStatusUpdate = async () => {
    if (selectedProductIds.length === 0) {
      toast.error('Please select at least one product');
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch('/api/products/bulk-status', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          productIds: selectedProductIds,
          status: bulkUpdate.status,
          isPublished: bulkUpdate.isPublished,
          availableFrom: bulkUpdate.availableFrom || undefined,
          availableTo: bulkUpdate.availableTo || undefined,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to update product status');
      }

      const result = await response.json();
      toast.success(`Successfully updated ${result.result.updatedCount} products`);
      
      setShowBulkDialog(false);
      onUpdate?.();
      onSelectionChange?.([]);
    } catch (error) {
      console.error('Error updating product status:', error);
      toast.error('Failed to update product status');
    } finally {
      setIsLoading(false);
    }
  };

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case 'PUBLISHED':
        return 'default';
      case 'DRAFT':
        return 'secondary';
      case 'SCHEDULED':
        return 'outline';
      case 'ARCHIVED':
        return 'destructive';
      default:
        return 'secondary';
    }
  };

  const formatDateTime = (dateString?: string) => {
    if (!dateString) return 'Not set';
    return new Date(dateString).toLocaleString();
  };

  const selectedProducts = products.filter(p => selectedProductIds.includes(p.id));
  const statusCounts = selectedProducts.reduce((acc, product) => {
    acc[product.status] = (acc[product.status] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Bulk Product Status Management
          </CardTitle>
          <CardDescription>
            Select products and update their status, publication settings, and availability in bulk
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Selection Controls */}
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="select-all"
                checked={selectedProductIds.length === products.length && products.length > 0}
                onCheckedChange={handleSelectAll}
              />
              <Label htmlFor="select-all">
                Select All ({selectedProductIds.length} of {products.length} selected)
              </Label>
            </div>
            
            <Button
              onClick={() => setShowBulkDialog(true)}
              disabled={selectedProductIds.length === 0}
              className="flex items-center gap-2"
            >
              <Settings2 className="h-4 w-4" />
              Bulk Update ({selectedProductIds.length})
            </Button>
          </div>

          {/* Selected Products Summary */}
          {selectedProductIds.length > 0 && (
            <div className="p-4 bg-blue-50 rounded-lg space-y-2">
              <div className="font-medium flex items-center gap-2">
                <CheckSquare className="h-4 w-4" />
                Selected Products Summary
              </div>
              <div className="flex flex-wrap gap-2">
                {Object.entries(statusCounts).map(([status, count]) => (
                  <Badge key={status} variant={getStatusBadgeVariant(status)}>
                    {status}: {count}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* Product List */}
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {products.map((product) => (
              <div
                key={product.id}
                className="flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50"
              >
                <div className="flex items-center space-x-3">
                  <Checkbox
                    checked={selectedProductIds.includes(product.id)}
                    onCheckedChange={(isSelected) =>
                      handleProductSelection(product.id, isSelected as boolean)
                    }
                  />
                  <div className="space-y-1">
                    <div className="font-medium">{product.name}</div>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Badge variant={getStatusBadgeVariant(product.status)} size="sm">
                        {product.status}
                      </Badge>
                      {product.isPublished && (
                        <Badge variant="outline" size="sm" className="text-green-600">
                          Published
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>

                <div className="text-xs text-muted-foreground text-right">
                  {product.availableFrom && (
                    <div>From: {formatDateTime(product.availableFrom)}</div>
                  )}
                  {product.availableTo && (
                    <div>Until: {formatDateTime(product.availableTo)}</div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Bulk Update Dialog */}
      <Dialog open={showBulkDialog} onOpenChange={setShowBulkDialog}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Settings2 className="h-5 w-5" />
              Bulk Update Product Status
            </DialogTitle>
            <DialogDescription>
              Update status and availability for {selectedProductIds.length} selected products
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Warning */}
            <div className="flex items-start gap-2 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
              <AlertTriangle className="h-4 w-4 text-yellow-600 mt-0.5 shrink-0" />
              <div className="text-sm text-yellow-800">
                This will update all selected products. This action cannot be undone.
              </div>
            </div>

            {/* Status Selection */}
            <div className="space-y-2">
              <Label>New Status</Label>
              <Select
                value={bulkUpdate.status}
                onValueChange={(value) =>
                  setBulkUpdate({
                    ...bulkUpdate,
                    status: value as 'DRAFT' | 'PUBLISHED' | 'ARCHIVED' | 'SCHEDULED',
                    isPublished: value === 'PUBLISHED',
                  })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="DRAFT">Draft</SelectItem>
                  <SelectItem value="PUBLISHED">Published</SelectItem>
                  <SelectItem value="SCHEDULED">Scheduled</SelectItem>
                  <SelectItem value="ARCHIVED">Archived</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Publication Toggle */}
            <div className="flex items-center space-x-2">
              <Switch
                id="bulk-published"
                checked={bulkUpdate.isPublished}
                onCheckedChange={(isPublished) =>
                  setBulkUpdate({ ...bulkUpdate, isPublished })
                }
              />
              <Label htmlFor="bulk-published">Mark as Published</Label>
            </div>

            {/* Availability Dates */}
            <div className="grid grid-cols-1 gap-4">
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  Available From
                </Label>
                <Input
                  type="datetime-local"
                  value={bulkUpdate.availableFrom}
                  onChange={(e) =>
                    setBulkUpdate({ ...bulkUpdate, availableFrom: e.target.value })
                  }
                />
              </div>

              <div className="space-y-2">
                <Label>Available Until</Label>
                <Input
                  type="datetime-local"
                  value={bulkUpdate.availableTo}
                  onChange={(e) =>
                    setBulkUpdate({ ...bulkUpdate, availableTo: e.target.value })
                  }
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowBulkDialog(false)}
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button
              onClick={handleBulkStatusUpdate}
              disabled={isLoading}
            >
              {isLoading ? 'Updating...' : `Update ${selectedProductIds.length} Products`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}