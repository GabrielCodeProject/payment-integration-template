import type { Metadata } from "next";
import { LoginForm } from "@/components/auth/LoginForm";

export const metadata: Metadata = {
  title: "Sign In | Payment Integration Template",
  description: "Sign in to your account to access our secure payment platform",
};

export default function LoginPage() {
  return <LoginForm />;
}