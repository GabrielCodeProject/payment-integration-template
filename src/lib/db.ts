/**
 * Prisma Client Singleton for Next.js
 *
 * This file implements the recommended singleton pattern for Prisma Client
 * in Next.js applications to prevent multiple instances during development
 * hot reloads while ensuring proper connection management.
 */

import { PrismaClient } from "@prisma/client";

declare global {
  var __prisma: PrismaClient | undefined;
}

/**
 * Prisma Client instance with connection pooling configuration
 * optimized for Next.js applications and payment processing
 */
export const db =
  globalThis.__prisma ??
  new PrismaClient({
    log:
      process.env.NODE_ENV === "development"
        ? ["query", "error", "warn"]
        : ["error"],
    datasources: {
      db: {
        url: process.env.DATABASE_URL,
      },
    },
  });

// Ensure single instance in development
if (process.env.NODE_ENV !== "production") {
  globalThis.__prisma = db;
}

// Graceful shutdown handling for production
if (process.env.NODE_ENV === "production") {
  process.on("beforeExit", async () => {
    await db.$disconnect();
  });
}

export default db;
