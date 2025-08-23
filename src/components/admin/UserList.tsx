"use client";

import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Pagination, PaginationContent, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious } from "@/components/ui/pagination";
import { Skeleton } from "@/components/ui/skeleton";
import { RoleBadge } from "./RoleBadge";
import { UserDetailModal } from "./UserDetailModal";
import { PermissionGuard } from "./PermissionGuard";
import { PERMISSIONS } from "@/lib/permissions";
import {
  Search,
  Eye,
  UserX,
  UserCheck,
  RefreshCcw,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import type { UserRole } from "@prisma/client";

interface User {
  id: string;
  email: string;
  name?: string;
  role: UserRole;
  isActive: boolean;
  emailVerified: boolean;
  createdAt: string;
  lastLoginAt?: string;
  phone?: string;
}

interface UserListProps {
  initialPage?: number;
  initialLimit?: number;
  initialSearch?: string;
  initialRole?: UserRole;
  initialIsActive?: boolean;
}

interface PaginationInfo {
  currentPage: number;
  totalPages: number;
  totalItems: number;
  itemsPerPage: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

/**
 * UserList Component
 * 
 * Comprehensive user management interface with pagination, search, and filtering.
 * Integrates with the admin API for user data management.
 */
export function UserList({
  initialPage = 1,
  initialLimit = 20,
  initialSearch = "",
  initialRole,
  initialIsActive,
}: UserListProps) {
  const [users, setUsers] = useState<User[]>([]);
  const [pagination, setPagination] = useState<PaginationInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Filters and search
  const [searchTerm, setSearchTerm] = useState(initialSearch);
  const [roleFilter, setRoleFilter] = useState<UserRole | "all">(initialRole || "all");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">(
    initialIsActive !== undefined ? (initialIsActive ? "active" : "inactive") : "all"
  );
  const [currentPage, setCurrentPage] = useState(initialPage);
  const [itemsPerPage, setItemsPerPage] = useState(initialLimit);
  
  // UI state
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [showUserModal, setShowUserModal] = useState(false);

  useEffect(() => {
    fetchUsers();
  }, [searchTerm, roleFilter, statusFilter, currentPage, itemsPerPage]);

  const fetchUsers = async () => {
    try {
      setIsLoading(true);
      setError(null);

      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: itemsPerPage.toString(),
      });

      if (searchTerm) params.append("search", searchTerm);
      if (roleFilter !== "all") params.append("role", roleFilter);
      if (statusFilter !== "all") {
        params.append("isActive", (statusFilter === "active").toString());
      }

      const response = await fetch(`/api/admin/users?${params}`);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch users: ${response.status}`);
      }

      const data = await response.json();
      
      if (data.success) {
        setUsers(data.data);
        setPagination(data.pagination);
      } else {
        throw new Error(data.error || "Failed to fetch users");
      }
    } catch (err) {
      // console.error("Error fetching users:", err);
      setError(err instanceof Error ? err.message : "Failed to load users");
    } finally {
      setIsLoading(false);
    }
  };

  const handleUserAction = async (userId: string, action: "activate" | "deactivate" | "view") => {
    if (action === "view") {
      const user = users.find(u => u.id === userId);
      if (user) {
        setSelectedUser(user);
        setShowUserModal(true);
      }
      return;
    }

    try {
      const endpoint = action === "activate" 
        ? `/api/admin/users/${userId}?action=activate`
        : `/api/admin/users/${userId}`;
      
      const method = action === "activate" ? "PATCH" : "DELETE";
      
      const response = await fetch(endpoint, { method });
      
      if (!response.ok) {
        throw new Error(`Failed to ${action} user`);
      }

      // Refresh the user list
      await fetchUsers();
    } catch (err) {
      // console.error(`Error ${action}ing user:`, err);
      setError(err instanceof Error ? err.message : `Failed to ${action} user`);
    }
  };

  const handleSearchChange = (value: string) => {
    setSearchTerm(value);
    setCurrentPage(1); // Reset to first page when searching
  };

  const handleFilterChange = (field: string, value: string) => {
    if (field === "role") {
      setRoleFilter(value as UserRole | "all");
    } else if (field === "status") {
      setStatusFilter(value as "all" | "active" | "inactive");
    }
    setCurrentPage(1); // Reset to first page when filtering
  };

  const renderPagination = () => {
    if (!pagination || pagination.totalPages <= 1) return null;

    const pages = [];
    const maxVisiblePages = 5;
    const startPage = Math.max(1, currentPage - Math.floor(maxVisiblePages / 2));
    const endPage = Math.min(pagination.totalPages, startPage + maxVisiblePages - 1);

    for (let i = startPage; i <= endPage; i++) {
      pages.push(i);
    }

    return (
      <Pagination className="mt-4">
        <PaginationContent>
          <PaginationItem>
            <PaginationPrevious
              href="#"
              onClick={(e) => {
                e.preventDefault();
                if (pagination.hasPreviousPage) {
                  setCurrentPage(currentPage - 1);
                }
              }}
              className={!pagination.hasPreviousPage ? "pointer-events-none opacity-50" : ""}
            />
          </PaginationItem>
          
          {pages.map((page) => (
            <PaginationItem key={page}>
              <PaginationLink
                href="#"
                isActive={page === currentPage}
                onClick={(e) => {
                  e.preventDefault();
                  setCurrentPage(page);
                }}
              >
                {page}
              </PaginationLink>
            </PaginationItem>
          ))}
          
          <PaginationItem>
            <PaginationNext
              href="#"
              onClick={(e) => {
                e.preventDefault();
                if (pagination.hasNextPage) {
                  setCurrentPage(currentPage + 1);
                }
              }}
              className={!pagination.hasNextPage ? "pointer-events-none opacity-50" : ""}
            />
          </PaginationItem>
        </PaginationContent>
      </Pagination>
    );
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>User Management</CardTitle>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={fetchUsers}
            disabled={isLoading}
          >
            <RefreshCcw className={`size-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </CardHeader>
      
      <CardContent>
        {/* Filters and Search */}
        <div className="flex flex-col sm:flex-row gap-4 mb-6">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 size-4 text-muted-foreground" />
              <Input
                placeholder="Search users by name or email..."
                value={searchTerm}
                onChange={(e) => handleSearchChange(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>
          
          <div className="flex gap-2">
            <Select value={roleFilter} onValueChange={(value) => handleFilterChange("role", value)}>
              <SelectTrigger className="w-32">
                <SelectValue placeholder="Role" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Roles</SelectItem>
                <SelectItem value="ADMIN">Admin</SelectItem>
                <SelectItem value="SUPPORT">Support</SelectItem>
                <SelectItem value="CUSTOMER">Customer</SelectItem>
              </SelectContent>
            </Select>
            
            <Select value={statusFilter} onValueChange={(value) => handleFilterChange("status", value)}>
              <SelectTrigger className="w-32">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Error State */}
        {error && (
          <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4 mb-4">
            <p className="text-destructive text-sm">{error}</p>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={fetchUsers}
              className="mt-2"
            >
              Try Again
            </Button>
          </div>
        )}

        {/* Users Table */}
        <div className="border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>User</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Created</TableHead>
                <TableHead>Last Login</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                // Loading skeleton
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Skeleton className="size-8 rounded-full" />
                        <div className="space-y-1">
                          <Skeleton className="h-4 w-32" />
                          <Skeleton className="h-3 w-24" />
                        </div>
                      </div>
                    </TableCell>
                    <TableCell><Skeleton className="h-6 w-16" /></TableCell>
                    <TableCell><Skeleton className="h-6 w-16" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                    <TableCell className="text-right">
                      <Skeleton className="h-8 w-24 ml-auto" />
                    </TableCell>
                  </TableRow>
                ))
              ) : users.length === 0 ? (
                // Empty state
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8">
                    <div className="text-muted-foreground">
                      {searchTerm || roleFilter !== "all" || statusFilter !== "all" 
                        ? "No users match your filters"
                        : "No users found"
                      }
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                // User rows
                users.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="size-8 bg-primary/10 rounded-full flex items-center justify-center">
                          <span className="text-xs font-medium text-primary">
                            {(user.name?.[0] || user.email[0]).toUpperCase()}
                          </span>
                        </div>
                        <div>
                          <div className="font-medium">{user.name || "No name"}</div>
                          <div className="text-sm text-muted-foreground">{user.email}</div>
                        </div>
                      </div>
                    </TableCell>
                    
                    <TableCell>
                      <RoleBadge role={user.role} size="sm" />
                    </TableCell>
                    
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Badge variant={user.isActive ? "default" : "secondary"}>
                          {user.isActive ? "Active" : "Inactive"}
                        </Badge>
                        {!user.emailVerified && (
                          <Badge variant="outline" className="text-xs">
                            Unverified
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    
                    <TableCell className="text-sm text-muted-foreground">
                      {formatDistanceToNow(new Date(user.createdAt), { addSuffix: true })}
                    </TableCell>
                    
                    <TableCell className="text-sm text-muted-foreground">
                      {user.lastLoginAt 
                        ? formatDistanceToNow(new Date(user.lastLoginAt), { addSuffix: true })
                        : "Never"
                      }
                    </TableCell>
                    
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleUserAction(user.id, "view")}
                        >
                          <Eye className="size-4" />
                        </Button>
                        
                        <PermissionGuard permission={PERMISSIONS.USER_ACTIVATE}>
                          {user.isActive ? (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleUserAction(user.id, "deactivate")}
                            >
                              <UserX className="size-4" />
                            </Button>
                          ) : (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleUserAction(user.id, "activate")}
                            >
                              <UserCheck className="size-4" />
                            </Button>
                          )}
                        </PermissionGuard>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        {/* Pagination */}
        {renderPagination()}

        {/* Results Summary */}
        {pagination && !isLoading && (
          <div className="flex items-center justify-between text-sm text-muted-foreground mt-4">
            <div>
              Showing {((currentPage - 1) * itemsPerPage) + 1} to {Math.min(currentPage * itemsPerPage, pagination.totalItems)} of {pagination.totalItems} users
            </div>
            <div className="flex items-center gap-2">
              <span>Items per page:</span>
              <Select 
                value={itemsPerPage.toString()} 
                onValueChange={(value) => {
                  setItemsPerPage(Number(value));
                  setCurrentPage(1);
                }}
              >
                <SelectTrigger className="w-20 h-8">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="10">10</SelectItem>
                  <SelectItem value="20">20</SelectItem>
                  <SelectItem value="50">50</SelectItem>
                  <SelectItem value="100">100</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        )}
      </CardContent>

      {/* User Detail Modal */}
      {selectedUser && (
        <UserDetailModal
          user={selectedUser}
          open={showUserModal}
          onOpenChange={setShowUserModal}
          onUserUpdated={fetchUsers}
        />
      )}
    </Card>
  );
}