#!/bin/bash

# Database Testing Suite Runner
# Comprehensive script to run all database tests locally

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
TEST_DB_URL="postgresql://postgres:postgres@localhost:5432/payment_template_test"
DOCKER_COMPOSE_FILE="docker-compose.yml"
PERFORMANCE_THRESHOLD=500  # ms
COVERAGE_THRESHOLD=80     # percentage

echo -e "${BLUE}🧪 Database Testing Suite${NC}"
echo "=============================="

# Function to print colored output
print_status() {
    local status=$1
    local message=$2
    case $status in
        "info")
            echo -e "${BLUE}ℹ️  $message${NC}"
            ;;
        "success")
            echo -e "${GREEN}✅ $message${NC}"
            ;;
        "warning")
            echo -e "${YELLOW}⚠️  $message${NC}"
            ;;
        "error")
            echo -e "${RED}❌ $message${NC}"
            ;;
    esac
}

# Function to check if command exists
check_command() {
    if ! command -v $1 &> /dev/null; then
        print_status "error" "$1 could not be found. Please install it first."
        exit 1
    fi
}

# Function to wait for database
wait_for_db() {
    print_status "info" "Waiting for database to be ready..."
    
    local max_attempts=30
    local attempt=1
    
    while [ $attempt -le $max_attempts ]; do
        if npx prisma db execute --sql "SELECT 1" &> /dev/null; then
            print_status "success" "Database is ready!"
            return 0
        fi
        
        echo -n "."
        sleep 2
        ((attempt++))
    done
    
    print_status "error" "Database failed to become ready after ${max_attempts} attempts"
    return 1
}

# Function to setup test database
setup_test_db() {
    print_status "info" "Setting up test database..."
    
    export DATABASE_URL=$TEST_DB_URL
    export TEST_DATABASE_URL=$TEST_DB_URL
    export NODE_ENV=test
    
    # Run migrations
    npx prisma migrate deploy
    
    print_status "success" "Test database setup complete"
}

# Function to run specific test suite
run_test_suite() {
    local suite_name=$1
    local test_command=$2
    local timeout_minutes=${3:-5}
    
    print_status "info" "Running $suite_name..."
    
    local start_time=$(date +%s)
    
    if timeout ${timeout_minutes}m npm run $test_command; then
        local end_time=$(date +%s)
        local duration=$((end_time - start_time))
        print_status "success" "$suite_name completed in ${duration}s"
        return 0
    else
        print_status "error" "$suite_name failed or timed out"
        return 1
    fi
}

# Function to generate test report
generate_report() {
    local total_tests=$1
    local passed_tests=$2
    local failed_tests=$3
    local start_time=$4
    
    local end_time=$(date +%s)
    local total_duration=$((end_time - start_time))
    
    echo ""
    echo -e "${BLUE}📊 Test Summary${NC}"
    echo "================"
    echo "Total test suites: $total_tests"
    echo "Passed: $passed_tests"
    echo "Failed: $failed_tests"
    echo "Total duration: ${total_duration}s"
    echo ""
    
    if [ $failed_tests -eq 0 ]; then
        print_status "success" "All test suites passed! 🎉"
        return 0
    else
        print_status "error" "$failed_tests test suite(s) failed"
        return 1
    fi
}

# Parse command line arguments
SKIP_SETUP=false
SKIP_PERFORMANCE=false
SKIP_SECURITY=false
SKIP_LOAD=false
VERBOSE=false

while [[ $# -gt 0 ]]; do
    case $1 in
        --skip-setup)
            SKIP_SETUP=true
            shift
            ;;
        --skip-performance)
            SKIP_PERFORMANCE=true
            shift
            ;;
        --skip-security)
            SKIP_SECURITY=true
            shift
            ;;
        --skip-load)
            SKIP_LOAD=true
            shift
            ;;
        --verbose)
            VERBOSE=true
            shift
            ;;
        --help)
            echo "Database Testing Suite Runner"
            echo ""
            echo "Usage: $0 [options]"
            echo ""
            echo "Options:"
            echo "  --skip-setup       Skip database setup"
            echo "  --skip-performance Skip performance tests"
            echo "  --skip-security    Skip security tests"
            echo "  --skip-load        Skip load tests"
            echo "  --verbose          Enable verbose output"
            echo "  --help             Show this help message"
            exit 0
            ;;
        *)
            print_status "error" "Unknown option: $1"
            exit 1
            ;;
    esac
done

# Check prerequisites
print_status "info" "Checking prerequisites..."
check_command "node"
check_command "npm"
check_command "npx"
check_command "docker"

# Start timing
overall_start_time=$(date +%s)

# Setup environment
if [ "$SKIP_SETUP" = false ]; then
    print_status "info" "Starting database services..."
    
    # Start PostgreSQL and Redis if using Docker
    if [ -f "$DOCKER_COMPOSE_FILE" ]; then
        docker-compose up -d postgres redis
        sleep 5
    fi
    
    # Wait for database and setup
    wait_for_db
    setup_test_db
else
    print_status "warning" "Skipping database setup (--skip-setup)"
    export DATABASE_URL=$TEST_DB_URL
    export TEST_DATABASE_URL=$TEST_DB_URL
    export NODE_ENV=test
fi

# Test execution tracking
total_suites=0
passed_suites=0
failed_suites=0

# Run test suites
echo ""
print_status "info" "Starting test execution..."

# Unit Tests
((total_suites++))
if run_test_suite "Unit Tests" "test:unit" 5; then
    ((passed_suites++))
else
    ((failed_suites++))
fi

# Integration Tests
((total_suites++))
if run_test_suite "Integration Tests" "test:integration" 10; then
    ((passed_suites++))
else
    ((failed_suites++))
fi

# Migration Tests
((total_suites++))
if run_test_suite "Migration Tests" "test:migration" 5; then
    ((passed_suites++))
else
    ((failed_suites++))
fi

# Security Tests
if [ "$SKIP_SECURITY" = false ]; then
    ((total_suites++))
    if run_test_suite "Security Tests" "test:security" 5; then
        ((passed_suites++))
    else
        ((failed_suites++))
    fi
else
    print_status "warning" "Skipping security tests (--skip-security)"
fi

# Performance Tests
if [ "$SKIP_PERFORMANCE" = false ]; then
    ((total_suites++))
    export MONITOR_PERFORMANCE=true
    export WRITE_PERFORMANCE_REPORT=true
    
    if run_test_suite "Performance Tests" "test:performance" 10; then
        ((passed_suites++))
        
        # Check performance report
        if [ -f "test-performance-report.json" ]; then
            print_status "info" "Performance report generated: test-performance-report.json"
        fi
    else
        ((failed_suites++))
    fi
else
    print_status "warning" "Skipping performance tests (--skip-performance)"
fi

# Load Tests
if [ "$SKIP_LOAD" = false ]; then
    ((total_suites++))
    if run_test_suite "Load Tests" "test:load" 15; then
        ((passed_suites++))
    else
        ((failed_suites++))
    fi
else
    print_status "warning" "Skipping load tests (--skip-load)"
fi

# Benchmark Tests (if performance tests are enabled)
if [ "$SKIP_PERFORMANCE" = false ]; then
    ((total_suites++))
    if run_test_suite "Benchmark Tests" "test:benchmark" 15; then
        ((passed_suites++))
    else
        ((failed_suites++))
    fi
fi

# Coverage Analysis
print_status "info" "Analyzing test coverage..."
if [ -d "coverage" ]; then
    if command -v npx &> /dev/null; then
        coverage_summary=$(npx nyc report --reporter=text-summary 2>/dev/null | grep "Lines" | awk '{print $3}' | sed 's/%//' || echo "N/A")
        if [ "$coverage_summary" != "N/A" ] && [ "$coverage_summary" -ge "$COVERAGE_THRESHOLD" ]; then
            print_status "success" "Test coverage: ${coverage_summary}% (above threshold)"
        elif [ "$coverage_summary" != "N/A" ]; then
            print_status "warning" "Test coverage: ${coverage_summary}% (below ${COVERAGE_THRESHOLD}% threshold)"
        else
            print_status "info" "Coverage analysis not available"
        fi
    fi
fi

# Cleanup
print_status "info" "Cleaning up test environment..."
if [ "$SKIP_SETUP" = false ]; then
    export DROP_TEST_DB=true
    npm run test:teardown || true
fi

# Generate final report
generate_report $total_suites $passed_suites $failed_suites $overall_start_time

# Exit with appropriate code
if [ $failed_suites -eq 0 ]; then
    exit 0
else
    exit 1
fi