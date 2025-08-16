import type { Metadata } from "next";
import { EmailVerificationStatus } from "@/components/auth/EmailVerificationStatus";

export const metadata: Metadata = {
  title: "Verify Email | Payment Integration Template",
  description: "Verify your email address to complete registration",
};

interface VerifyEmailPageProps {
  searchParams: Promise<{
    token?: string;
    email?: string;
  }>;
}

export default async function VerifyEmailPage({ searchParams }: VerifyEmailPageProps) {
  const resolvedParams = await searchParams;
  
  return (
    <div className="space-y-6">
      <EmailVerificationStatus 
        token={resolvedParams.token}
        email={resolvedParams.email}
      />
    </div>
  );
}