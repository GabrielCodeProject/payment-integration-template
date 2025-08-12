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
import { PrismaClient } from "@prisma/client";

// Initialize Prisma client for auth
const prisma = new PrismaClient();

export const auth = betterAuth({
  // Database configuration
  database: prismaAdapter(prisma, {
    provider: "postgresql",
  }),

  // Security configuration
  secret: process.env.AUTH_SECRET || "fallback-secret-for-development",
  trustedOrigins: [
    process.env.NEXT_PUBLIC_APP_URL as string,
    "http://localhost:3000", // Development
  ],

  // Session configuration optimized for middleware
  session: {
    expiresIn: 60 * 60 * 24 * 7, // 7 days
    updateAge: 60 * 60 * 24, // 1 day
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

  // Advanced security settings
  advanced: {
    generateId: () => {
      // Use crypto for secure ID generation
      return crypto.randomUUID();
    },
    crossSubDomainCookies: {
      enabled: false, // Disable for security unless needed
    },
    disableCSRFCheck: false, // Keep CSRF protection enabled
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
  } catch (error) {
    // Don't log in production to avoid noise
    if (process.env.NODE_ENV === "development") {
      // eslint-disable-next-line no-console
      console.error("Failed to get server session:", error);
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
