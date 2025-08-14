/**
 * Audit Logging System - TypeScript Utilities
 * NextJS Stripe Payment Template
 * 
 * Provides comprehensive audit logging capabilities with automatic
 * database triggers and manual logging functions for security compliance.
 */

import { PrismaClient } from "@prisma/client";
import { db } from "./db";

// Audit log types and interfaces
export interface AuditContext {
  userId?: string;
  userEmail?: string;
  ipAddress?: string;
  userAgent?: string;
  sessionId?: string;
  requestId?: string;
}

export interface AuditLogEntry {
  id: string;
  tableName: string;
  recordId: string;
  action: 'CREATE' | 'UPDATE' | 'DELETE';
  userId?: string | null;
  userEmail?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  oldValues?: unknown;
  newValues?: unknown;
  changedFields: string[];
  timestamp: Date;
  sessionId?: string | null;
  requestId?: string | null;
  metadata?: unknown;
}

export interface AuditQueryOptions {
  limit?: number;
  offset?: number;
  startDate?: Date;
  endDate?: Date;
  actions?: string[];
  userId?: string;
  tableName?: string;
}

export interface AuditTrailSummary {
  totalRecords: number;
  dateRange: {
    earliest: Date | null;
    latest: Date | null;
  };
  actionCounts: Record<string, number>;
  tableCounts: Record<string, number>;
  userCounts: Record<string, number>;
}

/**
 * Main audit logging service class
 */
export class AuditService {
  private db: PrismaClient;
  private defaultContext: AuditContext = {};

  constructor(prismaClient?: PrismaClient) {
    this.db = prismaClient || db;
  }

  /**
   * Set the audit context for database operations
   * This context is used by database triggers for automatic audit logging
   */
  async setAuditContext(context: AuditContext): Promise<void> {
    try {
      await this.db.$executeRaw`
        SELECT set_audit_context(
          ${context.userId || null}::TEXT,
          ${context.userEmail || null}::TEXT,
          ${context.ipAddress || null}::TEXT,
          ${context.userAgent || null}::TEXT,
          ${context.sessionId || null}::TEXT,
          ${context.requestId || null}::TEXT
        )
      `;
      
      // Store context for manual operations
      this.defaultContext = { ...context };
    } catch (_error) {
      // Failed to set audit context
      throw new Error('Failed to set audit context');
    }
  }

  /**
   * Clear the audit context
   */
  async clearAuditContext(): Promise<void> {
    try {
      await this.db.$executeRaw`SELECT clear_audit_context()`;
      this.defaultContext = {};
    } catch (_error) {
      // Failed to clear audit context
      throw new Error('Failed to clear audit context');
    }
  }

  /**
   * Manually create an audit log entry
   * Use this for operations not covered by automatic triggers
   */
  async createAuditLog(params: {
    tableName: string;
    recordId: string;
    action: 'CREATE' | 'UPDATE' | 'DELETE' | 'LOGIN' | 'LOGOUT' | 'ACCESS' | 'EXPORT' | 'IMPORT';
    oldValues?: unknown;
    newValues?: unknown;
    changedFields?: string[];
    metadata?: Record<string, unknown>;
    context?: AuditContext;
  }): Promise<void> {
    const auditContext = { ...this.defaultContext, ...params.context };
    
    try {
      await this.db.$executeRaw`
        SELECT create_manual_audit_log(
          ${params.tableName}::TEXT,
          ${params.recordId}::TEXT,
          ${params.action}::TEXT,
          ${params.oldValues ? JSON.stringify(params.oldValues) : null}::JSON,
          ${params.newValues ? JSON.stringify(params.newValues) : null}::JSON,
          ${params.changedFields || []}::TEXT[],
          ${params.metadata ? JSON.stringify({
            ...params.metadata,
            manual_entry: true,
            context: auditContext
          }) : JSON.stringify({ manual_entry: true, context: auditContext })}::JSON
        )
      `;
    } catch (_error) {
      // Failed to create manual audit log
      throw new Error('Failed to create audit log entry');
    }
  }

  /**
   * Get audit trail for a specific record
   */
  async getAuditTrail(
    tableName: string,
    recordId: string,
    options: { limit?: number } = {}
  ): Promise<AuditLogEntry[]> {
    try {
      const result = await this.db.$queryRaw<AuditLogEntry[]>`
        SELECT * FROM get_audit_trail(
          ${tableName}::TEXT,
          ${recordId}::TEXT,
          ${options.limit || 50}::INTEGER
        )
      `;
      
      return result.map(entry => ({
        ...entry,
        timestamp: new Date(entry.timestamp),
        oldValues: entry.oldValues ? JSON.parse(entry.oldValues as string) : null,
        newValues: entry.newValues ? JSON.parse(entry.newValues as string) : null,
        metadata: entry.metadata ? JSON.parse(entry.metadata as string) : null,
      }));
    } catch (_error) {
      // Failed to get audit trail
      throw new Error('Failed to retrieve audit trail');
    }
  }

  /**
   * Query audit logs with flexible filtering
   */
  async queryAuditLogs(options: AuditQueryOptions = {}): Promise<AuditLogEntry[]> {
    const {
      limit = 100,
      offset = 0,
      startDate,
      endDate,
      actions,
      userId,
      tableName
    } = options;

    try {
      const whereConditions: string[] = [];
      const parameters: unknown[] = [];

      if (startDate) {
        whereConditions.push(`timestamp >= $${parameters.length + 1}`);
        parameters.push(startDate);
      }

      if (endDate) {
        whereConditions.push(`timestamp <= $${parameters.length + 1}`);
        parameters.push(endDate);
      }

      if (actions && actions.length > 0) {
        whereConditions.push(`action = ANY($${parameters.length + 1})`);
        parameters.push(actions);
      }

      if (userId) {
        whereConditions.push(`"userId" = $${parameters.length + 1}`);
        parameters.push(userId);
      }

      if (tableName) {
        whereConditions.push(`"tableName" = $${parameters.length + 1}`);
        parameters.push(tableName);
      }

      const whereClause = whereConditions.length > 0 
        ? `WHERE ${whereConditions.join(' AND ')}` 
        : '';

      const query = `
        SELECT * FROM audit_logs 
        ${whereClause}
        ORDER BY timestamp DESC
        LIMIT $${parameters.length + 1}
        OFFSET $${parameters.length + 2}
      `;

      parameters.push(limit, offset);

      const result = await this.db.$queryRawUnsafe<AuditLogEntry[]>(query, ...parameters);
      
      return result.map(entry => ({
        ...entry,
        timestamp: new Date(entry.timestamp),
        oldValues: entry.oldValues ? JSON.parse(entry.oldValues as string) : null,
        newValues: entry.newValues ? JSON.parse(entry.newValues as string) : null,
        metadata: entry.metadata ? JSON.parse(entry.metadata as string) : null,
      }));
    } catch (_error) {
      // Failed to query audit logs
      throw new Error('Failed to query audit logs');
    }
  }

  /**
   * Get audit log statistics and summary
   */
  async getAuditSummary(
    startDate?: Date,
    endDate?: Date
  ): Promise<AuditTrailSummary> {
    try {
      const whereConditions: string[] = [];
      const parameters: unknown[] = [];

      if (startDate) {
        whereConditions.push(`timestamp >= $${parameters.length + 1}`);
        parameters.push(startDate);
      }

      if (endDate) {
        whereConditions.push(`timestamp <= $${parameters.length + 1}`);
        parameters.push(endDate);
      }

      const whereClause = whereConditions.length > 0 
        ? `WHERE ${whereConditions.join(' AND ')}` 
        : '';

      // Get basic statistics
      const statsQuery = `
        SELECT 
          COUNT(*) as total_records,
          MIN(timestamp) as earliest,
          MAX(timestamp) as latest
        FROM audit_logs
        ${whereClause}
      `;

      const [stats] = await this.db.$queryRawUnsafe<Array<{
        total_records: bigint;
        earliest: Date | null;
        latest: Date | null;
      }>>(statsQuery, ...parameters);

      // Get action counts
      const actionCountsQuery = `
        SELECT action, COUNT(*) as count
        FROM audit_logs
        ${whereClause}
        GROUP BY action
        ORDER BY count DESC
      `;

      const actionCounts = await this.db.$queryRawUnsafe<Array<{
        action: string;
        count: bigint;
      }>>(actionCountsQuery, ...parameters);

      // Get table counts
      const tableCountsQuery = `
        SELECT "tableName", COUNT(*) as count
        FROM audit_logs
        ${whereClause}
        GROUP BY "tableName"
        ORDER BY count DESC
      `;

      const tableCounts = await this.db.$queryRawUnsafe<Array<{
        tableName: string;
        count: bigint;
      }>>(tableCountsQuery, ...parameters);

      // Get user counts (excluding system entries)
      const userCountsQuery = `
        SELECT "userEmail", COUNT(*) as count
        FROM audit_logs
        ${whereClause}
        AND "userEmail" IS NOT NULL
        AND "userEmail" NOT LIKE 'system%'
        GROUP BY "userEmail"
        ORDER BY count DESC
        LIMIT 20
      `;

      const userCounts = await this.db.$queryRawUnsafe<Array<{
        userEmail: string;
        count: bigint;
      }>>(userCountsQuery, ...parameters);

      return {
        totalRecords: Number(stats.total_records),
        dateRange: {
          earliest: stats.earliest,
          latest: stats.latest,
        },
        actionCounts: Object.fromEntries(
          actionCounts.map(item => [item.action, Number(item.count)])
        ),
        tableCounts: Object.fromEntries(
          tableCounts.map(item => [item.tableName, Number(item.count)])
        ),
        userCounts: Object.fromEntries(
          userCounts.map(item => [item.userEmail, Number(item.count)])
        ),
      };
    } catch (_error) {
      // Failed to get audit summary
      throw new Error('Failed to generate audit summary');
    }
  }

  /**
   * Clean up old audit logs based on retention policy
   */
  async cleanupAuditLogs(
    retentionDays: number = 90,
    criticalRetentionDays: number = 365,
    batchSize: number = 1000
  ): Promise<number> {
    try {
      const result = await this.db.$queryRaw<Array<{ cleanup_audit_logs: number }>>`
        SELECT cleanup_audit_logs(
          ${retentionDays}::INTEGER,
          ${criticalRetentionDays}::INTEGER,
          ${batchSize}::INTEGER
        )
      `;
      
      return result[0]?.cleanup_audit_logs || 0;
    } catch (_error) {
      // Failed to cleanup audit logs
      throw new Error('Failed to cleanup audit logs');
    }
  }

  /**
   * Check if audit triggers are enabled
   */
  async checkTriggerStatus(): Promise<Array<{
    tableName: string;
    triggerName: string;
    triggerEnabled: boolean;
  }>> {
    try {
      const result = await this.db.$queryRaw<Array<{
        table_name: string;
        trigger_name: string;
        trigger_enabled: boolean;
      }>>`
        SELECT * FROM check_audit_trigger_status()
      `;
      
      return result.map(row => ({
        tableName: row.table_name,
        triggerName: row.trigger_name,
        triggerEnabled: row.trigger_enabled,
      }));
    } catch (_error) {
      // Failed to check trigger status
      throw new Error('Failed to check audit trigger status');
    }
  }

  /**
   * Disable all audit triggers (for maintenance)
   */
  async disableAuditTriggers(): Promise<void> {
    try {
      await this.db.$executeRaw`SELECT disable_audit_triggers()`;
    } catch (_error) {
      // Failed to disable audit triggers
      throw new Error('Failed to disable audit triggers');
    }
  }

  /**
   * Enable all audit triggers
   */
  async enableAuditTriggers(): Promise<void> {
    try {
      await this.db.$executeRaw`SELECT enable_audit_triggers()`;
    } catch (_error) {
      // Failed to enable audit triggers
      throw new Error('Failed to enable audit triggers');
    }
  }
}

/**
 * Audit logging decorators and helpers
 */
export class AuditHelpers {
  /**
   * Create audit context from Next.js request
   */
  static createContextFromRequest(
    request: Request,
    user?: { id: string; email: string }
  ): AuditContext {
    const userAgent = request.headers.get('user-agent') || undefined;
    const forwarded = request.headers.get('x-forwarded-for');
    const realIp = request.headers.get('x-real-ip');
    const ipAddress = forwarded?.split(',')[0].trim() || realIp || undefined;
    
    return {
      userId: user?.id,
      userEmail: user?.email,
      ipAddress,
      userAgent,
      requestId: crypto.randomUUID(), // Generate unique request ID
    };
  }

  /**
   * Create audit context from Next.js API route context
   */
  static async createContextFromNextRequest(
    req: unknown, // NextApiRequest type
    user?: { id: string; email: string }
  ): Promise<AuditContext> {
    return {
      userId: user?.id,
      userEmail: user?.email,
      ipAddress: req.socket?.remoteAddress || 
                 req.headers['x-forwarded-for']?.split(',')[0].trim() || 
                 req.headers['x-real-ip'],
      userAgent: req.headers['user-agent'],
      requestId: crypto.randomUUID(),
    };
  }

  /**
   * Audit a function call automatically
   */
  static auditFunction<T extends (...args: unknown[]) => unknown>(
    func: T,
    auditParams: {
      tableName: string;
      action: string;
      getRecordId: (...args: Parameters<T>) => string;
      getMetadata?: (...args: Parameters<T>) => Record<string, unknown>;
    },
    auditService: AuditService
  ): T {
    return ((...args: Parameters<T>) => {
      const result = func(...args);
      
      // Create audit log after function execution
      const recordId = auditParams.getRecordId(...args);
      const metadata = auditParams.getMetadata?.(...args) || {};
      
      auditService.createAuditLog({
        tableName: auditParams.tableName,
        recordId,
        action: auditParams.action,
        metadata: {
          ...metadata,
          functionName: func.name,
          timestamp: new Date().toISOString(),
        },
      }).catch(_error => {
        // Audit logging failed
      });
      
      return result;
    }) as T;
  }

  /**
   * Compare two objects and identify changed fields
   */
  static getChangedFields(oldData: Record<string, unknown>, newData: Record<string, unknown>): string[] {
    const changedFields: string[] = [];
    
    // Check all fields in new data
    for (const key in newData) {
      if (key === 'updatedAt' || key === 'updated_at') continue; // Skip auto-update fields
      
      const oldValue = oldData[key];
      const newValue = newData[key];
      
      // Handle different types of comparisons
      if (oldValue === null && newValue !== null) {
        changedFields.push(key);
      } else if (oldValue !== null && newValue === null) {
        changedFields.push(key);
      } else if (typeof oldValue === 'object' && typeof newValue === 'object') {
        // For objects, do a deep comparison (simplified)
        if (JSON.stringify(oldValue) !== JSON.stringify(newValue)) {
          changedFields.push(key);
        }
      } else if (oldValue !== newValue) {
        changedFields.push(key);
      }
    }
    
    // Check for deleted fields
    for (const key in oldData) {
      if (!(key in newData) && key !== 'updatedAt' && key !== 'updated_at') {
        changedFields.push(key);
      }
    }
    
    return changedFields;
  }

  /**
   * Mask sensitive data in audit logs
   */
  static maskSensitiveData(data: Record<string, unknown>): Record<string, unknown> {
    const sensitiveFields = [
      'password',
      'hashedPassword',
      'token',
      'apiKey',
      'secret',
      'privateKey',
      'creditCard',
      'ssn',
      'taxId',
      'bankAccount',
      'routingNumber',
    ];
    
    const masked = { ...data };
    
    sensitiveFields.forEach(field => {
      if (field in masked && masked[field] !== null && masked[field] !== undefined) {
        if (typeof masked[field] === 'string') {
          // Show first 2 and last 2 characters for strings longer than 4 chars
          const str = masked[field] as string;
          if (str.length > 4) {
            masked[field] = `${str.substring(0, 2)}***${str.substring(str.length - 2)}`;
          } else {
            masked[field] = '[MASKED]';
          }
        } else {
          masked[field] = '[MASKED]';
        }
      }
    });
    
    return masked;
  }
}

// Create a default audit service instance
export const auditService = new AuditService();

// Export types for external use
export type { AuditLogEntry, AuditContext, AuditQueryOptions, AuditTrailSummary };