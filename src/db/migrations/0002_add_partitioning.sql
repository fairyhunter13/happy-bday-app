-- Migration: Add Partitioning to message_logs Table
-- Performance Optimization: 10-100x query speedup for time-range queries
--
-- Strategy: Monthly range partitioning on scheduled_send_time
-- Constitutional Requirement: Database MUST be partitioned for 1M+ msg/day
--
-- Impact:
-- - Faster queries: Only scans relevant month partition
-- - Efficient archival: Drop old partitions instead of DELETE
-- - Bounded index size: Indexes only for active data
-- - Partition pruning: PostgreSQL automatically excludes irrelevant partitions

-- Step 1: Rename existing table
ALTER TABLE message_logs RENAME TO message_logs_old;

-- Step 2: Create new partitioned table with same structure
CREATE TABLE message_logs (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"message_type" varchar(50) NOT NULL,
	"message_content" text NOT NULL,
	"scheduled_send_time" timestamp with time zone NOT NULL,
	"actual_send_time" timestamp with time zone,
	"status" varchar(20) NOT NULL DEFAULT 'SCHEDULED',
	"retry_count" integer NOT NULL DEFAULT 0,
	"last_retry_at" timestamp with time zone,
	"api_response_code" integer,
	"api_response_body" text,
	"error_message" text,
	"idempotency_key" varchar(255) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "message_logs_idempotency_key_unique" UNIQUE("idempotency_key"),
	CONSTRAINT "message_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE cascade
) PARTITION BY RANGE (scheduled_send_time);

-- Step 3: Create indexes on partitioned table
-- Note: Indexes are automatically inherited by partitions
CREATE INDEX "idx_message_logs_user_id" ON "message_logs" ("user_id");
CREATE INDEX "idx_message_logs_status" ON "message_logs" ("status");
CREATE INDEX "idx_message_logs_scheduled_time" ON "message_logs" ("scheduled_send_time");
CREATE INDEX "idx_message_logs_scheduler" ON "message_logs" ("message_type","status","scheduled_send_time");
CREATE INDEX "idx_message_logs_recovery" ON "message_logs" ("scheduled_send_time","status")
  WHERE "status" IN ('SCHEDULED', 'RETRYING', 'FAILED');
CREATE UNIQUE INDEX "idx_message_logs_idempotency" ON "message_logs" ("idempotency_key");

-- Step 4: Create monthly partitions for 2025
-- Each partition holds one month of data
CREATE TABLE message_logs_2025_01 PARTITION OF message_logs
  FOR VALUES FROM ('2025-01-01') TO ('2025-02-01');

CREATE TABLE message_logs_2025_02 PARTITION OF message_logs
  FOR VALUES FROM ('2025-02-01') TO ('2025-03-01');

CREATE TABLE message_logs_2025_03 PARTITION OF message_logs
  FOR VALUES FROM ('2025-03-01') TO ('2025-04-01');

CREATE TABLE message_logs_2025_04 PARTITION OF message_logs
  FOR VALUES FROM ('2025-04-01') TO ('2025-05-01');

CREATE TABLE message_logs_2025_05 PARTITION OF message_logs
  FOR VALUES FROM ('2025-05-01') TO ('2025-06-01');

CREATE TABLE message_logs_2025_06 PARTITION OF message_logs
  FOR VALUES FROM ('2025-06-01') TO ('2025-07-01');

CREATE TABLE message_logs_2025_07 PARTITION OF message_logs
  FOR VALUES FROM ('2025-07-01') TO ('2025-08-01');

CREATE TABLE message_logs_2025_08 PARTITION OF message_logs
  FOR VALUES FROM ('2025-08-01') TO ('2025-09-01');

CREATE TABLE message_logs_2025_09 PARTITION OF message_logs
  FOR VALUES FROM ('2025-09-01') TO ('2025-10-01');

CREATE TABLE message_logs_2025_10 PARTITION OF message_logs
  FOR VALUES FROM ('2025-10-01') TO ('2025-11-01');

CREATE TABLE message_logs_2025_11 PARTITION OF message_logs
  FOR VALUES FROM ('2025-11-01') TO ('2025-12-01');

CREATE TABLE message_logs_2025_12 PARTITION OF message_logs
  FOR VALUES FROM ('2025-12-01') TO ('2026-01-01');

-- Step 5: Create partitions for 2026 (next year planning)
CREATE TABLE message_logs_2026_01 PARTITION OF message_logs
  FOR VALUES FROM ('2026-01-01') TO ('2026-02-01');

CREATE TABLE message_logs_2026_02 PARTITION OF message_logs
  FOR VALUES FROM ('2026-02-01') TO ('2026-03-01');

CREATE TABLE message_logs_2026_03 PARTITION OF message_logs
  FOR VALUES FROM ('2026-03-01') TO ('2026-04-01');

-- Step 6: Migrate existing data from old table to new partitioned table
-- This may take time if there's a lot of data
INSERT INTO message_logs
SELECT * FROM message_logs_old;

-- Step 7: Drop old table (WARNING: Point of no return!)
-- Uncomment this after verifying the migration was successful
-- DROP TABLE message_logs_old;

-- Step 8: Analyze tables for query planner optimization
ANALYZE message_logs;

-- Verification Queries:
-- 1. Check partitions exist
-- SELECT tablename FROM pg_tables
-- WHERE schemaname = 'public' AND tablename LIKE 'message_logs_%';
--
-- 2. Verify partition pruning works
-- EXPLAIN ANALYZE
-- SELECT * FROM message_logs
-- WHERE scheduled_send_time >= '2025-01-01'
--   AND scheduled_send_time < '2025-02-01';
-- Should show: "Seq Scan on message_logs_2025_01" (only scans 1 partition)
--
-- 3. Check row counts per partition
-- SELECT
--   schemaname,
--   tablename,
--   n_live_tup as row_count
-- FROM pg_stat_user_tables
-- WHERE tablename LIKE 'message_logs_%'
-- ORDER BY tablename;
