import '@testing-library/jest-dom';
import { configure } from '@testing-library/react';
import { jest } from '@jest/globals';
import React from 'react';

// Configure React Testing Library
configure({
  testIdAttribute: 'data-testid',
});

// Create mock functions that can be controlled in tests
const mockPush = jest.fn();
const mockReplace = jest.fn();
const mockPrefetch = jest.fn();
const mockBack = jest.fn();
const mockForward = jest.fn();
const mockRefresh = jest.fn();

// Mock Next.js router
jest.mock('next/navigation', () => ({
  useRouter: jest.fn(() => ({
    push: mockPush,
    replace: mockReplace,
    prefetch: mockPrefetch,
    back: mockBack,
    forward: mockForward,
    refresh: mockRefresh,
  })),
  useSearchParams: jest.fn(() => new URLSearchParams()),
  usePathname: jest.fn(() => '/'),
}));

// Mock Next.js image component
jest.mock('next/image', () => {
  const MockedImage = (props: any) => {
    return React.createElement('img', props);
  };
  MockedImage.displayName = 'Image';
  return {
    __esModule: true,
    default: MockedImage,
  };
});

// Mock Better Auth client
jest.mock('better-auth/react', () => ({
  useSession: jest.fn(() => ({
    data: null,
    isPending: false,
    error: null,
  })),
  signIn: jest.fn(),
  signOut: jest.fn(),
  signUp: jest.fn(),
}));

// Mock Better Auth client methods
jest.mock('@/lib/auth/client', () => ({
  authClient: {
    signIn: jest.fn(),
    signOut: jest.fn(),
    signUp: jest.fn(),
    resetPassword: jest.fn(),
    forgotPassword: jest.fn(),
    verifyEmail: jest.fn(),
    useSession: jest.fn(() => ({
      data: null,
      isPending: false,
      error: null,
    })),
  },
  signIn: {
    email: jest.fn(),
  },
  signUp: {
    email: jest.fn(),
  },
  signOut: jest.fn(),
  useSession: jest.fn(() => ({
    data: null,
    isPending: false,
    error: null,
  })),
  getSession: jest.fn(),
  forgetPassword: jest.fn(),
  resetPassword: jest.fn(),
}));

// Mock UI components that might have complex dependencies
jest.mock('@radix-ui/react-checkbox', () => ({
  Root: React.forwardRef(({ children, checked, onCheckedChange, ...props }: any, ref: any) => 
    React.createElement('input', { 
      type: 'checkbox', 
      ref,
      checked: checked || false,
      onChange: onCheckedChange ? (e: any) => onCheckedChange(e.target.checked) : undefined,
      ...props 
    })
  ),
  Indicator: ({ children, ...props }: any) => React.createElement('span', props, children),
}));

jest.mock('@radix-ui/react-label', () => ({
  Root: React.forwardRef(({ children, ...props }: any, ref: any) => 
    React.createElement('label', { ref, ...props }, children)
  ),
}));

jest.mock('@radix-ui/react-slot', () => ({
  Slot: React.forwardRef(({ children, ...props }: any, ref: any) => 
    React.createElement('div', { ref, ...props }, children)
  ),
}));

jest.mock('@radix-ui/react-progress', () => ({
  Root: React.forwardRef(({ children, value, ...props }: any, ref: any) => 
    React.createElement('div', { ref, role: 'progressbar', 'aria-valuenow': value, ...props }, children)
  ),
  Indicator: React.forwardRef(({ children, ...props }: any, ref: any) => 
    React.createElement('div', { ref, ...props }, children)
  ),
}));

// Mock auth store if it exists (optional for now)

// Mock toast notifications
jest.mock('sonner', () => ({
  toast: {
    success: jest.fn(),
    error: jest.fn(),
    info: jest.fn(),
    warning: jest.fn(),
    loading: jest.fn(),
    dismiss: jest.fn(),
  },
}));

// Mock environment variables
(process.env as any).NODE_ENV = 'test';
process.env.NEXT_PUBLIC_APP_URL = 'http://localhost:3000';

// Global test utilities
declare global {
  namespace jest {
    interface Matchers<R> {
      toBeInTheDocument(): R;
      toHaveClass(className: string): R;
      toHaveAttribute(attr: string, value?: string): R;
      toBeVisible(): R;
      toBeDisabled(): R;
      toHaveValue(value: string | string[] | number): R;
    }
  }
}

// Silence console errors/warnings in tests unless explicitly needed
const originalError = // console.error;
const originalWarn = // console.warn;

beforeAll(() => {
  // console.error = (...args: any[]) => {
    if (
      typeof args[0] === 'string' &&
      (args[0].includes('Warning:') ||
        args[0].includes('React does not recognize') ||
        args[0].includes('validateDOMNesting'))
    ) {
      return;
    }
    originalError.call(console, ...args);
  };

  // console.warn = (...args: any[]) => {
    if (
      typeof args[0] === 'string' &&
      (args[0].includes('Warning:') || args[0].includes('React does not recognize'))
    ) {
      return;
    }
    originalWarn.call(console, ...args);
  };
});

afterAll(() => {
  // console.error = originalError;
  // console.warn = originalWarn;
});

// Clean up after each test
afterEach(() => {
  jest.clearAllMocks();
});