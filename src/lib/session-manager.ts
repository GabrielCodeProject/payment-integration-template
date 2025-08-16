/**
 * Advanced Session Management Service for Payment Integration Template
 * 
 * This service provides comprehensive session management capabilities including:
 * - Session enumeration and tracking
 * - Secure session refresh and token rotation
 * - Concurrent session limits and displacement
 * - Security monitoring and audit integration
 * - Background cleanup and maintenance
 */

import { PrismaClient } from "@prisma/client";
import { db } from "./db";
import { auditService, AuditContext } from "./audit";
import { headers } from "next/headers";

// Session management types and interfaces
export interface SessionInfo {
  id: string;
  token: string;
  userId: string;
  expiresAt: Date;
  createdAt: Date;
  updatedAt: Date;
  ipAddress?: string;
  userAgent?: string;
  lastActivityAt?: Date;
  deviceType?: string;
  browser?: string;
  location?: string;
  isCurrent?: boolean;
}

export interface SessionSecurity {
  unusualLocation: boolean;
  unusualDevice: boolean;
  riskScore: number;
  suspicious: boolean;
}

export interface SessionStats {
  totalSessions: number;
  activeSessions: number;
  expiredSessions: number;
  recentLogins: number;
  concurrentLimit: number;
  averageSessionDuration: number;
}

export interface SessionLimits {
  maxConcurrentSessions: number;
  maxSessionDuration: number;
  extendOnActivity: boolean;
  enforceIpValidation: boolean;
  enforceDeviceValidation: boolean;
}

export interface RefreshResult {
  success: boolean;
  newToken?: string;
  expiresAt?: Date;
  rotated: boolean;
  error?: string;
}

export interface SessionCreationOptions {
  ipAddress?: string;
  userAgent?: string;
  deviceFingerprint?: string;
  location?: string;
  maxAge?: number;
  extendable?: boolean;
}

export interface SessionCleanupResult {
  expiredSessions: number;
  displacedSessions: number;
  suspiciousSessions: number;
  totalCleaned: number;
}

/**
 * Advanced Session Management Service
 */
export class SessionManager {
  private db: PrismaClient;
  private defaultLimits: SessionLimits = {
    maxConcurrentSessions: 5,
    maxSessionDuration: 60 * 60 * 24 * 7, // 7 days
    extendOnActivity: true,
    enforceIpValidation: false, // Can be enabled for high-security environments
    enforceDeviceValidation: false,
  };

  constructor(prismaClient?: PrismaClient) {
    this.db = prismaClient || db;
  }

  /**
   * Get all active sessions for a user
   */
  async getUserSessions(
    userId: string,
    options: { 
      includeExpired?: boolean;
      includeSecurity?: boolean;
      currentSessionId?: string;
    } = {}
  ): Promise<SessionInfo[]> {
    try {
      const now = new Date();
      const whereClause = {
        userId,
        ...(options.includeExpired ? {} : { expiresAt: { gt: now } }),
      };

      const sessions = await this.db.session.findMany({
        where: whereClause,
        orderBy: { updatedAt: 'desc' },
      });

      const sessionInfos: SessionInfo[] = sessions.map(session => ({
        id: session.id,
        token: session.token,
        userId: session.userId,
        expiresAt: session.expiresAt,
        createdAt: session.createdAt,
        updatedAt: session.updatedAt,
        ipAddress: session.ipAddress || undefined,
        userAgent: session.userAgent || undefined,
        lastActivityAt: session.updatedAt,
        deviceType: this.parseDeviceType(session.userAgent),
        browser: this.parseBrowser(session.userAgent),
        location: this.parseLocation(session.ipAddress),
        isCurrent: session.id === options.currentSessionId,
      }));

      // Audit the session enumeration
      await auditService.createAuditLog({
        tableName: 'sessions',
        recordId: userId,
        action: 'ACCESS',
        metadata: {
          operation: 'getUserSessions',
          sessionCount: sessionInfos.length,
          includeExpired: options.includeExpired,
        },
      });

      return sessionInfos;
    } catch (error) {
      throw new Error(`Failed to get user sessions: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Refresh a session with token rotation
   */
  async refreshSession(
    sessionId: string,
    options: {
      rotateToken?: boolean;
      extendExpiry?: boolean;
      auditContext?: AuditContext;
    } = {}
  ): Promise<RefreshResult> {
    try {
      const session = await this.db.session.findUnique({
        where: { id: sessionId },
      });

      if (!session) {
        return {
          success: false,
          error: 'Session not found',
          rotated: false,
        };
      }

      const now = new Date();
      if (session.expiresAt <= now) {
        return {
          success: false,
          error: 'Session expired',
          rotated: false,
        };
      }

      const rotateToken = options.rotateToken ?? true;
      const extendExpiry = options.extendExpiry ?? true;

      let newToken = session.token;
      let newExpiresAt = session.expiresAt;

      // Generate new token if rotation is requested
      if (rotateToken) {
        newToken = await this.generateSecureToken();
      }

      // Extend expiry if requested
      if (extendExpiry) {
        newExpiresAt = new Date(now.getTime() + this.defaultLimits.maxSessionDuration * 1000);
      }

      // Update session
      const _updatedSession = await this.db.session.update({
        where: { id: sessionId },
        data: {
          token: newToken,
          expiresAt: newExpiresAt,
          updatedAt: now,
        },
      });

      // Audit the refresh operation
      await auditService.createAuditLog({
        tableName: 'sessions',
        recordId: sessionId,
        action: 'UPDATE',
        oldValues: {
          token: rotateToken ? '[MASKED]' : session.token,
          expiresAt: session.expiresAt,
        },
        newValues: {
          token: rotateToken ? '[MASKED]' : newToken,
          expiresAt: newExpiresAt,
        },
        changedFields: rotateToken ? ['token', 'expiresAt', 'updatedAt'] : ['expiresAt', 'updatedAt'],
        metadata: {
          operation: 'refreshSession',
          tokenRotated: rotateToken,
          expiryExtended: extendExpiry,
          userId: session.userId,
        },
        context: options.auditContext,
      });

      return {
        success: true,
        newToken: rotateToken ? newToken : undefined,
        expiresAt: newExpiresAt,
        rotated: rotateToken,
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to refresh session: ${error instanceof Error ? error.message : 'Unknown error'}`,
        rotated: false,
      };
    }
  }

  /**
   * Terminate a specific session
   */
  async terminateSession(
    sessionId: string,
    options: {
      reason?: string;
      auditContext?: AuditContext;
    } = {}
  ): Promise<boolean> {
    try {
      const session = await this.db.session.findUnique({
        where: { id: sessionId },
      });

      if (!session) {
        return false;
      }

      await this.db.session.delete({
        where: { id: sessionId },
      });

      // Audit the termination
      await auditService.createAuditLog({
        tableName: 'sessions',
        recordId: sessionId,
        action: 'DELETE',
        oldValues: {
          userId: session.userId,
          expiresAt: session.expiresAt,
          ipAddress: session.ipAddress,
          userAgent: session.userAgent,
        },
        metadata: {
          operation: 'terminateSession',
          reason: options.reason || 'manual_termination',
          userId: session.userId,
        },
        context: options.auditContext,
      });

      return true;
    } catch (error) {
      throw new Error(`Failed to terminate session: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Terminate all sessions for a user
   */
  async terminateAllSessions(
    userId: string,
    options: {
      excludeCurrentSession?: string;
      reason?: string;
      auditContext?: AuditContext;
    } = {}
  ): Promise<number> {
    try {
      const whereClause = {
        userId,
        ...(options.excludeCurrentSession ? { id: { not: options.excludeCurrentSession } } : {}),
      };

      // Get sessions before deletion for audit
      const sessionsToDelete = await this.db.session.findMany({
        where: whereClause,
        select: { id: true, ipAddress: true, userAgent: true },
      });

      const result = await this.db.session.deleteMany({
        where: whereClause,
      });

      // Audit the bulk termination
      await auditService.createAuditLog({
        tableName: 'sessions',
        recordId: userId,
        action: 'DELETE',
        metadata: {
          operation: 'terminateAllSessions',
          reason: options.reason || 'bulk_termination',
          excludedSessionId: options.excludeCurrentSession,
          terminatedCount: result.count,
          terminatedSessions: sessionsToDelete.map(s => ({
            id: s.id,
            ipAddress: s.ipAddress,
            userAgent: s.userAgent,
          })),
        },
        context: options.auditContext,
      });

      return result.count;
    } catch (error) {
      throw new Error(`Failed to terminate all sessions: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Enforce session limits and displace old sessions if necessary
   */
  async enforceSessionLimits(
    userId: string,
    limits?: Partial<SessionLimits>,
    auditContext?: AuditContext
  ): Promise<SessionCleanupResult> {
    try {
      const effectiveLimits = { ...this.defaultLimits, ...limits };
      const now = new Date();

      // Get all active sessions for the user
      const activeSessions = await this.db.session.findMany({
        where: {
          userId,
          expiresAt: { gt: now },
        },
        orderBy: { updatedAt: 'asc' }, // Oldest first for displacement
      });

      let displacedSessions = 0;
      let expiredSessions = 0;
      let suspiciousSessions = 0;

      // Clean up expired sessions first
      const expiredResult = await this.db.session.deleteMany({
        where: {
          userId,
          expiresAt: { lte: now },
        },
      });
      expiredSessions = expiredResult.count;

      // Enforce concurrent session limits
      if (activeSessions.length > effectiveLimits.maxConcurrentSessions) {
        const sessionsToDisplace = activeSessions.slice(
          0,
          activeSessions.length - effectiveLimits.maxConcurrentSessions
        );

        for (const session of sessionsToDisplace) {
          await this.terminateSession(session.id, {
            reason: 'session_limit_enforcement',
            auditContext,
          });
          displacedSessions++;
        }
      }

      // Check for suspicious sessions (if security monitoring is enabled)
      if (effectiveLimits.enforceIpValidation || effectiveLimits.enforceDeviceValidation) {
        for (const session of activeSessions) {
          const security = await this.evaluateSessionSecurity(session);
          if (security.suspicious && security.riskScore > 0.7) {
            await this.terminateSession(session.id, {
              reason: 'suspicious_activity',
              auditContext,
            });
            suspiciousSessions++;
          }
        }
      }

      const result: SessionCleanupResult = {
        expiredSessions,
        displacedSessions,
        suspiciousSessions,
        totalCleaned: expiredSessions + displacedSessions + suspiciousSessions,
      };

      // Audit the enforcement action
      await auditService.createAuditLog({
        tableName: 'sessions',
        recordId: userId,
        action: 'UPDATE',
        metadata: {
          operation: 'enforceSessionLimits',
          limits: effectiveLimits,
          result,
        },
        context: auditContext,
      });

      return result;
    } catch (error) {
      throw new Error(`Failed to enforce session limits: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get session statistics for a user
   */
  async getSessionStats(userId: string): Promise<SessionStats> {
    try {
      const now = new Date();
      const last24Hours = new Date(now.getTime() - 24 * 60 * 60 * 1000);

      const [
        totalSessions,
        activeSessions,
        expiredSessions,
        recentLogins,
        avgDurationResult
      ] = await Promise.all([
        this.db.session.count({ where: { userId } }),
        this.db.session.count({ where: { userId, expiresAt: { gt: now } } }),
        this.db.session.count({ where: { userId, expiresAt: { lte: now } } }),
        this.db.session.count({ where: { userId, createdAt: { gte: last24Hours } } }),
        this.db.session.aggregate({
          where: { userId },
          _avg: { updatedAt: true },
        }),
      ]);

      return {
        totalSessions,
        activeSessions,
        expiredSessions,
        recentLogins,
        concurrentLimit: this.defaultLimits.maxConcurrentSessions,
        averageSessionDuration: this.calculateAverageSessionDuration(avgDurationResult._avg.updatedAt),
      };
    } catch (error) {
      throw new Error(`Failed to get session stats: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Create a new session with advanced tracking
   */
  async createSession(
    userId: string,
    options: SessionCreationOptions = {}
  ): Promise<SessionInfo> {
    try {
      const now = new Date();
      const expiresAt = new Date(
        now.getTime() + (options.maxAge || this.defaultLimits.maxSessionDuration) * 1000
      );

      const token = await this.generateSecureToken();

      const session = await this.db.session.create({
        data: {
          token,
          userId,
          expiresAt,
          ipAddress: options.ipAddress,
          userAgent: options.userAgent,
        },
      });

      // Enforce session limits after creating new session
      await this.enforceSessionLimits(userId);

      // Audit session creation
      await auditService.createAuditLog({
        tableName: 'sessions',
        recordId: session.id,
        action: 'CREATE',
        newValues: {
          userId,
          expiresAt,
          ipAddress: options.ipAddress,
          userAgent: options.userAgent,
        },
        metadata: {
          operation: 'createSession',
          deviceType: this.parseDeviceType(options.userAgent),
          browser: this.parseBrowser(options.userAgent),
          location: this.parseLocation(options.ipAddress),
        },
      });

      return {
        id: session.id,
        token: session.token,
        userId: session.userId,
        expiresAt: session.expiresAt,
        createdAt: session.createdAt,
        updatedAt: session.updatedAt,
        ipAddress: session.ipAddress || undefined,
        userAgent: session.userAgent || undefined,
        lastActivityAt: session.updatedAt,
        deviceType: this.parseDeviceType(options.userAgent),
        browser: this.parseBrowser(options.userAgent),
        location: this.parseLocation(options.ipAddress),
        isCurrent: true,
      };
    } catch (error) {
      throw new Error(`Failed to create session: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Background cleanup of expired sessions
   */
  async cleanupExpiredSessions(): Promise<SessionCleanupResult> {
    try {
      const now = new Date();

      const expiredResult = await this.db.session.deleteMany({
        where: {
          expiresAt: { lte: now },
        },
      });

      const result: SessionCleanupResult = {
        expiredSessions: expiredResult.count,
        displacedSessions: 0,
        suspiciousSessions: 0,
        totalCleaned: expiredResult.count,
      };

      // Audit cleanup operation
      await auditService.createAuditLog({
        tableName: 'sessions',
        recordId: 'system',
        action: 'DELETE',
        metadata: {
          operation: 'cleanupExpiredSessions',
          result,
          automated: true,
        },
      });

      return result;
    } catch (error) {
      throw new Error(`Failed to cleanup expired sessions: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Validate session security and detect anomalies
   */
  private async evaluateSessionSecurity(session: {
    id: string;
    userId: string;
    ipAddress?: string | null;
    userAgent?: string | null;
  }): Promise<SessionSecurity> {
    try {
      // Get user's historical sessions for comparison
      const userSessions = await this.db.session.findMany({
        where: {
          userId: session.userId,
          id: { not: session.id },
        },
        select: {
          ipAddress: true,
          userAgent: true,
        },
        take: 10,
        orderBy: { createdAt: 'desc' },
      });

      let riskScore = 0;
      let unusualLocation = false;
      let unusualDevice = false;

      // Check for unusual IP address
      if (session.ipAddress) {
        const knownIps = userSessions
          .map(s => s.ipAddress)
          .filter(Boolean);
        
        if (knownIps.length > 0 && !knownIps.includes(session.ipAddress)) {
          unusualLocation = true;
          riskScore += 0.3;
        }
      }

      // Check for unusual user agent
      if (session.userAgent) {
        const knownUserAgents = userSessions
          .map(s => s.userAgent)
          .filter(Boolean);
        
        if (knownUserAgents.length > 0 && !knownUserAgents.includes(session.userAgent)) {
          unusualDevice = true;
          riskScore += 0.2;
        }
      }

      return {
        unusualLocation,
        unusualDevice,
        riskScore,
        suspicious: riskScore > 0.5,
      };
    } catch (_error) {
      // Return safe defaults if security evaluation fails
      return {
        unusualLocation: false,
        unusualDevice: false,
        riskScore: 0,
        suspicious: false,
      };
    }
  }

  /**
   * Generate a secure session token
   */
  private async generateSecureToken(): Promise<string> {
    // Use crypto.randomUUID() for secure token generation
    return `sess_${crypto.randomUUID().replace(/-/g, '')}${Date.now().toString(36)}`;
  }

  /**
   * Parse device type from user agent
   */
  private parseDeviceType(userAgent?: string | null): string {
    if (!userAgent) return 'Unknown';
    
    const ua = userAgent.toLowerCase();
    if (ua.includes('mobile') || ua.includes('android') || ua.includes('iphone')) {
      return 'Mobile';
    } else if (ua.includes('tablet') || ua.includes('ipad')) {
      return 'Tablet';
    } else {
      return 'Desktop';
    }
  }

  /**
   * Parse browser from user agent
   */
  private parseBrowser(userAgent?: string | null): string {
    if (!userAgent) return 'Unknown';
    
    const ua = userAgent.toLowerCase();
    if (ua.includes('chrome')) return 'Chrome';
    if (ua.includes('firefox')) return 'Firefox';
    if (ua.includes('safari')) return 'Safari';
    if (ua.includes('edge')) return 'Edge';
    if (ua.includes('opera')) return 'Opera';
    
    return 'Other';
  }

  /**
   * Parse location from IP address (placeholder - would integrate with GeoIP service)
   */
  private parseLocation(ipAddress?: string | null): string {
    if (!ipAddress) return 'Unknown';
    
    // In production, you would integrate with a GeoIP service
    // For now, return a placeholder
    return 'Unknown Location';
  }

  /**
   * Calculate average session duration
   */
  private calculateAverageSessionDuration(avgUpdatedAt?: Date | null): number {
    // This is a simplified calculation
    // In production, you might track actual session start/end times
    return avgUpdatedAt ? Math.floor(Date.now() - avgUpdatedAt.getTime()) / 1000 : 0;
  }
}

// Rate limiting for session operations
export class SessionRateLimiter {
  private static readonly LIMITS = {
    refreshSession: { windowMs: 60 * 1000, maxAttempts: 10 }, // 10 per minute
    terminateSession: { windowMs: 60 * 1000, maxAttempts: 20 }, // 20 per minute
    getUserSessions: { windowMs: 60 * 1000, maxAttempts: 30 }, // 30 per minute
  };

  private static attemptCounts = new Map<string, { count: number; resetTime: number }>();

  static async checkRateLimit(
    operation: keyof typeof SessionRateLimiter.LIMITS,
    identifier: string
  ): Promise<{ allowed: boolean; retryAfter?: number }> {
    const limit = this.LIMITS[operation];
    const key = `${operation}:${identifier}`;
    const now = Date.now();

    const existing = this.attemptCounts.get(key);
    
    if (!existing || now > existing.resetTime) {
      // First attempt or window has reset
      this.attemptCounts.set(key, {
        count: 1,
        resetTime: now + limit.windowMs,
      });
      return { allowed: true };
    }

    if (existing.count >= limit.maxAttempts) {
      // Rate limit exceeded
      return {
        allowed: false,
        retryAfter: Math.ceil((existing.resetTime - now) / 1000),
      };
    }

    // Increment count
    existing.count++;
    return { allowed: true };
  }

  // Cleanup old entries periodically
  static cleanup(): void {
    const now = Date.now();
    for (const [key, data] of this.attemptCounts.entries()) {
      if (now > data.resetTime) {
        this.attemptCounts.delete(key);
      }
    }
  }
}

// Create default session manager instance
export const sessionManager = new SessionManager();

// Helper function to get current session from headers
export async function getCurrentSession(): Promise<SessionInfo | null> {
  try {
    const headersList = headers();
    const authHeader = headersList.get('authorization');
    const cookieHeader = headersList.get('cookie');

    // Try to get session token from auth header or cookie
    let sessionToken: string | null = null;

    if (authHeader?.startsWith('Bearer ')) {
      sessionToken = authHeader.substring(7);
    } else if (cookieHeader) {
      // Parse session token from cookie (BetterAuth format)
      const sessionCookie = cookieHeader
        .split(';')
        .find(c => c.trim().startsWith('better-auth.session_token='));
      
      if (sessionCookie) {
        sessionToken = sessionCookie.split('=')[1];
      }
    }

    if (!sessionToken) {
      return null;
    }

    // Find session in database
    const session = await db.session.findUnique({
      where: { token: sessionToken },
      include: { user: true },
    });

    if (!session || session.expiresAt <= new Date()) {
      return null;
    }

    return {
      id: session.id,
      token: session.token,
      userId: session.userId,
      expiresAt: session.expiresAt,
      createdAt: session.createdAt,
      updatedAt: session.updatedAt,
      ipAddress: session.ipAddress || undefined,
      userAgent: session.userAgent || undefined,
      lastActivityAt: session.updatedAt,
      isCurrent: true,
    };
  } catch (_error) {
    return null;
  }
}

// Export types for external use
export type {
  SessionInfo,
  SessionSecurity,
  SessionStats,
  SessionLimits,
  RefreshResult,
  SessionCreationOptions,
  SessionCleanupResult,
};