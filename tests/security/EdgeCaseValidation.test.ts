import { jest } from '@jest/globals';
import {
  NetworkSimulator,
  ServerErrorSimulator,
  AuthStateSimulator,
  TokenSimulator,
  SecurityThreatSimulator,
  BrowserSimulator,
  ErrorMockFactory,
  EdgeCaseDataGenerator,
  EdgeCaseAssertions
} from '../utils/EdgeCaseTestHelpers';

// Mock fetch for testing
const mockFetch = jest.fn();
global.fetch = mockFetch as jest.MockedFunction<typeof fetch>;

describe('Edge Case Test Utilities Validation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });
  
  describe('Network Simulator', () => {
    it('should simulate various network failures', async () => {
      // Test timeout error
      const timeoutPromise = NetworkSimulator.simulateNetworkFailure('timeout');
      await expect(timeoutPromise).rejects.toThrow('Request timeout');
      
      // Test DNS error
      const dnsPromise = NetworkSimulator.simulateNetworkFailure('dns');
      await expect(dnsPromise).rejects.toThrow('getaddrinfo ENOTFOUND');
      
      // Test connection error
      const connectionPromise = NetworkSimulator.simulateNetworkFailure('connection');
      await expect(connectionPromise).rejects.toThrow('Network request failed');
      
      // console.log('✅ Network failure simulation working');
    });
    
    it('should simulate slow network conditions', async () => {
      const startTime = Date.now();
      const response = await NetworkSimulator.simulateSlowNetwork(100);
      const endTime = Date.now();
      
      expect(endTime - startTime).toBeGreaterThanOrEqual(90); // Allow for timing variations
      expect(response).toBeInstanceOf(Response);
      
      // console.log('✅ Slow network simulation working');
    });
    
    it('should simulate intermittent connectivity', async () => {
      // Test with 100% failure rate
      const alwaysFailPromise = NetworkSimulator.simulateIntermittentConnection(1.0);
      await expect(alwaysFailPromise).rejects.toThrow();
      
      // Test with 0% failure rate
      const neverFailPromise = NetworkSimulator.simulateIntermittentConnection(0.0);
      const response = await neverFailPromise;
      expect(response).toBeInstanceOf(Response);
      
      // console.log('✅ Intermittent connectivity simulation working');
    });
  });
  
  describe('Server Error Simulator', () => {
    it('should create proper 5xx error responses', async () => {
      const response500 = ServerErrorSimulator.create5xxError(500);
      expect(response500.status).toBe(500);
      
      const data = await response500.json();
      expect(data.error).toBe('Internal Server Error');
      expect(data.code).toBe('HTTP_500');
      
      // console.log('✅ 5xx error simulation working');
    });
    
    it('should create rate limit responses with proper headers', async () => {
      const rateLimitResponse = ServerErrorSimulator.createRateLimitError(60);
      expect(rateLimitResponse.status).toBe(429);
      expect(rateLimitResponse.headers.get('Retry-After')).toBe('60');
      
      const data = await rateLimitResponse.json();
      expect(data.code).toBe('RATE_LIMIT_EXCEEDED');
      expect(data.retryAfter).toBe(60);
      
      // console.log('✅ Rate limit simulation working');
    });
    
    it('should create malformed responses', async () => {
      const invalidJsonResponse = ServerErrorSimulator.createMalformedResponse('invalid_json');
      const text = await invalidJsonResponse.text();
      expect(text).toBe('{"invalid": json,}');
      
      const emptyResponse = ServerErrorSimulator.createMalformedResponse('empty');
      const emptyText = await emptyResponse.text();
      expect(emptyText).toBe('');
      
      // console.log('✅ Malformed response simulation working');
    });
  });
  
  describe('Authentication State Simulator', () => {
    it('should create expired sessions', () => {
      const expiredSession = AuthStateSimulator.createExpiredSession('user123', 30);
      expect(expiredSession.userId).toBe('user123');
      expect(expiredSession.expires.getTime()).toBeLessThan(Date.now());
      
      // console.log('✅ Expired session simulation working');
    });
    
    it('should create near-expiry sessions', () => {
      const nearExpirySession = AuthStateSimulator.createNearExpirySession('user123', 30);
      expect(nearExpirySession.userId).toBe('user123');
      expect(nearExpirySession.expires.getTime()).toBeGreaterThan(Date.now());
      expect(nearExpirySession.expires.getTime()).toBeLessThan(Date.now() + 60000);
      
      // console.log('✅ Near-expiry session simulation working');
    });
    
    it('should simulate partial auth states', () => {
      const emailUnverified = AuthStateSimulator.simulatePartialAuthState('email_unverified');
      expect(emailUnverified.requiresVerification).toBe(true);
      expect(emailUnverified.user.emailVerified).toBe(false);
      
      const passwordReset = AuthStateSimulator.simulatePartialAuthState('password_reset_required');
      expect(passwordReset.code).toBe('PASSWORD_RESET_REQUIRED');
      
      // console.log('✅ Partial auth state simulation working');
    });
  });
  
  describe('Token Simulator', () => {
    it('should generate malformed JWT tokens', () => {
      const malformedTokens = TokenSimulator.createMalformedJWT();
      expect(malformedTokens).toHaveLength(5);
      expect(malformedTokens[0]).toBe('invalid.jwt.token');
      expect(malformedTokens[2]).toBe('not-a-token-at-all');
      
      // console.log('✅ Malformed JWT generation working');
    });
    
    it('should simulate token expiry scenarios', () => {
      const expiredToken = TokenSimulator.simulateTokenExpiry('access');
      expect(expiredToken.code).toBe('ACCESS_TOKEN_EXPIRED');
      expect(expiredToken.requiresRefresh).toBe(true);
      
      const expiredRefresh = TokenSimulator.simulateTokenExpiry('refresh');
      expect(expiredRefresh.code).toBe('REFRESH_TOKEN_EXPIRED');
      
      // console.log('✅ Token expiry simulation working');
    });
    
    it('should simulate security violations', () => {
      const replayAttack = TokenSimulator.simulateTokenReplayAttack();
      expect(replayAttack.code).toBe('TOKEN_REPLAY_ATTACK');
      expect(replayAttack.securityIncident).toBe(true);
      
      const corrupted = TokenSimulator.simulateCorruptedToken();
      expect(corrupted.code).toBe('TOKEN_CORRUPTED');
      expect(corrupted.action).toBe('reauthentication_required');
      
      // console.log('✅ Token security violation simulation working');
    });
  });
  
  describe('Security Threat Simulator', () => {
    it('should generate XSS payloads', () => {
      const xssPayloads = SecurityThreatSimulator.createXSSPayloads();
      expect(xssPayloads.length).toBeGreaterThan(5);
      expect(xssPayloads).toContain('<script>alert("xss")</script>');
      expect(xssPayloads).toContain('javascript:alert("xss")');
      
      // console.log('✅ XSS payload generation working');
    });
    
    it('should generate SQL injection payloads', () => {
      const sqlPayloads = SecurityThreatSimulator.createSQLInjectionPayloads();
      expect(sqlPayloads.length).toBeGreaterThan(5);
      expect(sqlPayloads).toContain("'; DROP TABLE users; --");
      expect(sqlPayloads).toContain("' OR '1'='1' --");
      
      // console.log('✅ SQL injection payload generation working');
    });
    
    it('should simulate brute force attacks', () => {
      const bruteForceSimulator = SecurityThreatSimulator.simulateBruteForceAttack(3);
      
      // First two attempts should return invalid credentials
      const attempt1 = bruteForceSimulator();
      expect(attempt1.code).toBe('INVALID_CREDENTIALS');
      expect(attempt1.attemptsRemaining).toBe(2);
      
      const attempt2 = bruteForceSimulator();
      expect(attempt2.code).toBe('INVALID_CREDENTIALS');
      expect(attempt2.attemptsRemaining).toBe(1);
      
      // Third attempt should lock account
      const attempt3 = bruteForceSimulator();
      expect(attempt3.code).toBe('ACCOUNT_LOCKED');
      expect(attempt3.lockoutDuration).toBe(900);
      
      // console.log('✅ Brute force attack simulation working');
    });
  });
  
  describe('Browser Simulator', () => {
    it('should simulate JavaScript disabled', () => {
      const jsDisabled = BrowserSimulator.simulateJavaScriptDisabled();
      expect(jsDisabled.code).toBe('JAVASCRIPT_DISABLED');
      expect(jsDisabled.fallbackUrl).toBe('/login-basic');
      
      // console.log('✅ JavaScript disabled simulation working');
    });
    
    it('should simulate cookies disabled', () => {
      const cookiesDisabled = BrowserSimulator.simulateCookiesDisabled();
      expect(cookiesDisabled.code).toBe('COOKIES_DISABLED');
      expect(cookiesDisabled.alternatives).toContain('localStorage_fallback');
      
      // console.log('✅ Cookies disabled simulation working');
    });
    
    it('should simulate localStorage unavailable', () => {
      const localStorageTest = BrowserSimulator.simulateLocalStorageUnavailable();
      expect(localStorageTest.error.code).toBe('LOCALSTORAGE_UNAVAILABLE');
      expect(localStorageTest.error.fallbackMethod).toBe('sessionStorage');
      expect(typeof localStorageTest.cleanup).toBe('function');
      
      // Test cleanup
      localStorageTest.cleanup();
      
      // console.log('✅ localStorage unavailable simulation working');
    });
    
    it('should simulate legacy browsers', () => {
      const ie11 = BrowserSimulator.simulateLegacyBrowser('ie11');
      expect(ie11.code).toBe('LEGACY_BROWSER');
      expect(ie11.browser).toBe('ie11');
      expect(ie11.unsupportedFeatures).toContain('fetch_api');
      
      // console.log('✅ Legacy browser simulation working');
    });
  });
  
  describe('Error Mock Factory', () => {
    it('should create network error mocks', () => {
      const networkErrorMock = ErrorMockFactory.createNetworkErrorMock('timeout');
      expect(jest.isMockFunction(networkErrorMock)).toBe(true);
      
      // console.log('✅ Network error mock creation working');
    });
    
    it('should create server error mocks', () => {
      const serverErrorMock = ErrorMockFactory.createServerErrorMock(500);
      expect(jest.isMockFunction(serverErrorMock)).toBe(true);
      
      // console.log('✅ Server error mock creation working');
    });
    
    it('should create progressive delay mocks', () => {
      const progressiveDelayMock = ErrorMockFactory.createProgressiveDelayMock([0, 100, 200]);
      expect(jest.isMockFunction(progressiveDelayMock)).toBe(true);
      
      // console.log('✅ Progressive delay mock creation working');
    });
  });
  
  describe('Edge Case Data Generator', () => {
    it('should generate long inputs', () => {
      const longInputs = EdgeCaseDataGenerator.generateLongInputs();
      expect(longInputs.extremelyLongEmail.length).toBeGreaterThan(10000);
      expect(longInputs.extremelyLongPassword.length).toBeGreaterThan(10000);
      expect(longInputs.extremelyLongName.length).toBeGreaterThan(5000);
      
      // console.log('✅ Long input generation working');
    });
    
    it('should generate unicode inputs', () => {
      const unicodeInputs = EdgeCaseDataGenerator.generateUnicodeInputs();
      expect(unicodeInputs.length).toBeGreaterThan(5);
      expect(unicodeInputs[0]).toContain('\u0000'); // Null byte
      expect(unicodeInputs[4]).toContain('\u0001'); // Control character
      
      // console.log('✅ Unicode input generation working');
    });
    
    it('should generate malicious inputs', () => {
      const maliciousInputs = EdgeCaseDataGenerator.generateMaliciousInputs();
      expect(maliciousInputs.xss.length).toBeGreaterThan(5);
      expect(maliciousInputs.sqlInjection.length).toBeGreaterThan(5);
      expect(maliciousInputs.pathTraversal).toContain('../../../etc/passwd');
      
      // console.log('✅ Malicious input generation working');
    });
    
    it('should generate concurrency test data', () => {
      const concurrentData = EdgeCaseDataGenerator.generateConcurrencyTestData(3);
      expect(concurrentData.length).toBe(3);
      expect(concurrentData[0].email).toContain('concurrent-user-0');
      expect(concurrentData[2].email).toContain('concurrent-user-2');
      
      // console.log('✅ Concurrency test data generation working');
    });
  });
  
  describe('Edge Case Assertions', () => {
    it('should validate error responses', async () => {
      const mockResponse = new Response(JSON.stringify({
        error: 'Test Error',
        code: 'TEST_ERROR_CODE'
      }), { status: 400 });
      
      const data = await EdgeCaseAssertions.assertErrorResponse(mockResponse, 'TEST_ERROR_CODE', 400);
      expect(data.code).toBe('TEST_ERROR_CODE');
      
      // console.log('✅ Error response assertions working');
    });
    
    it('should validate security violations', async () => {
      const mockResponse = new Response(JSON.stringify({
        error: 'Security Violation',
        securityViolation: true
      }), { status: 403 });
      
      const data = await EdgeCaseAssertions.assertSecurityViolation(mockResponse);
      expect(data.securityViolation).toBe(true);
      
      // console.log('✅ Security violation assertions working');
    });
    
    it('should validate rate limit responses', async () => {
      const mockResponse = new Response(JSON.stringify({
        retryAfter: 60
      }), { 
        status: 429,
        headers: { 'Retry-After': '60' }
      });
      
      const data = await EdgeCaseAssertions.assertRateLimitResponse(mockResponse);
      expect(data.retryAfter).toBe(60);
      
      // console.log('✅ Rate limit response assertions working');
    });
    
    it('should validate response times', () => {
      const startTime = Date.now();
      const endTime = startTime + 150;
      
      const elapsed = EdgeCaseAssertions.assertResponseTime(startTime, endTime, 100);
      expect(elapsed).toBe(150);
      expect(elapsed).toBeGreaterThanOrEqual(100);
      
      // console.log('✅ Response time assertions working');
    });
  });
  
  describe('Integration Test Examples', () => {
    it('should demonstrate complete error scenario simulation', async () => {
      // Setup progressive delay mock
      const delayMock = ErrorMockFactory.createProgressiveDelayMock([0, 100, 200]);
      mockFetch.mockImplementation(delayMock);
      
      // Test multiple requests with increasing delays
      const startTime1 = Date.now();
      await fetch('/test1');
      const time1 = Date.now() - startTime1;
      
      const startTime2 = Date.now();
      await fetch('/test2');
      const time2 = Date.now() - startTime2;
      
      expect(time2).toBeGreaterThan(time1);
      expect(mockFetch).toHaveBeenCalledTimes(2);
      
      // console.log('✅ Complete error scenario simulation working');
    });
    
    it('should demonstrate security threat detection flow', () => {
      // Generate malicious inputs
      const threats = EdgeCaseDataGenerator.generateMaliciousInputs();
      
      // Test XSS detection
      const xssPayload = threats.xss[0];
      expect(xssPayload).toContain('<script>');
      
      // Simulate XSS detection response
      const detectionResult = {
        threat: 'xss',
        blocked: true,
        sanitized: xssPayload.replace(/<[^>]*>/g, '')
      };
      
      expect(detectionResult.blocked).toBe(true);
      expect(detectionResult.sanitized).not.toContain('<script>');
      
      // console.log('✅ Security threat detection flow working');
    });
    
    it('should demonstrate browser compatibility handling', () => {
      // Simulate legacy browser
      const browserInfo = BrowserSimulator.simulateLegacyBrowser('ie11');
      
      // Check for unsupported features
      const hasModernFeatures = !browserInfo.unsupportedFeatures.includes('fetch_api');
      expect(hasModernFeatures).toBe(false);
      
      // Simulate fallback strategy
      const fallbackStrategy = {
        usePolyfills: true,
        limitedFeatures: browserInfo.unsupportedFeatures,
        degradedExperience: true
      };
      
      expect(fallbackStrategy.usePolyfills).toBe(true);
      expect(fallbackStrategy.degradedExperience).toBe(true);
      
      // console.log('✅ Browser compatibility handling working');
    });
  });
});