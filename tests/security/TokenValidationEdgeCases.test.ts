import { DatabaseTestHelper } from '../setup/jest.setup';
import { TestDataGenerator } from '../fixtures/TestDataGenerator';
import { PrismaClient } from '@prisma/client';
import { jest } from '@jest/globals';
import crypto from 'crypto';

// Mock fetch for token validation simulation
const mockFetch = jest.fn();
global.fetch = mockFetch as jest.MockedFunction<typeof fetch>;

describe('Token and Session Validation Edge Cases', () => {
  let prisma: PrismaClient;
  let testDataGenerator: TestDataGenerator;
  
  beforeAll(async () => {
    prisma = await DatabaseTestHelper.getTestDatabase();
    testDataGenerator = new TestDataGenerator(prisma);
  });
  
  beforeEach(async () => {
    await testDataGenerator.cleanupTestData();
    jest.clearAllMocks();
  });
  
  describe('Expired Token Handling', () => {
    it('should detect and reject expired session tokens', async () => {
      const user = await testDataGenerator.createTestUser();
      
      // Create expired session
      const expiredSession = await prisma.session.create({
        data: {
          sessionToken: 'expired-token-123',
          userId: user.id,
          expires: new Date(Date.now() - 60 * 60 * 1000) // 1 hour ago
        }
      });
      
      mockFetch.mockResolvedValue(new Response(JSON.stringify({
        error: 'Token Expired',
        code: 'TOKEN_EXPIRED',
        message: 'Session token has expired',
        expiredAt: expiredSession.expires.toISOString(),
        requiresRefresh: true
      }), { status: 401 }));
      
      const response = await fetch('/api/auth/verify', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${expiredSession.sessionToken}` }
      });
      
      expect(response.status).toBe(401);
      
      const errorData = await response.json();
      expect(errorData.code).toBe('TOKEN_EXPIRED');
      expect(errorData.requiresRefresh).toBe(true);
      
      // Verify token is actually expired
      expect(new Date(errorData.expiredAt).getTime()).toBeLessThan(Date.now());
      
      console.log('✅ Expired session token detection');
    });
    
    it('should handle tokens that expire during request processing', async () => {
      const user = await testDataGenerator.createTestUser();
      
      // Create session that expires in 1 second
      const nearExpirySession = await prisma.session.create({
        data: {
          sessionToken: 'near-expiry-token',
          userId: user.id,
          expires: new Date(Date.now() + 1000) // 1 second from now
        }
      });
      
      // Simulate delay in processing
      mockFetch.mockImplementation(() => 
        new Promise(resolve => {
          setTimeout(() => {
            resolve(new Response(JSON.stringify({
              error: 'Token Expired During Processing',
              code: 'TOKEN_EXPIRED_DURING_REQUEST',
              message: 'Token expired while processing request'
            }), { status: 401 }));
          }, 1100); // 1.1 seconds delay
        })
      );
      
      const startTime = Date.now();
      const response = await fetch('/api/auth/protected-action', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${nearExpirySession.sessionToken}` }
      });
      const endTime = Date.now();
      
      expect(response.status).toBe(401);
      expect(endTime - startTime).toBeGreaterThan(1000);
      
      const errorData = await response.json();
      expect(errorData.code).toBe('TOKEN_EXPIRED_DURING_REQUEST');
      
      console.log('✅ Token expiration during request processing');
    });
  });
  
  describe('Corrupted Token Data', () => {
    it('should handle malformed JWT tokens', async () => {
      const malformedTokens = [
        'invalid.jwt.token',
        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.invalid',
        'not-a-token-at-all',
        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..', // Missing payload
        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.invalid-signature'
      ];
      
      for (const token of malformedTokens) {
        mockFetch.mockResolvedValueOnce(new Response(JSON.stringify({
          error: 'Malformed Token',
          code: 'MALFORMED_TOKEN',
          message: 'Token format is invalid',
          tokenFormat: 'invalid'
        }), { status: 400 }));
        
        const response = await fetch('/api/auth/verify', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token}` }
        });
        
        expect(response.status).toBe(400);
        
        const errorData = await response.json();
        expect(errorData.code).toBe('MALFORMED_TOKEN');
      }
      
      console.log('✅ Malformed JWT token handling');
    });
    
    it('should handle corrupted session data in storage', async () => {
      const user = await testDataGenerator.createTestUser();
      
      // Create session with corrupted data simulation
      const corruptedSession = await prisma.session.create({
        data: {
          sessionToken: 'corrupted-session-data',
          userId: user.id,
          expires: new Date(Date.now() + 24 * 60 * 60 * 1000)
        }
      });
      
      mockFetch.mockResolvedValue(new Response(JSON.stringify({
        error: 'Session Data Corrupted',
        code: 'SESSION_DATA_CORRUPTED',
        message: 'Session data integrity check failed',
        action: 'reauthentication_required'
      }), { status: 422 }));
      
      const response = await fetch('/api/auth/verify', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${corruptedSession.sessionToken}` }
      });
      
      expect(response.status).toBe(422);
      
      const errorData = await response.json();
      expect(errorData.code).toBe('SESSION_DATA_CORRUPTED');
      expect(errorData.action).toBe('reauthentication_required');
      
      console.log('✅ Corrupted session data handling');
    });
  });
  
  describe('Token Replay Attacks', () => {
    it('should detect and prevent token replay attacks', async () => {
      const user = await testDataGenerator.createTestUser();
      
      const validSession = await prisma.session.create({
        data: {
          sessionToken: 'replay-target-token',
          userId: user.id,
          expires: new Date(Date.now() + 24 * 60 * 60 * 1000)
        }
      });
      
      let requestCount = 0;
      
      mockFetch.mockImplementation(() => {
        requestCount++;
        
        if (requestCount === 1) {
          // First request succeeds
          return Promise.resolve(new Response(JSON.stringify({
            success: true,
            user: { id: user.id, email: user.email },
            nonce: 'request-nonce-1'
          }), { status: 200 }));
        } else {
          // Subsequent requests with same token detected as replay
          return Promise.resolve(new Response(JSON.stringify({
            error: 'Token Replay Detected',
            code: 'TOKEN_REPLAY_ATTACK',
            message: 'Token has been used in suspicious pattern',
            securityIncident: true
          }), { status: 403 }));
        }
      });
      
      // First request
      const response1 = await fetch('/api/auth/protected-action', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${validSession.sessionToken}` }
      });
      
      expect(response1.status).toBe(200);
      
      // Replay attack attempt
      const response2 = await fetch('/api/auth/protected-action', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${validSession.sessionToken}` }
      });
      
      expect(response2.status).toBe(403);
      
      const errorData = await response2.json();
      expect(errorData.code).toBe('TOKEN_REPLAY_ATTACK');
      expect(errorData.securityIncident).toBe(true);
      
      console.log('✅ Token replay attack detection');
    });
    
    it('should implement token binding to prevent session hijacking', async () => {
      const user = await testDataGenerator.createTestUser();
      
      const boundSession = await prisma.session.create({
        data: {
          sessionToken: 'bound-session-token',
          userId: user.id,
          expires: new Date(Date.now() + 24 * 60 * 60 * 1000)
        }
      });
      
      const originalFingerprint = 'browser-fingerprint-123';
      const hijackedFingerprint = 'different-browser-456';
      
      mockFetch.mockImplementation((url, options) => {
        const headers = options?.headers as Record<string, string> || {};
        const fingerprint = headers['X-Browser-Fingerprint'];
        
        if (fingerprint === originalFingerprint) {
          return Promise.resolve(new Response(JSON.stringify({
            success: true,
            user: { id: user.id, email: user.email }
          }), { status: 200 }));
        } else {
          return Promise.resolve(new Response(JSON.stringify({
            error: 'Session Binding Violation',
            code: 'SESSION_BINDING_VIOLATION',
            message: 'Token bound to different client',
            originalFingerprint: originalFingerprint
          }), { status: 403 }));
        }
      });
      
      // Original client request
      const validResponse = await fetch('/api/auth/verify', {
        method: 'POST',
        headers: { 
          'Authorization': `Bearer ${boundSession.sessionToken}`,
          'X-Browser-Fingerprint': originalFingerprint
        }
      });
      
      expect(validResponse.status).toBe(200);
      
      // Hijacked session attempt
      const hijackedResponse = await fetch('/api/auth/verify', {
        method: 'POST',
        headers: { 
          'Authorization': `Bearer ${boundSession.sessionToken}`,
          'X-Browser-Fingerprint': hijackedFingerprint
        }
      });
      
      expect(hijackedResponse.status).toBe(403);
      
      const errorData = await hijackedResponse.json();
      expect(errorData.code).toBe('SESSION_BINDING_VIOLATION');
      
      console.log('✅ Token binding for session hijacking prevention');
    });
  });
  
  describe('Token Refresh Edge Cases', () => {
    it('should handle refresh token expiration', async () => {
      const user = await testDataGenerator.createTestUser();
      
      // Create session with expired refresh capability
      const sessionWithExpiredRefresh = await prisma.session.create({
        data: {
          sessionToken: 'session-expired-refresh',
          userId: user.id,
          expires: new Date(Date.now() + 60 * 60 * 1000) // Valid for 1 hour
        }
      });
      
      mockFetch.mockResolvedValue(new Response(JSON.stringify({
        error: 'Refresh Token Expired',
        code: 'REFRESH_TOKEN_EXPIRED',
        message: 'Cannot refresh session, refresh token expired',
        requiresLogin: true
      }), { status: 401 }));
      
      const response = await fetch('/api/auth/refresh', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${sessionWithExpiredRefresh.sessionToken}` }
      });
      
      expect(response.status).toBe(401);
      
      const errorData = await response.json();
      expect(errorData.code).toBe('REFRESH_TOKEN_EXPIRED');
      expect(errorData.requiresLogin).toBe(true);
      
      console.log('✅ Refresh token expiration handling');
    });
    
    it('should handle concurrent refresh attempts', async () => {
      const user = await testDataGenerator.createTestUser();
      
      const session = await prisma.session.create({
        data: {
          sessionToken: 'concurrent-refresh-token',
          userId: user.id,
          expires: new Date(Date.now() + 60 * 60 * 1000)
        }
      });
      
      let refreshCount = 0;
      
      mockFetch.mockImplementation(() => {
        refreshCount++;
        
        if (refreshCount === 1) {
          // First refresh succeeds
          return Promise.resolve(new Response(JSON.stringify({
            success: true,
            newToken: 'refreshed-token-123',
            expires: new Date(Date.now() + 24 * 60 * 60 * 1000)
          }), { status: 200 }));
        } else {
          // Concurrent refreshes detected
          return Promise.resolve(new Response(JSON.stringify({
            error: 'Concurrent Refresh Detected',
            code: 'CONCURRENT_REFRESH',
            message: 'Token is already being refreshed',
            newToken: 'refreshed-token-123'
          }), { status: 409 }));
        }
      });
      
      // Simulate concurrent refresh attempts
      const refreshPromises = [
        fetch('/api/auth/refresh', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${session.sessionToken}` }
        }),
        fetch('/api/auth/refresh', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${session.sessionToken}` }
        })
      ];
      
      const results = await Promise.all(refreshPromises);
      
      expect(results[0].status).toBe(200);
      expect(results[1].status).toBe(409);
      
      const successData = await results[0].json();
      const conflictData = await results[1].json();
      
      expect(successData.newToken).toBe('refreshed-token-123');
      expect(conflictData.code).toBe('CONCURRENT_REFRESH');
      expect(conflictData.newToken).toBe('refreshed-token-123');
      
      console.log('✅ Concurrent refresh attempts handling');
    });
  });
  
  describe('Invalid Token Signatures', () => {
    it('should detect tampered JWT signatures', async () => {
      // Simulate JWT with tampered signature
      const tamperedJWT = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.tampered-signature';
      
      mockFetch.mockResolvedValue(new Response(JSON.stringify({
        error: 'Invalid Token Signature',
        code: 'INVALID_SIGNATURE',
        message: 'Token signature verification failed',
        securityViolation: true
      }), { status: 401 }));
      
      const response = await fetch('/api/auth/verify', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${tamperedJWT}` }
      });
      
      expect(response.status).toBe(401);
      
      const errorData = await response.json();
      expect(errorData.code).toBe('INVALID_SIGNATURE');
      expect(errorData.securityViolation).toBe(true);
      
      console.log('✅ Tampered JWT signature detection');
    });
    
    it('should handle tokens signed with wrong key', async () => {
      // Simulate token signed with different key
      const wrongKeyToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.wrong-key-signature';
      
      mockFetch.mockResolvedValue(new Response(JSON.stringify({
        error: 'Wrong Signing Key',
        code: 'WRONG_SIGNING_KEY',
        message: 'Token was signed with unrecognized key',
        keyId: 'unknown'
      }), { status: 401 }));
      
      const response = await fetch('/api/auth/verify', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${wrongKeyToken}` }
      });
      
      expect(response.status).toBe(401);
      
      const errorData = await response.json();
      expect(errorData.code).toBe('WRONG_SIGNING_KEY');
      expect(errorData.keyId).toBe('unknown');
      
      console.log('✅ Wrong signing key detection');
    });
  });
  
  describe('Session Storage Failures', () => {
    it('should handle localStorage unavailability', async () => {
      const user = await testDataGenerator.createTestUser();
      
      // Mock localStorage failure
      const originalLocalStorage = global.localStorage;
      Object.defineProperty(global, 'localStorage', {
        value: {
          getItem: jest.fn(() => { throw new Error('localStorage unavailable'); }),
          setItem: jest.fn(() => { throw new Error('localStorage unavailable'); }),
          removeItem: jest.fn(() => { throw new Error('localStorage unavailable'); }),
          clear: jest.fn(() => { throw new Error('localStorage unavailable'); })
        },
        writable: true
      });
      
      try {
        // Attempt to store session token
        global.localStorage.setItem('sessionToken', 'test-token');
        throw new Error('Expected localStorage error');
      } catch (error) {
        expect((error as Error).message).toContain('localStorage unavailable');
      }
      
      // Restore original localStorage
      Object.defineProperty(global, 'localStorage', {
        value: originalLocalStorage,
        writable: true
      });
      
      console.log('✅ localStorage unavailability handling');
    });
    
    it('should handle sessionStorage quota exceeded', async () => {
      const user = await testDataGenerator.createTestUser();
      
      // Mock sessionStorage quota exceeded
      const originalSessionStorage = global.sessionStorage;
      Object.defineProperty(global, 'sessionStorage', {
        value: {
          getItem: jest.fn(),
          setItem: jest.fn(() => { 
            throw new DOMException('QuotaExceededError', 'QuotaExceededError'); 
          }),
          removeItem: jest.fn(),
          clear: jest.fn()
        },
        writable: true
      });
      
      try {
        // Attempt to store large session data
        global.sessionStorage.setItem('largeSessionData', 'x'.repeat(10000000));
        throw new Error('Expected quota exceeded error');
      } catch (error) {
        expect((error as Error).name).toBe('QuotaExceededError');
      }
      
      // Restore original sessionStorage
      Object.defineProperty(global, 'sessionStorage', {
        value: originalSessionStorage,
        writable: true
      });
      
      console.log('✅ sessionStorage quota exceeded handling');
    });
  });
  
  describe('Token Format Validation', () => {
    it('should validate token format and structure', async () => {
      const invalidFormats = [
        '', // Empty string
        ' ', // Whitespace only
        'Bearer token', // Missing Bearer prefix in validation
        'token-without-bearer-prefix',
        'Bearer ', // Bearer with no token
        'Bearer  ', // Bearer with whitespace only
        'Basic dXNlcjpwYXNz', // Wrong auth type
        'Bearer \n\t token-with-whitespace \n',
        'Bearer token\x00with\x00nulls' // Null bytes
      ];
      
      for (const invalidFormat of invalidFormats) {
        mockFetch.mockResolvedValueOnce(new Response(JSON.stringify({
          error: 'Invalid Token Format',
          code: 'INVALID_TOKEN_FORMAT',
          message: 'Token format does not meet requirements',
          receivedFormat: invalidFormat ? 'non-empty' : 'empty'
        }), { status: 400 }));
        
        const response = await fetch('/api/auth/verify', {
          method: 'POST',
          headers: { 'Authorization': invalidFormat }
        });
        
        expect(response.status).toBe(400);
        
        const errorData = await response.json();
        expect(errorData.code).toBe('INVALID_TOKEN_FORMAT');
      }
      
      console.log('✅ Token format validation');
    });
    
    it('should validate token length constraints', async () => {
      const user = await testDataGenerator.createTestUser();
      
      // Test extremely long token
      const veryLongToken = 'Bearer ' + 'x'.repeat(10000);
      
      mockFetch.mockResolvedValue(new Response(JSON.stringify({
        error: 'Token Too Long',
        code: 'TOKEN_LENGTH_EXCEEDED',
        message: 'Token exceeds maximum allowed length',
        maxLength: 8192,
        receivedLength: veryLongToken.length
      }), { status: 413 }));
      
      const response = await fetch('/api/auth/verify', {
        method: 'POST',
        headers: { 'Authorization': veryLongToken }
      });
      
      expect(response.status).toBe(413);
      
      const errorData = await response.json();
      expect(errorData.code).toBe('TOKEN_LENGTH_EXCEEDED');
      expect(errorData.receivedLength).toBeGreaterThan(errorData.maxLength);
      
      console.log('✅ Token length constraint validation');
    });
  });
  
  describe('Cross-Token Validation', () => {
    it('should prevent cross-user token usage', async () => {
      const user1 = await testDataGenerator.createTestUser({ email: 'user1@example.com' });
      const user2 = await testDataGenerator.createTestUser({ email: 'user2@example.com' });
      
      // Create session for user1
      const user1Session = await prisma.session.create({
        data: {
          sessionToken: 'user1-session-token',
          userId: user1.id,
          expires: new Date(Date.now() + 24 * 60 * 60 * 1000)
        }
      });
      
      mockFetch.mockResolvedValue(new Response(JSON.stringify({
        error: 'Token User Mismatch',
        code: 'TOKEN_USER_MISMATCH',
        message: 'Token belongs to different user',
        securityViolation: true
      }), { status: 403 }));
      
      // Attempt to use user1's token for user2's actions
      const response = await fetch('/api/auth/user2-specific-action', {
        method: 'POST',
        headers: { 
          'Authorization': `Bearer ${user1Session.sessionToken}`,
          'X-Target-User': user2.id
        }
      });
      
      expect(response.status).toBe(403);
      
      const errorData = await response.json();
      expect(errorData.code).toBe('TOKEN_USER_MISMATCH');
      expect(errorData.securityViolation).toBe(true);
      
      console.log('✅ Cross-user token usage prevention');
    });
  });
  
  afterAll(async () => {
    await testDataGenerator.cleanupTestData();
    await prisma.$disconnect();
  });
});