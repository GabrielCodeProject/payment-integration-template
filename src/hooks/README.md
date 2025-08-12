# React Hooks

This directory contains custom React hooks for the Payment Integration Template. Hooks provide
reusable stateful logic and integrate UI components with the services layer.

## Directory Structure

```
src/hooks/
├── auth/           # Authentication-related hooks
├── payments/       # Payment processing hooks
├── subscriptions/  # Subscription management hooks
├── products/       # Product catalog hooks
├── common/         # Common utility hooks
└── README.md       # This documentation
```

## Architecture Principles

### 1. Service Integration

Hooks act as the bridge between React components and business services:

- Consume services from `/services` layer
- Provide React-friendly interfaces
- Handle loading states and error handling
- Manage local component state

### 2. Reusability

Hooks are designed for maximum reusability:

- Domain-specific hooks for different features
- Common hooks for shared functionality
- Composable hook patterns
- Clean separation of concerns

### 3. TypeScript First

All hooks are fully typed:

- Generic hooks where appropriate
- Proper return type definitions
- Input parameter validation
- Error type safety

### 4. Performance Optimized

Hooks are optimized for React performance:

- Proper dependency arrays
- Memoization where beneficial
- Efficient state updates
- Minimal re-renders

## Hook Categories

### Auth Hooks (`/auth`)

User authentication and session management:

- `useAuth()` - Current user session
- `useLogin()` - Login form handling
- `useLogout()` - Logout functionality
- `useSession()` - Session state management

### Payment Hooks (`/payments`)

Payment processing and transaction management:

- `usePayments()` - Payment creation and processing
- `usePaymentMethods()` - Payment method management
- `useStripe()` - Stripe integration
- `useTransactions()` - Transaction history

### Subscription Hooks (`/subscriptions`)

Subscription lifecycle management:

- `useSubscriptions()` - Subscription state
- `useSubscriptionPlans()` - Available plans
- `useBilling()` - Billing information
- `useUsage()` - Usage tracking

### Product Hooks (`/products`)

Product catalog and pricing:

- `useProducts()` - Product listing
- `usePricing()` - Price calculations
- `useFeatures()` - Feature availability
- `useCart()` - Shopping cart state

### Common Hooks (`/common`)

Shared utility hooks:

- `useAsync()` - Async operation handling
- `useLocalStorage()` - Local storage integration
- `useDebounce()` - Input debouncing
- `useApi()` - Generic API calls

## Usage Patterns

### Basic Hook Usage

```typescript
import { useAuth } from "@/hooks/auth";
import { usePayments } from "@/hooks/payments";

export function CheckoutForm() {
  const { user, isAuthenticated } = useAuth();
  const { createPayment, loading, error } = usePayments();

  const handleSubmit = async (formData) => {
    if (!isAuthenticated) return;

    try {
      await createPayment({
        amount: formData.amount,
        currency: "usd",
        customerId: user.id
      });
    } catch (error) {
      // Error handled by hook
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      {/* Form content */}
      <button disabled={loading}>
        {loading ? "Processing..." : "Pay Now"}
      </button>
      {error && <div className="error">{error.message}</div>}
    </form>
  );
}
```

### Hook Composition

```typescript
import { useAuth } from "@/hooks/auth";
import { usePayments } from "@/hooks/payments";
import { useSubscriptions } from "@/hooks/subscriptions";

export function useCheckout() {
  const { user } = useAuth();
  const { createPayment } = usePayments();
  const { subscriptions } = useSubscriptions();

  const processCheckout = useCallback(
    async (data) => {
      // Combine multiple hooks for complex operations
      const hasActiveSubscription = subscriptions.some((s) => s.status === "active");

      if (hasActiveSubscription) {
        // Handle subscription upgrade
      } else {
        // Handle new subscription
      }

      return await createPayment(data);
    },
    [createPayment, subscriptions]
  );

  return { processCheckout };
}
```

## Implementation Guidelines

### 1. Standard Hook Structure

```typescript
export function usePayments() {
  const [state, setState] = useState<PaymentState>({
    loading: false,
    error: null,
    payments: [],
  });

  const service = useMemo(() => new PaymentService(), []);

  const createPayment = useCallback(
    async (data: CreatePaymentData) => {
      setState((prev) => ({ ...prev, loading: true, error: null }));

      try {
        const result = await service.createPaymentIntent(data);
        setState((prev) => ({
          ...prev,
          loading: false,
          payments: [...prev.payments, result],
        }));
        return result;
      } catch (error) {
        setState((prev) => ({ ...prev, loading: false, error }));
        throw error;
      }
    },
    [service]
  );

  return {
    ...state,
    createPayment,
  };
}
```

### 2. State Management Patterns

```typescript
// Using useReducer for complex state
const [state, dispatch] = useReducer(paymentReducer, initialState);

// Using Zustand for global state
const usePaymentStore = create<PaymentStore>()((set) => ({
  payments: [],
  addPayment: (payment) =>
    set((state) => ({
      payments: [...state.payments, payment],
    })),
}));
```

### 3. Error Handling

```typescript
export function useAsyncOperation<T>(operation: () => Promise<T>) {
  const [state, setState] = useState<AsyncState<T>>({
    loading: false,
    error: null,
    data: null,
  });

  const execute = useCallback(async () => {
    setState({ loading: true, error: null, data: null });

    try {
      const data = await operation();
      setState({ loading: false, error: null, data });
      return data;
    } catch (error) {
      setState({ loading: false, error, data: null });
      throw error;
    }
  }, [operation]);

  return { ...state, execute };
}
```

### 4. TypeScript Interfaces

```typescript
export interface UsePaymentsReturn {
  payments: Payment[];
  loading: boolean;
  error: Error | null;
  createPayment: (data: CreatePaymentData) => Promise<Payment>;
  refetch: () => Promise<void>;
}

export interface CreatePaymentData {
  amount: number;
  currency: string;
  customerId?: string;
  metadata?: Record<string, string>;
}
```

## Testing Strategy

### Hook Testing with React Testing Library

```typescript
import { renderHook, act } from "@testing-library/react";
import { usePayments } from "../usePayments";

describe("usePayments", () => {
  it("should create payment successfully", async () => {
    const { result } = renderHook(() => usePayments());

    await act(async () => {
      await result.current.createPayment({
        amount: 2000,
        currency: "usd",
      });
    });

    expect(result.current.loading).toBe(false);
    expect(result.current.payments).toHaveLength(1);
  });

  it("should handle payment errors", async () => {
    const { result } = renderHook(() => usePayments());

    await act(async () => {
      try {
        await result.current.createPayment({
          amount: -100, // Invalid amount
          currency: "usd",
        });
      } catch (error) {
        // Expected error
      }
    });

    expect(result.current.error).toBeDefined();
  });
});
```

### Integration Testing

```typescript
import { render, screen, fireEvent } from "@testing-library/react";
import { CheckoutForm } from "../CheckoutForm";

describe("CheckoutForm Integration", () => {
  it("should complete payment flow", async () => {
    render(<CheckoutForm />);

    fireEvent.change(screen.getByLabelText("Amount"), {
      target: { value: "20.00" }
    });

    fireEvent.click(screen.getByText("Pay Now"));

    await screen.findByText("Payment Successful");
  });
});
```

## Best Practices

### 1. Dependency Management

```typescript
// ✅ Good: Stable dependencies
const service = useMemo(() => new PaymentService(), []);

// ❌ Bad: Recreating service on every render
const service = new PaymentService();
```

### 2. State Updates

```typescript
// ✅ Good: Functional updates
setState((prev) => ({ ...prev, loading: false }));

// ❌ Bad: Direct state mutation
state.loading = false;
setState(state);
```

### 3. Error Boundaries

```typescript
export function PaymentProvider({ children }) {
  return (
    <ErrorBoundary fallback={<PaymentError />}>
      {children}
    </ErrorBoundary>
  );
}
```

### 4. Loading States

```typescript
export function usePayments() {
  const [operations, setOperations] = useState<Set<string>>(new Set());

  const setLoading = (operation: string, loading: boolean) => {
    setOperations((prev) => {
      const next = new Set(prev);
      if (loading) {
        next.add(operation);
      } else {
        next.delete(operation);
      }
      return next;
    });
  };

  const loading = operations.size > 0;

  return { loading, setLoading };
}
```

## Common Patterns

### 1. Data Fetching Hook

```typescript
export function useQuery<T>(key: string, fetcher: () => Promise<T>) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    fetcher()
      .then(setData)
      .catch(setError)
      .finally(() => setLoading(false));
  }, [key]);

  return { data, loading, error };
}
```

### 2. Form Hook

```typescript
export function useForm<T>(initialValues: T, validation?: (values: T) => Record<string, string>) {
  const [values, setValues] = useState(initialValues);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleChange = (name: keyof T, value: T[keyof T]) => {
    setValues((prev) => ({ ...prev, [name]: value }));

    if (validation) {
      const newErrors = validation({ ...values, [name]: value });
      setErrors(newErrors);
    }
  };

  return { values, errors, handleChange };
}
```

### 3. API Hook

```typescript
export function useApi<T>(endpoint: string, options?: RequestInit) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(false);

  const execute = useCallback(
    async (body?: any) => {
      setLoading(true);

      try {
        const response = await fetch(endpoint, {
          ...options,
          body: body ? JSON.stringify(body) : undefined,
          headers: {
            "Content-Type": "application/json",
            ...options?.headers,
          },
        });

        const result = await response.json();
        setData(result);
        return result;
      } finally {
        setLoading(false);
      }
    },
    [endpoint, options]
  );

  return { data, loading, execute };
}
```

## Performance Considerations

1. **Memoization**: Use `useMemo` and `useCallback` appropriately
2. **Debouncing**: Implement debouncing for user input
3. **Caching**: Cache expensive computations and API calls
4. **Lazy Loading**: Load data only when needed
5. **State Normalization**: Use normalized state for complex data

## Integration with Services

Hooks should always consume services rather than making direct API calls:

```typescript
// ✅ Good: Using service layer
import { PaymentService } from "@/services/payments";

export function usePayments() {
  const service = useMemo(() => new PaymentService(), []);
  // Use service methods
}

// ❌ Bad: Direct API calls
export function usePayments() {
  const createPayment = async (data) => {
    const response = await fetch("/api/payments", {
      method: "POST",
      body: JSON.stringify(data),
    });
    // Direct API handling
  };
}
```

This separation ensures:

- Business logic stays in services
- Hooks focus on React state management
- Services can be tested independently
- Better code organization and reusability
