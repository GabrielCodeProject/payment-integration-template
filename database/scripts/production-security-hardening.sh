#!/bin/bash
# Production Security Hardening Script
# NextJS Stripe Payment Template - PostgreSQL Security Hardening
# PCI DSS Compliance Implementation

set -euo pipefail

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$(dirname "$SCRIPT_DIR")")"
DB_CONFIG_DIR="$PROJECT_ROOT/database"
SSL_DIR="$DB_CONFIG_DIR/ssl"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging function
log() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1"
}

warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

# Function to check if running as root
check_root() {
    if [[ $EUID -eq 0 ]]; then
        error "This script should not be run as root for security reasons"
        exit 1
    fi
}

# Function to validate SSL certificates
validate_ssl_certificates() {
    log "Validating SSL certificates..."
    
    if [[ ! -f "$SSL_DIR/server-cert.pem" ]] || [[ ! -f "$SSL_DIR/server-key.pem" ]]; then
        error "SSL certificates not found. Please run generate-ssl-certs.sh first"
        exit 1
    fi
    
    # Check certificate validity
    if ! openssl x509 -in "$SSL_DIR/server-cert.pem" -noout -text >/dev/null 2>&1; then
        error "Invalid server certificate"
        exit 1
    fi
    
    # Check private key
    if ! openssl rsa -in "$SSL_DIR/server-key.pem" -check -noout >/dev/null 2>&1; then
        error "Invalid server private key"
        exit 1
    fi
    
    # Check certificate expiration
    local expiry_date
    expiry_date=$(openssl x509 -in "$SSL_DIR/server-cert.pem" -noout -enddate | cut -d= -f2)
    local expiry_epoch
    expiry_epoch=$(date -d "$expiry_date" +%s)
    local current_epoch
    current_epoch=$(date +%s)
    local days_until_expiry=$(( (expiry_epoch - current_epoch) / 86400 ))
    
    if [[ $days_until_expiry -lt 30 ]]; then
        warning "SSL certificate expires in $days_until_expiry days. Consider renewal."
    fi
    
    log "SSL certificates validated successfully"
}

# Function to set secure file permissions
set_secure_permissions() {
    log "Setting secure file permissions..."
    
    # SSL certificates and keys
    if [[ -d "$SSL_DIR" ]]; then
        chmod 700 "$SSL_DIR"
        chmod 600 "$SSL_DIR"/*.pem 2>/dev/null || true
        chmod 644 "$SSL_DIR"/ca-cert.pem 2>/dev/null || true
        chmod 644 "$SSL_DIR"/server-cert.pem 2>/dev/null || true
        chmod 644 "$SSL_DIR"/client-cert.pem 2>/dev/null || true
    fi
    
    # Configuration files
    chmod 600 "$DB_CONFIG_DIR/config/userlist.txt" 2>/dev/null || true
    chmod 644 "$DB_CONFIG_DIR/config/pgbouncer.ini" 2>/dev/null || true
    chmod 644 "$DB_CONFIG_DIR/postgresql.conf" 2>/dev/null || true
    chmod 644 "$DB_CONFIG_DIR/postgresql.production.conf" 2>/dev/null || true
    chmod 644 "$DB_CONFIG_DIR/pg_hba.conf" 2>/dev/null || true
    
    # Scripts
    chmod +x "$DB_CONFIG_DIR/scripts"/*.sh 2>/dev/null || true
    chmod 644 "$DB_CONFIG_DIR/scripts"/*.py 2>/dev/null || true
    
    log "File permissions set securely"
}

# Function to validate PostgreSQL configuration
validate_postgresql_config() {
    log "Validating PostgreSQL configuration..."
    
    local config_file="$DB_CONFIG_DIR/postgresql.production.conf"
    
    if [[ ! -f "$config_file" ]]; then
        error "Production PostgreSQL configuration not found: $config_file"
        exit 1
    fi
    
    # Check critical security settings
    local critical_settings=(
        "ssl = on"
        "password_encryption = scram-sha-256"
        "row_security = on"
        "fsync = on"
        "synchronous_commit = on"
        "full_page_writes = on"
    )
    
    for setting in "${critical_settings[@]}"; do
        if ! grep -q "^$setting" "$config_file"; then
            error "Critical security setting missing or incorrect: $setting"
            exit 1
        fi
    done
    
    # Check that development-only settings are not present
    local dev_settings=(
        "fsync = off"
        "synchronous_commit = off"
        "full_page_writes = off"
    )
    
    for setting in "${dev_settings[@]}"; do
        if grep -q "^$setting" "$config_file"; then
            error "Dangerous development setting found in production config: $setting"
            exit 1
        fi
    done
    
    log "PostgreSQL configuration validated successfully"
}

# Function to validate PgBouncer configuration
validate_pgbouncer_config() {
    log "Validating PgBouncer configuration..."
    
    local config_file="$DB_CONFIG_DIR/config/pgbouncer.ini"
    local userlist_file="$DB_CONFIG_DIR/config/userlist.txt"
    
    if [[ ! -f "$config_file" ]]; then
        error "PgBouncer configuration not found: $config_file"
        exit 1
    fi
    
    if [[ ! -f "$userlist_file" ]]; then
        error "PgBouncer userlist not found: $userlist_file"
        exit 1
    fi
    
    # Check critical security settings
    local critical_settings=(
        "auth_type = scram-sha-256"
        "server_tls_sslmode = require"
        "pool_mode = transaction"
    )
    
    for setting in "${critical_settings[@]}"; do
        if ! grep -q "^$setting" "$config_file"; then
            error "Critical PgBouncer setting missing or incorrect: $setting"
            exit 1
        fi
    done
    
    # Validate userlist format
    if ! grep -q "SCRAM-SHA-256" "$userlist_file"; then
        error "PgBouncer userlist does not contain SCRAM-SHA-256 hashes"
        exit 1
    fi
    
    log "PgBouncer configuration validated successfully"
}

# Function to create production environment file
create_production_env() {
    log "Creating production environment template..."
    
    local env_file="$PROJECT_ROOT/.env.production.template"
    
    cat > "$env_file" << 'EOF'
# Production Environment Configuration
# NextJS Stripe Payment Template - PRODUCTION SETTINGS

# ============================================================================
# DATABASE CONFIGURATION - PRODUCTION
# ============================================================================

# Main application database connection (through PgBouncer)
DATABASE_URL="postgresql://app_readwrite:${APP_DB_PASSWORD}@pgbouncer:6432/payment_template_prod?sslmode=require"

# Read-only database connection for analytics
DATABASE_READONLY_URL="postgresql://app_readonly:${APP_READONLY_PASSWORD}@pgbouncer:6432/payment_template_prod?sslmode=require"

# Database passwords (set via secure environment variables)
APP_DB_PASSWORD="${APP_DB_PASSWORD}"
APP_READONLY_PASSWORD="${APP_READONLY_PASSWORD}"
POSTGRES_PASSWORD="${POSTGRES_PASSWORD}"

# ============================================================================
# SSL/TLS CONFIGURATION
# ============================================================================

# PostgreSQL SSL settings
PGSSLMODE="require"
PGSSLCERT="/app/ssl/client-cert.pem"
PGSSLKEY="/app/ssl/client-key.pem"
PGSSLROOTCERT="/app/ssl/ca-cert.pem"

# ============================================================================
# AUTHENTICATION CONFIGURATION
# ============================================================================

# Strong authentication secret (minimum 32 characters)
AUTH_SECRET="${AUTH_SECRET}"

# ============================================================================
# APPLICATION CONFIGURATION
# ============================================================================

# Production URL
NEXT_PUBLIC_APP_URL="https://your-domain.com"
NEXT_PUBLIC_STRIPE_TEST_MODE="false"

# ============================================================================
# STRIPE CONFIGURATION - PRODUCTION
# ============================================================================

# Live Stripe keys (never use test keys in production)
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY="${STRIPE_LIVE_PUBLISHABLE_KEY}"
STRIPE_SECRET_KEY="${STRIPE_LIVE_SECRET_KEY}"
STRIPE_WEBHOOK_SECRET="${STRIPE_LIVE_WEBHOOK_SECRET}"

# ============================================================================
# EMAIL CONFIGURATION - PRODUCTION
# ============================================================================

# Production email service (Resend)
RESEND_API_KEY="${RESEND_API_KEY}"
RESEND_FROM="${RESEND_FROM}"

# SMTP Configuration (if using SMTP instead of Resend)
SMTP_HOST="${SMTP_HOST}"
SMTP_PORT="${SMTP_PORT}"
SMTP_USER="${SMTP_USER}"
SMTP_PASSWORD="${SMTP_PASSWORD}"
SMTP_SECURE="true"

# ============================================================================
# REDIS CONFIGURATION - PRODUCTION
# ============================================================================

# Redis with authentication and TLS
REDIS_URL="rediss://:${REDIS_PASSWORD}@redis:6380"
REDIS_PASSWORD="${REDIS_PASSWORD}"

# ============================================================================
# SECURITY CONFIGURATION
# ============================================================================

# Security settings
MAINTENANCE_MODE="false"
RATE_LIMIT_ENABLED="true"
SECURITY_HEADERS_ENABLED="true"

# Session configuration
SESSION_TIMEOUT="3600"  # 1 hour
SESSION_SECURE="true"
SESSION_SAME_SITE="strict"

# CSRF protection
CSRF_SECRET="${CSRF_SECRET}"

# ============================================================================
# MONITORING AND LOGGING
# ============================================================================

# Logging level for production
LOG_LEVEL="warn"
ENABLE_QUERY_LOGGING="false"
ENABLE_PERFORMANCE_MONITORING="true"

# External monitoring (optional)
SENTRY_DSN="${SENTRY_DSN}"
DATADOG_API_KEY="${DATADOG_API_KEY}"

# ============================================================================
# COMPLIANCE CONFIGURATION
# ============================================================================

# PCI DSS compliance settings
PCI_COMPLIANCE_MODE="true"
ENABLE_AUDIT_LOGGING="true"
DATA_RETENTION_DAYS="2555"  # 7 years for PCI compliance

# ============================================================================
# BACKUP CONFIGURATION
# ============================================================================

# Backup settings
BACKUP_ENCRYPTION_KEY="${BACKUP_ENCRYPTION_KEY}"
BACKUP_RETENTION_DAYS="90"
BACKUP_STORAGE_LOCATION="s3://your-backup-bucket"

# ============================================================================
# SECURITY NOTES
# ============================================================================

# 1. All sensitive values (${VAR}) must be set via secure environment variables
# 2. Never commit actual secrets to version control
# 3. Use a secrets management system (e.g., AWS Secrets Manager, HashiCorp Vault)
# 4. Rotate all secrets regularly (recommended: every 90 days)
# 5. Monitor access to environment variables
# 6. Use least privilege access for all services
# 7. Enable audit logging for all secret access
# 8. Test configuration in staging environment first
EOF

    log "Production environment template created: $env_file"
    warning "Configure actual secrets via secure environment variables or secrets management system"
}

# Function to create security checklist
create_security_checklist() {
    log "Creating production security checklist..."
    
    local checklist_file="$PROJECT_ROOT/PRODUCTION-SECURITY-CHECKLIST.md"
    
    cat > "$checklist_file" << 'EOF'
# Production Security Checklist
NextJS Stripe Payment Template - PCI DSS Compliance

## Pre-Deployment Security Checklist

### 1. Database Security
- [ ] SSL/TLS encryption enabled for all database connections
- [ ] Strong passwords set for all database users
- [ ] Least privilege access controls implemented
- [ ] Row-level security policies configured
- [ ] Database audit logging enabled
- [ ] Connection pooling with PgBouncer configured
- [ ] Failed authentication monitoring enabled
- [ ] Database firewall rules configured

### 2. Authentication & Authorization
- [ ] Strong authentication secrets configured (minimum 32 characters)
- [ ] SCRAM-SHA-256 password hashing enabled
- [ ] Session timeout configured (recommended: 1 hour)
- [ ] Two-factor authentication implemented for admin users
- [ ] Password complexity requirements enforced
- [ ] Account lockout policies configured
- [ ] Regular password rotation schedule established

### 3. Network Security
- [ ] All external connections use HTTPS/TLS 1.2+
- [ ] Database connections use SSL/TLS encryption
- [ ] Internal network segmentation implemented
- [ ] Firewall rules restrict access to necessary ports only
- [ ] DDoS protection enabled
- [ ] Rate limiting configured for API endpoints
- [ ] CORS policies properly configured

### 4. Data Protection
- [ ] Payment card data encryption implemented
- [ ] Sensitive data masking in logs
- [ ] Data retention policies configured
- [ ] Secure data disposal procedures
- [ ] Encryption at rest for all sensitive data
- [ ] Encryption in transit for all data
- [ ] Key management system implemented

### 5. Monitoring & Logging
- [ ] Security event monitoring enabled
- [ ] Failed login attempt detection
- [ ] Suspicious activity alerting
- [ ] Audit logging for all sensitive operations
- [ ] Log integrity protection
- [ ] Real-time security monitoring
- [ ] Incident response procedures documented

### 6. Backup & Recovery
- [ ] Encrypted backup system configured
- [ ] Backup integrity verification
- [ ] Disaster recovery plan tested
- [ ] Point-in-time recovery capability
- [ ] Backup retention policies compliant with regulations
- [ ] Secure backup storage location
- [ ] Recovery time objective (RTO) defined and tested

### 7. Compliance Requirements
- [ ] PCI DSS compliance assessment completed
- [ ] Data privacy regulations compliance (GDPR, CCPA)
- [ ] Security policies documented
- [ ] Staff security training completed
- [ ] Third-party security assessments
- [ ] Vulnerability scanning implemented
- [ ] Penetration testing completed

### 8. Application Security
- [ ] Input validation implemented for all user inputs
- [ ] Output encoding for all dynamic content
- [ ] SQL injection protection verified
- [ ] XSS protection implemented
- [ ] CSRF protection enabled
- [ ] Security headers configured
- [ ] Dependency vulnerability scanning

### 9. Infrastructure Security
- [ ] Operating system hardening completed
- [ ] Regular security updates applied
- [ ] Intrusion detection system deployed
- [ ] Anti-malware protection enabled
- [ ] File integrity monitoring
- [ ] Privileged access management
- [ ] Secure configuration management

### 10. Operational Security
- [ ] Incident response plan documented and tested
- [ ] Security awareness training for staff
- [ ] Regular security assessments scheduled
- [ ] Change management procedures
- [ ] Access review processes
- [ ] Emergency contact procedures
- [ ] Business continuity planning

## Post-Deployment Monitoring

### Daily Checks
- [ ] Review security alerts and events
- [ ] Monitor failed authentication attempts
- [ ] Check system performance metrics
- [ ] Verify backup completion

### Weekly Checks
- [ ] Review access logs for anomalies
- [ ] Analyze security metrics and trends
- [ ] Update threat intelligence feeds
- [ ] Test critical security controls

### Monthly Checks
- [ ] Review and update security policies
- [ ] Conduct access reviews
- [ ] Analyze compliance reports
- [ ] Update risk assessments

### Quarterly Checks
- [ ] Penetration testing
- [ ] Vulnerability assessments
- [ ] Security training updates
- [ ] Disaster recovery testing

## Emergency Contacts

- Security Team: [CONTACT_INFO]
- Database Administrator: [CONTACT_INFO]
- Infrastructure Team: [CONTACT_INFO]
- Compliance Officer: [CONTACT_INFO]
- Legal Team: [CONTACT_INFO]

## Compliance References

- PCI DSS Requirements: https://www.pcisecuritystandards.org/
- NIST Cybersecurity Framework: https://www.nist.gov/cyberframework
- OWASP Top 10: https://owasp.org/www-project-top-ten/
- GDPR Guidelines: https://gdpr.eu/

---

**IMPORTANT**: This checklist must be completed and verified before production deployment.
All checkboxes must be marked and evidence documented for compliance purposes.
EOF

    log "Production security checklist created: $checklist_file"
}

# Function to create monitoring scripts
create_monitoring_scripts() {
    log "Creating production monitoring scripts..."
    
    # Security monitoring script
    local monitor_script="$DB_CONFIG_DIR/scripts/security-monitor.sh"
    
    cat > "$monitor_script" << 'EOF'
#!/bin/bash
# Security Monitoring Script
# Real-time security event monitoring for production

# Database connection
PGUSER="${MONITOR_USER:-app_monitor}"
PGPASSWORD="${MONITOR_PASSWORD}"
PGHOST="${DB_HOST:-localhost}"
PGPORT="${DB_PORT:-6432}"
PGDATABASE="${DB_NAME:-payment_template_prod}"

# Alert thresholds
FAILED_AUTH_THRESHOLD=5
SUSPICIOUS_ACTIVITY_THRESHOLD=3
CONNECTION_THRESHOLD=150

# Check for high-priority security events
check_security_events() {
    local events
    events=$(psql -t -c "
        SELECT COUNT(*) 
        FROM security_monitoring.security_events 
        WHERE severity IN ('HIGH', 'CRITICAL') 
          AND resolved = FALSE 
          AND event_time > NOW() - INTERVAL '1 hour'
    " 2>/dev/null)
    
    if [[ ${events:-0} -gt 0 ]]; then
        echo "ALERT: $events unresolved high/critical security events in the last hour"
        return 1
    fi
    return 0
}

# Check for failed authentication attempts
check_failed_auth() {
    local attempts
    attempts=$(psql -t -c "
        SELECT COUNT(*) 
        FROM security_monitoring.failed_auth_attempts 
        WHERE attempt_time > NOW() - INTERVAL '5 minutes'
    " 2>/dev/null)
    
    if [[ ${attempts:-0} -gt $FAILED_AUTH_THRESHOLD ]]; then
        echo "ALERT: $attempts failed authentication attempts in the last 5 minutes"
        return 1
    fi
    return 0
}

# Check for suspicious activity
check_suspicious_activity() {
    local activities
    activities=$(psql -t -c "
        SELECT COUNT(*) 
        FROM security_monitoring.suspicious_activity 
        WHERE detected_at > NOW() - INTERVAL '10 minutes'
          AND risk_score >= 50
          AND investigated = FALSE
    " 2>/dev/null)
    
    if [[ ${activities:-0} -gt $SUSPICIOUS_ACTIVITY_THRESHOLD ]]; then
        echo "ALERT: $activities suspicious activities detected in the last 10 minutes"
        return 1
    fi
    return 0
}

# Main monitoring function
main() {
    local alerts=0
    
    if ! check_security_events; then
        ((alerts++))
    fi
    
    if ! check_failed_auth; then
        ((alerts++))
    fi
    
    if ! check_suspicious_activity; then
        ((alerts++))
    fi
    
    if [[ $alerts -eq 0 ]]; then
        echo "OK: No security alerts detected"
        exit 0
    else
        echo "WARNING: $alerts security alerts detected"
        exit 1
    fi
}

main "$@"
EOF

    chmod +x "$monitor_script"
    log "Security monitoring script created: $monitor_script"
}

# Main execution function
main() {
    log "Starting production security hardening process..."
    
    # Pre-flight checks
    check_root
    
    # Validation steps
    validate_ssl_certificates
    validate_postgresql_config
    validate_pgbouncer_config
    
    # Security hardening steps
    set_secure_permissions
    create_production_env
    create_security_checklist
    create_monitoring_scripts
    
    log "Production security hardening completed successfully!"
    echo ""
    warning "IMPORTANT: Complete the following manual steps:"
    echo "1. Review and configure .env.production.template with actual secrets"
    echo "2. Complete the production security checklist"
    echo "3. Set up external monitoring and alerting"
    echo "4. Conduct security testing before deployment"
    echo "5. Train operations team on security procedures"
    echo ""
    info "For PCI DSS compliance, ensure all checklist items are completed and documented"
}

# Execute main function
main "$@"