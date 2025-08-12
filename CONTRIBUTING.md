# Contributing to Payment Integration Template

Thank you for considering contributing to our Next.js Stripe payment integration template! This
document provides guidelines and workflows for contributing to the project.

## Table of Contents

- [Getting Started](#getting-started)
- [Development Workflow](#development-workflow)
- [Branch Strategy](#branch-strategy)
- [Commit Guidelines](#commit-guidelines)
- [Pull Request Process](#pull-request-process)
- [Code Quality Standards](#code-quality-standards)
- [Testing Requirements](#testing-requirements)
- [Security Guidelines](#security-guidelines)

## Getting Started

### Prerequisites

- Node.js (v18 or higher)
- npm/yarn/pnpm
- Git
- Docker (for local database)
- Stripe CLI (optional, for webhook testing)

### Initial Setup

1. Fork the repository
2. Clone your fork: `git clone https://github.com/YOUR-USERNAME/payment-integration-template.git`
3. Install dependencies: `npm install`
4. Copy environment variables: `cp .env.example .env.local`
5. Set up your development environment following `docs/environment-setup.md`

## Development Workflow

### 1. Create a Feature Branch

```bash
# Update your local master branch
git checkout master
git pull origin master

# Create a new feature branch
git checkout -b feature/your-feature-name
```

### 2. Make Your Changes

- Follow the coding standards outlined below
- Write tests for new functionality
- Update documentation as needed
- Ensure all pre-commit hooks pass

### 3. Test Your Changes

```bash
# Run all tests
npm run test

# Run E2E tests
npm run test:e2e

# Run linting
npm run lint

# Build the project
npm run build
```

## Branch Strategy

We use a simplified Git Flow strategy:

### Branch Types

- **`master`**: Main branch, always deployable
- **`feature/*`**: New features or enhancements
- **`bugfix/*`**: Bug fixes
- **`hotfix/*`**: Critical production fixes
- **`chore/*`**: Maintenance tasks, dependency updates

### Branch Naming Conventions

```
feature/add-subscription-management
bugfix/fix-webhook-validation
hotfix/security-patch-stripe-keys
chore/update-dependencies
```

### Branch Protection Rules

The `master` branch is protected with the following rules:

- Require pull request reviews before merging
- Require status checks to pass before merging
- Require branches to be up to date before merging
- Restrict pushes that create merge commits

## Commit Guidelines

We follow the [Conventional Commits](https://www.conventionalcommits.org/) specification:

### Commit Message Format

```
<type>[optional scope]: <description>

[optional body]

[optional footer(s)]
```

### Types

- **feat**: A new feature
- **fix**: A bug fix
- **docs**: Documentation only changes
- **style**: Changes that do not affect code meaning (formatting, etc.)
- **refactor**: Code change that neither fixes a bug nor adds a feature
- **perf**: A code change that improves performance
- **test**: Adding missing tests or correcting existing tests
- **chore**: Changes to the build process or auxiliary tools

### Examples

```bash
feat(auth): add OAuth integration with Google
fix(payment): resolve Stripe webhook signature validation
docs(api): update payment endpoint documentation
test(stripe): add unit tests for subscription management
chore(deps): update Next.js to v14.0.0
```

### Commit Message Rules

- Use the imperative mood ("add" not "added" or "adds")
- First line should be 50 characters or less
- Reference issues and pull requests when applicable
- Include breaking change information in the footer

## Pull Request Process

### Before Creating a PR

1. Ensure your branch is up to date with master
2. Run the full test suite
3. Check that the build passes
4. Review your own code for obvious issues
5. Update documentation if needed

### PR Title and Description

- Use a clear, descriptive title
- Reference related issues: "Closes #123"
- Provide context and reasoning for changes
- Include screenshots for UI changes
- List any breaking changes

### PR Template

```markdown
## Summary

Brief description of changes

## Type of Change

- [ ] Bug fix
- [ ] New feature
- [ ] Breaking change
- [ ] Documentation update

## Testing

- [ ] Unit tests pass
- [ ] E2E tests pass
- [ ] Manual testing completed

## Checklist

- [ ] Code follows project style guidelines
- [ ] Self-review completed
- [ ] Documentation updated
- [ ] No secrets or sensitive data committed
```

### Review Process

1. At least one code review is required
2. All status checks must pass
3. Branch must be up to date with master
4. No merge commits (use rebase)

## Code Quality Standards

### TypeScript

- Use strict TypeScript configuration
- Provide proper type definitions
- Avoid `any` types when possible
- Use interfaces for object shapes

### Code Style

- Follow the ESLint and Prettier configurations
- Use meaningful variable and function names
- Write self-documenting code
- Add comments for complex business logic

### File Organization

```
src/
├── app/                 # Next.js App Router
├── components/          # Reusable UI components
├── lib/                # Utility functions and configurations
├── types/              # TypeScript type definitions
└── __tests__/          # Test files
```

### API Design

- Follow RESTful conventions
- Use proper HTTP status codes
- Implement proper error handling
- Validate all inputs using Zod schemas
- Document all endpoints

## Testing Requirements

### Unit Tests

- Write tests for all utility functions
- Test React components with React Testing Library
- Aim for >80% code coverage
- Use Jest for test runner

### Integration Tests

- Test API endpoints
- Test database interactions
- Test Stripe webhook handling

### E2E Tests

- Test critical user flows
- Test payment processes
- Use Playwright for browser automation

### Testing Best Practices

- Write tests before or alongside code (TDD/BDD)
- Use descriptive test names
- Test edge cases and error conditions
- Mock external services appropriately

## Security Guidelines

### Environment Variables

- Never commit actual secrets
- Use `.env.example` for documentation
- Validate environment variables at startup
- Use different keys for different environments

### Stripe Integration

- Always validate webhook signatures
- Use test keys for development
- Implement proper error handling
- Follow PCI compliance guidelines
- Never log sensitive payment data

### Code Security

- Validate all user inputs
- Sanitize data before database queries
- Use parameterized queries
- Implement proper authentication/authorization
- Regular dependency security audits

### Security Checklist

- [ ] No hardcoded secrets
- [ ] Input validation implemented
- [ ] SQL injection prevention
- [ ] XSS prevention
- [ ] CSRF protection
- [ ] Proper error handling (no sensitive data in errors)

## Development Tools

### Pre-commit Hooks

The project uses Husky for Git hooks:

- **pre-commit**: Runs linting and formatting
- **commit-msg**: Validates commit message format

### Recommended VSCode Extensions

- ESLint
- Prettier
- TypeScript Importer
- Stripe for VSCode
- GitLens

## Getting Help

- Check existing [issues](https://github.com/GabrielCodeProject/payment-integration-template/issues)
- Create a new issue for bugs or feature requests
- Use GitHub Discussions for questions
- Review the documentation in `/docs`

## Release Process

1. Create a release branch from master
2. Update version numbers
3. Update CHANGELOG.md
4. Create a pull request
5. After merge, create a GitHub release
6. Deploy to production

Thank you for contributing! 🚀
