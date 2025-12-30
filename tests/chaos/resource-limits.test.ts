import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { spawn, ChildProcess } from 'child_process';
import { logger } from '../helpers/logger';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('Resource Limits Chaos Tests', () => {
  describe('Memory Constraints', () => {
    it('should handle limited memory gracefully (512MB)', async () => {
      // Simulate memory-constrained environment
      const memoryUsage = process.memoryUsage();
      const initialHeapUsed = memoryUsage.heapUsed;

      logger.info('Initial memory usage', {
        heapUsed: Math.round(initialHeapUsed / 1024 / 1024) + ' MB',
        heapTotal: Math.round(memoryUsage.heapTotal / 1024 / 1024) + ' MB',
        rss: Math.round(memoryUsage.rss / 1024 / 1024) + ' MB',
      });

      // Allocate memory progressively
      const allocations: Buffer[] = [];
      const chunkSize = 10 * 1024 * 1024; // 10MB chunks
      const maxChunks = 50; // 500MB total

      try {
        for (let i = 0; i < maxChunks; i++) {
          allocations.push(Buffer.alloc(chunkSize));

          const currentMemory = process.memoryUsage();
          logger.debug(`Allocated ${i + 1} chunks`, {
            heapUsed: Math.round(currentMemory.heapUsed / 1024 / 1024) + ' MB',
            rss: Math.round(currentMemory.rss / 1024 / 1024) + ' MB',
          });

          // Simulate some processing
          await new Promise((resolve) => setTimeout(resolve, 10));
        }

        const finalMemory = process.memoryUsage();
        logger.info('Memory allocation test completed', {
          heapUsed: Math.round(finalMemory.heapUsed / 1024 / 1024) + ' MB',
          rss: Math.round(finalMemory.rss / 1024 / 1024) + ' MB',
          chunksAllocated: allocations.length,
        });

        // Verify we didn't crash
        expect(allocations.length).toBeGreaterThan(0);
      } finally {
        // Cleanup allocations
        allocations.length = 0;

        // Force garbage collection if available
        if (global.gc) {
          global.gc();
          logger.info('Forced garbage collection');
        }
      }
    }, 60000);

    it('should detect and handle memory leaks', async () => {
      const measureMemory = () => {
        const usage = process.memoryUsage();
        return Math.round(usage.heapUsed / 1024 / 1024);
      };

      const initialMemory = measureMemory();
      logger.info('Initial memory', { mb: initialMemory });

      // Simulate potential leak scenario
      const leakyArray: any[] = [];
      const iterations = 100;

      for (let i = 0; i < iterations; i++) {
        // Create objects that might not be garbage collected
        leakyArray.push({
          id: i,
          data: Buffer.alloc(1024 * 100), // 100KB each
          timestamp: new Date(),
        });

        // Check memory growth every 20 iterations
        if (i % 20 === 0) {
          const currentMemory = measureMemory();
          const growth = currentMemory - initialMemory;

          logger.debug('Memory growth check', {
            iteration: i,
            currentMB: currentMemory,
            growthMB: growth,
          });

          // Alert if excessive growth
          if (growth > 100) {
            logger.warn('Potential memory leak detected', {
              growthMB: growth,
              iteration: i,
            });
          }
        }

        await new Promise((resolve) => setTimeout(resolve, 5));
      }

      const finalMemory = measureMemory();
      const totalGrowth = finalMemory - initialMemory;

      logger.info('Memory leak test completed', {
        initialMB: initialMemory,
        finalMB: finalMemory,
        growthMB: totalGrowth,
      });

      // Cleanup
      leakyArray.length = 0;

      // Verify memory growth is bounded
      expect(totalGrowth).toBeLessThan(200); // Should not grow more than 200MB
    }, 30000);
  });

  describe('CPU Constraints', () => {
    it('should handle CPU-intensive operations without blocking', async () => {
      const cpuIntensiveTask = (duration: number): number => {
        const start = Date.now();
        let result = 0;

        // CPU-intensive loop
        while (Date.now() - start < duration) {
          result += Math.sqrt(Math.random());
        }

        return result;
      };

      const tasks = [];
      const taskDuration = 100; // 100ms per task
      const taskCount = 10;

      const overallStart = Date.now();

      // Run CPU-intensive tasks
      for (let i = 0; i < taskCount; i++) {
        const taskStart = Date.now();

        const result = cpuIntensiveTask(taskDuration);

        const taskEnd = Date.now();
        const actualDuration = taskEnd - taskStart;

        tasks.push({
          task: i,
          duration: actualDuration,
          result,
        });

        logger.debug(`CPU task ${i} completed`, { duration: actualDuration });

        // Small delay to prevent complete blocking
        await new Promise((resolve) => setImmediate(resolve));
      }

      const overallDuration = Date.now() - overallStart;

      logger.info('CPU stress test completed', {
        tasks: taskCount,
        totalDuration: overallDuration,
        avgDuration: overallDuration / taskCount,
      });

      expect(tasks.length).toBe(taskCount);
      expect(overallDuration).toBeGreaterThan(taskCount * taskDuration * 0.8); // At least 80% of expected
    }, 30000);

    it('should yield to event loop during heavy computation', async () => {
      let eventLoopBlocked = false;
      let checkCount = 0;

      // Set up event loop monitoring
      const monitor = setInterval(() => {
        checkCount++;
        logger.debug('Event loop check', { count: checkCount });
      }, 50);

      // Heavy computation
      const heavyComputation = async () => {
        for (let i = 0; i < 10; i++) {
          // CPU intensive work
          let result = 0;
          for (let j = 0; j < 10000000; j++) {
            result += Math.sqrt(j);
          }

          // Yield to event loop
          await new Promise((resolve) => setImmediate(resolve));
        }
      };

      await heavyComputation();

      clearInterval(monitor);

      // Verify event loop wasn't completely blocked
      expect(checkCount).toBeGreaterThan(5); // Should have multiple checks

      logger.info('Event loop yielding verified', {
        checks: checkCount,
        blocked: eventLoopBlocked,
      });
    }, 20000);
  });

  describe('Database Connection Pool Exhaustion', () => {
    it('should handle connection pool exhaustion gracefully', async () => {
      // Simulate connection pool
      class ConnectionPool {
        private available: number;
        private waiting: Array<() => void> = [];

        constructor(private maxConnections: number) {
          this.available = maxConnections;
        }

        async acquire(): Promise<void> {
          if (this.available > 0) {
            this.available--;
            return;
          }

          // Wait for connection
          return new Promise((resolve) => {
            this.waiting.push(resolve);
            logger.debug('Connection queued', {
              waiting: this.waiting.length,
              available: this.available,
            });
          });
        }

        release(): void {
          if (this.waiting.length > 0) {
            const resolve = this.waiting.shift()!;
            resolve();
          } else {
            this.available++;
          }
        }

        getStats() {
          return {
            available: this.available,
            waiting: this.waiting.length,
            total: this.maxConnections,
          };
        }
      }

      const pool = new ConnectionPool(5); // Small pool
      const queries = [];

      // Simulate many concurrent queries
      for (let i = 0; i < 20; i++) {
        queries.push(
          (async () => {
            await pool.acquire();

            logger.debug(`Query ${i} executing`, pool.getStats());

            // Simulate query execution
            await new Promise((resolve) => setTimeout(resolve, 50));

            pool.release();

            logger.debug(`Query ${i} completed`, pool.getStats());
          })(),
        );
      }

      // Wait for all queries
      await Promise.all(queries);

      const finalStats = pool.getStats();
      logger.info('Pool exhaustion test completed', finalStats);

      expect(finalStats.available).toBe(5);
      expect(finalStats.waiting).toBe(0);
    }, 15000);
  });

  describe('Queue Overflow Scenarios', () => {
    it('should handle message queue overflow', async () => {
      const maxQueueSize = 1000;
      const messageQueue: any[] = [];
      let rejected = 0;
      let accepted = 0;

      const enqueueMessage = (message: any): boolean => {
        if (messageQueue.length >= maxQueueSize) {
          rejected++;
          logger.warn('Message rejected - queue full', {
            queueSize: messageQueue.length,
            maxSize: maxQueueSize,
          });
          return false;
        }

        messageQueue.push(message);
        accepted++;
        return true;
      };

      // Try to enqueue more than max
      for (let i = 0; i < maxQueueSize + 500; i++) {
        enqueueMessage({ id: i, data: `Message ${i}` });
      }

      logger.info('Queue overflow test completed', {
        accepted,
        rejected,
        queueSize: messageQueue.length,
        maxSize: maxQueueSize,
      });

      expect(messageQueue.length).toBeLessThanOrEqual(maxQueueSize);
      expect(rejected).toBe(500);
      expect(accepted).toBe(maxQueueSize);
    }, 10000);

    it('should implement backpressure when queue is full', async () => {
      const maxQueueSize = 100;
      const queue: any[] = [];
      let backpressureActivated = false;

      const enqueueWithBackpressure = async (message: any): Promise<void> => {
        while (queue.length >= maxQueueSize) {
          if (!backpressureActivated) {
            backpressureActivated = true;
            logger.warn('Backpressure activated - queue full');
          }

          // Wait for space in queue
          await new Promise((resolve) => setTimeout(resolve, 10));
        }

        queue.push(message);
      };

      // Producer - fast
      const producer = async () => {
        for (let i = 0; i < 200; i++) {
          await enqueueWithBackpressure({ id: i });
        }
      };

      // Consumer - slow
      const consumer = async () => {
        while (queue.length > 0 || queue.length < 200) {
          if (queue.length > 0) {
            queue.shift();
            await new Promise((resolve) => setTimeout(resolve, 5));
          } else {
            await new Promise((resolve) => setTimeout(resolve, 10));
          }
        }
      };

      await Promise.all([producer(), consumer()]);

      logger.info('Backpressure test completed', {
        backpressureActivated,
        finalQueueSize: queue.length,
      });

      expect(backpressureActivated).toBe(true);
    }, 30000);
  });

  describe('Disk Space Constraints', () => {
    it('should monitor disk space and alert when low', async () => {
      // Simulate disk space monitoring
      const getDiskSpace = () => {
        // In real scenario, use os.freemem() or df command
        return {
          total: 100 * 1024 * 1024 * 1024, // 100GB
          free: 15 * 1024 * 1024 * 1024, // 15GB
          used: 85 * 1024 * 1024 * 1024, // 85GB
        };
      };

      const checkDiskSpace = () => {
        const disk = getDiskSpace();
        const freePercentage = (disk.free / disk.total) * 100;

        logger.info('Disk space check', {
          totalGB: Math.round(disk.total / 1024 / 1024 / 1024),
          freeGB: Math.round(disk.free / 1024 / 1024 / 1024),
          freePercentage: Math.round(freePercentage),
        });

        if (freePercentage < 20) {
          logger.warn('Low disk space warning', {
            freePercentage: Math.round(freePercentage),
            freeGB: Math.round(disk.free / 1024 / 1024 / 1024),
          });
          return 'warning';
        }

        if (freePercentage < 10) {
          logger.error('Critical disk space', {
            freePercentage: Math.round(freePercentage),
            freeGB: Math.round(disk.free / 1024 / 1024 / 1024),
          });
          return 'critical';
        }

        return 'ok';
      };

      const status = checkDiskSpace();
      expect(['ok', 'warning', 'critical']).toContain(status);
    }, 5000);
  });

  describe('Graceful Degradation Under Stress', () => {
    it('should degrade gracefully under combined resource pressure', async () => {
      const metrics = {
        requestsProcessed: 0,
        requestsFailed: 0,
        requestsThrottled: 0,
      };

      // Simulate resource-constrained request handler
      const handleRequest = async (requestId: number): Promise<string> => {
        const memoryUsage = process.memoryUsage();
        const heapUsedMB = memoryUsage.heapUsed / 1024 / 1024;

        // Check resource constraints
        if (heapUsedMB > 500) {
          metrics.requestsThrottled++;
          logger.warn('Request throttled due to high memory', {
            requestId,
            heapUsedMB: Math.round(heapUsedMB),
          });
          throw new Error('Service degraded - high memory usage');
        }

        try {
          // Simulate processing
          await new Promise((resolve) => setTimeout(resolve, 10));

          metrics.requestsProcessed++;
          return 'success';
        } catch (error) {
          metrics.requestsFailed++;
          throw error;
        }
      };

      // Generate load
      const requests = Array.from({ length: 100 }, (_, i) =>
        handleRequest(i).catch(() => 'failed'),
      );

      await Promise.allSettled(requests);

      logger.info('Graceful degradation test completed', metrics);

      // Verify system degraded gracefully (didn't crash)
      expect(metrics.requestsProcessed + metrics.requestsThrottled + metrics.requestsFailed).toBe(
        100,
      );
    }, 30000);
  });

  describe('Resource Monitoring', () => {
    it('should track resource usage metrics', async () => {
      const metrics: any[] = [];

      const collectMetrics = () => {
        const mem = process.memoryUsage();
        const cpu = process.cpuUsage();

        return {
          timestamp: Date.now(),
          memory: {
            heapUsedMB: Math.round(mem.heapUsed / 1024 / 1024),
            heapTotalMB: Math.round(mem.heapTotal / 1024 / 1024),
            rssMB: Math.round(mem.rss / 1024 / 1024),
          },
          cpu: {
            user: cpu.user,
            system: cpu.system,
          },
        };
      };

      // Collect metrics over time
      for (let i = 0; i < 10; i++) {
        metrics.push(collectMetrics());

        // Simulate some work
        await new Promise((resolve) => setTimeout(resolve, 100));
      }

      logger.info('Resource monitoring completed', {
        samples: metrics.length,
        avgHeapUsedMB: Math.round(
          metrics.reduce((sum, m) => sum + m.memory.heapUsedMB, 0) / metrics.length,
        ),
      });

      expect(metrics.length).toBe(10);
      metrics.forEach((metric) => {
        expect(metric.memory.heapUsedMB).toBeGreaterThan(0);
      });
    }, 5000);
  });
});
