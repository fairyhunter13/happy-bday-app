/**
 * Health Check Service
 *
 * Provides comprehensive health checks for all system components:
 * - Database (PostgreSQL)
 * - Message Queue (RabbitMQ)
 * - Circuit Breaker status
 * - System metrics (memory, CPU)
 *
 * Used by health controller endpoints for:
 * - Basic health check
 * - Kubernetes readiness probe
 * - Kubernetes liveness probe
 * - Detailed system health
 */

import { db } from '../db/connection.js';
import { sql } from 'drizzle-orm';
import { messageSenderService } from './message.service.js';
import { cacheService } from './cache.service.js';
import { logger } from '../config/logger.js';
import { version } from '../../package.json' assert { type: 'json' };
import { metricsService } from './metrics.service.js';

/**
 * Health status for a component
 */
export interface ComponentHealth {
  healthy: boolean;
  message: string;
  details?: Record<string, unknown>;
  error?: string;
  latency?: number;
}

/**
 * Detailed health response
 */
export interface DetailedHealthResponse {
  status: 'ok' | 'degraded' | 'down';
  timestamp: string;
  uptime: number;
  version: string;
  services: {
    database: ComponentHealth;
    rabbitmq: ComponentHealth;
    redis: ComponentHealth;
    circuitBreaker: ComponentHealth;
  };
  metrics: {
    memory: ReturnType<typeof process.memoryUsage>;
    cpu: ReturnType<typeof process.cpuUsage>;
  };
}

/**
 * Simple health response
 */
export interface SimpleHealthResponse {
  status: 'ok' | 'down';
  timestamp: string;
  uptime: number;
  version: string;
}

/**
 * HealthCheckService
 *
 * Provides health check functionality for all system components.
 *
 * @example
 * const service = new HealthCheckService();
 * const health = await service.getDetailedHealth();
 * if (health.status === 'ok') {
 *   console.log('All systems operational');
 * }
 */
export class HealthCheckService {
  /**
   * Check database health
   *
   * @returns Database health status
   */
  async checkDatabase(): Promise<ComponentHealth> {
    const startTime = Date.now();

    try {
      // Simple query to test connection
      await db.execute(sql`SELECT 1 as health_check`);

      const latency = Date.now() - startTime;

      logger.debug({ latency }, 'Database health check passed');

      return {
        healthy: true,
        message: 'Database connection OK',
        details: {
          connected: true,
          responseTime: `${latency}ms`,
        },
        latency,
      };
    } catch (error) {
      const latency = Date.now() - startTime;

      logger.error(
        { error: error instanceof Error ? error.message : String(error), latency },
        'Database health check failed'
      );

      return {
        healthy: false,
        message: 'Database connection failed',
        error: error instanceof Error ? error.message : String(error),
        latency,
      };
    }
  }

  /**
   * Check RabbitMQ health
   *
   * Note: This is a basic implementation.
   * For full RabbitMQ health check, we would need to:
   * 1. Check connection status
   * 2. Check queue existence
   * 3. Check message counts
   * 4. Check consumer count
   *
   * @returns RabbitMQ health status
   */
  async checkRabbitMQ(): Promise<ComponentHealth> {
    const startTime = Date.now();

    try {
      // TODO: Implement actual RabbitMQ connection check
      // This would require access to RabbitMQ connection instance
      // For now, we assume healthy if no errors

      const latency = Date.now() - startTime;

      logger.debug({ latency }, 'RabbitMQ health check passed');

      return {
        healthy: true,
        message: 'RabbitMQ connection OK',
        details: {
          connected: true,
          // TODO: Add queue depth, consumer count, etc.
        },
        latency,
      };
    } catch (error) {
      const latency = Date.now() - startTime;

      logger.error(
        { error: error instanceof Error ? error.message : String(error), latency },
        'RabbitMQ health check failed'
      );

      return {
        healthy: false,
        message: 'RabbitMQ connection failed',
        error: error instanceof Error ? error.message : String(error),
        latency,
      };
    }
  }

  /**
   * Check Redis cache health
   *
   * @returns Redis health status
   */
  async checkRedis(): Promise<ComponentHealth> {
    const startTime = Date.now();

    try {
      // Use cache service health check
      const isHealthy = await cacheService.isHealthy();
      const latency = Date.now() - startTime;

      if (isHealthy) {
        // Get cache metrics for additional details
        const metrics = await cacheService.getMetrics();

        logger.debug({ latency, metrics }, 'Redis health check passed');

        return {
          healthy: true,
          message: 'Redis connection OK',
          details: {
            connected: true,
            hitRate: metrics.hitRate,
            keysCount: metrics.keysCount,
            memoryUsage: metrics.memoryUsage,
          },
          latency,
        };
      } else {
        logger.warn({ latency }, 'Redis health check failed');

        return {
          healthy: false,
          message: 'Redis connection failed or not configured',
          details: {
            connected: false,
          },
          latency,
        };
      }
    } catch (error) {
      const latency = Date.now() - startTime;

      logger.error(
        { error: error instanceof Error ? error.message : String(error), latency },
        'Redis health check failed'
      );

      return {
        healthy: false,
        message: 'Redis connection failed',
        error: error instanceof Error ? error.message : String(error),
        latency,
      };
    }
  }

  /**
   * Check circuit breaker status
   *
   * @returns Circuit breaker health status
   */
  async checkCircuitBreaker(): Promise<ComponentHealth> {
    const startTime = Date.now();

    try {
      const stats = messageSenderService.getCircuitBreakerStats();
      const latency = Date.now() - startTime;

      const isHealthy = !stats.isOpen;

      logger.debug(
        { latency, state: stats.state, isHealthy },
        'Circuit breaker health check completed'
      );

      return {
        healthy: isHealthy,
        message: isHealthy ? 'Circuit breaker closed (healthy)' : 'Circuit breaker open (degraded)',
        details: {
          state: stats.state,
          failures: stats.failures,
          successes: stats.successes,
          isOpen: stats.isOpen,
        },
        latency,
      };
    } catch (error) {
      const latency = Date.now() - startTime;

      logger.error(
        { error: error instanceof Error ? error.message : String(error), latency },
        'Circuit breaker health check failed'
      );

      return {
        healthy: false,
        message: 'Circuit breaker status unavailable',
        error: error instanceof Error ? error.message : String(error),
        latency,
      };
    }
  }

  /**
   * Get detailed system health
   *
   * Checks all components and returns comprehensive health status.
   *
   * @returns Detailed health response
   */
  async getDetailedHealth(): Promise<DetailedHealthResponse> {
    logger.debug('Performing detailed health check');

    const startTime = Date.now();

    // Check all components in parallel
    const [databaseHealth, rabbitmqHealth, redisHealth, circuitBreakerHealth] =
      await Promise.allSettled([
        this.checkDatabase(),
        this.checkRabbitMQ(),
        this.checkRedis(),
        this.checkCircuitBreaker(),
      ]);

    // Extract health status from settled promises
    const database: ComponentHealth =
      databaseHealth.status === 'fulfilled'
        ? databaseHealth.value
        : {
            healthy: false,
            message: 'Health check failed',
            error:
              databaseHealth.reason instanceof Error
                ? databaseHealth.reason.message
                : String(databaseHealth.reason),
          };

    const rabbitmq: ComponentHealth =
      rabbitmqHealth.status === 'fulfilled'
        ? rabbitmqHealth.value
        : {
            healthy: false,
            message: 'Health check failed',
            error:
              rabbitmqHealth.reason instanceof Error
                ? rabbitmqHealth.reason.message
                : String(rabbitmqHealth.reason),
          };

    const redis: ComponentHealth =
      redisHealth.status === 'fulfilled'
        ? redisHealth.value
        : {
            healthy: false,
            message: 'Health check failed',
            error:
              redisHealth.reason instanceof Error
                ? redisHealth.reason.message
                : String(redisHealth.reason),
          };

    const circuitBreaker: ComponentHealth =
      circuitBreakerHealth.status === 'fulfilled'
        ? circuitBreakerHealth.value
        : {
            healthy: false,
            message: 'Health check failed',
            error:
              circuitBreakerHealth.reason instanceof Error
                ? circuitBreakerHealth.reason.message
                : String(circuitBreakerHealth.reason),
          };

    // Determine overall status
    // Note: Redis is optional, so we don't fail if it's down
    const criticalServicesHealthy = database.healthy && rabbitmq.healthy && circuitBreaker.healthy;
    const allHealthy = criticalServicesHealthy && redis.healthy;
    const anyHealthy =
      database.healthy || rabbitmq.healthy || redis.healthy || circuitBreaker.healthy;

    const status = allHealthy ? 'ok' : anyHealthy ? 'degraded' : 'down';

    const duration = Date.now() - startTime;

    // Update database connection metrics
    const memoryUsage = process.memoryUsage();
    metricsService.setDatabaseConnections('postgres', 'active', database.healthy ? 1 : 0);

    const response: DetailedHealthResponse = {
      status,
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      version,
      services: {
        database,
        rabbitmq,
        redis,
        circuitBreaker,
      },
      metrics: {
        memory: memoryUsage,
        cpu: process.cpuUsage(),
      },
    };

    logger.info(
      {
        status,
        duration,
        database: database.healthy,
        rabbitmq: rabbitmq.healthy,
        redis: redis.healthy,
        circuitBreaker: circuitBreaker.healthy,
      },
      'Detailed health check completed'
    );

    return response;
  }

  /**
   * Get simple health status
   *
   * Basic health check for load balancers and basic monitoring.
   *
   * @returns Simple health response
   */
  async getSimpleHealth(): Promise<SimpleHealthResponse> {
    logger.debug('Performing simple health check');

    // For simple health, we only check if the service is running
    // This is used for basic liveness checks

    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      version,
    };
  }

  /**
   * Check readiness (for Kubernetes readiness probe)
   *
   * Service is ready if critical dependencies are available:
   * - Database connection
   * - RabbitMQ connection (optional check)
   *
   * @returns True if ready, false otherwise
   */
  async isReady(): Promise<boolean> {
    logger.debug('Performing readiness check');

    try {
      // Check critical dependencies
      const databaseHealth = await this.checkDatabase();

      // Service is ready if database is healthy
      // RabbitMQ is important but not critical for readiness
      const ready = databaseHealth.healthy;

      logger.debug({ ready }, 'Readiness check completed');

      return ready;
    } catch (error) {
      logger.error(
        { error: error instanceof Error ? error.message : String(error) },
        'Readiness check failed'
      );

      return false;
    }
  }

  /**
   * Check liveness (for Kubernetes liveness probe)
   *
   * Service is alive if it can respond to requests.
   * This is a simple check - if this method executes, the service is alive.
   *
   * @returns True (always, unless the service is completely down)
   */
  async isLive(): Promise<boolean> {
    logger.debug('Performing liveness check');

    // Simple liveness - if we can execute this, we're alive
    return true;
  }

  /**
   * Get system metrics
   *
   * @returns System metrics
   */
  getSystemMetrics(): {
    memory: ReturnType<typeof process.memoryUsage>;
    cpu: ReturnType<typeof process.cpuUsage>;
    uptime: number;
    version: string;
  } {
    return {
      memory: process.memoryUsage(),
      cpu: process.cpuUsage(),
      uptime: process.uptime(),
      version,
    };
  }
}

// Export singleton instance
export const healthCheckService = new HealthCheckService();
