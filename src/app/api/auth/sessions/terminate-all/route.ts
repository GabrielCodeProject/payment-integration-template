/**
 * Bulk Session Termination API
 * /api/auth/sessions/terminate-all
 * 
 * Provides bulk session termination operations:
 * - POST: Terminate all sessions (with optional current session exclusion)
 * - Advanced security features and audit logging
 * - Rate limiting and abuse prevention
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth/config';
import { sessionManager, SessionRateLimiter } from '@/lib/session-manager';
import { auditService, AuditHelpers } from '@/lib/audit';
import { db } from '@/lib/db';

/**
 * POST /api/auth/sessions/terminate-all
 * Terminate all sessions for the current user
 */
export async function POST(request: NextRequest) {
  try {
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

    // Extract client information for rate limiting and security
    const forwarded = request.headers.get('x-forwarded-for');
    const ipAddress = forwarded?.split(',')[0].trim() || 
                     request.headers.get('x-real-ip') || 
                     'unknown';
    const rateLimitKey = `${session.user.id}:${ipAddress}`;

    // Check rate limit for bulk termination (more restrictive)
    const rateLimit = await SessionRateLimiter.checkRateLimit('terminateSession', rateLimitKey);
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { 
          error: 'Rate limit exceeded', 
          code: 'RATE_LIMIT_EXCEEDED',
          retryAfter: rateLimit.retryAfter,
          message: 'Too many termination attempts. Please wait before trying again.'
        },
        { 
          status: 429,
          headers: {
            'Retry-After': String(rateLimit.retryAfter || 60),
            'X-RateLimit-Limit': '20',
            'X-RateLimit-Remaining': '0',
            'X-RateLimit-Reset': String(Date.now() + (rateLimit.retryAfter || 60) * 1000),
          }
        }
      );
    }

    // Parse request body
    const body = await request.json().catch(() => ({}));
    const { 
      excludeCurrentSession = true,
      confirmTermination = false,
      reason = 'user_requested_bulk_termination',
      deviceFilter = null, // Optional: 'mobile', 'desktop', 'tablet'
      olderThanDays = null // Optional: terminate sessions older than X days
    } = body;

    // Require explicit confirmation for security
    if (!confirmTermination) {
      return NextResponse.json(
        { 
          error: 'Confirmation required',
          code: 'CONFIRMATION_REQUIRED',
          message: 'Please set confirmTermination: true to proceed with bulk termination'
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

    // Get current sessions for analysis before termination
    const existingSessions = await db.session.findMany({
      where: { 
        userId: session.user.id,
        expiresAt: { gt: new Date() } // Only active sessions
      },
      select: {
        id: true,
        createdAt: true,
        updatedAt: true,
        ipAddress: true,
        userAgent: true,
      },
    });

    // Apply filters if specified
    let sessionsToTerminate = existingSessions;

    // Exclude current session if requested
    if (excludeCurrentSession) {
      sessionsToTerminate = sessionsToTerminate.filter(s => s.id !== session.session.id);
    }

    // Apply device filter if specified
    if (deviceFilter) {
      sessionsToTerminate = sessionsToTerminate.filter(s => {
        const deviceType = parseDeviceType(s.userAgent);
        return deviceType.toLowerCase() === deviceFilter.toLowerCase();
      });
    }

    // Apply age filter if specified
    if (olderThanDays && olderThanDays > 0) {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);
      
      sessionsToTerminate = sessionsToTerminate.filter(s => 
        s.createdAt < cutoffDate
      );
    }

    // Security check: prevent accidental mass termination
    const totalSessionCount = existingSessions.length;
    const terminationCount = sessionsToTerminate.length;

    if (terminationCount === 0) {
      return NextResponse.json({
        success: true,
        data: {
          terminatedCount: 0,
          totalSessions: totalSessionCount,
          message: 'No sessions matched the termination criteria',
          filters: {
            excludeCurrentSession,
            deviceFilter,
            olderThanDays,
          },
        },
      });
    }

    // Log pre-termination state for audit
    await auditService.createAuditLog({
      tableName: 'sessions',
      recordId: session.user.id,
      action: 'ACCESS',
      metadata: {
        operation: 'bulkTerminationAnalysis',
        totalSessions: totalSessionCount,
        sessionsToTerminate: terminationCount,
        filters: {
          excludeCurrentSession,
          deviceFilter,
          olderThanDays,
        },
        sessionDetails: sessionsToTerminate.map(s => ({
          id: s.id,
          createdAt: s.createdAt,
          ipAddress: s.ipAddress,
          deviceType: parseDeviceType(s.userAgent),
          browser: parseBrowser(s.userAgent),
        })),
      },
      context: auditContext,
    });

    // Perform bulk termination
    let terminatedCount = 0;
    const terminationResults = [];

    for (const sessionToTerminate of sessionsToTerminate) {
      try {
        const terminated = await sessionManager.terminateSession(sessionToTerminate.id, {
          reason,
          auditContext,
        });

        if (terminated) {
          terminatedCount++;
          terminationResults.push({
            sessionId: sessionToTerminate.id,
            terminated: true,
          });
        } else {
          terminationResults.push({
            sessionId: sessionToTerminate.id,
            terminated: false,
            error: 'Termination failed',
          });
        }
      } catch (_error) {
        terminationResults.push({
          sessionId: sessionToTerminate.id,
          terminated: false,
          error: error instanceof Error ? _error.message : 'Unknown error',
        });
      }
    }

    // Final audit log for completed operation
    await auditService.createAuditLog({
      tableName: 'sessions',
      recordId: session.user.id,
      action: 'DELETE',
      metadata: {
        operation: 'bulkTerminationCompleted',
        originalSessionCount: totalSessionCount,
        targetedForTermination: terminationCount,
        actuallyTerminated: terminatedCount,
        reason,
        filters: {
          excludeCurrentSession,
          deviceFilter,
          olderThanDays,
        },
        results: terminationResults,
      },
      context: auditContext,
    });

    // Enforce session limits after bulk operation
    await sessionManager.enforceSessionLimits(session.user.id, {}, auditContext);

    return NextResponse.json({
      success: true,
      data: {
        terminatedCount,
        totalSessions: totalSessionCount,
        remainingSessions: totalSessionCount - terminatedCount,
        operation: 'bulk_termination',
        reason,
        filters: {
          excludeCurrentSession,
          deviceFilter,
          olderThanDays,
        },
        currentSessionPreserved: excludeCurrentSession,
        timestamp: new Date().toISOString(),
      },
    });

  } catch (_error) {
    // console.error('Bulk session termination error:', error);
    
    // Log the error for monitoring
    try {
      await auditService.createAuditLog({
        tableName: 'sessions',
        recordId: 'unknown',
        action: 'DELETE',
        metadata: {
          operation: 'bulkTermination',
          error: error instanceof Error ? _error.message : 'Unknown error',
          errorType: 'bulk_termination_error',
        },
      });
    } catch {
      // Ignore audit logging errors
    }
    
    return NextResponse.json(
      { 
        error: 'Internal server error',
        code: 'INTERNAL_ERROR',
        message: 'Failed to perform bulk session termination'
      },
      { status: 500 }
    );
  } finally {
    await auditService.clearAuditContext();
  }
}

/**
 * GET /api/auth/sessions/terminate-all
 * Get analysis of what would be terminated (dry run)
 */
export async function GET(request: NextRequest) {
  try {
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

    // Parse query parameters
    const url = new URL(request.url);
    const excludeCurrentSession = url.searchParams.get('excludeCurrent') !== 'false';
    const deviceFilter = url.searchParams.get('deviceFilter');
    const olderThanDays = url.searchParams.get('olderThanDays') ? 
                         parseInt(url.searchParams.get('olderThanDays')!) : null;

    // Get current sessions
    const existingSessions = await db.session.findMany({
      where: { 
        userId: session.user.id,
        expiresAt: { gt: new Date() } // Only active sessions
      },
      select: {
        id: true,
        createdAt: true,
        updatedAt: true,
        ipAddress: true,
        userAgent: true,
      },
      orderBy: { updatedAt: 'desc' },
    });

    // Apply filters to see what would be terminated
    let sessionsToTerminate = existingSessions;

    if (excludeCurrentSession) {
      sessionsToTerminate = sessionsToTerminate.filter(s => s.id !== session.session.id);
    }

    if (deviceFilter) {
      sessionsToTerminate = sessionsToTerminate.filter(s => {
        const deviceType = parseDeviceType(s.userAgent);
        return deviceType.toLowerCase() === deviceFilter.toLowerCase();
      });
    }

    if (olderThanDays && olderThanDays > 0) {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);
      
      sessionsToTerminate = sessionsToTerminate.filter(s => 
        s.createdAt < cutoffDate
      );
    }

    // Analyze sessions by device type and location
    const sessionAnalysis = {
      byDevice: {} as Record<string, number>,
      byAge: {
        lessThan1Day: 0,
        lessThan1Week: 0,
        lessThan1Month: 0,
        older: 0,
      },
      oldestSession: null as Date | null,
      newestSession: null as Date | null,
    };

    existingSessions.forEach(s => {
      const deviceType = parseDeviceType(s.userAgent);
      sessionAnalysis.byDevice[deviceType] = (sessionAnalysis.byDevice[deviceType] || 0) + 1;

      const age = Date.now() - s.createdAt.getTime();
      const days = age / (1000 * 60 * 60 * 24);

      if (days < 1) sessionAnalysis.byAge.lessThan1Day++;
      else if (days < 7) sessionAnalysis.byAge.lessThan1Week++;
      else if (days < 30) sessionAnalysis.byAge.lessThan1Month++;
      else sessionAnalysis.byAge.older++;

      if (!sessionAnalysis.oldestSession || s.createdAt < sessionAnalysis.oldestSession) {
        sessionAnalysis.oldestSession = s.createdAt;
      }
      if (!sessionAnalysis.newestSession || s.createdAt > sessionAnalysis.newestSession) {
        sessionAnalysis.newestSession = s.createdAt;
      }
    });

    return NextResponse.json({
      success: true,
      data: {
        dryRun: true,
        totalSessions: existingSessions.length,
        wouldTerminate: sessionsToTerminate.length,
        wouldRemain: existingSessions.length - sessionsToTerminate.length,
        filters: {
          excludeCurrentSession,
          deviceFilter,
          olderThanDays,
        },
        analysis: sessionAnalysis,
        sessionsToTerminate: sessionsToTerminate.map(s => ({
          id: s.id,
          createdAt: s.createdAt.toISOString(),
          lastActivity: s.updatedAt.toISOString(),
          deviceType: parseDeviceType(s.userAgent),
          browser: parseBrowser(s.userAgent),
          ipAddress: s.ipAddress,
          isCurrent: s.id === session.session.id,
        })),
      },
    });

  } catch (_error) {
    // console.error('Bulk termination analysis error:', error);
    
    return NextResponse.json(
      { 
        error: 'Internal server error',
        code: 'INTERNAL_ERROR',
        message: 'Failed to analyze sessions for bulk termination'
      },
      { status: 500 }
    );
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