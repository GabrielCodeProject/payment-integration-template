# Components

This directory contains all React components for the Payment Integration Template, organized by
feature domain and component type for maximum scalability and maintainability.

## Directory Structure

```
src/components/
├── ui/             # Base UI components (shadcn/ui)
├── auth/           # Authentication-related components
├── payments/       # Payment processing components
├── subscriptions/  # Subscription management components
├── products/       # Product catalog components
├── layout/         # Layout and navigation components
├── forms/          # Reusable form components
├── common/         # Common utility components
└── README.md       # This documentation
```

## Architecture Principles

### 1. Feature-Based Organization

Components are organized by business domain rather than technical type:

- **Benefits**: Easier to locate related components
- **Scalability**: Easy to add new features without restructuring
- **Team collaboration**: Different teams can work on different feature areas

### 2. Component Hierarchy

```
Feature Components (Business Logic)
├── Layout Components (Structure)
├── Form Components (Data Input)
├── Common Components (Utilities)
└── UI Components (Base Design System)
```

### 3. Separation of Concerns

- **UI Components**: Pure presentation, no business logic
- **Feature Components**: Business logic, integrate with hooks/services
- **Layout Components**: Page structure and navigation
- **Form Components**: Data input and validation

### 4. Reusability Patterns

- **Composition over inheritance**
- **Props-based customization**
- **Render props and children patterns**
- **Generic components with TypeScript**

## Component Categories

### UI Components (`/ui`)

Base design system components (shadcn/ui):

- `Button` - All button variants
- `Input` - Form input fields
- `Card` - Content containers
- `Modal` - Dialog overlays
- `Badge` - Status indicators

### Auth Components (`/auth`)

Authentication and user management:

- `LoginForm` - User login interface
- `SignupForm` - User registration
- `UserProfile` - Profile display/edit
- `AuthGuard` - Route protection
- `SessionProvider` - Authentication context

### Payment Components (`/payments`)

Payment processing interfaces:

- `PaymentForm` - Payment input form
- `PaymentMethodCard` - Payment method display
- `TransactionList` - Transaction history
- `StripeProvider` - Stripe integration
- `CheckoutFlow` - Complete checkout process

### Subscription Components (`/subscriptions`)

Subscription management interfaces:

- `PlanSelector` - Subscription plan selection
- `BillingHistory` - Payment history
- `UsageDisplay` - Usage metrics
- `UpgradeFlow` - Plan upgrade process
- `CancelationFlow` - Subscription cancellation

### Product Components (`/products`)

Product catalog and shopping:

- `ProductCard` - Product display
- `ProductList` - Product grid/list
- `PriceDisplay` - Price formatting
- `ProductDetails` - Detailed product view
- `CategoryFilter` - Product filtering

### Layout Components (`/layout`)

Page structure and navigation:

- `Header` - Site header with navigation
- `Footer` - Site footer
- `Sidebar` - Side navigation
- `PageLayout` - Main page wrapper
- `DashboardLayout` - Dashboard structure

### Form Components (`/forms`)

Reusable form elements:

- `FormField` - Generic form field wrapper
- `FormSelect` - Select dropdown
- `FormCheckbox` - Checkbox input
- `FormValidation` - Validation display
- `FormSubmit` - Submit button with loading

### Common Components (`/common`)

Utility and shared components:

- `LoadingSpinner` - Loading indicators
- `ErrorBoundary` - Error handling
- `Toast` - Notification system
- `Pagination` - Data pagination
- `DataTable` - Generic data table

## Usage Patterns

### Component Import Organization

```typescript
// ✅ Good: Organized imports by category
import { Button, Input, Card } from "@/components/ui";
import { PaymentForm, TransactionList } from "@/components/payments";
import { useAuth } from "@/hooks/auth";
import { formatCurrency } from "@/utils/formatting";

export function CheckoutPage() {
  const { user } = useAuth();

  return (
    <Card>
      <h1>Checkout</h1>
      <PaymentForm customerId={user.id} />
      <TransactionList userId={user.id} />
    </Card>
  );
}
```

### Component Composition

```typescript
// Layout component with composition
export function DashboardLayout({ children, sidebar, header }) {
  return (
    <div className="dashboard-layout">
      {header && <Header>{header}</Header>}
      <div className="dashboard-content">
        {sidebar && <Sidebar>{sidebar}</Sidebar>}
        <main className="dashboard-main">
          {children}
        </main>
      </div>
    </div>
  );
}

// Usage with composition
export function PaymentDashboard() {
  return (
    <DashboardLayout
      header={<DashboardHeader />}
      sidebar={<PaymentSidebar />}
    >
      <PaymentMetrics />
      <TransactionList />
    </DashboardLayout>
  );
}
```

### Props-Based Customization

```typescript
interface PaymentFormProps {
  amount?: number;
  currency?: string;
  customerId: string;
  onSuccess?: (payment: Payment) => void;
  onError?: (error: Error) => void;
  showSaveCard?: boolean;
  allowedPaymentMethods?: PaymentMethod[];
}

export function PaymentForm({
  amount,
  currency = "USD",
  customerId,
  onSuccess,
  onError,
  showSaveCard = true,
  allowedPaymentMethods = ["card", "bank_transfer"],
}: PaymentFormProps) {
  // Component implementation
}
```

## Implementation Guidelines

### 1. Component Structure

```typescript
// Standard component structure
import { useState, useCallback } from "react";
import { cn } from "@/lib/utils";

interface ComponentProps {
  className?: string;
  // ... other props
}

export function Component({ className, ...props }: ComponentProps) {
  // Component logic

  return (
    <div className={cn("default-classes", className)}>
      {/* Component JSX */}
    </div>
  );
}

// Export types for external use
export type { ComponentProps };
```

### 2. TypeScript Interfaces

```typescript
// Shared component interfaces
export interface BaseComponentProps {
  className?: string;
  children?: React.ReactNode;
  id?: string;
  testId?: string;
}

export interface FormComponentProps extends BaseComponentProps {
  label?: string;
  error?: string;
  required?: boolean;
  disabled?: boolean;
}

export interface PaymentComponentProps extends BaseComponentProps {
  amount: number;
  currency: string;
  customerId: string;
}
```

### 3. Error Boundaries

```typescript
export class ComponentErrorBoundary extends React.Component<
  { children: React.ReactNode; fallback?: React.ComponentType<any> },
  { hasError: boolean; error?: Error }
> {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("Component error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      const FallbackComponent = this.props.fallback || DefaultErrorFallback;
      return <FallbackComponent error={this.state.error} />;
    }

    return this.props.children;
  }
}
```

### 4. Performance Optimization

```typescript
import { memo, useMemo, useCallback } from "react";

// Memoized component for expensive renders
export const ExpensiveComponent = memo(function ExpensiveComponent({
  data,
  onAction
}: {
  data: LargeDataSet[];
  onAction: (id: string) => void;
}) {
  // Memoize expensive calculations
  const processedData = useMemo(() => {
    return data.map(item => ({
      ...item,
      computed: expensiveCalculation(item)
    }));
  }, [data]);

  // Memoize callbacks to prevent child re-renders
  const handleAction = useCallback((id: string) => {
    onAction(id);
  }, [onAction]);

  return (
    <div>
      {processedData.map(item => (
        <ChildComponent
          key={item.id}
          data={item}
          onAction={handleAction}
        />
      ))}
    </div>
  );
});
```

## Testing Strategy

### Component Testing

```typescript
import { render, screen, fireEvent } from "@testing-library/react";
import { PaymentForm } from "../PaymentForm";

describe("PaymentForm", () => {
  const defaultProps = {
    amount: 2000,
    currency: "USD",
    customerId: "cust_123"
  };

  it("should render payment form", () => {
    render(<PaymentForm {...defaultProps} />);

    expect(screen.getByText("Payment Details")).toBeInTheDocument();
    expect(screen.getByText("$20.00")).toBeInTheDocument();
  });

  it("should handle form submission", async () => {
    const onSuccess = jest.fn();
    render(<PaymentForm {...defaultProps} onSuccess={onSuccess} />);

    fireEvent.click(screen.getByText("Pay Now"));

    await screen.findByText("Payment Successful");
    expect(onSuccess).toHaveBeenCalled();
  });
});
```

### Integration Testing

```typescript
import { render, screen } from "@testing-library/react";
import { CheckoutFlow } from "../CheckoutFlow";
import { TestProviders } from "@/test-utils";

describe("CheckoutFlow Integration", () => {
  it("should complete full checkout process", async () => {
    render(
      <TestProviders>
        <CheckoutFlow productId="prod_123" />
      </TestProviders>
    );

    // Test complete flow
    expect(screen.getByText("Product Details")).toBeInTheDocument();

    fireEvent.click(screen.getByText("Add to Cart"));
    expect(screen.getByText("Proceed to Checkout")).toBeInTheDocument();

    fireEvent.click(screen.getByText("Proceed to Checkout"));
    expect(screen.getByText("Payment Information")).toBeInTheDocument();
  });
});
```

### Visual Testing

```typescript
import { render } from "@testing-library/react";
import { axe, toHaveNoViolations } from "jest-axe";
import { PaymentCard } from "../PaymentCard";

expect.extend(toHaveNoViolations);

describe("PaymentCard Accessibility", () => {
  it("should have no accessibility violations", async () => {
    const { container } = render(
      <PaymentCard
        last4="1234"
        brand="visa"
        expiryMonth={12}
        expiryYear={2025}
      />
    );

    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
```

## Styling Patterns

### Tailwind CSS with CVA

```typescript
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/90",
        destructive: "bg-destructive text-destructive-foreground hover:bg-destructive/90",
        outline: "border border-input hover:bg-accent hover:text-accent-foreground",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-9 rounded-md px-3",
        lg: "h-11 rounded-md px-8",
      }
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    }
  }
);

interface ButtonProps extends
  React.ButtonHTMLAttributes<HTMLButtonElement>,
  VariantProps<typeof buttonVariants> {
  loading?: boolean;
}

export function Button({
  className,
  variant,
  size,
  loading,
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      className={cn(buttonVariants({ variant, size, className }))}
      disabled={loading || props.disabled}
      {...props}
    >
      {loading && <LoadingSpinner className="mr-2 h-4 w-4" />}
      {children}
    </button>
  );
}
```

### CSS Modules (Alternative)

```typescript
import styles from "./PaymentCard.module.css";
import { cn } from "@/lib/utils";

interface PaymentCardProps {
  className?: string;
  variant?: "default" | "selected" | "disabled";
}

export function PaymentCard({ className, variant = "default" }: PaymentCardProps) {
  return (
    <div className={cn(
      styles.card,
      styles[variant],
      className
    )}>
      {/* Card content */}
    </div>
  );
}
```

## Best Practices

### 1. Component Naming

- **PascalCase** for component names
- **Descriptive names** that indicate purpose
- **Domain prefixes** for feature-specific components

```typescript
// ✅ Good naming
export function PaymentMethodCard() {}
export function SubscriptionPlanSelector() {}
export function UserProfileForm() {}

// ❌ Bad naming
export function Card() {} // Too generic
export function PMC() {} // Abbreviations
export function paymentForm() {} // Wrong case
```

### 2. Props Interface Design

```typescript
// ✅ Good: Clear, typed props
interface ProductCardProps {
  product: Product;
  onAddToCart: (productId: string) => void;
  showPrice?: boolean;
  size?: "small" | "medium" | "large";
  className?: string;
}

// ❌ Bad: Unclear props
interface ProductCardProps {
  data: any;
  onClick: () => void;
  flag?: boolean;
}
```

### 3. Component Size

- **Small components**: Single responsibility
- **Medium components**: Feature-specific functionality
- **Large components**: Page-level composition

```typescript
// ✅ Good: Small, focused component
export function PriceDisplay({ amount, currency }: PriceDisplayProps) {
  const formattedPrice = formatCurrency(amount, currency);
  return <span className="price">{formattedPrice}</span>;
}

// ❌ Bad: Component doing too much
export function ProductEverything({ product }: ProductEverythingProps) {
  // Handles product display, cart logic, wishlist, reviews, etc.
  // This should be broken into smaller components
}
```

### 4. State Management

- **Local state** for component-specific state
- **Context** for feature-wide state
- **Global store** for application-wide state

```typescript
// Local state example
export function PaymentForm() {
  const [cardNumber, setCardNumber] = useState("");
  const [errors, setErrors] = useState<string[]>([]);

  // Component logic
}

// Context example
const PaymentContext = createContext<PaymentContextValue | null>(null);

export function PaymentProvider({ children }: { children: React.ReactNode }) {
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);

  return (
    <PaymentContext.Provider value={{ paymentMethods, setPaymentMethods }}>
      {children}
    </PaymentContext.Provider>
  );
}
```

## Performance Guidelines

1. **Use React.memo** for components that receive the same props frequently
2. **Implement useMemo** for expensive calculations
3. **Use useCallback** for functions passed to child components
4. **Lazy load** components that aren't immediately needed
5. **Code splitting** for large feature components
6. **Optimize images** and other assets
7. **Minimize prop drilling** with context when appropriate

## Accessibility

1. **Semantic HTML** - Use appropriate HTML elements
2. **ARIA attributes** - Add proper ARIA labels and roles
3. **Keyboard navigation** - Ensure all interactive elements are keyboard accessible
4. **Screen reader support** - Test with screen readers
5. **Color contrast** - Ensure sufficient contrast ratios
6. **Focus management** - Proper focus handling for modals and forms

```typescript
export function AccessibleButton({
  children,
  onClick,
  disabled,
  loading,
  ...props
}: AccessibleButtonProps) {
  return (
    <button
      onClick={onClick}
      disabled={disabled || loading}
      aria-disabled={disabled || loading}
      aria-label={loading ? "Loading..." : undefined}
      {...props}
    >
      {loading ? (
        <>
          <span aria-hidden="true">
            <LoadingSpinner />
          </span>
          <span className="sr-only">Loading...</span>
        </>
      ) : (
        children
      )}
    </button>
  );
}
```

This component organization provides a scalable foundation for building complex payment integration
features while maintaining code quality and developer experience.
