# Database Schema Design with Prisma

## 1. Database Overview

The database schema is designed to support a multi-tenant SaaS payment system with role-based access control, product management, subscription billing, and comprehensive analytics tracking.

### 1.1 Design Principles
- **Normalization**: Third normal form for data integrity
- **Performance**: Strategic indexing for common queries
- **Scalability**: Designed for horizontal partitioning
- **Audit Trail**: Comprehensive tracking of changes
- **Security**: Sensitive data encryption at application layer

## 2. Complete Prisma Schema

```prisma
// This is your Prisma schema file,
// learn more about it in the docs: https://pris.ly/d/prisma-schema

generator client {
  provider = "prisma-client-js"
  previewFeatures = ["fullTextSearch", "postgresqlExtensions"]
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
  extensions = [uuid_ossp(map: "uuid-ossp")]
}

// ============================================================================
// USER MANAGEMENT & AUTHENTICATION
// ============================================================================

model User {
  id                String   @id @default(cuid())
  email             String   @unique
  emailVerified     Boolean  @default(false)
  emailVerifiedAt   DateTime?
  password          String?  // Hashed password
  name              String?
  avatar            String?  // URL to avatar image
  role              UserRole @default(CUSTOMER)
  status            UserStatus @default(ACTIVE)
  
  // Profile information
  firstName         String?
  lastName          String?
  phone             String?
  dateOfBirth       DateTime?
  timezone          String   @default("UTC")
  language          String   @default("en")
  
  // Billing information
  stripeCustomerId  String?  @unique
  billingAddress    Json?    // Flexible billing address storage
  taxId             String?  // Tax identification number
  
  // System fields
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt
  lastLoginAt       DateTime?
  deletedAt         DateTime?
  
  // Relations
  sessions          Session[]
  orders            Order[]
  subscriptions     Subscription[]
  paymentMethods    PaymentMethod[]
  supportTickets    SupportTicket[] @relation("CustomerTickets")
  assignedTickets   SupportTicket[] @relation("AssignedTickets")
  discountUsages    DiscountUsage[]
  auditLogs         AuditLog[]
  
  @@map("users")
}

enum UserRole {
  ADMIN
  CUSTOMER
  SUPPORT
}

enum UserStatus {
  ACTIVE
  INACTIVE
  SUSPENDED
  DELETED
}

model Session {
  id        String   @id @default(cuid())
  userId    String
  token     String   @unique
  expiresAt DateTime
  ipAddress String?
  userAgent String?
  createdAt DateTime @default(now())
  
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  
  @@map("sessions")
}

// ============================================================================
// PRODUCT MANAGEMENT
// ============================================================================

model Product {
  id              String        @id @default(cuid())
  name            String
  description     String
  shortDescription String?
  slug            String        @unique
  status          ProductStatus @default(DRAFT)
  type            ProductType
  
  // Pricing
  basePrice       Decimal       @db.Decimal(10, 2)
  currency        String        @default("USD")
  taxRate         Decimal?      @db.Decimal(5, 4)
  
  // Digital product fields
  downloadUrl     String?
  downloadLimit   Int?          @default(-1) // -1 = unlimited
  accessDuration  Int?          // Days of access, null = lifetime
  
  // Subscription fields
  billingInterval String?       // month, year
  trialDays       Int?          @default(0)
  
  // Media and content
  images          Json          @default("[]") // Array of image URLs
  files           Json          @default("[]") // Array of file attachments
  metadata        Json          @default("{}")  // Flexible metadata storage
  
  // SEO and marketing
  metaTitle       String?
  metaDescription String?
  tags            String[]      @default([])
  featured        Boolean       @default(false)
  
  // Inventory (for physical products if needed)
  trackInventory  Boolean       @default(false)
  stockQuantity   Int           @default(0)
  lowStockThreshold Int?
  
  // System fields
  createdAt       DateTime      @default(now())
  updatedAt       DateTime      @updatedAt
  publishedAt     DateTime?
  deletedAt       DateTime?
  
  // Relations
  prices          Price[]
  orderItems      OrderItem[]
  subscriptions   Subscription[]
  discounts       ProductDiscount[]
  reviews         ProductReview[]
  categories      ProductCategory[]
  
  @@map("products")
}

enum ProductStatus {
  DRAFT
  PUBLISHED
  ARCHIVED
  DELETED
}

enum ProductType {
  ONE_TIME
  SUBSCRIPTION
  DIGITAL_DOWNLOAD
  SERVICE
}

model Price {
  id              String      @id @default(cuid())
  productId       String
  stripePriceId   String      @unique
  nickname        String?
  unitAmount      Decimal     @db.Decimal(10, 2)
  currency        String      @default("USD")
  recurring       Json?       // Stripe recurring object
  type            PriceType
  active          Boolean     @default(true)
  
  createdAt       DateTime    @default(now())
  updatedAt       DateTime    @updatedAt
  
  product         Product     @relation(fields: [productId], references: [id], onDelete: Cascade)
  orderItems      OrderItem[]
  subscriptions   Subscription[]
  
  @@map("prices")
}

enum PriceType {
  ONE_TIME
  RECURRING
}

model ProductCategory {
  id            String    @id @default(cuid())
  name          String
  slug          String    @unique
  description   String?
  parentId      String?
  sortOrder     Int       @default(0)
  
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt
  
  parent        ProductCategory? @relation("CategoryHierarchy", fields: [parentId], references: [id])
  children      ProductCategory[] @relation("CategoryHierarchy")
  products      Product[]
  
  @@map("product_categories")
}

model ProductReview {
  id          String   @id @default(cuid())
  productId   String
  userId      String
  rating      Int      // 1-5 stars
  title       String?
  content     String
  verified    Boolean  @default(false) // Verified purchase
  helpful     Int      @default(0)     // Helpful votes
  
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  
  product     Product  @relation(fields: [productId], references: [id], onDelete: Cascade)
  user        User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  
  @@unique([productId, userId]) // One review per user per product
  @@map("product_reviews")
}

// ============================================================================
// ORDER MANAGEMENT
// ============================================================================

model Order {
  id                String      @id @default(cuid())
  userId            String
  stripePaymentIntentId String? @unique
  
  // Order details
  orderNumber       String      @unique
  status            OrderStatus @default(PENDING)
  currency          String      @default("USD")
  
  // Amounts
  subtotal          Decimal     @db.Decimal(10, 2)
  taxAmount         Decimal     @db.Decimal(10, 2) @default(0.00)
  discountAmount    Decimal     @db.Decimal(10, 2) @default(0.00)
  totalAmount       Decimal     @db.Decimal(10, 2)
  
  // Addresses
  billingAddress    Json
  shippingAddress   Json?
  
  // Payment information
  paymentStatus     PaymentStatus @default(PENDING)
  paymentMethod     String?     // card, bank_transfer, etc.
  refundedAmount    Decimal     @db.Decimal(10, 2) @default(0.00)
  
  // Order metadata
  notes             String?
  internalNotes     String?     // Admin only
  metadata          Json        @default("{}")
  
  // System fields
  createdAt         DateTime    @default(now())
  updatedAt         DateTime    @updatedAt
  completedAt       DateTime?
  cancelledAt       DateTime?
  
  // Relations
  user              User        @relation(fields: [userId], references: [id])
  items             OrderItem[]
  refunds           Refund[]
  
  @@map("orders")
}

enum OrderStatus {
  PENDING
  PROCESSING
  COMPLETED
  CANCELLED
  REFUNDED
}

enum PaymentStatus {
  PENDING
  PROCESSING
  SUCCEEDED
  FAILED
  CANCELLED
  REFUNDED
}

model OrderItem {
  id            String    @id @default(cuid())
  orderId       String
  productId     String
  priceId       String
  
  quantity      Int       @default(1)
  unitPrice     Decimal   @db.Decimal(10, 2)
  totalPrice    Decimal   @db.Decimal(10, 2)
  
  // Digital product access
  downloadCount Int       @default(0)
  accessExpiresAt DateTime?
  
  createdAt     DateTime  @default(now())
  
  order         Order     @relation(fields: [orderId], references: [id], onDelete: Cascade)
  product       Product   @relation(fields: [productId], references: [id])
  price         Price     @relation(fields: [priceId], references: [id])
  
  @@map("order_items")
}

// ============================================================================
// SUBSCRIPTION MANAGEMENT
// ============================================================================

model Subscription {
  id                    String             @id @default(cuid())
  userId                String
  productId             String
  priceId               String
  stripeSubscriptionId  String             @unique
  
  status                SubscriptionStatus
  currentPeriodStart    DateTime
  currentPeriodEnd      DateTime
  cancelAtPeriodEnd     Boolean            @default(false)
  canceledAt            DateTime?
  trialStart            DateTime?
  trialEnd              DateTime?
  
  // Billing
  currency              String             @default("USD")
  unitAmount            Decimal            @db.Decimal(10, 2)
  quantity              Int                @default(1)
  
  // Metadata
  metadata              Json               @default("{}")
  
  createdAt             DateTime           @default(now())
  updatedAt             DateTime           @updatedAt
  
  user                  User               @relation(fields: [userId], references: [id])
  product               Product            @relation(fields: [productId], references: [id])
  price                 Price              @relation(fields: [priceId], references: [id])
  invoices              Invoice[]
  
  @@map("subscriptions")
}

enum SubscriptionStatus {
  TRIALING
  ACTIVE
  PAST_DUE
  CANCELLED
  UNPAID
  INCOMPLETE
  INCOMPLETE_EXPIRED
  PAUSED
}

model Invoice {
  id                String        @id @default(cuid())
  subscriptionId    String
  stripeInvoiceId   String        @unique
  
  number            String        @unique
  status            InvoiceStatus
  currency          String        @default("USD")
  
  // Amounts
  subtotal          Decimal       @db.Decimal(10, 2)
  tax               Decimal       @db.Decimal(10, 2) @default(0.00)
  total             Decimal       @db.Decimal(10, 2)
  amountPaid        Decimal       @db.Decimal(10, 2) @default(0.00)
  amountDue         Decimal       @db.Decimal(10, 2)
  
  // Dates
  periodStart       DateTime
  periodEnd         DateTime
  dueDate           DateTime?
  paidAt            DateTime?
  
  createdAt         DateTime      @default(now())
  updatedAt         DateTime      @updatedAt
  
  subscription      Subscription  @relation(fields: [subscriptionId], references: [id])
  
  @@map("invoices")
}

enum InvoiceStatus {
  DRAFT
  OPEN
  PAID
  VOID
  UNCOLLECTIBLE
}

// ============================================================================
// PAYMENT METHODS
// ============================================================================

model PaymentMethod {
  id                String  @id @default(cuid())
  userId            String
  stripePaymentMethodId String @unique
  
  type              String  // card, bank_account, etc.
  card              Json?   // Card details from Stripe
  billingDetails    Json?   // Billing address and info
  
  isDefault         Boolean @default(false)
  
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt
  
  user              User    @relation(fields: [userId], references: [id], onDelete: Cascade)
  
  @@map("payment_methods")
}

// ============================================================================
// DISCOUNT & PROMOTION SYSTEM
// ============================================================================

model Discount {
  id                String          @id @default(cuid())
  code              String          @unique
  name              String
  description       String?
  
  type              DiscountType    // PERCENTAGE, FIXED_AMOUNT
  value             Decimal         @db.Decimal(10, 4) // 25.5% or $25.50
  currency          String?         @default("USD")
  
  // Usage limits
  maxUses           Int?            // null = unlimited
  maxUsesPerCustomer Int?           // null = unlimited
  currentUses       Int             @default(0)
  
  // Time constraints
  validFrom         DateTime?
  validUntil        DateTime?
  
  // Constraints
  minimumAmount     Decimal?        @db.Decimal(10, 2)
  firstTimeOnly     Boolean         @default(false)
  
  active            Boolean         @default(true)
  
  createdAt         DateTime        @default(now())
  updatedAt         DateTime        @updatedAt
  
  // Relations
  productDiscounts  ProductDiscount[]
  usages            DiscountUsage[]
  
  @@map("discounts")
}

enum DiscountType {
  PERCENTAGE
  FIXED_AMOUNT
}

model ProductDiscount {
  id          String   @id @default(cuid())
  productId   String
  discountId  String
  
  createdAt   DateTime @default(now())
  
  product     Product  @relation(fields: [productId], references: [id], onDelete: Cascade)
  discount    Discount @relation(fields: [discountId], references: [id], onDelete: Cascade)
  
  @@unique([productId, discountId])
  @@map("product_discounts")
}

model DiscountUsage {
  id          String   @id @default(cuid())
  discountId  String
  userId      String
  orderId     String?
  
  amountSaved Decimal  @db.Decimal(10, 2)
  
  createdAt   DateTime @default(now())
  
  discount    Discount @relation(fields: [discountId], references: [id])
  user        User     @relation(fields: [userId], references: [id])
  
  @@map("discount_usages")
}

// ============================================================================
// REFUND MANAGEMENT
// ============================================================================

model Refund {
  id              String      @id @default(cuid())
  orderId         String
  stripeRefundId  String      @unique
  
  amount          Decimal     @db.Decimal(10, 2)
  currency        String      @default("USD")
  reason          RefundReason
  status          RefundStatus
  
  notes           String?
  metadata        Json        @default("{}")
  
  createdAt       DateTime    @default(now())
  updatedAt       DateTime    @updatedAt
  processedAt     DateTime?
  
  order           Order       @relation(fields: [orderId], references: [id])
  
  @@map("refunds")
}

enum RefundReason {
  REQUESTED_BY_CUSTOMER
  DUPLICATE
  FRAUDULENT
  SUBSCRIPTION_CANCELED
  OTHER
}

enum RefundStatus {
  PENDING
  SUCCEEDED
  FAILED
  CANCELED
}

// ============================================================================
// SUPPORT SYSTEM
// ============================================================================

model SupportTicket {
  id          String        @id @default(cuid())
  customerId  String
  assigneeId  String?
  
  subject     String
  description String
  status      TicketStatus  @default(OPEN)
  priority    TicketPriority @default(MEDIUM)
  
  metadata    Json          @default("{}")
  
  createdAt   DateTime      @default(now())
  updatedAt   DateTime      @updatedAt
  resolvedAt  DateTime?
  
  customer    User          @relation("CustomerTickets", fields: [customerId], references: [id])
  assignee    User?         @relation("AssignedTickets", fields: [assigneeId], references: [id])
  messages    TicketMessage[]
  
  @@map("support_tickets")
}

enum TicketStatus {
  OPEN
  IN_PROGRESS
  RESOLVED
  CLOSED
}

enum TicketPriority {
  LOW
  MEDIUM
  HIGH
  URGENT
}

model TicketMessage {
  id        String   @id @default(cuid())
  ticketId  String
  userId    String
  
  content   String
  isInternal Boolean @default(false)
  
  createdAt DateTime @default(now())
  
  ticket    SupportTicket @relation(fields: [ticketId], references: [id], onDelete: Cascade)
  
  @@map("ticket_messages")
}

// ============================================================================
// ANALYTICS & REPORTING
// ============================================================================

model Analytics {
  id          String      @id @default(cuid())
  date        DateTime    @db.Date
  metric      String      // mrr, new_customers, churn_rate, etc.
  value       Decimal     @db.Decimal(15, 4)
  metadata    Json        @default("{}")
  
  createdAt   DateTime    @default(now())
  
  @@unique([date, metric])
  @@map("analytics")
}

// ============================================================================
// AUDIT & SYSTEM LOGS
// ============================================================================

model AuditLog {
  id          String      @id @default(cuid())
  userId      String?
  action      String      // CREATE, UPDATE, DELETE, LOGIN, etc.
  resource    String      // users, products, orders, etc.
  resourceId  String?
  
  oldValues   Json?
  newValues   Json?
  metadata    Json        @default("{}")
  
  ipAddress   String?
  userAgent   String?
  
  createdAt   DateTime    @default(now())
  
  user        User?       @relation(fields: [userId], references: [id])
  
  @@map("audit_logs")
}

// ============================================================================
// SYSTEM CONFIGURATION
// ============================================================================

model SystemConfig {
  id        String   @id @default(cuid())
  key       String   @unique
  value     String
  
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  
  @@map("system_config")
}
```

## 3. Database Indexes and Performance

### 3.1 Critical Indexes

```sql
-- User lookups
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_stripe_customer_id ON users(stripe_customer_id);
CREATE INDEX idx_users_role_status ON users(role, status);

-- Product searches
CREATE INDEX idx_products_status_featured ON products(status, featured);
CREATE INDEX idx_products_type_status ON products(type, status);
CREATE INDEX idx_products_slug ON products(slug);

-- Order processing
CREATE INDEX idx_orders_user_id_created_at ON orders(user_id, created_at DESC);
CREATE INDEX idx_orders_stripe_payment_intent_id ON orders(stripe_payment_intent_id);
CREATE INDEX idx_orders_status_created_at ON orders(status, created_at);

-- Subscription management
CREATE INDEX idx_subscriptions_user_id ON subscriptions(user_id);
CREATE INDEX idx_subscriptions_stripe_subscription_id ON subscriptions(stripe_subscription_id);
CREATE INDEX idx_subscriptions_status ON subscriptions(status);
CREATE INDEX idx_subscriptions_current_period_end ON subscriptions(current_period_end);

-- Analytics queries
CREATE INDEX idx_analytics_date_metric ON analytics(date, metric);
CREATE INDEX idx_audit_logs_user_id_created_at ON audit_logs(user_id, created_at DESC);
```

### 3.2 Query Optimization

```typescript
// Example optimized queries using Prisma

// Dashboard analytics - efficient aggregation
const monthlyRevenue = await prisma.order.aggregate({
  where: {
    status: 'COMPLETED',
    createdAt: {
      gte: startOfMonth,
      lte: endOfMonth,
    },
  },
  _sum: {
    totalAmount: true,
  },
});

// Product catalog with pagination
const products = await prisma.product.findMany({
  where: {
    status: 'PUBLISHED',
  },
  include: {
    prices: {
      where: { active: true },
    },
    _count: {
      select: { reviews: true },
    },
  },
  orderBy: [
    { featured: 'desc' },
    { createdAt: 'desc' },
  ],
  skip: page * limit,
  take: limit,
});

// User subscription status with related data
const userWithSubscriptions = await prisma.user.findUnique({
  where: { id: userId },
  include: {
    subscriptions: {
      where: {
        status: {
          in: ['TRIALING', 'ACTIVE'],
        },
      },
      include: {
        product: true,
        price: true,
      },
    },
    paymentMethods: {
      where: { isDefault: true },
    },
  },
});
```

## 4. Data Migration Strategy

### 4.1 Initial Setup

```bash
# Initialize Prisma
npx prisma init

# Generate and run migrations
npx prisma migrate dev --name init

# Generate Prisma client
npx prisma generate

# Seed database with initial data
npx prisma db seed
```

### 4.2 Seed Data Script

```typescript
// prisma/seed.ts
import { PrismaClient, UserRole } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  // Create admin user
  const adminUser = await prisma.user.create({
    data: {
      email: 'admin@example.com',
      password: await bcrypt.hash('admin123', 12),
      name: 'System Administrator',
      role: UserRole.ADMIN,
      emailVerified: true,
    },
  });

  // Create sample product categories
  const digitalCategory = await prisma.productCategory.create({
    data: {
      name: 'Digital Products',
      slug: 'digital-products',
      description: 'Digital downloads and services',
    },
  });

  // Create sample products
  const sampleProduct = await prisma.product.create({
    data: {
      name: 'Premium Subscription',
      description: 'Access to all premium features',
      slug: 'premium-subscription',
      type: 'SUBSCRIPTION',
      status: 'PUBLISHED',
      basePrice: 29.99,
      billingInterval: 'month',
      trialDays: 14,
      categories: {
        connect: { id: digitalCategory.id },
      },
    },
  });

  console.log('Seed data created successfully');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
```

## 5. Data Validation and Constraints

### 5.1 Application-Level Validation

```typescript
// schemas/user.ts
import { z } from 'zod';

export const userRegistrationSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  name: z.string().min(2, 'Name must be at least 2 characters'),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  phone: z.string().optional(),
});

export const productSchema = z.object({
  name: z.string().min(1, 'Product name is required'),
  description: z.string().min(10, 'Description must be at least 10 characters'),
  basePrice: z.number().positive('Price must be positive'),
  type: z.enum(['ONE_TIME', 'SUBSCRIPTION', 'DIGITAL_DOWNLOAD', 'SERVICE']),
  billingInterval: z.enum(['month', 'year']).optional(),
});
```

### 5.2 Database Constraints

```sql
-- Ensure positive amounts
ALTER TABLE orders ADD CONSTRAINT check_positive_total CHECK (total_amount >= 0);
ALTER TABLE order_items ADD CONSTRAINT check_positive_quantity CHECK (quantity > 0);
ALTER TABLE products ADD CONSTRAINT check_positive_price CHECK (base_price >= 0);

-- Ensure valid email formats (additional validation)
ALTER TABLE users ADD CONSTRAINT check_email_format CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$');

-- Ensure discount values are reasonable
ALTER TABLE discounts ADD CONSTRAINT check_discount_percentage CHECK (
  (type = 'PERCENTAGE' AND value > 0 AND value <= 100) OR 
  (type = 'FIXED_AMOUNT' AND value > 0)
);
```

## 6. Backup and Recovery Strategy

### 6.1 Automated Backups

```bash
#!/bin/bash
# backup-database.sh

DATABASE_URL="postgresql://user:password@localhost:5432/payment_template"
BACKUP_DIR="/backups/postgres"
DATE=$(date +%Y%m%d_%H%M%S)

# Create full backup
pg_dump $DATABASE_URL | gzip > "$BACKUP_DIR/full_backup_$DATE.sql.gz"

# Retain last 30 days of backups
find $BACKUP_DIR -name "full_backup_*.sql.gz" -mtime +30 -delete
```

### 6.2 Point-in-Time Recovery

```sql
-- Enable point-in-time recovery
ALTER SYSTEM SET wal_level = replica;
ALTER SYSTEM SET archive_mode = on;
ALTER SYSTEM SET archive_command = 'cp %p /var/lib/postgresql/archive/%f';
```

## 7. Security Considerations

### 7.1 Data Protection

- **Sensitive Data**: Passwords hashed with bcrypt (12 rounds minimum)
- **PII Protection**: Personal information encrypted at rest
- **Payment Security**: No payment card data stored (PCI compliance)
- **Audit Trail**: All critical operations logged with user attribution

### 7.2 Access Control

- **Row Level Security**: Implement RLS for multi-tenant data isolation
- **Connection Pooling**: Use PgBouncer for connection management
- **SSL/TLS**: All database connections encrypted
- **Principle of Least Privilege**: Database users with minimal required permissions

This database schema provides a robust foundation for the NextJS Stripe Payment Template, supporting all required features while maintaining performance, security, and scalability.