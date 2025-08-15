import { z } from 'zod';
import {
  cuidSchema,
  nameSchema,
  shortDescriptionSchema,
  priceSchema,
  currencySchema,
  positiveIntSchema,
  nonNegativeIntSchema,
  dateSchema,
  optionalDateSchema,
} from './common';

/**
 * Discount Code Validation Schemas
 * 
 * Comprehensive validation schemas for discount code management,
 * including promotional campaigns, usage tracking, and validation rules.
 */

// =============================================================================
// ENUMS
// =============================================================================

/**
 * Discount type validation
 */
export const discountTypeSchema = z.enum(['PERCENTAGE', 'FIXED_AMOUNT', 'FREE_SHIPPING'], {
  errorMap: () => ({ message: 'Invalid discount type' }),
});

// =============================================================================
// CORE DISCOUNT CODE SCHEMAS
// =============================================================================

/**
 * Base discount code schema - matches Prisma DiscountCode model
 */
export const discountCodeSchema = z.object({
  id: cuidSchema,
  code: z.string()
    .trim()
    .toUpperCase()
    .min(3, 'Discount code must be at least 3 characters')
    .max(50, 'Discount code must not exceed 50 characters')
    .regex(/^[A-Z0-9_-]+$/, 'Discount code must contain only uppercase letters, numbers, hyphens, and underscores'),
  name: nameSchema.optional(),
  description: shortDescriptionSchema,
  
  // Discount configuration
  type: discountTypeSchema,
  value: z.number().positive('Discount value must be positive'),
  currency: currencySchema.optional(),
  
  // Usage limits
  maxUses: positiveIntSchema.optional(),
  maxUsesPerCustomer: positiveIntSchema.optional(),
  currentUses: nonNegativeIntSchema.default(0),
  
  // Minimum requirements
  minimumOrderAmount: priceSchema.optional(),
  
  // Validity period
  startsAt: optionalDateSchema,
  expiresAt: optionalDateSchema,
  
  // Status
  isActive: z.boolean().default(true),
  
  // Timestamps
  createdAt: dateSchema,
  updatedAt: dateSchema,
});

/**
 * Discount code creation schema
 */
export const createDiscountCodeSchema = z.object({
  code: z.string()
    .trim()
    .toUpperCase()
    .min(3, 'Discount code must be at least 3 characters')
    .max(50, 'Discount code must not exceed 50 characters')
    .regex(/^[A-Z0-9_-]+$/, 'Discount code must contain only uppercase letters, numbers, hyphens, and underscores'),
  name: nameSchema.optional(),
  description: shortDescriptionSchema.optional(),
  
  // Discount configuration
  type: discountTypeSchema,
  value: z.number().positive('Discount value must be positive'),
  currency: currencySchema.optional(),
  
  // Usage limits
  maxUses: positiveIntSchema.optional(),
  maxUsesPerCustomer: positiveIntSchema.optional(),
  
  // Minimum requirements
  minimumOrderAmount: priceSchema.optional(),
  
  // Validity period
  startsAt: optionalDateSchema,
  expiresAt: optionalDateSchema,
  
  // Auto-generation options
  generateRandomCode: z.boolean().default(false),
  codePrefix: z.string().max(10, 'Code prefix must not exceed 10 characters').optional(),
  codeLength: z.number().int().min(6).max(20).default(8).optional(),
}).superRefine((data, ctx) => {
  // Validate percentage discounts
  if (data.type === 'PERCENTAGE' && data.value > 100) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Percentage discount cannot exceed 100%',
      path: ['value'],
    });
  }
  
  // Validate fixed amount discounts require currency
  if (data.type === 'FIXED_AMOUNT' && !data.currency) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Currency is required for fixed amount discounts',
      path: ['currency'],
    });
  }
  
  // Validate free shipping doesn't need value
  if (data.type === 'FREE_SHIPPING' && data.value !== 0) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Free shipping discount should have zero value',
      path: ['value'],
    });
  }
  
  // Validate date range
  if (data.startsAt && data.expiresAt && data.startsAt >= data.expiresAt) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Start date must be before expiry date',
      path: ['expiresAt'],
    });
  }
  
  // Validate minimum order amount for percentage discounts
  if (data.type === 'PERCENTAGE' && data.minimumOrderAmount && data.currency) {
    // This validation would ideally check currency compatibility
  }
  
  // Validate code generation options
  if (data.generateRandomCode && data.code) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Cannot specify both custom code and random code generation',
      path: ['generateRandomCode'],
    });
  }
});

/**
 * Discount code update schema
 */
export const updateDiscountCodeSchema = z.object({
  id: cuidSchema,
  name: nameSchema.optional(),
  description: shortDescriptionSchema.optional(),
  maxUses: positiveIntSchema.optional(),
  maxUsesPerCustomer: positiveIntSchema.optional(),
  minimumOrderAmount: priceSchema.optional(),
  startsAt: optionalDateSchema,
  expiresAt: optionalDateSchema,
  isActive: z.boolean().optional(),
}).partial().required({ id: true }).superRefine((data, ctx) => {
  // Validate date range
  if (data.startsAt && data.expiresAt && data.startsAt >= data.expiresAt) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Start date must be before expiry date',
      path: ['expiresAt'],
    });
  }
});

/**
 * Discount code search/filter schema
 */
export const discountCodeFilterSchema = z.object({
  code: z.string().optional(),
  type: discountTypeSchema.optional(),
  isActive: z.boolean().optional(),
  isExpired: z.boolean().optional(),
  hasUsageLimit: z.boolean().optional(),
  isFullyUsed: z.boolean().optional(),
  createdAfter: optionalDateSchema,
  createdBefore: optionalDateSchema,
  startsAfter: optionalDateSchema,
  startsBefore: optionalDateSchema,
  expiresAfter: optionalDateSchema,
  expiresBefore: optionalDateSchema,
});

/**
 * Discount code sort options
 */
export const discountCodeSortSchema = z.enum([
  'code',
  'createdAt',
  'updatedAt',
  'startsAt',
  'expiresAt',
  'currentUses',
  'value',
  'type',
]);

// =============================================================================
// VALIDATION SCHEMAS
// =============================================================================

/**
 * Discount code validation schema (for applying to orders)
 */
export const validateDiscountCodeSchema = z.object({
  code: z.string().trim().toUpperCase(),
  userId: cuidSchema.optional(),
  orderAmount: priceSchema,
  currency: currencySchema,
  customerEmail: z.string().email('Invalid email format').optional(),
});

/**
 * Discount code application schema
 */
export const applyDiscountCodeSchema = z.object({
  code: z.string().trim().toUpperCase(),
  orderId: cuidSchema,
  userId: cuidSchema.optional(),
  validateOnly: z.boolean().default(false),
});

/**
 * Discount calculation result schema
 */
export const discountCalculationSchema = z.object({
  discountCodeId: cuidSchema,
  code: z.string(),
  type: discountTypeSchema,
  discountAmount: z.number().min(0),
  newTotal: z.number().min(0),
  isValid: z.boolean(),
  validationErrors: z.array(z.string()).default([]),
  appliedAt: dateSchema,
});

// =============================================================================
// USAGE TRACKING SCHEMAS
// =============================================================================

/**
 * User discount code usage schema
 */
export const userDiscountCodeSchema = z.object({
  id: cuidSchema,
  userId: cuidSchema,
  discountCodeId: cuidSchema,
  usageCount: nonNegativeIntSchema.default(0),
  firstUsedAt: dateSchema,
  lastUsedAt: dateSchema,
});

/**
 * Discount code usage tracking schema
 */
export const discountCodeUsageSchema = z.object({
  discountCodeId: cuidSchema,
  userId: cuidSchema.optional(),
  orderId: cuidSchema,
  discountAmount: z.number().min(0),
  orderTotal: z.number().min(0),
  customerEmail: z.string().email(),
  usedAt: dateSchema,
  ipAddress: z.string().optional(),
  userAgent: z.string().optional(),
});

/**
 * Usage statistics schema
 */
export const discountCodeStatsSchema = z.object({
  discountCodeId: cuidSchema,
  totalUses: nonNegativeIntSchema,
  totalDiscountAmount: z.number().min(0),
  totalOrderValue: z.number().min(0),
  uniqueCustomers: nonNegativeIntSchema,
  averageOrderValue: z.number().min(0),
  conversionRate: z.number().min(0).max(1),
  lastUsedAt: optionalDateSchema,
});

// =============================================================================
// BULK OPERATIONS SCHEMAS
// =============================================================================

/**
 * Bulk discount code creation schema
 */
export const bulkCreateDiscountCodesSchema = z.object({
  template: createDiscountCodeSchema.omit({ code: true, generateRandomCode: true }),
  quantity: z.number().int().min(1).max(1000),
  codePattern: z.object({
    prefix: z.string().max(10, 'Prefix must not exceed 10 characters').optional(),
    suffix: z.string().max(10, 'Suffix must not exceed 10 characters').optional(),
    length: z.number().int().min(6).max(20).default(8),
    includeNumbers: z.boolean().default(true),
    includeLetters: z.boolean().default(true),
    excludeSimilar: z.boolean().default(true), // Exclude 0, O, I, 1, etc.
  }),
  uniqueValues: z.boolean().default(false), // Generate unique values for each code
});

/**
 * Bulk discount code update schema
 */
export const bulkUpdateDiscountCodesSchema = z.object({
  discountCodeIds: z.array(cuidSchema).min(1, 'At least one discount code is required'),
  updates: z.object({
    isActive: z.boolean().optional(),
    expiresAt: optionalDateSchema,
    maxUses: positiveIntSchema.optional(),
    maxUsesPerCustomer: positiveIntSchema.optional(),
  }).partial(),
});

/**
 * Discount code import schema
 */
export const importDiscountCodesSchema = z.object({
  codes: z.array(createDiscountCodeSchema).min(1, 'At least one discount code is required'),
  skipDuplicates: z.boolean().default(true),
  updateExisting: z.boolean().default(false),
});

// =============================================================================
// ANALYTICS SCHEMAS
// =============================================================================

/**
 * Discount code analytics query schema
 */
export const discountCodeAnalyticsSchema = z.object({
  startDate: dateSchema,
  endDate: dateSchema,
  groupBy: z.enum(['day', 'week', 'month']).default('day'),
  discountCodeIds: z.array(cuidSchema).optional(),
  type: discountTypeSchema.optional(),
  includeInactive: z.boolean().default(false),
});

/**
 * Campaign performance schema
 */
export const campaignPerformanceSchema = z.object({
  discountCodeIds: z.array(cuidSchema),
  period: z.enum(['last_7_days', 'last_30_days', 'last_90_days', 'custom']),
  startDate: optionalDateSchema,
  endDate: optionalDateSchema,
  metrics: z.array(z.enum([
    'total_uses',
    'unique_customers',
    'total_discount_amount',
    'total_order_value',
    'average_order_value',
    'conversion_rate',
  ])).default(['total_uses', 'total_discount_amount', 'conversion_rate']),
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
 * Public discount code schema (for customer validation)
 */
export const publicDiscountCodeSchema = z.object({
  code: z.string(),
  type: discountTypeSchema,
  value: z.number(),
  currency: currencySchema.optional(),
  minimumOrderAmount: priceSchema.optional(),
  description: shortDescriptionSchema,
  expiresAt: optionalDateSchema,
  isValid: z.boolean(),
  remainingUses: z.number().optional(),
});

/**
 * Discount code validation result
 */
export const discountValidationResultSchema = z.object({
  isValid: z.boolean(),
  code: z.string(),
  discountAmount: z.number().optional(),
  newTotal: z.number().optional(),
  errors: z.array(z.string()).default([]),
  warnings: z.array(z.string()).default([]),
});

// =============================================================================
// ADMIN SCHEMAS
// =============================================================================

/**
 * Admin discount code view schema
 */
export const adminDiscountCodeSchema = discountCodeSchema.extend({
  statistics: discountCodeStatsSchema.optional(),
  recentUsage: z.array(discountCodeUsageSchema).default([]),
  creator: z.object({
    id: cuidSchema,
    name: nameSchema.optional(),
    email: z.string().email(),
  }).optional(),
});

/**
 * Discount code audit schema
 */
export const discountCodeAuditSchema = z.object({
  discountCodeId: cuidSchema,
  action: z.enum(['created', 'updated', 'deleted', 'used', 'expired', 'deactivated']),
  changes: z.record(z.unknown()).optional(),
  performedBy: cuidSchema.optional(),
  timestamp: dateSchema,
  metadata: z.record(z.unknown()).optional(),
});

// =============================================================================
// TYPE EXPORTS
// =============================================================================

export type DiscountCode = z.infer<typeof discountCodeSchema>;
export type CreateDiscountCode = z.infer<typeof createDiscountCodeSchema>;
export type UpdateDiscountCode = z.infer<typeof updateDiscountCodeSchema>;
export type DiscountType = z.infer<typeof discountTypeSchema>;
export type DiscountCodeFilter = z.infer<typeof discountCodeFilterSchema>;
export type DiscountCodeSort = z.infer<typeof discountCodeSortSchema>;
export type ValidateDiscountCode = z.infer<typeof validateDiscountCodeSchema>;
export type ApplyDiscountCode = z.infer<typeof applyDiscountCodeSchema>;
export type DiscountCalculation = z.infer<typeof discountCalculationSchema>;
export type UserDiscountCode = z.infer<typeof userDiscountCodeSchema>;
export type DiscountCodeUsage = z.infer<typeof discountCodeUsageSchema>;
export type DiscountCodeStats = z.infer<typeof discountCodeStatsSchema>;
export type PublicDiscountCode = z.infer<typeof publicDiscountCodeSchema>;
export type DiscountValidationResult = z.infer<typeof discountValidationResultSchema>;
export type AdminDiscountCode = z.infer<typeof adminDiscountCodeSchema>;