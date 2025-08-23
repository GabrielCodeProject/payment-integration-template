/**
 * Subscriptions seeding module - Creates subscription billing scenarios
 */

import { PrismaClient } from '@prisma/client';
import { SubscriptionSeedData, SeedConfig } from './types.js';
import { 
  daysAgo, 
  daysFromNow, 
  generateStripeId, 
  createAuditLog, 
  randomChoice, 
  randomBetween, 
  randomBoolean 
} from './utils.js';

/**
 * Subscription scenario templates
 */
const SUBSCRIPTION_SCENARIOS = [
  {
    scenario: 'active_subscription',
    status: 'ACTIVE' as const,
    weight: 60, // 60% of subscriptions
    hasTrialPeriod: false,
    cancelAtPeriodEnd: false
  },
  {
    scenario: 'active_with_trial',
    status: 'TRIALING' as const,
    weight: 15, // 15% of subscriptions
    hasTrialPeriod: true,
    cancelAtPeriodEnd: false
  },
  {
    scenario: 'cancelled_subscription',
    status: 'CANCELLED' as const,
    weight: 12, // 12% of subscriptions
    hasTrialPeriod: false,
    cancelAtPeriodEnd: true
  },
  {
    scenario: 'past_due',
    status: 'PAST_DUE' as const,
    weight: 8, // 8% of subscriptions
    hasTrialPeriod: false,
    cancelAtPeriodEnd: false
  },
  {
    scenario: 'paused_subscription',
    status: 'PAUSED' as const,
    weight: 3, // 3% of subscriptions
    hasTrialPeriod: false,
    cancelAtPeriodEnd: false
  },
  {
    scenario: 'incomplete_subscription',
    status: 'INCOMPLETE' as const,
    weight: 2, // 2% of subscriptions
    hasTrialPeriod: false,
    cancelAtPeriodEnd: false
  }
];

/**
 * Trial period configurations
 */
const TRIAL_CONFIGURATIONS = [
  { days: 7, name: '7-day trial' },
  { days: 14, name: '14-day trial' },
  { days: 30, name: '30-day trial' }
];

/**
 * Subscription metadata templates
 */
const SUBSCRIPTION_METADATA_TEMPLATES = [
  {
    signup_source: 'landing_page',
    campaign: 'summer_promotion',
    referrer: 'google_ads'
  },
  {
    signup_source: 'mobile_app',
    campaign: 'app_store_feature',
    referrer: 'organic'
  },
  {
    signup_source: 'email_campaign',
    campaign: 'newsletter_cta',
    referrer: 'email'
  },
  {
    signup_source: 'social_media',
    campaign: 'twitter_promotion',
    referrer: 'social'
  },
  {
    signup_source: 'word_of_mouth',
    campaign: 'referral_program',
    referrer: 'friend'
  }
];

/**
 * Generate subscription data based on scenario
 */
function generateSubscriptionFromScenario(
  subscriptionIndex: number,
  userId: string,
  userStripeCustomerId: string,
  subscriptionProductId: string,
  productStripePriceId: string,
  productPrice: number,
  productBillingInterval: string,
  scenario: typeof SUBSCRIPTION_SCENARIOS[0]
): SubscriptionSeedData {
  const baseSubscriptionData: SubscriptionSeedData = {
    userId,
    productId: subscriptionProductId,
    stripeSubscriptionId: generateStripeId('sub', `${subscriptionIndex.toString().padStart(3, '0')}`),
    stripeCustomerId: userStripeCustomerId,
    stripePriceId: productStripePriceId,
    status: scenario.status,
    billingInterval: productBillingInterval as 'DAY' | 'WEEK' | 'MONTH' | 'YEAR',
    unitPrice: productPrice,
    quantity: randomBetween(1, 3), // Some subscriptions have multiple quantities
    currency: 'usd',
    cancelAtPeriodEnd: scenario.cancelAtPeriodEnd,
    metadata: randomChoice(SUBSCRIPTION_METADATA_TEMPLATES),
    currentPeriodStartDaysAgo: 0, // Will be set in switch
    currentPeriodEndDaysInFuture: 0, // Will be set in switch
    startedDaysAgo: 0 // Will be set in switch
  };

  // Set up timing based on scenario
  switch (scenario.scenario) {
    case 'active_subscription':
      baseSubscriptionData.startedDaysAgo = randomBetween(30, 365);
      baseSubscriptionData.currentPeriodStartDaysAgo = randomBetween(5, 25);
      baseSubscriptionData.currentPeriodEndDaysInFuture = randomBetween(5, 25);
      break;

    case 'active_with_trial':
      const trialConfig = randomChoice(TRIAL_CONFIGURATIONS);
      baseSubscriptionData.startedDaysAgo = randomBetween(1, trialConfig.days - 1);
      baseSubscriptionData.trialStartDaysAgo = baseSubscriptionData.startedDaysAgo;
      baseSubscriptionData.trialEndDaysInFuture = trialConfig.days - baseSubscriptionData.startedDaysAgo;
      baseSubscriptionData.currentPeriodStartDaysAgo = baseSubscriptionData.trialStartDaysAgo;
      baseSubscriptionData.currentPeriodEndDaysInFuture = baseSubscriptionData.trialEndDaysInFuture;
      baseSubscriptionData.metadata = {
        ...baseSubscriptionData.metadata,
        trial_type: trialConfig.name
      };
      break;

    case 'cancelled_subscription':
      baseSubscriptionData.startedDaysAgo = randomBetween(60, 365);
      baseSubscriptionData.cancelledDaysAgo = randomBetween(10, 60);
      baseSubscriptionData.endedDaysAgo = randomBetween(1, 10);
      baseSubscriptionData.currentPeriodStartDaysAgo = randomBetween(30, 60);
      baseSubscriptionData.currentPeriodEndDaysInFuture = randomBetween(-30, -1); // Ended in the past
      baseSubscriptionData.metadata = {
        ...baseSubscriptionData.metadata,
        cancellation_reason: randomChoice(['user_requested', 'payment_failed', 'feature_not_needed', 'too_expensive'])
      };
      break;

    case 'past_due':
      baseSubscriptionData.startedDaysAgo = randomBetween(45, 180);
      baseSubscriptionData.currentPeriodStartDaysAgo = randomBetween(10, 35);
      baseSubscriptionData.currentPeriodEndDaysInFuture = randomBetween(-5, -1); // Period ended recently
      baseSubscriptionData.metadata = {
        ...baseSubscriptionData.metadata,
        payment_attempts: randomBetween(1, 3),
        last_payment_error: 'card_declined'
      };
      break;

    case 'paused_subscription':
      baseSubscriptionData.startedDaysAgo = randomBetween(90, 270);
      baseSubscriptionData.currentPeriodStartDaysAgo = randomBetween(30, 60);
      baseSubscriptionData.currentPeriodEndDaysInFuture = randomBetween(180, 365); // Extended period while paused
      baseSubscriptionData.metadata = {
        ...baseSubscriptionData.metadata,
        pause_reason: randomChoice(['user_requested', 'payment_issue', 'vacation']),
        pause_duration: randomChoice(['1_month', '3_months', 'indefinite'])
      };
      break;

    case 'incomplete_subscription':
      baseSubscriptionData.startedDaysAgo = randomBetween(0, 3);
      baseSubscriptionData.currentPeriodStartDaysAgo = baseSubscriptionData.startedDaysAgo;
      baseSubscriptionData.currentPeriodEndDaysInFuture = randomBetween(25, 35);
      baseSubscriptionData.metadata = {
        ...baseSubscriptionData.metadata,
        incomplete_reason: randomChoice(['authentication_required', 'payment_method_required']),
        setup_attempts: randomBetween(1, 2)
      };
      break;

    default:
      baseSubscriptionData.startedDaysAgo = randomBetween(30, 180);
      baseSubscriptionData.currentPeriodStartDaysAgo = randomBetween(5, 25);
      baseSubscriptionData.currentPeriodEndDaysInFuture = randomBetween(5, 25);
  }

  return baseSubscriptionData;
}

/**
 * Select subscription scenario based on weights
 */
function selectSubscriptionScenario(): typeof SUBSCRIPTION_SCENARIOS[0] {
  const totalWeight = SUBSCRIPTION_SCENARIOS.reduce((sum, scenario) => sum + scenario.weight, 0);
  const random = Math.random() * totalWeight;
  
  let currentWeight = 0;
  for (const scenario of SUBSCRIPTION_SCENARIOS) {
    currentWeight += scenario.weight;
    if (random <= currentWeight) {
      return scenario;
    }
  }
  
  return SUBSCRIPTION_SCENARIOS[0]; // Fallback
}

/**
 * Seed subscriptions for customers
 */
export async function seedSubscriptions(prisma: PrismaClient, config: SeedConfig): Promise<string[]> {
  console.log('📊 Creating subscriptions...');
  
  // Get subscription products
  const subscriptionProducts = await prisma.product.findMany({
    where: { 
      type: 'SUBSCRIPTION',
      isActive: true 
    },
    select: { 
      id: true, 
      name: true, 
      price: true, 
      stripePriceId: true, 
      billingInterval: true 
    }
  });

  if (subscriptionProducts.length === 0) {
    console.log('⚠️ No subscription products found, skipping subscriptions');
    return [];
  }

  // Get customers with Stripe customer IDs
  const customers = await prisma.user.findMany({
    where: { 
      role: 'CUSTOMER',
      isActive: true,
      stripeCustomerId: { not: null }
    },
    select: { 
      id: true, 
      email: true, 
      stripeCustomerId: true 
    }
  });

  if (customers.length === 0) {
    console.log('⚠️ No customers with Stripe IDs found, skipping subscriptions');
    return [];
  }

  const subscriptionIds: string[] = [];
  let subscriptionIndex = 1;

  // Create subscriptions for a subset of customers (not all customers have subscriptions)
  const customersWithSubscriptions = customers.slice(0, Math.ceil(customers.length * 0.7)); // 70% of customers

  for (const customer of customersWithSubscriptions) {
    // Each customer can have 0-2 subscriptions
    const subscriptionCount = randomBoolean(0.6) ? (randomBoolean(0.3) ? 2 : 1) : 0;

    for (let i = 0; i < subscriptionCount; i++) {
      const scenario = selectSubscriptionScenario();
      const product = randomChoice(subscriptionProducts);
      
      if (!product.stripePriceId || !product.billingInterval || !customer.stripeCustomerId) {
        continue;
      }

      const subscriptionData = generateSubscriptionFromScenario(
        subscriptionIndex,
        customer.id,
        customer.stripeCustomerId,
        product.id,
        product.stripePriceId,
        Number(product.price),
        product.billingInterval,
        scenario
      );

      // Create the subscription
      const subscription = await prisma.subscription.create({
        data: {
          userId: subscriptionData.userId,
          productId: subscriptionData.productId,
          stripeSubscriptionId: subscriptionData.stripeSubscriptionId,
          stripeCustomerId: subscriptionData.stripeCustomerId,
          stripePriceId: subscriptionData.stripePriceId,
          status: subscriptionData.status,
          billingInterval: subscriptionData.billingInterval,
          unitPrice: subscriptionData.unitPrice,
          quantity: subscriptionData.quantity,
          currency: subscriptionData.currency,
          currentPeriodStart: daysAgo(subscriptionData.currentPeriodStartDaysAgo),
          currentPeriodEnd: subscriptionData.currentPeriodEndDaysInFuture > 0 
            ? daysFromNow(subscriptionData.currentPeriodEndDaysInFuture)
            : daysAgo(-subscriptionData.currentPeriodEndDaysInFuture),
          cancelAtPeriodEnd: subscriptionData.cancelAtPeriodEnd,
          trialStart: subscriptionData.trialStartDaysAgo ? daysAgo(subscriptionData.trialStartDaysAgo) : null,
          trialEnd: subscriptionData.trialEndDaysInFuture ? daysFromNow(subscriptionData.trialEndDaysInFuture) : null,
          startedAt: daysAgo(subscriptionData.startedDaysAgo),
          endedAt: subscriptionData.endedDaysAgo ? daysAgo(subscriptionData.endedDaysAgo) : null,
          cancelledAt: subscriptionData.cancelledDaysAgo ? daysAgo(subscriptionData.cancelledDaysAgo) : null,
          metadata: subscriptionData.metadata || null
        }
      });

      subscriptionIds.push(subscription.id);

      // Create audit log for subscription creation
      if (!config.skipAuditLogs) {
        await createAuditLog(
          prisma,
          'CREATE',
          'subscriptions',
          subscription.id,
          customer.id,
          {
            productId: product.id,
            productName: product.name,
            status: subscriptionData.status,
            billingInterval: subscriptionData.billingInterval,
            unitPrice: subscriptionData.unitPrice,
            scenario: scenario.scenario,
            source: 'database_seeding'
          }
        );
      }

      subscriptionIndex++;
    }
  }

  console.log(`✅ Created ${subscriptionIds.length} subscriptions for ${customersWithSubscriptions.length} customers`);
  return subscriptionIds;
}

/**
 * Get subscription statistics
 */
export async function getSubscriptionStatistics(prisma: PrismaClient): Promise<Record<string, number>> {
  const [
    totalSubscriptions,
    activeSubscriptions,
    trialingSubscriptions,
    cancelledSubscriptions,
    pastDueSubscriptions,
    pausedSubscriptions
  ] = await Promise.all([
    prisma.subscription.count(),
    prisma.subscription.count({ where: { status: 'ACTIVE' } }),
    prisma.subscription.count({ where: { status: 'TRIALING' } }),
    prisma.subscription.count({ where: { status: 'CANCELLED' } }),
    prisma.subscription.count({ where: { status: 'PAST_DUE' } }),
    prisma.subscription.count({ where: { status: 'PAUSED' } })
  ]);

  return {
    total: totalSubscriptions,
    active: activeSubscriptions,
    trialing: trialingSubscriptions,
    cancelled: cancelledSubscriptions,
    pastDue: pastDueSubscriptions,
    paused: pausedSubscriptions
  };
}

/**
 * Create additional subscription scenarios for testing
 */
export async function seedTestSubscriptionScenarios(prisma: PrismaClient, config: SeedConfig): Promise<void> {
  console.log('🧪 Creating additional subscription test scenarios...');
  
  // Get a test customer
  const testCustomer = await prisma.user.findFirst({
    where: { 
      role: 'CUSTOMER',
      email: 'john.doe@example.com',
      stripeCustomerId: { not: null }
    }
  });

  // Get a subscription product
  const basicPlan = await prisma.product.findFirst({
    where: { 
      type: 'SUBSCRIPTION',
      name: { contains: 'Basic' }
    }
  });

  if (!testCustomer || !basicPlan || !testCustomer.stripeCustomerId || !basicPlan.stripePriceId) {
    console.log('⚠️ Test customer or basic plan not found, skipping test scenarios');
    return;
  }

  // Create a subscription that's about to expire
  const expiringSubscription = await prisma.subscription.create({
    data: {
      userId: testCustomer.id,
      productId: basicPlan.id,
      stripeSubscriptionId: generateStripeId('sub', 'expiring_test'),
      stripeCustomerId: testCustomer.stripeCustomerId,
      stripePriceId: basicPlan.stripePriceId,
      status: 'ACTIVE',
      billingInterval: 'MONTH',
      unitPrice: Number(basicPlan.price),
      quantity: 1,
      currency: 'usd',
      currentPeriodStart: daysAgo(25),
      currentPeriodEnd: daysFromNow(5), // Expires in 5 days
      cancelAtPeriodEnd: true,
      startedAt: daysAgo(55),
      cancelledAt: daysAgo(10),
      metadata: {
        test_scenario: 'expiring_subscription',
        cancellation_reason: 'user_requested'
      }
    }
  });

  // Create a subscription with payment issues
  const paymentIssueSubscription = await prisma.subscription.create({
    data: {
      userId: testCustomer.id,
      productId: basicPlan.id,
      stripeSubscriptionId: generateStripeId('sub', 'payment_issue_test'),
      stripeCustomerId: testCustomer.stripeCustomerId,
      stripePriceId: basicPlan.stripePriceId,
      status: 'PAST_DUE',
      billingInterval: 'MONTH',
      unitPrice: Number(basicPlan.price),
      quantity: 1,
      currency: 'usd',
      currentPeriodStart: daysAgo(35),
      currentPeriodEnd: daysAgo(5), // Period ended 5 days ago
      cancelAtPeriodEnd: false,
      startedAt: daysAgo(95),
      metadata: {
        test_scenario: 'payment_issue',
        payment_attempts: 3,
        last_payment_error: 'insufficient_funds'
      }
    }
  });

  // Create audit logs for test subscriptions
  if (!config.skipAuditLogs) {
    const testSubscriptions = [expiringSubscription, paymentIssueSubscription];
    for (const subscription of testSubscriptions) {
      await createAuditLog(
        prisma,
        'CREATE',
        'subscriptions',
        subscription.id,
        testCustomer.id,
        {
          productId: basicPlan.id,
          status: subscription.status,
          purpose: 'testing_scenarios',
          source: 'database_seeding'
        }
      );
    }
  }

  console.log('✅ Created additional subscription test scenarios');
}

/**
 * Print subscription information for testing
 */
export function printSubscriptionInfo(): void {
  console.log('\n📊 Subscription Testing Information:');
  console.log('Subscription Statuses Created:');
  console.log('  ACTIVE: Regular active subscriptions (60%)');
  console.log('  TRIALING: Subscriptions in trial period (15%)');
  console.log('  CANCELLED: Cancelled subscriptions (12%)');
  console.log('  PAST_DUE: Subscriptions with payment issues (8%)');
  console.log('  PAUSED: Temporarily paused subscriptions (3%)');
  console.log('  INCOMPLETE: Incomplete setup subscriptions (2%)');
  console.log('\nTest Scenarios:');
  console.log('  Expiring subscription (cancels in 5 days)');
  console.log('  Payment issue subscription (past due)');
  console.log('  Trial subscriptions with different periods (7, 14, 30 days)');
  console.log('\nNote: All subscriptions use Stripe test mode IDs');
}