'use client';

import { useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { 
  MoreHorizontal, 
  Edit, 
  Trash2, 
  Eye, 
  EyeOff,
  DollarSign,
  Clock,
  Gift,
  ChevronUp,
  ChevronDown,
  GripVertical
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
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

export interface PricingTier {
  id: string;
  productId: string;
  name: string;
  description?: string;
  price: number;
  currency: string;
  billingInterval?: string;
  trialDays?: number;
  features: string[];
  isFreemium: boolean;
  isActive: boolean;
  sortOrder: number;
  stripePriceId?: string;
  createdAt: Date;
  updatedAt: Date;
}

interface PricingTierCardProps {
  tier: PricingTier;
  onEdit: (tier: PricingTier) => void;
  onDelete: (tier: PricingTier) => void;
  onToggleActive: (tier: PricingTier) => void;
  onMoveUp?: (tier: PricingTier) => void;
  onMoveDown?: (tier: PricingTier) => void;
  canMoveUp?: boolean;
  canMoveDown?: boolean;
  isDragging?: boolean;
  dragHandleProps?: any;
}

export function PricingTierCard({
  tier,
  onEdit,
  onDelete,
  onToggleActive,
  onMoveUp,
  onMoveDown,
  canMoveUp = false,
  canMoveDown = false,
  isDragging = false,
  dragHandleProps,
}: PricingTierCardProps) {
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  const formatPrice = (price: number, currency: string) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency.toUpperCase(),
    }).format(price);
  };

  const getBillingText = () => {
    if (tier.isFreemium) return 'Free';
    if (!tier.billingInterval) return 'One-time';
    
    const interval = tier.billingInterval.toLowerCase();
    return `per ${interval}`;
  };

  const getTypeColor = () => {
    if (tier.isFreemium) return 'bg-green-100 text-green-800 border-green-200';
    if (!tier.billingInterval) return 'bg-blue-100 text-blue-800 border-blue-200';
    return 'bg-purple-100 text-purple-800 border-purple-200';
  };

  const getStatusColor = () => {
    return tier.isActive 
      ? 'bg-green-100 text-green-800 border-green-200'
      : 'bg-gray-100 text-gray-800 border-gray-200';
  };

  return (
    <>
      <Card className={`transition-all duration-200 ${isDragging ? 'opacity-50 rotate-1' : ''} ${!tier.isActive ? 'opacity-75' : ''}`}>
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-2">
              {dragHandleProps && (
                <div {...dragHandleProps} className="cursor-grab active:cursor-grabbing">
                  <GripVertical className="h-4 w-4 text-gray-400" />
                </div>
              )}
              <div>
                <CardTitle className="text-lg flex items-center gap-2">
                  {tier.name}
                  {tier.isFreemium && <Gift className="h-4 w-4 text-green-600" />}
                  {tier.trialDays && <Clock className="h-4 w-4 text-blue-600" />}
                </CardTitle>
                {tier.description && (
                  <CardDescription className="mt-1">
                    {tier.description}
                  </CardDescription>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Badge className={getTypeColor()}>
                {tier.isFreemium ? 'Freemium' : tier.billingInterval ? 'Subscription' : 'One-time'}
              </Badge>
              <Badge className={getStatusColor()}>
                {tier.isActive ? 'Active' : 'Inactive'}
              </Badge>
              
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm">
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => onEdit(tier)}>
                    <Edit className="h-4 w-4 mr-2" />
                    Edit Tier
                  </DropdownMenuItem>
                  
                  <DropdownMenuItem onClick={() => onToggleActive(tier)}>
                    {tier.isActive ? <EyeOff className="h-4 w-4 mr-2" /> : <Eye className="h-4 w-4 mr-2" />}
                    {tier.isActive ? 'Deactivate' : 'Activate'}
                  </DropdownMenuItem>

                  {(onMoveUp || onMoveDown) && (
                    <>
                      <DropdownMenuSeparator />
                      {onMoveUp && canMoveUp && (
                        <DropdownMenuItem onClick={() => onMoveUp(tier)}>
                          <ChevronUp className="h-4 w-4 mr-2" />
                          Move Up
                        </DropdownMenuItem>
                      )}
                      {onMoveDown && canMoveDown && (
                        <DropdownMenuItem onClick={() => onMoveDown(tier)}>
                          <ChevronDown className="h-4 w-4 mr-2" />
                          Move Down
                        </DropdownMenuItem>
                      )}
                    </>
                  )}

                  <DropdownMenuSeparator />
                  <DropdownMenuItem 
                    onClick={() => setShowDeleteDialog(true)}
                    className="text-red-600 focus:text-red-600"
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete Tier
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </CardHeader>

        <CardContent className="pt-0">
          <div className="space-y-4">
            {/* Pricing Information */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <DollarSign className="h-5 w-5 text-green-600" />
                <div>
                  <div className="text-2xl font-bold">
                    {formatPrice(tier.price, tier.currency)}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {getBillingText()}
                  </div>
                </div>
              </div>

              {tier.trialDays && (
                <div className="text-right">
                  <div className="text-sm font-medium text-blue-600">
                    {tier.trialDays} day trial
                  </div>
                </div>
              )}
            </div>

            {/* Features */}
            {tier.features && tier.features.length > 0 && (
              <div>
                <h4 className="text-sm font-medium mb-2">Features</h4>
                <div className="flex flex-wrap gap-1">
                  {tier.features.slice(0, 3).map((feature, index) => (
                    <Badge key={index} variant="outline" className="text-xs">
                      {feature}
                    </Badge>
                  ))}
                  {tier.features.length > 3 && (
                    <Badge variant="outline" className="text-xs">
                      +{tier.features.length - 3} more
                    </Badge>
                  )}
                </div>
              </div>
            )}

            {/* Metadata */}
            <div className="text-xs text-muted-foreground space-y-1">
              <div className="flex justify-between">
                <span>Sort Order:</span>
                <span>{tier.sortOrder}</span>
              </div>
              <div className="flex justify-between">
                <span>Created:</span>
                <span>{formatDistanceToNow(tier.createdAt)} ago</span>
              </div>
              <div className="flex justify-between">
                <span>Updated:</span>
                <span>{formatDistanceToNow(tier.updatedAt)} ago</span>
              </div>
              {tier.stripePriceId && (
                <div className="flex justify-between">
                  <span>Stripe ID:</span>
                  <span className="font-mono">{tier.stripePriceId.slice(0, 20)}...</span>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Pricing Tier</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete &quot;{tier.name}&quot;? This action cannot be undone.
              {tier.isFreemium && (
                <>
                  <br /><br />
                  <strong>Warning:</strong> This is a freemium tier. Deleting it may affect customer access to free features.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={() => onDelete(tier)}
              className="bg-red-600 hover:bg-red-700"
            >
              Delete Tier
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}