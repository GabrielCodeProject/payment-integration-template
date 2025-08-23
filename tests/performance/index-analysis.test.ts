import { DatabaseTestHelper } from '../setup/jest.setup';
import { TestDataGenerator } from '../fixtures/TestDataGenerator';
import { PerformanceBenchmark } from '../utils/PerformanceBenchmark';
import { PrismaClient } from '@prisma/client';

describe('Database Index Performance Analysis', () => {
  let prisma: PrismaClient;
  let testDataGenerator: TestDataGenerator;
  let performanceBenchmark: PerformanceBenchmark;
  
  beforeAll(async () => {
    prisma = await DatabaseTestHelper.getTestDatabase();
    testDataGenerator = new TestDataGenerator(prisma);
    performanceBenchmark = new PerformanceBenchmark(prisma);
    
    // Generate test data for performance testing
    // console.log('🔄 Generating performance test data...');
    await testDataGenerator.generateBulkTestData({
      users: 1000,
      products: 500,
      orders: 2000,
      subscriptions: 1500
    });
    
    // Warm up database
    await performanceBenchmark.warmupDatabase();
  });
  
  afterAll(async () => {
    await testDataGenerator.cleanupTestData();
  });
  
  describe('Primary Index Performance', () => {
    it('should efficiently query users by email index', async () => {
      const testEmail = 'performance-test@example.com';
      await testDataGenerator.createTestUser({ email: testEmail });
      
      const { performance } = await performanceBenchmark.measureQuery(
        'user_email_lookup',
        () => prisma.user.findUnique({ where: { email: testEmail } })
      );
      
      expect(performance.executionTime).toBeLessThan(50); // Should be under 50ms
      expect(performance.recordsAffected).toBe(1);
    });
    
    it('should efficiently query users by stripeCustomerId index', async () => {
      const stripeCustomerId = 'cus_performance_test';
      await testDataGenerator.createTestUser({ stripeCustomerId });
      
      const { performance } = await performanceBenchmark.measureQuery(
        'user_stripe_customer_lookup',
        () => prisma.user.findUnique({ where: { stripeCustomerId } })
      );
      
      expect(performance.executionTime).toBeLessThan(50);
      expect(performance.recordsAffected).toBe(1);
    });
    
    it('should efficiently query products by slug index', async () => {
      const slug = 'performance-test-product';
      await testDataGenerator.createTestProduct({ slug });
      
      const { performance } = await performanceBenchmark.measureQuery(
        'product_slug_lookup',
        () => prisma.product.findUnique({ where: { slug } })
      );
      
      expect(performance.executionTime).toBeLessThan(50);
      expect(performance.recordsAffected).toBe(1);
    });
    
    it('should efficiently query orders by orderNumber index', async () => {
      const orderNumber = 'ORD-PERF-TEST-123';
      await testDataGenerator.createTestOrder(undefined, { orderNumber });
      
      const { performance } = await performanceBenchmark.measureQuery(
        'order_number_lookup',
        () => prisma.order.findUnique({ where: { orderNumber } })
      );
      
      expect(performance.executionTime).toBeLessThan(50);
      expect(performance.recordsAffected).toBe(1);
    });
  });
  
  describe('Composite Index Performance', () => {
    it('should efficiently query orders by userId and status composite index', async () => {
      const user = await testDataGenerator.createTestUser();
      await Promise.all([
        testDataGenerator.createTestOrder(user.id, { status: 'PENDING' }),
        testDataGenerator.createTestOrder(user.id, { status: 'PENDING' }),
        testDataGenerator.createTestOrder(user.id, { status: 'COMPLETED' })
      ]);
      
      const { performance } = await performanceBenchmark.measureQuery(
        'orders_by_user_status',
        () => prisma.order.findMany({
          where: { userId: user.id, status: 'PENDING' }
        })
      );
      
      expect(performance.executionTime).toBeLessThan(100);
      expect(performance.recordsAffected).toBe(2);
    });
    
    it('should efficiently query products by isActive and type composite index', async () => {
      await Promise.all([
        testDataGenerator.createTestProduct({ isActive: true, type: 'SUBSCRIPTION' }),
        testDataGenerator.createTestProduct({ isActive: true, type: 'SUBSCRIPTION' }),
        testDataGenerator.createTestProduct({ isActive: false, type: 'SUBSCRIPTION' })
      ]);
      
      const { performance } = await performanceBenchmark.measureQuery(
        'products_by_active_type',
        () => prisma.product.findMany({
          where: { isActive: true, type: 'SUBSCRIPTION' }
        })
      );
      
      expect(performance.executionTime).toBeLessThan(100);
      expect(performance.recordsAffected).toBeGreaterThanOrEqual(2);
    });
    
    it('should efficiently query subscriptions by userId and status composite index', async () => {
      const user = await testDataGenerator.createTestUser();
      const product = await testDataGenerator.createTestProduct();
      
      await Promise.all([
        testDataGenerator.createTestSubscription(user.id, product.id, { status: 'ACTIVE' }),
        testDataGenerator.createTestSubscription(user.id, product.id, { status: 'ACTIVE' }),
        testDataGenerator.createTestSubscription(user.id, product.id, { status: 'CANCELLED' })
      ]);
      
      const { performance } = await performanceBenchmark.measureQuery(
        'subscriptions_by_user_status',
        () => prisma.subscription.findMany({
          where: { userId: user.id, status: 'ACTIVE' }
        })
      );
      
      expect(performance.executionTime).toBeLessThan(100);
      expect(performance.recordsAffected).toBe(2);
    });
    
    it('should efficiently query payment methods by userId and isDefault composite index', async () => {
      const user = await testDataGenerator.createTestUser();
      
      await Promise.all([
        testDataGenerator.createTestPaymentMethod(user.id, { isDefault: true }),
        testDataGenerator.createTestPaymentMethod(user.id, { isDefault: false }),
        testDataGenerator.createTestPaymentMethod(user.id, { isDefault: false })
      ]);
      
      const { performance } = await performanceBenchmark.measureQuery(
        'payment_methods_by_user_default',
        () => prisma.paymentMethod.findMany({
          where: { userId: user.id, isDefault: true }
        })
      );
      
      expect(performance.executionTime).toBeLessThan(100);
      expect(performance.recordsAffected).toBe(1);
    });
  });
  
  describe('Range Query Performance', () => {
    it('should efficiently query orders by date range using createdAt index', async () => {
      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-12-31');
      
      const { performance } = await performanceBenchmark.measureQuery(
        'orders_by_date_range',
        () => prisma.order.findMany({
          where: {
            createdAt: {
              gte: startDate,
              lte: endDate
            }
          },
          orderBy: { createdAt: 'desc' },
          take: 100
        })
      );
      
      expect(performance.executionTime).toBeLessThan(200);
    });
    
    it('should efficiently query subscriptions by currentPeriodEnd for billing', async () => {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() + 7); // Next 7 days
      
      const { performance } = await performanceBenchmark.measureQuery(
        'subscriptions_billing_due',
        () => prisma.subscription.findMany({
          where: {
            status: 'ACTIVE',
            currentPeriodEnd: {
              lte: cutoffDate
            }
          }
        })
      );
      
      expect(performance.executionTime).toBeLessThan(200);
    });
    
    it('should efficiently query discount codes by expiration', async () => {
      const now = new Date();
      
      const { performance } = await performanceBenchmark.measureQuery(
        'active_discount_codes',
        () => prisma.discountCode.findMany({
          where: {
            isActive: true,
            OR: [
              { expiresAt: null },
              { expiresAt: { gt: now } }
            ]
          }
        })
      );
      
      expect(performance.executionTime).toBeLessThan(200);
    });
  });
  
  describe('Join Performance', () => {
    it('should efficiently query orders with user joins', async () => {
      const { performance } = await performanceBenchmark.measureQuery(
        'orders_with_user_join',
        () => prisma.order.findMany({
          include: { user: true },
          take: 50
        })
      );
      
      expect(performance.executionTime).toBeLessThan(300);
    });
    
    it('should efficiently query orders with order items joins', async () => {
      const { performance } = await performanceBenchmark.measureQuery(
        'orders_with_items_join',
        () => prisma.order.findMany({
          include: { 
            orderItems: {
              include: { product: true }
            }
          },
          take: 20
        })
      );
      
      expect(performance.executionTime).toBeLessThan(400);
    });
    
    it('should efficiently query users with all relations', async () => {
      const { performance } = await performanceBenchmark.measureQuery(
        'users_with_all_relations',
        () => prisma.user.findMany({
          include: {
            orders: true,
            subscriptions: true,
            paymentMethods: true
          },
          take: 10
        })
      );
      
      expect(performance.executionTime).toBeLessThan(500);
    });
  });
  
  describe('Aggregation Performance', () => {
    it('should efficiently count records with indexes', async () => {
      const { performance } = await performanceBenchmark.measureQuery(
        'count_active_users',
        () => prisma.user.count({ where: { isActive: true } })
      );
      
      expect(performance.executionTime).toBeLessThan(100);
    });
    
    it('should efficiently aggregate order totals', async () => {
      const { performance } = await performanceBenchmark.measureQuery(
        'aggregate_order_totals',
        () => prisma.order.aggregate({
          _sum: { total: true },
          _avg: { total: true },
          _count: true,
          where: { status: 'PAID' }
        })
      );
      
      expect(performance.executionTime).toBeLessThan(200);
    });
    
    it('should efficiently group by with indexes', async () => {
      const { performance } = await performanceBenchmark.measureQuery(
        'orders_by_status_grouping',
        () => prisma.order.groupBy({
          by: ['status'],
          _count: { status: true },
          _sum: { total: true }
        })
      );
      
      expect(performance.executionTime).toBeLessThan(200);
    });
  });
  
  describe('Full Text Search Performance', () => {
    it('should efficiently search products by name and description', async () => {
      const { performance } = await performanceBenchmark.measureQuery(
        'product_text_search',
        () => prisma.product.findMany({
          where: {
            OR: [
              { name: { contains: 'test', mode: 'insensitive' } },
              { description: { contains: 'test', mode: 'insensitive' } }
            ],
            isActive: true
          },
          take: 20
        })
      );
      
      expect(performance.executionTime).toBeLessThan(300);
    });
  });
  
  describe('Index Usage Analysis', () => {
    it('should show high index usage efficiency', async () => {
      const indexStats = await performanceBenchmark.benchmarkIndexUsage();
      
      expect(indexStats.indexEfficiency).toBeGreaterThan(80); // 80% index usage
      expect(indexStats.indexScans).toBeGreaterThan(indexStats.seqScans);
    });
    
    it('should validate connection pool performance', async () => {
      const connectionStats = await performanceBenchmark.benchmarkConnectionPool();
      
      expect(connectionStats.connectionUtilization).toBeLessThan(80); // Under 80% utilization
      expect(connectionStats.activeConnections).toBeGreaterThan(0);
      expect(connectionStats.totalConnections).toBeLessThan(connectionStats.maxConnections);
    });
  });
  
  describe('Performance Report Generation', () => {
    it('should generate comprehensive performance report', async () => {
      const report = await performanceBenchmark.generatePerformanceReport();
      
      expect(report.summary.totalQueries).toBeGreaterThan(0);
      expect(report.summary.averageExecutionTime).toBeLessThan(1000); // Under 1 second average
      expect(report.indexEfficiency.efficiency).toBeGreaterThan(70);
      expect(report.connectionStats.utilization).toBeLessThan(90);
      
      // Log the report for manual inspection
      // console.log('📊 Performance Report Summary:');
      // console.log(`   Total queries: ${report.summary.totalQueries}`);
      // console.log(`   Average execution time: ${report.summary.averageExecutionTime.toFixed(2)}ms`);
      // console.log(`   Index efficiency: ${report.indexEfficiency.efficiency.toFixed(2)}%`);
      // console.log(`   Connection utilization: ${report.connectionStats.utilization.toFixed(2)}%`);
    });
  });
});