/**
 * Queue module exports
 */

export { RabbitMQConnection, initializeRabbitMQ, getRabbitMQ } from './connection.js';
export { MessagePublisher } from './publisher.js';
export { MessageConsumer } from './consumer.js';
export type { MessageJob, MessageHandler, QueueStats, ConsumerOptions } from './types.js';
export {
  QUEUES,
  EXCHANGES,
  ROUTING_KEYS,
  RETRY_CONFIG,
  PREFETCH_COUNT,
  calculateRetryDelay,
} from './config.js';
