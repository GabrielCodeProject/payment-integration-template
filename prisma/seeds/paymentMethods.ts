/**
 * Payment methods seeding module - Creates Stripe-compatible test payment methods
 */

import { PrismaClient } from '@prisma/client';
import { PaymentMethodSeedData, SeedConfig } from './types.js';
import { generateStripeId, createAuditLog, randomChoice, randomBetween } from './utils.js';

/**
 * Test card data that matches Stripe's test card numbers
 * https://stripe.com/docs/testing#cards
 */
const STRIPE_TEST_CARDS = [
  // Visa cards
  { brand: 'visa', last4: '4242', fingerprint: 'visa_4242', type: 'CARD' as const },
  { brand: 'visa', last4: '4000', fingerprint: 'visa_4000', type: 'CARD' as const },
  { brand: 'visa', last4: '0002', fingerprint: 'visa_0002', type: 'CARD' as const },
  
  // Mastercard
  { brand: 'mastercard', last4: '4444', fingerprint: 'mc_4444', type: 'CARD' as const },
  { brand: 'mastercard', last4: '5555', fingerprint: 'mc_5555', type: 'CARD' as const },
  
  // American Express
  { brand: 'amex', last4: '0005', fingerprint: 'amex_0005', type: 'CARD' as const },
  { brand: 'amex', last4: '8431', fingerprint: 'amex_8431', type: 'CARD' as const },
  
  // Discover
  { brand: 'discover', last4: '1117', fingerprint: 'disc_1117', type: 'CARD' as const },
  
  // Diners Club
  { brand: 'diners', last4: '0008', fingerprint: 'diners_0008', type: 'CARD' as const },
  
  // JCB
  { brand: 'jcb', last4: '0006', fingerprint: 'jcb_0006', type: 'CARD' as const }
];

/**
 * Sample billing addresses for different regions
 */
const BILLING_ADDRESSES = [
  {
    line1: '123 Main Street',
    line2: 'Apt 4B',
    city: 'Chicago',
    state: 'IL',
    postal_code: '60601',
    country: 'US'
  },
  {
    line1: '456 Oak Avenue',
    city: 'New York',
    state: 'NY',
    postal_code: '10001',
    country: 'US'
  },
  {
    line1: '789 Pine Road',
    city: 'Los Angeles',
    state: 'CA',
    postal_code: '90210',
    country: 'US'
  },
  {
    line1: '101 Baker Street',
    city: 'London',
    postal_code: 'W1U 6TU',
    country: 'GB'
  },
  {
    line1: '22 Rue de la Paix',
    city: 'Paris',
    postal_code: '75001',
    country: 'FR'
  },
  {
    line1: 'Unter den Linden 1',
    city: 'Berlin',
    postal_code: '10117',
    country: 'DE'
  },
  {
    line1: '1-1-1 Chiyoda',
    city: 'Tokyo',
    postal_code: '100-0001',
    country: 'JP'
  },
  {
    line1: 'Level 42, 100 Miller Street',
    city: 'Sydney',
    state: 'NSW',
    postal_code: '2000',
    country: 'AU'
  }
];

/**
 * Payment method nicknames that users might assign
 */
const PAYMENT_METHOD_NICKNAMES = [
  'Primary Card',
  'Business Card',
  'Personal Visa',
  'Backup Card',
  'Travel Card',
  'Shopping Card',
  'Work Expenses',
  'Emergency Card',
  'Daily Use',
  'Premium Card'
];

/**
 * Create payment methods for a specific user
 */
async function createPaymentMethodsForUser(
  prisma: PrismaClient,
  userId: string,
  userIndex: number,
  config: SeedConfig
): Promise<string[]> {
  const paymentMethodIds: string[] = [];
  
  // Determine number of payment methods for this user (1-3)
  const methodCount = Math.min(randomBetween(1, 3), STRIPE_TEST_CARDS.length);
  
  // Get available cards for this user
  const userCards = [...STRIPE_TEST_CARDS].slice(0, methodCount);
  
  for (let i = 0; i < methodCount; i++) {
    const card = userCards[i];
    const isDefault = i === 0; // First card is default
    const methodIndex = (userIndex * 10) + i + 1;
    
    const paymentMethodData: PaymentMethodSeedData = {
      id: `pm-${userId.split('-').pop()}-${i + 1}`,
      userId,
      stripePaymentMethodId: generateStripeId('pm', `${userId.split('-').pop()}_${i + 1}`),
      type: card.type,
      brand: card.brand,
      last4: card.last4,
      expiryMonth: randomBetween(1, 12),
      expiryYear: randomBetween(2025, 2030),
      isDefault,
      nickname: isDefault ? 'Primary Card' : randomChoice(PAYMENT_METHOD_NICKNAMES.filter(n => n !== 'Primary Card')),
      billingAddress: randomChoice(BILLING_ADDRESSES)
    };
    
    const paymentMethod = await prisma.paymentMethod.create({
      data: {
        id: paymentMethodData.id,
        userId: paymentMethodData.userId,
        stripePaymentMethodId: paymentMethodData.stripePaymentMethodId,
        type: paymentMethodData.type,
        brand: paymentMethodData.brand,
        last4: paymentMethodData.last4,
        expiryMonth: paymentMethodData.expiryMonth,
        expiryYear: paymentMethodData.expiryYear,
        fingerprint: `${card.fingerprint}_${userId}`,
        isDefault: paymentMethodData.isDefault,
        nickname: paymentMethodData.nickname,
        billingAddress: paymentMethodData.billingAddress,
        isActive: true
      }
    });
    
    paymentMethodIds.push(paymentMethod.id);
    
    // Create audit log for payment method creation
    if (!config.skipAuditLogs) {
      await createAuditLog(
        prisma,
        'CREATE',
        'payment_methods',
        paymentMethod.id,
        userId,
        {
          type: paymentMethodData.type,
          brand: paymentMethodData.brand,
          last4: paymentMethodData.last4,
          isDefault: paymentMethodData.isDefault,
          source: 'database_seeding'
        }
      );
    }
  }
  
  return paymentMethodIds;
}

/**
 * Seed payment methods for all customers
 */
export async function seedPaymentMethods(prisma: PrismaClient, config: SeedConfig): Promise<string[]> {
  console.log('💳 Creating payment methods...');
  
  // Get all customer users with Stripe customer IDs
  const customers = await prisma.user.findMany({
    where: { 
      role: 'CUSTOMER',
      isActive: true,
      stripeCustomerId: { not: null }
    },
    select: { id: true, email: true, stripeCustomerId: true }
  });
  
  if (customers.length === 0) {
    console.log('⚠️ No customers with Stripe IDs found, skipping payment methods');
    return [];
  }
  
  const allPaymentMethodIds: string[] = [];
  
  for (let i = 0; i < customers.length; i++) {
    const customer = customers[i];
    
    const paymentMethodIds = await createPaymentMethodsForUser(
      prisma,
      customer.id,
      i,
      config
    );
    
    allPaymentMethodIds.push(...paymentMethodIds);
  }
  
  console.log(`✅ Created ${allPaymentMethodIds.length} payment methods for ${customers.length} customers`);
  return allPaymentMethodIds;
}

/**
 * Create additional test payment methods for specific scenarios
 */
export async function seedTestPaymentMethods(prisma: PrismaClient, config: SeedConfig): Promise<void> {
  console.log('🧪 Creating additional test payment methods...');
  
  // Get a customer for testing different scenarios
  const testCustomer = await prisma.user.findFirst({
    where: { 
      role: 'CUSTOMER',
      email: 'john.doe@example.com'
    }
  });
  
  if (!testCustomer) {
    console.log('⚠️ Test customer not found, skipping additional test payment methods');
    return;
  }
  
  // Create expired card
  const expiredCard = await prisma.paymentMethod.create({
    data: {
      id: 'pm-expired-test-001',
      userId: testCustomer.id,
      stripePaymentMethodId: generateStripeId('pm', 'expired_test_001'),
      type: 'CARD',
      brand: 'visa',
      last4: '0341', // Stripe test card for expired card
      expiryMonth: 1,
      expiryYear: 2020, // Expired
      fingerprint: 'visa_expired_test',
      isDefault: false,
      nickname: 'Expired Test Card',
      billingAddress: BILLING_ADDRESSES[0],
      isActive: false // Inactive due to expiration
    }
  });
  
  // Create declined card (for testing)
  const declinedCard = await prisma.paymentMethod.create({
    data: {
      id: 'pm-declined-test-001',
      userId: testCustomer.id,
      stripePaymentMethodId: generateStripeId('pm', 'declined_test_001'),
      type: 'CARD',
      brand: 'visa',
      last4: '0002', // Stripe test card that gets declined
      expiryMonth: 12,
      expiryYear: 2025,
      fingerprint: 'visa_declined_test',
      isDefault: false,
      nickname: 'Test Declined Card',
      billingAddress: BILLING_ADDRESSES[1],
      isActive: true
    }
  });
  
  // Create international card
  const internationalCard = await prisma.paymentMethod.create({
    data: {
      id: 'pm-international-test-001',
      userId: testCustomer.id,
      stripePaymentMethodId: generateStripeId('pm', 'international_test_001'),
      type: 'CARD',
      brand: 'mastercard',
      last4: '4444',
      expiryMonth: 6,
      expiryYear: 2027,
      fingerprint: 'mc_international_test',
      isDefault: false,
      nickname: 'International Card',
      billingAddress: {
        line1: '123 International Street',
        city: 'London',
        postal_code: 'SW1A 1AA',
        country: 'GB'
      },
      isActive: true
    }
  });
  
  // Create audit logs for test payment methods
  if (!config.skipAuditLogs) {
    const testMethods = [expiredCard, declinedCard, internationalCard];
    for (const method of testMethods) {
      await createAuditLog(
        prisma,
        'CREATE',
        'payment_methods',
        method.id,
        testCustomer.id,
        {
          type: method.type,
          brand: method.brand,
          last4: method.last4,
          nickname: method.nickname,
          purpose: 'testing_scenarios',
          source: 'database_seeding'
        }
      );
    }
  }
  
  console.log('✅ Created additional test payment methods');
}

/**
 * Get payment method IDs for a specific user
 */
export async function getPaymentMethodsForUser(prisma: PrismaClient, userId: string): Promise<string[]> {
  const paymentMethods = await prisma.paymentMethod.findMany({
    where: { userId, isActive: true },
    select: { id: true }
  });
  
  return paymentMethods.map(pm => pm.id);
}

/**
 * Get default payment method for a user
 */
export async function getDefaultPaymentMethod(prisma: PrismaClient, userId: string): Promise<string | null> {
  const paymentMethod = await prisma.paymentMethod.findFirst({
    where: { userId, isDefault: true, isActive: true },
    select: { id: true }
  });
  
  return paymentMethod?.id || null;
}

/**
 * Print payment method information for testing
 */
export function printPaymentMethodInfo(): void {
  console.log('\n💳 Payment Method Testing Information:');
  console.log('Stripe Test Cards Created:');
  console.log('  Visa ending in 4242 (always succeeds)');
  console.log('  Visa ending in 4000 (always succeeds)');
  console.log('  Mastercard ending in 5555 (always succeeds)');
  console.log('  Mastercard ending in 4444 (always succeeds)');
  console.log('  Amex ending in 0005 (always succeeds)');
  console.log('  Discover ending in 1117 (always succeeds)');
  console.log('\nTest Scenarios:');
  console.log('  Card ending in 0341 (expired card)');
  console.log('  Card ending in 0002 (declined transaction)');
  console.log('  International cards with foreign billing addresses');
  console.log('\nNote: All payment methods use Stripe test mode IDs');
}