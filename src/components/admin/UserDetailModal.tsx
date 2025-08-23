"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { RoleBadge } from "./RoleBadge";
import { RoleAssignmentForm } from "./RoleAssignmentForm";
import { PermissionGuard } from "./PermissionGuard";
import { PERMISSIONS } from "@/lib/permissions";
import {
  User,
  Shield,
  Activity,
  CreditCard,
  Package,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Edit,
} from "lucide-react";
import { formatDistanceToNow, format } from "date-fns";
import type { UserRole } from "@prisma/client";

interface UserDetailModalProps {
  user: {
    id: string;
    email: string;
    name?: string;
    role: UserRole;
    isActive: boolean;
    emailVerified: boolean;
    createdAt: string;
    lastLoginAt?: string;
    phone?: string;
  };
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUserUpdated?: () => void;
}

interface DetailedUser {
  id: string;
  email: string;
  name?: string;
  role: UserRole;
  isActive: boolean;
  emailVerified: boolean;
  createdAt: string;
  lastLoginAt?: string;
  phone?: string;
  timezone?: string;
  preferredCurrency?: string;
  orders?: Array<{
    id: string;
    status: string;
    total: number;
    createdAt: string;
  }>;
  payments?: Array<{
    id: string;
    amount: number;
    status: string;
    createdAt: string;
  }>;
  subscriptions?: Array<{
    id: string;
    status: string;
    planName: string;
    createdAt: string;
  }>;
  loginHistory?: Array<{
    timestamp: string;
    ipAddress: string;
    success: boolean;
  }>;
}

/**
 * UserDetailModal Component
 * 
 * Displays comprehensive user information including personal details,
 * order history, payment information, and admin actions.
 */
export function UserDetailModal({
  user,
  open,
  onOpenChange,
  onUserUpdated,
}: UserDetailModalProps) {
  const [detailedUser, setDetailedUser] = useState<DetailedUser | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showRoleForm, setShowRoleForm] = useState(false);

  useEffect(() => {
    if (open && user) {
      fetchDetailedUser();
    }
  }, [open, user]);

  const fetchDetailedUser = async () => {
    try {
      setIsLoading(true);
      setError(null);

      const response = await fetch(`/api/admin/users/${user.id}`);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch user details: ${response.status}`);
      }

      const data = await response.json();
      
      if (data.success) {
        setDetailedUser(data.data);
      } else {
        throw new Error(data.error || "Failed to fetch user details");
      }
    } catch (err) {
      // console.error("Error fetching user details:", err);
      setError(err instanceof Error ? err.message : "Failed to load user details");
    } finally {
      setIsLoading(false);
    }
  };

  const handleRoleUpdate = async () => {
    // Refresh user data after role update
    await fetchDetailedUser();
    if (onUserUpdated) {
      onUserUpdated();
    }
    setShowRoleForm(false);
  };

  const getStatusIcon = (status: string) => {
    switch (status.toLowerCase()) {
      case "active":
      case "completed":
      case "paid":
      case "success":
        return <CheckCircle2 className="size-4 text-green-600" />;
      case "pending":
      case "processing":
        return <Clock className="size-4 text-yellow-600" />;
      case "failed":
      case "cancelled":
      case "inactive":
        return <AlertTriangle className="size-4 text-red-600" />;
      default:
        return <Clock className="size-4 text-gray-600" />;
    }
  };

  const formatCurrency = (amount: number, currency = "USD") => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
    }).format(amount / 100); // Assuming amounts are in cents
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <div className="size-10 bg-primary/10 rounded-full flex items-center justify-center">
              <User className="size-5 text-primary" />
            </div>
            <div>
              <div>{user.name || "No name"}</div>
              <div className="text-sm text-muted-foreground font-normal">
                {user.email}
              </div>
            </div>
            <RoleBadge role={user.role} />
          </DialogTitle>
          <DialogDescription>
            View and manage user account details, orders, and permissions.
          </DialogDescription>
        </DialogHeader>

        {error && (
          <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4">
            <p className="text-destructive text-sm">{error}</p>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={fetchDetailedUser}
              className="mt-2"
            >
              Try Again
            </Button>
          </div>
        )}

        <Tabs defaultValue="overview" className="space-y-4">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="orders">Orders</TabsTrigger>
            <TabsTrigger value="payments">Payments</TabsTrigger>
            <TabsTrigger value="activity">Activity</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Personal Information */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <User className="size-5" />
                    Personal Information
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {isLoading ? (
                    <div className="space-y-3">
                      {Array.from({ length: 6 }).map((_, i) => (
                        <div key={i} className="flex justify-between">
                          <Skeleton className="h-4 w-20" />
                          <Skeleton className="h-4 w-32" />
                        </div>
                      ))}
                    </div>
                  ) : (
                    <>
                      <div className="flex justify-between">
                        <span className="text-sm text-muted-foreground">Name:</span>
                        <span className="text-sm font-medium">
                          {detailedUser?.name || "Not provided"}
                        </span>
                      </div>
                      
                      <div className="flex justify-between">
                        <span className="text-sm text-muted-foreground">Email:</span>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium">{detailedUser?.email}</span>
                          {detailedUser?.emailVerified ? (
                            <CheckCircle2 className="size-4 text-green-600" />
                          ) : (
                            <AlertTriangle className="size-4 text-yellow-600" />
                          )}
                        </div>
                      </div>
                      
                      <div className="flex justify-between">
                        <span className="text-sm text-muted-foreground">Phone:</span>
                        <span className="text-sm font-medium">
                          {detailedUser?.phone || "Not provided"}
                        </span>
                      </div>
                      
                      <div className="flex justify-between">
                        <span className="text-sm text-muted-foreground">Timezone:</span>
                        <span className="text-sm font-medium">
                          {detailedUser?.timezone || "UTC"}
                        </span>
                      </div>
                      
                      <div className="flex justify-between">
                        <span className="text-sm text-muted-foreground">Currency:</span>
                        <span className="text-sm font-medium">
                          {detailedUser?.preferredCurrency?.toUpperCase() || "USD"}
                        </span>
                      </div>
                      
                      <div className="flex justify-between">
                        <span className="text-sm text-muted-foreground">Status:</span>
                        <Badge variant={detailedUser?.isActive ? "default" : "secondary"}>
                          {detailedUser?.isActive ? "Active" : "Inactive"}
                        </Badge>
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>

              {/* Account Details */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Shield className="size-5" />
                    Account Details
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {isLoading ? (
                    <div className="space-y-3">
                      {Array.from({ length: 4 }).map((_, i) => (
                        <div key={i} className="flex justify-between">
                          <Skeleton className="h-4 w-24" />
                          <Skeleton className="h-4 w-28" />
                        </div>
                      ))}
                    </div>
                  ) : (
                    <>
                      <div className="flex justify-between">
                        <span className="text-sm text-muted-foreground">Role:</span>
                        <div className="flex items-center gap-2">
                          <RoleBadge role={detailedUser?.role || user.role} size="sm" />
                          <PermissionGuard permission={PERMISSIONS.ROLE_ASSIGN}>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setShowRoleForm(true)}
                            >
                              <Edit className="size-3" />
                            </Button>
                          </PermissionGuard>
                        </div>
                      </div>
                      
                      <div className="flex justify-between">
                        <span className="text-sm text-muted-foreground">Created:</span>
                        <span className="text-sm font-medium">
                          {format(new Date(detailedUser?.createdAt || user.createdAt), "PPp")}
                        </span>
                      </div>
                      
                      <div className="flex justify-between">
                        <span className="text-sm text-muted-foreground">Last Login:</span>
                        <span className="text-sm font-medium">
                          {detailedUser?.lastLoginAt 
                            ? formatDistanceToNow(new Date(detailedUser.lastLoginAt), { addSuffix: true })
                            : "Never"
                          }
                        </span>
                      </div>
                      
                      <div className="flex justify-between">
                        <span className="text-sm text-muted-foreground">Account Age:</span>
                        <span className="text-sm font-medium">
                          {formatDistanceToNow(new Date(detailedUser?.createdAt || user.createdAt))}
                        </span>
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Quick Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-2xl font-bold">
                        {isLoading ? <Skeleton className="h-8 w-8" /> : detailedUser?.orders?.length || 0}
                      </p>
                      <p className="text-sm text-muted-foreground">Total Orders</p>
                    </div>
                    <Package className="size-8 text-muted-foreground" />
                  </div>
                </CardContent>
              </Card>
              
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-2xl font-bold">
                        {isLoading ? <Skeleton className="h-8 w-16" /> : 
                          detailedUser?.payments?.reduce((sum, p) => sum + p.amount, 0) 
                            ? formatCurrency(detailedUser.payments.reduce((sum, p) => sum + p.amount, 0))
                            : "$0.00"
                        }
                      </p>
                      <p className="text-sm text-muted-foreground">Total Spent</p>
                    </div>
                    <CreditCard className="size-8 text-muted-foreground" />
                  </div>
                </CardContent>
              </Card>
              
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-2xl font-bold">
                        {isLoading ? <Skeleton className="h-8 w-8" /> : detailedUser?.subscriptions?.length || 0}
                      </p>
                      <p className="text-sm text-muted-foreground">Subscriptions</p>
                    </div>
                    <Activity className="size-8 text-muted-foreground" />
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="orders">
            <Card>
              <CardHeader>
                <CardTitle>Order History</CardTitle>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="space-y-3">
                    {Array.from({ length: 3 }).map((_, i) => (
                      <div key={i} className="flex items-center justify-between p-3 border rounded">
                        <div className="space-y-1">
                          <Skeleton className="h-4 w-24" />
                          <Skeleton className="h-3 w-32" />
                        </div>
                        <Skeleton className="h-6 w-16" />
                      </div>
                    ))}
                  </div>
                ) : detailedUser?.orders?.length ? (
                  <div className="space-y-3">
                    {detailedUser.orders.map((order) => (
                      <div key={order.id} className="flex items-center justify-between p-3 border rounded">
                        <div className="flex items-center gap-3">
                          {getStatusIcon(order.status)}
                          <div>
                            <div className="font-medium">Order #{order.id.slice(-8)}</div>
                            <div className="text-sm text-muted-foreground">
                              {format(new Date(order.createdAt), "PPp")}
                            </div>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="font-medium">{formatCurrency(order.total)}</div>
                          <Badge variant="outline">{order.status}</Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    No orders found
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="payments">
            <Card>
              <CardHeader>
                <CardTitle>Payment History</CardTitle>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="space-y-3">
                    {Array.from({ length: 3 }).map((_, i) => (
                      <div key={i} className="flex items-center justify-between p-3 border rounded">
                        <Skeleton className="h-4 w-32" />
                        <Skeleton className="h-6 w-20" />
                      </div>
                    ))}
                  </div>
                ) : detailedUser?.payments?.length ? (
                  <div className="space-y-3">
                    {detailedUser.payments.map((payment) => (
                      <div key={payment.id} className="flex items-center justify-between p-3 border rounded">
                        <div className="flex items-center gap-3">
                          {getStatusIcon(payment.status)}
                          <div>
                            <div className="font-medium">Payment #{payment.id.slice(-8)}</div>
                            <div className="text-sm text-muted-foreground">
                              {format(new Date(payment.createdAt), "PPp")}
                            </div>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="font-medium">{formatCurrency(payment.amount)}</div>
                          <Badge variant="outline">{payment.status}</Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    No payments found
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="activity">
            <Card>
              <CardHeader>
                <CardTitle>Login History</CardTitle>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="space-y-3">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <div key={i} className="flex items-center justify-between p-3 border rounded">
                        <Skeleton className="h-4 w-40" />
                        <Skeleton className="h-6 w-20" />
                      </div>
                    ))}
                  </div>
                ) : detailedUser?.loginHistory?.length ? (
                  <div className="space-y-3">
                    {detailedUser.loginHistory.map((login, index) => (
                      <div key={index} className="flex items-center justify-between p-3 border rounded">
                        <div className="flex items-center gap-3">
                          {login.success ? (
                            <CheckCircle2 className="size-4 text-green-600" />
                          ) : (
                            <AlertTriangle className="size-4 text-red-600" />
                          )}
                          <div>
                            <div className="font-medium">
                              {login.success ? "Successful login" : "Failed login attempt"}
                            </div>
                            <div className="text-sm text-muted-foreground">
                              {format(new Date(login.timestamp), "PPp")} • {login.ipAddress}
                            </div>
                          </div>
                        </div>
                        <Badge variant={login.success ? "default" : "destructive"}>
                          {login.success ? "Success" : "Failed"}
                        </Badge>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    No login history available
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Role Assignment Form */}
        {showRoleForm && detailedUser && (
          <RoleAssignmentForm
            user={detailedUser}
            open={showRoleForm}
            onOpenChange={setShowRoleForm}
            onRoleUpdated={handleRoleUpdate}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}