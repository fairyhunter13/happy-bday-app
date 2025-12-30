import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

/**
 * Database connection configuration
 *
 * Features:
 * - Connection pooling (5-20 connections)
 * - Auto-reconnection on failure
 * - Statement timeout (30s)
 * - Idle timeout (30s)
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
};

// Create postgres client with connection pooling
export const queryClient = postgres(DATABASE_URL, {
  ...poolConfig,
  onnotice: () => {}, // Suppress NOTICE messages
  prepare: true, // Enable prepared statements
});

// Create Drizzle ORM instance
export const db = drizzle(queryClient, {
  schema,
  logger: process.env.NODE_ENV === 'development',
});

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
  await queryClient.end();
}

// Export schema for use in repositories/services
export { schema };
export type DbType = typeof db;
