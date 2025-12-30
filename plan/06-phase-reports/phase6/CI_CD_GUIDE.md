# CI/CD Pipeline Guide

## Table of Contents

- [Overview](#overview)
- [Workflows](#workflows)
  - [1. Main CI Workflow](#1-main-ci-workflow)
  - [2. Performance Testing Workflow](#2-performance-testing-workflow)
  - [3. Security Scanning Workflow](#3-security-scanning-workflow)
  - [4. Docker Build Workflow](#4-docker-build-workflow)
  - [5. Release Workflow](#5-release-workflow)
  - [6. Code Quality Workflow](#6-code-quality-workflow)
- [Configuration](#configuration)
  - [Required Secrets](#required-secrets)
  - [Environment Variables](#environment-variables)
- [Branch Protection](#branch-protection)
- [Pull Request Process](#pull-request-process)
- [Release Process](#release-process)
- [Monitoring and Troubleshooting](#monitoring-and-troubleshooting)
- [Best Practices](#best-practices)

## Overview

The Birthday Message Scheduler uses a comprehensive CI/CD pipeline built on GitHub Actions to ensure code quality, security, and reliability. All code changes go through automated testing, security scanning, and quality checks before being merged or deployed.

### Pipeline Architecture

```
┌─────────────────┐
│  Pull Request   │
└────────┬────────┘
         │
         ├──→ CI Workflow (Parallel)
         │    ├── Lint & Type Check
         │    ├── Unit Tests (5 shards)
         │    ├── Integration Tests
         │    ├── E2E Tests
         │    └── Build
         │
         ├──→ Security Workflow (Parallel)
         │    ├── npm audit
         │    ├── Snyk scan
         │    ├── OWASP check
         │    ├── Trivy scan
         │    └── License check
         │
         └──→ Code Quality Workflow (Parallel)
              ├── ESLint
              ├── TypeScript strict
              ├── Complexity analysis
              └── Code duplication

         ↓ (All checks pass)

┌─────────────────┐
│  Merge to Main  │
└────────┬────────┘
         │
         ├──→ Docker Build & Push
         │
         └──→ (If tagged: v*.*.*)
              Release Workflow
              ├── Validate
              ├── Full Test Suite
              ├── Build Artifacts
              ├── Create GitHub Release
              ├── Deploy to Staging
              └── Deploy to Production (manual approval)
```

## Workflows

### 1. Main CI Workflow

**File**: `.github/workflows/ci.yml`

**Triggers**:
- Pull requests to any branch
- Push to `main` or `develop` branches

**Jobs**:

#### 1.1 Lint and Type Check
- Runs ESLint with zero warnings policy
- Performs TypeScript type checking
- Validates code formatting with Prettier

**Duration**: ~2-3 minutes

```yaml
Steps:
1. Checkout code
2. Setup Node.js with npm cache
3. Install dependencies (npm ci)
4. Run ESLint
5. Run TypeScript type check
6. Check Prettier formatting
```

#### 1.2 Unit Tests (Sharded)
- Runs unit tests in 5 parallel shards for faster execution
- Each shard runs independently
- Generates coverage reports per shard

**Duration**: ~3-5 minutes (parallel)

```yaml
Strategy:
  matrix:
    shard: [1, 2, 3, 4, 5]

Steps:
1. Checkout code
2. Setup Node.js with cache
3. Install dependencies
4. Run tests for shard N/5
5. Upload coverage artifact
```

**Benefits of Sharding**:
- 5x faster test execution (parallel)
- Better resource utilization
- Isolated failure detection

#### 1.3 Integration Tests
- Tests with real PostgreSQL, RabbitMQ, and Redis
- Uses GitHub Actions service containers
- Validates end-to-end data flow

**Duration**: ~5-7 minutes

```yaml
Services:
- PostgreSQL 15 (with health checks)
- RabbitMQ 3.12 (with health checks)
- Redis 7 (with health checks)

Steps:
1. Checkout code
2. Setup Node.js
3. Install dependencies
4. Wait for all services to be healthy
5. Run database migrations
6. Run integration tests
7. Upload coverage
```

#### 1.4 E2E Tests
- Full stack testing with Docker Compose
- Tests complete user workflows
- Validates production-like environment

**Duration**: ~8-10 minutes

```yaml
Steps:
1. Checkout code
2. Setup Node.js
3. Install dependencies
4. Start docker-compose test environment
5. Wait for all services
6. Run migrations
7. Run E2E tests
8. Upload logs on failure
9. Cleanup (always runs)
```

#### 1.5 Coverage Report
- Merges coverage from all test types
- Uploads to Codecov
- Enforces 80% minimum coverage
- Comments coverage summary on PRs

**Coverage Thresholds**:
- Lines: 80%
- Functions: 80%
- Branches: 80%
- Statements: 80%

**Failure Conditions**:
- Any threshold below 80%
- Codecov upload fails (if configured)

```yaml
Steps:
1. Download all coverage artifacts
2. Merge coverage reports
3. Check 80% threshold (FAIL if below)
4. Upload to Codecov
5. Comment on PR with coverage details
```

#### 1.6 Build
- Compiles TypeScript to production JavaScript
- Validates build succeeds
- Uploads build artifacts

**Duration**: ~2-3 minutes

### 2. Performance Testing Workflow

**File**: `.github/workflows/performance.yml`

**Triggers**:
- Weekly schedule (Sunday 2 AM UTC)
- Manual workflow dispatch (with test type selection)

**Purpose**: Validates application can handle production load and detects performance regressions.

**Jobs**:

#### 2.1 Sustained Load Test (24 hours)
Tests 1M messages/day sustained load.

**Configuration**:
```javascript
// k6 configuration
export let options = {
  stages: [
    { duration: '1h', target: 12 },   // Ramp up
    { duration: '22h', target: 12 },  // Sustain
    { duration: '1h', target: 0 },    // Ramp down
  ],
  thresholds: {
    http_req_duration: ['p95<500', 'p99<1000'],
    http_req_failed: ['rate<0.01'],
  },
};
```

**Baseline Comparison**:
- Downloads previous baseline results
- Compares P95 latency
- Fails if degradation > 20%
- Updates baseline on main branch

**Duration**: ~25 hours

#### 2.2 Peak Load Test
Tests burst capacity of 100+ msg/sec.

**Configuration**:
```javascript
export let options = {
  stages: [
    { duration: '2m', target: 50 },
    { duration: '5m', target: 100 },
    { duration: '10m', target: 150 },
    { duration: '5m', target: 100 },
    { duration: '2m', target: 0 },
  ],
};
```

**Duration**: ~30 minutes

#### 2.3 Worker Scaling Test
Tests horizontal scaling with different worker counts.

**Matrix**:
```yaml
strategy:
  matrix:
    workers: [1, 5, 10]
```

Validates:
- Linear throughput scaling
- No performance degradation
- Proper message distribution

**Duration**: ~45 minutes (per worker count)

#### 2.4 Performance Report
- Consolidates all performance test results
- Generates HTML report
- Creates performance summary
- Posts comment on commit (scheduled runs)
- Sends Slack notification on failure

**Artifacts**:
- Performance reports (30-day retention)
- Baseline results (90-day retention)

### 3. Security Scanning Workflow

**File**: `.github/workflows/security.yml`

**Triggers**:
- Pull requests
- Push to main
- Daily schedule (midnight UTC)
- Manual dispatch

**Jobs**:

#### 3.1 NPM Audit
- Scans for known vulnerabilities in dependencies
- Production dependencies: moderate+ severity fails build
- All dependencies: informational only

```bash
npm audit --omit=dev --audit-level=moderate  # FAIL
npm audit --audit-level=moderate             # WARN
```

**Artifacts**: JSON and text audit reports (30 days)

#### 3.2 Snyk Scan
- Advanced vulnerability scanning
- Integrates with GitHub Security
- Scans both code and Docker images

**Configuration**:
```yaml
severity-threshold: high
output: SARIF format
upload: GitHub Code Scanning
```

**Requirements**:
- `SNYK_TOKEN` secret must be configured

#### 3.3 OWASP Dependency Check
- Comprehensive dependency vulnerability scanning
- CVE database checking
- Fails on CVSS score ≥ 7

**Features**:
- Retired dependency detection
- Experimental checks enabled
- Suppression file support

**Artifacts**:
- OWASP reports (30 days)
- SARIF upload to GitHub Security

#### 3.4 Trivy Container Scan
- Scans Docker images for vulnerabilities
- Filesystem scanning
- OS package vulnerabilities
- Application dependency vulnerabilities

**Scan Types**:
1. Container image scan (if Dockerfile exists)
2. Filesystem scan (always runs)

**Severity**: CRITICAL and HIGH vulnerabilities fail build

#### 3.5 License Compliance
- Validates all dependency licenses
- Ensures no restricted licenses

**Restricted Licenses**:
- GPL (all versions)
- AGPL
- LGPL
- SSPL
- Commons Clause

**Tool**: `license-checker`

#### 3.6 CodeQL Analysis
- GitHub's semantic code analysis
- Detects security vulnerabilities
- Analyzes JavaScript/TypeScript
- Security and quality queries

**Output**: Integrated with GitHub Security tab

### 4. Docker Build Workflow

**File**: `.github/workflows/docker-build.yml`

**Triggers**:
- Push to main branch
- Version tags (v*.*.*)
- Pull requests (build only, no push)

**Registry**: GitHub Container Registry (ghcr.io)

**Features**:

#### Multi-Platform Builds
```yaml
Platforms:
  - linux/amd64
  - linux/arm64
```

**PR builds**: Single platform (amd64) for speed

#### Image Tags
```yaml
Tags:
  - latest (main branch only)
  - {version} (from tags)
  - {major}.{minor} (from tags)
  - {major} (from tags)
  - {branch}-{sha} (all branches)
  - {pr}-{sha} (PRs)
```

#### Build Optimization
- Layer caching with GitHub Actions cache
- BuildKit optimizations
- Multi-stage builds

#### Security Scanning
- Trivy vulnerability scan (post-build)
- Container structure tests
- SBOM (Software Bill of Materials) generation
- Grype SBOM vulnerability scanning

#### Build Arguments
```dockerfile
NODE_ENV=production
BUILD_DATE={timestamp}
VCS_REF={git-sha}
VERSION={version}
```

**Duration**:
- PR builds: ~10 minutes (single platform)
- Main/tag builds: ~20 minutes (multi-platform)

### 5. Release Workflow

**File**: `.github/workflows/release.yml`

**Triggers**:
- Push of version tags (v1.2.3)
- Manual workflow dispatch

**Jobs**:

#### 5.1 Validate Release
- Validates version tag format (v*.*.*)
- Checks tag existence
- Ensures proper semver

```bash
Format: vMAJOR.MINOR.PATCH
Example: v1.2.3
```

#### 5.2 Run Full Test Suite
- Complete test execution
- All test types (unit, integration, E2E)
- Linting and type checking
- Coverage threshold validation

**Services**:
- PostgreSQL
- RabbitMQ

**Exit Criteria**: All tests must pass

#### 5.3 Build Production Artifacts
- Compiles TypeScript
- Creates production tarball
- Includes:
  - Compiled dist/
  - package.json & package-lock.json
  - README.md
  - LICENSE

**Artifact**: `birthday-scheduler-{version}.tar.gz`

#### 5.4 Create GitHub Release
- Generates changelog from commits
- Categorizes changes:
  - Features (feat:)
  - Bug Fixes (fix:)
  - Performance (perf:)
  - Documentation (docs:)
  - Other changes

- Attaches build artifacts
- Creates release notes
- Tags release

**Retention**: 90 days

#### 5.5 Deploy to Staging
- Automated deployment
- Environment URL: staging.birthday-scheduler.example.com
- Runs smoke tests
- Posts deployment status

**Smoke Tests**:
- Health check endpoint
- Database connectivity
- Message queue connectivity
- Basic API functionality

#### 5.6 Deploy to Production
- **Requires manual approval** via GitHub Environments
- Creates deployment record
- Updates deployment status
- Notifies team on success/failure
- Rollback capability on failure

**Environment**: production
**URL**: birthday-scheduler.example.com

**Deployment Steps**:
1. Create GitHub deployment
2. Execute deployment (platform-specific)
3. Update deployment status
4. Notify team
5. Rollback if failed

### 6. Code Quality Workflow

**File**: `.github/workflows/code-quality.yml`

**Triggers**:
- Pull requests
- Push to main
- Manual dispatch

**Jobs**:

#### 6.1 ESLint Analysis
- Runs ESLint with JSON output
- Annotates code with findings
- Quality gate enforcement

**Quality Gates**:
- 0 errors (strict)
- ≤10 warnings (threshold)

**Features**:
- Code annotations on PR
- Detailed report artifacts

#### 6.2 TypeScript Strict Mode
- Verifies strict mode enabled
- Runs full type check
- Zero type errors policy

**Checks**:
```typescript
// Must be true in tsconfig.json
"strict": true
```

#### 6.3 Complexity Analysis
- Analyzes code complexity
- Detects high-complexity functions
- Cyclomatic complexity threshold

**Thresholds**:
- Complexity > 10: Warning
- More than 5 functions with complexity > 10: Fail

**Tool**: `complexity-report`

#### 6.4 Code Duplication Check
- Detects duplicate code
- Threshold: 5% duplication

**Tool**: `jscpd`

#### 6.5 SonarCloud Analysis (Optional)
- Comprehensive code quality platform
- Security vulnerability detection
- Code smell detection
- Technical debt calculation
- Quality gate enforcement

**Requirements**:
- `SONAR_TOKEN` secret
- SonarCloud project setup

**Configuration**:
```yaml
Project: birthday-message-scheduler
Sources: src/
Tests: tests/
Coverage: coverage/lcov.info
Quality Gate: Wait for result
```

#### 6.6 PR Quality Report
- Consolidates all quality metrics
- Posts comprehensive comment on PR
- Deletes old comments (keeps PR clean)

**Report Includes**:
- ESLint errors/warnings
- TypeScript status
- Code duplication percentage
- Quality gate status

## Configuration

### Required Secrets

Configure these in GitHub repository settings → Secrets and variables → Actions:

#### Essential Secrets

1. **GITHUB_TOKEN** (automatic)
   - Provided automatically by GitHub Actions
   - Used for: API access, package registry, releases

2. **CODECOV_TOKEN**
   - Get from: https://codecov.io
   - Used for: Coverage reporting
   - Setup: Create account, link repository

#### Security Scanning Secrets

3. **SNYK_TOKEN**
   - Get from: https://snyk.io
   - Used for: Vulnerability scanning
   - Setup: Create account, generate API token

4. **SONAR_TOKEN** (optional)
   - Get from: https://sonarcloud.io
   - Used for: Code quality analysis
   - Setup: Create project, generate token

#### Notification Secrets

5. **SLACK_WEBHOOK_URL** (optional)
   - Get from: Slack workspace settings
   - Used for: Performance test failure notifications
   - Setup: Create incoming webhook

### Environment Variables

#### CI Workflow
```yaml
DATABASE_URL: postgres://test:test@localhost:5432/test_db
RABBITMQ_URL: amqp://test:test@localhost:5672
REDIS_URL: redis://localhost:6379
API_URL: http://localhost:3000
```

#### Performance Workflow
```yaml
DATABASE_URL: postgres://perf:perf@localhost:5432/perf_db
API_URL: http://localhost
WORKERS: [1, 5, 10] (matrix)
```

### GitHub Environments

Create these environments in repository settings:

1. **staging**
   - URL: https://staging.birthday-scheduler.example.com
   - Reviewers: Not required
   - Deployment branches: Tags only

2. **production**
   - URL: https://birthday-scheduler.example.com
   - Reviewers: Required (1+ approvals)
   - Deployment branches: Tags only
   - Wait timer: Optional

## Branch Protection

See detailed guide: [.github/BRANCH_PROTECTION.md](.github/BRANCH_PROTECTION.md)

### Quick Setup

**Main Branch Protection**:
```yaml
Required status checks:
  - lint-and-type-check
  - unit-tests
  - integration-tests
  - e2e-tests
  - build
  - security-scan
  - eslint
  - typescript-strict

Require:
  - Pull request reviews (1+ approval)
  - Branches up to date
  - Conversation resolution
  - Linear history
  - Signed commits

Restrict:
  - No force pushes
  - No deletions
  - No bypassing
```

## Pull Request Process

### 1. Create Feature Branch

```bash
git checkout -b feature/description
# or
git checkout -b fix/description
# or
git checkout -b refactor/description
```

### 2. Develop and Test Locally

```bash
# Run tests
npm run test:unit
npm run test:integration
npm run test:e2e

# Check coverage
npm run test:coverage

# Lint and format
npm run lint
npm run format

# Type check
npm run typecheck

# Build
npm run build
```

### 3. Commit Changes

Use conventional commits:

```bash
git commit -m "feat: add birthday notification feature"
git commit -m "fix: resolve timezone calculation bug"
git commit -m "perf: optimize database queries"
git commit -m "docs: update API documentation"
git commit -m "test: add unit tests for scheduler"
git commit -m "refactor: simplify message queue handler"
```

### 4. Push and Create PR

```bash
git push origin feature/description
```

Create PR using template - fills in automatically

### 5. Automated Checks Run

Monitor workflow progress:
- ✅ CI workflow (5-10 min)
- ✅ Security workflow (5-10 min)
- ✅ Code quality workflow (3-5 min)
- ✅ Docker build workflow (10 min, PR builds)

### 6. Address Review Comments

```bash
# Make changes
git add .
git commit -m "fix: address review comments"
git push
```

Workflows re-run automatically

### 7. Merge

Once approved and all checks pass:
- Squash and merge (recommended)
- Create merge commit
- Rebase and merge

## Release Process

### 1. Prepare Release

```bash
# Ensure main is up to date
git checkout main
git pull origin main

# Update version in package.json
npm version patch  # 1.0.0 -> 1.0.1
# or
npm version minor  # 1.0.0 -> 1.1.0
# or
npm version major  # 1.0.0 -> 2.0.0
```

### 2. Push Version Tag

```bash
git push origin main --tags
```

### 3. Monitor Release Workflow

Automatic execution:
1. ✅ Validate version tag (1 min)
2. ✅ Run full test suite (15-20 min)
3. ✅ Build artifacts (5 min)
4. ✅ Create GitHub release (2 min)
5. ✅ Deploy to staging (5-10 min)
6. ⏸️ **WAIT** for production approval

### 4. Approve Production Deployment

1. Go to Actions → Release workflow → Latest run
2. Click "Review deployments"
3. Select "production"
4. Add comment (optional)
5. Click "Approve and deploy"

### 5. Monitor Production Deployment

- Watch deployment logs
- Check application health
- Verify metrics
- Monitor error rates

### 6. Rollback (if needed)

If deployment fails:

```bash
# Revert to previous version
git revert HEAD
git push origin main

# Or create hotfix
git checkout -b hotfix/issue-description
# Fix issue
git commit -m "fix: resolve production issue"
git push origin hotfix/issue-description
# Create PR, merge, tag new version
```

## Monitoring and Troubleshooting

### Workflow Status

Check workflow status:
- Repository → Actions tab
- Specific PR → Checks tab
- Commit → Status icon

### Common Issues

#### Issue: Workflow Stuck

**Symptoms**: Workflow shows as running for hours

**Solutions**:
```bash
# Cancel workflow
gh workflow run cancel <run-id>

# Or via UI: Actions → Select run → Cancel
```

#### Issue: Flaky Tests

**Symptoms**: Tests pass/fail intermittently

**Solutions**:
1. Check test logs for timing issues
2. Review test isolation
3. Add retries for network tests
4. Increase timeouts for slow operations

```typescript
// Add test retries
test.describe.configure({ retries: 2 });

// Increase timeout
test.setTimeout(30000);
```

#### Issue: Coverage Below Threshold

**Symptoms**: Coverage check fails

**Solutions**:
1. Identify uncovered files:
   ```bash
   npm run test:coverage
   # Check HTML report: coverage/index.html
   ```
2. Add missing tests
3. Remove dead code
4. Adjust thresholds (if justified)

#### Issue: Security Scan Fails

**Symptoms**: Vulnerabilities detected

**Solutions**:
1. Review vulnerability details
2. Update dependencies:
   ```bash
   npm audit fix
   npm audit fix --force  # For breaking changes
   ```
3. Create suppression file if false positive
4. Create issue for tracking if can't fix immediately

#### Issue: Docker Build Fails

**Symptoms**: Image build errors

**Solutions**:
1. Check Dockerfile syntax
2. Verify base image availability
3. Test build locally:
   ```bash
   docker build -t test .
   ```
4. Check build logs for specific errors

### Debugging Workflows

#### Enable Debug Logging

Add secrets to repository:
```yaml
ACTIONS_STEP_DEBUG: true
ACTIONS_RUNNER_DEBUG: true
```

#### Re-run Failed Jobs

- Actions → Select run → Re-run failed jobs
- Or re-run all jobs

#### Download Artifacts

```bash
gh run download <run-id>
# Or via UI: Actions → Select run → Artifacts
```

### Performance Monitoring

#### View Performance Trends

1. Actions → Performance Tests workflow
2. View artifacts from weekly runs
3. Download HTML reports
4. Compare baseline metrics

#### Performance Degradation

If performance degrades:
1. Review recent changes
2. Check baseline comparison
3. Run profiler locally
4. Optimize hot paths
5. Update baseline if improvement

## Best Practices

### For All Contributors

1. **Run tests locally before pushing**
   ```bash
   npm run lint && npm run typecheck && npm run test:unit
   ```

2. **Keep PRs focused and small**
   - Single concern per PR
   - Easier to review
   - Faster to merge

3. **Write meaningful commit messages**
   ```bash
   # Good
   feat: add timezone support for birthday scheduling

   # Bad
   update files
   ```

4. **Add tests for new features**
   - Unit tests for logic
   - Integration tests for flows
   - E2E tests for user scenarios

5. **Update documentation**
   - README for user-facing changes
   - Code comments for complex logic
   - API docs for endpoint changes

### For Reviewers

1. **Review promptly** (within 24 hours)
2. **Be constructive** in feedback
3. **Check tests and coverage**
4. **Verify CI is green** before approving
5. **Think about edge cases**

### For Maintainers

1. **Monitor workflow run times**
   - Optimize slow jobs
   - Parallelize where possible

2. **Keep dependencies updated**
   - Review Dependabot PRs weekly
   - Group updates when sensible

3. **Review security alerts**
   - Address critical vulnerabilities immediately
   - Plan fixes for high-severity issues

4. **Maintain CI/CD pipelines**
   - Update actions versions
   - Review and improve workflows
   - Keep documentation current

5. **Track metrics**
   - Build success rate
   - Average build time
   - Time to deployment
   - MTTR (Mean Time To Recovery)

## Additional Resources

- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [Docker Build Best Practices](https://docs.docker.com/develop/dev-best-practices/)
- [k6 Performance Testing](https://k6.io/docs/)
- [Conventional Commits](https://www.conventionalcommits.org/)

## Support

For CI/CD issues:

1. Check this guide
2. Review workflow logs
3. Consult team members
4. Open issue with `ci/cd` label

---

**Last Updated**: 2025-12-30
**Maintained By**: DevOps Team
**Review Schedule**: Monthly
