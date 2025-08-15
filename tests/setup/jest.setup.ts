import { PrismaClient } from '@prisma/client';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

// Global test configuration
jest.setTimeout(30000);

// Database setup for tests
export class DatabaseTestHelper {
  private static prisma: PrismaClient;
  
  static async getTestDatabase(): Promise<PrismaClient> {
    if (!this.prisma) {
      this.prisma = new PrismaClient({
        datasources: {
          db: {
            url: process.env.TEST_DATABASE_URL || process.env.DATABASE_URL
          }
        },
        log: process.env.NODE_ENV === 'test' ? [] : ['query', 'info', 'warn', 'error']
      });
    }
    return this.prisma;
  }
  
  static async cleanDatabase(): Promise<void> {
    const prisma = await this.getTestDatabase();
    
    // Clean up in reverse dependency order
    await prisma.auditLog.deleteMany();
    await prisma.userDiscountCode.deleteMany();
    await prisma.orderItem.deleteMany();
    await prisma.order.deleteMany();
    await prisma.subscription.deleteMany();
    await prisma.paymentMethod.deleteMany();
    await prisma.discountCode.deleteMany();
    await prisma.product.deleteMany();
    await prisma.session.deleteMany();
    await prisma.account.deleteMany();
    await prisma.user.deleteMany();
  }
  
  static async resetSequences(): Promise<void> {
    const prisma = await this.getTestDatabase();
    
    // Reset any sequences if needed
    await prisma.$executeRaw`SELECT setval(pg_get_serial_sequence('audit_logs', 'id'), 1, false)`;
  }
  
  static async seedTestData(): Promise<void> {
    const prisma = await this.getTestDatabase();
    
    // Create minimal test data
    const testUser = await prisma.user.create({
      data: {
        email: 'test@example.com',
        name: 'Test User',
        stripeCustomerId: 'cus_test123',
        role: 'CUSTOMER'
      }
    });
    
    const testProduct = await prisma.product.create({
      data: {
        name: 'Test Product',
        description: 'A test product for unit tests',
        price: 99.99,
        currency: 'usd',
        slug: 'test-product',
        stripePriceId: 'price_test123',
        stripeProductId: 'prod_test123',
        type: 'ONE_TIME'
      }
    });
    
    return { testUser, testProduct };
  }
  
  static async closeDatabase(): Promise<void> {
    if (this.prisma) {
      await this.prisma.$disconnect();
    }
  }
}

// Global test hooks
beforeEach(async () => {
  // Ensure clean state for each test
  await DatabaseTestHelper.cleanDatabase();
});

afterAll(async () => {
  // Cleanup after all tests
  await DatabaseTestHelper.cleanDatabase();
  await DatabaseTestHelper.closeDatabase();
});

// Performance monitoring for tests
const originalConsoleTime = console.time;
const originalConsoleTimeEnd = console.timeEnd;

console.time = (label?: string) => {
  if (process.env.NODE_ENV === 'test' && process.env.MONITOR_PERFORMANCE) {
    originalConsoleTime(label);
  }
};

console.timeEnd = (label?: string) => {
  if (process.env.NODE_ENV === 'test' && process.env.MONITOR_PERFORMANCE) {
    originalConsoleTimeEnd(label);
  }
};

// Export for use in tests
export { DatabaseTestHelper };