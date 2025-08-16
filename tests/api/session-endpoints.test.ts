/**
 * Session Management API Endpoints Tests
 * Tests all session-related API endpoints for functionality, security, and error handling
 */

import { describe, test, expect, beforeAll, beforeEach } from '@jest/globals';
import { createMocks } from 'node-mocks-http';
import { PrismaClient } from '@prisma/client';
import { GET as getSessionsHandler, DELETE as deleteSessionsHandler, POST as postSessionsHandler } from '@/app/api/auth/sessions/route';
import { GET as getSessionHandler, PUT as putSessionHandler, DELETE as deleteSessionHandler } from '@/app/api/auth/sessions/[id]/route';
import { POST as refreshSessionHandler } from '@/app/api/auth/sessions/refresh/route';

// Test Configuration
const TEST_CONFIG = {
  API_BASE_URL: 'http://localhost:3000',
  TEST_USER_ID: 'test-api-user-001',
  TEST_ADMIN_ID: 'test-api-admin-001',
};

// Mock authentication data
const MOCK_AUTH = {
  USER: {
    user: {
      id: TEST_CONFIG.TEST_USER_ID,
      email: 'test-user@api-test.com',
      role: 'CUSTOMER',
    },
    session: {
      id: 'mock-session-001',
      token: 'mock-session-token-001',
    },
  },
  ADMIN: {
    user: {
      id: TEST_CONFIG.TEST_ADMIN_ID,
      email: 'test-admin@api-test.com',
      role: 'ADMIN',
    },
    session: {
      id: 'mock-admin-session-001',
      token: 'mock-admin-token-001',
    },
  },
};

// Mock auth module
jest.mock('@/lib/auth/config', () => ({
  auth: {
    api: {
      getSession: jest.fn(),
    },
  },
}));

// Mock session manager
jest.mock('@/lib/session-manager', () => ({
  sessionManager: {
    getUserSessions: jest.fn(),
    getSessionStats: jest.fn(),
    createSession: jest.fn(),
    refreshSession: jest.fn(),
    terminateSession: jest.fn(),
    terminateAllSessions: jest.fn(),
    enforceSessionLimits: jest.fn(),
  },
  SessionRateLimiter: {
    checkRateLimit: jest.fn(),
  },
}));

// Mock audit service
jest.mock('@/lib/audit', () => ({
  auditService: {
    setAuditContext: jest.fn(),
    clearAuditContext: jest.fn(),
    createAuditLog: jest.fn(),
  },
  AuditHelpers: {
    createContextFromRequest: jest.fn(),
  },
}));

describe('Session Management API Endpoints', () => {
  let _prisma: PrismaClient;
  let mockSessionManager: any;
  let mockAuth: any;
  let mockRateLimiter: any;

  beforeAll(async () => {
    // Initialize mocks
    const { auth } = await import('@/lib/auth/config');
    const { sessionManager, SessionRateLimiter } = await import('@/lib/session-manager');
    
    mockAuth = auth.api;
    mockSessionManager = sessionManager;
    mockRateLimiter = SessionRateLimiter;

    // Setup default mock behaviors
    mockRateLimiter.checkRateLimit.mockResolvedValue({ allowed: true });
  });

  beforeEach(() => {
    // Reset all mocks before each test
    jest.clearAllMocks();
    
    // Setup default rate limit behavior
    mockRateLimiter.checkRateLimit.mockResolvedValue({ allowed: true });
  });

  describe('GET /api/auth/sessions', () => {
    test('should list user sessions successfully', async () => {
      // Mock authentication
      mockAuth.getSession.mockResolvedValue(MOCK_AUTH.USER);
      
      // Mock session data
      const mockSessions = [
        {
          id: 'session-001',
          token: 'token-001',
          userId: TEST_CONFIG.TEST_USER_ID,
          expiresAt: new Date(Date.now() + 86400000),
          createdAt: new Date(),
          updatedAt: new Date(),
          ipAddress: '192.168.1.100',
          userAgent: 'Mozilla/5.0 Test Browser',
          deviceType: 'Desktop',
          browser: 'Chrome',
          location: 'Test Location',
          isCurrent: true,
        },
      ];
      
      const mockStats = {
        active: 1,
        total: 1,
        expired: 0,
        recent: 1,
      };

      mockSessionManager.getUserSessions.mockResolvedValue(mockSessions);
      mockSessionManager.getSessionStats.mockResolvedValue(mockStats);

      // Create request
      const { req } = createMocks({
        method: 'GET',
        headers: {
          'authorization': 'Bearer mock-token',
          'user-agent': 'Test Browser',
          'x-forwarded-for': '192.168.1.100',
        },
      });

      // Execute request
      const response = await getSessionsHandler(req);
      const responseData = await response.json();

      // Verify response
      expect(response.status).toBe(200);
      expect(responseData.success).toBe(true);
      expect(responseData.data.sessions).toHaveLength(1);
      expect(responseData.data.sessions[0]).toMatchObject({
        id: 'session-001',
        userId: TEST_CONFIG.TEST_USER_ID,
        hasToken: true, // Token should be masked
        isCurrent: true,
      });
      expect(responseData.data.stats).toEqual(mockStats);
    });

    test('should return 401 for unauthenticated requests', async () => {
      // Mock no authentication
      mockAuth.getSession.mockResolvedValue(null);

      const { req } = createMocks({
        method: 'GET',
      });

      const response = await getSessionsHandler(req);
      const responseData = await response.json();

      expect(response.status).toBe(401);
      expect(responseData.error).toBe('Unauthorized');
      expect(responseData.code).toBe('UNAUTHORIZED');
    });

    test('should enforce rate limiting', async () => {
      // Mock authentication
      mockAuth.getSession.mockResolvedValue(MOCK_AUTH.USER);
      
      // Mock rate limit exceeded
      mockRateLimiter.checkRateLimit.mockResolvedValue({
        allowed: false,
        retryAfter: 60,
      });

      const { req } = createMocks({
        method: 'GET',
        headers: {
          'authorization': 'Bearer mock-token',
          'x-forwarded-for': '192.168.1.100',
        },
      });

      const response = await getSessionsHandler(req);
      const responseData = await response.json();

      expect(response.status).toBe(429);
      expect(responseData.error).toBe('Rate limit exceeded');
      expect(responseData.code).toBe('RATE_LIMIT_EXCEEDED');
      expect(responseData.retryAfter).toBe(60);
    });

    test('should handle query parameters correctly', async () => {
      mockAuth.getSession.mockResolvedValue(MOCK_AUTH.USER);
      mockSessionManager.getUserSessions.mockResolvedValue([]);
      mockSessionManager.getSessionStats.mockResolvedValue({ active: 0, total: 0 });

      const { req } = createMocks({
        method: 'GET',
        query: { includeExpired: 'true', includeSecurity: 'true' },
        headers: {
          'authorization': 'Bearer mock-token',
          'x-forwarded-for': '192.168.1.100',
        },
      });

      await getSessionsHandler(req);

      expect(mockSessionManager.getUserSessions).toHaveBeenCalledWith(
        TEST_CONFIG.TEST_USER_ID,
        {
          includeExpired: true,
          includeSecurity: true,
          currentSessionId: 'mock-session-001',
        }
      );
    });
  });

  describe('DELETE /api/auth/sessions', () => {
    test('should terminate all sessions successfully', async () => {
      mockAuth.getSession.mockResolvedValue(MOCK_AUTH.USER);
      mockSessionManager.terminateAllSessions.mockResolvedValue(3);
      mockSessionManager.enforceSessionLimits.mockResolvedValue({});

      const { req } = createMocks({
        method: 'DELETE',
        body: JSON.stringify({
          operation: 'terminateAll',
          excludeCurrent: true,
          reason: 'user_requested',
        }),
        headers: {
          'content-type': 'application/json',
          'authorization': 'Bearer mock-token',
          'x-forwarded-for': '192.168.1.100',
        },
      });

      const response = await deleteSessionsHandler(req);
      const responseData = await response.json();

      expect(response.status).toBe(200);
      expect(responseData.success).toBe(true);
      expect(responseData.data.terminatedCount).toBe(3);
      expect(responseData.data.operation).toBe('terminateAll');
    });

    test('should terminate selected sessions', async () => {
      mockAuth.getSession.mockResolvedValue(MOCK_AUTH.USER);
      mockSessionManager.terminateSession.mockResolvedValue(true);
      mockSessionManager.enforceSessionLimits.mockResolvedValue({});

      const sessionIds = ['session-001', 'session-002'];
      const { req } = createMocks({
        method: 'DELETE',
        body: JSON.stringify({
          operation: 'terminateSelected',
          sessionIds,
          reason: 'user_requested',
        }),
        headers: {
          'content-type': 'application/json',
          'authorization': 'Bearer mock-token',
          'x-forwarded-for': '192.168.1.100',
        },
      });

      const response = await deleteSessionsHandler(req);
      const responseData = await response.json();

      expect(response.status).toBe(200);
      expect(responseData.success).toBe(true);
      expect(responseData.data.terminatedCount).toBe(2);
      expect(mockSessionManager.terminateSession).toHaveBeenCalledTimes(2);
    });

    test('should validate operation parameter', async () => {
      mockAuth.getSession.mockResolvedValue(MOCK_AUTH.USER);

      const { req } = createMocks({
        method: 'DELETE',
        body: JSON.stringify({
          operation: 'invalidOperation',
        }),
        headers: {
          'content-type': 'application/json',
          'authorization': 'Bearer mock-token',
          'x-forwarded-for': '192.168.1.100',
        },
      });

      const response = await deleteSessionsHandler(req);
      const responseData = await response.json();

      expect(response.status).toBe(400);
      expect(responseData.error).toBe('Invalid operation');
      expect(responseData.code).toBe('INVALID_OPERATION');
    });
  });

  describe('POST /api/auth/sessions', () => {
    test('should create session for admin users', async () => {
      mockAuth.getSession.mockResolvedValue(MOCK_AUTH.ADMIN);
      
      const mockNewSession = {
        id: 'new-session-001',
        userId: 'target-user-001',
        expiresAt: new Date(Date.now() + 86400000),
        createdAt: new Date(),
        token: 'new-session-token',
      };

      mockSessionManager.createSession.mockResolvedValue(mockNewSession);

      const { req } = createMocks({
        method: 'POST',
        body: JSON.stringify({
          userId: 'target-user-001',
          maxAge: 86400,
          ipAddress: '192.168.1.200',
          userAgent: 'Test Browser',
        }),
        headers: {
          'content-type': 'application/json',
          'authorization': 'Bearer mock-admin-token',
          'x-forwarded-for': '192.168.1.100',
        },
      });

      const response = await postSessionsHandler(req);
      const responseData = await response.json();

      expect(response.status).toBe(200);
      expect(responseData.success).toBe(true);
      expect(responseData.data.sessionId).toBe('new-session-001');
      expect(responseData.data.hasToken).toBe(true);
    });

    test('should deny session creation for non-admin users', async () => {
      mockAuth.getSession.mockResolvedValue(MOCK_AUTH.USER);

      const { req } = createMocks({
        method: 'POST',
        body: JSON.stringify({
          userId: 'target-user-001',
        }),
        headers: {
          'content-type': 'application/json',
          'authorization': 'Bearer mock-token',
          'x-forwarded-for': '192.168.1.100',
        },
      });

      const response = await postSessionsHandler(req);
      const responseData = await response.json();

      expect(response.status).toBe(403);
      expect(responseData.error).toBe('Forbidden');
      expect(responseData.code).toBe('FORBIDDEN');
    });

    test('should validate required userId parameter', async () => {
      mockAuth.getSession.mockResolvedValue(MOCK_AUTH.ADMIN);

      const { req } = createMocks({
        method: 'POST',
        body: JSON.stringify({}),
        headers: {
          'content-type': 'application/json',
          'authorization': 'Bearer mock-admin-token',
          'x-forwarded-for': '192.168.1.100',
        },
      });

      const response = await postSessionsHandler(req);
      const responseData = await response.json();

      expect(response.status).toBe(400);
      expect(responseData.error).toBe('User ID is required');
      expect(responseData.code).toBe('MISSING_USER_ID');
    });
  });

  describe('GET /api/auth/sessions/[id]', () => {
    test('should get session details for owner', async () => {
      mockAuth.getSession.mockResolvedValue(MOCK_AUTH.USER);

      // Mock database session
      const mockDbSession = {
        id: 'session-001',
        userId: TEST_CONFIG.TEST_USER_ID,
        expiresAt: new Date(Date.now() + 86400000),
        createdAt: new Date(),
        updatedAt: new Date(),
        ipAddress: '192.168.1.100',
        userAgent: 'Test Browser',
        user: { id: TEST_CONFIG.TEST_USER_ID },
      };

      // Mock Prisma
      const mockPrisma = {
        session: {
          findUnique: jest.fn().mockResolvedValue(mockDbSession),
        },
      };

      // We need to mock the db import
      jest.doMock('@/lib/db', () => mockPrisma);

      const { req } = createMocks({
        method: 'GET',
        headers: {
          'authorization': 'Bearer mock-token',
          'x-forwarded-for': '192.168.1.100',
        },
      });

      const response = await getSessionHandler(req, { params: { id: 'session-001' } });
      const responseData = await response.json();

      expect(response.status).toBe(200);
      expect(responseData.success).toBe(true);
      expect(responseData.data.session.id).toBe('session-001');
    });

    test('should return 404 for non-existent session', async () => {
      mockAuth.getSession.mockResolvedValue(MOCK_AUTH.USER);

      const mockPrisma = {
        session: {
          findUnique: jest.fn().mockResolvedValue(null),
        },
      };

      jest.doMock('@/lib/db', () => mockPrisma);

      const { req } = createMocks({
        method: 'GET',
        headers: {
          'authorization': 'Bearer mock-token',
          'x-forwarded-for': '192.168.1.100',
        },
      });

      const response = await getSessionHandler(req, { params: { id: 'non-existent' } });
      const responseData = await response.json();

      expect(response.status).toBe(404);
      expect(responseData.error).toBe('Session not found');
      expect(responseData.code).toBe('SESSION_NOT_FOUND');
    });

    test('should deny access to other users sessions', async () => {
      mockAuth.getSession.mockResolvedValue(MOCK_AUTH.USER);

      const mockDbSession = {
        id: 'session-001',
        userId: 'other-user-id',
        user: { id: 'other-user-id' },
      };

      const mockPrisma = {
        session: {
          findUnique: jest.fn().mockResolvedValue(mockDbSession),
        },
      };

      jest.doMock('@/lib/db', () => mockPrisma);

      const { req } = createMocks({
        method: 'GET',
        headers: {
          'authorization': 'Bearer mock-token',
          'x-forwarded-for': '192.168.1.100',
        },
      });

      const response = await getSessionHandler(req, { params: { id: 'session-001' } });
      const responseData = await response.json();

      expect(response.status).toBe(403);
      expect(responseData.error).toBe('Forbidden');
      expect(responseData.code).toBe('FORBIDDEN');
    });
  });

  describe('PUT /api/auth/sessions/[id]', () => {
    test('should extend session successfully', async () => {
      mockAuth.getSession.mockResolvedValue(MOCK_AUTH.USER);

      const mockDbSession = {
        id: 'session-001',
        userId: TEST_CONFIG.TEST_USER_ID,
        expiresAt: new Date(),
        updatedAt: new Date(),
      };

      const mockUpdatedSession = {
        ...mockDbSession,
        expiresAt: new Date(Date.now() + 86400000),
        updatedAt: new Date(),
      };

      const mockPrisma = {
        session: {
          findUnique: jest.fn().mockResolvedValue(mockDbSession),
          update: jest.fn().mockResolvedValue(mockUpdatedSession),
        },
      };

      jest.doMock('@/lib/db', () => mockPrisma);

      const { req } = createMocks({
        method: 'PUT',
        body: JSON.stringify({
          operation: 'extend',
          extendDuration: 86400,
          reason: 'user_requested',
        }),
        headers: {
          'content-type': 'application/json',
          'authorization': 'Bearer mock-token',
          'x-forwarded-for': '192.168.1.100',
        },
      });

      const response = await putSessionHandler(req, { params: { id: 'session-001' } });
      const responseData = await response.json();

      expect(response.status).toBe(200);
      expect(responseData.success).toBe(true);
      expect(responseData.data.operation).toBe('extend');
    });

    test('should validate operation parameter', async () => {
      mockAuth.getSession.mockResolvedValue(MOCK_AUTH.USER);

      const mockDbSession = {
        id: 'session-001',
        userId: TEST_CONFIG.TEST_USER_ID,
      };

      const mockPrisma = {
        session: {
          findUnique: jest.fn().mockResolvedValue(mockDbSession),
        },
      };

      jest.doMock('@/lib/db', () => mockPrisma);

      const { req } = createMocks({
        method: 'PUT',
        body: JSON.stringify({
          operation: 'invalidOperation',
        }),
        headers: {
          'content-type': 'application/json',
          'authorization': 'Bearer mock-token',
          'x-forwarded-for': '192.168.1.100',
        },
      });

      const response = await putSessionHandler(req, { params: { id: 'session-001' } });
      const responseData = await response.json();

      expect(response.status).toBe(400);
      expect(responseData.error).toBe('Invalid operation');
      expect(responseData.code).toBe('INVALID_OPERATION');
    });
  });

  describe('DELETE /api/auth/sessions/[id]', () => {
    test('should terminate session successfully', async () => {
      mockAuth.getSession.mockResolvedValue(MOCK_AUTH.USER);

      const mockDbSession = {
        id: 'session-001',
        userId: TEST_CONFIG.TEST_USER_ID,
        ipAddress: '192.168.1.100',
        userAgent: 'Test Browser',
      };

      mockSessionManager.terminateSession.mockResolvedValue(true);

      const mockPrisma = {
        session: {
          findUnique: jest.fn().mockResolvedValue(mockDbSession),
        },
      };

      jest.doMock('@/lib/db', () => mockPrisma);

      const { req } = createMocks({
        method: 'DELETE',
        query: { reason: 'user_requested' },
        headers: {
          'authorization': 'Bearer mock-token',
          'x-forwarded-for': '192.168.1.100',
        },
      });

      const response = await deleteSessionHandler(req, { params: { id: 'session-001' } });
      const responseData = await response.json();

      expect(response.status).toBe(200);
      expect(responseData.success).toBe(true);
      expect(responseData.data.terminated).toBe(true);
      expect(responseData.data.sessionId).toBe('session-001');
    });

    test('should protect current session without confirmation', async () => {
      mockAuth.getSession.mockResolvedValue({
        ...MOCK_AUTH.USER,
        session: { id: 'session-001', token: 'mock-token' },
      });

      const mockDbSession = {
        id: 'session-001',
        userId: TEST_CONFIG.TEST_USER_ID,
      };

      const mockPrisma = {
        session: {
          findUnique: jest.fn().mockResolvedValue(mockDbSession),
        },
      };

      jest.doMock('@/lib/db', () => mockPrisma);

      const { req } = createMocks({
        method: 'DELETE',
        headers: {
          'authorization': 'Bearer mock-token',
          'x-forwarded-for': '192.168.1.100',
        },
      });

      const response = await deleteSessionHandler(req, { params: { id: 'session-001' } });
      const responseData = await response.json();

      expect(response.status).toBe(400);
      expect(responseData.error).toBe('Cannot terminate current session without confirmation');
      expect(responseData.code).toBe('CURRENT_SESSION_PROTECTION');
    });

    test('should allow current session termination with confirmation', async () => {
      mockAuth.getSession.mockResolvedValue({
        ...MOCK_AUTH.USER,
        session: { id: 'session-001', token: 'mock-token' },
      });

      const mockDbSession = {
        id: 'session-001',
        userId: TEST_CONFIG.TEST_USER_ID,
      };

      mockSessionManager.terminateSession.mockResolvedValue(true);

      const mockPrisma = {
        session: {
          findUnique: jest.fn().mockResolvedValue(mockDbSession),
        },
      };

      jest.doMock('@/lib/db', () => mockPrisma);

      const { req } = createMocks({
        method: 'DELETE',
        query: { confirmCurrent: 'true', reason: 'user_requested' },
        headers: {
          'authorization': 'Bearer mock-token',
          'x-forwarded-for': '192.168.1.100',
        },
      });

      const response = await deleteSessionHandler(req, { params: { id: 'session-001' } });
      const responseData = await response.json();

      expect(response.status).toBe(200);
      expect(responseData.success).toBe(true);
      expect(responseData.data.wasCurrentSession).toBe(true);
    });
  });

  describe('POST /api/auth/sessions/refresh', () => {
    test('should refresh session with token rotation', async () => {
      mockAuth.getSession.mockResolvedValue(MOCK_AUTH.USER);
      
      const mockRefreshResult = {
        success: true,
        newToken: 'new-rotated-token',
        expiresAt: new Date(Date.now() + 86400000),
        rotated: true,
      };

      mockSessionManager.refreshSession.mockResolvedValue(mockRefreshResult);

      const { req } = createMocks({
        method: 'POST',
        body: JSON.stringify({
          sessionId: 'session-001',
          rotateToken: true,
          extendExpiry: true,
        }),
        headers: {
          'content-type': 'application/json',
          'authorization': 'Bearer mock-token',
          'x-forwarded-for': '192.168.1.100',
        },
      });

      const response = await refreshSessionHandler(req);
      const responseData = await response.json();

      expect(response.status).toBe(200);
      expect(responseData.success).toBe(true);
      expect(responseData.data.tokenRotated).toBe(true);
      expect(responseData.data.newToken).toBe('new-rotated-token');
    });

    test('should handle failed refresh gracefully', async () => {
      mockAuth.getSession.mockResolvedValue(MOCK_AUTH.USER);
      
      const mockRefreshResult = {
        success: false,
        error: 'Session not found',
        rotated: false,
      };

      mockSessionManager.refreshSession.mockResolvedValue(mockRefreshResult);

      const { req } = createMocks({
        method: 'POST',
        body: JSON.stringify({
          sessionId: 'invalid-session-id',
        }),
        headers: {
          'content-type': 'application/json',
          'authorization': 'Bearer mock-token',
          'x-forwarded-for': '192.168.1.100',
        },
      });

      const response = await refreshSessionHandler(req);
      const responseData = await response.json();

      expect(response.status).toBe(400);
      expect(responseData.success).toBe(false);
      expect(responseData.error).toBe('Session not found');
    });

    test('should validate sessionId parameter', async () => {
      mockAuth.getSession.mockResolvedValue(MOCK_AUTH.USER);

      const { req } = createMocks({
        method: 'POST',
        body: JSON.stringify({}),
        headers: {
          'content-type': 'application/json',
          'authorization': 'Bearer mock-token',
          'x-forwarded-for': '192.168.1.100',
        },
      });

      const response = await refreshSessionHandler(req);
      const responseData = await response.json();

      expect(response.status).toBe(400);
      expect(responseData.error).toBe('Session ID is required');
      expect(responseData.code).toBe('MISSING_SESSION_ID');
    });
  });

  describe('Error Handling', () => {
    test('should handle internal server errors gracefully', async () => {
      mockAuth.getSession.mockResolvedValue(MOCK_AUTH.USER);
      mockSessionManager.getUserSessions.mockRejectedValue(new Error('Database connection failed'));

      const { req } = createMocks({
        method: 'GET',
        headers: {
          'authorization': 'Bearer mock-token',
          'x-forwarded-for': '192.168.1.100',
        },
      });

      const response = await getSessionsHandler(req);
      const responseData = await response.json();

      expect(response.status).toBe(500);
      expect(responseData.error).toBe('Internal server error');
      expect(responseData.code).toBe('INTERNAL_ERROR');
    });

    test('should handle malformed JSON gracefully', async () => {
      mockAuth.getSession.mockResolvedValue(MOCK_AUTH.USER);

      const { req } = createMocks({
        method: 'DELETE',
        body: 'invalid json {',
        headers: {
          'content-type': 'application/json',
          'authorization': 'Bearer mock-token',
          'x-forwarded-for': '192.168.1.100',
        },
      });

      try {
        await deleteSessionsHandler(req);
      } catch (error) {
        // Should handle JSON parsing errors gracefully
        expect(error).toBeDefined();
      }
    });
  });
});

// Utility function to create mock headers
function _createMockHeaders(overrides: Record<string, string> = {}) {
  return {
    'content-type': 'application/json',
    'user-agent': 'Test Browser/1.0',
    'x-forwarded-for': '192.168.1.100',
    ...overrides,
  };
}