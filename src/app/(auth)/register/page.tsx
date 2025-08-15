import type { Metadata } from "next";
import { RegistrationForm } from "@/components/auth/RegistrationForm";

export const metadata: Metadata = {
  title: "Register | Payment Integration Template",
  description: "Create your account to access our secure payment platform",
};

export default function RegisterPage() {
  return <RegistrationForm />;
}