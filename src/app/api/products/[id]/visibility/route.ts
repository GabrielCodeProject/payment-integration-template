/**
 * Product Visibility Management API - Manage product visibility and availability controls
 * 
 * Handles:
 * - GET: Get product visibility settings
 * - PUT: Update product visibility settings
 * - POST: Check product visibility for a user
 * 
 * Features:
 * - Role-based access control (admin only for updates)
 * - Input validation with Zod schemas
 * - Date-based availability control
 * - Geographic restrictions and role-based access
 * - User capacity management
 * - Audit logging for admin actions
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { ProductService } from '@/services/products/product.service';
import { db } from '@/lib/db';
import { validateApiAccess, createApiErrorResponse, getAuditContext } from '@/lib/auth/server-session';
import { 
  updateProductVisibilitySchema,
  productVisibilityValidationSchema,
} from '@/lib/validations/base/product';
import { rateLimit, auditAction } from '@/lib/api-helpers';

const productService = new ProductService(db);

// Parameters validation schema
const paramsSchema = z.object({
  id: z.string().cuid('Invalid product ID'),
});

/**
 * GET /api/products/[id]/visibility - Get product visibility settings (admin only)
 */
export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    // Validate admin authentication
    const { isValid, session, error } = await validateApiAccess(request, 'ADMIN');
    
    if (!isValid || !session) {
      return createApiErrorResponse(
        error?.code || 401,
        error?.message || 'Admin authentication required'
      );
    }

    // Validate parameters
    let validatedParams;
    try {
      validatedParams = paramsSchema.parse(params);
    } catch (_error) {
      if (_error instanceof z.ZodError) {
        return createApiErrorResponse(400, 'Invalid product ID', _error.issues);
      }
      throw _error;
    }

    // Get product with visibility settings
    const product = await productService.findById(validatedParams.id);
    if (!product) {
      return createApiErrorResponse(404, 'Product not found');
    }

    // Return visibility settings
    const visibilitySettings = {
      id: product.id,
      status: product.status,
      isPublished: product.isPublished,
      publishedAt: product.publishedAt,
      availableFrom: product.availableFrom,
      availableTo: product.availableTo,
      restrictedRegions: product.restrictedRegions,
      allowedUserRoles: product.allowedUserRoles,
      maxUsers: product.maxUsers,
      currentUsers: product.currentUsers,
      isLimited: product.isLimited,
    };

    return NextResponse.json({
      visibility: visibilitySettings,
      message: 'Product visibility settings retrieved successfully',
    }, { status: 200 });

  } catch (_error) {
    // console.error('Error fetching product visibility settings:', error);
    return createApiErrorResponse(500, 'Failed to fetch product visibility settings');
  }
}

/**
 * PUT /api/products/[id]/visibility - Update product visibility settings (admin only)
 */
export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    // Validate admin authentication
    const { isValid, session, error } = await validateApiAccess(request, 'ADMIN');
    
    if (!isValid || !session) {
      return createApiErrorResponse(
        error?.code || 401,
        error?.message || 'Admin authentication required'
      );
    }

    // Apply rate limiting for admin operations
    const rateLimitResult = await rateLimit(request, {
      windowMs: 15 * 60 * 1000, // 15 minutes  
      maxRequests: 100, // 100 admin operations per window
      keyGenerator: () => `product_visibility_update_${session.user.id}`,
    });

    if (!rateLimitResult.success) {
      return createApiErrorResponse(429, 'Too many admin requests. Please try again later.');
    }

    // Validate parameters
    let validatedParams;
    try {
      validatedParams = paramsSchema.parse(params);
    } catch (_error) {
      if (_error instanceof z.ZodError) {
        return createApiErrorResponse(400, 'Invalid product ID', _error.issues);
      }
      throw _error;
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
      validatedData = updateProductVisibilitySchema.parse({
        productId: validatedParams.id,
        ...requestData,
      });
    } catch (_error) {
      if (_error instanceof z.ZodError) {
        return createApiErrorResponse(400, 'Invalid visibility data', _error.issues);
      }
      throw _error;
    }

    // Update product visibility
    const updatedProduct = await productService.updateProductVisibility(validatedData);

    // Log the admin action for audit
    const auditContext = getAuditContext(request, session);
    await auditAction({
      action: 'UPDATE_PRODUCT_VISIBILITY',
      resource: 'Product',
      resourceId: updatedProduct.id,
      adminUserId: auditContext.adminUserId,
      adminRole: auditContext.adminRole,
      ipAddress: auditContext.ipAddress,
      userAgent: auditContext.userAgent,
      details: {
        productName: updatedProduct.name,
        status: updatedProduct.status,
        isPublished: updatedProduct.isPublished,
        availableFrom: updatedProduct.availableFrom,
        availableTo: updatedProduct.availableTo,
        isLimited: updatedProduct.isLimited,
        maxUsers: updatedProduct.maxUsers,
      },
      severity: 'INFO',
    });

    return NextResponse.json({
      product: {
        id: updatedProduct.id,
        status: updatedProduct.status,
        isPublished: updatedProduct.isPublished,
        publishedAt: updatedProduct.publishedAt,
        availableFrom: updatedProduct.availableFrom,
        availableTo: updatedProduct.availableTo,
      },
      message: 'Product visibility updated successfully',
    }, { status: 200 });

  } catch (_error) {
    // console.error('Error updating product visibility:', error);
    
    // Handle specific business logic errors
    if (_error instanceof Error) {
      if (_error.message.includes('not found')) {
        return createApiErrorResponse(404, _error.message);
      }
      if (_error.message.includes('validation')) {
        return createApiErrorResponse(400, _error.message);
      }
    }

    return createApiErrorResponse(500, 'Failed to update product visibility');
  }
}

/**
 * POST /api/products/[id]/visibility - Check product visibility for a user
 */
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    // Apply rate limiting for visibility checks
    const rateLimitResult = await rateLimit(request, {
      windowMs: 15 * 60 * 1000, // 15 minutes
      maxRequests: 1000, // 1000 visibility checks per window
      keyGenerator: (req) => {
        const forwarded = req.headers.get('x-forwarded-for');
        const ip = forwarded ? forwarded.split(',')[0] : 'unknown';
        return `product_visibility_check_${ip}`;
      },
    });

    if (!rateLimitResult.success) {
      return createApiErrorResponse(429, 'Too many requests. Please try again later.');
    }

    // Validate parameters
    let validatedParams;
    try {
      validatedParams = paramsSchema.parse(params);
    } catch (_error) {
      if (_error instanceof z.ZodError) {
        return createApiErrorResponse(400, 'Invalid product ID', _error.issues);
      }
      throw _error;
    }

    // Parse and validate request body
    let requestData;
    try {
      requestData = await request.json();
    } catch {
      return createApiErrorResponse(400, 'Invalid JSON in request body');
    }

    // Add required fields with defaults
    const visibilityCheckData = {
      productId: validatedParams.id,
      userRole: requestData.userRole || 'CUSTOMER',
      userRegion: requestData.userRegion,
      currentDateTime: requestData.currentDateTime ? new Date(requestData.currentDateTime) : new Date(),
    };

    let validatedData;
    try {
      validatedData = productVisibilityValidationSchema.parse(visibilityCheckData);
    } catch (_error) {
      if (_error instanceof z.ZodError) {
        return createApiErrorResponse(400, 'Invalid visibility check data', _error.issues);
      }
      throw _error;
    }

    // Check product visibility
    const visibilityResult = await productService.checkProductVisibility(validatedData);

    return NextResponse.json({
      productId: validatedParams.id,
      visibility: visibilityResult,
      checkedAt: new Date().toISOString(),
    }, { status: 200 });

  } catch (_error) {
    // console.error('Error checking product visibility:', error);
    
    // Handle specific business logic errors
    if (_error instanceof Error) {
      if (_error.message.includes('not found')) {
        return createApiErrorResponse(404, _error.message);
      }
    }

    return createApiErrorResponse(500, 'Failed to check product visibility');
  }
}

/**
 * OPTIONS /api/products/[id]/visibility - Handle CORS preflight requests
 */
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, PUT, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Max-Age': '86400',
    },
  });
}