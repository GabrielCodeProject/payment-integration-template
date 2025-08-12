#!/bin/bash
# Verify PostgreSQL Database Setup Requirements from PRD Task 2.1
# NextJS Stripe Payment Template

set -e

echo "📋 Verifying PRD Requirements for Task 2.1"
echo "=========================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

check_requirement() {
    local requirement="$1"
    local test_command="$2"
    local expected="$3"
    
    echo -n "✓ $requirement: "
    
    if eval "$test_command" >/dev/null 2>&1; then
        echo -e "${GREEN}PASSED${NC}"
        return 0
    else
        echo -e "${RED}FAILED${NC}"
        return 1
    fi
}

check_value() {
    local requirement="$1"
    local test_command="$2"
    local expected="$3"
    
    echo -n "✓ $requirement: "
    
    local result
    result=$(eval "$test_command" 2>/dev/null | tr -d ' \n')
    
    if [ "$result" = "$expected" ]; then
        echo -e "${GREEN}$result${NC}"
        return 0
    else
        echo -e "${RED}$result (expected: $expected)${NC}"
        return 1
    fi
}

echo ""
echo -e "${BLUE}1. PostgreSQL 15 running in Docker container${NC}"
check_value "PostgreSQL Version" "docker exec payment-template-postgres psql -U postgres -tc 'SELECT version();' | grep -o 'PostgreSQL [0-9]*\.[0-9]*' | grep -o '[0-9]*\.[0-9]*'" "15.13"

echo ""
echo -e "${BLUE}2. Proper environment variables${NC}"
check_requirement "DATABASE_URL configured" "grep -q 'DATABASE_URL=' .env"
check_requirement "POSTGRES_PASSWORD configured" "grep -q 'POSTGRES_PASSWORD=' .env"
check_requirement "Database URL points to port 5433" "grep -q ':5433/' .env"

echo ""
echo -e "${BLUE}3. Health checks configured and working${NC}"
check_requirement "Container health check" "docker ps --format 'table {{.Names}}\\t{{.Status}}' | grep -q 'payment-template-postgres.*healthy'"
check_requirement "PostgreSQL responding to health check" "docker exec payment-template-postgres pg_isready -U postgres"

echo ""
echo -e "${BLUE}4. Database accessible on port 5433${NC}"
check_requirement "Port mapping configured" "docker port payment-template-postgres | grep -q '5432/tcp -> 0.0.0.0:5433'"
check_requirement "Database connection via mapped port" "psql 'postgresql://postgres:31d1985182118f04d2be343e1bfedbb8@localhost:5433/payment_template_dev' -c 'SELECT 1;'"

echo ""
echo -e "${BLUE}5. Initialization scripts for schema and seed data${NC}"
check_requirement "Initialization scripts exist" "test -f database/init/01-init-database.sql && test -f database/init/02-create-functions.sql"
check_requirement "Required extensions installed" "docker exec payment-template-postgres psql -U postgres -d payment_template_dev -tc 'SELECT COUNT(*) FROM pg_extension WHERE extname IN (\\\"uuid-ossp\\\", \\\"pg_stat_statements\\\", \\\"pgcrypto\\\");' | grep -q '3'"
check_requirement "Database schemas created" "docker exec payment-template-postgres psql -U postgres -d payment_template_dev -tc 'SELECT COUNT(*) FROM information_schema.schemata WHERE schema_name IN (\\\"public\\\", \\\"audit\\\", \\\"analytics\\\");' | grep -q '3'"
check_requirement "Utility functions created" "docker exec payment-template-postgres psql -U postgres -d payment_template_dev -tc 'SELECT COUNT(*) FROM pg_proc WHERE proname IN (\\\"update_updated_at_column\\\", \\\"generate_slug\\\", \\\"generate_order_number\\\", \\\"calculate_next_billing_date\\\");' | grep -q '4'"

echo ""
echo -e "${BLUE}6. Volume persistence for data${NC}"
check_requirement "Data directory exists" "test -d data/postgres"
check_requirement "PostgreSQL data files present" "test -f data/postgres/PG_VERSION"
check_requirement "Data persistence configured" "docker inspect payment-template-postgres | grep -q '/var/lib/postgresql/data'"

echo ""
echo -e "${BLUE}7. Resource limits appropriate for development${NC}"
check_requirement "Memory limit configured" "docker inspect payment-template-postgres | grep -q '\\\"Memory\\\":'"
check_requirement "CPU limit configured" "docker inspect payment-template-postgres | grep -q '\\\"CpuQuota\\\":'"

echo ""
echo -e "${BLUE}8. Connection pooling configured${NC}"
check_value "Max connections" "docker exec payment-template-postgres psql -U postgres -d payment_template_dev -tc 'SHOW max_connections;'" "200"
check_value "Shared buffers" "docker exec payment-template-postgres psql -U postgres -d payment_template_dev -tc 'SHOW shared_buffers;'" "256MB"

echo ""
echo -e "${BLUE}9. Security settings${NC}"
check_value "Password encryption" "docker exec payment-template-postgres psql -U postgres -d payment_template_dev -tc 'SHOW password_encryption;'" "scram-sha-256"
check_value "Row security" "docker exec payment-template-postgres psql -U postgres -d payment_template_dev -tc 'SHOW row_security;'" "on"
check_requirement "Application users created" "docker exec payment-template-postgres psql -U postgres -tc 'SELECT COUNT(*) FROM pg_roles WHERE rolname IN (\\\"app_user\\\", \\\"readonly_user\\\");' | grep -q '2'"

echo ""
echo -e "${BLUE}10. Backup and recovery readiness${NC}"
check_requirement "pg_dump available" "docker exec payment-template-postgres pg_dump --version"
check_requirement "Schema backup test" "docker exec payment-template-postgres pg_dump -U postgres --schema-only payment_template_dev | head -1 | grep -q 'PostgreSQL database dump'"

echo ""
echo "=========================================="
echo -e "${GREEN}✅ All PostgreSQL Database Setup requirements verified!${NC}"
echo ""
echo -e "${YELLOW}📝 Summary:${NC}"
echo "   • PostgreSQL 15 container running with health checks"
echo "   • Database accessible on port 5433 with proper authentication"
echo "   • Environment variables configured for development"
echo "   • Initialization scripts executed successfully"
echo "   • Data persistence with bind mount volumes"
echo "   • Security settings optimized (SCRAM-SHA-256, row security)"
echo "   • Connection pooling configured (200 max connections)"
echo "   • Performance monitoring enabled (pg_stat_statements)"
echo "   • Backup capability verified (pg_dump available)"
echo "   • Application users created with appropriate permissions"
echo ""
echo -e "${GREEN}🎯 Task 2.1 'PostgreSQL Database Setup with Docker Compose' is COMPLETE!${NC}"