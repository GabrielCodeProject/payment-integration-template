import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PermissionGuard } from "@/components/admin/PermissionGuard";
import { AdminStats } from "@/components/admin/AdminStats";
import { UserActivityFeed } from "@/components/admin/UserActivityFeed";
import { PERMISSIONS } from "@/lib/permissions";
import { Users, Shield, BarChart3, Activity } from "lucide-react";

export default function AdminDashboardPage() {
  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
          Admin Dashboard
        </h1>
        <p className="text-slate-600 dark:text-slate-400 mt-1">
          Manage users, monitor system activity, and configure platform settings.
        </p>
      </div>

      {/* Quick Stats Cards */}
      <PermissionGuard permission={PERMISSIONS.USER_READ}>
        <AdminStats />
      </PermissionGuard>

      {/* Main Dashboard Content */}
      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <PermissionGuard permission={PERMISSIONS.USER_READ}>
            <TabsTrigger value="users">User Management</TabsTrigger>
          </PermissionGuard>
          <PermissionGuard permission={PERMISSIONS.AUDIT_READ}>
            <TabsTrigger value="activity">System Activity</TabsTrigger>
          </PermissionGuard>
          <PermissionGuard permission={PERMISSIONS.SYSTEM_MONITOR}>
            <TabsTrigger value="analytics">Analytics</TabsTrigger>
          </PermissionGuard>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Quick Actions */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="size-5" />
                  Quick Actions
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <PermissionGuard permission={PERMISSIONS.USER_READ}>
                  <a
                    href="/admin/users"
                    className="flex items-center justify-between p-3 rounded-lg border hover:bg-accent transition-colors"
                  >
                    <div>
                      <div className="font-medium">Manage Users</div>
                      <div className="text-sm text-muted-foreground">
                        View and manage user accounts
                      </div>
                    </div>
                    <Users className="size-4 text-muted-foreground" />
                  </a>
                </PermissionGuard>

                <PermissionGuard permission={PERMISSIONS.ROLE_VIEW}>
                  <a
                    href="/admin/roles"
                    className="flex items-center justify-between p-3 rounded-lg border hover:bg-accent transition-colors"
                  >
                    <div>
                      <div className="font-medium">Role Management</div>
                      <div className="text-sm text-muted-foreground">
                        Configure roles and permissions
                      </div>
                    </div>
                    <Shield className="size-4 text-muted-foreground" />
                  </a>
                </PermissionGuard>

                <PermissionGuard permission={PERMISSIONS.SYSTEM_MONITOR}>
                  <a
                    href="/admin/analytics"
                    className="flex items-center justify-between p-3 rounded-lg border hover:bg-accent transition-colors"
                  >
                    <div>
                      <div className="font-medium">System Analytics</div>
                      <div className="text-sm text-muted-foreground">
                        View system performance metrics
                      </div>
                    </div>
                    <BarChart3 className="size-4 text-muted-foreground" />
                  </a>
                </PermissionGuard>

                <PermissionGuard permission={PERMISSIONS.AUDIT_READ}>
                  <a
                    href="/admin/audit"
                    className="flex items-center justify-between p-3 rounded-lg border hover:bg-accent transition-colors"
                  >
                    <div>
                      <div className="font-medium">Audit Logs</div>
                      <div className="text-sm text-muted-foreground">
                        Review system activity logs
                      </div>
                    </div>
                    <Activity className="size-4 text-muted-foreground" />
                  </a>
                </PermissionGuard>
              </CardContent>
            </Card>

            {/* Recent Activity */}
            <PermissionGuard permission={PERMISSIONS.AUDIT_READ}>
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Activity className="size-5" />
                    Recent Activity
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <UserActivityFeed limit={5} />
                </CardContent>
              </Card>
            </PermissionGuard>
          </div>

          {/* System Overview */}
          <PermissionGuard permission={PERMISSIONS.SYSTEM_MONITOR}>
            <Card>
              <CardHeader>
                <CardTitle>System Overview</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <div className="text-sm text-muted-foreground">API Status</div>
                    <div className="flex items-center gap-2">
                      <div className="size-2 bg-green-500 rounded-full" />
                      <span className="text-sm font-medium">Operational</span>
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <div className="text-sm text-muted-foreground">Database</div>
                    <div className="flex items-center gap-2">
                      <div className="size-2 bg-green-500 rounded-full" />
                      <span className="text-sm font-medium">Connected</span>
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <div className="text-sm text-muted-foreground">Cache</div>
                    <div className="flex items-center gap-2">
                      <div className="size-2 bg-green-500 rounded-full" />
                      <span className="text-sm font-medium">Active</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </PermissionGuard>
        </TabsContent>

        <PermissionGuard permission={PERMISSIONS.USER_READ}>
          <TabsContent value="users">
            <Card>
              <CardHeader>
                <CardTitle>User Management</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-center py-8">
                  <Users className="size-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-medium mb-2">User Management Interface</h3>
                  <p className="text-muted-foreground mb-4">
                    Detailed user management interface will be available here.
                  </p>
                  <a
                    href="/admin/users"
                    className="inline-flex items-center px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
                  >
                    Go to User Management
                  </a>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </PermissionGuard>

        <PermissionGuard permission={PERMISSIONS.AUDIT_READ}>
          <TabsContent value="activity">
            <Card>
              <CardHeader>
                <CardTitle>System Activity</CardTitle>
              </CardHeader>
              <CardContent>
                <UserActivityFeed />
              </CardContent>
            </Card>
          </TabsContent>
        </PermissionGuard>

        <PermissionGuard permission={PERMISSIONS.SYSTEM_MONITOR}>
          <TabsContent value="analytics">
            <Card>
              <CardHeader>
                <CardTitle>Analytics Dashboard</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-center py-8">
                  <BarChart3 className="size-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-medium mb-2">Analytics Dashboard</h3>
                  <p className="text-muted-foreground">
                    Advanced analytics and reporting features will be available here.
                  </p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </PermissionGuard>
      </Tabs>
    </div>
  );
}