"use client";

import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { getRolePermissions } from "@/lib/permissions";
import type { UserRole } from "@prisma/client";
import { Shield, ShieldCheck, Crown } from "lucide-react";

interface RoleBadgeProps {
  role: UserRole;
  showPermissionTooltip?: boolean;
  showIcon?: boolean;
  size?: "sm" | "default" | "lg";
  className?: string;
}

/**
 * RoleBadge Component
 * 
 * Displays a role badge with appropriate color coding and optional permission tooltips.
 * Provides visual role indicators with hover information about permissions.
 */
export function RoleBadge({
  role,
  showPermissionTooltip = true,
  showIcon = true,
  size = "default",
  className = "",
}: RoleBadgeProps) {
  const getRoleConfig = (role: UserRole) => {
    switch (role) {
      case "ADMIN":
        return {
          variant: "destructive" as const,
          icon: Crown,
          description: "Full system administrator with all privileges",
          bgColor: "bg-red-100 dark:bg-red-900/30",
          textColor: "text-red-700 dark:text-red-300",
          borderColor: "border-red-200 dark:border-red-800",
        };
      case "SUPPORT":
        return {
          variant: "default" as const,
          icon: ShieldCheck,
          description: "Customer support with limited administrative access",
          bgColor: "bg-blue-100 dark:bg-blue-900/30",
          textColor: "text-blue-700 dark:text-blue-300",
          borderColor: "border-blue-200 dark:border-blue-800",
        };
      case "CUSTOMER":
        return {
          variant: "secondary" as const,
          icon: Shield,
          description: "Standard user with access to personal account features",
          bgColor: "bg-gray-100 dark:bg-gray-900/30",
          textColor: "text-gray-700 dark:text-gray-300",
          borderColor: "border-gray-200 dark:border-gray-800",
        };
      default:
        return {
          variant: "outline" as const,
          icon: Shield,
          description: "Unknown role",
          bgColor: "bg-gray-100 dark:bg-gray-900/30",
          textColor: "text-gray-700 dark:text-gray-300",
          borderColor: "border-gray-200 dark:border-gray-800",
        };
    }
  };

  const config = getRoleConfig(role);
  const Icon = config.icon;
  const permissions = getRolePermissions(role);

  const sizeClasses = {
    sm: "text-xs px-1.5 py-0.5",
    default: "text-xs px-2 py-0.5",
    lg: "text-sm px-3 py-1",
  };

  const iconSizes = {
    sm: "size-3",
    default: "size-3",
    lg: "size-4",
  };

  const BadgeContent = (
    <Badge
      variant={config.variant}
      className={`
        inline-flex items-center gap-1.5 font-medium
        ${sizeClasses[size]}
        ${className}
      `}
    >
      {showIcon && <Icon className={iconSizes[size]} />}
      <span className="capitalize">{role.toLowerCase()}</span>
    </Badge>
  );

  if (!showPermissionTooltip) {
    return BadgeContent;
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        {BadgeContent}
      </TooltipTrigger>
      <TooltipContent side="bottom" className="max-w-sm">
        <div className="space-y-2">
          <div className="font-semibold">{role} Role</div>
          <div className="text-xs text-muted-foreground">
            {config.description}
          </div>
          <div className="space-y-1">
            <div className="text-xs font-medium">Permissions ({permissions.length}):</div>
            <div className="grid grid-cols-1 gap-0.5 text-xs text-muted-foreground max-h-32 overflow-y-auto">
              {permissions.slice(0, 8).map((permission) => (
                <div key={permission} className="truncate">
                  • {permission.replace(/[_:]/g, " ").toLowerCase()}
                </div>
              ))}
              {permissions.length > 8 && (
                <div className="text-xs text-muted-foreground/70 italic">
                  +{permissions.length - 8} more permissions...
                </div>
              )}
            </div>
          </div>
        </div>
      </TooltipContent>
    </Tooltip>
  );
}

/**
 * RoleIndicator Component
 * 
 * Simple role indicator without badge styling, used in compact layouts
 */
export function RoleIndicator({
  role,
  showIcon = true,
  className = "",
}: {
  role: UserRole;
  showIcon?: boolean;
  className?: string;
}) {
  const getRoleConfig = (role: UserRole) => {
    switch (role) {
      case "ADMIN":
        return {
          icon: Crown,
          color: "text-red-600 dark:text-red-400",
        };
      case "SUPPORT":
        return {
          icon: ShieldCheck,
          color: "text-blue-600 dark:text-blue-400",
        };
      case "CUSTOMER":
        return {
          icon: Shield,
          color: "text-gray-600 dark:text-gray-400",
        };
      default:
        return {
          icon: Shield,
          color: "text-gray-600 dark:text-gray-400",
        };
    }
  };

  const config = getRoleConfig(role);
  const Icon = config.icon;

  return (
    <div className={`inline-flex items-center gap-1.5 text-sm ${config.color} ${className}`}>
      {showIcon && <Icon className="size-4" />}
      <span className="capitalize font-medium">{role.toLowerCase()}</span>
    </div>
  );
}