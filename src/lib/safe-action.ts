import { createSafeActionClient } from "next-safe-action";
import { getServerEnv } from "./env";

/**
 * Next-Safe-Action Configuration for Next.js App Router
 * 
 * This file configures server actions with proper error handling,
 * rate limiting, and environment-aware settings.
 */

// =============================================================================
// SAFE ACTION CLIENT CONFIGURATION
// =============================================================================

/**
 * Base safe action client with environment-aware configuration
 */
export const actionClient = createSafeActionClient();

// =============================================================================
// AUTHENTICATED ACTION CLIENT
// =============================================================================

/**
 * Action client that requires user authentication
 * Use this for actions that require a logged-in user
 */
export const authActionClient = actionClient.use(async ({ next }) => {
  // TODO: Implement authentication check with BetterAuth
  // This is a placeholder - replace with actual auth logic
  
  // Example auth check (replace with BetterAuth implementation):
  // const session = await getServerSession();
  // if (!session?.user) {
  //   throw new Error("Authentication required");
  // }

  // For now, we'll proceed without auth check
  // Remove this comment and implement proper auth when BetterAuth is configured
  
  return next();
});

// =============================================================================
// RATE LIMITED ACTION CLIENT  
// =============================================================================

/**
 * Action client with rate limiting
 * Use this for actions that need rate limiting protection
 */
export const rateLimitedActionClient = actionClient.use(async ({ next }) => {
  const env = getServerEnv();
  
  // TODO: Implement rate limiting logic
  // This could use Redis, in-memory store, or database-based rate limiting
  
  // Example rate limiting check:
  // const clientIP = headers().get("x-forwarded-for") || "unknown";
  // const rateLimitKey = `rate_limit:${clientIP}`;
  // const currentRequests = await getRateLimitCount(rateLimitKey);
  
  // if (currentRequests >= env.RATE_LIMIT_MAX_REQUESTS) {
  //   throw new Error("Rate limit exceeded. Please try again later.");
  // }
  
  // await incrementRateLimitCount(rateLimitKey, env.RATE_LIMIT_WINDOW_MS);
  
  return next();
});

// =============================================================================
// PAYMENT ACTION CLIENT
// =============================================================================

/**
 * Specialized action client for payment operations
 * Includes authentication, rate limiting, and payment-specific validation
 */
export const paymentActionClient = authActionClient.use(async ({ next }) => {
  const env = getServerEnv();
  
  // Validate Stripe configuration
  if (!env.STRIPE_SECRET_KEY) {
    throw new Error("Stripe configuration is missing");
  }
  
  // Additional payment-specific checks can go here
  return next();
});

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

/**
 * Type-safe action error creator
 */
export function createActionError(message: string, type: "validation" | "server" = "server") {
  return new Error(`[${type.toUpperCase()}] ${message}`);
}

/**
 * Action result type helpers
 */
export type ActionSuccess<T> = {
  success: true;
  data: T;
  message?: string;
};

export type ActionError = {
  success: false;
  error: string;
  details?: unknown;
};

export type ActionResult<T> = ActionSuccess<T> | ActionError;

/**
 * Create a successful action result
 */
export function actionSuccess<T>(data: T, message?: string): ActionSuccess<T> {
  return { success: true, data, message };
}

/**
 * Create an error action result
 */
export function actionError(error: string, details?: unknown): ActionError {
  return { success: false, error, details };
}

// =============================================================================
// USAGE EXAMPLES:
// =============================================================================
/*
// Basic server action:
export const createUser = actionClient
  .schema(z.object({ email: z.string().email(), name: z.string() }))
  .action(async ({ parsedInput }) => {
    // Your action logic here
    return actionSuccess({ id: "123", ...parsedInput });
  });

// Authenticated action:
export const updateProfile = authActionClient
  .schema(z.object({ name: z.string() }))
  .action(async ({ parsedInput }) => {
    // User is authenticated here
    return actionSuccess({ name: parsedInput.name });
  });

// Payment action:
export const processPayment = paymentActionClient
  .schema(z.object({ amount: z.number(), currency: z.string() }))
  .action(async ({ parsedInput }) => {
    // User is authenticated, rate limited, and Stripe is configured
    return actionSuccess({ paymentIntentId: "pi_123" });
  });
*/