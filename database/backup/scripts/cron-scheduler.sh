#!/bin/bash
# Cron Scheduler Setup for Backup Operations
# NextJS Stripe Payment Template - Automated Backup Scheduling
# Author: Backend Reliability Engineer
# Version: 1.0.0

set -euo pipefail

# ============================================================================
# CONFIGURATION
# ============================================================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKUP_USER="$(whoami)"
CRON_FILE="/tmp/backup_cron_$$"

# ============================================================================
# CRON JOB DEFINITIONS
# ============================================================================

create_backup_cron_jobs() {
    cat > "$CRON_FILE" << 'EOF'
# NextJS Stripe Payment Template - Backup Automation
# Generated automatically - do not edit manually

# Logical backups - Daily at 2:00 AM
0 2 * * * /home/gabrieldev/Dev/nextJsApp/payment-integration-template/database/backup/scripts/logical-backup.sh >> /home/gabrieldev/Dev/nextJsApp/payment-integration-template/database/backup/logs/cron.log 2>&1

# Physical backups - Weekly on Sunday at 3:00 AM
0 3 * * 0 /home/gabrieldev/Dev/nextJsApp/payment-integration-template/database/backup/scripts/physical-backup.sh >> /home/gabrieldev/Dev/nextJsApp/payment-integration-template/database/backup/logs/cron.log 2>&1

# WAL archive cleanup - Daily at 4:00 AM
0 4 * * * /home/gabrieldev/Dev/nextJsApp/payment-integration-template/database/backup/scripts/wal-archive-cleanup.sh cleanup >> /home/gabrieldev/Dev/nextJsApp/payment-integration-template/database/backup/logs/cron.log 2>&1

# Backup monitoring - Every 6 hours
0 */6 * * * /home/gabrieldev/Dev/nextJsApp/payment-integration-template/database/backup/scripts/backup-monitor.sh health --send-alerts >> /home/gabrieldev/Dev/nextJsApp/payment-integration-template/database/backup/logs/cron.log 2>&1

# Backup verification - Daily at 5:00 AM
0 5 * * * /home/gabrieldev/Dev/nextJsApp/payment-integration-template/database/backup/scripts/backup-verification.sh logical >> /home/gabrieldev/Dev/nextJsApp/payment-integration-template/database/backup/logs/cron.log 2>&1

# Comprehensive verification - Weekly on Saturday at 1:00 AM
0 1 * * 6 /home/gabrieldev/Dev/nextJsApp/payment-integration-template/database/backup/scripts/backup-verification.sh all >> /home/gabrieldev/Dev/nextJsApp/payment-integration-template/database/backup/logs/cron.log 2>&1

# PITR testing - Monthly on first Sunday at 6:00 AM
0 6 1-7 * 0 /home/gabrieldev/Dev/nextJsApp/payment-integration-template/database/backup/scripts/pitr-test.sh all >> /home/gabrieldev/Dev/nextJsApp/payment-integration-template/database/backup/logs/cron.log 2>&1

# pgBackRest operations (if enabled)
# Full backup - Weekly on Sunday at 1:30 AM
30 1 * * 0 /home/gabrieldev/Dev/nextJsApp/payment-integration-template/database/backup/scripts/pgbackrest-wrapper.sh backup-full >> /home/gabrieldev/Dev/nextJsApp/payment-integration-template/database/backup/logs/cron.log 2>&1

# Differential backup - Daily at 2:30 AM (except Sunday)
30 2 * * 1-6 /home/gabrieldev/Dev/nextJsApp/payment-integration-template/database/backup/scripts/pgbackrest-wrapper.sh backup-diff >> /home/gabrieldev/Dev/nextJsApp/payment-integration-template/database/backup/logs/cron.log 2>&1

# Incremental backup - Every 6 hours
0 */6 * * * /home/gabrieldev/Dev/nextJsApp/payment-integration-template/database/backup/scripts/pgbackrest-wrapper.sh backup-incr >> /home/gabrieldev/Dev/nextJsApp/payment-integration-template/database/backup/logs/cron.log 2>&1

EOF
}

# ============================================================================
# INSTALLATION FUNCTIONS
# ============================================================================

install_cron_jobs() {
    echo "Installing backup cron jobs..."
    
    # Create log directory
    mkdir -p "${SCRIPT_DIR}/../logs"
    
    # Create cron jobs
    create_backup_cron_jobs
    
    # Install the cron jobs
    if crontab "$CRON_FILE"; then
        echo "Backup cron jobs installed successfully"
        
        # Verify installation
        echo "Current cron jobs:"
        crontab -l | grep -E "(backup|pitr|pgbackrest)" || true
        
    else
        echo "Failed to install cron jobs"
        rm -f "$CRON_FILE"
        return 1
    fi
    
    # Cleanup
    rm -f "$CRON_FILE"
    
    return 0
}

remove_cron_jobs() {
    echo "Removing backup cron jobs..."
    
    # Get current crontab
    if crontab -l > "$CRON_FILE" 2>/dev/null; then
        # Remove backup-related jobs
        grep -v -E "(backup|pitr|pgbackrest|NextJS Stripe Payment Template)" "$CRON_FILE" > "${CRON_FILE}.new" || true
        
        # Install modified crontab
        if crontab "${CRON_FILE}.new"; then
            echo "Backup cron jobs removed successfully"
        else
            echo "Failed to remove cron jobs"
            rm -f "$CRON_FILE" "${CRON_FILE}.new"
            return 1
        fi
        
        rm -f "$CRON_FILE" "${CRON_FILE}.new"
    else
        echo "No existing crontab found"
    fi
    
    return 0
}

list_cron_jobs() {
    echo "Current backup-related cron jobs:"
    echo "=================================="
    
    if crontab -l 2>/dev/null | grep -E "(backup|pitr|pgbackrest)"; then
        echo ""
        echo "Cron jobs found and listed above"
    else
        echo "No backup-related cron jobs found"
    fi
}

create_systemd_timers() {
    echo "Creating systemd timer units..."
    
    local timer_dir="$HOME/.config/systemd/user"
    mkdir -p "$timer_dir"
    
    # Logical backup timer
    cat > "$timer_dir/backup-logical.timer" << EOF
[Unit]
Description=Daily Logical Backup
Requires=backup-logical.service

[Timer]
OnCalendar=daily
Persistent=true

[Install]
WantedBy=timers.target
EOF
    
    # Logical backup service
    cat > "$timer_dir/backup-logical.service" << EOF
[Unit]
Description=Logical Backup Service
After=docker.service

[Service]
Type=oneshot
ExecStart=${SCRIPT_DIR}/logical-backup.sh
User=$BACKUP_USER
StandardOutput=append:${SCRIPT_DIR}/../logs/systemd.log
StandardError=append:${SCRIPT_DIR}/../logs/systemd.log
EOF
    
    # Physical backup timer
    cat > "$timer_dir/backup-physical.timer" << EOF
[Unit]
Description=Weekly Physical Backup
Requires=backup-physical.service

[Timer]
OnCalendar=Sun *-*-* 03:00:00
Persistent=true

[Install]
WantedBy=timers.target
EOF
    
    # Physical backup service
    cat > "$timer_dir/backup-physical.service" << EOF
[Unit]
Description=Physical Backup Service
After=docker.service

[Service]
Type=oneshot
ExecStart=${SCRIPT_DIR}/physical-backup.sh
User=$BACKUP_USER
StandardOutput=append:${SCRIPT_DIR}/../logs/systemd.log
StandardError=append:${SCRIPT_DIR}/../logs/systemd.log
EOF
    
    # Monitoring timer
    cat > "$timer_dir/backup-monitor.timer" << EOF
[Unit]
Description=Backup Health Monitoring
Requires=backup-monitor.service

[Timer]
OnCalendar=*-*-* 00,06,12,18:00:00
Persistent=true

[Install]
WantedBy=timers.target
EOF
    
    # Monitoring service
    cat > "$timer_dir/backup-monitor.service" << EOF
[Unit]
Description=Backup Monitoring Service
After=docker.service

[Service]
Type=oneshot
ExecStart=${SCRIPT_DIR}/backup-monitor.sh health --send-alerts
User=$BACKUP_USER
StandardOutput=append:${SCRIPT_DIR}/../logs/systemd.log
StandardError=append:${SCRIPT_DIR}/../logs/systemd.log
EOF
    
    echo "Systemd timer units created in $timer_dir"
    echo "To enable them, run:"
    echo "  systemctl --user daemon-reload"
    echo "  systemctl --user enable backup-logical.timer"
    echo "  systemctl --user enable backup-physical.timer"
    echo "  systemctl --user enable backup-monitor.timer"
    echo "  systemctl --user start backup-logical.timer"
    echo "  systemctl --user start backup-physical.timer"
    echo "  systemctl --user start backup-monitor.timer"
}

# ============================================================================
# DOCKER COMPOSE BACKUP SERVICE
# ============================================================================

create_backup_service_compose() {
    local compose_backup_file="${SCRIPT_DIR}/../../../docker-compose.backup.yml"
    
    cat > "$compose_backup_file" << EOF
# Docker Compose configuration for backup services
# NextJS Stripe Payment Template - Backup Infrastructure
version: "3.8"

services:
  # ============================================================================
  # BACKUP SCHEDULER SERVICE
  # ============================================================================
  backup-scheduler:
    build:
      context: .
      dockerfile: database/backup/Dockerfile.scheduler
    container_name: payment-template-backup-scheduler
    environment:
      - NODE_ENV=\${NODE_ENV:-development}
      - DATABASE_URL=postgresql://postgres:\${POSTGRES_PASSWORD:-secure_dev_password_2024}@postgres:5432/payment_template_dev
      - BACKUP_ENCRYPTION_ENABLED=true
      - BACKUP_GPG_RECIPIENT=backup@payment-template.local
      - BACKUP_MONITORING_ENABLED=true
      - BACKUP_ALERT_EMAIL=\${BACKUP_ALERT_EMAIL:-}
      - BACKUP_SLACK_WEBHOOK=\${BACKUP_SLACK_WEBHOOK:-}
    volumes:
      - ./database/backup:/app/backup
      - ./data/backups:/var/lib/postgresql/backups
      - /var/run/docker.sock:/var/run/docker.sock
    networks:
      - app-network
    depends_on:
      postgres:
        condition: service_healthy
    restart: unless-stopped
    command: crond -f -l 2
    healthcheck:
      test: ["CMD", "pgrep", "crond"]
      interval: 30s
      timeout: 10s
      retries: 3
    deploy:
      resources:
        limits:
          cpus: "0.5"
          memory: 512M
        reservations:
          cpus: "0.1"
          memory: 128M

  # ============================================================================
  # PGBACKREST SERVICE
  # ============================================================================
  pgbackrest:
    image: pgbackrest/pgbackrest:latest
    container_name: payment-template-pgbackrest
    environment:
      - PGBACKREST_CONFIG=/etc/pgbackrest/pgbackrest.conf
      - PGBACKREST_STANZA=payment-template
    volumes:
      - ./database/config/pgbackrest.conf:/etc/pgbackrest/pgbackrest.conf:ro
      - ./data/backups/pgbackrest:/var/lib/pgbackrest
      - ./database/backup/logs:/var/log/pgbackrest
    networks:
      - app-network
    depends_on:
      postgres:
        condition: service_healthy
    restart: unless-stopped
    command: tail -f /dev/null
    profiles:
      - backups
    deploy:
      resources:
        limits:
          cpus: "1.0"
          memory: 1G
        reservations:
          cpus: "0.25"
          memory: 256M

  # ============================================================================
  # BACKUP MONITORING SERVICE
  # ============================================================================
  backup-monitor:
    build:
      context: .
      dockerfile: database/backup/Dockerfile.monitor
    container_name: payment-template-backup-monitor
    environment:
      - NODE_ENV=\${NODE_ENV:-development}
      - BACKUP_MONITORING_ENABLED=true
      - BACKUP_ALERT_EMAIL=\${BACKUP_ALERT_EMAIL:-}
      - BACKUP_SLACK_WEBHOOK=\${BACKUP_SLACK_WEBHOOK:-}
    volumes:
      - ./database/backup:/app/backup
      - ./data/backups:/var/lib/postgresql/backups
    networks:
      - app-network
    depends_on:
      - postgres
    restart: unless-stopped
    command: /app/backup/scripts/backup-monitor.sh health --send-alerts
    healthcheck:
      test: ["CMD", "/app/backup/scripts/backup-monitor.sh", "status"]
      interval: 60s
      timeout: 30s
      retries: 3
    profiles:
      - monitoring
    deploy:
      resources:
        limits:
          cpus: "0.25"
          memory: 256M
        reservations:
          cpus: "0.05"
          memory: 64M

# ============================================================================
# NETWORKS
# ============================================================================
networks:
  app-network:
    external: true

# ============================================================================
# VOLUMES
# ============================================================================
volumes:
  backup_data:
    driver: local
    driver_opts:
      type: none
      o: bind
      device: ./data/backups
EOF
    
    echo "Backup services Docker Compose file created: $compose_backup_file"
    echo ""
    echo "To start backup services:"
    echo "  docker-compose -f docker-compose.yml -f docker-compose.backup.yml up -d"
    echo ""
    echo "To start with monitoring:"
    echo "  docker-compose -f docker-compose.yml -f docker-compose.backup.yml --profile monitoring up -d"
    echo ""
    echo "To start with pgBackRest:"
    echo "  docker-compose -f docker-compose.yml -f docker-compose.backup.yml --profile backups up -d"
}

# ============================================================================
# MAIN EXECUTION
# ============================================================================

usage() {
    cat << EOF
Usage: $0 <command>

Commands:
    install-cron        Install cron jobs for backup automation
    remove-cron         Remove backup cron jobs
    list-cron           List current backup cron jobs
    install-systemd     Create systemd timer units
    create-compose      Create Docker Compose backup services
    help               Show this help message

Examples:
    $0 install-cron
    $0 create-compose
    $0 list-cron

EOF
}

main() {
    local command="${1:-help}"
    
    case "$command" in
        "install-cron")
            install_cron_jobs
            ;;
        "remove-cron")
            remove_cron_jobs
            ;;
        "list-cron")
            list_cron_jobs
            ;;
        "install-systemd")
            create_systemd_timers
            ;;
        "create-compose")
            create_backup_service_compose
            ;;
        "help"|*)
            usage
            ;;
    esac
}

main "$@"