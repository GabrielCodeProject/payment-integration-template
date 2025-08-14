# Backup and Recovery System Documentation

# NextJS Stripe Payment Template

## Overview

This document describes the comprehensive backup and recovery system implemented for the NextJS
Stripe Payment Template. The system provides multiple layers of data protection for PostgreSQL
databases handling sensitive payment information.

## Architecture

### Components

1. **Automated Backup Scripts**
   - Logical backups using `pg_dump`
   - Physical backups using `pg_basebackup`
   - WAL archiving for point-in-time recovery
   - pgBackRest integration for advanced features

2. **Monitoring and Verification**
   - Health monitoring and alerting
   - Backup verification and integrity testing
   - Point-in-time recovery testing
   - Comprehensive reporting

3. **Security Features**
   - GPG encryption for sensitive data
   - Access control and authentication
   - Audit logging of all operations
   - Compliance with payment data regulations

4. **Disaster Recovery**
   - Automated recovery procedures
   - Multiple recovery scenarios supported
   - Emergency runbooks and procedures
   - Infrastructure failover capabilities

## File Structure

```
database/
├── backup/
│   ├── config/
│   │   ├── backup.conf                 # Main backup configuration
│   │   └── pgbackrest.conf            # pgBackRest configuration
│   ├── scripts/
│   │   ├── logical-backup.sh          # Daily logical backups
│   │   ├── physical-backup.sh         # Weekly physical backups
│   │   ├── wal-archive-cleanup.sh     # WAL management
│   │   ├── pgbackrest-wrapper.sh      # pgBackRest operations
│   │   ├── pitr-test.sh              # Point-in-time recovery testing
│   │   ├── backup-monitor.sh         # Health monitoring
│   │   ├── backup-verification.sh    # Comprehensive verification
│   │   ├── disaster-recovery.sh      # Emergency recovery procedures
│   │   └── cron-scheduler.sh         # Scheduling automation
│   ├── storage/                      # Backup file storage
│   └── logs/                        # Operation logs and reports
├── config/
│   └── postgresql.conf              # Enhanced PostgreSQL config
└── init/                           # Database initialization scripts

docs/
├── disaster-recovery-runbook.md    # Emergency procedures
└── backup-recovery-system.md      # This document

data/
└── backups/
    ├── logical/                    # Logical backup files
    ├── physical/                   # Physical backup archives
    ├── wal/                       # WAL archive files
    └── encrypted/                 # Encrypted backup storage
```

## Backup Types

### 1. Logical Backups

- **Frequency**: Daily at 2:00 AM
- **Retention**: 30 days
- **Method**: `pg_dump` with custom format
- **Compression**: Level 9 gzip compression
- **Encryption**: GPG encryption enabled
- **Features**:
  - Platform independent
  - Selective restore capability
  - Data consistency guaranteed
  - Includes schema and data

### 2. Physical Backups

- **Frequency**: Weekly on Sunday at 3:00 AM
- **Retention**: 7 backups (7 weeks)
- **Method**: `pg_basebackup` with WAL streaming
- **Compression**: tar.gz format
- **Encryption**: GPG encryption enabled
- **Features**:
  - Fast backup and restore
  - Complete cluster backup
  - WAL replay capability
  - Point-in-time recovery ready

### 3. WAL Archiving

- **Mode**: Continuous archiving
- **Retention**: 14 days
- **Cleanup**: Daily at 4:00 AM
- **Features**:
  - Enables point-in-time recovery
  - Minimal data loss (5-minute RPO)
  - Continuous protection
  - Automatic verification

### 4. pgBackRest (Advanced)

- **Full Backup**: Weekly on Sunday at 1:30 AM
- **Differential**: Daily at 2:30 AM (except Sunday)
- **Incremental**: Every 6 hours
- **Features**:
  - Parallel processing
  - Delta compression
  - Multiple retention policies
  - Built-in verification

## Security Implementation

### Encryption

- **Algorithm**: AES-256-CBC
- **Key Management**: GPG key-based encryption
- **Data Protection**: All backups containing sensitive data are encrypted
- **Key Storage**: Secure key management for production environments

### Access Control

- **File Permissions**: Restrictive permissions (600) on backup files
- **User Authentication**: Dedicated backup user accounts
- **Database Authentication**: Separate replication user for physical backups
- **Audit Trail**: All operations logged and auditable

### Compliance

- **PCI DSS**: Encrypted storage of payment data backups
- **Data Retention**: Configurable retention policies
- **Secure Deletion**: Automated cleanup of expired backups
- **Access Logging**: Complete audit trail of backup operations

## Monitoring and Alerting

### Health Checks

- **Backup Freshness**: Alerts if backups are too old
- **Storage Space**: Monitoring of backup storage capacity
- **Process Status**: Verification of backup service health
- **Data Integrity**: Regular backup verification tests

### Alert Channels

- **Email Notifications**: Critical alerts via email
- **Slack Integration**: Real-time notifications to team channels
- **Log Files**: Detailed logging for troubleshooting
- **Metrics**: JSON-formatted metrics for monitoring systems

### Monitoring Schedule

- **Health Checks**: Every 6 hours
- **Verification Tests**: Daily for logical backups, weekly comprehensive
- **Recovery Tests**: Monthly point-in-time recovery testing
- **Reporting**: Weekly backup status reports

## Recovery Procedures

### Recovery Time Objectives (RTO)

- **Service Restart**: 5 minutes
- **Logical Restore**: 30 minutes
- **Physical Restore**: 45 minutes
- **Point-in-Time Recovery**: 60 minutes
- **Infrastructure Rebuild**: 90 minutes

### Recovery Point Objectives (RPO)

- **Standard Backups**: 24 hours maximum data loss
- **WAL Archiving**: 5 minutes maximum data loss
- **Real-time Scenarios**: Near-zero data loss with proper WAL management

### Supported Recovery Scenarios

1. **Database Corruption** - Service failing but data directory intact
2. **Complete Data Loss** - Full data directory reconstruction needed
3. **Point-in-Time Recovery** - Restore to specific timestamp
4. **Logical Corruption** - Data inconsistencies requiring clean restore
5. **Infrastructure Failure** - Complete environment rebuild

## Configuration

### Main Configuration (`database/config/backup.conf`)

```bash
# Backup retention policies
LOGICAL_BACKUP_RETENTION_DAYS=30
PHYSICAL_BACKUP_RETENTION_DAYS=7
WAL_ARCHIVE_RETENTION_DAYS=14

# Security configuration
BACKUP_ENCRYPTION_ENABLED=true
BACKUP_ENCRYPTION_ALGORITHM="AES256"
BACKUP_GPG_RECIPIENT="backup@payment-template.local"

# Monitoring settings
BACKUP_MONITORING_ENABLED=true
BACKUP_ALERT_EMAIL="admin@payment-template.local"
BACKUP_SLACK_WEBHOOK=""
```

### PostgreSQL Configuration Enhancements

- WAL archiving enabled
- Appropriate WAL levels for replication
- Performance tuning for backup operations
- Security settings for backup access

## Usage Examples

### Manual Backup Operations

```bash
# Create logical backup
./database/backup/scripts/logical-backup.sh

# Create physical backup
./database/backup/scripts/physical-backup.sh

# Check backup health
./database/backup/scripts/backup-monitor.sh health

# Verify backups
./database/backup/scripts/backup-verification.sh all

# Test point-in-time recovery
./database/backup/scripts/pitr-test.sh all
```

### Disaster Recovery

```bash
# Execute disaster recovery
./database/backup/scripts/disaster-recovery.sh execute --method logical

# Restore to specific point in time
./database/backup/scripts/disaster-recovery.sh execute \
  --method physical --type time --target-time "2024-08-14 14:30:00"

# List available backups
./database/backup/scripts/disaster-recovery.sh list-backups
```

### pgBackRest Operations

```bash
# Initialize pgBackRest
./database/backup/scripts/pgbackrest-wrapper.sh init

# Create full backup
./database/backup/scripts/pgbackrest-wrapper.sh backup-full

# Restore database
./database/backup/scripts/pgbackrest-wrapper.sh restore latest /tmp/restore
```

## Scheduling and Automation

### Cron Jobs

The system provides automated scheduling via cron jobs:

```bash
# Install backup cron jobs
./database/backup/scripts/cron-scheduler.sh install-cron

# List current backup jobs
./database/backup/scripts/cron-scheduler.sh list-cron

# Remove backup jobs
./database/backup/scripts/cron-scheduler.sh remove-cron
```

### Docker Integration

Enhanced Docker Compose configuration includes:

- Backup storage volume mounts
- WAL archiving configuration
- Backup script access
- Service dependencies

### Systemd Timers (Alternative)

For systemd-based environments:

```bash
# Create systemd timer units
./database/backup/scripts/cron-scheduler.sh install-systemd
```

## Testing and Validation

### Verification Tests

- **Backup Integrity**: File format and structure validation
- **Restore Testing**: Automated restore to temporary databases
- **Data Consistency**: Schema and data verification
- **End-to-End**: Complete backup and recovery cycle testing

### Regular Testing Schedule

- **Daily**: Basic backup verification
- **Weekly**: Comprehensive backup testing
- **Monthly**: Full disaster recovery testing
- **Quarterly**: Infrastructure failover testing

## Troubleshooting

### Common Issues

1. **Backup Failures**
   - Check disk space
   - Verify database connectivity
   - Review error logs
   - Validate permissions

2. **Encryption Issues**
   - Verify GPG key availability
   - Check key permissions
   - Test encryption/decryption

3. **Recovery Problems**
   - Validate backup integrity
   - Check PostgreSQL version compatibility
   - Verify data directory permissions

### Log Locations

- **Backup Operations**: `./database/backup/logs/`
- **PostgreSQL**: Docker container logs
- **System**: `/var/log/` or systemd journal

### Support Resources

- Disaster Recovery Runbook: `docs/disaster-recovery-runbook.md`
- Script Documentation: Inline comments in all scripts
- Configuration Reference: `database/config/backup.conf`

## Maintenance

### Regular Tasks

- **Weekly**: Review backup reports
- **Monthly**: Test disaster recovery procedures
- **Quarterly**: Update contact information and procedures
- **Annually**: Full system audit and compliance review

### Upgrade Procedures

- Test backup compatibility with new PostgreSQL versions
- Validate script functionality after system updates
- Update encryption keys and security credentials
- Review and update retention policies

## Production Deployment

### Prerequisites

- PostgreSQL 15+ with appropriate permissions
- Docker and Docker Compose
- GPG for encryption
- Sufficient storage for backups
- Network access for notifications

### Initial Setup

1. Configure backup settings in `backup.conf`
2. Generate and configure GPG keys
3. Test backup and recovery procedures
4. Setup monitoring and alerting
5. Schedule automated backups
6. Document custom configurations

### Security Checklist

- [ ] GPG keys properly generated and secured
- [ ] Backup file permissions configured (600)
- [ ] Database authentication properly configured
- [ ] Audit logging enabled
- [ ] Alert channels tested
- [ ] Access controls implemented
- [ ] Compliance requirements verified

---

**Last Updated**: August 2024 **Version**: 1.0.0 **Maintainer**: Backend Reliability Team
