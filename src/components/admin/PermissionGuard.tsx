"use client";

import { ReactNode } from "react";
import { useSession } from "@/lib/auth/client";
import { hasPermission, hasAnyPermission, type Permission } from "@/lib/permissions";
import type { UserRole } from "@prisma/client";

interface PermissionGuardProps {
  /** Single permission required to render children */
  permission?: Permission;
  /** Array of permissions - user needs ANY of these permissions */
  anyPermissions?: Permission[];
  /** Array of permissions - user needs ALL of these permissions */
  allPermissions?: Permission[];
  /** Specific role required (optional, overrides permission checks) */
  role?: UserRole;
  /** Array of roles - user needs ANY of these roles */
  anyRoles?: UserRole[];
  /** Content to render when user has insufficient permissions */
  fallback?: ReactNode;
  /** Children to render when user has sufficient permissions */
  children: ReactNode;
  /** Whether to render a placeholder when loading session */
  showLoadingPlaceholder?: boolean;
}

/**
 * PermissionGuard Component
 * 
 * Conditionally renders children based on user permissions and roles.
 * Integrates with the session management to check current user permissions.
 */
export function PermissionGuard({
  permission,
  anyPermissions,
  allPermissions,
  role,
  anyRoles,
  fallback = null,
  children,
  showLoadingPlaceholder = true,
}: PermissionGuardProps) {
  const { data: session, isPending } = useSession();

  // Show loading state if session is being fetched
  if (isPending) {
    if (showLoadingPlaceholder) {
      return (
        <div className="animate-pulse bg-slate-200 dark:bg-slate-700 rounded h-8 w-32" />
      );
    }
    return null;
  }

  // If no session, deny access
  if (!session?.user) {
    return <>{fallback}</>;
  }

  const userRole = session.user.role as UserRole;

  // Check specific role requirement
  if (role && userRole !== role) {
    return <>{fallback}</>;
  }

  // Check if user has any of the specified roles
  if (anyRoles && !anyRoles.includes(userRole)) {
    return <>{fallback}</>;
  }

  // Check single permission
  if (permission && !hasPermission(userRole, permission)) {
    return <>{fallback}</>;
  }

  // Check if user has ANY of the specified permissions
  if (anyPermissions && !hasAnyPermission(userRole, anyPermissions)) {
    return <>{fallback}</>;
  }

  // Check if user has ALL of the specified permissions
  if (allPermissions && !allPermissions.every(perm => hasPermission(userRole, perm))) {
    return <>{fallback}</>;
  }

  // All checks passed, render children
  return <>{children}</>;
}

/**
 * Hook to check permissions in components
 */
export function usePermissions() {
  const { data: session, isPending } = useSession();

  const checkPermission = (permission: Permission): boolean => {
    if (!session?.user) return false;
    return hasPermission(session.user.role as UserRole, permission);
  };

  const checkAnyPermissions = (permissions: Permission[]): boolean => {
    if (!session?.user) return false;
    return hasAnyPermission(session.user.role as UserRole, permissions);
  };

  const checkRole = (targetRole: UserRole): boolean => {
    if (!session?.user) return false;
    return session.user.role === targetRole;
  };

  const checkAnyRoles = (roles: UserRole[]): boolean => {
    if (!session?.user) return false;
    return roles.includes(session.user.role as UserRole);
  };

  return {
    user: session?.user || null,
    userRole: session?.user?.role as UserRole | null,
    isLoading: isPending,
    checkPermission,
    checkAnyPermissions,
    checkRole,
    checkAnyRoles,
  };
}

/**
 * Higher-order component for permission-based access control
 */
export function withPermissions<P extends object>(
  Component: React.ComponentType<P>,
  requirements: Omit<PermissionGuardProps, 'children' | 'fallback'> & {
    fallback?: ReactNode;
  }
) {
  const WrappedComponent = (props: P) => {
    return (
      <PermissionGuard {...requirements}>
        <Component {...props} />
      </PermissionGuard>
    );
  };

  WrappedComponent.displayName = `withPermissions(${Component.displayName || Component.name})`;
  
  return WrappedComponent;
}