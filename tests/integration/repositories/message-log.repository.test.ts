/**
 * Unit tests for MessageLogRepository
 *
 * Tests:
 * - Message log CRUD operations
 * - Status transitions
 * - Idempotency checks
 * - Time-based queries
 * - Missed message detection
 * - Retry logic
 * - Transaction support
 * - Error handling
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { MessageLogRepository } from '../../../src/repositories/message-log.repository.js';
import { UserRepository } from '../../../src/repositories/user.repository.js';
import { MessageStatus } from '../../../src/db/schema/message-logs.js';
import { DatabaseError, NotFoundError, UniqueConstraintError } from '../../../src/utils/errors.js';
import { PostgresTestContainer, cleanDatabase, isCI } from '../../helpers/testcontainers.js';
import type { CreateMessageLogDto, CreateUserDto } from '../../../src/types/dto.js';

describe('MessageLogRepository', () => {
  let testContainer: PostgresTestContainer;
  let queryClient: ReturnType<typeof postgres>;
  let db: ReturnType<typeof drizzle>;
  let repository: MessageLogRepository;
  let userRepository: UserRepository;
  let testUserId: string;

  beforeAll(async () => {
    // Start PostgreSQL container
    testContainer = new PostgresTestContainer();
    const result = await testContainer.start();

    // Run migrations
    await testContainer.runMigrations('./drizzle');

    // Create Drizzle instance
    // In CI mode, use connection string from environment
    // In local mode, use testcontainer connection string
    const connectionString = isCI() ?
      (process.env.DATABASE_URL || result.connectionString) :
      result.connectionString;

    // Use limited connection pool in CI to prevent exhaustion
    queryClient = postgres(connectionString, {
      max: isCI() ? 2 : 10,
      idle_timeout: 10,
      connect_timeout: 10,
    });
    db = drizzle(queryClient);
    repository = new MessageLogRepository(db);
    userRepository = new UserRepository(db);
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
    // Clean database before each test
    await cleanDatabase(testContainer.getPool());

    // Create test user
    const userData: CreateUserDto = {
      firstName: 'Test',
      lastName: 'User',
      email: 'test@example.com',
      timezone: 'UTC',
    };
    const user = await userRepository.create(userData);
    testUserId = user.id;
  });

  describe('findById', () => {
    it('should find message log by ID', async () => {
      const messageData: CreateMessageLogDto = {
        userId: testUserId,
        messageType: 'BIRTHDAY',
        messageContent: 'Happy Birthday!',
        scheduledSendTime: new Date('2025-01-15T09:00:00Z'),
        idempotencyKey: 'test-key-1',
      };

      const created = await repository.create(messageData);
      const found = await repository.findById(created.id);

      expect(found).not.toBeNull();
      expect(found?.id).toBe(created.id);
      expect(found?.messageContent).toBe(messageData.messageContent);
    });

    it('should return null for non-existent message log', async () => {
      const found = await repository.findById('00000000-0000-0000-0000-000000000000');
      expect(found).toBeNull();
    });
  });

  describe('findByUserId', () => {
    it('should find all messages for a user', async () => {
      const messages: CreateMessageLogDto[] = [
        {
          userId: testUserId,
          messageType: 'BIRTHDAY',
          messageContent: 'Happy Birthday!',
          scheduledSendTime: new Date('2025-01-15T09:00:00Z'),
          idempotencyKey: 'test-key-1',
        },
        {
          userId: testUserId,
          messageType: 'ANNIVERSARY',
          messageContent: 'Happy Anniversary!',
          scheduledSendTime: new Date('2025-02-15T09:00:00Z'),
          idempotencyKey: 'test-key-2',
        },
      ];

      for (const msg of messages) {
        await repository.create(msg);
      }

      const found = await repository.findByUserId(testUserId);

      expect(found).toHaveLength(2);
      expect(found.some((m) => m.messageType === 'BIRTHDAY')).toBe(true);
      expect(found.some((m) => m.messageType === 'ANNIVERSARY')).toBe(true);
    });

    it('should return empty array for user with no messages', async () => {
      const found = await repository.findByUserId(testUserId);
      expect(found).toHaveLength(0);
    });
  });

  describe('findScheduled', () => {
    it('should find messages scheduled in time range', async () => {
      const now = new Date();
      const future1h = new Date(now.getTime() + 60 * 60 * 1000);
      const future2h = new Date(now.getTime() + 2 * 60 * 60 * 1000);
      const future3h = new Date(now.getTime() + 3 * 60 * 60 * 1000);

      const messages: CreateMessageLogDto[] = [
        {
          userId: testUserId,
          messageType: 'BIRTHDAY',
          messageContent: 'Message 1',
          scheduledSendTime: future1h,
          idempotencyKey: 'key-1',
        },
        {
          userId: testUserId,
          messageType: 'BIRTHDAY',
          messageContent: 'Message 2',
          scheduledSendTime: future2h,
          idempotencyKey: 'key-2',
        },
        {
          userId: testUserId,
          messageType: 'BIRTHDAY',
          messageContent: 'Message 3',
          scheduledSendTime: future3h,
          idempotencyKey: 'key-3',
        },
      ];

      for (const msg of messages) {
        await repository.create(msg);
      }

      // Find messages in first 2.5 hours
      const found = await repository.findScheduled(
        now,
        new Date(now.getTime() + 2.5 * 60 * 60 * 1000)
      );

      expect(found).toHaveLength(2);
    });

    it('should only return SCHEDULED status messages', async () => {
      const now = new Date();
      const future = new Date(now.getTime() + 60 * 60 * 1000);

      const scheduled: CreateMessageLogDto = {
        userId: testUserId,
        messageType: 'BIRTHDAY',
        messageContent: 'Scheduled',
        scheduledSendTime: future,
        idempotencyKey: 'scheduled-1',
        status: MessageStatus.SCHEDULED,
      };

      const queued: CreateMessageLogDto = {
        userId: testUserId,
        messageType: 'BIRTHDAY',
        messageContent: 'Queued',
        scheduledSendTime: future,
        idempotencyKey: 'queued-1',
        status: MessageStatus.QUEUED,
      };

      const msg1 = await repository.create(scheduled);
      const msg2 = await repository.create(queued);

      // Update second message to QUEUED
      await repository.updateStatus(msg2.id, MessageStatus.QUEUED);

      const found = await repository.findScheduled(
        now,
        new Date(now.getTime() + 2 * 60 * 60 * 1000)
      );

      expect(found).toHaveLength(1);
      expect(found[0]?.status).toBe(MessageStatus.SCHEDULED);
    });
  });

  describe('findMissed', () => {
    it('should find messages that should have been sent', async () => {
      const now = new Date();
      const past10min = new Date(now.getTime() - 10 * 60 * 1000);
      const past3min = new Date(now.getTime() - 3 * 60 * 1000);

      const messages: CreateMessageLogDto[] = [
        {
          userId: testUserId,
          messageType: 'BIRTHDAY',
          messageContent: 'Missed 1',
          scheduledSendTime: past10min,
          idempotencyKey: 'missed-1',
          status: MessageStatus.SCHEDULED,
        },
        {
          userId: testUserId,
          messageType: 'BIRTHDAY',
          messageContent: 'Recent',
          scheduledSendTime: past3min,
          idempotencyKey: 'recent-1',
          status: MessageStatus.SCHEDULED,
        },
      ];

      for (const msg of messages) {
        await repository.create(msg);
      }

      const missed = await repository.findMissed();

      // Should find the message scheduled >5 minutes ago
      expect(missed).toHaveLength(1);
      expect(missed[0]?.messageContent).toBe('Missed 1');
    });

    it('should include QUEUED and RETRYING messages', async () => {
      const past = new Date(Date.now() - 10 * 60 * 1000);

      const messages: CreateMessageLogDto[] = [
        {
          userId: testUserId,
          messageType: 'BIRTHDAY',
          messageContent: 'Scheduled',
          scheduledSendTime: past,
          idempotencyKey: 'scheduled',
          status: MessageStatus.SCHEDULED,
        },
        {
          userId: testUserId,
          messageType: 'BIRTHDAY',
          messageContent: 'Queued',
          scheduledSendTime: past,
          idempotencyKey: 'queued',
          status: MessageStatus.QUEUED,
        },
        {
          userId: testUserId,
          messageType: 'BIRTHDAY',
          messageContent: 'Retrying',
          scheduledSendTime: past,
          idempotencyKey: 'retrying',
          status: MessageStatus.RETRYING,
        },
      ];

      for (const msg of messages) {
        await repository.create(msg);
      }

      const missed = await repository.findMissed();

      expect(missed.length).toBeGreaterThanOrEqual(3);
    });

    it('should not include SENT or FAILED messages', async () => {
      const past = new Date(Date.now() - 10 * 60 * 1000);

      const sent: CreateMessageLogDto = {
        userId: testUserId,
        messageType: 'BIRTHDAY',
        messageContent: 'Sent',
        scheduledSendTime: past,
        idempotencyKey: 'sent-1',
        status: MessageStatus.SENT,
      };

      await repository.create(sent);

      const missed = await repository.findMissed();

      expect(missed).toHaveLength(0);
    });
  });

  describe('create', () => {
    it('should create a message log', async () => {
      const messageData: CreateMessageLogDto = {
        userId: testUserId,
        messageType: 'BIRTHDAY',
        messageContent: 'Happy Birthday John!',
        scheduledSendTime: new Date('2025-01-15T09:00:00Z'),
        idempotencyKey: 'create-test-1',
      };

      const created = await repository.create(messageData);

      expect(created.id).toBeDefined();
      expect(created.userId).toBe(testUserId);
      expect(created.messageType).toBe('BIRTHDAY');
      expect(created.messageContent).toBe(messageData.messageContent);
      expect(created.status).toBe(MessageStatus.SCHEDULED);
      expect(created.retryCount).toBe(0);
    });

    it('should throw UniqueConstraintError for duplicate idempotency key', async () => {
      const messageData: CreateMessageLogDto = {
        userId: testUserId,
        messageType: 'BIRTHDAY',
        messageContent: 'Message',
        scheduledSendTime: new Date('2025-01-15T09:00:00Z'),
        idempotencyKey: 'duplicate-key',
      };

      await repository.create(messageData);

      await expect(repository.create(messageData)).rejects.toThrow(UniqueConstraintError);
    });
  });

  describe('updateStatus', () => {
    it('should update message status', async () => {
      const messageData: CreateMessageLogDto = {
        userId: testUserId,
        messageType: 'BIRTHDAY',
        messageContent: 'Message',
        scheduledSendTime: new Date('2025-01-15T09:00:00Z'),
        idempotencyKey: 'status-test-1',
      };

      const created = await repository.create(messageData);
      const updated = await repository.updateStatus(created.id, MessageStatus.QUEUED);

      expect(updated.status).toBe(MessageStatus.QUEUED);
    });

    it('should throw NotFoundError for non-existent message', async () => {
      await expect(
        repository.updateStatus('00000000-0000-0000-0000-000000000000', MessageStatus.QUEUED)
      ).rejects.toThrow(NotFoundError);
    });
  });

  describe('markAsSent', () => {
    it('should mark message as sent with response data', async () => {
      const messageData: CreateMessageLogDto = {
        userId: testUserId,
        messageType: 'BIRTHDAY',
        messageContent: 'Message',
        scheduledSendTime: new Date('2025-01-15T09:00:00Z'),
        idempotencyKey: 'sent-test-1',
      };

      const created = await repository.create(messageData);

      const response = {
        apiResponseCode: 200,
        apiResponseBody: '{"status":"delivered"}',
      };

      const updated = await repository.markAsSent(created.id, response);

      expect(updated.status).toBe(MessageStatus.SENT);
      expect(updated.actualSendTime).toBeInstanceOf(Date);
      expect(updated.apiResponseCode).toBe(200);
      expect(updated.apiResponseBody).toBe('{"status":"delivered"}');
    });
  });

  describe('markAsFailed', () => {
    it('should mark message as RETRYING on first failure', async () => {
      const messageData: CreateMessageLogDto = {
        userId: testUserId,
        messageType: 'BIRTHDAY',
        messageContent: 'Message',
        scheduledSendTime: new Date('2025-01-15T09:00:00Z'),
        idempotencyKey: 'failed-test-1',
      };

      const created = await repository.create(messageData);

      const errorData = {
        errorMessage: 'Network timeout',
        apiResponseCode: 500,
      };

      const updated = await repository.markAsFailed(created.id, errorData);

      expect(updated.status).toBe(MessageStatus.RETRYING);
      expect(updated.retryCount).toBe(1);
      expect(updated.errorMessage).toBe('Network timeout');
      expect(updated.lastRetryAt).toBeInstanceOf(Date);
    });

    it('should mark message as FAILED after max retries', async () => {
      const messageData: CreateMessageLogDto = {
        userId: testUserId,
        messageType: 'BIRTHDAY',
        messageContent: 'Message',
        scheduledSendTime: new Date('2025-01-15T09:00:00Z'),
        idempotencyKey: 'max-retries-1',
        retryCount: 2, // Already tried twice
      };

      const created = await repository.create(messageData);

      const errorData = {
        errorMessage: 'Final failure',
      };

      const updated = await repository.markAsFailed(created.id, errorData, 3);

      expect(updated.status).toBe(MessageStatus.FAILED);
      expect(updated.retryCount).toBe(3);
    });

    it('should respect custom maxRetries', async () => {
      const messageData: CreateMessageLogDto = {
        userId: testUserId,
        messageType: 'BIRTHDAY',
        messageContent: 'Message',
        scheduledSendTime: new Date('2025-01-15T09:00:00Z'),
        idempotencyKey: 'custom-retry-1',
      };

      const created = await repository.create(messageData);

      const errorData = {
        errorMessage: 'Error',
      };

      const updated = await repository.markAsFailed(created.id, errorData, 1);

      expect(updated.status).toBe(MessageStatus.FAILED);
      expect(updated.retryCount).toBe(1);
    });
  });

  describe('checkIdempotency', () => {
    it('should return message if idempotency key exists', async () => {
      const messageData: CreateMessageLogDto = {
        userId: testUserId,
        messageType: 'BIRTHDAY',
        messageContent: 'Message',
        scheduledSendTime: new Date('2025-01-15T09:00:00Z'),
        idempotencyKey: 'idempotency-check-1',
      };

      await repository.create(messageData);

      const found = await repository.checkIdempotency('idempotency-check-1');

      expect(found).not.toBeNull();
      expect(found?.idempotencyKey).toBe('idempotency-check-1');
    });

    it('should return null if idempotency key does not exist', async () => {
      const found = await repository.checkIdempotency('non-existent-key');
      expect(found).toBeNull();
    });
  });

  describe('transaction', () => {
    it('should commit transaction on success', async () => {
      const result = await repository.transaction(async (tx) => {
        const msg1: CreateMessageLogDto = {
          userId: testUserId,
          messageType: 'BIRTHDAY',
          messageContent: 'Message 1',
          scheduledSendTime: new Date('2025-01-15T09:00:00Z'),
          idempotencyKey: 'tx-msg-1',
        };

        const msg2: CreateMessageLogDto = {
          userId: testUserId,
          messageType: 'BIRTHDAY',
          messageContent: 'Message 2',
          scheduledSendTime: new Date('2025-01-16T09:00:00Z'),
          idempotencyKey: 'tx-msg-2',
        };

        await repository.create(msg1, tx);
        await repository.create(msg2, tx);

        return 'success';
      });

      expect(result).toBe('success');

      // Verify both messages were created
      const messages = await repository.findByUserId(testUserId);
      expect(messages).toHaveLength(2);
    });

    it('should rollback transaction on error', async () => {
      await expect(
        repository.transaction(async (tx) => {
          const msg: CreateMessageLogDto = {
            userId: testUserId,
            messageType: 'BIRTHDAY',
            messageContent: 'Rollback test',
            scheduledSendTime: new Date('2025-01-15T09:00:00Z'),
            idempotencyKey: 'rollback-1',
          };

          await repository.create(msg, tx);

          throw new Error('Transaction failed');
        })
      ).rejects.toThrow('Transaction failed');

      // Verify message was not created
      const messages = await repository.findByUserId(testUserId);
      expect(messages).toHaveLength(0);
    });
  });

  describe('findAll with filters', () => {
    beforeEach(async () => {
      const now = new Date();

      const messages: CreateMessageLogDto[] = [
        {
          userId: testUserId,
          messageType: 'BIRTHDAY',
          messageContent: 'Birthday 1',
          scheduledSendTime: new Date(now.getTime() + 60 * 60 * 1000),
          idempotencyKey: 'filter-1',
          status: MessageStatus.SCHEDULED,
        },
        {
          userId: testUserId,
          messageType: 'ANNIVERSARY',
          messageContent: 'Anniversary 1',
          scheduledSendTime: new Date(now.getTime() + 2 * 60 * 60 * 1000),
          idempotencyKey: 'filter-2',
          status: MessageStatus.QUEUED,
        },
      ];

      for (const msg of messages) {
        const created = await repository.create(msg);
        if (msg.status === MessageStatus.QUEUED) {
          await repository.updateStatus(created.id, MessageStatus.QUEUED);
        }
      }
    });

    it('should filter by message type', async () => {
      const found = await repository.findAll({ messageType: 'BIRTHDAY' });

      expect(found).toHaveLength(1);
      expect(found[0]?.messageType).toBe('BIRTHDAY');
    });

    it('should filter by status', async () => {
      const found = await repository.findAll({ status: MessageStatus.SCHEDULED });

      expect(found).toHaveLength(1);
      expect(found[0]?.status).toBe(MessageStatus.SCHEDULED);
    });

    it('should filter by user ID', async () => {
      const found = await repository.findAll({ userId: testUserId });

      expect(found.length).toBeGreaterThanOrEqual(2);
    });

    it('should respect limit and offset', async () => {
      const page1 = await repository.findAll({ limit: 1, offset: 0 });
      const page2 = await repository.findAll({ limit: 1, offset: 1 });

      expect(page1).toHaveLength(1);
      expect(page2).toHaveLength(1);
      expect(page1[0]?.id).not.toBe(page2[0]?.id);
    });
  });
});
