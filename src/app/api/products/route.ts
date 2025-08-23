/**
 * Product API Routes - Main endpoint for product listing and creation
 *
 * Handles:
 * - GET: List products with filtering, pagination, and sorting
 * - POST: Create new products (admin only)
 *
 * Features:
 * - Role-based access control (public read, admin write)
 * - Input validation with Zod schemas
 * - Pagination with cursor-based approach
 * - Advanced filtering and sorting options
 * - Rate limiting on public endpoints
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
import {
  createProductSchema,
  productFilterSchema,
  productSortSchema,
} from "@/lib/validations/base/product";
import { ProductService } from "@/services/products/product.service";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const productService = new ProductService(db);

// Query parameters schema for GET requests
const getProductsQuerySchema = z.object({
  // Pagination
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(20),
  cursor: z.string().optional(),

  // Filtering
  name: z.string().optional(),
  type: z.enum(["ONE_TIME", "SUBSCRIPTION", "USAGE_BASED"]).optional(),
  isActive: z
    .string()
    .optional()
    .transform((val) => (val === undefined ? undefined : val === "true")),
  isDigital: z
    .string()
    .optional()
    .transform((val) => (val === undefined ? undefined : val === "true")),
  inStock: z
    .string()
    .optional()
    .transform((val) => (val === undefined ? undefined : val === "true")),
  priceMin: z.coerce.number().min(0).optional(),
  priceMax: z.coerce.number().min(0).optional(),
  categoryIds: z
    .string()
    .optional()
    .transform((val) => (val ? val.split(",").filter(Boolean) : undefined)),
  tagIds: z
    .string()
    .optional()
    .transform((val) => (val ? val.split(",").filter(Boolean) : undefined)),
  createdAfter: z
    .string()
    .optional()
    .transform((val) => (val ? new Date(val) : undefined)),
  createdBefore: z
    .string()
    .optional()
    .transform((val) => (val ? new Date(val) : undefined)),

  // Visibility and Availability Filters
  status: z.enum(["DRAFT", "PUBLISHED", "ARCHIVED", "SCHEDULED"]).optional(),
  isPublished: z
    .string()
    .optional()
    .transform((val) => (val === undefined ? undefined : val === "true")),
  publishedAfter: z
    .string()
    .optional()
    .transform((val) => (val ? new Date(val) : undefined)),
  publishedBefore: z
    .string()
    .optional()
    .transform((val) => (val ? new Date(val) : undefined)),
  availableAfter: z
    .string()
    .optional()
    .transform((val) => (val ? new Date(val) : undefined)),
  availableBefore: z
    .string()
    .optional()
    .transform((val) => (val ? new Date(val) : undefined)),
  restrictedRegions: z
    .string()
    .optional()
    .transform((val) => (val ? val.split(",").filter(Boolean) : undefined)),
  allowedUserRoles: z
    .string()
    .optional()
    .transform((val) =>
      val
        ? val
            .split(",")
            .filter(Boolean)
            .map((role) => role as "CUSTOMER" | "ADMIN" | "SUPPORT")
        : undefined
    ),
  isLimited: z
    .string()
    .optional()
    .transform((val) => (val === undefined ? undefined : val === "true")),
  hasAvailableCapacity: z
    .string()
    .optional()
    .transform((val) => (val === undefined ? undefined : val === "true")),

  // Sorting
  sort: productSortSchema.optional(),
  sortDirection: z.enum(["asc", "desc"]).default("desc"),

  // Search
  search: z.string().optional(),

  // Response options
  facets: z
    .string()
    .optional()
    .transform((val) => val === "true")
    .default(false),
});

type GetProductsQuery = z.infer<typeof getProductsQuerySchema>;

/**
 * GET /api/products - List products with filtering and pagination
 *
 * Query Parameters:
 * - page: Page number (default: 1)
 * - limit: Items per page (default: 20, max: 100)
 * - cursor: Cursor for cursor-based pagination
 * - name: Filter by product name
 * - type: Filter by product type (ONE_TIME, SUBSCRIPTION, USAGE_BASED)
 * - isActive: Filter by active status
 * - isDigital: Filter by digital products
 * - inStock: Filter by stock availability
 * - priceMin/priceMax: Price range filtering
 * - categoryIds: Comma-separated list of category IDs
 * - tagIds: Comma-separated list of tag IDs
 * - sort: Sort field (name, price, createdAt, etc.)
 * - sortDirection: Sort direction (asc, desc)
 * - search: Full-text search query
 * - facets: Include faceted filter counts
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
        return `products_list_${ip}`;
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

    let validatedQuery: GetProductsQuery;
    try {
      validatedQuery = getProductsQuerySchema.parse(queryParams);
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
    const filters = productFilterSchema.parse({
      name: validatedQuery.name,
      type: validatedQuery.type,
      isActive: validatedQuery.isActive, // No default - let consumers specify what they want
      isDigital: validatedQuery.isDigital,
      inStock: validatedQuery.inStock,
      priceMin: validatedQuery.priceMin,
      priceMax: validatedQuery.priceMax,
      categoryIds: validatedQuery.categoryIds,
      tagIds: validatedQuery.tagIds,
      createdAfter: validatedQuery.createdAfter,
      createdBefore: validatedQuery.createdBefore,

      // Visibility and availability filters
      status: validatedQuery.status,
      isPublished: validatedQuery.isPublished,
      publishedAfter: validatedQuery.publishedAfter,
      publishedBefore: validatedQuery.publishedBefore,
      availableAfter: validatedQuery.availableAfter,
      availableBefore: validatedQuery.availableBefore,
      restrictedRegions: validatedQuery.restrictedRegions,
      allowedUserRoles: validatedQuery.allowedUserRoles,
      isLimited: validatedQuery.isLimited,
      hasAvailableCapacity: validatedQuery.hasAvailableCapacity,

      // Add search filter if provided
      search: validatedQuery.search,
    });

    // Fetch products with pagination and filtering
    const result = await productService.findMany(
      filters,
      validatedQuery.sort || "createdAt",
      validatedQuery.sortDirection,
      validatedQuery.page,
      validatedQuery.limit
    );

    // Get faceted results if requested
    let facets = undefined;
    if (validatedQuery.facets) {
      facets = await generateProductFacets(filters);
    }

    // Transform products for public API (remove sensitive fields)
    const publicProducts = result.products.map((product) => ({
      id: product.id,
      name: product.name,
      description: product.description,
      shortDescription: product.shortDescription,
      price: product.price,
      currency: product.currency,
      compareAtPrice: product.compareAtPrice,
      slug: product.slug,
      metaTitle: product.metaTitle,
      metaDescription: product.metaDescription,
      // Transform categories and tags
      categories:
        (product as any).categories?.map((pc: any) => ({
          id: pc.category.id,
          name: pc.category.name,
          slug: pc.category.slug,
        })) || [],
      tags:
        (product as any).tags?.map((pt: any) => ({
          id: pt.tag.id,
          name: pt.tag.name,
          slug: pt.tag.slug,
          color: pt.tag.color,
        })) || [],
      images: product.images,
      thumbnail: product.thumbnail,
      type: product.type,
      billingInterval: product.billingInterval,
      isActive: product.isActive,
      isDigital: product.isDigital,
      requiresShipping: product.requiresShipping,

      // Visibility and availability (public fields only)
      status: product.status,
      isPublished: product.isPublished,
      publishedAt: product.publishedAt,
      availableFrom: product.availableFrom,
      availableTo: product.availableTo,
      isLimited: product.isLimited,

      // Calculate derived fields
      inStock: product.isDigital || (product.stockQuantity || 0) > 0,
      isOnSale: !!product.compareAtPrice,
      discountPercentage: product.compareAtPrice
        ? Math.round(
            (1 - Number(product.price) / Number(product.compareAtPrice)) * 100
          )
        : undefined,
      hasAvailableCapacity:
        product.isLimited && product.maxUsers
          ? product.currentUsers < product.maxUsers
          : true,
      createdAt: product.createdAt,
      updatedAt: product.updatedAt,
    }));

    // Build response with pagination metadata
    const response = {
      products: publicProducts,
      pagination: {
        page: result.page,
        pages: result.pages,
        limit: result.limit,
        total: result.total,
        hasNextPage: result.page < result.pages,
        hasPrevPage: result.page > 1,
      },
      filters: validatedQuery,
      ...(validatedQuery.facets && facets && { facets }),
    };

    // Set cache headers for public product listings
    const cacheHeaders = {
      "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600", // 5 min cache, 10 min SWR
      Vary: "Accept, Accept-Encoding",
    };

    return NextResponse.json(response, {
      status: 200,
      headers: cacheHeaders,
    });
  } catch (_error) {
    return createApiErrorResponse(500, "Failed to fetch products");
  }
}

/**
 * Generate faceted search results for product filters
 */
async function generateProductFacets(filters: Record<string, any>) {
  try {
    // Convert productFilter to database query conditions
    const whereConditions = await buildProductWhereConditions(filters);

    // Get facet counts in parallel
    const [
      typesFacets,
      priceRangesFacets,
      availabilityFacets,
      categoryFacets,
      tagsFacets,
    ] = await Promise.all([
      // Product types facet
      db.product.groupBy({
        by: ["type"],
        where: whereConditions,
        _count: { type: true },
      }),

      // Price ranges facet
      getProductPriceRangeFacets(whereConditions),

      // Availability facets
      getProductAvailabilityFacets(whereConditions),

      // Categories facet
      getProductCategoryFacets(whereConditions),

      // Tags facet
      getProductTagsFacets(whereConditions),
    ]);

    return {
      types: typesFacets.map((facet) => ({
        value: facet.type,
        count: facet._count.type,
        label: formatProductTypeLabel(facet.type),
      })),
      priceRanges: priceRangesFacets,
      availability: availabilityFacets,
      categories: categoryFacets,
      tags: tagsFacets,
    };
  } catch (error) {
    console.error("Failed to generate product facets:", error);
    return null;
  }
}

/**
 * Build database where conditions from product filters
 */
async function buildProductWhereConditions(filters: Record<string, any>) {
  const conditions: Record<string, any> = {};

  // Basic filters
  if (filters.name) {
    conditions.name = { contains: filters.name, mode: "insensitive" };
  }
  if (filters.type) {
    conditions.type = filters.type;
  }
  if (filters.isActive !== undefined) {
    conditions.isActive = filters.isActive;
  }
  if (filters.isDigital !== undefined) {
    conditions.isDigital = filters.isDigital;
  }
  if (filters.status) {
    conditions.status = filters.status;
  }
  if (filters.isPublished !== undefined) {
    conditions.isPublished = filters.isPublished;
  }

  // Price range
  if (filters.priceMin !== undefined || filters.priceMax !== undefined) {
    conditions.price = {};
    if (filters.priceMin !== undefined) {
      conditions.price.gte = filters.priceMin;
    }
    if (filters.priceMax !== undefined) {
      conditions.price.lte = filters.priceMax;
    }
  }

  // Stock filtering
  if (filters.inStock !== undefined) {
    if (filters.inStock) {
      conditions.OR = [
        { isDigital: true },
        { stockQuantity: { gt: 0 } }
      ];
    } else {
      conditions.AND = [
        { isDigital: false },
        { stockQuantity: { lte: 0 } }
      ];
    }
  }

  // Categories
  if (filters.categoryIds && filters.categoryIds.length > 0) {
    conditions.categories = {
      some: {
        categoryId: { in: filters.categoryIds }
      }
    };
  }

  // Tags
  if (filters.tagIds && filters.tagIds.length > 0) {
    conditions.tags = {
      some: {
        tagId: { in: filters.tagIds }
      }
    };
  }

  // Date filters
  if (filters.createdAfter) {
    conditions.createdAt = { ...conditions.createdAt, gte: filters.createdAfter };
  }
  if (filters.createdBefore) {
    conditions.createdAt = { ...conditions.createdAt, lte: filters.createdBefore };
  }

  // Search functionality
  if (filters.search) {
    const searchTerm = filters.search.toLowerCase();
    conditions.OR = [
      { name: { contains: searchTerm, mode: "insensitive" } },
      { description: { contains: searchTerm, mode: "insensitive" } },
      { shortDescription: { contains: searchTerm, mode: "insensitive" } },
    ];
  }

  return conditions;
}

/**
 * Helper functions for facet generation
 */
async function getProductPriceRangeFacets(whereConditions: Record<string, any>) {
  const priceRanges = [
    { label: "Under $10", min: 0, max: 10 },
    { label: "$10 - $50", min: 10, max: 50 },
    { label: "$50 - $100", min: 50, max: 100 },
    { label: "$100 - $500", min: 100, max: 500 },
    { label: "Over $500", min: 500, max: null },
  ];

  const results = await Promise.all(
    priceRanges.map(async (range) => {
      const priceFilter = {
        ...whereConditions,
        price: {
          gte: range.min,
          ...(range.max && { lt: range.max }),
        },
      };

      const count = await db.product.count({ where: priceFilter });
      return {
        label: range.label,
        range: { min: range.min, max: range.max },
        count,
      };
    })
  );

  return results.filter((result) => result.count > 0);
}

async function getProductAvailabilityFacets(whereConditions: Record<string, any>) {
  const [inStockCount, digitalCount, physicalCount] = await Promise.all([
    db.product.count({
      where: {
        ...whereConditions,
        OR: [{ isDigital: true }, { stockQuantity: { gt: 0 } }],
      },
    }),
    db.product.count({
      where: { ...whereConditions, isDigital: true },
    }),
    db.product.count({
      where: { ...whereConditions, isDigital: false },
    }),
  ]);

  return [
    { label: "In Stock", value: "inStock", count: inStockCount },
    { label: "Digital", value: "digital", count: digitalCount },
    { label: "Physical", value: "physical", count: physicalCount },
  ].filter((facet) => facet.count > 0);
}

async function getProductCategoryFacets(whereConditions: Record<string, any>) {
  try {
    const categories = await db.category.findMany({
      where: {
        products: {
          some: {
            product: whereConditions,
          },
        },
      },
      include: {
        _count: {
          select: {
            products: {
              where: { product: whereConditions },
            },
          },
        },
      },
      orderBy: { name: "asc" },
      take: 20,
    });

    return categories
      .map((category) => ({
        id: category.id,
        name: category.name,
        slug: category.slug,
        count: category._count.products,
      }))
      .filter((category) => category.count > 0);
  } catch {
    return [];
  }
}

async function getProductTagsFacets(whereConditions: Record<string, any>) {
  try {
    const tags = await db.tag.findMany({
      where: {
        products: {
          some: {
            product: whereConditions,
          },
        },
      },
      include: {
        _count: {
          select: {
            products: {
              where: { product: whereConditions },
            },
          },
        },
      },
      orderBy: { name: "asc" },
      take: 15,
    });

    return tags
      .map((tag) => ({
        id: tag.id,
        name: tag.name,
        slug: tag.slug,
        color: tag.color,
        count: tag._count.products,
      }))
      .filter((tag) => tag.count > 0)
      .sort((a, b) => b.count - a.count);
  } catch {
    return [];
  }
}

function formatProductTypeLabel(type: string): string {
  switch (type) {
    case "ONE_TIME":
      return "One-time Purchase";
    case "SUBSCRIPTION":
      return "Subscription";
    case "USAGE_BASED":
      return "Usage-based";
    default:
      return type;
  }
}

/**
 * POST /api/products - Create a new product (admin only)
 *
 * Requires ADMIN role and valid product data.
 * Automatically handles Stripe product creation if configured.
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
      keyGenerator: () => `products_create_${session.user.id}`,
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
      validatedData = createProductSchema.parse(requestData);
    } catch (_error) {
      if (_error instanceof z.ZodError) {
        return createApiErrorResponse(
          400,
          "Invalid product data",
          _error.issues
        );
      }
      throw _error;
    }

    // Create the product
    const product = await productService.create(validatedData);

    // Log the admin action for audit
    const auditContext = getAuditContext(request, session);
    await auditAction({
      action: "CREATE_PRODUCT",
      resource: "Product",
      resourceId: product.id,
      adminUserId: auditContext.adminUserId,
      adminRole: auditContext.adminRole,
      ipAddress: auditContext.ipAddress,
      userAgent: auditContext.userAgent,
      details: {
        productName: product.name,
        productType: product.type,
        price: product.price,
        sku: product.sku,
      },
      severity: "INFO",
    });

    // Return created product (with admin fields)
    return NextResponse.json(
      {
        product,
        message: "Product created successfully",
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

    return createApiErrorResponse(500, "Failed to create product");
  }
}

/**
 * OPTIONS /api/products - Handle CORS preflight requests
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
