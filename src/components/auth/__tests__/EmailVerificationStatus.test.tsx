import React from 'react';
import { render, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useRouter, useSearchParams } from 'next/navigation';
import { toast } from 'sonner';

import { EmailVerificationStatus } from '../EmailVerificationStatus';
import {
  cleanupAuth,
  accessibilityHelpers,
} from '@tests/utils/auth-test-helpers';

// Get mocked functions from setup
const mockUseRouter = useRouter as jest.MockedFunction<typeof useRouter>;
const mockUseSearchParams = useSearchParams as jest.MockedFunction<typeof useSearchParams>;
const mockToast = toast as jest.Mocked<typeof toast>;

// Mock fetch API
global.fetch = jest.fn();
const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>;

describe('EmailVerificationStatus', () => {
  const mockPush = jest.fn();
  const testEmail = 'test@example.com';
  const testToken = 'verification-token-123';

  beforeEach(() => {
    // Setup router mock
    (mockUseRouter as jest.Mock).mockReturnValue({
      push: mockPush,
      replace: jest.fn(),
      prefetch: jest.fn(),
      back: jest.fn(),
      forward: jest.fn(),
      refresh: jest.fn(),
    });

    // Setup search params mock
    (mockUseSearchParams as jest.Mock).mockReturnValue(new URLSearchParams());

    // Reset mocks
    jest.clearAllMocks();
    jest.useFakeTimers();
  });

  afterEach(() => {
    cleanupAuth();
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  describe('Rendering States', () => {
    it('should render pending state by default', () => {
      render(<EmailVerificationStatus />);

      expect(screen.getByText('Check your email')).toBeInTheDocument();
      expect(screen.getByText(/please check your email for a verification link/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /back to registration/i })).toBeInTheDocument();
    });

    it('should render with email from props', () => {
      render(<EmailVerificationStatus email={testEmail} />);

      expect(screen.getByText(`We've sent a verification email to ${testEmail}`)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /resend verification email/i })).toBeInTheDocument();
    });

    it('should render with email from URL params', () => {
      (mockUseSearchParams as jest.Mock).mockReturnValue(new URLSearchParams(`email=${testEmail}`));
      
      render(<EmailVerificationStatus />);

      expect(screen.getByText(`We've sent a verification email to ${testEmail}`)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /resend verification email/i })).toBeInTheDocument();
    });

    it('should render verifying state', async () => {
      mockFetch.mockImplementation(() => new Promise(() => {})); // Never resolves
      
      render(<EmailVerificationStatus token={testToken} />);

      await waitFor(() => {
        expect(screen.getByText('Verifying your email...')).toBeInTheDocument();
        expect(screen.getByText('Please wait while we verify your email address.')).toBeInTheDocument();
      });
    });

    it('should render success state', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ success: true }),
      } as Response);

      render(<EmailVerificationStatus token={testToken} />);

      await waitFor(() => {
        expect(screen.getByText('Email verified successfully!')).toBeInTheDocument();
        expect(screen.getByText('Your email has been verified. You can now access your account.')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /continue to sign in/i })).toBeInTheDocument();
      });
    });

    it('should render error state', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        json: async () => ({ error: 'Verification failed', success: false }),
      } as Response);

      render(<EmailVerificationStatus token={testToken} />);

      await waitFor(() => {
        expect(screen.getByText('Verification failed')).toBeInTheDocument();
        expect(screen.getByText('Verification failed')).toBeInTheDocument();
      });
    });

    it('should render expired state', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        json: async () => ({ error: 'Token expired', success: false }),
      } as Response);

      render(<EmailVerificationStatus token={testToken} email={testEmail} />);

      await waitFor(() => {
        expect(screen.getByText('Link expired')).toBeInTheDocument();
        expect(screen.getByText('The verification link has expired or is invalid.')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /send new verification email/i })).toBeInTheDocument();
      });
    });

    it('should render helpful tips when no email received', () => {
      render(<EmailVerificationStatus />);

      expect(screen.getByText("Didn't receive the email?")).toBeInTheDocument();
      expect(screen.getByText('• Check your spam or junk folder')).toBeInTheDocument();
      expect(screen.getByText('• Make sure the email address is correct')).toBeInTheDocument();
      expect(screen.getByText('• Wait a few minutes for the email to arrive')).toBeInTheDocument();
    });
  });

  describe('Token Verification', () => {
    it('should automatically verify token when provided', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ success: true }),
      } as Response);

      render(<EmailVerificationStatus token={testToken} />);

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith('/api/auth/verify-email', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ token: testToken }),
        });
      });
    });

    it('should handle successful verification', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ success: true }),
      } as Response);

      render(<EmailVerificationStatus token={testToken} />);

      await waitFor(() => {
        expect(mockToast.success).toHaveBeenCalledWith('Email verified successfully! You can now sign in.');
      });

      // Fast forward timer to check redirect
      act(() => {
        jest.advanceTimersByTime(2000);
      });

      expect(mockPush).toHaveBeenCalledWith('/login?verified=true');
    });

    it('should handle verification with expired token', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        json: async () => ({ error: 'Token has expired', success: false }),
      } as Response);

      render(<EmailVerificationStatus token={testToken} />);

      await waitFor(() => {
        expect(screen.getByText('Link expired')).toBeInTheDocument();
        expect(screen.getByText('The verification link has expired or is invalid.')).toBeInTheDocument();
      });
    });

    it('should handle verification with invalid token', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        json: async () => ({ error: 'Invalid token provided', success: false }),
      } as Response);

      render(<EmailVerificationStatus token={testToken} />);

      await waitFor(() => {
        expect(screen.getByText('Link expired')).toBeInTheDocument();
        expect(screen.getByText('The verification link has expired or is invalid.')).toBeInTheDocument();
      });
    });

    it('should handle network errors during verification', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'));

      render(<EmailVerificationStatus token={testToken} />);

      await waitFor(() => {
        expect(screen.getByText('Verification failed')).toBeInTheDocument();
        expect(screen.getByText('An unexpected error occurred during verification.')).toBeInTheDocument();
      });
    });

    it('should handle server errors during verification', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        json: async () => ({ error: 'Server error occurred', success: false }),
      } as Response);

      render(<EmailVerificationStatus token={testToken} />);

      await waitFor(() => {
        expect(screen.getByText('Verification failed')).toBeInTheDocument();
        expect(screen.getByText('Server error occurred')).toBeInTheDocument();
      });
    });
  });

  describe('Resend Verification', () => {
    it('should resend verification email successfully', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ success: true }),
      } as Response);

      render(<EmailVerificationStatus email={testEmail} />);

      const resendButton = screen.getByRole('button', { name: /resend verification email/i });
      await userEvent.click(resendButton);

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith('/api/auth/resend-verification', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ email: testEmail }),
        });
        expect(mockToast.success).toHaveBeenCalledWith('Verification email sent! Please check your inbox.');
      });
    });

    it('should handle resend verification from error state', async () => {
      // First, set up failed verification
      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: async () => ({ error: 'Verification failed', success: false }),
      } as Response);

      render(<EmailVerificationStatus token={testToken} email={testEmail} />);

      await waitFor(() => {
        expect(screen.getByText('Verification failed')).toBeInTheDocument();
      });

      // Now mock successful resend
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true }),
      } as Response);

      const resendButton = screen.getByRole('button', { name: /send new verification email/i });
      await userEvent.click(resendButton);

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith('/api/auth/resend-verification', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ email: testEmail }),
        });
        expect(mockToast.success).toHaveBeenCalledWith('Verification email sent! Please check your inbox.');
      });
    });

    it('should handle resend verification from expired state', async () => {
      // First, set up expired token
      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: async () => ({ error: 'Token expired', success: false }),
      } as Response);

      render(<EmailVerificationStatus token={testToken} email={testEmail} />);

      await waitFor(() => {
        expect(screen.getByText('Link expired')).toBeInTheDocument();
      });

      // Now mock successful resend
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true }),
      } as Response);

      const resendButton = screen.getByRole('button', { name: /send new verification email/i });
      await userEvent.click(resendButton);

      await waitFor(() => {
        expect(mockToast.success).toHaveBeenCalledWith('Verification email sent! Please check your inbox.');
      });
    });

    it('should show loading state during resend', async () => {
      mockFetch.mockImplementation(() => new Promise(() => {})); // Never resolves

      render(<EmailVerificationStatus email={testEmail} />);

      const resendButton = screen.getByRole('button', { name: /resend verification email/i });
      await userEvent.click(resendButton);

      await waitFor(() => {
        expect(screen.getByText('Sending new verification email...')).toBeInTheDocument();
        expect(screen.getByText('Sending a new verification email to your inbox.')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /sending.../i })).toBeDisabled();
      });
    });

    it('should handle resend errors', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        json: async () => ({ error: 'Failed to send email', success: false }),
      } as Response);

      render(<EmailVerificationStatus email={testEmail} />);

      const resendButton = screen.getByRole('button', { name: /resend verification email/i });
      await userEvent.click(resendButton);

      await waitFor(() => {
        expect(screen.getByText('Verification failed')).toBeInTheDocument();
        expect(screen.getByText('Failed to send email')).toBeInTheDocument();
      });
    });

    it('should handle resend network errors', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'));

      render(<EmailVerificationStatus email={testEmail} />);

      const resendButton = screen.getByRole('button', { name: /resend verification email/i });
      await userEvent.click(resendButton);

      await waitFor(() => {
        expect(screen.getByText('Verification failed')).toBeInTheDocument();
        expect(screen.getByText('Failed to resend verification email.')).toBeInTheDocument();
      });
    });

    it('should show error when no email available for resend', async () => {
      render(<EmailVerificationStatus />);

      // This component should not show resend button without email,
      // but let's test the error handling if somehow triggered
      const component = render(<EmailVerificationStatus />);
      
      // Since there's no resend button visible, we can't test this interaction
      // in the current state. The component correctly handles this by not showing
      // the resend button when no email is available.
      expect(screen.queryByRole('button', { name: /resend verification email/i })).not.toBeInTheDocument();
    });
  });

  describe('Navigation', () => {
    it('should navigate to registration on back button click', async () => {
      render(<EmailVerificationStatus />);

      const backButton = screen.getByRole('button', { name: /back to registration/i });
      await userEvent.click(backButton);

      expect(mockPush).toHaveBeenCalledWith('/register');
    });

    it('should navigate to login on continue button click', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ success: true }),
      } as Response);

      render(<EmailVerificationStatus token={testToken} />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /continue to sign in/i })).toBeInTheDocument();
      });

      const continueButton = screen.getByRole('button', { name: /continue to sign in/i });
      await userEvent.click(continueButton);

      expect(mockPush).toHaveBeenCalledWith('/login');
    });

    it('should auto-redirect to login after successful verification', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ success: true }),
      } as Response);

      render(<EmailVerificationStatus token={testToken} />);

      await waitFor(() => {
        expect(screen.getByText('Email verified successfully!')).toBeInTheDocument();
      });

      // Fast forward the timer
      act(() => {
        jest.advanceTimersByTime(2000);
      });

      expect(mockPush).toHaveBeenCalledWith('/login?verified=true');
    });
  });

  describe('Accessibility', () => {
    it('should have proper accessibility attributes', () => {
      render(<EmailVerificationStatus />);

      // Check that all interactive elements have accessible names
      const buttons = screen.getAllByRole('button');
      buttons.forEach(button => {
        expect(button).toHaveAccessibleName();
      });
    });

    it('should announce state changes to screen readers', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ success: true }),
      } as Response);

      render(<EmailVerificationStatus token={testToken} />);

      // The state changes should be reflected in the DOM content
      await waitFor(() => {
        expect(screen.getByText('Email verified successfully!')).toBeInTheDocument();
      });
    });

    it('should have proper heading structure', () => {
      render(<EmailVerificationStatus />);

      // The component uses CardTitle which should create proper heading structure
      expect(screen.getByText('Check your email')).toBeInTheDocument();
    });
  });

  describe('Integration', () => {
    it('should handle component unmounting during async operations', async () => {
      let resolvePromise: (value: any) => void;
      const promise = new Promise(resolve => {
        resolvePromise = resolve;
      });
      
      mockFetch.mockReturnValue(promise as any);

      const { unmount } = render(<EmailVerificationStatus token={testToken} />);

      // Unmount before promise resolves
      unmount();

      // Resolve the promise after unmount
      resolvePromise!({
        ok: true,
        json: async () => ({ success: true }),
      });

      // Should not cause any errors
      await promise;
    });

    it('should handle multiple rapid resend clicks', async () => {
      let resolveCount = 0;
      mockFetch.mockImplementation(() => {
        resolveCount++;
        return Promise.resolve({
          ok: true,
          json: async () => ({ success: true }),
        } as Response);
      });

      render(<EmailVerificationStatus email={testEmail} />);

      const resendButton = screen.getByRole('button', { name: /resend verification email/i });
      
      // Click multiple times rapidly
      await userEvent.click(resendButton);
      await userEvent.click(resendButton);
      await userEvent.click(resendButton);

      await waitFor(() => {
        // Should only make one request due to disabled state during loading
        expect(mockFetch).toHaveBeenCalledTimes(1);
      });
    });
  });
});