import { z } from 'zod';
import {
  cuidSchema,
  priceSchema,
  currencySchema,
  stripeSubscriptionIdSchema,
  stripeCustomerIdSchema,
  stripePriceIdSchema,
  positiveIntSchema,
  dateSchema,
  optionalDateSchema,
  metadataSchema,
} from './common';
import { billingIntervalSchema } from './product';

/**
 * Subscription Validation Schemas
 * 
 * Comprehensive validation schemas for subscription management,
 * including billing cycles, trial periods, and Stripe integration.
 */

// =============================================================================
// ENUMS
// =============================================================================

/**
 * Subscription status validation
 */
export const subscriptionStatusSchema = z.enum([
  'INCOMPLETE',
  'INCOMPLETE_EXPIRED',
  'TRIALING',
  'ACTIVE',
  'PAST_DUE',
  'CANCELLED',
  'UNPAID',
  'PAUSED',
], {
  errorMap: () => ({ message: 'Invalid subscription status' }),
});

// =============================================================================
// CORE SUBSCRIPTION SCHEMAS
// =============================================================================

/**
 * Base subscription schema - matches Prisma Subscription model
 */
export const subscriptionSchema = z.object({
  id: cuidSchema,
  userId: cuidSchema,
  productId: cuidSchema,
  
  // Stripe Integration
  stripeSubscriptionId: stripeSubscriptionIdSchema,
  stripeCustomerId: stripeCustomerIdSchema.unwrap(), // Required for subscriptions
  stripePriceId: stripePriceIdSchema.unwrap(), // Required for subscriptions
  
  // Subscription details
  status: subscriptionStatusSchema.default('ACTIVE'),
  billingInterval: billingIntervalSchema,
  
  // Pricing
  unitPrice: priceSchema,
  quantity: positiveIntSchema.default(1),
  currency: currencySchema,
  
  // Billing dates
  currentPeriodStart: dateSchema,
  currentPeriodEnd: dateSchema,
  cancelAtPeriodEnd: z.boolean().default(false),
  
  // Trial information
  trialStart: optionalDateSchema,
  trialEnd: optionalDateSchema,
  
  // Timestamps
  createdAt: dateSchema,
  updatedAt: dateSchema,
  startedAt: dateSchema,
  endedAt: optionalDateSchema,
  cancelledAt: optionalDateSchema,
  
  // Metadata
  metadata: metadataSchema,
});

/**
 * Subscription creation schema
 */
export const createSubscriptionSchema = z.object({
  userId: cuidSchema,
  productId: cuidSchema,
  stripePriceId: stripePriceIdSchema.unwrap(),
  
  // Subscription configuration
  quantity: positiveIntSchema.default(1),
  
  // Trial configuration
  trialDays: z.number().int().min(0).max(365).optional(),
  trialEnd: optionalDateSchema,
  
  // Billing configuration
  billingCycleAnchor: optionalDateSchema,
  prorationBehavior: z.enum(['create_prorations', 'none', 'always_invoice']).default('create_prorations'),
  
  // Payment configuration
  paymentMethodId: cuidSchema.optional(),
  defaultPaymentMethod: cuidSchema.optional(),
  
  // Coupon/discount
  couponId: z.string().optional(),
  discountCodeId: cuidSchema.optional(),
  
  // Metadata
  metadata: metadataSchema,
}).superRefine((data, ctx) => {
  // Validate trial configuration
  if (data.trialDays && data.trialEnd) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Cannot specify both trialDays and trialEnd',
      path: ['trialEnd'],
    });
  }
  
  // Validate payment method is provided for non-trial subscriptions
  if (!data.trialDays && !data.trialEnd && !data.paymentMethodId && !data.defaultPaymentMethod) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Payment method is required for subscriptions without trial',
      path: ['paymentMethodId'],
    });
  }
});

/**
 * Subscription update schema
 */
export const updateSubscriptionSchema = z.object({
  id: cuidSchema,
  
  // Updateable fields
  quantity: positiveIntSchema.optional(),
  stripePriceId: stripePriceIdSchema.optional(),
  cancelAtPeriodEnd: z.boolean().optional(),
  defaultPaymentMethod: cuidSchema.optional(),
  
  // Proration configuration
  prorationBehavior: z.enum(['create_prorations', 'none', 'always_invoice']).optional(),
  prorationDate: optionalDateSchema,
  
  // Metadata
  metadata: metadataSchema,
}).partial().required({ id: true });

/**
 * Subscription cancellation schema
 */
export const cancelSubscriptionSchema = z.object({
  subscriptionId: cuidSchema,
  cancelAtPeriodEnd: z.boolean().default(true),
  cancellationReason: z.enum([
    'customer_request',
    'payment_failed',
    'product_discontinued',
    'downgrade',
    'other',
  ]).optional(),
  feedback: z.string().max(1000, 'Feedback must not exceed 1000 characters').optional(),
  immediateCancel: z.boolean().default(false),
}).superRefine((data, ctx) => {
  if (data.immediateCancel && data.cancelAtPeriodEnd) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Cannot set both immediateCancel and cancelAtPeriodEnd to true',
      path: ['immediateCancel'],
    });
  }
});

/**
 * Subscription search/filter schema
 */
export const subscriptionFilterSchema = z.object({
  userId: cuidSchema.optional(),
  productId: cuidSchema.optional(),
  status: subscriptionStatusSchema.optional(),
  billingInterval: billingIntervalSchema.optional(),
  cancelAtPeriodEnd: z.boolean().optional(),
  isTrialing: z.boolean().optional(),
  isPastDue: z.boolean().optional(),
  createdAfter: optionalDateSchema,
  createdBefore: optionalDateSchema,
  currentPeriodEndAfter: optionalDateSchema,
  currentPeriodEndBefore: optionalDateSchema,
});

/**
 * Subscription sort options
 */
export const subscriptionSortSchema = z.enum([
  'createdAt',
  'updatedAt',
  'currentPeriodStart',
  'currentPeriodEnd',
  'status',
  'unitPrice',
]);

// =============================================================================
// BILLING SCHEMAS
// =============================================================================

/**
 * Subscription billing update schema
 */
export const updateBillingSchema = z.object({
  subscriptionId: cuidSchema,
  newPriceId: stripePriceIdSchema,
  quantity: positiveIntSchema.optional(),
  prorationBehavior: z.enum(['create_prorations', 'none', 'always_invoice']).default('create_prorations'),
  billingCycleAnchor: z.enum(['now', 'unchanged']).default('unchanged'),
});

/**
 * Trial extension schema
 */
export const extendTrialSchema = z.object({
  subscriptionId: cuidSchema,
  trialEnd: dateSchema,
}).superRefine((data, ctx) => {
  const now = new Date();
  if (data.trialEnd <= now) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Trial end date must be in the future',
      path: ['trialEnd'],
    });
  }
});

/**
 * Usage record schema (for usage-based billing)
 */
export const usageRecordSchema = z.object({
  subscriptionId: cuidSchema,
  quantity: positiveIntSchema,
  timestamp: optionalDateSchema,
  action: z.enum(['increment', 'set']).default('increment'),
  description: z.string().max(255, 'Description must not exceed 255 characters').optional(),
});

// =============================================================================
// PAYMENT SCHEMAS
// =============================================================================

/**
 * Payment method update schema
 */
export const updatePaymentMethodSchema = z.object({
  subscriptionId: cuidSchema,
  paymentMethodId: cuidSchema,
  updateInvoice: z.boolean().default(true),
});

/**
 * Invoice preview schema
 */
export const invoicePreviewSchema = z.object({
  subscriptionId: cuidSchema,
  subscriptionItems: z.array(z.object({
    priceId: stripePriceIdSchema.unwrap(),
    quantity: positiveIntSchema.default(1),
    clearUsage: z.boolean().default(false),
  })).optional(),
  couponId: z.string().optional(),
  prorationDate: optionalDateSchema,
});

// =============================================================================
// PAUSE/RESUME SCHEMAS
// =============================================================================

/**
 * Subscription pause schema
 */
export const pauseSubscriptionSchema = z.object({
  subscriptionId: cuidSchema,
  pauseBehavior: z.enum(['mark_uncollectible', 'keep_as_draft', 'void']).default('mark_uncollectible'),
  resumeAt: optionalDateSchema,
});

/**
 * Subscription resume schema
 */
export const resumeSubscriptionSchema = z.object({
  subscriptionId: cuidSchema,
  prorationBehavior: z.enum(['create_prorations', 'none', 'always_invoice']).default('create_prorations'),
});

// =============================================================================
// ANALYTICS SCHEMAS
// =============================================================================

/**
 * Subscription analytics query schema
 */
export const subscriptionAnalyticsSchema = z.object({
  startDate: dateSchema,
  endDate: dateSchema,
  groupBy: z.enum(['day', 'week', 'month', 'year']).default('month'),
  status: subscriptionStatusSchema.optional(),
  billingInterval: billingIntervalSchema.optional(),
  includeTrials: z.boolean().default(true),
});

/**
 * Churn analysis schema
 */
export const churnAnalysisSchema = z.object({
  period: z.enum(['last_30_days', 'last_90_days', 'last_year', 'custom']),
  startDate: optionalDateSchema,
  endDate: optionalDateSchema,
  cohortType: z.enum(['monthly', 'weekly']).default('monthly'),
}).superRefine((data, ctx) => {
  if (data.period === 'custom') {
    if (!data.startDate || !data.endDate) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Start date and end date are required for custom period',
        path: ['startDate'],
      });
    }
  }
});

// =============================================================================
// PUBLIC SCHEMAS (FOR API RESPONSES)
// =============================================================================

/**
 * Public subscription schema (for customer-facing APIs)
 */
export const publicSubscriptionSchema = subscriptionSchema.omit({
  stripeSubscriptionId: true,
  stripeCustomerId: true,
  stripePriceId: true,
});

/**
 * Subscription summary schema
 */
export const subscriptionSummarySchema = z.object({
  id: cuidSchema,
  status: subscriptionStatusSchema,
  billingInterval: billingIntervalSchema,
  unitPrice: priceSchema,
  quantity: positiveIntSchema,
  currency: currencySchema,
  currentPeriodStart: dateSchema,
  currentPeriodEnd: dateSchema,
  cancelAtPeriodEnd: z.boolean(),
  isTrialing: z.boolean(),
  trialEnd: optionalDateSchema,
});

/**
 * Subscription details schema
 */
export const subscriptionDetailsSchema = publicSubscriptionSchema.extend({
  product: z.object({
    id: cuidSchema,
    name: z.string(),
    description: z.string().optional(),
  }),
  upcomingInvoice: z.object({
    amount: priceSchema,
    currency: currencySchema,
    periodStart: dateSchema,
    periodEnd: dateSchema,
  }).optional(),
  paymentMethod: z.object({
    id: cuidSchema,
    type: z.string(),
    last4: z.string().optional(),
    brand: z.string().optional(),
  }).optional(),
});

// =============================================================================
// ADMIN SCHEMAS
// =============================================================================

/**
 * Admin subscription update schema
 */
export const adminUpdateSubscriptionSchema = z.object({
  id: cuidSchema,
  status: subscriptionStatusSchema.optional(),
  quantity: positiveIntSchema.optional(),
  unitPrice: priceSchema.optional(),
  cancelAtPeriodEnd: z.boolean().optional(),
  currentPeriodEnd: dateSchema.optional(),
  trialEnd: optionalDateSchema,
  notes: z.string().max(1000, 'Notes must not exceed 1000 characters').optional(),
}).partial().required({ id: true });

/**
 * Bulk subscription update schema
 */
export const bulkSubscriptionUpdateSchema = z.object({
  subscriptionIds: z.array(cuidSchema).min(1, 'At least one subscription is required'),
  updates: z.object({
    status: subscriptionStatusSchema.optional(),
    cancelAtPeriodEnd: z.boolean().optional(),
  }).partial(),
});

// =============================================================================
// TYPE EXPORTS
// =============================================================================

export type Subscription = z.infer<typeof subscriptionSchema>;
export type CreateSubscription = z.infer<typeof createSubscriptionSchema>;
export type UpdateSubscription = z.infer<typeof updateSubscriptionSchema>;
export type CancelSubscription = z.infer<typeof cancelSubscriptionSchema>;
export type SubscriptionStatus = z.infer<typeof subscriptionStatusSchema>;
export type SubscriptionFilter = z.infer<typeof subscriptionFilterSchema>;
export type SubscriptionSort = z.infer<typeof subscriptionSortSchema>;
export type UpdateBilling = z.infer<typeof updateBillingSchema>;
export type ExtendTrial = z.infer<typeof extendTrialSchema>;
export type UsageRecord = z.infer<typeof usageRecordSchema>;
export type PublicSubscription = z.infer<typeof publicSubscriptionSchema>;
export type SubscriptionSummary = z.infer<typeof subscriptionSummarySchema>;
export type SubscriptionDetails = z.infer<typeof subscriptionDetailsSchema>;