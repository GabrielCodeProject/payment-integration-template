/**
 * Server-Side Session Management for API Routes
 * 
 * This module provides full database-backed session validation
 * for API routes and server components that can't use Edge Runtime.
 */

import { NextRequest } from "next/server";
import { auth } from "@/lib/auth/config";
import type { Session } from "@/lib/auth/config";

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
  } catch (error) {
    // Don't log in production to avoid noise
    if (process.env.NODE_ENV === "development") {
      // eslint-disable-next-line no-console
      console.error("Server session validation error:", error);
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
 * Middleware wrapper for API routes
 */
export function withAuth(
  handler: (request: NextRequest, session: Session) => Promise<Response>,
  requiredRole?: "ADMIN" | "SUPPORT" | "CUSTOMER"
) {
  return async (request: NextRequest): Promise<Response> => {
    const { isValid, session, error } = await validateApiAccess(request, requiredRole);

    if (!isValid || !session) {
      return createApiErrorResponse(
        error?.code || 401,
        error?.message || "Unauthorized"
      );
    }

    try {
      return await handler(request, session);
    } catch (handlerError) {
      // eslint-disable-next-line no-console
      console.error("API handler error:", handlerError);
      return createApiErrorResponse(500, "Internal server error");
    }
  };
}