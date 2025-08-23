"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { LogOut, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { signOut, useSession } from "@/lib/auth/client";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface LogoutButtonProps {
  variant?: "default" | "destructive" | "outline" | "secondary" | "ghost" | "link";
  size?: "default" | "sm" | "lg" | "icon";
  showIcon?: boolean;
  showConfirmDialog?: boolean;
  children?: React.ReactNode;
  className?: string;
  onLogout?: () => void;
}

export function LogoutButton({
  variant = "ghost",
  size = "default",
  showIcon = true,
  showConfirmDialog = false,
  children,
  className,
  onLogout,
}: LogoutButtonProps) {
  const router = useRouter();
  const { data: session } = useSession();
  const [isLoading, setIsLoading] = useState(false);

  const handleLogout = async () => {
    try {
      setIsLoading(true);

      const response = await signOut();

      if (response.error) {
        toast.error("Failed to sign out. Please try again.");
        return;
      }

      // Success
      toast.success("You have been signed out successfully.");
      
      if (onLogout) {
        onLogout();
      }

      // Redirect to login page
      router.push("/login");
    } catch (_error) {
      // eslint-disable-next-line no-console
      // console.error("Logout error:", error);
      toast.error("An unexpected error occurred during sign out.");
    } finally {
      setIsLoading(false);
    }
  };

  // Don't render if user is not logged in
  if (!session) {
    return null;
  }

  const LogoutButtonContent = () => (
    <Button
      variant={variant}
      size={size}
      className={className}
      disabled={isLoading}
      onClick={showConfirmDialog ? undefined : handleLogout}
    >
      {isLoading ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <>
          {showIcon && <LogOut className="h-4 w-4" />}
          {children || (size === "icon" ? null : "Sign out")}
        </>
      )}
    </Button>
  );

  if (showConfirmDialog) {
    return (
      <AlertDialog>
        <AlertDialogTrigger asChild>
          <LogoutButtonContent />
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Sign out of your account?</AlertDialogTitle>
            <AlertDialogDescription>
              You will be redirected to the login page and will need to sign in again to access your account.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isLoading}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleLogout}
              disabled={isLoading}
              className="bg-red-600 hover:bg-red-700 focus:ring-red-600"
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Signing out...
                </>
              ) : (
                "Sign out"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    );
  }

  return <LogoutButtonContent />;
}

// Simple logout hook for programmatic use
export function useLogout() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);

  const logout = async () => {
    try {
      setIsLoading(true);

      const response = await signOut();

      if (response.error) {
        toast.error("Failed to sign out. Please try again.");
        return false;
      }

      toast.success("You have been signed out successfully.");
      router.push("/login");
      return true;
    } catch (_error) {
      // eslint-disable-next-line no-console
      // console.error("Logout error:", error);
      toast.error("An unexpected error occurred during sign out.");
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  return { logout, isLoading };
}