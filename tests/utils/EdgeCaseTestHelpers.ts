import { jest } from '@jest/globals';

// Network simulation utilities
export class NetworkSimulator {
  static simulateNetworkFailure(errorType: 'timeout' | 'dns' | 'connection' | 'ssl' = 'connection') {
    const errors = {
      timeout: new Error('Request timeout'),
      dns: new Error('getaddrinfo ENOTFOUND'),
      connection: new Error('Network request failed'),
      ssl: new Error('SSL certificate verification failed')
    };
    
    const error = errors[errorType];
    error.name = errorType === 'timeout' ? 'TimeoutError' : 'NetworkError';
    
    return Promise.reject(error);
  }
  
  static simulateSlowNetwork(delayMs: number = 5000) {
    return new Promise(resolve => {
      setTimeout(() => {
        resolve(new Response(JSON.stringify({ success: true }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        }));
      }, delayMs);
    });
  }
  
  static simulateIntermittentConnection(failureRate: number = 0.5) {
    return Math.random() < failureRate 
      ? this.simulateNetworkFailure()
      : Promise.resolve(new Response(JSON.stringify({ success: true })));
  }
  
  static simulateOfflineMode() {
    // Mock navigator.onLine
    Object.defineProperty(navigator, 'onLine', {
      writable: true,
      value: false
    });
    
    return this.simulateNetworkFailure('connection');
  }
}

// Server error simulation utilities
export class ServerErrorSimulator {
  static create5xxError(statusCode: 500 | 502 | 503 | 504, retryAfter?: number) {
    const errorMessages = {
      500: 'Internal Server Error',
      502: 'Bad Gateway',
      503: 'Service Unavailable',
      504: 'Gateway Timeout'
    };
    
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (retryAfter && (statusCode === 503 || statusCode === 429)) {
      headers['Retry-After'] = retryAfter.toString();
    }
    
    return new Response(JSON.stringify({
      error: errorMessages[statusCode],
      code: `HTTP_${statusCode}`,
      message: `Server returned ${statusCode} error`,
      timestamp: new Date().toISOString(),
      retryAfter
    }), {
      status: statusCode,
      statusText: errorMessages[statusCode],
      headers
    });
  }
  
  static createRateLimitError(retryAfter: number = 60) {
    return new Response(JSON.stringify({
      error: 'Too Many Requests',
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'Rate limit exceeded',
      retryAfter,
      limit: 100,
      remaining: 0,
      reset: Date.now() + (retryAfter * 1000)
    }), {
      status: 429,
      statusText: 'Too Many Requests',
      headers: {
        'Content-Type': 'application/json',
        'Retry-After': retryAfter.toString(),
        'X-RateLimit-Limit': '100',
        'X-RateLimit-Remaining': '0',
        'X-RateLimit-Reset': String(Date.now() + (retryAfter * 1000))
      }
    });
  }
  
  static createMalformedResponse(type: 'invalid_json' | 'empty' | 'wrong_content_type' = 'invalid_json') {
    const responses = {
      invalid_json: new Response('{"invalid": json,}', {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      }),
      empty: new Response('', {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      }),
      wrong_content_type: new Response('<html><body>Error</body></html>', {
        status: 500,
        headers: { 'Content-Type': 'text/html' }
      })
    };
    
    return responses[type];
  }
}

// Authentication state simulators
export class AuthStateSimulator {
  static createExpiredSession(userId: string, expiredMinutesAgo: number = 60) {
    return {
      sessionToken: `expired-session-${Date.now()}`,
      userId,
      expires: new Date(Date.now() - (expiredMinutesAgo * 60 * 1000)),
      createdAt: new Date(Date.now() - (24 * 60 * 60 * 1000)),
      updatedAt: new Date()
    };
  }
  
  static createNearExpirySession(userId: string, expiresInSeconds: number = 30) {
    return {
      sessionToken: `near-expiry-session-${Date.now()}`,
      userId,
      expires: new Date(Date.now() + (expiresInSeconds * 1000)),
      createdAt: new Date(),
      updatedAt: new Date()
    };
  }
  
  static simulateSessionConflict() {
    return {
      error: 'Session Conflict',
      code: 'SESSION_CONFLICT',
      message: 'Multiple active sessions detected',
      conflictingSessions: [
        { sessionToken: 'session-1', device: 'mobile', lastActive: new Date() },
        { sessionToken: 'session-2', device: 'desktop', lastActive: new Date() }
      ]
    };
  }
  
  static simulatePartialAuthState(type: 'email_unverified' | 'password_reset_required' | '2fa_required') {
    const states = {
      email_unverified: {
        user: { emailVerified: false },
        requiresVerification: true,
        limitedAccess: true
      },
      password_reset_required: {
        error: 'Password Reset Required',
        code: 'PASSWORD_RESET_REQUIRED',
        resetToken: 'temp-reset-token'
      },
      '2fa_required': {
        user: { twoFactorEnabled: true },
        requires2FA: true,
        challenge: 'totp_code_required'
      }
    };
    
    return states[type];
  }
}

// Token validation simulators
export class TokenSimulator {
  static createMalformedJWT() {
    return [
      'invalid.jwt.token',
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.invalid',
      'not-a-token-at-all',
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..', // Missing payload
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.tampered-signature'
    ];
  }
  
  static simulateTokenExpiry(tokenType: 'access' | 'refresh' | 'verification' = 'access') {
    return {
      error: 'Token Expired',
      code: `${tokenType.toUpperCase()}_TOKEN_EXPIRED`,
      message: `${tokenType} token has expired`,
      expiredAt: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
      requiresRefresh: tokenType === 'access'
    };
  }
  
  static simulateTokenReplayAttack() {
    return {
      error: 'Token Replay Detected',
      code: 'TOKEN_REPLAY_ATTACK',
      message: 'Token has been used in suspicious pattern',
      securityIncident: true,
      blockDuration: 900 // 15 minutes
    };
  }
  
  static simulateCorruptedToken() {
    return {
      error: 'Token Corrupted',
      code: 'TOKEN_CORRUPTED',
      message: 'Token data integrity check failed',
      action: 'reauthentication_required'
    };
  }
}

// Security threat simulators
export class SecurityThreatSimulator {
  static createXSSPayloads() {
    return [
      '<script>alert("xss")</script>',
      'javascript:alert("xss")',
      '"><script>alert("xss")</script>',
      '<img src=x onerror=alert("xss")>',
      '{{constructor.constructor("alert(\\"xss\\")")()}}',
      '${alert("xss")}',
      '<svg onload=alert("xss")>',
      'data:text/html,<script>alert("xss")</script>'
    ];
  }
  
  static createSQLInjectionPayloads() {
    return [
      "'; DROP TABLE users; --",
      "' OR '1'='1' --",
      "' UNION SELECT * FROM users --",
      "admin'--",
      "' OR 1=1#",
      "'; INSERT INTO users (email) VALUES ('hacker@evil.com'); --",
      "' OR (SELECT COUNT(*) FROM users) > 0 --"
    ];
  }
  
  static simulateBruteForceAttack(maxAttempts: number = 5) {
    let attemptCount = 0;
    
    return () => {
      attemptCount++;
      
      if (attemptCount < maxAttempts) {
        return {
          error: 'Invalid Credentials',
          code: 'INVALID_CREDENTIALS',
          attemptsRemaining: maxAttempts - attemptCount
        };
      } else {
        return {
          error: 'Account Locked',
          code: 'ACCOUNT_LOCKED',
          message: 'Account locked due to too many failed attempts',
          lockoutDuration: 900,
          unlockAt: new Date(Date.now() + 15 * 60 * 1000).toISOString()
        };
      }
    };
  }
  
  static simulateCSRFAttack() {
    return {
      error: 'CSRF Token Mismatch',
      code: 'CSRF_TOKEN_MISMATCH',
      message: 'Invalid or missing CSRF token',
      expectedOrigin: 'https://legitimate-site.com',
      receivedOrigin: 'https://malicious-site.com'
    };
  }
}

// Browser compatibility simulators
export class BrowserSimulator {
  static simulateJavaScriptDisabled() {
    return {
      error: 'JavaScript Required',
      code: 'JAVASCRIPT_DISABLED',
      message: 'This application requires JavaScript',
      fallbackUrl: '/login-basic',
      noScriptMode: true
    };
  }
  
  static simulateCookiesDisabled() {
    // Mock document.cookie to simulate disabled cookies
    Object.defineProperty(document, 'cookie', {
      get: jest.fn(() => ''),
      set: jest.fn(() => {
        throw new Error('Cookies are disabled');
      }),
      configurable: true
    });
    
    return {
      error: 'Cookies Required',
      code: 'COOKIES_DISABLED',
      message: 'Authentication requires cookies',
      alternatives: ['url_tokens', 'localStorage_fallback']
    };
  }
  
  static simulateLocalStorageUnavailable() {
    const originalLocalStorage = global.localStorage;
    
    Object.defineProperty(global, 'localStorage', {
      value: undefined,
      writable: true
    });
    
    return {
      cleanup: () => {
        Object.defineProperty(global, 'localStorage', {
          value: originalLocalStorage,
          writable: true
        });
      },
      error: {
        warning: 'Local Storage Unavailable',
        code: 'LOCALSTORAGE_UNAVAILABLE',
        fallbackMethod: 'sessionStorage'
      }
    };
  }
  
  static simulateLegacyBrowser(browserType: 'ie11' | 'safari9' | 'chrome49' = 'ie11') {
    const userAgents = {
      ie11: 'Mozilla/5.0 (Windows NT 10.0; WOW64; Trident/7.0; rv:11.0) like Gecko',
      safari9: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_11_6) AppleWebKit/601.7.8 (KHTML, like Gecko) Version/9.1.3 Safari/601.7.8',
      chrome49: 'Mozilla/5.0 (Windows NT 6.1; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/49.0.2623.112 Safari/537.36'
    };
    
    Object.defineProperty(global.navigator, 'userAgent', {
      value: userAgents[browserType],
      writable: true
    });
    
    return {
      warning: 'Legacy Browser Detected',
      code: 'LEGACY_BROWSER',
      browser: browserType,
      unsupportedFeatures: ['fetch_api', 'promises', 'arrow_functions']
    };
  }
}

// Comprehensive error mock factory
export class ErrorMockFactory {
  static createNetworkErrorMock(errorType: string) {
    return jest.fn().mockRejectedValue(
      NetworkSimulator.simulateNetworkFailure(errorType as 'timeout' | 'dns' | 'connection' | 'ssl')
    );
  }
  
  static createServerErrorMock(statusCode: number, retryAfter?: number) {
    return jest.fn().mockResolvedValue(
      ServerErrorSimulator.create5xxError(statusCode as 500 | 502 | 503 | 504, retryAfter)
    );
  }
  
  static createRateLimitMock(retryAfter: number = 60) {
    return jest.fn().mockResolvedValue(
      ServerErrorSimulator.createRateLimitError(retryAfter)
    );
  }
  
  static createProgressiveDelayMock(delays: number[] = [0, 1000, 2000, 4000]) {
    let callCount = 0;
    
    return jest.fn().mockImplementation(() => {
      const delay = delays[Math.min(callCount, delays.length - 1)];
      callCount++;
      
      return new Promise(resolve => {
        setTimeout(() => {
          resolve(new Response(JSON.stringify({
            error: 'Invalid Credentials',
            delayApplied: delay,
            attempt: callCount
          }), { status: 401 }));
        }, delay);
      });
    });
  }
  
  static createCircuitBreakerMock(maxFailures: number = 3) {
    let failureCount = 0;
    let circuitOpen = false;
    
    return jest.fn().mockImplementation(() => {
      if (circuitOpen) {
        return Promise.resolve(new Response(JSON.stringify({
          error: 'Circuit Breaker Open',
          code: 'CIRCUIT_BREAKER_OPEN'
        }), { status: 503 }));
      }
      
      failureCount++;
      if (failureCount > maxFailures) {
        circuitOpen = true;
      }
      
      return Promise.resolve(new Response(JSON.stringify({
        error: 'Service Error',
        attempt: failureCount
      }), { status: 500 }));
    });
  }
}

// Test data generators for edge cases
export class EdgeCaseDataGenerator {
  static generateLongInputs() {
    return {
      extremelyLongEmail: 'a'.repeat(10000) + '@example.com',
      extremelyLongPassword: 'P'.repeat(10000) + '123!',
      extremelyLongName: 'Name'.repeat(2500), // 10,000 chars
      oversizedJSON: JSON.stringify({ data: 'x'.repeat(100000) })
    };
  }
  
  static generateUnicodeInputs() {
    return [
      'test\u0000null@example.com', // Null byte
      'test\u200B\u200C\u200D@example.com', // Zero-width characters
      'test\uFEFF@example.com', // Byte order mark
      'test\u202E@example.com', // Right-to-left override
      'test\u0001\u0002\u0003@example.com', // Control characters
      'test\uD83D\uDE00@example.com', // Emoji
    ];
  }
  
  static generateMaliciousInputs() {
    return {
      xss: SecurityThreatSimulator.createXSSPayloads(),
      sqlInjection: SecurityThreatSimulator.createSQLInjectionPayloads(),
      pathTraversal: ['../../../etc/passwd', '..\\..\\..\\windows\\system32'],
      commandInjection: ['; cat /etc/passwd', '| whoami', '&& rm -rf /']
    };
  }
  
  static generateConcurrencyTestData(concurrentUsers: number = 5) {
    return Array.from({ length: concurrentUsers }, (_, i) => ({
      email: `concurrent-user-${i}@example.com`,
      password: `Password${i}123!`,
      sessionToken: `concurrent-session-${i}-${Date.now()}`
    }));
  }
}

// Test assertion helpers
export class EdgeCaseAssertions {
  static assertErrorResponse(response: Response, expectedCode: string, expectedStatus: number = 400) {
    expect(response.status).toBe(expectedStatus);
    return response.json().then(data => {
      expect(data.code).toBe(expectedCode);
      return data;
    });
  }
  
  static assertSecurityViolation(response: Response) {
    expect(response.status).toBeGreaterThanOrEqual(400);
    return response.json().then(data => {
      expect(data.securityViolation || data.securityIncident).toBe(true);
      return data;
    });
  }
  
  static assertRateLimitResponse(response: Response) {
    expect(response.status).toBe(429);
    expect(response.headers.get('Retry-After')).toBeDefined();
    return response.json().then(data => {
      expect(data.retryAfter).toBeDefined();
      return data;
    });
  }
  
  static assertNetworkError(error: Error, expectedType: string) {
    expect(error).toBeInstanceOf(Error);
    expect(error.message).toMatch(new RegExp(expectedType, 'i'));
  }
  
  static assertResponseTime(startTime: number, endTime: number, expectedMinMs: number) {
    const elapsed = endTime - startTime;
    expect(elapsed).toBeGreaterThanOrEqual(expectedMinMs);
    return elapsed;
  }
}

const EdgeCaseTestHelpers = {
  NetworkSimulator,
  ServerErrorSimulator,
  AuthStateSimulator,
  TokenSimulator,
  SecurityThreatSimulator,
  BrowserSimulator,
  ErrorMockFactory,
  EdgeCaseDataGenerator,
  EdgeCaseAssertions
};

export default EdgeCaseTestHelpers;