# Birthday Message Scheduler - Architecture Overview

**Last Updated:** 2025-12-30

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [System Architecture](#system-architecture)
3. [Key Architecture Decisions](#key-architecture-decisions)
4. [Tech Stack](#tech-stack)
5. [Message Type Abstraction](#message-type-abstraction)
6. [Database Design](#database-design)
7. [Scalability Strategy](#scalability-strategy)

---

## Executive Summary

This document provides the complete architectural overview for a timezone-aware birthday message scheduler capable of handling **1M+ messages/day** with exactly-once delivery guarantees and support for multiple message types (birthday, anniversary, etc.).

### Core Requirements

1. **Scale:** Handle 1M+ messages/day (11.5 msg/sec sustained, 100+ msg/sec peak)
2. **Abstraction:** Support multiple message types without modifying core logic
3. **Reliability:** Exactly-once delivery with idempotency guarantees
4. **Timezone Awareness:** Send at 9am in each user's local timezone
5. **Testability:** Simple E2E tests in CI/CD, scalable performance tests

### Key Architectural Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| **Queue System** | RabbitMQ (Quorum Queues) | Zero data loss, native persistence, battle-tested for critical messages |
| **Database** | PostgreSQL 15 + Partitioning | ACID guarantees, monthly partitions for 10-100x query speedup |
| **ORM** | Drizzle ORM | Type-safe, lightweight, better DX than Prisma |
| **API Framework** | Fastify | Faster than Express, built-in TypeScript support |
| **Message Pattern** | Strategy Pattern | Add new message types without core changes |
| **Timezone Storage** | IANA Identifiers | Handles DST automatically (e.g., "America/New_York") |
| **Idempotency** | DB Unique Constraints | Prevent duplicates via `(user_id, message_type, date)` unique index |
| **Scheduler** | Hybrid CRON + Queue | Daily pre-calc + minute enqueue + worker pool |
| **Testing** | Vitest + k6 + Docker Compose | Unit/integration/E2E + performance testing |
| **CI/CD** | GitHub Actions | Simple E2E (4 containers), scalable perf tests (24 containers) |

---

## System Architecture

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────┐
│                  Nginx Load Balancer                     │
│         (Round-robin, SSL/TLS, Rate limiting)            │
└────────────────────┬────────────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────────────┐
│            API Servers (5 replicas)                      │
│  POST /user  |  DELETE /user  |  PUT /user              │
│  Fastify + TypeScript + Drizzle ORM                     │
└────────────────────┬────────────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────────────┐
│    PostgreSQL 15 (Primary + Read Replica)               │
│  - Partitioned message_logs (by month)                  │
│  - Connection pool: 360 connections                     │
│  - Indexes: birthday_date, anniversary_date, etc.       │
└────────────────────┬────────────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────────────┐
│         RabbitMQ (Quorum Queues + DLQ)                   │
│  - 10K msg/sec capacity (100x your peak)                │
│  - Zero data loss (Raft consensus replication)          │
│  - Native message persistence to disk                   │
│  - Dead letter exchange (DLX) for failed messages       │
└────────────────────┬────────────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────────────┐
│         Workers (10 baseline, 30 max)                    │
│  - Generic workers (Strategy pattern)                   │
│  - 5 concurrent jobs per worker                         │
│  - Circuit breaker for email API                        │
└──────────────────────────────────────────────────────────┘
```

### Scheduler Architecture

```
┌─────────────────────────────────────────────────────────┐
│                 Unified Scheduler                        │
│                                                          │
│  Daily CRON (00:00 UTC):                                │
│  ├─ Iterate all MessageStrategy types                   │
│  ├─ Find users with birthdays/anniversaries today       │
│  ├─ Pre-calculate send times (9am local timezone)       │
│  └─ Create message_logs entries                         │
│                                                          │
│  Minute CRON (every 1 min):                             │
│  ├─ Find messages scheduled in next hour                │
│  └─ Publish to RabbitMQ (with x-delay for scheduling)   │
│                                                          │
│  Recovery CRON (every 10 min):                          │
│  ├─ Find missed/failed messages (past 24h)              │
│  └─ Re-enqueue for retry                                │
└──────────────────────────────────────────────────────────┘
```

---

## Key Architecture Decisions

### ADR-001: Hybrid CRON + Queue Architecture

**Status:** ✅ Accepted

**Decision:**
Implement a hybrid architecture combining:
1. Daily CRON job (midnight UTC) to pre-calculate send times
2. Minute-by-minute CRON to enqueue messages in the next hour
3. RabbitMQ (Quorum Queues) for distributed job processing
4. Worker pool (5 concurrent per instance) for message delivery

**Rationale:**
- ✅ Scales horizontally (add more worker instances)
- ✅ Testable components (CRON, queue, workers separated)
- ✅ Fault-tolerant (native message persistence, zero data loss)
- ✅ Efficient (pre-calculation reduces real-time computation)
- ✅ Critical message durability (birthdays happen once a year!)

**Alternatives Rejected:**
- Pure CRON: Doesn't scale, hard to test
- Pure Event Sourcing: Over-engineering for this use case
- Database polling: Inefficient, high DB load
- BullMQ: Risk of data loss on Redis crash (up to 1 second with AOF everysec)

### ADR-002: Store IANA Timezone Identifiers

**Status:** ✅ Accepted

**Decision:**
Store IANA timezone identifiers (e.g., "America/New_York", "Europe/London") instead of UTC offsets.

**Rationale:**
- ✅ Automatically handles DST transitions
- ✅ Works with `luxon` library
- ✅ Future-proof (IANA database maintained)

**Alternatives Rejected:**
- UTC offset: Breaks during DST
- Timezone abbreviation: Ambiguous (EST = Eastern or Australian?)

### ADR-003: Idempotency via Database Constraints

**Status:** ✅ Accepted

**Decision:**
Prevent duplicate messages using database unique constraints:
```sql
CREATE UNIQUE INDEX idx_message_idempotency
ON message_logs (user_id, message_type, delivery_date);
```

**Rationale:**
- ✅ Database enforces idempotency (no race conditions)
- ✅ Simpler than distributed locks
- ✅ No external dependencies (Redis Redlock unsafe anyway)

**Alternatives Rejected:**
- Redis Redlock: Unsafe (lacks fencing tokens)
- Application-level locks: Race conditions possible

### ADR-004: Strategy Pattern for Message Types

**Status:** ✅ Accepted

**Decision:**
Use Strategy Pattern to abstract message types (birthday, anniversary, etc.):

```typescript
interface MessageStrategy {
  readonly messageType: string;
  shouldSend(user: User, date: Date): Promise<boolean>;
  calculateSendTime(user: User, date: Date): Date;
  composeMessage(user: User, context: MessageContext): Promise<string>;
  getSchedule(): Schedule;
  validate(user: User): ValidationResult;
}
```

**Rationale:**
- ✅ Add new message types without modifying core code
- ✅ Each message type is independently testable
- ✅ Factory pattern for runtime strategy selection

**Alternatives Rejected:**
- Hardcoded types: Not extensible
- Plugin architecture: Over-engineering

### ADR-005: RabbitMQ (Not BullMQ or Redpanda)

**Status:** ✅ Accepted

**Decision:**
Use RabbitMQ with Quorum Queues for all message processing.

**Critical Concern with BullMQ:**
- ❌ **BullMQ data loss risk:** Up to 1 second of jobs lost on Redis crash (12-100 birthday messages)
- ❌ **Depends on Redis persistence:** AOF everysec or RDB snapshots both have data loss windows
- ❌ **Unacceptable for birthday messages:** Birthdays happen once a year, missing one loses customers

**Rationale for RabbitMQ:**
- ✅ **Zero data loss:** Quorum queues use Raft consensus with synchronous replication
- ✅ **Native persistence:** Messages written to disk before acknowledgment
- ✅ **Battle-tested:** 15+ years in production (Goldman Sachs, NASA, Mozilla)
- ✅ **Sufficient performance:** 10K msg/sec capacity >> 100 msg/sec peak need
- ✅ **Worth the cost:** $556/month extra prevents customer churn from missed birthdays

**Why Not Redpanda:**
- Still overkill for 1M msg/day (handles billions)
- More complex setup than RabbitMQ
- Higher cost and operational overhead

### ADR-006: Database Partitioning (Mandatory for 1M+ scale)

**Status:** ✅ Accepted

**Decision:**
Partition `message_logs` table by `scheduled_send_time` (monthly partitions):

```sql
CREATE TABLE message_logs (...)
PARTITION BY RANGE (scheduled_send_time);

CREATE TABLE message_logs_2025_01 PARTITION OF message_logs
  FOR VALUES FROM ('2025-01-01') TO ('2025-02-01');
```

**Rationale:**
- ✅ 10-100x query performance (only scans relevant partition)
- ✅ Easy data retention (DROP partition vs slow DELETE)
- ✅ Parallel query execution

**Alternatives Rejected:**
- No partitioning: Queries become slow with millions of rows
- Sharding: Over-complex for single-server deployment

---

## Tech Stack

### Backend

- **Language:** TypeScript 5.3+
- **Runtime:** Node.js 20 LTS
- **API Framework:** Fastify 4.x
- **ORM:** Drizzle ORM
- **Validation:** Zod
- **Date/Time:** Luxon (IANA timezone support)

### Database

- **Database:** PostgreSQL 15
- **Partitioning:** Monthly partitions
- **Connection Pooling:** pg + pgbouncer

### Queue & Workers

- **Queue:** RabbitMQ 3.12+ (Quorum Queues)
- **Workers:** Node.js processes (horizontal scaling)
- **Client Library:** amqplib (or amqp-connection-manager for reconnection)

### Testing

- **Unit/Integration:** Vitest
- **E2E:** Supertest + Docker Compose
- **Performance:** k6 + pgbench
- **Mocking:** Email service (MockServer)

### DevOps

- **Containerization:** Docker + Docker Compose
- **CI/CD:** GitHub Actions
- **Monitoring:** Prometheus + Grafana
- **Logging:** Structured JSON logs + Loki

---

## Message Type Abstraction

### Strategy Pattern Implementation

```typescript
// Strategy interface
export interface MessageStrategy {
  readonly messageType: string;
  shouldSend(user: User, date: Date): Promise<boolean>;
  calculateSendTime(user: User, date: Date): Date;
  composeMessage(user: User, context: MessageContext): Promise<string>;
  getSchedule(): Schedule;
  validate(user: User): ValidationResult;
}

// Birthday implementation
export class BirthdayMessageStrategy implements MessageStrategy {
  readonly messageType = 'BIRTHDAY';

  async shouldSend(user: User, date: Date): Promise<boolean> {
    return user.birthdayDate.getMonth() === date.getMonth() &&
           user.birthdayDate.getDate() === date.getDate();
  }

  calculateSendTime(user: User, date: Date): Date {
    // 9am in user's timezone
    return DateTime.fromJSDate(date)
      .setZone(user.timezone)
      .set({ hour: 9, minute: 0, second: 0 })
      .toUTC()
      .toJSDate();
  }

  async composeMessage(user: User, context: MessageContext): Promise<string> {
    const age = context.currentYear - user.birthdayDate.getFullYear();
    return `Hey, ${user.firstName} ${user.lastName} it's your birthday! Happy ${age}th!`;
  }

  getSchedule(): Schedule {
    return { cadence: 'YEARLY', triggerField: 'birthdayDate' };
  }

  validate(user: User): ValidationResult {
    return {
      valid: !!user.birthdayDate && !!user.timezone,
      errors: []
    };
  }
}

// Factory for strategy selection
export class MessageStrategyFactory {
  private strategies: Map<string, MessageStrategy> = new Map();

  register(strategy: MessageStrategy): void {
    this.strategies.set(strategy.messageType, strategy);
  }

  get(messageType: string): MessageStrategy {
    const strategy = this.strategies.get(messageType);
    if (!strategy) throw new Error(`No strategy for ${messageType}`);
    return strategy;
  }

  getAllTypes(): string[] {
    return Array.from(this.strategies.keys());
  }
}

// Bootstrap
const factory = new MessageStrategyFactory();
factory.register(new BirthdayMessageStrategy());
factory.register(new AnniversaryMessageStrategy()); // Future
```

### Adding New Message Type (Example: Anniversary)

**Only 3 steps:**

1. Create strategy file (`src/strategies/AnniversaryMessageStrategy.ts`)
2. Register with factory (`factory.register(new AnniversaryMessageStrategy())`)
3. Add database column (`ALTER TABLE users ADD COLUMN anniversary_date DATE`)

**Zero changes** to workers, schedulers, or queue logic!

---

## Database Design

### Users Table

```sql
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  timezone VARCHAR(100) NOT NULL, -- IANA timezone (e.g., "America/New_York")

  -- Date fields for different message types
  birthday_date DATE,
  anniversary_date DATE,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

-- Partial indexes (only non-deleted users with dates)
CREATE INDEX idx_users_birthday
ON users(birthday_date)
WHERE deleted_at IS NULL AND birthday_date IS NOT NULL;

CREATE INDEX idx_users_anniversary
ON users(anniversary_date)
WHERE deleted_at IS NULL AND anniversary_date IS NOT NULL;
```

### Message Logs Table (Partitioned)

```sql
CREATE TABLE message_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  -- Message type discriminator
  message_type VARCHAR(50) NOT NULL, -- 'BIRTHDAY', 'ANNIVERSARY', etc.

  -- Scheduling
  scheduled_send_time TIMESTAMPTZ NOT NULL,
  actual_send_time TIMESTAMPTZ,

  -- Status
  status VARCHAR(20) NOT NULL DEFAULT 'SCHEDULED',
  retry_count INTEGER DEFAULT 0,

  -- Idempotency (prevents duplicates)
  idempotency_key VARCHAR(255) UNIQUE NOT NULL,

  -- Pre-composed message
  message_content TEXT NOT NULL,

  -- API response tracking
  api_response_code INTEGER,
  error_message TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW()
) PARTITION BY RANGE (scheduled_send_time);

-- Monthly partitions (create programmatically)
CREATE TABLE message_logs_2025_01 PARTITION OF message_logs
  FOR VALUES FROM ('2025-01-01') TO ('2025-02-01');

-- Composite index for scheduler queries
CREATE INDEX idx_message_logs_scheduler
ON message_logs(message_type, status, scheduled_send_time);
```

---

## Scalability Strategy

### Horizontal Scaling

| Component | Baseline | Peak | Max |
|-----------|----------|------|-----|
| **API Servers** | 5 replicas | 5 replicas | 10 replicas |
| **Workers** | 10 instances | 20 instances | 30 instances |
| **Database** | Primary + 1 replica | Primary + 1 replica | Primary + 2 replicas |
| **Redis** | Single instance | Single instance | Cluster (3 nodes) |

### Capacity Planning

**1M messages/day:**
- Average: 11.5 msg/sec
- Peak (9am timezone clustering): 100 msg/sec

**RabbitMQ Capacity:**
- Throughput: 10,000+ msg/sec (100x headroom)
- Quorum Queues: Zero data loss with Raft consensus
- Workers: 10 baseline × 5 concurrent jobs = 50 msg/sec baseline capacity
- Auto-scale to 30 workers = 150 msg/sec capacity

**Database Capacity:**
- Writes: 1,000 writes/sec (100x headroom)
- Reads: 10,000 reads/sec (100x headroom)
- Partitioning: 10-100x query speedup

### Cost Estimates

**AWS Production:**
- API + Workers: $500/month
- RDS PostgreSQL: $400/month
- Amazon MQ (RabbitMQ 3-node): $702/month
- Load balancer + monitoring: $100/month
- **Total: $1,702/month**

**Note:** RabbitMQ costs $556/month more than BullMQ+Redis, but prevents data loss that could lose customers.

**Localhost Development:**
- Electricity: $20/month
- Internet: $10/month
- **Total: $30/month**

---

## Next Steps

1. **Read:** [`master-plan.md`](../05-implementation/master-plan.md) for implementation roadmap
2. **Setup:** [`docker-compose.md`](./docker-compose.md) for local development
3. **Testing:** [`testing-strategy.md`](../04-testing/testing-strategy.md) for test approach
4. **Scale:** [`high-scale-design.md`](./high-scale-design.md) for 1M+ msg/day details
