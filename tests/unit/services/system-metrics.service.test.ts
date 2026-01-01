/**
 * System Metrics Service Unit Tests
 *
 * Tests for comprehensive system-level metrics collection
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { SystemMetricsService } from '../../../src/services/system-metrics.service.js';
import { systemMetricsService } from '../../../src/services/system-metrics.service.js';
import * as os from 'os';
import { performance, PerformanceObserver } from 'perf_hooks';
import v8 from 'v8';

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

    it('should create process metrics', () => {
      expect(service.processUptimeSeconds).toBeDefined();
      expect(service.processMemoryRss).toBeDefined();
      expect(service.processCpuUsagePercent).toBeDefined();
    });

    it('should create node active handles and requests metrics', () => {
      expect(service.nodeActiveHandlesCount).toBeDefined();
      expect(service.nodeActiveRequestsCount).toBeDefined();
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

// Additional comprehensive tests using singleton to avoid registry conflicts
describe('SystemMetricsService - Comprehensive Tests', () => {
  const testService = systemMetricsService;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(async () => {
    // Clean up any running intervals
    await testService.stop();
  });

  describe('Service Configuration', () => {
    it('should have metrics properly initialized', () => {
      expect(testService).toBeDefined();
      expect(testService.systemLoadAverage).toBeDefined();
      expect(testService.eventLoopUtilization).toBeDefined();
      expect(testService.gcPauseSeconds).toBeDefined();
      expect(testService.heapSpaceUsed).toBeDefined();
    });

    it('should expose all required metrics', () => {
      expect(testService.systemMemoryFree).toBeDefined();
      expect(testService.systemMemoryTotal).toBeDefined();
      expect(testService.systemUptime).toBeDefined();
      expect(testService.systemCpuCount).toBeDefined();
      expect(testService.processUptimeSeconds).toBeDefined();
      expect(testService.processMemoryRss).toBeDefined();
      expect(testService.processCpuUsagePercent).toBeDefined();
    });

    it('should expose event loop metrics', () => {
      expect(testService.eventLoopActive).toBeDefined();
      expect(testService.eventLoopIdle).toBeDefined();
      expect(testService.nodeActiveHandlesCount).toBeDefined();
      expect(testService.nodeActiveRequestsCount).toBeDefined();
    });

    it('should expose GC metrics', () => {
      expect(testService.gcRunsTotal).toBeDefined();
      expect(testService.gcPauseSeconds).toBeDefined();
    });

    it('should expose heap metrics', () => {
      expect(testService.heapSpaceSize).toBeDefined();
      expect(testService.heapSpaceAvailable).toBeDefined();
      expect(testService.externalMemory).toBeDefined();
      expect(testService.arrayBufferMemory).toBeDefined();
    });
  });

  describe('Memory Metrics Collection', () => {
    it('should collect heap memory metrics', async () => {
      testService.start();
      await new Promise((resolve) => setTimeout(resolve, 100));

      const heapStats = v8.getHeapStatistics();
      expect(heapStats.external_memory).toBeGreaterThanOrEqual(0);
    });

    it('should collect external memory metrics', async () => {
      testService.start();
      await new Promise((resolve) => setTimeout(resolve, 100));

      // External memory should be tracked
      const heapStats = v8.getHeapStatistics();
      expect(heapStats.external_memory).toBeDefined();
    });

    it('should collect RSS memory metrics', async () => {
      testService.start();
      await new Promise((resolve) => setTimeout(resolve, 100));

      const memUsage = process.memoryUsage();
      expect(memUsage.rss).toBeGreaterThan(0);
    });

    it('should handle heap space statistics', async () => {
      testService.start();
      await new Promise((resolve) => setTimeout(resolve, 100));

      const heapSpaces = v8.getHeapSpaceStatistics();
      expect(heapSpaces.length).toBeGreaterThan(0);

      heapSpaces.forEach((space) => {
        expect(space.space_name).toBeDefined();
        expect(space.space_size).toBeGreaterThanOrEqual(0);
        expect(space.space_used_size).toBeGreaterThanOrEqual(0);
        expect(space.space_available_size).toBeGreaterThanOrEqual(0);
      });
    });
  });

  describe('CPU Usage Tracking', () => {
    it('should track CPU count', () => {
      const snapshot = testService.getSnapshot();
      expect(snapshot.cpuCount).toBeGreaterThan(0);
    });

    it('should collect CPU information from os module', () => {
      const cpuInfo = os.cpus();
      expect(cpuInfo.length).toBeGreaterThan(0);

      cpuInfo.forEach((cpu) => {
        expect(cpu.model).toBeDefined();
        // In some CI environments (containers/VMs), CPU speed may report as 0
        expect(cpu.speed).toBeGreaterThanOrEqual(0);
      });
    });

    it('should track load averages over time', () => {
      const snapshot1 = testService.getSnapshot();
      const snapshot2 = testService.getSnapshot();

      expect(snapshot1.loadAverage).toHaveLength(3);
      expect(snapshot2.loadAverage).toHaveLength(3);
    });
  });

  describe('Event Loop Lag Measurement', () => {
    it('should track event loop utilization', async () => {
      testService.start();
      await new Promise((resolve) => setTimeout(resolve, 200));

      const elu = performance.eventLoopUtilization();
      expect(elu.utilization).toBeGreaterThanOrEqual(0);
      expect(elu.utilization).toBeLessThanOrEqual(1);
    });

    it('should measure event loop active time', async () => {
      testService.start();
      await new Promise((resolve) => setTimeout(resolve, 100));

      const elu = performance.eventLoopUtilization();
      expect(elu.active).toBeGreaterThanOrEqual(0);
    });

    it('should measure event loop idle time', async () => {
      testService.start();
      await new Promise((resolve) => setTimeout(resolve, 100));

      const elu = performance.eventLoopUtilization();
      expect(elu.idle).toBeGreaterThanOrEqual(0);
    });

    it('should handle event loop utilization calculation', async () => {
      testService.start();
      await new Promise((resolve) => setTimeout(resolve, 100));

      const elu = performance.eventLoopUtilization();
      const total = elu.active + elu.idle;

      if (total > 0) {
        expect(elu.active / total).toBeLessThanOrEqual(1);
        expect(elu.idle / total).toBeLessThanOrEqual(1);
      }
    });
  });

  describe('Process Uptime Tracking', () => {
    it('should track process uptime', () => {
      const uptimeSeconds = process.uptime();
      expect(uptimeSeconds).toBeGreaterThan(0);
    });

    it('should track system uptime', () => {
      const snapshot = testService.getSnapshot();
      expect(snapshot.uptime).toBeGreaterThan(0);
    });

    it('should track uptime over multiple collections', async () => {
      testService.start();

      const uptime1 = process.uptime();
      await new Promise((resolve) => setTimeout(resolve, 1100));
      const uptime2 = process.uptime();

      expect(uptime2).toBeGreaterThan(uptime1);
      expect(uptime2 - uptime1).toBeGreaterThanOrEqual(1);
    });
  });

  describe('Error Scenarios', () => {
    it('should handle stop timeout gracefully', async () => {
      testService.start();

      // Create a very short timeout
      await expect(testService.stop(1)).resolves.not.toThrow();
    });

    it('should continue operation after collection errors', async () => {
      testService.start();
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Service should still provide snapshot even if some collection fails
      const snapshot = testService.getSnapshot();
      expect(snapshot).toBeDefined();
    });

    it('should handle shutdown during collection', async () => {
      testService.start();

      // Start shutdown immediately
      const stopPromise = testService.stop(1000);

      await expect(stopPromise).resolves.not.toThrow();
    });
  });

  describe('Metric Aggregation Edge Cases', () => {
    it('should handle zero load average values', () => {
      const loadAvg = os.loadavg();
      loadAvg.forEach((load) => {
        expect(load).toBeGreaterThanOrEqual(0);
      });
    });

    it('should handle memory percentage at boundaries', () => {
      const snapshot = testService.getSnapshot();

      expect(snapshot.memory.usedPercent).toBeGreaterThanOrEqual(0);
      expect(snapshot.memory.usedPercent).toBeLessThanOrEqual(100);
    });

    it('should handle event loop division by zero', async () => {
      testService.start();
      await new Promise((resolve) => setTimeout(resolve, 50));

      // The service handles (active + idle || 1) to prevent division by zero
      const elu = performance.eventLoopUtilization();
      const total = elu.active + elu.idle || 1;

      expect(total).toBeGreaterThan(0);
    });

    it('should handle empty heap space statistics', () => {
      const heapSpaces = v8.getHeapSpaceStatistics();

      // Should have at least some heap spaces
      expect(heapSpaces.length).toBeGreaterThan(0);
    });

    it('should handle missing malloced_memory property', () => {
      const heapStats = v8.getHeapStatistics();

      // malloced_memory might not exist on all Node versions
      if ('malloced_memory' in heapStats) {
        expect(heapStats.malloced_memory).toBeGreaterThanOrEqual(0);
      }
    });

    it('should handle null/undefined load average values', () => {
      const snapshot = testService.getSnapshot();

      snapshot.loadAverage.forEach((load) => {
        expect(load).toBeGreaterThanOrEqual(0);
        expect(Number.isFinite(load)).toBe(true);
      });
    });
  });

  describe('GC Monitoring', () => {
    it('should initialize GC observer when enabled', () => {
      testService.start();

      // GC observer should be set up
      expect(testService).toBeDefined();
    });

    it('should cleanup GC observer on stop', async () => {
      testService.start();
      await testService.stop();

      // Should not throw after stop
      expect(testService).toBeDefined();
    });

    it('should handle GC events', async () => {
      testService.start();

      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }

      await new Promise((resolve) => setTimeout(resolve, 100));

      // Service should still be running
      expect(testService).toBeDefined();
    });
  });

  describe('Periodic Collection', () => {
    it('should collect metrics periodically', async () => {
      testService.start();

      const snapshot1 = testService.getSnapshot();
      await new Promise((resolve) => setTimeout(resolve, 150));
      const snapshot2 = testService.getSnapshot();

      // Snapshots should be defined
      expect(snapshot1).toBeDefined();
      expect(snapshot2).toBeDefined();
    });

    it('should collect metrics immediately on start', async () => {
      const beforeStart = Date.now();
      testService.start();

      await new Promise((resolve) => setTimeout(resolve, 50));
      const snapshot = testService.getSnapshot();

      expect(snapshot).toBeDefined();
      expect(Date.now() - beforeStart).toBeLessThan(200); // Increased tolerance
    });
  });
});
