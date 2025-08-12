# Application Constants

Centralized constants, enums, and configuration values used throughout the payment integration
application.

## Available Constants

### Payment Constants

```typescript
import {
  SUPPORTED_CURRENCIES,
  PAYMENT_METHODS,
  STRIPE_COUNTRIES,
} from "@/utils/constants/payments";

// Supported currencies
SUPPORTED_CURRENCIES.USD; // { code: "USD", symbol: "$", name: "US Dollar" }

// Payment methods
PAYMENT_METHODS.CARD; // "card"
PAYMENT_METHODS.BANK_TRANSFER; // "us_bank_account"

// Stripe supported countries
STRIPE_COUNTRIES.includes("US"); // true
```

### Subscription Constants

```typescript
import {
  BILLING_INTERVALS,
  SUBSCRIPTION_STATUSES,
  PLAN_FEATURES,
} from "@/utils/constants/subscriptions";

// Billing intervals
BILLING_INTERVALS.MONTHLY; // "month"
BILLING_INTERVALS.YEARLY; // "year"

// Subscription statuses
SUBSCRIPTION_STATUSES.ACTIVE; // "active"
SUBSCRIPTION_STATUSES.CANCELED; // "canceled"
```

### Error Codes

```typescript
import { PAYMENT_ERROR_CODES, SUBSCRIPTION_ERROR_CODES } from "@/utils/constants/errors";

// Payment error codes
PAYMENT_ERROR_CODES.CARD_DECLINED; // "card_declined"
PAYMENT_ERROR_CODES.INSUFFICIENT_FUNDS; // "insufficient_funds"

// Subscription error codes
SUBSCRIPTION_ERROR_CODES.PLAN_NOT_FOUND; // "plan_not_found"
```
