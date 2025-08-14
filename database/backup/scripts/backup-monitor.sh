#!/bin/bash
# Backup Monitoring and Alerting Script for NextJS Stripe Payment Template
# Comprehensive monitoring of backup operations and health
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
LOG_FILE="${SCRIPT_DIR}/../logs/backup-monitor-$(date +%Y%m%d).log"
STATUS_FILE="${SCRIPT_DIR}/../logs/backup-status.json"
METRICS_FILE="${SCRIPT_DIR}/../logs/backup-metrics.txt"

# Health thresholds
MAX_BACKUP_AGE_HOURS=48
MIN_FREE_SPACE_GB=10
MAX_FAILURE_RATE=20  # percentage
WARNING_BACKUP_AGE_HOURS=36

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
# MONITORING FUNCTIONS
# ============================================================================

check_backup_freshness() {
    log_info "Checking backup freshness"
    
    local issues=()
    local warnings=()
    
    # Check logical backups
    local logical_dir="${LOGICAL_BACKUP_PATH:-/var/lib/postgresql/backups/logical}"
    if [[ -d "$logical_dir" ]]; then
        local latest_logical
        latest_logical=$(find "$logical_dir" -name "payment_template_logical_*.sql.gz*" -type f -printf '%T@ %p\n' 2>/dev/null | sort -nr | head -1 | cut -d' ' -f2- || echo "")
        
        if [[ -n "$latest_logical" ]]; then
            local logical_age_hours
            logical_age_hours=$(( ($(date +%s) - $(stat -c%Y "$latest_logical")) / 3600 ))
            
            if [[ $logical_age_hours -gt $MAX_BACKUP_AGE_HOURS ]]; then
                issues+=("Logical backup is $logical_age_hours hours old (max: $MAX_BACKUP_AGE_HOURS)")
            elif [[ $logical_age_hours -gt $WARNING_BACKUP_AGE_HOURS ]]; then
                warnings+=("Logical backup is $logical_age_hours hours old (warning: $WARNING_BACKUP_AGE_HOURS)")
            fi
            
            log_info "Latest logical backup: $(basename "$latest_logical") ($logical_age_hours hours old)"
        else
            issues+=("No logical backups found")
        fi
    else
        issues+=("Logical backup directory does not exist: $logical_dir")
    fi
    
    # Check physical backups
    local physical_dir="${PHYSICAL_BACKUP_PATH:-/var/lib/postgresql/backups/physical}"
    if [[ -d "$physical_dir" ]]; then
        local latest_physical
        latest_physical=$(find "$physical_dir" -name "payment_template_physical_*.tar.gz*" -type f -printf '%T@ %p\n' 2>/dev/null | sort -nr | head -1 | cut -d' ' -f2- || echo "")
        
        if [[ -n "$latest_physical" ]]; then
            local physical_age_hours
            physical_age_hours=$(( ($(date +%s) - $(stat -c%Y "$latest_physical")) / 3600 ))
            
            if [[ $physical_age_hours -gt $((MAX_BACKUP_AGE_HOURS * 7)) ]]; then  # Physical backups are weekly
                issues+=("Physical backup is $physical_age_hours hours old (max: $((MAX_BACKUP_AGE_HOURS * 7)))")
            fi
            
            log_info "Latest physical backup: $(basename "$latest_physical") ($physical_age_hours hours old)"
        else
            warnings+=("No physical backups found")
        fi
    else
        warnings+=("Physical backup directory does not exist: $physical_dir")
    fi
    
    # Return status
    if [[ ${#issues[@]} -gt 0 ]]; then
        for issue in "${issues[@]}"; do
            log_error "$issue"
        done
        return 1
    fi
    
    if [[ ${#warnings[@]} -gt 0 ]]; then
        for warning in "${warnings[@]}"; do
            log_warn "$warning"
        done
    fi
    
    return 0
}

check_backup_storage() {
    log_info "Checking backup storage health"
    
    local issues=()
    local warnings=()
    
    # Check disk space for each backup directory
    local backup_dirs=(
        "${LOGICAL_BACKUP_PATH:-/var/lib/postgresql/backups/logical}"
        "${PHYSICAL_BACKUP_PATH:-/var/lib/postgresql/backups/physical}"
        "${WAL_ARCHIVE_PATH:-/var/lib/postgresql/backups/wal}"
        "${ENCRYPTED_BACKUP_PATH:-/var/lib/postgresql/backups/encrypted}"
    )
    
    for dir in "${backup_dirs[@]}"; do
        if [[ -d "$dir" ]]; then
            local available_space_kb
            available_space_kb=$(df "$dir" | awk 'NR==2 {print $4}')
            local available_space_gb=$((available_space_kb / 1024 / 1024))
            
            if [[ $available_space_gb -lt $MIN_FREE_SPACE_GB ]]; then
                issues+=("Low disk space in $dir: ${available_space_gb}GB available (min: ${MIN_FREE_SPACE_GB}GB)")
            elif [[ $available_space_gb -lt $((MIN_FREE_SPACE_GB * 2)) ]]; then
                warnings+=("Disk space getting low in $dir: ${available_space_gb}GB available")
            fi
            
            log_debug "Disk space in $dir: ${available_space_gb}GB available"
            
            # Check directory permissions
            if [[ ! -w "$dir" ]]; then
                issues+=("Backup directory is not writable: $dir")
            fi
        fi
    done
    
    # Return status
    if [[ ${#issues[@]} -gt 0 ]]; then
        for issue in "${issues[@]}"; do
            log_error "$issue"
        done
        return 1
    fi
    
    if [[ ${#warnings[@]} -gt 0 ]]; then
        for warning in "${warnings[@]}"; do
            log_warn "$warning"
        done
    fi
    
    return 0
}

check_backup_logs() {
    log_info "Checking backup operation logs"
    
    local issues=()
    local warnings=()
    
    # Check recent backup logs for failures
    local log_dir="${SCRIPT_DIR}/../logs"
    local failure_count=0
    local total_count=0
    
    # Check logical backup logs from last 7 days
    while IFS= read -r -d '' logfile; do
        ((total_count++))
        
        if grep -q "ERROR\|FAILED" "$logfile" 2>/dev/null; then
            ((failure_count++))
            local log_date
            log_date=$(basename "$logfile" | sed 's/.*-\([0-9]\{8\}\)\.log/\1/')
            warnings+=("Backup failures found in log: $log_date")
        fi
    done < <(find "$log_dir" -name "*backup-*.log" -mtime -7 -print0 2>/dev/null || true)
    
    # Calculate failure rate
    if [[ $total_count -gt 0 ]]; then
        local failure_rate=$(( (failure_count * 100) / total_count ))
        
        if [[ $failure_rate -gt $MAX_FAILURE_RATE ]]; then
            issues+=("High backup failure rate: ${failure_rate}% (max: ${MAX_FAILURE_RATE}%)")
        fi
        
        log_info "Backup success rate: $((100 - failure_rate))% ($((total_count - failure_count))/$total_count successful)"
    else
        warnings+=("No recent backup logs found")
    fi
    
    # Return status
    if [[ ${#issues[@]} -gt 0 ]]; then
        for issue in "${issues[@]}"; do
            log_error "$issue"
        done
        return 1
    fi
    
    if [[ ${#warnings[@]} -gt 0 ]]; then
        for warning in "${warnings[@]}"; do
            log_warn "$warning"
        done
    fi
    
    return 0
}

check_wal_archiving() {
    log_info "Checking WAL archiving health"
    
    local issues=()
    local warnings=()
    
    # Check WAL archive directory
    local wal_dir="${WAL_ARCHIVE_PATH:-/var/lib/postgresql/backups/wal}"
    if [[ -d "$wal_dir" ]]; then
        # Check for recent WAL files
        local recent_wal_count
        recent_wal_count=$(find "$wal_dir" -name "[0-9A-F]*" -mtime -1 -type f | wc -l)
        
        if [[ $recent_wal_count -eq 0 ]]; then
            issues+=("No recent WAL files archived (last 24 hours)")
        elif [[ $recent_wal_count -lt 5 ]]; then
            warnings+=("Low WAL activity: only $recent_wal_count files in last 24 hours")
        fi
        
        log_info "Recent WAL files: $recent_wal_count (last 24 hours)"
        
        # Check for very old WAL files that might indicate cleanup issues
        local old_wal_count
        old_wal_count=$(find "$wal_dir" -name "[0-9A-F]*" -mtime +$WAL_ARCHIVE_RETENTION_DAYS -type f | wc -l)
        
        if [[ $old_wal_count -gt 0 ]]; then
            warnings+=("Found $old_wal_count old WAL files (older than $WAL_ARCHIVE_RETENTION_DAYS days)")
        fi
        
        # Check total WAL archive size
        local wal_size_mb
        wal_size_mb=$(du -sm "$wal_dir" | cut -f1)
        if [[ $wal_size_mb -gt 10240 ]]; then  # 10GB
            warnings+=("WAL archive size is large: ${wal_size_mb}MB")
        fi
        
        log_info "WAL archive size: ${wal_size_mb}MB"
    else
        issues+=("WAL archive directory does not exist: $wal_dir")
    fi
    
    # Return status
    if [[ ${#issues[@]} -gt 0 ]]; then
        for issue in "${issues[@]}"; do
            log_error "$issue"
        done
        return 1
    fi
    
    if [[ ${#warnings[@]} -gt 0 ]]; then
        for warning in "${warnings[@]}"; do
            log_warn "$warning"
        done
    fi
    
    return 0
}

check_encryption_health() {
    log_info "Checking backup encryption health"
    
    if [[ "$BACKUP_ENCRYPTION_ENABLED" != "true" ]]; then
        log_info "Backup encryption is disabled"
        return 0
    fi
    
    local issues=()
    local warnings=()
    
    # Check GPG availability
    if ! command -v gpg >/dev/null 2>&1; then
        issues+=("GPG not available but encryption is enabled")
        return 1
    fi
    
    # Check GPG key for recipient
    if ! gpg --list-keys "$BACKUP_GPG_RECIPIENT" >/dev/null 2>&1; then
        issues+=("GPG key not found for recipient: $BACKUP_GPG_RECIPIENT")
        return 1
    fi
    
    # Check encrypted backup directory
    local encrypted_dir="${ENCRYPTED_BACKUP_PATH:-/var/lib/postgresql/backups/encrypted}"
    if [[ -d "$encrypted_dir" ]]; then
        local encrypted_count
        encrypted_count=$(find "$encrypted_dir" -name "*.gpg" -type f | wc -l)
        log_info "Encrypted backups found: $encrypted_count"
        
        if [[ $encrypted_count -eq 0 ]]; then
            warnings+=("No encrypted backups found despite encryption being enabled")
        fi
    else
        warnings+=("Encrypted backup directory does not exist: $encrypted_dir")
    fi
    
    # Test encryption capability
    local test_file="/tmp/encryption_test.$$"
    local test_encrypted="/tmp/encryption_test.$$.gpg"
    
    echo "test" > "$test_file"
    
    if gpg --trust-model always --encrypt \
           --recipient "$BACKUP_GPG_RECIPIENT" \
           --output "$test_encrypted" \
           "$test_file" 2>/dev/null; then
        log_debug "Encryption test successful"
        rm -f "$test_file" "$test_encrypted"
    else
        issues+=("Encryption test failed")
        rm -f "$test_file" "$test_encrypted"
        return 1
    fi
    
    # Return status
    if [[ ${#issues[@]} -gt 0 ]]; then
        for issue in "${issues[@]}"; do
            log_error "$issue"
        done
        return 1
    fi
    
    if [[ ${#warnings[@]} -gt 0 ]]; then
        for warning in "${warnings[@]}"; do
            log_warn "$warning"
        done
    fi
    
    return 0
}

# ============================================================================
# METRICS AND STATUS REPORTING
# ============================================================================

generate_backup_metrics() {
    log_info "Generating backup metrics"
    
    local timestamp=$(date +%s)
    local date_str=$(date '+%Y-%m-%d %H:%M:%S')
    
    # Initialize metrics
    local metrics=""
    
    # Backup freshness metrics
    local logical_dir="${LOGICAL_BACKUP_PATH:-/var/lib/postgresql/backups/logical}"
    if [[ -d "$logical_dir" ]]; then
        local latest_logical
        latest_logical=$(find "$logical_dir" -name "payment_template_logical_*.sql.gz*" -type f -printf '%T@ %p\n' 2>/dev/null | sort -nr | head -1 | cut -d' ' -f2- || echo "")
        
        if [[ -n "$latest_logical" ]]; then
            local logical_age_hours=$(( ($(date +%s) - $(stat -c%Y "$latest_logical")) / 3600 ))
            local logical_size_mb=$(( $(stat -c%s "$latest_logical") / 1024 / 1024 ))
            
            metrics+="backup_logical_age_hours $logical_age_hours $timestamp\n"
            metrics+="backup_logical_size_mb $logical_size_mb $timestamp\n"
        fi
    fi
    
    # Physical backup metrics
    local physical_dir="${PHYSICAL_BACKUP_PATH:-/var/lib/postgresql/backups/physical}"
    if [[ -d "$physical_dir" ]]; then
        local latest_physical
        latest_physical=$(find "$physical_dir" -name "payment_template_physical_*.tar.gz*" -type f -printf '%T@ %p\n' 2>/dev/null | sort -nr | head -1 | cut -d' ' -f2- || echo "")
        
        if [[ -n "$latest_physical" ]]; then
            local physical_age_hours=$(( ($(date +%s) - $(stat -c%Y "$latest_physical")) / 3600 ))
            local physical_size_mb=$(( $(stat -c%s "$latest_physical") / 1024 / 1024 ))
            
            metrics+="backup_physical_age_hours $physical_age_hours $timestamp\n"
            metrics+="backup_physical_size_mb $physical_size_mb $timestamp\n"
        fi
    fi
    
    # WAL archive metrics
    local wal_dir="${WAL_ARCHIVE_PATH:-/var/lib/postgresql/backups/wal}"
    if [[ -d "$wal_dir" ]]; then
        local wal_count
        wal_count=$(find "$wal_dir" -name "[0-9A-F]*" -type f | wc -l)
        local wal_size_mb
        wal_size_mb=$(du -sm "$wal_dir" 2>/dev/null | cut -f1 || echo 0)
        local recent_wal_count
        recent_wal_count=$(find "$wal_dir" -name "[0-9A-F]*" -mtime -1 -type f | wc -l)
        
        metrics+="wal_archive_count $wal_count $timestamp\n"
        metrics+="wal_archive_size_mb $wal_size_mb $timestamp\n"
        metrics+="wal_archive_recent_count $recent_wal_count $timestamp\n"
    fi
    
    # Disk space metrics
    for dir in "$logical_dir" "$physical_dir" "$wal_dir"; do
        if [[ -d "$dir" ]]; then
            local available_space_gb
            available_space_gb=$(df "$dir" | awk 'NR==2 {print int($4/1024/1024)}')
            local dir_name
            dir_name=$(basename "$dir")
            
            metrics+="backup_storage_free_gb{directory=\"$dir_name\"} $available_space_gb $timestamp\n"
        fi
    done
    
    # Write metrics to file
    if [[ -n "$metrics" ]]; then
        {
            echo "# Backup system metrics"
            echo "# Generated: $date_str"
            echo ""
            echo -e "$metrics"
        } > "$METRICS_FILE"
        
        log_info "Metrics written to: $METRICS_FILE"
    fi
}

generate_status_report() {
    log_info "Generating backup status report"
    
    local status="healthy"
    local issues=()
    local warnings=()
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    
    # Run all health checks and collect issues
    if ! check_backup_freshness 2>/dev/null; then
        status="critical"
        issues+=("Backup freshness check failed")
    fi
    
    if ! check_backup_storage 2>/dev/null; then
        if [[ "$status" != "critical" ]]; then
            status="warning"
        fi
        issues+=("Backup storage check failed")
    fi
    
    if ! check_backup_logs 2>/dev/null; then
        if [[ "$status" != "critical" ]]; then
            status="warning"
        fi
        issues+=("Backup logs check failed")
    fi
    
    if ! check_wal_archiving 2>/dev/null; then
        status="critical"
        issues+=("WAL archiving check failed")
    fi
    
    if ! check_encryption_health 2>/dev/null; then
        if [[ "$status" != "critical" ]]; then
            status="warning"
        fi
        issues+=("Encryption health check failed")
    fi
    
    # Generate JSON status report
    cat > "$STATUS_FILE" << EOF
{
  "timestamp": "$timestamp",
  "status": "$status",
  "database": "$DB_NAME",
  "checks": {
    "backup_freshness": "$(check_backup_freshness &>/dev/null && echo "ok" || echo "failed")",
    "backup_storage": "$(check_backup_storage &>/dev/null && echo "ok" || echo "failed")",
    "backup_logs": "$(check_backup_logs &>/dev/null && echo "ok" || echo "failed")",
    "wal_archiving": "$(check_wal_archiving &>/dev/null && echo "ok" || echo "failed")",
    "encryption": "$(check_encryption_health &>/dev/null && echo "ok" || echo "failed")"
  },
  "issues": [$(printf '"%s",' "${issues[@]}" | sed 's/,$//')]
EOF
    
    # Add backup information
    local logical_dir="${LOGICAL_BACKUP_PATH:-/var/lib/postgresql/backups/logical}"
    local latest_logical=""
    if [[ -d "$logical_dir" ]]; then
        latest_logical=$(find "$logical_dir" -name "payment_template_logical_*.sql.gz*" -type f -printf '%T@ %p\n' 2>/dev/null | sort -nr | head -1 | cut -d' ' -f2-)
    fi
    
    cat >> "$STATUS_FILE" << EOF
,
  "backups": {
    "latest_logical": "$(basename "$latest_logical" 2>/dev/null || echo "none")",
    "latest_logical_age_hours": $(if [[ -n "$latest_logical" ]]; then echo $(( ($(date +%s) - $(stat -c%Y "$latest_logical")) / 3600 )); else echo "null"; fi)
  }
}
EOF
    
    log_info "Status report written to: $STATUS_FILE"
    return $(if [[ "$status" == "critical" ]]; then echo 1; else echo 0; fi)
}

# ============================================================================
# ALERTING FUNCTIONS
# ============================================================================

send_health_alert() {
    local severity="$1"
    local message="$2"
    
    if [[ "$BACKUP_MONITORING_ENABLED" != "true" ]]; then
        return 0
    fi
    
    log_info "Sending $severity alert: $message"
    
    # Email alert
    if [[ -n "${BACKUP_ALERT_EMAIL:-}" ]] && command -v mail >/dev/null 2>&1; then
        local subject="[$severity] Backup System Alert: $DB_NAME"
        echo "$message" | mail -s "$subject" "$BACKUP_ALERT_EMAIL"
    fi
    
    # Slack alert
    if [[ -n "${BACKUP_SLACK_WEBHOOK:-}" ]] && command -v curl >/dev/null 2>&1; then
        local color=""
        case "$severity" in
            "CRITICAL") color="danger" ;;
            "WARNING") color="warning" ;;
            "INFO") color="good" ;;
        esac
        
        local payload="{
            \"attachments\": [{
                \"color\": \"$color\",
                \"title\": \"Backup System $severity\",
                \"text\": \"Database: $DB_NAME\\n$message\",
                \"footer\": \"Backup Monitor\",
                \"ts\": $(date +%s)
            }]
        }"
        
        curl -X POST -H 'Content-type: application/json' \
             --data "$payload" \
             "$BACKUP_SLACK_WEBHOOK" >/dev/null 2>&1 || true
    fi
}

# ============================================================================
# MAIN EXECUTION
# ============================================================================

usage() {
    cat << EOF
Usage: $0 <action> [options]

Actions:
    health              Run all health checks
    freshness           Check backup freshness
    storage             Check storage health
    logs                Check backup logs
    wal                 Check WAL archiving
    encryption          Check encryption health
    metrics             Generate metrics
    status              Generate status report
    alert-test          Send test alert
    help                Show this help message

Options:
    --json              Output in JSON format
    --quiet             Suppress non-error output
    --send-alerts       Send alerts for issues found

Examples:
    $0 health
    $0 health --send-alerts
    $0 metrics
    $0 status --json

EOF
}

run_health_checks() {
    local send_alerts="${1:-false}"
    
    log_info "Running comprehensive backup health checks"
    
    local all_passed=true
    local issues=()
    
    # Run individual checks
    if ! check_backup_freshness; then
        all_passed=false
        issues+=("Backup freshness issues detected")
    fi
    
    if ! check_backup_storage; then
        all_passed=false
        issues+=("Backup storage issues detected")
    fi
    
    if ! check_backup_logs; then
        all_passed=false
        issues+=("Backup log issues detected")
    fi
    
    if ! check_wal_archiving; then
        all_passed=false
        issues+=("WAL archiving issues detected")
    fi
    
    if ! check_encryption_health; then
        all_passed=false
        issues+=("Encryption issues detected")
    fi
    
    # Generate metrics and status
    generate_backup_metrics
    generate_status_report
    
    # Send alerts if requested and there are issues
    if [[ "$send_alerts" == "true" && ${#issues[@]} -gt 0 ]]; then
        local alert_message="Backup system health issues detected:\n"
        for issue in "${issues[@]}"; do
            alert_message+="• $issue\n"
        done
        alert_message+="\nPlease check the backup system immediately."
        
        if [[ "$all_passed" == "false" ]]; then
            send_health_alert "CRITICAL" "$alert_message"
        else
            send_health_alert "WARNING" "$alert_message"
        fi
    fi
    
    # Summary
    if [[ "$all_passed" == "true" ]]; then
        log_info "✓ All backup health checks passed"
        [[ "$send_alerts" == "true" ]] && send_health_alert "INFO" "All backup system health checks passed successfully."
        return 0
    else
        log_error "✗ Some backup health checks failed"
        return 1
    fi
}

main() {
    local action="${1:-help}"
    local send_alerts=false
    
    # Parse options
    shift || true
    while [[ $# -gt 0 ]]; do
        case $1 in
            --send-alerts)
                send_alerts=true
                shift
                ;;
            --json)
                # JSON output mode (implemented in individual functions)
                shift
                ;;
            --quiet)
                # Quiet mode (redirect logs)
                exec 1>/dev/null
                shift
                ;;
            *)
                shift
                ;;
        esac
    done
    
    case "$action" in
        "health")
            run_health_checks "$send_alerts"
            ;;
        "freshness")
            check_backup_freshness
            ;;
        "storage")
            check_backup_storage
            ;;
        "logs")
            check_backup_logs
            ;;
        "wal")
            check_wal_archiving
            ;;
        "encryption")
            check_encryption_health
            ;;
        "metrics")
            generate_backup_metrics
            ;;
        "status")
            generate_status_report
            ;;
        "alert-test")
            send_health_alert "INFO" "This is a test alert from the backup monitoring system."
            ;;
        "help"|*)
            usage
            exit 0
            ;;
    esac
}

# Execute main function
main "$@"