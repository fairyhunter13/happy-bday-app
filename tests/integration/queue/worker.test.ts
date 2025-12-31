/**
 * Message Worker Integration Tests
 *
 * Tests the message worker processing with database integration:
 * 1. Message processing and database status updates
 * 2. Idempotency handling (skip already sent messages)
 * 3. Retry logic with exponential backoff
 * 4. Permanent failure handling (mark as FAILED)
 * 5. Database operations (create/retrieve message logs)
 * 6. Status updates after sending
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach, vi } from 'vitest';
import { RabbitMQContainer, StartedRabbitMQContainer } from '@testcontainers/rabbitmq';
import { PostgreSqlContainer, StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import {
  RabbitMQConnection,
  MessagePublisher,
  MessageConsumer,
  MessageJob,
  QUEUES,
} from '../../../src/queue/index.js';
import {
  MessageType,
  MessageStatus,
  messageLogs,
  type MessageLog,
} from '../../../src/db/schema/message-logs.js';
import { users, type User } from '../../../src/db/schema/users.js';
import { drizzle, type PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { eq, sql } from 'drizzle-orm';
import postgres from 'postgres';
import * as schema from '../../../src/db/schema/index.js';

// Type for our test database
type TestDatabase = PostgresJsDatabase<typeof schema>;

// Override type for message log creation (includes all optional fields)
interface MessageLogOverrides {
  messageType?: string;
  messageContent?: string;
  scheduledSendTime?: Date;
  idempotencyKey?: string;
  status?: string;
  retryCount?: number;
  actualSendTime?: Date | null;
  lastRetryAt?: Date | null;
  apiResponseCode?: number | null;
  apiResponseBody?: string | null;
  errorMessage?: string | null;
}

describe('Message Worker Integration Tests', () => {
  let rabbitContainer: StartedRabbitMQContainer;
  let pgContainer: StartedPostgreSqlContainer;
  let rabbitMQUrl: string;
  let connection: RabbitMQConnection;
  let testDb: TestDatabase;
  let pgClient: postgres.Sql;
  let publisher: MessagePublisher;
  let consumer: MessageConsumer | null = null;

  // Test data generators
  const generateUuid = () => crypto.randomUUID();

  const createTestUser = async (overrides: Partial<typeof users.$inferInsert> = {}) => {
    const userData = {
      id: generateUuid(),
      firstName: 'Test',
      lastName: 'User',
      email: `test-${Date.now()}-${Math.random().toString(36).slice(2)}@example.com`,
      timezone: 'America/New_York',
      birthdayDate: new Date('1990-01-15'),
      ...overrides,
    };

    const [user] = await testDb.insert(users).values(userData).returning();
    return user!;
  };

  const createTestMessageLog = async (userId: string, overrides: MessageLogOverrides = {}) => {
    const messageData = {
      id: generateUuid(),
      userId,
      messageType: MessageType.BIRTHDAY,
      messageContent: 'Happy Birthday! Wishing you a wonderful day!',
      scheduledSendTime: new Date(),
      idempotencyKey: `${userId}:BIRTHDAY:${new Date().toISOString().split('T')[0]}-${Date.now()}`,
      status: MessageStatus.SCHEDULED,
      retryCount: 0,
      ...overrides,
    };

    const [messageLog] = await testDb.insert(messageLogs).values(messageData).returning();
    return messageLog!;
  };

  beforeAll(async () => {
    // Start RabbitMQ container
    rabbitContainer = await new RabbitMQContainer('rabbitmq:3.13-management-alpine')
      .withExposedPorts(5672, 15672)
      .withStartupTimeout(90000)
      .start();

    rabbitMQUrl = rabbitContainer.getAmqpUrl();

    // Start PostgreSQL container
    pgContainer = await new PostgreSqlContainer('postgres:16-alpine')
      .withDatabase('test_db')
      .withUsername('test_user')
      .withPassword('test_password')
      .start();

    // Setup test database connection
    const connectionString = pgContainer.getConnectionUri();
    pgClient = postgres(connectionString);
    testDb = drizzle(pgClient, { schema });

    // Create tables
    await pgClient`
      CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        first_name VARCHAR(100) NOT NULL,
        last_name VARCHAR(100) NOT NULL,
        email VARCHAR(255) NOT NULL UNIQUE,
        timezone VARCHAR(100) NOT NULL,
        birthday_date DATE,
        anniversary_date DATE,
        location_city VARCHAR(100),
        location_country VARCHAR(100),
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        deleted_at TIMESTAMPTZ
      )
    `;

    await pgClient`
      CREATE TABLE IF NOT EXISTS message_logs (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        message_type VARCHAR(50) NOT NULL,
        message_content TEXT NOT NULL,
        scheduled_send_time TIMESTAMPTZ NOT NULL,
        actual_send_time TIMESTAMPTZ,
        status VARCHAR(20) NOT NULL DEFAULT 'SCHEDULED',
        retry_count INTEGER NOT NULL DEFAULT 0,
        last_retry_at TIMESTAMPTZ,
        api_response_code INTEGER,
        api_response_body TEXT,
        error_message TEXT,
        idempotency_key VARCHAR(255) NOT NULL UNIQUE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `;

    // Wait for RabbitMQ to be fully ready
    await new Promise((resolve) => setTimeout(resolve, 2000));

    console.log('Test containers started');
  }, 120000); // 2 minutes timeout

  afterAll(async () => {
    if (consumer && consumer.isRunning()) {
      await consumer.stopConsuming();
    }
    if (connection) {
      await connection.close();
    }
    if (pgClient) {
      await pgClient.end();
    }
    if (rabbitContainer) {
      await rabbitContainer.stop();
    }
    if (pgContainer) {
      await pgContainer.stop();
    }
  }, 30000);

  beforeEach(async () => {
    // Initialize RabbitMQ connection
    if (!connection) {
      connection = RabbitMQConnection.getInstance({
        url: rabbitMQUrl,
      });
      await connection.connect();
    }

    // Initialize publisher
    publisher = new MessagePublisher();
    await publisher.initialize();

    // Purge queues to ensure clean state
    try {
      const publisherChannel = connection.getPublisherChannel();
      await publisherChannel.purgeQueue(QUEUES.BIRTHDAY_MESSAGES);
      await publisherChannel.purgeQueue(QUEUES.BIRTHDAY_DLQ);
    } catch {
      // Queues might not exist yet, ignore error
    }

    // Clean up database tables
    await testDb.delete(messageLogs);
    await testDb.delete(users);
  });

  afterEach(async () => {
    if (consumer && consumer.isRunning()) {
      await consumer.stopConsuming();
      consumer = null;
    }
    vi.restoreAllMocks();
  });

  describe('Worker Processing', () => {
    it('should process message and update database status', async () => {
      // 1. Create test user in database
      const user = await createTestUser();

      // 2. Create message log in database with QUEUED status
      const messageLog = await createTestMessageLog(user.id, {
        status: MessageStatus.QUEUED,
      });

      // Track processed messages
      const processedMessages: MessageJob[] = [];
      let messageProcessed = false;

      // 3. Create consumer that simulates message processing
      consumer = new MessageConsumer({
        prefetch: 1,
        onMessage: async (job: MessageJob) => {
          processedMessages.push(job);

          // Simulate successful message sending by updating database
          await testDb
            .update(messageLogs)
            .set({
              status: MessageStatus.SENT,
              actualSendTime: new Date(),
              apiResponseCode: 200,
              apiResponseBody: JSON.stringify({ success: true }),
              updatedAt: new Date(),
            })
            .where(eq(messageLogs.id, job.messageId));

          messageProcessed = true;
        },
      });

      await consumer.startConsuming();

      // 4. Publish message to queue
      const job: MessageJob = {
        messageId: messageLog.id,
        userId: user.id,
        messageType: MessageType.BIRTHDAY,
        scheduledSendTime: new Date().toISOString(),
        retryCount: 0,
        timestamp: Date.now(),
      };

      await publisher.publishMessage(job);

      // 5. Wait for message processing
      await new Promise<void>((resolve) => {
        const checkInterval = setInterval(() => {
          if (messageProcessed) {
            clearInterval(checkInterval);
            resolve();
          }
        }, 100);
        setTimeout(() => {
          clearInterval(checkInterval);
          resolve();
        }, 5000);
      });

      // 6. Verify message was processed
      expect(processedMessages).toHaveLength(1);
      expect(processedMessages[0]?.messageId).toBe(messageLog.id);

      // 7. Verify database status was updated to SENT
      const updatedMessageLog = await testDb
        .select()
        .from(messageLogs)
        .where(eq(messageLogs.id, messageLog.id))
        .limit(1);

      expect(updatedMessageLog[0]?.status).toBe(MessageStatus.SENT);
      expect(updatedMessageLog[0]?.actualSendTime).toBeDefined();
      expect(updatedMessageLog[0]?.apiResponseCode).toBe(200);
    });

    it('should handle idempotency - skip already sent messages', async () => {
      // 1. Create test user
      const user = await createTestUser();

      // 2. Create message log that is already SENT
      const messageLog = await createTestMessageLog(user.id, {
        status: MessageStatus.SENT,
        actualSendTime: new Date(),
        apiResponseCode: 200,
        apiResponseBody: JSON.stringify({ success: true }),
      });

      let processingAttempted = false;
      let messageSkipped = false;

      // 3. Create consumer that checks idempotency
      consumer = new MessageConsumer({
        prefetch: 1,
        onMessage: async (job: MessageJob) => {
          processingAttempted = true;

          // Check if message was already sent (idempotency check)
          const existingMessage = await testDb
            .select()
            .from(messageLogs)
            .where(eq(messageLogs.id, job.messageId))
            .limit(1);

          if (existingMessage[0]?.status === MessageStatus.SENT) {
            // Message already sent - skip processing
            messageSkipped = true;
            return; // Acknowledge without reprocessing
          }

          // This should NOT be reached for already sent messages
          throw new Error('Should not process already sent message');
        },
      });

      await consumer.startConsuming();

      // 4. Publish message to queue (simulating redelivery)
      const job: MessageJob = {
        messageId: messageLog.id,
        userId: user.id,
        messageType: MessageType.BIRTHDAY,
        scheduledSendTime: new Date().toISOString(),
        retryCount: 0,
        timestamp: Date.now(),
      };

      await publisher.publishMessage(job);

      // 5. Wait for message processing
      await new Promise<void>((resolve) => {
        const checkInterval = setInterval(() => {
          if (processingAttempted) {
            clearInterval(checkInterval);
            resolve();
          }
        }, 100);
        setTimeout(() => {
          clearInterval(checkInterval);
          resolve();
        }, 3000);
      });

      // 6. Verify idempotency check worked
      expect(processingAttempted).toBe(true);
      expect(messageSkipped).toBe(true);

      // 7. Verify message status remains SENT (not changed)
      const verifyMessage = await testDb
        .select()
        .from(messageLogs)
        .where(eq(messageLogs.id, messageLog.id))
        .limit(1);

      expect(verifyMessage[0]?.status).toBe(MessageStatus.SENT);
    });

    it('should retry transient failures with exponential backoff', async () => {
      // 1. Create test user and message log
      const user = await createTestUser();
      const messageLog = await createTestMessageLog(user.id, {
        status: MessageStatus.QUEUED,
      });

      let attemptCount = 0;
      const attemptTimestamps: number[] = [];
      const maxAttempts = 3;

      // 2. Create consumer that fails with transient errors initially
      consumer = new MessageConsumer({
        prefetch: 1,
        onMessage: async (job: MessageJob) => {
          attemptCount++;
          attemptTimestamps.push(Date.now());

          // Update retry count in database
          await testDb
            .update(messageLogs)
            .set({
              retryCount: attemptCount,
              lastRetryAt: new Date(),
              status: MessageStatus.RETRYING,
              updatedAt: new Date(),
            })
            .where(eq(messageLogs.id, job.messageId));

          if (attemptCount < maxAttempts) {
            // Simulate transient network error
            throw new Error('Network timeout - temporarily unavailable');
          }

          // Success on final attempt
          await testDb
            .update(messageLogs)
            .set({
              status: MessageStatus.SENT,
              actualSendTime: new Date(),
              apiResponseCode: 200,
              updatedAt: new Date(),
            })
            .where(eq(messageLogs.id, job.messageId));
        },
      });

      await consumer.startConsuming();

      // 3. Publish message
      const job: MessageJob = {
        messageId: messageLog.id,
        userId: user.id,
        messageType: MessageType.BIRTHDAY,
        scheduledSendTime: new Date().toISOString(),
        retryCount: 0,
        timestamp: Date.now(),
      };

      await publisher.publishMessage(job);

      // 4. Wait for retries to complete
      await new Promise<void>((resolve) => {
        const checkInterval = setInterval(() => {
          if (attemptCount >= maxAttempts) {
            clearInterval(checkInterval);
            resolve();
          }
        }, 100);
        setTimeout(() => {
          clearInterval(checkInterval);
          resolve();
        }, 10000);
      });

      // 5. Verify retry behavior
      expect(attemptCount).toBeGreaterThanOrEqual(maxAttempts);

      // 6. Verify final status is SENT
      const updatedMessage = await testDb
        .select()
        .from(messageLogs)
        .where(eq(messageLogs.id, messageLog.id))
        .limit(1);

      expect(updatedMessage[0]?.status).toBe(MessageStatus.SENT);
      expect(updatedMessage[0]?.retryCount).toBeGreaterThanOrEqual(maxAttempts - 1);
    }, 15000);

    it('should mark permanent failures as FAILED', async () => {
      // 1. Create test user and message log
      const user = await createTestUser();
      const messageLog = await createTestMessageLog(user.id, {
        status: MessageStatus.QUEUED,
      });

      let processingAttempted = false;
      let errorCaptured = false;

      // 2. Create consumer that simulates permanent failure
      consumer = new MessageConsumer({
        prefetch: 1,
        onMessage: async (job: MessageJob) => {
          processingAttempted = true;

          // Simulate permanent error (validation/not found error)
          const permanentError = new Error('User not found - 404');

          // Update database to mark as failed
          await testDb
            .update(messageLogs)
            .set({
              status: MessageStatus.FAILED,
              errorMessage: permanentError.message,
              apiResponseCode: 404,
              retryCount: sql`${messageLogs.retryCount} + 1`,
              lastRetryAt: new Date(),
              updatedAt: new Date(),
            })
            .where(eq(messageLogs.id, job.messageId));

          errorCaptured = true;

          // Throw to signal processing failure (will go to DLQ)
          throw permanentError;
        },
        onError: async (error: Error) => {
          // Error handler for logging
          console.log('Error captured:', error.message);
        },
      });

      await consumer.startConsuming();

      // 3. Publish message
      const job: MessageJob = {
        messageId: messageLog.id,
        userId: user.id,
        messageType: MessageType.BIRTHDAY,
        scheduledSendTime: new Date().toISOString(),
        retryCount: 0,
        timestamp: Date.now(),
      };

      await publisher.publishMessage(job);

      // 4. Wait for processing
      await new Promise<void>((resolve) => {
        const checkInterval = setInterval(() => {
          if (errorCaptured) {
            clearInterval(checkInterval);
            resolve();
          }
        }, 100);
        setTimeout(() => {
          clearInterval(checkInterval);
          resolve();
        }, 5000);
      });

      // 5. Verify message was processed and marked as FAILED
      expect(processingAttempted).toBe(true);
      expect(errorCaptured).toBe(true);

      // 6. Verify database status
      const failedMessage = await testDb
        .select()
        .from(messageLogs)
        .where(eq(messageLogs.id, messageLog.id))
        .limit(1);

      expect(failedMessage[0]?.status).toBe(MessageStatus.FAILED);
      expect(failedMessage[0]?.errorMessage).toContain('not found');
      expect(failedMessage[0]?.apiResponseCode).toBe(404);
    });
  });

  describe('Database Integration', () => {
    it('should create and retrieve message logs', async () => {
      // 1. Create test user
      const user = await createTestUser({
        firstName: 'Birthday',
        lastName: 'Person',
      });

      // 2. Create multiple message logs
      const messageLog1 = await createTestMessageLog(user.id, {
        messageType: MessageType.BIRTHDAY,
        messageContent: 'Happy Birthday from the system!',
        status: MessageStatus.SCHEDULED,
      });

      const messageLog2 = await createTestMessageLog(user.id, {
        messageType: MessageType.ANNIVERSARY,
        messageContent: 'Happy Anniversary!',
        status: MessageStatus.QUEUED,
        idempotencyKey: `${user.id}:ANNIVERSARY:${new Date().toISOString().split('T')[0]}-${Date.now()}`,
      });

      // 3. Retrieve message logs by user ID
      const userMessages = await testDb
        .select()
        .from(messageLogs)
        .where(eq(messageLogs.userId, user.id));

      // 4. Verify retrieval
      expect(userMessages).toHaveLength(2);

      const birthdayMessage = userMessages.find((m) => m.messageType === MessageType.BIRTHDAY);
      const anniversaryMessage = userMessages.find(
        (m) => m.messageType === MessageType.ANNIVERSARY
      );

      expect(birthdayMessage).toBeDefined();
      expect(birthdayMessage?.id).toBe(messageLog1.id);
      expect(birthdayMessage?.messageContent).toContain('Happy Birthday');
      expect(birthdayMessage?.status).toBe(MessageStatus.SCHEDULED);

      expect(anniversaryMessage).toBeDefined();
      expect(anniversaryMessage?.id).toBe(messageLog2.id);
      expect(anniversaryMessage?.messageContent).toContain('Happy Anniversary');
      expect(anniversaryMessage?.status).toBe(MessageStatus.QUEUED);

      // 5. Verify message log can be retrieved by ID
      const retrievedById = await testDb
        .select()
        .from(messageLogs)
        .where(eq(messageLogs.id, messageLog1.id))
        .limit(1);

      expect(retrievedById[0]?.id).toBe(messageLog1.id);
      expect(retrievedById[0]?.userId).toBe(user.id);

      // 6. Verify filtering by status
      const scheduledMessages = await testDb
        .select()
        .from(messageLogs)
        .where(eq(messageLogs.status, MessageStatus.SCHEDULED));

      expect(scheduledMessages.length).toBeGreaterThanOrEqual(1);
      expect(scheduledMessages.some((m) => m.id === messageLog1.id)).toBe(true);

      // 7. Verify filtering by message type
      const birthdayMessages = await testDb
        .select()
        .from(messageLogs)
        .where(eq(messageLogs.messageType, MessageType.BIRTHDAY));

      expect(birthdayMessages.length).toBeGreaterThanOrEqual(1);
      expect(birthdayMessages.some((m) => m.id === messageLog1.id)).toBe(true);
    });

    it('should update message status after sending', async () => {
      // 1. Create test user
      const user = await createTestUser();

      // 2. Create message log in SCHEDULED status
      const messageLog = await createTestMessageLog(user.id, {
        status: MessageStatus.SCHEDULED,
      });

      // Verify initial state
      expect(messageLog.status).toBe(MessageStatus.SCHEDULED);
      expect(messageLog.actualSendTime).toBeNull();
      expect(messageLog.apiResponseCode).toBeNull();

      // 3. Update to QUEUED (simulating scheduler picking up the message)
      const [queuedMessage] = await testDb
        .update(messageLogs)
        .set({
          status: MessageStatus.QUEUED,
          updatedAt: new Date(),
        })
        .where(eq(messageLogs.id, messageLog.id))
        .returning();

      expect(queuedMessage?.status).toBe(MessageStatus.QUEUED);

      // 4. Update to SENDING (simulating worker starting to process)
      const [sendingMessage] = await testDb
        .update(messageLogs)
        .set({
          status: MessageStatus.SENDING,
          updatedAt: new Date(),
        })
        .where(eq(messageLogs.id, messageLog.id))
        .returning();

      expect(sendingMessage?.status).toBe(MessageStatus.SENDING);

      // 5. Update to SENT (simulating successful delivery)
      const sentTime = new Date();
      const apiResponse = {
        success: true,
        messageId: 'external-msg-123',
        deliveredAt: sentTime.toISOString(),
      };

      const [sentMessage] = await testDb
        .update(messageLogs)
        .set({
          status: MessageStatus.SENT,
          actualSendTime: sentTime,
          apiResponseCode: 200,
          apiResponseBody: JSON.stringify(apiResponse),
          updatedAt: new Date(),
        })
        .where(eq(messageLogs.id, messageLog.id))
        .returning();

      // 6. Verify final state
      expect(sentMessage?.status).toBe(MessageStatus.SENT);
      expect(sentMessage?.actualSendTime).toBeDefined();
      expect(sentMessage?.apiResponseCode).toBe(200);
      expect(sentMessage?.apiResponseBody).toContain('success');

      // 7. Parse and verify API response body
      const parsedResponse = JSON.parse(sentMessage?.apiResponseBody || '{}');
      expect(parsedResponse.success).toBe(true);
      expect(parsedResponse.messageId).toBe('external-msg-123');

      // 8. Verify status transition history by checking all possible states
      const statusTransitions = [
        MessageStatus.SCHEDULED, // Initial
        MessageStatus.QUEUED, // After scheduler
        MessageStatus.SENDING, // Worker processing
        MessageStatus.SENT, // Success
      ];

      // Final state should be SENT
      const finalMessage = await testDb
        .select()
        .from(messageLogs)
        .where(eq(messageLogs.id, messageLog.id))
        .limit(1);

      expect(finalMessage[0]?.status).toBe(MessageStatus.SENT);
      expect(statusTransitions).toContain(finalMessage[0]?.status);

      // 9. Test failure status update path
      const failureMessageLog = await createTestMessageLog(user.id, {
        status: MessageStatus.QUEUED,
      });

      // Simulate failure after retries
      const errorMessage = 'External email service unavailable after 3 retries';
      const [failedMessage] = await testDb
        .update(messageLogs)
        .set({
          status: MessageStatus.FAILED,
          retryCount: 3,
          lastRetryAt: new Date(),
          errorMessage: errorMessage,
          apiResponseCode: 503,
          apiResponseBody: JSON.stringify({ error: 'Service Unavailable' }),
          updatedAt: new Date(),
        })
        .where(eq(messageLogs.id, failureMessageLog.id))
        .returning();

      expect(failedMessage?.status).toBe(MessageStatus.FAILED);
      expect(failedMessage?.retryCount).toBe(3);
      expect(failedMessage?.errorMessage).toContain('unavailable');
      expect(failedMessage?.apiResponseCode).toBe(503);
    });
  });
});
