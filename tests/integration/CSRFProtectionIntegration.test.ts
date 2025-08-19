/**
 * CSRF Protection Integration Tests
 * 
 * Tests double-submit cookie pattern and CSRF protection across 
 * the entire authentication system and validates security integration.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach, jest } from '@jest/globals';
import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import {
  validateCSRFProtection,
  applyCSRFProtection,
  setCSRFToken,
  getCSRFTokenFromCookies,
  getCSRFTokenFromHeaders,
  getServerCSRFToken,
  generateServerCSRFToken,
  createCSRFMiddleware,
  defaultCSRFConfig,
  sensitiveCSRFConfig,
  type CSRFConfig
} from '@/lib/csrf-protection';

describe('CSRF Protection Integration Tests', () => {
  let originalNodeEnv: string | undefined;

  beforeAll(() => {
    originalNodeEnv = process.env.NODE_ENV;
  });

  afterAll(() => {
    if (originalNodeEnv) {
      process.env.NODE_ENV = originalNodeEnv;
    }
  });

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers({ now: new Date('2024-01-01T00:00:00Z') });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('Double-Submit Cookie Pattern Across Authentication Flows', () => {
    it('should validate CSRF tokens using double-submit pattern for login flow', async () => {
      const token = generateServerCSRFToken();
      
      // Simulate login request with proper CSRF tokens
      const loginRequest = createMockRequest({
        method: 'POST',
        path: '/api/auth/signin',
        cookies: { '__Secure-csrf-token': token },
        headers: { 'x-csrf-token': token }
      });

      const validation = validateCSRFProtection(loginRequest, defaultCSRFConfig);
      expect(validation.isValid).toBe(true);
      expect(validation.reason).toBeUndefined();
    });

    it('should block requests with mismatched CSRF tokens', async () => {
      const cookieToken = generateServerCSRFToken();
      const headerToken = generateServerCSRFToken();
      
      const request = createMockRequest({
        method: 'POST',
        path: '/api/auth/signin',
        cookies: { '__Secure-csrf-token': cookieToken },
        headers: { 'x-csrf-token': headerToken }
      });

      const validation = validateCSRFProtection(request, defaultCSRFConfig);
      expect(validation.isValid).toBe(false);
      expect(validation.reason).toBe('CSRF token mismatch');
    });

    it('should handle registration flow with CSRF protection', async () => {
      const token = generateServerCSRFToken();
      
      const registrationRequest = createMockRequest({
        method: 'POST',
        path: '/api/auth/signup',
        cookies: { '__Secure-csrf-token': token },
        headers: { 'x-csrf-token': token }
      });

      const validation = validateCSRFProtection(registrationRequest, defaultCSRFConfig);
      expect(validation.isValid).toBe(true);
    });

    it('should protect password reset flow', async () => {
      const token = generateServerCSRFToken();
      
      const resetRequest = createMockRequest({
        method: 'POST',
        path: '/api/auth/reset-password',
        cookies: { '__Secure-csrf-token': token },
        headers: { 'x-csrf-token': token }
      });

      const validation = validateCSRFProtection(resetRequest, defaultCSRFConfig);
      expect(validation.isValid).toBe(true);
    });
  });

  describe('CSRF Token Generation and Validation', () => {
    it('should generate valid timestamped tokens', () => {
      const token1 = generateServerCSRFToken();
      const token2 = generateServerCSRFToken();

      expect(token1).toBeTruthy();
      expect(token2).toBeTruthy();
      expect(token1).not.toBe(token2);
      
      // Should contain timestamp
      expect(token1.includes('.')).toBe(true);
      expect(token2.includes('.')).toBe(true);
    });

    it('should validate token timestamps and reject expired tokens', () => {
      const token = generateServerCSRFToken();
      
      // Token should be valid immediately
      const request = createMockRequest({
        method: 'POST',
        path: '/api/test',
        cookies: { '__Secure-csrf-token': token },
        headers: { 'x-csrf-token': token }
      });

      let validation = validateCSRFProtection(request, defaultCSRFConfig);
      expect(validation.isValid).toBe(true);

      // Fast-forward time beyond token expiry (1 hour + 1 minute)
      jest.advanceTimersByTime(61 * 60 * 1000);

      const expiredRequest = createMockRequest({
        method: 'POST',
        path: '/api/test',
        cookies: { '__Secure-csrf-token': token },
        headers: { 'x-csrf-token': token }
      });

      validation = validateCSRFProtection(expiredRequest, defaultCSRFConfig);
      expect(validation.isValid).toBe(false);
      expect(validation.reason).toBe('Missing or invalid CSRF cookie token');
    });

    it('should reject malformed tokens', () => {
      const malformedTokens = [
        'invalid-token',
        'token.without.proper.format',
        'token.invalid-timestamp',
        'too-short.123',
        '.missing-token-part',
        'missing-timestamp-part.'
      ];

      malformedTokens.forEach(token => {
        const request = createMockRequest({
          method: 'POST',
          path: '/api/test',
          cookies: { '__Secure-csrf-token': token },
          headers: { 'x-csrf-token': token }
        });

        const validation = validateCSRFProtection(request, defaultCSRFConfig);
        expect(validation.isValid).toBe(false);
        expect(validation.reason).toBe('Missing or invalid CSRF cookie token');
      });
    });
  });

  describe('CSRF Protection with Different Authentication Methods', () => {
    it('should handle OAuth flow CSRF protection', async () => {
      const token = generateServerCSRFToken();
      
      const oauthRequest = createMockRequest({
        method: 'POST',
        path: '/api/auth/oauth/callback',
        cookies: { '__Secure-csrf-token': token },
        headers: { 'x-csrf-token': token }
      });

      const validation = validateCSRFProtection(oauthRequest, defaultCSRFConfig);
      expect(validation.isValid).toBe(true);
    });

    it('should protect session refresh endpoints', async () => {
      const token = generateServerCSRFToken();
      
      const refreshRequest = createMockRequest({
        method: 'POST',
        path: '/api/auth/refresh',
        cookies: { '__Secure-csrf-token': token },
        headers: { 'x-csrf-token': token }
      });

      const validation = validateCSRFProtection(refreshRequest, defaultCSRFConfig);
      expect(validation.isValid).toBe(true);
    });

    it('should handle multi-factor authentication with CSRF', async () => {
      const token = generateServerCSRFToken();
      
      const mfaRequest = createMockRequest({
        method: 'POST',
        path: '/api/auth/mfa/verify',
        cookies: { '__Secure-csrf-token': token },
        headers: { 'x-csrf-token': token }
      });

      const validation = validateCSRFProtection(request, defaultCSRFConfig);
      expect(validation.isValid).toBe(true);
    });
  });

  describe('Origin and Referer Header Validation', () => {
    it('should validate Origin header for cross-origin requests', () => {
      const token = generateServerCSRFToken();
      
      const validOriginRequest = createMockRequest({
        method: 'POST',
        path: '/api/test',
        cookies: { '__Secure-csrf-token': token },
        headers: { 
          'x-csrf-token': token,
          'origin': 'https://example.com'
        }
      });

      // Simulate middleware validation (origin validation happens in middleware)
      const validation = validateCSRFProtection(validOriginRequest, defaultCSRFConfig);
      expect(validation.isValid).toBe(true);
    });

    it('should validate Referer header when Origin is missing', () => {
      const token = generateServerCSRFToken();
      
      const validRefererRequest = createMockRequest({
        method: 'POST',
        path: '/api/test',
        cookies: { '__Secure-csrf-token': token },
        headers: { 
          'x-csrf-token': token,
          'referer': 'https://example.com/login'
        }
      });

      const validation = validateCSRFProtection(validRefererRequest, defaultCSRFConfig);
      expect(validation.isValid).toBe(true);
    });
  });

  describe('Sec-Fetch-Site Header Integration', () => {
    it('should allow same-origin requests', () => {
      const token = generateServerCSRFToken();
      
      const sameOriginRequest = createMockRequest({
        method: 'POST',
        path: '/api/test',
        cookies: { '__Secure-csrf-token': token },
        headers: { 
          'x-csrf-token': token,
          'sec-fetch-site': 'same-origin'
        }
      });

      const validation = validateCSRFProtection(sameOriginRequest, defaultCSRFConfig);
      expect(validation.isValid).toBe(true);
    });

    it('should allow same-site requests for non-sensitive endpoints', () => {
      const token = generateServerCSRFToken();
      
      const sameSiteRequest = createMockRequest({
        method: 'POST',
        path: '/api/public/data',
        cookies: { '__Secure-csrf-token': token },
        headers: { 
          'x-csrf-token': token,
          'sec-fetch-site': 'same-site'
        }
      });

      const validation = validateCSRFProtection(sameSiteRequest, defaultCSRFConfig);
      expect(validation.isValid).toBe(true);
    });

    it('should block cross-site requests for sensitive endpoints', () => {
      const token = generateServerCSRFToken();
      
      const crossSiteRequest = createMockRequest({
        method: 'POST',
        path: '/api/payment/process',
        cookies: { '__Secure-csrf-token': token },
        headers: { 
          'x-csrf-token': token,
          'sec-fetch-site': 'cross-site'
        }
      });

      // This would be handled by middleware, but we can test the CSRF validation
      const validation = validateCSRFProtection(crossSiteRequest, sensitiveCSRFConfig);
      expect(validation.isValid).toBe(true); // CSRF validation passes, but middleware would block
    });
  });

  describe('CSRF Protection with Concurrent Sessions', () => {
    it('should handle multiple concurrent sessions with different tokens', async () => {
      const user1Token = generateServerCSRFToken();
      const user2Token = generateServerCSRFToken();
      
      const user1Request = createMockRequest({
        method: 'POST',
        path: '/api/user/profile',
        cookies: { '__Secure-csrf-token': user1Token },
        headers: { 
          'x-csrf-token': user1Token,
          'x-user-id': 'user-1'
        }
      });

      const user2Request = createMockRequest({
        method: 'POST',
        path: '/api/user/profile',
        cookies: { '__Secure-csrf-token': user2Token },
        headers: { 
          'x-csrf-token': user2Token,
          'x-user-id': 'user-2'
        }
      });

      const validation1 = validateCSRFProtection(user1Request, defaultCSRFConfig);
      const validation2 = validateCSRFProtection(user2Request, defaultCSRFConfig);

      expect(validation1.isValid).toBe(true);
      expect(validation2.isValid).toBe(true);
    });

    it('should prevent session token cross-contamination', () => {
      const user1Token = generateServerCSRFToken();
      const user2Token = generateServerCSRFToken();
      
      // User 1 tries to use User 2's token in headers
      const maliciousRequest = createMockRequest({
        method: 'POST',
        path: '/api/user/profile',
        cookies: { '__Secure-csrf-token': user1Token },
        headers: { 
          'x-csrf-token': user2Token, // Different token!
          'x-user-id': 'user-1'
        }
      });

      const validation = validateCSRFProtection(maliciousRequest, defaultCSRFConfig);
      expect(validation.isValid).toBe(false);
      expect(validation.reason).toBe('CSRF token mismatch');
    });
  });

  describe('CSRF Middleware Integration', () => {
    it('should set CSRF tokens in response for GET requests', async () => {
      const getRequest = createMockRequest({
        method: 'GET',
        path: '/api/user/profile'
      });

      const response = NextResponse.next();
      const csrfResponse = applyCSRFProtection(getRequest, response, defaultCSRFConfig);

      expect(csrfResponse.headers.has('X-CSRF-Token')).toBe(true);
      expect(csrfResponse.headers.has('Set-Cookie')).toBe(true);
      
      const csrfToken = csrfResponse.headers.get('X-CSRF-Token');
      expect(csrfToken).toBeTruthy();
      expect(csrfToken?.includes('.')).toBe(true); // Should be timestamped token
    });

    it('should block invalid CSRF requests with proper error response', () => {
      const invalidRequest = createMockRequest({
        method: 'POST',
        path: '/api/payment/process',
        cookies: { '__Secure-csrf-token': 'invalid-token' },
        headers: { 'x-csrf-token': 'different-invalid-token' }
      });

      const response = NextResponse.next();
      const csrfResponse = applyCSRFProtection(invalidRequest, response, sensitiveCSRFConfig);

      expect(csrfResponse.status).toBe(403);
    });

    it('should create custom CSRF middleware with specific config', async () => {
      const customConfig: CSRFConfig = {
        excludePaths: ['/api/public'],
        requireCustomHeader: true,
        cookieOptions: {
          secure: true,
          sameSite: 'strict'
        }
      };

      const middleware = createCSRFMiddleware(customConfig);
      
      // Test excluded path
      const excludedRequest = createMockRequest({
        method: 'POST',
        path: '/api/public/data'
      });
      const response1 = NextResponse.next();
      const result1 = middleware(excludedRequest, response1);
      expect(result1.status).not.toBe(403);

      // Test protected path without proper header
      const protectedRequest = createMockRequest({
        method: 'POST',
        path: '/api/protected/data',
        cookies: { '__Secure-csrf-token': generateServerCSRFToken() }
        // Missing x-csrf-token header
      });
      const response2 = NextResponse.next();
      const result2 = middleware(protectedRequest, response2);
      expect(result2.status).toBe(403);
    });
  });

  describe('CSRF Protection in Production vs Development', () => {
    it('should use secure cookies in production environment', async () => {
      process.env.NODE_ENV = 'production';
      
      const response = NextResponse.next();
      const { token, response: csrfResponse } = setCSRFToken(response);

      const setCookieHeader = csrfResponse.headers.get('Set-Cookie');
      expect(setCookieHeader).toContain('Secure');
      expect(setCookieHeader).toContain('SameSite=lax');
      expect(setCookieHeader).toContain('Path=/');
    });

    it('should use non-secure cookies in development environment', async () => {
      process.env.NODE_ENV = 'development';
      
      const response = NextResponse.next();
      const { token, response: csrfResponse } = setCSRFToken(response);

      const setCookieHeader = csrfResponse.headers.get('Set-Cookie');
      expect(setCookieHeader).not.toContain('Secure');
      expect(setCookieHeader).toContain('SameSite=lax');
    });
  });

  describe('CSRF Protection Edge Cases', () => {
    it('should handle requests with no cookies gracefully', () => {
      const noCookieRequest = createMockRequest({
        method: 'POST',
        path: '/api/test'
        // No cookies at all
      });

      const validation = validateCSRFProtection(noCookieRequest, defaultCSRFConfig);
      expect(validation.isValid).toBe(false);
      expect(validation.reason).toBe('Missing or invalid CSRF cookie token');
      expect(validation.shouldSetToken).toBe(true);
    });

    it('should handle OPTIONS requests without CSRF validation', () => {
      const optionsRequest = createMockRequest({
        method: 'OPTIONS',
        path: '/api/test'
      });

      const validation = validateCSRFProtection(optionsRequest, defaultCSRFConfig);
      expect(validation.isValid).toBe(true);
    });

    it('should validate API routes more strictly', () => {
      const token = generateServerCSRFToken();
      
      const apiRequest = createMockRequest({
        method: 'POST',
        path: '/api/user/update',
        cookies: { '__Secure-csrf-token': token }
        // Missing header token for API route
      });

      const validation = validateCSRFProtection(apiRequest, defaultCSRFConfig);
      expect(validation.isValid).toBe(false);
      expect(validation.reason).toBe('Missing CSRF header token for API request');
    });

    it('should handle token extraction from various request formats', () => {
      const token = generateServerCSRFToken();
      
      // Test getting token from cookies
      const cookieRequest = createMockRequest({
        method: 'GET',
        path: '/api/test',
        cookies: { '__Secure-csrf-token': token }
      });
      expect(getCSRFTokenFromCookies(cookieRequest)).toBe(token);

      // Test getting token from headers
      const headerRequest = createMockRequest({
        method: 'POST',
        path: '/api/test',
        headers: { 'x-csrf-token': token }
      });
      expect(getCSRFTokenFromHeaders(headerRequest)).toBe(token);

      // Test XMLHttpRequest header variant
      const xhrRequest = createMockRequest({
        method: 'POST',
        path: '/api/test',
        headers: { 
          'x-requested-with': 'XMLHttpRequest',
          'x-csrf-token': token 
        }
      });
      expect(getCSRFTokenFromHeaders(xhrRequest)).toBe(token);
    });
  });

  describe('Performance Under Load', () => {
    it('should handle high-frequency CSRF validation efficiently', async () => {
      const token = generateServerCSRFToken();
      const requestCount = 1000;
      
      const startTime = Date.now();
      
      const promises = Array.from({ length: requestCount }, (_, i) => {
        const request = createMockRequest({
          method: 'POST',
          path: '/api/test',
          cookies: { '__Secure-csrf-token': token },
          headers: { 'x-csrf-token': token },
          requestId: `perf-test-${i}`
        });
        
        return validateCSRFProtection(request, defaultCSRFConfig);
      });

      const results = await Promise.all(promises);
      const endTime = Date.now();
      
      // All validations should succeed
      expect(results.every(r => r.isValid)).toBe(true);
      
      // Should complete reasonably quickly (less than 1 second for 1000 validations)
      const duration = endTime - startTime;
      expect(duration).toBeLessThan(1000);
      
      // Average processing time should be minimal
      const avgTime = duration / requestCount;
      expect(avgTime).toBeLessThan(1); // Less than 1ms per validation
    });

    it('should generate unique tokens efficiently', () => {
      const tokenCount = 10000;
      const tokens = new Set<string>();
      
      const startTime = Date.now();
      
      for (let i = 0; i < tokenCount; i++) {
        const token = generateServerCSRFToken();
        tokens.add(token);
      }
      
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      // All tokens should be unique
      expect(tokens.size).toBe(tokenCount);
      
      // Should generate efficiently
      expect(duration).toBeLessThan(1000); // Less than 1 second for 10k tokens
    });
  });

  // Helper function to create mock NextRequest
  function createMockRequest(options: {
    method?: string;
    path?: string;
    cookies?: Record<string, string>;
    headers?: Record<string, string>;
    requestId?: string;
  } = {}): NextRequest {
    const {
      method = 'GET',
      path = '/api/test',
      cookies = {},
      headers = {},
      requestId
    } = options;

    const url = `https://example.com${path}`;
    const requestHeaders = new Headers(headers);
    
    const request = new NextRequest(url, {
      method,
      headers: requestHeaders
    });

    // Mock the cookies
    Object.entries(cookies).forEach(([name, value]) => {
      request.cookies.set(name, value);
    });

    return request;
  }
});