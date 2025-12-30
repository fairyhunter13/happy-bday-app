/**
 * Birthday Message Scheduler - Main Entry Point
 * Production-ready timezone-aware birthday message scheduler
 */

import { startServer, shutdownServer } from './app.js';
import { logger, logStartup } from './config/logger.js';

/**
 * Main application entry point
 */
async function main(): Promise<void> {
  try {
    // Log startup information
    logStartup();

    // Start the server
    const app = await startServer();

    // Graceful shutdown handlers
    const signals = ['SIGTERM', 'SIGINT', 'SIGUSR2'] as const;

    signals.forEach((signal) => {
      process.on(signal, async () => {
        logger.info({ signal }, 'Received shutdown signal');
        await shutdownServer(app);
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
