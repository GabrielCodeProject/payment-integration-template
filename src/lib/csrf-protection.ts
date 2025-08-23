/**
 * Enhanced CSRF Protection with Double-Submit Cookie Pattern
 * 
 * This module implements advanced CSRF protection using multiple techniques:
 * - Double-submit cookie pattern
 * - Custom headers validation
 * - Synchronizer token pattern for forms
 */

import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

// CSRF token configuration
// Use __Secure- prefix only in production for security, regular name in development for compatibility
const CSRF_TOKEN_NAME = process.env.NODE_ENV === "production" ? "__Secure-csrf-token" : "csrf-token";
const CSRF_HEADER_NAME = "x-csrf-token";
const CSRF_FORM_FIELD = "_csrf";
const TOKEN_LENGTH = 32;
const TOKEN_EXPIRY = 60 * 60 * 1000; // 1 hour

export interface CSRFConfig {
  excludePaths?: string[];
  requireCustomHeader?: boolean;
  cookieOptions?: {
    secure?: boolean;
    httpOnly?: boolean;
    sameSite?: "strict" | "lax" | "none";
    path?: string;
  };
}

/**
 * Generate cryptographically secure CSRF token
 */
function generateCSRFToken(): string {
  const array = new Uint8Array(TOKEN_LENGTH);
  crypto.getRandomValues(array);
  return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
}

/**
 * Create CSRF token with timestamp
 */
function createTimestampedToken(): string {
  const token = generateCSRFToken();
  const timestamp = Date.now();
  return `${token}.${timestamp}`;
}

/**
 * Validate CSRF token and timestamp
 */
function validateTimestampedToken(token: string): boolean {
  if (!token) return false;
  
  const parts = token.split('.');
  if (parts.length !== 2) return false;
  
  const [tokenPart, timestampPart] = parts;
  const timestamp = parseInt(timestampPart);
  
  if (isNaN(timestamp)) return false;
  if (Date.now() - timestamp > TOKEN_EXPIRY) return false;
  if (tokenPart.length !== TOKEN_LENGTH * 2) return false;
  
  return true;
}

/**
 * Set CSRF token in response cookies
 */
export function setCSRFToken(
  response: NextResponse,
  config: CSRFConfig = {}
): { token: string; response: NextResponse } {
  const token = createTimestampedToken();
  const isProduction = process.env.NODE_ENV === "production";
  
  const cookieOptions = {
    secure: isProduction,
    httpOnly: false, // Must be false for double-submit pattern
    sameSite: "lax" as const,
    path: "/",
    maxAge: TOKEN_EXPIRY / 1000, // Convert to seconds
    ...config.cookieOptions,
  };

  // Set cookie via Set-Cookie header for middleware compatibility
  const cookieString = `${CSRF_TOKEN_NAME}=${token}; Path=${cookieOptions.path}; Max-Age=${cookieOptions.maxAge}; SameSite=${cookieOptions.sameSite}${cookieOptions.secure ? '; Secure' : ''}`;
  
  response.headers.append('Set-Cookie', cookieString);
  
  // Also set a header for JavaScript access
  response.headers.set('X-CSRF-Token', token);
  
  return { token, response };
}

/**
 * Get CSRF token from cookies
 */
export function getCSRFTokenFromCookies(request: NextRequest): string | null {
  return request.cookies.get(CSRF_TOKEN_NAME)?.value || null;
}

/**
 * Get CSRF token from request headers
 */
export function getCSRFTokenFromHeaders(request: NextRequest): string | null {
  return request.headers.get(CSRF_HEADER_NAME) || 
         request.headers.get('x-requested-with') === 'XMLHttpRequest' 
           ? request.headers.get(CSRF_HEADER_NAME) 
           : null;
}

/**
 * Validate CSRF protection using double-submit cookie pattern
 */
export function validateCSRFProtection(
  request: NextRequest,
  config: CSRFConfig = {}
): { 
  isValid: boolean; 
  reason?: string; 
  shouldSetToken?: boolean; 
} {
  const pathname = request.nextUrl.pathname;
  const isDevelopment = process.env.NODE_ENV === 'development';
  
  // Skip validation for excluded paths
  if (config.excludePaths?.some(path => pathname.startsWith(path))) {
    return { isValid: true };
  }

  // Skip validation for GET requests (read-only operations)
  if (request.method === 'GET' || request.method === 'HEAD') {
    return { isValid: true, shouldSetToken: true };
  }

  // Skip validation for OPTIONS requests
  if (request.method === 'OPTIONS') {
    return { isValid: true };
  }

  // Skip validation for Next.js Server Actions
  // Server actions are POST requests with specific characteristics
  if (request.method === 'POST') {
    const contentType = request.headers.get('content-type') || '';
    const nextAction = request.headers.get('next-action');
    const nextRouter = request.headers.get('next-router-state-tree');
    
    // Check if this is a Next.js server action request
    if (nextAction || nextRouter || contentType.includes('text/plain;action=')) {
      return { isValid: true };
    }
  }

  const cookieToken = getCSRFTokenFromCookies(request);
  const headerToken = getCSRFTokenFromHeaders(request);
  
  // Enhanced development logging for CSRF debugging
  if (isDevelopment) {
    // eslint-disable-next-line no-console
    // console.log('🔒 CSRF Validation Debug:', {
    //   pathname,
    //   method: request.method,
    //   cookieToken: cookieToken ? `${cookieToken.substring(0, 8)}...` : 'missing',
    //   headerToken: headerToken ? `${headerToken.substring(0, 8)}...` : 'missing',
    //   cookieName: CSRF_TOKEN_NAME,
    //   headerName: CSRF_HEADER_NAME,
    // });
  }
  
  // Check if we have a valid cookie token
  if (!cookieToken || !validateTimestampedToken(cookieToken)) {
    const reason = !cookieToken 
      ? `Missing CSRF cookie token (${CSRF_TOKEN_NAME})`
      : "Invalid or expired CSRF cookie token";
      
    if (isDevelopment) {
      // eslint-disable-next-line no-console
      // console.warn('❌ CSRF Validation Failed:', reason);
    }
    
    return { 
      isValid: false, 
      reason,
      shouldSetToken: true 
    };
  }

  // For state-changing requests, require header token (double-submit pattern)
  if (!headerToken) {
    const reason = `Missing CSRF header token (${CSRF_HEADER_NAME})`;
    
    if (isDevelopment) {
      // eslint-disable-next-line no-console
      // console.warn('❌ CSRF Validation Failed:', reason);
    }
    
    // Check if custom header requirement is enabled
    if (config.requireCustomHeader) {
      return { 
        isValid: false, 
        reason 
      };
    }
    
    // For API routes, always require header token
    if (pathname.startsWith('/api/')) {
      return { 
        isValid: false, 
        reason: `${reason} for API request` 
      };
    }
  }

  // Validate token match (double-submit pattern)
  if (headerToken && cookieToken !== headerToken) {
    const reason = "CSRF token mismatch between cookie and header";
    
    if (isDevelopment) {
      // eslint-disable-next-line no-console
      // console.warn('❌ CSRF Validation Failed:', reason);
    }
    
    return { 
      isValid: false, 
      reason 
    };
  }

  if (isDevelopment) {
    // eslint-disable-next-line no-console
    // console.log('✅ CSRF Validation Passed for', pathname);
  }

  return { isValid: true };
}

/**
 * Apply CSRF protection to middleware response
 */
export function applyCSRFProtection(
  request: NextRequest,
  response: NextResponse,
  config: CSRFConfig = {}
): NextResponse {
  const validation = validateCSRFProtection(request, config);
  
  if (!validation.isValid) {
    // Create CSRF error response
    const errorResponse = new NextResponse(
      JSON.stringify({
        error: "CSRF validation failed",
        message: validation.reason || "Invalid CSRF token",
        code: "CSRF_TOKEN_INVALID"
      }),
      {
        status: 403,
        headers: {
          'Content-Type': 'application/json',
        }
      }
    );
    
    return errorResponse;
  }

  // Set new CSRF token if needed
  if (validation.shouldSetToken) {
    const { response: updatedResponse } = setCSRFToken(response, config);
    return updatedResponse;
  }

  return response;
}

/**
 * Server-side utility to get CSRF token for forms
 * Use this in Server Components or API routes
 */
export async function getServerCSRFToken(): Promise<string | null> {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(CSRF_TOKEN_NAME)?.value;
    
    if (token && validateTimestampedToken(token)) {
      return token;
    }
    
    return null;
  } catch (_error) {
    // eslint-disable-next-line no-console
    // console.warn("Error getting server CSRF token:", error);
    return null;
  }
}

/**
 * Generate a new CSRF token for server-side use
 */
export function generateServerCSRFToken(): string {
  return createTimestampedToken();
}

/**
 * Create CSRF-protected form field
 */
export function createCSRFFormField(token: string): string {
  return `<input type="hidden" name="${CSRF_FORM_FIELD}" value="${token}" />`;
}

/**
 * Middleware helper for CSRF protection
 */
export function createCSRFMiddleware(config: CSRFConfig = {}) {
  return (request: NextRequest, response: NextResponse) => {
    return applyCSRFProtection(request, response, config);
  };
}

// Default CSRF configuration for the application
export const defaultCSRFConfig: CSRFConfig = {
  excludePaths: [
    '/api/stripe/webhook', // Stripe webhooks have their own signature validation
    '/api/health',         // Health check endpoints
    '/api/auth',          // BetterAuth handles its own CSRF protection
  ],
  requireCustomHeader: false, // Will be enabled for sensitive operations
  cookieOptions: {
    secure: process.env.NODE_ENV === "production",
    httpOnly: false, // Required for double-submit pattern
    sameSite: "lax",
    path: "/",
  }
};

// Enhanced configuration for sensitive operations
export const sensitiveCSRFConfig: CSRFConfig = {
  ...defaultCSRFConfig,
  requireCustomHeader: true, // Strict header requirement
  excludePaths: [
    '/api/stripe/webhook',
    '/api/health',
  ], // Remove auth routes from exclusions for stricter protection
};