/**
 * Product Access Control API - Manage product access restrictions
 *
 * Handles:
 * - GET: Get product access control settings
 * - PUT: Update product access control settings
 *
 * Features:
 * - Role-based access control (admin only)
 * - Geographic restrictions management
 * - User role restrictions
 * - User capacity limits
 * - Audit logging for admin actions
 */

import { auditAction, rateLimit } from "@/lib/api-helpers";
import {
  createApiErrorResponse,
  getAuditContext,
  validateApiAccess,
} from "@/lib/auth/server-session";
import { db } from "@/lib/db";
import { updateProductAccessControlSchema } from "@/lib/validations/base/product";
import { ProductService } from "@/services/products/product.service";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const productService = new ProductService(db);

// Parameters validation schema
const paramsSchema = z.object({
  id: z.string().cuid("Invalid product ID"),
});

/**
 * GET /api/products/[id]/access-control - Get product access control settings (admin only)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
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

    // Validate parameters
    let validatedParams;
    try {
      validatedParams = paramsSchema.parse(params);
    } catch (_error) {
      if (_error instanceof z.ZodError) {
        return createApiErrorResponse(400, "Invalid product ID", _error.issues);
      }
      throw _error;
    }

    // Get product with access control settings
    const product = await productService.findById(validatedParams.id);
    if (!product) {
      return createApiErrorResponse(404, "Product not found");
    }

    // Return access control settings
    const accessControlSettings = {
      id: product.id,
      restrictedRegions: product.restrictedRegions,
      allowedUserRoles: product.allowedUserRoles,
      maxUsers: product.maxUsers,
      currentUsers: product.currentUsers,
      isLimited: product.isLimited,
      availableCapacity:
        product.isLimited && product.maxUsers
          ? Math.max(0, product.maxUsers - product.currentUsers)
          : null,
      capacityPercentage:
        product.isLimited && product.maxUsers
          ? Math.round((product.currentUsers / product.maxUsers) * 100)
          : null,
    };

    return NextResponse.json(
      {
        accessControl: accessControlSettings,
        message: "Product access control settings retrieved successfully",
      },
      { status: 200 }
    );
  } catch (_error) {
    return createApiErrorResponse(
      500,
      "Failed to fetch product access control settings"
    );
  }
}

/**
 * PUT /api/products/[id]/access-control - Update product access control settings (admin only)
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
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

    // Apply rate limiting for admin operations
    const rateLimitResult = await rateLimit(request, {
      windowMs: 15 * 60 * 1000, // 15 minutes
      maxRequests: 100, // 100 admin operations per window
      keyGenerator: () => `product_access_control_update_${session.user.id}`,
    });

    if (!rateLimitResult.success) {
      return createApiErrorResponse(
        429,
        "Too many admin requests. Please try again later."
      );
    }

    // Validate parameters
    let validatedParams;
    try {
      validatedParams = paramsSchema.parse(params);
    } catch (_error) {
      if (_error instanceof z.ZodError) {
        return createApiErrorResponse(400, "Invalid product ID", _error.issues);
      }
      throw _error;
    }

    // Parse and validate request body
    let requestData;
    try {
      requestData = await request.json();
    } catch {
      return createApiErrorResponse(400, "Invalid JSON in request body");
    }

    let validatedData;
    try {
      validatedData = updateProductAccessControlSchema.parse({
        productId: validatedParams.id,
        ...requestData,
      });
    } catch (_error) {
      if (_error instanceof z.ZodError) {
        return createApiErrorResponse(
          400,
          "Invalid access control data",
          _error.issues
        );
      }
      throw _error;
    }

    // Update product access control
    const updatedProduct =
      await productService.updateProductAccessControl(validatedData);

    // Log the admin action for audit
    const auditContext = getAuditContext(request, session);
    await auditAction({
      action: "UPDATE_PRODUCT_ACCESS_CONTROL",
      resource: "Product",
      resourceId: updatedProduct.id,
      adminUserId: auditContext.adminUserId,
      adminRole: auditContext.adminRole,
      ipAddress: auditContext.ipAddress,
      userAgent: auditContext.userAgent,
      details: {
        productName: updatedProduct.name,
        restrictedRegions: updatedProduct.restrictedRegions,
        allowedUserRoles: updatedProduct.allowedUserRoles,
        isLimited: updatedProduct.isLimited,
        maxUsers: updatedProduct.maxUsers,
        currentUsers: updatedProduct.currentUsers,
      },
      severity: "INFO",
    });

    return NextResponse.json(
      {
        product: {
          id: updatedProduct.id,
          restrictedRegions: updatedProduct.restrictedRegions,
          allowedUserRoles: updatedProduct.allowedUserRoles,
          maxUsers: updatedProduct.maxUsers,
          currentUsers: updatedProduct.currentUsers,
          isLimited: updatedProduct.isLimited,
        },
        message: "Product access control updated successfully",
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
    }

    return createApiErrorResponse(
      500,
      "Failed to update product access control"
    );
  }
}

/**
 * OPTIONS /api/products/[id]/access-control - Handle CORS preflight requests
 */
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, PUT, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
      "Access-Control-Max-Age": "86400",
    },
  });
}
