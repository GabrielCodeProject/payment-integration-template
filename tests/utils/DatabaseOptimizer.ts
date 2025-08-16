import { PrismaClient } from '@prisma/client';

export interface OptimizationRecommendation {
  type: 'INDEX' | 'QUERY' | 'SCHEMA' | 'CONFIGURATION';
  priority: 'HIGH' | 'MEDIUM' | 'LOW';
  description: string;
  impact: string;
  implementation: string;
  estimatedImprovement: string;
}

export interface IndexAnalysis {
  indexName: string;
  tableName: string;
  columns: string[];
  isUnique: boolean;
  size: number;
  scans: number;
  tuplesRead: number;
  tuplesReturned: number;
  efficiency: number;
  recommendation?: OptimizationRecommendation;
}

export interface QueryAnalysis {
  query: string;
  executionTime: number;
  planningTime: number;
  executionCount: number;
  rows: number;
  bufferHits: number;
  bufferReads: number;
  recommendation?: OptimizationRecommendation;
}

export class DatabaseOptimizer {
  private prisma: PrismaClient;
  private recommendations: OptimizationRecommendation[] = [];
  
  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
  }
  
  async analyzeIndexPerformance(): Promise<IndexAnalysis[]> {
    console.log('🔍 Analyzing index performance...');
    
    const indexStats = await this.prisma.$queryRaw`
      SELECT 
        i.relname as index_name,
        t.relname as table_name,
        ix.indisunique as is_unique,
        pg_relation_size(i.oid) as size_bytes,
        s.idx_scan as scans,
        s.idx_tup_read as tuples_read,
        s.idx_tup_fetch as tuples_returned,
        array_agg(a.attname ORDER BY a.attnum) as columns
      FROM pg_class i
      JOIN pg_index ix ON i.oid = ix.indexrelid
      JOIN pg_class t ON ix.indrelid = t.oid
      JOIN pg_stat_user_indexes s ON i.oid = s.indexrelid
      JOIN pg_attribute a ON t.oid = a.attrelid AND a.attnum = ANY(ix.indkey)
      WHERE t.relkind = 'r'
      AND t.relname IN ('users', 'products', 'orders', 'subscriptions', 'payment_methods', 'discount_codes', 'audit_logs')
      GROUP BY i.relname, t.relname, ix.indisunique, i.oid, s.idx_scan, s.idx_tup_read, s.idx_tup_fetch
      ORDER BY s.idx_scan DESC
    ` as any[];
    
    const analyses: IndexAnalysis[] = indexStats.map(stat => {
      const efficiency = stat.tuples_read > 0 
        ? (stat.tuples_returned / stat.tuples_read) * 100 
        : 0;
      
      const analysis: IndexAnalysis = {
        indexName: stat.index_name,
        tableName: stat.table_name,
        columns: stat.columns,
        isUnique: stat.is_unique,
        size: stat.size_bytes,
        scans: stat.scans || 0,
        tuplesRead: stat.tuples_read || 0,
        tuplesReturned: stat.tuples_returned || 0,
        efficiency
      };
      
      // Generate recommendations
      if (stat.scans === 0) {
        analysis.recommendation = {
          type: 'INDEX',
          priority: 'MEDIUM',
          description: `Index ${stat.index_name} is never used`,
          impact: 'Removing unused indexes improves write performance',
          implementation: `Consider dropping index if not needed: DROP INDEX ${stat.index_name}`,
          estimatedImprovement: '5-10% write performance improvement'
        };
      } else if (efficiency < 50 && stat.scans > 100) {
        analysis.recommendation = {
          type: 'INDEX',
          priority: 'HIGH',
          description: `Index ${stat.index_name} has low efficiency (${efficiency.toFixed(1)}%)`,
          impact: 'Low efficiency indicates the index may not be optimal',
          implementation: 'Review query patterns and consider composite indexes',
          estimatedImprovement: '20-40% query performance improvement'
        };
      } else if (stat.size_bytes > 10 * 1024 * 1024 && stat.scans < 10) {
        analysis.recommendation = {
          type: 'INDEX',
          priority: 'LOW',
          description: `Large index ${stat.index_name} (${(stat.size_bytes / 1024 / 1024).toFixed(1)}MB) with low usage`,
          impact: 'Large unused indexes consume storage and memory',
          implementation: 'Monitor usage over time, consider removal if consistently unused',
          estimatedImprovement: 'Reduced memory usage and storage costs'
        };
      }
      
      return analysis;
    });
    
    console.log(`✅ Analyzed ${analyses.length} indexes`);
    return analyses;
  }
  
  async analyzeSlowQueries(): Promise<QueryAnalysis[]> {
    console.log('🐌 Analyzing slow queries...');
    
    // Check if pg_stat_statements extension is available
    const hasStatStatements = await this.prisma.$queryRaw`
      SELECT 1 FROM pg_extension WHERE extname = 'pg_stat_statements'
    ` as any[];
    
    if (hasStatStatements.length === 0) {
      console.log('⚠️  pg_stat_statements extension not available, using basic analysis');
      return [];
    }
    
    const slowQueries = await this.prisma.$queryRaw`
      SELECT 
        query,
        calls as execution_count,
        total_exec_time / calls as avg_exec_time,
        mean_exec_time,
        total_exec_time,
        rows,
        shared_blks_hit as buffer_hits,
        shared_blks_read as buffer_reads
      FROM pg_stat_statements
      WHERE query NOT LIKE '%pg_stat_statements%'
      AND calls > 5
      ORDER BY mean_exec_time DESC
      LIMIT 20
    ` as any[];
    
    const analyses: QueryAnalysis[] = slowQueries.map(query => {
      const hitRatio = query.buffer_hits + query.buffer_reads > 0
        ? (query.buffer_hits / (query.buffer_hits + query.buffer_reads)) * 100
        : 0;
      
      const analysis: QueryAnalysis = {
        query: query.query.substring(0, 200) + '...',
        executionTime: query.avg_exec_time,
        planningTime: 0, // Not available in pg_stat_statements
        executionCount: query.execution_count,
        rows: query.rows,
        bufferHits: query.buffer_hits,
        bufferReads: query.buffer_reads
      };
      
      // Generate recommendations
      if (query.avg_exec_time > 1000) {
        analysis.recommendation = {
          type: 'QUERY',
          priority: 'HIGH',
          description: `Very slow query (${query.avg_exec_time.toFixed(2)}ms average)`,
          impact: 'Slow queries impact user experience and system performance',
          implementation: 'Analyze query plan, add indexes, or optimize query structure',
          estimatedImprovement: '50-80% execution time reduction'
        };
      } else if (hitRatio < 95) {
        analysis.recommendation = {
          type: 'QUERY',
          priority: 'MEDIUM',
          description: `Low buffer hit ratio (${hitRatio.toFixed(1)}%)`,
          impact: 'Low hit ratio indicates excessive disk I/O',
          implementation: 'Increase shared_buffers or add appropriate indexes',
          estimatedImprovement: '20-40% I/O performance improvement'
        };
      } else if (query.execution_count > 10000 && query.avg_exec_time > 100) {
        analysis.recommendation = {
          type: 'QUERY',
          priority: 'HIGH',
          description: `Frequently executed slow query`,
          impact: 'High-frequency slow queries significantly impact overall performance',
          implementation: 'Consider caching, query optimization, or result materialization',
          estimatedImprovement: '30-60% overall system performance improvement'
        };
      }
      
      return analysis;
    });
    
    console.log(`✅ Analyzed ${analyses.length} slow queries`);
    return analyses;
  }
  
  async analyzeTableStatistics(): Promise<{
    tableName: string;
    estimatedRows: number;
    actualRows: number;
    lastAnalyzed: Date | null;
    needsUpdate: boolean;
  }[]> {
    console.log('📊 Analyzing table statistics...');
    
    const tableStats = await this.prisma.$queryRaw`
      SELECT 
        schemaname,
        tablename,
        n_tup_ins as inserts,
        n_tup_upd as updates,
        n_tup_del as deletes,
        n_live_tup as live_tuples,
        n_dead_tup as dead_tuples,
        last_vacuum,
        last_autovacuum,
        last_analyze,
        last_autoanalyze
      FROM pg_stat_user_tables
      WHERE schemaname = 'public'
      ORDER BY n_live_tup DESC
    ` as any[];
    
    const analyses = [];
    
    for (const stat of tableStats) {
      const actualCount = await this.prisma.$queryRaw`
        SELECT count(*) as count FROM ${stat.tablename}
      ` as any[];
      
      const lastAnalyzed = stat.last_analyze || stat.last_autoanalyze;
      const daysSinceAnalyzed = lastAnalyzed 
        ? (Date.now() - new Date(lastAnalyzed).getTime()) / (1000 * 60 * 60 * 24)
        : null;
      
      analyses.push({
        tableName: stat.tablename,
        estimatedRows: stat.live_tuples,
        actualRows: actualCount[0].count,
        lastAnalyzed: lastAnalyzed ? new Date(lastAnalyzed) : null,
        needsUpdate: daysSinceAnalyzed === null || daysSinceAnalyzed > 7
      });
    }
    
    console.log(`✅ Analyzed ${analyses.length} table statistics`);
    return analyses;
  }
  
  async generateOptimizationRecommendations(): Promise<OptimizationRecommendation[]> {
    console.log('💡 Generating optimization recommendations...');
    
    const recommendations: OptimizationRecommendation[] = [];
    
    // Analyze indexes
    const indexAnalyses = await this.analyzeIndexPerformance();
    indexAnalyses.forEach(analysis => {
      if (analysis.recommendation) {
        recommendations.push(analysis.recommendation);
      }
    });
    
    // Analyze queries
    const queryAnalyses = await this.analyzeSlowQueries();
    queryAnalyses.forEach(analysis => {
      if (analysis.recommendation) {
        recommendations.push(analysis.recommendation);
      }
    });
    
    // Check connection pool settings
    const connectionStats = await this.prisma.$queryRaw`
      SELECT 
        setting as max_connections,
        (SELECT count(*) FROM pg_stat_activity) as current_connections
      FROM pg_settings 
      WHERE name = 'max_connections'
    ` as any[];
    
    const connStat = connectionStats[0];
    const utilizationPercent = (connStat.current_connections / connStat.max_connections) * 100;
    
    if (utilizationPercent > 80) {
      recommendations.push({
        type: 'CONFIGURATION',
        priority: 'HIGH',
        description: `High connection pool utilization (${utilizationPercent.toFixed(1)}%)`,
        impact: 'High utilization can lead to connection exhaustion',
        implementation: 'Increase max_connections or implement connection pooling (PgBouncer)',
        estimatedImprovement: 'Prevents connection errors and improves scalability'
      });
    }
    
    // Check for missing indexes on foreign keys
    const missingFKIndexes = await this.checkMissingForeignKeyIndexes();
    missingFKIndexes.forEach(recommendation => {
      recommendations.push(recommendation);
    });
    
    // Sort by priority
    const priorityOrder = { 'HIGH': 3, 'MEDIUM': 2, 'LOW': 1 };
    recommendations.sort((a, b) => priorityOrder[b.priority] - priorityOrder[a.priority]);
    
    console.log(`✅ Generated ${recommendations.length} optimization recommendations`);
    return recommendations;
  }
  
  private async checkMissingForeignKeyIndexes(): Promise<OptimizationRecommendation[]> {
    const foreignKeys = await this.prisma.$queryRaw`
      SELECT 
        tc.table_name,
        kcu.column_name,
        ccu.table_name AS foreign_table_name,
        ccu.column_name AS foreign_column_name
      FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu
        ON tc.constraint_name = kcu.constraint_name
      JOIN information_schema.constraint_column_usage ccu
        ON ccu.constraint_name = tc.constraint_name
      WHERE tc.constraint_type = 'FOREIGN KEY'
      AND tc.table_schema = 'public'
    ` as any[];
    
    const indexes = await this.prisma.$queryRaw`
      SELECT 
        t.relname as table_name,
        i.relname as index_name,
        array_agg(a.attname ORDER BY a.attnum) as columns
      FROM pg_class i
      JOIN pg_index ix ON i.oid = ix.indexrelid
      JOIN pg_class t ON ix.indrelid = t.oid
      JOIN pg_attribute a ON t.oid = a.attrelid AND a.attnum = ANY(ix.indkey)
      WHERE t.relkind = 'r'
      GROUP BY t.relname, i.relname
    ` as any[];
    
    const recommendations: OptimizationRecommendation[] = [];
    
    for (const fk of foreignKeys) {
      const hasIndex = indexes.some(idx => 
        idx.table_name === fk.table_name && 
        idx.columns.includes(fk.column_name)
      );
      
      if (!hasIndex) {
        recommendations.push({
          type: 'INDEX',
          priority: 'MEDIUM',
          description: `Missing index on foreign key ${fk.table_name}.${fk.column_name}`,
          impact: 'Foreign key columns without indexes can cause slow joins and deletes',
          implementation: `CREATE INDEX idx_${fk.table_name}_${fk.column_name} ON ${fk.table_name}(${fk.column_name})`,
          estimatedImprovement: '10-50% improvement in join performance'
        });
      }
    }
    
    return recommendations;
  }
  
  async generatePerformanceReport(): Promise<{
    summary: {
      totalIndexes: number;
      unusedIndexes: number;
      slowQueries: number;
      connectionUtilization: number;
    };
    indexAnalyses: IndexAnalysis[];
    queryAnalyses: QueryAnalysis[];
    recommendations: OptimizationRecommendation[];
  }> {
    console.log('📝 Generating comprehensive performance report...');
    
    const indexAnalyses = await this.analyzeIndexPerformance();
    const queryAnalyses = await this.analyzeSlowQueries();
    const recommendations = await this.generateOptimizationRecommendations();
    
    const connectionStats = await this.prisma.$queryRaw`
      SELECT 
        setting as max_connections,
        (SELECT count(*) FROM pg_stat_activity) as current_connections
      FROM pg_settings 
      WHERE name = 'max_connections'
    ` as any[];
    
    const connStat = connectionStats[0];
    const connectionUtilization = (connStat.current_connections / connStat.max_connections) * 100;
    
    const report = {
      summary: {
        totalIndexes: indexAnalyses.length,
        unusedIndexes: indexAnalyses.filter(idx => idx.scans === 0).length,
        slowQueries: queryAnalyses.filter(q => q.executionTime > 100).length,
        connectionUtilization
      },
      indexAnalyses,
      queryAnalyses,
      recommendations
    };
    
    console.log('✅ Performance report generated');
    return report;
  }
  
  async optimizeTableStatistics(): Promise<void> {
    console.log('🔧 Optimizing table statistics...');
    
    const tableStats = await this.analyzeTableStatistics();
    
    for (const stat of tableStats) {
      if (stat.needsUpdate) {
        console.log(`Updating statistics for table: ${stat.tableName}`);
        await this.prisma.$executeRaw`ANALYZE ${stat.tableName}`;
      }
    }
    
    console.log('✅ Table statistics optimization complete');
  }
  
  async vacuumTables(): Promise<void> {
    console.log('🧹 Running vacuum on tables...');
    
    const tables = ['users', 'products', 'orders', 'subscriptions', 'payment_methods', 'audit_logs'];
    
    for (const table of tables) {
      console.log(`Vacuuming table: ${table}`);
      await this.prisma.$executeRaw`VACUUM ANALYZE ${table}`;
    }
    
    console.log('✅ Vacuum operations complete');
  }
}