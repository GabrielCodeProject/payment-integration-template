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

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      setIsLoading(true);
      setError(null);

      const response = await fetch("/api/admin/users?stats=true");
      
      if (!response.ok) {
        throw new Error(`Failed to fetch stats: ${response.status}`);
      }

      const data = await response.json();
      
      if (data.success) {
        setStats(data.data);
      } else {
        throw new Error(data.error || "Failed to fetch statistics");
      }
    } catch (err) {
      console.error("Error fetching admin stats:", err);
      setError(err instanceof Error ? err.message : "Failed to load statistics");
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
            onClick={fetchStats}
            className="mt-3 text-sm text-primary hover:underline"
          >
            Try again
          </button>
        </CardContent>
      </Card>
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
            <div className="text-2xl font-bold">{stats?.totalUsers.toLocaleString()}</div>
          )}
          <div className="flex items-center gap-2 mt-2">
            {isLoading ? (
              <Skeleton className="h-4 w-20" />
            ) : (
              <>
                <Badge variant="secondary" className="text-xs">
                  {stats?.activeUsers} active
                </Badge>
                {stats && stats.activeUsers > 0 && (
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
            <div className="text-2xl font-bold">{stats?.newUsersToday}</div>
          )}
          <div className="flex items-center gap-2 mt-2">
            {isLoading ? (
              <Skeleton className="h-4 w-24" />
            ) : (
              <>
                <TrendingUp className="size-3 text-green-500" />
                <span className="text-xs text-muted-foreground">
                  {stats?.newUsersThisWeek} this week
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
              {stats?.roleDistribution && Object.entries(stats.roleDistribution).map(([role, count]) => (
                <div key={role} className="flex items-center justify-between">
                  <RoleBadge 
                    role={role as UserRole} 
                    size="sm" 
                    showPermissionTooltip={false}
                  />
                  <span className="text-sm font-medium">{count}</span>
                </div>
              ))}
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
                    {stats?.recentActivity.successfulLogins}
                  </span>
                </div>
                
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs">
                    <AlertTriangle className="size-3 text-red-500" />
                    <span className="text-muted-foreground">Failed attempts</span>
                  </div>
                  <span className="text-sm font-medium">
                    {stats?.recentActivity.failedLogins}
                  </span>
                </div>
                
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs">
                    <Clock className="size-3 text-blue-500" />
                    <span className="text-muted-foreground">Total actions</span>
                  </div>
                  <span className="text-sm font-medium">
                    {stats?.recentActivity.totalActions}
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