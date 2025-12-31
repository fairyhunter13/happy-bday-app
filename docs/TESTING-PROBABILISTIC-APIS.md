# Testing Probabilistic APIs

Guide for testing APIs with non-deterministic behavior (e.g., 10% random failure rate).

## Overview

The email service at `https://email-service.digitalenvision.com.au` has a ~10% random failure rate. Traditional deterministic testing approaches (strict pass/fail) don't work well with probabilistic APIs. This guide explains our approach for resilient E2E testing.

## Test Strategy

### 1. Statistical Assertions Instead of Strict Pass/Fail

```typescript
// ❌ BAD: Strict assertion (will fail ~10% of the time)
const result = await sendEmail(user);
expect(result.success).toBe(true);

// ✅ GOOD: Statistical assertion with acceptable failure rate
const tester = createResilientTester();
await tester.executeBatch(apiCalls);
tester.assertMinimumSuccessRate(80); // Allows for expected 10% failures
```

### 2. Retry Logic with Exponential Backoff

```typescript
const tester = createResilientTester({
  maxRetries: 3,
  baseDelay: 1000,    // 1 second
  maxDelay: 10000,    // 10 seconds
  factor: 2,          // Exponential backoff
  jitter: true,       // Add randomness to prevent thundering herd
});

const result = await tester.executeWithRetry(async () => {
  await messageSender.sendBirthdayMessage(user);
});
```

### 3. Detailed Failure Tracking

```typescript
const stats = tester.getStats();

console.log({
  totalAttempts: stats.totalAttempts,
  successCount: stats.successCount,
  failureCount: stats.failureCount,
  successRate: `${stats.successRate.toFixed(2)}%`,
  averageAttempts: stats.averageAttempts,
  averageLatency: `${stats.averageLatency.toFixed(2)}ms`,
  failures: stats.failures, // Detailed failure information
});
```

## Test Utility: ResilientApiTester

### Basic Usage

```typescript
import { createResilientTester, RetryPresets } from '../helpers/resilient-api-tester.js';

// Create tester with default configuration
const tester = createResilientTester();

// Execute single API call with retry
const result = await tester.executeWithRetry(async () => {
  await apiCall();
});

if (result.success) {
  console.log('Success after', result.attemptNumber, 'attempts');
} else {
  console.log('Failed after', result.attemptNumber, 'attempts:', result.error);
}
```

### Batch Execution

```typescript
// Execute multiple API calls
const apiCalls = users.map(user => async () => {
  await messageSender.sendBirthdayMessage(user);
});

// Sequential execution (default)
const results = await tester.executeBatch(apiCalls);

// Parallel execution
const results = await tester.executeBatch(apiCalls, { parallel: true });

// Assert minimum success rate
tester.assertMinimumSuccessRate(80);
```

### Configuration Presets

```typescript
import { RetryPresets } from '../helpers/resilient-api-tester.js';

// For APIs with ~10% failure rate (recommended)
const tester = createResilientTester(RetryPresets.probabilisticFailure);

// For high-reliability requirements (more retries)
const tester = createResilientTester(RetryPresets.highReliability);

// For fast-failing tests (fewer retries, shorter delays)
const tester = createResilientTester(RetryPresets.fastFail);

// For rate-limited APIs (longer delays)
const tester = createResilientTester(RetryPresets.rateLimited);
```

### Custom Configuration

```typescript
const tester = createResilientTester({
  maxRetries: 5,      // Maximum number of retries
  baseDelay: 2000,    // Base delay in milliseconds
  maxDelay: 30000,    // Maximum delay (cap for exponential backoff)
  factor: 2,          // Exponential backoff factor (delay = baseDelay * factor^attempt)
  jitter: true,       // Add randomness to delays
});
```

### Custom Retry Logic

```typescript
const result = await tester.executeWithRetry(
  async () => {
    await apiCall();
  },
  {
    // Custom retry predicate
    shouldRetry: (error) => {
      // Only retry on specific errors
      return /500|503|timeout/i.test(error.message);
    },

    // Retry callback for logging/monitoring
    onRetry: (attemptNumber, error) => {
      console.log(`Retry #${attemptNumber}: ${error.message}`);
      metrics.recordRetry(attemptNumber);
    },
  }
);
```

## Test Timeout Configuration

### Calculating Appropriate Timeouts

For tests using retry logic, timeouts must account for:
1. Number of API calls
2. Maximum retries per call
3. Backoff delays between retries
4. API response time

#### Formula

```
timeout = numCalls * (maxRetries + 1) * (maxDelay + avgApiResponseTime) + buffer
```

#### Examples

**Single API call with 3 retries:**
```typescript
it('should retry failed email', async () => {
  // 1 call * (3 retries + 1 initial) * (10s max delay + 1s API) + 5s buffer = 49s
  const result = await tester.executeWithRetry(apiCall);
  expect(result.success).toBe(true);
}, 50000); // 50 second timeout
```

**Batch of 50 API calls (sequential):**
```typescript
it('should handle 50 emails', async () => {
  // 50 calls * (3 retries + 1) * (10s + 1s) + 10s = 2,210s
  // But with 80% success rate, most won't need retries
  // Realistic: ~60s + buffer
  await tester.executeBatch(apiCalls);
  tester.assertMinimumSuccessRate(80);
}, 90000); // 90 second timeout (includes buffer for retries)
```

**Batch with parallel execution:**
```typescript
it('should handle parallel execution', async () => {
  // Parallel execution: timeout based on slowest request, not sum
  // (3 retries + 1) * (10s + 1s) + buffer = 54s
  await tester.executeBatch(apiCalls, { parallel: true });
}, 60000); // 60 second timeout
```

### Vitest Timeout Configuration

#### Per-Test Timeouts

```typescript
// Individual test timeout
it('should handle slow API', async () => {
  // Test code
}, 120000); // 2 minute timeout
```

#### Suite-Level Timeouts

```typescript
describe('Slow API tests', () => {
  // Set timeout for all tests in this suite
  beforeAll(() => {
    vi.setConfig({ testTimeout: 120000 });
  });

  it('test 1', async () => { /* ... */ });
  it('test 2', async () => { /* ... */ });
});
```

#### Global Timeout Configuration

In `vitest.config.ts`:

```typescript
export default defineConfig({
  test: {
    testTimeout: 60000,  // Default 1 minute for all tests
    hookTimeout: 60000,  // Timeout for beforeAll/afterAll hooks
  },
});
```

### Recommended Timeouts by Test Type

| Test Type | Timeout | Rationale |
|-----------|---------|-----------|
| Unit tests (mocked APIs) | 5-10s | No actual API calls |
| Integration tests (real APIs, no retries) | 30-60s | Single API call |
| E2E tests (with retries, sequential) | 60-120s | Multiple calls with retries |
| E2E tests (with retries, parallel) | 60-90s | Parallel execution |
| Stress tests (many API calls) | 180-300s | High volume testing |

## Assertions

### Success Rate Assertions

```typescript
// Minimum success rate (allows expected failures)
tester.assertMinimumSuccessRate(80);

// Custom message
tester.assertMinimumSuccessRate(
  90,
  'Critical path should have >90% success rate'
);
```

### Retry Mechanism Assertions

```typescript
// Verify retry mechanism was actually triggered
tester.assertRetryMechanismUsed();

// Verify retries didn't exceed maximum
tester.assertMaxRetriesNotExceeded();
```

### Latency Assertions

```typescript
// Assert average latency is acceptable
tester.assertAverageLatency(3000); // Max 3 seconds average
```

### Circuit Breaker Verification

```typescript
// Verify circuit breaker opened under high failure rate
mockEmailServer.setResponseMode('error-500');
mockEmailServer.setErrorCount(100);

for (const user of users) {
  try {
    await messageSender.sendBirthdayMessage(user);
  } catch (error) {
    // Expected
  }

  const cbStats = messageSender.getCircuitBreakerStats();
  if (cbStats.isOpen) {
    expect(cbStats.state).toBe('open');
    break;
  }
}
```

## Mock Email Server Configuration

### Probabilistic Failure Mode

```typescript
// Simulate 10% random failure rate
mockEmailServer.setResponseMode('probabilistic-failure');
mockEmailServer.setProbabilisticFailureRate(0.1);

// Simulate 50% failure rate (burst failures)
mockEmailServer.setProbabilisticFailureRate(0.5);
```

### Fixed Failure Count

```typescript
// Fail first N requests, then succeed
mockEmailServer.setResponseMode('error-500');
mockEmailServer.setErrorCount(3);

// Next 3 calls will fail, then succeed
```

### Response Mode Options

```typescript
// Always succeed
mockEmailServer.setResponseMode('success');

// Always fail with 500
mockEmailServer.setResponseMode('error-500');

// Timeout errors
mockEmailServer.setResponseMode('timeout');

// Rate limit (429)
mockEmailServer.setResponseMode('error-429');

// Bad request (400)
mockEmailServer.setResponseMode('error-400');

// Probabilistic failures
mockEmailServer.setResponseMode('probabilistic-failure');
mockEmailServer.setProbabilisticFailureRate(0.1); // 10% failure rate
```

## Best Practices

### 1. Use Statistical Assertions

```typescript
// Run multiple attempts to gather statistics
const tester = createResilientTester();
await tester.executeBatch(Array.from({ length: 50 }, () => apiCall));

// Assert based on aggregate success rate
tester.assertMinimumSuccessRate(80);
```

### 2. Log Failures for Debugging

```typescript
const result = await tester.executeWithRetry(
  apiCall,
  {
    onRetry: (attempt, error) => {
      console.log(`Retry ${attempt}: ${error.message}`);
    },
  }
);

// After test, examine failures
const stats = tester.getStats();
if (stats.failures.length > 0) {
  console.log('Failures occurred:', stats.failures);
}
```

### 3. Verify Retry Logic Works

```typescript
// Test specifically that retry logic is being used
mockEmailServer.setResponseMode('error-500');
mockEmailServer.setErrorCount(2); // Fail twice, then succeed

const result = await tester.executeWithRetry(apiCall);

expect(result.success).toBe(true);
expect(result.attemptNumber).toBe(3); // Verify it took 3 attempts
```

### 4. Test Circuit Breaker Behavior

```typescript
// Verify circuit breaker opens on sustained failures
mockEmailServer.setResponseMode('error-500');
mockEmailServer.setErrorCount(100);

const tester = createResilientTester(RetryPresets.fastFail);

for (let i = 0; i < 20; i++) {
  try {
    await tester.executeWithRetry(apiCall);
  } catch (error) {
    // Expected
  }

  const cbStats = messageSender.getCircuitBreakerStats();
  if (cbStats.isOpen) {
    console.log('Circuit opened after', cbStats.failures, 'failures');
    break;
  }
}
```

### 5. Reset State Between Tests

```typescript
beforeEach(async () => {
  // Reset database and queues
  await cleanDatabase(pool);
  await purgeQueues(amqpConnection, ['birthday-queue', 'dlq']);

  // Reset mock server
  mockEmailServer.clearRequests();
  mockEmailServer.setResponseMode('success');

  // Reset circuit breaker
  messageSender.resetCircuitBreaker();

  // Reset tester statistics
  tester.reset();
});
```

### 6. Test Different Failure Scenarios

```typescript
// Scenario 1: Low failure rate (typical operation)
mockEmailServer.setProbabilisticFailureRate(0.1);
await testWithTester(RetryPresets.probabilisticFailure);

// Scenario 2: High failure rate (service degradation)
mockEmailServer.setProbabilisticFailureRate(0.5);
await testWithTester(RetryPresets.highReliability);

// Scenario 3: Complete outage
mockEmailServer.setResponseMode('error-500');
mockEmailServer.setErrorCount(100);
// Expect all to fail, verify proper error handling
```

## Example: Complete Test

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { createResilientTester, RetryPresets } from '../helpers/resilient-api-tester.js';

describe('Email sending with probabilistic failures', () => {
  let tester: ResilientApiTester;

  beforeEach(() => {
    // Reset for each test
    mockEmailServer.clearRequests();
    tester = createResilientTester(RetryPresets.probabilisticFailure);
  });

  it('should achieve 80% success rate with 10% API failure rate', async () => {
    // Configure probabilistic failures
    mockEmailServer.setResponseMode('probabilistic-failure');
    mockEmailServer.setProbabilisticFailureRate(0.1);

    // Create test data
    const users = await createTestUsers(50);
    const apiCalls = users.map(user => async () => {
      await messageSender.sendBirthdayMessage(user);
    });

    // Execute with retry logic
    const results = await tester.executeBatch(apiCalls, {
      onRetry: (attempt, error) => {
        console.log(`Retry attempt ${attempt}: ${error.message}`);
      },
    });

    // Get statistics
    const stats = tester.getStats();
    console.log('Test results:', {
      successRate: `${stats.successRate.toFixed(2)}%`,
      averageAttempts: stats.averageAttempts.toFixed(2),
      averageLatency: `${stats.averageLatency.toFixed(2)}ms`,
    });

    // Assertions
    tester.assertMinimumSuccessRate(80);
    tester.assertAverageLatency(5000);

    // Verify retry logic was used
    expect(stats.averageAttempts).toBeGreaterThan(1);

    // Most should succeed
    const successful = results.filter(r => r.success);
    expect(successful.length).toBeGreaterThan(40);
  }, 120000); // 2 minute timeout for 50 API calls with retries
});
```

## Troubleshooting

### Test Timeouts

**Problem:** Tests timing out frequently.

**Solutions:**
1. Increase test timeout
2. Reduce number of API calls in test
3. Use parallel execution for independent calls
4. Check if retry delays are too aggressive

### Flaky Tests

**Problem:** Tests pass sometimes, fail other times.

**Solutions:**
1. Use statistical assertions instead of strict pass/fail
2. Increase sample size (more API calls)
3. Adjust minimum success rate threshold
4. Add retry logging to identify patterns

### Circuit Breaker Not Opening

**Problem:** Circuit breaker doesn't open when expected.

**Solutions:**
1. Check failure threshold configuration
2. Verify enough failures are occurring
3. Check if circuit breaker is being reset between tests
4. Review circuit breaker timeout settings

### Unexpected Success Rates

**Problem:** Success rate lower than expected.

**Solutions:**
1. Check mock server configuration
2. Verify retry logic is working (check attempt counts)
3. Review error logs for unexpected error types
4. Check if non-retriable errors are being retried

## References

- [Resilient API Tester Source](/tests/helpers/resilient-api-tester.ts)
- [E2E Test Examples](/tests/e2e/probabilistic-api-resilience.test.ts)
- [Email Service Client](/src/clients/email-service.client.ts)
- [Circuit Breaker Tests](/tests/unit/edge-cases/circuit-breaker.test.ts)
- [Retry Logic Tests](/tests/unit/edge-cases/retry-logic.test.ts)
