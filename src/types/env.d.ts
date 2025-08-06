/**
 * TypeScript Environment Variables Declaration
 * 
 * This file provides TypeScript intellisense for environment variables
 * in the Payment Integration Template.
 */

declare namespace NodeJS {
  interface ProcessEnv {
    // =============================================================================
    // SYSTEM ENVIRONMENT
    // =============================================================================
    readonly NODE_ENV: 'development' | 'production' | 'test';
    
    // =============================================================================
    // DATABASE
    // =============================================================================
    readonly DATABASE_URL: string;
    readonly DIRECT_URL?: string;
    
    // =============================================================================
    // AUTHENTICATION (BetterAuth)
    // =============================================================================
    readonly BETTER_AUTH_SECRET: string;
    readonly BETTER_AUTH_URL: string;
    readonly BETTER_AUTH_TRUSTED_ORIGINS?: string;
    
    // =============================================================================
    // STRIPE PAYMENT INTEGRATION
    // =============================================================================
    readonly STRIPE_SECRET_KEY: string;
    readonly NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: string;
    readonly STRIPE_WEBHOOK_SECRET?: string;
    
    // =============================================================================
    // EMAIL SERVICE (RESEND)
    // =============================================================================
    readonly RESEND_API_KEY?: string;
    readonly RESEND_FROM_EMAIL?: string;
    
    // =============================================================================
    // APPLICATION CONFIGURATION
    // =============================================================================
    readonly NEXT_PUBLIC_APP_URL: string;
    readonly NEXT_PUBLIC_APP_NAME?: string;
    
    // =============================================================================
    // SECURITY & RATE LIMITING
    // =============================================================================
    readonly RATE_LIMIT_MAX_REQUESTS?: string;
    readonly RATE_LIMIT_WINDOW_MS?: string;
    readonly CSRF_SECRET?: string;
    
    // =============================================================================
    // FEATURE FLAGS
    // =============================================================================
    readonly NEXT_PUBLIC_DEBUG_MODE?: 'true' | 'false';
    readonly NEXT_PUBLIC_STRIPE_TEST_MODE?: 'true' | 'false';
    
    // =============================================================================
    // ANALYTICS & MONITORING (OPTIONAL)
    // =============================================================================
    readonly NEXT_PUBLIC_GOOGLE_ANALYTICS_ID?: string;
    readonly NEXT_PUBLIC_POSTHOG_KEY?: string;
    readonly SENTRY_DSN?: string;
    readonly NEXT_PUBLIC_SENTRY_DSN?: string;
    
    // =============================================================================
    // DEPLOYMENT & MAINTENANCE
    // =============================================================================
    readonly MAINTENANCE_MODE?: 'true' | 'false';
    readonly CUSTOM_ENV_CHECK?: string;
    
    // =============================================================================
    // NEXT.JS INTERNAL VARIABLES
    // =============================================================================
    readonly NEXTAUTH_URL?: string;
    readonly NEXTAUTH_SECRET?: string;
    readonly VERCEL?: string;
    readonly VERCEL_ENV?: 'development' | 'preview' | 'production';
    readonly VERCEL_URL?: string;
    readonly VERCEL_REGION?: string;
  }
}

// =============================================================================
// CLIENT-SIDE ENVIRONMENT VARIABLES TYPE
// =============================================================================

/**
 * Type for environment variables available on the client-side
 * These are all variables prefixed with NEXT_PUBLIC_
 */
export interface ClientEnvironment {
  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: string;
  NEXT_PUBLIC_APP_URL: string;
  NEXT_PUBLIC_APP_NAME: string;
  NEXT_PUBLIC_DEBUG_MODE: 'true' | 'false';
  NEXT_PUBLIC_STRIPE_TEST_MODE: 'true' | 'false';
  NEXT_PUBLIC_GOOGLE_ANALYTICS_ID?: string;
  NEXT_PUBLIC_POSTHOG_KEY?: string;
  NEXT_PUBLIC_SENTRY_DSN?: string;
}

/**
 * Type for environment variables available on the server-side only
 */
export interface ServerEnvironment {
  DATABASE_URL: string;
  DIRECT_URL?: string;
  BETTER_AUTH_SECRET: string;
  BETTER_AUTH_URL: string;
  BETTER_AUTH_TRUSTED_ORIGINS: string;
  STRIPE_SECRET_KEY: string;
  STRIPE_WEBHOOK_SECRET?: string;
  RESEND_API_KEY?: string;
  RESEND_FROM_EMAIL?: string;
  RATE_LIMIT_MAX_REQUESTS: number;
  RATE_LIMIT_WINDOW_MS: number;
  CSRF_SECRET?: string;
  NODE_ENV: 'development' | 'production' | 'test';
}

// =============================================================================
// UTILITY TYPES
// =============================================================================

/**
 * Type for environment-specific configuration
 */
export type EnvironmentConfig = {
  isDevelopment: boolean;
  isProduction: boolean;
  isTest: boolean;
  isStripeTestMode: boolean;
  isDebugMode: boolean;
};

/**
 * Type for Stripe configuration based on environment
 */
export type StripeConfig = {
  publishableKey: string;
  secretKey: string;
  webhookSecret?: string;
  isTestMode: boolean;
};

/**
 * Type for database configuration
 */
export type DatabaseConfig = {
  url: string;
  directUrl?: string;
  provider: 'postgresql' | 'sqlite' | 'mysql';
};

export {};