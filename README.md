# 🎂 Happy Birthday App - Message Scheduler

<!-- Build Status Badges -->
[![CI](https://github.com/fairyhunter13/happy-bday-app/workflows/CI/badge.svg)](https://github.com/fairyhunter13/happy-bday-app/actions/workflows/ci.yml)
[![Coverage](https://codecov.io/gh/fairyhunter13/happy-bday-app/branch/main/graph/badge.svg)](https://codecov.io/gh/fairyhunter13/happy-bday-app)
[![Code Quality](https://github.com/fairyhunter13/happy-bday-app/workflows/Code%20Quality/badge.svg)](https://github.com/fairyhunter13/happy-bday-app/actions/workflows/code-quality.yml)
[![Security](https://github.com/fairyhunter13/happy-bday-app/workflows/Security%20Scanning/badge.svg)](https://github.com/fairyhunter13/happy-bday-app/actions/workflows/security.yml)
[![Performance](https://github.com/fairyhunter13/happy-bday-app/workflows/Performance%20Tests/badge.svg)](https://github.com/fairyhunter13/happy-bday-app/actions/workflows/performance.yml)
[![Docker](https://github.com/fairyhunter13/happy-bday-app/workflows/Docker%20Build%20and%20Push/badge.svg)](https://github.com/fairyhunter13/happy-bday-app/actions/workflows/docker-build.yml)

<!-- API & Docs Badges -->
[![OpenAPI](https://github.com/fairyhunter13/happy-bday-app/workflows/OpenAPI%20Validation/badge.svg)](https://github.com/fairyhunter13/happy-bday-app/actions/workflows/openapi-validation.yml)
[![Docs](https://github.com/fairyhunter13/happy-bday-app/workflows/Deploy%20Documentation/badge.svg)](https://github.com/fairyhunter13/happy-bday-app/actions/workflows/docs.yml)
[![API Docs](https://img.shields.io/badge/API-Documentation-blue?logo=swagger)](https://fairyhunter13.github.io/happy-bday-app/)

<!-- Tech Stack Badges -->
[![Node.js](https://img.shields.io/badge/Node.js-≥20.0.0-green?logo=node.js)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-blue?logo=typescript)](https://www.typescriptlang.org/)
[![Fastify](https://img.shields.io/badge/Fastify-5.x-black?logo=fastify)](https://fastify.dev/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-15-blue?logo=postgresql)](https://www.postgresql.org/)
[![RabbitMQ](https://img.shields.io/badge/RabbitMQ-3.x-orange?logo=rabbitmq)](https://www.rabbitmq.com/)

<!-- Project Badges -->
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](CONTRIBUTING.md)
[![Dependabot](https://img.shields.io/badge/Dependabot-enabled-blue?logo=dependabot)](https://github.com/fairyhunter13/happy-bday-app/security/dependabot)

A timezone-aware birthday message scheduler built with TypeScript, PostgreSQL, and RabbitMQ. Designed to handle **1M+ messages/day** with **zero data loss** and extensible support for multiple message types (birthday, anniversary, etc.).

---

## 🚀 Quick Start

```bash
# Install dependencies
npm install

# Decrypt environment secrets (see docs/DEVELOPER_SETUP.md for age key setup)
npm run secrets:decrypt:dev

# Start development environment (Docker Compose)
docker-compose -f docker-compose.dev.yml up -d

# Run database migrations
npm run db:migrate

# Start API server
npm run dev

# Start worker (in separate terminal)
npm run worker
```

**New Developers**: See [`docs/DEVELOPER_SETUP.md`](./docs/DEVELOPER_SETUP.md) for complete setup instructions, including SOPS secret management configuration.

---

## 📋 Documentation

**Live API Documentation**: [https://fairyhunter13.github.io/happy-bday-app/](https://fairyhunter13.github.io/happy-bday-app/)

All planning, architecture, research, and implementation documentation is in the **[`plan/`](./plan/)** directory.

### Quick Links

| Topic | Document |
|-------|----------|
| **📡 API Reference** | [Live Docs](https://fairyhunter13.github.io/happy-bday-app/) or `http://localhost:3000/docs` |
| **📖 Overview** | [`plan/README.md`](./plan/README.md) - Start here! |
| **🏗️ Architecture** | [`plan/02-architecture/architecture-overview.md`](./plan/02-architecture/architecture-overview.md) |
| **🎯 Requirements** | [`plan/01-requirements/system-flows.md`](./plan/01-requirements/system-flows.md) |
| **📅 Implementation Plan** | [`plan/05-implementation/master-plan.md`](./plan/05-implementation/master-plan.md) |
| **🧪 Testing Strategy** | [`plan/04-testing/testing-strategy.md`](./plan/04-testing/testing-strategy.md) |
| **🔬 Research** | [`plan/03-research/`](./plan/03-research/) |

---

## 🎯 Key Features

- ✅ **Zero data loss** (RabbitMQ Quorum Queues with Raft consensus)
- ✅ **1M+ messages/day capacity** (11.5 msg/sec sustained, 100+ msg/sec peak)
- ✅ **Timezone-aware scheduling** (9am in each user's local timezone)
- ✅ **Multiple message types** (birthday, anniversary, extensible via Strategy pattern)
- ✅ **Exactly-once delivery** (idempotency via database constraints)
- ✅ **Horizontal scaling** (10-30 workers, 5 API replicas)
- ✅ **Docker Compose** (simple E2E tests, scalable performance tests)
- ✅ **Production-ready** (monitoring, CI/CD, load testing)

---

## 🛠️ Tech Stack

- **API:** Fastify + TypeScript
- **Database:** PostgreSQL 15 + Drizzle ORM
- **Queue:** RabbitMQ (Quorum Queues for zero data loss)
- **Testing:** Vitest + k6 + Docker Compose
- **CI/CD:** GitHub Actions
- **Monitoring:** Prometheus + Grafana

---

## 📦 Project Structure

```
happy-bday-app/
├── plan/                       # All documentation
│   ├── 01-requirements/        # System requirements
│   ├── 02-architecture/        # Architecture designs
│   ├── 03-research/            # Research & analysis
│   ├── 04-testing/             # Testing strategies
│   ├── 05-implementation/      # Implementation plans
│   └── ARCHIVE/                # Historical docs
├── src/                        # Source code
│   ├── api/                    # API routes
│   ├── services/               # Business logic
│   ├── strategies/             # Message type strategies
│   ├── workers/                # Background workers
│   ├── db/                     # Database schema
│   └── types/                  # TypeScript types
├── tests/                      # Tests
│   ├── unit/                   # Unit tests
│   ├── integration/            # Integration tests
│   ├── e2e/                    # E2E tests
│   └── performance/            # k6 performance tests
├── docker-compose.dev.yml      # Development environment
├── docker-compose.test.yml     # Simple E2E tests (CI/CD)
├── docker-compose.perf.yml     # Performance testing
└── .github/workflows/          # GitHub Actions
```

---

## 🧪 Testing

### Simple E2E Tests (CI/CD)
```bash
# Start test environment (4 containers)
docker-compose -f docker-compose.test.yml up -d

# Run E2E tests (< 5 min)
npm run test:e2e
```

### Scalable Performance Tests
```bash
# Start performance environment (24 containers)
docker-compose -f docker-compose.perf.yml up -d

# Run k6 load tests (1M msg/day simulation)
npm run test:performance
```

---

## 📚 Architecture Highlights

### Message Type Abstraction (Strategy Pattern)

Adding a new message type requires **only 3 steps:**

1. **Create strategy** (new file, ~50 lines):
```typescript
export class AnniversaryMessageStrategy implements MessageStrategy {
  readonly messageType = 'ANNIVERSARY';

  async shouldSend(user: User, date: Date): Promise<boolean> {
    return user.anniversaryDate?.getMonth() === date.getMonth() &&
           user.anniversaryDate?.getDate() === date.getDate();
  }

  async composeMessage(user: User): Promise<string> {
    const years = new Date().getFullYear() - user.anniversaryDate.getFullYear();
    return `Happy ${years}th anniversary, ${user.firstName}!`;
  }
  // ... 3 more simple methods
}
```

2. **Register strategy** (1 line):
```typescript
factory.register(new AnniversaryMessageStrategy());
```

3. **Add database column** (1 migration):
```sql
ALTER TABLE users ADD COLUMN anniversary_date DATE;
```

**That's it!** Workers, schedulers, and queue logic handle it automatically.

### Database Partitioning (Mandatory for 1M+ scale)

```sql
-- Monthly partitions for 10-100x query speedup
CREATE TABLE message_logs (...)
PARTITION BY RANGE (scheduled_send_time);

CREATE TABLE message_logs_2025_01 PARTITION OF message_logs
  FOR VALUES FROM ('2025-01-01') TO ('2025-02-01');
```

---

## 🎓 Key Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| **Queue** | RabbitMQ (Quorum Queues) | Zero data loss, native persistence, battle-tested |
| **Database** | PostgreSQL + Partitioning | ACID guarantees, 10-100x query speedup with partitions |
| **Message Pattern** | Strategy Pattern | Add new types without core changes |
| **Timezone** | IANA Identifiers | Handles DST automatically |
| **Idempotency** | DB Unique Constraints | Simpler & safer than distributed locks |

**Full architecture documentation:** [`plan/02-architecture/architecture-overview.md`](./plan/02-architecture/architecture-overview.md)

---

## 📈 Performance Targets

| Metric | Target | Actual Capacity |
|--------|--------|----------------|
| **Daily Throughput** | 1M messages | 864M msg/day (RabbitMQ) |
| **Sustained Rate** | 11.5 msg/sec | 10,000 msg/sec |
| **Peak Rate** | 100 msg/sec | 10,000 msg/sec |
| **API Latency (p95)** | < 500ms | ✅ Verified |
| **API Latency (p99)** | < 1000ms | ✅ Verified |
| **Worker Capacity** | 100 msg/sec | 150 msg/sec (10-30 workers) |
| **Database Queries** | < 200ms | ✅ With partitioning |

---

## 📞 Getting Help

- **Documentation:** [`plan/README.md`](./plan/README.md)
- **Architecture:** [`plan/02-architecture/`](./plan/02-architecture/)
- **Implementation:** [`plan/05-implementation/master-plan.md`](./plan/05-implementation/master-plan.md)
- **Testing:** [`plan/04-testing/testing-strategy.md`](./plan/04-testing/testing-strategy.md)

---

## 📄 License

MIT
