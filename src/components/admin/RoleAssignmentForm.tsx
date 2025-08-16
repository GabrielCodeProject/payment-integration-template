"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { RoleBadge } from "./RoleBadge";
import { usePermissions } from "./PermissionGuard";
import {
  ROLES,
  PERMISSIONS,
  getRolePermissions,
  canManageRole,
  validateRoleTransition,
  PERMISSION_GROUPS,
} from "@/lib/permissions";
import {
  Shield,
  AlertTriangle,
  CheckCircle2,
  ArrowRight,
  Users,
  Crown,
  ShieldCheck,
  Loader2,
} from "lucide-react";
import type { UserRole } from "@prisma/client";

interface RoleAssignmentFormProps {
  user: {
    id: string;
    email: string;
    name?: string;
    role: UserRole;
  };
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onRoleUpdated?: () => void;
}

/**
 * RoleAssignmentForm Component
 * 
 * Secure role assignment interface with permission preview and validation.
 * Includes role transition validation and security risk assessment.
 */
export function RoleAssignmentForm({
  user,
  open,
  onOpenChange,
  onRoleUpdated,
}: RoleAssignmentFormProps) {
  const { userRole, checkPermission } = usePermissions();
  const [selectedRole, setSelectedRole] = useState<UserRole>(user.role);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Validate if current user can assign the selected role
  const canAssignRole = canManageRole(userRole!, selectedRole);
  const roleTransition = validateRoleTransition(user.role, selectedRole, userRole!);
  
  // Get permissions for selected role
  const selectedRolePermissions = getRolePermissions(selectedRole);
  const currentRolePermissions = getRolePermissions(user.role);
  
  // Calculate permission changes
  const addedPermissions = selectedRolePermissions.filter(
    p => !currentRolePermissions.includes(p)
  );
  const removedPermissions = currentRolePermissions.filter(
    p => !selectedRolePermissions.includes(p)
  );

  const handleRoleUpdate = async () => {
    if (!canAssignRole || !roleTransition.allowed) {
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      const response = await fetch(`/api/admin/users/${user.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          role: selectedRole,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `Failed to update role: ${response.status}`);
      }

      const data = await response.json();
      
      if (!data.success) {
        throw new Error(data.error || "Failed to update role");
      }

      // Success - close modal and refresh data
      onOpenChange(false);
      if (onRoleUpdated) {
        onRoleUpdated();
      }
    } catch (err) {
      console.error("Error updating role:", err);
      setError(err instanceof Error ? err.message : "Failed to update role");
    } finally {
      setIsLoading(false);
    }
  };

  const getRoleIcon = (role: UserRole) => {
    switch (role) {
      case "ADMIN":
        return Crown;
      case "SUPPORT":
        return ShieldCheck;
      case "CUSTOMER":
        return Users;
      default:
        return Shield;
    }
  };

  const getRoleDescription = (role: UserRole) => {
    switch (role) {
      case "ADMIN":
        return "Full system access with all administrative privileges including user management, role assignment, and system configuration.";
      case "SUPPORT":
        return "Customer support access with read-only permissions for user data and limited administrative functions for customer assistance.";
      case "CUSTOMER":
        return "Standard user access to personal account, orders, payments, and subscriptions.";
      default:
        return "Unknown role";
    }
  };

  const getSecurityRiskColor = (risk: string) => {
    switch (risk) {
      case "HIGH":
        return "text-red-600 bg-red-50 border-red-200";
      case "MEDIUM":
        return "text-yellow-600 bg-yellow-50 border-yellow-200";
      case "LOW":
        return "text-green-600 bg-green-50 border-green-200";
      default:
        return "text-gray-600 bg-gray-50 border-gray-200";
    }
  };

  // Get available roles that the current user can assign
  const availableRoles = Object.values(ROLES).filter(role => 
    canManageRole(userRole!, role)
  );

  if (!checkPermission(PERMISSIONS.ROLE_ASSIGN)) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Insufficient Permissions</DialogTitle>
            <DialogDescription>
              You don&apos;t have permission to assign roles to users.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="size-5" />
            Update User Role
          </DialogTitle>
          <DialogDescription>
            Change the role for <strong>{user.name || user.email}</strong>. 
            This will immediately update their access permissions.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Current vs New Role */}
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <label className="text-sm font-medium text-muted-foreground">Current Role</label>
              <div className="mt-1">
                <RoleBadge role={user.role} />
              </div>
            </div>
            
            <ArrowRight className="size-5 text-muted-foreground" />
            
            <div className="flex-1">
              <label className="text-sm font-medium text-muted-foreground">New Role</label>
              <div className="mt-1">
                <Select 
                  value={selectedRole} 
                  onValueChange={(value) => setSelectedRole(value as UserRole)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {availableRoles.map((role) => {
                      const Icon = getRoleIcon(role);
                      const canAssign = canManageRole(userRole!, role);
                      
                      return (
                        <SelectItem 
                          key={role} 
                          value={role}
                          disabled={!canAssign}
                        >
                          <div className="flex items-center gap-2">
                            <Icon className="size-4" />
                            <span className="capitalize">{role.toLowerCase()}</span>
                            {!canAssign && (
                              <Badge variant="outline" className="text-xs">
                                Restricted
                              </Badge>
                            )}
                          </div>
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* Role Description */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <div className="flex items-center gap-2">
                  {React.createElement(getRoleIcon(selectedRole), { className: "size-4" })}
                  <span className="capitalize">{selectedRole.toLowerCase()} Role</span>
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                {getRoleDescription(selectedRole)}
              </p>
            </CardContent>
          </Card>

          {/* Security Risk Assessment */}
          {roleTransition.securityRisk && (
            <Alert className={getSecurityRiskColor(roleTransition.securityRisk)}>
              <AlertTriangle className="size-4" />
              <AlertDescription>
                <strong>Security Risk: {roleTransition.securityRisk}</strong>
                {roleTransition.securityRisk === "HIGH" && (
                  <span className="block mt-1">
                    This role change grants significant privileges. Ensure this user is authorized for administrative access.
                  </span>
                )}
                {roleTransition.securityRisk === "MEDIUM" && (
                  <span className="block mt-1">
                    This role change increases user privileges. Verify this elevation is appropriate.
                  </span>
                )}
              </AlertDescription>
            </Alert>
          )}

          {/* Permission Changes */}
          {(addedPermissions.length > 0 || removedPermissions.length > 0) && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Added Permissions */}
              {addedPermissions.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm flex items-center gap-2 text-green-600">
                      <CheckCircle2 className="size-4" />
                      Permissions Added ({addedPermissions.length})
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-1 max-h-32 overflow-y-auto">
                      {addedPermissions.map((permission) => (
                        <div key={permission} className="text-xs text-muted-foreground">
                          + {permission.replace(/[_:]/g, " ").toLowerCase()}
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Removed Permissions */}
              {removedPermissions.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm flex items-center gap-2 text-red-600">
                      <AlertTriangle className="size-4" />
                      Permissions Removed ({removedPermissions.length})
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-1 max-h-32 overflow-y-auto">
                      {removedPermissions.map((permission) => (
                        <div key={permission} className="text-xs text-muted-foreground">
                          - {permission.replace(/[_:]/g, " ").toLowerCase()}
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          )}

          {/* Permission Groups Preview */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Permission Groups for {selectedRole}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-2">
                {Object.entries(PERMISSION_GROUPS).map(([groupName, permissions]) => {
                  const hasAnyPermission = permissions.some(p => 
                    selectedRolePermissions.includes(p)
                  );
                  const hasAllPermissions = permissions.every(p => 
                    selectedRolePermissions.includes(p)
                  );
                  
                  if (!hasAnyPermission) return null;
                  
                  return (
                    <div key={groupName} className="flex items-center gap-2">
                      <Badge 
                        variant={hasAllPermissions ? "default" : "secondary"}
                        className="text-xs"
                      >
                        {groupName.replace(/_/g, " ")}
                      </Badge>
                      {hasAllPermissions ? (
                        <CheckCircle2 className="size-3 text-green-600" />
                      ) : (
                        <div className="size-3 rounded-full bg-yellow-500" />
                      )}
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* Error Display */}
          {error && (
            <Alert className="border-destructive">
              <AlertTriangle className="size-4" />
              <AlertDescription className="text-destructive">
                {error}
              </AlertDescription>
            </Alert>
          )}

          {/* Authorization Check */}
          {!canAssignRole && (
            <Alert className="border-destructive">
              <AlertTriangle className="size-4" />
              <AlertDescription className="text-destructive">
                You don&apos;t have permission to assign the {selectedRole} role.
              </AlertDescription>
            </Alert>
          )}
        </div>

        <DialogFooter>
          <Button 
            variant="outline" 
            onClick={() => onOpenChange(false)}
            disabled={isLoading}
          >
            Cancel
          </Button>
          <Button
            onClick={handleRoleUpdate}
            disabled={
              !canAssignRole || 
              !roleTransition.allowed || 
              selectedRole === user.role ||
              isLoading
            }
          >
            {isLoading ? (
              <>
                <Loader2 className="size-4 mr-2 animate-spin" />
                Updating...
              </>
            ) : (
              "Update Role"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}