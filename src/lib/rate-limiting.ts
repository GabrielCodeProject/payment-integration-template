/**
 * Enhanced Rate Limiting with Redis Support
 *
 * This module provides persistent rate limiting that survives server restarts
 * with Redis as primary storage and in-memory as fallback.
 */

import { NextRequest } from "next/server";

// Types for rate limiting
export interface RateLimitConfig {
  max: number;
  windowMs: number;
  skipSuccessfulRequests?: boolean;
  skipFailedRequests?: boolean;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetTime: number;
  totalHits: number;
}

// Redis client (lazy initialization)
let redisClient: any = null;

/**
 * Initialize Redis client for rate limiting
 * Falls back gracefully if Redis is not available
 */
async function getRedisClient() {
  if (redisClient) return redisClient;

  try {
    // Dynamic import to handle cases where Redis might not be available
    const redis = await import("redis").catch(() => null);
    if (!redis) return null;

    const client = redis.createClient({
      url: process.env.REDIS_URL || "redis://localhost:6379",
      socket: {
        connectTimeout: 5000,
        lazyConnect: true,
      },
    });

    await client.connect();
    redisClient = client;
    return client;
  } catch (_error) {
    if (process.env.NODE_ENV === "development") {
      console.warn(
        "Redis not available, using in-memory rate limiting:",
        _error
      );
    }
    return null;
  }
}

// In-memory fallback store
const memoryStore = new Map<string, { count: number; resetTime: number }>();

/**
 * Clean up expired entries from memory store
 */
function cleanupMemoryStore() {
  const now = Date.now();
  for (const [key, value] of memoryStore.entries()) {
    if (value.resetTime < now) {
      memoryStore.delete(key);
    }
  }
}

/**
 * Redis-based rate limiting with in-memory fallback
 */
async function redisRateLimit(
  key: string,
  config: RateLimitConfig
): Promise<RateLimitResult> {
  const redis = await getRedisClient();
  const now = Date.now();
  const resetTime = now + config.windowMs;

  if (redis) {
    try {
      // Use Redis pipeline for atomic operations
      const pipeline = redis.multi();
      const redisKey = `rate_limit:${key}`;

      // Get current count or initialize
      pipeline.get(redisKey);

      const results = await pipeline.exec();
      const currentCount = results ? parseInt(results[0] || "0") : 0;

      if (currentCount === 0) {
        // First request in window
        await redis.setEx(redisKey, Math.ceil(config.windowMs / 1000), "1");
        return {
          allowed: true,
          remaining: config.max - 1,
          resetTime,
          totalHits: 1,
        };
      } else if (currentCount >= config.max) {
        // Rate limit exceeded
        const ttl = await redis.ttl(redisKey);
        const actualResetTime = now + ttl * 1000;

        return {
          allowed: false,
          remaining: 0,
          resetTime: actualResetTime,
          totalHits: currentCount,
        };
      } else {
        // Increment counter
        const newCount = await redis.incr(redisKey);
        return {
          allowed: true,
          remaining: Math.max(0, config.max - newCount),
          resetTime,
          totalHits: newCount,
        };
      }
    } catch (_error) {
      if (process.env.NODE_ENV === "development") {
        console.warn(
          "Redis rate limiting failed, falling back to memory:",
          _error
        );
      }
      // Fall through to memory-based rate limiting
    }
  }

  // In-memory fallback
  cleanupMemoryStore();

  const current = memoryStore.get(key);

  if (!current || current.resetTime < now) {
    memoryStore.set(key, { count: 1, resetTime });
    return {
      allowed: true,
      remaining: config.max - 1,
      resetTime,
      totalHits: 1,
    };
  }

  if (current.count >= config.max) {
    return {
      allowed: false,
      remaining: 0,
      resetTime: current.resetTime,
      totalHits: current.count,
    };
  }

  current.count++;
  return {
    allowed: true,
    remaining: config.max - current.count,
    resetTime: current.resetTime,
    totalHits: current.count,
  };
}

/**
 * Get client IP address with proxy support
 * Enhanced to handle various proxy configurations
 */
export function getClientIP(request: NextRequest): string {
  // Check for Cloudflare
  const cfIP = request.headers.get("cf-connecting-ip");
  if (cfIP) return cfIP;

  // Check for forwarded headers
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    // Take the first IP in the chain (client IP)
    const ips = forwarded.split(",").map((ip) => ip.trim());
    return ips[0] || "unknown";
  }

  // Check for real IP header
  const realIP = request.headers.get("x-real-ip");
  if (realIP) return realIP;

  // Fallback
  return request.ip || "unknown";
}

/**
 * Enhanced rate limiting with multiple strategies
 */
export async function checkRateLimit(
  request: NextRequest,
  config: RateLimitConfig,
  strategy: "ip" | "user" | "combined" = "ip"
): Promise<RateLimitResult> {
  const clientIP = getClientIP(request);

  let identifier: string;

  switch (strategy) {
    case "ip":
      identifier = `ip:${clientIP}`;
      break;
    case "user":
      // Extract user ID from session if available
      const userId = request.headers.get("x-user-id") || "anonymous";
      identifier = `user:${userId}`;
      break;
    case "combined":
      const userIdCombined = request.headers.get("x-user-id") || "anonymous";
      identifier = `combined:${clientIP}:${userIdCombined}`;
      break;
    default:
      identifier = `ip:${clientIP}`;
  }

  return redisRateLimit(identifier, config);
}

/**
 * Rate limiting for authentication endpoints
 */
export async function checkAuthRateLimit(
  request: NextRequest
): Promise<RateLimitResult> {
  return checkRateLimit(
    request,
    {
      max: 10,
      windowMs: 60 * 1000, // 1 minute
    },
    "ip"
  );
}

/**
 * Rate limiting for payment endpoints
 */
export async function checkPaymentRateLimit(
  request: NextRequest
): Promise<RateLimitResult> {
  return checkRateLimit(
    request,
    {
      max: 30,
      windowMs: 60 * 1000, // 1 minute
    },
    "combined"
  );
}

/**
 * Rate limiting for API endpoints (general)
 */
export async function checkApiRateLimit(
  request: NextRequest
): Promise<RateLimitResult> {
  return checkRateLimit(
    request,
    {
      max: 100,
      windowMs: 60 * 1000, // 1 minute
    },
    "ip"
  );
}

/**
 * Rate limiting for user-specific actions
 */
export async function checkUserRateLimit(
  request: NextRequest,
  config: Partial<RateLimitConfig> = {}
): Promise<RateLimitResult> {
  const defaultConfig = {
    max: 50,
    windowMs: 60 * 1000, // 1 minute
  };

  return checkRateLimit(request, { ...defaultConfig, ...config }, "user");
}

/**
 * Rate limiting headers for responses
 */
export function getRateLimitHeaders(
  result: RateLimitResult
): Record<string, string> {
  return {
    "X-RateLimit-Limit": result.totalHits.toString(),
    "X-RateLimit-Remaining": result.remaining.toString(),
    "X-RateLimit-Reset": new Date(result.resetTime).toISOString(),
    "X-RateLimit-Used": result.totalHits.toString(),
  };
}

/**
 * Create rate limit exceeded response
 */
export function createRateLimitResponse(result: RateLimitResult): Response {
  const retryAfter = Math.ceil((result.resetTime - Date.now()) / 1000);

  return new Response(
    JSON.stringify({
      error: "Rate limit exceeded",
      message: "Too many requests, please try again later",
      retryAfter,
      resetTime: new Date(result.resetTime).toISOString(),
    }),
    {
      status: 429,
      headers: {
        "Content-Type": "application/json",
        "Retry-After": retryAfter.toString(),
        ...getRateLimitHeaders(result),
      },
    }
  );
}

/**
 * Cleanup function for graceful shutdown
 */
export async function cleanupRateLimit(): Promise<void> {
  if (redisClient) {
    try {
      await redisClient.quit();
      redisClient = null;
    } catch (_error) {
      console.warn("Error closing Redis connection:", _error);
    }
  }
  memoryStore.clear();
}
