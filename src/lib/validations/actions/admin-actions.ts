import { z } from 'zod';
import {
  cuidSchema,
  limitSchema,
  pageSchema,
} from '../base/common';

/**
 * Admin Actions Validation Schemas
 * 
 * Server Action validation schemas for administrative operations.
 * These schemas handle system management, analytics, and admin-only functions.
 */

// =============================================================================
// SYSTEM MANAGEMENT ACTIONS
// =============================================================================

export const getSystemStatsActionSchema = z.object({
  period: z.enum(['last_24_hours', 'last_7_days', 'last_30_days', 'custom']),
  startDate: z.date().optional(),
  endDate: z.date().optional(),
  includeUserStats: z.boolean().default(true),
  includeOrderStats: z.boolean().default(true),
  includeRevenueStats: z.boolean().default(true),
}).refine(
  (data) => {
    if (data.period === 'custom') {
      return data.startDate && data.endDate;
    }
    return true;
  },
  {
    message: 'Start date and end date are required for custom period',
    path: ['startDate'],
  }
);

export const getAuditLogsActionSchema = z.object({
  filters: z.object({
    userId: cuidSchema.optional(),
    action: z.string().optional(),
    tableName: z.string().optional(),
    startDate: z.date().optional(),
    endDate: z.date().optional(),
  }).optional(),
  pagination: z.object({
    page: pageSchema,
    limit: limitSchema,
  }).optional(),
});

export const exportSystemDataActionSchema = z.object({
  dataType: z.enum(['users', 'orders', 'products', 'audit_logs', 'all']),
  format: z.enum(['csv', 'json', 'xlsx']).default('csv'),
  filters: z.record(z.unknown()).optional(),
  maxRecords: z.number().int().min(1).max(50000).default(10000),
  includePersonalData: z.boolean().default(false),
});

// =============================================================================
// RESPONSE SCHEMAS
// =============================================================================

export const adminActionSuccessSchema = z.object({
  success: z.literal(true),
  data: z.record(z.unknown()),
  message: z.string().optional(),
});

export const adminActionErrorSchema = z.object({
  success: z.literal(false),
  error: z.string(),
  code: z.enum([
    'PERMISSION_DENIED',
    'INVALID_PARAMETERS',
    'SYSTEM_ERROR',
    'DATA_EXPORT_FAILED',
    'AUDIT_LOG_ERROR',
  ]).optional(),
  details: z.record(z.unknown()).optional(),
});

export const adminActionResponseSchema = z.union([
  adminActionSuccessSchema,
  adminActionErrorSchema,
]);

// =============================================================================
// TYPE EXPORTS
// =============================================================================

export type GetSystemStatsAction = z.infer<typeof getSystemStatsActionSchema>;
export type GetAuditLogsAction = z.infer<typeof getAuditLogsActionSchema>;
export type ExportSystemDataAction = z.infer<typeof exportSystemDataActionSchema>;
export type AdminActionSuccess = z.infer<typeof adminActionSuccessSchema>;
export type AdminActionError = z.infer<typeof adminActionErrorSchema>;
export type AdminActionResponse = z.infer<typeof adminActionResponseSchema>;