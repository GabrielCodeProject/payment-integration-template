import type { Metadata } from "next";
import { UserMenu } from "@/components/auth/UserMenu";

export const metadata: Metadata = {
  title: "Dashboard | Payment Integration Template",
  description: "Protected dashboard for payment integration platform",
};

export default function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
      {/* Header with user menu */}
      <header className="bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">
                Payment Platform
              </h1>
            </div>
            
            <UserMenu showUserInfo={true} />
          </div>
        </div>
      </header>

      {/* Main content area */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {children}
      </main>
    </div>
  );
}