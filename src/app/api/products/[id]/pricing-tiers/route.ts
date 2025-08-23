/**
 * Product Pricing Tiers API Routes
 * 
 * Handles:
 * - GET: List all pricing tiers for a product
 * - POST: Create new pricing tier (admin only)
 * 
 * Features:
 * - Role-based access control (public read, admin write)
 * - Business rule validation (freemium constraints, tier uniqueness)
 * - Pagination and filtering support
 * - Audit logging for admin operations
 * - Comprehensive error handling
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { PricingTierService } from '@/services/pricing-tier.service';
import { ProductService } from '@/services/products/product.service';
import { db } from '@/lib/db';
import { validateApiAccess, createApiErrorResponse, getAuditContext } from '@/lib/auth/server-session';
import { createPricingTierSchema, pricingTierSortSchema } from '@/lib/validations/base/pricing-tier';
import { cuidSchema } from '@/lib/validations/base/common';
import { rateLimit, auditAction } from '@/lib/api-helpers';

const pricingTierService = new PricingTierService(db);
const productService = new ProductService(db);

// Parameter validation schema
const paramsSchema = z.object({
  id: cuidSchema,
});

// Query parameters for listing tiers
const listQuerySchema = z.object({
  page: z.string().transform(val => parseInt(val, 10)).pipe(z.number().min(1)).optional(),
  limit: z.string().transform(val => parseInt(val, 10)).pipe(z.number().min(1).max(100)).optional(),
  sort: pricingTierSortSchema.optional(),
  sortDirection: z.enum(['asc', 'desc']).optional(),
  includeInactive: z.string().transform(val => val === 'true').optional(),
  isFreemium: z.string().transform(val => val === 'true').optional(),
  hasTrialPeriod: z.string().transform(val => val === 'true').optional(),
});

/**
 * GET /api/products/[id]/pricing-tiers - List pricing tiers for a product
 * 
 * Public endpoint with optional filters and pagination.
 * Shows only active tiers to public users, all tiers to admins.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Await params in Next.js 15+
    const resolvedParams = await params;
    
    // Validate product ID parameter
    let validatedParams;
    try {
      validatedParams = paramsSchema.parse(resolvedParams);
    } catch (_error) {
      if (_error instanceof z.ZodError) {
        return createApiErrorResponse(400, 'Invalid product ID format');
      }
      throw _error;
    }

    // Parse query parameters
    const url = new URL(request.url);
    const queryParams = Object.fromEntries(url.searchParams);
    
    let validatedQuery;
    try {
      validatedQuery = listQuerySchema.parse(queryParams);
    } catch (_error) {
      if (_error instanceof z.ZodError) {
        return createApiErrorResponse(400, 'Invalid query parameters', _error.issues);
      }
      throw _error;
    }

    // Apply rate limiting for public endpoints
    const rateLimitResult = await rateLimit(request, {
      windowMs: 15 * 60 * 1000, // 15 minutes
      maxRequests: 300, // Higher limit for tier listings
      keyGenerator: (req) => {
        const forwarded = req.headers.get('x-forwarded-for');
        const ip = forwarded ? forwarded.split(',')[0] : 'unknown';
        return `pricing_tiers_${ip}`;
      },
    });

    if (!rateLimitResult.success) {
      return createApiErrorResponse(429, 'Too many requests. Please try again later.');
    }

    // Check if user is admin for access to inactive tiers
    const { session } = await validateApiAccess(request);
    const isAdmin = session?.user?.role === 'ADMIN';

    // Verify product exists
    const product = await productService.findById(validatedParams.id);
    if (!product) {
      return createApiErrorResponse(404, 'Product not found');
    }

    // Hide inactive products from public unless admin
    if (!product.isActive && !isAdmin) {
      return createApiErrorResponse(404, 'Product not found');
    }

    // Build filters
    const filters = {
      productId: validatedParams.id,
      isFreemium: validatedQuery.isFreemium,
      hasTrialPeriod: validatedQuery.hasTrialPeriod,
      // Only allow admin to see inactive tiers
      isActive: !isAdmin ? true : undefined,
    };

    // Get pricing tiers with pagination
    const result = await pricingTierService.findMany(
      validatedParams.id,
      filters,
      validatedQuery.sort || 'sortOrder',
      validatedQuery.sortDirection || 'asc',
      validatedQuery.page || 1,
      validatedQuery.limit || 20
    );

    // Transform tiers for response
    const transformedTiers = result.tiers.map(tier => ({
      id: tier.id,
      name: tier.name,
      description: tier.description,
      price: tier.price,
      currency: tier.currency,
      billingInterval: tier.billingInterval,
      trialDays: tier.trialDays,
      features: tier.features,
      isFreemium: tier.isFreemium,
      isActive: tier.isActive,
      sortOrder: tier.sortOrder,
      createdAt: tier.createdAt,
      updatedAt: tier.updatedAt,
      // Include admin fields if admin user
      ...(isAdmin && {
        stripePriceId: tier.stripePriceId,
      }),
    }));

    const response = {
      tiers: transformedTiers,
      pagination: {
        page: result.page,
        pages: result.pages,
        total: result.total,
        limit: result.limit,
      },
      product: {
        id: product.id,
        name: product.name,
        type: product.type,
      },
    };

    // Set cache headers for public tier listings
    const cacheHeaders = product.isActive ? {
      'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600', // 5 min cache, 10 min SWR
      'Vary': 'Accept, Accept-Encoding',
    } : {};

    return NextResponse.json(response, { 
      status: 200,
      headers: cacheHeaders,
    });

  } catch (_error) {
    // console.error('Error fetching pricing tiers:', error);
    return createApiErrorResponse(500, 'Failed to fetch pricing tiers');
  }
}

/**
 * POST /api/products/[id]/pricing-tiers - Create new pricing tier (admin only)
 * 
 * Validates business rules and logs audit trail.
 * Enforces freemium constraints and tier name uniqueness.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Validate admin authentication
    const { isValid, session, error } = await validateApiAccess(request, 'ADMIN');
    
    if (!isValid || !session) {
      return createApiErrorResponse(
        error?.code || 401,
        error?.message || 'Admin authentication required'
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
        return createApiErrorResponse(400, 'Invalid product ID format');
      }
      throw _error;
    }

    // Apply rate limiting for admin operations
    const rateLimitResult = await rateLimit(request, {
      windowMs: 15 * 60 * 1000, // 15 minutes
      maxRequests: 100, // 100 admin operations per window
      keyGenerator: () => `pricing_tier_create_${session.user.id}`,
    });

    if (!rateLimitResult.success) {
      return createApiErrorResponse(429, 'Too many admin requests. Please try again later.');
    }

    // Verify product exists
    const product = await productService.findById(validatedParams.id);
    if (!product) {
      return createApiErrorResponse(404, 'Product not found');
    }

    // Parse and validate request body
    let requestData;
    try {
      requestData = await request.json();
    } catch {
      return createApiErrorResponse(400, 'Invalid JSON in request body');
    }

    // Add the product ID to the request data
    const createData = { ...requestData, productId: validatedParams.id };

    let validatedData;
    try {
      validatedData = createPricingTierSchema.parse(createData);
    } catch (_error) {
      if (_error instanceof z.ZodError) {
        return createApiErrorResponse(400, 'Invalid pricing tier data', _error.issues);
      }
      throw _error;
    }

    // Create the pricing tier
    const pricingTier = await pricingTierService.create(validatedData);

    // Log the admin action for audit
    const auditContext = getAuditContext(request, session);
    await auditAction({
      action: 'CREATE_PRICING_TIER',
      resource: 'PricingTier',
      resourceId: pricingTier.id,
      adminUserId: auditContext.adminUserId,
      adminRole: auditContext.adminRole,
      ipAddress: auditContext.ipAddress,
      userAgent: auditContext.userAgent,
      details: {
        productId: validatedParams.id,
        productName: product.name,
        tierName: pricingTier.name,
        price: pricingTier.price.toString(),
        currency: pricingTier.currency,
        isFreemium: pricingTier.isFreemium,
        billingInterval: pricingTier.billingInterval,
        features: pricingTier.features,
      },
      severity: 'INFO',
    });

    return NextResponse.json({
      tier: pricingTier,
      message: 'Pricing tier created successfully',
    }, { status: 201 });

  } catch (_error) {
    // console.error('Error creating pricing tier:', error);
    
    // Handle specific business logic errors
    if (_error instanceof Error) {
      if (_error.message.includes('already exists')) {
        return createApiErrorResponse(409, _error.message);
      }
      if (_error.message.includes('not found')) {
        return createApiErrorResponse(404, _error.message);
      }
      if (_error.message.includes('freemium')) {
        return createApiErrorResponse(400, _error.message);
      }
      if (_error.message.includes('validation')) {
        return createApiErrorResponse(400, _error.message);
      }
    }

    return createApiErrorResponse(500, 'Failed to create pricing tier');
  }
}

/**
 * OPTIONS /api/products/[id]/pricing-tiers - Handle CORS preflight requests
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