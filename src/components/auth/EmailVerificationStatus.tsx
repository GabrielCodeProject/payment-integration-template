"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { CheckCircle, XCircle, Mail, Loader2, AlertCircle } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface EmailVerificationStatusProps {
  token?: string;
  email?: string;
}

type VerificationState = 
  | "pending"
  | "verifying" 
  | "success"
  | "error"
  | "expired"
  | "resending";

export function EmailVerificationStatus({ token, email }: EmailVerificationStatusProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [state, setState] = useState<VerificationState>("pending");
  const [error, setError] = useState<string | null>(null);

  const emailFromQuery = email || searchParams.get("email");

  const verifyToken = useCallback(async (verificationToken: string) => {
    try {
      setState("verifying");
      setError(null);

      // Make API call to verify email
      const response = await fetch("/api/auth/verify-email", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ token: verificationToken }),
      });

      const result = await response.json();

      if (response.ok && result.success) {
        setState("success");
        toast.success("Email verified successfully! You can now sign in.");
        
        // Redirect to login after a short delay
        setTimeout(() => {
          router.push("/login?verified=true");
        }, 2000);
      } else {
        const errorMessage = result.error || "Verification failed";
        
        if (errorMessage.includes("expired") || errorMessage.includes("invalid")) {
          setState("expired");
          setError("The verification link has expired or is invalid.");
        } else {
          setState("error");
          setError(errorMessage);
        }
      }
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error("Verification error:", error);
      setState("error");
      setError("An unexpected error occurred during verification.");
    }
  }, [router]);

  useEffect(() => {
    if (token) {
      verifyToken(token);
    }
  }, [token, verifyToken]);

  const resendVerification = async () => {
    if (!emailFromQuery) {
      toast.error("No email address available for resending verification.");
      return;
    }

    try {
      setState("resending");
      setError(null);

      const response = await fetch("/api/auth/resend-verification", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email: emailFromQuery }),
      });

      const result = await response.json();

      if (response.ok && result.success) {
        setState("pending");
        toast.success("Verification email sent! Please check your inbox.");
      } else {
        setState("error");
        setError(result.error || "Failed to resend verification email.");
      }
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error("Resend error:", error);
      setState("error");
      setError("Failed to resend verification email.");
    }
  };

  const getIcon = () => {
    switch (state) {
      case "verifying":
      case "resending":
        return <Loader2 className="h-12 w-12 text-blue-500 animate-spin" />;
      case "success":
        return <CheckCircle className="h-12 w-12 text-green-500" />;
      case "error":
      case "expired":
        return <XCircle className="h-12 w-12 text-red-500" />;
      default:
        return <Mail className="h-12 w-12 text-blue-500" />;
    }
  };

  const getTitle = () => {
    switch (state) {
      case "verifying":
        return "Verifying your email...";
      case "success":
        return "Email verified successfully!";
      case "error":
        return "Verification failed";
      case "expired":
        return "Link expired";
      case "resending":
        return "Sending new verification email...";
      default:
        return "Check your email";
    }
  };

  const getMessage = () => {
    switch (state) {
      case "verifying":
        return "Please wait while we verify your email address.";
      case "success":
        return "Your email has been verified. You can now access your account.";
      case "error":
        return error || "We couldn&apos;t verify your email. Please try again.";
      case "expired":
        return "Your verification link has expired. Click below to get a new one.";
      case "resending":
        return "Sending a new verification email to your inbox.";
      default:
        return emailFromQuery 
          ? `We&apos;ve sent a verification email to ${emailFromQuery}. Please click the link in the email to verify your account.`
          : "Please check your email for a verification link and click it to verify your account.";
    }
  };

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader className="text-center">
        <div className="flex justify-center mb-4">
          {getIcon()}
        </div>
        <CardTitle className="text-xl">{getTitle()}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-center text-slate-600 dark:text-slate-400">
          {getMessage()}
        </p>

        {(state === "expired" || state === "error") && emailFromQuery && (
          <Button
            onClick={resendVerification}
            disabled={state === "resending"}
            className="w-full"
          >
            {state === "resending" ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Sending...
              </>
            ) : (
              "Send new verification email"
            )}
          </Button>
        )}

        {state === "success" && (
          <Button
            onClick={() => router.push("/login")}
            className="w-full"
          >
            Continue to sign in
          </Button>
        )}

        {state === "pending" && !token && (
          <div className="space-y-3">
            <div className="flex items-center justify-center space-x-2 text-sm text-slate-500">
              <AlertCircle className="h-4 w-4" />
              <span>Didn&apos;t receive the email?</span>
            </div>
            
            <div className="text-xs text-slate-400 space-y-1">
              <p>• Check your spam or junk folder</p>
              <p>• Make sure the email address is correct</p>
              <p>• Wait a few minutes for the email to arrive</p>
            </div>

            {emailFromQuery && (
              <Button
                variant="outline"
                onClick={resendVerification}
                disabled={state === "resending"}
                className="w-full"
              >
                Resend verification email
              </Button>
            )}
          </div>
        )}

        <div className="text-center pt-4">
          <Button
            variant="ghost"
            onClick={() => router.push("/register")}
            className="text-sm"
          >
            Back to registration
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}