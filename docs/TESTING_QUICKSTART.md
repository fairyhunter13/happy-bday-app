# Testing Quick Start Guide

## TL;DR

```bash
# Fastest way to run all tests (< 10 minutes)
npm run test:fast

# Run only tests affected by your changes
npm run test:changed

# Run specific test suites (optimized)
npm run test:unit:optimized
npm run test:integration:optimized
npm run test:e2e:optimized
```

## Test Commands Reference

### Development Workflow

```bash
# 1. Fast feedback - run tests for changed files only
npm run test:changed

# 2. Run all tests quickly before committing
npm run test:fast

# 3. Run specific test type
npm run test:unit:optimized
npm run test:integration:optimized
npm run test:e2e:optimized
```

### Full Test Suite

```bash
# All tests (original, slower)
npm test

# Individual suites (original)
npm run test:unit
npm run test:integration
npm run test:e2e
npm run test:chaos
```

### Coverage

```bash
# Unit test coverage (enforced)
npm run test:coverage:unit

# All coverage
npm run test:coverage:all
```

### Performance Testing

```bash
# Performance baseline tests
npm run test:performance

# K6 load tests
npm run perf:k6:api
npm run perf:k6:scheduler
npm run perf:all
```

## Execution Time Comparison

| Command | Time (Before) | Time (After) | Improvement |
|---------|---------------|--------------|-------------|
| `npm run test:fast` | ~48 min | **~9 min** | **81% faster** |
| `npm run test:unit:optimized` | ~8 min | **~5 min** | **38% faster** |
| `npm run test:integration:optimized` | ~15 min | **~8 min** | **47% faster** |
| `npm run test:e2e:optimized` | ~20 min | **~10 min** | **50% faster** |
| `npm run test:changed` | N/A | **~1-3 min** | **95% faster** |

## What's Different?

### Optimized Tests
- ✅ Parallel execution
- ✅ Container caching
- ✅ Faster timeouts
- ✅ Minimal reporting
- ✅ Smart retry logic
- ✅ Early bail on failures

### Original Tests
- Sequential execution
- Fresh containers per file
- Conservative timeouts
- Verbose reporting
- No retries
- Run all tests regardless

## When to Use What

### During Development

```bash
# Quick feedback loop (recommended)
npm run test:changed

# Before commit
npm run test:fast
```

### Before Push

```bash
# Full optimized suite
npm run test:fast

# With coverage
npm run test:coverage:unit
```

### CI/CD

```bash
# Optimized CI workflow
.github/workflows/ci-optimized.yml

# Or in existing CI
npm run test:fast
```

### Debugging

```bash
# Original configs with verbose output
npm run test:e2e -- --reporter=verbose

# Single test file
npx vitest run tests/e2e/birthday-flow.test.ts
```

## Prerequisites

### Local Development

```bash
# Install dependencies
npm install

# Start test services (optional - TestContainers auto-starts)
npm run docker:test
```

### CI/CD

Required GitHub Secrets:
- `SOPS_AGE_KEY` - Decrypt test environment files
- `CODECOV_TOKEN` - Upload coverage reports

## Test Structure

```
tests/
├── unit/                    # 37 files - Fast, isolated tests
│   ├── services/           # Business logic tests
│   ├── controllers/        # API controller tests
│   └── edge-cases/         # Edge case coverage
├── integration/            # 12 files - Component integration
│   ├── database/           # Database integration
│   ├── queue/              # RabbitMQ integration
│   └── api/                # API endpoint tests
├── e2e/                    # 8 files - Full system tests
│   ├── birthday-flow.test.ts
│   ├── user-lifecycle.test.ts
│   └── concurrent-messages.test.ts
├── chaos/                  # 3 files - Resilience tests
│   ├── database-chaos.test.ts
│   └── rabbitmq-chaos.test.ts
├── performance/            # Performance benchmarks
│   └── performance-baseline.test.ts
└── helpers/                # Test utilities
    ├── testcontainers-optimized.ts  # ✨ Use this
    └── testcontainers.ts            # Original
```

## Environment Setup

### Automatic (Recommended)

TestContainers automatically starts:
- PostgreSQL 15
- RabbitMQ 3.12
- Redis 7

```bash
# Just run tests - containers auto-start
npm run test:fast
```

### Manual (Docker Compose)

```bash
# Start services
npm run docker:test

# Run tests
npm run test:fast

# Cleanup
npm run docker:test:down
```

## Configuration Files

### Optimized Configs (Recommended)

- `vitest.config.e2e-optimized.ts` - E2E tests (parallel, 90s timeout)
- `vitest.config.integration-optimized.ts` - Integration (2-4 threads)
- `vitest.config.performance.ts` - Performance tests
- `vitest.config.cache.ts` - Test caching

### Original Configs

- `vitest.config.unit.ts` - Unit tests
- `vitest.config.integration.ts` - Integration (sequential in CI)
- `vitest.config.e2e.ts` - E2E (sequential)
- `vitest.config.chaos.ts` - Chaos tests

## Tips & Tricks

### 1. Fast Feedback Loop

```bash
# Only run tests for changed files
npm run test:changed

# Watch mode
npm run test:watch
```

### 2. Debug Specific Tests

```bash
# Run single test file
npx vitest run tests/e2e/birthday-flow.test.ts

# Run specific test
npx vitest run -t "should schedule birthday message"
```

### 3. Visual Test UI

```bash
# Interactive test UI
npm run test:ui
```

### 4. Performance Monitoring

```bash
# Track slow tests
npx vitest run --reporter=verbose | grep "took"

# Generate performance report
npm run perf:report
```

### 5. Clean State

```bash
# Clear cached containers
docker ps -a | grep test | awk '{print $1}' | xargs docker rm -f

# Clear test cache
rm -rf node_modules/.vitest
```

## Troubleshooting

### Tests are slow

```bash
# Use optimized configs
npm run test:fast

# Clear container cache
docker system prune -f
```

### Container connection errors

```bash
# Reduce parallelism
# Edit vitest.config.e2e-optimized.ts
maxConcurrency: 1  # Reduce from 2
```

### Tests timeout

```bash
# Increase timeout for specific test
it('slow test', async () => {
  // ...
}, 120000);  // 2 minutes
```

### Port conflicts

```bash
# Stop running services
npm run docker:test:down

# Check ports
lsof -i :5432  # PostgreSQL
lsof -i :5672  # RabbitMQ
```

## Best Practices

### ✅ Do

- Use `npm run test:changed` during development
- Run `npm run test:fast` before push
- Keep tests isolated and independent
- Clean up resources in `afterAll`
- Use optimized helpers for better performance

### ❌ Don't

- Don't commit without running tests
- Don't skip flaky tests - fix them
- Don't share state between tests
- Don't hardcode timeouts - use test-level overrides
- Don't ignore test warnings

## Coverage Requirements

### Unit Tests (Enforced)

```
lines:      80%
functions:  50%
branches:   75%
statements: 80%
```

### Integration/E2E Tests

No coverage requirements - focus on flow correctness.

## Performance Targets

| Metric | Target | Alert Threshold |
|--------|--------|----------------|
| Total test time | < 10 min | > 12 min |
| E2E time | < 10 min | > 12 min |
| Integration time | < 8 min | > 10 min |
| Unit time | < 5 min | > 7 min |

## Next Steps

1. **Run tests:**
   ```bash
   npm run test:fast
   ```

2. **Read detailed docs:**
   - [TEST_OPTIMIZATION.md](./TEST_OPTIMIZATION.md) - Optimization details
   - [TEST_MIGRATION_GUIDE.md](./TEST_MIGRATION_GUIDE.md) - Migration steps

3. **Update your workflow:**
   - Use `test:changed` during development
   - Use `test:fast` before commits
   - Monitor execution times

## Resources

- [Vitest Documentation](https://vitest.dev)
- [TestContainers Documentation](https://www.testcontainers.org)
- [K6 Performance Testing](https://k6.io/docs/)

## Support

Issues or questions:
1. Check [Troubleshooting](#troubleshooting)
2. Review [TEST_OPTIMIZATION.md](./TEST_OPTIMIZATION.md)
3. Open GitHub issue with logs

---

**Happy Testing! 🚀**

Remember: Fast tests = Happy developers = Better software
