import { z } from 'zod';
import {
  cuidSchema,
  nameSchema,
  longDescriptionSchema,
  priceSchema,
  currencySchema,
  stripePriceIdSchema,
  positiveIntSchema,
  nonNegativeIntSchema,
  dateSchema,
} from './common';
import { billingIntervalSchema } from './product';

/**
 * Pricing Tier Validation Schemas
 * 
 * Comprehensive validation schemas for pricing tier management,
 * supporting multiple pricing models: one-time, subscription, and freemium.
 */

// =============================================================================
// CORE PRICING TIER SCHEMAS
// =============================================================================

/**
 * Base pricing tier schema - matches Prisma PricingTier model
 */
export const pricingTierSchema = z.object({
  id: cuidSchema,
  productId: cuidSchema,
  name: nameSchema,
  description: longDescriptionSchema.optional(),
  price: priceSchema,
  currency: currencySchema,
  billingInterval: billingIntervalSchema.optional(),
  trialDays: positiveIntSchema.optional(),
  features: z.array(z.string()).default([]),
  isFreemium: z.boolean().default(false),
  isActive: z.boolean().default(true),
  sortOrder: nonNegativeIntSchema.default(0),
  stripePriceId: stripePriceIdSchema.optional(),
  createdAt: dateSchema,
  updatedAt: dateSchema,
});

/**
 * Pricing tier creation schema
 */
export const createPricingTierSchema = z.object({
  productId: cuidSchema,
  name: nameSchema,
  description: longDescriptionSchema.optional(),
  price: priceSchema,
  currency: currencySchema.optional(),
  billingInterval: billingIntervalSchema.optional(),
  trialDays: positiveIntSchema.optional(),
  features: z.array(z.string()).default([]),
  isFreemium: z.boolean().default(false),
  isActive: z.boolean().default(true),
  sortOrder: nonNegativeIntSchema.default(0),
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
  if (data.billingInterval && data.price === 0 && !data.isFreemium) {
    ctx.addIssue({
      code: 'custom',
      message: 'Subscription tiers with billing intervals must have a price greater than 0 unless they are freemium',
      path: ['billingInterval'],
    });
  }

  // Validate trial days only for subscription tiers
  if (data.trialDays && !data.billingInterval) {
    ctx.addIssue({
      code: 'custom',
      message: 'Trial days can only be set for subscription tiers',
      path: ['trialDays'],
    });
  }
});

/**
 * Pricing tier update schema
 */
export const updatePricingTierSchema = z.object({
  id: cuidSchema,
  name: nameSchema.optional(),
  description: longDescriptionSchema.optional(),
  price: priceSchema.optional(),
  currency: currencySchema.optional(),
  billingInterval: billingIntervalSchema.optional(),
  trialDays: positiveIntSchema.optional(),
  features: z.array(z.string()).optional(),
  isFreemium: z.boolean().optional(),
  isActive: z.boolean().optional(),
  sortOrder: nonNegativeIntSchema.optional(),
}).partial().required({ id: true }).superRefine((data, ctx) => {
  // Validate freemium tier pricing
  if (data.isFreemium === true && data.price && data.price > 0) {
    ctx.addIssue({
      code: 'custom',
      message: 'Freemium tiers must have a price of 0',
      path: ['price'],
    });
  }

  // Validate subscription billing interval
  if (data.billingInterval && data.price === 0 && data.isFreemium !== true) {
    ctx.addIssue({
      code: 'custom',
      message: 'Subscription tiers with billing intervals must have a price greater than 0 unless they are freemium',
      path: ['billingInterval'],
    });
  }
});

/**
 * Pricing tier search/filter schema
 */
export const pricingTierFilterSchema = z.object({
  productId: cuidSchema.optional(),
  name: z.string().optional(),
  isFreemium: z.boolean().optional(),
  isActive: z.boolean().optional(),
  priceMin: z.number().min(0).optional(),
  priceMax: z.number().min(0).optional(),
  billingInterval: billingIntervalSchema.optional(),
  hasTrialPeriod: z.boolean().optional(),
});

/**
 * Pricing tier sort options
 */
export const pricingTierSortSchema = z.enum([
  'name',
  'price',
  'sortOrder',
  'createdAt',
  'updatedAt',
]);

// =============================================================================
// BUSINESS LOGIC SCHEMAS
// =============================================================================

/**
 * Tier reorder schema
 */
export const reorderPricingTiersSchema = z.object({
  productId: cuidSchema,
  tierIds: z.array(cuidSchema).min(1, 'At least one tier ID is required'),
});

/**
 * Feature comparison schema
 */
export const featureComparisonSchema = z.object({
  productId: cuidSchema,
  features: z.array(z.string()).min(1, 'At least one feature is required for comparison'),
});

/**
 * Freemium tier validation schema
 */
export const freemiumTierValidationSchema = z.object({
  productId: cuidSchema,
  excludeCurrentTierId: cuidSchema.optional(),
});

/**
 * Bulk pricing tier update schema
 */
export const bulkPricingTierUpdateSchema = z.object({
  productId: cuidSchema,
  tierIds: z.array(cuidSchema).min(1, 'At least one tier ID is required'),
  updates: z.object({
    isActive: z.boolean().optional(),
    currency: currencySchema.optional(),
    sortOrder: nonNegativeIntSchema.optional(),
  }).partial(),
});

/**
 * Pricing tier activation schema
 */
export const activatePricingTierSchema = z.object({
  tierId: cuidSchema,
  isActive: z.boolean(),
});

// =============================================================================
// STRIPE INTEGRATION SCHEMAS
// =============================================================================

/**
 * Stripe price sync schema
 */
export const stripePriceSyncSchema = z.object({
  tierId: cuidSchema,
  stripePriceId: stripePriceIdSchema,
});

/**
 * Stripe price creation schema
 */
export const createStripePriceSchema = z.object({
  tierId: cuidSchema,
  stripeProductId: z.string().min(1, 'Stripe product ID is required'),
  metadata: z.record(z.string()).optional(),
});

// =============================================================================
// RESPONSE SCHEMAS
// =============================================================================

/**
 * Pricing tier with features schema
 */
export const pricingTierWithFeaturesSchema = pricingTierSchema.extend({
  product: z.object({
    id: cuidSchema,
    name: nameSchema,
    type: z.enum(['ONE_TIME', 'SUBSCRIPTION', 'USAGE_BASED']),
  }),
});

/**
 * Pricing tier comparison schema
 */
export const pricingTierComparisonSchema = z.object({
  productId: cuidSchema,
  tiers: z.array(pricingTierSchema),
  commonFeatures: z.array(z.string()),
  uniqueFeatures: z.record(z.array(z.string())),
});

/**
 * Pricing tier statistics schema
 */
export const pricingTierStatsSchema = z.object({
  productId: cuidSchema,
  totalTiers: z.number().min(0),
  activeTiers: z.number().min(0),
  freemiumTiers: z.number().min(0),
  subscriptionTiers: z.number().min(0),
  oneTimeTiers: z.number().min(0),
  averagePrice: z.number().min(0),
  priceRange: z.object({
    min: z.number().min(0),
    max: z.number().min(0),
  }),
});

// =============================================================================
// TYPE EXPORTS
// =============================================================================

export type PricingTier = z.infer<typeof pricingTierSchema>;
export type CreatePricingTier = z.infer<typeof createPricingTierSchema>;
export type UpdatePricingTier = z.infer<typeof updatePricingTierSchema>;
export type PricingTierFilter = z.infer<typeof pricingTierFilterSchema>;
export type PricingTierSort = z.infer<typeof pricingTierSortSchema>;
export type ReorderPricingTiers = z.infer<typeof reorderPricingTiersSchema>;
export type FeatureComparison = z.infer<typeof featureComparisonSchema>;
export type FreemiumTierValidation = z.infer<typeof freemiumTierValidationSchema>;
export type BulkPricingTierUpdate = z.infer<typeof bulkPricingTierUpdateSchema>;
export type ActivatePricingTier = z.infer<typeof activatePricingTierSchema>;
export type StripePriceSync = z.infer<typeof stripePriceSyncSchema>;
export type CreateStripePrice = z.infer<typeof createStripePriceSchema>;
export type PricingTierWithFeatures = z.infer<typeof pricingTierWithFeaturesSchema>;
export type PricingTierComparison = z.infer<typeof pricingTierComparisonSchema>;
export type PricingTierStats = z.infer<typeof pricingTierStatsSchema>;