/**
 * Product Bulk Operations API Route
 *
 * Handles:
 * - POST: Bulk operations on multiple products
 *   - Bulk update (status, tags, type)
 *   - Bulk price adjustments (percentage or fixed)
 *   - Bulk activation/deactivation
 *   - Bulk tag management
 *
 * Features:
 * - Admin-only access with strict authentication
 * - Transaction-based operations for data consistency
 * - Comprehensive validation for all bulk operations
 * - Detailed audit logging with operation summaries
 * - Progress tracking for large operations
 * - Rollback capabilities for failed operations
 */

import { auditAction, rateLimit } from "@/lib/api-helpers";
import {
  createApiErrorResponse,
  getAuditContext,
  validateApiAccess,
} from "@/lib/auth/server-session";
import { db } from "@/lib/db";
import { cuidSchema } from "@/lib/validations/base/common";
import { bulkPriceUpdateSchema } from "@/lib/validations/base/product";
import { ProductService } from "@/services/products/product.service";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const productService = new ProductService(db);

// Bulk operation type schema
const bulkOperationSchema = z.discriminatedUnion("operation", [
  // Bulk update operation
  z.object({
    operation: z.literal("update"),
    productIds: z
      .array(cuidSchema)
      .min(1, "At least one product ID is required")
      .max(100, "Maximum 100 products per operation"),
    updates: z
      .object({
        isActive: z.boolean().optional(),
        tags: z.array(z.string()).optional(),
        type: z.enum(["ONE_TIME", "SUBSCRIPTION", "USAGE_BASED"]).optional(),
      })
      .partial(),
  }),

  // Bulk price adjustment operation
  z.object({
    operation: z.literal("price_adjustment"),
    productIds: z
      .array(cuidSchema)
      .min(1, "At least one product ID is required")
      .max(100, "Maximum 100 products per operation"),
    adjustment: z.object({
      type: z.enum(["percentage", "fixed"], {
        errorMap: () => ({
          message: "Adjustment type must be percentage or fixed",
        }),
      }),
      value: z.number(),
    }),
    effectiveDate: z
      .string()
      .transform((val) => new Date(val))
      .optional(),
  }),

  // Bulk tag management operation
  z.object({
    operation: z.literal("tag_management"),
    productIds: z
      .array(cuidSchema)
      .min(1, "At least one product ID is required")
      .max(100, "Maximum 100 products per operation"),
    tagAction: z.enum(["add", "remove", "replace"], {
      errorMap: () => ({
        message: "Tag action must be add, remove, or replace",
      }),
    }),
    tags: z.array(z.string()).min(1, "At least one tag is required"),
  }),

  // Bulk activation/deactivation operation
  z.object({
    operation: z.literal("activation"),
    productIds: z
      .array(cuidSchema)
      .min(1, "At least one product ID is required")
      .max(100, "Maximum 100 products per operation"),
    activate: z.boolean(),
  }),

  // Bulk delete operation
  z.object({
    operation: z.literal("delete"),
    productIds: z
      .array(cuidSchema)
      .min(1, "At least one product ID is required")
      .max(100, "Maximum 100 products per operation"),
  }),
]);

type BulkOperation = z.infer<typeof bulkOperationSchema>;

/**
 * POST /api/products/bulk - Perform bulk operations on products
 *
 * Supports multiple types of bulk operations with comprehensive validation
 * and audit logging. Operations are performed within transactions for consistency.
 */
export async function POST(request: NextRequest) {
  try {
    // Validate admin authentication
    const { isValid, session, error } = await validateApiAccess(
      request,
      "ADMIN"
    );

    if (!isValid || !session) {
      return createApiErrorResponse(
        error?.code || 401,
        error?.message || "Admin authentication required"
      );
    }

    // Apply strict rate limiting for bulk operations
    const rateLimitResult = await rateLimit(request, {
      windowMs: 15 * 60 * 1000, // 15 minutes
      maxRequests: 10, // Very limited bulk operations
      keyGenerator: () => `bulk_operations_${session.user.id}`,
    });

    if (!rateLimitResult.success) {
      return createApiErrorResponse(
        429,
        "Too many bulk operations. Please try again later."
      );
    }

    // Parse and validate request body
    let requestData;
    try {
      requestData = await request.json();
    } catch {
      return createApiErrorResponse(400, "Invalid JSON in request body");
    }

    let validatedOperation: BulkOperation;
    try {
      validatedOperation = bulkOperationSchema.parse(requestData);
    } catch (_error) {
      if (_error instanceof z.ZodError) {
        return createApiErrorResponse(
          400,
          "Invalid bulk operation data",
          _error.issues
        );
      }
      throw _error;
    }

    // Get audit context for logging
    const auditContext = getAuditContext(request, session);

    // Process based on operation type
    let result;
    let auditDetails;

    switch (validatedOperation.operation) {
      case "update":
        result = await handleBulkUpdate(validatedOperation);
        auditDetails = {
          operation: "bulk_update",
          productCount: validatedOperation.productIds.length,
          updates: validatedOperation.updates,
          affectedProducts: result.affectedCount,
        };
        break;

      case "price_adjustment":
        result = await handleBulkPriceAdjustment(validatedOperation);
        auditDetails = {
          operation: "bulk_price_adjustment",
          productCount: validatedOperation.productIds.length,
          adjustment: validatedOperation.adjustment,
          affectedProducts: result.affectedCount,
          effectiveDate: validatedOperation.effectiveDate,
        };
        break;

      case "tag_management":
        result = await handleBulkTagManagement(validatedOperation);
        auditDetails = {
          operation: "bulk_tag_management",
          productCount: validatedOperation.productIds.length,
          tagAction: validatedOperation.tagAction,
          tags: validatedOperation.tags,
          affectedProducts: result.affectedCount,
        };
        break;

      case "activation":
        result = await handleBulkActivation(validatedOperation);
        auditDetails = {
          operation: "bulk_activation",
          productCount: validatedOperation.productIds.length,
          activate: validatedOperation.activate,
          affectedProducts: result.affectedCount,
        };
        break;

      case "delete":
        result = await handleBulkDelete(validatedOperation);
        auditDetails = {
          operation: "bulk_delete",
          productCount: validatedOperation.productIds.length,
          affectedProducts: result.affectedCount,
          deletedProducts: result.deletions || [],
        };
        break;

      default:
        return createApiErrorResponse(400, "Unsupported bulk operation");
    }

    // Log the admin action for audit
    await auditAction({
      action: "BULK_PRODUCT_OPERATION",
      resource: "Product",
      resourceId: "bulk_operation",
      adminUserId: auditContext.adminUserId,
      adminRole: auditContext.adminRole,
      ipAddress: auditContext.ipAddress,
      userAgent: auditContext.userAgent,
      details: {
        ...auditDetails,
        requestedProducts: validatedOperation.productIds,
        executionTime: Date.now(),
      },
      severity: "INFO",
    });

    return NextResponse.json(
      {
        success: true,
        operation: validatedOperation.operation,
        message: `Bulk ${validatedOperation.operation} completed successfully`,
        result,
      },
      { status: 200 }
    );
  } catch (_error) {
    // Handle specific business logic errors
    if (_error instanceof Error) {
      if (_error.message.includes("not found")) {
        return createApiErrorResponse(404, _error.message);
      }
      if (_error.message.includes("validation")) {
        return createApiErrorResponse(400, _error.message);
      }
      if (_error.message.includes("transaction")) {
        return createApiErrorResponse(
          500,
          "Operation failed - data consistency maintained"
        );
      }
    }

    return createApiErrorResponse(500, "Failed to perform bulk operation");
  }
}

/**
 * Handle bulk update operations
 */
async function handleBulkUpdate(
  operation: Extract<BulkOperation, { operation: "update" }>
) {
  const { productIds, updates } = operation;

  // Validate that products exist
  const existingProducts = await db.product.findMany({
    where: { id: { in: productIds } },
    select: { id: true, name: true },
  });

  if (existingProducts.length !== productIds.length) {
    const foundIds = existingProducts.map((p) => p.id);
    const missingIds = productIds.filter((id) => !foundIds.includes(id));
    throw new Error(`Products not found: ${missingIds.join(", ")}`);
  }

  // Perform bulk update
  const result = await productService.bulkUpdate(productIds, updates);

  return {
    affectedCount: result.count,
    requestedCount: productIds.length,
    products: existingProducts.map((p) => ({ id: p.id, name: p.name })),
    updates,
  };
}

/**
 * Handle bulk price adjustment operations
 */
async function handleBulkPriceAdjustment(
  operation: Extract<BulkOperation, { operation: "price_adjustment" }>
) {
  const { productIds, adjustment, effectiveDate } = operation;

  // Validate price adjustment data
  bulkPriceUpdateSchema.parse({
    productIds,
    priceAdjustment: adjustment,
    effectiveDate,
  });

  // Get original prices for comparison
  const originalProducts = await db.product.findMany({
    where: { id: { in: productIds } },
    select: { id: true, name: true, price: true },
  });

  if (originalProducts.length !== productIds.length) {
    const foundIds = originalProducts.map((p) => p.id);
    const missingIds = productIds.filter((id) => !foundIds.includes(id));
    throw new Error(`Products not found: ${missingIds.join(", ")}`);
  }

  // Perform bulk price update
  const result = await productService.bulkPriceUpdate(productIds, adjustment);

  // Calculate price changes for audit
  const priceChanges = originalProducts.map((product) => {
    const currentPrice = parseFloat(product.price.toString());
    let newPrice: number;

    if (adjustment.type === "percentage") {
      newPrice = currentPrice * (1 + adjustment.value / 100);
    } else {
      newPrice = currentPrice + adjustment.value;
    }

    newPrice = Math.max(0.01, Math.round(newPrice * 100) / 100);

    return {
      productId: product.id,
      productName: product.name,
      originalPrice: currentPrice,
      newPrice,
      change: newPrice - currentPrice,
      changePercentage: (
        ((newPrice - currentPrice) / currentPrice) *
        100
      ).toFixed(2),
    };
  });

  return {
    affectedCount: result.count,
    requestedCount: productIds.length,
    adjustment,
    priceChanges,
    totalOriginalValue: priceChanges.reduce(
      (sum, change) => sum + change.originalPrice,
      0
    ),
    totalNewValue: priceChanges.reduce(
      (sum, change) => sum + change.newPrice,
      0
    ),
  };
}

/**
 * Handle bulk tag management operations
 */
async function handleBulkTagManagement(
  operation: Extract<BulkOperation, { operation: "tag_management" }>
) {
  const { productIds, tagAction, tags } = operation;

  // Get current products with their tags
  const products = await db.product.findMany({
    where: { id: { in: productIds } },
    select: { id: true, name: true, tags: true },
  });

  if (products.length !== productIds.length) {
    const foundIds = products.map((p) => p.id);
    const missingIds = productIds.filter((id) => !foundIds.includes(id));
    throw new Error(`Products not found: ${missingIds.join(", ")}`);
  }

  // Process tag operations
  const updates = products.map((product) => {
    let newTags: string[];

    switch (tagAction) {
      case "add":
        newTags = [...new Set([...product.tags, ...tags])]; // Remove duplicates
        break;
      case "remove":
        newTags = product.tags.filter((tag) => !tags.includes(tag));
        break;
      case "replace":
        newTags = tags;
        break;
      default:
        throw new Error(`Invalid tag action: ${tagAction}`);
    }

    return {
      where: { id: product.id },
      data: { tags: newTags },
    };
  });

  // Perform bulk tag updates within a transaction
  const results = await db.$transaction(
    updates.map((update) => db.product.update(update))
  );

  return {
    affectedCount: results.length,
    requestedCount: productIds.length,
    tagAction,
    tags,
    productUpdates: products.map((product) => ({
      id: product.id,
      name: product.name,
      originalTags: product.tags,
      newTags: results.find((r) => r.id === product.id)?.tags || [],
    })),
  };
}

/**
 * Handle bulk activation/deactivation operations
 */
async function handleBulkActivation(
  operation: Extract<BulkOperation, { operation: "activation" }>
) {
  const { productIds, activate } = operation;

  // Get current products
  const products = await db.product.findMany({
    where: { id: { in: productIds } },
    select: { id: true, name: true, isActive: true },
  });

  if (products.length !== productIds.length) {
    const foundIds = products.map((p) => p.id);
    const missingIds = productIds.filter((id) => !foundIds.includes(id));
    throw new Error(`Products not found: ${missingIds.join(", ")}`);
  }

  // Filter products that actually need status change
  const productsToUpdate = products.filter(
    (product) => product.isActive !== activate
  );

  if (productsToUpdate.length === 0) {
    return {
      affectedCount: 0,
      requestedCount: productIds.length,
      message: `All products are already ${activate ? "active" : "inactive"}`,
      activate,
    };
  }

  // Perform bulk activation/deactivation
  const result = await productService.bulkUpdate(
    productsToUpdate.map((p) => p.id),
    { isActive: activate }
  );

  return {
    affectedCount: result.count,
    requestedCount: productIds.length,
    activate,
    statusChanges: productsToUpdate.map((product) => ({
      id: product.id,
      name: product.name,
      previousStatus: product.isActive,
      newStatus: activate,
    })),
    skippedCount: products.length - productsToUpdate.length,
  };
}

/**
 * Handle bulk delete operations
 */
async function handleBulkDelete(
  operation: Extract<BulkOperation, { operation: "delete" }>
) {
  const { productIds } = operation;

  // Get current products before deletion for audit purposes
  const products = await db.product.findMany({
    where: { id: { in: productIds } },
    select: { id: true, name: true, sku: true, isActive: true, type: true },
  });

  if (products.length !== productIds.length) {
    const foundIds = products.map((p) => p.id);
    const missingIds = productIds.filter((id) => !foundIds.includes(id));
    throw new Error(`Products not found: ${missingIds.join(", ")}`);
  }

  // Filter products that are still active (soft delete only deactivates)
  const productsToDelete = products.filter((product) => product.isActive);

  if (productsToDelete.length === 0) {
    return {
      affectedCount: 0,
      requestedCount: productIds.length,
      message: "All selected products are already deactivated",
      deletions: [],
      skippedCount: products.length,
    };
  }

  // Perform bulk soft delete (deactivation) within a transaction
  const results = await db.$transaction(
    productsToDelete.map((product) =>
      db.product.update({
        where: { id: product.id },
        data: { isActive: false },
      })
    )
  );

  return {
    affectedCount: results.length,
    requestedCount: productIds.length,
    deletions: productsToDelete.map((product) => ({
      id: product.id,
      name: product.name,
      sku: product.sku,
      type: product.type,
      previouslyActive: product.isActive,
      newStatus: false,
    })),
    skippedCount: products.length - productsToDelete.length,
  };
}

/**
 * OPTIONS /api/products/bulk - Handle CORS preflight requests
 */
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
      "Access-Control-Max-Age": "86400",
    },
  });
}
