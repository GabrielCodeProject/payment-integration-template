import type { NextConfig } from "next";

/**
 * Next.js Configuration for Payment Integration Template
 *
 * This configuration optimizes the app for payment processing,
 * security, and performance with App Router.
 */

const nextConfig: NextConfig = {
  // =============================================================================
  // EXPERIMENTAL FEATURES
  // =============================================================================

  // =============================================================================
  // PERFORMANCE OPTIMIZATIONS
  // =============================================================================

  // Optimize images for payment UI
  images: {
    formats: ["image/webp", "image/avif"],
    minimumCacheTTL: 60,
    dangerouslyAllowSVG: true,
    contentDispositionType: "attachment",
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
  },

  // Note: optimizeFonts is enabled by default in Next.js 15

  // Enable compression
  compress: true,

  // =============================================================================
  // SECURITY HEADERS
  // =============================================================================
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          // Prevent clickjacking
          {
            key: "X-Frame-Options",
            value: "DENY",
          },
          // Prevent MIME type sniffing
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          // Enable XSS protection
          {
            key: "X-XSS-Protection",
            value: "1; mode=block",
          },
          // Referrer policy for privacy
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
          // Permissions policy
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
        ],
      },
      // Special headers for API routes (payments, webhooks)
      {
        source: "/api/(.*)",
        headers: [
          {
            key: "Cache-Control",
            value: "no-store, no-cache, must-revalidate",
          },
        ],
      },
    ];
  },

  // =============================================================================
  // ENVIRONMENT VARIABLES VALIDATION
  // =============================================================================
  env: {
    // Make sure critical environment variables are available at build time
    CUSTOM_ENV_CHECK: process.env.NODE_ENV || "development",
  },

  // =============================================================================
  // WEBPACK OPTIMIZATIONS
  // =============================================================================
  webpack: (config, { isServer, dev }) => {
    // Optimize bundle size in production
    if (!dev && !isServer) {
      config.optimization.splitChunks.cacheGroups = {
        ...config.optimization.splitChunks.cacheGroups,
        stripe: {
          name: "stripe",
          chunks: "all",
          test: /[\\/]node_modules[\\/](@stripe)[\\/]/,
          priority: 30,
          reuseExistingChunk: true,
        },
        auth: {
          name: "auth",
          chunks: "all",
          test: /[\\/]node_modules[\\/](better-auth|@auth)[\\/]/,
          priority: 25,
          reuseExistingChunk: true,
        },
      };
    }

    return config;
  },

  // =============================================================================
  // REDIRECTS & REWRITES
  // =============================================================================
  async redirects() {
    return [
      // Redirect old payment URLs if migrating from another system
      {
        source: "/payment/:path*",
        destination: "/checkout/:path*",
        permanent: true,
      },
    ];
  },

  // =============================================================================
  // RUNTIME CONFIGURATION
  // =============================================================================

  // Enable static generation where possible
  output: "standalone",

  // Configure logging in development
  logging: {
    fetches: {
      fullUrl: process.env.NODE_ENV === "development",
    },
  },

  // =============================================================================
  // TYPE CHECKING
  // =============================================================================
  typescript: {
    // Fail build on type errors in production
    ignoreBuildErrors: false,
  },

  eslint: {
    // Fail build on ESLint errors in production
    ignoreDuringBuilds: false,
  },
};

export default nextConfig;
