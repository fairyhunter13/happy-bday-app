# CI/CD Workflow Structure Documentation

**Generated**: January 2, 2026
**Documenter**: Queen Collective - SPARC Documenter Agent

---

## Overview

This document provides a comprehensive analysis of the Happy Birthday App's CI/CD pipeline, including workflow architecture, dependencies, triggers, and performance characteristics.

---

## 1. Workflow Files Summary

### 1.1 Quick Reference Table

| Workflow | Location | Purpose | Triggers | Timeout | Blocking |
|----------|----------|---------|----------|---------|----------|
| CI | `.github/workflows/ci.yml` | Main test pipeline (unit, integration, E2E, mutation, performance) | PR, Push (main/develop) | 10 min per job | Yes (core jobs) |
| Performance Tests | `.github/workflows/performance.yml` | Long-running load tests (sustained, peak, worker scaling) | Schedule (weekly Sun 2am UTC), Manual | 25h / 30m / 45m | No (informational) |
| Security Scanning | `.github/workflows/security.yml` | Dependency audit, vulnerability scanning, license compliance | PR, Push (main), Schedule (daily), Manual | 10-20 min per job | No (informational) |
| Documentation | `.github/workflows/docs.yml` | Build and deploy API docs to GitHub Pages | Push (main), Manual | Varies | No |
| Code Quality | `.github/workflows/code-quality.yml` | ESLint, TypeScript, complexity, duplication checks | PR, Push (main), Manual | 10 min per job | Yes (eslint, typescript) |
| Docker Build | `.github/workflows/docker-build.yml` | Build and push Docker images with security scanning | Push (main, tags), PR, Manual | 30 min | No |
| SonarCloud | `.github/workflows/sonar.yml` | Code coverage and quality analysis via SonarCloud | Push (main), PR (opened/sync/reopened) | 15 min | No (optional token) |
| OpenAPI Validation | `.github/workflows/openapi-validation.yml` | Validate OpenAPI 3.1.0 specification | Push/PR (main/develop), Path-based | 60 sec (validation) | No |
| Cleanup | `.github/workflows/cleanup.yml` | Clean old artifacts, images, and caches | Schedule (weekly Sun 00:00 UTC), Manual | 10-15 min | No |

---

## 2. CI Pipeline Details (ci.yml)

The main CI pipeline is the most critical workflow, running comprehensive tests on all pull requests and pushes to main/develop branches.

### 2.1 Job Dependency Graph

```
lint-and-type-check (10 min)
    ↓
unit-tests (10 min, ~80% coverage)
    ├──→ integration-tests (10 min, 3 services)
    ├──→ e2e-tests (10 min, 2 shards parallel)
    ├──→ chaos-tests (10 min, failure scenarios)
    ├──→ performance-smoke-test (10 min, k6 smoke)
    ├──→ mutation-testing (30 min, incremental)
    ├──→ performance-load-tests (10 min, api-load)
    ├──→ coverage-report (merge & upload coverage)
    ├──→ security-scan (npm audit, optional Snyk)
    └──→ build (npm run build)
        ↓
    all-checks-passed (gate job, checks all requirements)
```

### 2.2 Job Descriptions

#### lint-and-type-check (10 min) - REQUIRED
- **Dependencies**: None
- **Purpose**: Syntax and type safety validation
- **Steps**:
  - ESLint analysis (`npm run lint`)
  - TypeScript type check (`npm run typecheck`)
  - Code formatting check (`npm run format:check`)
- **Blocks**: All downstream jobs
- **Failure Action**: Blocks PR merge

#### unit-tests (10 min) - REQUIRED
- **Dependencies**: lint-and-type-check
- **Purpose**: Unit test execution with coverage
- **Configuration**:
  - Config: `vitest.config.unit-ci.ts`
  - Coverage thresholds: Lines 80%, Statements 80%, Branches 75%, Functions 50%
  - Coverage only collected from unit tests (not integration/E2E)
- **Encryption**: Uses SOPS with SOPS_AGE_KEY secret
- **Output**: `coverage/` artifact (7 day retention)
- **Failure Action**: Blocks all dependent jobs

#### integration-tests (10 min) - REQUIRED
- **Dependencies**: unit-tests
- **Purpose**: Service integration testing (DB, RabbitMQ, Redis)
- **Services**:
  - PostgreSQL 15 Alpine (port 5432)
  - RabbitMQ 3.12 (ports 5672, 15672)
  - Redis 7 (port 6379)
- **Configuration**:
  - Optimized run (no coverage collection)
  - Database migrations pre-test
  - TESTCONTAINERS_RYUK_DISABLED=true (CI compatibility)
- **Failure Action**: Blocks PR merge

#### e2e-tests (10 min) - REQUIRED
- **Dependencies**: unit-tests
- **Purpose**: End-to-end workflow testing
- **Sharding**: 2 parallel shards (fail-fast disabled)
  - Shard 1 of 2
  - Shard 2 of 2
- **Services**: Same as integration tests (PostgreSQL, RabbitMQ, Redis)
- **Configuration**: API_URL=http://localhost:3000
- **Failure Action**: Blocks PR merge

#### chaos-tests (10 min) - OPTIONAL
- **Dependencies**: unit-tests
- **Purpose**: Failure scenario and resilience testing
- **Services**: PostgreSQL, RabbitMQ (not Redis)
- **Scope**: Tests database and message queue failure handling
- **Failure Action**: Warning only (doesn't block)

#### performance-smoke-test (10 min) - OPTIONAL
- **Dependencies**: unit-tests
- **Purpose**: Quick performance baseline using k6
- **Test Type**: Smoke test (basic endpoints)
- **Test File**: `tests/performance/api-smoke.test.js`
- **Infrastructure**:
  - Starts docker-compose.test.yml
  - Builds app and runs with test database
  - Waits for API health check
  - Runs k6 performance tests
- **Rate Limits (elevated for testing)**:
  - CREATE_USER_MAX: 10000
  - READ_USER_MAX: 10000
  - UPDATE_USER_MAX: 10000
  - DELETE_USER_MAX: 10000
- **Artifact**: `performance-smoke-results/` (7 day retention)
- **Failure Action**: Warning only

#### mutation-testing (30 min) - OPTIONAL
- **Dependencies**: unit-tests
- **Purpose**: Test quality evaluation via mutation testing
- **Tool**: Stryker (incremental mode)
- **Thresholds**:
  - High: >= 80% (white_check_mark)
  - Low: >= 60% (warning)
  - Break: < 50% (error, but doesn't fail CI)
- **Output Metrics**:
  - Killed (detected mutations)
  - Survived (undetected mutations - test gaps)
  - Timeout (infinite loop detection)
  - No Coverage (untested code)
- **PR Comment**: Posts mutation score with breakdown
- **Failure Action**: Warning only (check thresholds for improvement guidance)

#### performance-load-tests (10 min) - OPTIONAL
- **Dependencies**: unit-tests
- **Purpose**: Load testing with k6
- **Matrix Tests**: [api-load]
  - scheduler-load, worker-throughput, e2e-load disabled (require internal endpoints)
- **Infrastructure**: Similar to smoke test (docker-compose, full app)
- **Output**: JSON results with k6 metrics
- **Artifact**: `performance-load-results-{test}/` (30 day retention)
- **Failure Action**: Warning only

#### coverage-report (varies) - REQUIRED for merge
- **Dependencies**: unit-tests
- **Purpose**: Coverage analysis and threshold enforcement
- **Process**:
  1. Download coverage-unit artifact
  2. Merge V8 coverage from all test types
  3. Enforce thresholds: Lines 80%, Statements 80%, Branches 75%, Functions 50%
  4. Upload to Codecov (if CODECOV_TOKEN configured)
  5. Generate diff report vs base branch (on PR)
  6. Post coverage comment on PR
- **Base Comparison**: Downloads coverage from last successful main branch run
- **Coverage Diff**: Shows impact of PR on coverage metrics
- **Failure Action**: Blocks PR merge if thresholds not met

#### security-scan (10 min) - REQUIRED
- **Dependencies**: None (runs in parallel)
- **Purpose**: Dependency security audit
- **Tools**:
  - npm audit (critical level, production and dev)
  - Snyk (optional, requires SNYK_TOKEN)
- **Output**: Audit reports (artifacts)
- **Failure Action**: npm audit critical failures block merge; Snyk is informational

#### build (10 min) - REQUIRED
- **Dependencies**: None (runs in parallel)
- **Purpose**: Production TypeScript build
- **Command**: `npm run build`
- **Output**: `dist/` artifact (7 day retention)
- **Failure Action**: Blocks PR merge

#### all-checks-passed - REQUIRED GATE
- **Dependencies**: ALL jobs (lint, unit, integration, e2e, chaos, mutation, smoke, load, coverage, security, build)
- **Purpose**: Final check that all required jobs passed
- **Required Jobs** (block if failed):
  - lint-and-type-check
  - unit-tests
  - integration-tests
  - e2e-tests
  - build
- **Optional Jobs** (warn if failed):
  - chaos-tests
  - mutation-testing
  - performance-smoke-test
  - performance-load-tests
  - coverage-report
- **Failure Action**: Blocks PR merge if any required job failed

### 2.3 Concurrency Policy

```yaml
group: ${{ github.workflow }}-${{ github.ref }}
cancel-in-progress: true
```

- Workflow runs are grouped by branch/ref
- New pushes to same ref cancel previous in-progress run
- Prevents resource waste and provides fast feedback

### 2.4 Secrets & Environment Variables

#### Required Secrets
- `SOPS_AGE_KEY`: Decrypts encrypted test environment files (`.env.test.enc`)
- `CODECOV_TOKEN`: (Optional) Upload coverage to Codecov

#### Environment Variables (Set per job)
- `DATABASE_URL`: `postgres://test:test@localhost:5432/test_db`
- `RABBITMQ_URL`: `amqp://test:test@localhost:5672`
- `REDIS_URL`: `redis://localhost:6379`
- `CI`: `true`
- `ENABLE_DB_METRICS`: `false` (for speed)
- `TESTCONTAINERS_RYUK_DISABLED`: `true` (CI compatibility)

---

## 3. Performance Testing Pipeline (performance.yml)

Separate long-running performance tests executed on schedule (weekly Sundays 2am UTC) or manually.

### 3.1 Schedule

```
On: Sundays at 2:00 AM UTC (weekly)
Manual: Via workflow_dispatch with test type selection
```

### 3.2 Jobs

#### performance-sustained (1500 min = 25 hours)
- **Trigger**: schedule, or input `test_type: sustained|all`
- **Purpose**: 24-hour sustained load test (1M messages/day)
- **Infrastructure**: docker-compose.perf.yml with performance environment
- **Test File**: `tests/performance/sustained-load.js`
- **Baseline Comparison**: Downloads previous baseline, checks <20% degradation
- **Output**:
  - Results artifact (30 day retention)
  - Baseline updated if on main branch and successful
- **Database**: Performance database with pre-seeded data

#### performance-peak (30 min)
- **Trigger**: schedule, or input `test_type: peak|all`
- **Purpose**: Peak load test (100+ messages/sec)
- **Test File**: `tests/performance/peak-load.js`
- **Output**: Results artifact (30 day retention)

#### performance-worker-scaling (45 min)
- **Trigger**: schedule, or input `test_type: worker-scaling|all`
- **Purpose**: Test performance with different worker counts
- **Matrix**: Workers: [1, 5, 10]
- **Test File**: `tests/performance/worker-scaling.js`
- **Docker Compose Scale**: `--scale worker={matrix.workers}`
- **Output**: Per-worker results (30 day retention)

#### performance-report (varies)
- **Dependencies**: All three performance jobs
- **Purpose**: Consolidate results and generate report
- **Steps**:
  1. Download all performance artifacts
  2. Generate consolidated report
  3. Generate performance badges (RPS, latency, throughput, error-rate)
  4. Upload badges and final report (90 day retention)
  5. Post comment on commit (if scheduled run)
- **Badge Files**:
  - performance-badge.json
  - rps-badge.json
  - latency-badge.json
  - throughput-badge.json
  - error-rate-badge.json
  - performance-metrics.json

---

## 4. Security Scanning Pipeline (security.yml)

Comprehensive security scanning with multiple tools and compliance checks.

### 4.1 Triggers

- **Pull Requests**: All PRs
- **Push**: Main branch only
- **Schedule**: Daily at midnight UTC
- **Manual**: Via workflow_dispatch

### 4.2 Jobs

#### npm-audit (10 min)
- **Purpose**: Dependency vulnerability scanning
- **Checks**:
  - Production dependencies (critical level)
  - All dependencies (critical level)
- **Output**: JSON and text reports (30 day retention)
- **Failure**: Critical vulnerabilities block

#### snyk-scan (15 min)
- **Purpose**: Snyk vulnerability scanning
- **Requirements**: SNYK_TOKEN (optional)
- **Checks**:
  - NPM package vulnerabilities
  - Docker image vulnerabilities (if on main branch)
  - Severity threshold: high
- **Output**: SARIF for GitHub Code Scanning
- **Graceful Degradation**: Skipped if SNYK_TOKEN not configured

#### owasp-dependency-check (20 min)
- **Purpose**: OWASP Dependency Check for known vulnerabilities
- **Configuration**:
  - enableRetired: true
  - enableExperimental: true
  - failOnCVSS: 7 (critical/high)
  - Suppression file: dependency-check-suppressions.xml
- **Output**:
  - HTML, JSON, CSV reports
  - SARIF for GitHub Security
  - All formats (30 day retention)

#### trivy-scan (15 min)
- **Purpose**: Container and filesystem vulnerability scanning
- **Two scans**:
  1. **Docker Image Scan** (if Dockerfile exists):
     - Builds image for testing
     - Scans with Trivy (CRITICAL,HIGH)
  2. **Filesystem Scan**:
     - Scans repository files
     - Detects supply chain risks
- **Output**: SARIF reports for GitHub Security
- **Severity**: CRITICAL, HIGH only

#### license-compliance (10 min)
- **Purpose**: Verify no restricted licenses in dependencies
- **Tool**: license-checker
- **Restricted Licenses**: GPL, AGPL, LGPL, SSPL, Commons Clause
- **Output**: licenses.json (30 day retention)
- **Failure Action**: Blocks if restricted licenses found

#### codeql-analysis (15 min)
- **Purpose**: CodeQL static analysis (GitHub's SIEM scanner)
- **Language**: JavaScript
- **Queries**: security-and-quality
- **Autobuild**: Enabled
- **Output**: SARIF for GitHub Security

#### security-summary (informational)
- **Dependencies**: All security jobs
- **Purpose**: Aggregate results and report status
- **Failure Action**: Only fails if license-compliance fails
- **PR Comment**: Posts security scan results table

---

## 5. Code Quality Pipeline (code-quality.yml)

Enforces code quality standards across linting, types, complexity, and duplication.

### 5.1 Triggers

- Pull Requests
- Push (main branch)
- Manual

### 5.2 Jobs

#### eslint (10 min)
- **Purpose**: JavaScript/TypeScript linting
- **Output Format**: JSON report
- **Annotation**: Adds inline annotations to PR
- **Quality Gate**:
  - Errors: 0 (blocking)
  - Warnings: ≤ 50 max
- **Output**: eslint-report.json (30 day retention)
- **Failure Action**: Blocks if errors > 0

#### typescript-strict (10 min)
- **Purpose**: Verify TypeScript strict mode and type safety
- **Checks**:
  - tsconfig.json has `"strict": true`
  - No TypeScript compilation errors
  - Run `npm run typecheck`
- **Output**: tsc-output.txt
- **Failure Action**: Blocks if errors found

#### complexity-analysis (10 min)
- **Purpose**: Detect overly complex functions
- **Tool**: complexity-report
- **Threshold**: Functions with complexity > 10 = warning
- **Limit**: ≤ 5 high-complexity functions
- **Output**: complexity-reports/ (30 day retention)
- **Failure Action**: Warning only

#### code-duplication (10 min)
- **Purpose**: Detect code duplication
- **Tool**: jscpd (JavaScript Copy Paste Detector)
- **Threshold**: ≤ 7% duplication max
- **Output**:
  - HTML report
  - JSON report (30 day retention)
- **Metrics**: Duplication %, clone count, duplicated lines
- **Failure Action**: Blocks if > 7%

#### pr-quality-report (varies)
- **Dependencies**: All quality jobs
- **Trigger**: PR only
- **Purpose**: Generate consolidated quality report for PR comment
- **Comment**: Posts summary table with all metrics
- **Updates**: Replaces previous quality comment if exists

#### quality-summary (informational)
- **Dependencies**: All quality jobs
- **Purpose**: Final quality gate check
- **Required**: eslint, typescript-strict
- **Optional**: complexity, duplication
- **Failure Action**: Blocks if required jobs fail

---

## 6. Documentation Pipeline (docs.yml)

Builds and deploys API documentation to GitHub Pages.

### 6.1 Triggers

- Push to main (with path filters: src/**, docs/**, public/**, scripts/coverage/**, .github/workflows/docs.yml)
- Manual

### 6.2 Jobs

#### build (varies)
- **Purpose**: Generate and prepare documentation site
- **Steps**:
  1. Generate OpenAPI client
  2. Build TypeScript
  3. Run tests with coverage (optional)
  4. Update coverage history
  5. Generate OpenAPI spec
  6. Create documentation site structure
  7. Create index.html with Redoc viewer
  8. Copy all documentation assets
  9. Copy Grafana dashboards and alerts
  10. Commit coverage updates
- **Assets Copied**:
  - coverage-trends.html
  - test-reports.html
  - dashboards-index.html
  - security-summary.html
  - reports-summary.html
  - OpenAPI spec
  - Coverage history/badge
  - Security badge
  - Performance badges
- **404 Page**: Custom gradient 404 page
- **Output**: `_site/` directory (GitHub Pages artifact)

#### deploy (varies)
- **Dependencies**: build
- **Purpose**: Deploy to GitHub Pages
- **Environment**: github-pages
- **Action**: deploy-pages@v4

---

## 7. Docker Build Pipeline (docker-build.yml)

Builds and pushes Docker images with security scanning.

### 7.1 Triggers

- Push to main or version tags (v*.*.*)
- Pull Requests (build only, no push)
- Manual

### 7.2 Jobs

#### build-and-push (30 min)
- **Purpose**: Build and optionally push Docker image
- **Registry**: GitHub Container Registry (ghcr.io)
- **Build Types**:
  - PR: Build only (no push)
  - Main/Tags: Build and push
- **Multi-platform**: Buildx support (amd64 only for now)
- **Build Arguments**:
  - NODE_ENV: production
  - BUILD_DATE: commit timestamp
  - VCS_REF: git SHA
  - VERSION: semantic version from tag
- **Tags** (on push/tag):
  - Branch reference (e.g., main)
  - PR reference (e.g., pr-123)
  - Semantic version (v1.2.3, 1.2, 1)
  - SHA prefix (main-abc123def)
  - latest (for default branch)
- **Cache**: GitHub Actions cache (gha)
- **Security Scanning**:
  - Trivy container scan
  - SARIF output
- **Structure Tests**: Container-structure-test validates:
  - Node version (v22.*)
  - npm version present
  - /app/dist exists
  - /app/dist/src/index.js exists
  - /app/node_modules exists
  - /app/package.json exists
  - Port 3000 exposed
  - Working directory: /app
  - User: appuser
- **SBOM Generation**: Anchore SBOM action
  - Format: SPDX JSON
  - Retention: 90 days
- **SBOM Scanning**: Grype vulnerability scanner
  - fail-build: false (informational)
  - Severity: high
- **PR Comment**: Posts build results with image tags

#### image-scan-summary (informational)
- **Dependencies**: build-and-push
- **Trigger**: Main branch/tags only
- **Purpose**: Generate security summary
- **Output**: Step summary with SBOM and scan status
- **Notification**: Posts commit comment on failure

---

## 8. SonarCloud Pipeline (sonar.yml)

Code quality and coverage analysis via SonarCloud.

### 8.1 Triggers

- Push to main
- Pull Requests (opened, synchronize, reopened)

### 8.2 Configuration

**Important**: SonarCloud automatic analysis must be disabled in project settings.

### 8.3 Jobs

#### sonarcloud (15 min)
- **Purpose**: Run SonarCloud analysis
- **Optional**: SONAR_TOKEN (graceful degradation if missing)
- **Process**:
  1. Fetch full git history (fetch-depth: 0)
  2. Run unit tests with coverage
  3. Execute SonarCloud scan
- **Token**: From secrets.SONAR_TOKEN
- **Status**: Informational only (no blocking)

---

## 9. OpenAPI Validation Pipeline (openapi-validation.yml)

Validates API specification and generates documentation.

### 9.1 Triggers

- Path-based: src/schemas/**, src/routes/**, src/app.ts, .spectral.yml
- Branches: main, develop
- Events: Push, Pull Request

### 9.2 Jobs

#### validate-openapi (60 sec validation)
- **Services**: PostgreSQL 16, RabbitMQ 3
- **Purpose**: Validate OpenAPI 3.1.0 specification
- **Process**:
  1. Build application
  2. Start application in background
  3. Wait for health check
  4. Validate with Redocly
  5. Lint with Spectral
  6. Export specification to docs/openapi.json
  7. Validate exported JSON
  8. Verify OpenAPI version 3.1.0
- **Linting Rules**:
  - Redocly: Skips operation-operationId-unique
  - Spectral: Fail severity warn
- **Output**: openapi.json artifact (30 day retention)
- **PR Artifact**: api-preview.html with Redocly build-docs
- **PR Comment**: Validation results with artifact links

#### security-scan (for OpenAPI)
- **Dependencies**: validate-openapi
- **Purpose**: OWASP ZAP API security scan
- **Tool**: ZAP API Scan (zaproxy/zap-stable)
- **Input**: Exported openapi.json
- **Format**: openapi
- **Output**:
  - zap-report.html (30 day retention)
  - zap-report.md (30 day retention)

---

## 10. Cleanup Pipeline (cleanup.yml)

Removes old artifacts, images, and caches periodically.

### 10.1 Triggers

- Schedule: Sundays at 00:00 UTC (weekly)
- Manual: Via workflow_dispatch with days_to_keep parameter

### 10.2 Jobs

#### cleanup-artifacts
- **Purpose**: Delete old workflow artifacts
- **Retention Policy**:
  - Default: 30 days
  - Keep successful main/develop runs: Always
  - Delete other runs older than cutoff
- **Logic**:
  1. List all workflow runs
  2. Filter by age and branch
  3. Delete artifacts from old/failed runs

#### cleanup-docker-images
- **Purpose**: Delete untagged Docker images
- **Retention Policy**:
  - Keep tagged images: Always
  - Delete untagged images older than cutoff (default 30 days)
- **Logic**:
  1. List all package versions
  2. Skip tagged images
  3. Delete old untagged versions
- **Graceful Degradation**: Handles both org and user-owned packages

#### cleanup-cache
- **Purpose**: Delete unused GitHub Actions caches
- **Retention Policy**:
  - Delete caches not accessed in 30 days (default)
  - Check last_accessed_at timestamp
- **Logic**:
  1. List all action caches
  2. Check access date
  3. Delete old caches

#### summary
- **Dependencies**: All cleanup jobs
- **Purpose**: Generate summary report
- **Output**: GitHub step summary with results

---

## 11. Workflow Execution Timeline & Performance

### 11.1 Typical PR Execution (Fast Path)

```
Start
  ├─ lint-and-type-check: 2-3 min
  │  └─ unit-tests: 5-8 min (parallel starting after lint)
  │     ├─ integration-tests: 6-8 min (parallel)
  │     ├─ e2e-tests (2 shards): 5-7 min (parallel)
  │     ├─ chaos-tests: 4-6 min (parallel)
  │     ├─ performance-smoke-test: 7-9 min (parallel)
  │     ├─ mutation-testing: 20-30 min (parallel)
  │     ├─ performance-load-tests: 6-8 min (parallel)
  │     ├─ coverage-report: 2-3 min (parallel)
  │     ├─ security-scan: 2-3 min (parallel)
  │     └─ build: 3-4 min (parallel)
  │         └─ all-checks-passed: < 1 min (gate)
Total: ~10-12 min (with all optimizations)
```

### 11.2 Metrics

| Phase | Duration | Status |
|-------|----------|--------|
| Lint & Type Check | 2-3 min | BLOCKING |
| Unit Tests | 5-8 min | BLOCKING |
| Integration Tests | 6-8 min | BLOCKING |
| E2E Tests (2 shards) | 5-7 min | BLOCKING |
| Chaos Tests | 4-6 min | OPTIONAL |
| Performance Smoke | 7-9 min | OPTIONAL |
| Mutation Testing | 20-30 min | OPTIONAL |
| Performance Load | 6-8 min | OPTIONAL |
| Coverage Report | 2-3 min | BLOCKING |
| Security Scan | 2-3 min | BLOCKING |
| Build | 3-4 min | BLOCKING |
| **Total Parallel** | ~10-12 min | - |
| **Critical Path** | lint + unit + coverage/security/build + gate | - |

### 11.3 Performance Optimizations

1. **Parallel Job Execution**: All test jobs run in parallel after unit-tests
2. **E2E Sharding**: Tests split into 2 shards for faster execution
3. **Coverage Only in Unit Tests**: Integration/E2E run without coverage collection
4. **Incremental Coverage**: Codecov tracks changes, not re-running full analysis
5. **Incremental Mutation Testing**: Only tests changed code
6. **GitHub Actions Cache**: Node modules cached between runs
7. **Docker Layer Caching**: Build cache reused across runs (gha)
8. **Concurrency Control**: Cancels in-progress runs on new push

---

## 12. Dependency Analysis

### 12.1 Critical Path (Blocks Merge)

```
lint-and-type-check ──┐
                       ├─→ unit-tests ──┬─→ integration-tests ─┐
                       │                │                      ├─→ all-checks-passed
                       │                ├─→ e2e-tests ─────────┤
                       │                │                      ├─→ [MERGE ALLOWED]
                       │                └─→ security-scan ─────┤
                       │                                        ├─→ coverage-report
                       └─→ build ──────────────────────────────┤
                                                                └─→ all-checks-passed
```

### 12.2 Informational Path (Non-Blocking)

```
unit-tests ──┬─→ chaos-tests ─────┐
             ├─→ mutation-testing ├─→ (warning only)
             ├─→ perf-smoke ──────┤
             └─→ perf-load ───────┘
```

### 12.3 Cross-Workflow Dependencies

- **CI → Docs**: No dependency; docs.yml runs independently
- **CI → Performance**: No dependency; performance.yml scheduled separately
- **CI → Docker**: No dependency; docker-build.yml runs independently
- **Performance → Docs**: No dependency; performance badges generated separately
- **All → Cleanup**: No dependency; cleanup.yml runs on schedule

---

## 13. Secrets & Permissions

### 13.1 Required Secrets

| Secret | Workflow | Purpose | Status |
|--------|----------|---------|--------|
| SOPS_AGE_KEY | ci.yml | Decrypt .env.test.enc | REQUIRED |
| CODECOV_TOKEN | ci.yml, docs.yml | Upload coverage reports | OPTIONAL (graceful degradation) |
| SONAR_TOKEN | sonar.yml | SonarCloud analysis | OPTIONAL (graceful degradation) |
| SNYK_TOKEN | security.yml, ci.yml | Snyk vulnerability scanning | OPTIONAL (graceful degradation) |

### 13.2 GitHub Tokens

- `secrets.GITHUB_TOKEN`: Automatically provided
  - Used for: PR comments, artifact downloads, package access
  - Scope: Read repository, write comments and packages

### 13.3 Permissions by Workflow

| Workflow | Permissions | Scope |
|----------|-------------|-------|
| ci.yml | Default | Read source |
| performance.yml | actions:write | Manage artifacts |
| security.yml | contents:read, security-events:write | Code scanning upload |
| docker-build.yml | contents:read, packages:write, security-events:write | Push images, SARIF |
| code-quality.yml | contents:read, pull-requests:write | Annotations, comments |
| docs.yml | contents:write, pages:write, id-token:write | Deploy GitHub Pages |
| sonar.yml | Default | Read source |
| cleanup.yml | actions:write, packages:write, contents:read | Delete artifacts/images |

---

## 14. Status Check Requirements for PR Merge

### 14.1 Required Checks

These jobs **MUST** pass for PR merge:

1. ✅ **CI / lint-and-type-check**: No lint errors, TypeScript types valid
2. ✅ **CI / unit-tests**: All unit tests passing, coverage thresholds met
3. ✅ **CI / integration-tests**: Integration tests passing with services
4. ✅ **CI / e2e-tests**: All E2E tests passing (both shards)
5. ✅ **CI / security-scan**: npm audit critical vulnerabilities clear
6. ✅ **CI / build**: Production build succeeds
7. ✅ **CI / all-checks-passed**: Meta-check that all required jobs passed
8. ✅ **Code Quality / eslint**: No ESLint errors
9. ✅ **Code Quality / typescript-strict**: Strict mode enabled
10. ✅ **Code Quality / quality-summary**: Required gates pass
11. ✅ **Coverage Report**: Meets minimum thresholds (80%/80%/75%/50%)

### 14.2 Recommended Checks

These are **informational** but recommended for code quality:

- **CI / chaos-tests**: Resilience testing passes
- **CI / mutation-testing**: Mutation score >= 80%
- **CI / performance-smoke-test**: Performance baseline acceptable
- **CI / performance-load-tests**: Load test completes
- **Code Quality / complexity-analysis**: No high complexity warnings
- **Code Quality / code-duplication**: Duplication under 7%
- **Security / snyk-scan**: No high-severity vulnerabilities (if configured)
- **SonarCloud / sonarcloud**: Quality gates pass (if configured)

---

## 15. Environment Variables Summary

### 15.1 Test Environment

```yaml
CI: 'true'
NODE_ENV: 'test'
DATABASE_URL: postgres://test:test@localhost:5432/test_db
RABBITMQ_URL: amqp://test:test@localhost:5672
REDIS_URL: redis://localhost:6379
ENABLE_DB_METRICS: 'false'
TESTCONTAINERS_RYUK_DISABLED: 'true'
RATE_LIMIT_*_MAX: 10000  # Elevated for performance testing
```

### 15.2 Performance Environment

```yaml
DATABASE_URL: postgres://perf:perf@localhost:5432/perf_db
API_URL: http://localhost
WORKERS: [1, 5, 10]  # Matrix for scaling tests
NODE_ENV: 'test'
```

### 15.3 Build Environment

```yaml
NODE_ENV: production
BUILD_DATE: ${commit.timestamp}
VCS_REF: ${commit.sha}
VERSION: ${semantic.version}
```

---

## 16. Trigger Conditions Matrix

| Trigger | CI | Performance | Security | Docs | Code Quality | Docker | SonarCloud | OpenAPI | Cleanup |
|---------|----|-----------|----|------|------|---------|---------|---------|----------|
| PR | ✅ | - | ✅ | - | ✅ | ✅ | ✅ | ✅ | - |
| Push main | ✅ | - | ✅ | ✅ | ✅ | ✅ | ✅ | - | - |
| Push develop | ✅ | - | - | - | - | - | - | ✅ | - |
| Push tag v*.*.* | - | - | - | - | - | ✅ | - | - | - |
| Schedule (weekly) | - | ✅ | - | - | - | - | - | - | ✅ |
| Schedule (daily) | - | - | ✅ | - | - | - | - | - | - |
| Manual | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | - | ✅ | ✅ |

---

## 17. Key Configuration Files

| File | Purpose |
|------|---------|
| `.github/workflows/ci.yml` | Main CI pipeline |
| `.github/workflows/performance.yml` | Long-running performance tests |
| `.github/workflows/security.yml` | Security scanning suite |
| `.github/workflows/code-quality.yml` | Code quality gates |
| `.github/workflows/docs.yml` | Documentation deployment |
| `.github/workflows/docker-build.yml` | Docker image build/push |
| `.github/workflows/sonar.yml` | SonarCloud integration |
| `.github/workflows/openapi-validation.yml` | API spec validation |
| `.github/workflows/cleanup.yml` | Artifact/image cleanup |
| `vitest.config.unit-ci.ts` | Unit test configuration for CI |
| `vitest.config.base.ts` | Base vitest configuration |
| `tsconfig.json` | TypeScript configuration (strict mode) |
| `.eslintrc.json` | ESLint configuration |
| `sonar-project.properties` | SonarCloud configuration |
| `.spectral.yml` | Spectral OpenAPI linting rules |
| `dependency-check-suppressions.xml` | OWASP suppression file |

---

## 18. Failure Scenarios & Recovery

### 18.1 Common Failure Points

| Failure | Impact | Recovery |
|---------|--------|----------|
| Unit test fails | Blocks all downstream | Fix failing test and push |
| Integration test fails | Blocks PR merge | Check service health, fix test or code |
| E2E test fails (shard 1 or 2) | Blocks PR merge | Run affected shard locally to reproduce |
| Coverage drops below threshold | Blocks PR merge | Add tests or suppress with reason |
| ESLint errors | Blocks code quality | Run `npm run lint -- --fix` to auto-fix |
| TypeScript errors | Blocks PR merge | Fix type errors in code |
| npm audit critical | Blocks security scan | Update packages with `npm audit fix` |
| Snyk high-severity | Informational only | Review and address or suppress |
| Docker build fails | Informational on PR | Check Dockerfile or build context |
| Performance degrades >20% | Informational | Review sustained load results |

### 18.2 Recovery Steps

1. **Read workflow logs**: Click on failed job in GitHub UI
2. **Reproduce locally**: Run same test command locally
3. **Check logs**: Look at step outputs and error messages
4. **Fix issue**: Modify code or configuration
5. **Push fix**: Commit and push to trigger new CI run
6. **Monitor**: Watch workflow run to completion

---

## 19. Artifact Retention Policy

| Artifact | Retention | Cleanup | Purpose |
|----------|-----------|---------|---------|
| coverage-unit | 7 days | Manual cleanup | Coverage reports |
| performance-smoke-results | 7 days | Manual cleanup | Quick perf baseline |
| performance-load-results | 30 days | Manual cleanup | Load test results |
| sustained-load-results | 30 days | Manual cleanup | 24h perf results |
| eslint-report | 30 days | Manual cleanup | Linting results |
| complexity-report | 30 days | Manual cleanup | Complexity metrics |
| duplication-report-html | 30 days | Manual cleanup | Duplication visualization |
| npm-audit-report | 30 days | Manual cleanup | Security audit |
| sbom | 90 days | Manual cleanup | Software Bill of Materials |
| performance-baseline | 90 days | Manual cleanup | Baseline for comparison |
| performance-report-final | 90 days | Manual cleanup | Final consolidated report |
| performance-badges | 90 days | Manual cleanup | Badge JSON files |
| dist | 7 days | Manual cleanup | Build artifacts |

---

## 20. Best Practices & Recommendations

### 20.1 For Developers

1. **Run lint locally**: `npm run lint -- --fix` before pushing
2. **Run tests locally**: `npm run test` to catch failures early
3. **Check types**: `npm run typecheck` before PR
4. **Format code**: `npm run format` for consistency
5. **Monitor PR checks**: Watch status in GitHub UI during PR

### 20.2 For Repository Maintainers

1. **Rotate Secrets**: Regularly update CODECOV_TOKEN, SONAR_TOKEN, SNYK_TOKEN
2. **Monitor Performance**: Check weekly performance tests for regressions
3. **Review Mutation Results**: Address survived mutations to improve test quality
4. **Update Dependencies**: Run `npm audit fix` regularly
5. **Archive Results**: Download important artifacts before retention expires

### 20.3 For Performance Optimization

1. **E2E Test Sharding**: Already implemented (2 shards)
2. **Parallel Execution**: All test types run in parallel after unit tests
3. **Cache Strategy**: GitHub Actions cache on Node modules
4. **Database Optimization**: Use optimized configs without coverage for speed
5. **Consider Test Splitting**: If unit tests exceed 10 min, consider splitting

---

## 21. Monitoring & Metrics

### 21.1 Key Metrics to Track

- **CI Success Rate**: % of PRs passing all required checks
- **Average CI Time**: Time from push to all checks complete
- **Coverage Trend**: Coverage % over time
- **Performance Baseline**: P95 latency, RPS, error rate
- **Security Vulnerabilities**: Critical/high count over time
- **Code Quality**: Duplication %, complexity violations

### 21.2 Dashboards & Reports

- **Coverage**: `docs/coverage-trends.html` (GitHub Pages)
- **Performance**: `docs/performance-report.html` (GitHub Pages)
- **Security**: `docs/security-summary.html` (GitHub Pages)
- **Test Reports**: `docs/test-reports.html` (GitHub Pages)

---

## Appendix: Quick Reference

### A. Important Timeouts

- Lint/Type Check: 10 min
- Unit Tests: 10 min
- Integration Tests: 10 min
- E2E Tests: 10 min
- Chaos Tests: 10 min
- Performance Smoke: 10 min
- Mutation Testing: 30 min
- Performance Load: 10 min
- Coverage Report: No timeout
- Security Scan: 10 min
- Build: 10 min
- Code Quality: 10 min each
- SonarCloud: 15 min
- OpenAPI Validation: 60 sec
- Docker Build: 30 min
- Cleanup: 10-15 min
- Performance Sustained: 1500 min (25h)
- Performance Peak: 30 min
- Performance Scaling: 45 min

### B. Coverage Thresholds

| Metric | Threshold | Enforcement |
|--------|-----------|-------------|
| Lines | 80% | BLOCKING |
| Statements | 80% | BLOCKING |
| Functions | 50% | BLOCKING |
| Branches | 75% | BLOCKING |

### C. Code Quality Thresholds

| Check | Threshold | Enforcement |
|-------|-----------|-------------|
| ESLint Errors | 0 | BLOCKING |
| ESLint Warnings | ≤ 50 | BLOCKING |
| TypeScript Strict | Enabled | BLOCKING |
| Code Duplication | ≤ 7% | BLOCKING |
| High Complexity | ≤ 5 functions | WARNING |

### D. Performance Thresholds

| Test | Metric | Threshold |
|------|--------|-----------|
| Sustained Load | Degradation | < 20% |
| Peak Load | Result | Complete without error |
| Worker Scaling | Coverage | All worker counts tested |

---

**Document Version**: 1.0
**Last Updated**: January 2, 2026
**Status**: Complete & Verified
