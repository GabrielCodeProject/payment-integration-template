#!/bin/bash
# Automated Logical Backup Script for NextJS Stripe Payment Template
# Security-focused backup with encryption for payment data
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
LOG_FILE="${SCRIPT_DIR}/../logs/logical-backup-$(date +%Y%m%d).log"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_PREFIX="payment_template_logical"

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

setup_pgpass() {
    local pgpass_file="/tmp/.pgpass.$$"
    echo "${DB_HOST}:${DB_PORT}:${DB_NAME}:${DB_USER}:${POSTGRES_PASSWORD}" > "$pgpass_file"
    chmod 600 "$pgpass_file"
    export PGPASSFILE="$pgpass_file"
}

cleanup_pgpass() {
    if [[ -n "${PGPASSFILE:-}" && -f "$PGPASSFILE" ]]; then
        rm -f "$PGPASSFILE"
        unset PGPASSFILE
    fi
}

encrypt_backup() {
    local input_file="$1"
    local output_file="$2"
    
    if [[ "$BACKUP_ENCRYPTION_ENABLED" == "true" ]]; then
        log_info "Encrypting backup: $input_file -> $output_file"
        
        if command -v gpg >/dev/null 2>&1; then
            gpg --trust-model always --encrypt \
                --recipient "$BACKUP_GPG_RECIPIENT" \
                --cipher-algo "$BACKUP_ENCRYPTION_ALGORITHM" \
                --compress-algo 2 \
                --output "$output_file" \
                "$input_file"
            
            # Verify encryption
            if [[ -f "$output_file" && -s "$output_file" ]]; then
                log_info "Backup encrypted successfully"
                rm -f "$input_file"  # Remove unencrypted backup
                return 0
            else
                log_error "Encryption failed or output file is empty"
                return 1
            fi
        else
            log_error "GPG not found, cannot encrypt backup"
            return 1
        fi
    else
        log_info "Encryption disabled, moving file: $input_file -> $output_file"
        mv "$input_file" "$output_file"
    fi
}

# ============================================================================
# BACKUP FUNCTIONS
# ============================================================================

create_logical_backup() {
    local backup_file="$1"
    local temp_file="${backup_file}.tmp"
    
    log_info "Starting logical backup of database: $DB_NAME"
    log_info "Backup file: $backup_file"
    
    # Create backup directory if it doesn't exist
    mkdir -p "$(dirname "$backup_file")"
    
    # Database connection parameters
    export PGHOST="$DB_HOST"
    export PGPORT="$DB_PORT"
    export PGDATABASE="$DB_NAME"
    export PGUSER="$DB_USER"
    
    # Create the backup
    local start_time=$(date +%s)
    
    if pg_dump \
        --verbose \
        --format=custom \
        --compress="$LOGICAL_BACKUP_COMPRESSION_LEVEL" \
        --no-owner \
        --no-privileges \
        --create \
        --clean \
        --if-exists \
        --quote-all-identifiers \
        --serializable-deferrable \
        --lock-wait-timeout=30000 \
        --file="$temp_file" \
        2>>"$LOG_FILE"; then
        
        local end_time=$(date +%s)
        local duration=$((end_time - start_time))
        local file_size=$(du -h "$temp_file" | cut -f1)
        
        log_info "Logical backup completed successfully"
        log_info "Duration: ${duration} seconds"
        log_info "File size: $file_size"
        
        # Move temp file to final location
        mv "$temp_file" "$backup_file"
        
        # Set proper permissions
        chmod "$BACKUP_PERMISSIONS" "$backup_file"
        
        return 0
    else
        log_error "Logical backup failed"
        [[ -f "$temp_file" ]] && rm -f "$temp_file"
        return 1
    fi
}

verify_backup() {
    local backup_file="$1"
    
    log_info "Verifying backup integrity: $backup_file"
    
    if [[ "$BACKUP_ENCRYPTION_ENABLED" == "true" ]]; then
        # For encrypted backups, we can only verify the GPG integrity
        if gpg --verify "$backup_file" 2>/dev/null; then
            log_info "Encrypted backup verification successful"
            return 0
        else
            log_error "Encrypted backup verification failed"
            return 1
        fi
    else
        # For unencrypted backups, verify with pg_restore
        if pg_restore --list "$backup_file" >/dev/null 2>&1; then
            log_info "Backup verification successful"
            return 0
        else
            log_error "Backup verification failed"
            return 1
        fi
    fi
}

# ============================================================================
# CLEANUP FUNCTIONS
# ============================================================================

cleanup_old_backups() {
    local backup_dir="$1"
    local retention_days="$2"
    
    log_info "Cleaning up backups older than $retention_days days in: $backup_dir"
    
    if [[ -d "$backup_dir" ]]; then
        local deleted_count=0
        while IFS= read -r -d '' file; do
            rm -f "$file"
            ((deleted_count++))
            log_debug "Deleted old backup: $file"
        done < <(find "$backup_dir" -name "${BACKUP_PREFIX}_*.sql.gz*" -type f -mtime +"$retention_days" -print0 2>/dev/null || true)
        
        log_info "Cleaned up $deleted_count old backup files"
    else
        log_warn "Backup directory does not exist: $backup_dir"
    fi
}

# ============================================================================
# MONITORING AND ALERTING
# ============================================================================

send_notification() {
    local status="$1"
    local message="$2"
    
    if [[ "$BACKUP_MONITORING_ENABLED" == "true" ]]; then
        log_info "Sending notification: $status - $message"
        
        # Email notification (if configured)
        if [[ -n "${BACKUP_ALERT_EMAIL:-}" ]] && command -v mail >/dev/null 2>&1; then
            echo "$message" | mail -s "Backup $status: $DB_NAME" "$BACKUP_ALERT_EMAIL"
        fi
        
        # Slack notification (if configured)
        if [[ -n "${BACKUP_SLACK_WEBHOOK:-}" ]] && command -v curl >/dev/null 2>&1; then
            curl -X POST -H 'Content-type: application/json' \
                --data "{\"text\":\"Backup $status: $DB_NAME\\n$message\"}" \
                "$BACKUP_SLACK_WEBHOOK" >/dev/null 2>&1 || true
        fi
    fi
}

# ============================================================================
# MAIN EXECUTION
# ============================================================================

main() {
    log_info "Starting logical backup process"
    log_info "Configuration: $CONFIG_FILE"
    
    # Validate prerequisites
    if ! command -v pg_dump >/dev/null 2>&1; then
        log_error "pg_dump not found in PATH"
        send_notification "FAILED" "pg_dump not found in PATH"
        exit 1
    fi
    
    # Setup security
    setup_pgpass
    
    # Create backup file paths
    local logical_backup_dir="${LOGICAL_BACKUP_PATH:-/var/lib/postgresql/backups/logical}"
    local backup_filename="${BACKUP_PREFIX}_${TIMESTAMP}.sql.gz"
    local temp_backup_file="${logical_backup_dir}/${backup_filename}"
    local final_backup_file
    
    if [[ "$BACKUP_ENCRYPTION_ENABLED" == "true" ]]; then
        local encrypted_backup_dir="${ENCRYPTED_BACKUP_PATH:-/var/lib/postgresql/backups/encrypted}"
        final_backup_file="${encrypted_backup_dir}/${backup_filename}.gpg"
    else
        final_backup_file="$temp_backup_file"
    fi
    
    # Execute backup process
    local backup_success=false
    
    if create_logical_backup "$temp_backup_file"; then
        if [[ "$BACKUP_ENCRYPTION_ENABLED" == "true" ]]; then
            if encrypt_backup "$temp_backup_file" "$final_backup_file"; then
                backup_success=true
            fi
        else
            backup_success=true
        fi
        
        if [[ "$backup_success" == "true" ]] && [[ "$VERIFY_BACKUPS" == "true" ]]; then
            if ! verify_backup "$final_backup_file"; then
                backup_success=false
            fi
        fi
    fi
    
    # Cleanup old backups
    if [[ "$backup_success" == "true" ]]; then
        cleanup_old_backups "$logical_backup_dir" "$LOGICAL_BACKUP_RETENTION_DAYS"
        if [[ "$BACKUP_ENCRYPTION_ENABLED" == "true" ]]; then
            cleanup_old_backups "$(dirname "$final_backup_file")" "$LOGICAL_BACKUP_RETENTION_DAYS"
        fi
    fi
    
    # Cleanup security
    cleanup_pgpass
    
    # Send notification and exit
    if [[ "$backup_success" == "true" ]]; then
        log_info "Logical backup process completed successfully"
        send_notification "SUCCESS" "Logical backup completed: $final_backup_file"
        exit 0
    else
        log_error "Logical backup process failed"
        send_notification "FAILED" "Logical backup failed for database: $DB_NAME"
        exit 1
    fi
}

# ============================================================================
# ERROR HANDLING AND CLEANUP
# ============================================================================

cleanup_on_exit() {
    local exit_code=$?
    cleanup_pgpass
    
    if [[ $exit_code -ne 0 ]]; then
        log_error "Script exited with error code: $exit_code"
    fi
}

trap cleanup_on_exit EXIT

# Execute main function
main "$@"