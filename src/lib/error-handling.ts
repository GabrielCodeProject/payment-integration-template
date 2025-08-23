/**
 * Enhanced Error Handling Utilities for Frontend Operations
 *
 * Provides comprehensive error classification, user-friendly messaging,
 * retry logic, and detailed logging for better user experience.
 */

import { toast } from "sonner";

/**
 * Error types with their characteristics and recommended handling
 */
export enum ErrorType {
  // Network-related errors
  NETWORK_ERROR = "network_error",
  TIMEOUT = "timeout",
  CONNECTION_REFUSED = "connection_refused",

  // Authentication and authorization
  AUTHENTICATION_FAILED = "authentication_failed",
  TOKEN_EXPIRED = "token_expired",
  INSUFFICIENT_PERMISSIONS = "insufficient_permissions",

  // Validation errors
  VALIDATION_ERROR = "validation_error",
  INVALID_INPUT = "invalid_input",
  CSRF_ERROR = "csrf_error",

  // Server errors
  SERVER_ERROR = "server_error",
  DATABASE_ERROR = "database_error",
  SERVICE_UNAVAILABLE = "service_unavailable",

  // Rate limiting
  RATE_LIMIT_EXCEEDED = "rate_limit_exceeded",

  // Business logic errors
  RESOURCE_NOT_FOUND = "resource_not_found",
  CONFLICT = "conflict",
  BUSINESS_RULE_VIOLATION = "business_rule_violation",

  // Client-side errors
  PARSE_ERROR = "parse_error",
  UNKNOWN_ERROR = "unknown_error",
}

/**
 * Error severity levels for logging and user feedback
 */
export enum ErrorSeverity {
  LOW = "low", // User can continue, minor issue
  MEDIUM = "medium", // Some functionality affected
  HIGH = "high", // Major functionality broken
  CRITICAL = "critical", // System unusable
}

/**
 * Structured error information
 */
export interface EnhancedError {
  type: ErrorType;
  severity: ErrorSeverity;
  message: string;
  userMessage: string;
  isRetryable: boolean;
  retryDelay?: number; // in milliseconds
  maxRetries?: number;
  context?: Record<string, unknown>;
  originalError?: Error;
  statusCode?: number;
  timestamp: string;
}

/**
 * Configuration for retry behavior
 */
export interface RetryConfig {
  maxRetries: number;
  baseDelay: number; // milliseconds
  maxDelay: number; // milliseconds
  backoffMultiplier: number;
  retryableErrors: ErrorType[];
}

/**
 * Default retry configuration
 */
const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 3,
  baseDelay: 1000,
  maxDelay: 10000,
  backoffMultiplier: 2,
  retryableErrors: [
    ErrorType.NETWORK_ERROR,
    ErrorType.TIMEOUT,
    ErrorType.SERVICE_UNAVAILABLE,
    ErrorType.SERVER_ERROR,
  ],
};

/**
 * Parse and classify different types of errors
 */
export function parseError(
  error: unknown,
  context?: Record<string, unknown>
): EnhancedError {
  const timestamp = new Date().toISOString();
  const baseError: Partial<EnhancedError> = {
    timestamp,
    context,
  };

  // Network/Fetch errors
  if (_error instanceof TypeError && _error.message.includes("fetch")) {
    if (
      _error.message.includes("NetworkError") ||
      _error.message.includes("ERR_NETWORK")
    ) {
      return {
        ...baseError,
        type: ErrorType.NETWORK_ERROR,
        severity: ErrorSeverity.HIGH,
        message: "Network connection failed",
        userMessage:
          "Unable to connect to server. Please check your internet connection and try again.",
        isRetryable: true,
        retryDelay: 2000,
        maxRetries: 3,
        originalError: error as Error,
      } as EnhancedError;
    }

    return {
      ...baseError,
      type: ErrorType.CONNECTION_REFUSED,
      severity: ErrorSeverity.HIGH,
      message: "Connection refused",
      userMessage:
        "Unable to reach the server. The service might be temporarily unavailable.",
      isRetryable: true,
      retryDelay: 5000,
      maxRetries: 2,
      originalError: error as Error,
    } as EnhancedError;
  }

  // Response-based errors (from fetch response)
  if (_error instanceof Error) {
    try {
      // Try to parse as API error response
      const parsedError = parseApiResponse(error);
      if (parsedError) {
        return parsedError;
      }
    } catch {
      // Continue with generic error handling
    }

    // Timeout errors
    if (
      _error.message.includes("timeout") ||
      _error.message.includes("aborted")
    ) {
      return {
        ...baseError,
        type: ErrorType.TIMEOUT,
        severity: ErrorSeverity.MEDIUM,
        message: "Request timed out",
        userMessage: "The request took too long to complete. Please try again.",
        isRetryable: true,
        retryDelay: 1000,
        maxRetries: 2,
        originalError: error,
      } as EnhancedError;
    }

    // CSRF errors
    if (
      _error.message.includes("CSRF") ||
      _error.message.includes("security validation")
    ) {
      return {
        ...baseError,
        type: ErrorType.CSRF_ERROR,
        severity: ErrorSeverity.MEDIUM,
        message: "CSRF validation failed",
        userMessage:
          "Security validation failed. Please refresh the page and try again.",
        isRetryable: false,
        originalError: error,
      } as EnhancedError;
    }

    // Authentication errors
    if (
      _error.message.includes("authentication") ||
      _error.message.includes("unauthorized")
    ) {
      return {
        ...baseError,
        type: ErrorType.AUTHENTICATION_FAILED,
        severity: ErrorSeverity.HIGH,
        message: "Authentication failed",
        userMessage: "Please log in again to continue.",
        isRetryable: false,
        originalError: error,
        statusCode: 401,
      } as EnhancedError;
    }

    // Permission errors
    if (
      _error.message.includes("permission") ||
      _error.message.includes("forbidden")
    ) {
      return {
        ...baseError,
        type: ErrorType.INSUFFICIENT_PERMISSIONS,
        severity: ErrorSeverity.MEDIUM,
        message: "Insufficient permissions",
        userMessage: "You don't have permission to perform this action.",
        isRetryable: false,
        originalError: error,
        statusCode: 403,
      } as EnhancedError;
    }

    // Rate limiting
    if (
      _error.message.includes("rate limit") ||
      _error.message.includes("too many")
    ) {
      return {
        ...baseError,
        type: ErrorType.RATE_LIMIT_EXCEEDED,
        severity: ErrorSeverity.MEDIUM,
        message: "Rate limit exceeded",
        userMessage: "Too many requests. Please wait a moment and try again.",
        isRetryable: true,
        retryDelay: 60000, // 1 minute
        maxRetries: 1,
        originalError: error,
        statusCode: 429,
      } as EnhancedError;
    }

    // Validation errors
    if (
      _error.message.includes("validation") ||
      _error.message.includes("invalid")
    ) {
      return {
        ...baseError,
        type: ErrorType.VALIDATION_ERROR,
        severity: ErrorSeverity.LOW,
        message: "Validation failed",
        userMessage: _error.message || "Please check your input and try again.",
        isRetryable: false,
        originalError: error,
        statusCode: 400,
      } as EnhancedError;
    }

    // Not found errors
    if (
      _error.message.includes("not found") ||
      _error.message.includes("does not exist")
    ) {
      return {
        ...baseError,
        type: ErrorType.RESOURCE_NOT_FOUND,
        severity: ErrorSeverity.LOW,
        message: "Resource not found",
        userMessage:
          "The requested item was not found. It may have been deleted or moved.",
        isRetryable: false,
        originalError: error,
        statusCode: 404,
      } as EnhancedError;
    }

    // Database/Server errors
    if (
      _error.message.includes("database") ||
      _error.message.includes("connection")
    ) {
      return {
        ...baseError,
        type: ErrorType.DATABASE_ERROR,
        severity: ErrorSeverity.HIGH,
        message: "Database error occurred",
        userMessage:
          "A system error occurred. Please try again in a few moments.",
        isRetryable: true,
        retryDelay: 3000,
        maxRetries: 2,
        originalError: error,
        statusCode: 500,
      } as EnhancedError;
    }
  }

  // Default unknown error
  return {
    ...baseError,
    type: ErrorType.UNKNOWN_ERROR,
    severity: ErrorSeverity.MEDIUM,
    message: error instanceof Error ? _error.message : "Unknown error occurred",
    userMessage: "An unexpected error occurred. Please try again.",
    isRetryable: true,
    retryDelay: 1000,
    maxRetries: 1,
    originalError: error instanceof Error ? error : new Error(String(error)),
  } as EnhancedError;
}

/**
 * Parse API response errors with status codes
 */
function parseApiResponse(_error: Error): EnhancedError | null {
  // This will be called when we have response status information
  // For now, return null to continue with generic parsing
  return null;
}

/**
 * Parse error from fetch response
 */
export async function parseResponseError(
  response: Response
): Promise<EnhancedError> {
  const timestamp = new Date().toISOString();
  let errorData: Record<string, unknown> = {};

  try {
    errorData = await response.json();
  } catch {
    // Response is not JSON, create error from status
  }

  const message =
    errorData.error ||
    errorData.message ||
    response.statusText ||
    "Request failed";
  const context = {
    statusCode: response.status,
    url: response.url,
    method: "unknown",
  };

  // Map status codes to error types
  switch (response.status) {
    case 400:
      return {
        type: ErrorType.VALIDATION_ERROR,
        severity: ErrorSeverity.LOW,
        message,
        userMessage: message.includes("validation")
          ? message
          : "Invalid request. Please check your input.",
        isRetryable: false,
        context,
        statusCode: response.status,
        timestamp,
      };

    case 401:
      return {
        type: ErrorType.AUTHENTICATION_FAILED,
        severity: ErrorSeverity.HIGH,
        message,
        userMessage: "Authentication required. Please log in again.",
        isRetryable: false,
        context,
        statusCode: response.status,
        timestamp,
      };

    case 403:
      if (message.includes("CSRF")) {
        return {
          type: ErrorType.CSRF_ERROR,
          severity: ErrorSeverity.MEDIUM,
          message,
          userMessage:
            "Security validation failed. Please refresh the page and try again.",
          isRetryable: false,
          context,
          statusCode: response.status,
          timestamp,
        };
      }
      return {
        type: ErrorType.INSUFFICIENT_PERMISSIONS,
        severity: ErrorSeverity.MEDIUM,
        message,
        userMessage: "You don't have permission to perform this action.",
        isRetryable: false,
        context,
        statusCode: response.status,
        timestamp,
      };

    case 404:
      return {
        type: ErrorType.RESOURCE_NOT_FOUND,
        severity: ErrorSeverity.LOW,
        message,
        userMessage: "The requested resource was not found.",
        isRetryable: false,
        context,
        statusCode: response.status,
        timestamp,
      };

    case 409:
      return {
        type: ErrorType.CONFLICT,
        severity: ErrorSeverity.MEDIUM,
        message,
        userMessage:
          "The request conflicts with the current state. Please refresh and try again.",
        isRetryable: false,
        context,
        statusCode: response.status,
        timestamp,
      };

    case 429:
      return {
        type: ErrorType.RATE_LIMIT_EXCEEDED,
        severity: ErrorSeverity.MEDIUM,
        message,
        userMessage: "Too many requests. Please wait a moment and try again.",
        isRetryable: true,
        retryDelay: 60000,
        maxRetries: 1,
        context,
        statusCode: response.status,
        timestamp,
      };

    case 500:
    case 502:
    case 503:
    case 504:
      return {
        type:
          response.status === 503
            ? ErrorType.SERVICE_UNAVAILABLE
            : ErrorType.SERVER_ERROR,
        severity: ErrorSeverity.HIGH,
        message,
        userMessage:
          "Server error occurred. Please try again in a few moments.",
        isRetryable: true,
        retryDelay: 3000,
        maxRetries: 2,
        context,
        statusCode: response.status,
        timestamp,
      };

    default:
      return {
        type: ErrorType.UNKNOWN_ERROR,
        severity: ErrorSeverity.MEDIUM,
        message,
        userMessage: "An unexpected error occurred. Please try again.",
        isRetryable: response.status >= 500,
        retryDelay: 1000,
        maxRetries: response.status >= 500 ? 2 : 0,
        context,
        statusCode: response.status,
        timestamp,
      };
  }
}

/**
 * Enhanced fetch with timeout and error handling
 */
export async function enhancedFetch(
  url: string,
  options: RequestInit = {},
  timeoutMs: number = 30000
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw await parseResponseError(response);
    }

    return response;
  } catch (_error) {
    clearTimeout(timeoutId);

    if (_error instanceof Error && error.name === "AbortError") {
      throw parseError(new Error("Request timed out"));
    }

    throw _error;
  }
}

/**
 * Retry function with exponential backoff
 */
export async function retryOperation<T>(
  operation: () => Promise<T>,
  config: Partial<RetryConfig> = {}
): Promise<T> {
  const finalConfig = { ...DEFAULT_RETRY_CONFIG, ...config };
  let lastError: EnhancedError;

  for (let attempt = 0; attempt <= finalConfig.maxRetries; attempt++) {
    try {
      return await operation();
    } catch (_error) {
      const enhancedError =
        error instanceof Error && "type" in error
          ? (error as EnhancedError)
          : parseError(error);

      lastError = enhancedError;

      // Don't retry if error is not retryable or we've exceeded max retries
      if (!enhancedError.isRetryable || attempt === finalConfig.maxRetries) {
        throw enhancedError;
      }

      // Calculate delay with exponential backoff
      const delay = Math.min(
        finalConfig.baseDelay *
          Math.pow(finalConfig.backoffMultiplier, attempt),
        finalConfig.maxDelay
      );

      // Add some jitter to prevent thundering herd
      const jitteredDelay = delay + Math.random() * 1000;

      await new Promise((resolve) => setTimeout(resolve, jitteredDelay));
    }
  }

  throw lastError!;
}

/**
 * Display appropriate toast notification based on error
 */
export function displayErrorToast(error: EnhancedError): void {
  switch (error.severity) {
    case ErrorSeverity.LOW:
      toast.info(error.userMessage);
      break;
    case ErrorSeverity.MEDIUM:
      toast.warning(error.userMessage);
      break;
    case ErrorSeverity.HIGH:
    case ErrorSeverity.CRITICAL:
      toast.error(error.userMessage);
      break;
    default:
      toast.error(error.userMessage);
  }
}

/**
 * Log error for debugging while respecting user privacy
 */
export function logError(
  error: EnhancedError,
  context?: Record<string, unknown>
): void {
  if (process.env.NODE_ENV === "development") {
    // eslint-disable-next-line no-console
    console.group(`🚨 ${error.type.toUpperCase()} [${error.severity}]`);
    // eslint-disable-next-line no-console
    // console.error("Message:", _error.message);
    // eslint-disable-next-line no-console
    // console.error("User Message:", error.userMessage);
    // eslint-disable-next-line no-console
    // console.error("Retryable:", error.isRetryable);
    // eslint-disable-next-line no-console
    if (error.statusCode) // console.error("Status:", error.statusCode);
    // eslint-disable-next-line no-console
    if (error.context) // console.error("Context:", error.context);
    // eslint-disable-next-line no-console
    if (context) // console.error("Additional Context:", context);
    // eslint-disable-next-line no-console
    if (error.originalError)
      // console.error("Original Error:", error.originalError);
    // eslint-disable-next-line no-console
    console.groupEnd();
  } else {
    // In production, log minimal error information
    // eslint-disable-next-line no-console
    // console.error(`Error [${error.type}]:`, {
    //   message: _error.message,
    //   severity: error.severity,
    //   statusCode: error.statusCode,
    //   timestamp: error.timestamp,
    //   // Don't log sensitive context in production
    // });
  }
}

/**
 * Comprehensive error handler that combines parsing, logging, and user feedback
 */
export function handleError(
  error: unknown,
  context?: Record<string, unknown>
): EnhancedError {
  const enhancedError = parseError(error, context);
  logError(enhancedError, context);
  displayErrorToast(enhancedError);
  return enhancedError;
}
