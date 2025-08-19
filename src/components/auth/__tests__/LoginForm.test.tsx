import React from 'react';
import { render, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useRouter, useSearchParams } from 'next/navigation';
import { toast } from 'sonner';

import { LoginForm } from '../LoginForm';
import { signIn } from '@/lib/auth/client';
import {
  mockAuthResponses,
  formData,
  formTestUtils,
  validationHelpers,
  accessibilityHelpers,
  cleanupAuth,
} from '@tests/utils/auth-test-helpers';

// Mock the auth client
jest.mock('@/lib/auth/client', () => ({
  signIn: {
    email: jest.fn(),
  },
}));

// Get mocked functions from setup
const mockUseRouter = useRouter as jest.MockedFunction<typeof useRouter>;
const mockUseSearchParams = useSearchParams as jest.MockedFunction<typeof useSearchParams>;
const mockToast = toast as jest.Mocked<typeof toast>;

describe('LoginForm', () => {
  const mockSignInEmail = signIn.email as jest.MockedFunction<typeof signIn.email>;

  beforeEach(() => {
    // Reset mocks without reconfiguring them
    jest.clearAllMocks();
    
    // Set default return values
    (mockUseSearchParams as jest.Mock).mockReturnValue(new URLSearchParams());
  });

  afterEach(() => {
    cleanupAuth();
  });

  describe('Rendering', () => {
    it('should render all form elements', () => {
      render(<LoginForm />);

      // Check form title and description
      expect(screen.getByText('Welcome back')).toBeInTheDocument();
      expect(screen.getByText('Sign in to your account')).toBeInTheDocument();

      // Check form fields
      expect(screen.getByLabelText(/email address/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/^password$/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/remember me/i)).toBeInTheDocument();

      // Check buttons and links
      expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /forgot password/i })).toBeInTheDocument();
      expect(screen.getByText(/don't have an account/i)).toBeInTheDocument();
    });

    it('should have proper accessibility attributes', () => {
      render(<LoginForm />);

      accessibilityHelpers.expectProperLabeling();
      
      // Check form has proper structure
      const form = screen.getByRole('form');
      expect(form).toBeInTheDocument();

      // Check password visibility toggle
      const passwordToggle = screen.getByRole('button', { name: /hide password|show password/i });
      expect(passwordToggle).toBeInTheDocument();
    });

    it('should initialize with empty form values', () => {
      render(<LoginForm />);

      const emailInput = screen.getByLabelText(/email address/i) as HTMLInputElement;
      const passwordInput = screen.getByLabelText(/^password$/i) as HTMLInputElement;
      const rememberMeCheckbox = screen.getByLabelText(/remember me/i) as HTMLInputElement;

      expect(emailInput.value).toBe('');
      expect(passwordInput.value).toBe('');
      expect(rememberMeCheckbox.checked).toBe(false);
    });

    it('should disable submit button when form is invalid', () => {
      render(<LoginForm />);
      validationHelpers.expectFormSubmitDisabled();
    });
  });

  describe('Form Validation', () => {
    it('should show validation errors for empty fields', async () => {
      const user = userEvent.setup();
      render(<LoginForm />);

      const submitButton = screen.getByRole('button', { name: /sign in/i });
      
      // Try to submit empty form
      await user.click(submitButton);
      
      await waitFor(() => {
        expect(screen.getByText(/email is required/i)).toBeInTheDocument();
        expect(screen.getByText(/password is required/i)).toBeInTheDocument();
      });
    });

    it('should show validation error for invalid email format', async () => {
      const user = userEvent.setup();
      render(<LoginForm />);

      const emailInput = screen.getByLabelText(/email address/i);
      await user.type(emailInput, 'invalid-email');
      await user.tab(); // Trigger blur event

      await waitFor(() => {
        expect(screen.getByText(/please enter a valid email address/i)).toBeInTheDocument();
      });
    });

    it('should enable submit button when form is valid', async () => {
      const user = userEvent.setup();
      render(<LoginForm />);

      await formTestUtils.fillLoginForm(formData.validLogin.email, formData.validLogin.password);

      await waitFor(() => {
        validationHelpers.expectFormSubmitEnabled();
      });
    });

    it('should validate form fields on change', async () => {
      const user = userEvent.setup();
      render(<LoginForm />);

      const emailInput = screen.getByLabelText(/email address/i);
      
      // Enter invalid email
      await user.type(emailInput, 'invalid');
      validationHelpers.expectFieldError('email', /please enter a valid email address/i);

      // Fix email
      await user.clear(emailInput);
      await user.type(emailInput, 'valid@example.com');
      
      await waitFor(() => {
        validationHelpers.expectFieldValid('email');
      });
    });
  });

  describe('Password Visibility Toggle', () => {
    it('should toggle password visibility', async () => {
      const user = userEvent.setup();
      render(<LoginForm />);

      const passwordInput = screen.getByLabelText(/^password$/i) as HTMLInputElement;
      const toggleButton = screen.getByRole('button', { name: /show password/i });

      // Initially password should be hidden
      expect(passwordInput.type).toBe('password');

      // Click to show password
      await user.click(toggleButton);
      expect(passwordInput.type).toBe('text');

      // Click to hide password again
      const hideButton = screen.getByRole('button', { name: /hide password/i });
      await user.click(hideButton);
      expect(passwordInput.type).toBe('password');
    });

    it('should disable toggle button during loading', async () => {
      const user = userEvent.setup();
      mockSignInEmail.mockImplementation(() => new Promise(() => {})); // Never resolves
      render(<LoginForm />);

      await formTestUtils.fillLoginForm(formData.validLogin.email, formData.validLogin.password);
      await formTestUtils.submitForm();

      await waitFor(() => {
        const toggleButton = screen.getByRole('button', { name: /show password|hide password/i });
        expect(toggleButton).toBeDisabled();
      });
    });
  });

  describe('Remember Me Functionality', () => {
    it('should toggle remember me checkbox', async () => {
      const user = userEvent.setup();
      render(<LoginForm />);

      const rememberMeCheckbox = screen.getByLabelText(/remember me/i) as HTMLInputElement;
      
      // Initially unchecked
      expect(rememberMeCheckbox.checked).toBe(false);

      // Click to check
      await user.click(rememberMeCheckbox);
      expect(rememberMeCheckbox.checked).toBe(true);

      // Click to uncheck
      await user.click(rememberMeCheckbox);
      expect(rememberMeCheckbox.checked).toBe(false);
    });

    it('should send remember me value in login request', async () => {
      const user = userEvent.setup();
      mockSignInEmail.mockResolvedValue(mockAuthResponses.successfulLogin as any);
      render(<LoginForm />);

      await formTestUtils.fillLoginForm(formData.validLogin.email, formData.validLogin.password);
      
      const rememberMeCheckbox = screen.getByLabelText(/remember me/i);
      await user.click(rememberMeCheckbox);
      
      await formTestUtils.submitForm();

      await waitFor(() => {
        expect(mockSignInEmail).toHaveBeenCalledWith({
          email: formData.validLogin.email,
          password: formData.validLogin.password,
          rememberMe: true,
        });
      });
    });
  });

  describe('Form Submission', () => {
    it('should handle successful login', async () => {
      const user = userEvent.setup();
      mockSignInEmail.mockResolvedValue(mockAuthResponses.successfulLogin as any);
      render(<LoginForm />);

      await formTestUtils.fillLoginForm(formData.validLogin.email, formData.validLogin.password);
      await formTestUtils.submitForm();

      await waitFor(() => {
        expect(mockSignInEmail).toHaveBeenCalledWith({
          email: formData.validLogin.email,
          password: formData.validLogin.password,
          rememberMe: false,
        });
        expect(mockToast.success).toHaveBeenCalledWith(
          'Welcome back! You have been signed in successfully.'
        );
        const router = mockUseRouter();
        expect(router.push).toHaveBeenCalledWith('/dashboard');
      });
    });

    it('should handle custom success callback', async () => {
      const user = userEvent.setup();
      const mockOnSuccess = jest.fn();
      mockSignInEmail.mockResolvedValue(mockAuthResponses.successfulLogin as any);
      
      render(<LoginForm onSuccess={mockOnSuccess} />);

      await formTestUtils.fillLoginForm(formData.validLogin.email, formData.validLogin.password);
      await formTestUtils.submitForm();

      await waitFor(() => {
        expect(mockOnSuccess).toHaveBeenCalledWith(formData.validLogin.email);
        expect(mockPush).not.toHaveBeenCalled();
      });
    });

    it('should handle return URL redirect', async () => {
      const user = userEvent.setup();
      mockSignInEmail.mockResolvedValue(mockAuthResponses.successfulLogin as any);
      mockUseSearchParams.mockReturnValue(new URLSearchParams('returnTo=/profile'));
      
      render(<LoginForm />);

      await formTestUtils.fillLoginForm(formData.validLogin.email, formData.validLogin.password);
      await formTestUtils.submitForm();

      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith('/profile');
      });
    });

    it('should sanitize return URL for security', async () => {
      const user = userEvent.setup();
      mockSignInEmail.mockResolvedValue(mockAuthResponses.successfulLogin as any);
      mockUseSearchParams.mockReturnValue(new URLSearchParams('returnTo=//malicious.com/redirect'));
      
      render(<LoginForm />);

      await formTestUtils.fillLoginForm(formData.validLogin.email, formData.validLogin.password);
      await formTestUtils.submitForm();

      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith('/dashboard'); // Default redirect
      });
    });

    it('should show loading state during submission', async () => {
      const user = userEvent.setup();
      mockSignInEmail.mockImplementation(() => new Promise(resolve => setTimeout(resolve, 100)));
      render(<LoginForm />);

      await formTestUtils.fillLoginForm(formData.validLogin.email, formData.validLogin.password);
      await formTestUtils.submitForm();

      // Check loading state
      expect(screen.getByText(/signing in/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /signing in/i })).toBeDisabled();
      
      // Check that form fields are disabled
      expect(screen.getByLabelText(/email address/i)).toBeDisabled();
      expect(screen.getByLabelText(/^password$/i)).toBeDisabled();
      expect(screen.getByLabelText(/remember me/i)).toBeDisabled();
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid credentials error', async () => {
      const user = userEvent.setup();
      mockSignInEmail.mockResolvedValue({
        error: { message: 'Invalid email or password' }
      } as any);
      
      render(<LoginForm />);

      await formTestUtils.fillLoginForm(formData.invalidLogin.email, formData.invalidLogin.password);
      await formTestUtils.submitForm();

      await waitFor(() => {
        expect(mockToast.error).toHaveBeenCalledWith(
          'Invalid email or password. Please check your credentials and try again.'
        );
      });
    });

    it('should handle unverified email error with resend option', async () => {
      const user = userEvent.setup();
      mockSignInEmail.mockResolvedValue({
        error: { message: 'Email not verified' }
      } as any);
      
      render(<LoginForm />);

      await formTestUtils.fillLoginForm(formData.validLogin.email, formData.validLogin.password);
      await formTestUtils.submitForm();

      await waitFor(() => {
        expect(mockToast.error).toHaveBeenCalledWith(
          'Please verify your email address before signing in.',
          expect.objectContaining({
            action: expect.objectContaining({
              label: 'Resend',
              onClick: expect.any(Function)
            })
          })
        );
      });
    });

    it('should handle account disabled error', async () => {
      const user = userEvent.setup();
      mockSignInEmail.mockResolvedValue({
        error: { message: 'Account disabled' }
      } as any);
      
      render(<LoginForm />);

      await formTestUtils.fillLoginForm(formData.validLogin.email, formData.validLogin.password);
      await formTestUtils.submitForm();

      await waitFor(() => {
        expect(mockToast.error).toHaveBeenCalledWith(
          'Your account has been disabled. Please contact support for assistance.'
        );
      });
    });

    it('should handle rate limiting error', async () => {
      const user = userEvent.setup();
      mockSignInEmail.mockResolvedValue({
        error: { message: 'Too many attempts' }
      } as any);
      
      render(<LoginForm />);

      await formTestUtils.fillLoginForm(formData.validLogin.email, formData.validLogin.password);
      await formTestUtils.submitForm();

      await waitFor(() => {
        expect(mockToast.error).toHaveBeenCalledWith(
          'Too many login attempts. Please wait a few minutes before trying again.'
        );
      });
    });

    it('should handle two factor authentication required', async () => {
      const user = userEvent.setup();
      mockSignInEmail.mockResolvedValue({
        error: { message: 'Two factor required' }
      } as any);
      
      render(<LoginForm />);

      await formTestUtils.fillLoginForm(formData.validLogin.email, formData.validLogin.password);
      await formTestUtils.submitForm();

      await waitFor(() => {
        expect(mockToast.error).toHaveBeenCalledWith('Two-factor authentication required.');
      });
    });

    it('should handle network errors gracefully', async () => {
      const user = userEvent.setup();
      mockSignInEmail.mockRejectedValue(new Error('Network error'));
      
      render(<LoginForm />);

      await formTestUtils.fillLoginForm(formData.validLogin.email, formData.validLogin.password);
      await formTestUtils.submitForm();

      await waitFor(() => {
        expect(mockToast.error).toHaveBeenCalledWith(
          'An unexpected error occurred. Please try again.'
        );
      });
    });

    it('should handle generic server errors', async () => {
      const user = userEvent.setup();
      mockSignInEmail.mockResolvedValue({
        error: { message: 'Internal server error' }
      } as any);
      
      render(<LoginForm />);

      await formTestUtils.fillLoginForm(formData.validLogin.email, formData.validLogin.password);
      await formTestUtils.submitForm();

      await waitFor(() => {
        expect(mockToast.error).toHaveBeenCalledWith('Internal server error');
      });
    });

    it('should reset loading state after error', async () => {
      const user = userEvent.setup();
      mockSignInEmail.mockResolvedValue({
        error: { message: 'Invalid credentials' }
      } as any);
      
      render(<LoginForm />);

      await formTestUtils.fillLoginForm(formData.validLogin.email, formData.validLogin.password);
      await formTestUtils.submitForm();

      await waitFor(() => {
        expect(mockToast.error).toHaveBeenCalled();
      });

      // Form should not be in loading state
      expect(screen.getByRole('button', { name: /sign in/i })).not.toBeDisabled();
      expect(screen.getByLabelText(/email address/i)).not.toBeDisabled();
      expect(screen.getByLabelText(/^password$/i)).not.toBeDisabled();
    });
  });

  describe('Navigation', () => {
    it('should navigate to forgot password page', async () => {
      const user = userEvent.setup();
      render(<LoginForm />);

      const forgotPasswordButton = screen.getByRole('button', { name: /forgot password/i });
      await user.click(forgotPasswordButton);

      expect(mockPush).toHaveBeenCalledWith('/forgot-password');
    });

    it('should have link to registration page', () => {
      render(<LoginForm />);

      const registerLink = screen.getByRole('link', { name: /create account/i });
      expect(registerLink).toHaveAttribute('href', '/register');
    });
  });

  describe('Keyboard Navigation', () => {
    it('should support keyboard navigation through form fields', async () => {
      const user = userEvent.setup();
      render(<LoginForm />);

      const emailInput = screen.getByLabelText(/email address/i);
      const passwordInput = screen.getByLabelText(/^password$/i);
      const rememberMeCheckbox = screen.getByLabelText(/remember me/i);
      const submitButton = screen.getByRole('button', { name: /sign in/i });

      // Tab through form fields
      await user.tab();
      expect(emailInput).toHaveFocus();

      await user.tab();
      expect(passwordInput).toHaveFocus();

      await user.tab();
      expect(screen.getByRole('button', { name: /show password/i })).toHaveFocus();

      await user.tab();
      expect(rememberMeCheckbox).toHaveFocus();

      await user.tab();
      expect(screen.getByRole('button', { name: /forgot password/i })).toHaveFocus();

      await user.tab();
      expect(submitButton).toHaveFocus();
    });

    it('should submit form on Enter key press', async () => {
      const user = userEvent.setup();
      mockSignInEmail.mockResolvedValue(mockAuthResponses.successfulLogin as any);
      render(<LoginForm />);

      await formTestUtils.fillLoginForm(formData.validLogin.email, formData.validLogin.password);
      
      // Press Enter in password field
      const passwordInput = screen.getByLabelText(/^password$/i);
      await user.type(passwordInput, '{enter}');

      await waitFor(() => {
        expect(mockSignInEmail).toHaveBeenCalled();
      });
    });
  });

  describe('Accessibility', () => {
    it('should announce form errors to screen readers', async () => {
      const user = userEvent.setup();
      render(<LoginForm />);

      const submitButton = screen.getByRole('button', { name: /sign in/i });
      await user.click(submitButton);

      await waitFor(() => {
        accessibilityHelpers.expectErrorAnnouncement();
      });
    });

    it('should have proper ARIA attributes for form validation', async () => {
      const user = userEvent.setup();
      render(<LoginForm />);

      const emailInput = screen.getByLabelText(/email address/i);
      await user.type(emailInput, 'invalid-email');
      await user.tab();

      await waitFor(() => {
        expect(emailInput).toHaveAttribute('aria-invalid', 'true');
        expect(emailInput).toHaveAttribute('aria-describedby');
      });
    });

    it('should have proper form structure for screen readers', () => {
      render(<LoginForm />);

      const form = screen.getByRole('form');
      expect(form).toBeInTheDocument();

      // Check that all form controls are properly labeled
      const formControls = screen.getAllByRole('textbox')
        .concat(screen.getAllByRole('checkbox'))
        .concat(screen.getAllByRole('button'));

      formControls.forEach(control => {
        expect(control).toHaveAccessibleName();
      });
    });
  });
});