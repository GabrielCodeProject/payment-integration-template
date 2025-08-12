# Payment Services

This directory contains all payment processing business logic for the Stripe integration. Services
are organized by payment functionality and provide a clean abstraction layer between the UI and
Stripe APIs.

## Service Organization

```
src/services/payments/
├── PaymentService.ts          # Core payment processing
├── PaymentMethodService.ts    # Payment method management
├── PaymentIntentService.ts    # Payment intent operations
├── TransactionService.ts      # Transaction history and reporting
├── RefundService.ts           # Refund processing
├── types.ts                   # Payment-specific types
├── errors.ts                  # Payment error classes
└── README.md                  # This documentation
```

## Core Services

### PaymentService

Main payment processing service for creating and managing payments.

**Responsibilities:**

- Payment creation and processing
- Payment status validation
- Payment metadata management
- Integration with Stripe Payment Intents API

**Key Methods:**

```typescript
class PaymentService {
  async createPayment(params: CreatePaymentParams): Promise<Payment>;
  async processPayment(paymentId: PaymentId): Promise<PaymentResult>;
  async getPayment(paymentId: PaymentId): Promise<Payment>;
  async updatePaymentMetadata(
    paymentId: PaymentId,
    metadata: Record<string, string>
  ): Promise<Payment>;
  async cancelPayment(paymentId: PaymentId): Promise<Payment>;
}
```

### PaymentMethodService

Manages customer payment methods and their lifecycle.

**Responsibilities:**

- Payment method creation and storage
- Default payment method management
- Payment method validation
- Card verification and setup

**Key Methods:**

```typescript
class PaymentMethodService {
  async savePaymentMethod(customerId: CustomerId, paymentMethodId: string): Promise<PaymentMethod>;
  async getPaymentMethods(customerId: CustomerId): Promise<PaymentMethod[]>;
  async setDefaultPaymentMethod(
    customerId: CustomerId,
    paymentMethodId: PaymentMethodId
  ): Promise<void>;
  async deletePaymentMethod(paymentMethodId: PaymentMethodId): Promise<void>;
  async validatePaymentMethod(paymentMethodId: PaymentMethodId): Promise<ValidationResult>;
}
```

### PaymentIntentService

Handles Stripe Payment Intent lifecycle management.

**Responsibilities:**

- Payment Intent creation
- Client secret generation
- Payment Intent confirmation
- Status tracking and updates

**Key Methods:**

```typescript
class PaymentIntentService {
  async createPaymentIntent(params: CreatePaymentIntentParams): Promise<StripePaymentIntent>;
  async confirmPaymentIntent(
    paymentIntentId: string,
    paymentMethodId: string
  ): Promise<StripePaymentIntent>;
  async retrievePaymentIntent(paymentIntentId: string): Promise<StripePaymentIntent>;
  async cancelPaymentIntent(paymentIntentId: string): Promise<StripePaymentIntent>;
}
```

### TransactionService

Provides transaction history and reporting capabilities.

**Responsibilities:**

- Transaction history retrieval
- Payment reporting and analytics
- Transaction search and filtering
- Export functionality

**Key Methods:**

```typescript
class TransactionService {
  async getTransactionHistory(
    customerId: CustomerId,
    options?: QueryOptions
  ): Promise<PaginatedResult<Transaction>>;
  async searchTransactions(query: TransactionSearchQuery): Promise<SearchResult<Transaction>>;
  async getTransactionsByDateRange(
    customerId: CustomerId,
    startDate: Date,
    endDate: Date
  ): Promise<Transaction[]>;
  async exportTransactions(customerId: CustomerId, format: ExportFormat): Promise<ExportResult>;
}
```

### RefundService

Handles refund processing and management.

**Responsibilities:**

- Refund creation and processing
- Partial and full refunds
- Refund status tracking
- Refund reporting

**Key Methods:**

```typescript
class RefundService {
  async createRefund(params: CreateRefundParams): Promise<Refund>;
  async getRefund(refundId: RefundId): Promise<Refund>;
  async getRefundsByPayment(paymentId: PaymentId): Promise<Refund[]>;
  async processPartialRefund(
    paymentId: PaymentId,
    amount: number,
    reason?: string
  ): Promise<Refund>;
}
```

## Implementation Examples

### Creating a Payment

```typescript
import { PaymentService } from "@/services/payments/PaymentService";
import { createCustomerId, createPaymentMethodId } from "@/types/common";

const paymentService = new PaymentService();

async function processCheckoutPayment(checkoutData: CheckoutFormData) {
  try {
    const payment = await paymentService.createPayment({
      amount: checkoutData.amount,
      currency: checkoutData.currency,
      customerId: createCustomerId(checkoutData.customerId),
      paymentMethodId: createPaymentMethodId(checkoutData.paymentMethodId),
      metadata: {
        orderId: checkoutData.orderId,
        source: "checkout",
      },
    });

    return { success: true, payment };
  } catch (error) {
    if (error instanceof PaymentError) {
      return { success: false, error: error.message };
    }
    throw error;
  }
}
```

### Managing Payment Methods

```typescript
import { PaymentMethodService } from "@/services/payments/PaymentMethodService";

const paymentMethodService = new PaymentMethodService();

async function setupCustomerPaymentMethods(customerId: CustomerId) {
  // Get existing payment methods
  const existingMethods = await paymentMethodService.getPaymentMethods(customerId);

  // If no default payment method, prompt for setup
  if (!existingMethods.some((pm) => pm.isDefault)) {
    // Handle payment method setup flow
    const setupIntent = await paymentMethodService.createSetupIntent(customerId);
    return { requiresSetup: true, clientSecret: setupIntent.client_secret };
  }

  return { requiresSetup: false, paymentMethods: existingMethods };
}
```

### Processing Refunds

```typescript
import { RefundService } from "@/services/payments/RefundService";

const refundService = new RefundService();

async function handleRefundRequest(paymentId: PaymentId, refundAmount: number, reason: string) {
  try {
    const refund = await refundService.createRefund({
      paymentId,
      amount: refundAmount,
      reason,
      metadata: {
        requestedBy: "customer_service",
        ticketId: "TICKET_123",
      },
    });

    // Log refund for audit purposes
    console.log(`Refund created: ${refund.id} for payment ${paymentId}`);

    return refund;
  } catch (error) {
    if (error instanceof RefundError) {
      // Handle specific refund errors
      throw new Error(`Refund failed: ${error.message}`);
    }
    throw error;
  }
}
```

## Error Handling

### Payment-Specific Errors

```typescript
// errors.ts
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
  INVALID_CVC = "INVALID_CVC",
  PROCESSING_ERROR = "PROCESSING_ERROR",
  AUTHENTICATION_REQUIRED = "AUTHENTICATION_REQUIRED",
  NETWORK_ERROR = "NETWORK_ERROR",
}

export class RefundError extends Error {
  constructor(
    message: string,
    public code: RefundErrorCode,
    public paymentId?: PaymentId
  ) {
    super(message);
    this.name = "RefundError";
  }
}

export enum RefundErrorCode {
  ALREADY_REFUNDED = "ALREADY_REFUNDED",
  INSUFFICIENT_BALANCE = "INSUFFICIENT_BALANCE",
  REFUND_DEADLINE_PASSED = "REFUND_DEADLINE_PASSED",
  INVALID_AMOUNT = "INVALID_AMOUNT",
}
```

### Error Handling Patterns

```typescript
import { PaymentError, PaymentErrorCode } from "./errors";

export function handlePaymentError(error: unknown): PaymentError {
  if (error instanceof PaymentError) {
    return error;
  }

  // Handle Stripe-specific errors
  if (error && typeof error === "object" && "type" in error) {
    const stripeError = error as any;

    switch (stripeError.type) {
      case "card_error":
        return new PaymentError(
          stripeError.message,
          mapStripeCardErrorCode(stripeError.code),
          false
        );
      case "rate_limit_error":
        return new PaymentError(
          "Too many requests. Please try again later.",
          PaymentErrorCode.NETWORK_ERROR,
          true
        );
      default:
        return new PaymentError(
          "Payment processing failed",
          PaymentErrorCode.PROCESSING_ERROR,
          true
        );
    }
  }

  // Generic error fallback
  return new PaymentError("An unexpected error occurred", PaymentErrorCode.PROCESSING_ERROR, false);
}
```

## Configuration

### Service Configuration

```typescript
// PaymentService.ts
export interface PaymentServiceConfig {
  stripe: {
    secretKey: string;
    apiVersion: string;
  };
  defaults: {
    currency: Currency;
    captureMethod: "automatic" | "manual";
    confirmationMethod: "automatic" | "manual";
  };
  features: {
    savePaymentMethods: boolean;
    automaticTax: boolean;
    receipts: boolean;
  };
}

export class PaymentService {
  private stripe: Stripe;
  private config: PaymentServiceConfig;

  constructor(config?: Partial<PaymentServiceConfig>) {
    this.config = {
      stripe: {
        secretKey: config?.stripe?.secretKey || process.env.STRIPE_SECRET_KEY!,
        apiVersion: "2023-10-16",
      },
      defaults: {
        currency: "USD",
        captureMethod: "automatic",
        confirmationMethod: "automatic",
        ...config?.defaults,
      },
      features: {
        savePaymentMethods: true,
        automaticTax: false,
        receipts: true,
        ...config?.features,
      },
    };

    this.stripe = new Stripe(this.config.stripe.secretKey, {
      apiVersion: this.config.stripe.apiVersion,
    });
  }
}
```

## Testing

### Unit Testing Services

```typescript
// PaymentService.test.ts
import { PaymentService } from "../PaymentService";
import { PaymentError, PaymentErrorCode } from "../errors";

// Mock Stripe
jest.mock("stripe");

describe("PaymentService", () => {
  let paymentService: PaymentService;
  let mockStripe: jest.Mocked<Stripe>;

  beforeEach(() => {
    mockStripe = {
      paymentIntents: {
        create: jest.fn(),
        retrieve: jest.fn(),
        confirm: jest.fn(),
        cancel: jest.fn(),
      },
    } as any;

    paymentService = new PaymentService();
    (paymentService as any).stripe = mockStripe;
  });

  describe("createPayment", () => {
    it("should create payment successfully", async () => {
      const mockPaymentIntent = {
        id: "pi_123",
        amount: 2000,
        currency: "usd",
        status: "succeeded",
      };

      mockStripe.paymentIntents.create.mockResolvedValue(mockPaymentIntent);

      const result = await paymentService.createPayment({
        amount: 2000,
        currency: "USD",
        customerId: createCustomerId("cust_123"),
        paymentMethodId: createPaymentMethodId("pm_123"),
      });

      expect(result.amount).toBe(2000);
      expect(result.currency).toBe("USD");
      expect(mockStripe.paymentIntents.create).toHaveBeenCalledWith({
        amount: 2000,
        currency: "usd",
        customer: "cust_123",
        payment_method: "pm_123",
        confirmation_method: "automatic",
        capture_method: "automatic",
      });
    });

    it("should handle payment errors", async () => {
      const stripeError = {
        type: "card_error",
        code: "card_declined",
        message: "Your card was declined.",
      };

      mockStripe.paymentIntents.create.mockRejectedValue(stripeError);

      await expect(
        paymentService.createPayment({
          amount: 2000,
          currency: "USD",
          customerId: createCustomerId("cust_123"),
          paymentMethodId: createPaymentMethodId("pm_123"),
        })
      ).rejects.toThrow(PaymentError);
    });
  });
});
```

### Integration Testing

```typescript
// PaymentService.integration.test.ts
import { PaymentService } from "../PaymentService";

describe("PaymentService Integration", () => {
  let paymentService: PaymentService;

  beforeAll(() => {
    // Use test Stripe keys
    paymentService = new PaymentService({
      stripe: {
        secretKey: process.env.STRIPE_TEST_SECRET_KEY!,
        apiVersion: "2023-10-16",
      },
    });
  });

  it("should create real payment intent", async () => {
    const payment = await paymentService.createPayment({
      amount: 1000,
      currency: "USD",
      customerId: createCustomerId("cust_test_123"),
      paymentMethodId: createPaymentMethodId("pm_card_visa"),
    });

    expect(payment.id).toMatch(/^pay_/);
    expect(payment.amount).toBe(1000);
  });
});
```

## Performance Considerations

### Caching Strategy

```typescript
import { LRUCache } from "lru-cache";

export class PaymentService {
  private paymentCache = new LRUCache<string, Payment>({
    max: 1000,
    ttl: 1000 * 60 * 5, // 5 minutes
  });

  async getPayment(paymentId: PaymentId): Promise<Payment> {
    // Check cache first
    const cached = this.paymentCache.get(paymentId);
    if (cached) {
      return cached;
    }

    // Fetch from Stripe
    const payment = await this.fetchPaymentFromStripe(paymentId);

    // Cache the result
    this.paymentCache.set(paymentId, payment);

    return payment;
  }
}
```

### Batch Operations

```typescript
export class PaymentService {
  async createMultiplePayments(payments: CreatePaymentParams[]): Promise<Payment[]> {
    // Process payments in batches to avoid rate limits
    const BATCH_SIZE = 10;
    const results: Payment[] = [];

    for (let i = 0; i < payments.length; i += BATCH_SIZE) {
      const batch = payments.slice(i, i + BATCH_SIZE);
      const batchPromises = batch.map((payment) => this.createPayment(payment));
      const batchResults = await Promise.allSettled(batchPromises);

      batchResults.forEach((result, index) => {
        if (result.status === "fulfilled") {
          results.push(result.value);
        } else {
          console.error(`Payment ${i + index} failed:`, result.reason);
        }
      });

      // Add delay between batches
      if (i + BATCH_SIZE < payments.length) {
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
    }

    return results;
  }
}
```

This payment service organization provides a robust foundation for handling all payment-related
operations in the Stripe integration template.
