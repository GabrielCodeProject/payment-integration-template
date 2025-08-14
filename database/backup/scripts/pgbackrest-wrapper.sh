#!/bin/bash
# pgBackRest Wrapper Script for NextJS Stripe Payment Template
# Provides consistent interface for advanced backup operations
# Author: Backend Reliability Engineer
# Version: 1.0.0

set -euo pipefail

# ============================================================================
# CONFIGURATION AND INITIALIZATION
# ============================================================================

# Load configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CONFIG_FILE="${SCRIPT_DIR}/../config/backup.conf"
PGBACKREST_CONFIG="${SCRIPT_DIR}/../config/pgbackrest.conf"

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
LOG_FILE="${SCRIPT_DIR}/../logs/pgbackrest-$(date +%Y%m%d).log"
STANZA_NAME="payment-template"

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
# PGBACKREST FUNCTIONS
# ============================================================================

check_pgbackrest() {
    if ! command -v pgbackrest >/dev/null 2>&1; then
        log_error "pgBackRest not found in PATH"
        return 1
    fi
    
    if [[ ! -f "$PGBACKREST_CONFIG" ]]; then
        log_error "pgBackRest configuration not found: $PGBACKREST_CONFIG"
        return 1
    fi
    
    log_info "pgBackRest version: $(pgbackrest version)"
    return 0
}

create_stanza() {
    log_info "Creating pgBackRest stanza: $STANZA_NAME"
    
    if pgbackrest --config="$PGBACKREST_CONFIG" \
                  --stanza="$STANZA_NAME" \
                  stanza-create 2>>"$LOG_FILE"; then
        log_info "Stanza created successfully"
        return 0
    else
        log_error "Failed to create stanza"
        return 1
    fi
}

check_stanza() {
    log_info "Checking pgBackRest stanza: $STANZA_NAME"
    
    if pgbackrest --config="$PGBACKREST_CONFIG" \
                  --stanza="$STANZA_NAME" \
                  check 2>>"$LOG_FILE"; then
        log_info "Stanza check passed"
        return 0
    else
        log_error "Stanza check failed"
        return 1
    fi
}

backup_full() {
    log_info "Starting full backup with pgBackRest"
    
    local start_time=$(date +%s)
    
    if pgbackrest --config="$PGBACKREST_CONFIG" \
                  --stanza="$STANZA_NAME" \
                  --type=full \
                  backup 2>>"$LOG_FILE"; then
        
        local end_time=$(date +%s)
        local duration=$((end_time - start_time))
        
        log_info "Full backup completed successfully"
        log_info "Duration: ${duration} seconds"
        
        # Get backup info
        show_backup_info
        return 0
    else
        log_error "Full backup failed"
        return 1
    fi
}

backup_differential() {
    log_info "Starting differential backup with pgBackRest"
    
    local start_time=$(date +%s)
    
    if pgbackrest --config="$PGBACKREST_CONFIG" \
                  --stanza="$STANZA_NAME" \
                  --type=diff \
                  backup 2>>"$LOG_FILE"; then
        
        local end_time=$(date +%s)
        local duration=$((end_time - start_time))
        
        log_info "Differential backup completed successfully"
        log_info "Duration: ${duration} seconds"
        
        # Get backup info
        show_backup_info
        return 0
    else
        log_error "Differential backup failed"
        return 1
    fi
}

backup_incremental() {
    log_info "Starting incremental backup with pgBackRest"
    
    local start_time=$(date +%s)
    
    if pgbackrest --config="$PGBACKREST_CONFIG" \
                  --stanza="$STANZA_NAME" \
                  --type=incr \
                  backup 2>>"$LOG_FILE"; then
        
        local end_time=$(date +%s)
        local duration=$((end_time - start_time))
        
        log_info "Incremental backup completed successfully"
        log_info "Duration: ${duration} seconds"
        
        # Get backup info
        show_backup_info
        return 0
    else
        log_error "Incremental backup failed"
        return 1
    fi
}

show_backup_info() {
    log_info "Backup information:"
    
    if pgbackrest --config="$PGBACKREST_CONFIG" \
                  --stanza="$STANZA_NAME" \
                  info --output=text 2>>"$LOG_FILE" | while IFS= read -r line; do
        log_info "$line"
    done; then
        return 0
    else
        log_warn "Could not retrieve backup information"
        return 1
    fi
}

verify_backup() {
    local backup_label="${1:-latest}"
    
    log_info "Verifying backup: $backup_label"
    
    if pgbackrest --config="$PGBACKREST_CONFIG" \
                  --stanza="$STANZA_NAME" \
                  --set="$backup_label" \
                  verify 2>>"$LOG_FILE"; then
        log_info "Backup verification successful"
        return 0
    else
        log_error "Backup verification failed"
        return 1
    fi
}

restore_database() {
    local backup_label="${1:-latest}"
    local restore_path="${2:-/tmp/pgbackrest_restore}"
    local recovery_target_time="${3:-}"
    
    log_info "Starting database restore"
    log_info "Backup: $backup_label"
    log_info "Restore path: $restore_path"
    
    # Create restore directory
    mkdir -p "$restore_path"
    
    local restore_cmd="pgbackrest --config=$PGBACKREST_CONFIG --stanza=$STANZA_NAME"
    
    # Add recovery target if specified
    if [[ -n "$recovery_target_time" ]]; then
        restore_cmd="$restore_cmd --recovery-option=recovery_target_time='$recovery_target_time'"
        log_info "Point-in-time recovery to: $recovery_target_time"
    fi
    
    # Add backup set if not latest
    if [[ "$backup_label" != "latest" ]]; then
        restore_cmd="$restore_cmd --set=$backup_label"
    fi
    
    # Execute restore
    restore_cmd="$restore_cmd --pg1-path=$restore_path restore"
    
    if eval "$restore_cmd" 2>>"$LOG_FILE"; then
        log_info "Database restore completed successfully"
        log_info "Restored to: $restore_path"
        return 0
    else
        log_error "Database restore failed"
        return 1
    fi
}

expire_backups() {
    log_info "Running backup expiration"
    
    if pgbackrest --config="$PGBACKREST_CONFIG" \
                  --stanza="$STANZA_NAME" \
                  expire 2>>"$LOG_FILE"; then
        log_info "Backup expiration completed"
        return 0
    else
        log_error "Backup expiration failed"
        return 1
    fi
}

# ============================================================================
# MONITORING AND ALERTING
# ============================================================================

send_notification() {
    local status="$1"
    local message="$2"
    
    if [[ "$BACKUP_MONITORING_ENABLED" == "true" ]]; then
        log_info "Sending notification: $status"
        
        # Email notification
        if [[ -n "${BACKUP_ALERT_EMAIL:-}" ]] && command -v mail >/dev/null 2>&1; then
            echo "$message" | mail -s "pgBackRest $status: $DB_NAME" "$BACKUP_ALERT_EMAIL"
        fi
        
        # Slack notification
        if [[ -n "${BACKUP_SLACK_WEBHOOK:-}" ]] && command -v curl >/dev/null 2>&1; then
            curl -X POST -H 'Content-type: application/json' \
                --data "{\"text\":\"pgBackRest $status: $DB_NAME\\n$message\"}" \
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
    init                Initialize pgBackRest stanza
    check               Check stanza configuration
    backup-full         Perform full backup
    backup-diff         Perform differential backup
    backup-incr         Perform incremental backup
    info                Show backup information
    verify [label]      Verify backup (default: latest)
    restore [label] [path] [time]  Restore database
    expire              Expire old backups
    help                Show this help message

Examples:
    $0 init
    $0 backup-full
    $0 verify
    $0 restore latest /tmp/restore
    $0 restore 20240814-123456F /tmp/restore "2024-08-14 12:30:00"

EOF
}

main() {
    local command="${1:-help}"
    
    case "$command" in
        "init")
            log_info "Initializing pgBackRest"
            if check_pgbackrest && create_stanza && check_stanza; then
                send_notification "SUCCESS" "pgBackRest initialization completed"
                exit 0
            else
                send_notification "FAILED" "pgBackRest initialization failed"
                exit 1
            fi
            ;;
        "check")
            log_info "Checking pgBackRest configuration"
            if check_pgbackrest && check_stanza; then
                send_notification "SUCCESS" "pgBackRest check passed"
                exit 0
            else
                send_notification "FAILED" "pgBackRest check failed"
                exit 1
            fi
            ;;
        "backup-full")
            log_info "Starting full backup"
            if check_pgbackrest && backup_full; then
                send_notification "SUCCESS" "pgBackRest full backup completed"
                exit 0
            else
                send_notification "FAILED" "pgBackRest full backup failed"
                exit 1
            fi
            ;;
        "backup-diff")
            log_info "Starting differential backup"
            if check_pgbackrest && backup_differential; then
                send_notification "SUCCESS" "pgBackRest differential backup completed"
                exit 0
            else
                send_notification "FAILED" "pgBackRest differential backup failed"
                exit 1
            fi
            ;;
        "backup-incr")
            log_info "Starting incremental backup"
            if check_pgbackrest && backup_incremental; then
                send_notification "SUCCESS" "pgBackRest incremental backup completed"
                exit 0
            else
                send_notification "FAILED" "pgBackRest incremental backup failed"
                exit 1
            fi
            ;;
        "info")
            log_info "Showing backup information"
            check_pgbackrest && show_backup_info
            ;;
        "verify")
            local backup_label="${2:-latest}"
            log_info "Verifying backup: $backup_label"
            if check_pgbackrest && verify_backup "$backup_label"; then
                send_notification "SUCCESS" "pgBackRest verification passed for $backup_label"
                exit 0
            else
                send_notification "FAILED" "pgBackRest verification failed for $backup_label"
                exit 1
            fi
            ;;
        "restore")
            local backup_label="${2:-latest}"
            local restore_path="${3:-/tmp/pgbackrest_restore}"
            local recovery_time="${4:-}"
            log_info "Starting restore operation"
            if check_pgbackrest && restore_database "$backup_label" "$restore_path" "$recovery_time"; then
                send_notification "SUCCESS" "pgBackRest restore completed to $restore_path"
                exit 0
            else
                send_notification "FAILED" "pgBackRest restore failed"
                exit 1
            fi
            ;;
        "expire")
            log_info "Running backup expiration"
            check_pgbackrest && expire_backups
            ;;
        "help"|*)
            usage
            exit 0
            ;;
    esac
}

# Execute main function
main "$@"