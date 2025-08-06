# Environment Variables Setup Guide

This guide explains how to configure environment variables for the Payment Integration Template built with Next.js App Router.

## Quick Start

1. Copy the example environment file:
   ```bash
   cp .env.example .env.local
   ```

2. Fill in the required values in `.env.local`

3. Restart your development server:
   ```bash
   npm run dev
   ```

## Environment Files Hierarchy

Next.js loads environment variables in the following order (later files override earlier ones):

1. `.env` - Default for all environments
2. `.env.local` - Local overrides (ignored by git)
3. `.env.development` - Development environment
4. `.env.development.local` - Local development overrides
5. `.env.production` - Production environment
6. `.env.production.local` - Local production overrides

## Required Environment Variables

### Database Configuration

```bash
# PostgreSQL example
DATABASE_URL="postgresql://username:password@localhost:5432/payment_app"

# SQLite example (for development)
DATABASE_URL="file:./dev.db"
```

### Authentication (BetterAuth)

```bash
# Generate with: openssl rand -base64 32
BETTER_AUTH_SECRET="your-super-secret-key-min-32-chars-long"

# Your application URL
BETTER_AUTH_URL="http://localhost:3000"

# Trusted origins for CORS (comma-separated)
BETTER_AUTH_TRUSTED_ORIGINS="http://localhost:3000"
```

### Stripe Configuration

```bash
# Get from Stripe Dashboard -> Developers -> API keys
STRIPE_SECRET_KEY="sk_test_..."
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY="pk_test_..."

# Get from Stripe Dashboard -> Developers -> Webhooks
STRIPE_WEBHOOK_SECRET="whsec_..."
```

### Email Service (Optional)

```bash
# Get from Resend Dashboard
RESEND_API_KEY="re_..."
RESEND_FROM_EMAIL="noreply@yourdomain.com"
```

## Environment Variable Types

### Server-Side Only Variables
These are only available in:
- API routes (`/api` folder)
- Server Components
- Server Actions
- Middleware

Examples: `DATABASE_URL`, `STRIPE_SECRET_KEY`, `BETTER_AUTH_SECRET`

### Client-Side Variables
These are exposed to the browser and must be prefixed with `NEXT_PUBLIC_`:

Examples: `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`, `NEXT_PUBLIC_APP_URL`

⚠️ **Never put secrets in `NEXT_PUBLIC_` variables!**

## Type-Safe Environment Variables

The project includes type-safe environment variable validation:

```typescript
// Server-side usage
import { getServerEnv } from '@/lib/env';

const env = getServerEnv();
const stripeSecret = env.STRIPE_SECRET_KEY; // ✅ Type-safe

// Client-side usage
import { getClientEnv } from '@/lib/env';

const env = getClientEnv();
const stripePublishable = env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY; // ✅ Type-safe
```

## Development vs Production

### Development Environment
- Use test API keys from Stripe
- Enable debug mode: `NEXT_PUBLIC_DEBUG_MODE="true"`
- Use local database
- Detailed error logging enabled

### Production Environment
- Use live API keys from Stripe
- Disable debug mode: `NEXT_PUBLIC_DEBUG_MODE="false"`
- Use production database
- Error logging sanitized for security

## Security Best Practices

1. **Never commit `.env` files** - They're ignored by git by default
2. **Use strong secrets** - Minimum 32 characters for auth secrets
3. **Rotate secrets regularly** - Especially in production
4. **Limit environment access** - Only give production env access to trusted team members
5. **Use different databases** - Separate databases for development, staging, and production

## Common Issues and Solutions

### Environment Variables Not Loading

1. **Restart the development server** after changing `.env.local`
2. **Check file naming** - Must be `.env.local`, not `.env.dev` or similar
3. **Check variable names** - Client variables must start with `NEXT_PUBLIC_`
4. **Check file location** - `.env.local` should be in the project root

### Type Validation Errors

```bash
# If you see validation errors, check:
❌ Invalid server environment variables: [ZodError details]
```

1. **Check variable formats** - Stripe keys have specific prefixes (`sk_`, `pk_`)
2. **Check required variables** - Some variables are required in specific environments
3. **Check variable types** - Numbers should be numbers, URLs should be valid URLs

### Stripe Integration Issues

1. **Test vs Live keys** - Make sure you're using the right environment keys
2. **Webhook endpoints** - Ensure webhook URLs match your application URL
3. **CORS errors** - Check `BETTER_AUTH_TRUSTED_ORIGINS` includes your domain

## Environment Variable Reference

| Variable | Type | Required | Description |
|----------|------|----------|-------------|
| `DATABASE_URL` | Server | Yes | Database connection string |
| `BETTER_AUTH_SECRET` | Server | Yes | Secret for JWT signing (min 32 chars) |
| `BETTER_AUTH_URL` | Server | Yes | Application base URL |
| `STRIPE_SECRET_KEY` | Server | Yes | Stripe secret API key |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Client | Yes | Stripe publishable key |
| `STRIPE_WEBHOOK_SECRET` | Server | No | Webhook signature verification |
| `RESEND_API_KEY` | Server | No | Email service API key |
| `NEXT_PUBLIC_APP_URL` | Client | Yes | Public application URL |
| `NEXT_PUBLIC_DEBUG_MODE` | Client | No | Enable debug features |

## Getting API Keys

### Stripe
1. Create account at [stripe.com](https://stripe.com)
2. Go to Dashboard → Developers → API keys
3. Copy "Publishable key" and "Secret key"
4. For webhooks: Dashboard → Developers → Webhooks → Add endpoint

### Resend (Optional)
1. Create account at [resend.com](https://resend.com)
2. Go to Dashboard → API Keys
3. Create new API key

### Database
- **PostgreSQL**: Use services like Supabase, Neon, or Railway
- **SQLite**: For development only - `file:./dev.db`

## Next Steps

1. Set up your environment variables
2. Run database migrations: `npx prisma migrate dev`
3. Start development server: `npm run dev`
4. Test your configuration with the included validation utilities

For deployment-specific configuration, see the deployment documentation.