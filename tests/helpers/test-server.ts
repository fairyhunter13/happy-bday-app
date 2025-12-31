/**
 * Test server helper
 * Provides utilities for testing Fastify server
 */

import Fastify, { type FastifyInstance } from 'fastify';
import { healthRoutes } from '../../src/routes/health.routes.js';
import { metricsRoutes } from '../../src/routes/metrics.routes.js';
import { ApplicationError } from '../../src/utils/errors.js';
import type { ErrorResponse } from '../../src/types/index.js';

/**
 * Options for configuring the test server
 */
export interface TestServerOptions {
  /** Include user routes (requires database connection) */
  includeUserRoutes?: boolean;
  /** Enable logging */
  logger?: boolean;
}

/**
 * Create a test server instance
 * Uses a minimal configuration for unit testing
 *
 * @param options - Configuration options for the test server
 */
export async function createTestServer(options: TestServerOptions = {}): Promise<FastifyInstance> {
  const { includeUserRoutes = false, logger = false } = options;

  const app = Fastify({
    logger, // Disable logging in tests by default
  });

  // Global error handler (same as main app)
  app.setErrorHandler(async (error, request, reply) => {
    const err = error as Error;
    const errorResponse: ErrorResponse = {
      error: {
        code: error instanceof ApplicationError ? error.code : 'INTERNAL_SERVER_ERROR',
        message: err.message,
        details: error instanceof ApplicationError ? error.details : undefined,
      },
      timestamp: new Date().toISOString(),
      path: request.url,
    };

    const statusCode = error instanceof ApplicationError ? error.statusCode : 500;

    await reply.status(statusCode).send(errorResponse);
  });

  // Not found handler (same as main app)
  app.setNotFoundHandler(async (request, reply) => {
    const errorResponse: ErrorResponse = {
      error: {
        code: 'NOT_FOUND',
        message: `Route ${request.method}:${request.url} not found`,
      },
      timestamp: new Date().toISOString(),
      path: request.url,
    };

    await reply.status(404).send(errorResponse);
  });

  // Register health routes for testing
  await app.register(healthRoutes);
  await app.register(metricsRoutes);

  // Register user routes if requested (requires database connection)
  if (includeUserRoutes) {
    const { userRoutes } = await import('../../src/routes/user.routes.js');
    await app.register(userRoutes, { prefix: '/api/v1' });
  }

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
