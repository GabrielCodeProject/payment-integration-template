# Validation Utilities

Input validation and data verification utilities for forms, payments, and business logic validation.

## Available Validators

### Payment Validation

```typescript
import { validatePaymentCard, validateCVC, validateExpiryDate } from "@/utils/validation/payment";

// Validate payment cards
const cardResult = validatePaymentCard("4242424242424242");
// { isValid: true, type: "visa", errors: [] }

// Validate CVC
validateCVC("123", "visa"); // { isValid: true, errors: [] }

// Validate expiry dates
validateExpiryDate("12", "2025"); // { isValid: true, errors: [] }
```

### Form Validation

```typescript
import { validateEmail, validatePassword, validatePhone } from "@/utils/validation/form";

// Email validation
validateEmail("user@example.com"); // []
validateEmail("invalid-email"); // ["Invalid email format"]

// Password validation
validatePassword("weak"); // ["Password too short", "Must contain uppercase"]

// Phone validation
validatePhone("+1-555-123-4567"); // { isValid: true, formatted: "+15551234567" }
```

### Business Logic Validation

```typescript
import { validateSubscriptionUpgrade, validateRefundAmount } from "@/utils/validation/business";

// Subscription validation
validateSubscriptionUpgrade(currentPlan, newPlan); // { allowed: true, proration: 500 }

// Refund validation
validateRefundAmount(paymentAmount, refundAmount); // { valid: true, maxRefund: 2000 }
```
