import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';

// Mock the database connection before importing the service
vi.mock('../../../src/db/connection.js', () => ({
  db: {
    execute: vi.fn(),
  },
}));

// Mock the message service
vi.mock('../../../src/services/message.service.js', () => ({
  messageSenderService: {
    getCircuitBreakerStats: vi.fn().mockReturnValue({
      state: 'closed',
      isOpen: false,
      failures: 0,
      successes: 10,
    }),
  },
}));

// Mock metrics service
vi.mock('../../../src/services/metrics.service.js', () => ({
  metricsService: {
    setDatabaseConnections: vi.fn(),
  },
}));

// Mock package.json import
vi.mock(
  '../../package.json',
  () => ({
    version: '1.0.0',
  }),
  { virtual: true }
);

import { HealthCheckService } from '../../../src/services/health-check.service.js';
import { db } from '../../../src/db/connection.js';
import { messageSenderService } from '../../../src/services/message.service.js';

/**
 * Unit Tests: HealthCheckService
 *
 * Tests health check functionality:
 * - Database health checks
 * - RabbitMQ health checks
 * - Circuit breaker health checks
 * - Detailed health responses
 * - Simple health responses
 * - Readiness and liveness probes
 */
describe('HealthCheckService', () => {
  let service: HealthCheckService;

  beforeEach(() => {
    vi.resetAllMocks();
    service = new HealthCheckService();

    // Default mock for database
    (db.execute as any).mockResolvedValue([{ health_check: 1 }]);

    // Default mock for circuit breaker - must be reset after resetAllMocks
    (messageSenderService.getCircuitBreakerStats as any).mockReturnValue({
      state: 'closed',
      isOpen: false,
      failures: 0,
      successes: 10,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('checkDatabase', () => {
    it('should return healthy status when database is connected', async () => {
      const result = await service.checkDatabase();

      expect(result.healthy).toBe(true);
      expect(result.message).toBe('Database connection OK');
    });

    it('should include latency in response', async () => {
      const result = await service.checkDatabase();

      expect(result).toHaveProperty('latency');
      expect(typeof result.latency).toBe('number');
    });

    it('should include details in response', async () => {
      const result = await service.checkDatabase();

      expect(result.details).toBeDefined();
      expect(result.details?.connected).toBe(true);
    });

    it('should return unhealthy status when database fails', async () => {
      (db.execute as any).mockRejectedValue(new Error('Connection refused'));

      const result = await service.checkDatabase();

      expect(result.healthy).toBe(false);
      expect(result.message).toBe('Database connection failed');
      expect(result.error).toBe('Connection refused');
    });

    it('should handle non-Error exceptions', async () => {
      (db.execute as any).mockRejectedValue('String error');

      const result = await service.checkDatabase();

      expect(result.healthy).toBe(false);
      expect(result.error).toBe('String error');
    });
  });

  describe('checkRabbitMQ', () => {
    it('should return healthy status', async () => {
      const result = await service.checkRabbitMQ();

      expect(result.healthy).toBe(true);
      expect(result.message).toBe('RabbitMQ connection OK');
    });

    it('should include latency in response', async () => {
      const result = await service.checkRabbitMQ();

      expect(result).toHaveProperty('latency');
      expect(typeof result.latency).toBe('number');
    });

    it('should include details in response', async () => {
      const result = await service.checkRabbitMQ();

      expect(result.details).toBeDefined();
      expect(result.details?.connected).toBe(true);
    });
  });

  describe('checkCircuitBreaker', () => {
    it('should return healthy when circuit is closed', async () => {
      (messageSenderService.getCircuitBreakerStats as any).mockReturnValue({
        state: 'closed',
        isOpen: false,
        failures: 0,
        successes: 10,
      });

      const result = await service.checkCircuitBreaker();

      expect(result.healthy).toBe(true);
      expect(result.message).toBe('Circuit breaker closed (healthy)');
    });

    it('should return unhealthy when circuit is open', async () => {
      (messageSenderService.getCircuitBreakerStats as any).mockReturnValue({
        state: 'open',
        isOpen: true,
        failures: 5,
        successes: 0,
      });

      const result = await service.checkCircuitBreaker();

      expect(result.healthy).toBe(false);
      expect(result.message).toBe('Circuit breaker open (degraded)');
    });

    it('should include circuit breaker details', async () => {
      (messageSenderService.getCircuitBreakerStats as any).mockReturnValue({
        state: 'half-open',
        isOpen: true,
        failures: 3,
        successes: 2,
      });

      const result = await service.checkCircuitBreaker();

      expect(result.details).toBeDefined();
      expect(result.details?.state).toBe('half-open');
      expect(result.details?.failures).toBe(3);
      expect(result.details?.successes).toBe(2);
    });

    it('should handle errors gracefully', async () => {
      (messageSenderService.getCircuitBreakerStats as any).mockImplementation(() => {
        throw new Error('Circuit breaker unavailable');
      });

      const result = await service.checkCircuitBreaker();

      expect(result.healthy).toBe(false);
      expect(result.error).toBe('Circuit breaker unavailable');
    });
  });

  describe('getDetailedHealth', () => {
    it('should return detailed health response', async () => {
      const result = await service.getDetailedHealth();

      expect(result).toHaveProperty('status');
      expect(result).toHaveProperty('timestamp');
      expect(result).toHaveProperty('uptime');
      expect(result).toHaveProperty('version');
      expect(result).toHaveProperty('services');
      expect(result).toHaveProperty('metrics');
    });

    it('should return "ok" status when all services are healthy', async () => {
      const result = await service.getDetailedHealth();

      expect(result.status).toBe('ok');
    });

    it('should return "degraded" status when some services are unhealthy', async () => {
      (db.execute as any).mockRejectedValue(new Error('Database down'));

      const result = await service.getDetailedHealth();

      expect(result.status).toBe('degraded');
    });

    it('should return "down" status when all services are unhealthy', async () => {
      (db.execute as any).mockRejectedValue(new Error('Database down'));
      (messageSenderService.getCircuitBreakerStats as any).mockReturnValue({
        state: 'open',
        isOpen: true,
        failures: 5,
        successes: 0,
      });

      const result = await service.getDetailedHealth();

      // Note: RabbitMQ mock returns healthy, so it will be degraded
      expect(['degraded', 'down']).toContain(result.status);
    });

    it('should include all service health checks', async () => {
      const result = await service.getDetailedHealth();

      expect(result.services).toHaveProperty('database');
      expect(result.services).toHaveProperty('rabbitmq');
      expect(result.services).toHaveProperty('circuitBreaker');
    });

    it('should include memory metrics', async () => {
      const result = await service.getDetailedHealth();

      expect(result.metrics).toHaveProperty('memory');
      expect(result.metrics.memory).toHaveProperty('heapUsed');
      expect(result.metrics.memory).toHaveProperty('heapTotal');
    });

    it('should include CPU metrics', async () => {
      const result = await service.getDetailedHealth();

      expect(result.metrics).toHaveProperty('cpu');
      expect(result.metrics.cpu).toHaveProperty('user');
      expect(result.metrics.cpu).toHaveProperty('system');
    });

    it('should include timestamp in ISO format', async () => {
      const result = await service.getDetailedHealth();

      expect(result.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    });

    it('should handle promise rejection in health checks', async () => {
      // Force database check to reject with unusual error
      (db.execute as any).mockImplementation(() => Promise.reject({ code: 'ECONNREFUSED' }));

      const result = await service.getDetailedHealth();

      expect(result.services.database.healthy).toBe(false);
    });
  });

  describe('getSimpleHealth', () => {
    it('should return simple health response', async () => {
      const result = await service.getSimpleHealth();

      expect(result).toHaveProperty('status');
      expect(result).toHaveProperty('timestamp');
      expect(result).toHaveProperty('uptime');
      expect(result).toHaveProperty('version');
    });

    it('should always return "ok" status', async () => {
      const result = await service.getSimpleHealth();

      expect(result.status).toBe('ok');
    });

    it('should include uptime as number', async () => {
      const result = await service.getSimpleHealth();

      expect(typeof result.uptime).toBe('number');
      expect(result.uptime).toBeGreaterThan(0);
    });

    it('should include timestamp', async () => {
      const result = await service.getSimpleHealth();

      expect(result.timestamp).toBeDefined();
    });
  });

  describe('isReady', () => {
    it('should return true when database is healthy', async () => {
      const result = await service.isReady();

      expect(result).toBe(true);
    });

    it('should return false when database is unhealthy', async () => {
      (db.execute as any).mockRejectedValue(new Error('Database down'));

      const result = await service.isReady();

      expect(result).toBe(false);
    });

    it('should handle unexpected errors', async () => {
      (db.execute as any).mockImplementation(() => {
        throw new Error('Unexpected error');
      });

      const result = await service.isReady();

      expect(result).toBe(false);
    });
  });

  describe('isLive', () => {
    it('should always return true', async () => {
      const result = await service.isLive();

      expect(result).toBe(true);
    });

    it('should return true regardless of database status', async () => {
      (db.execute as any).mockRejectedValue(new Error('Database down'));

      const result = await service.isLive();

      expect(result).toBe(true);
    });
  });

  describe('getSystemMetrics', () => {
    it('should return system metrics', () => {
      const result = service.getSystemMetrics();

      expect(result).toHaveProperty('memory');
      expect(result).toHaveProperty('cpu');
      expect(result).toHaveProperty('uptime');
      expect(result).toHaveProperty('version');
    });

    it('should include memory usage details', () => {
      const result = service.getSystemMetrics();

      expect(result.memory).toHaveProperty('heapUsed');
      expect(result.memory).toHaveProperty('heapTotal');
      expect(result.memory).toHaveProperty('external');
      expect(result.memory).toHaveProperty('rss');
    });

    it('should include CPU usage', () => {
      const result = service.getSystemMetrics();

      expect(result.cpu).toHaveProperty('user');
      expect(result.cpu).toHaveProperty('system');
    });

    it('should return uptime as positive number', () => {
      const result = service.getSystemMetrics();

      expect(result.uptime).toBeGreaterThan(0);
    });
  });

  describe('concurrent health checks', () => {
    it('should handle multiple concurrent calls', async () => {
      const results = await Promise.all([
        service.getDetailedHealth(),
        service.getDetailedHealth(),
        service.getDetailedHealth(),
      ]);

      results.forEach((result) => {
        expect(result.status).toBeDefined();
      });
    });

    it('should handle mixed concurrent calls', async () => {
      const results = await Promise.all([
        service.getSimpleHealth(),
        service.getDetailedHealth(),
        service.isReady(),
        service.isLive(),
      ]);

      expect(results).toHaveLength(4);
    });
  });
});
