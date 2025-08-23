/**
 * Pricing Tier Reorder API Route
 *
 * Handles:
 * - POST: Reorder pricing tiers for a product (admin only)
 *
 * Features:
 * - Admin-only access control
 * - Validation of tier ownership
 * - Audit logging for reorder operations
 * - Transaction safety
 */

import { auditAction, rateLimit } from "@/lib/api-helpers";
import {
  createApiErrorResponse,
  getAuditContext,
  validateApiAccess,
} from "@/lib/auth/server-session";
import { db } from "@/lib/db";
import { cuidSchema } from "@/lib/validations/base/common";
import { reorderPricingTiersSchema } from "@/lib/validations/base/pricing-tier";
import { PricingTierService } from "@/services/pricing-tier.service";
import { ProductService } from "@/services/products/product.service";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const pricingTierService = new PricingTierService(db);
const productService = new ProductService(db);

// Parameter validation schema
const paramsSchema = z.object({
  id: cuidSchema,
});

/**
 * POST /api/products/[id]/pricing-tiers/reorder - Reorder pricing tiers (admin only)
 *
 * Updates the sort order of pricing tiers based on provided sequence.
 * Validates all tiers belong to the product before reordering.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

    // Await params in Next.js 15+
    const resolvedParams = await params;

    // Validate product ID parameter
    let validatedParams;
    try {
      validatedParams = paramsSchema.parse(resolvedParams);
    } catch (_error) {
      if (_error instanceof z.ZodError) {
        return createApiErrorResponse(400, "Invalid product ID format");
      }
      throw _error;
    }

    // Apply rate limiting for admin operations
    const rateLimitResult = await rateLimit(request, {
      windowMs: 15 * 60 * 1000, // 15 minutes
      maxRequests: 100, // 100 admin operations per window
      keyGenerator: () => `pricing_tier_reorder_${session.user.id}`,
    });

    if (!rateLimitResult.success) {
      return createApiErrorResponse(
        429,
        "Too many admin requests. Please try again later."
      );
    }

    // Verify product exists
    const product = await productService.findById(validatedParams.id);
    if (!product) {
      return createApiErrorResponse(404, "Product not found");
    }

    // Parse and validate request body
    let requestData;
    try {
      requestData = await request.json();
    } catch {
      return createApiErrorResponse(400, "Invalid JSON in request body");
    }

    // Add the product ID to the request data
    const reorderData = { ...requestData, productId: validatedParams.id };

    let validatedData;
    try {
      validatedData = reorderPricingTiersSchema.parse(reorderData);
    } catch (_error) {
      if (_error instanceof z.ZodError) {
        return createApiErrorResponse(
          400,
          "Invalid reorder data",
          _error.issues
        );
      }
      throw _error;
    }

    // Get current tiers to capture original order for audit
    const originalTiers = await productService.getPricingTiers(
      validatedParams.id,
      true
    );
    const originalOrder = originalTiers.map((tier) => ({
      id: tier.id,
      name: tier.name,
      sortOrder: tier.sortOrder,
    }));

    // Perform the reorder operation
    const reorderedTiers = await pricingTierService.reorderTiers(validatedData);

    // Log the admin action for audit
    const auditContext = getAuditContext(request, session);
    await auditAction({
      action: "REORDER_PRICING_TIERS",
      resource: "PricingTier",
      resourceId: validatedParams.id, // Use product ID as main resource
      adminUserId: auditContext.adminUserId,
      adminRole: auditContext.adminRole,
      ipAddress: auditContext.ipAddress,
      userAgent: auditContext.userAgent,
      details: {
        productId: validatedParams.id,
        productName: product.name,
        originalOrder,
        newOrder: reorderedTiers.map((tier) => ({
          id: tier.id,
          name: tier.name,
          sortOrder: tier.sortOrder,
        })),
        tierCount: reorderedTiers.length,
        reorderedTierIds: validatedData.tierIds,
      },
      severity: "INFO",
    });

    return NextResponse.json(
      {
        tiers: reorderedTiers,
        message: "Pricing tiers reordered successfully",
      },
      { status: 200 }
    );
  } catch (_error) {
    // Handle specific business logic errors
    if (_error instanceof Error) {
      if (_error.message.includes("not found")) {
        return createApiErrorResponse(404, _error.message);
      }
      if (_error.message.includes("do not belong")) {
        return createApiErrorResponse(400, _error.message);
      }
      if (_error.message.includes("validation")) {
        return createApiErrorResponse(400, _error.message);
      }
    }

    return createApiErrorResponse(500, "Failed to reorder pricing tiers");
  }
}

/**
 * OPTIONS /api/products/[id]/pricing-tiers/reorder - Handle CORS preflight requests
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
