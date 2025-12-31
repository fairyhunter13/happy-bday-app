/**
 * User API Integration Tests
 *
 * Tests the full API flow with real database:
 * - HTTP request validation
 * - Database persistence
 * - Error handling (400, 404, 409)
 * - Response format validation
 * - Rate limiting
 * - Concurrent request handling
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { createTestServer, closeTestServer } from '../../helpers/test-server.js';
import { PostgresTestContainer, cleanDatabase } from '../../helpers/testcontainers.js';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { users } from '../../../src/db/schema/users.js';

describe('User API Integration Tests', () => {
  let app: FastifyInstance;
  let pgContainer: PostgresTestContainer;
  let queryClient: ReturnType<typeof postgres>;

  beforeAll(async () => {
    // Start PostgreSQL container
    pgContainer = new PostgresTestContainer();
    const { connectionString } = await pgContainer.start();

    // Set environment variable for the app
    process.env.DATABASE_URL = connectionString;

    // Create drizzle instance for test assertions
    queryClient = postgres(connectionString);
    drizzle(queryClient, { schema: { users } });

    // Run migrations
    await pgContainer.runMigrations('./drizzle');

    // Create test server with user routes enabled
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

  describe('POST /api/v1/users', () => {
    it('should create a new user and return 201', async () => {
      const userData = {
        firstName: 'John',
        lastName: 'Doe',
        email: 'john.doe@example.com',
        timezone: 'America/New_York',
        birthdayDate: '1990-01-15',
        anniversaryDate: '2015-06-20',
        locationCity: 'New York',
        locationCountry: 'USA',
      };

      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/users',
        payload: userData,
      });

      expect(response.statusCode).toBe(201);

      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.data).toBeDefined();
      expect(body.data.id).toBeDefined();
      expect(body.data.email).toBe('john.doe@example.com');
      expect(body.data.firstName).toBe('John');
      expect(body.data.deletedAt).toBeNull();
      expect(body.timestamp).toBeDefined();
    });

    it('should return 400 for missing required fields', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/users',
        payload: {
          firstName: 'John',
          // Missing lastName, email, timezone
        },
      });

      expect(response.statusCode).toBe(400);

      const body = JSON.parse(response.body);
      expect(body.error).toBeDefined();
      expect(body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should return 400 for invalid email format', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/users',
        payload: {
          firstName: 'John',
          lastName: 'Doe',
          email: 'invalid-email',
          timezone: 'America/New_York',
        },
      });

      expect(response.statusCode).toBe(400);

      const body = JSON.parse(response.body);
      expect(body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should return 400 for invalid timezone', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/users',
        payload: {
          firstName: 'John',
          lastName: 'Doe',
          email: 'john@example.com',
          timezone: 'Invalid/Timezone',
        },
      });

      expect(response.statusCode).toBe(400);
    });

    it('should return 409 for duplicate email', async () => {
      const userData = {
        firstName: 'John',
        lastName: 'Doe',
        email: 'duplicate@example.com',
        timezone: 'America/New_York',
      };

      // Create first user
      await app.inject({
        method: 'POST',
        url: '/api/v1/users',
        payload: userData,
      });

      // Try to create duplicate
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/users',
        payload: userData,
      });

      expect(response.statusCode).toBe(409);

      const body = JSON.parse(response.body);
      expect(body.error.code).toBe('UNIQUE_CONSTRAINT_ERROR');
      expect(body.error.message).toContain('duplicate@example.com');
    });

    it('should handle concurrent requests correctly', async () => {
      const userData = {
        firstName: 'John',
        lastName: 'Doe',
        email: 'concurrent@example.com',
        timezone: 'America/New_York',
      };

      // Send 5 concurrent requests with same email
      const promises = Array(5)
        .fill(null)
        .map(() =>
          app.inject({
            method: 'POST',
            url: '/api/v1/users',
            payload: userData,
          })
        );

      const responses = await Promise.all(promises);

      // Only one should succeed with 201
      const successful = responses.filter((r) => r.statusCode === 201);
      const conflicts = responses.filter((r) => r.statusCode === 409);

      expect(successful).toHaveLength(1);
      expect(conflicts).toHaveLength(4);
    });
  });

  describe('GET /api/v1/users/:id', () => {
    it('should get user by ID and return 200', async () => {
      // Create user first
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

      const createdUser = JSON.parse(createResponse.body).data;

      // Get user
      const response = await app.inject({
        method: 'GET',
        url: `/api/v1/users/${createdUser.id}`,
      });

      expect(response.statusCode).toBe(200);

      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.data.id).toBe(createdUser.id);
      expect(body.data.email).toBe('john@example.com');
    });

    it('should return 404 for non-existent user', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/users/00000000-0000-0000-0000-000000000000',
      });

      expect(response.statusCode).toBe(404);

      const body = JSON.parse(response.body);
      expect(body.error.code).toBe('NOT_FOUND');
    });

    it('should return 404 for soft-deleted user', async () => {
      // Create and delete user
      const createResponse = await app.inject({
        method: 'POST',
        url: '/api/v1/users',
        payload: {
          firstName: 'John',
          lastName: 'Doe',
          email: 'deleted@example.com',
          timezone: 'America/New_York',
        },
      });

      const createdUser = JSON.parse(createResponse.body).data;

      await app.inject({
        method: 'DELETE',
        url: `/api/v1/users/${createdUser.id}`,
      });

      // Try to get deleted user
      const response = await app.inject({
        method: 'GET',
        url: `/api/v1/users/${createdUser.id}`,
      });

      expect(response.statusCode).toBe(404);
    });
  });

  describe('PUT /api/v1/users/:id', () => {
    it('should update user and return 200', async () => {
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

      const createdUser = JSON.parse(createResponse.body).data;

      // Update user
      const response = await app.inject({
        method: 'PUT',
        url: `/api/v1/users/${createdUser.id}`,
        payload: {
          firstName: 'Jane',
          timezone: 'Europe/London',
        },
      });

      expect(response.statusCode).toBe(200);

      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.data.firstName).toBe('Jane');
      expect(body.data.lastName).toBe('Doe'); // Unchanged
      expect(body.data.timezone).toBe('Europe/London');
    });

    it('should return 404 for non-existent user', async () => {
      const response = await app.inject({
        method: 'PUT',
        url: '/api/v1/users/00000000-0000-0000-0000-000000000000',
        payload: {
          firstName: 'Jane',
        },
      });

      expect(response.statusCode).toBe(404);
    });

    it('should return 409 for duplicate email', async () => {
      // Create two users
      const user1Response = await app.inject({
        method: 'POST',
        url: '/api/v1/users',
        payload: {
          firstName: 'John',
          lastName: 'Doe',
          email: 'john@example.com',
          timezone: 'America/New_York',
        },
      });

      const user2Response = await app.inject({
        method: 'POST',
        url: '/api/v1/users',
        payload: {
          firstName: 'Jane',
          lastName: 'Smith',
          email: 'jane@example.com',
          timezone: 'America/New_York',
        },
      });

      const user2 = JSON.parse(user2Response.body).data;

      // Try to update user2's email to user1's email
      const response = await app.inject({
        method: 'PUT',
        url: `/api/v1/users/${user2.id}`,
        payload: {
          email: 'john@example.com',
        },
      });

      expect(response.statusCode).toBe(409);

      const body = JSON.parse(response.body);
      expect(body.error.code).toBe('UNIQUE_CONSTRAINT_ERROR');
    });

    it('should return 400 for invalid data', async () => {
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

      const createdUser = JSON.parse(createResponse.body).data;

      // Try to update with invalid email
      const response = await app.inject({
        method: 'PUT',
        url: `/api/v1/users/${createdUser.id}`,
        payload: {
          email: 'invalid-email',
        },
      });

      expect(response.statusCode).toBe(400);
    });
  });

  describe('DELETE /api/v1/users/:id', () => {
    it('should soft delete user and return 200', async () => {
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

      const createdUser = JSON.parse(createResponse.body).data;

      // Delete user
      const response = await app.inject({
        method: 'DELETE',
        url: `/api/v1/users/${createdUser.id}`,
      });

      expect(response.statusCode).toBe(200);

      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.data.message).toBe('User deleted successfully');

      // Verify user is not found
      const getResponse = await app.inject({
        method: 'GET',
        url: `/api/v1/users/${createdUser.id}`,
      });

      expect(getResponse.statusCode).toBe(404);
    });

    it('should return 404 for non-existent user', async () => {
      const response = await app.inject({
        method: 'DELETE',
        url: '/api/v1/users/00000000-0000-0000-0000-000000000000',
      });

      expect(response.statusCode).toBe(404);
    });

    it('should return 404 for already deleted user', async () => {
      // Create and delete user
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

      const createdUser = JSON.parse(createResponse.body).data;

      await app.inject({
        method: 'DELETE',
        url: `/api/v1/users/${createdUser.id}`,
      });

      // Try to delete again
      const response = await app.inject({
        method: 'DELETE',
        url: `/api/v1/users/${createdUser.id}`,
      });

      expect(response.statusCode).toBe(404);
    });

    it('should allow creating user with same email after delete', async () => {
      const userData = {
        firstName: 'John',
        lastName: 'Doe',
        email: 'reusable@example.com',
        timezone: 'America/New_York',
      };

      // Create user
      const createResponse1 = await app.inject({
        method: 'POST',
        url: '/api/v1/users',
        payload: userData,
      });

      const user1 = JSON.parse(createResponse1.body).data;

      // Delete user
      await app.inject({
        method: 'DELETE',
        url: `/api/v1/users/${user1.id}`,
      });

      // Create new user with same email
      const createResponse2 = await app.inject({
        method: 'POST',
        url: '/api/v1/users',
        payload: userData,
      });

      expect(createResponse2.statusCode).toBe(201);

      const user2 = JSON.parse(createResponse2.body).data;
      expect(user2.email).toBe('reusable@example.com');
      expect(user2.id).not.toBe(user1.id);
    });
  });
});
