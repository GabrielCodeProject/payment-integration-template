"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { signIn } from "@/lib/auth/client";
import {
  loginCredentialsSchema,
  type LoginCredentials,
} from "@/lib/validations/base/auth";

interface LoginFormProps {
  onSuccess?: (email: string) => void;
}

export function LoginForm({ onSuccess }: LoginFormProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Get return URL for post-login redirect
  const returnTo = searchParams?.get("returnTo") || "/dashboard";

  const form = useForm<LoginCredentials>({
    resolver: zodResolver(loginCredentialsSchema),
    defaultValues: {
      email: "",
      password: "",
      rememberMe: false,
    },
    mode: "onChange",
  });

  const onSubmit = async (data: LoginCredentials) => {
    try {
      setIsLoading(true);

      const response = await signIn.email({
        email: data.email,
        password: data.password,
        rememberMe: data.rememberMe,
        // callbackURL: returnTo, // Note: Remove callbackURL as it's not supported in current BetterAuth version
      });

      if (response.error) {
        // Handle specific errors
        switch (response._error.message) {
          case "Invalid email or password":
          case "Invalid credentials":
            toast.error(
              "Invalid email or password. Please check your credentials and try again."
            );
            break;
          case "Email not verified":
            toast.error("Please verify your email address before signing in.", {
              action: {
                label: "Resend",
                onClick: () =>
                  router.push(
                    `/verify-email?email=${encodeURIComponent(data.email)}`
                  ),
              },
            });
            break;
          case "Account disabled":
          case "Account suspended":
            toast.error(
              "Your account has been disabled. Please contact support for assistance."
            );
            break;
          case "Too many attempts":
          case "Rate limited":
            toast.error(
              "Too many login attempts. Please wait a few minutes before trying again."
            );
            break;
          case "Two factor required":
            toast.error("Two-factor authentication required.");
            // TODO: Redirect to 2FA page when implemented
            break;
          default:
            toast.error(
              response._error.message || "Sign in failed. Please try again."
            );
        }
        return;
      }

      // Success
      toast.success("Welcome back! You have been signed in successfully.");

      if (onSuccess) {
        onSuccess(data.email);
      } else {
        // Validate redirect URL for security
        const isValidRedirect =
          returnTo.startsWith("/") && !returnTo.startsWith("//");
        const redirectUrl = isValidRedirect ? returnTo : "/dashboard";
        router.push(redirectUrl);
      }
    } catch (_error) {
      console.error("Sign in error:", _error);
      toast.error("An unexpected error occurred. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <div className="space-y-2 text-center">
          <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
            Welcome back
          </h2>
          <p className="text-slate-600 dark:text-slate-400">
            Sign in to your account
          </p>
        </div>

        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Email address</FormLabel>
              <FormControl>
                <Input
                  {...field}
                  type="email"
                  placeholder="Enter your email"
                  autoComplete="email"
                  disabled={isLoading}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="password"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Password</FormLabel>
              <FormControl>
                <div className="relative">
                  <Input
                    {...field}
                    type={showPassword ? "text" : "password"}
                    placeholder="Enter your password"
                    autoComplete="current-password"
                    disabled={isLoading}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute top-0 right-0 h-full px-3 hover:bg-transparent"
                    onClick={() => setShowPassword(!showPassword)}
                    disabled={isLoading}
                  >
                    {showPassword ? (
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

        <div className="flex items-center justify-between">
          <FormField
            control={form.control}
            name="rememberMe"
            render={({ field }) => (
              <FormItem className="flex flex-row items-start space-y-0 space-x-3">
                <FormControl>
                  <Checkbox
                    checked={field.value}
                    onCheckedChange={field.onChange}
                    disabled={isLoading}
                  />
                </FormControl>
                <div className="space-y-1 leading-none">
                  <FormLabel className="text-sm font-normal">
                    Remember me
                  </FormLabel>
                </div>
              </FormItem>
            )}
          />

          <Button
            type="button"
            variant="link"
            className="px-0 text-sm"
            onClick={() => router.push("/forgot-password")}
            disabled={isLoading}
          >
            Forgot password?
          </Button>
        </div>

        <Button
          type="submit"
          className="w-full"
          disabled={isLoading || !form.formState.isValid}
          size="lg"
        >
          {isLoading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Signing in...
            </>
          ) : (
            "Sign in"
          )}
        </Button>

        <div className="text-center">
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Don&apos;t have an account?{" "}
            <a
              href="/register"
              className="font-medium text-blue-600 underline hover:text-blue-500"
            >
              Create account
            </a>
          </p>
        </div>
      </form>
    </Form>
  );
}
