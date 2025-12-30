/**
 * Worker Entry Point
 *
 * Standalone worker process that:
 * 1. Connects to RabbitMQ
 * 2. Connects to PostgreSQL
 * 3. Starts message consumer
 * 4. Processes messages from queue
 * 5. Handles graceful shutdown
 *
 * Usage:
 *   npm run worker
 *   tsx src/worker.ts
 */

import { initializeRabbitMQ } from './queue/index.js';
import { messageWorker } from './workers/message-worker.js';
import { logger } from './utils/logger.js';

async function main() {
  logger.info('Starting birthday message worker...');

  try {
    // 1. Initialize RabbitMQ connection
    logger.info('Connecting to RabbitMQ...');
    await initializeRabbitMQ();
    logger.info('RabbitMQ connected');

    // 2. Start message worker
    logger.info('Starting message worker...');
    await messageWorker.start();

    logger.info('Worker is running and processing messages');

    // Keep process alive
    process.on('SIGTERM', async () => {
      logger.info('SIGTERM received, shutting down gracefully...');
      await messageWorker.stop();
      process.exit(0);
    });

    process.on('SIGINT', async () => {
      logger.info('SIGINT received, shutting down gracefully...');
      await messageWorker.stop();
      process.exit(0);
    });
  } catch (error) {
    logger.error({
      msg: 'Failed to start worker',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    process.exit(1);
  }
}

// Start worker
main().catch((error) => {
  logger.error({
    msg: 'Unhandled error in worker',
    error: error instanceof Error ? error.message : 'Unknown error',
  });
  process.exit(1);
});
