import { NextRequest, NextResponse } from "next/server";
import { getClientEnv } from "./lib/env";

/**
 * Next.js Middleware for Payment Integration Template
 * 
 * This middleware handles:
 * - Authentication redirects
 * - Rate limiting for API routes
 * - Security headers
 * - Environment-based routing
 */

// =============================================================================
// MIDDLEWARE CONFIGURATION
// =============================================================================

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const clientEnv = getClientEnv();
  
  // =============================================================================
  // SECURITY HEADERS
  // =============================================================================
  const response = NextResponse.next();
  
  // Add security headers
  response.headers.set('X-DNS-Prefetch-Control', 'on');
  response.headers.set('Strict-Transport-Security', 'max-age=63072000; includeSubDomains; preload');
  
  // Add CSP header for payment pages
  if (pathname.startsWith('/checkout') || pathname.startsWith('/payment')) {
    const cspHeader = [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://js.stripe.com",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src 'self' https://fonts.gstatic.com",
      "img-src 'self' data: https:",
      "connect-src 'self' https://api.stripe.com https://*.stripe.com",
      "frame-src 'self' https://js.stripe.com https://hooks.stripe.com",
      "form-action 'self'",
      "base-uri 'self'",
      "object-src 'none'",
    ].join('; ');
    
    response.headers.set('Content-Security-Policy', cspHeader);
  }

  // =============================================================================
  // API ROUTE PROTECTION
  // =============================================================================
  if (pathname.startsWith('/api/')) {
    
    // Rate limiting for API routes
    if (pathname.startsWith('/api/payments') || pathname.startsWith('/api/webhooks')) {
      // TODO: Implement proper rate limiting with Redis or database
      // For now, we'll add basic headers
      response.headers.set('X-RateLimit-Limit', '100');
      response.headers.set('X-RateLimit-Remaining', '99');
    }

    // Webhook validation
    if (pathname.startsWith('/api/webhooks/stripe')) {
      const signature = request.headers.get('stripe-signature');
      if (!signature) {
        return new NextResponse('Missing Stripe signature', { status: 400 });
      }
    }

    // CORS for API routes
    if (request.method === 'OPTIONS') {
      return new NextResponse(null, {
        status: 200,
        headers: {
          'Access-Control-Allow-Origin': clientEnv.NEXT_PUBLIC_APP_URL,
          'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization, stripe-signature',
          'Access-Control-Max-Age': '86400',
        },
      });
    }
  }

  // =============================================================================
  // AUTHENTICATION ROUTES
  // =============================================================================
  
  // Protected routes that require authentication
  const protectedRoutes = ['/dashboard', '/profile', '/billing', '/checkout'];
  const isProtectedRoute = protectedRoutes.some(route => pathname.startsWith(route));

  if (isProtectedRoute) {
    // TODO: Implement authentication check with BetterAuth
    // For now, we'll allow access to all routes
    
    // Example authentication logic (replace with BetterAuth implementation):
    // const session = await getSession(request);
    // if (!session) {
    //   const loginUrl = new URL('/auth/signin', request.url);
    //   loginUrl.searchParams.set('callbackUrl', request.url);
    //   return NextResponse.redirect(loginUrl);
    // }
  }

  // Authentication pages (redirect if already authenticated)
  const authRoutes = ['/auth/signin', '/auth/signup', '/auth/forgot-password'];
  const isAuthRoute = authRoutes.some(route => pathname.startsWith(route));

  if (isAuthRoute) {
    // TODO: Implement authentication check with BetterAuth
    // Example logic:
    // const session = await getSession(request);
    // if (session) {
    //   return NextResponse.redirect(new URL('/dashboard', request.url));
    // }
  }

  // =============================================================================
  // ENVIRONMENT-SPECIFIC REDIRECTS
  // =============================================================================
  
  // Redirect to maintenance page in specific environments
  if (process.env.MAINTENANCE_MODE === 'true' && !pathname.startsWith('/maintenance')) {
    return NextResponse.redirect(new URL('/maintenance', request.url));
  }

  // Development-only routes
  if (process.env.NODE_ENV === 'production' && pathname.startsWith('/dev')) {
    return new NextResponse('Not Found', { status: 404 });
  }

  // =============================================================================
  // STRIPE TEST MODE WARNINGS
  // =============================================================================
  
  // Add test mode warning headers for payment pages
  if (clientEnv.NEXT_PUBLIC_STRIPE_TEST_MODE === 'true' && 
      (pathname.startsWith('/checkout') || pathname.startsWith('/payment'))) {
    response.headers.set('X-Stripe-Test-Mode', 'true');
  }

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
     */
    '/((?!_next/static|_next/image|favicon.ico|public/).*)',
  ],
};

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

/**
 * Get client IP address for rate limiting
 */
function getClientIP(request: NextRequest): string {
  const forwarded = request.headers.get('x-forwarded-for');
  const realIP = request.headers.get('x-real-ip');
  
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }
  
  if (realIP) {
    return realIP;
  }
  
  return 'unknown';
}

/**
 * Check if request is from a bot
 */
function isBot(request: NextRequest): boolean {
  const userAgent = request.headers.get('user-agent') || '';
  const botPatterns = [
    'bot', 'crawler', 'spider', 'scraper',
    'facebook', 'twitter', 'linkedin',
    'googlebot', 'bingbot', 'slackbot'
  ];
  
  return botPatterns.some(pattern => 
    userAgent.toLowerCase().includes(pattern)
  );
}

/**
 * Generate nonce for CSP
 */
function generateNonce(): string {
  const array = new Uint8Array(16);
  crypto.getRandomValues(array);
  return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
}