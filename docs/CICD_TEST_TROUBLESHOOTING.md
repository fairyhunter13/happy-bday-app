# CI/CD Test Troubleshooting Guide

**Last Updated:** 2026-01-04
**Purpose:** Diagnose and fix CI/CD test failures

## Quick Diagnosis

### Step 1: Identify Failing Job
```bash
gh run list --limit 5
gh run view <run-id>
```

### Step 2: Check Logs
```bash
gh run view <run-id> --log-failed
```

### Step 3: Reproduce Locally
```bash
npm run test:unit
npm run test:integration
npm run test:e2e
```

## Common Failures

### 1. TestContainer Timeout

**Error:**
```
Error: Test container failed to start within timeout
```

**Causes:**
- Docker not running
- Container image pull failure
- Insufficient resources in CI

**Fix:**
```yaml
# Increase timeout in CI
- name: Run integration tests
  run: npm run test:integration
  timeout-minutes: 15 # Increase from 10
```

### 2. Database Connection Failures

**Error:**
```
DatabaseError: Connection timeout
ECONNREFUSED 127.0.0.1:5432
```

**Causes:**
- PostgreSQL not started
- Wrong connection string
- Port conflict

**Fix:**
```typescript
// Use correct connection in CI
const connectionString = process.env.CI
  ? process.env.DATABASE_URL
  : testContainer.connectionString;
```

### 3. RabbitMQ Not Ready

**Error:**
```
Error: Channel closed
AMQP connection failed
```

**Causes:**
- Queue not fully started
- Health check passed too early

**Fix:**
```typescript
// Wait for RabbitMQ readiness
await waitFor(
  () => checkRabbitMQHealth(connection),
  30000 // 30 second timeout
);
```

### 4. Flaky Tests (Intermittent Failures)

**Error:**
```
✓ Test passed locally
✗ Test failed in CI (sometimes)
```

**Causes:**
- Race conditions
- Timing dependencies
- Shared state

**Fix:**
```typescript
// ❌ BAD: Hardcoded delay
await new Promise(resolve => setTimeout(resolve, 1000));

// ✅ GOOD: Wait for condition
await waitFor(() => Promise.resolve(condition), 5000);
```

### 5. Out of Memory

**Error:**
```
FATAL ERROR: Reached heap limit
JavaScript heap out of memory
```

**Causes:**
- Memory leaks
- Too many parallel tests
- Large test datasets

**Fix:**
```yaml
# Reduce parallel tests in CI
- name: Run tests
  run: npm run test:unit -- --maxThreads=2
  env:
    NODE_OPTIONS: --max-old-space-size=4096
```

### 6. Coverage Threshold Failures

**Error:**
```
ERROR: Coverage for statements (79%) does not meet threshold (80%)
```

**Causes:**
- New code not tested
- Excluded files changed
- Test deleted

**Fix:**
```bash
# Run coverage locally
npm run test:coverage

# Check which files lack coverage
open coverage/index.html
```

### 7. Permissions Errors (git push)

**Error:**
```
remote: Permission denied
fatal: unable to access repository
```

**Causes:**
- Missing `contents: write` permission
- Token expired
- Protected branch rules

**Fix:**
```yaml
jobs:
  my-job:
    permissions:
      contents: write # Add this
```

## Debugging Workflow

### Local Reproduction

```bash
# 1. Match CI environment
export CI=true
export NODE_ENV=test

# 2. Run exact command from workflow
npm run test:unit -- --reporter=verbose

# 3. Check for environment differences
env | grep -E '(CI|NODE|DATABASE|RABBITMQ)'
```

### CI-Specific Debugging

```yaml
# Add debug logging
- name: Debug environment
  run: |
    echo "Node version: $(node --version)"
    echo "NPM version: $(npm --version)"
    docker ps
    netstat -an | grep LISTEN
```

### Test Isolation

```bash
# Run single test file
npm run test:unit -- tests/unit/specific.test.ts

# Run specific test
npm run test:unit -- -t "test name"

# Run with debug output
DEBUG=* npm run test:unit
```

## Prevention Strategies

### 1. Stable Tests
- Use `waitFor()` instead of `setTimeout()`
- Clean database between tests
- Generate unique test data
- Avoid shared state

### 2. Resource Management
- Limit parallel threads in CI
- Close connections in `afterAll()`
- Use proper timeouts
- Monitor memory usage

### 3. CI Optimization
- Cache dependencies
- Use matrix testing sparingly
- Skip unnecessary jobs
- Optimize Docker images

### 4. Error Visibility
- Remove error suppression (`|| true`)
- Add meaningful test names
- Log failures with context
- Use proper assertions

## Workflow-Specific Issues

### Unit Tests Job
- **Fast:** < 30 seconds
- **No external dependencies**
- **Common issue:** Import errors, mock failures

### Integration Tests Job
- **Medium:** 1-3 minutes
- **Real PostgreSQL, RabbitMQ**
- **Common issue:** Container startup, connection timeouts

### E2E Tests Job
- **Slow:** 2-5 minutes
- **Full stack running**
- **Common issue:** API timeouts, race conditions

### Performance Tests Job
- **Variable:** 5-10 minutes
- **Large datasets, sustained load**
- **Common issue:** Resource exhaustion, timeouts

## Emergency Fixes

### Skip Failing Job Temporarily

```yaml
# Add condition to skip job (temporary!)
if: false # TODO: Fix and remove
```

**⚠️ WARNING:** Always create issue to track fix

### Rerun Failed Jobs

```bash
# Rerun only failed jobs
gh run rerun <run-id> --failed
```

### Cancel Stuck Runs

```bash
# Cancel running workflow
gh run cancel <run-id>
```

## Best Practices

✅ Fix root cause, don't suppress errors
✅ Add retries for external service calls
✅ Use health checks before running tests
✅ Monitor test execution times
✅ Keep tests deterministic

❌ Use `|| true` to hide failures
❌ Increase timeouts without investigating
❌ Skip tests instead of fixing them
❌ Ignore intermittent failures
❌ Run tests without cleanup

---

**Related:**
- [TEST_WRITING_GUIDE.md](./TEST_WRITING_GUIDE.md)
- [WORKFLOW_TROUBLESHOOTING_GUIDE.md](./WORKFLOW_TROUBLESHOOTING_GUIDE.md)
- [CI_CD_STRUCTURE.md](./CI_CD_STRUCTURE.md)
