/**
 * Metrics Controller
 *
 * REST API endpoint for Prometheus metrics:
 * - GET /metrics - Prometheus exposition format
 *
 * Returns metrics in the Prometheus text-based exposition format
 * with proper content-type: text/plain; version=0.0.4
 */

import type { FastifyReply, FastifyRequest } from 'fastify';
import { type MetricsService } from '../services/metrics.service.js';
import { logger } from '../config/logger.js';

/**
 * Metrics Controller class
 * Handles Prometheus metrics endpoint
 */
export class MetricsController {
  constructor(private readonly metricsService: MetricsService) {}

  /**
   * Get Prometheus metrics
   * GET /metrics
   *
   * @param request - Fastify request
   * @param reply - Fastify reply
   * @returns Metrics in Prometheus exposition format
   */
  async getMetrics(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    logger.debug('Serving Prometheus metrics');

    try {
      // Get metrics from service
      const metrics = await this.metricsService.getMetrics();
      const contentType = this.metricsService.getContentType();

      // Set proper content type for Prometheus
      await reply.header('Content-Type', contentType).send(metrics);

      logger.debug({ bytesServed: metrics.length }, 'Prometheus metrics served successfully');
    } catch (error) {
      logger.error(
        { error: error instanceof Error ? error.message : String(error) },
        'Failed to serve metrics'
      );

      await reply.status(500).send({
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to generate metrics',
        },
        timestamp: new Date().toISOString(),
        path: request.url,
      });
    }
  }

  /**
   * Get metrics summary (JSON format for debugging)
   * GET /metrics/summary
   *
   * @param request - Fastify request
   * @param reply - Fastify reply
   * @returns Metrics summary in JSON format
   */
  async getMetricsSummary(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    logger.debug('Serving metrics summary');

    try {
      const metricValues = await this.metricsService.getMetricValues();

      await reply.status(200).send({
        success: true,
        data: metricValues,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error(
        { error: error instanceof Error ? error.message : String(error) },
        'Failed to generate metrics summary'
      );

      await reply.status(500).send({
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to generate metrics summary',
        },
        timestamp: new Date().toISOString(),
        path: request.url,
      });
    }
  }
}
