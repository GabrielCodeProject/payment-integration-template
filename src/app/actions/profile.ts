/**
 * Profile Management Server Actions
 * NextJS Stripe Payment Template
 * 
 * Server actions for handling profile updates, image uploads,
 * and profile data retrieval with comprehensive security and validation.
 */

"use server";

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { authActionClient } from '@/lib/safe-action';
import { profileService } from '@/services/profile.service';
import {
  updateProfileSchema,
  profileImageUploadSchema,
  type UpdateProfile,
  type ProfileResponse,
} from '@/lib/validations/base/user';

// Action result types
export interface ActionResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

/**
 * Get current user's profile
 */
export const getProfile = authActionClient
  .schema(z.object({}))
  .action(async ({ ctx }): Promise<ActionResult<ProfileResponse>> => {
    try {
      // Create audit context
      const auditContext = {
        userId: ctx.user.id,
        userEmail: ctx.user.email,
        requestId: crypto.randomUUID(),
      };

      const result = await profileService.getProfile(ctx.user.id, auditContext);

      if (!result.success) {
        return {
          success: false,
          error: result.error || 'Failed to fetch profile',
        };
      }

      return {
        success: true,
        data: result.data,
        message: 'Profile fetched successfully',
      };
    } catch (_error) {
      // console.error('Get profile action error:', error);
      return {
        success: false,
        error: 'Failed to fetch profile',
      };
    }
  });

/**
 * Update user profile (excluding email)
 */
export const updateProfile = authActionClient
  .schema(updateProfileSchema)
  .action(async ({ parsedInput, ctx }): Promise<ActionResult<ProfileResponse>> => {
    try {
      // Rate limiting check
      const rateLimitResult = await profileService.checkRateLimit(ctx.user.id, 'update');
      if (!rateLimitResult.allowed) {
        return {
          success: false,
          error: 'Too many profile updates. Please try again later.',
        };
      }

      // Create audit context
      const auditContext = {
        userId: ctx.user.id,
        userEmail: ctx.user.email,
        requestId: crypto.randomUUID(),
      };

      const result = await profileService.updateProfile(
        ctx.user.id,
        parsedInput as UpdateProfile,
        auditContext
      );

      if (!result.success) {
        return {
          success: false,
          error: result.error || 'Failed to update profile',
        };
      }

      // Revalidate profile-related pages
      revalidatePath('/dashboard');
      revalidatePath('/profile');

      return {
        success: true,
        data: result.data,
        message: 'Profile updated successfully',
      };
    } catch (_error) {
      // console.error('Update profile action error:', error);
      return {
        success: false,
        error: 'Failed to update profile',
      };
    }
  });

/**
 * Upload profile image
 */
export const uploadProfileImage = authActionClient
  .schema(profileImageUploadSchema)
  .action(async ({ parsedInput, ctx }): Promise<ActionResult<{ imageUrl: string }>> => {
    try {
      // Rate limiting check
      const rateLimitResult = await profileService.checkRateLimit(ctx.user.id, 'image_upload');
      if (!rateLimitResult.allowed) {
        return {
          success: false,
          error: 'Too many image uploads. Please try again later.',
        };
      }

      // Create audit context
      const auditContext = {
        userId: ctx.user.id,
        userEmail: ctx.user.email,
        requestId: crypto.randomUUID(),
      };

      const result = await profileService.uploadProfileImage(
        ctx.user.id,
        parsedInput.image,
        auditContext
      );

      if (!result.success) {
        return {
          success: false,
          error: result.error || 'Failed to upload image',
        };
      }

      // Revalidate profile-related pages
      revalidatePath('/dashboard');
      revalidatePath('/profile');

      return {
        success: true,
        data: { imageUrl: result.imageUrl! },
        message: 'Profile image uploaded successfully',
      };
    } catch (_error) {
      // console.error('Upload profile image action error:', error);
      return {
        success: false,
        error: 'Failed to upload profile image',
      };
    }
  });

/**
 * Delete profile image
 */
export const deleteProfileImage = authActionClient
  .schema(z.object({}))
  .action(async ({ ctx }): Promise<ActionResult<Record<string, never>>> => {
    try {
      // Rate limiting check
      const rateLimitResult = await profileService.checkRateLimit(ctx.user.id, 'image_upload');
      if (!rateLimitResult.allowed) {
        return {
          success: false,
          error: 'Too many operations. Please try again later.',
        };
      }

      // Create audit context
      const auditContext = {
        userId: ctx.user.id,
        userEmail: ctx.user.email,
        requestId: crypto.randomUUID(),
      };

      const result = await profileService.deleteProfileImage(ctx.user.id, auditContext);

      if (!result.success) {
        return {
          success: false,
          error: result.error || 'Failed to delete image',
        };
      }

      // Revalidate profile-related pages
      revalidatePath('/dashboard');
      revalidatePath('/profile');

      return {
        success: true,
        data: {} as Record<string, never>,
        message: 'Profile image deleted successfully',
      };
    } catch (_error) {
      // console.error('Delete profile image action error:', error);
      return {
        success: false,
        error: 'Failed to delete profile image',
      };
    }
  });

/**
 * Validate profile data (client-side validation helper)
 */
export const validateProfileData = authActionClient
  .schema(updateProfileSchema)
  .action(async ({ parsedInput }): Promise<ActionResult<UpdateProfile>> => {
    try {
      // Server-side validation
      const validatedData = updateProfileSchema.parse(parsedInput);

      return {
        success: true,
        data: validatedData,
        message: 'Profile data is valid',
      };
    } catch (_error) {
      // console.error('Profile validation error:', error);
      
      if (_error instanceof z.ZodError) {
        const firstError = _error.issues[0];
        return {
          success: false,
          error: firstError?.message || 'Invalid profile data',
        };
      }

      return {
        success: false,
        error: 'Failed to validate profile data',
      };
    }
  });

/**
 * Check if user can perform profile operations (rate limiting check)
 */
export const checkProfileOperationLimit = authActionClient
  .schema(z.object({
    operation: z.enum(['update', 'image_upload']),
  }))
  .action(async ({ parsedInput, ctx }): Promise<ActionResult<{ allowed: boolean; resetTime?: string }>> => {
    try {
      const result = await profileService.checkRateLimit(ctx.user.id, parsedInput.operation);

      return {
        success: true,
        data: {
          allowed: result.allowed,
          resetTime: result.resetTime?.toISOString(),
        },
        message: result.allowed ? 'Operation allowed' : 'Rate limit exceeded',
      };
    } catch (_error) {
      // console.error('Rate limit check error:', error);
      return {
        success: false,
        error: 'Failed to check operation limits',
      };
    }
  });

// Export action types for client-side usage
export type GetProfileAction = typeof getProfile;
export type UpdateProfileAction = typeof updateProfile;
export type UploadProfileImageAction = typeof uploadProfileImage;
export type DeleteProfileImageAction = typeof deleteProfileImage;
export type ValidateProfileDataAction = typeof validateProfileData;
export type CheckProfileOperationLimitAction = typeof checkProfileOperationLimit;