# 02. Architecture & Design

**Navigation:** [← Back to Plan](../README.md)

This directory contains all architectural designs, decisions, and technical documentation for the Birthday Message Scheduler system.

---

## Overview

Comprehensive architecture documentation covering system design, infrastructure, monitoring, CI/CD, and high-scale considerations for handling 1M+ messages/day.

---

## Quick Navigation

### Start Here

- **System Architecture:** [`architecture-overview.md`](./architecture-overview.md) - Complete system architecture
- **High-Scale Design:** [`high-scale-design.md`](./high-scale-design.md) - Scaling to 1M+ messages/day
- **Docker Setup:** [`docker-compose.md`](./docker-compose.md) - Container orchestration

### Key Decisions

- **Message Queue:** [`ARCHITECTURE_CHANGE_RABBITMQ.md`](./ARCHITECTURE_CHANGE_RABBITMQ.md) - Why RabbitMQ over BullMQ
- **Monitoring:** [`monitoring.md`](./monitoring.md) - Observability architecture
- **CI/CD:** [`cicd-pipeline.md`](./cicd-pipeline.md) - Deployment pipeline

---

## Document Index

| Document | Description | Status | Size |
|----------|-------------|--------|------|
| [`architecture-overview.md`](./architecture-overview.md) | Complete system architecture and design patterns | ✅ Final | ~80KB |
| [`high-scale-design.md`](./high-scale-design.md) | Architecture for 1M+ messages/day with auto-scaling | ✅ Final | ~120KB |
| [`docker-compose.md`](./docker-compose.md) | Docker Compose setup (dev, test, prod, perf) | ✅ Final | ~65KB |
| [`cicd-pipeline.md`](./cicd-pipeline.md) | GitHub Actions CI/CD pipeline architecture | ✅ Final | ~55KB |
| [`monitoring.md`](./monitoring.md) | Prometheus + Grafana monitoring architecture | ✅ Final | ~45KB |
| [`ARCHITECTURE_CHANGE_RABBITMQ.md`](./ARCHITECTURE_CHANGE_RABBITMQ.md) | Decision: BullMQ → RabbitMQ (zero data loss) | ✅ Final | ~35KB |

**Total Documentation:** ~400KB

---

## Architecture Layers

### 1. API Layer

```
┌─────────────────────────────────────────┐
│      Nginx Load Balancer (80/443)       │
└───────────────┬─────────────────────────┘
                │
┌───────────────▼─────────────────────────┐
│     Fastify API Servers (5 replicas)    │
│  • POST /user  • DELETE /user           │
│  • PUT /user   • Health checks          │
└───────────────┬─────────────────────────┘
```

**Key Features:**
- Fastify framework (high performance)
- OpenAPI 3.1 documentation
- Input validation (Zod schemas)
- Rate limiting and throttling
- Health check endpoints

### 2. Database Layer

```
┌─────────────────────────────────────────┐
│   PostgreSQL 15 (Primary + Replica)     │
│  • Monthly partitions (message_logs)    │
│  • Connection pool: 360 connections     │
│  • PITR backups (30 days)               │
└───────────────┬─────────────────────────┘
```

**Key Features:**
- Drizzle ORM (type-safe queries)
- Monthly partitioning (10-100x perf)
- Read replicas for analytics
- Automated backups
- Connection pooling

### 3. Message Queue Layer

```
┌─────────────────────────────────────────┐
│    RabbitMQ 3.12+ (Quorum Queues)       │
│  • Zero data loss (quorum queues)       │
│  • DLQ for failed messages              │
│  • 10K msg/sec throughput               │
└───────────────┬─────────────────────────┘
```

**Key Features:**
- Quorum queues (zero data loss)
- Dead Letter Queue (DLQ)
- Native persistence
- High throughput (10K msg/sec)
- **Why RabbitMQ:** See [`ARCHITECTURE_CHANGE_RABBITMQ.md`](./ARCHITECTURE_CHANGE_RABBITMQ.md)

### 4. Worker Layer

```
┌─────────────────────────────────────────┐
│    Workers (10 baseline, 30 max)        │
│  • Strategy pattern for message types   │
│  • Circuit breaker & retry logic        │
│  • Idempotency guarantees               │
└─────────────────────────────────────────┘
```

**Key Features:**
- Strategy pattern (Birthday, Anniversary)
- Horizontal auto-scaling
- Circuit breaker pattern
- Exponential backoff retry
- Graceful shutdown

### 5. Monitoring Layer

```
┌─────────────────────────────────────────┐
│   Prometheus + Grafana + Alertmanager   │
│  • 100+ metrics tracked                 │
│  • 6 dashboards                         │
│  • 40+ alert rules                      │
└─────────────────────────────────────────┘
```

**Key Features:**
- 100% observability
- Real-time dashboards
- Multi-level alerts (Critical, Warning, Info, SLO)
- Custom exporters (Postgres, RabbitMQ)

---

## Design Patterns

### Strategy Pattern
**Purpose:** Support multiple message types (Birthday, Anniversary, etc.)

**Benefits:**
- Add new message types with 1 file (~50 lines)
- Zero changes to core workers
- Type-safe TypeScript implementation

**Implementation:**
```typescript
interface MessageStrategy {
  format(user: User): string;
  validate(user: User): boolean;
}

class BirthdayStrategy implements MessageStrategy { }
class AnniversaryStrategy implements MessageStrategy { }
```

### Circuit Breaker Pattern
**Purpose:** Prevent cascading failures

**Configuration:**
- Failure threshold: 50% (5/10 requests)
- Timeout: 30 seconds
- Half-open retry: 60 seconds

### Retry Pattern
**Purpose:** Handle transient failures

**Configuration:**
- Max attempts: 3
- Backoff: Exponential (1s, 2s, 4s)
- Jitter: ±20% randomization

---

## Scaling Architecture

### Target: 1M Messages/Day

**Key Insight:** 1M messages/day = only 11.5 msg/sec sustained, 100 msg/sec peak

### Horizontal Scaling

1. **API Servers:** 5 replicas (1000 req/sec total)
2. **Workers:** 10-30 replicas (100-300 msg/sec)
3. **Database:** Primary + read replicas
4. **Queue:** RabbitMQ cluster (3+ nodes)

### Vertical Optimization

1. **Database Partitioning:** 10-100x query performance
2. **Connection Pooling:** 360 connections shared
3. **Caching:** Redis for frequently accessed data
4. **Indexing:** All foreign keys and query fields

### Auto-Scaling Triggers

- **Workers:** Queue depth > 1000 messages
- **API:** CPU > 70% for 5 minutes
- **Database:** Connection pool > 80% utilization

**See:** [`high-scale-design.md`](./high-scale-design.md) for complete details

---

## Infrastructure

### Docker Compose Environments

| Environment | File | Purpose | Services |
|-------------|------|---------|----------|
| **Development** | `docker-compose.yml` | Local development | 8 services |
| **Testing** | `docker-compose.test.yml` | CI/CD tests | 10 services |
| **Production** | `docker-compose.prod.yml` | Production deployment | 15+ services |
| **Performance** | `docker-compose.perf.yml` | Load testing | 24 services |

**See:** [`docker-compose.md`](./docker-compose.md) for details

### CI/CD Pipeline

**GitHub Actions Workflows:**
1. **Code Quality:** Linting, formatting, type checking
2. **Testing:** Unit, integration, E2E (460+ tests)
3. **Security:** npm audit, SOPS validation
4. **Build:** Docker image builds
5. **Deploy:** Automated deployment
6. **Monitoring:** Metrics validation

**See:** [`cicd-pipeline.md`](./cicd-pipeline.md) for details

---

## Technology Stack

### Core Technologies

- **Language:** TypeScript 5.x
- **Runtime:** Node.js 18 LTS
- **API Framework:** Fastify 4.x
- **Database:** PostgreSQL 15
- **ORM:** Drizzle ORM
- **Message Queue:** RabbitMQ 3.12+

### Infrastructure

- **Containers:** Docker + Docker Compose
- **Orchestration:** Kubernetes (production)
- **Load Balancer:** Nginx
- **Monitoring:** Prometheus + Grafana
- **Secrets:** SOPS with Age encryption

### Development Tools

- **Testing:** Vitest + k6 (performance)
- **Linting:** ESLint + Prettier
- **Documentation:** OpenAPI 3.1
- **CI/CD:** GitHub Actions
- **Version Control:** Git + GitHub

---

## Key Architectural Decisions

### 1. RabbitMQ over BullMQ
**Decision:** Use RabbitMQ with quorum queues

**Rationale:**
- **Zero data loss** (BullMQ can lose up to 1 second of jobs)
- **Native persistence** (no Redis AOF tuning needed)
- **Worth the cost:** +$556/month prevents customer churn from missed birthdays

**See:** [`ARCHITECTURE_CHANGE_RABBITMQ.md`](./ARCHITECTURE_CHANGE_RABBITMQ.md)

### 2. Monthly Database Partitioning
**Decision:** Partition `message_logs` table by month

**Rationale:**
- 10-100x query performance improvement
- Automatic partition management
- Easy data retention (drop old partitions)

**Impact:** Critical for 1M+ messages/day scale

### 3. Strategy Pattern for Messages
**Decision:** Use strategy pattern for message types

**Rationale:**
- Add new message types with minimal code
- Type-safe TypeScript implementation
- Flexible and extensible

**Impact:** Enables Birthday, Anniversary, Reminder, etc.

### 4. Horizontal Worker Scaling
**Decision:** Auto-scale workers from 10 to 30 based on queue depth

**Rationale:**
- Cost-effective (scale only when needed)
- Handles peak loads (100 msg/sec)
- Maintains baseline capacity (11.5 msg/sec)

**Impact:** Supports 1M+ messages/day with auto-scaling

---

## Performance Targets

### API Performance

- **p50 latency:** <50ms
- **p95 latency:** <100ms
- **p99 latency:** <200ms
- **Throughput:** 1000 req/sec

### Message Processing

- **Processing time:** <200ms per message
- **Queue throughput:** 100 msg/sec sustained
- **Peak capacity:** 300 msg/sec (30 workers)

### Database Performance

- **Query time:** <50ms (indexed)
- **Connection pool:** 360 connections
- **Replication lag:** <1 second

---

## Related Documentation

### Requirements

- **System Flows:** [`../01-requirements/system-flows.md`](../01-requirements/system-flows.md)
- **Technical Specs:** [`../01-requirements/technical-specifications.md`](../01-requirements/technical-specifications.md)

### Research

- **Message Queue:** [`../03-research/MESSAGE_QUEUE_RESEARCH.md`](../03-research/MESSAGE_QUEUE_RESEARCH.md)
- **Scale Analysis:** [`../03-research/scale-performance-1m-messages.md`](../03-research/scale-performance-1m-messages.md)
- **Monitoring Blueprint:** [`../03-research/comprehensive-monitoring.md`](../03-research/comprehensive-monitoring.md)

### Implementation

- **Master Plan:** [`../05-implementation/master-plan.md`](../05-implementation/master-plan.md)

### Testing

- **Testing Strategy:** [`../04-testing/testing-strategy.md`](../04-testing/testing-strategy.md)
- **Performance Testing:** [`../04-testing/performance-testing-guide.md`](../04-testing/performance-testing-guide.md)

### Operations

- **Deployment:** [`../08-operations/`](../08-operations/)
- **Monitoring Setup:** [`../07-monitoring/`](../07-monitoring/)

---

## Quick Start

### Understanding the Architecture

1. **Start with:** [`architecture-overview.md`](./architecture-overview.md)
2. **Scale considerations:** [`high-scale-design.md`](./high-scale-design.md)
3. **Infrastructure setup:** [`docker-compose.md`](./docker-compose.md)
4. **CI/CD pipeline:** [`cicd-pipeline.md`](./cicd-pipeline.md)

### For Architects

1. Review architecture overview for system design
2. Check high-scale design for scalability patterns
3. Review key architectural decisions
4. Refer to research documentation for analysis

### For Developers

1. Start with architecture overview
2. Review Docker Compose setup for local development
3. Check monitoring setup for observability
4. Follow implementation plans for guidance

### For DevOps

1. Review Docker Compose configurations
2. Study CI/CD pipeline architecture
3. Check monitoring and alerting setup
4. Review operations documentation

---

## Change History

### 2025-12-31

- Enhanced INDEX.md with comprehensive navigation
- Added breadcrumb navigation
- Included architecture diagrams
- Added technology stack summary
- Improved cross-references

### 2025-12-30

- Architecture decision: RabbitMQ over BullMQ
- High-scale design completed (1M+ messages/day)
- CI/CD pipeline finalized
- Monitoring architecture defined

---

**Last Updated:** 2025-12-31

**Status:** Architecture Complete

**Total Documents:** 6 (~400KB)

**Organization Status:** ✅ Well-Organized
