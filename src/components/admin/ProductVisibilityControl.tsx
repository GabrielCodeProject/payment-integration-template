'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Calendar, Clock, Globe, Users, Eye, Settings } from 'lucide-react';
import { toast } from 'sonner';

interface ProductVisibilityControlProps {
  productId: string;
  currentVisibility?: {
    status: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED' | 'SCHEDULED';
    isPublished: boolean;
    publishedAt?: string;
    availableFrom?: string;
    availableTo?: string;
    restrictedRegions: string[];
    allowedUserRoles: ('CUSTOMER' | 'ADMIN' | 'SUPPORT')[];
    maxUsers?: number;
    currentUsers: number;
    isLimited: boolean;
  };
  onUpdate?: () => void;
}

export function ProductVisibilityControl({
  productId,
  currentVisibility,
  onUpdate
}: ProductVisibilityControlProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [visibility, setVisibility] = useState(currentVisibility || {
    status: 'DRAFT' as const,
    isPublished: false,
    publishedAt: undefined,
    availableFrom: undefined,
    availableTo: undefined,
    restrictedRegions: [],
    allowedUserRoles: [],
    maxUsers: undefined,
    currentUsers: 0,
    isLimited: false,
  });

  const handleStatusChange = async (newStatus: string) => {
    const updatedVisibility = {
      ...visibility,
      status: newStatus as 'DRAFT' | 'PUBLISHED' | 'ARCHIVED' | 'SCHEDULED',
      isPublished: newStatus === 'PUBLISHED',
    };
    
    setVisibility(updatedVisibility);
    await updateVisibility(updatedVisibility);
  };

  const handlePublishedToggle = async (isPublished: boolean) => {
    const updatedVisibility = {
      ...visibility,
      isPublished,
      status: isPublished ? 'PUBLISHED' as const : 'DRAFT' as const,
    };
    
    setVisibility(updatedVisibility);
    await updateVisibility(updatedVisibility);
  };

  const handleDateChange = (field: 'availableFrom' | 'availableTo', value: string) => {
    const updatedVisibility = {
      ...visibility,
      [field]: value || undefined,
    };
    
    setVisibility(updatedVisibility);
  };

  const handleAccessControlChange = async (updates: Partial<typeof visibility>) => {
    const updatedVisibility = { ...visibility, ...updates };
    setVisibility(updatedVisibility);
    await updateAccessControl(updatedVisibility);
  };

  const updateVisibility = async (visibilityData: typeof visibility) => {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/products/${productId}/visibility`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          status: visibilityData.status,
          isPublished: visibilityData.isPublished,
          publishedAt: visibilityData.publishedAt,
          availableFrom: visibilityData.availableFrom,
          availableTo: visibilityData.availableTo,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to update product visibility');
      }

      toast.success('Product visibility updated successfully');
      onUpdate?.();
    } catch (error) {
      console.error('Error updating product visibility:', error);
      toast.error('Failed to update product visibility');
    } finally {
      setIsLoading(false);
    }
  };

  const updateAccessControl = async (visibilityData: typeof visibility) => {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/products/${productId}/access-control`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          restrictedRegions: visibilityData.restrictedRegions,
          allowedUserRoles: visibilityData.allowedUserRoles,
          maxUsers: visibilityData.maxUsers,
          isLimited: visibilityData.isLimited,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to update product access control');
      }

      toast.success('Product access control updated successfully');
      onUpdate?.();
    } catch (error) {
      console.error('Error updating product access control:', error);
      toast.error('Failed to update product access control');
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
    if (!dateString) return '';
    return new Date(dateString).toLocaleString();
  };

  return (
    <div className="space-y-6">
      {/* Status and Publication Control */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Eye className="h-5 w-5" />
            Publication Status
          </CardTitle>
          <CardDescription>
            Control the publication status and visibility of this product
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <Label>Current Status</Label>
              <div className="flex items-center gap-2">
                <Badge variant={getStatusBadgeVariant(visibility.status)}>
                  {visibility.status}
                </Badge>
                {visibility.isPublished && (
                  <Badge variant="outline" className="text-green-600">
                    Published
                  </Badge>
                )}
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <Switch
                id="published"
                checked={visibility.isPublished}
                onCheckedChange={handlePublishedToggle}
                disabled={isLoading}
              />
              <Label htmlFor="published">Published</Label>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="status">Status</Label>
              <Select
                value={visibility.status}
                onValueChange={handleStatusChange}
                disabled={isLoading}
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

            {visibility.publishedAt && (
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  Published At
                </Label>
                <div className="text-sm text-muted-foreground">
                  {formatDateTime(visibility.publishedAt)}
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Availability Window */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Availability Window
          </CardTitle>
          <CardDescription>
            Set when this product should be available for purchase
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="available-from">Available From</Label>
              <Input
                id="available-from"
                type="datetime-local"
                value={visibility.availableFrom ? new Date(visibility.availableFrom).toISOString().slice(0, -8) : ''}
                onChange={(e) => handleDateChange('availableFrom', e.target.value)}
                disabled={isLoading}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="available-to">Available Until</Label>
              <Input
                id="available-to"
                type="datetime-local"
                value={visibility.availableTo ? new Date(visibility.availableTo).toISOString().slice(0, -8) : ''}
                onChange={(e) => handleDateChange('availableTo', e.target.value)}
                disabled={isLoading}
              />
            </div>
          </div>

          <Button
            onClick={() => updateVisibility(visibility)}
            disabled={isLoading}
            variant="outline"
            size="sm"
          >
            Update Availability
          </Button>
        </CardContent>
      </Card>

      {/* Access Control */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Access Control
          </CardTitle>
          <CardDescription>
            Manage who can access this product and usage limits
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* User Limits */}
          <div className="space-y-4">
            <div className="flex items-center space-x-2">
              <Switch
                id="limited"
                checked={visibility.isLimited}
                onCheckedChange={(isLimited) =>
                  handleAccessControlChange({ isLimited })
                }
                disabled={isLoading}
              />
              <Label htmlFor="limited" className="flex items-center gap-2">
                <Users className="h-4 w-4" />
                Limit User Access
              </Label>
            </div>

            {visibility.isLimited && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pl-6">
                <div className="space-y-2">
                  <Label htmlFor="max-users">Maximum Users</Label>
                  <Input
                    id="max-users"
                    type="number"
                    min="1"
                    value={visibility.maxUsers || ''}
                    onChange={(e) =>
                      handleAccessControlChange({
                        maxUsers: e.target.value ? parseInt(e.target.value) : undefined,
                      })
                    }
                    disabled={isLoading}
                    placeholder="Enter maximum number of users"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Current Users</Label>
                  <div className="flex items-center gap-2">
                    <div className="text-lg font-semibold">
                      {visibility.currentUsers}
                    </div>
                    {visibility.maxUsers && (
                      <div className="text-sm text-muted-foreground">
                        / {visibility.maxUsers} ({Math.round((visibility.currentUsers / visibility.maxUsers) * 100)}%)
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Geographic Restrictions */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <Globe className="h-4 w-4" />
              Restricted Regions
            </Label>
            <Input
              placeholder="Enter comma-separated region codes (e.g., US, CA, GB)"
              value={visibility.restrictedRegions.join(', ')}
              onChange={(e) =>
                handleAccessControlChange({
                  restrictedRegions: e.target.value
                    ? e.target.value.split(',').map(r => r.trim()).filter(Boolean)
                    : [],
                })
              }
              disabled={isLoading}
            />
            <div className="text-xs text-muted-foreground">
              Users from these regions will not be able to access this product
            </div>
          </div>

          {/* Role Restrictions */}
          <div className="space-y-2">
            <Label>Allowed User Roles</Label>
            <div className="flex flex-wrap gap-2">
              {['CUSTOMER', 'ADMIN', 'SUPPORT'].map((role) => (
                <Badge
                  key={role}
                  variant={visibility.allowedUserRoles.includes(role as any) ? 'default' : 'outline'}
                  className="cursor-pointer"
                  onClick={() =>
                    handleAccessControlChange({
                      allowedUserRoles: visibility.allowedUserRoles.includes(role as any)
                        ? visibility.allowedUserRoles.filter(r => r !== role)
                        : [...visibility.allowedUserRoles, role as any],
                    })
                  }
                >
                  {role}
                </Badge>
              ))}
            </div>
            <div className="text-xs text-muted-foreground">
              {visibility.allowedUserRoles.length === 0
                ? 'All user roles can access this product'
                : 'Only selected user roles can access this product'
              }
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}