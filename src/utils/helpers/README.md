# Helper Utilities

General purpose helper functions for data manipulation, calculations, and common operations.

## Available Helpers

### Array Helpers

```typescript
import { groupBy, unique, chunk, sortBy } from "@/utils/helpers/array";

// Group array by property
const grouped = groupBy(payments, "status");
// { "succeeded": [...], "failed": [...] }

// Get unique values
const uniqueStatuses = unique(payments.map((p) => p.status));

// Chunk array into batches
const batches = chunk(largeArray, 10); // Groups of 10

// Sort by property
const sorted = sortBy(payments, "createdAt", "desc");
```

### Object Helpers

```typescript
import { pick, omit, deepMerge, isEmpty } from "@/utils/helpers/object";

// Pick specific properties
const subset = pick(user, ["id", "email", "name"]);

// Omit properties
const filtered = omit(user, ["password", "internalId"]);

// Deep merge objects
const merged = deepMerge(defaultConfig, userConfig);

// Check if empty
isEmpty({}); // true
isEmpty({ key: "value" }); // false
```

### String Helpers

```typescript
import { slugify, truncate, capitalize, mask } from "@/utils/helpers/string";

// Create URL-friendly slug
slugify("Hello World!"); // "hello-world"

// Truncate text
truncate("Long text here...", 10); // "Long tex..."

// Capitalize text
capitalize("hello world"); // "Hello World"

// Mask sensitive data
mask("4242424242424242", 4); // "************4242"
```

### Mathematical Helpers

```typescript
import { calculatePercentage, roundTo, clamp, random } from "@/utils/helpers/math";

// Calculate percentage
calculatePercentage(250, 1000); // 25

// Round to decimal places
roundTo(3.14159, 2); // 3.14

// Clamp value between min/max
clamp(150, 0, 100); // 100

// Generate random number
random(1, 100); // Random number between 1-100
```
