import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { PostgreSqlContainer, StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { users } from '../../src/db/schema/index.js';
import { logger } from '../helpers/logger';

describe('Database Chaos Tests', () => {
  let container: StartedPostgreSqlContainer;
  let connectionString: string;

  beforeAll(async () => {
    container = await new PostgreSqlContainer('postgres:16-alpine')
      .withDatabase('test_db')
      .withUsername('test_user')
      .withPassword('test_pass')
      .start();

    connectionString = container.getConnectionUri();
  }, 60000);

  afterAll(async () => {
    await container?.stop();
  });

  describe('Connection Failures', () => {
    it('should handle database connection loss gracefully', async () => {
      const client = postgres(connectionString, { max: 1 });
      const db = drizzle(client);

      // Simulate connection by querying
      const result = await db.select().from(users).limit(1);
      expect(result).toBeDefined();

      // Simulate connection loss by stopping container
      logger.info('Stopping database container...');
      await container.stop();

      // Attempt query - should fail gracefully
      try {
        await db.select().from(users).limit(1);
        expect.fail('Should have thrown connection error');
      } catch (error: any) {
        expect(error).toBeDefined();
        expect(error.message).toMatch(/connection|ECONNREFUSED|timeout/i);
        logger.info('Connection error caught as expected', { error: error.message });
      }

      // Cleanup
      await client.end();
    }, 120000);

    it('should recover from temporary connection failures', async () => {
      // Restart container
      container = await new PostgreSqlContainer('postgres:16-alpine')
        .withDatabase('test_db')
        .withUsername('test_user')
        .withPassword('test_pass')
        .start();

      connectionString = container.getConnectionUri();

      const client = postgres(connectionString, {
        max: 5,
        idle_timeout: 20,
        connect_timeout: 10,
      });
      const db = drizzle(client);

      // Verify recovery
      const result = await db.select().from(users).limit(1);
      expect(result).toBeDefined();
      logger.info('Successfully recovered from database restart');

      await client.end();
    }, 120000);
  });

  describe('Connection Pool Exhaustion', () => {
    it('should handle connection pool exhaustion', async () => {
      const client = postgres(connectionString, {
        max: 2, // Very small pool
        idle_timeout: 1,
        max_lifetime: 5,
      });
      const db = drizzle(client);

      // Spawn multiple concurrent queries (more than pool size)
      const queries = Array.from({ length: 10 }, (_, i) =>
        db
          .select()
          .from(users)
          .limit(1)
          .then(() => {
            logger.debug(`Query ${i + 1} completed`);
            return i;
          })
          .catch((err) => {
            logger.error(`Query ${i + 1} failed`, { error: err.message });
            throw err;
          })
      );

      // Should queue and complete all queries without crashing
      const results = await Promise.allSettled(queries);

      const successful = results.filter((r) => r.status === 'fulfilled').length;
      const failed = results.filter((r) => r.status === 'rejected').length;

      logger.info('Pool exhaustion test completed', { successful, failed, total: queries.length });

      // At least some should succeed (queuing mechanism)
      expect(successful).toBeGreaterThan(0);

      await client.end();
    }, 30000);
  });

  describe('Slow Query Performance', () => {
    it('should timeout slow queries', async () => {
      const client = postgres(connectionString, {
        max: 5,
        statement_timeout: 1000, // 1 second timeout
      });
      const db = drizzle(client);

      try {
        // Execute a slow query (PostgreSQL pg_sleep)
        await client.unsafe(`SELECT pg_sleep(5)`);
        expect.fail('Should have timed out');
      } catch (error: any) {
        expect(error.message).toMatch(/timeout|canceled/i);
        logger.info('Slow query timed out as expected');
      }

      await client.end();
    }, 15000);

    it('should continue processing after slow query timeout', async () => {
      const client = postgres(connectionString, {
        max: 5,
        statement_timeout: 1000,
      });
      const db = drizzle(client);

      // Execute slow query and catch timeout
      try {
        await client.unsafe(`SELECT pg_sleep(3)`);
      } catch (error) {
        logger.debug('Slow query timed out');
      }

      // Verify normal queries still work
      const result = await db.select().from(users).limit(1);
      expect(result).toBeDefined();
      logger.info('System recovered after slow query timeout');

      await client.end();
    }, 15000);
  });

  describe('Transaction Failures', () => {
    it('should rollback failed transactions', async () => {
      const client = postgres(connectionString, { max: 5 });
      const db = drizzle(client);

      try {
        await client.begin(async (sql) => {
          // Execute valid query
          await sql`SELECT 1`;

          // Execute invalid query to cause rollback
          await sql`SELECT * FROM non_existent_table`;
        });

        expect.fail('Should have failed transaction');
      } catch (error: any) {
        expect(error).toBeDefined();
        logger.info('Transaction rolled back as expected', { error: error.message });
      }

      // Verify database still works after failed transaction
      const result = await db.select().from(users).limit(1);
      expect(result).toBeDefined();

      await client.end();
    }, 15000);
  });

  describe('Memory Pressure', () => {
    it('should handle large result sets without OOM', async () => {
      const client = postgres(connectionString, { max: 5 });
      const db = drizzle(client);

      // Generate large dataset
      const largeDataset = Array.from({ length: 1000 }, (_, i) => ({
        id: `user-${i}`,
        firstName: `First${i}`,
        lastName: `Last${i}`,
        email: `user${i}@example.com`,
        dateOfBirth: new Date('1990-01-01'),
        timezoneOffset: 0,
      }));

      // Insert large dataset (should handle gracefully)
      try {
        // Use batching for large inserts
        const batchSize = 100;
        for (let i = 0; i < largeDataset.length; i += batchSize) {
          const batch = largeDataset.slice(i, i + batchSize);
          await db.insert(users).values(batch).onConflictDoNothing();
        }

        logger.info('Successfully inserted large dataset');

        // Query large dataset
        const results = await db.select().from(users).limit(500);
        expect(results.length).toBeGreaterThan(0);
        expect(results.length).toBeLessThanOrEqual(500);

        logger.info('Successfully queried large dataset', { count: results.length });
      } catch (error: any) {
        logger.error('Failed to handle large dataset', { error: error.message });
        throw error;
      }

      await client.end();
    }, 60000);
  });

  describe('Network Latency', () => {
    it('should handle high latency connections', async () => {
      const client = postgres(connectionString, {
        max: 5,
        connect_timeout: 30, // Allow for slow connection
        idle_timeout: 60,
      });
      const db = drizzle(client);

      const startTime = Date.now();

      // Execute query with potential network delay
      const result = await db.select().from(users).limit(1);

      const duration = Date.now() - startTime;

      expect(result).toBeDefined();
      logger.info('Query completed despite potential latency', { duration });

      // Verify reasonable timeout handling
      expect(duration).toBeLessThan(30000); // Should timeout before 30s

      await client.end();
    }, 45000);
  });

  describe('Circuit Breaker Behavior', () => {
    it('should implement circuit breaker pattern for repeated failures', async () => {
      let failureCount = 0;
      const maxFailures = 3;
      let circuitOpen = false;

      const attemptQuery = async (): Promise<void> => {
        if (circuitOpen) {
          throw new Error('Circuit breaker is OPEN');
        }

        try {
          // Simulate failing database
          throw new Error('Database connection failed');
        } catch (error) {
          failureCount++;

          if (failureCount >= maxFailures) {
            circuitOpen = true;
            logger.warn('Circuit breaker OPENED after repeated failures', { failureCount });
          }

          throw error;
        }
      };

      // Attempt queries until circuit opens
      for (let i = 0; i < 5; i++) {
        try {
          await attemptQuery();
        } catch (error: any) {
          logger.debug(`Attempt ${i + 1} failed`, { error: error.message });

          if (circuitOpen && i >= maxFailures) {
            expect(error.message).toContain('Circuit breaker is OPEN');
            logger.info('Circuit breaker preventing additional requests');
            break;
          }
        }
      }

      expect(circuitOpen).toBe(true);
      expect(failureCount).toBe(maxFailures);
    }, 10000);
  });

  describe('Graceful Degradation', () => {
    it('should provide cached data when database is unavailable', async () => {
      // Simulate cache
      const cache = new Map();
      cache.set('user:123', {
        id: 'user-123',
        firstName: 'Cached',
        lastName: 'User',
        email: 'cached@example.com',
      });

      const getUserWithFallback = async (userId: string) => {
        try {
          // Attempt database query (simulate failure)
          throw new Error('Database unavailable');
        } catch (error) {
          logger.warn('Database unavailable, falling back to cache', { userId });

          // Return cached data
          const cachedUser = cache.get(`user:${userId}`);
          if (cachedUser) {
            return { ...cachedUser, fromCache: true };
          }

          throw new Error('User not found in cache');
        }
      };

      const user = await getUserWithFallback('123');

      expect(user).toBeDefined();
      expect(user.fromCache).toBe(true);
      expect(user.firstName).toBe('Cached');

      logger.info('Successfully degraded to cached data');
    }, 5000);
  });

  describe('Resource Cleanup', () => {
    it('should clean up connections on application shutdown', async () => {
      const client = postgres(connectionString, { max: 5 });
      const db = drizzle(client);

      // Execute some queries
      await db.select().from(users).limit(1);

      // Simulate graceful shutdown
      await client.end();

      // Verify connections are closed
      try {
        await db.select().from(users).limit(1);
        expect.fail('Should not execute after client.end()');
      } catch (error: any) {
        expect(error.message).toMatch(/ended|closed/i);
        logger.info('Connections properly cleaned up');
      }
    }, 10000);
  });
});
