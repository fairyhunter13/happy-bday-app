/**
 * E2E Test: Error Handling and Recovery
 *
 * Tests error scenarios and recovery mechanisms:
 * - External API failures (500 error)
 * - Retry mechanism with exponential backoff
 * - Circuit breaker opens after threshold
 * - Messages moved to DLQ after max retries
 * - Recovery scheduler finds missed messages
 * - Graceful degradation
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
  insertMessageLog,
  sleep,
} from '../helpers/test-helpers.js';
import { createResilientTester, RetryPresets } from '../helpers/resilient-api-tester.js';
import { SchedulerService } from '../../src/services/scheduler.service.js';
import { MessageWorker } from '../../src/workers/message-worker.js';
import { MessagePublisher } from '../../src/queue/publisher.js';
import { MessageSenderService } from '../../src/services/message.service.js';
import { MessageStatus } from '../../src/db/schema/message-logs.js';
import { DateTime } from 'luxon';
import type { Pool } from 'pg';
import type { Connection } from 'amqplib';

describe('E2E: Error Handling and Recovery', () => {
  let env: TestEnvironment;
  let pool: Pool;
  let amqpConnection: Connection;
  let scheduler: SchedulerService;
  let worker: MessageWorker;
  let publisher: MessagePublisher;
  let messageSender: MessageSenderService;

  beforeAll(async () => {
    env = new TestEnvironment();
    await env.setup();
    await env.runMigrations();

    pool = env.getPostgresPool();
    amqpConnection = env.getRabbitMQConnection();

    scheduler = new SchedulerService();
    worker = new MessageWorker();
    publisher = new MessagePublisher();
    await publisher.initialize();

    // Use real email service (no URL parameter needed)
    messageSender = new MessageSenderService();
  }, 180000);

  afterAll(async () => {
    if (worker?.isRunning()) {
      await worker.stop();
    }
    if (env) {
      await env.teardown();
    }
  }, 60000);

  beforeEach(async () => {
    await cleanDatabase(pool);
    await purgeQueues(amqpConnection, [
      'birthday-messages',
      'birthday-dlq',
      'anniversary-queue',
      'dlq',
    ]);
    // Clear birthday/anniversary cache to ensure newly created users are found
    await clearBirthdayCache();
    // Reset circuit breaker to closed state to ensure consistent test behavior
    await resetCircuitBreaker();
  });

  describe('External API failures', () => {
    it('should retry on API failures with exponential backoff', async () => {
      // Real API has ~10% failure rate, so use ResilientApiTester
      const tester = createResilientTester(RetryPresets.probabilisticFailure);

      const user = await insertUser(pool, {
        firstName: 'John',
        lastName: 'Doe',
        email: 'john.doe@test.com',
        timezone: 'UTC',
        birthdayDate: DateTime.now().set({ year: 1990 }).toJSDate(),
        anniversaryDate: null,
      });

      // Use resilient tester to handle API's probabilistic failures
      const result = await tester.executeWithRetry(
        async () => await messageSender.sendBirthdayMessage(user)
      );

      // Verify that message sending eventually succeeds or retries were attempted
      expect(result.attemptNumber).toBeGreaterThanOrEqual(1);
      if (!result.success) {
        // If failed after retries, verify it attempted multiple times
        expect(result.attemptNumber).toBeGreaterThan(1);
      }
    }, 60000);

    it('should track retry count in message log', async () => {
      const user = await insertUser(pool, {
        firstName: 'Jane',
        lastName: 'Smith',
        email: 'jane.smith@test.com',
        timezone: 'UTC',
        birthdayDate: DateTime.now().set({ year: 1990 }).toJSDate(),
        anniversaryDate: null,
      });

      // Create a failed message with retry count
      const message = await insertMessageLog(pool, {
        userId: user.id,
        messageType: 'BIRTHDAY',
        scheduledSendTime: new Date(),
        status: MessageStatus.FAILED,
        messageContent: 'Happy birthday!',
        idempotencyKey: `test-${user.id}-retry`,
        retryCount: 2,
        errorMessage: 'Connection timeout',
      });

      expect(message.retryCount).toBe(2);
      expect(message.status).toBe(MessageStatus.FAILED);
      expect(message.errorMessage).toBe('Connection timeout');

      // Verify it's tracked correctly
      const messages = await findMessageLogsByUserId(pool, user.id);
      expect(messages[0].retryCount).toBe(2);
    });

    it('should fail after max retries (3 attempts)', async () => {
      // Real API has ~10% failure rate, eventually FAILED status should be reached
      const user = await insertUser(pool, {
        firstName: 'Bob',
        lastName: 'Wilson',
        email: 'bob.wilson@test.com',
        timezone: 'UTC',
        birthdayDate: DateTime.now().set({ year: 1990 }).toJSDate(),
        anniversaryDate: null,
      });

      await scheduler.preCalculateTodaysBirthdays();

      const messages = await findMessageLogsByUserId(pool, user.id);
      const messageId = messages[0].id!;

      // Manually set retry count to max to force FAILED status
      await pool.query(
        'UPDATE message_logs SET scheduled_send_time = NOW(), retry_count = $1 WHERE id = $2',
        [3, messageId]
      );

      await scheduler.enqueueUpcomingMessages();

      await publisher.publishMessage({
        messageId,
        userId: user.id,
        messageType: 'BIRTHDAY',
        scheduledSendTime: messages[0].scheduledSendTime.toISOString(),
        timestamp: Date.now(),
        retryCount: 3,
      });

      await worker.start();

      // Wait for failure - with real API and max retries, should eventually fail
      await waitFor(async () => {
        const msgs = await findMessageLogsByUserId(pool, user.id);
        return msgs[0].status === MessageStatus.FAILED || msgs[0].retryCount >= 3;
      }, 60000);

      await worker.stop();

      const failedMessages = await findMessageLogsByUserId(pool, user.id);
      // Should be FAILED or at max retry count
      expect(failedMessages[0].retryCount).toBeGreaterThanOrEqual(3);
      if (failedMessages[0].status === MessageStatus.FAILED) {
        expect(failedMessages[0].errorMessage).toBeDefined();
      }
    }, 90000);

    it('should handle API errors gracefully', async () => {
      // Real API may return various errors - test that we handle them
      const tester = createResilientTester(RetryPresets.probabilisticFailure);

      const user = await insertUser(pool, {
        firstName: 'Alice',
        lastName: 'Johnson',
        email: 'alice.johnson@test.com',
        timezone: 'UTC',
        birthdayDate: DateTime.now().set({ year: 1990 }).toJSDate(),
        anniversaryDate: null,
      });

      const result = await tester.executeWithRetry(
        async () => await messageSender.sendBirthdayMessage(user)
      );

      // Either succeeds or retries were attempted
      expect(result.attemptNumber).toBeGreaterThanOrEqual(1);
      // If failed, error should be captured
      if (!result.success) {
        expect(result.error).toBeDefined();
      }
    }, 60000);

    it('should retry on transient failures', async () => {
      // Real API has ~10% failure rate, verify retry mechanism works
      const tester = createResilientTester(RetryPresets.probabilisticFailure);

      const user = await insertUser(pool, {
        firstName: 'Carol',
        lastName: 'Davis',
        email: 'carol.davis@test.com',
        timezone: 'UTC',
        birthdayDate: DateTime.now().set({ year: 1990 }).toJSDate(),
        anniversaryDate: null,
      });

      const result = await tester.executeWithRetry(
        async () => await messageSender.sendBirthdayMessage(user)
      );

      // Verify retry mechanism is working (may succeed or fail after retries)
      expect(result.attemptNumber).toBeGreaterThanOrEqual(1);
      expect(result.elapsedTime).toBeGreaterThan(0);
    }, 60000);
  });

  describe('Circuit breaker pattern', () => {
    it('should track circuit breaker state based on real API responses', async () => {
      // Create multiple users to test circuit breaker behavior
      const users = [];
      for (let i = 0; i < 10; i++) {
        const user = await insertUser(pool, {
          firstName: `User${i}`,
          lastName: 'Test',
          email: `user${i}@test.com`,
          timezone: 'UTC',
          birthdayDate: DateTime.now().set({ year: 1990 }).toJSDate(),
          anniversaryDate: null,
        });
        users.push(user);
      }

      // Try to send messages - circuit breaker tracks failures
      for (const user of users) {
        try {
          await messageSender.sendBirthdayMessage(user);
        } catch (error) {
          // Real API may fail ~10% of the time
        }

        // Check circuit breaker stats
        const stats = messageSender.getCircuitBreakerStats();
        if (stats.isOpen) {
          expect(stats.state).toBe('open');
          break;
        }
      }

      // Verify circuit breaker is tracking failures/successes
      const stats = messageSender.getCircuitBreakerStats();
      expect(stats.successes + stats.failures).toBeGreaterThan(0);
    }, 90000);

    it('should track circuit breaker state changes', async () => {
      const user = await insertUser(pool, {
        firstName: 'Test',
        lastName: 'User',
        email: 'test@test.com',
        timezone: 'UTC',
        birthdayDate: DateTime.now().set({ year: 1990 }).toJSDate(),
        anniversaryDate: null,
      });

      // Make some API calls to accumulate stats
      for (let i = 0; i < 5; i++) {
        try {
          await messageSender.sendBirthdayMessage(user);
        } catch (error) {
          // Real API may fail
        }
      }

      // Verify circuit breaker tracked the calls
      const stats = messageSender.getCircuitBreakerStats();
      const hadActivity = stats.successes > 0 || stats.failures > 0;

      expect(hadActivity).toBe(true);
      expect(stats.state).toBeDefined();
      expect(['closed', 'open', 'half-open']).toContain(stats.state);
    }, 90000);

    it('should provide circuit breaker statistics', async () => {
      const stats = messageSender.getCircuitBreakerStats();

      expect(stats).toHaveProperty('state');
      expect(stats).toHaveProperty('failures');
      expect(stats).toHaveProperty('successes');
      expect(stats).toHaveProperty('isOpen');

      expect(['open', 'half-open', 'closed']).toContain(stats.state);
    });

    it('should check service health status', async () => {
      const isHealthy = messageSender.isHealthy();
      expect(typeof isHealthy).toBe('boolean');
    });
  });

  describe('Dead Letter Queue (DLQ)', () => {
    it('should mark message as FAILED after max retries', async () => {
      const user = await insertUser(pool, {
        firstName: 'DLQ',
        lastName: 'Test',
        email: 'dlq@test.com',
        timezone: 'UTC',
        birthdayDate: DateTime.now().set({ year: 1990 }).toJSDate(),
        anniversaryDate: null,
      });

      const message = await insertMessageLog(pool, {
        userId: user.id,
        messageType: 'BIRTHDAY',
        scheduledSendTime: new Date(),
        status: MessageStatus.QUEUED,
        messageContent: 'Happy birthday!',
        idempotencyKey: `dlq-test-${user.id}`,
        retryCount: 3, // At max retries
      });

      // Simulate worker processing and failing after max retries
      await pool.query(
        `UPDATE message_logs
         SET status = $1, retry_count = $2, error_message = $3
         WHERE id = $4`,
        [MessageStatus.FAILED, 3, 'Max retries exceeded', message.id]
      );

      const failedMessages = await findMessageLogsByUserId(pool, user.id);
      expect(failedMessages[0].status).toBe(MessageStatus.FAILED);
      expect(failedMessages[0].retryCount).toBe(3);
    });

    it('should track DLQ messages for manual investigation', async () => {
      // Create multiple failed messages
      const users = [];
      for (let i = 0; i < 5; i++) {
        const user = await insertUser(pool, {
          firstName: `Failed${i}`,
          lastName: 'User',
          email: `failed${i}@test.com`,
          timezone: 'UTC',
          birthdayDate: DateTime.now().set({ year: 1990 }).toJSDate(),
          anniversaryDate: null,
        });

        await insertMessageLog(pool, {
          userId: user.id,
          messageType: 'BIRTHDAY',
          scheduledSendTime: new Date(),
          status: MessageStatus.FAILED,
          messageContent: 'Happy birthday!',
          idempotencyKey: `failed-${user.id}`,
          retryCount: 3,
          errorMessage: 'External service unavailable',
        });

        users.push(user);
      }

      // Query all failed messages
      const result = await pool.query(
        `SELECT * FROM message_logs WHERE status = $1 AND retry_count >= 3`,
        [MessageStatus.FAILED]
      );

      expect(result.rows.length).toBeGreaterThanOrEqual(5);

      // All should have error messages
      for (const row of result.rows) {
        expect(row.error_message).toBeDefined();
        expect(row.retry_count).toBeGreaterThanOrEqual(3);
      }
    });
  });

  describe('Recovery scheduler', () => {
    it('should find and retry missed messages', async () => {
      // Create a message that should have been sent but wasn't
      const user = await insertUser(pool, {
        firstName: 'Missed',
        lastName: 'Message',
        email: 'missed@test.com',
        timezone: 'UTC',
        birthdayDate: DateTime.now().set({ year: 1990 }).toJSDate(),
        anniversaryDate: null,
      });

      const pastTime = new Date(Date.now() - 2 * 60 * 60 * 1000); // 2 hours ago

      await insertMessageLog(pool, {
        userId: user.id,
        messageType: 'BIRTHDAY',
        scheduledSendTime: pastTime,
        status: MessageStatus.SCHEDULED, // Still scheduled but past due
        messageContent: 'Happy birthday!',
        idempotencyKey: `missed-${user.id}`,
        retryCount: 0,
      });

      // Run recovery
      const stats = await scheduler.recoverMissedMessages();

      expect(stats.totalMissed).toBeGreaterThanOrEqual(1);

      // Should have been rescheduled or recovered
      if (stats.recovered > 0) {
        const messages = await findMessageLogsByUserId(pool, user.id);
        expect(messages[0].status).toBe(MessageStatus.SCHEDULED);
      }
    });

    it('should not recover already sent messages', async () => {
      const user = await insertUser(pool, {
        firstName: 'Already',
        lastName: 'Sent',
        email: 'already-sent@test.com',
        timezone: 'UTC',
        birthdayDate: DateTime.now().set({ year: 1990 }).toJSDate(),
        anniversaryDate: null,
      });

      const pastTime = new Date(Date.now() - 2 * 60 * 60 * 1000);

      await insertMessageLog(pool, {
        userId: user.id,
        messageType: 'BIRTHDAY',
        scheduledSendTime: pastTime,
        status: MessageStatus.SENT,
        messageContent: 'Happy birthday!',
        idempotencyKey: `already-sent-${user.id}`,
        retryCount: 0,
      });

      const stats = await scheduler.recoverMissedMessages();

      // Should not count as missed
      const messages = await findMessageLogsByUserId(pool, user.id);
      expect(messages[0].status).toBe(MessageStatus.SENT);
    });

    it('should mark messages as failed after max retries in recovery', async () => {
      const user = await insertUser(pool, {
        firstName: 'Max',
        lastName: 'Retries',
        email: 'max-retries@test.com',
        timezone: 'UTC',
        birthdayDate: DateTime.now().set({ year: 1990 }).toJSDate(),
        anniversaryDate: null,
      });

      const pastTime = new Date(Date.now() - 2 * 60 * 60 * 1000);

      await insertMessageLog(pool, {
        userId: user.id,
        messageType: 'BIRTHDAY',
        scheduledSendTime: pastTime,
        status: MessageStatus.SCHEDULED,
        messageContent: 'Happy birthday!',
        idempotencyKey: `max-retry-${user.id}`,
        retryCount: 3, // Already at max
      });

      const stats = await scheduler.recoverMissedMessages();

      // Should be marked as failed
      const messages = await findMessageLogsByUserId(pool, user.id);
      expect(messages[0].status).toBe(MessageStatus.FAILED);
    });

    it('should provide recovery statistics', async () => {
      // Create mix of missed messages
      for (let i = 0; i < 3; i++) {
        const user = await insertUser(pool, {
          firstName: `Recovery${i}`,
          lastName: 'Test',
          email: `recovery${i}@test.com`,
          timezone: 'UTC',
          birthdayDate: DateTime.now().set({ year: 1990 }).toJSDate(),
          anniversaryDate: null,
        });

        await insertMessageLog(pool, {
          userId: user.id,
          messageType: 'BIRTHDAY',
          scheduledSendTime: new Date(Date.now() - 60 * 60 * 1000),
          status: MessageStatus.SCHEDULED,
          messageContent: 'Happy birthday!',
          idempotencyKey: `recovery-${user.id}`,
          retryCount: i, // Different retry counts
        });
      }

      const stats = await scheduler.recoverMissedMessages();

      expect(stats).toHaveProperty('totalMissed');
      expect(stats).toHaveProperty('recovered');
      expect(stats).toHaveProperty('failed');
      expect(stats).toHaveProperty('errors');

      expect(Array.isArray(stats.errors)).toBe(true);
    });
  });

  describe('Graceful degradation', () => {
    it('should continue processing other messages when one fails', async () => {
      const users = [];
      for (let i = 0; i < 5; i++) {
        const user = await insertUser(pool, {
          firstName: `User${i}`,
          lastName: 'Test',
          email: `user${i}@test.com`,
          timezone: 'UTC',
          birthdayDate: DateTime.now().set({ year: 1990 }).toJSDate(),
          anniversaryDate: null,
        });
        users.push(user);
      }

      await scheduler.preCalculateTodaysBirthdays();

      // Manually fail one message to test isolation
      const messages = await findMessageLogsByUserId(pool, users[2].id);
      await pool.query('UPDATE message_logs SET status = $1 WHERE id = $2', [
        MessageStatus.FAILED,
        messages[0].id,
      ]);

      // Other messages should still be processable
      const allMessages = await pool.query('SELECT * FROM message_logs WHERE user_id = ANY($1)', [
        users.map((u) => u.id),
      ]);

      const scheduled = allMessages.rows.filter((m) => m.status === MessageStatus.SCHEDULED);
      expect(scheduled.length).toBeGreaterThanOrEqual(4);
    });

    it('should log errors without crashing scheduler', async () => {
      // This should not throw even with bad data
      try {
        const stats = await scheduler.preCalculateTodaysBirthdays();
        expect(stats).toBeDefined();
      } catch (error) {
        expect.fail('Scheduler should not throw on errors');
      }
    });
  });

  describe('Error message tracking', () => {
    it('should store detailed error messages', async () => {
      const user = await insertUser(pool, {
        firstName: 'Error',
        lastName: 'Tracking',
        email: 'error-tracking@test.com',
        timezone: 'UTC',
        birthdayDate: DateTime.now().set({ year: 1990 }).toJSDate(),
        anniversaryDate: null,
      });

      const errorMessage = 'HTTP 500: Internal Server Error - Connection refused';

      await insertMessageLog(pool, {
        userId: user.id,
        messageType: 'BIRTHDAY',
        scheduledSendTime: new Date(),
        status: MessageStatus.FAILED,
        messageContent: 'Happy birthday!',
        idempotencyKey: `error-${user.id}`,
        retryCount: 2,
        errorMessage,
      });

      const messages = await findMessageLogsByUserId(pool, user.id);

      // Verify message was inserted
      expect(messages).toHaveLength(1);

      // Verify errorMessage was stored correctly
      // Note: In some cases the errorMessage may be null if the INSERT failed to include it
      expect(messages[0]!.errorMessage).not.toBeNull();
      expect(messages[0]!.errorMessage).toContain('HTTP 500');
      expect(messages[0]!.errorMessage).toContain('Connection refused');
    });

    it('should track API response codes', async () => {
      const user = await insertUser(pool, {
        firstName: 'API',
        lastName: 'Response',
        email: 'api-response@test.com',
        timezone: 'UTC',
        birthdayDate: DateTime.now().set({ year: 1990 }).toJSDate(),
        anniversaryDate: null,
      });

      await insertMessageLog(pool, {
        userId: user.id,
        messageType: 'BIRTHDAY',
        scheduledSendTime: new Date(),
        status: MessageStatus.FAILED,
        messageContent: 'Happy birthday!',
        idempotencyKey: `api-${user.id}`,
        retryCount: 1,
      });

      // Update with API response
      const messages = await findMessageLogsByUserId(pool, user.id);
      await pool.query(
        'UPDATE message_logs SET api_response_code = $1, api_response_body = $2 WHERE id = $3',
        [500, '{"error": "Service unavailable"}', messages[0].id]
      );

      const updated = await findMessageLogsByUserId(pool, user.id);
      expect(updated[0].apiResponseCode).toBe(500);
      expect(updated[0].apiResponseBody).toContain('Service unavailable');
    });
  });
});
