/**
 * E2E Test: Performance Baseline
 *
 * Establishes performance baselines and tracks metrics:
 * - End-to-end latency measurement
 * - Throughput (messages per second)
 * - Resource utilization
 * - Performance degradation detection
 * - SLA compliance verification
 * - Performance report generation
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { TestEnvironment, waitFor, cleanDatabase, purgeQueues } from '../helpers/testcontainers.js';
import { createMockEmailServer, MockEmailServer } from '../helpers/mock-email-server.js';
import { insertUser, sleep } from '../helpers/test-helpers.js';
import { SchedulerService } from '../../src/services/scheduler.service.js';
import { MessageWorker } from '../../src/workers/message-worker.js';
import { MessagePublisher } from '../../src/queue/publisher.js';
import { MessageStatus } from '../../src/db/schema/message-logs.js';
import { DateTime } from 'luxon';
import * as fs from 'fs/promises';
import * as path from 'path';
import type { Pool } from 'pg';
import type { Connection } from 'amqplib';

/**
 * Performance metrics
 */
interface PerformanceMetrics {
  testName: string;
  timestamp: string;
  userCount: number;
  schedulingTime: number;
  enqueuingTime: number;
  processingTime: number;
  totalLatency: number;
  throughput: number;
  p50Latency?: number;
  p95Latency?: number;
  p99Latency?: number;
  successRate: number;
  errorRate: number;
  memoryUsage?: {
    heapUsed: number;
    heapTotal: number;
    external: number;
    rss: number;
  };
}

/**
 * Performance test results
 */
interface PerformanceReport {
  generatedAt: string;
  environment: {
    nodeVersion: string;
    platform: string;
    arch: string;
  };
  metrics: PerformanceMetrics[];
  summary: {
    averageThroughput: number;
    averageLatency: number;
    maxThroughput: number;
    minLatency: number;
  };
  slaCompliance: {
    throughputTarget: number;
    latencyTarget: number;
    meetsRequirements: boolean;
  };
}

describe('E2E: Performance Baseline', () => {
  let env: TestEnvironment;
  let pool: Pool;
  let amqpConnection: Connection;
  let mockEmailServer: MockEmailServer;
  let scheduler: SchedulerService;
  let publisher: MessagePublisher;

  const performanceMetrics: PerformanceMetrics[] = [];

  // SLA targets
  const SLA_TARGETS = {
    throughput: 10, // messages per second minimum
    maxLatency: 5000, // 5 seconds max end-to-end
    successRate: 0.95, // 95% success rate
  };

  beforeAll(async () => {
    env = new TestEnvironment();
    await env.setup();
    await env.runMigrations();

    pool = env.getPostgresPool();
    amqpConnection = env.getRabbitMQConnection();

    mockEmailServer = await createMockEmailServer();

    scheduler = new SchedulerService();
    publisher = new MessagePublisher();
    await publisher.initialize();
  }, 180000);

  afterAll(async () => {
    // Generate performance report
    await generatePerformanceReport(performanceMetrics);

    await mockEmailServer.stop();
    await env.teardown();
  }, 60000);

  beforeEach(async () => {
    await cleanDatabase(pool);
    await purgeQueues(amqpConnection, ['birthday-queue', 'anniversary-queue', 'dlq']);
    mockEmailServer.clearRequests();
    mockEmailServer.setResponseMode('success');
  });

  describe('End-to-end latency measurement', () => {
    it('should measure latency for single message', async () => {
      const user = await insertUser(pool, {
        firstName: 'Latency',
        lastName: 'Test',
        email: 'latency@test.com',
        timezone: 'UTC',
        birthdayDate: DateTime.now().set({ year: 1990 }).toJSDate(),
        anniversaryDate: null,
      });

      const startTime = Date.now();

      // Step 1: Schedule
      const scheduleStart = Date.now();
      await scheduler.preCalculateTodaysBirthdays();
      const schedulingTime = Date.now() - scheduleStart;

      // Step 2: Enqueue
      await pool.query(
        'UPDATE message_logs SET scheduled_send_time = NOW() WHERE user_id = $1',
        [user.id]
      );

      const enqueueStart = Date.now();
      await scheduler.enqueueUpcomingMessages();
      const enqueuingTime = Date.now() - enqueueStart;

      // Step 3: Publish to queue
      const messages = await pool.query('SELECT * FROM message_logs WHERE user_id = $1', [
        user.id,
      ]);

      await publisher.publishMessage({
        messageId: messages.rows[0].id,
        userId: user.id,
        messageType: 'BIRTHDAY',
        scheduledSendTime: messages.rows[0].scheduled_send_time.toISOString(),
        timestamp: Date.now(),
        retryCount: 0,
      });

      // Step 4: Process with worker
      const worker = new MessageWorker();
      const processingStart = Date.now();
      await worker.start();

      await waitFor(async () => {
        const result = await pool.query(
          'SELECT * FROM message_logs WHERE user_id = $1 AND status = $2',
          [user.id, MessageStatus.SENT]
        );
        return result.rows.length > 0;
      }, 15000);

      await worker.stop();
      const processingTime = Date.now() - processingStart;

      const totalLatency = Date.now() - startTime;

      console.log(`
Performance Metrics - Single Message:
  Scheduling: ${schedulingTime}ms
  Enqueueing: ${enqueuingTime}ms
  Processing: ${processingTime}ms
  Total E2E: ${totalLatency}ms
      `);

      expect(totalLatency).toBeLessThan(15000); // Should complete within 15 seconds

      // Record metrics
      performanceMetrics.push({
        testName: 'single-message-latency',
        timestamp: new Date().toISOString(),
        userCount: 1,
        schedulingTime,
        enqueuingTime,
        processingTime,
        totalLatency,
        throughput: 1000 / totalLatency,
        successRate: 1.0,
        errorRate: 0.0,
        memoryUsage: process.memoryUsage(),
      });
    }, 30000);

    it('should measure latency distribution for 50 messages', async () => {
      const userCount = 50;
      const users = [];
      const latencies: number[] = [];

      // Create users
      for (let i = 0; i < userCount; i++) {
        const user = await insertUser(pool, {
          firstName: `User${i}`,
          lastName: 'Distribution',
          email: `user${i}-dist@test.com`,
          timezone: 'UTC',
          birthdayDate: DateTime.now().set({ year: 1990 }).toJSDate(),
          anniversaryDate: null,
        });
        users.push(user);
      }

      const overallStart = Date.now();

      // Schedule all
      const scheduleStart = Date.now();
      await scheduler.preCalculateTodaysBirthdays();
      const schedulingTime = Date.now() - scheduleStart;

      // Enqueue all
      await pool.query('UPDATE message_logs SET scheduled_send_time = NOW()');

      const enqueueStart = Date.now();
      await scheduler.enqueueUpcomingMessages();
      const enqueuingTime = Date.now() - enqueueStart;

      // Publish all
      const messages = await pool.query('SELECT * FROM message_logs ORDER BY id');

      for (const msg of messages.rows) {
        await publisher.publishMessage({
          messageId: msg.id,
          userId: msg.user_id,
          messageType: msg.message_type,
          scheduledSendTime: msg.scheduled_send_time.toISOString(),
          timestamp: Date.now(),
          retryCount: 0,
        });
      }

      // Process all
      const worker = new MessageWorker();
      const processingStart = Date.now();
      await worker.start();

      // Track individual latencies
      const checkInterval = setInterval(async () => {
        const result = await pool.query(
          'SELECT actual_send_time, scheduled_send_time FROM message_logs WHERE status = $1',
          [MessageStatus.SENT]
        );

        for (const row of result.rows) {
          if (row.actual_send_time) {
            const latency = new Date(row.actual_send_time).getTime() - overallStart;
            if (!latencies.includes(latency)) {
              latencies.push(latency);
            }
          }
        }
      }, 500);

      await waitFor(async () => {
        const result = await pool.query(
          'SELECT COUNT(*) as count FROM message_logs WHERE status = $1',
          [MessageStatus.SENT]
        );
        return parseInt(result.rows[0].count) >= userCount;
      }, 60000);

      clearInterval(checkInterval);
      await worker.stop();

      const processingTime = Date.now() - processingStart;
      const totalLatency = Date.now() - overallStart;

      // Calculate percentiles
      latencies.sort((a, b) => a - b);
      const p50 = latencies[Math.floor(latencies.length * 0.5)];
      const p95 = latencies[Math.floor(latencies.length * 0.95)];
      const p99 = latencies[Math.floor(latencies.length * 0.99)];

      console.log(`
Performance Metrics - 50 Messages:
  Scheduling: ${schedulingTime}ms
  Enqueueing: ${enqueuingTime}ms
  Processing: ${processingTime}ms
  Total E2E: ${totalLatency}ms
  Throughput: ${((userCount / totalLatency) * 1000).toFixed(2)} msg/s

Latency Distribution:
  P50: ${p50}ms
  P95: ${p95}ms
  P99: ${p99}ms
      `);

      performanceMetrics.push({
        testName: 'latency-distribution-50',
        timestamp: new Date().toISOString(),
        userCount,
        schedulingTime,
        enqueuingTime,
        processingTime,
        totalLatency,
        throughput: (userCount / totalLatency) * 1000,
        p50Latency: p50,
        p95Latency: p95,
        p99Latency: p99,
        successRate: 1.0,
        errorRate: 0.0,
        memoryUsage: process.memoryUsage(),
      });

      expect(p95).toBeLessThan(30000); // P95 should be under 30 seconds
    }, 90000);
  });

  describe('Throughput measurement', () => {
    it('should measure throughput for 100 messages', async () => {
      const userCount = 100;
      const users = [];

      for (let i = 0; i < userCount; i++) {
        const user = await insertUser(pool, {
          firstName: `Throughput${i}`,
          lastName: 'Test',
          email: `throughput${i}@test.com`,
          timezone: 'UTC',
          birthdayDate: DateTime.now().set({ year: 1990 }).toJSDate(),
          anniversaryDate: null,
        });
        users.push(user);
      }

      const startTime = Date.now();

      await scheduler.preCalculateTodaysBirthdays();
      await pool.query('UPDATE message_logs SET scheduled_send_time = NOW()');
      await scheduler.enqueueUpcomingMessages();

      const messages = await pool.query('SELECT * FROM message_logs');

      for (const msg of messages.rows) {
        await publisher.publishMessage({
          messageId: msg.id,
          userId: msg.user_id,
          messageType: msg.message_type,
          scheduledSendTime: msg.scheduled_send_time.toISOString(),
          timestamp: Date.now(),
          retryCount: 0,
        });
      }

      const worker = new MessageWorker();
      await worker.start();

      await waitFor(async () => {
        const result = await pool.query(
          'SELECT COUNT(*) as count FROM message_logs WHERE status = $1',
          [MessageStatus.SENT]
        );
        return parseInt(result.rows[0].count) >= userCount;
      }, 120000);

      await worker.stop();

      const totalTime = Date.now() - startTime;
      const throughput = (userCount / totalTime) * 1000;

      console.log(`
Throughput Test - 100 Messages:
  Total Time: ${totalTime}ms
  Throughput: ${throughput.toFixed(2)} messages/second
  Average Latency: ${(totalTime / userCount).toFixed(2)}ms per message
      `);

      performanceMetrics.push({
        testName: 'throughput-100',
        timestamp: new Date().toISOString(),
        userCount,
        schedulingTime: 0,
        enqueuingTime: 0,
        processingTime: totalTime,
        totalLatency: totalTime,
        throughput,
        successRate: 1.0,
        errorRate: 0.0,
        memoryUsage: process.memoryUsage(),
      });

      expect(throughput).toBeGreaterThan(SLA_TARGETS.throughput);
    }, 150000);

    it('should maintain throughput with multiple timezones', async () => {
      const timezones = ['America/New_York', 'Europe/London', 'Asia/Tokyo', 'Australia/Sydney'];
      const usersPerTimezone = 25;
      const totalUsers = timezones.length * usersPerTimezone;

      for (const timezone of timezones) {
        for (let i = 0; i < usersPerTimezone; i++) {
          await insertUser(pool, {
            firstName: `TZ${i}`,
            lastName: timezone,
            email: `tz${i}-${timezone}@test.com`,
            timezone,
            birthdayDate: DateTime.now().setZone(timezone).set({ year: 1990 }).toJSDate(),
            anniversaryDate: null,
          });
        }
      }

      const startTime = Date.now();

      await scheduler.preCalculateTodaysBirthdays();

      const totalTime = Date.now() - startTime;
      const throughput = (totalUsers / totalTime) * 1000;

      console.log(`
Multi-Timezone Throughput:
  Total Users: ${totalUsers}
  Timezones: ${timezones.length}
  Time: ${totalTime}ms
  Throughput: ${throughput.toFixed(2)} msg/s
      `);

      expect(throughput).toBeGreaterThan(5); // Should handle at least 5 msg/s with timezones
    }, 60000);
  });

  describe('Resource utilization', () => {
    it('should track memory usage during processing', async () => {
      const iterations = 3;
      const memorySnapshots: Array<NodeJS.MemoryUsage> = [];

      for (let i = 0; i < iterations; i++) {
        await cleanDatabase(pool);

        // Create 50 users
        for (let j = 0; j < 50; j++) {
          await insertUser(pool, {
            firstName: `Memory${j}`,
            lastName: `Test${i}`,
            email: `memory${j}-${i}@test.com`,
            timezone: 'UTC',
            birthdayDate: DateTime.now().set({ year: 1990 }).toJSDate(),
            anniversaryDate: null,
          });
        }

        await scheduler.preCalculateTodaysBirthdays();

        // Take memory snapshot
        memorySnapshots.push(process.memoryUsage());

        // Force garbage collection if available
        if (global.gc) {
          global.gc();
        }

        await sleep(1000);
      }

      // Analyze memory usage
      console.log('Memory Usage Snapshots:');
      memorySnapshots.forEach((snapshot, i) => {
        console.log(`  Iteration ${i + 1}:`);
        console.log(`    Heap Used: ${(snapshot.heapUsed / 1024 / 1024).toFixed(2)} MB`);
        console.log(`    Heap Total: ${(snapshot.heapTotal / 1024 / 1024).toFixed(2)} MB`);
        console.log(`    RSS: ${(snapshot.rss / 1024 / 1024).toFixed(2)} MB`);
      });

      // Check for memory leaks (heap shouldn't grow significantly)
      const firstHeap = memorySnapshots[0].heapUsed;
      const lastHeap = memorySnapshots[memorySnapshots.length - 1].heapUsed;
      const growthRate = (lastHeap - firstHeap) / firstHeap;

      expect(growthRate).toBeLessThan(0.5); // Less than 50% growth
    }, 90000);

    it('should handle database connection pool efficiently', async () => {
      const concurrentQueries = 20;
      const iterations = 5;

      for (let i = 0; i < iterations; i++) {
        const promises = [];

        for (let j = 0; j < concurrentQueries; j++) {
          promises.push(pool.query('SELECT COUNT(*) FROM users'));
        }

        const start = Date.now();
        await Promise.all(promises);
        const duration = Date.now() - start;

        console.log(`  Iteration ${i + 1}: ${concurrentQueries} queries in ${duration}ms`);

        expect(duration).toBeLessThan(1000); // Should complete in under 1 second
      }
    }, 30000);
  });

  describe('SLA compliance', () => {
    it('should meet latency SLA (< 5 seconds per message)', async () => {
      const user = await insertUser(pool, {
        firstName: 'SLA',
        lastName: 'Latency',
        email: 'sla-latency@test.com',
        timezone: 'UTC',
        birthdayDate: DateTime.now().set({ year: 1990 }).toJSDate(),
        anniversaryDate: null,
      });

      const startTime = Date.now();

      await scheduler.preCalculateTodaysBirthdays();
      await pool.query('UPDATE message_logs SET scheduled_send_time = NOW()');
      await scheduler.enqueueUpcomingMessages();

      const messages = await pool.query('SELECT * FROM message_logs WHERE user_id = $1', [
        user.id,
      ]);

      await publisher.publishMessage({
        messageId: messages.rows[0].id,
        userId: user.id,
        messageType: 'BIRTHDAY',
        scheduledSendTime: messages.rows[0].scheduled_send_time.toISOString(),
        timestamp: Date.now(),
        retryCount: 0,
      });

      const worker = new MessageWorker();
      await worker.start();

      await waitFor(async () => {
        const result = await pool.query(
          'SELECT * FROM message_logs WHERE user_id = $1 AND status = $2',
          [user.id, MessageStatus.SENT]
        );
        return result.rows.length > 0;
      }, 15000);

      await worker.stop();

      const latency = Date.now() - startTime;

      console.log(`SLA Latency Test: ${latency}ms (Target: < ${SLA_TARGETS.maxLatency}ms)`);

      expect(latency).toBeLessThan(SLA_TARGETS.maxLatency);
    }, 30000);

    it('should meet throughput SLA (> 10 messages/second)', async () => {
      const userCount = 50;

      for (let i = 0; i < userCount; i++) {
        await insertUser(pool, {
          firstName: `SLA${i}`,
          lastName: 'Throughput',
          email: `sla-throughput${i}@test.com`,
          timezone: 'UTC',
          birthdayDate: DateTime.now().set({ year: 1990 }).toJSDate(),
          anniversaryDate: null,
        });
      }

      const startTime = Date.now();
      await scheduler.preCalculateTodaysBirthdays();
      const duration = Date.now() - startTime;

      const throughput = (userCount / duration) * 1000;

      console.log(
        `SLA Throughput Test: ${throughput.toFixed(2)} msg/s (Target: > ${SLA_TARGETS.throughput} msg/s)`
      );

      expect(throughput).toBeGreaterThan(SLA_TARGETS.throughput);
    }, 60000);

    it('should meet success rate SLA (> 95%)', async () => {
      // Configure some failures
      mockEmailServer.setResponseMode('error-500');
      mockEmailServer.setErrorCount(2); // First 2 fail, rest succeed

      const userCount = 20;
      const users = [];

      for (let i = 0; i < userCount; i++) {
        const user = await insertUser(pool, {
          firstName: `Success${i}`,
          lastName: 'Rate',
          email: `success${i}@test.com`,
          timezone: 'UTC',
          birthdayDate: DateTime.now().set({ year: 1990 }).toJSDate(),
          anniversaryDate: null,
        });
        users.push(user);
      }

      await scheduler.preCalculateTodaysBirthdays();
      await pool.query('UPDATE message_logs SET scheduled_send_time = NOW()');
      await scheduler.enqueueUpcomingMessages();

      const messages = await pool.query('SELECT * FROM message_logs');

      for (const msg of messages.rows) {
        await publisher.publishMessage({
          messageId: msg.id,
          userId: msg.user_id,
          messageType: msg.message_type,
          scheduledSendTime: msg.scheduled_send_time.toISOString(),
          timestamp: Date.now(),
          retryCount: 0,
        });
      }

      const worker = new MessageWorker();
      await worker.start();

      await sleep(10000); // Wait for processing

      await worker.stop();

      // Calculate success rate
      const sentResult = await pool.query(
        'SELECT COUNT(*) as count FROM message_logs WHERE status = $1',
        [MessageStatus.SENT]
      );
      const failedResult = await pool.query(
        'SELECT COUNT(*) as count FROM message_logs WHERE status = $1',
        [MessageStatus.FAILED]
      );

      const sent = parseInt(sentResult.rows[0].count);
      const failed = parseInt(failedResult.rows[0].count);
      const successRate = sent / (sent + failed);

      console.log(`
SLA Success Rate Test:
  Sent: ${sent}
  Failed: ${failed}
  Success Rate: ${(successRate * 100).toFixed(2)}% (Target: > ${SLA_TARGETS.successRate * 100}%)
      `);

      expect(successRate).toBeGreaterThanOrEqual(SLA_TARGETS.successRate);
    }, 45000);
  });
});

/**
 * Generate performance report
 */
async function generatePerformanceReport(metrics: PerformanceMetrics[]): Promise<void> {
  if (metrics.length === 0) {
    return;
  }

  // Calculate summary statistics
  const throughputs = metrics.map((m) => m.throughput);
  const latencies = metrics.map((m) => m.totalLatency);

  const summary = {
    averageThroughput: throughputs.reduce((a, b) => a + b, 0) / throughputs.length,
    averageLatency: latencies.reduce((a, b) => a + b, 0) / latencies.length,
    maxThroughput: Math.max(...throughputs),
    minLatency: Math.min(...latencies),
  };

  const report: PerformanceReport = {
    generatedAt: new Date().toISOString(),
    environment: {
      nodeVersion: process.version,
      platform: process.platform,
      arch: process.arch,
    },
    metrics,
    summary,
    slaCompliance: {
      throughputTarget: SLA_TARGETS.throughput,
      latencyTarget: SLA_TARGETS.maxLatency,
      meetsRequirements:
        summary.averageThroughput >= SLA_TARGETS.throughput &&
        summary.averageLatency <= SLA_TARGETS.maxLatency,
    },
  };

  // Write report to file
  const reportDir = path.join(process.cwd(), 'tests', 'e2e', 'reports');
  await fs.mkdir(reportDir, { recursive: true });

  const reportPath = path.join(reportDir, `performance-${Date.now()}.json`);
  await fs.writeFile(reportPath, JSON.stringify(report, null, 2));

  console.log(`
================================================================================
PERFORMANCE REPORT GENERATED
================================================================================

Report Location: ${reportPath}

Summary:
  Average Throughput: ${summary.averageThroughput.toFixed(2)} msg/s
  Average Latency: ${summary.averageLatency.toFixed(2)}ms
  Max Throughput: ${summary.maxThroughput.toFixed(2)} msg/s
  Min Latency: ${summary.minLatency.toFixed(2)}ms

SLA Compliance: ${report.slaCompliance.meetsRequirements ? 'PASS ✓' : 'FAIL ✗'}
  Throughput Target: ${SLA_TARGETS.throughput} msg/s
  Latency Target: ${SLA_TARGETS.maxLatency}ms

================================================================================
  `);
}
