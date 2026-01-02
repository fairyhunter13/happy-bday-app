# Investigation & Testing Documentation Master Index

**Created By**: Queen Collective - SPARC Documenter Agent
**Date**: January 2, 2026
**Purpose**: Central hub for all investigation frameworks and testing documentation

---

## Quick Navigation

### For Investigators
- **[Investigation Framework](./INVESTIGATION_DOCUMENTATION_FRAMEWORK.md)** - Complete framework with templates
- **[Investigation Summary](./INVESTIGATION_SUMMARY.md)** - Executive summary and gap analysis
- This document (Master Index)

### For Developers
- **[Testing Quick Start](./TESTING_QUICKSTART.md)** - TL;DR for running tests
- **[Troubleshooting](./INVESTIGATION_DOCUMENTATION_FRAMEWORK.md#quick-reference-guides)** - Common issues and fixes
- **[Test Structure](./tests/README.md)** - How tests are organized

### For Operations
- **[CI/CD Structure](./CI_CD_STRUCTURE.md)** - Complete workflow documentation
- **[CI/CD Quick Reference](./CI_CD_QUICK_REFERENCE.md)** - Command reference
- **[Performance Analysis](./INVESTIGATION_DOCUMENTATION_FRAMEWORK.md#template-4-performance-test-investigation-report)** - Performance investigation

---

## Documentation Roadmap

### Core Testing Documentation (Existing)

#### Getting Started (Level 1: Entry)
1. **[TESTING_QUICKSTART.md](./TESTING_QUICKSTART.md)** (392 lines)
   - What: TL;DR for developers
   - When: First time running tests
   - Why: Fast feedback loop
   - Time to read: 10 minutes

2. **[tests/README.md](./tests/README.md)** (458 lines)
   - What: Testing infrastructure overview
   - When: Understanding test organization
   - Why: Test structure and patterns
   - Time to read: 15 minutes

3. **[tests/QUICK_START.md](./tests/QUICK_START.md)**
   - What: Quick reference for test commands
   - When: Running tests locally
   - Why: Fast command lookup
   - Time to read: 5 minutes

#### Strategy & Planning (Level 2: Intermediate)
4. **[plan/04-testing/testing-strategy.md](../plan/04-testing/testing-strategy.md)** (100+ lines)
   - What: Testing pyramid and approach
   - When: Planning new tests
   - Why: Understanding test strategy
   - Time to read: 20 minutes

5. **[CI_CD_STRUCTURE.md](./CI_CD_STRUCTURE.md)** (300+ lines)
   - What: Complete CI/CD pipeline documentation
   - When: Understanding workflows
   - Why: Job dependencies and timing
   - Time to read: 30 minutes

#### Advanced Topics (Level 3: Expert)
6. **[TEST_OPTIMIZATION.md](./TEST_OPTIMIZATION.md)**
   - What: Performance optimization techniques
   - When: Improving test speed
   - Why: Faster feedback loop
   - Time to read: 25 minutes

7. **[MUTATION_TESTING.md](./MUTATION_TESTING.md)**
   - What: Test quality evaluation
   - When: Measuring test effectiveness
   - Why: Finding test gaps
   - Time to read: 15 minutes

8. **[plan/04-testing/performance-testing-guide.md](../plan/04-testing/performance-testing-guide.md)**
   - What: Load testing and performance baselines
   - When: Performance investigation
   - Why: Scalability validation
   - Time to read: 20 minutes

### Investigation Documentation (New - This Session)

#### Framework & Templates
1. **[INVESTIGATION_DOCUMENTATION_FRAMEWORK.md](./INVESTIGATION_DOCUMENTATION_FRAMEWORK.md)** (400+ lines)
   - Complete framework for investigations
   - 5 investigation templates (failure/coverage/performance/etc.)
   - Documentation gaps analysis
   - Quality standards and governance
   - Implementation checklist

2. **[INVESTIGATION_SUMMARY.md](./INVESTIGATION_SUMMARY.md)** (300+ lines)
   - Executive summary
   - Documentation inventory
   - Critical gaps with severity
   - Recommended investigation sequence
   - Success metrics

3. **[INVESTIGATION_MASTER_INDEX.md](./INVESTIGATION_MASTER_INDEX.md)** (This file)
   - Navigation hub
   - Documentation roadmap
   - Quick reference
   - File organization

### Specialized Testing Documentation

#### Patterns & Resilience
- **[test-patterns/RESILIENT-API-TESTING-ARCHITECTURE.md](./test-patterns/RESILIENT-API-TESTING-ARCHITECTURE.md)**
  - API resilience patterns
  - Error handling strategies
  - Timeout management

- **[TESTING-PROBABILISTIC-APIS.md](./TESTING-PROBABILISTIC-APIS.md)**
  - Testing non-deterministic APIs
  - Email service integration
  - Probabilistic assertions

#### Domain-Specific Tests
- **[tests/unit/TIMEZONE_TESTS_README.md](./tests/unit/TIMEZONE_TESTS_README.md)**
  - Timezone conversion testing
  - DST handling
  - Edge cases

- **[tests/unit/edge-cases/README.md](./tests/unit/edge-cases/README.md)**
  - Edge case coverage
  - Boundary conditions
  - Comprehensive scenarios

- **[tests/chaos/README.md](./tests/chaos/README.md)**
  - Chaos engineering tests
  - Failure scenarios
  - Resilience validation

- **[tests/performance/README.md](./tests/performance/README.md)**
  - K6 load testing
  - Performance baseline
  - Scaling tests

---

## File Organization

```
docs/
├── INVESTIGATION_DOCUMENTATION_FRAMEWORK.md  ← Start here for investigations
├── INVESTIGATION_SUMMARY.md                   ← Executive summary
├── INVESTIGATION_MASTER_INDEX.md             ← This file
│
├── TESTING_QUICKSTART.md                     ← Developer quick start
├── TESTING_DOCUMENTATION_INDEX.md
├── TEST_OPTIMIZATION.md
├── TEST_MIGRATION_GUIDE.md
├── TEST_VALIDATION_RESULTS.md
│
├── CI_CD_STRUCTURE.md                        ← CI/CD documentation
├── CI_CD_DOCUMENTATION_INDEX.md
├── CI_CD_QUICK_REFERENCE.md
│
├── MUTATION_TESTING.md
├── PERFORMANCE_TEST_OPTIMIZATION.md
├── test-performance-analysis.md
│
├── test-patterns/
│   ├── RESILIENT-API-TESTING-ARCHITECTURE.md
│   └── RESILIENT-API-TESTING-SUMMARY.md
│
├── TESTING-PROBABILISTIC-APIS.md
├── CACHE_IMPLEMENTATION.md
│
├── QUEUE_DOCUMENTATION_INDEX.md              ← Queue system docs
├── QUEUE_*.md (6+ files)
│
└── vendor-specs/
    ├── API_ANALYSIS.md
    └── EMAIL_SERVICE_INTEGRATION.md

tests/
├── README.md                                 ← Testing infrastructure
├── QUICK_START.md
├── AGENT_LIFECYCLE_TESTS.md
├── README_USER_TESTS.md
│
├── unit/
│   ├── TIMEZONE_TESTS_README.md
│   └── edge-cases/
│       └── README.md
│
├── integration/
│   └── (Test files)
│
├── e2e/
│   ├── README.md
│   └── (Test files)
│
├── chaos/
│   └── README.md
│
└── performance/
    └── README.md

plan/04-testing/
├── INDEX.md
├── testing-strategy.md
├── performance-testing-guide.md
├── edge-cases-catalog.md
└── coverage-tracking/
    ├── coverage-trends-design.md
    └── coverage-trends-implementation.md

.github/workflows/
├── ci.yml                  ← Main CI pipeline
├── ci-full.yml
├── unit-tests.yml
├── integration-tests.yml
├── e2e-tests.yml
├── chaos-tests.yml
├── mutation-tests.yml
├── performance.yml
├── performance-smoke-tests.yml
├── performance-load-tests.yml
├── code-quality.yml
├── security.yml
├── sonar.yml
├── docker-build.yml
├── docs.yml
├── openapi-validation.yml
└── cleanup.yml
```

---

## Quick Reference Guide

### Test Commands

```bash
# During Development
npm run test:changed                # Only changed tests
npm run test:watch                  # Watch mode

# Ready to Commit
npm run test:fast                   # All optimized tests (~9 min)
npm run test:unit:optimized         # Unit tests (~5 min)
npm run test:integration:optimized  # Integration tests (~8 min)
npm run test:e2e:optimized          # E2E tests (~10 min)

# Full Testing
npm test                            # All tests (original configs)
npm run test:coverage               # With coverage reporting

# Specific
npx vitest run tests/unit/FILE.test.ts  # Single file
npx vitest run -t "test name"           # By test name

# Performance
npm run perf:k6                  # Sustained load (1M msg/day)
npm run perf:k6:peak             # Peak load (100+ msg/sec)
npm run perf:all                 # All performance tests
```

### Troubleshooting

| Issue | Solution | Reference |
|-------|----------|-----------|
| Port in use | Stop service: `lsof -i :PORT` | TESTING_QUICKSTART.md |
| Docker not running | Start Docker daemon | Docker docs |
| Container won't start | Check logs: `docker logs CONTAINER` | TESTING_QUICKSTART.md |
| Test timeout | Increase timeout or optimize code | Test file |
| Flaky test | Add wait conditions | INVESTIGATION_FRAMEWORK.md |
| Coverage gap | Add test cases | INVESTIGATION_FRAMEWORK.md |
| Slow CI job | Enable parallelization | CI_CD_STRUCTURE.md |

### Documentation Quality Standards

All investigation reports should follow:
- **Structure**: Use provided templates
- **Evidence**: Include error messages and logs
- **Clarity**: Clear, actionable recommendations
- **Completeness**: Root cause and prevention documented
- **Accessibility**: Cross-referenced to related docs

---

## Investigation Types & Templates

### 1. Test Failure Investigation
**Use when**: Test fails unexpectedly
**Template**: [INVESTIGATION_DOCUMENTATION_FRAMEWORK.md - Template 1](./INVESTIGATION_DOCUMENTATION_FRAMEWORK.md#template-1-test-failure-investigation-report)
**Example**: Test timeout, assertion failure, service error
**Owner**: SPARC Debugger Agent

### 2. Coverage Gap Investigation
**Use when**: Coverage drops or gaps found
**Template**: [INVESTIGATION_DOCUMENTATION_FRAMEWORK.md - Template 2](./INVESTIGATION_DOCUMENTATION_FRAMEWORK.md#template-2-test-coverage-gap-analysis-report)
**Example**: Untested code paths, branch coverage gaps
**Owner**: SPARC Analyzer Agent

### 3. CI/CD Workflow Investigation
**Use when**: Workflow fails or performance degrades
**Template**: [INVESTIGATION_DOCUMENTATION_FRAMEWORK.md - Template 3](./INVESTIGATION_DOCUMENTATION_FRAMEWORK.md#template-3-cicd-workflow-investigation-report)
**Example**: Job timeout, step failure, workflow slowdown
**Owner**: SPARC Architect Agent

### 4. Performance Test Investigation
**Use when**: Performance test shows regression
**Template**: [INVESTIGATION_DOCUMENTATION_FRAMEWORK.md - Template 4](./INVESTIGATION_DOCUMENTATION_FRAMEWORK.md#template-4-performance-test-investigation-report)
**Example**: RPS drop, latency increase, error rate spike
**Owner**: SPARC Optimizer Agent

### 5. Test Flakiness Investigation
**Use when**: Test fails intermittently
**Template**: [INVESTIGATION_DOCUMENTATION_FRAMEWORK.md - Template 5](./INVESTIGATION_DOCUMENTATION_FRAMEWORK.md#template-5-test-flakiness-investigation-report)
**Example**: Race condition, timing issue, external service flakiness
**Owner**: SPARC Tester Agent

---

## Documentation Goals

### Short-term (Next 4 Weeks)
- [ ] Fill critical testing gaps
- [ ] Create debugging guide
- [ ] Create flaky test detection guide
- [ ] Create local troubleshooting guide

### Medium-term (Next 8 Weeks)
- [ ] Create coverage analysis guide
- [ ] Create performance analysis guide
- [ ] Build patterns library
- [ ] Document common errors

### Long-term (Next 12 Weeks)
- [ ] Advanced debugging guide
- [ ] CI/CD advanced topics
- [ ] Cross-platform testing guide
- [ ] Knowledge base consolidation

---

## Success Criteria

### Documentation Completeness
- [x] Master index created
- [x] Framework templates created
- [x] Gap analysis completed
- [ ] Phase 1 gaps filled (Debugging guide, etc.)
- [ ] Phase 2 gaps filled (Coverage guide, etc.)
- [ ] Phase 3 gaps filled (Advanced topics)

### Developer Experience
- Reduce test debugging time from 30 min to 10 min
- Achieve <5% flaky test rate
- >95% test pass rate in CI
- Developers reference docs 80% of the time for new issues

### Team Adoption
- All new issues include investigation report
- Templates used for 100% of investigations
- Documentation maintained monthly
- Quarterly comprehensive reviews conducted

---

## Key Contributors

### Documentation Created
- **SPARC Documenter Agent** - Investigation framework, summary, master index

### Expected Contributors
- **SPARC Debugger Agent** - Test failure debugging guide
- **SPARC Tester Agent** - Flaky test detection guide
- **SPARC Analyzer Agent** - Coverage analysis guide
- **SPARC Optimizer Agent** - Performance analysis guide
- **SPARC Architect Agent** - CI/CD advanced topics

---

## How to Use This Document

### For New Investigators
1. Read [INVESTIGATION_SUMMARY.md](./INVESTIGATION_SUMMARY.md) (15 min)
2. Review [INVESTIGATION_DOCUMENTATION_FRAMEWORK.md](./INVESTIGATION_DOCUMENTATION_FRAMEWORK.md) (30 min)
3. Choose appropriate template
4. Follow systematic approach
5. Document findings
6. Update relevant guides

### For Daily Development
1. Start with [TESTING_QUICKSTART.md](./TESTING_QUICKSTART.md)
2. Refer to [Quick Reference](#quick-reference-guide) above
3. Check [tests/README.md](./tests/README.md) for test structure
4. Use troubleshooting matrix for issues
5. Refer to [CI_CD_STRUCTURE.md](./CI_CD_STRUCTURE.md) for CI/CD

### For Management/Review
1. Check [INVESTIGATION_SUMMARY.md](./INVESTIGATION_SUMMARY.md) for overview
2. Review critical gaps section for priorities
3. Check success metrics for progress
4. Review monthly/quarterly reports

---

## Related Resources

### Internal Documentation
- **Queue System**: [QUEUE_DOCUMENTATION_INDEX.md](./QUEUE_DOCUMENTATION_INDEX.md)
- **Architecture**: [ARCHITECTURE_SCOPE.md](./ARCHITECTURE_SCOPE.md)
- **Deployment**: [DEPLOYMENT_GUIDE.md](./DEPLOYMENT_GUIDE.md)
- **Monitoring**: [MONITORING_QUICKSTART.md](./MONITORING_QUICKSTART.md)

### External References
- **Vitest Documentation**: https://vitest.dev/
- **TestContainers**: https://testcontainers.com/
- **K6 Load Testing**: https://k6.io/docs/
- **GitHub Actions**: https://docs.github.com/actions

---

## Document Maintenance

### Updates Required
- Framework: Quarterly review
- Summary: Monthly update with new gaps
- Master Index: Updated with new documents
- Templates: Refined based on usage

### Feedback
Have suggestions for improvements?
- Comment in code files
- Create GitHub issue
- Update documentation directly
- Discuss in team meetings

### Version History

| Date | Change | Owner |
|------|--------|-------|
| 2026-01-02 | Initial framework created | SPARC Documenter |
| TBD | Phase 1 docs completed | SPARC Team |
| TBD | Phase 2 docs completed | SPARC Team |
| TBD | Phase 3 docs completed | SPARC Team |

---

**Last Updated**: January 2, 2026
**Status**: Framework Complete - Implementation Phase Pending
**Next Steps**: Begin Phase 1 implementation (Debugging guide)
**Estimated Completion**: April 2, 2026

---

For questions or clarifications, refer to the detailed documentation files or contact the SPARC Documenter Agent.
