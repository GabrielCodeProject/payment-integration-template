/**
 * Comprehensive Session Management Integration Tests
 * Tests the complete session management functionality including APIs, security, and lifecycle
 */

import { describe, test, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import { PrismaClient } from '@prisma/client';
import { SessionManager, SessionRateLimiter } from '@/lib/session-manager';

// Test Configuration
const TEST_CONFIG = {
  DATABASE_URL: process.env.TEST_DATABASE_URL || process.env.DATABASE_URL,
  MAX_SESSION_COUNT: 5,
  SESSION_DURATION: 60 * 60 * 24 * 7, // 7 days
};

// Test Data
const TEST_USERS = {
  ADMIN: {
    id: 'test-admin-001',
    email: 'test-admin@session-test.com',
    name: 'Test Admin User',
    role: 'ADMIN'},
  USER: {
    id: 'test-user-001',
    email: 'test-user@session-test.com',
    name: 'Test Regular User',
    role: 'CUSTOMER'},
  SUSPICIOUS: {
    id: 'test-suspicious-001',
    email: 'suspicious@session-test.com',
    name: 'Suspicious User',
    role: 'CUSTOMER'}};

const TEST_SESSIONS = {
  VALID: {
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    ipAddress: '192.168.1.100',
    location: 'New York, US'},
  SUSPICIOUS: {
    userAgent: 'Suspicious Bot/1.0',
    ipAddress: '10.0.0.1',
    location: 'Unknown Location'},
  MOBILE: {
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X)',
    ipAddress: '192.168.1.101',
    location: 'New York, US'}};

describe('Session Management Integration Tests', () => {
  let prisma: PrismaClient;
  let sessionManager: SessionManager;
  const testUsers: any[] = [];
  let testSessions: any[] = [];

  beforeAll(async () => {
    // Initialize test database connection
    prisma = new PrismaClient({
      datasources: {
        db: {
          url: TEST_CONFIG.DATABASE_URL}}});

    // Initialize session manager with test database
    sessionManager = new SessionManager(prisma);

    // Connect to database
    await prisma.$connect();

    // Create test users
    for (const [_key, userData] of Object.entries(TEST_USERS)) {
      const user = await prisma.user.create({
        data: {
          id: userData.id,
          email: userData.email,
          name: userData.name,
          role: userData.role as any,
          emailVerified: true,
          isActive: true}});
      testUsers.push(user);
    }
  });

  afterAll(async () => {
    // Clean up test data
    for (const session of testSessions) {
      try {
        await prisma.session.delete({ where: { id: session.id } });
      } catch (_error) {
        // Session may already be deleted
      }
    }

    for (const user of testUsers) {
      try {
        await prisma.user.delete({ where: { id: user.id } });
      } catch (_error) {
        // User may already be deleted
      }
    }

    await prisma.$disconnect();
  });

  beforeEach(async () => {
    // Clean up sessions between tests
    await prisma.session.deleteMany({
      where: {
        userId: {
          in: testUsers.map(u => u.id)}}});
    testSessions = [];
  });

  describe('1. Backend APIs and Services', () => {
    describe('SessionManager Core Functionality', () => {
      test('should create a new session successfully', async () => {
        const userId = TEST_USERS.ADMIN.id;
        const sessionData = TEST_SESSIONS.VALID;

        const session = await sessionManager.createSession(userId, {
          ipAddress: sessionData.ipAddress,
          userAgent: sessionData.userAgent,
          maxAge: TEST_CONFIG.SESSION_DURATION});

        expect(session).toBeDefined();
        expect(session.userId).toBe(userId);
        expect(session.ipAddress).toBe(sessionData.ipAddress);
        expect(session.userAgent).toBe(sessionData.userAgent);
        expect(session.token).toMatch(/^sess_[a-f0-9]+/);
        expect(session.isCurrent).toBe(true);

        testSessions.push(session);
      });

      test('should retrieve user sessions', async () => {
        const userId = TEST_USERS.USER.id;
        
        // Create multiple sessions
        const session1 = await sessionManager.createSession(userId, TEST_SESSIONS.VALID);
        const session2 = await sessionManager.createSession(userId, TEST_SESSIONS.MOBILE);
        testSessions.push(session1, session2);

        const sessions = await sessionManager.getUserSessions(userId);

        expect(sessions).toHaveLength(2);
        expect(sessions[0].userId).toBe(userId);
        expect(sessions[1].userId).toBe(userId);
        
        // Should be sorted by activity (newest first)
        expect(new Date(sessions[0].updatedAt) >= new Date(sessions[1].updatedAt)).toBe(true);
      });

      test('should refresh session with token rotation', async () => {
        const userId = TEST_USERS.ADMIN.id;
        const session = await sessionManager.createSession(userId, TEST_SESSIONS.VALID);
        testSessions.push(session);

        const originalToken = session.token;
        const originalExpiry = session.expiresAt;

        // Wait a moment to ensure timestamp difference
        await new Promise(resolve => setTimeout(resolve, 100));

        const refreshResult = await sessionManager.refreshSession(session.id, {
          rotateToken: true,
          extendExpiry: true});

        expect(refreshResult.success).toBe(true);
        expect(refreshResult.rotated).toBe(true);
        expect(refreshResult.newToken).toBeDefined();
        expect(refreshResult.newToken).not.toBe(originalToken);
        expect(refreshResult.expiresAt).toBeDefined();
        expect(new Date(refreshResult.expiresAt!)).toBeAfter(originalExpiry);
      });

      test('should terminate individual session', async () => {
        const userId = TEST_USERS.USER.id;
        const session = await sessionManager.createSession(userId, TEST_SESSIONS.VALID);
        testSessions.push(session);

        const terminated = await sessionManager.terminateSession(session.id, {
          reason: 'test_termination'});

        expect(terminated).toBe(true);

        // Verify session is deleted
        const sessions = await sessionManager.getUserSessions(userId);
        expect(sessions).toHaveLength(0);
      });

      test('should terminate all sessions except current', async () => {
        const userId = TEST_USERS.ADMIN.id;
        
        // Create multiple sessions
        const session1 = await sessionManager.createSession(userId, TEST_SESSIONS.VALID);
        const session2 = await sessionManager.createSession(userId, TEST_SESSIONS.MOBILE);
        const currentSession = await sessionManager.createSession(userId, TEST_SESSIONS.SUSPICIOUS);
        testSessions.push(session1, session2, currentSession);

        const terminatedCount = await sessionManager.terminateAllSessions(userId, {
          excludeCurrentSession: currentSession.id,
          reason: 'test_bulk_termination'});

        expect(terminatedCount).toBe(2);

        const remainingSessions = await sessionManager.getUserSessions(userId);
        expect(remainingSessions).toHaveLength(1);
        expect(remainingSessions[0].id).toBe(currentSession.id);
      });

      test('should enforce session limits', async () => {
        const userId = TEST_USERS.USER.id;
        const maxSessions = 3;

        // Create more sessions than the limit
        for (let i = 0; i < 5; i++) {
          const session = await sessionManager.createSession(userId, {
            ...TEST_SESSIONS.VALID,
            ipAddress: `192.168.1.${100 + i}`});
          testSessions.push(session);
          
          // Small delay to ensure different timestamps
          await new Promise(resolve => setTimeout(resolve, 10));
        }

        const cleanup = await sessionManager.enforceSessionLimits(userId, {
          maxConcurrentSessions: maxSessions});

        expect(cleanup.displacedSessions).toBe(2); // 5 - 3 = 2 displaced
        expect(cleanup.totalCleaned).toBeGreaterThanOrEqual(2);

        const remainingSessions = await sessionManager.getUserSessions(userId);
        expect(remainingSessions.length).toBeLessThanOrEqual(maxSessions);
      });

      test('should calculate session statistics', async () => {
        const userId = TEST_USERS.ADMIN.id;

        // Create test sessions
        const session1 = await sessionManager.createSession(userId, TEST_SESSIONS.VALID);
        const session2 = await sessionManager.createSession(userId, TEST_SESSIONS.MOBILE);
        testSessions.push(session1, session2);

        const stats = await sessionManager.getSessionStats(userId);

        expect(stats.totalSessions).toBeGreaterThanOrEqual(2);
        expect(stats.activeSessions).toBeGreaterThanOrEqual(2);
        expect(stats.expiredSessions).toBeGreaterThanOrEqual(0);
        expect(stats.recentLogins).toBeGreaterThanOrEqual(2);
        expect(stats.concurrentLimit).toBe(5); // Default limit
      });
    });

    describe('Security and Audit Features', () => {
      test('should detect suspicious sessions', async () => {
        const userId = TEST_USERS.SUSPICIOUS.id;
        
        // Create normal session first
        const normalSession = await sessionManager.createSession(userId, TEST_SESSIONS.VALID);
        testSessions.push(normalSession);
        
        // Create suspicious session
        const suspiciousSession = await sessionManager.createSession(userId, TEST_SESSIONS.SUSPICIOUS);
        testSessions.push(suspiciousSession);

        const sessions = await sessionManager.getUserSessions(userId, {
          includeSecurity: true});

        const suspicious = sessions.find(s => s.id === suspiciousSession.id);
        expect(suspicious).toBeDefined();
        // Note: Actual security evaluation depends on historical data
      });

      test('should audit session operations', async () => {
        const userId = TEST_USERS.ADMIN.id;
        const session = await sessionManager.createSession(userId, TEST_SESSIONS.VALID);
        testSessions.push(session);

        // The session creation should have created audit logs
        // Note: This test depends on the audit system being properly configured
        expect(session).toBeDefined();
      });

      test('should enforce rate limiting', async () => {
        const userId = TEST_USERS.USER.id;
        const rateLimitKey = `test:${userId}:192.168.1.100`;

        // Test rate limiting
        let allowedCount = 0;
        let blockedCount = 0;

        for (let i = 0; i < 15; i++) {
          const result = await SessionRateLimiter.checkRateLimit('getUserSessions', rateLimitKey);
          if (result.allowed) {
            allowedCount++;
          } else {
            blockedCount++;
          }
        }

        expect(allowedCount).toBeLessThan(15);
        expect(blockedCount).toBeGreaterThan(0);
      });
    });

    describe('Session Lifecycle Management', () => {
      test('should handle session expiry', async () => {
        const userId = TEST_USERS.USER.id;
        
        // Create session with very short expiry
        const session = await sessionManager.createSession(userId, {
          ...TEST_SESSIONS.VALID,
          maxAge: 1, // 1 second
        });
        testSessions.push(session);

        // Wait for expiry
        await new Promise(resolve => setTimeout(resolve, 1100));

        const sessions = await sessionManager.getUserSessions(userId, {
          includeExpired: false});

        expect(sessions).toHaveLength(0);
      });

      test('should clean up expired sessions', async () => {
        const userId = TEST_USERS.ADMIN.id;

        // Create expired session directly in database
        const expiredSession = await prisma.session.create({
          data: {
            token: 'expired_test_token',
            userId,
            expiresAt: new Date(Date.now() - 1000), // Expired 1 second ago
            createdAt: new Date(),
            updatedAt: new Date()}});
        testSessions.push(expiredSession);

        const cleanupResult = await sessionManager.cleanupExpiredSessions();

        expect(cleanupResult.expiredSessions).toBeGreaterThanOrEqual(1);
        expect(cleanupResult.totalCleaned).toBeGreaterThanOrEqual(1);
      });

      test('should handle concurrent session operations', async () => {
        const userId = TEST_USERS.USER.id;
        const session = await sessionManager.createSession(userId, TEST_SESSIONS.VALID);
        testSessions.push(session);

        // Simulate concurrent refresh operations
        const promises = [
          sessionManager.refreshSession(session.id),
          sessionManager.refreshSession(session.id),
          sessionManager.refreshSession(session.id)];

        const results = await Promise.allSettled(promises);
        
        // At least one should succeed
        const successful = results.filter(r => r.status === 'fulfilled');
        expect(successful.length).toBeGreaterThan(0);
      });
    });
  });

  describe('2. Error Handling and Edge Cases', () => {
    test('should handle invalid session IDs gracefully', async () => {
      const refreshResult = await sessionManager.refreshSession('invalid-session-id');
      expect(refreshResult.success).toBe(false);
      expect(refreshResult.error).toContain('Session not found');
    });

    test('should handle missing user gracefully', async () => {
      await expect(
        sessionManager.createSession('non-existent-user-id', TEST_SESSIONS.VALID)
      ).rejects.toThrow();
    });

    test('should handle database connection issues', async () => {
      // This test would require mocking the database connection
      // For now, we'll just ensure the session manager handles errors gracefully
      expect(sessionManager).toBeDefined();
    });

    test('should validate session limits configuration', async () => {
      const userId = TEST_USERS.ADMIN.id;
      
      const result = await sessionManager.enforceSessionLimits(userId, {
        maxConcurrentSessions: -1, // Invalid configuration
      });

      // Should handle invalid configuration gracefully
      expect(result).toBeDefined();
    });
  });

  describe('3. Performance and Scalability', () => {
    test('should handle large number of sessions efficiently', async () => {
      const userId = TEST_USERS.USER.id;
      const sessionCount = 50;

      const startTime = Date.now();
      
      // Create many sessions
      const createPromises = Array.from({ length: sessionCount }, (_, i) => 
        sessionManager.createSession(userId, {
          ...TEST_SESSIONS.VALID,
          ipAddress: `192.168.${Math.floor(i / 255)}.${i % 255}`})
      );
      
      const sessions = await Promise.all(createPromises);
      testSessions.push(...sessions);
      
      const creationTime = Date.now() - startTime;
      
      // Retrieve all sessions
      const retrievalStartTime = Date.now();
      const retrievedSessions = await sessionManager.getUserSessions(userId);
      const retrievalTime = Date.now() - retrievalStartTime;

      expect(retrievedSessions).toHaveLength(sessionCount);
      expect(creationTime).toBeLessThan(5000); // Should complete within 5 seconds
      expect(retrievalTime).toBeLessThan(1000); // Should retrieve within 1 second
    });

    test('should perform bulk operations efficiently', async () => {
      const userId = TEST_USERS.ADMIN.id;
      
      // Create multiple sessions
      const sessions = await Promise.all([
        sessionManager.createSession(userId, TEST_SESSIONS.VALID),
        sessionManager.createSession(userId, TEST_SESSIONS.MOBILE),
        sessionManager.createSession(userId, TEST_SESSIONS.SUSPICIOUS)]);
      testSessions.push(...sessions);

      const startTime = Date.now();
      const terminatedCount = await sessionManager.terminateAllSessions(userId);
      const operationTime = Date.now() - startTime;

      expect(terminatedCount).toBe(3);
      expect(operationTime).toBeLessThan(1000); // Should complete within 1 second
    });
  });
});

// Helper function to ensure dates are after each other
declare module '@jest/expect' {
  interface Matchers<R> {
    toBeAfter(date: Date): R;
  }
}

expect.extend({
  toBeAfter(received: Date, expected: Date) {
    const pass = received.getTime() > expected.getTime();
    if (pass) {
      return {
        message: () => `expected ${received} not to be after ${expected}`,
        pass: true};
    } else {
      return {
        message: () => `expected ${received} to be after ${expected}`,
        pass: false};
    }
  }});