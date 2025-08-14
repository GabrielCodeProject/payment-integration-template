# Disaster Recovery Runbook

# NextJS Stripe Payment Template - Database Recovery Procedures

## Overview

This runbook provides step-by-step procedures for database disaster recovery in the NextJS Stripe
Payment Template. It covers various failure scenarios and their corresponding recovery procedures.

**CRITICAL:** This system processes sensitive payment data. All recovery procedures must maintain
data security and compliance requirements.

## Emergency Contacts

| Role                   | Contact | Phone   | Email   | Escalation    |
| ---------------------- | ------- | ------- | ------- | ------------- |
| Database Administrator | [Name]  | [Phone] | [Email] | Primary       |
| Backend Team Lead      | [Name]  | [Phone] | [Email] | Secondary     |
| Infrastructure Lead    | [Name]  | [Phone] | [Email] | Tertiary      |
| Security Officer       | [Name]  | [Phone] | [Email] | Always notify |

## Quick Reference

### Emergency Commands

```bash
# Stop database service
docker-compose -f docker-compose.yml stop postgres

# Start database service
docker-compose -f docker-compose.yml up -d postgres

# Check database status
docker-compose -f docker-compose.yml ps postgres

# Execute disaster recovery
./database/backup/scripts/disaster-recovery.sh execute --method logical

# Check backup status
./database/backup/scripts/backup-monitor.sh health
```

### Critical File Locations

- Backups: `/data/backups/`
- Scripts: `./database/backup/scripts/`
- Logs: `./database/backup/logs/`
- Config: `./database/config/backup.conf`

## Failure Scenarios and Recovery Procedures

### Scenario 1: Database Corruption (Data Intact but Service Failing)

**Symptoms:**

- Database service won't start
- Connection errors
- Corruption errors in logs

**Recovery Steps:**

1. **Immediate Assessment (5 minutes)**

   ```bash
   # Check service status
   docker-compose ps postgres

   # Check logs for error messages
   docker-compose logs postgres --tail 50

   # Verify data directory integrity
   ls -la ./data/postgres/
   ```

2. **Attempt Simple Recovery (10 minutes)**

   ```bash
   # Stop the service
   docker-compose stop postgres

   # Try starting with recovery mode
   docker-compose up postgres

   # If successful, verify database connectivity
   docker-compose exec postgres pg_isready -U postgres -d payment_template_dev
   ```

3. **If Simple Recovery Fails - Logical Restore (30 minutes)**

   ```bash
   # Find latest logical backup
   ./database/backup/scripts/disaster-recovery.sh list-backups

   # Execute logical recovery
   ./database/backup/scripts/disaster-recovery.sh execute --method logical

   # Verify recovery
   ./database/backup/scripts/backup-verification.sh logical
   ```

### Scenario 2: Complete Data Directory Loss

**Symptoms:**

- Data directory missing or completely corrupted
- Cannot start database service
- File system errors

**Recovery Steps:**

1. **Immediate Response (2 minutes)**

   ```bash
   # Document the incident
   echo "$(date): Data directory loss detected" >> incident.log

   # Notify security team (payment data involved)
   # Send incident notification

   # Stop all services
   docker-compose down
   ```

2. **Assess Available Backups (5 minutes)**

   ```bash
   # List available backups
   ./database/backup/scripts/disaster-recovery.sh list-backups

   # Check backup verification status
   ./database/backup/scripts/backup-monitor.sh status
   ```

3. **Physical Backup Recovery (45 minutes)**

   ```bash
   # Use most recent physical backup
   ./database/backup/scripts/disaster-recovery.sh execute \
       --method physical \
       --auto-confirm

   # Verify recovery
   ./database/backup/scripts/backup-verification.sh physical

   # Start services
   docker-compose up -d
   ```

### Scenario 3: Point-in-Time Recovery Required

**Symptoms:**

- Data corruption discovered hours after occurrence
- Need to recover to specific point in time
- Logical errors or unauthorized changes

**Recovery Steps:**

1. **Determine Recovery Point (10 minutes)**

   ```bash
   # Identify the target recovery time
   # Example: Need to recover to 2024-08-14 14:30:00

   # Check WAL archive availability
   ./database/backup/scripts/wal-archive-cleanup.sh stats
   ```

2. **Execute Point-in-Time Recovery (60 minutes)**

   ```bash
   # Stop services
   docker-compose down

   # Execute PITR using pgBackRest
   ./database/backup/scripts/disaster-recovery.sh execute \
       --method pgbackrest \
       --type time \
       --target-time "2024-08-14 14:30:00"

   # Start services and verify
   docker-compose up -d
   ./database/backup/scripts/backup-verification.sh all
   ```

### Scenario 4: Logical Data Corruption (Structure Intact)

**Symptoms:**

- Database starts normally
- Data inconsistencies
- Application errors
- Referential integrity violations

**Recovery Steps:**

1. **Create Emergency Backup (10 minutes)**

   ```bash
   # Create backup of current state
   timestamp=$(date +%Y%m%d_%H%M%S)
   docker-compose exec postgres pg_dump -U postgres payment_template_dev \
       > emergency_backup_$timestamp.sql
   ```

2. **Assess Corruption Scope (15 minutes)**

   ```bash
   # Run data integrity checks
   docker-compose exec postgres psql -U postgres -d payment_template_dev \
       -c "SELECT * FROM pg_stat_database WHERE datname='payment_template_dev';"

   # Check for constraint violations
   ./database/backup/scripts/backup-verification.sh e2e
   ```

3. **Selective Logical Recovery (30 minutes)**

   ```bash
   # Find clean logical backup
   ./database/backup/scripts/disaster-recovery.sh execute \
       --method logical \
       --backup <specific_backup_file>

   # Verify data integrity
   ./database/backup/scripts/backup-verification.sh logical
   ```

### Scenario 5: Infrastructure Failure (New Environment)

**Symptoms:**

- Complete infrastructure loss
- Need to restore in new environment
- Different host/container setup

**Recovery Steps:**

1. **Environment Setup (20 minutes)**

   ```bash
   # Clone repository
   git clone [repository_url]
   cd payment-integration-template

   # Setup environment variables
   cp .env.example .env
   # Edit .env with appropriate values

   # Create data directories
   mkdir -p data/{postgres,redis,backups}
   ```

2. **Restore from Remote Backup (45 minutes)**

   ```bash
   # Download latest backup from remote storage
   # (Implement based on your backup storage solution)

   # Setup Docker environment
   docker-compose up -d postgres redis

   # Restore database
   ./database/backup/scripts/disaster-recovery.sh execute \
       --method logical \
       --backup <downloaded_backup>
   ```

3. **Full System Verification (15 minutes)**

   ```bash
   # Start all services
   docker-compose up -d

   # Run comprehensive verification
   ./database/backup/scripts/backup-verification.sh all

   # Verify application functionality
   curl -f http://localhost:3000/api/health
   ```

## Recovery Time Objectives (RTO) and Recovery Point Objectives (RPO)

| Scenario               | RTO Target | RPO Target | Recovery Method |
| ---------------------- | ---------- | ---------- | --------------- |
| Service Restart        | 5 minutes  | 0 minutes  | Service restart |
| Logical Corruption     | 30 minutes | 24 hours   | Logical backup  |
| Physical Corruption    | 45 minutes | 24 hours   | Physical backup |
| Point-in-Time Recovery | 60 minutes | 5 minutes  | WAL + Physical  |
| Infrastructure Loss    | 90 minutes | 24 hours   | Remote backup   |

## Pre-Recovery Checklist

Before executing any recovery procedure:

- [ ] Document the incident with timestamp and symptoms
- [ ] Notify security team (payment data involved)
- [ ] Take screenshots/logs of error messages
- [ ] Verify backup availability and integrity
- [ ] Confirm recovery target (time/data)
- [ ] Notify stakeholders about planned downtime
- [ ] Ensure proper authorization for recovery actions

## Post-Recovery Verification

After any recovery procedure:

1. **Database Connectivity (5 minutes)**

   ```bash
   # Test basic connectivity
   docker-compose exec postgres pg_isready -U postgres -d payment_template_dev

   # Test application connectivity
   curl -f http://localhost:3000/api/health
   ```

2. **Data Integrity Verification (10 minutes)**

   ```bash
   # Run comprehensive verification
   ./database/backup/scripts/backup-verification.sh all

   # Verify critical tables
   docker-compose exec postgres psql -U postgres -d payment_template_dev \
       -c "SELECT COUNT(*) FROM users; SELECT COUNT(*) FROM orders; SELECT COUNT(*) FROM products;"
   ```

3. **Application Functionality (10 minutes)**

   ```bash
   # Test critical endpoints
   curl -f http://localhost:3000/api/auth/session
   curl -f http://localhost:3000/api/products

   # Run automated tests if available
   npm test
   ```

4. **Security Verification (5 minutes)**

   ```bash
   # Verify encryption is working
   ./database/backup/scripts/backup-verification.sh encryption

   # Check audit logs
   docker-compose exec postgres psql -U postgres -d payment_template_dev \
       -c "SELECT COUNT(*) FROM audit_log WHERE created_at > NOW() - INTERVAL '1 hour';"
   ```

## Backup Strategy Overview

### Daily Operations

- **Logical Backups**: Daily at 2 AM (retention: 30 days)
- **WAL Archiving**: Continuous (retention: 14 days)
- **Monitoring**: Hourly health checks

### Weekly Operations

- **Physical Backups**: Sunday at 3 AM (retention: 7 days)
- **Backup Verification**: Saturday at 1 AM
- **Recovery Testing**: Monthly (automated)

### Emergency Procedures

- **Immediate Response**: < 5 minutes
- **Assessment**: < 15 minutes
- **Recovery Initiation**: < 30 minutes

## Monitoring and Alerting

### Critical Alerts (Immediate Response Required)

- Database service down
- Backup failure
- Data corruption detected
- Disk space critical

### Warning Alerts (Response within 4 hours)

- Backup age exceeding threshold
- WAL archive issues
- Performance degradation
- Storage space low

### Monitoring Commands

```bash
# Check backup health
./database/backup/scripts/backup-monitor.sh health --send-alerts

# Verify recent backups
./database/backup/scripts/backup-verification.sh all

# Check WAL archiving
./database/backup/scripts/wal-archive-cleanup.sh health

# Monitor system resources
docker stats
```

## Security Considerations

### During Recovery

- All backup files containing payment data are encrypted
- Access to recovery procedures requires proper authentication
- All recovery actions are logged and audited
- Sensitive data handling follows PCI DSS compliance

### Access Controls

- Recovery scripts require appropriate permissions
- Backup decryption requires GPG private key
- Database access uses strong authentication
- All actions are traced in audit logs

### Incident Reporting

- Document all incidents in incident log
- Notify security team within 15 minutes
- Complete incident report within 24 hours
- Review and update procedures based on lessons learned

## Testing and Maintenance

### Monthly Testing

- Execute recovery test on non-production data
- Verify backup integrity
- Test monitoring and alerting systems
- Review and update contact information

### Quarterly Review

- Review recovery procedures
- Update documentation
- Test disaster recovery scenarios
- Validate backup retention policies

### Annual Audit

- Complete disaster recovery audit
- Review compliance with regulations
- Update security procedures
- Train team on procedures

## Troubleshooting Common Issues

### Backup Decryption Fails

```bash
# Check GPG key availability
gpg --list-keys [recipient]

# Verify backup file integrity
file backup_file.gpg

# Test decryption with verbose output
gpg --decrypt --verbose backup_file.gpg > test_output
```

### Database Won't Start After Recovery

```bash
# Check PostgreSQL logs
docker-compose logs postgres

# Verify data directory permissions
ls -la ./data/postgres/

# Check configuration files
cat ./database/postgresql.conf

# Try starting with recovery mode
docker-compose run postgres postgres --single -D /var/lib/postgresql/data
```

### Recovery Script Fails

```bash
# Check script logs
cat ./database/backup/logs/disaster-recovery-[timestamp].log

# Verify prerequisites
./database/backup/scripts/disaster-recovery.sh validate

# Test with dry-run mode (if available)
./database/backup/scripts/disaster-recovery.sh plan
```

### Application Can't Connect After Recovery

```bash
# Check database connectivity
docker-compose exec postgres pg_isready -U postgres -d payment_template_dev

# Verify database exists
docker-compose exec postgres psql -U postgres -l

# Check application logs
docker-compose logs app

# Verify environment variables
docker-compose exec app env | grep DATABASE
```

## Contact Information Update

This runbook should be reviewed and updated monthly. Contact information must be verified quarterly.

**Last Updated:** [Current Date] **Next Review:** [Next Review Date] **Document Owner:** Backend
Reliability Team **Approval:** [Security Officer Name]

---

**IMPORTANT:** Keep this runbook accessible during emergencies. Print a physical copy and store it
in a secure location accessible to the on-call team.
