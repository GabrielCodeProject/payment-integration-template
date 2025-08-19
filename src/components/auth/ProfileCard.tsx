"use client";

import * as React from "react";
import { 
  User, 
  Mail, 
  Calendar,
  Clock,
  Shield,
  Edit,
  Settings,
  MoreVertical
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useSession } from "@/lib/auth/client";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { UserAvatar } from "./Avatar";
import { SessionIndicator } from "./SessionIndicator";

export interface ProfileCardProps {
  /** Card variant style */
  variant?: "default" | "minimal" | "detailed";
  /** Show action buttons */
  showActions?: boolean;
  /** Show session information */
  showSession?: boolean;
  /** Show role badge */
  showRole?: boolean;
  /** Custom action buttons */
  actions?: React.ReactNode;
  /** Additional className */
  className?: string;
  /** Handle edit profile action */
  onEditProfile?: () => void;
  /** Handle settings action */
  onSettings?: () => void;
}

/**
 * ProfileCard component for displaying comprehensive user profile information
 */
export function ProfileCard({
  variant = "default",
  showActions = true,
  showSession = true,
  showRole = true,
  actions,
  className,
  onEditProfile,
  onSettings
}: ProfileCardProps) {
  const { data: session, isPending } = useSession();

  if (isPending) {
    return <ProfileCardSkeleton variant={variant} className={className} />;
  }

  if (!session) {
    return (
      <Card className={cn("p-6", className)}>
        <div className="text-center space-y-4">
          <div className="w-16 h-16 mx-auto bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center">
            <User className="w-8 h-8 text-slate-400" />
          </div>
          <div className="space-y-2">
            <h3 className="font-medium text-slate-900 dark:text-slate-100">
              Not signed in
            </h3>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Please sign in to view your profile
            </p>
          </div>
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => window.location.href = "/login"}
          >
            Sign in
          </Button>
        </div>
      </Card>
    );
  }

  const user = session.user;
  const userName = user.name || user.email?.split("@")[0] || "User";
  const userRole = user.role || "user";

  // Determine when the user was created (if available)
  const memberSince = user.createdAt 
    ? new Date(user.createdAt).toLocaleDateString(undefined, { 
        month: 'long', 
        year: 'numeric' 
      })
    : null;

  const renderMinimal = () => (
    <Card className={cn("overflow-hidden", className)}>
      <CardContent className="p-6">
        <div className="flex items-center gap-4">
          <UserAvatar
            name={user.name}
            email={user.email}
            src={user.image}
            size="lg"
            showStatus={showSession}
            isOnline={true}
          />
          
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-slate-900 dark:text-slate-100 truncate">
                {userName}
              </h3>
              {showRole && (
                <Badge variant="secondary" className="text-xs">
                  {userRole.charAt(0).toUpperCase() + userRole.slice(1)}
                </Badge>
              )}
            </div>
            
            {user.email && (
              <p className="text-sm text-slate-500 dark:text-slate-400 truncate mt-1">
                {user.email}
              </p>
            )}
            
            {showSession && (
              <div className="mt-2">
                <SessionIndicator variant="badge" size="sm" />
              </div>
            )}
          </div>

          {showActions && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={onEditProfile}>
                  <Edit className="mr-2 h-4 w-4" />
                  Edit Profile
                </DropdownMenuItem>
                <DropdownMenuItem onClick={onSettings}>
                  <Settings className="mr-2 h-4 w-4" />
                  Settings
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </CardContent>
    </Card>
  );

  const renderDefault = () => (
    <Card className={cn("overflow-hidden", className)}>
      <CardHeader className="pb-4">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4">
            <UserAvatar
              name={user.name}
              email={user.email}
              src={user.image}
              size="xl"
              showStatus={showSession}
              isOnline={true}
            />
            
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100">
                  {userName}
                </h2>
                {showRole && (
                  <Badge variant="secondary">
                    {userRole.charAt(0).toUpperCase() + userRole.slice(1)}
                  </Badge>
                )}
              </div>
              
              {user.email && (
                <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400">
                  <Mail className="w-4 h-4" />
                  <span className="text-sm">{user.email}</span>
                </div>
              )}
              
              {showSession && (
                <SessionIndicator variant="badge" size="sm" />
              )}
            </div>
          </div>

          {showActions && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={onEditProfile}>
                  <Edit className="mr-2 h-4 w-4" />
                  Edit Profile
                </DropdownMenuItem>
                <DropdownMenuItem onClick={onSettings}>
                  <Settings className="mr-2 h-4 w-4" />
                  Settings
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </CardHeader>

      <CardContent className="pt-0">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {memberSince && (
            <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
              <Calendar className="w-4 h-4" />
              <span>Member since {memberSince}</span>
            </div>
          )}
          
          {session.expiresAt && (
            <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
              <Clock className="w-4 h-4" />
              <span>
                Session expires {new Date(session.expiresAt).toLocaleDateString()}
              </span>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );

  const renderDetailed = () => (
    <Card className={cn("overflow-hidden", className)}>
      <CardHeader className="pb-4">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-6">
            <UserAvatar
              name={user.name}
              email={user.email}
              src={user.image}
              size="2xl"
              showStatus={showSession}
              isOnline={true}
            />
            
            <div className="space-y-3">
              <div className="space-y-1">
                <div className="flex items-center gap-3">
                  <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                    {userName}
                  </h2>
                  {showRole && (
                    <Badge variant="secondary" className="text-sm">
                      {userRole.charAt(0).toUpperCase() + userRole.slice(1)}
                    </Badge>
                  )}
                </div>
                
                {user.email && (
                  <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400">
                    <Mail className="w-4 h-4" />
                    <span>{user.email}</span>
                  </div>
                )}
              </div>
              
              {showSession && (
                <div className="flex items-center gap-4">
                  <SessionIndicator variant="full" size="sm" />
                </div>
              )}
            </div>
          </div>

          {showActions && (
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={onEditProfile}>
                <Edit className="w-4 h-4 mr-2" />
                Edit Profile
              </Button>
              <Button variant="outline" size="sm" onClick={onSettings}>
                <Settings className="w-4 h-4 mr-2" />
                Settings
              </Button>
            </div>
          )}
        </div>
      </CardHeader>

      <CardContent className="pt-0 space-y-6">
        <Separator />
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-4">
            <h4 className="font-medium text-slate-900 dark:text-slate-100">
              Account Information
            </h4>
            
            <div className="space-y-3">
              {user.email && (
                <div className="flex items-center gap-3">
                  <Mail className="w-4 h-4 text-slate-500" />
                  <div>
                    <div className="text-sm font-medium">Email</div>
                    <div className="text-sm text-slate-600 dark:text-slate-400">
                      {user.email}
                    </div>
                  </div>
                </div>
              )}
              
              <div className="flex items-center gap-3">
                <Shield className="w-4 h-4 text-slate-500" />
                <div>
                  <div className="text-sm font-medium">Role</div>
                  <div className="text-sm text-slate-600 dark:text-slate-400">
                    {userRole.charAt(0).toUpperCase() + userRole.slice(1)}
                  </div>
                </div>
              </div>

              {memberSince && (
                <div className="flex items-center gap-3">
                  <Calendar className="w-4 h-4 text-slate-500" />
                  <div>
                    <div className="text-sm font-medium">Member Since</div>
                    <div className="text-sm text-slate-600 dark:text-slate-400">
                      {memberSince}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {showSession && session.expiresAt && (
            <div className="space-y-4">
              <h4 className="font-medium text-slate-900 dark:text-slate-100">
                Session Details
              </h4>
              
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <Clock className="w-4 h-4 text-slate-500" />
                  <div>
                    <div className="text-sm font-medium">Session Expires</div>
                    <div className="text-sm text-slate-600 dark:text-slate-400">
                      {new Date(session.expiresAt).toLocaleString()}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {actions && (
          <>
            <Separator />
            <div className="flex justify-end">
              {actions}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );

  switch (variant) {
    case "minimal":
      return renderMinimal();
    case "detailed":
      return renderDetailed();
    default:
      return renderDefault();
  }
}

/**
 * Loading skeleton for ProfileCard
 */
function ProfileCardSkeleton({ 
  variant = "default", 
  className 
}: { 
  variant?: ProfileCardProps["variant"]; 
  className?: string; 
}) {
  if (variant === "minimal") {
    return (
      <Card className={cn("overflow-hidden", className)}>
        <CardContent className="p-6">
          <div className="flex items-center gap-4">
            <Skeleton className="w-12 h-12 rounded-full" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-3 w-48" />
            </div>
            <Skeleton className="w-8 h-8" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={cn("overflow-hidden", className)}>
      <CardHeader className="pb-4">
        <div className="flex items-start gap-4">
          <Skeleton className="w-16 h-16 rounded-full" />
          <div className="flex-1 space-y-3">
            <Skeleton className="h-6 w-40" />
            <Skeleton className="h-4 w-56" />
            <Skeleton className="h-6 w-24" />
          </div>
          <Skeleton className="w-20 h-8" />
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="space-y-3">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4" />
        </div>
      </CardContent>
    </Card>
  );
}

export { ProfileCardSkeleton };