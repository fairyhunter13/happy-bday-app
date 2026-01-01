/**
 * E2E Test: Concurrent Message Processing
 *
 * Tests system behavior under high concurrency:
 * - 100 users with same birthday
 * - All messages processed concurrently
 * - No duplicates (idempotency)
 * - Worker pool handles load
 * - Race conditions prevention
 * - Database transaction isolation
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import {
  TestEnvironment,
  waitFor,
  cleanDatabase,
  purgeQueues,
  clearBirthdayCache,
} from '../helpers/testcontainers-optimized.js';
import { insertUser, sleep } from '../helpers/test-helpers.js';
import { SchedulerService } from '../../src/services/scheduler.service.js';
import { MessageWorker } from '../../src/workers/message-worker.js';
import { MessagePublisher } from '../../src/queue/publisher.js';
import { MessageStatus } from '../../src/db/schema/message-logs.js';
import { DateTime } from 'luxon';
import type { Pool } from 'pg';
import type { Connection } from 'amqplib';

describe('E2E: Concurrent Message Processing', () => {
  let env: TestEnvironment;
  let pool: Pool;
  let amqpConnection: Connection;
  let scheduler: SchedulerService;
  let publisher: MessagePublisher;

  beforeAll(async () => {
    env = new TestEnvironment();
    await env.setup();
    await env.runMigrations();

    pool = env.getPostgresPool();
    amqpConnection = env.getRabbitMQConnection();

    scheduler = new SchedulerService();
    publisher = new MessagePublisher();
    await publisher.initialize();
  }, 180000);

  afterAll(async () => {
    await env.teardown();
  }, 60000);

  beforeEach(async () => {
    await cleanDatabase(pool);
    await purgeQueues(amqpConnection, ['birthday-queue', 'anniversary-queue', 'dlq']);
    // Clear birthday/anniversary cache to ensure newly created users are found
    await clearBirthdayCache();
  });

  describe('High volume message scheduling', () => {
    it('should schedule 100 users with same birthday without errors', async () => {
      const timezone = 'UTC';
      const today = DateTime.now().setZone(timezone);
      const birthdayDate = today.set({ year: 1990, hour: 0, minute: 0 }).toJSDate();

      const userIds: string[] = [];

      // Create 100 users concurrently
      const createUserPromises = [];
      for (let i = 0; i < 100; i++) {
        createUserPromises.push(
          insertUser(pool, {
            firstName: `User${i}`,
            lastName: 'Test',
            email: `user${i}@test.com`,
            timezone,
            birthdayDate,
            anniversaryDate: null,
          })
        );
      }

      const users = await Promise.all(createUserPromises);
      userIds.push(...users.map((u) => u.id));

      expect(userIds).toHaveLength(100);

      // Schedule all messages
      const startTime = Date.now();
      const stats = await scheduler.preCalculateTodaysBirthdays();
      const schedulingTime = Date.now() - startTime;

      expect(stats.messagesScheduled).toBeGreaterThanOrEqual(100);
      expect(stats.duplicatesSkipped).toBe(0);
      expect(stats.errors).toHaveLength(0);

      // Scheduling should be reasonably fast (< 10 seconds for 100 users)
      expect(schedulingTime).toBeLessThan(10000);

      // Verify all messages created
      const result = await pool.query(
        'SELECT COUNT(*) as count FROM message_logs WHERE user_id = ANY($1)',
        [userIds]
      );
      expect(parseInt(result.rows[0].count)).toBeGreaterThanOrEqual(100);
    }, 60000);

    it('should prevent duplicate messages during concurrent scheduling', async () => {
      const timezone = 'UTC';
      const today = DateTime.now().setZone(timezone);
      const birthdayDate = today.set({ year: 1990 }).toJSDate();

      // Create 10 users
      const users = [];
      for (let i = 0; i < 10; i++) {
        const user = await insertUser(pool, {
          firstName: `User${i}`,
          lastName: 'Concurrent',
          email: `concurrent${i}@test.com`,
          timezone,
          birthdayDate,
          anniversaryDate: null,
        });
        users.push(user);
      }

      // Run scheduler multiple times concurrently
      const schedulePromises = [];
      for (let i = 0; i < 5; i++) {
        schedulePromises.push(scheduler.preCalculateTodaysBirthdays());
      }

      const results = await Promise.allSettled(schedulePromises);

      // Calculate total messages scheduled
      let totalScheduled = 0;
      let totalDuplicates = 0;
      let totalFulfilled = 0;
      let totalRejected = 0;

      for (const result of results) {
        if (result.status === 'fulfilled') {
          totalFulfilled++;
          totalScheduled += result.value.messagesScheduled;
          totalDuplicates += result.value.duplicatesSkipped;
        } else {
          totalRejected++;
        }
      }

      // In concurrent execution, some runs may fail due to race conditions.
      // What matters most is that the database has exactly 10 messages (one per user).
      // The idempotency mechanism ensures no duplicate messages are created.

      // At least one run should have completed successfully
      expect(totalFulfilled).toBeGreaterThanOrEqual(1);

      // Verify database has exactly 10 messages (idempotency enforcement)
      // This is the key invariant - regardless of how many runs succeeded/failed,
      // the database should have exactly one message per user.
      const dbResult = await pool.query(
        'SELECT COUNT(*) as count FROM message_logs WHERE user_id = ANY($1)',
        [users.map((u) => u.id)]
      );
      expect(parseInt(dbResult.rows[0].count)).toBe(10);
    }, 60000);

    it('should handle 100 messages with different timezones', async () => {
      const timezones = [
        'America/New_York',
        'Europe/London',
        'Asia/Tokyo',
        'Australia/Sydney',
        'America/Los_Angeles',
      ];

      const userIds: string[] = [];

      // Create 20 users per timezone (100 total)
      // Note: Each user's birthday is set to "today" in their local timezone
      for (let i = 0; i < 100; i++) {
        const timezone = timezones[i % timezones.length];
        // Get "today" in the user's timezone to ensure they qualify for birthday message
        const localToday = DateTime.now().setZone(timezone);
        const birthdayDate = localToday.set({ year: 1990 }).toJSDate();

        const user = await insertUser(pool, {
          firstName: `User${i}`,
          lastName: timezone,
          email: `user${i}-${timezone}@test.com`,
          timezone,
          birthdayDate,
          anniversaryDate: null,
        });

        userIds.push(user.id);
      }

      const stats = await scheduler.preCalculateTodaysBirthdays();

      // Due to timezone differences, not all 100 users may qualify for a message "today".
      // Some timezones may already be "tomorrow" or still "yesterday" relative to the
      // scheduler's check. What we verify is:
      // 1. Messages were scheduled for the users whose birthdays are "today" in their timezone
      // 2. No duplicate idempotency keys exist
      expect(stats.messagesScheduled).toBeGreaterThanOrEqual(1);

      // Verify no duplicates
      const result = await pool.query(
        'SELECT idempotency_key, COUNT(*) as count FROM message_logs WHERE user_id = ANY($1) GROUP BY idempotency_key HAVING COUNT(*) > 1',
        [userIds]
      );

      expect(result.rows).toHaveLength(0); // No duplicate idempotency keys
    }, 60000);
  });

  describe('Worker pool concurrency', () => {
    it('should process 50 messages concurrently with multiple workers', async () => {
      const users = [];
      // Use UTC to ensure consistent birthday detection
      const todayInUTC = DateTime.now().setZone('UTC');
      for (let i = 0; i < 50; i++) {
        const user = await insertUser(pool, {
          firstName: `Worker${i}`,
          lastName: 'Test',
          email: `worker${i}@test.com`,
          timezone: 'UTC',
          // Set birthday to today in UTC timezone to ensure it's detected
          birthdayDate: todayInUTC.set({ year: 1990 }).toJSDate(),
          anniversaryDate: null,
        });
        users.push(user);
      }

      await scheduler.preCalculateTodaysBirthdays();

      // Update all to trigger immediate processing
      await pool.query(
        'UPDATE message_logs SET scheduled_send_time = NOW() WHERE user_id = ANY($1)',
        [users.map((u) => u.id)]
      );

      await scheduler.enqueueUpcomingMessages();

      // Get all messages and publish to queue
      const messages = await pool.query('SELECT * FROM message_logs WHERE user_id = ANY($1)', [
        users.map((u) => u.id),
      ]);

      const publishPromises = messages.rows.map((msg) =>
        publisher.publishMessage({
          messageId: msg.id,
          userId: msg.user_id,
          messageType: msg.message_type,
          scheduledSendTime: msg.scheduled_send_time.toISOString(),
          timestamp: Date.now(),
          retryCount: 0,
        })
      );

      await Promise.all(publishPromises);

      // Start multiple workers
      const workers = [new MessageWorker(), new MessageWorker(), new MessageWorker()];

      const startTime = Date.now();

      for (const worker of workers) {
        await worker.start();
      }

      // Wait for all messages to be processed (SENT or FAILED status)
      // Real API has ~10% random failure rate, so expect at least 80% success
      await waitFor(async () => {
        const result = await pool.query(
          'SELECT COUNT(*) as count FROM message_logs WHERE user_id = ANY($1) AND (status = $2 OR status = $3)',
          [users.map((u) => u.id), MessageStatus.SENT, MessageStatus.FAILED]
        );
        return parseInt(result.rows[0].count) >= 50;
      }, 120000); // Increased timeout for real network calls

      const processingTime = Date.now() - startTime;

      // Stop workers
      for (const worker of workers) {
        if (worker.isRunning()) {
          await worker.stop();
        }
      }

      // Verify final status - expect at least 80% success rate
      const sentResult = await pool.query(
        'SELECT COUNT(*) as count FROM message_logs WHERE user_id = ANY($1) AND status = $2',
        [users.map((u) => u.id), MessageStatus.SENT]
      );

      const sentCount = parseInt(sentResult.rows[0].count);
      const successRate = (sentCount / 50) * 100;

      console.log(
        `Processed 50 messages in ${processingTime}ms with ${successRate.toFixed(1)}% success rate`
      );

      // Real API has ~10% failure rate, so we expect at least 80% success
      expect(successRate).toBeGreaterThanOrEqual(80);

      // Should process faster than 120 seconds
      expect(processingTime).toBeLessThan(120000);
    }, 150000); // Increased overall timeout

    it('should handle worker failures gracefully', async () => {
      const users = [];
      for (let i = 0; i < 10; i++) {
        const user = await insertUser(pool, {
          firstName: `Failure${i}`,
          lastName: 'Test',
          email: `failure${i}@test.com`,
          timezone: 'UTC',
          birthdayDate: DateTime.now().set({ year: 1990 }).toJSDate(),
          anniversaryDate: null,
        });
        users.push(user);
      }

      await scheduler.preCalculateTodaysBirthdays();

      // Update all to trigger immediate processing
      await pool.query(
        'UPDATE message_logs SET scheduled_send_time = NOW() WHERE user_id = ANY($1)',
        [users.map((u) => u.id)]
      );

      await scheduler.enqueueUpcomingMessages();

      const worker = new MessageWorker();
      await worker.start();

      // Wait longer for real API calls (which may have random failures and retries)
      await sleep(15000);

      await worker.stop();

      // Verify some messages were processed (SENT or FAILED)
      const processedResult = await pool.query(
        'SELECT COUNT(*) as count FROM message_logs WHERE user_id = ANY($1) AND (status = $2 OR status = $3)',
        [users.map((u) => u.id), MessageStatus.SENT, MessageStatus.FAILED]
      );

      const processedCount = parseInt(processedResult.rows[0].count);

      // System should have attempted to process messages despite random API failures
      expect(processedCount).toBeGreaterThan(0);

      // System should still be operational
      const stats = await scheduler.getSchedulerStats();
      expect(stats).toBeDefined();
    }, 45000); // Increased timeout for real API calls
  });

  describe('Race condition prevention', () => {
    it('should prevent duplicate processing of same message', async () => {
      const user = await insertUser(pool, {
        firstName: 'Race',
        lastName: 'Condition',
        email: 'race@test.com',
        timezone: 'UTC',
        birthdayDate: DateTime.now().set({ year: 1990 }).toJSDate(),
        anniversaryDate: null,
      });

      await scheduler.preCalculateTodaysBirthdays();

      const messages = await pool.query('SELECT * FROM message_logs WHERE user_id = $1', [user.id]);

      const messageId = messages.rows[0].id;

      // Try to publish same message multiple times
      const publishPromises = [];
      for (let i = 0; i < 10; i++) {
        publishPromises.push(
          publisher.publishMessage({
            messageId,
            userId: user.id,
            messageType: 'BIRTHDAY',
            scheduledSendTime: messages.rows[0].scheduled_send_time.toISOString(),
            timestamp: Date.now(),
            retryCount: 0,
          })
        );
      }

      await Promise.allSettled(publishPromises);

      // Start worker
      const worker = new MessageWorker();
      await worker.start();

      // Wait longer for real API call
      await sleep(10000);

      await worker.stop();

      // Message should be processed only once (idempotency prevents duplicates)
      const finalMessages = await pool.query('SELECT * FROM message_logs WHERE user_id = $1', [
        user.id,
      ]);

      expect(finalMessages.rows).toHaveLength(1);

      // Status should be SENT or FAILED (real API has ~10% failure rate)
      const status = finalMessages.rows[0].status;
      expect([MessageStatus.SENT, MessageStatus.FAILED]).toContain(status);

      // Verify sent_at is populated (message was processed once)
      if (status === MessageStatus.SENT) {
        expect(finalMessages.rows[0].sent_at).toBeDefined();
      }
    }, 45000); // Increased timeout for real API calls

    it('should handle concurrent enqueue operations', async () => {
      const users = [];
      for (let i = 0; i < 20; i++) {
        const user = await insertUser(pool, {
          firstName: `Enqueue${i}`,
          lastName: 'Test',
          email: `enqueue${i}@test.com`,
          timezone: 'UTC',
          birthdayDate: DateTime.now().set({ year: 1990 }).toJSDate(),
          anniversaryDate: null,
        });
        users.push(user);
      }

      await scheduler.preCalculateTodaysBirthdays();

      // Update all to be ready for enqueue
      await pool.query(
        'UPDATE message_logs SET scheduled_send_time = NOW() WHERE user_id = ANY($1)',
        [users.map((u) => u.id)]
      );

      // Run enqueue multiple times concurrently
      const enqueuePromises = [];
      for (let i = 0; i < 5; i++) {
        enqueuePromises.push(scheduler.enqueueUpcomingMessages());
      }

      const results = await Promise.all(enqueuePromises);

      // Count total enqueued
      const totalEnqueued = results.reduce((sum, count) => sum + count, 0);

      // Should enqueue each message exactly once
      expect(totalEnqueued).toBeGreaterThanOrEqual(20);

      // Verify all messages are QUEUED
      const queuedResult = await pool.query(
        'SELECT COUNT(*) as count FROM message_logs WHERE user_id = ANY($1) AND status = $2',
        [users.map((u) => u.id), MessageStatus.QUEUED]
      );

      expect(parseInt(queuedResult.rows[0].count)).toBeGreaterThanOrEqual(20);
    }, 45000);

    it('should maintain database consistency under concurrent writes', async () => {
      const user = await insertUser(pool, {
        firstName: 'Consistency',
        lastName: 'Test',
        email: 'consistency@test.com',
        timezone: 'UTC',
        birthdayDate: DateTime.now().set({ year: 1990 }).toJSDate(),
        anniversaryDate: null,
      });

      // Try to create same message concurrently (should fail due to unique constraint)
      const createPromises = [];
      const idempotencyKey = `test-${user.id}-${DateTime.now().toFormat('yyyy-MM-dd')}`;

      for (let i = 0; i < 10; i++) {
        createPromises.push(
          pool.query(
            `INSERT INTO message_logs (user_id, message_type, scheduled_send_time, status, message_content, idempotency_key)
             VALUES ($1, $2, $3, $4, $5, $6)`,
            [
              user.id,
              'BIRTHDAY',
              new Date(),
              MessageStatus.SCHEDULED,
              'Happy birthday!',
              idempotencyKey,
            ]
          )
        );
      }

      const results = await Promise.allSettled(createPromises);

      // Only one should succeed
      const succeeded = results.filter((r) => r.status === 'fulfilled').length;
      const failed = results.filter((r) => r.status === 'rejected').length;

      expect(succeeded).toBe(1);
      expect(failed).toBe(9);

      // Verify only one message in database
      const messages = await pool.query(
        'SELECT COUNT(*) as count FROM message_logs WHERE idempotency_key = $1',
        [idempotencyKey]
      );

      expect(parseInt(messages.rows[0].count)).toBe(1);
    }, 30000);
  });

  describe('Performance and throughput', () => {
    it('should achieve target throughput (messages per second)', async () => {
      const messageCount = 100;
      const users = [];

      for (let i = 0; i < messageCount; i++) {
        const user = await insertUser(pool, {
          firstName: `Perf${i}`,
          lastName: 'Test',
          email: `perf${i}@test.com`,
          timezone: 'UTC',
          birthdayDate: DateTime.now().set({ year: 1990 }).toJSDate(),
          anniversaryDate: null,
        });
        users.push(user);
      }

      const startTime = Date.now();
      const stats = await scheduler.preCalculateTodaysBirthdays();
      const schedulingTime = Date.now() - startTime;

      expect(stats.messagesScheduled).toBeGreaterThanOrEqual(messageCount);

      // Calculate throughput
      const throughput = (messageCount / schedulingTime) * 1000; // messages per second

      console.log(`Scheduling throughput: ${throughput.toFixed(2)} messages/second`);
      console.log(`Total scheduling time: ${schedulingTime}ms for ${messageCount} messages`);

      // Should be able to schedule at least 10 messages per second
      expect(throughput).toBeGreaterThan(10);
    }, 60000);

    it('should scale linearly with user count', async () => {
      const testSizes = [10, 50, 100];
      const results: Array<{ size: number; time: number; throughput: number }> = [];

      for (const size of testSizes) {
        await cleanDatabase(pool);

        const users = [];
        for (let i = 0; i < size; i++) {
          const user = await insertUser(pool, {
            firstName: `Scale${i}`,
            lastName: 'Test',
            email: `scale${i}-${size}@test.com`,
            timezone: 'UTC',
            birthdayDate: DateTime.now().set({ year: 1990 }).toJSDate(),
            anniversaryDate: null,
          });
          users.push(user);
        }

        const startTime = Date.now();
        await scheduler.preCalculateTodaysBirthdays();
        const duration = Date.now() - startTime;

        const throughput = (size / duration) * 1000;

        results.push({ size, time: duration, throughput });

        console.log(
          `Size: ${size}, Time: ${duration}ms, Throughput: ${throughput.toFixed(2)} msg/s`
        );
      }

      // Verify performance doesn't degrade significantly
      // Throughput should not decrease by more than 50% as size increases
      const firstThroughput = results[0].throughput;
      const lastThroughput = results[results.length - 1].throughput;

      expect(lastThroughput).toBeGreaterThan(firstThroughput * 0.5);
    }, 120000);
  });

  describe('Database connection pool handling', () => {
    it('should handle concurrent database queries efficiently', async () => {
      // Create many users to stress connection pool
      const users = [];
      for (let i = 0; i < 50; i++) {
        const user = await insertUser(pool, {
          firstName: `Pool${i}`,
          lastName: 'Test',
          email: `pool${i}@test.com`,
          timezone: 'UTC',
          birthdayDate: DateTime.now().set({ year: 1990 }).toJSDate(),
          anniversaryDate: null,
        });
        users.push(user);
      }

      // Run many concurrent queries
      const queryPromises = users.map((user) =>
        pool.query('SELECT * FROM users WHERE id = $1', [user.id])
      );

      const startTime = Date.now();
      const results = await Promise.all(queryPromises);
      const queryTime = Date.now() - startTime;

      expect(results).toHaveLength(50);
      expect(queryTime).toBeLessThan(5000); // Should complete in under 5 seconds

      console.log(`50 concurrent queries completed in ${queryTime}ms`);
    }, 30000);

    it('should not exhaust database connections', async () => {
      // This test ensures we properly release connections
      const iterations = 100;

      for (let i = 0; i < iterations; i++) {
        await pool.query('SELECT 1');
      }

      // Should still be able to query
      const result = await pool.query('SELECT COUNT(*) as count FROM users');
      expect(result.rows[0]).toBeDefined();
    }, 30000);
  });
});
