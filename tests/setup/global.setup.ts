import { exec } from 'child_process';
import { promisify } from 'util';
import { Client } from 'pg';

const execAsync = promisify(exec);

export default async function globalSetup() {
  console.log('🔧 Setting up global test environment...');
  
  // Set test environment
  process.env.NODE_ENV = 'test';
  
  // Create test database if it doesn't exist
  await createTestDatabase();
  
  // Run migrations on test database
  await runTestMigrations();
  
  // Set up performance monitoring
  setupPerformanceMonitoring();
  
  console.log('✅ Global test environment setup complete');
}

async function createTestDatabase() {
  const testDbName = 'payment_template_test';
  const adminClient = new Client({
    host: process.env.POSTGRES_HOST || 'localhost',
    port: parseInt(process.env.POSTGRES_PORT || '5432'),
    user: process.env.POSTGRES_USER || 'postgres',
    password: process.env.POSTGRES_PASSWORD || 'postgres',
    database: 'postgres' // Connect to default database to create test database
  });
  
  try {
    await adminClient.connect();
    
    // Check if test database exists
    const result = await adminClient.query(
      'SELECT 1 FROM pg_database WHERE datname = $1',
      [testDbName]
    );
    
    if (result.rows.length === 0) {
      console.log('📊 Creating test database...');
      await adminClient.query(`CREATE DATABASE "${testDbName}"`);
      console.log('✅ Test database created');
    } else {
      console.log('📊 Test database already exists');
    }
    
  } catch (error) {
    console.error('❌ Error creating test database:', error);
    throw error;
  } finally {
    await adminClient.end();
  }
  
  // Set test database URL
  const baseUrl = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/payment_template_dev';
  process.env.TEST_DATABASE_URL = baseUrl.replace(/\/[^\/]+$/, `/${testDbName}`);
  process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
}

async function runTestMigrations() {
  try {
    console.log('🔄 Running test database migrations...');
    
    // Use Prisma CLI to run migrations
    await execAsync('npx prisma migrate deploy', {
      env: { ...process.env, DATABASE_URL: process.env.TEST_DATABASE_URL }
    });
    
    console.log('✅ Test database migrations completed');
  } catch (error) {
    console.error('❌ Error running test migrations:', error);
    throw error;
  }
}

function setupPerformanceMonitoring() {
  // Enable performance monitoring for tests
  process.env.MONITOR_PERFORMANCE = 'true';
  
  // Set up performance tracking globals
  global.testMetrics = {
    queryTimes: [],
    connectionTimes: [],
    migrationTimes: []
  };
}

// Type declarations for global test metrics
declare global {
  var testMetrics: {
    queryTimes: number[];
    connectionTimes: number[];
    migrationTimes: number[];
  };
}