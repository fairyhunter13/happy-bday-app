# CI/CD Dependency Graph & Execution Flow

**Generated**: January 2, 2026
**Documenter**: Queen Collective - SPARC Documenter Agent

---

## Executive Summary

This document visualizes the complete dependency graph of the CI/CD pipeline, showing how jobs relate to each other, execution order, and blocking/non-blocking status.

---

## 1. CI Pipeline Job Graph (ci.yml)

### 1.1 Complete Dependency Tree

```
┌─────────────────────────────────────────────────────────────────────────┐
│ CI Pipeline: Pull Requests & Push (main/develop)                        │
└─────────────────────────────────────────────────────────────────────────┘

LEGEND:
  [BLOCKING] = Must pass for PR merge
  [OPTIONAL] = Informational only
  [GATE]     = Meta-check, last in chain
  └──→        = Depends on
  ║           = Parallel execution


                            START
                             ║
                             ▼
        ┌────────────────────────────────────────┐
        │  lint-and-type-check [BLOCKING]        │ ⏱ 10 min
        │  - ESLint                              │
        │  - TypeScript type check               │
        │  - Code formatting check               │
        └────────────────────────────────────────┘
                             │
                             │ (blocks all downstream)
                             ▼
        ┌────────────────────────────────────────┐
        │  unit-tests [BLOCKING]                 │ ⏱ 10 min
        │  - Vitest with coverage                │ 📊 ~80% coverage
        │  - SOPS decryption                     │ 🔐 SOPS_AGE_KEY required
        │  - Coverage upload                     │
        └────────────────────────────────────────┘
                             │
                ┌────────────┼────────────┬────────────┬──────────────┬──────────────┬────────────────┐
                │            │            │            │              │              │                │
        ┌───────▼─────┐   ┌──▼──────┐ ┌──▼────────┐ ┌─▼──────────┐ ┌─▼──────────┐ ┌▼────────────┐ ┌▼──────────┐
        │integration- │   │  e2e-   │ │  chaos-  │ │performance│ │ mutation- │ │performance │ │coverage-  │
        │tests        │   │ tests   │ │  tests   │ │smoke-test │ │  testing │ │load-tests │ │report     │
        │[BLOCKING]   │   │[BLOCKING]│ │[OPTIONAL]│ │[OPTIONAL]│ │[OPTIONAL]│ │[OPTIONAL]│ │[BLOCKING] │
        │⏱ 10 min    │   │⏱ 10 min │ │⏱ 10 min │ │⏱ 10 min │ │⏱ 30 min │ │⏱ 10 min │ │⏱ varies  │
        │🐘 Postgres │   │2 shards │ │DB+RabbitMQ│ │k6 smoke │ │Stryker  │ │k6 load  │ │Coverage   │
        │🐰 RabbitMQ │   │Parallel │ │fail-fast:0│ │docker   │ │report   │ │docker   │ │thresholds │
        │🔴 Redis    │   │         │ │         │ │test    │ │         │ │test    │ │merge vs   │
        └───────┬─────┘   └──┬──────┘ └──┬────────┘ └─┬──────────┘ └─┬──────────┘ └┬────────────┘ └┬─────────┘
                │            │           │            │              │              │               │
                │ (parallel) │           │            │              │              │               │
                │            │           │            │              │              │               │
        ┌───────┴──┬─────────┴─┬────────┴──────────┬──┴──────────┬──┴──────────┬───┴────────────┘
        │          │           │                  │             │             │
        │          └─────────┬─┴───────────────────┴─────────────┴─────────────┘
        │                    │
        ├────────────────────┼─────────────────────┐
        │                    │                     │
        │          ┌─────────▼──────────┐          │
        │          │  security-scan     │          │
        │          │  [BLOCKING]        │          │
        │          │  ⏱ 10 min         │          │
        │          │  npm audit         │          │
        │          │  + Snyk (optional) │          │
        │          └─────────┬──────────┘          │
        │                    │                     │
        │                    │                     │
        │          ┌─────────▼──────────┐          │
        │          │  build             │          │
        │          │  [BLOCKING]        │          │
        │          │  ⏱ 10 min         │          │
        │          │  npm run build     │          │
        │          └─────────┬──────────┘          │
        │                    │                     │
        └─────────────────────┴─────────────────────┘
                              │
                              ▼
        ┌────────────────────────────────────────┐
        │  all-checks-passed [GATE]              │ ⏱ < 1 min
        │  Meta-check of required jobs           │ 🔒 Blocks merge if failed
        │  - lint-and-type-check ✅             │
        │  - unit-tests ✅                      │
        │  - integration-tests ✅               │
        │  - e2e-tests ✅                       │
        │  - build ✅                           │
        │  - security-scan ✅                   │
        │  - coverage-report ✅                 │
        │  - chaos-tests ⚠️ (warn only)         │
        │  - mutation-testing ⚠️ (warn only)    │
        │  - performance-smoke ⚠️ (warn only)   │
        │  - performance-load ⚠️ (warn only)    │
        └────────────────────────────────────────┘
                              │
                              ▼
                     ✅ MERGE ALLOWED
                     (if gate passes)
```

### 1.2 Parallel Execution Zone

After `unit-tests` completes, these jobs run **simultaneously**:

```
Time: 10 min (unit tests) + ~10 min (parallel jobs)

Parallel Zone:
├─ integration-tests (10 min)      [BLOCKING]
├─ e2e-tests (2 shards, 10 min)    [BLOCKING]
├─ chaos-tests (10 min)            [OPTIONAL]
├─ performance-smoke-test (10 min) [OPTIONAL]
├─ mutation-testing (30 min)       [OPTIONAL - may extend total time]
├─ performance-load-tests (10 min) [OPTIONAL]
├─ coverage-report (varies)        [BLOCKING]
├─ security-scan (10 min)          [BLOCKING]
└─ build (10 min)                  [BLOCKING]
```

**Total Time**:
- Fast path (without mutation): ~20 min
- With mutation testing: ~40 min

---

## 2. Cross-Workflow Dependencies

### 2.1 Workflow Orchestration Graph

```
┌──────────────────────────────────────────────────────────────────────────┐
│ All Workflows - Trigger & Dependencies                                   │
└──────────────────────────────────────────────────────────────────────────┘

GitHub Events
    │
    ├─── Pull Request
    │      ├──→ ci.yml [⏱ 20-40 min] ──→ Quality Gate
    │      ├──→ code-quality.yml [⏱ 10 min each]
    │      ├──→ security.yml [⏱ 20-60 min]
    │      ├──→ docker-build.yml [⏱ 30 min, build only]
    │      ├──→ sonarcloud.yml [⏱ 15 min]
    │      └──→ openapi-validation.yml [⏱ 1 min]
    │
    ├─── Push to main
    │      ├──→ ci.yml [⏱ 20-40 min]
    │      ├──→ code-quality.yml [⏱ 10 min each]
    │      ├──→ security.yml [⏱ 20-60 min]
    │      ├──→ docker-build.yml [⏱ 30 min, builds & pushes]
    │      ├──→ sonarcloud.yml [⏱ 15 min]
    │      ├──→ docs.yml [⏱ varies, deploys to GitHub Pages]
    │      └──→ (waits for CI to pass before deployment)
    │
    ├─── Push to develop
    │      ├──→ ci.yml [⏱ 20-40 min]
    │      └──→ openapi-validation.yml [⏱ 1 min]
    │
    ├─── Push tag (v*.*.*)
    │      └──→ docker-build.yml [⏱ 30 min, semantic versioning]
    │
    ├─── Schedule: Weekly Sunday 00:00 UTC
    │      ├──→ cleanup.yml [⏱ 10-15 min]
    │      └─(independent)
    │
    ├─── Schedule: Daily 00:00 UTC
    │      └──→ security.yml [⏱ 20-60 min]
    │      └─(independent)
    │
    ├─── Schedule: Weekly Sunday 02:00 UTC
    │      └──→ performance.yml [⏱ 25h+ for sustained load]
    │         ├─→ performance-sustained (25h)
    │         ├─→ performance-peak (30 min)
    │         ├─→ performance-worker-scaling (45 min)
    │         └─→ performance-report (consolidates results)
    │      └─(independent)
    │
    └─── Manual Workflow Dispatch (any)
         ├──→ ci.yml, performance.yml, security.yml
         ├──→ docker-build.yml, docs.yml, code-quality.yml
         ├──→ cleanup.yml, openapi-validation.yml
         └─(user-initiated)

NO HARD DEPENDENCIES between workflows:
  - Each workflow is independent
  - Failures don't cascade between workflows
  - docs.yml checks CI status via GitHub checks API (soft dependency)
```

### 2.2 Status Check Dependencies

```
PR Merge Requirements
└─ GitHub Branch Protection Rules
   ├─ ci.yml / lint-and-type-check ✅ REQUIRED
   ├─ ci.yml / unit-tests ✅ REQUIRED
   ├─ ci.yml / integration-tests ✅ REQUIRED
   ├─ ci.yml / e2e-tests ✅ REQUIRED
   ├─ ci.yml / coverage-report ✅ REQUIRED
   ├─ ci.yml / security-scan ✅ REQUIRED
   ├─ ci.yml / build ✅ REQUIRED
   ├─ ci.yml / all-checks-passed ✅ REQUIRED GATE
   ├─ code-quality.yml / quality-summary ✅ REQUIRED
   ├─ code-quality.yml / eslint ✅ REQUIRED
   └─ code-quality.yml / typescript-strict ✅ REQUIRED

   (Recommended but not blocking):
   ├─ ci.yml / chaos-tests ⚠️
   ├─ ci.yml / mutation-testing ⚠️
   ├─ ci.yml / performance-smoke-test ⚠️
   ├─ ci.yml / performance-load-tests ⚠️
   ├─ code-quality.yml / complexity-analysis ⚠️
   ├─ code-quality.yml / code-duplication ⚠️
   ├─ security.yml / snyk-scan ⚠️
   └─ sonarcloud.yml / sonarcloud ⚠️
```

---

## 3. Performance Testing Pipeline Graph

### 3.1 Scheduled Performance Tests

```
Schedule: Weekly Sunday 2:00 AM UTC (or manual trigger)

                            START
                             ║
            ┌────────────────┼────────────────┐
            │                │                │
            ▼                ▼                ▼
    ┌───────────────┐  ┌──────────────┐  ┌────────────────┐
    │ sustained-    │  │ peak-load    │  │ worker-scaling │
    │ load          │  │              │  │                │
    │ [1500 min]    │  │ [30 min]     │  │ [45 min]       │
    │ 24h test      │  │ 100+msg/sec  │  │ 3 workers      │
    │ 1M/day        │  │ 100k load    │  │ 1,5,10 workers │
    │ Baseline comp │  │ Peak metrics │  │ Scaling test   │
    └──────┬────────┘  └──────┬───────┘  └────────┬───────┘
           │                  │                   │
           └──────────────────┼───────────────────┘
                              │
                              ▼
                    ┌──────────────────────┐
                    │ performance-report   │
                    │ [varies]             │
                    │ Consolidate results  │
                    │ Generate badges      │
                    │ Upload to docs       │
                    └──────────────────────┘
                              │
                              ▼
                    📊 Reports & Badges
                       (90 day retention)
```

---

## 4. Security Pipeline Graph

### 4.1 Security Scanning Workflow

```
Schedule: Daily 00:00 UTC
Trigger: PR, Push (main), Manual

                            START
                             ║
        ┌────────────────────┼────────────────────┐
        │                    │                    │
        ▼                    ▼                    ▼
    ┌──────────┐  ┌──────────────┐  ┌──────────────┐
    │npm-audit │  │snyk-scan     │  │owasp-        │
    │[10 min]  │  │[15 min]      │  │dependency    │
    │critical  │  │optional      │  │check         │
    │prod+dev  │  │(token)       │  │[20 min]      │
    └────┬─────┘  └───────┬──────┘  └───────┬──────┘
         │                │                │
         └────┬───────────┼────────────────┘
              │           │
              ▼           ▼
         ┌────────────────────────┐
         │ trivy-scan             │
         │ [15 min]               │
         │ Container + filesystem │
         └────┬───────────────────┘
              │
         ┌────┴──────────────────┐
         │                       │
         ▼                       ▼
    ┌──────────┐         ┌──────────────────┐
    │license-  │         │codeql-analysis   │
    │compliance│         │[15 min]          │
    │[10 min]  │         │JavaScript scan   │
    │GPL check │         │GitHub security   │
    └─────┬────┘         └────────┬─────────┘
          │                       │
          └───────────┬───────────┘
                      │
                      ▼
              ┌───────────────────┐
              │security-summary   │
              │[informational]    │
              │Post PR comment    │
              │Aggregate results  │
              └───────────────────┘
```

---

## 5. Code Quality Pipeline Graph

### 5.1 Quality Checks Workflow

```
Trigger: PR, Push (main), Manual

                            START
                             ║
        ┌────────────────────┼────────────────────┐
        │                    │                    │
        ▼                    ▼                    ▼
    ┌──────────┐  ┌──────────────┐  ┌──────────────┐
    │eslint    │  │typescript    │  │complexity    │
    │[10 min]  │  │strict        │  │analysis      │
    │BLOCKING  │  │[10 min]      │  │[10 min]      │
    │          │  │BLOCKING      │  │WARNING       │
    └─────┬────┘  └───────┬──────┘  └───────┬──────┘
          │               │                 │
          └────┬──────────┼─────────────────┘
               │          │
               ▼          ▼
          ┌────────────────────────┐
          │code-duplication        │
          │[10 min]                │
          │BLOCKING (if >7%)       │
          └────┬───────────────────┘
               │
          ┌────┴────────────────────────┐
          │                             │
    (if PR)▼                            ▼(if always)
    ┌─────────────┐            ┌──────────────────┐
    │pr-quality- │            │quality-summary   │
    │report      │            │[informational]   │
    │Post comment│            │Gate check        │
    └────────────┘            └──────────────────┘
```

---

## 6. Documentation Pipeline Graph

### 6.1 Docs Deployment Workflow

```
Trigger: Push to main (with path filters), Manual

                            START
                             ║
                    ┌────────▼────────┐
                    │build            │
                    │[varies]         │
                    │- Build TypeScript
                    │- Run tests
                    │- Generate OpenAPI
                    │- Create site
                    │- Copy assets
                    │- Commit coverage
                    └────────┬────────┘
                             │
                             ▼
                    ┌──────────────────┐
                    │deploy            │
                    │[varies]          │
                    │- Deploy to Pages │
                    │- GitHub Pages env
                    └──────────────────┘
                             │
                             ▼
                    📖 Documentation Live
                       (GitHub Pages)
```

---

## 7. Docker Build Pipeline Graph

### 7.1 Container Build Workflow

```
Trigger: Push (main, tags), PR, Manual

                            START
                             ║
                    ┌────────▼──────────┐
                    │build-and-push     │
                    │[30 min]           │
                    │- Build image      │
                    │- Push (if not PR) │
                    │- Pull image       │
                    └────────┬──────────┘
                             │
                ┌────────────┼────────────┐
                │            │            │
                ▼            ▼            ▼
           ┌─────────┐  ┌────────┐  ┌──────────┐
           │trivy    │  │struct  │  │generate  │
           │scan     │  │test    │  │sbom      │
           │[varies] │  │[varies]│  │[varies]  │
           └────┬────┘  └───┬────┘  └────┬─────┘
                │           │           │
                └───┬───────┼───────────┘
                    │       │
                    ▼       ▼
              ┌─────────────────────┐
              │grype sbom scan      │
              │[varies]             │
              │fail-build: false    │
              └──────────┬──────────┘
                         │
                    ┌────▼──────────┐
              (if PR)│pr-comment    │
                    │Build results  │
                    └────────────────┘

(if not PR) Post comment on commit
```

---

## 8. OpenAPI Validation Pipeline Graph

### 8.1 API Spec Validation Workflow

```
Trigger: Path-based (schemas, routes, app.ts, .spectral.yml)

                            START
                             ║
                    ┌────────▼────────────┐
                    │validate-openapi    │
                    │[60 sec]            │
                    │- Build app         │
                    │- Start background  │
                    │- Redocly lint      │
                    │- Spectral lint     │
                    │- Export spec       │
                    │- Validate JSON     │
                    │- Check version     │
                    └────────┬───────────┘
                             │
                        ┌────▼────────┐
                        │Generate docs│
                    (if PR) (preview)
                        └────┬────────┘
                             │
                    ┌────────▼────────────┐
                    │security-scan       │
                    │[OWASP ZAP]         │
                    │[varies]            │
                    │API penetration     │
                    └────────┬───────────┘
                             │
                    ┌────────▼────────────┐
              (if PR)│pr-comment          │
                    │Validation results  │
                    └────────────────────┘
```

---

## 9. Cleanup Pipeline Graph

### 9.1 Artifact Cleanup Workflow

```
Schedule: Weekly Sunday 00:00 UTC (or manual)

                            START
                             ║
        ┌────────────────────┼────────────────────┐
        │                    │                    │
        ▼                    ▼                    ▼
    ┌──────────────┐  ┌────────────────┐  ┌───────────┐
    │cleanup-      │  │cleanup-docker  │  │cleanup-   │
    │artifacts     │  │images          │  │cache      │
    │[10 min]      │  │[15 min]        │  │[10 min]   │
    │- Old runs    │  │- Untagged imgs │  │- Old cache│
    │- Delete <30d │  │- Keep tagged   │  │- <30d acc │
    │- Keep main   │  │- <30d old      │  │- Delete   │
    └──────┬───────┘  └────────┬───────┘  └─────┬─────┘
           │                   │               │
           └───────────┬───────┴───────────────┘
                       │
                       ▼
              ┌─────────────────┐
              │summary          │
              │[informational]  │
              │Post results     │
              └─────────────────┘
```

---

## 10. Critical Path Analysis

### 10.1 Shortest Path to PR Merge

```
Time Budget: ~20 minutes for fast feedback

1. lint-and-type-check: 2-3 min ────────┐
2. unit-tests: 5-8 min ────────┐        │
3. [PARALLEL ZONE]:            │        │
   - integration-tests: 6-8 min├────────┼──────┐
   - e2e-tests: 5-7 min        │        │      │
   - security-scan: 2-3 min    │        │      │
   - build: 3-4 min ───────────┘        │      │
4. coverage-report: 2-3 min ───────────┬┘      │
5. all-checks-passed: < 1 min ─────────┴──────┬┘
                                              │
                                              ▼
                               ✅ READY TO MERGE (~20 min)

Extends to:
  + mutation-testing: +30 min (optional, can run alongside)
  + performance tests: +10 min (optional, can run alongside)
  Total: ~40 min with all optional checks passing
```

### 10.2 Longest Running Path

```
1. lint-and-type-check: 2-3 min
2. unit-tests: 5-8 min
3. mutation-testing (parallel): 20-30 min ← LONGEST
4. all-checks-passed: < 1 min
────────────────────────────────
Total: ~35-40 min (with mutation)
```

### 10.3 Blocking vs Non-Blocking

```
CRITICAL PATH (Must complete for merge):
  lint → unit → (integration | e2e | security | build) → gate

OPTIONAL FEEDBACK (Completes in parallel):
  unit → mutation (informational)
  unit → chaos (informational)
  unit → perf-smoke (informational)
  unit → perf-load (informational)

INDEPENDENT WORKFLOWS:
  Performance (weekly, 25h)
  Security (daily)
  Docker (on tag)
  Docs (on main push)
```

---

## 11. Execution Timeline Examples

### 11.1 Typical PR Execution (Fast Path)

```
Timeline (minutes):
0  ├─ Start
3  ├─ lint-and-type-check complete
8  ├─ unit-tests start
   ├─ All parallel jobs start:
   │  ├─ integration-tests (6-8 min)
   │  ├─ e2e-tests (5-7 min)
   │  ├─ security-scan (2-3 min)
   │  ├─ build (3-4 min)
   │  └─ coverage-report (2-3 min, waits for unit)
18 ├─ All required jobs complete
19 ├─ all-checks-passed runs (< 1 min)
20 ├─ PR Status: Ready to Merge ✅
   │
   (Optional jobs continue in parallel)
30 ├─ chaos-tests complete (optional)
38 ├─ mutation-testing complete (optional)
40 └─ All jobs complete
```

### 11.2 Full Run with Mutation Testing

```
Timeline (minutes):
0  ├─ Start
20 ├─ Required checks pass → Ready to merge
   │
   (Optional checks continue)
38 ├─ mutation-testing complete
30-40 └─ chaos-tests, perf-tests complete
```

### 11.3 Performance Test Schedule

```
Weekly Performance Tests (Sunday 2:00 AM UTC):
1. sustained-load: 0-1500 min (25 hours)
2. peak-load: parallel with sustained, completes ~30 min
3. worker-scaling: parallel, completes ~45 min
4. Report generation: after all three complete

Total: 25 hours (for sustained) + report generation
```

---

## 12. Resource Utilization

### 12.1 Concurrent Runners

```
Standard GitHub Actions limits:
- 20 concurrent jobs per repository
- Multiple workflows can run simultaneously

Our setup:
- CI: ~11 concurrent jobs (lint → unit → 9 parallel)
- Performance: 3 concurrent jobs (sustained, peak, scaling)
- Security: 6 concurrent jobs (npm, snyk, owasp, trivy, license, codeql)
- Code Quality: 4 concurrent jobs (eslint, ts, complexity, duplication)
- Docker: 1 job (sequential build/push)
- Docs: 2 jobs (build → deploy)
- Cleanup: 3 concurrent jobs (artifacts, images, cache)
- OpenAPI: 2 concurrent jobs (validate → security-scan)
```

### 12.2 Artifact Storage

```
Total storage estimate (per workflow run):
- coverage-unit: 5-10 MB × 7 day retention
- performance results: 10-50 MB × 30-90 day retention
- docker SBOM: 1-5 MB × 90 day retention
- reports: 10-50 MB × 7-30 day retention

With weekly runs and 20-30 concurrent PRs:
Estimate: 50-200 GB depending on test frequency and report sizes
```

---

## 13. Failure Recovery Paths

### 13.1 Most Common Failure Points

```
Failure at lint-and-type-check
  └─ Impact: Blocks all downstream
  └─ Recovery: Fix linting issues, push fix
  └─ Time to recover: 5-10 min

Failure at unit-tests
  └─ Impact: Blocks integration, e2e, coverage
  └─ Recovery: Run locally, fix test, push
  └─ Time to recover: 10-20 min

Failure at integration-tests
  └─ Impact: Blocks PR merge
  └─ Recovery: Check service health, fix test
  └─ Time to recover: 10-30 min

Failure at coverage-report
  └─ Impact: Blocks PR merge (threshold not met)
  └─ Recovery: Add tests to meet 80%+ threshold
  └─ Time to recover: 20-60 min

Failure at mutation-testing
  └─ Impact: Optional, doesn't block merge
  └─ Recovery: Address survived mutations, improve tests
  └─ Time to recover: Variable
```

### 13.2 Debugging Flow

```
PR Check Failed
    ├─ Click failing job in GitHub UI
    ├─ Read error message in job output
    ├─ Search for specific error line
    ├─ Run same command locally:
    │  ├─ npm run lint
    │  ├─ npm run test:unit
    │  ├─ npm run test:integration
    │  ├─ npm run test:e2e
    │  └─ npm run typecheck
    ├─ Reproduce issue locally
    ├─ Fix issue in code
    ├─ Verify fix locally
    └─ Push to trigger CI re-run
```

---

## 14. Workflow Trigger Decision Tree

```
GitHub Event
    │
    ├─ Pull Request
    │  ├─ All checks enabled
    │  ├─ Docker build (no push)
    │  ├─ Code quality gate applied
    │  ├─ PR comments posted
    │  └─ Merge button appears after all pass
    │
    ├─ Push to main
    │  ├─ All checks enabled
    │  ├─ Docker push enabled (with tags)
    │  ├─ Docs deployment triggered
    │  ├─ Coverage history updated
    │  └─ All artifacts retained longer
    │
    ├─ Push to develop
    │  ├─ CI and OpenAPI validation
    │  ├─ No deployment
    │  └─ No docker push
    │
    ├─ Tag push (v*.*.*)
    │  ├─ Docker build & push
    │  ├─ Semantic version tags
    │  ├─ Build artifacts retained 90d
    │  └─ SBOM generated
    │
    ├─ Schedule (Every day 00:00 UTC)
    │  └─ Security scanning workflow
    │
    ├─ Schedule (Every Sun 00:00 UTC)
    │  └─ Cleanup workflow
    │
    ├─ Schedule (Every Sun 02:00 UTC)
    │  └─ Performance testing workflow
    │
    └─ Manual (workflow_dispatch)
       ├─ Any workflow can be triggered
       ├─ Custom parameters supported
       └─ Used for one-off test runs
```

---

## Appendix: Symbol Legend

```
├─ Sequential dependency (blocks next)
├─ Parallel execution (starts together)
│  Multiple branches from same point
▼  Flow direction
✅ Pass/Required
⚠️  Warning/Optional
❌ Fail/Blocking
🔐 Requires secret
🐘 Service (database)
🐰 Service (message queue)
🔴 Service (cache)
⏱  Duration
📊 Metrics/Reports
📖 Documentation
🔒 Security/Protected
```

---

**Document Version**: 1.0
**Last Updated**: January 2, 2026
**Status**: Complete & Verified
