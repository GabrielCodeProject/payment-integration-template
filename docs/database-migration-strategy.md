# Database Migration Strategy and Procedures

## Overview

This document outlines the database migration strategy for the Stripe Payment Integration Template,
including procedures for migration execution, rollback, and validation.

## Current Migration Status

### Existing Migrations

1. **20250812201613_initial_schema** - Core database schema with all models and basic indexes
2. **20250812215402_add_performance_indexes** - 25+ performance optimization indexes
3. **20250814193823_add_audit_log_table** - Comprehensive audit logging infrastructure

### Migration Summary

- **Total Tables**: 12 (including audit_logs)
- **Total Indexes**: 72 (excluding primary keys)
- **Foreign Key Constraints**: 12
- **Enum Types**: 9
- **Audit Triggers**: 10 (all core tables)

## Database Schema Validation

### Core Models

✅ **User Management**

- User model with authentication, roles, and Stripe integration
- Account and Session models for NextAuth.js compatibility
- Role-based authorization (CUSTOMER, ADMIN, SUPPORT)

✅ **Product Catalog**

- Product model with flexible pricing and inventory management
- Support for one-time, subscription, and usage-based products
- SEO optimization with slugs, meta tags, and descriptions
- Stripe product/price integration

✅ **Order Management**

- Order model with comprehensive status tracking
- OrderItem model for detailed line items
- Support for guest checkout and registered users
- Stripe payment integration with PaymentIntent tracking

✅ **Subscription Management**

- Subscription model with full lifecycle support
- Billing interval flexibility (DAY, WEEK, MONTH, YEAR)
- Trial period support
- Stripe subscription integration

✅ **Payment Processing**

- PaymentMethod model with multiple payment types
- Secure payment information storage
- Default payment method management
- Stripe PaymentMethod integration

✅ **Discount System**

- DiscountCode model with flexible discount types
- Usage tracking per customer
- Expiration and minimum order support
- Integration with order processing

✅ **Audit Logging**

- Comprehensive audit trail for all core tables
- Automatic triggers for INSERT, UPDATE, DELETE operations
- User attribution and metadata tracking
- Timestamp and session tracking

### Performance Optimization

#### Index Strategy

- **Single Column Indexes**: 28 indexes on frequently queried columns
- **Composite Indexes**: 20+ indexes for complex query optimization
- **Unique Indexes**: 14 indexes ensuring data integrity

#### Critical Performance Indexes

```sql
-- User lookups
users_email_idx, users_stripeCustomerId_idx, users_role_idx

-- Product catalog queries
products_isActive_type_idx, products_type_isActive_createdAt_idx

-- Order processing
orders_userId_status_idx, orders_status_paymentStatus_idx

-- Subscription management
subscriptions_userId_status_idx, subscriptions_status_currentPeriodEnd_idx

-- Audit trail queries
audit_logs_tableName_recordId_timestamp_idx, audit_logs_userId_action_timestamp_idx
```

## Migration Procedures

### 1. Development Environment Migration

```bash
# Check current migration status
npx prisma migrate status

# Generate new migration (if schema changes)
npx prisma migrate dev --name "descriptive_migration_name"

# Validate migration
npx prisma generate
npx prisma db pull --print  # Compare with actual schema
```

### 2. Production Migration

```bash
# Deploy migrations to production
npx prisma migrate deploy

# Validate deployment
npx prisma migrate status
```

### 3. Rollback Procedures

#### Automatic Rollback (Limited)

Prisma doesn't support automatic rollbacks. Manual rollback procedures:

1. **Backup Strategy**

```bash
# Create backup before migration
docker exec payment-template-postgres pg_dump -U postgres payment_template_dev > backup_$(date +%Y%m%d_%H%M%S).sql
```

2. **Manual Rollback Steps**

```sql
-- Drop new objects in reverse order
-- 1. Drop foreign keys
-- 2. Drop indexes
-- 3. Drop tables
-- 4. Drop enums
-- 5. Restore from backup if needed
```

3. **Schema Reset (Development Only)**

```bash
npx prisma migrate reset  # DANGER: Destroys all data
```

### 4. Migration Validation

#### Pre-Migration Checks

```bash
# Validate schema syntax
npx prisma validate

# Check for schema drift
npx prisma db pull --print

# Generate migration preview
npx prisma migrate diff --from-database-url $DATABASE_URL --to-schema-datamodel prisma/schema.prisma --script
```

#### Post-Migration Validation

```bash
# Verify migration status
npx prisma migrate status

# Generate client to ensure compatibility
npx prisma generate

# Run basic connectivity test
npx prisma db execute --stdin <<< "SELECT COUNT(*) FROM users;"
```

## Environment-Specific Considerations

### Development Environment

- Use `npx prisma migrate dev` for iterative development
- Schema reset is acceptable for development
- Migration files are version-controlled

### Staging Environment

- Use `npx prisma migrate deploy`
- Full backup before migration
- Validation testing after migration

### Production Environment

- Always create backup before migration
- Use `npx prisma migrate deploy` only
- Monitor migration performance
- Have rollback plan ready

## Migration Best Practices

### 1. Migration Naming Convention

```
YYYYMMDDHHMMSS_descriptive_name
Example: 20250814193823_add_audit_log_table
```

### 2. Migration Safety

- Always backup production before migration
- Test migrations in staging environment first
- Monitor migration execution time
- Plan for rollback scenarios

### 3. Schema Changes

- Avoid destructive changes in production
- Use backward-compatible changes when possible
- Coordinate with application deployment

### 4. Performance Considerations

- Create indexes during low-traffic periods
- Monitor lock duration for large tables
- Consider maintenance windows for major changes

## Troubleshooting

### Common Issues

1. **Migration Lock File Conflicts**

```bash
# Resolution: Ensure only one migration process runs
rm prisma/migrations/migration_lock.toml
npx prisma migrate resolve --rolled-back <migration_name>
```

2. **Schema Drift**

```bash
# Reset shadow database
npx prisma migrate reset
npx prisma migrate deploy
```

3. **Foreign Key Constraint Violations**

```sql
-- Disable constraints temporarily (use with caution)
SET session_replication_role = replica;
-- Perform data fixes
SET session_replication_role = DEFAULT;
```

## Migration History

| Date       | Migration               | Description                  | Status      |
| ---------- | ----------------------- | ---------------------------- | ----------- |
| 2025-08-12 | initial_schema          | Core database schema         | ✅ Complete |
| 2025-08-12 | add_performance_indexes | Performance optimization     | ✅ Complete |
| 2025-08-14 | add_audit_log_table     | Audit logging infrastructure | ✅ Complete |

## Monitoring and Maintenance

### Migration Metrics to Monitor

- Migration execution time
- Database size after migration
- Query performance impact
- Application compatibility

### Regular Maintenance

- Review migration history monthly
- Clean up development migration files
- Update documentation with schema changes
- Performance analysis of new indexes

## Emergency Procedures

### Critical Failure Response

1. Stop application traffic
2. Assess damage scope
3. Restore from backup if necessary
4. Validate data integrity
5. Resume application traffic
6. Conduct post-incident review

### Contact Information

- Database Administrator: [Configure as needed]
- DevOps Team: [Configure as needed]
- Development Team Lead: [Configure as needed]

---

**Last Updated**: 2025-08-14 **Next Review**: 2025-09-14
