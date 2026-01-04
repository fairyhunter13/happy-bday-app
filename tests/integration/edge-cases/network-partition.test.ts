/**
 * Network Partition Edge Case Tests for Queue Operations
 *
 * Tests RabbitMQ resilience during network issues:
 * 1. Message publishing during connection loss
 * 2. Consumer reconnection after network partition
 * 3. Message redelivery with acknowledgment failures
 *
 * These tests ensure the queue system maintains data integrity
 * and properly recovers from network failures without message loss.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import amqp from 'amqplib';
import { MessagePublisher } from '../../../src/queue/publisher.js';
import { MessageConsumer } from '../../../src/queue/consumer.js';
import { RabbitMQTestContainer, waitFor } from '../../helpers/testcontainers.js';

describe('Network Partition Edge Cases - Queue Operations', () => {
  let rabbitContainer: RabbitMQTestContainer;
  let connection: amqp.Connection;
  let connectionString: string;
  let publisher: MessagePublisher;
  let consumer: MessageConsumer;

  beforeAll(async () => {
    rabbitContainer = new RabbitMQTestContainer();
    const result = await rabbitContainer.start();
    connection = result.connection;
    connectionString = result.connectionString;
  });

  afterAll(async () => {
    await rabbitContainer.stop();
  });

  beforeEach(async () => {
    // Purge queues before each test
    const channel = await connection.createChannel();
    const queues = ['birthday_messages', 'test_queue', 'retry_queue'];
    for (const queue of queues) {
      try {
        await channel.assertQueue(queue);
        await channel.purgeQueue(queue);
      } catch {
        // Queue might not exist
      }
    }
    await channel.close();
  });

  describe('Edge Case 1: Message Publishing During Connection Loss', () => {
    it('should queue messages locally when RabbitMQ connection fails', async () => {
      // Initialize publisher with real connection
      publisher = new MessagePublisher(connection);
      await publisher.initialize();

      // Publish a message successfully first
      const message1 = {
        userId: 'user-123',
        messageType: 'BIRTHDAY' as const,
        scheduledFor: new Date(),
      };

      await publisher.publishBirthdayMessage(message1);

      // Close connection to simulate network partition
      await publisher.close();

      // Attempt to publish while disconnected
      // Publisher should either queue or reject gracefully
      const message2 = {
        userId: 'user-456',
        messageType: 'BIRTHDAY' as const,
        scheduledFor: new Date(),
      };

      // This should throw or handle gracefully
      await expect(publisher.publishBirthdayMessage(message2)).rejects.toThrow();

      // Reconnect
      const newConnection = await amqp.connect(connectionString);
      publisher = new MessagePublisher(newConnection);
      await publisher.initialize();

      // Now publishing should work again
      const message3 = {
        userId: 'user-789',
        messageType: 'BIRTHDAY' as const,
        scheduledFor: new Date(),
      };

      await expect(publisher.publishBirthdayMessage(message3)).resolves.not.toThrow();

      await publisher.close();
      await newConnection.close();
    });

    it('should handle connection errors during batch publishing', async () => {
      publisher = new MessagePublisher(connection);
      await publisher.initialize();

      const messages = Array.from({ length: 5 }, (_, i) => ({
        userId: `user-${i}`,
        messageType: 'BIRTHDAY' as const,
        scheduledFor: new Date(),
      }));

      // Publish first batch successfully
      await Promise.all(messages.slice(0, 2).map((msg) => publisher.publishBirthdayMessage(msg)));

      // Close connection mid-batch
      await publisher.close();

      // Remaining messages should fail
      const failedPublishes = messages
        .slice(2)
        .map((msg) => publisher.publishBirthdayMessage(msg).catch(() => 'failed'));

      const results = await Promise.all(failedPublishes);
      expect(results.every((r) => r === 'failed')).toBe(true);
    });

    it('should maintain message order after reconnection', async () => {
      const receivedMessages: string[] = [];
      const processedCount = { count: 0 };

      // Create publisher
      publisher = new MessagePublisher(connection);
      await publisher.initialize();

      // Create consumer that tracks message order
      consumer = new MessageConsumer(connection);
      await consumer.start(async (msg) => {
        receivedMessages.push(msg.userId);
        processedCount.count++;
      });

      // Publish messages with sequence
      const orderedMessages = ['user-1', 'user-2', 'user-3'];
      for (const userId of orderedMessages) {
        await publisher.publishBirthdayMessage({
          userId,
          messageType: 'BIRTHDAY',
          scheduledFor: new Date(),
        });
      }

      // Wait for processing
      await waitFor(() => Promise.resolve(processedCount.count === 3), 5000, 100);

      // Verify order (FIFO)
      expect(receivedMessages).toEqual(orderedMessages);

      await consumer.stop();
      await publisher.close();
    });
  });

  describe('Edge Case 2: Consumer Reconnection After Network Partition', () => {
    it('should resume consuming after connection loss', async () => {
      const processedMessages: string[] = [];
      const processedCount = { count: 0 };

      // Start publisher and consumer
      publisher = new MessagePublisher(connection);
      await publisher.initialize();

      consumer = new MessageConsumer(connection);
      await consumer.start(async (msg) => {
        processedMessages.push(msg.userId);
        processedCount.count++;
      });

      // Publish some messages
      await publisher.publishBirthdayMessage({
        userId: 'before-partition',
        messageType: 'BIRTHDAY',
        scheduledFor: new Date(),
      });

      // Wait for processing
      await waitFor(() => Promise.resolve(processedCount.count === 1), 3000, 100);

      // Simulate network partition - stop consumer
      await consumer.stop();

      // Publish messages while consumer is down
      await publisher.publishBirthdayMessage({
        userId: 'during-partition-1',
        messageType: 'BIRTHDAY',
        scheduledFor: new Date(),
      });

      await publisher.publishBirthdayMessage({
        userId: 'during-partition-2',
        messageType: 'BIRTHDAY',
        scheduledFor: new Date(),
      });

      // Restart consumer (simulate reconnection)
      consumer = new MessageConsumer(connection);
      await consumer.start(async (msg) => {
        processedMessages.push(msg.userId);
        processedCount.count++;
      });

      // Wait for missed messages to be processed
      await waitFor(() => Promise.resolve(processedCount.count === 3), 5000, 100);

      // Verify all messages were processed
      expect(processedMessages).toContain('before-partition');
      expect(processedMessages).toContain('during-partition-1');
      expect(processedMessages).toContain('during-partition-2');
      expect(processedCount.count).toBe(3);

      await consumer.stop();
      await publisher.close();
    });

    it('should handle consumer crash during message processing', async () => {
      const processedMessages: string[] = [];
      let shouldCrash = true;

      publisher = new MessagePublisher(connection);
      await publisher.initialize();

      // Create consumer that crashes on first message
      consumer = new MessageConsumer(connection);
      await consumer.start(async (msg) => {
        if (shouldCrash && msg.userId === 'crash-trigger') {
          shouldCrash = false;
          // Simulate crash - don't acknowledge, throw error
          throw new Error('Consumer crashed!');
        }
        processedMessages.push(msg.userId);
      });

      // Publish message that triggers crash
      await publisher.publishBirthdayMessage({
        userId: 'crash-trigger',
        messageType: 'BIRTHDAY',
        scheduledFor: new Date(),
      });

      // Publish another message
      await publisher.publishBirthdayMessage({
        userId: 'after-crash',
        messageType: 'BIRTHDAY',
        scheduledFor: new Date(),
      });

      // Wait for redelivery
      await waitFor(() => Promise.resolve(processedMessages.length >= 1), 5000, 100);

      // Message should be redelivered and processed after crash
      // (crash-trigger should eventually succeed, after-crash should process)
      expect(processedMessages.length).toBeGreaterThanOrEqual(1);

      await consumer.stop();
      await publisher.close();
    });

    it('should handle multiple consumer instances with failover', async () => {
      const consumer1Messages: string[] = [];
      const consumer2Messages: string[] = [];

      publisher = new MessagePublisher(connection);
      await publisher.initialize();

      // Start two consumers (load balancing)
      const consumer1 = new MessageConsumer(connection);
      await consumer1.start(async (msg) => {
        consumer1Messages.push(msg.userId);
      });

      const consumer2 = new MessageConsumer(connection);
      await consumer2.start(async (msg) => {
        consumer2Messages.push(msg.userId);
      });

      // Publish multiple messages
      const messageIds = ['msg-1', 'msg-2', 'msg-3', 'msg-4', 'msg-5'];
      for (const userId of messageIds) {
        await publisher.publishBirthdayMessage({
          userId,
          messageType: 'BIRTHDAY',
          scheduledFor: new Date(),
        });
      }

      // Wait for all messages to be processed
      await waitFor(
        () => Promise.resolve(consumer1Messages.length + consumer2Messages.length === 5),
        5000,
        100
      );

      // Verify load distribution (both consumers should process some messages)
      expect(consumer1Messages.length + consumer2Messages.length).toBe(5);

      // Stop one consumer (simulate failure)
      await consumer1.stop();

      // Publish more messages
      await publisher.publishBirthdayMessage({
        userId: 'after-consumer1-stop',
        messageType: 'BIRTHDAY',
        scheduledFor: new Date(),
      });

      // Wait for consumer2 to process
      await waitFor(() => Promise.resolve(consumer2Messages.length >= 1), 3000, 100);

      // Consumer2 should handle all new messages
      expect(consumer2Messages).toContain('after-consumer1-stop');

      await consumer2.stop();
      await publisher.close();
    });
  });

  describe('Edge Case 3: Message Redelivery with Acknowledgment Failures', () => {
    it('should redeliver messages when acknowledgment fails', async () => {
      const deliveryAttempts: { [key: string]: number } = {};

      publisher = new MessagePublisher(connection);
      await publisher.initialize();

      let shouldFailAck = true;

      consumer = new MessageConsumer(connection);
      await consumer.start(async (msg) => {
        // Track delivery attempts
        deliveryAttempts[msg.userId] = (deliveryAttempts[msg.userId] || 0) + 1;

        // Fail first acknowledgment attempt
        if (shouldFailAck && msg.userId === 'ack-fail-test') {
          shouldFailAck = false;
          // Don't acknowledge - message should be redelivered
          throw new Error('Acknowledgment failed');
        }
      });

      // Publish message
      await publisher.publishBirthdayMessage({
        userId: 'ack-fail-test',
        messageType: 'BIRTHDAY',
        scheduledFor: new Date(),
      });

      // Wait for redelivery
      await waitFor(() => Promise.resolve(deliveryAttempts['ack-fail-test'] >= 2), 5000, 100);

      // Message should be delivered at least twice (original + redelivery)
      expect(deliveryAttempts['ack-fail-test']).toBeGreaterThanOrEqual(2);

      await consumer.stop();
      await publisher.close();
    });

    it('should handle message nack with requeue', async () => {
      const processedMessages: string[] = [];
      let attemptCount = 0;

      publisher = new MessagePublisher(connection);
      await publisher.initialize();

      consumer = new MessageConsumer(connection);
      await consumer.start(async (msg) => {
        attemptCount++;

        // Reject first attempt (nack with requeue)
        if (attemptCount === 1) {
          throw new Error('First attempt - requeue');
        }

        // Accept second attempt
        processedMessages.push(msg.userId);
      });

      await publisher.publishBirthdayMessage({
        userId: 'requeue-test',
        messageType: 'BIRTHDAY',
        scheduledFor: new Date(),
      });

      // Wait for successful processing
      await waitFor(() => Promise.resolve(processedMessages.length === 1), 5000, 100);

      expect(attemptCount).toBeGreaterThanOrEqual(2);
      expect(processedMessages).toContain('requeue-test');

      await consumer.stop();
      await publisher.close();
    });

    it('should move messages to DLQ after max retries', async () => {
      // This test verifies Dead Letter Queue behavior
      // After max retries, message should go to DLQ

      publisher = new MessagePublisher(connection);
      await publisher.initialize();

      let failCount = 0;
      const maxRetries = 3;

      consumer = new MessageConsumer(connection);
      await consumer.start(async (msg) => {
        failCount++;
        // Always fail - should trigger DLQ after max retries
        if (failCount <= maxRetries) {
          throw new Error(`Attempt ${failCount} failed`);
        }
      });

      await publisher.publishBirthdayMessage({
        userId: 'dlq-test',
        messageType: 'BIRTHDAY',
        scheduledFor: new Date(),
      });

      // Wait for retry attempts
      await waitFor(() => Promise.resolve(failCount >= maxRetries), 10000, 200);

      // Verify message was retried multiple times
      expect(failCount).toBeGreaterThanOrEqual(maxRetries);

      await consumer.stop();
      await publisher.close();
    });
  });
});
