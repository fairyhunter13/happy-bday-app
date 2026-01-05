/**
 * Database URL Configuration Utility
 *
 * Provides a centralized function for constructing database connection URLs
 * with proper environment-based fallbacks and production safety checks.
 */

/**
 * Get the database connection URL from environment variables.
 *
 * Priority:
 * 1. DATABASE_URL environment variable (if set)
 * 2. Constructed URL from individual env vars (development only)
 *
 * @throws {Error} In production if DATABASE_URL is not set
 * @returns {string} PostgreSQL connection URL
 */
export const getDatabaseUrl = (): string => {
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

/**
 * Default development database configuration
 */
export const DEFAULT_DEV_CONFIG = {
  host: 'localhost',
  port: '5432',
  user: 'postgres',
  password: 'postgres',
  database: 'birthday_app',
} as const;
