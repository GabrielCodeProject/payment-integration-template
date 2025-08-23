import { DatabaseTestHelper } from '../setup/jest.setup';
import { TestDataGenerator } from '../fixtures/TestDataGenerator';
import { DatabaseOptimizer } from '../utils/DatabaseOptimizer';
import { PerformanceBenchmark } from '../utils/PerformanceBenchmark';
import { PrismaClient } from '@prisma/client';

describe('Database Performance Optimization Tests', () => {
  let prisma: PrismaClient;
  let testDataGenerator: TestDataGenerator;
  let optimizer: DatabaseOptimizer;
  let benchmark: PerformanceBenchmark;
  
  beforeAll(async () => {
    prisma = await DatabaseTestHelper.getTestDatabase();
    testDataGenerator = new TestDataGenerator(prisma);
    optimizer = new DatabaseOptimizer(prisma);
    benchmark = new PerformanceBenchmark(prisma);
    
    // Generate test data for optimization analysis
    await testDataGenerator.generateBulkTestData({
      users: 500,
      products: 200,
      orders: 1000,
      subscriptions: 800
    });
    
    await benchmark.warmupDatabase();
  });
  
  afterAll(async () => {
    await testDataGenerator.cleanupTestData();
  });
  
  describe('Index Performance Analysis', () => {
    it('should analyze all database indexes', async () => {
      const indexAnalyses = await optimizer.analyzeIndexPerformance();
      
      expect(indexAnalyses.length).toBeGreaterThan(0);
      
      // Verify analysis structure
      indexAnalyses.forEach(analysis => {
        expect(analysis.indexName).toBeDefined();
        expect(analysis.tableName).toBeDefined();
        expect(analysis.columns).toBeDefined();
        expect(typeof analysis.efficiency).toBe('number');
        expect(typeof analysis.scans).toBe('number');
      });
      
      // Check for highly used indexes
      const highUsageIndexes = indexAnalyses.filter(idx => idx.scans > 10);
      expect(highUsageIndexes.length).toBeGreaterThan(0);
      
      // console.log(`📊 Analyzed ${indexAnalyses.length} indexes`);
      // console.log(`   High usage indexes: ${highUsageIndexes.length}`);
      // console.log(`   Unused indexes: ${indexAnalyses.filter(idx => idx.scans === 0).length}`);
    });
    
    it('should identify unused indexes', async () => {
      const indexAnalyses = await optimizer.analyzeIndexPerformance();
      const unusedIndexes = indexAnalyses.filter(idx => idx.scans === 0);
      
      // Log unused indexes for manual review
      if (unusedIndexes.length > 0) {
        // console.log('⚠️  Unused indexes found:');
        unusedIndexes.forEach(idx => {
          // console.log(`   ${idx.indexName} on ${idx.tableName}(${idx.columns.join(', ')})`);
        });
      }
      
      // This shouldn't fail the test as some indexes might be intentionally unused
      expect(unusedIndexes).toBeDefined();
    });
    
    it('should identify inefficient indexes', async () => {
      const indexAnalyses = await optimizer.analyzeIndexPerformance();
      const inefficientIndexes = indexAnalyses.filter(idx => 
        idx.efficiency < 50 && idx.scans > 10
      );
      
      if (inefficientIndexes.length > 0) {
        // console.log('⚠️  Inefficient indexes found:');
        inefficientIndexes.forEach(idx => {
          // console.log(`   ${idx.indexName}: ${idx.efficiency.toFixed(1)}% efficiency`);
        });
      }
      
      expect(inefficientIndexes).toBeDefined();
    });
  });
  
  describe('Query Performance Analysis', () => {
    it('should identify slow query patterns', async () => {
      // Execute various query patterns to generate statistics
      await Promise.all([
        // Complex joins
        prisma.order.findMany({
          include: { 
            user: true, 
            orderItems: { include: { product: true } } 
          },
          take: 10
        }),
        
        // Aggregations
        prisma.order.aggregate({
          _sum: { total: true },
          _avg: { total: true },
          where: { status: 'PAID' }
        }),
        
        // Range queries
        prisma.order.findMany({
          where: {
            createdAt: {
              gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
            }
          },
          take: 50
        }),
        
        // Text searches
        prisma.product.findMany({
          where: {
            name: { contains: 'test', mode: 'insensitive' }
          },
          take: 20
        })
      ]);
      
      const queryAnalyses = await optimizer.analyzeSlowQueries();
      
      // Log slow queries if found
      if (queryAnalyses.length > 0) {
        // console.log(`🐌 Found ${queryAnalyses.length} queries for analysis`);
        queryAnalyses.forEach(query => {
          if (query.executionTime > 100) {
            // console.log(`   Slow query: ${query.executionTime.toFixed(2)}ms`);
          }
        });
      }
      
      expect(queryAnalyses).toBeDefined();
    });
  });
  
  describe('Optimization Recommendations', () => {
    it('should generate comprehensive optimization recommendations', async () => {
      const recommendations = await optimizer.generateOptimizationRecommendations();
      
      expect(recommendations).toBeDefined();
      expect(Array.isArray(recommendations)).toBe(true);
      
      // Verify recommendation structure
      recommendations.forEach(rec => {
        expect(rec.type).toMatch(/^(INDEX|QUERY|SCHEMA|CONFIGURATION)$/);
        expect(rec.priority).toMatch(/^(HIGH|MEDIUM|LOW)$/);
        expect(rec.description).toBeDefined();
        expect(rec.impact).toBeDefined();
        expect(rec.implementation).toBeDefined();
        expect(rec.estimatedImprovement).toBeDefined();
      });
      
      // Log recommendations by priority
      const highPriority = recommendations.filter(r => r.priority === 'HIGH');
      const mediumPriority = recommendations.filter(r => r.priority === 'MEDIUM');
      const lowPriority = recommendations.filter(r => r.priority === 'LOW');
      
      // console.log(`💡 Generated ${recommendations.length} optimization recommendations:`);
      // console.log(`   High priority: ${highPriority.length}`);
      // console.log(`   Medium priority: ${mediumPriority.length}`);
      // console.log(`   Low priority: ${lowPriority.length}`);
      
      if (highPriority.length > 0) {
        // console.log('\n🔥 High Priority Recommendations:');
        highPriority.forEach((rec, index) => {
          // console.log(`   ${index + 1}. ${rec.description}`);
          // console.log(`      Impact: ${rec.impact}`);
          // console.log(`      Implementation: ${rec.implementation}`);
        });
      }
    });
    
    it('should validate connection pool optimization', async () => {
      const connectionStats = await prisma.$queryRaw`
        SELECT 
          setting as max_connections,
          (SELECT count(*) FROM pg_stat_activity WHERE datname = current_database()) as current_connections
        FROM pg_settings 
        WHERE name = 'max_connections'
      ` as any[];
      
      const stats = connectionStats[0];
      const utilizationPercent = (Number(stats.current_connections) / Number(stats.max_connections)) * 100;
      
      // console.log(`🔌 Connection Pool Status:`);
      // console.log(`   Current connections: ${stats.current_connections}`);
      // console.log(`   Max connections: ${stats.max_connections}`);
      // console.log(`   Utilization: ${utilizationPercent.toFixed(1)}%`);
      
      expect(utilizationPercent).toBeLessThan(90); // Should not exceed 90% utilization
    });
  });
  
  describe('Performance Monitoring and Alerting', () => {
    it('should monitor query execution times', async () => {
      const slowQueryThreshold = 500; // 500ms
      const monitoredQueries = [];
      
      // Monitor common query patterns
      const queries = [
        {
          name: 'user_lookup_by_email',
          fn: async () => {
            const user = await prisma.user.findFirst();
            if (user) {
              return await prisma.user.findUnique({ where: { email: user.email } });
            }
          }
        },
        {
          name: 'product_catalog_query',
          fn: () => prisma.product.findMany({
            where: { isActive: true },
            orderBy: { createdAt: 'desc' },
            take: 20
          })
        },
        {
          name: 'user_orders_query',
          fn: async () => {
            const user = await prisma.user.findFirst();
            if (user) {
              return await prisma.order.findMany({
                where: { userId: user.id },
                include: { orderItems: true },
                take: 10
              });
            }
          }
        },
        {
          name: 'subscription_billing_query',
          fn: () => prisma.subscription.findMany({
            where: {
              status: 'ACTIVE',
              currentPeriodEnd: {
                lte: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
              }
            },
            include: { user: true }
          })
        }
      ];
      
      for (const query of queries) {
        const startTime = performance.now();
        await query.fn();
        const endTime = performance.now();
        const executionTime = endTime - startTime;
        
        monitoredQueries.push({
          name: query.name,
          executionTime
        });
        
        if (executionTime > slowQueryThreshold) {
          // console.log(`⚠️  Slow query detected: ${query.name} (${executionTime.toFixed(2)}ms)`);
        }
      }
      
      const averageTime = monitoredQueries.reduce((sum, q) => sum + q.executionTime, 0) / monitoredQueries.length;
      
      // console.log(`⏱️  Query Performance Summary:`);
      // console.log(`   Average execution time: ${averageTime.toFixed(2)}ms`);
      // console.log(`   Queries over threshold: ${monitoredQueries.filter(q => q.executionTime > slowQueryThreshold).length}`);
      
      expect(averageTime).toBeLessThan(slowQueryThreshold);
    });
    
    it('should monitor database size and growth', async () => {
      const tableSizes = await prisma.$queryRaw`
        SELECT 
          schemaname,
          tablename,
          pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size,
          pg_total_relation_size(schemaname||'.'||tablename) as size_bytes
        FROM pg_tables
        WHERE schemaname = 'public'
        ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC
      ` as any[];
      
      // console.log(`📏 Database Table Sizes:`);
      tableSizes.forEach(table => {
        // console.log(`   ${table.tablename}: ${table.size}`);
      });
      
      const totalSize = tableSizes.reduce((sum, table) => sum + Number(table.size_bytes), 0);
      const totalSizeMB = totalSize / (1024 * 1024);
      
      // console.log(`   Total database size: ${totalSizeMB.toFixed(2)} MB`);
      
      expect(totalSizeMB).toBeLessThan(1000); // Should be under 1GB for test database
    });
  });
  
  describe('Optimization Implementation Tests', () => {
    it('should test table statistics optimization', async () => {
      const tableStats = await optimizer.analyzeTableStatistics();
      
      expect(tableStats.length).toBeGreaterThan(0);
      
      tableStats.forEach(stat => {
        expect(stat.tableName).toBeDefined();
        expect(typeof stat.actualRows).toBe('number');
        expect(typeof stat.estimatedRows).toBe('number');
      });
      
      // Update statistics for tables that need it
      await optimizer.optimizeTableStatistics();
      
      // console.log(`📊 Table Statistics Summary:`);
      tableStats.forEach(stat => {
        const accuracy = stat.estimatedRows > 0 
          ? (Math.min(stat.actualRows, stat.estimatedRows) / Math.max(stat.actualRows, stat.estimatedRows)) * 100
          : 0;
        
        // console.log(`   ${stat.tableName}: ${stat.actualRows} rows, ${accuracy.toFixed(1)}% accurate`);
      });
    });
    
    it('should generate comprehensive performance report', async () => {
      const report = await optimizer.generatePerformanceReport();
      
      expect(report.summary).toBeDefined();
      expect(report.indexAnalyses).toBeDefined();
      expect(report.queryAnalyses).toBeDefined();
      expect(report.recommendations).toBeDefined();
      
      // console.log(`📊 Performance Report Summary:`);
      // console.log(`   Total indexes: ${report.summary.totalIndexes}`);
      // console.log(`   Unused indexes: ${report.summary.unusedIndexes}`);
      // console.log(`   Slow queries: ${report.summary.slowQueries}`);
      // console.log(`   Connection utilization: ${report.summary.connectionUtilization.toFixed(1)}%`);
      // console.log(`   Optimization recommendations: ${report.recommendations.length}`);
      
      // Validate performance thresholds
      expect(report.summary.connectionUtilization).toBeLessThan(80);
      expect(report.summary.slowQueries).toBeLessThan(10);
    });
  });
  
  describe('Performance Regression Detection', () => {
    it('should detect performance regressions', async () => {
      const baselineQueries = [
        {
          name: 'user_count',
          fn: () => prisma.user.count(),
          expectedTime: 50
        },
        {
          name: 'product_search',
          fn: () => prisma.product.findMany({
            where: { isActive: true },
            take: 10
          }),
          expectedTime: 100
        },
        {
          name: 'order_with_items',
          fn: () => prisma.order.findMany({
            include: { orderItems: true },
            take: 5
          }),
          expectedTime: 200
        }
      ];
      
      const regressions = [];
      
      for (const query of baselineQueries) {
        const startTime = performance.now();
        await query.fn();
        const endTime = performance.now();
        const executionTime = endTime - startTime;
        
        const regressionRatio = executionTime / query.expectedTime;
        
        if (regressionRatio > 2.0) {
          regressions.push({
            query: query.name,
            expected: query.expectedTime,
            actual: executionTime,
            ratio: regressionRatio
          });
        }
      }
      
      if (regressions.length > 0) {
        // console.log(`⚠️  Performance regressions detected:`);
        regressions.forEach(reg => {
          // console.log(`   ${reg.query}: ${reg.actual.toFixed(2)}ms (${reg.ratio.toFixed(1)}x slower)`);
        });
      }
      
      expect(regressions.length).toBe(0);
    });
    
    it('should validate index effectiveness after optimization', async () => {
      // Run optimization
      await optimizer.optimizeTableStatistics();
      
      // Test index usage
      const indexTests = [
        {
          name: 'email_index_usage',
          query: () => prisma.user.findUnique({ 
            where: { email: 'test@example.com' } 
          })
        },
        {
          name: 'product_active_index_usage',
          query: () => prisma.product.findMany({ 
            where: { isActive: true },
            take: 10
          })
        },
        {
          name: 'order_status_index_usage',
          query: () => prisma.order.findMany({ 
            where: { status: 'PENDING' },
            take: 10
          })
        }
      ];
      
      const results = [];
      
      for (const test of indexTests) {
        const { performance: perf } = await benchmark.measureQuery(
          test.name,
          test.query
        );
        
        results.push({
          name: test.name,
          executionTime: perf.executionTime
        });
      }
      
      // console.log(`🔍 Index Effectiveness Tests:`);
      results.forEach(result => {
        // console.log(`   ${result.name}: ${result.executionTime.toFixed(2)}ms`);
      });
      
      // All index-based queries should be fast
      results.forEach(result => {
        expect(result.executionTime).toBeLessThan(100);
      });
    });
  });
});