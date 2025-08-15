import type { Metadata } from "next";
import { Suspense } from "react";
import { ResetPasswordForm } from "@/components/auth/ResetPasswordForm";

export const metadata: Metadata = {
  title: "Reset Password | Payment Integration Template",
  description: "Set a new password for your account",
  robots: "noindex, nofollow", // Prevent indexing of auth pages
};

function ResetPasswordContent() {
  return <ResetPasswordForm />;
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-slate-600 dark:text-slate-400">Loading reset form...</p>
        </div>
      </div>
    }>
      <ResetPasswordContent />
    </Suspense>
  );
}