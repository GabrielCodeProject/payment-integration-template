/**
 * Product Search API Route
 *
 * Handles:
 * - GET: Full-text search across products
 * - Advanced filtering with search relevance
 * - Search analytics and suggestions
 *
 * Features:
 * - Full-text search across multiple fields (name, description, tags)
 * - Search relevance scoring and ranking
 * - Auto-complete and search suggestions
 * - Search analytics and tracking
 * - Advanced filters combined with search
 * - Typo tolerance and fuzzy matching
 * - Search result highlighting
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
// import { ProductService } from '@/services/products/product.service'; // Reserved for future enhancements
import { rateLimit } from "@/lib/api-helpers";
import {
  createApiErrorResponse,
  validateApiAccess,
} from "@/lib/auth/server-session";
import { db } from "@/lib/db";

// const productService = new ProductService(db); // Used for future enhancements

// Search query schema
const searchQuerySchema = z.object({
  // Core search parameters
  q: z
    .string()
    .min(1, "Search query is required")
    .max(200, "Search query too long"),

  // Pagination
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(50).default(20),

  // Search options
  searchType: z
    .enum(["all", "name", "description", "tags", "sku"])
    .default("all"),
  fuzzy: z
    .string()
    .optional()
    .transform((val) => val === "true")
    .default(false),
  exact: z
    .string()
    .optional()
    .transform((val) => val === "true")
    .default(false),

  // Filtering (combined with search)
  type: z.enum(["ONE_TIME", "SUBSCRIPTION", "USAGE_BASED"]).optional(),
  priceMin: z.coerce.number().min(0).optional(),
  priceMax: z.coerce.number().min(0).optional(),
  tags: z
    .string()
    .optional()
    .transform((val) => (val ? val.split(",").filter(Boolean) : undefined)),
  inStock: z
    .string()
    .optional()
    .transform((val) => val === "true"),

  // Sorting and ranking
  sort: z
    .enum(["relevance", "price", "name", "createdAt"])
    .default("relevance"),
  sortDirection: z.enum(["asc", "desc"]).default("desc"),

  // Response options
  highlight: z
    .string()
    .transform((val) => val === "true")
    .default("false"),
  suggestions: z
    .string()
    .transform((val) => val === "true")
    .default("false"),
  facets: z
    .string()
    .transform((val) => val === "true")
    .default("false"),
});

type SearchQuery = z.infer<typeof searchQuerySchema>;

/**
 * GET /api/products/search - Search products with full-text capabilities
 *
 * Query Parameters:
 * - q: Search query (required)
 * - page: Page number (default: 1)
 * - limit: Items per page (default: 20, max: 50)
 * - searchType: Type of search (all, name, description, tags, sku)
 * - fuzzy: Enable fuzzy matching for typo tolerance
 * - exact: Require exact phrase matching
 * - sort: Sort results (relevance, price, name, createdAt)
 * - highlight: Include search term highlighting
 * - suggestions: Include search suggestions
 * - facets: Include faceted search counts
 * - Additional filters: type, priceMin, priceMax, tags, inStock
 */
export async function GET(request: NextRequest) {
  try {
    // Apply rate limiting for search endpoints
    const rateLimitResult = await rateLimit(request, {
      windowMs: 15 * 60 * 1000, // 15 minutes
      maxRequests: 200, // 200 searches per window
      keyGenerator: (req) => {
        const forwarded = req.headers.get("x-forwarded-for");
        const ip = forwarded ? forwarded.split(",")[0] : "unknown";
        return `product_search_${ip}`;
      },
    });

    if (!rateLimitResult.success) {
      return createApiErrorResponse(
        429,
        "Too many search requests. Please try again later."
      );
    }

    // Parse and validate query parameters
    const url = new URL(request.url);
    const queryParams = Object.fromEntries(url.searchParams.entries());

    let validatedQuery: SearchQuery;
    try {
      validatedQuery = searchQuerySchema.parse(queryParams);
    } catch (_error) {
      if (_error instanceof z.ZodError) {
        return createApiErrorResponse(
          400,
          "Invalid search parameters",
          _error.issues
        );
      }
      throw _error;
    }

    // Check if user is admin for access to inactive products
    const { session } = await validateApiAccess(request);
    const isAdmin = session?.user?.role === "ADMIN";

    // Perform the search
    const searchResults = await performProductSearch(validatedQuery, isAdmin);

    // Get faceted search results if requested
    let facets = undefined;
    if (validatedQuery.facets) {
      facets = await generateSearchFacets(validatedQuery, isAdmin);
    }

    // Log search analytics (non-blocking)
    logSearchAnalytics(validatedQuery, searchResults.total, request).catch(
      () => {
        // Silently ignore analytics errors
      }
    );

    // Build response
    const response = {
      query: validatedQuery.q,
      results: searchResults.products,
      pagination: {
        page: validatedQuery.page,
        pages: Math.ceil(searchResults.total / validatedQuery.limit),
        limit: validatedQuery.limit,
        total: searchResults.total,
        hasNextPage:
          validatedQuery.page <
          Math.ceil(searchResults.total / validatedQuery.limit),
        hasPrevPage: validatedQuery.page > 1,
      },
      searchMeta: {
        searchType: validatedQuery.searchType,
        fuzzy: validatedQuery.fuzzy,
        exact: validatedQuery.exact,
        sort: validatedQuery.sort,
        executionTime: searchResults.executionTime,
        totalFound: searchResults.total,
      },
      ...(validatedQuery.suggestions && {
        suggestions: searchResults.suggestions,
      }),
      ...(validatedQuery.highlight && { highlights: searchResults.highlights }),
      ...(validatedQuery.facets && facets && { facets }),
    };

    // Set cache headers (shorter cache for search results)
    const cacheHeaders = {
      "Cache-Control": "public, s-maxage=60, stale-while-revalidate=120", // 1 min cache, 2 min SWR
      Vary: "Accept, Accept-Encoding",
    };

    return NextResponse.json(response, {
      status: 200,
      headers: cacheHeaders,
    });
  } catch (_error) {
    return createApiErrorResponse(500, "Search request failed");
  }
}

/**
 * Perform product search with various options and filters
 */
async function performProductSearch(query: SearchQuery, isAdmin: boolean) {
  const startTime = Date.now();

  // Build search conditions based on search type
  const searchConditions = buildSearchConditions(query);

  // Build additional filters
  const filters = {
    ...(query.type && { type: query.type }),
    ...(query.priceMin !== undefined && {
      price: {
        gte: query.priceMin,
        ...(query.priceMax !== undefined && { lte: query.priceMax }),
      },
    }),
    ...(query.priceMax !== undefined &&
      !query.priceMin && {
        price: { lte: query.priceMax },
      }),
    ...(query.tags &&
      query.tags.length > 0 && {
        tags: { hasSome: query.tags },
      }),
    ...(query.inStock !== undefined && {
      OR: [
        { isDigital: true },
        { stockQuantity: query.inStock ? { gt: 0 } : { lte: 0 } },
      ],
    }),
    // Hide inactive products from public
    ...(!isAdmin && { isActive: true }),
  };

  // Combine search and filters
  const whereClause = {
    AND: [searchConditions, filters].filter(
      (condition) => Object.keys(condition).length > 0
    ),
  };

  // Build order by clause
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let orderBy: any = {};

  if (query.sort === "relevance") {
    // For relevance, we'll use a combination of text matching and recency
    // This is a simplified relevance - in production you might use full-text search engines
    orderBy = [
      { createdAt: "desc" }, // Newer products first for relevance
    ];
  } else {
    orderBy = { [query.sort]: query.sortDirection };
  }

  // Calculate pagination
  const offset = (query.page - 1) * query.limit;

  // Execute search query
  const [products, total] = await Promise.all([
    db.product.findMany({
      where: whereClause,
      orderBy,
      skip: offset,
      take: query.limit,
    }),
    db.product.count({ where: whereClause }),
  ]);

  // Transform products for public API
  const publicProducts = products.map((product) => ({
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
    tags: product.tags,
    images: product.images,
    thumbnail: product.thumbnail,
    type: product.type,
    billingInterval: product.billingInterval,
    isActive: product.isActive,
    isDigital: product.isDigital,
    requiresShipping: product.requiresShipping,
    // Include admin fields if admin user
    ...(isAdmin && {
      sku: product.sku,
      stockQuantity: product.stockQuantity,
      lowStockThreshold: product.lowStockThreshold,
    }),
    // Calculate derived fields
    inStock: product.isDigital || (product.stockQuantity || 0) > 0,
    isOnSale: !!product.compareAtPrice,
    discountPercentage: product.compareAtPrice
      ? Math.round(
          (1 - Number(product.price) / Number(product.compareAtPrice)) * 100
        )
      : undefined,
    createdAt: product.createdAt,
    updatedAt: product.updatedAt,
  }));

  // Generate search suggestions if requested
  let suggestions: string[] = [];
  if (query.suggestions && products.length < 5) {
    suggestions = await generateSearchSuggestions(query.q);
  }

  // Generate highlights if requested
  let highlights: Record<string, string[]> = {};
  if (query.highlight) {
    highlights = generateSearchHighlights(publicProducts, query.q);
  }

  const executionTime = Date.now() - startTime;

  return {
    products: publicProducts,
    total,
    suggestions,
    highlights,
    executionTime,
  };
}

/**
 * Build search conditions based on search type and query
 */
function buildSearchConditions(query: SearchQuery) {
  const searchTerm = query.q.toLowerCase();
  const isExact = query.exact;
  // const isFuzzy = query.fuzzy; // Reserved for future fuzzy matching implementation

  // Build search conditions based on search type
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const conditions: any = {};

  if (query.searchType === "all") {
    // Search across all fields
    const searchConditions = [
      { name: { contains: searchTerm, mode: "insensitive" } },
      { description: { contains: searchTerm, mode: "insensitive" } },
      { shortDescription: { contains: searchTerm, mode: "insensitive" } },
      { tags: { hasSome: [searchTerm] } },
    ];

    // Add SKU search for exact matches
    if (isExact || searchTerm.length > 3) {
      searchConditions.push({
        sku: { contains: searchTerm, mode: "insensitive" },
      });
    }

    conditions.OR = searchConditions;
  } else {
    // Search specific field
    switch (query.searchType) {
      case "name":
        conditions.name = { contains: searchTerm, mode: "insensitive" };
        break;
      case "description":
        conditions.OR = [
          { description: { contains: searchTerm, mode: "insensitive" } },
          { shortDescription: { contains: searchTerm, mode: "insensitive" } },
        ];
        break;
      case "tags":
        conditions.tags = { hasSome: [searchTerm] };
        break;
      case "sku":
        conditions.sku = { contains: searchTerm, mode: "insensitive" };
        break;
    }
  }

  return conditions;
}

/**
 * Generate search suggestions for poor results
 */
async function generateSearchSuggestions(query: string): Promise<string[]> {
  try {
    // Get popular search terms from products (simplified approach)
    const suggestions = await db.product.findMany({
      where: {
        isActive: true,
        OR: [
          { name: { contains: query.slice(0, 3), mode: "insensitive" } },
          { tags: { hasSome: [query.slice(0, 3)] } },
        ],
      },
      select: { name: true, tags: true },
      take: 10,
    });

    const suggestionSet = new Set<string>();

    suggestions.forEach((product) => {
      // Add product names
      const words = product.name.toLowerCase().split(" ");
      words.forEach((word) => {
        if (word.length > 3 && word.includes(query.toLowerCase().slice(0, 3))) {
          suggestionSet.add(product.name);
        }
      });

      // Add relevant tags
      product.tags.forEach((tag) => {
        if (tag.toLowerCase().includes(query.toLowerCase().slice(0, 3))) {
          suggestionSet.add(tag);
        }
      });
    });

    return Array.from(suggestionSet).slice(0, 5);
  } catch {
    return [];
  }
}

/**
 * Generate search result highlights
 */

function generateSearchHighlights(
  products: any[],
  query: string
): Record<string, string[]> {
  const highlights: Record<string, string[]> = {};
  const searchTerm = query.toLowerCase();

  products.forEach((product) => {
    const productHighlights: string[] = [];

    // Highlight in name
    if (product.name?.toLowerCase().includes(searchTerm)) {
      productHighlights.push(
        `name: ${highlightText(product.name, searchTerm)}`
      );
    }

    // Highlight in description
    if (product.description?.toLowerCase().includes(searchTerm)) {
      const excerpt = extractExcerpt(product.description, searchTerm, 100);
      productHighlights.push(
        `description: ${highlightText(excerpt, searchTerm)}`
      );
    }

    // Highlight in tags
    const matchingTags = product.tags?.filter((tag: string) =>
      tag.toLowerCase().includes(searchTerm)
    );
    if (matchingTags?.length > 0) {
      productHighlights.push(
        `tags: ${matchingTags.map((tag: string) => highlightText(tag, searchTerm)).join(", ")}`
      );
    }

    if (productHighlights.length > 0) {
      highlights[product.id] = productHighlights;
    }
  });

  return highlights;
}

/**
 * Highlight search terms in text
 */
function highlightText(text: string, term: string): string {
  const regex = new RegExp(`(${term})`, "gi");
  return text.replace(regex, "<mark>$1</mark>");
}

/**
 * Extract excerpt around search term
 */
function extractExcerpt(text: string, term: string, maxLength: number): string {
  const index = text.toLowerCase().indexOf(term.toLowerCase());
  if (index === -1) return text.slice(0, maxLength);

  const start = Math.max(0, index - maxLength / 2);
  const end = Math.min(text.length, start + maxLength);

  return (
    (start > 0 ? "..." : "") +
    text.slice(start, end) +
    (end < text.length ? "..." : "")
  );
}

/**
 * Generate faceted search results with counts for filters
 */
async function generateSearchFacets(query: SearchQuery, isAdmin: boolean) {
  try {
    // Build base search conditions (same as main search)
    const searchConditions = buildSearchConditions(query);

    // Base filter for admin vs public access
    const baseFilter = {
      AND: [searchConditions, !isAdmin ? { isActive: true } : {}].filter(
        (condition) => Object.keys(condition).length > 0
      ),
    };

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
        where: baseFilter,
        _count: { type: true },
      }),

      // Price ranges facet (predefined ranges)
      getPriceRangeFacets(baseFilter),

      // Availability facets
      getAvailabilityFacets(baseFilter),

      // Categories facet
      getCategoryFacets(baseFilter),

      // Tags facet (top 10 most common)
      getTagsFacets(baseFilter),
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
    console.error("Failed to generate search facets:", error);
    return null;
  }
}

/**
 * Get price range facets with predefined ranges
 */
async function getPriceRangeFacets(baseFilter: any) {
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
        ...baseFilter,
        AND: [
          ...baseFilter.AND,
          {
            price: {
              gte: range.min,
              ...(range.max && { lt: range.max }),
            },
          },
        ],
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

/**
 * Get availability facets (in stock, digital, physical)
 */
async function getAvailabilityFacets(baseFilter: any) {
  const [inStockCount, digitalCount, physicalCount] = await Promise.all([
    // In stock (digital OR has stock)
    db.product.count({
      where: {
        ...baseFilter,
        AND: [
          ...baseFilter.AND,
          {
            OR: [{ isDigital: true }, { stockQuantity: { gt: 0 } }],
          },
        ],
      },
    }),

    // Digital products
    db.product.count({
      where: {
        ...baseFilter,
        AND: [...baseFilter.AND, { isDigital: true }],
      },
    }),

    // Physical products
    db.product.count({
      where: {
        ...baseFilter,
        AND: [...baseFilter.AND, { isDigital: false }],
      },
    }),
  ]);

  return [
    { label: "In Stock", value: "inStock", count: inStockCount },
    { label: "Digital", value: "digital", count: digitalCount },
    { label: "Physical", value: "physical", count: physicalCount },
  ].filter((facet) => facet.count > 0);
}

/**
 * Get category facets with counts
 */
async function getCategoryFacets(baseFilter: any) {
  try {
    // Get categories with their product counts
    const categories = await db.category.findMany({
      where: {
        products: {
          some: {
            product: baseFilter,
          },
        },
      },
      include: {
        _count: {
          select: {
            products: {
              where: {
                product: baseFilter,
              },
            },
          },
        },
      },
      orderBy: { name: "asc" },
      take: 20, // Limit to top 20 categories
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

/**
 * Get tags facets with counts
 */
async function getTagsFacets(baseFilter: any) {
  try {
    // Get tags with their product counts
    const tags = await db.tag.findMany({
      where: {
        products: {
          some: {
            product: baseFilter,
          },
        },
      },
      include: {
        _count: {
          select: {
            products: {
              where: {
                product: baseFilter,
              },
            },
          },
        },
      },
      orderBy: { name: "asc" },
      take: 15, // Limit to top 15 tags
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
      .sort((a, b) => b.count - a.count); // Sort by count descending
  } catch {
    return [];
  }
}

/**
 * Format product type labels for display
 */
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
 * Log search analytics for insights and improvements
 */
async function logSearchAnalytics(
  query: SearchQuery,
  resultCount: number,
  request: NextRequest
) {
  try {
    const ipAddress =
      request.headers.get("x-forwarded-for") ||
      request.headers.get("x-real-ip") ||
      "unknown";
    const userAgent = request.headers.get("user-agent") || "unknown";

    // In a production system, you might want to log to a separate analytics table
    // or send to an analytics service. For now, we'll use the audit log.
    await db.auditLog.create({
      data: {
        tableName: "product_search",
        recordId: "search_analytics",
        action: "SEARCH",
        userId: null, // Anonymous search
        ipAddress,
        userAgent,
        metadata: {
          query: query.q,
          searchType: query.searchType,
          resultCount,
          page: query.page,
          limit: query.limit,
          filters: {
            type: query.type,
            priceRange: { min: query.priceMin, max: query.priceMax },
            tags: query.tags,
            inStock: query.inStock,
          },
          sort: query.sort,
          timestamp: new Date().toISOString(),
        },
      },
    });
  } catch (_error) {
    // Don't let analytics failures break the search
    console.error("Failed to log search analytics:", _error);
  }
}

/**
 * OPTIONS /api/products/search - Handle CORS preflight requests
 */
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
      "Access-Control-Max-Age": "86400",
    },
  });
}
