/**
 * Individual User Management API
 * 
 * Provides secure endpoints for individual user operations including
 * viewing, updating, and deactivating user accounts.
 * Requires ADMIN role authentication with comprehensive audit logging.
 */

import { NextRequest } from "next/server";
import { withPermission, createApiErrorResponse, getAuditContext } from "@/lib/auth/server-session";
import { UserManagementService } from "@/lib/services/user-management.service";
import { PERMISSIONS } from "@/lib/permissions";
import { z } from "zod";

/**
 * User update validation schema
 */
const UpdateUserSchema = z.object({
  name: z.string().min(1, "Name is required").max(100, "Name too long").optional(),
  email: z.string().email({ message: "Invalid email address" }).optional(),
  role: z.enum(["ADMIN", "SUPPORT", "CUSTOMER"]).optional(),
  isActive: z.boolean().optional(),
  phone: z.string().nullable().optional(),
  timezone: z.string().optional(),
  preferredCurrency: z.string().length(3).optional(),
});

/**
 * Route context interface
 */
interface RouteContext {
  params: {
    id: string;
  };
}

/**
 * GET /api/admin/users/[id]
 * 
 * Retrieve detailed information for a specific user.
 * Requires ADMIN role and USER_READ permission.
 */
export async function GET(
  request: NextRequest,
  context: RouteContext
) {
  return withPermission(
    async (_req: NextRequest, session) => {
      try {
        const userId = context.params.id;
        
        // Validate user ID format
        if (!userId || typeof userId !== "string" || userId.length < 10) {
          return createApiErrorResponse(400, "Invalid user ID");
        }

        const auditContext = {
          ...getAuditContext(request, session),
          action: "VIEW_USER_DETAILS",
        };

        // Get user details
        const user = await UserManagementService.getUserById(userId, {
          adminUserId: auditContext.adminUserId,
          adminRole: auditContext.adminRole,
        });

        if (!user) {
          return createApiErrorResponse(404, "User not found");
        }

        // Remove sensitive information from response
        const {
          stripeCustomerId: _stripeCustomerId,
          ...safeUserData
        } = user;

        return Response.json({
          success: true,
          data: safeUserData,
          meta: {
            requestId: crypto.randomUUID(),
            timestamp: new Date().toISOString(),
          },
        });

      } catch (error) {
        console.error("[API] Get user details error:", error);
        
        if (error instanceof Error) {
          if (error.message.includes("permission")) {
            return createApiErrorResponse(403, error.message);
          }
          if (error.message.includes("not found")) {
            return createApiErrorResponse(404, error.message);
          }
        }
        
        return createApiErrorResponse(500, "Failed to retrieve user details");
      }
    },
    PERMISSIONS.USER_READ,
    context.params.id
  )(request);
}

/**
 * PUT /api/admin/users/[id]
 * 
 * Update user information including role assignments.
 * Requires ADMIN role and USER_WRITE permission.
 */
export async function PUT(
  request: NextRequest,
  context: RouteContext
) {
  return withPermission(
    async (_req: NextRequest, session, auditData) => {
      try {
        const userId = context.params.id;
        
        // Validate user ID format
        if (!userId || typeof userId !== "string" || userId.length < 10) {
          return createApiErrorResponse(400, "Invalid user ID");
        }

        // Parse and validate request body
        const body = await request.json();
        
        const validationResult = UpdateUserSchema.safeParse(body);
        if (!validationResult.success) {
          return createApiErrorResponse(
            400,
            "Invalid update data",
            process.env.NODE_ENV === "development" ? validationResult.error.issues : undefined
          );
        }

        const updateData = validationResult.data;
        
        // Prevent self-role modification for security
        if (updateData.role && userId === session.user.id) {
          return createApiErrorResponse(
            403,
            "Cannot modify your own role"
          );
        }

        // Prevent self-deactivation
        if (updateData.isActive === false && userId === session.user.id) {
          return createApiErrorResponse(
            403,
            "Cannot deactivate your own account"
          );
        }

        const auditContext = {
          ...getAuditContext(request, session),
          action: "UPDATE_USER",
        };

        // Clean update data to match interface expectations
        const cleanUpdateData: Record<string, unknown> = {};
        if (updateData.name !== undefined) cleanUpdateData.name = updateData.name;
        if (updateData.email !== undefined) cleanUpdateData.email = updateData.email;
        if (updateData.role !== undefined) cleanUpdateData.role = updateData.role;
        if (updateData.isActive !== undefined) cleanUpdateData.isActive = updateData.isActive;
        if (updateData.phone !== undefined && updateData.phone !== null) cleanUpdateData.phone = updateData.phone;
        if (updateData.timezone !== undefined) cleanUpdateData.timezone = updateData.timezone;
        if (updateData.preferredCurrency !== undefined) cleanUpdateData.preferredCurrency = updateData.preferredCurrency;

        // Update user
        const updatedUser = await UserManagementService.updateUser(
          userId,
          cleanUpdateData,
          auditContext
        );

        // Remove sensitive information from response
        const {
          stripeCustomerId: _stripeCustomerId,
          ...safeUserData
        } = updatedUser;

        return Response.json({
          success: true,
          data: safeUserData,
          meta: {
            requestId: crypto.randomUUID(),
            timestamp: new Date().toISOString(),
            auditId: auditData?.auditId,
          },
        });

      } catch (error) {
        console.error("[API] Update user error:", error);
        
        if (error instanceof Error) {
          if (error.message.includes("permission")) {
            return createApiErrorResponse(403, error.message);
          }
          if (error.message.includes("not found")) {
            return createApiErrorResponse(404, error.message);
          }
          if (error.message.includes("Invalid")) {
            return createApiErrorResponse(400, error.message);
          }
          if (error.message.includes("role transition")) {
            return createApiErrorResponse(403, error.message);
          }
        }
        
        return createApiErrorResponse(500, "Failed to update user");
      }
    },
    PERMISSIONS.USER_WRITE,
    context.params.id
  )(request);
}

/**
 * DELETE /api/admin/users/[id]
 * 
 * Deactivate user account (soft delete for data integrity).
 * Requires ADMIN role and USER_DEACTIVATE permission.
 */
export async function DELETE(
  request: NextRequest,
  context: RouteContext
) {
  return withPermission(
    async (_req: NextRequest, session, auditData) => {
      try {
        const userId = context.params.id;
        
        // Validate user ID format
        if (!userId || typeof userId !== "string" || userId.length < 10) {
          return createApiErrorResponse(400, "Invalid user ID");
        }

        // Prevent self-deletion
        if (userId === session.user.id) {
          return createApiErrorResponse(
            403,
            "Cannot delete your own account"
          );
        }

        const auditContext = {
          ...getAuditContext(request, session),
          action: "DEACTIVATE_USER",
        };

        // Deactivate user
        const deactivatedUser = await UserManagementService.deactivateUser(
          userId,
          auditContext
        );

        // Remove sensitive information from response
        const {
          stripeCustomerId: _stripeCustomerId,
          ...safeUserData
        } = deactivatedUser;

        return Response.json({
          success: true,
          data: safeUserData,
          message: "User account has been deactivated",
          meta: {
            requestId: crypto.randomUUID(),
            timestamp: new Date().toISOString(),
            auditId: auditData?.auditId,
          },
        });

      } catch (error) {
        console.error("[API] Deactivate user error:", error);
        
        if (error instanceof Error) {
          if (error.message.includes("permission")) {
            return createApiErrorResponse(403, error.message);
          }
          if (error.message.includes("not found")) {
            return createApiErrorResponse(404, error.message);
          }
          if (error.message.includes("already deactivated")) {
            return createApiErrorResponse(409, error.message);
          }
          if (error.message.includes("Cannot delete")) {
            return createApiErrorResponse(403, error.message);
          }
        }
        
        return createApiErrorResponse(500, "Failed to deactivate user");
      }
    },
    PERMISSIONS.USER_DEACTIVATE,
    context.params.id
  )(request);
}

/**
 * PATCH /api/admin/users/[id]/activate
 * 
 * Reactivate a deactivated user account.
 * Requires ADMIN role and USER_ACTIVATE permission.
 */
export async function PATCH(
  request: NextRequest,
  context: RouteContext
) {
  return withPermission(
    async (_req: NextRequest, session, auditData) => {
      try {
        const userId = context.params.id;
        
        // Validate user ID format
        if (!userId || typeof userId !== "string" || userId.length < 10) {
          return createApiErrorResponse(400, "Invalid user ID");
        }

        // Check if this is an activation request
        const url = new URL(request.url);
        const action = url.searchParams.get("action");
        
        if (action !== "activate") {
          return createApiErrorResponse(400, "Invalid action. Use ?action=activate");
        }

        const auditContext = {
          ...getAuditContext(request, session),
          action: "ACTIVATE_USER",
        };

        // Activate user
        const activatedUser = await UserManagementService.activateUser(
          userId,
          auditContext
        );

        // Remove sensitive information from response
        const {
          stripeCustomerId: _stripeCustomerId,
          ...safeUserData
        } = activatedUser;

        return Response.json({
          success: true,
          data: safeUserData,
          message: "User account has been activated",
          meta: {
            requestId: crypto.randomUUID(),
            timestamp: new Date().toISOString(),
            auditId: auditData?.auditId,
          },
        });

      } catch (error) {
        console.error("[API] Activate user error:", error);
        
        if (error instanceof Error) {
          if (error.message.includes("permission")) {
            return createApiErrorResponse(403, error.message);
          }
          if (error.message.includes("not found")) {
            return createApiErrorResponse(404, error.message);
          }
          if (error.message.includes("already active")) {
            return createApiErrorResponse(409, error.message);
          }
        }
        
        return createApiErrorResponse(500, "Failed to activate user");
      }
    },
    PERMISSIONS.USER_ACTIVATE,
    context.params.id
  )(request);
}

/**
 * Health check endpoint for individual user API
 */
export async function HEAD(_request: NextRequest, _context: RouteContext) {
  return new Response(null, {
    status: 200,
    headers: {
      "Cache-Control": "no-cache",
      "Content-Type": "application/json",
    },
  });
}