# Database Infrastructure Setup

This document describes the database infrastructure for the Birthday Message Scheduler application.

## Overview

The application uses:
- **PostgreSQL 15** - Primary database with partitioning support
- **Drizzle ORM** - Type-safe ORM with excellent TypeScript support
- **RabbitMQ 3.13+** - Message queue with Quorum Queues for zero data loss
- **Redis 7** - Optional caching layer

## Quick Start

### 1. Start Infrastructure

```bash
# Start all services (PostgreSQL, RabbitMQ, Redis, PgAdmin)
docker-compose up -d

# Check services are healthy
docker-compose ps

# View logs
docker-compose logs -f
```

### 2. Run Migrations

```bash
# Generate migration files from schema
npm run db:generate

# Run migrations (creates tables, partitions, constraints)
npm run db:migrate
```

### 3. Seed Test Data

```bash
# Create 100 test users with sample message logs
npm run db:seed
```

## Database Schema

### Users Table

Stores user information with timezone-aware birthday/anniversary dates.

**Key Features:**
- IANA timezone storage (e.g., "America/New_York") for DST handling
- Soft delete support via `deleted_at`
- Partial indexes for performance (only non-deleted users)

**Columns:**
- `id` (UUID) - Primary key
- `first_name`, `last_name` - User name
- `email` - Unique email address
- `timezone` - IANA timezone identifier
- `birthday_date` - Date (month/day only)
- `anniversary_date` - Date (month/day only)
- `location_city`, `location_country` - Optional location
- `created_at`, `updated_at` - Timestamps
- `deleted_at` - Soft delete timestamp

**Indexes:**
```sql
-- Partial index: birthday_date (non-deleted users only)
CREATE INDEX idx_users_birthday_date ON users(birthday_date)
WHERE deleted_at IS NULL AND birthday_date IS NOT NULL;

-- Partial index: anniversary_date
CREATE INDEX idx_users_anniversary_date ON users(anniversary_date)
WHERE deleted_at IS NULL AND anniversary_date IS NOT NULL;

-- Composite index: birthday_date + timezone
CREATE INDEX idx_users_birthday_timezone ON users(birthday_date, timezone)
WHERE deleted_at IS NULL;

-- Unique email (soft-delete aware)
CREATE INDEX idx_users_email_unique ON users(email)
WHERE deleted_at IS NULL;
```

### Message Logs Table (Partitioned)

Stores message delivery logs with **monthly partitioning** for 10-100x query performance.

**Key Features:**
- Monthly partitions by `scheduled_send_time`
- Idempotency via unique constraint `(user_id, message_type, delivery_date)`
- Pre-composed message content (no runtime computation)
- API response tracking for debugging

**Columns:**
- `id` (UUID) - Primary key
- `user_id` (UUID) - Foreign key to users (CASCADE delete)
- `message_type` - 'BIRTHDAY', 'ANNIVERSARY', etc.
- `message_content` - Pre-composed message text
- `scheduled_send_time` - UTC timestamp (9am user's local time)
- `actual_send_time` - When message was actually sent
- `status` - SCHEDULED, QUEUED, SENDING, SENT, FAILED, RETRYING
- `retry_count` - Number of retry attempts
- `last_retry_at` - Last retry timestamp
- `api_response_code` - HTTP response code
- `api_response_body` - API response payload
- `error_message` - Error details
- `idempotency_key` - Unique key (user:type:date)
- `created_at`, `updated_at` - Timestamps

**Partitioning Strategy:**
```sql
-- Create parent table with partitioning
CREATE TABLE message_logs (...) PARTITION BY RANGE (scheduled_send_time);

-- Create monthly partitions
CREATE TABLE message_logs_2025_01 PARTITION OF message_logs
  FOR VALUES FROM ('2025-01-01') TO ('2025-02-01');

CREATE TABLE message_logs_2025_02 PARTITION OF message_logs
  FOR VALUES FROM ('2025-02-01') TO ('2025-03-01');
-- ... and so on
```

**Indexes:**
```sql
-- User ID (for CASCADE delete performance)
CREATE INDEX idx_message_logs_user_id ON message_logs(user_id);

-- Status filtering
CREATE INDEX idx_message_logs_status ON message_logs(status);

-- Scheduled time
CREATE INDEX idx_message_logs_scheduled_time ON message_logs(scheduled_send_time);

-- Scheduler query optimization
CREATE INDEX idx_message_logs_scheduler ON message_logs(message_type, status, scheduled_send_time);

-- Recovery query optimization
CREATE INDEX idx_message_logs_recovery ON message_logs(scheduled_send_time, status)
WHERE status IN ('SCHEDULED', 'RETRYING', 'FAILED');

-- Idempotency enforcement
CREATE UNIQUE INDEX idx_message_logs_idempotency ON message_logs(idempotency_key);
```

## Database Constraints

### Timezone Validation
Ensures timezone follows IANA format (e.g., "America/New_York"):
```sql
ALTER TABLE users
ADD CONSTRAINT check_timezone_format
CHECK (timezone ~ '^[A-Za-z]+/[A-Za-z_]+$');
```

### Message Status Validation
```sql
ALTER TABLE message_logs
ADD CONSTRAINT check_message_status
CHECK (status IN ('SCHEDULED', 'QUEUED', 'SENDING', 'SENT', 'FAILED', 'RETRYING'));
```

### Message Type Validation
```sql
ALTER TABLE message_logs
ADD CONSTRAINT check_message_type
CHECK (message_type IN ('BIRTHDAY', 'ANNIVERSARY'));
```

### Retry Count Validation
```sql
ALTER TABLE message_logs
ADD CONSTRAINT check_retry_count_positive
CHECK (retry_count >= 0);
```

## Connection Pooling

Configured in `src/db/connection.ts`:

```typescript
{
  max: 20,           // Max connections
  idle_timeout: 30,  // Close idle connections after 30s
  connect_timeout: 10 // Timeout connection attempts after 10s
}
```

## Partition Management

### Create Future Partitions

```bash
# Create 12 months of future partitions
tsx scripts/create-partitions.ts 12

# Create 24 months
tsx scripts/create-partitions.ts 24
```

### Drop Old Partitions

```bash
# Drop partitions older than 6 months
tsx scripts/drop-old-partitions.ts 6
```

**WARNING:** This permanently deletes data!

### Automated Partition Management

Partitions are automatically created during migration (`npm run db:migrate`). The migration script creates:
- Current month partition
- Next 12 months of partitions

## Database Access Tools

### PgAdmin (Web UI)

```
URL: http://localhost:5050
Email: admin@birthday-app.local
Password: pgadmin_dev_password
```

### Drizzle Studio (Web UI)

```bash
npm run db:studio
```

Then open http://localhost:4983

### Direct PostgreSQL Access

```bash
# Via Docker
docker exec -it birthday-app-postgres psql -U postgres -d birthday_app

# Via local psql
psql -h localhost -U postgres -d birthday_app
```

## Common Commands

```bash
# Generate migrations from schema changes
npm run db:generate

# Run pending migrations
npm run db:migrate

# Push schema changes directly (dev only)
npm run db:push

# Seed test data
npm run db:seed

# Start Drizzle Studio
npm run db:studio
```

## Performance Optimization

### Query Performance Tips

1. **Use partitions effectively:**
   ```sql
   -- Good: Query includes partition key
   SELECT * FROM message_logs
   WHERE scheduled_send_time BETWEEN '2025-01-01' AND '2025-01-31';

   -- Bad: Query without partition key scans all partitions
   SELECT * FROM message_logs WHERE status = 'SENT';
   ```

2. **Leverage partial indexes:**
   ```sql
   -- Uses idx_users_birthday_date
   SELECT * FROM users
   WHERE birthday_date = '12-30' AND deleted_at IS NULL;
   ```

3. **Use composite indexes:**
   ```sql
   -- Uses idx_message_logs_scheduler
   SELECT * FROM message_logs
   WHERE message_type = 'BIRTHDAY'
     AND status = 'SCHEDULED'
     AND scheduled_send_time > NOW();
   ```

### Connection Pool Tuning

Adjust based on load:
- **Low traffic:** `DATABASE_POOL_MAX=10`
- **Medium traffic:** `DATABASE_POOL_MAX=20`
- **High traffic:** `DATABASE_POOL_MAX=50`

Formula: `max_connections = (# of API servers × pool_max) + 10`

## Monitoring

### Check Partition Usage

```sql
SELECT
  schemaname,
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
FROM pg_tables
WHERE tablename LIKE 'message_logs_%'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
```

### Check Index Usage

```sql
SELECT
  schemaname,
  tablename,
  indexname,
  idx_scan,
  idx_tup_read,
  idx_tup_fetch
FROM pg_stat_user_indexes
WHERE schemaname = 'public'
ORDER BY idx_scan DESC;
```

### Check Connection Pool

```sql
SELECT
  count(*) AS total_connections,
  sum(CASE WHEN state = 'active' THEN 1 ELSE 0 END) AS active_connections,
  sum(CASE WHEN state = 'idle' THEN 1 ELSE 0 END) AS idle_connections
FROM pg_stat_activity
WHERE datname = 'birthday_app';
```

## Troubleshooting

### Connection Errors

```bash
# Check if PostgreSQL is running
docker-compose ps postgres

# View PostgreSQL logs
docker-compose logs postgres

# Test connection
psql -h localhost -U postgres -d birthday_app
```

### Migration Errors

```bash
# Reset migrations (WARNING: deletes all data)
docker-compose down -v
docker-compose up -d
npm run db:migrate
npm run db:seed
```

### Partition Errors

```bash
# List existing partitions
psql -h localhost -U postgres -d birthday_app -c "
SELECT
  inhrelid::regclass AS partition_name
FROM pg_inherits
WHERE inhparent = 'message_logs'::regclass;
"

# Create missing partitions manually
tsx scripts/create-partitions.ts 12
```

## Architecture Decisions

This database design follows the specifications in:
- `plan/01-requirements/technical-specifications.md`
- `plan/02-architecture/architecture-overview.md`

Key decisions:
- **Drizzle ORM** (not TypeORM/Prisma) - Better TypeScript DX, lightweight
- **Monthly partitioning** - 10-100x query speedup for 1M+ messages/day
- **IANA timezones** - Automatic DST handling
- **Database-level idempotency** - No race conditions
- **Partial indexes** - Smaller indexes, faster queries
- **RabbitMQ Quorum Queues** - Zero data loss (vs BullMQ/Redis risk)

## Next Steps

1. Review schema in Drizzle Studio: `npm run db:studio`
2. Run seed to create test data: `npm run db:seed`
3. Proceed to implementing repositories and services
4. Setup RabbitMQ queues (see `plan/02-architecture/architecture-overview.md`)
