import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ReactElement } from 'react';
import { jest } from '@jest/globals';

// Mock user data for testing
export const mockUsers = {
  validUser: {
    id: 'user-123',
    email: 'test@example.com',
    name: 'Test User',
    emailVerified: true,
    createdAt: new Date('2023-01-01'),
    updatedAt: new Date('2023-01-01'),
  },
  unverifiedUser: {
    id: 'user-456',
    email: 'unverified@example.com',
    name: 'Unverified User',
    emailVerified: false,
    createdAt: new Date('2023-01-01'),
    updatedAt: new Date('2023-01-01'),
  },
  adminUser: {
    id: 'admin-789',
    email: 'admin@example.com',
    name: 'Admin User',
    emailVerified: true,
    role: 'admin',
    createdAt: new Date('2023-01-01'),
    updatedAt: new Date('2023-01-01'),
  },
};

// Mock session data
export const mockSessions = {
  authenticatedSession: {
    data: {
      user: mockUsers.validUser,
      session: {
        id: 'session-123',
        userId: 'user-123',
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours from now
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    },
    isPending: false,
    error: null,
  },
  unauthenticatedSession: {
    data: null,
    isPending: false,
    error: null,
  },
  loadingSession: {
    data: null,
    isPending: true,
    error: null,
  },
  errorSession: {
    data: null,
    isPending: false,
    error: new Error('Authentication failed'),
  },
};

// Mock auth client responses
export const mockAuthResponses = {
  successfulLogin: {
    success: true,
    data: {
      user: mockUsers.validUser,
      session: mockSessions.authenticatedSession.data?.session,
    },
  },
  failedLogin: {
    success: false,
    error: {
      message: 'Invalid credentials',
      code: 'INVALID_CREDENTIALS',
    },
  },
  successfulRegistration: {
    success: true,
    data: {
      user: mockUsers.unverifiedUser,
      requiresVerification: true,
    },
  },
  failedRegistration: {
    success: false,
    error: {
      message: 'Email already exists',
      code: 'EMAIL_EXISTS',
    },
  },
  passwordResetSent: {
    success: true,
    message: 'Password reset email sent',
  },
  passwordResetFailed: {
    success: false,
    error: {
      message: 'User not found',
      code: 'USER_NOT_FOUND',
    },
  },
  emailVerificationSent: {
    success: true,
    message: 'Verification email sent',
  },
  emailVerified: {
    success: true,
    message: 'Email verified successfully',
  },
};

// Form data helpers
export const formData = {
  validLogin: {
    email: 'test@example.com',
    password: 'Password123!',
  },
  invalidLogin: {
    email: 'invalid@example.com',
    password: 'wrongpassword',
  },
  validRegistration: {
    name: 'Test User',
    email: 'newuser@example.com',
    password: 'Password123!',
    confirmPassword: 'Password123!',
  },
  invalidRegistration: {
    name: '',
    email: 'invalid-email',
    password: 'weak',
    confirmPassword: 'different',
  },
  validPasswordReset: {
    email: 'test@example.com',
  },
  validNewPassword: {
    password: 'NewPassword123!',
    confirmPassword: 'NewPassword123!',
    token: 'reset-token-123',
  },
};

// Password strength test cases
export const passwordStrengthCases = {
  weak: [
    { password: '123', strength: 'weak', score: 0 },
    { password: 'password', strength: 'weak', score: 1 },
    { password: 'Password', strength: 'weak', score: 1 },
  ],
  medium: [
    { password: 'Password1', strength: 'medium', score: 2 },
    { password: 'password123', strength: 'medium', score: 2 },
  ],
  strong: [
    { password: 'Password123!', strength: 'strong', score: 3 },
    { password: 'MyStr0ngP@ssw0rd', strength: 'strong', score: 4 },
  ],
};

// Test utilities for form interactions
export const formTestUtils = {
  async fillLoginForm(email: string, password: string) {
    const user = userEvent.setup();
    const emailInput = screen.getByLabelText(/email/i);
    const passwordInput = screen.getByLabelText(/password/i);

    await user.type(emailInput, email);
    await user.type(passwordInput, password);

    return { emailInput, passwordInput };
  },

  async fillRegistrationForm(data: {
    name: string;
    email: string;
    password: string;
    confirmPassword: string;
  }) {
    const user = userEvent.setup();
    const nameInput = screen.getByLabelText(/name/i);
    const emailInput = screen.getByLabelText(/email/i);
    const passwordInput = screen.getByLabelText(/^password/i);
    const confirmPasswordInput = screen.getByLabelText(/confirm password/i);

    await user.type(nameInput, data.name);
    await user.type(emailInput, data.email);
    await user.type(passwordInput, data.password);
    await user.type(confirmPasswordInput, data.confirmPassword);

    return { nameInput, emailInput, passwordInput, confirmPasswordInput };
  },

  async submitForm() {
    const user = userEvent.setup();
    const submitButton = screen.getByRole('button', { name: /submit|sign|register|login/i });
    await user.click(submitButton);
    return submitButton;
  },

  async expectFormError(errorMessage: string | RegExp) {
    await waitFor(() => {
      expect(screen.getByText(errorMessage)).toBeInTheDocument();
    });
  },

  async expectFormSuccess(successMessage: string | RegExp) {
    await waitFor(() => {
      expect(screen.getByText(successMessage)).toBeInTheDocument();
    });
  },
};

// Mock implementations for auth client
export const createMockAuthClient = () => ({
  signIn: jest.fn(),
  signOut: jest.fn(),
  signUp: jest.fn(),
  resetPassword: jest.fn(),
  forgotPassword: jest.fn(),
  verifyEmail: jest.fn(),
  resendVerificationEmail: jest.fn(),
  updatePassword: jest.fn(),
  updateProfile: jest.fn(),
});

// Session mock helpers
export const mockUseSession = (sessionState = mockSessions.unauthenticatedSession) => {
  const mockUseSessionFn = jest.fn(() => sessionState);
  return mockUseSessionFn;
};

// Store mock helpers
export const mockUseAuthStore = (storeState = {
  isAuthenticated: false,
  user: null,
  setUser: jest.fn(),
  clearUser: jest.fn(),
  updateUser: jest.fn(),
}) => {
  const mockUseAuthStoreFn = jest.fn(() => storeState);
  return mockUseAuthStoreFn;
};

// Network error simulation
export const simulateNetworkError = () => {
  return Promise.reject(new Error('Network error'));
};

// Rate limiting simulation
export const simulateRateLimitError = () => {
  return Promise.reject(new Error('Too many requests'));
};

// Server error simulation
export const simulateServerError = () => {
  return Promise.reject(new Error('Internal server error'));
};

// Test wrapper for components that need theme context
export const renderWithProviders = (ui: ReactElement) => {
  return render(ui);
};

// Validation helpers
export const validationHelpers = {
  expectFieldError(fieldName: string, errorMessage: string | RegExp) {
    const field = screen.getByRole('textbox', { name: new RegExp(fieldName, 'i') });
    expect(field).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByText(errorMessage)).toBeInTheDocument();
  },

  expectFieldValid(fieldName: string) {
    const field = screen.getByRole('textbox', { name: new RegExp(fieldName, 'i') });
    expect(field).not.toHaveAttribute('aria-invalid', 'true');
  },

  expectFormSubmitDisabled() {
    const submitButton = screen.getByRole('button', { name: /submit|sign|register|login/i });
    expect(submitButton).toBeDisabled();
  },

  expectFormSubmitEnabled() {
    const submitButton = screen.getByRole('button', { name: /submit|sign|register|login/i });
    expect(submitButton).not.toBeDisabled();
  },
};

// Accessibility testing helpers
export const accessibilityHelpers = {
  expectProperLabeling() {
    const inputs = screen.getAllByRole('textbox');
    inputs.forEach(input => {
      expect(input).toHaveAccessibleName();
    });
  },

  expectKeyboardNavigation() {
    const focusableElements = screen.getAllByRole('button')
      .concat(screen.getAllByRole('textbox'))
      .concat(screen.getAllByRole('link'));
    
    focusableElements.forEach(element => {
      expect(element).not.toHaveAttribute('tabindex', '-1');
    });
  },

  expectErrorAnnouncement() {
    const errorMessages = screen.getAllByRole('alert');
    expect(errorMessages.length).toBeGreaterThan(0);
  },
};

// Test data factories
export const createTestUser = (overrides = {}) => ({
  ...mockUsers.validUser,
  ...overrides,
});

export const createTestSession = (overrides = {}) => ({
  ...mockSessions.authenticatedSession,
  ...overrides,
});

// Cleanup helpers
export const cleanupAuth = () => {
  jest.clearAllMocks();
  localStorage.clear();
  sessionStorage.clear();
};