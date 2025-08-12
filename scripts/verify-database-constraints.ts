#!/usr/bin/env tsx

/* cSpell:words SETNULL setnull cus eslint */

/* eslint-disable no-console */

/**
 * Database Relationship and Constraint Verification Script
 *
 * This script comprehensively tests all database relationships and constraints
 * to ensure they are properly implemented and working at the database level.
 *
 * Test Categories:
 * 1. Foreign Key Constraints
 * 2. Cascade Delete Rules
 * 3. SET NULL Constraints
 * 4. RESTRICT Constraints
 * 5. Unique Constraints
 * 6. Check Constraints (if any)
 * 7. Relationship Queries
 */

import { PrismaClient } from "@prisma/client";
import { randomUUID } from "crypto";

const prisma = new PrismaClient({
  log: ["error", "warn"],
});

interface TestResult {
  category: string;
  test: string;
  status: "PASS" | "FAIL" | "SKIP";
  message: string;
  error?: unknown;
}

const results: TestResult[] = [];

function addResult(
  category: string,
  test: string,
  status: "PASS" | "FAIL" | "SKIP",
  message: string,
  error?: unknown
) {
  results.push({ category, test, status, message, error });
  const icon = status === "PASS" ? "✅" : status === "FAIL" ? "❌" : "⚠️";
  console.log(`${icon} [${category}] ${test}: ${message}`);
  if (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.log(`   Error details: ${errorMessage}`);
  }
}

async function testForeignKeyConstraints() {
  console.log("\n🔑 Testing Foreign Key Constraints...");

  // Test 1: Valid foreign key references work
  try {
    const user = await prisma.user.create({
      data: {
        email: `test_fk_${randomUUID()}@example.com`,
        name: "Test User FK",
      },
    });

    const product = await prisma.product.create({
      data: {
        name: "Test Product FK",
        price: 99.99,
        slug: `test-product-fk-${randomUUID()}`,
      },
    });

    const order = await prisma.order.create({
      data: {
        orderNumber: `ORDER-FK-${randomUUID()}`,
        userId: user.id,
        customerEmail: user.email,
        subtotal: 99.99,
        total: 99.99,
      },
    });

    await prisma.orderItem.create({
      data: {
        orderId: order.id,
        productId: product.id,
        productName: product.name,
        unitPrice: product.price,
        quantity: 1,
        totalPrice: product.price,
      },
    });

    addResult(
      "Foreign Keys",
      "Valid FK References",
      "PASS",
      "Valid foreign key references work correctly"
    );

    // Cleanup
    await prisma.orderItem.deleteMany({ where: { orderId: order.id } });
    await prisma.order.delete({ where: { id: order.id } });
    await prisma.product.delete({ where: { id: product.id } });
    await prisma.user.delete({ where: { id: user.id } });
  } catch (error) {
    addResult(
      "Foreign Keys",
      "Valid FK References",
      "FAIL",
      "Failed to create valid foreign key references",
      error
    );
  }

  // Test 2: Invalid foreign key references are rejected
  try {
    await prisma.order.create({
      data: {
        orderNumber: `ORDER-INVALID-${randomUUID()}`,
        userId: "non-existent-user-id",
        customerEmail: "test@example.com",
        subtotal: 99.99,
        total: 99.99,
      },
    });
    addResult(
      "Foreign Keys",
      "Invalid FK Rejection",
      "FAIL",
      "Invalid foreign key was not rejected"
    );
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "P2003") {
      addResult(
        "Foreign Keys",
        "Invalid FK Rejection",
        "PASS",
        "Invalid foreign key correctly rejected"
      );
    } else {
      addResult(
        "Foreign Keys",
        "Invalid FK Rejection",
        "FAIL",
        "Unexpected error for invalid FK",
        error
      );
    }
  }
}

async function testCascadeDeletes() {
  console.log("\n🗑️ Testing Cascade Delete Rules...");

  // Test 1: User deletion cascades to sessions and accounts
  try {
    const user = await prisma.user.create({
      data: {
        email: `test_cascade_${randomUUID()}@example.com`,
        name: "Test User Cascade",
      },
    });

    await prisma.session.create({
      data: {
        sessionToken: `session-${randomUUID()}`,
        userId: user.id,
        expires: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
      },
    });

    await prisma.account.create({
      data: {
        userId: user.id,
        type: "oauth",
        provider: "google",
        providerAccountId: `google-${randomUUID()}`,
      },
    });

    await prisma.paymentMethod.create({
      data: {
        userId: user.id,
        stripePaymentMethodId: `pm_${randomUUID()}`,
        type: "CARD",
        brand: "visa",
        last4: "4242",
      },
    });

    const sessionsBefore = await prisma.session.count({
      where: { userId: user.id },
    });
    const accountsBefore = await prisma.account.count({
      where: { userId: user.id },
    });
    const paymentMethodsBefore = await prisma.paymentMethod.count({
      where: { userId: user.id },
    });

    // Delete user - should cascade to sessions, accounts, and payment methods
    await prisma.user.delete({ where: { id: user.id } });

    const sessionsAfter = await prisma.session.count({
      where: { userId: user.id },
    });
    const accountsAfter = await prisma.account.count({
      where: { userId: user.id },
    });
    const paymentMethodsAfter = await prisma.paymentMethod.count({
      where: { userId: user.id },
    });

    if (
      sessionsBefore > 0 &&
      sessionsAfter === 0 &&
      accountsBefore > 0 &&
      accountsAfter === 0 &&
      paymentMethodsBefore > 0 &&
      paymentMethodsAfter === 0
    ) {
      addResult(
        "Cascade Deletes",
        "User Cascade",
        "PASS",
        "User deletion correctly cascades to related records"
      );
    } else {
      addResult(
        "Cascade Deletes",
        "User Cascade",
        "FAIL",
        `Cascade delete failed: sessions ${sessionsBefore}→${sessionsAfter}, accounts ${accountsBefore}→${accountsAfter}, payment methods ${paymentMethodsBefore}→${paymentMethodsAfter}`
      );
    }
  } catch (error) {
    addResult(
      "Cascade Deletes",
      "User Cascade",
      "FAIL",
      "Error testing user cascade delete",
      error
    );
  }

  // Test 2: Order deletion cascades to order items
  try {
    const user = await prisma.user.create({
      data: {
        email: `test_order_cascade_${randomUUID()}@example.com`,
        name: "Test User Order Cascade",
      },
    });

    const product = await prisma.product.create({
      data: {
        name: "Test Product Order Cascade",
        price: 99.99,
        slug: `test-product-order-cascade-${randomUUID()}`,
      },
    });

    const order = await prisma.order.create({
      data: {
        orderNumber: `ORDER-CASCADE-${randomUUID()}`,
        userId: user.id,
        customerEmail: user.email,
        subtotal: 99.99,
        total: 99.99,
      },
    });

    await prisma.orderItem.create({
      data: {
        orderId: order.id,
        productId: product.id,
        productName: product.name,
        unitPrice: product.price,
        quantity: 1,
        totalPrice: product.price,
      },
    });

    const orderItemsBefore = await prisma.orderItem.count({
      where: { orderId: order.id },
    });

    // Delete order - should cascade to order items
    await prisma.order.delete({ where: { id: order.id } });

    const orderItemsAfter = await prisma.orderItem.count({
      where: { orderId: order.id },
    });

    if (orderItemsBefore > 0 && orderItemsAfter === 0) {
      addResult(
        "Cascade Deletes",
        "Order Cascade",
        "PASS",
        "Order deletion correctly cascades to order items"
      );
    } else {
      addResult(
        "Cascade Deletes",
        "Order Cascade",
        "FAIL",
        `Order cascade failed: order items ${orderItemsBefore}→${orderItemsAfter}`
      );
    }

    // Cleanup
    await prisma.product.delete({ where: { id: product.id } });
    await prisma.user.delete({ where: { id: user.id } });
  } catch (error) {
    addResult(
      "Cascade Deletes",
      "Order Cascade",
      "FAIL",
      "Error testing order cascade delete",
      error
    );
  }
}

async function testSetNullConstraints() {
  console.log("\n🔗 Testing SET NULL Constraints...");

  // Test 1: Order userId set to NULL when user is deleted (for guest orders)
  try {
    const user = await prisma.user.create({
      data: {
        email: `test_set_null_${randomUUID()}@example.com`,
        name: "Test User Set NULL",
      },
    });

    const order = await prisma.order.create({
      data: {
        orderNumber: `ORDER-SETNULL-${randomUUID()}`,
        userId: user.id,
        customerEmail: user.email,
        subtotal: 99.99,
        total: 99.99,
      },
    });

    // Delete user - order.userId should be set to NULL
    await prisma.user.delete({ where: { id: user.id } });

    const updatedOrder = await prisma.order.findUnique({
      where: { id: order.id },
    });

    if (updatedOrder && updatedOrder.userId === null) {
      addResult(
        "SET NULL",
        "Order userId SET NULL",
        "PASS",
        "Order userId correctly set to NULL when user deleted"
      );
    } else {
      addResult(
        "SET NULL",
        "Order userId SET NULL",
        "FAIL",
        `Order userId not set to NULL: ${updatedOrder?.userId}`
      );
    }

    // Cleanup
    await prisma.order.delete({ where: { id: order.id } });
  } catch (error) {
    addResult(
      "SET NULL",
      "Order userId SET NULL",
      "FAIL",
      "Error testing SET NULL constraint",
      error
    );
  }

  // Test 2: Order paymentMethodId set to NULL when payment method is deleted
  try {
    const user = await prisma.user.create({
      data: {
        email: `test_payment_set_null_${randomUUID()}@example.com`,
        name: "Test User Payment Set NULL",
      },
    });

    const paymentMethod = await prisma.paymentMethod.create({
      data: {
        userId: user.id,
        stripePaymentMethodId: `pm_setnull_${randomUUID()}`,
        type: "CARD",
        brand: "visa",
        last4: "4242",
      },
    });

    const order = await prisma.order.create({
      data: {
        orderNumber: `ORDER-PM-SETNULL-${randomUUID()}`,
        userId: user.id,
        customerEmail: user.email,
        paymentMethodId: paymentMethod.id,
        subtotal: 99.99,
        total: 99.99,
      },
    });

    // Delete payment method - order.paymentMethodId should be set to NULL
    await prisma.paymentMethod.delete({ where: { id: paymentMethod.id } });

    const updatedOrder = await prisma.order.findUnique({
      where: { id: order.id },
    });

    if (updatedOrder && updatedOrder.paymentMethodId === null) {
      addResult(
        "SET NULL",
        "Order paymentMethodId SET NULL",
        "PASS",
        "Order paymentMethodId correctly set to NULL when payment method deleted"
      );
    } else {
      addResult(
        "SET NULL",
        "Order paymentMethodId SET NULL",
        "FAIL",
        `Order paymentMethodId not set to NULL: ${updatedOrder?.paymentMethodId}`
      );
    }

    // Cleanup
    await prisma.order.delete({ where: { id: order.id } });
    await prisma.user.delete({ where: { id: user.id } });
  } catch (error) {
    addResult(
      "SET NULL",
      "Order paymentMethodId SET NULL",
      "FAIL",
      "Error testing payment method SET NULL",
      error
    );
  }
}

async function testRestrictConstraints() {
  console.log("\n🚫 Testing RESTRICT Constraints...");

  // Test 1: Cannot delete product that has order items (RESTRICT)
  try {
    const user = await prisma.user.create({
      data: {
        email: `test_restrict_${randomUUID()}@example.com`,
        name: "Test User Restrict",
      },
    });

    const product = await prisma.product.create({
      data: {
        name: "Test Product Restrict",
        price: 99.99,
        slug: `test-product-restrict-${randomUUID()}`,
      },
    });

    const order = await prisma.order.create({
      data: {
        orderNumber: `ORDER-RESTRICT-${randomUUID()}`,
        userId: user.id,
        customerEmail: user.email,
        subtotal: 99.99,
        total: 99.99,
      },
    });

    await prisma.orderItem.create({
      data: {
        orderId: order.id,
        productId: product.id,
        productName: product.name,
        unitPrice: product.price,
        quantity: 1,
        totalPrice: product.price,
      },
    });

    // Try to delete product - should be restricted
    try {
      await prisma.product.delete({ where: { id: product.id } });
      addResult(
        "RESTRICT",
        "Product with OrderItems RESTRICT",
        "FAIL",
        "Product deletion was not restricted despite having order items"
      );
    } catch (deleteError) {
      if (
        deleteError instanceof Error &&
        "code" in deleteError &&
        deleteError.code === "P2003"
      ) {
        addResult(
          "RESTRICT",
          "Product with OrderItems RESTRICT",
          "PASS",
          "Product deletion correctly restricted when having order items"
        );
      } else {
        addResult(
          "RESTRICT",
          "Product with OrderItems RESTRICT",
          "FAIL",
          "Unexpected error for restricted delete",
          deleteError
        );
      }
    }

    // Cleanup
    await prisma.orderItem.deleteMany({ where: { orderId: order.id } });
    await prisma.order.delete({ where: { id: order.id } });
    await prisma.product.delete({ where: { id: product.id } });
    await prisma.user.delete({ where: { id: user.id } });
  } catch (error) {
    addResult(
      "RESTRICT",
      "Product with OrderItems RESTRICT",
      "FAIL",
      "Error testing RESTRICT constraint",
      error
    );
  }

  // Test 2: Cannot delete user that has active subscriptions (RESTRICT)
  try {
    const user = await prisma.user.create({
      data: {
        email: `test_subscription_restrict_${randomUUID()}@example.com`,
        name: "Test User Subscription Restrict",
        stripeCustomerId: `cus_restrict_${randomUUID()}`,
      },
    });

    const product = await prisma.product.create({
      data: {
        name: "Test Subscription Product",
        price: 29.99,
        slug: `test-subscription-product-${randomUUID()}`,
        type: "SUBSCRIPTION",
        billingInterval: "MONTH",
      },
    });

    await prisma.subscription.create({
      data: {
        userId: user.id,
        productId: product.id,
        stripeSubscriptionId: `sub_restrict_${randomUUID()}`,
        stripeCustomerId: user.stripeCustomerId!,
        stripePriceId: `price_restrict_${randomUUID()}`,
        billingInterval: "MONTH",
        unitPrice: 29.99,
        currentPeriodStart: new Date(),
        currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      },
    });

    // Try to delete user - should be restricted due to subscription
    try {
      await prisma.user.delete({ where: { id: user.id } });
      addResult(
        "RESTRICT",
        "User with Subscriptions RESTRICT",
        "FAIL",
        "User deletion was not restricted despite having subscriptions"
      );
    } catch (deleteError) {
      if (
        deleteError instanceof Error &&
        "code" in deleteError &&
        deleteError.code === "P2003"
      ) {
        addResult(
          "RESTRICT",
          "User with Subscriptions RESTRICT",
          "PASS",
          "User deletion correctly restricted when having subscriptions"
        );
      } else {
        addResult(
          "RESTRICT",
          "User with Subscriptions RESTRICT",
          "FAIL",
          "Unexpected error for restricted delete",
          deleteError
        );
      }
    }

    // Cleanup - delete in correct order
    await prisma.subscription.deleteMany({ where: { userId: user.id } });
    await prisma.product.delete({ where: { id: product.id } });
    await prisma.user.delete({ where: { id: user.id } });
  } catch (error) {
    addResult(
      "RESTRICT",
      "User with Subscriptions RESTRICT",
      "FAIL",
      "Error testing user subscription RESTRICT",
      error
    );
  }
}

async function testUniqueConstraints() {
  console.log("\n🔒 Testing Unique Constraints...");

  // Test 1: User email uniqueness
  try {
    const email = `unique_test_${randomUUID()}@example.com`;

    await prisma.user.create({
      data: {
        email,
        name: "First User",
      },
    });

    try {
      await prisma.user.create({
        data: {
          email, // Same email
          name: "Second User",
        },
      });
      addResult(
        "Unique Constraints",
        "User Email Unique",
        "FAIL",
        "Duplicate email was not rejected"
      );
    } catch (duplicateError) {
      if (
        duplicateError instanceof Error &&
        "code" in duplicateError &&
        duplicateError.code === "P2002"
      ) {
        addResult(
          "Unique Constraints",
          "User Email Unique",
          "PASS",
          "Duplicate email correctly rejected"
        );
      } else {
        addResult(
          "Unique Constraints",
          "User Email Unique",
          "FAIL",
          "Unexpected error for duplicate email",
          duplicateError
        );
      }
    }

    // Cleanup
    await prisma.user.deleteMany({ where: { email } });
  } catch (error) {
    addResult(
      "Unique Constraints",
      "User Email Unique",
      "FAIL",
      "Error testing email uniqueness",
      error
    );
  }

  // Test 2: Product slug uniqueness
  try {
    const slug = `unique-product-${randomUUID()}`;

    await prisma.product.create({
      data: {
        name: "First Product",
        price: 99.99,
        slug,
      },
    });

    try {
      await prisma.product.create({
        data: {
          name: "Second Product",
          price: 149.99,
          slug, // Same slug
        },
      });
      addResult(
        "Unique Constraints",
        "Product Slug Unique",
        "FAIL",
        "Duplicate product slug was not rejected"
      );
    } catch (duplicateError) {
      if (
        duplicateError instanceof Error &&
        "code" in duplicateError &&
        duplicateError.code === "P2002"
      ) {
        addResult(
          "Unique Constraints",
          "Product Slug Unique",
          "PASS",
          "Duplicate product slug correctly rejected"
        );
      } else {
        addResult(
          "Unique Constraints",
          "Product Slug Unique",
          "FAIL",
          "Unexpected error for duplicate slug",
          duplicateError
        );
      }
    }

    // Cleanup
    await prisma.product.deleteMany({ where: { slug } });
  } catch (error) {
    addResult(
      "Unique Constraints",
      "Product Slug Unique",
      "FAIL",
      "Error testing product slug uniqueness",
      error
    );
  }

  // Test 3: Order number uniqueness
  try {
    const orderNumber = `UNIQUE-ORDER-${randomUUID()}`;

    const user = await prisma.user.create({
      data: {
        email: `order_unique_${randomUUID()}@example.com`,
        name: "Order Unique Test",
      },
    });

    await prisma.order.create({
      data: {
        orderNumber,
        userId: user.id,
        customerEmail: user.email,
        subtotal: 99.99,
        total: 99.99,
      },
    });

    try {
      await prisma.order.create({
        data: {
          orderNumber, // Same order number
          userId: user.id,
          customerEmail: user.email,
          subtotal: 149.99,
          total: 149.99,
        },
      });
      addResult(
        "Unique Constraints",
        "Order Number Unique",
        "FAIL",
        "Duplicate order number was not rejected"
      );
    } catch (duplicateError) {
      if (
        duplicateError instanceof Error &&
        "code" in duplicateError &&
        duplicateError.code === "P2002"
      ) {
        addResult(
          "Unique Constraints",
          "Order Number Unique",
          "PASS",
          "Duplicate order number correctly rejected"
        );
      } else {
        addResult(
          "Unique Constraints",
          "Order Number Unique",
          "FAIL",
          "Unexpected error for duplicate order number",
          duplicateError
        );
      }
    }

    // Cleanup
    await prisma.order.deleteMany({ where: { orderNumber } });
    await prisma.user.delete({ where: { id: user.id } });
  } catch (error) {
    addResult(
      "Unique Constraints",
      "Order Number Unique",
      "FAIL",
      "Error testing order number uniqueness",
      error
    );
  }
}

async function testRelationshipQueries() {
  console.log("\n🔍 Testing Relationship Queries...");

  try {
    // Create test data with relationships
    const user = await prisma.user.create({
      data: {
        email: `relationship_test_${randomUUID()}@example.com`,
        name: "Relationship Test User",
        stripeCustomerId: `cus_rel_${randomUUID()}`,
      },
    });

    const product1 = await prisma.product.create({
      data: {
        name: "Relationship Test Product 1",
        price: 99.99,
        slug: `rel-product-1-${randomUUID()}`,
      },
    });

    const product2 = await prisma.product.create({
      data: {
        name: "Relationship Test Product 2",
        price: 149.99,
        slug: `rel-product-2-${randomUUID()}`,
        type: "SUBSCRIPTION",
        billingInterval: "MONTH",
      },
    });

    const paymentMethod = await prisma.paymentMethod.create({
      data: {
        userId: user.id,
        stripePaymentMethodId: `pm_rel_${randomUUID()}`,
        type: "CARD",
        brand: "visa",
        last4: "4242",
        isDefault: true,
      },
    });

    const order = await prisma.order.create({
      data: {
        orderNumber: `REL-ORDER-${randomUUID()}`,
        userId: user.id,
        customerEmail: user.email,
        paymentMethodId: paymentMethod.id,
        subtotal: 249.98,
        total: 249.98,
      },
    });

    await prisma.orderItem.createMany({
      data: [
        {
          orderId: order.id,
          productId: product1.id,
          productName: product1.name,
          unitPrice: product1.price,
          quantity: 1,
          totalPrice: product1.price,
        },
        {
          orderId: order.id,
          productId: product2.id,
          productName: product2.name,
          unitPrice: product2.price,
          quantity: 1,
          totalPrice: product2.price,
        },
      ],
    });

    const subscription = await prisma.subscription.create({
      data: {
        userId: user.id,
        productId: product2.id,
        stripeSubscriptionId: `sub_rel_${randomUUID()}`,
        stripeCustomerId: user.stripeCustomerId!,
        stripePriceId: `price_rel_${randomUUID()}`,
        billingInterval: "MONTH",
        unitPrice: product2.price,
        currentPeriodStart: new Date(),
        currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      },
    });

    // Test complex relationship queries
    const userWithRelations = await prisma.user.findUnique({
      where: { id: user.id },
      include: {
        orders: {
          include: {
            orderItems: {
              include: {
                product: true,
              },
            },
            paymentMethod: true,
          },
        },
        subscriptions: {
          include: {
            product: true,
          },
        },
        paymentMethods: true,
      },
    });

    let relationshipTests = 0;
    let relationshipPassed = 0;

    // Verify user has orders
    relationshipTests++;
    if (userWithRelations?.orders.length === 1) {
      relationshipPassed++;
    }

    // Verify order has order items
    relationshipTests++;
    if (userWithRelations?.orders[0]?.orderItems.length === 2) {
      relationshipPassed++;
    }

    // Verify order items have products
    relationshipTests++;
    if (
      userWithRelations?.orders[0]?.orderItems.every((item) => item.product)
    ) {
      relationshipPassed++;
    }

    // Verify order has payment method
    relationshipTests++;
    if (userWithRelations?.orders[0]?.paymentMethod?.id === paymentMethod.id) {
      relationshipPassed++;
    }

    // Verify user has subscriptions
    relationshipTests++;
    if (userWithRelations?.subscriptions.length === 1) {
      relationshipPassed++;
    }

    // Verify subscription has product
    relationshipTests++;
    if (userWithRelations?.subscriptions[0]?.product?.id === product2.id) {
      relationshipPassed++;
    }

    // Verify user has payment methods
    relationshipTests++;
    if (userWithRelations?.paymentMethods.length === 1) {
      relationshipPassed++;
    }

    if (relationshipPassed === relationshipTests) {
      addResult(
        "Relationship Queries",
        "Complex Relations",
        "PASS",
        `All ${relationshipTests} relationship queries work correctly`
      );
    } else {
      addResult(
        "Relationship Queries",
        "Complex Relations",
        "FAIL",
        `Only ${relationshipPassed}/${relationshipTests} relationship queries passed`
      );
    }

    // Cleanup
    await prisma.subscription.delete({ where: { id: subscription.id } });
    await prisma.orderItem.deleteMany({ where: { orderId: order.id } });
    await prisma.order.delete({ where: { id: order.id } });
    await prisma.paymentMethod.delete({ where: { id: paymentMethod.id } });
    await prisma.product.deleteMany({
      where: { id: { in: [product1.id, product2.id] } },
    });
    await prisma.user.delete({ where: { id: user.id } });

    addResult(
      "Relationship Queries",
      "Test Data Cleanup",
      "PASS",
      "Test data cleaned up successfully"
    );
  } catch (error) {
    addResult(
      "Relationship Queries",
      "Complex Relations",
      "FAIL",
      "Error testing relationship queries",
      error
    );
  }
}

async function testIndexPerformance() {
  console.log("\n📊 Testing Index Performance...");

  try {
    // Test if indexes are working by checking query plans
    // Note: This is a basic test - in production you'd use EXPLAIN ANALYZE

    const user = await prisma.user.create({
      data: {
        email: `index_test_${randomUUID()}@example.com`,
        name: "Index Test User",
      },
    });

    // Test email index
    const start1 = Date.now();
    await prisma.user.findUnique({ where: { email: user.email } });
    const emailTime = Date.now() - start1;

    // Test role index
    const start2 = Date.now();
    await prisma.user.findMany({ where: { role: "CUSTOMER" } });
    const roleTime = Date.now() - start2;

    // These should be very fast with proper indexes
    if (emailTime < 100 && roleTime < 100) {
      addResult(
        "Index Performance",
        "Query Speed",
        "PASS",
        `Indexed queries are fast: email (${emailTime}ms), role (${roleTime}ms)`
      );
    } else {
      addResult(
        "Index Performance",
        "Query Speed",
        "FAIL",
        `Indexed queries are slow: email (${emailTime}ms), role (${roleTime}ms)`
      );
    }

    // Cleanup
    await prisma.user.delete({ where: { id: user.id } });
  } catch (error) {
    addResult(
      "Index Performance",
      "Query Speed",
      "FAIL",
      "Error testing index performance",
      error
    );
  }
}

async function printSummary() {
  console.log("\n" + "=".repeat(80));
  console.log("🏁 DATABASE CONSTRAINT VERIFICATION SUMMARY");
  console.log("=".repeat(80));

  const categories = [...new Set(results.map((r) => r.category))];
  const totalTests = results.length;
  const totalPassed = results.filter((r) => r.status === "PASS").length;
  const totalFailed = results.filter((r) => r.status === "FAIL").length;
  const totalSkipped = results.filter((r) => r.status === "SKIP").length;

  categories.forEach((category) => {
    const categoryResults = results.filter((r) => r.category === category);
    const passed = categoryResults.filter((r) => r.status === "PASS").length;
    const failed = categoryResults.filter((r) => r.status === "FAIL").length;
    const skipped = categoryResults.filter((r) => r.status === "SKIP").length;

    console.log(`\n📂 ${category}:`);
    console.log(`   ✅ Passed: ${passed}`);
    console.log(`   ❌ Failed: ${failed}`);
    console.log(`   ⚠️  Skipped: ${skipped}`);
    console.log(`   📊 Total: ${categoryResults.length}`);
  });

  console.log("\n" + "-".repeat(80));
  console.log(`🎯 OVERALL RESULTS:`);
  console.log(`   ✅ Total Passed: ${totalPassed}`);
  console.log(`   ❌ Total Failed: ${totalFailed}`);
  console.log(`   ⚠️  Total Skipped: ${totalSkipped}`);
  console.log(`   📊 Total Tests: ${totalTests}`);

  const passRate =
    totalTests > 0 ? ((totalPassed / totalTests) * 100).toFixed(1) : "0.0";
  console.log(`   📈 Pass Rate: ${passRate}%`);

  if (totalFailed > 0) {
    console.log("\n❌ FAILED TESTS:");
    results
      .filter((r) => r.status === "FAIL")
      .forEach((result) => {
        console.log(
          `   • [${result.category}] ${result.test}: ${result.message}`
        );
      });
  }

  console.log("\n" + "=".repeat(80));

  if (totalFailed === 0) {
    console.log(
      "🎉 ALL DATABASE CONSTRAINTS AND RELATIONSHIPS ARE WORKING CORRECTLY!"
    );
  } else {
    console.log(
      "⚠️  SOME DATABASE CONSTRAINTS NEED ATTENTION. PLEASE REVIEW FAILED TESTS."
    );
  }

  console.log("=".repeat(80));

  return totalFailed === 0;
}

async function main() {
  console.log(
    "🗄️  Starting Database Relationship and Constraint Verification..."
  );
  console.log("=".repeat(80));

  try {
    // Connect to database
    await prisma.$connect();
    console.log("✅ Connected to database successfully\n");

    // Run all tests
    await testForeignKeyConstraints();
    await testCascadeDeletes();
    await testSetNullConstraints();
    await testRestrictConstraints();
    await testUniqueConstraints();
    await testRelationshipQueries();
    await testIndexPerformance();

    // Print summary
    const allPassed = await printSummary();

    // Exit with appropriate code
    process.exit(allPassed ? 0 : 1);
  } catch (error) {
    console.error("❌ Fatal error during constraint verification:", error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) {
  main();
}

export { main, results };
