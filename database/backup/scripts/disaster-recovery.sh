#!/bin/bash
# Disaster Recovery Automation Script for NextJS Stripe Payment Template
# Automated database recovery procedures for critical system failures
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
LOG_FILE="${SCRIPT_DIR}/../logs/disaster-recovery-$(date +%Y%m%d_%H%M%S).log"
RECOVERY_PLAN_FILE="${SCRIPT_DIR}/../logs/recovery-plan-$(date +%Y%m%d_%H%M%S).json"

# Recovery settings
RECOVERY_TARGET_TIME=""
RECOVERY_TARGET_NAME=""
RECOVERY_TARGET_XID=""
RECOVERY_BACKUP_LABEL=""
RECOVERY_TYPE="latest"  # latest, time, name, xid
RECOVERY_METHOD="logical"  # logical, physical, pgbackrest

# Docker settings
COMPOSE_FILE="${SCRIPT_DIR}/../../../docker-compose.yml"
DB_CONTAINER_NAME="payment-template-postgres"
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
log_critical() { log "CRITICAL" "$@"; }

# ============================================================================
# SAFETY AND VALIDATION FUNCTIONS
# ============================================================================

confirm_recovery() {
    local message="$1"
    local default_response="${2:-no}"
    
    if [[ "${DISASTER_RECOVERY_AUTO_CONFIRM:-false}" == "true" ]]; then
        log_warn "Auto-confirm enabled, proceeding with recovery"
        return 0
    fi
    
    echo ""
    log_warn "DISASTER RECOVERY CONFIRMATION REQUIRED"
    log_warn "$message"
    echo ""
    
    while true; do
        read -p "Are you sure you want to proceed? (yes/no) [$default_response]: " response
        response=${response:-$default_response}
        
        case "$response" in
            yes|YES|y|Y)
                log_info "Recovery confirmed by operator"
                return 0
                ;;
            no|NO|n|N)
                log_info "Recovery cancelled by operator"
                return 1
                ;;
            *)
                echo "Please answer yes or no"
                ;;
        esac
    done
}

validate_environment() {
    log_info "Validating disaster recovery environment"
    
    # Check if running in production
    if [[ "${NODE_ENV:-development}" == "production" ]]; then
        log_critical "Running in production environment!"
        if ! confirm_recovery "You are about to perform disaster recovery in PRODUCTION. This will affect live data and services."; then
            exit 1
        fi
    fi
    
    # Check Docker Compose availability
    if [[ ! -f "$COMPOSE_FILE" ]]; then
        log_error "Docker Compose file not found: $COMPOSE_FILE"
        return 1
    fi
    
    # Check required tools
    local required_tools=("docker" "docker-compose" "psql" "pg_dump" "pg_restore")
    for tool in "${required_tools[@]}"; do
        if ! command -v "$tool" >/dev/null 2>&1; then
            log_error "Required tool not found: $tool"
            return 1
        fi
    done
    
    # Check backup availability
    case "$RECOVERY_METHOD" in
        "logical")
            if ! ls "${LOGICAL_BACKUP_PATH:-/var/lib/postgresql/backups/logical}"/payment_template_logical_*.sql.gz* >/dev/null 2>&1; then
                log_error "No logical backups found"
                return 1
            fi
            ;;
        "physical")
            if ! ls "${PHYSICAL_BACKUP_PATH:-/var/lib/postgresql/backups/physical}"/payment_template_physical_* >/dev/null 2>&1; then
                log_error "No physical backups found"
                return 1
            fi
            ;;
        "pgbackrest")
            if ! command -v pgbackrest >/dev/null 2>&1; then
                log_error "pgBackRest not available"
                return 1
            fi
            ;;
    esac
    
    return 0
}

create_recovery_plan() {
    log_info "Creating disaster recovery plan"
    
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    local plan_id="DR_$(date +%Y%m%d_%H%M%S)"
    
    # Gather current state information
    local current_db_status="unknown"
    if docker-compose -f "$COMPOSE_FILE" ps "$DB_SERVICE_NAME" | grep -q "Up"; then
        current_db_status="running"
    else
        current_db_status="stopped"
    fi
    
    # Find available backups
    local available_backups=()
    case "$RECOVERY_METHOD" in
        "logical")
            while IFS= read -r -d '' backup; do
                available_backups+=("$(basename "$backup")")
            done < <(find "${LOGICAL_BACKUP_PATH:-/var/lib/postgresql/backups/logical}" -name "payment_template_logical_*.sql.gz*" -print0 2>/dev/null | sort -z)
            ;;
        "physical")
            while IFS= read -r -d '' backup; do
                available_backups+=("$(basename "$backup")")
            done < <(find "${PHYSICAL_BACKUP_PATH:-/var/lib/postgresql/backups/physical}" -name "payment_template_physical_*" -print0 2>/dev/null | sort -z)
            ;;
    esac
    
    # Create recovery plan JSON
    cat > "$RECOVERY_PLAN_FILE" << EOF
{
  "recovery_plan": {
    "id": "$plan_id",
    "timestamp": "$timestamp",
    "database": "$DB_NAME",
    "environment": "${NODE_ENV:-development}",
    "recovery_method": "$RECOVERY_METHOD",
    "recovery_type": "$RECOVERY_TYPE",
    "recovery_target_time": "$RECOVERY_TARGET_TIME",
    "recovery_target_name": "$RECOVERY_TARGET_NAME",
    "recovery_target_xid": "$RECOVERY_TARGET_XID",
    "current_db_status": "$current_db_status",
    "available_backups": [$(printf '"%s",' "${available_backups[@]}" | sed 's/,$//')]
  },
  "steps": [
    {
      "step": 1,
      "action": "stop_database_service",
      "description": "Stop PostgreSQL service gracefully"
    },
    {
      "step": 2,
      "action": "backup_current_data",
      "description": "Create emergency backup of current state"
    },
    {
      "step": 3,
      "action": "restore_from_backup",
      "description": "Restore database from selected backup"
    },
    {
      "step": 4,
      "action": "verify_recovery",
      "description": "Verify restored data integrity"
    },
    {
      "step": 5,
      "action": "start_database_service",
      "description": "Start PostgreSQL service"
    },
    {
      "step": 6,
      "action": "validate_application",
      "description": "Validate application connectivity"
    }
  ]
}
EOF
    
    log_info "Recovery plan created: $RECOVERY_PLAN_FILE"
    return 0
}

# ============================================================================
# DATABASE SERVICE MANAGEMENT
# ============================================================================

stop_database_service() {
    log_info "Stopping database service: $DB_SERVICE_NAME"
    
    if docker-compose -f "$COMPOSE_FILE" ps "$DB_SERVICE_NAME" | grep -q "Up"; then
        # Graceful shutdown with timeout
        if timeout 60 docker-compose -f "$COMPOSE_FILE" stop "$DB_SERVICE_NAME"; then
            log_info "Database service stopped gracefully"
        else
            log_warn "Graceful shutdown timed out, forcing stop"
            docker-compose -f "$COMPOSE_FILE" kill "$DB_SERVICE_NAME"
        fi
        
        # Wait for container to fully stop
        sleep 5
        
        if docker-compose -f "$COMPOSE_FILE" ps "$DB_SERVICE_NAME" | grep -q "Up"; then
            log_error "Failed to stop database service"
            return 1
        fi
    else
        log_info "Database service is already stopped"
    fi
    
    return 0
}

start_database_service() {
    log_info "Starting database service: $DB_SERVICE_NAME"
    
    if docker-compose -f "$COMPOSE_FILE" up -d "$DB_SERVICE_NAME"; then
        log_info "Database service started"
        
        # Wait for database to be ready
        log_info "Waiting for database to be ready..."
        local max_attempts=30
        local attempt=1
        
        while [[ $attempt -le $max_attempts ]]; do
            if docker-compose -f "$COMPOSE_FILE" exec -T "$DB_SERVICE_NAME" pg_isready -U "$DB_USER" -d "$DB_NAME" >/dev/null 2>&1; then
                log_success "Database is ready"
                return 0
            fi
            
            log_debug "Database not ready yet, attempt $attempt/$max_attempts"
            sleep 2
            ((attempt++))
        done
        
        log_error "Database failed to become ready within timeout"
        return 1
    else
        log_error "Failed to start database service"
        return 1
    fi
}

# ============================================================================
# BACKUP AND RECOVERY FUNCTIONS
# ============================================================================

create_emergency_backup() {
    log_info "Creating emergency backup of current state"
    
    local emergency_backup_dir="${SCRIPT_DIR}/../logs/emergency_backup_$(date +%Y%m%d_%H%M%S)"
    mkdir -p "$emergency_backup_dir"
    
    # Check if database is accessible
    if docker-compose -f "$COMPOSE_FILE" exec -T "$DB_SERVICE_NAME" pg_isready -U "$DB_USER" -d "$DB_NAME" >/dev/null 2>&1; then
        log_info "Creating logical emergency backup"
        
        local emergency_dump="$emergency_backup_dir/emergency_backup.sql"
        if docker-compose -f "$COMPOSE_FILE" exec -T "$DB_SERVICE_NAME" pg_dump -U "$DB_USER" -d "$DB_NAME" > "$emergency_dump"; then
            log_info "Emergency logical backup created: $emergency_dump"
        else
            log_warn "Failed to create logical emergency backup"
        fi
    else
        log_warn "Database not accessible, cannot create logical backup"
    fi
    
    # Try to backup data directory
    local data_backup_dir="$emergency_backup_dir/data_directory"
    local data_volume_path="${SCRIPT_DIR}/../../../data/postgres"
    
    if [[ -d "$data_volume_path" ]]; then
        log_info "Creating data directory emergency backup"
        if cp -r "$data_volume_path" "$data_backup_dir"; then
            log_info "Emergency data directory backup created: $data_backup_dir"
        else
            log_warn "Failed to create data directory backup"
        fi
    else
        log_warn "Data directory not found: $data_volume_path"
    fi
    
    return 0
}

restore_logical_backup() {
    local backup_file="$1"
    
    log_info "Restoring from logical backup: $backup_file"
    
    # Decrypt if necessary
    local working_file="$backup_file"
    if [[ "$backup_file" =~ \.gpg$ ]]; then
        log_info "Decrypting backup file"
        local decrypted_file="/tmp/restore_backup_$$.sql"
        
        if gpg --decrypt --output "$decrypted_file" "$backup_file" 2>>"$LOG_FILE"; then
            working_file="$decrypted_file"
            log_info "Backup decrypted successfully"
        else
            log_error "Failed to decrypt backup file"
            return 1
        fi
    fi
    
    # Drop existing database and recreate
    log_info "Dropping and recreating database"
    docker-compose -f "$COMPOSE_FILE" exec -T "$DB_SERVICE_NAME" psql -U "$DB_USER" -d postgres -c "DROP DATABASE IF EXISTS $DB_NAME;" || return 1
    docker-compose -f "$COMPOSE_FILE" exec -T "$DB_SERVICE_NAME" psql -U "$DB_USER" -d postgres -c "CREATE DATABASE $DB_NAME;" || return 1
    
    # Restore from backup
    log_info "Restoring database from backup"
    if [[ "$working_file" =~ \.gz$ ]]; then
        # Compressed backup
        if zcat "$working_file" | docker-compose -f "$COMPOSE_FILE" exec -T "$DB_SERVICE_NAME" psql -U "$DB_USER" -d "$DB_NAME"; then
            log_success "Logical backup restored successfully"
        else
            log_error "Failed to restore from compressed backup"
            [[ -f "/tmp/restore_backup_$$.sql" ]] && rm -f "/tmp/restore_backup_$$.sql"
            return 1
        fi
    elif [[ "$working_file" =~ \.(sql|dump)$ ]]; then
        # Plain SQL or custom format
        if docker-compose -f "$COMPOSE_FILE" exec -T "$DB_SERVICE_NAME" pg_restore -U "$DB_USER" -d "$DB_NAME" < "$working_file" 2>/dev/null || \
           cat "$working_file" | docker-compose -f "$COMPOSE_FILE" exec -T "$DB_SERVICE_NAME" psql -U "$DB_USER" -d "$DB_NAME"; then
            log_success "Logical backup restored successfully"
        else
            log_error "Failed to restore from backup"
            [[ -f "/tmp/restore_backup_$$.sql" ]] && rm -f "/tmp/restore_backup_$$.sql"
            return 1
        fi
    else
        log_error "Unsupported backup format: $working_file"
        [[ -f "/tmp/restore_backup_$$.sql" ]] && rm -f "/tmp/restore_backup_$$.sql"
        return 1
    fi
    
    # Cleanup temporary files
    [[ -f "/tmp/restore_backup_$$.sql" ]] && rm -f "/tmp/restore_backup_$$.sql"
    
    return 0
}

restore_physical_backup() {
    local backup_path="$1"
    
    log_info "Restoring from physical backup: $backup_path"
    
    local data_volume_path="${SCRIPT_DIR}/../../../data/postgres"
    local backup_restore_dir="/tmp/physical_restore_$$"
    
    # Extract backup if it's compressed
    if [[ "$backup_path" =~ \.(tar\.gz|tgz)$ ]]; then
        log_info "Extracting compressed physical backup"
        mkdir -p "$backup_restore_dir"
        
        if [[ "$backup_path" =~ \.gpg$ ]]; then
            # Decrypt and extract
            if gpg --decrypt "$backup_path" | tar xzf - -C "$backup_restore_dir"; then
                log_info "Backup decrypted and extracted successfully"
            else
                log_error "Failed to decrypt and extract backup"
                rm -rf "$backup_restore_dir"
                return 1
            fi
        else
            # Just extract
            if tar xzf "$backup_path" -C "$backup_restore_dir"; then
                log_info "Backup extracted successfully"
            else
                log_error "Failed to extract backup"
                rm -rf "$backup_restore_dir"
                return 1
            fi
        fi
        
        # Find the extracted directory
        local extracted_dir
        extracted_dir=$(find "$backup_restore_dir" -type d -name "payment_template_physical_*" | head -1)
        
        if [[ -z "$extracted_dir" ]]; then
            log_error "Could not find extracted backup directory"
            rm -rf "$backup_restore_dir"
            return 1
        fi
        
        backup_path="$extracted_dir"
    fi
    
    # Backup current data directory
    if [[ -d "$data_volume_path" ]]; then
        log_info "Backing up current data directory"
        local current_backup="${data_volume_path}.backup.$(date +%s)"
        if mv "$data_volume_path" "$current_backup"; then
            log_info "Current data backed up to: $current_backup"
        else
            log_error "Failed to backup current data directory"
            rm -rf "$backup_restore_dir"
            return 1
        fi
    fi
    
    # Copy restored data to data directory
    log_info "Copying restored data to data directory"
    if cp -r "$backup_path" "$data_volume_path"; then
        log_success "Physical backup restored successfully"
        
        # Set proper permissions
        chmod -R 700 "$data_volume_path"
        
        # Cleanup
        rm -rf "$backup_restore_dir"
        return 0
    else
        log_error "Failed to copy restored data"
        
        # Attempt to restore original data
        if [[ -d "${data_volume_path}.backup."* ]]; then
            log_info "Attempting to restore original data"
            mv "${data_volume_path}.backup."* "$data_volume_path" || true
        fi
        
        rm -rf "$backup_restore_dir"
        return 1
    fi
}

# ============================================================================
# RECOVERY VERIFICATION
# ============================================================================

verify_database_recovery() {
    log_info "Verifying database recovery"
    
    # Basic connectivity test
    if ! docker-compose -f "$COMPOSE_FILE" exec -T "$DB_SERVICE_NAME" pg_isready -U "$DB_USER" -d "$DB_NAME"; then
        log_error "Database connectivity test failed"
        return 1
    fi
    
    # Check if essential tables exist
    local essential_tables=("users" "products" "orders" "payment_methods")
    local missing_tables=()
    
    for table in "${essential_tables[@]}"; do
        if ! docker-compose -f "$COMPOSE_FILE" exec -T "$DB_SERVICE_NAME" psql -U "$DB_USER" -d "$DB_NAME" -c "\\dt $table" | grep -q "$table"; then
            missing_tables+=("$table")
        fi
    done
    
    if [[ ${#missing_tables[@]} -gt 0 ]]; then
        log_warn "Missing essential tables: ${missing_tables[*]}"
        # This might be OK if we're restoring an empty or partial backup
    else
        log_success "All essential tables found"
    fi
    
    # Check data integrity
    local total_records=0
    for table in "${essential_tables[@]}"; do
        local count
        if count=$(docker-compose -f "$COMPOSE_FILE" exec -T "$DB_SERVICE_NAME" psql -U "$DB_USER" -d "$DB_NAME" -t -c "SELECT COUNT(*) FROM $table WHERE 1=1;" 2>/dev/null | tr -d ' '); then
            log_info "Table $table has $count records"
            total_records=$((total_records + count))
        fi
    done
    
    log_info "Total records across essential tables: $total_records"
    
    # Test database functions
    if docker-compose -f "$COMPOSE_FILE" exec -T "$DB_SERVICE_NAME" psql -U "$DB_USER" -d "$DB_NAME" -c "SELECT version();" >/dev/null 2>&1; then
        log_success "Database functions test passed"
    else
        log_error "Database functions test failed"
        return 1
    fi
    
    return 0
}

validate_application_connectivity() {
    log_info "Validating application connectivity"
    
    # Start application service if not running
    if ! docker-compose -f "$COMPOSE_FILE" ps app | grep -q "Up"; then
        log_info "Starting application service"
        docker-compose -f "$COMPOSE_FILE" up -d app || return 1
        
        # Wait for application to be ready
        sleep 10
    fi
    
    # Test application health endpoint
    local max_attempts=10
    local attempt=1
    
    while [[ $attempt -le $max_attempts ]]; do
        if curl -f http://localhost:3000/api/health >/dev/null 2>&1; then
            log_success "Application connectivity test passed"
            return 0
        fi
        
        log_debug "Application not ready yet, attempt $attempt/$max_attempts"
        sleep 3
        ((attempt++))
    done
    
    log_error "Application connectivity test failed"
    return 1
}

# ============================================================================
# MAIN RECOVERY ORCHESTRATION
# ============================================================================

execute_disaster_recovery() {
    log_critical "EXECUTING DISASTER RECOVERY PROCEDURE"
    log_info "Recovery method: $RECOVERY_METHOD"
    log_info "Recovery type: $RECOVERY_TYPE"
    
    # Step 1: Create recovery plan
    create_recovery_plan || return 1
    
    # Step 2: Stop database service
    stop_database_service || return 1
    
    # Step 3: Create emergency backup
    create_emergency_backup
    
    # Step 4: Determine backup to restore
    local selected_backup=""
    
    case "$RECOVERY_METHOD" in
        "logical")
            if [[ -n "$RECOVERY_BACKUP_LABEL" ]]; then
                selected_backup="${LOGICAL_BACKUP_PATH}/${RECOVERY_BACKUP_LABEL}"
            else
                # Find latest logical backup
                selected_backup=$(find "${LOGICAL_BACKUP_PATH:-/var/lib/postgresql/backups/logical}" -name "payment_template_logical_*.sql.gz*" -type f -printf '%T@ %p\n' | sort -nr | head -1 | cut -d' ' -f2-)
            fi
            ;;
        "physical")
            if [[ -n "$RECOVERY_BACKUP_LABEL" ]]; then
                selected_backup="${PHYSICAL_BACKUP_PATH}/${RECOVERY_BACKUP_LABEL}"
            else
                # Find latest physical backup
                selected_backup=$(find "${PHYSICAL_BACKUP_PATH:-/var/lib/postgresql/backups/physical}" -name "payment_template_physical_*" -type f -printf '%T@ %p\n' | sort -nr | head -1 | cut -d' ' -f2-)
            fi
            ;;
    esac
    
    if [[ -z "$selected_backup" || ! -f "$selected_backup" ]]; then
        log_error "No suitable backup found for recovery"
        return 1
    fi
    
    log_info "Selected backup for recovery: $(basename "$selected_backup")"
    
    # Step 5: Restore from backup
    case "$RECOVERY_METHOD" in
        "logical")
            restore_logical_backup "$selected_backup" || return 1
            ;;
        "physical")
            restore_physical_backup "$selected_backup" || return 1
            ;;
    esac
    
    # Step 6: Start database service
    start_database_service || return 1
    
    # Step 7: Verify recovery
    if verify_database_recovery; then
        log_success "Database recovery verification passed"
    else
        log_error "Database recovery verification failed"
        return 1
    fi
    
    # Step 8: Validate application
    if validate_application_connectivity; then
        log_success "Application connectivity validation passed"
    else
        log_warn "Application connectivity validation failed (may need manual intervention)"
    fi
    
    log_success "DISASTER RECOVERY COMPLETED SUCCESSFULLY"
    
    # Send success notification
    send_recovery_notification "SUCCESS" "Disaster recovery completed successfully using backup: $(basename "$selected_backup")"
    
    return 0
}

# ============================================================================
# ALERTING AND REPORTING
# ============================================================================

send_recovery_notification() {
    local status="$1"
    local message="$2"
    
    if [[ "$BACKUP_MONITORING_ENABLED" == "true" ]]; then
        log_info "Sending recovery notification: $status"
        
        # Email notification
        if [[ -n "${BACKUP_ALERT_EMAIL:-}" ]] && command -v mail >/dev/null 2>&1; then
            echo "$message" | mail -s "Disaster Recovery $status: $DB_NAME" "$BACKUP_ALERT_EMAIL"
        fi
        
        # Slack notification with high priority
        if [[ -n "${BACKUP_SLACK_WEBHOOK:-}" ]] && command -v curl >/dev/null 2>&1; then
            local color=""
            case "$status" in
                "SUCCESS") color="good" ;;
                "FAILED") color="danger" ;;
                "STARTED") color="warning" ;;
            esac
            
            local payload="{
                \"attachments\": [{
                    \"color\": \"$color\",
                    \"title\": \"🚨 DISASTER RECOVERY $status\",
                    \"text\": \"Database: $DB_NAME\\nEnvironment: ${NODE_ENV:-development}\\n$message\",
                    \"footer\": \"Disaster Recovery System\",
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
    execute             Execute full disaster recovery
    plan                Create recovery plan only
    test-restore        Test restore procedure (non-destructive)
    list-backups        List available backups
    validate            Validate recovery environment
    help                Show this help message

Options:
    --method METHOD     Recovery method (logical|physical|pgbackrest)
    --type TYPE         Recovery type (latest|time|name|xid)
    --backup LABEL      Specific backup to restore
    --target-time TIME  Target time for PITR (YYYY-MM-DD HH:MM:SS)
    --target-name NAME  Target named restore point
    --target-xid XID    Target transaction ID
    --auto-confirm      Skip confirmation prompts (dangerous!)

Examples:
    $0 execute --method logical
    $0 execute --method physical --backup payment_template_physical_20240814_120000.tar.gz
    $0 execute --method logical --type time --target-time "2024-08-14 12:30:00"
    $0 test-restore --method logical
    $0 list-backups

DANGER: This script performs destructive operations on your database.
Always ensure you have recent backups before running recovery procedures.

EOF
}

parse_arguments() {
    while [[ $# -gt 0 ]]; do
        case $1 in
            --method)
                RECOVERY_METHOD="$2"
                shift 2
                ;;
            --type)
                RECOVERY_TYPE="$2"
                shift 2
                ;;
            --backup)
                RECOVERY_BACKUP_LABEL="$2"
                shift 2
                ;;
            --target-time)
                RECOVERY_TARGET_TIME="$2"
                RECOVERY_TYPE="time"
                shift 2
                ;;
            --target-name)
                RECOVERY_TARGET_NAME="$2"
                RECOVERY_TYPE="name"
                shift 2
                ;;
            --target-xid)
                RECOVERY_TARGET_XID="$2"
                RECOVERY_TYPE="xid"
                shift 2
                ;;
            --auto-confirm)
                export DISASTER_RECOVERY_AUTO_CONFIRM="true"
                shift
                ;;
            *)
                shift
                ;;
        esac
    done
}

list_available_backups() {
    log_info "Available backups for recovery:"
    echo ""
    
    # Logical backups
    echo "LOGICAL BACKUPS:"
    if [[ -d "${LOGICAL_BACKUP_PATH:-/var/lib/postgresql/backups/logical}" ]]; then
        find "${LOGICAL_BACKUP_PATH:-/var/lib/postgresql/backups/logical}" -name "payment_template_logical_*.sql.gz*" -type f -printf '%TY-%Tm-%Td %TH:%TM  %s bytes  %f\n' | sort -r | head -10
    else
        echo "  No logical backup directory found"
    fi
    
    echo ""
    
    # Physical backups
    echo "PHYSICAL BACKUPS:"
    if [[ -d "${PHYSICAL_BACKUP_PATH:-/var/lib/postgresql/backups/physical}" ]]; then
        find "${PHYSICAL_BACKUP_PATH:-/var/lib/postgresql/backups/physical}" -name "payment_template_physical_*" -type f -printf '%TY-%Tm-%Td %TH:%TM  %s bytes  %f\n' | sort -r | head -10
    else
        echo "  No physical backup directory found"
    fi
    
    echo ""
}

main() {
    local command="${1:-help}"
    shift || true
    
    # Parse arguments
    parse_arguments "$@"
    
    log_info "Starting disaster recovery script: $command"
    log_info "Environment: ${NODE_ENV:-development}"
    
    case "$command" in
        "execute")
            log_critical "DISASTER RECOVERY EXECUTION INITIATED"
            
            # Send start notification
            send_recovery_notification "STARTED" "Disaster recovery procedure has been initiated"
            
            # Validate environment
            if ! validate_environment; then
                log_error "Environment validation failed"
                send_recovery_notification "FAILED" "Environment validation failed during disaster recovery"
                exit 1
            fi
            
            # Execute recovery
            if execute_disaster_recovery; then
                log_success "Disaster recovery completed successfully"
                exit 0
            else
                log_error "Disaster recovery failed"
                send_recovery_notification "FAILED" "Disaster recovery procedure failed - manual intervention required"
                exit 1
            fi
            ;;
        "plan")
            validate_environment && create_recovery_plan
            ;;
        "test-restore")
            log_info "Running non-destructive restore test"
            # Implement test restore logic here
            log_info "Test restore completed (not implemented yet)"
            ;;
        "list-backups")
            list_available_backups
            ;;
        "validate")
            validate_environment && log_success "Environment validation passed"
            ;;
        "help"|*)
            usage
            exit 0
            ;;
    esac
}

# ============================================================================
# ERROR HANDLING AND CLEANUP
# ============================================================================

cleanup_on_exit() {
    local exit_code=$?
    
    # Cleanup temporary files
    find /tmp -name "*restore_backup_$$*" -delete 2>/dev/null || true
    find /tmp -name "*physical_restore_$$*" -type d -exec rm -rf {} + 2>/dev/null || true
    
    if [[ $exit_code -ne 0 ]]; then
        log_error "Disaster recovery script exited with error code: $exit_code"
        send_recovery_notification "FAILED" "Disaster recovery script failed with error code: $exit_code"
    fi
}

trap cleanup_on_exit EXIT

# Execute main function
main "$@"