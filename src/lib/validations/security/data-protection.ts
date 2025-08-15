import { z } from 'zod';
import { cuidSchema, emailSchema } from '../base/common';

/**
 * Data Protection Validation Schemas
 * 
 * Validation schemas for GDPR compliance, data privacy,
 * and sensitive data handling requirements.
 */

// =============================================================================
// GDPR COMPLIANCE SCHEMAS
// =============================================================================

/**
 * Data subject rights request
 */
export const dataSubjectRightsSchema = z.object({
  requestId: cuidSchema,
  requestType: z.enum([
    'access', // Right to access
    'rectification', // Right to rectification
    'erasure', // Right to erasure (right to be forgotten)
    'portability', // Right to data portability
    'restriction', // Right to restriction of processing
    'objection', // Right to object
    'withdraw_consent', // Right to withdraw consent
  ]),
  
  // Subject identification
  subjectId: cuidSchema.optional(),
  subjectEmail: emailSchema,
  subjectName: z.string().max(255).optional(),
  
  // Request details
  description: z.string().max(1000),
  legalBasis: z.enum([
    'consent',
    'contract',
    'legal_obligation',
    'vital_interests',
    'public_task',
    'legitimate_interests',
  ]).optional(),
  
  // Verification
  identityVerified: z.boolean().default(false),
  verificationMethod: z.enum([
    'email_verification',
    'document_verification',
    'multi_factor_auth',
    'manual_verification',
  ]).optional(),
  
  // Processing
  status: z.enum([
    'submitted',
    'under_review',
    'identity_verification_required',
    'in_progress',
    'completed',
    'rejected',
    'partially_fulfilled',
  ]).default('submitted'),
  
  // Timeline
  submittedAt: z.date(),
  dueDate: z.date(), // Must be within 30 days
  completedAt: z.date().optional(),
  
  // Processing details
  processedBy: cuidSchema.optional(),
  processingNotes: z.string().max(2000).optional(),
  rejectionReason: z.string().max(500).optional(),
});

/**
 * Consent management
 */
export const consentRecordSchema = z.object({
  id: cuidSchema,
  userId: cuidSchema,
  
  // Consent details
  purpose: z.enum([
    'marketing_emails',
    'promotional_sms',
    'analytics_tracking',
    'personalization',
    'third_party_sharing',
    'data_processing',
    'cookies_functional',
    'cookies_analytics',
    'cookies_advertising',
  ]),
  
  // Consent status
  status: z.enum(['given', 'withdrawn', 'expired']),
  consentGiven: z.boolean(),
  
  // Legal basis
  legalBasis: z.enum([
    'consent',
    'contract',
    'legal_obligation',
    'vital_interests',
    'public_task',
    'legitimate_interests',
  ]),
  
  // Consent metadata
  consentText: z.string().max(2000), // Exact text shown to user
  version: z.string().max(50), // Version of consent text
  language: z.string().length(2), // ISO 639-1 language code
  
  // Withdrawal
  withdrawalMethod: z.enum([
    'user_request',
    'automatic_expiry',
    'admin_action',
    'system_cleanup',
  ]).optional(),
  withdrawalReason: z.string().max(500).optional(),
  
  // Timestamps
  givenAt: z.date(),
  expiresAt: z.date().optional(),
  withdrawnAt: z.date().optional(),
  lastModified: z.date(),
  
  // Audit trail
  ipAddress: z.string().max(45).optional(),
  userAgent: z.string().max(500).optional(),
  source: z.enum(['website', 'mobile_app', 'email', 'phone', 'paper']),
});

/**
 * Data retention policy
 */
export const dataRetentionPolicySchema = z.object({
  id: cuidSchema,
  name: z.string().min(1).max(100),
  description: z.string().max(500),
  
  // Scope
  dataCategory: z.enum([
    'user_profiles',
    'transaction_data',
    'payment_methods',
    'communication_logs',
    'analytics_data',
    'audit_logs',
    'session_data',
    'temporary_files',
  ]),
  
  // Retention rules
  retentionPeriod: z.object({
    duration: z.number().int().min(0), // days
    basis: z.enum([
      'legal_requirement',
      'business_need',
      'user_consent',
      'contract_duration',
      'statute_of_limitations',
    ]),
  }),
  
  // Actions after retention period
  actionAfterRetention: z.enum([
    'delete_permanently',
    'anonymize',
    'archive_encrypted',
    'transfer_to_archive',
    'manual_review',
  ]),
  
  // Exceptions
  exceptions: z.array(z.object({
    condition: z.string().max(255),
    extendedPeriod: z.number().int().min(0), // additional days
    reason: z.string().max(255),
  })).default([]),
  
  // Geographic scope
  applicableRegions: z.array(z.string()).default(['global']), // ISO country codes
  
  // Metadata
  isActive: z.boolean().default(true),
  lastReviewed: z.date(),
  nextReview: z.date(),
  createdBy: cuidSchema,
  approvedBy: cuidSchema.optional(),
});

// =============================================================================
// DATA CLASSIFICATION SCHEMAS
// =============================================================================

/**
 * Data classification
 */
export const dataClassificationSchema = z.object({
  id: cuidSchema,
  dataType: z.string().max(100),
  
  // Classification levels
  sensitivityLevel: z.enum([
    'public',
    'internal',
    'confidential',
    'restricted',
    'top_secret',
  ]),
  
  // Data categories
  personalDataType: z.enum([
    'none',
    'basic_personal', // Name, email, etc.
    'sensitive_personal', // Health, religion, etc.
    'financial', // Payment info, bank details
    'biometric', // Fingerprints, facial recognition
    'location', // GPS coordinates, addresses
    'behavioral', // Browsing history, preferences
  ]),
  
  // Regulatory classification
  regulatoryCategory: z.array(z.enum([
    'gdpr_personal_data',
    'gdpr_sensitive_data',
    'pci_cardholder_data',
    'pci_sensitive_auth_data',
    'hipaa_phi',
    'sox_financial_data',
    'export_controlled',
  ])).default([]),
  
  // Handling requirements
  handlingRequirements: z.object({
    encryptionRequired: z.boolean(),
    accessLoggingRequired: z.boolean(),
    approvalRequired: z.boolean(),
    retentionPolicyId: cuidSchema.optional(),
    pseudonymizationRequired: z.boolean().default(false),
    anonymizationPossible: z.boolean().default(false),
  }),
  
  // Geographic restrictions
  geographicRestrictions: z.array(z.object({
    country: z.string().length(2), // ISO country code
    restriction: z.enum(['no_transfer', 'encryption_required', 'approval_required']),
    reason: z.string().max(255),
  })).default([]),
  
  // Metadata
  description: z.string().max(500),
  examples: z.array(z.string()).default([]),
  relatedPolicies: z.array(cuidSchema).default([]),
  lastUpdated: z.date(),
});

// =============================================================================
// DATA PROCESSING SCHEMAS
// =============================================================================

/**
 * Data processing activity
 */
export const dataProcessingActivitySchema = z.object({
  id: cuidSchema,
  name: z.string().min(1).max(100),
  description: z.string().max(1000),
  
  // Processing details
  purpose: z.array(z.string()).min(1), // Specific purposes
  legalBasis: z.array(z.enum([
    'consent',
    'contract',
    'legal_obligation',
    'vital_interests',
    'public_task',
    'legitimate_interests',
  ])).min(1),
  
  // Data subjects
  dataSubjects: z.array(z.enum([
    'customers',
    'employees',
    'visitors',
    'suppliers',
    'partners',
    'children',
  ])),
  
  // Data categories
  dataCategories: z.array(z.string()).min(1),
  sensitiveDataProcessed: z.boolean().default(false),
  
  // Recipients
  recipients: z.array(z.object({
    category: z.enum(['internal', 'third_party', 'processor', 'joint_controller']),
    name: z.string().max(255),
    location: z.string().max(100), // Country or region
    safeguards: z.string().max(500).optional(),
  })).default([]),
  
  // International transfers
  internationalTransfers: z.array(z.object({
    country: z.string().length(2), // ISO country code
    adequacyDecision: z.boolean(),
    safeguards: z.enum([
      'standard_contractual_clauses',
      'binding_corporate_rules',
      'certification',
      'approved_code_of_conduct',
    ]).optional(),
    additionalMeasures: z.string().max(500).optional(),
  })).default([]),
  
  // Data security
  securityMeasures: z.array(z.enum([
    'encryption_at_rest',
    'encryption_in_transit',
    'access_controls',
    'audit_logging',
    'pseudonymization',
    'anonymization',
    'regular_backups',
    'vulnerability_scanning',
  ])).default([]),
  
  // Retention
  retentionPeriod: z.string().max(255),
  retentionCriteria: z.string().max(500),
  
  // Risk assessment
  riskLevel: z.enum(['low', 'medium', 'high']),
  dataProtectionImpactAssessment: z.boolean().default(false),
  
  // Metadata
  dataController: z.string().max(255),
  dataProtectionOfficer: z.string().max(255).optional(),
  lastReviewed: z.date(),
  nextReview: z.date(),
});

// =============================================================================
// ANONYMIZATION AND PSEUDONYMIZATION
// =============================================================================

/**
 * Anonymization configuration
 */
export const anonymizationConfigSchema = z.object({
  id: cuidSchema,
  name: z.string().min(1).max(100),
  description: z.string().max(500),
  
  // Target data
  targetTables: z.array(z.string()).min(1),
  targetFields: z.array(z.object({
    table: z.string(),
    field: z.string(),
    dataType: z.enum(['string', 'number', 'date', 'email', 'phone', 'address']),
  })).min(1),
  
  // Anonymization techniques
  techniques: z.array(z.object({
    field: z.string(),
    technique: z.enum([
      'suppression', // Remove data completely
      'generalization', // Replace with broader category
      'perturbation', // Add random noise
      'substitution', // Replace with synthetic data
      'shuffling', // Rearrange data between records
      'aggregation', // Group data together
      'k_anonymity', // Ensure k similar records
      'l_diversity', // Ensure diverse sensitive attributes
      't_closeness', // Ensure distribution similarity
    ]),
    parameters: z.record(z.unknown()).default({}),
  })).min(1),
  
  // Quality requirements
  utilityRequirements: z.object({
    preserveStatistics: z.boolean().default(true),
    preserveRelationships: z.boolean().default(false),
    minimumAccuracy: z.number().min(0).max(1).default(0.8),
  }),
  
  // Reversibility (for pseudonymization)
  isReversible: z.boolean().default(false),
  keyManagement: z.object({
    keyStorageLocation: z.string().max(255).optional(),
    keyRotationPeriod: z.number().int().min(30).optional(), // days
    accessControlRequired: z.boolean().default(true),
  }).optional(),
  
  // Validation
  reidentificationRisk: z.enum(['very_low', 'low', 'medium', 'high']),
  validationResults: z.object({
    kAnonymity: z.number().int().min(1).optional(),
    lDiversity: z.number().int().min(1).optional(),
    tCloseness: z.number().min(0).max(1).optional(),
    lastValidated: z.date(),
  }).optional(),
  
  // Metadata
  createdBy: cuidSchema,
  approvedBy: cuidSchema.optional(),
  isActive: z.boolean().default(true),
  createdAt: z.date(),
  lastUsed: z.date().optional(),
});

// =============================================================================
// DATA BREACH MANAGEMENT
// =============================================================================

/**
 * Data breach incident
 */
export const dataBreachIncidentSchema = z.object({
  id: cuidSchema,
  incidentNumber: z.string().min(1).max(50),
  
  // Breach details
  breachType: z.enum([
    'confidentiality_breach', // Unauthorized access/disclosure
    'integrity_breach', // Unauthorized alteration
    'availability_breach', // Accidental/unlawful destruction/loss
  ]),
  
  // Cause
  cause: z.enum([
    'cyber_attack',
    'human_error',
    'system_failure',
    'physical_theft',
    'natural_disaster',
    'third_party_breach',
    'insider_threat',
    'other',
  ]),
  
  // Affected data
  affectedDataTypes: z.array(z.enum([
    'personal_identifiers',
    'financial_data',
    'health_data',
    'biometric_data',
    'location_data',
    'communication_data',
    'behavioral_data',
    'sensitive_personal_data',
  ])).min(1),
  
  // Impact assessment
  affectedRecords: z.number().int().min(0),
  affectedDataSubjects: z.number().int().min(0),
  geographicScope: z.array(z.string()).min(1), // ISO country codes
  
  // Risk assessment
  riskLevel: z.enum(['low', 'medium', 'high', 'critical']),
  riskFactors: z.array(z.string()).default([]),
  
  // Likelihood of harm
  harmLikelihood: z.enum(['remote', 'possible', 'likely', 'very_likely']),
  potentialHarms: z.array(z.enum([
    'identity_theft',
    'financial_loss',
    'discrimination',
    'reputational_damage',
    'physical_harm',
    'emotional_distress',
    'loss_of_control',
  ])).default([]),
  
  // Response actions
  containmentActions: z.array(z.string()).default([]),
  mitigationMeasures: z.array(z.string()).default([]),
  
  // Notifications
  authorityNotified: z.boolean().default(false),
  authorityNotificationDate: z.date().optional(),
  dataSubjectsNotified: z.boolean().default(false),
  dataSubjectNotificationDate: z.date().optional(),
  
  // Investigation
  investigationStatus: z.enum([
    'initiated',
    'ongoing',
    'completed',
    'closed',
  ]).default('initiated'),
  investigationFindings: z.string().max(2000).optional(),
  
  // Timeline
  discoveredAt: z.date(),
  occurredAt: z.date().optional(),
  containedAt: z.date().optional(),
  resolvedAt: z.date().optional(),
  
  // Responsible parties
  reportedBy: cuidSchema,
  investigatedBy: cuidSchema.optional(),
  dpoNotified: z.boolean().default(false),
  
  // Follow-up
  preventiveMeasures: z.array(z.string()).default([]),
  lessonsLearned: z.string().max(1000).optional(),
  policyUpdatesRequired: z.boolean().default(false),
});

// =============================================================================
// TYPE EXPORTS
// =============================================================================

export type DataSubjectRights = z.infer<typeof dataSubjectRightsSchema>;
export type ConsentRecord = z.infer<typeof consentRecordSchema>;
export type DataRetentionPolicy = z.infer<typeof dataRetentionPolicySchema>;
export type DataClassification = z.infer<typeof dataClassificationSchema>;
export type DataProcessingActivity = z.infer<typeof dataProcessingActivitySchema>;
export type AnonymizationConfig = z.infer<typeof anonymizationConfigSchema>;
export type DataBreachIncident = z.infer<typeof dataBreachIncidentSchema>;