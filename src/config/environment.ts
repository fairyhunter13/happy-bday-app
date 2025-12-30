import { z } from 'zod';

/**
 * Environment configuration schema with strict validation
 * All environment variables are validated at startup
 */
const environmentSchema = z.object({
  // Application
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  HOST: z.string().default('0.0.0.0'),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),

  // Database
  DATABASE_URL: z.string().url(),
  DATABASE_HOST: z.string().default('localhost'),
  DATABASE_PORT: z.coerce.number().int().positive().default(5432),
  DATABASE_USER: z.string().min(1),
  DATABASE_PASSWORD: z.string().min(1),
  DATABASE_NAME: z.string().min(1),
  DATABASE_POOL_MIN: z.coerce.number().int().nonnegative().default(5),
  DATABASE_POOL_MAX: z.coerce.number().int().positive().default(20),
  DATABASE_SSL: z.coerce.boolean().default(false),

  // RabbitMQ
  RABBITMQ_URL: z.string().url(),
  RABBITMQ_HOST: z.string().default('localhost'),
  RABBITMQ_PORT: z.coerce.number().int().positive().default(5672),
  RABBITMQ_USER: z.string().min(1),
  RABBITMQ_PASSWORD: z.string().min(1),
  RABBITMQ_VHOST: z.string().default('/'),
  RABBITMQ_QUEUE_NAME: z.string().min(1).default('birthday-messages'),
  RABBITMQ_EXCHANGE_NAME: z.string().min(1).default('birthday-exchange'),
  RABBITMQ_DLX_NAME: z.string().min(1).default('birthday-dlx'),
  RABBITMQ_DLQ_NAME: z.string().min(1).default('birthday-dlq'),

  // Redis (Optional)
  REDIS_URL: z.string().url().optional(),
  REDIS_HOST: z.string().default('localhost'),
  REDIS_PORT: z.coerce.number().int().positive().default(6379),
  REDIS_PASSWORD: z.string().optional(),
  REDIS_DB: z.coerce.number().int().nonnegative().default(0),

  // Email Service (Digital Envision vendor)
  EMAIL_SERVICE_URL: z.string().url().default('https://email-service.digitalenvision.com.au'),
  EMAIL_SERVICE_TIMEOUT: z.coerce.number().int().positive().default(30000),

  // Queue Configuration
  QUEUE_CONCURRENCY: z.coerce.number().int().positive().default(5),
  QUEUE_MAX_RETRIES: z.coerce.number().int().nonnegative().default(5),
  QUEUE_RETRY_DELAY: z.coerce.number().int().positive().default(2000),
  QUEUE_RETRY_BACKOFF: z.enum(['exponential', 'linear', 'fixed']).default('exponential'),

  // CRON Schedules
  CRON_DAILY_SCHEDULE: z.string().default('0 0 * * *'),
  CRON_DAILY_ENABLED: z.string().default('true'),
  CRON_MINUTE_SCHEDULE: z.string().default('* * * * *'),
  CRON_MINUTE_ENABLED: z.string().default('true'),
  CRON_RECOVERY_SCHEDULE: z.string().default('*/10 * * * *'),
  CRON_RECOVERY_ENABLED: z.string().default('true'),

  // Circuit Breaker
  CIRCUIT_BREAKER_TIMEOUT: z.coerce.number().int().positive().default(10000),
  CIRCUIT_BREAKER_ERROR_THRESHOLD: z.coerce.number().int().min(1).max(100).default(50),
  CIRCUIT_BREAKER_RESET_TIMEOUT: z.coerce.number().int().positive().default(30000),
  CIRCUIT_BREAKER_VOLUME_THRESHOLD: z.coerce.number().int().positive().default(10),

  // Rate Limiting
  RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(900000), // 15 minutes
  RATE_LIMIT_MAX_REQUESTS: z.coerce.number().int().positive().default(100),

  // Monitoring
  ENABLE_METRICS: z.coerce.boolean().default(true),
  METRICS_PORT: z.coerce.number().int().positive().default(9090),
});

export type Environment = z.infer<typeof environmentSchema>;

/**
 * Validate and parse environment variables
 * Throws error if validation fails
 */
export function loadEnvironment(): Environment {
  try {
    return environmentSchema.parse(process.env);
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error('Environment validation failed:');
      console.error(error.errors);
      throw new Error('Invalid environment configuration');
    }
    throw error;
  }
}

// Export singleton instance
export const env = loadEnvironment();
