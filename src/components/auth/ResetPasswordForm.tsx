"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Eye, EyeOff, Loader2, CheckCircle, AlertTriangle, ArrowLeft } from "lucide-react";
import { toast } from "sonner";

import { passwordResetSchema, type PasswordReset } from "@/lib/validations/base/auth";
import { resetPassword } from "@/lib/auth/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { PasswordStrengthIndicator } from "./PasswordStrengthIndicator";

interface ResetPasswordFormProps {
  onSuccess?: () => void;
}

export function ResetPasswordForm({ onSuccess }: ResetPasswordFormProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [resetSuccess, setResetSuccess] = useState(false);
  const [tokenError, setTokenError] = useState("");

  // Get token from URL
  const token = searchParams?.get("token") || "";

  const form = useForm<PasswordReset>({
    resolver: zodResolver(passwordResetSchema),
    defaultValues: {
      token: "",
      newPassword: "",
      confirmPassword: "",
    },
    mode: "onChange",
  });

  // Set token when component mounts
  useEffect(() => {
    if (token) {
      // Basic token format validation
      if (token.length < 10) {
        setTokenError("Invalid reset link. Please check your email for the correct link.");
        return;
      }
      form.setValue("token", token);
    } else {
      setTokenError("No reset token found. Please check your email for the reset link.");
    }
  }, [token, form]);

  const watchNewPassword = form.watch("newPassword");

  const onSubmit = async (data: PasswordReset) => {
    try {
      setIsLoading(true);

      const response = await resetPassword({
        token: data.token,
        newPassword: data.newPassword,
      });

      if (response.error) {
        // Handle specific errors
        switch (response._error.message) {
          case "Invalid token":
          case "Token not found":
            setTokenError("This reset link is invalid. Please request a new password reset.");
            break;
          case "Token expired":
          case "Expired token":
            setTokenError("This reset link has expired. Please request a new password reset.");
            break;
          case "Token already used":
            setTokenError("This reset link has already been used. Please request a new password reset if needed.");
            break;
          case "User not found":
            setTokenError("Account not found. The reset link may be invalid.");
            break;
          case "Weak password":
          case "Password too weak":
            toast.error("Password does not meet security requirements. Please choose a stronger password.");
            break;
          case "Same password":
            toast.error("New password must be different from your current password.");
            break;
          default:
            toast.error(response._error.message || "Failed to reset password. Please try again.");
        }
        return;
      }

      // Success
      setResetSuccess(true);
      toast.success("Password reset successfully! You can now sign in with your new password.");
      
      if (onSuccess) {
        onSuccess();
      } else {
        // Redirect to login after a short delay
        setTimeout(() => {
          router.push("/login?message=password-reset-success");
        }, 3000);
      }
    } catch (_error) {
      // eslint-disable-next-line no-console
      // console.error("Reset password error:", error);
      // Handle network errors specifically
      if (_error instanceof Error) {
        if (_error.message.includes("fetch") || _error.message.includes("network")) {
          toast.error("Network error. Please check your connection and try again.");
        } else if (_error.message.includes("timeout")) {
          toast.error("Request timed out. Please try again.");
        } else {
          toast.error("An unexpected error occurred. Please try again.");
        }
      } else {
        toast.error("An unexpected error occurred. Please try again.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  if (tokenError) {
    return (
      <div className="space-y-6" role="alert" aria-live="assertive">
        <div className="text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/20">
            <AlertTriangle className="h-6 w-6 text-red-600 dark:text-red-400" />
          </div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mb-2">
            Invalid Reset Link
          </h2>
          <p className="text-slate-600 dark:text-slate-400 mb-6">
            {tokenError}
          </p>
        </div>

        <div className="space-y-4">
          <Button
            type="button"
            className="w-full"
            onClick={() => router.push("/forgot-password")}
            size="lg"
          >
            Request New Reset Link
          </Button>
          <Button
            type="button"
            variant="outline"
            className="w-full"
            onClick={() => router.push("/login")}
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Sign In
          </Button>
        </div>
      </div>
    );
  }

  if (resetSuccess) {
    return (
      <div className="space-y-6" role="status" aria-live="polite">
        <div className="text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/20">
            <CheckCircle className="h-6 w-6 text-green-600 dark:text-green-400" />
          </div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mb-2">
            Password Reset Successfully
          </h2>
          <p className="text-slate-600 dark:text-slate-400 mb-6">
            Your password has been updated. You can now sign in with your new password.
          </p>
        </div>

        <Button
          type="button"
          className="w-full"
          onClick={() => router.push("/login")}
          size="lg"
        >
          Continue to Sign In
        </Button>
      </div>
    );
  }

  return (
    <Form {...form}>
      <form 
        onSubmit={form.handleSubmit(onSubmit)} 
        className="space-y-6"
        aria-label="Reset password form"
        noValidate
      >
        <div className="space-y-2 text-center">
          <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
            Set New Password
          </h2>
          <p className="text-slate-600 dark:text-slate-400">
            Enter a strong password for your account.
          </p>
        </div>

        <FormField
          control={form.control}
          name="newPassword"
          render={({ field }) => (
            <FormItem>
              <FormLabel>New Password</FormLabel>
              <FormControl>
                <div className="relative">
                  <Input
                    {...field}
                    type={showNewPassword ? "text" : "password"}
                    placeholder="Enter your new password"
                    autoComplete="new-password"
                    disabled={isLoading}
                    className="h-12 pr-10"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                    disabled={isLoading}
                  >
                    {showNewPassword ? (
                      <EyeOff className="h-4 w-4 text-slate-500" />
                    ) : (
                      <Eye className="h-4 w-4 text-slate-500" />
                    )}
                  </Button>
                </div>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Password Strength Indicator */}
        {watchNewPassword && (
          <PasswordStrengthIndicator 
            password={watchNewPassword} 
            className="mt-2"
          />
        )}

        <FormField
          control={form.control}
          name="confirmPassword"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Confirm New Password</FormLabel>
              <FormControl>
                <div className="relative">
                  <Input
                    {...field}
                    type={showConfirmPassword ? "text" : "password"}
                    placeholder="Confirm your new password"
                    autoComplete="new-password"
                    disabled={isLoading}
                    className="h-12 pr-10"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    disabled={isLoading}
                  >
                    {showConfirmPassword ? (
                      <EyeOff className="h-4 w-4 text-slate-500" />
                    ) : (
                      <Eye className="h-4 w-4 text-slate-500" />
                    )}
                  </Button>
                </div>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="space-y-4">
          <Button
            type="submit"
            className="w-full h-12"
            disabled={isLoading || !form.formState.isValid}
            size="lg"
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Updating password...
              </>
            ) : (
              "Update Password"
            )}
          </Button>

          <Button
            type="button"
            variant="outline"
            className="w-full"
            onClick={() => router.push("/login")}
            disabled={isLoading}
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to sign in
          </Button>
        </div>
      </form>
    </Form>
  );
}