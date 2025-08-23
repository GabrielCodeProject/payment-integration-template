/**
 * Profile Image Upload Component
 * NextJS Stripe Payment Template
 * 
 * Drag & drop image upload component with preview, progress indication,
 * and image management capabilities (upload/delete).
 */

'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Progress } from '@/components/ui/progress';
import { uploadProfileImage, deleteProfileImage, getProfile } from '@/app/actions/profile';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import type { ProfileResponse } from '@/lib/validations/base/user';

interface FileWithPreview extends File {
  preview?: string;
}

/**
 * Profile image upload with drag & drop support
 */
export function ProfileImageUpload() {
  const [profile, setProfile] = useState<ProfileResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [dragActive, setDragActive] = useState(false);
  const [previewFile, setPreviewFile] = useState<FileWithPreview | null>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dropRef = useRef<HTMLDivElement>(null);

  // Load current profile
  useEffect(() => {
    async function loadProfile() {
      setLoading(true);
      try {
        const result = await getProfile({});
        
        if (result?.data?.success && result.data.data) {
          setProfile(result.data.data);
        }
      } catch (_error) {
        // console.error('Failed to load profile:', error);
      } finally {
        setLoading(false);
      }
    }

    loadProfile();
  }, []);

  // Handle drag events
  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  }, []);

  // Handle drop
  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFiles(e.dataTransfer.files);
    }
  }, []);

  // Handle file input change
  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    e.preventDefault();
    if (e.target.files && e.target.files[0]) {
      handleFiles(e.target.files);
    }
  }, []);

  // Process selected files
  const handleFiles = useCallback((files: FileList) => {
    const file = files[0];
    
    if (!file) return;

    // Validate file type
    if (!['image/jpeg', 'image/jpg', 'image/png', 'image/webp'].includes(file.type)) {
      toast.error('Please upload a valid image file (JPEG, PNG, or WebP)');
      return;
    }

    // Validate file size (5MB limit)
    if (file.size > 5 * 1024 * 1024) {
      toast.error('File size must be less than 5MB');
      return;
    }

    // Create preview
    const fileWithPreview = file as FileWithPreview;
    fileWithPreview.preview = URL.createObjectURL(file);
    setPreviewFile(fileWithPreview);
  }, []);

  // Upload image
  const handleUpload = async () => {
    if (!previewFile) return;

    setUploading(true);
    setUploadProgress(0);

    try {
      // Simulate upload progress
      const progressInterval = setInterval(() => {
        setUploadProgress((prev) => {
          if (prev >= 90) {
            clearInterval(progressInterval);
            return 90;
          }
          return prev + 10;
        });
      }, 100);

      const formData = new FormData();
      formData.append('image', previewFile);

      const result = await uploadProfileImage({ image: previewFile });

      clearInterval(progressInterval);
      setUploadProgress(100);

      if (result?.data?.success && result.data.data) {
        setProfile(prev => prev ? { ...prev, image: result.data.data.imageUrl } : null);
        setPreviewFile(null);
        toast.success(result.data.message || 'Profile image uploaded successfully');
      } else {
        throw new Error(result?.data?.error || 'Upload failed');
      }
    } catch (_error) {
      // console.error('Upload error:', error);
      toast.error(error instanceof Error ? _error.message : 'Failed to upload image');
    } finally {
      setUploading(false);
      setUploadProgress(0);
      
      // Clear file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  // Delete image
  const handleDelete = async () => {
    if (!profile?.image) return;

    setLoading(true);
    
    try {
      const result = await deleteProfileImage({});

      if (result?.data?.success) {
        setProfile(prev => prev ? { ...prev, image: undefined } : null);
        toast.success(result.data.message || 'Profile image deleted successfully');
      } else {
        throw new Error(result?.data?.error || 'Delete failed');
      }
    } catch (_error) {
      // console.error('Delete error:', error);
      toast.error(error instanceof Error ? _error.message : 'Failed to delete image');
    } finally {
      setLoading(false);
    }
  };

  // Cancel preview
  const cancelPreview = () => {
    if (previewFile?.preview) {
      URL.revokeObjectURL(previewFile.preview);
    }
    setPreviewFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Get current image source
  const currentImageSrc = previewFile?.preview || profile?.image;
  const userInitials = profile?.name
    ? profile.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
    : profile?.email?.[0]?.toUpperCase() || '?';

  return (
    <div className="space-y-4">
      {/* Image Preview */}
      <div className="flex justify-center">
        <Avatar className="h-32 w-32 border-4 border-slate-200 dark:border-slate-700">
          <AvatarImage 
            src={currentImageSrc} 
            alt="Profile image"
            className="object-cover"
          />
          <AvatarFallback className="bg-slate-100 dark:bg-slate-800 text-2xl font-semibold">
            {userInitials}
          </AvatarFallback>
        </Avatar>
      </div>

      {/* Upload Progress */}
      {uploading && (
        <div className="space-y-2">
          <Progress value={uploadProgress} className="w-full" />
          <p className="text-sm text-center text-slate-600 dark:text-slate-400">
            Uploading... {uploadProgress}%
          </p>
        </div>
      )}

      {/* Drag & Drop Area */}
      <div
        ref={dropRef}
        className={cn(
          "relative border-2 border-dashed rounded-lg p-6 text-center transition-colors",
          dragActive
            ? "border-blue-500 bg-blue-50 dark:bg-blue-950/20"
            : "border-slate-300 dark:border-slate-600 hover:border-slate-400 dark:hover:border-slate-500",
          uploading && "pointer-events-none opacity-50"
        )}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/jpg,image/png,image/webp"
          onChange={handleChange}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
          disabled={uploading}
        />
        
        <div className="space-y-2">
          <svg
            className="mx-auto h-8 w-8 text-slate-400"
            stroke="currentColor"
            fill="none"
            viewBox="0 0 48 48"
          >
            <path
              d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          <div className="text-sm text-slate-600 dark:text-slate-400">
            <span className="font-semibold text-blue-600 dark:text-blue-400">
              Click to upload
            </span>{' '}
            or drag and drop
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            PNG, JPG, WEBP up to 5MB
          </p>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex flex-col gap-2">
        {previewFile ? (
          <div className="flex gap-2">
            <Button
              onClick={handleUpload}
              disabled={uploading}
              className="flex-1"
            >
              {uploading ? 'Uploading...' : 'Upload Image'}
            </Button>
            <Button
              variant="outline"
              onClick={cancelPreview}
              disabled={uploading}
            >
              Cancel
            </Button>
          </div>
        ) : (
          <Button
            variant="outline"
            onClick={() => fileInputRef.current?.click()}
            disabled={loading || uploading}
            className="w-full"
          >
            Choose File
          </Button>
        )}

        {profile?.image && !previewFile && (
          <Button
            variant="destructive"
            onClick={handleDelete}
            disabled={loading || uploading}
            size="sm"
            className="w-full"
          >
            {loading ? 'Deleting...' : 'Remove Image'}
          </Button>
        )}
      </div>

      {/* Help Text */}
      <p className="text-xs text-slate-500 dark:text-slate-400 text-center">
        Your profile image will be visible to other users on the platform.
      </p>
    </div>
  );
}