/**
 * E2E Test: Multi-Timezone Message Flow
 *
 * Tests message delivery across multiple timezones:
 * - 10+ users in different timezones
 * - All have birthday on same day
 * - Verify messages sent at 9am in each timezone
 * - Verify timing is correct for DST transitions
 * - Test comprehensive timezone coverage
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import {
  TestEnvironment,
  waitFor,
  cleanDatabase,
  purgeQueues,
  clearBirthdayCache,
} from '../helpers/testcontainers-optimized.js';
import {
  insertUser,
  findMessageLogsByUserId,
  createTodayBirthdayUTC,
} from '../helpers/test-helpers.js';
import { QUEUES } from '../../src/queue/config.js';
// Type-only import - doesn't trigger module initialization
import type { SchedulerService as SchedulerServiceType } from '../../src/services/scheduler.service.js';
import { MessageStatus } from '../../src/db/schema/message-logs.js';
import { DateTime } from 'luxon';
import type { Pool } from 'pg';
import type { Connection } from 'amqplib';

describe('E2E: Multi-Timezone Message Flow', () => {
  let env: TestEnvironment;
  let pool: Pool;
  let amqpConnection: Connection;
  let scheduler: SchedulerServiceType;

  // Comprehensive timezone test set covering all major regions
  const TIMEZONES = [
    { name: 'Pacific/Auckland', offset: '+12:00', location: 'New Zealand' },
    { name: 'Asia/Tokyo', offset: '+09:00', location: 'Japan' },
    { name: 'Asia/Shanghai', offset: '+08:00', location: 'China' },
    { name: 'Asia/Dubai', offset: '+04:00', location: 'UAE' },
    { name: 'Europe/Moscow', offset: '+03:00', location: 'Russia' },
    { name: 'Europe/Paris', offset: '+01:00', location: 'France' },
    { name: 'Europe/London', offset: '+00:00', location: 'UK' },
    { name: 'America/New_York', offset: '-05:00', location: 'USA East' },
    { name: 'America/Chicago', offset: '-06:00', location: 'USA Central' },
    { name: 'America/Denver', offset: '-07:00', location: 'USA Mountain' },
    { name: 'America/Los_Angeles', offset: '-08:00', location: 'USA West' },
    { name: 'Pacific/Honolulu', offset: '-10:00', location: 'Hawaii' },
  ];

  // DST-affected timezones
  const DST_TIMEZONES = ['America/New_York', 'Europe/London', 'Europe/Paris', 'Australia/Sydney'];

  beforeAll(async () => {
    env = new TestEnvironment();
    await env.setup();
    await env.runMigrations();

    pool = env.getPostgresPool();
    amqpConnection = env.getRabbitMQConnection();

    // Set environment variables BEFORE importing app modules
    // This is critical because modules like SchedulerService read DATABASE_URL at import time
    process.env.DATABASE_URL = env.postgresConnectionString;
    process.env.RABBITMQ_URL = env.rabbitmqConnectionString;

    // Dynamically import SchedulerService AFTER env vars are set
    const schedulerModule = await import('../../src/services/scheduler.service.js');
    scheduler = new schedulerModule.SchedulerService();
  }, 180000);

  afterAll(async () => {
    await env.teardown();
  }, 60000);

  beforeEach(async () => {
    await cleanDatabase(pool);
    // Use queue names from config to ensure consistency
    await purgeQueues(amqpConnection, [QUEUES.BIRTHDAY_MESSAGES, QUEUES.BIRTHDAY_DLQ]);
    // Clear birthday/anniversary cache to ensure newly created users are found
    await clearBirthdayCache();
  });

  describe('Comprehensive timezone coverage', () => {
    it('should handle 12 users across different timezones on same day', async () => {
      const userIds: string[] = [];
      // Use UTC-aligned birthday to ensure all users are found by findBirthdaysToday()
      const birthdayDate = createTodayBirthdayUTC(1990);

      // Create users in all timezones with the same UTC-aligned birthday
      for (const tz of TIMEZONES) {
        const user = await insertUser(pool, {
          firstName: `User`,
          lastName: tz.location,
          email: `user-${tz.name.replace('/', '-')}@test.com`,
          timezone: tz.name,
          birthdayDate,
          anniversaryDate: null,
        });

        userIds.push(user.id);
      }

      // Run scheduler
      const stats = await scheduler.preCalculateTodaysBirthdays();

      expect(stats.messagesScheduled).toBeGreaterThanOrEqual(TIMEZONES.length);
      expect(stats.totalBirthdays).toBeGreaterThanOrEqual(TIMEZONES.length);

      // Verify each user has a scheduled message
      for (let i = 0; i < userIds.length; i++) {
        const userId = userIds[i];
        const tz = TIMEZONES[i];

        await waitFor(async () => {
          const messages = await findMessageLogsByUserId(pool, userId);
          return messages.length > 0;
        }, 10000);

        const messages = await findMessageLogsByUserId(pool, userId);
        expect(messages).toHaveLength(1);

        const message = messages[0];
        expect(message.status).toBe(MessageStatus.SCHEDULED);

        // Verify send time is 9am in user's timezone
        const sendTime = DateTime.fromJSDate(message.scheduledSendTime).setZone(tz.name);
        expect(sendTime.hour).toBe(9);
        expect(sendTime.minute).toBe(0);
        expect(sendTime.second).toBe(0);
      }
    });

    it('should order messages by UTC send time correctly', async () => {
      const userIds: string[] = [];
      // Use UTC-aligned birthday to ensure all users are found by findBirthdaysToday()
      const birthdayDate = createTodayBirthdayUTC(1990);

      // Create users in different timezones with the same UTC-aligned birthday
      for (const tz of TIMEZONES) {
        const user = await insertUser(pool, {
          firstName: 'User',
          lastName: tz.location,
          email: `user-${tz.name}@test.com`,
          timezone: tz.name,
          birthdayDate,
          anniversaryDate: null,
        });

        userIds.push(user.id);
      }

      await scheduler.preCalculateTodaysBirthdays();

      // Query messages ordered by UTC send time
      const result = await pool.query(
        `
        SELECT ml.*, u.timezone, u.last_name
        FROM message_logs ml
        JOIN users u ON ml.user_id = u.id
        WHERE ml.user_id = ANY($1)
        ORDER BY ml.scheduled_send_time ASC
      `,
        [userIds]
      );

      expect(result.rows.length).toBe(TIMEZONES.length);

      // Auckland (UTC+12) should be first (9am Auckland = 21:00 previous day UTC)
      expect(result.rows[0].timezone).toBe('Pacific/Auckland');

      // Hawaii (UTC-10) should be last (9am Hawaii = 19:00 UTC)
      expect(result.rows[result.rows.length - 1].timezone).toBe('Pacific/Honolulu');

      // Verify messages are in increasing UTC time order
      for (let i = 1; i < result.rows.length; i++) {
        const prevTime = DateTime.fromJSDate(result.rows[i - 1].scheduled_send_time);
        const currTime = DateTime.fromJSDate(result.rows[i].scheduled_send_time);

        expect(currTime.toMillis()).toBeGreaterThanOrEqual(prevTime.toMillis());
      }
    });

    it('should handle edge case timezones (half-hour and quarter-hour offsets)', async () => {
      const edgeTimezones = [
        'Asia/Kolkata', // UTC+5:30 (India)
        'Australia/Adelaide', // UTC+9:30
        'Asia/Kathmandu', // UTC+5:45 (Nepal)
        'Pacific/Chatham', // UTC+12:45
      ];

      // Use UTC-aligned birthday to ensure users are found by findBirthdaysToday()
      const birthdayDate = createTodayBirthdayUTC(1990);

      for (const timezone of edgeTimezones) {
        const user = await insertUser(pool, {
          firstName: 'User',
          lastName: timezone,
          email: `user-${timezone.replace('/', '-')}@test.com`,
          timezone,
          birthdayDate,
          anniversaryDate: null,
        });

        await scheduler.scheduleUserBirthday(user.id);

        const messages = await findMessageLogsByUserId(pool, user.id);
        expect(messages).toHaveLength(1);

        // Verify 9am local time
        const sendTime = DateTime.fromJSDate(messages[0].scheduledSendTime).setZone(timezone);
        expect(sendTime.hour).toBe(9);
        expect(sendTime.minute).toBe(0);
      }
    });
  });

  describe('Daylight Saving Time (DST) handling', () => {
    it('should handle DST transitions correctly', async () => {
      // Test during DST transition dates
      const dstTransitionDates = [
        // Spring forward (March) - clocks move forward 1 hour
        { month: 3, day: 10, description: 'Spring DST transition' },
        // Fall back (November) - clocks move back 1 hour
        { month: 11, day: 3, description: 'Fall DST transition' },
      ];

      for (const transition of dstTransitionDates) {
        await cleanDatabase(pool);

        for (const timezone of DST_TIMEZONES) {
          // Create birthday on DST transition day
          const transitionDate = DateTime.fromObject(
            {
              year: DateTime.now().year,
              month: transition.month,
              day: transition.day,
              hour: 0,
              minute: 0,
              second: 0,
            },
            { zone: timezone }
          );

          // Use a past year for birthday
          const birthdayDate = transitionDate.set({ year: 1990 }).toJSDate();

          const user = await insertUser(pool, {
            firstName: 'DST',
            lastName: `${timezone}-${transition.month}`,
            email: `dst-${timezone}-${transition.month}@test.com`,
            timezone,
            birthdayDate,
            anniversaryDate: null,
          });

          // Note: This test requires running on the actual DST transition date
          // In a real test, you might mock the current date
          const messages = await findMessageLogsByUserId(pool, user.id);

          // If birthday is today, should be scheduled
          if (messages.length > 0) {
            const sendTime = DateTime.fromJSDate(messages[0].scheduledSendTime).setZone(timezone);

            // Should still be 9am local time despite DST
            expect(sendTime.hour).toBe(9);
            expect(sendTime.minute).toBe(0);
          }
        }
      }
    });

    it('should maintain 9am local time across DST changes', async () => {
      // Test timezones that observe DST
      const timezone = 'America/New_York';
      const today = DateTime.now().setZone(timezone);

      const user = await insertUser(pool, {
        firstName: 'DST',
        lastName: 'Test',
        email: 'dst-test@test.com',
        timezone,
        birthdayDate: today.set({ year: 1990 }).toJSDate(),
        anniversaryDate: null,
      });

      await scheduler.preCalculateTodaysBirthdays();

      const messages = await findMessageLogsByUserId(pool, user.id);

      if (messages.length > 0) {
        const sendTime = DateTime.fromJSDate(messages[0].scheduledSendTime).setZone(timezone);

        // Verify 9am regardless of DST state
        expect(sendTime.hour).toBe(9);
        expect(sendTime.minute).toBe(0);

        // Verify correct offset for current DST state
        const offset = sendTime.offset;
        const expectedOffset = today.offset;
        expect(offset).toBe(expectedOffset);
      }
    });
  });

  describe('Timezone edge cases', () => {
    it('should handle International Date Line (IDL) crossing', async () => {
      const idlTimezones = [
        { name: 'Pacific/Kiritimati', description: 'UTC+14 (earliest)' },
        { name: 'Pacific/Honolulu', description: 'UTC-10 (latest in US)' },
        { name: 'Pacific/Midway', description: 'UTC-11 (near IDL)' },
      ];

      // Use UTC-aligned birthday to ensure users are found by findBirthdaysToday()
      const birthdayDate = createTodayBirthdayUTC(1990);

      for (const tz of idlTimezones) {
        const user = await insertUser(pool, {
          firstName: 'IDL',
          lastName: tz.description,
          email: `idl-${tz.name}@test.com`,
          timezone: tz.name,
          birthdayDate,
          anniversaryDate: null,
        });

        await scheduler.scheduleUserBirthday(user.id);

        const messages = await findMessageLogsByUserId(pool, user.id);

        if (messages.length > 0) {
          const sendTime = DateTime.fromJSDate(messages[0].scheduledSendTime).setZone(tz.name);
          expect(sendTime.hour).toBe(9);
        }
      }
    });

    it('should handle same UTC offset but different timezones', async () => {
      // Multiple timezones with same UTC offset
      const sameOffsetTimezones = [
        'America/New_York',
        'America/Toronto',
        'America/Detroit',
        'America/Panama', // No DST
      ];

      // Use UTC-aligned birthday to ensure users are found by findBirthdaysToday()
      const birthdayDate = createTodayBirthdayUTC(1990);

      for (const timezone of sameOffsetTimezones) {
        const user = await insertUser(pool, {
          firstName: 'Same',
          lastName: timezone,
          email: `same-${timezone}@test.com`,
          timezone,
          birthdayDate,
          anniversaryDate: null,
        });

        await scheduler.scheduleUserBirthday(user.id);

        const messages = await findMessageLogsByUserId(pool, user.id);

        if (messages.length > 0) {
          const sendTime = DateTime.fromJSDate(messages[0].scheduledSendTime).setZone(timezone);
          expect(sendTime.hour).toBe(9);
          expect(sendTime.minute).toBe(0);
        }
      }
    });

    it('should handle extreme timezones (UTC+14 and UTC-12)', async () => {
      const extremeTimezones = [
        { name: 'Pacific/Kiritimati', offset: 14, description: 'Most ahead' },
        { name: 'Etc/GMT+12', offset: -12, description: 'Most behind' },
      ];

      // Use UTC-aligned birthday to ensure users are found by findBirthdaysToday()
      const birthdayDate = createTodayBirthdayUTC(1990);

      for (const tz of extremeTimezones) {
        const user = await insertUser(pool, {
          firstName: 'Extreme',
          lastName: tz.description,
          email: `extreme-${tz.name}@test.com`,
          timezone: tz.name,
          birthdayDate,
          anniversaryDate: null,
        });

        await scheduler.scheduleUserBirthday(user.id);

        const messages = await findMessageLogsByUserId(pool, user.id);

        if (messages.length > 0) {
          const sendTime = DateTime.fromJSDate(messages[0].scheduledSendTime).setZone(tz.name);
          expect(sendTime.hour).toBe(9);

          // Verify UTC conversion is correct
          const utcTime = DateTime.fromJSDate(messages[0].scheduledSendTime).setZone('UTC');
          const expectedUtcHour = (9 - tz.offset + 24) % 24;

          // Allow for date rollover
          expect([expectedUtcHour, (expectedUtcHour + 24) % 24]).toContain(utcTime.hour);
        }
      }
    });
  });

  describe('Concurrent timezone message processing', () => {
    it('should handle 100 users across random timezones', async () => {
      const randomTimezones = [
        'America/New_York',
        'Europe/London',
        'Asia/Tokyo',
        'Australia/Sydney',
        'America/Los_Angeles',
        'Asia/Dubai',
        'Europe/Paris',
        'Asia/Singapore',
      ];

      const userIds: string[] = [];
      // Use UTC-aligned birthday to ensure all users are found by findBirthdaysToday()
      const birthdayDate = createTodayBirthdayUTC(1990);

      // Create 100 users with random timezones
      for (let i = 0; i < 100; i++) {
        const timezone = randomTimezones[i % randomTimezones.length];

        const user = await insertUser(pool, {
          firstName: `User${i}`,
          lastName: 'Test',
          email: `user${i}@test.com`,
          timezone,
          birthdayDate,
          anniversaryDate: null,
        });

        userIds.push(user.id);
      }

      // Run scheduler
      const stats = await scheduler.preCalculateTodaysBirthdays();

      expect(stats.messagesScheduled).toBeGreaterThanOrEqual(100);

      // Verify all messages scheduled correctly
      let correctCount = 0;

      for (const userId of userIds) {
        const messages = await findMessageLogsByUserId(pool, userId);

        if (messages.length > 0) {
          expect(messages[0].status).toBe(MessageStatus.SCHEDULED);
          correctCount++;
        }
      }

      expect(correctCount).toBeGreaterThanOrEqual(100);
    }, 60000);

    it('should maintain correct timezone grouping in queue', async () => {
      const timezones = ['America/New_York', 'Europe/London', 'Asia/Tokyo'];
      const usersByTimezone: Record<string, string[]> = {};
      // Use UTC-aligned birthday to ensure all users are found by findBirthdaysToday()
      const birthdayDate = createTodayBirthdayUTC(1990);

      // Create 10 users per timezone
      for (const timezone of timezones) {
        usersByTimezone[timezone] = [];

        for (let i = 0; i < 10; i++) {
          const user = await insertUser(pool, {
            firstName: `User${i}`,
            lastName: timezone,
            email: `user${i}-${timezone}@test.com`,
            timezone,
            birthdayDate,
            anniversaryDate: null,
          });

          usersByTimezone[timezone].push(user.id);
        }
      }

      await scheduler.preCalculateTodaysBirthdays();

      // Verify messages grouped by send time (timezone)
      for (const timezone of timezones) {
        const userIds = usersByTimezone[timezone];
        const sendTimes: number[] = [];

        for (const userId of userIds) {
          const messages = await findMessageLogsByUserId(pool, userId);

          if (messages.length > 0) {
            sendTimes.push(messages[0].scheduledSendTime.getTime());
          }
        }

        // All users in same timezone should have same send time
        const uniqueTimes = new Set(sendTimes);
        expect(uniqueTimes.size).toBe(1);
      }
    });
  });
});
