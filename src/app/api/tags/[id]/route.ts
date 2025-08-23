/**
 * Individual Tag API Routes - CRUD operations for specific tags
 * 
 * Handles:
 * - GET: Retrieve specific tag with optional product details
 * - PUT: Update tag (admin only)
 * - DELETE: Delete tag (admin only)
 * 
 * Features:
 * - Role-based access control (public read, admin write/delete)
 * - Input validation with Zod schemas
 * - Cascade handling for tag deletion
 * - Audit logging for admin actions
 * - Response caching for public endpoints
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { validateApiAccess, createApiErrorResponse, getAuditContext } from '@/lib/auth/server-session';
import { updateTagSchema } from '@/lib/validations/base/tag';
import { cuidSchema } from '@/lib/validations/base/common';
import { rateLimit, auditAction } from '@/lib/api-helpers';

// Route parameter validation
const routeParamsSchema = z.object({
  id: cuidSchema,
});

// Query parameters for GET request
const getTagQuerySchema = z.object({
  includeProducts: z.string().optional().transform(val => val === 'true'),
  productsLimit: z.coerce.number().min(1).max(50).default(10),
});

/**
 * GET /api/tags/[id] - Retrieve a specific tag
 * 
 * Query Parameters:
 * - includeProducts: Include associated products (default: false)
 * - productsLimit: Limit number of products to return (default: 10, max: 50)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Validate route parameters
    const { id } = routeParamsSchema.parse(params);

    // Parse query parameters
    const url = new URL(request.url);
    const queryParams = Object.fromEntries(url.searchParams.entries());
    const query = getTagQuerySchema.parse(queryParams);

    // Apply rate limiting for public endpoints
    const rateLimitResult = await rateLimit(request, {
      windowMs: 15 * 60 * 1000, // 15 minutes
      maxRequests: 100, // 100 requests per window
      keyGenerator: (req) => {
        const forwarded = req.headers.get('x-forwarded-for');
        const ip = forwarded ? forwarded.split(',')[0] : 'unknown';
        return `tag_get_${ip}`;
      },
    });

    if (!rateLimitResult.success) {
      return createApiErrorResponse(429, 'Too many requests. Please try again later.');
    }

    // Fetch tag with optional products
    const tag = await db.tag.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            products: true,
          },
        },
        ...(query.includeProducts ? {
          products: {
            take: query.productsLimit,
            include: {
              product: {
                select: {
                  id: true,
                  name: true,
                  slug: true,
                  price: true,
                  currency: true,
                  thumbnail: true,
                  isActive: true,
                  type: true,
                  createdAt: true,
                },
              },
            },
          },
        } : {}),
      },
    });

    if (!tag) {
      return createApiErrorResponse(404, 'Tag not found');
    }

    // Transform response for public API
    const response = {
      id: tag.id,
      name: tag.name,
      slug: tag.slug,
      color: tag.color,
      productCount: tag._count.products,
      createdAt: tag.createdAt,
      updatedAt: tag.updatedAt,
      ...(query.includeProducts && 'products' in tag ? {
        products: tag.products.map((pt: any) => pt.product),
      } : {}),
    };

    // Set cache headers
    const cacheHeaders = {
      'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
      'Vary': 'Accept, Accept-Encoding',
    };

    return NextResponse.json(response, {
      status: 200,
      headers: cacheHeaders,
    });

  } catch (_error) {
    // console.error('Error fetching tag:', error);
    
    if (_error instanceof z.ZodError) {
      return createApiErrorResponse(400, 'Invalid request parameters', _error.issues);
    }

    return createApiErrorResponse(500, 'Failed to fetch tag');
  }
}

/**
 * PUT /api/tags/[id] - Update a tag (admin only)
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Validate route parameters
    const { id } = routeParamsSchema.parse(params);

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
      maxRequests: 50, // 50 admin operations per window
      keyGenerator: () => `tag_update_${session.user.id}`,
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

    // Add ID to validation data
    requestData.id = id;

    let validatedData;
    try {
      validatedData = updateTagSchema.parse(requestData);
    } catch (_error) {
      if (_error instanceof z.ZodError) {
        return createApiErrorResponse(400, 'Invalid tag data', _error.issues);
      }
      throw _error;
    }

    // Check if tag exists
    const existingTag = await db.tag.findUnique({
      where: { id },
    });

    if (!existingTag) {
      return createApiErrorResponse(404, 'Tag not found');
    }

    // Check for duplicate name/slug (excluding current tag)
    if (validatedData.name || validatedData.slug) {
      const duplicateTag = await db.tag.findFirst({
        where: {
          AND: [
            { id: { not: id } },
            {
              OR: [
                ...(validatedData.name ? [{ name: { equals: validatedData.name, mode: 'insensitive' } }] : []),
                ...(validatedData.slug ? [{ slug: validatedData.slug }] : []),
              ],
            },
          ],
        },
      });

      if (duplicateTag) {
        if (duplicateTag.name.toLowerCase() === validatedData.name?.toLowerCase()) {
          return createApiErrorResponse(409, 'A tag with this name already exists');
        }
        if (duplicateTag.slug === validatedData.slug) {
          return createApiErrorResponse(409, 'A tag with this slug already exists');
        }
      }
    }

    // Update the tag
    const updatedTag = await db.tag.update({
      where: { id },
      data: {
        ...(validatedData.name && { name: validatedData.name }),
        ...(validatedData.slug && { slug: validatedData.slug }),
        ...(validatedData.color !== undefined && { color: validatedData.color }),
      },
    });

    // Log the admin action for audit
    const auditContext = getAuditContext(request, session);
    await auditAction({
      action: 'UPDATE_TAG',
      resource: 'Tag',
      resourceId: updatedTag.id,
      adminUserId: auditContext.adminUserId,
      adminRole: auditContext.adminRole,
      ipAddress: auditContext.ipAddress,
      userAgent: auditContext.userAgent,
      details: {
        tagName: updatedTag.name,
        tagSlug: updatedTag.slug,
        tagColor: updatedTag.color,
        changes: Object.keys(validatedData).filter(key => key !== 'id'),
      },
      severity: 'INFO',
    });

    return NextResponse.json({
      tag: updatedTag,
      message: 'Tag updated successfully',
    });

  } catch (_error) {
    // console.error('Error updating tag:', error);
    
    if (_error instanceof z.ZodError) {
      return createApiErrorResponse(400, 'Invalid request parameters', _error.issues);
    }

    return createApiErrorResponse(500, 'Failed to update tag');
  }
}

/**
 * DELETE /api/tags/[id] - Delete a tag (admin only)
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Validate route parameters
    const { id } = routeParamsSchema.parse(params);

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
      maxRequests: 25, // 25 delete operations per window
      keyGenerator: () => `tag_delete_${session.user.id}`,
    });

    if (!rateLimitResult.success) {
      return createApiErrorResponse(429, 'Too many admin requests. Please try again later.');
    }

    // Check if tag exists
    const existingTag = await db.tag.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            products: true,
          },
        },
      },
    });

    if (!existingTag) {
      return createApiErrorResponse(404, 'Tag not found');
    }

    // Check for query parameter to force delete
    const url = new URL(request.url);
    const forceDelete = url.searchParams.get('force') === 'true';

    if (existingTag._count.products > 0 && !forceDelete) {
      return createApiErrorResponse(
        400, 
        `Tag has ${existingTag._count.products} associated products. Use ?force=true to delete anyway.`
      );
    }

    // Delete the tag (cascade will remove relationships)
    await db.tag.delete({
      where: { id },
    });

    // Log the admin action for audit
    const auditContext = getAuditContext(request, session);
    await auditAction({
      action: 'DELETE_TAG',
      resource: 'Tag',
      resourceId: id,
      adminUserId: auditContext.adminUserId,
      adminRole: auditContext.adminRole,
      ipAddress: auditContext.ipAddress,
      userAgent: auditContext.userAgent,
      details: {
        tagName: existingTag.name,
        tagSlug: existingTag.slug,
        tagColor: existingTag.color,
        productCount: existingTag._count.products,
        forceDelete,
      },
      severity: 'WARN',
    });

    return NextResponse.json({
      message: 'Tag deleted successfully',
      deletedTag: {
        id: existingTag.id,
        name: existingTag.name,
        productCount: existingTag._count.products,
      },
    });

  } catch (_error) {
    // console.error('Error deleting tag:', error);
    
    if (_error instanceof z.ZodError) {
      return createApiErrorResponse(400, 'Invalid request parameters', _error.issues);
    }

    return createApiErrorResponse(500, 'Failed to delete tag');
  }
}