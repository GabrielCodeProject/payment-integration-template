/**
 * Utility functions for database seeding
 */

import { PrismaClient } from '@prisma/client';
import { SeedConfig, SeedStats } from './types.js';

/**
 * Calculate date relative to now
 */
export function daysAgo(days: number): Date {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
}

/**
 * Calculate date in the future relative to now
 */
export function daysFromNow(days: number): Date {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000);
}

/**
 * Generate order number in format ORD-YYYY-XXX
 */
export function generateOrderNumber(index: number): string {
  const year = new Date().getFullYear();
  const paddedIndex = String(index).padStart(3, '0');
  return `ORD-${year}-${paddedIndex}`;
}

/**
 * Generate SKU for products
 */
export function generateSKU(category: string, name: string, variant?: string): string {
  const cleanName = name.toUpperCase().replace(/[^A-Z0-9]/g, '').substring(0, 8);
  const cleanCategory = category.toUpperCase().substring(0, 4);
  const variantSuffix = variant ? `-${variant.toUpperCase()}` : '';
  return `${cleanCategory}-${cleanName}${variantSuffix}`;
}

/**
 * Generate product slug from name
 */
export function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim();
}

/**
 * Generate Stripe test IDs that follow Stripe's format
 */
export function generateStripeId(prefix: string, suffix: string): string {
  return `${prefix}_test_${suffix}`;
}

/**
 * Clear all existing data in correct order to avoid constraint violations
 */
export async function clearExistingData(prisma: PrismaClient): Promise<void> {
  console.log('🧹 Clearing existing data...');
  
  // Delete in reverse dependency order
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
  
  console.log('✅ Existing data cleared');
}

/**
 * Get statistics about seeded data
 */
export async function getSeedStats(prisma: PrismaClient): Promise<SeedStats> {
  const [
    users,
    products,
    orders,
    orderItems,
    subscriptions,
    paymentMethods,
    discountCodes,
    userDiscountCodes,
    auditLogs
  ] = await Promise.all([
    prisma.user.count(),
    prisma.product.count(),
    prisma.order.count(),
    prisma.orderItem.count(),
    prisma.subscription.count(),
    prisma.paymentMethod.count(),
    prisma.discountCode.count(),
    prisma.userDiscountCode.count(),
    prisma.auditLog.count()
  ]);

  return {
    users,
    products,
    orders,
    orderItems,
    subscriptions,
    paymentMethods,
    discountCodes,
    userDiscountCodes,
    auditLogs
  };
}

/**
 * Print seed statistics
 */
export function printSeedStats(stats: SeedStats): void {
  console.log('\n📊 Seeded data summary:');
  console.log(`👥 Users: ${stats.users}`);
  console.log(`🛍️ Products: ${stats.products}`);
  console.log(`📋 Orders: ${stats.orders}`);
  console.log(`📦 Order Items: ${stats.orderItems}`);
  console.log(`📊 Subscriptions: ${stats.subscriptions}`);
  console.log(`💳 Payment Methods: ${stats.paymentMethods}`);
  console.log(`🎟️ Discount Codes: ${stats.discountCodes}`);
  console.log(`🎫 User Discount Usages: ${stats.userDiscountCodes}`);
  console.log(`📝 Audit Logs: ${stats.auditLogs}`);
}

/**
 * Validate seed configuration
 */
export function validateSeedConfig(config: SeedConfig): void {
  if (config.userCount < 1) {
    throw new Error('User count must be at least 1');
  }
  if (config.productCount < 1) {
    throw new Error('Product count must be at least 1');
  }
  if (config.orderCount < 0) {
    throw new Error('Order count cannot be negative');
  }
  
  const validEnvironments = ['development', 'test', 'staging'];
  if (!validEnvironments.includes(config.environment)) {
    throw new Error(`Invalid environment: ${config.environment}. Must be one of: ${validEnvironments.join(', ')}`);
  }
}

/**
 * Create audit log entry for seeding operations
 */
export async function createAuditLog(
  prisma: PrismaClient,
  action: string,
  tableName: string,
  recordId: string,
  userId?: string,
  metadata?: Record<string, string | number | boolean>
): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        action,
        tableName,
        recordId,
        userId,
        userEmail: userId ? `seed-user-${userId}@seeding.local` : 'system@seeding.local',
        ipAddress: '127.0.0.1',
        userAgent: 'Database Seeding Script',
        metadata: metadata || {},
        changedFields: [],
        sessionId: 'seed-session',
        requestId: `seed-${Date.now()}`
      }
    });
  } catch (error) {
    console.warn(`Failed to create audit log for ${action} on ${tableName}:`, error);
    // Don't fail the seeding process if audit logging fails
  }
}

/**
 * Random array element selector
 */
export function randomChoice<T>(array: T[]): T {
  return array[Math.floor(Math.random() * array.length)];
}

/**
 * Random number between min and max (inclusive)
 */
export function randomBetween(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Random boolean with probability
 */
export function randomBoolean(probability = 0.5): boolean {
  return Math.random() < probability;
}

/**
 * Get default seed configuration for environment
 */
export function getDefaultSeedConfig(): SeedConfig {
  const environment = (process.env.NODE_ENV || 'development') as 'development' | 'test' | 'staging';
  
  return {
    environment,
    clearExistingData: true,
    skipAuditLogs: false,
    userCount: environment === 'test' ? 5 : 10,
    productCount: environment === 'test' ? 8 : 15,
    orderCount: environment === 'test' ? 10 : 25
  };
}