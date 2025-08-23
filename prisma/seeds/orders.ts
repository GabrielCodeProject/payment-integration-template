/**
 * Orders seeding module - Creates realistic order histories and customer journeys
 */

import { PrismaClient } from '@prisma/client';
import { OrderSeedData, SeedConfig } from './types.js';
import { 
  daysAgo, 
  generateOrderNumber, 
  generateStripeId, 
  createAuditLog, 
  randomChoice, 
  randomBetween, 
  randomBoolean 
} from './utils.js';

/**
 * Sample shipping addresses for orders
 */
const SHIPPING_ADDRESSES = [
  {
    line1: '123 Main Street',
    line2: 'Apt 4B',
    city: 'Chicago',
    state: 'IL',
    postal_code: '60601',
    country: 'US',
    name: 'John Doe'
  },
  {
    line1: '456 Oak Avenue',
    city: 'New York',
    state: 'NY',
    postal_code: '10001',
    country: 'US',
    name: 'Jane Smith'
  },
  {
    line1: '789 Pine Road',
    city: 'Los Angeles',
    state: 'CA',
    postal_code: '90210',
    country: 'US',
    name: 'Mike Wilson'
  },
  {
    line1: '101 Baker Street',
    city: 'London',
    postal_code: 'W1U 6TU',
    country: 'GB',
    name: 'Emma Davis'
  },
  {
    line1: '22 Rue de la Paix',
    city: 'Paris',
    postal_code: '75001',
    country: 'FR',
    name: 'Alex Chen'
  },
  {
    line1: 'Unter den Linden 1',
    city: 'Berlin',
    postal_code: '10117',
    country: 'DE',
    name: 'Maria Garcia'
  }
];

/**
 * Order templates for different scenarios
 */
const ORDER_SCENARIO_TEMPLATES = [
  {
    scenario: 'successful_delivery',
    status: 'DELIVERED' as const,
    paymentStatus: 'PAID' as const,
    fulfillmentStatus: 'FULFILLED' as const,
    weight: 40 // 40% of orders
  },
  {
    scenario: 'recently_shipped',
    status: 'SHIPPED' as const,
    paymentStatus: 'PAID' as const,
    fulfillmentStatus: 'FULFILLED' as const,
    weight: 20 // 20% of orders
  },
  {
    scenario: 'processing',
    status: 'PROCESSING' as const,
    paymentStatus: 'PAID' as const,
    fulfillmentStatus: 'UNFULFILLED' as const,
    weight: 15 // 15% of orders
  },
  {
    scenario: 'pending_payment',
    status: 'PENDING' as const,
    paymentStatus: 'PENDING' as const,
    fulfillmentStatus: 'UNFULFILLED' as const,
    weight: 10 // 10% of orders
  },
  {
    scenario: 'cancelled',
    status: 'CANCELLED' as const,
    paymentStatus: 'CANCELLED' as const,
    fulfillmentStatus: 'UNFULFILLED' as const,
    weight: 8 // 8% of orders
  },
  {
    scenario: 'failed_payment',
    status: 'CANCELLED' as const,
    paymentStatus: 'FAILED' as const,
    fulfillmentStatus: 'UNFULFILLED' as const,
    weight: 5 // 5% of orders
  },
  {
    scenario: 'refunded',
    status: 'REFUNDED' as const,
    paymentStatus: 'REFUNDED' as const,
    fulfillmentStatus: 'RETURNED' as const,
    weight: 2 // 2% of orders
  }
];

/**
 * Generate realistic order data based on scenario
 */
function generateOrderFromScenario(
  orderIndex: number,
  userId: string,
  userEmail: string,
  userName: string,
  productIds: string[],
  paymentMethodIds: string[],
  discountCodeIds: string[],
  scenario: typeof ORDER_SCENARIO_TEMPLATES[0]
): Omit<OrderSeedData, 'items'> & { items: OrderSeedData['items'] } {
  const baseOrderData = {
    orderNumber: generateOrderNumber(orderIndex),
    userId,
    customerEmail: userEmail,
    customerName: userName,
    currency: 'usd',
    status: scenario.status,
    paymentStatus: scenario.paymentStatus,
    fulfillmentStatus: scenario.fulfillmentStatus,
    shippingAddress: randomChoice(SHIPPING_ADDRESSES),
    billingAddress: randomChoice(SHIPPING_ADDRESSES),
    metadata: {
      source: randomChoice(['web', 'mobile_app', 'api']),
      user_agent: randomChoice(['Chrome/91.0', 'Safari/14.1', 'Firefox/89.0']),
      scenario: scenario.scenario
    },
    items: [] as OrderSeedData['items']
  };

  // Generate order items
  const itemCount = randomBetween(1, 3);
  let subtotal = 0;
  
  for (let i = 0; i < itemCount; i++) {
    const productId = randomChoice(productIds);
    const quantity = randomBetween(1, 2);
    const unitPrice = randomBetween(999, 9999) / 100; // $9.99 to $99.99
    const totalPrice = quantity * unitPrice;
    
    const item: any = {
      productId,
      quantity,
      unitPrice
    };
    
    if (randomBoolean(0.3)) {
      item.metadata = {
        size: randomChoice(['S', 'M', 'L', 'XL']),
        color: randomChoice(['Black', 'White', 'Navy', 'Gray'])
      };
    }
    
    baseOrderData.items.push(item);
    
    subtotal += totalPrice;
  }

  // Calculate financial details
  const taxRate = 0.08; // 8% tax
  const taxAmount = Math.round(subtotal * taxRate * 100) / 100;
  
  // Apply discount if available and scenario allows
  const hasDiscount = randomBoolean(0.3) && discountCodeIds.length > 0 && scenario.paymentStatus !== 'FAILED';
  const discountCodeId = hasDiscount ? randomChoice(discountCodeIds) : undefined;
  const discountAmount = hasDiscount ? Math.round(subtotal * 0.1 * 100) / 100 : 0; // 10% discount
  
  // Shipping calculation
  const needsShipping = randomBoolean(0.7); // 70% need shipping
  const shippingAmount = needsShipping && subtotal < 50 ? 9.99 : 0; // Free shipping over $50
  
  const total = subtotal + taxAmount + shippingAmount - discountAmount;

  // Time calculations based on scenario
  let createdDaysAgo: number;
  let paidDaysAgo: number | undefined;
  let shippedDaysAgo: number | undefined;
  let deliveredDaysAgo: number | undefined;

  switch (scenario.scenario) {
    case 'successful_delivery':
      createdDaysAgo = randomBetween(7, 60);
      paidDaysAgo = createdDaysAgo - randomBetween(0, 1);
      shippedDaysAgo = paidDaysAgo - randomBetween(1, 3);
      deliveredDaysAgo = shippedDaysAgo - randomBetween(2, 7);
      break;
    case 'recently_shipped':
      createdDaysAgo = randomBetween(3, 10);
      paidDaysAgo = createdDaysAgo - randomBetween(0, 1);
      shippedDaysAgo = paidDaysAgo - randomBetween(1, 2);
      break;
    case 'processing':
      createdDaysAgo = randomBetween(1, 5);
      paidDaysAgo = createdDaysAgo - randomBetween(0, 1);
      break;
    case 'pending_payment':
      createdDaysAgo = randomBetween(0, 3);
      break;
    case 'cancelled':
    case 'failed_payment':
      createdDaysAgo = randomBetween(1, 30);
      break;
    case 'refunded':
      createdDaysAgo = randomBetween(10, 90);
      paidDaysAgo = createdDaysAgo - randomBetween(0, 1);
      shippedDaysAgo = paidDaysAgo - randomBetween(1, 3);
      deliveredDaysAgo = shippedDaysAgo - randomBetween(2, 7);
      break;
    default:
      createdDaysAgo = randomBetween(1, 30);
  }

  return {
    ...baseOrderData,
    subtotal,
    taxAmount,
    shippingAmount,
    discountAmount,
    total,
    discountCodeId,
    paymentMethodId: paymentMethodIds.length > 0 ? randomChoice(paymentMethodIds) : undefined,
    stripePaymentIntentId: scenario.paymentStatus !== 'PENDING' 
      ? generateStripeId('pi', `order_${orderIndex}`)
      : undefined,
    createdDaysAgo,
    paidDaysAgo,
    shippedDaysAgo,
    deliveredDaysAgo
  };
}

/**
 * Select scenario based on weights
 */
function selectOrderScenario(): typeof ORDER_SCENARIO_TEMPLATES[0] {
  const totalWeight = ORDER_SCENARIO_TEMPLATES.reduce((sum, scenario) => sum + scenario.weight, 0);
  const random = Math.random() * totalWeight;
  
  let currentWeight = 0;
  for (const scenario of ORDER_SCENARIO_TEMPLATES) {
    currentWeight += scenario.weight;
    if (random <= currentWeight) {
      return scenario;
    }
  }
  
  return ORDER_SCENARIO_TEMPLATES[0]; // Fallback
}

/**
 * Seed orders for customers
 */
export async function seedOrders(prisma: PrismaClient, config: SeedConfig): Promise<string[]> {
  console.log('📋 Creating orders...');
  
  // Get required data
  const [customers, products, discountCodes] = await Promise.all([
    prisma.user.findMany({
      where: { role: 'CUSTOMER', isActive: true },
      select: { id: true, email: true, name: true }
    }),
    prisma.product.findMany({
      where: { isActive: true },
      select: { id: true, name: true, price: true, sku: true, images: true }
    }),
    prisma.discountCode.findMany({
      where: { isActive: true },
      select: { id: true }
    })
  ]);

  if (customers.length === 0 || products.length === 0) {
    console.log('⚠️ No customers or products found, skipping orders');
    return [];
  }

  const productIds = products.map(p => p.id);
  const discountCodeIds = discountCodes.map(d => d.id);
  const orderIds: string[] = [];

  // Create orders for each customer
  let orderIndex = 1;
  const ordersPerCustomer = Math.ceil(config.orderCount / customers.length);

  for (const customer of customers) {
    // Get payment methods for this customer
    const paymentMethods = await prisma.paymentMethod.findMany({
      where: { userId: customer.id, isActive: true },
      select: { id: true }
    });
    const paymentMethodIds = paymentMethods.map(pm => pm.id);

    // Create orders for this customer
    const customerOrderCount = Math.min(ordersPerCustomer, randomBetween(1, 4));
    
    for (let i = 0; i < customerOrderCount && orderIndex <= config.orderCount; i++) {
      const scenario = selectOrderScenario();
      const orderData = generateOrderFromScenario(
        orderIndex,
        customer.id,
        customer.email,
        customer.name || 'Unknown Customer',
        productIds,
        paymentMethodIds,
        discountCodeIds,
        scenario
      );

      // Create the order
      const order = await prisma.order.create({
        data: {
          orderNumber: orderData.orderNumber,
          userId: orderData.userId,
          customerEmail: orderData.customerEmail,
          customerName: orderData.customerName,
          subtotal: orderData.subtotal,
          taxAmount: orderData.taxAmount,
          shippingAmount: orderData.shippingAmount,
          discountAmount: orderData.discountAmount,
          total: orderData.total,
          currency: orderData.currency,
          status: orderData.status,
          paymentStatus: orderData.paymentStatus,
          fulfillmentStatus: orderData.fulfillmentStatus,
          shippingAddress: orderData.shippingAddress,
          billingAddress: orderData.billingAddress,
          shippingMethod: orderData.shippingAmount > 0 ? 'Standard Shipping' : 'Free Shipping',
          trackingNumber: orderData.shippedDaysAgo ? `TRACK${orderIndex.toString().padStart(9, '0')}` : null,
          stripePaymentIntentId: orderData.stripePaymentIntentId,
          stripeChargeId: orderData.stripePaymentIntentId ? orderData.stripePaymentIntentId.replace('pi_', 'ch_') : null,
          paymentMethodId: orderData.paymentMethodId,
          discountCodeId: orderData.discountCodeId,
          metadata: orderData.metadata,
          createdAt: daysAgo(orderData.createdDaysAgo),
          paidAt: orderData.paidDaysAgo ? daysAgo(orderData.paidDaysAgo) : null,
          shippedAt: orderData.shippedDaysAgo ? daysAgo(orderData.shippedDaysAgo) : null,
          deliveredAt: orderData.deliveredDaysAgo ? daysAgo(orderData.deliveredDaysAgo) : null,
          cancelledAt: (orderData.status === 'CANCELLED' || orderData.status === 'REFUNDED') 
            ? daysAgo(Math.max(1, orderData.createdDaysAgo - randomBetween(0, 2)))
            : null
        }
      });

      // Create order items
      for (let itemIndex = 0; itemIndex < orderData.items.length; itemIndex++) {
        const itemData = orderData.items[itemIndex]!;
        const product = products.find(p => p.id === itemData.productId);
        if (product) {
          await prisma.orderItem.create({
            data: {
              orderId: order.id,
              productId: itemData.productId,
              productName: product.name,
              productSku: product.sku,
              productImage: product.images[0] || null,
              unitPrice: itemData.unitPrice,
              quantity: itemData.quantity,
              totalPrice: itemData.unitPrice * itemData.quantity,
              metadata: itemData.metadata || null
            }
          });
        }
      }

      orderIds.push(order.id);

      // Create audit log for order creation
      if (!config.skipAuditLogs) {
        await createAuditLog(
          prisma,
          'CREATE',
          'orders',
          order.id,
          customer.id,
          {
            orderNumber: orderData.orderNumber,
            total: orderData.total,
            status: orderData.status,
            paymentStatus: orderData.paymentStatus,
            scenario: scenario.scenario,
            source: 'database_seeding'
          }
        );
      }

      orderIndex++;
    }
  }

  console.log(`✅ Created ${orderIds.length} orders`);
  return orderIds;
}

/**
 * Create user discount code usage records based on orders
 */
export async function seedUserDiscountCodes(prisma: PrismaClient, config: SeedConfig): Promise<void> {
  console.log('🎫 Creating discount code usage records...');
  
  // Get orders that used discount codes
  const ordersWithDiscounts = await prisma.order.findMany({
    where: { 
      discountCodeId: { not: null },
      userId: { not: null }
    },
    select: { 
      userId: true, 
      discountCodeId: true,
      createdAt: true
    }
  });

  // Group by user and discount code
  const usageMap = new Map<string, {
    userId: string;
    discountCodeId: string;
    firstUsed: Date;
    lastUsed: Date;
    count: number;
  }>();

  for (const order of ordersWithDiscounts) {
    if (!order.userId || !order.discountCodeId) continue;
    
    const key = `${order.userId}-${order.discountCodeId}`;
    const existing = usageMap.get(key);
    
    if (existing) {
      existing.count++;
      if (order.createdAt < existing.firstUsed) {
        existing.firstUsed = order.createdAt;
      }
      if (order.createdAt > existing.lastUsed) {
        existing.lastUsed = order.createdAt;
      }
    } else {
      usageMap.set(key, {
        userId: order.userId,
        discountCodeId: order.discountCodeId,
        firstUsed: order.createdAt,
        lastUsed: order.createdAt,
        count: 1
      });
    }
  }

  // Create user discount code records
  let index = 1;
  for (const usage of usageMap.values()) {
    await prisma.userDiscountCode.create({
      data: {
        userId: usage.userId,
        discountCodeId: usage.discountCodeId,
        usageCount: usage.count,
        firstUsedAt: usage.firstUsed,
        lastUsedAt: usage.lastUsed
      }
    });

    // Create audit log
    if (!config.skipAuditLogs) {
      await createAuditLog(
        prisma,
        'CREATE',
        'user_discount_codes',
        // ID will be auto-generated, use a placeholder for audit
        'auto-generated-id',
        usage.userId,
        {
          discountCodeId: usage.discountCodeId,
          usageCount: usage.count,
          source: 'database_seeding'
        }
      );
    }

    index++;
  }

  console.log(`✅ Created ${usageMap.size} discount code usage records`);
}

/**
 * Get order statistics
 */
export async function getOrderStatistics(prisma: PrismaClient): Promise<Record<string, number>> {
  const [
    totalOrders,
    paidOrders,
    shippedOrders,
    deliveredOrders,
    cancelledOrders,
    pendingOrders
  ] = await Promise.all([
    prisma.order.count(),
    prisma.order.count({ where: { paymentStatus: 'PAID' } }),
    prisma.order.count({ where: { status: 'SHIPPED' } }),
    prisma.order.count({ where: { status: 'DELIVERED' } }),
    prisma.order.count({ where: { status: 'CANCELLED' } }),
    prisma.order.count({ where: { status: 'PENDING' } })
  ]);

  return {
    total: totalOrders,
    paid: paidOrders,
    shipped: shippedOrders,
    delivered: deliveredOrders,
    cancelled: cancelledOrders,
    pending: pendingOrders
  };
}