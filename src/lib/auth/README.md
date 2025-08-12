# Authentication Middleware Implementation

This directory contains a comprehensive authentication and authorization system built with
BetterAuth and NextJS middleware, specifically designed for the Stripe payment integration template.

## Overview

The authentication system provides:

- **Session-based authentication** with BetterAuth
- **Role-based access control** (ADMIN, SUPPORT, CUSTOMER)
- **Route protection** for pages and API endpoints
- **Performance optimizations** with session caching
- **Security features** including CSRF protection, rate limiting, and security headers
- **Integration with Prisma** database schema

## Files Structure

```
src/lib/auth/
├── config.ts          # BetterAuth configuration and helpers
├── middleware.ts       # Authentication utilities for NextJS middleware
└── README.md          # This documentation
```

## Core Features

### 1. Route Protection

The middleware automatically protects different types of routes:

#### Protected Routes (Authentication Required)

- `/dashboard/*` - User dashboard
- `/profile/*` - User profile management
- `/billing/*` - Billing and subscription management
- `/checkout/*` - Payment checkout flows

#### Admin Routes (Admin Role Required)

- `/admin/*` - Administrative interface

#### API Protection

- `/api/protected/*` - Authenticated API endpoints
- `/api/admin/*` - Admin-only API endpoints
- `/api/user/*` - User-specific API endpoints
- `/api/payments/*` - Payment processing endpoints
- `/api/subscriptions/*` - Subscription management endpoints

#### Public Routes

- `/api/auth/*` - Authentication endpoints
- `/api/stripe/webhook` - Stripe webhook endpoint
- `/api/health` - Health check endpoint

### 2. Security Features

#### Content Security Policy (CSP)

- **Payment pages**: Special CSP allowing Stripe domains
- **Standard pages**: Strict CSP with nonce-based script execution
- **Dynamic nonce generation** for secure script loading

#### Rate Limiting

- **Authentication endpoints**: 10 requests per minute per IP
- **Payment endpoints**: 30 requests per minute per IP
- **In-memory rate limiting** with automatic cleanup

#### CSRF Protection

- **Origin validation** for non-GET requests
- **Referrer header validation** as fallback
- **Automatic rejection** of requests without proper origin

#### Security Headers

- `X-Frame-Options: DENY`
- `X-Content-Type-Options: nosniff`
- `Strict-Transport-Security` with HSTS
- `Referrer-Policy: strict-origin-when-cross-origin`

### 3. Performance Optimizations

#### Session Caching

- **5-minute cache TTL** for session validation
- **Automatic cache cleanup** to prevent memory leaks
- **Performance monitoring** with request tracing

#### Middleware Efficiency

- **Single session lookup** per request
- **Conditional security header application**
- **Optimized route matching** with prefix checks

### 4. Role-Based Access Control

#### User Roles

```typescript
enum UserRole {
  CUSTOMER  // Default role for regular users
  SUPPORT   // Customer support access
  ADMIN     // Full administrative access
}
```

#### Role Hierarchy

- **ADMIN**: Full access to all routes and features
- **SUPPORT**: Access to customer support features + customer features
- **CUSTOMER**: Access to basic user features

#### Implementation

```typescript
// Check if user has required role
const hasAccess = hasRequiredRole(user, "ADMIN");

// Admin-only route protection
if (isAdminRoute(pathname)) {
  // Require ADMIN role
}
```

## Configuration

### Environment Variables

```bash
# Required for authentication
AUTH_SECRET="your-super-secret-key-min-32-chars"
NEXT_PUBLIC_APP_URL="http://localhost:3000"

# Database connection
DATABASE_URL="postgresql://user:password@localhost:5432/db"

# Optional: Enable maintenance mode
MAINTENANCE_MODE="false"
```

### BetterAuth Configuration

The auth configuration includes:

- **Database integration** with Prisma adapter
- **Security-optimized settings** for payment processing
- **Custom user fields** for roles and Stripe integration
- **Session management** optimized for middleware performance

```typescript
export const auth = betterAuth({
  database: prismaAdapter(prisma),
  secret: process.env.AUTH_SECRET,
  session: {
    expiresIn: 60 * 60 * 24 * 7, // 7 days
    updateAge: 60 * 60 * 24, // 1 day
  },
  // ... additional configuration
});
```

## Usage Examples

### Protecting API Routes

```typescript
// /api/protected/user-data/route.ts
import { validateRouteAccess } from "@/lib/auth/middleware";

export async function GET(request: Request) {
  const { isAllowed, session } = await validateRouteAccess(request);

  if (!isAllowed) {
    return new Response("Unauthorized", { status: 401 });
  }

  // Use session.user for user-specific operations
  return Response.json({ user: session.user });
}
```

### Server-Side Session Access

```typescript
// In server components or API routes
import { getServerSession } from "@/lib/auth/config";

export default async function ProtectedPage() {
  const session = await getServerSession();

  if (!session) {
    redirect("/auth/signin");
  }

  return <div>Welcome, {session.user.name}!</div>;
}
```

### Role Checking

```typescript
import { isAdmin, hasRole } from "@/lib/auth/config";

// Check if user is admin
if (isAdmin(session.user)) {
  // Show admin features
}

// Check specific role
if (hasRole(session.user, "SUPPORT")) {
  // Show support features
}
```

## Integration with Prisma

The system integrates with the existing Prisma schema:

```prisma
model User {
  id               String   @id @default(cuid())
  email            String   @unique
  name             String?
  role             UserRole @default(CUSTOMER)
  isActive         Boolean  @default(true)
  stripeCustomerId String?  @unique
  // ... other fields

  sessions         Session[]
  accounts         Account[]
}

model Session {
  id           String   @id @default(cuid())
  sessionToken String   @unique
  userId       String
  expires      DateTime
  user         User     @relation(fields: [userId], references: [id])
}
```

## Error Handling

The middleware includes comprehensive error handling:

- **Silent failures** in production to avoid information leakage
- **Detailed logging** in development for debugging
- **Graceful degradation** when authentication services are unavailable
- **User-friendly redirects** for authentication failures

## Security Considerations

### Payment Processing Security

- **Stripe-specific CSP** allowing necessary domains
- **Webhook signature validation** for Stripe endpoints
- **Rate limiting** on payment endpoints
- **CSRF protection** for payment forms

### Session Security

- **Secure cookie handling** with HttpOnly and Secure flags
- **Session rotation** on privilege escalation
- **Automatic session cleanup** for inactive users
- **IP-based rate limiting** to prevent abuse

### Production Recommendations

- **Use environment-specific AUTH_SECRET** (min 32 characters)
- **Enable HSTS** with proper SSL certificates
- **Monitor authentication logs** for suspicious activity
- **Regularly rotate authentication secrets**
- **Implement proper logging service** integration

## Troubleshooting

### Common Issues

1. **TypeScript errors**: Ensure all auth types are properly imported
2. **Session not found**: Check cookie configuration and domain settings
3. **Rate limiting issues**: Verify IP detection in production environment
4. **CSP violations**: Update CSP headers for new external resources

### Debug Mode

Enable debug logging in development:

```bash
NODE_ENV="development"
```

This will provide detailed logs for:

- Authentication attempts
- Session validation
- Route access decisions
- Rate limiting actions

## Testing

The middleware includes comprehensive testing utilities:

```typescript
// Test route access
const { isAllowed, session } = await validateRouteAccess(mockRequest);

// Test role permissions
const hasAccess = hasRequiredRole(mockUser, "ADMIN");

// Test rate limiting
const rateLimitResult = checkRateLimit("test-ip", 5, 60000);
```

## Future Enhancements

Planned improvements:

- **Redis integration** for distributed rate limiting
- **Advanced threat detection** with behavioral analysis
- **OAuth provider support** (Google, GitHub, etc.)
- **Multi-factor authentication** integration
- **Audit logging** with detailed event tracking
- **Role-based UI components** for React

---

For more detailed implementation examples, see the individual file documentation and the main
middleware.ts file.
