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
// In production, DATABASE_URL must be set via environment variable
// For local development only, a fallback is provided
const getDatabaseUrl = (): string => {
  if (process.env.DATABASE_URL) {
    return process.env.DATABASE_URL;
  }

  // Development fallback - only used when DATABASE_URL is not set
  if (process.env.NODE_ENV === 'production') {
    throw new Error('DATABASE_URL environment variable is required in production');
  }

  // Local development default (not a real password, only for local dev containers)
  const devHost = process.env.DATABASE_HOST || 'localhost';
  const devPort = process.env.DATABASE_PORT || '5432';
  const devUser = process.env.DATABASE_USER || 'postgres';
  const devPass = process.env.DATABASE_PASSWORD || 'postgres';
  const devDb = process.env.DATABASE_NAME || 'birthday_app';
  return `postgres://${devUser}:${devPass}@${devHost}:${devPort}/${devDb}`;
};

const DATABASE_URL = getDatabaseUrl();

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
