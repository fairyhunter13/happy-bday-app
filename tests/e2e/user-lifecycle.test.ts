/**
 * User Lifecycle E2E Tests
 *
 * Tests complete user lifecycle scenarios:
 * - User registration → Update → Delete
 * - Multiple users with different timezones
 * - Concurrent operations
 * - Error recovery scenarios
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { createTestServer, closeTestServer } from '../helpers/test-server.js';
import { PostgresTestContainer, cleanDatabase } from '../helpers/testcontainers-optimized.js';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { users } from '../../src/db/schema/users.js';

describe('User Lifecycle E2E Tests', () => {
  let app: FastifyInstance;
  let pgContainer: PostgresTestContainer;
  let queryClient: ReturnType<typeof postgres>;

  beforeAll(async () => {
    pgContainer = new PostgresTestContainer();
    const { connectionString } = await pgContainer.start();

    process.env.DATABASE_URL = connectionString;

    queryClient = postgres(connectionString);
    drizzle(queryClient, { schema: { users } });

    await pgContainer.runMigrations('./drizzle');

    app = await createTestServer({ includeUserRoutes: true });
  }, 120000);

  afterAll(async () => {
    if (app) await closeTestServer(app);
    if (queryClient) await queryClient.end();
    if (pgContainer) await pgContainer.stop();
  });

  beforeEach(async () => {
    await cleanDatabase(pgContainer.getPool());
  });

  describe('Complete User Lifecycle', () => {
    it('should handle full user lifecycle: create → read → update → delete', async () => {
      // 1. Create user
      const createResponse = await app.inject({
        method: 'POST',
        url: '/api/v1/users',
        payload: {
          firstName: 'Alice',
          lastName: 'Johnson',
          email: 'alice@example.com',
          timezone: 'America/New_York',
          birthdayDate: '1992-03-15',
          locationCity: 'New York',
        },
      });

      expect(createResponse.statusCode).toBe(201);
      const user = JSON.parse(createResponse.body).data;
      expect(user.id).toBeDefined();

      // 2. Read user
      const getResponse = await app.inject({
        method: 'GET',
        url: `/api/v1/users/${user.id}`,
      });

      expect(getResponse.statusCode).toBe(200);
      const fetchedUser = JSON.parse(getResponse.body).data;
      expect(fetchedUser.email).toBe('alice@example.com');

      // 3. Update user
      const updateResponse = await app.inject({
        method: 'PUT',
        url: `/api/v1/users/${user.id}`,
        payload: {
          timezone: 'Europe/London',
          anniversaryDate: '2020-05-20',
        },
      });

      expect(updateResponse.statusCode).toBe(200);
      const updatedUser = JSON.parse(updateResponse.body).data;
      expect(updatedUser.timezone).toBe('Europe/London');

      // 4. Delete user
      const deleteResponse = await app.inject({
        method: 'DELETE',
        url: `/api/v1/users/${user.id}`,
      });

      expect(deleteResponse.statusCode).toBe(200);

      // 5. Verify user is deleted
      const getDeletedResponse = await app.inject({
        method: 'GET',
        url: `/api/v1/users/${user.id}`,
      });

      expect(getDeletedResponse.statusCode).toBe(404);
    });

    it('should handle multiple users with different timezones', async () => {
      const usersData = [
        {
          firstName: 'User1',
          lastName: 'NYC',
          email: 'user1@example.com',
          timezone: 'America/New_York',
          birthdayDate: '1990-01-01',
        },
        {
          firstName: 'User2',
          lastName: 'London',
          email: 'user2@example.com',
          timezone: 'Europe/London',
          birthdayDate: '1991-02-02',
        },
        {
          firstName: 'User3',
          lastName: 'Tokyo',
          email: 'user3@example.com',
          timezone: 'Asia/Tokyo',
          birthdayDate: '1992-03-03',
        },
      ];

      const createdUsers = [];

      // Create all users
      for (const userData of usersData) {
        const response = await app.inject({
          method: 'POST',
          url: '/api/v1/users',
          payload: userData,
        });

        expect(response.statusCode).toBe(201);
        createdUsers.push(JSON.parse(response.body).data);
      }

      // Verify all users exist
      for (const user of createdUsers) {
        const response = await app.inject({
          method: 'GET',
          url: `/api/v1/users/${user.id}`,
        });

        expect(response.statusCode).toBe(200);
      }

      expect(createdUsers).toHaveLength(3);
    });

    it('should handle timezone and date updates correctly', async () => {
      // Create user
      const createResponse = await app.inject({
        method: 'POST',
        url: '/api/v1/users',
        payload: {
          firstName: 'Bob',
          lastName: 'Smith',
          email: 'bob@example.com',
          timezone: 'America/Chicago',
          birthdayDate: '1988-06-15',
        },
      });

      const user = JSON.parse(createResponse.body).data;

      // Update timezone and birthday
      const updateResponse = await app.inject({
        method: 'PUT',
        url: `/api/v1/users/${user.id}`,
        payload: {
          timezone: 'America/Los_Angeles',
          birthdayDate: '1988-07-20',
        },
      });

      expect(updateResponse.statusCode).toBe(200);

      const updatedUser = JSON.parse(updateResponse.body).data;
      expect(updatedUser.timezone).toBe('America/Los_Angeles');
    });

    it('should prevent duplicate email across lifecycle', async () => {
      const email = 'unique@example.com';

      // Create first user
      const user1Response = await app.inject({
        method: 'POST',
        url: '/api/v1/users',
        payload: {
          firstName: 'User1',
          lastName: 'Test',
          email: email,
          timezone: 'America/New_York',
        },
      });

      expect(user1Response.statusCode).toBe(201);

      // Try to create duplicate
      const duplicateResponse = await app.inject({
        method: 'POST',
        url: '/api/v1/users',
        payload: {
          firstName: 'User2',
          lastName: 'Test',
          email: email,
          timezone: 'America/New_York',
        },
      });

      expect(duplicateResponse.statusCode).toBe(409);

      // Create second user with different email
      const user2Response = await app.inject({
        method: 'POST',
        url: '/api/v1/users',
        payload: {
          firstName: 'User2',
          lastName: 'Test',
          email: 'different@example.com',
          timezone: 'America/New_York',
        },
      });

      const user2 = JSON.parse(user2Response.body).data;

      // Try to update user2 email to user1's email
      const updateResponse = await app.inject({
        method: 'PUT',
        url: `/api/v1/users/${user2.id}`,
        payload: {
          email: email,
        },
      });

      expect(updateResponse.statusCode).toBe(409);
    });

    it('should handle email reuse after deletion', async () => {
      const email = 'reusable@example.com';

      // Create user
      const createResponse1 = await app.inject({
        method: 'POST',
        url: '/api/v1/users',
        payload: {
          firstName: 'User1',
          lastName: 'Test',
          email: email,
          timezone: 'America/New_York',
        },
      });

      const user1 = JSON.parse(createResponse1.body).data;

      // Delete user
      await app.inject({
        method: 'DELETE',
        url: `/api/v1/users/${user1.id}`,
      });

      // Create new user with same email (should succeed)
      const createResponse2 = await app.inject({
        method: 'POST',
        url: '/api/v1/users',
        payload: {
          firstName: 'User2',
          lastName: 'Test',
          email: email,
          timezone: 'America/New_York',
        },
      });

      expect(createResponse2.statusCode).toBe(201);

      const user2 = JSON.parse(createResponse2.body).data;
      expect(user2.id).not.toBe(user1.id);
      expect(user2.email).toBe(email);
    });
  });

  describe('Concurrent Operations', () => {
    it('should handle concurrent user creation with unique emails', async () => {
      const userPromises = Array.from({ length: 10 }, (_, i) =>
        app.inject({
          method: 'POST',
          url: '/api/v1/users',
          payload: {
            firstName: `User${i}`,
            lastName: 'Test',
            email: `user${i}@example.com`,
            timezone: 'America/New_York',
          },
        })
      );

      const responses = await Promise.all(userPromises);

      // All should succeed
      responses.forEach((response) => {
        expect(response.statusCode).toBe(201);
      });
    });

    it('should handle concurrent updates to same user', async () => {
      // Create user
      const createResponse = await app.inject({
        method: 'POST',
        url: '/api/v1/users',
        payload: {
          firstName: 'Bob',
          lastName: 'Smith',
          email: 'bob@example.com',
          timezone: 'America/New_York',
        },
      });

      const user = JSON.parse(createResponse.body).data;

      // Concurrent updates
      const updatePromises = Array.from({ length: 5 }, (_, i) =>
        app.inject({
          method: 'PUT',
          url: `/api/v1/users/${user.id}`,
          payload: {
            firstName: `Updated${i}`,
          },
        })
      );

      const responses = await Promise.all(updatePromises);

      // All updates should succeed (last write wins)
      responses.forEach((response) => {
        expect(response.statusCode).toBe(200);
      });

      // Verify user still exists and is valid
      const getResponse = await app.inject({
        method: 'GET',
        url: `/api/v1/users/${user.id}`,
      });

      expect(getResponse.statusCode).toBe(200);
    });

    it('should handle race condition on duplicate email creation', async () => {
      const email = 'race@example.com';

      const createPromises = Array.from({ length: 10 }, () =>
        app.inject({
          method: 'POST',
          url: '/api/v1/users',
          payload: {
            firstName: 'User',
            lastName: 'Test',
            email: email,
            timezone: 'America/New_York',
          },
        })
      );

      const responses = await Promise.all(createPromises);

      // Only one should succeed
      const successful = responses.filter((r) => r.statusCode === 201);
      const conflicts = responses.filter((r) => r.statusCode === 409);

      expect(successful).toHaveLength(1);
      expect(conflicts).toHaveLength(9);
    });
  });

  describe('Error Recovery', () => {
    it('should handle invalid data gracefully', async () => {
      const invalidRequests = [
        {
          firstName: '',
          lastName: 'Doe',
          email: 'john@example.com',
          timezone: 'America/New_York',
        },
        {
          firstName: 'John',
          lastName: 'Doe',
          email: 'invalid-email',
          timezone: 'America/New_York',
        },
        {
          firstName: 'John',
          lastName: 'Doe',
          email: 'john@example.com',
          timezone: 'Invalid/Timezone',
        },
      ];

      for (const payload of invalidRequests) {
        const response = await app.inject({
          method: 'POST',
          url: '/api/v1/users',
          payload,
        });

        expect(response.statusCode).toBe(400);
      }
    });

    it('should maintain data integrity after failed operations', async () => {
      // Create user
      const createResponse = await app.inject({
        method: 'POST',
        url: '/api/v1/users',
        payload: {
          firstName: 'John',
          lastName: 'Doe',
          email: 'john@example.com',
          timezone: 'America/New_York',
        },
      });

      const user = JSON.parse(createResponse.body).data;

      // Try invalid update
      await app.inject({
        method: 'PUT',
        url: `/api/v1/users/${user.id}`,
        payload: {
          email: 'invalid-email',
        },
      });

      // Verify user data is unchanged
      const getResponse = await app.inject({
        method: 'GET',
        url: `/api/v1/users/${user.id}`,
      });

      const fetchedUser = JSON.parse(getResponse.body).data;
      expect(fetchedUser.email).toBe('john@example.com');
      expect(fetchedUser.firstName).toBe('John');
    });
  });
});
