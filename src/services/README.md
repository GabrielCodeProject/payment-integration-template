# Services Layer

This directory contains business logic and API interaction services for the Payment Integration
Template. Services are organized by feature domain and provide a clean separation between UI
components and backend integrations.

## Directory Structure

```
src/services/
├── auth/           # Authentication and user management services
├── payments/       # Payment processing and transaction services
├── subscriptions/  # Subscription management services
├── products/       # Product catalog and pricing services
├── webhooks/       # Webhook processing services
└── README.md       # This documentation
```

## Architecture Principles

### 1. Single Responsibility

Each service handles one specific domain of functionality:

- Authentication services only handle user auth operations
- Payment services only handle payment processing
- Subscription services only handle subscription lifecycle

### 2. Framework Agnostic

Services are independent of UI framework specifics:

- No direct Next.js dependencies
- No React hook dependencies
- Pure TypeScript/JavaScript business logic

### 3. Testable Design

Services are designed for easy unit testing:

- Pure functions where possible
- Dependency injection for external services
- Clear input/output contracts

### 4. Error Handling

Consistent error handling patterns:

- Domain-specific error types
- Proper error propagation
- Logging and monitoring integration

## Service Categories

### Auth Services (`/auth`)

- User authentication
- Session management
- Role-based access control
- Password reset workflows

### Payment Services (`/payments`)

- Stripe payment processing
- Payment intent creation
- Payment method management
- Transaction history

### Subscription Services (`/subscriptions`)

- Subscription lifecycle management
- Plan upgrades/downgrades
- Billing cycle management
- Usage tracking

### Product Services (`/products`)

- Product catalog management
- Pricing calculations
- Feature flag management
- Product availability

### Webhook Services (`/webhooks`)

- Stripe webhook processing
- Event validation
- Event routing and handling
- Idempotency management

## Usage Patterns

### Server-Side Usage

```typescript
import { PaymentService } from "@/services/payments";
import { SubscriptionService } from "@/services/subscriptions";

// In API routes or Server Actions
export async function POST(request: Request) {
  const paymentService = new PaymentService();
  const result = await paymentService.createPaymentIntent({
    amount: 2000,
    currency: "usd",
  });

  return Response.json(result);
}
```

### Client-Side Integration

```typescript
import { usePayments } from "@/hooks/usePayments";

// Services called through React hooks
export function CheckoutForm() {
  const { createPayment, loading } = usePayments();

  const handleSubmit = async (formData) => {
    await createPayment(formData);
  };

  return <form onSubmit={handleSubmit}>...</form>;
}
```

## Implementation Guidelines

### 1. Service Class Structure

```typescript
export class PaymentService {
  private stripe: Stripe;

  constructor(config?: PaymentConfig) {
    this.stripe = new Stripe(config?.secretKey || process.env.STRIPE_SECRET_KEY);
  }

  async createPaymentIntent(params: CreatePaymentParams): Promise<PaymentResult> {
    try {
      // Implementation
    } catch (error) {
      throw new PaymentError("Failed to create payment intent", error);
    }
  }
}
```

### 2. Configuration Management

```typescript
export interface ServiceConfig {
  stripe: {
    secretKey: string;
    publishableKey: string;
    webhookSecret: string;
  };
  database: {
    url: string;
  };
}
```

### 3. Error Handling

```typescript
export class PaymentError extends Error {
  constructor(
    message: string,
    public cause?: Error,
    public code?: string
  ) {
    super(message);
    this.name = "PaymentError";
  }
}
```

## Integration with Other Layers

### With React Hooks (`/hooks`)

Services are consumed by React hooks that provide UI-friendly interfaces:

```typescript
// hooks/usePayments.ts
import { PaymentService } from "@/services/payments";

export function usePayments() {
  const service = useMemo(() => new PaymentService(), []);

  const createPayment = useCallback(
    async (data) => {
      return await service.createPaymentIntent(data);
    },
    [service]
  );

  return { createPayment };
}
```

### With Server Actions

Services power server actions for form submissions:

```typescript
// app/actions/payment-actions.ts
import { PaymentService } from "@/services/payments";

export async function createPaymentAction(formData: FormData) {
  const service = new PaymentService();
  return await service.createPaymentIntent({
    amount: Number(formData.get("amount")),
    currency: "usd",
  });
}
```

### With API Routes

Services handle the core logic in API routes:

```typescript
// app/api/payments/route.ts
import { PaymentService } from "@/services/payments";

export async function POST(request: Request) {
  const service = new PaymentService();
  const data = await request.json();

  const result = await service.createPaymentIntent(data);
  return Response.json(result);
}
```

## Testing Strategy

### Unit Tests

Each service should have comprehensive unit tests:

```typescript
// services/payments/__tests__/PaymentService.test.ts
import { PaymentService } from "../PaymentService";

describe("PaymentService", () => {
  it("should create payment intent", async () => {
    const service = new PaymentService(mockConfig);
    const result = await service.createPaymentIntent(mockParams);

    expect(result.success).toBe(true);
    expect(result.paymentIntent).toBeDefined();
  });
});
```

### Integration Tests

Test service integration with external APIs:

```typescript
// __tests__/integration/payments.test.ts
import { PaymentService } from "@/services/payments";

describe("Payment Integration", () => {
  it("should integrate with Stripe API", async () => {
    // Test with test Stripe keys
  });
});
```

## Best Practices

1. **Keep services stateless** - Don't store instance state between calls
2. **Use dependency injection** - Allow configuration and mocking
3. **Handle errors gracefully** - Provide meaningful error messages
4. **Log important operations** - Use structured logging
5. **Validate inputs** - Use Zod schemas for parameter validation
6. **Document public APIs** - Use JSDoc for all public methods
7. **Use TypeScript strictly** - Define clear interfaces and types
8. **Follow naming conventions** - Use descriptive, consistent naming

## Development Workflow

1. **Define interfaces first** - Create TypeScript interfaces before implementation
2. **Write tests** - Create test cases before implementing features
3. **Implement incrementally** - Build features one method at a time
4. **Document as you go** - Update README and JSDoc continuously
5. **Review and refactor** - Regularly review and improve service design

## Future Enhancements

Planned service improvements:

- Caching layer integration
- Rate limiting and retry logic
- Comprehensive audit logging
- Performance monitoring
- Multi-tenant support
- Event sourcing patterns
