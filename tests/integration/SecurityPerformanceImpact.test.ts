/**
 * Security Performance Impact Integration Tests
 * 
 * Tests the performance overhead of security features on authentication
 * performance, validates security features under high load, and ensures
 * scalability of security implementations.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach, jest } from '@jest/globals';
import { NextRequest, NextResponse } from 'next/server';
import { performance } from 'perf_hooks';
import { middleware } from '@/middleware';
import {
  checkRateLimit,
  checkAuthRateLimit,
  checkPaymentRateLimit,
  cleanupRateLimit,
  type RateLimitConfig
} from '@/lib/rate-limiting';
import {
  validateCSRFProtection,
  generateServerCSRFToken,
  applyCSRFProtection
} from '@/lib/csrf-protection';
import { AuditService } from '@/lib/audit';
import { db } from '@/lib/db';

describe('Security Performance Impact Integration Tests', () => {
  let auditService: AuditService;
  let performanceMetrics: Map<string, number[]> = new Map();

  beforeAll(async () => {
    auditService = new AuditService(db);
  });

  afterAll(async () => {
    await cleanupRateLimit();
    
    // Clean up performance test audit logs
    try {
      await db.auditLog.deleteMany({
        where: {
          metadata: {
            path: ['performance_test'],
            equals: true
          }
        }
      });
    } catch (_error) {
      // Ignore cleanup errors
    }

    // Log performance summary
    // console.log('\n=== Security Performance Test Summary ===');
    for (const [testName, measurements] of performanceMetrics.entries()) {
      const avg = measurements.reduce((a, b) => a + b, 0) / measurements.length;
      const min = Math.min(...measurements);
      const max = Math.max(...measurements);
      // console.log(`${testName}: avg=${avg.toFixed(2)}ms, min=${min.toFixed(2)}ms, max=${max.toFixed(2)}ms`);
    }
  });

  beforeEach(() => {
    jest.clearAllMocks();
    performanceMetrics.clear();
  });

  afterEach(() => {
    // No cleanup needed per test
  });

  describe('Security Feature Overhead on Authentication Performance', () => {
    it('should measure CSRF validation performance overhead', async () => {
      const testIterations = 100;
      const csrfToken = generateServerCSRFToken();
      
      // Baseline: Request without CSRF validation
      const baselineRequest = createPerformanceRequest({
        method: 'GET',
        path: '/api/health', // Excluded from CSRF
        headers: { 'origin': 'https://example.com' }
      });

      const baselineTimes: number[] = [];
      for (let i = 0; i < testIterations; i++) {
        const start = performance.now();
        await middleware(baselineRequest);
        const end = performance.now();
        baselineTimes.push(end - start);
      }

      // CSRF-protected request
      const csrfRequest = createPerformanceRequest({
        method: 'POST',
        path: '/api/user/profile',
        headers: {
          'x-csrf-token': csrfToken,
          'content-type': 'application/json',
          'origin': 'https://example.com'
        },
        cookies: {
          '__Secure-csrf-token': csrfToken
        }
      });

      const csrfTimes: number[] = [];
      for (let i = 0; i < testIterations; i++) {
        const start = performance.now();
        await middleware(csrfRequest);
        const end = performance.now();
        csrfTimes.push(end - start);
      }

      const baselineAvg = baselineTimes.reduce((a, b) => a + b) / baselineTimes.length;
      const csrfAvg = csrfTimes.reduce((a, b) => a + b) / csrfTimes.length;
      const overhead = csrfAvg - baselineAvg;

      performanceMetrics.set('CSRF Baseline', baselineTimes);
      performanceMetrics.set('CSRF Protected', csrfTimes);

      // CSRF overhead should be minimal (< 5ms average)
      expect(overhead).toBeLessThan(5);
      expect(csrfAvg).toBeLessThan(20); // Should complete quickly
    });

    it('should measure rate limiting performance impact', async () => {
      const testIterations = 100;
      const testIP = '192.168.100.1';
      
      // Test rate limiting performance
      const rateLimitTimes: number[] = [];
      
      for (let i = 0; i < testIterations; i++) {
        const request = createPerformanceRequest({
          method: 'POST',
          path: '/api/auth/signin',
          ip: testIP,
          headers: {
            'content-type': 'application/json',
            'origin': 'https://example.com'
          }
        });

        const start = performance.now();
        await checkAuthRateLimit(request);
        const end = performance.now();
        rateLimitTimes.push(end - start);
      }

      const rateLimitAvg = rateLimitTimes.reduce((a, b) => a + b) / rateLimitTimes.length;
      performanceMetrics.set('Rate Limiting', rateLimitTimes);

      // Rate limiting should be very fast (< 3ms average)
      expect(rateLimitAvg).toBeLessThan(3);
      
      // 99th percentile should be reasonable
      const sorted = rateLimitTimes.sort((a, b) => a - b);
      const p99 = sorted[Math.floor(testIterations * 0.99)];
      expect(p99).toBeLessThan(10);
    });

    it('should measure audit logging performance impact', async () => {
      const testIterations = 50; // Fewer iterations for database operations
      
      const auditTimes: number[] = [];
      
      for (let i = 0; i < testIterations; i++) {
        const start = performance.now();
        
        await auditService.createAuditLog({
          tableName: 'performance_test',
          recordId: `perf-record-${i}`,
          action: 'CREATE',
          newValues: { data: `performance_test_${i}` },
          metadata: {
            performance_test: true,
            iteration: i
          }
        });
        
        const end = performance.now();
        auditTimes.push(end - start);
      }

      const auditAvg = auditTimes.reduce((a, b) => a + b) / auditTimes.length;
      performanceMetrics.set('Audit Logging', auditTimes);

      // Audit logging should be reasonably fast (< 50ms average)
      expect(auditAvg).toBeLessThan(50);
      
      // Should handle concurrent operations well
      const concurrentPromises = Array.from({ length: 10 }, async (_, i) => {
        const start = performance.now();
        await auditService.createAuditLog({
          tableName: 'performance_concurrent',
          recordId: `concurrent-${i}`,
          action: 'CREATE',
          metadata: { performance_test: true, concurrent: true }
        });
        const end = performance.now();
        return end - start;
      });

      const concurrentTimes = await Promise.all(concurrentPromises);
      const concurrentAvg = concurrentTimes.reduce((a, b) => a + b) / concurrentTimes.length;
      
      // Concurrent audit logging should not degrade significantly
      expect(concurrentAvg).toBeLessThan(auditAvg * 2);
    });

    it('should measure security headers generation performance', async () => {
      const testIterations = 200;
      
      const headersTimes: number[] = [];
      const routes = [
        '/',
        '/dashboard',
        '/checkout',
        '/api/user/profile',
        '/api/payments/create'
      ];

      for (let i = 0; i < testIterations; i++) {
        const route = routes[i % routes.length];
        const request = createPerformanceRequest({
          method: 'GET',
          path: route,
          headers: { 'origin': 'https://example.com' }
        });

        const start = performance.now();
        await middleware(request);
        const end = performance.now();
        headersTimes.push(end - start);
      }

      const headersAvg = headersTimes.reduce((a, b) => a + b) / headersTimes.length;
      performanceMetrics.set('Security Headers', headersTimes);

      // Security header generation should be very fast (< 2ms average)
      expect(headersAvg).toBeLessThan(2);
    });
  });

  describe('Security Features Under High Load', () => {
    it('should maintain performance under concurrent CSRF validations', async () => {
      const concurrentRequests = 100;
      const csrfToken = generateServerCSRFToken();

      const concurrentPromises = Array.from({ length: concurrentRequests }, async (_, i) => {
        const request = createPerformanceRequest({
          method: 'POST',
          path: '/api/test',
          headers: {
            'x-csrf-token': csrfToken,
            'content-type': 'application/json',
            'origin': 'https://example.com'
          },
          cookies: {
            '__Secure-csrf-token': csrfToken
          },
          body: JSON.stringify({ test: `concurrent_${i}` })
        });

        const start = performance.now();
        const validation = validateCSRFProtection(request);
        const end = performance.now();
        
        return {
          isValid: validation.isValid,
          duration: end - start
        };
      });

      const results = await Promise.all(concurrentPromises);
      
      // All validations should succeed
      expect(results.every(r => r.isValid)).toBe(true);
      
      // Average time should be reasonable under load
      const avgTime = results.reduce((sum, r) => sum + r.duration, 0) / results.length;
      expect(avgTime).toBeLessThan(5);
      
      performanceMetrics.set('Concurrent CSRF', results.map(r => r.duration));
    });

    it('should handle rate limiting under high concurrent load', async () => {
      const concurrentRequests = 200;
      const baseIP = '192.168.100.';
      
      const concurrentPromises = Array.from({ length: concurrentRequests }, async (_, i) => {
        // Use different IPs to avoid rate limiting
        const ip = `${baseIP}${Math.floor(i / 10) + 10}`;
        const request = createPerformanceRequest({
          method: 'POST',
          path: '/api/auth/signin',
          ip,
          headers: {
            'content-type': 'application/json',
            'origin': 'https://example.com'
          }
        });

        const start = performance.now();
        const result = await checkAuthRateLimit(request);
        const end = performance.now();
        
        return {
          allowed: result.allowed,
          remaining: result.remaining,
          duration: end - start
        };
      });

      const results = await Promise.all(concurrentPromises);
      
      // Most requests should be allowed (different IPs)
      const allowedCount = results.filter(r => r.allowed).length;
      expect(allowedCount).toBeGreaterThan(concurrentRequests * 0.8);
      
      // Performance should remain good under load
      const avgTime = results.reduce((sum, r) => sum + r.duration, 0) / results.length;
      expect(avgTime).toBeLessThan(10);
      
      performanceMetrics.set('Concurrent Rate Limiting', results.map(r => r.duration));
    });

    it('should maintain audit logging performance under load', async () => {
      const concurrentAudits = 20; // Reasonable for database operations
      
      await auditService.setAuditContext({
        userId: 'load-test-user',
        userEmail: 'loadtest@example.com',
        ipAddress: '192.168.100.200'
      });

      const auditPromises = Array.from({ length: concurrentAudits }, async (_, i) => {
        const start = performance.now();
        
        await auditService.createAuditLog({
          tableName: 'load_test',
          recordId: `load-record-${i}`,
          action: 'CREATE',
          newValues: { 
            loadTest: true,
            iteration: i,
            timestamp: Date.now()
          },
          metadata: {
            performance_test: true,
            load_test: true,
            batch_operation: true
          }
        });
        
        const end = performance.now();
        return end - start;
      });

      const auditTimes = await Promise.all(auditPromises);
      const avgAuditTime = auditTimes.reduce((a, b) => a + b) / auditTimes.length;
      
      // Should handle concurrent audit operations reasonably
      expect(avgAuditTime).toBeLessThan(100); // 100ms average under load
      
      performanceMetrics.set('Concurrent Audit Logging', auditTimes);
      
      // Verify all audits were created
      const auditLogs = await auditService.queryAuditLogs({
        tableName: 'load_test',
        limit: concurrentAudits + 5
      });
      
      const loadTestLogs = auditLogs.filter(log => 
        log.metadata && typeof log.metadata === 'object' && 
        'load_test' in log.metadata
      );
      
      expect(loadTestLogs.length).toBe(concurrentAudits);
    });

    it('should handle mixed security operations under load', async () => {
      const mixedOperations = 50;
      const csrfToken = generateServerCSRFToken();
      const testIP = '192.168.100.201';
      
      const mixedPromises = Array.from({ length: mixedOperations }, async (_, i) => {
        const operationType = ['csrf', 'rateLimit', 'headers', 'audit'][i % 4];
        const start = performance.now();
        
        let result;
        switch (operationType) {
          case 'csrf':
            const csrfRequest = createPerformanceRequest({
              method: 'POST',
              path: '/api/user/update',
              headers: { 'x-csrf-token': csrfToken },
              cookies: { '__Secure-csrf-token': csrfToken }
            });
            result = validateCSRFProtection(csrfRequest);
            break;
            
          case 'rateLimit':
            const rateLimitRequest = createPerformanceRequest({
              method: 'POST',
              path: '/api/auth/signin',
              ip: `${testIP.slice(0, -1)}${(i % 10)}`
            });
            result = await checkAuthRateLimit(rateLimitRequest);
            break;
            
          case 'headers':
            const headerRequest = createPerformanceRequest({
              method: 'GET',
              path: '/dashboard'
            });
            result = await middleware(headerRequest);
            break;
            
          case 'audit':
            result = await auditService.createAuditLog({
              tableName: 'mixed_test',
              recordId: `mixed-${i}`,
              action: 'CREATE',
              metadata: { performance_test: true, mixed_operation: true }
            });
            break;
        }
        
        const end = performance.now();
        return {
          operation: operationType,
          duration: end - start,
          success: !!result
        };
      });

      const results = await Promise.all(mixedPromises);
      
      // Group by operation type
      const byOperation = results.reduce((acc, result) => {
        if (!acc[result.operation]) acc[result.operation] = [];
        acc[result.operation].push(result.duration);
        return acc;
      }, {} as Record<string, number[]>);

      // Each operation type should maintain good performance
      for (const [operation, times] of Object.entries(byOperation)) {
        const avgTime = times.reduce((a, b) => a + b) / times.length;
        const maxAllowedTime = {
          csrf: 5,
          rateLimit: 10,
          headers: 5,
          audit: 100
        }[operation] || 50;
        
        expect(avgTime).toBeLessThan(maxAllowedTime);
        performanceMetrics.set(`Mixed Load - ${operation}`, times);
      }
    });
  });

  describe('Memory Usage of Security Implementations', () => {
    it('should not cause memory leaks in rate limiting', async () => {
      const initialMemory = process.memoryUsage();
      const testIterations = 1000;
      
      // Generate many rate limit checks
      for (let i = 0; i < testIterations; i++) {
        const request = createPerformanceRequest({
          method: 'POST',
          path: '/api/test',
          ip: `192.168.${Math.floor(i / 255)}.${i % 255}`
        });
        
        await checkRateLimit(request, { max: 10, windowMs: 60000 }, 'ip');
        
        // Force garbage collection every 100 iterations
        if (i % 100 === 0 && global.gc) {
          global.gc();
        }
      }

      const finalMemory = process.memoryUsage();
      const memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed;
      const memoryIncreaseKB = memoryIncrease / 1024;
      
      // Memory increase should be reasonable (< 10MB for 1000 operations)
      expect(memoryIncreaseKB).toBeLessThan(10 * 1024);
    });

    it('should handle CSRF token generation without excessive memory usage', async () => {
      const initialMemory = process.memoryUsage();
      const tokenCount = 1000;
      
      const tokens: string[] = [];
      for (let i = 0; i < tokenCount; i++) {
        tokens.push(generateServerCSRFToken());
        
        if (i % 100 === 0 && global.gc) {
          global.gc();
        }
      }
      
      // Verify tokens are unique
      const uniqueTokens = new Set(tokens);
      expect(uniqueTokens.size).toBe(tokenCount);
      
      const finalMemory = process.memoryUsage();
      const memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed;
      const memoryPerToken = memoryIncrease / tokenCount;
      
      // Memory per token should be reasonable (< 1KB per token)
      expect(memoryPerToken).toBeLessThan(1024);
    });
  });

  describe('Security Feature Scalability Limits', () => {
    it('should handle extreme rate limiting scenarios', async () => {
      const extremeRequests = 1000;
      const sameIP = '192.168.100.250';
      
      // Test with very restrictive rate limit
      const restrictiveConfig: RateLimitConfig = {
        max: 5,
        windowMs: 60000
      };
      
      const extremePromises = Array.from({ length: extremeRequests }, async (_, i) => {
        const request = createPerformanceRequest({
          method: 'POST',
          path: '/api/test',
          ip: sameIP
        });
        
        const start = performance.now();
        const result = await checkRateLimit(request, restrictiveConfig, 'ip');
        const end = performance.now();
        
        return {
          allowed: result.allowed,
          remaining: result.remaining,
          duration: end - start
        };
      });

      const results = await Promise.all(extremePromises);
      
      // Only first 5 should be allowed
      const allowedCount = results.filter(r => r.allowed).length;
      expect(allowedCount).toBe(5);
      
      // Performance should remain consistent even for blocked requests
      const avgTime = results.reduce((sum, r) => sum + r.duration, 0) / results.length;
      expect(avgTime).toBeLessThan(15);
    });

    it('should handle large-scale security header generation', async () => {
      const largeScale = 500;
      const routes = [
        '/', '/dashboard', '/profile', '/admin', '/checkout',
        '/api/auth/signin', '/api/user/profile', '/api/payments/create',
        '/api/admin/users', '/api/subscriptions/create'
      ];
      
      const headerPromises = Array.from({ length: largeScale }, async (_, i) => {
        const route = routes[i % routes.length];
        const request = createPerformanceRequest({
          method: 'GET',
          path: route,
          headers: { 'origin': 'https://example.com' }
        });

        const start = performance.now();
        const response = await middleware(request);
        const end = performance.now();
        
        return {
          route,
          duration: end - start,
          hasCSP: !!response.headers.get('Content-Security-Policy'),
          hasHSTS: !!response.headers.get('Strict-Transport-Security'),
          hasFrameOptions: !!response.headers.get('X-Frame-Options')
        };
      });

      const results = await Promise.all(headerPromises);
      
      // All should have security headers
      expect(results.every(r => r.hasCSP && r.hasHSTS && r.hasFrameOptions)).toBe(true);
      
      // Performance should scale linearly
      const avgTime = results.reduce((sum, r) => sum + r.duration, 0) / results.length;
      expect(avgTime).toBeLessThan(3);
      
      performanceMetrics.set('Large Scale Headers', results.map(r => r.duration));
    });

    it('should validate performance under sustained load', async () => {
      const sustainedDuration = 5000; // 5 seconds
      const requestsPerSecond = 20;
      const totalRequests = (sustainedDuration / 1000) * requestsPerSecond;
      
      const startTime = Date.now();
      const sustainedResults: { duration: number; timestamp: number }[] = [];
      
      // Generate sustained load
      const sustainedPromises: Promise<void>[] = [];
      
      for (let i = 0; i < totalRequests; i++) {
        const promise = (async () => {
          // Space out requests over time
          await new Promise(resolve => setTimeout(resolve, (i / requestsPerSecond) * 1000));
          
          const request = createPerformanceRequest({
            method: 'GET',
            path: '/api/health',
            ip: `192.168.100.${(i % 50) + 10}`
          });

          const requestStart = performance.now();
          await middleware(request);
          const requestEnd = performance.now();
          
          sustainedResults.push({
            duration: requestEnd - requestStart,
            timestamp: Date.now() - startTime
          });
        })();
        
        sustainedPromises.push(promise);
      }

      await Promise.all(sustainedPromises);
      
      // Analyze performance over time
      const timeWindows = [1000, 2000, 3000, 4000, 5000]; // 1s windows
      const windowStats = timeWindows.map(windowEnd => {
        const windowResults = sustainedResults.filter(r => 
          r.timestamp <= windowEnd && r.timestamp > windowEnd - 1000
        );
        
        if (windowResults.length === 0) return null;
        
        const avgDuration = windowResults.reduce((sum, r) => sum + r.duration, 0) / windowResults.length;
        return {
          window: windowEnd / 1000,
          avgDuration,
          requestCount: windowResults.length
        };
      }).filter(Boolean) as Array<{ window: number; avgDuration: number; requestCount: number }>;

      // Performance should remain consistent over time
      const avgDurations = windowStats.map(w => w!.avgDuration);
      const minAvg = Math.min(...avgDurations);
      const maxAvg = Math.max(...avgDurations);
      const performanceVariation = maxAvg - minAvg;
      
      // Performance variation should be minimal (< 2ms difference)
      expect(performanceVariation).toBeLessThan(2);
      
      // All windows should maintain good performance
      avgDurations.forEach(avg => {
        expect(avg).toBeLessThan(5);
      });
    });
  });

  // Helper function to create performance test requests
  function createPerformanceRequest(options: {
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
      ip = '192.168.100.10',
      userAgent = 'Performance Test Agent',
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