/**
 * Global test setup
 * Runs before all tests
 */

import { beforeAll, afterAll } from 'vitest';

// Set test environment variables
process.env.NODE_ENV = 'test';
process.env.LOG_LEVEL = 'error';
process.env.PORT = '3001';
process.env.HOST = '0.0.0.0';

// Database - will be overridden by test containers
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5433/birthday_test';
process.env.DATABASE_HOST = 'localhost';
process.env.DATABASE_PORT = '5432';
process.env.DATABASE_USER = 'test';
process.env.DATABASE_PASSWORD = 'test';
process.env.DATABASE_NAME = 'birthday_test';
process.env.DATABASE_POOL_MIN = '1';
process.env.DATABASE_POOL_MAX = '5';
process.env.DATABASE_SSL = 'false';

// RabbitMQ - will be overridden by test containers
process.env.RABBITMQ_URL = 'amqp://test:test@localhost:5673';
process.env.RABBITMQ_HOST = 'localhost';
process.env.RABBITMQ_PORT = '5672';
process.env.RABBITMQ_USER = 'test';
process.env.RABBITMQ_PASSWORD = 'test';
process.env.RABBITMQ_VHOST = '/';
process.env.RABBITMQ_QUEUE_NAME = 'birthday-messages';
process.env.RABBITMQ_EXCHANGE_NAME = 'birthday-exchange';
process.env.RABBITMQ_DLX_NAME = 'birthday-dlx';
process.env.RABBITMQ_DLQ_NAME = 'birthday-dlq';

// Optional services
process.env.MESSAGE_API_URL = 'http://localhost:9999/api/messages';
process.env.MESSAGE_SERVICE_TIMEOUT = '10000';

// Queue Configuration
process.env.QUEUE_CONCURRENCY = '5';
process.env.QUEUE_MAX_RETRIES = '3';
process.env.QUEUE_RETRY_DELAY = '1000';
process.env.QUEUE_RETRY_BACKOFF = 'exponential';

// Cron Schedules
process.env.CRON_DAILY_SCHEDULE = '0 0 * * *';
process.env.CRON_MINUTE_SCHEDULE = '* * * * *';
process.env.CRON_RECOVERY_SCHEDULE = '*/10 * * * *';

// Circuit Breaker
process.env.CIRCUIT_BREAKER_TIMEOUT = '10000';
process.env.CIRCUIT_BREAKER_ERROR_THRESHOLD = '50';
process.env.CIRCUIT_BREAKER_RESET_TIMEOUT = '30000';
process.env.CIRCUIT_BREAKER_VOLUME_THRESHOLD = '10';

// Rate Limiting
process.env.RATE_LIMIT_WINDOW_MS = '900000';
process.env.RATE_LIMIT_MAX_REQUESTS = '100';

// Monitoring
process.env.ENABLE_METRICS = 'false';
process.env.METRICS_PORT = '9090';

beforeAll(() => {
  // Global setup before all tests
});

afterAll(() => {
  // Global cleanup after all tests
});
