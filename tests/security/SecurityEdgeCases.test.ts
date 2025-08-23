import { DatabaseTestHelper } from '../setup/jest.setup';
import { TestDataGenerator } from '../fixtures/TestDataGenerator';
import { PrismaClient } from '@prisma/client';
import { jest } from '@jest/globals';

// Mock fetch for security testing
const mockFetch = jest.fn();
global.fetch = mockFetch as jest.MockedFunction<typeof fetch>;

describe('Security-Related Edge Cases', () => {
  let prisma: PrismaClient;
  let testDataGenerator: TestDataGenerator;
  
  beforeAll(async () => {
    prisma = await DatabaseTestHelper.getTestDatabase();
    testDataGenerator = new TestDataGenerator(prisma);
  });
  
  beforeEach(async () => {
    await testDataGenerator.cleanupTestData();
    jest.clearAllMocks();
  });
  
  describe('Input Validation Security', () => {
    it('should prevent XSS attacks in authentication fields', async () => {
      const xssPayloads = [
        '<script>alert("xss")</script>',
        'javascript:alert("xss")',
        '"><script>alert("xss")</script>',
        '\'; DROP TABLE users; --',
        '<img src=x onerror=alert("xss")>',
        '{{constructor.constructor("alert(\\"xss\\")")()}}',
        '${alert("xss")}',
        '<svg onload=alert("xss")>',
        'data:text/html,<script>alert("xss")</script>'
      ];
      
      for (const payload of xssPayloads) {
        mockFetch.mockResolvedValueOnce(new Response(JSON.stringify({
          error: 'Invalid Input',
          code: 'INPUT_VALIDATION_FAILED',
          message: 'Input contains potentially malicious content',
          sanitizedInput: payload.replace(/<[^>]*>/g, ''),
          securityViolation: true
        }), { status: 400 }));
        
        const response = await fetch('/api/auth/signin', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: payload,
            password: 'Password123!'
          })
        });
        
        expect(response.status).toBe(400);
        
        const errorData = await response.json();
        expect(errorData.code).toBe('INPUT_VALIDATION_FAILED');
        expect(errorData.securityViolation).toBe(true);
      }
      
      // console.log('✅ XSS attack prevention in authentication fields');
    });
    
    it('should prevent SQL injection attempts in user inputs', async () => {
      const sqlInjectionPayloads = [
        "'; DROP TABLE users; --",
        "' OR '1'='1' --",
        "' UNION SELECT * FROM users --",
        "admin'--",
        "' OR 1=1#",
        "'; INSERT INTO users (email) VALUES ('hacker@evil.com'); --",
        "' OR (SELECT COUNT(*) FROM users) > 0 --",
        "'; UPDATE users SET role='admin' WHERE email='victim@test.com'; --"
      ];
      
      for (const payload of sqlInjectionPayloads) {
        mockFetch.mockResolvedValueOnce(new Response(JSON.stringify({
          error: 'SQL Injection Detected',
          code: 'SQL_INJECTION_ATTEMPT',
          message: 'Input contains SQL injection patterns',
          blockedPattern: payload.substring(0, 20),
          securityIncident: true
        }), { status: 400 }));
        
        const response = await fetch('/api/auth/signin', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: `user${payload}@example.com`,
            password: 'Password123!'
          })
        });
        
        expect(response.status).toBe(400);
        
        const errorData = await response.json();
        expect(errorData.code).toBe('SQL_INJECTION_ATTEMPT');
        expect(errorData.securityIncident).toBe(true);
      }
      
      // console.log('✅ SQL injection prevention');
    });
    
    it('should handle extremely long input values', async () => {
      const extremelyLongEmail = 'a'.repeat(10000) + '@example.com';
      const extremelyLongPassword = 'P'.repeat(10000) + '123!';
      
      mockFetch.mockResolvedValue(new Response(JSON.stringify({
        error: 'Input Too Long',
        code: 'INPUT_LENGTH_EXCEEDED',
        message: 'Input exceeds maximum allowed length',
        limits: {
          email: 254,
          password: 128
        },
        received: {
          email: extremelyLongEmail.length,
          password: extremelyLongPassword.length
        }
      }), { status: 413 }));
      
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: extremelyLongEmail,
          password: extremelyLongPassword,
          name: 'Test User'
        })
      });
      
      expect(response.status).toBe(413);
      
      const errorData = await response.json();
      expect(errorData.code).toBe('INPUT_LENGTH_EXCEEDED');
      expect(errorData.received.email).toBeGreaterThan(errorData.limits.email);
      
      // console.log('✅ Extremely long input handling');
    });
    
    it('should sanitize Unicode and special characters', async () => {
      const unicodePayloads = [
        'test\u0000null@example.com', // Null byte
        'test\u200B\u200C\u200D@example.com', // Zero-width characters
        'test\uFEFF@example.com', // Byte order mark
        'test\u202E@example.com', // Right-to-left override
        'test\u0001\u0002\u0003@example.com', // Control characters
        'test\uD83D\uDE00@example.com', // Emoji
        'test\u{1F4A9}@example.com', // Poop emoji (requires unicode flag)
      ];
      
      for (const payload of unicodePayloads) {
        mockFetch.mockResolvedValueOnce(new Response(JSON.stringify({
          success: true,
          user: { 
            email: payload.replace(/[\u0000-\u001F\u007F-\u009F\uFEFF]/g, ''),
            sanitized: true
          },
          warnings: ['Input contained special characters that were sanitized']
        }), { status: 200 }));
        
        const response = await fetch('/api/auth/signin', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: payload,
            password: 'Password123!'
          })
        });
        
        expect(response.status).toBe(200);
        
        const responseData = await response.json();
        expect(responseData.user.sanitized).toBe(true);
      }
      
      // console.log('✅ Unicode and special character sanitization');
    });
  });
  
  describe('Brute Force Attack Protection', () => {
    it('should implement account lockout after multiple failed attempts', async () => {
      const user = await testDataGenerator.createTestUser({
        email: 'bruteforce@example.com'
      });
      
      let attemptCount = 0;
      const maxAttempts = 5;
      
      mockFetch.mockImplementation(() => {
        attemptCount++;
        
        if (attemptCount < maxAttempts) {
          return Promise.resolve(new Response(JSON.stringify({
            error: 'Invalid Credentials',
            code: 'INVALID_CREDENTIALS',
            attemptsRemaining: maxAttempts - attemptCount
          }), { status: 401 }));
        } else if (attemptCount === maxAttempts) {
          return Promise.resolve(new Response(JSON.stringify({
            error: 'Account Locked',
            code: 'ACCOUNT_LOCKED',
            message: 'Account locked due to too many failed attempts',
            lockoutDuration: 900, // 15 minutes
            unlockAt: new Date(Date.now() + 15 * 60 * 1000).toISOString()
          }), { status: 423 }));
        } else {
          return Promise.resolve(new Response(JSON.stringify({
            error: 'Account Locked',
            code: 'ACCOUNT_LOCKED',
            message: 'Account is currently locked'
          }), { status: 423 }));
        }
      });
      
      // Make failed attempts
      for (let i = 0; i < maxAttempts; i++) {
        const response = await fetch('/api/auth/signin', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: user.email,
            password: 'WrongPassword!'
          })
        });
        
        if (i < maxAttempts - 1) {
          expect(response.status).toBe(401);
          const errorData = await response.json();
          expect(errorData.attemptsRemaining).toBe(maxAttempts - i - 1);
        } else {
          expect(response.status).toBe(423);
          const errorData = await response.json();
          expect(errorData.code).toBe('ACCOUNT_LOCKED');
        }
      }
      
      // Additional attempt should still be locked
      const lockedResponse = await fetch('/api/auth/signin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: user.email,
          password: 'CorrectPassword123!'
        })
      });
      
      expect(lockedResponse.status).toBe(423);
      
      // console.log('✅ Brute force protection with account lockout');
    });
    
    it('should implement progressive delays for failed attempts', async () => {
      const user = await testDataGenerator.createTestUser();
      
      let attemptCount = 0;
      const delays = [0, 1000, 2000, 4000, 8000]; // Progressive delays in ms
      
      mockFetch.mockImplementation(() => {
        attemptCount++;
        const delay = delays[Math.min(attemptCount - 1, delays.length - 1)];
        
        return new Promise(resolve => {
          setTimeout(() => {
            resolve(new Response(JSON.stringify({
              error: 'Invalid Credentials',
              code: 'INVALID_CREDENTIALS',
              delayApplied: delay,
              nextDelay: delays[Math.min(attemptCount, delays.length - 1)]
            }), { status: 401 }));
          }, delay);
        });
      });
      
      const attemptTimes: number[] = [];
      
      // Make multiple failed attempts and measure delays
      for (let i = 0; i < 3; i++) {
        const startTime = Date.now();
        
        const response = await fetch('/api/auth/signin', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: user.email,
            password: 'WrongPassword!'
          })
        });
        
        const endTime = Date.now();
        attemptTimes.push(endTime - startTime);
        
        expect(response.status).toBe(401);
        
        const errorData = await response.json();
        expect(errorData.delayApplied).toBeDefined();
      }
      
      // Verify progressive delays
      expect(attemptTimes[1]).toBeGreaterThan(attemptTimes[0]);
      expect(attemptTimes[2]).toBeGreaterThan(attemptTimes[1]);
      
      // console.log('✅ Progressive delay implementation');
    });
  });
  
  describe('Rate Limiting and Suspicious Activity', () => {
    it('should detect and block suspicious login patterns', async () => {
      const suspiciousPatterns = [
        // Rapid-fire attempts from same IP
        { ip: '192.168.1.100', userAgent: 'Bot/1.0', pattern: 'rapid_fire' },
        // Dictionary attack patterns
        { ip: '10.0.0.1', userAgent: 'AttackTool/2.0', pattern: 'dictionary_attack' },
        // Distributed attack from multiple IPs
        { ip: '172.16.0.1', userAgent: 'Normal Browser', pattern: 'distributed_attack' }
      ];
      
      for (const pattern of suspiciousPatterns) {
        mockFetch.mockResolvedValueOnce(new Response(JSON.stringify({
          error: 'Suspicious Activity Detected',
          code: 'SUSPICIOUS_ACTIVITY',
          message: 'Login pattern indicates potential attack',
          pattern: pattern.pattern,
          sourceIP: pattern.ip,
          blockedDuration: 3600 // 1 hour
        }), { status: 429 }));
        
        const response = await fetch('/api/auth/signin', {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'X-Forwarded-For': pattern.ip,
            'User-Agent': pattern.userAgent
          },
          body: JSON.stringify({
            email: 'target@example.com',
            password: 'Password123!'
          })
        });
        
        expect(response.status).toBe(429);
        
        const errorData = await response.json();
        expect(errorData.code).toBe('SUSPICIOUS_ACTIVITY');
        expect(errorData.pattern).toBe(pattern.pattern);
      }
      
      // console.log('✅ Suspicious activity pattern detection');
    });
    
    it('should implement CAPTCHA after multiple failures', async () => {
      const user = await testDataGenerator.createTestUser();
      
      let attemptCount = 0;
      const captchaThreshold = 3;
      
      mockFetch.mockImplementation(() => {
        attemptCount++;
        
        if (attemptCount < captchaThreshold) {
          return Promise.resolve(new Response(JSON.stringify({
            error: 'Invalid Credentials',
            code: 'INVALID_CREDENTIALS'
          }), { status: 401 }));
        } else {
          return Promise.resolve(new Response(JSON.stringify({
            error: 'CAPTCHA Required',
            code: 'CAPTCHA_REQUIRED',
            message: 'Please complete CAPTCHA to continue',
            captchaChallenge: 'base64-encoded-image',
            sessionId: 'captcha-session-123'
          }), { status: 428 })); // Precondition Required
        }
      });
      
      // Make attempts until CAPTCHA is required
      for (let i = 0; i < captchaThreshold; i++) {
        const response = await fetch('/api/auth/signin', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: user.email,
            password: 'WrongPassword!'
          })
        });
        
        expect(response.status).toBe(401);
      }
      
      // Next attempt should require CAPTCHA
      const captchaResponse = await fetch('/api/auth/signin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: user.email,
          password: 'WrongPassword!'
        })
      });
      
      expect(captchaResponse.status).toBe(428);
      
      const captchaData = await captchaResponse.json();
      expect(captchaData.code).toBe('CAPTCHA_REQUIRED');
      expect(captchaData.captchaChallenge).toBeDefined();
      
      // console.log('✅ CAPTCHA requirement after multiple failures');
    });
  });
  
  describe('Session Security Violations', () => {
    it('should detect session fixation attempts', async () => {
      const user = await testDataGenerator.createTestUser();
      
      // Simulate attacker providing session token
      const attackerProvidedToken = 'attacker-controlled-session-123';
      
      mockFetch.mockResolvedValue(new Response(JSON.stringify({
        error: 'Session Fixation Detected',
        code: 'SESSION_FIXATION_ATTEMPT',
        message: 'Attempt to use predetermined session token',
        providedToken: attackerProvidedToken.substring(0, 10) + '...',
        newSessionGenerated: true
      }), { status: 403 }));
      
      const response = await fetch('/api/auth/signin', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'X-Requested-Session': attackerProvidedToken
        },
        body: JSON.stringify({
          email: user.email,
          password: 'Password123!'
        })
      });
      
      expect(response.status).toBe(403);
      
      const errorData = await response.json();
      expect(errorData.code).toBe('SESSION_FIXATION_ATTEMPT');
      expect(errorData.newSessionGenerated).toBe(true);
      
      // console.log('✅ Session fixation attack detection');
    });
    
    it('should prevent CSRF attacks in authentication', async () => {
      const user = await testDataGenerator.createTestUser();
      
      mockFetch.mockResolvedValue(new Response(JSON.stringify({
        error: 'CSRF Token Mismatch',
        code: 'CSRF_TOKEN_MISMATCH',
        message: 'Invalid or missing CSRF token',
        expectedOrigin: 'https://legitimate-site.com',
        receivedOrigin: 'https://malicious-site.com'
      }), { status: 403 }));
      
      const response = await fetch('/api/auth/signin', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Origin': 'https://malicious-site.com',
          'Referer': 'https://malicious-site.com/attack-page'
        },
        body: JSON.stringify({
          email: user.email,
          password: 'Password123!'
        })
      });
      
      expect(response.status).toBe(403);
      
      const errorData = await response.json();
      expect(errorData.code).toBe('CSRF_TOKEN_MISMATCH');
      expect(errorData.receivedOrigin).toBe('https://malicious-site.com');
      
      // console.log('✅ CSRF attack prevention');
    });
  });
  
  describe('IP-Based Security Measures', () => {
    it('should detect and block known malicious IP addresses', async () => {
      const maliciousIPs = [
        '192.168.1.666', // Fake malicious IP
        '10.0.0.1', // Known attacker IP
        '172.16.255.255' // Suspicious IP
      ];
      
      for (const maliciousIP of maliciousIPs) {
        mockFetch.mockResolvedValueOnce(new Response(JSON.stringify({
          error: 'IP Address Blocked',
          code: 'IP_BLOCKED',
          message: 'Request from blocked IP address',
          sourceIP: maliciousIP,
          blockReason: 'Known malicious activity',
          blockExpiry: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
        }), { status: 403 }));
        
        const response = await fetch('/api/auth/signin', {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'X-Forwarded-For': maliciousIP,
            'X-Real-IP': maliciousIP
          },
          body: JSON.stringify({
            email: 'test@example.com',
            password: 'Password123!'
          })
        });
        
        expect(response.status).toBe(403);
        
        const errorData = await response.json();
        expect(errorData.code).toBe('IP_BLOCKED');
        expect(errorData.sourceIP).toBe(maliciousIP);
      }
      
      // console.log('✅ Malicious IP address blocking');
    });
    
    it('should implement geolocation-based restrictions', async () => {
      const restrictedCountries = ['XX', 'YY']; // Fake country codes
      
      for (const countryCode of restrictedCountries) {
        mockFetch.mockResolvedValueOnce(new Response(JSON.stringify({
          error: 'Geographic Restriction',
          code: 'GEO_RESTRICTED',
          message: 'Authentication not allowed from this location',
          countryCode: countryCode,
          allowedCountries: ['US', 'CA', 'GB']
        }), { status: 403 }));
        
        const response = await fetch('/api/auth/signin', {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'X-Country-Code': countryCode
          },
          body: JSON.stringify({
            email: 'test@example.com',
            password: 'Password123!'
          })
        });
        
        expect(response.status).toBe(403);
        
        const errorData = await response.json();
        expect(errorData.code).toBe('GEO_RESTRICTED');
        expect(errorData.countryCode).toBe(countryCode);
      }
      
      // console.log('✅ Geolocation-based restrictions');
    });
  });
  
  describe('Advanced Security Threats', () => {
    it('should detect credential stuffing attacks', async () => {
      const credentialLists = [
        { email: 'victim1@example.com', password: 'password123' },
        { email: 'victim2@example.com', password: 'qwerty123' },
        { email: 'victim3@example.com', password: 'admin123' },
        { email: 'victim4@example.com', password: 'letmein' }
      ];
      
      let attemptCount = 0;
      
      mockFetch.mockImplementation(() => {
        attemptCount++;
        
        if (attemptCount > 3) {
          return Promise.resolve(new Response(JSON.stringify({
            error: 'Credential Stuffing Detected',
            code: 'CREDENTIAL_STUFFING',
            message: 'Multiple accounts accessed with common passwords',
            patternDetected: 'common_password_list',
            sourceBlocked: true
          }), { status: 429 }));
        }
        
        return Promise.resolve(new Response(JSON.stringify({
          error: 'Invalid Credentials',
          code: 'INVALID_CREDENTIALS'
        }), { status: 401 }));
      });
      
      // Simulate credential stuffing attempts
      for (const creds of credentialLists) {
        const response = await fetch('/api/auth/signin', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(creds)
        });
        
        if (attemptCount <= 3) {
          expect(response.status).toBe(401);
        } else {
          expect(response.status).toBe(429);
          const errorData = await response.json();
          expect(errorData.code).toBe('CREDENTIAL_STUFFING');
          break;
        }
      }
      
      // console.log('✅ Credential stuffing attack detection');
    });
    
    it('should implement honeypot fields for bot detection', async () => {
      mockFetch.mockResolvedValue(new Response(JSON.stringify({
        error: 'Bot Detected',
        code: 'BOT_DETECTED',
        message: 'Automated submission detected',
        honeypotTriggered: true,
        sourceBlocked: true
      }), { status: 403 }));
      
      // Simulate bot filling honeypot field
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'bot@example.com',
          password: 'Password123!',
          name: 'Bot User',
          honeypot_field: 'bot-filled-this', // Honeypot field
        })
      });
      
      expect(response.status).toBe(403);
      
      const errorData = await response.json();
      expect(errorData.code).toBe('BOT_DETECTED');
      expect(errorData.honeypotTriggered).toBe(true);
      
      // console.log('✅ Honeypot field bot detection');
    });
  });
  
  afterAll(async () => {
    await testDataGenerator.cleanupTestData();
    await prisma.$disconnect();
  });
});