# Resilient API Testing Pattern - Implementation Summary

## Overview

This document summarizes the test patterns and utilities created for handling non-deterministic API behavior, specifically designed for the email service API that has a ~10% random failure rate.

## Problem Statement

The email service at `https://email-service.digitalenvision.com.au` exhibits probabilistic failures (~10% random failure rate). Traditional deterministic testing approaches fail intermittently, making tests flaky and unreliable.

## Solution Architecture

### 1. ResilientApiTester Utility

**Location:** `/tests/helpers/resilient-api-tester.ts`

A comprehensive testing utility that handles:
- Exponential backoff retry logic with jitter
- Statistical assertions (minimum success rate instead of strict pass/fail)
- Detailed failure tracking and metrics
- Configurable retry strategies
- Batch execution support (sequential and parallel)

**Key Features:**
- Automatic retry with configurable backoff
- Success rate tracking and assertions
- Latency monitoring
- Failure logging with detailed error information
- Multiple retry strategy presets

### 2. Enhanced Mock Email Server

**Location:** `/tests/helpers/mock-email-server.ts`

**New Capabilities:**
- `probabilistic-failure` mode: Simulates random failures at configurable rate
- `setProbabilisticFailureRate(rate)`: Configure failure probability (0.0 to 1.0)

**Usage:**
```typescript
mockEmailServer.setResponseMode('probabilistic-failure');
mockEmailServer.setProbabilisticFailureRate(0.1); // 10% failure rate
```

### 3. E2E Test Suite

**Location:** `/tests/e2e/probabilistic-api-resilience.test.ts`

Comprehensive test suite demonstrating:
- Statistical success rate assertions
- Retry mechanism validation
- Circuit breaker integration testing
- Performance and latency testing
- Burst failure handling

## Usage Examples

### Basic Usage

```typescript
import { createResilientTester, RetryPresets } from '../helpers/resilient-api-tester.js';

const tester = createResilientTester(RetryPresets.probabilisticFailure);

// Execute with retry
const result = await tester.executeWithRetry(async () => {
  await apiCall();
});

// Assert minimum success rate
tester.assertMinimumSuccessRate(80);
```

### Batch Testing

```typescript
const users = await createTestUsers(50);
const apiCalls = users.map(user => async () => {
  await messageSender.sendBirthdayMessage(user);
});

const results = await tester.executeBatch(apiCalls, {
  onRetry: (attempt, error) => {
    console.log(`Retry ${attempt}: ${error.message}`);
  },
});

const stats = tester.getStats();
console.log(`Success rate: ${stats.successRate.toFixed(2)}%`);

// Assert expectations
tester.assertMinimumSuccessRate(80);
tester.assertAverageLatency(3000);
```

### Custom Retry Logic

```typescript
const result = await tester.executeWithRetry(
  async () => await apiCall(),
  {
    shouldRetry: (error) => {
      // Only retry transient errors
      return /500|503|timeout/i.test(error.message);
    },
    onRetry: (attempt, error) => {
      metrics.recordRetry(attempt, error);
    },
  }
);
```

## Configuration Presets

### RetryPresets.probabilisticFailure (Recommended)

For APIs with ~10% failure rate:
```typescript
{
  maxRetries: 3,
  baseDelay: 1000,
  maxDelay: 10000,
  factor: 2,
  jitter: true,
}
```

### RetryPresets.highReliability

For critical paths requiring higher success rates:
```typescript
{
  maxRetries: 5,
  baseDelay: 2000,
  maxDelay: 30000,
  factor: 2,
  jitter: true,
}
```

### RetryPresets.fastFail

For quick failure detection:
```typescript
{
  maxRetries: 2,
  baseDelay: 500,
  maxDelay: 2000,
  factor: 2,
  jitter: false,
}
```

## Test Timeout Guidelines

### Calculation Formula

```
timeout = numCalls * (maxRetries + 1) * (maxDelay + avgApiTime) + buffer
```

### Recommended Timeouts

| Scenario | Timeout | Rationale |
|----------|---------|-----------|
| Single API call | 30-60s | 1 call × 4 attempts × ~10s + buffer |
| 50 sequential calls | 90-120s | Most succeed on first attempt |
| 50 parallel calls | 60-90s | Parallel execution saves time |
| Stress test (100+ calls) | 180-300s | High volume requires more time |

### Example

```typescript
it('should handle 50 emails with retries', async () => {
  mockEmailServer.setProbabilisticFailureRate(0.1);

  const tester = createResilientTester();
  const apiCalls = createApiCalls(50);

  await tester.executeBatch(apiCalls);
  tester.assertMinimumSuccessRate(80);
}, 120000); // 2 minute timeout
```

## Assertions

### Success Rate

```typescript
// Minimum 80% success rate (allows for 10% API failures + retries)
tester.assertMinimumSuccessRate(80);

// Higher threshold for critical paths
tester.assertMinimumSuccessRate(95);
```

### Retry Verification

```typescript
// Verify retry mechanism was triggered
tester.assertRetryMechanismUsed();

// Verify retries stayed within limit
tester.assertMaxRetriesNotExceeded();
```

### Performance

```typescript
// Average latency should be acceptable
tester.assertAverageLatency(3000); // Max 3 seconds
```

### Statistics

```typescript
const stats = tester.getStats();

expect(stats.successRate).toBeGreaterThan(80);
expect(stats.averageAttempts).toBeGreaterThan(1); // Retries occurred
expect(stats.failures.length).toBeLessThan(10); // < 20% failures
```

## Mock Server Configuration

### Probabilistic Failures

```typescript
// Simulate 10% failure rate
mockEmailServer.setResponseMode('probabilistic-failure');
mockEmailServer.setProbabilisticFailureRate(0.1);

// Simulate burst failures (50% rate)
mockEmailServer.setProbabilisticFailureRate(0.5);
```

### Fixed Failure Count

```typescript
// Fail first 3 attempts, then succeed
mockEmailServer.setResponseMode('error-500');
mockEmailServer.setErrorCount(3);
```

### Other Modes

```typescript
// Always succeed
mockEmailServer.setResponseMode('success');

// Always fail
mockEmailServer.setResponseMode('error-500');

// Timeout
mockEmailServer.setResponseMode('timeout');

// Rate limit
mockEmailServer.setResponseMode('error-429');
```

## Metrics and Monitoring

### Available Metrics

```typescript
const stats = tester.getStats();

// Core metrics
stats.totalAttempts      // Total API calls executed
stats.successCount       // Successful calls
stats.failureCount       // Failed calls
stats.successRate        // Percentage (0-100)

// Performance metrics
stats.averageAttempts    // Average retries per call
stats.averageLatency     // Average response time (ms)

// Failure details
stats.failures           // Array of failure objects with:
                         // - attemptNumber
                         // - error message
                         // - statusCode
                         // - timestamp
```

### Logging Example

```typescript
console.log('Test Results:', {
  successRate: `${stats.successRate.toFixed(2)}%`,
  averageAttempts: stats.averageAttempts.toFixed(2),
  averageLatency: `${stats.averageLatency.toFixed(2)}ms`,
  failures: stats.failures.length,
});
```

## Circuit Breaker Integration

### Testing Circuit Breaker Behavior

```typescript
// Trigger circuit breaker to open
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

### Verifying Recovery

```typescript
// Reset circuit breaker
messageSender.resetCircuitBreaker();

// Configure API to succeed
mockEmailServer.setResponseMode('success');

// Verify recovery
const result = await tester.executeWithRetry(apiCall);
expect(result.success).toBe(true);

const cbStats = messageSender.getCircuitBreakerStats();
expect(cbStats.state).toBe('closed');
```

## Best Practices

### 1. Use Statistical Assertions

```typescript
// ✅ GOOD
tester.assertMinimumSuccessRate(80);

// ❌ BAD
expect(result.success).toBe(true);
```

### 2. Test with Realistic Volumes

```typescript
// Test with enough samples for statistical significance
const apiCalls = createApiCalls(50); // 50 samples
await tester.executeBatch(apiCalls);
```

### 3. Log Failures for Debugging

```typescript
const stats = tester.getStats();
if (stats.failures.length > 0) {
  console.log('Failures:', stats.failures);
}
```

### 4. Reset State Between Tests

```typescript
beforeEach(() => {
  mockEmailServer.clearRequests();
  mockEmailServer.setResponseMode('success');
  messageSender.resetCircuitBreaker();
  tester.reset();
});
```

### 5. Test Multiple Failure Scenarios

```typescript
// Normal operation (10% failure)
mockEmailServer.setProbabilisticFailureRate(0.1);

// Service degradation (50% failure)
mockEmailServer.setProbabilisticFailureRate(0.5);

// Complete outage (100% failure)
mockEmailServer.setResponseMode('error-500');
mockEmailServer.setErrorCount(100);
```

## Testing Strategy Matrix

| API Behavior | Mock Configuration | Expected Success Rate | Test Timeout |
|--------------|-------------------|---------------------|--------------|
| Normal (10% failure) | `probabilisticFailureRate(0.1)` | >80% | 60-120s |
| Degraded (50% failure) | `probabilisticFailureRate(0.5)` | >90% | 90-180s |
| Outage (100% failure) | `error-500` count=100 | 0% | 30-60s |
| Transient (fail 2x then succeed) | `error-500` count=2 | 100% | 30-60s |
| Rate limited | `error-429` | Varies | 60-120s |

## Files Created

1. **Test Utility:**
   - `/tests/helpers/resilient-api-tester.ts` - Main testing utility

2. **Test Suite:**
   - `/tests/e2e/probabilistic-api-resilience.test.ts` - Comprehensive E2E tests

3. **Documentation:**
   - `/docs/TESTING-PROBABILISTIC-APIS.md` - Complete usage guide
   - `/docs/test-patterns/RESILIENT-API-TESTING-SUMMARY.md` - This summary

4. **Enhanced Mock Server:**
   - `/tests/helpers/mock-email-server.ts` - Added probabilistic failure mode

## Quick Start

```typescript
import { createResilientTester, RetryPresets } from '../helpers/resilient-api-tester.js';

describe('Email API resilience', () => {
  let tester: ResilientApiTester;

  beforeEach(() => {
    mockEmailServer.setResponseMode('probabilistic-failure');
    mockEmailServer.setProbabilisticFailureRate(0.1);
    tester = createResilientTester(RetryPresets.probabilisticFailure);
  });

  it('should handle 10% failure rate', async () => {
    const apiCalls = Array.from({ length: 50 }, () => async () => {
      await messageSender.sendBirthdayMessage(user);
    });

    await tester.executeBatch(apiCalls);

    const stats = tester.getStats();
    console.log(`Success rate: ${stats.successRate.toFixed(2)}%`);

    tester.assertMinimumSuccessRate(80);
  }, 120000);
});
```

## References

- [Resilient API Tester Source](/tests/helpers/resilient-api-tester.ts)
- [E2E Test Examples](/tests/e2e/probabilistic-api-resilience.test.ts)
- [Complete Usage Guide](/docs/TESTING-PROBABILISTIC-APIS.md)
- [Email Service Client](/src/clients/email-service.client.ts)
- [Retry Logic Tests](/tests/unit/edge-cases/retry-logic.test.ts)
- [Circuit Breaker Tests](/tests/unit/edge-cases/circuit-breaker.test.ts)
