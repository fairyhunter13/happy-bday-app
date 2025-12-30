/**
 * Integration tests for UserRepository and MessageLogRepository
 *
 * Tests:
 * - Cross-repository operations
 * - CASCADE delete behavior
 * - Transaction coordination
 * - Real database constraints
 * - Performance with realistic data
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { UserRepository } from '../../src/repositories/user.repository.js';
import { MessageLogRepository } from '../../src/repositories/message-log.repository.js';
import { MessageStatus } from '../../src/db/schema/message-logs.js';
import { PostgresTestContainer, cleanDatabase } from '../helpers/testcontainers.js';
import type { CreateUserDto, CreateMessageLogDto } from '../../src/types/dto.js';
import { DateTime } from 'luxon';

describe('Repository Integration Tests', () => {
  let testContainer: PostgresTestContainer;
  let queryClient: ReturnType<typeof postgres>;
  let db: ReturnType<typeof drizzle>;
  let userRepository: UserRepository;
  let messageLogRepository: MessageLogRepository;

  beforeAll(async () => {
    testContainer = new PostgresTestContainer();
    const { connectionString } = await testContainer.start();
    await testContainer.runMigrations('./drizzle');

    queryClient = postgres(connectionString);
    db = drizzle(queryClient);
    userRepository = new UserRepository(db);
    messageLogRepository = new MessageLogRepository(db);
  });

  afterAll(async () => {
    if (queryClient) {
      await queryClient.end();
    }
    if (testContainer) {
      await testContainer.stop();
    }
  });

  beforeEach(async () => {
    await cleanDatabase(testContainer.getPool());
  });

  describe('CASCADE DELETE', () => {
    it('should delete message logs when user is deleted (hard delete)', async () => {
      // Create user
      const userData: CreateUserDto = {
        firstName: 'Delete',
        lastName: 'Test',
        email: 'delete@example.com',
        timezone: 'UTC',
      };
      const user = await userRepository.create(userData);

      // Create message logs
      const messageData: CreateMessageLogDto = {
        userId: user.id,
        messageType: 'BIRTHDAY',
        messageContent: 'Test message',
        scheduledSendTime: new Date('2025-01-15T09:00:00Z'),
        idempotencyKey: 'cascade-test-1',
      };
      await messageLogRepository.create(messageData);

      // Verify message exists
      let messages = await messageLogRepository.findByUserId(user.id);
      expect(messages).toHaveLength(1);

      // Hard delete user (directly in database to bypass soft delete)
      const pool = testContainer.getPool();
      await pool.query('DELETE FROM users WHERE id = $1', [user.id]);

      // Verify message was CASCADE deleted
      messages = await messageLogRepository.findByUserId(user.id);
      expect(messages).toHaveLength(0);
    });

    it('should keep message logs when user is soft deleted', async () => {
      // Create user
      const userData: CreateUserDto = {
        firstName: 'Soft',
        lastName: 'Delete',
        email: 'soft@example.com',
        timezone: 'UTC',
      };
      const user = await userRepository.create(userData);

      // Create message log
      const messageData: CreateMessageLogDto = {
        userId: user.id,
        messageType: 'BIRTHDAY',
        messageContent: 'Test message',
        scheduledSendTime: new Date('2025-01-15T09:00:00Z'),
        idempotencyKey: 'soft-delete-1',
      };
      await messageLogRepository.create(messageData);

      // Soft delete user
      await userRepository.delete(user.id);

      // Message logs should still exist (orphaned but present)
      const messages = await messageLogRepository.findByUserId(user.id);
      expect(messages).toHaveLength(1);
    });
  });

  describe('Cross-repository transactions', () => {
    it('should create user and message in single transaction', async () => {
      const result = await userRepository.transaction(async (tx) => {
        // Create user
        const userData: CreateUserDto = {
          firstName: 'Transaction',
          lastName: 'Test',
          email: 'transaction@example.com',
          timezone: 'UTC',
        };
        const user = await userRepository.create(userData, tx);

        // Create message
        const messageData: CreateMessageLogDto = {
          userId: user.id,
          messageType: 'BIRTHDAY',
          messageContent: 'Test message',
          scheduledSendTime: new Date('2025-01-15T09:00:00Z'),
          idempotencyKey: 'tx-test-1',
        };
        const message = await messageLogRepository.create(messageData, tx);

        return { user, message };
      });

      // Verify both were created
      const user = await userRepository.findByEmail('transaction@example.com');
      const messages = await messageLogRepository.findByUserId(result.user.id);

      expect(user).not.toBeNull();
      expect(messages).toHaveLength(1);
    });

    it('should rollback user and message on transaction failure', async () => {
      await expect(
        userRepository.transaction(async (tx) => {
          // Create user
          const userData: CreateUserDto = {
            firstName: 'Rollback',
            lastName: 'Test',
            email: 'rollback@example.com',
            timezone: 'UTC',
          };
          const user = await userRepository.create(userData, tx);

          // Create message
          const messageData: CreateMessageLogDto = {
            userId: user.id,
            messageType: 'BIRTHDAY',
            messageContent: 'Test message',
            scheduledSendTime: new Date('2025-01-15T09:00:00Z'),
            idempotencyKey: 'rollback-test-1',
          };
          await messageLogRepository.create(messageData, tx);

          // Force rollback
          throw new Error('Intentional failure');
        })
      ).rejects.toThrow('Intentional failure');

      // Verify neither was created
      const user = await userRepository.findByEmail('rollback@example.com');
      expect(user).toBeNull();
    });
  });

  describe('Birthday scheduling workflow', () => {
    it('should handle complete birthday message workflow', async () => {
      // 1. Create user with birthday today
      const today = DateTime.now();
      const userData: CreateUserDto = {
        firstName: 'Birthday',
        lastName: 'User',
        email: 'birthday@example.com',
        timezone: 'America/New_York',
        birthdayDate: new Date(1990, today.month - 1, today.day),
      };
      const user = await userRepository.create(userData);

      // 2. Find users with birthdays today
      const usersWithBirthdays = await userRepository.findBirthdaysToday();
      expect(usersWithBirthdays).toHaveLength(1);
      expect(usersWithBirthdays[0]?.id).toBe(user.id);

      // 3. Schedule message
      const messageData: CreateMessageLogDto = {
        userId: user.id,
        messageType: 'BIRTHDAY',
        messageContent: `Happy ${today.year - 1990}th Birthday, ${user.firstName}!`,
        scheduledSendTime: new Date(today.year, today.month - 1, today.day, 9, 0, 0),
        idempotencyKey: `${user.id}:BIRTHDAY:${today.toISODate()}`,
      };
      const message = await messageLogRepository.create(messageData);

      // 4. Check idempotency (prevent duplicate)
      const existing = await messageLogRepository.checkIdempotency(messageData.idempotencyKey);
      expect(existing).not.toBeNull();
      expect(existing?.id).toBe(message.id);

      // 5. Update status through workflow
      await messageLogRepository.updateStatus(message.id, MessageStatus.QUEUED);
      await messageLogRepository.updateStatus(message.id, MessageStatus.SENDING);

      // 6. Mark as sent
      const sent = await messageLogRepository.markAsSent(message.id, {
        apiResponseCode: 200,
        apiResponseBody: '{"status":"delivered"}',
      });

      expect(sent.status).toBe(MessageStatus.SENT);
      expect(sent.actualSendTime).toBeInstanceOf(Date);
    });

    it('should handle failed message with retries', async () => {
      // Create user
      const userData: CreateUserDto = {
        firstName: 'Retry',
        lastName: 'Test',
        email: 'retry@example.com',
        timezone: 'UTC',
      };
      const user = await userRepository.create(userData);

      // Create message
      const messageData: CreateMessageLogDto = {
        userId: user.id,
        messageType: 'BIRTHDAY',
        messageContent: 'Test message',
        scheduledSendTime: new Date('2025-01-15T09:00:00Z'),
        idempotencyKey: 'retry-test-1',
      };
      let message = await messageLogRepository.create(messageData);

      // Fail 1st attempt (should RETRY)
      message = await messageLogRepository.markAsFailed(message.id, {
        errorMessage: 'Network timeout',
        apiResponseCode: 503,
      });
      expect(message.status).toBe(MessageStatus.RETRYING);
      expect(message.retryCount).toBe(1);

      // Fail 2nd attempt (should RETRY)
      message = await messageLogRepository.markAsFailed(message.id, {
        errorMessage: 'Network timeout',
        apiResponseCode: 503,
      });
      expect(message.status).toBe(MessageStatus.RETRYING);
      expect(message.retryCount).toBe(2);

      // Fail 3rd attempt (should FAIL permanently)
      message = await messageLogRepository.markAsFailed(
        message.id,
        {
          errorMessage: 'Network timeout',
          apiResponseCode: 503,
        },
        3
      );
      expect(message.status).toBe(MessageStatus.FAILED);
      expect(message.retryCount).toBe(3);
    });
  });

  describe('Missed message detection', () => {
    it('should detect stuck messages in scheduler', async () => {
      // Create user
      const userData: CreateUserDto = {
        firstName: 'Missed',
        lastName: 'Test',
        email: 'missed@example.com',
        timezone: 'UTC',
      };
      const user = await userRepository.create(userData);

      // Create message scheduled 10 minutes ago
      const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
      const messageData: CreateMessageLogDto = {
        userId: user.id,
        messageType: 'BIRTHDAY',
        messageContent: 'Missed message',
        scheduledSendTime: tenMinutesAgo,
        idempotencyKey: 'missed-1',
        status: MessageStatus.SCHEDULED,
      };
      await messageLogRepository.create(messageData);

      // Create message scheduled 2 minutes ago (too recent)
      const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000);
      const recentData: CreateMessageLogDto = {
        userId: user.id,
        messageType: 'BIRTHDAY',
        messageContent: 'Recent message',
        scheduledSendTime: twoMinutesAgo,
        idempotencyKey: 'recent-1',
        status: MessageStatus.SCHEDULED,
      };
      await messageLogRepository.create(recentData);

      // Find missed messages
      const missed = await messageLogRepository.findMissed();

      expect(missed).toHaveLength(1);
      expect(missed[0]?.messageContent).toBe('Missed message');
    });
  });

  describe('Bulk operations', () => {
    it('should handle multiple users with birthdays efficiently', async () => {
      const today = DateTime.now();
      const users: CreateUserDto[] = [];

      // Create 10 users with birthdays today
      for (let i = 0; i < 10; i++) {
        users.push({
          firstName: `User${i}`,
          lastName: 'Test',
          email: `user${i}@example.com`,
          timezone: i % 2 === 0 ? 'America/New_York' : 'Europe/London',
          birthdayDate: new Date(1990 + i, today.month - 1, today.day),
        });
      }

      // Create all users
      const createdUsers = await Promise.all(users.map((user) => userRepository.create(user)));

      // Find all users with birthdays today
      const usersWithBirthdays = await userRepository.findBirthdaysToday();
      expect(usersWithBirthdays).toHaveLength(10);

      // Schedule messages for all users
      const messages: CreateMessageLogDto[] = createdUsers.map((user, i) => ({
        userId: user.id,
        messageType: 'BIRTHDAY',
        messageContent: `Happy Birthday, ${user.firstName}!`,
        scheduledSendTime: new Date(today.year, today.month - 1, today.day, 9, 0, 0),
        idempotencyKey: `${user.id}:BIRTHDAY:${today.toISODate()}`,
      }));

      await Promise.all(messages.map((msg) => messageLogRepository.create(msg)));

      // Verify all messages were created
      const allMessages = await messageLogRepository.findAll({ limit: 100 });
      expect(allMessages).toHaveLength(10);
    });
  });

  describe('Timezone-aware queries', () => {
    it('should find birthdays today in specific timezones', async () => {
      const today = DateTime.now();

      const users: CreateUserDto[] = [
        {
          firstName: 'NewYork',
          lastName: 'User',
          email: 'ny@example.com',
          timezone: 'America/New_York',
          birthdayDate: new Date(1990, today.month - 1, today.day),
        },
        {
          firstName: 'London',
          lastName: 'User',
          email: 'london@example.com',
          timezone: 'Europe/London',
          birthdayDate: new Date(1991, today.month - 1, today.day),
        },
        {
          firstName: 'Tokyo',
          lastName: 'User',
          email: 'tokyo@example.com',
          timezone: 'Asia/Tokyo',
          birthdayDate: new Date(1992, today.month - 1, today.day),
        },
      ];

      for (const user of users) {
        await userRepository.create(user);
      }

      // Find birthdays in New York timezone
      const nyBirthdays = await userRepository.findBirthdaysToday('America/New_York');
      expect(nyBirthdays).toHaveLength(1);
      expect(nyBirthdays[0]?.email).toBe('ny@example.com');

      // Find all birthdays
      const allBirthdays = await userRepository.findBirthdaysToday();
      expect(allBirthdays).toHaveLength(3);
    });
  });

  describe('Data consistency', () => {
    it('should maintain referential integrity', async () => {
      const userData: CreateUserDto = {
        firstName: 'Integrity',
        lastName: 'Test',
        email: 'integrity@example.com',
        timezone: 'UTC',
      };
      const user = await userRepository.create(userData);

      // Create message
      const messageData: CreateMessageLogDto = {
        userId: user.id,
        messageType: 'BIRTHDAY',
        messageContent: 'Test',
        scheduledSendTime: new Date('2025-01-15T09:00:00Z'),
        idempotencyKey: 'integrity-1',
      };
      const message = await messageLogRepository.create(messageData);

      // Verify foreign key relationship
      const foundMessage = await messageLogRepository.findById(message.id);
      expect(foundMessage?.userId).toBe(user.id);

      const foundUser = await userRepository.findById(user.id);
      expect(foundUser?.id).toBe(user.id);
    });
  });
});
