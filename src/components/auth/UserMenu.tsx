"use client";

// UserMenu component for displaying user information and actions
import { User, Settings } from "lucide-react";

import { useSession } from "@/lib/auth/client";
import { Button } from "@/components/ui/button";
import { LogoutButton } from "./LogoutButton";

interface UserMenuProps {
  showUserInfo?: boolean;
  orientation?: "horizontal" | "vertical";
  className?: string;
}

export function UserMenu({ 
  showUserInfo = true, 
  orientation = "horizontal",
  className 
}: UserMenuProps) {
  const { data: session, isPending } = useSession();

  // Show loading state
  if (isPending) {
    return (
      <div className={`flex items-center gap-2 ${className}`}>
        <div className="h-8 w-8 bg-slate-200 dark:bg-slate-700 rounded-full animate-pulse" />
        {showUserInfo && (
          <div className="space-y-1">
            <div className="h-3 w-20 bg-slate-200 dark:bg-slate-700 rounded animate-pulse" />
            <div className="h-2 w-16 bg-slate-200 dark:bg-slate-700 rounded animate-pulse" />
          </div>
        )}
      </div>
    );
  }

  // If no session, show sign in button
  if (!session) {
    return (
      <div className={className}>
        <Button
          variant="outline"
          size="sm"
          onClick={() => window.location.href = "/login"}
        >
          Sign in
        </Button>
      </div>
    );
  }

  const containerClass = orientation === "vertical" 
    ? "flex flex-col gap-3" 
    : "flex items-center gap-3";

  return (
    <div className={`${containerClass} ${className}`}>
      {/* User Avatar and Info */}
      <div className="flex items-center gap-2">
        <div className="h-8 w-8 bg-blue-600 rounded-full flex items-center justify-center">
          <User className="h-4 w-4 text-white" />
        </div>
        
        {showUserInfo && (
          <div className="flex flex-col">
            <span className="text-sm font-medium text-slate-900 dark:text-slate-100 leading-none">
              {session.user.name || session.user.email?.split("@")[0] || "User"}
            </span>
            <span className="text-xs text-slate-500 dark:text-slate-400 leading-none mt-1">
              {session.user.email}
            </span>
          </div>
        )}
      </div>

      {/* Action Buttons */}
      <div className={orientation === "vertical" ? "flex flex-col gap-2 w-full" : "flex items-center gap-1"}>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => window.location.href = "/settings"}
          className={orientation === "vertical" ? "justify-start" : ""}
        >
          <Settings className="h-4 w-4" />
          {orientation === "vertical" && "Settings"}
        </Button>

        <LogoutButton
          variant="ghost"
          size="sm"
          showConfirmDialog={true}
          className={orientation === "vertical" ? "justify-start text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950" : "text-red-600 hover:text-red-700"}
        >
          {orientation === "vertical" && "Sign out"}
        </LogoutButton>
      </div>
    </div>
  );
}

// Simpler user info component for minimal displays
export function UserInfo({ className }: { className?: string }) {
  const { data: session, isPending } = useSession();

  if (isPending) {
    return (
      <div className={`flex items-center gap-2 ${className}`}>
        <div className="h-6 w-6 bg-slate-200 dark:bg-slate-700 rounded-full animate-pulse" />
        <div className="h-3 w-16 bg-slate-200 dark:bg-slate-700 rounded animate-pulse" />
      </div>
    );
  }

  if (!session) {
    return null;
  }

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <div className="h-6 w-6 bg-blue-600 rounded-full flex items-center justify-center">
        <User className="h-3 w-3 text-white" />
      </div>
      <span className="text-sm text-slate-700 dark:text-slate-300">
        {session.user.name || session.user.email?.split("@")[0] || "User"}
      </span>
    </div>
  );
}