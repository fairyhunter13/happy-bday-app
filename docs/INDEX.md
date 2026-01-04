# Documentation Index

Complete documentation organized by topic and audience.

## Quick Navigation

| Category | Description | Key Files |
|----------|-------------|-----------|
| [Getting Started](#getting-started) | Setup, deployment, and quickstart guides | 4 files |
| [Architecture](#architecture--design) | System design, flows, and technical decisions | 3 files |
| [API Documentation](#api-documentation) | External API integration specifications | 3 files |
| [Testing](#testing) | Test strategies, patterns, and validation | 16 files |
| [Infrastructure](#infrastructure--operations) | Deployment, runbooks, and operational guides | 2 files |
| [Queue System](#queue-system-documentation-new) | RabbitMQ-based async message processing | 1 file |
| [Investigations](#investigation-reports) | Technical analysis and findings | 1 file |
| [CI/CD](#cicd--workflows) | Pipeline structure and troubleshooting | 7 files |
| [Monitoring](#monitoring--metrics) | Metrics, dashboards, and observability | 2 files |

---

## Getting Started

Essential guides for new developers and deployment.

- **[DEVELOPER_SETUP.md](./DEVELOPER_SETUP.md)** - Local development environment setup
- **[DEPLOYMENT_GUIDE.md](./DEPLOYMENT_GUIDE.md)** - Production deployment procedures
- **[TESTING_QUICKSTART.md](./TESTING_QUICKSTART.md)** - Quick guide to running tests
- **[LOCAL_READINESS.md](./LOCAL_READINESS.md)** - Pre-deployment verification checklist

---

## Architecture & Design

System architecture, technical flows, and design decisions.

- **[ARCHITECTURE_SCOPE.md](./ARCHITECTURE_SCOPE.md)** - Overall system architecture scope
- **[CACHE_IMPLEMENTATION.md](./CACHE_IMPLEMENTATION.md)** - Caching strategy and implementation
- **[CI_CD_DEPENDENCY_GRAPH.md](./CI_CD_DEPENDENCY_GRAPH.md)** (33K) - CI/CD workflow dependencies

---

## API Documentation

External API integration specifications and analysis.

### Vendor Specifications

Located in [vendor-specs/](./vendor-specs/):

- **[API_ANALYSIS.md](./vendor-specs/API_ANALYSIS.md)** - External API endpoint analysis
- **[EMAIL_SERVICE_INTEGRATION.md](./vendor-specs/EMAIL_SERVICE_INTEGRATION.md)** - Email service integration guide
- **[SUMMARY.md](./vendor-specs/SUMMARY.md)** - Vendor API summary and requirements

---

## Testing

Test strategies, patterns, resilient testing architecture, and validation results.

### Test Strategies & Results

- **[E2E_TEST_RESULTS.md](./E2E_TEST_RESULTS.md)** - End-to-end test execution results
- **[TEST_VALIDATION_RESULTS_COMPLETE.md](./TEST_VALIDATION_RESULTS_COMPLETE.md)** (19K) - Complete test validation results
- **[MUTATION_TESTING.md](./MUTATION_TESTING.md)** - Mutation testing with Stryker

### Test Optimization & Performance

- **[TEST_OPTIMIZATION.md](./TEST_OPTIMIZATION.md)** - Test suite optimization guide (81% faster execution)
- **[TEST_MIGRATION_GUIDE.md](./TEST_MIGRATION_GUIDE.md)** - Migration guide for optimized test suite
- **[test-performance-analysis.md](./test-performance-analysis.md)** - Test performance bottleneck analysis
- **[VITEST_PROCESS_MANAGEMENT.md](./VITEST_PROCESS_MANAGEMENT.md)** - Vitest process cleanup and management

### Test Patterns & Strategies

Located in [test-patterns/](./test-patterns/):

- **[RESILIENT-API-TESTING-ARCHITECTURE.md](./test-patterns/RESILIENT-API-TESTING-ARCHITECTURE.md)** - Resilient API testing patterns
- **[RESILIENT-API-TESTING-SUMMARY.md](./test-patterns/RESILIENT-API-TESTING-SUMMARY.md)** - API testing summary and results
- **[TESTING-PROBABILISTIC-APIS.md](./TESTING-PROBABILISTIC-APIS.md)** - Non-deterministic API testing guide

### Test Writing & Best Practices (NEW)

- **[TEST_WRITING_GUIDE.md](./TEST_WRITING_GUIDE.md)** - Comprehensive guide for new contributors
- **[PERFORMANCE_TEST_INTERPRETATION.md](./PERFORMANCE_TEST_INTERPRETATION.md)** - Reading and interpreting performance results
- **[CHAOS_TESTING_BEST_PRACTICES.md](./CHAOS_TESTING_BEST_PRACTICES.md)** - Chaos engineering guidelines
- **[TEST_DATA_MANAGEMENT.md](./TEST_DATA_MANAGEMENT.md)** - Test data factory patterns and cleanup
- **[CICD_TEST_TROUBLESHOOTING.md](./CICD_TEST_TROUBLESHOOTING.md)** - Debugging CI/CD test failures

### Performance Testing

- **[PERFORMANCE_TEST_OPTIMIZATION.md](./PERFORMANCE_TEST_OPTIMIZATION.md)** - Performance test configuration and optimization
- **[PERFORMANCE_TEST_USER_SEEDING.md](./PERFORMANCE_TEST_USER_SEEDING.md)** - User seeding strategy for performance tests
- **[RATE_LIMITING_FIX.md](./RATE_LIMITING_FIX.md)** - Rate limiting fix for performance tests

---

## Infrastructure & Operations

Deployment procedures, operational runbooks, and infrastructure guides.

- **[RUNBOOK.md](./RUNBOOK.md)** (72K) - Comprehensive operational runbook
- **[DEPLOYMENT_GUIDE.md](./DEPLOYMENT_GUIDE.md)** - Production deployment procedures

---

## Queue System Documentation

RabbitMQ-based asynchronous message queue system.

- **[MIGRATION_GUIDE.md](./MIGRATION_GUIDE.md)** - Queue integration migration guide

---

## Investigation Reports

Technical analysis and findings.

### Analysis Reports

- **[MONITORING_QUICKSTART.md](./MONITORING_QUICKSTART.md)** - Quick monitoring setup guide

### Implementation Status & Recommendations

- **[FINAL_STATUS.md](./FINAL_STATUS.md)** - Final implementation status report
- **[GITHUB_PAGES_ENHANCEMENT.md](./GITHUB_PAGES_ENHANCEMENT.md)** - GitHub Pages enhancement plan
- **[IMPLEMENTATION_RECOMMENDATIONS.md](./IMPLEMENTATION_RECOMMENDATIONS.md)** - Implementation recommendations and best practices
- **[DRY_BEST_PRACTICES.md](./DRY_BEST_PRACTICES.md)** - DRY principle lessons learned (NEW)

---

## CI/CD & Workflows

Continuous integration, deployment workflows, and pipeline troubleshooting.

### CI/CD Documentation Hub

- **[CI_CD_DOCUMENTATION_INDEX.md](./CI_CD_DOCUMENTATION_INDEX.md)** - CI/CD documentation hub and index
- **[CI_CD_QUICK_REFERENCE.md](./CI_CD_QUICK_REFERENCE.md)** - Quick reference guide for workflows
- **[CI_CD_STRUCTURE.md](./CI_CD_STRUCTURE.md)** (35K) - CI/CD pipeline structure and design

### Workflow Guides & Changes

- **[WORKFLOW_TROUBLESHOOTING_GUIDE.md](./WORKFLOW_TROUBLESHOOTING_GUIDE.md)** - GitHub Actions troubleshooting
- **[WORKFLOW_CONSOLIDATION_GUIDE.md](./WORKFLOW_CONSOLIDATION_GUIDE.md)** - Workflow consolidation into ci-full.yml
- **[WORKFLOW_CHANGE_SUMMARY.md](./WORKFLOW_CHANGE_SUMMARY.md)** - GitHub UI changes after consolidation
- **[DOCUMENTATION_SUMMARY.md](./DOCUMENTATION_SUMMARY.md)** - Workflow consolidation project summary

---

## Monitoring & Metrics

Observability, metrics collection, dashboards, and monitoring setup.

- **[METRICS.md](./METRICS.md)** (78K) - Comprehensive metrics documentation
- **[MONITORING_QUICKSTART.md](./MONITORING_QUICKSTART.md)** - Quick monitoring setup guide

---

## Documentation Standards

All documentation follows these standards:

- **Clear title and purpose statement**
- **Table of contents for files >200 lines**
- **Cross-references to related documentation**
- **Code examples where applicable**
- **Last updated timestamp**

### File Naming Conventions

- **UPPERCASE.md** - Primary documentation (INDEX, README, ARCHITECTURE)
- **kebab-case.md** - Specific topics (test-plan, deployment-guide)
- **CATEGORY_TOPIC.md** - Scoped documentation (QUEUE_ARCHITECTURE, CI_CD_STRUCTURE)

---

## Additional Resources

### Related Directories

- **[plan/](../plan/)** - Project planning, roadmaps, and backlogs
- **[src/](../src/)** - Source code with inline documentation
- **[test/](../test/)** - Test suites and test utilities
- **[.claude/](../.claude/)** - Claude Code hooks and automation
- **[.github/workflows/](../.github/workflows/)** - GitHub Actions workflows

### External Resources

- **[GitHub Pages](https://fairyhunter13.github.io/happy-bday-app/)** - API docs and dashboards
- **API Documentation** - Redoc/Swagger UI (when deployed)
- **Coverage Trends** - Historical code coverage charts
- **Performance Dashboards** - Grafana dashboards (when configured)
