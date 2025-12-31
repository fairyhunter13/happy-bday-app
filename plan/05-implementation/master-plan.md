# MASTER IMPLEMENTATION PLAN
## Birthday Message Scheduler - Backend Focus
### Hive Mind Collective - Final Consensus Plan

**Date:** December 30, 2025
**Status:** Research & Planning Phase Complete
**Queen Coordinator:** Strategic Mode
**Contributors:** Researcher, Analyst, Coder, Tester Agents

---

## EXECUTIVE SUMMARY

This master plan represents the collective intelligence of the Hive Mind swarm for building a production-ready, timezone-aware birthday message scheduler backend. Based on December 2025 best practices and extensive research, this plan provides a complete roadmap from architecture to testing, with no code implementation yet.

### Project Overview

**Objective:** Build a scalable TypeScript backend that sends birthday messages at 9 AM local time to users across different timezones, with comprehensive testing and CI/CD integration.

**Scope:** Backend-only (no web UI), focusing on APIs, scheduler, testing, and deployment.

---

## TABLE OF CONTENTS

1. [Technology Stack Consensus](#1-technology-stack-consensus)
2. [Architecture Design](#2-architecture-design)
3. [Database Schema](#3-database-schema)
4. [Implementation Roadmap](#4-implementation-roadmap)
5. [Testing Strategy Integration](#5-testing-strategy-integration)
6. [GitHub Actions CI/CD](#6-github-actions-cicd)
7. [Critical Success Factors](#7-critical-success-factors)
8. [Risk Mitigation](#8-risk-mitigation)

---

## 1. TECHNOLOGY STACK CONSENSUS

Based on research from all agents and December 2025 best practices:

### Core Framework & Language

- **Runtime:** Node.js 20+ (native TypeScript support with `--experimental-strip-types`)
- **Language:** TypeScript 5.7+ (ESM modules, strict mode)
- **Web Framework:** **Fastify 5.2+** (40,000+ req/s, built-in validation)
  - *Consensus:* Chosen over NestJS (too heavy), Express (slower), Hono (newer ecosystem)
  - *Rationale:* Perfect balance of performance, TypeScript support, and reliability

### Database Stack

- **Primary Database:** **PostgreSQL 15+**
  - ACID compliance (prevent duplicate messages)
  - Native timezone support (TIMESTAMPTZ)
  - Row-level locking (race condition prevention)
  - JSON support for flexibility

- **Message Queue:** **RabbitMQ 3.12+ (Quorum Queues)**
  - Zero data loss (Raft consensus replication)
  - Native message persistence
  - Dead letter exchange (DLQ) for failed messages

- **ORM:** **Drizzle 0.38+**
  - *Consensus:* Chosen over TypeORM (heavy), Prisma (overhead)
  - Lightweight (~7.4kb), SQL-first, zero overhead
  - Excellent TypeScript inference

### Job Scheduling

- **Queue System:** **RabbitMQ 3.12+ (Quorum Queues)**
  - Zero data loss via Raft consensus
  - Native message persistence to disk
  - Automatic retries via DLQ (dead letter exchange)
  - Distributed message processing
  - Battle-tested (15+ years production use)
  - Critical decision: Birthday messages happen once a year - zero tolerance for data loss

- **Client Library:** **amqplib** or **amqp-connection-manager**
  - Standard AMQP 0.9.1 protocol
  - Automatic reconnection handling

### Date/Time Handling

- **Library:** **Luxon 3.5+**
  - *Consensus:* Chosen over moment.js (deprecated), date-fns (less timezone support)
  - Native IANA timezone support
  - Automatic DST handling
  - Chainable, immutable API

### HTTP Client & Resilience

- **HTTP Client:** **Got 14+** with built-in retry
  - Native TypeScript support
  - Stream support
  - Advanced retry logic

- **Circuit Breaker:** **Opossum 8+**
  - Prevent cascading failures
  - Event-driven architecture
  - Configurable thresholds

### Testing Framework

- **Test Runner:** **Vitest 3.0+**
  - *Consensus:* Chosen over Jest (30-70% faster)
  - Native TypeScript support
  - 4x faster cold starts
  - 95% Jest-compatible

- **API Testing:** Supertest 7+
- **Integration Testing:** Testcontainers 10+
- **Performance Testing:** k6 (Grafana)
- **Coverage:** NYC/Istanbul

### Development Tools

- **Validation:** Zod 3.24+
- **Logging:** Pino 9+ (structured logging)
- **Linting:** ESLint 9+ (flat config)
- **Formatting:** Prettier 3+
- **Git Hooks:** Husky + lint-staged

---

## 2. ARCHITECTURE DESIGN

### 2.1 Hybrid Scheduler Architecture

Based on Analyst Agent's comprehensive design:

```
┌──────────────────────────────────────────────────────────┐
│                   FASTIFY API LAYER                      │
│  POST /user  |  DELETE /user  |  PUT /user (bonus)      │
└────────────────────┬─────────────────────────────────────┘
                     │
                     ▼
┌──────────────────────────────────────────────────────────┐
│                 PostgreSQL Database                      │
│  Tables: users, message_logs                            │
│  Timezone: IANA identifiers (e.g., America/New_York)    │
└────────────────────┬─────────────────────────────────────┘
                     │
                     ▼
┌──────────────────────────────────────────────────────────┐
│            SCHEDULER SYSTEM (RabbitMQ + CRON)            │
│                                                          │
│  1. Daily CRON (00:00 UTC)                              │
│     → Pre-calculate birthdays for entire day            │
│     → Store scheduled_send_time in UTC                  │
│                                                          │
│  2. Minute CRON (every 1 min)                           │
│     → Find messages scheduled in next hour              │
│     → Publish to RabbitMQ (with x-delay for scheduling) │
│                                                          │
│  3. Recovery CRON (every 10 min)                        │
│     → Find missed messages (sent=false, past time)      │
│     → Re-enqueue for retry                              │
└────────────────────┬─────────────────────────────────────┘
                     │
                     ▼
┌──────────────────────────────────────────────────────────┐
│                  RABBITMQ WORKER POOL                    │
│  5 workers per instance (configurable)                  │
│                                                          │
│  For each message:                                      │
│  1. Consume from quorum queue (guaranteed delivery)     │
│  2. Check idempotency key (DB unique constraint)        │
│  3. Send HTTP request (Got + retry)                     │
│  4. Log result to database                              │
│  5. Acknowledge message (or nack for retry)             │
│                                                          │
│  Retry Strategy:                                        │
│  - Exponential backoff via DLQ TTL                      │
│  - Max 5 attempts before final DLQ                      │
│  - Dead Letter Exchange for permanent failures         │
└──────────────────────────────────────────────────────────┘
```

### 2.2 Layered Architecture

**Controller Layer:**
- Request validation (Zod schemas)
- Response formatting
- Error handling middleware

**Service Layer:**
- Business logic
- Timezone conversion (Luxon)
- Message scheduling
- External API communication

**Repository Layer:**
- Database abstraction (Drizzle)
- Query optimization
- Transaction management

**Queue Layer:**
- Job creation and processing
- Retry logic
- Dead letter queue management

---

## 3. DATABASE SCHEMA

### 3.1 Users Table

```sql
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- User details
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  email VARCHAR(255) NOT NULL UNIQUE,

  -- Birthday & timezone
  birthday_date DATE NOT NULL,  -- Never convert to UTC!
  timezone VARCHAR(50) NOT NULL,  -- IANA: 'America/New_York'
  location VARCHAR(255),  -- Human-readable location

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ  -- Soft delete for bonus PUT feature
);

-- Indexes for performance
CREATE INDEX idx_users_birthday_month_day
  ON users (EXTRACT(MONTH FROM birthday_date), EXTRACT(DAY FROM birthday_date))
  WHERE deleted_at IS NULL;

CREATE INDEX idx_users_timezone
  ON users (timezone)
  WHERE deleted_at IS NULL;
```

### 3.2 Message Logs Table

```sql
CREATE TABLE message_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  -- Message details
  message_type VARCHAR(50) NOT NULL DEFAULT 'birthday',  -- Future: 'anniversary'
  message_content TEXT NOT NULL,

  -- Scheduling
  scheduled_send_time TIMESTAMPTZ NOT NULL,  -- 9am local → UTC
  actual_send_time TIMESTAMPTZ,

  -- Status tracking
  status VARCHAR(20) NOT NULL DEFAULT 'SCHEDULED',
  -- Values: SCHEDULED, SENDING, SENT, FAILED, RETRYING
  retry_count INTEGER DEFAULT 0,

  -- Idempotency
  idempotency_key VARCHAR(255) NOT NULL UNIQUE,
  -- Format: {userId}:{messageType}:{YYYY-MM-DD}

  -- API response
  api_response_code INTEGER,
  api_response_body TEXT,
  error_message TEXT,

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_message_logs_user_date
  ON message_logs (user_id, scheduled_send_time);

CREATE INDEX idx_message_logs_status
  ON message_logs (status, scheduled_send_time);

CREATE UNIQUE INDEX idx_idempotency
  ON message_logs (idempotency_key);
```

### 3.3 Key Design Decisions

**Birthday as DATE:**
- Store as `DATE` type, NOT `TIMESTAMP`
- Never convert birthdays to UTC
- Birthday is same across all timezones (Feb 15 is always Feb 15)

**Timezone as IANA Identifier:**
- Store "America/New_York", not "-05:00"
- Handles DST transitions automatically
- Use Luxon to convert "9am local" → UTC for scheduling

**Idempotency Key:**
- Format: `{userId}:birthday:{2025-12-30}`
- Unique constraint prevents duplicate messages
- Survives server restarts and retries

**Soft Delete:**
- `deleted_at` column for PUT /user bonus feature
- Allows users to "undelete" if needed
- Maintains referential integrity

---

## 4. IMPLEMENTATION ROADMAP

### Phase 1: Foundation (Week 1)

**Objectives:**
- Project setup with TypeScript + ESM
- Database schema and migrations
- Basic CRUD API endpoints
- Initial unit tests

**Tasks:**
1. Initialize Fastify project with TypeScript
2. Configure Drizzle ORM with PostgreSQL
3. Create database schema and migrations
4. Implement POST /user endpoint with Zod validation
5. Implement DELETE /user endpoint with soft delete
6. Write unit tests for controllers and services
7. Set up ESLint, Prettier, Husky

**Deliverables:**
- Working API with user creation/deletion
- Database schema deployed
- 70%+ code coverage on core logic

---

### Phase 2: Scheduler Infrastructure (Week 2)

**Objectives:**
- Timezone conversion logic
- BullMQ job queue setup
- Basic scheduler implementation
- Integration tests

**Tasks:**
1. Install and configure Redis + BullMQ
2. Implement Luxon timezone conversion service
3. Create daily CRON job (calculate birthdays for day)
4. Create minute CRON job (enqueue messages)
5. Implement BullMQ worker pool (5 workers)
6. Write integration tests with Testcontainers
7. Test timezone edge cases (DST, leap years)

**Deliverables:**
- Working scheduler that enqueues jobs at correct time
- Timezone conversion tested for 10+ timezones
- Integration tests with real PostgreSQL

---

### Phase 3: Message Delivery & Resilience (Week 3)

**Objectives:**
- External API integration
- Retry logic with exponential backoff
- Circuit breaker pattern
- Idempotency guarantees

**Tasks:**
1. Implement Got HTTP client with retry logic
2. Add Opossum circuit breaker
3. Implement Redlock distributed locks
4. Add idempotency key generation and validation
5. Create retry mechanism (5 attempts, exponential backoff)
6. Implement Dead Letter Queue for permanent failures
7. Write E2E tests for full message flow

**Deliverables:**
- Messages successfully sent to external API
- Retry logic verified with simulated failures
- Zero duplicate messages in concurrent scenarios

---

### Phase 4: Recovery & Bonus Features (Week 4)

**Objectives:**
- Recovery from downtime
- PUT /user endpoint (bonus)
- Advanced testing
- Production-ready error handling

**Tasks:**
1. Implement recovery CRON job (missed messages)
2. Add PUT /user endpoint with timezone update logic
3. Test recovery after simulated 24h downtime
4. Add structured logging (Pino)
5. Implement health check endpoints
6. Write race condition tests
7. Write recovery scenario tests

**Deliverables:**
- System recovers from downtime automatically
- PUT /user working with existing birthday schedules
- 85%+ code coverage

---

### Phase 5: Performance & Load Testing (Week 5)

**Objectives:**
- Performance testing with k6
- Database query optimization
- Scalability verification
- Monitoring setup

**Tasks:**
1. Write k6 performance test scripts
2. Load test API endpoints (1000+ req/s)
3. Load test scheduler (10,000 birthdays/day)
4. Optimize database indexes based on query analysis
5. Add database connection pooling
6. Implement metrics endpoints (Prometheus format)
7. Document performance benchmarks

**Deliverables:**
- System handles 10,000+ birthdays/day
- API p99 response time < 1 second
- Performance regression tests in CI/CD

---

### Phase 6: CI/CD & Deployment (Week 6)

**Objectives:**
- GitHub Actions pipeline
- Docker deployment
- Security hardening
- Documentation

**Tasks:**
1. Create GitHub Actions workflow (lint, test, coverage)
2. Configure parallel test execution (5 shards)
3. Set up PostgreSQL and Redis service containers
4. Create Dockerfile and docker-compose.yml
5. Add security scanning (npm audit, Snyk)
6. Write deployment documentation
7. Create API documentation (Swagger/OpenAPI)

**Deliverables:**
- CI/CD pipeline < 10 minutes
- Docker deployment working locally
- Complete API and deployment documentation

---

### Phase 7: Production Hardening (Week 7)

**Objectives:**
- Final testing and optimization
- Security audit
- Production deployment guide
- Team handoff

**Tasks:**
1. Final security audit and fixes
2. Stress testing under extreme load
3. Graceful shutdown testing
4. Production deployment guide
5. Runbook for operations team
6. Final code review and cleanup
7. Team knowledge transfer

**Deliverables:**
- Production-ready application
- Complete operational documentation
- Deployment checklist

---

## 5. TESTING STRATEGY INTEGRATION

### 5.1 Test Coverage Goals

| Test Type | Coverage | Execution Time | Priority |
|-----------|----------|----------------|----------|
| Unit Tests | 85%+ | < 30 seconds | Critical |
| Integration Tests | 80%+ | < 2 minutes | High |
| E2E Tests | 75%+ | < 5 minutes | High |
| Performance Tests | - | < 5 minutes | Medium |
| Critical Paths | 95%+ | - | Critical |

### 5.2 Test Pyramid

```
         E2E Tests (20%)
        /--------------\
       /                \
      /  Integration (30%)\
     /____________________\
    /                      \
   /    Unit Tests (50%)    \
  /________________________  \
```

### 5.3 Critical Test Scenarios

**Unit Tests (30+ test cases):**
1. Timezone conversion (10 timezones)
2. Birthday detection (leap years, DST)
3. Idempotency key generation
4. Retry logic (exponential backoff)
5. Input validation (Zod schemas)
6. Circuit breaker state transitions

**Integration Tests (20+ scenarios):**
1. Database transactions with Testcontainers
2. BullMQ job processing
3. Distributed lock acquisition/release
4. External API with MSW mocks
5. Recovery job finding missed messages

**E2E Tests (15+ workflows):**
1. Create user → birthday detected → message sent
2. Update user timezone → message rescheduled
3. Delete user → future messages cancelled
4. Concurrent user creation (race conditions)
5. System restart → message recovery

**Performance Tests:**
1. API load: 1000 concurrent requests
2. Scheduler load: 10,000 birthdays/day
3. Database query performance (< 100ms)
4. Worker pool throughput

### 5.4 Test File Structure

```
tests/
├── unit/
│   ├── controllers/
│   │   └── user.controller.test.ts
│   ├── services/
│   │   ├── timezone.service.test.ts
│   │   ├── scheduler.service.test.ts
│   │   └── message.service.test.ts
│   └── utils/
│       └── idempotency.test.ts
├── integration/
│   ├── database/
│   │   └── user.repository.test.ts
│   ├── queue/
│   │   └── birthday-worker.test.ts
│   └── api/
│       └── external-email.test.ts
├── e2e/
│   ├── user-lifecycle.test.ts
│   ├── birthday-flow.test.ts
│   └── recovery.test.ts
├── performance/
│   ├── api-load.test.ts
│   └── scheduler-load.test.ts
└── helpers/
    ├── test-database.ts
    ├── test-server.ts
    └── fixtures/
```

---

## 6. GITHUB ACTIONS CI/CD

### 6.1 Complete Workflow

```yaml
name: CI/CD Pipeline

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main, develop]

jobs:
  # Job 1: Lint & Type Check (~1 minute)
  lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: 'npm'
      - run: npm ci
      - run: npm run lint
      - run: npm run typecheck

  # Job 2: Unit Tests (~2 minutes, parallel sharding)
  unit-tests:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        shard: [1, 2, 3, 4, 5]
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: 'npm'
      - run: npm ci
      - run: npm run test:unit -- --shard=${{ matrix.shard }}/5
      - uses: actions/upload-artifact@v4
        with:
          name: coverage-unit-${{ matrix.shard }}
          path: coverage/

  # Job 3: Integration Tests (~3 minutes)
  integration-tests:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:15
        env:
          POSTGRES_PASSWORD: test
          POSTGRES_DB: birthday_test
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
        ports:
          - 5432:5432
      redis:
        image: redis:7
        options: >-
          --health-cmd "redis-cli ping"
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
        ports:
          - 6379:6379
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: 'npm'
      - run: npm ci
      - run: npm run test:integration
        env:
          DATABASE_URL: postgresql://postgres:test@localhost:5432/birthday_test
          REDIS_URL: redis://localhost:6379
      - uses: actions/upload-artifact@v4
        with:
          name: coverage-integration
          path: coverage/

  # Job 4: E2E Tests (~4 minutes)
  e2e-tests:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:15
        env:
          POSTGRES_PASSWORD: test
          POSTGRES_DB: birthday_test
        ports:
          - 5432:5432
      redis:
        image: redis:7
        ports:
          - 6379:6379
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: 'npm'
      - run: npm ci
      - run: npm run test:e2e
        env:
          DATABASE_URL: postgresql://postgres:test@localhost:5432/birthday_test
          REDIS_URL: redis://localhost:6379
      - uses: actions/upload-artifact@v4
        with:
          name: coverage-e2e
          path: coverage/

  # Job 5: Performance Tests (PR only, ~5 minutes)
  performance-tests:
    if: github.event_name == 'pull_request'
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:15
        env:
          POSTGRES_PASSWORD: test
        ports:
          - 5432:5432
      redis:
        image: redis:7
        ports:
          - 6379:6379
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: 'npm'
      - run: npm ci
      - run: npm run build
      - run: npm start &
      - run: npm run test:performance
      - uses: actions/upload-artifact@v4
        with:
          name: performance-report
          path: performance-report.html

  # Job 6: Merge Coverage & Report
  coverage:
    needs: [unit-tests, integration-tests, e2e-tests]
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/download-artifact@v4
        with:
          path: coverage-artifacts/
      - run: npm run coverage:merge
      - run: npm run coverage:report
      - uses: codecov/codecov-action@v4
        with:
          files: ./coverage/coverage-final.json

  # Job 7: Security Scan
  security:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - run: npm audit --production
      - uses: snyk/actions/node@master
        env:
          SNYK_TOKEN: ${{ secrets.SNYK_TOKEN }}
```

### 6.2 Pipeline Execution Time

| Job | Duration | Parallel? |
|-----|----------|-----------|
| Lint | 1 min | Yes |
| Unit Tests | 2 min | Yes (5 shards) |
| Integration Tests | 3 min | Yes |
| E2E Tests | 4 min | Yes |
| Performance Tests | 5 min | Conditional (PR only) |
| Coverage Merge | 1 min | No |
| Security Scan | 2 min | Yes |

**Total Pipeline Time:** ~5 minutes (parallel execution)

---

## 7. CRITICAL SUCCESS FACTORS

### 7.1 Timezone Handling

**✅ Correct Approach:**
- Store birthday as `DATE` (never convert to UTC)
- Store timezone as IANA identifier ("America/New_York")
- Use Luxon to calculate "9am local time" in UTC
- Handle DST transitions automatically

**❌ Common Pitfalls to Avoid:**
- Storing birthday as TIMESTAMP with timezone
- Storing UTC offset instead of IANA identifier
- Using deprecated moment.js
- Hardcoding timezone offsets

### 7.2 Exactly-Once Delivery

**✅ Guarantees:**
- Idempotency key: `{userId}:birthday:{date}`
- Unique database constraint prevents duplicates
- Distributed lock (Redlock) for concurrent workers
- Retry only on network/5xx errors, not 4xx

**❌ Common Pitfalls:**
- No idempotency key (duplicates possible)
- No distributed locks (race conditions)
- Retrying on 4xx errors (waste resources)

### 7.3 Scalability

**✅ Design Patterns:**
- BullMQ with Redis (distributed job processing)
- Database connection pooling (max 20 per instance)
- Indexed queries (birthday lookup < 100ms)
- Horizontal scaling (multiple worker instances)

**Target Performance:**
- 10,000 birthdays/day
- 1000+ concurrent API requests
- p99 response time < 1 second

### 7.4 Fault Tolerance

**✅ Resilience Patterns:**
- Retry with exponential backoff (5 attempts)
- Circuit breaker (prevent cascading failures)
- Dead Letter Queue (permanent failures)
- Recovery job (missed messages after downtime)

### 7.5 Testing Coverage

**✅ Quality Gates:**
- 85%+ overall code coverage
- 95%+ coverage on critical paths (timezone, scheduling, idempotency)
- All race condition scenarios tested
- Load testing validates 10,000 birthdays/day
- CI/CD pipeline blocks PRs with <80% coverage

---

## 8. RISK MITIGATION

### 8.1 Identified Risks

| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|------------|
| External API downtime | High | Medium | Circuit breaker + retry + DLQ |
| Race conditions (duplicates) | High | Medium | Distributed locks + idempotency |
| Timezone bugs (DST) | High | Low | Luxon + comprehensive tests |
| Database performance | Medium | Low | Indexing + query optimization |
| Redis/BullMQ failure | High | Low | Persistent jobs + recovery CRON |
| Leap year edge cases | Low | Low | Unit tests cover Feb 29 |

### 8.2 Monitoring & Alerting

**Metrics to Monitor:**
- Queue depth (alert if > 1000)
- Message delivery rate (alert if < 90%)
- Circuit breaker state (alert if OPEN)
- Database connection pool utilization
- API response times (p99)
- Error rate per endpoint

**Logging Strategy:**
- Structured logging with Pino
- Log levels: DEBUG, INFO, WARN, ERROR
- Include request IDs for tracing
- Log all retry attempts
- Log timezone conversions for debugging

---

## 9. DELIVERABLES CHECKLIST

### Phase 1-2 (Weeks 1-2): MVP

- [ ] Fastify API with POST/DELETE /user endpoints
- [ ] PostgreSQL database with schema and migrations
- [ ] BullMQ scheduler infrastructure
- [ ] Timezone conversion with Luxon
- [ ] Unit + integration tests (70%+ coverage)

### Phase 3-4 (Weeks 3-4): Production Features

- [ ] External API integration with retry logic
- [ ] Circuit breaker and distributed locks
- [ ] Idempotency guarantees
- [ ] Recovery from downtime
- [ ] PUT /user endpoint (bonus)
- [ ] E2E tests (80%+ coverage)

### Phase 5-6 (Weeks 5-6): Performance & Deployment

- [ ] k6 performance tests
- [ ] 10,000 birthdays/day verified
- [ ] GitHub Actions CI/CD pipeline
- [ ] Docker deployment
- [ ] API documentation (Swagger)

### Phase 7 (Week 7): Production Readiness

- [ ] Security audit passed
- [ ] 85%+ code coverage achieved
- [ ] All tests passing in CI/CD
- [ ] Deployment documentation complete
- [ ] Operational runbook created

---

## 10. FINAL RECOMMENDATIONS

### From Researcher Agent

- Use **Luxon** (not moment.js) for timezone handling
- Use **BullMQ** (not node-cron) for job persistence
- Use **Got + Opossum** for HTTP resilience
- Follow **exponential backoff** pattern for retries
- Implement **distributed locks** with Redlock

### From Analyst Agent

- Use **hybrid CRON + queue architecture** for scalability
- Store birthdays as **DATE** (not TIMESTAMPTZ)
- Use **IANA timezone identifiers** (not offsets)
- Implement **soft delete** for PUT /user feature
- Design for **horizontal scaling** from day one

### From Coder Agent

- Use **Fastify** (best balance of speed + features)
- Use **Drizzle** (lightweight, SQL-first)
- Use **PostgreSQL + Redis** (proven, scalable)
- Use **Zod** for runtime validation
- Follow **layered architecture** (controller/service/repository)

### From Tester Agent

- Use **Vitest** (30-70% faster than Jest)
- Use **Testcontainers** for integration tests
- Use **k6** for performance testing
- Target **85%+ coverage** with quality gates
- Implement **parallel test execution** in CI/CD

---

## 11. NEXT STEPS

### Immediate Actions (Post-Planning)

1. **Get Approval**
   - Review this plan with stakeholders
   - Confirm technology stack choices
   - Agree on timeline (7 weeks)

2. **Setup Development Environment**
   - Install Node.js 20+, PostgreSQL 15+, Redis 7+
   - Initialize Git repository
   - Create project structure

3. **Begin Phase 1 Implementation**
   - Follow the 7-week roadmap
   - Start with foundation (Week 1)
   - Track progress weekly

4. **Regular Reviews**
   - Weekly progress check-ins
   - Code reviews for all PRs
   - Architecture reviews at phase boundaries

---

## APPENDIX: DOCUMENT REFERENCES

All detailed documentation created by the Hive Mind agents:

1. **ARCHITECTURE_ANALYSIS.md** - 64KB, comprehensive system design
2. **SYSTEM_FLOWS.md** - 48KB, data flows and diagrams
3. **TECHNICAL_SPECIFICATIONS.md** - 40KB, code examples and schemas
4. **ARCHITECTURE_DECISIONS.md** - 20KB, 12 ADRs with rationale
5. **TESTING_STRATEGY.md** - 77KB, complete testing guide
6. **TESTING_SUMMARY.md** - 6.8KB, quick testing reference
7. **TEST_FILE_STRUCTURE.md** - 19KB, test organization
8. **TECHNOLOGY_STACK_PROPOSAL.md** - 28KB, detailed tech evaluation
9. **TECH_STACK_SUMMARY.md** - 4KB, quick tech reference
10. **ANALYST_SUMMARY.md** - 16KB, architecture overview
11. **ANALYSIS_INDEX.md** - 16KB, navigation guide
12. **Research Report** - 90+ sources, December 2025 best practices

**Total Documentation:** ~400KB, ~250 pages

---

## CONCLUSION

This master implementation plan represents the collective intelligence of four specialized agents, researching and planning based on December 2025 best practices. The plan is:

✅ **Comprehensive** - Covers architecture, technology, testing, deployment
✅ **Research-Based** - 90+ authoritative sources from Dec 2025
✅ **Production-Ready** - Scalable, fault-tolerant, well-tested
✅ **Actionable** - 7-week roadmap with clear deliverables
✅ **Backend-Focused** - No UI, focus on APIs, scheduler, testing

**Status:** Ready for implementation approval and Phase 1 kickoff.

---

**Prepared by:** Hive Mind Collective (Queen + 4 Specialized Agents)
**Date:** December 30, 2025
**Version:** 1.0 - Research & Planning Phase Complete
**Next Phase:** Begin Implementation (Week 1 - Foundation)
