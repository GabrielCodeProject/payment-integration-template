/**
 * Individual Category API Routes - CRUD operations for specific categories
 *
 * Handles:
 * - GET: Retrieve specific category with optional product details
 * - PUT: Update category (admin only)
 * - DELETE: Delete category (admin only)
 *
 * Features:
 * - Role-based access control (public read, admin write/delete)
 * - Input validation with Zod schemas
 * - Cascade handling for category deletion
 * - Audit logging for admin actions
 * - Response caching for public endpoints
 */

import { auditAction, rateLimit } from "@/lib/api-helpers";
import {
  createApiErrorResponse,
  getAuditContext,
  validateApiAccess,
} from "@/lib/auth/server-session";
import { db } from "@/lib/db";
import { updateCategorySchema } from "@/lib/validations/base/category";
import { cuidSchema } from "@/lib/validations/base/common";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

// Route parameter validation
const routeParamsSchema = z.object({
  id: cuidSchema,
});

// Query parameters for GET request
const getCategoryQuerySchema = z.object({
  includeProducts: z
    .string()
    .optional()
    .transform((val) => val === "true"),
  productsLimit: z.coerce.number().min(1).max(50).default(10),
});

/**
 * GET /api/categories/[id] - Retrieve a specific category
 *
 * Query Parameters:
 * - includeProducts: Include associated products (default: false)
 * - productsLimit: Limit number of products to return (default: 10, max: 50)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Validate route parameters
    const { id } = routeParamsSchema.parse(params);

    // Parse query parameters
    const url = new URL(request.url);
    const queryParams = Object.fromEntries(url.searchParams.entries());
    const query = getCategoryQuerySchema.parse(queryParams);

    // Apply rate limiting for public endpoints
    const rateLimitResult = await rateLimit(request, {
      windowMs: 15 * 60 * 1000, // 15 minutes
      maxRequests: 100, // 100 requests per window
      keyGenerator: (req) => {
        const forwarded = req.headers.get("x-forwarded-for");
        const ip = forwarded ? forwarded.split(",")[0] : "unknown";
        return `category_get_${ip}`;
      },
    });

    if (!rateLimitResult.success) {
      return createApiErrorResponse(
        429,
        "Too many requests. Please try again later."
      );
    }

    // Fetch category with optional products
    const category = await db.category.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            products: true,
          },
        },
        ...(query.includeProducts
          ? {
              products: {
                take: query.productsLimit,
                include: {
                  product: {
                    select: {
                      id: true,
                      name: true,
                      slug: true,
                      price: true,
                      currency: true,
                      thumbnail: true,
                      isActive: true,
                      type: true,
                      createdAt: true,
                    },
                  },
                },
              },
            }
          : {}),
      },
    });

    if (!category) {
      return createApiErrorResponse(404, "Category not found");
    }

    // Transform response for public API
    const response = {
      id: category.id,
      name: category.name,
      description: category.description,
      slug: category.slug,
      productCount: category._count.products,
      createdAt: category.createdAt,
      updatedAt: category.updatedAt,
      ...(query.includeProducts && "products" in category
        ? {
            products: category.products.map((pc: any) => pc.product),
          }
        : {}),
    };

    // Set cache headers
    const cacheHeaders = {
      "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
      Vary: "Accept, Accept-Encoding",
    };

    return NextResponse.json(response, {
      status: 200,
      headers: cacheHeaders,
    });
  } catch (_error) {
    if (_error instanceof z.ZodError) {
      return createApiErrorResponse(
        400,
        "Invalid request parameters",
        _error.issues
      );
    }

    return createApiErrorResponse(500, "Failed to fetch category");
  }
}

/**
 * PUT /api/categories/[id] - Update a category (admin only)
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Validate route parameters
    const { id } = routeParamsSchema.parse(params);

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
      maxRequests: 50, // 50 admin operations per window
      keyGenerator: () => `category_update_${session.user.id}`,
    });

    if (!rateLimitResult.success) {
      return createApiErrorResponse(
        429,
        "Too many admin requests. Please try again later."
      );
    }

    // Parse and validate request body
    let requestData;
    try {
      requestData = await request.json();
    } catch {
      return createApiErrorResponse(400, "Invalid JSON in request body");
    }

    // Add ID to validation data
    requestData.id = id;

    let validatedData;
    try {
      validatedData = updateCategorySchema.parse(requestData);
    } catch (_error) {
      if (_error instanceof z.ZodError) {
        return createApiErrorResponse(
          400,
          "Invalid category data",
          _error.issues
        );
      }
      throw _error;
    }

    // Check if category exists
    const existingCategory = await db.category.findUnique({
      where: { id },
    });

    if (!existingCategory) {
      return createApiErrorResponse(404, "Category not found");
    }

    // Check for duplicate name/slug (excluding current category)
    if (validatedData.name || validatedData.slug) {
      const duplicateCategory = await db.category.findFirst({
        where: {
          AND: [
            { id: { not: id } },
            {
              OR: [
                ...(validatedData.name
                  ? [
                      {
                        name: {
                          equals: validatedData.name,
                          mode: "insensitive",
                        },
                      },
                    ]
                  : []),
                ...(validatedData.slug ? [{ slug: validatedData.slug }] : []),
              ],
            },
          ],
        },
      });

      if (duplicateCategory) {
        if (
          duplicateCategory.name.toLowerCase() ===
          validatedData.name?.toLowerCase()
        ) {
          return createApiErrorResponse(
            409,
            "A category with this name already exists"
          );
        }
        if (duplicateCategory.slug === validatedData.slug) {
          return createApiErrorResponse(
            409,
            "A category with this slug already exists"
          );
        }
      }
    }

    // Update the category
    const updatedCategory = await db.category.update({
      where: { id },
      data: {
        ...(validatedData.name && { name: validatedData.name }),
        ...(validatedData.description !== undefined && {
          description: validatedData.description,
        }),
        ...(validatedData.slug && { slug: validatedData.slug }),
      },
    });

    // Log the admin action for audit
    const auditContext = getAuditContext(request, session);
    await auditAction({
      action: "UPDATE_CATEGORY",
      resource: "Category",
      resourceId: updatedCategory.id,
      adminUserId: auditContext.adminUserId,
      adminRole: auditContext.adminRole,
      ipAddress: auditContext.ipAddress,
      userAgent: auditContext.userAgent,
      details: {
        categoryName: updatedCategory.name,
        categorySlug: updatedCategory.slug,
        changes: Object.keys(validatedData).filter((key) => key !== "id"),
      },
      severity: "INFO",
    });

    return NextResponse.json({
      category: updatedCategory,
      message: "Category updated successfully",
    });
  } catch (_error) {
    if (_error instanceof z.ZodError) {
      return createApiErrorResponse(
        400,
        "Invalid request parameters",
        _error.issues
      );
    }

    return createApiErrorResponse(500, "Failed to update category");
  }
}

/**
 * DELETE /api/categories/[id] - Delete a category (admin only)
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Validate route parameters
    const { id } = routeParamsSchema.parse(params);

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
      maxRequests: 25, // 25 delete operations per window
      keyGenerator: () => `category_delete_${session.user.id}`,
    });

    if (!rateLimitResult.success) {
      return createApiErrorResponse(
        429,
        "Too many admin requests. Please try again later."
      );
    }

    // Check if category exists
    const existingCategory = await db.category.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            products: true,
          },
        },
      },
    });

    if (!existingCategory) {
      return createApiErrorResponse(404, "Category not found");
    }

    // Check for query parameter to force delete
    const url = new URL(request.url);
    const forceDelete = url.searchParams.get("force") === "true";

    if (existingCategory._count.products > 0 && !forceDelete) {
      return createApiErrorResponse(
        400,
        `Category has ${existingCategory._count.products} associated products. Use ?force=true to delete anyway.`
      );
    }

    // Delete the category (cascade will remove relationships)
    await db.category.delete({
      where: { id },
    });

    // Log the admin action for audit
    const auditContext = getAuditContext(request, session);
    await auditAction({
      action: "DELETE_CATEGORY",
      resource: "Category",
      resourceId: id,
      adminUserId: auditContext.adminUserId,
      adminRole: auditContext.adminRole,
      ipAddress: auditContext.ipAddress,
      userAgent: auditContext.userAgent,
      details: {
        categoryName: existingCategory.name,
        categorySlug: existingCategory.slug,
        productCount: existingCategory._count.products,
        forceDelete,
      },
      severity: "WARN",
    });

    return NextResponse.json({
      message: "Category deleted successfully",
      deletedCategory: {
        id: existingCategory.id,
        name: existingCategory.name,
        productCount: existingCategory._count.products,
      },
    });
  } catch (_error) {
    // console.error('Error deleting category:', error);

    if (_error instanceof z.ZodError) {
      return createApiErrorResponse(
        400,
        "Invalid request parameters",
        _error.issues
      );
    }

    return createApiErrorResponse(500, "Failed to delete category");
  }
}
