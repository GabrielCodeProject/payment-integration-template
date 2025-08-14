#!/bin/bash
# Physical Backup Script using pg_basebackup for NextJS Stripe Payment Template
# Full cluster backup with WAL streaming for Point-in-Time Recovery
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
LOG_FILE="${SCRIPT_DIR}/../logs/physical-backup-$(date +%Y%m%d).log"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_PREFIX="payment_template_physical"

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

# ============================================================================
# SECURITY FUNCTIONS
# ============================================================================

setup_replication_auth() {
    local pgpass_file="/tmp/.pgpass_repl.$$"
    echo "${DB_HOST}:${DB_PORT}:replication:${REPLICATION_USER}:${POSTGRES_REPLICA_PASSWORD}" > "$pgpass_file"
    chmod 600 "$pgpass_file"
    export PGPASSFILE="$pgpass_file"
}

cleanup_replication_auth() {
    if [[ -n "${PGPASSFILE:-}" && -f "$PGPASSFILE" ]]; then
        rm -f "$PGPASSFILE"
        unset PGPASSFILE
    fi
}

encrypt_backup_directory() {
    local input_dir="$1"
    local output_file="$2"
    
    if [[ "$BACKUP_ENCRYPTION_ENABLED" == "true" ]]; then
        log_info "Encrypting physical backup: $input_dir -> $output_file"
        
        # Create compressed archive and encrypt
        if tar czf - -C "$(dirname "$input_dir")" "$(basename "$input_dir")" | \
           gpg --trust-model always --encrypt \
               --recipient "$BACKUP_GPG_RECIPIENT" \
               --cipher-algo "$BACKUP_ENCRYPTION_ALGORITHM" \
               --compress-algo 0 \
               --output "$output_file"; then
            
            log_info "Physical backup encrypted successfully"
            rm -rf "$input_dir"  # Remove unencrypted backup
            return 0
        else
            log_error "Physical backup encryption failed"
            return 1
        fi
    else
        log_info "Encryption disabled, compressing backup: $input_dir -> $output_file"
        tar czf "$output_file" -C "$(dirname "$input_dir")" "$(basename "$input_dir")"
        rm -rf "$input_dir"  # Remove uncompressed backup
    fi
}

# ============================================================================
# BACKUP FUNCTIONS
# ============================================================================

create_physical_backup() {
    local backup_dir="$1"
    local temp_dir="${backup_dir}.tmp"
    
    log_info "Starting physical backup of PostgreSQL cluster"
    log_info "Backup directory: $backup_dir"
    
    # Create backup directory
    mkdir -p "$(dirname "$backup_dir")"
    
    # Remove existing temp directory if it exists
    [[ -d "$temp_dir" ]] && rm -rf "$temp_dir"
    
    # Connection parameters
    export PGHOST="$DB_HOST"
    export PGPORT="$DB_PORT"
    export PGUSER="$REPLICATION_USER"
    
    local start_time=$(date +%s)
    
    # Create base backup with WAL streaming
    if pg_basebackup \
        --verbose \
        --pgdata="$temp_dir" \
        --format=plain \
        --write-recovery-conf \
        --wal-method=stream \
        --max-rate=100M \
        --checkpoint=fast \
        --progress \
        --compress=0 \
        2>>"$LOG_FILE"; then
        
        local end_time=$(date +%s)
        local duration=$((end_time - start_time))
        local dir_size=$(du -sh "$temp_dir" | cut -f1)
        
        log_info "Physical backup completed successfully"
        log_info "Duration: ${duration} seconds"
        log_info "Directory size: $dir_size"
        
        # Move temp directory to final location
        mv "$temp_dir" "$backup_dir"
        
        # Set proper permissions
        chmod -R "$BACKUP_PERMISSIONS" "$backup_dir"
        
        return 0
    else
        log_error "Physical backup failed"
        [[ -d "$temp_dir" ]] && rm -rf "$temp_dir"
        return 1
    fi
}

verify_physical_backup() {
    local backup_path="$1"
    
    log_info "Verifying physical backup integrity: $backup_path"
    
    if [[ "$BACKUP_ENCRYPTION_ENABLED" == "true" ]]; then
        # For encrypted backups, verify GPG integrity
        if gpg --verify "$backup_path" 2>/dev/null; then
            log_info "Encrypted physical backup verification successful"
            return 0
        else
            log_error "Encrypted physical backup verification failed"
            return 1
        fi
    else
        # For unencrypted backups, verify directory structure and key files
        local backup_dir
        if [[ -d "$backup_path" ]]; then
            backup_dir="$backup_path"
        else
            # Extract and verify if it's a compressed archive
            local temp_verify_dir="/tmp/backup_verify_$$"
            mkdir -p "$temp_verify_dir"
            
            if tar xzf "$backup_path" -C "$temp_verify_dir"; then
                backup_dir="$temp_verify_dir/$(basename "${backup_path%.tar.gz}")"
            else
                log_error "Failed to extract backup for verification"
                rm -rf "$temp_verify_dir"
                return 1
            fi
        fi
        
        # Check essential PostgreSQL files
        local essential_files=(
            "PG_VERSION"
            "postgresql.conf"
            "pg_hba.conf"
            "global/pg_control"
        )
        
        for file in "${essential_files[@]}"; do
            if [[ ! -f "$backup_dir/$file" ]]; then
                log_error "Missing essential file in backup: $file"
                [[ -d "/tmp/backup_verify_$$" ]] && rm -rf "/tmp/backup_verify_$$"
                return 1
            fi
        done
        
        log_info "Physical backup verification successful"
        [[ -d "/tmp/backup_verify_$$" ]] && rm -rf "/tmp/backup_verify_$$"
        return 0
    fi
}

# ============================================================================
# CLEANUP FUNCTIONS
# ============================================================================

cleanup_old_physical_backups() {
    local backup_dir="$1"
    local retention_days="$2"
    
    log_info "Cleaning up physical backups older than $retention_days days in: $backup_dir"
    
    if [[ -d "$backup_dir" ]]; then
        local deleted_count=0
        
        # Clean up directory backups
        while IFS= read -r -d '' dir; do
            rm -rf "$dir"
            ((deleted_count++))
            log_debug "Deleted old physical backup: $dir"
        done < <(find "$backup_dir" -name "${BACKUP_PREFIX}_*" -type d -mtime +"$retention_days" -print0 2>/dev/null || true)
        
        # Clean up compressed backups
        while IFS= read -r -d '' file; do
            rm -f "$file"
            ((deleted_count++))
            log_debug "Deleted old compressed backup: $file"
        done < <(find "$backup_dir" -name "${BACKUP_PREFIX}_*.tar.gz*" -type f -mtime +"$retention_days" -print0 2>/dev/null || true)
        
        log_info "Cleaned up $deleted_count old physical backup files/directories"
    else
        log_warn "Physical backup directory does not exist: $backup_dir"
    fi
}

# ============================================================================
# WAL ARCHIVE MANAGEMENT
# ============================================================================

create_wal_backup_info() {
    local backup_dir="$1"
    local info_file="$backup_dir/backup_info.txt"
    
    log_info "Creating backup information file: $info_file"
    
    cat > "$info_file" << EOF
# Physical Backup Information
# Generated: $(date)

BACKUP_TYPE=physical
BACKUP_TIMESTAMP=$TIMESTAMP
BACKUP_METHOD=pg_basebackup
DATABASE_NAME=$DB_NAME
POSTGRESQL_VERSION=$(psql -h "$DB_HOST" -p "$DB_PORT" -U "$REPLICATION_USER" -t -c "SELECT version();" 2>/dev/null || echo "Unknown")

# Backup Configuration
WAL_METHOD=stream
COMPRESSION=enabled
ENCRYPTION=$BACKUP_ENCRYPTION_ENABLED
FORMAT=plain

# Recovery Information
# To restore this backup:
# 1. Stop PostgreSQL service
# 2. Remove/backup current data directory
# 3. Extract this backup to data directory
# 4. Start PostgreSQL service
# 5. Monitor logs for recovery completion

# Point-in-Time Recovery
# This backup includes all necessary WAL files for PITR
# Use pg_waldump to examine WAL files if needed
EOF
    
    chmod "$BACKUP_PERMISSIONS" "$info_file"
}

# ============================================================================
# MONITORING AND ALERTING
# ============================================================================

send_notification() {
    local status="$1"
    local message="$2"
    
    if [[ "$BACKUP_MONITORING_ENABLED" == "true" ]]; then
        log_info "Sending notification: $status - $message"
        
        # Email notification
        if [[ -n "${BACKUP_ALERT_EMAIL:-}" ]] && command -v mail >/dev/null 2>&1; then
            echo "$message" | mail -s "Physical Backup $status: $DB_NAME" "$BACKUP_ALERT_EMAIL"
        fi
        
        # Slack notification
        if [[ -n "${BACKUP_SLACK_WEBHOOK:-}" ]] && command -v curl >/dev/null 2>&1; then
            curl -X POST -H 'Content-type: application/json' \
                --data "{\"text\":\"Physical Backup $status: $DB_NAME\\n$message\"}" \
                "$BACKUP_SLACK_WEBHOOK" >/dev/null 2>&1 || true
        fi
    fi
}

# ============================================================================
# MAIN EXECUTION
# ============================================================================

main() {
    log_info "Starting physical backup process"
    log_info "Configuration: $CONFIG_FILE"
    
    # Validate prerequisites
    if ! command -v pg_basebackup >/dev/null 2>&1; then
        log_error "pg_basebackup not found in PATH"
        send_notification "FAILED" "pg_basebackup not found in PATH"
        exit 1
    fi
    
    # Setup replication authentication
    setup_replication_auth
    
    # Create backup paths
    local physical_backup_dir="${PHYSICAL_BACKUP_PATH:-/var/lib/postgresql/backups/physical}"
    local backup_dirname="${BACKUP_PREFIX}_${TIMESTAMP}"
    local temp_backup_path="${physical_backup_dir}/${backup_dirname}"
    local final_backup_path
    
    if [[ "$BACKUP_ENCRYPTION_ENABLED" == "true" ]]; then
        local encrypted_backup_dir="${ENCRYPTED_BACKUP_PATH:-/var/lib/postgresql/backups/encrypted}"
        mkdir -p "$encrypted_backup_dir"
        final_backup_path="${encrypted_backup_dir}/${backup_dirname}.tar.gz.gpg"
    else
        final_backup_path="${physical_backup_dir}/${backup_dirname}.tar.gz"
    fi
    
    # Execute backup process
    local backup_success=false
    
    if create_physical_backup "$temp_backup_path"; then
        # Create backup info file
        create_wal_backup_info "$temp_backup_path"
        
        # Encrypt/compress the backup
        if encrypt_backup_directory "$temp_backup_path" "$final_backup_path"; then
            backup_success=true
            
            # Verify backup if enabled
            if [[ "$VERIFY_BACKUPS" == "true" ]]; then
                if ! verify_physical_backup "$final_backup_path"; then
                    backup_success=false
                fi
            fi
        fi
    fi
    
    # Cleanup old backups
    if [[ "$backup_success" == "true" ]]; then
        cleanup_old_physical_backups "$physical_backup_dir" "$PHYSICAL_BACKUP_RETENTION_DAYS"
        if [[ "$BACKUP_ENCRYPTION_ENABLED" == "true" ]]; then
            cleanup_old_physical_backups "$(dirname "$final_backup_path")" "$PHYSICAL_BACKUP_RETENTION_DAYS"
        fi
    fi
    
    # Cleanup authentication
    cleanup_replication_auth
    
    # Send notification and exit
    if [[ "$backup_success" == "true" ]]; then
        log_info "Physical backup process completed successfully"
        send_notification "SUCCESS" "Physical backup completed: $final_backup_path"
        exit 0
    else
        log_error "Physical backup process failed"
        send_notification "FAILED" "Physical backup failed for database: $DB_NAME"
        exit 1
    fi
}

# ============================================================================
# ERROR HANDLING AND CLEANUP
# ============================================================================

cleanup_on_exit() {
    local exit_code=$?
    cleanup_replication_auth
    
    if [[ $exit_code -ne 0 ]]; then
        log_error "Script exited with error code: $exit_code"
    fi
}

trap cleanup_on_exit EXIT

# Execute main function
main "$@"