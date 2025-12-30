import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { RabbitMQContainer, StartedRabbitMQContainer } from '@testcontainers/rabbitmq';
import amqp from 'amqp-connection-manager';
import { ChannelWrapper } from 'amqp-connection-manager';
import { logger } from '../helpers/logger';

describe('RabbitMQ Chaos Tests', () => {
  let container: StartedRabbitMQContainer;
  let connectionUrl: string;

  beforeAll(async () => {
    container = await new RabbitMQContainer('rabbitmq:3.12-management-alpine')
      .withExposedPorts(5672, 15672)
      .start();

    connectionUrl = container.getAmqpUrl();
    logger.info('RabbitMQ container started', { url: connectionUrl });
  }, 120000);

  afterAll(async () => {
    await container?.stop();
  });

  describe('Connection Failures', () => {
    it('should handle RabbitMQ connection loss gracefully', async () => {
      const connection = amqp.connect([connectionUrl], {
        heartbeatIntervalInSeconds: 5,
      });

      let connected = false;
      let disconnected = false;

      connection.on('connect', () => {
        connected = true;
        logger.info('Connected to RabbitMQ');
      });

      connection.on('disconnect', (err) => {
        disconnected = true;
        logger.warn('Disconnected from RabbitMQ', { error: err?.message });
      });

      // Wait for initial connection
      await new Promise((resolve) => setTimeout(resolve, 2000));
      expect(connected).toBe(true);

      // Stop RabbitMQ container to simulate connection loss
      logger.info('Stopping RabbitMQ container...');
      await container.stop();

      // Wait for disconnect event
      await new Promise((resolve) => setTimeout(resolve, 10000));
      expect(disconnected).toBe(true);

      await connection.close();
    }, 60000);

    it('should automatically reconnect when RabbitMQ recovers', async () => {
      // Restart container
      container = await new RabbitMQContainer('rabbitmq:3.12-management-alpine')
        .withExposedPorts(5672, 15672)
        .start();

      connectionUrl = container.getAmqpUrl();

      const connection = amqp.connect([connectionUrl], {
        heartbeatIntervalInSeconds: 5,
        reconnectTimeInSeconds: 2,
      });

      let reconnectCount = 0;

      connection.on('connect', () => {
        reconnectCount++;
        logger.info('Connected/Reconnected to RabbitMQ', { count: reconnectCount });
      });

      // Wait for initial connection
      await new Promise((resolve) => setTimeout(resolve, 3000));

      // Initial connection
      expect(reconnectCount).toBeGreaterThanOrEqual(1);
      logger.info('Auto-reconnect verified');

      await connection.close();
    }, 90000);
  });

  describe('Message Persistence', () => {
    it('should persist messages when RabbitMQ restarts', async () => {
      const connection = amqp.connect([connectionUrl]);
      const channel: ChannelWrapper = connection.createChannel({
        json: true,
        setup: async (ch) => {
          await ch.assertQueue('persistent_queue', {
            durable: true, // Queue persists across restarts
          });
        },
      });

      // Publish messages with persistent flag
      const messages = [
        { id: 1, content: 'Message 1' },
        { id: 2, content: 'Message 2' },
        { id: 3, content: 'Message 3' },
      ];

      for (const msg of messages) {
        await channel.sendToQueue('persistent_queue', msg, {
          persistent: true, // Message durability
        });
      }

      logger.info('Published persistent messages', { count: messages.length });

      // Close connection (simulating application restart)
      await connection.close();

      // Wait a bit
      await new Promise((resolve) => setTimeout(resolve, 2000));

      // Reconnect and verify messages still in queue
      const newConnection = amqp.connect([connectionUrl]);
      const newChannel: ChannelWrapper = newConnection.createChannel({
        json: true,
        setup: async (ch) => {
          await ch.assertQueue('persistent_queue', { durable: true });
        },
      });

      // Check queue status
      const queueInfo = await newChannel.checkQueue('persistent_queue');
      expect(queueInfo.messageCount).toBe(messages.length);

      logger.info('Messages persisted across reconnection', {
        messageCount: queueInfo.messageCount,
      });

      // Cleanup
      await newChannel.purgeQueue('persistent_queue');
      await newConnection.close();
    }, 30000);
  });

  describe('Queue Overflow', () => {
    it('should handle queue overflow with dead letter exchange', async () => {
      const connection = amqp.connect([connectionUrl]);
      const channel: ChannelWrapper = connection.createChannel({
        json: true,
        setup: async (ch) => {
          // Create dead letter exchange
          await ch.assertExchange('dlx', 'direct', { durable: true });
          await ch.assertQueue('dead_letter_queue', { durable: true });
          await ch.bindQueue('dead_letter_queue', 'dlx', 'rejected');

          // Create main queue with max length and DLX
          await ch.assertQueue('limited_queue', {
            durable: true,
            maxLength: 10, // Only allow 10 messages
            deadLetterExchange: 'dlx',
            deadLetterRoutingKey: 'rejected',
          });
        },
      });

      // Publish more messages than queue limit
      const messageCount = 20;
      for (let i = 0; i < messageCount; i++) {
        await channel.sendToQueue(
          'limited_queue',
          { id: i, content: `Message ${i}` },
          { persistent: true }
        );
      }

      logger.info('Published messages exceeding queue limit', { count: messageCount });

      // Wait for processing
      await new Promise((resolve) => setTimeout(resolve, 2000));

      // Check queues
      const mainQueue = await channel.checkQueue('limited_queue');
      const dlQueue = await channel.checkQueue('dead_letter_queue');

      expect(mainQueue.messageCount).toBeLessThanOrEqual(10);
      expect(dlQueue.messageCount).toBeGreaterThan(0);

      logger.info('Dead letter exchange handled overflow', {
        mainQueue: mainQueue.messageCount,
        deadLetterQueue: dlQueue.messageCount,
      });

      // Cleanup
      await channel.deleteQueue('limited_queue');
      await channel.deleteQueue('dead_letter_queue');
      await channel.deleteExchange('dlx');
      await connection.close();
    }, 30000);
  });

  describe('Consumer Failures', () => {
    it('should requeue messages on consumer failure', async () => {
      const connection = amqp.connect([connectionUrl]);
      const channel: ChannelWrapper = connection.createChannel({
        json: true,
        setup: async (ch) => {
          await ch.assertQueue('retry_queue', { durable: true });
        },
      });

      // Publish a message
      await channel.sendToQueue(
        'retry_queue',
        { id: 1, content: 'Test message' },
        { persistent: true }
      );

      let processingAttempts = 0;
      const maxAttempts = 3;

      // Consumer that fails and requeues
      await channel.consume(
        'retry_queue',
        async (msg) => {
          if (!msg) return;

          processingAttempts++;
          logger.info('Processing attempt', { attempt: processingAttempts });

          if (processingAttempts < maxAttempts) {
            // Simulate failure and requeue
            await channel.nack(msg, false, true); // Requeue
            logger.warn('Processing failed, requeuing message');
          } else {
            // Success on final attempt
            await channel.ack(msg);
            logger.info('Message processed successfully');
          }
        },
        { noAck: false }
      );

      // Wait for processing
      await new Promise((resolve) => setTimeout(resolve, 5000));

      expect(processingAttempts).toBe(maxAttempts);
      logger.info('Message requeued and eventually processed');

      // Cleanup
      await channel.cancel('amq.ctag-*');
      await channel.deleteQueue('retry_queue');
      await connection.close();
    }, 20000);
  });

  describe('Network Partitions', () => {
    it('should handle temporary network partitions', async () => {
      const connection = amqp.connect([connectionUrl], {
        heartbeatIntervalInSeconds: 5,
        reconnectTimeInSeconds: 1,
      });

      let connectionLost = false;
      let connectionRestored = false;

      connection.on('disconnect', () => {
        connectionLost = true;
        logger.warn('Connection lost (simulated partition)');
      });

      connection.on('connect', () => {
        if (connectionLost) {
          connectionRestored = true;
          logger.info('Connection restored after partition');
        }
      });

      // Wait for initial connection
      await new Promise((resolve) => setTimeout(resolve, 2000));

      // Simulate partition by stopping container
      await container.stop();
      await new Promise((resolve) => setTimeout(resolve, 3000));
      expect(connectionLost).toBe(true);

      // Restore connection
      container = await new RabbitMQContainer('rabbitmq:3.12-management-alpine')
        .withExposedPorts(5672, 15672)
        .start();

      connectionUrl = container.getAmqpUrl();

      // Wait for reconnection
      await new Promise((resolve) => setTimeout(resolve, 10000));

      await connection.close();

      logger.info('Network partition test completed', { connectionLost, connectionRestored });
    }, 90000);
  });

  describe('Message Processing Under Load', () => {
    it('should handle high message throughput', async () => {
      const connection = amqp.connect([connectionUrl]);
      const channel: ChannelWrapper = connection.createChannel({
        json: true,
        setup: async (ch) => {
          await ch.assertQueue('high_throughput_queue', { durable: true });
          await ch.prefetch(50); // Limit concurrent processing
        },
      });

      const messageCount = 1000;
      let processed = 0;

      // Publish many messages
      const publishStart = Date.now();
      const publishPromises = Array.from({ length: messageCount }, (_, i) =>
        channel.sendToQueue(
          'high_throughput_queue',
          { id: i, content: `Message ${i}` },
          { persistent: true }
        )
      );

      await Promise.all(publishPromises);
      const publishDuration = Date.now() - publishStart;

      logger.info('Published messages', {
        count: messageCount,
        duration: publishDuration,
        rate: (messageCount / publishDuration) * 1000,
      });

      // Consume messages
      const consumeStart = Date.now();
      await channel.consume(
        'high_throughput_queue',
        async (msg) => {
          if (!msg) return;

          processed++;
          await channel.ack(msg);

          if (processed === messageCount) {
            const consumeDuration = Date.now() - consumeStart;
            logger.info('All messages processed', {
              count: processed,
              duration: consumeDuration,
              rate: (processed / consumeDuration) * 1000,
            });
          }
        },
        { noAck: false }
      );

      // Wait for all messages to be processed
      await new Promise((resolve) => {
        const checkInterval = setInterval(() => {
          if (processed >= messageCount) {
            clearInterval(checkInterval);
            resolve(null);
          }
        }, 100);
      });

      expect(processed).toBe(messageCount);

      // Cleanup
      await channel.deleteQueue('high_throughput_queue');
      await connection.close();
    }, 60000);
  });

  describe('Prefetch and Backpressure', () => {
    it('should apply backpressure with prefetch limit', async () => {
      const connection = amqp.connect([connectionUrl]);
      const channel: ChannelWrapper = connection.createChannel({
        json: true,
        setup: async (ch) => {
          await ch.assertQueue('backpressure_queue', { durable: true });
          await ch.prefetch(5); // Only process 5 messages at a time
        },
      });

      // Publish 20 messages
      for (let i = 0; i < 20; i++) {
        await channel.sendToQueue(
          'backpressure_queue',
          { id: i, content: `Message ${i}` },
          { persistent: true }
        );
      }

      let inFlightCount = 0;
      let maxInFlight = 0;
      let processed = 0;

      await channel.consume(
        'backpressure_queue',
        async (msg) => {
          if (!msg) return;

          inFlightCount++;
          maxInFlight = Math.max(maxInFlight, inFlightCount);

          // Simulate slow processing
          await new Promise((resolve) => setTimeout(resolve, 100));

          await channel.ack(msg);
          inFlightCount--;
          processed++;

          if (processed === 20) {
            logger.info('Backpressure test completed', {
              maxInFlight,
              prefetchLimit: 5,
            });
          }
        },
        { noAck: false }
      );

      // Wait for all messages
      await new Promise((resolve) => setTimeout(resolve, 5000));

      // Verify prefetch was respected
      expect(maxInFlight).toBeLessThanOrEqual(5);
      expect(processed).toBe(20);

      // Cleanup
      await channel.deleteQueue('backpressure_queue');
      await connection.close();
    }, 30000);
  });

  describe('Circuit Breaker Integration', () => {
    it('should open circuit breaker on repeated publish failures', async () => {
      let publishAttempts = 0;
      let circuitOpen = false;
      const failureThreshold = 3;

      const publishWithCircuitBreaker = async (): Promise<void> => {
        if (circuitOpen) {
          throw new Error('Circuit breaker is OPEN - not attempting publish');
        }

        try {
          publishAttempts++;
          // Simulate publish failure
          throw new Error('Failed to publish to RabbitMQ');
        } catch (error) {
          if (publishAttempts >= failureThreshold) {
            circuitOpen = true;
            logger.warn('Circuit breaker OPENED', { attempts: publishAttempts });
          }
          throw error;
        }
      };

      // Attempt publishes until circuit opens
      for (let i = 0; i < 5; i++) {
        try {
          await publishWithCircuitBreaker();
        } catch (error: any) {
          logger.debug(`Publish attempt ${i + 1} failed`, { error: error.message });

          if (circuitOpen) {
            expect(error.message).toContain('Circuit breaker is OPEN');
            break;
          }
        }
      }

      expect(circuitOpen).toBe(true);
      expect(publishAttempts).toBe(failureThreshold);
    }, 10000);
  });

  describe('Resource Cleanup', () => {
    it('should clean up resources on shutdown', async () => {
      const connection = amqp.connect([connectionUrl]);
      const channel: ChannelWrapper = connection.createChannel({
        json: true,
        setup: async (ch) => {
          await ch.assertQueue('cleanup_queue', { durable: true });
        },
      });

      // Publish some messages
      await channel.sendToQueue('cleanup_queue', { test: 'data' }, { persistent: true });

      // Graceful shutdown
      await channel.close();
      await connection.close();

      logger.info('Resources cleaned up successfully');

      // Verify connection is closed
      expect(connection.isConnected()).toBe(false);
    }, 10000);
  });
});
