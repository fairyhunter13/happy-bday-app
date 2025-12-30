#!/usr/bin/env tsx

/**
 * Database seed script
 *
 * Usage:
 *   npm run db:seed
 *
 * Creates test data for development/testing:
 * - 100 users with various timezones and birthdays
 * - Sample message logs in different states
 */

import { db } from './connection';
import { users, messageLogs, MessageStatus, MessageType } from './schema';
import { DateTime } from 'luxon';

const TIMEZONES = [
  'America/New_York',
  'America/Los_Angeles',
  'America/Chicago',
  'America/Denver',
  'Europe/London',
  'Europe/Paris',
  'Europe/Berlin',
  'Asia/Tokyo',
  'Asia/Singapore',
  'Australia/Sydney',
  'Pacific/Auckland',
];

const FIRST_NAMES = [
  'John',
  'Jane',
  'Michael',
  'Sarah',
  'David',
  'Emily',
  'Robert',
  'Lisa',
  'James',
  'Mary',
  'William',
  'Jennifer',
  'Richard',
  'Linda',
  'Thomas',
  'Patricia',
];

const LAST_NAMES = [
  'Smith',
  'Johnson',
  'Williams',
  'Brown',
  'Jones',
  'Garcia',
  'Miller',
  'Davis',
  'Rodriguez',
  'Martinez',
  'Hernandez',
  'Lopez',
  'Gonzalez',
  'Wilson',
  'Anderson',
  'Thomas',
];

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
  return arr[Math.floor(Math.random() * arr.length)]!;
}

/**
 * Generate idempotency key
 */
function generateIdempotencyKey(userId: string, messageType: string, date: Date): string {
  const dateStr = DateTime.fromJSDate(date).toISODate();
  return `${userId}:${messageType}:${dateStr}`;
}

async function seed() {
  console.log('🌱 Starting database seed...\n');

  try {
    // Step 1: Clean existing data
    console.log('🧹 Cleaning existing data...');
    await db.delete(messageLogs);
    await db.delete(users);
    console.log('✅ Existing data cleaned\n');

    // Step 2: Create test users
    console.log('👥 Creating test users...');
    const testUsers: any[] = [];

    for (let i = 0; i < 100; i++) {
      const firstName = randomElement(FIRST_NAMES);
      const lastName = randomElement(LAST_NAMES);
      const email = `${firstName.toLowerCase()}.${lastName.toLowerCase()}.${i}@test.com`;
      const timezone = randomElement(TIMEZONES);

      // Random birthday (1980-2005)
      const birthdayDate = randomDate(new Date(1980, 0, 1), new Date(2005, 11, 31));

      // Random anniversary (2010-2023)
      const anniversaryDate = randomDate(new Date(2010, 0, 1), new Date(2023, 11, 31));

      const user = {
        firstName,
        lastName,
        email,
        timezone,
        birthdayDate,
        anniversaryDate: Math.random() > 0.5 ? anniversaryDate : null,
        locationCity: Math.random() > 0.5 ? 'Test City' : null,
        locationCountry: Math.random() > 0.5 ? 'Test Country' : null,
      };

      testUsers.push(user);
    }

    // Insert users in batches
    const insertedUsers = await db.insert(users).values(testUsers).returning();
    console.log(`✅ Created ${insertedUsers.length} test users\n`);

    // Step 3: Create sample message logs
    console.log('📧 Creating sample message logs...');
    const testMessages: any[] = [];

    // Create messages for first 20 users
    for (let i = 0; i < 20; i++) {
      const user = insertedUsers[i]!;

      // Birthday message - scheduled for today at 9am user's time
      if (user.birthdayDate) {
        const sendTime = DateTime.now()
          .setZone(user.timezone)
          .set({ hour: 9, minute: 0, second: 0, millisecond: 0 })
          .toUTC()
          .toJSDate();

        testMessages.push({
          userId: user.id,
          messageType: MessageType.BIRTHDAY,
          messageContent: `Hey, ${user.firstName} ${user.lastName} it's your birthday!`,
          scheduledSendTime: sendTime,
          status: MessageStatus.SCHEDULED,
          idempotencyKey: generateIdempotencyKey(user.id, MessageType.BIRTHDAY, sendTime),
          retryCount: 0,
        });
      }

      // Anniversary message - sent yesterday
      if (user.anniversaryDate && i < 10) {
        const sendTime = DateTime.now()
          .minus({ days: 1 })
          .setZone(user.timezone)
          .set({ hour: 9, minute: 0, second: 0, millisecond: 0 })
          .toUTC()
          .toJSDate();

        testMessages.push({
          userId: user.id,
          messageType: MessageType.ANNIVERSARY,
          messageContent: `Happy Anniversary, ${user.firstName}!`,
          scheduledSendTime: sendTime,
          actualSendTime: DateTime.fromJSDate(sendTime).plus({ seconds: 30 }).toJSDate(),
          status: MessageStatus.SENT,
          idempotencyKey: generateIdempotencyKey(user.id, MessageType.ANNIVERSARY, sendTime),
          retryCount: 0,
          apiResponseCode: 200,
          apiResponseBody: '{"status": "success"}',
        });
      }

      // Failed message example (for testing recovery)
      if (i < 5) {
        const sendTime = DateTime.now().minus({ hours: 2 }).toJSDate();

        testMessages.push({
          userId: user.id,
          messageType: MessageType.BIRTHDAY,
          messageContent: `Hey, ${user.firstName} ${user.lastName} it's your birthday!`,
          scheduledSendTime: sendTime,
          status: MessageStatus.FAILED,
          idempotencyKey:
            generateIdempotencyKey(user.id, MessageType.BIRTHDAY, sendTime) + ':failed',
          retryCount: 5,
          lastRetryAt: DateTime.now().minus({ minutes: 30 }).toJSDate(),
          apiResponseCode: 500,
          errorMessage: 'Email service timeout',
        });
      }
    }

    // Insert message logs
    if (testMessages.length > 0) {
      await db.insert(messageLogs).values(testMessages);
      console.log(`✅ Created ${testMessages.length} sample message logs\n`);
    }

    // Step 4: Display summary
    console.log('📊 Seed Summary:');
    console.log(`  - Total users: ${insertedUsers.length}`);
    console.log(`  - Total messages: ${testMessages.length}`);
    console.log(
      `  - Scheduled messages: ${testMessages.filter((m) => m.status === MessageStatus.SCHEDULED).length}`
    );
    console.log(
      `  - Sent messages: ${testMessages.filter((m) => m.status === MessageStatus.SENT).length}`
    );
    console.log(
      `  - Failed messages: ${testMessages.filter((m) => m.status === MessageStatus.FAILED).length}`
    );
    console.log();

    console.log('🎉 Database seed completed successfully!');
  } catch (error) {
    console.error('❌ Seed failed:', error);
    process.exit(1);
  } finally {
    process.exit(0);
  }
}

// Run seed
seed();
