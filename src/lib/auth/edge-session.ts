/**
 * Edge Runtime Compatible Session Management
 *
 * This module provides session validation for Next.js middleware
 * without requiring database connections or Node.js APIs.
 * It works by validating JWT tokens directly.
 */

import { NextRequest } from "next/server";

// Types for edge-compatible session
export interface EdgeSession {
  user: {
    id: string;
    email: string;
    name: string;
    role?: string;
    isActive?: boolean;
  };
  session: {
    id: string;
    userId: string;
    expiresAt: Date;
  };
}

// JWT payload interface for BetterAuth tokens
interface TokenPayload {
  sub: string; // user ID
  email: string;
  name: string;
  role?: string;
  isActive?: boolean;
  sessionId: string;
  exp: number;
  iat: number;
}

/**
 * Get session from request without database access
 * This validates the JWT token directly for Edge Runtime compatibility
 */
export async function getEdgeSession(
  request: NextRequest
): Promise<EdgeSession | null> {
  try {
    // Get session token from cookies
    const sessionToken = request.cookies.get(
      "better-auth.session_token"
    )?.value;

    if (!sessionToken) {
      return null;
    }

    // For Edge Runtime, we'll validate the token format and expiry
    // without database verification (which will be done in API routes)
    const payload = await validateTokenFormat(sessionToken);

    if (!payload || payload.exp * 1000 < Date.now()) {
      return null;
    }

    return {
      user: {
        id: payload.sub,
        email: payload.email,
        name: payload.name,
        role: payload.role || "CUSTOMER",
        isActive: payload.isActive !== false,
      },
      session: {
        id: payload.sessionId,
        userId: payload.sub,
        expiresAt: new Date(payload.exp * 1000),
      },
    };
  } catch (_error) {
    // Don't log in production to avoid noise
    if (process.env.NODE_ENV === "development") {
      console.error("Edge session validation error:", _error);
    }
    return null;
  }
}

/**
 * Validate JWT token format without full verification
 * This is a basic validation for Edge Runtime - full verification happens in API routes
 */
async function validateTokenFormat(
  token: string
): Promise<TokenPayload | null> {
  try {
    // Basic JWT format check
    const parts = token.split(".");
    if (parts.length !== 3) {
      return null;
    }

    // Decode payload (without signature verification for Edge Runtime)
    const payloadPart = parts[1];
    if (!payloadPart) {
      return null;
    }

    const payload = JSON.parse(
      Buffer.from(payloadPart, "base64url").toString("utf-8")
    );

    // Basic payload validation
    if (!payload.sub || !payload.email || !payload.exp) {
      return null;
    }

    return payload as TokenPayload;
  } catch (_error) {
    return null;
  }
}

/**
 * Check if user has required role (Edge Runtime compatible)
 */
export function hasRequiredRoleEdge(
  session: EdgeSession | null,
  requiredRole: "ADMIN" | "SUPPORT" | "CUSTOMER"
): boolean {
  if (!session?.user) {
    return false;
  }

  // Check if user is active
  if (session.user.isActive === false) {
    return false;
  }

  const userRole = session.user.role || "CUSTOMER";

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
 * Validate route access with Edge Runtime compatibility
 */
export async function validateEdgeRouteAccess(
  request: NextRequest,
  config: {
    publicRoutes: string[];
    protectedRoutes: string[];
    adminRoutes: string[];
    authRoutes: string[];
    apiPublicRoutes: string[];
    apiProtectedRoutes: string[];
    apiAdminRoutes: string[];
  }
): Promise<{
  isAllowed: boolean;
  session: EdgeSession | null;
  requiresFullValidation: boolean;
  reason?: string;
}> {
  const pathname = request.nextUrl.pathname;
  const session = await getEdgeSession(request);

  // Public routes are always allowed
  if (
    config.publicRoutes.some(
      (route) => pathname === route || pathname.startsWith(route + "/")
    ) ||
    config.apiPublicRoutes.some(
      (route) => pathname === route || pathname.startsWith(route + "/")
    )
  ) {
    return { isAllowed: true, session, requiresFullValidation: false };
  }

  // Auth routes - redirect if already authenticated
  if (
    config.authRoutes.some(
      (route) => pathname === route || pathname.startsWith(route + "/")
    )
  ) {
    if (session?.user) {
      return {
        isAllowed: false,
        session,
        requiresFullValidation: false,
        reason: "Already authenticated",
      };
    }
    return { isAllowed: true, session, requiresFullValidation: false };
  }

  // Protected routes - require authentication
  if (
    config.protectedRoutes.some(
      (route) => pathname === route || pathname.startsWith(route + "/")
    ) ||
    config.apiProtectedRoutes.some(
      (route) => pathname === route || pathname.startsWith(route + "/")
    )
  ) {
    if (!session?.user) {
      return {
        isAllowed: false,
        session,
        requiresFullValidation: false,
        reason: "Authentication required",
      };
    }

    // For protected routes, we need full session validation in API routes
    // but we can allow access based on token format validation
    return {
      isAllowed: true,
      session,
      requiresFullValidation: pathname.startsWith("/api/"),
    };
  }

  // Admin routes - require admin role
  if (
    config.adminRoutes.some(
      (route) => pathname === route || pathname.startsWith(route + "/")
    ) ||
    config.apiAdminRoutes.some(
      (route) => pathname === route || pathname.startsWith(route + "/")
    )
  ) {
    if (!session?.user) {
      return {
        isAllowed: false,
        session,
        requiresFullValidation: false,
        reason: "Authentication required",
      };
    }

    if (!hasRequiredRoleEdge(session, "ADMIN")) {
      return {
        isAllowed: false,
        session,
        requiresFullValidation: false,
        reason: "Admin access required",
      };
    }

    return {
      isAllowed: true,
      session,
      requiresFullValidation: pathname.startsWith("/api/"),
    };
  }

  // Default: allow access
  return { isAllowed: true, session, requiresFullValidation: false };
}
