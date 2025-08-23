/**
 * BetterAuth Configuration for Payment Integration Template
 *
 * This file configures BetterAuth with:
 * - Database integration via Prisma
 * - Security settings optimized for payment processing
 * - Role-based access control
 * - Session management for NextJS middleware
 */

import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { db } from "@/lib/db";
import { sendEmailVerification, sendPasswordReset } from "@/lib/email";

export const auth = betterAuth({
  // Database configuration
  database: prismaAdapter(db, {
    provider: "postgresql",
  }),

  // Security configuration
  secret: process.env.BETTER_AUTH_SECRET || "fallback-secret-for-development",
  trustedOrigins: [
    process.env.NEXT_PUBLIC_APP_URL as string,
    "http://localhost:3000", // Development
    "http://localhost:3001", // Development (alternative port)
  ],

  // Session configuration optimized for middleware
  session: {
    expiresIn: 60 * 60 * 24 * 7, // 7 days
    updateAge: 60 * 60 * 24, // 1 day
    cookieCache: {
      enabled: true,
      maxAge: 5 * 60, // Cache duration in seconds (5 minutes)
    },
  },

  // User configuration with additional fields
  user: {
    additionalFields: {
      role: {
        type: "string",
        defaultValue: "CUSTOMER",
        input: false, // Don't allow direct input
        required: false,
      },
      stripeCustomerId: {
        type: "string",
        required: false,
      },
      isActive: {
        type: "boolean",
        defaultValue: true,
        required: false,
      },
      twoFactorEnabled: {
        type: "boolean",
        defaultValue: false,
        required: false,
      },
      lastLoginAt: {
        type: "date",
        required: false,
      },
    },
  },

  // Email and password configuration
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: true,
  },

  // Email verification configuration
  emailVerification: {
    sendVerificationEmail: async ({ user, url }: { user: { email: string }; url: string }) => {
      const result = await sendEmailVerification(user.email, url);
      if (!result.success && process.env.NODE_ENV === "development") {
        // eslint-disable-next-line no-console
        // console.log(`📧 Verification email would be sent to ${user.email} with URL: ${url}`);
      }
    },
  },

  // Password reset configuration
  forgetPassword: {
    sendResetPassword: async ({ user, url }: { user: { email: string }; url: string }) => {
      const result = await sendPasswordReset(user.email, url);
      if (!result.success && process.env.NODE_ENV === "development") {
        // eslint-disable-next-line no-console
        // console.log(`📧 Password reset email would be sent to ${user.email} with URL: ${url}`);
      }
    },
  },

  // Advanced security settings
  advanced: {
    database: {
      generateId: () => {
        // Use crypto for secure ID generation
        return crypto.randomUUID();
      },
    },
    crossSubDomainCookies: {
      enabled: false, // Disable for security unless needed
    },
    disableCSRFCheck: false, // Keep CSRF protection enabled
    // Enhanced cookie security configuration
    useSecureCookies: process.env.NODE_ENV === "production",
    defaultCookieAttributes: {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
    },
    cookies: {
      session_token: {
        attributes: {
          httpOnly: true,
          secure: process.env.NODE_ENV === "production",
          sameSite: "lax",
          path: "/",
        },
      },
    },
  },

  // Rate limiting configuration
  rateLimit: {
    window: 15 * 60, // 15 minutes
    max: 5, // max 5 attempts per window
  },

  // Plugin configuration
  plugins: [
    // Add plugins as needed for additional functionality
  ],
});

// Export types for TypeScript (simplified for compatibility)
export type Session = {
  session: {
    id: string;
    userId: string;
    expiresAt: Date;
  };
  user: {
    id: string;
    email: string;
    name: string;
    role?: string;
    isActive?: boolean;
    stripeCustomerId?: string;
  };
};

export type User = {
  id: string;
  email: string;
  name: string;
  role?: string;
  isActive?: boolean;
  stripeCustomerId?: string;
};

// Helper function to get session in server components
export async function getServerSession(): Promise<Session | null> {
  try {
    const session = await auth.api.getSession({
      headers: new Headers(),
    });
    return session as Session | null;
  } catch (_error) {
    // Don't log in production to avoid noise
    if (process.env.NODE_ENV === "development") {
      // eslint-disable-next-line no-console
      // console.error("Failed to get server session:", error);
    }
    return null;
  }
}

// Helper function to check if user has specific role
export function hasRole(user: User | null | undefined, role: string): boolean {
  if (!user) return false;
  return user.role === role;
}

// Helper function to check if user is admin
export function isAdmin(user: User | null | undefined): boolean {
  return hasRole(user, "ADMIN");
}

// Helper function to check if user is active
export function isActiveUser(user: User | null | undefined): boolean {
  if (!user) return false;
  return user.isActive === true;
}

// Helper function to validate user role
export function validateUserRole(role: string): boolean {
  return ["CUSTOMER", "ADMIN", "SUPPORT"].includes(role);
}

// Helper function to get Stripe customer ID
export function getStripeCustomerId(
  user: User | null | undefined
): string | null {
  if (!user) return null;
  return user.stripeCustomerId || null;
}
