# Database Seeding System

This project includes a comprehensive, modular database seeding system that creates realistic test data for development, testing, and staging environments.

## Overview

The enhanced seeding system provides:

- **Modular Architecture**: Organized into focused modules (users, products, orders, etc.)
- **Environment-Specific Seeding**: Different data volumes for dev/test/staging
- **Realistic Test Data**: Stripe-compatible payment methods, diverse product catalog, realistic order scenarios
- **Comprehensive Audit Logging**: Full audit trail for all seeded operations
- **Data Integrity**: Proper foreign key relationships and constraint compliance
- **Testing Scenarios**: Special edge cases for thorough testing

## Quick Start

```bash
# Run seeding with auto-detection
npm run db:seed

# Specific environment seeding
SEED_MODE=development npm run db:seed
SEED_MODE=test npm run db:seed
SEED_MODE=staging npm run db:seed
SEED_MODE=minimal npm run db:seed
```

## Seeding Modes

### Development Mode (Default)
- **Users**: 12 (2 admins, 2 support, 8 customers)
- **Products**: 15 (mix of physical/digital, one-time/subscription)
- **Orders**: 30 with realistic scenarios
- **Full Features**: All payment methods, subscriptions, audit logs

### Test Mode
- **Users**: 6 (1 admin, 1 support, 4 customers)
- **Products**: 8 essential products
- **Orders**: 15 focused test cases
- **Optimized**: Faster execution, skip audit logs

### Staging Mode
- **Users**: 25 (production-like volume)
- **Products**: 20 comprehensive catalog
- **Orders**: 75 diverse scenarios
- **Full Features**: Complete feature testing

### Minimal Mode (CI/CD)
- **Users**: 3 (essential roles only)
- **Products**: 5 basic products
- **Orders**: 5 minimal test cases
- **Fast**: Optimized for pipeline speed

## Data Created

### Users & Authentication
- **Admin Users**: Full system access, 2FA enabled
- **Support Users**: Customer service access
- **Customer Users**: Various profiles, payment preferences
- **Realistic Data**: Different timezones, currencies, verification states

### Products & Catalog
- **Physical Products**: T-shirts, hoodies, mugs with shipping
- **Digital Products**: eBooks, courses, software licenses
- **Subscription Plans**: Basic/Pro/Enterprise tiers
- **Pricing**: Realistic price points with compare-at pricing

### Payment Infrastructure
- **Stripe Test Cards**: All major card brands (Visa, MC, Amex, etc.)
- **Test Scenarios**: Expired cards, declined transactions
- **International**: Global billing addresses
- **Payment Methods**: Multiple cards per customer

### Orders & Transactions
- **Order Statuses**: Pending, processing, shipped, delivered, cancelled
- **Payment Scenarios**: Success, failure, refund cases
- **Shipping**: Domestic and international addresses
- **Discounts**: Applied discount codes with usage tracking

### Subscriptions
- **Subscription States**: Active, trialing, cancelled, past due
- **Billing Cycles**: Monthly and annual plans
- **Trial Periods**: 7, 14, and 30-day trials
- **Metadata**: Signup sources, cancellation reasons

### Discount Codes
- **Percentage Discounts**: 10%, 15%, 20%, 25% off
- **Fixed Amount**: $5, $10, $25 off
- **Free Shipping**: Conditional and unlimited
- **Test Cases**: Expired, maxed out, inactive codes

## Test Credentials

### Admin Access
```
admin@example.com / admin123!
admin.backup@example.com / backup123!
```

### Support Access
```
support@example.com / support123!
support.tier2@example.com / support456!
```

### Customer Access
```
john.doe@example.com / customer123!
jane.smith@example.com / customer456!
mike.wilson@example.com / customer789! (unverified email)
emma.davis@example.com / customer101!
alex.chen@example.com / customer202!
maria.garcia@example.com / customer303!
inactive.user@example.com / inactive123! (inactive account)
premium.user@example.com / premium123!
```

## Test Discount Codes

### Active Codes
- `WELCOME10`: 10% off for new customers (min $20)
- `NEWBIE15`: 15% off first purchase (min $50)
- `FREESHIP`: Free shipping (min $50)
- `SAVE5`: $5 off orders over $25
- `TENOFF`: $10 off orders over $75
- `BIG25`: $25 off orders over $150
- `FLASH20`: 20% off everything (limited time)
- `STUDENT15`: 15% off for students

### Testing Scenarios
- `EXPIRED20`: Expired code (for testing expiration)
- `MAXEDOUT`: Usage limit reached (for testing limits)
- `INACTIVE10`: Deactivated code (for testing status)
- `FUTURE50`: Future code not yet active

## Stripe Test Data

All payment methods use Stripe's official test card numbers:

### Always Successful Cards
- Visa ending in 4242
- Visa ending in 4000
- Mastercard ending in 5555
- American Express ending in 0005
- Discover ending in 1117

### Test Scenarios
- Card ending in 0341 (expired)
- Card ending in 0002 (declined)
- International billing addresses

## Architecture

```
prisma/seeds/
├── index.ts           # Main seeding orchestrator
├── types.ts           # TypeScript interfaces
├── utils.ts           # Utility functions
├── users.ts           # User and auth seeding
├── products.ts        # Product catalog seeding
├── discountCodes.ts   # Promotional codes
├── paymentMethods.ts  # Stripe payment methods
├── orders.ts          # Order and transaction history
└── subscriptions.ts   # Subscription billing
```

## Customization

### Environment Variables
```bash
NODE_ENV=development|test|staging
SEED_MODE=development|test|staging|minimal
```

### Custom Configuration
```typescript
import { enhancedDatabaseSeed } from './prisma/seeds';

await enhancedDatabaseSeed({
  environment: 'development',
  clearExistingData: true,
  skipAuditLogs: false,
  userCount: 20,
  productCount: 25,
  orderCount: 50
});
```

## Quality Metrics

The seeding system tracks data quality metrics:

- **Users per payment method**: Average payment methods per user
- **Orders per user**: Customer engagement metric
- **Items per order**: Order complexity
- **Subscription adoption**: Percentage of users with subscriptions
- **Discount usage**: Percentage of users who used discounts

## Performance

- **Development**: ~5-7 seconds for full dataset
- **Test**: ~2-3 seconds for essential data
- **Minimal**: ~1-2 seconds for CI/CD

## Security Features

- **Password Hashing**: All passwords use bcrypt with salt rounds
- **Audit Logging**: Complete activity trail for compliance
- **Test Data Only**: No production-like sensitive data
- **Stripe Test Mode**: All payment data uses test identifiers

## Troubleshooting

### Common Issues

1. **Unique Constraint Errors**: Clear existing data with `clearExistingData: true`
2. **Missing Stripe IDs**: Ensure products have valid Stripe price/product IDs
3. **Foreign Key Errors**: Check that prerequisite data is created first

### Reset Database
```bash
npm run db:reset  # Resets and re-seeds database
```

### Inspect Data
```bash
npm run db:studio  # Opens Prisma Studio
```

## Development Workflow

1. **Make Schema Changes**: Update `prisma/schema.prisma`
2. **Run Migration**: `npm run db:migrate`
3. **Update Seed Data**: Modify appropriate seed modules
4. **Test Seeding**: `npm run db:seed`
5. **Verify Data**: `npm run db:studio`

## Contributing

When adding new seed data:

1. Add type definitions to `types.ts`
2. Create focused module in `seeds/`
3. Import and integrate in `index.ts`
4. Add test scenarios for edge cases
5. Update this documentation

## Related Commands

```bash
npm run db:setup      # Initial database setup with seeding
npm run db:reset      # Reset and re-seed database
npm run db:studio     # Visual database browser
npm run db:migrate    # Apply schema migrations
npm run dev           # Start with seeded data
```