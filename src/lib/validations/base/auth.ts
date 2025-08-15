import { z } from 'zod';
import {
  cuidSchema,
  emailSchema,
  nameSchema,
  phoneSchema,
  ipAddressSchema,
  userAgentSchema,
  sessionIdSchema,
  dateSchema,
  optionalDateSchema,
} from './common';

/**
 * Authentication Validation Schemas
 * 
 * Comprehensive validation schemas for authentication,
 * authorization, and session management with BetterAuth integration.
 */

// =============================================================================
// CORE AUTHENTICATION SCHEMAS
// =============================================================================

/**
 * Login credentials validation
 */
export const loginCredentialsSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Password is required'),
  rememberMe: z.boolean().default(false),
  captchaToken: z.string().optional(), // For bot protection
  deviceFingerprint: z.string().max(255).optional(),
});

/**
 * Registration schema
 */
export const registrationSchema = z.object({
  email: emailSchema,
  name: nameSchema.optional(),
  phone: phoneSchema,
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .max(128, 'Password must not exceed 128 characters')
    .regex(
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/,
      'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character'
    ),
  confirmPassword: z.string(),
  agreeToTerms: z.boolean().refine(val => val === true, {
    message: 'You must agree to the terms and conditions',
  }),
  agreeToPrivacy: z.boolean().refine(val => val === true, {
    message: 'You must agree to the privacy policy',
  }),
  marketingOptIn: z.boolean().default(false),
  captchaToken: z.string().optional(),
}).refine(
  (data) => data.password === data.confirmPassword,
  {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  }
);

/**
 * Password validation schema (for password-only validation)
 */
export const passwordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .max(128, 'Password must not exceed 128 characters')
  .regex(
    /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/,
    'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character'
  );

/**
 * Password strength validation
 */
export const passwordStrengthSchema = z.object({
  password: passwordSchema,
  strength: z.enum(['weak', 'fair', 'good', 'strong']),
  score: z.number().min(0).max(100),
  feedback: z.array(z.string()).default([]),
  entropy: z.number().min(0),
});

// =============================================================================
// EMAIL VERIFICATION SCHEMAS
// =============================================================================

/**
 * Email verification request schema
 */
export const emailVerificationRequestSchema = z.object({
  email: emailSchema,
  resend: z.boolean().default(false),
});

/**
 * Email verification schema
 */
export const emailVerificationSchema = z.object({
  email: emailSchema,
  token: z.string().min(1, 'Verification token is required'),
  code: z.string().length(6, 'Verification code must be 6 digits').regex(/^\d{6}$/, 'Verification code must be numeric').optional(),
});

/**
 * Email change request schema
 */
export const emailChangeRequestSchema = z.object({
  currentEmail: emailSchema,
  newEmail: emailSchema,
  password: z.string().min(1, 'Password is required'),
}).refine(
  (data) => data.currentEmail !== data.newEmail,
  {
    message: 'New email must be different from current email',
    path: ['newEmail'],
  }
);

/**
 * Email change confirmation schema
 */
export const emailChangeConfirmationSchema = z.object({
  token: z.string().min(1, 'Confirmation token is required'),
  newEmail: emailSchema,
});

// =============================================================================
// PASSWORD RESET SCHEMAS
// =============================================================================

/**
 * Password reset request schema
 */
export const passwordResetRequestSchema = z.object({
  email: emailSchema,
  captchaToken: z.string().optional(),
});

/**
 * Password reset validation schema
 */
export const passwordResetSchema = z.object({
  token: z.string().min(1, 'Reset token is required'),
  newPassword: passwordSchema,
  confirmPassword: z.string(),
}).refine(
  (data) => data.newPassword === data.confirmPassword,
  {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  }
);

/**
 * Password change schema (for authenticated users)
 */
export const passwordChangeSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: passwordSchema,
  confirmPassword: z.string(),
}).refine(
  (data) => data.newPassword === data.confirmPassword,
  {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  }
).refine(
  (data) => data.currentPassword !== data.newPassword,
  {
    message: 'New password must be different from current password',
    path: ['newPassword'],
  }
);

// =============================================================================
// TWO-FACTOR AUTHENTICATION SCHEMAS
// =============================================================================

/**
 * Two-factor authentication setup schema
 */
export const twoFactorSetupSchema = z.object({
  secret: z.string().min(1, 'Secret is required'),
  qrCode: z.string().url('Invalid QR code URL').optional(),
  backupCodes: z.array(z.string().length(8)).length(10, 'Must have exactly 10 backup codes'),
  token: z.string().length(6, 'Token must be 6 digits').regex(/^\d{6}$/, 'Token must contain only digits'),
});

/**
 * Two-factor authentication verification schema
 */
export const twoFactorVerificationSchema = z.object({
  token: z.string().length(6, 'Token must be 6 digits').regex(/^\d{6}$/, 'Token must contain only digits'),
  isBackupCode: z.boolean().default(false),
  rememberDevice: z.boolean().default(false),
});

/**
 * Two-factor authentication disable schema
 */
export const twoFactorDisableSchema = z.object({
  password: z.string().min(1, 'Password is required'),
  token: z.string().length(6, 'Token must be 6 digits').regex(/^\d{6}$/, 'Token must contain only digits').optional(),
  backupCode: z.string().length(8, 'Backup code must be 8 characters').optional(),
}).refine(
  (data) => data.token || data.backupCode,
  {
    message: 'Either token or backup code is required',
    path: ['token'],
  }
);

/**
 * Backup codes regeneration schema
 */
export const regenerateBackupCodesSchema = z.object({
  password: z.string().min(1, 'Password is required'),
  token: z.string().length(6, 'Token must be 6 digits').regex(/^\d{6}$/, 'Token must contain only digits'),
});

// =============================================================================
// SESSION MANAGEMENT SCHEMAS
// =============================================================================

/**
 * Session creation schema
 */
export const createSessionSchema = z.object({
  userId: cuidSchema,
  expiresAt: dateSchema,
  ipAddress: ipAddressSchema,
  userAgent: userAgentSchema,
  deviceFingerprint: z.string().max(255).optional(),
  isRemembered: z.boolean().default(false),
  metadata: z.record(z.unknown()).optional(),
});

/**
 * Session update schema
 */
export const updateSessionSchema = z.object({
  sessionId: sessionIdSchema,
  expiresAt: dateSchema.optional(),
  lastActivityAt: dateSchema.optional(),
  ipAddress: ipAddressSchema.optional(),
  metadata: z.record(z.unknown()).optional(),
});

/**
 * Session validation schema
 */
export const sessionValidationSchema = z.object({
  sessionToken: z.string().min(1, 'Session token is required'),
  ipAddress: ipAddressSchema.optional(),
  userAgent: userAgentSchema.optional(),
  strict: z.boolean().default(false), // Strict validation includes IP/UA checking
});

/**
 * Session termination schema
 */
export const terminateSessionSchema = z.object({
  sessionId: sessionIdSchema.optional(),
  sessionToken: z.string().optional(),
  terminateAll: z.boolean().default(false),
  reason: z.enum(['logout', 'security', 'admin', 'expired']).default('logout'),
}).refine(
  (data) => data.sessionId || data.sessionToken || data.terminateAll,
  {
    message: 'Session ID, session token, or terminate all flag is required',
    path: ['sessionId'],
  }
);

// =============================================================================
// OAUTH/SOCIAL LOGIN SCHEMAS
// =============================================================================

/**
 * OAuth provider validation
 */
export const oauthProviderSchema = z.enum([
  'google',
  'github',
  'discord',
  'twitter',
  'facebook',
  'apple',
  'microsoft',
], {
  errorMap: () => ({ message: 'Invalid OAuth provider' }),
});

/**
 * OAuth callback schema
 */
export const oauthCallbackSchema = z.object({
  provider: oauthProviderSchema,
  code: z.string().min(1, 'Authorization code is required'),
  state: z.string().min(1, 'State parameter is required'),
  error: z.string().optional(),
  errorDescription: z.string().optional(),
});

/**
 * OAuth account linking schema
 */
export const oauthLinkingSchema = z.object({
  provider: oauthProviderSchema,
  providerAccountId: z.string().min(1, 'Provider account ID is required'),
  email: emailSchema,
  name: nameSchema.optional(),
  avatar: z.string().url('Invalid avatar URL').optional(),
  linkToExisting: z.boolean().default(false),
});

/**
 * Social account unlinking schema
 */
export const oauthUnlinkingSchema = z.object({
  provider: oauthProviderSchema,
  password: z.string().min(1, 'Password is required'),
  confirmUnlink: z.boolean().refine(val => val === true, {
    message: 'You must confirm unlinking this account',
  }),
});

// =============================================================================
// DEVICE MANAGEMENT SCHEMAS
// =============================================================================

/**
 * Device registration schema
 */
export const deviceRegistrationSchema = z.object({
  deviceName: z.string().min(1, 'Device name is required').max(100, 'Device name must not exceed 100 characters'),
  deviceType: z.enum(['desktop', 'mobile', 'tablet', 'other']),
  deviceFingerprint: z.string().min(1, 'Device fingerprint is required').max(255),
  userAgent: userAgentSchema,
  ipAddress: ipAddressSchema,
  isTrusted: z.boolean().default(false),
});

/**
 * Device trust schema
 */
export const deviceTrustSchema = z.object({
  deviceId: cuidSchema,
  trustLevel: z.enum(['untrusted', 'partial', 'trusted']),
  expiresAt: optionalDateSchema,
  password: z.string().min(1, 'Password is required'),
});

/**
 * Device revocation schema
 */
export const deviceRevocationSchema = z.object({
  deviceId: cuidSchema.optional(),
  revokeAll: z.boolean().default(false),
  reason: z.enum(['user_request', 'security', 'lost', 'stolen', 'compromised']).default('user_request'),
}).refine(
  (data) => data.deviceId || data.revokeAll,
  {
    message: 'Device ID or revoke all flag is required',
    path: ['deviceId'],
  }
);

// =============================================================================
// SECURITY SCHEMAS
// =============================================================================

/**
 * Login attempt schema
 */
export const loginAttemptSchema = z.object({
  email: emailSchema,
  success: z.boolean(),
  ipAddress: ipAddressSchema,
  userAgent: userAgentSchema,
  timestamp: dateSchema,
  failureReason: z.enum([
    'invalid_credentials',
    'account_locked',
    'account_disabled',
    'email_not_verified',
    'two_factor_required',
    'rate_limited',
    'captcha_failed',
  ]).optional(),
  metadata: z.record(z.unknown()).optional(),
});

/**
 * Account lockout schema
 */
export const accountLockoutSchema = z.object({
  userId: cuidSchema,
  reason: z.enum(['failed_attempts', 'security_violation', 'admin_action', 'suspicious_activity']),
  lockoutDuration: z.number().int().min(60).max(86400), // 1 minute to 24 hours
  unlockAt: dateSchema.optional(),
  metadata: z.record(z.unknown()).optional(),
});

/**
 * Security alert schema
 */
export const securityAlertSchema = z.object({
  userId: cuidSchema,
  alertType: z.enum([
    'new_device_login',
    'suspicious_login',
    'password_changed',
    'email_changed',
    'two_factor_disabled',
    'account_compromised',
  ]),
  severity: z.enum(['low', 'medium', 'high', 'critical']),
  ipAddress: ipAddressSchema.optional(),
  userAgent: userAgentSchema.optional(),
  metadata: z.record(z.unknown()).optional(),
  notificationSent: z.boolean().default(false),
});

// =============================================================================
// RATE LIMITING SCHEMAS
// =============================================================================

/**
 * Rate limit configuration schema
 */
export const rateLimitConfigSchema = z.object({
  identifier: z.string().min(1, 'Identifier is required'), // IP, user ID, email, etc.
  action: z.enum(['login', 'register', 'password_reset', 'email_verification', 'api_call']),
  windowMs: z.number().int().min(1000).max(86400000), // 1 second to 24 hours
  maxAttempts: z.number().int().min(1).max(1000),
  skipSuccessfulRequests: z.boolean().default(false),
  skipFailedRequests: z.boolean().default(false),
});

/**
 * Rate limit status schema
 */
export const rateLimitStatusSchema = z.object({
  identifier: z.string(),
  action: z.string(),
  currentAttempts: z.number().int().min(0),
  maxAttempts: z.number().int().min(1),
  windowStart: dateSchema,
  windowEnd: dateSchema,
  isLimited: z.boolean(),
  resetTime: dateSchema.optional(),
});

// =============================================================================
// AUDIT SCHEMAS
// =============================================================================

/**
 * Authentication audit schema
 */
export const authAuditSchema = z.object({
  userId: cuidSchema.optional(),
  email: emailSchema.optional(),
  action: z.enum([
    'login_success',
    'login_failure',
    'logout',
    'register',
    'password_change',
    'password_reset',
    'email_verify',
    'two_factor_enable',
    'two_factor_disable',
    'oauth_link',
    'oauth_unlink',
    'session_create',
    'session_terminate',
    'device_trust',
    'device_revoke',
    'account_lock',
    'account_unlock',
  ]),
  ipAddress: ipAddressSchema,
  userAgent: userAgentSchema,
  sessionId: sessionIdSchema.optional(),
  deviceId: cuidSchema.optional(),
  success: z.boolean(),
  errorCode: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
  timestamp: dateSchema,
});

// =============================================================================
// TYPE EXPORTS
// =============================================================================

export type LoginCredentials = z.infer<typeof loginCredentialsSchema>;
export type Registration = z.infer<typeof registrationSchema>;
export type Password = z.infer<typeof passwordSchema>;
export type PasswordStrength = z.infer<typeof passwordStrengthSchema>;
export type EmailVerificationRequest = z.infer<typeof emailVerificationRequestSchema>;
export type EmailVerification = z.infer<typeof emailVerificationSchema>;
export type EmailChangeRequest = z.infer<typeof emailChangeRequestSchema>;
export type EmailChangeConfirmation = z.infer<typeof emailChangeConfirmationSchema>;
export type PasswordResetRequest = z.infer<typeof passwordResetRequestSchema>;
export type PasswordReset = z.infer<typeof passwordResetSchema>;
export type PasswordChange = z.infer<typeof passwordChangeSchema>;
export type TwoFactorSetup = z.infer<typeof twoFactorSetupSchema>;
export type TwoFactorVerification = z.infer<typeof twoFactorVerificationSchema>;
export type TwoFactorDisable = z.infer<typeof twoFactorDisableSchema>;
export type CreateSession = z.infer<typeof createSessionSchema>;
export type UpdateSession = z.infer<typeof updateSessionSchema>;
export type SessionValidation = z.infer<typeof sessionValidationSchema>;
export type TerminateSession = z.infer<typeof terminateSessionSchema>;
export type OAuthProvider = z.infer<typeof oauthProviderSchema>;
export type OAuthCallback = z.infer<typeof oauthCallbackSchema>;
export type OAuthLinking = z.infer<typeof oauthLinkingSchema>;
export type OAuthUnlinking = z.infer<typeof oauthUnlinkingSchema>;
export type DeviceRegistration = z.infer<typeof deviceRegistrationSchema>;
export type DeviceTrust = z.infer<typeof deviceTrustSchema>;
export type DeviceRevocation = z.infer<typeof deviceRevocationSchema>;
export type LoginAttempt = z.infer<typeof loginAttemptSchema>;
export type AccountLockout = z.infer<typeof accountLockoutSchema>;
export type SecurityAlert = z.infer<typeof securityAlertSchema>;
export type RateLimitConfig = z.infer<typeof rateLimitConfigSchema>;
export type RateLimitStatus = z.infer<typeof rateLimitStatusSchema>;
export type AuthAudit = z.infer<typeof authAuditSchema>;