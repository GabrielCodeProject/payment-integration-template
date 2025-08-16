import { z } from 'zod';
import {
  createOrderSchema,
  updateOrderSchema,
  orderFilterSchema,
  orderSortSchema,
  createFulfillmentSchema,
  updateShippingSchema,
  createRefundSchema,
} from '../base/order';
import {
  cuidSchema,
  limitSchema,
  pageSchema,
  sortDirectionSchema,
} from '../base/common';

/**
 * Order Actions Validation Schemas
 * 
 * Server Action validation schemas for order management operations.
 * These schemas handle the complete order lifecycle from creation to fulfillment.
 */

// =============================================================================
// ORDER MANAGEMENT ACTIONS
// =============================================================================

/**
 * Create order action schema
 */
export const createOrderActionSchema = createOrderSchema.extend({
  autoCalculateTotals: z.boolean().default(true),
  validateInventory: z.boolean().default(true),
  sendConfirmationEmail: z.boolean().default(true),
});

/**
 * Update order action schema
 */
export const updateOrderActionSchema = updateOrderSchema.extend({
  notifyCustomer: z.boolean().default(false),
  reason: z.string().max(255, 'Reason must not exceed 255 characters').optional(),
});

/**
 * Cancel order action schema
 */
export const cancelOrderActionSchema = z.object({
  orderId: cuidSchema,
  reason: z.enum(['customer_request', 'inventory_unavailable', 'payment_failed', 'fraud', 'other']),
  refundAmount: z.number().min(0).optional(), // Partial refund
  restockItems: z.boolean().default(true),
  notifyCustomer: z.boolean().default(true),
  internalNotes: z.string().max(500).optional(),
});

/**
 * Get order by ID action schema
 */
export const getOrderByIdActionSchema = z.object({
  orderId: cuidSchema,
  includeItems: z.boolean().default(true),
  includeCustomer: z.boolean().default(true),
  includePayments: z.boolean().default(true),
  includeShipping: z.boolean().default(true),
});

/**
 * List orders action schema
 */
export const listOrdersActionSchema = z.object({
  filters: orderFilterSchema.optional(),
  sort: z.object({
    field: orderSortSchema,
    direction: sortDirectionSchema,
  }).optional(),
  pagination: z.object({
    page: pageSchema,
    limit: limitSchema,
  }).optional(),
  userId: cuidSchema.optional(), // Filter by specific user
});

/**
 * Search orders action schema
 */
export const searchOrdersActionSchema = z.object({
  query: z.string().max(255, 'Search query must not exceed 255 characters'),
  searchFields: z.array(z.enum(['orderNumber', 'customerEmail', 'customerName'])).default(['orderNumber', 'customerEmail']),
  filters: orderFilterSchema.optional(),
  pagination: z.object({
    page: pageSchema,
    limit: limitSchema,
  }).optional(),
});

// =============================================================================
// FULFILLMENT ACTIONS
// =============================================================================

/**
 * Create fulfillment action schema
 */
export const createFulfillmentActionSchema = createFulfillmentSchema.extend({
  autoUpdateStatus: z.boolean().default(true),
  sendTrackingEmail: z.boolean().default(true),
});

/**
 * Update shipping action schema
 */
export const updateShippingActionSchema = updateShippingSchema.extend({
  notifyCustomer: z.boolean().default(true),
});

/**
 * Mark as shipped action schema
 */
export const markAsShippedActionSchema = z.object({
  orderId: cuidSchema,
  trackingNumber: z.string().max(100).optional(),
  carrier: z.string().max(100).optional(),
  estimatedDelivery: z.date().optional(),
  notifyCustomer: z.boolean().default(true),
});

/**
 * Mark as delivered action schema
 */
export const markAsDeliveredActionSchema = z.object({
  orderId: cuidSchema,
  deliveredAt: z.date().optional(), // If not provided, uses current time
  signedBy: z.string().max(100).optional(),
  deliveryNotes: z.string().max(500).optional(),
  notifyCustomer: z.boolean().default(true),
});

// =============================================================================
// PAYMENT ACTIONS
// =============================================================================

/**
 * Process payment action schema
 */
export const processPaymentActionSchema = z.object({
  orderId: cuidSchema,
  paymentMethodId: cuidSchema.optional(),
  amount: z.number().min(0).optional(), // If not provided, charges full amount
  currency: z.string().length(3).optional(),
  savePaymentMethod: z.boolean().default(false),
});

/**
 * Refund order action schema
 */
export const refundOrderActionSchema = createRefundSchema.extend({
  notifyCustomer: z.boolean().default(true),
  reason: z.string().max(500).optional(),
});

/**
 * Capture payment action schema
 */
export const capturePaymentActionSchema = z.object({
  orderId: cuidSchema,
  amount: z.number().min(0).optional(), // Partial capture
});

// =============================================================================
// ORDER ANALYTICS ACTIONS
// =============================================================================

/**
 * Get order statistics action schema
 */
export const getOrderStatsActionSchema = z.object({
  period: z.enum(['today', 'yesterday', 'last_7_days', 'last_30_days', 'last_90_days', 'custom']),
  startDate: z.date().optional(),
  endDate: z.date().optional(),
  groupBy: z.enum(['hour', 'day', 'week', 'month']).default('day'),
  includeRefunds: z.boolean().default(true),
}).refine(
  (data) => {
    if (data.period === 'custom') {
      return data.startDate && data.endDate;
    }
    return true;
  },
  {
    message: 'Start date and end date are required for custom period',
    path: ['startDate'],
  }
);

/**
 * Get order conversion funnel action schema
 */
export const getOrderConversionFunnelActionSchema = z.object({
  period: z.enum(['last_7_days', 'last_30_days', 'last_90_days', 'custom']),
  startDate: z.date().optional(),
  endDate: z.date().optional(),
});

// =============================================================================
// BULK OPERATIONS ACTIONS
// =============================================================================

/**
 * Bulk update orders action schema
 */
export const bulkUpdateOrdersActionSchema = z.object({
  orderIds: z.array(cuidSchema).min(1).max(100),
  updates: z.object({
    status: z.enum(['PENDING', 'CONFIRMED', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED']).optional(),
    fulfillmentStatus: z.enum(['UNFULFILLED', 'PARTIALLY_FULFILLED', 'FULFILLED', 'RETURNED']).optional(),
    internalNotes: z.string().max(500).optional(),
  }).partial(),
  reason: z.string().max(255).optional(),
});

/**
 * Export orders action schema
 */
export const exportOrdersActionSchema = z.object({
  filters: orderFilterSchema.optional(),
  format: z.enum(['csv', 'json', 'xlsx']).default('csv'),
  includeItems: z.boolean().default(true),
  includeCustomerData: z.boolean().default(true),
  includePaymentData: z.boolean().default(false),
  maxRecords: z.number().int().min(1).max(10000).default(1000),
});

// =============================================================================
// RESPONSE SCHEMAS
// =============================================================================

export const orderActionSuccessSchema = z.object({
  success: z.literal(true),
  data: z.record(z.unknown()),
  message: z.string().optional(),
});

export const orderActionErrorSchema = z.object({
  success: z.literal(false),
  error: z.string(),
  code: z.enum([
    'ORDER_NOT_FOUND',
    'INVALID_STATUS_TRANSITION',
    'INSUFFICIENT_INVENTORY',
    'PAYMENT_REQUIRED',
    'PAYMENT_FAILED',
    'REFUND_FAILED',
    'FULFILLMENT_ERROR',
    'CUSTOMER_NOT_FOUND',
    'PERMISSION_DENIED',
  ]).optional(),
  details: z.record(z.unknown()).optional(),
});

export const orderActionResponseSchema = z.union([
  orderActionSuccessSchema,
  orderActionErrorSchema,
]);

// =============================================================================
// TYPE EXPORTS
// =============================================================================

export type CreateOrderAction = z.infer<typeof createOrderActionSchema>;
export type UpdateOrderAction = z.infer<typeof updateOrderActionSchema>;
export type CancelOrderAction = z.infer<typeof cancelOrderActionSchema>;
export type GetOrderByIdAction = z.infer<typeof getOrderByIdActionSchema>;
export type ListOrdersAction = z.infer<typeof listOrdersActionSchema>;
export type SearchOrdersAction = z.infer<typeof searchOrdersActionSchema>;
export type CreateFulfillmentAction = z.infer<typeof createFulfillmentActionSchema>;
export type UpdateShippingAction = z.infer<typeof updateShippingActionSchema>;
export type MarkAsShippedAction = z.infer<typeof markAsShippedActionSchema>;
export type MarkAsDeliveredAction = z.infer<typeof markAsDeliveredActionSchema>;
export type ProcessPaymentAction = z.infer<typeof processPaymentActionSchema>;
export type RefundOrderAction = z.infer<typeof refundOrderActionSchema>;
export type CapturePaymentAction = z.infer<typeof capturePaymentActionSchema>;
export type GetOrderStatsAction = z.infer<typeof getOrderStatsActionSchema>;
export type GetOrderConversionFunnelAction = z.infer<typeof getOrderConversionFunnelActionSchema>;
export type BulkUpdateOrdersAction = z.infer<typeof bulkUpdateOrdersActionSchema>;
export type ExportOrdersAction = z.infer<typeof exportOrdersActionSchema>;
export type OrderActionSuccess = z.infer<typeof orderActionSuccessSchema>;
export type OrderActionError = z.infer<typeof orderActionErrorSchema>;
export type OrderActionResponse = z.infer<typeof orderActionResponseSchema>;