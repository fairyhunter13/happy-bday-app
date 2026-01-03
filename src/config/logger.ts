import pino from 'pino';
import { env } from './environment.js';

/**
 * Structured logger configuration using Pino
 * Provides high-performance logging with automatic request correlation
 */
const pinoLogger = pino({
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
    paths: [
      'req.headers.authorization',
      'DATABASE_PASSWORD',
      'RABBITMQ_PASSWORD',
      'REDIS_PASSWORD',
    ],
    remove: true,
  },
});

/**
 * Exported logger with standard pino types
 * Note: Pino supports structured logging with (obj, msg) pattern at runtime
 */
export const logger = pinoLogger;

/**
 * Create child logger with additional context
 */
export function createLogger(context: Record<string, unknown>) {
  return pinoLogger.child(context);
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
      rateLimitEnabled: env.RATE_LIMIT_ENABLED,
      rateLimitEnabledRaw: process.env.RATE_LIMIT_ENABLED,
    },
    'Application configuration loaded'
  );
}
