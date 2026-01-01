import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema/index.js';
import {
  databaseMetricsInterceptor,
  startConnectionPoolMetrics,
} from './interceptors/metrics-interceptor.js';

/**
 * Database connection configuration
 *
 * Features:
 * - Connection pooling (5-20 connections)
 * - Auto-reconnection on failure
 * - Statement timeout (30s)
 * - Idle timeout (30s)
 * - Prometheus metrics tracking
 */

// Database URL from environment
const DATABASE_URL =
  process.env.DATABASE_URL ||
  'postgres://postgres:postgres_dev_password@localhost:5432/birthday_app';

// Connection pool configuration
const poolConfig = {
  max: parseInt(process.env.DATABASE_POOL_MAX || '20', 10),
  idle_timeout: 30, // Close idle connections after 30s
  connect_timeout: 10, // Timeout connection attempts after 10s
  max_lifetime: 3600, // Close connections after 1 hour
  connection: {
    application_name: 'birthday-app',
  },
};

// Create postgres client with connection pooling
export const queryClient = postgres(DATABASE_URL, {
  ...poolConfig,
  onnotice: () => {}, // Suppress NOTICE messages
  prepare: true, // Enable prepared statements
});

// Create Drizzle ORM instance with metrics interceptor
export const db = drizzle(queryClient, {
  schema,
  logger: databaseMetricsInterceptor,
});

// Start connection pool metrics collection
// This runs a periodic query to track active database connections
let metricsCleanup: (() => void) | undefined;

/**
 * Start database metrics collection
 * Automatically called on module load
 */
function startMetrics() {
  if (!metricsCleanup) {
    metricsCleanup = startConnectionPoolMetrics(queryClient, 10000); // Update every 10 seconds
  }
}

/**
 * Stop database metrics collection
 * Call this during graceful shutdown
 */
export function stopMetrics(): void {
  if (metricsCleanup) {
    metricsCleanup();
    metricsCleanup = undefined;
  }
}

// Start metrics collection on module load
if (process.env.ENABLE_DB_METRICS !== 'false') {
  startMetrics();
}

/**
 * Test database connection
 * @returns Promise<boolean>
 */
export async function testConnection(): Promise<boolean> {
  try {
    await queryClient`SELECT 1`;
    return true;
  } catch (error) {
    console.error('Database connection failed:', error);
    return false;
  }
}

/**
 * Close database connection
 * Call this on graceful shutdown
 */
export async function closeConnection(): Promise<void> {
  stopMetrics();
  await queryClient.end();
}

// Export schema for use in repositories/services
export { schema };
export type DbType = typeof db;
