/**
 * Edge Runtime Compatible Middleware Utilities
 * 
 * This module provides all middleware functionality without any database
 * or Node.js API dependencies for Edge Runtime compatibility.
 */

import { NextRequest, NextResponse } from "next/server";

// Types for Edge Runtime middleware
export interface EdgeAuthConfig {
  publicRoutes: string[];
  protectedRoutes: string[];
  adminRoutes: string[];
  authRoutes: string[];
  apiPublicRoutes: string[];
  apiProtectedRoutes: string[];
  apiAdminRoutes: string[];
}

// Edge-compatible session type
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

// JWT payload interface
interface TokenPayload {
  sub: string;
  email: string;
  name: string;
  role?: string;
  isActive?: boolean;
  sessionId: string;
  exp: number;
  iat: number;
}

/**
 * Default auth configuration for Edge Runtime
 */
export const edgeAuthConfig: EdgeAuthConfig = {
  publicRoutes: ["/", "/about", "/contact", "/pricing", "/api/health"],
  protectedRoutes: ["/dashboard", "/profile", "/billing", "/checkout"],
  adminRoutes: ["/admin"],
  authRoutes: [
    "/auth/signin",
    "/auth/signup",
    "/auth/forgot-password",
    "/auth/verify-email",
  ],
  apiPublicRoutes: ["/api/auth", "/api/stripe/webhook", "/api/health"],
  apiProtectedRoutes: ["/api/protected"],
  apiAdminRoutes: ["/api/admin"],
};

/**
 * Get session from request (Edge Runtime compatible)
 */
export async function getEdgeSession(
  request: NextRequest
): Promise<EdgeSession | null> {
  try {
    const sessionToken = request.cookies.get("better-auth.session_token")?.value;
    
    if (!sessionToken) {
      return null;
    }

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
  } catch (error) {
    if (process.env.NODE_ENV === "development") {
      // eslint-disable-next-line no-console
      console.error("Edge session validation error:", error);
    }
    return null;
  }
}

/**
 * Validate JWT token format (Edge Runtime compatible)
 */
async function validateTokenFormat(token: string): Promise<TokenPayload | null> {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) {
      return null;
    }

    const payloadPart = parts[1];
    if (!payloadPart) {
      return null;
    }
    
    const payload = JSON.parse(
      Buffer.from(payloadPart, "base64url").toString("utf-8")
    );

    if (!payload.sub || !payload.email || !payload.exp) {
      return null;
    }

    return payload as TokenPayload;
  } catch (_error) {
    return null;
  }
}

/**
 * Route checking functions (Edge Runtime compatible)
 */
export function isPublicRoute(pathname: string, config: EdgeAuthConfig): boolean {
  return config.publicRoutes.some(
    (route) => pathname === route || pathname.startsWith(route + "/")
  );
}

export function isProtectedRoute(pathname: string, config: EdgeAuthConfig): boolean {
  return config.protectedRoutes.some(
    (route) => pathname === route || pathname.startsWith(route + "/")
  );
}

export function isAdminRoute(pathname: string, config: EdgeAuthConfig): boolean {
  return config.adminRoutes.some(
    (route) => pathname === route || pathname.startsWith(route + "/")
  );
}

export function isAuthRoute(pathname: string, config: EdgeAuthConfig): boolean {
  return config.authRoutes.some(
    (route) => pathname === route || pathname.startsWith(route + "/")
  );
}

export function isPublicApiRoute(pathname: string, config: EdgeAuthConfig): boolean {
  return config.apiPublicRoutes.some(
    (route) => pathname === route || pathname.startsWith(route + "/")
  );
}

export function isProtectedApiRoute(pathname: string, config: EdgeAuthConfig): boolean {
  return config.apiProtectedRoutes.some(
    (route) => pathname === route || pathname.startsWith(route + "/")
  );
}

export function isAdminApiRoute(pathname: string, config: EdgeAuthConfig): boolean {
  return config.apiAdminRoutes.some(
    (route) => pathname === route || pathname.startsWith(route + "/")
  );
}

/**
 * Check user role (Edge Runtime compatible)
 */
export function hasRequiredRole(
  session: EdgeSession | null,
  requiredRole: "ADMIN" | "SUPPORT" | "CUSTOMER"
): boolean {
  if (!session?.user) {
    return false;
  }

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
 * Create auth redirect (Edge Runtime compatible)
 */
export function createAuthRedirect(
  request: NextRequest,
  redirectTo: string
): NextResponse {
  const url = new URL(redirectTo, request.url);

  if (!isAuthRoute(redirectTo, edgeAuthConfig)) {
    url.searchParams.set("callbackUrl", request.url);
  }

  return NextResponse.redirect(url);
}

/**
 * Validate route access (Edge Runtime compatible)
 */
export async function validateEdgeRouteAccess(
  request: NextRequest,
  config: EdgeAuthConfig = edgeAuthConfig
): Promise<{
  isAllowed: boolean;
  session: EdgeSession | null;
  reason?: string;
}> {
  const pathname = request.nextUrl.pathname;
  const session = await getEdgeSession(request);

  // Public routes are always allowed
  if (isPublicRoute(pathname, config) || isPublicApiRoute(pathname, config)) {
    return { isAllowed: true, session };
  }

  // Auth routes - redirect if already authenticated
  if (isAuthRoute(pathname, config)) {
    if (session?.user) {
      return { 
        isAllowed: false, 
        session, 
        reason: "Already authenticated"
      };
    }
    return { isAllowed: true, session };
  }

  // Protected routes - require authentication
  if (
    isProtectedRoute(pathname, config) ||
    isProtectedApiRoute(pathname, config)
  ) {
    if (!session?.user) {
      return { 
        isAllowed: false, 
        session, 
        reason: "Authentication required"
      };
    }

    if (session.user.isActive === false) {
      return { 
        isAllowed: false, 
        session, 
        reason: "Account is deactivated"
      };
    }

    return { isAllowed: true, session };
  }

  // Admin routes - require admin role
  if (isAdminRoute(pathname, config) || isAdminApiRoute(pathname, config)) {
    if (!session?.user) {
      return { 
        isAllowed: false, 
        session, 
        reason: "Authentication required"
      };
    }

    if (!hasRequiredRole(session, "ADMIN")) {
      return { 
        isAllowed: false, 
        session, 
        reason: "Admin access required"
      };
    }

    return { isAllowed: true, session };
  }

  return { isAllowed: true, session };
}

/**
 * Get client IP (Edge Runtime compatible)
 */
export function getClientIP(request: NextRequest): string {
  const forwarded = request.headers.get("x-forwarded-for");
  const realIP = request.headers.get("x-real-ip");
  const cfIP = request.headers.get("cf-connecting-ip");

  if (cfIP) return cfIP;
  if (forwarded) return forwarded.split(",")[0]?.trim() ?? "unknown";
  if (realIP) return realIP;

  return "unknown";
}

/**
 * Log auth events (Edge Runtime compatible)
 */
export function logAuthEvent(
  event: "success" | "failure" | "blocked",
  details: {
    pathname: string;
    ip: string;
    userAgent?: string;
    userId?: string;
    reason?: string;
  }
): void {
  if (process.env.NODE_ENV === "development") {
    // eslint-disable-next-line no-console
    console.log(`[AUTH-${event.toUpperCase()}]`, {
      timestamp: new Date().toISOString(),
      ...details,
    });
  }
}

/**
 * Rate limiting (Edge Runtime compatible)
 */
const rateLimitCache = new Map<string, { count: number; resetTime: number }>();

export function checkRateLimit(
  identifier: string,
  limit: number = 10,
  windowMs: number = 60000
): { allowed: boolean; remaining: number; resetTime: number } {
  const now = Date.now();

  // Clean up expired entries
  for (const [key, value] of rateLimitCache.entries()) {
    if (value.resetTime < now) {
      rateLimitCache.delete(key);
    }
  }

  const current = rateLimitCache.get(identifier);

  if (!current || current.resetTime < now) {
    const resetTime = now + windowMs;
    rateLimitCache.set(identifier, { count: 1, resetTime });
    return { allowed: true, remaining: limit - 1, resetTime };
  }

  if (current.count >= limit) {
    return { allowed: false, remaining: 0, resetTime: current.resetTime };
  }

  current.count++;
  return {
    allowed: true,
    remaining: limit - current.count,
    resetTime: current.resetTime,
  };
}