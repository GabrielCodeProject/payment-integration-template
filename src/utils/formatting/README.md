# Formatting Utilities

Data formatting utilities for currency, dates, numbers, and other display formats used throughout
the payment integration application.

## Available Utilities

### Currency Formatting

```typescript
import {
  formatCurrency,
  formatCurrencyRange,
  parseCurrencyInput,
} from "@/utils/formatting/currency";

// Format currency amounts
formatCurrency(2050, "USD"); // "$20.50"
formatCurrency(1000, "EUR", { locale: "de-DE" }); // "10,00 €"

// Format currency ranges
formatCurrencyRange(1000, 5000, "USD"); // "$10.00 - $50.00"

// Parse user input
parseCurrencyInput("$20.50"); // 2050 (in cents)
```

### Date Formatting

```typescript
import { formatDate, formatRelativeTime, formatDateRange } from "@/utils/formatting/date";

// Format dates
formatDate(new Date(), { style: "medium" }); // "Jan 15, 2024"
formatRelativeTime(new Date(Date.now() - 3600000)); // "1 hour ago"

// Format date ranges
formatDateRange(startDate, endDate); // "Jan 15 - Feb 20, 2024"
```

### Number Formatting

```typescript
import { formatNumber, formatPercentage, formatBytes } from "@/utils/formatting/number";

// Format numbers
formatNumber(1234567); // "1,234,567"
formatPercentage(0.1234); // "12.34%"
formatBytes(1024000); // "1.02 MB"
```
