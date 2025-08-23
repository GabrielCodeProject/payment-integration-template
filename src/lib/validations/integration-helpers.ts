import { z } from 'zod';

/**
 * Integration Helper Functions
 * 
 * Utility functions for integrating the validation system with
 * the rest of the application, including Prisma, forms, and APIs.
 */

// =============================================================================
// PRISMA INTEGRATION HELPERS
// =============================================================================

/**
 * Convert Zod schema to Prisma-compatible data
 */
export function zodToPrismaData<T extends z.ZodSchema>(
  schema: T,
  data: unknown
): z.infer<T> {
  return schema.parse(data);
}

/**
 * Validate Prisma result against Zod schema
 */
export function validatePrismaResult<T extends z.ZodSchema>(
  schema: T,
  result: unknown
): z.infer<T> {
  return schema.parse(result);
}

/**
 * Create Prisma-safe partial update data
 */
export function createPrismaUpdateData<T extends z.ZodSchema>(
  schema: T,
  data: Partial<z.infer<T>>
): Partial<z.infer<T>> {
  // Remove undefined values and validate remaining data
  const cleanedData = Object.fromEntries(
    Object.entries(data).filter(([_, value]) => value !== undefined)
  );
  
  // Use partial schema validation
  const partialSchema = schema.partial();
  return partialSchema.parse(cleanedData);
}

// =============================================================================
// FORM VALIDATION HELPERS
// =============================================================================

/**
 * Convert Zod errors to form-friendly format
 */
export function zodErrorsToFormErrors(error: z.ZodError): Record<string, string[]> {
  const formErrors: Record<string, string[]> = {};
  
  error.errors.forEach((err) => {
    const path = err.path.join('.');
    if (!formErrors[path]) {
      formErrors[path] = [];
    }
    formErrors[path].push(err.message);
  });
  
  return formErrors;
}

/**
 * Validate form data with custom error formatting
 */
export function validateFormData<T extends z.ZodSchema>(
  schema: T,
  data: unknown
): { success: true; data: z.infer<T> } | { success: false; errors: Record<string, string[]> } {
  try {
    const validatedData = schema.parse(data);
    return { success: true, data: validatedData };
  } catch (_error) {
    if (_error instanceof z.ZodError) {
      return { success: false, errors: zodErrorsToFormErrors(error) };
    }
    throw _error;
  }
}

// =============================================================================
// API VALIDATION HELPERS
// =============================================================================

/**
 * Create API response validator
 */
export function createApiValidator<TRequest extends z.ZodSchema, TResponse extends z.ZodSchema>(
  requestSchema: TRequest,
  responseSchema?: TResponse
) {
  return {
    validateRequest: (data: unknown): z.infer<TRequest> => {
      return requestSchema.parse(data);
    },
    validateResponse: responseSchema 
      ? (data: unknown): z.infer<TResponse> => responseSchema.parse(data)
      : undefined,
  };
}

/**
 * Validate API request with error handling
 */
export function validateApiRequest<T extends z.ZodSchema>(
  schema: T,
  data: unknown
): { success: true; data: z.infer<T> } | { success: false; error: any } {
  try {
    const validatedData = schema.parse(data);
    return { success: true, data: validatedData };
  } catch (_error) {
    if (_error instanceof z.ZodError) {
      return {
        success: false,
        error: {
          type: 'VALIDATION_ERROR',
          message: 'Request validation failed',
          details: error.errors,
        },
      };
    }
    return {
      success: false,
      error: {
        type: 'UNKNOWN_ERROR',
        message: 'Validation failed with unknown error',
      },
    };
  }
}

// =============================================================================
// SEARCH PARAM VALIDATION
// =============================================================================

/**
 * Validate and parse URL search parameters
 */
export function validateSearchParams<T extends z.ZodSchema>(
  schema: T,
  searchParams: URLSearchParams | Record<string, string | string[]>
): z.infer<T> {
  const params = searchParams instanceof URLSearchParams 
    ? Object.fromEntries(searchParams.entries())
    : searchParams;
  
  return schema.parse(params);
}

/**
 * Create type-safe search params
 */
export function createSearchParams<T extends Record<string, any>>(
  data: T
): URLSearchParams {
  const params = new URLSearchParams();
  
  Object.entries(data).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      if (Array.isArray(value)) {
        value.forEach(item => params.append(key, String(item)));
      } else {
        params.set(key, String(value));
      }
    }
  });
  
  return params;
}

// =============================================================================
// MIDDLEWARE INTEGRATION
// =============================================================================

/**
 * Create validation middleware for Next.js API routes
 */
export function createApiValidationMiddleware<T extends z.ZodSchema>(
  schema: T,
  options: {
    validateBody?: boolean;
    validateQuery?: boolean;
    validateHeaders?: boolean;
  } = { validateBody: true }
) {
  return (req: any, res: any, next: () => void) => {
    try {
      if (options.validateBody && req.body) {
        req.validatedBody = schema.parse(req.body);
      }
      
      if (options.validateQuery && req.query) {
        req.validatedQuery = schema.parse(req.query);
      }
      
      if (options.validateHeaders && req.headers) {
        req.validatedHeaders = schema.parse(req.headers);
      }
      
      next();
    } catch (_error) {
      if (_error instanceof z.ZodError) {
        res.status(400).json({
          success: false,
          error: {
            type: 'VALIDATION_ERROR',
            message: 'Request validation failed',
            details: error.errors,
          },
        });
        return;
      }
      
      res.status(500).json({
        success: false,
        error: {
          type: 'INTERNAL_ERROR',
          message: 'Validation middleware error',
        },
      });
    }
  };
}

// =============================================================================
// WEBSOCKET VALIDATION
// =============================================================================

/**
 * Validate WebSocket messages
 */
export function validateWebSocketMessage<T extends z.ZodSchema>(
  schema: T,
  message: unknown
): { success: true; data: z.infer<T> } | { success: false; error: string } {
  try {
    const validatedData = schema.parse(message);
    return { success: true, data: validatedData };
  } catch (_error) {
    if (_error instanceof z.ZodError) {
      return {
        success: false,
        error: `Message validation failed: ${error.errors.map(e => e.message).join(', ')}`,
      };
    }
    return {
      success: false,
      error: 'Unknown validation error',
    };
  }
}

// =============================================================================
// ENVIRONMENT VALIDATION
// =============================================================================

/**
 * Validate environment variables at runtime
 */
export function validateEnvironment<T extends z.ZodSchema>(
  schema: T,
  env: Record<string, string | undefined> = process.env
): z.infer<T> {
  try {
    return schema.parse(env);
  } catch (_error) {
    if (_error instanceof z.ZodError) {
      const errorMessages = error.errors.map(err => 
        `${err.path.join('.')}: ${err.message}`
      ).join(', ');
      
      throw new Error(`Environment validation failed: ${errorMessages}`);
    }
    throw _error;
  }
}

// =============================================================================
// CONFIGURATION VALIDATION
// =============================================================================

/**
 * Validate application configuration
 */
export function validateConfig<T extends z.ZodSchema>(
  schema: T,
  config: unknown
): z.infer<T> {
  try {
    return schema.parse(config);
  } catch (_error) {
    if (_error instanceof z.ZodError) {
      const errorMessages = error.errors.map(err => 
        `${err.path.join('.')}: ${err.message}`
      ).join(', ');
      
      throw new Error(`Configuration validation failed: ${errorMessages}`);
    }
    throw _error;
  }
}

// =============================================================================
// TYPE EXPORTS
// =============================================================================

export type ValidationResult<T> = {
  success: true;
  data: T;
} | {
  success: false;
  errors: Record<string, string[]>;
};

export type ApiValidationResult<T> = {
  success: true;
  data: T;
} | {
  success: false;
  error: {
    type: string;
    message: string;
    details?: any;
  };
};

export type WebSocketValidationResult<T> = {
  success: true;
  data: T;
} | {
  success: false;
  error: string;
};