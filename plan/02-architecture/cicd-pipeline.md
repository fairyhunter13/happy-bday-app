# CI/CD Pipeline Architecture Design
**Birthday Message Scheduler - Continuous Integration & Deployment**

**Agent:** Coder/Architect (Hive Mind Collective)
**Date:** December 30, 2025
**Version:** 1.0
**Phase:** Architectural Design (No Implementation)

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Pipeline Architecture](#pipeline-architecture)
3. [GitHub Actions Workflow Design](#github-actions-workflow-design)
4. [Docker Build Strategy](#docker-build-strategy)
5. [Testing Pipeline](#testing-pipeline)
6. [Security Scanning](#security-scanning)
7. [Performance Benchmarking](#performance-benchmarking)
8. [Deployment Strategies](#deployment-strategies)
9. [Environment Management](#environment-management)
10. [Artifact Management](#artifact-management)
11. [Monitoring & Notifications](#monitoring--notifications)
12. [Rollback Mechanisms](#rollback-mechanisms)

---

## Executive Summary

This document outlines the comprehensive CI/CD pipeline architecture for the Birthday Message Scheduler backend application. The pipeline is designed to:

- **Automate Testing:** Unit, integration, E2E, and performance tests
- **Ensure Code Quality:** Linting, type checking, security scanning
- **Build Docker Images:** Multi-stage, multi-platform builds
- **Deploy Automatically:** To dev, staging, and production environments
- **Monitor Pipeline Health:** Metrics, logs, and notifications

### Pipeline Metrics Targets

| Metric | Target | Current Industry Average |
|--------|--------|--------------------------|
| Total Pipeline Time | < 10 minutes | 15-30 minutes |
| Test Execution | < 8 minutes | 10-20 minutes |
| Build Time | < 3 minutes | 5-10 minutes |
| Deploy Time | < 2 minutes | 3-5 minutes |
| Pipeline Success Rate | > 95% | 85-90% |

---

## Pipeline Architecture

### High-Level Pipeline Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                        Code Push (GitHub)                        │
└────────────────────────────┬────────────────────────────────────┘
                             │
                ┌────────────▼──────────────┐
                │   Pre-Commit Hooks        │
                │   - ESLint                │
                │   - Prettier              │
                │   - Type Check            │
                └────────────┬──────────────┘
                             │
                ┌────────────▼──────────────┐
                │   GitHub Actions Trigger  │
                │   - Push to main/develop  │
                │   - Pull Request          │
                └────────────┬──────────────┘
                             │
        ┌────────────────────┼────────────────────┐
        │                    │                    │
┌───────▼──────┐    ┌────────▼────────┐   ┌──────▼───────┐
│   Lint Job   │    │  Build Job      │   │ Security Job │
│   (1 min)    │    │  (3 min)        │   │  (2 min)     │
└───────┬──────┘    └────────┬────────┘   └──────┬───────┘
        │                    │                    │
        └────────────────────┼────────────────────┘
                             │
        ┌────────────────────┼────────────────────────────────┐
        │                    │                                 │
┌───────▼──────┐    ┌────────▼────────┐    ┌────────────────▼────┐
│  Unit Tests  │    │ Integration     │    │   E2E Tests         │
│  (2 min)     │    │ Tests (3 min)   │    │   (4 min)           │
│  5 shards    │    │ PostgreSQL +    │    │   Full Stack        │
└───────┬──────┘    │ Redis           │    └──────┬──────────────┘
        │           └────────┬────────┘           │
        │                    │                    │
        └────────────────────┼────────────────────┘
                             │
                    ┌────────▼────────┐
                    │ Performance     │
                    │ Tests (PR only) │
                    │ (5 min)         │
                    └────────┬────────┘
                             │
                    ┌────────▼────────┐
                    │ Coverage Report │
                    │ & Upload        │
                    │ (1 min)         │
                    └────────┬────────┘
                             │
        ┌────────────────────┼────────────────────┐
        │                    │                    │
┌───────▼──────┐    ┌────────▼────────┐   ┌──────▼───────┐
│   Deploy     │    │   Deploy        │   │   Deploy     │
│   Dev        │    │   Staging       │   │   Production │
│   (Auto)     │    │   (Auto)        │   │   (Manual)   │
└──────────────┘    └─────────────────┘   └──────────────┘
```

### Pipeline Execution Matrix

| Trigger Event | Lint | Build | Test | Security | Performance | Deploy |
|---------------|------|-------|------|----------|-------------|--------|
| Push to develop | ✅ | ✅ | ✅ | ✅ | ❌ | Dev |
| Push to main | ✅ | ✅ | ✅ | ✅ | ❌ | Staging |
| Pull Request | ✅ | ✅ | ✅ | ✅ | ✅ | None |
| Tag (v*) | ✅ | ✅ | ✅ | ✅ | ✅ | Production |

---

## GitHub Actions Workflow Design

### Main Workflow File Structure

```
.github/
└── workflows/
    ├── ci.yml                      # Main CI pipeline
    ├── code-quality.yml            # ESLint, Prettier, jscpd
    ├── docker-build.yml            # Docker image build & push
    ├── docs.yml                    # GitHub Pages documentation
    ├── mutation.yml                # Stryker mutation testing
    ├── openapi-validation.yml      # OpenAPI spec validation
    ├── performance.yml             # k6 load tests (manual trigger)
    ├── security.yml                # npm audit, Snyk scanning
    ├── sonar.yml                   # SonarCloud analysis
    └── cleanup.yml                 # Cleanup old artifacts/images
```

> **Note:** This project is scoped for local/CI environments only. Cloud deployment workflows (deploy-dev, deploy-staging, deploy-production) are intentionally not included per `docs/ARCHITECTURE_SCOPE.md`.

### Complete CI Workflow (ci.yml)

```yaml
name: CI Pipeline

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main, develop]
  workflow_dispatch:

env:
  NODE_VERSION: '20.x'
  DOCKER_REGISTRY: ghcr.io
  IMAGE_NAME: ${{ github.repository }}

jobs:
  # =========================================
  # JOB 1: Code Quality & Linting
  # =========================================
  lint:
    name: Lint & Type Check
    runs-on: ubuntu-latest
    timeout-minutes: 5

    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: 'npm'

      - name: Cache dependencies
        uses: actions/cache@v3
        with:
          path: ~/.npm
          key: ${{ runner.os }}-node-${{ hashFiles('**/package-lock.json') }}
          restore-keys: |
            ${{ runner.os }}-node-

      - name: Install dependencies
        run: npm ci

      - name: Run ESLint
        run: npm run lint

      - name: Run Prettier
        run: npm run format:check

      - name: TypeScript type check
        run: npm run type-check

  # =========================================
  # JOB 2: Unit Tests (Parallel Sharding)
  # =========================================
  unit-tests:
    name: Unit Tests (Shard ${{ matrix.shard }}/5)
    runs-on: ubuntu-latest
    timeout-minutes: 10

    strategy:
      fail-fast: false
      matrix:
        shard: [1, 2, 3, 4, 5]

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

      - name: Run unit tests (shard ${{ matrix.shard }}/5)
        run: npm run test:unit -- --shard=${{ matrix.shard }}/5 --reporter=verbose --coverage

      - name: Upload coverage artifact
        uses: actions/upload-artifact@v4
        with:
          name: coverage-unit-${{ matrix.shard }}
          path: coverage/
          retention-days: 1

      - name: Upload test results
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: test-results-unit-${{ matrix.shard }}
          path: test-results/
          retention-days: 7

  # =========================================
  # JOB 3: Integration Tests
  # =========================================
  integration-tests:
    name: Integration Tests
    runs-on: ubuntu-latest
    timeout-minutes: 15

    services:
      postgres:
        image: postgres:15-alpine
        env:
          POSTGRES_DB: birthday_test
          POSTGRES_USER: test
          POSTGRES_PASSWORD: test
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

      - name: Wait for services
        run: |
          timeout 60 bash -c 'until pg_isready -h localhost -p 5432 -U test; do sleep 2; done'
          timeout 60 bash -c 'until redis-cli -h localhost -p 6379 ping; do sleep 2; done'

      - name: Run database migrations
        run: npm run migrate
        env:
          DATABASE_URL: postgresql://test:test@localhost:5432/birthday_test

      - name: Run integration tests
        run: npm run test:integration -- --reporter=verbose --coverage
        env:
          DATABASE_URL: postgresql://test:test@localhost:5432/birthday_test
          REDIS_URL: redis://localhost:6379
          NODE_ENV: test

      - name: Upload coverage artifact
        uses: actions/upload-artifact@v4
        with:
          name: coverage-integration
          path: coverage/
          retention-days: 1

      - name: Upload test results
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: test-results-integration
          path: test-results/
          retention-days: 7

  # =========================================
  # JOB 4: End-to-End Tests
  # =========================================
  e2e-tests:
    name: End-to-End Tests
    runs-on: ubuntu-latest
    timeout-minutes: 20

    services:
      postgres:
        image: postgres:15-alpine
        env:
          POSTGRES_DB: birthday_test
          POSTGRES_USER: test
          POSTGRES_PASSWORD: test
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

      - name: Build application
        run: npm run build

      - name: Run database migrations
        run: npm run migrate
        env:
          DATABASE_URL: postgresql://test:test@localhost:5432/birthday_test

      - name: Start application in background
        run: |
          npm start &
          echo $! > app.pid
        env:
          DATABASE_URL: postgresql://test:test@localhost:5432/birthday_test
          REDIS_URL: redis://localhost:6379
          PORT: 3000
          NODE_ENV: test

      - name: Wait for application startup
        run: |
          timeout 60 bash -c 'until curl -f http://localhost:3000/health; do sleep 2; done'

      - name: Run E2E tests
        run: npm run test:e2e -- --reporter=verbose --coverage
        env:
          API_BASE_URL: http://localhost:3000

      - name: Stop application
        if: always()
        run: |
          if [ -f app.pid ]; then
            kill $(cat app.pid) || true
            rm app.pid
          fi

      - name: Upload coverage artifact
        uses: actions/upload-artifact@v4
        with:
          name: coverage-e2e
          path: coverage/
          retention-days: 1

      - name: Upload test results
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: test-results-e2e
          path: test-results/
          retention-days: 7

      - name: Upload application logs
        if: failure()
        uses: actions/upload-artifact@v4
        with:
          name: app-logs-e2e
          path: logs/
          retention-days: 7

  # =========================================
  # JOB 5: Performance Tests (PR only)
  # =========================================
  performance-tests:
    name: Performance Tests
    runs-on: ubuntu-latest
    if: github.event_name == 'pull_request'
    timeout-minutes: 15

    services:
      postgres:
        image: postgres:15-alpine
        env:
          POSTGRES_DB: birthday_test
          POSTGRES_USER: test
          POSTGRES_PASSWORD: test
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

      - name: Install k6
        run: |
          sudo gpg -k
          sudo gpg --no-default-keyring --keyring /usr/share/keyrings/k6-archive-keyring.gpg --keyserver hkp://keyserver.ubuntu.com:80 --recv-keys C5AD17C747E3415A3642D57D77C6C491D6AC1D69
          echo "deb [signed-by=/usr/share/keyrings/k6-archive-keyring.gpg] https://dl.k6.io/deb stable main" | sudo tee /etc/apt/sources.list.d/k6.list
          sudo apt-get update
          sudo apt-get install k6

      - name: Build application
        run: npm run build

      - name: Run database migrations
        run: npm run migrate
        env:
          DATABASE_URL: postgresql://test:test@localhost:5432/birthday_test

      - name: Start application
        run: npm start &
        env:
          DATABASE_URL: postgresql://test:test@localhost:5432/birthday_test
          REDIS_URL: redis://localhost:6379
          PORT: 3000

      - name: Wait for application
        run: timeout 60 bash -c 'until curl -f http://localhost:3000/health; do sleep 2; done'

      - name: Run k6 performance tests
        run: k6 run tests/performance/api-load.k6.ts --out json=performance-results.json
        env:
          API_BASE_URL: http://localhost:3000

      - name: Upload performance results
        uses: actions/upload-artifact@v4
        with:
          name: performance-results
          path: performance-results.json
          retention-days: 30

      - name: Comment performance summary on PR
        uses: actions/github-script@v7
        with:
          script: |
            const fs = require('fs');
            const results = JSON.parse(fs.readFileSync('performance-results.json'));
            // Parse and format results
            const comment = `## Performance Test Results\n\n` +
              `- Avg Response Time: ${results.metrics.http_req_duration.avg}ms\n` +
              `- P95 Response Time: ${results.metrics.http_req_duration.p95}ms\n` +
              `- Request Rate: ${results.metrics.http_reqs.rate}/s`;

            github.rest.issues.createComment({
              issue_number: context.issue.number,
              owner: context.repo.owner,
              repo: context.repo.repo,
              body: comment
            });

  # =========================================
  # JOB 6: Coverage Report & Merge
  # =========================================
  coverage:
    name: Coverage Report
    runs-on: ubuntu-latest
    needs: [unit-tests, integration-tests, e2e-tests]
    timeout-minutes: 5

    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}

      - name: Download all coverage artifacts
        uses: actions/download-artifact@v4
        with:
          pattern: coverage-*
          path: coverage-parts/

      - name: Install dependencies
        run: npm ci

      - name: Merge coverage reports
        run: |
          npx nyc merge coverage-parts coverage/coverage.json
          npx nyc report --reporter=lcov --reporter=text --reporter=html --reporter=json-summary

      - name: Check coverage thresholds
        run: npx nyc check-coverage --lines 85 --functions 85 --branches 80 --statements 85

      - name: Upload merged coverage
        uses: actions/upload-artifact@v4
        with:
          name: coverage-merged
          path: coverage/
          retention-days: 30

      - name: Upload coverage to Codecov
        uses: codecov/codecov-action@v4
        with:
          files: ./coverage/lcov.info
          flags: unittests,integration,e2e
          name: codecov-umbrella
          fail_ci_if_error: true
          token: ${{ secrets.CODECOV_TOKEN }}

      - name: Comment PR with coverage
        if: github.event_name == 'pull_request'
        uses: romeovs/lcov-reporter-action@v0.3.1
        with:
          lcov-file: ./coverage/lcov.info
          github-token: ${{ secrets.GITHUB_TOKEN }}

  # =========================================
  # JOB 7: Security Scanning
  # =========================================
  security:
    name: Security Scan
    runs-on: ubuntu-latest
    timeout-minutes: 10

    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}

      - name: Install dependencies
        run: npm ci

      - name: Run npm audit
        run: npm audit --audit-level=moderate

      - name: Run Snyk security scan
        uses: snyk/actions/node@master
        env:
          SNYK_TOKEN: ${{ secrets.SNYK_TOKEN }}
        with:
          args: --severity-threshold=high

      - name: Run Trivy vulnerability scanner
        uses: aquasecurity/trivy-action@master
        with:
          scan-type: 'fs'
          scan-ref: '.'
          format: 'sarif'
          output: 'trivy-results.sarif'

      - name: Upload Trivy results to GitHub Security
        uses: github/codeql-action/upload-sarif@v3
        with:
          sarif_file: 'trivy-results.sarif'

  # =========================================
  # JOB 8: Docker Build & Push
  # =========================================
  build:
    name: Build Docker Image
    runs-on: ubuntu-latest
    needs: [lint, unit-tests, integration-tests, e2e-tests, security]
    if: github.event_name == 'push'
    timeout-minutes: 15

    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Set up Docker Buildx
        uses: docker/setup-buildx-action@v3

      - name: Login to GitHub Container Registry
        uses: docker/login-action@v3
        with:
          registry: ghcr.io
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}

      - name: Extract metadata
        id: meta
        uses: docker/metadata-action@v5
        with:
          images: ghcr.io/${{ github.repository }}
          tags: |
            type=ref,event=branch
            type=ref,event=pr
            type=semver,pattern={{version}}
            type=semver,pattern={{major}}.{{minor}}
            type=sha,prefix={{branch}}-

      - name: Build and push Docker image
        uses: docker/build-push-action@v5
        with:
          context: .
          platforms: linux/amd64,linux/arm64
          push: true
          tags: ${{ steps.meta.outputs.tags }}
          labels: ${{ steps.meta.outputs.labels }}
          cache-from: type=registry,ref=ghcr.io/${{ github.repository }}:buildcache
          cache-to: type=registry,ref=ghcr.io/${{ github.repository }}:buildcache,mode=max
          build-args: |
            BUILD_DATE=${{ github.event.head_commit.timestamp }}
            VCS_REF=${{ github.sha }}
            VERSION=${{ steps.meta.outputs.version }}

  # =========================================
  # JOB 9: Test Summary
  # =========================================
  test-summary:
    name: Test Summary
    runs-on: ubuntu-latest
    needs: [lint, unit-tests, integration-tests, e2e-tests, coverage]
    if: always()
    timeout-minutes: 5

    steps:
      - name: Download all test results
        uses: actions/download-artifact@v4
        with:
          pattern: test-results-*
          path: test-results/

      - name: Generate test summary
        run: |
          echo "## Test Summary" >> $GITHUB_STEP_SUMMARY
          echo "- Lint: ${{ needs.lint.result }}" >> $GITHUB_STEP_SUMMARY
          echo "- Unit Tests: ${{ needs.unit-tests.result }}" >> $GITHUB_STEP_SUMMARY
          echo "- Integration Tests: ${{ needs.integration-tests.result }}" >> $GITHUB_STEP_SUMMARY
          echo "- E2E Tests: ${{ needs.e2e-tests.result }}" >> $GITHUB_STEP_SUMMARY
          echo "- Coverage: ${{ needs.coverage.result }}" >> $GITHUB_STEP_SUMMARY

      - name: Check overall status
        run: |
          if [ "${{ needs.lint.result }}" != "success" ] || \
             [ "${{ needs.unit-tests.result }}" != "success" ] || \
             [ "${{ needs.integration-tests.result }}" != "success" ] || \
             [ "${{ needs.e2e-tests.result }}" != "success" ] || \
             [ "${{ needs.coverage.result }}" != "success" ]; then
            echo "::error::Some tests failed!"
            exit 1
          fi
          echo "✅ All tests passed!"
```

---

## Docker Build Strategy

### Multi-Stage Dockerfile

```dockerfile

# =========================================
# Stage 1: Base Image
# =========================================

FROM node:20-alpine AS base

WORKDIR /app

# Install security updates

RUN apk update && apk upgrade && \
    apk add --no-cache dumb-init && \
    rm -rf /var/cache/apk/*

# =========================================
# Stage 2: Dependencies
# =========================================

FROM base AS dependencies

# Copy package files

COPY package*.json ./

# Install ALL dependencies (including devDependencies for build)

RUN npm ci --ignore-scripts && \
    npm cache clean --force

# =========================================
# Stage 3: Build
# =========================================

FROM dependencies AS build

# Copy source code

COPY . .

# Build TypeScript

RUN npm run build && \
    npm prune --production

# =========================================
# Stage 4: Production
# =========================================

FROM base AS production

# Set environment

ENV NODE_ENV=production \
    PORT=3000

# Create non-root user

RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

# Copy production dependencies

COPY --from=build --chown=nodejs:nodejs /app/node_modules ./node_modules

# Copy built application

COPY --from=build --chown=nodejs:nodejs /app/dist ./dist
COPY --from=build --chown=nodejs:nodejs /app/package*.json ./

# Switch to non-root user

USER nodejs

# Expose port

EXPOSE 3000

# Health check

HEALTHCHECK --interval=30s --timeout=3s --start-period=30s --retries=3 \
    CMD node -e "require('http').get('http://localhost:3000/health', (r) => { process.exit(r.statusCode === 200 ? 0 : 1); });"

# Start application with dumb-init

ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "dist/index.js"]

# =========================================
# Stage 5: Development
# =========================================

FROM dependencies AS development

ENV NODE_ENV=development

# Install development tools

RUN npm install -g nodemon tsx

# Copy source code

COPY . .

# Start with hot-reload

CMD ["npm", "run", "dev"]
```

### Build Optimization Strategies

**Multi-platform Builds:**
```yaml
- name: Build for multiple platforms
  uses: docker/build-push-action@v5
  with:
    platforms: linux/amd64,linux/arm64
    cache-from: type=gha
    cache-to: type=gha,mode=max
```

**Layer Caching:**
```yaml
- name: Cache Docker layers
  uses: docker/build-push-action@v5
  with:
    cache-from: type=registry,ref=${{ env.IMAGE_NAME }}:buildcache
    cache-to: type=registry,ref=${{ env.IMAGE_NAME }}:buildcache,mode=max
```

**Image Size Reduction:**
- Use Alpine base images (5x smaller than standard Node)
- Multi-stage builds (remove build dependencies)
- Prune production dependencies
- Remove unnecessary files

**Security Hardening:**
- Non-root user execution
- Security updates via apk
- Minimal attack surface (Alpine)
- Health checks for monitoring

---

## Testing Pipeline

### Test Execution Strategy

**Parallel Execution:**
```yaml
strategy:
  fail-fast: false
  matrix:
    shard: [1, 2, 3, 4, 5]
```

**Benefits:**
- 5x faster test execution
- Better resource utilization
- Isolated test failures
- Reduced queue time

**Test Dependency Management:**
```yaml
needs: [lint, unit-tests, integration-tests, e2e-tests]
```

**Service Container Configuration:**
```yaml
services:
  postgres:
    image: postgres:15-alpine
    options: >-
      --health-cmd pg_isready
      --health-interval 10s
      --health-timeout 5s
      --health-retries 5
```

---

## Security Scanning

### Security Tools Integration

**1. npm audit (Dependency Vulnerabilities)**
```yaml
- name: Run npm audit
  run: npm audit --audit-level=moderate
```

**2. Snyk (Advanced Vulnerability Detection)**
```yaml
- name: Run Snyk security scan
  uses: snyk/actions/node@master
  env:
    SNYK_TOKEN: ${{ secrets.SNYK_TOKEN }}
  with:
    args: --severity-threshold=high
```

**3. Trivy (Container & Filesystem Scanning)**
```yaml
- name: Run Trivy vulnerability scanner
  uses: aquasecurity/trivy-action@master
  with:
    scan-type: 'fs'
    format: 'sarif'
    output: 'trivy-results.sarif'
```

**4. CodeQL (Static Code Analysis)**
```yaml
- name: Initialize CodeQL
  uses: github/codeql-action/init@v3
  with:
    languages: javascript

- name: Perform CodeQL Analysis
  uses: github/codeql-action/analyze@v3
```

---

## Performance Benchmarking

### k6 Load Testing in CI

```yaml
performance-regression:
  name: Performance Regression Tests
  runs-on: ubuntu-latest

  steps:
    - name: Run k6 load tests
      run: k6 run --out json=results.json tests/performance/api-load.k6.ts

    - name: Download baseline results
      run: aws s3 cp s3://benchmark-results/baseline.json baseline.json

    - name: Compare with baseline
      run: |
        python scripts/compare-performance.py baseline.json results.json > comparison.md

    - name: Comment on PR
      if: github.event_name == 'pull_request'
      uses: actions/github-script@v7
      with:
        script: |
          const fs = require('fs');
          const comparison = fs.readFileSync('comparison.md', 'utf8');
          github.rest.issues.createComment({
            issue_number: context.issue.number,
            owner: context.repo.owner,
            repo: context.repo.repo,
            body: comparison
          });

    - name: Fail if regression detected
      run: |
        if grep -q "REGRESSION" comparison.md; then
          echo "::error::Performance regression detected!"
          exit 1
        fi
```

---

## Deployment Strategies

> **⚠️ REFERENCE DESIGN ONLY:** The deployment workflows described in this section are reference designs for future cloud deployment. This project is currently scoped for **local/CI environments only** per `docs/ARCHITECTURE_SCOPE.md`. The following workflows are NOT implemented:
> - deploy-dev.yml
> - deploy-staging.yml
> - deploy-production.yml
>
> For local development, use `docker-compose.yml`. For production simulation, use `docker-compose.prod.yml`.

### Deployment Workflow Design (Reference)

**Development Deployment (deploy-dev.yml) - NOT IMPLEMENTED:**
```yaml
name: Deploy to Development

on:
  push:
    branches: [develop]

jobs:
  deploy:
    runs-on: ubuntu-latest
    environment:
      name: development
      url: https://dev.birthday-app.example.com

    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Deploy to development
        run: |
          ssh deploy@dev-server "
            cd /opt/birthday-app &&
            git pull origin develop &&
            docker-compose -f docker-compose.yml -f docker-compose.dev.yml pull &&
            docker-compose -f docker-compose.yml -f docker-compose.dev.yml up -d &&
            docker-compose exec api npm run migrate
          "
        env:
          SSH_PRIVATE_KEY: ${{ secrets.DEV_SSH_KEY }}

      - name: Wait for health check
        run: |
          timeout 60 bash -c 'until curl -f https://dev.birthday-app.example.com/health; do sleep 2; done'

      - name: Smoke tests
        run: npm run test:smoke
        env:
          API_BASE_URL: https://dev.birthday-app.example.com
```

**Staging Deployment (deploy-staging.yml) - NOT IMPLEMENTED:**
```yaml
name: Deploy to Staging

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    environment:
      name: staging
      url: https://staging.birthday-app.example.com

    steps:
      - name: Deploy to staging
        run: |
          kubectl set image deployment/birthday-api api=ghcr.io/${{ github.repository }}:${{ github.sha }} -n staging
          kubectl rollout status deployment/birthday-api -n staging
```

**Production Deployment (deploy-production.yml) - NOT IMPLEMENTED:**
```yaml
name: Deploy to Production

on:
  release:
    types: [published]

jobs:
  deploy:
    runs-on: ubuntu-latest
    environment:
      name: production
      url: https://birthday-app.example.com

    steps:
      - name: Require manual approval
        uses: trstringer/manual-approval@v1
        with:
          approvers: team-leads
          minimum-approvals: 2

      - name: Blue-Green Deployment
        run: |
          # Deploy to green environment
          kubectl apply -f k8s/green/ -n production

          # Wait for green to be ready
          kubectl rollout status deployment/birthday-api-green -n production

          # Switch traffic to green
          kubectl patch service birthday-api -n production -p '{"spec":{"selector":{"version":"green"}}}'

          # Monitor for 5 minutes
          sleep 300

          # If healthy, destroy blue
          kubectl delete deployment birthday-api-blue -n production
```

---

## Environment Management

> **⚠️ REFERENCE DESIGN ONLY:** GitHub Environments described below are reference designs for future cloud deployment, not currently implemented.

### GitHub Environments Configuration (Reference)

```yaml
environments:
  development:
    url: https://dev.birthday-app.example.com
    protection_rules: []
    deployment_branch_policy:
      protected_branches: false
      custom_branch_policies: true
      allowed_branches: ["develop"]

  staging:
    url: https://staging.birthday-app.example.com
    protection_rules:
      - reviewers: ["team"]
      - wait_timer: 5
    deployment_branch_policy:
      protected_branches: true

  production:
    url: https://birthday-app.example.com
    protection_rules:
      - reviewers: ["team-leads", "platform-team"]
      - wait_timer: 30
      - prevent_self_review: true
    deployment_branch_policy:
      protected_branches: true
      allowed_tags: ["v*"]
```

### Environment Variables Management

**GitHub Secrets:**
- `POSTGRES_PASSWORD` - Database password
- `REDIS_PASSWORD` - Redis password
- `EMAIL_API_KEY` - External email service API key
- `SNYK_TOKEN` - Snyk security scanning token
- `CODECOV_TOKEN` - Code coverage reporting token
- `SSH_PRIVATE_KEY` - Deployment SSH key

**Environment-Specific Secrets:**
- `DEV_DATABASE_URL`
- `STAGING_DATABASE_URL`
- `PROD_DATABASE_URL`

---

## Artifact Management

### Build Artifact Strategy

```yaml
- name: Upload build artifacts
  uses: actions/upload-artifact@v4
  with:
    name: dist-${{ github.sha }}
    path: dist/
    retention-days: 30

- name: Download artifacts for deployment
  uses: actions/download-artifact@v4
  with:
    name: dist-${{ github.sha }}
    path: dist/
```

### Docker Image Tagging

```yaml
tags: |
  type=ref,event=branch                    # develop, main
  type=ref,event=pr                        # pr-123
  type=semver,pattern={{version}}          # 1.2.3
  type=semver,pattern={{major}}.{{minor}}  # 1.2
  type=sha,prefix={{branch}}-              # main-abc123
  type=raw,value=latest,enable={{is_default_branch}}
```

---

## Monitoring & Notifications

### Slack Notifications

```yaml
- name: Notify deployment success
  if: success()
  uses: slackapi/slack-github-action@v1
  with:
    payload: |
      {
        "text": "✅ Production deployment successful",
        "blocks": [
          {
            "type": "section",
            "text": {
              "type": "mrkdwn",
              "text": "*Production Deployment*\n✅ Deployment successful\n*Version:* ${{ github.ref_name }}\n*Commit:* ${{ github.sha }}\n*Author:* ${{ github.actor }}"
            }
          }
        ]
      }
  env:
    SLACK_WEBHOOK_URL: ${{ secrets.SLACK_WEBHOOK_URL }}

- name: Notify deployment failure
  if: failure()
  uses: slackapi/slack-github-action@v1
  with:
    payload: |
      {
        "text": "❌ Production deployment failed",
        "blocks": [
          {
            "type": "section",
            "text": {
              "type": "mrkdwn",
              "text": "*Production Deployment*\n❌ Deployment failed\n*Version:* ${{ github.ref_name }}\n*Workflow:* <${{ github.server_url }}/${{ github.repository }}/actions/runs/${{ github.run_id }}|View>"
            }
          }
        ]
      }
  env:
    SLACK_WEBHOOK_URL: ${{ secrets.SLACK_WEBHOOK_URL }}
```

---

## Rollback Mechanisms

### Automated Rollback on Failure

```yaml
rollback:
  name: Rollback on Failure
  runs-on: ubuntu-latest
  needs: [deploy]
  if: failure()

  steps:
    - name: Get previous successful deployment
      id: previous
      run: |
        PREV_SHA=$(git rev-parse HEAD~1)
        echo "sha=$PREV_SHA" >> $GITHUB_OUTPUT

    - name: Rollback to previous version
      run: |
        kubectl set image deployment/birthday-api \
          api=ghcr.io/${{ github.repository }}:${{ steps.previous.outputs.sha }} \
          -n production

        kubectl rollout status deployment/birthday-api -n production

    - name: Notify rollback
      uses: slackapi/slack-github-action@v1
      with:
        payload: |
          {
            "text": "⚠️ Automatic rollback executed",
            "blocks": [
              {
                "type": "section",
                "text": {
                  "type": "mrkdwn",
                  "text": "*Rollback Executed*\n⚠️ Deployment failed, rolled back to previous version\n*Previous SHA:* ${{ steps.previous.outputs.sha }}"
                }
              }
            ]
          }
      env:
        SLACK_WEBHOOK_URL: ${{ secrets.SLACK_WEBHOOK_URL }}
```

---

## Pipeline Optimization Checklist

### Performance Optimizations

- [x] **Parallel test execution** (5 shards for unit tests)
- [x] **Dependency caching** (npm cache, Docker layer cache)
- [x] **Service container health checks** (wait for ready state)
- [x] **Artifact upload/download** (share between jobs)
- [x] **Matrix builds** (parallel builds for different platforms)

### Cost Optimizations

- [x] **Conditional job execution** (performance tests on PR only)
- [x] **Artifact retention policies** (1-30 days based on type)
- [x] **Resource limits** (timeout-minutes on all jobs)
- [x] **Cleanup old artifacts** (scheduled workflow)

### Security Best Practices

- [x] **Secrets management** (GitHub Secrets, environment-specific)
- [x] **Non-root container execution** (user nodejs:nodejs)
- [x] **Security scanning** (npm audit, Snyk, Trivy, CodeQL)
- [x] **Dependency updates** (Dependabot)
- [x] **Branch protection** (require status checks, reviews)

---

## Conclusion

This CI/CD pipeline architecture provides:

1. **Fast Feedback:** < 10 minute total pipeline time
2. **Comprehensive Testing:** Unit, integration, E2E, performance
3. **Security:** Multi-layer vulnerability scanning
4. **Reliability:** Automated rollbacks, health checks
5. **Scalability:** Parallel execution, multi-platform builds
6. **Observability:** Test reports, coverage, notifications

**Next Steps:**
1. Implement GitHub Actions workflows
2. Configure environment secrets
3. Set up deployment infrastructure
4. Establish monitoring dashboards
5. Document runbook procedures

---

**Document Status:** Ready for Implementation
**Author:** Coder/Architect Agent (Hive Mind Collective)
**Version:** 1.0
**Date:** December 30, 2025
