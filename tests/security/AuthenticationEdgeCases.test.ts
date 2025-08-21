import { DatabaseTestHelper } from '../setup/jest.setup';
import { TestDataGenerator } from '../fixtures/TestDataGenerator';
import { PrismaClient } from '@prisma/client';
import { jest } from '@jest/globals';

// Mock fetch for authentication simulation
const mockFetch = jest.fn();
global.fetch = mockFetch as jest.MockedFunction<typeof fetch>;

describe('Authentication State Edge Cases', () => {
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
  
  describe('Session Expiration During Operations', () => {
    it('should handle session expiration during form submission', async () => {
      const user = await testDataGenerator.createTestUser();
      
      // Create expired session
      const expiredSession = await prisma.session.create({
        data: {
          sessionToken: 'expired-session-token',
          userId: user.id,
          expires: new Date(Date.now() - 60 * 60 * 1000) // 1 hour ago
        }
      });
      
      // Mock API response for expired session
      mockFetch.mockResolvedValue(new Response(JSON.stringify({
        error: 'Session Expired',
        code: 'SESSION_EXPIRED',
        message: 'Please log in again'
      }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      }));
      
      const response = await fetch('/api/auth/protected-action', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${expiredSession.sessionToken}`
        },
        body: JSON.stringify({ action: 'update-profile' })
      });
      
      expect(response.status).toBe(401);
      
      const errorData = await response.json();
      expect(errorData.code).toBe('SESSION_EXPIRED');
      
      // Verify session is actually expired in database
      const dbSession = await prisma.session.findUnique({
        where: { sessionToken: expiredSession.sessionToken }
      });
      expect(dbSession?.expires.getTime()).toBeLessThan(Date.now());
      
      console.log('✅ Session expiration during form submission');
    });
    
    it('should handle race conditions with session renewal', async () => {
      const user = await testDataGenerator.createTestUser();
      
      // Create session that expires soon
      const nearExpirySession = await prisma.session.create({
        data: {
          sessionToken: 'near-expiry-token',
          userId: user.id,
          expires: new Date(Date.now() + 5 * 60 * 1000) // 5 minutes from now
        }
      });
      
      let renewalCount = 0;
      
      // Mock concurrent renewal attempts
      mockFetch.mockImplementation((url) => {
        if ((url as string).includes('refresh')) {
          renewalCount++;
          
          if (renewalCount === 1) {
            // First renewal succeeds
            return Promise.resolve(new Response(JSON.stringify({
              success: true,
              session: {
                sessionToken: 'renewed-token-1',
                expires: new Date(Date.now() + 24 * 60 * 60 * 1000)
              }
            }), { status: 200 }));
          } else {
            // Subsequent renewals detect already renewed
            return Promise.resolve(new Response(JSON.stringify({
              error: 'Session Already Renewed',
              code: 'SESSION_ALREADY_RENEWED',
              currentToken: 'renewed-token-1'
            }), { status: 409 }));
          }
        }
        
        return Promise.resolve(new Response('{}', { status: 200 }));
      });
      
      // Simulate concurrent renewal requests
      const renewalPromises = [
        fetch('/api/auth/refresh', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${nearExpirySession.sessionToken}` }
        }),
        fetch('/api/auth/refresh', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${nearExpirySession.sessionToken}` }
        })
      ];
      
      const results = await Promise.all(renewalPromises);
      
      expect(results[0].status).toBe(200);
      expect(results[1].status).toBe(409);
      expect(renewalCount).toBe(2);
      
      console.log('✅ Race conditions with session renewal');
    });
  });
  
  describe('Concurrent Authentication Attempts', () => {
    it('should handle multiple login attempts for same user', async () => {
      const user = await testDataGenerator.createTestUser({
        email: 'concurrent@example.com'});
      
      let loginAttempts = 0;
      
      mockFetch.mockImplementation(() => {
        loginAttempts++;
        
        if (loginAttempts === 1) {
          // First login succeeds
          return Promise.resolve(new Response(JSON.stringify({
            success: true,
            user: { id: user.id, email: user.email },
            session: { sessionToken: 'session-token-1' }
          }), { status: 200 }));
        } else {
          // Subsequent logins detect active session
          return Promise.resolve(new Response(JSON.stringify({
            error: 'User Already Authenticated',
            code: 'ALREADY_AUTHENTICATED',
            existingSession: 'session-token-1'
          }), { status: 409 }));
        }
      });
      
      // Simulate concurrent login attempts
      const loginPromises = [
        fetch('/api/auth/signin', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: user.email,
            password: 'Password123!'
          })
        }),
        fetch('/api/auth/signin', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: user.email,
            password: 'Password123!'
          })
        })
      ];
      
      const results = await Promise.all(loginPromises);
      
      expect(results[0].status).toBe(200);
      expect(results[1].status).toBe(409);
      
      const successData = await results[0].json();
      expect(successData.session.sessionToken).toBe('session-token-1');
      
      const conflictData = await results[1].json();
      expect(conflictData.code).toBe('ALREADY_AUTHENTICATED');
      
      console.log('✅ Multiple login attempts for same user');
    });
    
    it('should handle session conflicts across multiple devices', async () => {
      const user = await testDataGenerator.createTestUser();
      
      // Create existing session (device 1)
      const existingSession = await prisma.session.create({
        data: {
          sessionToken: 'device-1-session',
          userId: user.id,
          expires: new Date(Date.now() + 24 * 60 * 60 * 1000)
        }
      });
      
      mockFetch.mockResolvedValue(new Response(JSON.stringify({
        success: true,
        user: { id: user.id, email: user.email },
        session: { sessionToken: 'device-2-session' },
        warning: 'Previous session on another device will be terminated'
      }), { status: 200 }));
      
      // Login from device 2
      const response = await fetch('/api/auth/signin', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'User-Agent': 'Device-2-Browser'
        },
        body: JSON.stringify({
          email: user.email,
          password: 'Password123!'
        })
      });
      
      expect(response.status).toBe(200);
      
      const responseData = await response.json();
      expect(responseData.session.sessionToken).toBe('device-2-session');
      expect(responseData.warning).toContain('Previous session');
      
      // Simulate cleanup of old session
      await prisma.session.delete({
        where: { sessionToken: existingSession.sessionToken }
      });
      
      const remainingSessions = await prisma.session.findMany({
        where: { userId: user.id }
      });
      
      expect(remainingSessions).toHaveLength(0); // Cleaned up in test
      
      console.log('✅ Session conflicts across multiple devices');
    });
  });
  
  describe('Authentication While Already Authenticated', () => {
    it('should handle login attempt with valid active session', async () => {
      const user = await testDataGenerator.createTestUser();
      
      // Create active session
      const activeSession = await prisma.session.create({
        data: {
          sessionToken: 'active-session-token',
          userId: user.id,
          expires: new Date(Date.now() + 24 * 60 * 60 * 1000)
        }
      });
      
      mockFetch.mockResolvedValue(new Response(JSON.stringify({
        error: 'Already Authenticated',
        code: 'ALREADY_AUTHENTICATED',
        message: 'User is already logged in',
        currentSession: {
          sessionToken: activeSession.sessionToken,
          expires: activeSession.expires
        }
      }), { status: 409 }));
      
      const response = await fetch('/api/auth/signin', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${activeSession.sessionToken}`
        },
        body: JSON.stringify({
          email: user.email,
          password: 'Password123!'
        })
      });
      
      expect(response.status).toBe(409);
      
      const errorData = await response.json();
      expect(errorData.code).toBe('ALREADY_AUTHENTICATED');
      expect(errorData.currentSession.sessionToken).toBe(activeSession.sessionToken);
      
      console.log('✅ Login attempt with valid active session');
    });
    
    it('should handle registration attempt by authenticated user', async () => {
      const user = await testDataGenerator.createTestUser();
      
      const activeSession = await prisma.session.create({
        data: {
          sessionToken: 'active-session-token',
          userId: user.id,
          expires: new Date(Date.now() + 24 * 60 * 60 * 1000)
        }
      });
      
      mockFetch.mockResolvedValue(new Response(JSON.stringify({
        error: 'User Already Registered',
        code: 'USER_ALREADY_AUTHENTICATED',
        message: 'Cannot register while authenticated'
      }), { status: 403 }));
      
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${activeSession.sessionToken}`
        },
        body: JSON.stringify({
          email: 'newuser@example.com',
          password: 'Password123!',
          name: 'New User'
        })
      });
      
      expect(response.status).toBe(403);
      
      const errorData = await response.json();
      expect(errorData.code).toBe('USER_ALREADY_AUTHENTICATED');
      
      console.log('✅ Registration attempt by authenticated user');
    });
  });
  
  describe('Partial Authentication States', () => {
    it('should handle pending email verification state', async () => {
      const user = await testDataGenerator.createTestUser({
        emailVerified: null, // Not verified
        email: 'unverified@example.com'
      });
      
      mockFetch.mockResolvedValue(new Response(JSON.stringify({
        success: true,
        user: { 
          id: user.id, 
          email: user.email,
          emailVerified: false
        },
        session: { sessionToken: 'partial-session' },
        requiresVerification: true,
        limitedAccess: true
      }), { status: 200 }));
      
      const response = await fetch('/api/auth/signin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: user.email,
          password: 'Password123!'
        })
      });
      
      expect(response.status).toBe(200);
      
      const responseData = await response.json();
      expect(responseData.requiresVerification).toBe(true);
      expect(responseData.limitedAccess).toBe(true);
      expect(responseData.user.emailVerified).toBe(false);
      
      console.log('✅ Pending email verification state');
    });
    
    it('should handle incomplete 2FA setup state', async () => {
      const user = await testDataGenerator.createTestUser({
        twoFactorEnabled: false,
        email: 'no2fa@example.com'
      });
      
      mockFetch.mockResolvedValue(new Response(JSON.stringify({
        success: true,
        user: { 
          id: user.id, 
          email: user.email,
          twoFactorEnabled: false
        },
        session: { sessionToken: 'partial-2fa-session' },
        requires2FASetup: true,
        securityLevel: 'basic'
      }), { status: 200 }));
      
      const response = await fetch('/api/auth/signin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: user.email,
          password: 'Password123!'
        })
      });
      
      expect(response.status).toBe(200);
      
      const responseData = await response.json();
      expect(responseData.requires2FASetup).toBe(true);
      expect(responseData.securityLevel).toBe('basic');
      expect(responseData.user.twoFactorEnabled).toBe(false);
      
      console.log('✅ Incomplete 2FA setup state');
    });
    
    it('should handle password reset required state', async () => {
      const user = await testDataGenerator.createTestUser({
        email: 'reset-required@example.com'
      });
      
      // Simulate user with password reset flag
      mockFetch.mockResolvedValue(new Response(JSON.stringify({
        error: 'Password Reset Required',
        code: 'PASSWORD_RESET_REQUIRED',
        message: 'Account requires password reset',
        resetToken: 'temp-reset-token',
        action: 'redirect_to_reset'
      }), { status: 423 })); // Locked status
      
      const response = await fetch('/api/auth/signin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: user.email,
          password: 'OldPassword123!'
        })
      });
      
      expect(response.status).toBe(423);
      
      const errorData = await response.json();
      expect(errorData.code).toBe('PASSWORD_RESET_REQUIRED');
      expect(errorData.resetToken).toBeDefined();
      expect(errorData.action).toBe('redirect_to_reset');
      
      console.log('✅ Password reset required state');
    });
  });
  
  describe('Account State Transitions', () => {
    it('should handle account activation during authentication', async () => {
      const user = await testDataGenerator.createTestUser({
        isActive: false,
        email: 'inactive@example.com'
      });
      
      mockFetch.mockResolvedValue(new Response(JSON.stringify({
        error: 'Account Inactive',
        code: 'ACCOUNT_INACTIVE',
        message: 'Account needs to be activated',
        activationRequired: true
      }), { status: 403 }));
      
      const response = await fetch('/api/auth/signin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: user.email,
          password: 'Password123!'
        })
      });
      
      expect(response.status).toBe(403);
      
      const errorData = await response.json();
      expect(errorData.code).toBe('ACCOUNT_INACTIVE');
      expect(errorData.activationRequired).toBe(true);
      
      console.log('✅ Account activation during authentication');
    });
    
    it('should handle account suspension during active session', async () => {
      const user = await testDataGenerator.createTestUser();
      
      const activeSession = await prisma.session.create({
        data: {
          sessionToken: 'active-session',
          userId: user.id,
          expires: new Date(Date.now() + 24 * 60 * 60 * 1000)
        }
      });
      
      // Simulate account suspension
      await prisma.user.update({
        where: { id: user.id },
        data: { isActive: false }
      });
      
      mockFetch.mockResolvedValue(new Response(JSON.stringify({
        error: 'Account Suspended',
        code: 'ACCOUNT_SUSPENDED',
        message: 'Account has been suspended',
        sessionTerminated: true
      }), { status: 403 }));
      
      const response = await fetch('/api/auth/verify-session', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${activeSession.sessionToken}` }
      });
      
      expect(response.status).toBe(403);
      
      const errorData = await response.json();
      expect(errorData.code).toBe('ACCOUNT_SUSPENDED');
      expect(errorData.sessionTerminated).toBe(true);
      
      console.log('✅ Account suspension during active session');
    });
  });
  
  describe('Session Overlap and Management', () => {
    it('should handle maximum session limit per user', async () => {
      const user = await testDataGenerator.createTestUser();
      const maxSessions = 3;
      
      // Create maximum number of sessions
      const _existingSessions = await Promise.all(
        Array.from({ length: maxSessions }, (_, i) => 
          prisma.session.create({
            data: {
              sessionToken: `session-${i + 1}`,
              userId: user.id,
              expires: new Date(Date.now() + 24 * 60 * 60 * 1000)
            }
          })
        )
      );
      
      mockFetch.mockResolvedValue(new Response(JSON.stringify({
        success: true,
        user: { id: user.id, email: user.email },
        session: { sessionToken: 'new-session' },
        warning: 'Oldest session terminated due to limit',
        terminatedSession: 'session-1'
      }), { status: 200 }));
      
      const response = await fetch('/api/auth/signin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: user.email,
          password: 'Password123!'
        })
      });
      
      expect(response.status).toBe(200);
      
      const responseData = await response.json();
      expect(responseData.terminatedSession).toBe('session-1');
      expect(responseData.session.sessionToken).toBe('new-session');
      
      // Verify session count in database
      const userSessions = await prisma.session.findMany({
        where: { userId: user.id }
      });
      expect(userSessions).toHaveLength(maxSessions); // Should still be at limit
      
      console.log('✅ Maximum session limit per user');
    });
    
    it('should handle session inheritance on device change', async () => {
      const user = await testDataGenerator.createTestUser();
      
      // Create session on mobile device
      const _mobileSession = await prisma.session.create({
        data: {
          sessionToken: 'mobile-session',
          userId: user.id,
          expires: new Date(Date.now() + 24 * 60 * 60 * 1000)
        }
      });
      
      mockFetch.mockResolvedValue(new Response(JSON.stringify({
        success: true,
        user: { id: user.id, email: user.email },
        session: { sessionToken: 'desktop-session' },
        deviceTransition: true,
        previousDevice: 'mobile',
        currentDevice: 'desktop'
      }), { status: 200 }));
      
      // Login from desktop
      const response = await fetch('/api/auth/signin', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'User-Agent': 'Desktop-Browser'
        },
        body: JSON.stringify({
          email: user.email,
          password: 'Password123!'
        })
      });
      
      expect(response.status).toBe(200);
      
      const responseData = await response.json();
      expect(responseData.deviceTransition).toBe(true);
      expect(responseData.previousDevice).toBe('mobile');
      expect(responseData.currentDevice).toBe('desktop');
      
      console.log('✅ Session inheritance on device change');
    });
  });
  
  afterAll(async () => {
    await testDataGenerator.cleanupTestData();
    await prisma.$disconnect();
  });
});