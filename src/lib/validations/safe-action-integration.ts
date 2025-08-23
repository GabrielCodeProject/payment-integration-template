import { z } from 'zod';
import { actionClient } from '../safe-action';
import { createValidationError, createBusinessLogicError, createPaymentError } from './errors/error-responses';

/**
 * Safe Action Integration Helpers
 * 
 * Utilities for integrating Zod validation schemas with next-safe-action,
 * providing type-safe server actions with comprehensive error handling.
 */

// =============================================================================
// ENHANCED ACTION CLIENTS
// =============================================================================

/**
 * Enhanced action client with comprehensive error handling
 */
export const enhancedActionClient = actionClient.use(async ({ next, clientInput: _clientInput, bindArgsClientInputs: _bindArgsClientInputs }) => {
  try {
    const result = await next();
    
    // If the action succeeded, return the result
    if (result.success) {
      return result;
    }
    
    // Transform errors into standardized format
    const _error = result.serverError || result.validationErrors;
    
    if (result.validationErrors) {
      return {
        success: false,
        error: createValidationError(
          'Validation failed',
          'INVALID_INPUT',
          Object.entries(result.validationErrors).map(([field, errors]) => ({
            field,
            message: Array.isArray(errors) ? errors.join(', ') : String(errors),
            code: 'INVALID_FORMAT',
            path: [field],
          }))
        ),
      };
    }
    
    return result;
  } catch (_error) {
    // console.error('Enhanced action client error:', error);
    return {
      success: false,
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'An unexpected error occurred',
        type: 'SYSTEM_ERROR',
        timestamp: new Date(),
      },
      meta: {
        statusCode: 500,
        retryable: true,
      },
    };
  }
});

/**
 * Enhanced auth action client
 */
export const enhancedAuthActionClient = enhancedActionClient.use(async ({ next }) => {
  // Add authentication check here when BetterAuth is configured
  // For now, this is a placeholder
  return next();
});

/**
 * Enhanced payment action client with PCI compliance checks
 */
export const enhancedPaymentActionClient = enhancedAuthActionClient.use(async ({ next, clientInput: _clientInput }) => {
  try {
    // Add PCI compliance checks here
    const result = await next();
    
    // Handle payment-specific errors
    if (!result.success && result.serverError) {
      const errorMessage = result.serverError.message || 'Payment processing failed';
      
      // Map common payment errors
      if (errorMessage.includes('declined')) {
        return {
          success: false,
          error: createPaymentError(
            'Payment was declined',
            'PAYMENT_DECLINED',
            {
              declineCode: 'generic_decline',
            }
          ),
        };
      }
      
      if (errorMessage.includes('insufficient')) {
        return {
          success: false,
          error: createPaymentError(
            'Insufficient funds',
            'INSUFFICIENT_FUNDS'
          ),
        };
      }
    }
    
    return result;
  } catch (_error) {
    // console.error('Payment action error:', error);
    return {
      success: false,
      error: createPaymentError(
        'Payment processing failed',
        'PROCESSING_ERROR'
      ),
    };
  }
});

// =============================================================================
// VALIDATION MIDDLEWARE
// =============================================================================

/**
 * Create validation middleware for complex business rules
 */
export function createValidationMiddleware<T extends z.ZodSchema>(
  schema: T,
  businessRules?: (data: z.infer<T>) => Promise<{ isValid: boolean; errors: string[] }>
) {
  return async ({ next, parsedInput }: { next: () => Promise<any>; parsedInput: z.infer<T> }) => {
    try {
      // Validate with schema
      const validatedData = schema.parse(parsedInput);
      
      // Apply business rules if provided
      if (businessRules) {
        const businessValidation = await businessRules(validatedData);
        if (!businessValidation.isValid) {
          return {
            success: false,
            error: createBusinessLogicError(
              'Business rules validation failed',
              'BUSINESS_RULE_VIOLATION',
              { errors: businessValidation.errors }
            ),
          };
        }
      }
      
      return next();
    } catch (_error) {
      if (_error instanceof z.ZodError) {
        return {
          success: false,
          error: createValidationError(
            'Input validation failed',
            'INVALID_INPUT',
            error.errors.map(err => ({
              field: err.path.join('.'),
              message: err.message,
              code: err.code,
              path: err.path,
              value: err.input,
            }))
          ),
        };
      }
      
      throw _error;
    }
  };
}

// =============================================================================
// TYPED ACTION CREATORS
// =============================================================================

/**
 * Create a typed action with validation
 */
export function createTypedAction<
  TInput extends z.ZodSchema,
  TOutput extends z.ZodSchema
>(config: {
  input: TInput;
  output?: TOutput;
  client?: typeof actionClient;
  businessRules?: (data: z.infer<TInput>) => Promise<{ isValid: boolean; errors: string[] }>;
}) {
  const client = config.client || enhancedActionClient;
  
  return client
    .schema(config.input)
    .use(createValidationMiddleware(config.input, config.businessRules));
}

/**
 * Create a typed auth action
 */
export function createTypedAuthAction<
  TInput extends z.ZodSchema,
  TOutput extends z.ZodSchema
>(config: {
  input: TInput;
  output?: TOutput;
  businessRules?: (data: z.infer<TInput>) => Promise<{ isValid: boolean; errors: string[] }>;
}) {
  return createTypedAction({
    ...config,
    client: enhancedAuthActionClient,
  });
}

/**
 * Create a typed payment action
 */
export function createTypedPaymentAction<
  TInput extends z.ZodSchema,
  TOutput extends z.ZodSchema
>(config: {
  input: TInput;
  output?: TOutput;
  businessRules?: (data: z.infer<TInput>) => Promise<{ isValid: boolean; errors: string[] }>;
}) {
  return createTypedAction({
    ...config,
    client: enhancedPaymentActionClient,
  });
}

// =============================================================================
// EXAMPLE USAGE
// =============================================================================

/*
// Example: Create a user action
const createUserAction = createTypedAction({
  input: createUserSchema,
  output: publicUserSchema,
  businessRules: async (data) => {
    // Check if email already exists
    const existingUser = await getUserByEmail(data.email);
    if (existingUser) {
      return { isValid: false, errors: ['Email already exists'] };
    }
    return { isValid: true, errors: [] };
  },
}).action(async ({ parsedInput }) => {
  // Implementation here
  const user = await createUser(parsedInput);
  return { success: true, data: user };
});

// Example: Create a payment action
const processPaymentAction = createTypedPaymentAction({
  input: createPaymentIntentActionSchema,
  businessRules: async (data) => {
    // Check payment limits, fraud detection, etc.
    const riskScore = await calculateRiskScore(data);
    if (riskScore > 80) {
      return { isValid: false, errors: ['Transaction blocked due to high risk'] };
    }
    return { isValid: true, errors: [] };
  },
}).action(async ({ parsedInput }) => {
  // Implementation here
  const paymentIntent = await createPaymentIntent(parsedInput);
  return { success: true, data: paymentIntent };
});
*/

// =============================================================================
// TYPE EXPORTS
// =============================================================================

export type TypedActionConfig<T extends z.ZodSchema> = {
  input: T;
  output?: z.ZodSchema;
  client?: typeof actionClient;
  businessRules?: (data: z.infer<T>) => Promise<{ isValid: boolean; errors: string[] }>;
};

export type ActionResult<T> = {
  success: true;
  data: T;
} | {
  success: false;
  error: any;
};