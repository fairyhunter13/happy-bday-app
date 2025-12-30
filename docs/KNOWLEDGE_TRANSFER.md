# Knowledge Transfer Document

## Purpose

This document provides a comprehensive knowledge transfer for the Birthday Message Scheduler application, enabling new team members to quickly understand the system architecture, design decisions, and operational procedures.

**Target Audience:** New developers, DevOps engineers, and support personnel
**Last Updated:** 2025-12-30
**Version:** 1.0.0

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Key Design Decisions](#key-design-decisions)
3. [Technology Stack Rationale](#technology-stack-rationale)
4. [Common Workflows](#common-workflows)
5. [Code Organization](#code-organization)
6. [Testing Strategy](#testing-strategy)
7. [Deployment Process](#deployment-process)
8. [Troubleshooting Tips](#troubleshooting-tips)
9. [Future Enhancements](#future-enhancements)

---

## 1. Architecture Overview

### 1.1 High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                         Client Apps                         │
│                    (Mobile, Web, CLI)                       │
└────────────────────────┬────────────────────────────────────┘
                         │
                         │ HTTP/REST
                         ▼
┌─────────────────────────────────────────────────────────────┐
│                      API Gateway                            │
│              (Rate Limiting, Auth, SSL)                     │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│                   Fastify API Server                        │
│            (User Management, Message Scheduling)            │
│                    (Auto-scales 3-20)                       │
└───────────┬─────────────────────────┬───────────────────────┘
            │                         │
            │                         │
            ▼                         ▼
    ┌──────────────┐         ┌──────────────┐
    │  PostgreSQL  │         │   RabbitMQ   │
    │  (Database)  │         │  (Queue)     │
    └──────────────┘         └───────┬──────┘
                                     │
                                     │ Consume
                                     ▼
                          ┌──────────────────┐
                          │   Worker Pool    │
                          │  (Auto-scales)   │
                          │   1-20 workers   │
                          └────────┬─────────┘
                                   │
                                   │ Send Message
                                   ▼
                          ┌──────────────────┐
                          │  External API    │
                          │ (Message Service)│
                          │ (Circuit Breaker)│
                          └──────────────────┘
```

### 1.2 Component Responsibilities

**API Server:**
- User CRUD operations
- Message scheduling
- Request validation (Zod schemas)
- Rate limiting (100 req/min)
- Health checks
- Metrics exposition

**Scheduler (Cron):**
- Daily birthday checks (00:00 UTC)
- Queue message creation
- Timezone-aware scheduling
- Runs as singleton service

**Worker Pool:**
- Message consumption from queue
- External API calls with circuit breaker
- Retry logic (3 attempts)
- Dead letter queue handling
- Auto-scales based on queue depth

**PostgreSQL Database:**
- User data storage
- Message log persistence
- ACID transactions
- Connection pooling (max 20)

**RabbitMQ Queue:**
- Asynchronous message processing
- Durable queues
- Message persistence
- Dead letter exchange
- Prefetch limit (10)

---

## 2. Key Design Decisions

### 2.1 Why Fastify Over Express?

**Decision:** Use Fastify as web framework

**Rationale:**
- **Performance:** 2-3x faster than Express
- **Schema Validation:** Built-in JSON schema validation
- **TypeScript:** Excellent TypeScript support
- **Async/Await:** Native async handling
- **Plugin System:** Modular architecture
- **Documentation:** Auto-generated Swagger docs

**Trade-offs:**
- Smaller ecosystem vs Express
- Steeper learning curve
- Fewer middleware options

**Verdict:** Performance and TypeScript support outweigh ecosystem size.

---

### 2.2 Why Message Queue Over Direct Processing?

**Decision:** Use RabbitMQ for asynchronous message processing

**Rationale:**
- **Decoupling:** Separate scheduling from sending
- **Scalability:** Independent worker scaling
- **Reliability:** Message persistence and retry
- **Load Leveling:** Smooth traffic spikes
- **Fault Tolerance:** Messages survive crashes

**Alternative Considered:** Direct API calls from scheduler
- Rejected: Poor scalability, no retry logic, blocking

**Implementation:**
```typescript
// Scheduler publishes to queue
await channel.sendToQueue('birthday_messages', message, { persistent: true });

// Workers consume from queue
channel.consume('birthday_messages', async (msg) => {
  await sendMessage(msg.content);
  channel.ack(msg);
});
```

---

### 2.3 Why Circuit Breaker Pattern?

**Decision:** Implement circuit breaker for external API calls

**Rationale:**
- **Prevent Cascading Failures:** Don't retry failing service
- **Fast Failure:** Fail fast when service is down
- **Automatic Recovery:** Retry after cooldown period
- **System Protection:** Prevent resource exhaustion

**Configuration:**
```typescript
const breaker = new CircuitBreaker(sendMessage, {
  timeout: 3000,           // 3s timeout
  errorThresholdPercentage: 50,  // Open at 50% errors
  resetTimeout: 30000,     // Retry after 30s
});
```

**States:**
- **Closed:** Normal operation, requests flow
- **Open:** Service failing, requests rejected immediately
- **Half-Open:** Testing if service recovered

---

### 2.4 Why Drizzle ORM Over Prisma/TypeORM?

**Decision:** Use Drizzle ORM for database access

**Rationale:**
- **Performance:** Minimal overhead, close to raw SQL
- **TypeScript:** Excellent type inference
- **SQL-First:** Write SQL-like queries with type safety
- **Lightweight:** No bloat, fast startup
- **Migrations:** Built-in migration tools

**Example:**
```typescript
// Type-safe, auto-complete, SQL-like syntax
const users = await db
  .select()
  .from(usersTable)
  .where(eq(usersTable.dateOfBirth, targetDate))
  .orderBy(usersTable.firstName);
```

**Alternative Considered:** Prisma
- Rejected: Heavier, generated client increases build time

---

### 2.5 Why Strategy Pattern for Message Processing?

**Decision:** Use Strategy pattern for different message types

**Rationale:**
- **Extensibility:** Easy to add new message types
- **Testability:** Mock strategies independently
- **Clean Code:** Separate concerns
- **Flexibility:** Switch strategies at runtime

**Implementation:**
```typescript
interface MessageStrategy {
  send(recipient: User): Promise<void>;
}

class EmailStrategy implements MessageStrategy {
  async send(recipient: User) { /* email logic */ }
}

class SMSStrategy implements MessageStrategy {
  async send(recipient: User) { /* SMS logic */ }
}

// Use strategy
const strategy = getStrategy(messageType);
await strategy.send(user);
```

---

## 3. Technology Stack Rationale

### 3.1 Backend Stack

| Technology | Version | Purpose | Why Chosen |
|------------|---------|---------|------------|
| **Node.js** | 20+ | Runtime | Async I/O, performance, ecosystem |
| **TypeScript** | 5.7+ | Language | Type safety, developer experience |
| **Fastify** | 5.2+ | Web framework | Performance, validation, TypeScript |
| **Drizzle ORM** | 0.38+ | Database ORM | Type-safe, performant, SQL-first |
| **Zod** | 3.24+ | Validation | Type-safe schemas, runtime validation |
| **Luxon** | 3.5+ | Date/time | Timezone support, better than moment |
| **Pino** | 9.5+ | Logging | Fast, structured logging, low overhead |
| **Opossum** | 8.1+ | Circuit breaker | Fault tolerance, proven library |

### 3.2 Infrastructure Stack

| Technology | Purpose | Why Chosen |
|------------|---------|------------|
| **PostgreSQL 16** | Database | ACID, performance, reliability |
| **RabbitMQ 3.12** | Message queue | Mature, reliable, feature-rich |
| **Docker** | Containerization | Consistency, portability |
| **Kubernetes** | Orchestration | Auto-scaling, self-healing, declarative |
| **Prometheus** | Metrics | Industry standard, powerful queries |
| **Grafana** | Visualization | Beautiful dashboards, alerting |

### 3.3 Testing Stack

| Technology | Purpose | Why Chosen |
|------------|---------|------------|
| **Vitest** | Test framework | Fast, Vite-based, great DX |
| **Testcontainers** | Integration tests | Real database/queue, reproducible |
| **k6** | Load testing | Scriptable, accurate, scalable |
| **Faker.js** | Test data | Realistic data generation |

---

## 4. Common Workflows

### 4.1 Adding a New API Endpoint

**Steps:**

1. **Define Zod Schema** (`src/validators/`)
```typescript
export const CreateUserSchema = z.object({
  firstName: z.string().min(1),
  email: z.string().email(),
});
```

2. **Create Controller** (`src/controllers/`)
```typescript
export async function createUser(request: FastifyRequest, reply: FastifyReply) {
  const userData = CreateUserSchema.parse(request.body);
  const user = await userService.createUser(userData);
  return reply.code(201).send(user);
}
```

3. **Add Route** (`src/routes/`)
```typescript
fastify.post('/users', {
  schema: {
    body: CreateUserSchema,
    response: { 201: UserResponseSchema }
  },
  handler: createUser
});
```

4. **Write Tests** (`tests/unit/`, `tests/integration/`)
```typescript
describe('POST /users', () => {
  it('should create user', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/users',
      payload: { firstName: 'Test', email: 'test@example.com' }
    });
    expect(response.statusCode).toBe(201);
  });
});
```

---

### 4.2 Adding a Database Migration

**Steps:**

1. **Modify Schema** (`src/db/schema.ts`)
```typescript
export const usersTable = pgTable('users', {
  id: uuid('id').defaultRandom().primaryKey(),
  firstName: varchar('first_name', { length: 100 }).notNull(),
  // Add new column:
  phoneNumber: varchar('phone_number', { length: 20 }),
});
```

2. **Generate Migration**
```bash
npm run db:generate
```

3. **Review Migration** (`src/db/migrations/0001_*.sql`)
```sql
ALTER TABLE users ADD COLUMN phone_number VARCHAR(20);
```

4. **Test Migration** (locally)
```bash
npm run db:migrate
psql $DATABASE_URL -c "\\d users"
```

5. **Deploy to Production**
```bash
# Included in deployment pipeline
kubectl rollout restart deployment/birthday-scheduler-api
```

---

### 4.3 Debugging a Production Issue

**Steps:**

1. **Check Alerts** (Grafana/PagerDuty)
   - Identify which alert fired
   - Note severity and component

2. **Check Dashboards** (Grafana)
   - Review overview dashboard
   - Identify anomalies (error rate, latency, queue depth)

3. **Review Logs** (kubectl/CloudWatch)
```bash
kubectl logs deployment/birthday-scheduler-api --tail=100 | grep ERROR
```

4. **Check Recent Changes** (Git)
```bash
git log --since="2 hours ago"
kubectl rollout history deployment/birthday-scheduler-api
```

5. **Correlate Events**
   - Deployment timing
   - Traffic patterns
   - External service status

6. **Apply Fix**
   - Rollback if recent deployment
   - Hotfix if code issue
   - Scale resources if capacity issue

7. **Verify Resolution**
```bash
curl https://api.example.com/health
# Check metrics return to normal
```

8. **Post-Mortem** (document in `incidents/`)

---

## 5. Code Organization

### 5.1 Directory Structure

```
src/
├── app.ts                 # Fastify app setup
├── index.ts               # API server entry point
├── worker.ts              # Worker entry point
├── scheduler.ts           # Scheduler entry point
├── config/
│   └── environment.ts     # Environment variable validation
├── controllers/
│   └── user.controller.ts # Request handlers
├── db/
│   ├── connection.ts      # Database connection
│   ├── schema.ts          # Drizzle schema definitions
│   └── migrations/        # SQL migrations
├── queue/
│   ├── connection.ts      # RabbitMQ connection
│   └── publisher.ts       # Message publishing
├── repositories/
│   └── user.repository.ts # Database queries
├── routes/
│   └── users.routes.ts    # Route definitions
├── schedulers/
│   └── birthday.scheduler.ts # Cron jobs
├── services/
│   ├── user.service.ts    # Business logic
│   └── message.service.ts # Message sending logic
├── strategies/
│   └── message.strategy.ts # Strategy implementations
├── types/
│   └── user.types.ts      # TypeScript types
├── utils/
│   ├── logger.ts          # Pino logger setup
│   └── timezone.ts        # Timezone utilities
└── validators/
    └── user.validator.ts  # Zod schemas

tests/
├── unit/                  # Unit tests
├── integration/           # Integration tests
├── e2e/                   # End-to-end tests
├── performance/           # Load tests
├── chaos/                 # Chaos tests
└── helpers/               # Test utilities

docs/
├── README.md              # Project overview
├── RUNBOOK.md             # Operations guide
├── DEPLOYMENT_GUIDE.md    # Deployment procedures
├── TROUBLESHOOTING.md     # Common issues
├── SECURITY_AUDIT.md      # Security assessment
└── KNOWLEDGE_TRANSFER.md  # This document
```

### 5.2 Coding Conventions

**Naming:**
- Files: `kebab-case.ts`
- Classes: `PascalCase`
- Functions: `camelCase`
- Constants: `UPPER_SNAKE_CASE`
- Interfaces: `PascalCase` (no `I` prefix)

**Imports:**
```typescript
// External dependencies first
import { FastifyInstance } from 'fastify';
import { z } from 'zod';

// Internal imports second
import { userService } from '../services/user.service';
import { logger } from '../utils/logger';
```

**Error Handling:**
```typescript
// Always handle errors explicitly
try {
  await riskyOperation();
} catch (error) {
  logger.error('Operation failed', { error });
  throw new CustomError('User-friendly message');
}
```

**Async/Await:**
```typescript
// Prefer async/await over promises
async function example() {
  const data = await fetchData();
  return processData(data);
}
```

---

## 6. Testing Strategy

### 6.1 Test Pyramid

```
         /\
        /  \   E2E (10%)
       /____\  Integration (30%)
      /      \ Unit (60%)
     /________\
```

### 6.2 Test Types

**Unit Tests** (`tests/unit/`)
- Test individual functions/classes
- Mock all external dependencies
- Fast execution (<1s)
- High coverage (>80%)

**Example:**
```typescript
describe('UserService', () => {
  it('should create user', async () => {
    const mockRepo = { create: vi.fn().mockResolvedValue(user) };
    const service = new UserService(mockRepo);
    const result = await service.createUser(userData);
    expect(result).toEqual(user);
  });
});
```

**Integration Tests** (`tests/integration/`)
- Test component interactions
- Use real database/queue (Testcontainers)
- Moderate execution time (5-10s)
- Focus on happy paths + critical error cases

**Example:**
```typescript
describe('User API Integration', () => {
  beforeAll(async () => {
    // Start PostgreSQL container
    container = await new PostgreSqlContainer().start();
  });

  it('should persist user to database', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/users',
      payload: userData
    });

    const user = await db.select().from(users).where(eq(users.id, response.json().id));
    expect(user).toBeDefined();
  });
});
```

**E2E Tests** (`tests/e2e/`)
- Test complete user flows
- All services running (Docker Compose)
- Slow execution (30s+)
- Focus on critical paths

**Performance Tests** (`tests/performance/`)
- Load testing with k6
- Validate SLA targets
- Run before releases

---

## 7. Deployment Process

### 7.1 Continuous Integration

**GitHub Actions Workflow:**

```yaml
1. Pull Request
   ├── Lint (ESLint)
   ├── Type Check (TypeScript)
   ├── Unit Tests (Vitest)
   ├── Integration Tests (Testcontainers)
   └── Build (npm run build)

2. Merge to Main
   ├── All PR checks
   ├── E2E Tests (Docker Compose)
   ├── Security Scan (npm audit)
   └── Docker Build

3. Tag Release (v*)
   ├── Performance Tests (k6)
   ├── Build & Push Image
   ├── Deploy to Staging
   ├── Smoke Tests
   ├── Deploy to Production
   └── Notify Team (Slack)
```

### 7.2 Deployment Environments

**Development:**
- Local Docker Compose
- Hot reload enabled
- Debug logging

**Staging:**
- Kubernetes cluster
- Production-like configuration
- Smaller resources

**Production:**
- Kubernetes cluster
- Auto-scaling enabled
- High availability

### 7.3 Zero-Downtime Deployment

**Strategy:** Rolling Update

```yaml
spec:
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxSurge: 1        # Create 1 new pod
      maxUnavailable: 0  # Keep all pods running
```

**Process:**
1. Create new pod with updated image
2. Wait for readiness probe (health check)
3. Route traffic to new pod
4. Terminate old pod
5. Repeat for all pods

---

## 8. Troubleshooting Tips

### 8.1 Common Issues

**Issue:** Service won't start
- **Check:** Environment variables (`kubectl describe pod`)
- **Check:** Database connectivity (`psql $DATABASE_URL`)
- **Check:** Logs (`kubectl logs <pod>`)

**Issue:** High error rate
- **Check:** External API status (circuit breaker metrics)
- **Check:** Database query performance
- **Check:** Recent deployments (potential regression)

**Issue:** Queue backing up
- **Check:** Worker count (`kubectl get pods | grep worker`)
- **Check:** Worker logs (errors during processing?)
- **Check:** External API circuit breaker (open?)

### 8.2 Useful Commands

```bash
# Check pod status
kubectl get pods -l app=birthday-scheduler

# View logs
kubectl logs -f deployment/birthday-scheduler-api --tail=100

# Execute command in pod
kubectl exec -it deployment/birthday-scheduler-api -- /bin/sh

# Check metrics
curl http://localhost:3000/metrics

# Database query
psql $DATABASE_URL -c "SELECT COUNT(*) FROM users;"

# Queue status
rabbitmqadmin list queues

# Restart deployment
kubectl rollout restart deployment/birthday-scheduler-api

# Rollback deployment
kubectl rollout undo deployment/birthday-scheduler-api
```

### 8.3 Performance Debugging

```bash
# Profile CPU
node --prof dist/index.js
node --prof-process isolate-*.log > profile.txt

# Heap snapshot
node --inspect dist/index.js
# Chrome DevTools: chrome://inspect

# Memory profiling
node --expose-gc --heap-prof dist/index.js

# Slow query analysis
psql $DATABASE_URL -c "SELECT query, mean_exec_time FROM pg_stat_statements ORDER BY mean_exec_time DESC LIMIT 10;"
```

---

## 9. Future Enhancements

### 9.1 Short-term (Next Quarter)

**Priority: High**
- [ ] Add Redis caching layer for user lookups
- [ ] Implement advanced rate limiting (per-user)
- [ ] Add SMS strategy for message delivery
- [ ] Create admin dashboard for monitoring

**Priority: Medium**
- [ ] GraphQL API alongside REST
- [ ] Webhooks for message delivery status
- [ ] Multi-language support
- [ ] Template customization

### 9.2 Long-term (Next Year)

**Scalability:**
- [ ] Multi-region deployment
- [ ] Database sharding for >10M users
- [ ] Kafka for high-throughput messaging
- [ ] Service mesh (Istio) for advanced routing

**Features:**
- [ ] AI-powered message personalization
- [ ] Analytics dashboard
- [ ] A/B testing framework
- [ ] Mobile app integration

**Operations:**
- [ ] Automated chaos engineering (continuous)
- [ ] Machine learning for anomaly detection
- [ ] Self-healing infrastructure
- [ ] Cost optimization automation

---

## 10. Learning Resources

### 10.1 Official Documentation

- **Fastify:** https://www.fastify.io/docs/
- **Drizzle ORM:** https://orm.drizzle.team/docs
- **Zod:** https://zod.dev/
- **RabbitMQ:** https://www.rabbitmq.com/documentation.html
- **PostgreSQL:** https://www.postgresql.org/docs/
- **Kubernetes:** https://kubernetes.io/docs/

### 10.2 Internal Documentation

- **Project README:** `docs/README.md`
- **Architecture Decisions:** `docs/ADR/` (if exists)
- **Runbook:** `docs/RUNBOOK.md`
- **API Docs:** http://localhost:3000/api/docs (Swagger UI)

### 10.3 Team Contacts

**Engineering:**
- Lead: engineering-lead@example.com
- Team Slack: #birthday-scheduler-dev

**DevOps:**
- Lead: devops-lead@example.com
- Team Slack: #birthday-scheduler-ops

**On-Call:**
- PagerDuty: birthday-scheduler-oncall
- Escalation: See RUNBOOK.md

---

## 11. Quick Start for New Team Members

### Day 1: Setup
```bash
# Clone repository
git clone https://github.com/company/birthday-scheduler.git
cd birthday-scheduler

# Install dependencies
npm ci

# Copy environment file
cp .env.example .env
# Fill in values

# Start infrastructure
docker-compose up -d

# Run database migrations
npm run db:migrate

# Start development server
npm run dev
```

### Day 2: Explore
- Read `docs/README.md`
- Review codebase structure
- Run tests: `npm test`
- Review Swagger docs: http://localhost:3000/api/docs
- Create test user via API

### Day 3: First Contribution
- Pick a small task from backlog
- Create feature branch
- Make changes
- Write tests
- Submit PR
- Review with mentor

### Week 1: Deep Dive
- Attend architecture walkthrough
- Review production deployment
- Shadow on-call engineer
- Practice incident response
- Read all documentation

---

**Prepared By:** Engineering Team
**Maintained By:** Tech Lead
**Questions?** Post in #birthday-scheduler-dev

**Last Updated:** 2025-12-30
**Next Review:** Quarterly
