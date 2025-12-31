/**
 * System Metrics Service Unit Tests
 *
 * Tests for comprehensive system-level metrics collection
 */

import { describe, it, expect } from 'vitest';
import { systemMetricsService } from '../../../src/services/system-metrics.service.js';

describe('SystemMetricsService', () => {
  // Use the singleton instance to avoid registry conflicts
  const service = systemMetricsService;

  describe('Initialization', () => {
    it('should create metrics service with default config', () => {
      expect(service).toBeDefined();
      expect(service.systemLoadAverage).toBeDefined();
      expect(service.systemMemoryFree).toBeDefined();
      expect(service.systemMemoryTotal).toBeDefined();
      expect(service.systemUptime).toBeDefined();
      expect(service.systemCpuCount).toBeDefined();
    });

    it('should create event loop metrics', () => {
      expect(service.eventLoopUtilization).toBeDefined();
      expect(service.eventLoopActive).toBeDefined();
      expect(service.eventLoopIdle).toBeDefined();
    });

    it('should create GC metrics', () => {
      expect(service.gcPauseSeconds).toBeDefined();
      expect(service.gcRunsTotal).toBeDefined();
    });

    it('should create heap metrics', () => {
      expect(service.heapSpaceUsed).toBeDefined();
      expect(service.heapSpaceSize).toBeDefined();
      expect(service.heapSpaceAvailable).toBeDefined();
      expect(service.externalMemory).toBeDefined();
      expect(service.arrayBufferMemory).toBeDefined();
    });
  });

  describe('Metrics Collection', () => {
    it('should start metrics collection', () => {
      service.start();
      // Wait a bit to ensure collection happens
      return new Promise((resolve) => setTimeout(resolve, 200));
    });

    it('should collect system metrics snapshot', () => {
      const snapshot = service.getSnapshot();

      expect(snapshot).toBeDefined();
      expect(snapshot.loadAverage).toHaveLength(3);
      expect(snapshot.memory.free).toBeGreaterThan(0);
      expect(snapshot.memory.total).toBeGreaterThan(0);
      expect(snapshot.memory.used).toBeGreaterThanOrEqual(0);
      expect(snapshot.memory.usedPercent).toBeGreaterThanOrEqual(0);
      expect(snapshot.memory.usedPercent).toBeLessThanOrEqual(100);
      expect(snapshot.uptime).toBeGreaterThan(0);
      expect(snapshot.cpuCount).toBeGreaterThan(0);
    });

    it('should handle multiple start calls gracefully', () => {
      service.start();
      service.start(); // Should log warning but not crash

      // Verify service is still running
      const snapshot = service.getSnapshot();
      expect(snapshot).toBeDefined();
    });
  });

  describe('Graceful Shutdown', () => {
    it('should stop metrics collection', async () => {
      service.start();
      await service.stop();

      // Verify service stopped
      const snapshot = service.getSnapshot();
      expect(snapshot).toBeDefined(); // Snapshot should still work
    });

    it('should handle multiple stop calls gracefully', async () => {
      service.start();
      await service.stop();
      await service.stop(); // Should log warning but not crash
    });

    it('should stop within timeout', async () => {
      service.start();

      const startTime = Date.now();
      await service.stop(5000);
      const duration = Date.now() - startTime;

      expect(duration).toBeLessThan(5000);
    });
  });

  describe('Memory Metrics', () => {
    it('should report system memory correctly', () => {
      const snapshot = service.getSnapshot();

      // Total should be greater than free
      expect(snapshot.memory.total).toBeGreaterThan(snapshot.memory.free);

      // Used should equal total - free
      expect(snapshot.memory.used).toBe(snapshot.memory.total - snapshot.memory.free);

      // Percent should be calculated correctly
      const expectedPercent = (snapshot.memory.used / snapshot.memory.total) * 100;
      expect(snapshot.memory.usedPercent).toBeCloseTo(expectedPercent, 2);
    });
  });

  describe('Load Average Metrics', () => {
    it('should report load averages', () => {
      const snapshot = service.getSnapshot();

      expect(snapshot.loadAverage[0]).toBeGreaterThanOrEqual(0); // 1m
      expect(snapshot.loadAverage[1]).toBeGreaterThanOrEqual(0); // 5m
      expect(snapshot.loadAverage[2]).toBeGreaterThanOrEqual(0); // 15m
    });
  });

  describe('System Uptime', () => {
    it('should report system uptime', () => {
      const snapshot = service.getSnapshot();

      expect(snapshot.uptime).toBeGreaterThan(0);
    });
  });

  describe('CPU Count', () => {
    it('should report CPU count', () => {
      const snapshot = service.getSnapshot();

      expect(snapshot.cpuCount).toBeGreaterThan(0);
      expect(Number.isInteger(snapshot.cpuCount)).toBe(true);
    });
  });
});
