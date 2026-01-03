#!/usr/bin/env tsx

/**
 * Performance Testing Database Seed Script
 *
 * Usage:
 *   npm run db:seed:perf
 *
 * Creates a pool of test users specifically for performance testing:
 * - 10,000 users with UUIDs for load testing
 * - Pre-generated UUIDs that k6 tests can reference
 * - Optimized for high-volume performance scenarios
 *
 * Design:
 * - Uses a deterministic UUID pool so k6 tests can reference valid users
 * - Creates users in batches for faster insertion
 * - No message logs created (tests will create those)
 */

import { db } from './connection.js';
import { users } from './schema/index.js';
import { sql } from 'drizzle-orm';

const TIMEZONES = [
  'America/New_York',
  'America/Los_Angeles',
  'America/Chicago',
  'Europe/London',
  'Asia/Tokyo',
  'Australia/Sydney',
];

// Fixed UUID pool for performance testing
// These UUIDs are deterministic so k6 tests can reference them
const PERF_USER_ID_PREFIX = '00000000-0000-4000-8000-';

/**
 * Generate a deterministic UUID for performance testing
 * Format: 00000000-0000-4000-8000-{index:012d}
 * Example: 00000000-0000-4000-8000-000000000001
 */
function generatePerfUserId(index: number): string {
  const indexStr = index.toString().padStart(12, '0');
  return `${PERF_USER_ID_PREFIX}${indexStr}`;
}

/**
 * Generate random date within a range
 */
function randomDate(start: Date, end: Date): Date {
  return new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));
}

/**
 * Generate random element from array
 */
function randomElement<T>(arr: T[]): T {
  const index = Math.floor(Math.random() * arr.length);
  const element = arr[index];
  if (element === undefined) {
    throw new Error('Array is empty');
  }
  return element;
}

async function seedPerformanceUsers() {
  console.log('🚀 Starting performance test database seed...\n');

  try {
    // Configuration
    const TOTAL_USERS = 10000; // Create 10k users for load testing
    const BATCH_SIZE = 1000; // Insert in batches of 1000

    console.log(`📊 Configuration:`);
    console.log(`  - Total users: ${TOTAL_USERS.toLocaleString()}`);
    console.log(`  - Batch size: ${BATCH_SIZE.toLocaleString()}`);
    console.log(`  - UUID prefix: ${PERF_USER_ID_PREFIX}XXXXXXXXXXXX`);
    console.log();

    // Step 1: Clean existing performance test users
    console.log('🧹 Cleaning existing performance test users...');
    await db.delete(users).where(sql`${users.id}::text LIKE ${PERF_USER_ID_PREFIX}||'%'`);
    console.log(`✅ Cleaned existing performance test users\n`);

    // Step 2: Create test users in batches
    console.log('👥 Creating performance test users...');
    let totalCreated = 0;

    for (let batchStart = 0; batchStart < TOTAL_USERS; batchStart += BATCH_SIZE) {
      const batchEnd = Math.min(batchStart + BATCH_SIZE, TOTAL_USERS);
      const batchUsers: Array<typeof users.$inferInsert> = [];

      for (let i = batchStart; i < batchEnd; i++) {
        const userId = generatePerfUserId(i + 1);
        const timezone = randomElement(TIMEZONES);

        // Random birthday (1980-2005)
        const birthdayDate = randomDate(new Date(1980, 0, 1), new Date(2005, 11, 31));

        // Random anniversary (2010-2023) for 50% of users
        const anniversaryDate =
          Math.random() > 0.5 ? randomDate(new Date(2010, 0, 1), new Date(2023, 11, 31)) : null;

        const user = {
          id: userId, // Use deterministic UUID
          firstName: `PerfUser`,
          lastName: `${i + 1}`,
          email: `perf.user.${i + 1}@test.com`,
          timezone,
          birthdayDate,
          anniversaryDate,
          locationCity: 'Test City',
          locationCountry: 'Test Country',
        };

        batchUsers.push(user);
      }

      // Insert batch
      await db.insert(users).values(batchUsers);
      totalCreated += batchUsers.length;

      // Progress update
      const progress = ((totalCreated / TOTAL_USERS) * 100).toFixed(1);
      console.log(
        `  📈 Progress: ${totalCreated.toLocaleString()}/${TOTAL_USERS.toLocaleString()} (${progress}%)`
      );
    }

    console.log(`✅ Created ${totalCreated.toLocaleString()} performance test users\n`);

    // Step 3: Display summary
    console.log('📊 Seed Summary:');
    console.log(`  - Total users created: ${totalCreated.toLocaleString()}`);
    console.log(`  - UUID format: ${generatePerfUserId(1)} to ${generatePerfUserId(TOTAL_USERS)}`);
    console.log(`  - Email format: perf.user.1@test.com to perf.user.${TOTAL_USERS}@test.com`);
    console.log();

    console.log('💡 Usage in k6 tests:');
    console.log('  // Generate a random user ID from the pool');
    console.log('  const userIndex = Math.floor(Math.random() * 10000) + 1;');
    console.log(
      '  const userId = `00000000-0000-4000-8000-${userIndex.toString().padStart(12, "0")}`;'
    );
    console.log();

    console.log('🎉 Performance test database seed completed successfully!');
  } catch (error) {
    console.error('❌ Seed failed:', error);
    process.exit(1);
  } finally {
    process.exit(0);
  }
}

// Run seed
seedPerformanceUsers();
