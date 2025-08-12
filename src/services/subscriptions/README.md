# Subscription Services

This directory contains all subscription management business logic for the Stripe Billing
integration. Services handle subscription lifecycle, plan management, billing cycles, and usage
tracking.

## Service Organization

```
src/services/subscriptions/
├── SubscriptionService.ts     # Core subscription management
├── PlanService.ts             # Subscription plan management
├── BillingService.ts          # Billing and invoice handling
├── UsageService.ts            # Usage tracking and metering
├── ProrationService.ts        # Proration calculations
├── WebhookService.ts          # Subscription webhook processing
├── types.ts                   # Subscription-specific types
├── errors.ts                  # Subscription error classes
└── README.md                  # This documentation
```

## Core Services

### SubscriptionService

Main subscription lifecycle management service.

**Responsibilities:**

- Subscription creation and management
- Plan upgrades and downgrades
- Subscription cancellation and reactivation
- Subscription status tracking

**Key Methods:**

```typescript
class SubscriptionService {
  async createSubscription(params: CreateSubscriptionParams): Promise<Subscription>;
  async getSubscription(subscriptionId: SubscriptionId): Promise<Subscription>;
  async updateSubscription(
    subscriptionId: SubscriptionId,
    updates: SubscriptionUpdates
  ): Promise<Subscription>;
  async cancelSubscription(
    subscriptionId: SubscriptionId,
    options?: CancelOptions
  ): Promise<Subscription>;
  async reactivateSubscription(subscriptionId: SubscriptionId): Promise<Subscription>;
  async pauseSubscription(subscriptionId: SubscriptionId, resumeAt?: Date): Promise<Subscription>;
}
```

### PlanService

Manages subscription plans and pricing configurations.

**Responsibilities:**

- Plan creation and management
- Pricing tier configuration
- Feature set management
- Plan comparison and recommendations

**Key Methods:**

```typescript
class PlanService {
  async getAvailablePlans(): Promise<SubscriptionPlan[]>;
  async getPlan(planId: PlanId): Promise<SubscriptionPlan>;
  async createPlan(params: CreatePlanParams): Promise<SubscriptionPlan>;
  async updatePlan(planId: PlanId, updates: PlanUpdates): Promise<SubscriptionPlan>;
  async archivePlan(planId: PlanId): Promise<void>;
  async comparePlans(planIds: PlanId[]): Promise<PlanComparison>;
}
```

### BillingService

Handles billing cycles, invoices, and payment collection.

**Responsibilities:**

- Invoice generation and management
- Payment collection and retries
- Billing cycle configuration
- Tax calculations and compliance

**Key Methods:**

```typescript
class BillingService {
  async getUpcomingInvoice(subscriptionId: SubscriptionId): Promise<Invoice>;
  async getBillingHistory(
    customerId: CustomerId,
    options?: QueryOptions
  ): Promise<PaginatedResult<Invoice>>;
  async previewInvoice(
    subscriptionId: SubscriptionId,
    changes: SubscriptionChanges
  ): Promise<InvoicePreview>;
  async processPayment(invoiceId: InvoiceId): Promise<PaymentResult>;
  async retryFailedPayment(invoiceId: InvoiceId): Promise<PaymentResult>;
}
```

### UsageService

Tracks and reports usage-based billing metrics.

**Responsibilities:**

- Usage event recording
- Metered billing calculations
- Usage reporting and analytics
- Overage handling

**Key Methods:**

```typescript
class UsageService {
  async recordUsage(params: RecordUsageParams): Promise<UsageRecord>;
  async getUsageForPeriod(
    subscriptionId: SubscriptionId,
    startDate: Date,
    endDate: Date
  ): Promise<UsageSummary>;
  async getUsageMetrics(customerId: CustomerId): Promise<UsageMetrics>;
  async estimateUpcomingCharges(subscriptionId: SubscriptionId): Promise<ChargeEstimate>;
  async setUsageLimits(subscriptionId: SubscriptionId, limits: UsageLimits): Promise<void>;
}
```

## Implementation Examples

### Creating a Subscription

```typescript
import { SubscriptionService } from "@/services/subscriptions/SubscriptionService";
import { createCustomerId, createPlanId } from "@/types/common";

const subscriptionService = new SubscriptionService();

async function startSubscription(signupData: SubscriptionSignupData) {
  try {
    const subscription = await subscriptionService.createSubscription({
      customerId: createCustomerId(signupData.customerId),
      planId: createPlanId(signupData.planId),
      paymentMethodId: signupData.paymentMethodId,
      trialDays: signupData.includeTrial ? 14 : 0,
      metadata: {
        source: "web_signup",
        campaign: signupData.campaignId,
      },
    });

    // Log subscription creation for analytics
    await analytics.track("subscription_created", {
      subscriptionId: subscription.id,
      planId: subscription.planId,
      customerId: subscription.customerId,
      amount: subscription.plan.price,
    });

    return { success: true, subscription };
  } catch (error) {
    if (error instanceof SubscriptionError) {
      return { success: false, error: error.message };
    }
    throw error;
  }
}
```

### Plan Upgrade/Downgrade

```typescript
import { SubscriptionService } from "@/services/subscriptions/SubscriptionService";
import { ProrationService } from "@/services/subscriptions/ProrationService";

async function changePlan(subscriptionId: SubscriptionId, newPlanId: PlanId, effectiveDate?: Date) {
  const subscriptionService = new SubscriptionService();
  const prorationService = new ProrationService();

  // Calculate proration for the change
  const prorationPreview = await prorationService.calculateProration({
    subscriptionId,
    newPlanId,
    effectiveDate: effectiveDate || new Date(),
  });

  // Show user the proration details
  console.log("Plan change details:", {
    immediateCharge: prorationPreview.immediateCharge,
    nextBillingAmount: prorationPreview.nextBillingAmount,
    effectiveDate: prorationPreview.effectiveDate,
  });

  // Apply the plan change
  const updatedSubscription = await subscriptionService.updateSubscription(subscriptionId, {
    planId: newPlanId,
    prorationBehavior: "always_invoice",
    effectiveDate,
  });

  return updatedSubscription;
}
```

### Usage-Based Billing

```typescript
import { UsageService } from "@/services/subscriptions/UsageService";

const usageService = new UsageService();

async function trackApiUsage(customerId: CustomerId, apiCalls: number) {
  // Record usage event
  await usageService.recordUsage({
    subscriptionId: await getCustomerSubscriptionId(customerId),
    metricName: "api_calls",
    quantity: apiCalls,
    timestamp: new Date(),
    metadata: {
      endpoint: "/api/v1/process",
      responseTime: "150ms",
    },
  });

  // Check if approaching usage limits
  const currentUsage = await usageService.getUsageForCurrentPeriod(
    await getCustomerSubscriptionId(customerId)
  );

  if (currentUsage.percentageUsed > 80) {
    // Notify customer of high usage
    await sendUsageWarning(customerId, currentUsage);
  }
}
```

### Handling Failed Payments

```typescript
import { BillingService } from "@/services/subscriptions/BillingService";
import { SubscriptionService } from "@/services/subscriptions/SubscriptionService";

async function handleFailedPayment(invoiceId: InvoiceId) {
  const billingService = new BillingService();
  const subscriptionService = new SubscriptionService();

  try {
    // Attempt to retry payment
    const retryResult = await billingService.retryFailedPayment(invoiceId);

    if (retryResult.success) {
      console.log("Payment retry successful");
      return;
    }

    // If payment fails, handle dunning management
    const invoice = await billingService.getInvoice(invoiceId);
    const subscription = await subscriptionService.getSubscription(invoice.subscriptionId);

    // Implement dunning logic based on attempt count
    const attemptCount = invoice.paymentAttempts || 0;

    if (attemptCount >= 3) {
      // Cancel subscription after 3 failed attempts
      await subscriptionService.cancelSubscription(subscription.id, {
        reason: "payment_failure",
        cancelAtPeriodEnd: false,
      });

      await sendSubscriptionCanceledEmail(subscription.customerId);
    } else {
      // Schedule next retry
      await schedulePaymentRetry(invoiceId, attemptCount + 1);
      await sendPaymentFailureEmail(subscription.customerId, attemptCount);
    }
  } catch (error) {
    console.error("Error handling failed payment:", error);
  }
}
```

## Webhook Processing

### Subscription Webhook Handler

```typescript
import { WebhookService } from "@/services/subscriptions/WebhookService";

export class SubscriptionWebhookService extends WebhookService {
  async handleSubscriptionCreated(event: Stripe.Event) {
    const subscription = event.data.object as Stripe.Subscription;

    // Update local database
    await this.updateLocalSubscription(subscription);

    // Send welcome email
    await this.sendWelcomeEmail(subscription.customer as string);

    // Track analytics
    await this.trackEvent("subscription_created", {
      subscriptionId: subscription.id,
      planId: subscription.items.data[0].price.id,
      amount: subscription.items.data[0].price.unit_amount,
    });
  }

  async handleSubscriptionUpdated(event: Stripe.Event) {
    const subscription = event.data.object as Stripe.Subscription;

    // Check what changed
    const previousAttributes = event.data.previous_attributes;

    if (previousAttributes?.items) {
      // Plan changed
      await this.handlePlanChange(subscription);
    }

    if (previousAttributes?.status) {
      // Status changed
      await this.handleStatusChange(subscription, previousAttributes.status);
    }

    // Update local database
    await this.updateLocalSubscription(subscription);
  }

  async handleInvoicePaymentFailed(event: Stripe.Event) {
    const invoice = event.data.object as Stripe.Invoice;

    if (invoice.subscription) {
      await this.handleFailedPayment(invoice.id as InvoiceId);
    }
  }
}
```

## Error Handling

### Subscription-Specific Errors

```typescript
// errors.ts
export class SubscriptionError extends Error {
  constructor(
    message: string,
    public code: SubscriptionErrorCode,
    public subscriptionId?: SubscriptionId,
    public metadata?: Record<string, any>
  ) {
    super(message);
    this.name = "SubscriptionError";
  }
}

export enum SubscriptionErrorCode {
  PLAN_NOT_FOUND = "PLAN_NOT_FOUND",
  SUBSCRIPTION_NOT_FOUND = "SUBSCRIPTION_NOT_FOUND",
  INVALID_PLAN_CHANGE = "INVALID_PLAN_CHANGE",
  PAYMENT_METHOD_REQUIRED = "PAYMENT_METHOD_REQUIRED",
  TRIAL_ALREADY_USED = "TRIAL_ALREADY_USED",
  SUBSCRIPTION_CANCELED = "SUBSCRIPTION_CANCELED",
  BILLING_CYCLE_LOCKED = "BILLING_CYCLE_LOCKED",
  USAGE_LIMIT_EXCEEDED = "USAGE_LIMIT_EXCEEDED",
}

export class BillingError extends Error {
  constructor(
    message: string,
    public code: BillingErrorCode,
    public invoiceId?: InvoiceId
  ) {
    super(message);
    this.name = "BillingError";
  }
}

export enum BillingErrorCode {
  INVOICE_NOT_FOUND = "INVOICE_NOT_FOUND",
  PAYMENT_FAILED = "PAYMENT_FAILED",
  PRORATION_ERROR = "PRORATION_ERROR",
  TAX_CALCULATION_FAILED = "TAX_CALCULATION_FAILED",
  DUNNING_FAILED = "DUNNING_FAILED",
}
```

## Testing

### Unit Testing Subscriptions

```typescript
// SubscriptionService.test.ts
import { SubscriptionService } from "../SubscriptionService";
import { SubscriptionError } from "../errors";

describe("SubscriptionService", () => {
  let subscriptionService: SubscriptionService;
  let mockStripe: jest.Mocked<Stripe>;

  beforeEach(() => {
    mockStripe = {
      subscriptions: {
        create: jest.fn(),
        retrieve: jest.fn(),
        update: jest.fn(),
        cancel: jest.fn(),
      },
      prices: {
        retrieve: jest.fn(),
      },
    } as any;

    subscriptionService = new SubscriptionService();
    (subscriptionService as any).stripe = mockStripe;
  });

  describe("createSubscription", () => {
    it("should create subscription with trial", async () => {
      const mockSubscription = {
        id: "sub_123",
        customer: "cus_123",
        status: "trialing",
        trial_end: Math.floor(Date.now() / 1000) + 14 * 24 * 60 * 60,
      };

      mockStripe.subscriptions.create.mockResolvedValue(mockSubscription);

      const result = await subscriptionService.createSubscription({
        customerId: createCustomerId("cus_123"),
        planId: createPlanId("price_123"),
        trialDays: 14,
      });

      expect(result.status).toBe("trialing");
      expect(mockStripe.subscriptions.create).toHaveBeenCalledWith({
        customer: "cus_123",
        items: [{ price: "price_123" }],
        trial_period_days: 14,
      });
    });

    it("should handle subscription creation errors", async () => {
      mockStripe.subscriptions.create.mockRejectedValue(
        new Error("Customer has no payment method")
      );

      await expect(
        subscriptionService.createSubscription({
          customerId: createCustomerId("cus_123"),
          planId: createPlanId("price_123"),
        })
      ).rejects.toThrow(SubscriptionError);
    });
  });
});
```

### Integration Testing

```typescript
// SubscriptionService.integration.test.ts
describe("Subscription Integration", () => {
  it("should handle complete subscription lifecycle", async () => {
    const service = new SubscriptionService({
      stripe: { secretKey: process.env.STRIPE_TEST_SECRET_KEY! },
    });

    // Create customer and payment method first
    const customer = await createTestCustomer();
    const paymentMethod = await createTestPaymentMethod(customer.id);

    // Create subscription
    const subscription = await service.createSubscription({
      customerId: createCustomerId(customer.id),
      planId: createPlanId("price_test_123"),
      paymentMethodId: paymentMethod.id,
    });

    expect(subscription.status).toBe("active");

    // Test plan change
    const upgraded = await service.updateSubscription(subscription.id, {
      planId: createPlanId("price_test_456"),
    });

    expect(upgraded.planId).toBe("price_test_456");

    // Test cancellation
    const canceled = await service.cancelSubscription(subscription.id);
    expect(canceled.status).toBe("canceled");
  });
});
```

## Configuration

### Service Configuration

```typescript
export interface SubscriptionServiceConfig {
  stripe: {
    secretKey: string;
    apiVersion: string;
  };
  billing: {
    defaultCurrency: Currency;
    trialPeriodDays: number;
    gracePeriodDays: number;
    maxRetryAttempts: number;
  };
  features: {
    prorationEnabled: boolean;
    usageBasedBilling: boolean;
    dunningManagement: boolean;
    automaticTax: boolean;
  };
  webhooks: {
    endpointSecret: string;
    retryAttempts: number;
  };
}
```

## Performance Optimization

### Caching Strategy

```typescript
import { Redis } from "ioredis";

export class SubscriptionService {
  private redis = new Redis(process.env.REDIS_URL);

  async getSubscription(subscriptionId: SubscriptionId): Promise<Subscription> {
    // Check cache first
    const cached = await this.redis.get(`subscription:${subscriptionId}`);
    if (cached) {
      return JSON.parse(cached);
    }

    // Fetch from Stripe
    const subscription = await this.stripe.subscriptions.retrieve(subscriptionId);

    // Cache for 5 minutes
    await this.redis.setex(`subscription:${subscriptionId}`, 300, JSON.stringify(subscription));

    return this.mapStripeSubscription(subscription);
  }
}
```

### Batch Usage Recording

```typescript
export class UsageService {
  private usageQueue: UsageRecord[] = [];
  private batchSize = 100;

  async recordUsage(usage: RecordUsageParams): Promise<void> {
    this.usageQueue.push(usage);

    if (this.usageQueue.length >= this.batchSize) {
      await this.flushUsageQueue();
    }
  }

  private async flushUsageQueue(): Promise<void> {
    const batch = this.usageQueue.splice(0, this.batchSize);

    // Process batch in parallel
    await Promise.all(
      batch.map((usage) =>
        this.stripe.subscriptionItems.createUsageRecord(usage.subscriptionItemId, {
          quantity: usage.quantity,
          timestamp: Math.floor(usage.timestamp.getTime() / 1000),
        })
      )
    );
  }
}
```

This subscription service organization provides comprehensive subscription management capabilities
for the Stripe Billing integration.
