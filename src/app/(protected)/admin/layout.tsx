import type { Metadata } from "next";
import { AdminNavigation } from "@/components/admin/AdminNavigation";

export const metadata: Metadata = {
  title: "Admin Dashboard | Payment Integration Template",
  description: "Administrative interface for user and system management",
};

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex gap-6">
      {/* Admin Navigation Sidebar */}
      <aside className="w-64 shrink-0">
        <AdminNavigation />
      </aside>

      {/* Main Admin Content */}
      <div className="flex-1 min-w-0">
        {children}
      </div>
    </div>
  );
}