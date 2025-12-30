#!/usr/bin/env tsx

/**
 * Create future partitions for message_logs table
 *
 * Usage:
 *   tsx scripts/create-partitions.ts [months]
 *
 * Example:
 *   tsx scripts/create-partitions.ts 24  # Create 24 months of partitions
 */

import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { sql } from 'drizzle-orm';

const DATABASE_URL = process.env.DATABASE_URL || 'postgres://postgres:postgres_dev_password@localhost:5432/birthday_app';

async function createFuturePartitions(monthsAhead: number = 12) {
  console.log(`📅 Creating ${monthsAhead} months of future partitions...\n`);

  const client = postgres(DATABASE_URL, { max: 1 });
  const db = drizzle(client);

  try {
    const currentDate = new Date();
    const created: string[] = [];
    const skipped: string[] = [];

    for (let i = 0; i < monthsAhead; i++) {
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

      // Check if partition exists
      const result = await db.execute(sql`
        SELECT EXISTS (
          SELECT 1 FROM pg_class WHERE relname = ${partitionName}
        );
      `);

      const exists = result.rows[0]?.exists;

      if (!exists) {
        console.log(`Creating: ${partitionName} (${startDateStr} to ${endDateStr})`);

        await db.execute(sql.raw(`
          CREATE TABLE ${partitionName}
          PARTITION OF message_logs
          FOR VALUES FROM ('${startDateStr}') TO ('${endDateStr}');
        `));

        created.push(partitionName);
      } else {
        skipped.push(partitionName);
      }
    }

    console.log(`\n✅ Summary:`);
    console.log(`  - Created: ${created.length} partitions`);
    console.log(`  - Skipped (already exist): ${skipped.length} partitions`);
    console.log(`  - Total: ${monthsAhead} partitions checked\n`);

    if (created.length > 0) {
      console.log('Created partitions:');
      created.forEach(p => console.log(`  - ${p}`));
    }
  } catch (error) {
    console.error('❌ Failed to create partitions:', error);
    process.exit(1);
  } finally {
    await client.end();
  }
}

// Parse command line arguments
const monthsArg = process.argv[2];
const months = monthsArg ? parseInt(monthsArg, 10) : 12;

if (isNaN(months) || months < 1 || months > 120) {
  console.error('Invalid months argument. Must be between 1 and 120.');
  process.exit(1);
}

createFuturePartitions(months);
