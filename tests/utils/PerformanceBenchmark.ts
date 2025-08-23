import { PrismaClient } from '@prisma/client';
import { performance } from 'perf_hooks';
import * as Benchmark from 'benchmark';

export interface QueryPerformanceResult {
  operation: string;
  executionTime: number;
  recordsAffected: number;
  queryPlan?: any;
  indexesUsed?: string[];
}

export interface BenchmarkResult {
  name: string;
  opsPerSecond: number;
  meanTime: number;
  standardDeviation: number;
  samplesRun: number;
  fastest: boolean;
  slowest: boolean;
}

export class PerformanceBenchmark {
  private prisma: PrismaClient;
  private results: QueryPerformanceResult[] = [];
  
  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
  }
  
  async measureQuery<T>(
    operation: string,
    queryFn: () => Promise<T>
  ): Promise<{ result: T; performance: QueryPerformanceResult }> {
    const startTime = performance.now();
    
    try {
      const result = await queryFn();
      const endTime = performance.now();
      const executionTime = endTime - startTime;
      
      const performanceResult: QueryPerformanceResult = {
        operation,
        executionTime,
        recordsAffected: Array.isArray(result) ? result.length : 1
      };
      
      this.results.push(performanceResult);
      
      return { result, performance: performanceResult };
    } catch (error) {
      const endTime = performance.now();
      const executionTime = endTime - startTime;
      
      const performanceResult: QueryPerformanceResult = {
        operation: `${operation} (FAILED)`,
        executionTime,
        recordsAffected: 0
      };
      
      this.results.push(performanceResult);
      throw error;
    }
  }
  
  async analyzeQueryPlan(sql: string): Promise<any> {
    try {
      const plan = await this.prisma.$queryRaw`EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) ${sql}`;
      return plan;
    } catch (error) {
      // console.warn('Could not analyze query plan:', error);
      return null;
    }
  }
  
  async benchmarkIndexUsage(): Promise<{ 
    indexScans: number; 
    seqScans: number; 
    indexEfficiency: number 
  }> {
    // Get index usage statistics
    const indexStats = await this.prisma.$queryRaw`
      SELECT 
        schemaname,
        tablename,
        indexname,
        idx_scan,
        idx_tup_read,
        idx_tup_fetch
      FROM pg_stat_user_indexes 
      WHERE schemaname = 'public'
      ORDER BY idx_scan DESC
    ` as any[];
    
    const tableStats = await this.prisma.$queryRaw`
      SELECT 
        schemaname,
        tablename,
        seq_scan,
        seq_tup_read,
        idx_scan,
        idx_tup_fetch
      FROM pg_stat_user_tables 
      WHERE schemaname = 'public'
    ` as any[];
    
    const totalIndexScans = indexStats.reduce((sum, stat) => sum + Number(stat.idx_scan || 0), 0);
    const totalSeqScans = tableStats.reduce((sum, stat) => sum + Number(stat.seq_scan || 0), 0);
    const totalScans = totalIndexScans + totalSeqScans;
    
    return {
      indexScans: totalIndexScans,
      seqScans: totalSeqScans,
      indexEfficiency: totalScans > 0 ? (totalIndexScans / totalScans) * 100 : 0
    };
  }
  
  async benchmarkConnectionPool(): Promise<{
    activeConnections: number;
    totalConnections: number;
    maxConnections: number;
    connectionUtilization: number;
  }> {
    const connectionStats = await this.prisma.$queryRaw`
      SELECT 
        count(*) as total_connections,
        count(*) FILTER (WHERE state = 'active') as active_connections,
        (SELECT setting::int FROM pg_settings WHERE name = 'max_connections') as max_connections
      FROM pg_stat_activity
      WHERE datname = current_database()
    ` as any[];
    
    const stats = connectionStats[0];
    const utilization = (Number(stats.total_connections) / Number(stats.max_connections)) * 100;
    
    return {
      activeConnections: Number(stats.active_connections),
      totalConnections: Number(stats.total_connections),
      maxConnections: Number(stats.max_connections),
      connectionUtilization: utilization
    };
  }
  
  async runBenchmarkSuite(testFunctions: {
    [name: string]: () => Promise<void>;
  }): Promise<BenchmarkResult[]> {
    return new Promise((resolve) => {
      const suite = new Benchmark.Suite();
      const results: BenchmarkResult[] = [];
      
      // Add test functions to benchmark suite
      Object.entries(testFunctions).forEach(([name, fn]) => {
        suite.add(name, {
          defer: true,
          fn: async (deferred: any) => {
            await fn();
            deferred.resolve();
          }
        });
      });
      
      suite
        .on('cycle', (event: any) => {
          const benchmark = event.target;
          // console.log(`📊 ${String(benchmark)}`);
          
          results.push({
            name: benchmark.name,
            opsPerSecond: benchmark.hz,
            meanTime: benchmark.stats.mean * 1000, // Convert to milliseconds
            standardDeviation: benchmark.stats.deviation * 1000,
            samplesRun: benchmark.stats.sample.length,
            fastest: false,
            slowest: false
          });
        })
        .on('complete', function(this: any) {
          const fastest = this.filter('fastest');
          const slowest = this.filter('slowest');
          
          // Mark fastest and slowest
          results.forEach(result => {
            result.fastest = fastest.some((b: any) => b.name === result.name);
            result.slowest = slowest.some((b: any) => b.name === result.name);
          });
          
          // console.log(`🏆 Fastest is ${fastest.map((b: any) => b.name).join(', ')}`);
          // console.log(`🐌 Slowest is ${slowest.map((b: any) => b.name).join(', ')}`);
          
          resolve(results);
        })
        .run({ async: true });
    });
  }
  
  async generatePerformanceReport(): Promise<{
    summary: {
      totalQueries: number;
      averageExecutionTime: number;
      slowestQuery: QueryPerformanceResult;
      fastestQuery: QueryPerformanceResult;
    };
    indexEfficiency: {
      indexScans: number;
      seqScans: number;
      efficiency: number;
    };
    connectionStats: {
      activeConnections: number;
      totalConnections: number;
      maxConnections: number;
      utilization: number;
    };
    queryBreakdown: QueryPerformanceResult[];
  }> {
    const indexStats = await this.benchmarkIndexUsage();
    const connectionStats = await this.benchmarkConnectionPool();
    
    const totalQueries = this.results.length;
    const averageExecutionTime = totalQueries > 0 
      ? this.results.reduce((sum, r) => sum + r.executionTime, 0) / totalQueries 
      : 0;
    
    const sortedByTime = [...this.results].sort((a, b) => a.executionTime - b.executionTime);
    const slowestQuery = sortedByTime[sortedByTime.length - 1];
    const fastestQuery = sortedByTime[0];
    
    return {
      summary: {
        totalQueries,
        averageExecutionTime,
        slowestQuery,
        fastestQuery
      },
      indexEfficiency: {
        indexScans: indexStats.indexScans,
        seqScans: indexStats.seqScans,
        efficiency: indexStats.indexEfficiency
      },
      connectionStats: {
        activeConnections: connectionStats.activeConnections,
        totalConnections: connectionStats.totalConnections,
        maxConnections: connectionStats.maxConnections,
        utilization: connectionStats.connectionUtilization
      },
      queryBreakdown: this.results
    };
  }
  
  clearResults(): void {
    this.results = [];
  }
  
  async warmupDatabase(): Promise<void> {
    // console.log('🔥 Warming up database connections and cache...');
    
    // Perform some basic operations to warm up the connection pool
    await this.prisma.user.count();
    await this.prisma.product.count();
    await this.prisma.order.count();
    await this.prisma.subscription.count();
    
    // Warm up commonly used indexes
    await this.prisma.user.findMany({ take: 1 });
    await this.prisma.product.findMany({ where: { isActive: true }, take: 1 });
    await this.prisma.order.findMany({ 
      where: { status: 'PENDING' }, 
      include: { user: true },
      take: 1 
    });
    
    // console.log('✅ Database warmup complete');
  }
}