#!/bin/bash
# PostgreSQL Database Health Check Script
# NextJS Stripe Payment Template

set -e

echo "🏥 PostgreSQL Database Health Check"
echo "===================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
NC='\033[0m' # No Color

# Test functions
test_container_health() {
    echo -n "📦 Container Health: "
    if docker ps --format "table {{.Names}}\t{{.Status}}" | grep -q "payment-template-postgres.*healthy"; then
        echo -e "${GREEN}HEALTHY${NC}"
        return 0
    else
        echo -e "${RED}UNHEALTHY${NC}"
        return 1
    fi
}

test_database_connectivity() {
    echo -n "🔌 Database Connectivity: "
    if docker exec payment-template-postgres psql -U postgres -d payment_template_dev -c "SELECT 1;" >/dev/null 2>&1; then
        echo -e "${GREEN}CONNECTED${NC}"
        return 0
    else
        echo -e "${RED}FAILED${NC}"
        return 1
    fi
}

test_extensions() {
    echo -n "🧩 Required Extensions: "
    local extensions=$(docker exec payment-template-postgres psql -U postgres -d payment_template_dev -tc "SELECT COUNT(*) FROM pg_extension WHERE extname IN ('uuid-ossp', 'pg_stat_statements', 'pgcrypto');")
    extensions=$(echo $extensions | tr -d ' ')
    
    if [ "$extensions" = "3" ]; then
        echo -e "${GREEN}ALL INSTALLED${NC}"
        return 0
    else
        echo -e "${RED}MISSING ($extensions/3)${NC}"
        return 1
    fi
}

test_schemas() {
    echo -n "🗂️  Required Schemas: "
    local schemas=$(docker exec payment-template-postgres psql -U postgres -d payment_template_dev -tc "SELECT COUNT(*) FROM information_schema.schemata WHERE schema_name IN ('public', 'audit', 'analytics');")
    schemas=$(echo $schemas | tr -d ' ')
    
    if [ "$schemas" = "3" ]; then
        echo -e "${GREEN}ALL CREATED${NC}"
        return 0
    else
        echo -e "${RED}MISSING ($schemas/3)${NC}"
        return 1
    fi
}

test_users() {
    echo -n "👥 Application Users: "
    local users=$(docker exec payment-template-postgres psql -U postgres -tc "SELECT COUNT(*) FROM pg_roles WHERE rolname IN ('app_user', 'readonly_user');")
    users=$(echo $users | tr -d ' ')
    
    if [ "$users" = "2" ]; then
        echo -e "${GREEN}ALL CREATED${NC}"
        return 0
    else
        echo -e "${RED}MISSING ($users/2)${NC}"
        return 1
    fi
}

test_functions() {
    echo -n "⚙️  Utility Functions: "
    local functions=$(docker exec payment-template-postgres psql -U postgres -d payment_template_dev -tc "SELECT COUNT(*) FROM pg_proc WHERE proname IN ('update_updated_at_column', 'generate_slug', 'generate_order_number', 'calculate_next_billing_date');")
    functions=$(echo $functions | tr -d ' ')
    
    if [ "$functions" = "4" ]; then
        echo -e "${GREEN}ALL CREATED${NC}"
        return 0
    else
        echo -e "${RED}MISSING ($functions/4)${NC}"
        return 1
    fi
}

test_performance_views() {
    echo -n "📊 Performance Views: "
    if docker exec payment-template-postgres psql -U postgres -d payment_template_dev -c "SELECT * FROM connection_stats LIMIT 1;" >/dev/null 2>&1; then
        echo -e "${GREEN}AVAILABLE${NC}"
        return 0
    else
        echo -e "${RED}MISSING${NC}"
        return 1
    fi
}

test_database_configuration() {
    echo -n "⚡ Performance Config: "
    local max_conn=$(docker exec payment-template-postgres psql -U postgres -d payment_template_dev -tc "SHOW max_connections;" | tr -d ' ')
    local shared_buf=$(docker exec payment-template-postgres psql -U postgres -d payment_template_dev -tc "SHOW shared_buffers;" | tr -d ' ')
    
    if [ "$max_conn" = "200" ] && [ "$shared_buf" = "256MB" ]; then
        echo -e "${GREEN}OPTIMIZED${NC}"
        return 0
    else
        echo -e "${YELLOW}SUBOPTIMAL${NC} (connections: $max_conn, shared_buffers: $shared_buf)"
        return 1
    fi
}

test_backup_capability() {
    echo -n "💾 Backup Capability: "
    if docker exec payment-template-postgres pg_dump --version >/dev/null 2>&1; then
        echo -e "${GREEN}AVAILABLE${NC}"
        return 0
    else
        echo -e "${RED}UNAVAILABLE${NC}"
        return 1
    fi
}

test_security_settings() {
    echo -n "🔐 Security Settings: "
    local pwd_enc=$(docker exec payment-template-postgres psql -U postgres -d payment_template_dev -tc "SHOW password_encryption;" | tr -d ' ')
    local row_sec=$(docker exec payment-template-postgres psql -U postgres -d payment_template_dev -tc "SHOW row_security;" | tr -d ' ')
    
    if [ "$pwd_enc" = "scram-sha-256" ] && [ "$row_sec" = "on" ]; then
        echo -e "${GREEN}SECURE${NC}"
        return 0
    else
        echo -e "${RED}INSECURE${NC} (password_encryption: $pwd_enc, row_security: $row_sec)"
        return 1
    fi
}

# Run all tests
echo ""
failed_tests=0

test_container_health || ((failed_tests++))
test_database_connectivity || ((failed_tests++))
test_extensions || ((failed_tests++))
test_schemas || ((failed_tests++))
test_users || ((failed_tests++))
test_functions || ((failed_tests++))
test_performance_views || ((failed_tests++))
test_database_configuration || ((failed_tests++))
test_backup_capability || ((failed_tests++))
test_security_settings || ((failed_tests++))

echo ""
echo "===================================="

if [ $failed_tests -eq 0 ]; then
    echo -e "🎉 ${GREEN}All tests passed! Database is ready for development.${NC}"
    exit 0
else
    echo -e "❌ ${RED}$failed_tests test(s) failed. Please address the issues above.${NC}"
    exit 1
fi