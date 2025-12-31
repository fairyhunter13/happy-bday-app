# Implementation Plan - Gap Analysis Tasks
## Generated: 2025-12-31

Based on comprehensive research from 6 parallel research agents, this document outlines the implementation plan for all identified gaps.

---

## Executive Summary

| Task Area | Priority | Effort | Status |
|-----------|----------|--------|--------|
| Timezone Boundary Tests | HIGH | Medium | Pending |
| CI/CD Coverage Enforcement | HIGH | Low | Pending |
| System Metrics Service | HIGH | Medium | Pending |
| Business Logic Metrics | MEDIUM | Medium | Pending |
| Documentation Updates | LOW | Low | Pending |
| Redis Cache Implementation | MEDIUM | High | Pending |

---

## 1. Timezone Boundary Tests

### Files to Create

1. **`tests/unit/timezone-dst-edge-cases.test.ts`**
   - Spring forward (2am nonexistent time)
   - Fall back (2am ambiguous time)
   - DST on exact birthday
   - Multiple DST zones

2. **`tests/unit/timezone-midnight-boundaries.test.ts`**
   - UTC+14 date wrapping
   - UTC-12 late messages
   - 23:59 to 00:00 transitions

3. **`tests/unit/timezone-leap-year-comprehensive.test.ts`**
   - Feb 29 in leap year
   - Feb 29 in non-leap year
   - Century leap year rules (1900, 2000)

4. **`tests/unit/timezone-rare-offsets.test.ts`**
   - Nepal (UTC+5:45)
   - Chatham Islands (UTC+12:45)

### Key Test Cases
- DST spring forward for birthdays at 2:30am (nonexistent)
- DST fall back for birthdays at 2am (ambiguous)
- UTC+14 Dec 31 birthday wraps to Dec 30 UTC
- Feb 29 birthday handling in non-leap years

---

## 2. CI/CD Coverage Enforcement

### Changes to `.github/workflows/ci.yml`

1. **Add coverage flag to unit tests** (line 68):
```yaml
run: npm run test:unit -- --shard=${{ matrix.shard }}/5 --reporter=verbose --coverage
```

2. **Add coverage threshold check step**:
```yaml
- name: Check unit test coverage thresholds
  run: npm run test:coverage:check
```

3. **Add coverage history update** (for push to main):
```yaml
- name: Update coverage history
  if: github.event_name == 'push' && github.ref == 'refs/heads/main'
  run: bash scripts/coverage/update-history.sh
```

---

## 3. System Metrics Service

### File to Create: `src/services/system-metrics.service.ts`

```typescript
// Key components:
// 1. GC monitoring via PerformanceObserver
// 2. Event loop monitoring (lag + utilization)
// 3. System metrics collection (load avg, memory)
// 4. V8 heap metrics collection
// 5. Process metrics collection
```

### Metrics to Implement (NOT covered by prom-client)
- System load average (1m, 5m, 15m)
- System free/total memory
- Event loop utilization
- Custom GC tracking

### Integration Points
- Initialize in `src/index.ts` or `src/app.ts`
- Add to graceful shutdown handler
- Collection interval: 15 seconds

---

## 4. Business Logic Metrics

### Services to Instrument

1. **UserController** (`src/controllers/user.controller.ts`)
   - `create()`: Add `recordUserCreation()`
   - `update()`: Add `recordUserActivity()` for timezone/birthday changes
   - `delete()`: Add `recordUserDeletion()`

2. **SchedulerService** (`src/services/scheduler.service.ts`)
   - `processMessagesForStrategy()`: Add `recordBirthdayProcessed()`
   - Add template usage tracking

3. **MessageWorker** (`src/workers/message-worker.ts`)
   - Add `recordMessageDeliveryByHour()`
   - Add `recordBirthdayGreetingType()`

4. **DailyBirthdayScheduler** (`src/schedulers/daily-birthday.scheduler.ts`)
   - Add gauge updates for `birthdaysToday`, `birthdaysPending`
   - Add timezone distribution updates

---

## 5. Documentation Updates

### METRICS.md Additions
- Document 5 Business Histograms (#254-258)
- Document 5 Extended Summary Metrics (#264-268)
- Add dashboard integration section
- Add cardinality warnings

### RUNBOOK.md Additions
- Metric name quick reference table
- Real-time monitoring commands
- Scheduler-specific monitoring section

---

## 6. Redis Cache Implementation

### Phase 1: Foundation
1. Install ioredis: `npm install ioredis`
2. Create `src/services/cache.interface.ts`
3. Create `src/services/redis-cache.service.ts`
4. Add Redis health check to HealthCheckService
5. Add cache metrics to MetricsService

### Phase 2: User Caching
1. Create `src/repositories/cached-user.repository.ts`
2. Implement cache-aside pattern
3. Add cache invalidation hooks
4. Update UserController to use cached repository

### Cache Strategy
- User profiles: 1 hour TTL
- Birthdays today: Until midnight TTL
- Scheduler stats: 5 minute TTL

---

## Parallel Implementation Plan

### Batch 1 (Independent Tasks - Can Run in Parallel)
1. Timezone Boundary Tests (Sonnet)
2. CI/CD Coverage Enforcement (Haiku - simple)
3. System Metrics Service (Sonnet)
4. Documentation Updates - METRICS.md (Haiku - simple)

### Batch 2 (After Batch 1)
1. Business Logic Metrics (Sonnet) - needs system metrics
2. Documentation Updates - RUNBOOK.md (Haiku)
3. Redis Cache - Phase 1 (Sonnet)

### Batch 3 (After Batch 2)
1. Redis Cache - Phase 2 (Sonnet)
2. Integration Testing (Sonnet)

---

## Model Selection Strategy

Per `.claude/hive-mind-config.json`:

| Task | Complexity | Model |
|------|------------|-------|
| Timezone Tests | >= 31 | Sonnet |
| CI/CD Changes | < 31 | Haiku |
| System Metrics Service | >= 31 | Sonnet |
| Business Metrics | >= 31 | Sonnet |
| Doc Updates (METRICS.md) | < 31 | Haiku |
| Doc Updates (RUNBOOK.md) | < 31 | Haiku |
| Redis Cache Implementation | >= 31 | Sonnet |

---

## Success Criteria

1. **Timezone Tests**: 95%+ edge case coverage
2. **CI/CD**: Coverage threshold blocking PRs
3. **System Metrics**: All declared system metrics actively collecting
4. **Business Metrics**: 80%+ of declared business metrics instrumented
5. **Documentation**: 100% metric documentation
6. **Redis Cache**: Fully functional cache layer

---

## Timeline

- **Week 1**: Batch 1 tasks (parallel)
- **Week 2**: Batch 2 tasks
- **Week 3**: Batch 3 tasks + integration testing
- **Week 4**: Polish and final validation

---

*Generated by Hive Mind Coordinator (Opus 4.5)*
*Session: session-1767124318256-k31atnvtc*
