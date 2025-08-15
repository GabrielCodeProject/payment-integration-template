/**
 * Roles Information API
 * 
 * Provides secure endpoints for role management information including
 * available roles, permissions, and role distribution statistics.
 * Requires ADMIN role authentication with audit logging.
 */

import { NextRequest } from "next/server";
import { withPermission, createApiErrorResponse, getAuditContext } from "@/lib/auth/server-session";
import { 
  PERMISSIONS, 
  ROLE_PERMISSIONS, 
  ROLE_HIERARCHY, 
  PERMISSION_GROUPS, 
  ROLES,
  getRolePermissions,
  getMinimumRoleForPermission,
  canManageRole
} from "@/lib/permissions";
import { db } from "@/lib/db";
import type { UserRole } from "@prisma/client";

/**
 * GET /api/admin/roles
 * 
 * Retrieve comprehensive role information including permissions and statistics.
 * Requires ADMIN role and ROLE_VIEW permission.
 */
export const GET = withPermission(
  async (request: NextRequest, session) => {
    try {
      const auditContext = getAuditContext(request, session);
      
      // Get role distribution statistics
      const roleStats = await db.user.groupBy({
        by: ["role"],
        _count: { role: true },
        where: { isActive: true }, // Only count active users
      });

      // Convert to more readable format
      const roleDistribution: Record<UserRole, number> = {
        ADMIN: 0,
        SUPPORT: 0,
        CUSTOMER: 0,
      };

      roleStats.forEach((stat) => {
        roleDistribution[stat.role] = stat._count.role;
      });

      // Get total user count for percentages
      const totalActiveUsers = await db.user.count({
        where: { isActive: true },
      });

      // Build comprehensive role information
      const rolesInfo = Object.entries(ROLES).map(([roleName, roleValue]) => {
        const permissions = getRolePermissions(roleValue);
        const userCount = roleDistribution[roleValue];
        const percentage = totalActiveUsers > 0 ? (userCount / totalActiveUsers) * 100 : 0;
        
        return {
          name: roleName,
          value: roleValue,
          description: getRoleDescription(roleValue),
          permissions: permissions,
          permissionCount: permissions.length,
          hierarchy: ROLE_HIERARCHY[roleValue],
          userCount,
          percentage: Math.round(percentage * 100) / 100,
          canManage: Object.values(ROLES).filter(targetRole => 
            canManageRole(session.user.role as UserRole, targetRole)
          ),
        };
      });

      // Build permission information grouped by category
      const permissionInfo = Object.entries(PERMISSION_GROUPS).map(([groupName, permissions]) => ({
        group: groupName,
        permissions: permissions.map(permission => ({
          name: permission,
          description: getPermissionDescription(permission),
          minimumRole: getMinimumRoleForPermission(permission),
          rolesWithAccess: Object.values(ROLES).filter(role => 
            getRolePermissions(role).includes(permission)
          ),
        })),
      }));

      // Role transition matrix (what roles can assign what roles)
      const roleTransitionMatrix = Object.values(ROLES).map(assignerRole => ({
        assignerRole,
        canAssign: Object.values(ROLES).filter(targetRole => 
          canManageRole(assignerRole, targetRole)
        ),
      }));

      // Log audit event
      await logRoleViewEvent(auditContext);

      return Response.json({
        success: true,
        data: {
          roles: rolesInfo,
          permissions: permissionInfo,
          statistics: {
            totalActiveUsers,
            roleDistribution,
            roleTransitionMatrix,
          },
          meta: {
            lastUpdated: new Date().toISOString(),
            permissionSystem: "RBAC",
            version: "1.0",
          },
        },
        meta: {
          requestId: crypto.randomUUID(),
          timestamp: new Date().toISOString(),
        },
      });

    } catch (error) {
      console.error("[API] Roles information error:", error);
      
      if (error instanceof Error && error.message.includes("permission")) {
        return createApiErrorResponse(403, error.message);
      }
      
      return createApiErrorResponse(500, "Failed to retrieve role information");
    }
  },
  PERMISSIONS.ROLE_VIEW
);

/**
 * GET /api/admin/roles/permissions
 * 
 * Retrieve detailed permission information (alternative endpoint).
 */
export async function getPermissions(request: NextRequest, session: any) {
  try {
    const auditContext = getAuditContext(request, session);
    
    // Build detailed permission matrix
    const permissionMatrix = Object.values(PERMISSIONS).map(permission => ({
      permission,
      description: getPermissionDescription(permission),
      minimumRole: getMinimumRoleForPermission(permission),
      roles: Object.entries(ROLE_PERMISSIONS).map(([role, rolePerms]) => ({
        role: role as UserRole,
        hasPermission: rolePerms.includes(permission),
      })),
    }));

    // Group permissions by category
    const categorizedPermissions = Object.entries(PERMISSION_GROUPS).map(([category, permissions]) => ({
      category,
      description: getCategoryDescription(category),
      permissions: permissions.map(permission => ({
        permission,
        description: getPermissionDescription(permission),
        minimumRole: getMinimumRoleForPermission(permission),
      })),
    }));

    // Log audit event
    await logPermissionViewEvent(auditContext);

    return Response.json({
      success: true,
      data: {
        permissionMatrix,
        categorizedPermissions,
        summary: {
          totalPermissions: Object.values(PERMISSIONS).length,
          categories: Object.keys(PERMISSION_GROUPS),
          roles: Object.values(ROLES),
        },
      },
      meta: {
        requestId: crypto.randomUUID(),
        timestamp: new Date().toISOString(),
      },
    });

  } catch (error) {
    console.error("[API] Permissions information error:", error);
    return createApiErrorResponse(500, "Failed to retrieve permission information");
  }
}

/**
 * Helper function to get role description
 */
function getRoleDescription(role: UserRole): string {
  switch (role) {
    case "ADMIN":
      return "Full system access with all administrative privileges including user management, role assignment, and system configuration.";
    case "SUPPORT":
      return "Customer support access with read-only permissions for user data and limited administrative functions for customer assistance.";
    case "CUSTOMER":
      return "Standard user access to personal account, orders, payments, and subscriptions.";
    default:
      return "Unknown role";
  }
}

/**
 * Helper function to get permission description
 */
function getPermissionDescription(permission: string): string {
  const descriptions: Record<string, string> = {
    [PERMISSIONS.USER_READ]: "View user information and profiles",
    [PERMISSIONS.USER_WRITE]: "Create and update user accounts",
    [PERMISSIONS.USER_DELETE]: "Delete or deactivate user accounts",
    [PERMISSIONS.USER_ROLE_ASSIGN]: "Assign roles to users",
    [PERMISSIONS.USER_ACTIVATE]: "Activate user accounts",
    [PERMISSIONS.USER_DEACTIVATE]: "Deactivate user accounts",
    [PERMISSIONS.ROLE_VIEW]: "View role information and permissions",
    [PERMISSIONS.ROLE_ASSIGN]: "Assign roles to users",
    [PERMISSIONS.ROLE_REVOKE]: "Revoke roles from users",
    [PERMISSIONS.ORDER_READ_ALL]: "View all customer orders",
    [PERMISSIONS.ORDER_READ_OWN]: "View own orders only",
    [PERMISSIONS.ORDER_WRITE]: "Create and update orders",
    [PERMISSIONS.ORDER_CANCEL]: "Cancel orders",
    [PERMISSIONS.ORDER_REFUND]: "Process order refunds",
    [PERMISSIONS.PRODUCT_READ]: "View product catalog",
    [PERMISSIONS.PRODUCT_WRITE]: "Create and update products",
    [PERMISSIONS.PRODUCT_DELETE]: "Delete products",
    [PERMISSIONS.PAYMENT_READ_ALL]: "View all payment information",
    [PERMISSIONS.PAYMENT_READ_OWN]: "View own payment information",
    [PERMISSIONS.PAYMENT_PROCESS]: "Process payments",
    [PERMISSIONS.PAYMENT_REFUND]: "Process payment refunds",
    [PERMISSIONS.SUBSCRIPTION_READ_ALL]: "View all subscriptions",
    [PERMISSIONS.SUBSCRIPTION_READ_OWN]: "View own subscriptions",
    [PERMISSIONS.SUBSCRIPTION_WRITE]: "Create and update subscriptions",
    [PERMISSIONS.SUBSCRIPTION_CANCEL]: "Cancel subscriptions",
    [PERMISSIONS.DISCOUNT_READ]: "View discount codes",
    [PERMISSIONS.DISCOUNT_WRITE]: "Create and update discount codes",
    [PERMISSIONS.DISCOUNT_DELETE]: "Delete discount codes",
    [PERMISSIONS.AUDIT_READ]: "View audit logs",
    [PERMISSIONS.AUDIT_EXPORT]: "Export audit logs",
    [PERMISSIONS.SYSTEM_CONFIG]: "Configure system settings",
    [PERMISSIONS.SYSTEM_MONITOR]: "Monitor system performance",
    [PERMISSIONS.SUPPORT_ACCESS]: "Access support tools",
    [PERMISSIONS.SUPPORT_USER_IMPERSONATE]: "Impersonate users for support",
  };

  return descriptions[permission] || "Permission description not available";
}

/**
 * Helper function to get category description
 */
function getCategoryDescription(category: string): string {
  const descriptions: Record<string, string> = {
    USER_MANAGEMENT: "Permissions for managing user accounts, profiles, and authentication",
    ORDER_MANAGEMENT: "Permissions for viewing and managing customer orders",
    PAYMENT_MANAGEMENT: "Permissions for processing and managing payments",
    SYSTEM_ADMINISTRATION: "Permissions for system configuration, monitoring, and audit logs",
  };

  return descriptions[category] || "Category description not available";
}

/**
 * Log role view audit event
 */
async function logRoleViewEvent(auditContext: any): Promise<void> {
  try {
    await db.auditLog.create({
      data: {
        tableName: "roles",
        recordId: "system",
        action: "ROLE_INFORMATION_VIEW",
        userId: auditContext.adminUserId,
        ipAddress: auditContext.ipAddress,
        userAgent: auditContext.userAgent,
        metadata: {
          adminRole: auditContext.adminRole,
          action: "VIEW_ROLE_INFORMATION",
          timestamp: new Date().toISOString(),
        },
      },
    });
  } catch (error) {
    console.error("Failed to log role view event:", error);
  }
}

/**
 * Log permission view audit event
 */
async function logPermissionViewEvent(auditContext: any): Promise<void> {
  try {
    await db.auditLog.create({
      data: {
        tableName: "permissions",
        recordId: "system",
        action: "PERMISSION_INFORMATION_VIEW",
        userId: auditContext.adminUserId,
        ipAddress: auditContext.ipAddress,
        userAgent: auditContext.userAgent,
        metadata: {
          adminRole: auditContext.adminRole,
          action: "VIEW_PERMISSION_INFORMATION",
          timestamp: new Date().toISOString(),
        },
      },
    });
  } catch (error) {
    console.error("Failed to log permission view event:", error);
  }
}

/**
 * Health check endpoint for roles API
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