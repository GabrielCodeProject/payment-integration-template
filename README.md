# Payment Integration Template

A modern, secure payment processing template built with Next.js 15, TypeScript, Prisma, BetterAuth,
and Stripe integration.

## Features

- 🔐 **Secure Authentication** - BetterAuth with role-based access control
- 💳 **Stripe Integration** - Complete payment processing with subscriptions
- 🗄️ **Database Ready** - PostgreSQL with Prisma ORM
- 🎨 **Modern UI** - Shadcn UI components with Tailwind CSS
- 🔒 **Security First** - Built-in security best practices
- 📧 **Email Integration** - Transactional emails with Resend
- 🧪 **Type Safe** - Full TypeScript with Zod validation
- 🚀 **Production Ready** - Environment validation and deployment guides

## Quick Start

### 1. Install Dependencies

```bash
npm install
```

### 2. Environment Setup

```bash
# Copy environment template
cp .env.example .env.local

# Fill in your environment variables (see docs/environment-variables.md)
# Required: DATABASE_URL, BETTER_AUTH_SECRET, Stripe keys, etc.

# Validate your setup
npm run env:check
```

### 3. Database Setup

```bash
# Start PostgreSQL (Docker)
docker-compose up -d postgres

# Run database migrations
npx prisma migrate dev

# Optional: Seed database
npx prisma db seed
```

### 4. Start Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to see your application.

## Documentation

- [Environment Variables Guide](./docs/environment-variables.md) - Complete setup guide
- [Architecture Overview](./architecture_prd/README.md) - System architecture and design
- [API Documentation](./architecture_prd/03_api_specification.md) - API endpoints and schemas

## Environment Variables

Key environment variables you need to configure:

```bash
# Authentication
BETTER_AUTH_SECRET=your-secret-key-here
BETTER_AUTH_URL=http://localhost:3000

# Database
DATABASE_URL=postgresql://postgres:password@localhost:5432/payment_template_dev

# Stripe (use test keys for development)
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_SECRET_KEY=sk_test_...

# App Configuration
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_APP_NAME=Payment Integration Template
```

See [Environment Variables Guide](./docs/environment-variables.md) for complete setup instructions.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback
and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the
[Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme)
from the creators of Next.js.

Check out our
[Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying)
for more details.
