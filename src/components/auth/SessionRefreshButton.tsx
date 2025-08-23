/**
 * Session Refresh Button Component
 * NextJS Stripe Payment Template
 * 
 * Button component for manual session refresh with progress indication
 * and auto-refresh configuration options.
 */

'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useSessionOperations } from '@/hooks/auth/useSessions';
import type { SessionRefreshButtonProps } from '@/types/auth/sessions';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

/**
 * Button for refreshing individual sessions or all sessions
 */
export function SessionRefreshButton({
  sessionId,
  variant = 'outline',
  size = 'sm',
  onSuccess,
  onError,
  className,
}: SessionRefreshButtonProps) {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const { refreshSession } = useSessionOperations();

  const handleRefresh = async () => {
    if (isRefreshing) return;

    setIsRefreshing(true);
    
    try {
      if (sessionId) {
        // Refresh specific session
        await refreshSession(sessionId, {
          reason: 'manual_refresh',
        });
        toast.success('Session refreshed successfully');
      } else {
        // Refresh current session (token rotation)
        await fetch('/api/auth/sessions/refresh', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ reason: 'manual_refresh' }),
        });
        toast.success('Session refreshed successfully');
      }
      
      onSuccess?.();
    } catch (_error) {
      const errorMessage = error instanceof Error ? _error.message : 'Failed to refresh session';
      toast.error(errorMessage);
      onError?.(errorMessage);
    } finally {
      setIsRefreshing(false);
    }
  };

  const buttonContent = isRefreshing ? (
    <div className="flex items-center gap-2">
      <div className="h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent" />
      <span>Refreshing...</span>
    </div>
  ) : (
    <div className="flex items-center gap-2">
      <svg
        className="h-4 w-4"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
        />
      </svg>
      <span>Refresh</span>
    </div>
  );

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant={variant}
            size={size}
            onClick={handleRefresh}
            disabled={isRefreshing}
            className={cn('transition-all duration-200', className)}
          >
            {buttonContent}
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <p>
            {sessionId 
              ? 'Refresh this session and extend its validity'
              : 'Refresh current session with token rotation'
            }
          </p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

/**
 * Bulk refresh button for refreshing all sessions
 */
export function BulkSessionRefreshButton({
  onSuccess,
  onError,
  className,
}: Omit<SessionRefreshButtonProps, 'sessionId'>) {
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleBulkRefresh = async () => {
    if (isRefreshing) return;

    setIsRefreshing(true);
    
    try {
      // This would be implemented as a bulk refresh endpoint
      const response = await fetch('/api/auth/sessions/refresh-all', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: 'bulk_manual_refresh' }),
      });

      if (!response.ok) {
        throw new Error('Failed to refresh sessions');
      }

      const result = await response.json();
      toast.success(`Refreshed ${result.data?.refreshedCount || 0} sessions`);
      onSuccess?.();
    } catch (_error) {
      const errorMessage = error instanceof Error ? _error.message : 'Failed to refresh sessions';
      toast.error(errorMessage);
      onError?.(errorMessage);
    } finally {
      setIsRefreshing(false);
    }
  };

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            onClick={handleBulkRefresh}
            disabled={isRefreshing}
            className={cn('transition-all duration-200', className)}
          >
            {isRefreshing ? (
              <div className="flex items-center gap-2">
                <div className="h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent" />
                <span>Refreshing All...</span>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <svg
                  className="h-4 w-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                  />
                </svg>
                <span>Refresh All</span>
              </div>
            )}
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <p>Refresh all active sessions and extend their validity</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

/**
 * Auto-refresh toggle component for enabling/disabling automatic session refresh
 */
interface AutoRefreshToggleProps {
  enabled: boolean;
  onToggle: (enabled: boolean) => void;
  interval?: number; // in minutes
  className?: string;
}

export function AutoRefreshToggle({
  enabled,
  onToggle,
  interval = 60, // 1 hour default
  className,
}: AutoRefreshToggleProps) {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant={enabled ? 'default' : 'outline'}
            size="sm"
            onClick={() => onToggle(!enabled)}
            className={cn('transition-all duration-200', className)}
          >
            <div className="flex items-center gap-2">
              <svg
                className={cn(
                  'h-4 w-4 transition-transform duration-200',
                  enabled && 'animate-spin'
                )}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                />
              </svg>
              <span>Auto-refresh</span>
              {enabled && (
                <span className="text-xs opacity-75">
                  ({interval}m)
                </span>
              )}
            </div>
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <p>
            {enabled 
              ? `Auto-refresh is enabled (every ${interval} minutes)`
              : 'Enable automatic session refresh'
            }
          </p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}