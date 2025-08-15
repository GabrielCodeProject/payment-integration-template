"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { RoleBadge } from "./RoleBadge";
import { PermissionGuard } from "./PermissionGuard";
import { PERMISSIONS } from "@/lib/permissions";
import {
  Users,
  UserPlus,
  Activity,
  TrendingUp,
  Shield,
  AlertTriangle,
  Clock,
  CheckCircle2,
} from "lucide-react";
import type { UserRole } from "@prisma/client";

interface UserStats {
  totalUsers: number;
  activeUsers: number;
  newUsersToday: number;
  newUsersThisWeek: number;
  roleDistribution: Record<UserRole, number>;
  recentActivity: {
    totalActions: number;
    failedLogins: number;
    successfulLogins: number;
  };
}

/**
 * AdminStats Component
 * 
 * Displays key administrative statistics and metrics.
 * Fetches data from the admin API endpoints.
 */
export function AdminStats() {
  const [stats, setStats] = useState<UserStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async (isRetry = false) => {
    try {
      setIsLoading(true);
      setError(null);

      if (isRetry) {
        setRetryCount(prev => prev + 1);
      }

      const response = await fetch("/api/admin/users?stats=true", {
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include', // Include cookies for auth
      });
      
      if (!response.ok) {
        if (response.status === 403) {
          throw new Error("You don't have permission to view these statistics");
        } else if (response.status === 401) {
          throw new Error("Please log in to view statistics");
        } else {
          throw new Error(`Failed to fetch stats (${response.status})`);
        }
      }

      const data = await response.json();
      
      if (data.success && data.data) {
        // Validate and sanitize the data before setting
        const sanitizedStats: UserStats = {
          totalUsers: Number(data.data.totalUsers) || 0,
          activeUsers: Number(data.data.activeUsers) || 0,
          newUsersToday: Number(data.data.newUsersToday) || 0,
          newUsersThisWeek: Number(data.data.newUsersThisWeek) || 0,
          roleDistribution: data.data.roleDistribution || {
            ADMIN: 0,
            SUPPORT: 0,
            CUSTOMER: 0,
          },
          recentActivity: {
            totalActions: Number(data.data.recentActivity?.totalActions) || 0,
            failedLogins: Number(data.data.recentActivity?.failedLogins) || 0,
            successfulLogins: Number(data.data.recentActivity?.successfulLogins) || 0,
          },
        };
        setStats(sanitizedStats);
      } else {
        throw new Error(data.error || "Invalid response format");
      }
    } catch (err) {
      console.error("Error fetching admin stats:", err);
      setError(err instanceof Error ? err.message : "Failed to load statistics");
      
      // Set fallback empty stats to prevent further errors
      setStats({
        totalUsers: 0,
        activeUsers: 0,
        newUsersToday: 0,
        newUsersThisWeek: 0,
        roleDistribution: {
          ADMIN: 0,
          SUPPORT: 0,
          CUSTOMER: 0,
        },
        recentActivity: {
          totalActions: 0,
          failedLogins: 0,
          successfulLogins: 0,
        },
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (error) {
    return (
      <Card className="border-destructive">
        <CardContent className="p-6">
          <div className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="size-5" />
            <span className="font-medium">Failed to load statistics</span>
          </div>
          <p className="text-sm text-muted-foreground mt-2">{error}</p>
          <button
            onClick={() => fetchStats(true)}
            className="mt-3 text-sm text-primary hover:underline disabled:opacity-50"
            disabled={isLoading}
          >
            {isLoading ? "Retrying..." : `Try again${retryCount > 0 ? ` (${retryCount})` : ""}`}
          </button>
        </CardContent>
      </Card>
    );
  }

  // Show loading state for all cards
  if (isLoading && !stats) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <Card key={index}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-4 w-4" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-8 w-16 mb-2" />
              <Skeleton className="h-4 w-24" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {/* Total Users */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Total Users</CardTitle>
          <Users className="size-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <Skeleton className="h-8 w-16" />
          ) : (
            <div className="text-2xl font-bold">
              {stats?.totalUsers?.toLocaleString() ?? '0'}
            </div>
          )}
          <div className="flex items-center gap-2 mt-2">
            {isLoading ? (
              <Skeleton className="h-4 w-20" />
            ) : (
              <>
                <Badge variant="secondary" className="text-xs">
                  {stats?.activeUsers ?? 0} active
                </Badge>
                {stats && stats.activeUsers > 0 && stats.totalUsers > 0 && (
                  <div className="text-xs text-muted-foreground">
                    {Math.round((stats.activeUsers / stats.totalUsers) * 100)}% active
                  </div>
                )}
              </>
            )}
          </div>
        </CardContent>
      </Card>

      {/* New Users Today */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">New Today</CardTitle>
          <UserPlus className="size-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <Skeleton className="h-8 w-12" />
          ) : (
            <div className="text-2xl font-bold">{stats?.newUsersToday ?? 0}</div>
          )}
          <div className="flex items-center gap-2 mt-2">
            {isLoading ? (
              <Skeleton className="h-4 w-24" />
            ) : (
              <>
                <TrendingUp className="size-3 text-green-500" />
                <span className="text-xs text-muted-foreground">
                  {stats?.newUsersThisWeek ?? 0} this week
                </span>
              </>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Role Distribution */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Role Distribution</CardTitle>
          <Shield className="size-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-4 w-1/2" />
            </div>
          ) : (
            <div className="space-y-2">
              {stats?.roleDistribution ? (
                Object.entries(stats.roleDistribution).map(([role, count]) => (
                  <div key={role} className="flex items-center justify-between">
                    <RoleBadge 
                      role={role as UserRole} 
                      size="sm" 
                      showPermissionTooltip={false}
                    />
                    <span className="text-sm font-medium">{count ?? 0}</span>
                  </div>
                ))
              ) : (
                <div className="text-sm text-muted-foreground">No role data available</div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* System Activity */}
      <PermissionGuard permission={PERMISSIONS.AUDIT_READ}>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Recent Activity</CardTitle>
            <Activity className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-2">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-2/3" />
                <Skeleton className="h-4 w-1/2" />
              </div>
            ) : (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs">
                    <CheckCircle2 className="size-3 text-green-500" />
                    <span className="text-muted-foreground">Successful logins</span>
                  </div>
                  <span className="text-sm font-medium">
                    {stats?.recentActivity?.successfulLogins ?? 0}
                  </span>
                </div>
                
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs">
                    <AlertTriangle className="size-3 text-red-500" />
                    <span className="text-muted-foreground">Failed attempts</span>
                  </div>
                  <span className="text-sm font-medium">
                    {stats?.recentActivity?.failedLogins ?? 0}
                  </span>
                </div>
                
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs">
                    <Clock className="size-3 text-blue-500" />
                    <span className="text-muted-foreground">Total actions</span>
                  </div>
                  <span className="text-sm font-medium">
                    {stats?.recentActivity?.totalActions ?? 0}
                  </span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </PermissionGuard>
    </div>
  );
}

/**
 * StatCard Component
 * 
 * Reusable stat card for displaying key metrics
 */
export function StatCard({
  title,
  value,
  icon: Icon,
  description,
  trend,
  isLoading = false,
}: {
  title: string;
  value: string | number;
  icon: React.ComponentType<{ className?: string }>;
  description?: string;
  trend?: {
    value: number;
    label: string;
    positive?: boolean;
  };
  isLoading?: boolean;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <Icon className="size-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <>
            <Skeleton className="h-8 w-16 mb-2" />
            <Skeleton className="h-4 w-24" />
          </>
        ) : (
          <>
            <div className="text-2xl font-bold">{value}</div>
            {(description || trend) && (
              <div className="flex items-center gap-2 mt-2">
                {trend && (
                  <div className={`flex items-center gap-1 text-xs ${
                    trend.positive ? 'text-green-600' : 'text-red-600'
                  }`}>
                    <TrendingUp className={`size-3 ${trend.positive ? '' : 'rotate-180'}`} />
                    <span>{trend.value}%</span>
                  </div>
                )}
                {description && (
                  <span className="text-xs text-muted-foreground">{description}</span>
                )}
                {trend?.label && (
                  <span className="text-xs text-muted-foreground">{trend.label}</span>
                )}
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}