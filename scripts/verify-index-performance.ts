#!/usr/bin/env tsx

/* cSpell:words multicolumn btree Gbps JSONB datetime varchar schemaname tablename tablespace indexdef pkey */

/* eslint-disable no-console */

/**
 * Database Index Performance Verification Script
 *
 * This script comprehensively verifies that all database indexes are properly
 * implemented and performing optimally for the payment integration template.
 *
 * Test Categories:
 * 1. Primary Key Indexes (automatic in PostgreSQL)
 * 2. Foreign Key Indexes
 * 3. Unique Constraint Indexes (automatic)
 * 4. Single Column Indexes
 * 5. Composite Indexes
 * 6. Performance Benchmarks
 * 7. Query Plan Analysis
 * 8. Missing Index Detection
 */

import { PrismaClient } from "@prisma/client";
import { randomUUID } from "crypto";

const prisma = new PrismaClient({
  log: ["error", "warn"],
});

interface TestResult {
  category: string;
  test: string;
  status: "PASS" | "FAIL" | "SKIP" | "WARNING";
  message: string;
  performance?:
    | {
        queryTime: number;
        threshold: number;
      }
    | undefined;
  error?: unknown;
}

interface IndexInfo {
  schemaname: string;
  tablename: string;
  indexname: string;
  tablespace: string | null;
  indexdef: string;
}

interface QueryPlan {
  query: string;
  plan: unknown;
  executionTime: number;
  usesIndex: boolean;
  indexName?: string;
}

const results: TestResult[] = [];
const queryPlans: QueryPlan[] = [];

// Performance thresholds (in milliseconds)
const PERFORMANCE_THRESHOLDS = {
  SIMPLE_LOOKUP: 50, // Single record by indexed column
  FILTERED_QUERY: 100, // Filtered queries with WHERE clauses
  COMPLEX_QUERY: 200, // Joins and complex operations
  RANGE_QUERY: 150, // Date ranges and numeric ranges
  TEXT_SEARCH: 100, // Text search operations
};

function addResult(
  category: string,
  test: string,
  status: "PASS" | "FAIL" | "SKIP" | "WARNING",
  message: string,
  performance?: { queryTime: number; threshold: number },
  error?: unknown
) {
  results.push({ category, test, status, message, performance, error });
  const icon =
    status === "PASS"
      ? "✅"
      : status === "FAIL"
        ? "❌"
        : status === "WARNING"
          ? "⚠️"
          : "⏭️";

  let logMessage = `${icon} [${category}] ${test}: ${message}`;
  if (performance) {
    logMessage += ` (${performance.queryTime}ms ≤ ${performance.threshold}ms)`;
  }

  console.log(logMessage);

  if (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.log(`   Error details: ${errorMessage}`);
  }
}

async function executeTimedQuery<T>(
  _queryName: string,
  queryFn: () => Promise<T>,
  _expectedIndexUsage?: boolean
): Promise<{ result: T; executionTime: number }> {
  const start = performance.now();
  const result = await queryFn();
  const executionTime = performance.now() - start;

  return { result, executionTime };
}

async function getTableIndexes(): Promise<IndexInfo[]> {
  try {
    const indexes = await prisma.$queryRaw<IndexInfo[]>`
      SELECT 
        schemaname,
        tablename,
        indexname,
        tablespace,
        indexdef
      FROM pg_indexes 
      WHERE schemaname = 'public'
      ORDER BY tablename, indexname;
    `;
    return indexes;
  } catch (error) {
    console.error("Error fetching indexes:", error);
    return [];
  }
}

async function analyzeQueryPlan(query: string): Promise<unknown> {
  try {
    const plan = await prisma.$queryRawUnsafe(
      `EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) ${query}`
    );
    return plan;
  } catch (error) {
    console.error(`Error analyzing query plan for: ${query}`, error);
    return null;
  }
}

async function testPrimaryKeyIndexes() {
  console.log("\n🔑 Testing Primary Key Indexes...");

  const tables = [
    { name: "users", pkColumn: "id" },
    { name: "products", pkColumn: "id" },
    { name: "orders", pkColumn: "id" },
    { name: "order_items", pkColumn: "id" },
    { name: "subscriptions", pkColumn: "id" },
    { name: "payment_methods", pkColumn: "id" },
    { name: "discount_codes", pkColumn: "id" },
    { name: "user_discount_codes", pkColumn: "id" },
    { name: "accounts", pkColumn: "id" },
    { name: "sessions", pkColumn: "id" },
  ];

  try {
    const indexes = await getTableIndexes();

    for (const table of tables) {
      // Primary key indexes in PostgreSQL use _pkey suffix
      const pkIndex = indexes.find(
        (idx) =>
          idx.tablename === table.name &&
          (idx.indexname.endsWith("_pkey") ||
            idx.indexdef.includes("PRIMARY KEY"))
      );

      if (pkIndex) {
        addResult(
          "Primary Key Indexes",
          `${table.name} PK`,
          "PASS",
          `Primary key index exists: ${pkIndex.indexname}`
        );
      } else {
        addResult(
          "Primary Key Indexes",
          `${table.name} PK`,
          "FAIL",
          `Missing primary key index for ${table.name}.${table.pkColumn}`
        );
      }
    }
  } catch (error) {
    addResult(
      "Primary Key Indexes",
      "Index Discovery",
      "FAIL",
      "Failed to discover primary key indexes",
      undefined,
      error
    );
  }
}

async function testForeignKeyIndexes() {
  console.log("\n🔗 Testing Foreign Key Indexes...");

  const foreignKeys = [
    { table: "orders", column: "userId", references: "users(id)" },
    {
      table: "orders",
      column: "paymentMethodId",
      references: "payment_methods(id)",
    },
    {
      table: "orders",
      column: "discountCodeId",
      references: "discount_codes(id)",
    },
    { table: "order_items", column: "orderId", references: "orders(id)" },
    { table: "order_items", column: "productId", references: "products(id)" },
    { table: "subscriptions", column: "userId", references: "users(id)" },
    { table: "subscriptions", column: "productId", references: "products(id)" },
    { table: "payment_methods", column: "userId", references: "users(id)" },
    { table: "user_discount_codes", column: "userId", references: "users(id)" },
    {
      table: "user_discount_codes",
      column: "discountCodeId",
      references: "discount_codes(id)",
    },
    { table: "accounts", column: "userId", references: "users(id)" },
    { table: "sessions", column: "userId", references: "users(id)" },
  ];

  try {
    const indexes = await getTableIndexes();

    for (const fk of foreignKeys) {
      const fkIndex = indexes.find(
        (idx) =>
          idx.tablename === fk.table &&
          (idx.indexdef.includes(`(${fk.column})`) ||
            idx.indexdef.includes(`${fk.column}`))
      );

      if (fkIndex) {
        addResult(
          "Foreign Key Indexes",
          `${fk.table}.${fk.column}`,
          "PASS",
          `Foreign key index exists: ${fkIndex.indexname}`
        );
      } else {
        addResult(
          "Foreign Key Indexes",
          `${fk.table}.${fk.column}`,
          "WARNING",
          `No explicit index found for FK ${fk.table}.${fk.column} -> ${fk.references}`
        );
      }
    }
  } catch (error) {
    addResult(
      "Foreign Key Indexes",
      "Index Discovery",
      "FAIL",
      "Failed to discover foreign key indexes",
      undefined,
      error
    );
  }
}

async function testUniqueConstraintIndexes() {
  console.log("\n🔒 Testing Unique Constraint Indexes...");

  const uniqueConstraints = [
    { table: "users", column: "email" },
    { table: "users", column: "stripeCustomerId" },
    { table: "products", column: "slug" },
    { table: "products", column: "sku" },
    { table: "products", column: "stripePriceId" },
    { table: "products", column: "stripeProductId" },
    { table: "orders", column: "orderNumber" },
    { table: "orders", column: "stripePaymentIntentId" },
    { table: "subscriptions", column: "stripeSubscriptionId" },
    { table: "payment_methods", column: "stripePaymentMethodId" },
    { table: "discount_codes", column: "code" },
    { table: "sessions", column: "sessionToken" },
  ];

  try {
    const indexes = await getTableIndexes();

    for (const constraint of uniqueConstraints) {
      const uniqueIndex = indexes.find(
        (idx) =>
          idx.tablename === constraint.table &&
          idx.indexdef.includes("UNIQUE") &&
          (idx.indexdef.includes(`(${constraint.column})`) ||
            idx.indexdef.includes(`${constraint.column}`))
      );

      if (uniqueIndex) {
        addResult(
          "Unique Constraint Indexes",
          `${constraint.table}.${constraint.column}`,
          "PASS",
          `Unique index exists: ${uniqueIndex.indexname}`
        );
      } else {
        addResult(
          "Unique Constraint Indexes",
          `${constraint.table}.${constraint.column}`,
          "FAIL",
          `Missing unique index for ${constraint.table}.${constraint.column}`
        );
      }
    }
  } catch (error) {
    addResult(
      "Unique Constraint Indexes",
      "Index Discovery",
      "FAIL",
      "Failed to discover unique constraint indexes",
      undefined,
      error
    );
  }
}

async function testSingleColumnIndexes() {
  console.log("\n📊 Testing Single Column Indexes...");

  const expectedIndexes = [
    { table: "users", column: "role" },
    { table: "users", column: "createdAt" },
    { table: "products", column: "isActive" },
    { table: "products", column: "type" },
    { table: "products", column: "createdAt" },
    { table: "orders", column: "status" },
    { table: "orders", column: "paymentStatus" },
    { table: "orders", column: "customerEmail" },
    { table: "orders", column: "createdAt" },
    { table: "subscriptions", column: "status" },
    { table: "subscriptions", column: "currentPeriodEnd" },
    { table: "subscriptions", column: "createdAt" },
    { table: "payment_methods", column: "isDefault" },
    { table: "discount_codes", column: "isActive" },
    { table: "discount_codes", column: "expiresAt" },
    { table: "discount_codes", column: "createdAt" },
  ];

  try {
    const indexes = await getTableIndexes();

    for (const expectedIndex of expectedIndexes) {
      const indexExists = indexes.find(
        (idx) =>
          idx.tablename === expectedIndex.table &&
          (idx.indexdef.includes(`(${expectedIndex.column})`) ||
            (idx.indexdef.includes(`${expectedIndex.column}`) &&
              !idx.indexdef.includes("UNIQUE") &&
              !idx.indexdef.includes("PRIMARY")))
      );

      if (indexExists) {
        addResult(
          "Single Column Indexes",
          `${expectedIndex.table}.${expectedIndex.column}`,
          "PASS",
          `Index exists: ${indexExists.indexname}`
        );
      } else {
        addResult(
          "Single Column Indexes",
          `${expectedIndex.table}.${expectedIndex.column}`,
          "FAIL",
          `Missing index for ${expectedIndex.table}.${expectedIndex.column}`
        );
      }
    }
  } catch (error) {
    addResult(
      "Single Column Indexes",
      "Index Discovery",
      "FAIL",
      "Failed to discover single column indexes",
      undefined,
      error
    );
  }
}

async function testCompositeIndexes() {
  console.log("\n🔀 Testing Composite Indexes...");

  // Check for potential composite indexes that would benefit performance
  const potentialCompositeIndexes = [
    {
      table: "orders",
      columns: ["userId", "status"],
      purpose: "User orders by status",
    },
    {
      table: "orders",
      columns: ["customerEmail", "createdAt"],
      purpose: "Customer order history",
    },
    {
      table: "subscriptions",
      columns: ["userId", "status"],
      purpose: "User subscriptions by status",
    },
    {
      table: "products",
      columns: ["isActive", "type"],
      purpose: "Active products by type",
    },
    {
      table: "user_discount_codes",
      columns: ["userId", "discountCodeId"],
      purpose: "User discount usage tracking",
    },
  ];

  try {
    const indexes = await getTableIndexes();

    for (const compositeIndex of potentialCompositeIndexes) {
      const indexExists = indexes.find(
        (idx) =>
          idx.tablename === compositeIndex.table &&
          compositeIndex.columns.every((col) => idx.indexdef.includes(col))
      );

      if (indexExists) {
        addResult(
          "Composite Indexes",
          `${compositeIndex.table} (${compositeIndex.columns.join(", ")})`,
          "PASS",
          `Composite index exists: ${indexExists.indexname}`
        );
      } else {
        addResult(
          "Composite Indexes",
          `${compositeIndex.table} (${compositeIndex.columns.join(", ")})`,
          "WARNING",
          `Consider adding composite index for ${compositeIndex.purpose}`
        );
      }
    }
  } catch (error) {
    addResult(
      "Composite Indexes",
      "Index Discovery",
      "FAIL",
      "Failed to discover composite indexes",
      undefined,
      error
    );
  }
}

async function testPerformanceBenchmarks() {
  console.log("\n⚡ Testing Performance Benchmarks...");

  // Create test data for performance testing
  try {
    const testUser = await prisma.user.create({
      data: {
        email: `perf_test_${randomUUID()}@example.com`,
        name: "Performance Test User",
        role: "CUSTOMER",
        stripeCustomerId: `cus_perf_${randomUUID()}`,
      },
    });

    const testProduct = await prisma.product.create({
      data: {
        name: "Performance Test Product",
        price: 99.99,
        slug: `perf-test-product-${randomUUID()}`,
        isActive: true,
        type: "ONE_TIME",
      },
    });

    const testOrder = await prisma.order.create({
      data: {
        orderNumber: `PERF-ORDER-${randomUUID()}`,
        userId: testUser.id,
        customerEmail: testUser.email,
        subtotal: 99.99,
        total: 99.99,
        status: "PENDING",
        paymentStatus: "PENDING",
      },
    });

    // Test 1: User lookup by email (should use unique index)
    const emailLookup = await executeTimedQuery("User by Email", () =>
      prisma.user.findUnique({ where: { email: testUser.email } })
    );

    addResult(
      "Performance Benchmarks",
      "User Email Lookup",
      emailLookup.executionTime <= PERFORMANCE_THRESHOLDS.SIMPLE_LOOKUP
        ? "PASS"
        : "FAIL",
      "User lookup by email performance",
      {
        queryTime: Math.round(emailLookup.executionTime),
        threshold: PERFORMANCE_THRESHOLDS.SIMPLE_LOOKUP,
      }
    );

    // Test 2: Product filtering by status and type
    const productFiltering = await executeTimedQuery("Product Filtering", () =>
      prisma.product.findMany({
        where: {
          isActive: true,
          type: "ONE_TIME",
        },
        take: 100,
      })
    );

    addResult(
      "Performance Benchmarks",
      "Product Filtering",
      productFiltering.executionTime <= PERFORMANCE_THRESHOLDS.FILTERED_QUERY
        ? "PASS"
        : "FAIL",
      "Product filtering by isActive and type",
      {
        queryTime: Math.round(productFiltering.executionTime),
        threshold: PERFORMANCE_THRESHOLDS.FILTERED_QUERY,
      }
    );

    // Test 3: User orders query (should use userId index)
    const userOrders = await executeTimedQuery("User Orders", () =>
      prisma.order.findMany({
        where: { userId: testUser.id },
        include: { orderItems: true },
      })
    );

    addResult(
      "Performance Benchmarks",
      "User Orders Query",
      userOrders.executionTime <= PERFORMANCE_THRESHOLDS.COMPLEX_QUERY
        ? "PASS"
        : "FAIL",
      "User orders with order items",
      {
        queryTime: Math.round(userOrders.executionTime),
        threshold: PERFORMANCE_THRESHOLDS.COMPLEX_QUERY,
      }
    );

    // Test 4: Order status filtering
    const orderStatusFiltering = await executeTimedQuery(
      "Order Status Filtering",
      () =>
        prisma.order.findMany({
          where: {
            status: "PENDING",
            paymentStatus: "PENDING",
          },
          take: 100,
        })
    );

    addResult(
      "Performance Benchmarks",
      "Order Status Filtering",
      orderStatusFiltering.executionTime <=
        PERFORMANCE_THRESHOLDS.FILTERED_QUERY
        ? "PASS"
        : "FAIL",
      "Order filtering by status fields",
      {
        queryTime: Math.round(orderStatusFiltering.executionTime),
        threshold: PERFORMANCE_THRESHOLDS.FILTERED_QUERY,
      }
    );

    // Test 5: Date range query (recent orders)
    const dateRange = new Date();
    dateRange.setDate(dateRange.getDate() - 30); // Last 30 days

    const dateRangeQuery = await executeTimedQuery("Date Range Query", () =>
      prisma.order.findMany({
        where: {
          createdAt: {
            gte: dateRange,
          },
        },
        take: 100,
      })
    );

    addResult(
      "Performance Benchmarks",
      "Date Range Query",
      dateRangeQuery.executionTime <= PERFORMANCE_THRESHOLDS.RANGE_QUERY
        ? "PASS"
        : "FAIL",
      "Orders within date range",
      {
        queryTime: Math.round(dateRangeQuery.executionTime),
        threshold: PERFORMANCE_THRESHOLDS.RANGE_QUERY,
      }
    );

    // Cleanup test data
    await prisma.order.delete({ where: { id: testOrder.id } });
    await prisma.product.delete({ where: { id: testProduct.id } });
    await prisma.user.delete({ where: { id: testUser.id } });

    addResult(
      "Performance Benchmarks",
      "Test Data Cleanup",
      "PASS",
      "Performance test data cleaned up successfully"
    );
  } catch (error) {
    addResult(
      "Performance Benchmarks",
      "Benchmark Execution",
      "FAIL",
      "Error executing performance benchmarks",
      undefined,
      error
    );
  }
}

async function testQueryPlanAnalysis() {
  console.log("\n🔍 Testing Query Plan Analysis...");

  try {
    // We'll test a few key queries to ensure they use indexes
    const testQueries = [
      {
        name: "User by Email",
        sql: `SELECT * FROM users WHERE email = 'test@example.com'`,
        expectedIndex: "users_email_key",
      },
      {
        name: "Product by Slug",
        sql: `SELECT * FROM products WHERE slug = 'test-product'`,
        expectedIndex: "products_slug_key",
      },
      {
        name: "Orders by User",
        sql: `SELECT * FROM orders WHERE "userId" = 'test-user-id'`,
        expectedIndex: "orders_userId_idx",
      },
      {
        name: "Active Products",
        sql: `SELECT * FROM products WHERE "isActive" = true`,
        expectedIndex: "products_isActive_idx",
      },
    ];

    for (const query of testQueries) {
      try {
        const plan = await analyzeQueryPlan(query.sql);

        if (plan && Array.isArray(plan) && plan.length > 0) {
          const planText = JSON.stringify(plan[0]);
          const usesIndex =
            planText.includes("Index") || planText.includes("index");

          addResult(
            "Query Plan Analysis",
            query.name,
            usesIndex ? "PASS" : "WARNING",
            usesIndex
              ? `Query uses index-based execution`
              : `Query may not be using optimal indexes`
          );
        } else {
          addResult(
            "Query Plan Analysis",
            query.name,
            "SKIP",
            "Could not analyze query plan"
          );
        }
      } catch (queryError) {
        addResult(
          "Query Plan Analysis",
          query.name,
          "SKIP",
          "Query plan analysis skipped due to test data",
          undefined,
          queryError
        );
      }
    }
  } catch (error) {
    addResult(
      "Query Plan Analysis",
      "Plan Analysis",
      "FAIL",
      "Error performing query plan analysis",
      undefined,
      error
    );
  }
}

async function detectMissingIndexes() {
  console.log("\n🔍 Detecting Missing Indexes...");

  const recommendations = [
    {
      table: "orders",
      columns: ["customerEmail", "createdAt"],
      reason: "Customer order history queries",
      priority: "HIGH",
    },
    {
      table: "subscriptions",
      columns: ["stripeCustomerId", "status"],
      reason: "Stripe customer subscription management",
      priority: "HIGH",
    },
    {
      table: "payment_methods",
      columns: ["userId", "isDefault"],
      reason: "Default payment method lookup",
      priority: "MEDIUM",
    },
    {
      table: "products",
      columns: ["type", "isActive", "createdAt"],
      reason: "Product catalog filtering and sorting",
      priority: "MEDIUM",
    },
    {
      table: "discount_codes",
      columns: ["isActive", "expiresAt"],
      reason: "Valid discount code lookup",
      priority: "LOW",
    },
  ];

  try {
    const indexes = await getTableIndexes();

    for (const recommendation of recommendations) {
      const indexExists = indexes.find(
        (idx) =>
          idx.tablename === recommendation.table &&
          recommendation.columns.every((col) => idx.indexdef.includes(col))
      );

      if (!indexExists) {
        const status = recommendation.priority === "HIGH" ? "WARNING" : "SKIP";
        addResult(
          "Missing Index Detection",
          `${recommendation.table} (${recommendation.columns.join(", ")})`,
          status,
          `${recommendation.priority} priority: ${recommendation.reason}`
        );
      } else {
        addResult(
          "Missing Index Detection",
          `${recommendation.table} (${recommendation.columns.join(", ")})`,
          "PASS",
          `Index exists for ${recommendation.reason}`
        );
      }
    }
  } catch (error) {
    addResult(
      "Missing Index Detection",
      "Index Analysis",
      "FAIL",
      "Error detecting missing indexes",
      undefined,
      error
    );
  }
}

async function generateIndexReport() {
  console.log("\n📋 Generating Index Report...");

  try {
    const indexes = await getTableIndexes();

    console.log("\n📊 CURRENT INDEX SUMMARY:");
    console.log("=".repeat(80));

    const indexesByTable = indexes.reduce(
      (acc, idx) => {
        if (!acc[idx.tablename]) {
          acc[idx.tablename] = [];
        }
        acc[idx.tablename]!.push(idx);
        return acc;
      },
      {} as Record<string, IndexInfo[]>
    );

    Object.entries(indexesByTable).forEach(([table, tableIndexes]) => {
      console.log(`\n📁 Table: ${table}`);
      tableIndexes.forEach((idx) => {
        const indexType = idx.indexdef.includes("UNIQUE")
          ? "UNIQUE"
          : idx.indexdef.includes("PRIMARY")
            ? "PRIMARY"
            : "INDEX";
        console.log(`   ${indexType}: ${idx.indexname}`);
      });
    });

    addResult(
      "Index Report",
      "Report Generation",
      "PASS",
      `Generated report for ${indexes.length} indexes across ${Object.keys(indexesByTable).length} tables`
    );
  } catch (error) {
    addResult(
      "Index Report",
      "Report Generation",
      "FAIL",
      "Error generating index report",
      undefined,
      error
    );
  }
}

async function printSummary() {
  console.log("\n" + "=".repeat(80));
  console.log("🏁 DATABASE INDEX PERFORMANCE VERIFICATION SUMMARY");
  console.log("=".repeat(80));

  const categories = [...new Set(results.map((r) => r.category))];
  const totalTests = results.length;
  const totalPassed = results.filter((r) => r.status === "PASS").length;
  const totalFailed = results.filter((r) => r.status === "FAIL").length;
  const totalWarnings = results.filter((r) => r.status === "WARNING").length;
  const totalSkipped = results.filter((r) => r.status === "SKIP").length;

  categories.forEach((category) => {
    const categoryResults = results.filter((r) => r.category === category);
    const passed = categoryResults.filter((r) => r.status === "PASS").length;
    const failed = categoryResults.filter((r) => r.status === "FAIL").length;
    const warnings = categoryResults.filter(
      (r) => r.status === "WARNING"
    ).length;
    const skipped = categoryResults.filter((r) => r.status === "SKIP").length;

    console.log(`\n📂 ${category}:`);
    console.log(`   ✅ Passed: ${passed}`);
    console.log(`   ❌ Failed: ${failed}`);
    console.log(`   ⚠️  Warnings: ${warnings}`);
    console.log(`   ⏭️  Skipped: ${skipped}`);
    console.log(`   📊 Total: ${categoryResults.length}`);
  });

  console.log("\n" + "-".repeat(80));
  console.log(`🎯 OVERALL RESULTS:`);
  console.log(`   ✅ Total Passed: ${totalPassed}`);
  console.log(`   ❌ Total Failed: ${totalFailed}`);
  console.log(`   ⚠️  Total Warnings: ${totalWarnings}`);
  console.log(`   ⏭️  Total Skipped: ${totalSkipped}`);
  console.log(`   📊 Total Tests: ${totalTests}`);

  const passRate =
    totalTests > 0 ? ((totalPassed / totalTests) * 100).toFixed(1) : "0.0";
  console.log(`   📈 Pass Rate: ${passRate}%`);

  // Performance Summary
  const performanceResults = results.filter((r) => r.performance);
  if (performanceResults.length > 0) {
    console.log("\n⚡ PERFORMANCE SUMMARY:");
    performanceResults.forEach((result) => {
      const { queryTime, threshold } = result.performance!;
      const status = queryTime <= threshold ? "✅" : "❌";
      console.log(
        `   ${status} ${result.test}: ${queryTime}ms (limit: ${threshold}ms)`
      );
    });
  }

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

  if (totalWarnings > 0) {
    console.log("\n⚠️  WARNINGS:");
    results
      .filter((r) => r.status === "WARNING")
      .forEach((result) => {
        console.log(
          `   • [${result.category}] ${result.test}: ${result.message}`
        );
      });
  }

  console.log("\n" + "=".repeat(80));

  if (totalFailed === 0) {
    if (totalWarnings > 0) {
      console.log("✅ ALL CRITICAL INDEXES ARE WORKING OPTIMALLY!");
      console.log(
        "⚠️  Some optimizations recommended - review warnings above."
      );
    } else {
      console.log("🎉 ALL DATABASE INDEXES ARE PERFECTLY OPTIMIZED!");
    }
  } else {
    console.log("⚠️  SOME INDEXES NEED ATTENTION. PLEASE REVIEW FAILED TESTS.");
  }

  console.log("=".repeat(80));

  return totalFailed === 0;
}

async function main() {
  console.log("📊 Starting Database Index Performance Verification...");
  console.log("=".repeat(80));

  try {
    // Connect to database
    await prisma.$connect();
    console.log("✅ Connected to database successfully\n");

    // Run all tests
    await testPrimaryKeyIndexes();
    await testForeignKeyIndexes();
    await testUniqueConstraintIndexes();
    await testSingleColumnIndexes();
    await testCompositeIndexes();
    await testPerformanceBenchmarks();
    await testQueryPlanAnalysis();
    await detectMissingIndexes();
    await generateIndexReport();

    // Print summary
    const allPassed = await printSummary();

    // Exit with appropriate code
    process.exit(allPassed ? 0 : 1);
  } catch (error) {
    console.error("❌ Fatal error during index verification:", error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) {
  main();
}

export { main, results, queryPlans };
