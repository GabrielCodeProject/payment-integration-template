/**
 * Global type declarations for the payment integration application
 */

import type { Currency, Locale } from "./common";

declare global {
  // Extend Window interface for third-party integrations
  interface Window {
    Stripe?: any;
    gtag?: (...args: any[]) => void;
    dataLayer?: any[];
    Sentry?: any;
    Intercom?: any;
  }

  // Custom JSX elements for third-party components
  namespace JSX {
    interface IntrinsicElements {
      "stripe-pricing-table": React.DetailedHTMLProps<
        React.HTMLAttributes<HTMLElement> & {
          "pricing-table-id"?: string;
          "publishable-key"?: string;
          "client-reference-id"?: string;
          "customer-email"?: string;
          "customer-session-client-secret"?: string;
        },
        HTMLElement
      >;
      "stripe-buy-button": React.DetailedHTMLProps<
        React.HTMLAttributes<HTMLElement> & {
          "buy-button-id"?: string;
          "publishable-key"?: string;
        },
        HTMLElement
      >;
    }
  }

  // Global constants available throughout the app
  var __APP_VERSION__: string;
  var __BUILD_TIME__: string;
  var __COMMIT_HASH__: string;

  // Environment-specific globals
  namespace NodeJS {
    interface ProcessEnv {
      // Application
      NODE_ENV: "development" | "production" | "test";
      NEXT_PUBLIC_APP_URL: string;
      NEXT_PUBLIC_APP_NAME: string;
      NEXT_PUBLIC_APP_VERSION: string;

      // Database
      DATABASE_URL: string;
      REDIS_URL?: string;

      // Authentication
      BETTER_AUTH_SECRET: string;
      BETTER_AUTH_URL?: string;
      BETTER_AUTH_TRUSTED_ORIGINS?: string;

      // Stripe
      STRIPE_SECRET_KEY: string;
      NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: string;
      STRIPE_WEBHOOK_SECRET: string;
      STRIPE_CONNECT_WEBHOOK_SECRET?: string;

      // Email
      RESEND_API_KEY?: string;
      SMTP_HOST?: string;
      SMTP_PORT?: string;
      SMTP_USER?: string;
      SMTP_PASS?: string;

      // Analytics
      NEXT_PUBLIC_GA_MEASUREMENT_ID?: string;
      NEXT_PUBLIC_MIXPANEL_TOKEN?: string;
      SENTRY_DSN?: string;
      SENTRY_AUTH_TOKEN?: string;

      // Feature flags
      MAINTENANCE_MODE?: "true" | "false";
      DEBUG_MODE?: "true" | "false";
      STRIPE_TEST_MODE?: "true" | "false";
      NEW_CHECKOUT_FLOW?: "true" | "false";

      // Third-party integrations
      INTERCOM_APP_ID?: string;
      CRISP_WEBSITE_ID?: string;

      // File storage
      AWS_ACCESS_KEY_ID?: string;
      AWS_SECRET_ACCESS_KEY?: string;
      AWS_REGION?: string;
      AWS_S3_BUCKET?: string;

      // Rate limiting
      UPSTASH_REDIS_REST_URL?: string;
      UPSTASH_REDIS_REST_TOKEN?: string;
    }
  }
}

// Re-export common types for global access
export type { Currency, Locale };

// Global utility types
declare global {
  type Prettify<T> = {
    [K in keyof T]: T[K];
  } & {};

  type DeepPartial<T> = {
    [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
  };

  type DeepRequired<T> = {
    [P in keyof T]-?: T[P] extends object ? DeepRequired<T[P]> : T[P];
  };

  type ValueOf<T> = T[keyof T];

  type Entries<T> = {
    [K in keyof T]: [K, T[K]];
  }[keyof T][];

  type Keys<T> = keyof T;

  type Values<T> = T[keyof T];
}

export {};