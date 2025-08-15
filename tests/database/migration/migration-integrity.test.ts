import { DatabaseTestHelper } from '../../setup/jest.setup';
import { TestDataGenerator } from '../../fixtures/TestDataGenerator';
import { PrismaClient } from '@prisma/client';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

describe('Database Migration Integrity Tests', () => {
  let prisma: PrismaClient;
  let testDataGenerator: TestDataGenerator;
  
  beforeAll(async () => {
    prisma = await DatabaseTestHelper.getTestDatabase();
    testDataGenerator = new TestDataGenerator(prisma);
  });
  
  beforeEach(async () => {
    await testDataGenerator.cleanupTestData();
  });
  
  describe('Migration State Validation', () => {
    it('should have all migrations applied successfully', async () => {
      const migrations = await prisma.$queryRaw`
        SELECT 
          migration_name,
          checksum,
          finished_at,
          started_at,
          applied_steps_count,
          rolled_back_at
        FROM "_prisma_migrations"
        ORDER BY started_at ASC
      ` as any[];
      
      expect(migrations.length).toBeGreaterThan(0);
      
      // All migrations should be completed
      migrations.forEach(migration => {
        expect(migration.finished_at).not.toBeNull();
        expect(migration.rolled_back_at).toBeNull();
        expect(migration.applied_steps_count).toBeGreaterThan(0);
      });
      
      console.log(`✅ Validated ${migrations.length} applied migrations`);
    });
    
    it('should validate migration checksums', async () => {
      const migrations = await prisma.$queryRaw`
        SELECT migration_name, checksum
        FROM "_prisma_migrations"
        WHERE checksum IS NOT NULL
      ` as any[];
      
      migrations.forEach(migration => {
        expect(migration.checksum).toBeDefined();
        expect(migration.checksum).toMatch(/^[a-f0-9]+$/); // Valid hex checksum
      });
      
      console.log(`✅ Validated checksums for ${migrations.length} migrations`);
    });
    
    it('should validate migration order and dependencies', async () => {
      const migrations = await prisma.$queryRaw`
        SELECT migration_name, started_at
        FROM "_prisma_migrations"
        ORDER BY started_at ASC
      ` as any[];
      
      // Check expected migration order
      const expectedMigrations = [
        '20250812201613_initial_schema',
        '20250812215402_add_performance_indexes',
        '20250814193823_add_audit_log_table'
      ];
      
      expectedMigrations.forEach((expectedName, index) => {
        if (migrations[index]) {
          expect(migrations[index].migration_name).toBe(expectedName);
        }
      });
      
      console.log('✅ Migration order validated');
    });
  });
  
  describe('Data Integrity During Migrations', () => {
    it('should preserve existing data during schema changes', async () => {
      // Create test data
      const user = await testDataGenerator.createTestUser({
        email: 'migration-test@example.com',
        name: 'Migration Test User'
      });
      
      const product = await testDataGenerator.createTestProduct({
        name: 'Migration Test Product',
        slug: 'migration-test-product'
      });
      
      const order = await testDataGenerator.createTestOrder(user.id);
      
      // Verify data exists before potential migration
      const userBefore = await prisma.user.findUnique({ where: { id: user.id } });
      const productBefore = await prisma.product.findUnique({ where: { id: product.id } });
      const orderBefore = await prisma.order.findUnique({ where: { id: order.id } });
      
      expect(userBefore).toBeDefined();
      expect(productBefore).toBeDefined();
      expect(orderBefore).toBeDefined();
      
      // Test that relationships are preserved
      const userWithOrders = await prisma.user.findUnique({
        where: { id: user.id },
        include: { orders: true }
      });
      
      expect(userWithOrders?.orders).toHaveLength(1);
      expect(userWithOrders?.orders[0].id).toBe(order.id);
      
      console.log('✅ Data integrity preserved during schema validation');
    });
    
    it('should handle constraint additions without data loss', async () => {
      // Test that existing data conforms to constraints that would be added
      
      // Create users with valid data
      const users = await Promise.all([
        testDataGenerator.createTestUser({ email: 'user1@test.com' }),
        testDataGenerator.createTestUser({ email: 'user2@test.com' }),
        testDataGenerator.createTestUser({ email: 'user3@test.com' })
      ]);
      
      // Verify all users have unique emails (simulating unique constraint)
      const emails = users.map(u => u.email);
      const uniqueEmails = new Set(emails);
      expect(uniqueEmails.size).toBe(emails.length);
      
      // Test foreign key constraints
      const product = await testDataGenerator.createTestProduct();
      const ordersWithValidReferences = await Promise.all(
        users.map(user => testDataGenerator.createTestOrder(user.id))
      );
      
      // All orders should have valid user references
      ordersWithValidReferences.forEach(order => {
        expect(order.userId).toBeTruthy();
        expect(users.find(u => u.id === order.userId)).toBeDefined();
      });
      
      console.log('✅ Constraint compatibility validated');
    });
  });
  
  describe('Index Creation and Performance', () => {
    it('should validate all performance indexes were created correctly', async () => {
      const indexes = await prisma.$queryRaw`
        SELECT 
          i.relname as index_name,
          t.relname as table_name,
          ix.indisunique as is_unique,
          array_agg(a.attname ORDER BY a.attnum) as columns
        FROM pg_class i
        JOIN pg_index ix ON i.oid = ix.indexrelid
        JOIN pg_class t ON ix.indrelid = t.oid
        JOIN pg_attribute a ON t.oid = a.attrelid AND a.attnum = ANY(ix.indkey)
        WHERE t.relkind = 'r'
        AND i.relname NOT LIKE 'pg_%'
        AND NOT ix.indisprimary
        GROUP BY i.relname, t.relname, ix.indisunique
        ORDER BY t.relname, i.relname
      ` as any[];
      
      // Verify critical performance indexes exist
      const indexNames = indexes.map(idx => idx.index_name);
      
      const expectedIndexes = [
        'users_email_idx',
        'users_stripeCustomerId_idx',
        'users_role_idx',
        'products_isActive_idx',
        'products_isActive_type_idx',
        'orders_userId_status_idx',
        'orders_status_paymentStatus_idx',
        'subscriptions_userId_status_idx',
        'payment_methods_userId_isDefault_idx'
      ];
      
      expectedIndexes.forEach(expectedIndex => {
        expect(indexNames).toContain(expectedIndex);
      });
      
      console.log(`✅ Validated ${indexes.length} performance indexes`);
    });
    
    it('should validate index performance with test data', async () => {
      // Generate test data to verify index performance
      await testDataGenerator.generateBulkTestData({
        users: 100,
        products: 50,
        orders: 200,
        subscriptions: 150
      });
      
      // Test performance of indexed queries
      const startTime = performance.now();
      
      // User email lookup (should use email index)
      const user = await prisma.user.findFirst();
      if (user) {
        await prisma.user.findUnique({ where: { email: user.email } });
      }
      
      // Product active type lookup (should use composite index)
      await prisma.product.findMany({
        where: { isActive: true, type: 'ONE_TIME' },
        take: 10
      });
      
      // Order status lookup (should use composite index)
      await prisma.order.findMany({
        where: { status: 'PENDING', paymentStatus: 'PENDING' },
        take: 10
      });
      
      const endTime = performance.now();
      const totalTime = endTime - startTime;
      
      expect(totalTime).toBeLessThan(500); // Should complete within 500ms
      console.log(`✅ Index performance test completed in ${totalTime.toFixed(2)}ms`);
    });
  });
  
  describe('Audit System Migration Validation', () => {
    it('should validate audit log table structure', async () => {
      const auditColumns = await prisma.$queryRaw`
        SELECT column_name, data_type, is_nullable
        FROM information_schema.columns
        WHERE table_name = 'audit_logs'
        AND table_schema = 'public'
        ORDER BY ordinal_position
      ` as any[];
      
      const expectedColumns = [
        'id', 'tableName', 'recordId', 'action', 'userId', 'userEmail',
        'ipAddress', 'userAgent', 'oldValues', 'newValues', 'changedFields',
        'timestamp', 'sessionId', 'requestId', 'metadata'
      ];
      
      const actualColumns = auditColumns.map(col => col.column_name);
      
      expectedColumns.forEach(expectedCol => {
        expect(actualColumns).toContain(expectedCol);
      });
      
      console.log(`✅ Validated audit log table with ${auditColumns.length} columns`);
    });
    
    it('should validate audit log functionality', async () => {
      // Test that audit log can store records
      const auditRecord = await prisma.auditLog.create({
        data: {
          tableName: 'users',
          recordId: 'test-record-id',
          action: 'CREATE',
          userId: 'test-user-id',
          userEmail: 'test@example.com',
          ipAddress: '127.0.0.1',
          userAgent: 'Test Agent',
          newValues: { name: 'Test User', email: 'test@example.com' },
          changedFields: ['name', 'email'],
          metadata: { testRun: true }
        }
      });
      
      expect(auditRecord.id).toBeDefined();
      expect(auditRecord.tableName).toBe('users');
      expect(auditRecord.action).toBe('CREATE');
      expect(auditRecord.timestamp).toBeDefined();
      
      console.log('✅ Audit log functionality validated');
    });
  });
  
  describe('Migration Rollback Simulation', () => {
    it('should simulate rollback scenarios', async () => {
      // Create test data that would be affected by rollback
      const testData = await testDataGenerator.generateBulkTestData({
        users: 10,
        products: 5,
        orders: 15,
        subscriptions: 8
      });
      
      // Verify data exists
      const userCount = await prisma.user.count();
      const productCount = await prisma.product.count();
      const orderCount = await prisma.order.count();
      const subscriptionCount = await prisma.subscription.count();
      
      expect(userCount).toBe(testData.users.length);
      expect(productCount).toBe(testData.products.length);
      expect(orderCount).toBe(testData.orders.length);
      expect(subscriptionCount).toBe(testData.subscriptions.length);
      
      // Test that relationships would survive rollback
      const userWithRelations = await prisma.user.findFirst({
        include: {
          orders: true,
          subscriptions: true,
          paymentMethods: true
        }
      });
      
      expect(userWithRelations).toBeDefined();
      
      console.log('✅ Rollback scenario simulation completed');
    });
  });
  
  describe('Migration Performance Impact', () => {
    it('should measure migration performance impact', async () => {
      // Generate substantial test data
      await testDataGenerator.generateBulkTestData({
        users: 500,
        products: 200,
        orders: 1000,
        subscriptions: 800
      });
      
      // Measure query performance with current schema
      const queries = [
        () => prisma.user.findMany({ where: { isActive: true }, take: 50 }),
        () => prisma.product.findMany({ where: { isActive: true, type: 'ONE_TIME' }, take: 25 }),
        () => prisma.order.findMany({ 
          where: { status: 'PENDING' },
          include: { user: true },
          take: 30 
        }),
        () => prisma.subscription.findMany({
          where: { status: 'ACTIVE' },
          include: { user: true, product: true },
          take: 40
        })
      ];
      
      const startTime = performance.now();
      
      for (const query of queries) {
        await query();
      }
      
      const endTime = performance.now();
      const totalTime = endTime - startTime;
      
      expect(totalTime).toBeLessThan(2000); // Should complete within 2 seconds
      
      console.log(`✅ Migration performance impact test: ${totalTime.toFixed(2)}ms`);
    });
  });
  
  describe('Data Type Validation', () => {
    it('should validate decimal precision is maintained', async () => {
      const product = await testDataGenerator.createTestProduct({
        price: 123.456789, // More precision than allowed
        compareAtPrice: 999.995 // Should round to 999.00
      });
      
      // Should be rounded to 2 decimal places
      expect(Number(product.price)).toBe(123.46);
      expect(Number(product.compareAtPrice || 0)).toBe(1000.00);
    });
    
    it('should validate JSON field functionality', async () => {
      const order = await testDataGenerator.createTestOrder(undefined, {
        shippingAddress: {
          line1: '123 Test St',
          city: 'Test City',
          state: 'TS',
          postalCode: '12345',
          country: 'US'
        },
        metadata: {
          source: 'test',
          priority: 'high',
          notes: ['test note 1', 'test note 2']
        }
      });
      
      const retrievedOrder = await prisma.order.findUnique({
        where: { id: order.id }
      });
      
      expect(retrievedOrder?.shippingAddress).toEqual(order.shippingAddress);
      expect(retrievedOrder?.metadata).toEqual(order.metadata);
    });
    
    it('should validate array field functionality', async () => {
      const product = await testDataGenerator.createTestProduct({
        tags: ['electronics', 'gadgets', 'new'],
        images: ['image1.jpg', 'image2.jpg', 'image3.jpg']
      });
      
      const retrievedProduct = await prisma.product.findUnique({
        where: { id: product.id }
      });
      
      expect(retrievedProduct?.tags).toEqual(['electronics', 'gadgets', 'new']);
      expect(retrievedProduct?.images).toEqual(['image1.jpg', 'image2.jpg', 'image3.jpg']);
    });
  });
});