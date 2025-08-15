import { z } from 'zod';
import { cuidSchema } from '../base/common';

/**
 * Standardized Error Response Schemas
 * 
 * Type-safe error handling with consistent error responses
 * across the entire payment integration template.
 */

// =============================================================================
// BASE ERROR SCHEMAS
// =============================================================================

/**
 * Base error schema for all error responses
 */
export const baseErrorSchema = z.object({
  success: z.literal(false),
  error: z.object({
    code: z.string(),
    message: z.string(),
    type: z.enum([
      'VALIDATION_ERROR',
      'BUSINESS_LOGIC_ERROR',
      'AUTHENTICATION_ERROR',
      'AUTHORIZATION_ERROR',
      'NOT_FOUND_ERROR',
      'CONFLICT_ERROR',
      'RATE_LIMIT_ERROR',
      'PAYMENT_ERROR',
      'SYSTEM_ERROR',
      'EXTERNAL_SERVICE_ERROR',
      'SECURITY_ERROR',
      'COMPLIANCE_ERROR',
    ]),
    timestamp: z.date().default(() => new Date()),
    requestId: z.string().optional(),
    correlationId: z.string().optional(),
  }),
  details: z.record(z.unknown()).optional(),
  meta: z.object({
    statusCode: z.number().int().min(400).max(599),
    retryable: z.boolean().default(false),
    retryAfter: z.number().optional(), // seconds
    documentation: z.string().url().optional(),
  }),
});

/**
 * Success response schema
 */
export const baseSuccessSchema = z.object({
  success: z.literal(true),
  data: z.record(z.unknown()),
  message: z.string().optional(),
  meta: z.object({
    statusCode: z.number().int().min(200).max(299).default(200),
    timestamp: z.date().default(() => new Date()),
    requestId: z.string().optional(),
    version: z.string().optional(),
  }).optional(),
});

// =============================================================================
// VALIDATION ERROR SCHEMAS
// =============================================================================

/**
 * Validation error with field-specific details
 */
export const validationErrorSchema = baseErrorSchema.extend({
  error: baseErrorSchema.shape.error.extend({
    type: z.literal('VALIDATION_ERROR'),
    code: z.enum([
      'INVALID_INPUT',
      'MISSING_REQUIRED_FIELD',
      'INVALID_FORMAT',
      'OUT_OF_RANGE',
      'INVALID_TYPE',
      'CONSTRAINT_VIOLATION',
      'CROSS_FIELD_VALIDATION_FAILED',
    ]),
  }),
  validationErrors: z.array(z.object({
    field: z.string(),
    value: z.unknown().optional(),
    message: z.string(),
    code: z.string(),
    path: z.array(z.union([z.string(), z.number()])),
  })),
});

/**
 * Schema validation error (for Zod schema failures)
 */
export const schemaValidationErrorSchema = validationErrorSchema.extend({
  error: validationErrorSchema.shape.error.extend({
    code: z.literal('SCHEMA_VALIDATION_FAILED'),
  }),
  schemaPath: z.string(),
  expectedType: z.string().optional(),
  receivedType: z.string().optional(),
});

// =============================================================================
// BUSINESS LOGIC ERROR SCHEMAS
// =============================================================================

/**
 * Business logic error
 */
export const businessLogicErrorSchema = baseErrorSchema.extend({
  error: baseErrorSchema.shape.error.extend({
    type: z.literal('BUSINESS_LOGIC_ERROR'),
    code: z.enum([
      'INSUFFICIENT_FUNDS',
      'INVENTORY_UNAVAILABLE',
      'ORDER_ALREADY_PROCESSED',
      'SUBSCRIPTION_ALREADY_ACTIVE',
      'DISCOUNT_NOT_APPLICABLE',
      'PAYMENT_METHOD_DECLINED',
      'USER_ACCOUNT_RESTRICTED',
      'OPERATION_NOT_ALLOWED',
      'BUSINESS_RULE_VIOLATION',
      'WORKFLOW_STATE_INVALID',
    ]),
  }),
  businessContext: z.record(z.unknown()).optional(),
});

// =============================================================================
// AUTHENTICATION & AUTHORIZATION ERROR SCHEMAS
// =============================================================================

/**
 * Authentication error
 */
export const authenticationErrorSchema = baseErrorSchema.extend({
  error: baseErrorSchema.shape.error.extend({
    type: z.literal('AUTHENTICATION_ERROR'),
    code: z.enum([
      'INVALID_CREDENTIALS',
      'TOKEN_EXPIRED',
      'TOKEN_INVALID',
      'SESSION_EXPIRED',
      'MFA_REQUIRED',
      'ACCOUNT_LOCKED',
      'ACCOUNT_DISABLED',
      'EMAIL_NOT_VERIFIED',
    ]),
  }),
  authContext: z.object({
    requiresMFA: z.boolean().optional(),
    lockoutExpires: z.date().optional(),
    attemptsRemaining: z.number().int().min(0).optional(),
  }).optional(),
});

/**
 * Authorization error
 */
export const authorizationErrorSchema = baseErrorSchema.extend({
  error: baseErrorSchema.shape.error.extend({
    type: z.literal('AUTHORIZATION_ERROR'),
    code: z.enum([
      'INSUFFICIENT_PERMISSIONS',
      'RESOURCE_ACCESS_DENIED',
      'ROLE_REQUIRED',
      'SCOPE_INSUFFICIENT',
      'OPERATION_FORBIDDEN',
      'RESOURCE_OWNERSHIP_REQUIRED',
    ]),
  }),
  requiredPermissions: z.array(z.string()).optional(),
  userPermissions: z.array(z.string()).optional(),
});

// =============================================================================
// RESOURCE ERROR SCHEMAS
// =============================================================================

/**
 * Not found error
 */
export const notFoundErrorSchema = baseErrorSchema.extend({
  error: baseErrorSchema.shape.error.extend({
    type: z.literal('NOT_FOUND_ERROR'),
    code: z.enum([
      'RESOURCE_NOT_FOUND',
      'USER_NOT_FOUND',
      'ORDER_NOT_FOUND',
      'PRODUCT_NOT_FOUND',
      'PAYMENT_METHOD_NOT_FOUND',
      'SUBSCRIPTION_NOT_FOUND',
      'ENDPOINT_NOT_FOUND',
    ]),
  }),
  resourceType: z.string().optional(),
  resourceId: z.string().optional(),
});

/**
 * Conflict error
 */
export const conflictErrorSchema = baseErrorSchema.extend({
  error: baseErrorSchema.shape.error.extend({
    type: z.literal('CONFLICT_ERROR'),
    code: z.enum([
      'RESOURCE_ALREADY_EXISTS',
      'DUPLICATE_EMAIL',
      'DUPLICATE_SKU',
      'CONCURRENT_MODIFICATION',
      'STATE_CONFLICT',
      'VERSION_MISMATCH',
    ]),
  }),
  conflictingResource: z.object({
    type: z.string(),
    id: z.string(),
    field: z.string().optional(),
  }).optional(),
});

// =============================================================================
// RATE LIMITING ERROR SCHEMAS
// =============================================================================

/**
 * Rate limit error
 */
export const rateLimitErrorSchema = baseErrorSchema.extend({
  error: baseErrorSchema.shape.error.extend({
    type: z.literal('RATE_LIMIT_ERROR'),
    code: z.enum([
      'RATE_LIMIT_EXCEEDED',
      'QUOTA_EXCEEDED',
      'VELOCITY_LIMIT_EXCEEDED',
      'CONCURRENT_REQUESTS_EXCEEDED',
    ]),
  }),
  rateLimit: z.object({
    limit: z.number().int(),
    remaining: z.number().int(),
    resetTime: z.date(),
    window: z.number().int(), // seconds
  }),
});

// =============================================================================
// PAYMENT ERROR SCHEMAS
// =============================================================================

/**
 * Payment processing error
 */
export const paymentErrorSchema = baseErrorSchema.extend({
  error: baseErrorSchema.shape.error.extend({
    type: z.literal('PAYMENT_ERROR'),
    code: z.enum([
      'PAYMENT_DECLINED',
      'INSUFFICIENT_FUNDS',
      'CARD_EXPIRED',
      'INVALID_CARD',
      'PROCESSING_ERROR',
      'GATEWAY_ERROR',
      'FRAUD_DETECTED',
      'AUTHENTICATION_REQUIRED',
      'CURRENCY_NOT_SUPPORTED',
      'AMOUNT_TOO_SMALL',
      'AMOUNT_TOO_LARGE',
    ]),
  }),
  paymentContext: z.object({
    declineCode: z.string().optional(),
    networkStatus: z.string().optional(),
    nextAction: z.object({
      type: z.string(),
      data: z.record(z.unknown()),
    }).optional(),
  }).optional(),
});

// =============================================================================
// SYSTEM ERROR SCHEMAS
// =============================================================================

/**
 * System/Internal error
 */
export const systemErrorSchema = baseErrorSchema.extend({
  error: baseErrorSchema.shape.error.extend({
    type: z.literal('SYSTEM_ERROR'),
    code: z.enum([
      'INTERNAL_SERVER_ERROR',
      'DATABASE_ERROR',
      'CONFIGURATION_ERROR',
      'SERVICE_UNAVAILABLE',
      'TIMEOUT_ERROR',
      'MEMORY_ERROR',
      'DISK_SPACE_ERROR',
    ]),
  }),
  systemContext: z.object({
    service: z.string().optional(),
    component: z.string().optional(),
    operation: z.string().optional(),
    errorId: cuidSchema.optional(),
  }).optional(),
});

/**
 * External service error
 */
export const externalServiceErrorSchema = baseErrorSchema.extend({
  error: baseErrorSchema.shape.error.extend({
    type: z.literal('EXTERNAL_SERVICE_ERROR'),
    code: z.enum([
      'STRIPE_API_ERROR',
      'EMAIL_SERVICE_ERROR',
      'SMS_SERVICE_ERROR',
      'THIRD_PARTY_API_ERROR',
      'WEBHOOK_DELIVERY_FAILED',
      'EXTERNAL_TIMEOUT',
    ]),
  }),
  serviceContext: z.object({
    serviceName: z.string(),
    endpoint: z.string().optional(),
    httpStatus: z.number().int().optional(),
    serviceErrorCode: z.string().optional(),
    retryCount: z.number().int().min(0).optional(),
  }),
});

// =============================================================================
// SECURITY ERROR SCHEMAS
// =============================================================================

/**
 * Security-related error
 */
export const securityErrorSchema = baseErrorSchema.extend({
  error: baseErrorSchema.shape.error.extend({
    type: z.literal('SECURITY_ERROR'),
    code: z.enum([
      'SUSPICIOUS_ACTIVITY_DETECTED',
      'IP_BLOCKED',
      'INVALID_SIGNATURE',
      'ENCRYPTION_ERROR',
      'SECURITY_POLICY_VIOLATION',
      'MALICIOUS_REQUEST_DETECTED',
      'GEOLOCATION_RESTRICTED',
    ]),
  }),
  securityContext: z.object({
    riskScore: z.number().min(0).max(100).optional(),
    riskFactors: z.array(z.string()).optional(),
    blockedUntil: z.date().optional(),
    requiresVerification: z.boolean().optional(),
  }).optional(),
});

/**
 * Compliance error
 */
export const complianceErrorSchema = baseErrorSchema.extend({
  error: baseErrorSchema.shape.error.extend({
    type: z.literal('COMPLIANCE_ERROR'),
    code: z.enum([
      'PCI_COMPLIANCE_VIOLATION',
      'GDPR_VIOLATION',
      'DATA_RETENTION_VIOLATION',
      'AUDIT_REQUIREMENT_FAILED',
      'REGULATORY_RESTRICTION',
    ]),
  }),
  complianceContext: z.object({
    regulation: z.string(),
    requirement: z.string(),
    remediation: z.string().optional(),
  }).optional(),
});

// =============================================================================
// RESPONSE UNION TYPES
// =============================================================================

/**
 * All possible error response types
 */
export const errorResponseSchema = z.union([
  validationErrorSchema,
  schemaValidationErrorSchema,
  businessLogicErrorSchema,
  authenticationErrorSchema,
  authorizationErrorSchema,
  notFoundErrorSchema,
  conflictErrorSchema,
  rateLimitErrorSchema,
  paymentErrorSchema,
  systemErrorSchema,
  externalServiceErrorSchema,
  securityErrorSchema,
  complianceErrorSchema,
]);

/**
 * API response schema (success or error)
 */
export const apiResponseSchema = z.union([
  baseSuccessSchema,
  errorResponseSchema,
]);

// =============================================================================
// ERROR HELPER FUNCTIONS
// =============================================================================

/**
 * Error builder functions for type-safe error creation
 */
export const createValidationError = (
  message: string,
  code: z.infer<typeof validationErrorSchema>['error']['code'],
  validationErrors: z.infer<typeof validationErrorSchema>['validationErrors'],
  statusCode = 400
) => ({
  success: false as const,
  error: {
    code,
    message,
    type: 'VALIDATION_ERROR' as const,
    timestamp: new Date(),
  },
  validationErrors,
  meta: {
    statusCode,
    retryable: false,
  },
});

export const createBusinessLogicError = (
  message: string,
  code: z.infer<typeof businessLogicErrorSchema>['error']['code'],
  businessContext?: Record<string, unknown>,
  statusCode = 422
) => ({
  success: false as const,
  error: {
    code,
    message,
    type: 'BUSINESS_LOGIC_ERROR' as const,
    timestamp: new Date(),
  },
  businessContext,
  meta: {
    statusCode,
    retryable: false,
  },
});

export const createPaymentError = (
  message: string,
  code: z.infer<typeof paymentErrorSchema>['error']['code'],
  paymentContext?: z.infer<typeof paymentErrorSchema>['paymentContext'],
  statusCode = 402
) => ({
  success: false as const,
  error: {
    code,
    message,
    type: 'PAYMENT_ERROR' as const,
    timestamp: new Date(),
  },
  paymentContext,
  meta: {
    statusCode,
    retryable: ['PROCESSING_ERROR', 'GATEWAY_ERROR', 'TIMEOUT_ERROR'].includes(code),
  },
});

export const createSuccess = <T>(
  data: T,
  message?: string,
  statusCode = 200
) => ({
  success: true as const,
  data,
  message,
  meta: {
    statusCode,
    timestamp: new Date(),
  },
});

// =============================================================================
// TYPE EXPORTS
// =============================================================================

export type BaseError = z.infer<typeof baseErrorSchema>;
export type BaseSuccess = z.infer<typeof baseSuccessSchema>;
export type ValidationError = z.infer<typeof validationErrorSchema>;
export type SchemaValidationError = z.infer<typeof schemaValidationErrorSchema>;
export type BusinessLogicError = z.infer<typeof businessLogicErrorSchema>;
export type AuthenticationError = z.infer<typeof authenticationErrorSchema>;
export type AuthorizationError = z.infer<typeof authorizationErrorSchema>;
export type NotFoundError = z.infer<typeof notFoundErrorSchema>;
export type ConflictError = z.infer<typeof conflictErrorSchema>;
export type RateLimitError = z.infer<typeof rateLimitErrorSchema>;
export type PaymentError = z.infer<typeof paymentErrorSchema>;
export type SystemError = z.infer<typeof systemErrorSchema>;
export type ExternalServiceError = z.infer<typeof externalServiceErrorSchema>;
export type SecurityError = z.infer<typeof securityErrorSchema>;
export type ComplianceError = z.infer<typeof complianceErrorSchema>;
export type ErrorResponse = z.infer<typeof errorResponseSchema>;
export type ApiResponse = z.infer<typeof apiResponseSchema>;