# Environment Variables Guide

This guide explains how to set up and manage environment variables for the Payment Integration
Template.

## Quick Start

1. **Copy the example file:**

   ```bash
   cp .env.example .env.local
   ```

2. **Fill in required values** (see [Required Variables](#required-variables) below)

3. **Validate your setup:**

   ```bash
   npm run env:check
   ```

4. **Start development:**
   ```bash
   npm run dev
   ```

## File Structure

- **`.env.local`** - Your development environment (gitignored, modify this)
- **`.env.example`** - Template for new team members (committed to git)
- **`.env.production.example`** - Production deployment template

## Required Variables

### Authentication (BetterAuth)

```bash
# Generate with: openssl rand -base64 32
BETTER_AUTH_SECRET=your-32-char-secret-here

# Your app URL
BETTER_AUTH_URL=http://localhost:3000  # Development
BETTER_AUTH_URL=https://your-app.com   # Production
```

### Database

```bash
# PostgreSQL connection string
DATABASE_URL=postgresql://postgres:password@localhost:5432/payment_template_dev

# Optional: Direct URL for migrations (usually same as DATABASE_URL)
# DIRECT_URL=postgresql://postgres:password@localhost:5432/payment_template_dev
```

### Stripe Integration

```bash
# Client-side publishable key (safe to expose)
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...  # Development
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_...  # Production

# Server-side secret key (keep secure!)
STRIPE_SECRET_KEY=sk_test_...  # Development
STRIPE_SECRET_KEY=sk_live_...  # Production
```

### Application Configuration

```bash
# App URL for redirects and webhooks
NEXT_PUBLIC_APP_URL=http://localhost:3000  # Development
NEXT_PUBLIC_APP_URL=https://your-app.com   # Production

# App name displayed in UI
NEXT_PUBLIC_APP_NAME=Payment Integration Template
```

## Optional Variables

### Email Service (Resend)

```bash
# Resend API key (starts with 're_')
RESEND_API_KEY=re_your_api_key_here

# Sender email (must be verified domain)
RESEND_FROM_EMAIL="Your App <noreply@your-domain.com>"
```

### Stripe Webhooks

```bash
# Webhook signing secret (highly recommended for production)
STRIPE_WEBHOOK_SECRET=whsec_your_webhook_secret_here
```

### Security & Rate Limiting

```bash
# Rate limiting (optional, has defaults)
RATE_LIMIT_MAX_REQUESTS=100
RATE_LIMIT_WINDOW_MS=900000  # 15 minutes

# CSRF protection (optional)
CSRF_SECRET=your-csrf-secret-here
```

### Feature Flags

```bash
# Debug mode (default: false)
NEXT_PUBLIC_DEBUG_MODE=true   # Development
NEXT_PUBLIC_DEBUG_MODE=false  # Production

# Stripe test mode indicator (default: true)
NEXT_PUBLIC_STRIPE_TEST_MODE=true   # Development
NEXT_PUBLIC_STRIPE_TEST_MODE=false  # Production
```

### Analytics & Monitoring

```bash
# Google Analytics
NEXT_PUBLIC_GOOGLE_ANALYTICS_ID=G-XXXXXXXXXX

# PostHog Analytics
NEXT_PUBLIC_POSTHOG_KEY=phc_your_posthog_key

# Sentry Error Tracking
NEXT_PUBLIC_SENTRY_DSN=https://your-sentry-dsn@sentry.io/project-id
```

## Environment-Specific Setup

### Development Environment

1. Copy template:

   ```bash
   cp .env.example .env.local
   ```

2. Use test Stripe keys (`pk_test_` and `sk_test_`)
3. Use local database (`localhost`)
4. Enable debug mode
5. Email service is optional (will log to console)

### Production Environment

1. Use `.env.production.example` as reference
2. Set environment variables in your deployment platform
3. Use live Stripe keys (`pk_live_` and `sk_live_`)
4. Use managed database with SSL
5. Disable debug mode
6. Configure email service
7. Set up webhook endpoints

## Environment Validation

The project includes automatic environment validation:

```bash
# Manual validation
npm run env:check

# Automatic validation before dev server
npm run dev  # Runs validation first
```

### Validation Features

- ✅ **Type checking** - Ensures URLs, emails, keys have correct format
- ✅ **Security checks** - Validates secret lengths, HTTPS in production
- ✅ **Stripe key matching** - Ensures test/live keys match environment
- ✅ **Production readiness** - Warns about development settings in production
- ✅ **Missing variables** - Identifies required but missing variables

## Security Best Practices

### Development

- Never commit `.env.local` to version control
- Use test Stripe keys only
- Keep secrets out of logs and error messages

### Production

- Use your deployment platform's secret management
- Rotate secrets regularly
- Use HTTPS for all URLs
- Enable webhook signature verification
- Monitor for security events

## Common Issues

### 1. Database Connection Fails

```bash
# Check your PostgreSQL is running
docker ps  # If using Docker
pg_isready -h localhost -p 5432  # Direct PostgreSQL

# Verify connection string format
DATABASE_URL=postgresql://username:password@host:port/database
```

### 2. Stripe Keys Not Working

```bash
# Ensure keys match environment
# Development: pk_test_... and sk_test_...
# Production: pk_live_... and sk_live_...

# Check keys in Stripe Dashboard:
# https://dashboard.stripe.com/test/apikeys (test keys)
# https://dashboard.stripe.com/apikeys (live keys)
```

### 3. Authentication Errors

```bash
# Generate new secret (must be 32+ characters)
openssl rand -base64 32

# Ensure URL matches your app
BETTER_AUTH_URL=http://localhost:3000  # Development
```

### 4. CORS Issues

```bash
# Ensure trusted origins match your setup
BETTER_AUTH_TRUSTED_ORIGINS=http://localhost:3000,https://localhost:3000
```

## Deployment Platforms

### Vercel

Set environment variables in project settings:

```bash
vercel env add BETTER_AUTH_SECRET
vercel env add DATABASE_URL
# ... etc
```

### Railway

```bash
railway variables set BETTER_AUTH_SECRET=your_secret
railway variables set DATABASE_URL=your_db_url
```

### Docker

```bash
# Use docker-compose.yml or environment file
docker run -e BETTER_AUTH_SECRET=your_secret your-app
```

### Generic Platforms

Most platforms support:

1. Web dashboard for environment variables
2. CLI tools for setting variables
3. Environment files (be careful with security)

## Development Workflow

1. **New team member setup:**

   ```bash
   git clone repo
   npm install
   npm run env:setup  # Creates .env.local from template
   # Fill in values
   npm run env:check  # Validate
   npm run dev       # Start development
   ```

2. **Adding new environment variables:**
   - Add to `src/lib/env.ts` schema
   - Add to `.env.example` template
   - Update validation script if needed
   - Document in this guide

3. **Production deployment:**
   - Use `.env.production.example` as reference
   - Set variables in deployment platform
   - Run validation in CI/CD pipeline
   - Test thoroughly in staging environment

## Support

If you encounter issues with environment setup:

1. Run validation: `npm run env:check`
2. Check the logs for specific error messages
3. Verify all required variables are set
4. Ensure correct formats (URLs, prefixes, lengths)
5. Review this documentation for common issues

For deployment-specific issues, consult your platform's documentation on environment variable
management.
