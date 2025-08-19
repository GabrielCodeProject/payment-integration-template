/**
 * Security Headers Integration Tests
 * 
 * Tests security headers across different routes, validates CSP enforcement,
 * HSTS implementation, and security header interaction with authentication flows.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach, jest } from '@jest/globals';
import { NextRequest, NextResponse } from 'next/server';
import { middleware } from '@/middleware';

describe('Security Headers Integration Tests', () => {
  let originalNodeEnv: string | undefined;
  let originalAppUrl: string | undefined;

  beforeAll(() => {
    originalNodeEnv = process.env.NODE_ENV;
    originalAppUrl = process.env.NEXT_PUBLIC_APP_URL;
  });

  afterAll(() => {
    if (originalNodeEnv) {
      process.env.NODE_ENV = originalNodeEnv;
    }
    if (originalAppUrl) {
      process.env.NEXT_PUBLIC_APP_URL = originalAppUrl;
    }
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    // Reset environment variables
    process.env.NODE_ENV = originalNodeEnv;
    process.env.NEXT_PUBLIC_APP_URL = originalAppUrl;
  });

  describe('Security Headers Across Different Routes', () => {
    it('should set core security headers for all routes', async () => {
      const testRoutes = [
        '/',
        '/dashboard',
        '/profile',
        '/admin',
        '/api/auth/signin',
        '/api/user/profile',
        '/api/payments/create'
      ];

      for (const path of testRoutes) {
        const request = createMockRequest({
          method: 'GET',
          path,
          headers: {
            'origin': 'https://example.com'
          }
        });

        const response = await middleware(request);
        
        // Core security headers should be present
        expect(response.headers.get('X-DNS-Prefetch-Control')).toBe('on');
        expect(response.headers.get('X-Frame-Options')).toBe('DENY');
        expect(response.headers.get('X-Content-Type-Options')).toBe('nosniff');
        expect(response.headers.get('Referrer-Policy')).toBe('strict-origin-when-cross-origin');
        
        // HSTS header should be set
        const hstsHeader = response.headers.get('Strict-Transport-Security');
        expect(hstsHeader).toBeTruthy();
        expect(hstsHeader).toContain('max-age=63072000');
        expect(hstsHeader).toContain('includeSubDomains');
        expect(hstsHeader).toContain('preload');
      }
    });

    it('should set appropriate CSP headers for payment routes', async () => {
      const paymentRoutes = [
        '/checkout',
        '/payment/process',
        '/billing/update'
      ];

      for (const path of paymentRoutes) {
        const request = createMockRequest({
          method: 'GET',
          path,
          headers: {
            'origin': 'https://example.com'
          }
        });

        const response = await middleware(request);
        const csp = response.headers.get('Content-Security-Policy');
        
        expect(csp).toBeTruthy();
        expect(csp).toContain("default-src 'self'");
        expect(csp).toContain('https://js.stripe.com');
        expect(csp).toContain('https://checkout.stripe.com');
        expect(csp).toContain('https://api.stripe.com');
        expect(csp).toContain("script-src 'self' 'nonce-");
        expect(csp).toContain("style-src 'self' 'unsafe-inline'");
        expect(csp).toContain("frame-src 'self' https://js.stripe.com");
        expect(csp).toContain("form-action 'self'");
        expect(csp).toContain("object-src 'none'");
      }
    });

    it('should set standard CSP headers for non-payment routes', async () => {
      const standardRoutes = [
        '/',
        '/dashboard',
        '/profile',
        '/admin'
      ];

      for (const path of standardRoutes) {
        const request = createMockRequest({
          method: 'GET',
          path,
          headers: {
            'origin': 'https://example.com'
          }
        });

        const response = await middleware(request);
        const csp = response.headers.get('Content-Security-Policy');
        
        expect(csp).toBeTruthy();
        expect(csp).toContain("default-src 'self'");
        expect(csp).toContain("script-src 'self' 'nonce-");
        expect(csp).toContain("style-src 'self' 'unsafe-inline'");
        expect(csp).toContain("frame-src 'none'");
        expect(csp).toContain("form-action 'self'");
        expect(csp).toContain("object-src 'none'");
        
        // Should NOT contain Stripe domains for non-payment routes
        expect(csp).not.toContain('https://js.stripe.com');
        expect(csp).not.toContain('https://checkout.stripe.com');
      }
    });

    it('should include nonce in CSP headers', async () => {
      const request = createMockRequest({
        method: 'GET',
        path: '/',
        headers: {
          'origin': 'https://example.com'
        }
      });

      const response = await middleware(request);
      
      const csp = response.headers.get('Content-Security-Policy');
      const nonce = response.headers.get('X-Nonce');
      
      expect(nonce).toBeTruthy();
      expect(nonce).toMatch(/^[a-f0-9]{32}$/); // 32 character hex string
      expect(csp).toContain(`'nonce-${nonce}'`);
    });
  });

  describe('Content Security Policy (CSP) Enforcement', () => {
    it('should enforce strict CSP for sensitive operations', async () => {
      const sensitiveRoutes = [
        '/admin/users',
        '/admin/settings',
        '/api/admin/users',
        '/api/payments/process'
      ];

      for (const path of sensitiveRoutes) {
        const request = createMockRequest({
          method: 'GET',
          path,
          headers: {
            'origin': 'https://example.com'
          }
        });

        const response = await middleware(request);
        const csp = response.headers.get('Content-Security-Policy');
        
        expect(csp).toBeTruthy();
        expect(csp).toContain("default-src 'self'");
        expect(csp).toContain("base-uri 'self'");
        expect(csp).toContain("object-src 'none'");
        
        // Should not allow unsafe-eval or unsafe-inline for scripts in production
        if (process.env.NODE_ENV === 'production') {
          expect(csp).not.toContain("'unsafe-eval'");
        }
      }
    });

    it('should allow development-specific CSP rules in development', async () => {
      process.env.NODE_ENV = 'development';
      
      const request = createMockRequest({
        method: 'GET',
        path: '/dashboard',
        headers: {
          'origin': 'http://localhost:3000'
        }
      });

      const response = await middleware(request);
      const csp = response.headers.get('Content-Security-Policy');
      
      expect(csp).toBeTruthy();
      expect(csp).toContain("'unsafe-eval'"); // Allowed in development
      expect(csp).toContain('ws: wss:'); // WebSocket support for dev
      expect(csp).toContain('http://localhost:3000');
    });

    it('should restrict CSP appropriately in production', async () => {
      process.env.NODE_ENV = 'production';
      process.env.NEXT_PUBLIC_APP_URL = 'https://example.com';
      
      const request = createMockRequest({
        method: 'GET',
        path: '/dashboard',
        headers: {
          'origin': 'https://example.com'
        }
      });

      const response = await middleware(request);
      const csp = response.headers.get('Content-Security-Policy');
      
      expect(csp).toBeTruthy();
      expect(csp).not.toContain("'unsafe-eval'");
      expect(csp).not.toContain('ws:');
      expect(csp).not.toContain('http://localhost');
    });

    it('should handle CSP for different content types', async () => {
      const contentTypeTests = [
        {
          path: '/api/user/profile',
          expectedDirectives: ["default-src 'self'", "object-src 'none'"]
        },
        {
          path: '/checkout',
          expectedDirectives: [
            "script-src 'self' 'nonce-",
            "frame-src 'self' https://js.stripe.com"
          ]
        },
        {
          path: '/dashboard',
          expectedDirectives: [
            "img-src 'self' data: https:",
            "font-src 'self' https://fonts.gstatic.com"
          ]
        }
      ];

      for (const test of contentTypeTests) {
        const request = createMockRequest({
          method: 'GET',
          path: test.path,
          headers: {
            'origin': 'https://example.com'
          }
        });

        const response = await middleware(request);
        const csp = response.headers.get('Content-Security-Policy');
        
        test.expectedDirectives.forEach(directive => {
          expect(csp).toContain(directive);
        });
      }
    });
  });

  describe('HTTP Strict Transport Security (HSTS) Implementation', () => {
    it('should set HSTS headers with appropriate max-age', async () => {
      const request = createMockRequest({
        method: 'GET',
        path: '/',
        headers: {
          'origin': 'https://example.com'
        }
      });

      const response = await middleware(request);
      const hsts = response.headers.get('Strict-Transport-Security');
      
      expect(hsts).toBeTruthy();
      expect(hsts).toContain('max-age=63072000'); // 2 years
      expect(hsts).toContain('includeSubDomains');
      expect(hsts).toContain('preload');
    });

    it('should apply HSTS to all HTTPS routes', async () => {
      const httpsRoutes = [
        '/',
        '/dashboard',
        '/api/auth/signin',
        '/api/payments/create',
        '/admin/settings'
      ];

      for (const path of httpsRoutes) {
        const request = createMockRequest({
          method: 'GET',
          path,
          headers: {
            'origin': 'https://example.com'
          }
        });

        const response = await middleware(request);
        const hsts = response.headers.get('Strict-Transport-Security');
        
        expect(hsts).toBeTruthy();
        expect(hsts).toMatch(/max-age=\d+/);
      }
    });

    it('should handle HSTS preload requirements', async () => {
      process.env.NODE_ENV = 'production';
      
      const request = createMockRequest({
        method: 'GET',
        path: '/',
        headers: {
          'origin': 'https://example.com'
        }
      });

      const response = await middleware(request);
      const hsts = response.headers.get('Strict-Transport-Security');
      
      expect(hsts).toBeTruthy();
      expect(hsts).toContain('preload');
      
      // Should have sufficient max-age for preload list (minimum 1 year)
      const maxAgeMatch = hsts?.match(/max-age=(\d+)/);
      if (maxAgeMatch) {
        const maxAge = parseInt(maxAgeMatch[1]);
        expect(maxAge).toBeGreaterThanOrEqual(31536000); // 1 year minimum
      }
    });
  });

  describe('Security Headers in Production vs Development', () => {
    it('should set production-appropriate headers in production environment', async () => {
      process.env.NODE_ENV = 'production';
      
      const request = createMockRequest({
        method: 'GET',
        path: '/dashboard',
        headers: {
          'origin': 'https://example.com'
        }
      });

      const response = await middleware(request);
      
      // Production-specific security measures
      expect(response.headers.get('X-Frame-Options')).toBe('DENY');
      expect(response.headers.get('X-Content-Type-Options')).toBe('nosniff');
      
      const csp = response.headers.get('Content-Security-Policy');
      expect(csp).not.toContain("'unsafe-eval'");
      expect(csp).not.toContain('localhost');
      
      const hsts = response.headers.get('Strict-Transport-Security');
      expect(hsts).toContain('includeSubDomains');
      expect(hsts).toContain('preload');
    });

    it('should allow development conveniences in development environment', async () => {
      process.env.NODE_ENV = 'development';
      
      const request = createMockRequest({
        method: 'GET',
        path: '/dashboard',
        headers: {
          'origin': 'http://localhost:3000'
        }
      });

      const response = await middleware(request);
      
      const csp = response.headers.get('Content-Security-Policy');
      expect(csp).toContain("'unsafe-eval'"); // Allowed for development
      expect(csp).toContain('ws: wss:'); // WebSocket for hot reload
      expect(csp).toContain('localhost');
    });

    it('should handle mixed environments gracefully', async () => {
      // Test environment edge cases
      const environments = ['development', 'production', 'test'];
      
      for (const env of environments) {
        process.env.NODE_ENV = env;
        
        const request = createMockRequest({
          method: 'GET',
          path: '/',
          headers: {
            'origin': 'https://example.com'
          }
        });

        const response = await middleware(request);
        
        // Core headers should always be present
        expect(response.headers.get('X-Frame-Options')).toBe('DENY');
        expect(response.headers.get('X-Content-Type-Options')).toBe('nosniff');
        expect(response.headers.get('Referrer-Policy')).toBeTruthy();
        
        const csp = response.headers.get('Content-Security-Policy');
        expect(csp).toBeTruthy();
      }
    });
  });

  describe('Security Header Interaction with Authentication Flows', () => {
    it('should maintain security headers during login flow', async () => {
      const loginSteps = [
        { path: '/login', method: 'GET' },
        { path: '/api/auth/signin', method: 'POST' },
        { path: '/dashboard', method: 'GET' }
      ];

      for (const step of loginSteps) {
        const request = createMockRequest({
          method: step.method,
          path: step.path,
          headers: {
            'origin': 'https://example.com',
            'content-type': 'application/json'
          }
        });

        const response = await middleware(request);
        
        // Security headers should be consistent throughout login flow
        expect(response.headers.get('X-Frame-Options')).toBe('DENY');
        expect(response.headers.get('X-Content-Type-Options')).toBe('nosniff');
        expect(response.headers.get('Strict-Transport-Security')).toBeTruthy();
        
        const csp = response.headers.get('Content-Security-Policy');
        expect(csp).toBeTruthy();
        expect(csp).toContain("default-src 'self'");
      }
    });

    it('should set appropriate headers for OAuth flows', async () => {
      const oauthRoutes = [
        '/api/auth/oauth/google',
        '/api/auth/oauth/github',
        '/api/auth/callback'
      ];

      for (const path of oauthRoutes) {
        const request = createMockRequest({
          method: 'GET',
          path,
          headers: {
            'origin': 'https://example.com'
          }
        });

        const response = await middleware(request);
        
        const csp = response.headers.get('Content-Security-Policy');
        expect(csp).toBeTruthy();
        expect(csp).toContain("form-action 'self'");
        expect(csp).toContain("base-uri 'self'");
        
        // Should not block legitimate OAuth redirects
        expect(response.headers.get('X-Frame-Options')).toBe('DENY');
      }
    });

    it('should handle session management with proper security headers', async () => {
      const sessionRoutes = [
        '/api/auth/session',
        '/api/auth/refresh',
        '/api/auth/logout'
      ];

      for (const path of sessionRoutes) {
        const request = createMockRequest({
          method: 'POST',
          path,
          headers: {
            'origin': 'https://example.com',
            'content-type': 'application/json'
          }
        });

        const response = await middleware(request);
        
        // Should maintain security throughout session management
        expect(response.headers.get('X-Content-Type-Options')).toBe('nosniff');
        expect(response.headers.get('Referrer-Policy')).toBe('strict-origin-when-cross-origin');
        
        const csp = response.headers.get('Content-Security-Policy');
        expect(csp).toContain("default-src 'self'");
      }
    });
  });

  describe('Security Headers for API Routes', () => {
    it('should set appropriate headers for API endpoints', async () => {
      const apiRoutes = [
        '/api/user/profile',
        '/api/payments/create',
        '/api/admin/users',
        '/api/auth/signin'
      ];

      for (const path of apiRoutes) {
        const request = createMockRequest({
          method: 'POST',
          path,
          headers: {
            'origin': 'https://example.com',
            'content-type': 'application/json'
          }
        });

        const response = await middleware(request);
        
        // API-specific security headers
        expect(response.headers.get('X-Content-Type-Options')).toBe('nosniff');
        expect(response.headers.get('X-Frame-Options')).toBe('DENY');
        
        // CORS headers should be present for API routes
        expect(response.headers.get('Access-Control-Allow-Origin')).toBeTruthy();
        expect(response.headers.get('Access-Control-Allow-Credentials')).toBe('true');
        expect(response.headers.get('Vary')).toBe('Origin');
      }
    });

    it('should handle preflight OPTIONS requests with security headers', async () => {
      const request = createMockRequest({
        method: 'OPTIONS',
        path: '/api/user/profile',
        headers: {
          'origin': 'https://example.com',
          'access-control-request-method': 'POST',
          'access-control-request-headers': 'Content-Type, Authorization'
        }
      });

      const response = await middleware(request);
      
      expect(response.status).toBe(200);
      expect(response.headers.get('Access-Control-Allow-Origin')).toBe('https://example.com');
      expect(response.headers.get('Access-Control-Allow-Methods')).toContain('POST');
      expect(response.headers.get('Access-Control-Allow-Headers')).toContain('Content-Type');
      expect(response.headers.get('Access-Control-Max-Age')).toBe('86400');
      
      // Security headers should still be present
      expect(response.headers.get('X-Content-Type-Options')).toBe('nosniff');
    });

    it('should set rate limiting headers for API responses', async () => {
      const request = createMockRequest({
        method: 'GET',
        path: '/api/user/profile',
        headers: {
          'origin': 'https://example.com'
        }
      });

      const response = await middleware(request);
      
      // Rate limiting headers should be present
      expect(response.headers.get('X-RateLimit-Limit')).toBeTruthy();
      expect(response.headers.get('X-RateLimit-Remaining')).toBeTruthy();
      expect(response.headers.get('X-RateLimit-Reset')).toBeTruthy();
    });
  });

  describe('Security Header Performance and Caching', () => {
    it('should set headers efficiently for high-traffic routes', async () => {
      const highTrafficRoutes = [
        '/',
        '/api/health',
        '/api/status'
      ];

      const startTime = Date.now();
      
      // Simulate multiple concurrent requests
      const promises = highTrafficRoutes.flatMap(path => 
        Array.from({ length: 10 }, () => {
          const request = createMockRequest({
            method: 'GET',
            path,
            headers: {
              'origin': 'https://example.com'
            }
          });
          return middleware(request);
        })
      );

      const responses = await Promise.all(promises);
      const endTime = Date.now();
      
      // Should complete quickly
      expect(endTime - startTime).toBeLessThan(1000);
      
      // All responses should have security headers
      responses.forEach(response => {
        expect(response.headers.get('X-Frame-Options')).toBe('DENY');
        expect(response.headers.get('X-Content-Type-Options')).toBe('nosniff');
      });
    });

    it('should handle header generation with minimal overhead', async () => {
      const requestCount = 100;
      const startTime = Date.now();
      
      const promises = Array.from({ length: requestCount }, () => {
        const request = createMockRequest({
          method: 'GET',
          path: '/dashboard',
          headers: {
            'origin': 'https://example.com'
          }
        });
        return middleware(request);
      });

      const responses = await Promise.all(promises);
      const endTime = Date.now();
      const averageTime = (endTime - startTime) / requestCount;
      
      // Should process each request quickly
      expect(averageTime).toBeLessThan(10); // Less than 10ms per request
      
      // Verify all responses have complete headers
      responses.forEach(response => {
        expect(response.headers.get('Content-Security-Policy')).toBeTruthy();
        expect(response.headers.get('Strict-Transport-Security')).toBeTruthy();
        expect(response.headers.get('X-Nonce')).toBeTruthy();
      });
    });
  });

  describe('Security Headers Edge Cases', () => {
    it('should handle malformed requests gracefully', async () => {
      const malformedRequests = [
        {
          path: '/dashboard',
          headers: { 'origin': 'javascript:alert(1)' }
        },
        {
          path: '/api/user',
          headers: { 'origin': 'data:text/html,<script>alert(1)</script>' }
        },
        {
          path: '/',
          headers: { 'user-agent': '<script>alert(1)</script>' }
        }
      ];

      for (const testCase of malformedRequests) {
        const request = createMockRequest({
          method: 'GET',
          path: testCase.path,
          headers: testCase.headers
        });

        const response = await middleware(request);
        
        // Should still set security headers despite malformed input
        expect(response.headers.get('X-Frame-Options')).toBe('DENY');
        expect(response.headers.get('X-Content-Type-Options')).toBe('nosniff');
        
        const csp = response.headers.get('Content-Security-Policy');
        expect(csp).toBeTruthy();
        expect(csp).toContain("object-src 'none'");
      }
    });

    it('should handle missing or invalid origin headers', async () => {
      const request = createMockRequest({
        method: 'POST',
        path: '/api/user/profile',
        headers: {
          'content-type': 'application/json'
          // No origin header
        }
      });

      const response = await middleware(request);
      
      // Should still apply security headers
      expect(response.headers.get('X-Content-Type-Options')).toBe('nosniff');
      expect(response.headers.get('X-Frame-Options')).toBe('DENY');
    });

    it('should maintain security across different protocol schemes', async () => {
      const protocolTests = [
        { origin: 'https://example.com', expectSecure: true },
        { origin: 'http://localhost:3000', expectDev: true }
      ];

      for (const test of protocolTests) {
        const request = createMockRequest({
          method: 'GET',
          path: '/dashboard',
          headers: {
            'origin': test.origin
          }
        });

        const response = await middleware(request);
        
        // Core security headers should always be present
        expect(response.headers.get('X-Frame-Options')).toBe('DENY');
        expect(response.headers.get('X-Content-Type-Options')).toBe('nosniff');
        
        const csp = response.headers.get('Content-Security-Policy');
        expect(csp).toBeTruthy();
      }
    });
  });

  // Helper function to create mock NextRequest
  function createMockRequest(options: {
    method?: string;
    path?: string;
    headers?: Record<string, string>;
  } = {}): NextRequest {
    const {
      method = 'GET',
      path = '/',
      headers = {}
    } = options;

    const url = `https://example.com${path}`;
    const requestHeaders = new Headers(headers);
    
    return new NextRequest(url, {
      method,
      headers: requestHeaders
    });
  }
});