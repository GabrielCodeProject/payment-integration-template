/**
 * Individual Pricing Tier API Routes
 * 
 * Handles:
 * - GET: Get single pricing tier details
 * - PUT: Update existing pricing tier (admin only)  
 * - DELETE: Delete pricing tier (admin only)
 * 
 * Features:
 * - Role-based access control (public read, admin write)
 * - Business rule validation (freemium constraints, etc.)
 * - Audit logging for admin operations
 * - Comprehensive error handling
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { PricingTierService } from '@/services/pricing-tier.service';
import { ProductService } from '@/services/products/product.service';
import { db } from '@/lib/db';
import { validateApiAccess, createApiErrorResponse, getAuditContext } from '@/lib/auth/server-session';
import { updatePricingTierSchema } from '@/lib/validations/base/pricing-tier';
import { cuidSchema } from '@/lib/validations/base/common';
import { rateLimit, auditAction } from '@/lib/api-helpers';

const pricingTierService = new PricingTierService(db);
const productService = new ProductService(db);

// Parameter validation schema
const paramsSchema = z.object({
  id: cuidSchema,
  tierId: cuidSchema,
});

/**
 * GET /api/products/[id]/pricing-tiers/[tierId] - Get single pricing tier details
 * 
 * Public endpoint with caching for active tiers.
 * Returns 404 for inactive tiers unless accessed by admin.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; tierId: string }> }
) {
  try {
    // Await params in Next.js 15+
    const resolvedParams = await params;
    
    // Validate parameters
    let validatedParams;
    try {
      validatedParams = paramsSchema.parse(resolvedParams);
    } catch (_error) {
      if (_error instanceof z.ZodError) {
        return createApiErrorResponse(400, 'Invalid parameter format');
      }
      throw _error;
    }

    // Apply rate limiting for public endpoints
    const rateLimitResult = await rateLimit(request, {
      windowMs: 15 * 60 * 1000, // 15 minutes
      maxRequests: 300, // Higher limit for individual tier views
      keyGenerator: (req) => {
        const forwarded = req.headers.get('x-forwarded-for');
        const ip = forwarded ? forwarded.split(',')[0] : 'unknown';
        return `pricing_tier_detail_${ip}`;
      },
    });

    if (!rateLimitResult.success) {
      return createApiErrorResponse(429, 'Too many requests. Please try again later.');
    }

    // Check if user is admin for access to inactive tiers
    const { session } = await validateApiAccess(request);
    const isAdmin = session?.user?.role === 'ADMIN';

    // Fetch the pricing tier
    const tier = await pricingTierService.findById(validatedParams.tierId);

    if (!tier) {
      return createApiErrorResponse(404, 'Pricing tier not found');
    }

    // Verify tier belongs to the specified product
    if (tier.productId !== validatedParams.id) {
      return createApiErrorResponse(404, 'Pricing tier not found for this product');
    }

    // Verify product exists and is accessible
    const product = await productService.findById(validatedParams.id);
    if (!product) {
      return createApiErrorResponse(404, 'Product not found');
    }

    // Hide inactive products/tiers from public unless admin
    if ((!product.isActive || !tier.isActive) && !isAdmin) {
      return createApiErrorResponse(404, 'Pricing tier not found');
    }

    // Transform tier for response
    const responseTier = {
      id: tier.id,
      productId: tier.productId,
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
      // Include product context
      product: {
        id: product.id,
        name: product.name,
        type: product.type,
      },
    };

    // Set cache headers for public tier details
    const cacheHeaders = (product.isActive && tier.isActive) ? {
      'Cache-Control': 'public, s-maxage=600, stale-while-revalidate=1800', // 10 min cache, 30 min SWR
      'Vary': 'Accept, Accept-Encoding',
    } : {};

    return NextResponse.json({
      tier: responseTier,
    }, { 
      status: 200,
      headers: cacheHeaders,
    });

  } catch (_error) {
    // console.error('Error fetching pricing tier:', error);
    return createApiErrorResponse(500, 'Failed to fetch pricing tier details');
  }
}

/**
 * PUT /api/products/[id]/pricing-tiers/[tierId] - Update existing pricing tier (admin only)
 * 
 * Validates business rules and logs audit trail.
 * Supports partial updates with proper validation.
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; tierId: string }> }
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

    // Validate parameters
    let validatedParams;
    try {
      validatedParams = paramsSchema.parse(resolvedParams);
    } catch (_error) {
      if (_error instanceof z.ZodError) {
        return createApiErrorResponse(400, 'Invalid parameter format');
      }
      throw _error;
    }

    // Apply rate limiting for admin operations
    const rateLimitResult = await rateLimit(request, {
      windowMs: 15 * 60 * 1000, // 15 minutes
      maxRequests: 100, // 100 admin operations per window
      keyGenerator: () => `pricing_tier_update_${session.user.id}`,
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

    // Add the tier ID to the request data
    const updateData = { ...requestData, id: validatedParams.tierId };

    let validatedData;
    try {
      validatedData = updatePricingTierSchema.parse(updateData);
    } catch (_error) {
      if (_error instanceof z.ZodError) {
        return createApiErrorResponse(400, 'Invalid pricing tier data', _error.issues);
      }
      throw _error;
    }

    // Get original tier for audit comparison and validation
    const originalTier = await pricingTierService.findById(validatedParams.tierId);
    if (!originalTier) {
      return createApiErrorResponse(404, 'Pricing tier not found');
    }

    // Verify tier belongs to the specified product
    if (originalTier.productId !== validatedParams.id) {
      return createApiErrorResponse(404, 'Pricing tier not found for this product');
    }

    // Verify product exists
    const product = await productService.findById(validatedParams.id);
    if (!product) {
      return createApiErrorResponse(404, 'Product not found');
    }

    // Update the pricing tier
    const updatedTier = await pricingTierService.update(validatedData);

    // Calculate what changed for audit logging
    const changes: Record<string, { from: any; to: any }> = {};
    Object.keys(requestData).forEach(key => {
      const originalValue = (originalTier as any)[key];
      const newValue = (updatedTier as any)[key];
      if (originalValue !== newValue) {
        changes[key] = { from: originalValue, to: newValue };
      }
    });

    // Log the admin action for audit
    const auditContext = getAuditContext(request, session);
    await auditAction({
      action: 'UPDATE_PRICING_TIER',
      resource: 'PricingTier',
      resourceId: updatedTier.id,
      adminUserId: auditContext.adminUserId,
      adminRole: auditContext.adminRole,
      ipAddress: auditContext.ipAddress,
      userAgent: auditContext.userAgent,
      details: {
        productId: validatedParams.id,
        productName: product.name,
        tierName: updatedTier.name,
        changes,
        fieldsUpdated: Object.keys(changes),
      },
      severity: 'INFO',
    });

    return NextResponse.json({
      tier: updatedTier,
      message: 'Pricing tier updated successfully',
    }, { status: 200 });

  } catch (_error) {
    // console.error('Error updating pricing tier:', error);
    
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

    return createApiErrorResponse(500, 'Failed to update pricing tier');
  }
}

/**
 * DELETE /api/products/[id]/pricing-tiers/[tierId] - Delete pricing tier (admin only)
 * 
 * Performs hard delete after validation.
 * Validates that tier can be safely deleted.
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; tierId: string }> }
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

    // Validate parameters
    let validatedParams;
    try {
      validatedParams = paramsSchema.parse(resolvedParams);
    } catch (_error) {
      if (_error instanceof z.ZodError) {
        return createApiErrorResponse(400, 'Invalid parameter format');
      }
      throw _error;
    }

    // Apply rate limiting for admin operations
    const rateLimitResult = await rateLimit(request, {
      windowMs: 15 * 60 * 1000, // 15 minutes
      maxRequests: 50, // Stricter limit for delete operations
      keyGenerator: () => `pricing_tier_delete_${session.user.id}`,
    });

    if (!rateLimitResult.success) {
      return createApiErrorResponse(429, 'Too many admin requests. Please try again later.');
    }

    // Get the tier before deletion for audit purposes
    const tier = await pricingTierService.findById(validatedParams.tierId);
    if (!tier) {
      return createApiErrorResponse(404, 'Pricing tier not found');
    }

    // Verify tier belongs to the specified product
    if (tier.productId !== validatedParams.id) {
      return createApiErrorResponse(404, 'Pricing tier not found for this product');
    }

    // Verify product exists
    const product = await productService.findById(validatedParams.id);
    if (!product) {
      return createApiErrorResponse(404, 'Product not found');
    }

    // Check if this is the last active tier for the product
    const activeTiers = await productService.getPricingTiers(validatedParams.id);
    if (activeTiers.length === 1 && activeTiers[0].id === validatedParams.tierId) {
      return createApiErrorResponse(400, 'Cannot delete the last pricing tier for a product');
    }

    // Perform hard delete
    await pricingTierService.delete(validatedParams.tierId);

    // Log the admin action for audit
    const auditContext = getAuditContext(request, session);
    await auditAction({
      action: 'DELETE_PRICING_TIER',
      resource: 'PricingTier',
      resourceId: tier.id,
      adminUserId: auditContext.adminUserId,
      adminRole: auditContext.adminRole,
      ipAddress: auditContext.ipAddress,
      userAgent: auditContext.userAgent,
      details: {
        productId: validatedParams.id,
        productName: product.name,
        tierName: tier.name,
        price: tier.price.toString(),
        currency: tier.currency,
        isFreemium: tier.isFreemium,
        billingInterval: tier.billingInterval,
        features: tier.features,
        sortOrder: tier.sortOrder,
      },
      severity: 'WARNING', // Deletion is more critical
    });

    return NextResponse.json({
      message: 'Pricing tier deleted successfully',
      deletedTier: {
        id: tier.id,
        name: tier.name,
        productId: tier.productId,
      },
    }, { status: 200 });

  } catch (_error) {
    // console.error('Error deleting pricing tier:', error);
    
    // Handle specific business logic errors
    if (_error instanceof Error) {
      if (_error.message.includes('not found')) {
        return createApiErrorResponse(404, _error.message);
      }
      if (_error.message.includes('Cannot delete')) {
        return createApiErrorResponse(409, _error.message);
      }
      if (_error.message.includes('last pricing tier')) {
        return createApiErrorResponse(400, _error.message);
      }
    }

    return createApiErrorResponse(500, 'Failed to delete pricing tier');
  }
}

/**
 * OPTIONS /api/products/[id]/pricing-tiers/[tierId] - Handle CORS preflight requests
 */
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Max-Age': '86400',
    },
  });
}