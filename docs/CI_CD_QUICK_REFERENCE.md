# CI/CD Quick Reference Guide

**Generated**: January 2, 2026
**Documenter**: Queen Collective - SPARC Documenter Agent

---

## Quick Links

- **Full Structure Documentation**: [CI_CD_STRUCTURE.md](./CI_CD_STRUCTURE.md)
- **Dependency Graphs & Flow**: [CI_CD_DEPENDENCY_GRAPH.md](./CI_CD_DEPENDENCY_GRAPH.md)
- **Workflow Files Directory**: [.github/workflows/](./.github/workflows/)

---

## 1. At-a-Glance Summary

| Aspect | Details |
|--------|---------|
| **Total Workflows** | 9 workflows |
| **Total Jobs** | 50+ jobs across all workflows |
| **Average PR Check Time** | 20-40 minutes |
| **Required for Merge** | 7 jobs (lint, unit, integration, e2e, security, build, gate) |
| **Optional/Informational** | 4 jobs (chaos, mutation, perf tests) |
| **Secrets Required** | 1 (SOPS_AGE_KEY) |
| **Secrets Optional** | 3 (CODECOV_TOKEN, SONAR_TOKEN, SNYK_TOKEN) |

---

## 2. Workflow Quick Reference

### CI Workflow (ci.yml)
**Triggers**: PR, Push (main/develop)
**Duration**: 20-40 min
**Status**: CRITICAL (blocks merge)

| Job | Duration | Blocks? |
|-----|----------|---------|
| lint-and-type-check | 10 min | YES |
| unit-tests | 10 min | YES |
| integration-tests | 10 min | YES |
| e2e-tests | 10 min | YES |
| chaos-tests | 10 min | NO |
| performance-smoke-test | 10 min | NO |
| mutation-testing | 30 min | NO |
| performance-load-tests | 10 min | NO |
| coverage-report | varies | YES |
| security-scan | 10 min | YES |
| build | 10 min | YES |
| all-checks-passed | < 1 min | YES |

### Performance Workflow (performance.yml)
**Triggers**: Schedule (weekly), Manual
**Duration**: 25 hours (sustained) + others
**Status**: INFORMATIONAL

### Security Workflow (security.yml)
**Triggers**: PR, Push (main), Schedule (daily), Manual
**Duration**: 20-60 min
**Status**: INFORMATIONAL (except license check)

### Code Quality Workflow (code-quality.yml)
**Triggers**: PR, Push (main), Manual
**Duration**: 10 min each job
**Status**: BLOCKING (eslint, typescript required)

### Docker Workflow (docker-build.yml)
**Triggers**: Push (main, tags), PR, Manual
**Duration**: 30 min
**Status**: INFORMATIONAL on PR, PUSH on main

### Documentation Workflow (docs.yml)
**Triggers**: Push (main), Manual
**Duration**: varies
**Status**: DEPLOYMENT to GitHub Pages

### SonarCloud Workflow (sonar.yml)
**Triggers**: Push (main), PR
**Duration**: 15 min
**Status**: INFORMATIONAL (optional token)

### OpenAPI Validation Workflow (openapi-validation.yml)
**Triggers**: Path-based (PR/Push to main/develop)
**Duration**: 1 min (validation)
**Status**: INFORMATIONAL

### Cleanup Workflow (cleanup.yml)
**Triggers**: Schedule (weekly), Manual
**Duration**: 10-15 min
**Status**: MAINTENANCE

---

## 3. Coverage Thresholds

```
Minimum required for merge:
├─ Lines:       80%
├─ Statements:  80%
├─ Functions:   50%
└─ Branches:    75%
```

---

## 4. Code Quality Gates

```
ESLint:
├─ Errors:    0 (blocking)
├─ Warnings:  ≤ 50 (blocking if exceeded)

TypeScript:
├─ Strict Mode: Required (blocking)
├─ Errors:      0 (blocking)

Code Duplication:
├─ Threshold: ≤ 7% (blocking if exceeded)

Complexity:
├─ High Complexity: ≤ 5 functions (warning only)
```

---

## 5. Secrets Setup

### Required

```bash
# Decrypt test environment files
gh secret set SOPS_AGE_KEY --body "$(cat ~/.sops/age-key.txt)"
```

### Optional (Recommended)

```bash
# Coverage tracking
gh secret set CODECOV_TOKEN --body "$(gh auth token)" # from codecov.io

# Code quality analysis
gh secret set SONAR_TOKEN --body "..." # from sonarcloud.io

# Security scanning
gh secret set SNYK_TOKEN --body "..." # from snyk.io
```

---

## 6. Most Common Issues & Solutions

### Issue: Unit tests fail on CI but pass locally

```bash
# Check environment differences
cat .env.test  # local
# Compare with CI steps that do:
sops --decrypt .env.test.enc > .env.test

# Solution: Ensure SOPS_AGE_KEY is set
gh secret set SOPS_AGE_KEY --body "$(cat ~/.sops/age-key.txt)"
```

### Issue: Coverage threshold not met

```bash
# Check current coverage
npm run test:unit -- --coverage

# Add tests to reach 80% minimum
# OR
# Review thresholds in:
# - vitest.config.base.ts
# - scripts/coverage/check-thresholds.sh

# View coverage report
open coverage/index.html
```

### Issue: ESLint errors block merge

```bash
# Auto-fix common issues
npm run lint -- --fix

# Check remaining errors
npm run lint

# Fix manually if needed
```

### Issue: TypeScript strict mode errors

```bash
# Find type errors
npm run typecheck

# Fix in source files
# Ensure tsconfig.json has "strict": true
```

### Issue: Docker build fails in CI

```bash
# Build locally
docker build -t test:local .

# Check Dockerfile for issues
cat Dockerfile

# Review CI logs for specific error
```

### Issue: Mutation score too low

```bash
# View mutation test results
npm run test:mutation:incremental

# Review "Survived" mutations (undetected)
# Add tests that catch these mutations

# Check mutation score threshold
# High: >= 80%, Low: >= 60%, Break: < 50%
```

---

## 7. Performance Baseline

### Expected Times

| Test | Target | Notes |
|------|--------|-------|
| Lint & Type | 3 min | First job |
| Unit Tests | 8 min | With coverage |
| Integration | 8 min | 3 services |
| E2E Tests | 7 min | 2 shards parallel |
| Security | 3 min | npm audit |
| Build | 4 min | TypeScript compile |
| **Total** | **20 min** | Critical path |

### With Optional Tests

| Test | Additional Time |
|------|-----------------|
| Mutation | +30 min |
| Chaos | +10 min |
| Perf Smoke | +10 min |
| Perf Load | +10 min |
| **Max Total** | **~60 min** |

---

## 8. PR Merge Checklist

- [ ] All required jobs passing (green checkmarks)
- [ ] Coverage thresholds met (80%+)
- [ ] ESLint errors fixed (0 errors)
- [ ] TypeScript strict mode passing
- [ ] No "Blocker" comments from reviewers
- [ ] Mutation score good if available (60%+)
- [ ] All conversations resolved

---

## 9. Viewing Results

### GitHub UI
1. Go to PR
2. Scroll to "Checks" section
3. Click on failing/passing job
4. View logs in job output
5. Download artifacts if available

### Command Line
```bash
# List all workflows
gh workflow list

# View workflow runs
gh run list --workflow=ci.yml

# Download artifacts
gh run download <RUN_ID> -n coverage-unit

# View workflow file
cat .github/workflows/ci.yml
```

### Coverage Reports
```
Online: https://codecov.io/github/fairyhunter13/happy-bday-app
Local:  npm run test:unit -- --coverage
        open coverage/index.html
```

### Performance Results
```
Weekly: https://github.com/fairyhunter13/happy-bday-app/actions
        Look for "Performance Tests" workflow
Reports: Artifacts retain 30-90 days
```

---

## 10. Manual Triggers

### Trigger any workflow manually

```bash
# List available workflows
gh workflow list

# Trigger workflow
gh workflow run <workflow-name>

# With parameters (e.g., performance tests)
gh workflow run performance.yml -f test_type=all

# With cleanup parameters
gh workflow run cleanup.yml -f days_to_keep=60
```

### Common Manual Runs

```bash
# Run performance tests on-demand
gh workflow run performance.yml -f test_type=sustained

# Run security scan outside schedule
gh workflow run security.yml

# Deploy docs outside push
gh workflow run docs.yml

# Run cleanup with custom retention
gh workflow run cleanup.yml -f days_to_keep=60
```

---

## 11. Debugging Guide

### Step 1: Read the Error
- Click on failing job in GitHub UI
- Look at the actual error message
- Note the step number and error line

### Step 2: Reproduce Locally
```bash
# Lint
npm run lint

# Type check
npm run typecheck

# Unit tests
npm run test:unit

# Integration tests (requires services)
docker-compose -f docker-compose.test.yml up -d
npm run db:migrate
npm run test:integration

# E2E tests
npm run test:e2e

# All at once
npm run test
```

### Step 3: Fix & Verify
- Fix the issue
- Run test again locally
- Commit and push
- Watch CI run

### Step 4: Check Logs
- Click failing job again
- Scroll to see if error changed
- Read logs carefully for new issues

---

## 12. Optimization Tips

### For Faster Feedback
1. Run lint locally before pushing: `npm run lint -- --fix`
2. Run tests locally: `npm run test:unit`
3. Check types: `npm run typecheck`
4. Push only when tests pass locally

### For Less CI Load
1. Squash commits before merge (if team policy)
2. Avoid force-pushing (cancels in-progress runs anyway)
3. Close abandoned PRs
4. Don't trigger all workflows manually if not needed

### For Better Coverage
1. Aim for 80%+ coverage (minimum 80%)
2. Add tests for new code before pushing
3. Review mutation test results monthly
4. Use `npm run test:coverage` to see gaps

---

## 13. Branch Protection Rules

Current rules for main branch:
- Require all required status checks to pass
- Require code reviews (if configured)
- Require branches to be up to date
- Dismiss stale reviews when new commits pushed
- Require status checks to pass before merging

To update: Repository Settings → Branches → main

---

## 14. Artifact Retention

| Artifact | Retention | Removal |
|----------|-----------|----------|
| coverage-unit | 7 days | Auto |
| eslint-report | 30 days | Auto |
| performance reports | 30-90 days | Auto |
| SBOM | 90 days | Auto |
| docker images | 30 days | Weekly cleanup |
| build caches | 30 days | Weekly cleanup |

---

## 15. Emergency Procedures

### Force Merge (Emergency Only)
```bash
# If CI is broken and can't be fixed:
# Contact repository admin
# They can bypass branch protection

# NOT RECOMMENDED - Fix CI instead!
```

### Clear Workflow Cache
```bash
# If cache is corrupted:
gh actions cache delete -k <cache-key> --confirm
# OR
# Go to: Repository Settings → Actions → Caches
# Click "Delete" on problematic cache
```

### Re-run Failed Job
```bash
# In GitHub UI:
# Click "Re-run job" button on failed job
# OR
gh run rerun <RUN_ID> --failed-only
```

---

## 16. Key Files Reference

| File | Purpose | Edit? |
|------|---------|-------|
| `.github/workflows/ci.yml` | Main CI pipeline | Admin only |
| `vitest.config.base.ts` | Test configuration | Team |
| `tsconfig.json` | TypeScript config | Team |
| `.eslintrc.json` | Linting rules | Team |
| `.env.test.enc` | Encrypted test secrets | Admin |
| `sonar-project.properties` | SonarCloud config | Team |
| `.spectral.yml` | OpenAPI rules | Team |

---

## 17. Metrics & Dashboard

### Coverage
- Minimum: 80%
- Current: Check `.github/workflows/ci.yml` output
- Trend: View `docs/coverage-trends.html`

### Performance
- RPS Target: Varies by endpoint
- Latency Target: p95 < 100ms
- Baseline: First run or main branch last run

### Security
- Critical Vulns: 0
- High Vulns: Review and address
- License Compliance: Must pass

---

## 18. Support & Help

### For CI/CD Issues
1. Check `.github/workflows/<workflow>.yml` file
2. Review logs in GitHub Actions UI
3. Search for error message in documentation
4. Check git history for related changes
5. Open issue with error logs

### For Test Failures
1. Run locally: `npm run test`
2. Check test files for recent changes
3. Review error message carefully
4. Check environment variables
5. Ensure services are running (if integration test)

### For Performance Issues
1. Check performance baseline
2. Review recent code changes
3. Run performance tests manually
4. Compare with previous runs
5. Profile locally with k6

---

## 19. Common Commands Reference

```bash
# Testing
npm run lint              # ESLint check
npm run lint -- --fix     # ESLint auto-fix
npm run typecheck         # TypeScript check
npm run test              # All tests
npm run test:unit         # Unit tests only
npm run test:integration  # Integration tests
npm run test:e2e          # E2E tests
npm run test:mutation     # Mutation tests
npm run test:coverage     # With coverage report

# Building
npm run build             # TypeScript build
npm run openapi:generate  # Generate OpenAPI client
npm run openapi:spec      # Export OpenAPI spec

# Database
npm run db:migrate        # Run migrations
npm run db:seed:perf      # Seed performance data

# Docker
docker build -t app:local .
docker-compose -f docker-compose.test.yml up -d
docker-compose -f docker-compose.test.yml down -v

# GitHub CLI
gh workflow list          # List workflows
gh run list              # List recent runs
gh run view <RUN_ID>     # View run details
gh run download <RUN_ID> # Download artifacts
gh workflow run <name>   # Manually trigger
```

---

## 20. Glossary

| Term | Meaning |
|------|---------|
| Workflow | GitHub Actions automation file (.yml) |
| Job | A step/stage in a workflow |
| Step | Individual command/action in a job |
| Artifact | Files saved from workflow run |
| Concurrency | Multiple jobs running at same time |
| Cache | Saved files between runs (NPM packages) |
| Secret | Encrypted environment variable |
| Status Check | Required pass/fail condition for merge |
| SOPS | Secrets Operations (encryption tool) |
| CI/CD | Continuous Integration / Continuous Deployment |
| Coverage | % of code tested by unit tests |
| Mutation Testing | Testing quality evaluation |
| E2E | End-to-End (full workflow test) |
| Chaos | Testing failure scenarios |
| SBOM | Software Bill of Materials |

---

**Quick Reference Version**: 1.0
**Last Updated**: January 2, 2026
**Status**: Ready to Use
