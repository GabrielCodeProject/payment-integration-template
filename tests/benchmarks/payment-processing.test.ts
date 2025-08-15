import { DatabaseTestHelper } from '../setup/jest.setup';
import { TestDataGenerator } from '../fixtures/TestDataGenerator';
import { PerformanceBenchmark } from '../utils/PerformanceBenchmark';
import { PrismaClient } from '@prisma/client';

describe('Payment Processing Benchmarks', () => {
  let prisma: PrismaClient;
  let testDataGenerator: TestDataGenerator;
  let performanceBenchmark: PerformanceBenchmark;
  
  beforeAll(async () => {
    prisma = await DatabaseTestHelper.getTestDatabase();
    testDataGenerator = new TestDataGenerator(prisma);
    performanceBenchmark = new PerformanceBenchmark(prisma);
    
    // Generate realistic test data for payment processing
    await testDataGenerator.generateBulkTestData({
      users: 1000,
      products: 200,
      orders: 500,
      subscriptions: 300
    });
    
    await performanceBenchmark.warmupDatabase();
  });
  
  afterAll(async () => {
    await testDataGenerator.cleanupTestData();
  });
  
  describe('Stripe Payment Processing Benchmarks', () => {
    it('should benchmark payment intent creation workflow', async () => {
      const benchmarkResults = await performanceBenchmark.runBenchmarkSuite({
        'create_payment_intent_order': async () => {
          const user = await testDataGenerator.createTestUser();
          const order = await testDataGenerator.createTestOrder(user.id, {
            stripePaymentIntentId: `pi_benchmark_${Date.now()}`,
            status: 'PENDING',
            paymentStatus: 'PENDING'
          });
          
          // Simulate payment intent update
          await prisma.order.update({
            where: { id: order.id },
            data: { 
              paymentStatus: 'AUTHORIZED',
              status: 'CONFIRMED'
            }
          });
        },
        
        'lookup_payment_intent': async () => {
          const orders = await prisma.order.findMany({ take: 10 });
          const randomOrder = orders[Math.floor(Math.random() * orders.length)];
          
          if (randomOrder?.stripePaymentIntentId) {
            await prisma.order.findUnique({
              where: { stripePaymentIntentId: randomOrder.stripePaymentIntentId }
            });
          }
        },
        
        'payment_completion_workflow': async () => {
          const pendingOrder = await prisma.order.findFirst({
            where: { paymentStatus: 'PENDING' }
          });
          
          if (pendingOrder) {
            await prisma.order.update({
              where: { id: pendingOrder.id },
              data: {
                paymentStatus: 'PAID',
                status: 'PROCESSING',
                paidAt: new Date()
              }
            });
          }
        }
      });
      
      // Verify benchmark results meet performance requirements
      const paymentIntentCreation = benchmarkResults.find(r => r.name === 'create_payment_intent_order');
      const paymentLookup = benchmarkResults.find(r => r.name === 'lookup_payment_intent');
      const paymentCompletion = benchmarkResults.find(r => r.name === 'payment_completion_workflow');
      
      expect(paymentIntentCreation?.opsPerSecond).toBeGreaterThan(10); // At least 10 ops/sec
      expect(paymentLookup?.opsPerSecond).toBeGreaterThan(100);        // At least 100 ops/sec
      expect(paymentCompletion?.opsPerSecond).toBeGreaterThan(50);     // At least 50 ops/sec
      
      console.log('💳 Payment Processing Benchmark Results:');
      benchmarkResults.forEach(result => {
        console.log(`   ${result.name}: ${result.opsPerSecond.toFixed(2)} ops/sec`);
      });
    });
    
    it('should benchmark customer lookup operations', async () => {
      const benchmarkResults = await performanceBenchmark.runBenchmarkSuite({
        'lookup_by_stripe_customer_id': async () => {
          const users = await prisma.user.findMany({ 
            where: { stripeCustomerId: { not: null } },
            take: 10 
          });
          const randomUser = users[Math.floor(Math.random() * users.length)];
          
          if (randomUser?.stripeCustomerId) {
            await prisma.user.findUnique({
              where: { stripeCustomerId: randomUser.stripeCustomerId }
            });
          }
        },
        
        'lookup_customer_with_payment_methods': async () => {
          const users = await prisma.user.findMany({ take: 10 });
          const randomUser = users[Math.floor(Math.random() * users.length)];
          
          await prisma.user.findUnique({
            where: { id: randomUser.id },
            include: { paymentMethods: { where: { isActive: true } } }
          });
        },
        
        'lookup_customer_orders': async () => {
          const users = await prisma.user.findMany({ take: 10 });
          const randomUser = users[Math.floor(Math.random() * users.length)];
          
          await prisma.order.findMany({
            where: { userId: randomUser.id },
            orderBy: { createdAt: 'desc' },
            take: 20
          });
        }
      });
      
      const stripeCustomerLookup = benchmarkResults.find(r => r.name === 'lookup_by_stripe_customer_id');
      const customerWithPaymentMethods = benchmarkResults.find(r => r.name === 'lookup_customer_with_payment_methods');
      const customerOrders = benchmarkResults.find(r => r.name === 'lookup_customer_orders');
      
      expect(stripeCustomerLookup?.opsPerSecond).toBeGreaterThan(200);
      expect(customerWithPaymentMethods?.opsPerSecond).toBeGreaterThan(100);
      expect(customerOrders?.opsPerSecond).toBeGreaterThan(150);
    });
  });
  
  describe('Subscription Processing Benchmarks', () => {
    it('should benchmark subscription management operations', async () => {
      const benchmarkResults = await performanceBenchmark.runBenchmarkSuite({
        'create_subscription': async () => {
          const users = await prisma.user.findMany({ take: 10 });
          const products = await prisma.product.findMany({ 
            where: { type: 'SUBSCRIPTION' },
            take: 5 
          });
          
          if (users.length > 0 && products.length > 0) {
            const randomUser = users[Math.floor(Math.random() * users.length)];
            const randomProduct = products[Math.floor(Math.random() * products.length)];
            
            await testDataGenerator.createTestSubscription(randomUser.id, randomProduct.id, {
              stripeSubscriptionId: `sub_benchmark_${Date.now()}_${Math.random()}`
            });
          }
        },
        
        'lookup_active_subscriptions': async () => {
          await prisma.subscription.findMany({
            where: { status: 'ACTIVE' },
            include: { user: true, product: true },
            take: 50
          });
        },
        
        'billing_cycle_query': async () => {
          const cutoffDate = new Date();
          cutoffDate.setDate(cutoffDate.getDate() + 7);
          
          await prisma.subscription.findMany({
            where: {
              status: 'ACTIVE',
              currentPeriodEnd: { lte: cutoffDate }
            },
            include: { user: true }
          });
        },
        
        'subscription_analytics': async () => {
          await prisma.subscription.groupBy({
            by: ['status'],
            _count: { status: true },
            _sum: { unitPrice: true }
          });
        }
      });
      
      const subscriptionCreation = benchmarkResults.find(r => r.name === 'create_subscription');
      const activeLookup = benchmarkResults.find(r => r.name === 'lookup_active_subscriptions');
      const billingCycle = benchmarkResults.find(r => r.name === 'billing_cycle_query');
      const analytics = benchmarkResults.find(r => r.name === 'subscription_analytics');
      
      expect(subscriptionCreation?.opsPerSecond).toBeGreaterThan(20);
      expect(activeLookup?.opsPerSecond).toBeGreaterThan(50);
      expect(billingCycle?.opsPerSecond).toBeGreaterThan(100);
      expect(analytics?.opsPerSecond).toBeGreaterThan(30);
    });
  });
  
  describe('Order Processing Benchmarks', () => {
    it('should benchmark order workflow operations', async () => {
      const benchmarkResults = await performanceBenchmark.runBenchmarkSuite({
        'create_order_with_items': async () => {
          const users = await prisma.user.findMany({ take: 10 });
          const products = await prisma.product.findMany({ take: 10 });
          
          if (users.length > 0 && products.length > 0) {
            const randomUser = users[Math.floor(Math.random() * users.length)];
            const randomProducts = products.slice(0, 3);
            
            await prisma.$transaction(async (tx) => {
              const order = await tx.order.create({
                data: testDataGenerator.generateOrderData(randomUser.id, {
                  orderNumber: `BENCH-${Date.now()}-${Math.random().toString(36).slice(2)}`
                })
              });
              
              await Promise.all(
                randomProducts.map((product, index) =>
                  tx.orderItem.create({
                    data: {
                      orderId: order.id,
                      productId: product.id,
                      productName: product.name,
                      productSku: product.sku,
                      unitPrice: product.price,
                      quantity: index + 1,
                      totalPrice: product.price * (index + 1)
                    }
                  })
                )
              );
            });
          }
        },
        
        'order_status_updates': async () => {
          const pendingOrders = await prisma.order.findMany({
            where: { status: 'PENDING' },
            take: 1
          });
          
          if (pendingOrders.length > 0) {
            await prisma.order.update({
              where: { id: pendingOrders[0].id },
              data: { 
                status: 'PROCESSING',
                updatedAt: new Date()
              }
            });
          }
        },
        
        'order_search_by_email': async () => {
          const users = await prisma.user.findMany({ take: 10 });
          const randomUser = users[Math.floor(Math.random() * users.length)];
          
          await prisma.order.findMany({
            where: { customerEmail: randomUser.email },
            include: { orderItems: true },
            orderBy: { createdAt: 'desc' },
            take: 10
          });
        },
        
        'order_fulfillment_query': async () => {
          await prisma.order.findMany({
            where: {
              paymentStatus: 'PAID',
              fulfillmentStatus: 'UNFULFILLED'
            },
            include: { orderItems: { include: { product: true } } },
            take: 20
          });
        }
      });
      
      const orderCreation = benchmarkResults.find(r => r.name === 'create_order_with_items');
      const statusUpdates = benchmarkResults.find(r => r.name === 'order_status_updates');
      const emailSearch = benchmarkResults.find(r => r.name === 'order_search_by_email');
      const fulfillmentQuery = benchmarkResults.find(r => r.name === 'order_fulfillment_query');
      
      expect(orderCreation?.opsPerSecond).toBeGreaterThan(10);
      expect(statusUpdates?.opsPerSecond).toBeGreaterThan(100);
      expect(emailSearch?.opsPerSecond).toBeGreaterThan(50);
      expect(fulfillmentQuery?.opsPerSecond).toBeGreaterThan(30);
    });
  });
  
  describe('Payment Method Management Benchmarks', () => {
    it('should benchmark payment method operations', async () => {
      const benchmarkResults = await performanceBenchmark.runBenchmarkSuite({
        'add_payment_method': async () => {
          const users = await prisma.user.findMany({ take: 10 });
          const randomUser = users[Math.floor(Math.random() * users.length)];
          
          await testDataGenerator.createTestPaymentMethod(randomUser.id, {
            stripePaymentMethodId: `pm_benchmark_${Date.now()}_${Math.random()}`
          });
        },
        
        'set_default_payment_method': async () => {
          const paymentMethods = await prisma.paymentMethod.findMany({
            where: { isDefault: false },
            take: 1
          });
          
          if (paymentMethods.length > 0) {
            const pm = paymentMethods[0];
            
            await prisma.$transaction(async (tx) => {
              // Remove default from other payment methods
              await tx.paymentMethod.updateMany({
                where: { userId: pm.userId, isDefault: true },
                data: { isDefault: false }
              });
              
              // Set new default
              await tx.paymentMethod.update({
                where: { id: pm.id },
                data: { isDefault: true }
              });
            });
          }
        },
        
        'lookup_user_payment_methods': async () => {
          const users = await prisma.user.findMany({ take: 10 });
          const randomUser = users[Math.floor(Math.random() * users.length)];
          
          await prisma.paymentMethod.findMany({
            where: { 
              userId: randomUser.id,
              isActive: true 
            },
            orderBy: { isDefault: 'desc' }
          });
        }
      });
      
      const addPaymentMethod = benchmarkResults.find(r => r.name === 'add_payment_method');
      const setDefault = benchmarkResults.find(r => r.name === 'set_default_payment_method');
      const lookupMethods = benchmarkResults.find(r => r.name === 'lookup_user_payment_methods');
      
      expect(addPaymentMethod?.opsPerSecond).toBeGreaterThan(30);
      expect(setDefault?.opsPerSecond).toBeGreaterThan(20);
      expect(lookupMethods?.opsPerSecond).toBeGreaterThan(200);
    });
  });
  
  describe('Analytics and Reporting Benchmarks', () => {
    it('should benchmark payment analytics queries', async () => {
      const benchmarkResults = await performanceBenchmark.runBenchmarkSuite({
        'revenue_by_period': async () => {
          const startDate = new Date();
          startDate.setMonth(startDate.getMonth() - 1);
          
          await prisma.order.aggregate({
            where: {
              paymentStatus: 'PAID',
              paidAt: { gte: startDate }
            },
            _sum: { total: true },
            _count: true,
            _avg: { total: true }
          });
        },
        
        'subscription_mrr_calculation': async () => {
          await prisma.subscription.aggregate({
            where: { status: 'ACTIVE' },
            _sum: { unitPrice: true },
            _count: true
          });
        },
        
        'top_products_by_revenue': async () => {
          await prisma.orderItem.groupBy({
            by: ['productId'],
            _sum: { totalPrice: true },
            _count: { productId: true },
            orderBy: { _sum: { totalPrice: 'desc' } },
            take: 10
          });
        },
        
        'customer_lifetime_value': async () => {
          await prisma.order.groupBy({
            by: ['userId'],
            where: { 
              paymentStatus: 'PAID',
              userId: { not: null }
            },
            _sum: { total: true },
            _count: true,
            orderBy: { _sum: { total: 'desc' } },
            take: 100
          });
        }
      });
      
      const revenue = benchmarkResults.find(r => r.name === 'revenue_by_period');
      const mrr = benchmarkResults.find(r => r.name === 'subscription_mrr_calculation');
      const topProducts = benchmarkResults.find(r => r.name === 'top_products_by_revenue');
      const clv = benchmarkResults.find(r => r.name === 'customer_lifetime_value');
      
      expect(revenue?.opsPerSecond).toBeGreaterThan(20);
      expect(mrr?.opsPerSecond).toBeGreaterThan(50);
      expect(topProducts?.opsPerSecond).toBeGreaterThan(10);
      expect(clv?.opsPerSecond).toBeGreaterThan(5);
    });
  });
  
  describe('Comprehensive Performance Report', () => {
    it('should generate detailed payment processing performance report', async () => {
      const report = await performanceBenchmark.generatePerformanceReport();
      
      console.log('📊 Payment Processing Performance Report:');
      console.log('='.repeat(50));
      console.log(`Total Queries Executed: ${report.summary.totalQueries}`);
      console.log(`Average Execution Time: ${report.summary.averageExecutionTime.toFixed(2)}ms`);
      console.log(`Fastest Query: ${report.summary.fastestQuery?.operation} (${report.summary.fastestQuery?.executionTime.toFixed(2)}ms)`);
      console.log(`Slowest Query: ${report.summary.slowestQuery?.operation} (${report.summary.slowestQuery?.executionTime.toFixed(2)}ms)`);
      console.log('');
      console.log('Index Efficiency:');
      console.log(`  Index Scans: ${report.indexEfficiency.indexScans}`);
      console.log(`  Sequential Scans: ${report.indexEfficiency.seqScans}`);
      console.log(`  Index Efficiency: ${report.indexEfficiency.efficiency.toFixed(2)}%`);
      console.log('');
      console.log('Connection Pool Status:');
      console.log(`  Active Connections: ${report.connectionStats.activeConnections}`);
      console.log(`  Total Connections: ${report.connectionStats.totalConnections}`);
      console.log(`  Max Connections: ${report.connectionStats.maxConnections}`);
      console.log(`  Utilization: ${report.connectionStats.utilization.toFixed(2)}%`);
      
      // Performance assertions
      expect(report.summary.averageExecutionTime).toBeLessThan(500);
      expect(report.indexEfficiency.efficiency).toBeGreaterThan(70);
      expect(report.connectionStats.utilization).toBeLessThan(80);
    });
  });
});