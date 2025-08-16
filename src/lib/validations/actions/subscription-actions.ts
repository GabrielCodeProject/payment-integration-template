import { z } from 'zod';
import {
  createSubscriptionSchema,
  updateSubscriptionSchema,
  cancelSubscriptionSchema,
  subscriptionFilterSchema,
  subscriptionSortSchema,
  updateBillingSchema,
  extendTrialSchema,
  usageRecordSchema,
  updatePaymentMethodSchema,
  pauseSubscriptionSchema,
  resumeSubscriptionSchema,
} from '../base/subscription';
import {
  cuidSchema,
  limitSchema,
  pageSchema,
  sortDirectionSchema,
} from '../base/common';

/**
 * Subscription Actions Validation Schemas
 * 
 * Server Action validation schemas for subscription management operations.
 * These schemas handle recurring billing, trials, and subscription lifecycle.
 */

// =============================================================================
// SUBSCRIPTION MANAGEMENT ACTIONS
// =============================================================================

export const createSubscriptionActionSchema = createSubscriptionSchema.extend({
  autoConfirm: z.boolean().default(true),
  sendWelcomeEmail: z.boolean().default(true),
});

export const updateSubscriptionActionSchema = updateSubscriptionSchema.extend({
  notifyCustomer: z.boolean().default(false),
  reason: z.string().max(255).optional(),
});

export const cancelSubscriptionActionSchema = cancelSubscriptionSchema.extend({
  sendCancellationEmail: z.boolean().default(true),
});

export const pauseSubscriptionActionSchema = pauseSubscriptionSchema.extend({
  notifyCustomer: z.boolean().default(true),
});

export const resumeSubscriptionActionSchema = resumeSubscriptionSchema.extend({
  notifyCustomer: z.boolean().default(true),
});

export const getSubscriptionByIdActionSchema = z.object({
  subscriptionId: cuidSchema,
  includeUsage: z.boolean().default(false),
  includeInvoices: z.boolean().default(false),
  includePaymentHistory: z.boolean().default(false),
});

export const listSubscriptionsActionSchema = z.object({
  filters: subscriptionFilterSchema.optional(),
  sort: z.object({
    field: subscriptionSortSchema,
    direction: sortDirectionSchema,
  }).optional(),
  pagination: z.object({
    page: pageSchema,
    limit: limitSchema,
  }).optional(),
  userId: cuidSchema.optional(),
});

// =============================================================================
// BILLING ACTIONS
// =============================================================================

export const updateBillingActionSchema = updateBillingSchema.extend({
  notifyCustomer: z.boolean().default(true),
});

export const extendTrialActionSchema = extendTrialSchema;

export const recordUsageActionSchema = usageRecordSchema;

export const updateSubscriptionPaymentMethodActionSchema = updatePaymentMethodSchema;

// =============================================================================
// RESPONSE SCHEMAS
// =============================================================================

export const subscriptionActionSuccessSchema = z.object({
  success: z.literal(true),
  data: z.record(z.unknown()),
  message: z.string().optional(),
});

export const subscriptionActionErrorSchema = z.object({
  success: z.literal(false),
  error: z.string(),
  code: z.enum([
    'SUBSCRIPTION_NOT_FOUND',
    'INVALID_STATUS_TRANSITION',
    'PAYMENT_METHOD_REQUIRED',
    'BILLING_UPDATE_FAILED',
    'TRIAL_EXTENSION_FAILED',
    'USAGE_RECORDING_FAILED',
    'PERMISSION_DENIED',
  ]).optional(),
  details: z.record(z.unknown()).optional(),
});

export const subscriptionActionResponseSchema = z.union([
  subscriptionActionSuccessSchema,
  subscriptionActionErrorSchema,
]);

// =============================================================================
// TYPE EXPORTS
// =============================================================================

export type CreateSubscriptionAction = z.infer<typeof createSubscriptionActionSchema>;
export type UpdateSubscriptionAction = z.infer<typeof updateSubscriptionActionSchema>;
export type CancelSubscriptionAction = z.infer<typeof cancelSubscriptionActionSchema>;
export type PauseSubscriptionAction = z.infer<typeof pauseSubscriptionActionSchema>;
export type ResumeSubscriptionAction = z.infer<typeof resumeSubscriptionActionSchema>;
export type GetSubscriptionByIdAction = z.infer<typeof getSubscriptionByIdActionSchema>;
export type ListSubscriptionsAction = z.infer<typeof listSubscriptionsActionSchema>;
export type UpdateBillingAction = z.infer<typeof updateBillingActionSchema>;
export type ExtendTrialAction = z.infer<typeof extendTrialActionSchema>;
export type RecordUsageAction = z.infer<typeof recordUsageActionSchema>;
export type UpdateSubscriptionPaymentMethodAction = z.infer<typeof updateSubscriptionPaymentMethodActionSchema>;
export type SubscriptionActionSuccess = z.infer<typeof subscriptionActionSuccessSchema>;
export type SubscriptionActionError = z.infer<typeof subscriptionActionErrorSchema>;
export type SubscriptionActionResponse = z.infer<typeof subscriptionActionResponseSchema>;