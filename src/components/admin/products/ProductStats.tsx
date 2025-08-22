'use client';

import { Package, AlertTriangle, Eye, EyeOff } from 'lucide-react';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface ProductStatsProps {
  stats: {
    total: number;
    active: number;
    inactive: number;
    digital: number;
    physical: number;
    subscription: number;
    oneTime: number;
    lowStock: number;
    outOfStock: number;
  };
}

interface StatCardProps {
  title: string;
  value: number;
  icon: React.ReactNode;
  description?: string;
  variant?: 'default' | 'success' | 'warning' | 'danger';
  percentage?: number;
}

function StatCard({ 
  title, 
  value, 
  icon, 
  description, 
  variant = 'default',
  percentage 
}: StatCardProps) {
  const getVariantStyles = () => {
    switch (variant) {
      case 'success':
        return 'border-green-200 bg-green-50 text-green-700';
      case 'warning':
        return 'border-orange-200 bg-orange-50 text-orange-700';
      case 'danger':
        return 'border-red-200 bg-red-50 text-red-700';
      default:
        return '';
    }
  };

  return (
    <Card className={getVariantStyles()}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">
          {title}
        </CardTitle>
        <div className="h-4 w-4 text-muted-foreground">
          {icon}
        </div>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value.toLocaleString()}</div>
        <div className="flex items-center gap-2 mt-1">
          {description && (
            <p className="text-xs text-muted-foreground">
              {description}
            </p>
          )}
          {percentage !== undefined && (
            <Badge variant="secondary" className="text-xs">
              {percentage.toFixed(1)}%
            </Badge>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export function ProductStats({ stats }: ProductStatsProps) {
  const activePercentage = stats.total > 0 ? (stats.active / stats.total) * 100 : 0;
  const digitalPercentage = stats.total > 0 ? (stats.digital / stats.total) * 100 : 0;
  const subscriptionPercentage = stats.total > 0 ? (stats.subscription / stats.total) * 100 : 0;
  const lowStockPercentage = stats.physical > 0 ? (stats.lowStock / stats.physical) * 100 : 0;

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {/* Total Products */}
      <StatCard
        title="Total Products"
        value={stats.total}
        icon={<Package className="h-4 w-4" />}
        description="All products in catalog"
      />

      {/* Active Products */}
      <StatCard
        title="Active Products"
        value={stats.active}
        icon={<Eye className="h-4 w-4" />}
        description="Currently available"
        variant={stats.active > 0 ? 'success' : 'default'}
        percentage={activePercentage}
      />

      {/* Inactive Products */}
      <StatCard
        title="Inactive Products"
        value={stats.inactive}
        icon={<EyeOff className="h-4 w-4" />}
        description="Hidden from customers"
        variant={stats.inactive > 0 ? 'warning' : 'default'}
        percentage={100 - activePercentage}
      />

      {/* Low Stock Alert */}
      <StatCard
        title="Low Stock Items"
        value={stats.lowStock}
        icon={<AlertTriangle className="h-4 w-4" />}
        description="Require restocking"
        variant={stats.lowStock > 0 ? 'danger' : 'success'}
        percentage={lowStockPercentage}
      />

      {/* Digital vs Physical */}
      <div className="md:col-span-2 lg:col-span-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Product Distribution</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Digital</span>
                  <span className="text-sm text-muted-foreground">
                    {stats.digital} ({digitalPercentage.toFixed(1)}%)
                  </span>
                </div>
                <div className="w-full bg-muted rounded-full h-2">
                  <div
                    className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${digitalPercentage}%` }}
                  />
                </div>
              </div>
              
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Physical</span>
                  <span className="text-sm text-muted-foreground">
                    {stats.physical} ({(100 - digitalPercentage).toFixed(1)}%)
                  </span>
                </div>
                <div className="w-full bg-muted rounded-full h-2">
                  <div
                    className="bg-green-500 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${100 - digitalPercentage}%` }}
                  />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Product Types */}
      <div className="md:col-span-2 lg:col-span-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Product Types</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">One-time</span>
                  <span className="text-sm text-muted-foreground">
                    {stats.oneTime} ({((stats.oneTime / stats.total) * 100).toFixed(1)}%)
                  </span>
                </div>
                <div className="w-full bg-muted rounded-full h-2">
                  <div
                    className="bg-purple-500 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${(stats.oneTime / stats.total) * 100}%` }}
                  />
                </div>
              </div>
              
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Subscription</span>
                  <span className="text-sm text-muted-foreground">
                    {stats.subscription} ({subscriptionPercentage.toFixed(1)}%)
                  </span>
                </div>
                <div className="w-full bg-muted rounded-full h-2">
                  <div
                    className="bg-orange-500 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${subscriptionPercentage}%` }}
                  />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Inventory Alerts */}
      {stats.physical > 0 && (
        <div className="md:col-span-2 lg:col-span-4">
          <Card className={stats.outOfStock > 0 || stats.lowStock > 0 ? 'border-orange-200 bg-orange-50' : ''}>
            <CardHeader>
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <AlertTriangle className="h-4 w-4" />
                Inventory Status
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-600">{stats.physical - stats.lowStock - stats.outOfStock}</div>
                  <div className="text-xs text-muted-foreground">Healthy Stock</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-orange-600">{stats.lowStock}</div>
                  <div className="text-xs text-muted-foreground">Low Stock</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-red-600">{stats.outOfStock}</div>
                  <div className="text-xs text-muted-foreground">Out of Stock</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold">{stats.physical}</div>
                  <div className="text-xs text-muted-foreground">Total Physical</div>
                </div>
              </div>
              
              {(stats.outOfStock > 0 || stats.lowStock > 0) && (
                <div className="mt-4 p-3 rounded-lg bg-orange-100 border border-orange-200">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-orange-600" />
                    <span className="text-sm font-medium text-orange-800">Inventory Attention Required</span>
                  </div>
                  <div className="mt-1 text-xs text-orange-700">
                    {stats.outOfStock > 0 && `${stats.outOfStock} products are out of stock. `}
                    {stats.lowStock > 0 && `${stats.lowStock} products have low stock levels.`}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}