/**
 * Server-Side Session Management for API Routes
 *
 * This module provides full database-backed session validation
 * for API routes and server components that can't use Edge Runtime.
 * Enhanced with granular permission checking and audit logging.
 */

import type { Session } from "@/lib/auth/config";
import { auth } from "@/lib/auth/config";
import { db } from "@/lib/db";
import type { Permission, UserRole } from "@/lib/permissions";
import {
  checkPermissionWithAudit,
  validateResourceAccess,
} from "@/lib/permissions";
import { NextRequest } from "next/server";

/**
 * Get and validate session with full database verification
 * Use this in API routes and server components
 */
export async function getServerSession(
  request?: NextRequest
): Promise<Session | null> {
  try {
    const headers = new Headers();

    if (request) {
      // Copy cookies from the request
      const cookie = request.headers.get("cookie");
      if (cookie) {
        headers.set("cookie", cookie);
      }
    }

    const session = await auth.api.getSession({ headers });
    return session as Session | null;
  } catch (_error) {
    // Don't log in production to avoid noise
    if (process.env.NODE_ENV === "development") {
      console.error("Server session validation error:", _error);
    }
    return null;
  }
}

/**
 * Validate API route access with full database verification
 */
export async function validateApiAccess(
  request: NextRequest,
  requiredRole?: "ADMIN" | "SUPPORT" | "CUSTOMER"
): Promise<{
  isValid: boolean;
  session: Session | null;
  error?: {
    code: number;
    message: string;
  };
}> {
  const session = await getServerSession(request);

  if (!session?.user) {
    return {
      isValid: false,
      session: null,
      error: {
        code: 401,
        message: "Authentication required",
      },
    };
  }

  // Check if user is active
  if (session.user.isActive === false) {
    return {
      isValid: false,
      session,
      error: {
        code: 403,
        message: "Account is deactivated",
      },
    };
  }

  // Check role if specified
  if (requiredRole) {
    const userRole = session.user.role || "CUSTOMER";
    const hasPermission = checkRolePermission(userRole, requiredRole);

    if (!hasPermission) {
      return {
        isValid: false,
        session,
        error: {
          code: 403,
          message: `${requiredRole} access required`,
        },
      };
    }
  }

  return {
    isValid: true,
    session,
  };
}

/**
 * Check if user role has permission for required role
 */
function checkRolePermission(
  userRole: string,
  requiredRole: "ADMIN" | "SUPPORT" | "CUSTOMER"
): boolean {
  switch (requiredRole) {
    case "ADMIN":
      return userRole === "ADMIN";
    case "SUPPORT":
      return userRole === "ADMIN" || userRole === "SUPPORT";
    case "CUSTOMER":
      return ["ADMIN", "SUPPORT", "CUSTOMER"].includes(userRole);
    default:
      return false;
  }
}

/**
 * Create standardized error response for API routes
 */
export function createApiErrorResponse(
  code: number,
  message: string,
  details?: unknown
): Response {
  return new Response(
    JSON.stringify({
      error: message,
      code,
      timestamp: new Date().toISOString(),
      ...(details && process.env.NODE_ENV === "development" ? { details } : {}),
    }),
    {
      status: code,
      headers: { "Content-Type": "application/json" },
    }
  );
}

/**
 * Enhanced permission validation with granular access control
 */
export async function validatePermission(
  request: NextRequest,
  permission: Permission,
  resourceId?: string
): Promise<{
  isValid: boolean;
  session: Session | null;
  auditData?: any;
  error?: {
    code: number;
    message: string;
  };
}> {
  const session = await getServerSession(request);

  if (!session?.user) {
    return {
      isValid: false,
      session: null,
      error: {
        code: 401,
        message: "Authentication required",
      },
    };
  }

  // Check if user is active
  if (session.user.isActive === false) {
    return {
      isValid: false,
      session,
      error: {
        code: 403,
        message: "Account is deactivated",
      },
    };
  }

  const userRole = session.user.role as UserRole;
  const ipAddress =
    request.headers.get("x-forwarded-for") ||
    request.headers.get("x-real-ip") ||
    "unknown";
  const userAgent = request.headers.get("user-agent") || "unknown";

  // Check permission with audit logging
  const permissionCheck = checkPermissionWithAudit(
    userRole,
    session.user.id,
    permission,
    resourceId,
    {
      action: `API_${permission.toUpperCase()}`,
      ipAddress,
      userAgent,
    }
  );

  if (!permissionCheck.allowed) {
    // Log unauthorized access attempt
    await logSecurityEvent({
      type: "UNAUTHORIZED_ACCESS_ATTEMPT",
      userId: session.user.id,
      userRole,
      permission,
      resourceId,
      ipAddress,
      userAgent,
      reason: permissionCheck.reason,
    });

    return {
      isValid: false,
      session,
      auditData: permissionCheck.auditData,
      error: {
        code: 403,
        message: permissionCheck.reason || "Insufficient permissions",
      },
    };
  }

  return {
    isValid: true,
    session,
    auditData: permissionCheck.auditData,
  };
}

/**
 * Resource-specific permission validation
 */
export async function validateResourcePermission<T extends Record<string, any>>(
  request: NextRequest,
  resource: T,
  resourceType: keyof typeof import("@/lib/permissions").RESOURCE_OWNERSHIP,
  permission: Permission
): Promise<{
  isValid: boolean;
  session: Session | null;
  error?: {
    code: number;
    message: string;
  };
}> {
  const session = await getServerSession(request);

  if (!session?.user) {
    return {
      isValid: false,
      session: null,
      error: {
        code: 401,
        message: "Authentication required",
      },
    };
  }

  const userRole = session.user.role as UserRole;
  const hasAccess = validateResourceAccess(
    userRole,
    session.user.id,
    resource,
    resourceType,
    permission
  );

  if (!hasAccess) {
    return {
      isValid: false,
      session,
      error: {
        code: 403,
        message: "Access denied to this resource",
      },
    };
  }

  return {
    isValid: true,
    session,
  };
}

/**
 * Middleware wrapper for API routes with permission-based access
 */
export function withPermission(
  handler: (
    request: NextRequest,
    session: Session,
    auditData?: any
  ) => Promise<Response>,
  permission: Permission,
  resourceId?: string | ((request: NextRequest) => Promise<string>)
) {
  return async (request: NextRequest): Promise<Response> => {
    // Resolve resource ID if it's a function
    let resolvedResourceId: string | undefined;
    if (typeof resourceId === "function") {
      try {
        resolvedResourceId = await resourceId(request);
      } catch (_error) {
        return createApiErrorResponse(400, "Invalid resource identifier");
      }
    } else {
      resolvedResourceId = resourceId;
    }

    const { isValid, session, auditData, error } = await validatePermission(
      request,
      permission,
      resolvedResourceId
    );

    if (!isValid || !session) {
      return createApiErrorResponse(
        error?.code || 401,
        error?.message || "Unauthorized"
      );
    }

    try {
      return await handler(request, session, auditData);
    } catch (_handlerError) {
      // Log API errors for security monitoring
      console.error("API handler error:", {
        error: _handlerError,
        permission,
        userId: session.user.id,
        userAgent: request.headers.get("user-agent"),
        ipAddress: request.headers.get("x-forwarded-for"),
      });

      return createApiErrorResponse(500, "Internal server error");
    }
  };
}

/**
 * Middleware wrapper for API routes (backwards compatibility)
 */
export function withAuth(
  handler: (request: NextRequest, session: Session) => Promise<Response>,
  requiredRole?: "ADMIN" | "SUPPORT" | "CUSTOMER"
) {
  return async (request: NextRequest): Promise<Response> => {
    const { isValid, session, error } = await validateApiAccess(
      request,
      requiredRole
    );

    if (!isValid || !session) {
      return createApiErrorResponse(
        error?.code || 401,
        error?.message || "Unauthorized"
      );
    }

    try {
      return await handler(request, session);
    } catch (_handlerError) {
      console.error("API handler error:", _handlerError);
      return createApiErrorResponse(500, "Internal server error");
    }
  };
}

/**
 * Log security events for monitoring and compliance
 */
async function logSecurityEvent(event: {
  type: string;
  userId: string;
  userRole: UserRole;
  permission?: Permission;
  resourceId?: string;
  ipAddress: string;
  userAgent: string;
  reason?: string;
}): Promise<void> {
  try {
    await db.auditLog.create({
      data: {
        tableName: "security_events",
        recordId: event.resourceId || event.userId,
        action: event.type,
        userId: event.userId,
        ipAddress: event.ipAddress,
        userAgent: event.userAgent,
        metadata: {
          userRole: event.userRole,
          permission: event.permission,
          reason: event.reason,
          timestamp: new Date().toISOString(),
        },
      },
    });
  } catch (_error) {
    // Don't throw on audit log failures, but log the error
    console.error("Failed to log security event:", _error);
  }
}

/**
 * Get audit context from request for logging
 */
export function getAuditContext(
  request: NextRequest,
  session: Session
): {
  adminUserId: string;
  adminRole: UserRole;
  ipAddress: string;
  userAgent: string;
  sessionId?: string;
} {
  return {
    adminUserId: session.user.id,
    adminRole: session.user.role as UserRole,
    ipAddress:
      request.headers.get("x-forwarded-for") ||
      request.headers.get("x-real-ip") ||
      "unknown",
    userAgent: request.headers.get("user-agent") || "unknown",
    sessionId: session.sessionId,
  };
}
