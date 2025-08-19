/**
 * Session Terminate Dialog Component
 * NextJS Stripe Payment Template
 * 
 * Confirmation dialog for session termination with options for
 * single, bulk, or all session termination operations.
 */

'use client';

import { useState } from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Separator } from '@/components/ui/separator';
import type { SessionTerminateDialogProps, SessionTerminateOptions } from '@/types/auth/sessions';

/**
 * Dialog for confirming session termination with security warnings
 */
export function SessionTerminateDialog({
  open,
  onOpenChange,
  sessionId,
  sessionIds = [],
  operation,
  onConfirm,
  isLoading = false,
}: SessionTerminateDialogProps) {
  const [reason, setReason] = useState('user_requested');
  const [confirmCurrent, setConfirmCurrent] = useState(false);
  const [customReason, setCustomReason] = useState('');
  const [useCustomReason, setUseCustomReason] = useState(false);

  const isCurrentSession = sessionId ? sessionId.includes('current') : false; // This would be determined by session data
  const isBulkOperation = operation === 'bulk' || operation === 'all';
  const sessionCount = operation === 'bulk' ? sessionIds.length : operation === 'all' ? 'all other' : 1;

  const handleConfirm = () => {
    const options: SessionTerminateOptions = {
      reason: useCustomReason && customReason ? customReason : reason,
      confirmCurrent: confirmCurrent,
    };

    if (operation === 'bulk') {
      options.sessionIds = sessionIds;
    } else if (operation === 'all') {
      options.excludeCurrent = !confirmCurrent;
    }

    onConfirm(options);
  };

  const getDialogTitle = () => {
    switch (operation) {
      case 'single':
        return isCurrentSession ? 'Sign Out of Current Session?' : 'Terminate Session?';
      case 'bulk':
        return `Terminate ${sessionIds.length} Sessions?`;
      case 'all':
        return 'Terminate All Other Sessions?';
      default:
        return 'Terminate Session?';
    }
  };

  const getDialogDescription = () => {
    switch (operation) {
      case 'single':
        return isCurrentSession 
          ? 'You are about to sign out of your current session. You will be redirected to the login page.'
          : 'This session will be immediately terminated and the user will be signed out.';
      case 'bulk':
        return `${sessionIds.length} sessions will be immediately terminated. Any active users on these sessions will be signed out.`;
      case 'all':
        return 'All other sessions (excluding your current session) will be terminated. This will sign out any other devices you&apos;re logged in on.';
      default:
        return 'This action cannot be undone.';
    }
  };

  const reasonOptions = [
    { value: 'user_requested', label: 'User requested' },
    { value: 'security_concern', label: 'Security concern' },
    { value: 'suspicious_activity', label: 'Suspicious activity' },
    { value: 'device_lost', label: 'Device lost or stolen' },
    { value: 'maintenance', label: 'Maintenance' },
    { value: 'other', label: 'Other (specify below)' },
  ];

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-w-lg">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <svg
              className="h-5 w-5 text-red-500"
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
            {getDialogTitle()}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {getDialogDescription()}
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="space-y-4">
          {isBulkOperation && (
            <div className="rounded-md bg-amber-50 dark:bg-amber-900/20 p-3">
              <div className="flex">
                <div className="flex-shrink-0">
                  <svg
                    className="h-4 w-4 text-amber-400"
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
                  <div className="text-sm text-amber-800 dark:text-amber-200">
                    <strong>Warning:</strong> This action will affect multiple sessions and cannot be undone.
                  </div>
                </div>
              </div>
            </div>
          )}

          {isCurrentSession && (
            <div className="rounded-md bg-blue-50 dark:bg-blue-900/20 p-3">
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
                  <div className="text-sm text-blue-800 dark:text-blue-200">
                    <strong>Note:</strong> Terminating your current session will sign you out immediately.
                  </div>
                </div>
              </div>
            </div>
          )}

          <Separator />

          {/* Reason Selection */}
          <div className="space-y-3">
            <Label className="text-sm font-medium">Reason for termination</Label>
            <div className="grid gap-2">
              {reasonOptions.map((option) => (
                <div key={option.value} className="flex items-center space-x-2">
                  <input
                    type="radio"
                    id={option.value}
                    name="reason"
                    value={option.value}
                    checked={reason === option.value}
                    onChange={(e) => {
                      setReason(e.target.value);
                      setUseCustomReason(e.target.value === 'other');
                    }}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300"
                  />
                  <Label htmlFor={option.value} className="text-sm cursor-pointer">
                    {option.label}
                  </Label>
                </div>
              ))}
            </div>

            {useCustomReason && (
              <div className="mt-2">
                <Input
                  placeholder="Please specify the reason..."
                  value={customReason}
                  onChange={(e) => setCustomReason(e.target.value)}
                  className="w-full"
                />
              </div>
            )}
          </div>

          {/* Current Session Confirmation */}
          {(isCurrentSession || operation === 'all') && (
            <div className="space-y-3">
              <Separator />
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="confirm-current"
                  checked={confirmCurrent}
                  onCheckedChange={setConfirmCurrent}
                />
                <Label htmlFor="confirm-current" className="text-sm">
                  {isCurrentSession 
                    ? 'I understand this will sign me out immediately'
                    : 'Also terminate my current session (this will sign me out)'
                  }
                </Label>
              </div>
            </div>
          )}

          {/* Session Count Summary */}
          <div className="rounded-md bg-slate-50 dark:bg-slate-800 p-3">
            <div className="text-sm">
              <div className="flex items-center justify-between">
                <span className="text-slate-600 dark:text-slate-400">Sessions to terminate:</span>
                <Badge variant="destructive">
                  {typeof sessionCount === 'number' ? sessionCount : sessionCount}
                </Badge>
              </div>
              {operation === 'all' && (
                <p className="text-xs text-slate-500 mt-1">
                  {confirmCurrent ? 'Including current session' : 'Excluding current session'}
                </p>
              )}
            </div>
          </div>
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel disabled={isLoading}>
            Cancel
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={handleConfirm}
            disabled={isLoading || (useCustomReason && !customReason.trim())}
            className="bg-red-600 hover:bg-red-700 focus:ring-red-500"
          >
            {isLoading ? (
              <div className="flex items-center gap-2">
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                Terminating...
              </div>
            ) : (
              <>
                {isCurrentSession ? 'Sign Out' : 'Terminate'}
                {isBulkOperation && ` ${typeof sessionCount === 'number' ? sessionCount : ''} Sessions`}
              </>
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}