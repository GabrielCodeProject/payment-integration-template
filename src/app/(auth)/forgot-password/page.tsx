import type { Metadata } from "next";
import { ForgotPasswordForm } from "@/components/auth/ForgotPasswordForm";

export const metadata: Metadata = {
  title: "Forgot Password | Payment Integration Template",
  description: "Reset your password to regain access to your account",
  robots: "noindex, nofollow", // Prevent indexing of auth pages
};

export default function ForgotPasswordPage() {
  return <ForgotPasswordForm />;
}