import type { Metadata } from "next";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Shield, Lock, Zap } from "lucide-react";

export const metadata: Metadata = {
  title: "Authentication | Payment Integration Template",
  description: "Secure authentication for payment integration platform",
};

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-slate-100 dark:from-slate-900 dark:via-blue-950/20 dark:to-slate-800">
      {/* Background Pattern */}
      <div 
        className="absolute inset-0 opacity-30 dark:opacity-20"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%2393c5fd' fill-opacity='0.1'%3E%3Cpath d='m36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
        }}
      />
      
      <div className="relative flex min-h-screen items-center justify-center p-4">
        <div className="w-full max-w-md">
          {/* Header Section */}
          <div className="text-center mb-8 space-y-4">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 shadow-lg mb-4">
              <Lock className="w-8 h-8 text-white" />
            </div>
            
            <div className="space-y-2">
              <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
                Payment Platform
              </h1>
              <p className="text-slate-600 dark:text-slate-400 leading-relaxed">
                Secure and reliable payment integration
              </p>
            </div>
            
            {/* Trust Indicators */}
            <div className="flex items-center justify-center gap-2 mt-4">
              <Badge variant="secondary" className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 border-green-200 dark:border-green-800">
                <Shield className="w-3 h-3 mr-1" />
                Enterprise Security
              </Badge>
              <Badge variant="secondary" className="bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 border-blue-200 dark:border-blue-800">
                <Zap className="w-3 h-3 mr-1" />
                Fast & Reliable
              </Badge>
            </div>
          </div>
          
          {/* Main Content Card */}
          <Card className="shadow-xl border-0 bg-white/95 dark:bg-slate-800/95 backdrop-blur-sm ring-1 ring-slate-200/50 dark:ring-slate-700/50">
            <CardContent className="p-8">
              <div className="space-y-6">
                {children}
              </div>
            </CardContent>
          </Card>
          
          {/* Footer Section */}
          <div className="mt-8 space-y-4">
            <div className="text-center">
              <p className="text-sm text-slate-500 dark:text-slate-400 flex items-center justify-center gap-2">
                <Shield className="w-4 h-4" />
                Protected by enterprise-grade security
              </p>
            </div>
            
            {/* Security Features */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-center">
              <div className="space-y-1">
                <div className="text-xs font-medium text-slate-600 dark:text-slate-300">
                  256-bit SSL
                </div>
                <div className="text-xs text-slate-500 dark:text-slate-400">
                  Encryption
                </div>
              </div>
              <div className="space-y-1">
                <div className="text-xs font-medium text-slate-600 dark:text-slate-300">
                  2FA Support
                </div>
                <div className="text-xs text-slate-500 dark:text-slate-400">
                  Multi-factor Auth
                </div>
              </div>
              <div className="space-y-1">
                <div className="text-xs font-medium text-slate-600 dark:text-slate-300">
                  SOC 2 Compliant
                </div>
                <div className="text-xs text-slate-500 dark:text-slate-400">
                  Certified Secure
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}