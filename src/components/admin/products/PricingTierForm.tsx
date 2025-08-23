'use client';

import { useState, useEffect } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { X, Plus, Gift, Clock, DollarSign } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
// import { Label } from '@/components/ui/label'; // Unused import
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

import type { PricingTier } from './PricingTierCard';

// Form validation schema
const pricingTierFormSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100, 'Name must not exceed 100 characters'),
  description: z.string().max(500, 'Description must not exceed 500 characters').optional(),
  price: z.number().min(0, 'Price must be 0 or greater'),
  currency: z.string().min(3, 'Currency is required').max(3, 'Currency must be 3 characters'),
  billingInterval: z.enum(['DAY', 'WEEK', 'MONTH', 'YEAR', 'ONE_TIME']).optional(),
  trialDays: z.number().int().min(0).max(365).optional(),
  features: z.array(z.string()).default([]),
  isFreemium: z.boolean().default(false),
  isActive: z.boolean().default(true),
  sortOrder: z.number().int().min(0).default(0),
}).superRefine((data, ctx) => {
  // Validate freemium tier pricing
  if (data.isFreemium && data.price > 0) {
    ctx.addIssue({
      code: 'custom',
      message: 'Freemium tiers must have a price of 0',
      path: ['price'],
    });
  }

  // Validate subscription billing interval
  if (data.billingInterval && data.billingInterval !== 'ONE_TIME' && data.price === 0 && !data.isFreemium) {
    ctx.addIssue({
      code: 'custom',
      message: 'Subscription tiers with billing intervals must have a price greater than 0 unless they are freemium',
      path: ['billingInterval'],
    });
  }

  // Validate trial days only for subscription tiers
  if (data.trialDays && data.trialDays > 0 && (!data.billingInterval || data.billingInterval === 'ONE_TIME')) {
    ctx.addIssue({
      code: 'custom',
      message: 'Trial days can only be set for subscription tiers',
      path: ['trialDays'],
    });
  }
});

type PricingTierFormData = z.infer<typeof pricingTierFormSchema>;

interface PricingTierFormProps {
  productId: string;
  tier?: PricingTier;
  onSubmit: (data: PricingTierFormData) => void;
  onCancel: () => void;
  isSubmitting?: boolean;
}

const BILLING_INTERVALS = [
  { value: 'ONE_TIME', label: 'One-time purchase' },
  { value: 'DAY', label: 'Daily' },
  { value: 'WEEK', label: 'Weekly' },
  { value: 'MONTH', label: 'Monthly' },
  { value: 'YEAR', label: 'Yearly' },
];

const CURRENCIES = [
  { value: 'usd', label: 'USD - US Dollar' },
  { value: 'eur', label: 'EUR - Euro' },
  { value: 'gbp', label: 'GBP - British Pound' },
  { value: 'cad', label: 'CAD - Canadian Dollar' },
  { value: 'aud', label: 'AUD - Australian Dollar' },
];

const COMMON_FEATURES = [
  'Basic Support',
  'Email Support', 
  'Priority Support',
  '24/7 Support',
  'Phone Support',
  'Live Chat',
  'API Access',
  'Advanced Features',
  'Custom Integrations',
  'White Label',
  'Analytics Dashboard',
  'Reporting',
  'Multi-User Access',
  'Team Collaboration',
  'Custom Branding',
  'SLA Guarantee',
];

export function PricingTierForm({
  productId: _productId,
  tier,
  onSubmit,
  onCancel,
  isSubmitting = false,
}: PricingTierFormProps) {
  const [showFeatureInput, setShowFeatureInput] = useState(false);
  const [newFeature, setNewFeature] = useState('');

  const form = useForm<PricingTierFormData>({
    resolver: zodResolver(pricingTierFormSchema),
    defaultValues: {
      name: tier?.name || '',
      description: tier?.description || '',
      price: tier?.price || 0,
      currency: tier?.currency || 'usd',
      billingInterval: tier?.billingInterval || 'ONE_TIME',
      trialDays: tier?.trialDays || 0,
      features: tier?.features || [],
      isFreemium: tier?.isFreemium || false,
      isActive: tier?.isActive ?? true,
      sortOrder: tier?.sortOrder || 0,
    },
  });

  const { fields: featureFields, append: appendFeature, remove: removeFeature } = useFieldArray({
    control: form.control,
    name: 'features',
  });

  const watchedValues = form.watch();

  useEffect(() => {
    // Auto-adjust price when freemium is toggled
    if (watchedValues.isFreemium && watchedValues.price > 0) {
      form.setValue('price', 0);
    }
  }, [watchedValues.isFreemium, form]);

  useEffect(() => {
    // Clear trial days when not a subscription
    if ((!watchedValues.billingInterval || watchedValues.billingInterval === 'ONE_TIME') && watchedValues.trialDays && watchedValues.trialDays > 0) {
      form.setValue('trialDays', 0);
    }
  }, [watchedValues.billingInterval, form]);

  const addFeature = (feature: string) => {
    if (feature.trim() && !watchedValues.features.includes(feature.trim())) {
      appendFeature(feature.trim());
    }
    setNewFeature('');
    setShowFeatureInput(false);
  };

  const handleSubmit = (data: PricingTierFormData) => {
    // Filter out ONE_TIME billing interval (treat as undefined for one-time purchases)
    const submitData = {
      ...data,
      billingInterval: data.billingInterval === 'ONE_TIME' ? undefined : data.billingInterval,
      trialDays: data.trialDays && data.trialDays > 0 ? data.trialDays : undefined,
    };
    onSubmit(submitData);
  };

  const getTierType = () => {
    if (watchedValues.isFreemium) return { text: 'Freemium', color: 'bg-green-100 text-green-800' };
    if (watchedValues.billingInterval && watchedValues.billingInterval !== 'ONE_TIME') return { text: 'Subscription', color: 'bg-purple-100 text-purple-800' };
    return { text: 'One-time', color: 'bg-blue-100 text-blue-800' };
  };

  const tierType = getTierType();

  return (
    <Card className="w-full max-w-2xl">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <DollarSign className="h-5 w-5" />
          {tier ? 'Edit Pricing Tier' : 'Create Pricing Tier'}
        </CardTitle>
        <CardDescription>
          {tier 
            ? `Update the pricing tier "${tier.name}"`
            : 'Create a new pricing tier for your product'
          }
        </CardDescription>
        <div className="flex items-center gap-2">
          <Badge className={tierType.color}>
            {tierType.text}
          </Badge>
          {watchedValues.isFreemium && <Gift className="h-4 w-4 text-green-600" />}
          {watchedValues.trialDays && watchedValues.trialDays > 0 && <Clock className="h-4 w-4 text-blue-600" />}
        </div>
      </CardHeader>

      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
            {/* Basic Information */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tier Name</FormLabel>
                    <FormControl>
                      <Input 
                        placeholder="Basic, Pro, Enterprise..." 
                        {...field} 
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="sortOrder"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Sort Order</FormLabel>
                    <FormControl>
                      <Input 
                        type="number" 
                        min="0" 
                        {...field} 
                        onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                      />
                    </FormControl>
                    <FormDescription>
                      Controls the display order (0 = first)
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description (Optional)</FormLabel>
                  <FormControl>
                    <Textarea 
                      placeholder="Brief description of what this tier includes..."
                      rows={3}
                      {...field} 
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Pricing */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <FormField
                control={form.control}
                name="price"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Price</FormLabel>
                    <FormControl>
                      <Input 
                        type="number" 
                        step="0.01" 
                        min="0" 
                        disabled={watchedValues.isFreemium}
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
                        {CURRENCIES.map((currency) => (
                          <SelectItem key={currency.value} value={currency.value}>
                            {currency.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="billingInterval"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Billing Interval</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select interval" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {BILLING_INTERVALS.map((interval) => (
                          <SelectItem key={interval.value} value={interval.value}>
                            {interval.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Trial Days - Only show for subscriptions */}
            {watchedValues.billingInterval && watchedValues.billingInterval !== 'ONE_TIME' && (
              <FormField
                control={form.control}
                name="trialDays"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Trial Days (Optional)</FormLabel>
                    <FormControl>
                      <Input 
                        type="number" 
                        min="0" 
                        max="365" 
                        placeholder="0"
                        {...field} 
                        onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                      />
                    </FormControl>
                    <FormDescription>
                      Number of free trial days for new subscriptions
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            {/* Tier Type Settings */}
            <div className="space-y-4">
              <FormField
                control={form.control}
                name="isFreemium"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
                    <div className="space-y-0.5">
                      <FormLabel className="text-base">Freemium Tier</FormLabel>
                      <FormDescription>
                        This is a free tier with limited features
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
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
                    <div className="space-y-0.5">
                      <FormLabel className="text-base">Active Tier</FormLabel>
                      <FormDescription>
                        Whether this tier is available for new customers
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

            {/* Features */}
            <div className="space-y-4">
              <FormLabel>Features</FormLabel>
              
              {/* Existing Features */}
              {featureFields.length > 0 && (
                <div className="space-y-2">
                  {featureFields.map((field, index) => (
                    <div key={field.id} className="flex items-center gap-2">
                      <Input
                        value={watchedValues.features[index] || ''}
                        onChange={(e) => form.setValue(`features.${index}`, e.target.value)}
                        placeholder="Feature name..."
                      />
                      <Button 
                        type="button"
                        variant="outline" 
                        size="sm"
                        onClick={() => removeFeature(index)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}

              {/* Add Feature Input */}
              {showFeatureInput && (
                <div className="flex items-center gap-2">
                  <Input
                    placeholder="Enter feature name..."
                    value={newFeature}
                    onChange={(e) => setNewFeature(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        addFeature(newFeature);
                      }
                      if (e.key === 'Escape') {
                        setShowFeatureInput(false);
                        setNewFeature('');
                      }
                    }}
                  />
                  <Button 
                    type="button" 
                    variant="outline" 
                    size="sm"
                    onClick={() => addFeature(newFeature)}
                  >
                    Add
                  </Button>
                  <Button 
                    type="button" 
                    variant="outline" 
                    size="sm"
                    onClick={() => {
                      setShowFeatureInput(false);
                      setNewFeature('');
                    }}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              )}

              {/* Quick Add Common Features */}
              {!showFeatureInput && (
                <div className="space-y-2">
                  <Button 
                    type="button" 
                    variant="outline" 
                    size="sm"
                    onClick={() => setShowFeatureInput(true)}
                    className="w-full"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Add Custom Feature
                  </Button>
                  
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                    {COMMON_FEATURES.filter(feature => !watchedValues.features.includes(feature)).slice(0, 6).map((feature) => (
                      <Button 
                        key={feature}
                        type="button" 
                        variant="outline" 
                        size="sm"
                        onClick={() => addFeature(feature)}
                        className="text-xs"
                      >
                        <Plus className="h-3 w-3 mr-1" />
                        {feature}
                      </Button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Form Actions */}
            <div className="flex justify-end gap-2 pt-6 border-t">
              <Button type="button" variant="outline" onClick={onCancel}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? 'Saving...' : (tier ? 'Update Tier' : 'Create Tier')}
              </Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}