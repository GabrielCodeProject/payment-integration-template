import { z } from 'zod';

/**
 * Common Validation Schemas
 * 
 * Reusable validation schemas for common data types and patterns
 * used across the application.
 */

// =============================================================================
// PRIMITIVE VALIDATIONS
// =============================================================================

/**
 * CUID validation - used for all database IDs
 */
export const cuidSchema = z.string().cuid('Invalid ID format');

/**
 * Email validation with comprehensive rules
 */
export const emailSchema = z
  .string()
  .email('Invalid email format')
  .min(5, 'Email must be at least 5 characters')
  .max(254, 'Email must not exceed 254 characters')
  .toLowerCase()
  .trim();

/**
 * URL validation
 */
export const urlSchema = z.string().url('Invalid URL format');

/**
 * Phone number validation (international format)
 */
export const phoneSchema = z
  .string()
  .optional()
  .refine((val) => !val || val.trim() === '' || /^[+]?[1-9]\d{1,14}$/.test(val), {
    message: 'Invalid phone number format'
  });

/**
 * Currency code validation (ISO 4217)
 */
export const currencySchema = z
  .string()
  .length(3, 'Currency code must be 3 characters')
  .toUpperCase()
  .regex(/^[A-Z]{3}$/, 'Invalid currency code format')
  .default('USD');

/**
 * Timezone validation
 */
export const timezoneSchema = z.string().default('UTC');

/**
 * Slug validation for URLs
 */
export const slugSchema = z
  .string()
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Invalid slug format')
  .min(1, 'Slug cannot be empty')
  .max(100, 'Slug must not exceed 100 characters');

// =============================================================================
// FINANCIAL VALIDATIONS
// =============================================================================

/**
 * Price validation (supports up to 999,999.99)
 */
export const priceSchema = z
  .number()
  .positive('Price must be positive')
  .max(999999.99, 'Price cannot exceed $999,999.99')
  .transform((val) => Number(val.toFixed(2)));

/**
 * Decimal validation for database decimal fields
 */
export const decimalSchema = z
  .union([z.string(), z.number()])
  .transform((val) => typeof val === 'string' ? parseFloat(val) : val)
  .pipe(z.number().finite('Invalid decimal value'));

/**
 * Positive integer validation
 */
export const positiveIntSchema = z
  .number()
  .int('Must be an integer')
  .positive('Must be positive');

/**
 * Non-negative integer validation
 */
export const nonNegativeIntSchema = z
  .number()
  .int('Must be an integer')
  .min(0, 'Must be non-negative');

// =============================================================================
// STRIPE VALIDATIONS
// =============================================================================

/**
 * Stripe Customer ID validation
 */
export const stripeCustomerIdSchema = z
  .string()
  .startsWith('cus_', 'Invalid Stripe customer ID format')
  .optional();

/**
 * Stripe Payment Intent ID validation
 */
export const stripePaymentIntentIdSchema = z
  .string()
  .startsWith('pi_', 'Invalid Stripe payment intent ID format')
  .optional();

/**
 * Stripe Subscription ID validation
 */
export const stripeSubscriptionIdSchema = z
  .string()
  .startsWith('sub_', 'Invalid Stripe subscription ID format');

/**
 * Stripe Price ID validation
 */
export const stripePriceIdSchema = z
  .string()
  .startsWith('price_', 'Invalid Stripe price ID format')
  .optional();

/**
 * Stripe Product ID validation
 */
export const stripeProductIdSchema = z
  .string()
  .startsWith('prod_', 'Invalid Stripe product ID format')
  .optional();

/**
 * Stripe Payment Method ID validation
 */
export const stripePaymentMethodIdSchema = z
  .string()
  .startsWith('pm_', 'Invalid Stripe payment method ID format');

/**
 * Stripe Charge ID validation
 */
export const stripeChargeIdSchema = z
  .string()
  .startsWith('ch_', 'Invalid Stripe charge ID format')
  .optional();

/**
 * Stripe Webhook Secret validation
 */
export const stripeWebhookSecretSchema = z
  .string()
  .startsWith('whsec_', 'Invalid Stripe webhook secret format');

// =============================================================================
// TEXT VALIDATIONS
// =============================================================================

/**
 * Name validation (for user names, product names, etc.)
 */
export const nameSchema = z
  .string()
  .trim()
  .min(1, 'Name is required')
  .max(100, 'Name must not exceed 100 characters')
  .regex(/^[a-zA-Z0-9\s\-_'.]+$/, 'Name contains invalid characters');

/**
 * Short description validation
 */
export const shortDescriptionSchema = z
  .string()
  .trim()
  .max(255, 'Short description must not exceed 255 characters')
  .optional();

/**
 * Long description validation
 */
export const longDescriptionSchema = z
  .string()
  .trim()
  .max(10000, 'Description must not exceed 10,000 characters')
  .optional();

/**
 * SKU validation
 */
export const skuSchema = z
  .string()
  .trim()
  .regex(/^[A-Z0-9\-_]+$/, 'SKU must contain only uppercase letters, numbers, hyphens, and underscores')
  .max(50, 'SKU must not exceed 50 characters')
  .optional();

/**
 * Order number validation
 */
export const orderNumberSchema = z
  .string()
  .regex(/^[A-Z0-9\-]+$/, 'Invalid order number format')
  .min(8, 'Order number must be at least 8 characters')
  .max(20, 'Order number must not exceed 20 characters');

/**
 * Tracking number validation
 */
export const trackingNumberSchema = z
  .string()
  .trim()
  .max(100, 'Tracking number must not exceed 100 characters')
  .optional();

// =============================================================================
// ADDRESS VALIDATIONS
// =============================================================================

/**
 * Address schema for billing and shipping
 */
export const addressSchema = z.object({
  street: z.string().trim().min(1, 'Street address is required').max(255),
  street2: z.string().trim().max(255).optional(),
  city: z.string().trim().min(1, 'City is required').max(100),
  state: z.string().trim().max(100).optional(),
  postalCode: z.string().trim().min(1, 'Postal code is required').max(20),
  country: z.string().length(2, 'Country must be a 2-letter code').toUpperCase(),
  name: nameSchema.optional(),
  company: z.string().trim().max(100).optional(),
  phone: phoneSchema,
});

// =============================================================================
// ARRAY VALIDATIONS
// =============================================================================

/**
 * Tags array validation
 */
export const tagsSchema = z
  .array(z.string().trim().min(1).max(50))
  .max(20, 'Cannot have more than 20 tags')
  .default([]);

/**
 * Images array validation
 */
export const imagesSchema = z
  .array(urlSchema)
  .max(10, 'Cannot have more than 10 images')
  .default([]);

/**
 * Changed fields array for audit logs
 */
export const changedFieldsSchema = z
  .array(z.string())
  .default([]);

// =============================================================================
// METADATA VALIDATIONS
// =============================================================================

/**
 * JSON metadata validation with size limits
 */
export const metadataSchema = z
  .record(z.unknown())
  .optional()
  .refine(
    (data) => {
      if (!data) return true;
      const jsonString = JSON.stringify(data);
      return jsonString.length <= 65536; // 64KB limit
    },
    { message: 'Metadata size cannot exceed 64KB' }
  );

// =============================================================================
// TIMESTAMP VALIDATIONS
// =============================================================================

/**
 * Date validation that accepts both Date objects and ISO strings
 */
export const dateSchema = z.union([
  z.date(),
  z.string().datetime('Invalid datetime format'),
]).transform((val) => val instanceof Date ? val : new Date(val));

/**
 * Optional date validation
 */
export const optionalDateSchema = z.union([
  z.date(),
  z.string().datetime('Invalid datetime format'),
]).optional().transform((val) => {
  if (!val) return undefined;
  return val instanceof Date ? val : new Date(val);
});

// =============================================================================
// SECURITY VALIDATIONS
// =============================================================================

/**
 * IP address validation (IPv4 and IPv6)
 */
export const ipAddressSchema = z
  .string()
  .regex(
    /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$|^(?:[0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$/,
    'Invalid IP address format'
  )
  .optional();

/**
 * User agent validation
 */
export const userAgentSchema = z
  .string()
  .max(512, 'User agent string too long')
  .optional();

/**
 * Session ID validation
 */
export const sessionIdSchema = z
  .string()
  .min(10, 'Session ID too short')
  .max(255, 'Session ID too long')
  .optional();

/**
 * Request ID validation for tracing
 */
export const requestIdSchema = z
  .string()
  .max(100, 'Request ID too long')
  .optional();

// =============================================================================
// PAGINATION VALIDATIONS
// =============================================================================

/**
 * Pagination limit validation
 */
export const limitSchema = z
  .number()
  .int('Limit must be an integer')
  .min(1, 'Limit must be at least 1')
  .max(100, 'Limit cannot exceed 100')
  .default(20);

/**
 * Pagination offset validation
 */
export const offsetSchema = z
  .number()
  .int('Offset must be an integer')
  .min(0, 'Offset must be non-negative')
  .default(0);

/**
 * Page number validation
 */
export const pageSchema = z
  .number()
  .int('Page must be an integer')
  .min(1, 'Page must be at least 1')
  .default(1);

// =============================================================================
// SORT VALIDATIONS
// =============================================================================

/**
 * Sort direction validation
 */
export const sortDirectionSchema = z.enum(['asc', 'desc']).default('desc');

// =============================================================================
// TYPE EXPORTS
// =============================================================================

export type Address = z.infer<typeof addressSchema>;
export type Currency = z.infer<typeof currencySchema>;
export type Metadata = z.infer<typeof metadataSchema>;
export type SortDirection = z.infer<typeof sortDirectionSchema>;