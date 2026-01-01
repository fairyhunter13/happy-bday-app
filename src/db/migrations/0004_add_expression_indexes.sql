-- Add expression-based indexes for EXTRACT queries on birthday_date and anniversary_date
-- These indexes optimize the findBirthdaysToday and findAnniversariesToday queries

-- Expression index for birthday month/day extraction
-- Used by: cached-user.repository.ts findBirthdaysToday()
CREATE INDEX IF NOT EXISTS "idx_users_birthday_month_day"
ON "users" (EXTRACT(MONTH FROM "birthday_date"), EXTRACT(DAY FROM "birthday_date"))
WHERE "deleted_at" IS NULL AND "birthday_date" IS NOT NULL;

--> statement-breakpoint

-- Expression index for anniversary month/day extraction
-- Used by: cached-user.repository.ts findAnniversariesToday()
CREATE INDEX IF NOT EXISTS "idx_users_anniversary_month_day"
ON "users" (EXTRACT(MONTH FROM "anniversary_date"), EXTRACT(DAY FROM "anniversary_date"))
WHERE "deleted_at" IS NULL AND "anniversary_date" IS NOT NULL;

--> statement-breakpoint

-- Standalone timezone index for filtering by timezone
-- Used in combination with date extractions for timezone-aware queries
CREATE INDEX IF NOT EXISTS "idx_users_timezone"
ON "users" ("timezone")
WHERE "deleted_at" IS NULL;
