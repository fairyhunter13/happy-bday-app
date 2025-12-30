/**
 * Metrics Controller Integration Tests
 *
 * Tests for metrics HTTP endpoints
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import Fastify, { FastifyInstance } from 'fastify';
import { metricsRoutes } from '../../../src/routes/metrics.routes.js';
import { metricsService } from '../../../src/services/metrics.service.js';

describe('MetricsController Integration Tests', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    // Create Fastify app
    app = Fastify({
      logger: false,
    });

    // Register routes
    await app.register(metricsRoutes);

    // Seed some test metrics
    metricsService.recordMessageScheduled('BIRTHDAY', 'America/New_York');
    metricsService.recordMessageSent('BIRTHDAY', 200);
    metricsService.recordMessageFailed('ANNIVERSARY', 'timeout', 1);
    metricsService.setQueueDepth('birthday_messages', 150);
    metricsService.setActiveWorkers('message_consumer', 5);
    metricsService.setCircuitBreakerStatus('message_api', false);

    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('GET /metrics', () => {
    it('should return metrics in Prometheus format', async () => {
      // Act
      const response = await app.inject({
        method: 'GET',
        url: '/metrics',
      });

      // Assert
      expect(response.statusCode).toBe(200);
      expect(response.headers['content-type']).toContain('text/plain');

      const body = response.body;
      expect(body).toContain('birthday_scheduler_messages_scheduled_total');
      expect(body).toContain('birthday_scheduler_messages_sent_total');
      expect(body).toContain('birthday_scheduler_messages_failed_total');
      expect(body).toContain('birthday_scheduler_queue_depth');
      expect(body).toContain('birthday_scheduler_active_workers');
      expect(body).toContain('birthday_scheduler_circuit_breaker_open');
    });

    it('should include default labels', async () => {
      // Act
      const response = await app.inject({
        method: 'GET',
        url: '/metrics',
      });

      // Assert
      expect(response.statusCode).toBe(200);
      const body = response.body;

      // Check for default labels
      expect(body).toContain('service="birthday-message-scheduler"');
      expect(body).toContain('environment=');
      expect(body).toContain('version=');
    });

    it('should include Node.js default metrics', async () => {
      // Act
      const response = await app.inject({
        method: 'GET',
        url: '/metrics',
      });

      // Assert
      expect(response.statusCode).toBe(200);
      const body = response.body;

      // Check for Node.js default metrics
      expect(body).toContain('nodejs_heap_size_total_bytes');
      expect(body).toContain('nodejs_heap_size_used_bytes');
      expect(body).toContain('process_cpu_user_seconds_total');
    });

    it('should include metric HELP and TYPE comments', async () => {
      // Act
      const response = await app.inject({
        method: 'GET',
        url: '/metrics',
      });

      // Assert
      expect(response.statusCode).toBe(200);
      const body = response.body;

      // Check for metric metadata
      expect(body).toContain('# HELP birthday_scheduler_messages_scheduled_total');
      expect(body).toContain('# TYPE birthday_scheduler_messages_scheduled_total counter');
      expect(body).toContain('# HELP birthday_scheduler_queue_depth');
      expect(body).toContain('# TYPE birthday_scheduler_queue_depth gauge');
    });

    it('should return valid Prometheus exposition format', async () => {
      // Act
      const response = await app.inject({
        method: 'GET',
        url: '/metrics',
      });

      // Assert
      expect(response.statusCode).toBe(200);
      const body = response.body;

      // Validate basic Prometheus format
      const lines = body.split('\n');
      const metricLines = lines.filter((line) => !line.startsWith('#') && line.trim() !== '');

      // Each metric line should have format: metric_name{labels} value
      for (const line of metricLines) {
        expect(line).toMatch(/^[a-zA-Z_:][a-zA-Z0-9_:]*(\{.*\})?\s+[\d.]+/);
      }
    });
  });

  describe('GET /metrics/summary', () => {
    it('should return metrics summary in JSON format', async () => {
      // Act
      const response = await app.inject({
        method: 'GET',
        url: '/metrics/summary',
      });

      // Assert
      expect(response.statusCode).toBe(200);
      expect(response.headers['content-type']).toContain('application/json');

      const body = JSON.parse(response.body);
      expect(body).toHaveProperty('success');
      expect(body).toHaveProperty('data');
      expect(body).toHaveProperty('timestamp');
      expect(body.success).toBe(true);
    });

    it('should include all metric types in summary', async () => {
      // Act
      const response = await app.inject({
        method: 'GET',
        url: '/metrics/summary',
      });

      // Assert
      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);

      expect(body.data).toHaveProperty('scheduledTotal');
      expect(body.data).toHaveProperty('sentTotal');
      expect(body.data).toHaveProperty('failedTotal');
      expect(body.data).toHaveProperty('apiRequestsTotal');
      expect(body.data).toHaveProperty('queueDepth');
      expect(body.data).toHaveProperty('activeWorkers');
      expect(body.data).toHaveProperty('circuitBreakerStatus');
    });

    it('should reflect current metric values', async () => {
      // Arrange - Record additional metrics
      metricsService.recordMessageScheduled('BIRTHDAY', 'Europe/London');
      metricsService.setQueueDepth('birthday_messages', 200);

      // Act
      const response = await app.inject({
        method: 'GET',
        url: '/metrics/summary',
      });

      // Assert
      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);

      expect(body.data.scheduledTotal).toBeGreaterThan(0);
      expect(body.data.queueDepth['birthday_messages']).toBe(200);
    });
  });

  describe('Metrics Persistence', () => {
    it('should persist metrics across multiple requests', async () => {
      // Arrange - Record a metric
      const initialMetrics = await metricsService.getMetricValues();
      const initialScheduledTotal = initialMetrics.scheduledTotal;

      metricsService.recordMessageScheduled('BIRTHDAY', 'Asia/Tokyo');

      // Act - Make multiple requests
      const response1 = await app.inject({
        method: 'GET',
        url: '/metrics',
      });

      const response2 = await app.inject({
        method: 'GET',
        url: '/metrics',
      });

      // Assert - Both should show the metric
      expect(response1.statusCode).toBe(200);
      expect(response2.statusCode).toBe(200);

      const finalMetrics = await metricsService.getMetricValues();
      expect(finalMetrics.scheduledTotal).toBe(initialScheduledTotal + 1);
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid routes gracefully', async () => {
      // Act
      const response = await app.inject({
        method: 'GET',
        url: '/metrics/invalid',
      });

      // Assert
      expect(response.statusCode).toBe(404);
    });

    it('should reject non-GET requests to /metrics', async () => {
      // Act
      const response = await app.inject({
        method: 'POST',
        url: '/metrics',
      });

      // Assert
      expect(response.statusCode).toBe(404);
    });
  });

  describe('Performance', () => {
    it('should respond quickly to metrics requests', async () => {
      // Arrange
      const startTime = Date.now();

      // Act
      const response = await app.inject({
        method: 'GET',
        url: '/metrics',
      });

      const duration = Date.now() - startTime;

      // Assert
      expect(response.statusCode).toBe(200);
      expect(duration).toBeLessThan(1000); // Should respond in less than 1 second
    });

    it('should handle concurrent metrics requests', async () => {
      // Arrange
      const requests = Array.from({ length: 10 }, () =>
        app.inject({
          method: 'GET',
          url: '/metrics',
        })
      );

      // Act
      const responses = await Promise.all(requests);

      // Assert
      responses.forEach((response) => {
        expect(response.statusCode).toBe(200);
        expect(response.body).toContain('birthday_scheduler_messages_scheduled_total');
      });
    });
  });

  describe('Metric Updates', () => {
    it('should reflect real-time metric updates', async () => {
      // Arrange - Get initial state
      const initialResponse = await app.inject({
        method: 'GET',
        url: '/metrics/summary',
      });
      const initialBody = JSON.parse(initialResponse.body);
      const initialQueueDepth = initialBody.data.queueDepth['test_queue'] || 0;

      // Act - Update metrics
      metricsService.setQueueDepth('test_queue', 999);

      const updatedResponse = await app.inject({
        method: 'GET',
        url: '/metrics/summary',
      });

      // Assert
      const updatedBody = JSON.parse(updatedResponse.body);
      expect(updatedBody.data.queueDepth['test_queue']).toBe(999);
      expect(updatedBody.data.queueDepth['test_queue']).not.toBe(initialQueueDepth);
    });
  });
});
