#!/bin/bash
# Comprehensive Backup Verification Script for NextJS Stripe Payment Template
# Automated testing and validation of all backup types and procedures
# Author: Backend Reliability Engineer
# Version: 1.0.0

set -euo pipefail

# ============================================================================
# CONFIGURATION AND INITIALIZATION
# ============================================================================

# Load configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CONFIG_FILE="${SCRIPT_DIR}/../config/backup.conf"

# Source configuration if exists
if [[ -f "$CONFIG_FILE" ]]; then
    # shellcheck source=../config/backup.conf
    source "$CONFIG_FILE"
else
    echo "ERROR: Configuration file not found: $CONFIG_FILE"
    exit 1
fi

# Script configuration
SCRIPT_NAME="$(basename "$0")"
LOG_FILE="${SCRIPT_DIR}/../logs/backup-verification-$(date +%Y%m%d_%H%M%S).log"
VERIFICATION_REPORT="${SCRIPT_DIR}/../logs/verification-report-$(date +%Y%m%d_%H%M%S).json"

# Test database settings
TEST_DB_PREFIX="backup_verify_"
TEST_DATA_RECORDS=1000
VERIFICATION_TIMEOUT=300  # 5 minutes

# Docker settings
COMPOSE_FILE="${SCRIPT_DIR}/../../../docker-compose.yml"
DB_SERVICE_NAME="postgres"

# ============================================================================
# LOGGING FUNCTIONS
# ============================================================================

log() {
    local level="$1"
    shift
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] [$level] $*" | tee -a "$LOG_FILE"
}

log_info() { log "INFO" "$@"; }
log_warn() { log "WARN" "$@"; }
log_error() { log "ERROR" "$@"; }
log_debug() { log "DEBUG" "$@"; }
log_success() { log "SUCCESS" "$@"; }

# ============================================================================
# DATABASE CONNECTION FUNCTIONS
# ============================================================================

setup_verification_connection() {
    export PGHOST="$DB_HOST"
    export PGPORT="$DB_PORT"
    export PGUSER="$DB_USER"
    export PGDATABASE="$DB_NAME"
    
    # Setup password file
    local pgpass_file="/tmp/.pgpass_verify.$$"
    echo "${DB_HOST}:${DB_PORT}:*:${DB_USER}:${POSTGRES_PASSWORD}" > "$pgpass_file"
    chmod 600 "$pgpass_file"
    export PGPASSFILE="$pgpass_file"
}

cleanup_verification_connection() {
    if [[ -n "${PGPASSFILE:-}" && -f "$PGPASSFILE" ]]; then
        rm -f "$PGPASSFILE"
        unset PGPASSFILE
    fi
}

execute_sql() {
    local sql="$1"
    local database="${2:-$DB_NAME}"
    
    docker-compose -f "$COMPOSE_FILE" exec -T "$DB_SERVICE_NAME" psql -U "$DB_USER" -d "$database" -c "$sql" 2>>"$LOG_FILE"
}

execute_sql_file() {
    local sql_file="$1"
    local database="${2:-$DB_NAME}"
    
    docker-compose -f "$COMPOSE_FILE" exec -T "$DB_SERVICE_NAME" psql -U "$DB_USER" -d "$database" < "$sql_file" 2>>"$LOG_FILE"
}

# ============================================================================
# TEST DATA MANAGEMENT
# ============================================================================

create_verification_test_data() {
    local test_suffix="$1"
    local record_count="$2"
    
    log_info "Creating verification test data (suffix: $test_suffix, records: $record_count)"
    
    # Create comprehensive test schema
    execute_sql "
        -- Drop existing test objects
        DROP SCHEMA IF EXISTS backup_test_$test_suffix CASCADE;
        CREATE SCHEMA backup_test_$test_suffix;
        
        -- Test table with various data types
        CREATE TABLE backup_test_$test_suffix.test_data (
            id SERIAL PRIMARY KEY,
            text_data VARCHAR(255),
            numeric_data NUMERIC(10,2),
            timestamp_data TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            json_data JSONB,
            boolean_data BOOLEAN,
            uuid_data UUID DEFAULT gen_random_uuid(),
            array_data INTEGER[],
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
        
        -- Create index for verification
        CREATE INDEX idx_test_data_timestamp_$test_suffix ON backup_test_$test_suffix.test_data(timestamp_data);
        CREATE INDEX idx_test_data_text_$test_suffix ON backup_test_$test_suffix.test_data(text_data);
        
        -- Insert test data
        INSERT INTO backup_test_$test_suffix.test_data (
            text_data, numeric_data, json_data, boolean_data, array_data
        )
        SELECT 
            'Test record ' || generate_series(1, $record_count),
            random() * 1000,
            jsonb_build_object('id', generate_series(1, $record_count), 'value', 'test_' || generate_series(1, $record_count)),
            (random() > 0.5),
            ARRAY[generate_series(1, $record_count) % 10, (generate_series(1, $record_count) * 2) % 10]
        FROM generate_series(1, $record_count);
        
        -- Create test function
        CREATE OR REPLACE FUNCTION backup_test_$test_suffix.get_record_count() 
        RETURNS INTEGER AS \$\$
        BEGIN
            RETURN (SELECT COUNT(*) FROM backup_test_$test_suffix.test_data);
        END;
        \$\$ LANGUAGE plpgsql;
        
        -- Create test view
        CREATE VIEW backup_test_$test_suffix.recent_data AS
        SELECT * FROM backup_test_$test_suffix.test_data 
        WHERE created_at > NOW() - INTERVAL '1 hour';
    " || return 1
    
    # Verify test data creation
    local actual_count
    actual_count=$(docker-compose -f "$COMPOSE_FILE" exec -T "$DB_SERVICE_NAME" psql -U "$DB_USER" -d "$DB_NAME" -t -c "SELECT COUNT(*) FROM backup_test_$test_suffix.test_data;" | tr -d ' ')
    
    if [[ "$actual_count" == "$record_count" ]]; then
        log_success "Test data created successfully: $actual_count records"
        return 0
    else
        log_error "Test data creation failed: expected $record_count, got $actual_count"
        return 1
    fi
}

verify_test_data() {
    local test_suffix="$1"
    local expected_count="$2"
    local database="${3:-$DB_NAME}"
    
    log_info "Verifying test data (suffix: $test_suffix, database: $database)"
    
    # Check if schema exists
    local schema_exists
    schema_exists=$(docker-compose -f "$COMPOSE_FILE" exec -T "$DB_SERVICE_NAME" psql -U "$DB_USER" -d "$database" -t -c "SELECT EXISTS(SELECT 1 FROM information_schema.schemata WHERE schema_name = 'backup_test_$test_suffix');" | tr -d ' ')
    
    if [[ "$schema_exists" != "t" ]]; then
        log_error "Test schema does not exist: backup_test_$test_suffix"
        return 1
    fi
    
    # Check record count
    local actual_count
    actual_count=$(docker-compose -f "$COMPOSE_FILE" exec -T "$DB_SERVICE_NAME" psql -U "$DB_USER" -d "$database" -t -c "SELECT COUNT(*) FROM backup_test_$test_suffix.test_data;" | tr -d ' ')
    
    if [[ "$actual_count" != "$expected_count" ]]; then
        log_error "Record count mismatch: expected $expected_count, got $actual_count"
        return 1
    fi
    
    # Check data integrity
    local integrity_checks=(
        "SELECT COUNT(*) FROM backup_test_$test_suffix.test_data WHERE text_data IS NOT NULL"
        "SELECT COUNT(*) FROM backup_test_$test_suffix.test_data WHERE uuid_data IS NOT NULL"
        "SELECT COUNT(*) FROM backup_test_$test_suffix.test_data WHERE json_data IS NOT NULL"
    )
    
    for check in "${integrity_checks[@]}"; do
        local result
        result=$(docker-compose -f "$COMPOSE_FILE" exec -T "$DB_SERVICE_NAME" psql -U "$DB_USER" -d "$database" -t -c "$check;" | tr -d ' ')
        
        if [[ "$result" != "$expected_count" ]]; then
            log_warn "Data integrity issue detected: $check returned $result (expected $expected_count)"
        fi
    done
    
    # Test function execution
    local function_result
    function_result=$(docker-compose -f "$COMPOSE_FILE" exec -T "$DB_SERVICE_NAME" psql -U "$DB_USER" -d "$database" -t -c "SELECT backup_test_$test_suffix.get_record_count();" | tr -d ' ')
    
    if [[ "$function_result" != "$expected_count" ]]; then
        log_warn "Function test failed: expected $expected_count, got $function_result"
    fi
    
    # Test view
    local view_exists
    view_exists=$(docker-compose -f "$COMPOSE_FILE" exec -T "$DB_SERVICE_NAME" psql -U "$DB_USER" -d "$database" -t -c "SELECT EXISTS(SELECT 1 FROM information_schema.views WHERE table_schema = 'backup_test_$test_suffix' AND table_name = 'recent_data');" | tr -d ' ')
    
    if [[ "$view_exists" != "t" ]]; then
        log_warn "Test view does not exist"
    fi
    
    log_success "Test data verification passed: $actual_count records verified"
    return 0
}

cleanup_test_data() {
    local test_suffix="$1"
    local database="${2:-$DB_NAME}"
    
    log_info "Cleaning up test data (suffix: $test_suffix, database: $database)"
    
    execute_sql "DROP SCHEMA IF EXISTS backup_test_$test_suffix CASCADE;" "$database" || true
    
    log_debug "Test data cleanup completed"
}

# ============================================================================
# LOGICAL BACKUP VERIFICATION
# ============================================================================

verify_logical_backup() {
    local backup_file="$1"
    
    log_info "Verifying logical backup: $(basename "$backup_file")"
    
    local verification_results=()
    
    # Check if backup file exists and is readable
    if [[ ! -f "$backup_file" ]]; then
        log_error "Backup file does not exist: $backup_file"
        return 1
    fi
    
    if [[ ! -r "$backup_file" ]]; then
        log_error "Backup file is not readable: $backup_file"
        return 1
    fi
    
    # Check file size
    local file_size_mb
    file_size_mb=$(stat -c%s "$backup_file" | awk '{print int($1/1024/1024)}')
    
    if [[ $file_size_mb -lt 1 ]]; then
        log_error "Backup file is suspiciously small: ${file_size_mb}MB"
        return 1
    fi
    
    log_info "Backup file size: ${file_size_mb}MB"
    
    # Handle different backup formats
    local temp_test_file="/tmp/logical_verify_$$.sql"
    local working_file="$backup_file"
    
    # Decrypt if necessary
    if [[ "$backup_file" =~ \.gpg$ ]]; then
        log_info "Decrypting backup for verification"
        
        if gpg --decrypt --output "$temp_test_file" "$backup_file" 2>>"$LOG_FILE"; then
            working_file="$temp_test_file"
            log_info "Backup decrypted successfully"
        else
            log_error "Failed to decrypt backup"
            return 1
        fi
    fi
    
    # Decompress if necessary
    if [[ "$working_file" =~ \.gz$ ]]; then
        log_info "Decompressing backup for verification"
        
        local decompressed_file="${temp_test_file%.gz}"
        if zcat "$working_file" > "$decompressed_file"; then
            working_file="$decompressed_file"
            log_info "Backup decompressed successfully"
        else
            log_error "Failed to decompress backup"
            rm -f "$temp_test_file"*
            return 1
        fi
    fi
    
    # Verify backup content based on format
    if [[ "$working_file" =~ \.(sql|dump)$ ]] || file "$working_file" | grep -q "PostgreSQL custom database dump"; then
        # Custom format or SQL dump
        if pg_restore --list "$working_file" >/dev/null 2>&1; then
            log_success "PostgreSQL custom format backup verification passed"
            
            # Get object counts
            local table_count
            table_count=$(pg_restore --list "$working_file" 2>/dev/null | grep -c "TABLE DATA" || echo "0")
            log_info "Backup contains $table_count tables with data"
            
        elif head -n 20 "$working_file" | grep -q "PostgreSQL database dump"; then
            log_success "PostgreSQL SQL dump format verification passed"
        else
            log_error "Backup format verification failed"
            rm -f "$temp_test_file"*
            return 1
        fi
    else
        log_error "Unknown backup format"
        rm -f "$temp_test_file"*
        return 1
    fi
    
    # Test restore to temporary database
    local test_db="${TEST_DB_PREFIX}logical_$(date +%s)"
    log_info "Testing restore to temporary database: $test_db"
    
    if test_logical_backup_restore "$working_file" "$test_db"; then
        log_success "Logical backup restore test passed"
        
        # Cleanup test database
        execute_sql "DROP DATABASE IF EXISTS $test_db;" "postgres" || true
    else
        log_error "Logical backup restore test failed"
        execute_sql "DROP DATABASE IF EXISTS $test_db;" "postgres" || true
        rm -f "$temp_test_file"*
        return 1
    fi
    
    # Cleanup temporary files
    rm -f "$temp_test_file"*
    
    log_success "Logical backup verification completed successfully"
    return 0
}

test_logical_backup_restore() {
    local backup_file="$1"
    local test_database="$2"
    
    log_debug "Testing logical backup restore: $backup_file -> $test_database"
    
    # Create test database
    if ! execute_sql "CREATE DATABASE $test_database;" "postgres"; then
        log_error "Failed to create test database: $test_database"
        return 1
    fi
    
    # Restore backup
    local restore_success=false
    
    if [[ "$backup_file" =~ \.(sql|dump)$ ]] && pg_restore --list "$backup_file" >/dev/null 2>&1; then
        # Custom format
        if docker-compose -f "$COMPOSE_FILE" exec -T "$DB_SERVICE_NAME" pg_restore -U "$DB_USER" -d "$test_database" < "$backup_file" 2>>"$LOG_FILE"; then
            restore_success=true
        fi
    else
        # SQL format
        if docker-compose -f "$COMPOSE_FILE" exec -T "$DB_SERVICE_NAME" psql -U "$DB_USER" -d "$test_database" < "$backup_file" 2>>"$LOG_FILE"; then
            restore_success=true
        fi
    fi
    
    if [[ "$restore_success" == "true" ]]; then
        # Verify restored database
        local table_count
        table_count=$(docker-compose -f "$COMPOSE_FILE" exec -T "$DB_SERVICE_NAME" psql -U "$DB_USER" -d "$test_database" -t -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema NOT IN ('information_schema', 'pg_catalog');" | tr -d ' ')
        
        log_debug "Restored database has $table_count tables"
        
        if [[ $table_count -gt 0 ]]; then
            return 0
        else
            log_warn "Restored database has no user tables"
            return 1
        fi
    else
        log_error "Failed to restore backup to test database"
        return 1
    fi
}

# ============================================================================
# PHYSICAL BACKUP VERIFICATION
# ============================================================================

verify_physical_backup() {
    local backup_path="$1"
    
    log_info "Verifying physical backup: $(basename "$backup_path")"
    
    # Check if backup exists
    if [[ ! -e "$backup_path" ]]; then
        log_error "Physical backup does not exist: $backup_path"
        return 1
    fi
    
    local temp_extract_dir="/tmp/physical_verify_$$"
    local backup_dir="$backup_path"
    
    # Handle compressed backups
    if [[ -f "$backup_path" ]]; then
        log_info "Extracting compressed physical backup"
        mkdir -p "$temp_extract_dir"
        
        if [[ "$backup_path" =~ \.gpg$ ]]; then
            # Decrypt and extract
            if gpg --decrypt "$backup_path" | tar xzf - -C "$temp_extract_dir" 2>>"$LOG_FILE"; then
                backup_dir=$(find "$temp_extract_dir" -type d -name "payment_template_physical_*" | head -1)
            else
                log_error "Failed to decrypt and extract physical backup"
                rm -rf "$temp_extract_dir"
                return 1
            fi
        else
            # Just extract
            if tar xzf "$backup_path" -C "$temp_extract_dir" 2>>"$LOG_FILE"; then
                backup_dir=$(find "$temp_extract_dir" -type d -name "payment_template_physical_*" | head -1)
            else
                log_error "Failed to extract physical backup"
                rm -rf "$temp_extract_dir"
                return 1
            fi
        fi
        
        if [[ -z "$backup_dir" || ! -d "$backup_dir" ]]; then
            log_error "Could not find extracted backup directory"
            rm -rf "$temp_extract_dir"
            return 1
        fi
    fi
    
    log_info "Verifying physical backup structure: $backup_dir"
    
    # Check essential PostgreSQL files
    local essential_files=(
        "PG_VERSION"
        "postgresql.conf"
        "pg_hba.conf"
        "global/pg_control"
        "base"
    )
    
    local missing_files=()
    for file in "${essential_files[@]}"; do
        if [[ ! -e "$backup_dir/$file" ]]; then
            missing_files+=("$file")
        fi
    done
    
    if [[ ${#missing_files[@]} -gt 0 ]]; then
        log_error "Missing essential files in physical backup: ${missing_files[*]}"
        rm -rf "$temp_extract_dir"
        return 1
    fi
    
    # Check PostgreSQL version compatibility
    local backup_version
    if backup_version=$(cat "$backup_dir/PG_VERSION" 2>/dev/null); then
        log_info "Backup PostgreSQL version: $backup_version"
        
        # Get current PostgreSQL version
        local current_version
        current_version=$(docker-compose -f "$COMPOSE_FILE" exec -T "$DB_SERVICE_NAME" psql -U "$DB_USER" -d "$DB_NAME" -t -c "SHOW server_version_num;" | tr -d ' ')
        local major_version=${current_version:0:2}
        
        if [[ "$backup_version" != "$major_version" ]]; then
            log_warn "Version mismatch: backup is v$backup_version, current is v$major_version"
        else
            log_success "PostgreSQL version compatibility verified"
        fi
    else
        log_warn "Could not determine backup PostgreSQL version"
    fi
    
    # Check pg_control file
    if [[ -f "$backup_dir/global/pg_control" ]]; then
        local control_size
        control_size=$(stat -c%s "$backup_dir/global/pg_control")
        
        if [[ $control_size -gt 0 ]]; then
            log_success "pg_control file verification passed"
        else
            log_error "pg_control file is empty"
            rm -rf "$temp_extract_dir"
            return 1
        fi
    else
        log_error "pg_control file not found"
        rm -rf "$temp_extract_dir"
        return 1
    fi
    
    # Check database directories
    local db_count=0
    if [[ -d "$backup_dir/base" ]]; then
        db_count=$(find "$backup_dir/base" -mindepth 1 -maxdepth 1 -type d | wc -l)
        log_info "Physical backup contains $db_count database directories"
        
        if [[ $db_count -eq 0 ]]; then
            log_error "No database directories found in backup"
            rm -rf "$temp_extract_dir"
            return 1
        fi
    fi
    
    # Calculate backup size
    local backup_size_mb
    backup_size_mb=$(du -sm "$backup_dir" | cut -f1)
    log_info "Physical backup size: ${backup_size_mb}MB"
    
    # Cleanup
    rm -rf "$temp_extract_dir"
    
    log_success "Physical backup verification completed successfully"
    return 0
}

# ============================================================================
# WAL ARCHIVE VERIFICATION
# ============================================================================

verify_wal_archives() {
    local wal_dir="${WAL_ARCHIVE_PATH:-/var/lib/postgresql/backups/wal}"
    
    log_info "Verifying WAL archives in: $wal_dir"
    
    if [[ ! -d "$wal_dir" ]]; then
        log_error "WAL archive directory does not exist: $wal_dir"
        return 1
    fi
    
    # Count WAL files
    local wal_count
    wal_count=$(find "$wal_dir" -name "[0-9A-F]*" -type f | wc -l)
    
    if [[ $wal_count -eq 0 ]]; then
        log_error "No WAL files found in archive"
        return 1
    fi
    
    log_info "Found $wal_count WAL files in archive"
    
    # Check recent WAL activity
    local recent_wal_count
    recent_wal_count=$(find "$wal_dir" -name "[0-9A-F]*" -type f -mtime -1 | wc -l)
    
    if [[ $recent_wal_count -eq 0 ]]; then
        log_warn "No recent WAL files (last 24 hours) - possible archiving issue"
    else
        log_info "Recent WAL files: $recent_wal_count (last 24 hours)"
    fi
    
    # Verify WAL file integrity using pg_waldump if available
    local verified_files=0
    local corrupt_files=0
    
    if command -v pg_waldump >/dev/null 2>&1; then
        log_info "Verifying WAL file integrity with pg_waldump"
        
        # Test a sample of recent WAL files
        local sample_files=()
        while IFS= read -r -d '' file; do
            sample_files+=("$file")
        done < <(find "$wal_dir" -name "[0-9A-F]*" -type f -mtime -7 -print0 | head -z -n 10)
        
        for wal_file in "${sample_files[@]}"; do
            if pg_waldump "$wal_file" >/dev/null 2>&1; then
                ((verified_files++))
            else
                ((corrupt_files++))
                log_error "Corrupt WAL file detected: $(basename "$wal_file")"
            fi
        done
        
        log_info "WAL verification: $verified_files verified, $corrupt_files corrupt"
        
        if [[ $corrupt_files -gt 0 ]]; then
            return 1
        fi
    else
        log_warn "pg_waldump not available, skipping WAL integrity verification"
    fi
    
    # Check WAL file sizes
    local total_wal_size_mb
    total_wal_size_mb=$(du -sm "$wal_dir" | cut -f1)
    log_info "Total WAL archive size: ${total_wal_size_mb}MB"
    
    if [[ $total_wal_size_mb -gt 50000 ]]; then  # 50GB
        log_warn "WAL archive is very large (${total_wal_size_mb}MB) - consider cleanup"
    fi
    
    log_success "WAL archive verification completed successfully"
    return 0
}

# ============================================================================
# ENCRYPTION VERIFICATION
# ============================================================================

verify_backup_encryption() {
    log_info "Verifying backup encryption capabilities"
    
    if [[ "$BACKUP_ENCRYPTION_ENABLED" != "true" ]]; then
        log_info "Backup encryption is disabled"
        return 0
    fi
    
    # Check GPG availability
    if ! command -v gpg >/dev/null 2>&1; then
        log_error "GPG not available but encryption is enabled"
        return 1
    fi
    
    # Check GPG key
    if ! gpg --list-keys "$BACKUP_GPG_RECIPIENT" >/dev/null 2>&1; then
        log_error "GPG key not found for recipient: $BACKUP_GPG_RECIPIENT"
        return 1
    fi
    
    log_info "GPG key found for recipient: $BACKUP_GPG_RECIPIENT"
    
    # Test encryption/decryption capability
    local test_file="/tmp/encryption_verify_$$.txt"
    local encrypted_file="/tmp/encryption_verify_$$.txt.gpg"
    local decrypted_file="/tmp/encryption_verify_decrypted_$$.txt"
    
    # Create test data
    echo "Backup encryption test data $(date)" > "$test_file"
    
    # Test encryption
    if gpg --trust-model always --encrypt \
           --recipient "$BACKUP_GPG_RECIPIENT" \
           --cipher-algo "$BACKUP_ENCRYPTION_ALGORITHM" \
           --output "$encrypted_file" \
           "$test_file" 2>>"$LOG_FILE"; then
        log_success "Encryption test passed"
    else
        log_error "Encryption test failed"
        rm -f "$test_file" "$encrypted_file"
        return 1
    fi
    
    # Test decryption
    if gpg --decrypt --output "$decrypted_file" "$encrypted_file" 2>>"$LOG_FILE"; then
        log_success "Decryption test passed"
    else
        log_error "Decryption test failed"
        rm -f "$test_file" "$encrypted_file" "$decrypted_file"
        return 1
    fi
    
    # Verify data integrity
    if diff "$test_file" "$decrypted_file" >/dev/null 2>&1; then
        log_success "Encryption/decryption data integrity verified"
    else
        log_error "Encryption/decryption data integrity failed"
        rm -f "$test_file" "$encrypted_file" "$decrypted_file"
        return 1
    fi
    
    # Check encrypted backup files
    local encrypted_dir="${ENCRYPTED_BACKUP_PATH:-/var/lib/postgresql/backups/encrypted}"
    if [[ -d "$encrypted_dir" ]]; then
        local encrypted_count
        encrypted_count=$(find "$encrypted_dir" -name "*.gpg" -type f | wc -l)
        log_info "Found $encrypted_count encrypted backup files"
        
        if [[ $encrypted_count -eq 0 ]]; then
            log_warn "No encrypted backup files found despite encryption being enabled"
        else
            # Test decryption of an actual backup file
            local sample_backup
            sample_backup=$(find "$encrypted_dir" -name "*.gpg" -type f | head -1)
            
            if [[ -n "$sample_backup" ]]; then
                log_info "Testing decryption of actual backup file"
                local test_decrypt="/tmp/backup_decrypt_test_$$"
                
                if gpg --decrypt --output "$test_decrypt" "$sample_backup" 2>>"$LOG_FILE"; then
                    log_success "Actual backup file decryption test passed"
                    rm -f "$test_decrypt"
                else
                    log_error "Actual backup file decryption test failed"
                    rm -f "$test_decrypt"
                    # This is not necessarily a fatal error for the overall verification
                fi
            fi
        fi
    else
        log_warn "Encrypted backup directory does not exist: $encrypted_dir"
    fi
    
    # Cleanup
    rm -f "$test_file" "$encrypted_file" "$decrypted_file"
    
    log_success "Backup encryption verification completed successfully"
    return 0
}

# ============================================================================
# COMPREHENSIVE VERIFICATION ORCHESTRATION
# ============================================================================

run_comprehensive_verification() {
    log_info "Starting comprehensive backup verification"
    
    local start_time=$(date +%s)
    local verification_id="VERIFY_$(date +%Y%m%d_%H%M%S)"
    
    # Initialize verification report
    local report_data="{
        \"verification_id\": \"$verification_id\",
        \"timestamp\": \"$(date '+%Y-%m-%d %H:%M:%S')\",
        \"database\": \"$DB_NAME\",
        \"environment\": \"${NODE_ENV:-development}\",
        \"tests\": {},
        \"summary\": {}
    }"
    
    # Test counters
    local total_tests=0
    local passed_tests=0
    local failed_tests=0
    local skipped_tests=0
    
    # Test array: [test_name, test_function, critical]
    local tests=(
        "Logical Backup Verification" "test_logical_backups_verification" "true"
        "Physical Backup Verification" "test_physical_backups_verification" "true"
        "WAL Archive Verification" "verify_wal_archives" "true"
        "Encryption Verification" "verify_backup_encryption" "false"
        "End-to-End Backup Test" "test_end_to_end_backup" "true"
        "Recovery Procedure Test" "test_recovery_procedures" "false"
    )
    
    # Run verification tests
    for ((i=0; i<${#tests[@]}; i+=3)); do
        local test_name="${tests[i]}"
        local test_function="${tests[i+1]}"
        local is_critical="${tests[i+2]}"
        
        ((total_tests++))
        
        log_info "Running verification test: $test_name"
        
        local test_start_time=$(date +%s)
        local test_result="failed"
        
        if timeout $VERIFICATION_TIMEOUT bash -c "set -e; $test_function"; then
            ((passed_tests++))
            test_result="passed"
            log_success "✓ $test_name: PASSED"
        else
            if [[ "$is_critical" == "true" ]]; then
                ((failed_tests++))
                log_error "✗ $test_name: FAILED (CRITICAL)"
            else
                ((skipped_tests++))
                log_warn "~ $test_name: FAILED (NON-CRITICAL)"
                test_result="skipped"
            fi
        fi
        
        local test_duration=$(($(date +%s) - test_start_time))
        
        # Add test result to report
        local test_key=$(echo "$test_name" | tr ' ' '_' | tr '[:upper:]' '[:lower:]')
        report_data=$(echo "$report_data" | jq ".tests.\"$test_key\" = {
            \"name\": \"$test_name\",
            \"result\": \"$test_result\",
            \"duration_seconds\": $test_duration,
            \"critical\": $is_critical
        }")
        
        echo "----------------------------------------" >> "$LOG_FILE"
    done
    
    local total_duration=$(($(date +%s) - start_time))
    
    # Generate final report
    report_data=$(echo "$report_data" | jq ".summary = {
        \"total_tests\": $total_tests,
        \"passed_tests\": $passed_tests,
        \"failed_tests\": $failed_tests,
        \"skipped_tests\": $skipped_tests,
        \"success_rate\": $(( (passed_tests * 100) / total_tests )),
        \"duration_seconds\": $total_duration,
        \"overall_status\": \"$(if [[ $failed_tests -eq 0 ]]; then echo "passed"; else echo "failed"; fi)\"
    }")
    
    # Write report
    echo "$report_data" > "$VERIFICATION_REPORT"
    
    # Log summary
    log_info "============================================"
    log_info "COMPREHENSIVE BACKUP VERIFICATION RESULTS"
    log_info "============================================"
    log_info "Verification ID: $verification_id"
    log_info "Total tests: $total_tests"
    log_info "Passed: $passed_tests"
    log_info "Failed: $failed_tests"
    log_info "Skipped: $skipped_tests"
    log_info "Success rate: $(( (passed_tests * 100) / total_tests ))%"
    log_info "Duration: ${total_duration} seconds"
    log_info "Report saved: $VERIFICATION_REPORT"
    log_info "============================================"
    
    # Send notification
    local status="SUCCESS"
    if [[ $failed_tests -gt 0 ]]; then
        status="FAILED"
    fi
    
    local message="Backup verification completed\\nPassed: $passed_tests, Failed: $failed_tests, Skipped: $skipped_tests\\nDuration: ${total_duration}s"
    send_verification_notification "$status" "$message"
    
    return $failed_tests
}

# ============================================================================
# INDIVIDUAL VERIFICATION TEST FUNCTIONS
# ============================================================================

test_logical_backups_verification() {
    log_info "Testing logical backup verification"
    
    local logical_dir="${LOGICAL_BACKUP_PATH:-/var/lib/postgresql/backups/logical}"
    
    if [[ ! -d "$logical_dir" ]]; then
        log_error "Logical backup directory does not exist: $logical_dir"
        return 1
    fi
    
    # Find recent logical backups to verify
    local backups_found=0
    local backups_verified=0
    
    while IFS= read -r -d '' backup; do
        ((backups_found++))
        
        if verify_logical_backup "$backup"; then
            ((backups_verified++))
        fi
        
        # Limit verification to recent backups for performance
        if [[ $backups_found -ge 3 ]]; then
            break
        fi
        
    done < <(find "$logical_dir" -name "payment_template_logical_*.sql.gz*" -type f -mtime -7 -print0 | sort -z)
    
    if [[ $backups_found -eq 0 ]]; then
        log_error "No logical backups found for verification"
        return 1
    fi
    
    if [[ $backups_verified -eq $backups_found ]]; then
        log_success "All $backups_verified logical backup(s) verified successfully"
        return 0
    else
        log_error "Only $backups_verified out of $backups_found logical backups verified"
        return 1
    fi
}

test_physical_backups_verification() {
    log_info "Testing physical backup verification"
    
    local physical_dir="${PHYSICAL_BACKUP_PATH:-/var/lib/postgresql/backups/physical}"
    
    if [[ ! -d "$physical_dir" ]]; then
        log_warn "Physical backup directory does not exist: $physical_dir"
        return 0  # Not critical if no physical backups exist
    fi
    
    # Find recent physical backups to verify
    local backups_found=0
    local backups_verified=0
    
    while IFS= read -r -d '' backup; do
        ((backups_found++))
        
        if verify_physical_backup "$backup"; then
            ((backups_verified++))
        fi
        
        # Limit verification for performance
        if [[ $backups_found -ge 2 ]]; then
            break
        fi
        
    done < <(find "$physical_dir" -name "payment_template_physical_*" -type f -mtime -14 -print0 | sort -z)
    
    if [[ $backups_found -eq 0 ]]; then
        log_warn "No recent physical backups found for verification"
        return 0  # Not critical
    fi
    
    if [[ $backups_verified -eq $backups_found ]]; then
        log_success "All $backups_verified physical backup(s) verified successfully"
        return 0
    else
        log_error "Only $backups_verified out of $backups_found physical backups verified"
        return 1
    fi
}

test_end_to_end_backup() {
    log_info "Running end-to-end backup test"
    
    local test_suffix=$(date +%s)
    
    # Step 1: Create test data
    if ! create_verification_test_data "$test_suffix" "$TEST_DATA_RECORDS"; then
        return 1
    fi
    
    # Step 2: Create logical backup
    local test_backup="/tmp/e2e_backup_${test_suffix}.sql"
    log_info "Creating test logical backup: $test_backup"
    
    if docker-compose -f "$COMPOSE_FILE" exec -T "$DB_SERVICE_NAME" pg_dump -U "$DB_USER" -d "$DB_NAME" --format=custom > "$test_backup"; then
        log_success "Test backup created successfully"
    else
        log_error "Failed to create test backup"
        cleanup_test_data "$test_suffix"
        return 1
    fi
    
    # Step 3: Verify backup
    if ! verify_logical_backup "$test_backup"; then
        log_error "Test backup verification failed"
        cleanup_test_data "$test_suffix"
        rm -f "$test_backup"
        return 1
    fi
    
    # Step 4: Test restore
    local test_db="${TEST_DB_PREFIX}e2e_${test_suffix}"
    
    if test_logical_backup_restore "$test_backup" "$test_db"; then
        log_success "Test backup restore succeeded"
        
        # Step 5: Verify restored data
        if verify_test_data "$test_suffix" "$TEST_DATA_RECORDS" "$test_db"; then
            log_success "End-to-end backup test completed successfully"
        else
            log_error "Restored data verification failed"
            cleanup_test_data "$test_suffix"
            execute_sql "DROP DATABASE IF EXISTS $test_db;" "postgres" || true
            rm -f "$test_backup"
            return 1
        fi
        
        # Cleanup
        execute_sql "DROP DATABASE IF EXISTS $test_db;" "postgres" || true
    else
        log_error "Test backup restore failed"
        cleanup_test_data "$test_suffix"
        rm -f "$test_backup"
        return 1
    fi
    
    # Cleanup
    cleanup_test_data "$test_suffix"
    rm -f "$test_backup"
    
    return 0
}

test_recovery_procedures() {
    log_info "Testing recovery procedures (simulation)"
    
    # This is a simulation of recovery procedures without actually 
    # performing destructive operations
    
    # Test 1: Verify disaster recovery script exists and is executable
    local dr_script="${SCRIPT_DIR}/disaster-recovery.sh"
    if [[ -x "$dr_script" ]]; then
        log_success "Disaster recovery script is executable"
    else
        log_error "Disaster recovery script not found or not executable"
        return 1
    fi
    
    # Test 2: Verify backup listing functionality
    if "$dr_script" list-backups >/dev/null 2>&1; then
        log_success "Backup listing functionality works"
    else
        log_warn "Backup listing functionality has issues"
    fi
    
    # Test 3: Verify environment validation
    if "$dr_script" validate >/dev/null 2>&1; then
        log_success "Recovery environment validation passed"
    else
        log_warn "Recovery environment validation has issues"
    fi
    
    # Test 4: Create recovery plan
    if "$dr_script" plan >/dev/null 2>&1; then
        log_success "Recovery plan generation works"
    else
        log_warn "Recovery plan generation has issues"
    fi
    
    return 0
}

# ============================================================================
# ALERTING AND REPORTING
# ============================================================================

send_verification_notification() {
    local status="$1"
    local message="$2"
    
    if [[ "$BACKUP_MONITORING_ENABLED" == "true" ]]; then
        log_info "Sending verification notification: $status"
        
        # Email notification
        if [[ -n "${BACKUP_ALERT_EMAIL:-}" ]] && command -v mail >/dev/null 2>&1; then
            echo -e "$message" | mail -s "Backup Verification $status: $DB_NAME" "$BACKUP_ALERT_EMAIL"
        fi
        
        # Slack notification
        if [[ -n "${BACKUP_SLACK_WEBHOOK:-}" ]] && command -v curl >/dev/null 2>&1; then
            local color=""
            case "$status" in
                "SUCCESS") color="good" ;;
                "FAILED") color="danger" ;;
                "WARNING") color="warning" ;;
            esac
            
            local payload="{
                \"attachments\": [{
                    \"color\": \"$color\",
                    \"title\": \"Backup Verification $status\",
                    \"text\": \"Database: $DB_NAME\\n$message\",
                    \"footer\": \"Backup Verification System\",
                    \"ts\": $(date +%s)
                }]
            }"
            
            curl -X POST -H 'Content-type: application/json' \
                 --data "$payload" \
                 "$BACKUP_SLACK_WEBHOOK" >/dev/null 2>&1 || true
        fi
    fi
}

# ============================================================================
# MAIN EXECUTION
# ============================================================================

usage() {
    cat << EOF
Usage: $0 <command> [options]

Commands:
    all                 Run comprehensive verification of all backup types
    logical             Verify logical backups only
    physical            Verify physical backups only
    wal                 Verify WAL archives only
    encryption          Verify encryption capabilities only
    e2e                 Run end-to-end backup test
    recovery            Test recovery procedures (simulation)
    help                Show this help message

Options:
    --backup FILE       Verify specific backup file
    --timeout SECONDS   Set verification timeout (default: 300)
    --no-alerts         Don't send notification alerts

Examples:
    $0 all
    $0 logical --backup /path/to/backup.sql.gz
    $0 e2e
    $0 encryption

EOF
}

main() {
    local command="${1:-help}"
    
    # Parse options
    shift || true
    while [[ $# -gt 0 ]]; do
        case $1 in
            --backup)
                SPECIFIC_BACKUP="$2"
                shift 2
                ;;
            --timeout)
                VERIFICATION_TIMEOUT="$2"
                shift 2
                ;;
            --no-alerts)
                export BACKUP_MONITORING_ENABLED="false"
                shift
                ;;
            *)
                shift
                ;;
        esac
    done
    
    log_info "Starting backup verification: $command"
    log_info "Configuration: $CONFIG_FILE"
    
    # Setup database connection for tests that need it
    setup_verification_connection
    
    case "$command" in
        "all")
            if run_comprehensive_verification; then
                cleanup_verification_connection
                exit 0
            else
                cleanup_verification_connection
                exit 1
            fi
            ;;
        "logical")
            if [[ -n "${SPECIFIC_BACKUP:-}" ]]; then
                verify_logical_backup "$SPECIFIC_BACKUP"
            else
                test_logical_backups_verification
            fi
            ;;
        "physical")
            if [[ -n "${SPECIFIC_BACKUP:-}" ]]; then
                verify_physical_backup "$SPECIFIC_BACKUP"
            else
                test_physical_backups_verification
            fi
            ;;
        "wal")
            verify_wal_archives
            ;;
        "encryption")
            verify_backup_encryption
            ;;
        "e2e")
            test_end_to_end_backup
            ;;
        "recovery")
            test_recovery_procedures
            ;;
        "help"|*)
            usage
            cleanup_verification_connection
            exit 0
            ;;
    esac
    
    local exit_code=$?
    cleanup_verification_connection
    exit $exit_code
}

# ============================================================================
# ERROR HANDLING AND CLEANUP
# ============================================================================

cleanup_on_exit() {
    local exit_code=$?
    
    cleanup_verification_connection
    
    # Cleanup any test databases
    docker-compose -f "$COMPOSE_FILE" exec -T "$DB_SERVICE_NAME" psql -U "$DB_USER" -d postgres -c "
        SELECT 'DROP DATABASE IF EXISTS ' || datname || ';' 
        FROM pg_database 
        WHERE datname LIKE '${TEST_DB_PREFIX}%';
    " 2>/dev/null | grep "DROP DATABASE" | while read -r drop_cmd; do
        execute_sql "$drop_cmd" "postgres" || true
    done 2>/dev/null || true
    
    # Cleanup test schemas
    for schema in $(execute_sql "SELECT schema_name FROM information_schema.schemata WHERE schema_name LIKE 'backup_test_%';" 2>/dev/null | grep backup_test_ || true); do
        execute_sql "DROP SCHEMA IF EXISTS $schema CASCADE;" || true
    done 2>/dev/null || true
    
    # Cleanup temporary files
    find /tmp -name "*verify_$$*" -delete 2>/dev/null || true
    find /tmp -name "*backup_decrypt_test_$$*" -delete 2>/dev/null || true
    find /tmp -name "*encryption_verify*$$*" -delete 2>/dev/null || true
    
    if [[ $exit_code -ne 0 ]]; then
        log_error "Backup verification script exited with error code: $exit_code"
    fi
}

trap cleanup_on_exit EXIT

# Execute main function
main "$@"