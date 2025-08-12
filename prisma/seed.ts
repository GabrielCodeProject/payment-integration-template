import { PrismaClient } from "@prisma/client";
import * as bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Starting database seeding...");

  // Clear existing data (be careful in production!)
  console.log("🧹 Cleaning existing data...");
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

  console.log("👥 Creating users...");

  // Create admin user
  const _adminUser = await prisma.user.create({
    data: {
      id: "admin-user-001",
      email: "admin@example.com",
      name: "Admin User",
      hashedPassword: await bcrypt.hash("admin123!", 12),
      role: "ADMIN",
      emailVerified: new Date(),
      stripeCustomerId: "cus_admin_001",
      preferredCurrency: "usd",
      timezone: "America/New_York",
      isActive: true,
      twoFactorEnabled: false,
    },
  });

  // Create support user
  const _supportUser = await prisma.user.create({
    data: {
      id: "support-user-001",
      email: "support@example.com",
      name: "Support Agent",
      hashedPassword: await bcrypt.hash("support123!", 12),
      role: "SUPPORT",
      emailVerified: new Date(),
      preferredCurrency: "usd",
      timezone: "America/Los_Angeles",
      isActive: true,
    },
  });

  // Create customer users
  const customer1 = await prisma.user.create({
    data: {
      id: "customer-user-001",
      email: "john.doe@example.com",
      name: "John Doe",
      hashedPassword: await bcrypt.hash("customer123!", 12),
      role: "CUSTOMER",
      emailVerified: new Date(),
      stripeCustomerId: "cus_customer_001",
      preferredCurrency: "usd",
      timezone: "America/Chicago",
      phone: "+1-555-0101",
      isActive: true,
      lastLoginAt: new Date(Date.now() - 24 * 60 * 60 * 1000), // 1 day ago
    },
  });

  const customer2 = await prisma.user.create({
    data: {
      id: "customer-user-002",
      email: "jane.smith@example.com",
      name: "Jane Smith",
      hashedPassword: await bcrypt.hash("customer456!", 12),
      role: "CUSTOMER",
      emailVerified: new Date(),
      stripeCustomerId: "cus_customer_002",
      preferredCurrency: "eur",
      timezone: "Europe/London",
      phone: "+44-20-7946-0958",
      isActive: true,
      twoFactorEnabled: true,
      lastLoginAt: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 hours ago
    },
  });

  const customer3 = await prisma.user.create({
    data: {
      id: "customer-user-003",
      email: "mike.wilson@example.com",
      name: "Mike Wilson",
      hashedPassword: await bcrypt.hash("customer789!", 12),
      role: "CUSTOMER",
      emailVerified: null, // Unverified email
      stripeCustomerId: "cus_customer_003",
      preferredCurrency: "usd",
      timezone: "America/Los_Angeles",
      isActive: true,
    },
  });

  console.log("🛍️ Creating products...");

  // One-time purchase products
  const tshirt = await prisma.product.create({
    data: {
      id: "product-tshirt-001",
      name: "Premium Developer T-Shirt",
      description:
        "High-quality cotton t-shirt with witty developer quotes. Perfect for coding sessions and tech meetups.",
      shortDescription: "Comfortable cotton t-shirt for developers",
      price: 29.99,
      currency: "usd",
      compareAtPrice: 39.99,
      sku: "TSHIRT-DEV-001",
      isActive: true,
      isDigital: false,
      requiresShipping: true,
      stockQuantity: 100,
      lowStockThreshold: 10,
      slug: "premium-developer-tshirt",
      metaTitle: "Premium Developer T-Shirt - Comfortable & Stylish",
      metaDescription:
        "Get your hands on this premium developer t-shirt. Made from high-quality cotton.",
      tags: ["clothing", "developer", "cotton", "comfortable"],
      images: [
        "https://example.com/images/tshirt-front.jpg",
        "https://example.com/images/tshirt-back.jpg",
      ],
      thumbnail: "https://example.com/images/tshirt-thumb.jpg",
      stripePriceId: "price_tshirt_001",
      stripeProductId: "prod_tshirt_001",
      type: "ONE_TIME",
    },
  });

  const ebook = await prisma.product.create({
    data: {
      id: "product-ebook-001",
      name: "Complete Guide to Full-Stack Development",
      description:
        "A comprehensive 300-page guide covering modern full-stack development with React, Node.js, and PostgreSQL. Includes practical projects and real-world examples.",
      shortDescription: "Complete full-stack development guide",
      price: 49.99,
      currency: "usd",
      compareAtPrice: 79.99,
      sku: "EBOOK-FULLSTACK-001",
      isActive: true,
      isDigital: true,
      requiresShipping: false,
      stockQuantity: null, // Unlimited digital product
      slug: "complete-guide-fullstack-development",
      metaTitle:
        "Complete Guide to Full-Stack Development - Learn Modern Web Development",
      metaDescription:
        "Master full-stack development with this comprehensive guide covering React, Node.js, and more.",
      tags: ["ebook", "development", "react", "nodejs", "programming"],
      images: ["https://example.com/images/ebook-cover.jpg"],
      thumbnail: "https://example.com/images/ebook-thumb.jpg",
      stripePriceId: "price_ebook_001",
      stripeProductId: "prod_ebook_001",
      type: "ONE_TIME",
    },
  });

  // Subscription products
  const basicPlan = await prisma.product.create({
    data: {
      id: "product-basic-plan-001",
      name: "Basic Plan",
      description:
        "Access to basic features including project management, basic analytics, and email support.",
      shortDescription: "Basic tier with essential features",
      price: 9.99,
      currency: "usd",
      sku: "PLAN-BASIC-MONTHLY",
      isActive: true,
      isDigital: true,
      requiresShipping: false,
      stockQuantity: null,
      slug: "basic-plan-monthly",
      metaTitle: "Basic Plan - Get Started with Essential Features",
      metaDescription:
        "Start your journey with our basic plan featuring essential tools for productivity.",
      tags: ["subscription", "basic", "monthly", "starter"],
      images: ["https://example.com/images/basic-plan.jpg"],
      thumbnail: "https://example.com/images/basic-plan-thumb.jpg",
      stripePriceId: "price_basic_monthly_001",
      stripeProductId: "prod_basic_plan_001",
      type: "SUBSCRIPTION",
      billingInterval: "MONTH",
    },
  });

  const proPlan = await prisma.product.create({
    data: {
      id: "product-pro-plan-001",
      name: "Pro Plan",
      description:
        "Advanced features including unlimited projects, detailed analytics, priority support, and team collaboration tools.",
      shortDescription: "Professional tier with advanced features",
      price: 29.99,
      currency: "usd",
      compareAtPrice: 39.99,
      sku: "PLAN-PRO-MONTHLY",
      isActive: true,
      isDigital: true,
      requiresShipping: false,
      stockQuantity: null,
      slug: "pro-plan-monthly",
      metaTitle: "Pro Plan - Advanced Features for Professionals",
      metaDescription:
        "Unlock advanced features with our pro plan designed for professional use.",
      tags: ["subscription", "pro", "monthly", "advanced"],
      images: ["https://example.com/images/pro-plan.jpg"],
      thumbnail: "https://example.com/images/pro-plan-thumb.jpg",
      stripePriceId: "price_pro_monthly_001",
      stripeProductId: "prod_pro_plan_001",
      type: "SUBSCRIPTION",
      billingInterval: "MONTH",
    },
  });

  const _enterprisePlan = await prisma.product.create({
    data: {
      id: "product-enterprise-plan-001",
      name: "Enterprise Plan",
      description:
        "Enterprise-grade features including custom integrations, dedicated support, SLA guarantees, and advanced security features.",
      shortDescription: "Enterprise tier with premium features",
      price: 99.99,
      currency: "usd",
      sku: "PLAN-ENTERPRISE-MONTHLY",
      isActive: true,
      isDigital: true,
      requiresShipping: false,
      stockQuantity: null,
      slug: "enterprise-plan-monthly",
      metaTitle: "Enterprise Plan - Premium Features for Large Organizations",
      metaDescription:
        "Scale your business with our enterprise plan featuring premium tools and support.",
      tags: ["subscription", "enterprise", "monthly", "premium"],
      images: ["https://example.com/images/enterprise-plan.jpg"],
      thumbnail: "https://example.com/images/enterprise-plan-thumb.jpg",
      stripePriceId: "price_enterprise_monthly_001",
      stripeProductId: "prod_enterprise_plan_001",
      type: "SUBSCRIPTION",
      billingInterval: "MONTH",
    },
  });

  console.log("💳 Creating payment methods...");

  // Payment methods for customer1
  const paymentMethod1 = await prisma.paymentMethod.create({
    data: {
      id: "pm-customer1-card1",
      userId: customer1.id,
      stripePaymentMethodId: "pm_1234567890abcdef",
      type: "CARD",
      brand: "visa",
      last4: "4242",
      expiryMonth: 12,
      expiryYear: 2025,
      fingerprint: "fp_customer1_card1",
      isDefault: true,
      nickname: "Primary Card",
      billingAddress: {
        line1: "123 Main St",
        city: "Chicago",
        state: "IL",
        postal_code: "60601",
        country: "US",
      },
      isActive: true,
    },
  });

  // Payment methods for customer2
  const paymentMethod2 = await prisma.paymentMethod.create({
    data: {
      id: "pm-customer2-card1",
      userId: customer2.id,
      stripePaymentMethodId: "pm_abcdef1234567890",
      type: "CARD",
      brand: "mastercard",
      last4: "5555",
      expiryMonth: 8,
      expiryYear: 2026,
      fingerprint: "fp_customer2_card1",
      isDefault: true,
      nickname: "Business Card",
      billingAddress: {
        line1: "456 Oxford St",
        city: "London",
        postal_code: "W1C 1AP",
        country: "GB",
      },
      isActive: true,
    },
  });

  console.log("🎟️ Creating discount codes...");

  // Active discount codes
  const welcomeDiscount = await prisma.discountCode.create({
    data: {
      id: "discount-welcome-001",
      code: "WELCOME10",
      name: "Welcome Discount",
      description: "10% off for new customers",
      type: "PERCENTAGE",
      value: 10.0,
      maxUses: 1000,
      maxUsesPerCustomer: 1,
      currentUses: 25,
      minimumOrderAmount: 20.0,
      startsAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // 30 days ago
      expiresAt: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000), // 60 days from now
      isActive: true,
    },
  });

  const freeShipping = await prisma.discountCode.create({
    data: {
      id: "discount-freeship-001",
      code: "FREESHIP",
      name: "Free Shipping",
      description: "Free shipping on orders over $50",
      type: "FREE_SHIPPING",
      value: 0.0,
      maxUses: null, // Unlimited
      maxUsesPerCustomer: null,
      currentUses: 150,
      minimumOrderAmount: 50.0,
      startsAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000), // 10 days ago
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
      isActive: true,
    },
  });

  const _fixedDiscount = await prisma.discountCode.create({
    data: {
      id: "discount-save5-001",
      code: "SAVE5",
      name: "Save $5",
      description: "$5 off any purchase",
      type: "FIXED_AMOUNT",
      value: 5.0,
      currency: "usd",
      maxUses: 500,
      maxUsesPerCustomer: 2,
      currentUses: 89,
      minimumOrderAmount: 25.0,
      startsAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000), // 5 days ago
      expiresAt: new Date(Date.now() + 45 * 24 * 60 * 60 * 1000), // 45 days from now
      isActive: true,
    },
  });

  // Expired discount code
  const _expiredDiscount = await prisma.discountCode.create({
    data: {
      id: "discount-expired-001",
      code: "EXPIRED20",
      name: "Expired 20% Off",
      description: "20% off - this code has expired",
      type: "PERCENTAGE",
      value: 20.0,
      maxUses: 100,
      maxUsesPerCustomer: 1,
      currentUses: 45,
      startsAt: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000), // 90 days ago
      expiresAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000), // 10 days ago (expired)
      isActive: false,
    },
  });

  console.log("📋 Creating orders...");

  // Completed order for customer1
  const order1 = await prisma.order.create({
    data: {
      id: "order-001",
      orderNumber: "ORD-2024-001",
      userId: customer1.id,
      customerEmail: customer1.email,
      customerName: customer1.name,
      subtotal: 29.99,
      taxAmount: 2.4,
      shippingAmount: 5.99,
      discountAmount: 0.0,
      total: 38.38,
      currency: "usd",
      status: "DELIVERED",
      paymentStatus: "PAID",
      fulfillmentStatus: "FULFILLED",
      shippingAddress: {
        line1: "123 Main St",
        line2: "Apt 4B",
        city: "Chicago",
        state: "IL",
        postal_code: "60601",
        country: "US",
      },
      billingAddress: {
        line1: "123 Main St",
        line2: "Apt 4B",
        city: "Chicago",
        state: "IL",
        postal_code: "60601",
        country: "US",
      },
      shippingMethod: "Standard Shipping",
      trackingNumber: "TRACK123456789",
      stripePaymentIntentId: "pi_1234567890abcdef",
      stripeChargeId: "ch_1234567890abcdef",
      paymentMethodId: paymentMethod1.id,
      notes: "Please leave at front door",
      paidAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000), // 10 days ago
      shippedAt: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000), // 8 days ago
      deliveredAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000), // 5 days ago
      metadata: {
        source: "web",
        utm_campaign: "summer_sale",
      },
    },
  });

  // Order items for order1
  await prisma.orderItem.create({
    data: {
      id: "order-item-001",
      orderId: order1.id,
      productId: tshirt.id,
      productName: tshirt.name,
      productSku: tshirt.sku,
      productImage: tshirt.thumbnail,
      unitPrice: 29.99,
      quantity: 1,
      totalPrice: 29.99,
      metadata: {
        size: "L",
        color: "Navy Blue",
      },
    },
  });

  // Pending order for customer2 with discount
  const order2 = await prisma.order.create({
    data: {
      id: "order-002",
      orderNumber: "ORD-2024-002",
      userId: customer2.id,
      customerEmail: customer2.email,
      customerName: customer2.name,
      subtotal: 79.98,
      taxAmount: 6.4,
      shippingAmount: 0.0, // Free shipping applied
      discountAmount: 8.0, // 10% discount applied
      total: 78.38,
      currency: "usd",
      status: "PROCESSING",
      paymentStatus: "PAID",
      fulfillmentStatus: "UNFULFILLED",
      shippingAddress: {
        line1: "456 Oxford St",
        city: "London",
        postal_code: "W1C 1AP",
        country: "GB",
      },
      billingAddress: {
        line1: "456 Oxford St",
        city: "London",
        postal_code: "W1C 1AP",
        country: "GB",
      },
      shippingMethod: "International Express",
      stripePaymentIntentId: "pi_abcdef1234567890",
      stripeChargeId: "ch_abcdef1234567890",
      paymentMethodId: paymentMethod2.id,
      discountCodeId: welcomeDiscount.id,
      paidAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000), // 2 days ago
      metadata: {
        source: "mobile_app",
        referrer: "google_ads",
      },
    },
  });

  // Order items for order2
  await prisma.orderItem.createMany({
    data: [
      {
        id: "order-item-002",
        orderId: order2.id,
        productId: tshirt.id,
        productName: tshirt.name,
        productSku: tshirt.sku,
        productImage: tshirt.thumbnail,
        unitPrice: 29.99,
        quantity: 1,
        totalPrice: 29.99,
        metadata: {
          size: "M",
          color: "Black",
        },
      },
      {
        id: "order-item-003",
        orderId: order2.id,
        productId: ebook.id,
        productName: ebook.name,
        productSku: ebook.sku,
        productImage: ebook.thumbnail,
        unitPrice: 49.99,
        quantity: 1,
        totalPrice: 49.99,
      },
    ],
  });

  // Failed order for customer3
  const order3 = await prisma.order.create({
    data: {
      id: "order-003",
      orderNumber: "ORD-2024-003",
      userId: customer3.id,
      customerEmail: customer3.email,
      customerName: customer3.name,
      subtotal: 49.99,
      taxAmount: 4.0,
      shippingAmount: 0.0,
      discountAmount: 0.0,
      total: 53.99,
      currency: "usd",
      status: "CANCELLED",
      paymentStatus: "FAILED",
      fulfillmentStatus: "UNFULFILLED",
      billingAddress: {
        line1: "789 Tech Ave",
        city: "San Francisco",
        state: "CA",
        postal_code: "94105",
        country: "US",
      },
      stripePaymentIntentId: "pi_failed_payment_001",
      cancelledAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000), // 1 day ago
      internalNotes: "Payment failed due to insufficient funds",
      metadata: {
        source: "web",
        retry_count: 3,
      },
    },
  });

  // Order item for order3
  await prisma.orderItem.create({
    data: {
      id: "order-item-004",
      orderId: order3.id,
      productId: ebook.id,
      productName: ebook.name,
      productSku: ebook.sku,
      productImage: ebook.thumbnail,
      unitPrice: 49.99,
      quantity: 1,
      totalPrice: 49.99,
    },
  });

  console.log("📊 Creating subscriptions...");

  // Active subscription for customer1 (Basic Plan)
  const _subscription1 = await prisma.subscription.create({
    data: {
      id: "subscription-001",
      userId: customer1.id,
      productId: basicPlan.id,
      stripeSubscriptionId: "sub_1234567890abcdef",
      stripeCustomerId: customer1.stripeCustomerId!,
      stripePriceId: basicPlan.stripePriceId!,
      status: "ACTIVE",
      billingInterval: "MONTH",
      unitPrice: 9.99,
      quantity: 1,
      currency: "usd",
      currentPeriodStart: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000), // 15 days ago
      currentPeriodEnd: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000), // 15 days from now
      cancelAtPeriodEnd: false,
      startedAt: new Date(Date.now() - 45 * 24 * 60 * 60 * 1000), // 45 days ago
      metadata: {
        plan_change_history: [],
        original_plan: "basic",
      },
    },
  });

  // Active subscription for customer2 (Pro Plan with trial)
  const _subscription2 = await prisma.subscription.create({
    data: {
      id: "subscription-002",
      userId: customer2.id,
      productId: proPlan.id,
      stripeSubscriptionId: "sub_abcdef1234567890",
      stripeCustomerId: customer2.stripeCustomerId!,
      stripePriceId: proPlan.stripePriceId!,
      status: "TRIALING",
      billingInterval: "MONTH",
      unitPrice: 29.99,
      quantity: 1,
      currency: "usd",
      currentPeriodStart: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000), // 5 days ago
      currentPeriodEnd: new Date(Date.now() + 25 * 24 * 60 * 60 * 1000), // 25 days from now
      cancelAtPeriodEnd: false,
      trialStart: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000), // 5 days ago
      trialEnd: new Date(Date.now() + 9 * 24 * 60 * 60 * 1000), // 9 days from now (14-day trial)
      startedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000), // 5 days ago
      metadata: {
        trial_source: "landing_page_signup",
        upgrade_eligible: true,
      },
    },
  });

  // Cancelled subscription
  const _subscription3 = await prisma.subscription.create({
    data: {
      id: "subscription-003",
      userId: customer3.id,
      productId: basicPlan.id,
      stripeSubscriptionId: "sub_cancelled_001",
      stripeCustomerId: customer3.stripeCustomerId!,
      stripePriceId: basicPlan.stripePriceId!,
      status: "CANCELLED",
      billingInterval: "MONTH",
      unitPrice: 9.99,
      quantity: 1,
      currency: "usd",
      currentPeriodStart: new Date(Date.now() - 45 * 24 * 60 * 60 * 1000), // 45 days ago
      currentPeriodEnd: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000), // 15 days ago
      cancelAtPeriodEnd: true,
      startedAt: new Date(Date.now() - 75 * 24 * 60 * 60 * 1000), // 75 days ago
      endedAt: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000), // 15 days ago
      cancelledAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // 30 days ago
      metadata: {
        cancellation_reason: "user_requested",
        feedback: "Found a different solution",
      },
    },
  });

  console.log("🎫 Creating discount code usage records...");

  // Track discount code usage
  await prisma.userDiscountCode.createMany({
    data: [
      {
        id: "user-discount-001",
        userId: customer2.id,
        discountCodeId: welcomeDiscount.id,
        usageCount: 1,
        firstUsedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
        lastUsedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
      },
      {
        id: "user-discount-002",
        userId: customer1.id,
        discountCodeId: freeShipping.id,
        usageCount: 2,
        firstUsedAt: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000),
        lastUsedAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
      },
    ],
  });

  console.log("✅ Database seeding completed successfully!");
  console.log("\n📊 Seeded data summary:");
  console.log(`👥 Users: ${await prisma.user.count()}`);
  console.log(`🛍️ Products: ${await prisma.product.count()}`);
  console.log(`📋 Orders: ${await prisma.order.count()}`);
  console.log(`📦 Order Items: ${await prisma.orderItem.count()}`);
  console.log(`📊 Subscriptions: ${await prisma.subscription.count()}`);
  console.log(`💳 Payment Methods: ${await prisma.paymentMethod.count()}`);
  console.log(`🎟️ Discount Codes: ${await prisma.discountCode.count()}`);
  console.log(
    `🎫 User Discount Usages: ${await prisma.userDiscountCode.count()}`
  );

  console.log("\n🔑 Test login credentials:");
  console.log("Admin: admin@example.com / admin123!");
  console.log("Support: support@example.com / support123!");
  console.log("Customer 1: john.doe@example.com / customer123!");
  console.log("Customer 2: jane.smith@example.com / customer456!");
  console.log("Customer 3: mike.wilson@example.com / customer789!");

  console.log("\n🎟️ Test discount codes:");
  console.log("WELCOME10: 10% off for new customers");
  console.log("FREESHIP: Free shipping on orders over $50");
  console.log("SAVE5: $5 off any purchase");
  console.log("EXPIRED20: Expired 20% off code (for testing)");
}

main()
  .catch((e) => {
    console.error("❌ Error during seeding:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
