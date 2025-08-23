/**
 * Profile Header Component
 * NextJS Stripe Payment Template
 *
 * Displays user profile overview with avatar, basic info, and status indicators.
 * Shows account creation date, last login, and verification status.
 */

"use client";

import { getProfile } from "@/app/actions/profile";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import type { ProfileResponse } from "@/lib/validations/base/user";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ProfileHeaderSkeleton } from "./ProfileSkeleton";

/**
 * Profile header with user information and status
 */
export function ProfileHeader() {
  const [profile, setProfile] = useState<ProfileResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadProfile() {
      try {
        const result = await getProfile({});

        if (result?.data?.success && result.data.data) {
          setProfile(result.data.data);
        } else {
          toast.error(result?.data?.error || "Failed to load profile");
        }
      } catch (_error) {
        console.error("Profile load error:", _error);
        toast.error("Failed to load profile information");
      } finally {
        setLoading(false);
      }
    }

    loadProfile();
  }, []);

  if (loading) {
    return <ProfileHeaderSkeleton />;
  }

  if (!profile) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="py-8 text-center">
            <p className="text-slate-500 dark:text-slate-400">
              Unable to load profile information
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const initials = profile.name
    ? profile.name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
    : profile.email[0].toUpperCase();

  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-start space-x-6">
          {/* Profile Avatar */}
          <Avatar className="h-20 w-20 border-2 border-slate-200 dark:border-slate-700">
            <AvatarImage
              src={profile.image || undefined}
              alt={profile.name || profile.email}
              className="object-cover"
            />
            <AvatarFallback className="bg-slate-100 text-xl font-semibold dark:bg-slate-800">
              {initials}
            </AvatarFallback>
          </Avatar>

          {/* Profile Information */}
          <div className="flex-1 space-y-3">
            <div>
              <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                {profile.name || "Unnamed User"}
              </h2>
              <p className="text-lg text-slate-600 dark:text-slate-400">
                {profile.email}
              </p>
            </div>

            {/* Status Badges */}
            <div className="flex flex-wrap items-center gap-2">
              <Badge
                variant={profile.emailVerified ? "default" : "secondary"}
                className={
                  profile.emailVerified
                    ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100"
                    : "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-100"
                }
              >
                {profile.emailVerified ? "Verified" : "Unverified"}
              </Badge>

              <Badge
                variant={profile.isActive ? "default" : "destructive"}
                className={
                  profile.isActive
                    ? "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-100"
                    : ""
                }
              >
                {profile.isActive ? "Active" : "Inactive"}
              </Badge>

              {profile.role !== "CUSTOMER" && (
                <Badge variant="outline" className="font-medium">
                  {profile.role}
                </Badge>
              )}

              {profile.hasStripeCustomer && (
                <Badge
                  variant="outline"
                  className="border-purple-200 bg-purple-50 text-purple-700 dark:border-purple-800 dark:bg-purple-900/20 dark:text-purple-300"
                >
                  Stripe Customer
                </Badge>
              )}

              {profile.twoFactorEnabled && (
                <Badge
                  variant="outline"
                  className="border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-900/20 dark:text-emerald-300"
                >
                  2FA Enabled
                </Badge>
              )}
            </div>

            {/* Account Details */}
            <div className="grid grid-cols-1 gap-4 pt-2 sm:grid-cols-2 lg:grid-cols-4">
              <div className="space-y-1">
                <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
                  Member Since
                </p>
                <p className="text-sm text-slate-900 dark:text-slate-100">
                  {new Date(profile.createdAt).toLocaleDateString("en-US", {
                    year: "numeric",
                    month: "short",
                    day: "numeric",
                  })}
                </p>
              </div>

              {profile.lastLoginAt && (
                <div className="space-y-1">
                  <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
                    Last Login
                  </p>
                  <p className="text-sm text-slate-900 dark:text-slate-100">
                    {new Date(profile.lastLoginAt).toLocaleDateString("en-US", {
                      year: "numeric",
                      month: "short",
                      day: "numeric",
                    })}
                  </p>
                </div>
              )}

              {profile.timezone && (
                <div className="space-y-1">
                  <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
                    Timezone
                  </p>
                  <p className="text-sm text-slate-900 dark:text-slate-100">
                    {profile.timezone}
                  </p>
                </div>
              )}

              {profile.preferredCurrency && (
                <div className="space-y-1">
                  <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
                    Currency
                  </p>
                  <p className="text-sm text-slate-900 dark:text-slate-100">
                    {profile.preferredCurrency}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
