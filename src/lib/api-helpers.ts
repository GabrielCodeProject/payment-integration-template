/**
 * API Helper Functions for Product CRUD Routes
 * 
 * Provides simplified interfaces for common API operations including
 * rate limiting, audit logging, and utility functions.
 */

import { NextRequest } from 'next/server';
import { checkRateLimit, getClientIP } from '@/lib/rate-limiting';
import { auditService } from '@/lib/audit';

/**
 * Rate limiting configuration interface
 */
export interface RateLimitOptions {
  windowMs: number;
  maxRequests: number;
  keyGenerator?: (request: NextRequest) => string;
}

/**
 * Rate limiting result interface
 */
export interface RateLimitResult {
  success: boolean;
  remaining?: number;
  resetTime?: number;
  totalHits?: number;
}

/**
 * Simplified rate limiting function for API routes
 */
export async function rateLimit(
  request: NextRequest,
  options: RateLimitOptions
): Promise<RateLimitResult> {
  try {
    // Generate key using provided function or default to IP
    const key = options.keyGenerator 
      ? options.keyGenerator(request)
      : `ip:${getClientIP(request)}`;

    // Check rate limit using the existing service
    const result = await checkRateLimit(request, {
      max: options.maxRequests,
      windowMs: options.windowMs,
    });

    return {
      success: result.allowed,
      remaining: result.remaining,
      resetTime: result.resetTime,
      totalHits: result.totalHits,
    };
  } catch (error) {
    console.error('Rate limiting error:', error);
    // On error, allow the request but log the issue
    return { success: true };
  }
}

/**
 * Audit action parameters interface
 */
export interface AuditActionParams {
  action: string;
  resource: string;
  resourceId: string;
  adminUserId: string;
  adminRole: string;
  ipAddress: string;
  userAgent: string;
  sessionId?: string;
  details: Record<string, any>;
  severity: 'INFO' | 'WARNING' | 'ERROR' | 'CRITICAL';
}

/**
 * Simplified audit logging function for API routes
 */
export async function auditAction(params: AuditActionParams): Promise<void> {
  try {
    await auditService.createAuditLog({
      tableName: params.resource.toLowerCase(),
      recordId: params.resourceId,
      action: params.action,
      metadata: {
        adminUserId: params.adminUserId,
        adminRole: params.adminRole,
        ipAddress: params.ipAddress,
        userAgent: params.userAgent,
        sessionId: params.sessionId,
        severity: params.severity,
        timestamp: new Date().toISOString(),
        ...params.details,
      },
    });
  } catch (error) {
    // Don't let audit logging failures break the main operation
    console.error('Audit logging failed:', error);
  }
}

/**
 * Extract client information from request
 */
export function getClientInfo(request: NextRequest): {
  ipAddress: string;
  userAgent: string;
} {
  const forwarded = request.headers.get('x-forwarded-for');
  const ipAddress = forwarded ? forwarded.split(',')[0].trim() : 
                   request.headers.get('x-real-ip') || 
                   'unknown';

  const userAgent = request.headers.get('user-agent') || 'unknown';

  return { ipAddress, userAgent };
}

/**
 * Generate standardized error response
 */
export function createStandardErrorResponse(
  status: number,
  message: string,
  code?: string,
  details?: any
): Response {
  return new Response(
    JSON.stringify({
      error: {
        message,
        code: code || `ERROR_${status}`,
        status,
        timestamp: new Date().toISOString(),
        ...(details && process.env.NODE_ENV === 'development' ? { details } : {}),
      },
    }),
    {
      status,
      headers: {
        'Content-Type': 'application/json',
      },
    }
  );
}

/**
 * Generate standardized success response
 */
export function createStandardSuccessResponse(
  data: any,
  status: number = 200,
  message?: string
): Response {
  return new Response(
    JSON.stringify({
      success: true,
      data,
      ...(message && { message }),
      timestamp: new Date().toISOString(),
    }),
    {
      status,
      headers: {
        'Content-Type': 'application/json',
      },
    }
  );
}

/**
 * Parse JSON body with error handling
 */
export async function parseJsonBody<T = any>(request: NextRequest): Promise<{
  success: boolean;
  data?: T;
  error?: string;
}> {
  try {
    const data = await request.json();
    return { success: true, data };
  } catch (error) {
    return { 
      success: false, 
      error: 'Invalid JSON in request body' 
    };
  }
}

/**
 * Validate pagination parameters
 */
export function validatePagination(searchParams: URLSearchParams): {
  page: number;
  limit: number;
  offset: number;
} {
  const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '20', 10)));
  const offset = (page - 1) * limit;

  return { page, limit, offset };
}

/**
 * Build pagination metadata
 */
export function buildPaginationMeta(
  page: number,
  limit: number,
  total: number
): {
  page: number;
  pages: number;
  limit: number;
  total: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
} {
  const pages = Math.ceil(total / limit);
  
  return {
    page,
    pages,
    limit,
    total,
    hasNextPage: page < pages,
    hasPrevPage: page > 1,
  };
}

/**
 * Sanitize string input
 */
export function sanitizeString(input: string): string {
  return input
    .replace(/[<>]/g, '') // Remove potential XSS vectors
    .trim()
    .substring(0, 1000); // Limit length
}

/**
 * Validate and sanitize search query
 */
export function sanitizeSearchQuery(query: string): string {
  return query
    .replace(/[<>]/g, '') // Remove potential XSS vectors
    .replace(/[^\w\s-_.,!?]/g, '') // Allow only safe characters
    .trim()
    .substring(0, 200); // Limit length
}

/**
 * Extract and validate sort parameters
 */
export function parseSortParams(
  searchParams: URLSearchParams,
  allowedFields: string[] = ['createdAt', 'name', 'price']
): {
  sort: string;
  sortDirection: 'asc' | 'desc';
} {
  const sort = searchParams.get('sort') || 'createdAt';
  const sortDirection = (searchParams.get('sortDirection') === 'asc') ? 'asc' : 'desc';

  // Validate sort field
  const validSort = allowedFields.includes(sort) ? sort : 'createdAt';

  return { sort: validSort, sortDirection };
}

/**
 * Build cache headers for different content types
 */
export function getCacheHeaders(type: 'static' | 'dynamic' | 'no-cache'): Record<string, string> {
  switch (type) {
    case 'static':
      return {
        'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400', // 1 hour cache, 24 hour SWR
        'Vary': 'Accept, Accept-Encoding',
      };
    case 'dynamic':
      return {
        'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600', // 5 min cache, 10 min SWR
        'Vary': 'Accept, Accept-Encoding',
      };
    case 'no-cache':
      return {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
      };
    default:
      return {};
  }
}

/**
 * Convert price to display format
 */
export function formatPrice(price: number | string, currency: string = 'USD'): string {
  const numericPrice = typeof price === 'string' ? parseFloat(price) : price;
  
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
  }).format(numericPrice);
}

/**
 * Calculate discount percentage
 */
export function calculateDiscount(originalPrice: number, salePrice: number): number {
  if (originalPrice <= 0 || salePrice <= 0) return 0;
  return Math.round((1 - salePrice / originalPrice) * 100);
}

/**
 * Generate product URL slug
 */
export function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^\w\s-]/g, '') // Remove special characters
    .replace(/\s+/g, '-') // Replace spaces with hyphens
    .replace(/-+/g, '-') // Replace multiple hyphens with single
    .replace(/^-|-$/g, ''); // Remove leading/trailing hyphens
}

/**
 * Validate email format
 */
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Generate random identifier
 */
export function generateId(prefix: string = ''): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2);
  return prefix ? `${prefix}_${timestamp}_${random}` : `${timestamp}_${random}`;
}

/**
 * Deep clone object (simple version)
 */
export function deepClone<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj));
}

/**
 * Check if object is empty
 */
export function isEmpty(obj: any): boolean {
  if (obj === null || obj === undefined) return true;
  if (Array.isArray(obj)) return obj.length === 0;
  if (typeof obj === 'object') return Object.keys(obj).length === 0;
  if (typeof obj === 'string') return obj.trim() === '';
  return false;
}