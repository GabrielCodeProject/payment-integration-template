# Database Testing and Optimization Guide

## Overview

This guide covers the comprehensive database testing and optimization system implemented for the Payment Integration Template. The system validates and optimizes all database infrastructure from Tasks 2.1-2.11, ensuring high performance, security, and reliability.

## Testing Infrastructure

### Test Framework Components

1. **Jest Configuration** (`jest.config.js`)
   - TypeScript support with ts-jest
   - Custom test sequencing for optimal execution order
   - Coverage reporting and thresholds
   - Timeout handling for database operations

2. **Test Setup & Teardown**
   - Global database setup and teardown
   - Test isolation with automatic cleanup
   - Performance monitoring and metrics collection
   - Database state management

3. **Test Data Generation**
   - Faker.js integration for realistic test data
   - Bulk data generation for load testing
   - Relationship-aware data creation
   - Cleanup utilities

## Test Suites

### 1. Unit Tests (`tests/database/unit/`)

**Purpose**: Validate individual database models and operations

**Coverage**:
- User model CRUD operations
- Product model validation
- Order processing workflows
- Subscription management
- Payment method handling
- Constraint validation
- Relationship integrity

**Execution**: `npm run test:unit`

### 2. Integration Tests (`tests/integration/`)

**Purpose**: Validate database schema and cross-system integration

**Coverage**:
- Schema introspection validation
- Prisma client integration
- Zod schema consistency
- Foreign key constraints
- Index existence and configuration
- Migration state validation

**Execution**: `npm run test:integration`

### 3. Performance Tests (`tests/performance/`)

**Purpose**: Analyze and optimize database performance

**Coverage**:
- Index performance analysis (72+ indexes)
- Query execution benchmarking
- Load testing with realistic data volumes
- Connection pooling performance
- Scalability analysis
- Performance regression detection

**Key Metrics**:
- Query execution times (<50ms for indexed queries)
- Index efficiency (>80% hit ratio)
- Connection pool utilization (<80%)
- Concurrent operation handling

**Execution**: `npm run test:performance`

### 4. Security Tests (`tests/security/`)

**Purpose**: Validate PCI DSS compliance and security measures

**Coverage**:
- PCI DSS Requirements 3, 7, 8, 10, 11 validation
- Authentication and authorization testing
- Password security validation
- Session management security
- OAuth integration security
- SQL injection prevention
- Data isolation between users
- Audit logging verification

**Execution**: `npm run test:security`

### 5. Migration Tests (`tests/database/migration/`)

**Purpose**: Ensure migration integrity and data preservation

**Coverage**:
- Migration state validation
- Data integrity during schema changes
- Index creation verification
- Rollback scenario simulation
- Performance impact analysis
- Constraint enforcement

**Execution**: `npm run test:migration`

### 6. Benchmark Tests (`tests/benchmarks/`)

**Purpose**: Comprehensive performance benchmarking

**Coverage**:
- Payment processing workflows
- Stripe integration benchmarks
- Subscription management performance
- Order processing benchmarks
- Analytics query performance

**Performance Targets**:
- Payment intent creation: >10 ops/sec
- Customer lookups: >200 ops/sec
- Order queries: >150 ops/sec
- Subscription operations: >50 ops/sec

**Execution**: `npm run test:benchmark`

## Performance Optimization

### Database Optimizer (`tests/utils/DatabaseOptimizer.ts`)

**Features**:
- Index usage analysis
- Slow query identification
- Performance recommendations
- Statistics optimization
- Connection pool monitoring

**Optimization Types**:
- **INDEX**: Index creation, removal, or optimization
- **QUERY**: Query structure improvements
- **SCHEMA**: Schema modifications
- **CONFIGURATION**: Database configuration tuning

**Priority Levels**:
- **HIGH**: Critical performance issues (>50% improvement potential)
- **MEDIUM**: Moderate improvements (10-50% improvement)
- **LOW**: Minor optimizations (<10% improvement)

### Performance Monitoring

**Metrics Collected**:
- Query execution times
- Index scan vs sequential scan ratios
- Buffer hit ratios
- Connection pool utilization
- Memory usage patterns

**Alerting Thresholds**:
- Slow queries: >500ms
- Low index efficiency: <80%
- High connection usage: >80%
- Performance regressions: >2x baseline

## CI/CD Integration

### GitHub Actions Workflow (`.github/workflows/database-tests.yml`)

**Workflow Triggers**:
- Push to main/master/develop branches
- Pull requests to main/master
- Scheduled daily performance tests
- Manual trigger with `[perf-test]` or `[load-test]` in commit message

**Job Matrix**:
1. **Database Unit Tests** (Always)
2. **Database Integration Tests** (Always)
3. **Database Security Tests** (Always)
4. **Database Migration Tests** (Always)
5. **Database Performance Tests** (Scheduled/Manual)
6. **Database Load Tests** (Scheduled/Manual)

**Services**:
- PostgreSQL 15 with performance extensions
- Redis for session management
- Enhanced configurations for load testing

### Local Test Execution

**Test Runner Script**: `scripts/run-database-tests.sh`

```bash
# Run all tests
./scripts/run-database-tests.sh

# Skip performance tests
./scripts/run-database-tests.sh --skip-performance

# Skip setup (if database already running)
./scripts/run-database-tests.sh --skip-setup

# Verbose output
./scripts/run-database-tests.sh --verbose
```

**Available npm Scripts**:
```bash
npm run test              # Run all tests
npm run test:unit         # Unit tests only
npm run test:integration  # Integration tests only
npm run test:performance  # Performance tests only
npm run test:security     # Security tests only
npm run test:migration    # Migration tests only
npm run test:benchmark    # Benchmark tests only
npm run test:load         # Load tests only
npm run test:coverage     # Generate coverage report
```

## Performance Baselines

### Query Performance Targets

| Operation Type | Target Time | Acceptable Range |
|---------------|-------------|------------------|
| Primary key lookup | <10ms | <25ms |
| Indexed queries | <50ms | <100ms |
| Complex joins | <200ms | <400ms |
| Aggregations | <300ms | <500ms |
| Full-text search | <300ms | <600ms |

### Index Efficiency Targets

| Index Type | Efficiency Target | Minimum Acceptable |
|------------|------------------|-------------------|
| Primary keys | >95% | >90% |
| Unique indexes | >90% | >85% |
| Foreign keys | >85% | >80% |
| Composite indexes | >80% | >70% |
| Partial indexes | >75% | >65% |

### Load Testing Targets

| Metric | Target | Maximum |
|--------|---------|---------|
| Concurrent users | 100 | 200 |
| Orders per minute | 1000 | 2000 |
| Database connections | 50 | 100 |
| Response time (95th) | <500ms | <1000ms |
| Error rate | <0.1% | <1% |

## Security Compliance

### PCI DSS Requirements Validated

**Requirement 3: Protect Stored Cardholder Data**
- No prohibited cardholder data storage
- Only tokenized payment references
- Encrypted sensitive data handling

**Requirement 7: Restrict Access by Business Need**
- Role-based access controls (CUSTOMER, ADMIN, SUPPORT)
- User data isolation
- Payment data access restrictions

**Requirement 8: Identify and Authenticate Access**
- Unique user identification
- Password hashing validation
- Two-factor authentication support
- Session management security

**Requirement 10: Log and Monitor All Access**
- Comprehensive audit logging
- Security event tracking
- Compliance reporting capabilities

**Requirement 11: Regular Security Testing**
- Automated vulnerability scanning
- SQL injection prevention testing
- Input sanitization validation
- Security configuration verification

## Troubleshooting

### Common Issues

1. **Test Database Connection Failures**
   ```bash
   # Check if PostgreSQL is running
   docker-compose ps postgres
   
   # Reset test database
   npm run test:db:reset
   ```

2. **Performance Test Timeouts**
   ```bash
   # Increase timeout for specific tests
   npm run test:performance -- --testTimeout=60000
   ```

3. **Memory Issues with Large Data Sets**
   ```bash
   # Run tests with increased memory
   NODE_OPTIONS="--max-old-space-size=4096" npm run test:performance
   ```

4. **Migration Test Failures**
   ```bash
   # Reset migrations and retry
   npx prisma migrate reset --force
   npm run test:migration
   ```

### Performance Debugging

1. **Enable Query Logging**
   ```bash
   export DEBUG=prisma:query
   npm run test:performance
   ```

2. **Generate Performance Reports**
   ```bash
   export WRITE_PERFORMANCE_REPORT=true
   npm run test:performance
   # Check test-performance-report.json
   ```

3. **Monitor Database Statistics**
   ```sql
   -- Check index usage
   SELECT * FROM pg_stat_user_indexes;
   
   -- Check slow queries
   SELECT * FROM pg_stat_statements ORDER BY mean_exec_time DESC;
   ```

## Best Practices

### Test Development

1. **Test Isolation**: Each test should clean up after itself
2. **Realistic Data**: Use appropriate test data volumes
3. **Performance Awareness**: Monitor test execution times
4. **Security Focus**: Always validate security constraints
5. **Error Handling**: Test both success and failure scenarios

### Performance Optimization

1. **Index Strategy**: Analyze query patterns before creating indexes
2. **Query Optimization**: Use EXPLAIN ANALYZE for slow queries
3. **Connection Pooling**: Monitor and optimize connection usage
4. **Statistics Updates**: Keep table statistics current
5. **Regular Maintenance**: Schedule VACUUM and ANALYZE operations

### Security Testing

1. **Data Isolation**: Verify user data separation
2. **Input Validation**: Test with various input types
3. **Authentication**: Validate all auth mechanisms
4. **Audit Trails**: Ensure comprehensive logging
5. **Compliance**: Regular PCI DSS validation

## Monitoring and Alerts

### Production Monitoring

1. **Query Performance**: Monitor slow query logs
2. **Index Efficiency**: Track index usage statistics
3. **Connection Health**: Monitor connection pool status
4. **Error Rates**: Track database error frequencies
5. **Security Events**: Monitor authentication and access logs

### Automated Alerts

1. **Performance Degradation**: >2x baseline response times
2. **High Error Rates**: >1% database errors
3. **Connection Pool Exhaustion**: >90% utilization
4. **Security Anomalies**: Unusual access patterns
5. **Failed Migrations**: Migration rollback scenarios

## Conclusion

This comprehensive database testing and optimization system ensures:

- **Reliability**: Thorough validation of all database operations
- **Performance**: Optimized queries and efficient index usage
- **Security**: PCI DSS compliance and data protection
- **Scalability**: Load testing and performance monitoring
- **Maintainability**: Automated testing and continuous optimization

The system completes Task 2.12 and validates all previous database infrastructure work, providing a solid foundation for the payment integration template.