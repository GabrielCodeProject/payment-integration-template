import { z } from 'zod';
import {
  cuidSchema,
  priceSchema,
  currencySchema,
  addressSchema,
} from '../base/common';

/**
 * Payment Business Rules Validation Schemas
 * 
 * Custom business logic validation for payment operations,
 * including risk assessment, amount limits, and payment processing rules.
 */

// =============================================================================
// PAYMENT AMOUNT BUSINESS RULES
// =============================================================================

/**
 * Payment amount validation with business rules
 */
export const paymentAmountBusinessRulesSchema = z.object({
  amount: priceSchema,
  currency: currencySchema,
  userId: cuidSchema.optional(),
  paymentMethodType: z.enum(['CARD', 'BANK_ACCOUNT', 'PAYPAL', 'APPLE_PAY', 'GOOGLE_PAY']),
  
  // Context for business rules
  isFirstPayment: z.boolean().default(false),
  isInternational: z.boolean().default(false),
  riskScore: z.number().min(0).max(100).default(0),
  userAccountAge: z.number().int().min(0).default(0), // days
  
}).superRefine(async (data, ctx) => {
  // Business Rule 1: Minimum payment amount
  const minimumAmounts = {
    USD: 0.50,
    EUR: 0.50,
    GBP: 0.30,
    CAD: 0.50,
    AUD: 0.50,
  };
  
  const minAmount = minimumAmounts[data.currency as keyof typeof minimumAmounts] || 1.00;
  if (data.amount < minAmount) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: `Minimum payment amount for ${data.currency} is ${minAmount}`,
      path: ['amount'],
    });
  }
  
  // Business Rule 2: Maximum payment amount for new users
  if (data.isFirstPayment && data.amount > 1000) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'First payment cannot exceed $1,000',
      path: ['amount'],
    });
  }
  
  // Business Rule 3: High-risk payment limits
  if (data.riskScore > 70 && data.amount > 500) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'High-risk payments are limited to $500',
      path: ['amount'],
    });
  }
  
  // Business Rule 4: International payment limits
  if (data.isInternational && data.amount > 5000) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'International payments are limited to $5,000',
      path: ['amount'],
    });
  }
  
  // Business Rule 5: New account restrictions
  if (data.userAccountAge < 30 && data.amount > 2500) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Accounts less than 30 days old are limited to $2,500 per transaction',
      path: ['amount'],
    });
  }
  
  // Business Rule 6: Payment method specific limits
  if (data.paymentMethodType === 'BANK_ACCOUNT' && data.amount > 10000) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Bank account payments are limited to $10,000',
      path: ['amount'],
    });
  }
});

// =============================================================================
// PAYMENT VELOCITY BUSINESS RULES
// =============================================================================

/**
 * Payment velocity validation
 */
export const paymentVelocityBusinessRulesSchema = z.object({
  userId: cuidSchema,
  amount: priceSchema,
  currency: currencySchema,
  
  // Velocity context
  paymentsInLastHour: z.number().int().min(0).default(0),
  paymentsInLast24Hours: z.number().int().min(0).default(0),
  paymentsInLast7Days: z.number().int().min(0).default(0),
  
  amountInLastHour: z.number().min(0).default(0),
  amountInLast24Hours: z.number().min(0).default(0),
  amountInLast7Days: z.number().min(0).default(0),
  
  // User context
  userTier: z.enum(['BASIC', 'PREMIUM', 'VIP']).default('BASIC'),
  isVerifiedUser: z.boolean().default(false),
  
}).superRefine(async (data, ctx) => {
  // Define velocity limits based on user tier
  const velocityLimits = {
    BASIC: {
      maxPaymentsPerHour: 3,
      maxPaymentsPer24Hours: 10,
      maxPaymentsPerWeek: 50,
      maxAmountPerHour: 1000,
      maxAmountPer24Hours: 5000,
      maxAmountPerWeek: 25000,
    },
    PREMIUM: {
      maxPaymentsPerHour: 5,
      maxPaymentsPer24Hours: 20,
      maxPaymentsPerWeek: 100,
      maxAmountPerHour: 2500,
      maxAmountPer24Hours: 10000,
      maxAmountPerWeek: 50000,
    },
    VIP: {
      maxPaymentsPerHour: 10,
      maxPaymentsPer24Hours: 50,
      maxPaymentsPerWeek: 250,
      maxAmountPerHour: 10000,
      maxAmountPer24Hours: 50000,
      maxAmountPerWeek: 250000,
    },
  };
  
  const limits = velocityLimits[data.userTier];
  
  // Check payment count limits
  if (data.paymentsInLastHour >= limits.maxPaymentsPerHour) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: `Maximum ${limits.maxPaymentsPerHour} payments per hour exceeded`,
      path: ['paymentsInLastHour'],
    });
  }
  
  if (data.paymentsInLast24Hours >= limits.maxPaymentsPer24Hours) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: `Maximum ${limits.maxPaymentsPer24Hours} payments per day exceeded`,
      path: ['paymentsInLast24Hours'],
    });
  }
  
  if (data.paymentsInLast7Days >= limits.maxPaymentsPerWeek) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: `Maximum ${limits.maxPaymentsPerWeek} payments per week exceeded`,
      path: ['paymentsInLast7Days'],
    });
  }
  
  // Check amount limits
  if (data.amountInLastHour + data.amount > limits.maxAmountPerHour) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: `Maximum $${limits.maxAmountPerHour} per hour exceeded`,
      path: ['amount'],
    });
  }
  
  if (data.amountInLast24Hours + data.amount > limits.maxAmountPer24Hours) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: `Maximum $${limits.maxAmountPer24Hours} per day exceeded`,
      path: ['amount'],
    });
  }
  
  if (data.amountInLast7Days + data.amount > limits.maxAmountPerWeek) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: `Maximum $${limits.maxAmountPerWeek} per week exceeded`,
      path: ['amount'],
    });
  }
  
  // Additional restrictions for unverified users
  if (!data.isVerifiedUser) {
    if (data.paymentsInLast24Hours >= 5) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Unverified users are limited to 5 payments per day',
        path: ['paymentsInLast24Hours'],
      });
    }
    
    if (data.amountInLast24Hours + data.amount > 1000) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Unverified users are limited to $1,000 per day',
        path: ['amount'],
      });
    }
  }
});

// =============================================================================
// PAYMENT METHOD BUSINESS RULES
// =============================================================================

/**
 * Payment method validation with business rules
 */
export const paymentMethodBusinessRulesSchema = z.object({
  userId: cuidSchema,
  paymentMethodType: z.enum(['CARD', 'BANK_ACCOUNT', 'PAYPAL', 'APPLE_PAY', 'GOOGLE_PAY']),
  billingAddress: addressSchema,
  
  // Card-specific fields (if applicable)
  cardBrand: z.enum(['visa', 'mastercard', 'amex', 'discover', 'jcb', 'diners']).optional(),
  cardCountry: z.string().length(2).optional(), // ISO country code
  
  // Context
  userCountry: z.string().length(2), // ISO country code
  isBusinessAccount: z.boolean().default(false),
  userRiskScore: z.number().min(0).max(100).default(0),
  
}).superRefine(async (data, ctx) => {
  // Business Rule 1: Geographic restrictions
  const restrictedCountries = ['CU', 'IR', 'KP', 'SY']; // Example sanctioned countries
  
  if (data.cardCountry && restrictedCountries.includes(data.cardCountry)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Payment methods from this country are not supported',
      path: ['cardCountry'],
    });
  }
  
  // Business Rule 2: High-risk payment method restrictions
  if (data.userRiskScore > 80 && data.paymentMethodType === 'BANK_ACCOUNT') {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'High-risk users cannot use bank account payments',
      path: ['paymentMethodType'],
    });
  }
  
  // Business Rule 3: Business account requirements
  if (data.isBusinessAccount && data.paymentMethodType === 'PAYPAL') {
    // Business accounts should use more secure payment methods
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Business accounts should use card or bank account payments',
      path: ['paymentMethodType'],
    });
  }
  
  // Business Rule 4: Address mismatch detection
  if (data.billingAddress.country !== data.userCountry) {
    // Flag potential address mismatch for review
    if (data.userRiskScore > 50) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Billing address country mismatch requires verification',
        path: ['billingAddress'],
      });
    }
  }
});

// =============================================================================
// PAYMENT PROCESSING BUSINESS RULES
// =============================================================================

/**
 * Payment processing validation with business rules
 */
export const paymentProcessingBusinessRulesSchema = z.object({
  amount: priceSchema,
  currency: currencySchema,
  paymentMethodId: cuidSchema,
  orderId: cuidSchema.optional(),
  
  // Business context
  businessHours: z.boolean().default(true),
  isRecurring: z.boolean().default(false),
  isRefund: z.boolean().default(false),
  originalTransactionId: cuidSchema.optional(),
  
  // Risk factors
  ipAddress: z.string(),
  deviceFingerprint: z.string().optional(),
  isNewDevice: z.boolean().default(false),
  isNewLocation: z.boolean().default(false),
  
}).superRefine(async (data, ctx) => {
  // Business Rule 1: Off-hours processing restrictions
  if (!data.businessHours && data.amount > 10000) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Large payments outside business hours require manual approval',
      path: ['amount'],
    });
  }
  
  // Business Rule 2: Refund amount validation
  if (data.isRefund && !data.originalTransactionId) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Refunds must reference an original transaction',
      path: ['originalTransactionId'],
    });
  }
  
  // Business Rule 3: New device/location restrictions
  if ((data.isNewDevice || data.isNewLocation) && data.amount > 1000) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Large payments from new devices/locations require additional verification',
      path: ['amount'],
    });
  }
  
  // Business Rule 4: Recurring payment validation
  if (data.isRecurring && data.amount > 5000) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Recurring payments are limited to $5,000',
      path: ['amount'],
    });
  }
});

// =============================================================================
// CHARGEBACK PROTECTION RULES
// =============================================================================

/**
 * Chargeback protection validation
 */
export const chargebackProtectionSchema = z.object({
  userId: cuidSchema,
  amount: priceSchema,
  paymentMethodId: cuidSchema,
  
  // Historical data
  userChargebackCount: z.number().int().min(0).default(0),
  userChargebackRate: z.number().min(0).max(1).default(0), // percentage as decimal
  merchantChargebackRate: z.number().min(0).max(1).default(0),
  
  // Transaction characteristics
  isHighRisk: z.boolean().default(false),
  isInternational: z.boolean().default(false),
  deliveryMethod: z.enum(['DIGITAL', 'PHYSICAL', 'SERVICE']),
  
}).superRefine(async (data, ctx) => {
  // Business Rule 1: High chargeback rate users
  if (data.userChargebackRate > 0.05) { // 5% chargeback rate
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'User has high chargeback rate - additional verification required',
      path: ['userChargebackRate'],
    });
  }
  
  // Business Rule 2: Merchant chargeback threshold
  if (data.merchantChargebackRate > 0.01 && data.amount > 500) { // 1% merchant rate
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Large transactions restricted due to high merchant chargeback rate',
      path: ['amount'],
    });
  }
  
  // Business Rule 3: Digital goods protection
  if (data.deliveryMethod === 'DIGITAL' && data.amount > 100) {
    // Digital goods have higher chargeback risk
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Digital goods over $100 require enhanced verification',
      path: ['amount'],
    });
  }
  
  // Business Rule 4: International transaction protection
  if (data.isInternational && data.isHighRisk && data.amount > 250) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'High-risk international transactions limited to $250',
      path: ['amount'],
    });
  }
});

// =============================================================================
// TYPE EXPORTS
// =============================================================================

export type PaymentAmountBusinessRules = z.infer<typeof paymentAmountBusinessRulesSchema>;
export type PaymentVelocityBusinessRules = z.infer<typeof paymentVelocityBusinessRulesSchema>;
export type PaymentMethodBusinessRules = z.infer<typeof paymentMethodBusinessRulesSchema>;
export type PaymentProcessingBusinessRules = z.infer<typeof paymentProcessingBusinessRulesSchema>;
export type ChargebackProtection = z.infer<typeof chargebackProtectionSchema>;