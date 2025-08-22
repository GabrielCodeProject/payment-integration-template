'use client';

import { AlertTriangle, CheckCircle, XCircle, Infinity } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

import type { Product } from '@/lib/validations/base/product';

interface StockIndicatorProps {
  product: Product;
  showLabel?: boolean;
  showTooltip?: boolean;
  variant?: 'default' | 'compact';
}

interface StockStatus {
  status: 'in-stock' | 'low-stock' | 'out-of-stock' | 'digital';
  label: string;
  icon: React.ReactNode;
  variant: 'default' | 'secondary' | 'destructive' | 'outline';
  color: string;
}

export function StockIndicator({ 
  product, 
  showLabel = false, 
  showTooltip = true,
  variant = 'default' 
}: StockIndicatorProps) {
  
  const getStockStatus = (product: Product): StockStatus => {
    // Digital products are always "available"
    if (product.isDigital) {
      return {
        status: 'digital',
        label: 'Digital',
        icon: <Infinity className="h-3 w-3" />,
        variant: 'outline',
        color: 'text-blue-600',
      };
    }

    const stock = product.stockQuantity || 0;
    const lowStockThreshold = product.lowStockThreshold || 10;

    if (stock === 0) {
      return {
        status: 'out-of-stock',
        label: 'Out of Stock',
        icon: <XCircle className="h-3 w-3" />,
        variant: 'destructive',
        color: 'text-red-600',
      };
    }

    if (stock <= lowStockThreshold) {
      return {
        status: 'low-stock',
        label: `Low Stock (${stock})`,
        icon: <AlertTriangle className="h-3 w-3" />,
        variant: 'secondary',
        color: 'text-orange-600',
      };
    }

    return {
      status: 'in-stock',
      label: `In Stock (${stock})`,
      icon: <CheckCircle className="h-3 w-3" />,
      variant: 'default',
      color: 'text-green-600',
    };
  };

  const stockStatus = getStockStatus(product);

  const StockBadge = () => (
    <Badge variant={stockStatus.variant} className="gap-1">
      <span className={stockStatus.color}>
        {stockStatus.icon}
      </span>
      {showLabel && (
        <span className="text-xs">
          {stockStatus.label}
        </span>
      )}
      {!showLabel && variant === 'compact' && (
        <span className="text-xs">
          {product.isDigital ? '∞' : product.stockQuantity || 0}
        </span>
      )}
    </Badge>
  );

  const getTooltipContent = () => {
    if (product.isDigital) {
      return 'Digital product - no physical inventory';
    }

    const stock = product.stockQuantity || 0;
    const lowStockThreshold = product.lowStockThreshold || 10;

    if (stock === 0) {
      return 'Product is out of stock';
    }

    if (stock <= lowStockThreshold) {
      return `Low stock alert: ${stock} units remaining (threshold: ${lowStockThreshold})`;
    }

    return `${stock} units in stock`;
  };

  if (!showTooltip) {
    return <StockBadge />;
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="cursor-help">
            <StockBadge />
          </div>
        </TooltipTrigger>
        <TooltipContent>
          <p>{getTooltipContent()}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

// Utility component for displaying stock level with progress bar
export function StockLevelBar({ 
  product, 
  showPercentage = false 
}: { 
  product: Product; 
  showPercentage?: boolean;
}) {
  if (product.isDigital) {
    return (
      <div className="flex items-center gap-2">
        <Infinity className="h-4 w-4 text-blue-600" />
        <span className="text-sm text-muted-foreground">Digital Product</span>
      </div>
    );
  }

  const stock = product.stockQuantity || 0;
  const lowStockThreshold = product.lowStockThreshold || 10;
  const maxStock = Math.max(stock, lowStockThreshold * 2); // Estimate max stock for percentage
  const percentage = Math.min((stock / maxStock) * 100, 100);

  let progressColor = 'bg-green-500';
  if (stock === 0) {
    progressColor = 'bg-red-500';
  } else if (stock <= lowStockThreshold) {
    progressColor = 'bg-orange-500';
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">Stock Level</span>
        <span className="text-sm text-muted-foreground">
          {stock} units
          {showPercentage && ` (${Math.round(percentage)}%)`}
        </span>
      </div>
      <div className="w-full bg-muted rounded-full h-2">
        <div
          className={`h-2 rounded-full transition-all duration-300 ${progressColor}`}
          style={{ width: `${percentage}%` }}
        />
      </div>
      {stock <= lowStockThreshold && stock > 0 && (
        <div className="flex items-center gap-2 text-sm text-orange-600">
          <AlertTriangle className="h-3 w-3" />
          <span>Low stock warning</span>
        </div>
      )}
    </div>
  );
}

// Utility component for stock alerts
export function StockAlert({ product }: { product: Product }) {
  if (product.isDigital) {
    return null;
  }

  const stock = product.stockQuantity || 0;
  const lowStockThreshold = product.lowStockThreshold || 10;

  if (stock === 0) {
    return (
      <div className="flex items-center gap-2 p-3 rounded-lg bg-red-50 border border-red-200">
        <XCircle className="h-4 w-4 text-red-600" />
        <div>
          <p className="text-sm font-medium text-red-800">Out of Stock</p>
          <p className="text-xs text-red-600">This product is currently unavailable</p>
        </div>
      </div>
    );
  }

  if (stock <= lowStockThreshold) {
    return (
      <div className="flex items-center gap-2 p-3 rounded-lg bg-orange-50 border border-orange-200">
        <AlertTriangle className="h-4 w-4 text-orange-600" />
        <div>
          <p className="text-sm font-medium text-orange-800">Low Stock Alert</p>
          <p className="text-xs text-orange-600">
            Only {stock} units remaining (threshold: {lowStockThreshold})
          </p>
        </div>
      </div>
    );
  }

  return null;
}