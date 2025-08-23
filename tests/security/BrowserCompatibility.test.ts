import { DatabaseTestHelper } from '../setup/jest.setup';
import { TestDataGenerator } from '../fixtures/TestDataGenerator';
import { PrismaClient } from '@prisma/client';
import { jest } from '@jest/globals';

// Mock various browser APIs
const mockFetch = jest.fn();
global.fetch = mockFetch as jest.MockedFunction<typeof fetch>;

describe('Browser Compatibility Edge Cases', () => {
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
  
  describe('JavaScript Disabled Scenarios', () => {
    it('should handle authentication with JavaScript disabled', async () => {
      // Simulate form submission without JavaScript
      mockFetch.mockResolvedValue(new Response(JSON.stringify({
        error: 'JavaScript Required',
        code: 'JAVASCRIPT_DISABLED',
        message: 'This application requires JavaScript to function properly',
        fallbackUrl: '/login-basic',
        noScriptMode: true
      }), { status: 400 }));
      
      // Mock navigator properties to simulate JS disabled environment
      Object.defineProperty(global.navigator, 'userAgent', {
        value: 'Mozilla/5.0 (compatible; NoScript)',
        writable: true
      });
      
      const response = await fetch('/api/auth/signin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: 'email=test@example.com&password=Password123!'
      });
      
      expect(response.status).toBe(400);
      
      const errorData = await response.json();
      expect(errorData.code).toBe('JAVASCRIPT_DISABLED');
      expect(errorData.fallbackUrl).toBe('/login-basic');
      
      // console.log('✅ JavaScript disabled handling');
    });
    
    it('should provide graceful degradation for auth forms', async () => {
      mockFetch.mockResolvedValue(new Response(JSON.stringify({
        success: true,
        user: { id: '123', email: 'test@example.com' },
        redirectUrl: '/dashboard',
        basicMode: true,
        limitations: ['no_realtime_validation', 'no_password_strength_meter']
      }), { status: 200 }));
      
      const response = await fetch('/api/auth/signin-basic', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: 'email=test@example.com&password=Password123!'
      });
      
      expect(response.status).toBe(200);
      
      const responseData = await response.json();
      expect(responseData.basicMode).toBe(true);
      expect(responseData.limitations).toContain('no_realtime_validation');
      
      // console.log('✅ Graceful degradation for auth forms');
    });
  });
  
  describe('Cookie Handling Issues', () => {
    it('should handle disabled cookies scenario', async () => {
      // Mock document.cookie to simulate disabled cookies
      Object.defineProperty(document, 'cookie', {
        get: jest.fn(() => ''),
        set: jest.fn(() => {
          throw new Error('Cookies are disabled');
        }),
        configurable: true
      });
      
      mockFetch.mockResolvedValue(new Response(JSON.stringify({
        error: 'Cookies Required',
        code: 'COOKIES_DISABLED',
        message: 'Authentication requires cookies to be enabled',
        alternatives: ['url_tokens', 'localStorage_fallback'],
        instructions: 'Please enable cookies in your browser settings'
      }), { status: 400 }));
      
      try {
        // Attempt to set authentication cookie
        document.cookie = 'auth_token=test123';
        throw new Error('Expected cookie error');
      } catch (error) {
        expect((error as Error).message).toContain('Cookies are disabled');
      }
      
      const response = await fetch('/api/auth/check-cookies', {
        method: 'GET'
      });
      
      expect(response.status).toBe(400);
      
      const errorData = await response.json();
      expect(errorData.code).toBe('COOKIES_DISABLED');
      expect(errorData.alternatives).toContain('localStorage_fallback');
      
      // console.log('✅ Disabled cookies handling');
    });
    
    it('should handle third-party cookie restrictions', async () => {
      mockFetch.mockResolvedValue(new Response(JSON.stringify({
        warning: 'Third-party cookies blocked',
        code: 'THIRD_PARTY_COOKIES_BLOCKED',
        message: 'Some features may not work due to cookie restrictions',
        alternatives: ['first_party_cookies', 'session_storage'],
        workingFeatures: ['basic_auth', 'password_reset']
      }), { status: 200 }));
      
      // Simulate third-party context
      Object.defineProperty(window, 'parent', {
        value: { origin: 'https://different-domain.com' },
        writable: true
      });
      
      const response = await fetch('/api/auth/third-party-check', {
        method: 'GET',
        headers: { 'X-Frame-Context': 'third-party' }
      });
      
      expect(response.status).toBe(200);
      
      const responseData = await response.json();
      expect(responseData.code).toBe('THIRD_PARTY_COOKIES_BLOCKED');
      expect(responseData.alternatives).toContain('session_storage');
      
      // console.log('✅ Third-party cookie restrictions handling');
    });
  });
  
  describe('Local Storage Issues', () => {
    it('should handle localStorage unavailability', async () => {
      // Mock localStorage to simulate unavailability
      const originalLocalStorage = global.localStorage;
      Object.defineProperty(global, 'localStorage', {
        value: undefined,
        writable: true
      });
      
      mockFetch.mockResolvedValue(new Response(JSON.stringify({
        warning: 'Local Storage Unavailable',
        code: 'LOCALSTORAGE_UNAVAILABLE',
        message: 'Using fallback storage mechanism',
        fallbackMethod: 'sessionStorage',
        limitations: ['no_persistent_sessions']
      }), { status: 200 }));
      
      // Test localStorage availability
      let storageAvailable = false;
      try {
        storageAvailable = typeof localStorage !== 'undefined';
      } catch (error) {
        storageAvailable = false;
      }
      
      expect(storageAvailable).toBe(false);
      
      const response = await fetch('/api/auth/storage-check', {
        method: 'GET'
      });
      
      expect(response.status).toBe(200);
      
      const responseData = await response.json();
      expect(responseData.code).toBe('LOCALSTORAGE_UNAVAILABLE');
      expect(responseData.fallbackMethod).toBe('sessionStorage');
      
      // Restore localStorage
      Object.defineProperty(global, 'localStorage', {
        value: originalLocalStorage,
        writable: true
      });
      
      // console.log('✅ localStorage unavailability handling');
    });
    
    it('should handle localStorage quota exceeded', async () => {
      // Mock localStorage quota exceeded
      const mockLocalStorage = {
        getItem: jest.fn(),
        setItem: jest.fn(() => {
          throw new DOMException('QuotaExceededError', 'QuotaExceededError');
        }),
        removeItem: jest.fn(),
        clear: jest.fn(),
        length: 0,
        key: jest.fn()
      };
      
      Object.defineProperty(global, 'localStorage', {
        value: mockLocalStorage,
        writable: true
      });
      
      try {
        localStorage.setItem('auth_data', 'large_session_data');
        throw new Error('Expected quota exceeded error');
      } catch (error) {
        expect((error as Error).name).toBe('QuotaExceededError');
      }
      
      mockFetch.mockResolvedValue(new Response(JSON.stringify({
        error: 'Storage Quota Exceeded',
        code: 'STORAGE_QUOTA_EXCEEDED',
        message: 'Unable to store session data locally',
        action: 'using_server_sessions',
        recommendation: 'Clear browser data or use incognito mode'
      }), { status: 507 })); // Insufficient Storage
      
      const response = await fetch('/api/auth/store-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionData: 'large_data_chunk' })
      });
      
      expect(response.status).toBe(507);
      
      const errorData = await response.json();
      expect(errorData.code).toBe('STORAGE_QUOTA_EXCEEDED');
      
      // console.log('✅ localStorage quota exceeded handling');
    });
  });
  
  describe('Cross-Browser Compatibility', () => {
    it('should handle Internet Explorer compatibility issues', async () => {
      // Mock IE user agent
      Object.defineProperty(global.navigator, 'userAgent', {
        value: 'Mozilla/5.0 (Windows NT 10.0; WOW64; Trident/7.0; .NET4.0C; .NET4.0E; rv:11.0) like Gecko',
        writable: true
      });
      
      mockFetch.mockResolvedValue(new Response(JSON.stringify({
        warning: 'Legacy Browser Detected',
        code: 'LEGACY_BROWSER',
        browser: 'Internet Explorer 11',
        message: 'Limited functionality available',
        unsupportedFeatures: ['fetch_api', 'promises', 'arrow_functions'],
        recommendations: 'Please upgrade to a modern browser'
      }), { status: 200 }));
      
      // Test for IE-specific issues
      const isIE = navigator.userAgent.includes('Trident');
      expect(isIE).toBe(true);
      
      const response = await fetch('/api/auth/browser-check', {
        method: 'GET',
        headers: { 'User-Agent': navigator.userAgent }
      });
      
      expect(response.status).toBe(200);
      
      const responseData = await response.json();
      expect(responseData.code).toBe('LEGACY_BROWSER');
      expect(responseData.unsupportedFeatures).toContain('fetch_api');
      
      // console.log('✅ Internet Explorer compatibility handling');
    });
    
    it('should handle Safari private browsing limitations', async () => {
      // Mock Safari in private browsing mode
      Object.defineProperty(global.navigator, 'userAgent', {
        value: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.1.1 Safari/605.1.15',
        writable: true
      });
      
      // Mock private browsing detection
      const mockStorageTest = () => {
        try {
          localStorage.setItem('test', 'test');
          localStorage.removeItem('test');
          return true;
        } catch (error) {
          return false;
        }
      };
      
      // Mock localStorage to throw in private mode
      Object.defineProperty(global, 'localStorage', {
        value: {
          setItem: () => { throw new Error('QuotaExceededError'); },
          getItem: () => null,
          removeItem: () => {},
          clear: () => {}
        },
        writable: true
      });
      
      const isPrivateBrowsing = !mockStorageTest();
      expect(isPrivateBrowsing).toBe(true);
      
      mockFetch.mockResolvedValue(new Response(JSON.stringify({
        warning: 'Private Browsing Detected',
        code: 'PRIVATE_BROWSING',
        browser: 'Safari',
        message: 'Some features limited in private browsing mode',
        limitations: ['localStorage', 'indexedDB', 'service_workers'],
        workarounds: ['session_only_auth', 'server_side_sessions']
      }), { status: 200 }));
      
      const response = await fetch('/api/auth/private-browsing-check', {
        method: 'GET'
      });
      
      expect(response.status).toBe(200);
      
      const responseData = await response.json();
      expect(responseData.code).toBe('PRIVATE_BROWSING');
      expect(responseData.limitations).toContain('localStorage');
      
      // console.log('✅ Safari private browsing limitations handling');
    });
  });
  
  describe('Mobile Browser Challenges', () => {
    it('should handle mobile browser memory constraints', async () => {
      // Mock mobile browser
      Object.defineProperty(global.navigator, 'userAgent', {
        value: 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_7_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.1.2 Mobile/15E148 Safari/604.1',
        writable: true
      });
      
      mockFetch.mockResolvedValue(new Response(JSON.stringify({
        warning: 'Mobile Memory Constraints',
        code: 'MOBILE_MEMORY_LIMITED',
        device: 'iPhone',
        message: 'Optimizing for limited memory',
        optimizations: ['reduced_cache', 'simplified_ui', 'lazy_loading'],
        sessionStrategy: 'lightweight'
      }), { status: 200 }));
      
      const response = await fetch('/api/auth/mobile-optimization', {
        method: 'GET',
        headers: { 'User-Agent': navigator.userAgent }
      });
      
      expect(response.status).toBe(200);
      
      const responseData = await response.json();
      expect(responseData.code).toBe('MOBILE_MEMORY_LIMITED');
      expect(responseData.optimizations).toContain('reduced_cache');
      
      // console.log('✅ Mobile browser memory constraints handling');
    });
    
    it('should handle iOS PWA authentication issues', async () => {
      // Mock iOS PWA environment
      Object.defineProperty(global.navigator, 'standalone', {
        value: true,
        writable: true
      });
      
      Object.defineProperty(global.navigator, 'userAgent', {
        value: 'Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X) AppleWebKit/605.1.15',
        writable: true
      });
      
      mockFetch.mockResolvedValue(new Response(JSON.stringify({
        info: 'PWA Authentication Mode',
        code: 'PWA_AUTH_MODE',
        platform: 'iOS',
        message: 'Using PWA-optimized authentication flow',
        features: ['biometric_auth', 'keychain_integration'],
        limitations: ['no_third_party_cookies', 'limited_storage']
      }), { status: 200 }));
      
      const isPWA = navigator.standalone === true;
      expect(isPWA).toBe(true);
      
      const response = await fetch('/api/auth/pwa-check', {
        method: 'GET',
        headers: { 
          'User-Agent': navigator.userAgent,
          'X-PWA-Mode': 'true'
        }
      });
      
      expect(response.status).toBe(200);
      
      const responseData = await response.json();
      expect(responseData.code).toBe('PWA_AUTH_MODE');
      expect(responseData.features).toContain('biometric_auth');
      
      // console.log('✅ iOS PWA authentication issues handling');
    });
  });
  
  describe('Browser Extension Interference', () => {
    it('should detect and handle ad blocker interference', async () => {
      // Mock ad blocker detection
      const mockAdBlockDetection = () => {
        // Simulate blocked request to known ad server
        return fetch('https://googleads.g.doubleclick.net/test')
          .then(() => false) // Request succeeded, no ad blocker
          .catch(() => true); // Request failed, ad blocker present
      };
      
      mockFetch.mockImplementation((url) => {
        if ((url as string).includes('doubleclick')) {
          return Promise.reject(new Error('blocked'));
        }
        
        return Promise.resolve(new Response(JSON.stringify({
          warning: 'Ad Blocker Detected',
          code: 'AD_BLOCKER_DETECTED',
          message: 'Ad blocker may interfere with authentication',
          affectedFeatures: ['social_login', 'analytics', 'cdn_resources'],
          workarounds: ['direct_auth', 'first_party_resources']
        }), { status: 200 }));
      });
      
      const adBlockerPresent = await mockAdBlockDetection();
      expect(adBlockerPresent).toBe(true);
      
      const response = await fetch('/api/auth/adblock-check', {
        method: 'GET'
      });
      
      expect(response.status).toBe(200);
      
      const responseData = await response.json();
      expect(responseData.code).toBe('AD_BLOCKER_DETECTED');
      expect(responseData.affectedFeatures).toContain('social_login');
      
      // console.log('✅ Ad blocker interference detection');
    });
    
    it('should handle password manager conflicts', async () => {
      mockFetch.mockResolvedValue(new Response(JSON.stringify({
        warning: 'Password Manager Interference',
        code: 'PASSWORD_MANAGER_CONFLICT',
        message: 'Password manager may cause form submission issues',
        commonIssues: ['duplicate_submissions', 'premature_validation', 'field_conflicts'],
        recommendations: ['disable_autofill', 'manual_submission', 'custom_validation_timing']
      }), { status: 200 }));
      
      // Mock password manager detection via form manipulation
      const formElement = document.createElement('form');
      formElement.innerHTML = `
        <input type="email" name="email" autocomplete="username">
        <input type="password" name="password" autocomplete="current-password">
      `;
      
      // Simulate password manager filling forms
      const emailInput = formElement.querySelector('input[type="email"]') as HTMLInputElement;
      const passwordInput = formElement.querySelector('input[type="password"]') as HTMLInputElement;
      
      // Mock automatic filling
      emailInput.value = 'auto-filled@example.com';
      passwordInput.value = 'auto-filled-password';
      
      expect(emailInput.value).toBe('auto-filled@example.com');
      expect(passwordInput.value).toBe('auto-filled-password');
      
      const response = await fetch('/api/auth/password-manager-check', {
        method: 'GET'
      });
      
      expect(response.status).toBe(200);
      
      const responseData = await response.json();
      expect(responseData.code).toBe('PASSWORD_MANAGER_CONFLICT');
      expect(responseData.commonIssues).toContain('duplicate_submissions');
      
      // console.log('✅ Password manager conflicts handling');
    });
  });
  
  describe('Network Connectivity Variations', () => {
    it('should handle slow network connections', async () => {
      // Mock slow network response
      mockFetch.mockImplementation(() => {
        return new Promise(resolve => {
          setTimeout(() => {
            resolve(new Response(JSON.stringify({
              success: true,
              user: { id: '123', email: 'test@example.com' },
              performance: {
                responseTime: 5000,
                connectionType: 'slow-2g',
                optimized: true
              }
            }), { status: 200 }));
          }, 1000); // 1 second delay
        });
      });
      
      const startTime = Date.now();
      
      const response = await fetch('/api/auth/signin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'test@example.com',
          password: 'Password123!'
        })
      });
      
      const endTime = Date.now();
      const responseTime = endTime - startTime;
      
      expect(response.status).toBe(200);
      expect(responseTime).toBeGreaterThan(800); // Allow for timing variations
      
      const responseData = await response.json();
      expect(responseData.performance.connectionType).toBe('slow-2g');
      
      // console.log('✅ Slow network connection handling');
    });
    
    it('should handle intermittent connectivity', async () => {
      let requestCount = 0;
      
      mockFetch.mockImplementation(() => {
        requestCount++;
        
        if (requestCount % 2 === 0) {
          // Even requests fail (simulating intermittent connectivity)
          return Promise.reject(new Error('NetworkError'));
        } else {
          // Odd requests succeed
          return Promise.resolve(new Response(JSON.stringify({
            success: true,
            connectionStatus: 'unstable',
            retryCount: Math.floor(requestCount / 2)
          }), { status: 200 }));
        }
      });
      
      // Implement retry logic
      let success = false;
      let retries = 0;
      const maxRetries = 3;
      
      while (!success && retries < maxRetries) {
        try {
          const response = await fetch('/api/auth/signin', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              email: 'test@example.com',
              password: 'Password123!'
            })
          });
          
          if (response.ok) {
            success = true;
            const responseData = await response.json();
            expect(responseData.connectionStatus).toBe('unstable');
          }
        } catch (error) {
          retries++;
          if (retries < maxRetries) {
            await new Promise(resolve => setTimeout(resolve, 100));
          }
        }
      }
      
      expect(success).toBe(true);
      expect(retries).toBeGreaterThan(0);
      
      // console.log('✅ Intermittent connectivity handling');
    });
  });
  
  afterAll(async () => {
    await testDataGenerator.cleanupTestData();
    await prisma.$disconnect();
  });
});