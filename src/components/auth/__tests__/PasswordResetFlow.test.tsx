/**
 * @jest-environment jsdom
 */
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { useRouter, useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import { ForgotPasswordForm } from '../ForgotPasswordForm';
import { ResetPasswordForm } from '../ResetPasswordForm';
import { forgetPassword, resetPassword } from '@/lib/auth/client';

// Mock dependencies
jest.mock('next/navigation', () => ({
  useRouter: jest.fn(),
  useSearchParams: jest.fn(),
}));

jest.mock('sonner', () => ({
  toast: {
    error: jest.fn(),
    success: jest.fn(),
  },
}));

jest.mock('@/lib/auth/client', () => ({
  forgetPassword: jest.fn(),
  resetPassword: jest.fn(),
}));

const mockRouter = {
  push: jest.fn(),
  back: jest.fn(),
  forward: jest.fn(),
  refresh: jest.fn(),
  replace: jest.fn(),
};

const mockSearchParams = {
  get: jest.fn(),
};

describe('Password Reset Flow', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (useRouter as jest.Mock).mockReturnValue(mockRouter);
    (useSearchParams as jest.Mock).mockReturnValue(mockSearchParams);
  });

  describe('ForgotPasswordForm', () => {
    it('renders forgot password form correctly', () => {
      render(<ForgotPasswordForm />);
      
      expect(screen.getByText('Forgot your password?')).toBeInTheDocument();
      expect(screen.getByText('Enter your email address and we\'ll send you a link to reset your password.')).toBeInTheDocument();
      expect(screen.getByLabelText('Email address')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /send reset link/i })).toBeInTheDocument();
    });

    it('validates email input correctly', async () => {
      render(<ForgotPasswordForm />);
      
      const emailInput = screen.getByLabelText('Email address');
      const submitButton = screen.getByRole('button', { name: /send reset link/i });

      // Test invalid email
      fireEvent.change(emailInput, { target: { value: 'invalid-email' } });
      expect(submitButton).toBeDisabled();

      // Test valid email
      fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
      await waitFor(() => {
        expect(submitButton).not.toBeDisabled();
      });
    });

    it('handles successful password reset request', async () => {
      (forgetPassword as jest.Mock).mockResolvedValue({ data: { success: true } });
      
      render(<ForgotPasswordForm />);
      
      const emailInput = screen.getByLabelText('Email address');
      const submitButton = screen.getByRole('button', { name: /send reset link/i });

      fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText('Check your email')).toBeInTheDocument();
        expect(screen.getByText(/If an account with the email/)).toBeInTheDocument();
      });
    });

    it('handles forgot password errors appropriately', async () => {
      (forgetPassword as jest.Mock).mockResolvedValue({ 
        error: { message: 'Rate limited' } 
      });
      
      render(<ForgotPasswordForm />);
      
      const emailInput = screen.getByLabelText('Email address');
      const submitButton = screen.getByRole('button', { name: /send reset link/i });

      fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith('Too many password reset attempts. Please wait before trying again.');
      });
    });

    it('shows back to sign in link', () => {
      render(<ForgotPasswordForm />);
      
      const backButton = screen.getByRole('button', { name: /back to sign in/i });
      fireEvent.click(backButton);
      
      expect(mockRouter.push).toHaveBeenCalledWith('/login');
    });
  });

  describe('ResetPasswordForm', () => {
    beforeEach(() => {
      mockSearchParams.get.mockReturnValue('valid-reset-token-123');
    });

    it('renders reset password form correctly', () => {
      render(<ResetPasswordForm />);
      
      expect(screen.getByText('Set New Password')).toBeInTheDocument();
      expect(screen.getByLabelText('New Password')).toBeInTheDocument();
      expect(screen.getByLabelText('Confirm New Password')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /update password/i })).toBeInTheDocument();
    });

    it('shows error when no token is provided', () => {
      mockSearchParams.get.mockReturnValue(null);
      
      render(<ResetPasswordForm />);
      
      expect(screen.getByText('Invalid Reset Link')).toBeInTheDocument();
      expect(screen.getByText('No reset token found. Please check your email for the reset link.')).toBeInTheDocument();
    });

    it('shows error for invalid token format', () => {
      mockSearchParams.get.mockReturnValue('abc'); // Too short
      
      render(<ResetPasswordForm />);
      
      expect(screen.getByText('Invalid Reset Link')).toBeInTheDocument();
      expect(screen.getByText('Invalid reset link. Please check your email for the correct link.')).toBeInTheDocument();
    });

    it('validates password matching', async () => {
      render(<ResetPasswordForm />);
      
      const newPasswordInput = screen.getByLabelText('New Password');
      const confirmPasswordInput = screen.getByLabelText('Confirm New Password');
      const submitButton = screen.getByRole('button', { name: /update password/i });

      fireEvent.change(newPasswordInput, { target: { value: 'Password123!' } });
      fireEvent.change(confirmPasswordInput, { target: { value: 'DifferentPassword123!' } });

      expect(submitButton).toBeDisabled();
    });

    it('handles successful password reset', async () => {
      (resetPassword as jest.Mock).mockResolvedValue({ data: { success: true } });
      
      render(<ResetPasswordForm />);
      
      const newPasswordInput = screen.getByLabelText('New Password');
      const confirmPasswordInput = screen.getByLabelText('Confirm New Password');
      const submitButton = screen.getByRole('button', { name: /update password/i });

      fireEvent.change(newPasswordInput, { target: { value: 'Password123!' } });
      fireEvent.change(confirmPasswordInput, { target: { value: 'Password123!' } });
      
      await waitFor(() => {
        expect(submitButton).not.toBeDisabled();
      });
      
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText('Password Reset Successfully')).toBeInTheDocument();
        expect(toast.success).toHaveBeenCalledWith('Password reset successfully! You can now sign in with your new password.');
      });
    });

    it('handles reset password errors', async () => {
      (resetPassword as jest.Mock).mockResolvedValue({ 
        error: { message: 'Token expired' } 
      });
      
      render(<ResetPasswordForm />);
      
      const newPasswordInput = screen.getByLabelText('New Password');
      const confirmPasswordInput = screen.getByLabelText('Confirm New Password');
      const submitButton = screen.getByRole('button', { name: /update password/i });

      fireEvent.change(newPasswordInput, { target: { value: 'Password123!' } });
      fireEvent.change(confirmPasswordInput, { target: { value: 'Password123!' } });
      
      await waitFor(() => {
        expect(submitButton).not.toBeDisabled();
      });
      
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText('Invalid Reset Link')).toBeInTheDocument();
        expect(screen.getByText('This reset link has expired. Please request a new password reset.')).toBeInTheDocument();
      });
    });

    it('shows password strength indicator', async () => {
      render(<ResetPasswordForm />);
      
      const newPasswordInput = screen.getByLabelText('New Password');
      fireEvent.change(newPasswordInput, { target: { value: 'weak' } });

      await waitFor(() => {
        expect(screen.getByText('Password strength')).toBeInTheDocument();
      });
    });

    it('toggles password visibility', () => {
      render(<ResetPasswordForm />);
      
      const newPasswordInput = screen.getByLabelText('New Password');
      const toggleButton = newPasswordInput.parentElement?.querySelector('button');
      
      expect(newPasswordInput).toHaveAttribute('type', 'password');
      
      if (toggleButton) {
        fireEvent.click(toggleButton);
        expect(newPasswordInput).toHaveAttribute('type', 'text');
      }
    });
  });

  describe('Accessibility', () => {
    it('has proper ARIA labels for forgot password form', () => {
      render(<ForgotPasswordForm />);
      
      const form = screen.getByRole('form');
      expect(form).toHaveAttribute('aria-label', 'Forgot password form');
    });

    it('has proper ARIA labels for reset password form', () => {
      mockSearchParams.get.mockReturnValue('valid-token');
      
      render(<ResetPasswordForm />);
      
      const form = screen.getByRole('form');
      expect(form).toHaveAttribute('aria-label', 'Reset password form');
    });

    it('has proper role and aria-live attributes for success states', async () => {
      (forgetPassword as jest.Mock).mockResolvedValue({ data: { success: true } });
      
      render(<ForgotPasswordForm />);
      
      const emailInput = screen.getByLabelText('Email address');
      const submitButton = screen.getByRole('button', { name: /send reset link/i });

      fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
      fireEvent.click(submitButton);

      await waitFor(() => {
        const successElement = screen.getByRole('status');
        expect(successElement).toHaveAttribute('aria-live', 'polite');
      });
    });

    it('has proper role and aria-live attributes for error states', () => {
      mockSearchParams.get.mockReturnValue('invalid');
      
      render(<ResetPasswordForm />);
      
      const errorElement = screen.getByRole('alert');
      expect(errorElement).toHaveAttribute('aria-live', 'assertive');
    });
  });
});