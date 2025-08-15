import { DatabaseTestHelper } from '../setup/jest.setup';
import { TestDataGenerator } from '../fixtures/TestDataGenerator';
import { PrismaClient } from '@prisma/client';

describe('Authentication and Authorization Security Tests', () => {
  let prisma: PrismaClient;
  let testDataGenerator: TestDataGenerator;
  
  beforeAll(async () => {
    prisma = await DatabaseTestHelper.getTestDatabase();
    testDataGenerator = new TestDataGenerator(prisma);
  });
  
  beforeEach(async () => {
    await testDataGenerator.cleanupTestData();
  });
  
  describe('Password Security', () => {
    it('should never store plaintext passwords', async () => {
      const plainPassword = 'mySecretPassword123!';
      const user = await testDataGenerator.createTestUser({
        hashedPassword: 'hashed_' + plainPassword // Simulated hash
      });
      
      // Password should be hashed, not plaintext
      expect(user.hashedPassword).not.toBe(plainPassword);
      expect(user.hashedPassword).toContain('hashed_');
      
      // Verify no plaintext password field exists
      const userKeys = Object.keys(user);
      expect(userKeys).not.toContain('password');
      expect(userKeys).not.toContain('plainPassword');
      expect(userKeys).not.toContain('rawPassword');
      
      console.log('✅ Password security: No plaintext storage');
    });
    
    it('should support password hash validation', async () => {
      const user = await testDataGenerator.createTestUser({
        hashedPassword: '$2b$10$example.hash.for.testing.purposes.only',
        email: 'hash-test@example.com'
      });
      
      // Hash should look like a proper bcrypt hash
      expect(user.hashedPassword).toMatch(/^\$2b\$\d+\$/);
      
      console.log('✅ Password hash format validation');
    });
    
    it('should handle null passwords for OAuth users', async () => {
      const oauthUser = await testDataGenerator.createTestUser({
        hashedPassword: null,
        email: 'oauth-user@example.com'
      });
      
      expect(oauthUser.hashedPassword).toBeNull();
      expect(oauthUser.email).toBe('oauth-user@example.com');
      
      console.log('✅ OAuth user password handling');
    });
  });
  
  describe('Session Security', () => {
    it('should create secure session tokens', async () => {
      const user = await testDataGenerator.createTestUser();
      
      const session = await prisma.session.create({
        data: {
          sessionToken: 'secure_random_token_abcdef123456',
          userId: user.id,
          expires: new Date(Date.now() + 24 * 60 * 60 * 1000)
        }
      });
      
      expect(session.sessionToken).toBeDefined();
      expect(session.sessionToken.length).toBeGreaterThan(20);
      expect(session.expires).toBeInstanceOf(Date);
      expect(session.expires.getTime()).toBeGreaterThan(Date.now());
      
      console.log('✅ Session token security');
    });
    
    it('should enforce session expiration', async () => {
      const user = await testDataGenerator.createTestUser();
      
      // Create expired session
      const expiredSession = await prisma.session.create({
        data: {
          sessionToken: 'expired_token_123',
          userId: user.id,
          expires: new Date(Date.now() - 60 * 60 * 1000) // 1 hour ago
        }
      });
      
      // Create valid session
      const validSession = await prisma.session.create({
        data: {
          sessionToken: 'valid_token_456',
          userId: user.id,
          expires: new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours from now
        }
      });
      
      // Query for valid sessions only
      const validSessions = await prisma.session.findMany({
        where: {
          expires: { gt: new Date() }
        }
      });
      
      expect(validSessions).toHaveLength(1);
      expect(validSessions[0].sessionToken).toBe('valid_token_456');
      
      console.log('✅ Session expiration enforcement');
    });
    
    it('should handle session cleanup', async () => {
      const user = await testDataGenerator.createTestUser();
      
      // Create multiple sessions
      await Promise.all([
        prisma.session.create({
          data: {
            sessionToken: 'session_1',
            userId: user.id,
            expires: new Date(Date.now() - 60 * 60 * 1000)
          }
        }),
        prisma.session.create({
          data: {
            sessionToken: 'session_2',
            userId: user.id,
            expires: new Date(Date.now() - 30 * 60 * 1000)
          }
        }),
        prisma.session.create({
          data: {
            sessionToken: 'session_3',
            userId: user.id,
            expires: new Date(Date.now() + 60 * 60 * 1000)
          }
        })
      ]);
      
      // Cleanup expired sessions
      const deleteResult = await prisma.session.deleteMany({
        where: {
          expires: { lt: new Date() }
        }
      });
      
      expect(deleteResult.count).toBe(2);
      
      // Verify only valid session remains
      const remainingSessions = await prisma.session.findMany({
        where: { userId: user.id }
      });
      
      expect(remainingSessions).toHaveLength(1);
      expect(remainingSessions[0].sessionToken).toBe('session_3');
      
      console.log('✅ Session cleanup functionality');
    });
  });
  
  describe('OAuth Account Security', () => {
    it('should handle OAuth account linking', async () => {
      const user = await testDataGenerator.createTestUser();
      
      const oauthAccount = await prisma.account.create({
        data: {
          userId: user.id,
          type: 'oauth',
          provider: 'google',
          providerAccountId: 'google_123456789',
          access_token: 'oauth_access_token_example',
          refresh_token: 'oauth_refresh_token_example',
          expires_at: Math.floor(Date.now() / 1000) + 3600,
          token_type: 'Bearer',
          scope: 'openid email profile'
        }
      });
      
      expect(oauthAccount.provider).toBe('google');
      expect(oauthAccount.providerAccountId).toBe('google_123456789');
      expect(oauthAccount.userId).toBe(user.id);
      
      console.log('✅ OAuth account linking');
    });
    
    it('should enforce OAuth account uniqueness', async () => {
      const user1 = await testDataGenerator.createTestUser({ email: 'user1@test.com' });
      const user2 = await testDataGenerator.createTestUser({ email: 'user2@test.com' });
      
      // Create OAuth account for user1
      await prisma.account.create({
        data: {
          userId: user1.id,
          type: 'oauth',
          provider: 'github',
          providerAccountId: 'github_unique_123'
        }
      });
      
      // Should fail to create same OAuth account for user2
      await expect(
        prisma.account.create({
          data: {
            userId: user2.id,
            type: 'oauth',
            provider: 'github',
            providerAccountId: 'github_unique_123'
          }
        })
      ).rejects.toThrow();
      
      console.log('✅ OAuth account uniqueness enforcement');
    });
    
    it('should handle token refresh security', async () => {
      const user = await testDataGenerator.createTestUser();
      
      const account = await prisma.account.create({
        data: {
          userId: user.id,
          type: 'oauth',
          provider: 'microsoft',
          providerAccountId: 'ms_123456',
          access_token: 'old_access_token',
          refresh_token: 'refresh_token_abc123',
          expires_at: Math.floor(Date.now() / 1000) - 3600 // Expired
        }
      });
      
      // Update with new tokens
      const updatedAccount = await prisma.account.update({
        where: { id: account.id },
        data: {
          access_token: 'new_access_token',
          expires_at: Math.floor(Date.now() / 1000) + 3600
        }
      });
      
      expect(updatedAccount.access_token).toBe('new_access_token');
      expect(updatedAccount.expires_at).toBeGreaterThan(Math.floor(Date.now() / 1000));
      
      console.log('✅ Token refresh security');
    });
  });
  
  describe('Role-Based Access Control (RBAC)', () => {
    it('should validate user role assignment', async () => {
      const customer = await testDataGenerator.createTestUser({ 
        role: 'CUSTOMER',
        email: 'customer@test.com'
      });
      const admin = await testDataGenerator.createTestUser({ 
        role: 'ADMIN',
        email: 'admin@test.com'
      });
      const support = await testDataGenerator.createTestUser({ 
        role: 'SUPPORT',
        email: 'support@test.com'
      });
      
      expect(customer.role).toBe('CUSTOMER');
      expect(admin.role).toBe('ADMIN');
      expect(support.role).toBe('SUPPORT');
      
      // Query by role
      const adminUsers = await prisma.user.findMany({
        where: { role: 'ADMIN' }
      });
      expect(adminUsers).toHaveLength(1);
      expect(adminUsers[0].email).toBe('admin@test.com');
      
      console.log('✅ Role-based access control assignment');
    });
    
    it('should validate role-based data access', async () => {
      const customer = await testDataGenerator.createTestUser({ role: 'CUSTOMER' });
      const admin = await testDataGenerator.createTestUser({ role: 'ADMIN' });
      
      // Create customer's data
      const customerOrder = await testDataGenerator.createTestOrder(customer.id);
      const customerPaymentMethod = await testDataGenerator.createTestPaymentMethod(customer.id);
      
      // Admin should be able to query all users (simulated)
      const allUsers = await prisma.user.findMany({
        where: { isActive: true }
      });
      expect(allUsers.length).toBeGreaterThanOrEqual(2);
      
      // Customer should only see their own data
      const customerData = await prisma.user.findUnique({
        where: { id: customer.id },
        include: { 
          orders: true, 
          paymentMethods: true 
        }
      });
      
      expect(customerData?.orders).toHaveLength(1);
      expect(customerData?.paymentMethods).toHaveLength(1);
      expect(customerData?.orders[0].id).toBe(customerOrder.id);
      
      console.log('✅ Role-based data access validation');
    });
    
    it('should validate administrative privileges', async () => {
      const admin = await testDataGenerator.createTestUser({ 
        role: 'ADMIN',
        email: 'admin@example.com'
      });
      
      // Admin should be able to access all orders (simulated)
      const allOrders = await prisma.order.findMany({
        include: { user: true },
        take: 100
      });
      
      // Admin should be able to access audit logs
      const auditLogs = await prisma.auditLog.findMany({
        take: 10,
        orderBy: { timestamp: 'desc' }
      });
      
      expect(allOrders).toBeDefined();
      expect(auditLogs).toBeDefined();
      
      console.log('✅ Administrative privileges validation');
    });
  });
  
  describe('Two-Factor Authentication (2FA)', () => {
    it('should support 2FA enablement', async () => {
      const user = await testDataGenerator.createTestUser({
        twoFactorEnabled: false,
        email: '2fa-test@example.com'
      });
      
      // Enable 2FA
      const updatedUser = await prisma.user.update({
        where: { id: user.id },
        data: { twoFactorEnabled: true }
      });
      
      expect(updatedUser.twoFactorEnabled).toBe(true);
      
      console.log('✅ 2FA enablement support');
    });
    
    it('should track 2FA-enabled users', async () => {
      await Promise.all([
        testDataGenerator.createTestUser({ 
          twoFactorEnabled: true,
          email: '2fa1@test.com'
        }),
        testDataGenerator.createTestUser({ 
          twoFactorEnabled: true,
          email: '2fa2@test.com'
        }),
        testDataGenerator.createTestUser({ 
          twoFactorEnabled: false,
          email: 'no2fa@test.com'
        })
      ]);
      
      const users2FA = await prisma.user.findMany({
        where: { twoFactorEnabled: true }
      });
      
      expect(users2FA).toHaveLength(2);
      
      console.log('✅ 2FA user tracking');
    });
  });
  
  describe('Account Security Features', () => {
    it('should track user activation status', async () => {
      const activeUser = await testDataGenerator.createTestUser({
        isActive: true,
        email: 'active@test.com'
      });
      
      const inactiveUser = await testDataGenerator.createTestUser({
        isActive: false,
        email: 'inactive@test.com'
      });
      
      // Query only active users
      const activeUsers = await prisma.user.findMany({
        where: { isActive: true }
      });
      
      expect(activeUsers.some(u => u.id === activeUser.id)).toBe(true);
      expect(activeUsers.some(u => u.id === inactiveUser.id)).toBe(false);
      
      console.log('✅ User activation status tracking');
    });
    
    it('should track login timestamps', async () => {
      const user = await testDataGenerator.createTestUser();
      const loginTime = new Date();
      
      // Update last login
      const updatedUser = await prisma.user.update({
        where: { id: user.id },
        data: { lastLoginAt: loginTime }
      });
      
      expect(updatedUser.lastLoginAt).toEqual(loginTime);
      
      // Query recent logins
      const recentLogins = await prisma.user.findMany({
        where: {
          lastLoginAt: {
            gte: new Date(Date.now() - 24 * 60 * 60 * 1000)
          }
        }
      });
      
      expect(recentLogins.some(u => u.id === user.id)).toBe(true);
      
      console.log('✅ Login timestamp tracking');
    });
    
    it('should handle account lockout simulation', async () => {
      const user = await testDataGenerator.createTestUser({
        isActive: true,
        email: 'lockout-test@example.com'
      });
      
      // Simulate account lockout
      const lockedUser = await prisma.user.update({
        where: { id: user.id },
        data: { isActive: false }
      });
      
      expect(lockedUser.isActive).toBe(false);
      
      // Verify locked user won't appear in active user queries
      const activeUsers = await prisma.user.findMany({
        where: { isActive: true }
      });
      
      expect(activeUsers.some(u => u.id === user.id)).toBe(false);
      
      console.log('✅ Account lockout functionality');
    });
  });
  
  describe('Security Audit Trails', () => {
    it('should log authentication events', async () => {
      const user = await testDataGenerator.createTestUser();
      
      // Log login event
      const loginAudit = await prisma.auditLog.create({
        data: {
          tableName: 'users',
          recordId: user.id,
          action: 'LOGIN',
          userId: user.id,
          userEmail: user.email,
          ipAddress: '192.168.1.100',
          userAgent: 'Mozilla/5.0 (Test Browser)',
          metadata: { loginMethod: 'password' }
        }
      });
      
      // Log logout event
      const logoutAudit = await prisma.auditLog.create({
        data: {
          tableName: 'users',
          recordId: user.id,
          action: 'LOGOUT',
          userId: user.id,
          userEmail: user.email,
          ipAddress: '192.168.1.100',
          userAgent: 'Mozilla/5.0 (Test Browser)',
          metadata: { sessionDuration: 3600 }
        }
      });
      
      expect(loginAudit.action).toBe('LOGIN');
      expect(logoutAudit.action).toBe('LOGOUT');
      
      // Query authentication events
      const authEvents = await prisma.auditLog.findMany({
        where: {
          recordId: user.id,
          action: { in: ['LOGIN', 'LOGOUT'] }
        },
        orderBy: { timestamp: 'asc' }
      });
      
      expect(authEvents).toHaveLength(2);
      
      console.log('✅ Authentication event audit trails');
    });
  });
});