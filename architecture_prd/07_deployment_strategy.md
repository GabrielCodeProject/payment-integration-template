# Deployment Strategy & Infrastructure

## 1. Deployment Architecture Overview

The NextJS Stripe Payment Template employs a modern, cloud-native deployment strategy using LeaseWeb infrastructure with automated CI/CD pipelines, containerization, and comprehensive monitoring.

### 1.1 Infrastructure Diagram

```mermaid
graph TB
    subgraph "Development Environment"
        DEV[Local Development]
        DOCKER[Docker Compose]
        TESTDB[Test Database]
    end
    
    subgraph "CI/CD Pipeline"
        GITHUB[GitHub Repository]
        ACTIONS[GitHub Actions]
        TESTS[Automated Testing]
        BUILD[Build & Package]
    end
    
    subgraph "LeaseWeb Production Environment"
        LB[Load Balancer]
        APP1[App Instance 1]
        APP2[App Instance 2]
        DB[PostgreSQL Primary]
        DBREAD[PostgreSQL Replica]
        REDIS[Redis Cache]
        STORAGE[File Storage]
    end
    
    subgraph "External Services"
        STRIPE[Stripe API]
        RESEND[Resend Email]
        MONITORING[Monitoring Services]
    end
    
    DEV --> GITHUB
    GITHUB --> ACTIONS
    ACTIONS --> TESTS
    TESTS --> BUILD
    BUILD --> LB
    
    LB --> APP1
    LB --> APP2
    APP1 --> DB
    APP2 --> DB
    APP1 --> DBREAD
    APP2 --> DBREAD
    APP1 --> REDIS
    APP2 --> REDIS
    
    APP1 --> STRIPE
    APP1 --> RESEND
    APP1 --> MONITORING
```

### 1.2 Deployment Environments

- **Development**: Local development with Docker Compose
- **Staging**: Pre-production environment for testing
- **Production**: Live environment on LeaseWeb infrastructure

## 2. Local Development Setup

### 2.1 Docker Compose Configuration

```yaml
# docker-compose.yml
version: '3.8'

services:
  app:
    build:
      context: .
      dockerfile: Dockerfile.dev
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=development
      - DATABASE_URL=postgresql://postgres:password@postgres:5432/payment_template_dev
      - REDIS_URL=redis://redis:6379
      - STRIPE_SECRET_KEY=${STRIPE_SECRET_KEY}
      - STRIPE_PUBLISHABLE_KEY=${STRIPE_PUBLISHABLE_KEY}
      - NEXTAUTH_SECRET=${NEXTAUTH_SECRET}
      - RESEND_API_KEY=${RESEND_API_KEY}
    volumes:
      - .:/app
      - /app/node_modules
      - /app/.next
    depends_on:
      - postgres
      - redis
    command: npm run dev

  postgres:
    image: postgres:15-alpine
    environment:
      POSTGRES_DB: payment_template_dev
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: password
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./database/init:/docker-entrypoint-initdb.d

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    command: redis-server --appendonly yes
    volumes:
      - redis_data:/data

  mailhog:
    image: mailhog/mailhog:latest
    ports:
      - "1025:1025"
      - "8025:8025"

volumes:
  postgres_data:
  redis_data:
```

### 2.2 Development Dockerfile

```dockerfile
# Dockerfile.dev
FROM node:18-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./
RUN npm ci

# Copy source code
COPY . .

# Install dependencies
RUN npx prisma generate

EXPOSE 3000

CMD ["npm", "run", "dev"]
```

### 2.3 Development Scripts

```json
{
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "next lint",
    "test": "jest",
    "test:watch": "jest --watch",
    "test:e2e": "playwright test",
    "db:generate": "prisma generate",
    "db:migrate": "prisma migrate dev",
    "db:seed": "prisma db seed",
    "db:studio": "prisma studio",
    "docker:dev": "docker-compose up --build",
    "docker:down": "docker-compose down -v",
    "type-check": "tsc --noEmit"
  }
}
```

## 3. CI/CD Pipeline Implementation

### 3.1 GitHub Actions Workflow

```yaml
# .github/workflows/ci-cd.yml
name: CI/CD Pipeline

on:
  push:
    branches: [ main, develop ]
  pull_request:
    branches: [ main ]

env:
  NODE_VERSION: '18'
  DOCKER_REGISTRY: registry.leaseweb.com
  IMAGE_NAME: nextjs-stripe-template

jobs:
  # ============================================================================
  # QUALITY CHECKS
  # ============================================================================
  quality-checks:
    runs-on: ubuntu-latest
    
    steps:
    - name: Checkout code
      uses: actions/checkout@v4

    - name: Setup Node.js
      uses: actions/setup-node@v4
      with:
        node-version: ${{ env.NODE_VERSION }}
        cache: 'npm'

    - name: Install dependencies
      run: npm ci

    - name: Type checking
      run: npm run type-check

    - name: Lint checking
      run: npm run lint

    - name: Format checking
      run: npm run format:check

  # ============================================================================
  # UNIT TESTS
  # ============================================================================
  unit-tests:
    runs-on: ubuntu-latest
    needs: quality-checks

    services:
      postgres:
        image: postgres:15
        env:
          POSTGRES_PASSWORD: postgres
          POSTGRES_DB: test_db
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
        ports:
          - 5432:5432

      redis:
        image: redis:7-alpine
        options: >-
          --health-cmd "redis-cli ping"
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
        ports:
          - 6379:6379

    steps:
    - name: Checkout code
      uses: actions/checkout@v4

    - name: Setup Node.js
      uses: actions/setup-node@v4
      with:
        node-version: ${{ env.NODE_VERSION }}
        cache: 'npm'

    - name: Install dependencies
      run: npm ci

    - name: Setup test database
      run: |
        npx prisma migrate deploy
        npx prisma db seed
      env:
        DATABASE_URL: postgresql://postgres:postgres@localhost:5432/test_db

    - name: Run unit tests
      run: npm run test -- --coverage
      env:
        DATABASE_URL: postgresql://postgres:postgres@localhost:5432/test_db
        REDIS_URL: redis://localhost:6379
        NEXTAUTH_SECRET: test-secret
        STRIPE_SECRET_KEY: ${{ secrets.STRIPE_TEST_SECRET_KEY }}

    - name: Upload coverage reports
      uses: codecov/codecov-action@v3
      with:
        file: ./coverage/lcov.info
        flags: unittests

  # ============================================================================
  # E2E TESTS
  # ============================================================================
  e2e-tests:
    runs-on: ubuntu-latest
    needs: unit-tests

    steps:
    - name: Checkout code
      uses: actions/checkout@v4

    - name: Setup Node.js
      uses: actions/setup-node@v4
      with:
        node-version: ${{ env.NODE_VERSION }}
        cache: 'npm'

    - name: Install dependencies
      run: npm ci

    - name: Install Playwright browsers
      run: npx playwright install --with-deps

    - name: Start application
      run: |
        npm run build
        npm run start &
        npx wait-on http://localhost:3000
      env:
        DATABASE_URL: ${{ secrets.TEST_DATABASE_URL }}
        NEXTAUTH_SECRET: test-secret
        STRIPE_PUBLISHABLE_KEY: ${{ secrets.STRIPE_TEST_PUBLISHABLE_KEY }}

    - name: Run Playwright tests
      run: npm run test:e2e
      env:
        STRIPE_SECRET_KEY: ${{ secrets.STRIPE_TEST_SECRET_KEY }}

    - name: Upload Playwright report
      uses: actions/upload-artifact@v3
      if: always()
      with:
        name: playwright-report
        path: playwright-report/

  # ============================================================================
  # SECURITY SCAN
  # ============================================================================
  security-scan:
    runs-on: ubuntu-latest
    needs: quality-checks

    steps:
    - name: Checkout code
      uses: actions/checkout@v4

    - name: Setup Node.js
      uses: actions/setup-node@v4
      with:
        node-version: ${{ env.NODE_VERSION }}
        cache: 'npm'

    - name: Install dependencies
      run: npm ci

    - name: Run security audit
      run: npm audit --audit-level high

    - name: Run Snyk security scan
      uses: snyk/actions/node@master
      env:
        SNYK_TOKEN: ${{ secrets.SNYK_TOKEN }}

  # ============================================================================
  # BUILD AND DEPLOY TO STAGING
  # ============================================================================
  deploy-staging:
    runs-on: ubuntu-latest
    needs: [unit-tests, e2e-tests, security-scan]
    if: github.ref == 'refs/heads/develop'

    environment: staging

    steps:
    - name: Checkout code
      uses: actions/checkout@v4

    - name: Setup Docker Buildx
      uses: docker/setup-buildx-action@v3

    - name: Login to LeaseWeb Registry
      uses: docker/login-action@v3
      with:
        registry: ${{ env.DOCKER_REGISTRY }}
        username: ${{ secrets.LEASEWEB_REGISTRY_USERNAME }}
        password: ${{ secrets.LEASEWEB_REGISTRY_PASSWORD }}

    - name: Build and push Docker image
      uses: docker/build-push-action@v5
      with:
        context: .
        file: ./Dockerfile.prod
        push: true
        tags: |
          ${{ env.DOCKER_REGISTRY }}/${{ env.IMAGE_NAME }}:staging
          ${{ env.DOCKER_REGISTRY }}/${{ env.IMAGE_NAME }}:staging-${{ github.sha }}
        cache-from: type=gha
        cache-to: type=gha,mode=max

    - name: Deploy to staging
      run: |
        echo "Deploying to staging environment..."
        ./scripts/deploy-staging.sh
      env:
        LEASEWEB_API_KEY: ${{ secrets.LEASEWEB_API_KEY }}
        DOCKER_IMAGE: ${{ env.DOCKER_REGISTRY }}/${{ env.IMAGE_NAME }}:staging-${{ github.sha }}

  # ============================================================================
  # DEPLOY TO PRODUCTION
  # ============================================================================
  deploy-production:
    runs-on: ubuntu-latest
    needs: [unit-tests, e2e-tests, security-scan]
    if: github.ref == 'refs/heads/main'

    environment: production

    steps:
    - name: Checkout code
      uses: actions/checkout@v4

    - name: Setup Docker Buildx
      uses: docker/setup-buildx-action@v3

    - name: Login to LeaseWeb Registry
      uses: docker/login-action@v3
      with:
        registry: ${{ env.DOCKER_REGISTRY }}
        username: ${{ secrets.LEASEWEB_REGISTRY_USERNAME }}
        password: ${{ secrets.LEASEWEB_REGISTRY_PASSWORD }}

    - name: Build and push Docker image
      uses: docker/build-push-action@v5
      with:
        context: .
        file: ./Dockerfile.prod
        push: true
        tags: |
          ${{ env.DOCKER_REGISTRY }}/${{ env.IMAGE_NAME }}:latest
          ${{ env.DOCKER_REGISTRY }}/${{ env.IMAGE_NAME }}:prod-${{ github.sha }}
        cache-from: type=gha
        cache-to: type=gha,mode=max

    - name: Run database migrations
      run: |
        ./scripts/run-migrations.sh
      env:
        DATABASE_URL: ${{ secrets.PRODUCTION_DATABASE_URL }}

    - name: Deploy to production
      run: |
        echo "Deploying to production environment..."
        ./scripts/deploy-production.sh
      env:
        LEASEWEB_API_KEY: ${{ secrets.LEASEWEB_API_KEY }}
        DOCKER_IMAGE: ${{ env.DOCKER_REGISTRY }}/${{ env.IMAGE_NAME }}:prod-${{ github.sha }}

    - name: Run smoke tests
      run: |
        ./scripts/smoke-tests.sh
      env:
        PRODUCTION_URL: https://your-domain.com

    - name: Notify deployment
      uses: 8398a7/action-slack@v3
      with:
        status: ${{ job.status }}
        channel: '#deployments'
        webhook_url: ${{ secrets.SLACK_WEBHOOK }}
```

### 3.2 Production Dockerfile

```dockerfile
# Dockerfile.prod
FROM node:18-alpine AS base

# Install dependencies only when needed
FROM base AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app

# Copy package files
COPY package*.json ./
COPY prisma ./prisma/

# Install dependencies
RUN npm ci --only=production && npm cache clean --force

# Rebuild the source code only when needed
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Generate Prisma client
RUN npx prisma generate

# Build application
ENV NEXT_TELEMETRY_DISABLED 1
RUN npm run build

# Production image, copy all the files and run next
FROM base AS runner
WORKDIR /app

ENV NODE_ENV production
ENV NEXT_TELEMETRY_DISABLED 1

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copy built application
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Copy Prisma files
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma

USER nextjs

EXPOSE 3000

ENV PORT 3000
ENV HOSTNAME "0.0.0.0"

CMD ["node", "server.js"]
```

## 4. LeaseWeb Infrastructure Configuration

### 4.1 Infrastructure as Code (Terraform)

```hcl
# terraform/main.tf
terraform {
  required_providers {
    leaseweb = {
      source = "leaseweb/leaseweb"
      version = "~> 1.0"
    }
  }
}

provider "leaseweb" {
  api_key = var.leaseweb_api_key
}

# ============================================================================
# NETWORK CONFIGURATION
# ============================================================================
resource "leaseweb_virtual_private_cloud" "main" {
  name = "nextjs-stripe-template-vpc"
  region = "eu-west-3"
}

resource "leaseweb_subnet" "private" {
  vpc_id = leaseweb_virtual_private_cloud.main.id
  name = "private-subnet"
  cidr = "10.0.1.0/24"
}

resource "leaseweb_subnet" "public" {
  vpc_id = leaseweb_virtual_private_cloud.main.id
  name = "public-subnet"
  cidr = "10.0.2.0/24"
}

# ============================================================================
# LOAD BALANCER
# ============================================================================
resource "leaseweb_load_balancer" "main" {
  name = "nextjs-app-lb"
  vpc_id = leaseweb_virtual_private_cloud.main.id
  subnet_id = leaseweb_subnet.public.id
  
  health_check {
    enabled = true
    path = "/api/health"
    port = 3000
    protocol = "HTTP"
    interval = 30
    timeout = 5
    healthy_threshold = 2
    unhealthy_threshold = 3
  }
  
  listeners {
    port = 80
    protocol = "HTTP"
    target_port = 3000
    target_protocol = "HTTP"
  }
  
  listeners {
    port = 443
    protocol = "HTTPS"
    target_port = 3000
    target_protocol = "HTTP"
    ssl_certificate_id = leaseweb_ssl_certificate.main.id
  }
}

# ============================================================================
# APPLICATION SERVERS
# ============================================================================
resource "leaseweb_instance" "app" {
  count = 2
  name = "nextjs-app-${count.index + 1}"
  image = "ubuntu-22.04"
  flavor = "Standard-4-8GB"
  vpc_id = leaseweb_virtual_private_cloud.main.id
  subnet_id = leaseweb_subnet.private.id
  
  user_data = templatefile("${path.module}/user-data.sh", {
    docker_image = var.docker_image
    database_url = var.database_url
    redis_url = var.redis_url
  })
  
  tags = {
    Environment = var.environment
    Application = "nextjs-stripe-template"
  }
}

# ============================================================================
# DATABASE
# ============================================================================
resource "leaseweb_database" "postgresql" {
  name = "nextjs-stripe-db"
  engine = "postgresql"
  version = "15"
  flavor = "Standard-2-4GB"
  vpc_id = leaseweb_virtual_private_cloud.main.id
  subnet_id = leaseweb_subnet.private.id
  
  backup_retention_days = 30
  backup_time = "02:00"
  
  replica {
    count = 1
    flavor = "Standard-2-4GB"
  }
}

# ============================================================================
# REDIS CACHE
# ============================================================================
resource "leaseweb_cache" "redis" {
  name = "nextjs-stripe-cache"
  engine = "redis"
  version = "7"
  flavor = "Standard-1-1GB"
  vpc_id = leaseweb_virtual_private_cloud.main.id
  subnet_id = leaseweb_subnet.private.id
}

# ============================================================================
# SSL CERTIFICATE
# ============================================================================
resource "leaseweb_ssl_certificate" "main" {
  name = "nextjs-stripe-template-ssl"
  domain_name = var.domain_name
  validation_method = "DNS"
}

# ============================================================================
# MONITORING
# ============================================================================
resource "leaseweb_monitoring" "app_monitoring" {
  name = "nextjs-app-monitoring"
  
  targets = [
    for instance in leaseweb_instance.app : {
      type = "instance"
      id = instance.id
      port = 3000
      path = "/api/health"
    }
  ]
  
  alert_channels = [
    leaseweb_alert_channel.slack.id,
    leaseweb_alert_channel.email.id
  ]
}

resource "leaseweb_alert_channel" "slack" {
  name = "slack-alerts"
  type = "slack"
  webhook_url = var.slack_webhook_url
}

resource "leaseweb_alert_channel" "email" {
  name = "email-alerts"
  type = "email"
  email = var.alert_email
}
```

### 4.2 Server Configuration Script

```bash
#!/bin/bash
# scripts/user-data.sh

# Update system
apt-get update && apt-get upgrade -y

# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sh get-docker.sh
usermod -aG docker ubuntu

# Install Docker Compose
curl -L "https://github.com/docker/compose/releases/download/v2.20.0/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
chmod +x /usr/local/bin/docker-compose

# Install monitoring agent
curl -sSO https://dl.google.com/cloudagents/add-logging-agent-repo.sh
sudo bash add-logging-agent-repo.sh
sudo apt-get update
sudo apt-get install -y google-fluentd

# Create application directory
mkdir -p /opt/nextjs-app
cd /opt/nextjs-app

# Create docker-compose.yml
cat > docker-compose.yml << EOF
version: '3.8'

services:
  app:
    image: ${docker_image}
    restart: unless-stopped
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - DATABASE_URL=${database_url}
      - REDIS_URL=${redis_url}
      - PORT=3000
    health check:
      test: ["CMD", "curl", "-f", "http://localhost:3000/api/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "3"
EOF

# Start the application
docker-compose up -d

# Setup log rotation
cat > /etc/logrotate.d/docker << EOF
/var/lib/docker/containers/*/*.log {
  rotate 7
  daily
  compress
  delaycompress
  missingok
  notifempty
  create 644 root root
}
EOF

# Setup monitoring
systemctl enable google-fluentd
systemctl start google-fluentd
```

## 5. Database Migration Strategy

### 5.1 Migration Script

```bash
#!/bin/bash
# scripts/run-migrations.sh

set -e

echo "Starting database migration process..."

# Backup current database
echo "Creating database backup..."
BACKUP_FILE="backup-$(date +%Y%m%d-%H%M%S).sql"
pg_dump $DATABASE_URL > "/tmp/$BACKUP_FILE"

# Upload backup to secure storage
aws s3 cp "/tmp/$BACKUP_FILE" "s3://backups-bucket/database/"

echo "Database backup created: $BACKUP_FILE"

# Run Prisma migrations
echo "Running Prisma migrations..."
npx prisma migrate deploy

# Verify migration
echo "Verifying database schema..."
npx prisma db pull --force
npx prisma generate

echo "Database migration completed successfully!"

# Run data migrations if needed
if [ -f "./scripts/data-migration.js" ]; then
  echo "Running data migrations..."
  node ./scripts/data-migration.js
fi

echo "Migration process completed!"
```

### 5.2 Data Migration Example

```javascript
// scripts/data-migration.js
const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()

async function runDataMigrations() {
  console.log('Starting data migrations...')

  try {
    // Example: Update existing products with new fields
    const productsWithoutSlug = await prisma.product.findMany({
      where: { slug: null },
    })

    for (const product of productsWithoutSlug) {
      const slug = product.name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')

      await prisma.product.update({
        where: { id: product.id },
        data: { slug },
      })
    }

    console.log(`Updated ${productsWithoutSlug.length} products with slugs`)

    // Example: Migrate user data
    await prisma.user.updateMany({
      where: { timezone: null },
      data: { timezone: 'UTC' },
    })

    console.log('Data migrations completed successfully!')
  } catch (error) {
    console.error('Data migration failed:', error)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

runDataMigrations()
```

## 6. Monitoring & Observability

### 6.1 Application Health Checks

```typescript
// app/api/health/route.ts
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { redis } from '@/lib/redis'

export async function GET() {
  const checks = {
    timestamp: new Date().toISOString(),
    status: 'healthy',
    version: process.env.npm_package_version,
    uptime: process.uptime(),
    checks: {
      database: 'unknown',
      redis: 'unknown',
      external_apis: 'unknown',
    },
  }

  try {
    // Database check
    await prisma.$queryRaw`SELECT 1`
    checks.checks.database = 'healthy'
  } catch (error) {
    checks.checks.database = 'unhealthy'
    checks.status = 'unhealthy'
  }

  try {
    // Redis check
    await redis.ping()
    checks.checks.redis = 'healthy'
  } catch (error) {
    checks.checks.redis = 'unhealthy'
    checks.status = 'degraded'
  }

  try {
    // Stripe API check
    const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY)
    await stripe.balance.retrieve()
    checks.checks.external_apis = 'healthy'
  } catch (error) {
    checks.checks.external_apis = 'unhealthy'
    if (checks.status === 'healthy') {
      checks.status = 'degraded'
    }
  }

  const statusCode = checks.status === 'healthy' ? 200 : 503
  return NextResponse.json(checks, { status: statusCode })
}
```

### 6.2 Prometheus Metrics

```typescript
// lib/metrics.ts
import { register, collectDefaultMetrics, Counter, Histogram, Gauge } from 'prom-client'

// Collect default metrics
collectDefaultMetrics({ register })

// Custom metrics
export const httpRequestDuration = new Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.1, 0.5, 1, 2, 5],
})

export const httpRequestTotal = new Counter({
  name: 'http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status_code'],
})

export const activeUsers = new Gauge({
  name: 'active_users_total',
  help: 'Total number of active users',
})

export const stripePayments = new Counter({
  name: 'stripe_payments_total',
  help: 'Total number of Stripe payments',
  labelNames: ['status', 'currency'],
})

export const databaseConnections = new Gauge({
  name: 'database_connections_active',
  help: 'Number of active database connections',
})

// Metrics endpoint
export async function getMetrics() {
  return register.metrics()
}
```

### 6.3 Logging Configuration

```typescript
// lib/logger.ts
import winston from 'winston'

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: {
    service: 'nextjs-stripe-template',
    version: process.env.npm_package_version,
  },
  transports: [
    new winston.transports.File({ filename: '/var/log/app/error.log', level: 'error' }),
    new winston.transports.File({ filename: '/var/log/app/combined.log' }),
  ],
})

if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: winston.format.simple()
  }))
}

export { logger }

// Usage example
export const auditLogger = {
  logUserAction: (userId: string, action: string, details: any) => {
    logger.info('User action', {
      userId,
      action,
      details,
      category: 'audit',
    })
  },
  
  logSecurityEvent: (event: string, details: any) => {
    logger.warn('Security event', {
      event,
      details,
      category: 'security',
    })
  },
  
  logPaymentEvent: (userId: string, event: string, amount: number, currency: string) => {
    logger.info('Payment event', {
      userId,
      event,
      amount,
      currency,
      category: 'payment',
    })
  },
}
```

## 7. Backup & Disaster Recovery

### 7.1 Backup Strategy

```bash
#!/bin/bash
# scripts/backup.sh

# Configuration
BACKUP_DIR="/backups"
S3_BUCKET="your-backup-bucket"
RETENTION_DAYS=30

# Create backup directory
mkdir -p $BACKUP_DIR

# Database backup
echo "Creating database backup..."
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
DB_BACKUP_FILE="$BACKUP_DIR/database_backup_$TIMESTAMP.sql"

pg_dump $DATABASE_URL | gzip > "$DB_BACKUP_FILE.gz"

# File system backup (if needed)
echo "Creating file system backup..."
tar -czf "$BACKUP_DIR/files_backup_$TIMESTAMP.tar.gz" /opt/nextjs-app/uploads

# Upload to S3
echo "Uploading backups to S3..."
aws s3 cp "$DB_BACKUP_FILE.gz" "s3://$S3_BUCKET/database/"
aws s3 cp "$BACKUP_DIR/files_backup_$TIMESTAMP.tar.gz" "s3://$S3_BUCKET/files/"

# Clean up old local backups
find $BACKUP_DIR -name "*.sql.gz" -mtime +7 -delete
find $BACKUP_DIR -name "*.tar.gz" -mtime +7 -delete

# Clean up old S3 backups
aws s3 ls "s3://$S3_BUCKET/database/" | grep -v "$(date +%Y-%m)" | awk '{print $4}' | while read file; do
  aws s3 rm "s3://$S3_BUCKET/database/$file"
done

echo "Backup completed successfully!"
```

### 7.2 Disaster Recovery Plan

```bash
#!/bin/bash
# scripts/disaster-recovery.sh

# Emergency recovery script
# This script should be tested regularly and kept up to date

set -e

echo "Starting disaster recovery process..."

# Step 1: Provision new infrastructure
echo "Provisioning new infrastructure..."
terraform init
terraform plan -var-file="disaster-recovery.tfvars"
terraform apply -auto-approve -var-file="disaster-recovery.tfvars"

# Step 2: Restore database from latest backup
echo "Restoring database from backup..."
LATEST_BACKUP=$(aws s3 ls s3://your-backup-bucket/database/ | sort | tail -n 1 | awk '{print $4}')
aws s3 cp "s3://your-backup-bucket/database/$LATEST_BACKUP" /tmp/
gunzip "/tmp/$LATEST_BACKUP"

# Restore database
psql $NEW_DATABASE_URL < "/tmp/${LATEST_BACKUP%.gz}"

# Step 3: Deploy application
echo "Deploying application to new infrastructure..."
./scripts/deploy-production.sh

# Step 4: Update DNS
echo "Updating DNS records..."
# Update DNS to point to new infrastructure
# This would typically use your DNS provider's API

# Step 5: Verify deployment
echo "Verifying deployment..."
curl -f https://your-domain.com/api/health || exit 1

# Step 6: Notify team
echo "Notifying team of successful disaster recovery..."
slack-notify "Disaster recovery completed successfully. New infrastructure is live."

echo "Disaster recovery completed!"
```

## 8. Performance Optimization

### 8.1 Caching Strategy

```typescript
// lib/cache.ts
import { Redis } from 'ioredis'

const redis = new Redis(process.env.REDIS_URL!)

export class CacheService {
  private static TTL = {
    SHORT: 300,    // 5 minutes
    MEDIUM: 1800,  // 30 minutes
    LONG: 3600,    // 1 hour
    DAILY: 86400,  // 24 hours
  }

  static async get<T>(key: string): Promise<T | null> {
    try {
      const value = await redis.get(key)
      return value ? JSON.parse(value) : null
    } catch (error) {
      console.error('Cache get error:', error)
      return null
    }
  }

  static async set(key: string, value: any, ttl: number = this.TTL.MEDIUM): Promise<void> {
    try {
      await redis.setex(key, ttl, JSON.stringify(value))
    } catch (error) {
      console.error('Cache set error:', error)
    }
  }

  static async del(key: string): Promise<void> {
    try {
      await redis.del(key)
    } catch (error) {
      console.error('Cache delete error:', error)
    }
  }

  static async invalidatePattern(pattern: string): Promise<void> {
    try {
      const keys = await redis.keys(pattern)
      if (keys.length > 0) {
        await redis.del(...keys)
      }
    } catch (error) {
      console.error('Cache invalidate error:', error)
    }
  }

  // Specific caching methods
  static async cacheProduct(productId: string, product: any): Promise<void> {
    await this.set(`product:${productId}`, product, this.TTL.LONG)
  }

  static async getCachedProduct(productId: string): Promise<any> {
    return this.get(`product:${productId}`)
  }

  static async cacheUserSession(userId: string, sessionData: any): Promise<void> {
    await this.set(`session:${userId}`, sessionData, this.TTL.MEDIUM)
  }

  static async invalidateUserCache(userId: string): Promise<void> {
    await this.invalidatePattern(`*user:${userId}*`)
  }
}
```

### 8.2 Database Optimization

```sql
-- Database optimization queries

-- Create indexes for better performance
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_email_active ON users(email) WHERE status = 'ACTIVE';
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_orders_user_created ON orders(user_id, created_at DESC);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_products_status_featured ON products(status, featured DESC) WHERE status = 'PUBLISHED';
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_subscriptions_status_period ON subscriptions(status, current_period_end) WHERE status = 'ACTIVE';
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_audit_logs_created_resource ON audit_logs(created_at DESC, resource);

-- Partial indexes for commonly filtered data
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_orders_completed ON orders(created_at DESC) WHERE status = 'COMPLETED';
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_customers ON users(created_at DESC) WHERE role = 'CUSTOMER';

-- Full-text search indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_products_search ON products USING gin(to_tsvector('english', name || ' ' || description));

-- Database maintenance procedures
CREATE OR REPLACE FUNCTION cleanup_old_audit_logs()
RETURNS void AS $$
BEGIN
    DELETE FROM audit_logs WHERE created_at < NOW() - INTERVAL '90 days';
END;
$$ LANGUAGE plpgsql;

-- Schedule cleanup (requires pg_cron extension)
SELECT cron.schedule('cleanup-audit-logs', '0 2 * * 0', 'SELECT cleanup_old_audit_logs();');
```

This comprehensive deployment strategy provides a robust foundation for deploying and maintaining the NextJS Stripe Payment Template in production with proper monitoring, backup strategies, and performance optimization.