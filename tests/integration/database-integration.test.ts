import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { PostgresTestContainer, cleanDatabase } from '../helpers/testcontainers';
import { insertUser, findUserByEmail, insertMessageLog } from '../helpers/test-helpers';
import { testUsers } from '../fixtures/users';
import type { Pool } from 'pg';

/**
 * Integration Tests: Database Integration
 *
 * These tests verify database operations with a real PostgreSQL instance
 * using Testcontainers.
 */

describe('Database Integration', () => {
  let postgresContainer: PostgresTestContainer;
  let pool: Pool;

  beforeAll(async () => {
    // Start PostgreSQL container
    postgresContainer = new PostgresTestContainer();
    const { pool: pgPool } = await postgresContainer.start();
    pool = pgPool;

    // Run migrations
    await postgresContainer.runMigrations('./drizzle');
  }, 120000);

  afterAll(async () => {
    await postgresContainer.stop();
  }, 30000);

  beforeEach(async () => {
    // Clean database before each test
    await cleanDatabase(pool);
  });

  describe('user operations', () => {
    it('should insert and retrieve a user', async () => {
      const user = testUsers.johnUtc;

      const inserted = await insertUser(pool, user);

      expect(inserted.id).toBeDefined();
      expect(inserted.email).toBe(user.email);
      expect(inserted.timezone).toBe(user.timezone);

      const retrieved = await findUserByEmail(pool, user.email);
      expect(retrieved).toBeDefined();
      expect(retrieved?.id).toBe(inserted.id);
    });

    it('should handle timezone storage correctly', async () => {
      const timezones = [
        'UTC',
        'America/New_York',
        'Europe/London',
        'Asia/Tokyo',
        'Australia/Sydney',
      ];

      for (const timezone of timezones) {
        const user = { ...testUsers.johnUtc, timezone, email: `user-${timezone}@test.com` };
        const inserted = await insertUser(pool, user);

        const retrieved = await findUserByEmail(pool, user.email);
        expect(retrieved?.timezone).toBe(timezone);
      }
    });

    it('should store birthday dates correctly', async () => {
      const user = testUsers.johnUtc;
      const inserted = await insertUser(pool, user);

      const retrieved = await findUserByEmail(pool, user.email);
      expect(retrieved?.birthdayDate).toBeDefined();

      const originalDate = new Date(user.birthdayDate);
      const retrievedDate = new Date(retrieved!.birthdayDate);

      expect(retrievedDate.getUTCFullYear()).toBe(originalDate.getUTCFullYear());
      expect(retrievedDate.getUTCMonth()).toBe(originalDate.getUTCMonth());
      expect(retrievedDate.getUTCDate()).toBe(originalDate.getUTCDate());
    });

    it('should handle null anniversary dates', async () => {
      const user = { ...testUsers.johnUtc, anniversaryDate: null };
      const inserted = await insertUser(pool, user);

      const retrieved = await findUserByEmail(pool, user.email);
      expect(retrieved?.anniversaryDate).toBeNull();
    });

    it('should enforce unique email constraint', async () => {
      const user = testUsers.johnUtc;

      await insertUser(pool, user);

      // Attempt to insert duplicate
      await expect(insertUser(pool, user)).rejects.toThrow();
    });
  });

  describe('message log operations', () => {
    it('should insert and retrieve message logs', async () => {
      const user = await insertUser(pool, testUsers.johnUtc);

      const messageLog = {
        userId: user.id,
        messageType: 'BIRTHDAY',
        scheduledSendTime: new Date(),
        status: 'SCHEDULED' as const,
        messageContent: 'Happy birthday!',
        idempotencyKey: 'test-key-1',
        retryCount: 0,
      };

      const inserted = await insertMessageLog(pool, messageLog);

      expect(inserted.id).toBeDefined();
      expect(inserted.userId).toBe(user.id);
      expect(inserted.status).toBe('SCHEDULED');
    });

    it('should enforce idempotency key uniqueness', async () => {
      const user = await insertUser(pool, testUsers.johnUtc);

      const messageLog = {
        userId: user.id,
        messageType: 'BIRTHDAY',
        scheduledSendTime: new Date(),
        status: 'SCHEDULED' as const,
        messageContent: 'Happy birthday!',
        idempotencyKey: 'unique-key-123',
        retryCount: 0,
      };

      await insertMessageLog(pool, messageLog);

      // Attempt to insert with same idempotency key
      await expect(insertMessageLog(pool, messageLog)).rejects.toThrow();
    });

    it('should allow same user to have multiple message types', async () => {
      const user = await insertUser(pool, testUsers.aliceLondon);

      const birthdayMessage = {
        userId: user.id,
        messageType: 'BIRTHDAY',
        scheduledSendTime: new Date(),
        status: 'SCHEDULED' as const,
        messageContent: 'Happy birthday!',
        idempotencyKey: `birthday-${user.id}-2025-12-30`,
        retryCount: 0,
      };

      const anniversaryMessage = {
        userId: user.id,
        messageType: 'ANNIVERSARY',
        scheduledSendTime: new Date(),
        status: 'SCHEDULED' as const,
        messageContent: 'Happy anniversary!',
        idempotencyKey: `anniversary-${user.id}-2025-12-30`,
        retryCount: 0,
      };

      const birthday = await insertMessageLog(pool, birthdayMessage);
      const anniversary = await insertMessageLog(pool, anniversaryMessage);

      expect(birthday.id).toBeDefined();
      expect(anniversary.id).toBeDefined();
      expect(birthday.id).not.toBe(anniversary.id);
    });
  });

  describe('query performance', () => {
    it('should find birthdays today efficiently', async () => {
      // Insert 1000 users with random birthdays
      const users = [];
      for (let i = 0; i < 1000; i++) {
        const year = 1980 + (i % 40);
        const month = 1 + (i % 12);
        const day = 1 + (i % 28);

        users.push({
          firstName: `User${i}`,
          lastName: `Test${i}`,
          email: `user${i}@test.com`,
          timezone: 'UTC',
          birthdayDate: new Date(year, month - 1, day),
          anniversaryDate: null,
        });
      }

      for (const user of users) {
        await insertUser(pool, user);
      }

      const today = new Date();
      const month = today.getMonth() + 1;
      const day = today.getDate();

      const startTime = performance.now();

      const result = await pool.query(
        `
        SELECT * FROM users
        WHERE EXTRACT(MONTH FROM birthday_date) = $1
          AND EXTRACT(DAY FROM birthday_date) = $2
          AND deleted_at IS NULL
      `,
        [month, day]
      );

      const endTime = performance.now();
      const duration = endTime - startTime;

      expect(duration).toBeLessThan(100); // Should complete in < 100ms
      expect(result.rows).toBeDefined();
    });

    it('should handle concurrent inserts efficiently', async () => {
      const users = Array.from({ length: 100 }, (_, i) => ({
        firstName: `User${i}`,
        lastName: `Test${i}`,
        email: `concurrent${i}@test.com`,
        timezone: 'UTC',
        birthdayDate: new Date(1990, 0, 1),
        anniversaryDate: null,
      }));

      const startTime = performance.now();

      await Promise.all(users.map((user) => insertUser(pool, user)));

      const endTime = performance.now();
      const duration = endTime - startTime;

      expect(duration).toBeLessThan(5000); // Should complete in < 5 seconds
    });
  });

  describe('transaction handling', () => {
    it('should rollback on error', async () => {
      const client = await pool.connect();

      try {
        await client.query('BEGIN');

        // Insert user
        await client.query(
          'INSERT INTO users (first_name, last_name, email, timezone, birthday_date) VALUES ($1, $2, $3, $4, $5)',
          ['John', 'Doe', 'rollback@test.com', 'UTC', new Date()]
        );

        // Force error with duplicate email
        await client.query(
          'INSERT INTO users (first_name, last_name, email, timezone, birthday_date) VALUES ($1, $2, $3, $4, $5)',
          ['Jane', 'Doe', 'rollback@test.com', 'UTC', new Date()]
        );

        await client.query('COMMIT');
      } catch (error) {
        await client.query('ROLLBACK');
      } finally {
        client.release();
      }

      // Verify user was not inserted
      const result = await findUserByEmail(pool, 'rollback@test.com');
      expect(result).toBeNull();
    });

    it('should commit successful transactions', async () => {
      const client = await pool.connect();

      try {
        await client.query('BEGIN');

        await client.query(
          'INSERT INTO users (first_name, last_name, email, timezone, birthday_date) VALUES ($1, $2, $3, $4, $5)',
          ['John', 'Doe', 'commit@test.com', 'UTC', new Date()]
        );

        await client.query('COMMIT');
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }

      const result = await findUserByEmail(pool, 'commit@test.com');
      expect(result).toBeDefined();
      expect(result?.email).toBe('commit@test.com');
    });
  });
});
