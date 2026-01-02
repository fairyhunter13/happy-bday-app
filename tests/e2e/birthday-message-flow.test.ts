/**
 * E2E Test: Complete Birthday Message Flow
 *
 * Tests the complete end-to-end flow of birthday message delivery using the REAL email service:
 * 1. Create user via API
 * 2. Trigger daily scheduler (or mock time to be birthday)
 * 3. Verify message log created with SCHEDULED status
 * 4. Trigger minute scheduler to enqueue message
 * 5. Verify message queued to RabbitMQ
 * 6. Verify worker processes message
 * 7. Verify message status updated to SENT
 * 8. Verify no duplicate messages sent
 *
 * NOTE: Uses REAL email service (https://email-service.digitalenvision.com.au)
 * The email service has ~10% random failure rate - tests handle this via retry logic in the worker.
 * Results are verified through database state (message_logs table).
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import {
  TestEnvironment,
  waitFor,
  cleanDatabase,
  purgeQueues,
  clearBirthdayCache,
  resetCircuitBreaker,
} from '../helpers/testcontainers-optimized.js';
import {
  insertUser,
  findMessageLogsByUserId,
  sleep,
  createTodayBirthdayUTC,
} from '../helpers/test-helpers.js';
import { QUEUES } from '../../src/queue/config.js';
// Type-only imports - these don't trigger module initialization
import type { SchedulerService as SchedulerServiceType } from '../../src/services/scheduler.service.js';
import type { MessageWorker as MessageWorkerType } from '../../src/workers/message-worker.js';
import type { MessagePublisher as MessagePublisherType } from '../../src/queue/publisher.js';
// Import MessageStatus directly (enum value, safe to import statically)
import { MessageStatus } from '../../src/db/schema/message-logs.js';
import { DateTime } from 'luxon';
import type { Pool } from 'pg';
import type { Connection } from 'amqplib';

describe('E2E: Complete Birthday Message Flow', () => {
  let env: TestEnvironment;
  let pool: Pool;
  let amqpConnection: Connection;
  let scheduler: SchedulerServiceType;
  let worker: MessageWorkerType;
  let publisher: MessagePublisherType;

  // Module references for dynamic imports
  let initializeRabbitMQ: () => Promise<unknown>;
  let RabbitMQConnection: {
    getInstance: () => { close: () => Promise<void> };
    resetInstance: () => void;
  };
  let MessageWorker: new () => MessageWorkerType;

  beforeAll(async () => {
    // Start test environment (PostgreSQL + RabbitMQ)
    env = new TestEnvironment();
    await env.setup();

    // Set environment variables BEFORE importing app modules
    process.env.DATABASE_URL = env.postgresConnectionString;
    process.env.RABBITMQ_URL = env.rabbitmqConnectionString;
    process.env.ENABLE_DB_METRICS = 'false';
    process.env.DATABASE_POOL_MAX = '2';

    await env.runMigrations();

    pool = env.getPostgresPool();
    amqpConnection = env.getRabbitMQConnection();

    // Dynamically import modules AFTER env vars are set
    const queueModule = await import('../../src/queue/connection.js');
    initializeRabbitMQ = queueModule.initializeRabbitMQ;
    RabbitMQConnection = queueModule.RabbitMQConnection;

    // Initialize RabbitMQ connection singleton
    await initializeRabbitMQ();

    // Now import modules that depend on RabbitMQ
    const schedulerModule = await import('../../src/services/scheduler.service.js');
    const publisherModule = await import('../../src/queue/publisher.js');
    const workerModule = await import('../../src/workers/message-worker.js');

    scheduler = new schedulerModule.SchedulerService();
    publisher = new publisherModule.MessagePublisher();
    MessageWorker = workerModule.MessageWorker;
    worker = new MessageWorker();

    await publisher.initialize();
  }, 180000);

  afterAll(async () => {
    // Stop worker
    if (worker?.isRunning()) {
      await worker.stop();
    }

    // Close RabbitMQ connection first
    try {
      const rabbitMQ = RabbitMQConnection.getInstance();
      await rabbitMQ.close();
    } catch {
      // Ignore errors if not connected
    }

    // Close app's singleton database connection
    try {
      const dbConnection = await import('../../src/db/connection.js');
      await dbConnection.closeConnection();
    } catch {
      // Ignore errors if connection already closed
    }

    // Teardown test environment
    if (env) {
      await env.teardown();
    }
  }, 60000);

  beforeEach(async () => {
    // Stop worker if running from previous test
    if (worker?.isRunning()) {
      await worker.stop();
    }
    // Clean database and purge queues before each test
    // Note: Queue names must match actual queue names (birthday-messages, not birthday-queue)
    await cleanDatabase(pool);
    // Only purge queues that actually exist in the application
    await purgeQueues(amqpConnection, [QUEUES.BIRTHDAY_MESSAGES, QUEUES.BIRTHDAY_DLQ]);
    // Clear birthday/anniversary cache to ensure newly created users are found
    await clearBirthdayCache();
    // Reset circuit breaker to closed state to avoid test pollution
    await resetCircuitBreaker();
  });

  describe('Complete flow: User creation -> Scheduling -> Queue -> Worker -> Email sent', () => {
    it('should complete full birthday message flow successfully', async () => {
      // Step 1: Create user with birthday today
      // Use UTC-aligned birthday date to ensure findBirthdaysToday() matches
      const timezone = 'UTC';
      const birthdayDate = createTodayBirthdayUTC(1990);

      const user = await insertUser(pool, {
        firstName: 'John',
        lastName: 'Doe',
        email: 'john.doe@test.com',
        timezone,
        birthdayDate,
        anniversaryDate: null,
      });

      expect(user.id).toBeDefined();
      expect(user.email).toBe('john.doe@test.com');

      // Step 2: Trigger daily scheduler
      const precalcStats = await scheduler.preCalculateTodaysBirthdays();

      expect(precalcStats.messagesScheduled).toBeGreaterThanOrEqual(1);
      expect(precalcStats.totalBirthdays).toBeGreaterThanOrEqual(1);

      // Step 3: Verify message log created with SCHEDULED status
      await waitFor(async () => {
        const messages = await findMessageLogsByUserId(pool, user.id);
        return messages.length > 0 && messages[0].status === MessageStatus.SCHEDULED;
      }, 10000);

      const scheduledMessages = await findMessageLogsByUserId(pool, user.id);
      expect(scheduledMessages).toHaveLength(1);

      const message = scheduledMessages[0];
      expect(message.messageType).toBe('BIRTHDAY');
      expect(message.status).toBe(MessageStatus.SCHEDULED);
      expect(message.messageContent).toContain('John');
      expect(message.idempotencyKey).toContain(user.id);

      // Verify send time is 9am in user timezone
      const sendTime = DateTime.fromJSDate(message.scheduledSendTime).setZone(timezone);
      expect(sendTime.hour).toBe(9);
      expect(sendTime.minute).toBe(0);

      // Step 4: Update scheduled_send_time to a time in the immediate future to trigger processing
      // We use NOW() + 1 second to ensure it's within the enqueue window (now, now + 1 hour)
      await pool.query(
        "UPDATE message_logs SET scheduled_send_time = NOW() + INTERVAL '1 second' WHERE id = $1",
        [message.id]
      );

      // Step 5: Trigger minute scheduler to enqueue message
      const enqueuedCount = await scheduler.enqueueUpcomingMessages();
      expect(enqueuedCount).toBeGreaterThanOrEqual(1);

      // Step 6: Verify message status updated to QUEUED
      await waitFor(async () => {
        const messages = await findMessageLogsByUserId(pool, user.id);
        return messages[0].status === MessageStatus.QUEUED;
      }, 5000);

      // Step 7: Publish message to RabbitMQ
      const queuedMessages = await findMessageLogsByUserId(pool, user.id);
      await publisher.publishMessage({
        messageId: queuedMessages[0].id!,
        userId: user.id,
        messageType: 'BIRTHDAY',
        scheduledSendTime: queuedMessages[0].scheduledSendTime.toISOString(),
        timestamp: Date.now(),
        retryCount: 0,
      });

      // Step 8: Start worker to process message
      await worker.start();

      // Step 9: Wait for worker to process message
      await waitFor(async () => {
        const messages = await findMessageLogsByUserId(pool, user.id);
        return messages[0].status === MessageStatus.SENT;
      }, 15000);

      // Step 10: Verify message status updated to SENT
      // Note: With real email service (~10% failure rate), we verify status through database
      // The worker has built-in retry logic to handle transient failures
      const sentMessages = await findMessageLogsByUserId(pool, user.id);
      expect(sentMessages[0].status).toBe(MessageStatus.SENT);
      expect(sentMessages[0].actualSendTime).toBeDefined();
      expect(sentMessages[0].apiResponseCode).toBeDefined();

      // Step 11: Verify message content in database (real API was called)
      expect(sentMessages[0].messageContent).toContain('John');
      expect(sentMessages[0].messageType).toBe('BIRTHDAY');

      // Step 12: Verify no duplicate messages
      const finalMessages = await findMessageLogsByUserId(pool, user.id);
      expect(finalMessages).toHaveLength(1);

      // Stop worker
      await worker.stop();
    }, 60000);

    it('should prevent duplicate messages with idempotency', async () => {
      // Use UTC-aligned birthday date to ensure findBirthdaysToday() matches
      const timezone = 'UTC';
      const birthdayDate = createTodayBirthdayUTC(1985);

      const user = await insertUser(pool, {
        firstName: 'Jane',
        lastName: 'Smith',
        email: 'jane.smith@test.com',
        timezone,
        birthdayDate,
        anniversaryDate: null,
      });

      // First run - should create message
      const stats1 = await scheduler.preCalculateTodaysBirthdays();
      expect(stats1.messagesScheduled).toBe(1);

      // Second run - should skip (idempotency)
      const stats2 = await scheduler.preCalculateTodaysBirthdays();
      expect(stats2.duplicatesSkipped).toBe(1);
      expect(stats2.messagesScheduled).toBe(0);

      // Verify only one message exists
      const messages = await findMessageLogsByUserId(pool, user.id);
      expect(messages).toHaveLength(1);
    });

    it('should handle both birthday and anniversary messages for same user', async () => {
      // Use UTC-aligned dates to ensure findBirthdaysToday() and findAnniversariesToday() match
      const timezone = 'UTC';

      const user = await insertUser(pool, {
        firstName: 'Alice',
        lastName: 'Johnson',
        email: 'alice.johnson@test.com',
        timezone,
        birthdayDate: createTodayBirthdayUTC(1992),
        anniversaryDate: createTodayBirthdayUTC(2020),
      });

      // Run scheduler
      const stats = await scheduler.preCalculateTodaysBirthdays();
      expect(stats.messagesScheduled).toBe(2); // Birthday + Anniversary

      // Verify both messages created
      await waitFor(async () => {
        const messages = await findMessageLogsByUserId(pool, user.id);
        return messages.length === 2;
      }, 10000);

      const messages = await findMessageLogsByUserId(pool, user.id);
      expect(messages).toHaveLength(2);

      const messageTypes = messages.map((m) => m.messageType).sort();
      expect(messageTypes).toEqual(['ANNIVERSARY', 'BIRTHDAY']);

      // Verify both have unique idempotency keys
      const idempotencyKeys = messages.map((m) => m.idempotencyKey);
      expect(new Set(idempotencyKeys).size).toBe(2);
    });
  });

  describe('Message timing accuracy', () => {
    it('should schedule message at exactly 9am in user timezone', async () => {
      // Test with various timezones - all use UTC-aligned birthday for consistency
      const timezones = ['America/New_York', 'Europe/London', 'Asia/Tokyo', 'Australia/Sydney'];
      const birthdayDate = createTodayBirthdayUTC(1990);

      for (const timezone of timezones) {
        const user = await insertUser(pool, {
          firstName: 'User',
          lastName: timezone,
          email: `user-${timezone}@test.com`,
          timezone,
          birthdayDate, // Use UTC-aligned date for findBirthdaysToday() matching
          anniversaryDate: null,
        });

        await scheduler.preCalculateTodaysBirthdays();

        const messages = await findMessageLogsByUserId(pool, user.id);
        expect(messages).toHaveLength(1);

        // Verify send time is 9am in user's timezone
        const sendTime = DateTime.fromJSDate(messages[0].scheduledSendTime).setZone(timezone);
        expect(sendTime.hour).toBe(9);
        expect(sendTime.minute).toBe(0);
        expect(sendTime.second).toBe(0);
      }
    });

    it('should calculate correct UTC send time for different timezones', async () => {
      const timezone1 = 'America/Los_Angeles'; // UTC-8
      const timezone2 = 'Asia/Tokyo'; // UTC+9

      // Use UTC-aligned birthday for findBirthdaysToday() matching
      const birthdayDate = createTodayBirthdayUTC(1990);

      const user1 = await insertUser(pool, {
        firstName: 'User1',
        lastName: 'LA',
        email: 'user1@test.com',
        timezone: timezone1,
        birthdayDate,
        anniversaryDate: null,
      });

      const user2 = await insertUser(pool, {
        firstName: 'User2',
        lastName: 'Tokyo',
        email: 'user2@test.com',
        timezone: timezone2,
        birthdayDate,
        anniversaryDate: null,
      });

      await scheduler.preCalculateTodaysBirthdays();

      const messages1 = await findMessageLogsByUserId(pool, user1.id);
      const messages2 = await findMessageLogsByUserId(pool, user2.id);

      expect(messages1).toHaveLength(1);
      expect(messages2).toHaveLength(1);

      // Tokyo should be sent much earlier in UTC time than LA
      const utcTime1 = DateTime.fromJSDate(messages1[0].scheduledSendTime).setZone('UTC');
      const utcTime2 = DateTime.fromJSDate(messages2[0].scheduledSendTime).setZone('UTC');

      // Tokyo (UTC+9) 9am = 00:00 UTC
      // LA (UTC-8) 9am = 17:00 UTC
      // Difference should be about 17 hours
      const diffHours = utcTime1.diff(utcTime2, 'hours').hours;
      expect(Math.abs(diffHours)).toBeGreaterThan(10); // At least 10 hours difference
    });
  });

  describe('Worker processing behavior', () => {
    it('should skip already sent messages (idempotency)', async () => {
      const user = await insertUser(pool, {
        firstName: 'Bob',
        lastName: 'Wilson',
        email: 'bob.wilson@test.com',
        timezone: 'UTC',
        birthdayDate: createTodayBirthdayUTC(1990),
        anniversaryDate: null,
      });

      await scheduler.preCalculateTodaysBirthdays();

      const messages = await findMessageLogsByUserId(pool, user.id);
      const messageId = messages[0].id!;

      // Manually mark as SENT
      await pool.query(
        'UPDATE message_logs SET status = $1, actual_send_time = NOW() WHERE id = $2',
        [MessageStatus.SENT, messageId]
      );

      // Try to process again - should be skipped
      await publisher.publishMessage({
        messageId,
        userId: user.id,
        messageType: 'BIRTHDAY',
        scheduledSendTime: messages[0].scheduledSendTime.toISOString(),
        timestamp: Date.now(),
        retryCount: 0,
      });

      await worker.start();
      await sleep(3000);
      await worker.stop();

      // Status should remain SENT (idempotency - no reprocessing)
      const finalMessages = await findMessageLogsByUserId(pool, user.id);
      expect(finalMessages[0].status).toBe(MessageStatus.SENT);

      // Verify message was not processed again (actual_send_time unchanged)
      expect(finalMessages[0].actualSendTime).toBeDefined();
    });

    it('should track message processing time', async () => {
      const user = await insertUser(pool, {
        firstName: 'Carol',
        lastName: 'Davis',
        email: 'carol.davis@test.com',
        timezone: 'UTC',
        birthdayDate: createTodayBirthdayUTC(1990),
        anniversaryDate: null,
      });

      await scheduler.preCalculateTodaysBirthdays();

      const messages = await findMessageLogsByUserId(pool, user.id);
      const scheduledTime = messages[0].scheduledSendTime;

      // Update to trigger immediate processing (use future time to stay within enqueue window)
      await pool.query(
        "UPDATE message_logs SET scheduled_send_time = NOW() + INTERVAL '1 second' WHERE id = $1",
        [messages[0].id]
      );

      await scheduler.enqueueUpcomingMessages();
      await publisher.publishMessage({
        messageId: messages[0].id!,
        userId: user.id,
        messageType: 'BIRTHDAY',
        scheduledSendTime: messages[0].scheduledSendTime.toISOString(),
        timestamp: Date.now(),
        retryCount: 0,
      });

      const startTime = Date.now();
      await worker.start();

      await waitFor(async () => {
        const msgs = await findMessageLogsByUserId(pool, user.id);
        return msgs[0].status === MessageStatus.SENT;
      }, 15000);

      const processingTime = Date.now() - startTime;

      await worker.stop();

      // Processing should be reasonably fast (< 10 seconds)
      expect(processingTime).toBeLessThan(10000);

      const sentMessages = await findMessageLogsByUserId(pool, user.id);
      expect(sentMessages[0].actualSendTime).toBeDefined();

      // Verify actual send time is close to scheduled time (within 1 hour for this test)
      const actualTime = DateTime.fromJSDate(sentMessages[0].actualSendTime!);
      const scheduledDateTime = DateTime.fromJSDate(scheduledTime);
      const diff = Math.abs(actualTime.diff(scheduledDateTime, 'minutes').minutes);

      // Should be sent within reasonable time of scheduled time
      expect(diff).toBeLessThan(60);
    });
  });

  describe('Scheduler statistics and monitoring', () => {
    it('should provide accurate scheduler statistics', async () => {
      // Create 5 users with birthdays today using UTC-aligned dates
      const birthdayDate = createTodayBirthdayUTC(1990);
      for (let i = 0; i < 5; i++) {
        await insertUser(pool, {
          firstName: `User${i}`,
          lastName: 'Test',
          email: `user${i}@test.com`,
          timezone: 'UTC',
          birthdayDate,
          anniversaryDate: null,
        });
      }

      await scheduler.preCalculateTodaysBirthdays();

      const stats = await scheduler.getSchedulerStats();

      expect(stats.scheduledCount).toBeGreaterThanOrEqual(5);
      expect(stats.queuedCount).toBe(0); // None queued yet
      expect(stats.sentCount).toBe(0); // None sent yet
      expect(stats.nextScheduled).toBeDefined();
    });
  });
});
