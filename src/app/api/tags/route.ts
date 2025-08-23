/**
 * Tags API Routes - Main endpoint for tag listing and creation
 *
 * Handles:
 * - GET: List tags with filtering, pagination, and sorting
 * - POST: Create new tags (admin only)
 *
 * Features:
 * - Role-based access control (public read, admin write)
 * - Input validation with Zod schemas
 * - Pagination with cursor-based approach
 * - Advanced filtering and sorting options
 * - Rate limiting on public endpoints
 * - Audit logging for admin actions
 * - Response caching for public endpoints
 * - Tag cloud functionality with weights
 */

import { auditAction, rateLimit } from "@/lib/api-helpers";
import {
  createApiErrorResponse,
  getAuditContext,
  validateApiAccess,
} from "@/lib/auth/server-session";
import { db } from "@/lib/db";
import {
  createTagSchema,
  tagFilterSchema,
  tagSortSchema,
} from "@/lib/validations/base/tag";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

// Query parameters schema for GET requests
const getTagsQuerySchema = z.object({
  // Pagination
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(20),

  // Filtering
  name: z.string().optional(),
  slug: z.string().optional(),
  color: z.string().optional(),
  createdAfter: z
    .string()
    .optional()
    .transform((val) => (val ? new Date(val) : undefined)),
  createdBefore: z
    .string()
    .optional()
    .transform((val) => (val ? new Date(val) : undefined)),

  // Sorting
  sort: tagSortSchema.optional().default("createdAt"),
  sortDirection: z.enum(["asc", "desc"]).default("desc"),

  // Special modes
  includeProductCount: z
    .string()
    .optional()
    .transform((val) => val === "true"),
  tagCloud: z
    .string()
    .optional()
    .transform((val) => val === "true"), // Returns weighted tags for tag cloud
});

type GetTagsQuery = z.infer<typeof getTagsQuerySchema>;

/**
 * GET /api/tags - List tags with filtering and pagination
 *
 * Query Parameters:
 * - page: Page number (default: 1)
 * - limit: Items per page (default: 20, max: 100)
 * - name: Filter by tag name
 * - slug: Filter by tag slug
 * - color: Filter by tag color
 * - sort: Sort field (name, createdAt, updatedAt)
 * - sortDirection: Sort direction (asc, desc)
 * - includeProductCount: Include product count for each tag
 * - tagCloud: Return weighted tags for tag cloud display
 */
export async function GET(request: NextRequest) {
  try {
    // Apply rate limiting for public endpoints
    const rateLimitResult = await rateLimit(request, {
      windowMs: 15 * 60 * 1000, // 15 minutes
      maxRequests: 100, // 100 requests per window
      keyGenerator: (req) => {
        const forwarded = req.headers.get("x-forwarded-for");
        const ip = forwarded ? forwarded.split(",")[0] : "unknown";
        return `tags_list_${ip}`;
      },
    });

    if (!rateLimitResult.success) {
      return createApiErrorResponse(
        429,
        "Too many requests. Please try again later."
      );
    }

    // Parse and validate query parameters
    const url = new URL(request.url);
    const queryParams = Object.fromEntries(url.searchParams.entries());

    let validatedQuery: GetTagsQuery;
    try {
      validatedQuery = getTagsQuerySchema.parse(queryParams);
    } catch (_error) {
      if (_error instanceof z.ZodError) {
        return createApiErrorResponse(
          400,
          "Invalid query parameters",
          _error.issues
        );
      }
      throw _error;
    }

    // Build filter object
    const filters = tagFilterSchema.parse({
      name: validatedQuery.name,
      slug: validatedQuery.slug,
      color: validatedQuery.color,
      createdAfter: validatedQuery.createdAfter,
      createdBefore: validatedQuery.createdBefore,
    });

    // Build where clause
    const whereClause: any = {};

    if (filters.name) {
      whereClause.name = {
        contains: filters.name,
        mode: "insensitive",
      };
    }

    if (filters.slug) {
      whereClause.slug = {
        contains: filters.slug,
        mode: "insensitive",
      };
    }

    if (filters.color) {
      whereClause.color = filters.color;
    }

    if (filters.createdAfter || filters.createdBefore) {
      whereClause.createdAt = {};
      if (filters.createdAfter)
        whereClause.createdAt.gte = filters.createdAfter;
      if (filters.createdBefore)
        whereClause.createdAt.lte = filters.createdBefore;
    }

    // Special handling for tag cloud mode
    if (validatedQuery.tagCloud) {
      const tagsWithCounts = await db.tag.findMany({
        where: whereClause,
        include: {
          _count: {
            select: {
              products: true,
            },
          },
        },
        orderBy: {
          products: {
            _count: "desc",
          },
        },
        take: validatedQuery.limit,
      });

      // Calculate weights for tag cloud (1-5 scale)
      const maxCount = tagsWithCounts[0]?._count.products || 1;
      const minCount =
        tagsWithCounts[tagsWithCounts.length - 1]?._count.products || 0;
      const range = maxCount - minCount || 1;

      const tagCloudData = tagsWithCounts.map((tag) => ({
        id: tag.id,
        name: tag.name,
        slug: tag.slug,
        color: tag.color,
        productCount: tag._count.products,
        weight: Math.ceil(((tag._count.products - minCount) / range) * 4) + 1, // 1-5 scale
      }));

      return NextResponse.json(
        {
          tags: tagCloudData,
          meta: {
            totalTags: tagsWithCounts.length,
            maxProductCount: maxCount,
            minProductCount: minCount,
          },
        },
        {
          status: 200,
          headers: {
            "Cache-Control":
              "public, s-maxage=600, stale-while-revalidate=1200", // 10 min cache
            Vary: "Accept, Accept-Encoding",
          },
        }
      );
    }

    // Regular listing mode
    const totalCount = await db.tag.count({ where: whereClause });
    const totalPages = Math.ceil(totalCount / validatedQuery.limit);
    const offset = (validatedQuery.page - 1) * validatedQuery.limit;

    // Fetch tags with pagination and filtering
    const tags = await db.tag.findMany({
      where: whereClause,
      orderBy: {
        [validatedQuery.sort]: validatedQuery.sortDirection,
      },
      skip: offset,
      take: validatedQuery.limit,
      include: validatedQuery.includeProductCount
        ? {
            _count: {
              select: {
                products: true,
              },
            },
          }
        : undefined,
    });

    // Transform tags for public API
    const publicTags = tags.map((tag) => ({
      id: tag.id,
      name: tag.name,
      slug: tag.slug,
      color: tag.color,
      createdAt: tag.createdAt,
      updatedAt: tag.updatedAt,
      ...(validatedQuery.includeProductCount && "_count" in tag
        ? {
            productCount: tag._count.products,
          }
        : {}),
    }));

    // Build response with pagination metadata
    const response = {
      tags: publicTags,
      pagination: {
        page: validatedQuery.page,
        pages: totalPages,
        limit: validatedQuery.limit,
        total: totalCount,
        hasNextPage: validatedQuery.page < totalPages,
        hasPrevPage: validatedQuery.page > 1,
      },
      filters: validatedQuery,
    };

    // Set cache headers for public tag listings
    const cacheHeaders = {
      "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600", // 5 min cache, 10 min SWR
      Vary: "Accept, Accept-Encoding",
    };

    return NextResponse.json(response, {
      status: 200,
      headers: cacheHeaders,
    });
  } catch (_error) {
    return createApiErrorResponse(500, "Failed to fetch tags");
  }
}

/**
 * POST /api/tags - Create a new tag (admin only)
 *
 * Requires ADMIN role and valid tag data.
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

    // Apply stricter rate limiting for admin operations
    const rateLimitResult = await rateLimit(request, {
      windowMs: 15 * 60 * 1000, // 15 minutes
      maxRequests: 50, // 50 admin operations per window
      keyGenerator: () => `tags_create_${session.user.id}`,
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

    let validatedData;
    try {
      validatedData = createTagSchema.parse(requestData);
    } catch (_error) {
      if (_error instanceof z.ZodError) {
        return createApiErrorResponse(400, "Invalid tag data", _error.issues);
      }
      throw _error;
    }

    // Auto-generate slug if not provided
    if (!validatedData.slug) {
      validatedData.slug = validatedData.name
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9\s-]/g, "")
        .replace(/\s+/g, "-")
        .replace(/-+/g, "-")
        .replace(/^-|-$/g, "");
    }

    // Check for duplicate name and slug
    const existingTag = await db.tag.findFirst({
      where: {
        OR: [
          { name: { equals: validatedData.name, mode: "insensitive" } },
          { slug: validatedData.slug },
        ],
      },
    });

    if (existingTag) {
      if (existingTag.name.toLowerCase() === validatedData.name.toLowerCase()) {
        return createApiErrorResponse(
          409,
          "A tag with this name already exists"
        );
      }
      if (existingTag.slug === validatedData.slug) {
        return createApiErrorResponse(
          409,
          "A tag with this slug already exists"
        );
      }
    }

    // Create the tag
    const tag = await db.tag.create({
      data: validatedData,
    });

    // Log the admin action for audit
    const auditContext = getAuditContext(request, session);
    await auditAction({
      action: "CREATE_TAG",
      resource: "Tag",
      resourceId: tag.id,
      adminUserId: auditContext.adminUserId,
      adminRole: auditContext.adminRole,
      ipAddress: auditContext.ipAddress,
      userAgent: auditContext.userAgent,
      details: {
        tagName: tag.name,
        tagSlug: tag.slug,
        tagColor: tag.color,
      },
      severity: "INFO",
    });

    // Return created tag
    return NextResponse.json(
      {
        tag,
        message: "Tag created successfully",
      },
      { status: 201 }
    );
  } catch (_error) {
    // Handle specific business logic errors
    if (_error instanceof Error) {
      if (_error.message.includes("already exists")) {
        return createApiErrorResponse(409, _error.message);
      }
      if (_error.message.includes("validation")) {
        return createApiErrorResponse(400, _error.message);
      }
    }

    return createApiErrorResponse(500, "Failed to create tag");
  }
}

/**
 * OPTIONS /api/tags - Handle CORS preflight requests
 */
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
      "Access-Control-Max-Age": "86400",
    },
  });
}
