/**
 * Test server helper
 * Provides utilities for testing Fastify server
 */

import type { FastifyInstance } from 'fastify';
import { createApp } from '../../src/app.js';

/**
 * Create a test server instance
 */
export async function createTestServer(): Promise<FastifyInstance> {
  const app = await createApp();
  return app;
}

/**
 * Close test server
 */
export async function closeTestServer(app: FastifyInstance): Promise<void> {
  await app.close();
}
