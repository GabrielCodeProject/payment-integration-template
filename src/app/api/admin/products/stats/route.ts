/**
 * Product Statistics API Route
 *
 * Provides aggregated statistics about products for admin dashboard
 */

import {
  createApiErrorResponse,
  validateApiAccess,
} from "@/lib/auth/server-session";
import { db } from "@/lib/db";
import { ProductService } from "@/services/products/product.service";
import { NextRequest, NextResponse } from "next/server";

const productService = new ProductService(db);

/**
 * GET /api/admin/products/stats - Get product statistics
 *
 * Returns aggregated product statistics including:
 * - Total product counts by status, type, format
 * - Inventory alerts and stock levels
 * - Performance metrics
 */
export async function GET(request: NextRequest) {
  try {
    // Validate admin authentication
    const { isValid, session, error } = await validateApiAccess(
      request,
      "ADMIN"
    );

    if (!isValid || !session) {
      return createApiErrorResponse(
        error?.code || 401,
        error?.message || "Admin authentication required"
      );
    }

    // Get product statistics
    const stats = await productService.getProductStats();

    return NextResponse.json(
      {
        stats,
        message: "Product statistics retrieved successfully",
      },
      { status: 200 }
    );
  } catch (_error) {
    console.error("Error fetching product statistics:", _error);
    return createApiErrorResponse(500, "Failed to fetch product statistics");
  }
}

/**
 * OPTIONS /api/admin/products/stats - Handle CORS preflight requests
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
