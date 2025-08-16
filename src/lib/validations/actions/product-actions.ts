import { z } from 'zod';
import {
  createProductSchema,
  updateProductSchema,
  productFilterSchema,
  productSortSchema,
  updateStockSchema,
  updatePriceSchema,
  bulkPriceUpdateSchema,
  productImageUploadSchema,
  productImageUpdateSchema,
  updateSeoSchema,
  bulkProductUpdateSchema,
  productImportSchema,
} from '../base/product';
import {
  cuidSchema,
  limitSchema,
  pageSchema,
  sortDirectionSchema,
} from '../base/common';

/**
 * Product Actions Validation Schemas
 * 
 * Server Action validation schemas for product management operations.
 * These schemas support e-commerce catalog management and inventory control.
 */

// =============================================================================
// PRODUCT MANAGEMENT ACTIONS
// =============================================================================

/**
 * Create product action schema
 */
export const createProductActionSchema = createProductSchema.extend({
  publishImmediately: z.boolean().default(false),
  syncWithStripe: z.boolean().default(true),
  generateSku: z.boolean().default(false), // Auto-generate SKU if not provided
});

/**
 * Update product action schema
 */
export const updateProductActionSchema = updateProductSchema.extend({
  syncWithStripe: z.boolean().default(true),
});

/**
 * Delete product action schema
 */
export const deleteProductActionSchema = z.object({
  productId: cuidSchema,
  softDelete: z.boolean().default(true), // Soft delete vs hard delete
  reason: z.string().max(255, 'Reason must not exceed 255 characters').optional(),
  transferOrders: z.boolean().default(false), // What to do with existing orders
});

/**
 * Get product by ID action schema
 */
export const getProductByIdActionSchema = z.object({
  productId: cuidSchema,
  includeStats: z.boolean().default(false),
  includeReviews: z.boolean().default(false),
  includeInventory: z.boolean().default(true),
  includeRelated: z.boolean().default(false),
});

/**
 * Get product by slug action schema
 */
export const getProductBySlugActionSchema = z.object({
  slug: z.string().min(1, 'Slug is required'),
  includeStats: z.boolean().default(false),
  includeReviews: z.boolean().default(false),
  includeRelated: z.boolean().default(true),
});

/**
 * List products action schema
 */
export const listProductsActionSchema = z.object({
  filters: productFilterSchema.optional(),
  sort: z.object({
    field: productSortSchema,
    direction: sortDirectionSchema,
  }).optional(),
  pagination: z.object({
    page: pageSchema,
    limit: limitSchema,
  }).optional(),
  includeInactive: z.boolean().default(false),
  includeOutOfStock: z.boolean().default(true),
});

/**
 * Search products action schema
 */
export const searchProductsActionSchema = z.object({
  query: z.string().max(255, 'Search query must not exceed 255 characters'),
  filters: productFilterSchema.optional(),
  sort: z.object({
    field: productSortSchema,
    direction: sortDirectionSchema,
  }).optional(),
  pagination: z.object({
    page: pageSchema,
    limit: limitSchema,
  }).optional(),
  fuzzySearch: z.boolean().default(true),
  searchFields: z.array(z.enum(['name', 'description', 'tags', 'sku'])).default(['name', 'description', 'tags']),
});

// =============================================================================
// INVENTORY MANAGEMENT ACTIONS
// =============================================================================

/**
 * Update stock action schema
 */
export const updateStockActionSchema = updateStockSchema;

/**
 * Check stock availability action schema
 */
export const checkStockAvailabilityActionSchema = z.object({
  productId: cuidSchema,
  quantity: z.number().int().min(1, 'Quantity must be at least 1'),
  reserveStock: z.boolean().default(false),
  reservationDuration: z.number().int().min(60).max(3600).default(900), // 15 minutes default
});

/**
 * Reserve stock action schema
 */
export const reserveStockActionSchema = z.object({
  productId: cuidSchema,
  quantity: z.number().int().min(1, 'Quantity must be at least 1'),
  reservationDuration: z.number().int().min(60).max(3600).default(900), // 15 minutes default
  orderId: cuidSchema.optional(),
  userId: cuidSchema.optional(),
});

/**
 * Release stock reservation action schema
 */
export const releaseStockReservationActionSchema = z.object({
  reservationId: cuidSchema,
  reason: z.enum(['cancelled', 'expired', 'completed', 'manual']).default('manual'),
});

/**
 * Get low stock alerts action schema
 */
export const getLowStockAlertsActionSchema = z.object({
  threshold: z.number().int().min(0).optional(),
  limit: limitSchema.default(50),
  includeOutOfStock: z.boolean().default(true),
});

/**
 * Bulk stock update action schema
 */
export const bulkStockUpdateActionSchema = z.object({
  updates: z.array(updateStockSchema).min(1, 'At least one update is required').max(100, 'Cannot update more than 100 products at once'),
  reason: z.string().max(255, 'Reason must not exceed 255 characters').optional(),
});

// =============================================================================
// PRICING ACTIONS
// =============================================================================

/**
 * Update product price action schema
 */
export const updateProductPriceActionSchema = updatePriceSchema.extend({
  syncWithStripe: z.boolean().default(true),
  notifySubscribers: z.boolean().default(false), // For subscription products
});

/**
 * Bulk price update action schema
 */
export const bulkPriceUpdateActionSchema = bulkPriceUpdateSchema;

/**
 * Get price history action schema
 */
export const getPriceHistoryActionSchema = z.object({
  productId: cuidSchema,
  limit: limitSchema.default(20),
  startDate: z.date().optional(),
  endDate: z.date().optional(),
});

/**
 * Create price rule action schema
 */
export const createPriceRuleActionSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
  productIds: z.array(cuidSchema).min(1, 'At least one product is required'),
  rule: z.object({
    type: z.enum(['percentage_discount', 'fixed_discount', 'bulk_pricing', 'tiered_pricing']),
    value: z.number().positive('Value must be positive'),
    conditions: z.record(z.unknown()).optional(),
  }),
  startsAt: z.date().optional(),
  endsAt: z.date().optional(),
  isActive: z.boolean().default(true),
});

// =============================================================================
// MEDIA MANAGEMENT ACTIONS
// =============================================================================

/**
 * Upload product image action schema
 */
export const uploadProductImageActionSchema = productImageUploadSchema.extend({
  imageData: z.string().min(1, 'Image data is required'),
  fileName: z.string().min(1, 'File name is required'),
  mimeType: z.enum(['image/jpeg', 'image/png', 'image/webp']),
  maxSize: z.number().int().min(1).max(10 * 1024 * 1024).default(5 * 1024 * 1024), // 5MB default
});

/**
 * Update product images action schema
 */
export const updateProductImagesActionSchema = productImageUpdateSchema;

/**
 * Delete product image action schema
 */
export const deleteProductImageActionSchema = z.object({
  productId: cuidSchema,
  imageUrl: z.string().url('Invalid image URL'),
});

/**
 * Reorder product images action schema
 */
export const reorderProductImagesActionSchema = z.object({
  productId: cuidSchema,
  imageOrder: z.array(z.object({
    url: z.string().url('Invalid image URL'),
    sortOrder: z.number().int().min(0),
  })).min(1, 'At least one image is required'),
});

// =============================================================================
// SEO MANAGEMENT ACTIONS
// =============================================================================

/**
 * Update product SEO action schema
 */
export const updateProductSeoActionSchema = updateSeoSchema;

/**
 * Generate SEO content action schema
 */
export const generateSeoContentActionSchema = z.object({
  productId: cuidSchema,
  generateMetaTitle: z.boolean().default(true),
  generateMetaDescription: z.boolean().default(true),
  generateTags: z.boolean().default(true),
  overwriteExisting: z.boolean().default(false),
});

/**
 * Check SEO score action schema
 */
export const checkSeoScoreActionSchema = z.object({
  productId: cuidSchema,
  targetKeyword: z.string().max(100, 'Target keyword must not exceed 100 characters').optional(),
});

// =============================================================================
// CATEGORY MANAGEMENT ACTIONS
// =============================================================================

/**
 * Create category action schema
 */
export const createCategoryActionSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
  slug: z.string().min(1, 'Slug is required').max(100),
  description: z.string().max(500).optional(),
  parentId: cuidSchema.optional(),
  image: z.string().url('Invalid image URL').optional(),
  sortOrder: z.number().int().min(0).default(0),
  isActive: z.boolean().default(true),
  seoTitle: z.string().max(70).optional(),
  seoDescription: z.string().max(160).optional(),
});

/**
 * Update category action schema
 */
export const updateCategoryActionSchema = z.object({
  categoryId: cuidSchema,
  name: z.string().min(1, 'Name is required').max(100).optional(),
  slug: z.string().min(1, 'Slug is required').max(100).optional(),
  description: z.string().max(500).optional(),
  parentId: cuidSchema.optional(),
  image: z.string().url('Invalid image URL').optional(),
  sortOrder: z.number().int().min(0).optional(),
  isActive: z.boolean().optional(),
  seoTitle: z.string().max(70).optional(),
  seoDescription: z.string().max(160).optional(),
}).partial().required({ categoryId: true });

/**
 * Assign product to category action schema
 */
export const assignProductToCategoryActionSchema = z.object({
  productId: cuidSchema,
  categoryIds: z.array(cuidSchema).min(1, 'At least one category is required'),
  replaceExisting: z.boolean().default(false),
});

// =============================================================================
// BULK OPERATIONS ACTIONS
// =============================================================================

/**
 * Bulk update products action schema
 */
export const bulkUpdateProductsActionSchema = bulkProductUpdateSchema;

/**
 * Import products action schema
 */
export const importProductsActionSchema = productImportSchema.extend({
  validateOnly: z.boolean().default(false),
  batchSize: z.number().int().min(1).max(100).default(50),
});

/**
 * Export products action schema
 */
export const exportProductsActionSchema = z.object({
  filters: productFilterSchema.optional(),
  format: z.enum(['csv', 'json', 'xlsx']).default('csv'),
  includeInventory: z.boolean().default(true),
  includeImages: z.boolean().default(false),
  includeStats: z.boolean().default(false),
  maxRecords: z.number().int().min(1).max(10000).default(1000),
});

/**
 * Duplicate product action schema
 */
export const duplicateProductActionSchema = z.object({
  productId: cuidSchema,
  newName: z.string().min(1, 'New name is required').max(255),
  newSku: z.string().max(50).optional(),
  copyImages: z.boolean().default(true),
  copyInventory: z.boolean().default(false),
  copyPricing: z.boolean().default(true),
});

// =============================================================================
// ANALYTICS ACTIONS
// =============================================================================

/**
 * Get product analytics action schema
 */
export const getProductAnalyticsActionSchema = z.object({
  productId: cuidSchema.optional(), // If not provided, gets global analytics
  period: z.enum(['last_7_days', 'last_30_days', 'last_90_days', 'last_year', 'custom']),
  startDate: z.date().optional(),
  endDate: z.date().optional(),
  metrics: z.array(z.enum([
    'views',
    'orders',
    'revenue',
    'conversion_rate',
    'inventory_turnover',
    'profit_margin',
  ])).default(['views', 'orders', 'revenue']),
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
 * Get top products action schema
 */
export const getTopProductsActionSchema = z.object({
  metric: z.enum(['revenue', 'orders', 'views', 'profit']).default('revenue'),
  period: z.enum(['last_7_days', 'last_30_days', 'last_90_days', 'last_year']).default('last_30_days'),
  limit: limitSchema.default(10),
  categoryId: cuidSchema.optional(),
});

/**
 * Get product performance report action schema
 */
export const getProductPerformanceReportActionSchema = z.object({
  productIds: z.array(cuidSchema).max(50, 'Cannot analyze more than 50 products at once').optional(),
  period: z.enum(['last_30_days', 'last_90_days', 'last_year', 'custom']),
  startDate: z.date().optional(),
  endDate: z.date().optional(),
  includeComparisons: z.boolean().default(true),
  format: z.enum(['json', 'csv']).default('json'),
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
// RESPONSE SCHEMAS
// =============================================================================

/**
 * Product action success response schema
 */
export const productActionSuccessSchema = z.object({
  success: z.literal(true),
  data: z.record(z.unknown()),
  message: z.string().optional(),
});

/**
 * Product action error response schema
 */
export const productActionErrorSchema = z.object({
  success: z.literal(false),
  error: z.string(),
  code: z.enum([
    'PRODUCT_NOT_FOUND',
    'DUPLICATE_SKU',
    'DUPLICATE_SLUG',
    'INVALID_CATEGORY',
    'INSUFFICIENT_STOCK',
    'PRICE_VALIDATION_ERROR',
    'IMAGE_UPLOAD_ERROR',
    'SEO_VALIDATION_ERROR',
    'STRIPE_SYNC_ERROR',
    'BULK_OPERATION_ERROR',
    'INVENTORY_ERROR',
    'PERMISSION_DENIED',
  ]).optional(),
  details: z.record(z.unknown()).optional(),
});

/**
 * Product action response schema
 */
export const productActionResponseSchema = z.union([
  productActionSuccessSchema,
  productActionErrorSchema,
]);

// =============================================================================
// TYPE EXPORTS
// =============================================================================

export type CreateProductAction = z.infer<typeof createProductActionSchema>;
export type UpdateProductAction = z.infer<typeof updateProductActionSchema>;
export type DeleteProductAction = z.infer<typeof deleteProductActionSchema>;
export type GetProductByIdAction = z.infer<typeof getProductByIdActionSchema>;
export type GetProductBySlugAction = z.infer<typeof getProductBySlugActionSchema>;
export type ListProductsAction = z.infer<typeof listProductsActionSchema>;
export type SearchProductsAction = z.infer<typeof searchProductsActionSchema>;
export type UpdateStockAction = z.infer<typeof updateStockActionSchema>;
export type CheckStockAvailabilityAction = z.infer<typeof checkStockAvailabilityActionSchema>;
export type ReserveStockAction = z.infer<typeof reserveStockActionSchema>;
export type ReleaseStockReservationAction = z.infer<typeof releaseStockReservationActionSchema>;
export type GetLowStockAlertsAction = z.infer<typeof getLowStockAlertsActionSchema>;
export type BulkStockUpdateAction = z.infer<typeof bulkStockUpdateActionSchema>;
export type UpdateProductPriceAction = z.infer<typeof updateProductPriceActionSchema>;
export type BulkPriceUpdateAction = z.infer<typeof bulkPriceUpdateActionSchema>;
export type GetPriceHistoryAction = z.infer<typeof getPriceHistoryActionSchema>;
export type CreatePriceRuleAction = z.infer<typeof createPriceRuleActionSchema>;
export type UploadProductImageAction = z.infer<typeof uploadProductImageActionSchema>;
export type UpdateProductImagesAction = z.infer<typeof updateProductImagesActionSchema>;
export type DeleteProductImageAction = z.infer<typeof deleteProductImageActionSchema>;
export type ReorderProductImagesAction = z.infer<typeof reorderProductImagesActionSchema>;
export type UpdateProductSeoAction = z.infer<typeof updateProductSeoActionSchema>;
export type GenerateSeoContentAction = z.infer<typeof generateSeoContentActionSchema>;
export type CheckSeoScoreAction = z.infer<typeof checkSeoScoreActionSchema>;
export type CreateCategoryAction = z.infer<typeof createCategoryActionSchema>;
export type UpdateCategoryAction = z.infer<typeof updateCategoryActionSchema>;
export type AssignProductToCategoryAction = z.infer<typeof assignProductToCategoryActionSchema>;
export type BulkUpdateProductsAction = z.infer<typeof bulkUpdateProductsActionSchema>;
export type ImportProductsAction = z.infer<typeof importProductsActionSchema>;
export type ExportProductsAction = z.infer<typeof exportProductsActionSchema>;
export type DuplicateProductAction = z.infer<typeof duplicateProductActionSchema>;
export type GetProductAnalyticsAction = z.infer<typeof getProductAnalyticsActionSchema>;
export type GetTopProductsAction = z.infer<typeof getTopProductsActionSchema>;
export type GetProductPerformanceReportAction = z.infer<typeof getProductPerformanceReportActionSchema>;
export type ProductActionSuccess = z.infer<typeof productActionSuccessSchema>;
export type ProductActionError = z.infer<typeof productActionErrorSchema>;
export type ProductActionResponse = z.infer<typeof productActionResponseSchema>;