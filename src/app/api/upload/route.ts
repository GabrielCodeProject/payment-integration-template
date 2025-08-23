/**
 * File Upload API Route
 * 
 * Handles file uploads for various types (product images, profile pictures, etc.)
 */

import { NextRequest, NextResponse } from 'next/server';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { v4 as uuidv4 } from 'uuid';
import { validateApiAccess, createApiErrorResponse } from '@/lib/auth/server-session';

const UPLOAD_DIR = join(process.cwd(), 'public/uploads');
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_TYPES = {
  product: ['image/jpeg', 'image/png', 'image/webp'],
  profile: ['image/jpeg', 'image/png', 'image/webp'],
  document: ['application/pdf', 'text/plain', 'application/msword'],
};

/**
 * POST /api/upload - Upload files
 * 
 * Handles multipart file uploads with validation and storage
 */
export async function POST(request: NextRequest) {
  try {
    // Validate authentication
    const { isValid, session, error } = await validateApiAccess(request);
    
    if (!isValid || !session) {
      return createApiErrorResponse(
        error?.code || 401,
        error?.message || 'Authentication required'
      );
    }

    const formData = await request.formData();
    const file = formData.get('file') as File;
    const type = formData.get('type') as string || 'product';

    if (!file) {
      return createApiErrorResponse(400, 'No file provided');
    }

    // Validate file type
    if (!ALLOWED_TYPES[type as keyof typeof ALLOWED_TYPES]) {
      return createApiErrorResponse(400, 'Invalid upload type');
    }

    const allowedMimeTypes = ALLOWED_TYPES[type as keyof typeof ALLOWED_TYPES];
    if (!allowedMimeTypes.includes(file.type)) {
      return createApiErrorResponse(400, `Invalid file type. Allowed types: ${allowedMimeTypes.join(', ')}`);
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      return createApiErrorResponse(400, `File too large. Maximum size: ${MAX_FILE_SIZE / 1024 / 1024}MB`);
    }

    // Generate unique filename
    const fileExtension = file.name.split('.').pop();
    const uniqueFilename = `${session.user.id}-${uuidv4()}.${fileExtension}`;
    
    // Create type-specific directory
    const typeDir = join(UPLOAD_DIR, type);
    try {
      await mkdir(typeDir, { recursive: true });
    } catch (_error) {
      // Directory might already exist, ignore error
    }

    // Save file
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const filePath = join(typeDir, uniqueFilename);
    
    await writeFile(filePath, buffer);

    // Return public URL
    const publicUrl = `/uploads/${type}/${uniqueFilename}`;

    return NextResponse.json({
      url: publicUrl,
      filename: uniqueFilename,
      size: file.size,
      type: file.type,
      message: 'File uploaded successfully',
    }, { status: 201 });

  } catch (_error) {
    // console.error('Error uploading file:', error);
    return createApiErrorResponse(500, 'Failed to upload file');
  }
}

/**
 * OPTIONS /api/upload - Handle CORS preflight requests
 */
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Max-Age': '86400',
    },
  });
}