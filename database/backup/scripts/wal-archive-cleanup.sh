#!/bin/bash
# WAL Archive Management and Cleanup Script for NextJS Stripe Payment Template
# Manages WAL archive retention and cleanup for Point-in-Time Recovery
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
LOG_FILE="${SCRIPT_DIR}/../logs/wal-cleanup-$(date +%Y%m%d).log"

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
# WAL ARCHIVE FUNCTIONS
# ============================================================================

cleanup_wal_archives() {
    local wal_dir="${WAL_ARCHIVE_PATH:-/var/lib/postgresql/backups/wal}"
    local retention_days="$WAL_ARCHIVE_RETENTION_DAYS"
    
    log_info "Starting WAL archive cleanup"
    log_info "WAL directory: $wal_dir"
    log_info "Retention days: $retention_days"
    
    if [[ ! -d "$wal_dir" ]]; then
        log_warn "WAL archive directory does not exist: $wal_dir"
        return 0
    fi
    
    local total_files=0
    local deleted_files=0
    local total_size=0
    local deleted_size=0
    
    # Count total files and size before cleanup
    while IFS= read -r -d '' file; do
        if [[ -f "$file" ]]; then
            ((total_files++))
            total_size=$((total_size + $(stat -f%z "$file" 2>/dev/null || stat -c%s "$file" 2>/dev/null || echo 0)))
        fi
    done < <(find "$wal_dir" -type f \( -name "*.backup" -o -name "[0-9A-F]*" \) -print0 2>/dev/null || true)
    
    log_info "Total WAL files before cleanup: $total_files"
    log_info "Total size before cleanup: $(numfmt --to=iec $total_size 2>/dev/null || echo "${total_size} bytes")"
    
    # Find and delete old WAL files
    while IFS= read -r -d '' file; do
        if [[ -f "$file" ]]; then
            local file_size=$(stat -f%z "$file" 2>/dev/null || stat -c%s "$file" 2>/dev/null || echo 0)
            rm -f "$file"
            ((deleted_files++))
            deleted_size=$((deleted_size + file_size))
            log_debug "Deleted WAL file: $(basename "$file")"
        fi
    done < <(find "$wal_dir" -type f \( -name "*.backup" -o -name "[0-9A-F]*" \) -mtime +"$retention_days" -print0 2>/dev/null || true)
    
    local remaining_files=$((total_files - deleted_files))
    local remaining_size=$((total_size - deleted_size))
    
    log_info "WAL cleanup completed"
    log_info "Files deleted: $deleted_files"
    log_info "Size freed: $(numfmt --to=iec $deleted_size 2>/dev/null || echo "${deleted_size} bytes")"
    log_info "Remaining files: $remaining_files"
    log_info "Remaining size: $(numfmt --to=iec $remaining_size 2>/dev/null || echo "${remaining_size} bytes")"
    
    return 0
}

verify_wal_archives() {
    local wal_dir="${WAL_ARCHIVE_PATH:-/var/lib/postgresql/backups/wal}"
    
    log_info "Verifying WAL archives integrity"
    
    if [[ ! -d "$wal_dir" ]]; then
        log_warn "WAL archive directory does not exist: $wal_dir"
        return 0
    fi
    
    local total_files=0
    local corrupt_files=0
    
    # Verify WAL files using pg_waldump if available
    if command -v pg_waldump >/dev/null 2>&1; then
        while IFS= read -r -d '' file; do
            if [[ -f "$file" && ! "$file" =~ \.backup$ ]]; then
                ((total_files++))
                
                if ! pg_waldump "$file" >/dev/null 2>&1; then
                    ((corrupt_files++))
                    log_error "Corrupt WAL file detected: $(basename "$file")"
                fi
            fi
        done < <(find "$wal_dir" -type f -name "[0-9A-F]*" -print0 2>/dev/null || true)
        
        log_info "WAL verification completed"
        log_info "Total files verified: $total_files"
        log_info "Corrupt files found: $corrupt_files"
        
        if [[ $corrupt_files -gt 0 ]]; then
            return 1
        fi
    else
        log_warn "pg_waldump not available, skipping WAL verification"
    fi
    
    return 0
}

# ============================================================================
# ARCHIVE STATISTICS
# ============================================================================

generate_wal_statistics() {
    local wal_dir="${WAL_ARCHIVE_PATH:-/var/lib/postgresql/backups/wal}"
    local stats_file="${SCRIPT_DIR}/../logs/wal-statistics-$(date +%Y%m%d).txt"
    
    log_info "Generating WAL archive statistics"
    
    if [[ ! -d "$wal_dir" ]]; then
        log_warn "WAL archive directory does not exist: $wal_dir"
        return 0
    fi
    
    {
        echo "# WAL Archive Statistics Report"
        echo "# Generated: $(date)"
        echo ""
        
        # Count files by age
        echo "## File Count by Age"
        for days in 1 7 14 30 90; do
            local count
            count=$(find "$wal_dir" -type f -name "[0-9A-F]*" -mtime -"$days" | wc -l 2>/dev/null || echo 0)
            echo "Files newer than $days days: $count"
        done
        echo ""
        
        # Size statistics
        echo "## Size Statistics"
        local total_size=0
        local file_count=0
        
        while IFS= read -r -d '' file; do
            if [[ -f "$file" ]]; then
                ((file_count++))
                total_size=$((total_size + $(stat -f%z "$file" 2>/dev/null || stat -c%s "$file" 2>/dev/null || echo 0)))
            fi
        done < <(find "$wal_dir" -type f -name "[0-9A-F]*" -print0 2>/dev/null || true)
        
        echo "Total WAL files: $file_count"
        echo "Total size: $(numfmt --to=iec $total_size 2>/dev/null || echo "${total_size} bytes")"
        
        if [[ $file_count -gt 0 ]]; then
            echo "Average file size: $(numfmt --to=iec $((total_size / file_count)) 2>/dev/null || echo "$((total_size / file_count)) bytes")"
        fi
        
        echo ""
        
        # Recent activity
        echo "## Recent WAL Activity (last 24 hours)"
        local recent_files
        recent_files=$(find "$wal_dir" -type f -name "[0-9A-F]*" -mtime -1 | wc -l 2>/dev/null || echo 0)
        echo "New WAL files: $recent_files"
        
        if [[ $recent_files -gt 0 ]]; then
            echo "Latest WAL files:"
            find "$wal_dir" -type f -name "[0-9A-F]*" -mtime -1 -exec basename {} \; | sort | tail -5 | while read -r file; do
                echo "  $file"
            done
        fi
        
    } > "$stats_file"
    
    log_info "WAL statistics saved to: $stats_file"
    
    # Output summary to log
    local total_files
    total_files=$(find "$wal_dir" -type f -name "[0-9A-F]*" | wc -l 2>/dev/null || echo 0)
    log_info "Current WAL archive contains $total_files files"
}

# ============================================================================
# MONITORING AND ALERTING
# ============================================================================

check_wal_archive_health() {
    local wal_dir="${WAL_ARCHIVE_PATH:-/var/lib/postgresql/backups/wal}"
    local max_age_hours=24
    local issues=()
    
    log_info "Checking WAL archive health"
    
    # Check if directory exists
    if [[ ! -d "$wal_dir" ]]; then
        issues+=("WAL archive directory does not exist: $wal_dir")
    else
        # Check for recent activity
        local recent_files
        recent_files=$(find "$wal_dir" -type f -name "[0-9A-F]*" -mtime -1 | wc -l 2>/dev/null || echo 0)
        
        if [[ $recent_files -eq 0 ]]; then
            issues+=("No recent WAL files (last 24 hours)")
        fi
        
        # Check for very old unarchived files
        local old_files
        old_files=$(find "$wal_dir" -type f -name "[0-9A-F]*" -mtime +90 | wc -l 2>/dev/null || echo 0)
        
        if [[ $old_files -gt 100 ]]; then
            issues+=("Too many old WAL files ($old_files files older than 90 days)")
        fi
        
        # Check disk space
        local available_space
        if command -v df >/dev/null 2>&1; then
            available_space=$(df "$wal_dir" | awk 'NR==2 {print $4}')
            local available_mb=$((available_space / 1024))
            
            if [[ $available_mb -lt 1024 ]]; then  # Less than 1GB
                issues+=("Low disk space for WAL archives: ${available_mb}MB available")
            fi
        fi
    fi
    
    # Report issues
    if [[ ${#issues[@]} -gt 0 ]]; then
        log_warn "WAL archive health issues detected:"
        for issue in "${issues[@]}"; do
            log_warn "  - $issue"
        done
        
        # Send alert
        if [[ "$BACKUP_MONITORING_ENABLED" == "true" ]]; then
            local message="WAL archive health issues:\n$(printf '%s\n' "${issues[@]}")"
            send_notification "WARNING" "$message"
        fi
        
        return 1
    else
        log_info "WAL archive health check passed"
        return 0
    fi
}

send_notification() {
    local status="$1"
    local message="$2"
    
    if [[ "$BACKUP_MONITORING_ENABLED" == "true" ]]; then
        log_info "Sending notification: $status"
        
        # Email notification
        if [[ -n "${BACKUP_ALERT_EMAIL:-}" ]] && command -v mail >/dev/null 2>&1; then
            echo -e "$message" | mail -s "WAL Archive $status: $DB_NAME" "$BACKUP_ALERT_EMAIL"
        fi
        
        # Slack notification
        if [[ -n "${BACKUP_SLACK_WEBHOOK:-}" ]] && command -v curl >/dev/null 2>&1; then
            curl -X POST -H 'Content-type: application/json' \
                --data "{\"text\":\"WAL Archive $status: $DB_NAME\\n$message\"}" \
                "$BACKUP_SLACK_WEBHOOK" >/dev/null 2>&1 || true
        fi
    fi
}

# ============================================================================
# MAIN EXECUTION
# ============================================================================

main() {
    local action="${1:-cleanup}"
    
    log_info "Starting WAL archive management: $action"
    log_info "Configuration: $CONFIG_FILE"
    
    case "$action" in
        "cleanup")
            cleanup_wal_archives
            ;;
        "verify")
            verify_wal_archives
            ;;
        "stats")
            generate_wal_statistics
            ;;
        "health")
            check_wal_archive_health
            ;;
        "all")
            cleanup_wal_archives
            verify_wal_archives
            generate_wal_statistics
            check_wal_archive_health
            ;;
        *)
            log_error "Unknown action: $action"
            echo "Usage: $0 [cleanup|verify|stats|health|all]"
            exit 1
            ;;
    esac
    
    log_info "WAL archive management completed: $action"
}

# Execute main function
main "$@"