#!/usr/bin/env node

/**
 * Environment Variables Validation Script
 *
 * This script validates that all required environment variables are set up correctly
 * for the Payment Integration Template.
 *
 * Usage: node scripts/validate-env.js
 */

// eslint-disable-next-line @typescript-eslint/no-require-imports
const fs = require("fs");
// eslint-disable-next-line @typescript-eslint/no-require-imports
const path = require("path");

// Color codes for console output
const colors = {
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  reset: "\x1b[0m",
  bold: "\x1b[1m",
};

function log(message, color = "reset") {
  // eslint-disable-next-line no-console
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function validateEnvironment() {
  log("\n🔍 Validating Environment Configuration...\n", "blue");

  // Check if .env.local exists
  const envLocalPath = path.join(process.cwd(), ".env.local");
  const envExamplePath = path.join(process.cwd(), ".env.example");

  if (!fs.existsSync(envLocalPath)) {
    log("❌ .env.local file not found", "red");
    if (fs.existsSync(envExamplePath)) {
      log(
        "💡 Copy .env.example to .env.local and fill in the values:",
        "yellow"
      );
      log("   cp .env.example .env.local", "yellow");
    }
    return false;
  }

  // Load environment variables
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  require("dotenv").config({ path: envLocalPath });

  let hasErrors = false;
  let hasWarnings = false;

  // Required server-side variables
  const requiredServerVars = {
    DATABASE_URL: {
      required: true,
      validator: (val) =>
        val && (val.startsWith("postgresql://") || val.startsWith("file:")),
      message: "Must be a valid database URL (postgresql:// or file:)",
    },
    BETTER_AUTH_SECRET: {
      required: true,
      validator: (val) => val && val.length >= 32,
      message: "Must be at least 32 characters long",
    },
    STRIPE_SECRET_KEY: {
      required: true,
      validator: (val) => val && val.startsWith("sk_"),
      message: 'Must start with "sk_" (Stripe secret key)',
    },
    RESEND_API_KEY: {
      required: true,
      validator: (val) => val && val.startsWith("re_"),
      message: 'Must start with "re_" (required for email verification)',
    },
  };

  // Required client-side variables
  const requiredClientVars = {
    NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: {
      required: true,
      validator: (val) => val && val.startsWith("pk_"),
      message: 'Must start with "pk_" (Stripe publishable key)',
    },
    NEXT_PUBLIC_APP_URL: {
      required: true,
      validator: (val) =>
        val && (val.startsWith("http://") || val.startsWith("https://")),
      message: "Must be a valid URL",
    },
  };

  // Optional variables
  const optionalVars = {
    STRIPE_WEBHOOK_SECRET: {
      required: false,
      validator: (val) => !val || val.startsWith("whsec_"),
      message: 'If provided, must start with "whsec_"',
    },
    FROM_EMAIL: {
      required: false,
      validator: (val) => !val || val.includes("@"),
      message: "If provided, must be a valid email address",
    },
    BETTER_AUTH_URL: {
      required: false,
      validator: (val) => !val || (val.startsWith("http://") || val.startsWith("https://")),
      message: "If provided, must be a valid URL",
    },
  };

  // Validate required server variables
  log("📋 Server-side Variables:", "bold");
  for (const [varName, config] of Object.entries(requiredServerVars)) {
    const value = process.env[varName];
    const isValid = config.validator(value);

    if (!value && config.required) {
      log(`  ❌ ${varName}: Missing (required)`, "red");
      hasErrors = true;
    } else if (value && !isValid) {
      log(`  ❌ ${varName}: Invalid - ${config.message}`, "red");
      hasErrors = true;
    } else if (value) {
      log(`  ✅ ${varName}: Valid`, "green");
    }
  }

  // Validate required client variables
  log("\n🌐 Client-side Variables:", "bold");
  for (const [varName, config] of Object.entries(requiredClientVars)) {
    const value = process.env[varName];
    const isValid = config.validator(value);

    if (!value && config.required) {
      log(`  ❌ ${varName}: Missing (required)`, "red");
      hasErrors = true;
    } else if (value && !isValid) {
      log(`  ❌ ${varName}: Invalid - ${config.message}`, "red");
      hasErrors = true;
    } else if (value) {
      log(`  ✅ ${varName}: Valid`, "green");
    }
  }

  // Validate optional variables
  log("\n🔧 Optional Variables:", "bold");
  for (const [varName, config] of Object.entries(optionalVars)) {
    const value = process.env[varName];
    const isValid = config.validator(value);

    if (value && !isValid) {
      log(`  ❌ ${varName}: Invalid - ${config.message}`, "red");
      hasErrors = true;
    } else if (value) {
      log(`  ✅ ${varName}: Valid`, "green");
    } else {
      log(`  ⚠️  ${varName}: Not set (optional)`, "yellow");
    }
  }

  // Environment-specific checks
  log("\n🏗️  Environment Checks:", "bold");

  const nodeEnv = process.env.NODE_ENV || "development";
  log(`  ℹ️  NODE_ENV: ${nodeEnv}`, "blue");

  // Check for test vs live keys
  const stripeSecret = process.env.STRIPE_SECRET_KEY;
  const stripePublishable = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;

  if (stripeSecret && stripePublishable) {
    const isTestSecret = stripeSecret.includes("_test_");
    const isTestPublishable = stripePublishable.includes("_test_");

    if (isTestSecret && isTestPublishable) {
      log("  ✅ Using Stripe test keys (good for development)", "green");
    } else if (!isTestSecret && !isTestPublishable) {
      log("  ⚠️  Using Stripe live keys (ensure this is intended)", "yellow");
      hasWarnings = true;
    } else {
      log("  ❌ Stripe key mismatch (test/live keys don't match)", "red");
      hasErrors = true;
    }
  }

  // Database URL check
  const dbUrl = process.env.DATABASE_URL;
  if (dbUrl) {
    if (dbUrl.startsWith("file:")) {
      log("  ✅ Using SQLite (good for development)", "green");
    } else if (dbUrl.includes("localhost")) {
      log("  ✅ Using local PostgreSQL", "green");
    } else {
      log("  ✅ Using remote database", "green");
    }
  }

  // Summary
  log("\n📊 Validation Summary:", "bold");
  if (hasErrors) {
    log("❌ Validation failed - please fix the errors above", "red");
    log("\n💡 Quick fixes:", "yellow");
    log(
      "   - Copy .env.example to .env.local: cp .env.example .env.local",
      "yellow"
    );
    log("   - Fill in missing variables from Stripe dashboard", "yellow");
    log("   - Generate auth secret: openssl rand -base64 32", "yellow");
    log("   - Set up local PostgreSQL database", "yellow");
    log(
      "   - For production, use .env.production.example as reference",
      "yellow"
    );
    return false;
  } else if (hasWarnings) {
    log("⚠️  Validation passed with warnings", "yellow");
    return true;
  } else {
    log("✅ All environment variables are valid!", "green");
    log("🚀 You're ready to start development", "green");
    return true;
  }
}

// Run validation if called directly
if (require.main === module) {
  try {
    const isValid = validateEnvironment();
    process.exit(isValid ? 0 : 1);
  } catch (error) {
    log(`\n❌ Validation error: ${error.message}`, "red");
    process.exit(1);
  }
}

module.exports = { validateEnvironment };
