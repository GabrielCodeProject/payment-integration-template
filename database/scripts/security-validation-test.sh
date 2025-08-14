#!/bin/bash
# Security Validation Test Script
# NextJS Stripe Payment Template - Database Security Testing
# Validates PCI DSS compliance and security configurations

set -euo pipefail

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$(dirname "$SCRIPT_DIR")")"
DB_CONFIG_DIR="$PROJECT_ROOT/database"

# Test configuration
DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-6432}"
PGBOUNCER_PORT="${PGBOUNCER_PORT:-6432}"
POSTGRES_PORT="${POSTGRES_PORT:-5433}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Test counters
TESTS_PASSED=0
TESTS_FAILED=0
TESTS_TOTAL=0

# Logging functions
log() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1"
}

success() {
    echo -e "${GREEN}✓ PASS:${NC} $1"
    ((TESTS_PASSED++))
    ((TESTS_TOTAL++))
}

fail() {
    echo -e "${RED}✗ FAIL:${NC} $1"
    ((TESTS_FAILED++))
    ((TESTS_TOTAL++))
}

warning() {
    echo -e "${YELLOW}⚠ WARN:${NC} $1"
}

info() {
    echo -e "${BLUE}ℹ INFO:${NC} $1"
}

# Test functions
test_ssl_certificates() {
    log "Testing SSL certificates..."
    
    local ssl_dir="$DB_CONFIG_DIR/ssl"
    
    # Check if SSL certificates exist
    if [[ -f "$ssl_dir/server-cert.pem" ]] && [[ -f "$ssl_dir/server-key.pem" ]]; then
        success "SSL certificates exist"
    else
        fail "SSL certificates missing"
        return 1
    fi
    
    # Validate certificate
    if openssl x509 -in "$ssl_dir/server-cert.pem" -noout -text >/dev/null 2>&1; then
        success "Server certificate is valid"
    else
        fail "Server certificate is invalid"
    fi
    
    # Check certificate expiration
    local expiry_date
    expiry_date=$(openssl x509 -in "$ssl_dir/server-cert.pem" -noout -enddate | cut -d= -f2)
    local expiry_epoch
    expiry_epoch=$(date -d "$expiry_date" +%s)
    local current_epoch
    current_epoch=$(date +%s)
    local days_until_expiry=$(( (expiry_epoch - current_epoch) / 86400 ))
    
    if [[ $days_until_expiry -gt 30 ]]; then
        success "Certificate expires in $days_until_expiry days (> 30 days)"
    else
        warning "Certificate expires in $days_until_expiry days (< 30 days)"
    fi
    
    # Check private key
    if openssl rsa -in "$ssl_dir/server-key.pem" -check -noout >/dev/null 2>&1; then
        success "Server private key is valid"
    else
        fail "Server private key is invalid"
    fi
    
    # Check file permissions
    local cert_perms
    cert_perms=$(stat -c %a "$ssl_dir/server-key.pem" 2>/dev/null || echo "000")
    if [[ "$cert_perms" == "600" ]]; then
        success "Private key has secure permissions (600)"
    else
        fail "Private key has insecure permissions ($cert_perms), should be 600"
    fi
}

test_pgbouncer_config() {
    log "Testing PgBouncer configuration..."
    
    local config_file="$DB_CONFIG_DIR/config/pgbouncer.ini"
    local userlist_file="$DB_CONFIG_DIR/config/userlist.txt"
    
    # Check configuration file exists
    if [[ -f "$config_file" ]]; then
        success "PgBouncer configuration file exists"
    else
        fail "PgBouncer configuration file missing"
        return 1
    fi
    
    # Check userlist file exists
    if [[ -f "$userlist_file" ]]; then
        success "PgBouncer userlist file exists"
    else
        fail "PgBouncer userlist file missing"
        return 1
    fi
    
    # Check secure authentication method
    if grep -q "auth_type = scram-sha-256" "$config_file"; then
        success "Secure authentication method (SCRAM-SHA-256) configured"
    else
        fail "Insecure authentication method configured"
    fi
    
    # Check SSL mode
    if grep -q "server_tls_sslmode = require" "$config_file"; then
        success "SSL required for server connections"
    else
        fail "SSL not required for server connections"
    fi
    
    # Check userlist permissions
    local userlist_perms
    userlist_perms=$(stat -c %a "$userlist_file" 2>/dev/null || echo "000")
    if [[ "$userlist_perms" == "600" ]]; then
        success "Userlist has secure permissions (600)"
    else
        fail "Userlist has insecure permissions ($userlist_perms), should be 600"
    fi
    
    # Check for SCRAM-SHA-256 hashes in userlist
    if grep -q "SCRAM-SHA-256" "$userlist_file"; then
        success "Userlist contains SCRAM-SHA-256 password hashes"
    else
        fail "Userlist does not contain SCRAM-SHA-256 password hashes"
    fi
}

test_postgresql_config() {
    log "Testing PostgreSQL configuration..."
    
    local config_file="$DB_CONFIG_DIR/postgresql.conf"
    local prod_config_file="$DB_CONFIG_DIR/postgresql.production.conf"
    
    # Check development configuration
    if [[ -f "$config_file" ]]; then
        success "PostgreSQL development configuration exists"
        
        # Check SSL enabled
        if grep -q "ssl = on" "$config_file"; then
            success "SSL enabled in development configuration"
        else
            fail "SSL not enabled in development configuration"
        fi
        
        # Check password encryption
        if grep -q "password_encryption = scram-sha-256" "$config_file"; then
            success "Secure password encryption configured"
        else
            fail "Insecure password encryption configured"
        fi
    else
        fail "PostgreSQL development configuration missing"
    fi
    
    # Check production configuration
    if [[ -f "$prod_config_file" ]]; then
        success "PostgreSQL production configuration exists"
        
        # Check production safety settings
        if grep -q "fsync = on" "$prod_config_file"; then
            success "Production safety: fsync enabled"
        else
            fail "Production safety: fsync disabled (data loss risk)"
        fi
        
        if grep -q "synchronous_commit = on" "$prod_config_file"; then
            success "Production safety: synchronous_commit enabled"
        else
            fail "Production safety: synchronous_commit disabled (data loss risk)"
        fi
        
        if grep -q "full_page_writes = on" "$prod_config_file"; then
            success "Production safety: full_page_writes enabled"
        else
            fail "Production safety: full_page_writes disabled (corruption risk)"
        fi
    else
        fail "PostgreSQL production configuration missing"
    fi
}

test_database_connectivity() {
    log "Testing database connectivity..."
    
    # Test PgBouncer connectivity
    if timeout 5 bash -c "</dev/tcp/$DB_HOST/$PGBOUNCER_PORT" 2>/dev/null; then
        success "PgBouncer port ($PGBOUNCER_PORT) is accessible"
    else
        fail "PgBouncer port ($PGBOUNCER_PORT) is not accessible"
    fi
    
    # Check if PostgreSQL direct port is NOT exposed
    if timeout 5 bash -c "</dev/tcp/$DB_HOST/$POSTGRES_PORT" 2>/dev/null; then
        warning "PostgreSQL direct port ($POSTGRES_PORT) is accessible (should be blocked in production)"
    else
        success "PostgreSQL direct port ($POSTGRES_PORT) is properly blocked"
    fi
}

test_docker_compose_security() {
    log "Testing Docker Compose security configuration..."
    
    local compose_file="$PROJECT_ROOT/docker-compose.yml"
    
    if [[ ! -f "$compose_file" ]]; then
        fail "Docker Compose file not found"
        return 1
    fi
    
    # Check if PostgreSQL uses PgBouncer
    if grep -q "pgbouncer:6432" "$compose_file"; then
        success "Application configured to use PgBouncer"
    else
        fail "Application not configured to use PgBouncer"
    fi
    
    # Check SSL certificates mounted
    if grep -q "/etc/ssl/private:ro" "$compose_file"; then
        success "SSL certificates mounted in containers"
    else
        fail "SSL certificates not mounted in containers"
    fi
    
    # Check for resource limits
    if grep -q "deploy:" "$compose_file" && grep -q "limits:" "$compose_file"; then
        success "Resource limits configured in Docker Compose"
    else
        warning "Resource limits not configured (DoS protection)"
    fi
    
    # Check network isolation
    if grep -q "app-network:" "$compose_file"; then
        success "Custom network configured for container isolation"
    else
        fail "Custom network not configured"
    fi
}

test_security_monitoring() {
    log "Testing security monitoring setup..."
    
    local monitor_init="$DB_CONFIG_DIR/init/05-security-monitoring.sql"
    
    if [[ -f "$monitor_init" ]]; then
        success "Security monitoring initialization script exists"
    else
        fail "Security monitoring initialization script missing"
        return 1
    fi
    
    # Check for security tables
    if grep -q "security_events" "$monitor_init"; then
        success "Security events table configured"
    else
        fail "Security events table not configured"
    fi
    
    if grep -q "failed_auth_attempts" "$monitor_init"; then
        success "Failed authentication tracking configured"
    else
        fail "Failed authentication tracking not configured"
    fi
    
    if grep -q "suspicious_activity" "$monitor_init"; then
        success "Suspicious activity monitoring configured"
    else
        fail "Suspicious activity monitoring not configured"
    fi
}

test_user_management() {
    log "Testing database user management..."
    
    local user_init="$DB_CONFIG_DIR/init/00-security-setup.sql"
    
    if [[ -f "$user_init" ]]; then
        success "User management initialization script exists"
    else
        fail "User management initialization script missing"
        return 1
    fi
    
    # Check for least privilege users
    if grep -q "app_readonly" "$user_init" && grep -q "app_readwrite" "$user_init"; then
        success "Least privilege database users configured"
    else
        fail "Least privilege database users not configured"
    fi
    
    # Check for connection limits
    if grep -q "CONNECTION LIMIT" "$user_init"; then
        success "Database connection limits configured"
    else
        fail "Database connection limits not configured"
    fi
    
    # Check for password expiration
    if grep -q "VALID UNTIL" "$user_init"; then
        success "Password expiration configured"
    else
        fail "Password expiration not configured"
    fi
}

test_backup_security() {
    log "Testing backup security configuration..."
    
    local backup_config="$DB_CONFIG_DIR/config/backup.conf"
    
    if [[ -f "$backup_config" ]]; then
        success "Backup configuration exists"
        
        # Check for encryption
        if grep -q "encryption" "$backup_config"; then
            success "Backup encryption configured"
        else
            fail "Backup encryption not configured"
        fi
    else
        warning "Backup configuration not found (may be configured elsewhere)"
    fi
    
    # Check backup directory permissions
    local backup_dir="$PROJECT_ROOT/data/backups"
    if [[ -d "$backup_dir" ]]; then
        local backup_perms
        backup_perms=$(stat -c %a "$backup_dir" 2>/dev/null || echo "000")
        if [[ "$backup_perms" =~ ^7[0-7][0-7]$ ]]; then
            success "Backup directory has secure permissions"
        else
            warning "Backup directory permissions may be insecure ($backup_perms)"
        fi
    else
        warning "Backup directory not found"
    fi
}

test_environment_security() {
    log "Testing environment security..."
    
    local env_example="$PROJECT_ROOT/.env.example"
    local env_prod_template="$PROJECT_ROOT/.env.production.template"
    
    # Check for environment templates
    if [[ -f "$env_example" ]]; then
        success "Environment example file exists"
        
        # Check that example doesn't contain real secrets
        if ! grep -q "sk_live_" "$env_example" && ! grep -q "pk_live_" "$env_example"; then
            success "Environment example doesn't contain live secrets"
        else
            fail "Environment example contains live secrets"
        fi
    else
        fail "Environment example file missing"
    fi
    
    if [[ -f "$env_prod_template" ]]; then
        success "Production environment template exists"
    else
        warning "Production environment template not found"
    fi
    
    # Check for .env in .gitignore
    if [[ -f "$PROJECT_ROOT/.gitignore" ]] && grep -q "\.env" "$PROJECT_ROOT/.gitignore"; then
        success "Environment files excluded from version control"
    else
        fail "Environment files not properly excluded from version control"
    fi
}

# Main test execution
main() {
    log "Starting database security validation tests..."
    echo ""
    
    # Run all tests
    test_ssl_certificates
    echo ""
    test_pgbouncer_config
    echo ""
    test_postgresql_config
    echo ""
    test_database_connectivity
    echo ""
    test_docker_compose_security
    echo ""
    test_security_monitoring
    echo ""
    test_user_management
    echo ""
    test_backup_security
    echo ""
    test_environment_security
    echo ""
    
    # Display results
    log "Security validation test results:"
    echo "=================================="
    echo -e "Total tests: $TESTS_TOTAL"
    echo -e "${GREEN}Passed: $TESTS_PASSED${NC}"
    echo -e "${RED}Failed: $TESTS_FAILED${NC}"
    echo ""
    
    # Calculate percentage
    local pass_percentage=0
    if [[ $TESTS_TOTAL -gt 0 ]]; then
        pass_percentage=$(( (TESTS_PASSED * 100) / TESTS_TOTAL ))
    fi
    
    echo -e "Pass rate: ${pass_percentage}%"
    echo ""
    
    # Final assessment
    if [[ $TESTS_FAILED -eq 0 ]]; then
        echo -e "${GREEN}🎉 ALL TESTS PASSED! Database security configuration is compliant.${NC}"
        echo ""
        info "Your database security configuration meets PCI DSS requirements."
        info "Proceed with confidence to production deployment."
        exit 0
    elif [[ $pass_percentage -ge 90 ]]; then
        echo -e "${YELLOW}⚠️  MOSTLY COMPLIANT with minor issues.${NC}"
        echo ""
        warning "Address the failed tests before production deployment."
        warning "Review the security checklist for additional requirements."
        exit 1
    elif [[ $pass_percentage -ge 75 ]]; then
        echo -e "${YELLOW}⚠️  PARTIAL COMPLIANCE - significant issues detected.${NC}"
        echo ""
        warning "Multiple security issues must be resolved before production."
        warning "Do not deploy to production until all critical tests pass."
        exit 2
    else
        echo -e "${RED}❌ SECURITY COMPLIANCE FAILED.${NC}"
        echo ""
        echo -e "${RED}CRITICAL: Database security configuration is not compliant.${NC}"
        echo -e "${RED}Do not deploy to production until all issues are resolved.${NC}"
        exit 3
    fi
}

# Execute main function
main "$@"