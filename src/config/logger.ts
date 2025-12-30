import pino from 'pino';
import { env } from './environment.js';

/**
 * Structured logger configuration using Pino
 * Provides high-performance logging with automatic request correlation
 */
export const logger = pino({
  level: env.LOG_LEVEL,
  transport:
    env.NODE_ENV === 'development'
      ? {
          target: 'pino-pretty',
          options: {
            colorize: true,
            translateTime: 'HH:MM:ss Z',
            ignore: 'pid,hostname',
          },
        }
      : undefined,
  formatters: {
    level: (label) => {
      return { level: label };
    },
  },
  timestamp: pino.stdTimeFunctions.isoTime,
  serializers: {
    req: pino.stdSerializers.req,
    res: pino.stdSerializers.res,
    err: pino.stdSerializers.err,
  },
  redact: {
    paths: ['req.headers.authorization', 'DATABASE_PASSWORD', 'RABBITMQ_PASSWORD', 'REDIS_PASSWORD'],
    remove: true,
  },
});

/**
 * Create child logger with additional context
 */
export function createLogger(context: Record<string, unknown>) {
  return logger.child(context);
}

/**
 * Log startup information
 */
export function logStartup() {
  logger.info(
    {
      env: env.NODE_ENV,
      port: env.PORT,
      host: env.HOST,
    },
    'Application configuration loaded'
  );
}
