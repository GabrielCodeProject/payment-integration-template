import { z } from 'zod';
import {
  loginCredentialsSchema,
  registrationSchema,
  emailVerificationRequestSchema,
  emailVerificationSchema,
  emailChangeRequestSchema,
  emailChangeConfirmationSchema,
  passwordResetRequestSchema,
  passwordResetSchema,
  passwordChangeSchema,
  twoFactorSetupSchema,
  twoFactorVerificationSchema,
  twoFactorDisableSchema,
  regenerateBackupCodesSchema,
  sessionValidationSchema,
  terminateSessionSchema,
  oauthCallbackSchema,
  oauthLinkingSchema,
  oauthUnlinkingSchema,
  deviceRegistrationSchema,
  deviceTrustSchema,
  deviceRevocationSchema,
} from '../base/auth';
import {
  cuidSchema,
  limitSchema,
  offsetSchema,
  optionalDateSchema,
} from '../base/common';

/**
 * Authentication Actions Validation Schemas
 * 
 * Server Action validation schemas for authentication operations.
 * These schemas are designed to work with next-safe-action and BetterAuth.
 */

// =============================================================================
// AUTHENTICATION ACTIONS
// =============================================================================

/**
 * Login action schema
 */
export const loginActionSchema = loginCredentialsSchema.extend({
  redirectTo: z.string().url('Invalid redirect URL').optional(),
});

/**
 * Register action schema
 */
export const registerActionSchema = registrationSchema.extend({
  redirectTo: z.string().url('Invalid redirect URL').optional(),
  referralCode: z.string().max(50, 'Referral code must not exceed 50 characters').optional(),
});

/**
 * Logout action schema
 */
export const logoutActionSchema = z.object({
  allDevices: z.boolean().default(false),
  redirectTo: z.string().url('Invalid redirect URL').optional(),
});

/**
 * Refresh session action schema
 */
export const refreshSessionActionSchema = z.object({
  refreshToken: z.string().min(1, 'Refresh token is required').optional(),
});

// =============================================================================
// EMAIL VERIFICATION ACTIONS
// =============================================================================

/**
 * Request email verification action schema
 */
export const requestEmailVerificationActionSchema = emailVerificationRequestSchema;

/**
 * Verify email action schema
 */
export const verifyEmailActionSchema = emailVerificationSchema.extend({
  redirectTo: z.string().url('Invalid redirect URL').optional(),
});

/**
 * Request email change action schema
 */
export const requestEmailChangeActionSchema = emailChangeRequestSchema;

/**
 * Confirm email change action schema
 */
export const confirmEmailChangeActionSchema = emailChangeConfirmationSchema.extend({
  redirectTo: z.string().url('Invalid redirect URL').optional(),
});

// =============================================================================
// PASSWORD MANAGEMENT ACTIONS
// =============================================================================

/**
 * Request password reset action schema
 */
export const requestPasswordResetActionSchema = passwordResetRequestSchema.extend({
  redirectTo: z.string().url('Invalid redirect URL').optional(),
});

/**
 * Reset password action schema
 */
export const resetPasswordActionSchema = passwordResetSchema.extend({
  redirectTo: z.string().url('Invalid redirect URL').optional(),
});

/**
 * Change password action schema
 */
export const changePasswordActionSchema = passwordChangeSchema;

/**
 * Validate password strength action schema
 */
export const validatePasswordStrengthActionSchema = z.object({
  password: z.string().min(1, 'Password is required'),
});

// =============================================================================
// TWO-FACTOR AUTHENTICATION ACTIONS
// =============================================================================

/**
 * Setup two-factor authentication action schema
 */
export const setupTwoFactorActionSchema = z.object({
  // Returns QR code and secret for initial setup
});

/**
 * Enable two-factor authentication action schema
 */
export const enableTwoFactorActionSchema = twoFactorSetupSchema;

/**
 * Verify two-factor authentication action schema
 */
export const verifyTwoFactorActionSchema = twoFactorVerificationSchema.extend({
  redirectTo: z.string().url('Invalid redirect URL').optional(),
});

/**
 * Disable two-factor authentication action schema
 */
export const disableTwoFactorActionSchema = twoFactorDisableSchema;

/**
 * Regenerate backup codes action schema
 */
export const regenerateBackupCodesActionSchema = regenerateBackupCodesSchema;

/**
 * Verify backup code action schema
 */
export const verifyBackupCodeActionSchema = z.object({
  backupCode: z.string().length(8, 'Backup code must be 8 characters'),
  redirectTo: z.string().url('Invalid redirect URL').optional(),
});

// =============================================================================
// SESSION MANAGEMENT ACTIONS
// =============================================================================

/**
 * Get active sessions action schema
 */
export const getActiveSessionsActionSchema = z.object({
  includeCurrentSession: z.boolean().default(true),
});

/**
 * Validate session action schema
 */
export const validateSessionActionSchema = sessionValidationSchema;

/**
 * Terminate session action schema
 */
export const terminateSessionActionSchema = terminateSessionSchema;

/**
 * Terminate all sessions action schema
 */
export const terminateAllSessionsActionSchema = z.object({
  excludeCurrentSession: z.boolean().default(true),
  reason: z.enum(['security', 'user_request', 'admin_action']).default('user_request'),
});

// =============================================================================
// OAUTH/SOCIAL LOGIN ACTIONS
// =============================================================================

/**
 * OAuth login action schema
 */
export const oauthLoginActionSchema = z.object({
  provider: z.enum(['google', 'github', 'discord', 'twitter', 'facebook', 'apple', 'microsoft']),
  redirectTo: z.string().url('Invalid redirect URL').optional(),
  state: z.string().optional(), // For CSRF protection
});

/**
 * OAuth callback action schema
 */
export const oauthCallbackActionSchema = oauthCallbackSchema.extend({
  redirectTo: z.string().url('Invalid redirect URL').optional(),
});

/**
 * Link OAuth account action schema
 */
export const linkOAuthAccountActionSchema = oauthLinkingSchema;

/**
 * Unlink OAuth account action schema
 */
export const unlinkOAuthAccountActionSchema = oauthUnlinkingSchema;

/**
 * Get linked accounts action schema
 */
export const getLinkedAccountsActionSchema = z.object({
  // No parameters needed - uses current user
});

// =============================================================================
// DEVICE MANAGEMENT ACTIONS
// =============================================================================

/**
 * Register device action schema
 */
export const registerDeviceActionSchema = deviceRegistrationSchema;

/**
 * Get user devices action schema
 */
export const getUserDevicesActionSchema = z.object({
  includeUntrusted: z.boolean().default(true),
  limit: limitSchema.default(50),
  offset: offsetSchema.default(0),
});

/**
 * Trust device action schema
 */
export const trustDeviceActionSchema = deviceTrustSchema;

/**
 * Revoke device action schema
 */
export const revokeDeviceActionSchema = deviceRevocationSchema;

/**
 * Update device action schema
 */
export const updateDeviceActionSchema = z.object({
  deviceId: cuidSchema,
  deviceName: z.string().min(1, 'Device name is required').max(100, 'Device name must not exceed 100 characters').optional(),
  isTrusted: z.boolean().optional(),
});

// =============================================================================
// SECURITY ACTIONS
// =============================================================================

/**
 * Get security events action schema
 */
export const getSecurityEventsActionSchema = z.object({
  limit: limitSchema.default(20),
  offset: offsetSchema.default(0),
  eventType: z.enum([
    'login_success',
    'login_failure',
    'password_change',
    'email_change',
    'two_factor_change',
    'device_trust',
    'session_terminate',
    'suspicious_activity',
  ]).optional(),
  startDate: optionalDateSchema,
  endDate: optionalDateSchema,
});

/**
 * Report suspicious activity action schema
 */
export const reportSuspiciousActivityActionSchema = z.object({
  description: z.string().min(10, 'Description must be at least 10 characters').max(1000, 'Description must not exceed 1000 characters'),
  type: z.enum(['unauthorized_access', 'suspicious_login', 'data_breach', 'phishing', 'other']),
  severity: z.enum(['low', 'medium', 'high', 'critical']).default('medium'),
  metadata: z.record(z.unknown()).optional(),
});

/**
 * Check account security action schema
 */
export const checkAccountSecurityActionSchema = z.object({
  // No parameters needed - analyzes current user's security
});

/**
 * Enable account lockdown action schema
 */
export const enableAccountLockdownActionSchema = z.object({
  password: z.string().min(1, 'Password is required'),
  reason: z.string().max(500, 'Reason must not exceed 500 characters').optional(),
  duration: z.number().int().min(60).max(86400).optional(), // 1 minute to 24 hours
});

/**
 * Disable account lockdown action schema
 */
export const disableAccountLockdownActionSchema = z.object({
  password: z.string().min(1, 'Password is required'),
  twoFactorToken: z.string().length(6, 'Token must be 6 digits').regex(/^\d{6}$/, 'Token must contain only digits').optional(),
});

// =============================================================================
// AUDIT AND MONITORING ACTIONS
// =============================================================================

/**
 * Get authentication logs action schema
 */
export const getAuthLogsActionSchema = z.object({
  limit: limitSchema.default(50),
  offset: offsetSchema.default(0),
  action: z.enum([
    'login_success',
    'login_failure',
    'logout',
    'register',
    'password_change',
    'email_verify',
    'two_factor_enable',
    'two_factor_disable',
  ]).optional(),
  startDate: optionalDateSchema,
  endDate: optionalDateSchema,
  ipAddress: z.string().optional(),
});

/**
 * Download account data action schema (GDPR compliance)
 */
export const downloadAccountDataActionSchema = z.object({
  format: z.enum(['json', 'csv']).default('json'),
  includeAuthLogs: z.boolean().default(false),
  includeDevices: z.boolean().default(true),
  includeSessions: z.boolean().default(false),
});

/**
 * Delete account action schema (GDPR compliance)
 */
export const deleteAccountActionSchema = z.object({
  password: z.string().min(1, 'Password is required'),
  confirmDeletion: z.string().refine(val => val === 'DELETE', {
    message: 'You must type "DELETE" to confirm account deletion',
  }),
  reason: z.string().max(500, 'Reason must not exceed 500 characters').optional(),
  twoFactorToken: z.string().length(6, 'Token must be 6 digits').regex(/^\d{6}$/, 'Token must contain only digits').optional(),
});

// =============================================================================
// RATE LIMITING ACTIONS
// =============================================================================

/**
 * Check rate limit action schema
 */
export const checkRateLimitActionSchema = z.object({
  action: z.enum(['login', 'register', 'password_reset', 'email_verification']),
  identifier: z.string().optional(), // IP address, email, or user ID
});

/**
 * Reset rate limit action schema (admin only)
 */
export const resetRateLimitActionSchema = z.object({
  action: z.enum(['login', 'register', 'password_reset', 'email_verification']),
  identifier: z.string().min(1, 'Identifier is required'),
  reason: z.string().max(255, 'Reason must not exceed 255 characters'),
});

// =============================================================================
// RESPONSE SCHEMAS
// =============================================================================

/**
 * Auth action success response schema
 */
export const authActionSuccessSchema = z.object({
  success: z.literal(true),
  data: z.record(z.unknown()).optional(),
  message: z.string().optional(),
  redirectTo: z.string().url().optional(),
  requiresTwoFactor: z.boolean().optional(),
  requiresEmailVerification: z.boolean().optional(),
});

/**
 * Auth action error response schema
 */
export const authActionErrorSchema = z.object({
  success: z.literal(false),
  error: z.string(),
  code: z.enum([
    'INVALID_CREDENTIALS',
    'EMAIL_NOT_VERIFIED',
    'TWO_FACTOR_REQUIRED',
    'ACCOUNT_LOCKED',
    'ACCOUNT_DISABLED',
    'RATE_LIMITED',
    'CAPTCHA_REQUIRED',
    'INVALID_TOKEN',
    'TOKEN_EXPIRED',
    'WEAK_PASSWORD',
    'EMAIL_ALREADY_EXISTS',
    'OAUTH_ERROR',
    'SESSION_EXPIRED',
    'DEVICE_NOT_TRUSTED',
    'SECURITY_VIOLATION',
  ]).optional(),
  details: z.record(z.unknown()).optional(),
  retryAfter: z.number().optional(), // For rate limiting
});

/**
 * Auth action response schema
 */
export const authActionResponseSchema = z.union([
  authActionSuccessSchema,
  authActionErrorSchema,
]);

// =============================================================================
// TYPE EXPORTS
// =============================================================================

export type LoginAction = z.infer<typeof loginActionSchema>;
export type RegisterAction = z.infer<typeof registerActionSchema>;
export type LogoutAction = z.infer<typeof logoutActionSchema>;
export type RefreshSessionAction = z.infer<typeof refreshSessionActionSchema>;
export type RequestEmailVerificationAction = z.infer<typeof requestEmailVerificationActionSchema>;
export type VerifyEmailAction = z.infer<typeof verifyEmailActionSchema>;
export type RequestEmailChangeAction = z.infer<typeof requestEmailChangeActionSchema>;
export type ConfirmEmailChangeAction = z.infer<typeof confirmEmailChangeActionSchema>;
export type RequestPasswordResetAction = z.infer<typeof requestPasswordResetActionSchema>;
export type ResetPasswordAction = z.infer<typeof resetPasswordActionSchema>;
export type ChangePasswordAction = z.infer<typeof changePasswordActionSchema>;
export type ValidatePasswordStrengthAction = z.infer<typeof validatePasswordStrengthActionSchema>;
export type SetupTwoFactorAction = z.infer<typeof setupTwoFactorActionSchema>;
export type EnableTwoFactorAction = z.infer<typeof enableTwoFactorActionSchema>;
export type VerifyTwoFactorAction = z.infer<typeof verifyTwoFactorActionSchema>;
export type DisableTwoFactorAction = z.infer<typeof disableTwoFactorActionSchema>;
export type RegenerateBackupCodesAction = z.infer<typeof regenerateBackupCodesActionSchema>;
export type VerifyBackupCodeAction = z.infer<typeof verifyBackupCodeActionSchema>;
export type GetActiveSessionsAction = z.infer<typeof getActiveSessionsActionSchema>;
export type ValidateSessionAction = z.infer<typeof validateSessionActionSchema>;
export type TerminateSessionAction = z.infer<typeof terminateSessionActionSchema>;
export type TerminateAllSessionsAction = z.infer<typeof terminateAllSessionsActionSchema>;
export type OAuthLoginAction = z.infer<typeof oauthLoginActionSchema>;
export type OAuthCallbackAction = z.infer<typeof oauthCallbackActionSchema>;
export type LinkOAuthAccountAction = z.infer<typeof linkOAuthAccountActionSchema>;
export type UnlinkOAuthAccountAction = z.infer<typeof unlinkOAuthAccountActionSchema>;
export type GetLinkedAccountsAction = z.infer<typeof getLinkedAccountsActionSchema>;
export type RegisterDeviceAction = z.infer<typeof registerDeviceActionSchema>;
export type GetUserDevicesAction = z.infer<typeof getUserDevicesActionSchema>;
export type TrustDeviceAction = z.infer<typeof trustDeviceActionSchema>;
export type RevokeDeviceAction = z.infer<typeof revokeDeviceActionSchema>;
export type UpdateDeviceAction = z.infer<typeof updateDeviceActionSchema>;
export type GetSecurityEventsAction = z.infer<typeof getSecurityEventsActionSchema>;
export type ReportSuspiciousActivityAction = z.infer<typeof reportSuspiciousActivityActionSchema>;
export type CheckAccountSecurityAction = z.infer<typeof checkAccountSecurityActionSchema>;
export type EnableAccountLockdownAction = z.infer<typeof enableAccountLockdownActionSchema>;
export type DisableAccountLockdownAction = z.infer<typeof disableAccountLockdownActionSchema>;
export type GetAuthLogsAction = z.infer<typeof getAuthLogsActionSchema>;
export type DownloadAccountDataAction = z.infer<typeof downloadAccountDataActionSchema>;
export type DeleteAccountAction = z.infer<typeof deleteAccountActionSchema>;
export type CheckRateLimitAction = z.infer<typeof checkRateLimitActionSchema>;
export type ResetRateLimitAction = z.infer<typeof resetRateLimitActionSchema>;
export type AuthActionSuccess = z.infer<typeof authActionSuccessSchema>;
export type AuthActionError = z.infer<typeof authActionErrorSchema>;
export type AuthActionResponse = z.infer<typeof authActionResponseSchema>;