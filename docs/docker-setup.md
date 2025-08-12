# Docker Development Setup

This document provides comprehensive instructions for setting up and using Docker in the NextJS
Stripe Payment Template development environment.

## Overview

The Docker setup provides:

- **PostgreSQL 15** database with optimized configuration
- **Redis 7** for caching and session storage
- **MailHog** for email testing in development
- **Adminer** for database management (optional)
- **Redis Commander** for Redis management (optional)

## Quick Start

### 1. Prerequisites

Ensure you have Docker and Docker Compose installed:

```bash
# Verify installation
docker --version
docker-compose --version
```

### 2. Environment Setup

Copy and configure environment variables:

```bash
# Copy environment template
npm run env:setup

# Edit .env.local with your values
nano .env.local
```

### 3. Start Development Environment

```bash
# Start all services (PostgreSQL, Redis, MailHog, and the app)
npm run docker:dev

# Or start in detached mode
npm run docker:dev:detached
```

### 4. Database Setup

Once containers are running, set up the database:

```bash
# Create database structure and seed data
npm run db:setup
```

## Available Docker Commands

### Development Commands

| Command                       | Description                              |
| ----------------------------- | ---------------------------------------- |
| `npm run docker:dev`          | Start all development services with logs |
| `npm run docker:dev:detached` | Start services in background             |
| `npm run docker:dev:down`     | Stop all services                        |
| `npm run docker:dev:clean`    | Stop services and remove all data        |
| `npm run docker:dev:logs`     | View logs from all services              |
| `npm run docker:dev:restart`  | Restart all services                     |
| `npm run docker:dev:rebuild`  | Force rebuild and restart all services   |

### Database Commands

| Command                 | Description                      |
| ----------------------- | -------------------------------- |
| `npm run docker:dev:db` | Connect to PostgreSQL shell      |
| `npm run db:setup`      | Run migrations and seed database |
| `npm run db:reset`      | Reset database completely        |
| `npm run db:studio`     | Open Prisma Studio               |
| `npm run db:migrate`    | Run database migrations          |

### Redis Commands

| Command                    | Description          |
| -------------------------- | -------------------- |
| `npm run docker:dev:redis` | Connect to Redis CLI |

### Management Tools

| Command                     | Description                       |
| --------------------------- | --------------------------------- |
| `npm run docker:tools`      | Start Adminer and Redis Commander |
| `npm run docker:tools:down` | Stop management tools             |

### Production Commands

| Command                     | Description                   |
| --------------------------- | ----------------------------- |
| `npm run docker:prod:build` | Build production Docker image |
| `npm run docker:prod:run`   | Run production container      |

## Service Details

### Application Container

- **Port**: 3000
- **Hot Reload**: Enabled via volume mounts
- **Debugging**: Port 9229 exposed for debugging
- **Health Check**: `/api/health` endpoint

### PostgreSQL Database

- **Port**: 5432
- **Database**: `payment_template_dev`
- **Username**: `postgres`
- **Password**: `password`
- **Data Persistence**: `./data/postgres`

#### Optimizations Applied:

- Increased `max_connections` to 200
- Configured `shared_buffers` for better performance
- Enabled `pg_stat_statements` for query analysis

### Redis Cache

- **Port**: 6379
- **Persistence**: Enabled with AOF and RDB
- **Max Memory**: 256MB with LRU eviction
- **Data Persistence**: `./data/redis`

### MailHog (Email Testing)

- **SMTP Port**: 1025
- **Web Interface**: http://localhost:8025
- **Purpose**: Capture and view emails sent during development

### Management Tools (Optional)

#### Adminer

- **Port**: 8080
- **URL**: http://localhost:8080
- **Purpose**: Web-based database administration

#### Redis Commander

- **Port**: 8081
- **URL**: http://localhost:8081
- **Credentials**: admin/admin
- **Purpose**: Web-based Redis management

## Development Workflow

### 1. Starting Development

```bash
# First time setup
npm run docker:setup

# Start development environment
npm run docker:dev:detached

# View logs
npm run docker:dev:logs
```

### 2. Making Code Changes

The development container automatically reloads when you change files:

- Source code is mounted as a volume
- Next.js hot reload is enabled
- Changes reflect immediately

### 3. Database Operations

```bash
# View database in browser
npm run db:studio

# Run migrations
npm run db:migrate

# Reset and reseed database
npm run db:reset
```

### 4. Debugging

```bash
# Access application container
npm run docker:dev:shell

# Connect to database
npm run docker:dev:db

# Connect to Redis
npm run docker:dev:redis
```

### 5. Email Testing

- Send emails in your application
- View them at http://localhost:8025
- All emails are captured and not sent to real recipients

## Troubleshooting

### Common Issues

#### Port Already in Use

```bash
# Stop any existing containers
npm run docker:dev:down

# Clean up all Docker resources
npm run docker:dev:clean
```

#### Database Connection Issues

```bash
# Check if PostgreSQL is healthy
docker-compose ps

# View PostgreSQL logs
docker-compose logs postgres

# Reset database
npm run db:reset
```

#### Application Won't Start

```bash
# Rebuild containers
npm run docker:dev:rebuild

# Check application logs
docker-compose logs app
```

#### Permission Issues

```bash
# Fix data directory permissions
sudo chown -R $USER:$USER data/
```

### Health Checks

```bash
# Check all services health
docker-compose ps

# Test application health
npm run docker:health

# Manual health check
curl http://localhost:3000/api/health
```

## File Structure

```
project/
├── docker-compose.yml          # Development services configuration
├── Dockerfile                  # Production build configuration
├── Dockerfile.dev              # Development build configuration
├── data/                       # Persistent data directory
│   ├── postgres/              # PostgreSQL data
│   └── redis/                 # Redis data
└── database/                  # Database configuration
    ├── init/                  # Initialization scripts
    ├── postgresql.conf        # PostgreSQL configuration
    └── redis.conf            # Redis configuration
```

## Security Considerations

### Development Environment

- Default passwords are used (change for production)
- Services are exposed on localhost only
- Volume mounts provide full file system access

### Production Considerations

- Use environment variables for all secrets
- Enable SSL/TLS for all connections
- Use non-root users in containers
- Implement proper backup strategies

## Performance Optimization

### Container Resources

Default limits can be adjusted in `docker-compose.yml`:

```yaml
services:
  app:
    deploy:
      resources:
        limits:
          cpus: "0.5"
          memory: 512M
```

### Database Tuning

PostgreSQL configuration in `database/postgresql.conf`:

```conf
# Adjust based on available system memory
shared_buffers = 256MB
effective_cache_size = 1GB
work_mem = 4MB
```

## Next Steps

1. **Configure Environment Variables**: Update `.env.local` with your actual API keys
2. **Set Up Database Schema**: Run `npm run db:migrate` to create tables
3. **Start Development**: Use `npm run docker:dev` to begin development
4. **Explore Management Tools**: Access Adminer and Redis Commander for data management

For production deployment, refer to the deployment documentation and use the production Dockerfile.
