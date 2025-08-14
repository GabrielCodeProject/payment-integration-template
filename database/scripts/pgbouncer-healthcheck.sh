#!/bin/sh
# PgBouncer Health Check Script
# Validates connection pooling service availability and security

set -e

# Configuration
PGBOUNCER_HOST=${PGBOUNCER_HOST:-localhost}
PGBOUNCER_PORT=${PGBOUNCER_PORT:-6432}
DATABASE=${PGBOUNCER_DATABASE:-payment_template_dev}
TIMEOUT=${HEALTH_CHECK_TIMEOUT:-5}

# Function to check PgBouncer stats
check_pgbouncer_stats() {
    echo "SHOW STATS;" | psql -h "$PGBOUNCER_HOST" -p "$PGBOUNCER_PORT" -U pgbouncer_monitor -d pgbouncer -t -A > /dev/null 2>&1
}

# Function to check database connectivity through PgBouncer
check_database_connection() {
    echo "SELECT 1;" | psql -h "$PGBOUNCER_HOST" -p "$PGBOUNCER_PORT" -U app_readonly -d "$DATABASE" -t -A > /dev/null 2>&1
}

# Function to check pool status
check_pool_status() {
    local result
    result=$(echo "SHOW POOLS;" | psql -h "$PGBOUNCER_HOST" -p "$PGBOUNCER_PORT" -U pgbouncer_monitor -d pgbouncer -t -A 2>/dev/null | grep "$DATABASE" | head -1)
    
    if [ -z "$result" ]; then
        echo "ERROR: No pool found for database $DATABASE"
        return 1
    fi
    
    echo "Pool status check passed"
    return 0
}

# Main health check logic
main() {
    echo "Starting PgBouncer health check..."
    
    # Check 1: PgBouncer stats accessibility
    if ! timeout "$TIMEOUT" check_pgbouncer_stats; then
        echo "ERROR: Cannot access PgBouncer stats"
        exit 1
    fi
    echo "✓ PgBouncer stats accessible"
    
    # Check 2: Database connection through PgBouncer
    if ! timeout "$TIMEOUT" check_database_connection; then
        echo "ERROR: Cannot connect to database through PgBouncer"
        exit 1
    fi
    echo "✓ Database connection through PgBouncer successful"
    
    # Check 3: Pool status
    if ! timeout "$TIMEOUT" check_pool_status; then
        echo "ERROR: Pool status check failed"
        exit 1
    fi
    echo "✓ Pool status check passed"
    
    echo "All health checks passed successfully"
    exit 0
}

# Run main function
main "$@"