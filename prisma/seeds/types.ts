/**
 * Shared types for database seeding
 */

export interface SeedConfig {
  environment: 'development' | 'test' | 'staging';
  clearExistingData: boolean;
  skipAuditLogs: boolean;
  userCount: number;
  productCount: number;
  orderCount: number;
}

export interface SeedStats {
  users: number;
  products: number;
  orders: number;
  orderItems: number;
  subscriptions: number;
  paymentMethods: number;
  discountCodes: number;
  userDiscountCodes: number;
  auditLogs: number;
}

export interface UserSeedData {
  email: string;
  name: string;
  role: 'ADMIN' | 'SUPPORT' | 'CUSTOMER';
  password: string;
  stripeCustomerId?: string;
  phone?: string;
  timezone: string;
  preferredCurrency: string;
  twoFactorEnabled?: boolean;
  emailVerified?: boolean;
  isActive?: boolean;
}

export interface ProductSeedData {
  name: string;
  description: string;
  shortDescription?: string;
  price: number;
  currency: string;
  compareAtPrice?: number;
  sku: string;
  type: 'ONE_TIME' | 'SUBSCRIPTION' | 'USAGE_BASED';
  billingInterval?: 'DAY' | 'WEEK' | 'MONTH' | 'YEAR';
  isDigital: boolean;
  requiresShipping: boolean;
  stockQuantity?: number;
  isActive: boolean;
  tags: string[];
  images: string[];
  stripePriceId: string;
  stripeProductId: string;
}

export interface PaymentMethodSeedData {
  userId: string;
  stripePaymentMethodId: string;
  type: 'CARD' | 'BANK_ACCOUNT' | 'PAYPAL' | 'APPLE_PAY' | 'GOOGLE_PAY' | 'OTHER';
  brand?: string;
  last4?: string;
  expiryMonth?: number;
  expiryYear?: number;
  isDefault: boolean;
  nickname?: string;
  billingAddress?: Record<string, string | number | boolean>;
}

export interface OrderSeedData {
  orderNumber: string;
  userId: string;
  customerEmail: string;
  customerName: string;
  subtotal: number;
  taxAmount: number;
  shippingAmount: number;
  discountAmount: number;
  total: number;
  currency: string;
  status: 'PENDING' | 'CONFIRMED' | 'PROCESSING' | 'SHIPPED' | 'DELIVERED' | 'CANCELLED' | 'REFUNDED';
  paymentStatus: 'PENDING' | 'AUTHORIZED' | 'PAID' | 'PARTIALLY_PAID' | 'FAILED' | 'CANCELLED' | 'REFUNDED' | 'PARTIALLY_REFUNDED';
  fulfillmentStatus: 'UNFULFILLED' | 'PARTIALLY_FULFILLED' | 'FULFILLED' | 'RETURNED';
  items: Array<{
    productId: string;
    quantity: number;
    unitPrice: number;
    metadata?: Record<string, string | number | boolean>;
  }>;
  stripePaymentIntentId?: string;
  paymentMethodId?: string;
  discountCodeId?: string;
  shippingAddress?: Record<string, string | number | boolean>;
  billingAddress?: Record<string, string | number | boolean>;
  metadata?: Record<string, string | number | boolean>;
  createdDaysAgo: number;
  paidDaysAgo?: number;
  shippedDaysAgo?: number;
  deliveredDaysAgo?: number;
}

export interface DiscountCodeSeedData {
  code: string;
  name: string;
  description?: string;
  type: 'PERCENTAGE' | 'FIXED_AMOUNT' | 'FREE_SHIPPING';
  value: number;
  currency?: string;
  maxUses?: number | null;
  maxUsesPerCustomer?: number | null;
  currentUses: number;
  minimumOrderAmount?: number;
  startsAtDaysAgo?: number;
  expiresInDays?: number;
  isActive: boolean;
}

export interface SubscriptionSeedData {
  userId: string;
  productId: string;
  stripeSubscriptionId: string;
  stripeCustomerId: string;
  stripePriceId: string;
  status: 'INCOMPLETE' | 'INCOMPLETE_EXPIRED' | 'TRIALING' | 'ACTIVE' | 'PAST_DUE' | 'CANCELLED' | 'UNPAID' | 'PAUSED';
  billingInterval: 'DAY' | 'WEEK' | 'MONTH' | 'YEAR';
  unitPrice: number;
  quantity: number;
  currency: string;
  currentPeriodStartDaysAgo: number;
  currentPeriodEndDaysInFuture: number;
  trialStartDaysAgo?: number;
  trialEndDaysInFuture?: number;
  startedDaysAgo: number;
  cancelledDaysAgo?: number;
  endedDaysAgo?: number;
  cancelAtPeriodEnd: boolean;
  metadata?: Record<string, string | number | boolean>;
}