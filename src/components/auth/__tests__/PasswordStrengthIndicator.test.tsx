import React from 'react';
import { render, screen } from '@testing-library/react';

import { 
  PasswordStrengthIndicator, 
  calculatePasswordStrength,
  PasswordStrength 
} from '../PasswordStrengthIndicator';
import { passwordStrengthCases } from '@tests/utils/auth-test-helpers';

describe('calculatePasswordStrength', () => {
  describe('Basic password strength calculation', () => {
    it('should calculate weak password strength', () => {
      const result = calculatePasswordStrength('123');
      
      expect(result.strength).toBe('weak');
      expect(result.score).toBeLessThan(40);
      expect(result.criteria.length).toBe(false);
      expect(result.criteria.lowercase).toBe(false);
      expect(result.criteria.uppercase).toBe(false);
      expect(result.criteria.number).toBe(true);
      expect(result.criteria.special).toBe(false);
    });

    it('should calculate fair password strength', () => {
      const result = calculatePasswordStrength('password123');
      
      expect(result.strength).toBe('fair');
      expect(result.score).toBeGreaterThanOrEqual(40);
      expect(result.score).toBeLessThan(60);
      expect(result.criteria.length).toBe(true);
      expect(result.criteria.lowercase).toBe(true);
      expect(result.criteria.uppercase).toBe(false);
      expect(result.criteria.number).toBe(true);
      expect(result.criteria.special).toBe(false);
    });

    it('should calculate good password strength', () => {
      const result = calculatePasswordStrength('Password123');
      
      expect(result.strength).toBe('good');
      expect(result.score).toBeGreaterThanOrEqual(60);
      expect(result.score).toBeLessThan(80);
      expect(result.criteria.length).toBe(true);
      expect(result.criteria.lowercase).toBe(true);
      expect(result.criteria.uppercase).toBe(true);
      expect(result.criteria.number).toBe(true);
      expect(result.criteria.special).toBe(false);
    });

    it('should calculate strong password strength', () => {
      const result = calculatePasswordStrength('MyStr0ng P@ssw0rd!');
      
      expect(result.strength).toBe('strong');
      expect(result.score).toBeGreaterThanOrEqual(80);
      expect(result.criteria.length).toBe(true);
      expect(result.criteria.lowercase).toBe(true);
      expect(result.criteria.uppercase).toBe(true);
      expect(result.criteria.number).toBe(true);
      expect(result.criteria.special).toBe(true);
    });
  });

  describe('Character criteria validation', () => {
    it('should validate minimum length requirement', () => {
      const shortPassword = calculatePasswordStrength('Abc1!');
      const longPassword = calculatePasswordStrength('Abc12345!');
      
      expect(shortPassword.criteria.length).toBe(false);
      expect(shortPassword.feedback).toContain('At least 8 characters');
      
      expect(longPassword.criteria.length).toBe(true);
      expect(longPassword.feedback).not.toContain('At least 8 characters');
    });

    it('should validate lowercase letters', () => {
      const noLower = calculatePasswordStrength('ABCD1234!');
      const withLower = calculatePasswordStrength('abcd1234!');
      
      expect(noLower.criteria.lowercase).toBe(false);
      expect(noLower.feedback).toContain('Include lowercase letters');
      
      expect(withLower.criteria.lowercase).toBe(true);
      expect(withLower.feedback).not.toContain('Include lowercase letters');
    });

    it('should validate uppercase letters', () => {
      const noUpper = calculatePasswordStrength('abcd1234!');
      const withUpper = calculatePasswordStrength('Abcd1234!');
      
      expect(noUpper.criteria.uppercase).toBe(false);
      expect(noUpper.feedback).toContain('Include uppercase letters');
      
      expect(withUpper.criteria.uppercase).toBe(true);
      expect(withUpper.feedback).not.toContain('Include uppercase letters');
    });

    it('should validate numbers', () => {
      const noNumbers = calculatePasswordStrength('Abcdefgh!');
      const withNumbers = calculatePasswordStrength('Abcd1234!');
      
      expect(noNumbers.criteria.number).toBe(false);
      expect(noNumbers.feedback).toContain('Include numbers');
      
      expect(withNumbers.criteria.number).toBe(true);
      expect(withNumbers.feedback).not.toContain('Include numbers');
    });

    it('should validate special characters', () => {
      const noSpecial = calculatePasswordStrength('Abcd1234');
      const withSpecial = calculatePasswordStrength('Abcd1234!');
      
      expect(noSpecial.criteria.special).toBe(false);
      expect(noSpecial.feedback).toContain('Include special characters (@$!%*?&)');
      
      expect(withSpecial.criteria.special).toBe(true);
      expect(withSpecial.feedback).not.toContain('Include special characters (@$!%*?&)');
    });
  });

  describe('Special character validation', () => {
    it('should recognize all valid special characters', () => {
      const specialChars = ['@', '$', '!', '%', '*', '?', '&'];
      
      specialChars.forEach(char => {
        const result = calculatePasswordStrength(`Password123${char}`);
        expect(result.criteria.special).toBe(true);
      });
    });

    it('should not recognize invalid special characters', () => {
      const invalidSpecial = calculatePasswordStrength('Password123#');
      expect(invalidSpecial.criteria.special).toBe(false);
    });
  });

  describe('Scoring system', () => {
    it('should give length bonuses correctly', () => {
      const short = calculatePasswordStrength('Abc1!234'); // 8 chars
      const medium = calculatePasswordStrength('Abc1!2345678'); // 12 chars
      const long = calculatePasswordStrength('Abc1!23456789012345'); // 16+ chars
      
      // Each should have higher score than the previous
      expect(medium.score).toBeGreaterThan(short.score);
      expect(long.score).toBeGreaterThan(medium.score);
    });

    it('should give variety bonus for using all character types', () => {
      const someVariety = calculatePasswordStrength('password123'); // 2 types
      const fullVariety = calculatePasswordStrength('Password123!'); // 4 types
      
      expect(fullVariety.score).toBeGreaterThan(someVariety.score);
    });

    it('should apply penalties for repeated characters', () => {
      const normal = calculatePasswordStrength('Password123!');
      const repeated = calculatePasswordStrength('Passwordddd123!');
      
      expect(repeated.score).toBeLessThan(normal.score);
      expect(repeated.feedback).toContain('Avoid repeated characters');
    });

    it('should apply penalties for common patterns', () => {
      const commonPatterns = ['password123!', 'Password123!', 'Myqwerty123!', 'Test123456!'];
      
      commonPatterns.forEach(pattern => {
        const result = calculatePasswordStrength(pattern);
        if (pattern.toLowerCase().includes('password') || 
            pattern.toLowerCase().includes('123') || 
            pattern.toLowerCase().includes('qwe')) {
          expect(result.feedback).toContain('Avoid common patterns');
        }
      });
    });

    it('should ensure score stays within 0-100 bounds', () => {
      const veryWeak = calculatePasswordStrength('');
      const veryStrong = calculatePasswordStrength('VeryComplexPassword123!@#$%SuperLong');
      
      expect(veryWeak.score).toBeGreaterThanOrEqual(0);
      expect(veryWeak.score).toBeLessThanOrEqual(100);
      expect(veryStrong.score).toBeGreaterThanOrEqual(0);
      expect(veryStrong.score).toBeLessThanOrEqual(100);
    });
  });

  describe('Feedback generation', () => {
    it('should provide appropriate feedback for missing criteria', () => {
      const result = calculatePasswordStrength('weak');
      
      expect(result.feedback).toContain('At least 8 characters');
      expect(result.feedback).toContain('Include uppercase letters');
      expect(result.feedback).toContain('Include numbers');
      expect(result.feedback).toContain('Include special characters (@$!%*?&)');
    });

    it('should not provide feedback for satisfied criteria', () => {
      const result = calculatePasswordStrength('StrongPassword123!');
      
      expect(result.feedback).not.toContain('At least 8 characters');
      expect(result.feedback).not.toContain('Include lowercase letters');
      expect(result.feedback).not.toContain('Include uppercase letters');
      expect(result.feedback).not.toContain('Include numbers');
      expect(result.feedback).not.toContain('Include special characters (@$!%*?&)');
    });

    it('should provide pattern-specific feedback', () => {
      const repeated = calculatePasswordStrength('Passwordaaa123!');
      const common = calculatePasswordStrength('password123!');
      
      expect(repeated.feedback).toContain('Avoid repeated characters');
      expect(common.feedback).toContain('Avoid common patterns');
    });
  });

  describe('Edge cases', () => {
    it('should handle empty password', () => {
      const result = calculatePasswordStrength('');
      
      expect(result.strength).toBe('weak');
      expect(result.score).toBe(0);
      expect(result.criteria.length).toBe(false);
      expect(result.criteria.lowercase).toBe(false);
      expect(result.criteria.uppercase).toBe(false);
      expect(result.criteria.number).toBe(false);
      expect(result.criteria.special).toBe(false);
    });

    it('should handle very long passwords', () => {
      const longPassword = 'A'.repeat(100) + 'a1!';
      const result = calculatePasswordStrength(longPassword);
      
      expect(result.criteria.length).toBe(true);
      expect(result.score).toBeGreaterThan(0);
    });

    it('should handle unicode characters', () => {
      const unicodePassword = 'Pässwörd123!';
      const result = calculatePasswordStrength(unicodePassword);
      
      expect(result.criteria.length).toBe(true);
      expect(result.criteria.lowercase).toBe(true);
      expect(result.criteria.uppercase).toBe(true);
      expect(result.criteria.number).toBe(true);
      expect(result.criteria.special).toBe(true);
    });
  });
});

describe('PasswordStrengthIndicator Component', () => {
  describe('Rendering', () => {
    it('should not render when password is empty', () => {
      const { container } = render(<PasswordStrengthIndicator password="" />);
      expect(container.firstChild).toBeNull();
    });

    it('should render password strength indicator for non-empty password', () => {
      render(<PasswordStrengthIndicator password="test123" />);
      
      expect(screen.getByText('Password strength')).toBeInTheDocument();
      expect(screen.getByText('weak')).toBeInTheDocument();
    });

    it('should display all password criteria', () => {
      render(<PasswordStrengthIndicator password="test123" />);
      
      expect(screen.getByText('8+ characters')).toBeInTheDocument();
      expect(screen.getByText('Lowercase')).toBeInTheDocument();
      expect(screen.getByText('Uppercase')).toBeInTheDocument();
      expect(screen.getByText('Numbers')).toBeInTheDocument();
      expect(screen.getByText('Special chars')).toBeInTheDocument();
    });

    it('should show feedback for improvement when available', () => {
      render(<PasswordStrengthIndicator password="test" />);
      
      expect(screen.getByText('To improve:')).toBeInTheDocument();
      expect(screen.getByText('At least 8 characters')).toBeInTheDocument();
      expect(screen.getByText('Include uppercase letters')).toBeInTheDocument();
    });

    it('should not show feedback when password is strong', () => {
      render(<PasswordStrengthIndicator password="VeryStrongP@ssword123!" />);
      
      expect(screen.queryByText('To improve:')).not.toBeInTheDocument();
    });
  });

  describe('Visual indicators', () => {
    it('should show weak strength indicator for weak passwords', () => {
      render(<PasswordStrengthIndicator password="123" />);
      
      const strengthText = screen.getByText('weak');
      expect(strengthText).toHaveClass('text-red-600');
    });

    it('should show fair strength indicator for fair passwords', () => {
      render(<PasswordStrengthIndicator password="password123" />);
      
      const strengthText = screen.getByText('fair');
      expect(strengthText).toHaveClass('text-yellow-600');
    });

    it('should show good strength indicator for good passwords', () => {
      render(<PasswordStrengthIndicator password="Password123" />);
      
      const strengthText = screen.getByText('good');
      expect(strengthText).toHaveClass('text-blue-600');
    });

    it('should show strong strength indicator for strong passwords', () => {
      render(<PasswordStrengthIndicator password="MyStrongP@ssword123!" />);
      
      const strengthText = screen.getByText('strong');
      expect(strengthText).toHaveClass('text-green-600');
    });
  });

  describe('Criteria indicators', () => {
    it('should show satisfied criteria with green indicators', () => {
      render(<PasswordStrengthIndicator password="MyStrongPassword123!" />);
      
      // All criteria should be satisfied and show green
      const lengthIndicator = screen.getByText('8+ characters').previousElementSibling;
      const lowercaseIndicator = screen.getByText('Lowercase').previousElementSibling;
      const uppercaseIndicator = screen.getByText('Uppercase').previousElementSibling;
      const numberIndicator = screen.getByText('Numbers').previousElementSibling;
      const specialIndicator = screen.getByText('Special chars').previousElementSibling;
      
      expect(lengthIndicator).toHaveClass('bg-green-500');
      expect(lowercaseIndicator).toHaveClass('bg-green-500');
      expect(uppercaseIndicator).toHaveClass('bg-green-500');
      expect(numberIndicator).toHaveClass('bg-green-500');
      expect(specialIndicator).toHaveClass('bg-green-500');
    });

    it('should show unsatisfied criteria with gray indicators', () => {
      render(<PasswordStrengthIndicator password="short" />);
      
      // Length should not be satisfied
      const lengthIndicator = screen.getByText('8+ characters').previousElementSibling;
      const uppercaseIndicator = screen.getByText('Uppercase').previousElementSibling;
      const numberIndicator = screen.getByText('Numbers').previousElementSibling;
      const specialIndicator = screen.getByText('Special chars').previousElementSibling;
      
      expect(lengthIndicator).toHaveClass('bg-slate-300');
      expect(uppercaseIndicator).toHaveClass('bg-slate-300');
      expect(numberIndicator).toHaveClass('bg-slate-300');
      expect(specialIndicator).toHaveClass('bg-slate-300');
    });
  });

  describe('Accessibility', () => {
    it('should have proper text contrast for different strength levels', () => {
      const testCases = [
        { password: '123', strength: 'weak', colorClass: 'text-red-600' },
        { password: 'password123', strength: 'fair', colorClass: 'text-yellow-600' },
        { password: 'Password123', strength: 'good', colorClass: 'text-blue-600' },
        { password: 'MyStrongP@ssword123!', strength: 'strong', colorClass: 'text-green-600' },
      ];

      testCases.forEach(({ password, strength, colorClass }) => {
        const { unmount } = render(<PasswordStrengthIndicator password={password} />);
        
        const strengthElement = screen.getByText(strength);
        expect(strengthElement).toHaveClass(colorClass);
        
        unmount();
      });
    });

    it('should provide clear textual feedback', () => {
      render(<PasswordStrengthIndicator password="weak" />);
      
      // Should have clear text descriptions
      expect(screen.getByText('Password strength')).toBeInTheDocument();
      expect(screen.getByText('To improve:')).toBeInTheDocument();
      expect(screen.getByText('At least 8 characters')).toBeInTheDocument();
    });

    it('should use semantic progress indicator', () => {
      const { container } = render(<PasswordStrengthIndicator password="test123" />);
      
      // Should contain a progress-like element (Progress component)
      const progressElements = container.querySelectorAll('[role="progressbar"]');
      expect(progressElements.length).toBeGreaterThan(0);
    });
  });

  describe('Custom styling', () => {
    it('should apply custom className', () => {
      const { container } = render(
        <PasswordStrengthIndicator password="test123" className="custom-class" />
      );
      
      const rootElement = container.firstChild as HTMLElement;
      expect(rootElement).toHaveClass('custom-class');
    });

    it('should maintain default spacing classes', () => {
      const { container } = render(<PasswordStrengthIndicator password="test123" />);
      
      const rootElement = container.firstChild as HTMLElement;
      expect(rootElement).toHaveClass('space-y-2');
    });
  });

  describe('Progress bar behavior', () => {
    it('should show progress corresponding to password strength', () => {
      const testCases = [
        { password: '123', expectedRange: [0, 40] },
        { password: 'password123', expectedRange: [40, 60] },
        { password: 'Password123', expectedRange: [60, 80] },
        { password: 'MyStrongP@ssword123!', expectedRange: [80, 100] },
      ];

      testCases.forEach(({ password, expectedRange }) => {
        const { unmount } = render(<PasswordStrengthIndicator password={password} />);
        
        const strength = calculatePasswordStrength(password);
        expect(strength.score).toBeGreaterThanOrEqual(expectedRange[0]);
        expect(strength.score).toBeLessThanOrEqual(expectedRange[1]);
        
        unmount();
      });
    });
  });

  describe('Real-world password scenarios', () => {
    it('should handle common weak passwords correctly', () => {
      const weakPasswords = [
        '123456',
        'password',
        'qwerty',
        'abc123',
        '111111'
      ];

      weakPasswords.forEach(password => {
        const { unmount } = render(<PasswordStrengthIndicator password={password} />);
        
        expect(screen.getByText('weak')).toBeInTheDocument();
        expect(screen.getByText('To improve:')).toBeInTheDocument();
        
        unmount();
      });
    });

    it('should handle good passwords correctly', () => {
      const goodPasswords = [
        'MyP@ssword123',
        'SecurePass123!',
        'ComplexPwd456&',
      ];

      goodPasswords.forEach(password => {
        const { unmount } = render(<PasswordStrengthIndicator password={password} />);
        
        const strengthText = screen.getByText(/^(good|strong)$/);
        expect(strengthText).toBeInTheDocument();
        
        unmount();
      });
    });
  });

  describe('Performance', () => {
    it('should handle rapid password changes efficiently', () => {
      const { rerender } = render(<PasswordStrengthIndicator password="a" />);
      
      // Simulate rapid typing
      const passwords = ['a', 'ab', 'abc', 'abc1', 'abc12', 'Abc123', 'Abc123!'];
      
      passwords.forEach(password => {
        rerender(<PasswordStrengthIndicator password={password} />);
        // Should not throw errors and should update correctly
        expect(screen.getByText('Password strength')).toBeInTheDocument();
      });
    });
  });
});