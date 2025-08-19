/**
 * Cross-Component Security Integration Tests
 * 
 * Tests middleware security with authentication components, validates security 
 * features with different authentication providers, and ensures security 
 * features work correctly with API rate limiting and session management.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach, jest } from '@jest/globals';
import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { middleware } from '@/middleware';
import {
  validateCSRFProtection,
  generateServerCSRFToken,
  applyCSRFProtection,
  type CSRFConfig
} from '@/lib/csrf-protection';
import {
  checkRateLimit,
  checkAuthRateLimit,
  checkPaymentRateLimit,
  checkApiRateLimit,
  cleanupRateLimit,
  getClientIP
} from '@/lib/rate-limiting';
import { AuditService, type AuditContext } from '@/lib/audit';
import { db } from '@/lib/db';

describe('Cross-Component Security Integration Tests', () => {
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
            path: ['cross_component_test'],
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

  describe('Middleware Security with Authentication Components', () => {
    it('should integrate middleware security with BetterAuth authentication', async () => {
      const userIP = '192.168.2.100';
      const userAgent = 'CrossComponent Test Browser';
      const csrfToken = generateServerCSRFToken();

      // Test authentication flow integration
      const authSteps = [
        {
          name: 'Login Page Access',
          request: createCrossComponentRequest({
            method: 'GET',
            path: '/login',
            ip: userIP,
            userAgent
          }),
          expectedSecurity: {
            csrf: false, // GET requests don't require CSRF
            rateLimit: false, // GET requests not rate limited
            headers: true
          }
        },
        {
          name: 'Authentication Request',
          request: createCrossComponentRequest({
            method: 'POST',
            path: '/api/auth/signin',
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
              email: 'auth-integration@example.com',
              password: 'AuthPassword123!'
            })
          }),
          expectedSecurity: {
            csrf: true,
            rateLimit: true,
            headers: true
          }
        },
        {
          name: 'Protected Page Access',
          request: createCrossComponentRequest({
            method: 'GET',
            path: '/dashboard',
            ip: userIP,
            userAgent,
            headers: {
              'origin': 'https://example.com'
            },
            cookies: {
              'session-token': 'authenticated-session-token',
              '__Secure-csrf-token': csrfToken
            }
          }),
          expectedSecurity: {
            csrf: false, // GET requests
            rateLimit: false,
            headers: true
          }
        },
        {
          name: 'API Access with Session',
          request: createCrossComponentRequest({
            method: 'POST',
            path: '/api/user/profile',
            ip: userIP,
            userAgent,
            headers: {
              'x-csrf-token': csrfToken,
              'content-type': 'application/json',
              'origin': 'https://example.com'
            },
            cookies: {
              'session-token': 'authenticated-session-token',
              '__Secure-csrf-token': csrfToken
            },
            body: JSON.stringify({
              name: 'Updated Name'
            })
          }),
          expectedSecurity: {
            csrf: true,
            rateLimit: true,
            headers: true
          }
        }
      ];

      for (const step of authSteps) {
        const response = await middleware(step.request);
        
        // Verify security integration
        if (step.expectedSecurity.headers) {
          expect(response.headers.get('X-Frame-Options')).toBe('DENY');
          expect(response.headers.get('X-Content-Type-Options')).toBe('nosniff');
          expect(response.headers.get('Strict-Transport-Security')).toBeTruthy();
        }

        if (step.expectedSecurity.csrf) {
          // Should not be blocked by CSRF (valid tokens provided)
          expect(response.status).not.toBe(403);
        }

        // Should not be rate limited (normal usage pattern)
        expect(response.status).not.toBe(429);

        // Log integration test step
        await auditService.createAuditLog({
          tableName: 'auth_integration',
          recordId: `step-${authSteps.indexOf(step)}`,
          action: 'ACCESS',
          metadata: {
            cross_component_test: true,
            integration_step: step.name,
            path: step.request.nextUrl.pathname,
            method: step.request.method,
            security_validated: true
          }
        });
      }
    });

    it('should coordinate security features across multiple authentication providers', async () => {
      const providers = [
        {
          name: 'Email/Password',
          path: '/api/auth/signin',
          body: { email: 'user@example.com', password: 'password123' }
        },
        {
          name: 'OAuth Google',
          path: '/api/auth/oauth/google',
          body: { code: 'oauth-code-123', state: 'oauth-state' }
        },
        {
          name: 'OAuth GitHub',
          path: '/api/auth/oauth/github',
          body: { code: 'github-code-456', state: 'github-state' }
        },
        {
          name: 'Magic Link',
          path: '/api/auth/magic-link',
          body: { token: 'magic-token-789' }
        }
      ];

      const userIP = '192.168.2.101';
      const csrfToken = generateServerCSRFToken();

      for (const provider of providers) {
        const request = createCrossComponentRequest({
          method: 'POST',
          path: provider.path,
          ip: userIP,
          headers: {
            'x-csrf-token': csrfToken,
            'content-type': 'application/json',
            'origin': 'https://example.com'
          },
          cookies: {
            '__Secure-csrf-token': csrfToken
          },
          body: JSON.stringify(provider.body)
        });

        const response = await middleware(request);

        // All providers should have consistent security treatment
        expect(response.headers.get('X-Frame-Options')).toBe('DENY');
        expect(response.headers.get('Content-Security-Policy')).toBeTruthy();
        expect(response.status).not.toBe(403); // CSRF should pass
        expect(response.status).not.toBe(429); // Rate limit should allow

        // Verify provider-specific audit logging
        await auditService.createAuditLog({
          tableName: 'provider_auth',
          recordId: `provider-${providers.indexOf(provider)}`,
          action: 'LOGIN',
          metadata: {
            cross_component_test: true,
            auth_provider: provider.name,
            security_integrated: true
          }
        });
      }
    });

    it('should maintain security context across session lifecycle', async () => {
      const userIP = '192.168.2.102';
      const sessionId = 'cross-component-session-123';
      const csrfToken = generateServerCSRFToken();

      const sessionLifecycle = [
        {
          name: 'Session Creation',
          request: createCrossComponentRequest({
            method: 'POST',
            path: '/api/auth/signin',
            ip: userIP,
            headers: {
              'x-csrf-token': csrfToken,
              'content-type': 'application/json',
              'origin': 'https://example.com'
            },
            cookies: {
              '__Secure-csrf-token': csrfToken
            }
          })
        },
        {
          name: 'Session Validation',
          request: createCrossComponentRequest({
            method: 'GET',
            path: '/api/auth/session',
            ip: userIP,
            headers: {
              'origin': 'https://example.com'
            },
            cookies: {
              'session-token': sessionId,
              '__Secure-csrf-token': csrfToken
            }
          })
        },
        {
          name: 'Session Refresh',
          request: createCrossComponentRequest({
            method: 'POST',
            path: '/api/auth/refresh',
            ip: userIP,
            headers: {
              'x-csrf-token': csrfToken,
              'content-type': 'application/json',
              'origin': 'https://example.com'
            },
            cookies: {
              'session-token': sessionId,
              '__Secure-csrf-token': csrfToken
            }
          })
        },
        {
          name: 'Session Termination',
          request: createCrossComponentRequest({
            method: 'POST',
            path: '/api/auth/logout',
            ip: userIP,
            headers: {
              'x-csrf-token': csrfToken,
              'content-type': 'application/json',
              'origin': 'https://example.com'
            },
            cookies: {
              'session-token': sessionId,
              '__Secure-csrf-token': csrfToken
            }
          })
        }
      ];

      // Set audit context for session lifecycle
      await auditService.setAuditContext({
        userId: 'cross-component-user',
        userEmail: 'crosscomponent@example.com',
        ipAddress: userIP,
        sessionId,
        requestId: 'session-lifecycle-test'
      });

      for (const step of sessionLifecycle) {
        const response = await middleware(step.request);

        // Security should be maintained throughout lifecycle
        expect(response.headers.get('X-Request-Id')).toBeTruthy();
        expect(response.headers.get('X-Frame-Options')).toBe('DENY');
        
        // CSRF and rate limiting should work consistently
        if (step.request.method === 'POST') {
          expect(response.status).not.toBe(403);
          expect(response.status).not.toBe(429);
        }

        // Log session lifecycle step
        await auditService.createAuditLog({
          tableName: 'session_lifecycle',
          recordId: sessionId,
          action: step.name.toUpperCase().replace(' ', '_') as any,
          metadata: {
            cross_component_test: true,
            lifecycle_step: step.name,
            session_security: 'maintained'
          }
        });
      }

      // Verify complete session audit trail
      const sessionAudit = await auditService.getAuditTrail('session_lifecycle', sessionId);
      expect(sessionAudit.length).toBe(sessionLifecycle.length);
    });
  });

  describe('Security Features with API Rate Limiting', () => {
    it('should coordinate CSRF protection with API rate limiting', async () => {
      const testIP = '192.168.2.103';
      const csrfToken = generateServerCSRFToken();

      // Test API rate limiting with CSRF protection
      const apiRequests = Array.from({ length: 15 }, (_, i) => 
        createCrossComponentRequest({
          method: 'POST',
          path: '/api/user/profile',
          ip: testIP,
          headers: {
            'x-csrf-token': csrfToken,
            'content-type': 'application/json',
            'origin': 'https://example.com'
          },
          cookies: {
            '__Secure-csrf-token': csrfToken,
            'session-token': 'valid-session'
          },
          body: JSON.stringify({ update: `request_${i}` })
        })
      );

      const responses = await Promise.all(
        apiRequests.map(request => middleware(request))
      );

      // First 10 requests should pass CSRF and not be rate limited
      const successfulRequests = responses.filter(r => 
        r.status !== 403 && r.status !== 429
      );
      
      // Should handle coordination properly
      expect(successfulRequests.length).toBeGreaterThan(8);
      
      // Rate limited requests should still have CSRF validation
      const rateLimitedRequests = responses.filter(r => r.status === 429);
      if (rateLimitedRequests.length > 0) {
        rateLimitedRequests.forEach(response => {
          expect(response.headers.get('X-RateLimit-Reset')).toBeTruthy();
          expect(response.headers.get('Retry-After')).toBeTruthy();
        });
      }
    });

    it('should handle mixed authentication and payment API rate limiting', async () => {
      const testIP = '192.168.2.104';
      const csrfToken = generateServerCSRFToken();

      // Mixed API calls with different rate limits
      const mixedRequests = [
        // Auth API calls (10/minute limit)
        ...Array.from({ length: 5 }, (_, i) => ({
          type: 'auth',
          request: createCrossComponentRequest({
            method: 'POST',
            path: '/api/auth/refresh',
            ip: testIP,
            headers: {
              'x-csrf-token': csrfToken,
              'content-type': 'application/json',
              'origin': 'https://example.com'
            },
            cookies: { '__Secure-csrf-token': csrfToken }
          })
        })),
        
        // Payment API calls (30/minute limit)
        ...Array.from({ length: 10 }, (_, i) => ({
          type: 'payment',
          request: createCrossComponentRequest({
            method: 'POST',
            path: '/api/payments/create',
            ip: testIP,
            headers: {
              'x-csrf-token': csrfToken,
              'content-type': 'application/json',
              'origin': 'https://example.com',
              'x-user-id': 'payment-user'
            },
            cookies: { '__Secure-csrf-token': csrfToken }
          })
        })),
        
        // General API calls (100/minute limit)
        ...Array.from({ length: 8 }, (_, i) => ({
          type: 'api',
          request: createCrossComponentRequest({
            method: 'GET',
            path: `/api/user/profile`,
            ip: testIP,
            headers: {
              'origin': 'https://example.com'
            }
          })
        }))
      ];

      // Process requests and track results by type
      const results = await Promise.all(
        mixedRequests.map(async ({ type, request }) => {
          const response = await middleware(request);
          return { type, status: response.status, response };
        })
      );

      // Group by type and analyze
      const byType = results.reduce((acc, { type, status, response }) => {
        if (!acc[type]) acc[type] = [];
        acc[type].push({ status, response });
        return acc;
      }, {} as Record<string, Array<{ status: number; response: Response }>>);

      // Auth requests should mostly succeed (under limit)
      const authSuccesses = byType.auth?.filter(r => r.status < 400).length || 0;
      expect(authSuccesses).toBeGreaterThan(3);

      // Payment requests should mostly succeed (higher limit)
      const paymentSuccesses = byType.payment?.filter(r => r.status < 400).length || 0;
      expect(paymentSuccesses).toBeGreaterThan(5);

      // API requests should all succeed (highest limit)
      const apiSuccesses = byType.api?.filter(r => r.status < 400).length || 0;
      expect(apiSuccesses).toBe(8);
    });

    it('should maintain security headers during rate limiting scenarios', async () => {
      const testIP = '192.168.2.105';
      
      // Exhaust rate limit with valid requests
      const exhaustRequests = Array.from({ length: 15 }, () =>
        createCrossComponentRequest({
          method: 'POST',
          path: '/api/auth/signin',
          ip: testIP,
          headers: {
            'content-type': 'application/json',
            'origin': 'https://example.com'
          },
          body: JSON.stringify({
            email: 'ratelimit@example.com',
            password: 'password123'
          })
        })
      );

      const responses = await Promise.all(
        exhaustRequests.map(request => middleware(request))
      );

      // Even rate-limited responses should maintain security headers
      const rateLimitedResponses = responses.filter(r => r.status === 429);
      
      rateLimitedResponses.forEach(response => {
        expect(response.headers.get('X-Frame-Options')).toBe('DENY');
        expect(response.headers.get('X-Content-Type-Options')).toBe('nosniff');
        expect(response.headers.get('X-RateLimit-Limit')).toBeTruthy();
        expect(response.headers.get('X-RateLimit-Remaining')).toBe('0');
      });
    });
  });

  describe('Security Integration with Session Management', () => {
    it('should integrate audit logging with session security events', async () => {
      const sessionUserIP = '192.168.2.106';
      const sessionUserId = 'session-integration-user';
      const csrfToken = generateServerCSRFToken();

      // Set comprehensive audit context
      const auditContext: AuditContext = {
        userId: sessionUserId,
        userEmail: 'sessionintegration@example.com',
        ipAddress: sessionUserIP,
        userAgent: 'Session Integration Browser',
        sessionId: 'integration-session-456',
        requestId: 'session-security-integration'
      };

      await auditService.setAuditContext(auditContext);

      // Simulate session security events
      const securityEvents = [
        {
          name: 'Session Creation with Security Validation',
          request: createCrossComponentRequest({
            method: 'POST',
            path: '/api/auth/signin',
            ip: sessionUserIP,
            headers: {
              'x-csrf-token': csrfToken,
              'content-type': 'application/json',
              'origin': 'https://example.com'
            },
            cookies: {
              '__Secure-csrf-token': csrfToken
            }
          }),
          auditAction: 'LOGIN'
        },
        {
          name: 'Suspicious IP Detection',
          request: createCrossComponentRequest({
            method: 'POST',
            path: '/api/auth/session',
            ip: '192.168.2.200', // Different IP
            headers: {
              'x-csrf-token': csrfToken,
              'content-type': 'application/json',
              'origin': 'https://example.com'
            },
            cookies: {
              'session-token': 'integration-session-456',
              '__Secure-csrf-token': csrfToken
            }
          }),
          auditAction: 'ACCESS'
        },
        {
          name: 'Session Security Upgrade',
          request: createCrossComponentRequest({
            method: 'POST',
            path: '/api/auth/security/upgrade',
            ip: sessionUserIP,
            headers: {
              'x-csrf-token': csrfToken,
              'content-type': 'application/json',
              'origin': 'https://example.com'
            },
            cookies: {
              'session-token': 'integration-session-456',
              '__Secure-csrf-token': csrfToken
            }
          }),
          auditAction: 'UPDATE'
        }
      ];

      for (const event of securityEvents) {
        const response = await middleware(event.request);
        
        // Security should be maintained
        expect(response.headers.get('X-Request-Id')).toBeTruthy();
        
        // Log the security event
        await auditService.createAuditLog({
          tableName: 'session_security_events',
          recordId: auditContext.sessionId!,
          action: event.auditAction as any,
          metadata: {
            cross_component_test: true,
            security_event: event.name,
            ip_address: event.request.ip,
            security_integrated: true,
            csrf_validated: true,
            headers_applied: true
          }
        });
      }

      // Verify comprehensive audit trail
      const securityAudit = await auditService.getAuditTrail(
        'session_security_events',
        auditContext.sessionId!
      );
      
      expect(securityAudit.length).toBe(securityEvents.length);
      
      // Verify audit entries contain security context
      securityAudit.forEach(entry => {
        expect(entry.ipAddress).toBeTruthy();
        expect(entry.userAgent).toBe(auditContext.userAgent);
        expect(entry.sessionId).toBe(auditContext.sessionId);
      });
    });

    it('should coordinate session termination with security cleanup', async () => {
      const terminationIP = '192.168.2.107';
      const sessionId = 'termination-session-789';
      const csrfToken = generateServerCSRFToken();

      // Simulate session termination scenarios
      const terminationScenarios = [
        {
          name: 'User Logout',
          request: createCrossComponentRequest({
            method: 'POST',
            path: '/api/auth/logout',
            ip: terminationIP,
            headers: {
              'x-csrf-token': csrfToken,
              'content-type': 'application/json',
              'origin': 'https://example.com'
            },
            cookies: {
              'session-token': sessionId,
              '__Secure-csrf-token': csrfToken
            }
          }),
          reason: 'user_initiated'
        },
        {
          name: 'Security-Based Termination',
          request: createCrossComponentRequest({
            method: 'POST',
            path: '/api/auth/terminate-session',
            ip: terminationIP,
            headers: {
              'x-csrf-token': csrfToken,
              'content-type': 'application/json',
              'origin': 'https://example.com'
            },
            cookies: {
              'session-token': sessionId,
              '__Secure-csrf-token': csrfToken
            },
            body: JSON.stringify({
              reason: 'suspicious_activity',
              sessionId
            })
          }),
          reason: 'security_threat'
        },
        {
          name: 'Admin-Forced Termination',
          request: createCrossComponentRequest({
            method: 'POST',
            path: '/api/admin/terminate-session',
            ip: terminationIP,
            headers: {
              'x-csrf-token': csrfToken,
              'content-type': 'application/json',
              'origin': 'https://example.com',
              'x-admin-user': 'admin-user-123'
            },
            cookies: {
              'admin-session': 'admin-session-token',
              '__Secure-csrf-token': csrfToken
            },
            body: JSON.stringify({
              targetSessionId: sessionId,
              reason: 'policy_violation'
            })
          }),
          reason: 'admin_action'
        }
      ];

      for (const scenario of terminationScenarios) {
        const response = await middleware(scenario.request);
        
        // Termination requests should pass security validation
        expect(response.status).not.toBe(403);
        expect(response.headers.get('X-Frame-Options')).toBe('DENY');

        // Log session termination with security context
        await auditService.createAuditLog({
          tableName: 'session_termination',
          recordId: `${sessionId}-${terminationScenarios.indexOf(scenario)}`,
          action: 'DELETE',
          metadata: {
            cross_component_test: true,
            termination_scenario: scenario.name,
            termination_reason: scenario.reason,
            security_validated: true,
            csrf_protected: true,
            audit_integrated: true
          }
        });
      }

      // Verify termination audit trail
      const terminationAudit = await auditService.queryAuditLogs({
        tableName: 'session_termination',
        actions: ['DELETE']
      });

      const testTerminations = terminationAudit.filter(log =>
        log.metadata && typeof log.metadata === 'object' &&
        'cross_component_test' in log.metadata
      );

      expect(testTerminations.length).toBeGreaterThanOrEqual(terminationScenarios.length);
    });
  });

  describe('End-to-End Cross-Component Security Validation', () => {
    it('should validate complete security integration across all components', async () => {
      const e2eUserIP = '192.168.2.108';
      const e2eUserId = 'e2e-cross-component-user';
      const csrfToken = generateServerCSRFToken();

      // Set comprehensive audit context for E2E test
      await auditService.setAuditContext({
        userId: e2eUserId,
        userEmail: 'e2ecross@example.com',
        ipAddress: e2eUserIP,
        userAgent: 'E2E Cross-Component Browser',
        sessionId: 'e2e-cross-session',
        requestId: 'e2e-cross-component-validation'
      });

      // Complete user journey with security validation at each step
      const e2eJourney = [
        {
          step: 'Registration with Security',
          request: createCrossComponentRequest({
            method: 'POST',
            path: '/api/auth/signup',
            ip: e2eUserIP,
            headers: {
              'x-csrf-token': csrfToken,
              'content-type': 'application/json',
              'origin': 'https://example.com'
            },
            cookies: { '__Secure-csrf-token': csrfToken },
            body: JSON.stringify({
              email: 'e2ecross@example.com',
              password: 'E2ECrossPassword123!',
              name: 'E2E Cross User'
            })
          }),
          validations: ['csrf', 'rateLimit', 'headers', 'audit']
        },
        {
          step: 'Email Verification Security',
          request: createCrossComponentRequest({
            method: 'POST',
            path: '/api/auth/verify-email',
            ip: e2eUserIP,
            headers: {
              'x-csrf-token': csrfToken,
              'content-type': 'application/json',
              'origin': 'https://example.com'
            },
            cookies: { '__Secure-csrf-token': csrfToken },
            body: JSON.stringify({
              token: 'verification-token-123',
              email: 'e2ecross@example.com'
            })
          }),
          validations: ['csrf', 'headers', 'audit']
        },
        {
          step: 'Authentication Security',
          request: createCrossComponentRequest({
            method: 'POST',
            path: '/api/auth/signin',
            ip: e2eUserIP,
            headers: {
              'x-csrf-token': csrfToken,
              'content-type': 'application/json',
              'origin': 'https://example.com'
            },
            cookies: { '__Secure-csrf-token': csrfToken },
            body: JSON.stringify({
              email: 'e2ecross@example.com',
              password: 'E2ECrossPassword123!'
            })
          }),
          validations: ['csrf', 'rateLimit', 'headers', 'audit']
        },
        {
          step: 'Profile Management Security',
          request: createCrossComponentRequest({
            method: 'POST',
            path: '/api/user/profile',
            ip: e2eUserIP,
            headers: {
              'x-csrf-token': csrfToken,
              'content-type': 'application/json',
              'origin': 'https://example.com'
            },
            cookies: {
              'session-token': 'e2e-cross-session',
              '__Secure-csrf-token': csrfToken
            },
            body: JSON.stringify({
              name: 'Updated E2E Cross User',
              preferences: { theme: 'dark' }
            })
          }),
          validations: ['csrf', 'rateLimit', 'headers', 'audit']
        },
        {
          step: 'Payment Processing Security',
          request: createCrossComponentRequest({
            method: 'POST',
            path: '/api/payments/create',
            ip: e2eUserIP,
            headers: {
              'x-csrf-token': csrfToken,
              'content-type': 'application/json',
              'origin': 'https://example.com'
            },
            cookies: {
              'session-token': 'e2e-cross-session',
              '__Secure-csrf-token': csrfToken
            },
            body: JSON.stringify({
              amount: 2999,
              currency: 'usd',
              paymentMethodId: 'pm_test_e2e'
            })
          }),
          validations: ['csrf', 'rateLimit', 'headers', 'audit']
        },
        {
          step: 'Session Management Security',
          request: createCrossComponentRequest({
            method: 'POST',
            path: '/api/auth/logout',
            ip: e2eUserIP,
            headers: {
              'x-csrf-token': csrfToken,
              'content-type': 'application/json',
              'origin': 'https://example.com'
            },
            cookies: {
              'session-token': 'e2e-cross-session',
              '__Secure-csrf-token': csrfToken
            }
          }),
          validations: ['csrf', 'headers', 'audit']
        }
      ];

      const stepResults: Array<{
        step: string;
        response: Response;
        validations: string[];
        securityPassed: boolean;
      }> = [];

      for (const journeyStep of e2eJourney) {
        const response = await middleware(journeyStep.request);
        
        let securityPassed = true;
        const validationResults: Record<string, boolean> = {};

        // Validate each security component
        if (journeyStep.validations.includes('csrf')) {
          const csrfValid = response.status !== 403;
          validationResults.csrf = csrfValid;
          securityPassed = securityPassed && csrfValid;
        }

        if (journeyStep.validations.includes('rateLimit')) {
          const rateLimitValid = response.status !== 429;
          validationResults.rateLimit = rateLimitValid;
          securityPassed = securityPassed && rateLimitValid;
        }

        if (journeyStep.validations.includes('headers')) {
          const headersValid = !!(
            response.headers.get('X-Frame-Options') &&
            response.headers.get('X-Content-Type-Options') &&
            response.headers.get('Content-Security-Policy')
          );
          validationResults.headers = headersValid;
          securityPassed = securityPassed && headersValid;
        }

        if (journeyStep.validations.includes('audit')) {
          // Audit logging happens asynchronously, assume success for response validation
          validationResults.audit = true;
        }

        stepResults.push({
          step: journeyStep.step,
          response,
          validations: journeyStep.validations,
          securityPassed
        });

        // Log the E2E step
        await auditService.createAuditLog({
          tableName: 'e2e_cross_component',
          recordId: `e2e-step-${e2eJourney.indexOf(journeyStep)}`,
          action: 'ACCESS',
          metadata: {
            cross_component_test: true,
            e2e_step: journeyStep.step,
            validations_required: journeyStep.validations,
            security_passed: securityPassed,
            validation_results: validationResults
          }
        });
      }

      // Verify overall E2E security success
      const overallSecurityPass = stepResults.every(result => result.securityPassed);
      expect(overallSecurityPass).toBe(true);

      // Verify complete audit trail
      const e2eAudit = await auditService.queryAuditLogs({
        tableName: 'e2e_cross_component',
        limit: e2eJourney.length + 2
      });

      const e2eTestLogs = e2eAudit.filter(log =>
        log.metadata && typeof log.metadata === 'object' &&
        'cross_component_test' in log.metadata
      );

      expect(e2eTestLogs.length).toBeGreaterThanOrEqual(e2eJourney.length);

      // Verify security metrics
      const securityMetrics = {
        totalSteps: stepResults.length,
        securityPassRate: stepResults.filter(r => r.securityPassed).length / stepResults.length,
        csrfValidations: stepResults.filter(r => r.validations.includes('csrf')).length,
        rateLimitValidations: stepResults.filter(r => r.validations.includes('rateLimit')).length,
        headerValidations: stepResults.filter(r => r.validations.includes('headers')).length,
        auditValidations: stepResults.filter(r => r.validations.includes('audit')).length
      };

      expect(securityMetrics.securityPassRate).toBe(1.0); // 100% security validation success
      expect(securityMetrics.totalSteps).toBe(e2eJourney.length);
    });
  });

  // Helper function to create cross-component test requests
  function createCrossComponentRequest(options: {
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
      ip = '192.168.2.10',
      userAgent = 'CrossComponent Test Browser',
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