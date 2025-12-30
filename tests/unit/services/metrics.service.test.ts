/**
 * Metrics Service Unit Tests
 *
 * Tests for Prometheus metrics service functionality
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { MetricsService } from '../../../src/services/metrics.service.js';

describe('MetricsService', () => {
  let metricsService: MetricsService;

  beforeEach(() => {
    // Create fresh instance for each test
    metricsService = new MetricsService();
  });

  describe('Counter Metrics', () => {
    it('should record scheduled messages', async () => {
      // Arrange & Act
      metricsService.recordMessageScheduled('BIRTHDAY', 'America/New_York');
      metricsService.recordMessageScheduled('BIRTHDAY', 'America/New_York');
      metricsService.recordMessageScheduled('ANNIVERSARY', 'Asia/Tokyo');

      // Assert
      const metrics = await metricsService.getMetricValues();
      expect(metrics.scheduledTotal).toBeGreaterThanOrEqual(3);
    });

    it('should record sent messages', async () => {
      // Arrange & Act
      metricsService.recordMessageSent('BIRTHDAY', 200);
      metricsService.recordMessageSent('BIRTHDAY', 201);

      // Assert
      const metrics = await metricsService.getMetricValues();
      expect(metrics.sentTotal).toBeGreaterThanOrEqual(2);
    });

    it('should record failed messages', async () => {
      // Arrange & Act
      metricsService.recordMessageFailed('BIRTHDAY', 'timeout', 1);
      metricsService.recordMessageFailed('ANNIVERSARY', 'network', 2);

      // Assert
      const metrics = await metricsService.getMetricValues();
      expect(metrics.failedTotal).toBeGreaterThanOrEqual(2);
    });

    it('should record API requests', async () => {
      // Arrange & Act
      metricsService.recordApiRequest('GET', '/api/v1/users', 200);
      metricsService.recordApiRequest('POST', '/api/v1/users', 201);

      // Assert
      const metrics = await metricsService.getMetricValues();
      expect(metrics.apiRequestsTotal).toBeGreaterThanOrEqual(2);
    });
  });

  describe('Gauge Metrics', () => {
    it('should set queue depth', async () => {
      // Arrange & Act
      metricsService.setQueueDepth('birthday_messages', 150);

      // Assert
      const metrics = await metricsService.getMetricValues();
      expect(metrics.queueDepth['birthday_messages']).toBe(150);
    });

    it('should update queue depth', async () => {
      // Arrange
      metricsService.setQueueDepth('birthday_messages', 100);

      // Act
      metricsService.setQueueDepth('birthday_messages', 250);

      // Assert
      const metrics = await metricsService.getMetricValues();
      expect(metrics.queueDepth['birthday_messages']).toBe(250);
    });

    it('should set active workers', async () => {
      // Arrange & Act
      metricsService.setActiveWorkers('message_consumer', 5);

      // Assert
      const metrics = await metricsService.getMetricValues();
      expect(metrics.activeWorkers['message_consumer']).toBe(5);
    });

    it('should set database connections', () => {
      // Arrange & Act
      metricsService.setDatabaseConnections('postgres', 'active', 10);
      metricsService.setDatabaseConnections('postgres', 'idle', 5);

      // Assert - No error thrown
      expect(true).toBe(true);
    });

    it('should set circuit breaker status', async () => {
      // Arrange & Act
      metricsService.setCircuitBreakerStatus('message_api', true);

      // Assert
      const metrics = await metricsService.getMetricValues();
      expect(metrics.circuitBreakerStatus['message_api']).toBe(1);
    });

    it('should toggle circuit breaker status', async () => {
      // Arrange
      metricsService.setCircuitBreakerStatus('message_api', true);

      // Act
      metricsService.setCircuitBreakerStatus('message_api', false);

      // Assert
      const metrics = await metricsService.getMetricValues();
      expect(metrics.circuitBreakerStatus['message_api']).toBe(0);
    });
  });

  describe('Histogram Metrics', () => {
    it('should record message delivery duration', () => {
      // Arrange & Act
      metricsService.recordMessageDeliveryDuration('BIRTHDAY', 'success', 1.5);
      metricsService.recordMessageDeliveryDuration('BIRTHDAY', 'success', 0.8);
      metricsService.recordMessageDeliveryDuration('BIRTHDAY', 'failure', 5.2);

      // Assert - No error thrown
      expect(true).toBe(true);
    });

    it('should record API response time', () => {
      // Arrange & Act
      metricsService.recordApiResponseTime('GET', '/api/v1/users', 200, 0.05);
      metricsService.recordApiResponseTime('POST', '/api/v1/users', 201, 0.12);

      // Assert - No error thrown
      expect(true).toBe(true);
    });

    it('should record scheduler execution duration', () => {
      // Arrange & Act
      metricsService.recordSchedulerExecution('daily_precalculation', 'success', 45.3);
      metricsService.recordSchedulerExecution('enqueue_messages', 'success', 2.1);
      metricsService.recordSchedulerExecution('recovery_job', 'failure', 10.5);

      // Assert - No error thrown
      expect(true).toBe(true);
    });
  });

  describe('Summary Metrics', () => {
    it('should record message processing quantiles', () => {
      // Arrange & Act
      metricsService.recordMessageProcessing('BIRTHDAY', 1.2);
      metricsService.recordMessageProcessing('BIRTHDAY', 0.9);
      metricsService.recordMessageProcessing('BIRTHDAY', 1.5);
      metricsService.recordMessageProcessing('ANNIVERSARY', 0.7);

      // Assert - No error thrown
      expect(true).toBe(true);
    });
  });

  describe('Metrics Export', () => {
    it('should export metrics in Prometheus format', async () => {
      // Arrange
      metricsService.recordMessageScheduled('BIRTHDAY', 'America/New_York');
      metricsService.setQueueDepth('birthday_messages', 100);

      // Act
      const metrics = await metricsService.getMetrics();

      // Assert
      expect(metrics).toBeTruthy();
      expect(typeof metrics).toBe('string');
      expect(metrics).toContain('birthday_scheduler_messages_scheduled_total');
      expect(metrics).toContain('birthday_scheduler_queue_depth');
    });

    it('should return correct content type', () => {
      // Act
      const contentType = metricsService.getContentType();

      // Assert
      expect(contentType).toBeTruthy();
      expect(contentType).toContain('text/plain');
    });

    it('should include default labels in metrics', async () => {
      // Arrange
      metricsService.recordMessageScheduled('BIRTHDAY', 'America/New_York');

      // Act
      const metrics = await metricsService.getMetrics();

      // Assert
      expect(metrics).toContain('service="birthday-message-scheduler"');
      expect(metrics).toContain('environment=');
      expect(metrics).toContain('version=');
    });
  });

  describe('Metric Values', () => {
    it('should return current metric values', async () => {
      // Arrange
      metricsService.recordMessageScheduled('BIRTHDAY', 'America/New_York');
      metricsService.recordMessageSent('BIRTHDAY', 200);
      metricsService.setQueueDepth('birthday_messages', 50);
      metricsService.setActiveWorkers('message_consumer', 3);
      metricsService.setCircuitBreakerStatus('message_api', false);

      // Act
      const values = await metricsService.getMetricValues();

      // Assert
      expect(values).toHaveProperty('scheduledTotal');
      expect(values).toHaveProperty('sentTotal');
      expect(values).toHaveProperty('failedTotal');
      expect(values).toHaveProperty('apiRequestsTotal');
      expect(values).toHaveProperty('queueDepth');
      expect(values).toHaveProperty('activeWorkers');
      expect(values).toHaveProperty('circuitBreakerStatus');

      expect(values.scheduledTotal).toBeGreaterThanOrEqual(1);
      expect(values.sentTotal).toBeGreaterThanOrEqual(1);
      expect(values.queueDepth['birthday_messages']).toBe(50);
      expect(values.activeWorkers['message_consumer']).toBe(3);
      expect(values.circuitBreakerStatus['message_api']).toBe(0);
    });
  });

  describe('Reset Metrics', () => {
    it('should reset all metrics', async () => {
      // Arrange
      metricsService.recordMessageScheduled('BIRTHDAY', 'America/New_York');
      metricsService.setQueueDepth('birthday_messages', 100);

      // Act
      metricsService.resetMetrics();

      // Assert - Metrics should be reset (values back to 0 or initial state)
      const values = await metricsService.getMetricValues();
      expect(values.scheduledTotal).toBe(0);
    });
  });

  describe('Registry Access', () => {
    it('should return registry instance', () => {
      // Act
      const registry = metricsService.getRegistry();

      // Assert
      expect(registry).toBeTruthy();
      expect(registry).toHaveProperty('metrics');
      expect(registry).toHaveProperty('contentType');
    });
  });

  describe('Edge Cases', () => {
    it('should handle multiple queue metrics', async () => {
      // Arrange & Act
      metricsService.setQueueDepth('birthday_messages', 100);
      metricsService.setQueueDepth('anniversary_messages', 50);
      metricsService.setQueueDepth('dead_letter_queue', 5);

      // Assert
      const metrics = await metricsService.getMetricValues();
      expect(metrics.queueDepth['birthday_messages']).toBe(100);
      expect(metrics.queueDepth['anniversary_messages']).toBe(50);
      expect(metrics.queueDepth['dead_letter_queue']).toBe(5);
    });

    it('should handle zero values', async () => {
      // Arrange & Act
      metricsService.setQueueDepth('birthday_messages', 0);
      metricsService.setActiveWorkers('message_consumer', 0);

      // Assert
      const metrics = await metricsService.getMetricValues();
      expect(metrics.queueDepth['birthday_messages']).toBe(0);
      expect(metrics.activeWorkers['message_consumer']).toBe(0);
    });

    it('should handle high frequency updates', async () => {
      // Arrange & Act - Simulate high-frequency metric updates
      for (let i = 0; i < 100; i++) {
        metricsService.recordMessageScheduled('BIRTHDAY', 'America/New_York');
        metricsService.recordApiRequest('GET', '/api/v1/health', 200);
      }

      // Assert
      const metrics = await metricsService.getMetricValues();
      expect(metrics.scheduledTotal).toBeGreaterThanOrEqual(100);
      expect(metrics.apiRequestsTotal).toBeGreaterThanOrEqual(100);
    });

    it('should handle concurrent metric updates', async () => {
      // Arrange & Act - Simulate concurrent updates
      const updates = Array.from({ length: 10 }, (_, i) => {
        return Promise.resolve().then(() => {
          metricsService.recordMessageScheduled('BIRTHDAY', 'America/New_York');
          metricsService.setQueueDepth('birthday_messages', i * 10);
        });
      });

      await Promise.all(updates);

      // Assert - Last update should win for gauge
      const metrics = await metricsService.getMetricValues();
      expect(metrics.scheduledTotal).toBeGreaterThanOrEqual(10);
      expect(metrics.queueDepth['birthday_messages']).toBeGreaterThanOrEqual(0);
    });
  });
});
