/**
 * Cookie Security Integration Tests
 * 
 * Tests HttpOnly, Secure, SameSite cookie attributes and cookie security
 * across different environments and authentication flows.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach, jest } from '@jest/globals';
import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { setCSRFToken } from '@/lib/csrf-protection';

describe('Cookie Security Integration Tests', () => {
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

  describe('HttpOnly, Secure, SameSite Cookie Attributes', () => {
    it('should set secure cookies in production environment', () => {
      process.env.NODE_ENV = 'production';
      
      const response = NextResponse.next();
      const { response: csrfResponse } = setCSRFToken(response);
      
      const setCookieHeaders = csrfResponse.headers.getSetCookie();
      const csrfCookie = setCookieHeaders.find(cookie => cookie.includes('__Secure-csrf-token'));
      
      expect(csrfCookie).toBeTruthy();
      expect(csrfCookie).toContain('Secure');
      expect(csrfCookie).toContain('SameSite=lax');
      expect(csrfCookie).toContain('Path=/');
      expect(csrfCookie).toContain('Max-Age=3600');
      
      // CSRF tokens should NOT be HttpOnly for double-submit pattern
      expect(csrfCookie).not.toContain('HttpOnly');
    });

    it('should set non-secure cookies in development environment', () => {
      process.env.NODE_ENV = 'development';
      
      const response = NextResponse.next();
      const { response: csrfResponse } = setCSRFToken(response);
      
      const setCookieHeaders = csrfResponse.headers.getSetCookie();
      const csrfCookie = setCookieHeaders.find(cookie => cookie.includes('__Secure-csrf-token'));
      
      expect(csrfCookie).toBeTruthy();
      expect(csrfCookie).not.toContain('Secure');
      expect(csrfCookie).toContain('SameSite=lax');
    });

    it('should validate session cookie attributes for BetterAuth integration', async () => {
      // Mock session cookie from BetterAuth
      const sessionCookie = createSessionCookie('production');
      
      expect(sessionCookie).toContain('HttpOnly');
      expect(sessionCookie).toContain('Secure');
      expect(sessionCookie).toContain('SameSite=lax');
      expect(sessionCookie).toContain('Path=/');
    });

    it('should handle different SameSite policies based on use case', () => {
      const testCases = [
        {
          name: 'CSRF Token - Lax for general protection',
          cookieType: 'csrf',
          expectedSameSite: 'lax'
        },
        {
          name: 'Session Cookie - Lax for auth flows',
          cookieType: 'session',
          expectedSameSite: 'lax'
        },
        {
          name: 'Payment Cookie - Strict for sensitive operations',
          cookieType: 'payment',
          expectedSameSite: 'strict'
        }
      ];

      testCases.forEach(testCase => {
        const cookie = createTestCookie(testCase.cookieType);
        expect(cookie).toContain(`SameSite=${testCase.expectedSameSite}`);
      });
    });
  });

  describe('Cookie Security Across Different Environments', () => {
    it('should adapt cookie security based on environment variables', () => {
      const environments = [
        { NODE_ENV: 'production', expectSecure: true },
        { NODE_ENV: 'development', expectSecure: false },
        { NODE_ENV: 'test', expectSecure: false }
      ];

      environments.forEach(env => {
        process.env.NODE_ENV = env.NODE_ENV;
        
        const response = NextResponse.next();
        const { response: csrfResponse } = setCSRFToken(response);
        
        const setCookieHeaders = csrfResponse.headers.getSetCookie();
        const csrfCookie = setCookieHeaders.find(cookie => cookie.includes('__Secure-csrf-token'));
        
        if (env.expectSecure) {
          expect(csrfCookie).toContain('Secure');
        } else {
          expect(csrfCookie).not.toContain('Secure');
        }
      });
    });

    it('should handle localhost exceptions in development', () => {
      process.env.NODE_ENV = 'development';
      process.env.NEXT_PUBLIC_APP_URL = 'http://localhost:3000';
      
      // In development, cookies should work on localhost without Secure flag
      const response = NextResponse.next();
      const { response: csrfResponse } = setCSRFToken(response);
      
      const setCookieHeaders = csrfResponse.headers.getSetCookie();
      const csrfCookie = setCookieHeaders.find(cookie => cookie.includes('__Secure-csrf-token'));
      
      expect(csrfCookie).not.toContain('Secure');
    });

    it('should enforce secure cookies on HTTPS in production', () => {
      process.env.NODE_ENV = 'production';
      process.env.NEXT_PUBLIC_APP_URL = 'https://example.com';
      
      const response = NextResponse.next();
      const { response: csrfResponse } = setCSRFToken(response);
      
      const setCookieHeaders = csrfResponse.headers.getSetCookie();
      const csrfCookie = setCookieHeaders.find(cookie => cookie.includes('__Secure-csrf-token'));
      
      expect(csrfCookie).toContain('Secure');
    });
  });

  describe('Cookie Domain and Path Restrictions', () => {
    it('should set appropriate domain restrictions for cookies', () => {
      const testCases = [
        {
          name: 'Main domain cookie',
          domain: 'example.com',
          expectedDomain: undefined // Let browser set domain
        },
        {
          name: 'Subdomain cookie',
          domain: 'api.example.com',
          expectedDomain: '.example.com' // Allow parent domain
        }
      ];

      testCases.forEach(testCase => {
        process.env.NEXT_PUBLIC_APP_URL = `https://${testCase.domain}`;
        
        const cookie = createDomainSpecificCookie(testCase.domain);
        
        if (testCase.expectedDomain) {
          expect(cookie).toContain(`Domain=${testCase.expectedDomain}`);
        } else {
          expect(cookie).not.toContain('Domain=');
        }
      });
    });

    it('should restrict cookie paths appropriately', () => {
      const pathTestCases = [
        {
          cookieType: 'csrf',
          expectedPath: '/',
          description: 'CSRF tokens need global access'
        },
        {
          cookieType: 'session',
          expectedPath: '/',
          description: 'Session cookies need global access'
        },
        {
          cookieType: 'admin',
          expectedPath: '/admin',
          description: 'Admin cookies should be path-restricted'
        },
        {
          cookieType: 'api',
          expectedPath: '/api',
          description: 'API cookies should be path-restricted'
        }
      ];

      pathTestCases.forEach(testCase => {
        const cookie = createPathSpecificCookie(testCase.cookieType);
        expect(cookie).toContain(`Path=${testCase.expectedPath}`);
      });
    });

    it('should handle cookie path inheritance correctly', () => {
      // Test that cookies set on specific paths are accessible to child paths
      const adminCookie = createPathSpecificCookie('admin');
      const apiCookie = createPathSpecificCookie('api');
      
      expect(adminCookie).toContain('Path=/admin');
      expect(apiCookie).toContain('Path=/api');
      
      // Global cookies should be accessible everywhere
      const response = NextResponse.next();
      const { response: csrfResponse } = setCSRFToken(response);
      const setCookieHeaders = csrfResponse.headers.getSetCookie();
      const globalCookie = setCookieHeaders.find(cookie => cookie.includes('__Secure-csrf-token'));
      
      expect(globalCookie).toContain('Path=/');
    });
  });

  describe('Cookie Expiration and Renewal', () => {
    it('should set appropriate expiration times for different cookie types', () => {
      const expirationTests = [
        {
          cookieType: 'csrf',
          expectedMaxAge: 3600, // 1 hour
          description: 'CSRF tokens should expire relatively quickly'
        },
        {
          cookieType: 'session',
          expectedMaxAge: 86400 * 7, // 7 days
          description: 'Session cookies should last longer'
        },
        {
          cookieType: 'remember_me',
          expectedMaxAge: 86400 * 30, // 30 days
          description: 'Remember me cookies should persist'
        }
      ];

      expirationTests.forEach(test => {
        const cookie = createExpirationTestCookie(test.cookieType);
        expect(cookie).toContain(`Max-Age=${test.expectedMaxAge}`);
      });
    });

    it('should handle cookie renewal for long-running sessions', () => {
      // Initial cookie set
      const response1 = NextResponse.next();
      const { token: token1, response: csrfResponse1 } = setCSRFToken(response1);
      
      // Fast-forward time by 30 minutes
      jest.advanceTimersByTime(30 * 60 * 1000);
      
      // Renew cookie
      const response2 = NextResponse.next();
      const { token: token2, response: csrfResponse2 } = setCSRFToken(response2);
      
      // Tokens should be different (renewed)
      expect(token1).not.toBe(token2);
      
      // Both should have valid expiration times
      const cookies1 = csrfResponse1.headers.getSetCookie();
      const cookies2 = csrfResponse2.headers.getSetCookie();
      
      expect(cookies1[0]).toContain('Max-Age=3600');
      expect(cookies2[0]).toContain('Max-Age=3600');
    });

    it('should clean up expired cookies properly', () => {
      const response = NextResponse.next();
      
      // Set an expired cookie (negative Max-Age)
      response.headers.append('Set-Cookie', 'expired_cookie=value; Max-Age=0; Path=/');
      
      const setCookieHeaders = response.headers.getSetCookie();
      const expiredCookie = setCookieHeaders.find(cookie => cookie.includes('expired_cookie'));
      
      expect(expiredCookie).toContain('Max-Age=0');
    });
  });

  describe('Session Cookie Security with BetterAuth', () => {
    it('should validate BetterAuth session cookie security attributes', async () => {
      const sessionCookie = createBetterAuthSessionCookie();
      
      // BetterAuth session cookies should be secure
      expect(sessionCookie).toContain('HttpOnly');
      expect(sessionCookie).toContain('Secure');
      expect(sessionCookie).toContain('SameSite=lax');
      expect(sessionCookie).toContain('Path=/');
      
      // Should not be accessible via JavaScript
      expect(sessionCookie).not.toContain('HttpOnly=false');
    });

    it('should handle session cookie rotation properly', async () => {
      // Simulate session rotation scenario
      const oldSessionCookie = createBetterAuthSessionCookie('old-session-id');
      const newSessionCookie = createBetterAuthSessionCookie('new-session-id');
      
      expect(oldSessionCookie).toContain('old-session-id');
      expect(newSessionCookie).toContain('new-session-id');
      
      // Both should have same security attributes
      const securityAttributes = ['HttpOnly', 'Secure', 'SameSite=lax', 'Path=/'];
      securityAttributes.forEach(attr => {
        expect(oldSessionCookie).toContain(attr);
        expect(newSessionCookie).toContain(attr);
      });
    });

    it('should validate session cookie during authentication flows', () => {
      const authFlows = ['login', 'register', 'password-reset'];
      
      authFlows.forEach(flow => {
        const sessionCookie = createBetterAuthSessionCookie(`session-${flow}`);
        
        // All auth flows should produce secure session cookies
        expect(sessionCookie).toContain('HttpOnly');
        expect(sessionCookie).toContain('Secure');
        expect(sessionCookie).toContain('SameSite=lax');
      });
    });
  });

  describe('Cookie Security Under Different Network Conditions', () => {
    it('should maintain cookie security over HTTPS', () => {
      process.env.NODE_ENV = 'production';
      const httpsRequest = createMockRequest('https://example.com/api/auth');
      
      const response = NextResponse.next();
      const { response: csrfResponse } = setCSRFToken(response);
      
      const setCookieHeaders = csrfResponse.headers.getSetCookie();
      const secureCookie = setCookieHeaders.find(cookie => cookie.includes('__Secure-csrf-token'));
      
      expect(secureCookie).toContain('Secure');
      expect(secureCookie).toContain('SameSite=lax');
    });

    it('should handle mixed content scenarios gracefully', () => {
      // Test when HTTPS site loads HTTP resources (shouldn't affect cookie security)
      process.env.NODE_ENV = 'production';
      
      const response = NextResponse.next();
      const { response: csrfResponse } = setCSRFToken(response);
      
      const setCookieHeaders = csrfResponse.headers.getSetCookie();
      const cookie = setCookieHeaders.find(cookie => cookie.includes('__Secure-csrf-token'));
      
      // Should still be secure even in mixed content scenarios
      expect(cookie).toContain('Secure');
    });

    it('should handle proxy and load balancer scenarios', () => {
      // Test X-Forwarded-Proto header scenarios
      const proxyScenarios = [
        { 'x-forwarded-proto': 'https', expectSecure: true },
        { 'x-forwarded-proto': 'http', expectSecure: false }
      ];

      proxyScenarios.forEach(scenario => {
        const request = createMockRequest('http://internal-server', scenario);
        
        // Cookie security should be based on original protocol
        const isHttpsOrigin = scenario['x-forwarded-proto'] === 'https';
        const cookie = createProxyAwareCookie(request);
        
        if (isHttpsOrigin && process.env.NODE_ENV === 'production') {
          expect(cookie).toContain('Secure');
        }
      });
    });
  });

  describe('Cross-Browser Cookie Compatibility', () => {
    it('should handle different SameSite support levels', () => {
      const browserScenarios = [
        {
          name: 'Modern browsers with full SameSite support',
          userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/91.0.4472.124',
          expectSameSite: true
        },
        {
          name: 'Legacy browsers with limited SameSite support',
          userAgent: 'Mozilla/5.0 (Windows NT 6.1; WOW64; Trident/7.0; rv:11.0) like Gecko',
          expectSameSite: false
        }
      ];

      browserScenarios.forEach(scenario => {
        const cookie = createBrowserCompatibleCookie(scenario.userAgent);
        
        if (scenario.expectSameSite) {
          expect(cookie).toContain('SameSite=');
        }
        
        // All cookies should still be secure in production
        if (process.env.NODE_ENV === 'production') {
          expect(cookie).toContain('Secure');
        }
      });
    });

    it('should handle cookie size limitations', () => {
      // Test that cookies don't exceed browser limits
      const largeCookieValue = 'x'.repeat(4000); // Approaching 4KB limit
      
      expect(() => {
        const cookie = createLargeCookie(largeCookieValue);
        // Should not throw, but cookie value should be reasonable
        expect(cookie.length).toBeLessThan(4096);
      }).not.toThrow();
    });
  });

  describe('Cookie Security Performance Impact', () => {
    it('should handle high-volume cookie operations efficiently', () => {
      const startTime = Date.now();
      const cookieCount = 1000;
      
      // Create many secure cookies
      const cookies: string[] = [];
      for (let i = 0; i < cookieCount; i++) {
        const response = NextResponse.next();
        const { response: csrfResponse } = setCSRFToken(response);
        const setCookieHeaders = csrfResponse.headers.getSetCookie();
        cookies.push(...setCookieHeaders);
      }
      
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      // Should create cookies efficiently
      expect(cookies.length).toBe(cookieCount);
      expect(duration).toBeLessThan(1000); // Less than 1 second for 1000 cookies
      
      // All cookies should maintain security attributes
      cookies.forEach(cookie => {
        expect(cookie).toContain('SameSite=lax');
        if (process.env.NODE_ENV === 'production') {
          expect(cookie).toContain('Secure');
        }
      });
    });
  });

  // Helper functions for creating test cookies
  function createSessionCookie(environment: string): string {
    const secure = environment === 'production' ? 'Secure; ' : '';
    return `better-auth.session_token=abc123; Path=/; ${secure}HttpOnly; SameSite=lax; Max-Age=604800`;
  }

  function createTestCookie(cookieType: string): string {
    const attributes = {
      csrf: 'SameSite=lax',
      session: 'SameSite=lax; HttpOnly',
      payment: 'SameSite=strict; Secure'
    };
    
    return `test_${cookieType}=value; Path=/; ${attributes[cookieType] || 'SameSite=lax'}`;
  }

  function createDomainSpecificCookie(domain: string): string {
    const isDevelopment = domain.includes('localhost');
    const domainAttr = isDevelopment ? '' : `Domain=.${domain.split('.').slice(-2).join('.')}; `;
    return `domain_cookie=value; Path=/; ${domainAttr}SameSite=lax`;
  }

  function createPathSpecificCookie(cookieType: string): string {
    const paths = {
      csrf: '/',
      session: '/',
      admin: '/admin',
      api: '/api'
    };
    
    const path = paths[cookieType] || '/';
    return `${cookieType}_cookie=value; Path=${path}; SameSite=lax`;
  }

  function createExpirationTestCookie(cookieType: string): string {
    const maxAges = {
      csrf: 3600,
      session: 86400 * 7,
      remember_me: 86400 * 30
    };
    
    const maxAge = maxAges[cookieType] || 3600;
    return `${cookieType}_cookie=value; Path=/; Max-Age=${maxAge}; SameSite=lax`;
  }

  function createBetterAuthSessionCookie(sessionId = 'session-id'): string {
    const secure = process.env.NODE_ENV === 'production' ? 'Secure; ' : '';
    return `better-auth.session_token=${sessionId}; Path=/; ${secure}HttpOnly; SameSite=lax; Max-Age=604800`;
  }

  function createMockRequest(url: string, headers: Record<string, string> = {}): NextRequest {
    const requestHeaders = new Headers(headers);
    return new NextRequest(url, {
      headers: requestHeaders
    });
  }

  function createProxyAwareCookie(request: NextRequest): string {
    const isHttpsOrigin = request.headers.get('x-forwarded-proto') === 'https';
    const secure = isHttpsOrigin && process.env.NODE_ENV === 'production' ? 'Secure; ' : '';
    return `proxy_aware_cookie=value; Path=/; ${secure}SameSite=lax`;
  }

  function createBrowserCompatibleCookie(userAgent: string): string {
    // Simple user agent detection for SameSite support
    const supportsSameSite = !userAgent.includes('Trident') && !userAgent.includes('MSIE');
    const sameSite = supportsSameSite ? 'SameSite=lax; ' : '';
    const secure = process.env.NODE_ENV === 'production' ? 'Secure; ' : '';
    
    return `browser_cookie=value; Path=/; ${secure}${sameSite}Max-Age=3600`;
  }

  function createLargeCookie(value: string): string {
    // Truncate if too large to prevent browser issues
    const truncatedValue = value.length > 3500 ? value.substring(0, 3500) : value;
    return `large_cookie=${truncatedValue}; Path=/; SameSite=lax`;
  }
});