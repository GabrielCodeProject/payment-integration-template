import { Client } from 'pg';
import { PrismaClient } from '@prisma/client';

export default async function globalTeardown() {
  console.log('🧹 Starting global test environment teardown...');
  
  try {
    // Close any open Prisma connections
    await closePrismaConnections();
    
    // Generate test performance report
    await generatePerformanceReport();
    
    // Optionally drop test database (useful for CI/CD)
    if (process.env.DROP_TEST_DB === 'true') {
      await dropTestDatabase();
    }
    
    console.log('✅ Global test environment teardown complete');
  } catch (error) {
    console.error('❌ Error during global teardown:', error);
  }
}

async function closePrismaConnections() {
  try {
    const prisma = new PrismaClient({
      datasources: {
        db: {
          url: process.env.TEST_DATABASE_URL
        }
      }
    });
    
    await prisma.$disconnect();
    console.log('✅ Prisma connections closed');
  } catch (error) {
    console.error('❌ Error closing Prisma connections:', error);
  }
}

async function generatePerformanceReport() {
  if (!global.testMetrics) return;
  
  const metrics = global.testMetrics;
  
  const report = {
    queriesExecuted: metrics.queryTimes.length,
    averageQueryTime: metrics.queryTimes.length > 0 
      ? (metrics.queryTimes.reduce((a, b) => a + b, 0) / metrics.queryTimes.length).toFixed(2)
      : 0,
    slowestQuery: metrics.queryTimes.length > 0 
      ? Math.max(...metrics.queryTimes).toFixed(2)
      : 0,
    connectionsCreated: metrics.connectionTimes.length,
    averageConnectionTime: metrics.connectionTimes.length > 0
      ? (metrics.connectionTimes.reduce((a, b) => a + b, 0) / metrics.connectionTimes.length).toFixed(2)
      : 0
  };
  
  console.log('📊 Test Performance Report:');
  console.log(`   Queries executed: ${report.queriesExecuted}`);
  console.log(`   Average query time: ${report.averageQueryTime}ms`);
  console.log(`   Slowest query: ${report.slowestQuery}ms`);
  console.log(`   Connections created: ${report.connectionsCreated}`);
  console.log(`   Average connection time: ${report.averageConnectionTime}ms`);
  
  // Write detailed report to file if needed
  if (process.env.WRITE_PERFORMANCE_REPORT === 'true') {
    const fs = await import('fs');
    const path = await import('path');
    
    const reportPath = path.join(process.cwd(), 'test-performance-report.json');
    fs.writeFileSync(reportPath, JSON.stringify({
      timestamp: new Date().toISOString(),
      ...report,
      detailedMetrics: metrics
    }, null, 2));
    
    console.log(`📄 Detailed performance report written to: ${reportPath}`);
  }
}

async function dropTestDatabase() {
  const testDbName = 'payment_template_test';
  const adminClient = new Client({
    host: process.env.POSTGRES_HOST || 'localhost',
    port: parseInt(process.env.POSTGRES_PORT || '5432'),
    user: process.env.POSTGRES_USER || 'postgres',
    password: process.env.POSTGRES_PASSWORD || 'postgres',
    database: 'postgres'
  });
  
  try {
    await adminClient.connect();
    
    // Terminate active connections to test database
    await adminClient.query(`
      SELECT pg_terminate_backend(pid)
      FROM pg_stat_activity
      WHERE datname = $1 AND pid <> pg_backend_pid()
    `, [testDbName]);
    
    // Drop test database
    await adminClient.query(`DROP DATABASE IF EXISTS "${testDbName}"`);
    console.log('✅ Test database dropped');
    
  } catch (error) {
    console.error('❌ Error dropping test database:', error);
  } finally {
    await adminClient.end();
  }
}