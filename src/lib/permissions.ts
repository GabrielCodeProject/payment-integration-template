/**
 * Role-Based Access Control (RBAC) Permission System
 * 
 * This module defines the comprehensive permission system for the payment integration template.
 * It provides role-based access control with granular permissions and security validation.
 */

import type { UserRole } from "@prisma/client";

/**
 * System-wide permissions for granular access control
 */
export const PERMISSIONS = {
  // User Management
  USER_READ: "user:read",
  USER_WRITE: "user:write", 
  USER_DELETE: "user:delete",
  USER_ROLE_ASSIGN: "user:role:assign",
  USER_ACTIVATE: "user:activate",
  USER_DEACTIVATE: "user:deactivate",
  
  // Role Management
  ROLE_VIEW: "role:view",
  ROLE_ASSIGN: "role:assign",
  ROLE_REVOKE: "role:revoke",
  
  // Order Management
  ORDER_READ_ALL: "order:read:all",
  ORDER_READ_OWN: "order:read:own",
  ORDER_WRITE: "order:write",
  ORDER_CANCEL: "order:cancel",
  ORDER_REFUND: "order:refund",
  
  // Product Management
  PRODUCT_READ: "product:read",
  PRODUCT_WRITE: "product:write",
  PRODUCT_DELETE: "product:delete",
  
  // Payment Management
  PAYMENT_READ_ALL: "payment:read:all",
  PAYMENT_READ_OWN: "payment:read:own",
  PAYMENT_PROCESS: "payment:process",
  PAYMENT_REFUND: "payment:refund",
  
  // Subscription Management
  SUBSCRIPTION_READ_ALL: "subscription:read:all",
  SUBSCRIPTION_READ_OWN: "subscription:read:own",
  SUBSCRIPTION_WRITE: "subscription:write",
  SUBSCRIPTION_CANCEL: "subscription:cancel",
  
  // Discount Management
  DISCOUNT_READ: "discount:read",
  DISCOUNT_WRITE: "discount:write",
  DISCOUNT_DELETE: "discount:delete",
  
  // Audit Logs
  AUDIT_READ: "audit:read",
  AUDIT_EXPORT: "audit:export",
  
  // System Administration
  SYSTEM_CONFIG: "system:config",
  SYSTEM_MONITOR: "system:monitor",
  
  // Support Functions
  SUPPORT_ACCESS: "support:access",
  SUPPORT_USER_IMPERSONATE: "support:user:impersonate",
} as const;

export type Permission = typeof PERMISSIONS[keyof typeof PERMISSIONS];

/**
 * Role-based permission mappings
 * Defines what permissions each role has
 */
export const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  ADMIN: [
    // Full system access - all permissions
    PERMISSIONS.USER_READ,
    PERMISSIONS.USER_WRITE,
    PERMISSIONS.USER_DELETE,
    PERMISSIONS.USER_ROLE_ASSIGN,
    PERMISSIONS.USER_ACTIVATE,
    PERMISSIONS.USER_DEACTIVATE,
    PERMISSIONS.ROLE_VIEW,
    PERMISSIONS.ROLE_ASSIGN,
    PERMISSIONS.ROLE_REVOKE,
    PERMISSIONS.ORDER_READ_ALL,
    PERMISSIONS.ORDER_WRITE,
    PERMISSIONS.ORDER_CANCEL,
    PERMISSIONS.ORDER_REFUND,
    PERMISSIONS.PRODUCT_READ,
    PERMISSIONS.PRODUCT_WRITE,
    PERMISSIONS.PRODUCT_DELETE,
    PERMISSIONS.PAYMENT_READ_ALL,
    PERMISSIONS.PAYMENT_PROCESS,
    PERMISSIONS.PAYMENT_REFUND,
    PERMISSIONS.SUBSCRIPTION_READ_ALL,
    PERMISSIONS.SUBSCRIPTION_WRITE,
    PERMISSIONS.SUBSCRIPTION_CANCEL,
    PERMISSIONS.DISCOUNT_READ,
    PERMISSIONS.DISCOUNT_WRITE,
    PERMISSIONS.DISCOUNT_DELETE,
    PERMISSIONS.AUDIT_READ,
    PERMISSIONS.AUDIT_EXPORT,
    PERMISSIONS.SYSTEM_CONFIG,
    PERMISSIONS.SYSTEM_MONITOR,
    PERMISSIONS.SUPPORT_ACCESS,
    PERMISSIONS.SUPPORT_USER_IMPERSONATE,
  ],
  
  SUPPORT: [
    // Limited admin functions for customer support
    PERMISSIONS.USER_READ,
    PERMISSIONS.USER_ACTIVATE,
    PERMISSIONS.USER_DEACTIVATE,
    PERMISSIONS.ROLE_VIEW,
    PERMISSIONS.ORDER_READ_ALL,
    PERMISSIONS.ORDER_CANCEL,
    PERMISSIONS.ORDER_REFUND,
    PERMISSIONS.PRODUCT_READ,
    PERMISSIONS.PAYMENT_READ_ALL,
    PERMISSIONS.PAYMENT_REFUND,
    PERMISSIONS.SUBSCRIPTION_READ_ALL,
    PERMISSIONS.SUBSCRIPTION_CANCEL,
    PERMISSIONS.DISCOUNT_READ,
    PERMISSIONS.SUPPORT_ACCESS,
    PERMISSIONS.SUPPORT_USER_IMPERSONATE,
  ],
  
  CUSTOMER: [
    // Standard user permissions - own data only
    PERMISSIONS.ORDER_READ_OWN,
    PERMISSIONS.PAYMENT_READ_OWN,
    PERMISSIONS.SUBSCRIPTION_READ_OWN,
    PERMISSIONS.PRODUCT_READ,
  ],
};

/**
 * Role hierarchy for inheritance-based permission checking
 * Higher roles inherit permissions from lower roles
 */
export const ROLE_HIERARCHY: Record<UserRole, UserRole[]> = {
  ADMIN: ["ADMIN", "SUPPORT", "CUSTOMER"],
  SUPPORT: ["SUPPORT", "CUSTOMER"],
  CUSTOMER: ["CUSTOMER"],
};

/**
 * Resource ownership patterns for data access control
 */
export const RESOURCE_OWNERSHIP = {
  USER: {
    own: (userId: string, resourceUserId: string) => userId === resourceUserId,
    all: () => true,
  },
  ORDER: {
    own: (userId: string, order: { userId?: string }) => order.userId === userId,
    all: () => true,
  },
  PAYMENT: {
    own: (userId: string, payment: { userId?: string }) => payment.userId === userId,
    all: () => true,
  },
  SUBSCRIPTION: {
    own: (userId: string, subscription: { userId?: string }) => subscription.userId === userId,
    all: () => true,
  },
} as const;

/**
 * Check if a role has a specific permission
 */
export function hasPermission(role: UserRole, permission: Permission): boolean {
  const rolePermissions = ROLE_PERMISSIONS[role];
  return rolePermissions.includes(permission);
}

/**
 * Check if a role has any of the specified permissions
 */
export function hasAnyPermission(role: UserRole, permissions: Permission[]): boolean {
  return permissions.some(permission => hasPermission(role, permission));
}

/**
 * Check if a role has all of the specified permissions
 */
export function hasAllPermissions(role: UserRole, permissions: Permission[]): boolean {
  return permissions.every(permission => hasPermission(role, permission));
}

/**
 * Get all permissions for a specific role
 */
export function getRolePermissions(role: UserRole): Permission[] {
  return ROLE_PERMISSIONS[role] || [];
}

/**
 * Check if one role can manage another role (for role assignment)
 */
export function canManageRole(assignerRole: UserRole, targetRole: UserRole): boolean {
  // Only ADMIN can assign ADMIN role
  if (targetRole === "ADMIN") {
    return assignerRole === "ADMIN";
  }
  
  // ADMIN can assign any role, SUPPORT cannot assign roles
  if (assignerRole === "ADMIN") {
    return true;
  }
  
  return false;
}

/**
 * Validate resource access based on ownership and permissions
 */
export function validateResourceAccess<T extends Record<string, any>>(
  userRole: UserRole,
  userId: string,
  resource: T,
  resourceType: keyof typeof RESOURCE_OWNERSHIP,
  permission: Permission
): boolean {
  // Check if user has the required permission
  if (!hasPermission(userRole, permission)) {
    return false;
  }
  
  // If permission allows access to all resources, grant access
  if (permission.includes(":all")) {
    return true;
  }
  
  // If permission is for own resources only, check ownership
  if (permission.includes(":own")) {
    const ownershipCheck = RESOURCE_OWNERSHIP[resourceType];
    if (ownershipCheck && ownershipCheck.own) {
      return ownershipCheck.own(userId, resource as any);
    }
  }
  
  return false;
}

/**
 * Get minimum required role for a permission
 */
export function getMinimumRoleForPermission(permission: Permission): UserRole | null {
  const roles: UserRole[] = ["CUSTOMER", "SUPPORT", "ADMIN"];
  
  for (const role of roles) {
    if (hasPermission(role, permission)) {
      return role;
    }
  }
  
  return null;
}

/**
 * Security-enhanced permission checker with audit logging
 */
export function checkPermissionWithAudit(
  userRole: UserRole,
  userId: string,
  permission: Permission,
  resourceId?: string,
  auditContext?: {
    action: string;
    ipAddress?: string;
    userAgent?: string;
  }
): {
  allowed: boolean;
  reason?: string;
  auditData: {
    userId: string;
    userRole: UserRole;
    permission: Permission;
    resourceId?: string;
    action?: string;
    timestamp: string;
    allowed: boolean;
    reason?: string;
    ipAddress?: string;
    userAgent?: string;
  };
} {
  const timestamp = new Date().toISOString();
  const allowed = hasPermission(userRole, permission);
  const reason = allowed ? undefined : `Role ${userRole} does not have permission ${permission}`;
  
  const auditData = {
    userId,
    userRole,
    permission,
    resourceId: resourceId || undefined,
    action: auditContext?.action || undefined,
    timestamp,
    allowed,
    reason,
    ipAddress: auditContext?.ipAddress || undefined,
    userAgent: auditContext?.userAgent || undefined,
  };
  
  return {
    allowed,
    reason,
    auditData,
  };
}

/**
 * Role transition validation for security
 */
export function validateRoleTransition(
  currentRole: UserRole,
  newRole: UserRole,
  assignerRole: UserRole
): {
  allowed: boolean;
  reason?: string;
  securityRisk?: "LOW" | "MEDIUM" | "HIGH";
} {
  // Check if assigner can manage the target role
  if (!canManageRole(assignerRole, newRole)) {
    return {
      allowed: false,
      reason: `Role ${assignerRole} cannot assign role ${newRole}`,
      securityRisk: "HIGH",
    };
  }
  
  // Flag privilege escalations for extra scrutiny
  const roleOrder = { CUSTOMER: 1, SUPPORT: 2, ADMIN: 3 };
  const isEscalation = roleOrder[newRole] > roleOrder[currentRole];
  
  return {
    allowed: true,
    securityRisk: isEscalation ? "MEDIUM" : "LOW",
  };
}

/**
 * Export role constants for type safety
 */
export const ROLES = {
  ADMIN: "ADMIN" as const,
  SUPPORT: "SUPPORT" as const,
  CUSTOMER: "CUSTOMER" as const,
} satisfies Record<string, UserRole>;

/**
 * Permission groups for UI and management
 */
export const PERMISSION_GROUPS = {
  USER_MANAGEMENT: [
    PERMISSIONS.USER_READ,
    PERMISSIONS.USER_WRITE,
    PERMISSIONS.USER_DELETE,
    PERMISSIONS.USER_ROLE_ASSIGN,
    PERMISSIONS.USER_ACTIVATE,
    PERMISSIONS.USER_DEACTIVATE,
  ],
  ORDER_MANAGEMENT: [
    PERMISSIONS.ORDER_READ_ALL,
    PERMISSIONS.ORDER_READ_OWN,
    PERMISSIONS.ORDER_WRITE,
    PERMISSIONS.ORDER_CANCEL,
    PERMISSIONS.ORDER_REFUND,
  ],
  PAYMENT_MANAGEMENT: [
    PERMISSIONS.PAYMENT_READ_ALL,
    PERMISSIONS.PAYMENT_READ_OWN,
    PERMISSIONS.PAYMENT_PROCESS,
    PERMISSIONS.PAYMENT_REFUND,
  ],
  SYSTEM_ADMINISTRATION: [
    PERMISSIONS.AUDIT_READ,
    PERMISSIONS.AUDIT_EXPORT,
    PERMISSIONS.SYSTEM_CONFIG,
    PERMISSIONS.SYSTEM_MONITOR,
  ],
} as const;