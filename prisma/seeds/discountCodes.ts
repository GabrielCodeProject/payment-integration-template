/**
 * Discount codes seeding module - Creates promotional codes with different types and strategies
 */

import { PrismaClient } from '@prisma/client';
import { DiscountCodeSeedData, SeedConfig } from './types.js';
import { daysAgo, daysFromNow, createAuditLog } from './utils.js';

/**
 * Discount code templates covering various promotional strategies
 */
const DISCOUNT_CODE_TEMPLATES: DiscountCodeSeedData[] = [
  // Welcome and onboarding discounts
  {
    id: 'discount-welcome-001',
    code: 'WELCOME10',
    name: 'Welcome New Customer',
    description: '10% off for first-time customers',
    type: 'PERCENTAGE',
    value: 10.0,
    maxUses: 1000,
    maxUsesPerCustomer: 1,
    currentUses: 47,
    minimumOrderAmount: 20.0,
    startsAtDaysAgo: 30,
    expiresInDays: 60,
    isActive: true
  },
  {
    id: 'discount-newbie-001',
    code: 'NEWBIE15',
    name: 'First Purchase Bonus',
    description: '15% off your first purchase over $50',
    type: 'PERCENTAGE',
    value: 15.0,
    maxUses: 500,
    maxUsesPerCustomer: 1,
    currentUses: 23,
    minimumOrderAmount: 50.0,
    startsAtDaysAgo: 15,
    expiresInDays: 45,
    isActive: true
  },

  // Free shipping promotions
  {
    id: 'discount-freeship-001',
    code: 'FREESHIP',
    name: 'Free Shipping',
    description: 'Free shipping on orders over $50',
    type: 'FREE_SHIPPING',
    value: 0.0,
    maxUses: null, // Unlimited
    maxUsesPerCustomer: null,
    currentUses: 234,
    minimumOrderAmount: 50.0,
    startsAtDaysAgo: 20,
    expiresInDays: 30,
    isActive: true
  },
  {
    id: 'discount-freeship-premium-001',
    code: 'PREMIUMSHIP',
    name: 'Premium Free Shipping',
    description: 'Free shipping on any order for premium customers',
    type: 'FREE_SHIPPING',
    value: 0.0,
    maxUses: null,
    maxUsesPerCustomer: 10,
    currentUses: 89,
    minimumOrderAmount: 1.0,
    startsAtDaysAgo: 5,
    expiresInDays: 90,
    isActive: true
  },

  // Fixed amount discounts
  {
    id: 'discount-save5-001',
    code: 'SAVE5',
    name: 'Save Five Dollars',
    description: '$5 off any purchase over $25',
    type: 'FIXED_AMOUNT',
    value: 5.0,
    currency: 'usd',
    maxUses: 750,
    maxUsesPerCustomer: 3,
    currentUses: 156,
    minimumOrderAmount: 25.0,
    startsAtDaysAgo: 10,
    expiresInDays: 45,
    isActive: true
  },
  {
    id: 'discount-save10-001',
    code: 'TENOFF',
    name: 'Ten Dollar Discount',
    description: '$10 off orders over $75',
    type: 'FIXED_AMOUNT',
    value: 10.0,
    currency: 'usd',
    maxUses: 300,
    maxUsesPerCustomer: 2,
    currentUses: 67,
    minimumOrderAmount: 75.0,
    startsAtDaysAgo: 7,
    expiresInDays: 30,
    isActive: true
  },
  {
    id: 'discount-save25-001',
    code: 'BIG25',
    name: 'Big Savings',
    description: '$25 off orders over $150',
    type: 'FIXED_AMOUNT',
    value: 25.0,
    currency: 'usd',
    maxUses: 100,
    maxUsesPerCustomer: 1,
    currentUses: 12,
    minimumOrderAmount: 150.0,
    startsAtDaysAgo: 3,
    expiresInDays: 60,
    isActive: true
  },

  // Percentage discounts
  {
    id: 'discount-flash20-001',
    code: 'FLASH20',
    name: 'Flash Sale 20%',
    description: '20% off everything - limited time!',
    type: 'PERCENTAGE',
    value: 20.0,
    maxUses: 200,
    maxUsesPerCustomer: 1,
    currentUses: 78,
    minimumOrderAmount: 30.0,
    startsAtDaysAgo: 2,
    expiresInDays: 5, // Short-term flash sale
    isActive: true
  },
  {
    id: 'discount-holiday25-001',
    code: 'HOLIDAY25',
    name: 'Holiday Special',
    description: '25% off for the holiday season',
    type: 'PERCENTAGE',
    value: 25.0,
    maxUses: 500,
    maxUsesPerCustomer: 2,
    currentUses: 89,
    minimumOrderAmount: 40.0,
    startsAtDaysAgo: 14,
    expiresInDays: 21,
    isActive: true
  },
  {
    id: 'discount-student15-001',
    code: 'STUDENT15',
    name: 'Student Discount',
    description: '15% off for students and educators',
    type: 'PERCENTAGE',
    value: 15.0,
    maxUses: null, // Unlimited for qualifying users
    maxUsesPerCustomer: null,
    currentUses: 145,
    minimumOrderAmount: 15.0,
    startsAtDaysAgo: 60,
    expiresInDays: 365, // Long-term program
    isActive: true
  },

  // VIP and loyalty discounts
  {
    id: 'discount-vip30-001',
    code: 'VIP30',
    name: 'VIP Customer Exclusive',
    description: '30% off for VIP customers only',
    type: 'PERCENTAGE',
    value: 30.0,
    maxUses: 50,
    maxUsesPerCustomer: 1,
    currentUses: 8,
    minimumOrderAmount: 100.0,
    startsAtDaysAgo: 1,
    expiresInDays: 14,
    isActive: true
  },
  {
    id: 'discount-loyal12-001',
    code: 'LOYAL12',
    name: 'Loyalty Reward',
    description: '$12 off for loyal customers',
    type: 'FIXED_AMOUNT',
    value: 12.0,
    currency: 'usd',
    maxUses: 200,
    maxUsesPerCustomer: 1,
    currentUses: 34,
    minimumOrderAmount: 60.0,
    startsAtDaysAgo: 8,
    expiresInDays: 40,
    isActive: true
  },

  // Expired and inactive codes (for testing)
  {
    id: 'discount-expired-001',
    code: 'EXPIRED20',
    name: 'Expired Summer Sale',
    description: '20% off summer collection - expired',
    type: 'PERCENTAGE',
    value: 20.0,
    maxUses: 300,
    maxUsesPerCustomer: 1,
    currentUses: 145,
    minimumOrderAmount: 25.0,
    startsAtDaysAgo: 90,
    expiresInDays: -10, // Expired 10 days ago
    isActive: false
  },
  {
    id: 'discount-maxed-001',
    code: 'MAXEDOUT',
    name: 'Maxed Out Code',
    description: '15% off - usage limit reached',
    type: 'PERCENTAGE',
    value: 15.0,
    maxUses: 50,
    maxUsesPerCustomer: 1,
    currentUses: 50, // Reached maximum
    minimumOrderAmount: 20.0,
    startsAtDaysAgo: 5,
    expiresInDays: 25,
    isActive: true // Still active but maxed out
  },
  {
    id: 'discount-inactive-001',
    code: 'INACTIVE10',
    name: 'Inactive Test Code',
    description: '10% off - deactivated for testing',
    type: 'PERCENTAGE',
    value: 10.0,
    maxUses: 100,
    maxUsesPerCustomer: 1,
    currentUses: 12,
    minimumOrderAmount: 15.0,
    startsAtDaysAgo: 3,
    expiresInDays: 30,
    isActive: false
  },

  // Future codes (not yet active)
  {
    id: 'discount-future-001',
    code: 'FUTURE50',
    name: 'Future Mega Sale',
    description: '50% off everything - starts next week',
    type: 'PERCENTAGE',
    value: 50.0,
    maxUses: 100,
    maxUsesPerCustomer: 1,
    currentUses: 0,
    minimumOrderAmount: 50.0,
    startsAtDaysAgo: -7, // Starts in 7 days
    expiresInDays: 14,
    isActive: true
  }
];

/**
 * Seed discount codes
 */
export async function seedDiscountCodes(prisma: PrismaClient, config: SeedConfig): Promise<string[]> {
  console.log('🎟️ Creating discount codes...');
  
  const discountCodeIds: string[] = [];
  
  for (const discountData of DISCOUNT_CODE_TEMPLATES) {
    const startsAt = discountData.startsAtDaysAgo !== undefined 
      ? (discountData.startsAtDaysAgo >= 0 ? daysAgo(discountData.startsAtDaysAgo) : daysFromNow(-discountData.startsAtDaysAgo))
      : undefined;
    
    const expiresAt = discountData.expiresInDays !== undefined
      ? (discountData.expiresInDays >= 0 ? daysFromNow(discountData.expiresInDays) : daysAgo(-discountData.expiresInDays))
      : undefined;
    
    const discountCode = await prisma.discountCode.create({
      data: {
        id: discountData.id,
        code: discountData.code,
        name: discountData.name,
        description: discountData.description,
        type: discountData.type,
        value: discountData.value,
        currency: discountData.currency,
        maxUses: discountData.maxUses,
        maxUsesPerCustomer: discountData.maxUsesPerCustomer,
        currentUses: discountData.currentUses,
        minimumOrderAmount: discountData.minimumOrderAmount,
        startsAt,
        expiresAt,
        isActive: discountData.isActive
      }
    });
    
    discountCodeIds.push(discountCode.id);
    
    // Create audit log for discount code creation
    if (!config.skipAuditLogs) {
      await createAuditLog(
        prisma,
        'CREATE',
        'discount_codes',
        discountCode.id,
        undefined,
        {
          code: discountData.code,
          type: discountData.type,
          value: discountData.value,
          isActive: discountData.isActive,
          source: 'database_seeding'
        }
      );
    }
  }
  
  console.log(`✅ Created ${discountCodeIds.length} discount codes`);
  return discountCodeIds;
}

/**
 * Get active discount code IDs
 */
export async function getActiveDiscountCodeIds(prisma: PrismaClient): Promise<string[]> {
  const discountCodes = await prisma.discountCode.findMany({
    where: { 
      isActive: true,
      OR: [
        { expiresAt: null },
        { expiresAt: { gt: new Date() } }
      ]
    },
    select: { id: true }
  });
  
  return discountCodes.map(code => code.id);
}

/**
 * Get discount codes by type
 */
export async function getDiscountCodesByType(prisma: PrismaClient, type: 'PERCENTAGE' | 'FIXED_AMOUNT' | 'FREE_SHIPPING'): Promise<string[]> {
  const discountCodes = await prisma.discountCode.findMany({
    where: { type, isActive: true },
    select: { id: true }
  });
  
  return discountCodes.map(code => code.id);
}

/**
 * Print available discount codes for testing
 */
export function printDiscountCodes(): void {
  console.log('\n🎟️ Available discount codes for testing:');
  console.log('Active Codes:');
  console.log('  WELCOME10: 10% off for new customers (min $20)');
  console.log('  NEWBIE15: 15% off first purchase (min $50)');
  console.log('  FREESHIP: Free shipping (min $50)');
  console.log('  PREMIUMSHIP: Free shipping for premium users (any amount)');
  console.log('  SAVE5: $5 off orders over $25');
  console.log('  TENOFF: $10 off orders over $75');
  console.log('  BIG25: $25 off orders over $150');
  console.log('  FLASH20: 20% off everything (limited time)');
  console.log('  HOLIDAY25: 25% off holiday special');
  console.log('  STUDENT15: 15% off for students');
  console.log('  VIP30: 30% off for VIP customers');
  console.log('  LOYAL12: $12 off for loyal customers');
  console.log('\nTesting Scenarios:');
  console.log('  EXPIRED20: Expired code (20% off)');
  console.log('  MAXEDOUT: Usage limit reached (15% off)');
  console.log('  INACTIVE10: Deactivated code (10% off)');
  console.log('  FUTURE50: Future code - not yet active (50% off)');
}