/**
 * Profile Form Component
 * NextJS Stripe Payment Template
 * 
 * Form for editing user profile information with validation,
 * server actions integration, and optimistic updates.
 */

'use client';

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { getProfile, updateProfile } from '@/app/actions/profile';
import { updateProfileSchema, type UpdateProfile, type ProfileResponse } from '@/lib/validations/base/user';
import { toast } from 'sonner';
import { ProfileFormSkeleton } from './ProfileSkeleton';

// Common currencies for the select dropdown
const CURRENCIES = [
  { value: 'USD', label: 'USD - US Dollar' },
  { value: 'EUR', label: 'EUR - Euro' },
  { value: 'GBP', label: 'GBP - British Pound' },
  { value: 'CAD', label: 'CAD - Canadian Dollar' },
  { value: 'AUD', label: 'AUD - Australian Dollar' },
  { value: 'JPY', label: 'JPY - Japanese Yen' },
  { value: 'CHF', label: 'CHF - Swiss Franc' },
  { value: 'CNY', label: 'CNY - Chinese Yuan' },
  { value: 'INR', label: 'INR - Indian Rupee' },
  { value: 'BRL', label: 'BRL - Brazilian Real' },
];

// Common timezones for the select dropdown
const TIMEZONES = [
  { value: 'UTC', label: 'UTC - Coordinated Universal Time' },
  { value: 'America/New_York', label: 'EST - Eastern Time (US & Canada)' },
  { value: 'America/Chicago', label: 'CST - Central Time (US & Canada)' },
  { value: 'America/Denver', label: 'MST - Mountain Time (US & Canada)' },
  { value: 'America/Los_Angeles', label: 'PST - Pacific Time (US & Canada)' },
  { value: 'Europe/London', label: 'GMT - Greenwich Mean Time' },
  { value: 'Europe/Paris', label: 'CET - Central European Time' },
  { value: 'Europe/Berlin', label: 'CET - Central European Time (Berlin)' },
  { value: 'Asia/Tokyo', label: 'JST - Japan Standard Time' },
  { value: 'Asia/Shanghai', label: 'CST - China Standard Time' },
  { value: 'Asia/Kolkata', label: 'IST - India Standard Time' },
  { value: 'Australia/Sydney', label: 'AEDT - Australian Eastern Time' },
];

/**
 * Profile form for editing user information
 */
export function ProfileForm() {
  const [profile, setProfile] = useState<ProfileResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  const form = useForm<UpdateProfile>({
    resolver: zodResolver(updateProfileSchema),
    defaultValues: {
      name: '',
      phone: '',
      timezone: 'UTC',
      preferredCurrency: 'USD',
    },
  });

  const { formState: { isDirty } } = form;

  // Watch for form changes
  useEffect(() => {
    setHasChanges(isDirty);
  }, [isDirty]);

  // Load profile data
  useEffect(() => {
    async function loadProfile() {
      try {
        const result = await getProfile({});
        
        if (result?.data?.success && result.data.data) {
          const profileData = result.data.data;
          setProfile(profileData);
          
          // Update form with profile data
          form.reset({
            name: profileData.name || '',
            phone: profileData.phone || '',
            timezone: profileData.timezone || 'UTC',
            preferredCurrency: profileData.preferredCurrency || 'USD',
          });
        } else {
          toast.error(result?.data?.error || 'Failed to load profile');
        }
      } catch (error) {
        console.error('Profile load error:', error);
        toast.error('Failed to load profile information');
      } finally {
        setLoading(false);
      }
    }

    loadProfile();
  }, [form]);

  // Handle form submission
  const onSubmit = async (data: UpdateProfile) => {
    setSaving(true);

    try {
      const result = await updateProfile(data);

      if (result?.data?.success && result.data.data) {
        setProfile(result.data.data);
        form.reset(data); // Reset form to mark as not dirty
        toast.success(result.data.message || 'Profile updated successfully');
      } else {
        throw new Error(result?.data?.error || 'Failed to update profile');
      }
    } catch (error) {
      console.error('Profile update error:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  // Reset form to original values
  const handleReset = () => {
    if (profile) {
      form.reset({
        name: profile.name || '',
        phone: profile.phone || '',
        timezone: profile.timezone || 'UTC',
        preferredCurrency: profile.preferredCurrency || 'USD',
      });
    }
  };

  if (loading) {
    return <ProfileFormSkeleton />;
  }

  if (!profile) {
    return (
      <div className="text-center py-8">
        <p className="text-slate-500 dark:text-slate-400">
          Unable to load profile information
        </p>
      </div>
    );
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        {/* Name and Email Fields */}
        <div className="grid gap-4 md:grid-cols-2">
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Full Name</FormLabel>
                <FormControl>
                  <Input
                    placeholder="Enter your full name"
                    {...field}
                    disabled={saving}
                  />
                </FormControl>
                <FormDescription>
                  Your display name on the platform
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Email (Read-only) */}
          <FormItem>
            <FormLabel>Email Address</FormLabel>
            <FormControl>
              <Input
                value={profile.email}
                disabled
                className="bg-slate-50 dark:bg-slate-800 text-slate-500 dark:text-slate-400"
              />
            </FormControl>
            <FormDescription>
              Email address cannot be changed
            </FormDescription>
          </FormItem>
        </div>

        {/* Phone Field */}
        <FormField
          control={form.control}
          name="phone"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Phone Number</FormLabel>
              <FormControl>
                <Input
                  placeholder="+1234567890"
                  {...field}
                  disabled={saving}
                  value={field.value || ''}
                />
              </FormControl>
              <FormDescription>
                Include country code (e.g., +1 for US, +44 for UK)
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Timezone and Currency */}
        <div className="grid gap-4 md:grid-cols-2">
          <FormField
            control={form.control}
            name="timezone"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Timezone</FormLabel>
                <Select
                  onValueChange={field.onChange}
                  value={field.value}
                  disabled={saving}
                >
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select timezone" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {TIMEZONES.map((timezone) => (
                      <SelectItem key={timezone.value} value={timezone.value}>
                        {timezone.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormDescription>
                  Your local timezone for date and time display
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="preferredCurrency"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Preferred Currency</FormLabel>
                <Select
                  onValueChange={field.onChange}
                  value={field.value}
                  disabled={saving}
                >
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select currency" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {CURRENCIES.map((currency) => (
                      <SelectItem key={currency.value} value={currency.value}>
                        {currency.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormDescription>
                  Default currency for payments and billing
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-between pt-4 border-t border-slate-200 dark:border-slate-700">
          <Button
            type="button"
            variant="outline"
            onClick={handleReset}
            disabled={saving || !hasChanges}
          >
            Reset Changes
          </Button>

          <div className="flex items-center gap-2">
            {hasChanges && (
              <span className="text-sm text-slate-500 dark:text-slate-400">
                You have unsaved changes
              </span>
            )}
            <Button
              type="submit"
              disabled={saving || !hasChanges}
              className="min-w-[120px]"
            >
              {saving ? (
                <div className="flex items-center gap-2">
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                  Saving...
                </div>
              ) : (
                'Save Changes'
              )}
            </Button>
          </div>
        </div>

        {/* Form Status */}
        {hasChanges && (
          <div className="rounded-md bg-amber-50 dark:bg-amber-900/20 p-3">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg
                  className="h-5 w-5 text-amber-400"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                >
                  <path
                    fillRule="evenodd"
                    d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                    clipRule="evenodd"
                  />
                </svg>
              </div>
              <div className="ml-3">
                <p className="text-sm text-amber-800 dark:text-amber-200">
                  You have unsaved changes. Make sure to save your changes before leaving the page.
                </p>
              </div>
            </div>
          </div>
        )}
      </form>
    </Form>
  );
}