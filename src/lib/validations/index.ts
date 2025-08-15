/**
 * Comprehensive Zod Validation Schemas
 * 
 * This is the main entry point for all validation schemas in the payment integration template.
 * It provides a complete, type-safe validation system for:
 * - Database models and operations
 * - Server Actions with next-safe-action integration
 * - API endpoints and responses
 * - Form validation for frontend
 * - PCI-compliant payment data validation
 * - Security and audit requirements
 * - Business logic and cross-field validation
 * - Error handling and standardized responses
 * 
 * All schemas are designed with security, performance, and developer experience in mind.
 */

// =============================================================================
// BASE VALIDATION SCHEMAS
// =============================================================================

// Core database model validation schemas
export * from './base';

// =============================================================================
// SERVER ACTIONS VALIDATION
// =============================================================================

// Next.js Server Actions with next-safe-action integration
export * from './actions';

// =============================================================================
// API VALIDATION SCHEMAS
// =============================================================================

// API endpoint request/response validation
export * from './api';

// =============================================================================
// FORM VALIDATION SCHEMAS  
// =============================================================================

// Frontend form validation schemas
export * from './forms';

// =============================================================================
// SECURITY VALIDATION SCHEMAS
// =============================================================================

// PCI compliance, fraud detection, rate limiting, and security
export * from './security';

// =============================================================================
// BUSINESS LOGIC VALIDATION
// =============================================================================

// Custom business rules and cross-field validation
export * from './business';

// =============================================================================
// ERROR HANDLING SCHEMAS
// =============================================================================

// Standardized error responses and type-safe error handling
export * from './errors';

// =============================================================================
// UTILITY VALIDATION FUNCTIONS
// =============================================================================

export { createValidationMiddleware } from './middleware';
export { validateWithSafeAction } from './safe-action-helpers';
export { createFormValidator } from './form-helpers';
export { validateApiRequest, validateApiResponse } from './api-helpers';

// =============================================================================
// TYPE UTILITIES
// =============================================================================

export type {
  ValidationResult,
  ValidationError,
  ValidationSuccess,
  SchemaInput,
  SchemaOutput,
} from './types';

// =============================================================================
// CONFIGURATION
// =============================================================================

export { validationConfig } from './config';

// =============================================================================
// DEVELOPMENT UTILITIES
// =============================================================================

export { 
  generateOpenAPISchema,
  generateTypeScriptTypes,
  validateSchemaCompatibility,
} from './dev-utils';