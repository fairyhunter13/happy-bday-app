/**
 * RabbitMQ Connection Manager
 *
 * Uses amqp-connection-manager for:
 * - Automatic reconnection on connection failures
 * - Channel pooling and management
 * - Graceful shutdown handling
 *
 * Design considerations:
 * - Single connection instance (singleton pattern)
 * - Heartbeat: 60s to detect dead connections
 * - Reconnect delay: exponential backoff
 * - Publisher confirms enabled for reliability
 */

import amqp, { type AmqpConnectionManager, type ChannelWrapper } from 'amqp-connection-manager';
import type { Channel } from 'amqplib';
import { logger } from '../utils/logger.js';
import { queueMetricsInstrumentation } from '../services/queue/queue-metrics.js';

export interface RabbitMQConfig {
  url: string;
  heartbeat?: number;
  reconnectTimeout?: number;
}

export class RabbitMQConnection {
  private static instance: RabbitMQConnection | null = null;
  private connection: AmqpConnectionManager | null = null;
  private publisherChannel: ChannelWrapper | null = null;
  private consumerChannel: ChannelWrapper | null = null;
  private isConnected = false;
  private config: RabbitMQConfig;

  private constructor(config: RabbitMQConfig) {
    this.config = {
      heartbeat: 60,
      reconnectTimeout: 5000,
      ...config,
    };
  }

  /**
   * Get singleton instance
   */
  public static getInstance(config?: RabbitMQConfig): RabbitMQConnection {
    if (!RabbitMQConnection.instance) {
      if (!config) {
        throw new Error('RabbitMQConnection not initialized. Provide config on first call.');
      }
      RabbitMQConnection.instance = new RabbitMQConnection(config);
    }
    return RabbitMQConnection.instance;
  }

  /**
   * Connect to RabbitMQ with automatic reconnection
   */
  public async connect(): Promise<void> {
    if (this.isConnected) {
      logger.warn('RabbitMQ connection already established');
      return;
    }

    logger.info({
      msg: 'Connecting to RabbitMQ...',
      url: this.config.url.replace(/:[^:@]*@/, ':****@'),
    });

    // Create connection manager
    this.connection = amqp.connect([this.config.url], {
      heartbeatIntervalInSeconds: this.config.heartbeat,
      reconnectTimeInSeconds: Math.floor((this.config.reconnectTimeout || 5000) / 1000),
    });

    // Get metrics instrumentation handlers
    const metricsHandlers = queueMetricsInstrumentation.instrumentConnection('rabbitmq');

    // Connection event handlers
    this.connection.on('connect', ({ url }) => {
      const sanitizedUrl =
        typeof url === 'string' ? url.replace(/:[^:@]*@/, ':****@') : String(url);
      logger.info({ msg: 'Connected to RabbitMQ', url: sanitizedUrl });
      this.isConnected = true;
      metricsHandlers.onConnect();
    });

    this.connection.on('disconnect', ({ err }) => {
      logger.warn({ msg: 'Disconnected from RabbitMQ', error: err?.message });
      this.isConnected = false;
      metricsHandlers.onDisconnect();
    });

    this.connection.on('connectFailed', ({ err }) => {
      logger.error({ msg: 'Failed to connect to RabbitMQ', error: err?.message });
      this.isConnected = false;
      metricsHandlers.onConnectFailed();
    });

    // Create publisher channel with confirms
    this.publisherChannel = this.connection.createChannel({
      json: false,
      setup: (_channel: Channel) => {
        // Enable publisher confirms for reliability
        // Note: confirmSelect is not available in ChannelWrapper, but publisher confirms
        // are handled by amqp-connection-manager automatically when using channel.publish
        logger.info('Publisher channel configured with confirms');
      },
    });

    // Instrument publisher channel with metrics
    queueMetricsInstrumentation.instrumentChannel(this.publisherChannel, 'publisher');

    // Publisher channel event handlers
    this.publisherChannel.on('error', (err) => {
      logger.error({ msg: 'Publisher channel error', error: err.message });
    });

    this.publisherChannel.on('close', () => {
      logger.warn('Publisher channel closed');
    });

    // Create consumer channel
    this.consumerChannel = this.connection.createChannel({
      json: false,
      setup: (_channel: Channel) => {
        logger.info('Consumer channel configured');
      },
    });

    // Instrument consumer channel with metrics
    queueMetricsInstrumentation.instrumentChannel(this.consumerChannel, 'consumer');

    // Consumer channel event handlers
    this.consumerChannel.on('error', (err) => {
      logger.error({ msg: 'Consumer channel error', error: err.message });
    });

    this.consumerChannel.on('close', () => {
      logger.warn('Consumer channel closed');
    });

    // Wait for initial connection
    await this.waitForConnection();
  }

  /**
   * Wait for connection to be established
   */
  private async waitForConnection(timeout = 30000): Promise<void> {
    const startTime = Date.now();

    while (!this.isConnected && Date.now() - startTime < timeout) {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    if (!this.isConnected) {
      throw new Error('Failed to connect to RabbitMQ within timeout');
    }
  }

  /**
   * Get publisher channel
   */
  public getPublisherChannel(): ChannelWrapper {
    if (!this.publisherChannel) {
      throw new Error('Publisher channel not initialized. Call connect() first.');
    }
    return this.publisherChannel;
  }

  /**
   * Get consumer channel
   */
  public getConsumerChannel(): ChannelWrapper {
    if (!this.consumerChannel) {
      throw new Error('Consumer channel not initialized. Call connect() first.');
    }
    return this.consumerChannel;
  }

  /**
   * Check if connected
   */
  public isHealthy(): boolean {
    return this.isConnected && this.connection !== null;
  }

  /**
   * Health check function
   */
  public async healthCheck(): Promise<{ status: 'healthy' | 'unhealthy'; error?: string }> {
    try {
      if (!this.isConnected || !this.connection) {
        return { status: 'unhealthy', error: 'Not connected' };
      }

      // Use the existing publisher channel to verify connection is healthy
      // waitForConnect will resolve immediately if already connected
      if (this.publisherChannel) {
        await this.publisherChannel.waitForConnect();
      }

      return { status: 'healthy' };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error({ msg: 'RabbitMQ health check failed', error: errorMessage });
      return { status: 'unhealthy', error: errorMessage };
    }
  }

  /**
   * Graceful shutdown
   */
  public async close(): Promise<void> {
    logger.info('Closing RabbitMQ connection...');

    try {
      // Close channels first
      if (this.publisherChannel) {
        await this.publisherChannel.close();
        this.publisherChannel = null;
      }

      if (this.consumerChannel) {
        await this.consumerChannel.close();
        this.consumerChannel = null;
      }

      // Close connection
      if (this.connection) {
        await this.connection.close();
        this.connection = null;
      }

      this.isConnected = false;
      // Reset singleton instance to allow re-initialization
      RabbitMQConnection.instance = null;
      logger.info('RabbitMQ connection closed gracefully');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error({ msg: 'Error closing RabbitMQ connection', error: errorMessage });
      // Still reset instance on error to prevent stale references
      RabbitMQConnection.instance = null;
      throw error;
    }
  }

  /**
   * Reset singleton instance (useful for testing)
   */
  public static resetInstance(): void {
    if (RabbitMQConnection.instance) {
      RabbitMQConnection.instance.isConnected = false;
      RabbitMQConnection.instance.connection = null;
      RabbitMQConnection.instance.publisherChannel = null;
      RabbitMQConnection.instance.consumerChannel = null;
    }
    RabbitMQConnection.instance = null;
  }
}

/**
 * Initialize RabbitMQ connection from environment variables
 */
export async function initializeRabbitMQ(): Promise<RabbitMQConnection> {
  const config: RabbitMQConfig = {
    url: process.env.RABBITMQ_URL || 'amqp://rabbitmq:rabbitmq_dev_password@localhost:5672',
    heartbeat: parseInt(process.env.RABBITMQ_HEARTBEAT || '60', 10),
    reconnectTimeout: parseInt(process.env.RABBITMQ_RECONNECT_TIMEOUT || '5000', 10),
  };

  const rabbitMQ = RabbitMQConnection.getInstance(config);
  await rabbitMQ.connect();

  return rabbitMQ;
}

/**
 * Get existing RabbitMQ connection instance
 */
export function getRabbitMQ(): RabbitMQConnection {
  return RabbitMQConnection.getInstance();
}
