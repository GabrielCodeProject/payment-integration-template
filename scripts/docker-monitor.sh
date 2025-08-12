#!/bin/bash

# Docker Monitoring Script for NextJS Stripe Payment Template
# Provides comprehensive monitoring of all Docker services

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
COMPOSE_FILE="docker-compose.yml"
APP_URL="http://localhost:3000"
HEALTH_ENDPOINT="${APP_URL}/api/health"

echo -e "${BLUE}🐳 Docker Services Monitor${NC}"
echo "=============================="
echo ""

# Function to check if Docker is running
check_docker() {
    if ! docker info > /dev/null 2>&1; then
        echo -e "${RED}❌ Docker is not running${NC}"
        exit 1
    fi
    echo -e "${GREEN}✅ Docker is running${NC}"
}

# Function to check Docker Compose services
check_services() {
    echo -e "${BLUE}📋 Service Status:${NC}"
    
    # Get service status
    if docker-compose -f $COMPOSE_FILE ps --format "table" > /dev/null 2>&1; then
        docker-compose -f $COMPOSE_FILE ps --format "table {{.Name}}\t{{.State}}\t{{.Status}}"
    else
        echo -e "${RED}❌ No services running${NC}"
        return 1
    fi
    echo ""
}

# Function to check service health
check_health() {
    echo -e "${BLUE}🏥 Health Checks:${NC}"
    
    # Check PostgreSQL
    if docker-compose -f $COMPOSE_FILE exec -T postgres pg_isready -U postgres > /dev/null 2>&1; then
        echo -e "${GREEN}✅ PostgreSQL: Healthy${NC}"
    else
        echo -e "${RED}❌ PostgreSQL: Unhealthy${NC}"
    fi
    
    # Check Redis
    if docker-compose -f $COMPOSE_FILE exec -T redis redis-cli ping > /dev/null 2>&1; then
        echo -e "${GREEN}✅ Redis: Healthy${NC}"
    else
        echo -e "${RED}❌ Redis: Unhealthy${NC}"
    fi
    
    # Check Application (if running)
    if curl -f $HEALTH_ENDPOINT > /dev/null 2>&1; then
        echo -e "${GREEN}✅ Application: Healthy${NC}"
        
        # Get detailed health information
        health_response=$(curl -s $HEALTH_ENDPOINT 2>/dev/null || echo '{"status":"unknown"}')
        status=$(echo $health_response | grep -o '"status":"[^"]*"' | cut -d'"' -f4)
        uptime=$(echo $health_response | grep -o '"uptime":[^,]*' | cut -d':' -f2)
        
        if [ "$status" = "healthy" ]; then
            echo -e "   ${GREEN}Status: $status${NC}"
        elif [ "$status" = "degraded" ]; then
            echo -e "   ${YELLOW}Status: $status${NC}"
        else
            echo -e "   ${RED}Status: $status${NC}"
        fi
        
        if [ ! -z "$uptime" ]; then
            echo -e "   Uptime: ${uptime}s"
        fi
    else
        echo -e "${RED}❌ Application: Unhealthy or not running${NC}"
    fi
    
    # Check MailHog
    if curl -f http://localhost:8025 > /dev/null 2>&1; then
        echo -e "${GREEN}✅ MailHog: Healthy${NC}"
    else
        echo -e "${YELLOW}⚠️  MailHog: Not accessible${NC}"
    fi
    
    echo ""
}

# Function to show resource usage
show_resources() {
    echo -e "${BLUE}📊 Resource Usage:${NC}"
    
    # Get container stats
    if docker stats --no-stream --format "table {{.Container}}\t{{.CPUPerc}}\t{{.MemUsage}}\t{{.NetIO}}" > /dev/null 2>&1; then
        docker stats --no-stream --format "table {{.Container}}\t{{.CPUPerc}}\t{{.MemUsage}}\t{{.NetIO}}" | grep -E "(payment-template|CONTAINER)"
    else
        echo -e "${YELLOW}⚠️  No containers running${NC}"
    fi
    
    echo ""
}

# Function to show logs summary
show_logs_summary() {
    echo -e "${BLUE}📝 Recent Logs (last 10 lines per service):${NC}"
    
    services=("app" "postgres" "redis" "mailhog")
    
    for service in "${services[@]}"; do
        echo -e "${YELLOW}--- $service ---${NC}"
        if docker-compose -f $COMPOSE_FILE logs --tail=5 $service 2>/dev/null; then
            echo ""
        else
            echo -e "${RED}No logs available for $service${NC}"
            echo ""
        fi
    done
}

# Function to show network information
show_network_info() {
    echo -e "${BLUE}🌐 Network Information:${NC}"
    
    # Show exposed ports
    echo "Exposed Ports:"
    echo "- Application: http://localhost:3000"
    echo "- PostgreSQL: localhost:5432"
    echo "- Redis: localhost:6379"
    echo "- MailHog Web: http://localhost:8025"
    echo "- Adminer: http://localhost:8080 (if tools profile is active)"
    echo "- Redis Commander: http://localhost:8081 (if tools profile is active)"
    echo ""
    
    # Show Docker network
    if docker network ls | grep payment > /dev/null 2>&1; then
        echo "Docker Networks:"
        docker network ls | grep payment
        echo ""
    fi
}

# Function to check disk usage
check_disk_usage() {
    echo -e "${BLUE}💾 Storage Usage:${NC}"
    
    # Check data directory sizes
    if [ -d "./data" ]; then
        echo "Data Directory Usage:"
        du -sh ./data/* 2>/dev/null || echo "No data directories found"
        echo ""
    fi
    
    # Check Docker system usage
    echo "Docker System Usage:"
    docker system df 2>/dev/null || echo "Unable to get Docker system usage"
    echo ""
}

# Function to run quick diagnostics
run_diagnostics() {
    echo -e "${BLUE}🔍 Quick Diagnostics:${NC}"
    
    # Check if required files exist
    required_files=("docker-compose.yml" "Dockerfile" "Dockerfile.dev" ".env.example")
    
    for file in "${required_files[@]}"; do
        if [ -f "$file" ]; then
            echo -e "${GREEN}✅ $file exists${NC}"
        else
            echo -e "${RED}❌ $file missing${NC}"
        fi
    done
    
    # Check if data directories exist
    if [ -d "./data" ]; then
        echo -e "${GREEN}✅ Data directory exists${NC}"
    else
        echo -e "${YELLOW}⚠️  Data directory missing (will be created on first run)${NC}"
    fi
    
    # Check environment file
    if [ -f ".env.local" ]; then
        echo -e "${GREEN}✅ .env.local exists${NC}"
    else
        echo -e "${YELLOW}⚠️  .env.local missing (run: npm run env:setup)${NC}"
    fi
    
    echo ""
}

# Main function
main() {
    case "${1:-status}" in
        "status"|"")
            check_docker
            check_services
            check_health
            ;;
        "resources"|"stats")
            check_docker
            show_resources
            ;;
        "logs")
            check_docker
            show_logs_summary
            ;;
        "network"|"net")
            show_network_info
            ;;
        "storage"|"disk")
            check_disk_usage
            ;;
        "full"|"all")
            check_docker
            run_diagnostics
            check_services
            check_health
            show_resources
            show_network_info
            check_disk_usage
            ;;
        "diag"|"diagnostics")
            run_diagnostics
            ;;
        "help"|"-h"|"--help")
            echo "Docker Monitor Usage:"
            echo "  $0 [command]"
            echo ""
            echo "Commands:"
            echo "  status      Show service status and health (default)"
            echo "  resources   Show resource usage and stats"
            echo "  logs        Show recent logs from all services"
            echo "  network     Show network and port information"
            echo "  storage     Show disk usage information"
            echo "  diag        Run quick diagnostics"
            echo "  full        Show all information"
            echo "  help        Show this help message"
            echo ""
            ;;
        *)
            echo -e "${RED}Unknown command: $1${NC}"
            echo "Use '$0 help' for usage information"
            exit 1
            ;;
    esac
}

# Run main function with all arguments
main "$@"