import { UserMenu } from "@/components/auth/UserMenu";

export default function DashboardPage() {
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
      {/* Header with user menu */}
      <header className="bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">
                Dashboard
              </h1>
            </div>
            
            <UserMenu showUserInfo={true} />
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700 p-6">
          <h2 className="text-lg font-medium text-slate-900 dark:text-slate-100 mb-4">
            Welcome to your Dashboard
          </h2>
          <p className="text-slate-600 dark:text-slate-400">
            You have successfully signed in to your account. This dashboard shows how the authentication
            system integrates with protected pages.
          </p>
          
          <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-blue-50 dark:bg-blue-950/50 rounded-lg p-4">
              <h3 className="font-medium text-blue-900 dark:text-blue-100">Authentication</h3>
              <p className="text-sm text-blue-700 dark:text-blue-300 mt-1">
                Secure login/logout with BetterAuth
              </p>
            </div>
            
            <div className="bg-green-50 dark:bg-green-950/50 rounded-lg p-4">
              <h3 className="font-medium text-green-900 dark:text-green-100">Session Management</h3>
              <p className="text-sm text-green-700 dark:text-green-300 mt-1">
                Automatic session handling and renewal
              </p>
            </div>
            
            <div className="bg-purple-50 dark:bg-purple-950/50 rounded-lg p-4">
              <h3 className="font-medium text-purple-900 dark:text-purple-100">Security</h3>
              <p className="text-sm text-purple-700 dark:text-purple-300 mt-1">
                Rate limiting and CSRF protection
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}