/**
 * Session Manager Component
 * NextJS Stripe Payment Template
 * 
 * Main session management interface with statistics dashboard,
 * bulk operations controls, and security recommendations.
 */

'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ActiveSessionsList } from './ActiveSessionsList';
import { SessionTerminateDialog } from './SessionTerminateDialog';
import { SessionRefreshButton, BulkSessionRefreshButton, AutoRefreshToggle } from './SessionRefreshButton';
import { useSessions } from '@/hooks/auth/useSessions';
import type { SessionManagerProps, SessionTerminateOptions } from '@/types/auth/sessions';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';

/**
 * Main session management interface
 */
export function SessionManager({ className }: SessionManagerProps) {
  const {
    sessions,
    stats,
    isLoading,
    error,
    refresh,
    refreshSession,
    terminateSession,
    terminateAllSessions,
    bulkTerminate,
  } = useSessions();

  const [terminateDialog, setTerminateDialog] = useState<{
    open: boolean;
    operation: 'single' | 'bulk' | 'all';
    sessionId?: string;
    sessionIds?: string[];
  }>({
    open: false,
    operation: 'single',
  });

  const [autoRefreshEnabled, setAutoRefreshEnabled] = useState(false);

  // Handle refresh operations
  const handleRefreshSession = async (sessionId: string) => {
    await refreshSession(sessionId);
  };

  const handleRefreshAll = async () => {
    await refresh();
  };

  // Handle terminate operations
  const handleTerminateSession = (sessionId: string) => {
    setTerminateDialog({
      open: true,
      operation: 'single',
      sessionId,
    });
  };

  const handleBulkTerminate = (sessionIds: string[]) => {
    setTerminateDialog({
      open: true,
      operation: 'bulk',
      sessionIds,
    });
  };

  const handleTerminateAll = () => {
    setTerminateDialog({
      open: true,
      operation: 'all',
    });
  };

  const handleConfirmTerminate = async (options: SessionTerminateOptions) => {
    try {
      switch (terminateDialog.operation) {
        case 'single':
          if (terminateDialog.sessionId) {
            await terminateSession(terminateDialog.sessionId, options);
          }
          break;
        case 'bulk':
          if (terminateDialog.sessionIds) {
            await bulkTerminate(terminateDialog.sessionIds, options);
          }
          break;
        case 'all':
          await terminateAllSessions(options);
          break;
      }
    } finally {
      setTerminateDialog({ open: false, operation: 'single' });
    }
  };

  // Calculate security metrics
  const securityMetrics = {
    suspicious: sessions.filter(s => s.trustLevel === 'suspicious').length,
    expiringSoon: sessions.filter(s => s.isExpiringSoon).length,
    expired: sessions.filter(s => s.isExpired).length,
    averageScore: Math.round(
      sessions.reduce((acc, s) => acc + s.securityScore, 0) / (sessions.length || 1)
    ),
  };

  if (error) {
    return (
      <Card className={className}>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <div className="text-center space-y-3">
            <svg
              className="mx-auto h-12 w-12 text-red-500"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z"
              />
            </svg>
            <h3 className="text-lg font-medium text-slate-900 dark:text-slate-100">
              Failed to load sessions
            </h3>
            <p className="text-slate-600 dark:text-slate-400">{error}</p>
            <Button onClick={refresh} variant="outline" size="sm">
              Try Again
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className={cn('space-y-6', className)}>
      {/* Session Statistics Dashboard */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Sessions</CardTitle>
            <svg
              className="h-4 w-4 text-muted-foreground"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
              />
            </svg>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.active || 0}</div>
            <p className="text-xs text-muted-foreground">
              of {stats?.total || 0} total sessions
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Security Score</CardTitle>
            <svg
              className="h-4 w-4 text-muted-foreground"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
              />
            </svg>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{securityMetrics.averageScore}/100</div>
            <p className="text-xs text-muted-foreground">
              average security score
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Security Alerts</CardTitle>
            <svg
              className="h-4 w-4 text-muted-foreground"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z"
              />
            </svg>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {securityMetrics.suspicious}
            </div>
            <p className="text-xs text-muted-foreground">
              suspicious sessions
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Expiring Soon</CardTitle>
            <svg
              className="h-4 w-4 text-muted-foreground"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-600">
              {securityMetrics.expiringSoon}
            </div>
            <p className="text-xs text-muted-foreground">
              within 24 hours
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <svg
              className="h-5 w-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M13 10V3L4 14h7v7l9-11h-7z"
              />
            </svg>
            Quick Actions
          </CardTitle>
          <CardDescription>
            Manage all your sessions with bulk operations
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-center gap-3">
            <SessionRefreshButton onSuccess={refresh} />
            
            <BulkSessionRefreshButton onSuccess={refresh} />
            
            <Button
              variant="destructive"
              size="sm"
              onClick={handleTerminateAll}
              disabled={isLoading}
            >
              <svg className="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
              Terminate All Others
            </Button>

            <Separator orientation="vertical" className="h-8" />

            <AutoRefreshToggle
              enabled={autoRefreshEnabled}
              onToggle={setAutoRefreshEnabled}
              interval={60}
            />

            <Button
              variant="outline"
              size="sm"
              onClick={refresh}
              disabled={isLoading}
            >
              {isLoading ? (
                <div className="flex items-center gap-2">
                  <div className="h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent" />
                  Refreshing...
                </div>
              ) : (
                <>
                  <svg className="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  Refresh List
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Security Recommendations */}
      {(securityMetrics.suspicious > 0 || securityMetrics.expiringSoon > 0) && (
        <Card className="border-amber-200 bg-amber-50/50 dark:border-amber-800 dark:bg-amber-900/10">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-amber-800 dark:text-amber-200">
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
              Security Recommendations
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {securityMetrics.suspicious > 0 && (
              <div className="flex items-start gap-3">
                <Badge variant="destructive" className="mt-0.5">
                  {securityMetrics.suspicious}
                </Badge>
                <div>
                  <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
                    Suspicious sessions detected
                  </p>
                  <p className="text-xs text-amber-700 dark:text-amber-300">
                    Review and terminate any sessions you don&apos;t recognize
                  </p>
                </div>
              </div>
            )}
            
            {securityMetrics.expiringSoon > 0 && (
              <div className="flex items-start gap-3">
                <Badge variant="outline" className="mt-0.5 border-amber-500 text-amber-600">
                  {securityMetrics.expiringSoon}
                </Badge>
                <div>
                  <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
                    Sessions expiring soon
                  </p>
                  <p className="text-xs text-amber-700 dark:text-amber-300">
                    Refresh these sessions to extend their validity
                  </p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Session Management Tabs */}
      <Tabs defaultValue="all" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="all">All Sessions</TabsTrigger>
          <TabsTrigger value="active">Active Only</TabsTrigger>
          <TabsTrigger value="security">Security Review</TabsTrigger>
        </TabsList>

        <TabsContent value="all" className="space-y-4">
          <ActiveSessionsList
            sessions={sessions}
            stats={stats!}
            onRefresh={handleRefreshSession}
            onTerminate={handleTerminateSession}
            onBulkTerminate={handleBulkTerminate}
            onRefreshAll={handleRefreshAll}
            onTerminateAll={handleTerminateAll}
            isLoading={isLoading}
          />
        </TabsContent>

        <TabsContent value="active" className="space-y-4">
          <ActiveSessionsList
            sessions={sessions.filter(s => !s.isExpired)}
            stats={stats!}
            onRefresh={handleRefreshSession}
            onTerminate={handleTerminateSession}
            onBulkTerminate={handleBulkTerminate}
            onRefreshAll={handleRefreshAll}
            onTerminateAll={handleTerminateAll}
            isLoading={isLoading}
          />
        </TabsContent>

        <TabsContent value="security" className="space-y-4">
          <ActiveSessionsList
            sessions={sessions.filter(s => s.trustLevel === 'suspicious' || s.isExpiringSoon)}
            stats={stats!}
            onRefresh={handleRefreshSession}
            onTerminate={handleTerminateSession}
            onBulkTerminate={handleBulkTerminate}
            onRefreshAll={handleRefreshAll}
            onTerminateAll={handleTerminateAll}
            isLoading={isLoading}
          />
        </TabsContent>
      </Tabs>

      {/* Last Updated */}
      {stats?.lastActivity && (
        <div className="text-center text-sm text-slate-500 dark:text-slate-400">
          Last updated {formatDistanceToNow(new Date(stats.lastActivity), { addSuffix: true })}
        </div>
      )}

      {/* Terminate Dialog */}
      <SessionTerminateDialog
        open={terminateDialog.open}
        onOpenChange={(open) => 
          setTerminateDialog(prev => ({ ...prev, open }))
        }
        sessionId={terminateDialog.sessionId}
        sessionIds={terminateDialog.sessionIds}
        operation={terminateDialog.operation}
        onConfirm={handleConfirmTerminate}
        isLoading={isLoading}
      />
    </div>
  );
}