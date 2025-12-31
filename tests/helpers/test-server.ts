/**
 * Test server helper
 * Provides utilities for testing Fastify server
 */

import Fastify, { type FastifyInstance } from 'fastify';
import { healthRoutes } from '../../src/routes/health.routes.js';
import { metricsRoutes } from '../../src/routes/metrics.routes.js';

/**
 * Create a test server instance
 * Uses a minimal configuration for unit testing
 */
export async function createTestServer(): Promise<FastifyInstance> {
  const app = Fastify({
    logger: false, // Disable logging in tests
  });

  // Register health routes for testing
  await app.register(healthRoutes);
  await app.register(metricsRoutes);

  return app;
}

/**
 * Close test server
 */
export async function closeTestServer(app: FastifyInstance): Promise<void> {
  if (app) {
    await app.close();
  }
}
