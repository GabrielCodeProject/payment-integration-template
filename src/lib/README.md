# Environment & Utilities Library

This directory contains core utility functions and configurations for the Payment Integration Template.

## Environment Variables (`env.ts`)

Type-safe environment variable validation and access for Next.js App Router.

### Server-Side Usage

```typescript
import { getServerEnv } from '@/lib/env';

// In API routes, Server Components, or middleware
export async function POST() {
  const env = getServerEnv();
  const stripe = new Stripe(env.STRIPE_SECRET_KEY);
  // ...
}
```

### Client-Side Usage

```typescript
import { getClientEnv } from '@/lib/env';

// In Client Components
export function PaymentForm() {
  const env = getClientEnv();
  const stripe = await loadStripe(env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY);
  // ...
}
```

### Feature Flags

```typescript
import { isDebugMode, isStripeTestMode } from '@/lib/env';

if (isDebugMode()) {
  console.log('Debug mode enabled');
}

if (isStripeTestMode()) {
  console.warn('Using Stripe test mode');
}
```

## Server Actions (`safe-action.ts`)

Type-safe server actions with validation, authentication, and rate limiting.

### Basic Action

```typescript
import { actionClient } from '@/lib/safe-action';
import { z } from 'zod';

export const createUser = actionClient
  .schema(z.object({
    email: z.string().email(),
    name: z.string().min(2)
  }))
  .action(async ({ parsedInput }) => {
    // Your server action logic
    return { success: true, user: parsedInput };
  });
```

### Authenticated Action

```typescript
import { authActionClient } from '@/lib/safe-action';

export const updateProfile = authActionClient
  .schema(z.object({ name: z.string() }))
  .action(async ({ parsedInput }) => {
    // User is authenticated here
    return { success: true };
  });
```

### Payment Action

```typescript
import { paymentActionClient } from '@/lib/safe-action';

export const processPayment = paymentActionClient
  .schema(z.object({
    amount: z.number().positive(),
    currency: z.string().length(3)
  }))
  .action(async ({ parsedInput }) => {
    // Authenticated, rate-limited, Stripe-configured
    return { success: true, paymentId: 'pi_123' };
  });
```

## Type Safety

All environment variables are fully typed with TypeScript:

- Server-only variables throw errors if accessed on client
- Client variables are validated at runtime
- Zod schemas ensure proper format validation
- IDE autocomplete and type checking

## Error Handling

- Development: Detailed error messages
- Production: Sanitized error responses
- Validation errors with specific field information
- Server errors with appropriate logging

## Best Practices

1. **Always use the typed environment functions** instead of `process.env` directly
2. **Separate client and server environment access** - never mix them
3. **Use appropriate action clients** for different security levels
4. **Validate inputs with Zod schemas** for all server actions
5. **Handle errors gracefully** with proper user feedback

## Development Workflow

1. Copy `.env.example` to `.env.local`
2. Fill in required environment variables
3. Run `npm run env:check` to validate setup
4. Use type-safe environment functions in your code
5. Leverage server action clients for mutations