# Development Guide

## Development Workflow

This guide outlines the development processes, tools, and best practices for contributing to the Conductor project.

## Git Workflow

### Branch Strategy

We use a **GitFlow-inspired** workflow with the following branches:

```
main           ← Production-ready code
├── develop    ← Integration branch for features
├── feature/*  ← New features and enhancements
├── bugfix/*   ← Bug fixes for develop branch
├── hotfix/*   ← Critical fixes for production
└── release/*  ← Release preparation
```

### Branch Naming Convention

- **Features**: `feature/bluetooth-mesh-networking`
- **Bug fixes**: `bugfix/fix-event-sync-issue`
- **Hotfixes**: `hotfix/security-patch-jwt`
- **Releases**: `release/v1.2.0`
- **Documentation**: `docs/update-api-documentation`

### Commit Message Format

Follow the [Conventional Commits](https://www.conventionalcommits.org/) specification:

```
<type>[optional scope]: <description>

[optional body]

[optional footer(s)]
```

#### Types
- **feat**: New feature
- **fix**: Bug fix
- **docs**: Documentation changes
- **style**: Code style changes (formatting, etc.)
- **refactor**: Code refactoring
- **test**: Adding or updating tests
- **chore**: Maintenance tasks
- **security**: Security-related changes
- **perf**: Performance improvements

#### Examples
```bash
feat(auth): implement JWT token refresh mechanism

Add automatic token refresh to prevent session expiration
during long events. Includes exponential backoff retry
logic and secure token storage.

Closes #234

fix(bluetooth): resolve connection stability issues

- Improve connection retry logic
- Add connection state monitoring
- Handle edge cases for device disconnection

Fixes #456

security(crypto): update encryption to use ChaCha20-Poly1305

Replace AES-GCM with ChaCha20-Poly1305 for better security
and performance on mobile devices.

BREAKING CHANGE: Existing encrypted data needs migration
```

## Development Environment Setup

### Prerequisites

- **Node.js** 18+ with npm
- **Flutter** 3.0+ with Dart SDK
- **Git** 2.30+
- **Docker** (optional, for containerized development)
- **Android Studio** or **Xcode** (for mobile development)

### Initial Setup

1. **Clone and Setup Repository**
   ```bash
   # Clone your fork
   git clone https://github.com/your-username/conductor.git
   cd conductor
   
   # Add upstream remote
   git remote add upstream https://github.com/conductor-project/conductor.git
   
   # Install Git hooks
   npm run setup:hooks
   ```

2. **Environment Configuration**
   ```bash
   # Copy environment templates
   cp server/.env.example server/.env
   cp mobile/.env.example mobile/.env
   
   # Edit configuration files
   nano server/.env
   nano mobile/.env
   ```

3. **Install Dependencies**
   ```bash
   # Server dependencies
   cd server
   npm install
   
   # Mobile dependencies
   cd ../mobile
   flutter pub get
   
   # Development tools
   cd ..
   npm run install:dev-tools
   ```

4. **Verify Setup**
   ```bash
   # Run health checks
   npm run health-check
   
   # Run initial tests
   npm run test:setup
   ```

### Development Tools

#### Required Tools
```bash
# Install global development tools
npm install -g nodemon prettier eslint
flutter pub global activate dart_code_metrics

# Install git hooks for automated checks
npx husky install
npm run setup:git-hooks
```

#### Recommended VS Code Extensions
```json
{
  "recommendations": [
    "ms-vscode.vscode-typescript-next",
    "esbenp.prettier-vscode",
    "ms-vscode.vscode-eslint",
    "dart-code.flutter",
    "dart-code.dart-code",
    "bradlc.vscode-tailwindcss",
    "ms-vscode.vscode-json",
    "redhat.vscode-yaml"
  ]
}
```

## Development Workflow

### Daily Development Process

1. **Start Development Session**
   ```bash
   # Update your local repository
   git checkout develop
   git pull upstream develop
   
   # Create feature branch
   git checkout -b feature/your-feature-name
   
   # Start development environment
   npm run dev:start
   ```

2. **Development Loop**
   ```bash
   # Make changes to code
   # Run tests frequently
   npm run test:watch
   
   # Check code quality
   npm run lint:fix
   npm run format
   
   # Commit changes
   git add .
   git commit -m "feat: implement new feature"
   ```

3. **End Development Session**
   ```bash
   # Run full test suite
   npm run test:all
   
   # Push changes
   git push origin feature/your-feature-name
   
   # Create pull request when ready
   ```

### Pull Request Workflow

1. **Pre-PR Checklist**
   - [ ] All tests pass locally
   - [ ] Code follows style guidelines
   - [ ] Documentation updated
   - [ ] Commit messages follow convention
   - [ ] No merge conflicts with develop

2. **Create Pull Request**
   ```bash
   # Push your branch
   git push origin feature/your-feature-name
   
   # Create PR via GitHub CLI (optional)
   gh pr create --title "feat: implement Bluetooth mesh networking" \
                --body "Adds peer-to-peer communication via BLE mesh"
   ```

3. **PR Review Process**
   - Automated checks must pass
   - At least 2 code reviewers approve
   - Security review for sensitive changes
   - Manual testing for UI changes

4. **Merge Process**
   ```bash
   # Squash and merge for feature branches
   git checkout develop
   git pull upstream develop
   git merge --squash feature/your-feature-name
   git commit -m "feat: implement Bluetooth mesh networking"
   git push upstream develop
   ```

## Code Quality Standards

### Automated Quality Checks

#### Pre-commit Hooks
```bash
#!/bin/sh
# .husky/pre-commit

# Run linting
npm run lint
if [ $? -ne 0 ]; then
  echo "Linting failed. Please fix errors before committing."
  exit 1
fi

# Run tests
npm run test:quick
if [ $? -ne 0 ]; then
  echo "Tests failed. Please fix before committing."
  exit 1
fi

# Security check
npm audit --audit-level moderate
if [ $? -ne 0 ]; then
  echo "Security vulnerabilities detected. Please fix before committing."
  exit 1
fi
```

#### CI/CD Pipeline
```yaml
# .github/workflows/ci.yml
name: Continuous Integration

on:
  pull_request:
    branches: [develop, main]
  push:
    branches: [develop, main]

jobs:
  quality-checks:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
          cache: 'npm'
          
      - name: Install dependencies
        run: npm ci
        
      - name: Run linting
        run: npm run lint
        
      - name: Run type checking
        run: npm run type-check
        
      - name: Run tests
        run: npm run test:coverage
        
      - name: Security audit
        run: npm audit --audit-level moderate
        
      - name: Upload coverage
        uses: codecov/codecov-action@v3
```

### Code Style Guidelines

#### Server Code (Node.js)
```javascript
// Use Prettier + ESLint configuration
module.exports = {
  extends: [
    'eslint:recommended',
    '@typescript-eslint/recommended',
    'plugin:security/recommended',
    'prettier'
  ],
  rules: {
    'no-console': 'warn',
    'prefer-const': 'error',
    'no-var': 'error',
    'security/detect-object-injection': 'error'
  }
};
```

#### Mobile Code (Flutter)
```yaml
# analysis_options.yaml
include: package:flutter_lints/flutter.yaml

analyzer:
  strong-mode:
    implicit-casts: false
    implicit-dynamic: false

linter:
  rules:
    - prefer_const_constructors
    - prefer_const_literals_to_create_immutables
    - avoid_print
    - prefer_single_quotes
    - require_trailing_commas
```

### Documentation Standards

#### Code Documentation
```typescript
/**
 * Manages secure communication between mesh network nodes
 * 
 * @example
 * ```typescript
 * const meshManager = new MeshNetworkManager({
 *   deviceId: 'unique-device-id',
 *   encryptionKey: await generateKey()
 * });
 * 
 * await meshManager.connect();
 * await meshManager.broadcastMessage({
 *   type: 'event-update',
 *   payload: eventData
 * });
 * ```
 */
class MeshNetworkManager {
  /**
   * Establishes connections to nearby mesh nodes
   * 
   * @param maxConnections - Maximum number of simultaneous connections
   * @returns Promise that resolves when initial connections are established
   * @throws {MeshNetworkError} When Bluetooth is unavailable or connections fail
   */
  async connect(maxConnections: number = 8): Promise<void> {
    // Implementation
  }
}
```

#### API Documentation
```typescript
/**
 * @swagger
 * /api/events:
 *   post:
 *     summary: Create a new event
 *     tags: [Events]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreateEventRequest'
 *     responses:
 *       201:
 *         description: Event created successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Event'
 *       400:
 *         description: Invalid input data
 *       401:
 *         description: Authentication required
 */
```

## Testing Strategy

### Test Structure
```
tests/
├── unit/                 # Unit tests for individual components
│   ├── server/
│   │   ├── services/
│   │   ├── models/
│   │   └── utils/
│   └── mobile/
│       ├── services/
│       ├── widgets/
│       └── models/
├── integration/          # Integration tests
│   ├── api/
│   ├── database/
│   └── mesh-network/
├── e2e/                  # End-to-end tests
│   ├── user-flows/
│   └── scenarios/
├── security/             # Security-specific tests
│   ├── penetration/
│   ├── crypto/
│   └── privacy/
└── performance/          # Performance benchmarks
    ├── load-tests/
    └── stress-tests/
```

### Testing Commands
```bash
# Unit tests
npm run test:unit              # Run all unit tests
npm run test:unit:watch        # Watch mode for development
npm run test:unit:coverage     # Generate coverage report

# Integration tests
npm run test:integration       # API and service integration
npm run test:integration:db    # Database integration tests

# End-to-end tests
npm run test:e2e              # Full application workflows
npm run test:e2e:mobile       # Mobile-specific e2e tests

# Security tests
npm run test:security         # Security vulnerability tests
npm run test:crypto          # Cryptographic function tests

# Performance tests
npm run test:performance      # Load and stress tests
npm run test:benchmark       # Performance benchmarks

# All tests
npm run test:all             # Complete test suite
npm run test:ci              # CI-optimized test run
```

### Test Quality Requirements
- **Unit Test Coverage**: Minimum 80% line coverage
- **Critical Path Coverage**: 100% for security-related functions
- **Integration Tests**: All API endpoints covered
- **E2E Tests**: Core user workflows validated
- **Performance Tests**: Response times under 100ms for API calls

## Security Development

### Security-First Development

#### Threat Modeling
```typescript
// Example security consideration documentation
interface SecurityConsiderations {
  threatModel: {
    assets: string[];           // What we're protecting
    threats: string[];          // What we're protecting against
    mitigations: string[];      // How we're protecting it
  };
  
  privacyImpact: {
    dataCollected: string[];    // What data is collected
    dataUsage: string[];        // How data is used
    dataRetention: string[];    // How long data is kept
  };
  
  cryptographicRequirements: {
    algorithms: string[];       // Approved cryptographic algorithms
    keyManagement: string[];    // Key generation and storage
    protocols: string[];        // Communication protocols
  };
}
```

#### Secure Coding Checklist
- [ ] Input validation on all user inputs
- [ ] Parameterized queries for database operations
- [ ] Proper error handling without information leakage
- [ ] Secure random number generation
- [ ] Constant-time comparison for sensitive data
- [ ] Rate limiting on all endpoints
- [ ] HTTPS enforcement
- [ ] Content Security Policy headers

### Security Testing

#### Automated Security Scanning
```bash
# Package vulnerability scanning
npm audit --audit-level moderate

# Static application security testing (SAST)
npm run security:sast

# Dynamic application security testing (DAST)
npm run security:dast

# Container security scanning
docker run --rm -v $(pwd):/app aquasec/trivy fs /app
```

#### Manual Security Testing
```bash
# Penetration testing with OWASP ZAP
npm run security:pentest

# Cryptographic verification
npm run security:crypto-test

# Privacy compliance check
npm run security:privacy-audit
```

## Performance Optimization

### Performance Monitoring

#### Metrics Collection
```typescript
// Performance monitoring setup
class PerformanceMonitor {
  static recordApiLatency(endpoint: string, duration: number) {
    metrics.histogram('api_request_duration', duration, {
      endpoint,
      method: 'POST'
    });
  }
  
  static recordBatteryUsage(percentage: number) {
    metrics.gauge('battery_usage_percentage', percentage);
  }
  
  static recordMemoryUsage(bytes: number) {
    metrics.gauge('memory_usage_bytes', bytes);
  }
}
```

#### Performance Benchmarks
```bash
# API performance testing
npm run perf:api

# Mobile app performance
npm run perf:mobile

# Battery usage testing
npm run perf:battery

# Memory leak detection
npm run perf:memory

# Network efficiency testing
npm run perf:network
```

### Optimization Guidelines

#### Server Optimization
- Use connection pooling for database connections
- Implement caching for frequently accessed data
- Optimize database queries with proper indexing
- Use compression for API responses
- Implement rate limiting to prevent abuse

#### Mobile Optimization
- Minimize battery usage through efficient algorithms
- Use lazy loading for UI components
- Implement efficient offline data synchronization
- Optimize image and asset sizes
- Use platform-specific optimizations

## Release Process

### Versioning Strategy

We follow [Semantic Versioning](https://semver.org/):
- **MAJOR** (1.0.0): Breaking changes
- **MINOR** (0.1.0): New features, backwards compatible
- **PATCH** (0.0.1): Bug fixes, backwards compatible

### Release Workflow

#### 1. Pre-Release Preparation
```bash
# Create release branch
git checkout -b release/v1.2.0 develop

# Update version numbers
npm run version:update 1.2.0

# Update changelog
npm run changelog:generate

# Run full test suite
npm run test:release

# Security audit
npm run security:audit
```

#### 2. Release Candidate
```bash
# Tag release candidate
git tag -a v1.2.0-rc.1 -m "Release candidate 1.2.0-rc.1"

# Build release artifacts
npm run build:release

# Deploy to staging
npm run deploy:staging

# Run acceptance tests
npm run test:acceptance
```

#### 3. Production Release
```bash
# Merge to main
git checkout main
git merge release/v1.2.0

# Tag final release
git tag -a v1.2.0 -m "Release 1.2.0"

# Build and deploy
npm run build:production
npm run deploy:production

# Merge back to develop
git checkout develop
git merge main
```

### Release Checklist

#### Pre-Release
- [ ] All tests pass on CI/CD
- [ ] Security audit completed
- [ ] Performance benchmarks met
- [ ] Documentation updated
- [ ] Changelog generated
- [ ] Version numbers updated

#### Release
- [ ] Release notes published
- [ ] Artifacts built and signed
- [ ] Production deployment successful
- [ ] Monitoring confirms stability
- [ ] Post-release testing completed

#### Post-Release
- [ ] Community notifications sent
- [ ] Metrics monitoring setup
- [ ] Feedback collection activated
- [ ] Support documentation updated

## Monitoring and Maintenance

### Application Monitoring

#### Health Checks
```typescript
// Health check endpoints
app.get('/health', (req, res) => {
  const health = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: process.env.APP_VERSION,
    services: {
      database: checkDatabaseHealth(),
      auth: checkAuthServiceHealth(),
      mesh: checkMeshNetworkHealth()
    }
  };
  
  res.json(health);
});
```

#### Error Tracking
```typescript
// Error monitoring setup
import * as Sentry from '@sentry/node';

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV,
  beforeSend(event) {
    // Sanitize sensitive data
    return sanitizeEvent(event);
  }
});
```

### Maintenance Tasks

#### Regular Maintenance
```bash
# Weekly tasks
npm run maintenance:weekly

# Monthly tasks  
npm run maintenance:monthly

# Quarterly tasks
npm run maintenance:quarterly
```

#### Database Maintenance
```sql
-- Database optimization queries
ANALYZE TABLE events;
ANALYZE TABLE users;
OPTIMIZE TABLE event_participants;

-- Cleanup old data
DELETE FROM sessions WHERE expires_at < NOW() - INTERVAL 7 DAY;
DELETE FROM audit_logs WHERE created_at < NOW() - INTERVAL 90 DAY;
```

This development guide provides the framework for maintaining high code quality, security, and performance standards throughout the Conductor project lifecycle.