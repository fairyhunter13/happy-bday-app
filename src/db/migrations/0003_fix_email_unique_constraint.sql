-- Migration: Fix email uniqueness to support soft delete email reuse
-- This migration:
-- 1. Drops the existing unconditional unique constraint on email
-- 2. Drops the existing partial index (if it exists)
-- 3. Creates a partial UNIQUE index that only applies to non-deleted users

-- Drop the unconditional unique constraint (if it exists)
ALTER TABLE "users" DROP CONSTRAINT IF EXISTS "users_email_unique";
--> statement-breakpoint

-- Drop the existing partial index (it was not UNIQUE before)
DROP INDEX IF EXISTS "idx_users_email_unique";
--> statement-breakpoint

-- Create partial UNIQUE index on email (only non-deleted users)
-- This allows email reuse after soft delete
CREATE UNIQUE INDEX "idx_users_email_unique" ON "users" ("email") WHERE "deleted_at" IS NULL;
