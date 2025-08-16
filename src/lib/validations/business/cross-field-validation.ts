import { z } from 'zod';
import {
  cuidSchema,
  emailSchema,
  priceSchema,
  currencySchema,
  addressSchema,
} from '../base/common';

/**
 * Cross-Field Validation Schemas
 * 
 * Business logic validation that requires checking relationships
 * between multiple fields, entities, or external conditions.
 */

// =============================================================================
// ORDER VALIDATION WITH CROSS-FIELD RULES
// =============================================================================

/**
 * Order cross-field validation
 */
export const orderCrossFieldValidationSchema = z.object({
  // Basic order data
  userId: cuidSchema.optional(),
  customerEmail: emailSchema,
  
  // Items and pricing
  items: z.array(z.object({
    productId: cuidSchema,
    quantity: z.number().int().min(1),
    unitPrice: priceSchema,
    totalPrice: priceSchema,
  })).min(1, 'Order must contain at least one item'),
  
  subtotal: priceSchema,
  taxAmount: z.number().min(0).default(0),
  shippingAmount: z.number().min(0).default(0),
  discountAmount: z.number().min(0).default(0),
  total: priceSchema,
  currency: currencySchema,
  
  // Addresses
  billingAddress: addressSchema,
  shippingAddress: addressSchema.optional(),
  
  // Payment
  paymentMethodId: cuidSchema.optional(),
  
  // Discount
  discountCodeId: cuidSchema.optional(),
  discountCode: z.string().optional(),
  
}).superRefine(async (data, ctx) => {
  // Cross-field Rule 1: Total calculation validation
  const calculatedSubtotal = data.items.reduce((sum, item) => sum + item.totalPrice, 0);
  if (Math.abs(calculatedSubtotal - data.subtotal) > 0.01) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Subtotal does not match sum of item totals',
      path: ['subtotal'],
    });
  }
  
  // Cross-field Rule 2: Item total price validation
  data.items.forEach((item, index) => {
    const calculatedTotal = item.unitPrice * item.quantity;
    if (Math.abs(calculatedTotal - item.totalPrice) > 0.01) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Item total price does not match unit price × quantity',
        path: ['items', index, 'totalPrice'],
      });
    }
  });
  
  // Cross-field Rule 3: Final total validation
  const calculatedTotal = data.subtotal + data.taxAmount + data.shippingAmount - data.discountAmount;
  if (Math.abs(calculatedTotal - data.total) > 0.01) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Total does not match calculated amount (subtotal + tax + shipping - discount)',
      path: ['total'],
    });
  }
  
  // Cross-field Rule 4: Shipping address validation
  if (!data.shippingAddress) {
    // Check if any items require shipping
    const requiresShipping = data.items.some(_item => {
      // This would typically check product properties from database
      // For now, assume all items require shipping unless proven otherwise
      return true;
    });
    
    if (requiresShipping) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Shipping address required for physical products',
        path: ['shippingAddress'],
      });
    }
  }
  
  // Cross-field Rule 5: Discount code mutual exclusivity
  if (data.discountCodeId && data.discountCode) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Cannot specify both discount code ID and discount code string',
      path: ['discountCode'],
    });
  }
  
  // Cross-field Rule 6: Email and user consistency
  if (data.userId) {
    // In a real implementation, you'd check if the email matches the user's email
    // This is a placeholder for that business logic
  }
  
  // Cross-field Rule 7: International shipping validation
  if (data.shippingAddress && data.billingAddress.country !== data.shippingAddress.country) {
    // International shipping - validate additional requirements
    if (data.shippingAmount === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'International shipping requires shipping charges',
        path: ['shippingAmount'],
      });
    }
  }
});

// =============================================================================
// USER REGISTRATION CROSS-FIELD VALIDATION
// =============================================================================

/**
 * User registration cross-field validation
 */
export const userRegistrationCrossFieldSchema = z.object({
  email: emailSchema,
  password: z.string().min(8),
  confirmPassword: z.string(),
  name: z.string().min(1).max(100).optional(),
  phone: z.string().optional(),
  
  // Address information
  billingAddress: addressSchema.optional(),
  
  // Marketing preferences
  marketingOptIn: z.boolean().default(false),
  smsOptIn: z.boolean().default(false),
  
  // Terms and conditions
  agreeToTerms: z.boolean(),
  agreeToPrivacy: z.boolean(),
  
  // Referral
  referralCode: z.string().optional(),
  
}).superRefine(async (data, ctx) => {
  // Cross-field Rule 1: Password confirmation
  if (data.password !== data.confirmPassword) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Passwords do not match',
      path: ['confirmPassword'],
    });
  }
  
  // Cross-field Rule 2: Terms agreement validation
  if (!data.agreeToTerms) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'You must agree to the terms and conditions',
      path: ['agreeToTerms'],
    });
  }
  
  if (!data.agreeToPrivacy) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'You must agree to the privacy policy',
      path: ['agreeToPrivacy'],
    });
  }
  
  // Cross-field Rule 3: SMS opt-in requires phone number
  if (data.smsOptIn && !data.phone) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Phone number required for SMS notifications',
      path: ['phone'],
    });
  }
  
  // Cross-field Rule 4: Business email domain validation
  const businessDomains = ['company.com', 'business.org']; // Example
  const emailDomain = data.email.split('@')[1];
  
  if (businessDomains.includes(emailDomain) && !data.billingAddress) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Business accounts require billing address',
      path: ['billingAddress'],
    });
  }
});

// =============================================================================
// SUBSCRIPTION CROSS-FIELD VALIDATION
// =============================================================================

/**
 * Subscription cross-field validation
 */
export const subscriptionCrossFieldSchema = z.object({
  userId: cuidSchema,
  productId: cuidSchema,
  paymentMethodId: cuidSchema,
  
  // Pricing
  unitPrice: priceSchema,
  quantity: z.number().int().min(1).default(1),
  currency: currencySchema,
  
  // Billing configuration
  billingInterval: z.enum(['DAY', 'WEEK', 'MONTH', 'YEAR']),
  billingCycleAnchor: z.date().optional(),
  
  // Trial configuration
  trialPeriodDays: z.number().int().min(0).optional(),
  trialEnd: z.date().optional(),
  
  // Discount
  discountCodeId: cuidSchema.optional(),
  couponId: z.string().optional(),
  
  // User context
  userAccountAge: z.number().int().min(0).default(0), // days
  existingSubscriptionsCount: z.number().int().min(0).default(0),
  
}).superRefine(async (data, ctx) => {
  // Cross-field Rule 1: Trial configuration mutual exclusivity
  if (data.trialPeriodDays && data.trialEnd) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Cannot specify both trial period days and trial end date',
      path: ['trialEnd'],
    });
  }
  
  // Cross-field Rule 2: Billing cycle anchor validation
  if (data.billingCycleAnchor) {
    const now = new Date();
    if (data.billingCycleAnchor <= now) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Billing cycle anchor must be in the future',
        path: ['billingCycleAnchor'],
      });
    }
  }
  
  // Cross-field Rule 3: Trial end date validation
  if (data.trialEnd) {
    const now = new Date();
    if (data.trialEnd <= now) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Trial end date must be in the future',
        path: ['trialEnd'],
      });
    }
    
    // Trial period should not be too long
    const maxTrialDays = 90;
    const trialDays = (data.trialEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
    if (trialDays > maxTrialDays) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Trial period cannot exceed ${maxTrialDays} days`,
        path: ['trialEnd'],
      });
    }
  }
  
  // Cross-field Rule 4: New user trial restrictions
  if (data.userAccountAge < 7 && !data.trialPeriodDays && !data.trialEnd) {
    // New users should have trials for high-value subscriptions
    if (data.unitPrice * data.quantity > 50) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'New users should start with a trial for high-value subscriptions',
        path: ['trialPeriodDays'],
      });
    }
  }
  
  // Cross-field Rule 5: Multiple subscription validation
  if (data.existingSubscriptionsCount >= 5) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Users cannot have more than 5 active subscriptions',
      path: ['userId'],
    });
  }
  
  // Cross-field Rule 6: Discount mutual exclusivity
  if (data.discountCodeId && data.couponId) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Cannot apply both discount code and coupon',
      path: ['couponId'],
    });
  }
});

// =============================================================================
// PAYMENT METHOD CROSS-FIELD VALIDATION
// =============================================================================

/**
 * Payment method cross-field validation
 */
export const paymentMethodCrossFieldSchema = z.object({
  userId: cuidSchema,
  type: z.enum(['CARD', 'BANK_ACCOUNT', 'PAYPAL', 'APPLE_PAY', 'GOOGLE_PAY']),
  
  // Card-specific fields
  last4: z.string().length(4).optional(),
  expiryMonth: z.number().int().min(1).max(12).optional(),
  expiryYear: z.number().int().min(new Date().getFullYear()).optional(),
  brand: z.string().optional(),
  
  // General fields
  billingAddress: addressSchema,
  isDefault: z.boolean().default(false),
  
  // Context
  existingPaymentMethodsCount: z.number().int().min(0).default(0),
  existingDefaultPaymentMethod: z.boolean().default(false),
  
}).superRefine(async (data, ctx) => {
  // Cross-field Rule 1: Card expiry validation
  if (data.type === 'CARD') {
    if (!data.last4 || !data.expiryMonth || !data.expiryYear) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Card payment methods require last4, expiry month, and expiry year',
        path: ['type'],
      });
    } else {
      // Check if card is expired
      const now = new Date();
      const expiryDate = new Date(data.expiryYear, data.expiryMonth - 1);
      
      if (expiryDate < now) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Cannot add expired payment method',
          path: ['expiryYear'],
        });
      }
    }
  }
  
  // Cross-field Rule 2: Default payment method logic
  if (data.isDefault && data.existingDefaultPaymentMethod) {
    // This is actually allowed - it will replace the existing default
    // But we might want to warn about it
  }
  
  if (!data.isDefault && data.existingPaymentMethodsCount === 0) {
    // First payment method should be default
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'First payment method must be set as default',
      path: ['isDefault'],
    });
  }
  
  // Cross-field Rule 3: Payment method limit
  if (data.existingPaymentMethodsCount >= 10) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Users cannot have more than 10 payment methods',
      path: ['userId'],
    });
  }
  
  // Cross-field Rule 4: Non-card payment methods don't need card fields
  if (data.type !== 'CARD' && (data.last4 || data.expiryMonth || data.expiryYear || data.brand)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Non-card payment methods should not have card-specific fields',
      path: ['type'],
    });
  }
});

// =============================================================================
// DISCOUNT APPLICATION CROSS-FIELD VALIDATION
// =============================================================================

/**
 * Discount application cross-field validation
 */
export const discountApplicationCrossFieldSchema = z.object({
  discountCode: z.string().toUpperCase(),
  userId: cuidSchema.optional(),
  customerEmail: emailSchema.optional(),
  
  // Order context
  orderAmount: priceSchema,
  currency: currencySchema,
  items: z.array(z.object({
    productId: cuidSchema,
    quantity: z.number().int().min(1),
    unitPrice: priceSchema,
    category: z.string().optional(),
  })).min(1),
  
  // User context
  isNewCustomer: z.boolean().default(false),
  previousOrdersCount: z.number().int().min(0).default(0),
  
}).superRefine(async (data, ctx) => {
  // This would typically involve database lookups to validate the discount code
  // For demonstration, we'll include some basic cross-field validations
  
  // Cross-field Rule 1: User identification requirement
  if (!data.userId && !data.customerEmail) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Either user ID or customer email is required for discount application',
      path: ['userId'],
    });
  }
  
  // Cross-field Rule 2: New customer discount validation
  if (data.discountCode.includes('NEWCUSTOMER') && !data.isNewCustomer) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'New customer discounts only available for first-time customers',
      path: ['discountCode'],
    });
  }
  
  // Cross-field Rule 3: Minimum order validation (example)
  if (data.discountCode.includes('50OFF') && data.orderAmount < 100) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'This discount requires a minimum order of $100',
      path: ['orderAmount'],
    });
  }
  
  // Cross-field Rule 4: Product category requirements (example)
  if (data.discountCode.includes('ELECTRONICS')) {
    const hasElectronics = data.items.some(item => item.category === 'electronics');
    if (!hasElectronics) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'This discount only applies to electronics',
        path: ['items'],
      });
    }
  }
});

// =============================================================================
// TYPE EXPORTS
// =============================================================================

export type OrderCrossFieldValidation = z.infer<typeof orderCrossFieldValidationSchema>;
export type UserRegistrationCrossField = z.infer<typeof userRegistrationCrossFieldSchema>;
export type SubscriptionCrossField = z.infer<typeof subscriptionCrossFieldSchema>;
export type PaymentMethodCrossField = z.infer<typeof paymentMethodCrossFieldSchema>;
export type DiscountApplicationCrossField = z.infer<typeof discountApplicationCrossFieldSchema>;