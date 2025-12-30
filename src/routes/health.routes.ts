import type { FastifyInstance } from 'fastify';
import { HealthController } from '../controllers/health.controller.js';

/**
 * Health check routes
 * Provides endpoints for monitoring and orchestration
 */
export async function healthRoutes(fastify: FastifyInstance): Promise<void> {
  const healthController = new HealthController();

  // Health check endpoint
  fastify.get('/health', {
    schema: {
      description: 'Get application health status',
      tags: ['health'],
      response: {
        200: {
          type: 'object',
          properties: {
            status: { type: 'string', enum: ['ok', 'degraded', 'error'] },
            timestamp: { type: 'string', format: 'date-time' },
            uptime: { type: 'number' },
            version: { type: 'string' },
            services: {
              type: 'object',
              properties: {
                database: { type: 'string', enum: ['healthy', 'unhealthy'] },
                rabbitmq: { type: 'string', enum: ['healthy', 'unhealthy'] },
              },
            },
          },
        },
      },
    },
    handler: healthController.getHealth.bind(healthController),
  });

  // Readiness probe
  fastify.get('/ready', {
    schema: {
      description: 'Check if application is ready to accept traffic',
      tags: ['health'],
      response: {
        200: {
          type: 'object',
          properties: {
            status: { type: 'string' },
            timestamp: { type: 'string', format: 'date-time' },
          },
        },
        503: {
          type: 'object',
          properties: {
            status: { type: 'string' },
            timestamp: { type: 'string', format: 'date-time' },
          },
        },
      },
    },
    handler: healthController.getReady.bind(healthController),
  });

  // Liveness probe
  fastify.get('/live', {
    schema: {
      description: 'Check if application is alive',
      tags: ['health'],
      response: {
        200: {
          type: 'object',
          properties: {
            status: { type: 'string' },
            timestamp: { type: 'string', format: 'date-time' },
          },
        },
      },
    },
    handler: healthController.getLive.bind(healthController),
  });
}
