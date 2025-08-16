/**
 * Session Management API - Main Sessions Route
 * /api/auth/sessions
 * 
 * Provides comprehensive session management endpoints:
 * - GET: List user sessions
 * - POST: Create new session (limited use)
 * - DELETE: Bulk session operations
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth/config';
import { sessionManager, SessionRateLimiter } from '@/lib/session-manager';
import { auditService, AuditHelpers } from '@/lib/audit';

// Rate limiting configuration
const RATE_LIMITS = {
  GET: { windowMs: 60 * 1000, maxAttempts: 30 }, // 30 requests per minute
  POST: { windowMs: 60 * 1000, maxAttempts: 5 },  // 5 requests per minute
  DELETE: { windowMs: 60 * 1000, maxAttempts: 10 }, // 10 requests per minute
};

/**
 * GET /api/auth/sessions
 * List all sessions for the authenticated user
 */
export async function GET(request: NextRequest) {
  try {
    // Get authenticated session
    const session = await auth.api.getSession({
      headers: new Headers(request.headers),
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
            'X-RateLimit-Limit': String(RATE_LIMITS.GET.maxAttempts),
            'X-RateLimit-Remaining': '0',
            'X-RateLimit-Reset': String(Date.now() + (rateLimit.retryAfter || 60) * 1000),
          }
        }
      );
    }

    // Parse query parameters
    const url = new URL(request.url);
    const includeExpired = url.searchParams.get('includeExpired') === 'true';
    const includeSecurity = url.searchParams.get('includeSecurity') === 'true';

    // Create audit context
    const auditContext = AuditHelpers.createContextFromRequest(request, {
      id: session.user.id,
      email: session.user.email,
    });
    
    await auditService.setAuditContext(auditContext);

    // Get user sessions
    const sessions = await sessionManager.getUserSessions(session.user.id, {
      includeExpired,
      includeSecurity,
      currentSessionId: session.session.id,
    });

    // Get session statistics
    const stats = await sessionManager.getSessionStats(session.user.id);

    return NextResponse.json({
      success: true,
      data: {
        sessions: sessions.map(s => ({
          id: s.id,
          // Don't expose the actual token
          hasToken: !!s.token,
          userId: s.userId,
          expiresAt: s.expiresAt.toISOString(),
          createdAt: s.createdAt.toISOString(),
          updatedAt: s.updatedAt.toISOString(),
          lastActivityAt: s.lastActivityAt?.toISOString(),
          ipAddress: s.ipAddress,
          userAgent: s.userAgent,
          deviceType: s.deviceType,
          browser: s.browser,
          location: s.location,
          isCurrent: s.isCurrent,
        })),
        stats,
        meta: {
          includeExpired,
          includeSecurity,
          currentSessionId: session.session.id,
        },
      },
    });

  } catch (error) {
    console.error('Session listing error:', error);
    
    return NextResponse.json(
      { 
        error: 'Internal server error',
        code: 'INTERNAL_ERROR',
        message: 'Failed to retrieve sessions'
      },
      { status: 500 }
    );
  } finally {
    await auditService.clearAuditContext();
  }
}

/**
 * DELETE /api/auth/sessions
 * Bulk session operations (terminate all or specific sessions)
 */
export async function DELETE(request: NextRequest) {
  try {
    // Get authenticated session
    const session = await auth.api.getSession({
      headers: new Headers(request.headers),
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

    // Parse request body
    const body = await request.json();
    const { 
      operation = 'terminateAll',
      excludeCurrent = true,
      sessionIds = [],
      reason = 'user_requested'
    } = body;

    // Validate operation
    const validOperations = ['terminateAll', 'terminateSelected'];
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

    let terminatedCount = 0;

    if (operation === 'terminateAll') {
      // Terminate all sessions except current (if requested)
      terminatedCount = await sessionManager.terminateAllSessions(session.user.id, {
        excludeCurrentSession: excludeCurrent ? session.session.id : undefined,
        reason,
        auditContext,
      });
    } else if (operation === 'terminateSelected' && sessionIds.length > 0) {
      // Terminate specific sessions
      for (const sessionId of sessionIds) {
        // Prevent terminating current session unless explicitly allowed
        if (sessionId === session.session.id && excludeCurrent) {
          continue;
        }
        
        const terminated = await sessionManager.terminateSession(sessionId, {
          reason,
          auditContext,
        });
        
        if (terminated) {
          terminatedCount++;
        }
      }
    }

    // Enforce session limits after bulk operations
    await sessionManager.enforceSessionLimits(session.user.id, {}, auditContext);

    return NextResponse.json({
      success: true,
      data: {
        operation,
        terminatedCount,
        excludedCurrentSession: excludeCurrent,
        reason,
      },
    });

  } catch (error) {
    console.error('Session bulk operation error:', error);
    
    return NextResponse.json(
      { 
        error: 'Internal server error',
        code: 'INTERNAL_ERROR',
        message: 'Failed to perform bulk session operation'
      },
      { status: 500 }
    );
  } finally {
    await auditService.clearAuditContext();
  }
}

/**
 * POST /api/auth/sessions
 * Create a new session (admin or special use cases only)
 */
export async function POST(request: NextRequest) {
  try {
    // Get authenticated session
    const session = await auth.api.getSession({
      headers: new Headers(request.headers),
    });

    if (!session?.user) {
      return NextResponse.json(
        { error: 'Unauthorized', code: 'UNAUTHORIZED' },
        { status: 401 }
      );
    }

    // Only admins can create sessions for other users
    if (session.user.role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Forbidden', code: 'FORBIDDEN' },
        { status: 403 }
      );
    }

    // Extract client information for rate limiting
    const forwarded = request.headers.get('x-forwarded-for');
    const ipAddress = forwarded?.split(',')[0].trim() || 
                     request.headers.get('x-real-ip') || 
                     'unknown';
    const userAgent = request.headers.get('user-agent');
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

    // Parse request body
    const body = await request.json();
    const { 
      userId,
      maxAge,
      ipAddress: targetIpAddress,
      userAgent: targetUserAgent,
    } = body;

    if (!userId) {
      return NextResponse.json(
        { error: 'User ID is required', code: 'MISSING_USER_ID' },
        { status: 400 }
      );
    }

    // Create audit context
    const auditContext = AuditHelpers.createContextFromRequest(request, {
      id: session.user.id,
      email: session.user.email,
    });
    
    await auditService.setAuditContext(auditContext);

    // Create the session
    const newSession = await sessionManager.createSession(userId, {
      ipAddress: targetIpAddress || ipAddress,
      userAgent: targetUserAgent || userAgent,
      maxAge,
    });

    return NextResponse.json({
      success: true,
      data: {
        sessionId: newSession.id,
        userId: newSession.userId,
        expiresAt: newSession.expiresAt.toISOString(),
        createdAt: newSession.createdAt.toISOString(),
        // Don't expose the token in the response
        hasToken: true,
      },
    });

  } catch (error) {
    console.error('Session creation error:', error);
    
    return NextResponse.json(
      { 
        error: 'Internal server error',
        code: 'INTERNAL_ERROR',
        message: 'Failed to create session'
      },
      { status: 500 }
    );
  } finally {
    await auditService.clearAuditContext();
  }
}

// Handle unsupported methods
export async function PUT() {
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