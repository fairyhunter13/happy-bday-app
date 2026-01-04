# Chaos Testing Best Practices

**Last Updated:** 2026-01-04
**Purpose:** Guidelines for effective chaos engineering

## Philosophy

Chaos testing validates system resilience by intentionally injecting failures in controlled scenarios.

## Test Categories

### 1. Resource Failures
- Memory exhaustion
- CPU saturation
- Disk full scenarios

### 2. Network Issues
- Connection timeouts
- Packet loss
- Network partitions

### 3. Dependency Failures
- Database unavailable
- Queue service down
- External API timeouts

## Best Practices

### Start Small
```typescript
// ✅ GOOD: Controlled failure
it('should handle single database timeout', async () => {
  // Inject single failure, verify recovery
});

// ❌ BAD: Chaos too early
it('should survive complete infrastructure meltdown', () => {
  // Too complex for initial testing
});
```

### Verify Recovery
```typescript
it('should recover after database reconnection', async () => {
  // 1. System healthy
  // 2. Inject failure
  // 3. Wait for circuit breaker
  // 4. Restore connection
  // 5. Verify full recovery ✓
});
```

### Measure Impact
- Response time degradation
- Error rate increase
- Recovery time (MTTR)
- Data consistency

### Gradual Escalation
1. **Level 1:** Single component failure
2. **Level 2:** Multiple failures
3. **Level 3:** Cascading failures
4. **Level 4:** Full disaster scenarios

## Chaos Scenarios

### Database Chaos
- Connection pool exhaustion
- Slow queries (latency injection)
- Transaction deadlocks
- Replica lag

### Queue Chaos
- Message loss simulation
- Consumer crashes
- Acknowledgment failures
- Queue full scenarios

### API Chaos
- Rate limiting
- Timeout injection
- Malformed responses
- Service unavailable

## Safety Guidelines

### Pre-Chaos Checklist
- [ ] Backups verified
- [ ] Monitoring active
- [ ] Rollback plan ready
- [ ] Team notified
- [ ] Non-production environment

### During Chaos
- Monitor metrics continuously
- Document observations
- Be ready to abort
- Communicate status

### Post-Chaos
- Analyze results
- Document learnings
- Fix identified issues
- Update runbooks

## Metrics to Track

- **MTBF:** Mean Time Between Failures
- **MTTR:** Mean Time To Recovery
- **Blast Radius:** Failure impact scope
- **Availability:** Uptime percentage

## Example Test

```typescript
describe('Chaos: RabbitMQ Failure', () => {
  it('should queue messages locally when RabbitMQ down', async () => {
    // 1. System processing normally
    await publisher.publish(message1);
    expect(await consumer.receive()).toBeDefined();

    // 2. Kill RabbitMQ
    await rabbitMQ.stop();

    // 3. Messages queued locally (graceful degradation)
    await publisher.publish(message2);

    // 4. Restart RabbitMQ
    await rabbitMQ.start();

    // 5. Verify recovery - queued messages delivered
    await waitFor(() => messagesDelivered === 2);
  });
});
```

## Anti-Patterns

❌ Chaos in production without preparation
❌ No monitoring during tests
❌ Ignoring test failures
❌ No rollback plan
❌ Testing during peak hours

## Progressive Rollout

1. **Dev:** Full chaos freedom
2. **Staging:** Scheduled chaos
3. **Production:** Gradual, monitored chaos

---

**Learn More:**
- [TEST_WRITING_GUIDE.md](./TEST_WRITING_GUIDE.md)
- [RUNBOOK.md](./RUNBOOK.md)
