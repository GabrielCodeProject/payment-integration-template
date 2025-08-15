import { z } from 'zod';
import {
  cuidSchema,
  emailSchema,
  nameSchema,
  priceSchema,
  currencySchema,
  orderNumberSchema,
  trackingNumberSchema,
  stripePaymentIntentIdSchema,
  stripeChargeIdSchema,
  addressSchema,
  metadataSchema,
  dateSchema,
  optionalDateSchema,
  positiveIntSchema,
} from './common';

/**
 * Order Validation Schemas
 * 
 * Comprehensive validation schemas for order management,
 * including order processing, fulfillment, and payment tracking.
 */

// =============================================================================
// ENUMS
// =============================================================================

/**
 * Order status validation
 */
export const orderStatusSchema = z.enum([
  'PENDING',
  'CONFIRMED',
  'PROCESSING',
  'SHIPPED',
  'DELIVERED',
  'CANCELLED',
  'REFUNDED',
], {
  errorMap: () => ({ message: 'Invalid order status' }),
});

/**
 * Payment status validation
 */
export const paymentStatusSchema = z.enum([
  'PENDING',
  'AUTHORIZED',
  'PAID',
  'PARTIALLY_PAID',
  'FAILED',
  'CANCELLED',
  'REFUNDED',
  'PARTIALLY_REFUNDED',
], {
  errorMap: () => ({ message: 'Invalid payment status' }),
});

/**
 * Fulfillment status validation
 */
export const fulfillmentStatusSchema = z.enum([
  'UNFULFILLED',
  'PARTIALLY_FULFILLED',
  'FULFILLED',
  'RETURNED',
], {
  errorMap: () => ({ message: 'Invalid fulfillment status' }),
});

// =============================================================================
// CORE ORDER SCHEMAS
// =============================================================================

/**
 * Base order schema - matches Prisma Order model
 */
export const orderSchema = z.object({
  id: cuidSchema,
  orderNumber: orderNumberSchema,
  
  // Customer information
  userId: cuidSchema.optional(),
  customerEmail: emailSchema,
  customerName: nameSchema.optional(),
  
  // Pricing
  subtotal: priceSchema,
  taxAmount: z.number().min(0, 'Tax amount must be non-negative').default(0),
  shippingAmount: z.number().min(0, 'Shipping amount must be non-negative').default(0),
  discountAmount: z.number().min(0, 'Discount amount must be non-negative').default(0),
  total: priceSchema,
  currency: currencySchema,
  
  // Order status and fulfillment
  status: orderStatusSchema.default('PENDING'),
  paymentStatus: paymentStatusSchema.default('PENDING'),
  fulfillmentStatus: fulfillmentStatusSchema.default('UNFULFILLED'),
  
  // Shipping information
  shippingAddress: z.union([addressSchema, z.null()]).optional(),
  billingAddress: z.union([addressSchema, z.null()]).optional(),
  shippingMethod: z.string().max(100, 'Shipping method must not exceed 100 characters').optional(),
  trackingNumber: trackingNumberSchema,
  
  // Payment information
  stripePaymentIntentId: stripePaymentIntentIdSchema,
  stripeChargeId: stripeChargeIdSchema,
  paymentMethodId: cuidSchema.optional(),
  
  // Discount codes
  discountCodeId: cuidSchema.optional(),
  
  // Notes and metadata
  notes: z.string().max(1000, 'Notes must not exceed 1000 characters').optional(),
  internalNotes: z.string().max(1000, 'Internal notes must not exceed 1000 characters').optional(),
  metadata: metadataSchema,
  
  // Timestamps
  createdAt: dateSchema,
  updatedAt: dateSchema,
  paidAt: optionalDateSchema,
  shippedAt: optionalDateSchema,
  deliveredAt: optionalDateSchema,
  cancelledAt: optionalDateSchema,
});

/**
 * Order item schema
 */
export const orderItemSchema = z.object({
  id: cuidSchema,
  orderId: cuidSchema,
  productId: cuidSchema,
  
  // Product snapshot at time of order
  productName: nameSchema,
  productSku: z.string().max(50, 'Product SKU must not exceed 50 characters').optional(),
  productImage: z.string().url('Invalid product image URL').optional(),
  
  // Pricing
  unitPrice: priceSchema,
  quantity: positiveIntSchema,
  totalPrice: priceSchema,
  
  // Metadata for product variants or customizations
  metadata: metadataSchema,
});

/**
 * Order creation schema
 */
export const createOrderSchema = z.object({
  customerEmail: emailSchema,
  customerName: nameSchema.optional(),
  userId: cuidSchema.optional(),
  
  // Items
  items: z.array(z.object({
    productId: cuidSchema,
    quantity: positiveIntSchema,
    unitPrice: priceSchema.optional(), // Optional, can be fetched from product
    metadata: metadataSchema,
  })).min(1, 'Order must contain at least one item'),
  
  // Pricing (calculated if not provided)
  subtotal: priceSchema.optional(),
  taxAmount: z.number().min(0, 'Tax amount must be non-negative').optional(),
  shippingAmount: z.number().min(0, 'Shipping amount must be non-negative').optional(),
  discountAmount: z.number().min(0, 'Discount amount must be non-negative').optional(),
  total: priceSchema.optional(),
  currency: currencySchema.optional(),
  
  // Addresses
  shippingAddress: addressSchema.optional(),
  billingAddress: addressSchema.optional(),
  shippingMethod: z.string().max(100, 'Shipping method must not exceed 100 characters').optional(),
  
  // Payment
  paymentMethodId: cuidSchema.optional(),
  stripePaymentIntentId: stripePaymentIntentIdSchema,
  
  // Discount
  discountCodeId: cuidSchema.optional(),
  discountCode: z.string().optional(), // Alternative to discountCodeId
  
  // Notes
  notes: z.string().max(1000, 'Notes must not exceed 1000 characters').optional(),
  metadata: metadataSchema,
}).superRefine((data, ctx) => {
  // Validate discount code usage
  if (data.discountCodeId && data.discountCode) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Cannot specify both discountCodeId and discountCode',
      path: ['discountCode'],
    });
  }
  
  // Validate total matches calculated amount if provided
  if (data.total && data.subtotal) {
    const calculatedTotal = data.subtotal + 
      (data.taxAmount ?? 0) + 
      (data.shippingAmount ?? 0) - 
      (data.discountAmount ?? 0);
    
    if (Math.abs(data.total - calculatedTotal) > 0.01) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Total does not match calculated amount',
        path: ['total'],
      });
    }
  }
});

/**
 * Order update schema
 */
export const updateOrderSchema = z.object({
  id: cuidSchema,
  status: orderStatusSchema.optional(),
  paymentStatus: paymentStatusSchema.optional(),
  fulfillmentStatus: fulfillmentStatusSchema.optional(),
  shippingMethod: z.string().max(100, 'Shipping method must not exceed 100 characters').optional(),
  trackingNumber: trackingNumberSchema.optional(),
  notes: z.string().max(1000, 'Notes must not exceed 1000 characters').optional(),
  internalNotes: z.string().max(1000, 'Internal notes must not exceed 1000 characters').optional(),
}).partial().required({ id: true });

/**
 * Order search/filter schema
 */
export const orderFilterSchema = z.object({
  customerEmail: z.string().optional(),
  userId: cuidSchema.optional(),
  status: orderStatusSchema.optional(),
  paymentStatus: paymentStatusSchema.optional(),
  fulfillmentStatus: fulfillmentStatusSchema.optional(),
  orderNumber: z.string().optional(),
  minTotal: z.number().min(0).optional(),
  maxTotal: z.number().min(0).optional(),
  createdAfter: optionalDateSchema,
  createdBefore: optionalDateSchema,
  paidAfter: optionalDateSchema,
  paidBefore: optionalDateSchema,
});

/**
 * Order sort options
 */
export const orderSortSchema = z.enum([
  'orderNumber',
  'createdAt',
  'updatedAt',
  'total',
  'status',
  'paymentStatus',
  'paidAt',
]);

// =============================================================================
// FULFILLMENT SCHEMAS
// =============================================================================

/**
 * Fulfillment creation schema
 */
export const createFulfillmentSchema = z.object({
  orderId: cuidSchema,
  items: z.array(z.object({
    orderItemId: cuidSchema,
    quantity: positiveIntSchema,
  })).min(1, 'Fulfillment must contain at least one item'),
  shippingMethod: z.string().max(100, 'Shipping method must not exceed 100 characters').optional(),
  trackingNumber: trackingNumberSchema.optional(),
  trackingUrl: z.string().url('Invalid tracking URL').optional(),
  notes: z.string().max(500, 'Notes must not exceed 500 characters').optional(),
});

/**
 * Shipping update schema
 */
export const updateShippingSchema = z.object({
  orderId: cuidSchema,
  trackingNumber: trackingNumberSchema,
  trackingUrl: z.string().url('Invalid tracking URL').optional(),
  shippedAt: optionalDateSchema,
  estimatedDelivery: optionalDateSchema,
  carrier: z.string().max(100, 'Carrier must not exceed 100 characters').optional(),
});

// =============================================================================
// PAYMENT SCHEMAS
// =============================================================================

/**
 * Payment update schema
 */
export const updatePaymentSchema = z.object({
  orderId: cuidSchema,
  paymentStatus: paymentStatusSchema,
  stripePaymentIntentId: stripePaymentIntentIdSchema.optional(),
  stripeChargeId: stripeChargeIdSchema.optional(),
  paidAt: optionalDateSchema,
  failureReason: z.string().max(255, 'Failure reason must not exceed 255 characters').optional(),
});

/**
 * Refund creation schema
 */
export const createRefundSchema = z.object({
  orderId: cuidSchema,
  amount: priceSchema.optional(), // If not provided, refund full amount
  reason: z.enum(['duplicate', 'fraudulent', 'requested_by_customer', 'other']),
  description: z.string().max(500, 'Description must not exceed 500 characters').optional(),
  refundShipping: z.boolean().default(false),
  items: z.array(z.object({
    orderItemId: cuidSchema,
    quantity: positiveIntSchema,
    reason: z.string().max(255, 'Item refund reason must not exceed 255 characters').optional(),
  })).optional(),
});

// =============================================================================
// ANALYTICS SCHEMAS
// =============================================================================

/**
 * Order analytics query schema
 */
export const orderAnalyticsSchema = z.object({
  startDate: dateSchema,
  endDate: dateSchema,
  groupBy: z.enum(['day', 'week', 'month', 'year']).default('day'),
  status: orderStatusSchema.optional(),
  paymentStatus: paymentStatusSchema.optional(),
});

/**
 * Sales report schema
 */
export const salesReportSchema = z.object({
  period: z.enum(['today', 'yesterday', 'last_7_days', 'last_30_days', 'last_90_days', 'custom']),
  startDate: optionalDateSchema,
  endDate: optionalDateSchema,
  groupBy: z.enum(['hour', 'day', 'week', 'month']).default('day'),
  includeRefunds: z.boolean().default(true),
}).superRefine((data, ctx) => {
  if (data.period === 'custom') {
    if (!data.startDate || !data.endDate) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Start date and end date are required for custom period',
        path: ['startDate'],
      });
    }
  }
});

// =============================================================================
// PUBLIC SCHEMAS (FOR API RESPONSES)
// =============================================================================

/**
 * Public order schema (for customer-facing APIs)
 */
export const publicOrderSchema = orderSchema.omit({
  internalNotes: true,
  stripePaymentIntentId: true,
  stripeChargeId: true,
  paymentMethodId: true,
});

/**
 * Order summary schema
 */
export const orderSummarySchema = z.object({
  id: cuidSchema,
  orderNumber: orderNumberSchema,
  status: orderStatusSchema,
  paymentStatus: paymentStatusSchema,
  fulfillmentStatus: fulfillmentStatusSchema,
  total: priceSchema,
  currency: currencySchema,
  itemCount: positiveIntSchema,
  createdAt: dateSchema,
  updatedAt: dateSchema,
});

/**
 * Order details schema
 */
export const orderDetailsSchema = publicOrderSchema.extend({
  items: z.array(orderItemSchema),
  statusHistory: z.array(z.object({
    status: orderStatusSchema,
    timestamp: dateSchema,
    note: z.string().optional(),
  })).default([]),
});

// =============================================================================
// ADMIN SCHEMAS
// =============================================================================

/**
 * Admin order update schema
 */
export const adminUpdateOrderSchema = z.object({
  id: cuidSchema,
  status: orderStatusSchema.optional(),
  paymentStatus: paymentStatusSchema.optional(),
  fulfillmentStatus: fulfillmentStatusSchema.optional(),
  internalNotes: z.string().max(1000, 'Internal notes must not exceed 1000 characters').optional(),
  priority: z.enum(['low', 'normal', 'high', 'urgent']).optional(),
  tags: z.array(z.string().max(50)).max(10).optional(),
}).partial().required({ id: true });

/**
 * Bulk order update schema
 */
export const bulkOrderUpdateSchema = z.object({
  orderIds: z.array(cuidSchema).min(1, 'At least one order is required'),
  updates: z.object({
    status: orderStatusSchema.optional(),
    fulfillmentStatus: fulfillmentStatusSchema.optional(),
    tags: z.array(z.string()).optional(),
  }).partial(),
});

// =============================================================================
// TYPE EXPORTS
// =============================================================================

export type Order = z.infer<typeof orderSchema>;
export type OrderItem = z.infer<typeof orderItemSchema>;
export type CreateOrder = z.infer<typeof createOrderSchema>;
export type UpdateOrder = z.infer<typeof updateOrderSchema>;
export type OrderStatus = z.infer<typeof orderStatusSchema>;
export type PaymentStatus = z.infer<typeof paymentStatusSchema>;
export type FulfillmentStatus = z.infer<typeof fulfillmentStatusSchema>;
export type OrderFilter = z.infer<typeof orderFilterSchema>;
export type OrderSort = z.infer<typeof orderSortSchema>;
export type CreateFulfillment = z.infer<typeof createFulfillmentSchema>;
export type UpdateShipping = z.infer<typeof updateShippingSchema>;
export type CreateRefund = z.infer<typeof createRefundSchema>;
export type PublicOrder = z.infer<typeof publicOrderSchema>;
export type OrderSummary = z.infer<typeof orderSummarySchema>;
export type OrderDetails = z.infer<typeof orderDetailsSchema>;