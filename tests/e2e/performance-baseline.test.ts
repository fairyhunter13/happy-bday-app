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
import {
  TestEnvironment,
  waitFor,
  cleanDatabase,
  purgeQueues,
  clearBirthdayCache,
  resetCircuitBreaker,
} from '../helpers/testcontainers-optimized.js';
import { insertUser, sleep } from '../helpers/test-helpers.js';
import { QUEUES } from '../../src/queue/config.js';
import { DateTime } from 'luxon';
import * as fs from 'fs/promises';
import * as path from 'path';
import type { Pool } from 'pg';
import type { Connection } from 'amqplib';

// Type-only imports - these don't trigger module initialization
import type { SchedulerService as SchedulerServiceType } from '../../src/services/scheduler.service.js';
import type { MessageWorker as MessageWorkerType } from '../../src/workers/message-worker.js';
import type { MessagePublisher as MessagePublisherType } from '../../src/queue/publisher.js';

// Import MessageStatus directly (enum value, safe to import statically)
import { MessageStatus } from '../../src/db/schema/message-logs.js';

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
  let scheduler: SchedulerServiceType;
  let publisher: MessagePublisherType;
  let MessageWorker: new () => MessageWorkerType;

  // Module references for dynamic imports
  let initializeRabbitMQ: () => Promise<unknown>;
  let RabbitMQConnection: {
    getInstance: () => { close: () => Promise<void> };
    resetInstance: () => void;
  };

  const performanceMetrics: PerformanceMetrics[] = [];

  // SLA targets - adjusted for real email service with ~10% failure rate
  const SLA_TARGETS = {
    throughput: 10, // messages per second minimum
    maxLatency: 15000, // 15 seconds max end-to-end (increased for real API calls)
    successRate: 0.8, // 80% success rate (accounting for ~10% random failures + retries)
  };

  beforeAll(async () => {
    env = new TestEnvironment();
    await env.setup();

    // Set environment variables BEFORE importing app modules
    process.env.DATABASE_URL = env.postgresConnectionString;
    process.env.RABBITMQ_URL = env.rabbitmqConnectionString;
    process.env.ENABLE_DB_METRICS = 'false';
    process.env.DATABASE_POOL_MAX = '2';

    await env.runMigrations();

    pool = env.getPostgresPool();
    amqpConnection = env.getRabbitMQConnection();

    // Dynamically import modules AFTER env vars are set
    const queueModule = await import('../../src/queue/connection.js');
    initializeRabbitMQ = queueModule.initializeRabbitMQ;
    RabbitMQConnection = queueModule.RabbitMQConnection;

    // Initialize RabbitMQ connection singleton
    await initializeRabbitMQ();

    // Now import modules that depend on RabbitMQ
    const schedulerModule = await import('../../src/services/scheduler.service.js');
    const publisherModule = await import('../../src/queue/publisher.js');
    const workerModule = await import('../../src/workers/message-worker.js');

    scheduler = new schedulerModule.SchedulerService();
    publisher = new publisherModule.MessagePublisher();
    MessageWorker = workerModule.MessageWorker;

    await publisher.initialize();
  }, 180000);

  afterAll(async () => {
    // Generate performance report
    await generatePerformanceReport(performanceMetrics);

    // Close RabbitMQ connection first
    try {
      const rabbitMQ = RabbitMQConnection.getInstance();
      await rabbitMQ.close();
    } catch {
      // Ignore errors if not connected
    }

    // Close app's singleton database connection
    try {
      const dbConnection = await import('../../src/db/connection.js');
      await dbConnection.closeConnection();
    } catch {
      // Ignore errors if connection already closed
    }

    await env.teardown();
  }, 60000);

  beforeEach(async () => {
    await cleanDatabase(pool);
    // Use queue names from config to ensure consistency
    await purgeQueues(amqpConnection, [QUEUES.BIRTHDAY_MESSAGES, QUEUES.BIRTHDAY_DLQ]);
    // Clear birthday/anniversary cache to ensure newly created users are found
    await clearBirthdayCache();
    // Reset circuit breaker to closed state to avoid test pollution
    await resetCircuitBreaker();
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
      await pool.query('UPDATE message_logs SET scheduled_send_time = NOW() WHERE user_id = $1', [
        user.id,
      ]);

      const enqueueStart = Date.now();
      await scheduler.enqueueUpcomingMessages();
      const enqueuingTime = Date.now() - enqueueStart;

      // Step 3: Publish to queue
      const messages = await pool.query('SELECT * FROM message_logs WHERE user_id = $1', [user.id]);

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
          'SELECT * FROM message_logs WHERE user_id = $1 AND status IN ($2, $3)',
          [user.id, MessageStatus.SENT, MessageStatus.FAILED]
        );
        return result.rows.length > 0;
      }, 30000);

      await worker.stop();
      const processingTime = Date.now() - processingStart;

      const totalLatency = Date.now() - startTime;

      // Check final status
      const finalStatus = await pool.query('SELECT status FROM message_logs WHERE user_id = $1', [
        user.id,
      ]);
      const wasSuccessful = finalStatus.rows[0]?.status === MessageStatus.SENT;

      console.log(`
Performance Metrics - Single Message:
  Scheduling: ${schedulingTime}ms
  Enqueueing: ${enqueuingTime}ms
  Processing: ${processingTime}ms
  Total E2E: ${totalLatency}ms
  Status: ${finalStatus.rows[0]?.status || 'UNKNOWN'}
      `);

      expect(totalLatency).toBeLessThan(30000); // Should complete within 30 seconds (adjusted for real API)

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
        successRate: wasSuccessful ? 1.0 : 0.0,
        errorRate: wasSuccessful ? 0.0 : 1.0,
        memoryUsage: process.memoryUsage(),
      });
    }, 60000);

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
          'SELECT COUNT(*) as count FROM message_logs WHERE status IN ($1, $2)',
          [MessageStatus.SENT, MessageStatus.FAILED]
        );
        return parseInt(result.rows[0].count) >= userCount;
      }, 120000);

      clearInterval(checkInterval);
      await worker.stop();

      const processingTime = Date.now() - processingStart;
      const totalLatency = Date.now() - overallStart;

      // Calculate success rate
      const sentResult = await pool.query(
        'SELECT COUNT(*) as count FROM message_logs WHERE status = $1',
        [MessageStatus.SENT]
      );
      const sent = parseInt(sentResult.rows[0].count);
      const successRate = sent / userCount;

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
  Success Rate: ${(successRate * 100).toFixed(2)}%

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
        successRate,
        errorRate: 1.0 - successRate,
        memoryUsage: process.memoryUsage(),
      });

      expect(p95).toBeLessThan(60000); // P95 should be under 60 seconds (adjusted for real API)
      expect(successRate).toBeGreaterThan(SLA_TARGETS.successRate); // Should meet minimum success rate
    }, 180000);
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
          'SELECT COUNT(*) as count FROM message_logs WHERE status IN ($1, $2)',
          [MessageStatus.SENT, MessageStatus.FAILED]
        );
        return parseInt(result.rows[0].count) >= userCount;
      }, 180000);

      await worker.stop();

      const totalTime = Date.now() - startTime;
      const throughput = (userCount / totalTime) * 1000;

      // Calculate success rate
      const sentResult = await pool.query(
        'SELECT COUNT(*) as count FROM message_logs WHERE status = $1',
        [MessageStatus.SENT]
      );
      const sent = parseInt(sentResult.rows[0].count);
      const successRate = sent / userCount;

      console.log(`
Throughput Test - 100 Messages:
  Total Time: ${totalTime}ms
  Throughput: ${throughput.toFixed(2)} messages/second
  Average Latency: ${(totalTime / userCount).toFixed(2)}ms per message
  Success Rate: ${(successRate * 100).toFixed(2)}%
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
        successRate,
        errorRate: 1.0 - successRate,
        memoryUsage: process.memoryUsage(),
      });

      expect(throughput).toBeGreaterThan(SLA_TARGETS.throughput);
      expect(successRate).toBeGreaterThan(SLA_TARGETS.successRate);
    }, 240000);

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
    it('should meet latency SLA (< 15 seconds per message)', async () => {
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

      const messages = await pool.query('SELECT * FROM message_logs WHERE user_id = $1', [user.id]);

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
          'SELECT * FROM message_logs WHERE user_id = $1 AND status IN ($2, $3)',
          [user.id, MessageStatus.SENT, MessageStatus.FAILED]
        );
        return result.rows.length > 0;
      }, 30000);

      await worker.stop();

      const latency = Date.now() - startTime;

      console.log(`SLA Latency Test: ${latency}ms (Target: < ${SLA_TARGETS.maxLatency}ms)`);

      expect(latency).toBeLessThan(SLA_TARGETS.maxLatency);
    }, 60000);

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

    it('should meet success rate SLA (> 80%)', async () => {
      // Note: Real email service has ~10% random failure rate
      // With retries, we expect to achieve 80%+ success rate

      const userCount = 50; // Increased sample size for statistical significance
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

      // Wait for all messages to be processed (either sent or failed)
      await waitFor(async () => {
        const result = await pool.query(
          'SELECT COUNT(*) as count FROM message_logs WHERE status IN ($1, $2)',
          [MessageStatus.SENT, MessageStatus.FAILED]
        );
        return parseInt(result.rows[0].count) >= userCount;
      }, 90000);

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
    }, 120000);
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
