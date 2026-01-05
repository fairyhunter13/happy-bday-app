#!/usr/bin/env tsx

/**
 * Database migration runner
 *
 * Usage:
 *   npm run db:migrate
 *
 * This script:
 * 1. Runs pending Drizzle migrations
 * 2. Creates monthly partitions for message_logs table
 * 3. Adds database constraints (timezone validation, status check)
 */

import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';
import { sql } from 'drizzle-orm';

// Database URL from environment
// In production, DATABASE_URL must be set via environment variable
const getDatabaseUrl = (): string => {
  if (process.env.DATABASE_URL) {
    return process.env.DATABASE_URL;
  }

  // Development fallback - only used when DATABASE_URL is not set
  if (process.env.NODE_ENV === 'production') {
    throw new Error('DATABASE_URL environment variable is required in production');
  }

  // Local development default (not a real password, only for local dev containers)
  const devHost = process.env.DATABASE_HOST || 'localhost';
  const devPort = process.env.DATABASE_PORT || '5432';
  const devUser = process.env.DATABASE_USER || 'postgres';
  const devPass = process.env.DATABASE_PASSWORD || 'postgres';
  const devDb = process.env.DATABASE_NAME || 'birthday_app';
  return `postgres://${devUser}:${devPass}@${devHost}:${devPort}/${devDb}`;
};

const DATABASE_URL = getDatabaseUrl();

async function runMigrations() {
  console.log('🚀 Starting database migrations...\n');

  // Create migration client (max 1 connection)
  const migrationClient = postgres(DATABASE_URL, { max: 1 });
  const db = drizzle(migrationClient);

  try {
    // Step 1: Run Drizzle migrations
    console.log('📦 Running Drizzle migrations...');
    await migrate(db, { migrationsFolder: './src/db/migrations' });
    console.log('✅ Drizzle migrations completed\n');

    // Step 2: Create monthly partitions for message_logs
    console.log('📅 Creating monthly partitions for message_logs...');
    await createMonthlyPartitions(db);
    console.log('✅ Monthly partitions created\n');

    // Step 3: Add database constraints
    console.log('🔒 Adding database constraints...');
    await addDatabaseConstraints(db);
    console.log('✅ Database constraints added\n');

    console.log('🎉 All migrations completed successfully!');
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  } finally {
    await migrationClient.end();
  }
}

/**
 * Create monthly partitions for message_logs table
 * Creates partitions for current month + next 12 months
 */
async function createMonthlyPartitions(db: any) {
  const currentDate = new Date();
  const partitions: string[] = [];

  // Create partitions for next 13 months (current + 12 ahead)
  for (let i = 0; i < 13; i++) {
    const date = new Date(currentDate);
    date.setMonth(date.getMonth() + i);

    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const partitionName = `message_logs_${year}_${month}`;

    // Calculate partition range
    const startDate = new Date(year, date.getMonth(), 1);
    const endDate = new Date(year, date.getMonth() + 1, 1);

    const startDateStr = startDate.toISOString().split('T')[0];
    const endDateStr = endDate.toISOString().split('T')[0];

    partitions.push(partitionName);

    // Check if partition already exists
    const partitionExists = await db.execute(sql`
      SELECT EXISTS (
        SELECT 1 FROM pg_class WHERE relname = ${partitionName}
      );
    `);

    if (!partitionExists.rows[0]?.exists) {
      console.log(`  Creating partition: ${partitionName} (${startDateStr} to ${endDateStr})`);

      await db.execute(
        sql.raw(`
        CREATE TABLE IF NOT EXISTS ${partitionName}
        PARTITION OF message_logs
        FOR VALUES FROM ('${startDateStr}') TO ('${endDateStr}');
      `)
      );
    } else {
      console.log(`  Partition already exists: ${partitionName}`);
    }
  }

  console.log(`  Created/verified ${partitions.length} partitions`);
}

/**
 * Add database-level constraints
 * - Timezone validation (IANA format)
 * - Status enum validation
 */
async function addDatabaseConstraints(db: any) {
  try {
    // Constraint 1: Validate IANA timezone format
    // Example valid: "America/New_York", "Europe/London"
    // Example invalid: "EST", "GMT+5"
    console.log('  Adding timezone validation constraint...');
    await db.execute(sql`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'check_timezone_format'
        ) THEN
          ALTER TABLE users
          ADD CONSTRAINT check_timezone_format
          CHECK (timezone ~ '^[A-Za-z]+/[A-Za-z_]+$');
        END IF;
      END $$;
    `);

    // Constraint 2: Validate message status enum
    console.log('  Adding message status validation constraint...');
    await db.execute(sql`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'check_message_status'
        ) THEN
          ALTER TABLE message_logs
          ADD CONSTRAINT check_message_status
          CHECK (status IN ('SCHEDULED', 'QUEUED', 'SENDING', 'SENT', 'FAILED', 'RETRYING'));
        END IF;
      END $$;
    `);

    // Constraint 3: Validate message type enum
    console.log('  Adding message type validation constraint...');
    await db.execute(sql`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'check_message_type'
        ) THEN
          ALTER TABLE message_logs
          ADD CONSTRAINT check_message_type
          CHECK (message_type IN ('BIRTHDAY', 'ANNIVERSARY'));
        END IF;
      END $$;
    `);

    // Constraint 4: Ensure retry_count is non-negative
    console.log('  Adding retry count validation constraint...');
    await db.execute(sql`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'check_retry_count_positive'
        ) THEN
          ALTER TABLE message_logs
          ADD CONSTRAINT check_retry_count_positive
          CHECK (retry_count >= 0);
        END IF;
      END $$;
    `);

    console.log('  All constraints added successfully');
  } catch (error: any) {
    // Ignore "already exists" errors
    if (!error.message?.includes('already exists')) {
      throw error;
    }
  }
}

// Run migrations
runMigrations();
