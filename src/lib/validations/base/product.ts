import { z } from 'zod';
import {
  cuidSchema,
  nameSchema,
  shortDescriptionSchema,
  longDescriptionSchema,
  priceSchema,
  currencySchema,
  skuSchema,
  slugSchema,
  imagesSchema,
  urlSchema,
  stripeProductIdSchema,
  stripePriceIdSchema,
  positiveIntSchema,
  nonNegativeIntSchema,
  dateSchema,
  optionalDateSchema,
} from './common';

/**
 * Product Validation Schemas
 * 
 * Comprehensive validation schemas for product management,
 * including catalog operations, inventory, and Stripe integration.
 */

// =============================================================================
// ENUMS
// =============================================================================

/**
 * Product type validation
 */
export const productTypeSchema = z.enum(['ONE_TIME', 'SUBSCRIPTION', 'USAGE_BASED']);

/**
 * Billing interval validation
 */
export const billingIntervalSchema = z.enum(['DAY', 'WEEK', 'MONTH', 'YEAR']);

/**
 * Product status validation
 */
export const productStatusSchema = z.enum(['DRAFT', 'PUBLISHED', 'ARCHIVED', 'SCHEDULED']);

/**
 * User role validation (for visibility controls)
 */
export const userRoleSchema = z.enum(['CUSTOMER', 'ADMIN', 'SUPPORT']);

// =============================================================================
// CORE PRODUCT SCHEMAS
// =============================================================================

/**
 * Base product schema - matches Prisma Product model
 */
export const productSchema = z.object({
  id: cuidSchema,
  name: nameSchema,
  description: longDescriptionSchema,
  shortDescription: shortDescriptionSchema,
  
  // Pricing
  price: priceSchema,
  currency: currencySchema,
  compareAtPrice: z.number().positive('Compare at price must be positive').optional(),
  
  // Product management
  sku: skuSchema,
  isActive: z.boolean().default(true),
  isDigital: z.boolean().default(false),
  requiresShipping: z.boolean().default(true),
  
  // Inventory
  stockQuantity: positiveIntSchema.optional(),
  lowStockThreshold: positiveIntSchema.optional(),
  
  // SEO & Display
  slug: slugSchema,
  metaTitle: z.string().max(70, 'Meta title must not exceed 70 characters').optional(),
  metaDescription: z.string().max(160, 'Meta description must not exceed 160 characters').optional(),
  categoryIds: z.array(cuidSchema).optional(),
  tagIds: z.array(cuidSchema).optional(),
  
  // Media
  images: imagesSchema,
  thumbnail: urlSchema.optional(),
  
  // Stripe Integration
  stripePriceId: stripePriceIdSchema,
  stripeProductId: stripeProductIdSchema,
  
  // Product type for subscriptions
  type: productTypeSchema.default('ONE_TIME'),
  billingInterval: billingIntervalSchema.optional(),
  
  // Visibility and Availability Controls
  status: productStatusSchema.default('DRAFT'),
  isPublished: z.boolean().default(false),
  publishedAt: optionalDateSchema,
  availableFrom: optionalDateSchema,
  availableTo: optionalDateSchema,
  restrictedRegions: z.array(z.string()).default([]),
  allowedUserRoles: z.array(userRoleSchema).default([]),
  maxUsers: positiveIntSchema.optional(),
  currentUsers: nonNegativeIntSchema.default(0),
  isLimited: z.boolean().default(false),
  
  // Timestamps
  createdAt: dateSchema,
  updatedAt: dateSchema,
});

/**
 * Product creation schema
 */
export const createProductSchema = z.object({
  name: nameSchema,
  description: longDescriptionSchema.optional(),
  shortDescription: shortDescriptionSchema.optional(),
  price: priceSchema,
  currency: currencySchema.optional(),
  compareAtPrice: z.number().positive('Compare at price must be positive').optional(),
  sku: skuSchema,
  isDigital: z.boolean().default(false),
  requiresShipping: z.boolean().optional(),
  stockQuantity: positiveIntSchema.optional(),
  lowStockThreshold: positiveIntSchema.optional(),
  slug: slugSchema,
  metaTitle: z.string().max(70, 'Meta title must not exceed 70 characters').optional(),
  metaDescription: z.string().max(160, 'Meta description must not exceed 160 characters').optional(),
  categoryIds: z.array(cuidSchema).optional(),
  tagIds: z.array(cuidSchema).optional(),
  images: imagesSchema.optional(),
  thumbnail: urlSchema.optional(),
  type: productTypeSchema.default('ONE_TIME'),
  billingInterval: billingIntervalSchema.optional(),
  
  // Visibility and Availability Controls (optional for creation)
  status: productStatusSchema.default('DRAFT'),
  isPublished: z.boolean().default(false),
  publishedAt: optionalDateSchema,
  availableFrom: optionalDateSchema,
  availableTo: optionalDateSchema,
  restrictedRegions: z.array(z.string()).default([]),
  allowedUserRoles: z.array(userRoleSchema).default([]),
  maxUsers: positiveIntSchema.optional(),
  currentUsers: nonNegativeIntSchema.default(0),
  isLimited: z.boolean().default(false),
}).superRefine((data, ctx) => {
  // Validate subscription-specific fields
  if (data.type === 'SUBSCRIPTION' && !data.billingInterval) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Billing interval is required for subscription products',
      path: ['billingInterval'],
    });
  }
  
  // Validate compareAtPrice is higher than price
  if (data.compareAtPrice && data.compareAtPrice <= data.price) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Compare at price must be higher than regular price',
      path: ['compareAtPrice'],
    });
  }
  
  // Validate digital products don't require shipping
  if (data.isDigital && data.requiresShipping) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Digital products cannot require shipping',
      path: ['requiresShipping'],
    });
  }
  
  // Validate stock for digital products
  if (data.isDigital && data.stockQuantity !== undefined) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Digital products should not have stock quantity',
      path: ['stockQuantity'],
    });
  }
  
  // Validate availability date range
  if (data.availableFrom && data.availableTo && data.availableFrom >= data.availableTo) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Available from date must be before available to date',
      path: ['availableTo'],
    });
  }
  
  // Validate scheduled status requires availability dates
  if (data.status === 'SCHEDULED' && !data.availableFrom) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Scheduled products must have an available from date',
      path: ['availableFrom'],
    });
  }
  
  // Validate published status and isPublished consistency
  if (data.status === 'PUBLISHED' && !data.isPublished) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Published status requires isPublished to be true',
      path: ['isPublished'],
    });
  }
  
  // Validate limited products have maxUsers
  if (data.isLimited && !data.maxUsers) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Limited products must have a maximum user count',
      path: ['maxUsers'],
    });
  }
  
  // Validate currentUsers doesn't exceed maxUsers
  if (data.maxUsers && data.currentUsers > data.maxUsers) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Current users cannot exceed maximum users',
      path: ['currentUsers'],
    });
  }
});

/**
 * Product update schema
 */
export const updateProductSchema = z.object({
  id: cuidSchema,
  name: nameSchema.optional(),
  description: longDescriptionSchema.optional(),
  shortDescription: shortDescriptionSchema.optional(),
  price: priceSchema.optional(),
  currency: currencySchema.optional(),
  compareAtPrice: z.number().positive('Compare at price must be positive').optional(),
  sku: skuSchema.optional(),
  isActive: z.boolean().optional(),
  isDigital: z.boolean().optional(),
  requiresShipping: z.boolean().optional(),
  stockQuantity: positiveIntSchema.optional(),
  lowStockThreshold: positiveIntSchema.optional(),
  slug: slugSchema.optional(),
  metaTitle: z.string().max(70, 'Meta title must not exceed 70 characters').optional(),
  metaDescription: z.string().max(160, 'Meta description must not exceed 160 characters').optional(),
  categoryIds: z.array(cuidSchema).optional(),
  tagIds: z.array(cuidSchema).optional(),
  images: imagesSchema.optional(),
  thumbnail: urlSchema.optional(),
  type: productTypeSchema.optional(),
  billingInterval: billingIntervalSchema.optional(),
  
  // Visibility and Availability Controls
  status: productStatusSchema.optional(),
  isPublished: z.boolean().optional(),
  publishedAt: optionalDateSchema,
  availableFrom: optionalDateSchema,
  availableTo: optionalDateSchema,
  restrictedRegions: z.array(z.string()).optional(),
  allowedUserRoles: z.array(userRoleSchema).optional(),
  maxUsers: positiveIntSchema.optional(),
  currentUsers: nonNegativeIntSchema.optional(),
  isLimited: z.boolean().optional(),
}).partial().required({ id: true }).superRefine((data, ctx) => {
  // Validate subscription-specific fields
  if (data.type === 'SUBSCRIPTION' && data.billingInterval === undefined) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Billing interval is required for subscription products',
      path: ['billingInterval'],
    });
  }
  
  // Validate compareAtPrice is higher than price
  if (data.compareAtPrice && data.price && data.compareAtPrice <= data.price) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Compare at price must be higher than regular price',
      path: ['compareAtPrice'],
    });
  }
  
  // Validate availability date range
  if (data.availableFrom && data.availableTo && data.availableFrom >= data.availableTo) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Available from date must be before available to date',
      path: ['availableTo'],
    });
  }
  
  // Validate scheduled status requires availability dates
  if (data.status === 'SCHEDULED' && !data.availableFrom) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Scheduled products must have an available from date',
      path: ['availableFrom'],
    });
  }
  
  // Validate published status and isPublished consistency
  if (data.status === 'PUBLISHED' && data.isPublished === false) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Published status requires isPublished to be true',
      path: ['isPublished'],
    });
  }
  
  // Validate limited products have maxUsers
  if (data.isLimited === true && !data.maxUsers) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Limited products must have a maximum user count',
      path: ['maxUsers'],
    });
  }
  
  // Validate currentUsers doesn't exceed maxUsers
  if (data.maxUsers && data.currentUsers && data.currentUsers > data.maxUsers) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Current users cannot exceed maximum users',
      path: ['currentUsers'],
    });
  }
});

/**
 * Product search/filter schema
 */
export const productFilterSchema = z.object({
  name: z.string().optional(),
  type: productTypeSchema.optional(),
  isActive: z.boolean().optional(),
  isDigital: z.boolean().optional(),
  inStock: z.boolean().optional(),
  priceMin: z.number().min(0).optional(),
  priceMax: z.number().min(0).optional(),
  categoryIds: z.array(cuidSchema).optional(),
  tagIds: z.array(cuidSchema).optional(),
  createdAfter: optionalDateSchema,
  createdBefore: optionalDateSchema,
  
  // Visibility and Availability Filters
  status: productStatusSchema.optional(),
  isPublished: z.boolean().optional(),
  publishedAfter: optionalDateSchema,
  publishedBefore: optionalDateSchema,
  availableAfter: optionalDateSchema,
  availableBefore: optionalDateSchema,
  restrictedRegions: z.array(z.string()).optional(),
  allowedUserRoles: z.array(userRoleSchema).optional(),
  isLimited: z.boolean().optional(),
  hasAvailableCapacity: z.boolean().optional(),
});

/**
 * Product sort options
 */
export const productSortSchema = z.enum([
  'name',
  'price',
  'createdAt',
  'updatedAt',
  'stockQuantity',
  'type',
]);

// =============================================================================
// INVENTORY SCHEMAS
// =============================================================================

/**
 * Stock update schema
 */
export const updateStockSchema = z.object({
  productId: cuidSchema,
  quantity: z.number().int('Quantity must be an integer'),
  operation: z.enum(['set', 'increment', 'decrement']),
  reason: z.string().max(255, 'Reason must not exceed 255 characters').optional(),
});

/**
 * Low stock alert schema
 */
export const lowStockAlertSchema = z.object({
  productId: cuidSchema,
  threshold: positiveIntSchema,
});

/**
 * Stock level validation
 */
export const stockLevelSchema = z.object({
  productId: cuidSchema,
  currentStock: nonNegativeIntSchema,
  reservedStock: nonNegativeIntSchema.default(0),
  availableStock: nonNegativeIntSchema,
  lowStockThreshold: positiveIntSchema.optional(),
  isLowStock: z.boolean(),
});

// =============================================================================
// PRICING SCHEMAS
// =============================================================================

/**
 * Price update schema
 */
export const updatePriceSchema = z.object({
  productId: cuidSchema,
  price: priceSchema,
  compareAtPrice: z.number().positive('Compare at price must be positive').optional(),
  effectiveDate: optionalDateSchema,
}).superRefine((data, ctx) => {
  if (data.compareAtPrice && data.compareAtPrice <= data.price) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Compare at price must be higher than regular price',
      path: ['compareAtPrice'],
    });
  }
});

/**
 * Bulk price update schema
 */
export const bulkPriceUpdateSchema = z.object({
  productIds: z.array(cuidSchema).min(1, 'At least one product is required'),
  priceAdjustment: z.object({
    type: z.enum(['percentage', 'fixed']),
    value: z.number(),
  }),
  effectiveDate: optionalDateSchema,
});

// =============================================================================
// MEDIA SCHEMAS
// =============================================================================

/**
 * Product image upload schema
 */
export const productImageUploadSchema = z.object({
  productId: cuidSchema,
  imageUrl: urlSchema,
  altText: z.string().max(255, 'Alt text must not exceed 255 characters').optional(),
  sortOrder: nonNegativeIntSchema.default(0),
});

/**
 * Product image update schema
 */
export const productImageUpdateSchema = z.object({
  productId: cuidSchema,
  images: z.array(z.object({
    url: urlSchema,
    altText: z.string().max(255, 'Alt text must not exceed 255 characters').optional(),
    sortOrder: nonNegativeIntSchema.default(0),
  })).max(10, 'Cannot have more than 10 images'),
});

// =============================================================================
// SEO SCHEMAS
// =============================================================================

/**
 * SEO update schema
 */
export const updateSeoSchema = z.object({
  productId: cuidSchema,
  slug: slugSchema.optional(),
  metaTitle: z.string().max(70, 'Meta title must not exceed 70 characters').optional(),
  metaDescription: z.string().max(160, 'Meta description must not exceed 160 characters').optional(),
  categoryIds: z.array(cuidSchema).optional(),
  tagIds: z.array(cuidSchema).optional(),
});

// =============================================================================
// BULK OPERATIONS SCHEMAS
// =============================================================================

/**
 * Bulk product update schema
 */
export const bulkProductUpdateSchema = z.object({
  productIds: z.array(cuidSchema).min(1, 'At least one product is required'),
  updates: z.object({
    isActive: z.boolean().optional(),
    categoryIds: z.array(cuidSchema).optional(),
    tagIds: z.array(cuidSchema).optional(),
    type: productTypeSchema.optional(),
  }).partial(),
});

/**
 * Product import schema
 */
export const productImportSchema = z.object({
  products: z.array(createProductSchema).min(1, 'At least one product is required'),
  skipDuplicates: z.boolean().default(true),
  updateExisting: z.boolean().default(false),
});

// =============================================================================
// VISIBILITY MANAGEMENT SCHEMAS
// =============================================================================

/**
 * Product visibility update schema
 */
export const updateProductVisibilitySchema = z.object({
  productId: cuidSchema,
  status: productStatusSchema,
  isPublished: z.boolean(),
  publishedAt: optionalDateSchema,
  availableFrom: optionalDateSchema,
  availableTo: optionalDateSchema,
}).superRefine((data, ctx) => {
  // Validate availability date range
  if (data.availableFrom && data.availableTo && data.availableFrom >= data.availableTo) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Available from date must be before available to date',
      path: ['availableTo'],
    });
  }
  
  // Validate scheduled status requires availability dates
  if (data.status === 'SCHEDULED' && !data.availableFrom) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Scheduled products must have an available from date',
      path: ['availableFrom'],
    });
  }
  
  // Validate published status and isPublished consistency
  if (data.status === 'PUBLISHED' && !data.isPublished) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Published status requires isPublished to be true',
      path: ['isPublished'],
    });
  }
});

/**
 * Product access control update schema
 */
export const updateProductAccessControlSchema = z.object({
  productId: cuidSchema,
  restrictedRegions: z.array(z.string()),
  allowedUserRoles: z.array(userRoleSchema),
  maxUsers: positiveIntSchema.optional(),
  isLimited: z.boolean(),
}).superRefine((data, ctx) => {
  // Validate limited products have maxUsers
  if (data.isLimited && !data.maxUsers) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Limited products must have a maximum user count',
      path: ['maxUsers'],
    });
  }
});

/**
 * Bulk product status update schema
 */
export const bulkProductStatusUpdateSchema = z.object({
  productIds: z.array(cuidSchema).min(1, 'At least one product is required'),
  status: productStatusSchema,
  isPublished: z.boolean().optional(),
  publishedAt: optionalDateSchema,
  availableFrom: optionalDateSchema,
  availableTo: optionalDateSchema,
});

/**
 * Product visibility validation schema
 */
export const productVisibilityValidationSchema = z.object({
  productId: cuidSchema,
  userRole: userRoleSchema,
  userRegion: z.string().optional(),
  currentDateTime: dateSchema,
});

// =============================================================================
// PUBLIC SCHEMAS (FOR API RESPONSES)
// =============================================================================

/**
 * Public product schema (for customer-facing APIs)
 */
export const publicProductSchema = productSchema.omit({
  stripePriceId: true,
  stripeProductId: true,
  stockQuantity: true,
  lowStockThreshold: true,
}).extend({
  inStock: z.boolean(),
  isOnSale: z.boolean(),
  discountPercentage: z.number().optional(),
});

/**
 * Product list item schema
 */
export const productListItemSchema = z.object({
  id: cuidSchema,
  name: nameSchema,
  shortDescription: shortDescriptionSchema,
  price: priceSchema,
  compareAtPrice: z.number().optional(),
  currency: currencySchema,
  thumbnail: urlSchema.optional(),
  slug: slugSchema,
  type: productTypeSchema,
  isActive: z.boolean(),
  inStock: z.boolean(),
  isOnSale: z.boolean(),
  createdAt: dateSchema,
});

/**
 * Product details schema
 */
export const productDetailsSchema = publicProductSchema.extend({
  relatedProducts: z.array(productListItemSchema).default([]),
  reviews: z.object({
    averageRating: z.number().min(0).max(5),
    totalReviews: z.number().min(0),
  }).optional(),
});

// =============================================================================
// TYPE EXPORTS
// =============================================================================

export type Product = z.infer<typeof productSchema>;
export type CreateProduct = z.infer<typeof createProductSchema>;
export type UpdateProduct = z.infer<typeof updateProductSchema>;
export type ProductType = z.infer<typeof productTypeSchema>;
export type ProductStatus = z.infer<typeof productStatusSchema>;
export type UserRole = z.infer<typeof userRoleSchema>;
export type BillingInterval = z.infer<typeof billingIntervalSchema>;
export type ProductFilter = z.infer<typeof productFilterSchema>;
export type ProductSort = z.infer<typeof productSortSchema>;
export type UpdateStock = z.infer<typeof updateStockSchema>;
export type StockLevel = z.infer<typeof stockLevelSchema>;
export type UpdatePrice = z.infer<typeof updatePriceSchema>;
export type PublicProduct = z.infer<typeof publicProductSchema>;
export type ProductListItem = z.infer<typeof productListItemSchema>;
export type ProductDetails = z.infer<typeof productDetailsSchema>;

// Visibility management types
export type UpdateProductVisibility = z.infer<typeof updateProductVisibilitySchema>;
export type UpdateProductAccessControl = z.infer<typeof updateProductAccessControlSchema>;
export type BulkProductStatusUpdate = z.infer<typeof bulkProductStatusUpdateSchema>;
export type ProductVisibilityValidation = z.infer<typeof productVisibilityValidationSchema>;