/**
 * Unit tests for HealthController
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { createTestServer, closeTestServer } from '../../helpers/test-server.js';
import type { FastifyInstance } from 'fastify';

describe('HealthController', () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    app = await createTestServer();
  });

  afterEach(async () => {
    await closeTestServer(app);
  });

  describe('GET /health', () => {
    it('should return health status', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/health',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body).toHaveProperty('status', 'ok');
      expect(body).toHaveProperty('timestamp');
      expect(body).toHaveProperty('uptime');
      expect(body).toHaveProperty('version');
      expect(body).toHaveProperty('services');
      expect(body.services).toHaveProperty('database');
      expect(body.services).toHaveProperty('rabbitmq');
    });

    it('should return valid timestamp format', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/health',
      });

      const body = JSON.parse(response.body);
      const timestamp = new Date(body.timestamp);
      expect(timestamp.toISOString()).toBe(body.timestamp);
    });

    it('should return non-negative uptime', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/health',
      });

      const body = JSON.parse(response.body);
      expect(body.uptime).toBeGreaterThanOrEqual(0);
    });
  });

  describe('GET /ready', () => {
    it('should return readiness status', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/ready',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body).toHaveProperty('status', 'ready');
      expect(body).toHaveProperty('timestamp');
    });
  });

  describe('GET /live', () => {
    it('should return liveness status', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/live',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body).toHaveProperty('status', 'alive');
      expect(body).toHaveProperty('timestamp');
    });
  });
});
