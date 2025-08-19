"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

export interface UserAvatarProps {
  /** User's display name - used for generating initials */
  name?: string | null;
  /** User's email - fallback for generating initials */
  email?: string | null;
  /** URL to user's avatar image */
  src?: string | null;
  /** Size of the avatar */
  size?: "xs" | "sm" | "md" | "lg" | "xl" | "2xl";
  /** Show online status indicator */
  showStatus?: boolean;
  /** Online status */
  isOnline?: boolean;
  /** Additional className */
  className?: string;
  /** Alt text for the image */
  alt?: string;
}

const sizeClasses = {
  xs: "h-6 w-6 text-xs",
  sm: "h-8 w-8 text-sm",
  md: "h-10 w-10 text-sm",
  lg: "h-12 w-12 text-base",
  xl: "h-16 w-16 text-lg",
  "2xl": "h-20 w-20 text-xl",
};

const statusSizeClasses = {
  xs: "h-1.5 w-1.5 -bottom-0.5 -right-0.5",
  sm: "h-2 w-2 -bottom-0.5 -right-0.5",
  md: "h-2.5 w-2.5 -bottom-0.5 -right-0.5",
  lg: "h-3 w-3 -bottom-0.5 -right-0.5",
  xl: "h-3.5 w-3.5 -bottom-1 -right-1",
  "2xl": "h-4 w-4 -bottom-1 -right-1",
};

/**
 * Generates initials from a name or email
 */
function generateInitials(name?: string | null, email?: string | null): string {
  if (name) {
    return name
      .split(" ")
      .map((part) => part.charAt(0))
      .join("")
      .toUpperCase()
      .slice(0, 2);
  }

  if (email) {
    const username = email.split("@")[0];
    return username.charAt(0).toUpperCase();
  }

  return "U";
}

/**
 * Enhanced avatar component with image support, fallback initials, and status indicator
 */
export function UserAvatar({
  name,
  email,
  src,
  size = "md",
  showStatus = false,
  isOnline = false,
  className,
  alt,
}: UserAvatarProps) {
  const initials = generateInitials(name, email);
  const avatarAlt = alt || `${name || email || "User"}'s avatar`;

  return (
    <div className="relative inline-block">
      <Avatar className={cn(sizeClasses[size], className)}>
        <AvatarImage 
          src={src || undefined} 
          alt={avatarAlt}
          className="object-cover"
        />
        <AvatarFallback className="bg-gradient-to-br from-blue-500 to-blue-600 text-white font-medium border border-blue-200 dark:border-blue-400">
          {initials}
        </AvatarFallback>
      </Avatar>
      
      {showStatus && (
        <div 
          className={cn(
            "absolute rounded-full border-2 border-white dark:border-slate-800",
            statusSizeClasses[size],
            isOnline 
              ? "bg-green-500" 
              : "bg-gray-400 dark:bg-gray-600"
          )}
          aria-label={isOnline ? "Online" : "Offline"}
        />
      )}
    </div>
  );
}

/**
 * Simplified avatar component for minimal displays
 */
export function SimpleAvatar({
  name,
  email,
  src,
  size = "sm",
  className,
}: Pick<UserAvatarProps, "name" | "email" | "src" | "size" | "className">) {
  return (
    <UserAvatar
      name={name}
      email={email}
      src={src}
      size={size}
      showStatus={false}
      className={className}
    />
  );
}

/**
 * Avatar group component for displaying multiple avatars
 */
export interface AvatarGroupProps {
  /** Array of user data for avatars */
  users: Array<{
    name?: string | null;
    email?: string | null;
    src?: string | null;
  }>;
  /** Maximum number of avatars to show before showing +X indicator */
  max?: number;
  /** Size of the avatars */
  size?: UserAvatarProps["size"];
  /** Additional className */
  className?: string;
}

export function AvatarGroup({ 
  users, 
  max = 4, 
  size = "sm", 
  className 
}: AvatarGroupProps) {
  const displayUsers = users.slice(0, max);
  const remainingCount = users.length - max;
  
  const overlapOffset = {
    xs: "-ml-1",
    sm: "-ml-1.5",
    md: "-ml-2",
    lg: "-ml-2.5",
    xl: "-ml-3",
    "2xl": "-ml-4",
  };

  return (
    <div className={cn("flex items-center", className)}>
      {displayUsers.map((user, index) => (
        <div
          key={index}
          className={cn(
            "relative ring-2 ring-white dark:ring-slate-800 rounded-full",
            index > 0 && overlapOffset[size || "sm"]
          )}
          style={{ zIndex: displayUsers.length - index }}
        >
          <UserAvatar
            name={user.name}
            email={user.email}
            src={user.src}
            size={size}
          />
        </div>
      ))}
      
      {remainingCount > 0 && (
        <div
          className={cn(
            "relative flex items-center justify-center rounded-full bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 font-medium border-2 border-white dark:border-slate-800",
            sizeClasses[size || "sm"],
            overlapOffset[size || "sm"]
          )}
          style={{ zIndex: 0 }}
        >
          +{remainingCount}
        </div>
      )}
    </div>
  );
}

// Export the base Avatar components for advanced use cases
export { Avatar as BaseAvatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";