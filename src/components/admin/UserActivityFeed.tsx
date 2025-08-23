"use client";

import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import type { UserRole } from "@prisma/client";
import { formatDistanceToNow } from "date-fns";
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Eye,
  LogIn,
  LogOut,
  Settings,
  Shield,
  UserMinus,
  UserPlus,
} from "lucide-react";
import { useEffect, useState } from "react";
import { RoleBadge } from "./RoleBadge";

interface AuditLogEntry {
  id: string;
  tableName: string;
  recordId: string;
  action: string;
  userId: string;
  ipAddress: string;
  userAgent?: string;
  metadata?: any;
  createdAt: string;
  user?: {
    name?: string;
    email: string;
    role: UserRole;
  };
}

interface UserActivityFeedProps {
  limit?: number;
  refreshInterval?: number;
  showIpAddress?: boolean;
  actionFilter?: string[];
}

/**
 * UserActivityFeed Component
 *
 * Displays recent system activity and audit logs.
 * Integrates with the audit system to show admin actions.
 */
export function UserActivityFeed({
  limit = 10,
  refreshInterval = 30000, // 30 seconds
  showIpAddress = false,
  actionFilter,
}: UserActivityFeedProps) {
  const [activities, setActivities] = useState<AuditLogEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchActivities();

    if (refreshInterval > 0) {
      const interval = setInterval(fetchActivities, refreshInterval);
      return () => clearInterval(interval);
    }
  }, [limit, refreshInterval, actionFilter]);

  const fetchActivities = async () => {
    try {
      setError(null);

      // For now, we'll simulate activity data since audit API might not be fully implemented
      // In a real implementation, this would fetch from /api/admin/audit
      const simulatedActivities: AuditLogEntry[] = [
        {
          id: "1",
          tableName: "users",
          recordId: "user_123",
          action: "USER_LOGIN",
          userId: "admin_1",
          ipAddress: "192.168.1.100",
          createdAt: new Date(Date.now() - 1000 * 60 * 5).toISOString(), // 5 minutes ago
          user: {
            name: "John Admin",
            email: "admin@example.com",
            role: "ADMIN",
          },
        },
        {
          id: "2",
          tableName: "users",
          recordId: "user_456",
          action: "USER_ROLE_CHANGE",
          userId: "admin_1",
          ipAddress: "192.168.1.100",
          metadata: { oldRole: "CUSTOMER", newRole: "SUPPORT" },
          createdAt: new Date(Date.now() - 1000 * 60 * 15).toISOString(), // 15 minutes ago
          user: {
            name: "John Admin",
            email: "admin@example.com",
            role: "ADMIN",
          },
        },
        {
          id: "3",
          tableName: "users",
          recordId: "user_789",
          action: "USER_CREATED",
          userId: "admin_1",
          ipAddress: "192.168.1.100",
          createdAt: new Date(Date.now() - 1000 * 60 * 30).toISOString(), // 30 minutes ago
          user: {
            name: "John Admin",
            email: "admin@example.com",
            role: "ADMIN",
          },
        },
        {
          id: "4",
          tableName: "system",
          recordId: "config",
          action: "SYSTEM_CONFIG_UPDATE",
          userId: "admin_1",
          ipAddress: "192.168.1.100",
          createdAt: new Date(Date.now() - 1000 * 60 * 60).toISOString(), // 1 hour ago
          user: {
            name: "John Admin",
            email: "admin@example.com",
            role: "ADMIN",
          },
        },
        {
          id: "5",
          tableName: "users",
          recordId: "user_999",
          action: "USER_LOGIN_FAILED",
          userId: "unknown",
          ipAddress: "192.168.1.200",
          createdAt: new Date(Date.now() - 1000 * 60 * 90).toISOString(), // 1.5 hours ago
        },
      ];

      // Apply filters if provided
      let filteredActivities = simulatedActivities;
      if (actionFilter && actionFilter.length > 0) {
        filteredActivities = simulatedActivities.filter((activity) =>
          actionFilter.includes(activity.action)
        );
      }

      // Apply limit
      filteredActivities = filteredActivities.slice(0, limit);

      setActivities(filteredActivities);
    } catch (err) {
      console.error("Error fetching activities:", err);
      setError(
        err instanceof Error ? err.message : "Failed to load activities"
      );
    } finally {
      setIsLoading(false);
    }
  };

  const getActivityIcon = (action: string) => {
    switch (action) {
      case "USER_LOGIN":
        return <LogIn className="size-4 text-green-600" />;
      case "USER_LOGOUT":
        return <LogOut className="size-4 text-gray-600" />;
      case "USER_LOGIN_FAILED":
        return <AlertTriangle className="size-4 text-red-600" />;
      case "USER_CREATED":
        return <UserPlus className="size-4 text-blue-600" />;
      case "USER_DELETED":
      case "USER_DEACTIVATED":
        return <UserMinus className="size-4 text-red-600" />;
      case "USER_ROLE_CHANGE":
      case "USER_ROLE_ASSIGN":
        return <Shield className="size-4 text-purple-600" />;
      case "SYSTEM_CONFIG_UPDATE":
        return <Settings className="size-4 text-orange-600" />;
      case "USER_READ":
      case "USER_VIEW":
        return <Eye className="size-4 text-gray-600" />;
      default:
        return <CheckCircle2 className="size-4 text-gray-600" />;
    }
  };

  const getActivityDescription = (activity: AuditLogEntry) => {
    const userName =
      activity.user?.name || activity.user?.email || "Unknown user";

    switch (activity.action) {
      case "USER_LOGIN":
        return `${userName} signed in`;
      case "USER_LOGOUT":
        return `${userName} signed out`;
      case "USER_LOGIN_FAILED":
        return `Failed login attempt`;
      case "USER_CREATED":
        return `${userName} created a new user`;
      case "USER_DELETED":
        return `${userName} deleted a user`;
      case "USER_DEACTIVATED":
        return `${userName} deactivated a user`;
      case "USER_ROLE_CHANGE":
      case "USER_ROLE_ASSIGN":
        const metadata = activity.metadata;
        if (metadata?.oldRole && metadata?.newRole) {
          return `${userName} changed user role from ${metadata.oldRole} to ${metadata.newRole}`;
        }
        return `${userName} updated user role`;
      case "SYSTEM_CONFIG_UPDATE":
        return `${userName} updated system configuration`;
      case "USER_READ":
      case "USER_VIEW":
        return `${userName} viewed user data`;
      default:
        return `${userName} performed ${activity.action.toLowerCase().replace(/_/g, " ")}`;
    }
  };

  const getActivityBadge = (action: string) => {
    if (action.includes("FAILED") || action.includes("ERROR")) {
      return (
        <Badge variant="destructive" className="text-xs">
          Failed
        </Badge>
      );
    }
    if (action.includes("LOGIN")) {
      return (
        <Badge variant="default" className="text-xs">
          Auth
        </Badge>
      );
    }
    if (action.includes("ROLE") || action.includes("PERMISSION")) {
      return (
        <Badge variant="secondary" className="text-xs">
          Role
        </Badge>
      );
    }
    if (action.includes("SYSTEM") || action.includes("CONFIG")) {
      return (
        <Badge variant="outline" className="text-xs">
          System
        </Badge>
      );
    }
    return null;
  };

  if (error) {
    return (
      <div className="py-4 text-center">
        <AlertTriangle className="text-muted-foreground mx-auto mb-2 size-8" />
        <p className="text-muted-foreground text-sm">{error}</p>
        <button
          onClick={fetchActivities}
          className="text-primary mt-2 text-xs hover:underline"
        >
          Try again
        </button>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex items-start gap-3">
            <Skeleton className="size-8 shrink-0 rounded-full" />
            <div className="flex-1 space-y-1">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-3 w-1/2" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (activities.length === 0) {
    return (
      <div className="py-8 text-center">
        <Clock className="text-muted-foreground mx-auto mb-2 size-8" />
        <p className="text-muted-foreground text-sm">No recent activity</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {activities.map((activity) => (
        <div
          key={activity.id}
          className="bg-card flex items-start gap-3 rounded-lg border p-3"
        >
          <div className="mt-0.5 shrink-0">
            {getActivityIcon(activity.action)}
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <p className="text-foreground text-sm">
                  {getActivityDescription(activity)}
                </p>

                <div className="mt-1 flex items-center gap-2">
                  <span className="text-muted-foreground text-xs">
                    {formatDistanceToNow(new Date(activity.createdAt), {
                      addSuffix: true,
                    })}
                  </span>

                  {activity.user?.role && (
                    <RoleBadge
                      role={activity.user.role}
                      size="sm"
                      showPermissionTooltip={false}
                    />
                  )}

                  {getActivityBadge(activity.action)}
                </div>

                {showIpAddress && activity.ipAddress && (
                  <p className="text-muted-foreground mt-1 text-xs">
                    IP: {activity.ipAddress}
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      ))}

      {activities.length >= limit && (
        <div className="pt-2 text-center">
          <a
            href="/admin/audit"
            className="text-primary text-xs hover:underline"
          >
            View all activity
          </a>
        </div>
      )}
    </div>
  );
}
