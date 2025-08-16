/**
 * Active Sessions List Component
 * NextJS Stripe Payment Template
 * 
 * Grid/list view of all active sessions with search, filter,
 * and bulk action capabilities.
 */

'use client';

import { useState, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { SessionCard } from './SessionCard';
import type { ActiveSessionsListProps, SessionFilters, SessionSortOptions } from '@/types/auth/sessions';
import { cn } from '@/lib/utils';

/**
 * Active sessions list with filtering and bulk operations
 */
export function ActiveSessionsList({
  sessions,
  stats: _stats,
  onRefresh,
  onTerminate,
  onBulkTerminate,
  onRefreshAll,
  onTerminateAll,
  isLoading = false,
  className,
}: ActiveSessionsListProps) {
  const [selectedSessions, setSelectedSessions] = useState<Set<string>>(new Set());
  const [searchTerm, setSearchTerm] = useState('');
  const [filters, setFilters] = useState<SessionFilters>({
    includeExpired: false,
  });
  const [sortOptions, setSortOptions] = useState<SessionSortOptions>({
    field: 'lastActivityAt',
    direction: 'desc',
  });
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  // Filter and sort sessions
  const filteredAndSortedSessions = useMemo(() => {
    const filtered = sessions.filter(session => {
      // Search filter
      if (searchTerm) {
        const searchLower = searchTerm.toLowerCase();
        const matchesSearch = 
          session.deviceType.toLowerCase().includes(searchLower) ||
          session.browser.toLowerCase().includes(searchLower) ||
          session.location.toLowerCase().includes(searchLower) ||
          session.ipAddress.includes(searchLower);
        
        if (!matchesSearch) return false;
      }

      // Expired filter
      if (!filters.includeExpired && session.isExpired) {
        return false;
      }

      // Device type filter
      if (filters.deviceType && filters.deviceType.length > 0) {
        if (!filters.deviceType.includes(session.deviceType)) return false;
      }

      // Browser filter
      if (filters.browser && filters.browser.length > 0) {
        if (!filters.browser.includes(session.browser)) return false;
      }

      // Trust level filter
      if (filters.trustLevel && filters.trustLevel.length > 0) {
        if (!filters.trustLevel.includes(session.trustLevel)) return false;
      }

      return true;
    });

    // Sort sessions
    filtered.sort((a, b) => {
      let aValue: string | number | Date;
      let bValue: string | number | Date;

      switch (sortOptions.field) {
        case 'createdAt':
          aValue = new Date(a.createdAt);
          bValue = new Date(b.createdAt);
          break;
        case 'lastActivityAt':
          aValue = new Date(a.lastActivityAt || a.createdAt);
          bValue = new Date(b.lastActivityAt || b.createdAt);
          break;
        case 'expiresAt':
          aValue = new Date(a.expiresAt);
          bValue = new Date(b.expiresAt);
          break;
        case 'deviceType':
          aValue = a.deviceType;
          bValue = b.deviceType;
          break;
        case 'location':
          aValue = a.location;
          bValue = b.location;
          break;
        default:
          aValue = a.createdAt;
          bValue = b.createdAt;
      }

      if (aValue < bValue) return sortOptions.direction === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortOptions.direction === 'asc' ? 1 : -1;
      return 0;
    });

    return filtered;
  }, [sessions, searchTerm, filters, sortOptions]);

  // Session selection handlers
  const handleSelectSession = (sessionId: string, checked: boolean) => {
    const newSelection = new Set(selectedSessions);
    if (checked) {
      newSelection.add(sessionId);
    } else {
      newSelection.delete(sessionId);
    }
    setSelectedSessions(newSelection);
  };

  const handleSelectAll = () => {
    if (selectedSessions.size === filteredAndSortedSessions.length) {
      setSelectedSessions(new Set());
    } else {
      setSelectedSessions(new Set(filteredAndSortedSessions.map(s => s.id)));
    }
  };

  const handleBulkTerminate = () => {
    if (onBulkTerminate && selectedSessions.size > 0) {
      onBulkTerminate(Array.from(selectedSessions));
      setSelectedSessions(new Set());
    }
  };

  // Get unique filter options
  const deviceTypes = useMemo(() => 
    [...new Set(sessions.map(s => s.deviceType))].sort()
  , [sessions]);

  const browsers = useMemo(() => 
    [...new Set(sessions.map(s => s.browser))].sort()
  , [sessions]);

  return (
    <div className={cn('space-y-6', className)}>
      {/* Search and Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Session Filters</CardTitle>
          <CardDescription>
            Search and filter your active sessions
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Search */}
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <Input
                placeholder="Search sessions by device, browser, location, or IP..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full"
              />
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant={viewMode === 'grid' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setViewMode('grid')}
              >
                Grid
              </Button>
              <Button
                variant={viewMode === 'list' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setViewMode('list')}
              >
                List
              </Button>
            </div>
          </div>

          {/* Filters */}
          <div className="grid gap-4 md:grid-cols-4">
            <Select
              value={filters.deviceType?.[0] || 'all-devices'}
              onValueChange={(value) => 
                setFilters(prev => ({ 
                  ...prev, 
                  deviceType: (value && value !== 'all-devices') ? [value] : undefined 
                }))
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Device Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all-devices">All Devices</SelectItem>
                {deviceTypes.map(type => (
                  <SelectItem key={type} value={type}>{type}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              value={filters.browser?.[0] || 'all-browsers'}
              onValueChange={(value) => 
                setFilters(prev => ({ 
                  ...prev, 
                  browser: (value && value !== 'all-browsers') ? [value] : undefined 
                }))
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Browser" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all-browsers">All Browsers</SelectItem>
                {browsers.map(browser => (
                  <SelectItem key={browser} value={browser}>{browser}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              value={filters.trustLevel?.[0] || 'all-levels'}
              onValueChange={(value) => 
                setFilters(prev => ({ 
                  ...prev, 
                  trustLevel: (value && value !== 'all-levels') ? [value as any] : undefined 
                }))
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Trust Level" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all-levels">All Levels</SelectItem>
                <SelectItem value="trusted">Trusted</SelectItem>
                <SelectItem value="unknown">Unknown</SelectItem>
                <SelectItem value="suspicious">Suspicious</SelectItem>
              </SelectContent>
            </Select>

            <Select
              value={`${sortOptions.field}-${sortOptions.direction}`}
              onValueChange={(value) => {
                const [field, direction] = value.split('-') as [SessionSortOptions['field'], SessionSortOptions['direction']];
                setSortOptions({ field, direction });
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Sort By" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="lastActivityAt-desc">Recent Activity</SelectItem>
                <SelectItem value="createdAt-desc">Newest First</SelectItem>
                <SelectItem value="createdAt-asc">Oldest First</SelectItem>
                <SelectItem value="expiresAt-asc">Expiring Soon</SelectItem>
                <SelectItem value="deviceType-asc">Device A-Z</SelectItem>
                <SelectItem value="location-asc">Location A-Z</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Options */}
          <div className="flex items-center gap-4">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="include-expired"
                checked={filters.includeExpired}
                onCheckedChange={(checked) => 
                  setFilters(prev => ({ ...prev, includeExpired: checked as boolean }))
                }
              />
              <label
                htmlFor="include-expired"
                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
              >
                Include expired sessions
              </label>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Session Stats and Actions */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="text-sm text-slate-600 dark:text-slate-400">
            Showing {filteredAndSortedSessions.length} of {sessions.length} sessions
          </div>
          {filteredAndSortedSessions.length > 0 && (
            <div className="flex items-center gap-2">
              <Checkbox
                checked={selectedSessions.size === filteredAndSortedSessions.length && filteredAndSortedSessions.length > 0}
                onCheckedChange={handleSelectAll}
              />
              <span className="text-sm">Select All</span>
            </div>
          )}
          {selectedSessions.size > 0 && (
            <Badge variant="secondary">
              {selectedSessions.size} selected
            </Badge>
          )}
        </div>

        <div className="flex items-center gap-2">
          {selectedSessions.size > 0 && onBulkTerminate && (
            <Button
              variant="destructive"
              size="sm"
              onClick={handleBulkTerminate}
              disabled={isLoading}
            >
              Terminate Selected ({selectedSessions.size})
            </Button>
          )}

          {onRefreshAll && (
            <Button
              variant="outline"
              size="sm"
              onClick={onRefreshAll}
              disabled={isLoading}
            >
              Refresh All
            </Button>
          )}

          {onTerminateAll && (
            <Button
              variant="destructive"
              size="sm"
              onClick={onTerminateAll}
              disabled={isLoading}
            >
              Terminate All Others
            </Button>
          )}
        </div>
      </div>

      <Separator />

      {/* Sessions Grid/List */}
      {filteredAndSortedSessions.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <div className="text-center space-y-3">
              <svg
                className="mx-auto h-12 w-12 text-slate-400"
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
              <h3 className="text-lg font-medium text-slate-900 dark:text-slate-100">
                No sessions found
              </h3>
              <p className="text-slate-600 dark:text-slate-400">
                {searchTerm || Object.values(filters).some(Boolean) 
                  ? 'Try adjusting your search or filters'
                  : 'You have no active sessions'
                }
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className={cn(
          viewMode === 'grid' 
            ? 'grid gap-4 sm:grid-cols-2 lg:grid-cols-3' 
            : 'space-y-4'
        )}>
          {filteredAndSortedSessions.map((session) => (
            <div key={session.id} className="relative">
              {/* Selection checkbox for bulk operations */}
              <div className="absolute top-3 left-3 z-10">
                <Checkbox
                  checked={selectedSessions.has(session.id)}
                  onCheckedChange={(checked) => 
                    handleSelectSession(session.id, checked as boolean)
                  }
                  className="bg-white dark:bg-slate-800 border-2"
                />
              </div>

              <SessionCard
                session={session}
                onRefresh={onRefresh}
                onTerminate={onTerminate}
                isLoading={isLoading}
                className={cn(
                  'transition-all duration-200',
                  selectedSessions.has(session.id) && 'ring-2 ring-blue-500 ring-opacity-50'
                )}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}