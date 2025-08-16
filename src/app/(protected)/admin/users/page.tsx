import { UserList } from "@/components/admin/UserList";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PermissionGuard } from "@/components/admin/PermissionGuard";
import { PERMISSIONS } from "@/lib/permissions";
import { Users, Shield, AlertTriangle, Info } from "lucide-react";

export default function AdminUsersPage() {
  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
            User Management
          </h1>
          <p className="text-slate-600 dark:text-slate-400 mt-1">
            Manage user accounts, roles, and permissions across the platform.
          </p>
        </div>
        
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-xs">
            Admin Access
          </Badge>
          <Shield className="size-4 text-muted-foreground" />
        </div>
      </div>

      {/* Admin Guidelines */}
      <PermissionGuard permission={PERMISSIONS.USER_WRITE}>
        <Card className="border-blue-200 bg-blue-50/50 dark:border-blue-800 dark:bg-blue-950/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-blue-900 dark:text-blue-100">
              <Info className="size-5" />
              Administrative Guidelines
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <p className="text-sm text-blue-800 dark:text-blue-200">
              As an administrator, you have full access to user management functions. Please exercise caution when modifying user roles or deactivating accounts.
            </p>
            <div className="flex flex-wrap gap-2 mt-3">
              <Badge variant="outline" className="text-blue-700 border-blue-300">
                Full user access
              </Badge>
              <Badge variant="outline" className="text-blue-700 border-blue-300">
                Role management
              </Badge>
              <Badge variant="outline" className="text-blue-700 border-blue-300">
                Account controls
              </Badge>
            </div>
          </CardContent>
        </Card>
      </PermissionGuard>

      {/* User Management Interface */}
      <PermissionGuard 
        permission={PERMISSIONS.USER_READ}
        fallback={
          <Card>
            <CardContent className="p-8 text-center">
              <AlertTriangle className="size-16 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-xl font-medium mb-2">Access Restricted</h3>
              <p className="text-muted-foreground mb-4">
                You don&apos;t have permission to view user management interface.
              </p>
              <p className="text-sm text-muted-foreground">
                Contact a system administrator to request USER_READ permissions.
              </p>
            </CardContent>
          </Card>
        }
      >
        <UserList />
      </PermissionGuard>

      {/* Usage Tips */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Users className="size-5" />
            User Management Tips
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div className="space-y-2">
              <h4 className="font-medium">Search & Filtering</h4>
              <ul className="space-y-1 text-muted-foreground">
                <li>• Use the search bar to find users by name or email</li>
                <li>• Filter by role to focus on specific user types</li>
                <li>• Toggle between active and inactive accounts</li>
                <li>• Adjust items per page for better navigation</li>
              </ul>
            </div>
            
            <div className="space-y-2">
              <h4 className="font-medium">User Actions</h4>
              <ul className="space-y-1 text-muted-foreground">
                <li>• Click the eye icon to view detailed user information</li>
                <li>• Use activate/deactivate to manage account status</li>
                <li>• Role changes require confirmation and audit logging</li>
                <li>• All actions are tracked in the system audit log</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}