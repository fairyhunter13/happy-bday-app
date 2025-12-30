/**
 * RabbitMQ Queue Configuration
 *
 * Defines:
 * - Exchanges (topic exchange for routing, DLX for failed messages)
 * - Queues (main queue as quorum queue, DLQ for dead letters)
 * - Bindings (routing keys for message routing)
 * - Queue options (TTL, retry limits, etc.)
 *
 * Design considerations:
 * - Quorum queues for zero data loss (requires 3 nodes in production)
 * - Dead letter exchange for failed messages
 * - Topic exchange for flexible routing (e.g., birthday.high_priority, birthday.low_priority)
 */

import type { Options } from 'amqplib';

/**
 * Queue names
 */
export const QUEUES = {
  BIRTHDAY_MESSAGES: process.env.RABBITMQ_QUEUE_NAME || 'birthday.messages.queue',
  BIRTHDAY_DLQ: process.env.RABBITMQ_DLQ_NAME || 'birthday.messages.dlq',
} as const;

/**
 * Exchange names
 */
export const EXCHANGES = {
  BIRTHDAY_MESSAGES: process.env.RABBITMQ_EXCHANGE_NAME || 'birthday.messages',
  BIRTHDAY_DLX: process.env.RABBITMQ_DLX_NAME || 'birthday.messages.dlx',
} as const;

/**
 * Routing keys
 */
export const ROUTING_KEYS = {
  BIRTHDAY: 'birthday',
  ANNIVERSARY: 'anniversary',
  DLQ: 'dlq',
} as const;

/**
 * Queue arguments for Quorum Queue with DLX
 */
export interface QuorumQueueOptions extends Options.AssertQueue {
  durable: true;
  arguments: {
    'x-queue-type': 'quorum';
    'x-dead-letter-exchange': string;
    'x-dead-letter-routing-key'?: string;
    'x-message-ttl'?: number;
    'x-max-length'?: number;
    'x-overflow'?: 'drop-head' | 'reject-publish';
  };
}

/**
 * Main queue configuration (Quorum Queue)
 */
export const MAIN_QUEUE_OPTIONS: QuorumQueueOptions = {
  durable: true,
  arguments: {
    'x-queue-type': 'quorum', // Zero data loss with replication
    'x-dead-letter-exchange': EXCHANGES.BIRTHDAY_DLX,
    'x-dead-letter-routing-key': ROUTING_KEYS.DLQ,
    // Optional: Message TTL (e.g., 24 hours = 86400000 ms)
    // 'x-message-ttl': 86400000,
    // Optional: Max queue length to prevent unbounded growth
    // 'x-max-length': 100000,
    // 'x-overflow': 'reject-publish', // Reject new messages when queue is full
  },
};

/**
 * Dead letter queue configuration (Quorum Queue)
 */
export const DLQ_OPTIONS: QuorumQueueOptions = {
  durable: true,
  arguments: {
    'x-queue-type': 'quorum',
    'x-dead-letter-exchange': '', // No DLX for DLQ (terminal state)
    // Optional: DLQ TTL for cleanup (e.g., 7 days = 604800000 ms)
    // 'x-message-ttl': 604800000,
  },
};

/**
 * Topic exchange configuration
 */
export const TOPIC_EXCHANGE_OPTIONS: Options.AssertExchange = {
  durable: true,
  autoDelete: false,
  internal: false,
};

/**
 * Dead letter exchange configuration (direct exchange)
 */
export const DLX_OPTIONS: Options.AssertExchange = {
  durable: true,
  autoDelete: false,
  internal: false,
};

/**
 * Consumer prefetch count
 * Number of unacknowledged messages per consumer
 */
export const PREFETCH_COUNT = parseInt(process.env.QUEUE_CONCURRENCY || '5', 10);

/**
 * Publisher options for reliable delivery
 */
export const PUBLISHER_OPTIONS: Options.Publish = {
  persistent: true, // deliveryMode: 2 (write to disk)
  contentType: 'application/json',
  mandatory: false, // Don't return unroutable messages (rely on confirms instead)
};

/**
 * Message retry configuration
 */
export const RETRY_CONFIG = {
  MAX_RETRIES: parseInt(process.env.QUEUE_MAX_RETRIES || '5', 10),
  RETRY_DELAY: parseInt(process.env.QUEUE_RETRY_DELAY || '2000', 10), // ms
  RETRY_BACKOFF: process.env.QUEUE_RETRY_BACKOFF || 'exponential', // 'exponential' | 'linear'
} as const;

/**
 * Calculate retry delay with exponential backoff
 */
export function calculateRetryDelay(retryCount: number): number {
  if (RETRY_CONFIG.RETRY_BACKOFF === 'exponential') {
    // Exponential backoff: 2s, 4s, 8s, 16s, 32s
    return RETRY_CONFIG.RETRY_DELAY * Math.pow(2, retryCount);
  }
  // Linear backoff: 2s, 4s, 6s, 8s, 10s
  return RETRY_CONFIG.RETRY_DELAY * (retryCount + 1);
}

/**
 * Queue setup interface
 */
export interface QueueSetup {
  exchanges: {
    name: string;
    type: 'topic' | 'direct' | 'fanout' | 'headers';
    options: Options.AssertExchange;
  }[];
  queues: {
    name: string;
    options: Options.AssertQueue;
  }[];
  bindings: {
    queue: string;
    exchange: string;
    routingKey: string;
  }[];
}

/**
 * Complete queue topology configuration
 */
export const QUEUE_TOPOLOGY: QueueSetup = {
  exchanges: [
    {
      name: EXCHANGES.BIRTHDAY_MESSAGES,
      type: 'topic',
      options: TOPIC_EXCHANGE_OPTIONS,
    },
    {
      name: EXCHANGES.BIRTHDAY_DLX,
      type: 'direct',
      options: DLX_OPTIONS,
    },
  ],
  queues: [
    {
      name: QUEUES.BIRTHDAY_MESSAGES,
      options: MAIN_QUEUE_OPTIONS,
    },
    {
      name: QUEUES.BIRTHDAY_DLQ,
      options: DLQ_OPTIONS,
    },
  ],
  bindings: [
    // Main queue bindings
    {
      queue: QUEUES.BIRTHDAY_MESSAGES,
      exchange: EXCHANGES.BIRTHDAY_MESSAGES,
      routingKey: ROUTING_KEYS.BIRTHDAY,
    },
    {
      queue: QUEUES.BIRTHDAY_MESSAGES,
      exchange: EXCHANGES.BIRTHDAY_MESSAGES,
      routingKey: ROUTING_KEYS.ANNIVERSARY,
    },
    // DLQ binding
    {
      queue: QUEUES.BIRTHDAY_DLQ,
      exchange: EXCHANGES.BIRTHDAY_DLX,
      routingKey: ROUTING_KEYS.DLQ,
    },
  ],
};
