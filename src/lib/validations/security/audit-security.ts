import { z } from 'zod';
import {
  cuidSchema,
  emailSchema,
  ipAddressSchema,
  userAgentSchema,
} from '../base/common';

/**
 * Security Audit Validation Schemas
 * 
 * Validation schemas for security auditing, compliance monitoring,
 * and security incident tracking specifically for audit purposes.
 */

// =============================================================================
// SECURITY AUDIT LOG SCHEMAS
// =============================================================================

/**
 * Security event audit log
 */
export const securityAuditLogSchema = z.object({
  id: cuidSchema,
  
  // Event identification
  eventType: z.enum([
    'authentication_success',
    'authentication_failure',
    'authorization_success',
    'authorization_failure',
    'privilege_escalation_attempt',
    'data_access_attempt',
    'data_modification',
    'security_configuration_change',
    'encryption_key_access',
    'suspicious_activity_detected',
    'security_policy_violation',
    'intrusion_attempt',
    'malware_detection',
    'vulnerability_exploitation_attempt',
    'security_breach_detected',
  ]),
  
  // Severity and classification
  severity: z.enum(['info', 'low', 'medium', 'high', 'critical']),
  category: z.enum([
    'access_control',
    'data_protection',
    'network_security',
    'application_security',
    'system_security',
    'compliance',
    'incident_response',
  ]),
  
  // Actor information
  userId: cuidSchema.optional(),
  userEmail: emailSchema.optional(),
  userRole: z.enum(['CUSTOMER', 'ADMIN', 'SUPPORT', 'SYSTEM', 'ANONYMOUS']).optional(),
  sessionId: z.string().max(255).optional(),
  
  // Technical details
  sourceIpAddress: ipAddressSchema,
  userAgent: userAgentSchema.optional(),
  requestId: z.string().max(255).optional(),
  endpoint: z.string().max(255).optional(),
  httpMethod: z.enum(['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS', 'HEAD']).optional(),
  httpStatusCode: z.number().int().min(100).max(599).optional(),
  
  // Event description
  description: z.string().max(1000),
  detailedDescription: z.string().max(5000).optional(),
  
  // Affected resources
  affectedResource: z.string().max(255).optional(),
  resourceType: z.enum([
    'user_account',
    'payment_method',
    'order',
    'product',
    'system_configuration',
    'security_policy',
    'encryption_key',
    'database',
    'file_system',
    'network_resource',
  ]).optional(),
  resourceId: cuidSchema.optional(),
  
  // Security context
  securityContext: z.object({
    encryptionUsed: z.boolean().default(false),
    authenticationMethod: z.enum([
      'password',
      'multi_factor',
      'api_key',
      'oauth',
      'certificate',
      'biometric',
      'none',
    ]).optional(),
    tlsVersion: z.string().max(10).optional(),
    riskScore: z.number().min(0).max(100).optional(),
  }),
  
  // Compliance markers
  complianceFlags: z.array(z.enum([
    'pci_relevant',
    'gdpr_relevant',
    'sox_relevant',
    'hipaa_relevant',
    'iso27001_relevant',
  ])).default([]),
  
  // Response and outcome
  actionTaken: z.enum([
    'none',
    'logged_only',
    'alert_generated',
    'user_blocked',
    'session_terminated',
    'access_revoked',
    'incident_created',
    'manual_review_required',
  ]).default('logged_only'),
  
  outcome: z.enum([
    'success',
    'failure',
    'partial_success',
    'blocked',
    'delayed',
    'requires_review',
  ]).optional(),
  
  // Incident correlation
  incidentId: cuidSchema.optional(),
  correlatedEvents: z.array(cuidSchema).default([]),
  
  // Metadata
  tags: z.array(z.string()).default([]),
  customFields: z.record(z.unknown()).default({}),
  
  // Timestamps
  timestamp: z.date(),
  detectedAt: z.date().optional(),
  reportedAt: z.date().optional(),
  
  // Audit trail
  loggedBy: z.enum(['system', 'application', 'security_tool', 'manual']),
  logSource: z.string().max(255),
  logLevel: z.enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal']),
  
  // Data integrity
  checksum: z.string().max(128).optional(),
  signature: z.string().max(512).optional(),
  tamperEvidence: z.boolean().default(false),
});

// =============================================================================
// COMPLIANCE AUDIT SCHEMAS
// =============================================================================

/**
 * Compliance check result
 */
export const complianceCheckResultSchema = z.object({
  id: cuidSchema,
  checkId: z.string().max(100),
  checkName: z.string().max(255),
  
  // Compliance framework
  framework: z.enum([
    'PCI_DSS',
    'GDPR',
    'SOX',
    'HIPAA',
    'ISO27001',
    'SOC2',
    'NIST',
    'COBIT',
    'CUSTOM',
  ]),
  requirement: z.string().max(100), // Specific requirement number/ID
  requirementDescription: z.string().max(500),
  
  // Check details
  checkType: z.enum([
    'automated',
    'manual',
    'documentation_review',
    'interview',
    'technical_test',
    'penetration_test',
  ]),
  
  // Results
  status: z.enum([
    'compliant',
    'non_compliant',
    'partially_compliant',
    'not_applicable',
    'compensating_control',
    'requires_review',
  ]),
  
  score: z.number().min(0).max(100).optional(),
  
  // Findings
  findings: z.array(z.object({
    type: z.enum(['deficiency', 'weakness', 'observation', 'best_practice']),
    severity: z.enum(['low', 'medium', 'high', 'critical']),
    description: z.string().max(1000),
    evidence: z.array(z.string()).default([]),
    recommendation: z.string().max(500).optional(),
  })).default([]),
  
  // Evidence and documentation
  evidence: z.array(z.object({
    type: z.enum(['document', 'screenshot', 'log_file', 'configuration', 'interview_notes']),
    description: z.string().max(255),
    location: z.string().max(500), // File path, URL, or reference
    collectedAt: z.date(),
    collectedBy: cuidSchema,
  })).default([]),
  
  // Risk assessment
  riskLevel: z.enum(['very_low', 'low', 'medium', 'high', 'very_high']).optional(),
  riskDescription: z.string().max(500).optional(),
  
  // Remediation
  remediationRequired: z.boolean().default(false),
  remediationPlan: z.string().max(2000).optional(),
  remediationDueDate: z.date().optional(),
  remediationOwner: cuidSchema.optional(),
  remediationStatus: z.enum([
    'not_started',
    'planned',
    'in_progress',
    'completed',
    'verified',
    'closed',
  ]).optional(),
  
  // Compensating controls
  compensatingControls: z.array(z.object({
    description: z.string().max(500),
    effectiveness: z.enum(['low', 'medium', 'high']),
    validatedBy: cuidSchema,
    validatedAt: z.date(),
  })).default([]),
  
  // Assessment metadata
  assessor: z.string().max(255),
  assessorOrganization: z.string().max(255).optional(),
  assessmentDate: z.date(),
  nextAssessmentDue: z.date().optional(),
  
  // Quality assurance
  reviewedBy: cuidSchema.optional(),
  reviewedAt: z.date().optional(),
  approvedBy: cuidSchema.optional(),
  approvedAt: z.date().optional(),
  
  // Change tracking
  version: z.string().max(20),
  previousVersionId: cuidSchema.optional(),
  changeReason: z.string().max(255).optional(),
  
  // Metadata
  tags: z.array(z.string()).default([]),
  customAttributes: z.record(z.unknown()).default({}),
  
  // Timestamps
  createdAt: z.date(),
  updatedAt: z.date(),
});

// =============================================================================
// SECURITY INCIDENT SCHEMAS
// =============================================================================

/**
 * Security incident for audit purposes
 */
export const securityIncidentAuditSchema = z.object({
  id: cuidSchema,
  incidentNumber: z.string().max(50),
  
  // Classification
  incidentType: z.enum([
    'data_breach',
    'unauthorized_access',
    'malware_infection',
    'phishing_attack',
    'ddos_attack',
    'insider_threat',
    'physical_security_breach',
    'system_compromise',
    'service_disruption',
    'compliance_violation',
  ]),
  
  severity: z.enum(['low', 'medium', 'high', 'critical']),
  priority: z.enum(['p1', 'p2', 'p3', 'p4']),
  
  // Detection and reporting
  detectionMethod: z.enum([
    'automated_monitoring',
    'user_report',
    'third_party_notification',
    'routine_audit',
    'penetration_test',
    'vulnerability_scan',
    'manual_investigation',
  ]),
  
  detectedBy: z.string().max(255),
  reportedBy: cuidSchema.optional(),
  
  // Timeline
  occurredAt: z.date().optional(),
  detectedAt: z.date(),
  reportedAt: z.date(),
  acknowledgedAt: z.date().optional(),
  containedAt: z.date().optional(),
  resolvedAt: z.date().optional(),
  
  // Impact assessment
  affectedSystems: z.array(z.string()).default([]),
  affectedUsers: z.number().int().min(0).default(0),
  affectedRecords: z.number().int().min(0).default(0),
  businessImpact: z.enum(['none', 'minimal', 'moderate', 'significant', 'severe']),
  
  // Security implications
  confidentialityImpact: z.enum(['none', 'low', 'medium', 'high']),
  integrityImpact: z.enum(['none', 'low', 'medium', 'high']),
  availabilityImpact: z.enum(['none', 'low', 'medium', 'high']),
  
  // Investigation
  investigationStatus: z.enum([
    'not_started',
    'in_progress',
    'completed',
    'on_hold',
    'closed',
  ]),
  
  investigationFindings: z.string().max(5000).optional(),
  rootCause: z.string().max(1000).optional(),
  
  // Response actions
  immediateActions: z.array(z.string()).default([]),
  containmentActions: z.array(z.string()).default([]),
  eradicationActions: z.array(z.string()).default([]),
  recoveryActions: z.array(z.string()).default([]),
  
  // Lessons learned
  lessonsLearned: z.string().max(2000).optional(),
  preventiveMeasures: z.array(z.string()).default([]),
  
  // Legal and regulatory
  legalNotificationRequired: z.boolean().default(false),
  regulatoryNotificationRequired: z.boolean().default(false),
  notificationsMade: z.array(z.object({
    recipient: z.string().max(255),
    notificationType: z.enum(['legal', 'regulatory', 'customer', 'partner', 'media']),
    notifiedAt: z.date(),
    method: z.enum(['email', 'phone', 'letter', 'website', 'press_release']),
  })).default([]),
  
  // Cost impact
  estimatedCost: z.number().min(0).optional(),
  costCategories: z.array(z.enum([
    'investigation',
    'containment',
    'recovery',
    'legal_fees',
    'regulatory_fines',
    'business_loss',
    'reputation_damage',
    'system_replacement',
  ])).default([]),
  
  // Quality assurance
  incidentReviewCompleted: z.boolean().default(false),
  postIncidentReportCompleted: z.boolean().default(false),
  
  // Relationships
  relatedIncidents: z.array(cuidSchema).default([]),
  vulnerabilityIds: z.array(z.string()).default([]),
  
  // Metadata
  tags: z.array(z.string()).default([]),
  customFields: z.record(z.unknown()).default({}),
  
  // Audit trail
  createdBy: cuidSchema,
  lastModifiedBy: cuidSchema.optional(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

// =============================================================================
// ACCESS CONTROL AUDIT SCHEMAS
// =============================================================================

/**
 * Access control audit event
 */
export const accessControlAuditSchema = z.object({
  id: cuidSchema,
  
  // Access attempt details
  accessType: z.enum([
    'login_attempt',
    'resource_access',
    'privilege_escalation',
    'administrative_action',
    'data_access',
    'system_access',
  ]),
  
  // Actor information
  userId: cuidSchema.optional(),
  userEmail: emailSchema.optional(),
  userRole: z.string().max(50).optional(),
  impersonatorId: cuidSchema.optional(), // If someone is impersonating
  
  // Target resource
  resourceType: z.enum([
    'application',
    'database',
    'file_system',
    'api_endpoint',
    'admin_panel',
    'payment_data',
    'user_data',
    'system_configuration',
  ]),
  resourceId: z.string().max(255).optional(),
  resourcePath: z.string().max(500).optional(),
  
  // Access context
  accessMethod: z.enum([
    'direct_login',
    'api_key',
    'oauth_token',
    'session_cookie',
    'certificate',
    'service_account',
  ]),
  
  authenticationLevel: z.enum([
    'none',
    'single_factor',
    'multi_factor',
    'certificate_based',
    'biometric',
  ]),
  
  // Technical details
  sourceIpAddress: ipAddressSchema,
  userAgent: userAgentSchema.optional(),
  sessionId: z.string().max(255).optional(),
  deviceFingerprint: z.string().max(255).optional(),
  
  // Geographic information
  geolocation: z.object({
    country: z.string().length(2).optional(), // ISO country code
    region: z.string().max(100).optional(),
    city: z.string().max(100).optional(),
    latitude: z.number().optional(),
    longitude: z.number().optional(),
    isKnownLocation: z.boolean().default(false),
  }).optional(),
  
  // Authorization details
  requestedPermissions: z.array(z.string()).default([]),
  grantedPermissions: z.array(z.string()).default([]),
  deniedPermissions: z.array(z.string()).default([]),
  
  // Decision outcome
  decision: z.enum(['allow', 'deny', 'conditional_allow']),
  denialReason: z.enum([
    'insufficient_privileges',
    'resource_not_found',
    'invalid_credentials',
    'account_locked',
    'account_disabled',
    'time_restriction',
    'location_restriction',
    'rate_limited',
    'policy_violation',
  ]).optional(),
  
  // Risk factors
  riskFactors: z.array(z.enum([
    'new_device',
    'new_location',
    'unusual_time',
    'high_privilege_request',
    'suspicious_pattern',
    'failed_attempts',
    'concurrent_sessions',
  ])).default([]),
  
  riskScore: z.number().min(0).max(100).optional(),
  
  // Conditional access
  conditionalRequirements: z.array(z.enum([
    'mfa_required',
    'device_compliance_check',
    'terms_acceptance',
    'additional_verification',
    'manager_approval',
  ])).default([]),
  
  conditionsMet: z.boolean().default(true),
  
  // Metadata
  duration: z.number().min(0).optional(), // Session duration in seconds
  dataVolume: z.number().min(0).optional(), // Bytes accessed/transferred
  
  // Compliance markers
  sensitiveDataAccessed: z.boolean().default(false),
  complianceRelevant: z.boolean().default(false),
  
  // Timestamps
  timestamp: z.date(),
  sessionStart: z.date().optional(),
  sessionEnd: z.date().optional(),
  
  // Audit metadata
  auditSource: z.string().max(100),
  correlationId: z.string().max(255).optional(),
});

// =============================================================================
// VULNERABILITY AUDIT SCHEMAS
// =============================================================================

/**
 * Vulnerability audit record
 */
export const vulnerabilityAuditSchema = z.object({
  id: cuidSchema,
  vulnerabilityId: z.string().max(100), // CVE ID or internal ID
  
  // Vulnerability details
  title: z.string().max(255),
  description: z.string().max(2000),
  category: z.enum([
    'injection',
    'broken_authentication',
    'sensitive_data_exposure',
    'xml_external_entities',
    'broken_access_control',
    'security_misconfiguration',
    'cross_site_scripting',
    'insecure_deserialization',
    'known_vulnerabilities',
    'insufficient_logging',
  ]),
  
  // Severity assessment
  cvssScore: z.number().min(0).max(10).optional(),
  severity: z.enum(['info', 'low', 'medium', 'high', 'critical']),
  
  // Affected systems
  affectedSystems: z.array(z.string()).default([]),
  affectedVersions: z.array(z.string()).default([]),
  
  // Discovery details
  discoveredBy: z.enum([
    'automated_scan',
    'penetration_test',
    'code_review',
    'security_researcher',
    'vendor_advisory',
    'public_disclosure',
    'incident_investigation',
  ]),
  
  discoveredAt: z.date(),
  reportedAt: z.date(),
  
  // Status tracking
  status: z.enum([
    'new',
    'acknowledged',
    'in_progress',
    'testing',
    'resolved',
    'verified',
    'closed',
    'accepted_risk',
  ]),
  
  // Remediation
  remediationPlan: z.string().max(2000).optional(),
  remediationPriority: z.enum(['low', 'medium', 'high', 'critical']),
  targetResolutionDate: z.date().optional(),
  actualResolutionDate: z.date().optional(),
  
  // Risk assessment
  exploitability: z.enum(['none', 'low', 'medium', 'high']),
  businessImpact: z.enum(['minimal', 'minor', 'moderate', 'major', 'extreme']),
  
  // Verification
  verificationStatus: z.enum([
    'not_verified',
    'verified_vulnerable',
    'verified_fixed',
    'false_positive',
  ]),
  verifiedBy: cuidSchema.optional(),
  verifiedAt: z.date().optional(),
  
  // Compliance impact
  complianceImpact: z.array(z.enum([
    'pci_dss',
    'gdpr',
    'sox',
    'hipaa',
    'iso27001',
  ])).default([]),
  
  // Metadata
  tags: z.array(z.string()).default([]),
  externalReferences: z.array(z.string()).default([]),
  
  // Audit trail
  createdBy: cuidSchema,
  assignedTo: cuidSchema.optional(),
  lastModifiedBy: cuidSchema.optional(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

// =============================================================================
// TYPE EXPORTS
// =============================================================================

export type SecurityAuditLog = z.infer<typeof securityAuditLogSchema>;
export type ComplianceCheckResult = z.infer<typeof complianceCheckResultSchema>;
export type SecurityIncidentAudit = z.infer<typeof securityIncidentAuditSchema>;
export type AccessControlAudit = z.infer<typeof accessControlAuditSchema>;
export type VulnerabilityAudit = z.infer<typeof vulnerabilityAuditSchema>;