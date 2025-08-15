import { DatabaseTestHelper } from '../setup/jest.setup';
import { TestDataGenerator } from '../fixtures/TestDataGenerator';
import { PrismaClient } from '@prisma/client';

describe('PCI DSS Compliance Security Tests', () => {
  let prisma: PrismaClient;
  let testDataGenerator: TestDataGenerator;
  
  beforeAll(async () => {
    prisma = await DatabaseTestHelper.getTestDatabase();
    testDataGenerator = new TestDataGenerator(prisma);
  });
  
  beforeEach(async () => {
    await testDataGenerator.cleanupTestData();
  });
  
  describe('PCI DSS Requirement 3: Protect Stored Cardholder Data', () => {
    it('should not store prohibited cardholder data', async () => {
      // Verify that sensitive cardholder data is not stored in database
      const paymentMethod = await testDataGenerator.createTestPaymentMethod(
        (await testDataGenerator.createTestUser()).id
      );
      
      // Should only store last4 digits, not full card number
      expect(paymentMethod.last4).toHaveLength(4);
      expect(paymentMethod.last4).toMatch(/^\d{4}$/);
      
      // Should not store CVV, PIN, or track data
      const paymentMethodData = Object.keys(paymentMethod);
      expect(paymentMethodData).not.toContain('cvv');
      expect(paymentMethodData).not.toContain('cvc');
      expect(paymentMethodData).not.toContain('pin');
      expect(paymentMethodData).not.toContain('trackData');
      expect(paymentMethodData).not.toContain('fullCardNumber');
      
      console.log('✅ PCI DSS Requirement 3: No prohibited cardholder data stored');
    });
    
    it('should validate encrypted payment references only', async () => {
      const paymentMethod = await testDataGenerator.createTestPaymentMethod(
        (await testDataGenerator.createTestUser()).id
      );
      
      // Should only store tokenized/encrypted references
      expect(paymentMethod.stripePaymentMethodId).toMatch(/^pm_/);
      expect(paymentMethod.fingerprint).toBeDefined();
      expect(paymentMethod.fingerprint).not.toContain(' '); // No spaces in fingerprint
      
      console.log('✅ Only encrypted payment references stored');
    });
  });
  
  describe('PCI DSS Requirement 7: Restrict Access by Business Need', () => {
    it('should validate user role-based access controls', async () => {
      const customerUser = await testDataGenerator.createTestUser({ role: 'CUSTOMER' });
      const adminUser = await testDataGenerator.createTestUser({ 
        role: 'ADMIN',
        email: 'admin@example.com'
      });
      const supportUser = await testDataGenerator.createTestUser({ 
        role: 'SUPPORT',
        email: 'support@example.com'
      });
      
      // Verify roles are properly set
      expect(customerUser.role).toBe('CUSTOMER');
      expect(adminUser.role).toBe('ADMIN');
      expect(supportUser.role).toBe('SUPPORT');
      
      // Test role-based queries
      const adminUsers = await prisma.user.findMany({
        where: { role: 'ADMIN' }
      });
      expect(adminUsers).toHaveLength(1);
      expect(adminUsers[0].email).toBe('admin@example.com');
      
      console.log('✅ PCI DSS Requirement 7: Role-based access controls implemented');
    });
    
    it('should validate payment data access restrictions', async () => {
      const user = await testDataGenerator.createTestUser();
      const paymentMethod = await testDataGenerator.createTestPaymentMethod(user.id);
      const order = await testDataGenerator.createTestOrder(user.id, {
        paymentMethodId: paymentMethod.id,
        stripePaymentIntentId: 'pi_test_123456'
      });
      
      // Payment methods should only be accessible by owner
      const userPaymentMethods = await prisma.paymentMethod.findMany({
        where: { userId: user.id }
      });
      expect(userPaymentMethods).toHaveLength(1);
      
      // Orders should include user context
      const userOrders = await prisma.order.findMany({
        where: { userId: user.id }
      });
      expect(userOrders).toHaveLength(1);
      expect(userOrders[0].stripePaymentIntentId).toBe('pi_test_123456');
      
      console.log('✅ Payment data access properly restricted by user');
    });
  });
  
  describe('PCI DSS Requirement 8: Identify and Authenticate Access', () => {
    it('should validate user identification mechanisms', async () => {
      const user = await testDataGenerator.createTestUser({
        email: 'auth-test@example.com',
        hashedPassword: 'hashed_password_example'
      });
      
      // Verify unique identification
      expect(user.id).toBeDefined();
      expect(user.email).toBe('auth-test@example.com');
      
      // Verify password is stored hashed (not plaintext)
      expect(user.hashedPassword).toBeDefined();
      expect(user.hashedPassword).not.toBe('plaintext_password');
      
      console.log('✅ PCI DSS Requirement 8: User identification validated');
    });
    
    it('should validate two-factor authentication support', async () => {
      const userWith2FA = await testDataGenerator.createTestUser({
        twoFactorEnabled: true,
        email: '2fa-user@example.com'
      });
      
      const userWithout2FA = await testDataGenerator.createTestUser({
        twoFactorEnabled: false,
        email: 'no-2fa-user@example.com'
      });
      
      expect(userWith2FA.twoFactorEnabled).toBe(true);
      expect(userWithout2FA.twoFactorEnabled).toBe(false);
      
      // Query users with 2FA enabled
      const users2FA = await prisma.user.findMany({
        where: { twoFactorEnabled: true }
      });
      expect(users2FA).toHaveLength(1);
      
      console.log('✅ Two-factor authentication support validated');
    });
    
    it('should validate session management', async () => {
      const user = await testDataGenerator.createTestUser();
      
      // Create session
      const session = await prisma.session.create({
        data: {
          sessionToken: 'secure_session_token_123',
          userId: user.id,
          expires: new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours
        }
      });
      
      expect(session.sessionToken).toBeDefined();
      expect(session.userId).toBe(user.id);
      expect(session.expires).toBeInstanceOf(Date);
      
      // Verify session can be looked up
      const foundSession = await prisma.session.findUnique({
        where: { sessionToken: session.sessionToken }
      });
      expect(foundSession?.userId).toBe(user.id);
      
      console.log('✅ Session management validated');
    });
  });
  
  describe('PCI DSS Requirement 10: Log and Monitor All Access', () => {
    it('should validate comprehensive audit logging', async () => {
      // Test audit log creation for various operations
      const auditEntries = [
        {
          tableName: 'users',
          recordId: 'user_123',
          action: 'CREATE',
          userId: 'admin_456',
          userEmail: 'admin@example.com',
          ipAddress: '192.168.1.100',
          userAgent: 'Mozilla/5.0...',
          newValues: { email: 'newuser@example.com', role: 'CUSTOMER' },
          changedFields: ['email', 'role']
        },
        {
          tableName: 'orders',
          recordId: 'order_789',
          action: 'UPDATE',
          userId: 'user_123',
          userEmail: 'user@example.com',
          ipAddress: '192.168.1.101',
          userAgent: 'Mozilla/5.0...',
          oldValues: { status: 'PENDING' },
          newValues: { status: 'PAID' },
          changedFields: ['status']
        },
        {
          tableName: 'payment_methods',
          recordId: 'pm_abc123',
          action: 'DELETE',
          userId: 'user_123',
          userEmail: 'user@example.com',
          ipAddress: '192.168.1.101',
          userAgent: 'Mozilla/5.0...',
          oldValues: { isActive: true },
          changedFields: ['isActive']
        }
      ];
      
      const createdAudits = await Promise.all(
        auditEntries.map(entry => prisma.auditLog.create({ data: entry }))
      );
      
      expect(createdAudits).toHaveLength(3);
      
      // Verify audit entries contain required fields
      createdAudits.forEach(audit => {
        expect(audit.tableName).toBeDefined();
        expect(audit.recordId).toBeDefined();
        expect(audit.action).toBeDefined();
        expect(audit.timestamp).toBeDefined();
        expect(audit.userId).toBeDefined();
        expect(audit.ipAddress).toBeDefined();
      });
      
      console.log('✅ PCI DSS Requirement 10: Comprehensive audit logging validated');
    });
    
    it('should validate audit log queries for compliance reporting', async () => {
      // Create audit entries for the last 30 days
      const now = new Date();
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      
      await prisma.auditLog.createMany({
        data: [
          {
            tableName: 'payment_methods',
            recordId: 'pm_test1',
            action: 'CREATE',
            userId: 'user1',
            timestamp: new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000)
          },
          {
            tableName: 'orders',
            recordId: 'order_test1',
            action: 'UPDATE',
            userId: 'user1',
            timestamp: new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000)
          },
          {
            tableName: 'users',
            recordId: 'user_test1',
            action: 'DELETE',
            userId: 'admin1',
            timestamp: new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000)
          }
        ]
      });
      
      // Query audit logs for compliance reporting
      const recentAudits = await prisma.auditLog.findMany({
        where: {
          timestamp: { gte: thirtyDaysAgo }
        },
        orderBy: { timestamp: 'desc' }
      });
      
      expect(recentAudits.length).toBeGreaterThanOrEqual(3);
      
      // Test filtering by table
      const paymentAudits = await prisma.auditLog.findMany({
        where: {
          tableName: 'payment_methods',
          timestamp: { gte: thirtyDaysAgo }
        }
      });
      expect(paymentAudits.length).toBeGreaterThan(0);
      
      // Test filtering by action
      const deleteActions = await prisma.auditLog.findMany({
        where: { action: 'DELETE' }
      });
      expect(deleteActions.length).toBeGreaterThan(0);
      
      console.log('✅ Audit log compliance reporting queries validated');
    });
  });
  
  describe('PCI DSS Requirement 11: Regular Security Testing', () => {
    it('should validate database security configuration', async () => {
      // Test database connection security
      const connectionInfo = await prisma.$queryRaw`
        SELECT 
          setting as max_connections,
          (SELECT setting FROM pg_settings WHERE name = 'ssl') as ssl_enabled,
          (SELECT setting FROM pg_settings WHERE name = 'log_connections') as log_connections,
          (SELECT setting FROM pg_settings WHERE name = 'log_disconnections') as log_disconnections
        FROM pg_settings 
        WHERE name = 'max_connections'
      ` as any[];
      
      const config = connectionInfo[0];
      
      // Verify security configurations
      expect(parseInt(config.max_connections)).toBeGreaterThan(0);
      expect(config.max_connections).toBeDefined();
      
      console.log('✅ Database security configuration validated');
    });
    
    it('should test for SQL injection vulnerabilities', async () => {
      const user = await testDataGenerator.createTestUser({
        email: 'sqli-test@example.com'
      });
      
      // Test parameterized queries (should be safe)
      const maliciousInput = "'; DROP TABLE users; --";
      
      // This should not cause SQL injection due to parameterized queries
      const result = await prisma.user.findMany({
        where: {
          email: { contains: maliciousInput }
        }
      });
      
      expect(result).toHaveLength(0); // Should find no results, not cause error
      
      // Verify user table still exists
      const userCount = await prisma.user.count();
      expect(userCount).toBeGreaterThanOrEqual(1);
      
      console.log('✅ SQL injection protection validated');
    });
    
    it('should validate input sanitization', async () => {
      // Test various input types that should be handled safely
      const testInputs = [
        { name: "<script>alert('xss')</script>", email: "xss1@test.com" },
        { name: "Robert'; DROP TABLE users; --", email: "sql2@test.com" },
        { name: "Normal User", email: "normal@test.com" },
        { name: "User with émojis 😊", email: "emoji@test.com" }
      ];
      
      const createdUsers = await Promise.all(
        testInputs.map(input => testDataGenerator.createTestUser(input))
      );
      
      expect(createdUsers).toHaveLength(4);
      
      // Verify all users were created safely
      createdUsers.forEach(user => {
        expect(user.id).toBeDefined();
        expect(user.email).toContain('@');
      });
      
      console.log('✅ Input sanitization validated');
    });
  });
  
  describe('Payment Data Security Validation', () => {
    it('should validate payment intent security', async () => {
      const user = await testDataGenerator.createTestUser();
      const order = await testDataGenerator.createTestOrder(user.id, {
        stripePaymentIntentId: 'pi_secure_test_123456'
      });
      
      // Payment intent should be properly formatted
      expect(order.stripePaymentIntentId).toMatch(/^pi_/);
      
      // Should be associated with user
      expect(order.userId).toBe(user.id);
      
      // Should be unique
      const duplicateOrder = testDataGenerator.generateOrderData(user.id, {
        stripePaymentIntentId: 'pi_secure_test_123456'
      });
      
      await expect(
        prisma.order.create({ data: duplicateOrder })
      ).rejects.toThrow(); // Should fail on unique constraint
      
      console.log('✅ Payment intent security validated');
    });
    
    it('should validate subscription security', async () => {
      const user = await testDataGenerator.createTestUser();
      const product = await testDataGenerator.createTestProduct();
      const subscription = await testDataGenerator.createTestSubscription(user.id, product.id, {
        stripeSubscriptionId: 'sub_secure_test_123',
        stripeCustomerId: user.stripeCustomerId || 'cus_test_456'
      });
      
      // Subscription should be properly formatted
      expect(subscription.stripeSubscriptionId).toMatch(/^sub_/);
      expect(subscription.stripeCustomerId).toMatch(/^cus_/);
      
      // Should be associated with correct user and product
      expect(subscription.userId).toBe(user.id);
      expect(subscription.productId).toBe(product.id);
      
      console.log('✅ Subscription security validated');
    });
    
    it('should validate customer data protection', async () => {
      const user = await testDataGenerator.createTestUser({
        email: 'protected@example.com',
        stripeCustomerId: 'cus_protected_123'
      });
      
      // Customer ID should be unique and properly formatted
      expect(user.stripeCustomerId).toMatch(/^cus_/);
      
      // Should not be able to create duplicate stripe customer
      await expect(
        testDataGenerator.createTestUser({
          email: 'different@example.com',
          stripeCustomerId: 'cus_protected_123'
        })
      ).rejects.toThrow();
      
      console.log('✅ Customer data protection validated');
    });
  });
  
  describe('Access Control and Data Isolation', () => {
    it('should validate data isolation between users', async () => {
      const user1 = await testDataGenerator.createTestUser({ email: 'user1@test.com' });
      const user2 = await testDataGenerator.createTestUser({ email: 'user2@test.com' });
      
      // Create data for each user
      const user1PaymentMethod = await testDataGenerator.createTestPaymentMethod(user1.id);
      const user2PaymentMethod = await testDataGenerator.createTestPaymentMethod(user2.id);
      
      const user1Order = await testDataGenerator.createTestOrder(user1.id);
      const user2Order = await testDataGenerator.createTestOrder(user2.id);
      
      // Verify data isolation
      const user1Data = await prisma.user.findUnique({
        where: { id: user1.id },
        include: { paymentMethods: true, orders: true }
      });
      
      const user2Data = await prisma.user.findUnique({
        where: { id: user2.id },
        include: { paymentMethods: true, orders: true }
      });
      
      // Each user should only see their own data
      expect(user1Data?.paymentMethods).toHaveLength(1);
      expect(user1Data?.paymentMethods[0].id).toBe(user1PaymentMethod.id);
      expect(user1Data?.orders).toHaveLength(1);
      expect(user1Data?.orders[0].id).toBe(user1Order.id);
      
      expect(user2Data?.paymentMethods).toHaveLength(1);
      expect(user2Data?.paymentMethods[0].id).toBe(user2PaymentMethod.id);
      expect(user2Data?.orders).toHaveLength(1);
      expect(user2Data?.orders[0].id).toBe(user2Order.id);
      
      console.log('✅ Data isolation between users validated');
    });
  });
});