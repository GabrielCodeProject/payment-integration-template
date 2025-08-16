import { DatabaseTestHelper } from '../../setup/jest.setup';
import { TestDataGenerator } from '../../fixtures/TestDataGenerator';
import { PrismaClient } from '@prisma/client';

describe('User Model Tests', () => {
  let prisma: PrismaClient;
  let testDataGenerator: TestDataGenerator;
  
  beforeAll(async () => {
    prisma = await DatabaseTestHelper.getTestDatabase();
    testDataGenerator = new TestDataGenerator(prisma);
  });
  
  beforeEach(async () => {
    await testDataGenerator.cleanupTestData();
  });
  
  describe('User Creation', () => {
    it('should create a user with valid data', async () => {
      const userData = testDataGenerator.generateUserData({
        email: 'test@example.com',
        name: 'Test User',
        role: 'CUSTOMER'
      });
      
      const user = await prisma.user.create({ data: userData });
      
      expect(user).toBeDefined();
      expect(user.email).toBe('test@example.com');
      expect(user.name).toBe('Test User');
      expect(user.role).toBe('CUSTOMER');
      expect(user.id).toBeDefined();
      expect(user.createdAt).toBeDefined();
      expect(user.updatedAt).toBeDefined();
    });
    
    it('should enforce unique email constraint', async () => {
      const email = 'duplicate@example.com';
      
      await testDataGenerator.createTestUser({ email });
      
      await expect(
        testDataGenerator.createTestUser({ email })
      ).rejects.toThrow();
    });
    
    it('should enforce unique stripeCustomerId constraint', async () => {
      const stripeCustomerId = 'cus_duplicate123';
      
      await testDataGenerator.createTestUser({ stripeCustomerId });
      
      await expect(
        testDataGenerator.createTestUser({ stripeCustomerId })
      ).rejects.toThrow();
    });
    
    it('should create user with default values', async () => {
      const user = await testDataGenerator.createTestUser({
        email: 'defaults@example.com'
      });
      
      expect(user.role).toBe('CUSTOMER');
      expect(user.isActive).toBe(true);
      expect(user.twoFactorEnabled).toBe(false);
      expect(user.preferredCurrency).toBe('usd');
      expect(user.timezone).toBe('UTC');
    });
  });
  
  describe('User Queries', () => {
    it('should find user by email using index', async () => {
      const email = 'findme@example.com';
      const createdUser = await testDataGenerator.createTestUser({ email });
      
      const foundUser = await prisma.user.findUnique({
        where: { email }
      });
      
      expect(foundUser).toBeDefined();
      expect(foundUser?.id).toBe(createdUser.id);
    });
    
    it('should find user by stripeCustomerId using index', async () => {
      const stripeCustomerId = 'cus_findme123';
      const createdUser = await testDataGenerator.createTestUser({ stripeCustomerId });
      
      const foundUser = await prisma.user.findUnique({
        where: { stripeCustomerId }
      });
      
      expect(foundUser).toBeDefined();
      expect(foundUser?.id).toBe(createdUser.id);
    });
    
    it('should filter users by role using index', async () => {
      await Promise.all([
        testDataGenerator.createTestUser({ role: 'ADMIN' }),
        testDataGenerator.createTestUser({ role: 'ADMIN' }),
        testDataGenerator.createTestUser({ role: 'CUSTOMER' })
      ]);
      
      const admins = await prisma.user.findMany({
        where: { role: 'ADMIN' }
      });
      
      expect(admins).toHaveLength(2);
      admins.forEach(admin => {
        expect(admin.role).toBe('ADMIN');
      });
    });
    
    it('should sort users by creation date using index', async () => {
      const _users = await Promise.all([
        testDataGenerator.createTestUser({ email: 'first@example.com' }),
        testDataGenerator.createTestUser({ email: 'second@example.com' }),
        testDataGenerator.createTestUser({ email: 'third@example.com' })
      ]);
      
      const sortedUsers = await prisma.user.findMany({
        orderBy: { createdAt: 'desc' }
      });
      
      expect(sortedUsers).toHaveLength(3);
      expect(sortedUsers[0].createdAt.getTime()).toBeGreaterThanOrEqual(
        sortedUsers[1].createdAt.getTime()
      );
    });
  });
  
  describe('User Relations', () => {
    it('should create user with related orders', async () => {
      const user = await testDataGenerator.createTestUser();
      const order = await testDataGenerator.createTestOrder(user.id);
      
      const userWithOrders = await prisma.user.findUnique({
        where: { id: user.id },
        include: { orders: true }
      });
      
      expect(userWithOrders?.orders).toHaveLength(1);
      expect(userWithOrders?.orders[0].id).toBe(order.id);
    });
    
    it('should create user with related subscriptions', async () => {
      const user = await testDataGenerator.createTestUser();
      const product = await testDataGenerator.createTestProduct();
      const subscription = await testDataGenerator.createTestSubscription(user.id, product.id);
      
      const userWithSubscriptions = await prisma.user.findUnique({
        where: { id: user.id },
        include: { subscriptions: true }
      });
      
      expect(userWithSubscriptions?.subscriptions).toHaveLength(1);
      expect(userWithSubscriptions?.subscriptions[0].id).toBe(subscription.id);
    });
    
    it('should create user with related payment methods', async () => {
      const user = await testDataGenerator.createTestUser();
      const paymentMethod = await testDataGenerator.createTestPaymentMethod(user.id);
      
      const userWithPaymentMethods = await prisma.user.findUnique({
        where: { id: user.id },
        include: { paymentMethods: true }
      });
      
      expect(userWithPaymentMethods?.paymentMethods).toHaveLength(1);
      expect(userWithPaymentMethods?.paymentMethods[0].id).toBe(paymentMethod.id);
    });
  });
  
  describe('User Updates', () => {
    it('should update user lastLoginAt timestamp', async () => {
      const user = await testDataGenerator.createTestUser();
      const loginTime = new Date();
      
      const updatedUser = await prisma.user.update({
        where: { id: user.id },
        data: { lastLoginAt: loginTime }
      });
      
      expect(updatedUser.lastLoginAt).toEqual(loginTime);
      expect(updatedUser.updatedAt.getTime()).toBeGreaterThan(user.updatedAt.getTime());
    });
    
    it('should update user preferences', async () => {
      const user = await testDataGenerator.createTestUser();
      
      const updatedUser = await prisma.user.update({
        where: { id: user.id },
        data: {
          preferredCurrency: 'eur',
          timezone: 'Europe/London',
          twoFactorEnabled: true
        }
      });
      
      expect(updatedUser.preferredCurrency).toBe('eur');
      expect(updatedUser.timezone).toBe('Europe/London');
      expect(updatedUser.twoFactorEnabled).toBe(true);
    });
  });
  
  describe('User Deletion', () => {
    it('should cascade delete related records', async () => {
      const user = await testDataGenerator.createTestUser();
      const paymentMethod = await testDataGenerator.createTestPaymentMethod(user.id);
      
      await prisma.user.delete({
        where: { id: user.id }
      });
      
      const deletedPaymentMethod = await prisma.paymentMethod.findUnique({
        where: { id: paymentMethod.id }
      });
      
      expect(deletedPaymentMethod).toBeNull();
    });
  });
});