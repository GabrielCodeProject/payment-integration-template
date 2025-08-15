import { z } from 'zod';
import {
  createUserSchema,
  updateUserSchema,
  updatePasswordSchema,
  userPreferencesSchema,
  userFilterSchema,
  userSortSchema,
  adminUpdateUserSchema,
  updateUserRoleSchema,
  deactivateUserSchema,
} from '../base/user';
import {
  limitSchema,
  offsetSchema,
  pageSchema,
  sortDirectionSchema,
  cuidSchema,
} from '../base/common';

/**
 * User Actions Validation Schemas
 * 
 * Server Action validation schemas for user management operations.
 * These schemas are designed to work with next-safe-action.
 */

// =============================================================================
// USER PROFILE ACTIONS
// =============================================================================

/**
 * Get user profile action schema
 */
export const getUserProfileActionSchema = z.object({
  userId: cuidSchema.optional(), // If not provided, uses current user
});

/**
 * Update user profile action schema
 */
export const updateUserProfileActionSchema = updateUserSchema;

/**
 * Update user preferences action schema
 */
export const updateUserPreferencesActionSchema = z.object({
  userId: cuidSchema.optional(), // If not provided, uses current user
  preferences: userPreferencesSchema,
});

/**
 * Upload user avatar action schema
 */
export const uploadUserAvatarActionSchema = z.object({
  userId: cuidSchema.optional(), // If not provided, uses current user
  imageData: z.string().min(1, 'Image data is required'),
  fileName: z.string().min(1, 'File name is required'),
  mimeType: z.enum(['image/jpeg', 'image/png', 'image/webp']),
  maxSize: z.number().int().min(1).max(5 * 1024 * 1024).default(2 * 1024 * 1024), // 2MB default
});

/**
 * Delete user avatar action schema
 */
export const deleteUserAvatarActionSchema = z.object({
  userId: cuidSchema.optional(), // If not provided, uses current user
});

// =============================================================================
// PASSWORD MANAGEMENT ACTIONS
// =============================================================================

/**
 * Update password action schema
 */
export const updatePasswordActionSchema = updatePasswordSchema;

/**
 * Check password strength action schema
 */
export const checkPasswordStrengthActionSchema = z.object({
  password: z.string().min(1, 'Password is required'),
});

// =============================================================================
// USER SEARCH AND LIST ACTIONS
// =============================================================================

/**
 * Search users action schema
 */
export const searchUsersActionSchema = z.object({
  query: z.string().max(255, 'Search query must not exceed 255 characters').optional(),
  filters: userFilterSchema.optional(),
  sort: z.object({
    field: userSortSchema,
    direction: sortDirectionSchema,
  }).optional(),
  pagination: z.object({
    page: pageSchema,
    limit: limitSchema,
  }).optional(),
});

/**
 * Get users list action schema (for admin)
 */
export const getUsersListActionSchema = z.object({
  filters: userFilterSchema.optional(),
  sort: z.object({
    field: userSortSchema,
    direction: sortDirectionSchema,
  }).optional(),
  pagination: z.object({
    offset: offsetSchema,
    limit: limitSchema,
  }).optional(),
});

/**
 * Get user by ID action schema
 */
export const getUserByIdActionSchema = z.object({
  userId: cuidSchema,
  includeStats: z.boolean().default(false),
  includeOrders: z.boolean().default(false),
  includeSubscriptions: z.boolean().default(false),
});

// =============================================================================
// USER STATISTICS ACTIONS
// =============================================================================

/**
 * Get user statistics action schema
 */
export const getUserStatsActionSchema = z.object({
  userId: cuidSchema.optional(), // If not provided, uses current user
  period: z.enum(['last_30_days', 'last_90_days', 'last_year', 'all_time']).default('last_30_days'),
  includeOrders: z.boolean().default(true),
  includeSubscriptions: z.boolean().default(true),
  includePayments: z.boolean().default(true),
});

/**
 * Get user activity action schema
 */
export const getUserActivityActionSchema = z.object({
  userId: cuidSchema.optional(), // If not provided, uses current user
  limit: limitSchema.default(50),
  includeSystemActions: z.boolean().default(false),
});

// =============================================================================
// USER EXPORT ACTIONS
// =============================================================================

/**
 * Export user data action schema (GDPR compliance)
 */
export const exportUserDataActionSchema = z.object({
  userId: cuidSchema.optional(), // If not provided, uses current user
  format: z.enum(['json', 'csv']).default('json'),
  includeOrders: z.boolean().default(true),
  includeSubscriptions: z.boolean().default(true),
  includePaymentMethods: z.boolean().default(false), // Sensitive data
  includeAuditLogs: z.boolean().default(false),
});

/**
 * Request user data deletion action schema (GDPR compliance)
 */
export const requestUserDeletionActionSchema = z.object({
  userId: cuidSchema.optional(), // If not provided, uses current user
  reason: z.string().max(500, 'Reason must not exceed 500 characters').optional(),
  confirmDeletion: z.boolean().refine(val => val === true, {
    message: 'You must confirm the deletion request',
  }),
});

// =============================================================================
// ADMIN USER MANAGEMENT ACTIONS
// =============================================================================

/**
 * Admin create user action schema
 */
export const adminCreateUserActionSchema = createUserSchema.extend({
  role: z.enum(['CUSTOMER', 'ADMIN', 'SUPPORT']).default('CUSTOMER'),
  isActive: z.boolean().default(true),
  skipEmailVerification: z.boolean().default(false),
  sendWelcomeEmail: z.boolean().default(true),
});

/**
 * Admin update user action schema
 */
export const adminUpdateUserActionSchema = adminUpdateUserSchema;

/**
 * Update user role action schema
 */
export const updateUserRoleActionSchema = updateUserRoleSchema;

/**
 * Deactivate user action schema
 */
export const deactivateUserActionSchema = deactivateUserSchema;

/**
 * Reactivate user action schema
 */
export const reactivateUserActionSchema = z.object({
  userId: cuidSchema,
  reason: z.string().max(500, 'Reason must not exceed 500 characters').optional(),
});

/**
 * Reset user password action schema (admin)
 */
export const adminResetPasswordActionSchema = z.object({
  userId: cuidSchema,
  temporaryPassword: z.string().optional(), // If not provided, generates random password
  requirePasswordChange: z.boolean().default(true),
  sendEmail: z.boolean().default(true),
});

/**
 * Impersonate user action schema (admin)
 */
export const impersonateUserActionSchema = z.object({
  userId: cuidSchema,
  reason: z.string().max(500, 'Reason must not exceed 500 characters'),
  duration: z.number().int().min(60).max(3600).default(900), // 1 minute to 1 hour, default 15 minutes
});

/**
 * Stop impersonation action schema
 */
export const stopImpersonationActionSchema = z.object({
  // No parameters needed - uses current session
});

// =============================================================================
// BULK USER ACTIONS
// =============================================================================

/**
 * Bulk update users action schema
 */
export const bulkUpdateUsersActionSchema = z.object({
  userIds: z.array(cuidSchema).min(1, 'At least one user is required').max(100, 'Cannot update more than 100 users at once'),
  updates: z.object({
    isActive: z.boolean().optional(),
    role: z.enum(['CUSTOMER', 'ADMIN', 'SUPPORT']).optional(),
  }).partial(),
  reason: z.string().max(500, 'Reason must not exceed 500 characters').optional(),
});

/**
 * Bulk export users action schema
 */
export const bulkExportUsersActionSchema = z.object({
  filters: userFilterSchema.optional(),
  format: z.enum(['json', 'csv', 'xlsx']).default('csv'),
  includePersonalData: z.boolean().default(false),
  includeStatistics: z.boolean().default(true),
  maxRecords: z.number().int().min(1).max(10000).default(1000),
});

// =============================================================================
// USER MERGE ACTIONS
// =============================================================================

/**
 * Merge user accounts action schema
 */
export const mergeUserAccountsActionSchema = z.object({
  primaryUserId: cuidSchema,
  secondaryUserId: cuidSchema,
  mergeData: z.object({
    orders: z.boolean().default(true),
    subscriptions: z.boolean().default(true),
    paymentMethods: z.boolean().default(true),
    preferences: z.enum(['primary', 'secondary', 'merge']).default('primary'),
  }),
  deleteSecondaryAccount: z.boolean().default(true),
  reason: z.string().max(500, 'Reason must not exceed 500 characters'),
}).refine(
  (data) => data.primaryUserId !== data.secondaryUserId,
  {
    message: 'Primary and secondary user IDs must be different',
    path: ['secondaryUserId'],
  }
);

// =============================================================================
// USER COMMUNICATION ACTIONS
// =============================================================================

/**
 * Send user notification action schema
 */
export const sendUserNotificationActionSchema = z.object({
  userId: cuidSchema,
  type: z.enum(['email', 'sms', 'push', 'in_app']),
  template: z.string().min(1, 'Template is required'),
  data: z.record(z.unknown()).optional(),
  priority: z.enum(['low', 'normal', 'high', 'urgent']).default('normal'),
  scheduleAt: z.date().optional(),
});

/**
 * Send bulk notification action schema
 */
export const sendBulkNotificationActionSchema = z.object({
  userIds: z.array(cuidSchema).min(1, 'At least one user is required').max(1000, 'Cannot send to more than 1000 users at once'),
  type: z.enum(['email', 'sms', 'push', 'in_app']),
  template: z.string().min(1, 'Template is required'),
  data: z.record(z.unknown()).optional(),
  priority: z.enum(['low', 'normal', 'high', 'urgent']).default('normal'),
  scheduleAt: z.date().optional(),
  batchSize: z.number().int().min(1).max(100).default(50),
});

// =============================================================================
// RESPONSE SCHEMAS
// =============================================================================

/**
 * User action success response schema
 */
export const userActionSuccessSchema = z.object({
  success: z.literal(true),
  data: z.record(z.unknown()),
  message: z.string().optional(),
});

/**
 * User action error response schema
 */
export const userActionErrorSchema = z.object({
  success: z.literal(false),
  error: z.string(),
  code: z.string().optional(),
  details: z.record(z.unknown()).optional(),
});

/**
 * User action response schema
 */
export const userActionResponseSchema = z.union([
  userActionSuccessSchema,
  userActionErrorSchema,
]);

// =============================================================================
// TYPE EXPORTS
// =============================================================================

export type GetUserProfileAction = z.infer<typeof getUserProfileActionSchema>;
export type UpdateUserProfileAction = z.infer<typeof updateUserProfileActionSchema>;
export type UpdateUserPreferencesAction = z.infer<typeof updateUserPreferencesActionSchema>;
export type UploadUserAvatarAction = z.infer<typeof uploadUserAvatarActionSchema>;
export type DeleteUserAvatarAction = z.infer<typeof deleteUserAvatarActionSchema>;
export type UpdatePasswordAction = z.infer<typeof updatePasswordActionSchema>;
export type CheckPasswordStrengthAction = z.infer<typeof checkPasswordStrengthActionSchema>;
export type SearchUsersAction = z.infer<typeof searchUsersActionSchema>;
export type GetUsersListAction = z.infer<typeof getUsersListActionSchema>;
export type GetUserByIdAction = z.infer<typeof getUserByIdActionSchema>;
export type GetUserStatsAction = z.infer<typeof getUserStatsActionSchema>;
export type GetUserActivityAction = z.infer<typeof getUserActivityActionSchema>;
export type ExportUserDataAction = z.infer<typeof exportUserDataActionSchema>;
export type RequestUserDeletionAction = z.infer<typeof requestUserDeletionActionSchema>;
export type AdminCreateUserAction = z.infer<typeof adminCreateUserActionSchema>;
export type AdminUpdateUserAction = z.infer<typeof adminUpdateUserActionSchema>;
export type UpdateUserRoleAction = z.infer<typeof updateUserRoleActionSchema>;
export type DeactivateUserAction = z.infer<typeof deactivateUserActionSchema>;
export type ReactivateUserAction = z.infer<typeof reactivateUserActionSchema>;
export type AdminResetPasswordAction = z.infer<typeof adminResetPasswordActionSchema>;
export type ImpersonateUserAction = z.infer<typeof impersonateUserActionSchema>;
export type StopImpersonationAction = z.infer<typeof stopImpersonationActionSchema>;
export type BulkUpdateUsersAction = z.infer<typeof bulkUpdateUsersActionSchema>;
export type BulkExportUsersAction = z.infer<typeof bulkExportUsersActionSchema>;
export type MergeUserAccountsAction = z.infer<typeof mergeUserAccountsActionSchema>;
export type SendUserNotificationAction = z.infer<typeof sendUserNotificationActionSchema>;
export type SendBulkNotificationAction = z.infer<typeof sendBulkNotificationActionSchema>;
export type UserActionSuccess = z.infer<typeof userActionSuccessSchema>;
export type UserActionError = z.infer<typeof userActionErrorSchema>;
export type UserActionResponse = z.infer<typeof userActionResponseSchema>;