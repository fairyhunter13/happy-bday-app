# README Badge Inventory

**Repository:** fairyhunter13/happy-bday-app  
**Total Badges:** 40  
**Date Updated:** 2026-01-03

---

## Badge Summary

| Category | Count | Description |
|----------|-------|-------------|
| CI/CD Pipeline Status | 4 | Workflow execution status |
| Test Suite Status | 5 | Individual test type badges |
| Code Quality & Security | 7 | Quality and security tools |
| Coverage & Validation | 3 | Coverage and API validation |
| Performance Metrics | 4 | Performance test results |
| Tech Stack | 10 | Technologies and tools used |
| Documentation & Resources | 3 | Documentation links |
| Project Info | 4 | Repository metadata |
| **TOTAL** | **40** | |

---

## Complete Badge List

### 1. CI/CD Pipeline Status (4 badges)

| Badge | Type | URL |
|-------|------|-----|
| CI (Full) | Workflow | `actions/workflows/ci-full.yml` |
| Docker Build | Workflow | `actions/workflows/docker-build.yml` |
| Performance Tests | Workflow | `actions/workflows/performance.yml` |
| Cleanup | Workflow | `actions/workflows/cleanup.yml` |

### 2. Test Suite Status (5 badges)

| Badge | Type | Source |
|-------|------|--------|
| Unit Tests | Job | ci-full.yml (unit-tests job) |
| Integration Tests | Job | ci-full.yml (integration-tests job) |
| E2E Tests | Job | ci-full.yml (e2e-tests job) |
| Chaos Tests | Job | ci-full.yml (chaos-tests job) |
| Mutation Testing | Job | ci-full.yml (mutation-testing job) |

### 3. Code Quality & Security (7 badges)

| Badge | Type | Integration |
|-------|------|-------------|
| Code Quality | Job | ci-full.yml (lint-and-type-check job) |
| Security Scan | Job | ci-full.yml (security-scan job) |
| SonarCloud | Job | ci-full.yml (sonarcloud job) |
| Quality Gate Status | External | SonarCloud Dashboard |
| Snyk Security | External | Snyk vulnerability scan |
| Dependabot | GitHub | .github/dependabot.yml |
| Code Duplication | Tool | JSCPD (<5% threshold) |

### 4. Coverage & Validation (3 badges)

| Badge | Type | Source |
|-------|------|--------|
| Codecov | External | Codecov integration |
| Code Coverage | Endpoint | GitHub Pages (coverage-badge.json) |
| OpenAPI Validation | Job | ci-full.yml (openapi-validation job) |

### 5. Performance Metrics (4 badges)

| Badge | Value | Source |
|-------|-------|--------|
| Performance | Dynamic | GitHub Pages (performance-badge.json) |
| RPS Capacity | 100+ msg/sec | Static (from README) |
| Throughput | 1M+ msgs/day | Static (from README) |
| p95 Latency | <200ms | Static (from README) |

### 6. Tech Stack (10 badges)

| Technology | Version | Link |
|------------|---------|------|
| Node.js | ≥20.0.0 | nodejs.org |
| TypeScript | 5.7 | typescriptlang.org |
| Fastify | 5.x | fastify.dev |
| PostgreSQL | 15 | postgresql.org |
| RabbitMQ | 3.x | rabbitmq.com |
| Redis | 7.x | redis.io |
| Docker | Compose | docker.com |
| Prometheus | Monitoring | prometheus.io |
| Grafana | Dashboards | grafana.com |
| k6 | Load Testing | k6.io |

### 7. Documentation & Resources (3 badges)

| Badge | Type | Link |
|-------|------|------|
| API Documentation | GitHub Pages | fairyhunter13.github.io/happy-bday-app |
| Coverage Trends | GitHub Pages | coverage-trends.html |
| GitHub Pages | GitHub | GitHub Pages site |

### 8. Project Info (4 badges)

| Badge | Type | Link |
|-------|------|------|
| License: MIT | Static | LICENSE file |
| PRs Welcome | Static | CONTRIBUTING.md |
| GitHub Issues | Dynamic | GitHub Issues count |
| Last Commit | Dynamic | Latest commit timestamp |

---

## Badge Types

### Workflow Badges (4)
These badges show the status of GitHub Actions workflows:
- Use format: `actions/workflows/{workflow}.yml/badge.svg`
- Update automatically on workflow runs
- Show passing/failing status

### Job Badges (8)
These badges show the status of individual jobs within ci-full.yml:
- Use format: `github/actions/workflow/status/{owner}/{repo}/{workflow}.yml?label={job}`
- Update when parent workflow runs
- Show job-specific status

### External Integration Badges (4)
These badges integrate with external services:
- Codecov (code coverage tracking)
- SonarCloud (code quality analysis)
- Snyk (security vulnerability scanning)
- Dependabot (dependency updates)

### Endpoint Badges (2)
These badges fetch data from GitHub Pages JSON files:
- Code Coverage (coverage-badge.json)
- Performance (performance-badge.json)

### Static Badges (22)
These badges have hardcoded values:
- Tech stack versions
- Performance metrics
- Project info
- Documentation links

---

## Workflow Detection

### Detected Workflows (4/4)

| Workflow | Jobs | Schedule | Manual |
|----------|------|----------|--------|
| ci-full.yml | 13 | On push/PR | Yes |
| docker-build.yml | 2 | On push/PR | Yes |
| performance.yml | 4 | Daily 2am UTC | Yes |
| cleanup.yml | 4 | Weekly Sunday | Yes |

### CI/CD Pipeline Coverage

**Jobs in ci-full.yml (13):**
1. lint-and-type-check
2. unit-tests
3. integration-tests
4. e2e-tests (sharded 2x)
5. chaos-tests
6. performance-smoke-test
7. mutation-testing
8. performance-load-tests
9. openapi-validation
10. sonarcloud
11. coverage-report
12. security-scan
13. build
14. all-checks-passed
15. deploy-documentation (main only)

**All 13 jobs are represented** in badges either directly or through category badges.

---

## Integration Detection

### Detected Integrations (9/9)

| Integration | Config File | Badge |
|-------------|-------------|-------|
| SonarCloud | sonar-project.properties | Yes |
| Dependabot | .github/dependabot.yml | Yes |
| Stryker | stryker.config.mjs | Yes (Mutation Testing) |
| JSCPD | .jscpd.json | Yes (Code Duplication) |
| Docker/GHCR | docker-compose.*.yml | Yes (Docker Build) |
| Grafana | grafana/dashboards/ | Yes (Tech Stack) |
| k6 | tests/performance/ | Yes (Tech Stack) |
| Codecov | .github/workflows/ | Yes |
| Snyk | .github/workflows/ | Yes |

**All 9 integrations are badged.**

---

## URL Formats

### Repository URLs
All badges use the correct owner/repo format:
```
fairyhunter13/happy-bday-app
```

### Workflow Badge URLs
```markdown
[![Workflow](https://github.com/fairyhunter13/happy-bday-app/actions/workflows/{workflow}.yml/badge.svg)](https://github.com/fairyhunter13/happy-bday-app/actions/workflows/{workflow}.yml)
```

### Job Status Badge URLs
```markdown
[![Job](https://img.shields.io/github/actions/workflow/status/fairyhunter13/happy-bday-app/{workflow}.yml?label={job}&logo={logo})](https://github.com/fairyhunter13/happy-bday-app/actions/workflows/{workflow}.yml)
```

### Static Badge URLs
```markdown
[![Label](https://img.shields.io/badge/{Label}-{Value}-{Color}?logo={logo})]({link})
```

### Endpoint Badge URLs
```markdown
[![Label](https://img.shields.io/endpoint?url=https://fairyhunter13.github.io/happy-bday-app/{endpoint}.json&logo={logo})]({link})
```

---

## Performance Metrics

Current static values (from README):

| Metric | Value | Color | Logo |
|--------|-------|-------|------|
| RPS | 100+ msg/sec | brightgreen | graphql |
| Throughput | 1M+ msgs/day | brightgreen | apachekafka |
| p95 Latency | <200ms | brightgreen | speedtest |

These values are based on:
- README.md performance targets table
- Local Docker Compose test results
- Production-scale testing documentation

---

## Future Updates

### Dynamic Performance Badges
When performance tests run, update these endpoint files:
- `docs/performance-badge.json` - Overall performance
- `docs/rps-badge.json` - Requests per second
- `docs/latency-badge.json` - p95 latency
- `docs/throughput-badge.json` - Throughput

### Badge Maintenance
- Monitor workflow status badges for failures
- Update static values when new test results are available
- Verify external integration badges (Codecov, SonarCloud, Snyk)
- Check endpoint badges are accessible

---

## Badge Health Check

### Critical Badges (must always work)
- CI (Full) workflow badge
- Code Coverage badge
- Security Scan badge

### Warning Badges (monitor but non-blocking)
- Performance Tests workflow badge
- Mutation Testing badge
- SonarCloud badge

### Informational Badges (can fail temporarily)
- Cleanup workflow badge
- GitHub Issues badge
- Last Commit badge

---

