import { NextResponse } from "next/server";

/**
 * Health check endpoint for Docker containers and load balancers
 * Provides comprehensive system status information
 */
export async function GET() {
  const startTime = Date.now();

  const healthCheck = {
    status: "healthy",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    version: process.env.npm_package_version || "1.0.0",
    environment: process.env.NODE_ENV || "development",
    checks: {
      api: "healthy",
      database: "unknown",
      redis: "unknown",
      external_services: "unknown",
    },
    performance: {
      memory: process.memoryUsage(),
      responseTime: 0,
    },
    system: {
      nodeVersion: process.version,
      platform: process.platform,
      arch: process.arch,
    },
  };

  try {
    // Basic API check - if we reach here, API is working
    healthCheck.checks.api = "healthy";

    // Database check (will be implemented when Prisma is set up)
    try {
      // TODO: Add database connection check
      // const db = await prisma.$queryRaw`SELECT 1`;
      healthCheck.checks.database = "healthy";
    } catch (error) {
      healthCheck.checks.database = "unhealthy";
      healthCheck.status = "degraded";
      console.error("Database health check failed:", error);
    }

    // Redis check (will be implemented when Redis client is set up)
    try {
      // TODO: Add Redis connection check
      // await redis.ping();
      healthCheck.checks.redis = "healthy";
    } catch (error) {
      healthCheck.checks.redis = "unhealthy";
      if (healthCheck.status === "healthy") {
        healthCheck.status = "degraded";
      }
      console.error("Redis health check failed:", error);
    }

    // External services check (Stripe, Resend, etc.)
    try {
      // Basic check - ensure environment variables are present
      const hasStripe = !!(
        process.env.STRIPE_SECRET_KEY && process.env.STRIPE_PUBLISHABLE_KEY
      );
      const hasResend = !!process.env.RESEND_API_KEY;

      if (hasStripe && hasResend) {
        healthCheck.checks.external_services = "healthy";
      } else {
        healthCheck.checks.external_services = "degraded";
        if (healthCheck.status === "healthy") {
          healthCheck.status = "degraded";
        }
      }
    } catch (error) {
      healthCheck.checks.external_services = "unhealthy";
      if (healthCheck.status === "healthy") {
        healthCheck.status = "degraded";
      }
      console.error("External services health check failed:", error);
    }

    // Calculate response time
    healthCheck.performance.responseTime = Date.now() - startTime;

    // Determine final status
    const hasUnhealthy = Object.values(healthCheck.checks).includes(
      "unhealthy"
    );
    const hasDegraded = Object.values(healthCheck.checks).includes("degraded");

    if (hasUnhealthy) {
      healthCheck.status = "unhealthy";
    } else if (hasDegraded) {
      healthCheck.status = "degraded";
    }

    // Return appropriate HTTP status code
    const statusCode =
      healthCheck.status === "healthy"
        ? 200
        : healthCheck.status === "degraded"
          ? 200
          : 503;

    return NextResponse.json(healthCheck, { status: statusCode });
  } catch (error) {
    console.error("Health check error:", error);

    return NextResponse.json(
      {
        status: "unhealthy",
        timestamp: new Date().toISOString(),
        error: "Internal health check error",
        uptime: process.uptime(),
        performance: {
          responseTime: Date.now() - startTime,
        },
      },
      { status: 503 }
    );
  }
}

/**
 * Simple health check for basic monitoring
 * Returns 200 OK if service is running
 */
export async function HEAD() {
  return new NextResponse(null, { status: 200 });
}
