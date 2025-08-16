/**
 * Profile Management Page
 * NextJS Stripe Payment Template
 * 
 * Protected profile page that allows users to view and edit their profile information,
 * including personal details and profile image management.
 */

import { Suspense } from 'react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ProfileForm } from '@/components/profile/ProfileForm';
import { ProfileImageUpload } from '@/components/profile/ProfileImageUpload';
import { ProfileHeader } from '@/components/profile/ProfileHeader';
import { ProfileSkeleton } from '@/components/profile/ProfileSkeleton';

export const metadata: Metadata = {
  title: 'Profile Settings | Payment Integration Template',
  description: 'Manage your profile information and preferences',
};

/**
 * Profile page component with loading states and error boundaries
 */
export default function ProfilePage() {
  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
          Profile Settings
        </h1>
        <p className="text-slate-600 dark:text-slate-400">
          Manage your account settings and preferences
        </p>
      </div>

      <Suspense fallback={<ProfileSkeleton />}>
        <ProfileContent />
      </Suspense>
    </div>
  );
}

/**
 * Main profile content component with data loading
 */
function ProfileContent() {
  return (
    <div className="grid gap-6 lg:grid-cols-3">
      {/* Profile Overview */}
      <div className="lg:col-span-3">
        <ProfileHeader />
      </div>

      {/* Profile Image Upload */}
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <span className="h-5 w-5 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center">
                <svg
                  className="h-3 w-3 text-blue-600 dark:text-blue-400"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                  />
                </svg>
              </span>
              Profile Picture
            </CardTitle>
            <CardDescription>
              Upload a new profile picture or remove your current one
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ProfileImageUpload />
          </CardContent>
        </Card>

        {/* Session Management Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <span className="h-5 w-5 rounded-full bg-orange-100 dark:bg-orange-900 flex items-center justify-center">
                <svg
                  className="h-3 w-3 text-orange-600 dark:text-orange-400"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
                  />
                </svg>
              </span>
              Session Management
            </CardTitle>
            <CardDescription>
              Monitor and manage your active sessions across all devices
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="text-sm text-slate-600 dark:text-slate-400">
              Keep your account secure by monitoring active sessions and terminating any you don&apos;t recognize.
            </div>
            <Link href="/profile/sessions">
              <Button className="w-full">
                <svg
                  className="h-4 w-4 mr-2"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                  />
                </svg>
                Manage Sessions
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>

      {/* Profile Information Form */}
      <div className="lg:col-span-2 space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <span className="h-5 w-5 rounded-full bg-green-100 dark:bg-green-900 flex items-center justify-center">
                <svg
                  className="h-3 w-3 text-green-600 dark:text-green-400"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                  />
                </svg>
              </span>
              Personal Information
            </CardTitle>
            <CardDescription>
              Update your personal details and preferences
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ProfileForm />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}