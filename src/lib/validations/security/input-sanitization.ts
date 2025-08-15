import { z } from 'zod';

/**
 * Input Sanitization Validation Schemas
 * 
 * Validation schemas for sanitizing and validating user inputs to prevent
 * XSS, SQL injection, and other security vulnerabilities.
 */

// =============================================================================
// SANITIZATION CONFIGURATION
// =============================================================================

/**
 * Sanitization options configuration
 */
export const sanitizationOptionsSchema = z.object({
  // HTML sanitization
  allowHtml: z.boolean().default(false),
  allowedTags: z.array(z.string()).default([]),
  allowedAttributes: z.record(z.array(z.string())).default({}),
  removeScripts: z.boolean().default(true),
  removeEvents: z.boolean().default(true),
  
  // String sanitization
  trimWhitespace: z.boolean().default(true),
  normalizeWhitespace: z.boolean().default(true),
  removeControlChars: z.boolean().default(true),
  maxLength: z.number().int().min(1).optional(),
  
  // Character encoding
  encoding: z.enum(['utf8', 'ascii', 'latin1']).default('utf8'),
  normalizeUnicode: z.boolean().default(true),
  removeInvisibleChars: z.boolean().default(true),
  
  // SQL injection prevention
  escapeSqlChars: z.boolean().default(true),
  removeComments: z.boolean().default(true),
  preventUnions: z.boolean().default(true),
  
  // XSS prevention
  encodeHtmlEntities: z.boolean().default(true),
  removeJavaScript: z.boolean().default(true),
  removeDataUrls: z.boolean().default(true),
  
  // File path sanitization
  preventPathTraversal: z.boolean().default(true),
  allowedFileExtensions: z.array(z.string()).default([]),
  maxFilenameLength: z.number().int().min(1).max(255).default(100),
});

// =============================================================================
// TEXT INPUT SANITIZATION
// =============================================================================

/**
 * Basic text input sanitization
 */
export const sanitizedTextSchema = z.string()
  .transform((val) => {
    // Remove null bytes and control characters
    return val.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
  })
  .transform((val) => {
    // Normalize whitespace
    return val.replace(/\s+/g, ' ').trim();
  })
  .refine((val) => {
    // Check for potential XSS patterns
    const xssPatterns = [
      /<script/i,
      /javascript:/i,
      /on\w+\s*=/i,
      /<iframe/i,
      /<object/i,
      /<embed/i,
      /vbscript:/i,
      /data:text\/html/i,
    ];
    return !xssPatterns.some(pattern => pattern.test(val));
  }, 'Input contains potentially malicious content')
  .refine((val) => {
    // Check for SQL injection patterns
    const sqlPatterns = [
      /(\bUNION\b.*\bSELECT\b)/i,
      /(\bSELECT\b.*\bFROM\b)/i,
      /(\bINSERT\b.*\bINTO\b)/i,
      /(\bUPDATE\b.*\bSET\b)/i,
      /(\bDELETE\b.*\bFROM\b)/i,
      /(\bDROP\b.*\bTABLE\b)/i,
      /(\bALTER\b.*\bTABLE\b)/i,
      /(\bCREATE\b.*\bTABLE\b)/i,
      /(\bEXEC\b.*\()/i,
      /(\bEVAL\b.*\()/i,
    ];
    return !sqlPatterns.some(pattern => pattern.test(val));
  }, 'Input contains potentially malicious SQL content');

/**
 * Rich text sanitization (for content that may contain HTML)
 */
export const sanitizedRichTextSchema = z.string()
  .transform((val) => {
    // Remove dangerous HTML tags and attributes
    return val
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '')
      .replace(/<object\b[^<]*(?:(?!<\/object>)<[^<]*)*<\/object>/gi, '')
      .replace(/<embed\b[^<]*(?:(?!<\/embed>)<[^<]*)*<\/embed>/gi, '')
      .replace(/on\w+\s*=\s*["'][^"']*["']/gi, '')
      .replace(/javascript:/gi, '')
      .replace(/vbscript:/gi, '')
      .replace(/data:text\/html/gi, '');
  })
  .refine((val) => {
    // Ensure no dangerous content remains
    const dangerousPatterns = [
      /<script/i,
      /javascript:/i,
      /vbscript:/i,
      /<iframe/i,
      /<object/i,
      /<embed/i,
      /on\w+\s*=/i,
    ];
    return !dangerousPatterns.some(pattern => pattern.test(val));
  }, 'Rich text contains dangerous content');

/**
 * URL sanitization
 */
export const sanitizedUrlSchema = z.string()
  .url('Invalid URL format')
  .refine((val) => {
    // Only allow safe protocols
    const allowedProtocols = ['http:', 'https:', 'mailto:', 'tel:'];
    try {
      const url = new URL(val);
      return allowedProtocols.includes(url.protocol);
    } catch {
      return false;
    }
  }, 'URL protocol not allowed')
  .refine((val) => {
    // Prevent JavaScript URLs
    return !val.toLowerCase().includes('javascript:');
  }, 'JavaScript URLs not allowed')
  .refine((val) => {
    // Prevent data URLs (potential XSS vector)
    return !val.toLowerCase().startsWith('data:');
  }, 'Data URLs not allowed');

/**
 * Email sanitization
 */
export const sanitizedEmailSchema = z.string()
  .email('Invalid email format')
  .toLowerCase()
  .transform((val) => {
    // Remove any HTML/special characters that shouldn't be in emails
    return val.replace(/[<>'"&]/g, '');
  })
  .refine((val) => {
    // Additional email validation
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    return emailRegex.test(val);
  }, 'Invalid email format after sanitization');

// =============================================================================
// FILE INPUT SANITIZATION
// =============================================================================

/**
 * Filename sanitization
 */
export const sanitizedFilenameSchema = z.string()
  .transform((val) => {
    // Remove path traversal attempts
    return val
      .replace(/[\/\\]/g, '') // Remove slashes
      .replace(/\.\./g, '') // Remove parent directory references
      .replace(/[<>:"|?*]/g, '') // Remove Windows forbidden characters
      .replace(/[\x00-\x1F\x7F]/g, '') // Remove control characters
      .trim();
  })
  .refine((val) => val.length > 0, 'Filename cannot be empty after sanitization')
  .refine((val) => val.length <= 255, 'Filename too long')
  .refine((val) => {
    // Prevent reserved names
    const reservedNames = [
      'CON', 'PRN', 'AUX', 'NUL',
      'COM1', 'COM2', 'COM3', 'COM4', 'COM5', 'COM6', 'COM7', 'COM8', 'COM9',
      'LPT1', 'LPT2', 'LPT3', 'LPT4', 'LPT5', 'LPT6', 'LPT7', 'LPT8', 'LPT9'
    ];
    return !reservedNames.includes(val.toUpperCase());
  }, 'Reserved filename not allowed');

/**
 * File extension validation
 */
export const allowedFileExtensionSchema = z.string()
  .toLowerCase()
  .refine((val) => {
    const allowedExtensions = [
      // Images
      '.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg',
      // Documents
      '.pdf', '.doc', '.docx', '.txt', '.rtf',
      // Data
      '.csv', '.json', '.xml',
      // Archives
      '.zip', '.tar', '.gz'
    ];
    return allowedExtensions.includes(val);
  }, 'File extension not allowed');

/**
 * MIME type validation
 */
export const allowedMimeTypeSchema = z.string()
  .refine((val) => {
    const allowedMimeTypes = [
      // Images
      'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml',
      // Documents
      'application/pdf', 'text/plain', 'text/csv',
      'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      // Data formats
      'application/json', 'application/xml', 'text/xml',
      // Archives
      'application/zip', 'application/x-tar', 'application/gzip'
    ];
    return allowedMimeTypes.includes(val);
  }, 'MIME type not allowed');

// =============================================================================
// DATABASE INPUT SANITIZATION
// =============================================================================

/**
 * SQL-safe string validation
 */
export const sqlSafeStringSchema = z.string()
  .transform((val) => {
    // Escape single quotes for SQL safety
    return val.replace(/'/g, "''");
  })
  .refine((val) => {
    // Check for SQL injection attempts
    const sqlKeywords = [
      /\bSELECT\b/i, /\bFROM\b/i, /\bWHERE\b/i, /\bUNION\b/i,
      /\bINSERT\b/i, /\bUPDATE\b/i, /\bDELETE\b/i, /\bDROP\b/i,
      /\bALTER\b/i, /\bCREATE\b/i, /\bEXEC\b/i, /\bEVAL\b/i
    ];
    return !sqlKeywords.some(keyword => keyword.test(val));
  }, 'Input contains SQL keywords');

/**
 * Column name validation (for dynamic queries)
 */
export const sqlColumnNameSchema = z.string()
  .regex(/^[a-zA-Z_][a-zA-Z0-9_]*$/, 'Invalid column name format')
  .max(64, 'Column name too long')
  .refine((val) => {
    // Prevent SQL reserved words
    const reservedWords = [
      'SELECT', 'FROM', 'WHERE', 'INSERT', 'UPDATE', 'DELETE',
      'DROP', 'ALTER', 'CREATE', 'TABLE', 'INDEX', 'VIEW',
      'GRANT', 'REVOKE', 'UNION', 'ORDER', 'GROUP', 'HAVING'
    ];
    return !reservedWords.includes(val.toUpperCase());
  }, 'Column name is a reserved SQL word');

/**
 * Table name validation
 */
export const sqlTableNameSchema = z.string()
  .regex(/^[a-zA-Z_][a-zA-Z0-9_]*$/, 'Invalid table name format')
  .max(64, 'Table name too long')
  .refine((val) => {
    // Must start with letter or underscore
    return /^[a-zA-Z_]/.test(val);
  }, 'Table name must start with letter or underscore');

// =============================================================================
// SEARCH INPUT SANITIZATION
// =============================================================================

/**
 * Search query sanitization
 */
export const sanitizedSearchQuerySchema = z.string()
  .max(500, 'Search query too long')
  .transform((val) => {
    // Remove potentially dangerous characters for search
    return val
      .replace(/[<>'"&]/g, '') // Remove HTML characters
      .replace(/[;(){}[\]]/g, '') // Remove special characters that could break parsing
      .replace(/\s+/g, ' ') // Normalize whitespace
      .trim();
  })
  .refine((val) => {
    // Prevent search injection attempts
    const dangerousPatterns = [
      /\b(AND|OR)\s+1\s*=\s*1\b/i,
      /\b(AND|OR)\s+\d+\s*=\s*\d+\b/i,
      /\bunion\s+select\b/i,
      /\bdrop\s+table\b/i
    ];
    return !dangerousPatterns.some(pattern => pattern.test(val));
  }, 'Search query contains potentially malicious content');

// =============================================================================
// JSON INPUT SANITIZATION
// =============================================================================

/**
 * Safe JSON schema validation
 */
export const safeJsonSchema = z.record(z.unknown())
  .refine((val) => {
    // Check for prototype pollution attempts
    const dangerousKeys = ['__proto__', 'constructor', 'prototype'];
    
    function checkObject(obj: any): boolean {
      if (typeof obj !== 'object' || obj === null) return true;
      
      for (const key in obj) {
        if (dangerousKeys.includes(key)) return false;
        if (typeof obj[key] === 'object' && !checkObject(obj[key])) return false;
      }
      return true;
    }
    
    return checkObject(val);
  }, 'JSON contains potentially dangerous keys')
  .refine((val) => {
    // Check JSON size to prevent DoS
    const jsonString = JSON.stringify(val);
    return jsonString.length <= 100000; // 100KB limit
  }, 'JSON payload too large');

// =============================================================================
// VALIDATION RESULT SCHEMAS
// =============================================================================

/**
 * Sanitization result
 */
export const sanitizationResultSchema = z.object({
  original: z.string(),
  sanitized: z.string(),
  isModified: z.boolean(),
  removedContent: z.array(z.string()).default([]),
  warnings: z.array(z.string()).default([]),
  riskLevel: z.enum(['low', 'medium', 'high', 'critical']),
  sanitizationMethod: z.string(),
  timestamp: z.date(),
});

/**
 * Batch sanitization result
 */
export const batchSanitizationResultSchema = z.object({
  totalProcessed: z.number().int().min(0),
  successCount: z.number().int().min(0),
  errorCount: z.number().int().min(0),
  modifiedCount: z.number().int().min(0),
  results: z.array(sanitizationResultSchema),
  summary: z.object({
    highRiskCount: z.number().int().min(0),
    criticalRiskCount: z.number().int().min(0),
    commonPatterns: z.array(z.string()).default([]),
  }),
  processingTime: z.number().min(0), // milliseconds
});

// =============================================================================
// TYPE EXPORTS
// =============================================================================

export type SanitizationOptions = z.infer<typeof sanitizationOptionsSchema>;
export type SanitizedText = z.infer<typeof sanitizedTextSchema>;
export type SanitizedRichText = z.infer<typeof sanitizedRichTextSchema>;
export type SanitizedUrl = z.infer<typeof sanitizedUrlSchema>;
export type SanitizedEmail = z.infer<typeof sanitizedEmailSchema>;
export type SanitizedFilename = z.infer<typeof sanitizedFilenameSchema>;
export type AllowedFileExtension = z.infer<typeof allowedFileExtensionSchema>;
export type AllowedMimeType = z.infer<typeof allowedMimeTypeSchema>;
export type SqlSafeString = z.infer<typeof sqlSafeStringSchema>;
export type SqlColumnName = z.infer<typeof sqlColumnNameSchema>;
export type SqlTableName = z.infer<typeof sqlTableNameSchema>;
export type SanitizedSearchQuery = z.infer<typeof sanitizedSearchQuerySchema>;
export type SafeJson = z.infer<typeof safeJsonSchema>;
export type SanitizationResult = z.infer<typeof sanitizationResultSchema>;
export type BatchSanitizationResult = z.infer<typeof batchSanitizationResultSchema>;