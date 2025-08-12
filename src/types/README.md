# TypeScript Type Definitions

This directory contains comprehensive TypeScript type definitions for the Payment Integration
Template. Types are organized by feature domain to provide type safety across the entire
application.

## Directory Structure

```
src/types/
├── auth/           # Authentication and user types
├── payments/       # Payment processing types
├── subscriptions/  # Subscription management types
├── products/       # Product catalog types
├── api/            # API request/response types
├── common/         # Shared utility types
├── env.d.ts        # Environment variable types
├── global.d.ts     # Global type declarations
└── README.md       # This documentation
```

## Type Organization Principles

### 1. Domain-Driven Types

Types are organized by business domain:

- **Auth types**: User, session, role management
- **Payment types**: Transactions, payment methods, Stripe integration
- **Subscription types**: Plans, billing, usage tracking
- **Product types**: Catalog, pricing, features

### 2. Layered Type Definitions

```
Domain Types (Business Models)
├── API Types (Network Layer)
├── Service Types (Business Logic)
├── Component Types (UI Layer)
└── Utility Types (Helpers)
```

### 3. Type Safety Levels

- **Strict types**: For critical business logic
- **Branded types**: For domain-specific values
- **Union types**: For state management
- **Generic types**: For reusable patterns

## Type Categories

### Auth Types (`/auth`)

User authentication and authorization:

```typescript
// User management
export interface User {
  id: UserId;
  email: string;
  name: string | null;
  role: UserRole;
  isActive: boolean;
  stripeCustomerId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

// Session management
export interface Session {
  id: SessionId;
  userId: UserId;
  expiresAt: Date;
  isValid: boolean;
}

// Role-based access
export enum UserRole {
  CUSTOMER = "CUSTOMER",
  SUPPORT = "SUPPORT",
  ADMIN = "ADMIN",
}
```

### Payment Types (`/payments`)

Payment processing and transactions:

```typescript
// Payment transactions
export interface Payment {
  id: PaymentId;
  amount: number; // in cents
  currency: Currency;
  status: PaymentStatus;
  customerId: CustomerId;
  paymentMethodId: PaymentMethodId;
  metadata: Record<string, string>;
  createdAt: Date;
}

// Stripe integration
export interface StripePaymentIntent {
  id: string;
  amount: number;
  currency: string;
  status: Stripe.PaymentIntent.Status;
  client_secret: string;
}

// Payment methods
export interface PaymentMethod {
  id: PaymentMethodId;
  type: PaymentMethodType;
  card?: CardDetails;
  customerId: CustomerId;
  isDefault: boolean;
}
```

### Subscription Types (`/subscriptions`)

Subscription lifecycle management:

```typescript
// Subscription plans
export interface SubscriptionPlan {
  id: PlanId;
  name: string;
  description: string;
  price: number; // in cents
  currency: Currency;
  interval: BillingInterval;
  features: PlanFeature[];
  isActive: boolean;
}

// User subscriptions
export interface Subscription {
  id: SubscriptionId;
  userId: UserId;
  planId: PlanId;
  status: SubscriptionStatus;
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  cancelAtPeriodEnd: boolean;
  stripeSubscriptionId: string;
}

// Billing intervals
export enum BillingInterval {
  MONTHLY = "month",
  YEARLY = "year",
  WEEKLY = "week",
}
```

### Product Types (`/products`)

Product catalog and pricing:

```typescript
// Product definitions
export interface Product {
  id: ProductId;
  name: string;
  description: string;
  category: ProductCategory;
  price: number; // in cents
  currency: Currency;
  features: ProductFeature[];
  isActive: boolean;
  metadata: ProductMetadata;
}

// Shopping cart
export interface CartItem {
  productId: ProductId;
  quantity: number;
  price: number; // at time of adding
  customizations?: CartItemCustomization[];
}

export interface Cart {
  id: CartId;
  userId: UserId;
  items: CartItem[];
  subtotal: number;
  tax: number;
  total: number;
  currency: Currency;
}
```

### API Types (`/api`)

Request and response type definitions:

```typescript
// Generic API patterns
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: ApiError;
  pagination?: PaginationInfo;
}

export interface ApiError {
  code: string;
  message: string;
  details?: Record<string, any>;
}

// Specific endpoint types
export namespace PaymentAPI {
  export interface CreatePaymentRequest {
    amount: number;
    currency: Currency;
    customerId: CustomerId;
    paymentMethodId: PaymentMethodId;
    metadata?: Record<string, string>;
  }

  export interface CreatePaymentResponse {
    payment: Payment;
    clientSecret: string;
  }
}
```

### Common Types (`/common`)

Shared utility and base types:

```typescript
// Branded types for type safety
export type UserId = string & { readonly brand: unique symbol };
export type PaymentId = string & { readonly brand: unique symbol };
export type CustomerId = string & { readonly brand: unique symbol };

// Utility types
export type Optional<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;
export type RequiredOnly<T, K extends keyof T> = Pick<T, K>;
export type PartialBy<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;

// State management types
export interface AsyncState<T> {
  loading: boolean;
  error: Error | null;
  data: T | null;
}

export interface PaginatedResult<T> {
  items: T[];
  pagination: PaginationInfo;
}

export interface PaginationInfo {
  page: number;
  limit: number;
  total: number;
  hasNext: boolean;
  hasPrev: boolean;
}
```

## Implementation Guidelines

### 1. Branded Types for Type Safety

```typescript
// Create distinct types for similar data
export type UserId = string & { readonly __brand: "UserId" };
export type CustomerID = string & { readonly __brand: "CustomerId" };
export type PaymentId = string & { readonly __brand: "PaymentId" };

// Helper functions for type creation
export function createUserId(id: string): UserId {
  return id as UserId;
}

export function createCustomerId(id: string): CustomerId {
  return id as CustomerId;
}

// Usage prevents mixing up similar string types
function getUser(userId: UserId): Promise<User> {
  // Implementation
}

// This would cause a TypeScript error:
// getUser("some-random-string"); // Error!

// Correct usage:
getUser(createUserId("user_123")); // ✅
```

### 2. Discriminated Unions

```typescript
// Payment status with discriminated unions
export type PaymentStatus =
  | { type: "pending"; pendingReason?: string }
  | { type: "processing"; processingDetails: ProcessingDetails }
  | { type: "succeeded"; completedAt: Date; transactionId: string }
  | { type: "failed"; error: PaymentError; retryable: boolean }
  | { type: "canceled"; canceledAt: Date; reason: string };

// Type-safe status handling
function handlePaymentStatus(status: PaymentStatus) {
  switch (status.type) {
    case "succeeded":
      // TypeScript knows we have completedAt and transactionId
      console.log(`Payment completed at ${status.completedAt}`);
      break;
    case "failed":
      // TypeScript knows we have error and retryable
      if (status.retryable) {
        console.log("Payment can be retried");
      }
      break;
    // ... other cases
  }
}
```

### 3. Generic Types for Reusability

```typescript
// Generic service response
export interface ServiceResponse<TData, TError = Error> {
  success: boolean;
  data?: TData;
  error?: TError;
  timestamp: Date;
}

// Generic pagination
export interface PaginatedQuery {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
}

export interface PaginatedResponse<T> {
  items: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

// Usage with specific types
type UserListResponse = PaginatedResponse<User>;
type PaymentListResponse = PaginatedResponse<Payment>;
```

### 4. Conditional Types

```typescript
// Conditional types for flexible APIs
export type CreatePaymentInput<T extends PaymentMethodType> = {
  amount: number;
  currency: Currency;
  customerId: CustomerId;
} & (T extends "card"
  ? { paymentMethodId: PaymentMethodId }
  : T extends "bank_transfer"
    ? { bankAccountId: BankAccountId }
    : never);

// Usage with type inference
const cardPayment: CreatePaymentInput<"card"> = {
  amount: 2000,
  currency: "USD",
  customerId: createCustomerId("cust_123"),
  paymentMethodId: createPaymentMethodId("pm_123"), // Required for card
};
```

### 5. Zod Integration for Runtime Validation

```typescript
import { z } from "zod";

// Zod schema
export const UserSchema = z.object({
  id: z.string(),
  email: z.string().email(),
  name: z.string().nullable(),
  role: z.enum(["CUSTOMER", "SUPPORT", "ADMIN"]),
  isActive: z.boolean(),
  stripeCustomerId: z.string().nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

// Infer TypeScript type from Zod schema
export type User = z.infer<typeof UserSchema>;

// API request validation
export const CreateUserRequestSchema = UserSchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type CreateUserRequest = z.infer<typeof CreateUserRequestSchema>;
```

## Testing Types

### Type Testing Utilities

```typescript
// Type testing helpers
export type Expect<T extends true> = T;
export type Equal<X, Y> =
  (<T>() => T extends X ? 1 : 2) extends <T>() => T extends Y ? 1 : 2 ? true : false;

// Example type tests
type TestUserIdBranding = Expect<Equal<UserId, string & { readonly __brand: "UserId" }>>;

type TestPaymentStatusDiscrimination = Expect<
  Equal<PaymentStatus["type"], "pending" | "processing" | "succeeded" | "failed" | "canceled">
>;
```

### Runtime Type Validation Testing

```typescript
import { UserSchema } from "@/types/auth";

describe("User Type Validation", () => {
  it("should validate correct user data", () => {
    const validUser = {
      id: "user_123",
      email: "user@example.com",
      name: "John Doe",
      role: "CUSTOMER" as const,
      isActive: true,
      stripeCustomerId: "cus_123",
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    expect(() => UserSchema.parse(validUser)).not.toThrow();
  });

  it("should reject invalid user data", () => {
    const invalidUser = {
      id: "user_123",
      email: "invalid-email",
      role: "INVALID_ROLE",
    };

    expect(() => UserSchema.parse(invalidUser)).toThrow();
  });
});
```

## Best Practices

### 1. Naming Conventions

```typescript
// ✅ Good: Clear, descriptive names
export interface PaymentMethod {}
export type PaymentStatus = "pending" | "completed" | "failed";
export enum SubscriptionInterval {}

// ❌ Bad: Unclear abbreviations
export interface PM {}
export type PS = "p" | "c" | "f";
export enum SI {}
```

### 2. Documentation

````typescript
/**
 * Represents a payment transaction in the system
 *
 * @example
 * ```typescript
 * const payment: Payment = {
 *   id: createPaymentId("pay_123"),
 *   amount: 2000, // $20.00 in cents
 *   currency: "USD",
 *   status: { type: "succeeded", completedAt: new Date() },
 *   customerId: createCustomerId("cust_123"),
 *   paymentMethodId: createPaymentMethodId("pm_123"),
 *   metadata: { orderId: "order_456" },
 *   createdAt: new Date()
 * };
 * ```
 */
export interface Payment {
  /** Unique payment identifier */
  id: PaymentId;

  /** Amount in smallest currency unit (cents for USD) */
  amount: number;

  /** ISO 4217 currency code */
  currency: Currency;

  /** Current payment status with discriminated union */
  status: PaymentStatus;

  /** Customer who made the payment */
  customerId: CustomerId;

  /** Payment method used for this payment */
  paymentMethodId: PaymentMethodId;

  /** Additional metadata for the payment */
  metadata: Record<string, string>;

  /** When the payment was created */
  createdAt: Date;
}
````

### 3. Type Composition

```typescript
// Base types
interface BaseEntity {
  id: string;
  createdAt: Date;
  updatedAt: Date;
}

interface SoftDeletable {
  deletedAt: Date | null;
  isDeleted: boolean;
}

interface Timestamped {
  createdAt: Date;
  updatedAt: Date;
}

// Composed types
export interface User extends BaseEntity, SoftDeletable {
  email: string;
  name: string | null;
  role: UserRole;
}

export interface Product extends BaseEntity {
  name: string;
  description: string;
  price: number;
  currency: Currency;
}
```

### 4. Error Type Safety

```typescript
// Domain-specific error types
export class PaymentError extends Error {
  constructor(
    message: string,
    public code: PaymentErrorCode,
    public retryable: boolean = false,
    public metadata?: Record<string, any>
  ) {
    super(message);
    this.name = "PaymentError";
  }
}

export enum PaymentErrorCode {
  INSUFFICIENT_FUNDS = "INSUFFICIENT_FUNDS",
  CARD_DECLINED = "CARD_DECLINED",
  EXPIRED_CARD = "EXPIRED_CARD",
  NETWORK_ERROR = "NETWORK_ERROR",
  INVALID_AMOUNT = "INVALID_AMOUNT",
}

// Type-safe error handling
export type PaymentResult =
  | { success: true; payment: Payment }
  | { success: false; error: PaymentError };
```

## Environment Types

### Environment Variable Types (`env.d.ts`)

```typescript
declare global {
  namespace NodeJS {
    interface ProcessEnv {
      // Database
      DATABASE_URL: string;

      // Authentication
      AUTH_SECRET: string;
      NEXT_PUBLIC_APP_URL: string;

      // Stripe
      STRIPE_SECRET_KEY: string;
      NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: string;
      STRIPE_WEBHOOK_SECRET: string;

      // Redis
      REDIS_URL?: string;

      // Email
      RESEND_API_KEY?: string;

      // Feature flags
      MAINTENANCE_MODE?: "true" | "false";
      DEBUG_MODE?: "true" | "false";
    }
  }
}

export {};
```

### Global Types (`global.d.ts`)

```typescript
// Global utility types
declare global {
  type Currency = "USD" | "EUR" | "GBP" | "CAD" | "AUD";
  type Locale = "en-US" | "en-GB" | "en-CA" | "fr-FR" | "de-DE";

  // Extend window object
  interface Window {
    Stripe?: any;
    gtag?: (...args: any[]) => void;
  }

  // Custom JSX attributes
  namespace JSX {
    interface IntrinsicElements {
      "stripe-pricing-table": any;
    }
  }
}

export {};
```

## Migration Strategy

When updating types, follow this migration strategy:

1. **Add new types** without removing old ones
2. **Deprecate old types** with JSDoc comments
3. **Update usage** gradually across the codebase
4. **Remove deprecated types** in next major version

```typescript
/**
 * @deprecated Use PaymentStatus instead. Will be removed in v2.0.0
 */
export type LegacyPaymentStatus = "pending" | "completed" | "failed";

/**
 * New discriminated union for better type safety
 */
export type PaymentStatus =
  | { type: "pending"; pendingReason?: string }
  | { type: "succeeded"; completedAt: Date }
  | { type: "failed"; error: PaymentError };
```

This comprehensive type system provides type safety across the entire payment integration
application while maintaining flexibility and developer experience.
