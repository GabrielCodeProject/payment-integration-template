import { z } from 'zod';
import {
  cuidSchema,
  nameSchema,
  slugSchema,
  dateSchema,
} from './common';

/**
 * Tag Validation Schemas
 * 
 * Comprehensive validation schemas for tag management,
 * including CRUD operations and product relationships.
 */

// =============================================================================
// CORE TAG SCHEMAS
// =============================================================================

/**
 * Tag color validation
 */
export const tagColorSchema = z.string()
  .regex(/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/, 'Color must be a valid hex color (e.g., #FF0000)')
  .optional();

/**
 * Base tag schema - matches Prisma Tag model
 */
export const tagSchema = z.object({
  id: cuidSchema,
  name: nameSchema,
  slug: slugSchema,
  color: tagColorSchema,
  createdAt: dateSchema,
  updatedAt: dateSchema,
});

/**
 * Tag creation schema
 */
export const createTagSchema = z.object({
  name: nameSchema,
  slug: slugSchema.optional(), // Auto-generated if not provided
  color: tagColorSchema,
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
 * Tag update schema
 */
export const updateTagSchema = z.object({
  id: cuidSchema,
  name: nameSchema.optional(),
  slug: slugSchema.optional(),
  color: tagColorSchema.optional(),
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
 * Tag filter schema
 */
export const tagFilterSchema = z.object({
  name: z.string().optional(),
  slug: z.string().optional(),
  color: tagColorSchema.optional(),
  createdAfter: z.date().optional(),
  createdBefore: z.date().optional(),
});

/**
 * Tag sort options
 */
export const tagSortSchema = z.enum([
  'name',
  'createdAt',
  'updatedAt',
]);

// =============================================================================
// PRODUCT-TAG RELATIONSHIP SCHEMAS
// =============================================================================

/**
 * Product tag assignment schema
 */
export const assignProductTagSchema = z.object({
  productId: cuidSchema,
  tagId: cuidSchema,
});

/**
 * Bulk tag assignment schema
 */
export const bulkAssignTagsSchema = z.object({
  productIds: z.array(cuidSchema).min(1, 'At least one product is required'),
  tagIds: z.array(cuidSchema).min(1, 'At least one tag is required'),
  operation: z.enum(['add', 'remove', 'replace']).default('add'),
});

/**
 * Product tags update schema
 */
export const updateProductTagsSchema = z.object({
  productId: cuidSchema,
  tagIds: z.array(cuidSchema),
});

// =============================================================================
// BULK OPERATIONS SCHEMAS
// =============================================================================

/**
 * Bulk tag creation schema
 */
export const bulkCreateTagsSchema = z.object({
  tags: z.array(createTagSchema).min(1, 'At least one tag is required'),
  skipDuplicates: z.boolean().default(true),
});

/**
 * Bulk tag update schema
 */
export const bulkUpdateTagsSchema = z.object({
  tagIds: z.array(cuidSchema).min(1, 'At least one tag is required'),
  updates: updateTagSchema.omit({ id: true }).partial(),
});

/**
 * Bulk tag deletion schema
 */
export const bulkDeleteTagsSchema = z.object({
  tagIds: z.array(cuidSchema).min(1, 'At least one tag is required'),
  force: z.boolean().default(false), // Force delete even if products are assigned
});

// =============================================================================
// COLOR MANAGEMENT SCHEMAS
// =============================================================================

/**
 * Predefined tag colors
 */
export const predefinedTagColors = [
  '#EF4444', // Red
  '#F97316', // Orange
  '#F59E0B', // Amber
  '#EAB308', // Yellow
  '#84CC16', // Lime
  '#22C55E', // Green
  '#10B981', // Emerald
  '#06B6D4', // Cyan
  '#0EA5E9', // Sky
  '#3B82F6', // Blue
  '#6366F1', // Indigo
  '#8B5CF6', // Violet
  '#A855F7', // Purple
  '#D946EF', // Fuchsia
  '#EC4899', // Pink
  '#F43F5E', // Rose
];

/**
 * Tag color palette schema
 */
export const tagColorPaletteSchema = z.object({
  colors: z.array(tagColorSchema).default(predefinedTagColors),
  customColors: z.array(tagColorSchema).optional(),
});

// =============================================================================
// PUBLIC SCHEMAS (FOR API RESPONSES)
// =============================================================================

/**
 * Public tag schema (for customer-facing APIs)
 */
export const publicTagSchema = tagSchema.extend({
  productCount: z.number().min(0).optional(),
});

/**
 * Tag with products schema
 */
export const tagWithProductsSchema = tagSchema.extend({
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

/**
 * Tag cloud schema (for tag cloud display)
 */
export const tagCloudSchema = z.object({
  id: cuidSchema,
  name: nameSchema,
  slug: slugSchema,
  color: tagColorSchema,
  productCount: z.number().min(0),
  weight: z.number().min(1).max(5), // Weight for tag cloud sizing
});

// =============================================================================
// VALIDATION HELPERS
// =============================================================================

/**
 * Validate tag slug uniqueness
 */
export const validateTagSlug = z.object({
  slug: slugSchema,
  excludeId: cuidSchema.optional(),
});

/**
 * Tag existence validation
 */
export const validateTagExists = z.object({
  tagId: cuidSchema,
});

/**
 * Tag name uniqueness validation
 */
export const validateTagName = z.object({
  name: nameSchema,
  excludeId: cuidSchema.optional(),
});

// =============================================================================
// TYPE EXPORTS
// =============================================================================

export type Tag = z.infer<typeof tagSchema>;
export type CreateTag = z.infer<typeof createTagSchema>;
export type UpdateTag = z.infer<typeof updateTagSchema>;
export type TagFilter = z.infer<typeof tagFilterSchema>;
export type TagSort = z.infer<typeof tagSortSchema>;
export type AssignProductTag = z.infer<typeof assignProductTagSchema>;
export type BulkAssignTags = z.infer<typeof bulkAssignTagsSchema>;
export type UpdateProductTags = z.infer<typeof updateProductTagsSchema>;
export type PublicTag = z.infer<typeof publicTagSchema>;
export type TagWithProducts = z.infer<typeof tagWithProductsSchema>;
export type TagCloud = z.infer<typeof tagCloudSchema>;
export type TagColorPalette = z.infer<typeof tagColorPaletteSchema>;