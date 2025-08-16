/**
 * Auth Components Exports
 * NextJS Stripe Payment Template
 * 
 * Centralized exports for all authentication-related components
 * including session management components.
 */

// Authentication components
export { EmailVerificationStatus } from './EmailVerificationStatus';
export { ForgotPasswordForm } from './ForgotPasswordForm';
export { LoginForm } from './LoginForm';
export { LogoutButton } from './LogoutButton';
export { PasswordStrengthIndicator } from './PasswordStrengthIndicator';
export { RegistrationForm } from './RegistrationForm';
export { ResetPasswordForm } from './ResetPasswordForm';
export { UserMenu } from './UserMenu';

// Session management components
export { SessionCard } from './SessionCard';
export { SessionManager } from './SessionManager';
export { ActiveSessionsList } from './ActiveSessionsList';
export { SessionTerminateDialog } from './SessionTerminateDialog';
export { 
  SessionRefreshButton, 
  BulkSessionRefreshButton, 
  AutoRefreshToggle 
} from './SessionRefreshButton';

// Re-export types for convenience
export type {
  SessionCardProps,
  ActiveSessionsListProps,
  SessionManagerProps,
  SessionRefreshButtonProps,
  SessionTerminateDialogProps,
} from '@/types/auth/sessions';