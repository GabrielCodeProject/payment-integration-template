"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeft, CheckCircle, Loader2, Mail } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { forgetPassword } from "@/lib/auth/client";
import {
  passwordResetRequestSchema,
  type PasswordResetRequest,
} from "@/lib/validations/base/auth";

interface ForgotPasswordFormProps {
  onSuccess?: (email: string) => void;
}

export function ForgotPasswordForm({ onSuccess }: ForgotPasswordFormProps) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const [sentToEmail, setSentToEmail] = useState("");

  const form = useForm<PasswordResetRequest>({
    resolver: zodResolver(passwordResetRequestSchema),
    defaultValues: {
      email: "",
    },
    mode: "onChange",
  });

  const onSubmit = async (data: PasswordResetRequest) => {
    try {
      setIsLoading(true);

      const response = await forgetPassword({
        email: data.email,
        redirectTo: `${window.location.origin}/reset-password`,
      });

      if (response.error) {
        // Handle specific errors
        switch (response._error.message) {
          case "User not found":
          case "Email not found":
            // For security, we don't reveal if the email exists or not
            // Still show success message but don't actually send email
            break;
          case "Too many requests":
          case "Rate limited":
            toast.error(
              "Too many password reset attempts. Please wait before trying again."
            );
            return;
          case "Email not verified":
            toast.error(
              "Please verify your email address first before resetting your password.",
              {
                action: {
                  label: "Verify Email",
                  onClick: () =>
                    router.push(
                      `/verify-email?email=${encodeURIComponent(data.email)}`
                    ),
                },
              }
            );
            return;
          default:
            toast.error(
              response._error.message ||
                "Failed to send password reset email. Please try again."
            );
            return;
        }
      }

      // Success - always show this message for security (don't reveal if email exists)
      setSentToEmail(data.email);
      setEmailSent(true);

      if (onSuccess) {
        onSuccess(data.email);
      }
    } catch (_error) {
      console.error("Forgot password error:", _error);
      // Handle network errors specifically
      if (_error instanceof Error) {
        if (
          _error.message.includes("fetch") ||
          _error.message.includes("network")
        ) {
          toast.error(
            "Network error. Please check your connection and try again."
          );
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

  if (emailSent) {
    return (
      <div className="space-y-6" role="status" aria-live="polite">
        <div className="text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/20">
            <CheckCircle className="h-6 w-6 text-green-600 dark:text-green-400" />
          </div>
          <h2 className="mb-2 text-2xl font-bold text-slate-900 dark:text-slate-100">
            Check your email
          </h2>
          <p className="text-slate-600 dark:text-slate-400">
            If an account with the email <strong>{sentToEmail}</strong> exists,
            we&apos;ve sent you a password reset link.
          </p>
        </div>

        <div className="space-y-4">
          <div className="rounded-lg bg-blue-50 p-4 dark:bg-blue-900/20">
            <div className="flex items-start">
              <Mail className="mt-0.5 mr-3 h-5 w-5 flex-shrink-0 text-blue-600 dark:text-blue-400" />
              <div className="text-sm">
                <p className="mb-1 font-medium text-blue-800 dark:text-blue-200">
                  What to do next:
                </p>
                <ul className="space-y-1 text-blue-700 dark:text-blue-300">
                  <li>• Check your email inbox for a reset link</li>
                  <li>• Check your spam folder if you don&apos;t see it</li>
                  <li>• The link will expire in 1 hour for security</li>
                  <li>• Click the link to set a new password</li>
                </ul>
              </div>
            </div>
          </div>

          <div className="flex space-x-4">
            <Button
              type="button"
              variant="outline"
              className="flex-1"
              onClick={() => router.push("/login")}
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to sign in
            </Button>
            <Button
              type="button"
              variant="ghost"
              className="flex-1"
              onClick={() => {
                setEmailSent(false);
                setSentToEmail("");
                form.reset();
              }}
            >
              Try different email
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(onSubmit)}
        className="space-y-6"
        aria-label="Forgot password form"
        noValidate
      >
        <div className="space-y-2 text-center">
          <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
            Forgot your password?
          </h2>
          <p className="text-slate-600 dark:text-slate-400">
            Enter your email address and we&apos;ll send you a link to reset
            your password.
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
                  placeholder="Enter your email address"
                  autoComplete="email"
                  disabled={isLoading}
                  className="h-12"
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="space-y-4">
          <Button
            type="submit"
            className="h-12 w-full"
            disabled={isLoading || !form.formState.isValid}
            size="lg"
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Sending reset link...
              </>
            ) : (
              <>
                <Mail className="mr-2 h-4 w-4" />
                Send reset link
              </>
            )}
          </Button>

          <Button
            type="button"
            variant="ghost"
            className="w-full"
            onClick={() => router.push("/login")}
            disabled={isLoading}
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to sign in
          </Button>
        </div>

        <div className="text-center">
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Remember your password?{" "}
            <a
              href="/login"
              className="font-medium text-blue-600 underline hover:text-blue-500"
            >
              Sign in
            </a>
          </p>
        </div>
      </form>
    </Form>
  );
}
