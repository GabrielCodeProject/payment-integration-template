import { z } from 'zod';
import {
  cuidSchema,
  emailSchema,
  nameSchema,
  phoneSchema,
  currencySchema,
  timezoneSchema,
  stripeCustomerIdSchema,
  optionalDateSchema,
  dateSchema,
  userAgentSchema,
  ipAddressSchema,
} from './common';

/**
 * User Validation Schemas
 * 
 * Comprehensive validation schemas for user-related operations
 * including authentication, profile management, and preferences.
 */

// =============================================================================
// ENUMS
// =============================================================================

/**
 * User role validation
 */
export const userRoleSchema = z.enum(['CUSTOMER', 'ADMIN', 'SUPPORT'], {
  errorMap: () => ({ message: 'Invalid user role' }),
});

// =============================================================================
// CORE USER SCHEMAS
// =============================================================================

/**
 * Base user schema - matches Prisma User model (BetterAuth only)
 */
export const userSchema = z.object({
  id: cuidSchema,
  email: emailSchema,
  name: nameSchema.optional(),
  emailVerified: optionalDateSchema,
  image: z.string().url('Invalid image URL').optional(),
  phone: phoneSchema,
  
  // Authentication & Security
  twoFactorEnabled: z.boolean().default(false),
  isActive: z.boolean().default(true),
  role: userRoleSchema.default('CUSTOMER'),
  
  // Stripe Integration
  stripeCustomerId: stripeCustomerIdSchema,
  
  // Payment Preferences
  preferredCurrency: currencySchema,
  timezone: timezoneSchema,
  
  // Timestamps
  createdAt: dateSchema,
  updatedAt: dateSchema,
  lastLoginAt: optionalDateSchema,
});

/**
 * User creation schema (for registration)
 */
export const createUserSchema = z.object({
  email: emailSchema,
  name: nameSchema.optional(),
  phone: phoneSchema,
  preferredCurrency: currencySchema.optional(),
  timezone: timezoneSchema.optional(),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .max(128, 'Password must not exceed 128 characters')
    .regex(
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/,
      'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character'
    ),
  confirmPassword: z.string(),
}).refine(
  (data) => data.password === data.confirmPassword,
  {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  }
);

/**
 * User update schema (for profile updates)
 */
export const updateUserSchema = z.object({
  id: cuidSchema,
  name: nameSchema.optional(),
  phone: phoneSchema,
  preferredCurrency: currencySchema.optional(),
  timezone: timezoneSchema.optional(),
  image: z.string().url('Invalid image URL').optional(),
}).partial().required({ id: true });

/**
 * User password update schema
 */
export const updatePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .max(128, 'Password must not exceed 128 characters')
    .regex(
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/,
      'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character'
    ),
  confirmPassword: z.string(),
}).refine(
  (data) => data.newPassword === data.confirmPassword,
  {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  }
);

/**
 * User preferences schema
 */
export const userPreferencesSchema = z.object({
  preferredCurrency: currencySchema,
  timezone: timezoneSchema,
  twoFactorEnabled: z.boolean(),
  emailNotifications: z.boolean().default(true),
  smsNotifications: z.boolean().default(false),
  marketingEmails: z.boolean().default(false),
});

/**
 * User search/filter schema
 */
export const userFilterSchema = z.object({
  email: z.string().optional(),
  name: z.string().optional(),
  role: userRoleSchema.optional(),
  isActive: z.boolean().optional(),
  hasStripeCustomer: z.boolean().optional(),
  createdAfter: optionalDateSchema,
  createdBefore: optionalDateSchema,
});

/**
 * User sort options
 */
export const userSortSchema = z.enum([
  'email',
  'name',
  'createdAt',
  'updatedAt',
  'lastLoginAt',
  'role',
]);

// =============================================================================
// AUTHENTICATION SCHEMAS
// =============================================================================

/**
 * Login credentials schema
 */
export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Password is required'),
  rememberMe: z.boolean().default(false),
});

/**
 * Email verification schema
 */
export const emailVerificationSchema = z.object({
  email: emailSchema,
  token: z.string().min(1, 'Verification token is required'),
});

/**
 * Password reset request schema
 */
export const passwordResetRequestSchema = z.object({
  email: emailSchema,
});

/**
 * Password reset schema
 */
export const passwordResetSchema = z.object({
  token: z.string().min(1, 'Reset token is required'),
  newPassword: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .max(128, 'Password must not exceed 128 characters')
    .regex(
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/,
      'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character'
    ),
  confirmPassword: z.string(),
}).refine(
  (data) => data.newPassword === data.confirmPassword,
  {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  }
);

/**
 * Two-factor authentication setup schema
 */
export const twoFactorSetupSchema = z.object({
  secret: z.string().min(1, 'Secret is required'),
  token: z.string().length(6, 'Token must be 6 digits').regex(/^\d{6}$/, 'Token must contain only digits'),
});

/**
 * Two-factor authentication verification schema
 */
export const twoFactorVerificationSchema = z.object({
  token: z.string().length(6, 'Token must be 6 digits').regex(/^\d{6}$/, 'Token must contain only digits'),
});

// =============================================================================
// ACCOUNT MANAGEMENT SCHEMAS
// =============================================================================

/**
 * Account schema (for OAuth providers)
 */
export const accountSchema = z.object({
  id: cuidSchema,
  userId: cuidSchema,
  type: z.string(),
  provider: z.string(),
  providerAccountId: z.string(),
  refresh_token: z.string().optional(),
  access_token: z.string().optional(),
  expires_at: z.number().optional(),
  token_type: z.string().optional(),
  scope: z.string().optional(),
  id_token: z.string().optional(),
  session_state: z.string().optional(),
});

/**
 * Session schema
 */
export const sessionSchema = z.object({
  id: cuidSchema,
  sessionToken: z.string(),
  userId: cuidSchema,
  expires: dateSchema,
});

/**
 * Session creation schema
 */
export const createSessionSchema = z.object({
  userId: cuidSchema,
  expiresAt: dateSchema,
  ipAddress: ipAddressSchema,
  userAgent: userAgentSchema,
});

// =============================================================================
// PUBLIC SCHEMAS (FOR API RESPONSES)
// =============================================================================

/**
 * Public user schema (excludes sensitive data)
 */
export const publicUserSchema = userSchema.omit({
  stripeCustomerId: true,
}).extend({
  hasStripeCustomer: z.boolean(),
});

/**
 * User profile schema (for authenticated users viewing their own profile)
 */
export const userProfileSchema = userSchema;

/**
 * User list item schema (for admin lists)
 */
export const userListItemSchema = z.object({
  id: cuidSchema,
  email: emailSchema,
  name: nameSchema.optional(),
  role: userRoleSchema,
  isActive: z.boolean(),
  createdAt: dateSchema,
  lastLoginAt: optionalDateSchema,
  hasStripeCustomer: z.boolean(),
});

// =============================================================================
// ADMIN SCHEMAS
// =============================================================================

/**
 * Admin user update schema
 */
export const adminUpdateUserSchema = z.object({
  id: cuidSchema,
  name: nameSchema.optional(),
  email: emailSchema.optional(),
  role: userRoleSchema.optional(),
  isActive: z.boolean().optional(),
  twoFactorEnabled: z.boolean().optional(),
}).partial().required({ id: true });

/**
 * User role update schema
 */
export const updateUserRoleSchema = z.object({
  userId: cuidSchema,
  role: userRoleSchema,
});

/**
 * User deactivation schema
 */
export const deactivateUserSchema = z.object({
  userId: cuidSchema,
  reason: z.string().max(500, 'Reason must not exceed 500 characters').optional(),
});

// =============================================================================
// PROFILE MANAGEMENT SCHEMAS
// =============================================================================

/**
 * Profile update schema (excluding email which should be immutable)
 */
export const updateProfileSchema = z.object({
  name: nameSchema.optional(),
  phone: phoneSchema,
  timezone: timezoneSchema.optional(),
  preferredCurrency: currencySchema.optional(),
}).partial();

/**
 * Profile image upload schema
 */
export const profileImageUploadSchema = z.object({
  image: z.instanceof(File, { message: 'Invalid file' })
    .refine((file) => file.size <= 5 * 1024 * 1024, 'File size must be less than 5MB')
    .refine(
      (file) => ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'].includes(file.type),
      'File must be a valid image (JPEG, PNG, or WebP)'
    ),
});

/**
 * Profile image URL schema for validation
 */
export const profileImageUrlSchema = z.object({
  imageUrl: z.string().url('Invalid image URL').optional(),
});

/**
 * Complete profile schema (for fetching user profile)
 */
export const profileResponseSchema = userSchema.extend({
  hasStripeCustomer: z.boolean(),
});

// =============================================================================
// TYPE EXPORTS
// =============================================================================

export type User = z.infer<typeof userSchema>;
export type CreateUser = z.infer<typeof createUserSchema>;
export type UpdateUser = z.infer<typeof updateUserSchema>;
export type UserRole = z.infer<typeof userRoleSchema>;
export type UserPreferences = z.infer<typeof userPreferencesSchema>;
export type UserFilter = z.infer<typeof userFilterSchema>;
export type UserSort = z.infer<typeof userSortSchema>;
export type PublicUser = z.infer<typeof publicUserSchema>;
export type UserProfile = z.infer<typeof userProfileSchema>;
export type UserListItem = z.infer<typeof userListItemSchema>;
export type LoginCredentials = z.infer<typeof loginSchema>;
export type Account = z.infer<typeof accountSchema>;
export type Session = z.infer<typeof sessionSchema>;
export type CreateSession = z.infer<typeof createSessionSchema>;
export type UpdateProfile = z.infer<typeof updateProfileSchema>;
export type ProfileImageUpload = z.infer<typeof profileImageUploadSchema>;
export type ProfileImageUrl = z.infer<typeof profileImageUrlSchema>;
export type ProfileResponse = z.infer<typeof profileResponseSchema>;