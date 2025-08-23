/**
 * Product Stock Management API Route
 * 
 * Handles:
 * - PATCH: Update stock levels with atomic operations
 * - GET: Check current stock availability
 * 
 * Features:
 * - Admin-only access for stock modifications
 * - Atomic stock operations (set, increment, decrement)
 * - Validation for digital products (no stock management)
 * - Audit logging for inventory changes
 * - Real-time stock availability checking
 * - Business rule validation (negative stock prevention)
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { ProductService } from '@/services/products/product.service';
import { db } from '@/lib/db';
import { validateApiAccess, createApiErrorResponse, getAuditContext } from '@/lib/auth/server-session';
import { updateStockSchema } from '@/lib/validations/base/product';
import { cuidSchema } from '@/lib/validations/base/common';
import { rateLimit, auditAction } from '@/lib/api-helpers';

const productService = new ProductService(db);

// Parameter validation schema
const paramsSchema = z.object({
  id: cuidSchema,
});

// Stock update request schema
const stockUpdateRequestSchema = z.object({
  quantity: z.number().int('Quantity must be an integer'),
  operation: z.enum(['set', 'increment', 'decrement'], {
    errorMap: () => ({ message: 'Operation must be set, increment, or decrement' }),
  }),
  reason: z.string().max(255, 'Reason must not exceed 255 characters').optional(),
});

/**
 * GET /api/products/[id]/stock - Get current stock information
 * 
 * Public endpoint for checking stock availability.
 * Returns detailed stock info for admin users.
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

    // Apply rate limiting for public endpoints
    const rateLimitResult = await rateLimit(request, {
      windowMs: 15 * 60 * 1000, // 15 minutes
      maxRequests: 200, // Stock checks are frequent
      keyGenerator: (req) => {
        const forwarded = req.headers.get('x-forwarded-for');
        const ip = forwarded ? forwarded.split(',')[0] : 'unknown';
        return `stock_check_${ip}`;
      },
    });

    if (!rateLimitResult.success) {
      return createApiErrorResponse(429, 'Too many requests. Please try again later.');
    }

    // Check if user is admin for detailed stock info
    const { session } = await validateApiAccess(request);
    const isAdmin = session?.user?.role === 'ADMIN';

    // Fetch the product
    const product = await productService.findById(validatedParams.id);

    if (!product) {
      return createApiErrorResponse(404, 'Product not found');
    }

    // Hide inactive products from public
    if (!product.isActive && !isAdmin) {
      return createApiErrorResponse(404, 'Product not found');
    }

    // Build response based on user role
    if (isAdmin) {
      // Detailed stock information for admin
      const response = {
        productId: product.id,
        productName: product.name,
        isDigital: product.isDigital,
        stockQuantity: product.stockQuantity,
        lowStockThreshold: product.lowStockThreshold,
        requiresShipping: product.requiresShipping,
        isLowStock: !product.isDigital && product.lowStockThreshold 
          ? (product.stockQuantity || 0) <= product.lowStockThreshold
          : false,
        inStock: product.isDigital || (product.stockQuantity || 0) > 0,
        availableForPurchase: await productService.canPurchase(product.id),
      };

      return NextResponse.json(response, { status: 200 });
    } else {
      // Limited stock information for public
      const response = {
        productId: product.id,
        inStock: product.isDigital || (product.stockQuantity || 0) > 0,
        isDigital: product.isDigital,
        availableForPurchase: (await productService.canPurchase(product.id)).canPurchase,
      };

      // Cache stock status briefly for public requests
      return NextResponse.json(response, { 
        status: 200,
        headers: {
          'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120', // 1 min cache, 2 min SWR
          'Vary': 'Accept, Accept-Encoding',
        },
      });
    }

  } catch (_error) {
    // console.error('Error fetching stock information:', error);
    return createApiErrorResponse(500, 'Failed to fetch stock information');
  }
}

/**
 * PATCH /api/products/[id]/stock - Update stock levels (admin only)
 * 
 * Supports atomic operations: set, increment, decrement
 * Validates business rules and logs inventory changes.
 */
export async function PATCH(
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
      maxRequests: 200, // Stock updates can be frequent
      keyGenerator: () => `stock_update_${session.user.id}`,
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

    let validatedRequest;
    try {
      validatedRequest = stockUpdateRequestSchema.parse(requestData);
    } catch (_error) {
      if (_error instanceof z.ZodError) {
        return createApiErrorResponse(400, 'Invalid stock update data', _error.issues);
      }
      throw _error;
    }

    // Get the product before update for audit purposes
    const product = await productService.findById(validatedParams.id);
    if (!product) {
      return createApiErrorResponse(404, 'Product not found');
    }

    // Prepare stock update data
    const stockUpdateData = updateStockSchema.parse({
      productId: validatedParams.id,
      quantity: validatedRequest.quantity,
      operation: validatedRequest.operation,
      reason: validatedRequest.reason,
    });

    // Get original stock level for audit comparison
    const originalStock = product.stockQuantity || 0;

    // Update the stock
    const updatedProduct = await productService.updateStock(stockUpdateData);

    // Calculate the actual change
    const newStock = updatedProduct.stockQuantity || 0;
    const stockChange = newStock - originalStock;

    // Log the admin action for audit
    const auditContext = getAuditContext(request, session);
    await auditAction({
      action: 'UPDATE_STOCK',
      resource: 'Product',
      resourceId: updatedProduct.id,
      adminUserId: auditContext.adminUserId,
      adminRole: auditContext.adminRole,
      ipAddress: auditContext.ipAddress,
      userAgent: auditContext.userAgent,
      details: {
        productName: product.name,
        productSku: product.sku,
        operation: validatedRequest.operation,
        quantity: validatedRequest.quantity,
        stockChange,
        previousStock: originalStock,
        newStock,
        reason: validatedRequest.reason,
      },
      severity: 'INFO',
    });

    // Build response with updated stock information
    const response = {
      message: 'Stock updated successfully',
      stock: {
        productId: updatedProduct.id,
        productName: updatedProduct.name,
        previousStock: originalStock,
        newStock,
        stockChange,
        operation: validatedRequest.operation,
        quantity: validatedRequest.quantity,
        isLowStock: updatedProduct.lowStockThreshold 
          ? newStock <= updatedProduct.lowStockThreshold
          : false,
        inStock: newStock > 0,
        timestamp: new Date().toISOString(),
      },
    };

    return NextResponse.json(response, { status: 200 });

  } catch (_error) {
    // console.error('Error updating stock:', error);
    
    // Handle specific business logic errors
    if (_error instanceof Error) {
      if (_error.message.includes('not found')) {
        return createApiErrorResponse(404, _error.message);
      }
      if (_error.message.includes('digital products')) {
        return createApiErrorResponse(400, 'Cannot manage stock for digital products');
      }
      if (_error.message.includes('negative')) {
        return createApiErrorResponse(400, 'Stock quantity cannot be negative');
      }
      if (_error.message.includes('Invalid stock operation')) {
        return createApiErrorResponse(400, _error.message);
      }
    }

    return createApiErrorResponse(500, 'Failed to update stock');
  }
}

/**
 * POST /api/products/[id]/stock - Check stock availability for purchase
 * 
 * Validates if a specific quantity is available for purchase.
 * Useful for cart validation and checkout processes.
 */
export async function POST(
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

    // Apply rate limiting for availability checks
    const rateLimitResult = await rateLimit(request, {
      windowMs: 15 * 60 * 1000, // 15 minutes
      maxRequests: 500, // High limit for cart/checkout validation
      keyGenerator: (req) => {
        const forwarded = req.headers.get('x-forwarded-for');
        const ip = forwarded ? forwarded.split(',')[0] : 'unknown';
        return `stock_availability_${ip}`;
      },
    });

    if (!rateLimitResult.success) {
      return createApiErrorResponse(429, 'Too many requests. Please try again later.');
    }

    // Parse request body for quantity check
    let requestData;
    try {
      requestData = await request.json();
    } catch {
      return createApiErrorResponse(400, 'Invalid JSON in request body');
    }

    const quantitySchema = z.object({
      quantity: z.number().int().min(1, 'Quantity must be at least 1'),
    });

    let validatedRequest;
    try {
      validatedRequest = quantitySchema.parse(requestData);
    } catch (_error) {
      if (_error instanceof z.ZodError) {
        return createApiErrorResponse(400, 'Invalid quantity', _error.issues);
      }
      throw _error;
    }

    // Check stock availability
    const isAvailable = await productService.checkStockAvailability(
      validatedParams.id, 
      validatedRequest.quantity
    );

    // Get purchase validation
    const canPurchase = await productService.canPurchase(
      validatedParams.id, 
      validatedRequest.quantity
    );

    const response = {
      productId: validatedParams.id,
      requestedQuantity: validatedRequest.quantity,
      available: isAvailable,
      canPurchase: canPurchase.canPurchase,
      reason: canPurchase.reason,
      timestamp: new Date().toISOString(),
    };

    return NextResponse.json(response, { 
      status: 200,
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate', // Don't cache availability checks
      },
    });

  } catch (_error) {
    // console.error('Error checking stock availability:', error);
    
    if (_error instanceof Error && _error.message.includes('not found')) {
      return createApiErrorResponse(404, 'Product not found');
    }

    return createApiErrorResponse(500, 'Failed to check stock availability');
  }
}

/**
 * OPTIONS /api/products/[id]/stock - Handle CORS preflight requests
 */
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, PATCH, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Max-Age': '86400',
    },
  });
}