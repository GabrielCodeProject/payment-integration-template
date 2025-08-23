/**
 * Prisma Client Singleton for Next.js
 * Security-hardened database connection with PgBouncer integration
 *
 * This file implements the recommended singleton pattern for Prisma Client
 * in Next.js applications with enhanced security features:
 * - SSL/TLS encryption for all connections
 * - Connection pooling through PgBouncer
 * - Security monitoring and audit logging
 * - PCI DSS compliant configuration
 */

import { PrismaClient } from "@prisma/client";

declare global {
  var __prisma: PrismaClient | undefined;
}

/**
 * Security-enhanced Prisma Client configuration
 * Optimized for payment processing and PCI DSS compliance
 */
const createPrismaClient = () => {
  const isProduction = process.env.NODE_ENV === "production";
  
  // Configure connection string with SSL parameters
  const getDatabaseUrl = () => {
    const baseUrl = process.env.DATABASE_URL;
    if (!baseUrl) {
      throw new Error("DATABASE_URL environment variable is required");
    }
    
    // Add SSL parameters for secure connections
    const url = new URL(baseUrl);
    
    // Force SSL in production, allow in development
    if (isProduction) {
      url.searchParams.set("sslmode", "require");
      url.searchParams.set("sslcert", process.env.PGSSLCERT || "");
      url.searchParams.set("sslkey", process.env.PGSSLKEY || "");
      url.searchParams.set("sslrootcert", process.env.PGSSLROOTCERT || "");
    } else {
      // Development with PgBouncer still uses SSL if configured
      url.searchParams.set("sslmode", "prefer");
    }
    
    // Connection pooling and timeout settings
    url.searchParams.set("connection_limit", "20");
    url.searchParams.set("pool_timeout", "30");
    url.searchParams.set("connect_timeout", "10");
    
    return url.toString();
  };

  return new PrismaClient({
    log: isProduction 
      ? [
          { emit: "event", level: "error" },
          { emit: "event", level: "warn" },
        ]
      : [
          { emit: "event", level: "query" },
          { emit: "event", level: "error" },
          { emit: "event", level: "warn" },
        ],
    datasources: {
      db: {
        url: getDatabaseUrl(),
      },
    },
    errorFormat: isProduction ? "minimal" : "pretty",
  });
};

/**
 * Prisma Client instance with security monitoring
 */
export const db = globalThis.__prisma ?? createPrismaClient();

// Security event logging for production
if (process.env.NODE_ENV === "production") {
  // Log database errors for security monitoring
  db.$on("error", (e) => {
    // console.error("[DB_ERROR]", {
      timestamp: new Date().toISOString(),
      target: e.target,
      message: e.message,
      // Don't log sensitive query details in production
    });
  });

  // Log slow queries for performance monitoring
  db.$on("warn", (e) => {
    // console.warn("[DB_WARN]", {
      timestamp: new Date().toISOString(),
      target: e.target,
      message: e.message,
    });
  });
} else {
  // Development logging with query details
  db.$on("query", (e) => {
    // console.log("[DB_QUERY]", {
      query: e.query,
      params: e.params,
      duration: `${e.duration}ms`,
      target: e.target,
    });
  });
}

// Ensure single instance in development
if (process.env.NODE_ENV !== "production") {
  globalThis.__prisma = db;
}

// Enhanced graceful shutdown handling
const gracefulShutdown = async () => {
  // console.log("[DB] Initiating graceful shutdown...");
  try {
    await db.$disconnect();
    // console.log("[DB] Database connections closed successfully");
  } catch (_error) {
    // console.error("[DB] Error during shutdown:", error);
  }
};

// Register shutdown handlers
if (process.env.NODE_ENV === "production") {
  process.on("beforeExit", gracefulShutdown);
  process.on("SIGTERM", gracefulShutdown);
  process.on("SIGINT", gracefulShutdown);
}

/**
 * Security-enhanced database transaction wrapper
 * Provides automatic retry logic and security event logging
 */
export const secureTransaction = async <T>(
  fn: (prisma: PrismaClient) => Promise<T>,
  maxRetries: number = 3
): Promise<T> => {
  let lastError: Error | null = null;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await db.$transaction(fn, {
        timeout: 30000, // 30 second timeout for payment operations
        isolationLevel: "Serializable", // Highest isolation level for financial data
      });
    } catch (_error) {
      lastError = error as Error;
      
      // Log security-relevant transaction failures
      if (process.env.NODE_ENV === "production") {
        // console.error(`[DB_TRANSACTION_FAILED] Attempt ${attempt}/${maxRetries}:`, {
          timestamp: new Date().toISOString(),
          error: error instanceof Error ? _error.message : "Unknown error",
          attempt,
        });
      }
      
      // Don't retry certain types of errors
      if (_error instanceof Error) {
        const message = _error.message.toLowerCase();
        if (
          message.includes("constraint") ||
          message.includes("unique") ||
          message.includes("foreign key") ||
          message.includes("authorization")
        ) {
          break; // Don't retry constraint violations or auth errors
        }
      }
      
      if (attempt < maxRetries) {
        // Exponential backoff with jitter
        const delay = Math.min(1000 * Math.pow(2, attempt - 1) + Math.random() * 1000, 10000);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  
  throw lastError || new Error("Transaction failed after all retries");
};

/**
 * Read-only database connection for analytics and reporting
 * Uses separate read-only user credentials for enhanced security
 */
export const createReadOnlyClient = () => {
  if (!process.env.DATABASE_READONLY_URL) {
    // console.warn("[DB] DATABASE_READONLY_URL not configured, falling back to main connection");
    return db;
  }
  
  return new PrismaClient({
    datasources: {
      db: {
        url: process.env.DATABASE_READONLY_URL,
      },
    },
    log: process.env.NODE_ENV === "production" ? ["error"] : ["error", "warn"],
  });
};

export default db;
