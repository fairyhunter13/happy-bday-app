import type { FastifyReply, FastifyRequest } from 'fastify';
import type { HealthCheckResponse } from '../types/index.js';
import { logger } from '../config/logger.js';
import { version } from '../../package.json' assert { type: 'json' };

/**
 * Health check controller
 * Provides endpoints for monitoring application and service health
 */

export class HealthController {
  /**
   * Basic health check endpoint
   * Returns application uptime and version
   */
  async getHealth(_request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const response: HealthCheckResponse = {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      version,
      services: {
        database: 'healthy', // TODO: Implement actual database health check
        rabbitmq: 'healthy', // TODO: Implement actual RabbitMQ health check
      },
    };

    logger.debug({ response }, 'Health check performed');

    await reply.status(200).send(response);
  }

  /**
   * Readiness probe for Kubernetes/orchestration
   * Checks if the application is ready to accept traffic
   */
  async getReady(_request: FastifyRequest, reply: FastifyReply): Promise<void> {
    // TODO: Implement actual readiness checks
    // - Database connection pool ready
    // - RabbitMQ connection established
    // - Critical services initialized

    const isReady = true; // Placeholder

    if (isReady) {
      await reply.status(200).send({
        status: 'ready',
        timestamp: new Date().toISOString(),
      });
    } else {
      await reply.status(503).send({
        status: 'not_ready',
        timestamp: new Date().toISOString(),
      });
    }
  }

  /**
   * Liveness probe for Kubernetes/orchestration
   * Checks if the application is alive and should not be restarted
   */
  async getLive(_request: FastifyRequest, reply: FastifyReply): Promise<void> {
    // Simple liveness check - if this endpoint responds, the app is alive
    await reply.status(200).send({
      status: 'alive',
      timestamp: new Date().toISOString(),
    });
  }
}
