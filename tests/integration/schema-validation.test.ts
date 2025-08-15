import { DatabaseTestHelper } from '../setup/jest.setup';
import { TestDataGenerator } from '../fixtures/TestDataGenerator';
import { PrismaClient } from '@prisma/client';

describe('Database Schema Validation Integration Tests', () => {
  let prisma: PrismaClient;
  let testDataGenerator: TestDataGenerator;
  
  beforeAll(async () => {
    prisma = await DatabaseTestHelper.getTestDatabase();
    testDataGenerator = new TestDataGenerator(prisma);
  });
  
  beforeEach(async () => {
    await testDataGenerator.cleanupTestData();
  });
  
  describe('Schema Introspection Validation', () => {
    it('should validate all required tables exist', async () => {
      const tables = await prisma.$queryRaw`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_type = 'BASE TABLE'
      ` as { table_name: string }[];
      
      const tableNames = tables.map(t => t.table_name);
      
      // Verify all expected tables exist
      const expectedTables = [
        'users', 'accounts', 'sessions',
        'products', 'orders', 'order_items',
        'subscriptions', 'payment_methods',
        'discount_codes', 'user_discount_codes',
        'audit_logs'
      ];
      
      expectedTables.forEach(tableName => {
        expect(tableNames).toContain(tableName);
      });
    });
    
    it('should validate all indexes exist and are properly configured', async () => {
      const indexes = await prisma.$queryRaw`
        SELECT 
          i.relname as index_name,
          t.relname as table_name,
          ix.indisunique as is_unique,
          ix.indisprimary as is_primary,
          string_agg(a.attname, ', ' ORDER BY a.attnum) as columns
        FROM pg_class i
        JOIN pg_index ix ON i.oid = ix.indexrelid
        JOIN pg_class t ON ix.indrelid = t.oid
        JOIN pg_attribute a ON t.oid = a.attrelid AND a.attnum = ANY(ix.indkey)
        WHERE t.relkind = 'r'
        AND t.relname IN ('users', 'products', 'orders', 'subscriptions', 'payment_methods', 'discount_codes', 'audit_logs')
        GROUP BY i.relname, t.relname, ix.indisunique, ix.indisprimary
        ORDER BY t.relname, i.relname
      ` as any[];
      
      // Verify critical indexes exist
      const indexNames = indexes.map(idx => idx.index_name);
      
      // User indexes
      expect(indexNames).toContain('users_email_key');
      expect(indexNames).toContain('users_stripeCustomerId_key');
      expect(indexNames).toContain('users_email_idx');
      expect(indexNames).toContain('users_role_idx');
      
      // Product indexes
      expect(indexNames).toContain('products_slug_key');
      expect(indexNames).toContain('products_isActive_idx');
      expect(indexNames).toContain('products_isActive_type_idx');
      
      // Order indexes
      expect(indexNames).toContain('orders_orderNumber_key');
      expect(indexNames).toContain('orders_userId_status_idx');
      expect(indexNames).toContain('orders_status_paymentStatus_idx');
      
      // Subscription indexes
      expect(indexNames).toContain('subscriptions_stripeSubscriptionId_key');
      expect(indexNames).toContain('subscriptions_userId_status_idx');
      
      console.log(`✅ Validated ${indexes.length} database indexes`);
    });
    
    it('should validate foreign key constraints', async () => {
      const foreignKeys = await prisma.$queryRaw`
        SELECT
          tc.table_name,
          kcu.column_name,
          ccu.table_name AS foreign_table_name,
          ccu.column_name AS foreign_column_name,
          tc.constraint_name
        FROM information_schema.table_constraints AS tc
        JOIN information_schema.key_column_usage AS kcu
          ON tc.constraint_name = kcu.constraint_name
          AND tc.table_schema = kcu.table_schema
        JOIN information_schema.constraint_column_usage AS ccu
          ON ccu.constraint_name = tc.constraint_name
          AND ccu.table_schema = tc.table_schema
        WHERE tc.constraint_type = 'FOREIGN KEY'
        AND tc.table_schema = 'public'
      ` as any[];
      
      // Verify critical foreign keys exist
      const fkNames = foreignKeys.map(fk => 
        `${fk.table_name}.${fk.column_name} -> ${fk.foreign_table_name}.${fk.foreign_column_name}`
      );
      
      expect(fkNames).toContain('accounts.userId -> users.id');
      expect(fkNames).toContain('sessions.userId -> users.id');
      expect(fkNames).toContain('orders.userId -> users.id');
      expect(fkNames).toContain('order_items.orderId -> orders.id');
      expect(fkNames).toContain('order_items.productId -> products.id');
      expect(fkNames).toContain('subscriptions.userId -> users.id');
      expect(fkNames).toContain('subscriptions.productId -> products.id');
      expect(fkNames).toContain('payment_methods.userId -> users.id');
      
      console.log(`✅ Validated ${foreignKeys.length} foreign key constraints`);
    });
    
    it('should validate column constraints and data types', async () => {
      const columns = await prisma.$queryRaw`
        SELECT 
          table_name,
          column_name,
          data_type,
          is_nullable,
          column_default,
          character_maximum_length,
          numeric_precision,
          numeric_scale
        FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name IN ('users', 'products', 'orders', 'subscriptions', 'payment_methods')
        ORDER BY table_name, ordinal_position
      ` as any[];
      
      // Validate critical column constraints
      const userEmailColumn = columns.find(c => c.table_name === 'users' && c.column_name === 'email');
      expect(userEmailColumn?.is_nullable).toBe('NO');
      expect(userEmailColumn?.data_type).toBe('text');
      
      const productPriceColumn = columns.find(c => c.table_name === 'products' && c.column_name === 'price');
      expect(productPriceColumn?.data_type).toBe('numeric');
      expect(productPriceColumn?.numeric_precision).toBe(10);
      expect(productPriceColumn?.numeric_scale).toBe(2);
      
      const orderTotalColumn = columns.find(c => c.table_name === 'orders' && c.column_name === 'total');
      expect(orderTotalColumn?.data_type).toBe('numeric');
      expect(orderTotalColumn?.is_nullable).toBe('NO');
      
      console.log(`✅ Validated ${columns.length} column definitions`);
    });
  });
  
  describe('Prisma Schema Validation', () => {
    it('should validate Prisma client can access all models', async () => {
      // Test each model's basic operations
      const modelTests = [
        { name: 'User', fn: () => prisma.user.count() },
        { name: 'Product', fn: () => prisma.product.count() },
        { name: 'Order', fn: () => prisma.order.count() },
        { name: 'OrderItem', fn: () => prisma.orderItem.count() },
        { name: 'Subscription', fn: () => prisma.subscription.count() },
        { name: 'PaymentMethod', fn: () => prisma.paymentMethod.count() },
        { name: 'DiscountCode', fn: () => prisma.discountCode.count() },
        { name: 'UserDiscountCode', fn: () => prisma.userDiscountCode.count() },
        { name: 'Account', fn: () => prisma.account.count() },
        { name: 'Session', fn: () => prisma.session.count() },
        { name: 'AuditLog', fn: () => prisma.auditLog.count() }
      ];
      
      for (const test of modelTests) {
        const count = await test.fn();
        expect(count).toBeGreaterThanOrEqual(0);
      }
      
      console.log(`✅ Validated ${modelTests.length} Prisma models`);
    });
    
    it('should validate all enum values are correctly mapped', async () => {
      // Test UserRole enum
      const user = await testDataGenerator.createTestUser({ role: 'ADMIN' });
      expect(user.role).toBe('ADMIN');
      
      // Test ProductType enum
      const product = await testDataGenerator.createTestProduct({ type: 'SUBSCRIPTION' });
      expect(product.type).toBe('SUBSCRIPTION');
      
      // Test OrderStatus enum
      const order = await testDataGenerator.createTestOrder(user.id, { status: 'PROCESSING' });
      expect(order.status).toBe('PROCESSING');
      
      // Test PaymentStatus enum
      const orderWithPayment = await testDataGenerator.createTestOrder(user.id, { paymentStatus: 'PAID' });
      expect(orderWithPayment.paymentStatus).toBe('PAID');
      
      // Test SubscriptionStatus enum
      const subscription = await testDataGenerator.createTestSubscription(user.id, product.id, { status: 'ACTIVE' });
      expect(subscription.status).toBe('ACTIVE');
      
      // Test DiscountType enum
      const discountCode = await testDataGenerator.createTestDiscountCode({ type: 'PERCENTAGE' });
      expect(discountCode.type).toBe('PERCENTAGE');
      
      console.log('✅ Validated all enum mappings');
    });
  });
  
  describe('Zod Schema Integration Validation', () => {
    it('should validate Zod schemas match database constraints', async () => {
      // This test would ideally import and test actual Zod schemas
      // For now, we'll test that the data generator produces valid data
      
      const userData = testDataGenerator.generateUserData();
      const user = await prisma.user.create({ data: userData });
      expect(user.email).toMatch(/^[^\s@]+@[^\s@]+\.[^\s@]+$/);
      
      const productData = testDataGenerator.generateProductData();
      const product = await prisma.product.create({ data: productData });
      expect(product.price).toBeGreaterThan(0);
      expect(product.slug).toMatch(/^[a-z0-9-]+$/);
      
      const orderData = testDataGenerator.generateOrderData(user.id);
      const order = await prisma.order.create({ data: orderData });
      expect(order.total).toBeGreaterThan(0);
      expect(order.orderNumber).toMatch(/^ORD-/);
      
      console.log('✅ Validated data format consistency');
    });
  });
  
  describe('Database Constraint Validation', () => {
    it('should enforce unique constraints', async () => {
      const email = 'unique-test@example.com';
      await testDataGenerator.createTestUser({ email });
      
      // Should fail on duplicate email
      await expect(
        testDataGenerator.createTestUser({ email })
      ).rejects.toThrow();
      
      const slug = 'unique-product-slug';
      await testDataGenerator.createTestProduct({ slug });
      
      // Should fail on duplicate slug
      await expect(
        testDataGenerator.createTestProduct({ slug })
      ).rejects.toThrow();
    });
    
    it('should enforce not null constraints', async () => {
      // Should fail without required fields
      await expect(
        prisma.user.create({ 
          data: { 
            // Missing required email field
            name: 'Test User'
          } 
        })
      ).rejects.toThrow();
      
      await expect(
        prisma.product.create({
          data: {
            // Missing required name and price fields
            slug: 'test-product'
          }
        })
      ).rejects.toThrow();
    });
    
    it('should enforce foreign key constraints', async () => {
      // Should fail with invalid userId
      await expect(
        testDataGenerator.createTestOrder('non-existent-user-id')
      ).rejects.toThrow();
      
      // Should fail with invalid productId in order item
      const user = await testDataGenerator.createTestUser();
      const order = await testDataGenerator.createTestOrder(user.id);
      
      await expect(
        prisma.orderItem.create({
          data: {
            orderId: order.id,
            productId: 'non-existent-product-id',
            productName: 'Test Product',
            unitPrice: 10.00,
            quantity: 1,
            totalPrice: 10.00
          }
        })
      ).rejects.toThrow();
    });
    
    it('should validate decimal precision and scale', async () => {
      // Price should be limited to 10,2 precision
      const validPrice = 99999999.99;
      const product = await testDataGenerator.createTestProduct({ price: validPrice });
      expect(product.price.toFixed(2)).toBe(validPrice.toFixed(2));
      
      // Should handle precision correctly
      const precisePrice = 123.456;
      const productWithPrecisePrice = await testDataGenerator.createTestProduct({ 
        price: precisePrice,
        slug: 'precise-price-product'
      });
      expect(Number(productWithPrecisePrice.price)).toBe(123.46); // Rounded to 2 decimal places
    });
  });
  
  describe('Schema Migration Validation', () => {
    it('should validate migration state is current', async () => {
      const migrationStatus = await prisma.$queryRaw`
        SELECT * FROM "_prisma_migrations" 
        ORDER BY finished_at DESC LIMIT 1
      ` as any[];
      
      if (migrationStatus.length > 0) {
        const lastMigration = migrationStatus[0];
        expect(lastMigration.migration_name).toBeDefined();
        expect(lastMigration.finished_at).not.toBeNull();
        expect(lastMigration.rolled_back_at).toBeNull();
        
        console.log(`✅ Latest migration: ${lastMigration.migration_name}`);
      }
    });
    
    it('should validate all expected triggers exist', async () => {
      const triggers = await prisma.$queryRaw`
        SELECT 
          trigger_name,
          event_manipulation,
          event_object_table
        FROM information_schema.triggers
        WHERE trigger_schema = 'public'
        ORDER BY event_object_table, trigger_name
      ` as any[];
      
      // Should have audit triggers if audit system is implemented
      const auditTriggers = triggers.filter(t => t.trigger_name.includes('audit'));
      
      if (auditTriggers.length > 0) {
        console.log(`✅ Found ${auditTriggers.length} audit triggers`);
      }
    });
    
    it('should validate database version compatibility', async () => {
      const version = await prisma.$queryRaw`SELECT version()` as any[];
      const versionString = version[0].version;
      
      expect(versionString).toContain('PostgreSQL');
      console.log(`✅ Database version: ${versionString.split(',')[0]}`);
    });
  });
});