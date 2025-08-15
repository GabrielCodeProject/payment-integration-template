import type { Metadata } from "next";
import { EmailVerificationStatus } from "@/components/auth/EmailVerificationStatus";

export const metadata: Metadata = {
  title: "Verify Email | Payment Integration Template",
  description: "Verify your email address to complete registration",
};

interface VerifyEmailPageProps {
  searchParams: {
    token?: string;
    email?: string;
  };
}

export default function VerifyEmailPage({ searchParams }: VerifyEmailPageProps) {
  return (
    <div className="space-y-6">
      <EmailVerificationStatus 
        token={searchParams.token}
        email={searchParams.email}
      />
    </div>
  );
}