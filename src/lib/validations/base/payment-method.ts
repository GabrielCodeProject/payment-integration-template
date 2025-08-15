import { z } from 'zod';
import {
  cuidSchema,
  stripePaymentMethodIdSchema,
  addressSchema,
  nameSchema,
  dateSchema,
  optionalDateSchema,
} from './common';

/**
 * Payment Method Validation Schemas
 * 
 * Comprehensive validation schemas for payment method management,
 * including PCI-compliant validation and Stripe integration.
 */

// =============================================================================
// ENUMS
// =============================================================================

/**
 * Payment method type validation
 */
export const paymentMethodTypeSchema = z.enum([
  'CARD',
  'BANK_ACCOUNT',
  'PAYPAL',
  'APPLE_PAY',
  'GOOGLE_PAY',
  'OTHER',
], {
  errorMap: () => ({ message: 'Invalid payment method type' }),
});

/**
 * Card brand validation
 */
export const cardBrandSchema = z.enum([
  'visa',
  'mastercard',
  'amex',
  'discover',
  'jcb',
  'diners',
  'unionpay',
  'unknown',
], {
  errorMap: () => ({ message: 'Invalid card brand' }),
});

// =============================================================================
// CORE PAYMENT METHOD SCHEMAS
// =============================================================================

/**
 * Base payment method schema - matches Prisma PaymentMethod model
 */
export const paymentMethodSchema = z.object({
  id: cuidSchema,
  userId: cuidSchema,
  
  // Stripe Integration
  stripePaymentMethodId: stripePaymentMethodIdSchema,
  
  // Payment method details
  type: paymentMethodTypeSchema,
  brand: cardBrandSchema.optional(),
  last4: z.string().length(4, 'Last 4 digits must be exactly 4 characters').regex(/^\d{4}$/, 'Last 4 digits must be numeric').optional(),
  expiryMonth: z.number().int().min(1).max(12).optional(),
  expiryYear: z.number().int().min(new Date().getFullYear()).max(new Date().getFullYear() + 50).optional(),
  
  // Metadata
  fingerprint: z.string().max(255, 'Fingerprint must not exceed 255 characters').optional(),
  isDefault: z.boolean().default(false),
  nickname: nameSchema.optional(),
  
  // Billing address
  billingAddress: z.union([addressSchema, z.null()]).optional(),
  
  // Status
  isActive: z.boolean().default(true),
  
  // Timestamps
  createdAt: dateSchema,
  updatedAt: dateSchema,
});

/**
 * Payment method creation schema
 */
export const createPaymentMethodSchema = z.object({
  userId: cuidSchema,
  stripePaymentMethodId: stripePaymentMethodIdSchema,
  nickname: nameSchema.optional(),
  isDefault: z.boolean().default(false),
  billingAddress: addressSchema.optional(),
}).superRefine(async (data, ctx) => {
  // Note: Additional validation against Stripe API would happen in the service layer
  // This is just basic structural validation
});

/**
 * Payment method update schema
 */
export const updatePaymentMethodSchema = z.object({
  id: cuidSchema,
  nickname: nameSchema.optional(),
  isDefault: z.boolean().optional(),
  billingAddress: addressSchema.optional(),
  isActive: z.boolean().optional(),
}).partial().required({ id: true });

/**
 * Payment method search/filter schema
 */
export const paymentMethodFilterSchema = z.object({
  userId: cuidSchema.optional(),
  type: paymentMethodTypeSchema.optional(),
  brand: cardBrandSchema.optional(),
  isDefault: z.boolean().optional(),
  isActive: z.boolean().optional(),
  expiringBefore: optionalDateSchema,
  createdAfter: optionalDateSchema,
  createdBefore: optionalDateSchema,
});

/**
 * Payment method sort options
 */
export const paymentMethodSortSchema = z.enum([
  'createdAt',
  'updatedAt',
  'type',
  'brand',
  'isDefault',
  'expiryDate',
]);

// =============================================================================
// CARD-SPECIFIC SCHEMAS
// =============================================================================

/**
 * Card validation schema (for client-side form validation only)
 * Note: Never process actual card data on the server - use Stripe Elements
 */
export const cardFormValidationSchema = z.object({
  // This is only for client-side validation before Stripe tokenization
  number: z.string().min(1, 'Card number is required'),
  expiry: z.string().regex(/^(0[1-9]|1[0-2])\/\d{2}$/, 'Invalid expiry format (MM/YY)'),
  cvc: z.string().min(3, 'CVC must be at least 3 digits').max(4, 'CVC must not exceed 4 digits'),
  name: nameSchema,
  postalCode: z.string().min(1, 'Postal code is required').max(20, 'Postal code must not exceed 20 characters'),
});

/**
 * Card expiry validation
 */
export const cardExpirySchema = z.object({
  month: z.number().int().min(1).max(12),
  year: z.number().int().min(new Date().getFullYear()).max(new Date().getFullYear() + 50),
}).superRefine((data, ctx) => {
  const currentDate = new Date();
  const currentYear = currentDate.getFullYear();
  const currentMonth = currentDate.getMonth() + 1;
  
  if (data.year === currentYear && data.month < currentMonth) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Card has expired',
      path: ['month'],
    });
  }
});

/**
 * Card verification schema
 */
export const cardVerificationSchema = z.object({
  paymentMethodId: cuidSchema,
  amount: z.number().positive().max(100, 'Verification amount cannot exceed $1.00'), // Stripe verification limits
  currency: z.string().length(3).default('usd'),
});

// =============================================================================
// BANK ACCOUNT SCHEMAS
// =============================================================================

/**
 * Bank account creation schema (for ACH/SEPA)
 */
export const createBankAccountSchema = z.object({
  userId: cuidSchema,
  stripePaymentMethodId: stripePaymentMethodIdSchema,
  accountHolderName: nameSchema,
  bankName: z.string().max(100, 'Bank name must not exceed 100 characters').optional(),
  accountType: z.enum(['checking', 'savings']).optional(),
  nickname: nameSchema.optional(),
  isDefault: z.boolean().default(false),
});

/**
 * Bank account verification schema
 */
export const verifyBankAccountSchema = z.object({
  paymentMethodId: cuidSchema,
  microDepositAmounts: z.array(z.number().positive().max(1, 'Micro deposit amount cannot exceed $1.00')).length(2, 'Exactly 2 micro deposit amounts required'),
});

// =============================================================================
// WALLET SCHEMAS (APPLE PAY, GOOGLE PAY, ETC.)
// =============================================================================

/**
 * Digital wallet payment method schema
 */
export const digitalWalletSchema = z.object({
  userId: cuidSchema,
  type: z.enum(['APPLE_PAY', 'GOOGLE_PAY']),
  stripePaymentMethodId: stripePaymentMethodIdSchema,
  deviceFingerprint: z.string().max(255, 'Device fingerprint must not exceed 255 characters').optional(),
  nickname: nameSchema.optional(),
  isDefault: z.boolean().default(false),
});

// =============================================================================
// SECURITY SCHEMAS
// =============================================================================

/**
 * Payment method security validation
 */
export const paymentMethodSecuritySchema = z.object({
  paymentMethodId: cuidSchema,
  lastUsedIpAddress: z.string().regex(/^(?:[0-9]{1,3}\.){3}[0-9]{1,3}$/, 'Invalid IP address').optional(),
  lastUsedUserAgent: z.string().max(512, 'User agent too long').optional(),
  isCompromised: z.boolean().default(false),
  blockedAt: optionalDateSchema,
  blockReason: z.string().max(255, 'Block reason must not exceed 255 characters').optional(),
});

/**
 * Fraud detection schema
 */
export const fraudDetectionSchema = z.object({
  paymentMethodId: cuidSchema,
  riskScore: z.number().min(0).max(100),
  riskFactors: z.array(z.string()).default([]),
  requiresVerification: z.boolean().default(false),
  verificationMethod: z.enum(['sms', 'email', '3ds', 'manual']).optional(),
});

// =============================================================================
// BULK OPERATIONS SCHEMAS
// =============================================================================

/**
 * Bulk payment method update schema
 */
export const bulkPaymentMethodUpdateSchema = z.object({
  paymentMethodIds: z.array(cuidSchema).min(1, 'At least one payment method is required'),
  updates: z.object({
    isActive: z.boolean().optional(),
    nickname: nameSchema.optional(),
  }).partial(),
});

/**
 * Payment method cleanup schema
 */
export const paymentMethodCleanupSchema = z.object({
  userId: cuidSchema.optional(),
  removeExpired: z.boolean().default(false),
  removeInactive: z.boolean().default(false),
  olderThan: optionalDateSchema,
  dryRun: z.boolean().default(true),
});

// =============================================================================
// PUBLIC SCHEMAS (FOR API RESPONSES)
// =============================================================================

/**
 * Public payment method schema (excludes sensitive data)
 */
export const publicPaymentMethodSchema = paymentMethodSchema.omit({
  stripePaymentMethodId: true,
  fingerprint: true,
}).extend({
  // Add computed fields
  isExpired: z.boolean(),
  isExpiringSoon: z.boolean(), // Within 30 days
});

/**
 * Payment method summary schema
 */
export const paymentMethodSummarySchema = z.object({
  id: cuidSchema,
  type: paymentMethodTypeSchema,
  brand: cardBrandSchema.optional(),
  last4: z.string().optional(),
  expiryMonth: z.number().optional(),
  expiryYear: z.number().optional(),
  nickname: nameSchema.optional(),
  isDefault: z.boolean(),
  isActive: z.boolean(),
  isExpired: z.boolean(),
  createdAt: dateSchema,
});

/**
 * Payment method for checkout
 */
export const checkoutPaymentMethodSchema = z.object({
  id: cuidSchema,
  type: paymentMethodTypeSchema,
  brand: cardBrandSchema.optional(),
  last4: z.string().optional(),
  nickname: nameSchema.optional(),
  isDefault: z.boolean(),
  billingAddress: addressSchema.optional(),
});

// =============================================================================
// ADMIN SCHEMAS
// =============================================================================

/**
 * Admin payment method view schema
 */
export const adminPaymentMethodSchema = paymentMethodSchema.extend({
  user: z.object({
    id: cuidSchema,
    email: z.string().email(),
    name: nameSchema.optional(),
  }),
  usage: z.object({
    totalTransactions: z.number().min(0),
    totalAmount: z.number().min(0),
    lastUsedAt: optionalDateSchema,
  }),
  security: paymentMethodSecuritySchema.optional(),
});

/**
 * Payment method audit schema
 */
export const paymentMethodAuditSchema = z.object({
  paymentMethodId: cuidSchema,
  action: z.enum(['created', 'updated', 'deleted', 'verified', 'blocked']),
  changes: z.record(z.unknown()).optional(),
  performedBy: cuidSchema,
  timestamp: dateSchema,
  ipAddress: z.string().optional(),
  userAgent: z.string().optional(),
});

// =============================================================================
// TYPE EXPORTS
// =============================================================================

export type PaymentMethod = z.infer<typeof paymentMethodSchema>;
export type CreatePaymentMethod = z.infer<typeof createPaymentMethodSchema>;
export type UpdatePaymentMethod = z.infer<typeof updatePaymentMethodSchema>;
export type PaymentMethodType = z.infer<typeof paymentMethodTypeSchema>;
export type CardBrand = z.infer<typeof cardBrandSchema>;
export type PaymentMethodFilter = z.infer<typeof paymentMethodFilterSchema>;
export type PaymentMethodSort = z.infer<typeof paymentMethodSortSchema>;
export type CardFormValidation = z.infer<typeof cardFormValidationSchema>;
export type CardExpiry = z.infer<typeof cardExpirySchema>;
export type PublicPaymentMethod = z.infer<typeof publicPaymentMethodSchema>;
export type PaymentMethodSummary = z.infer<typeof paymentMethodSummarySchema>;
export type CheckoutPaymentMethod = z.infer<typeof checkoutPaymentMethodSchema>;
export type AdminPaymentMethod = z.infer<typeof adminPaymentMethodSchema>;