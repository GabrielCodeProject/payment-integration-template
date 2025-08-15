"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { PermissionGuard, usePermissions } from "./PermissionGuard";
import { RoleBadge } from "./RoleBadge";
import { PERMISSIONS } from "@/lib/permissions";
import {
  LayoutDashboard,
  Users,
  Settings,
  Shield,
  BarChart3,
  Activity,
  FileText,
  AlertTriangle,
  ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface NavigationItem {
  name: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  permission?: string;
  description?: string;
  badge?: string;
}

interface NavigationSection {
  name: string;
  items: NavigationItem[];
}

/**
 * AdminNavigation Component
 * 
 * Role-aware navigation sidebar for admin interface.
 * Shows different navigation options based on user permissions.
 */
export function AdminNavigation() {
  const pathname = usePathname();
  const { user, userRole, checkPermission } = usePermissions();

  const navigationSections: NavigationSection[] = [
    {
      name: "Overview",
      items: [
        {
          name: "Dashboard",
          href: "/admin",
          icon: LayoutDashboard,
          description: "Admin dashboard overview",
        },
        {
          name: "Analytics",
          href: "/admin/analytics",
          icon: BarChart3,
          permission: PERMISSIONS.SYSTEM_MONITOR,
          description: "System analytics and metrics",
        },
      ],
    },
    {
      name: "User Management",
      items: [
        {
          name: "All Users",
          href: "/admin/users",
          icon: Users,
          permission: PERMISSIONS.USER_READ,
          description: "Manage user accounts",
        },
        {
          name: "Roles & Permissions",
          href: "/admin/roles",
          icon: Shield,
          permission: PERMISSIONS.ROLE_VIEW,
          description: "Role management",
        },
      ],
    },
    {
      name: "System",
      items: [
        {
          name: "Activity Logs",
          href: "/admin/audit",
          icon: Activity,
          permission: PERMISSIONS.AUDIT_READ,
          description: "System audit logs",
        },
        {
          name: "Reports",
          href: "/admin/reports",
          icon: FileText,
          permission: PERMISSIONS.AUDIT_EXPORT,
          description: "Generate reports",
        },
        {
          name: "Settings",
          href: "/admin/settings",
          icon: Settings,
          permission: PERMISSIONS.SYSTEM_CONFIG,
          description: "System configuration",
        },
      ],
    },
  ];

  const isActiveLink = (href: string) => {
    if (href === "/admin") {
      return pathname === href;
    }
    return pathname.startsWith(href);
  };

  const hasPermissionForItem = (item: NavigationItem) => {
    if (!item.permission) return true;
    return checkPermission(item.permission as any);
  };

  const getVisibleItemsCount = (section: NavigationSection) => {
    return section.items.filter(hasPermissionForItem).length;
  };

  if (!user) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="animate-pulse space-y-4">
            <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded" />
            <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-3/4" />
            <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-1/2" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* User Info Card */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-sm font-medium">Admin Panel</CardTitle>
              <p className="text-xs text-muted-foreground mt-1">
                Logged in as {user.name || user.email}
              </p>
            </div>
            <RoleBadge role={userRole!} size="sm" />
          </div>
        </CardHeader>
      </Card>

      {/* Navigation Sections */}
      <Card>
        <CardContent className="p-0">
          <nav className="space-y-1">
            {navigationSections.map((section, sectionIndex) => {
              const visibleItemsCount = getVisibleItemsCount(section);
              
              // Don't render section if no items are visible
              if (visibleItemsCount === 0) return null;

              return (
                <div key={section.name}>
                  {sectionIndex > 0 && <Separator />}
                  
                  <div className="p-3">
                    <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                      {section.name}
                    </h3>
                    
                    <div className="space-y-1">
                      {section.items.map((item) => {
                        // Check permission for each item
                        if (!hasPermissionForItem(item)) return null;

                        const isActive = isActiveLink(item.href);
                        const Icon = item.icon;

                        return (
                          <Link
                            key={item.name}
                            href={item.href}
                            className={cn(
                              "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
                              "hover:bg-accent hover:text-accent-foreground",
                              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                              isActive
                                ? "bg-accent text-accent-foreground font-medium"
                                : "text-muted-foreground"
                            )}
                          >
                            <Icon className="size-4 shrink-0" />
                            <span className="flex-1 truncate">{item.name}</span>
                            {item.badge && (
                              <Badge variant="secondary" className="text-xs">
                                {item.badge}
                              </Badge>
                            )}
                            {isActive && (
                              <ChevronRight className="size-4 shrink-0" />
                            )}
                          </Link>
                        );
                      })}
                    </div>
                  </div>
                </div>
              );
            })}
          </nav>
        </CardContent>
      </Card>

      {/* Quick Actions Card */}
      <PermissionGuard anyPermissions={[PERMISSIONS.USER_READ, PERMISSIONS.SYSTEM_MONITOR]}>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Quick Actions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <PermissionGuard permission={PERMISSIONS.USER_READ}>
              <Link
                href="/admin/users?filter=new"
                className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                <Users className="size-3" />
                View New Users
              </Link>
            </PermissionGuard>
            
            <PermissionGuard permission={PERMISSIONS.AUDIT_READ}>
              <Link
                href="/admin/audit?filter=recent"
                className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                <Activity className="size-3" />
                Recent Activity
              </Link>
            </PermissionGuard>
            
            <PermissionGuard permission={PERMISSIONS.SYSTEM_MONITOR}>
              <Link
                href="/admin/analytics"
                className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                <BarChart3 className="size-3" />
                System Health
              </Link>
            </PermissionGuard>
          </CardContent>
        </Card>
      </PermissionGuard>

      {/* System Status Card */}
      <PermissionGuard permission={PERMISSIONS.SYSTEM_MONITOR}>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <div className="size-2 bg-green-500 rounded-full animate-pulse" />
              System Status
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">API Status</span>
              <span className="text-green-600 dark:text-green-400">Healthy</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">Database</span>
              <span className="text-green-600 dark:text-green-400">Connected</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">Cache</span>
              <span className="text-green-600 dark:text-green-400">Active</span>
            </div>
          </CardContent>
        </Card>
      </PermissionGuard>
    </div>
  );
}