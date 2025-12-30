/**
 * RabbitMQ Integration Tests
 *
 * Tests the complete message queue flow using Testcontainers:
 * 1. Connection management
 * 2. Publisher reliability
 * 3. Consumer processing
 * 4. Dead letter queue handling
 * 5. Reconnection scenarios
 * 6. Worker pool processing
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import { RabbitMQContainer, StartedRabbitMQContainer } from '@testcontainers/rabbitmq';
import {
  RabbitMQConnection,
  MessagePublisher,
  MessageConsumer,
  MessageJob,
  QUEUES,
} from '../../../src/queue/index.js';
import { MessageType } from '../../../src/db/schema/message-logs.js';

describe('RabbitMQ Integration Tests', () => {
  let container: StartedRabbitMQContainer;
  let rabbitMQUrl: string;
  let connection: RabbitMQConnection;

  beforeAll(async () => {
    // Start RabbitMQ container
    container = await new RabbitMQContainer('rabbitmq:3.13-management-alpine')
      .withExposedPorts(5672, 15672)
      .start();

    rabbitMQUrl = container.getAmqpUrl();
    console.log('RabbitMQ container started:', rabbitMQUrl);
  }, 60000); // 60s timeout for container startup

  afterAll(async () => {
    if (connection) {
      await connection.close();
    }
    if (container) {
      await container.stop();
    }
  }, 30000);

  describe('Connection Management', () => {
    it('should connect to RabbitMQ successfully', async () => {
      connection = RabbitMQConnection.getInstance({
        url: rabbitMQUrl,
      });

      await connection.connect();

      expect(connection.isHealthy()).toBe(true);
    });

    it('should perform health check successfully', async () => {
      if (!connection) {
        connection = RabbitMQConnection.getInstance({
          url: rabbitMQUrl,
        });
        await connection.connect();
      }

      const health = await connection.healthCheck();

      expect(health.status).toBe('healthy');
      expect(health.error).toBeUndefined();
    });

    it('should get publisher and consumer channels', async () => {
      if (!connection) {
        connection = RabbitMQConnection.getInstance({
          url: rabbitMQUrl,
        });
        await connection.connect();
      }

      const publisherChannel = connection.getPublisherChannel();
      const consumerChannel = connection.getConsumerChannel();

      expect(publisherChannel).toBeDefined();
      expect(consumerChannel).toBeDefined();
    });
  });

  describe('Publisher', () => {
    let publisher: MessagePublisher;

    beforeEach(async () => {
      if (!connection) {
        connection = RabbitMQConnection.getInstance({
          url: rabbitMQUrl,
        });
        await connection.connect();
      }

      publisher = new MessagePublisher();
      await publisher.initialize();
    });

    it('should publish message successfully', async () => {
      const job: MessageJob = {
        messageId: '123e4567-e89b-12d3-a456-426614174000',
        userId: '456e7890-e89b-12d3-a456-426614174000',
        messageType: MessageType.BIRTHDAY,
        scheduledSendTime: new Date().toISOString(),
        retryCount: 0,
        timestamp: Date.now(),
      };

      await expect(publisher.publishMessage(job)).resolves.not.toThrow();
    });

    it('should publish batch of messages', async () => {
      const jobs: MessageJob[] = [
        {
          messageId: '123e4567-e89b-12d3-a456-426614174001',
          userId: '456e7890-e89b-12d3-a456-426614174001',
          messageType: MessageType.BIRTHDAY,
          scheduledSendTime: new Date().toISOString(),
          retryCount: 0,
          timestamp: Date.now(),
        },
        {
          messageId: '123e4567-e89b-12d3-a456-426614174002',
          userId: '456e7890-e89b-12d3-a456-426614174002',
          messageType: MessageType.ANNIVERSARY,
          scheduledSendTime: new Date().toISOString(),
          retryCount: 0,
          timestamp: Date.now(),
        },
      ];

      const results = await publisher.publishBatch(jobs);

      expect(results).toHaveLength(2);
      expect(results.every((r) => r.success)).toBe(true);
    });

    it('should get queue stats', async () => {
      const stats = await publisher.getQueueStats(QUEUES.BIRTHDAY_MESSAGES);

      expect(stats).toBeDefined();
      expect(stats.messages).toBeGreaterThanOrEqual(0);
      expect(stats.consumers).toBeGreaterThanOrEqual(0);
    });

    it('should validate message before publishing', async () => {
      const invalidJob = {
        messageId: 'invalid-uuid',
        userId: '456e7890-e89b-12d3-a456-426614174000',
        messageType: 'INVALID_TYPE',
        scheduledSendTime: new Date().toISOString(),
        retryCount: 0,
        timestamp: Date.now(),
      } as unknown as MessageJob;

      await expect(publisher.publishMessage(invalidJob)).rejects.toThrow();
    });
  });

  describe('Consumer', () => {
    let publisher: MessagePublisher;
    let consumer: MessageConsumer;
    let processedJobs: MessageJob[] = [];

    beforeEach(async () => {
      if (!connection) {
        connection = RabbitMQConnection.getInstance({
          url: rabbitMQUrl,
        });
        await connection.connect();
      }

      publisher = new MessagePublisher();
      await publisher.initialize();

      processedJobs = [];
    });

    afterEach(async () => {
      if (consumer && consumer.isRunning()) {
        await consumer.stopConsuming();
      }
    });

    it('should consume and process messages', async () => {
      // Setup consumer
      consumer = new MessageConsumer({
        prefetch: 1,
        onMessage: async (job) => {
          processedJobs.push(job);
        },
      });

      await consumer.startConsuming();

      // Publish test message
      const job: MessageJob = {
        messageId: '123e4567-e89b-12d3-a456-426614174003',
        userId: '456e7890-e89b-12d3-a456-426614174003',
        messageType: MessageType.BIRTHDAY,
        scheduledSendTime: new Date().toISOString(),
        retryCount: 0,
        timestamp: Date.now(),
      };

      await publisher.publishMessage(job);

      // Wait for message processing
      await new Promise((resolve) => setTimeout(resolve, 1000));

      expect(processedJobs).toHaveLength(1);
      expect(processedJobs[0]?.messageId).toBe(job.messageId);
    });

    it('should handle processing errors with retry', async () => {
      let attemptCount = 0;
      const maxAttempts = 3;

      consumer = new MessageConsumer({
        prefetch: 1,
        onMessage: async (job) => {
          attemptCount++;
          if (attemptCount < maxAttempts) {
            throw new Error('Simulated transient error');
          }
          processedJobs.push(job);
        },
      });

      await consumer.startConsuming();

      // Publish test message
      const job: MessageJob = {
        messageId: '123e4567-e89b-12d3-a456-426614174004',
        userId: '456e7890-e89b-12d3-a456-426614174004',
        messageType: MessageType.BIRTHDAY,
        scheduledSendTime: new Date().toISOString(),
        retryCount: 0,
        timestamp: Date.now(),
      };

      await publisher.publishMessage(job);

      // Wait for message processing with retries
      await new Promise((resolve) => setTimeout(resolve, 3000));

      expect(attemptCount).toBeGreaterThanOrEqual(maxAttempts);
      expect(processedJobs).toHaveLength(1);
    });

    it('should stop consuming gracefully', async () => {
      consumer = new MessageConsumer({
        prefetch: 1,
        onMessage: async (job) => {
          processedJobs.push(job);
        },
      });

      await consumer.startConsuming();
      expect(consumer.isRunning()).toBe(true);

      await consumer.stopConsuming();
      expect(consumer.isRunning()).toBe(false);
    });
  });

  describe('Dead Letter Queue', () => {
    let publisher: MessagePublisher;
    let consumer: MessageConsumer;

    beforeEach(async () => {
      if (!connection) {
        connection = RabbitMQConnection.getInstance({
          url: rabbitMQUrl,
        });
        await connection.connect();
      }

      publisher = new MessagePublisher();
      await publisher.initialize();
    });

    afterEach(async () => {
      if (consumer && consumer.isRunning()) {
        await consumer.stopConsuming();
      }
    });

    it('should send failed messages to DLQ after max retries', async () => {
      let attemptCount = 0;

      consumer = new MessageConsumer({
        prefetch: 1,
        onMessage: async () => {
          attemptCount++;
          throw new Error('Simulated permanent error');
        },
      });

      await consumer.startConsuming();

      // Publish test message
      const job: MessageJob = {
        messageId: '123e4567-e89b-12d3-a456-426614174005',
        userId: '456e7890-e89b-12d3-a456-426614174005',
        messageType: MessageType.BIRTHDAY,
        scheduledSendTime: new Date().toISOString(),
        retryCount: 0,
        timestamp: Date.now(),
      };

      await publisher.publishMessage(job);

      // Wait for retries and DLQ routing
      await new Promise((resolve) => setTimeout(resolve, 5000));

      // Verify message was processed multiple times
      expect(attemptCount).toBeGreaterThan(1);

      // Check DLQ has message (would require inspecting DLQ)
      const dlqStats = await publisher.getQueueStats(QUEUES.BIRTHDAY_DLQ);
      expect(dlqStats.messages).toBeGreaterThan(0);
    });
  });

  describe('Publish-Consume Flow', () => {
    it('should complete full publish-consume-ack cycle', async () => {
      if (!connection) {
        connection = RabbitMQConnection.getInstance({
          url: rabbitMQUrl,
        });
        await connection.connect();
      }

      const publisher = new MessagePublisher();
      await publisher.initialize();

      const processedJobs: MessageJob[] = [];
      const consumer = new MessageConsumer({
        prefetch: 5,
        onMessage: async (job) => {
          processedJobs.push(job);
        },
      });

      await consumer.startConsuming();

      // Publish multiple messages
      const jobs: MessageJob[] = Array.from({ length: 10 }, (_, i) => ({
        messageId: `123e4567-e89b-12d3-a456-42661417${String(i).padStart(4, '0')}`,
        userId: `456e7890-e89b-12d3-a456-42661417${String(i).padStart(4, '0')}`,
        messageType: i % 2 === 0 ? MessageType.BIRTHDAY : MessageType.ANNIVERSARY,
        scheduledSendTime: new Date().toISOString(),
        retryCount: 0,
        timestamp: Date.now(),
      }));

      await publisher.publishBatch(jobs);

      // Wait for all messages to be processed
      await new Promise((resolve) => setTimeout(resolve, 3000));

      expect(processedJobs).toHaveLength(10);

      await consumer.stopConsuming();
    });
  });
});
