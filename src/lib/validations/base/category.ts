import { z } from 'zod';
import {
  cuidSchema,
  nameSchema,
  longDescriptionSchema,
  slugSchema,
  dateSchema,
} from './common';

/**
 * Category Validation Schemas
 * 
 * Comprehensive validation schemas for category management,
 * including CRUD operations and product relationships.
 */

// =============================================================================
// CORE CATEGORY SCHEMAS
// =============================================================================

/**
 * Base category schema - matches Prisma Category model
 */
export const categorySchema = z.object({
  id: cuidSchema,
  name: nameSchema,
  description: longDescriptionSchema.optional(),
  slug: slugSchema,
  createdAt: dateSchema,
  updatedAt: dateSchema,
});

/**
 * Category creation schema
 */
export const createCategorySchema = z.object({
  name: nameSchema,
  description: longDescriptionSchema.optional(),
  slug: slugSchema.optional(), // Auto-generated if not provided
}).superRefine((data, ctx) => {
  // Auto-generate slug if not provided
  if (!data.slug && data.name) {
    data.slug = data.name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');
  }
  
  // Validate slug format if provided
  if (data.slug && !/^[a-z0-9-]+$/.test(data.slug)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Slug must contain only lowercase letters, numbers, and hyphens',
      path: ['slug'],
    });
  }
});

/**
 * Category update schema
 */
export const updateCategorySchema = z.object({
  id: cuidSchema,
  name: nameSchema.optional(),
  description: longDescriptionSchema.optional(),
  slug: slugSchema.optional(),
}).partial().required({ id: true }).superRefine((data, ctx) => {
  // Auto-generate slug if name is provided but slug is not
  if (data.name && !data.slug) {
    data.slug = data.name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');
  }
  
  // Validate slug format if provided
  if (data.slug && !/^[a-z0-9-]+$/.test(data.slug)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Slug must contain only lowercase letters, numbers, and hyphens',
      path: ['slug'],
    });
  }
});

/**
 * Category filter schema
 */
export const categoryFilterSchema = z.object({
  name: z.string().optional(),
  slug: z.string().optional(),
  createdAfter: z.date().optional(),
  createdBefore: z.date().optional(),
});

/**
 * Category sort options
 */
export const categorySortSchema = z.enum([
  'name',
  'createdAt',
  'updatedAt',
]);

// =============================================================================
// PRODUCT-CATEGORY RELATIONSHIP SCHEMAS
// =============================================================================

/**
 * Product category assignment schema
 */
export const assignProductCategorySchema = z.object({
  productId: cuidSchema,
  categoryId: cuidSchema,
});

/**
 * Bulk category assignment schema
 */
export const bulkAssignCategoriesSchema = z.object({
  productIds: z.array(cuidSchema).min(1, 'At least one product is required'),
  categoryIds: z.array(cuidSchema).min(1, 'At least one category is required'),
  operation: z.enum(['add', 'remove', 'replace']).default('add'),
});

/**
 * Product categories update schema
 */
export const updateProductCategoriesSchema = z.object({
  productId: cuidSchema,
  categoryIds: z.array(cuidSchema),
});

// =============================================================================
// BULK OPERATIONS SCHEMAS
// =============================================================================

/**
 * Bulk category creation schema
 */
export const bulkCreateCategoriesSchema = z.object({
  categories: z.array(createCategorySchema).min(1, 'At least one category is required'),
  skipDuplicates: z.boolean().default(true),
});

/**
 * Bulk category update schema
 */
export const bulkUpdateCategoriesSchema = z.object({
  categoryIds: z.array(cuidSchema).min(1, 'At least one category is required'),
  updates: updateCategorySchema.omit({ id: true }).partial(),
});

/**
 * Bulk category deletion schema
 */
export const bulkDeleteCategoriesSchema = z.object({
  categoryIds: z.array(cuidSchema).min(1, 'At least one category is required'),
  force: z.boolean().default(false), // Force delete even if products are assigned
});

// =============================================================================
// PUBLIC SCHEMAS (FOR API RESPONSES)
// =============================================================================

/**
 * Public category schema (for customer-facing APIs)
 */
export const publicCategorySchema = categorySchema.extend({
  productCount: z.number().min(0).optional(),
});

/**
 * Category with products schema
 */
export const categoryWithProductsSchema = categorySchema.extend({
  productCount: z.number().min(0),
  products: z.array(z.object({
    id: cuidSchema,
    name: nameSchema,
    slug: slugSchema,
    price: z.number().positive(),
    thumbnail: z.string().url().optional(),
    isActive: z.boolean(),
  })).optional(),
});

// =============================================================================
// VALIDATION HELPERS
// =============================================================================

/**
 * Validate category slug uniqueness
 */
export const validateCategorySlug = z.object({
  slug: slugSchema,
  excludeId: cuidSchema.optional(),
});

/**
 * Category existence validation
 */
export const validateCategoryExists = z.object({
  categoryId: cuidSchema,
});

// =============================================================================
// TYPE EXPORTS
// =============================================================================

export type Category = z.infer<typeof categorySchema>;
export type CreateCategory = z.infer<typeof createCategorySchema>;
export type UpdateCategory = z.infer<typeof updateCategorySchema>;
export type CategoryFilter = z.infer<typeof categoryFilterSchema>;
export type CategorySort = z.infer<typeof categorySortSchema>;
export type AssignProductCategory = z.infer<typeof assignProductCategorySchema>;
export type BulkAssignCategories = z.infer<typeof bulkAssignCategoriesSchema>;
export type UpdateProductCategories = z.infer<typeof updateProductCategoriesSchema>;
export type PublicCategory = z.infer<typeof publicCategorySchema>;
export type CategoryWithProducts = z.infer<typeof categoryWithProductsSchema>;