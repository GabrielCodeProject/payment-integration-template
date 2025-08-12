/**
 * Common utility types used across the payment integration application
 */

// Branded types for type safety
export type UserId = string & { readonly __brand: "UserId" };
export type PaymentId = string & { readonly __brand: "PaymentId" };
export type CustomerId = string & { readonly __brand: "CustomerId" };
export type SubscriptionId = string & { readonly __brand: "SubscriptionId" };
export type ProductId = string & { readonly __brand: "ProductId" };
export type PlanId = string & { readonly __brand: "PlanId" };
export type PaymentMethodId = string & { readonly __brand: "PaymentMethodId" };
export type SessionId = string & { readonly __brand: "SessionId" };
export type CartId = string & { readonly __brand: "CartId" };

// Branded type creation helpers
export function createUserId(id: string): UserId {
  return id as UserId;
}

export function createPaymentId(id: string): PaymentId {
  return id as PaymentId;
}

export function createCustomerId(id: string): CustomerId {
  return id as CustomerId;
}

export function createSubscriptionId(id: string): SubscriptionId {
  return id as SubscriptionId;
}

export function createProductId(id: string): ProductId {
  return id as ProductId;
}

// Currency and locale types
export type Currency =
  | "USD"
  | "EUR"
  | "GBP"
  | "CAD"
  | "AUD"
  | "JPY"
  | "CHF"
  | "SGD";
export type Locale =
  | "en-US"
  | "en-GB"
  | "en-CA"
  | "fr-FR"
  | "de-DE"
  | "ja-JP"
  | "zh-CN";

// Utility types for better TypeScript ergonomics
export type Optional<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;
export type RequiredOnly<T, K extends keyof T> = Pick<T, K>;
export type PartialBy<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;
export type NonNullable<T> = T extends null | undefined ? never : T;

// Async state management
export interface AsyncState<T> {
  loading: boolean;
  error: Error | null;
  data: T | null;
}

export interface LoadingState {
  loading: boolean;
  error: string | null;
}

// Pagination types
export interface PaginationInfo {
  page: number;
  limit: number;
  total: number;
  pages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

export interface PaginatedResult<T> {
  items: T[];
  pagination: PaginationInfo;
}

export interface PaginationQuery {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
}

// API response types
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: ApiError;
  timestamp: Date;
  requestId?: string;
}

export interface ApiError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
  field?: string;
}

// Form and validation types
export interface FormField<T = string> {
  value: T;
  error: string | null;
  touched: boolean;
  required: boolean;
}

export interface ValidationResult {
  isValid: boolean;
  errors: Record<string, string>;
}

// Event types for analytics
export interface AnalyticsEvent {
  name: string;
  properties?: Record<string, unknown>;
  timestamp?: Date;
  userId?: UserId;
  sessionId?: SessionId;
}

// Base entity interface
export interface BaseEntity {
  id: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface SoftDeletable {
  deletedAt: Date | null;
  isDeleted: boolean;
}

export interface Timestamped {
  createdAt: Date;
  updatedAt: Date;
}

// Search and filtering
export interface SearchQuery {
  query?: string;
  filters?: Record<string, unknown>;
  pagination?: PaginationQuery;
}

export interface SearchResult<T> extends PaginatedResult<T> {
  query: string;
  filters: Record<string, unknown>;
  facets?: Record<string, SearchFacet>;
}

export interface SearchFacet {
  name: string;
  values: Array<{
    value: string;
    count: number;
    selected: boolean;
  }>;
}

// Feature flags
export interface FeatureFlags {
  stripeTestMode: boolean;
  maintenanceMode: boolean;
  debugMode: boolean;
  newCheckoutFlow: boolean;
  subscriptionUpgrades: boolean;
  multiCurrency: boolean;
}

// Configuration types
export interface AppConfig {
  app: {
    name: string;
    version: string;
    environment: "development" | "staging" | "production";
    url: string;
  };
  database: {
    url: string;
  };
  stripe: {
    publishableKey: string;
    secretKey: string;
    webhookSecret: string;
  };
  features: FeatureFlags;
}

// Type guards
export function isError(value: unknown): value is Error {
  return value instanceof Error;
}

export function isApiError(value: unknown): value is ApiError {
  return (
    typeof value === "object" &&
    value !== null &&
    "code" in value &&
    "message" in value
  );
}

export function hasProperty<K extends string>(
  obj: object,
  prop: K
): obj is Record<K, unknown> {
  return prop in obj;
}

// Result type for operations that can fail
export type Result<T, E = Error> =
  | { success: true; data: T }
  | { success: false; error: E };

// Helper to create success result
export function success<T>(data: T): Result<T> {
  return { success: true, data };
}

// Helper to create error result
export function failure<E>(error: E): Result<never, E> {
  return { success: false, error };
}

// Utility type for extracting result data type
export type ResultData<T> = T extends Result<infer U, unknown> ? U : never;

// Utility type for extracting result error type
export type ResultError<T> = T extends Result<unknown, infer E> ? E : never;
