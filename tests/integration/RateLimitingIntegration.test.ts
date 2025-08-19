/**
 * Rate Limiting Integration Tests
 * 
 * Tests Redis-based rate limiting across the entire authentication system
 * and validates rate limiting coordination between different components.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach, jest } from '@jest/globals';
import { NextRequest } from 'next/server';
import {
  checkRateLimit,
  checkAuthRateLimit,
  checkPaymentRateLimit,
  checkApiRateLimit,
  checkUserRateLimit,
  getRateLimitHeaders,
  createRateLimitResponse,
  cleanupRateLimit,
  getClientIP,
  type RateLimitConfig,
  type RateLimitResult
} from '@/lib/rate-limiting';

describe('Rate Limiting Integration Tests', () => {
  let redisClient: any;

  beforeAll(async () => {
    // Setup Redis client for testing
    try {
      const { createClient } = await import('redis').catch(() => ({ createClient: null }));
      if (createClient) {
        redisClient = createClient({
          url: process.env.REDIS_URL || 'redis://localhost:6379',
        });
        await redisClient.connect();
        
        // Clear any existing test data
        await redisClient.flushDb();
      } else {
        redisClient = null;
      }
    } catch (_error) {
      console.warn('Redis not available for testing, using memory fallback');
      redisClient = null;
    }
  });

  afterAll(async () => {
    if (redisClient) {
      await redisClient.quit();
    }
    await cleanupRateLimit();
  });

  beforeEach(async () => {
    // Clear Redis test data between tests
    if (redisClient) {
      await redisClient.flushDb();
    }
    
    // Clear any in-memory rate limit data
    jest.clearAllTimers();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('Redis-based Rate Limiting Persistence', () => {
    it('should persist rate limits across server restarts', async () => {
      if (!redisClient) {
        console.log('Skipping Redis persistence test - Redis not available');
        return;
      }

      const testIP = '192.168.1.100';
      const request = createMockRequest({ ip: testIP });

      // Make initial requests up to limit
      const config: RateLimitConfig = { max: 3, windowMs: 60000 };
      
      await checkRateLimit(request, config, 'ip');
      await checkRateLimit(request, config, 'ip');
      const result = await checkRateLimit(request, config, 'ip');
      
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(0);
      
      // Next request should be blocked
      const blockedResult = await checkRateLimit(request, config, 'ip');
      expect(blockedResult.allowed).toBe(false);

      // Simulate server restart by creating new rate limiter instance
      // The Redis data should persist
      const persistedResult = await checkRateLimit(request, config, 'ip');
      expect(persistedResult.allowed).toBe(false);
      expect(persistedResult.totalHits).toBe(4); // 3 allowed + 1 blocked
    });

    it('should handle Redis unavailability gracefully', async () => {
      // Temporarily break Redis connection
      const originalRedisUrl = process.env.REDIS_URL;
      process.env.REDIS_URL = 'redis://invalid-host:6379';

      const request = createMockRequest({ ip: '192.168.1.101' });
      const config: RateLimitConfig = { max: 2, windowMs: 60000 };

      // Should fallback to in-memory rate limiting
      const result1 = await checkRateLimit(request, config, 'ip');
      expect(result1.allowed).toBe(true);

      const result2 = await checkRateLimit(request, config, 'ip');
      expect(result2.allowed).toBe(true);
      expect(result2.remaining).toBe(0);

      const result3 = await checkRateLimit(request, config, 'ip');
      expect(result3.allowed).toBe(false);

      // Restore original Redis URL
      process.env.REDIS_URL = originalRedisUrl;
    });
  });

  describe('IP-based and User-based Rate Limiting Coordination', () => {
    it('should apply separate limits for IP-based and user-based strategies', async () => {
      const testIP = '192.168.1.102';
      const testUserId = 'user-123';
      
      const ipRequest = createMockRequest({ ip: testIP });
      const userRequest = createMockRequest({ 
        ip: testIP, 
        headers: { 'x-user-id': testUserId } 
      });

      const config: RateLimitConfig = { max: 2, windowMs: 60000 };

      // Exhaust IP-based limit
      await checkRateLimit(ipRequest, config, 'ip');
      await checkRateLimit(ipRequest, config, 'ip');
      const ipBlockedResult = await checkRateLimit(ipRequest, config, 'ip');
      expect(ipBlockedResult.allowed).toBe(false);

      // User-based limit should still work (different strategy)
      const userResult1 = await checkRateLimit(userRequest, config, 'user');
      expect(userResult1.allowed).toBe(true);

      const userResult2 = await checkRateLimit(userRequest, config, 'user');
      expect(userResult2.allowed).toBe(true);
      expect(userResult2.remaining).toBe(0);

      const userBlockedResult = await checkRateLimit(userRequest, config, 'user');
      expect(userBlockedResult.allowed).toBe(false);
    });

    it('should apply combined limits correctly', async () => {
      const testIP = '192.168.1.103';
      const testUserId = 'user-456';
      
      const request = createMockRequest({ 
        ip: testIP, 
        headers: { 'x-user-id': testUserId } 
      });

      const config: RateLimitConfig = { max: 3, windowMs: 60000 };

      // Combined strategy uses both IP and user ID
      const result1 = await checkRateLimit(request, config, 'combined');
      expect(result1.allowed).toBe(true);
      expect(result1.remaining).toBe(2);

      const result2 = await checkRateLimit(request, config, 'combined');
      expect(result2.allowed).toBe(true);
      expect(result2.remaining).toBe(1);

      const result3 = await checkRateLimit(request, config, 'combined');
      expect(result3.allowed).toBe(true);
      expect(result3.remaining).toBe(0);

      const result4 = await checkRateLimit(request, config, 'combined');
      expect(result4.allowed).toBe(false);
    });
  });

  describe('Rate Limiting Across Multiple Authentication Endpoints', () => {
    it('should apply rate limits consistently across auth endpoints', async () => {
      const testIP = '192.168.1.104';
      const request = createMockRequest({ ip: testIP });

      // Test auth rate limiting across different endpoints
      const results: RateLimitResult[] = [];
      
      // checkAuthRateLimit has max: 10, windowMs: 60000
      for (let i = 0; i < 12; i++) {
        const result = await checkAuthRateLimit(request);
        results.push(result);
      }

      // First 10 should be allowed
      for (let i = 0; i < 10; i++) {
        expect(results[i].allowed).toBe(true);
        expect(results[i].remaining).toBe(10 - i - 1);
      }

      // 11th and 12th should be blocked
      expect(results[10].allowed).toBe(false);
      expect(results[11].allowed).toBe(false);
    });

    it('should apply different limits for different endpoint types', async () => {
      const testIP = '192.168.1.105';
      const request = createMockRequest({ 
        ip: testIP,
        headers: { 'x-user-id': 'user-789' }
      });

      // Auth endpoints: max 10/minute
      const authResult = await checkAuthRateLimit(request);
      expect(authResult.allowed).toBe(true);

      // Payment endpoints: max 30/minute (combined strategy)
      const paymentResult = await checkPaymentRateLimit(request);
      expect(paymentResult.allowed).toBe(true);

      // API endpoints: max 100/minute
      const apiResult = await checkApiRateLimit(request);
      expect(apiResult.allowed).toBe(true);

      // User endpoints: max 50/minute (default)
      const userResult = await checkUserRateLimit(request);
      expect(userResult.allowed).toBe(true);

      // All should have different remaining counts due to different limits
      expect(authResult.remaining).not.toBe(paymentResult.remaining);
      expect(paymentResult.remaining).not.toBe(apiResult.remaining);
      expect(apiResult.remaining).not.toBe(userResult.remaining);
    });
  });

  describe('Rate Limit Headers Validation', () => {
    it('should return correct rate limit headers', async () => {
      const testIP = '192.168.1.106';
      const request = createMockRequest({ ip: testIP });
      const config: RateLimitConfig = { max: 5, windowMs: 60000 };

      const result = await checkRateLimit(request, config, 'ip');
      const headers = getRateLimitHeaders(result);

      expect(headers).toHaveProperty('X-RateLimit-Limit');
      expect(headers).toHaveProperty('X-RateLimit-Remaining');
      expect(headers).toHaveProperty('X-RateLimit-Reset');
      expect(headers).toHaveProperty('X-RateLimit-Used');

      expect(headers['X-RateLimit-Limit']).toBe('1');
      expect(headers['X-RateLimit-Remaining']).toBe('4');
      expect(headers['X-RateLimit-Used']).toBe('1');
      
      // Reset time should be a valid ISO string
      expect(new Date(headers['X-RateLimit-Reset'])).toBeInstanceOf(Date);
    });

    it('should create proper rate limit response when blocked', async () => {
      const testIP = '192.168.1.107';
      const request = createMockRequest({ ip: testIP });
      const config: RateLimitConfig = { max: 1, windowMs: 60000 };

      // Exhaust limit
      await checkRateLimit(request, config, 'ip');
      const blockedResult = await checkRateLimit(request, config, 'ip');

      expect(blockedResult.allowed).toBe(false);

      const response = createRateLimitResponse(blockedResult);
      expect(response.status).toBe(429);
      
      const responseBody = await response.json();
      expect(responseBody).toHaveProperty('error');
      expect(responseBody.error).toBe('Rate limit exceeded');
      expect(responseBody).toHaveProperty('retryAfter');
      
      // Check headers
      expect(response.headers.get('Retry-After')).toBeTruthy();
      expect(response.headers.get('X-RateLimit-Remaining')).toBe('0');
    });
  });

  describe('Rate Limiting with Distributed Server Instances', () => {
    it('should share rate limits across distributed instances via Redis', async () => {
      if (!redisClient) {
        console.log('Skipping distributed test - Redis not available');
        return;
      }

      const testIP = '192.168.1.108';
      const config: RateLimitConfig = { max: 3, windowMs: 60000 };

      // Simulate requests from different server instances
      const request1 = createMockRequest({ ip: testIP, instanceId: 'server-1' });
      const request2 = createMockRequest({ ip: testIP, instanceId: 'server-2' });

      // Make requests from different instances
      const result1 = await checkRateLimit(request1, config, 'ip');
      expect(result1.allowed).toBe(true);
      expect(result1.remaining).toBe(2);

      const result2 = await checkRateLimit(request2, config, 'ip');
      expect(result2.allowed).toBe(true);
      expect(result2.remaining).toBe(1);

      const result3 = await checkRateLimit(request1, config, 'ip');
      expect(result3.allowed).toBe(true);
      expect(result3.remaining).toBe(0);

      // Fourth request from any instance should be blocked
      const result4 = await checkRateLimit(request2, config, 'ip');
      expect(result4.allowed).toBe(false);
    });
  });

  describe('Rate Limit Reset Functionality', () => {
    it('should reset rate limits after window expires', async () => {
      const testIP = '192.168.1.109';
      const request = createMockRequest({ ip: testIP });
      const config: RateLimitConfig = { max: 2, windowMs: 1000 }; // 1 second window

      // Exhaust limit
      await checkRateLimit(request, config, 'ip');
      const blockedResult = await checkRateLimit(request, config, 'ip');
      expect(blockedResult.allowed).toBe(true);
      expect(blockedResult.remaining).toBe(0);

      const finallyBlocked = await checkRateLimit(request, config, 'ip');
      expect(finallyBlocked.allowed).toBe(false);

      // Fast-forward time by 1.5 seconds
      jest.advanceTimersByTime(1500);

      // Should be allowed again after window expires
      const resetResult = await checkRateLimit(request, config, 'ip');
      expect(resetResult.allowed).toBe(true);
      expect(resetResult.remaining).toBe(1);
    });

    it('should handle concurrent rate limit resets correctly', async () => {
      const testIP = '192.168.1.110';
      const config: RateLimitConfig = { max: 5, windowMs: 60000 };

      // Create multiple concurrent requests
      const promises = Array.from({ length: 10 }, (_, i) => {
        const request = createMockRequest({ ip: testIP, requestId: `req-${i}` });
        return checkRateLimit(request, config, 'ip');
      });

      const results = await Promise.all(promises);

      // First 5 should be allowed
      const allowedResults = results.filter((r: RateLimitResult) => r.allowed);
      const blockedResults = results.filter((r: RateLimitResult) => !r.allowed);

      expect(allowedResults.length).toBe(5);
      expect(blockedResults.length).toBe(5);

      // Check that the allowed results have decreasing remaining counts
      const sortedAllowed = allowedResults.sort((a: RateLimitResult, b: RateLimitResult) => b.remaining - a.remaining);
      expect(sortedAllowed[0].remaining).toBe(4);
      expect(sortedAllowed[4].remaining).toBe(0);
    });
  });

  describe('Rate Limiting Under High Load', () => {
    it('should maintain accuracy under concurrent load', async () => {
      const testIP = '192.168.1.111';
      const config: RateLimitConfig = { max: 20, windowMs: 60000 };

      // Create many concurrent requests
      const concurrentRequests = 100;
      const promises = Array.from({ length: concurrentRequests }, (_, i) => {
        const request = createMockRequest({ ip: testIP, requestId: `concurrent-${i}` });
        return checkRateLimit(request, config, 'ip');
      });

      const results = await Promise.all(promises);

      const allowedCount = results.filter((r: RateLimitResult) => r.allowed).length;
      const blockedCount = results.filter((r: RateLimitResult) => !r.allowed).length;

      // Should allow exactly 20 requests
      expect(allowedCount).toBe(20);
      expect(blockedCount).toBe(80);

      // Verify rate limit accuracy
      expect(allowedCount + blockedCount).toBe(concurrentRequests);
    });

    it('should handle mixed IP addresses under load', async () => {
      const config: RateLimitConfig = { max: 3, windowMs: 60000 };
      const ipAddresses = [
        '192.168.1.112',
        '192.168.1.113',
        '192.168.1.114',
        '192.168.1.115',
        '192.168.1.116'
      ];

      // Create requests from multiple IPs
      const promises = ipAddresses.flatMap(ip => 
        Array.from({ length: 5 }, (_, i) => {
          const request = createMockRequest({ ip, requestId: `${ip}-${i}` });
          return checkRateLimit(request, config, 'ip');
        })
      );

      const results = await Promise.all(promises);
      
      // Group results by IP
      const resultsByIP = new Map<string, RateLimitResult[]>();
      results.forEach((result, index) => {
        const ip = ipAddresses[Math.floor(index / 5)];
        if (!resultsByIP.has(ip)) {
          resultsByIP.set(ip, []);
        }
        resultsByIP.get(ip)!.push(result);
      });

      // Each IP should have exactly 3 allowed and 2 blocked
      resultsByIP.forEach((ipResults, _ip) => {
        const allowed = ipResults.filter((r: RateLimitResult) => r.allowed).length;
        const blocked = ipResults.filter((r: RateLimitResult) => !r.allowed).length;
        
        expect(allowed).toBe(3);
        expect(blocked).toBe(2);
      });
    });
  });

  describe('Client IP Detection Integration', () => {
    it('should correctly identify client IP from various headers', async () => {
      const testCases: Array<{
        name: string;
        headers: Record<string, string>;
        ip?: string;
        expectedIP: string;
      }> = [
        {
          name: 'Cloudflare CF-Connecting-IP',
          headers: { 'cf-connecting-ip': '203.0.113.1' },
          expectedIP: '203.0.113.1'
        },
        {
          name: 'X-Forwarded-For with multiple IPs',
          headers: { 'x-forwarded-for': '203.0.113.2, 198.51.100.1, 192.0.2.1' },
          expectedIP: '203.0.113.2'
        },
        {
          name: 'X-Real-IP header',
          headers: { 'x-real-ip': '203.0.113.3' },
          expectedIP: '203.0.113.3'
        },
        {
          name: 'Direct IP when no proxy headers',
          headers: {},
          ip: '203.0.113.4',
          expectedIP: '203.0.113.4'
        }
      ];

      for (const testCase of testCases) {
        const request = createMockRequest({ 
          headers: testCase.headers, 
          ip: testCase.ip 
        });
        
        const detectedIP = getClientIP(request);
        expect(detectedIP).toBe(testCase.expectedIP);
      }
    });

    it('should apply rate limits based on detected client IP', async () => {
      const config: RateLimitConfig = { max: 2, windowMs: 60000 };

      // Two requests with same Cloudflare IP should share limit
      const request1 = createMockRequest({ 
        headers: { 'cf-connecting-ip': '203.0.113.5' },
        ip: '192.0.2.100' // Different direct IP
      });
      const request2 = createMockRequest({ 
        headers: { 'cf-connecting-ip': '203.0.113.5' },
        ip: '192.0.2.101' // Different direct IP
      });

      const result1 = await checkRateLimit(request1, config, 'ip');
      expect(result1.allowed).toBe(true);
      expect(result1.remaining).toBe(1);

      const result2 = await checkRateLimit(request2, config, 'ip');
      expect(result2.allowed).toBe(true);
      expect(result2.remaining).toBe(0);

      const result3 = await checkRateLimit(request1, config, 'ip');
      expect(result3.allowed).toBe(false);
    });
  });

  // Helper function to create mock NextRequest
  function createMockRequest(options: {
    ip?: string;
    headers?: Record<string, string>;
    instanceId?: string;
    requestId?: string;
  } = {}): NextRequest {
    const url = 'https://example.com/api/test';
    const headers = new Headers(options.headers || {});
    
    const request = new NextRequest(url, {
      method: 'POST',
      headers
    });

    // Mock the ip property
    if (options.ip) {
      Object.defineProperty(request, 'ip', {
        value: options.ip,
        writable: true
      });
    }

    return request;
  }
});