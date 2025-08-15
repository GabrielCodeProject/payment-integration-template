import { z } from 'zod';
import {
  cuidSchema,
  emailSchema,
  ipAddressSchema,
  userAgentSchema,
  sessionIdSchema,
  requestIdSchema,
  changedFieldsSchema,
  metadataSchema,
  dateSchema,
  optionalDateSchema,
} from './common';

/**
 * Audit Log Validation Schemas
 * 
 * Comprehensive validation schemas for audit logging,
 * security tracking, and compliance requirements.
 */

// =============================================================================
// ENUMS
// =============================================================================

/**
 * Audit action validation
 */
export const auditActionSchema = z.enum([
  'CREATE',
  'READ',
  'UPDATE',
  'DELETE',
  'LOGIN',
  'LOGOUT',
  'REGISTER',
  'PASSWORD_CHANGE',
  'PASSWORD_RESET',
  'EMAIL_VERIFY',
  'TWO_FACTOR_ENABLE',
  'TWO_FACTOR_DISABLE',
  'PAYMENT_PROCESS',
  'PAYMENT_REFUND',
  'SUBSCRIPTION_CREATE',
  'SUBSCRIPTION_UPDATE',
  'SUBSCRIPTION_CANCEL',
  'DISCOUNT_APPLY',
  'ORDER_PLACE',
  'ORDER_UPDATE',
  'ORDER_CANCEL',
  'EXPORT',
  'IMPORT',
  'ADMIN_ACTION',
  'SYSTEM_ACTION',
  'SECURITY_VIOLATION',
  'DATA_BREACH',
  'COMPLIANCE_CHECK',
], {
  errorMap: () => ({ message: 'Invalid audit action' }),
});

/**
 * Audit severity levels
 */
export const auditSeveritySchema = z.enum([
  'LOW',
  'MEDIUM',
  'HIGH',
  'CRITICAL',
], {
  errorMap: () => ({ message: 'Invalid audit severity' }),
});

/**
 * Table names for audit tracking
 */
export const auditTableNameSchema = z.enum([
  'users',
  'accounts',
  'sessions',
  'products',
  'orders',
  'order_items',
  'subscriptions',
  'payment_methods',
  'discount_codes',
  'user_discount_codes',
  'audit_logs',
], {
  errorMap: () => ({ message: 'Invalid table name' }),
});

// =============================================================================
// CORE AUDIT LOG SCHEMAS
// =============================================================================

/**
 * Base audit log schema - matches Prisma AuditLog model
 */
export const auditLogSchema = z.object({
  id: z.string(), // Using custom generated ID format
  tableName: auditTableNameSchema,
  recordId: cuidSchema,
  action: auditActionSchema,
  userId: cuidSchema.optional(),
  userEmail: emailSchema.optional(),
  ipAddress: ipAddressSchema,
  userAgent: userAgentSchema,
  oldValues: z.record(z.unknown()).optional(),
  newValues: z.record(z.unknown()).optional(),
  changedFields: changedFieldsSchema,
  timestamp: dateSchema,
  sessionId: sessionIdSchema,
  requestId: requestIdSchema,
  metadata: metadataSchema,
});

/**
 * Audit log creation schema
 */
export const createAuditLogSchema = z.object({
  tableName: auditTableNameSchema,
  recordId: cuidSchema,
  action: auditActionSchema,
  userId: cuidSchema.optional(),
  userEmail: emailSchema.optional(),
  ipAddress: ipAddressSchema,
  userAgent: userAgentSchema,
  oldValues: z.record(z.unknown()).optional(),
  newValues: z.record(z.unknown()).optional(),
  changedFields: changedFieldsSchema.optional(),
  sessionId: sessionIdSchema,
  requestId: requestIdSchema,
  metadata: metadataSchema,
  severity: auditSeveritySchema.default('MEDIUM'),
}).superRefine((data, ctx) => {
  // Validate that UPDATE actions have old and new values
  if (data.action === 'UPDATE') {
    if (!data.oldValues && !data.newValues) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'UPDATE actions must include old values or new values',
        path: ['oldValues'],
      });
    }
  }
  
  // Validate that CREATE actions have new values
  if (data.action === 'CREATE' && !data.newValues) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'CREATE actions must include new values',
      path: ['newValues'],
    });
  }
  
  // Validate that DELETE actions have old values
  if (data.action === 'DELETE' && !data.oldValues) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'DELETE actions should include old values',
      path: ['oldValues'],
    });
  }
});

/**
 * Audit log search/filter schema
 */
export const auditLogFilterSchema = z.object({
  tableName: auditTableNameSchema.optional(),
  recordId: cuidSchema.optional(),
  action: auditActionSchema.optional(),
  userId: cuidSchema.optional(),
  userEmail: z.string().optional(),
  ipAddress: z.string().optional(),
  severity: auditSeveritySchema.optional(),
  timestampAfter: optionalDateSchema,
  timestampBefore: optionalDateSchema,
  sessionId: z.string().optional(),
  requestId: z.string().optional(),
  hasChangedField: z.string().optional(),
  searchTerm: z.string().max(255, 'Search term must not exceed 255 characters').optional(),
});

/**
 * Audit log sort options
 */
export const auditLogSortSchema = z.enum([
  'timestamp',
  'action',
  'tableName',
  'userId',
  'severity',
]);

// =============================================================================
// SECURITY AUDIT SCHEMAS
// =============================================================================

/**
 * Security event schema
 */
export const securityEventSchema = z.object({
  eventType: z.enum([
    'failed_login',
    'brute_force_attempt',
    'suspicious_activity',
    'data_access_violation',
    'privilege_escalation',
    'unauthorized_api_access',
    'malformed_request',
    'rate_limit_exceeded',
    'ip_blocked',
    'account_locked',
    'password_policy_violation',
    'session_hijack_attempt',
  ]),
  severity: auditSeveritySchema,
  userId: cuidSchema.optional(),
  ipAddress: ipAddressSchema,
  userAgent: userAgentSchema,
  details: z.record(z.unknown()),
  riskScore: z.number().min(0).max(100).default(0),
  actionTaken: z.string().max(255, 'Action taken must not exceed 255 characters').optional(),
  timestamp: dateSchema,
});

/**
 * Compliance audit schema
 */
export const complianceAuditSchema = z.object({
  complianceType: z.enum([
    'PCI_DSS',
    'GDPR',
    'SOX',
    'HIPAA',
    'SOC2',
    'ISO27001',
  ]),
  checkType: z.string().max(100, 'Check type must not exceed 100 characters'),
  status: z.enum(['PASS', 'FAIL', 'WARNING', 'NOT_APPLICABLE']),
  details: z.record(z.unknown()),
  evidence: z.array(z.string()).default([]),
  remediation: z.string().max(1000, 'Remediation must not exceed 1000 characters').optional(),
  timestamp: dateSchema,
  performedBy: cuidSchema.optional(),
});

// =============================================================================
// BULK OPERATIONS SCHEMAS
// =============================================================================

/**
 * Bulk audit log creation schema
 */
export const bulkCreateAuditLogsSchema = z.object({
  logs: z.array(createAuditLogSchema).min(1, 'At least one audit log is required').max(1000, 'Cannot create more than 1000 audit logs at once'),
  batchId: z.string().max(100, 'Batch ID must not exceed 100 characters').optional(),
});

/**
 * Audit log export schema
 */
export const exportAuditLogsSchema = z.object({
  filters: auditLogFilterSchema.optional(),
  format: z.enum(['json', 'csv', 'xml']).default('json'),
  includeMetadata: z.boolean().default(true),
  includeSensitiveData: z.boolean().default(false),
  maxRecords: z.number().int().min(1).max(100000).default(10000),
  requestedBy: cuidSchema,
  reason: z.string().max(500, 'Reason must not exceed 500 characters'),
});

// =============================================================================
// ANALYTICS SCHEMAS
// =============================================================================

/**
 * Audit analytics query schema
 */
export const auditAnalyticsSchema = z.object({
  startDate: dateSchema,
  endDate: dateSchema,
  groupBy: z.enum(['hour', 'day', 'week', 'month']).default('day'),
  actions: z.array(auditActionSchema).optional(),
  tables: z.array(auditTableNameSchema).optional(),
  users: z.array(cuidSchema).optional(),
  includeSystemActions: z.boolean().default(false),
});

/**
 * Security dashboard schema
 */
export const securityDashboardSchema = z.object({
  period: z.enum(['last_24_hours', 'last_7_days', 'last_30_days', 'custom']),
  startDate: optionalDateSchema,
  endDate: optionalDateSchema,
  metrics: z.array(z.enum([
    'total_events',
    'security_incidents',
    'failed_logins',
    'suspicious_activities',
    'blocked_ips',
    'compliance_checks',
  ])).default(['total_events', 'security_incidents', 'failed_logins']),
}).superRefine((data, ctx) => {
  if (data.period === 'custom') {
    if (!data.startDate || !data.endDate) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Start date and end date are required for custom period',
        path: ['startDate'],
      });
    }
  }
});

// =============================================================================
// RETENTION SCHEMAS
// =============================================================================

/**
 * Audit log retention policy schema
 */
export const auditRetentionPolicySchema = z.object({
  tableName: auditTableNameSchema.optional(), // If not specified, applies to all tables
  retentionDays: z.number().int().min(30).max(2555), // 30 days to 7 years
  archiveBeforeDelete: z.boolean().default(true),
  compressionEnabled: z.boolean().default(true),
  actions: z.array(auditActionSchema).optional(), // If specified, only applies to these actions
  severity: auditSeveritySchema.optional(), // If specified, only applies to this severity
});

/**
 * Audit log cleanup schema
 */
export const auditCleanupSchema = z.object({
  retentionPolicy: auditRetentionPolicySchema,
  dryRun: z.boolean().default(true),
  batchSize: z.number().int().min(100).max(10000).default(1000),
  maxExecutionTime: z.number().int().min(60).max(3600).default(300), // 1 to 60 minutes
  performedBy: cuidSchema,
});

// =============================================================================
// MONITORING SCHEMAS
// =============================================================================

/**
 * Audit alert schema
 */
export const auditAlertSchema = z.object({
  alertType: z.enum([
    'high_volume_changes',
    'suspicious_pattern',
    'compliance_violation',
    'security_breach',
    'data_corruption',
    'unauthorized_access',
  ]),
  severity: auditSeveritySchema,
  threshold: z.number().positive(),
  timeWindow: z.number().int().min(60).max(86400), // 1 minute to 24 hours
  conditions: z.record(z.unknown()),
  notificationChannels: z.array(z.enum(['email', 'slack', 'webhook', 'sms'])).min(1),
  isActive: z.boolean().default(true),
});

/**
 * Audit threshold monitoring schema
 */
export const auditThresholdSchema = z.object({
  metric: z.enum([
    'actions_per_minute',
    'failed_logins_per_hour',
    'changes_per_table',
    'security_events_per_day',
    'compliance_violations',
  ]),
  threshold: z.number().positive(),
  timeWindow: z.number().int().min(60),
  severity: auditSeveritySchema.default('MEDIUM'),
  autoResponse: z.enum(['alert', 'block', 'throttle', 'none']).default('alert'),
});

// =============================================================================
// PUBLIC SCHEMAS (FOR API RESPONSES)
// =============================================================================

/**
 * Public audit log schema (removes sensitive data)
 */
export const publicAuditLogSchema = auditLogSchema.omit({
  ipAddress: true,
  userAgent: true,
  oldValues: true,
  newValues: true,
  sessionId: true,
  requestId: true,
}).extend({
  hasChanges: z.boolean(),
  changeCount: z.number().min(0),
});

/**
 * Audit summary schema
 */
export const auditSummarySchema = z.object({
  id: z.string(),
  action: auditActionSchema,
  tableName: auditTableNameSchema,
  userId: cuidSchema.optional(),
  userEmail: emailSchema.optional(),
  timestamp: dateSchema,
  changeCount: z.number().min(0),
  severity: auditSeveritySchema.optional(),
});

// =============================================================================
// ADMIN SCHEMAS
// =============================================================================

/**
 * Admin audit log view schema
 */
export const adminAuditLogSchema = auditLogSchema.extend({
  user: z.object({
    id: cuidSchema,
    email: emailSchema,
    name: z.string().optional(),
    role: z.string(),
  }).optional(),
  relatedLogs: z.array(auditSummarySchema).default([]),
  riskAssessment: z.object({
    riskScore: z.number().min(0).max(100),
    riskFactors: z.array(z.string()),
    recommendation: z.string().optional(),
  }).optional(),
});

// =============================================================================
// TYPE EXPORTS
// =============================================================================

export type AuditLog = z.infer<typeof auditLogSchema>;
export type CreateAuditLog = z.infer<typeof createAuditLogSchema>;
export type AuditAction = z.infer<typeof auditActionSchema>;
export type AuditSeverity = z.infer<typeof auditSeveritySchema>;
export type AuditTableName = z.infer<typeof auditTableNameSchema>;
export type AuditLogFilter = z.infer<typeof auditLogFilterSchema>;
export type AuditLogSort = z.infer<typeof auditLogSortSchema>;
export type SecurityEvent = z.infer<typeof securityEventSchema>;
export type ComplianceAudit = z.infer<typeof complianceAuditSchema>;
export type BulkCreateAuditLogs = z.infer<typeof bulkCreateAuditLogsSchema>;
export type ExportAuditLogs = z.infer<typeof exportAuditLogsSchema>;
export type AuditAnalytics = z.infer<typeof auditAnalyticsSchema>;
export type SecurityDashboard = z.infer<typeof securityDashboardSchema>;
export type AuditRetentionPolicy = z.infer<typeof auditRetentionPolicySchema>;
export type AuditCleanup = z.infer<typeof auditCleanupSchema>;
export type AuditAlert = z.infer<typeof auditAlertSchema>;
export type PublicAuditLog = z.infer<typeof publicAuditLogSchema>;
export type AuditSummary = z.infer<typeof auditSummarySchema>;
export type AdminAuditLog = z.infer<typeof adminAuditLogSchema>;