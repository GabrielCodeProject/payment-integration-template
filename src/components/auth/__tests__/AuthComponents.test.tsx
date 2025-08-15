/**
 * Basic component tests for authentication components
 * Note: These are simple render tests. Full integration tests should be done with actual authentication
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';

// Mock Next.js router
jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
    back: jest.fn(),
  }),
  useSearchParams: () => ({
    get: jest.fn(() => null),
  }),
}));

// Mock BetterAuth client
jest.mock('@/lib/auth/client', () => ({
  signIn: {
    email: jest.fn(),
  },
  signOut: jest.fn(),
  useSession: () => ({
    data: null,
    isPending: false,
  }),
}));

// Mock Sonner
jest.mock('sonner', () => ({
  toast: {
    success: jest.fn(),
    error: jest.fn(),
  },
}));

import { LoginForm } from '../LoginForm';
import { LogoutButton } from '../LogoutButton';
import { UserMenu } from '../UserMenu';

describe('Authentication Components', () => {
  describe('LoginForm', () => {
    it('renders login form with all required fields', () => {
      render(<LoginForm />);
      
      expect(screen.getByRole('heading', { name: /welcome back/i })).toBeInTheDocument();
      expect(screen.getByLabelText(/email address/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/remember me/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument();
      expect(screen.getByText(/forgot password/i)).toBeInTheDocument();
      expect(screen.getByText(/create account/i)).toBeInTheDocument();
    });

    it('has proper accessibility attributes', () => {
      render(<LoginForm />);
      
      const emailInput = screen.getByLabelText(/email address/i);
      const passwordInput = screen.getByLabelText(/password/i);
      
      expect(emailInput).toHaveAttribute('type', 'email');
      expect(emailInput).toHaveAttribute('autoComplete', 'email');
      expect(passwordInput).toHaveAttribute('type', 'password');
      expect(passwordInput).toHaveAttribute('autoComplete', 'current-password');
    });
  });

  describe('LogoutButton', () => {
    it('does not render when user is not logged in', () => {
      render(<LogoutButton />);
      
      // Should not find the logout button since no session
      expect(screen.queryByRole('button')).not.toBeInTheDocument();
    });
  });

  describe('UserMenu', () => {
    it('shows sign in button when not authenticated', () => {
      render(<UserMenu />);
      
      expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument();
    });

    it('shows loading state when session is pending', () => {
      // Mock pending state
      jest.mocked(useSession).mockReturnValue({
        data: null,
        isPending: true,
      });

      render(<UserMenu />);
      
      // Should see loading skeleton
      expect(screen.getByRole('generic')).toHaveClass('animate-pulse');
    });
  });
});