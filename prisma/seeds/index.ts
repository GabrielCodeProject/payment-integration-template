/**
 * Enhanced Database Seeding System
 * Modular, comprehensive seeding with audit logging and realistic test data
 */

import { PrismaClient } from '@prisma/client';
import { SeedConfig } from './types.js';
import { 
  validateSeedConfig, 
  getDefaultSeedConfig, 
  clearExistingData, 
  getSeedStats, 
  printSeedStats 
} from './utils.js';
import { seedUsers, printUserCredentials } from './users.js';
import { seedProducts } from './products.js';
import { seedDiscountCodes, printDiscountCodes } from './discountCodes.js';
import { seedPaymentMethods, seedTestPaymentMethods, printPaymentMethodInfo } from './paymentMethods.js';
import { seedOrders, seedUserDiscountCodes, getOrderStatistics } from './orders.js';
import { seedSubscriptions, seedTestSubscriptionScenarios, getSubscriptionStatistics, printSubscriptionInfo } from './subscriptions.js';

/**
 * Enhanced seeding function with comprehensive error handling and logging
 */
export async function enhancedDatabaseSeed(config?: Partial<SeedConfig>): Promise<void> {
  const prisma = new PrismaClient();
  const finalConfig: SeedConfig = { ...getDefaultSeedConfig(), ...config };
  
  console.log('🌱 Starting enhanced database seeding...');
  console.log(`📊 Configuration: ${JSON.stringify(finalConfig, null, 2)}`);
  
  try {
    // Validate configuration
    validateSeedConfig(finalConfig);
    
    const startTime = Date.now();
    
    // Phase 1: Clean existing data
    if (finalConfig.clearExistingData) {
      await clearExistingData(prisma);
    }
    
    // Phase 2: Core data creation
    console.log('\n🏗️ Phase 2: Creating core data...');
    
    // Create users first (required for all other entities)
    const userIds = await seedUsers(prisma, finalConfig);
    if (userIds.length === 0) {
      throw new Error('Failed to create users - cannot continue seeding');
    }
    
    // Create products (required for orders and subscriptions)
    const productIds = await seedProducts(prisma, finalConfig);
    if (productIds.length === 0) {
      throw new Error('Failed to create products - cannot continue seeding');
    }
    
    // Create discount codes
    await seedDiscountCodes(prisma, finalConfig);
    
    // Phase 3: Payment infrastructure
    console.log('\n💳 Phase 3: Creating payment infrastructure...');
    
    // Create payment methods for customers
    await seedPaymentMethods(prisma, finalConfig);
    
    // Create additional test payment scenarios
    await seedTestPaymentMethods(prisma, finalConfig);
    
    // Phase 4: Transaction data
    console.log('\n📋 Phase 4: Creating transaction data...');
    
    // Create orders with realistic scenarios
    await seedOrders(prisma, finalConfig);
    
    // Create user discount code usage records
    await seedUserDiscountCodes(prisma, finalConfig);
    
    // Phase 5: Subscription data
    console.log('\n📊 Phase 5: Creating subscription data...');
    
    // Create subscriptions
    await seedSubscriptions(prisma, finalConfig);
    
    // Create additional subscription test scenarios
    await seedTestSubscriptionScenarios(prisma, finalConfig);
    
    // Phase 6: Statistics and completion
    console.log('\n📈 Phase 6: Generating statistics...');
    
    const finalStats = await getSeedStats(prisma);
    const orderStats = await getOrderStatistics(prisma);
    const subscriptionStats = await getSubscriptionStatistics(prisma);
    
    const endTime = Date.now();
    const duration = ((endTime - startTime) / 1000).toFixed(2);
    
    // Print comprehensive results
    console.log('\n✅ Enhanced database seeding completed successfully!');
    console.log(`⏱️ Total time: ${duration} seconds`);
    
    printSeedStats(finalStats);
    
    console.log('\n📊 Order Statistics:');
    console.log(`  Total: ${orderStats.total}`);
    console.log(`  Paid: ${orderStats.paid}`);
    console.log(`  Shipped: ${orderStats.shipped}`);
    console.log(`  Delivered: ${orderStats.delivered}`);
    console.log(`  Cancelled: ${orderStats.cancelled}`);
    console.log(`  Pending: ${orderStats.pending}`);
    
    console.log('\n📊 Subscription Statistics:');
    console.log(`  Total: ${subscriptionStats.total}`);
    console.log(`  Active: ${subscriptionStats.active}`);
    console.log(`  Trialing: ${subscriptionStats.trialing}`);
    console.log(`  Cancelled: ${subscriptionStats.cancelled}`);
    console.log(`  Past Due: ${subscriptionStats.pastDue}`);
    console.log(`  Paused: ${subscriptionStats.paused}`);
    
    // Print testing information
    printUserCredentials();
    printDiscountCodes();
    printPaymentMethodInfo();
    printSubscriptionInfo();
    
    console.log('\n🎯 Seeding Quality Metrics:');
    console.log(`  Users per payment method: ${(finalStats.paymentMethods / finalStats.users).toFixed(1)}`);
    console.log(`  Orders per user: ${(finalStats.orders / finalStats.users).toFixed(1)}`);
    console.log(`  Items per order: ${(finalStats.orderItems / Math.max(finalStats.orders, 1)).toFixed(1)}`);
    console.log(`  Subscription adoption: ${((finalStats.subscriptions / finalStats.users) * 100).toFixed(1)}%`);
    console.log(`  Discount code usage: ${((finalStats.userDiscountCodes / finalStats.users) * 100).toFixed(1)}%`);
    
    console.log('\n🔗 Quick Start Commands:');
    console.log('  npm run db:studio     # Open Prisma Studio to explore data');
    console.log('  npm run dev           # Start development server');
    console.log('  npm run test          # Run tests with seeded data');
    
  } catch (error) {
    console.error('❌ Error during enhanced seeding:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

/**
 * Development environment seeding
 */
export async function seedDevelopment(): Promise<void> {
  await enhancedDatabaseSeed({
    environment: 'development',
    clearExistingData: true,
    skipAuditLogs: false,
    userCount: 12,
    productCount: 15,
    orderCount: 30
  });
}

/**
 * Test environment seeding (smaller dataset)
 */
export async function seedTest(): Promise<void> {
  await enhancedDatabaseSeed({
    environment: 'test',
    clearExistingData: true,
    skipAuditLogs: true, // Skip audit logs in test for performance
    userCount: 6,
    productCount: 8,
    orderCount: 15
  });
}

/**
 * Staging environment seeding (production-like dataset)
 */
export async function seedStaging(): Promise<void> {
  await enhancedDatabaseSeed({
    environment: 'staging',
    clearExistingData: true,
    skipAuditLogs: false,
    userCount: 25,
    productCount: 20,
    orderCount: 75
  });
}

/**
 * Minimal seeding for CI/CD pipelines
 */
export async function seedMinimal(): Promise<void> {
  await enhancedDatabaseSeed({
    environment: 'test',
    clearExistingData: true,
    skipAuditLogs: true,
    userCount: 3,
    productCount: 5,
    orderCount: 5
  });
}

// Export all seeding functions for external use
export {
  seedUsers,
  seedProducts,
  seedDiscountCodes,
  seedPaymentMethods,
  seedOrders,
  seedSubscriptions
};