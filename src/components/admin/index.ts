/**
 * Admin Components Export Index
 * 
 * Centralized exports for all admin interface components
 */

export { AdminNavigation } from "./AdminNavigation";
export { AdminStats } from "./AdminStats";
export { PermissionGuard, usePermissions, withPermissions } from "./PermissionGuard";
export { RoleBadge, RoleIndicator } from "./RoleBadge";
export { RoleAssignmentForm } from "./RoleAssignmentForm";
export { UserActivityFeed } from "./UserActivityFeed";
export { UserDetailModal } from "./UserDetailModal";
export { UserList } from "./UserList";

// Re-export types for convenience
export type { UserRole } from "@prisma/client";