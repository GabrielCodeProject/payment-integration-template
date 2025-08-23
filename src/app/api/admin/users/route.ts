/**
 * Admin Users Management API
 * 
 * Provides secure endpoints for user management operations.
 * Requires ADMIN role authentication and comprehensive audit logging.
 */

import { NextRequest } from "next/server";
import { withPermission, createApiErrorResponse, getAuditContext } from "@/lib/auth/server-session";
import { UserManagementService } from "@/lib/services/user-management.service";
import { PERMISSIONS } from "@/lib/permissions";
import { z } from "zod";

/**
 * User query parameters validation schema
 */
const UserQuerySchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(20),
  search: z.string().optional(),
  role: z.enum(["ADMIN", "SUPPORT", "CUSTOMER"]).optional(),
  isActive: z.coerce.boolean().optional(),
  sortBy: z.enum(["createdAt", "lastLoginAt", "email", "name"]).default("createdAt"),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
});


/**
 * User statistics endpoint helper
 * GET /api/admin/users?stats=true
 */
async function getUserStatistics(request: NextRequest, session: any) {
  try {
    const auditContext = getAuditContext(request, session);
    
    const stats = await UserManagementService.getUserStatistics({
      adminUserId: auditContext.adminUserId,
      adminRole: auditContext.adminRole,
    });

    return Response.json({
      success: true,
      data: stats,
      meta: {
        requestId: crypto.randomUUID(),
        timestamp: new Date().toISOString(),
      },
    });

  } catch (_error) {
    // console.error("[API] User statistics error:", error);
    
    if (_error instanceof Error && _error.message.includes("permission")) {
      return createApiErrorResponse(403, _error.message);
    }
    
    return createApiErrorResponse(500, "Failed to retrieve user statistics");
  }
}

/**
 * Enhanced GET handler with statistics support
 */
const GET_ENHANCED = withPermission(
  async (request: NextRequest, session) => {
    try {
      const url = new URL(request.url);
      const statsParam = url.searchParams.get("stats");
      
      // Route to statistics if requested
      if (statsParam === "true") {
        return getUserStatistics(request, session);
      }
      
      // Parse and validate query parameters
      const queryParams = Object.fromEntries(url.searchParams.entries());
      
      const validationResult = UserQuerySchema.safeParse(queryParams);
      if (!validationResult.success) {
        return createApiErrorResponse(
          400,
          "Invalid query parameters",
          process.env.NODE_ENV === "development" ? validationResult._error.issues : undefined
        );
      }

      const queryOptions = validationResult.data;
      const auditContext = getAuditContext(request, session);

      // Get users with pagination
      const result = await UserManagementService.getUsers(queryOptions, {
        adminUserId: auditContext.adminUserId,
        adminRole: auditContext.adminRole,
      });

      // Return successful response
      return Response.json({
        success: true,
        data: result.users,
        pagination: result.pagination,
        meta: {
          requestId: crypto.randomUUID(),
          timestamp: new Date().toISOString(),
        },
      });

    } catch (_error) {
      // console.error("[API] Admin users list error:", error);
      
      // Return appropriate error response
      if (_error instanceof Error) {
        if (_error.message.includes("permission")) {
          return createApiErrorResponse(403, _error.message);
        }
        if (_error.message.includes("Invalid")) {
          return createApiErrorResponse(400, _error.message);
        }
      }
      
      return createApiErrorResponse(500, "Failed to retrieve users");
    }
  },
  PERMISSIONS.USER_READ
);

// Export the enhanced handler as GET
export { GET_ENHANCED as GET };

/**
 * POST /api/admin/users
 * 
 * Create new user account (admin operation).
 * Requires ADMIN role and USER_WRITE permission.
 */
const CreateUserSchema = z.object({
  email: z.string().email("Invalid email address"),
  name: z.string().min(1, "Name is required").max(100, "Name too long"),
  role: z.enum(["ADMIN", "SUPPORT", "CUSTOMER"]).default("CUSTOMER"),
  isActive: z.boolean().default(true),
  phone: z.string().optional(),
  timezone: z.string().default("UTC"),
  preferredCurrency: z.string().length(3).default("usd"),
  password: z.string().min(8, "Password must be at least 8 characters").optional(),
});

export const POST = withPermission(
  async (request: NextRequest, session) => {
    try {
      // Parse request body
      const body = await request.json();
      
      const validationResult = CreateUserSchema.safeParse(body);
      if (!validationResult.success) {
        return createApiErrorResponse(
          400,
          "Invalid user data",
          process.env.NODE_ENV === "development" ? validationResult._error.issues : undefined
        );
      }

      const _userData = validationResult.data;
      const _auditContext = {
        ...getAuditContext(request, session),
        action: "CREATE_USER",
      };

      // For now, return a placeholder response since BetterAuth handles user creation
      // This endpoint can be enhanced to work with BetterAuth's user creation flow
      return createApiErrorResponse(
        501, 
        "User creation through this endpoint is not implemented. Please use the authentication flow."
      );

    } catch (_error) {
      // console.error("[API] Create user error:", error);
      
      if (_error instanceof Error) {
        if (_error.message.includes("permission")) {
          return createApiErrorResponse(403, _error.message);
        }
        if (_error.message.includes("Invalid")) {
          return createApiErrorResponse(400, _error.message);
        }
        if (_error.message.includes("already exists")) {
          return createApiErrorResponse(409, _error.message);
        }
      }
      
      return createApiErrorResponse(500, "Failed to create user");
    }
  },
  PERMISSIONS.USER_WRITE
);

/**
 * Health check endpoint for admin users API
 */
export async function HEAD(_request: NextRequest) {
  return new Response(null, {
    status: 200,
    headers: {
      "Cache-Control": "no-cache",
      "Content-Type": "application/json",
    },
  });
}