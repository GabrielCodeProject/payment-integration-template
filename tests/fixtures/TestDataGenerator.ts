import { faker } from '@faker-js/faker';
import { PrismaClient, UserRole, ProductType, BillingInterval, DiscountType } from '@prisma/client';

export class TestDataGenerator {
  private prisma: PrismaClient;
  
  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
  }
  
  // User generation
  generateUserData(overrides: Partial<any> = {}) {
    return {
      id: faker.string.uuid(),
      email: faker.internet.email(),
      name: faker.person.fullName(),
      phone: faker.phone.number(),
      hashedPassword: faker.internet.password(),
      twoFactorEnabled: faker.datatype.boolean(),
      isActive: true,
      role: faker.helpers.arrayElement(Object.values(UserRole)),
      stripeCustomerId: `cus_${faker.string.alphanumeric(14)}`,
      preferredCurrency: faker.helpers.arrayElement(['usd', 'eur', 'gbp']),
      timezone: faker.location.timeZone(),
      ...overrides
    };
  }
  
  async createTestUser(overrides: Partial<any> = {}) {
    const userData = this.generateUserData(overrides);
    return await this.prisma.user.create({ data: userData });
  }
  
  // Product generation
  generateProductData(overrides: Partial<any> = {}) {
    const name = faker.commerce.productName();
    return {
      id: faker.string.uuid(),
      name,
      description: faker.commerce.productDescription(),
      shortDescription: faker.lorem.sentence(),
      price: parseFloat(faker.commerce.price({ min: 10, max: 1000 })),
      currency: 'usd',
      compareAtPrice: null,
      sku: faker.string.alphanumeric(8).toUpperCase(),
      isActive: true,
      isDigital: faker.datatype.boolean(),
      requiresShipping: faker.datatype.boolean(),
      stockQuantity: faker.number.int({ min: 0, max: 1000 }),
      lowStockThreshold: faker.number.int({ min: 5, max: 50 }),
      slug: faker.helpers.slugify(name).toLowerCase(),
      metaTitle: name,
      metaDescription: faker.lorem.paragraph(),
      tags: faker.helpers.arrayElements([
        'electronics', 'clothing', 'books', 'home', 'sports', 'toys'
      ], { min: 1, max: 3 }),
      images: [faker.image.url(), faker.image.url()],
      thumbnail: faker.image.url(),
      stripePriceId: `price_${faker.string.alphanumeric(14)}`,
      stripeProductId: `prod_${faker.string.alphanumeric(14)}`,
      type: faker.helpers.arrayElement(Object.values(ProductType)),
      billingInterval: faker.helpers.arrayElement([...Object.values(BillingInterval), null]),
      ...overrides
    };
  }
  
  async createTestProduct(overrides: Partial<any> = {}) {
    const productData = this.generateProductData(overrides);
    return await this.prisma.product.create({ data: productData });
  }
  
  // Order generation
  generateOrderData(userId?: string, overrides: Partial<any> = {}) {
    const orderNumber = `ORD-${Date.now()}-${faker.string.alphanumeric(6).toUpperCase()}`;
    const subtotal = parseFloat(faker.commerce.price({ min: 50, max: 500 }));
    const taxAmount = subtotal * 0.08; // 8% tax
    const shippingAmount = faker.number.float({ min: 0, max: 25, fractionDigits: 2 });
    const discountAmount = faker.number.float({ min: 0, max: subtotal * 0.2, fractionDigits: 2 });
    
    return {
      id: faker.string.uuid(),
      orderNumber,
      userId,
      customerEmail: faker.internet.email(),
      customerName: faker.person.fullName(),
      subtotal,
      taxAmount,
      shippingAmount,
      discountAmount,
      total: subtotal + taxAmount + shippingAmount - discountAmount,
      currency: 'usd',
      status: 'PENDING',
      paymentStatus: 'PENDING',
      fulfillmentStatus: 'UNFULFILLED',
      shippingAddress: {
        line1: faker.location.streetAddress(),
        city: faker.location.city(),
        state: faker.location.state(),
        postalCode: faker.location.zipCode(),
        country: 'US'
      },
      billingAddress: {
        line1: faker.location.streetAddress(),
        city: faker.location.city(),
        state: faker.location.state(),
        postalCode: faker.location.zipCode(),
        country: 'US'
      },
      shippingMethod: faker.helpers.arrayElement(['standard', 'express', 'overnight']),
      stripePaymentIntentId: `pi_${faker.string.alphanumeric(14)}`,
      notes: faker.lorem.paragraph(),
      ...overrides
    };
  }
  
  async createTestOrder(userId?: string, overrides: Partial<any> = {}) {
    const orderData = this.generateOrderData(userId, overrides);
    return await this.prisma.order.create({ data: orderData });
  }
  
  // Subscription generation
  generateSubscriptionData(userId: string, productId: string, overrides: Partial<any> = {}) {
    const currentPeriodStart = new Date();
    const currentPeriodEnd = new Date();
    currentPeriodEnd.setMonth(currentPeriodEnd.getMonth() + 1);
    
    return {
      id: faker.string.uuid(),
      userId,
      productId,
      stripeSubscriptionId: `sub_${faker.string.alphanumeric(14)}`,
      stripeCustomerId: `cus_${faker.string.alphanumeric(14)}`,
      stripePriceId: `price_${faker.string.alphanumeric(14)}`,
      status: 'ACTIVE',
      billingInterval: faker.helpers.arrayElement(Object.values(BillingInterval)),
      unitPrice: parseFloat(faker.commerce.price({ min: 10, max: 100 })),
      quantity: faker.number.int({ min: 1, max: 5 }),
      currency: 'usd',
      currentPeriodStart,
      currentPeriodEnd,
      cancelAtPeriodEnd: false,
      ...overrides
    };
  }
  
  async createTestSubscription(userId: string, productId: string, overrides: Partial<any> = {}) {
    const subscriptionData = this.generateSubscriptionData(userId, productId, overrides);
    return await this.prisma.subscription.create({ data: subscriptionData });
  }
  
  // Discount code generation
  generateDiscountCodeData(overrides: Partial<any> = {}) {
    const code = faker.string.alphanumeric(8).toUpperCase();
    const type = faker.helpers.arrayElement(Object.values(DiscountType));
    
    return {
      id: faker.string.uuid(),
      code,
      name: `${code} Discount`,
      description: faker.lorem.sentence(),
      type,
      value: type === 'PERCENTAGE' 
        ? faker.number.int({ min: 5, max: 50 })
        : parseFloat(faker.commerce.price({ min: 5, max: 50 })),
      currency: type === 'FIXED_AMOUNT' ? 'usd' : undefined,
      maxUses: faker.helpers.maybe(() => faker.number.int({ min: 10, max: 1000 })),
      maxUsesPerCustomer: faker.helpers.maybe(() => faker.number.int({ min: 1, max: 5 })),
      currentUses: 0,
      minimumOrderAmount: faker.helpers.maybe(() => 
        parseFloat(faker.commerce.price({ min: 50, max: 200 }))
      ),
      startsAt: new Date(),
      expiresAt: faker.helpers.maybe(() => {
        const expiry = new Date();
        expiry.setDate(expiry.getDate() + faker.number.int({ min: 7, max: 90 }));
        return expiry;
      }),
      isActive: true,
      ...overrides
    };
  }
  
  async createTestDiscountCode(overrides: Partial<any> = {}) {
    const discountData = this.generateDiscountCodeData(overrides);
    return await this.prisma.discountCode.create({ data: discountData });
  }
  
  // Payment method generation
  generatePaymentMethodData(userId: string, overrides: Partial<any> = {}) {
    return {
      id: faker.string.uuid(),
      userId,
      stripePaymentMethodId: `pm_${faker.string.alphanumeric(14)}`,
      type: 'CARD',
      brand: faker.helpers.arrayElement(['visa', 'mastercard', 'amex', 'discover']),
      last4: faker.finance.creditCardNumber('####').slice(-4),
      expiryMonth: faker.number.int({ min: 1, max: 12 }),
      expiryYear: faker.number.int({ min: 2024, max: 2030 }),
      fingerprint: faker.string.alphanumeric(16),
      isDefault: faker.datatype.boolean(),
      nickname: faker.helpers.maybe(() => faker.lorem.words(2)),
      billingAddress: {
        line1: faker.location.streetAddress(),
        city: faker.location.city(),
        state: faker.location.state(),
        postalCode: faker.location.zipCode(),
        country: 'US'
      },
      isActive: true,
      ...overrides
    };
  }
  
  async createTestPaymentMethod(userId: string, overrides: Partial<any> = {}) {
    const paymentMethodData = this.generatePaymentMethodData(userId, overrides);
    return await this.prisma.paymentMethod.create({ data: paymentMethodData });
  }
  
  // Bulk data generation for load testing
  async generateBulkTestData(counts: {
    users?: number;
    products?: number;
    orders?: number;
    subscriptions?: number;
  } = {}) {
    const {
      users = 100,
      products = 50,
      orders = 200,
      subscriptions = 150
    } = counts;
    
    console.log(`🔄 Generating bulk test data...`);
    
    // Create users
    const userPromises = Array.from({ length: users }, () => this.createTestUser());
    const createdUsers = await Promise.all(userPromises);
    console.log(`✅ Created ${users} test users`);
    
    // Create products
    const productPromises = Array.from({ length: products }, () => this.createTestProduct());
    const createdProducts = await Promise.all(productPromises);
    console.log(`✅ Created ${products} test products`);
    
    // Create orders
    const orderPromises = Array.from({ length: orders }, () => {
      const randomUser = faker.helpers.arrayElement(createdUsers);
      return this.createTestOrder(randomUser.id);
    });
    const createdOrders = await Promise.all(orderPromises);
    console.log(`✅ Created ${orders} test orders`);
    
    // Create subscriptions
    const subscriptionPromises = Array.from({ length: subscriptions }, () => {
      const randomUser = faker.helpers.arrayElement(createdUsers);
      const randomProduct = faker.helpers.arrayElement(createdProducts);
      return this.createTestSubscription(randomUser.id, randomProduct.id);
    });
    const createdSubscriptions = await Promise.all(subscriptionPromises);
    console.log(`✅ Created ${subscriptions} test subscriptions`);
    
    console.log(`🎉 Bulk test data generation complete!`);
    
    return {
      users: createdUsers,
      products: createdProducts,
      orders: createdOrders,
      subscriptions: createdSubscriptions
    };
  }
  
  // Clean up test data
  async cleanupTestData() {
    await this.prisma.auditLog.deleteMany();
    await this.prisma.userDiscountCode.deleteMany();
    await this.prisma.orderItem.deleteMany();
    await this.prisma.order.deleteMany();
    await this.prisma.subscription.deleteMany();
    await this.prisma.paymentMethod.deleteMany();
    await this.prisma.discountCode.deleteMany();
    await this.prisma.product.deleteMany();
    await this.prisma.session.deleteMany();
    await this.prisma.account.deleteMany();
    await this.prisma.user.deleteMany();
  }
}