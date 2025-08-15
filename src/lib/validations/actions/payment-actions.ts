import { z } from 'zod';
import {
  createPaymentMethodSchema,
  updatePaymentMethodSchema,
  cardVerificationSchema,
  createBankAccountSchema,
  verifyBankAccountSchema,
  digitalWalletSchema,
  paymentMethodFilterSchema,
  paymentMethodSortSchema,
  bulkPaymentMethodUpdateSchema,
  paymentMethodCleanupSchema,
} from '../base/payment-method';
import {
  cuidSchema,
  priceSchema,
  currencySchema,
  addressSchema,
  limitSchema,
  offsetSchema,
  sortDirectionSchema,
  stripePaymentIntentIdSchema,
} from '../base/common';

/**
 * Payment Actions Validation Schemas
 * 
 * PCI-compliant server action validation schemas for payment operations.
 * These schemas ensure secure handling of payment data and Stripe integration.
 */

// =============================================================================
// PAYMENT METHOD MANAGEMENT ACTIONS
// =============================================================================

/**
 * Create payment method action schema
 * Note: This only handles Stripe payment method IDs, never raw card data
 */
export const createPaymentMethodActionSchema = createPaymentMethodSchema.extend({
  setAsDefault: z.boolean().default(false),
  verifyCard: z.boolean().default(false), // Whether to verify the card with a small charge
});

/**
 * Update payment method action schema
 */
export const updatePaymentMethodActionSchema = updatePaymentMethodSchema;

/**
 * Delete payment method action schema
 */
export const deletePaymentMethodActionSchema = z.object({
  paymentMethodId: cuidSchema,
  reason: z.enum(['user_request', 'expired', 'security', 'duplicate']).default('user_request'),
  transferDefault: cuidSchema.optional(), // Transfer default status to another payment method
});

/**
 * Set default payment method action schema
 */
export const setDefaultPaymentMethodActionSchema = z.object({
  paymentMethodId: cuidSchema,
  userId: cuidSchema.optional(), // If not provided, uses current user
});

/**
 * Get payment methods action schema
 */
export const getPaymentMethodsActionSchema = z.object({
  userId: cuidSchema.optional(), // If not provided, uses current user
  filters: paymentMethodFilterSchema.optional(),
  sort: z.object({
    field: paymentMethodSortSchema,
    direction: sortDirectionSchema,
  }).optional(),
  includeExpired: z.boolean().default(false),
  limit: limitSchema.default(20),
  offset: offsetSchema.default(0),
});

/**
 * Get payment method by ID action schema
 */
export const getPaymentMethodByIdActionSchema = z.object({
  paymentMethodId: cuidSchema,
  userId: cuidSchema.optional(), // If not provided, uses current user
});

// =============================================================================
// CARD VERIFICATION ACTIONS
// =============================================================================

/**
 * Verify card action schema
 */
export const verifyCardActionSchema = cardVerificationSchema;

/**
 * Check card status action schema
 */
export const checkCardStatusActionSchema = z.object({
  paymentMethodId: cuidSchema,
  refreshFromStripe: z.boolean().default(false),
});

// =============================================================================
// BANK ACCOUNT ACTIONS
// =============================================================================

/**
 * Add bank account action schema
 */
export const addBankAccountActionSchema = createBankAccountSchema;

/**
 * Verify bank account action schema
 */
export const verifyBankAccountActionSchema = verifyBankAccountSchema;

/**
 * Initiate bank account verification action schema
 */
export const initiateBankVerificationActionSchema = z.object({
  paymentMethodId: cuidSchema,
});

// =============================================================================
// DIGITAL WALLET ACTIONS
// =============================================================================

/**
 * Add digital wallet action schema
 */
export const addDigitalWalletActionSchema = digitalWalletSchema;

/**
 * Validate wallet compatibility action schema
 */
export const validateWalletCompatibilityActionSchema = z.object({
  walletType: z.enum(['APPLE_PAY', 'GOOGLE_PAY']),
  userAgent: z.string().max(512),
  domain: z.string().url('Invalid domain'),
});

// =============================================================================
// PAYMENT PROCESSING ACTIONS
// =============================================================================

/**
 * Create payment intent action schema
 */
export const createPaymentIntentActionSchema = z.object({
  amount: priceSchema,
  currency: currencySchema,
  paymentMethodId: cuidSchema.optional(),
  customerId: cuidSchema.optional(), // User ID
  orderId: cuidSchema.optional(),
  description: z.string().max(255, 'Description must not exceed 255 characters').optional(),
  metadata: z.record(z.string()).optional(),
  captureMethod: z.enum(['automatic', 'manual']).default('automatic'),
  confirmationMethod: z.enum(['automatic', 'manual']).default('automatic'),
  setupFutureUsage: z.enum(['on_session', 'off_session']).optional(),
  returnUrl: z.string().url('Invalid return URL').optional(),
});

/**
 * Confirm payment intent action schema
 */
export const confirmPaymentIntentActionSchema = z.object({
  paymentIntentId: stripePaymentIntentIdSchema.unwrap(),
  paymentMethodId: cuidSchema.optional(),
  returnUrl: z.string().url('Invalid return URL').optional(),
});

/**
 * Cancel payment intent action schema
 */
export const cancelPaymentIntentActionSchema = z.object({
  paymentIntentId: stripePaymentIntentIdSchema.unwrap(),
  cancellationReason: z.enum(['duplicate', 'fraudulent', 'requested_by_customer', 'abandoned']).optional(),
});

/**
 * Capture payment intent action schema
 */
export const capturePaymentIntentActionSchema = z.object({
  paymentIntentId: stripePaymentIntentIdSchema.unwrap(),
  amountToCapture: priceSchema.optional(), // If not provided, captures full amount
});

// =============================================================================
// REFUND ACTIONS
// =============================================================================

/**
 * Create refund action schema
 */
export const createRefundActionSchema = z.object({
  paymentIntentId: stripePaymentIntentIdSchema.unwrap().optional(),
  chargeId: z.string().startsWith('ch_', 'Invalid charge ID').optional(),
  amount: priceSchema.optional(), // If not provided, refunds full amount
  reason: z.enum(['duplicate', 'fraudulent', 'requested_by_customer']).optional(),
  metadata: z.record(z.string()).optional(),
  refundApplicationFee: z.boolean().default(false),
  reverseTransfer: z.boolean().default(false),
}).refine(
  (data) => data.paymentIntentId || data.chargeId,
  {
    message: 'Either payment intent ID or charge ID is required',
    path: ['paymentIntentId'],
  }
);

/**
 * Get refund details action schema
 */
export const getRefundDetailsActionSchema = z.object({
  refundId: z.string().startsWith('re_', 'Invalid refund ID'),
});

/**
 * List refunds action schema
 */
export const listRefundsActionSchema = z.object({
  paymentIntentId: stripePaymentIntentIdSchema.unwrap().optional(),
  chargeId: z.string().startsWith('ch_', 'Invalid charge ID').optional(),
  limit: limitSchema.default(20),
  startingAfter: z.string().optional(),
  endingBefore: z.string().optional(),
});

// =============================================================================
// PAYMENT SECURITY ACTIONS
// =============================================================================

/**
 * Check payment security action schema
 */
export const checkPaymentSecurityActionSchema = z.object({
  paymentMethodId: cuidSchema,
  amount: priceSchema,
  currency: currencySchema,
  billingAddress: addressSchema.optional(),
  deviceFingerprint: z.string().max(255).optional(),
});

/**
 * Report payment fraud action schema
 */
export const reportPaymentFraudActionSchema = z.object({
  paymentIntentId: stripePaymentIntentIdSchema.unwrap(),
  fraudType: z.enum(['stolen_card', 'unauthorized_use', 'chargeback', 'identity_theft', 'other']),
  description: z.string().max(1000, 'Description must not exceed 1000 characters'),
  evidence: z.array(z.string().url()).max(10, 'Cannot provide more than 10 evidence URLs').default([]),
});

/**
 * Block payment method action schema
 */
export const blockPaymentMethodActionSchema = z.object({
  paymentMethodId: cuidSchema,
  reason: z.enum(['fraud', 'chargebacks', 'user_request', 'security']),
  description: z.string().max(500, 'Description must not exceed 500 characters').optional(),
  notifyUser: z.boolean().default(true),
});

/**
 * Unblock payment method action schema
 */
export const unblockPaymentMethodActionSchema = z.object({
  paymentMethodId: cuidSchema,
  reason: z.string().max(500, 'Reason must not exceed 500 characters'),
  verificationRequired: z.boolean().default(true),
});

// =============================================================================
// PAYMENT ANALYTICS ACTIONS
// =============================================================================

/**
 * Get payment statistics action schema
 */
export const getPaymentStatsActionSchema = z.object({
  userId: cuidSchema.optional(), // If not provided, gets global stats (admin only)
  period: z.enum(['last_24_hours', 'last_7_days', 'last_30_days', 'last_90_days', 'last_year', 'custom']),
  startDate: z.date().optional(),
  endDate: z.date().optional(),
  currency: currencySchema.optional(),
  paymentMethodType: z.enum(['card', 'bank_account', 'wallet']).optional(),
}).refine(
  (data) => {
    if (data.period === 'custom') {
      return data.startDate && data.endDate;
    }
    return true;
  },
  {
    message: 'Start date and end date are required for custom period',
    path: ['startDate'],
  }
);

/**
 * Get payment method usage action schema
 */
export const getPaymentMethodUsageActionSchema = z.object({
  paymentMethodId: cuidSchema,
  period: z.enum(['last_30_days', 'last_90_days', 'last_year', 'all_time']).default('last_30_days'),
  includeFailedAttempts: z.boolean().default(false),
});

// =============================================================================
// BULK PAYMENT ACTIONS
// =============================================================================

/**
 * Bulk update payment methods action schema
 */
export const bulkUpdatePaymentMethodsActionSchema = bulkPaymentMethodUpdateSchema;

/**
 * Cleanup payment methods action schema
 */
export const cleanupPaymentMethodsActionSchema = paymentMethodCleanupSchema;

/**
 * Export payment data action schema (for compliance)
 */
export const exportPaymentDataActionSchema = z.object({
  userId: cuidSchema,
  includePaymentMethods: z.boolean().default(false), // Exclude sensitive data by default
  includeTransactionHistory: z.boolean().default(true),
  format: z.enum(['json', 'csv']).default('json'),
  period: z.enum(['last_year', 'all_time', 'custom']).default('all_time'),
  startDate: z.date().optional(),
  endDate: z.date().optional(),
}).refine(
  (data) => {
    if (data.period === 'custom') {
      return data.startDate && data.endDate;
    }
    return true;
  },
  {
    message: 'Start date and end date are required for custom period',
    path: ['startDate'],
  }
);

// =============================================================================
// WEBHOOK ACTIONS
// =============================================================================

/**
 * Handle payment webhook action schema
 */
export const handlePaymentWebhookActionSchema = z.object({
  eventType: z.string().min(1, 'Event type is required'),
  eventId: z.string().min(1, 'Event ID is required'),
  stripeSignature: z.string().min(1, 'Stripe signature is required'),
  payload: z.string().min(1, 'Payload is required'),
  livemode: z.boolean(),
});

/**
 * Retry webhook processing action schema
 */
export const retryWebhookActionSchema = z.object({
  webhookEventId: z.string().min(1, 'Webhook event ID is required'),
  maxRetries: z.number().int().min(1).max(5).default(3),
});

// =============================================================================
// PCI COMPLIANCE ACTIONS
// =============================================================================

/**
 * PCI compliance check action schema
 */
export const pciComplianceCheckActionSchema = z.object({
  checkType: z.enum(['payment_methods', 'transactions', 'data_storage', 'access_controls']),
  scope: z.enum(['user', 'system', 'full']).default('user'),
  userId: cuidSchema.optional(),
});

/**
 * Secure data deletion action schema
 */
export const secureDataDeletionActionSchema = z.object({
  dataType: z.enum(['payment_methods', 'transaction_logs', 'temporary_data', 'all']),
  olderThan: z.date().optional(),
  userId: cuidSchema.optional(),
  dryRun: z.boolean().default(true),
  reason: z.string().max(255, 'Reason must not exceed 255 characters'),
});

// =============================================================================
// RESPONSE SCHEMAS
// =============================================================================

/**
 * Payment action success response schema
 */
export const paymentActionSuccessSchema = z.object({
  success: z.literal(true),
  data: z.record(z.unknown()),
  message: z.string().optional(),
  clientSecret: z.string().optional(), // For Stripe Elements
  requiresAction: z.boolean().optional(),
  nextAction: z.object({
    type: z.string(),
    data: z.record(z.unknown()),
  }).optional(),
});

/**
 * Payment action error response schema
 */
export const paymentActionErrorSchema = z.object({
  success: z.literal(false),
  error: z.string(),
  code: z.enum([
    'PAYMENT_METHOD_NOT_FOUND',
    'PAYMENT_FAILED',
    'INSUFFICIENT_FUNDS',
    'CARD_DECLINED',
    'CARD_EXPIRED',
    'INVALID_CVC',
    'INCORRECT_ZIP',
    'PROCESSING_ERROR',
    'AUTHENTICATION_REQUIRED',
    'RATE_LIMITED',
    'AMOUNT_TOO_SMALL',
    'AMOUNT_TOO_LARGE',
    'CURRENCY_NOT_SUPPORTED',
    'DUPLICATE_TRANSACTION',
    'REFUND_FAILED',
    'WEBHOOK_ERROR',
    'PCI_VIOLATION',
    'FRAUD_DETECTED',
    'BLOCKED_PAYMENT_METHOD',
  ]).optional(),
  details: z.record(z.unknown()).optional(),
  declineCode: z.string().optional(),
  networkStatus: z.string().optional(),
  reason: z.string().optional(),
});

/**
 * Payment action response schema
 */
export const paymentActionResponseSchema = z.union([
  paymentActionSuccessSchema,
  paymentActionErrorSchema,
]);

// =============================================================================
// TYPE EXPORTS
// =============================================================================

export type CreatePaymentMethodAction = z.infer<typeof createPaymentMethodActionSchema>;
export type UpdatePaymentMethodAction = z.infer<typeof updatePaymentMethodActionSchema>;
export type DeletePaymentMethodAction = z.infer<typeof deletePaymentMethodActionSchema>;
export type SetDefaultPaymentMethodAction = z.infer<typeof setDefaultPaymentMethodActionSchema>;
export type GetPaymentMethodsAction = z.infer<typeof getPaymentMethodsActionSchema>;
export type GetPaymentMethodByIdAction = z.infer<typeof getPaymentMethodByIdActionSchema>;
export type VerifyCardAction = z.infer<typeof verifyCardActionSchema>;
export type CheckCardStatusAction = z.infer<typeof checkCardStatusActionSchema>;
export type AddBankAccountAction = z.infer<typeof addBankAccountActionSchema>;
export type VerifyBankAccountAction = z.infer<typeof verifyBankAccountActionSchema>;
export type InitiateBankVerificationAction = z.infer<typeof initiateBankVerificationActionSchema>;
export type AddDigitalWalletAction = z.infer<typeof addDigitalWalletActionSchema>;
export type ValidateWalletCompatibilityAction = z.infer<typeof validateWalletCompatibilityActionSchema>;
export type CreatePaymentIntentAction = z.infer<typeof createPaymentIntentActionSchema>;
export type ConfirmPaymentIntentAction = z.infer<typeof confirmPaymentIntentActionSchema>;
export type CancelPaymentIntentAction = z.infer<typeof cancelPaymentIntentActionSchema>;
export type CapturePaymentIntentAction = z.infer<typeof capturePaymentIntentActionSchema>;
export type CreateRefundAction = z.infer<typeof createRefundActionSchema>;
export type GetRefundDetailsAction = z.infer<typeof getRefundDetailsActionSchema>;
export type ListRefundsAction = z.infer<typeof listRefundsActionSchema>;
export type CheckPaymentSecurityAction = z.infer<typeof checkPaymentSecurityActionSchema>;
export type ReportPaymentFraudAction = z.infer<typeof reportPaymentFraudActionSchema>;
export type BlockPaymentMethodAction = z.infer<typeof blockPaymentMethodActionSchema>;
export type UnblockPaymentMethodAction = z.infer<typeof unblockPaymentMethodActionSchema>;
export type GetPaymentStatsAction = z.infer<typeof getPaymentStatsActionSchema>;
export type GetPaymentMethodUsageAction = z.infer<typeof getPaymentMethodUsageActionSchema>;
export type BulkUpdatePaymentMethodsAction = z.infer<typeof bulkUpdatePaymentMethodsActionSchema>;
export type CleanupPaymentMethodsAction = z.infer<typeof cleanupPaymentMethodsActionSchema>;
export type ExportPaymentDataAction = z.infer<typeof exportPaymentDataActionSchema>;
export type HandlePaymentWebhookAction = z.infer<typeof handlePaymentWebhookActionSchema>;
export type RetryWebhookAction = z.infer<typeof retryWebhookActionSchema>;
export type PCIComplianceCheckAction = z.infer<typeof pciComplianceCheckActionSchema>;
export type SecureDataDeletionAction = z.infer<typeof secureDataDeletionActionSchema>;
export type PaymentActionSuccess = z.infer<typeof paymentActionSuccessSchema>;
export type PaymentActionError = z.infer<typeof paymentActionErrorSchema>;
export type PaymentActionResponse = z.infer<typeof paymentActionResponseSchema>;