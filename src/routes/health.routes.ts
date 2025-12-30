import type { FastifyInstance } from 'fastify';
import { HealthController } from '../controllers/health.controller.js';
import {
  HealthRouteSchema,
  LivenessRouteSchema,
  ReadinessRouteSchema,
  SchedulerHealthRouteSchema,
} from '../schemas/index.js';

/**
 * Health check routes
 * Provides endpoints for monitoring and orchestration with comprehensive OpenAPI 3.1 documentation
 */
export async function healthRoutes(fastify: FastifyInstance): Promise<void> {
  const healthController = new HealthController();

  // Health check endpoint
  fastify.get('/health', {
    schema: HealthRouteSchema,
    handler: healthController.getHealth.bind(healthController),
  });

  // Readiness probe
  fastify.get('/ready', {
    schema: ReadinessRouteSchema,
    handler: healthController.getReady.bind(healthController),
  });

  // Liveness probe
  fastify.get('/live', {
    schema: LivenessRouteSchema,
    handler: healthController.getLive.bind(healthController),
  });

  // Scheduler health endpoint
  fastify.get('/health/schedulers', {
    schema: SchedulerHealthRouteSchema,
    handler: healthController.getSchedulerHealth.bind(healthController),
  });
}
