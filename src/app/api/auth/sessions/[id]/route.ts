/**
 * Individual Session Management API
 * /api/auth/sessions/[id]
 * 
 * Provides operations for individual session management:
 * - GET: Get session details
 * - PUT: Update session (extend, modify)
 * - DELETE: Terminate specific session
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth/config';
import { sessionManager, SessionRateLimiter } from '@/lib/session-manager';
import { auditService, AuditHelpers } from '@/lib/audit';
import { db } from '@/lib/db';

interface RouteParams {
  params: {
    id: string;
  };
}

/**
 * GET /api/auth/sessions/[id]
 * Get details for a specific session
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const sessionId = params.id;

    // Get authenticated session
    const session = await auth.api.getSession({
      headers: request.headers,
    });

    if (!session?.user) {
      return NextResponse.json(
        { error: 'Unauthorized', code: 'UNAUTHORIZED' },
        { status: 401 }
      );
    }

    // Extract client information for rate limiting
    const forwarded = request.headers.get('x-forwarded-for');
    const ipAddress = forwarded?.split(',')[0].trim() || 
                     request.headers.get('x-real-ip') || 
                     'unknown';
    const rateLimitKey = `${session.user.id}:${ipAddress}`;

    // Check rate limit
    const rateLimit = await SessionRateLimiter.checkRateLimit('getUserSessions', rateLimitKey);
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { 
          error: 'Rate limit exceeded', 
          code: 'RATE_LIMIT_EXCEEDED',
          retryAfter: rateLimit.retryAfter 
        },
        { 
          status: 429,
          headers: {
            'Retry-After': String(rateLimit.retryAfter || 60),
          }
        }
      );
    }

    // Get the session from database
    const targetSession = await db.session.findUnique({
      where: { id: sessionId },
      include: { user: true },
    });

    if (!targetSession) {
      return NextResponse.json(
        { error: 'Session not found', code: 'SESSION_NOT_FOUND' },
        { status: 404 }
      );
    }

    // Check ownership - users can only access their own sessions, admins can access any
    if (targetSession.userId !== session.user.id && session.user.role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Forbidden', code: 'FORBIDDEN' },
        { status: 403 }
      );
    }

    // Create audit context
    const auditContext = AuditHelpers.createContextFromRequest(request, {
      id: session.user.id,
      email: session.user.email,
    });
    
    await auditService.setAuditContext(auditContext);

    // Get session security information
    const sessionInfo = {
      id: targetSession.id,
      userId: targetSession.userId,
      expiresAt: targetSession.expiresAt.toISOString(),
      createdAt: targetSession.createdAt.toISOString(),
      updatedAt: targetSession.updatedAt.toISOString(),
      ipAddress: targetSession.ipAddress,
      userAgent: targetSession.userAgent,
      isExpired: targetSession.expiresAt <= new Date(),
      isCurrent: targetSession.id === session.session.id,
      deviceType: parseDeviceType(targetSession.userAgent),
      browser: parseBrowser(targetSession.userAgent),
      location: parseLocation(targetSession.ipAddress),
    };

    // Audit the access
    await auditService.createAuditLog({
      tableName: 'sessions',
      recordId: sessionId,
      action: 'ACCESS',
      metadata: {
        operation: 'getSessionDetails',
        accessedBy: session.user.id,
        targetUserId: targetSession.userId,
      },
      context: auditContext,
    });

    return NextResponse.json({
      success: true,
      data: {
        session: sessionInfo,
      },
    });

  } catch (error) {
    console.error('Session detail error:', error);
    
    return NextResponse.json(
      { 
        error: 'Internal server error',
        code: 'INTERNAL_ERROR',
        message: 'Failed to retrieve session details'
      },
      { status: 500 }
    );
  } finally {
    await auditService.clearAuditContext();
  }
}

/**
 * PUT /api/auth/sessions/[id]
 * Update session (extend expiry, modify metadata)
 */
export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const sessionId = params.id;

    // Get authenticated session
    const session = await auth.api.getSession({
      headers: request.headers,
    });

    if (!session?.user) {
      return NextResponse.json(
        { error: 'Unauthorized', code: 'UNAUTHORIZED' },
        { status: 401 }
      );
    }

    // Extract client information for rate limiting
    const forwarded = request.headers.get('x-forwarded-for');
    const ipAddress = forwarded?.split(',')[0].trim() || 
                     request.headers.get('x-real-ip') || 
                     'unknown';
    const rateLimitKey = `${session.user.id}:${ipAddress}`;

    // Check rate limit
    const rateLimit = await SessionRateLimiter.checkRateLimit('refreshSession', rateLimitKey);
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { 
          error: 'Rate limit exceeded', 
          code: 'RATE_LIMIT_EXCEEDED',
          retryAfter: rateLimit.retryAfter 
        },
        { 
          status: 429,
          headers: {
            'Retry-After': String(rateLimit.retryAfter || 60),
          }
        }
      );
    }

    // Get the target session
    const targetSession = await db.session.findUnique({
      where: { id: sessionId },
    });

    if (!targetSession) {
      return NextResponse.json(
        { error: 'Session not found', code: 'SESSION_NOT_FOUND' },
        { status: 404 }
      );
    }

    // Check ownership - users can only modify their own sessions, admins can modify any
    if (targetSession.userId !== session.user.id && session.user.role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Forbidden', code: 'FORBIDDEN' },
        { status: 403 }
      );
    }

    // Parse request body
    const body = await request.json();
    const { 
      operation = 'extend',
      extendDuration = 7 * 24 * 60 * 60, // 7 days in seconds
      reason = 'user_requested'
    } = body;

    // Validate operation
    const validOperations = ['extend', 'touch'];
    if (!validOperations.includes(operation)) {
      return NextResponse.json(
        { 
          error: 'Invalid operation', 
          code: 'INVALID_OPERATION',
          validOperations 
        },
        { status: 400 }
      );
    }

    // Create audit context
    const auditContext = AuditHelpers.createContextFromRequest(request, {
      id: session.user.id,
      email: session.user.email,
    });
    
    await auditService.setAuditContext(auditContext);

    let updatedSession;

    if (operation === 'extend') {
      // Extend session expiry
      const now = new Date();
      const newExpiresAt = new Date(now.getTime() + extendDuration * 1000);

      updatedSession = await db.session.update({
        where: { id: sessionId },
        data: {
          expiresAt: newExpiresAt,
          updatedAt: now,
        },
      });

      // Audit the extension
      await auditService.createAuditLog({
        tableName: 'sessions',
        recordId: sessionId,
        action: 'UPDATE',
        oldValues: {
          expiresAt: targetSession.expiresAt,
        },
        newValues: {
          expiresAt: newExpiresAt,
        },
        changedFields: ['expiresAt', 'updatedAt'],
        metadata: {
          operation: 'extendSession',
          extendDuration,
          reason,
          performedBy: session.user.id,
        },
        context: auditContext,
      });

    } else if (operation === 'touch') {
      // Update last activity timestamp
      const now = new Date();

      updatedSession = await db.session.update({
        where: { id: sessionId },
        data: {
          updatedAt: now,
        },
      });

      // Audit the touch
      await auditService.createAuditLog({
        tableName: 'sessions',
        recordId: sessionId,
        action: 'UPDATE',
        oldValues: {
          updatedAt: targetSession.updatedAt,
        },
        newValues: {
          updatedAt: now,
        },
        changedFields: ['updatedAt'],
        metadata: {
          operation: 'touchSession',
          reason,
          performedBy: session.user.id,
        },
        context: auditContext,
      });
    }

    return NextResponse.json({
      success: true,
      data: {
        operation,
        session: {
          id: updatedSession!.id,
          userId: updatedSession!.userId,
          expiresAt: updatedSession!.expiresAt.toISOString(),
          updatedAt: updatedSession!.updatedAt.toISOString(),
        },
        reason,
      },
    });

  } catch (error) {
    console.error('Session update error:', error);
    
    return NextResponse.json(
      { 
        error: 'Internal server error',
        code: 'INTERNAL_ERROR',
        message: 'Failed to update session'
      },
      { status: 500 }
    );
  } finally {
    await auditService.clearAuditContext();
  }
}

/**
 * DELETE /api/auth/sessions/[id]
 * Terminate a specific session
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const sessionId = params.id;

    // Get authenticated session
    const session = await auth.api.getSession({
      headers: request.headers,
    });

    if (!session?.user) {
      return NextResponse.json(
        { error: 'Unauthorized', code: 'UNAUTHORIZED' },
        { status: 401 }
      );
    }

    // Extract client information for rate limiting
    const forwarded = request.headers.get('x-forwarded-for');
    const ipAddress = forwarded?.split(',')[0].trim() || 
                     request.headers.get('x-real-ip') || 
                     'unknown';
    const rateLimitKey = `${session.user.id}:${ipAddress}`;

    // Check rate limit
    const rateLimit = await SessionRateLimiter.checkRateLimit('terminateSession', rateLimitKey);
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { 
          error: 'Rate limit exceeded', 
          code: 'RATE_LIMIT_EXCEEDED',
          retryAfter: rateLimit.retryAfter 
        },
        { 
          status: 429,
          headers: {
            'Retry-After': String(rateLimit.retryAfter || 60),
          }
        }
      );
    }

    // Get the target session
    const targetSession = await db.session.findUnique({
      where: { id: sessionId },
    });

    if (!targetSession) {
      return NextResponse.json(
        { error: 'Session not found', code: 'SESSION_NOT_FOUND' },
        { status: 404 }
      );
    }

    // Check ownership - users can only terminate their own sessions, admins can terminate any
    if (targetSession.userId !== session.user.id && session.user.role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Forbidden', code: 'FORBIDDEN' },
        { status: 403 }
      );
    }

    // Prevent terminating current session unless explicitly confirmed
    const url = new URL(request.url);
    const confirmCurrent = url.searchParams.get('confirmCurrent') === 'true';
    
    if (sessionId === session.session.id && !confirmCurrent) {
      return NextResponse.json(
        { 
          error: 'Cannot terminate current session without confirmation',
          code: 'CURRENT_SESSION_PROTECTION',
          hint: 'Add ?confirmCurrent=true to terminate your current session'
        },
        { status: 400 }
      );
    }

    // Parse query parameters for reason
    const reason = url.searchParams.get('reason') || 'user_requested';

    // Create audit context
    const auditContext = AuditHelpers.createContextFromRequest(request, {
      id: session.user.id,
      email: session.user.email,
    });
    
    await auditService.setAuditContext(auditContext);

    // Terminate the session
    const terminated = await sessionManager.terminateSession(sessionId, {
      reason,
      auditContext,
    });

    if (!terminated) {
      return NextResponse.json(
        { error: 'Failed to terminate session', code: 'TERMINATION_FAILED' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        sessionId,
        terminated: true,
        reason,
        wasCurrentSession: sessionId === session.session.id,
      },
    });

  } catch (error) {
    console.error('Session termination error:', error);
    
    return NextResponse.json(
      { 
        error: 'Internal server error',
        code: 'INTERNAL_ERROR',
        message: 'Failed to terminate session'
      },
      { status: 500 }
    );
  } finally {
    await auditService.clearAuditContext();
  }
}

// Utility functions
function parseDeviceType(userAgent?: string | null): string {
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

function parseBrowser(userAgent?: string | null): string {
  if (!userAgent) return 'Unknown';
  
  const ua = userAgent.toLowerCase();
  if (ua.includes('chrome')) return 'Chrome';
  if (ua.includes('firefox')) return 'Firefox';
  if (ua.includes('safari')) return 'Safari';
  if (ua.includes('edge')) return 'Edge';
  if (ua.includes('opera')) return 'Opera';
  
  return 'Other';
}

function parseLocation(ipAddress?: string | null): string {
  if (!ipAddress) return 'Unknown';
  
  // In production, you would integrate with a GeoIP service
  // For now, return a placeholder
  return 'Unknown Location';
}

// Handle unsupported methods
export async function POST() {
  return NextResponse.json(
    { error: 'Method not allowed', code: 'METHOD_NOT_ALLOWED' },
    { status: 405 }
  );
}

export async function PATCH() {
  return NextResponse.json(
    { error: 'Method not allowed', code: 'METHOD_NOT_ALLOWED' },
    { status: 405 }
  );
}