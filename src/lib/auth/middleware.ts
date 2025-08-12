/**
 * Authentication Middleware Utilities for Payment Integration Template
 *
 * This module provides utilities for NextJS middleware to handle:
 * - Session validation and verification
 * - Role-based access control
 * - Redirect logic for authentication flows
 * - Performance optimizations for middleware
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "./config";
import type { Session, User } from "./config";

// Types for middleware configuration
export interface AuthConfig {
  publicRoutes: string[];
  protectedRoutes: string[];
  adminRoutes: string[];
  authRoutes: string[];
  apiPublicRoutes: string[];
  apiProtectedRoutes: string[];
  apiAdminRoutes: string[];
}

// Default route configuration
export const defaultAuthConfig: AuthConfig = {
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

// Cache for session validation to improve performance
const sessionCache = new Map<
  string,
  { session: Session | null; timestamp: number }
>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * Get session from request with caching for performance
 */
export async function getSessionFromRequest(
  request: NextRequest
): Promise<Session | null> {
  try {
    // Extract session token from cookies
    const sessionToken = request.cookies.get(
      "better-auth.session_token"
    )?.value;

    if (!sessionToken) {
      return null;
    }

    // Check cache first
    const cached = sessionCache.get(sessionToken);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      return cached.session;
    }

    // Verify session with BetterAuth using headers
    const session = await auth.api.getSession({
      headers: new Headers({
        cookie: request.headers.get("cookie") || "",
      }),
    });

    // Cache the result
    sessionCache.set(sessionToken, {
      session: session as Session | null,
      timestamp: Date.now(),
    });

    // Clean up old cache entries periodically
    if (sessionCache.size > 1000) {
      cleanupSessionCache();
    }

    return session as Session | null;
  } catch (error) {
    // Don't log in production to avoid noise
    if (process.env.NODE_ENV === "development") {
      // eslint-disable-next-line no-console
      console.error("Session validation error:", error);
    }
    return null;
  }
}

/**
 * Clean up expired cache entries
 */
function cleanupSessionCache() {
  const now = Date.now();
  for (const [key, value] of sessionCache.entries()) {
    if (now - value.timestamp > CACHE_TTL) {
      sessionCache.delete(key);
    }
  }
}

/**
 * Check if route is public (no authentication required)
 */
export function isPublicRoute(
  pathname: string,
  config: AuthConfig = defaultAuthConfig
): boolean {
  return config.publicRoutes.some(
    (route) => pathname === route || pathname.startsWith(route + "/")
  );
}

/**
 * Check if route requires authentication
 */
export function isProtectedRoute(
  pathname: string,
  config: AuthConfig = defaultAuthConfig
): boolean {
  return config.protectedRoutes.some(
    (route) => pathname === route || pathname.startsWith(route + "/")
  );
}

/**
 * Check if route requires admin access
 */
export function isAdminRoute(
  pathname: string,
  config: AuthConfig = defaultAuthConfig
): boolean {
  return config.adminRoutes.some(
    (route) => pathname === route || pathname.startsWith(route + "/")
  );
}

/**
 * Check if route is an auth route (signin, signup, etc.)
 */
export function isAuthRoute(
  pathname: string,
  config: AuthConfig = defaultAuthConfig
): boolean {
  return config.authRoutes.some(
    (route) => pathname === route || pathname.startsWith(route + "/")
  );
}

/**
 * Check if API route is public
 */
export function isPublicApiRoute(
  pathname: string,
  config: AuthConfig = defaultAuthConfig
): boolean {
  return config.apiPublicRoutes.some(
    (route) => pathname === route || pathname.startsWith(route + "/")
  );
}

/**
 * Check if API route requires authentication
 */
export function isProtectedApiRoute(
  pathname: string,
  config: AuthConfig = defaultAuthConfig
): boolean {
  return config.apiProtectedRoutes.some(
    (route) => pathname === route || pathname.startsWith(route + "/")
  );
}

/**
 * Check if API route requires admin access
 */
export function isAdminApiRoute(
  pathname: string,
  config: AuthConfig = defaultAuthConfig
): boolean {
  return config.apiAdminRoutes.some(
    (route) => pathname === route || pathname.startsWith(route + "/")
  );
}

/**
 * Check if user has required role
 */
export function hasRequiredRole(
  user: User | null,
  requiredRole: "ADMIN" | "SUPPORT" | "CUSTOMER"
): boolean {
  if (!user) {
    return false;
  }

  // Check if user is active
  const isActive = user.isActive;
  if (isActive === false) {
    return false;
  }

  // Get user role
  const userRole = user.role;

  switch (requiredRole) {
    case "ADMIN":
      return userRole === "ADMIN";
    case "SUPPORT":
      return userRole === "ADMIN" || userRole === "SUPPORT";
    case "CUSTOMER":
      return (
        userRole === "ADMIN" ||
        userRole === "SUPPORT" ||
        userRole === "CUSTOMER"
      );
    default:
      return false;
  }
}

/**
 * Create redirect response for authentication
 */
export function createAuthRedirect(
  request: NextRequest,
  redirectTo: string
): NextResponse {
  const url = new URL(redirectTo, request.url);

  // Add callback URL for post-auth redirect
  if (!isAuthRoute(redirectTo)) {
    url.searchParams.set("callbackUrl", request.url);
  }

  return NextResponse.redirect(url);
}

/**
 * Create unauthorized response for API routes
 */
export function createUnauthorizedResponse(
  message: string = "Unauthorized"
): NextResponse {
  return NextResponse.json(
    {
      error: "Unauthorized",
      message,
      timestamp: new Date().toISOString(),
    },
    { status: 401 }
  );
}

/**
 * Create forbidden response for API routes
 */
export function createForbiddenResponse(
  message: string = "Forbidden"
): NextResponse {
  return NextResponse.json(
    {
      error: "Forbidden",
      message,
      timestamp: new Date().toISOString(),
    },
    { status: 403 }
  );
}

/**
 * Validate session and check permissions for route
 */
export async function validateRouteAccess(
  request: NextRequest,
  config: AuthConfig = defaultAuthConfig
): Promise<{
  isAllowed: boolean;
  session: Session | null;
  redirect?: NextResponse;
}> {
  const pathname = request.nextUrl.pathname;
  const session = await getSessionFromRequest(request);

  // Public routes are always allowed
  if (isPublicRoute(pathname, config) || isPublicApiRoute(pathname, config)) {
    return { isAllowed: true, session };
  }

  // Auth routes - redirect if already authenticated
  if (isAuthRoute(pathname, config)) {
    if (session?.user) {
      const redirect = createAuthRedirect(request, "/dashboard");
      return { isAllowed: false, session, redirect };
    }
    return { isAllowed: true, session };
  }

  // Protected routes - require authentication
  if (
    isProtectedRoute(pathname, config) ||
    isProtectedApiRoute(pathname, config)
  ) {
    if (!session?.user) {
      const redirect = pathname.startsWith("/api/")
        ? createUnauthorizedResponse("Authentication required")
        : createAuthRedirect(request, "/auth/signin");
      return { isAllowed: false, session, redirect };
    }

    // Check if user is active
    const isActive = session.user.isActive;
    if (isActive === false) {
      const redirect = pathname.startsWith("/api/")
        ? createForbiddenResponse("Account is deactivated")
        : createAuthRedirect(request, "/auth/account-deactivated");
      return { isAllowed: false, session, redirect };
    }

    return { isAllowed: true, session };
  }

  // Admin routes - require admin role
  if (isAdminRoute(pathname, config) || isAdminApiRoute(pathname, config)) {
    if (!session?.user) {
      const redirect = pathname.startsWith("/api/")
        ? createUnauthorizedResponse("Authentication required")
        : createAuthRedirect(request, "/auth/signin");
      return { isAllowed: false, session, redirect };
    }

    if (!hasRequiredRole(session.user, "ADMIN")) {
      const redirect = pathname.startsWith("/api/")
        ? createForbiddenResponse("Admin access required")
        : createAuthRedirect(request, "/unauthorized");
      return { isAllowed: false, session, redirect };
    }

    return { isAllowed: true, session };
  }

  // Default: allow access
  return { isAllowed: true, session };
}

/**
 * Get user IP address for logging and rate limiting
 */
export function getClientIP(request: NextRequest): string {
  const forwarded = request.headers.get("x-forwarded-for");
  const realIP = request.headers.get("x-real-ip");
  const cfIP = request.headers.get("cf-connecting-ip");

  if (cfIP) return cfIP;
  if (forwarded) return forwarded.split(",")[0].trim();
  if (realIP) return realIP;

  return "unknown";
}

/**
 * Log authentication events for security monitoring
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
  // In production, this should integrate with your logging service
  // Only log in development to avoid console noise in production
  if (process.env.NODE_ENV === "development") {
    // eslint-disable-next-line no-console
    console.log(`[AUTH-${event.toUpperCase()}]`, {
      timestamp: new Date().toISOString(),
      ...details,
    });
  }
}

/**
 * Rate limiting helper for authentication endpoints
 */
const rateLimitCache = new Map<string, { count: number; resetTime: number }>();

export function checkRateLimit(
  identifier: string,
  limit: number = 10,
  windowMs: number = 60000 // 1 minute
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
    // New or expired entry
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
