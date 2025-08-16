/**
 * Session Refresh API
 * /api/auth/sessions/refresh
 * 
 * Provides secure session refresh and token rotation:
 * - POST: Refresh current session with optional token rotation
 * - Sliding session expiration
 * - Security monitoring and audit logging
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth/config';
import { sessionManager, SessionRateLimiter } from '@/lib/session-manager';
import { auditService, AuditHelpers } from '@/lib/audit';
import { db } from '@/lib/db';

/**
 * POST /api/auth/sessions/refresh
 * Refresh the current session with optional token rotation
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

    // Extract client information for rate limiting and security
    const userAgent = request.headers.get('user-agent');
    const forwarded = request.headers.get('x-forwarded-for');
    const ipAddress = forwarded?.split(',')[0].trim() || 
                     request.headers.get('x-real-ip') || 
                     'unknown';
    const rateLimitKey = `${session.user.id}:${ipAddress}`;

    // Check rate limit for refresh operations
    const rateLimit = await SessionRateLimiter.checkRateLimit('refreshSession', rateLimitKey);
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { 
          error: 'Rate limit exceeded', 
          code: 'RATE_LIMIT_EXCEEDED',
          retryAfter: rateLimit.retryAfter,
          message: 'Too many refresh attempts. Please wait before trying again.'
        },
        { 
          status: 429,
          headers: {
            'Retry-After': String(rateLimit.retryAfter || 60),
            'X-RateLimit-Limit': '10',
            'X-RateLimit-Remaining': '0',
            'X-RateLimit-Reset': String(Date.now() + (rateLimit.retryAfter || 60) * 1000),
          }
        }
      );
    }

    // Parse request body
    const body = await request.json().catch(() => ({}));
    const { 
      rotateToken = true,
      extendExpiry = true,
      validateSecurity = true,
      reason = 'user_refresh'
    } = body;

    // Create audit context
    const auditContext = AuditHelpers.createContextFromRequest(request, {
      id: session.user.id,
      email: session.user.email,
    });
    
    await auditService.setAuditContext(auditContext);

    // Get current session details from database
    const currentSession = await db.session.findUnique({
      where: { id: session.session.id },
    });

    if (!currentSession) {
      return NextResponse.json(
        { error: 'Session not found in database', code: 'SESSION_NOT_FOUND' },
        { status: 404 }
      );
    }

    // Validate session integrity
    if (currentSession.userId !== session.user.id) {
      // Session user mismatch - potential security issue
      await auditService.createAuditLog({
        tableName: 'sessions',
        recordId: session.session.id,
        action: 'ACCESS',
        metadata: {
          operation: 'refreshSession',
          securityIssue: 'session_user_mismatch',
          expectedUserId: session.user.id,
          actualUserId: currentSession.userId,
          ipAddress,
          userAgent,
        },
        context: auditContext,
      });

      return NextResponse.json(
        { 
          error: 'Session integrity violation',
          code: 'SESSION_INTEGRITY_ERROR'
        },
        { status: 400 }
      );
    }

    // Security validation if requested
    if (validateSecurity) {
      // Check for IP address changes (if configured for high security)
      const ipChanged = currentSession.ipAddress && 
                       currentSession.ipAddress !== ipAddress;

      // Check for user agent changes
      const userAgentChanged = currentSession.userAgent && 
                              currentSession.userAgent !== userAgent;

      if (ipChanged || userAgentChanged) {
        // Log potential security concern
        await auditService.createAuditLog({
          tableName: 'sessions',
          recordId: session.session.id,
          action: 'ACCESS',
          metadata: {
            operation: 'refreshSession',
            securityConcern: 'session_context_changed',
            ipChanged,
            userAgentChanged,
            originalIp: currentSession.ipAddress,
            currentIp: ipAddress,
            originalUserAgent: currentSession.userAgent,
            currentUserAgent: userAgent,
          },
          context: auditContext,
        });

        // In high-security mode, you might want to require re-authentication
        // For now, we'll log and continue with a warning
      }
    }

    // Perform session refresh
    const refreshResult = await sessionManager.refreshSession(session.session.id, {
      rotateToken,
      extendExpiry,
      auditContext,
    });

    if (!refreshResult.success) {
      return NextResponse.json(
        { 
          error: 'Session refresh failed',
          code: 'REFRESH_FAILED',
          details: refreshResult.error
        },
        { status: 400 }
      );
    }

    // Update session metadata if needed
    if (currentSession.ipAddress !== ipAddress || currentSession.userAgent !== userAgent) {
      await db.session.update({
        where: { id: session.session.id },
        data: {
          ipAddress,
          userAgent,
        },
      });
    }

    // Prepare response
    const response: any = {
      success: true,
      data: {
        sessionId: session.session.id,
        refreshed: true,
        tokenRotated: refreshResult.rotated,
        expiresAt: refreshResult.expiresAt?.toISOString(),
        extendedExpiry: extendExpiry,
        reason,
        timestamp: new Date().toISOString(),
      },
    };

    // Include new token if rotated (this would typically be set in HTTP-only cookie)
    if (refreshResult.rotated && refreshResult.newToken) {
      // In production, you would set this as an HTTP-only cookie
      // For API response, we include it but recommend cookie-based approach
      response.data.newToken = refreshResult.newToken;
      response.data.tokenNote = 'New token should be set as HTTP-only cookie';
    }

    // Set security headers
    const responseHeaders: Record<string, string> = {
      'X-Session-Refreshed': 'true',
      'X-Token-Rotated': String(refreshResult.rotated),
    };

    if (refreshResult.expiresAt) {
      responseHeaders['X-Session-Expires'] = refreshResult.expiresAt.toISOString();
    }

    return NextResponse.json(response, {
      headers: responseHeaders,
    });

  } catch (error) {
    console.error('Session refresh error:', error);
    
    // Log the error for monitoring
    try {
      await auditService.createAuditLog({
        tableName: 'sessions',
        recordId: 'unknown',
        action: 'ACCESS',
        metadata: {
          operation: 'refreshSession',
          error: error instanceof Error ? error.message : 'Unknown error',
          errorType: 'refresh_error',
        },
      });
    } catch {
      // Ignore audit logging errors
    }
    
    return NextResponse.json(
      { 
        error: 'Internal server error',
        code: 'INTERNAL_ERROR',
        message: 'Failed to refresh session'
      },
      { status: 500 }
    );
  } finally {
    await auditService.clearAuditContext();
  }
}

/**
 * GET /api/auth/sessions/refresh
 * Get refresh capabilities and current session status
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

    // Get current session details
    const currentSession = await db.session.findUnique({
      where: { id: session.session.id },
    });

    if (!currentSession) {
      return NextResponse.json(
        { error: 'Session not found', code: 'SESSION_NOT_FOUND' },
        { status: 404 }
      );
    }

    const now = new Date();
    const timeUntilExpiry = currentSession.expiresAt.getTime() - now.getTime();
    const hoursUntilExpiry = Math.floor(timeUntilExpiry / (1000 * 60 * 60));
    const minutesUntilExpiry = Math.floor((timeUntilExpiry % (1000 * 60 * 60)) / (1000 * 60));

    // Determine refresh recommendations
    const shouldRefresh = timeUntilExpiry < (24 * 60 * 60 * 1000); // Less than 24 hours
    const mustRefresh = timeUntilExpiry < (2 * 60 * 60 * 1000); // Less than 2 hours

    return NextResponse.json({
      success: true,
      data: {
        sessionId: session.session.id,
        userId: session.user.id,
        expiresAt: currentSession.expiresAt.toISOString(),
        timeUntilExpiry: {
          milliseconds: timeUntilExpiry,
          hours: hoursUntilExpiry,
          minutes: minutesUntilExpiry,
        },
        recommendations: {
          shouldRefresh,
          mustRefresh,
          canRotateToken: true,
          canExtendExpiry: true,
        },
        refreshCapabilities: {
          tokenRotation: true,
          expiryExtension: true,
          securityValidation: true,
        },
      },
    });

  } catch (error) {
    console.error('Session refresh status error:', error);
    
    return NextResponse.json(
      { 
        error: 'Internal server error',
        code: 'INTERNAL_ERROR',
        message: 'Failed to get refresh status'
      },
      { status: 500 }
    );
  }
}

// Handle unsupported methods
export async function PUT() {
  return NextResponse.json(
    { error: 'Method not allowed', code: 'METHOD_NOT_ALLOWED' },
    { status: 405 }
  );
}

export async function DELETE() {
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