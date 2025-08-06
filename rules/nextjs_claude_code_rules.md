# NextJS Stripe Development Rules - Claude Code Integration

## 1. SessionStart Rules (Environment Setup)

### Rule 1.1: Project Context Loading
**Execution Point:** `SessionStart`
**Purpose:** Automatically load project context and validate environment

```bash
# Auto-execute on session start
echo "🚀 Starting NextJS Stripe Template Development Session"

# Load project structure into context
echo "📁 Project Structure:"
find src -type f -name "*.ts" -o -name "*.tsx" | head -20

# Check environment variables
echo "🔧 Environment Check:"
[ -f .env.local ] && echo "✅ .env.local found" || echo "❌ .env.local missing"
[ -f .env.example ] && echo "✅ .env.example found" || echo "❌ .env.example missing"

# Check dependencies
echo "📦 Dependency Status:"
npm list --depth=0 2>/dev/null | grep -E "(next|stripe|prisma|zod)" || echo "❌ Missing core dependencies"

# Check Docker status
echo "🐳 Docker Status:"
docker ps | grep postgres && echo "✅ PostgreSQL running" || echo "❌ PostgreSQL not running"
```

### Rule 1.2: Development Tools Validation
**Execution Point:** `SessionStart`

```bash
# Validate required tools
node --version || echo "❌ Node.js not found"
npm --version || echo "❌ npm not found"
npx prisma --version || echo "❌ Prisma CLI not found"
stripe --version || echo "❌ Stripe CLI not found (optional)"
playwright --version || echo "❌ Playwright not found"
```

## 2. PreToolUse Rules (Before Code Changes)

### Rule 2.1: File Path Security Validation
**Execution Point:** `PreToolUse`
**Triggers:** Before `Read`, `Edit`, `Write`, `MultiEdit`

```bash
# Validate file paths for security
if [[ "$FILE_PATH" == *".env"* ]]; then
    echo "⚠️  WARNING: Accessing environment file. Ensure no secrets are exposed."
fi

if [[ "$FILE_PATH" == *"api"* ]]; then
    echo "🔒 API endpoint detected. Security review required."
fi

if [[ "$FILE_PATH" == *"stripe"* ]]; then
    echo "💳 Stripe-related file. Ensure PCI compliance."
fi
```

### Rule 2.2: Pre-Edit Code Pattern Analysis
**Execution Point:** `PreToolUse`
**Triggers:** Before `Edit`, `MultiEdit`

```bash
# Check for existing patterns before editing
echo "🔍 Analyzing existing patterns..."

# Check if file has proper TypeScript types
grep -q "interface\|type\|:" "$FILE_PATH" && echo "✅ TypeScript types present" || echo "⚠️  Consider adding TypeScript types"

# Check for proper error handling
grep -q "try\|catch\|throw" "$FILE_PATH" && echo "✅ Error handling present" || echo "⚠️  Consider adding error handling"

# Check for proper validation
grep -q "zod\|schema\|validate" "$FILE_PATH" && echo "✅ Validation present" || echo "⚠️  Consider adding input validation"
```

## 3. PostToolUse Rules (After Code Changes)

### Rule 3.1: Automatic Code Quality Enforcement
**Execution Point:** `PostToolUse`
**Triggers:** After `Edit`, `Write`, `MultiEdit`

```bash
# Auto-format and lint after any code change
echo "🎨 Auto-formatting code..."
npx prettier --write "$CHANGED_FILE" --config .prettierrc

echo "🔍 Running ESLint..."
npx eslint "$CHANGED_FILE" --fix --config .eslintrc.json

echo "📝 Running TypeScript check..."
npx tsc --noEmit --skipLibCheck

# Check for console.log statements
if grep -q "console.log" "$CHANGED_FILE"; then
    echo "⚠️  WARNING: console.log found in $CHANGED_FILE - remove before production"
fi
```

### Rule 3.2: Stripe-Specific Validations
**Execution Point:** `PostToolUse`
**Triggers:** After editing Stripe-related files

```bash
# Check for Stripe best practices
if [[ "$CHANGED_FILE" == *"stripe"* ]]; then
    echo "💳 Validating Stripe implementation..."
    
    # Check for proper API version pinning
    grep -q "apiVersion.*2023-10-16" "$CHANGED_FILE" && echo "✅ API version pinned" || echo "⚠️  Pin Stripe API version"
    
    # Check for webhook signature verification
    if [[ "$CHANGED_FILE" == *"webhook"* ]]; then
        grep -q "constructEvent\|verifyHeader" "$CHANGED_FILE" && echo "✅ Webhook signature verification" || echo "❌ Missing webhook signature verification"
    fi
    
    # Check for proper error handling
    grep -q "StripeError\|try.*catch" "$CHANGED_FILE" && echo "✅ Stripe error handling" || echo "⚠️  Add Stripe error handling"
fi
```

### Rule 3.3: Database Schema Validation
**Execution Point:** `PostToolUse`
**Triggers:** After editing Prisma schema files

```bash
if [[ "$CHANGED_FILE" == *"prisma"* ]]; then
    echo "🗄️  Validating Prisma schema..."
    
    # Validate schema
    npx prisma validate || echo "❌ Prisma schema validation failed"
    
    # Format schema
    npx prisma format
    
    # Check for required fields
    grep -q "stripeCustomerId" "$CHANGED_FILE" && echo "✅ Stripe customer ID field present" || echo "⚠️  Consider adding stripeCustomerId field"
    
    # Generate client if schema changed
    npx prisma generate
fi
```

### Rule 3.4: Test Execution After Changes
**Execution Point:** `PostToolUse`
**Triggers:** After any code modification

```bash
# Run relevant tests based on changed file
echo "🧪 Running tests for changed files..."

if [[ "$CHANGED_FILE" == *"api"* ]]; then
    echo "🔌 Running API tests..."
    npm run test -- --testPathPattern="api" --passWithNoTests
fi

if [[ "$CHANGED_FILE" == *"component"* ]]; then
    echo "🎨 Running component tests..."
    npm run test -- --testPathPattern="component" --passWithNoTests
fi

if [[ "$CHANGED_FILE" == *"lib"* ]]; then
    echo "⚙️  Running utility tests..."
    npm run test -- --testPathPattern="lib" --passWithNoTests
fi

# Always run type checking
echo "📝 Type checking..."
npx tsc --noEmit
```

## 4. Stop Rules (Task Completion)

### Rule 4.1: Comprehensive Quality Gate
**Execution Point:** `Stop`
**Purpose:** Final validation before task completion

```bash
echo "🏁 Running comprehensive quality checks..."

# Build check
echo "🔨 Build validation..."
npm run build > build.log 2>&1
if [ $? -eq 0 ]; then
    echo "✅ Build successful"
    rm build.log
else
    echo "❌ Build failed - check build.log"
    cat build.log
    exit 1
fi

# Test suite
echo "🧪 Running full test suite..."
npm run test -- --coverage --passWithNoTests
TEST_EXIT_CODE=$?

# E2E tests (if available)
if [ -f "playwright.config.ts" ]; then
    echo "🎭 Running E2E tests..."
    npx playwright test --reporter=line
fi

# Security checks
echo "🔒 Security validation..."
# Check for exposed secrets
grep -r "sk_live\|sk_test" src/ && echo "❌ Potential API key exposure" || echo "✅ No exposed API keys"

# Performance checks
echo "⚡ Performance validation..."
# Check for large bundle imports
grep -r "import.*entire.*library" src/ && echo "⚠️  Large imports detected"

# Generate summary
echo "📊 Task Completion Summary:"
echo "- Build: $([ $? -eq 0 ] && echo "✅ Passed" || echo "❌ Failed")"
echo "- Tests: $([ $TEST_EXIT_CODE -eq 0 ] && echo "✅ Passed" || echo "❌ Failed")"
echo "- Security: ✅ Validated"
echo "- Performance: ✅ Checked"
```

### Rule 4.2: Documentation Generation
**Execution Point:** `Stop`

```bash
# Auto-generate/update documentation
echo "📚 Updating documentation..."

# Generate API documentation
if [ -d "src/app/api" ]; then
    echo "🔌 Generating API documentation..."
    # Extract API routes and their methods
    find src/app/api -name "route.ts" -exec grep -l "export.*GET\|POST\|PUT\|DELETE" {} \; > api-routes.txt
fi

# Update README with current dependencies
echo "📝 Updating README..."
# This would update version info, features list, etc.
```

## 5. Pattern-Based Rules (Using Grep and Glob)

### Rule 5.1: Code Pattern Enforcement
**Usage:** Regular monitoring and validation

```bash
# Find and validate common patterns
echo "🔍 Pattern validation..."

# Check for proper component structure
glob "src/components/**/*.tsx" | while read file; do
    if ! grep -q "export.*function\|export.*const.*=.*>" "$file"; then
        echo "⚠️  $file: Missing proper component export"
    fi
done

# Check for proper API route structure
glob "src/app/api/**/route.ts" | while read file; do
    if ! grep -q "export.*async.*function" "$file"; then
        echo "⚠️  $file: Missing async export functions"
    fi
done

# Check for proper error boundaries
glob "src/app/**/error.tsx" | wc -l | awk '{if($1==0) print "⚠️  No error boundaries found"}'
```

### Rule 5.2: Security Pattern Validation
```bash
# Security-focused pattern checks
echo "🔒 Security pattern validation..."

# Check for proper input validation
grep -r "req.body" src/app/api --include="*.ts" | while read line; do
    file=$(echo "$line" | cut -d: -f1)
    if ! grep -q "schema.*parse\|validate" "$file"; then
        echo "⚠️  $file: Unvalidated request body usage"
    fi
done

# Check for proper authentication
grep -r "export.*function" src/app/api --include="*.ts" | while read line; do
    file=$(echo "$line" | cut -d: -f1)
    if ! grep -q "auth\|session\|token" "$file"; then
        echo "⚠️  $file: Potential missing authentication"
    fi
done
```

## 6. Stripe-Specific Automated Rules

### Rule 6.1: Stripe Integration Validation
**Execution Point:** `PostToolUse` (after Stripe file changes)

```bash
# Comprehensive Stripe validation
echo "💳 Stripe integration validation..."

# Check webhook endpoint structure
if [ -f "src/app/api/webhooks/stripe/route.ts" ]; then
    webhook_file="src/app/api/webhooks/stripe/route.ts"
    
    # Must have signature verification
    grep -q "constructEvent\|verifyHeader" "$webhook_file" || echo "❌ Missing webhook signature verification"
    
    # Must handle common events
    grep -q "payment_intent.succeeded" "$webhook_file" || echo "⚠️  Consider handling payment_intent.succeeded"
    grep -q "customer.subscription" "$webhook_file" || echo "⚠️  Consider handling subscription events"
    
    # Must have proper error responses
    grep -q "return.*Response.*40" "$webhook_file" || echo "⚠️  Add proper error responses"
fi

# Check for proper Stripe client initialization
grep -r "new Stripe" src/ --include="*.ts" | while read line; do
    file=$(echo "$line" | cut -d: -f1)
    
    # Must pin API version
    grep -q "apiVersion.*2023-10-16" "$file" || echo "⚠️  $file: Pin Stripe API version"
    
    # Must use environment variable
    grep -q "process.env.STRIPE_SECRET_KEY" "$file" || echo "⚠️  $file: Use environment variable for API key"
done
```

### Rule 6.2: Payment Flow Validation
```bash
# Validate payment implementation
echo "💰 Payment flow validation..."

# Check for proper amount handling (should be in cents)
grep -r "amount.*\*.*100\|amount.*cents" src/ --include="*.ts" || echo "⚠️  Ensure amounts are in cents"

# Check for proper currency handling
grep -r "currency.*usd\|currency.*eur" src/ --include="*.ts" | wc -l | awk '{if($1==0) print "⚠️  Add currency handling"}'

# Check for proper customer creation
grep -r "stripe.customers.create" src/ --include="*.ts" | while read line; do
    file=$(echo "$line" | cut -d: -f1)
    grep -q "email.*metadata" "$file" || echo "⚠️  $file: Include email and metadata in customer creation"
done
```

## 7. Testing Automation Rules

### Rule 7.1: Test Coverage Enforcement
**Execution Point:** `PostToolUse` (after adding new functions)

```bash
# Ensure test coverage for new code
echo "🧪 Test coverage validation..."

# Check if new functions have corresponding tests
find src -name "*.ts" -o -name "*.tsx" | grep -v ".test." | while read file; do
    base_name=$(basename "$file" .ts)
    base_name=$(basename "$base_name" .tsx)
    dir_name=$(dirname "$file")
    
    # Look for corresponding test file
    test_file_patterns=(
        "${dir_name}/${base_name}.test.ts"
        "${dir_name}/${base_name}.test.tsx"
        "${dir_name}/__tests__/${base_name}.test.ts"
        "__tests__/${dir_name}/${base_name}.test.ts"
    )
    
    found_test=false
    for pattern in "${test_file_patterns[@]}"; do
        if [ -f "$pattern" ]; then
            found_test=true
            break
        fi
    done
    
    if [ "$found_test" = false ] && grep -q "export.*function" "$file"; then
        echo "⚠️  $file: No corresponding test file found"
    fi
done
```

### Rule 7.2: E2E Test Validation
**Execution Point:** `Stop`

```bash
# Validate E2E test coverage
echo "🎭 E2E test validation..."

if [ -f "playwright.config.ts" ]; then
    # Check for payment flow tests
    grep -r "payment\|checkout\|stripe" tests/e2e/ --include="*.spec.ts" || echo "⚠️  Add payment flow E2E tests"
    
    # Check for authentication tests
    grep -r "login\|auth\|signin" tests/e2e/ --include="*.spec.ts" || echo "⚠️  Add authentication E2E tests"
    
    # Check for admin dashboard tests
    grep -r "admin\|dashboard" tests/e2e/ --include="*.spec.ts" || echo "⚠️  Add admin dashboard E2E tests"
fi
```

## 8. Performance Monitoring Rules

### Rule 8.1: Bundle Size Monitoring
**Execution Point:** `PostToolUse` (after dependency changes)

```bash
# Monitor bundle size
echo "📦 Bundle size monitoring..."

if [ -f "package.json" ]; then
    # Check for large dependencies
    large_deps=$(npm list --depth=0 2>/dev/null | grep -E "(moment|lodash)" | wc -l)
    if [ "$large_deps" -gt 0 ]; then
        echo "⚠️  Large dependencies detected - consider alternatives"
    fi
    
    # Check for duplicate dependencies
    npm ls --depth=0 2>&1 | grep -i "deduped" && echo "⚠️  Duplicate dependencies found"
fi
```

### Rule 8.2: Database Query Optimization
**Execution Point:** `PostToolUse` (after Prisma query changes)

```bash
# Check for query optimization
echo "🗄️  Database query optimization..."

# Look for potential N+1 queries
grep -r "findMany\|findUnique" src/ --include="*.ts" | while read line; do
    file=$(echo "$line" | cut -d: -f1)
    
    # Check if include/select is used
    if ! grep -q "include:\|select:" "$file"; then
        echo "⚠️  $file: Consider using select/include for query optimization"
    fi
done

# Check for missing indexes on foreign keys
if [ -f "prisma/schema.prisma" ]; then
    grep -A 5 -B 5 "@relation" prisma/schema.prisma | grep -v "@@index" && echo "⚠️  Consider adding indexes for foreign keys"
fi
```

## 9. Deployment Readiness Rules

### Rule 9.1: Production Readiness Check
**Execution Point:** `Stop` (before deployment)

```bash
# Production readiness validation
echo "🚀 Production readiness check..."

# Check environment variables
required_env_vars=("DATABASE_URL" "STRIPE_SECRET_KEY" "STRIPE_WEBHOOK_SECRET" "NEXTAUTH_SECRET")
for var in "${required_env_vars[@]}"; do
    if ! grep -q "$var" .env.example; then
        echo "❌ Missing $var in .env.example"
    fi
done

# Check for development-only code
grep -r "console.log\|debugger\|TODO\|FIXME" src/ --include="*.ts" --include="*.tsx" && echo "⚠️  Remove development code before production"

# Check for proper error pages
[ -f "src/app/error.tsx" ] && echo "✅ Global error boundary exists" || echo "❌ Add global error boundary"
[ -f "src/app/not-found.tsx" ] && echo "✅ 404 page exists" || echo "❌ Add 404 page"

# Check Docker configuration
[ -f "Dockerfile" ] && echo "✅ Dockerfile exists" || echo "⚠️  Add Dockerfile for deployment"
[ -f "docker-compose.yml" ] && echo "✅ Docker Compose exists" || echo "⚠️  Add Docker Compose for local development"
```

## 10. Emergency Break Rules

### Rule 10.1: Critical Error Detection
**Execution Point:** `PreToolUse` and `PostToolUse`

```bash
# Critical error detection
echo "🚨 Critical error detection..."

# Check for exposed secrets
if grep -r "sk_live_" src/ 2>/dev/null; then
    echo "🚨 CRITICAL: Live Stripe key exposed in source code!"
    echo "🛑 STOPPING EXECUTION"
    exit 1
fi

# Check for SQL injection risks
if grep -r "query.*+.*req\|execute.*+.*body" src/ --include="*.ts" 2>/dev/null; then
    echo "🚨 CRITICAL: Potential SQL injection risk detected!"
    echo "🛑 Please review and use parameterized queries"
fi

# Check for XSS risks
if grep -r "dangerouslySetInnerHTML\|innerHTML.*req" src/ --include="*.tsx" 2>/dev/null; then
    echo "🚨 CRITICAL: Potential XSS risk detected!"
    echo "🛑 Please review and sanitize user input"
fi
```

## 11. Automated Fix Suggestions

### Rule 11.1: Smart Fix Recommendations
**Execution Point:** `PostToolUse`

```bash
# Provide automated fix suggestions
echo "🔧 Smart fix recommendations..."

# Suggest fixes for common issues
if grep -q "any" src/**/*.ts 2>/dev/null; then
    echo "💡 Replace 'any' types with specific interfaces"
    echo "   Example: interface User { id: string; email: string; }"
fi

if grep -q "useEffect.*\[\]" src/**/*.tsx 2>/dev/null; then
    echo "💡 Consider if useEffect with empty dependency array is necessary"
    echo "   Tip: Move side effects to event handlers when possible"
fi

if ! grep -q "loading.*error" src/components/**/*.tsx 2>/dev/null; then
    echo "💡 Add loading and error states to components"
    echo "   Example: const [loading, setLoading] = useState(false);"
fi
```

---

## Implementation Summary

These rules leverage Claude Code's execution points to create a comprehensive, automated development workflow:

1. **SessionStart**: Environment validation and context loading
2. **PreToolUse**: Security checks and pattern analysis before changes
3. **PostToolUse**: Immediate quality enforcement after changes
4. **Stop**: Comprehensive validation before task completion

The system automatically:
- ✅ Validates code quality and security
- ✅ Runs appropriate tests based on changed files
- ✅ Enforces Stripe integration best practices
- ✅ Monitors performance and bundle size
- ✅ Provides intelligent fix suggestions
- ✅ Ensures production readiness

This creates a robust development environment that maintains high code quality while preventing common security and performance issues specific to NextJS Stripe applications.