/**
 * Product API Routes - Individual product operations
 * 
 * Handles:
 * - GET: Get single product by ID
 * - PUT: Update existing product (admin only)  
 * - DELETE: Soft delete product (admin only)
 * 
 * Features:
 * - Role-based access control (public read, admin write)
 * - Input validation with Zod schemas
 * - Business rule validation (SKU uniqueness, etc.)
 * - Audit logging for admin operations
 * - Response caching for public product details
 * - Comprehensive error handling
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { ProductService } from '@/services/products/product.service';
import { db } from '@/lib/db';
import { validateApiAccess, createApiErrorResponse, getAuditContext } from '@/lib/auth/server-session';
import { updateProductSchema } from '@/lib/validations/base/product';
import { cuidSchema } from '@/lib/validations/base/common';
import { rateLimit, auditAction } from '@/lib/api-helpers';

const productService = new ProductService(db);

// Parameter validation schema
const paramsSchema = z.object({
  id: cuidSchema,
});

/**
 * GET /api/products/[id] - Get single product details
 * 
 * Public endpoint with caching for active products.
 * Returns 404 for inactive products unless accessed by admin.
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
    } catch (error) {
      if (error instanceof z.ZodError) {
        return createApiErrorResponse(400, 'Invalid product ID format');
      }
      throw error;
    }

    // Apply rate limiting for public endpoints
    const rateLimitResult = await rateLimit(request, {
      windowMs: 15 * 60 * 1000, // 15 minutes
      maxRequests: 300, // Higher limit for individual product views
      keyGenerator: (req) => {
        const forwarded = req.headers.get('x-forwarded-for');
        const ip = forwarded ? forwarded.split(',')[0] : 'unknown';
        return `product_detail_${ip}`;
      },
    });

    if (!rateLimitResult.success) {
      return createApiErrorResponse(429, 'Too many requests. Please try again later.');
    }

    // Check if user is admin for access to inactive products
    const { session } = await validateApiAccess(request);
    const isAdmin = session?.user?.role === 'ADMIN';

    // Fetch the product
    const product = await productService.findById(validatedParams.id);

    if (!product) {
      return createApiErrorResponse(404, 'Product not found');
    }

    // Hide inactive products from public unless admin
    if (!product.isActive && !isAdmin) {
      return createApiErrorResponse(404, 'Product not found');
    }

    // Transform product for public API response
    const responseProduct = {
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
        stripePriceId: product.stripePriceId,
        stripeProductId: product.stripeProductId,
      }),
      // Calculate derived fields
      inStock: product.isDigital || (product.stockQuantity || 0) > 0,
      isOnSale: !!product.compareAtPrice,
      discountPercentage: product.compareAtPrice 
        ? Math.round((1 - Number(product.price) / Number(product.compareAtPrice)) * 100)
        : undefined,
      createdAt: product.createdAt,
      updatedAt: product.updatedAt,
    };

    // Get related products for public users
    let relatedProducts = [];
    if (!isAdmin) {
      const related = await productService.getRelatedProducts(product.id, 4);
      relatedProducts = related.map(p => ({
        id: p.id,
        name: p.name,
        shortDescription: p.shortDescription,
        price: p.price,
        currency: p.currency,
        compareAtPrice: p.compareAtPrice,
        slug: p.slug,
        thumbnail: p.thumbnail,
        type: p.type,
        isOnSale: !!p.compareAtPrice,
        inStock: p.isDigital || (p.stockQuantity || 0) > 0,
      }));
    }

    const response = {
      product: responseProduct,
      ...(relatedProducts.length > 0 && { relatedProducts }),
    };

    // Set cache headers for public product details
    const cacheHeaders = product.isActive ? {
      'Cache-Control': 'public, s-maxage=600, stale-while-revalidate=1800', // 10 min cache, 30 min SWR
      'Vary': 'Accept, Accept-Encoding',
    } : {};

    return NextResponse.json(response, { 
      status: 200,
      headers: cacheHeaders,
    });

  } catch (error) {
    console.error('Error fetching product:', error);
    return createApiErrorResponse(500, 'Failed to fetch product details');
  }
}

/**
 * PUT /api/products/[id] - Update existing product (admin only)
 * 
 * Validates business rules and logs audit trail.
 * Supports partial updates with proper validation.
 */
export async function PUT(
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
    } catch (error) {
      if (error instanceof z.ZodError) {
        return createApiErrorResponse(400, 'Invalid product ID format');
      }
      throw error;
    }

    // Apply rate limiting for admin operations
    const rateLimitResult = await rateLimit(request, {
      windowMs: 15 * 60 * 1000, // 15 minutes
      maxRequests: 100, // 100 admin operations per window
      keyGenerator: () => `product_update_${session.user.id}`,
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

    // Add the product ID to the request data
    const updateData = { ...requestData, id: validatedParams.id };

    let validatedData;
    try {
      validatedData = updateProductSchema.parse(updateData);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return createApiErrorResponse(400, 'Invalid product data', error.issues);
      }
      throw error;
    }

    // Get original product for audit comparison
    const originalProduct = await productService.findById(validatedParams.id);
    if (!originalProduct) {
      return createApiErrorResponse(404, 'Product not found');
    }

    // Update the product
    const updatedProduct = await productService.update(validatedData);

    // Calculate what changed for audit logging
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const changes: Record<string, { from: any; to: any }> = {};
    Object.keys(requestData).forEach(key => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const originalValue = (originalProduct as any)[key];
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const newValue = (updatedProduct as any)[key];
      if (originalValue !== newValue) {
        changes[key] = { from: originalValue, to: newValue };
      }
    });

    // Log the admin action for audit
    const auditContext = getAuditContext(request, session);
    await auditAction({
      action: 'UPDATE_PRODUCT',
      resource: 'Product',
      resourceId: updatedProduct.id,
      adminUserId: auditContext.adminUserId,
      adminRole: auditContext.adminRole,
      ipAddress: auditContext.ipAddress,
      userAgent: auditContext.userAgent,
      details: {
        productName: updatedProduct.name,
        changes,
        fieldsUpdated: Object.keys(changes),
      },
      severity: 'INFO',
    });

    return NextResponse.json({
      product: updatedProduct,
      message: 'Product updated successfully',
    }, { status: 200 });

  } catch (error) {
    console.error('Error updating product:', error);
    
    // Handle specific business logic errors
    if (error instanceof Error) {
      if (error.message.includes('already exists')) {
        return createApiErrorResponse(409, error.message);
      }
      if (error.message.includes('not found')) {
        return createApiErrorResponse(404, error.message);
      }
      if (error.message.includes('validation')) {
        return createApiErrorResponse(400, error.message);
      }
    }

    return createApiErrorResponse(500, 'Failed to update product');
  }
}

/**
 * DELETE /api/products/[id] - Soft delete product (admin only)
 * 
 * Performs soft delete by setting isActive to false.
 * Validates that product can be safely deleted.
 */
export async function DELETE(
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
    } catch (error) {
      if (error instanceof z.ZodError) {
        return createApiErrorResponse(400, 'Invalid product ID format');
      }
      throw error;
    }

    // Apply rate limiting for admin operations
    const rateLimitResult = await rateLimit(request, {
      windowMs: 15 * 60 * 1000, // 15 minutes
      maxRequests: 50, // Stricter limit for delete operations
      keyGenerator: () => `product_delete_${session.user.id}`,
    });

    if (!rateLimitResult.success) {
      return createApiErrorResponse(429, 'Too many admin requests. Please try again later.');
    }

    // Get the product before deletion for audit purposes
    const product = await productService.findById(validatedParams.id);
    if (!product) {
      return createApiErrorResponse(404, 'Product not found');
    }

    // Check if product is already inactive
    if (!product.isActive) {
      return createApiErrorResponse(400, 'Product is already deactivated');
    }

    // Perform soft delete
    const deletedProduct = await productService.softDelete(validatedParams.id);

    // Log the admin action for audit
    const auditContext = getAuditContext(request, session);
    await auditAction({
      action: 'SOFT_DELETE_PRODUCT',
      resource: 'Product',
      resourceId: deletedProduct.id,
      adminUserId: auditContext.adminUserId,
      adminRole: auditContext.adminRole,
      ipAddress: auditContext.ipAddress,
      userAgent: auditContext.userAgent,
      details: {
        productName: product.name,
        productSku: product.sku,
        productType: product.type,
        previouslyActive: product.isActive,
      },
      severity: 'WARNING', // Deletion is more critical
    });

    return NextResponse.json({
      message: 'Product deactivated successfully',
      product: {
        id: deletedProduct.id,
        name: deletedProduct.name,
        isActive: deletedProduct.isActive,
      },
    }, { status: 200 });

  } catch (error) {
    console.error('Error deleting product:', error);
    
    // Handle specific business logic errors
    if (error instanceof Error) {
      if (error.message.includes('not found')) {
        return createApiErrorResponse(404, error.message);
      }
      if (error.message.includes('Cannot delete')) {
        return createApiErrorResponse(409, error.message);
      }
    }

    return createApiErrorResponse(500, 'Failed to delete product');
  }
}

/**
 * OPTIONS /api/products/[id] - Handle CORS preflight requests
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