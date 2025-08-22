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

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { ProductService } from '@/services/products/product.service';
import { db } from '@/lib/db';
import { validateApiAccess, createApiErrorResponse, getAuditContext } from '@/lib/auth/server-session';
import { createProductSchema, productFilterSchema, productSortSchema } from '@/lib/validations/base/product';
import { rateLimit, auditAction } from '@/lib/api-helpers';

const productService = new ProductService(db);

// Query parameters schema for GET requests
const getProductsQuerySchema = z.object({
  // Pagination
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(20),
  cursor: z.string().optional(),
  
  // Filtering
  name: z.string().optional(),
  type: z.enum(['ONE_TIME', 'SUBSCRIPTION', 'USAGE_BASED']).optional(),
  isActive: z.string().optional().transform(val => val === 'true').optional(),
  isDigital: z.string().optional().transform(val => val === 'true').optional(),
  inStock: z.string().optional().transform(val => val === 'true').optional(),
  priceMin: z.coerce.number().min(0).optional(),
  priceMax: z.coerce.number().min(0).optional(),
  tags: z.string().optional().transform(val => val ? val.split(',').filter(Boolean) : undefined),
  createdAfter: z.string().optional().transform(val => val ? new Date(val) : undefined),
  createdBefore: z.string().optional().transform(val => val ? new Date(val) : undefined),
  
  // Sorting
  sort: productSortSchema.optional(),
  sortDirection: z.enum(['asc', 'desc']).default('desc'),
  
  // Search
  search: z.string().optional(),
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
 * - tags: Comma-separated list of tags
 * - sort: Sort field (name, price, createdAt, etc.)
 * - sortDirection: Sort direction (asc, desc)
 * - search: Full-text search query
 */
export async function GET(request: NextRequest) {
  try {
    // Apply rate limiting for public endpoints
    const rateLimitResult = await rateLimit(request, {
      windowMs: 15 * 60 * 1000, // 15 minutes
      maxRequests: 100, // 100 requests per window
      keyGenerator: (req) => {
        const forwarded = req.headers.get('x-forwarded-for');
        const ip = forwarded ? forwarded.split(',')[0] : 'unknown';
        return `products_list_${ip}`;
      },
    });

    if (!rateLimitResult.success) {
      return createApiErrorResponse(429, 'Too many requests. Please try again later.');
    }

    // Parse and validate query parameters
    const url = new URL(request.url);
    const queryParams = Object.fromEntries(url.searchParams.entries());
    
    let validatedQuery: GetProductsQuery;
    try {
      validatedQuery = getProductsQuerySchema.parse(queryParams);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return createApiErrorResponse(400, 'Invalid query parameters', error.issues);
      }
      throw error;
    }

    // Build filter object
    const filters = productFilterSchema.parse({
      name: validatedQuery.name,
      type: validatedQuery.type,
      isActive: validatedQuery.isActive ?? true, // Default to active products for public API
      isDigital: validatedQuery.isDigital,
      inStock: validatedQuery.inStock,
      priceMin: validatedQuery.priceMin,
      priceMax: validatedQuery.priceMax,
      tags: validatedQuery.tags,
      createdAfter: validatedQuery.createdAfter,
      createdBefore: validatedQuery.createdBefore,
    });

    // Fetch products with pagination and filtering
    const result = await productService.findMany(
      filters,
      validatedQuery.sort || 'createdAt',
      validatedQuery.sortDirection,
      validatedQuery.page,
      validatedQuery.limit
    );

    // Transform products for public API (remove sensitive fields)
    const publicProducts = result.products.map(product => ({
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
      // Calculate derived fields
      inStock: product.isDigital || (product.stockQuantity || 0) > 0,
      isOnSale: !!product.compareAtPrice,
      discountPercentage: product.compareAtPrice 
        ? Math.round((1 - Number(product.price) / Number(product.compareAtPrice)) * 100)
        : undefined,
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
    };

    // Set cache headers for public product listings
    const cacheHeaders = {
      'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600', // 5 min cache, 10 min SWR
      'Vary': 'Accept, Accept-Encoding',
    };

    return NextResponse.json(response, { 
      status: 200,
      headers: cacheHeaders,
    });

  } catch (error) {
    console.error('Error fetching products:', error);
    return createApiErrorResponse(500, 'Failed to fetch products');
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
    const { isValid, session, error } = await validateApiAccess(request, 'ADMIN');
    
    if (!isValid || !session) {
      return createApiErrorResponse(
        error?.code || 401,
        error?.message || 'Admin authentication required'
      );
    }

    // Apply stricter rate limiting for admin operations
    const rateLimitResult = await rateLimit(request, {
      windowMs: 15 * 60 * 1000, // 15 minutes  
      maxRequests: 50, // 50 admin operations per window
      keyGenerator: () => `products_create_${session.user.id}`,
    });

    if (!rateLimitResult.success) {
      return createApiErrorResponse(429, 'Too many admin requests. Please try again later.');
    }

    // Parse and validate request body
    let requestData;
    try {
      requestData = await request.json();
    } catch {
      return createApiErrorResponse(400, 'Invalid JSON in request body');
    }

    let validatedData;
    try {
      validatedData = createProductSchema.parse(requestData);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return createApiErrorResponse(400, 'Invalid product data', error.issues);
      }
      throw error;
    }

    // Create the product
    const product = await productService.create(validatedData);

    // Log the admin action for audit
    const auditContext = getAuditContext(request, session);
    await auditAction({
      action: 'CREATE_PRODUCT',
      resource: 'Product',
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
      severity: 'INFO',
    });

    // Return created product (with admin fields)
    return NextResponse.json({
      product,
      message: 'Product created successfully',
    }, { status: 201 });

  } catch (error) {
    console.error('Error creating product:', error);
    
    // Handle specific business logic errors
    if (error instanceof Error) {
      if (error.message.includes('already exists')) {
        return createApiErrorResponse(409, error.message);
      }
      if (error.message.includes('validation')) {
        return createApiErrorResponse(400, error.message);
      }
    }

    return createApiErrorResponse(500, 'Failed to create product');
  }
}

/**
 * OPTIONS /api/products - Handle CORS preflight requests
 */
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Max-Age': '86400',
    },
  });
}