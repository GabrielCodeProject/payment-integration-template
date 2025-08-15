import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { PermissionGuard } from "@/components/admin/PermissionGuard";
import { UserList } from "@/components/admin/UserList";
import { UserActivityFeed } from "@/components/admin/UserActivityFeed";
import { PERMISSIONS } from "@/lib/permissions";
import { 
  Users, 
  Search, 
  HelpCircle, 
  MessageSquare, 
  Clock,
  AlertTriangle,
  CheckCircle2,
  Info
} from "lucide-react";

export default function SupportDashboardPage() {
  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
          Support Dashboard
        </h1>
        <p className="text-slate-600 dark:text-slate-400 mt-1">
          Customer support tools and user assistance interface.
        </p>
      </div>

      {/* Support Guidelines */}
      <Card className="border-blue-200 bg-blue-50/50 dark:border-blue-800 dark:bg-blue-950/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-blue-900 dark:text-blue-100">
            <Info className="size-5" />
            Support Guidelines
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <p className="text-sm text-blue-800 dark:text-blue-200">
            As a support representative, you have read-only access to customer data and limited administrative functions.
          </p>
          <div className="flex flex-wrap gap-2 mt-3">
            <Badge variant="outline" className="text-blue-700 border-blue-300">
              Read-only access
            </Badge>
            <Badge variant="outline" className="text-blue-700 border-blue-300">
              Customer assistance
            </Badge>
            <Badge variant="outline" className="text-blue-700 border-blue-300">
              Limited admin functions
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-medium">Customer Lookup</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Search and view customer accounts
                </p>
              </div>
              <Search className="size-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-medium">Recent Activity</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Monitor customer actions
                </p>
              </div>
              <Clock className="size-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-medium">Help Documentation</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Access support resources
                </p>
              </div>
              <HelpCircle className="size-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Support Content */}
      <Tabs defaultValue="customers" className="space-y-4">
        <TabsList>
          <TabsTrigger value="customers">Customer Management</TabsTrigger>
          <PermissionGuard permission={PERMISSIONS.AUDIT_READ}>
            <TabsTrigger value="activity">Activity Monitor</TabsTrigger>
          </PermissionGuard>
          <TabsTrigger value="tools">Support Tools</TabsTrigger>
        </TabsList>

        <TabsContent value="customers">
          <PermissionGuard 
            permission={PERMISSIONS.USER_READ}
            fallback={
              <Card>
                <CardContent className="p-6 text-center">
                  <AlertTriangle className="size-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-medium mb-2">Access Restricted</h3>
                  <p className="text-muted-foreground">
                    You don't have permission to view customer data. Please contact an administrator.
                  </p>
                </CardContent>
              </Card>
            }
          >
            <div className="space-y-4">
              {/* Support-specific instructions */}
              <Card className="border-yellow-200 bg-yellow-50/50 dark:border-yellow-800 dark:bg-yellow-950/50">
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="size-5 text-yellow-600 mt-0.5" />
                    <div>
                      <h4 className="font-medium text-yellow-800 dark:text-yellow-200">
                        Support Mode - Read Only
                      </h4>
                      <p className="text-sm text-yellow-700 dark:text-yellow-300 mt-1">
                        You can view customer information to assist with support requests, but cannot modify roles or delete accounts.
                        Use the customer search and filtering tools below to help customers effectively.
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Customer List with Support Context */}
              <UserList 
                initialLimit={10}
                // Could add support-specific filters here
              />
            </div>
          </PermissionGuard>
        </TabsContent>

        <PermissionGuard permission={PERMISSIONS.AUDIT_READ}>
          <TabsContent value="activity">
            <Card>
              <CardHeader>
                <CardTitle>Recent Customer Activity</CardTitle>
              </CardHeader>
              <CardContent>
                <UserActivityFeed 
                  limit={15}
                  actionFilter={["USER_LOGIN", "USER_LOGIN_FAILED", "USER_CREATED"]}
                />
              </CardContent>
            </Card>
          </TabsContent>
        </PermissionGuard>

        <TabsContent value="tools">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Support Resources */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <HelpCircle className="size-5" />
                  Support Resources
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between p-3 rounded-lg border hover:bg-accent transition-colors cursor-pointer">
                  <div>
                    <div className="font-medium">Knowledge Base</div>
                    <div className="text-sm text-muted-foreground">
                      Common questions and solutions
                    </div>
                  </div>
                  <HelpCircle className="size-4 text-muted-foreground" />
                </div>

                <div className="flex items-center justify-between p-3 rounded-lg border hover:bg-accent transition-colors cursor-pointer">
                  <div>
                    <div className="font-medium">Escalation Procedures</div>
                    <div className="text-sm text-muted-foreground">
                      When to escalate to admin team
                    </div>
                  </div>
                  <AlertTriangle className="size-4 text-muted-foreground" />
                </div>

                <div className="flex items-center justify-between p-3 rounded-lg border hover:bg-accent transition-colors cursor-pointer">
                  <div>
                    <div className="font-medium">Contact Templates</div>
                    <div className="text-sm text-muted-foreground">
                      Pre-written responses for common issues
                    </div>
                  </div>
                  <MessageSquare className="size-4 text-muted-foreground" />
                </div>
              </CardContent>
            </Card>

            {/* Quick Actions */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CheckCircle2 className="size-5" />
                  Quick Actions
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <PermissionGuard permission={PERMISSIONS.USER_ACTIVATE}>
                  <div className="flex items-center justify-between p-3 rounded-lg border hover:bg-accent transition-colors cursor-pointer">
                    <div>
                      <div className="font-medium">Account Activation</div>
                      <div className="text-sm text-muted-foreground">
                        Reactivate suspended accounts
                      </div>
                    </div>
                    <CheckCircle2 className="size-4 text-muted-foreground" />
                  </div>
                </PermissionGuard>

                <PermissionGuard permission={PERMISSIONS.ORDER_REFUND}>
                  <div className="flex items-center justify-between p-3 rounded-lg border hover:bg-accent transition-colors cursor-pointer">
                    <div>
                      <div className="font-medium">Process Refunds</div>
                      <div className="text-sm text-muted-foreground">
                        Handle customer refund requests
                      </div>
                    </div>
                    <Clock className="size-4 text-muted-foreground" />
                  </div>
                </PermissionGuard>

                <PermissionGuard permission={PERMISSIONS.SUBSCRIPTION_CANCEL}>
                  <div className="flex items-center justify-between p-3 rounded-lg border hover:bg-accent transition-colors cursor-pointer">
                    <div>
                      <div className="font-medium">Subscription Management</div>
                      <div className="text-sm text-muted-foreground">
                        Cancel or modify subscriptions
                      </div>
                    </div>
                    <Users className="size-4 text-muted-foreground" />
                  </div>
                </PermissionGuard>

                {/* Show message if no permissions */}
                <PermissionGuard 
                  anyPermissions={[
                    PERMISSIONS.USER_ACTIVATE,
                    PERMISSIONS.ORDER_REFUND,
                    PERMISSIONS.SUBSCRIPTION_CANCEL
                  ]}
                  fallback={
                    <div className="text-center py-4">
                      <AlertTriangle className="size-8 text-muted-foreground mx-auto mb-2" />
                      <p className="text-sm text-muted-foreground">
                        No quick actions available with current permissions.
                      </p>
                    </div>
                  }
                />
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}