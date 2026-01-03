/**
 * K6 Performance Testing Utilities
 *
 * Shared utilities for all k6 performance tests.
 */

/**
 * Generate a user ID from the pre-seeded performance test user pool
 *
 * The seed script (src/db/seed-perf.ts) creates 10,000 users with deterministic UUIDs:
 * - Format: 00000000-0000-4000-8000-{index:012d}
 * - Range: 00000000-0000-4000-8000-000000000001 to 00000000-0000-4000-8000-000000010000
 *
 * This function randomly selects a user ID from that pool, ensuring:
 * 1. The user exists in the database (no foreign key constraint violations)
 * 2. Valid UUID format (passes API validation)
 * 3. Realistic load distribution across multiple users
 *
 * @returns {string} A valid UUID from the performance test user pool
 *
 * @example
 * const userId = generatePerformanceUserId();
 * // Returns: "00000000-0000-4000-8000-000000002847"
 */
export function generatePerformanceUserId() {
  // Total users in the pool (must match src/db/seed-perf.ts)
  const TOTAL_USERS = 10000;

  // Generate random index (1 to 10000)
  const userIndex = Math.floor(Math.random() * TOTAL_USERS) + 1;

  // Format: 00000000-0000-4000-8000-{index:012d}
  const UUID_PREFIX = '00000000-0000-4000-8000-';
  const indexStr = userIndex.toString().padStart(12, '0');

  return `${UUID_PREFIX}${indexStr}`;
}

/**
 * Performance test configuration constants
 */
export const PERF_CONFIG = {
  // User pool size (must match seed-perf.ts)
  TOTAL_USERS: 10000,

  // UUID format constants
  UUID_PREFIX: '00000000-0000-4000-8000-',

  // Message types
  MESSAGE_TYPES: ['BIRTHDAY', 'ANNIVERSARY'],
};
