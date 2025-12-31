/**
 * Unit tests for Queue Metrics Instrumentation
 *
 * Tests comprehensive metrics collection for RabbitMQ operations including:
 * - Connection and channel event tracking
 * - Message publish/consume instrumentation
 * - Acknowledgment tracking (ack/nack/reject)
 * - Queue depth and consumer monitoring
 */

import { describe, it, expect, beforeEach, afterEach, vi, type Mock } from 'vitest';
import type { Channel, ConsumeMessage } from 'amqplib';
import type { ChannelWrapper } from 'amqp-connection-manager';
import { QueueMetricsInstrumentation } from '../../../src/services/queue/queue-metrics.js';
import { metricsService } from '../../../src/services/metrics.service.js';

// Mock dependencies
vi.mock('../../../src/services/metrics.service.js', () => ({
  metricsService: {
    recordMessagePublishDuration: vi.fn(),
    recordPublisherConfirm: vi.fn(),
    recordMessageConsumeDuration: vi.fn(),
    recordQueueWaitTime: vi.fn(),
    recordMessageAck: vi.fn(),
    recordMessageNack: vi.fn(),
    recordMessageRedelivery: vi.fn(),
    recordChannelOpen: vi.fn(),
    recordChannelClose: vi.fn(),
    recordConnectionRecovery: vi.fn(),
    recordChannelOperationDuration: vi.fn(),
    setQueueDepth: vi.fn(),
    setConsumerCount: vi.fn(),
  },
}));

vi.mock('../../../src/utils/logger.js', () => ({
  logger: {
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

describe('QueueMetricsInstrumentation', () => {
  let instrumentation: QueueMetricsInstrumentation;

  beforeEach(async () => {
    // Create instrumentation with disabled auto-monitoring for tests
    instrumentation = new QueueMetricsInstrumentation({
      queueDepthInterval: 0, // Disable auto-monitoring
      trackConsumerCount: true,
      trackConnectionStatus: true,
      trackMessageDetails: true,
    });

    await instrumentation.initialize();

    // Clear all mocks
    vi.clearAllMocks();
  });

  afterEach(async () => {
    await instrumentation.shutdown();
  });

  describe('Initialization', () => {
    it('should initialize successfully', () => {
      expect(instrumentation.isReady()).toBe(true);
    });

    it('should set initial connection status to disconnected', () => {
      expect(instrumentation.getConnectionStatus()).toBe(0);
    });

    it('should warn on duplicate initialization', async () => {
      const { logger } = await import('../../../src/utils/logger.js');
      await instrumentation.initialize();
      expect(logger.warn).toHaveBeenCalledWith('QueueMetricsInstrumentation already initialized');
    });
  });

  describe('Connection Instrumentation', () => {
    it('should instrument connection events', () => {
      const handlers = instrumentation.instrumentConnection('test-connection');

      expect(handlers).toHaveProperty('onConnect');
      expect(handlers).toHaveProperty('onDisconnect');
      expect(handlers).toHaveProperty('onConnectFailed');
    });

    it('should update connection status on connect', () => {
      const handlers = instrumentation.instrumentConnection('test-connection');
      handlers.onConnect();

      expect(instrumentation.getConnectionStatus()).toBe(1);
      expect(metricsService.recordConnectionRecovery).toHaveBeenCalledWith(
        'test-connection',
        'connect'
      );
    });

    it('should update connection status on disconnect', () => {
      const handlers = instrumentation.instrumentConnection('test-connection');
      handlers.onConnect();
      handlers.onDisconnect();

      expect(instrumentation.getConnectionStatus()).toBe(0);
    });

    it('should update connection status on connect failed', () => {
      const handlers = instrumentation.instrumentConnection('test-connection');
      handlers.onConnectFailed();

      expect(instrumentation.getConnectionStatus()).toBe(0);
    });
  });

  describe('Channel Instrumentation', () => {
    it('should instrument channel events', () => {
      const mockChannelWrapper = {
        on: vi.fn(),
      } as unknown as ChannelWrapper;

      instrumentation.instrumentChannel(mockChannelWrapper, 'test-channel');

      expect(mockChannelWrapper.on).toHaveBeenCalledWith('connect', expect.any(Function));
      expect(mockChannelWrapper.on).toHaveBeenCalledWith('error', expect.any(Function));
      expect(mockChannelWrapper.on).toHaveBeenCalledWith('close', expect.any(Function));
    });

    it('should record channel open event', () => {
      const mockChannelWrapper = {
        on: vi.fn(),
      } as unknown as ChannelWrapper;

      instrumentation.instrumentChannel(mockChannelWrapper, 'test-channel');

      // Get the connect handler
      const connectHandler = (mockChannelWrapper.on as Mock).mock.calls.find(
        (call) => call[0] === 'connect'
      )?.[1];

      // Trigger connect event
      connectHandler?.();

      expect(metricsService.recordChannelOpen).toHaveBeenCalledWith('test-channel');
    });

    it('should record channel close event', () => {
      const mockChannelWrapper = {
        on: vi.fn(),
      } as unknown as ChannelWrapper;

      instrumentation.instrumentChannel(mockChannelWrapper, 'test-channel');

      // Get the close handler
      const closeHandler = (mockChannelWrapper.on as Mock).mock.calls.find(
        (call) => call[0] === 'close'
      )?.[1];

      // Trigger close event
      closeHandler?.();

      expect(metricsService.recordChannelClose).toHaveBeenCalledWith('test-channel', 'normal');
    });

    it('should record channel error event', () => {
      const mockChannelWrapper = {
        on: vi.fn(),
      } as unknown as ChannelWrapper;

      instrumentation.instrumentChannel(mockChannelWrapper, 'test-channel');

      // Get the error handler
      const errorHandler = (mockChannelWrapper.on as Mock).mock.calls.find(
        (call) => call[0] === 'error'
      )?.[1];

      // Trigger error event
      errorHandler?.(new Error('Test error'));

      expect(metricsService.recordChannelClose).toHaveBeenCalledWith('test-channel', 'error');
    });
  });

  describe('Publisher Instrumentation', () => {
    it('should instrument successful publish', async () => {
      const publishFn = vi.fn().mockResolvedValue(undefined);

      await instrumentation.instrumentPublish(
        publishFn,
        'test-exchange',
        'test-routing-key',
        'test-message-id'
      );

      expect(publishFn).toHaveBeenCalled();
      expect(metricsService.recordMessagePublishDuration).toHaveBeenCalledWith(
        'test-exchange',
        'test-routing-key',
        expect.any(Number)
      );
      expect(metricsService.recordPublisherConfirm).toHaveBeenCalledWith('test-exchange', 'success');
    });

    it('should instrument failed publish', async () => {
      const publishFn = vi.fn().mockRejectedValue(new Error('Publish failed'));

      await expect(
        instrumentation.instrumentPublish(
          publishFn,
          'test-exchange',
          'test-routing-key',
          'test-message-id'
        )
      ).rejects.toThrow('Publish failed');

      expect(metricsService.recordMessagePublishDuration).toHaveBeenCalledWith(
        'test-exchange',
        'test-routing-key',
        expect.any(Number)
      );
      expect(metricsService.recordPublisherConfirm).toHaveBeenCalledWith('test-exchange', 'failure');
    });

    it('should track message metadata for latency calculation', async () => {
      const publishFn = vi.fn().mockResolvedValue(undefined);

      await instrumentation.instrumentPublish(
        publishFn,
        'test-exchange',
        'test-routing-key',
        'test-message-id'
      );

      // Verify message was added to tracking (by checking consume will calculate latency)
      const mockMsg = createMockMessage('test-message-id');
      const handlerFn = vi.fn().mockResolvedValue(undefined);

      await instrumentation.instrumentConsume(handlerFn, mockMsg, 'test-queue');

      expect(metricsService.recordQueueWaitTime).toHaveBeenCalledWith(
        'test-queue',
        expect.any(Number)
      );
    });
  });

  describe('Consumer Instrumentation', () => {
    it('should instrument successful consumption', async () => {
      const handlerFn = vi.fn().mockResolvedValue(undefined);
      const mockMsg = createMockMessage('test-message-id');

      await instrumentation.instrumentConsume(handlerFn, mockMsg, 'test-queue');

      expect(handlerFn).toHaveBeenCalled();
      expect(metricsService.recordMessageConsumeDuration).toHaveBeenCalledWith(
        'test-queue',
        'success',
        expect.any(Number)
      );
    });

    it('should instrument failed consumption', async () => {
      const handlerFn = vi.fn().mockRejectedValue(new Error('Handler failed'));
      const mockMsg = createMockMessage('test-message-id');

      await expect(
        instrumentation.instrumentConsume(handlerFn, mockMsg, 'test-queue')
      ).rejects.toThrow('Handler failed');

      expect(metricsService.recordMessageConsumeDuration).toHaveBeenCalledWith(
        'test-queue',
        'failure',
        expect.any(Number)
      );
    });

    it('should calculate queue wait time when metadata exists', async () => {
      // First publish the message to create metadata
      const publishFn = vi.fn().mockResolvedValue(undefined);
      await instrumentation.instrumentPublish(
        publishFn,
        'test-exchange',
        'test-routing-key',
        'test-message-id'
      );

      // Wait a bit to create latency
      await new Promise((resolve) => setTimeout(resolve, 10));

      // Now consume the message
      const handlerFn = vi.fn().mockResolvedValue(undefined);
      const mockMsg = createMockMessage('test-message-id');

      await instrumentation.instrumentConsume(handlerFn, mockMsg, 'test-queue');

      expect(metricsService.recordQueueWaitTime).toHaveBeenCalledWith(
        'test-queue',
        expect.any(Number)
      );

      // Verify wait time is positive
      const waitTime = (metricsService.recordQueueWaitTime as Mock).mock.calls[0][1];
      expect(waitTime).toBeGreaterThan(0);
    });
  });

  describe('Acknowledgment Instrumentation', () => {
    it('should instrument message ack', () => {
      const mockChannel = { ack: vi.fn() } as unknown as Channel;
      const mockMsg = createMockMessage('test-message-id');

      instrumentation.instrumentAck(mockChannel, mockMsg, 'test-queue', 'test-consumer');

      expect(mockChannel.ack).toHaveBeenCalledWith(mockMsg);
      expect(metricsService.recordMessageAck).toHaveBeenCalledWith('test-queue', 'test-consumer');
    });

    it('should clean up metadata after ack', async () => {
      // Create metadata by publishing
      const publishFn = vi.fn().mockResolvedValue(undefined);
      await instrumentation.instrumentPublish(
        publishFn,
        'test-exchange',
        'test-routing-key',
        'test-message-id'
      );

      // Ack the message
      const mockChannel = { ack: vi.fn() } as unknown as Channel;
      const mockMsg = createMockMessage('test-message-id');
      instrumentation.instrumentAck(mockChannel, mockMsg, 'test-queue');

      // Verify metadata is cleaned up (consume won't calculate wait time)
      vi.clearAllMocks();
      const handlerFn = vi.fn().mockResolvedValue(undefined);
      await instrumentation.instrumentConsume(handlerFn, mockMsg, 'test-queue');

      expect(metricsService.recordQueueWaitTime).not.toHaveBeenCalled();
    });

    it('should instrument message nack with requeue', () => {
      const mockChannel = { nack: vi.fn() } as unknown as Channel;
      const mockMsg = createMockMessage('test-message-id');

      instrumentation.instrumentNack(mockChannel, mockMsg, 'test-queue', true, 'transient_error');

      expect(mockChannel.nack).toHaveBeenCalledWith(mockMsg, false, true);
      expect(metricsService.recordMessageNack).toHaveBeenCalledWith('test-queue', 'transient_error');
      expect(metricsService.recordMessageRedelivery).toHaveBeenCalledWith(
        'test-queue',
        'transient_error'
      );
    });

    it('should instrument message nack without requeue', () => {
      const mockChannel = { nack: vi.fn() } as unknown as Channel;
      const mockMsg = createMockMessage('test-message-id');

      instrumentation.instrumentNack(mockChannel, mockMsg, 'test-queue', false, 'permanent_error');

      expect(mockChannel.nack).toHaveBeenCalledWith(mockMsg, false, false);
      expect(metricsService.recordMessageNack).toHaveBeenCalledWith('test-queue', 'permanent_error');
      expect(metricsService.recordMessageRedelivery).not.toHaveBeenCalled();
    });

    it('should instrument message reject', () => {
      const mockChannel = { nack: vi.fn() } as unknown as Channel;
      const mockMsg = createMockMessage('test-message-id');

      instrumentation.instrumentReject(mockChannel, mockMsg, 'test-queue', 'max_retries');

      expect(mockChannel.nack).toHaveBeenCalledWith(mockMsg, false, false);
      expect(metricsService.recordMessageNack).toHaveBeenCalledWith('test-queue', 'reject:max_retries');
    });

    it('should track retry count on nack with requeue', async () => {
      // Create metadata by publishing
      const publishFn = vi.fn().mockResolvedValue(undefined);
      await instrumentation.instrumentPublish(
        publishFn,
        'test-exchange',
        'test-routing-key',
        'test-message-id'
      );

      // Nack with requeue (first retry)
      const mockChannel = { nack: vi.fn() } as unknown as Channel;
      const mockMsg = createMockMessage('test-message-id', 0);

      instrumentation.instrumentNack(mockChannel, mockMsg, 'test-queue', true, 'retry');

      // Verify redelivery was recorded
      expect(metricsService.recordMessageRedelivery).toHaveBeenCalledWith('test-queue', 'retry');
    });
  });

  describe('Queue Depth and Consumer Monitoring', () => {
    it('should update queue depth metric', () => {
      instrumentation.updateQueueDepth('test-queue', 150);

      expect(metricsService.setQueueDepth).toHaveBeenCalledWith('test-queue', 150);
    });

    it('should update consumer count metric', () => {
      instrumentation.updateConsumerCount('test-queue', 5);

      expect(metricsService.setConsumerCount).toHaveBeenCalledWith('test-queue', 5);
    });

    it('should not update consumer count when tracking is disabled', async () => {
      await instrumentation.shutdown();

      const noTrackInstrumentation = new QueueMetricsInstrumentation({
        trackConsumerCount: false,
      });
      await noTrackInstrumentation.initialize();

      noTrackInstrumentation.updateConsumerCount('test-queue', 5);

      expect(metricsService.setConsumerCount).not.toHaveBeenCalled();

      await noTrackInstrumentation.shutdown();
    });
  });

  describe('Channel Operation Instrumentation', () => {
    it('should instrument successful channel operation', async () => {
      const operationFn = vi.fn().mockResolvedValue('result');

      const result = await instrumentation.instrumentChannelOperation('assertQueue', operationFn);

      expect(result).toBe('result');
      expect(operationFn).toHaveBeenCalled();
      expect(metricsService.recordChannelOperationDuration).toHaveBeenCalledWith(
        'assertQueue',
        expect.any(Number)
      );
    });

    it('should instrument failed channel operation', async () => {
      const operationFn = vi.fn().mockRejectedValue(new Error('Operation failed'));

      await expect(
        instrumentation.instrumentChannelOperation('assertExchange', operationFn)
      ).rejects.toThrow('Operation failed');

      expect(metricsService.recordChannelOperationDuration).toHaveBeenCalledWith(
        'assertExchange',
        expect.any(Number)
      );
    });
  });

  describe('Shutdown', () => {
    it('should clean up on shutdown', async () => {
      await instrumentation.shutdown();

      expect(instrumentation.isReady()).toBe(false);
    });

    it('should clear message metadata on shutdown', async () => {
      // Create some metadata
      const publishFn = vi.fn().mockResolvedValue(undefined);
      await instrumentation.instrumentPublish(
        publishFn,
        'test-exchange',
        'test-routing-key',
        'test-message-id'
      );

      await instrumentation.shutdown();

      // Re-initialize
      await instrumentation.initialize();

      // Verify metadata was cleared (consume won't calculate wait time)
      const handlerFn = vi.fn().mockResolvedValue(undefined);
      const mockMsg = createMockMessage('test-message-id');

      await instrumentation.instrumentConsume(handlerFn, mockMsg, 'test-queue');

      expect(metricsService.recordQueueWaitTime).not.toHaveBeenCalled();
    });
  });

  describe('Configuration', () => {
    it('should respect custom configuration', async () => {
      await instrumentation.shutdown();

      const customInstrumentation = new QueueMetricsInstrumentation({
        queueDepthInterval: 60000,
        trackConsumerCount: false,
        trackConnectionStatus: false,
        trackMessageDetails: false,
      });

      await customInstrumentation.initialize();
      expect(customInstrumentation.isReady()).toBe(true);

      await customInstrumentation.shutdown();
    });

    it('should use default configuration when not provided', async () => {
      await instrumentation.shutdown();

      const defaultInstrumentation = new QueueMetricsInstrumentation();
      await defaultInstrumentation.initialize();

      expect(defaultInstrumentation.isReady()).toBe(true);

      await defaultInstrumentation.shutdown();
    });
  });
});

/**
 * Helper function to create mock RabbitMQ message
 */
function createMockMessage(messageId: string, retryCount = 0): ConsumeMessage {
  return {
    content: Buffer.from(JSON.stringify({ data: 'test' })),
    fields: {
      deliveryTag: 1,
      redelivered: retryCount > 0,
      exchange: 'test-exchange',
      routingKey: 'test-routing-key',
      consumerTag: 'test-consumer',
    },
    properties: {
      contentType: 'application/json',
      contentEncoding: undefined,
      headers: {
        'x-retry-count': retryCount,
      },
      deliveryMode: 2,
      priority: undefined,
      correlationId: undefined,
      replyTo: undefined,
      expiration: undefined,
      messageId,
      timestamp: undefined,
      type: undefined,
      userId: undefined,
      appId: undefined,
      clusterId: undefined,
    },
  } as ConsumeMessage;
}
