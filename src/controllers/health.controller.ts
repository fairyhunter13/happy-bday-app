import type { FastifyReply, FastifyRequest } from 'fastify';
import { healthCheckService, type HealthCheckService } from '../services/health-check.service.js';
import { dailyBirthdayScheduler } from '../schedulers/daily-birthday.scheduler.js';
import { minuteEnqueueScheduler } from '../schedulers/minute-enqueue.scheduler.js';
import { recoveryScheduler } from '../schedulers/recovery.scheduler.js';
import { logger } from '../config/logger.js';

/**
 * Health Check Controller
 *
 * Provides endpoints for monitoring application and service health:
 * - GET /health - Basic health check
 * - GET /health/detailed - Detailed health with all components
 * - GET /health/ready - Readiness probe (Kubernetes)
 * - GET /health/live - Liveness probe (Kubernetes)
 */
export class HealthController {
  constructor(private readonly _healthService: HealthCheckService = healthCheckService) {
    logger.debug('HealthController initialized');
  }

  /**
   * Basic health check endpoint
   * Returns simple health status
   *
   * GET /health
   */
  async getHealth(_request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const response = await this._healthService.getSimpleHealth();

      // Use info level in production/CI to help debug startup issues
      const logLevel = process.env.NODE_ENV === 'test' ? 'debug' : 'info';
      logger[logLevel]({ response }, 'Health check: OK');

      await reply.status(200).send(response);
    } catch (error) {
      logger.error(
        { error: error instanceof Error ? error.message : String(error) },
        'Health check failed'
      );

      await reply.status(503).send({
        status: 'down',
        timestamp: new Date().toISOString(),
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Detailed health check endpoint
   * Returns comprehensive health status of all components
   *
   * GET /health/detailed
   */
  async getDetailedHealth(_request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const response = await this._healthService.getDetailedHealth();

      logger.debug(
        {
          status: response.status,
          database: response.services.database.healthy,
          rabbitmq: response.services.rabbitmq.healthy,
          circuitBreaker: response.services.circuitBreaker.healthy,
        },
        'Detailed health check performed'
      );

      // Return 200 for ok, 200 for degraded (partial), 503 for down
      const statusCode = response.status === 'down' ? 503 : 200;

      await reply.status(statusCode).send(response);
    } catch (error) {
      logger.error(
        { error: error instanceof Error ? error.message : String(error) },
        'Detailed health check failed'
      );

      await reply.status(503).send({
        status: 'down',
        timestamp: new Date().toISOString(),
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Readiness probe for Kubernetes/orchestration
   * Checks if the application is ready to accept traffic
   *
   * Returns 200 if ready, 503 if not ready
   *
   * GET /health/ready
   */
  async getReady(_request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const isReady = await this._healthService.isReady();

      logger.debug({ isReady }, 'Readiness check performed');

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
    } catch (error) {
      logger.error(
        { error: error instanceof Error ? error.message : String(error) },
        'Readiness check failed'
      );

      await reply.status(503).send({
        status: 'not_ready',
        timestamp: new Date().toISOString(),
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Liveness probe for Kubernetes/orchestration
   * Checks if the application is alive and should not be restarted
   *
   * Returns 200 if alive
   *
   * GET /health/live
   */
  async getLive(_request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const isLive = await this._healthService.isLive();

      logger.debug({ isLive }, 'Liveness check performed');

      await reply.status(200).send({
        status: 'alive',
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      // If we can execute this code, the service is still somewhat alive
      // Return 500 instead of 503
      logger.error(
        { error: error instanceof Error ? error.message : String(error) },
        'Liveness check encountered error'
      );

      await reply.status(500).send({
        status: 'error',
        timestamp: new Date().toISOString(),
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Get scheduler health status
   * Returns status of all cron schedulers
   *
   * GET /health/schedulers
   */
  async getSchedulerHealth(_request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const dailyStatus = dailyBirthdayScheduler.getStatus();
      const minuteStatus = minuteEnqueueScheduler.getStatus();
      const recoveryStatus = recoveryScheduler.getStatus();

      const response = {
        status: 'ok',
        timestamp: new Date().toISOString(),
        schedulers: {
          daily: {
            healthy: dailyBirthdayScheduler.isHealthy(),
            ...dailyStatus,
          },
          minute: {
            healthy: minuteEnqueueScheduler.isHealthy(),
            ...minuteStatus,
          },
          recovery: {
            healthy: recoveryScheduler.isHealthy(),
            ...recoveryStatus,
          },
        },
      };

      logger.debug({ response }, 'Scheduler health check performed');

      await reply.status(200).send(response);
    } catch (error) {
      logger.error(
        { error: error instanceof Error ? error.message : String(error) },
        'Scheduler health check failed'
      );

      await reply.status(503).send({
        status: 'down',
        timestamp: new Date().toISOString(),
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
}

// Export singleton instance
export const healthController = new HealthController();
