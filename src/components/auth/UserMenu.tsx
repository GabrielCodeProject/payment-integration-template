"use client";

// UserMenu component for displaying user information and actions
import { User, Settings, CreditCard, HelpCircle, ChevronDown } from "lucide-react";

import { useSession } from "@/lib/auth/client";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { UserAvatar } from "./Avatar";
import { LogoutButton } from "./LogoutButton";

interface UserMenuProps {
  /** Display style - dropdown or inline buttons */
  variant?: "dropdown" | "inline";
  /** Size of the avatar */
  avatarSize?: "xs" | "sm" | "md" | "lg";
  /** Show user name and email */
  showUserInfo?: boolean;
  /** Orientation for inline variant */
  orientation?: "horizontal" | "vertical";
  /** Additional className */
  className?: string;
  /** Show role badge */
  showRole?: boolean;
}

export function UserMenu({ 
  variant = "dropdown",
  avatarSize = "md",
  showUserInfo = true, 
  orientation = "horizontal",
  className,
  showRole = false
}: UserMenuProps) {
  const { data: session, isPending } = useSession();

  // Show loading state
  if (isPending) {
    return (
      <div className={`flex items-center gap-2 ${className}`}>
        <div className="h-8 w-8 bg-slate-200 dark:bg-slate-700 rounded-full animate-pulse" />
        {showUserInfo && variant === "inline" && (
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

  const userName = session.user.name || session.user.email?.split("@")[0] || "User";
  const userRole = session.user.role || "user";

  // Dropdown variant (recommended for headers/navigation)
  if (variant === "dropdown") {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            className={`h-auto p-2 hover:bg-slate-100 dark:hover:bg-slate-800 ${className}`}
          >
            <div className="flex items-center gap-3">
              <UserAvatar
                name={session.user.name}
                email={session.user.email}
                src={session.user.image}
                size={avatarSize}
              />
              {showUserInfo && (
                <div className="flex flex-col items-start min-w-0">
                  <span className="text-sm font-medium text-slate-900 dark:text-slate-100 leading-none truncate">
                    {userName}
                  </span>
                  <span className="text-xs text-slate-500 dark:text-slate-400 leading-none mt-1 truncate">
                    {session.user.email}
                  </span>
                </div>
              )}
              <ChevronDown className="h-4 w-4 text-slate-500 dark:text-slate-400 shrink-0" />
            </div>
          </Button>
        </DropdownMenuTrigger>
        
        <DropdownMenuContent className="w-64" align="end" forceMount>
          <DropdownMenuLabel className="font-normal">
            <div className="flex flex-col space-y-2">
              <div className="flex items-center gap-2">
                <UserAvatar
                  name={session.user.name}
                  email={session.user.email}
                  src={session.user.image}
                  size="sm"
                />
                <div className="flex flex-col min-w-0">
                  <p className="text-sm font-medium leading-none truncate">
                    {userName}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1 truncate">
                    {session.user.email}
                  </p>
                </div>
              </div>
              {showRole && (
                <div className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 w-fit">
                  {userRole.charAt(0).toUpperCase() + userRole.slice(1)}
                </div>
              )}
            </div>
          </DropdownMenuLabel>
          
          <DropdownMenuSeparator />
          
          <DropdownMenuItem 
            className="cursor-pointer"
            onClick={() => window.location.href = "/profile"}
          >
            <User className="mr-2 h-4 w-4" />
            Profile
          </DropdownMenuItem>
          
          <DropdownMenuItem 
            className="cursor-pointer"
            onClick={() => window.location.href = "/profile/sessions"}
          >
            <Settings className="mr-2 h-4 w-4" />
            Settings
          </DropdownMenuItem>
          
          <DropdownMenuItem 
            className="cursor-pointer"
            onClick={() => window.location.href = "/billing"}
          >
            <CreditCard className="mr-2 h-4 w-4" />
            Billing
          </DropdownMenuItem>
          
          <DropdownMenuItem 
            className="cursor-pointer"
            onClick={() => window.location.href = "/support"}
          >
            <HelpCircle className="mr-2 h-4 w-4" />
            Support
          </DropdownMenuItem>
          
          <DropdownMenuSeparator />
          
          <DropdownMenuItem
            className="cursor-pointer text-red-600 hover:text-red-700 focus:text-red-700 focus:bg-red-50 dark:focus:bg-red-950"
            onClick={() => {
              // Use the LogoutButton's logout functionality
              document.dispatchEvent(new CustomEvent('userLogout'));
            }}
          >
            <LogoutButton
              variant="ghost"
              size="sm"
              showIcon={true}
              showConfirmDialog={true}
              className="w-full justify-start p-0 h-auto font-normal text-red-600 hover:text-red-700 hover:bg-transparent"
            />
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }

  // Inline variant (legacy support)
  const containerClass = orientation === "vertical" 
    ? "flex flex-col gap-3" 
    : "flex items-center gap-3";

  return (
    <div className={`${containerClass} ${className}`}>
      {/* User Avatar and Info */}
      <div className="flex items-center gap-2">
        <UserAvatar
          name={session.user.name}
          email={session.user.email}
          src={session.user.image}
          size={avatarSize}
        />
        
        {showUserInfo && (
          <div className="flex flex-col">
            <span className="text-sm font-medium text-slate-900 dark:text-slate-100 leading-none">
              {userName}
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
          onClick={() => window.location.href = "/profile"}
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

/**
 * Simpler user info component for minimal displays
 */
export interface UserInfoProps {
  /** Additional className */
  className?: string;
  /** Size of the avatar */
  avatarSize?: "xs" | "sm" | "md";
  /** Show online status indicator */
  showStatus?: boolean;
  /** Show user email */
  showEmail?: boolean;
}

export function UserInfo({ 
  className, 
  avatarSize = "sm", 
  showStatus = false,
  showEmail = false 
}: UserInfoProps) {
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

  const userName = session.user.name || session.user.email?.split("@")[0] || "User";

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <UserAvatar
        name={session.user.name}
        email={session.user.email}
        src={session.user.image}
        size={avatarSize}
        showStatus={showStatus}
        isOnline={true} // You can connect this to actual online status
      />
      <div className="flex flex-col min-w-0">
        <span className="text-sm font-medium text-slate-700 dark:text-slate-300 truncate">
          {userName}
        </span>
        {showEmail && session.user.email && (
          <span className="text-xs text-slate-500 dark:text-slate-400 truncate">
            {session.user.email}
          </span>
        )}
      </div>
    </div>
  );
}