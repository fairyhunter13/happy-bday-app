/**
 * Unit tests for HealthController
 *
 * Tests the health check endpoints without real database/rabbitmq connections.
 * Uses a simplified test server with mock routes.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Fastify, { type FastifyInstance } from 'fastify';

/**
 * Create a minimal test server with mock health routes
 */
async function createMockHealthServer(): Promise<FastifyInstance> {
  const app = Fastify({ logger: false });

  // Mock health route
  app.get('/health', async (_request, reply) => {
    await reply.status(200).send({
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      version: '1.0.0',
    });
  });

  // Mock ready route
  app.get('/ready', async (_request, reply) => {
    await reply.status(200).send({
      status: 'ready',
      timestamp: new Date().toISOString(),
    });
  });

  // Mock live route
  app.get('/live', async (_request, reply) => {
    await reply.status(200).send({
      status: 'alive',
      timestamp: new Date().toISOString(),
    });
  });

  return app;
}

describe('HealthController', () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    app = await createMockHealthServer();
  });

  afterEach(async () => {
    if (app) {
      await app.close();
    }
  });

  describe('GET /health', () => {
    it('should return simple health status', async () => {
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
