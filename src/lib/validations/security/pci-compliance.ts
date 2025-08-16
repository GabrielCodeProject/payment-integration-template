import { z } from 'zod';
import {
  cuidSchema,
  ipAddressSchema,
  userAgentSchema,
} from '../base/common';

/**
 * PCI Compliance Validation Schemas
 * 
 * Validation schemas designed to meet PCI DSS requirements for handling
 * cardholder data and maintaining payment security standards.
 * 
 * IMPORTANT: These schemas validate structure only. Never store or log
 * actual cardholder data - always use Stripe tokens/IDs instead.
 */

// =============================================================================
// PCI DSS REQUIREMENT 1: NETWORK SECURITY
// =============================================================================

/**
 * Allowed IP address validation for PCI compliance
 */
export const pciAllowedIpSchema = z.object({
  ipAddress: ipAddressSchema,
  description: z.string().max(255, 'Description must not exceed 255 characters'),
  allowedActions: z.array(z.enum([
    'payment_processing',
    'cardholder_data_access',
    'admin_access',
    'api_access',
  ])),
  expiresAt: z.date().optional(),
  isActive: z.boolean().default(true),
});

/**
 * Network access log validation
 */
export const pciNetworkAccessLogSchema = z.object({
  ipAddress: ipAddressSchema,
  userAgent: userAgentSchema,
  endpoint: z.string().max(255),
  method: z.enum(['GET', 'POST', 'PUT', 'DELETE', 'PATCH']),
  statusCode: z.number().int().min(100).max(599),
  responseTime: z.number().min(0), // milliseconds
  dataAccessed: z.enum(['none', 'cardholder_data', 'sensitive_auth_data', 'other']),
  timestamp: z.date(),
  userId: cuidSchema.optional(),
  sessionId: z.string().optional(),
});

// =============================================================================
// PCI DSS REQUIREMENT 2: SECURE CONFIGURATIONS
// =============================================================================

/**
 * PCI security configuration validation
 */
export const pciSecurityConfigSchema = z.object({
  encryptionEnabled: z.boolean().refine(val => val === true, {
    message: 'Encryption must be enabled for PCI compliance',
  }),
  tlsVersion: z.enum(['1.2', '1.3']),
  strongCryptography: z.boolean().refine(val => val === true, {
    message: 'Strong cryptography is required for PCI compliance',
  }),
  secureDefaults: z.boolean().refine(val => val === true, {
    message: 'Secure defaults must be configured',
  }),
  vulnerabilityScanning: z.boolean().refine(val => val === true, {
    message: 'Regular vulnerability scanning is required',
  }),
  lastSecurityUpdate: z.date(),
});

// =============================================================================
// PCI DSS REQUIREMENT 3: CARDHOLDER DATA PROTECTION
// =============================================================================

/**
 * Cardholder data environment validation
 * Note: This validates the environment configuration, not actual card data
 */
export const pciCardholderDataEnvironmentSchema = z.object({
  dataFlow: z.enum(['transmission', 'processing', 'storage']),
  encryptionMethod: z.enum(['AES-256', 'RSA-2048', 'elliptic_curve']),
  keyManagement: z.object({
    keyRotation: z.boolean().refine(val => val === true, {
      message: 'Key rotation must be enabled',
    }),
    keyEscrow: z.boolean(),
    strongKeys: z.boolean().refine(val => val === true, {
      message: 'Strong cryptographic keys are required',
    }),
  }),
  dataMinimization: z.boolean().refine(val => val === true, {
    message: 'Data minimization practices must be implemented',
  }),
  retentionPolicy: z.object({
    maxRetentionDays: z.number().int().max(365),
    automaticDeletion: z.boolean().refine(val => val === true, {
      message: 'Automatic data deletion must be configured',
    }),
  }),
});

/**
 * Sensitive authentication data validation
 * Note: For configuration validation only - never validate actual sensitive data
 */
export const pciSensitiveAuthDataSchema = z.object({
  dataType: z.enum(['full_track_data', 'cad_cvc2_cvv2', 'pin_verification']),
  isStored: z.boolean().refine(val => val === false, {
    message: 'Sensitive authentication data must not be stored after authorization',
  }),
  processingMethod: z.enum(['tokenization', 'encryption', 'hashing']),
  secureProcessing: z.boolean().refine(val => val === true, {
    message: 'Secure processing methods must be used',
  }),
});

// =============================================================================
// PCI DSS REQUIREMENT 4: ENCRYPTION IN TRANSIT
// =============================================================================

/**
 * Data transmission security validation
 */
export const pciDataTransmissionSchema = z.object({
  protocol: z.enum(['HTTPS', 'TLS', 'SFTP', 'VPN']),
  tlsVersion: z.enum(['1.2', '1.3']),
  cipherSuite: z.string().min(1, 'Cipher suite must be specified'),
  certificateValidation: z.boolean().refine(val => val === true, {
    message: 'Certificate validation must be enabled',
  }),
  endToEndEncryption: z.boolean().refine(val => val === true, {
    message: 'End-to-end encryption is required for cardholder data',
  }),
  dataClassification: z.enum(['cardholder_data', 'sensitive_auth_data', 'other']),
});

// =============================================================================
// PCI DSS REQUIREMENT 6: SECURE DEVELOPMENT
// =============================================================================

/**
 * Secure coding practices validation
 */
export const pciSecureCodingSchema = z.object({
  inputValidation: z.boolean().refine(val => val === true, {
    message: 'Input validation must be implemented',
  }),
  outputEncoding: z.boolean().refine(val => val === true, {
    message: 'Output encoding must be implemented',
  }),
  sqlInjectionPrevention: z.boolean().refine(val => val === true, {
    message: 'SQL injection prevention must be implemented',
  }),
  crossSiteScriptingPrevention: z.boolean().refine(val => val === true, {
    message: 'Cross-site scripting prevention must be implemented',
  }),
  secureErrorHandling: z.boolean().refine(val => val === true, {
    message: 'Secure error handling must be implemented',
  }),
  codeReviewProcess: z.boolean().refine(val => val === true, {
    message: 'Code review process must be in place',
  }),
});

/**
 * Application security testing validation
 */
export const pciApplicationSecurityTestingSchema = z.object({
  staticAnalysis: z.boolean().refine(val => val === true, {
    message: 'Static application security testing must be performed',
  }),
  dynamicAnalysis: z.boolean().refine(val => val === true, {
    message: 'Dynamic application security testing must be performed',
  }),
  penetrationTesting: z.boolean().refine(val => val === true, {
    message: 'Penetration testing must be performed',
  }),
  vulnerabilityAssessment: z.boolean().refine(val => val === true, {
    message: 'Vulnerability assessment must be performed',
  }),
  lastTestDate: z.date(),
  testFrequency: z.enum(['monthly', 'quarterly', 'annually']),
});

// =============================================================================
// PCI DSS REQUIREMENT 7: ACCESS CONTROL
// =============================================================================

/**
 * Access control validation for PCI compliance
 */
export const pciAccessControlSchema = z.object({
  userId: cuidSchema,
  role: z.enum(['admin', 'operator', 'viewer', 'developer']),
  accessLevel: z.enum(['full', 'limited', 'read_only', 'no_access']),
  cardholderDataAccess: z.boolean(),
  businessJustification: z.string().min(10, 'Business justification must be provided').max(500),
  approvedBy: cuidSchema,
  approvalDate: z.date(),
  reviewDate: z.date(),
  accessRights: z.array(z.enum([
    'view_cardholder_data',
    'process_payments',
    'access_system_components',
    'modify_configurations',
    'access_audit_logs',
  ])),
  needToKnowBasis: z.boolean().refine(val => val === true, {
    message: 'Access must be granted on a need-to-know basis',
  }),
});

/**
 * User authentication validation for PCI compliance
 */
export const pciUserAuthenticationSchema = z.object({
  userId: cuidSchema,
  authenticationMethod: z.enum(['password', 'multi_factor', 'certificate', 'biometric']),
  multiFactorRequired: z.boolean().refine(val => val === true, {
    message: 'Multi-factor authentication is required for cardholder data access',
  }),
  strongPasswords: z.boolean().refine(val => val === true, {
    message: 'Strong passwords are required',
  }),
  passwordComplexity: z.object({
    minLength: z.number().int().min(8),
    requireUppercase: z.boolean().refine(val => val === true),
    requireLowercase: z.boolean().refine(val => val === true),
    requireNumbers: z.boolean().refine(val => val === true),
    requireSpecialChars: z.boolean().refine(val => val === true),
  }),
  accountLockout: z.object({
    enabled: z.boolean().refine(val => val === true),
    maxAttempts: z.number().int().max(6, 'Maximum 6 failed attempts allowed'),
    lockoutDuration: z.number().int().min(1800, 'Minimum 30 minutes lockout required'),
  }),
  sessionManagement: z.object({
    sessionTimeout: z.number().int().max(900, 'Maximum 15 minutes session timeout'),
    reauthenticationRequired: z.boolean().refine(val => val === true),
  }),
});

// =============================================================================
// PCI DSS REQUIREMENT 8: UNIQUE IDs AND AUTHENTICATION
// =============================================================================

/**
 * Unique user identification validation
 */
export const pciUniqueUserIdSchema = z.object({
  userId: cuidSchema,
  username: z.string().min(1, 'Username is required').max(100),
  isUnique: z.boolean().refine(val => val === true, {
    message: 'User ID must be unique',
  }),
  isPersonal: z.boolean().refine(val => val === true, {
    message: 'User ID must be assigned to one person only',
  }),
  sharedAccounts: z.boolean().refine(val => val === false, {
    message: 'Shared accounts are not permitted',
  }),
  genericAccounts: z.boolean().refine(val => val === false, {
    message: 'Generic accounts are not permitted',
  }),
  lastActivity: z.date(),
  isActive: z.boolean(),
});

// =============================================================================
// PCI DSS REQUIREMENT 10: LOGGING AND MONITORING
// =============================================================================

/**
 * PCI audit log requirements validation
 */
export const pciAuditLogSchema = z.object({
  eventType: z.enum([
    'user_access_to_cardholder_data',
    'actions_by_privileged_user',
    'access_to_audit_trails',
    'invalid_logical_access_attempts',
    'identification_authentication_mechanisms',
    'initialization_of_audit_logs',
    'creation_deletion_system_accounts',
  ]),
  userId: cuidSchema.optional(),
  timestamp: z.date(),
  success: z.boolean(),
  source: z.string().max(255),
  userIdentification: z.string().max(255),
  eventType_detail: z.string().max(255),
  affectedResource: z.string().max(255),
  ipAddress: ipAddressSchema,
  sessionId: z.string().optional(),
  logIntegrity: z.boolean().refine(val => val === true, {
    message: 'Log integrity must be maintained',
  }),
  tamperEvidence: z.boolean().refine(val => val === true, {
    message: 'Tamper evidence must be implemented',
  }),
});

/**
 * PCI log monitoring validation
 */
export const pciLogMonitoringSchema = z.object({
  realTimeMonitoring: z.boolean().refine(val => val === true, {
    message: 'Real-time log monitoring is required',
  }),
  alertsConfigured: z.boolean().refine(val => val === true, {
    message: 'Security alerts must be configured',
  }),
  dailyReview: z.boolean().refine(val => val === true, {
    message: 'Daily log review is required',
  }),
  incidentResponse: z.boolean().refine(val => val === true, {
    message: 'Incident response procedures must be in place',
  }),
  logRetention: z.object({
    retentionPeriod: z.number().int().min(365, 'Minimum 1 year retention required'),
    secureStorage: z.boolean().refine(val => val === true),
    backupProtection: z.boolean().refine(val => val === true),
  }),
});

// =============================================================================
// PCI DSS REQUIREMENT 11: SECURITY TESTING
// =============================================================================

/**
 * Security testing validation
 */
export const pciSecurityTestingSchema = z.object({
  vulnerabilityScanning: z.object({
    frequency: z.enum(['quarterly', 'after_significant_changes']),
    approvedVendor: z.boolean().refine(val => val === true, {
      message: 'Must use approved scanning vendor',
    }),
    lastScanDate: z.date(),
    passingScans: z.boolean().refine(val => val === true, {
      message: 'All scans must be passing',
    }),
  }),
  penetrationTesting: z.object({
    frequency: z.enum(['annually', 'after_significant_changes']),
    methodology: z.enum(['owasp', 'nist', 'ptes']),
    lastTestDate: z.date(),
    criticalVulnerabilities: z.number().int().max(0, 'No critical vulnerabilities allowed'),
  }),
  intrusionDetection: z.object({
    enabled: z.boolean().refine(val => val === true, {
      message: 'Intrusion detection must be enabled',
    }),
    realTimeAlerts: z.boolean().refine(val => val === true),
    responseTime: z.number().int().max(900, 'Maximum 15 minutes response time'),
  }),
});

// =============================================================================
// PCI DSS REQUIREMENT 12: INFORMATION SECURITY POLICY
// =============================================================================

/**
 * Information security policy validation
 */
export const pciSecurityPolicySchema = z.object({
  policyExists: z.boolean().refine(val => val === true, {
    message: 'Information security policy must exist',
  }),
  lastReview: z.date(),
  reviewFrequency: z.enum(['annually', 'semi_annually']),
  employeeAcknowledgment: z.boolean().refine(val => val === true, {
    message: 'Employee acknowledgment is required',
  }),
  incidentResponsePlan: z.boolean().refine(val => val === true, {
    message: 'Incident response plan is required',
  }),
  securityAwarenessProgram: z.boolean().refine(val => val === true, {
    message: 'Security awareness program is required',
  }),
  backgroundChecks: z.boolean().refine(val => val === true, {
    message: 'Background checks are required for personnel',
  }),
  terminationProcedures: z.boolean().refine(val => val === true, {
    message: 'Termination procedures must be defined',
  }),
});

// =============================================================================
// PAYMENT DATA VALIDATION (STRUCTURE ONLY)
// =============================================================================

/**
 * Payment data structure validation
 * IMPORTANT: This validates structure only - never validate actual payment data
 */
export const pciPaymentDataStructureSchema = z.object({
  dataType: z.enum(['tokenized', 'encrypted', 'masked']),
  stripeToken: z.string().startsWith('tok_', 'Invalid Stripe token format').optional(),
  stripePaymentMethodId: z.string().startsWith('pm_', 'Invalid Stripe payment method ID').optional(),
  maskedPan: z.string().regex(/^\*+\d{4}$/, 'Invalid masked PAN format').optional(),
  expiryMasked: z.string().regex(/^\*\*\/\*\*$/, 'Invalid masked expiry format').optional(),
  processingMethod: z.enum(['stripe_elements', 'stripe_checkout', 'payment_request_api']),
  pciScope: z.enum(['out_of_scope', 'saq_a', 'saq_a_ep', 'saq_b', 'saq_c', 'saq_d']),
  cardholderDataPresent: z.boolean().refine(val => val === false, {
    message: 'Raw cardholder data must not be present in application scope',
  }),
});

/**
 * PCI compliance check result
 */
export const pciComplianceCheckResultSchema = z.object({
  checkId: cuidSchema,
  requirement: z.string().max(100),
  status: z.enum(['compliant', 'non_compliant', 'not_applicable', 'compensating_control']),
  score: z.number().min(0).max(100),
  findings: z.array(z.string()),
  recommendations: z.array(z.string()),
  priority: z.enum(['low', 'medium', 'high', 'critical']),
  dueDate: z.date().optional(),
  assessor: z.string().max(255),
  assessmentDate: z.date(),
  evidence: z.array(z.string()).default([]),
});

// =============================================================================
// TYPE EXPORTS
// =============================================================================

export type PCIAllowedIp = z.infer<typeof pciAllowedIpSchema>;
export type PCINetworkAccessLog = z.infer<typeof pciNetworkAccessLogSchema>;
export type PCISecurityConfig = z.infer<typeof pciSecurityConfigSchema>;
export type PCICardholderDataEnvironment = z.infer<typeof pciCardholderDataEnvironmentSchema>;
export type PCISensitiveAuthData = z.infer<typeof pciSensitiveAuthDataSchema>;
export type PCIDataTransmission = z.infer<typeof pciDataTransmissionSchema>;
export type PCISecureCoding = z.infer<typeof pciSecureCodingSchema>;
export type PCIApplicationSecurityTesting = z.infer<typeof pciApplicationSecurityTestingSchema>;
export type PCIAccessControl = z.infer<typeof pciAccessControlSchema>;
export type PCIUserAuthentication = z.infer<typeof pciUserAuthenticationSchema>;
export type PCIUniqueUserId = z.infer<typeof pciUniqueUserIdSchema>;
export type PCIAuditLog = z.infer<typeof pciAuditLogSchema>;
export type PCILogMonitoring = z.infer<typeof pciLogMonitoringSchema>;
export type PCISecurityTesting = z.infer<typeof pciSecurityTestingSchema>;
export type PCISecurityPolicy = z.infer<typeof pciSecurityPolicySchema>;
export type PCIPaymentDataStructure = z.infer<typeof pciPaymentDataStructureSchema>;
export type PCIComplianceCheckResult = z.infer<typeof pciComplianceCheckResultSchema>;