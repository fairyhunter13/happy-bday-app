/**
 * Structured logger using Pino
 *
 * Features:
 * - Structured JSON logging
 * - Log levels: trace, debug, info, warn, error, fatal
 * - Pretty printing in development
 * - Performance optimized for production
 */

import pino from 'pino';

const isDevelopment = process.env.NODE_ENV !== 'production';

export const logger = pino({
  level: process.env.LOG_LEVEL || (isDevelopment ? 'debug' : 'info'),
  transport: isDevelopment
    ? {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'HH:MM:ss Z',
          ignore: 'pid,hostname',
        },
      }
    : undefined,
});

export default logger;
