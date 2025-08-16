/**
 * Session Card Component
 * NextJS Stripe Payment Template
 * 
 * Individual session display card with device info, security indicators,
 * and action buttons for session management.
 */

'use client';

import { useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import type { SessionCardProps } from '@/types/auth/sessions';
import { TRUST_LEVEL_CONFIG } from '@/types/auth/sessions';
import { cn } from '@/lib/utils';

/**
 * Session card component for displaying individual session information
 */
export function SessionCard({
  session,
  onRefresh,
  onTerminate,
  onViewDetails,
  isLoading = false,
  className,
}: SessionCardProps) {
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const trustConfig = TRUST_LEVEL_CONFIG[session.trustLevel];
  const isCurrentSession = session.isCurrent;
  const isExpired = session.isExpired;
  const isExpiringSoon = session.isExpiringSoon;

  const handleAction = async (action: string, callback?: (sessionId: string) => void) => {
    if (!callback || isLoading) return;
    
    setActionLoading(action);
    try {
      await callback(session.id);
    } finally {
      setActionLoading(null);
    }
  };

  const getDeviceIcon = () => {
    switch (session.deviceType) {
      case 'Desktop':
        return (
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
        );
      case 'Mobile':
        return (
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M8 21h8a1 1 0 001-1V4a1 1 0 00-1-1H8a1 1 0 00-1 1v16a1 1 0 001 1z" />
          </svg>
        );
      case 'Tablet':
        return (
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
          </svg>
        );
      default:
        return (
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
        );
    }
  };

  const getBrowserIcon = () => {
    switch (session.browser) {
      case 'Chrome':
        return '🌐';
      case 'Firefox':
        return '🦊';
      case 'Safari':
        return '🧭';
      case 'Edge':
        return '📘';
      default:
        return '🌐';
    }
  };

  const getSecurityIcon = () => {
    switch (session.trustLevel) {
      case 'trusted':
        return (
          <svg className="h-4 w-4 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
          </svg>
        );
      case 'suspicious':
        return (
          <svg className="h-4 w-4 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
          </svg>
        );
      default:
        return (
          <svg className="h-4 w-4 text-yellow-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        );
    }
  };

  return (
    <Card className={cn(
      'transition-all duration-200 hover:shadow-md',
      isCurrentSession && 'ring-2 ring-blue-500 ring-opacity-50 bg-blue-50/30 dark:bg-blue-900/10',
      isExpired && 'opacity-60',
      className
    )}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              {getDeviceIcon()}
              <div>
                <CardTitle className="text-sm font-medium">
                  {session.deviceType} • {session.browser}
                </CardTitle>
                <CardDescription className="text-xs">
                  {session.location}
                </CardDescription>
              </div>
            </div>
            {isCurrentSession && (
              <Badge variant="default" className="text-xs">
                Current
              </Badge>
            )}
          </div>

          <div className="flex items-center gap-2">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger>
                  {getSecurityIcon()}
                </TooltipTrigger>
                <TooltipContent>
                  <p>Security Score: {session.securityScore}/100</p>
                  <p>Trust Level: {trustConfig.label}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>

            {getBrowserIcon()}
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Session Status */}
        <div className="flex items-center justify-between text-sm">
          <span className="text-slate-600 dark:text-slate-400">Status</span>
          <div className="flex items-center gap-2">
            {isExpired ? (
              <Badge variant="destructive" className="text-xs">
                Expired
              </Badge>
            ) : isExpiringSoon ? (
              <Badge variant="outline" className="text-xs border-yellow-500 text-yellow-600">
                Expiring Soon
              </Badge>
            ) : (
              <Badge variant="secondary" className="text-xs">
                Active
              </Badge>
            )}
            <span className="text-xs text-slate-500">
              {session.timeRemaining}
            </span>
          </div>
        </div>

        <Separator />

        {/* Session Details */}
        <div className="space-y-2 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-slate-600 dark:text-slate-400">IP Address</span>
            <span className="font-mono text-xs">{session.ipAddress}</span>
          </div>
          
          <div className="flex items-center justify-between">
            <span className="text-slate-600 dark:text-slate-400">Created</span>
            <span className="text-xs">
              {formatDistanceToNow(new Date(session.createdAt), { addSuffix: true })}
            </span>
          </div>

          {session.lastActivityAt && (
            <div className="flex items-center justify-between">
              <span className="text-slate-600 dark:text-slate-400">Last Activity</span>
              <span className="text-xs">
                {formatDistanceToNow(new Date(session.lastActivityAt), { addSuffix: true })}
              </span>
            </div>
          )}

          <div className="flex items-center justify-between">
            <span className="text-slate-600 dark:text-slate-400">Security Score</span>
            <div className="flex items-center gap-2">
              <div className="h-2 w-12 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                <div 
                  className={cn(
                    "h-full transition-all duration-300",
                    session.securityScore >= 70 ? "bg-green-500" :
                    session.securityScore >= 40 ? "bg-yellow-500" : "bg-red-500"
                  )}
                  style={{ width: `${session.securityScore}%` }}
                />
              </div>
              <span className="text-xs font-medium">{session.securityScore}</span>
            </div>
          </div>
        </div>

        <Separator />

        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          {onViewDetails && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onViewDetails(session.id)}
              disabled={isLoading}
              className="flex-1"
            >
              View Details
            </Button>
          )}

          {!isExpired && onRefresh && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleAction('refresh', onRefresh)}
              disabled={isLoading || actionLoading === 'refresh'}
              className="flex-1"
            >
              {actionLoading === 'refresh' ? (
                <div className="flex items-center gap-2">
                  <div className="h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent" />
                  Refreshing...
                </div>
              ) : (
                'Refresh'
              )}
            </Button>
          )}

          {onTerminate && (
            <Button
              variant={isCurrentSession ? "destructive" : "outline"}
              size="sm"
              onClick={() => handleAction('terminate', onTerminate)}
              disabled={isLoading || actionLoading === 'terminate'}
              className="flex-1"
            >
              {actionLoading === 'terminate' ? (
                <div className="flex items-center gap-2">
                  <div className="h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent" />
                  Terminating...
                </div>
              ) : (
                isCurrentSession ? 'Sign Out' : 'Terminate'
              )}
            </Button>
          )}
        </div>

        {/* Current Session Warning */}
        {isCurrentSession && (
          <div className="rounded-md bg-blue-50 dark:bg-blue-900/20 p-3 mt-3">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg
                  className="h-4 w-4 text-blue-400"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                >
                  <path
                    fillRule="evenodd"
                    d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                    clipRule="evenodd"
                  />
                </svg>
              </div>
              <div className="ml-3">
                <p className="text-xs text-blue-800 dark:text-blue-200">
                  This is your current session. Terminating it will sign you out.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Security Warning */}
        {session.trustLevel === 'suspicious' && (
          <div className="rounded-md bg-red-50 dark:bg-red-900/20 p-3 mt-3">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg
                  className="h-4 w-4 text-red-400"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                >
                  <path
                    fillRule="evenodd"
                    d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                    clipRule="evenodd"
                  />
                </svg>
              </div>
              <div className="ml-3">
                <p className="text-xs text-red-800 dark:text-red-200">
                  This session has a low security score. Consider terminating it if you don&apos;t recognize the activity.
                </p>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}