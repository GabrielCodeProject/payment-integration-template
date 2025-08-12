# Utilities

This directory contains utility functions and helpers for the Payment Integration Template. Unlike
the `/lib` directory which contains core configurations and integrations, `/utils` focuses on pure
utility functions that can be used across the application.

## Directory Structure

```
src/utils/
├── formatting/     # Data formatting utilities (currency, dates, etc.)
├── validation/     # Input validation helpers
├── constants/      # Application constants and enums
├── helpers/        # General helper functions
└── README.md       # This documentation
```

## Utils vs Lib

Understanding the distinction between `/utils` and `/lib`:

### `/lib` (Core Configurations)

- **Purpose**: Core application configurations and integrations
- **Examples**: Auth config, database connections, external service setup
- **Dependencies**: Often has external dependencies (Stripe, Auth providers)
- **Scope**: Application-wide infrastructure

### `/utils` (Pure Utilities)

- **Purpose**: Pure utility functions and helpers
- **Examples**: Formatters, validators, calculators, transformers
- **Dependencies**: Minimal dependencies, mostly pure functions
- **Scope**: Reusable logic that could work in any application

## Utility Categories

### Formatting Utilities (`/formatting`)

Data display and transformation functions:

- Currency formatting
- Date/time formatting
- Number formatting
- String manipulation
- Data serialization

### Validation Utilities (`/validation`)

Input validation and data verification:

- Email validation
- Phone number validation
- Payment card validation
- Form field validation
- Business rule validation

### Constants (`/constants`)

Application-wide constants and enums:

- Payment currencies
- Subscription statuses
- User roles
- Error codes
- Configuration values

### Helper Functions (`/helpers`)

General utility functions:

- Array manipulation
- Object operations
- Mathematical calculations
- Type guards
- Utility classes

## Usage Patterns

### Formatting Utilities

```typescript
import { formatCurrency, formatDate } from "@/utils/formatting";

export function ProductCard({ product }) {
  const price = formatCurrency(product.priceInCents, product.currency);
  const lastUpdated = formatDate(product.updatedAt, "short");

  return (
    <div>
      <h3>{product.name}</h3>
      <p>{price}</p>
      <small>Updated {lastUpdated}</small>
    </div>
  );
}
```

### Validation Utilities

```typescript
import { validateEmail, validatePaymentCard } from "@/utils/validation";

export function SignupForm() {
  const [email, setEmail] = useState("");
  const [errors, setErrors] = useState<string[]>([]);

  const handleEmailChange = (value: string) => {
    setEmail(value);

    const emailErrors = validateEmail(value);
    setErrors(emailErrors);
  };

  return (
    <form>
      <input
        type="email"
        value={email}
        onChange={(e) => handleEmailChange(e.target.value)}
      />
      {errors.map(error => (
        <div key={error} className="error">{error}</div>
      ))}
    </form>
  );
}
```

### Constants Usage

```typescript
import { SUPPORTED_CURRENCIES, SUBSCRIPTION_STATUS } from "@/utils/constants";

export function PricingTable() {
  return (
    <div>
      {SUPPORTED_CURRENCIES.map(currency => (
        <div key={currency.code}>
          {currency.name} ({currency.symbol})
        </div>
      ))}
    </div>
  );
}
```

## Implementation Guidelines

### 1. Pure Functions

Utilities should be pure functions when possible:

```typescript
// ✅ Good: Pure function
export function formatCurrency(amount: number, currency: string, locale = "en-US"): string {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency: currency.toUpperCase(),
  }).format(amount / 100);
}

// ❌ Bad: Side effects
let lastFormattedAmount = 0;
export function formatCurrency(amount: number, currency: string): string {
  lastFormattedAmount = amount; // Side effect
  return; // ... formatting logic
}
```

### 2. Type Safety

All utilities should be fully typed:

```typescript
export interface FormatDateOptions {
  style?: "full" | "long" | "medium" | "short";
  locale?: string;
  timeZone?: string;
}

export function formatDate(date: Date | string | number, options: FormatDateOptions = {}): string {
  const dateObj = new Date(date);

  if (isNaN(dateObj.getTime())) {
    throw new Error("Invalid date provided");
  }

  return dateObj.toLocaleDateString(options.locale, {
    dateStyle: options.style || "medium",
    timeZone: options.timeZone,
  });
}
```

### 3. Error Handling

Utilities should handle errors gracefully:

```typescript
export function parseAmount(input: string): number | null {
  if (!input || typeof input !== "string") {
    return null;
  }

  const cleaned = input.replace(/[^\d.-]/g, "");
  const parsed = parseFloat(cleaned);

  return isNaN(parsed) ? null : Math.round(parsed * 100);
}
```

### 4. Documentation

All utilities should be well-documented:

````typescript
/**
 * Validates an email address using RFC 5322 regex pattern
 *
 * @param email - The email address to validate
 * @returns Array of validation error messages (empty if valid)
 *
 * @example
 * ```typescript
 * const errors = validateEmail("user@example.com");
 * if (errors.length === 0) {
 *   console.log("Valid email");
 * }
 * ```
 */
export function validateEmail(email: string): string[] {
  const errors: string[] = [];

  if (!email) {
    errors.push("Email is required");
    return errors;
  }

  if (!emailRegex.test(email)) {
    errors.push("Invalid email format");
  }

  if (email.length > 254) {
    errors.push("Email too long");
  }

  return errors;
}
````

## Common Utility Examples

### Currency Formatting

```typescript
export function formatCurrency(
  amountInCents: number,
  currency: string,
  options: {
    locale?: string;
    showZeroDecimals?: boolean;
  } = {}
): string {
  const { locale = "en-US", showZeroDecimals = false } = options;

  const formatter = new Intl.NumberFormat(locale, {
    style: "currency",
    currency: currency.toUpperCase(),
    minimumFractionDigits: showZeroDecimals ? 2 : 0,
  });

  return formatter.format(amountInCents / 100);
}
```

### Date Formatting

```typescript
export function formatRelativeTime(date: Date | string): string {
  const now = new Date();
  const targetDate = new Date(date);
  const diffInMs = now.getTime() - targetDate.getTime();

  const units = [
    { name: "year", ms: 365 * 24 * 60 * 60 * 1000 },
    { name: "month", ms: 30 * 24 * 60 * 60 * 1000 },
    { name: "day", ms: 24 * 60 * 60 * 1000 },
    { name: "hour", ms: 60 * 60 * 1000 },
    { name: "minute", ms: 60 * 1000 },
  ];

  for (const unit of units) {
    const count = Math.floor(diffInMs / unit.ms);
    if (count > 0) {
      return `${count} ${unit.name}${count > 1 ? "s" : ""} ago`;
    }
  }

  return "Just now";
}
```

### Validation Helpers

```typescript
export function validatePaymentCard(cardNumber: string): {
  isValid: boolean;
  type: string | null;
  errors: string[];
} {
  const errors: string[] = [];
  const cleaned = cardNumber.replace(/\s/g, "");

  // Length validation
  if (cleaned.length < 13 || cleaned.length > 19) {
    errors.push("Card number must be between 13 and 19 digits");
  }

  // Luhn algorithm validation
  if (!luhnCheck(cleaned)) {
    errors.push("Invalid card number");
  }

  // Detect card type
  const type = detectCardType(cleaned);

  return {
    isValid: errors.length === 0,
    type,
    errors,
  };
}
```

### Array Utilities

```typescript
export function groupBy<T, K extends keyof T>(array: T[], key: K): Record<string, T[]> {
  return array.reduce(
    (groups, item) => {
      const groupKey = String(item[key]);
      groups[groupKey] = groups[groupKey] || [];
      groups[groupKey].push(item);
      return groups;
    },
    {} as Record<string, T[]>
  );
}

export function unique<T>(array: T[]): T[] {
  return [...new Set(array)];
}

export function chunk<T>(array: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
}
```

## Testing Strategy

### Unit Tests

All utilities should have comprehensive unit tests:

```typescript
import { formatCurrency } from "../formatting";

describe("formatCurrency", () => {
  it("should format USD correctly", () => {
    expect(formatCurrency(2050, "USD")).toBe("$20.50");
  });

  it("should handle zero amounts", () => {
    expect(formatCurrency(0, "USD")).toBe("$0");
  });

  it("should format different currencies", () => {
    expect(formatCurrency(1000, "EUR", { locale: "de-DE" })).toBe("10,00 €");
  });
});
```

### Property-Based Testing

For complex utilities, consider property-based testing:

```typescript
import { validateEmail } from "../validation";
import { fc } from "fast-check";

describe("validateEmail", () => {
  it("should accept valid email formats", () => {
    fc.assert(
      fc.property(fc.emailAddress(), (email) => {
        const errors = validateEmail(email);
        expect(errors).toHaveLength(0);
      })
    );
  });
});
```

## Performance Considerations

### 1. Memoization

For expensive computations:

```typescript
const memoizedFormatter = new Map<string, Intl.NumberFormat>();

export function formatCurrency(amount: number, currency: string, locale = "en-US"): string {
  const key = `${currency}-${locale}`;

  if (!memoizedFormatter.has(key)) {
    memoizedFormatter.set(
      key,
      new Intl.NumberFormat(locale, {
        style: "currency",
        currency: currency.toUpperCase(),
      })
    );
  }

  return memoizedFormatter.get(key)!.format(amount / 100);
}
```

### 2. Lazy Evaluation

For utilities that might not always be needed:

```typescript
let emailRegex: RegExp;

export function validateEmail(email: string): string[] {
  // Lazy load regex on first use
  if (!emailRegex) {
    emailRegex =
      /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
  }

  // ... validation logic
}
```

## Best Practices

1. **Keep functions small and focused** - One responsibility per function
2. **Use meaningful names** - Function names should clearly describe what they do
3. **Avoid side effects** - Prefer pure functions when possible
4. **Handle edge cases** - Always consider null, undefined, empty values
5. **Use TypeScript strictly** - Define clear input/output types
6. **Document thoroughly** - Use JSDoc for all public functions
7. **Test comprehensively** - Aim for high test coverage
8. **Consider performance** - Optimize for common use cases
9. **Make functions composable** - Design utilities to work well together
10. **Follow naming conventions** - Use consistent naming patterns

## Integration with Other Layers

### With Components

```typescript
import { formatCurrency } from "@/utils/formatting";
import { validateEmail } from "@/utils/validation";

export function PriceDisplay({ amount, currency }) {
  const formattedPrice = formatCurrency(amount, currency);
  return <span className="price">{formattedPrice}</span>;
}
```

### With Services

```typescript
import { validatePaymentCard } from "@/utils/validation";

export class PaymentService {
  async createPaymentIntent(data) {
    const cardValidation = validatePaymentCard(data.cardNumber);
    if (!cardValidation.isValid) {
      throw new Error(`Invalid card: ${cardValidation.errors.join(", ")}`);
    }

    // ... proceed with payment
  }
}
```

### With Hooks

```typescript
import { debounce } from "@/utils/helpers";

export function useSearch() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);

  const debouncedSearch = useMemo(
    () =>
      debounce(async (searchQuery) => {
        const results = await searchAPI(searchQuery);
        setResults(results);
      }, 300),
    []
  );

  useEffect(() => {
    if (query) {
      debouncedSearch(query);
    }
  }, [query, debouncedSearch]);

  return { query, setQuery, results };
}
```
