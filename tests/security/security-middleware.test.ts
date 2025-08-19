/**
 * Security Middleware Tests
 * 
 * Tests for the enhanced security features implemented in Task 3.9.5
 */

import { NextRequest } from 'next/server';
import { middleware } from '../../src/middleware';

// Mock the dependencies
jest.mock('@/lib/env', () => ({
  getClientEnv: jest.fn(() => ({
    NEXT_PUBLIC_APP_URL: 'http://localhost:3000',
    NEXT_PUBLIC_STRIPE_TEST_MODE: 'true',
  }))
}));

jest.mock('@/lib/auth/edge-middleware', () => ({
  validateEdgeRouteAccess: jest.fn(() => Promise.resolve({ 
    isAllowed: true, 
    session: null 
  })),
  getClientIP: jest.fn(() => '127.0.0.1'),
  logAuthEvent: jest.fn(),
  checkRateLimit: jest.fn(() => ({ 
    allowed: true, 
    remaining: 9, 
    resetTime: Date.now() + 60000 
  })),
  edgeAuthConfig: {
    publicRoutes: ['/'],
    protectedRoutes: ['/dashboard'],
    adminRoutes: ['/admin'],
    authRoutes: ['/login'],
    apiPublicRoutes: ['/api/health'],
    apiProtectedRoutes: ['/api/protected'],
    apiAdminRoutes: ['/api/admin'],
  },
  createAuthRedirect: jest.fn(),
}));

jest.mock('@/lib/rate-limiting', () => ({
  checkAuthRateLimit: jest.fn(() => Promise.resolve({ 
    allowed: true, 
    remaining: 9, 
    resetTime: Date.now() + 60000,
    totalHits: 1 
  })),
  checkPaymentRateLimit: jest.fn(() => Promise.resolve({ 
    allowed: true, 
    remaining: 29, 
    resetTime: Date.now() + 60000,
    totalHits: 1 
  })),
  createRateLimitResponse: jest.fn(() => new Response('Too Many Requests', { status: 429 })),
}));

jest.mock('@/lib/csrf-protection', () => ({
  applyCSRFProtection: jest.fn((request, response) => response),
  defaultCSRFConfig: {},
  sensitiveCSRFConfig: {},
}));

// Helper to create mock NextRequest
function createMockRequest(
  url: string, 
  method: string = 'GET',
  headers: Record<string, string> = {}
): NextRequest {
  const request = new NextRequest(url, {
    method,
    headers: new Headers(headers),
  });
  
  // Mock cookies
  const cookiesMap = new Map();
  Object.defineProperty(request, 'cookies', {
    value: {
      get: jest.fn((name: string) => cookiesMap.get(name)),
      set: jest.fn((name: string, value: any) => cookiesMap.set(name, value)),
    }
  });
  
  return request;
}

describe('Security Middleware', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Security Headers', () => {
    it('should add security headers to responses', async () => {
      const request = createMockRequest('http://localhost:3000/');
      
      const response = await middleware(request);
      
      expect(response).toBeDefined();
      expect(response.headers.get('X-Frame-Options')).toBe('DENY');
      expect(response.headers.get('X-Content-Type-Options')).toBe('nosniff');
      expect(response.headers.get('Referrer-Policy')).toBe('strict-origin-when-cross-origin');
      expect(response.headers.get('Strict-Transport-Security')).toContain('max-age=63072000');
    });

    it('should set CSP headers for payment pages', async () => {
      const request = createMockRequest('http://localhost:3000/checkout');
      
      const response = await middleware(request);
      
      const csp = response.headers.get('Content-Security-Policy');
      expect(csp).toContain('https://js.stripe.com');
      expect(csp).toContain('https://checkout.stripe.com');
      expect(csp).toContain('frame-src');
    });

    it('should not include X-XSS-Protection header', async () => {
      const request = createMockRequest('http://localhost:3000/');
      
      const response = await middleware(request);
      
      expect(response.headers.get('X-XSS-Protection')).toBeNull();
    });
  });

  describe('CSRF Protection', () => {
    it('should apply CSRF protection for sensitive endpoints', async () => {
      const { applyCSRFProtection } = require('@/lib/csrf-protection');
      const request = createMockRequest('http://localhost:3000/checkout', 'POST');
      
      await middleware(request);
      
      expect(applyCSRFProtection).toHaveBeenCalled();
    });

    it('should use sensitive CSRF config for payment endpoints', async () => {
      const { applyCSRFProtection } = require('@/lib/csrf-protection');
      const request = createMockRequest('http://localhost:3000/api/payments', 'POST');
      
      await middleware(request);
      
      expect(applyCSRFProtection).toHaveBeenCalledWith(
        expect.anything(),
        expect.anything(),
        expect.objectContaining({
          requireCustomHeader: true
        })
      );
    });
  });

  describe('Enhanced Rate Limiting', () => {
    it('should apply enhanced rate limiting to auth endpoints', async () => {
      const { checkAuthRateLimit } = require('@/lib/rate-limiting');
      const request = createMockRequest('http://localhost:3000/api/auth/signin', 'POST');
      
      await middleware(request);
      
      expect(checkAuthRateLimit).toHaveBeenCalledWith(request);
    });

    it('should apply enhanced rate limiting to payment endpoints', async () => {
      const { checkPaymentRateLimit } = require('@/lib/rate-limiting');
      const request = createMockRequest('http://localhost:3000/api/payments', 'POST');
      
      await middleware(request);
      
      expect(checkPaymentRateLimit).toHaveBeenCalledWith(request);
    });

    it('should fallback to simple rate limiting if enhanced fails', async () => {
      const { checkAuthRateLimit } = require('@/lib/rate-limiting');
      const { checkRateLimit } = require('@/lib/auth/edge-middleware');
      
      // Mock enhanced rate limiting to fail
      checkAuthRateLimit.mockRejectedValueOnce(new Error('Redis connection failed'));
      
      const request = createMockRequest('http://localhost:3000/api/auth/signin', 'POST');
      
      await middleware(request);
      
      expect(checkAuthRateLimit).toHaveBeenCalled();
      expect(checkRateLimit).toHaveBeenCalled();
    });
  });

  describe('Sec-Fetch-Site Header Validation', () => {
    it('should block cross-site requests for sensitive endpoints', async () => {
      const request = createMockRequest(
        'http://localhost:3000/api/payments', 
        'POST',
        {
          'sec-fetch-site': 'cross-site',
          'origin': 'https://evil.com'
        }
      );
      
      const response = await middleware(request);
      
      expect(response.status).toBe(403);
    });

    it('should allow same-origin requests for sensitive endpoints', async () => {
      const request = createMockRequest(
        'http://localhost:3000/api/payments', 
        'POST',
        {
          'sec-fetch-site': 'same-origin',
          'origin': 'http://localhost:3000'
        }
      );
      
      const response = await middleware(request);
      
      // Should not be blocked by sec-fetch-site validation
      expect(response.status).not.toBe(403);
    });

    it('should block cross-site requests for all API endpoints', async () => {
      const request = createMockRequest(
        'http://localhost:3000/api/some-endpoint', 
        'POST',
        {
          'sec-fetch-site': 'cross-site'
        }
      );
      
      const response = await middleware(request);
      
      expect(response.status).toBe(403);
      expect(await response.text()).toContain('Cross-site requests not allowed');
    });
  });

  describe('Request ID and Tracing', () => {
    it('should add request ID header for tracing', async () => {
      const request = createMockRequest('http://localhost:3000/');
      
      const response = await middleware(request);
      
      const requestId = response.headers.get('X-Request-Id');
      expect(requestId).toBeTruthy();
      expect(requestId).toMatch(/^[a-f0-9\-]{36}$/); // UUID format
    });
  });

  describe('Environment-specific Features', () => {
    it('should add user context headers in development', async () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';
      
      // Mock session with user
      const { validateEdgeRouteAccess } = require('@/lib/auth/edge-middleware');
      validateEdgeRouteAccess.mockResolvedValueOnce({
        isAllowed: true,
        session: {
          user: {
            id: 'test-user-123',
            role: 'CUSTOMER'
          }
        }
      });
      
      const request = createMockRequest('http://localhost:3000/dashboard');
      
      const response = await middleware(request);
      
      expect(response.headers.get('X-User-Id')).toBe('test-user-123');
      expect(response.headers.get('X-User-Role')).toBe('CUSTOMER');
      
      process.env.NODE_ENV = originalEnv;
    });
  });
});

describe('Rate Limiting Module', () => {
  // These would be integration tests if Redis were available
  it('should export required rate limiting functions', () => {
    const rateLimiting = require('@/lib/rate-limiting');
    
    expect(typeof rateLimiting.checkAuthRateLimit).toBe('function');
    expect(typeof rateLimiting.checkPaymentRateLimit).toBe('function');
    expect(typeof rateLimiting.createRateLimitResponse).toBe('function');
    expect(typeof rateLimiting.getClientIP).toBe('function');
  });
});

describe('CSRF Protection Module', () => {
  it('should export required CSRF protection functions', () => {
    const csrfProtection = require('@/lib/csrf-protection');
    
    expect(typeof csrfProtection.applyCSRFProtection).toBe('function');
    expect(typeof csrfProtection.validateCSRFProtection).toBe('function');
    expect(typeof csrfProtection.setCSRFToken).toBe('function');
    expect(csrfProtection.defaultCSRFConfig).toBeDefined();
    expect(csrfProtection.sensitiveCSRFConfig).toBeDefined();
  });
});