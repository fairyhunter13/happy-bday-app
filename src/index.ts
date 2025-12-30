/**
 * Birthday Message Scheduler - Main Entry Point
 * Production-ready timezone-aware birthday message scheduler
 */

import { startServer, shutdownServer } from './app.js';
import { logger, logStartup } from './config/logger.js';
import { schedulerManager } from './schedulers/index.js';

/**
 * Main application entry point
 */
async function main(): Promise<void> {
  try {
    // Log startup information
    logStartup();

    // Start the server
    const app = await startServer();

    // Start schedulers
    logger.info('Initializing CRON schedulers...');
    await schedulerManager.start();
    logger.info('CRON schedulers initialized successfully');

    // Graceful shutdown handlers
    const signals = ['SIGTERM', 'SIGINT', 'SIGUSR2'] as const;

    signals.forEach((signal) => {
      process.on(signal, async () => {
        logger.info({ signal }, 'Received shutdown signal');

        // Graceful shutdown of schedulers (wait for running jobs)
        logger.info('Shutting down schedulers...');
        await schedulerManager.gracefulShutdown(30000); // 30 second timeout
        logger.info('Schedulers shut down successfully');

        // Shutdown server
        await shutdownServer(app);

        logger.info('Application shut down successfully');
        process.exit(0);
      });
    });

    // Unhandled rejection handler
    process.on('unhandledRejection', (reason, promise) => {
      logger.error(
        {
          reason,
          promise,
        },
        'Unhandled promise rejection'
      );
      // In production, you might want to exit here
      // process.exit(1);
    });

    // Uncaught exception handler
    process.on('uncaughtException', (error) => {
      logger.fatal(error, 'Uncaught exception');
      process.exit(1);
    });
  } catch (error) {
    logger.fatal(error, 'Fatal error during startup');
    process.exit(1);
  }
}

// Start the application
main();
