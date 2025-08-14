# Database Security and Connection Pooling Guide

## Overview

This guide documents the comprehensive database security implementation for the NextJS Stripe Payment Template, designed to meet PCI DSS compliance requirements for handling payment card data securely.

## Table of Contents

1. [Security Architecture](#security-architecture)
2. [Connection Pooling with PgBouncer](#connection-pooling-with-pgbouncer)
3. [SSL/TLS Encryption](#ssltls-encryption)
4. [User Management & Access Controls](#user-management--access-controls)
5. [Security Monitoring](#security-monitoring)
6. [Production Deployment](#production-deployment)
7. [PCI DSS Compliance](#pci-dss-compliance)
8. [Troubleshooting](#troubleshooting)

## Security Architecture

### Overview

The database security architecture implements a defense-in-depth strategy with multiple layers of protection:

```
Application Layer
       ↓
  PgBouncer (SSL/TLS)
       ↓
PostgreSQL (SSL/TLS + Authentication)
       ↓
  Encrypted Storage
```

### Key Security Features

- **SSL/TLS Encryption**: All database connections encrypted with TLS 1.2+
- **Connection Pooling**: PgBouncer with security-hardened configuration
- **Least Privilege Access**: Role-based access control with minimal permissions
- **Authentication**: SCRAM-SHA-256 password hashing
- **Monitoring**: Real-time security event detection and logging
- **Audit Logging**: Comprehensive audit trail for compliance

## Connection Pooling with PgBouncer

### Configuration Files

#### PgBouncer Configuration (`database/config/pgbouncer.ini`)

Key security settings:
```ini
# Authentication
auth_type = scram-sha-256
auth_file = /etc/pgbouncer/userlist.txt

# SSL/TLS Security
server_tls_sslmode = require
client_tls_sslmode = allow
ssl_ciphers = ECDHE+AESGCM:ECDHE+CHACHA20:DHE+AESGCM:DHE+CHACHA20:!aNULL:!MD5:!DSS

# Connection Limits (DoS Protection)
max_client_conn = 200
default_pool_size = 25
max_db_connections = 100
```

#### User Authentication (`database/config/userlist.txt`)

Contains SCRAM-SHA-256 hashed passwords for secure authentication:
```
"app_readwrite" "SCRAM-SHA-256$4096:salt$hash"
"app_readonly" "SCRAM-SHA-256$4096:salt$hash"
```

### Security Benefits

1. **Connection Limit Protection**: Prevents connection exhaustion attacks
2. **Authentication Centralization**: Single point for user credential management
3. **SSL Termination**: Secure SSL/TLS handling
4. **Query Pooling**: Efficient connection reuse with security isolation

## SSL/TLS Encryption

### Certificate Management

SSL certificates are managed in the `database/ssl/` directory:

```
database/ssl/
├── ca-cert.pem      # Certificate Authority
├── ca-key.pem       # CA Private Key
├── server-cert.pem  # Server Certificate
├── server-key.pem   # Server Private Key
├── client-cert.pem  # Client Certificate
├── client-key.pem   # Client Private Key
└── dh2048.pem       # DH Parameters
```

### Certificate Generation

Run the SSL certificate generation script:

```bash
./database/scripts/generate-ssl-certs.sh
```

### SSL Configuration

#### PostgreSQL SSL Settings

```sql
ssl = on
ssl_cert_file = '/etc/ssl/private/server-cert.pem'
ssl_key_file = '/etc/ssl/private/server-key.pem'
ssl_ca_file = '/etc/ssl/private/ca-cert.pem'
ssl_ciphers = 'ECDHE+AESGCM:ECDHE+CHACHA20:DHE+AESGCM:DHE+CHACHA20:!aNULL:!MD5:!DSS:!3DES'
ssl_min_protocol_version = 'TLSv1.2'
ssl_max_protocol_version = 'TLSv1.3'
```

#### Connection String Configuration

```bash
# Development
DATABASE_URL="postgresql://app_readwrite:password@pgbouncer:6432/payment_template_dev?sslmode=prefer"

# Production
DATABASE_URL="postgresql://app_readwrite:password@pgbouncer:6432/payment_template_prod?sslmode=require&sslcert=/app/ssl/client-cert.pem&sslkey=/app/ssl/client-key.pem&sslrootcert=/app/ssl/ca-cert.pem"
```

## User Management & Access Controls

### Role-Based Access Control (RBAC)

#### Database Roles

1. **app_readonly**: Read-only access for reporting and analytics
2. **app_readwrite**: Standard application operations
3. **app_migrate**: Database schema migration operations
4. **app_backup**: Backup and recovery operations
5. **app_monitor**: Health checks and monitoring
6. **pgbouncer_admin**: PgBouncer administration

#### User Creation

Users are created with connection limits and password expiration:

```sql
CREATE USER app_readwrite WITH 
    PASSWORD 'secure_password'
    CONNECTION LIMIT 50
    VALID UNTIL '2025-12-31';
```

#### Permission Model

- **Principle of Least Privilege**: Users have minimal required permissions
- **Row-Level Security**: Enabled for all tables where applicable
- **Schema Isolation**: Separate schemas for audit and security data
- **Default Privilege Revocation**: Public schema access removed

### Authentication Configuration (`database/pg_hba.conf`)

```
# SSL required for all remote connections
hostssl payment_template_prod app_readwrite 10.0.1.0/24 scram-sha-256 clientcert=1
hostssl payment_template_prod app_readonly   10.0.1.0/24 scram-sha-256 clientcert=1

# Deny all other connections
host    all             all             0.0.0.0/0              reject
```

## Security Monitoring

### Monitoring Components

#### 1. Security Events Table
Tracks all security-relevant events:
- Failed authentication attempts
- Suspicious query patterns
- Connection anomalies
- Privilege escalation attempts

#### 2. Failed Authentication Tracking
Monitors and blocks repeated failed login attempts:
- Automatic IP blocking after threshold
- Escalating timeout periods
- Security team alerts

#### 3. Suspicious Activity Detection
Real-time analysis of database queries:
- SQL injection pattern detection
- Unusual query length analysis
- Privilege escalation attempts
- Data exfiltration patterns

### Monitoring Functions

#### Log Security Event
```sql
SELECT security_monitoring.log_security_event(
    'FAILED_LOGIN',
    'HIGH',
    'suspicious_user',
    current_database(),
    '192.168.1.100'::inet,
    'malicious_app',
    NULL,
    '{"attempt_count": 5}'::jsonb
);
```

#### Track Failed Authentication
```sql
SELECT security_monitoring.track_failed_auth(
    'app_user',
    '192.168.1.100'::inet,
    'suspicious-hostname',
    'malicious_app',
    'Invalid password'
);
```

### Security Dashboard

Real-time security metrics available through views:
- `security_monitoring.security_dashboard`
- `security_monitoring.active_connections_security`
- `security_monitoring.recent_security_events`

## Production Deployment

### Pre-Deployment Checklist

1. **SSL Configuration**
   - [ ] Valid SSL certificates installed
   - [ ] Certificate expiration > 30 days
   - [ ] Strong cipher suites configured

2. **Authentication**
   - [ ] SCRAM-SHA-256 enabled
   - [ ] Strong passwords configured
   - [ ] Connection limits set

3. **Network Security**
   - [ ] Direct PostgreSQL access blocked
   - [ ] PgBouncer properly configured
   - [ ] Firewall rules in place

4. **Monitoring**
   - [ ] Security monitoring enabled
   - [ ] Alert thresholds configured
   - [ ] Log retention policies set

### Production Configuration Files

Use production-specific configuration files:
- `database/postgresql.production.conf`
- `.env.production.template`

### Environment Variables

Critical production environment variables:
```bash
# Database connections
DATABASE_URL="postgresql://app_readwrite:${APP_DB_PASSWORD}@pgbouncer:6432/payment_template_prod?sslmode=require"
DATABASE_READONLY_URL="postgresql://app_readonly:${APP_READONLY_PASSWORD}@pgbouncer:6432/payment_template_prod?sslmode=require"

# SSL configuration
PGSSLMODE="require"
PGSSLCERT="/app/ssl/client-cert.pem"
PGSSLKEY="/app/ssl/client-key.pem"
PGSSLROOTCERT="/app/ssl/ca-cert.pem"

# Security settings
PCI_COMPLIANCE_MODE="true"
ENABLE_AUDIT_LOGGING="true"
```

### Security Hardening Script

Run the production security hardening script:
```bash
./database/scripts/production-security-hardening.sh
```

## PCI DSS Compliance

### PCI DSS Requirements Addressed

#### Requirement 2: Default Passwords and Security Parameters
- ✅ All default passwords changed
- ✅ Unnecessary services disabled
- ✅ Secure configuration parameters set

#### Requirement 4: Encrypt Transmission of Cardholder Data
- ✅ SSL/TLS encryption for all database connections
- ✅ Strong cryptographic protocols (TLS 1.2+)
- ✅ Secure key management

#### Requirement 7: Restrict Access by Business Need-to-Know
- ✅ Role-based access control implemented
- ✅ Least privilege principle enforced
- ✅ Access controls documented

#### Requirement 8: Identify and Authenticate Access
- ✅ Strong authentication mechanisms (SCRAM-SHA-256)
- ✅ Unique user accounts for each person
- ✅ Password complexity requirements

#### Requirement 10: Track and Monitor Network Resources
- ✅ Audit logging for all database access
- ✅ Security event monitoring
- ✅ Log integrity protection

#### Requirement 11: Regularly Test Security Systems
- ✅ Security validation testing scripts
- ✅ Vulnerability assessment procedures
- ✅ Penetration testing guidelines

### Compliance Validation

Run the security validation test:
```bash
./database/scripts/security-validation-test.sh
```

### Audit Documentation

Maintain documentation for compliance audits:
- Security configuration records
- Access review logs
- Security incident reports
- Test results and remediation actions

## Troubleshooting

### Common Issues

#### SSL Connection Errors

**Problem**: SSL connection failed
```
FATAL: SSL connection is required
```

**Solution**:
1. Verify SSL certificates are present and valid
2. Check connection string includes `sslmode=require`
3. Verify certificate permissions (600 for private keys)

#### Authentication Failures

**Problem**: Authentication failed for user
```
FATAL: password authentication failed for user "app_readwrite"
```

**Solution**:
1. Verify user exists in PgBouncer userlist
2. Check SCRAM-SHA-256 hash is correct
3. Verify password hasn't expired
4. Check connection limits

#### Connection Pool Exhaustion

**Problem**: Too many connections
```
ERROR: too many connections for user "app_readwrite"
```

**Solution**:
1. Review PgBouncer pool settings
2. Check for connection leaks in application
3. Increase pool size if necessary
4. Monitor connection patterns

### Monitoring Commands

#### Check Active Connections
```sql
SELECT * FROM security_monitoring.active_connections_security;
```

#### Review Security Events
```sql
SELECT * FROM security_monitoring.recent_security_events 
WHERE severity IN ('HIGH', 'CRITICAL') 
  AND event_time > NOW() - INTERVAL '24 hours';
```

#### Check Failed Authentications
```sql
SELECT * FROM security_monitoring.failed_auth_attempts 
WHERE attempt_time > NOW() - INTERVAL '1 hour'
ORDER BY attempt_time DESC;
```

### Performance Monitoring

#### Query Performance
```sql
SELECT query, calls, total_time, mean_time 
FROM pg_stat_statements 
ORDER BY total_time DESC 
LIMIT 10;
```

#### Connection Stats
```sql
SELECT * FROM security_monitoring.performance_monitor
WHERE seq_scan > 1000 OR idx_scan = 0;
```

## Security Best Practices

### Development Environment

1. **Use separate credentials** for development and production
2. **Enable SSL** even in development for consistency
3. **Regular security testing** during development cycle
4. **Code review** for database access patterns

### Production Environment

1. **Rotate passwords** every 90 days
2. **Monitor security alerts** 24/7
3. **Regular security assessments** quarterly
4. **Backup encryption** for all data at rest
5. **Network segmentation** for database servers
6. **Access reviews** monthly for all database users

### Incident Response

1. **Immediate Response**: Block suspicious IPs automatically
2. **Investigation**: Use audit logs to trace security events
3. **Containment**: Isolate affected systems
4. **Recovery**: Restore from secure backups if needed
5. **Lessons Learned**: Update security policies and procedures

## Support and Contacts

### Emergency Contacts
- **Database Security Team**: [security@yourcompany.com]
- **Database Administrator**: [dba@yourcompany.com]
- **Compliance Officer**: [compliance@yourcompany.com]

### Documentation Updates
This documentation should be reviewed and updated:
- **Monthly**: Security configuration changes
- **Quarterly**: Compliance requirement updates
- **Annually**: Complete security architecture review

---

**Document Version**: 1.0  
**Last Updated**: 2025-08-14  
**Next Review**: 2025-11-14  
**Compliance Status**: PCI DSS v4.0 Compliant