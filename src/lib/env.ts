import { z } from "zod";

/**
 * Environment Variables Configuration for Next.js App Router
 *
 * This file provides type-safe access to environment variables with validation.
 * It separates client-side and server-side variables following Next.js conventions.
 */

// =============================================================================
// SERVER-SIDE ENVIRONMENT SCHEMA
// =============================================================================
const serverEnvSchema = z.object({
  // Database
  DATABASE_URL: z.string().url("Invalid database URL"),
  DIRECT_URL: z.string().url("Invalid direct database URL").optional(),

  // Authentication
  BETTER_AUTH_SECRET: z
    .string()
    .min(32, "Better Auth secret must be at least 32 characters"),
  BETTER_AUTH_URL: z.string().url("Invalid auth URL").optional(),
  BETTER_AUTH_TRUSTED_ORIGINS: z
    .string()
    .default("http://localhost:3000")
    .optional(),

  // Stripe Server-side
  STRIPE_SECRET_KEY: z.string().startsWith("sk_", "Invalid Stripe secret key"),
  STRIPE_WEBHOOK_SECRET: z
    .string()
    .startsWith("whsec_", "Invalid webhook secret")
    .optional(),

  // Email (required for email verification)
  RESEND_API_KEY: z.string().startsWith("re_", "Invalid Resend API key"),
  FROM_EMAIL: z
    .string()
    .email("Invalid from email")
    .default("noreply@yourapp.com"),

  // Security
  RATE_LIMIT_MAX_REQUESTS: z.coerce.number().default(100),
  RATE_LIMIT_WINDOW_MS: z.coerce.number().default(900000), // 15 minutes
  CSRF_SECRET: z
    .string()
    .min(32, "CSRF secret must be at least 32 characters")
    .optional(),

  // Node environment
  NODE_ENV: z
    .enum(["development", "production", "test"])
    .default("development"),
});

// =============================================================================
// CLIENT-SIDE ENVIRONMENT SCHEMA
// =============================================================================
const clientEnvSchema = z.object({
  // Stripe Client-side
  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: z
    .string()
    .startsWith("pk_", "Invalid Stripe publishable key"),

  // App Configuration
  NEXT_PUBLIC_APP_URL: z.string().url("Invalid app URL"),
  NEXT_PUBLIC_APP_NAME: z.string().default("Payment Integration Template"),

  // Feature Flags
  NEXT_PUBLIC_DEBUG_MODE: z.enum(["true", "false"]).default("false"),
  NEXT_PUBLIC_STRIPE_TEST_MODE: z.enum(["true", "false"]).default("true"),

  // Optional Analytics
  NEXT_PUBLIC_GOOGLE_ANALYTICS_ID: z
    .string()
    .startsWith("G-", "Invalid Google Analytics ID")
    .optional(),
  NEXT_PUBLIC_POSTHOG_KEY: z
    .string()
    .startsWith("phc_", "Invalid PostHog key")
    .optional(),
  NEXT_PUBLIC_SENTRY_DSN: z.string().url("Invalid Sentry DSN").optional(),
});

// =============================================================================
// ENVIRONMENT VALIDATION
// =============================================================================

/**
 * Validates and returns server-side environment variables
 * Only call this in server-side code (API routes, Server Components, middleware)
 */
export function getServerEnv() {
  if (typeof window !== "undefined") {
    throw new Error("getServerEnv() can only be called on the server side");
  }

  try {
    return serverEnvSchema.parse(process.env);
  } catch (_error) {
    console.error("❌ Invalid server environment variables:", _error);
    throw new Error("Server environment validation failed");
  }
}

/**
 * Validates and returns client-side environment variables
 * Can be called on both server and client side
 */
export function getClientEnv() {
  try {
    return clientEnvSchema.parse({
      NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY:
        process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY,
      NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
      NEXT_PUBLIC_APP_NAME: process.env.NEXT_PUBLIC_APP_NAME,
      NEXT_PUBLIC_DEBUG_MODE: process.env.NEXT_PUBLIC_DEBUG_MODE,
      NEXT_PUBLIC_STRIPE_TEST_MODE: process.env.NEXT_PUBLIC_STRIPE_TEST_MODE,
      NEXT_PUBLIC_GOOGLE_ANALYTICS_ID:
        process.env.NEXT_PUBLIC_GOOGLE_ANALYTICS_ID,
      NEXT_PUBLIC_POSTHOG_KEY: process.env.NEXT_PUBLIC_POSTHOG_KEY,
      NEXT_PUBLIC_SENTRY_DSN: process.env.NEXT_PUBLIC_SENTRY_DSN,
    });
  } catch (_error) {
    console.error("❌ Invalid client environment variables:", _error);
    throw new Error("Client environment validation failed");
  }
}

// =============================================================================
// TYPE EXPORTS
// =============================================================================
export type ServerEnv = z.infer<typeof serverEnvSchema>;
export type ClientEnv = z.infer<typeof clientEnvSchema>;

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Checks if the app is running in development mode
 */
export const isDevelopment = () => process.env.NODE_ENV === "development";

/**
 * Checks if the app is running in production mode
 */
export const isProduction = () => process.env.NODE_ENV === "production";

/**
 * Checks if Stripe is in test mode
 */
export const isStripeTestMode = () =>
  getClientEnv().NEXT_PUBLIC_STRIPE_TEST_MODE === "true";

/**
 * Checks if debug mode is enabled
 */
export const isDebugMode = () =>
  getClientEnv().NEXT_PUBLIC_DEBUG_MODE === "true";

// =============================================================================
// USAGE EXAMPLES:
// =============================================================================
/*
// In Server Components or API routes:
const serverEnv = getServerEnv();
const stripeSecret = serverEnv.STRIPE_SECRET_KEY;

// In Client Components:
const clientEnv = getClientEnv();
const stripePublishableKey = clientEnv.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;

// Feature flags:
if (isDebugMode()) {
  console.log("Debug mode is enabled");
}

if (isStripeTestMode()) {
   console.log("Using Stripe test mode");
}
*/
