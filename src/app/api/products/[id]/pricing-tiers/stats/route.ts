/**
 * Pricing Tier Statistics API Route
 *
 * Handles:
 * - GET: Get pricing tier statistics for a product
 *
 * Features:
 * - Public endpoint with caching
 * - Comprehensive statistics calculation
 * - Performance optimized queries
 */

import { rateLimit } from "@/lib/api-helpers";
import {
  createApiErrorResponse,
  validateApiAccess,
} from "@/lib/auth/server-session";
import { db } from "@/lib/db";
import { cuidSchema } from "@/lib/validations/base/common";
import { PricingTierService } from "@/services/pricing-tier.service";
import { ProductService } from "@/services/products/product.service";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const pricingTierService = new PricingTierService(db);
const productService = new ProductService(db);

// Parameter validation schema
const paramsSchema = z.object({
  id: cuidSchema,
});

/**
 * GET /api/products/[id]/pricing-tiers/stats - Get pricing tier statistics
 *
 * Returns comprehensive statistics about pricing tiers for a product.
 * Cached for performance since stats don't change frequently.
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
        return createApiErrorResponse(400, "Invalid product ID format");
      }
      throw _error;
    }

    // Apply rate limiting for public endpoints
    const rateLimitResult = await rateLimit(request, {
      windowMs: 15 * 60 * 1000, // 15 minutes
      maxRequests: 200, // Higher limit for stats
      keyGenerator: (req) => {
        const forwarded = req.headers.get("x-forwarded-for");
        const ip = forwarded ? forwarded.split(",")[0] : "unknown";
        return `pricing_tier_stats_${ip}`;
      },
    });

    if (!rateLimitResult.success) {
      return createApiErrorResponse(
        429,
        "Too many requests. Please try again later."
      );
    }

    // Check if user is admin for additional stats
    const { session } = await validateApiAccess(request);
    const isAdmin = session?.user?.role === "ADMIN";

    // Verify product exists
    const product = await productService.findById(validatedParams.id);
    if (!product) {
      return createApiErrorResponse(404, "Product not found");
    }

    // Hide inactive products from public unless admin
    if (!product.isActive && !isAdmin) {
      return createApiErrorResponse(404, "Product not found");
    }

    // Get pricing tier statistics
    const stats = await pricingTierService.getStats(validatedParams.id);

    const response = {
      stats: {
        ...stats,
        // Include additional admin stats if admin user
        ...(isAdmin &&
          {
            // Future: Add admin-only statistics like revenue, conversion rates, etc.
          }),
      },
      product: {
        id: product.id,
        name: product.name,
        type: product.type,
        isActive: product.isActive,
      },
    };

    // Set cache headers for statistics
    const cacheHeaders = product.isActive
      ? {
          "Cache-Control": "public, s-maxage=1800, stale-while-revalidate=3600", // 30 min cache, 1 hour SWR
          Vary: "Accept, Accept-Encoding",
        }
      : {};

    return NextResponse.json(response, {
      status: 200,
      headers: cacheHeaders,
    });
  } catch (_error) {
    return createApiErrorResponse(
      500,
      "Failed to fetch pricing tier statistics"
    );
  }
}

/**
 * OPTIONS /api/products/[id]/pricing-tiers/stats - Handle CORS preflight requests
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
