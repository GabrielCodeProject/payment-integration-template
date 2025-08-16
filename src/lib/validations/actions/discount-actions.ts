import { z } from 'zod';
import {
  createDiscountCodeSchema,
  updateDiscountCodeSchema,
  validateDiscountCodeSchema,
  applyDiscountCodeSchema,
  discountCodeFilterSchema,
  discountCodeSortSchema,
  bulkCreateDiscountCodesSchema,
  bulkUpdateDiscountCodesSchema,
} from '../base/discount-code';
import {
  cuidSchema,
  limitSchema,
  pageSchema,
  sortDirectionSchema,
} from '../base/common';

/**
 * Discount Code Actions Validation Schemas
 * 
 * Server Action validation schemas for discount code management operations.
 * These schemas handle promotional campaigns and discount validation.
 */

// =============================================================================
// DISCOUNT CODE MANAGEMENT ACTIONS
// =============================================================================

export const createDiscountCodeActionSchema = createDiscountCodeSchema;

export const updateDiscountCodeActionSchema = updateDiscountCodeSchema;

export const deleteDiscountCodeActionSchema = z.object({
  discountCodeId: cuidSchema,
  reason: z.string().max(255).optional(),
});

export const validateDiscountCodeActionSchema = validateDiscountCodeSchema;

export const applyDiscountCodeActionSchema = applyDiscountCodeSchema;

export const getDiscountCodeByIdActionSchema = z.object({
  discountCodeId: cuidSchema,
  includeUsageStats: z.boolean().default(false),
});

export const listDiscountCodesActionSchema = z.object({
  filters: discountCodeFilterSchema.optional(),
  sort: z.object({
    field: discountCodeSortSchema,
    direction: sortDirectionSchema,
  }).optional(),
  pagination: z.object({
    page: pageSchema,
    limit: limitSchema,
  }).optional(),
});

// =============================================================================
// BULK OPERATIONS ACTIONS
// =============================================================================

export const bulkCreateDiscountCodesActionSchema = bulkCreateDiscountCodesSchema;

export const bulkUpdateDiscountCodesActionSchema = bulkUpdateDiscountCodesSchema;

// =============================================================================
// RESPONSE SCHEMAS
// =============================================================================

export const discountActionSuccessSchema = z.object({
  success: z.literal(true),
  data: z.record(z.unknown()),
  message: z.string().optional(),
});

export const discountActionErrorSchema = z.object({
  success: z.literal(false),
  error: z.string(),
  code: z.enum([
    'DISCOUNT_CODE_NOT_FOUND',
    'DISCOUNT_CODE_EXPIRED',
    'DISCOUNT_CODE_INACTIVE',
    'USAGE_LIMIT_EXCEEDED',
    'MINIMUM_ORDER_NOT_MET',
    'DUPLICATE_CODE',
    'INVALID_DISCOUNT_TYPE',
    'PERMISSION_DENIED',
  ]).optional(),
  details: z.record(z.unknown()).optional(),
});

export const discountActionResponseSchema = z.union([
  discountActionSuccessSchema,
  discountActionErrorSchema,
]);

// =============================================================================
// TYPE EXPORTS
// =============================================================================

export type CreateDiscountCodeAction = z.infer<typeof createDiscountCodeActionSchema>;
export type UpdateDiscountCodeAction = z.infer<typeof updateDiscountCodeActionSchema>;
export type DeleteDiscountCodeAction = z.infer<typeof deleteDiscountCodeActionSchema>;
export type ValidateDiscountCodeAction = z.infer<typeof validateDiscountCodeActionSchema>;
export type ApplyDiscountCodeAction = z.infer<typeof applyDiscountCodeActionSchema>;
export type GetDiscountCodeByIdAction = z.infer<typeof getDiscountCodeByIdActionSchema>;
export type ListDiscountCodesAction = z.infer<typeof listDiscountCodesActionSchema>;
export type BulkCreateDiscountCodesAction = z.infer<typeof bulkCreateDiscountCodesActionSchema>;
export type BulkUpdateDiscountCodesAction = z.infer<typeof bulkUpdateDiscountCodesActionSchema>;
export type DiscountActionSuccess = z.infer<typeof discountActionSuccessSchema>;
export type DiscountActionError = z.infer<typeof discountActionErrorSchema>;
export type DiscountActionResponse = z.infer<typeof discountActionResponseSchema>;