import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Safely reads CSRF token from cookies for client-side API requests
 * This token must be included in the x-csrf-token header for state-changing API requests
 * 
 * @returns CSRF token string or null if not found/invalid
 */
export function getCSRFToken(): string | null {
  try {
    // Only run on client side
    if (typeof window === 'undefined') {
      return null;
    }

    // Read the CSRF token cookie (name matches CSRF_TOKEN_NAME in csrf-protection.ts)
    // Use __Secure- prefix only in production for security, regular name in development for compatibility
    const cookieName = process.env.NODE_ENV === 'production' ? '__Secure-csrf-token' : 'csrf-token';
    const cookies = document.cookie.split(';');
    
    for (const cookie of cookies) {
      const [name, value] = cookie.trim().split('=');
      if (name === cookieName && value) {
        return decodeURIComponent(value);
      }
    }
    
    return null;
  } catch (error) {
    // eslint-disable-next-line no-console
    console.warn('Error reading CSRF token:', error);
    return null;
  }
}

/**
 * Creates headers for API requests with CSRF protection
 * Automatically includes the CSRF token for state-changing requests
 * 
 * @param additionalHeaders - Any additional headers to include
 * @returns Headers object with CSRF token and additional headers
 */
export function createAPIHeaders(additionalHeaders: Record<string, string> = {}): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...additionalHeaders,
  };

  // Add CSRF token for client-side requests
  const csrfToken = getCSRFToken();
  if (csrfToken) {
    headers['x-csrf-token'] = csrfToken;
  }

  return headers;
}
