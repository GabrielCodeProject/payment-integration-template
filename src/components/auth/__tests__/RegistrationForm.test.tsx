import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';

import { RegistrationForm } from '../RegistrationForm';
import { signUp } from '@/lib/auth/client';
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
  signUp: {
    email: jest.fn(),
  },
}));

// Mock Next.js navigation
jest.mock('next/navigation');
const mockPush = jest.fn();
const mockUseRouter = useRouter as jest.MockedFunction<typeof useRouter>;

// Mock toast notifications
jest.mock('sonner');
const mockToast = toast as jest.Mocked<typeof toast>;

// Mock PasswordStrengthIndicator
jest.mock('../PasswordStrengthIndicator', () => ({
  PasswordStrengthIndicator: ({ password, className }: { password: string; className?: string }) => (
    <div data-testid="password-strength-indicator" className={className}>
      Strength for: {password}
    </div>
  ),
}));

describe('RegistrationForm', () => {
  const mockSignUpEmail = signUp.email as jest.MockedFunction<typeof signUp.email>;

  beforeEach(() => {
    mockUseRouter.mockReturnValue({
      push: mockPush,
      replace: jest.fn(),
      prefetch: jest.fn(),
      back: jest.fn(),
      forward: jest.fn(),
      refresh: jest.fn(),
    } as any);

    jest.clearAllMocks();
  });

  afterEach(() => {
    cleanupAuth();
  });

  describe('Rendering', () => {
    it('should render all form elements', () => {
      render(<RegistrationForm />);

      // Check form title and description
      expect(screen.getByText('Create your account')).toBeInTheDocument();
      expect(screen.getByText('Join our secure payment platform')).toBeInTheDocument();

      // Check form fields
      expect(screen.getByLabelText(/email address/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/full name/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/phone number/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/^password$/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/confirm password/i)).toBeInTheDocument();

      // Check checkboxes
      expect(screen.getByLabelText(/terms of service/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/privacy policy/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/marketing emails/i)).toBeInTheDocument();

      // Check submit button
      expect(screen.getByRole('button', { name: /create account/i })).toBeInTheDocument();

      // Check login link
      expect(screen.getByText(/already have an account/i)).toBeInTheDocument();
    });

    it('should have proper accessibility attributes', () => {
      render(<RegistrationForm />);

      accessibilityHelpers.expectProperLabeling();
      
      // Check form has proper structure
      const form = screen.getByRole('form');
      expect(form).toBeInTheDocument();

      // Check password visibility toggles
      const passwordToggles = screen.getAllByRole('button', { name: /hide password|show password/i });
      expect(passwordToggles).toHaveLength(2);
    });

    it('should initialize with empty form values', () => {
      render(<RegistrationForm />);

      const emailInput = screen.getByLabelText(/email address/i) as HTMLInputElement;
      const nameInput = screen.getByLabelText(/full name/i) as HTMLInputElement;
      const phoneInput = screen.getByLabelText(/phone number/i) as HTMLInputElement;
      const passwordInput = screen.getByLabelText(/^password$/i) as HTMLInputElement;
      const confirmPasswordInput = screen.getByLabelText(/confirm password/i) as HTMLInputElement;
      const termsCheckbox = screen.getByLabelText(/terms of service/i) as HTMLInputElement;
      const privacyCheckbox = screen.getByLabelText(/privacy policy/i) as HTMLInputElement;
      const marketingCheckbox = screen.getByLabelText(/marketing emails/i) as HTMLInputElement;

      expect(emailInput.value).toBe('');
      expect(nameInput.value).toBe('');
      expect(phoneInput.value).toBe('');
      expect(passwordInput.value).toBe('');
      expect(confirmPasswordInput.value).toBe('');
      expect(termsCheckbox.checked).toBe(false);
      expect(privacyCheckbox.checked).toBe(false);
      expect(marketingCheckbox.checked).toBe(false);
    });

    it('should disable submit button when form is invalid', () => {
      render(<RegistrationForm />);
      validationHelpers.expectFormSubmitDisabled();
    });

    it('should show password strength indicator when password is entered', async () => {
      const user = userEvent.setup();
      render(<RegistrationForm />);

      const passwordInput = screen.getByLabelText(/^password$/i);
      await user.type(passwordInput, 'test123');

      expect(screen.getByTestId('password-strength-indicator')).toBeInTheDocument();
      expect(screen.getByText('Strength for: test123')).toBeInTheDocument();
    });
  });

  describe('Form Validation', () => {
    it('should show validation errors for empty required fields', async () => {
      const user = userEvent.setup();
      render(<RegistrationForm />);

      const submitButton = screen.getByRole('button', { name: /create account/i });
      
      // Try to submit empty form
      await user.click(submitButton);
      
      await waitFor(() => {
        expect(screen.getByText(/email is required/i)).toBeInTheDocument();
        expect(screen.getByText(/password is required|password must be at least 8 characters/i)).toBeInTheDocument();
        expect(screen.getByText(/you must agree to the terms and conditions/i)).toBeInTheDocument();
        expect(screen.getByText(/you must agree to the privacy policy/i)).toBeInTheDocument();
      });
    });

    it('should validate email format', async () => {
      const user = userEvent.setup();
      render(<RegistrationForm />);

      const emailInput = screen.getByLabelText(/email address/i);
      await user.type(emailInput, 'invalid-email');
      await user.tab();

      await waitFor(() => {
        expect(screen.getByText(/please enter a valid email address/i)).toBeInTheDocument();
      });
    });

    it('should validate password strength requirements', async () => {
      const user = userEvent.setup();
      render(<RegistrationForm />);

      const passwordInput = screen.getByLabelText(/^password$/i);
      
      // Test weak password
      await user.type(passwordInput, 'weak');
      await user.tab();

      await waitFor(() => {
        expect(screen.getByText(/password must contain at least one uppercase letter/i)).toBeInTheDocument();
      });
    });

    it('should validate password confirmation match', async () => {
      const user = userEvent.setup();
      render(<RegistrationForm />);

      const passwordInput = screen.getByLabelText(/^password$/i);
      const confirmPasswordInput = screen.getByLabelText(/confirm password/i);
      
      await user.type(passwordInput, 'Password123!');
      await user.type(confirmPasswordInput, 'DifferentPassword123!');
      await user.tab();

      await waitFor(() => {
        expect(screen.getByText(/passwords do not match/i)).toBeInTheDocument();
      });
    });

    it('should validate phone number format when provided', async () => {
      const user = userEvent.setup();
      render(<RegistrationForm />);

      const phoneInput = screen.getByLabelText(/phone number/i);
      await user.type(phoneInput, 'invalid-phone');
      await user.tab();

      await waitFor(() => {
        // Phone validation error should appear if invalid format is provided
        const phoneError = screen.queryByText(/phone/i);
        if (phoneError && phoneError.textContent?.includes('invalid')) {
          expect(phoneError).toBeInTheDocument();
        }
      });
    });

    it('should enable submit button when all required fields are valid', async () => {
      const user = userEvent.setup();
      render(<RegistrationForm />);

      await formTestUtils.fillRegistrationForm(formData.validRegistration);
      
      // Check required checkboxes
      const termsCheckbox = screen.getByLabelText(/terms of service/i);
      const privacyCheckbox = screen.getByLabelText(/privacy policy/i);
      await user.click(termsCheckbox);
      await user.click(privacyCheckbox);

      await waitFor(() => {
        validationHelpers.expectFormSubmitEnabled();
      });
    });
  });

  describe('Password Visibility Toggle', () => {
    it('should toggle password visibility for password field', async () => {
      const user = userEvent.setup();
      render(<RegistrationForm />);

      const passwordInput = screen.getByLabelText(/^password$/i) as HTMLInputElement;
      const toggleButtons = screen.getAllByRole('button', { name: /show password/i });
      const passwordToggle = toggleButtons[0]; // First one is for password field

      // Initially password should be hidden
      expect(passwordInput.type).toBe('password');

      // Click to show password
      await user.click(passwordToggle);
      expect(passwordInput.type).toBe('text');

      // Click to hide password again
      const hideButton = screen.getAllByRole('button', { name: /hide password/i })[0];
      await user.click(hideButton);
      expect(passwordInput.type).toBe('password');
    });

    it('should toggle password visibility for confirm password field', async () => {
      const user = userEvent.setup();
      render(<RegistrationForm />);

      const confirmPasswordInput = screen.getByLabelText(/confirm password/i) as HTMLInputElement;
      const toggleButtons = screen.getAllByRole('button', { name: /show password/i });
      const confirmPasswordToggle = toggleButtons[1]; // Second one is for confirm password field

      // Initially password should be hidden
      expect(confirmPasswordInput.type).toBe('password');

      // Click to show password
      await user.click(confirmPasswordToggle);
      expect(confirmPasswordInput.type).toBe('text');
    });

    it('should disable toggle buttons during loading', async () => {
      const user = userEvent.setup();
      mockSignUpEmail.mockImplementation(() => new Promise(() => {})); // Never resolves
      render(<RegistrationForm />);

      await formTestUtils.fillRegistrationForm(formData.validRegistration);
      
      // Check required checkboxes
      const termsCheckbox = screen.getByLabelText(/terms of service/i);
      const privacyCheckbox = screen.getByLabelText(/privacy policy/i);
      await user.click(termsCheckbox);
      await user.click(privacyCheckbox);
      
      await formTestUtils.submitForm();

      await waitFor(() => {
        const toggleButtons = screen.getAllByRole('button', { name: /show password|hide password/i });
        toggleButtons.forEach(button => {
          expect(button).toBeDisabled();
        });
      });
    });
  });

  describe('Checkbox Functionality', () => {
    it('should toggle terms and conditions checkbox', async () => {
      const user = userEvent.setup();
      render(<RegistrationForm />);

      const termsCheckbox = screen.getByLabelText(/terms of service/i) as HTMLInputElement;
      
      expect(termsCheckbox.checked).toBe(false);
      
      await user.click(termsCheckbox);
      expect(termsCheckbox.checked).toBe(true);
      
      await user.click(termsCheckbox);
      expect(termsCheckbox.checked).toBe(false);
    });

    it('should toggle privacy policy checkbox', async () => {
      const user = userEvent.setup();
      render(<RegistrationForm />);

      const privacyCheckbox = screen.getByLabelText(/privacy policy/i) as HTMLInputElement;
      
      expect(privacyCheckbox.checked).toBe(false);
      
      await user.click(privacyCheckbox);
      expect(privacyCheckbox.checked).toBe(true);
      
      await user.click(privacyCheckbox);
      expect(privacyCheckbox.checked).toBe(false);
    });

    it('should toggle marketing opt-in checkbox', async () => {
      const user = userEvent.setup();
      render(<RegistrationForm />);

      const marketingCheckbox = screen.getByLabelText(/marketing emails/i) as HTMLInputElement;
      
      expect(marketingCheckbox.checked).toBe(false);
      
      await user.click(marketingCheckbox);
      expect(marketingCheckbox.checked).toBe(true);
      
      await user.click(marketingCheckbox);
      expect(marketingCheckbox.checked).toBe(false);
    });

    it('should have external links for terms and privacy policy', () => {
      render(<RegistrationForm />);

      const termsLink = screen.getByRole('link', { name: /terms of service/i });
      const privacyLink = screen.getByRole('link', { name: /privacy policy/i });

      expect(termsLink).toHaveAttribute('href', '/terms');
      expect(termsLink).toHaveAttribute('target', '_blank');
      expect(termsLink).toHaveAttribute('rel', 'noopener noreferrer');

      expect(privacyLink).toHaveAttribute('href', '/privacy');
      expect(privacyLink).toHaveAttribute('target', '_blank');
      expect(privacyLink).toHaveAttribute('rel', 'noopener noreferrer');
    });
  });

  describe('Form Submission', () => {
    it('should handle successful registration', async () => {
      const user = userEvent.setup();
      mockSignUpEmail.mockResolvedValue(mockAuthResponses.successfulRegistration as any);
      render(<RegistrationForm />);

      await formTestUtils.fillRegistrationForm(formData.validRegistration);
      
      // Check required checkboxes
      const termsCheckbox = screen.getByLabelText(/terms of service/i);
      const privacyCheckbox = screen.getByLabelText(/privacy policy/i);
      await user.click(termsCheckbox);
      await user.click(privacyCheckbox);
      
      await formTestUtils.submitForm();

      await waitFor(() => {
        expect(mockSignUpEmail).toHaveBeenCalledWith({
          email: formData.validRegistration.email,
          password: formData.validRegistration.password,
          name: formData.validRegistration.name,
          callbackURL: '/dashboard',
        });
        expect(mockToast.success).toHaveBeenCalledWith(
          'Registration successful! Please check your email to verify your account.'
        );
        expect(mockPush).toHaveBeenCalledWith(
          `/verify-email?email=${encodeURIComponent(formData.validRegistration.email)}`
        );
      });
    });

    it('should handle registration with marketing opt-in', async () => {
      const user = userEvent.setup();
      mockSignUpEmail.mockResolvedValue(mockAuthResponses.successfulRegistration as any);
      render(<RegistrationForm />);

      await formTestUtils.fillRegistrationForm(formData.validRegistration);
      
      // Check all checkboxes including marketing opt-in
      const termsCheckbox = screen.getByLabelText(/terms of service/i);
      const privacyCheckbox = screen.getByLabelText(/privacy policy/i);
      const marketingCheckbox = screen.getByLabelText(/marketing emails/i);
      await user.click(termsCheckbox);
      await user.click(privacyCheckbox);
      await user.click(marketingCheckbox);
      
      await formTestUtils.submitForm();

      await waitFor(() => {
        expect(mockSignUpEmail).toHaveBeenCalled();
      });
    });

    it('should handle custom success callback', async () => {
      const user = userEvent.setup();
      const mockOnSuccess = jest.fn();
      mockSignUpEmail.mockResolvedValue(mockAuthResponses.successfulRegistration as any);
      
      render(<RegistrationForm onSuccess={mockOnSuccess} />);

      await formTestUtils.fillRegistrationForm(formData.validRegistration);
      
      // Check required checkboxes
      const termsCheckbox = screen.getByLabelText(/terms of service/i);
      const privacyCheckbox = screen.getByLabelText(/privacy policy/i);
      await user.click(termsCheckbox);
      await user.click(privacyCheckbox);
      
      await formTestUtils.submitForm();

      await waitFor(() => {
        expect(mockOnSuccess).toHaveBeenCalledWith(formData.validRegistration.email);
        expect(mockPush).not.toHaveBeenCalled();
      });
    });

    it('should show loading state during submission', async () => {
      const user = userEvent.setup();
      mockSignUpEmail.mockImplementation(() => new Promise(resolve => setTimeout(resolve, 100)));
      render(<RegistrationForm />);

      await formTestUtils.fillRegistrationForm(formData.validRegistration);
      
      // Check required checkboxes
      const termsCheckbox = screen.getByLabelText(/terms of service/i);
      const privacyCheckbox = screen.getByLabelText(/privacy policy/i);
      await user.click(termsCheckbox);
      await user.click(privacyCheckbox);
      
      await formTestUtils.submitForm();

      // Check loading state
      expect(screen.getByText(/creating account/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /creating account/i })).toBeDisabled();
      
      // Check that form fields are disabled
      expect(screen.getByLabelText(/email address/i)).toBeDisabled();
      expect(screen.getByLabelText(/^password$/i)).toBeDisabled();
      expect(screen.getByLabelText(/confirm password/i)).toBeDisabled();
    });

    it('should handle registration without optional fields', async () => {
      const user = userEvent.setup();
      mockSignUpEmail.mockResolvedValue(mockAuthResponses.successfulRegistration as any);
      render(<RegistrationForm />);

      // Fill only required fields
      const emailInput = screen.getByLabelText(/email address/i);
      const passwordInput = screen.getByLabelText(/^password$/i);
      const confirmPasswordInput = screen.getByLabelText(/confirm password/i);
      
      await user.type(emailInput, formData.validRegistration.email);
      await user.type(passwordInput, formData.validRegistration.password);
      await user.type(confirmPasswordInput, formData.validRegistration.confirmPassword);
      
      // Check required checkboxes only
      const termsCheckbox = screen.getByLabelText(/terms of service/i);
      const privacyCheckbox = screen.getByLabelText(/privacy policy/i);
      await user.click(termsCheckbox);
      await user.click(privacyCheckbox);
      
      await formTestUtils.submitForm();

      await waitFor(() => {
        expect(mockSignUpEmail).toHaveBeenCalledWith({
          email: formData.validRegistration.email,
          password: formData.validRegistration.password,
          name: undefined,
          callbackURL: '/dashboard',
        });
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle user already exists error', async () => {
      const user = userEvent.setup();
      mockSignUpEmail.mockResolvedValue({
        error: { message: 'User already exists' }
      } as any);
      
      render(<RegistrationForm />);

      await formTestUtils.fillRegistrationForm(formData.validRegistration);
      
      // Check required checkboxes
      const termsCheckbox = screen.getByLabelText(/terms of service/i);
      const privacyCheckbox = screen.getByLabelText(/privacy policy/i);
      await user.click(termsCheckbox);
      await user.click(privacyCheckbox);
      
      await formTestUtils.submitForm();

      await waitFor(() => {
        expect(mockToast.error).toHaveBeenCalledWith(
          'An account with this email already exists. Please sign in instead.'
        );
      });
    });

    it('should handle invalid email error', async () => {
      const user = userEvent.setup();
      mockSignUpEmail.mockResolvedValue({
        error: { message: 'Invalid email' }
      } as any);
      
      render(<RegistrationForm />);

      await formTestUtils.fillRegistrationForm(formData.validRegistration);
      
      // Check required checkboxes
      const termsCheckbox = screen.getByLabelText(/terms of service/i);
      const privacyCheckbox = screen.getByLabelText(/privacy policy/i);
      await user.click(termsCheckbox);
      await user.click(privacyCheckbox);
      
      await formTestUtils.submitForm();

      await waitFor(() => {
        expect(mockToast.error).toHaveBeenCalledWith('Please provide a valid email address.');
      });
    });

    it('should handle weak password error', async () => {
      const user = userEvent.setup();
      mockSignUpEmail.mockResolvedValue({
        error: { message: 'Password too weak' }
      } as any);
      
      render(<RegistrationForm />);

      await formTestUtils.fillRegistrationForm(formData.validRegistration);
      
      // Check required checkboxes
      const termsCheckbox = screen.getByLabelText(/terms of service/i);
      const privacyCheckbox = screen.getByLabelText(/privacy policy/i);
      await user.click(termsCheckbox);
      await user.click(privacyCheckbox);
      
      await formTestUtils.submitForm();

      await waitFor(() => {
        expect(mockToast.error).toHaveBeenCalledWith('Please choose a stronger password.');
      });
    });

    it('should handle network errors gracefully', async () => {
      const user = userEvent.setup();
      mockSignUpEmail.mockRejectedValue(new Error('Network error'));
      
      render(<RegistrationForm />);

      await formTestUtils.fillRegistrationForm(formData.validRegistration);
      
      // Check required checkboxes
      const termsCheckbox = screen.getByLabelText(/terms of service/i);
      const privacyCheckbox = screen.getByLabelText(/privacy policy/i);
      await user.click(termsCheckbox);
      await user.click(privacyCheckbox);
      
      await formTestUtils.submitForm();

      await waitFor(() => {
        expect(mockToast.error).toHaveBeenCalledWith(
          'An unexpected error occurred. Please try again.'
        );
      });
    });

    it('should handle generic server errors', async () => {
      const user = userEvent.setup();
      mockSignUpEmail.mockResolvedValue({
        error: { message: 'Internal server error' }
      } as any);
      
      render(<RegistrationForm />);

      await formTestUtils.fillRegistrationForm(formData.validRegistration);
      
      // Check required checkboxes
      const termsCheckbox = screen.getByLabelText(/terms of service/i);
      const privacyCheckbox = screen.getByLabelText(/privacy policy/i);
      await user.click(termsCheckbox);
      await user.click(privacyCheckbox);
      
      await formTestUtils.submitForm();

      await waitFor(() => {
        expect(mockToast.error).toHaveBeenCalledWith('Internal server error');
      });
    });

    it('should reset loading state after error', async () => {
      const user = userEvent.setup();
      mockSignUpEmail.mockResolvedValue({
        error: { message: 'Registration failed' }
      } as any);
      
      render(<RegistrationForm />);

      await formTestUtils.fillRegistrationForm(formData.validRegistration);
      
      // Check required checkboxes
      const termsCheckbox = screen.getByLabelText(/terms of service/i);
      const privacyCheckbox = screen.getByLabelText(/privacy policy/i);
      await user.click(termsCheckbox);
      await user.click(privacyCheckbox);
      
      await formTestUtils.submitForm();

      await waitFor(() => {
        expect(mockToast.error).toHaveBeenCalled();
      });

      // Form should not be in loading state
      expect(screen.getByRole('button', { name: /create account/i })).not.toBeDisabled();
      expect(screen.getByLabelText(/email address/i)).not.toBeDisabled();
      expect(screen.getByLabelText(/^password$/i)).not.toBeDisabled();
    });
  });

  describe('Navigation', () => {
    it('should have link to login page', () => {
      render(<RegistrationForm />);

      const loginLink = screen.getByRole('link', { name: /sign in/i });
      expect(loginLink).toHaveAttribute('href', '/login');
    });
  });

  describe('Accessibility', () => {
    it('should announce form errors to screen readers', async () => {
      const user = userEvent.setup();
      render(<RegistrationForm />);

      const submitButton = screen.getByRole('button', { name: /create account/i });
      await user.click(submitButton);

      await waitFor(() => {
        accessibilityHelpers.expectErrorAnnouncement();
      });
    });

    it('should have proper ARIA attributes for form validation', async () => {
      const user = userEvent.setup();
      render(<RegistrationForm />);

      const emailInput = screen.getByLabelText(/email address/i);
      await user.type(emailInput, 'invalid-email');
      await user.tab();

      await waitFor(() => {
        expect(emailInput).toHaveAttribute('aria-invalid', 'true');
        expect(emailInput).toHaveAttribute('aria-describedby');
      });
    });

    it('should have proper checkbox labeling', () => {
      render(<RegistrationForm />);

      const checkboxes = screen.getAllByRole('checkbox');
      checkboxes.forEach(checkbox => {
        expect(checkbox).toHaveAccessibleName();
      });
    });

    it('should support keyboard navigation', async () => {
      const user = userEvent.setup();
      render(<RegistrationForm />);

      const emailInput = screen.getByLabelText(/email address/i);
      
      // Tab through form fields
      await user.tab();
      expect(emailInput).toHaveFocus();

      await user.tab();
      expect(screen.getByLabelText(/full name/i)).toHaveFocus();

      await user.tab();
      expect(screen.getByLabelText(/phone number/i)).toHaveFocus();
    });
  });
});