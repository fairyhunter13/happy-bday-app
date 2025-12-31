# Resilient API Testing Architecture

## System Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                     E2E Test Suite                               │
│                                                                   │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │  Test: Probabilistic API Resilience                        │ │
│  │                                                             │ │
│  │  1. Configure Mock Server                                  │ │
│  │     mockServer.setResponseMode('probabilistic-failure')    │ │
│  │     mockServer.setProbabilisticFailureRate(0.1)  // 10%    │ │
│  │                                                             │ │
│  │  2. Create ResilientApiTester                              │ │
│  │     tester = createResilientTester({                       │ │
│  │       maxRetries: 3,                                       │ │
│  │       baseDelay: 1000,                                     │ │
│  │       factor: 2,                                           │ │
│  │       jitter: true                                         │ │
│  │     })                                                     │ │
│  │                                                             │ │
│  │  3. Execute API Calls                                      │ │
│  │     results = await tester.executeBatch(apiCalls)          │ │
│  │                                                             │ │
│  │  4. Assert Success Rate                                    │ │
│  │     tester.assertMinimumSuccessRate(80)                    │ │
│  └────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                  ResilientApiTester                              │
│                                                                   │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │  executeWithRetry()                                        │ │
│  │                                                             │ │
│  │  for attempt in 0..maxRetries:                             │ │
│  │    try:                                                    │ │
│  │      result = await apiCall()                              │ │
│  │      recordSuccess(attempt)                                │ │
│  │      return result                                         │ │
│  │    catch error:                                            │ │
│  │      if !shouldRetry(error) or attempt == maxRetries:     │ │
│  │        recordFailure(attempt, error)                       │ │
│  │        return failure                                      │ │
│  │      delay = calculateBackoff(attempt)  // Exponential    │ │
│  │      await sleep(delay)                                    │ │
│  │      onRetry(attempt, error)                               │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                   │
│  Stats Tracking:                                                 │
│  • totalAttempts, successCount, failureCount                     │
│  • successRate, averageAttempts, averageLatency                  │
│  • failures[] with detailed error information                    │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│              Application Layer (Under Test)                      │
│                                                                   │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │  MessageSenderService                                      │ │
│  │    │                                                       │ │
│  │    ▼                                                       │ │
│  │  EmailServiceClient                                        │ │
│  │    • Circuit Breaker (Opossum)                             │ │
│  │    • Retry Logic (exponential backoff)                     │ │
│  │    • Error Mapping                                         │ │
│  │    • Metrics Integration                                   │ │
│  └────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                  Mock Email Server                               │
│                                                                   │
│  Modes:                                                          │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │ probabilistic-failure:                                     │ │
│  │   if Math.random() < failureRate:                          │ │
│  │     return 500 error                                       │ │
│  │   else:                                                    │ │
│  │     return success                                         │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                   │
│  Other Modes:                                                    │
│  • success - Always succeed                                      │
│  • error-500 - Always fail (or N times then succeed)             │
│  • error-429 - Rate limit errors                                 │
│  • timeout - Simulate timeouts                                   │
└─────────────────────────────────────────────────────────────────┘
```

## Retry Flow Diagram

```
API Call Attempt 1
│
├─ Success? ──► Record Success ──► Return Result
│
└─ Failure
   │
   ├─ Non-retriable (4xx)? ──► Record Failure ──► Return Error
   │
   └─ Retriable (5xx, timeout, etc.)
      │
      └─ Attempt < maxRetries?
         │
         ├─ No ──► Record Failure ──► Return Error
         │
         └─ Yes
            │
            └─ Calculate Backoff
               │ Delay = baseDelay × factor^attempt
               │ Delay = min(Delay, maxDelay)
               │ Delay += jitter (if enabled)
               │
               └─ Wait (Delay)
                  │
                  └─ Retry ──► API Call Attempt N
```

## Exponential Backoff Timeline

```
Attempt 1: Immediate (0ms)
           ├─ Fail
           │
Attempt 2: Wait 1000ms
           ├─ Fail
           │
Attempt 3: Wait 2000ms (1000 × 2^1)
           ├─ Fail
           │
Attempt 4: Wait 4000ms (1000 × 2^2)
           ├─ Success! ✓
           │
Total Time: ~7 seconds

With Jitter:
Attempt 1: Immediate (0ms)
           ├─ Fail
           │
Attempt 2: Wait 1000-1250ms (1000 + 0-25% jitter)
           ├─ Fail
           │
Attempt 3: Wait 2000-2500ms (2000 + 0-25% jitter)
           ├─ Fail
           │
Attempt 4: Wait 4000-5000ms (4000 + 0-25% jitter)
           ├─ Success! ✓
           │
Total Time: ~7-9 seconds (prevents thundering herd)
```

## Statistical Assertion Flow

```
Test Execution with 50 API Calls (10% failure rate)
│
├─ Expected Outcomes (with retries):
│  • ~5 requests fail initially (10% of 50)
│  • ~4 succeed on retry (80% retry success)
│  • ~1 fails after all retries
│  │
│  Final: ~49 successes, ~1 failure
│  Success Rate: 98%
│
└─ Assertion:
   tester.assertMinimumSuccessRate(80)
   │
   ├─ Success Rate (98%) >= 80% ──► PASS ✓
   │
   └─ If Success Rate < 80% ──► FAIL ✗
      (Indicates systemic issue, not random failures)
```

## Circuit Breaker Integration

```
┌──────────────────────────────────────────────────────────┐
│ Circuit Breaker State Machine                            │
│                                                           │
│  CLOSED ──────► OPEN ──────► HALF_OPEN ──────► CLOSED   │
│    │              │              │                │       │
│    │              │              │                │       │
│  Normal      Threshold      Test Request     Successful  │
│  Operation   Exceeded       Allowed          Recovery    │
│    │              │              │                │       │
│    │              │              │                │       │
│    ▼              ▼              ▼                ▼       │
│  Requests    Requests        Limited          Normal     │
│  Pass        Rejected        Requests          Operation │
│  Through     Fast-Fail       (e.g., 3)                   │
│                                                           │
└──────────────────────────────────────────────────────────┘

Integration with ResilientApiTester:

┌─────────────────────────────────────────────────┐
│ Test Flow                                        │
│                                                  │
│ 1. Configure API to always fail                 │
│    mockServer.setResponseMode('error-500')      │
│    mockServer.setErrorCount(100)                │
│                                                  │
│ 2. Send requests until circuit opens            │
│    for user in users:                           │
│      await tester.executeWithRetry(sendEmail)   │
│      if circuitBreaker.isOpen:                  │
│        break                                    │
│                                                  │
│ 3. Verify circuit breaker opened                │
│    expect(cbStats.state).toBe('open')           │
│    expect(cbStats.failures).toBeGreaterThan(0)  │
│                                                  │
│ 4. Test recovery                                │
│    mockServer.setResponseMode('success')        │
│    circuitBreaker.reset()                       │
│    result = await tester.executeWithRetry()     │
│    expect(result.success).toBe(true)            │
└─────────────────────────────────────────────────┘
```

## Batch Execution Patterns

### Sequential Execution

```
API Call 1 ──► [Retry if needed] ──► Complete
                                       │
                                       ▼
API Call 2 ──► [Retry if needed] ──► Complete
                                       │
                                       ▼
API Call 3 ──► [Retry if needed] ──► Complete

Total Time = Sum of all call times + retry delays
Use Case: Order-dependent operations, resource constraints
```

### Parallel Execution

```
API Call 1 ──► [Retry if needed] ──┐
                                    │
API Call 2 ──► [Retry if needed] ──┼──► All Complete
                                    │
API Call 3 ──► [Retry if needed] ──┘

Total Time = Slowest call time + retry delays
Use Case: Independent operations, maximize throughput
```

## Metrics Collection Flow

```
┌─────────────────────────────────────────────────────┐
│ ResilientApiTester Metrics                          │
│                                                      │
│ For each API call:                                   │
│                                                      │
│ executeWithRetry() {                                 │
│   startTime = now()                                  │
│   attempt = 0                                        │
│                                                      │
│   while attempt <= maxRetries:                       │
│     try:                                             │
│       result = await apiCall()                       │
│       elapsedTime = now() - startTime                │
│       recordSuccess(attempt, elapsedTime)            │
│       return result                                  │
│     catch error:                                     │
│       if shouldRetry and attempt < maxRetries:       │
│         attempt++                                    │
│         continue                                     │
│       else:                                          │
│         elapsedTime = now() - startTime              │
│         recordFailure(attempt, error, elapsedTime)   │
│         return error                                 │
│ }                                                    │
│                                                      │
│ Collected Metrics:                                   │
│ • attemptCounts[] - Number of attempts per call      │
│ • latencies[] - Time taken per call                  │
│ • failures[] - Detailed failure information          │
│                                                      │
│ Calculated Statistics:                               │
│ • successRate = (successes / total) × 100            │
│ • averageAttempts = mean(attemptCounts)              │
│ • averageLatency = mean(latencies)                   │
└─────────────────────────────────────────────────────┘
```

## Test Configuration Decision Tree

```
                Start
                  │
                  ▼
        What is expected API
        failure rate?
                  │
    ┌─────────────┼─────────────┐
    │             │             │
  ~10%          ~50%          100%
 Normal      Degraded       Outage
    │             │             │
    ▼             ▼             ▼
Preset:       Preset:       Custom:
probabilistic  highReliability fastFail
Failure                      │
    │             │             │
    ▼             ▼             ▼
Min Success   Min Success   Expect all
Rate: 80%     Rate: 90%     to fail
    │             │             │
    ▼             ▼             ▼
Timeout:      Timeout:      Timeout:
60-120s       90-180s       30-60s
```

## Example Test Scenarios

### Scenario 1: Normal Operation (10% Failure Rate)

```
Configuration:
┌────────────────────────────────────┐
│ Mock Server:                       │
│   mode: probabilistic-failure      │
│   failureRate: 0.1                 │
│                                    │
│ Tester:                            │
│   preset: probabilisticFailure     │
│   maxRetries: 3                    │
│   baseDelay: 1000ms                │
│                                    │
│ Expectations:                      │
│   minSuccessRate: 80%              │
│   timeout: 90s                     │
└────────────────────────────────────┘

Execution:
50 API calls × (10% fail initially)
= ~5 failures
  → 4 succeed on retry (80% retry success)
  → 1 fails after retries
= 49 successes, 1 failure
Success Rate: 98% ✓
```

### Scenario 2: Service Degradation (50% Failure Rate)

```
Configuration:
┌────────────────────────────────────┐
│ Mock Server:                       │
│   mode: probabilistic-failure      │
│   failureRate: 0.5                 │
│                                    │
│ Tester:                            │
│   preset: highReliability          │
│   maxRetries: 5                    │
│   baseDelay: 2000ms                │
│                                    │
│ Expectations:                      │
│   minSuccessRate: 90%              │
│   timeout: 180s                    │
└────────────────────────────────────┘

Execution:
20 API calls × (50% fail initially)
= ~10 failures
  → With 5 retries, probability of all failing: 0.5^6 ≈ 1.6%
  → ~9-10 succeed eventually
= ~19-20 successes, ~0-1 failure
Success Rate: 95-100% ✓
```

### Scenario 3: Transient Failure (Fail 2x, Then Succeed)

```
Configuration:
┌────────────────────────────────────┐
│ Mock Server:                       │
│   mode: error-500                  │
│   errorCount: 2                    │
│                                    │
│ Tester:                            │
│   maxRetries: 3                    │
│                                    │
│ Expectations:                      │
│   success: true                    │
│   attemptNumber: 3                 │
│   timeout: 30s                     │
└────────────────────────────────────┘

Execution:
Attempt 1: Fail (500)
  → Wait 1000ms
Attempt 2: Fail (500)
  → Wait 2000ms
Attempt 3: Success ✓

Total Time: ~3 seconds
```

## Key Design Principles

1. **Statistical Thinking**
   - Use probability distributions, not binary outcomes
   - Accept expected failures as normal
   - Assert on aggregate success rates

2. **Graceful Degradation**
   - Retry transient failures automatically
   - Use exponential backoff to prevent overload
   - Fail fast on non-retriable errors

3. **Observable Behavior**
   - Track detailed metrics for debugging
   - Log all retries and failures
   - Provide clear test output

4. **Realistic Testing**
   - Simulate actual API behavior
   - Test multiple failure scenarios
   - Verify recovery mechanisms

5. **Maintainability**
   - Use configuration presets for common scenarios
   - Provide clear documentation
   - Make tests self-documenting with good naming

## Benefits

✅ **Eliminates Test Flakiness**
   - Statistical assertions handle expected failures
   - No more intermittent test failures

✅ **Validates Retry Logic**
   - Ensures retries work correctly
   - Verifies exponential backoff timing

✅ **Tests Circuit Breaker**
   - Confirms circuit opens under load
   - Verifies recovery mechanisms

✅ **Production-Like Testing**
   - Simulates real API behavior
   - Tests actual failure scenarios

✅ **Rich Metrics**
   - Detailed success/failure tracking
   - Performance and latency monitoring
   - Debugging information

## Related Documentation

- [Complete Usage Guide](/docs/TESTING-PROBABILISTIC-APIS.md)
- [Implementation Summary](/docs/test-patterns/RESILIENT-API-TESTING-SUMMARY.md)
- [Resilient API Tester Source](/tests/helpers/resilient-api-tester.ts)
- [E2E Test Examples](/tests/e2e/probabilistic-api-resilience.test.ts)
