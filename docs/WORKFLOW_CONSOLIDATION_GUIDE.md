# Workflow Consolidation Guide

## Overview

All separate CI workflow files have been successfully consolidated into a single unified workflow (`ci-full.yml`) for better organization, maintainability, and status tracking.

**Consolidation Date:** 2026-01-02  
**Commit:** `1a18ecf` - refactor(ci): consolidate all workflows into ci-full.yml

## What Was Changed

### ✅ Workflows Merged into ci-full.yml

The following 11 workflow files have been merged and **deleted**:

1. **unit-tests.yml** → `unit-tests` job in ci-full.yml
2. **integration-tests.yml** → `integration-tests` job in ci-full.yml
3. **e2e-tests.yml** → `e2e-tests` job in ci-full.yml
4. **chaos-tests.yml** → `chaos-tests` job in ci-full.yml
5. **mutation-tests.yml** → `mutation-testing` job in ci-full.yml
6. **performance-load-tests.yml** → `performance-load-tests` job in ci-full.yml
7. **performance-smoke-tests.yml** → `performance-smoke-test` job in ci-full.yml
8. **openapi-validation.yml** → `openapi-validation` job in ci-full.yml
9. **code-quality.yml** → `lint-and-type-check` job in ci-full.yml
10. **security.yml** → `security-scan` job in ci-full.yml
11. **sonar.yml** → `sonarcloud` job in ci-full.yml

### 🗑️ Deprecated Workflows Removed

- **ci.yml** - Old deprecated workflow (no longer in use)

### 📁 Workflows Kept Separate (By Design)

The following 4 workflows remain as separate files for specific reasons:

1. **cleanup.yml** - Scheduled maintenance tasks (weekly cleanup of old artifacts and images)
2. **docker-build.yml** - Docker image building and publishing to registry
3. **docs.yml** - GitHub Pages documentation deployment
4. **performance.yml** - Long-running sustained load tests (25-hour timeout)

**Why separate?** These workflows have different triggers, lifecycles, and resource requirements that make them unsuitable for consolidation.

## Current Workflow Structure

### .github/workflows/ Directory

```
.github/workflows/
├── ci-full.yml          # Consolidated CI workflow (14 jobs)
├── cleanup.yml          # Weekly artifact cleanup
├── docker-build.yml     # Docker image builds
├── docs.yml             # Documentation deployment
└── performance.yml      # Long-running performance tests
```

### ci-full.yml Jobs (14 total)

The unified workflow includes all CI/CD checks in a single pipeline:

| Job | Description | Dependencies |
|-----|-------------|--------------|
| `lint-and-type-check` | ESLint, TypeScript, Prettier | None |
| `unit-tests` | Unit tests with coverage | lint-and-type-check |
| `integration-tests` | Integration tests with services | unit-tests |
| `e2e-tests` | E2E tests (sharded × 3, TZ=UTC) | unit-tests |
| `chaos-tests` | Chaos engineering tests | unit-tests |
| `performance-smoke-test` | Quick performance smoke tests | unit-tests |
| `mutation-testing` | Stryker mutation coverage | unit-tests |
| `performance-load-tests` | k6 load testing | unit-tests |
| `openapi-validation` | Redocly + Spectral API linting | unit-tests |
| `sonarcloud` | Code quality analysis | unit-tests, integration-tests, e2e-tests |
| `coverage-report` | Codecov upload and reporting | unit-tests, integration-tests, e2e-tests |
| `security-scan` | Snyk vulnerability scanning | lint-and-type-check |
| `build` | TypeScript compilation verification | All tests |
| `all-checks-passed` | Final gate for all checks | All jobs |

## Benefits of Consolidation

### ✨ Improved Organization

- **Single source of truth** - All CI checks in one file
- **Easier to understand** - One workflow to review instead of 11 separate files
- **Better visibility** - Single workflow status instead of 11 separate runs

### 📊 Better Status Tracking

- **Unified status badge** - One badge shows all checks
- **Single required check** - `all-checks-passed` job gates merges
- **Clearer PR checks** - All checks grouped under "CI (Full)"

### 🔧 Easier Maintenance

- **Reduced duplication** - Shared configuration in one place
- **Consistent triggers** - Same triggers for all CI checks
- **Simpler updates** - Change once, applies to all jobs

### 📈 Code Statistics

- **14 files changed**
- **2,629 lines removed** (deleted workflows)
- **387 lines added** (consolidated workflow)
- **Net reduction: 2,242 lines** (82% reduction!)

## GitHub Actions UI Updates

### Expected Behavior

After pushing the consolidation changes, GitHub Actions will:

1. **Stop showing old workflow runs** - Deleted workflows won't trigger new runs
2. **Keep historical runs** - Old runs remain accessible for reference
3. **Update sidebar** - Workflow list will update to show only active workflows

### Workflow List (After Update)

You should see only these workflows in the GitHub Actions sidebar:

- ✅ **CI (Full)** - All unified CI checks
- ✅ **Chaos Tests** - *Will disappear (old runs only)*
- ✅ **Cleanup Old Artifacts and Images** - Scheduled cleanup
- ✅ **Code Quality** - *Will disappear (old runs only)*
- ✅ **Deploy Documentation** - Docs deployment
- ✅ **Docker Build and Push** - Docker builds
- ✅ **E2E Tests** - *Will disappear (old runs only)*
- ✅ **Integration Tests** - *Will disappear (old runs only)*
- ✅ **Mutation Tests** - *Will disappear (old runs only)*
- ✅ **OpenAPI Validation** - *Will disappear (old runs only)*
- ✅ **Performance Load Tests** - *Will disappear (old runs only)*
- ✅ **Performance Smoke Tests** - *Will disappear (old runs only)*
- ✅ **Performance Tests** - Long-running tests
- ✅ **Security Scanning** - *Will disappear (old runs only)*
- ✅ **SonarCloud** - *Will disappear (old runs only)*
- ✅ **Unit Tests** - *Will disappear (old runs only)*

**Note:** Workflows marked "*Will disappear*" will gradually disappear from the sidebar as GitHub updates its cache. Historical runs remain accessible.

## Migration Checklist

- [x] Analyze all workflow files
- [x] Merge 11 workflows into ci-full.yml
- [x] Remove merged workflow files
- [x] Remove deprecated ci.yml
- [x] Validate YAML syntax
- [x] Verify job dependencies
- [x] Add node_modules caching
- [x] Document required secrets
- [x] Commit changes
- [x] Push to remote
- [x] Create consolidation guide

## Required GitHub Secrets

The consolidated workflow requires these secrets:

| Secret | Required? | Purpose |
|--------|-----------|---------|
| `SOPS_AGE_KEY` | ✅ Required | Decrypt `.env.test.enc` for test execution |
| `CODECOV_TOKEN` | ✅ Required | Upload coverage reports to Codecov |
| `SNYK_TOKEN` | ⚠️ Optional | Enable Snyk security scanning |
| `SONAR_TOKEN` | ⚠️ Optional | Enable SonarCloud analysis |

Verify secrets are configured:
```bash
./scripts/verify-github-secrets.sh
```

## Triggers

The consolidated `ci-full.yml` workflow triggers on:

- **Pull requests** - All PRs to any branch
- **Push to main/develop** - Commits to main branches
- **Manual dispatch** - Manual workflow triggers

## Additional Improvements

### Performance Optimizations

- **node_modules caching** - Caches `node_modules` based on `package-lock.json` hash
- **Optimized npm ci** - Uses `--prefer-offline --no-audit` flags
- **Parallel execution** - Jobs run in parallel where possible

### Configuration

All service container configurations are preserved:
- PostgreSQL 16 (for integration/E2E/OpenAPI tests)
- RabbitMQ 3 (for integration/E2E/OpenAPI tests)
- Redis 7 (for integration/E2E/OpenAPI tests)

## Troubleshooting

### Issue: Old workflows still showing in GitHub UI

**Cause:** GitHub caches workflow metadata and historical runs

**Solution:** 
- Wait for GitHub's cache to update (usually 5-10 minutes)
- Old workflow names will disappear as they're no longer triggered
- Historical runs remain accessible for reference

### Issue: CI (Full) workflow not triggering

**Cause:** May need to create a new PR or push

**Solution:**
```bash
# Trigger workflow manually
gh workflow run ci-full.yml

# Or create a test PR
git checkout -b test-ci-full
git commit --allow-empty -m "test: trigger CI (Full) workflow"
git push -u origin test-ci-full
```

### Issue: Required check "CI (Full)" not recognized

**Cause:** Branch protection rules may reference old workflow names

**Solution:**
1. Go to Settings → Branches → Branch protection rules
2. Edit protection rule for `main` branch
3. Update required status checks to: `all-checks-passed` (from CI (Full))
4. Save changes

## References

- [WORKFLOW_TROUBLESHOOTING_GUIDE.md](./WORKFLOW_TROUBLESHOOTING_GUIDE.md) - Comprehensive troubleshooting guide
- [.github/workflows/ci-full.yml](../.github/workflows/ci-full.yml) - Consolidated workflow file

## Commit History

- `1a18ecf` - refactor(ci): consolidate all workflows into ci-full.yml
- `a59f0c3` - fix(workflows): resolve OpenAPI validation and document workflow issues

---

**Last Updated:** 2026-01-02  
**Status:** ✅ Complete
