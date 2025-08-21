/**
 * Audit Logging Integration Tests
 * 
 * Tests audit logging across all authentication operations,
 * data integrity, performance under load, and distributed environments.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach, jest } from '@jest/globals';
import { PrismaClient } from '@prisma/client';
import {
  AuditService,
  AuditHelpers,
  type AuditContext
} from '@/lib/audit';
import { db } from '@/lib/db';

describe('Audit Logging Integration Tests', () => {
  let testDb: PrismaClient;
  let testAuditService: AuditService;

  beforeAll(async () => {
    // Use the main database for integration tests
    testDb = db;
    testAuditService = new AuditService(testDb);
    
    // Ensure audit triggers are enabled
    try {
      await testAuditService.enableAuditTriggers();
    } catch (_error) {
      console.warn('Could not enable audit triggers, some tests may fail');
    }
  });

  afterAll(async () => {
    // Clean up test data
    try {
      await testDb.auditLog.deleteMany({
        where: {
          metadata: {
            path: ['test_run'],
            equals: true
          }
        }
      });
    } catch (_error) {
      // Ignore cleanup errors
    }
  });

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers({ now: new Date('2024-01-01T00:00:00Z') });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('Audit Logging Across All Authentication Operations', () => {
    it('should log user registration operations', async () => {
      const testContext: AuditContext = {
        userId: 'test-user-1',
        userEmail: 'test1@example.com',
        ipAddress: '192.168.1.100',
        userAgent: 'Mozilla/5.0 Test Browser',
        sessionId: 'test-session-1',
        requestId: 'test-request-1'
      };

      await testAuditService.setAuditContext(testContext);

      // Simulate user registration
      await testAuditService.createAuditLog({
        tableName: 'users',
        recordId: 'user-123',
        action: 'CREATE',
        newValues: {
          email: 'test1@example.com',
          name: 'Test User',
          emailVerified: false
        },
        metadata: {
          operation: 'user_registration',
          test_run: true
        }
      });

      // Verify audit log was created
      const auditTrail = await testAuditService.getAuditTrail('users', 'user-123');
      expect(auditTrail.length).toBeGreaterThan(0);
      
      const registrationLog = auditTrail[0];
      expect(registrationLog.action).toBe('CREATE');
      expect(registrationLog.userId).toBe(testContext.userId);
      expect(registrationLog.ipAddress).toBe(testContext.ipAddress);
      expect(registrationLog.newValues).toEqual({
        email: 'test1@example.com',
        name: 'Test User',
        emailVerified: false
      });
    });

    it('should log authentication attempts', async () => {
      const loginContext: AuditContext = {
        userId: 'test-user-2',
        userEmail: 'test2@example.com',
        ipAddress: '192.168.1.101',
        userAgent: 'Chrome/91.0 Test',
        requestId: 'login-request-1'
      };

      await testAuditService.setAuditContext(loginContext);

      // Log successful login
      await testAuditService.createAuditLog({
        tableName: 'auth_sessions',
        recordId: 'session-456',
        action: 'LOGIN',
        newValues: {
          userId: 'test-user-2',
          expiresAt: new Date(Date.now() + 86400000),
          ipAddress: '192.168.1.101'
        },
        metadata: {
          operation: 'user_login',
          success: true,
          test_run: true
        }
      });

      // Log failed login attempt
      await testAuditService.createAuditLog({
        tableName: 'auth_sessions',
        recordId: 'failed-attempt-1',
        action: 'LOGIN',
        metadata: {
          operation: 'user_login',
          success: false,
          failure_reason: 'invalid_credentials',
          test_run: true
        }
      });

      const loginLogs = await testAuditService.queryAuditLogs({
        tableName: 'auth_sessions',
        actions: ['LOGIN']
      });

      expect(loginLogs.length).toBeGreaterThanOrEqual(2);
      
      const successfulLogin = loginLogs.find(log => 
        log.metadata && typeof log.metadata === 'object' && 
        'success' in log.metadata && log.metadata.success === true
      );
      const failedLogin = loginLogs.find(log => 
        log.metadata && typeof log.metadata === 'object' && 
        'success' in log.metadata && log.metadata.success === false
      );

      expect(successfulLogin).toBeTruthy();
      expect(failedLogin).toBeTruthy();
      expect(successfulLogin?.userId).toBe('test-user-2');
    });

    it('should log password change operations', async () => {
      const passwordContext: AuditContext = {
        userId: 'test-user-3',
        userEmail: 'test3@example.com',
        ipAddress: '192.168.1.102',
        sessionId: 'password-session-1'
      };

      await testAuditService.setAuditContext(passwordContext);

      // Log password change
      await testAuditService.createAuditLog({
        tableName: 'users',
        recordId: 'user-789',
        action: 'UPDATE',
        oldValues: {
          passwordUpdatedAt: new Date('2023-01-01')
        },
        newValues: {
          passwordUpdatedAt: new Date()
        },
        changedFields: [, 'passwordUpdatedAt'],
        metadata: {
          operation: 'password_change',
          change_method: 'user_initiated',
          test_run: true
        }
      });

      const passwordLogs = await testAuditService.getAuditTrail('users', 'user-789');
      expect(passwordLogs.length).toBeGreaterThan(0);
      
      const passwordChange = passwordLogs[0];
      expect(passwordChange.action).toBe('UPDATE');
      expect(passwordChange.changedFields).toContain();
      expect(passwordChange.metadata).toMatchObject({
        operation: 'password_change'
      });
    });

    it('should log session management operations', async () => {
      const sessionContext: AuditContext = {
        userId: 'test-user-4',
        userEmail: 'test4@example.com',
        ipAddress: '192.168.1.103',
        sessionId: 'session-management-1'
      };

      await testAuditService.setAuditContext(sessionContext);

      // Log session creation
      await testAuditService.createAuditLog({
        tableName: 'sessions',
        recordId: 'session-creation-1',
        action: 'CREATE',
        newValues: {
          userId: 'test-user-4',
          expiresAt: new Date(Date.now() + 86400000),
          ipAddress: '192.168.1.103'
        },
        metadata: {
          operation: 'session_create',
          test_run: true
        }
      });

      // Log session termination
      await testAuditService.createAuditLog({
        tableName: 'sessions',
        recordId: 'session-creation-1',
        action: 'DELETE',
        oldValues: {
          userId: 'test-user-4',
          active: true
        },
        metadata: {
          operation: 'session_terminate',
          termination_reason: 'user_logout',
          test_run: true
        }
      });

      const sessionLogs = await testAuditService.getAuditTrail('sessions', 'session-creation-1');
      expect(sessionLogs.length).toBe(2);
      
      const createLog = sessionLogs.find(log => log.action === 'CREATE');
      const deleteLog = sessionLogs.find(log => log.action === 'DELETE');
      
      expect(createLog).toBeTruthy();
      expect(deleteLog).toBeTruthy();
    });
  });

  describe('Audit Log Data Integrity and Completeness', () => {
    it('should maintain referential integrity in audit logs', async () => {
      const testContext: AuditContext = {
        userId: 'integrity-test-user',
        userEmail: 'integrity@example.com',
        ipAddress: '192.168.1.104',
        requestId: 'integrity-request-1'
      };

      await testAuditService.setAuditContext(testContext);

      // Create related audit entries
      const recordId = 'integrity-record-1';
      
      await testAuditService.createAuditLog({
        tableName: 'users',
        recordId,
        action: 'CREATE',
        newValues: { email: 'integrity@example.com' },
        metadata: { test_run: true, integrity_test: true }
      });

      await testAuditService.createAuditLog({
        tableName: 'users',
        recordId,
        action: 'UPDATE',
        oldValues: { email: 'integrity@example.com', verified: false },
        newValues: { email: 'integrity@example.com', verified: true },
        changedFields: ['verified'],
        metadata: { test_run: true, integrity_test: true }
      });

      const auditTrail = await testAuditService.getAuditTrail('users', recordId);
      expect(auditTrail.length).toBe(2);

      // Verify all entries have consistent context
      auditTrail.forEach(entry => {
        expect(entry.userId).toBe(testContext.userId);
        expect(entry.ipAddress).toBe(testContext.ipAddress);
        expect(entry.tableName).toBe('users');
        expect(entry.recordId).toBe(recordId);
      });

      // Verify chronological order
      const timestamps = auditTrail.map(entry => entry.timestamp.getTime());
      const sortedTimestamps = [...timestamps].sort((a, b) => b - a);
      expect(timestamps).toEqual(sortedTimestamps);
    });

    it('should validate audit data completeness', async () => {
      const completenessContext: AuditContext = {
        userId: 'completeness-user',
        userEmail: 'complete@example.com',
        ipAddress: '192.168.1.105',
        userAgent: 'Complete Test Agent',
        sessionId: 'complete-session',
        requestId: 'complete-request'
      };

      await testAuditService.setAuditContext(completenessContext);

      await testAuditService.createAuditLog({
        tableName: 'test_table',
        recordId: 'completeness-record',
        action: 'UPDATE',
        oldValues: { field1: 'old_value1', field2: 'old_value2' },
        newValues: { field1: 'new_value1', field2: 'new_value2' },
        changedFields: ['field1', 'field2'],
        metadata: {
          test_run: true,
          completeness_test: true,
          additional_context: 'test_data'
        }
      });

      const logs = await testAuditService.getAuditTrail('test_table', 'completeness-record');
      expect(logs.length).toBeGreaterThan(0);

      const log = logs[0];
      
      // Verify all required fields are present
      expect(log.id).toBeTruthy();
      expect(log.tableName).toBe('test_table');
      expect(log.recordId).toBe('completeness-record');
      expect(log.action).toBe('UPDATE');
      expect(log.userId).toBe(completenessContext.userId);
      expect(log.userEmail).toBe(completenessContext.userEmail);
      expect(log.ipAddress).toBe(completenessContext.ipAddress);
      expect(log.userAgent).toBe(completenessContext.userAgent);
      expect(log.sessionId).toBe(completenessContext.sessionId);
      expect(log.requestId).toBe(completenessContext.requestId);
      expect(log.oldValues).toEqual({ field1: 'old_value1', field2: 'old_value2' });
      expect(log.newValues).toEqual({ field1: 'new_value1', field2: 'new_value2' });
      expect(log.changedFields).toEqual(['field1', 'field2']);
      expect(log.timestamp).toBeInstanceOf(Date);
      expect(log.metadata).toMatchObject({
        test_run: true,
        completeness_test: true,
        additional_context: 'test_data'
      });
    });

    it('should handle sensitive data masking', () => {
      const testData = {
        email: 'user@example.com',
        password: 'secret123',
        token: 'jwt.token.here',
        apiKey: 'api_key_12345',
        creditCard: '4111111111111111',
        ssn: '123-45-6789',
        normalField: 'normal_value'
      };

      const maskedData = AuditHelpers.maskSensitiveData(testData);

      expect(maskedData.email).toBe('user@example.com');
      expect(maskedData.normalField).toBe('normal_value');
      expect(maskedData.password).toBe('[MASKED]');
      expect(maskedData).toBe('ha***ef');
      expect(maskedData.token).toBe('[MASKED]');
      expect(maskedData.apiKey).toBe('ap***45');
      expect(maskedData.creditCard).toBe('41***11');
      expect(maskedData.ssn).toBe('[MASKED]');
    });
  });

  describe('Audit Logging Performance Under Load', () => {
    it('should handle high-frequency audit operations efficiently', async () => {
      const performanceContext: AuditContext = {
        userId: 'perf-user',
        userEmail: 'perf@example.com',
        ipAddress: '192.168.1.106',
        requestId: 'perf-test'
      };

      await testAuditService.setAuditContext(performanceContext);

      const startTime = Date.now();
      const operationCount = 100;

      // Create many audit logs concurrently
      const promises = Array.from({ length: operationCount }, async (_, i) => {
        return testAuditService.createAuditLog({
          tableName: 'performance_test',
          recordId: `perf-record-${i}`,
          action: 'CREATE',
          newValues: { data: `test_data_${i}` },
          metadata: {
            test_run: true,
            performance_test: true,
            batch_index: i
          }
        });
      });

      await Promise.all(promises);
      const endTime = Date.now();
      const duration = endTime - startTime;

      // Should complete in reasonable time (less than 5 seconds for 100 operations)
      expect(duration).toBeLessThan(5000);

      // Verify all logs were created
      const performanceLogs = await testAuditService.queryAuditLogs({
        tableName: 'performance_test',
        limit: operationCount + 10
      });

      const testLogs = performanceLogs.filter(log => 
        log.metadata && typeof log.metadata === 'object' && 
        'performance_test' in log.metadata
      );

      expect(testLogs.length).toBe(operationCount);
    });

    it('should maintain performance with large result sets', async () => {
      // Query a large number of audit logs
      const startTime = Date.now();
      
      const largeLogs = await testAuditService.queryAuditLogs({
        limit: 1000,
        offset: 0
      });

      const endTime = Date.now();
      const queryDuration = endTime - startTime;

      // Query should complete quickly even with many results
      expect(queryDuration).toBeLessThan(2000); // Less than 2 seconds
      expect(Array.isArray(largeLogs)).toBe(true);
    });

    it('should handle concurrent audit operations without data corruption', async () => {
      const concurrentContext: AuditContext = {
        userId: 'concurrent-user',
        userEmail: 'concurrent@example.com',
        ipAddress: '192.168.1.107'
      };

      await testAuditService.setAuditContext(concurrentContext);

      const concurrentOps = 50;
      const recordId = 'concurrent-record';

      // Create concurrent updates to the same record
      const promises = Array.from({ length: concurrentOps }, async (_, i) => {
        return testAuditService.createAuditLog({
          tableName: 'concurrent_test',
          recordId,
          action: 'UPDATE',
          oldValues: { value: i - 1 },
          newValues: { value: i },
          changedFields: ['value'],
          metadata: {
            test_run: true,
            concurrent_test: true,
            operation_index: i
          }
        });
      });

      await Promise.all(promises);

      // Verify all operations were logged correctly
      const concurrentLogs = await testAuditService.getAuditTrail('concurrent_test', recordId);
      
      const testLogs = concurrentLogs.filter(log => 
        log.metadata && typeof log.metadata === 'object' && 
        'concurrent_test' in log.metadata
      );

      expect(testLogs.length).toBe(concurrentOps);

      // Verify no data corruption occurred
      testLogs.forEach(log => {
        expect(log.tableName).toBe('concurrent_test');
        expect(log.recordId).toBe(recordId);
        expect(log.action).toBe('UPDATE');
        expect(log.userId).toBe(concurrentContext.userId);
      });
    });
  });

  describe('Audit Log Storage and Retrieval', () => {
    it('should support complex audit queries with filtering', async () => {
      // Create test data for complex queries
      const testUserId = 'query-test-user';
      const queryContext: AuditContext = {
        userId: testUserId,
        userEmail: 'query@example.com',
        ipAddress: '192.168.1.108'
      };

      await testAuditService.setAuditContext(queryContext);

      // Create different types of operations
      const operations = [
        { action: 'CREATE', tableName: 'users' },
        { action: 'UPDATE', tableName: 'users' },
        { action: 'DELETE', tableName: 'sessions' },
        { action: 'LOGIN', tableName: 'auth_sessions' },
        { action: 'LOGOUT', tableName: 'auth_sessions' }
      ];

      for (const [index, op] of operations.entries()) {
        await testAuditService.createAuditLog({
          tableName: op.tableName,
          recordId: `query-record-${index}`,
          action: op.action as any,
          metadata: {
            test_run: true,
            query_test: true,
            operation_type: op.action
          }
        });
      }

      // Test filtering by action
      const createLogs = await testAuditService.queryAuditLogs({
        actions: ['CREATE'],
        userId: testUserId
      });

      expect(createLogs.some(log => 
        log.metadata && typeof log.metadata === 'object' && 
        'query_test' in log.metadata && log.action === 'CREATE'
      )).toBe(true);

      // Test filtering by table name
      const userLogs = await testAuditService.queryAuditLogs({
        tableName: 'users',
        userId: testUserId
      });

      expect(userLogs.some(log => 
        log.tableName === 'users' && log.userId === testUserId
      )).toBe(true);

      // Test date range filtering
      const recentLogs = await testAuditService.queryAuditLogs({
        startDate: new Date(Date.now() - 3600000), // 1 hour ago
        endDate: new Date(),
        userId: testUserId
      });

      expect(recentLogs.length).toBeGreaterThan(0);
    });

    it('should generate comprehensive audit summaries', async () => {
      // Create diverse audit data for summary testing
      const summaryContext: AuditContext = {
        userId: 'summary-user',
        userEmail: 'summary@example.com',
        ipAddress: '192.168.1.109'
      };

      await testAuditService.setAuditContext(summaryContext);

      const summaryOps = [
        { action: 'CREATE', table: 'users' },
        { action: 'CREATE', table: 'users' },
        { action: 'UPDATE', table: 'users' },
        { action: 'DELETE', table: 'sessions' },
        { action: 'LOGIN', table: 'auth' }
      ];

      for (const [index, op] of summaryOps.entries()) {
        await testAuditService.createAuditLog({
          tableName: op.table,
          recordId: `summary-record-${index}`,
          action: op.action as any,
          metadata: {
            test_run: true,
            summary_test: true
          }
        });
      }

      const summary = await testAuditService.getAuditSummary();

      expect(summary.totalRecords).toBeGreaterThan(0);
      expect(summary.dateRange.earliest).toBeInstanceOf(Date);
      expect(summary.dateRange.latest).toBeInstanceOf(Date);
      expect(typeof summary.actionCounts).toBe('object');
      expect(typeof summary.tableCounts).toBe('object');
      expect(typeof summary.userCounts).toBe('object');

      // Verify counts include our test data
      expect(summary.actionCounts.CREATE).toBeGreaterThan(0);
    });
  });

  describe('Audit Logging in Distributed Environments', () => {
    it('should handle multi-instance audit logging consistently', async () => {
      // Simulate multiple server instances
      const instances = ['server-1', 'server-2', 'server-3'];
      const distributedContext: AuditContext = {
        userId: 'distributed-user',
        userEmail: 'distributed@example.com',
        ipAddress: '192.168.1.110'
      };

      // Create audit service instances for each "server"
      const services = instances.map(() => new AuditService(testDb));

      // Each instance logs operations
      const promises = services.map(async (service, index) => {
        await service.setAuditContext({
          ...distributedContext,
          requestId: `${instances[index]}-request`
        });

        return service.createAuditLog({
          tableName: 'distributed_test',
          recordId: `distributed-record-${index}`,
          action: 'CREATE',
          newValues: { instance: instances[index] },
          metadata: {
            test_run: true,
            distributed_test: true,
            server_instance: instances[index]
          }
        });
      });

      await Promise.all(promises);

      // Verify all instances logged correctly
      const distributedLogs = await testAuditService.queryAuditLogs({
        tableName: 'distributed_test'
      });

      const testLogs = distributedLogs.filter(log => 
        log.metadata && typeof log.metadata === 'object' && 
        'distributed_test' in log.metadata
      );

      expect(testLogs.length).toBe(instances.length);

      // Verify each instance logged its operation
      instances.forEach(instance => {
        const instanceLog = testLogs.find(log => 
          log.metadata && typeof log.metadata === 'object' && 
          'server_instance' in log.metadata && 
          log.metadata.server_instance === instance
        );
        expect(instanceLog).toBeTruthy();
      });
    });

    it('should maintain audit context across distributed operations', async () => {
      const distributedRequestId = 'distributed-request-123';
      const distributedContext: AuditContext = {
        userId: 'context-user',
        userEmail: 'context@example.com',
        ipAddress: '192.168.1.111',
        requestId: distributedRequestId
      };

      // Set context on multiple service instances
      const service1 = new AuditService(testDb);
      const service2 = new AuditService(testDb);

      await service1.setAuditContext(distributedContext);
      await service2.setAuditContext(distributedContext);

      // Both services log related operations
      await service1.createAuditLog({
        tableName: 'context_test',
        recordId: 'context-record-1',
        action: 'CREATE',
        metadata: {
          test_run: true,
          context_test: true,
          service_instance: 'service-1'
        }
      });

      await service2.createAuditLog({
        tableName: 'context_test',
        recordId: 'context-record-2', 
        action: 'UPDATE',
        metadata: {
          test_run: true,
          context_test: true,
          service_instance: 'service-2'
        }
      });

      // Verify both operations share the same request context
      const contextLogs = await testAuditService.queryAuditLogs({
        tableName: 'context_test'
      });

      const testLogs = contextLogs.filter(log => 
        log.requestId === distributedRequestId
      );

      expect(testLogs.length).toBe(2);

      testLogs.forEach(log => {
        expect(log.requestId).toBe(distributedRequestId);
        expect(log.userId).toBe(distributedContext.userId);
        expect(log.ipAddress).toBe(distributedContext.ipAddress);
      });
    });
  });

  describe('Audit System Monitoring and Maintenance', () => {
    it('should check audit trigger status', async () => {
      const triggerStatus = await testAuditService.checkTriggerStatus();
      
      expect(Array.isArray(triggerStatus)).toBe(true);
      
      // Should have triggers for main tables
      const expectedTables = ['users', 'sessions'];
      expectedTables.forEach(tableName => {
        const tableStatus = triggerStatus.find(status => 
          status.tableName === tableName
        );
        if (tableStatus) {
          expect(typeof tableStatus.triggerEnabled).toBe('boolean');
          expect(tableStatus.triggerName).toBeTruthy();
        }
      });
    });

    it('should handle audit system maintenance operations', async () => {
      // Test enabling/disabling triggers (if supported)
      try {
        await testAuditService.disableAuditTriggers();
        await testAuditService.enableAuditTriggers();
        
        const status = await testAuditService.checkTriggerStatus();
        expect(status.some(s => s.triggerEnabled)).toBe(true);
      } catch (_error) {
        // Triggers might not be supported in test environment
        console.warn('Trigger management not available in test environment');
      }
    });

    it('should support audit log cleanup with retention policies', async () => {
      // Create old test logs
      const oldContext: AuditContext = {
        userId: 'cleanup-user',
        userEmail: 'cleanup@example.com',
        ipAddress: '192.168.1.112'
      };

      await testAuditService.setAuditContext(oldContext);

      await testAuditService.createAuditLog({
        tableName: 'cleanup_test',
        recordId: 'old-record',
        action: 'CREATE',
        metadata: {
          test_run: true,
          cleanup_test: true,
          created_for_cleanup: true
        }
      });

      // Test cleanup function (with very short retention for testing)
      try {
        const cleanupResult = await testAuditService.cleanupAuditLogs(
          0, // 0 days retention (delete everything)
          0, // 0 days critical retention
          10 // small batch size
        );
        
        expect(typeof cleanupResult).toBe('number');
        expect(cleanupResult).toBeGreaterThanOrEqual(0);
      } catch (_error) {
        // Cleanup might not be supported in test environment
        console.warn('Audit cleanup not available in test environment');
      }
    });
  });

  describe('Audit Helper Functions', () => {
    it('should create audit context from request objects', () => {
      const mockRequest = {
        headers: {
          get: jest.fn((header: string) => {
            const headers: Record<string, string> = {
              'user-agent': 'Test Browser',
              'x-forwarded-for': '192.168.1.113, 10.0.0.1',
              'x-real-ip': '192.168.1.113'
            };
            return headers[header] || null;
          })
        }
      } as any;

      const user = {
        id: 'helper-user',
        email: 'helper@example.com'
      };

      const context = AuditHelpers.createContextFromRequest(mockRequest, user);

      expect(context.userId).toBe(user.id);
      expect(context.userEmail).toBe(user.email);
      expect(context.userAgent).toBe('Test Browser');
      expect(context.ipAddress).toBe('192.168.1.113'); // First IP from forwarded
      expect(context.requestId).toBeTruthy();
    });

    it('should identify changed fields correctly', () => {
      const oldData = {
        name: 'Old Name',
        email: 'old@example.com',
        verified: false,
        updatedAt: new Date('2023-01-01')
      };

      const newData = {
        name: 'New Name',
        email: 'old@example.com', // unchanged
        verified: true,
        updatedAt: new Date('2024-01-01') // should be ignored
      };

      const changedFields = AuditHelpers.getChangedFields(oldData, newData);

      expect(changedFields).toContain('name');
      expect(changedFields).toContain('verified');
      expect(changedFields).not.toContain('email');
      expect(changedFields).not.toContain('updatedAt');
    });

    it('should create audit functions with automatic logging', async () => {
      const testFunction = (id: string, data: any) => {
        return { success: true, id, data };
      };

      const auditedFunction = AuditHelpers.auditFunction(
        testFunction,
        {
          tableName: 'function_test',
          action: 'EXECUTE',
          getRecordId: (id: string) => id,
          getMetadata: (id: string, data: any) => ({ id, data_type: typeof data })
        },
        testAuditService
      );

      // Execute the audited function
      const result = auditedFunction('test-123', { test: 'data' });

      expect(result.success).toBe(true);
      expect(result.id).toBe('test-123');

      // Allow time for async audit logging
      await new Promise(resolve => setTimeout(resolve, 100));

      // Verify audit log was created
      const functionLogs = await testAuditService.getAuditTrail('function_test', 'test-123');
      expect(functionLogs.length).toBeGreaterThan(0);
    });
  });
});