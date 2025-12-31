# Edge Case Test Suite

This directory contains comprehensive edge case tests for the birthday message scheduler, focusing on critical failure scenarios and recovery mechanisms.

## Test Files

### 1. worker-error-handling.test.ts
**29 test cases** covering worker error handling edge cases.

#### Coverage Areas:

**Worker Crash During Processing (5 tests)**
- Preserve message in queue when worker crashes before ACK
- Handle worker crash during database transaction
- Handle sudden process termination (SIGKILL)
- Handle graceful shutdown (SIGTERM) with in-flight messages
- Handle worker crash with partial message processing

**RabbitMQ Connection Loss During Processing (6 tests)**
- Detect connection loss immediately
- Handle connection loss during message fetch
- Handle connection loss during ACK
- Handle connection loss during NACK/reject
- Handle connection flapping (rapid connect/disconnect)
- Handle connection recovery with pending messages

**Message Processing Timeout Scenarios (5 tests)**
- Timeout long-running message processing
- Handle timeout during external API call
- Handle timeout with cleanup actions
- Track timeout metrics
- Adjust timeout based on message type

**Memory Exhaustion and Resource Limits (5 tests)**
- Detect high memory usage
- Reject new work when memory is high
- Handle out-of-memory errors gracefully
- Limit concurrent message processing
- Track resource usage per message

**Concurrent Error Scenarios (4 tests)**
- Handle multiple workers crashing simultaneously
- Handle race condition in message acknowledgment
- Handle concurrent updates to message status
- Handle deadlock in distributed processing

**Error Recovery Mechanisms (4 tests)**
- Implement exponential backoff for retries
- Implement jitter to prevent thundering herd
- Reset error counters on successful processing
- Implement circuit breaker after consecutive failures

---

### 2. retry-logic.test.ts
**28 test cases** covering retry logic edge cases.

#### Coverage Areas:

**Maximum Retry Attempts (5 tests)**
- Stop retrying after max attempts reached
- Send to DLQ after exhausting retries
- Increment retry counter correctly
- Track retry history
- Enforce per-message retry limits

**Retry Backoff Timing (6 tests)**
- Implement exponential backoff correctly
- Implement linear backoff correctly
- Cap backoff at maximum delay
- Add jitter to prevent thundering herd
- Use different backoff strategies for different error types
- Track retry timing metrics

**Retry with Different Error Types (5 tests)**
- Identify transient errors correctly
- Identify permanent errors correctly
- Not retry permanent errors
- Apply different retry strategies for different errors
- Track error type distribution

**Concurrent Retry Scenarios (5 tests)**
- Handle multiple messages retrying concurrently
- Prevent duplicate retry attempts
- Handle retry queue overflow
- Prioritize retries by attempt count
- Handle race conditions in retry scheduling

**Retry State Management (4 tests)**
- Persist retry state across worker restarts
- Clean up old retry state
- Track retry success rate
- Implement circuit breaker for retry operations

**DLQ Routing After Max Retries (3 tests)**
- Send message to DLQ after max retries
- Include retry metadata in DLQ message
- Track DLQ metrics

---

### 3. circuit-breaker.test.ts
**30 test cases** covering circuit breaker pattern edge cases.

#### Coverage Areas:

**State Transitions (6 tests)**
- Transition from CLOSED to OPEN after threshold failures
- Transition from OPEN to HALF_OPEN after timeout
- Transition from HALF_OPEN to CLOSED on success
- Transition from HALF_OPEN to OPEN on failure
- Reset failure count on transition to CLOSED
- Handle rapid state transitions

**Circuit Breaker Under Load (5 tests)**
- Handle high volume of requests in CLOSED state
- Reject requests immediately when OPEN
- Limit concurrent requests in HALF_OPEN state
- Track request rate and latency
- Handle spike in failure rate

**Multiple Service Circuit Breakers (5 tests)**
- Isolate failures to specific services
- Prevent cascading failures across services
- Track health status across services
- Use fallback when primary service circuit is open
- Aggregate circuit metrics across services

**Circuit Breaker Recovery (5 tests)**
- Implement exponential backoff for recovery attempts
- Gradually increase traffic in HALF_OPEN state
- Track recovery success rate
- Implement cooldown period after failed recovery
- Reset on consecutive successful recoveries

**Edge Cases in State Management (5 tests)**
- Handle concurrent state updates
- Handle state transitions during shutdown
- Preserve state across process restarts
- Handle clock skew in timeout calculations
- Cleanup stale circuit breaker state

**Metrics and Monitoring (4 tests)**
- Track circuit state duration
- Calculate error rate thresholds
- Emit circuit state change events
- Track success/failure counts in sliding window

---

## Key Features

### Error Classification
Tests verify proper classification of:
- **Transient errors**: Network timeouts, connection failures, rate limits, service unavailable (503)
- **Permanent errors**: Validation failures, not found (404), unauthorized (401), forbidden (403)

### Retry Strategies
Tests cover multiple retry strategies:
- **Exponential backoff**: Doubling delay with each retry (1s, 2s, 4s, 8s...)
- **Linear backoff**: Fixed increment with each retry (1s, 2s, 3s, 4s...)
- **Jitter**: Random delay added to prevent thundering herd
- **Capped delays**: Maximum retry delay to prevent infinite waits

### Circuit Breaker States
Tests verify correct state machine behavior:
- **CLOSED**: Normal operation, requests pass through
- **OPEN**: Circuit is open, requests fail fast
- **HALF_OPEN**: Testing recovery, limited requests allowed

### Failure Scenarios
Tests cover critical failure modes:
- Worker crashes (SIGKILL, SIGTERM)
- Database transaction failures
- RabbitMQ connection loss
- Message processing timeouts
- Memory exhaustion
- Concurrent failures
- Cascading service failures

---

## Running Tests

```bash
# Run all edge case tests
npm test tests/unit/edge-cases/

# Run specific test file
npm test tests/unit/edge-cases/worker-error-handling.test.ts
npm test tests/unit/edge-cases/retry-logic.test.ts
npm test tests/unit/edge-cases/circuit-breaker.test.ts

# Run with coverage
npm test -- --coverage tests/unit/edge-cases/

# Run in watch mode
npm test -- --watch tests/unit/edge-cases/
```

---

## Test Structure

All tests follow a consistent structure:

1. **Arrange**: Set up test data and mocks
2. **Act**: Execute the functionality being tested
3. **Assert**: Verify expected outcomes

Tests use descriptive names following the pattern:
- `should <expected behavior> when <condition>`

Example:
```typescript
it('should send to DLQ after exhausting retries', () => {
  // Test implementation
});
```

---

## Coverage Goals

These edge case tests complement existing unit and integration tests to achieve:

- **Line Coverage**: 95%+
- **Branch Coverage**: 90%+
- **Function Coverage**: 95%+
- **Critical Path Coverage**: 100%

Focus areas:
- Error handling paths
- Retry logic
- Circuit breaker transitions
- Resource management
- Concurrent operations
- Recovery mechanisms

---

## Related Files

- `/src/workers/message-worker.ts` - Main worker implementation
- `/src/queue/consumer.ts` - RabbitMQ consumer with retry logic
- `/src/clients/email-service.client.ts` - Email client with circuit breaker
- `/src/services/scheduler.service.ts` - Scheduler service coordination

---

## Testing Best Practices

1. **Isolation**: Each test is independent and can run in any order
2. **Determinism**: Tests produce consistent results across runs
3. **Fast Execution**: Most tests run in milliseconds (except timeout tests)
4. **Clear Assertions**: Each test has clear, specific assertions
5. **Edge Cases First**: Focus on failure scenarios and boundary conditions
6. **Real-World Scenarios**: Tests based on actual production issues

---

## Future Enhancements

Potential areas for additional edge case testing:

- [ ] Chaos engineering scenarios (random failures)
- [ ] Network partition scenarios
- [ ] Database failover scenarios
- [ ] Message ordering guarantees
- [ ] Exactly-once delivery semantics
- [ ] Multi-region failover
- [ ] Rate limiting edge cases
- [ ] Message priority handling

---

## Contributing

When adding new edge case tests:

1. Follow existing test structure and naming conventions
2. Add test description to this README
3. Ensure tests are deterministic and isolated
4. Include both positive and negative test cases
5. Document any special setup requirements
6. Run the full test suite before committing

---

## References

- [RabbitMQ Best Practices](https://www.rabbitmq.com/best-practices.html)
- [Circuit Breaker Pattern](https://martinfowler.com/bliki/CircuitBreaker.html)
- [Exponential Backoff And Jitter](https://aws.amazon.com/blogs/architecture/exponential-backoff-and-jitter/)
- [Vitest Documentation](https://vitest.dev/)
