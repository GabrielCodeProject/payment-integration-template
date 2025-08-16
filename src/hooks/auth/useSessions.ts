/**
 * Session Management Hooks
 * NextJS Stripe Payment Template
 * 
 * Custom hooks for managing user sessions including listing,
 * refreshing, terminating, and real-time updates.
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import type {
  SessionData,
  EnhancedSessionData,
  SessionStats,
  SessionsResponse,
  SessionOperationResponse,
  SessionRefreshOptions,
  SessionTerminateOptions,
  UseSessionsReturn,
  UseSessionOperationsReturn,
  SecurityFactors,
} from '@/types/auth/sessions';
import { SESSION_DURATION, DEVICE_ICONS } from '@/types/auth/sessions';

/**
 * Hook for managing user sessions with enhanced data processing
 */
export function useSessions(): UseSessionsReturn {
  const [sessions, setSessions] = useState<EnhancedSessionData[]>([]);
  const [stats, setStats] = useState<SessionStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Enhanced session data processor
  const enhanceSessionData = useCallback((session: SessionData): EnhancedSessionData => {
    const now = new Date();
    const expiresAt = new Date(session.expiresAt);
    const createdAt = new Date(session.createdAt);
    const _lastActivity = session.lastActivityAt ? new Date(session.lastActivityAt) : createdAt;

    const isExpired = expiresAt <= now;
    const timeUntilExpiry = expiresAt.getTime() - now.getTime();
    const isExpiringSoon = timeUntilExpiry > 0 && timeUntilExpiry <= SESSION_DURATION.EXPIRING_SOON_THRESHOLD;

    // Calculate security score based on various factors
    const securityFactors = calculateSecurityFactors(session, now);
    const securityScore = calculateSecurityScore(securityFactors);
    
    // Determine trust level
    const trustLevel = determineTrustLevel(securityScore, session);

    // Format time remaining
    const timeRemaining = formatTimeRemaining(timeUntilExpiry);

    // Get device icon
    const deviceIcon = DEVICE_ICONS[session.deviceType as keyof typeof DEVICE_ICONS] || DEVICE_ICONS.Unknown;

    return {
      ...session,
      isExpired,
      isExpiringSoon,
      timeRemaining,
      securityScore,
      trustLevel,
      deviceIcon,
    };
  }, []);

  // Fetch sessions from API
  const fetchSessions = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const response = await fetch('/api/auth/sessions?includeSecurity=true', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch sessions: ${response.status}`);
      }

      const data: SessionsResponse = await response.json();

      if (!data.success) {
        throw new Error('Failed to fetch sessions');
      }

      // Enhance session data
      const enhancedSessions = data.data.sessions.map(enhanceSessionData);
      
      // Sort sessions: current first, then by last activity
      enhancedSessions.sort((a, b) => {
        if (a.isCurrent && !b.isCurrent) return -1;
        if (!a.isCurrent && b.isCurrent) return 1;
        
        const aActivity = new Date(a.lastActivityAt || a.createdAt);
        const bActivity = new Date(b.lastActivityAt || b.createdAt);
        return bActivity.getTime() - aActivity.getTime();
      });

      setSessions(enhancedSessions);
      setStats(data.data.stats);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch sessions';
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  }, [enhanceSessionData]);

  // Session operations
  const { 
    refreshSession: refreshSingleSession,
    terminateSession: terminateSingleSession,
    terminateAllSessions: terminateAllSessionsOp,
  } = useSessionOperations();

  // Wrapper functions with state updates
  const refreshSession = useCallback(async (sessionId: string, options?: SessionRefreshOptions) => {
    try {
      await refreshSingleSession(sessionId, options);
      await fetchSessions(); // Refresh the list
      toast.success('Session refreshed successfully');
    } catch (_error) {
      toast.error('Failed to refresh session');
    }
  }, [refreshSingleSession, fetchSessions]);

  const terminateSession = useCallback(async (sessionId: string, options?: SessionTerminateOptions) => {
    try {
      await terminateSingleSession(sessionId, options);
      await fetchSessions(); // Refresh the list
      toast.success('Session terminated successfully');
    } catch (_error) {
      toast.error('Failed to terminate session');
    }
  }, [terminateSingleSession, fetchSessions]);

  const terminateAllSessions = useCallback(async (options?: SessionTerminateOptions) => {
    try {
      const result = await terminateAllSessionsOp(options);
      await fetchSessions(); // Refresh the list
      toast.success(`Terminated ${result.data.terminatedCount || 0} sessions`);
    } catch (_error) {
      toast.error('Failed to terminate sessions');
    }
  }, [terminateAllSessionsOp, fetchSessions]);

  const bulkTerminate = useCallback(async (sessionIds: string[], options?: SessionTerminateOptions) => {
    try {
      // Terminate each session individually
      for (const sessionId of sessionIds) {
        await terminateSingleSession(sessionId, options);
      }
      await fetchSessions(); // Refresh the list
      toast.success(`Terminated ${sessionIds.length} sessions`);
    } catch (_error) {
      toast.error('Failed to terminate selected sessions');
    }
  }, [terminateSingleSession, fetchSessions]);

  // Initial load and periodic refresh
  useEffect(() => {
    fetchSessions();

    // Set up periodic refresh every 30 seconds
    const interval = setInterval(fetchSessions, 30000);
    
    return () => clearInterval(interval);
  }, [fetchSessions]);

  return {
    sessions,
    stats,
    isLoading,
    error,
    refresh: fetchSessions,
    refreshSession,
    terminateSession,
    terminateAllSessions,
    bulkTerminate,
  };
}

/**
 * Hook for individual session operations
 */
export function useSessionOperations(): UseSessionOperationsReturn {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refreshSession = useCallback(async (
    sessionId: string,
    options: SessionRefreshOptions = {}
  ): Promise<SessionOperationResponse> => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/auth/sessions/refresh', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sessionId,
          ...options,
        }),
      });

      if (!response.ok) {
        throw new Error(`Failed to refresh session: ${response.status}`);
      }

      const data: SessionOperationResponse = await response.json();

      if (!data.success) {
        throw new Error('Failed to refresh session');
      }

      return data;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to refresh session';
      setError(errorMessage);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const terminateSession = useCallback(async (
    sessionId: string,
    options: SessionTerminateOptions = {}
  ): Promise<SessionOperationResponse> => {
    setIsLoading(true);
    setError(null);

    try {
      const url = new URL(`/api/auth/sessions/${sessionId}`, window.location.origin);
      
      if (options.reason) {
        url.searchParams.set('reason', options.reason);
      }
      if (options.confirmCurrent) {
        url.searchParams.set('confirmCurrent', 'true');
      }

      const response = await fetch(url.toString(), {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to terminate session: ${response.status}`);
      }

      const data: SessionOperationResponse = await response.json();

      if (!data.success) {
        throw new Error('Failed to terminate session');
      }

      return data;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to terminate session';
      setError(errorMessage);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const terminateAllSessions = useCallback(async (
    options: SessionTerminateOptions = {}
  ): Promise<SessionOperationResponse> => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/auth/sessions', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          operation: 'terminateAll',
          excludeCurrent: options.excludeCurrent ?? true,
          reason: options.reason || 'user_requested',
        }),
      });

      if (!response.ok) {
        throw new Error(`Failed to terminate sessions: ${response.status}`);
      }

      const data: SessionOperationResponse = await response.json();

      if (!data.success) {
        throw new Error('Failed to terminate sessions');
      }

      return data;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to terminate sessions';
      setError(errorMessage);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const extendSession = useCallback(async (
    sessionId: string,
    options: SessionRefreshOptions = {}
  ): Promise<SessionOperationResponse> => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/auth/sessions/${sessionId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          operation: 'extend',
          extendDuration: options.extendDuration || SESSION_DURATION.DEFAULT_EXTEND_DURATION,
          reason: options.reason || 'user_requested',
        }),
      });

      if (!response.ok) {
        throw new Error(`Failed to extend session: ${response.status}`);
      }

      const data: SessionOperationResponse = await response.json();

      if (!data.success) {
        throw new Error('Failed to extend session');
      }

      return data;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to extend session';
      setError(errorMessage);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  return {
    refreshSession,
    terminateSession,
    terminateAllSessions,
    extendSession,
    isLoading,
    error,
  };
}

// Helper functions
function calculateSecurityFactors(session: SessionData, now: Date): SecurityFactors {
  const sessionAge = now.getTime() - new Date(session.createdAt).getTime();
  const lastActivity = session.lastActivityAt ? new Date(session.lastActivityAt) : new Date(session.createdAt);
  const timeSinceActivity = now.getTime() - lastActivity.getTime();

  return {
    deviceRecognition: session.deviceType !== 'Unknown' ? 0.8 : 0.3,
    locationConsistency: session.location !== 'Unknown Location' ? 0.7 : 0.4,
    sessionAge: Math.min(sessionAge / (7 * 24 * 60 * 60 * 1000), 1), // Normalize to 7 days
    activityPattern: Math.max(0, 1 - (timeSinceActivity / (24 * 60 * 60 * 1000))), // Recent activity is better
    ipReputation: 0.6, // Placeholder - would integrate with IP reputation service
  };
}

function calculateSecurityScore(factors: SecurityFactors): number {
  const weights = {
    deviceRecognition: 0.2,
    locationConsistency: 0.2,
    sessionAge: 0.1,
    activityPattern: 0.3,
    ipReputation: 0.2,
  };

  return Math.round(
    (factors.deviceRecognition * weights.deviceRecognition +
     factors.locationConsistency * weights.locationConsistency +
     factors.sessionAge * weights.sessionAge +
     factors.activityPattern * weights.activityPattern +
     factors.ipReputation * weights.ipReputation) * 100
  );
}

function determineTrustLevel(securityScore: number, _session: SessionData): 'trusted' | 'suspicious' | 'unknown' {
  if (securityScore >= 70) return 'trusted';
  if (securityScore <= 40) return 'suspicious';
  return 'unknown';
}

function formatTimeRemaining(milliseconds: number): string {
  if (milliseconds <= 0) return 'Expired';

  const seconds = Math.floor(milliseconds / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) {
    return `${days} day${days !== 1 ? 's' : ''}`;
  } else if (hours > 0) {
    return `${hours} hour${hours !== 1 ? 's' : ''}`;
  } else if (minutes > 0) {
    return `${minutes} minute${minutes !== 1 ? 's' : ''}`;
  } else {
    return `${seconds} second${seconds !== 1 ? 's' : ''}`;
  }
}