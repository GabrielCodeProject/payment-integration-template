/**
 * User Management Service
 * 
 * Secure service layer for user management operations with comprehensive
 * audit logging, role-based access control, and security validations.
 */

import { db, secureTransaction } from "@/lib/db";
import { hasPermission, canManageRole, validateRoleTransition, PERMISSIONS } from "@/lib/permissions";
import type { UserRole, User, Prisma } from "@prisma/client";

/**
 * User query options for pagination and filtering
 */
export interface UserQueryOptions {
  page?: number;
  limit?: number;
  search?: string;
  role?: UserRole;
  isActive?: boolean;
  sortBy?: "createdAt" | "lastLoginAt" | "email" | "name";
  sortOrder?: "asc" | "desc";
}

/**
 * User query result with pagination metadata
 */
export interface UserQueryResult {
  users: Array<Pick<User, "id" | "email" | "name" | "role" | "isActive" | "createdAt" | "lastLoginAt" | "stripeCustomerId">>;
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

/**
 * User update data interface
 */
export interface UserUpdateData {
  name?: string;
  email?: string;
  role?: UserRole;
  isActive?: boolean;
  phone?: string;
  timezone?: string;
  preferredCurrency?: string;
}

/**
 * Audit context for user operations
 */
export interface AuditContext {
  adminUserId: string;
  adminRole: UserRole;
  ipAddress?: string;
  userAgent?: string;
  action: string;
  sessionId?: string;
}

/**
 * User management service with security and audit logging
 */
export class UserManagementService {
  /**
   * Get paginated list of users with filtering
   */
  static async getUsers(
    options: UserQueryOptions = {},
    auditContext: Pick<AuditContext, "adminUserId" | "adminRole">
  ): Promise<UserQueryResult> {
    // Verify admin has permission to read users
    if (!hasPermission(auditContext.adminRole, PERMISSIONS.USER_READ)) {
      throw new Error("Insufficient permissions to read users");
    }

    const {
      page = 1,
      limit = 20,
      search,
      role,
      isActive,
      sortBy = "createdAt",
      sortOrder = "desc",
    } = options;

    // Validate pagination parameters
    if (page < 1 || limit < 1 || limit > 100) {
      throw new Error("Invalid pagination parameters");
    }

    // Build search filters
    const where: Prisma.UserWhereInput = {};

    if (search) {
      where.OR = [
        { email: { contains: search, mode: "insensitive" } },
        { name: { contains: search, mode: "insensitive" } },
      ];
    }

    if (role) {
      where.role = role;
    }

    if (isActive !== undefined) {
      where.isActive = isActive;
    }

    // Calculate pagination
    const skip = (page - 1) * limit;

    try {
      // Execute query with pagination
      const [users, total] = await Promise.all([
        db.user.findMany({
          where,
          select: {
            id: true,
            email: true,
            name: true,
            role: true,
            isActive: true,
            createdAt: true,
            lastLoginAt: true,
            stripeCustomerId: true,
          },
          skip,
          take: limit,
          orderBy: { [sortBy]: sortOrder },
        }),
        db.user.count({ where }),
      ]);

      // Create audit log entry
      await this.createAuditLog({
        action: "USER_LIST_QUERY",
        adminUserId: auditContext.adminUserId,
        adminRole: auditContext.adminRole,
        metadata: {
          queryOptions: options,
          resultCount: users.length,
          totalCount: total,
        },
      });

      const totalPages = Math.ceil(total / limit);

      return {
        users,
        pagination: {
          page,
          limit,
          total,
          totalPages,
          hasNext: page < totalPages,
          hasPrev: page > 1,
        },
      };
    } catch (error) {
      // Log error for security monitoring
      console.error("[USER_MANAGEMENT] Query error:", error);
      throw new Error("Failed to retrieve users");
    }
  }

  /**
   * Get detailed user information by ID
   */
  static async getUserById(
    userId: string,
    auditContext: Pick<AuditContext, "adminUserId" | "adminRole">
  ): Promise<User | null> {
    // Verify admin has permission to read users
    if (!hasPermission(auditContext.adminRole, PERMISSIONS.USER_READ)) {
      throw new Error("Insufficient permissions to read user details");
    }

    try {
      const user = await db.user.findUnique({
        where: { id: userId },
        include: {
          orders: {
            select: { id: true, total: true, status: true, createdAt: true },
            orderBy: { createdAt: "desc" },
            take: 5,
          },
          subscriptions: {
            select: { id: true, status: true, currentPeriodEnd: true },
            where: { status: { in: ["ACTIVE", "TRIALING", "PAST_DUE"] } },
          },
          _count: {
            select: {
              orders: true,
              subscriptions: true,
              paymentMethods: true,
            },
          },
        },
      });

      // Create audit log entry
      await this.createAuditLog({
        action: "USER_DETAIL_VIEW",
        adminUserId: auditContext.adminUserId,
        adminRole: auditContext.adminRole,
        targetUserId: userId,
        metadata: {
          userFound: !!user,
        },
      });

      return user;
    } catch (error) {
      console.error("[USER_MANAGEMENT] Get user error:", error);
      throw new Error("Failed to retrieve user");
    }
  }

  /**
   * Update user information with security validation
   */
  static async updateUser(
    userId: string,
    updateData: UserUpdateData,
    auditContext: AuditContext
  ): Promise<User> {
    // Get current user data for comparison
    const currentUser = await db.user.findUnique({
      where: { id: userId },
    });

    if (!currentUser) {
      throw new Error("User not found");
    }

    // Security validations
    if (updateData.role && updateData.role !== currentUser.role) {
      // Verify admin can assign the new role
      if (!canManageRole(auditContext.adminRole, updateData.role)) {
        throw new Error(`Insufficient permissions to assign role ${updateData.role}`);
      }

      // Validate role transition
      const transition = validateRoleTransition(
        currentUser.role,
        updateData.role,
        auditContext.adminRole
      );

      if (!transition.allowed) {
        throw new Error(transition.reason || "Role transition not allowed");
      }

      // Log high-risk transitions
      if (transition.securityRisk === "HIGH") {
        console.warn("[SECURITY] High-risk role transition:", {
          userId,
          from: currentUser.role,
          to: updateData.role,
          adminUserId: auditContext.adminUserId,
        });
      }
    }

    // Check write permissions
    if (!hasPermission(auditContext.adminRole, PERMISSIONS.USER_WRITE)) {
      throw new Error("Insufficient permissions to update user");
    }

    // Prepare update data
    const updatePayload: Prisma.UserUpdateInput = {};
    const changedFields: string[] = [];

    if (updateData.name !== undefined && updateData.name !== currentUser.name) {
      updatePayload.name = updateData.name;
      changedFields.push("name");
    }

    if (updateData.email !== undefined && updateData.email !== currentUser.email) {
      updatePayload.email = updateData.email;
      updatePayload.emailVerified = false; // Reset email verification
      changedFields.push("email");
    }

    if (updateData.role !== undefined && updateData.role !== currentUser.role) {
      updatePayload.role = updateData.role;
      changedFields.push("role");
    }

    if (updateData.isActive !== undefined && updateData.isActive !== currentUser.isActive) {
      updatePayload.isActive = updateData.isActive;
      changedFields.push("isActive");
    }

    if (updateData.phone !== undefined && updateData.phone !== currentUser.phone) {
      updatePayload.phone = updateData.phone;
      changedFields.push("phone");
    }

    if (updateData.timezone !== undefined && updateData.timezone !== currentUser.timezone) {
      updatePayload.timezone = updateData.timezone;
      changedFields.push("timezone");
    }

    if (updateData.preferredCurrency !== undefined && updateData.preferredCurrency !== currentUser.preferredCurrency) {
      updatePayload.preferredCurrency = updateData.preferredCurrency;
      changedFields.push("preferredCurrency");
    }

    // Only proceed if there are changes
    if (changedFields.length === 0) {
      return currentUser;
    }

    updatePayload.updatedAt = new Date();

    try {
      // Execute update in transaction with audit logging
      const updatedUser = await secureTransaction(async (prisma) => {
        // Update user
        const user = await prisma.user.update({
          where: { id: userId },
          data: updatePayload,
        });

        // Create detailed audit log
        await prisma.auditLog.create({
          data: {
            tableName: "users",
            recordId: userId,
            action: "UPDATE",
            userId: auditContext.adminUserId,
            userEmail: currentUser.email,
            ipAddress: auditContext.ipAddress || null,
            userAgent: auditContext.userAgent || null,
            oldValues: {
              name: currentUser.name,
              email: currentUser.email,
              role: currentUser.role,
              isActive: currentUser.isActive,
              phone: currentUser.phone,
              timezone: currentUser.timezone,
              preferredCurrency: currentUser.preferredCurrency,
            },
            newValues: updateData as any,
            changedFields,
            sessionId: auditContext.sessionId || null,
            metadata: {
              adminRole: auditContext.adminRole,
              action: auditContext.action,
            },
          },
        });

        return user;
      });

      console.log("[USER_MANAGEMENT] User updated:", {
        userId,
        changedFields,
        adminUserId: auditContext.adminUserId,
      });

      return updatedUser;
    } catch (error) {
      console.error("[USER_MANAGEMENT] Update error:", error);
      throw new Error("Failed to update user");
    }
  }

  /**
   * Deactivate user account (soft delete)
   */
  static async deactivateUser(
    userId: string,
    auditContext: AuditContext
  ): Promise<User> {
    // Verify admin has permission to deactivate users
    if (!hasPermission(auditContext.adminRole, PERMISSIONS.USER_DEACTIVATE)) {
      throw new Error("Insufficient permissions to deactivate user");
    }

    const currentUser = await db.user.findUnique({
      where: { id: userId },
    });

    if (!currentUser) {
      throw new Error("User not found");
    }

    if (!currentUser.isActive) {
      throw new Error("User is already deactivated");
    }

    // Prevent self-deactivation
    if (userId === auditContext.adminUserId) {
      throw new Error("Cannot deactivate your own account");
    }

    try {
      const updatedUser = await secureTransaction(async (prisma) => {
        // Deactivate user
        const user = await prisma.user.update({
          where: { id: userId },
          data: {
            isActive: false,
            updatedAt: new Date(),
          },
        });

        // Invalidate all active sessions
        await prisma.session.deleteMany({
          where: { userId },
        });

        // Create audit log
        await prisma.auditLog.create({
          data: {
            tableName: "users",
            recordId: userId,
            action: "DEACTIVATE",
            userId: auditContext.adminUserId,
            userEmail: currentUser.email,
            ipAddress: auditContext.ipAddress || null,
            userAgent: auditContext.userAgent || null,
            oldValues: { isActive: true },
            newValues: { isActive: false },
            changedFields: ["isActive"],
            sessionId: auditContext.sessionId || null,
            metadata: {
              adminRole: auditContext.adminRole,
              action: auditContext.action,
            },
          },
        });

        return user;
      });

      console.log("[USER_MANAGEMENT] User deactivated:", {
        userId,
        adminUserId: auditContext.adminUserId,
      });

      return updatedUser;
    } catch (error) {
      console.error("[USER_MANAGEMENT] Deactivation error:", error);
      throw new Error("Failed to deactivate user");
    }
  }

  /**
   * Activate user account
   */
  static async activateUser(
    userId: string,
    auditContext: AuditContext
  ): Promise<User> {
    // Verify admin has permission to activate users
    if (!hasPermission(auditContext.adminRole, PERMISSIONS.USER_ACTIVATE)) {
      throw new Error("Insufficient permissions to activate user");
    }

    const currentUser = await db.user.findUnique({
      where: { id: userId },
    });

    if (!currentUser) {
      throw new Error("User not found");
    }

    if (currentUser.isActive) {
      throw new Error("User is already active");
    }

    try {
      const updatedUser = await secureTransaction(async (prisma) => {
        // Activate user
        const user = await prisma.user.update({
          where: { id: userId },
          data: {
            isActive: true,
            updatedAt: new Date(),
          },
        });

        // Create audit log
        await prisma.auditLog.create({
          data: {
            tableName: "users",
            recordId: userId,
            action: "ACTIVATE",
            userId: auditContext.adminUserId,
            userEmail: currentUser.email,
            ipAddress: auditContext.ipAddress || null,
            userAgent: auditContext.userAgent || null,
            oldValues: { isActive: false },
            newValues: { isActive: true },
            changedFields: ["isActive"],
            sessionId: auditContext.sessionId || null,
            metadata: {
              adminRole: auditContext.adminRole,
              action: auditContext.action,
            },
          },
        });

        return user;
      });

      console.log("[USER_MANAGEMENT] User activated:", {
        userId,
        adminUserId: auditContext.adminUserId,
      });

      return updatedUser;
    } catch (error) {
      console.error("[USER_MANAGEMENT] Activation error:", error);
      throw new Error("Failed to activate user");
    }
  }

  /**
   * Get user statistics for dashboard
   */
  static async getUserStatistics(
    auditContext: Pick<AuditContext, "adminUserId" | "adminRole">
  ): Promise<{
    total: number;
    active: number;
    inactive: number;
    byRole: Record<UserRole, number>;
    recentSignups: number;
  }> {
    // Verify admin has permission to read users
    if (!hasPermission(auditContext.adminRole, PERMISSIONS.USER_READ)) {
      throw new Error("Insufficient permissions to view user statistics");
    }

    try {
      const [
        total,
        active,
        roleStats,
        recentSignups,
      ] = await Promise.all([
        db.user.count(),
        db.user.count({ where: { isActive: true } }),
        db.user.groupBy({
          by: ["role"],
          _count: { role: true },
        }),
        db.user.count({
          where: {
            createdAt: {
              gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // Last 7 days
            },
          },
        }),
      ]);

      const byRole: Record<UserRole, number> = {
        ADMIN: 0,
        SUPPORT: 0,
        CUSTOMER: 0,
      };

      roleStats.forEach((stat) => {
        byRole[stat.role] = stat._count.role;
      });

      await this.createAuditLog({
        action: "USER_STATISTICS_VIEW",
        adminUserId: auditContext.adminUserId,
        adminRole: auditContext.adminRole,
        metadata: { total, active },
      });

      return {
        total,
        active,
        inactive: total - active,
        byRole,
        recentSignups,
      };
    } catch (error) {
      console.error("[USER_MANAGEMENT] Statistics error:", error);
      throw new Error("Failed to retrieve user statistics");
    }
  }

  /**
   * Helper method to create audit log entries
   */
  private static async createAuditLog(data: {
    action: string;
    adminUserId: string;
    adminRole: UserRole;
    targetUserId?: string;
    metadata?: Record<string, any>;
  }): Promise<void> {
    try {
      await db.auditLog.create({
        data: {
          tableName: "users",
          recordId: data.targetUserId || data.adminUserId,
          action: data.action,
          userId: data.adminUserId,
          timestamp: new Date(),
          metadata: {
            adminRole: data.adminRole,
            ...data.metadata,
          },
        },
      });
    } catch (error) {
      // Don't throw on audit log failures, but log the error
      console.error("[USER_MANAGEMENT] Audit log error:", error);
    }
  }
}