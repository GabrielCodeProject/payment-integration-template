import { z } from 'zod';
import {
  cuidSchema,
  emailSchema,
  ipAddressSchema,
} from '../base/common';

/**
 * Rate Limiting Validation Schemas
 * 
 * Validation schemas for implementing rate limiting to prevent abuse,
 * brute force attacks, and ensure system stability.
 */

// =============================================================================
// RATE LIMIT CONFIGURATION
// =============================================================================

/**
 * Rate limit rule configuration
 */
export const rateLimitRuleSchema = z.object({
  id: cuidSchema,
  name: z.string().min(1, 'Rule name is required').max(100),
  description: z.string().max(500).optional(),
  
  // Target identification
  identifierType: z.enum([
    'ip_address',
    'user_id',
    'email',
    'api_key',
    'session_id',
    'device_fingerprint',
    'combined', // Multiple identifiers
  ]),
  
  // Rate limit configuration
  windowSize: z.number().int().min(1, 'Window size must be at least 1 second').max(86400, 'Window size cannot exceed 24 hours'), // seconds
  maxRequests: z.number().int().min(1, 'Max requests must be at least 1').max(10000, 'Max requests cannot exceed 10,000'),
  
  // Burst handling
  burstAllowance: z.number().int().min(0).max(1000).default(0), // Additional requests allowed in short bursts
  burstWindow: z.number().int().min(1).max(60).default(10), // seconds
  
  // Progressive penalties
  progressivePenalty: z.boolean().default(false),
  penaltyMultiplier: z.number().min(1).max(10).default(2),
  maxPenaltyDuration: z.number().int().min(60).max(86400).default(3600), // seconds
  
  // Scope and conditions
  endpoint: z.string().max(255).optional(), // Specific endpoint pattern
  method: z.enum(['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'ALL']).default('ALL'),
  userRole: z.enum(['CUSTOMER', 'ADMIN', 'SUPPORT', 'ALL']).default('ALL'),
  
  // Response configuration
  blockRequest: z.boolean().default(true), // Whether to block or just log
  customMessage: z.string().max(255).optional(),
  httpStatusCode: z.number().int().min(400).max(499).default(429),
  
  // Exemptions
  exemptUserIds: z.array(cuidSchema).default([]),
  exemptIpAddresses: z.array(ipAddressSchema).default([]),
  exemptApiKeys: z.array(z.string()).default([]),
  
  // Metadata
  isActive: z.boolean().default(true),
  priority: z.number().int().min(1).max(100).default(50), // Higher number = higher priority
  createdAt: z.date(),
  updatedAt: z.date(),
});

/**
 * Rate limit check request
 */
export const rateLimitCheckSchema = z.object({
  identifier: z.string().min(1, 'Identifier is required').max(255),
  identifierType: z.enum([
    'ip_address',
    'user_id',
    'email',
    'api_key',
    'session_id',
    'device_fingerprint',
  ]),
  
  // Request context
  endpoint: z.string().max(255),
  method: z.enum(['GET', 'POST', 'PUT', 'DELETE', 'PATCH']),
  userAgent: z.string().max(512).optional(),
  
  // Additional identifiers for combined rate limiting
  additionalIdentifiers: z.record(z.string()).optional(),
  
  // Request metadata
  requestSize: z.number().int().min(0).optional(), // bytes
  isAuthenticatedRequest: z.boolean().default(false),
  userRole: z.enum(['CUSTOMER', 'ADMIN', 'SUPPORT']).optional(),
  
  // Timestamp
  timestamp: z.date().default(() => new Date()),
});

/**
 * Rate limit status response
 */
export const rateLimitStatusSchema = z.object({
  identifier: z.string(),
  isAllowed: z.boolean(),
  currentRequests: z.number().int().min(0),
  maxRequests: z.number().int().min(1),
  windowStart: z.date(),
  windowEnd: z.date(),
  resetTime: z.date(),
  
  // Rate limit headers information
  headers: z.object({
    limit: z.number().int(),
    remaining: z.number().int(),
    reset: z.number().int(), // Unix timestamp
    retryAfter: z.number().int().optional(), // seconds
  }),
  
  // Violation information
  isViolation: z.boolean(),
  violationCount: z.number().int().min(0),
  penaltyLevel: z.number().int().min(0),
  blockDuration: z.number().int().min(0).optional(), // seconds
  
  // Applied rules
  appliedRules: z.array(z.object({
    ruleId: cuidSchema,
    ruleName: z.string(),
    triggered: z.boolean(),
  })),
});

// =============================================================================
// SPECIFIC RATE LIMIT TYPES
// =============================================================================

/**
 * Authentication rate limiting
 */
export const authRateLimitSchema = z.object({
  email: emailSchema,
  ipAddress: ipAddressSchema,
  action: z.enum([
    'login_attempt',
    'password_reset_request',
    'email_verification_request',
    'registration_attempt',
    'two_factor_attempt',
  ]),
  
  // Specific limits for auth actions
  limits: z.object({
    maxAttemptsPerHour: z.number().int().min(1).max(100).default(5),
    maxAttemptsPerDay: z.number().int().min(1).max(1000).default(20),
    lockoutDuration: z.number().int().min(60).max(86400).default(900), // 15 minutes default
    progressiveLockout: z.boolean().default(true),
  }),
  
  // Success rate consideration
  resetOnSuccess: z.boolean().default(true),
  successWeight: z.number().min(0).max(1).default(0.5), // Reduces violation count on success
});

/**
 * API rate limiting
 */
export const apiRateLimitSchema = z.object({
  apiKey: z.string().min(1, 'API key is required'),
  endpoint: z.string(),
  method: z.enum(['GET', 'POST', 'PUT', 'DELETE', 'PATCH']),
  
  // Tiered rate limits based on plan
  plan: z.enum(['free', 'basic', 'premium', 'enterprise']),
  limits: z.object({
    requestsPerMinute: z.number().int().min(1),
    requestsPerHour: z.number().int().min(1),
    requestsPerDay: z.number().int().min(1),
    burstLimit: z.number().int().min(0).default(0),
  }),
  
  // Request size limits
  maxRequestSize: z.number().int().min(1).default(1048576), // 1MB default
  maxResponseSize: z.number().int().min(1).default(10485760), // 10MB default
  
  // Quota management
  monthlyQuota: z.number().int().min(1).optional(),
  quotaUsed: z.number().int().min(0).default(0),
  quotaResetDate: z.date().optional(),
});

/**
 * Payment rate limiting (extra security for financial operations)
 */
export const paymentRateLimitSchema = z.object({
  userId: cuidSchema,
  paymentMethodId: cuidSchema.optional(),
  ipAddress: ipAddressSchema,
  deviceFingerprint: z.string().max(255).optional(),
  
  // Payment-specific limits
  limits: z.object({
    maxPaymentsPerHour: z.number().int().min(1).max(10).default(3),
    maxPaymentsPerDay: z.number().int().min(1).max(50).default(10),
    maxAmountPerHour: z.number().min(0).default(1000), // dollars
    maxAmountPerDay: z.number().min(0).default(5000), // dollars
    
    // Failed payment limits
    maxFailedPaymentsPerHour: z.number().int().min(1).max(5).default(2),
    maxFailedPaymentsPerDay: z.number().int().min(1).max(10).default(5),
  }),
  
  // Risk factors
  riskScore: z.number().min(0).max(100).default(0),
  isHighRisk: z.boolean().default(false),
  additionalVerificationRequired: z.boolean().default(false),
});

/**
 * Search and query rate limiting
 */
export const searchRateLimitSchema = z.object({
  identifier: z.string(),
  searchType: z.enum(['product_search', 'user_search', 'order_search', 'general_search']),
  
  // Search-specific limits
  limits: z.object({
    maxSearchesPerMinute: z.number().int().min(1).max(100).default(10),
    maxSearchesPerHour: z.number().int().min(1).max(1000).default(100),
    maxComplexQueries: z.number().int().min(1).max(10).default(5), // per hour
  }),
  
  // Query complexity factors
  queryComplexity: z.object({
    isComplexQuery: z.boolean().default(false),
    hasWildcards: z.boolean().default(false),
    hasMultipleFilters: z.boolean().default(false),
    hasSorting: z.boolean().default(false),
    expectedResultSize: z.enum(['small', 'medium', 'large']).default('medium'),
  }),
});

// =============================================================================
// RATE LIMIT VIOLATION HANDLING
// =============================================================================

/**
 * Rate limit violation record
 */
export const rateLimitViolationSchema = z.object({
  id: cuidSchema,
  identifier: z.string(),
  identifierType: z.string(),
  ruleId: cuidSchema,
  
  // Violation details
  violationType: z.enum(['rate_exceeded', 'burst_exceeded', 'quota_exceeded', 'suspicious_pattern']),
  violationCount: z.number().int().min(1),
  severity: z.enum(['low', 'medium', 'high', 'critical']),
  
  // Request context
  endpoint: z.string(),
  method: z.string(),
  ipAddress: ipAddressSchema,
  userAgent: z.string().optional(),
  
  // Response actions
  actionTaken: z.enum(['blocked', 'delayed', 'logged', 'captcha_required', 'manual_review']),
  blockDuration: z.number().int().min(0).optional(), // seconds
  penaltyLevel: z.number().int().min(0),
  
  // Metadata
  timestamp: z.date(),
  automaticResolution: z.boolean().default(true),
  resolvedAt: z.date().optional(),
  resolvedBy: cuidSchema.optional(),
  notes: z.string().max(1000).optional(),
});

/**
 * Rate limit bypass request
 */
export const rateLimitBypassSchema = z.object({
  identifier: z.string(),
  identifierType: z.string(),
  reason: z.enum(['testing', 'emergency', 'vip_customer', 'system_integration', 'other']),
  description: z.string().min(10, 'Description is required').max(500),
  
  // Bypass parameters
  bypassDuration: z.number().int().min(60).max(86400), // 1 minute to 24 hours
  bypassType: z.enum(['complete', 'increased_limit', 'specific_endpoint']),
  newLimit: z.number().int().min(1).optional(), // For increased_limit type
  allowedEndpoints: z.array(z.string()).optional(), // For specific_endpoint type
  
  // Authorization
  requestedBy: cuidSchema,
  approvedBy: cuidSchema.optional(),
  approvalReason: z.string().max(255).optional(),
  
  // Metadata
  isActive: z.boolean().default(true),
  createdAt: z.date(),
  expiresAt: z.date(),
});

// =============================================================================
// RATE LIMIT ANALYTICS
// =============================================================================

/**
 * Rate limit analytics query
 */
export const rateLimitAnalyticsSchema = z.object({
  timeRange: z.object({
    startDate: z.date(),
    endDate: z.date(),
  }),
  
  // Filters
  ruleIds: z.array(cuidSchema).optional(),
  identifierTypes: z.array(z.string()).optional(),
  violationTypes: z.array(z.string()).optional(),
  endpoints: z.array(z.string()).optional(),
  
  // Aggregation
  groupBy: z.enum(['hour', 'day', 'week', 'month', 'rule', 'endpoint', 'identifier_type']),
  metrics: z.array(z.enum([
    'total_requests',
    'blocked_requests',
    'violation_count',
    'unique_violators',
    'average_response_time',
    'peak_request_rate',
  ])).default(['total_requests', 'blocked_requests', 'violation_count']),
  
  // Output format
  includeTopViolators: z.boolean().default(true),
  topViolatorsLimit: z.number().int().min(1).max(100).default(10),
});

/**
 * Rate limit health metrics
 */
export const rateLimitHealthSchema = z.object({
  systemLoad: z.object({
    requestsPerSecond: z.number().min(0),
    averageResponseTime: z.number().min(0), // milliseconds
    errorRate: z.number().min(0).max(1), // percentage as decimal
  }),
  
  // Rule effectiveness
  ruleMetrics: z.array(z.object({
    ruleId: cuidSchema,
    ruleName: z.string(),
    triggeredCount: z.number().int().min(0),
    blockedCount: z.number().int().min(0),
    falsePositiveRate: z.number().min(0).max(1),
    effectiveness: z.number().min(0).max(100), // percentage
  })),
  
  // Top patterns
  topViolators: z.array(z.object({
    identifier: z.string(),
    violationCount: z.number().int().min(0),
    lastViolation: z.date(),
    risk: z.enum(['low', 'medium', 'high', 'critical']),
  })),
  
  // Recommendations
  recommendations: z.array(z.object({
    type: z.enum(['adjust_limits', 'add_rule', 'remove_rule', 'investigate_pattern']),
    priority: z.enum(['low', 'medium', 'high']),
    description: z.string(),
    affectedRules: z.array(cuidSchema).optional(),
  })),
  
  // Metadata
  generatedAt: z.date(),
  healthScore: z.number().min(0).max(100), // Overall system health
});

// =============================================================================
// TYPE EXPORTS
// =============================================================================

export type RateLimitRule = z.infer<typeof rateLimitRuleSchema>;
export type RateLimitCheck = z.infer<typeof rateLimitCheckSchema>;
export type RateLimitStatus = z.infer<typeof rateLimitStatusSchema>;
export type AuthRateLimit = z.infer<typeof authRateLimitSchema>;
export type ApiRateLimit = z.infer<typeof apiRateLimitSchema>;
export type PaymentRateLimit = z.infer<typeof paymentRateLimitSchema>;
export type SearchRateLimit = z.infer<typeof searchRateLimitSchema>;
export type RateLimitViolation = z.infer<typeof rateLimitViolationSchema>;
export type RateLimitBypass = z.infer<typeof rateLimitBypassSchema>;
export type RateLimitAnalytics = z.infer<typeof rateLimitAnalyticsSchema>;
export type RateLimitHealth = z.infer<typeof rateLimitHealthSchema>;