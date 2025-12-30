/**
 * Metrics Routes
 *
 * Defines routes for Prometheus metrics endpoints with comprehensive OpenAPI 3.1 documentation
 */

import type { FastifyInstance } from 'fastify';
import { MetricsController } from '../controllers/metrics.controller.js';
import { metricsService } from '../services/metrics.service.js';
import { PrometheusMetricsRouteSchema, MetricsSummaryRouteSchema } from '../schemas/index.js';

const metricsController = new MetricsController(metricsService);

/**
 * Register metrics routes
 *
 * @param app - Fastify instance
 */
export async function metricsRoutes(app: FastifyInstance): Promise<void> {
  /**
   * GET /metrics
   * Prometheus metrics endpoint
   */
  app.get('/metrics', {
    schema: PrometheusMetricsRouteSchema,
    handler: metricsController.getMetrics.bind(metricsController),
  });

  /**
   * GET /metrics/summary
   * Get metrics summary in JSON format (for debugging)
   */
  app.get('/metrics/summary', {
    schema: MetricsSummaryRouteSchema,
    handler: metricsController.getMetricsSummary.bind(metricsController),
  });
}
