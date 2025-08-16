/**
 * Profile Service - Backend Business Logic for Profile Management
 * NextJS Stripe Payment Template
 * 
 * This service handles all profile-related operations including
 * profile updates, image uploads, and data validation.
 */

import { promises as fs } from 'fs';
import path from 'path';
import crypto from 'crypto';
import { db } from '@/lib/db';
import { auditService, type AuditContext } from '@/lib/audit';
import {
  type UpdateProfile,
  type ProfileResponse,
  updateProfileSchema,
  profileImageUrlSchema,
} from '@/lib/validations/base/user';

export interface ProfileServiceConfig {
  maxImageSize: number;
  allowedImageTypes: string[];
  uploadDirectory: string;
  baseUrl: string;
}

export interface ImageUploadResult {
  success: boolean;
  imageUrl?: string;
  error?: string;
  oldImageUrl?: string;
}

export interface ProfileUpdateResult {
  success: boolean;
  data?: ProfileResponse;
  error?: string;
}

/**
 * Profile management service with comprehensive security and audit logging
 */
export class ProfileService {
  private config: ProfileServiceConfig;

  constructor(config?: Partial<ProfileServiceConfig>) {
    this.config = {
      maxImageSize: 5 * 1024 * 1024, // 5MB
      allowedImageTypes: ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'],
      uploadDirectory: path.join(process.cwd(), 'public', 'uploads', 'profiles'),
      baseUrl: process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000',
      ...config,
    };
  }

  /**
   * Get user profile with security validation
   */
  async getProfile(userId: string, auditContext?: AuditContext): Promise<ProfileUpdateResult> {
    try {
      // Set audit context if provided
      if (auditContext) {
        await auditService.setAuditContext(auditContext);
      }

      const user = await db.user.findUnique({
        where: { id: userId, isActive: true },
        select: {
          id: true,
          email: true,
          name: true,
          emailVerified: true,
          image: true,
          phone: true,
          twoFactorEnabled: true,
          isActive: true,
          role: true,
          stripeCustomerId: true,
          preferredCurrency: true,
          timezone: true,
          createdAt: true,
          updatedAt: true,
          lastLoginAt: true,
        },
      });

      if (!user) {
        return {
          success: false,
          error: 'User not found or inactive',
        };
      }

      // Create audit log for profile access
      await auditService.createAuditLog({
        tableName: 'users',
        recordId: userId,
        action: 'ACCESS',
        metadata: {
          operation: 'profile_view',
          accessedFields: Object.keys(user),
        },
        context: auditContext,
      });

      const profile: ProfileResponse = {
        ...user,
        hasStripeCustomer: Boolean(user.stripeCustomerId),
      };

      return {
        success: true,
        data: profile,
      };
    } catch (error) {
      console.error('Profile fetch error:', error);
      return {
        success: false,
        error: 'Failed to fetch profile',
      };
    } finally {
      if (auditContext) {
        await auditService.clearAuditContext();
      }
    }
  }

  /**
   * Update user profile with validation and audit logging
   */
  async updateProfile(
    userId: string,
    updateData: UpdateProfile,
    auditContext?: AuditContext
  ): Promise<ProfileUpdateResult> {
    try {
      // Set audit context if provided
      if (auditContext) {
        await auditService.setAuditContext(auditContext);
      }

      // Validate input data
      const validatedData = updateProfileSchema.parse(updateData);

      // Check if user exists and is active
      const existingUser = await db.user.findUnique({
        where: { id: userId, isActive: true },
      });

      if (!existingUser) {
        return {
          success: false,
          error: 'User not found or inactive',
        };
      }

      // Prepare update data - only include fields that have values
      const updateFields: Partial<UpdateProfile> = {};
      
      if (validatedData.name !== undefined) {
        updateFields.name = validatedData.name;
      }
      
      if (validatedData.phone !== undefined) {
        updateFields.phone = validatedData.phone;
      }
      
      if (validatedData.timezone !== undefined) {
        updateFields.timezone = validatedData.timezone;
      }
      
      if (validatedData.preferredCurrency !== undefined) {
        updateFields.preferredCurrency = validatedData.preferredCurrency;
      }

      // Only proceed if there are fields to update
      if (Object.keys(updateFields).length === 0) {
        return {
          success: false,
          error: 'No valid fields to update',
        };
      }

      // Update user in database with transaction
      const updatedUser = await db.$transaction(async (tx) => {
        const user = await tx.user.update({
          where: { id: userId },
          data: updateFields,
          select: {
            id: true,
            email: true,
            name: true,
            emailVerified: true,
            image: true,
            phone: true,
            twoFactorEnabled: true,
            isActive: true,
            role: true,
            stripeCustomerId: true,
            preferredCurrency: true,
            timezone: true,
            createdAt: true,
            updatedAt: true,
            lastLoginAt: true,
          },
        });

        return user;
      });

      // Create audit log for profile update
      await auditService.createAuditLog({
        tableName: 'users',
        recordId: userId,
        action: 'UPDATE',
        oldValues: existingUser,
        newValues: updatedUser,
        changedFields: Object.keys(updateFields),
        metadata: {
          operation: 'profile_update',
          updatedFields: Object.keys(updateFields),
          updateSource: 'profile_service',
        },
        context: auditContext,
      });

      const profile: ProfileResponse = {
        ...updatedUser,
        hasStripeCustomer: Boolean(updatedUser.stripeCustomerId),
      };

      return {
        success: true,
        data: profile,
      };
    } catch (error) {
      console.error('Profile update error:', error);
      
      // Create audit log for failed update
      await auditService.createAuditLog({
        tableName: 'users',
        recordId: userId,
        action: 'UPDATE',
        metadata: {
          operation: 'profile_update_failed',
          error: error instanceof Error ? error.message : 'Unknown error',
          updateData: updateData,
        },
        context: auditContext,
      }).catch(() => {}); // Don't fail if audit logging fails

      if (error instanceof Error) {
        return {
          success: false,
          error: error.message.includes('validation') 
            ? 'Invalid profile data provided'
            : 'Failed to update profile',
        };
      }

      return {
        success: false,
        error: 'Failed to update profile',
      };
    } finally {
      if (auditContext) {
        await auditService.clearAuditContext();
      }
    }
  }

  /**
   * Upload and process profile image with security validation
   */
  async uploadProfileImage(
    userId: string,
    imageFile: File,
    auditContext?: AuditContext
  ): Promise<ImageUploadResult> {
    try {
      // Set audit context if provided
      if (auditContext) {
        await auditService.setAuditContext(auditContext);
      }

      // Validate file
      if (!imageFile) {
        return {
          success: false,
          error: 'No image file provided',
        };
      }

      if (imageFile.size > this.config.maxImageSize) {
        return {
          success: false,
          error: 'File size too large (max 5MB)',
        };
      }

      if (!this.config.allowedImageTypes.includes(imageFile.type)) {
        return {
          success: false,
          error: 'Invalid file type. Only JPEG, PNG, and WebP are allowed',
        };
      }

      // Check if user exists and is active
      const existingUser = await db.user.findUnique({
        where: { id: userId, isActive: true },
        select: { id: true, image: true },
      });

      if (!existingUser) {
        return {
          success: false,
          error: 'User not found or inactive',
        };
      }

      // Ensure upload directory exists
      await fs.mkdir(this.config.uploadDirectory, { recursive: true });

      // Generate unique filename
      const fileExtension = path.extname(imageFile.name) || '.jpg';
      const uniqueId = crypto.randomUUID();
      const fileName = `${userId}-${uniqueId}${fileExtension}`;
      const filePath = path.join(this.config.uploadDirectory, fileName);
      const imageUrl = `/uploads/profiles/${fileName}`;

      // Convert File to Buffer and save
      const arrayBuffer = await imageFile.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      await fs.writeFile(filePath, buffer);

      // Validate the uploaded file URL
      const validatedImageUrl = profileImageUrlSchema.parse({ imageUrl });

      // Update user's image URL in database with transaction
      const updatedUser = await db.$transaction(async (tx) => {
        const user = await tx.user.update({
          where: { id: userId },
          data: { image: validatedImageUrl.imageUrl },
          select: { id: true, image: true },
        });

        return user;
      });

      // Delete old image if it exists and is not the default
      if (existingUser.image && existingUser.image.startsWith('/uploads/profiles/')) {
        try {
          const oldImagePath = path.join(process.cwd(), 'public', existingUser.image);
          await fs.unlink(oldImagePath);
        } catch (deleteError) {
          // Log but don't fail if old image deletion fails
          console.warn('Failed to delete old profile image:', deleteError);
        }
      }

      // Create audit log for image upload
      await auditService.createAuditLog({
        tableName: 'users',
        recordId: userId,
        action: 'UPDATE',
        oldValues: { image: existingUser.image },
        newValues: { image: updatedUser.image },
        changedFields: ['image'],
        metadata: {
          operation: 'profile_image_upload',
          fileName,
          fileSize: imageFile.size,
          fileType: imageFile.type,
          oldImageUrl: existingUser.image,
          newImageUrl: updatedUser.image,
        },
        context: auditContext,
      });

      return {
        success: true,
        imageUrl: updatedUser.image || undefined,
        oldImageUrl: existingUser.image || undefined,
      };
    } catch (error) {
      console.error('Profile image upload error:', error);
      
      // Create audit log for failed upload
      await auditService.createAuditLog({
        tableName: 'users',
        recordId: userId,
        action: 'UPDATE',
        metadata: {
          operation: 'profile_image_upload_failed',
          error: error instanceof Error ? error.message : 'Unknown error',
          fileName: imageFile?.name,
          fileSize: imageFile?.size,
          fileType: imageFile?.type,
        },
        context: auditContext,
      }).catch(() => {}); // Don't fail if audit logging fails

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to upload image',
      };
    } finally {
      if (auditContext) {
        await auditService.clearAuditContext();
      }
    }
  }

  /**
   * Delete profile image
   */
  async deleteProfileImage(
    userId: string,
    auditContext?: AuditContext
  ): Promise<ImageUploadResult> {
    try {
      // Set audit context if provided
      if (auditContext) {
        await auditService.setAuditContext(auditContext);
      }

      // Check if user exists and is active
      const existingUser = await db.user.findUnique({
        where: { id: userId, isActive: true },
        select: { id: true, image: true },
      });

      if (!existingUser) {
        return {
          success: false,
          error: 'User not found or inactive',
        };
      }

      if (!existingUser.image || !existingUser.image.startsWith('/uploads/profiles/')) {
        return {
          success: false,
          error: 'No custom profile image to delete',
        };
      }

      // Update user's image URL to null in database
      await db.user.update({
        where: { id: userId },
        data: { image: null },
      });

      // Delete the image file
      try {
        const imagePath = path.join(process.cwd(), 'public', existingUser.image);
        await fs.unlink(imagePath);
      } catch (deleteError) {
        console.warn('Failed to delete profile image file:', deleteError);
        // Don't fail the operation if file deletion fails
      }

      // Create audit log for image deletion
      await auditService.createAuditLog({
        tableName: 'users',
        recordId: userId,
        action: 'UPDATE',
        oldValues: { image: existingUser.image },
        newValues: { image: null },
        changedFields: ['image'],
        metadata: {
          operation: 'profile_image_delete',
          deletedImageUrl: existingUser.image,
        },
        context: auditContext,
      });

      return {
        success: true,
        oldImageUrl: existingUser.image,
      };
    } catch (error) {
      console.error('Profile image deletion error:', error);
      
      // Create audit log for failed deletion
      await auditService.createAuditLog({
        tableName: 'users',
        recordId: userId,
        action: 'UPDATE',
        metadata: {
          operation: 'profile_image_delete_failed',
          error: error instanceof Error ? error.message : 'Unknown error',
        },
        context: auditContext,
      }).catch(() => {}); // Don't fail if audit logging fails

      return {
        success: false,
        error: 'Failed to delete profile image',
      };
    } finally {
      if (auditContext) {
        await auditService.clearAuditContext();
      }
    }
  }

  /**
   * Rate limiting check for profile operations
   */
  async checkRateLimit(
    userId: string,
    operation: 'update' | 'image_upload',
    windowMs: number = 60 * 1000, // 1 minute
    maxOperations: number = 5
  ): Promise<{ allowed: boolean; resetTime?: Date }> {
    try {
      // For now, implement a simple in-memory rate limiting
      // In production, use Redis or database-based rate limiting
      
      // Get recent operations from audit log
      const recentOperations = await db.auditLog.count({
        where: {
          tableName: 'users',
          recordId: userId,
          action: 'UPDATE',
          timestamp: {
            gte: new Date(Date.now() - windowMs),
          },
          metadata: {
            path: ['operation'],
            equals: operation === 'update' ? 'profile_update' : 'profile_image_upload',
          },
        },
      });

      const allowed = recentOperations < maxOperations;
      const resetTime = new Date(Date.now() + windowMs);

      return { allowed, resetTime };
    } catch (error) {
      console.error('Rate limit check error:', error);
      // Allow operation if rate limit check fails
      return { allowed: true };
    }
  }
}

// Export singleton instance
export const profileService = new ProfileService();

// Export types
export type {
  ProfileServiceConfig,
  ImageUploadResult,
  ProfileUpdateResult,
};