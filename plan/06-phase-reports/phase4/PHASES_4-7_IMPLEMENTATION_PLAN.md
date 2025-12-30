# Phases 4-7 Implementation Plan
## Complete Production Readiness Roadmap

**Date**: 2025-12-30
**Status**: In Progress
**Phases**: 4 (Recovery & Bonus), 5 (Performance), 6 (CI/CD), 7 (Production Hardening)

---

## Current Status Assessment

### ✅ Completed (Phases 1-2)
- Database schema and migrations
- User CRUD API endpoints
- Scheduler service with recovery logic
- RabbitMQ infrastructure
- Testing framework (Vitest + Testcontainers)
- Basic CI/CD pipeline
- Structured logging with Pino

### 🚧 Phase 3 Status
- Message delivery service: ✅ Implemented
- Circuit breaker (Opossum): ✅ Implemented
- Retry logic with Got: ✅ Implemented
- Workers: ✅ Implemented

### 📋 Remaining Work (Phases 4-7)

---

## PHASE 4: Recovery & Bonus Features

### 4.1 CRON Job Implementation ✅

**File Created**: `src/schedulers/cron-scheduler.ts`

**Features**:
- Daily job (00:00 UTC) - Pre-calculate birthdays
- Minute job (every minute) - Enqueue upcoming messages
- Recovery job (every 10 minutes) - Recover missed messages
- Manual trigger support for testing
- Comprehensive logging
- Graceful shutdown handling

**Integration Points**:
```typescript
// In src/index.ts or src/scheduler.ts
import { cronScheduler } from './schedulers/cron-scheduler.js';

async function startScheduler() {
  await cronScheduler.start();

  // Graceful shutdown
  process.on('SIGTERM', async () => {
    await cronScheduler.stop();
    process.exit(0);
  });
}
```

**Testing**:
- Unit tests for scheduler logic
- Integration tests with database
- E2E test for 24h downtime recovery

### 4.2 PUT Endpoint Enhancement 🔄

**Status**: Partially implemented (TODO in controller)

**Required Implementation**:

**File**: `src/services/message-reschedule.service.ts`
```typescript
export class MessageRescheduleService {
  async rescheduleMessagesForUser(userId: string, changes: {
    timezone?: string;
    birthdayDate?: Date;
    anniversaryDate?: Date;
  }): Promise<RescheduleResult> {
    // 1. Find all future scheduled messages for user
    // 2. Delete old scheduled messages
    // 3. Recalculate send times with new timezone/dates
    // 4. Create new message log entries
    // 5. Return statistics
  }
}
```

**File**: `src/controllers/user.controller.ts`
```typescript
// Update the update() method to call reschedule service
if (updateData.timezone || updateData.birthdayDate !== undefined) {
  const rescheduleService = new MessageRescheduleService();
  await rescheduleService.rescheduleMessagesForUser(id, updateData);
}
```

**Tests**:
- `tests/unit/services/message-reschedule.service.test.ts`
- `tests/integration/user-update-reschedule.test.ts`
- `tests/e2e/timezone-change-flow.test.ts`

### 4.3 Health Check Endpoints 🔄

**Status**: Basic implementation exists

**Enhancement Required**:

**File**: `src/services/health-check.service.ts`
```typescript
export class HealthCheckService {
  async checkDatabase(): Promise<HealthStatus> {
    // Check database connection
    // Query a simple table
    // Check connection pool status
  }

  async checkRabbitMQ(): Promise<HealthStatus> {
    // Check RabbitMQ connection
    // Check queue existence
    // Check message count
  }

  async checkRedis(): Promise<HealthStatus> {
    // Check Redis connection (if used)
    // Check ping response
  }

  async checkCircuitBreaker(): Promise<HealthStatus> {
    // Check circuit breaker state
    // Return open/closed status
  }
}
```

**Endpoints**:
- GET /health - Basic health check
- GET /health/ready - Readiness probe (K8s)
- GET /health/live - Liveness probe (K8s)
- GET /health/detailed - Full system health

### 4.4 Race Condition Tests ⏳

**File**: `tests/integration/race-conditions.test.ts`

**Test Scenarios**:
```typescript
describe('Race Condition Tests', () => {
  it('should prevent duplicate message creation with concurrent requests', async () => {
    // Simulate 100 concurrent user creation requests
    // Verify only one birthday message is created
    // Verify idempotency key works
  });

  it('should handle concurrent message status updates', async () => {
    // Multiple workers trying to update same message
    // Verify database constraints prevent corruption
  });

  it('should handle concurrent timezone updates', async () => {
    // Multiple PUT requests to same user
    // Verify messages are rescheduled correctly
  });
});
```

### 4.5 24h Downtime Recovery Test ⏳

**File**: `tests/e2e/downtime-recovery.test.ts`

**Test Scenario**:
```typescript
describe('24h Downtime Recovery', () => {
  it('should recover messages after 24h downtime', async () => {
    // 1. Schedule 100 messages for tomorrow
    // 2. Simulate 24h downtime (don't run workers)
    // 3. Advance time to 25h later
    // 4. Run recovery job
    // 5. Verify all messages are recovered and sent
    // 6. Verify no duplicates
  });
});
```

---

## PHASE 5: Performance & Load Testing

### 5.1 k6 Performance Test Scripts ✅

**Status**: Basic scripts exist

**Enhancement Required**:

**File**: `tests/performance/api-load.js`
```javascript
// Test 1000+ concurrent requests
// Measure p50, p95, p99 response times
// Check for errors under load
```

**File**: `tests/performance/scheduler-load.js`
```javascript
// Test 10,000 birthdays/day
// Measure scheduling throughput
// Check database performance
```

**File**: `tests/performance/worker-throughput.js`
```javascript
// Test worker pool throughput
// Measure messages processed per second
// Test with 1, 5, 10, 20 workers
```

### 5.2 Database Query Optimization ⏳

**Actions**:
1. Run EXPLAIN ANALYZE on all queries
2. Add missing indexes if any
3. Optimize connection pool settings
4. Add query performance monitoring

**File**: `src/db/query-analyzer.ts`
```typescript
export async function analyzeSlowQueries() {
  // Query pg_stat_statements
  // Identify slow queries
  // Generate optimization report
}
```

### 5.3 Prometheus Metrics Endpoints ⏳

**File**: `src/monitoring/metrics.service.ts`

**Metrics to Implement**:
```typescript
// Queue metrics
queue_depth_total
queue_messages_enqueued_total
queue_messages_processed_total
queue_messages_failed_total

// Message metrics
messages_sent_total
messages_failed_total
message_delivery_duration_seconds

// Circuit breaker metrics
circuit_breaker_state{service="message-api"} // 0=closed, 1=open, 2=half-open
circuit_breaker_failures_total
circuit_breaker_successes_total

// Database metrics
db_connections_active
db_connections_idle
db_query_duration_seconds

// API metrics
http_request_duration_seconds{method,route,status_code}
http_requests_total{method,route,status_code}
```

**Endpoint**: `GET /metrics` (Prometheus format)

### 5.4 Performance Baselines 📊

**Document**: `docs/PERFORMANCE_BASELINES.md`

**Target Metrics**:
- API p99 < 1 second
- Database query p99 < 100ms
- Message throughput > 100/second
- 10,000 birthdays/day capability
- Worker pool efficiency > 90%

---

## PHASE 6: CI/CD & Deployment

### 6.1 CI/CD Pipeline Enhancement ✅

**Status**: Basic pipeline exists

**Enhancements Needed**:
- Add E2E tests to pipeline
- Add performance regression tests (weekly)
- Add security scanning (npm audit + Snyk)
- Add coverage reporting (Codecov)

**File**: `.github/workflows/ci.yml` (already comprehensive)

### 6.2 Production Dockerfile ⏳

**File**: `Dockerfile.prod`

```dockerfile
# Multi-stage build
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
RUN npm run build

FROM node:20-alpine AS runtime
WORKDIR /app
RUN addgroup -g 1001 -S nodejs && adduser -S nodejs -u 1001
COPY --from=builder --chown=nodejs:nodejs /app/dist ./dist
COPY --from=builder --chown=nodejs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nodejs:nodejs /app/package.json ./
USER nodejs
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/health/live', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"
CMD ["node", "dist/index.js"]
```

### 6.3 Production Docker Compose ⏳

**File**: `docker-compose.prod.yml`

```yaml
version: '3.8'

services:
  app:
    build:
      context: .
      dockerfile: Dockerfile.prod
    environment:
      NODE_ENV: production
    secrets:
      - db_password
      - rabbitmq_password
    networks:
      - backend
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000/health/live"]
      interval: 30s
      timeout: 3s
      retries: 3
    deploy:
      replicas: 3
      restart_policy:
        condition: on-failure

  postgres:
    image: postgres:15-alpine
    volumes:
      - postgres_data:/var/lib/postgresql/data
    secrets:
      - db_password
    networks:
      - backend

  rabbitmq:
    image: rabbitmq:3.12-management-alpine
    volumes:
      - rabbitmq_data:/var/lib/rabbitmq
    secrets:
      - rabbitmq_password
    networks:
      - backend

volumes:
  postgres_data:
  rabbitmq_data:

secrets:
  db_password:
    external: true
  rabbitmq_password:
    external: true

networks:
  backend:
    driver: overlay
```

### 6.4 API Documentation Enhancement ⏳

**Status**: Swagger configured

**Enhancement**:
- Add comprehensive examples
- Document all error responses
- Add authentication documentation
- Add rate limiting documentation

**File**: `src/config/swagger.ts`

### 6.5 Deployment Guide 📝

**File**: `docs/DEPLOYMENT_GUIDE.md`

**Sections**:
1. Prerequisites
2. Environment Configuration
3. Database Setup and Migrations
4. Service Configuration (PostgreSQL, RabbitMQ)
5. Application Deployment
6. Health Check Verification
7. Monitoring Setup
8. Rollback Procedures

---

## PHASE 7: Production Hardening

### 7.1 Security Audit ⏳

**Checklist**:
- [ ] Review all dependencies (npm audit)
- [ ] Fix vulnerabilities (Snyk scan)
- [ ] Verify security headers (Helmet configured)
- [ ] Environment variable validation (Zod configured)
- [ ] SQL injection prevention (Drizzle ORM)
- [ ] XSS prevention
- [ ] CSRF protection
- [ ] Rate limiting (configured)
- [ ] Input validation (Zod configured)
- [ ] Authentication/authorization (if needed)

**Document**: `docs/SECURITY_AUDIT_REPORT.md`

### 7.2 Stress Testing ⏳

**File**: `tests/stress/extreme-load.js`

**Scenarios**:
```javascript
// Test 1: Spike load (0 to 1000 req/s in 10 seconds)
// Test 2: Sustained high load (500 req/s for 10 minutes)
// Test 3: Memory leak detection (sustained load for 1 hour)
// Test 4: Database connection exhaustion
// Test 5: RabbitMQ queue overflow
```

**File**: `tests/stress/failure-scenarios.js`

**Scenarios**:
```javascript
// Test 1: Database failure recovery
// Test 2: RabbitMQ failure recovery
// Test 3: External API failure (circuit breaker)
// Test 4: Out of memory handling
// Test 5: Disk space exhaustion
```

### 7.3 Monitoring & Alerting ⏳

**File**: `monitoring/grafana-dashboard.json`

**Dashboards**:
1. System Health Dashboard
2. Message Processing Dashboard
3. API Performance Dashboard
4. Database Performance Dashboard
5. Error Tracking Dashboard

**File**: `monitoring/alert-rules.yml`

**Alert Rules**:
```yaml
- name: High Queue Depth
  expr: queue_depth_total > 1000
  severity: warning

- name: Message Delivery Failure Rate
  expr: rate(messages_failed_total[5m]) > 0.1
  severity: critical

- name: Circuit Breaker Open
  expr: circuit_breaker_state == 1
  severity: warning

- name: Database Connection Pool Exhausted
  expr: db_connections_active >= db_connections_max
  severity: critical
```

### 7.4 Operational Runbook 📝

**File**: `docs/OPERATIONAL_RUNBOOK.md`

**Sections**:

1. **Deployment**
   - Standard deployment procedure
   - Zero-downtime deployment
   - Rollback procedure

2. **Scaling**
   - Horizontal scaling (add more instances)
   - Vertical scaling (increase resources)
   - Database scaling
   - RabbitMQ scaling

3. **Troubleshooting**
   - High memory usage
   - Slow API responses
   - Failed message delivery
   - Database connection issues
   - RabbitMQ connection issues
   - Circuit breaker open

4. **Common Issues and Solutions**
   - Messages not being sent
   - Duplicate messages
   - Timezone conversion errors
   - Database deadlocks
   - Queue backlog

5. **Monitoring**
   - Key metrics to watch
   - Log analysis
   - Performance baselines
   - Alert response procedures

6. **Maintenance**
   - Database maintenance
   - Log rotation
   - Backup procedures
   - Security updates

### 7.5 Final Documentation Review 📝

**Documents to Review/Create**:
- [x] README.md
- [ ] API_DOCUMENTATION.md
- [ ] DEPLOYMENT_GUIDE.md
- [ ] OPERATIONAL_RUNBOOK.md
- [ ] SECURITY_AUDIT_REPORT.md
- [ ] PERFORMANCE_BASELINES.md
- [ ] ARCHITECTURE_OVERVIEW.md
- [ ] TROUBLESHOOTING_GUIDE.md
- [ ] CONTRIBUTING.md
- [ ] CHANGELOG.md

### 7.6 Deployment Checklist 📋

**File**: `docs/DEPLOYMENT_CHECKLIST.md`

```markdown
## Pre-Deployment Checklist

### Code Quality
- [ ] All tests passing (unit, integration, E2E)
- [ ] Code coverage > 85%
- [ ] No linting errors
- [ ] No TypeScript errors
- [ ] Security scan passed
- [ ] Performance benchmarks met

### Configuration
- [ ] Environment variables configured
- [ ] Database migrations ready
- [ ] Secrets configured
- [ ] Rate limits configured
- [ ] Circuit breaker configured

### Infrastructure
- [ ] PostgreSQL configured and tested
- [ ] RabbitMQ configured and tested
- [ ] Redis configured (if used)
- [ ] Monitoring configured
- [ ] Logging configured
- [ ] Backup configured

### Documentation
- [ ] API documentation complete
- [ ] Deployment guide complete
- [ ] Operational runbook complete
- [ ] Architecture diagrams updated

### Testing
- [ ] Smoke tests passed
- [ ] Load tests passed
- [ ] Failure scenario tests passed
- [ ] Security tests passed

### Deployment
- [ ] Build Docker images
- [ ] Push to registry
- [ ] Deploy to staging
- [ ] Verify staging
- [ ] Deploy to production
- [ ] Verify production
- [ ] Monitor for issues
```

---

## Implementation Priority

### High Priority (Week 1)
1. ✅ CRON scheduler implementation
2. 🔄 Message rescheduling service for PUT endpoint
3. 🔄 Enhanced health check endpoints
4. ⏳ Race condition tests
5. ⏳ 24h downtime recovery test

### Medium Priority (Week 2)
6. ⏳ Prometheus metrics endpoints
7. ⏳ Production Dockerfile
8. ⏳ Production docker-compose.yml
9. ⏳ Database query optimization
10. ⏳ Enhanced k6 performance tests

### Lower Priority (Week 3)
11. 📝 Deployment guide
12. 📝 Operational runbook
13. ⏳ Stress testing
14. ⏳ Grafana dashboards
15. ⏳ Security audit

### Final (Week 4)
16. 📝 Final documentation review
17. 📝 Deployment checklist
18. ⏳ Production validation
19. 📝 Team knowledge transfer

---

## Success Criteria

### Phase 4
- [x] CRON jobs running and tested
- [ ] PUT endpoint reschedules messages correctly
- [ ] Health checks verify all components
- [ ] Race condition tests pass
- [ ] 24h recovery scenario works

### Phase 5
- [ ] Performance baselines documented
- [ ] k6 tests pass with target metrics
- [ ] Prometheus metrics available
- [ ] Database queries optimized

### Phase 6
- [ ] CI/CD pipeline complete and passing
- [ ] Production Docker deployment tested
- [ ] API documentation comprehensive
- [ ] Deployment guide complete

### Phase 7
- [ ] Security audit passed
- [ ] Stress tests passed
- [ ] Monitoring configured
- [ ] Runbook complete
- [ ] Deployment checklist verified

---

## Risk Mitigation

### Technical Risks
- **Database performance under load**: Mitigated by query optimization and connection pooling
- **RabbitMQ message loss**: Mitigated by quorum queues and persistent messages
- **Circuit breaker failures**: Mitigated by comprehensive testing and monitoring
- **Memory leaks**: Mitigated by stress testing and monitoring

### Operational Risks
- **Deployment failures**: Mitigated by comprehensive testing and rollback procedures
- **Data loss**: Mitigated by backups and idempotency
- **Security vulnerabilities**: Mitigated by security scanning and audits
- **Monitoring gaps**: Mitigated by comprehensive metrics and alerts

---

## Next Steps

1. **Immediate** (Today):
   - Complete message rescheduling service
   - Enhance health check service
   - Add race condition tests

2. **This Week**:
   - Complete Phase 4 deliverables
   - Start Phase 5 performance testing
   - Begin Prometheus metrics implementation

3. **Next Week**:
   - Complete Phase 5 deliverables
   - Start Phase 6 deployment preparation
   - Create production Docker configurations

4. **Following Weeks**:
   - Complete Phase 6 deliverables
   - Execute Phase 7 hardening
   - Prepare for production deployment

---

**Last Updated**: 2025-12-30
**Document Owner**: RESEARCHER Agent
**Status**: Living Document - Updated as implementation progresses
