/**
 * Product Bulk Status Management API - Manage product status in bulk
 * 
 * Handles:
 * - PUT: Bulk update product status
 * 
 * Features:
 * - Role-based access control (admin only)
 * - Bulk operations on multiple products
 * - Status transitions with validation
 * - Audit logging for admin actions
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { ProductService } from '@/services/products/product.service';
import { db } from '@/lib/db';
import { validateApiAccess, createApiErrorResponse, getAuditContext } from '@/lib/auth/server-session';
import { bulkProductStatusUpdateSchema } from '@/lib/validations/base/product';
import { rateLimit, auditAction } from '@/lib/api-helpers';

const productService = new ProductService(db);

/**
 * PUT /api/products/bulk-status - Bulk update product status (admin only)
 */
export async function PUT(request: NextRequest) {
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
      maxRequests: 20, // 20 bulk operations per window
      keyGenerator: () => `product_bulk_status_${session.user.id}`,
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
      validatedData = bulkProductStatusUpdateSchema.parse(requestData);
    } catch (_error) {
      if (_error instanceof z.ZodError) {
        return createApiErrorResponse(400, 'Invalid bulk update data', _error.issues);
      }
      throw _error;
    }

    // Validate that products exist before bulk update
    const products = await Promise.all(
      validatedData.productIds.map(id => productService.findById(id))
    );

    const missingProducts = validatedData.productIds.filter((id, index) => !products[index]);
    if (missingProducts.length > 0) {
      return createApiErrorResponse(404, `Products not found: ${missingProducts.join(', ')}`);
    }

    // Perform bulk update
    const result = await productService.bulkUpdateProductStatus(validatedData);

    // Log the admin action for audit
    const auditContext = getAuditContext(request, session);
    await auditAction({
      action: 'BULK_UPDATE_PRODUCT_STATUS',
      resource: 'Product',
      resourceId: validatedData.productIds.join(','),
      adminUserId: auditContext.adminUserId,
      adminRole: auditContext.adminRole,
      ipAddress: auditContext.ipAddress,
      userAgent: auditContext.userAgent,
      details: {
        productCount: validatedData.productIds.length,
        productIds: validatedData.productIds,
        newStatus: validatedData.status,
        isPublished: validatedData.isPublished,
        availableFrom: validatedData.availableFrom,
        availableTo: validatedData.availableTo,
      },
      severity: 'INFO',
    });

    return NextResponse.json({
      result: {
        updatedCount: result.count,
        requestedCount: validatedData.productIds.length,
        success: result.count === validatedData.productIds.length,
      },
      operation: {
        status: validatedData.status,
        isPublished: validatedData.isPublished,
        availableFrom: validatedData.availableFrom,
        availableTo: validatedData.availableTo,
      },
      message: `Successfully updated ${result.count} of ${validatedData.productIds.length} products`,
    }, { status: 200 });

  } catch (_error) {
    // console.error('Error bulk updating product status:', error);
    
    // Handle specific business logic errors
    if (_error instanceof Error) {
      if (_error.message.includes('At least one product')) {
        return createApiErrorResponse(400, _error.message);
      }
      if (_error.message.includes('validation')) {
        return createApiErrorResponse(400, _error.message);
      }
    }

    return createApiErrorResponse(500, 'Failed to bulk update product status');
  }
}

/**
 * OPTIONS /api/products/bulk-status - Handle CORS preflight requests
 */
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'PUT, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Max-Age': '86400',
    },
  });
}