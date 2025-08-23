/**
 * Base Validation Schemas
 * 
 * This module exports all base validation schemas corresponding to database models.
 * These schemas provide foundational validation for all database operations
 * and ensure data integrity across the application.
 */

// Re-export all base schemas
export * from './user';
export * from './product';
export * from './category';
export * from './tag';
export * from './order';
export * from './subscription';
export * from './payment-method';
export * from './discount-code';
export * from './audit-log';
export * from './auth';
export * from './common';

// Re-export schema types for convenience
export type * from './user';
export type * from './product';
export type * from './category';
export type * from './tag';
export type * from './order';
export type * from './subscription';
export type * from './payment-method';
export type * from './discount-code';
export type * from './audit-log';
export type * from './auth';
export type * from './common';