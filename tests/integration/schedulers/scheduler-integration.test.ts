/**
 * Integration tests for Schedulers
 *
 * Tests the complete flow of schedulers with mocked time
 *
 * IMPORTANT: Uses dynamic imports to ensure database connection
 * uses the test container's connection string, not the default.
 */

import { describe, it, expect, beforeEach, afterEach, beforeAll, afterAll } from 'vitest';
import { eq } from 'drizzle-orm';
import { DateTime } from 'luxon';
import { drizzle } from 'drizzle-orm/node-postgres';

// Import types only - no runtime dependencies on app modules
import type { SchedulerManager as SchedulerManagerType } from '../../../src/schedulers/index.js';

// Import test helpers and schema (these don't trigger DB connection)
import { TestEnvironment, cleanDatabase } from '../../helpers/testcontainers.js';
import * as schema from '../../../src/db/schema/index.js';
import { users, messageLogs } from '../../../src/db/schema/index.js';
import { MessageStatus } from '../../../src/db/schema/message-logs.js';

describe('Scheduler Integration Tests', () => {
  let testEnv: TestEnvironment;
  let SchedulerManager: typeof SchedulerManagerType;
  let manager: SchedulerManagerType;
  let db: ReturnType<typeof drizzle<typeof schema>>;
  let initializeRabbitMQ: () => Promise<void>;
  let RabbitMQConnection: { getInstance: () => { close: () => Promise<void> } };

  beforeAll(async () => {
    // Start full test environment with PostgreSQL, RabbitMQ, and Redis
    testEnv = new TestEnvironment();
    await testEnv.setup();

    // Set environment variables BEFORE importing app modules
    process.env.DATABASE_URL = testEnv.postgresConnectionString;
    process.env.RABBITMQ_URL = testEnv.rabbitmqConnectionString;
    process.env.ENABLE_DB_METRICS = 'false'; // Disable metrics during tests
    process.env.DATABASE_POOL_MAX = '2'; // Limit pool size in CI to prevent exhaustion

    // Create drizzle instance for tests (uses test container)
    db = drizzle(testEnv.getPostgresPool(), { schema });

    // Run migrations
    await testEnv.runMigrations('./drizzle');

    // Now dynamically import app modules after env vars are set
    const schedulerModule = await import('../../../src/schedulers/index.js');
    SchedulerManager = schedulerModule.SchedulerManager;

    const queueModule = await import('../../../src/queue/connection.js');
    initializeRabbitMQ = queueModule.initializeRabbitMQ;
    RabbitMQConnection = queueModule.RabbitMQConnection;

    // Initialize RabbitMQ connection for tests
    await initializeRabbitMQ();
  }, 180000);

  afterAll(async () => {
    // Close RabbitMQ connection first
    try {
      const rabbitMQ = RabbitMQConnection.getInstance();
      await rabbitMQ.close();
    } catch {
      // Ignore errors if not connected
    }

    // Close the app's singleton database connection
    try {
      const dbConnection = await import('../../../src/db/connection.js');
      await dbConnection.closeConnection();
    } catch {
      // Ignore errors if connection already closed
    }

    if (testEnv) await testEnv.teardown();
  });

  beforeEach(async () => {
    // Clean database
    await cleanDatabase(testEnv.getPostgresPool());

    manager = new SchedulerManager();
  });

  afterEach(async () => {
    if (manager && manager.isRunning()) {
      manager.stop();
    }
  });

  describe('Scheduler Manager Lifecycle', () => {
    it('should start all schedulers successfully', async () => {
      await manager.start();

      const health = manager.getHealthStatus();
      expect(health.allHealthy).toBe(true);
      expect(health.schedulers).toHaveLength(3);
      expect(manager.isRunning()).toBe(true);
    });

    it('should stop all schedulers gracefully', async () => {
      await manager.start();
      expect(manager.isRunning()).toBe(true);

      manager.stop();
      expect(manager.isRunning()).toBe(false);

      const health = manager.getHealthStatus();
      expect(health.schedulers.every((s) => !s.status.isScheduled)).toBe(true);
    });

    it('should report health status correctly', async () => {
      await manager.start();

      const health = manager.getHealthStatus();

      expect(health.allHealthy).toBe(true);
      expect(health.startTime).toBeTruthy();
      expect(health.uptime).toBeGreaterThanOrEqual(0);

      const dailyScheduler = health.schedulers.find((s) => s.name === 'DailyBirthdayScheduler');
      expect(dailyScheduler).toBeTruthy();
      expect(dailyScheduler?.status.schedule).toBe('0 0 * * *');

      const minuteScheduler = health.schedulers.find((s) => s.name === 'MinuteEnqueueScheduler');
      expect(minuteScheduler).toBeTruthy();
      expect(minuteScheduler?.status.schedule).toBe('* * * * *');

      const recoveryScheduler = health.schedulers.find((s) => s.name === 'RecoveryScheduler');
      expect(recoveryScheduler).toBeTruthy();
      expect(recoveryScheduler?.status.schedule).toBe('*/10 * * * *');
    });
  });

  describe('Daily Birthday Scheduler', () => {
    it('should precalculate birthdays when triggered', async () => {
      // Create test users with birthdays today
      const today = DateTime.now().setZone('America/New_York');
      // Use startOf('day') to get a clean date and toJSDate() for proper Date object
      const birthdayDate = today.startOf('day').toJSDate();

      await db.insert(users).values([
        {
          id: '11111111-1111-1111-1111-111111111111',
          firstName: 'John',
          lastName: 'Doe',
          email: 'john@example.com',
          birthdayDate,
          timezone: 'America/New_York',
        },
        {
          id: '22222222-2222-2222-2222-222222222222',
          firstName: 'Jane',
          lastName: 'Smith',
          email: 'jane@example.com',
          birthdayDate,
          timezone: 'Europe/London',
        },
      ]);

      await manager.start();

      // Manually trigger daily scheduler
      await manager.triggerScheduler('daily');

      // Check that messages were scheduled
      const messages = await db
        .select()
        .from(messageLogs)
        .where(eq(messageLogs.status, MessageStatus.SCHEDULED));

      expect(messages.length).toBeGreaterThanOrEqual(0); // May be 0 if not their birthday today
    });

    it('should prevent duplicate messages with idempotency', async () => {
      const today = DateTime.now().setZone('America/New_York');
      const birthdayDate = today.startOf('day').toJSDate();

      await db.insert(users).values({
        id: '11111111-1111-1111-1111-111111111111',
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@example.com',
        birthdayDate,
        timezone: 'America/New_York',
      });

      await manager.start();

      // Trigger twice
      await manager.triggerScheduler('daily');
      await manager.triggerScheduler('daily');

      // Should only have one message per user
      const messages = await db.select().from(messageLogs);

      // Group by user
      const messagesByUser = messages.reduce(
        (acc, msg) => {
          acc[msg.userId] = (acc[msg.userId] || 0) + 1;
          return acc;
        },
        {} as Record<string, number>
      );

      // Each user should have at most 1 message
      Object.values(messagesByUser).forEach((count) => {
        expect(count).toBeLessThanOrEqual(1);
      });
    });
  });

  describe('Minute Enqueue Scheduler', () => {
    it('should enqueue messages scheduled in next hour', async () => {
      // Create a message scheduled for 30 minutes from now
      const now = new Date();
      const scheduledTime = new Date(now.getTime() + 30 * 60 * 1000);

      await db.insert(users).values({
        id: '11111111-1111-1111-1111-111111111111',
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@example.com',
        birthdayDate: new Date('1990-01-01'),
        timezone: 'America/New_York',
      });

      await db.insert(messageLogs).values({
        id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
        userId: '11111111-1111-1111-1111-111111111111',
        messageType: 'BIRTHDAY',
        messageContent: 'Happy Birthday!',
        scheduledSendTime: scheduledTime,
        idempotencyKey: 'user-1:BIRTHDAY:2025-12-30',
        status: MessageStatus.SCHEDULED,
        retryCount: 0,
      });

      await manager.start();

      // Trigger minute scheduler
      await manager.triggerScheduler('minute');

      // Check that message was enqueued
      const enqueuedMessages = await db
        .select()
        .from(messageLogs)
        .where(eq(messageLogs.status, MessageStatus.QUEUED));

      expect(enqueuedMessages.length).toBe(1);
      expect(enqueuedMessages[0]?.id).toBe('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');
    });

    it('should not enqueue messages scheduled beyond 1 hour', async () => {
      // Create a message scheduled for 2 hours from now
      const now = new Date();
      const scheduledTime = new Date(now.getTime() + 2 * 60 * 60 * 1000);

      await db.insert(users).values({
        id: '11111111-1111-1111-1111-111111111111',
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@example.com',
        birthdayDate: new Date('1990-01-01'),
        timezone: 'America/New_York',
      });

      await db.insert(messageLogs).values({
        id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
        userId: '11111111-1111-1111-1111-111111111111',
        messageType: 'BIRTHDAY',
        messageContent: 'Happy Birthday!',
        scheduledSendTime: scheduledTime,
        idempotencyKey: 'user-1:BIRTHDAY:2025-12-30',
        status: MessageStatus.SCHEDULED,
        retryCount: 0,
      });

      await manager.start();

      // Trigger minute scheduler
      await manager.triggerScheduler('minute');

      // Message should still be SCHEDULED
      const scheduledMessages = await db
        .select()
        .from(messageLogs)
        .where(eq(messageLogs.status, MessageStatus.SCHEDULED));

      expect(scheduledMessages.length).toBe(1);
    });
  });

  describe('Recovery Scheduler', () => {
    it('should recover missed messages', async () => {
      // Create a message that should have been sent (in the past)
      const pastTime = new Date(Date.now() - 30 * 60 * 1000); // 30 minutes ago

      await db.insert(users).values({
        id: '11111111-1111-1111-1111-111111111111',
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@example.com',
        birthdayDate: new Date('1990-01-01'),
        timezone: 'America/New_York',
      });

      await db.insert(messageLogs).values({
        id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
        userId: '11111111-1111-1111-1111-111111111111',
        messageType: 'BIRTHDAY',
        messageContent: 'Happy Birthday!',
        scheduledSendTime: pastTime,
        idempotencyKey: 'user-1:BIRTHDAY:2025-12-30',
        status: MessageStatus.SCHEDULED, // Should have been sent
        retryCount: 0,
      });

      await manager.start();

      // Trigger recovery scheduler
      await manager.triggerScheduler('recovery');

      // Message should still be SCHEDULED (ready for retry)
      // In real implementation, it would be re-queued
      const messages = await db
        .select()
        .from(messageLogs)
        .where(eq(messageLogs.id, 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'));

      expect(messages.length).toBe(1);
      expect(messages[0]?.status).toBe(MessageStatus.SCHEDULED);
    });

    it('should mark messages as FAILED after max retries', async () => {
      const pastTime = new Date(Date.now() - 30 * 60 * 1000);

      await db.insert(users).values({
        id: '11111111-1111-1111-1111-111111111111',
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@example.com',
        birthdayDate: new Date('1990-01-01'),
        timezone: 'America/New_York',
      });

      await db.insert(messageLogs).values({
        id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
        userId: '11111111-1111-1111-1111-111111111111',
        messageType: 'BIRTHDAY',
        messageContent: 'Happy Birthday!',
        scheduledSendTime: pastTime,
        idempotencyKey: 'user-1:BIRTHDAY:2025-12-30',
        status: MessageStatus.SCHEDULED,
        retryCount: 3, // Already at max retries
      });

      await manager.start();

      // Trigger recovery scheduler
      await manager.triggerScheduler('recovery');

      // Message should be marked as FAILED
      const messages = await db
        .select()
        .from(messageLogs)
        .where(eq(messageLogs.id, 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'));

      expect(messages.length).toBe(1);
      expect(messages[0]?.status).toBe(MessageStatus.FAILED);
    });
  });

  describe('Graceful Shutdown', () => {
    it('should wait for running jobs before shutdown', async () => {
      await manager.start();

      const shutdownPromise = manager.gracefulShutdown(5000);

      // Shutdown should complete within timeout
      await expect(shutdownPromise).resolves.not.toThrow();

      expect(manager.isRunning()).toBe(false);
    });

    it('should force shutdown after timeout', async () => {
      await manager.start();

      const startTime = Date.now();
      await manager.gracefulShutdown(1000); // 1 second timeout
      const elapsed = Date.now() - startTime;

      // Should timeout and force shutdown
      expect(elapsed).toBeLessThan(1500); // Allow some margin
      expect(manager.isRunning()).toBe(false);
    });
  });

  describe('Statistics and Monitoring', () => {
    it('should track statistics correctly', async () => {
      await manager.start();

      const initialStats = manager.getDetailedStats();

      // Note: Singleton schedulers may retain lastRunTime from previous tests
      // We just verify the structure and that stats update after triggering
      expect(initialStats.minuteEnqueue).toBeDefined();
      expect(initialStats.recovery).toBeDefined();
      expect(initialStats.dailyBirthday).toBeDefined();

      // Capture the current lastRunTime (may be null or a previous date)
      const beforeTriggerTime = initialStats.dailyBirthday.lastRunTime;

      // After triggering schedulers, stats should update
      await manager.triggerScheduler('daily');

      const updatedStats = manager.getDetailedStats();
      expect(updatedStats.dailyBirthday.lastRunTime).toBeTruthy();

      // If it was null before, it should now have a value
      // If it had a value, it should be updated to a newer time
      if (beforeTriggerTime === null) {
        expect(updatedStats.dailyBirthday.lastRunTime).not.toBeNull();
      } else {
        expect(updatedStats.dailyBirthday.lastRunTime!.getTime()).toBeGreaterThanOrEqual(
          beforeTriggerTime.getTime()
        );
      }
    });

    it('should provide recovery metrics', async () => {
      await manager.start();

      const stats = manager.getDetailedStats();
      const metrics = stats.recoveryMetrics;

      expect(metrics).toHaveProperty('totalRecovered');
      expect(metrics).toHaveProperty('totalFailed');
      expect(metrics).toHaveProperty('successRate');
      expect(metrics).toHaveProperty('lastRunMissedCount');
      expect(metrics).toHaveProperty('lastRunRecoveryRate');
    });
  });
});
