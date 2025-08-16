/**
 * Session Management Types
 * NextJS Stripe Payment Template
 * 
 * Type definitions for session management features including
 * session data structures, API responses, and component props.
 */

// Base session data structure from API
export interface SessionData {
  id: string;
  userId: string;
  hasToken: boolean;
  expiresAt: string;
  createdAt: string;
  updatedAt: string;
  lastActivityAt?: string;
  ipAddress: string;
  userAgent: string;
  deviceType: string;
  browser: string;
  location: string;
  isCurrent: boolean;
}

// Enhanced session data with computed properties
export interface EnhancedSessionData extends SessionData {
  isExpired: boolean;
  isExpiringSoon: boolean; // Within 24 hours
  timeRemaining?: string;
  securityScore: number;
  trustLevel: 'trusted' | 'suspicious' | 'unknown';
  deviceIcon: string;
  locationFlag?: string;
}

// Session statistics from API
export interface SessionStats {
  total: number;
  active: number;
  expired: number;
  currentSessionId: string;
  lastActivity?: string;
  averageSessionDuration?: number;
  uniqueDevices: number;
  uniqueLocations: number;
}

// API Response types
export interface SessionsResponse {
  success: boolean;
  data: {
    sessions: SessionData[];
    stats: SessionStats;
    meta: {
      includeExpired: boolean;
      includeSecurity: boolean;
      currentSessionId: string;
    };
  };
}

export interface SessionDetailResponse {
  success: boolean;
  data: {
    session: SessionData & {
      isExpired: boolean;
      isCurrent: boolean;
      deviceType: string;
      browser: string;
      location: string;
    };
  };
}

export interface SessionOperationResponse {
  success: boolean;
  data: {
    operation: string;
    sessionId?: string;
    terminatedCount?: number;
    excludedCurrentSession?: boolean;
    reason: string;
    session?: {
      id: string;
      userId: string;
      expiresAt: string;
      updatedAt: string;
    };
  };
}

// Session operation types
export type SessionOperation = 
  | 'refresh'
  | 'terminate'
  | 'terminateAll'
  | 'terminateSelected'
  | 'extend'
  | 'touch';

export interface SessionRefreshOptions {
  sessionId?: string;
  extendDuration?: number; // seconds
  reason?: string;
}

export interface SessionTerminateOptions {
  sessionIds?: string[];
  excludeCurrent?: boolean;
  reason?: string;
  confirmCurrent?: boolean;
}

// Component prop types
export interface SessionCardProps {
  session: EnhancedSessionData;
  onRefresh?: (sessionId: string) => void;
  onTerminate?: (sessionId: string) => void;
  onViewDetails?: (sessionId: string) => void;
  isLoading?: boolean;
  className?: string;
}

export interface ActiveSessionsListProps {
  sessions: EnhancedSessionData[];
  stats: SessionStats;
  onRefresh?: (sessionId: string) => void;
  onTerminate?: (sessionId: string) => void;
  onBulkTerminate?: (sessionIds: string[]) => void;
  onRefreshAll?: () => void;
  onTerminateAll?: () => void;
  isLoading?: boolean;
  className?: string;
}

export interface SessionManagerProps {
  className?: string;
}

export interface SessionRefreshButtonProps {
  sessionId?: string;
  variant?: 'default' | 'outline' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  onSuccess?: () => void;
  onError?: (error: string) => void;
  className?: string;
}

export interface SessionTerminateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sessionId?: string;
  sessionIds?: string[];
  operation: 'single' | 'bulk' | 'all';
  onConfirm: (options: SessionTerminateOptions) => void;
  isLoading?: boolean;
}

// Hook return types
export interface UseSessionsReturn {
  sessions: EnhancedSessionData[];
  stats: SessionStats | null;
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  refreshSession: (sessionId: string, options?: SessionRefreshOptions) => Promise<void>;
  terminateSession: (sessionId: string, options?: SessionTerminateOptions) => Promise<void>;
  terminateAllSessions: (options?: SessionTerminateOptions) => Promise<void>;
  bulkTerminate: (sessionIds: string[], options?: SessionTerminateOptions) => Promise<void>;
}

export interface UseSessionOperationsReturn {
  refreshSession: (sessionId: string, options?: SessionRefreshOptions) => Promise<SessionOperationResponse>;
  terminateSession: (sessionId: string, options?: SessionTerminateOptions) => Promise<SessionOperationResponse>;
  terminateAllSessions: (options?: SessionTerminateOptions) => Promise<SessionOperationResponse>;
  extendSession: (sessionId: string, options?: SessionRefreshOptions) => Promise<SessionOperationResponse>;
  isLoading: boolean;
  error: string | null;
}

// Filter and sort options
export interface SessionFilters {
  deviceType?: string[];
  browser?: string[];
  trustLevel?: ('trusted' | 'suspicious' | 'unknown')[];
  includeExpired?: boolean;
  search?: string;
}

export interface SessionSortOptions {
  field: 'createdAt' | 'lastActivityAt' | 'expiresAt' | 'deviceType' | 'location';
  direction: 'asc' | 'desc';
}

// Security scoring parameters
export interface SecurityFactors {
  deviceRecognition: number;
  locationConsistency: number;
  sessionAge: number;
  activityPattern: number;
  ipReputation: number;
}

// Device type mapping
export const DEVICE_TYPES = {
  Desktop: 'desktop',
  Mobile: 'mobile',
  Tablet: 'tablet',
  Unknown: 'unknown',
} as const;

export const DEVICE_ICONS = {
  Desktop: 'monitor',
  Mobile: 'smartphone',
  Tablet: 'tablet',
  Unknown: 'device-unknown',
} as const;

// Browser type mapping
export const BROWSER_TYPES = {
  Chrome: 'chrome',
  Firefox: 'firefox',
  Safari: 'safari',
  Edge: 'edge',
  Opera: 'opera',
  Other: 'browser',
} as const;

// Trust level colors and indicators
export const TRUST_LEVEL_CONFIG = {
  trusted: {
    color: 'green',
    label: 'Trusted',
    icon: 'shield-check',
  },
  suspicious: {
    color: 'red',
    label: 'Suspicious',
    icon: 'shield-alert',
  },
  unknown: {
    color: 'yellow',
    label: 'Unknown',
    icon: 'shield-question',
  },
} as const;

// Session duration constants
export const SESSION_DURATION = {
  EXPIRING_SOON_THRESHOLD: 24 * 60 * 60 * 1000, // 24 hours in milliseconds
  DEFAULT_EXTEND_DURATION: 7 * 24 * 60 * 60, // 7 days in seconds
  MAX_EXTEND_DURATION: 30 * 24 * 60 * 60, // 30 days in seconds
} as const;

// API endpoints
export const SESSION_ENDPOINTS = {
  LIST: '/api/auth/sessions',
  DETAIL: (id: string) => `/api/auth/sessions/${id}`,
  REFRESH: '/api/auth/sessions/refresh',
  TERMINATE_ALL: '/api/auth/sessions/terminate-all',
} as const;