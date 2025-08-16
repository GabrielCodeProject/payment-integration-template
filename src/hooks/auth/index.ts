/**
 * Auth Hooks Exports
 * NextJS Stripe Payment Template
 * 
 * Centralized exports for all authentication-related hooks.
 */

// Session management hooks
export { useSessions, useSessionOperations } from './useSessions';

// Re-export types for convenience
export type {
  UseSessionsReturn,
  UseSessionOperationsReturn,
} from '@/types/auth/sessions';