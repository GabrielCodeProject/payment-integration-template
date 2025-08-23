/**
 * Categories API Routes - Main endpoint for category listing and creation
 * 
 * Handles:
 * - GET: List categories with filtering, pagination, and sorting
 * - POST: Create new categories (admin only)
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
import { db } from '@/lib/db';
import { validateApiAccess, createApiErrorResponse, getAuditContext } from '@/lib/auth/server-session';
import { createCategorySchema, categoryFilterSchema, categorySortSchema } from '@/lib/validations/base/category';
import { rateLimit, auditAction } from '@/lib/api-helpers';

// Query parameters schema for GET requests
const getCategoriesQuerySchema = z.object({
  // Pagination
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(20),
  
  // Filtering
  name: z.string().optional(),
  slug: z.string().optional(),
  createdAfter: z.string().optional().transform(val => val ? new Date(val) : undefined),
  createdBefore: z.string().optional().transform(val => val ? new Date(val) : undefined),
  
  // Sorting
  sort: categorySortSchema.optional().default('createdAt'),
  sortDirection: z.enum(['asc', 'desc']).default('desc'),
  
  // Include product count
  includeProductCount: z.string().optional().transform(val => val === 'true'),
});

type GetCategoriesQuery = z.infer<typeof getCategoriesQuerySchema>;

/**
 * GET /api/categories - List categories with filtering and pagination
 * 
 * Query Parameters:
 * - page: Page number (default: 1)
 * - limit: Items per page (default: 20, max: 100)
 * - name: Filter by category name
 * - slug: Filter by category slug
 * - sort: Sort field (name, createdAt, updatedAt)
 * - sortDirection: Sort direction (asc, desc)
 * - includeProductCount: Include product count for each category
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
        return `categories_list_${ip}`;
      },
    });

    if (!rateLimitResult.success) {
      return createApiErrorResponse(429, 'Too many requests. Please try again later.');
    }

    // Parse and validate query parameters
    const url = new URL(request.url);
    const queryParams = Object.fromEntries(url.searchParams.entries());
    
    let validatedQuery: GetCategoriesQuery;
    try {
      validatedQuery = getCategoriesQuerySchema.parse(queryParams);
    } catch (_error) {
      if (_error instanceof z.ZodError) {
        return createApiErrorResponse(400, 'Invalid query parameters', _error.issues);
      }
      throw _error;
    }

    // Build filter object
    const filters = categoryFilterSchema.parse({
      name: validatedQuery.name,
      slug: validatedQuery.slug,
      createdAfter: validatedQuery.createdAfter,
      createdBefore: validatedQuery.createdBefore,
    });

    // Build where clause
    const whereClause: any = {};
    
    if (filters.name) {
      whereClause.name = {
        contains: filters.name,
        mode: 'insensitive',
      };
    }
    
    if (filters.slug) {
      whereClause.slug = {
        contains: filters.slug,
        mode: 'insensitive',
      };
    }
    
    if (filters.createdAfter || filters.createdBefore) {
      whereClause.createdAt = {};
      if (filters.createdAfter) whereClause.createdAt.gte = filters.createdAfter;
      if (filters.createdBefore) whereClause.createdAt.lte = filters.createdBefore;
    }

    // Get total count for pagination
    const totalCount = await db.category.count({ where: whereClause });
    const totalPages = Math.ceil(totalCount / validatedQuery.limit);
    const offset = (validatedQuery.page - 1) * validatedQuery.limit;

    // Fetch categories with pagination and filtering
    const categories = await db.category.findMany({
      where: whereClause,
      orderBy: {
        [validatedQuery.sort]: validatedQuery.sortDirection,
      },
      skip: offset,
      take: validatedQuery.limit,
      include: validatedQuery.includeProductCount ? {
        _count: {
          select: {
            products: true,
          },
        },
      } : undefined,
    });

    // Transform categories for public API
    const publicCategories = categories.map(category => ({
      id: category.id,
      name: category.name,
      description: category.description,
      slug: category.slug,
      createdAt: category.createdAt,
      updatedAt: category.updatedAt,
      ...(validatedQuery.includeProductCount && '_count' in category ? {
        productCount: category._count.products,
      } : {}),
    }));

    // Build response with pagination metadata
    const response = {
      categories: publicCategories,
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

    // Set cache headers for public category listings
    const cacheHeaders = {
      'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600', // 5 min cache, 10 min SWR
      'Vary': 'Accept, Accept-Encoding',
    };

    return NextResponse.json(response, { 
      status: 200,
      headers: cacheHeaders,
    });

  } catch (_error) {
    // console.error('Error fetching categories:', error);
    return createApiErrorResponse(500, 'Failed to fetch categories');
  }
}

/**
 * POST /api/categories - Create a new category (admin only)
 * 
 * Requires ADMIN role and valid category data.
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
      keyGenerator: () => `categories_create_${session.user.id}`,
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
      validatedData = createCategorySchema.parse(requestData);
    } catch (_error) {
      if (_error instanceof z.ZodError) {
        return createApiErrorResponse(400, 'Invalid category data', _error.issues);
      }
      throw _error;
    }

    // Auto-generate slug if not provided
    if (!validatedData.slug) {
      validatedData.slug = validatedData.name
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9\s-]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '');
    }

    // Check for duplicate name and slug
    const existingCategory = await db.category.findFirst({
      where: {
        OR: [
          { name: { equals: validatedData.name, mode: 'insensitive' } },
          { slug: validatedData.slug },
        ],
      },
    });

    if (existingCategory) {
      if (existingCategory.name.toLowerCase() === validatedData.name.toLowerCase()) {
        return createApiErrorResponse(409, 'A category with this name already exists');
      }
      if (existingCategory.slug === validatedData.slug) {
        return createApiErrorResponse(409, 'A category with this slug already exists');
      }
    }

    // Create the category
    const category = await db.category.create({
      data: validatedData,
    });

    // Log the admin action for audit
    const auditContext = getAuditContext(request, session);
    await auditAction({
      action: 'CREATE_CATEGORY',
      resource: 'Category',
      resourceId: category.id,
      adminUserId: auditContext.adminUserId,
      adminRole: auditContext.adminRole,
      ipAddress: auditContext.ipAddress,
      userAgent: auditContext.userAgent,
      details: {
        categoryName: category.name,
        categorySlug: category.slug,
      },
      severity: 'INFO',
    });

    // Return created category
    return NextResponse.json({
      category,
      message: 'Category created successfully',
    }, { status: 201 });

  } catch (_error) {
    // console.error('Error creating category:', error);
    
    // Handle specific business logic errors
    if (_error instanceof Error) {
      if (_error.message.includes('already exists')) {
        return createApiErrorResponse(409, _error.message);
      }
      if (_error.message.includes('validation')) {
        return createApiErrorResponse(400, _error.message);
      }
    }

    return createApiErrorResponse(500, 'Failed to create category');
  }
}

/**
 * OPTIONS /api/categories - Handle CORS preflight requests
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