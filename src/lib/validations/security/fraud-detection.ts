import { z } from 'zod';
import {
  cuidSchema,
  emailSchema,
  ipAddressSchema,
  userAgentSchema,
  priceSchema,
  currencySchema,
  addressSchema,
} from '../base/common';

/**
 * Fraud Detection Validation Schemas
 * 
 * Validation schemas for fraud detection, risk assessment,
 * and suspicious activity monitoring in payment systems.
 */

// =============================================================================
// RISK ASSESSMENT SCHEMAS
// =============================================================================

/**
 * Risk score calculation input
 */
export const riskAssessmentInputSchema = z.object({
  // Transaction details
  amount: priceSchema,
  currency: currencySchema,
  paymentMethodId: cuidSchema.optional(),
  
  // User context
  userId: cuidSchema.optional(),
  email: emailSchema.optional(),
  isNewUser: z.boolean().default(false),
  accountAge: z.number().int().min(0).optional(), // days
  
  // Device and location
  ipAddress: ipAddressSchema,
  userAgent: userAgentSchema,
  deviceFingerprint: z.string().max(255).optional(),
  billingAddress: addressSchema.optional(),
  shippingAddress: addressSchema.optional(),
  
  // Behavioral patterns
  isFirstPurchase: z.boolean().default(false),
  timeOfDay: z.number().int().min(0).max(23), // hour in 24h format
  dayOfWeek: z.number().int().min(0).max(6), // 0 = Sunday
  
  // Historical context
  previousFailedAttempts: z.number().int().min(0).default(0),
  recentTransactionCount: z.number().int().min(0).default(0),
  averageTransactionAmount: z.number().min(0).optional(),
  
  // Velocity checks
  transactionsInLastHour: z.number().int().min(0).default(0),
  transactionsInLastDay: z.number().int().min(0).default(0),
  amountInLastHour: z.number().min(0).default(0),
  amountInLastDay: z.number().min(0).default(0),
});

/**
 * Risk score result
 */
export const riskScoreResultSchema = z.object({
  overallScore: z.number().min(0).max(100),
  riskLevel: z.enum(['very_low', 'low', 'medium', 'high', 'very_high']),
  recommendation: z.enum(['approve', 'review', 'challenge', 'decline']),
  
  // Component scores
  scores: z.object({
    amountRisk: z.number().min(0).max(100),
    locationRisk: z.number().min(0).max(100),
    deviceRisk: z.number().min(0).max(100),
    behaviorRisk: z.number().min(0).max(100),
    velocityRisk: z.number().min(0).max(100),
    patternRisk: z.number().min(0).max(100),
  }),
  
  // Risk factors
  riskFactors: z.array(z.object({
    factor: z.string(),
    weight: z.number().min(0).max(1),
    description: z.string(),
    severity: z.enum(['low', 'medium', 'high', 'critical']),
  })),
  
  // Recommended actions
  suggestedActions: z.array(z.enum([
    'require_3ds',
    'manual_review',
    'additional_verification',
    'decline_transaction',
    'flag_for_monitoring',
    'request_documents',
  ])),
  
  // Metadata
  modelVersion: z.string(),
  calculatedAt: z.date(),
  expiresAt: z.date(),
});

// =============================================================================
// FRAUD DETECTION RULES
// =============================================================================

/**
 * Fraud detection rule configuration
 */
export const fraudDetectionRuleSchema = z.object({
  id: cuidSchema,
  name: z.string().min(1).max(100),
  description: z.string().max(500),
  
  // Rule type and configuration
  ruleType: z.enum([
    'velocity_check',
    'amount_threshold',
    'location_mismatch',
    'device_anomaly',
    'pattern_recognition',
    'blacklist_check',
    'behavioral_analysis',
    'machine_learning',
  ]),
  
  // Rule parameters
  parameters: z.object({
    thresholds: z.record(z.number()).default({}),
    timeWindows: z.record(z.number()).default({}), // in seconds
    patterns: z.array(z.string()).default([]),
    whitelist: z.array(z.string()).default([]),
    blacklist: z.array(z.string()).default([]),
  }),
  
  // Rule evaluation
  weight: z.number().min(0).max(1), // Impact on overall risk score
  severity: z.enum(['low', 'medium', 'high', 'critical']),
  action: z.enum(['flag', 'challenge', 'block', 'review']),
  
  // Conditions
  conditions: z.object({
    minAmount: z.number().min(0).optional(),
    maxAmount: z.number().min(0).optional(),
    currencies: z.array(z.string()).optional(),
    countries: z.array(z.string()).optional(),
    userTypes: z.array(z.string()).optional(),
    paymentMethods: z.array(z.string()).optional(),
  }),
  
  // Rule metadata
  isActive: z.boolean().default(true),
  priority: z.number().int().min(1).max(100).default(50),
  createdAt: z.date(),
  updatedAt: z.date(),
  lastTriggered: z.date().optional(),
  triggerCount: z.number().int().min(0).default(0),
});

/**
 * Rule execution result
 */
export const ruleExecutionResultSchema = z.object({
  ruleId: cuidSchema,
  ruleName: z.string(),
  triggered: z.boolean(),
  score: z.number().min(0).max(100),
  severity: z.enum(['low', 'medium', 'high', 'critical']),
  
  // Execution details
  matchedConditions: z.array(z.string()).default([]),
  calculatedValues: z.record(z.unknown()).default({}),
  threshold: z.number().optional(),
  actualValue: z.number().optional(),
  
  // Actions
  recommendedAction: z.enum(['approve', 'flag', 'challenge', 'block', 'review']),
  confidence: z.number().min(0).max(1),
  
  // Metadata
  executionTime: z.number().min(0), // milliseconds
  version: z.string(),
});

// =============================================================================
// SUSPICIOUS ACTIVITY DETECTION
// =============================================================================

/**
 * Suspicious activity pattern
 */
export const suspiciousActivityPatternSchema = z.object({
  id: cuidSchema,
  name: z.string().min(1).max(100),
  description: z.string().max(500),
  
  // Pattern definition
  patternType: z.enum([
    'rapid_fire_transactions',
    'amount_cycling',
    'card_testing',
    'account_takeover',
    'synthetic_identity',
    'refund_abuse',
    'chargeback_pattern',
    'bot_behavior',
  ]),
  
  // Detection criteria
  criteria: z.object({
    timeWindow: z.number().int().min(60), // seconds
    minOccurrences: z.number().int().min(1),
    maxOccurrences: z.number().int().optional(),
    amountThreshold: z.number().min(0).optional(),
    successRateThreshold: z.number().min(0).max(1).optional(),
    uniqueFields: z.array(z.string()).default([]), // Fields that should be unique
  }),
  
  // Aggregation rules
  aggregateBy: z.array(z.enum([
    'user_id',
    'email',
    'ip_address',
    'payment_method',
    'device_fingerprint',
    'billing_address',
  ])),
  
  // Response configuration
  alertThreshold: z.number().min(0).max(100),
  autoBlock: z.boolean().default(false),
  requiresManualReview: z.boolean().default(true),
  
  // Metadata
  isActive: z.boolean().default(true),
  sensitivity: z.enum(['low', 'medium', 'high']),
  falsePositiveRate: z.number().min(0).max(1).optional(),
  lastUpdated: z.date(),
});

/**
 * Suspicious activity alert
 */
export const suspiciousActivityAlertSchema = z.object({
  id: cuidSchema,
  patternId: cuidSchema,
  patternName: z.string(),
  
  // Alert details
  severity: z.enum(['low', 'medium', 'high', 'critical']),
  confidenceScore: z.number().min(0).max(100),
  riskScore: z.number().min(0).max(100),
  
  // Affected entities
  affectedUsers: z.array(cuidSchema).default([]),
  affectedTransactions: z.array(cuidSchema).default([]),
  affectedPaymentMethods: z.array(cuidSchema).default([]),
  
  // Pattern details
  detectedPattern: z.object({
    occurrences: z.number().int().min(1),
    timeWindow: z.number().int().min(60),
    aggregatedBy: z.string(),
    suspiciousValues: z.array(z.string()).default([]),
  }),
  
  // Investigation status
  status: z.enum(['new', 'investigating', 'confirmed', 'false_positive', 'resolved']),
  assignedTo: cuidSchema.optional(),
  investigationNotes: z.string().max(2000).optional(),
  
  // Actions taken
  actionsTaken: z.array(z.enum([
    'account_suspended',
    'payment_method_blocked',
    'manual_review_required',
    'additional_verification',
    'transaction_reversed',
    'alert_dismissed',
  ])).default([]),
  
  // Timestamps
  detectedAt: z.date(),
  firstOccurrence: z.date(),
  lastOccurrence: z.date(),
  resolvedAt: z.date().optional(),
});

// =============================================================================
// BLACKLIST MANAGEMENT
// =============================================================================

/**
 * Blacklist entry
 */
export const blacklistEntrySchema = z.object({
  id: cuidSchema,
  type: z.enum([
    'email',
    'ip_address',
    'phone_number',
    'credit_card_bin',
    'device_fingerprint',
    'user_agent',
    'billing_address',
    'shipping_address',
  ]),
  
  // Entry details
  value: z.string().min(1).max(255),
  pattern: z.string().max(255).optional(), // For regex patterns
  isPattern: z.boolean().default(false),
  
  // Blacklist metadata
  reason: z.enum([
    'fraud_confirmed',
    'chargeback_abuse',
    'policy_violation',
    'suspicious_activity',
    'manual_review',
    'third_party_data',
  ]),
  description: z.string().max(500).optional(),
  severity: z.enum(['low', 'medium', 'high', 'critical']),
  
  // Scope and conditions
  scope: z.enum(['global', 'region', 'country', 'specific']),
  countries: z.array(z.string()).optional(),
  paymentMethods: z.array(z.string()).optional(),
  
  // Expiration
  expiresAt: z.date().optional(),
  isTemporary: z.boolean().default(false),
  
  // Audit trail
  addedBy: cuidSchema,
  addedAt: z.date(),
  lastModified: z.date(),
  modifiedBy: cuidSchema.optional(),
  
  // Status
  isActive: z.boolean().default(true),
  hitCount: z.number().int().min(0).default(0),
  lastHit: z.date().optional(),
});

/**
 * Whitelist entry (for trusted entities)
 */
export const whitelistEntrySchema = z.object({
  id: cuidSchema,
  type: z.enum([
    'email',
    'ip_address',
    'user_id',
    'payment_method',
    'device_fingerprint',
  ]),
  
  // Entry details
  value: z.string().min(1).max(255),
  description: z.string().max(500).optional(),
  
  // Trust level
  trustLevel: z.enum(['low', 'medium', 'high', 'absolute']),
  bypassRules: z.array(cuidSchema).default([]), // Rule IDs to bypass
  
  // Scope
  scope: z.enum(['all_transactions', 'specific_amounts', 'specific_countries']),
  maxAmount: z.number().min(0).optional(),
  allowedCountries: z.array(z.string()).optional(),
  
  // Expiration
  expiresAt: z.date().optional(),
  
  // Audit trail
  addedBy: cuidSchema,
  addedAt: z.date(),
  lastModified: z.date(),
  
  // Status
  isActive: z.boolean().default(true),
  hitCount: z.number().int().min(0).default(0),
  lastHit: z.date().optional(),
});

// =============================================================================
// MACHINE LEARNING FEATURES
// =============================================================================

/**
 * ML feature extraction for fraud detection
 */
export const mlFeatureExtractionSchema = z.object({
  // Transaction features
  transactionFeatures: z.object({
    amount: z.number(),
    amountZScore: z.number(), // Relative to user's history
    hourOfDay: z.number().int().min(0).max(23),
    dayOfWeek: z.number().int().min(0).max(6),
    isWeekend: z.boolean(),
    currencyCode: z.string().length(3),
  }),
  
  // User behavior features
  userFeatures: z.object({
    accountAge: z.number().int().min(0), // days
    totalTransactions: z.number().int().min(0),
    avgTransactionAmount: z.number().min(0),
    failureRate: z.number().min(0).max(1),
    isFirstTransaction: z.boolean(),
    daysSinceLastTransaction: z.number().min(0),
  }),
  
  // Device and location features
  deviceFeatures: z.object({
    isNewDevice: z.boolean(),
    isNewLocation: z.boolean(),
    locationRisk: z.number().min(0).max(1),
    deviceRisk: z.number().min(0).max(1),
    ipReputation: z.number().min(0).max(1),
  }),
  
  // Velocity features
  velocityFeatures: z.object({
    transactionsLast1Hour: z.number().int().min(0),
    transactionsLast24Hours: z.number().int().min(0),
    amountLast1Hour: z.number().min(0),
    amountLast24Hours: z.number().min(0),
    uniqueCardsLast1Hour: z.number().int().min(0),
  }),
  
  // Pattern features
  patternFeatures: z.object({
    roundAmountScore: z.number().min(0).max(1),
    sequentialAmountScore: z.number().min(0).max(1),
    addressMismatchScore: z.number().min(0).max(1),
    emailDomainRisk: z.number().min(0).max(1),
  }),
});

/**
 * ML model prediction result
 */
export const mlPredictionResultSchema = z.object({
  modelId: z.string(),
  modelVersion: z.string(),
  predictionId: cuidSchema,
  
  // Prediction results
  fraudProbability: z.number().min(0).max(1),
  riskScore: z.number().min(0).max(100),
  confidence: z.number().min(0).max(1),
  
  // Feature importance
  featureImportance: z.array(z.object({
    feature: z.string(),
    importance: z.number().min(0).max(1),
    value: z.number(),
  })),
  
  // Explanation
  explanation: z.object({
    topRiskFactors: z.array(z.string()),
    reasoning: z.string().max(500),
    similarCases: z.array(cuidSchema).default([]),
  }),
  
  // Performance metrics
  modelPerformance: z.object({
    accuracy: z.number().min(0).max(1),
    precision: z.number().min(0).max(1),
    recall: z.number().min(0).max(1),
    f1Score: z.number().min(0).max(1),
  }),
  
  // Metadata
  processedAt: z.date(),
  processingTime: z.number().min(0), // milliseconds
});

// =============================================================================
// TYPE EXPORTS
// =============================================================================

export type RiskAssessmentInput = z.infer<typeof riskAssessmentInputSchema>;
export type RiskScoreResult = z.infer<typeof riskScoreResultSchema>;
export type FraudDetectionRule = z.infer<typeof fraudDetectionRuleSchema>;
export type RuleExecutionResult = z.infer<typeof ruleExecutionResultSchema>;
export type SuspiciousActivityPattern = z.infer<typeof suspiciousActivityPatternSchema>;
export type SuspiciousActivityAlert = z.infer<typeof suspiciousActivityAlertSchema>;
export type BlacklistEntry = z.infer<typeof blacklistEntrySchema>;
export type WhitelistEntry = z.infer<typeof whitelistEntrySchema>;
export type MLFeatureExtraction = z.infer<typeof mlFeatureExtractionSchema>;
export type MLPredictionResult = z.infer<typeof mlPredictionResultSchema>;