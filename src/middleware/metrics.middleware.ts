/**
 * Metrics Middleware
 *
 * Automatically tracks HTTP request metrics:
 * - Request count by method, path, and status
 * - Response time histogram
 * - Response size
 *
 * Integrates with Prometheus metrics service
 */

import type { FastifyRequest, FastifyReply, HookHandlerDoneFunction } from 'fastify';
import { metricsService } from '../services/metrics.service.js';
import { logger } from '../config/logger.js';

/**
 * Normalize path for metrics
 * Replaces dynamic segments (UUIDs, IDs) with placeholders
 *
 * @param path - Original request path
 * @returns Normalized path
 */
function normalizePath(path: string): string {
  // Replace UUIDs with :id
  let normalized = path.replace(
    /\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi,
    '/:id'
  );

  // Replace numeric IDs with :id
  normalized = normalized.replace(/\/\d+/g, '/:id');

  // Limit path length to prevent label cardinality explosion
  if (normalized.length > 100) {
    normalized = normalized.substring(0, 100);
  }

  return normalized;
}

/**
 * Metrics tracking middleware for Fastify
 *
 * This is a Fastify onRequest hook that tracks HTTP request metrics.
 * It uses the done() callback to signal completion and avoid blocking the request.
 *
 * @param request - Fastify request
 * @param reply - Fastify reply
 * @param done - Callback to signal hook completion
 */
export function metricsMiddleware(
  request: FastifyRequest,
  reply: FastifyReply,
  done: HookHandlerDoneFunction
): void {
  const startTime = Date.now();

  // Track request start
  logger.debug({ method: request.method, path: request.url }, 'HTTP request started');

  // Use reply.raw.on to track when response is sent
  const trackMetrics = () => {
    try {
      const duration = (Date.now() - startTime) / 1000; // Convert to seconds
      const method = request.method;
      const path = normalizePath(request.url);
      const status = reply.statusCode;

      // Record API request counter
      metricsService.recordApiRequest(method, path, status);

      // Record API response time histogram
      metricsService.recordApiResponseTime(method, path, status, duration);

      logger.debug(
        {
          method,
          path,
          status,
          duration,
        },
        'HTTP request completed'
      );
    } catch (error) {
      // Don't fail the request if metrics recording fails
      logger.error(
        { error: error instanceof Error ? error.message : String(error) },
        'Failed to record request metrics'
      );
    }
  };

  reply.raw.on('finish', trackMetrics);

  // Signal hook completion immediately to avoid blocking the request
  done();
}
