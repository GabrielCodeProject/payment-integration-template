"use client";

import * as React from "react";
import { 
  Shield, 
  ShieldCheck, 
  ShieldAlert, 
  Wifi, 
  WifiOff,
  AlertTriangle
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useSession } from "@/lib/auth/client";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

export interface SessionIndicatorProps {
  /** Display variant */
  variant?: "badge" | "dot" | "full";
  /** Size of the indicator */
  size?: "sm" | "md" | "lg";
  /** Show session details on hover */
  showTooltip?: boolean;
  /** Additional className */
  className?: string;
}

/**
 * Session status indicator component that shows authentication state
 */
export function SessionIndicator({
  variant = "badge",
  size = "md",
  showTooltip = true,
  className
}: SessionIndicatorProps) {
  const { data: session, isPending } = useSession();
  const [isOnline, setIsOnline] = React.useState(true);

  // Monitor online/offline status
  React.useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  if (isPending) {
    return (
      <div className={cn("animate-pulse", className)}>
        {variant === "dot" ? (
          <div className="w-2 h-2 bg-slate-300 dark:bg-slate-600 rounded-full" />
        ) : (
          <Badge variant="secondary" className="bg-slate-200 dark:bg-slate-700">
            <div className="w-12 h-3 bg-slate-300 dark:bg-slate-600 rounded" />
          </Badge>
        )}
      </div>
    );
  }

  const getSessionStatus = () => {
    if (!session) {
      return {
        status: "unauthenticated",
        label: "Not signed in",
        color: "slate",
        icon: Shield,
        description: "User is not authenticated"
      };
    }

    if (!isOnline) {
      return {
        status: "offline",
        label: "Offline",
        color: "orange",
        icon: WifiOff,
        description: "No internet connection detected"
      };
    }

    // Check if session is about to expire (example: within 5 minutes)
    const now = Date.now();
    const sessionExpiry = session.expiresAt ? new Date(session.expiresAt).getTime() : now + (24 * 60 * 60 * 1000);
    const timeUntilExpiry = sessionExpiry - now;
    const fiveMinutes = 5 * 60 * 1000;

    if (timeUntilExpiry <= fiveMinutes && timeUntilExpiry > 0) {
      return {
        status: "expiring",
        label: "Expiring soon",
        color: "yellow",
        icon: AlertTriangle,
        description: "Session expires in less than 5 minutes"
      };
    }

    if (timeUntilExpiry <= 0) {
      return {
        status: "expired",
        label: "Expired",
        color: "red",
        icon: ShieldAlert,
        description: "Session has expired"
      };
    }

    return {
      status: "authenticated",
      label: "Authenticated",
      color: "green",
      icon: ShieldCheck,
      description: "User is authenticated and session is active"
    };
  };

  const statusInfo = getSessionStatus();

  const colorClasses = {
    green: {
      badge: "bg-green-100 text-green-700 border-green-200 dark:bg-green-900/20 dark:text-green-400 dark:border-green-800",
      dot: "bg-green-500",
    },
    red: {
      badge: "bg-red-100 text-red-700 border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800",
      dot: "bg-red-500",
    },
    yellow: {
      badge: "bg-yellow-100 text-yellow-700 border-yellow-200 dark:bg-yellow-900/20 dark:text-yellow-400 dark:border-yellow-800",
      dot: "bg-yellow-500",
    },
    orange: {
      badge: "bg-orange-100 text-orange-700 border-orange-200 dark:bg-orange-900/20 dark:text-orange-400 dark:border-orange-800",
      dot: "bg-orange-500",
    },
    slate: {
      badge: "bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700",
      dot: "bg-slate-400",
    },
  };

  const sizeClasses = {
    sm: {
      dot: "w-2 h-2",
      badge: "text-xs px-2 py-0.5",
      full: "text-sm",
    },
    md: {
      dot: "w-3 h-3",
      badge: "text-sm px-2.5 py-1",
      full: "text-sm",
    },
    lg: {
      dot: "w-4 h-4",
      badge: "text-sm px-3 py-1.5",
      full: "text-base",
    },
  };

  const IconComponent = statusInfo.icon;

  const renderIndicator = () => {
    if (variant === "dot") {
      return (
        <div
          className={cn(
            "rounded-full border-2 border-white dark:border-slate-800",
            colorClasses[statusInfo.color as keyof typeof colorClasses].dot,
            sizeClasses[size].dot,
            className
          )}
          aria-label={statusInfo.label}
        />
      );
    }

    if (variant === "badge") {
      return (
        <Badge
          variant="secondary"
          className={cn(
            colorClasses[statusInfo.color as keyof typeof colorClasses].badge,
            sizeClasses[size].badge,
            className
          )}
        >
          <IconComponent className="w-3 h-3 mr-1" />
          {statusInfo.label}
        </Badge>
      );
    }

    // Full variant
    return (
      <div className={cn("flex items-center gap-2", sizeClasses[size].full, className)}>
        <div
          className={cn(
            "w-2 h-2 rounded-full",
            colorClasses[statusInfo.color as keyof typeof colorClasses].dot
          )}
        />
        <IconComponent className="w-4 h-4" />
        <span className="font-medium">{statusInfo.label}</span>
      </div>
    );
  };

  if (!showTooltip) {
    return renderIndicator();
  }

  // Get additional session details for tooltip
  const getSessionDetails = () => {
    if (!session) return null;

    const details = [];
    
    if (session.user?.email) {
      details.push(`Email: ${session.user.email}`);
    }
    
    if (session.user?.role) {
      details.push(`Role: ${session.user.role}`);
    }

    if (session.expiresAt) {
      const expiry = new Date(session.expiresAt);
      details.push(`Expires: ${expiry.toLocaleString()}`);
    }

    return details;
  };

  const sessionDetails = getSessionDetails();

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          {renderIndicator()}
        </TooltipTrigger>
        <TooltipContent side="bottom" className="max-w-xs">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <IconComponent className="w-4 h-4" />
              <span className="font-medium">{statusInfo.label}</span>
            </div>
            <p className="text-xs text-muted-foreground">
              {statusInfo.description}
            </p>
            {sessionDetails && (
              <div className="border-t pt-2 space-y-1">
                {sessionDetails.map((detail, index) => (
                  <div key={index} className="text-xs text-muted-foreground">
                    {detail}
                  </div>
                ))}
              </div>
            )}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

/**
 * Simple session status component without tooltip
 */
export function SessionStatus({ className }: { className?: string }) {
  return (
    <SessionIndicator
      variant="dot"
      size="sm"
      showTooltip={false}
      className={className}
    />
  );
}

/**
 * Connection status indicator
 */
export function ConnectionIndicator({ className }: { className?: string }) {
  const [isOnline, setIsOnline] = React.useState(true);

  React.useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    setIsOnline(navigator.onLine);
    
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className={cn("flex items-center gap-1", className)}>
            {isOnline ? (
              <Wifi className="w-4 h-4 text-green-500" />
            ) : (
              <WifiOff className="w-4 h-4 text-red-500" />
            )}
          </div>
        </TooltipTrigger>
        <TooltipContent>
          <p>{isOnline ? "Connected" : "Offline"}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}