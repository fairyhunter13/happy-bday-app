#!/usr/bin/env tsx

/**
 * Drop old partitions from message_logs table
 *
 * Usage:
 *   tsx scripts/drop-old-partitions.ts [months]
 *
 * Example:
 *   tsx scripts/drop-old-partitions.ts 6  # Drop partitions older than 6 months
 *
 * WARNING: This permanently deletes data!
 */

import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { sql } from 'drizzle-orm';

const DATABASE_URL = process.env.DATABASE_URL || 'postgres://postgres:postgres_dev_password@localhost:5432/birthday_app';

async function dropOldPartitions(monthsToKeep: number = 6) {
  console.log(`🗑️  Dropping partitions older than ${monthsToKeep} months...\n`);
  console.log('⚠️  WARNING: This will permanently delete data!\n');

  const client = postgres(DATABASE_URL, { max: 1 });
  const db = drizzle(client);

  try {
    // Calculate cutoff date
    const cutoffDate = new Date();
    cutoffDate.setMonth(cutoffDate.getMonth() - monthsToKeep);

    console.log(`Cutoff date: ${cutoffDate.toISOString().split('T')[0]}\n`);

    // Get all message_logs partitions
    const result = await db.execute(sql`
      SELECT
        inhrelid::regclass AS partition_name,
        pg_get_expr(c.relpartbound, c.oid) AS partition_bounds
      FROM pg_inherits
      JOIN pg_class c ON c.oid = inhrelid
      WHERE inhparent = 'message_logs'::regclass
      ORDER BY partition_name;
    `);

    const dropped: string[] = [];
    const kept: string[] = [];

    for (const row of result.rows) {
      const partitionName = row.partition_name as string;

      // Extract date from partition name (e.g., message_logs_2025_01)
      const match = partitionName.match(/message_logs_(\d{4})_(\d{2})/);
      if (!match) {
        console.log(`Skipping invalid partition name: ${partitionName}`);
        continue;
      }

      const [, year, month] = match;
      const partitionDate = new Date(parseInt(year), parseInt(month) - 1, 1);

      if (partitionDate < cutoffDate) {
        console.log(`Dropping: ${partitionName} (${partitionDate.toISOString().split('T')[0]})`);

        await db.execute(sql.raw(`DROP TABLE ${partitionName};`));
        dropped.push(partitionName);
      } else {
        kept.push(partitionName);
      }
    }

    console.log(`\n✅ Summary:`);
    console.log(`  - Dropped: ${dropped.length} partitions`);
    console.log(`  - Kept: ${kept.length} partitions\n`);

    if (dropped.length > 0) {
      console.log('Dropped partitions:');
      dropped.forEach(p => console.log(`  - ${p}`));
    }
  } catch (error) {
    console.error('❌ Failed to drop partitions:', error);
    process.exit(1);
  } finally {
    await client.end();
  }
}

// Parse command line arguments
const monthsArg = process.argv[2];
const months = monthsArg ? parseInt(monthsArg, 10) : 6;

if (isNaN(months) || months < 1 || months > 120) {
  console.error('Invalid months argument. Must be between 1 and 120.');
  process.exit(1);
}

// Confirm before proceeding
console.log(`This will drop all partitions older than ${months} months.`);
console.log('Press Ctrl+C to cancel, or wait 5 seconds to continue...\n');

setTimeout(() => {
  dropOldPartitions(months);
}, 5000);
