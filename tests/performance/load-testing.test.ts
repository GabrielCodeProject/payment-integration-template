import { DatabaseTestHelper } from '../setup/jest.setup';
import { TestDataGenerator } from '../fixtures/TestDataGenerator';
import { PerformanceBenchmark } from '../utils/PerformanceBenchmark';
import { PrismaClient } from '@prisma/client';

describe('Database Load Testing', () => {
  let prisma: PrismaClient;
  let testDataGenerator: TestDataGenerator;
  let performanceBenchmark: PerformanceBenchmark;
  
  beforeAll(async () => {
    prisma = await DatabaseTestHelper.getTestDatabase();
    testDataGenerator = new TestDataGenerator(prisma);
    performanceBenchmark = new PerformanceBenchmark(prisma);
    
    // Clean database before load testing
    await testDataGenerator.cleanupTestData();
    
    // Warm up database
    await performanceBenchmark.warmupDatabase();
  });
  
  afterAll(async () => {
    await testDataGenerator.cleanupTestData();
  });
  
  describe('Concurrent User Operations', () => {
    it('should handle concurrent user registrations', async () => {
      const concurrentRegistrations = 50;
      
      const { performance } = await performanceBenchmark.measureQuery(
        'concurrent_user_registrations',
        async () => {
          const registrationPromises = Array.from({ length: concurrentRegistrations }, (_, i) =>
            testDataGenerator.createTestUser({
              email: `loadtest-user-${i}-${Date.now()}@example.com`
            })
          );
          
          return await Promise.all(registrationPromises);
        }
      );
      
      expect(performance.recordsAffected).toBe(concurrentRegistrations);
      expect(performance.executionTime).toBeLessThan(5000); // Should complete within 5 seconds
    });
    
    it('should handle concurrent user authentications', async () => {
      // Create test users first
      const users = await Promise.all(
        Array.from({ length: 20 }, (_, i) =>
          testDataGenerator.createTestUser({
            email: `auth-test-${i}@example.com`
          })
        )
      );
      
      const { performance } = await performanceBenchmark.measureQuery(
        'concurrent_user_authentications',
        async () => {
          const authPromises = users.map(user =>
            prisma.user.findUnique({ where: { email: user.email } })
          );
          
          return await Promise.all(authPromises);
        }
      );
      
      expect(performance.recordsAffected).toBe(users.length);
      expect(performance.executionTime).toBeLessThan(2000); // Should complete within 2 seconds
    });
  });
  
  describe('Concurrent Payment Processing', () => {
    it('should handle concurrent order creation', async () => {
      const user = await testDataGenerator.createTestUser();
      const concurrentOrders = 30;
      
      const { performance } = await performanceBenchmark.measureQuery(
        'concurrent_order_creation',
        async () => {
          const orderPromises = Array.from({ length: concurrentOrders }, (_, i) =>
            testDataGenerator.createTestOrder(user.id, {
              orderNumber: `LOAD-TEST-${i}-${Date.now()}`
            })
          );
          
          return await Promise.all(orderPromises);
        }
      );
      
      expect(performance.recordsAffected).toBe(concurrentOrders);
      expect(performance.executionTime).toBeLessThan(3000); // Should complete within 3 seconds
    });
    
    it('should handle concurrent payment method additions', async () => {
      const user = await testDataGenerator.createTestUser();
      const concurrentPaymentMethods = 10;
      
      const { performance } = await performanceBenchmark.measureQuery(
        'concurrent_payment_method_creation',
        async () => {
          const paymentMethodPromises = Array.from({ length: concurrentPaymentMethods }, (_, i) =>
            testDataGenerator.createTestPaymentMethod(user.id, {
              stripePaymentMethodId: `pm_loadtest_${i}_${Date.now()}`
            })
          );
          
          return await Promise.all(paymentMethodPromises);
        }
      );
      
      expect(performance.recordsAffected).toBe(concurrentPaymentMethods);
      expect(performance.executionTime).toBeLessThan(2000);
    });
    
    it('should handle concurrent subscription operations', async () => {
      const users = await Promise.all(
        Array.from({ length: 5 }, () => testDataGenerator.createTestUser())
      );
      const product = await testDataGenerator.createTestProduct({ type: 'SUBSCRIPTION' });
      
      const { performance } = await performanceBenchmark.measureQuery(
        'concurrent_subscription_creation',
        async () => {
          const subscriptionPromises = users.map(user =>
            testDataGenerator.createTestSubscription(user.id, product.id, {
              stripeSubscriptionId: `sub_loadtest_${user.id}_${Date.now()}`
            })
          );
          
          return await Promise.all(subscriptionPromises);
        }
      );
      
      expect(performance.recordsAffected).toBe(users.length);
      expect(performance.executionTime).toBeLessThan(2000);
    });
  });
  
  describe('High Volume Read Operations', () => {
    beforeAll(async () => {
      // Generate significant test data for read operations
      await testDataGenerator.generateBulkTestData({
        users: 500,
        products: 200,
        orders: 1000,
        subscriptions: 800
      });
    });
    
    it('should handle high volume product catalog queries', async () => {
      const concurrentQueries = 20;
      
      const { performance } = await performanceBenchmark.measureQuery(
        'high_volume_product_queries',
        async () => {
          const queryPromises = Array.from({ length: concurrentQueries }, () =>
            prisma.product.findMany({
              where: { isActive: true },
              orderBy: { createdAt: 'desc' },
              take: 50
            })
          );
          
          return await Promise.all(queryPromises);
        }
      );
      
      expect(performance.executionTime).toBeLessThan(3000);
    });
    
    it('should handle high volume order lookup queries', async () => {
      const concurrentQueries = 15;
      
      const { performance } = await performanceBenchmark.measureQuery(
        'high_volume_order_queries',
        async () => {
          const queryPromises = Array.from({ length: concurrentQueries }, () =>
            prisma.order.findMany({
              include: { user: true, orderItems: true },
              orderBy: { createdAt: 'desc' },
              take: 20
            })
          );
          
          return await Promise.all(queryPromises);
        }
      );
      
      expect(performance.executionTime).toBeLessThan(4000);
    });
    
    it('should handle concurrent user dashboard queries', async () => {
      const users = await prisma.user.findMany({ take: 10 });
      
      const { performance } = await performanceBenchmark.measureQuery(
        'concurrent_dashboard_queries',
        async () => {
          const dashboardPromises = users.map(user =>
            prisma.user.findUnique({
              where: { id: user.id },
              include: {
                orders: { take: 10, orderBy: { createdAt: 'desc' } },
                subscriptions: { where: { status: 'ACTIVE' } },
                paymentMethods: { where: { isActive: true } }
              }
            })
          );
          
          return await Promise.all(dashboardPromises);
        }
      );
      
      expect(performance.executionTime).toBeLessThan(3000);
    });
  });
  
  describe('Complex Transaction Load Testing', () => {
    it('should handle concurrent complex order processing', async () => {
      const users = await Promise.all(
        Array.from({ length: 5 }, () => testDataGenerator.createTestUser())
      );
      const products = await Promise.all(
        Array.from({ length: 10 }, () => testDataGenerator.createTestProduct())
      );
      
      const { performance } = await performanceBenchmark.measureQuery(
        'concurrent_complex_order_processing',
        async () => {
          const complexOrderPromises = users.map(async (user) => {
            return await prisma.$transaction(async (tx) => {
              // Create order
              const order = await tx.order.create({
                data: testDataGenerator.generateOrderData(user.id, {
                  orderNumber: `COMPLEX-${user.id}-${Date.now()}`
                })
              });
              
              // Add order items
              const orderItems = await Promise.all(
                products.slice(0, 3).map((product, index) =>
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
              
              // Update order total
              const newTotal = orderItems.reduce(
                (sum, item) => sum + Number(item.totalPrice), 
                0
              );
              
              const updatedOrder = await tx.order.update({
                where: { id: order.id },
                data: { total: newTotal }
              });
              
              return { order: updatedOrder, orderItems };
            });
          });
          
          return await Promise.all(complexOrderPromises);
        }
      );
      
      expect(performance.recordsAffected).toBe(users.length);
      expect(performance.executionTime).toBeLessThan(5000);
    });
  });
  
  describe('Database Stress Testing', () => {
    it('should maintain performance under sustained read load', async () => {
      const iterations = 10;
      const queriesPerIteration = 20;
      const results: number[] = [];
      
      for (let i = 0; i < iterations; i++) {
        const startTime = performance.now();
        
        const promises = Array.from({ length: queriesPerIteration }, () =>
          prisma.product.findMany({
            where: { isActive: true },
            take: 10
          })
        );
        
        await Promise.all(promises);
        
        const endTime = performance.now();
        results.push(endTime - startTime);
      }
      
      const averageTime = results.reduce((sum, time) => sum + time, 0) / results.length;
      const maxTime = Math.max(...results);
      const minTime = Math.min(...results);
      
      // console.log(`📊 Sustained Load Results:`);
      // console.log(`   Average time: ${averageTime.toFixed(2)}ms`);
      // console.log(`   Min time: ${minTime.toFixed(2)}ms`);
      // console.log(`   Max time: ${maxTime.toFixed(2)}ms`);
      
      expect(averageTime).toBeLessThan(1000); // Average under 1 second
      expect(maxTime).toBeLessThan(2000);     // Max under 2 seconds
    });
    
    it('should handle connection pool exhaustion gracefully', async () => {
      const maxConnections = 50; // Simulate high connection load
      
      const { performance } = await performanceBenchmark.measureQuery(
        'connection_pool_stress_test',
        async () => {
          const connectionPromises = Array.from({ length: maxConnections }, async () => {
            // Each promise simulates a database operation that holds a connection
            return await prisma.user.count();
          });
          
          return await Promise.all(connectionPromises);
        }
      );
      
      expect(performance.executionTime).toBeLessThan(10000); // Should complete within 10 seconds
    });
  });
  
  describe('Scalability Benchmarks', () => {
    it('should measure performance scaling with data size', async () => {
      const dataSizes = [100, 500, 1000, 2000];
      const results: { size: number; time: number; }[] = [];
      
      for (const size of dataSizes) {
        // Clean and generate specific amount of data
        await testDataGenerator.cleanupTestData();
        await testDataGenerator.generateBulkTestData({
          users: size,
          products: Math.floor(size / 2),
          orders: size * 2,
          subscriptions: size
        });
        
        const startTime = performance.now();
        
        // Run standard query set
        await Promise.all([
          prisma.user.findMany({ take: 50 }),
          prisma.product.findMany({ where: { isActive: true }, take: 25 }),
          prisma.order.findMany({ 
            include: { user: true }, 
            take: 30,
            orderBy: { createdAt: 'desc' }
          })
        ]);
        
        const endTime = performance.now();
        results.push({ size, time: endTime - startTime });
      }
      
      // console.log('📈 Scalability Results:');
      results.forEach(({ size, time }) => {
        // console.log(`   ${size} records: ${time.toFixed(2)}ms`);
      });
      
      // Performance should not degrade linearly with data size (good indexing)
      const firstResult = results[0];
      const lastResult = results[results.length - 1];
      const scalabilityRatio = lastResult.time / firstResult.time;
      
      expect(scalabilityRatio).toBeLessThan(5); // Should not be more than 5x slower with 20x data
    });
  });
});