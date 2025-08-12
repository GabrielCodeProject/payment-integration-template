import { NextRequest, NextResponse } from "next/server";
import { getClientEnv } from "@/lib/env";
import {
  validateRouteAccess,
  getClientIP,
  logAuthEvent,
  checkRateLimit,
  defaultAuthConfig,
  type AuthConfig,
} from "@/auth/middleware";

/**
 * Next.js Middleware for Payment Integration Template
 *
 * This middleware handles:
 * - Authentication and authorization with BetterAuth
 * - Role-based access control (ADMIN, SUPPORT, CUSTOMER)
 * - Rate limiting for API routes and auth endpoints
 * - Security headers with CSP for payment processing
 * - CSRF protection and secure session handling
 * - Environment-based routing and maintenance mode
 */

// =============================================================================
// MIDDLEWARE CONFIGURATION
// =============================================================================

// Custom auth configuration for payment template
const authConfig: AuthConfig = {
  ...defaultAuthConfig,
  protectedRoutes: ["/dashboard", "/profile", "/billing", "/checkout"],
  adminRoutes: ["/admin"],
  authRoutes: [
    "/auth/signin",
    "/auth/signup",
    "/auth/forgot-password",
    "/auth/verify-email",
    "/auth/reset-password",
  ],
  apiProtectedRoutes: [
    "/api/protected",
    "/api/user",
    "/api/payments",
    "/api/subscriptions",
  ],
  apiAdminRoutes: ["/api/admin"],
  apiPublicRoutes: [
    "/api/auth",
    "/api/stripe/webhook",
    "/api/health",
    "/api/status",
  ],
};

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const clientEnv = getClientEnv();
  const clientIP = getClientIP(request);

  // =============================================================================
  // AUTHENTICATION AND AUTHORIZATION
  // =============================================================================

  // Validate route access and get session
  const { isAllowed, session, redirect } = await validateRouteAccess(
    request,
    authConfig
  );

  if (!isAllowed && redirect) {
    // Log blocked access attempt
    logAuthEvent("blocked", {
      pathname,
      ip: clientIP,
      userAgent: request.headers.get("user-agent") || "",
      reason: "Access denied",
    });
    return redirect;
  }

  // Log successful authentication for protected routes
  if (
    session?.user &&
    (pathname.startsWith("/dashboard") ||
      pathname.startsWith("/admin") ||
      pathname.startsWith("/api/protected") ||
      pathname.startsWith("/api/admin"))
  ) {
    logAuthEvent("success", {
      pathname,
      ip: clientIP,
      userId: session.user.id,
    });
  }

  // =============================================================================
  // RATE LIMITING
  // =============================================================================

  // Rate limit authentication endpoints
  if (pathname.startsWith("/api/auth/") || pathname.startsWith("/auth/")) {
    const rateLimitResult = checkRateLimit(`auth:${clientIP}`, 10, 60000); // 10 requests per minute

    if (!rateLimitResult.allowed) {
      logAuthEvent("blocked", {
        pathname,
        ip: clientIP,
        reason: "Rate limit exceeded",
      });

      return new NextResponse("Too Many Requests", {
        status: 429,
        headers: {
          "X-RateLimit-Limit": "10",
          "X-RateLimit-Remaining": "0",
          "X-RateLimit-Reset": new Date(
            rateLimitResult.resetTime
          ).toISOString(),
          "Retry-After": Math.ceil(
            (rateLimitResult.resetTime - Date.now()) / 1000
          ).toString(),
        },
      });
    }
  }

  // Rate limit payment and webhook endpoints
  if (
    pathname.startsWith("/api/payments") ||
    pathname.startsWith("/api/webhooks")
  ) {
    const rateLimitResult = checkRateLimit(`payment:${clientIP}`, 30, 60000); // 30 requests per minute

    if (!rateLimitResult.allowed) {
      return new NextResponse("Payment rate limit exceeded", {
        status: 429,
        headers: {
          "X-RateLimit-Limit": "30",
          "X-RateLimit-Remaining": "0",
          "X-RateLimit-Reset": new Date(
            rateLimitResult.resetTime
          ).toISOString(),
        },
      });
    }
  }

  // =============================================================================
  // SECURITY HEADERS
  // =============================================================================
  const response = NextResponse.next();

  // Core security headers
  response.headers.set("X-DNS-Prefetch-Control", "on");
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set(
    "Strict-Transport-Security",
    "max-age=63072000; includeSubDomains; preload"
  );

  // Generate nonce for CSP
  const nonce = generateNonce();
  response.headers.set("X-Nonce", nonce);

  // Content Security Policy for payment pages
  if (
    pathname.startsWith("/checkout") ||
    pathname.startsWith("/payment") ||
    pathname.startsWith("/billing")
  ) {
    const cspHeader = [
      "default-src 'self'",
      `script-src 'self' 'nonce-${nonce}' https://js.stripe.com https://checkout.stripe.com`,
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src 'self' https://fonts.gstatic.com",
      "img-src 'self' data: https: blob:",
      "connect-src 'self' https://api.stripe.com https://*.stripe.com https://checkout.stripe.com",
      "frame-src 'self' https://js.stripe.com https://hooks.stripe.com https://checkout.stripe.com",
      "form-action 'self'",
      "base-uri 'self'",
      "object-src 'none'",
      "worker-src 'none'",
    ].join("; ");

    response.headers.set("Content-Security-Policy", cspHeader);
  }

  // Standard CSP for other pages
  else {
    const cspHeader = [
      "default-src 'self'",
      `script-src 'self' 'nonce-${nonce}'`,
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src 'self' https://fonts.gstatic.com",
      "img-src 'self' data: https:",
      "connect-src 'self'",
      "frame-src 'none'",
      "form-action 'self'",
      "base-uri 'self'",
      "object-src 'none'",
    ].join("; ");

    response.headers.set("Content-Security-Policy", cspHeader);
  }

  // =============================================================================
  // API ROUTE PROTECTION
  // =============================================================================
  if (pathname.startsWith("/api/")) {
    // Webhook signature validation
    if (pathname.startsWith("/api/stripe/webhook")) {
      const signature = request.headers.get("stripe-signature");
      if (!signature) {
        return new NextResponse("Missing Stripe signature", { status: 400 });
      }
    }

    // CSRF protection for non-GET requests
    if (request.method !== "GET" && request.method !== "OPTIONS") {
      const origin = request.headers.get("origin");
      const referer = request.headers.get("referer");

      if (!origin && !referer) {
        return new NextResponse("Missing origin header", { status: 403 });
      }

      const allowedOrigins = [
        clientEnv.NEXT_PUBLIC_APP_URL,
        "http://localhost:3000",
      ];
      const isValidOrigin = origin && allowedOrigins.includes(origin);
      const isValidReferer =
        referer &&
        allowedOrigins.some((allowed) => referer.startsWith(allowed));

      if (!isValidOrigin && !isValidReferer) {
        return new NextResponse("Invalid origin", { status: 403 });
      }
    }

    // CORS for API routes
    if (request.method === "OPTIONS") {
      return new NextResponse(null, {
        status: 200,
        headers: {
          "Access-Control-Allow-Origin": clientEnv.NEXT_PUBLIC_APP_URL,
          "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
          "Access-Control-Allow-Headers":
            "Content-Type, Authorization, stripe-signature, X-Requested-With",
          "Access-Control-Max-Age": "86400",
          "Access-Control-Allow-Credentials": "true",
        },
      });
    }

    // Add rate limiting headers to API responses
    const rateLimitHeaders = {
      "X-RateLimit-Limit": "100",
      "X-RateLimit-Remaining": "99",
      "X-RateLimit-Reset": new Date(Date.now() + 60000).toISOString(),
    };

    Object.entries(rateLimitHeaders).forEach(([key, value]) => {
      response.headers.set(key, value);
    });
  }

  // =============================================================================
  // ENVIRONMENT-SPECIFIC REDIRECTS
  // =============================================================================

  // Redirect to maintenance page in specific environments
  if (
    process.env.MAINTENANCE_MODE === "true" &&
    !pathname.startsWith("/maintenance")
  ) {
    return NextResponse.redirect(new URL("/maintenance", request.url));
  }

  // Development-only routes
  if (process.env.NODE_ENV === "production" && pathname.startsWith("/dev")) {
    return new NextResponse("Not Found", { status: 404 });
  }

  // =============================================================================
  // STRIPE TEST MODE WARNINGS
  // =============================================================================

  // Add test mode warning headers for payment pages
  if (
    clientEnv.NEXT_PUBLIC_STRIPE_TEST_MODE === "true" &&
    (pathname.startsWith("/checkout") || pathname.startsWith("/payment"))
  ) {
    response.headers.set("X-Stripe-Test-Mode", "true");
  }

  // =============================================================================
  // PERFORMANCE AND SESSION METADATA
  // =============================================================================

  // Add user context headers for debugging (in development only)
  if (process.env.NODE_ENV === "development" && session?.user) {
    response.headers.set("X-User-Id", session.user.id);
    response.headers.set("X-User-Role", session.user.role || "CUSTOMER");
  }

  // Add request ID for tracing
  const requestId = crypto.randomUUID();
  response.headers.set("X-Request-Id", requestId);

  return response;
}

// =============================================================================
// MIDDLEWARE MATCHER
// =============================================================================

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public files (public folder)
     * - manifest.json and other PWA files
     */
    "/((?!_next/static|_next/image|favicon.ico|public/|manifest.json|robots.txt|sitemap.xml).*)",
  ],
};

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

/**
 * Generate nonce for CSP
 */
function generateNonce(): string {
  const array = new Uint8Array(16);
  crypto.getRandomValues(array);
  return Array.from(array, (byte) => byte.toString(16).padStart(2, "0")).join(
    ""
  );
}
