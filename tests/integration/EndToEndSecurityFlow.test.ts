/**
 * End-to-End Security Flow Integration Tests
 * 
 * Tests complete authentication flows with all security features enabled,
 * validates security feature interaction during user operations, and ensures
 * comprehensive security coverage across the entire application.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach, jest } from '@jest/globals';
import { NextRequest } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { middleware } from '@/middleware';
import { 
  validateCSRFProtection, 
  generateServerCSRFToken
} from '@/lib/csrf-protection';
import { 
  checkAuthRateLimit, 
  checkPaymentRateLimit,
  cleanupRateLimit 
} from '@/lib/rate-limiting';
import { AuditService } from '@/lib/audit';
import { db } from '@/lib/db';

describe('End-to-End Security Flow Integration Tests', () => {
  let testDb: PrismaClient;
  let auditService: AuditService;
  let originalNodeEnv: string | undefined;

  beforeAll(async () => {
    originalNodeEnv = process.env.NODE_ENV;
    testDb = db;
    auditService = new AuditService(testDb);
  });

  afterAll(async () => {
    if (originalNodeEnv) {
      process.env.NODE_ENV = originalNodeEnv;
    }
    await cleanupRateLimit();
    
    // Clean up test audit logs
    try {
      await testDb.auditLog.deleteMany({
        where: {
          metadata: {
            path: ['e2e_test'],
            equals: true
          }
        }
      });
    } catch (_error) {
      // Ignore cleanup errors
    }
  });

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers({ now: new Date('2024-01-01T00:00:00Z') });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('Complete Authentication Flows with All Security Features', () => {
    it('should handle user registration with comprehensive security', async () => {
      const userEmail = 'e2e-test@example.com';
      const userIP = '192.168.1.200';
      const userAgent = 'E2E Test Browser';
      const csrfToken = generateServerCSRFToken();

      // Step 1: GET /register - Set security headers and CSRF token
      const getRegisterRequest = createSecureRequest({
        method: 'GET',
        path: '/register',
        ip: userIP,
        userAgent
      });

      const getRegisterResponse = await middleware(getRegisterRequest);
      
      // Verify security headers are set
      expect(getRegisterResponse.headers.get('X-Frame-Options')).toBe('DENY');
      expect(getRegisterResponse.headers.get('X-Content-Type-Options')).toBe('nosniff');
      expect(getRegisterResponse.headers.get('Strict-Transport-Security')).toBeTruthy();
      expect(getRegisterResponse.headers.get('Content-Security-Policy')).toBeTruthy();
      expect(getRegisterResponse.headers.get('X-CSRF-Token')).toBeTruthy();

      // Step 2: POST /api/auth/signup - Full security validation
      const postRegisterRequest = createSecureRequest({
        method: 'POST',
        path: '/api/auth/signup',
        ip: userIP,
        userAgent,
        headers: {
          'x-csrf-token': csrfToken,
          'content-type': 'application/json',
          'origin': 'https://example.com'
        },
        cookies: {
          '__Secure-csrf-token': csrfToken
        },
        body: JSON.stringify({
          email: userEmail,
          password: 'SecurePassword123!',
          name: 'E2E Test User'
        })
      });

      // Verify CSRF protection
      const csrfValidation = validateCSRFProtection(postRegisterRequest);
      expect(csrfValidation.isValid).toBe(true);

      // Verify rate limiting allows the request
      const rateLimitResult = await checkAuthRateLimit(postRegisterRequest);
      expect(rateLimitResult.allowed).toBe(true);

      // Process through middleware
      const postRegisterResponse = await middleware(postRegisterRequest);
      
      // Should pass all security checks (not blocked)
      expect(postRegisterResponse.status).not.toBe(403);
      expect(postRegisterResponse.status).not.toBe(429);

      // Verify security headers are maintained
      expect(postRegisterResponse.headers.get('X-Frame-Options')).toBe('DENY');
      expect(postRegisterResponse.headers.get('Access-Control-Allow-Origin')).toBe('https://example.com');

      // Step 3: Simulate audit log creation for registration
      await auditService.setAuditContext({
        userId: 'e2e-user-1',
        userEmail,
        ipAddress: userIP,
        userAgent,
        requestId: 'e2e-registration-1'
      });

      await auditService.createAuditLog({
        tableName: 'users',
        recordId: 'e2e-user-1',
        action: 'CREATE',
        newValues: {
          email: userEmail,
          name: 'E2E Test User',
          emailVerified: false
        },
        metadata: {
          operation: 'user_registration',
          e2e_test: true,
          security_features: 'csrf,rate_limit,headers,audit'
        }
      });

      // Verify audit log was created
      const auditLogs = await auditService.getAuditTrail('users', 'e2e-user-1');
      expect(auditLogs.length).toBeGreaterThan(0);
      expect(auditLogs[0].action).toBe('CREATE');
      expect(auditLogs[0].userEmail).toBe(userEmail);
    });

    it('should handle login flow with complete security validation', async () => {
      const userEmail = 'e2e-login@example.com';
      const userIP = '192.168.1.201';
      const userAgent = 'E2E Login Browser';
      const csrfToken = generateServerCSRFToken();

      // Step 1: GET /login - Establish session and security context
      const getLoginRequest = createSecureRequest({
        method: 'GET',
        path: '/login',
        ip: userIP,
        userAgent
      });

      const getLoginResponse = await middleware(getLoginRequest);
      
      // Verify security setup
      expect(getLoginResponse.headers.get('Content-Security-Policy')).toBeTruthy();
      expect(getLoginResponse.headers.get('X-CSRF-Token')).toBeTruthy();

      // Step 2: POST /api/auth/signin - Comprehensive security check
      const postLoginRequest = createSecureRequest({
        method: 'POST',
        path: '/api/auth/signin',
        ip: userIP,
        userAgent,
        headers: {
          'x-csrf-token': csrfToken,
          'content-type': 'application/json',
          'origin': 'https://example.com',
          'sec-fetch-site': 'same-origin',
          'sec-fetch-mode': 'cors'
        },
        cookies: {
          '__Secure-csrf-token': csrfToken
        },
        body: JSON.stringify({
          email: userEmail,
          password: 'UserPassword123!'
        })
      });

      // Verify all security layers
      const csrfValidation = validateCSRFProtection(postLoginRequest);
      expect(csrfValidation.isValid).toBe(true);

      const rateLimitResult = await checkAuthRateLimit(postLoginRequest);
      expect(rateLimitResult.allowed).toBe(true);

      const loginResponse = await middleware(postLoginRequest);
      
      // Should pass security checks
      expect(loginResponse.status).not.toBe(403);
      expect(loginResponse.status).not.toBe(429);

      // Verify rate limiting headers
      expect(loginResponse.headers.get('X-RateLimit-Limit')).toBeTruthy();
      expect(loginResponse.headers.get('X-RateLimit-Remaining')).toBeTruthy();

      // Step 3: POST successful login - Audit logging
      await auditService.createAuditLog({
        tableName: 'auth_sessions',
        recordId: 'e2e-login-session-1',
        action: 'LOGIN',
        newValues: {
          userId: 'e2e-user-2',
          ipAddress: userIP,
          userAgent
        },
        metadata: {
          operation: 'user_login',
          success: true,
          e2e_test: true,
          login_method: 'email_password'
        }
      });

      // Step 4: GET /dashboard - Verify authenticated access with security
      const dashboardRequest = createSecureRequest({
        method: 'GET',
        path: '/dashboard',
        ip: userIP,
        userAgent,
        headers: {
          'origin': 'https://example.com'
        },
        cookies: {
          'session-token': 'authenticated-session',
          '__Secure-csrf-token': csrfToken
        }
      });

      const dashboardResponse = await middleware(dashboardRequest);
      
      // Should maintain security headers for authenticated pages
      expect(dashboardResponse.headers.get('X-Frame-Options')).toBe('DENY');
      expect(dashboardResponse.headers.get('Content-Security-Policy')).toBeTruthy();
      expect(dashboardResponse.headers.get('X-Request-Id')).toBeTruthy();
    });

    it('should handle password reset with layered security', async () => {
      const userEmail = 'e2e-reset@example.com';
      const userIP = '192.168.1.202';
      const csrfToken = generateServerCSRFToken();

      // Step 1: Initiate password reset
      const resetInitRequest = createSecureRequest({
        method: 'POST',
        path: '/api/auth/forgot-password',
        ip: userIP,
        headers: {
          'x-csrf-token': csrfToken,
          'content-type': 'application/json',
          'origin': 'https://example.com'
        },
        cookies: {
          '__Secure-csrf-token': csrfToken
        },
        body: JSON.stringify({
          email: userEmail
        })
      });

      const resetInitResponse = await middleware(resetInitRequest);
      expect(resetInitResponse.status).not.toBe(403);

      // Step 2: Simulate reset token validation with security
      const resetToken = 'secure-reset-token-123';
      const resetCompleteRequest = createSecureRequest({
        method: 'POST',
        path: '/api/auth/reset-password',
        ip: userIP,
        headers: {
          'x-csrf-token': csrfToken,
          'content-type': 'application/json',
          'origin': 'https://example.com'
        },
        cookies: {
          '__Secure-csrf-token': csrfToken
        },
        body: JSON.stringify({
          token: resetToken,
          password: 'NewSecurePassword123!'
        })
      });

      const resetCompleteResponse = await middleware(resetCompleteRequest);
      expect(resetCompleteResponse.status).not.toBe(403);

      // Verify audit logging for password reset
      await auditService.createAuditLog({
        tableName: 'users',
        recordId: 'e2e-user-3',
        action: 'UPDATE',
        changedFields: [, 'passwordResetToken'],
        metadata: {
          operation: 'password_reset',
          e2e_test: true,
          reset_method: 'email_token'
        }
      });
    });
  });

  describe('Security Features During User Registration', () => {
    it('should validate comprehensive security during registration process', async () => {
      const registrationIP = '192.168.1.203';
      const csrfToken = generateServerCSRFToken();

      // Test registration with all security features active
      const secureRegistration = createSecureRequest({
        method: 'POST',
        path: '/api/auth/signup',
        ip: registrationIP,
        headers: {
          'x-csrf-token': csrfToken,
          'content-type': 'application/json',
          'origin': 'https://example.com',
          'sec-fetch-site': 'same-origin',
          'sec-fetch-mode': 'cors',
          'sec-fetch-dest': 'empty'
        },
        cookies: {
          '__Secure-csrf-token': csrfToken
        },
        body: JSON.stringify({
          email: 'secure-registration@example.com',
          password: 'VerySecurePassword123!',
          name: 'Secure User'
        })
      });

      // All security validations should pass
      const csrfCheck = validateCSRFProtection(secureRegistration);
      expect(csrfCheck.isValid).toBe(true);

      const rateLimitCheck = await checkAuthRateLimit(secureRegistration);
      expect(rateLimitCheck.allowed).toBe(true);

      const response = await middleware(secureRegistration);
      
      // Security headers should be comprehensive
      expect(response.headers.get('X-Frame-Options')).toBe('DENY');
      expect(response.headers.get('X-Content-Type-Options')).toBe('nosniff');
      expect(response.headers.get('Referrer-Policy')).toBe('strict-origin-when-cross-origin');
      expect(response.headers.get('Strict-Transport-Security')).toBeTruthy();
      
      const csp = response.headers.get('Content-Security-Policy');
      expect(csp).toBeTruthy();
      expect(csp).toContain("default-src 'self'");
      expect(csp).toContain("object-src 'none'");
    });

    it('should block registration attempts that fail security validation', async () => {
      const maliciousIP = '192.168.1.204';
      
      // Test 1: Missing CSRF token
      const noCsrfRequest = createSecureRequest({
        method: 'POST',
        path: '/api/auth/signup',
        ip: maliciousIP,
        headers: {
          'content-type': 'application/json',
          'origin': 'https://example.com'
        },
        body: JSON.stringify({
          email: 'malicious@example.com',
          password: 'password123'
        })
      });

      const noCsrfResponse = await middleware(noCsrfRequest);
      expect(noCsrfResponse.status).toBe(403); // CSRF protection blocks

      // Test 2: Invalid origin
      const invalidOriginRequest = createSecureRequest({
        method: 'POST',
        path: '/api/auth/signup',
        ip: maliciousIP,
        headers: {
          'x-csrf-token': generateServerCSRFToken(),
          'content-type': 'application/json',
          'origin': 'https://malicious-site.com'
        }
      });

      const invalidOriginResponse = await middleware(invalidOriginRequest);
      expect(invalidOriginResponse.status).toBe(403); // Origin validation blocks

      // Test 3: Rate limit exhaustion
      const rateLimitRequests = Array.from({ length: 15 }, (_, i) => 
        createSecureRequest({
          method: 'POST',
          path: '/api/auth/signin',
          ip: maliciousIP,
          headers: {
            'content-type': 'application/json',
            'origin': 'https://example.com'
          },
          body: JSON.stringify({
            email: `attempt${i}@example.com`,
            password: 'wrongpassword'
          })
        })
      );

      // Process rate limit requests
      for (const request of rateLimitRequests) {
        await middleware(request);
      }

      // Next request should be rate limited
      const rateLimitedRequest = createSecureRequest({
        method: 'POST',
        path: '/api/auth/signin',
        ip: maliciousIP,
        headers: {
          'content-type': 'application/json',
          'origin': 'https://example.com'
        }
      });

      const rateLimitedResponse = await middleware(rateLimitedRequest);
      expect(rateLimitedResponse.status).toBe(429); // Rate limit blocks
    });
  });

  describe('Security Features During Payment Processing', () => {
    it('should enforce strict security for payment operations', async () => {
      const paymentIP = '192.168.1.205';
      const csrfToken = generateServerCSRFToken();

      // Step 1: GET /checkout - Setup secure payment page
      const checkoutPageRequest = createSecureRequest({
        method: 'GET',
        path: '/checkout',
        ip: paymentIP,
        headers: {
          'origin': 'https://example.com'
        }
      });

      const checkoutResponse = await middleware(checkoutPageRequest);
      
      // Verify Stripe-compatible CSP for payment pages
      const csp = checkoutResponse.headers.get('Content-Security-Policy');
      expect(csp).toContain('https://js.stripe.com');
      expect(csp).toContain('https://checkout.stripe.com');
      expect(csp).toContain('https://api.stripe.com');
      expect(csp).toContain("frame-src 'self' https://js.stripe.com");

      // Step 2: POST /api/payments/create - Secure payment processing
      const paymentRequest = createSecureRequest({
        method: 'POST',
        path: '/api/payments/create',
        ip: paymentIP,
        headers: {
          'x-csrf-token': csrfToken,
          'content-type': 'application/json',
          'origin': 'https://example.com',
          'sec-fetch-site': 'same-origin'
        },
        cookies: {
          '__Secure-csrf-token': csrfToken,
          'session-token': 'authenticated-user-session'
        },
        body: JSON.stringify({
          amount: 2500,
          currency: 'usd',
          paymentMethodId: 'pm_test_card'
        })
      });

      // Verify payment rate limiting
      const paymentRateLimit = await checkPaymentRateLimit(paymentRequest);
      expect(paymentRateLimit.allowed).toBe(true);

      const paymentResponse = await middleware(paymentRequest);
      
      // Should pass all security checks
      expect(paymentResponse.status).not.toBe(403);
      expect(paymentResponse.status).not.toBe(429);
      
      // Verify enhanced security headers for payments
      expect(paymentResponse.headers.get('X-Frame-Options')).toBe('DENY');
      expect(paymentResponse.headers.get('Strict-Transport-Security')).toBeTruthy();

      // Step 3: Audit payment operation
      await auditService.createAuditLog({
        tableName: 'payments',
        recordId: 'e2e-payment-1',
        action: 'CREATE',
        newValues: {
          amount: 2500,
          currency: 'usd',
          status: 'processing'
        },
        metadata: {
          operation: 'payment_create',
          e2e_test: true,
          payment_method: 'card',
          security_validated: true
        }
      });
    });

    it('should handle payment webhooks with appropriate security', async () => {
      const webhookRequest = createSecureRequest({
        method: 'POST',
        path: '/api/stripe/webhook',
        ip: '3.18.12.63', // Stripe webhook IP
        headers: {
          'stripe-signature': 'test-webhook-signature',
          'content-type': 'application/json',
          'user-agent': 'Stripe/1.0'
        },
        body: JSON.stringify({
          id: 'evt_test_webhook',
          object: 'event',
          type: 'payment_intent.succeeded'
        })
      });

      const webhookResponse = await middleware(webhookRequest);
      
      // Webhooks should bypass CSRF but maintain other security
      expect(webhookResponse.status).not.toBe(403);
      expect(webhookResponse.headers.get('X-Frame-Options')).toBe('DENY');
      expect(webhookResponse.headers.get('X-Content-Type-Options')).toBe('nosniff');
    });
  });

  describe('Security Features During Session Management', () => {
    it('should maintain security throughout session lifecycle', async () => {
      const sessionIP = '192.168.1.206';
      const userAgent = 'Session Test Browser';
      const csrfToken = generateServerCSRFToken();

      // Step 1: Session creation during login
      const loginRequest = createSecureRequest({
        method: 'POST',
        path: '/api/auth/signin',
        ip: sessionIP,
        userAgent,
        headers: {
          'x-csrf-token': csrfToken,
          'content-type': 'application/json',
          'origin': 'https://example.com'
        },
        cookies: {
          '__Secure-csrf-token': csrfToken
        }
      });

      const loginResponse = await middleware(loginRequest);
      expect(loginResponse.status).not.toBe(403);

      // Step 2: Session refresh with security validation
      const refreshRequest = createSecureRequest({
        method: 'POST',
        path: '/api/auth/refresh',
        ip: sessionIP,
        headers: {
          'x-csrf-token': csrfToken,
          'content-type': 'application/json',
          'origin': 'https://example.com'
        },
        cookies: {
          '__Secure-csrf-token': csrfToken,
          'session-token': 'valid-session-token'
        }
      });

      const refreshResponse = await middleware(refreshRequest);
      expect(refreshResponse.status).not.toBe(403);

      // Step 3: Session termination with audit
      const logoutRequest = createSecureRequest({
        method: 'POST',
        path: '/api/auth/logout',
        ip: sessionIP,
        headers: {
          'x-csrf-token': csrfToken,
          'content-type': 'application/json',
          'origin': 'https://example.com'
        },
        cookies: {
          '__Secure-csrf-token': csrfToken,
          'session-token': 'valid-session-token'
        }
      });

      const logoutResponse = await middleware(logoutRequest);
      expect(logoutResponse.status).not.toBe(403);

      // Verify session audit logging
      await auditService.createAuditLog({
        tableName: 'sessions',
        recordId: 'e2e-session-1',
        action: 'DELETE',
        metadata: {
          operation: 'session_logout',
          e2e_test: true,
          termination_reason: 'user_initiated',
          security_context: 'full_validation'
        }
      });

      const sessionAudit = await auditService.getAuditTrail('sessions', 'e2e-session-1');
      expect(sessionAudit.length).toBeGreaterThan(0);
    });

    it('should handle concurrent sessions securely', async () => {
      const baseIP = '192.168.1.207';
      const csrfToken = generateServerCSRFToken();

      // Create multiple concurrent session requests
      const sessionRequests = Array.from({ length: 3 }, (_, i) => 
        createSecureRequest({
          method: 'POST',
          path: '/api/auth/session',
          ip: `${baseIP.slice(0, -1)}${parseInt(baseIP.slice(-1)) + i}`,
          headers: {
            'x-csrf-token': csrfToken,
            'content-type': 'application/json',
            'origin': 'https://example.com'
          },
          cookies: {
            '__Secure-csrf-token': csrfToken,
            'session-token': `concurrent-session-${i}`
          }
        })
      );

      // Process all requests concurrently
      const responses = await Promise.all(
        sessionRequests.map(request => middleware(request))
      );

      // All should pass security validation
      responses.forEach((response, _index) => {
        expect(response.status).not.toBe(403);
        expect(response.headers.get('X-Request-Id')).toBeTruthy();
        expect(response.headers.get('X-Frame-Options')).toBe('DENY');
      });
    });
  });

  describe('Cross-Component Security Integration', () => {
    it('should maintain security across different system components', async () => {
      const integrationIP = '192.168.1.208';
      const csrfToken = generateServerCSRFToken();

      // Test cross-component flow: Auth → Profile → Payment
      const componentRequests = [
        {
          name: 'Authentication',
          request: createSecureRequest({
            method: 'POST',
            path: '/api/auth/signin',
            ip: integrationIP,
            headers: {
              'x-csrf-token': csrfToken,
              'content-type': 'application/json',
              'origin': 'https://example.com'
            },
            cookies: { '__Secure-csrf-token': csrfToken }
          })
        },
        {
          name: 'Profile Management',
          request: createSecureRequest({
            method: 'POST',
            path: '/api/user/profile',
            ip: integrationIP,
            headers: {
              'x-csrf-token': csrfToken,
              'content-type': 'application/json',
              'origin': 'https://example.com'
            },
            cookies: {
              '__Secure-csrf-token': csrfToken,
              'session-token': 'authenticated-session'
            }
          })
        },
        {
          name: 'Payment Processing',
          request: createSecureRequest({
            method: 'POST',
            path: '/api/payments/create',
            ip: integrationIP,
            headers: {
              'x-csrf-token': csrfToken,
              'content-type': 'application/json',
              'origin': 'https://example.com'
            },
            cookies: {
              '__Secure-csrf-token': csrfToken,
              'session-token': 'authenticated-session'
            }
          })
        }
      ];

      // Test each component maintains security
      for (const { name, request } of componentRequests) {
        const response = await middleware(request);
        
        // All components should pass security validation
        expect(response.status).not.toBe(403);
        expect(response.headers.get('X-Frame-Options')).toBe('DENY');
        expect(response.headers.get('X-Content-Type-Options')).toBe('nosniff');
        
        // Component-specific validations
        if (name === 'Payment Processing') {
          const csp = response.headers.get('Content-Security-Policy');
          expect(csp).toBeTruthy();
        }
      }
    });
  });

  // Helper function to create secure requests with proper headers and context
  function createSecureRequest(options: {
    method: string;
    path: string;
    ip?: string;
    userAgent?: string;
    headers?: Record<string, string>;
    cookies?: Record<string, string>;
    body?: string;
  }): NextRequest {
    const {
      method,
      path,
      ip = '192.168.1.100',
      userAgent = 'E2E Test Browser',
      headers = {},
      cookies = {},
      body
    } = options;

    const url = `https://example.com${path}`;
    const requestHeaders = new Headers({
      'user-agent': userAgent,
      ...headers
    });

    const request = new NextRequest(url, {
      method,
      headers: requestHeaders,
      body
    });

    // Mock IP address
    Object.defineProperty(request, 'ip', {
      value: ip,
      writable: true
    });

    // Add cookies
    Object.entries(cookies).forEach(([name, value]) => {
      request.cookies.set(name, value);
    });

    return request;
  }
});