/**
 * Audit Middleware - Next.js Integration
 * NextJS Stripe Payment Template
 * 
 * Middleware for automatic audit context setup and logging
 * in Next.js API routes and Server Actions.
 */

import { NextRequest } from "next/server";
import { auditService, AuditContext, AuditHelpers } from "./audit";

/**
 * Middleware to automatically set audit context for API routes
 */
export function withAuditContext(
  handler: (
    request: NextRequest,
    context: { params: unknown }
  ) => Promise<Response> | Response
) {
  return async (request: NextRequest, context: { params: unknown }) => {
    // Extract user information from request (this would depend on your auth system)
    // For now, we'll use a placeholder approach
    const authHeader = request.headers.get('authorization');
    let user: { id: string; email: string } | undefined;
    
    // You would implement your actual user extraction logic here
    // For example, decode JWT token or lookup session
    if (authHeader && authHeader.startsWith('Bearer ')) {
      // Placeholder - implement your JWT decode logic
      try {
        // user = await decodeJWTAndGetUser(authHeader.substring(7));
      } catch (_error) {
        // Failed to decode auth token for audit context
      }
    }

    // Create audit context from request
    const auditContext = AuditHelpers.createContextFromRequest(request, user);

    try {
      // Set audit context for database operations
      await auditService.setAuditContext(auditContext);

      // Call the original handler
      const response = await handler(request, context);

      // Log successful API access
      await auditService.createAuditLog({
        tableName: 'api_access',
        recordId: `${request.method}-${new URL(request.url).pathname}`,
        action: 'ACCESS',
        metadata: {
          method: request.method,
          path: new URL(request.url).pathname,
          statusCode: response.status,
          responseTime: Date.now(),
        },
        context: auditContext,
      });

      return response;
    } catch (_error) {
      // Log failed API access
      await auditService.createAuditLog({
        tableName: 'api_access',
        recordId: `${request.method}-${new URL(request.url).pathname}`,
        action: 'ACCESS',
        metadata: {
          method: request.method,
          path: new URL(request.url).pathname,
          error: error instanceof Error ? error.message : 'Unknown error',
          failed: true,
        },
        context: auditContext,
      }).catch(_auditError => {
        // Failed to log API error to audit
      });

      throw error;
    } finally {
      // Always clear the audit context
      await auditService.clearAuditContext().catch(_error => {
        // Failed to clear audit context
      });
    }
  };
}

/**
 * Decorator for Server Actions with audit logging
 */
export function withAudit<T extends (...args: unknown[]) => Promise<unknown>>(
  action: T,
  auditConfig: {
    tableName: string;
    action: string;
    getRecordId: (...args: Parameters<T>) => string | Promise<string>;
    getOldValues?: (...args: Parameters<T>) => unknown | Promise<unknown>;
    getNewValues?: (result: Awaited<ReturnType<T>>, ...args: Parameters<T>) => unknown;
    getMetadata?: (...args: Parameters<T>) => Record<string, unknown> | Promise<Record<string, unknown>>;
    skipOnError?: boolean;
  }
): T {
  return (async (...args: Parameters<T>) => {
    const startTime = Date.now();
    let result: Awaited<ReturnType<T>>;
    let error: Error | null = null;

    try {
      // Get old values before action (if configured)
      const oldValues = auditConfig.getOldValues 
        ? await auditConfig.getOldValues(...args)
        : null;

      // Execute the action
      result = await action(...args);

      // Get new values after action (if configured)
      const newValues = auditConfig.getNewValues
        ? auditConfig.getNewValues(result, ...args)
        : result;

      // Get additional metadata
      const metadata = auditConfig.getMetadata
        ? await auditConfig.getMetadata(...args)
        : {};

      // Log successful action
      const recordId = await auditConfig.getRecordId(...args);
      await auditService.createAuditLog({
        tableName: auditConfig.tableName,
        recordId: recordId.toString(),
        action: auditConfig.action,
        oldValues: oldValues,
        newValues: newValues,
        changedFields: oldValues && newValues 
          ? AuditHelpers.getChangedFields(oldValues, newValues)
          : undefined,
        metadata: {
          ...metadata,
          actionName: action.name,
          executionTime: Date.now() - startTime,
          success: true,
        },
      });

      return result;
    } catch (err) {
      error = err instanceof Error ? err : new Error('Unknown error');

      if (!auditConfig.skipOnError) {
        try {
          const recordId = await auditConfig.getRecordId(...args);
          const metadata = auditConfig.getMetadata
            ? await auditConfig.getMetadata(...args)
            : {};

          await auditService.createAuditLog({
            tableName: auditConfig.tableName,
            recordId: recordId.toString(),
            action: auditConfig.action,
            metadata: {
              ...metadata,
              actionName: action.name,
              executionTime: Date.now() - startTime,
              success: false,
              error: error.message,
              errorStack: error.stack,
            },
          });
        } catch (_auditError) {
          // Failed to log error to audit
        }
      }

      throw error;
    }
  }) as T;
}

/**
 * Authentication audit logging helpers
 */
export class AuthAuditLogger {
  /**
   * Log successful login
   */
  static async logLogin(
    userId: string,
    email: string,
    ipAddress?: string,
    userAgent?: string
  ): Promise<void> {
    await auditService.createAuditLog({
      tableName: 'authentication',
      recordId: userId,
      action: 'LOGIN',
      metadata: {
        event: 'successful_login',
        timestamp: new Date().toISOString(),
        method: 'password', // or 'oauth', 'sso', etc.
      },
      context: {
        userId,
        userEmail: email,
        ipAddress,
        userAgent,
      },
    });
  }

  /**
   * Log failed login attempt
   */
  static async logFailedLogin(
    email: string,
    reason: string,
    ipAddress?: string,
    userAgent?: string
  ): Promise<void> {
    await auditService.createAuditLog({
      tableName: 'authentication',
      recordId: `failed-${email}-${Date.now()}`,
      action: 'LOGIN',
      metadata: {
        event: 'failed_login',
        email,
        reason,
        timestamp: new Date().toISOString(),
        risk_level: 'HIGH',
      },
      context: {
        userEmail: email,
        ipAddress,
        userAgent,
      },
    });
  }

  /**
   * Log logout
   */
  static async logLogout(
    userId: string,
    email: string,
    sessionDuration?: number,
    ipAddress?: string,
    userAgent?: string
  ): Promise<void> {
    await auditService.createAuditLog({
      tableName: 'authentication',
      recordId: userId,
      action: 'LOGOUT',
      metadata: {
        event: 'logout',
        sessionDuration,
        timestamp: new Date().toISOString(),
      },
      context: {
        userId,
        userEmail: email,
        ipAddress,
        userAgent,
      },
    });
  }

  /**
   * Log password change
   */
  static async logPasswordChange(
    userId: string,
    email: string,
    triggeredBy: 'user' | 'admin' | 'reset',
    ipAddress?: string,
    userAgent?: string
  ): Promise<void> {
    await auditService.createAuditLog({
      tableName: 'authentication',
      recordId: userId,
      action: 'UPDATE',
      metadata: {
        event: 'password_change',
        triggeredBy,
        timestamp: new Date().toISOString(),
        risk_level: 'MEDIUM',
      },
      context: {
        userId,
        userEmail: email,
        ipAddress,
        userAgent,
      },
    });
  }

  /**
   * Log account lockout
   */
  static async logAccountLockout(
    email: string,
    reason: string,
    duration?: number,
    ipAddress?: string,
    userAgent?: string
  ): Promise<void> {
    await auditService.createAuditLog({
      tableName: 'authentication',
      recordId: `lockout-${email}-${Date.now()}`,
      action: 'UPDATE',
      metadata: {
        event: 'account_lockout',
        email,
        reason,
        duration,
        timestamp: new Date().toISOString(),
        risk_level: 'HIGH',
      },
      context: {
        userEmail: email,
        ipAddress,
        userAgent,
      },
    });
  }
}

/**
 * Payment audit logging helpers
 */
export class PaymentAuditLogger {
  /**
   * Log payment attempt
   */
  static async logPaymentAttempt(
    userId: string,
    orderId: string,
    amount: number,
    currency: string,
    paymentMethodId: string,
    status: 'success' | 'failed' | 'pending',
    context?: AuditContext
  ): Promise<void> {
    await auditService.createAuditLog({
      tableName: 'payments',
      recordId: orderId,
      action: 'CREATE',
      metadata: {
        event: 'payment_attempt',
        amount,
        currency,
        paymentMethodId,
        status,
        timestamp: new Date().toISOString(),
        risk_level: 'HIGH',
      },
      context: {
        userId,
        ...context,
      },
    });
  }

  /**
   * Log refund
   */
  static async logRefund(
    userId: string,
    orderId: string,
    amount: number,
    currency: string,
    reason: string,
    processedBy: string,
    context?: AuditContext
  ): Promise<void> {
    await auditService.createAuditLog({
      tableName: 'payments',
      recordId: `refund-${orderId}-${Date.now()}`,
      action: 'UPDATE',
      metadata: {
        event: 'refund_processed',
        orderId,
        amount,
        currency,
        reason,
        processedBy,
        timestamp: new Date().toISOString(),
        risk_level: 'MEDIUM',
      },
      context: {
        userId: processedBy, // The admin/support user processing the refund
        ...context,
      },
    });
  }

  /**
   * Log subscription change
   */
  static async logSubscriptionChange(
    userId: string,
    subscriptionId: string,
    action: 'create' | 'update' | 'cancel' | 'reactivate',
    changes: Record<string, unknown>,
    context?: AuditContext
  ): Promise<void> {
    await auditService.createAuditLog({
      tableName: 'subscriptions',
      recordId: subscriptionId,
      action: action.toUpperCase(),
      metadata: {
        event: `subscription_${action}`,
        changes,
        timestamp: new Date().toISOString(),
        risk_level: 'MEDIUM',
      },
      context: {
        userId,
        ...context,
      },
    });
  }
}

/**
 * Data export audit logging
 */
export class DataAuditLogger {
  /**
   * Log data export
   */
  static async logDataExport(
    userId: string,
    dataType: string,
    recordCount: number,
    format: string,
    filters?: Record<string, unknown>,
    context?: AuditContext
  ): Promise<void> {
    await auditService.createAuditLog({
      tableName: 'data_export',
      recordId: `export-${dataType}-${Date.now()}`,
      action: 'EXPORT',
      metadata: {
        event: 'data_export',
        dataType,
        recordCount,
        format,
        filters,
        timestamp: new Date().toISOString(),
        risk_level: 'HIGH', // Data exports are always high-risk
      },
      context: {
        userId,
        ...context,
      },
    });
  }

  /**
   * Log data import
   */
  static async logDataImport(
    userId: string,
    dataType: string,
    recordCount: number,
    format: string,
    source: string,
    context?: AuditContext
  ): Promise<void> {
    await auditService.createAuditLog({
      tableName: 'data_import',
      recordId: `import-${dataType}-${Date.now()}`,
      action: 'IMPORT',
      metadata: {
        event: 'data_import',
        dataType,
        recordCount,
        format,
        source,
        timestamp: new Date().toISOString(),
        risk_level: 'HIGH', // Data imports are always high-risk
      },
      context: {
        userId,
        ...context,
      },
    });
  }

  /**
   * Log sensitive data access
   */
  static async logSensitiveDataAccess(
    userId: string,
    dataType: 'user_pii' | 'payment_info' | 'financial_data' | 'audit_logs',
    recordId: string,
    operation: 'view' | 'edit' | 'delete',
    context?: AuditContext
  ): Promise<void> {
    await auditService.createAuditLog({
      tableName: dataType,
      recordId,
      action: 'ACCESS',
      metadata: {
        event: 'sensitive_data_access',
        dataType,
        operation,
        timestamp: new Date().toISOString(),
        risk_level: 'CRITICAL', // Sensitive data access is critical
      },
      context: {
        userId,
        ...context,
      },
    });
  }
}