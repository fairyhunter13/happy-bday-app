# Database Infrastructure Setup Guide

## ANALYST Agent - Database Infrastructure Implementation

This guide walks through setting up the complete database infrastructure for the Birthday Message Scheduler application.

## Prerequisites

- **Node.js** v20.x LTS or higher
- **Docker** v24 or higher
- **npm** v10 or higher
- **Git**

## Quick Start (5 minutes)

```bash
# 1. Install dependencies
npm install

# 2. Start Docker services (PostgreSQL, RabbitMQ, Redis)
make docker-up
# OR: docker-compose up -d

# 3. Run database migrations
make db-migrate
# OR: npm run db:migrate

# 4. Seed test data
make db-seed
# OR: npm run db:seed

# 5. Verify setup
make docker-logs
# OR: docker-compose logs
```

That's it! Your database infrastructure is now ready.

## What Was Created

### 1. Database Schema Files (Drizzle ORM)

**Location:** `/src/db/schema/`

- **users.ts** - User table schema with:
  - IANA timezone storage (e.g., "America/New_York")
  - Birthday and anniversary date fields
  - Soft delete support
  - Partial indexes for performance

- **message-logs.ts** - Message logs table schema with:
  - Monthly partitioning by `scheduled_send_time`
  - Idempotency constraints
  - Status tracking (SCHEDULED, QUEUED, SENDING, SENT, FAILED, RETRYING)
  - API response logging

### 2. Database Connection & Migrations

- **connection.ts** - PostgreSQL connection with pooling (5-20 connections)
- **migrate.ts** - Migration runner that:
  - Runs Drizzle migrations
  - Creates monthly partitions automatically
  - Adds database constraints (timezone validation, status checks)

### 3. Docker Infrastructure

**docker-compose.yml** includes:
- **PostgreSQL 15** - Primary database (port 5432)
- **RabbitMQ 3.13** - Message queue with management UI (ports 5672, 15672)
- **Redis 7** - Optional caching (port 6379)
- **PgAdmin** - Database management UI (port 5050)

### 4. Scripts

- **seed.ts** - Creates 100 test users with sample message logs
- **create-partitions.ts** - Creates future monthly partitions
- **drop-old-partitions.ts** - Drops old partitions for data retention
- **init-db.sql** - PostgreSQL initialization (enables UUID, pg_stat_statements)
- **rabbitmq.conf** - RabbitMQ configuration optimized for message scheduler

## Detailed Setup Instructions

### Step 1: Install Dependencies

```bash
npm install
```

This installs:
- **Drizzle ORM** - Type-safe ORM
- **postgres** - PostgreSQL client
- **Fastify** - API framework
- **Luxon** - Timezone-aware date handling
- **amqplib** - RabbitMQ client
- **Zod** - Schema validation
- And development tools (TypeScript, Vitest, etc.)

### Step 2: Configure Environment

The `.env` file is already created with development defaults:

```bash
# Database
DATABASE_URL=postgres://postgres:postgres_dev_password@localhost:5432/birthday_app

# RabbitMQ
RABBITMQ_URL=amqp://rabbitmq:rabbitmq_dev_password@localhost:5672

# Redis (optional)
REDIS_URL=redis://:redis_dev_password@localhost:6379/0
```

For production, create `.env.production` with secure passwords.

### Step 3: Start Docker Services

```bash
docker-compose up -d
```

This starts:
1. **PostgreSQL 15** on port 5432
2. **RabbitMQ 3.13** on ports 5672 (AMQP) and 15672 (Management UI)
3. **Redis 7** on port 6379
4. **PgAdmin** on port 5050

Verify all services are healthy:
```bash
docker-compose ps
```

Expected output:
```
NAME                        STATUS
birthday-app-postgres       Up 10 seconds (healthy)
birthday-app-rabbitmq       Up 10 seconds (healthy)
birthday-app-redis          Up 10 seconds (healthy)
birthday-app-pgadmin        Up 10 seconds
```

### Step 4: Generate and Run Migrations

```bash
# Generate migration files from schema (only needed after schema changes)
npm run db:generate

# Run migrations (creates tables, partitions, indexes, constraints)
npm run db:migrate
```

The migration script automatically:
- Creates `users` and `message_logs` tables
- Creates monthly partitions for the next 13 months
- Adds indexes for performance optimization
- Adds database constraints:
  - Timezone format validation (IANA)
  - Message status enum validation
  - Message type enum validation
  - Retry count non-negative check

### Step 5: Seed Test Data

```bash
npm run db:seed
```

This creates:
- 100 test users with various timezones
- Sample message logs in different states:
  - SCHEDULED messages (for today)
  - SENT messages (from yesterday)
  - FAILED messages (for testing recovery)

### Step 6: Verify Setup

#### Option A: Drizzle Studio (Recommended)

```bash
npm run db:studio
```

Then open http://localhost:4983

Drizzle Studio provides:
- Visual database browser
- Query builder
- Table editor
- Relationship viewer

#### Option B: PgAdmin

Open http://localhost:5050

Credentials:
- Email: `admin@birthday-app.local`
- Password: `pgadmin_dev_password`

Add server:
- Host: `postgres` (container name)
- Port: `5432`
- Database: `birthday_app`
- Username: `postgres`
- Password: `postgres_dev_password`

#### Option C: Command Line

```bash
# Connect to PostgreSQL
docker exec -it birthday-app-postgres psql -U postgres -d birthday_app

# List tables
\dt

# Check partitions
SELECT tablename FROM pg_tables WHERE tablename LIKE 'message_logs_%';

# Count users
SELECT COUNT(*) FROM users;

# Count message logs
SELECT COUNT(*) FROM message_logs;
```

## Database Schema Details

### Users Table

```sql
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  timezone VARCHAR(100) NOT NULL,
  birthday_date DATE,
  anniversary_date DATE,
  location_city VARCHAR(100),
  location_country VARCHAR(100),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);
```

**Indexes:**
- `idx_users_birthday_date` - Partial index (deleted_at IS NULL)
- `idx_users_anniversary_date` - Partial index (deleted_at IS NULL)
- `idx_users_birthday_timezone` - Composite (birthday_date, timezone)
- `idx_users_email_unique` - Unique email (soft-delete aware)

### Message Logs Table (Partitioned)

```sql
CREATE TABLE message_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  message_type VARCHAR(50) NOT NULL,
  message_content TEXT NOT NULL,
  scheduled_send_time TIMESTAMPTZ NOT NULL,
  actual_send_time TIMESTAMPTZ,
  status VARCHAR(20) NOT NULL DEFAULT 'SCHEDULED',
  retry_count INTEGER DEFAULT 0,
  last_retry_at TIMESTAMPTZ,
  api_response_code INTEGER,
  api_response_body TEXT,
  error_message TEXT,
  idempotency_key VARCHAR(255) UNIQUE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
) PARTITION BY RANGE (scheduled_send_time);
```

**Partitions:** (auto-created)
- `message_logs_2025_01` - January 2025
- `message_logs_2025_02` - February 2025
- ... and so on (13 months total)

**Indexes:**
- `idx_message_logs_user_id` - Foreign key performance
- `idx_message_logs_status` - Status filtering
- `idx_message_logs_scheduled_time` - Time-based queries
- `idx_message_logs_scheduler` - Composite (message_type, status, scheduled_send_time)
- `idx_message_logs_recovery` - Partial index for recovery queries
- `idx_message_logs_idempotency` - Unique idempotency enforcement

## Partition Management

### Create Future Partitions

```bash
# Create 24 months of future partitions
tsx scripts/create-partitions.ts 24
```

### Drop Old Partitions

```bash
# Drop partitions older than 6 months
tsx scripts/drop-old-partitions.ts 6
```

**WARNING:** This permanently deletes data!

## Common Tasks

### Reset Database (Clean Slate)

```bash
# Stop containers and remove volumes
docker-compose down -v

# Start fresh
docker-compose up -d

# Wait for services to be healthy
sleep 5

# Run migrations and seed
npm run db:migrate
npm run db:seed
```

Or use the Makefile:
```bash
make db-reset
```

### View Docker Logs

```bash
# All services
docker-compose logs -f

# Specific service
docker-compose logs -f postgres
docker-compose logs -f rabbitmq
```

### Connect to Services

**PostgreSQL:**
```bash
docker exec -it birthday-app-postgres psql -U postgres -d birthday_app
```

**RabbitMQ Management:**
- URL: http://localhost:15672
- Username: `rabbitmq`
- Password: `rabbitmq_dev_password`

**Redis:**
```bash
docker exec -it birthday-app-redis redis-cli
AUTH redis_dev_password
```

## Performance Optimization

### Connection Pooling

Configured in `src/db/connection.ts`:
- Min connections: 5
- Max connections: 20
- Idle timeout: 30s
- Connect timeout: 10s

Adjust based on load:
```typescript
// .env
DATABASE_POOL_MAX=20  # Default
DATABASE_POOL_MAX=50  # High traffic
```

### Query Performance

**Good:** Uses partition key
```sql
SELECT * FROM message_logs
WHERE scheduled_send_time BETWEEN '2025-01-01' AND '2025-01-31'
  AND status = 'SCHEDULED';
```

**Bad:** Scans all partitions
```sql
SELECT * FROM message_logs WHERE status = 'SENT';
```

### Index Usage

Check which indexes are being used:
```sql
SELECT
  schemaname,
  tablename,
  indexname,
  idx_scan AS index_scans
FROM pg_stat_user_indexes
WHERE schemaname = 'public'
ORDER BY idx_scan DESC;
```

## Monitoring Queries

### Partition Sizes

```sql
SELECT
  tablename,
  pg_size_pretty(pg_total_relation_size('public.'||tablename)) AS size
FROM pg_tables
WHERE tablename LIKE 'message_logs_%'
ORDER BY pg_total_relation_size('public.'||tablename) DESC;
```

### Active Connections

```sql
SELECT
  count(*) AS total_connections,
  sum(CASE WHEN state = 'active' THEN 1 ELSE 0 END) AS active,
  sum(CASE WHEN state = 'idle' THEN 1 ELSE 0 END) AS idle
FROM pg_stat_activity
WHERE datname = 'birthday_app';
```

### Slow Queries

```sql
SELECT
  query,
  calls,
  total_exec_time,
  mean_exec_time,
  max_exec_time
FROM pg_stat_statements
ORDER BY mean_exec_time DESC
LIMIT 10;
```

## Troubleshooting

### Issue: Cannot connect to PostgreSQL

**Solution:**
```bash
# Check if container is running
docker-compose ps postgres

# Check logs
docker-compose logs postgres

# Restart container
docker-compose restart postgres

# If still failing, reset
docker-compose down -v
docker-compose up -d
```

### Issue: Migration fails

**Solution:**
```bash
# Check if database is ready
docker-compose ps

# Verify connection
psql -h localhost -U postgres -d birthday_app

# Reset and try again
docker-compose down -v
docker-compose up -d
sleep 5
npm run db:migrate
```

### Issue: Partition not found

**Solution:**
```bash
# List existing partitions
psql -h localhost -U postgres -d birthday_app -c "
SELECT tablename FROM pg_tables WHERE tablename LIKE 'message_logs_%';
"

# Create missing partitions
tsx scripts/create-partitions.ts 24
```

## Next Steps

1. **Review the schema:** Open Drizzle Studio (`npm run db:studio`)
2. **Explore test data:** Query users and message logs
3. **Proceed to implementation:**
   - Repositories (`src/repositories/`)
   - Services (`src/services/`)
   - API controllers (`src/controllers/`)
   - RabbitMQ integration (`src/queue/`)

## Architecture References

This implementation follows:
- **Technical Specifications:** `plan/01-requirements/technical-specifications.md`
- **Architecture Overview:** `plan/02-architecture/architecture-overview.md`

Key design decisions:
- **Drizzle ORM** - Type-safe, lightweight, better DX than Prisma
- **Monthly partitioning** - 10-100x query speedup for 1M+ msg/day
- **IANA timezones** - Automatic DST handling
- **Database-level idempotency** - No race conditions
- **RabbitMQ Quorum Queues** - Zero data loss vs BullMQ/Redis

## Support

For questions or issues:
1. Check `README-DATABASE.md` for detailed database documentation
2. Review architecture documents in `plan/` directory
3. Examine Drizzle schema files in `src/db/schema/`

---

**Status:** ✅ Database infrastructure setup complete!
