/**
 * Queue Writer Performance Benchmark
 *
 * Tests queue write operations to establish baseline and measure optimizations:
 * - Message validation performance
 * - Serialization speed
 * - Channel publish latency
 * - Metrics instrumentation overhead
 *
 * Target: <10ms average per message
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { performance } from 'perf_hooks';
import {
  TestEnvironment,
  cleanDatabase,
  purgeQueues,
} from '../helpers/testcontainers-optimized.js';
import type { Pool } from 'pg';
import type { Connection } from 'amqplib';
import { QUEUES } from '../../src/queue/config.js';
import type { MessagePublisher } from '../../src/queue/publisher.js';
import type { MessageJob } from '../../src/queue/types.js';

/**
 * Benchmark result
 */
interface BenchmarkResult {
  name: string;
  iterations: number;
  totalTime: number;
  mean: number;
  median: number;
  min: number;
  max: number;
  p95: number;
  p99: number;
  stdDev: number;
  throughput: number;
}

/**
 * Run benchmark test
 */
async function benchmark(
  name: string,
  iterations: number,
  fn: () => Promise<void>
): Promise<BenchmarkResult> {
  const timings: number[] = [];

  // Warmup
  for (let i = 0; i < 10; i++) {
    await fn();
  }

  // Actual benchmark
  const startTotal = performance.now();

  for (let i = 0; i < iterations; i++) {
    const start = performance.now();
    await fn();
    const duration = performance.now() - start;
    timings.push(duration);
  }

  const totalTime = performance.now() - startTotal;

  // Calculate statistics
  timings.sort((a, b) => a - b);

  const mean = timings.reduce((sum, t) => sum + t, 0) / timings.length;
  const median = timings[Math.floor(timings.length / 2)];
  const min = timings[0];
  const max = timings[timings.length - 1];
  const p95 = timings[Math.floor(timings.length * 0.95)];
  const p99 = timings[Math.floor(timings.length * 0.99)];

  const variance = timings.reduce((sum, t) => sum + Math.pow(t - mean, 2), 0) / timings.length;
  const stdDev = Math.sqrt(variance);

  const throughput = (iterations / totalTime) * 1000; // ops/second

  return {
    name,
    iterations,
    totalTime,
    mean,
    median,
    min,
    max,
    p95,
    p99,
    stdDev,
    throughput,
  };
}

/**
 * Print benchmark results
 */
function printResults(result: BenchmarkResult): void {
  console.log(`\n${'='.repeat(80)}`);
  console.log(`Benchmark: ${result.name}`);
  console.log(`${'='.repeat(80)}`);
  console.log(`Iterations:  ${result.iterations}`);
  console.log(`Total Time:  ${result.totalTime.toFixed(2)}ms`);
  console.log();
  console.log(`Mean:        ${result.mean.toFixed(2)}ms`);
  console.log(`Median:      ${result.median.toFixed(2)}ms`);
  console.log(`Min:         ${result.min.toFixed(2)}ms`);
  console.log(`Max:         ${result.max.toFixed(2)}ms`);
  console.log(`P95:         ${result.p95.toFixed(2)}ms`);
  console.log(`P99:         ${result.p99.toFixed(2)}ms`);
  console.log(`Std Dev:     ${result.stdDev.toFixed(2)}ms`);
  console.log();
  console.log(`Throughput:  ${result.throughput.toFixed(2)} ops/s`);
  console.log(`${'='.repeat(80)}\n`);
}

describe('Queue Writer Performance Benchmark', () => {
  let env: TestEnvironment;
  let pool: Pool;
  let amqpConnection: Connection;
  let publisher: MessagePublisher;

  // Module references
  let initializeRabbitMQ: () => Promise<unknown>;
  let RabbitMQConnection: {
    getInstance: () => { close: () => Promise<void> };
    resetInstance: () => void;
  };

  beforeAll(async () => {
    env = new TestEnvironment();
    await env.setup();

    process.env.DATABASE_URL = env.postgresConnectionString;
    process.env.RABBITMQ_URL = env.rabbitmqConnectionString;
    process.env.ENABLE_DB_METRICS = 'false';

    await env.runMigrations();

    pool = env.getPostgresPool();
    amqpConnection = env.getRabbitMQConnection();

    // Initialize RabbitMQ
    const queueModule = await import('../../src/queue/connection.js');
    initializeRabbitMQ = queueModule.initializeRabbitMQ;
    RabbitMQConnection = queueModule.RabbitMQConnection;

    await initializeRabbitMQ();

    // Initialize publisher
    const publisherModule = await import('../../src/queue/publisher.js');
    publisher = new publisherModule.MessagePublisher();
    await publisher.initialize();
  }, 180000);

  afterAll(async () => {
    try {
      const rabbitMQ = RabbitMQConnection.getInstance();
      await rabbitMQ.close();
    } catch {
      // Ignore
    }

    try {
      const dbConnection = await import('../../src/db/connection.js');
      await dbConnection.closeConnection();
    } catch {
      // Ignore
    }

    await env.teardown();
  }, 60000);

  beforeEach(async () => {
    await cleanDatabase(pool);
    await purgeQueues(amqpConnection, [QUEUES.BIRTHDAY_MESSAGES, QUEUES.BIRTHDAY_DLQ]);
  });

  describe('Single Message Publishing', () => {
    it('should measure baseline publish performance', async () => {
      const testMessage: MessageJob = {
        messageId: 'test-message-1',
        userId: 'user-123',
        messageType: 'BIRTHDAY',
        scheduledSendTime: new Date().toISOString(),
        timestamp: Date.now(),
        retryCount: 0,
      };

      const result = await benchmark('Single Message Publish', 1000, async () => {
        testMessage.messageId = `test-${Date.now()}-${Math.random()}`;
        await publisher.publishMessage(testMessage);
      });

      printResults(result);

      // Assertions
      expect(result.mean).toBeLessThan(50); // Current baseline: ~45ms
      expect(result.p95).toBeLessThan(80);
      expect(result.p99).toBeLessThan(100);

      // Save results
      await saveResults('baseline-single-publish', result);
    }, 300000);

    it('should measure optimized publish performance', async () => {
      // This test will use the optimized publisher when implemented
      // For now, it's the same as baseline

      const testMessage: MessageJob = {
        messageId: 'test-message-1',
        userId: 'user-123',
        messageType: 'BIRTHDAY',
        scheduledSendTime: new Date().toISOString(),
        timestamp: Date.now(),
        retryCount: 0,
      };

      const result = await benchmark('Optimized Single Message Publish', 1000, async () => {
        testMessage.messageId = `test-${Date.now()}-${Math.random()}`;
        await publisher.publishMessage(testMessage);
      });

      printResults(result);

      // Target: <10ms average
      // expect(result.mean).toBeLessThan(10); // Uncomment when optimization is implemented
      // expect(result.p95).toBeLessThan(15);
      // expect(result.p99).toBeLessThan(20);

      await saveResults('optimized-single-publish', result);
    }, 300000);
  });

  describe('Batch Publishing', () => {
    it('should measure batch publish performance (10 messages)', async () => {
      const batchSize = 10;
      const batches = 100;

      const result = await benchmark(`Batch Publish (${batchSize} msgs)`, batches, async () => {
        const messages: MessageJob[] = [];
        for (let i = 0; i < batchSize; i++) {
          messages.push({
            messageId: `batch-${Date.now()}-${i}`,
            userId: `user-${i}`,
            messageType: i % 2 === 0 ? 'BIRTHDAY' : 'ANNIVERSARY',
            scheduledSendTime: new Date().toISOString(),
            timestamp: Date.now(),
            retryCount: 0,
          });
        }

        await publisher.publishBatch(messages);
      });

      printResults(result);

      // Calculate per-message metrics
      const perMessageMean = result.mean / batchSize;
      console.log(`Per-message mean: ${perMessageMean.toFixed(2)}ms`);

      expect(perMessageMean).toBeLessThan(50); // Current baseline

      await saveResults('baseline-batch-10-publish', result);
    }, 300000);

    it('should measure batch publish performance (100 messages)', async () => {
      const batchSize = 100;
      const batches = 10;

      const result = await benchmark(`Batch Publish (${batchSize} msgs)`, batches, async () => {
        const messages: MessageJob[] = [];
        for (let i = 0; i < batchSize; i++) {
          messages.push({
            messageId: `batch-${Date.now()}-${i}`,
            userId: `user-${i}`,
            messageType: i % 2 === 0 ? 'BIRTHDAY' : 'ANNIVERSARY',
            scheduledSendTime: new Date().toISOString(),
            timestamp: Date.now(),
            retryCount: 0,
          });
        }

        await publisher.publishBatch(messages);
      });

      printResults(result);

      const perMessageMean = result.mean / batchSize;
      console.log(`Per-message mean: ${perMessageMean.toFixed(2)}ms`);

      await saveResults('baseline-batch-100-publish', result);
    }, 300000);
  });

  describe('Message Validation', () => {
    it('should measure validation overhead', async () => {
      const { messageJobSchema } = await import('../../src/queue/types.js');

      const testMessage = {
        messageId: 'test-message-1',
        userId: 'user-123',
        messageType: 'BIRTHDAY',
        scheduledSendTime: new Date().toISOString(),
        timestamp: Date.now(),
        retryCount: 0,
      };

      const result = await benchmark('Message Validation', 10000, async () => {
        messageJobSchema.parse(testMessage);
      });

      printResults(result);

      // Validation should be fast (<5ms)
      expect(result.mean).toBeLessThan(5);

      await saveResults('validation-overhead', result);
    }, 60000);
  });

  describe('Serialization', () => {
    it('should measure JSON serialization speed', async () => {
      const testMessage: MessageJob = {
        messageId: 'test-message-1',
        userId: 'user-123',
        messageType: 'BIRTHDAY',
        scheduledSendTime: new Date().toISOString(),
        timestamp: Date.now(),
        retryCount: 0,
      };

      const result = await benchmark('JSON Serialization', 10000, async () => {
        Buffer.from(JSON.stringify(testMessage));
      });

      printResults(result);

      // Serialization should be fast (<2ms)
      expect(result.mean).toBeLessThan(2);

      await saveResults('serialization-speed', result);
    }, 60000);
  });

  describe('Throughput Test', () => {
    it('should measure sustained throughput (1 minute)', async () => {
      const duration = 60000; // 1 minute
      const startTime = performance.now();
      let messageCount = 0;
      const timings: number[] = [];

      while (performance.now() - startTime < duration) {
        const start = performance.now();

        await publisher.publishMessage({
          messageId: `throughput-${Date.now()}-${messageCount}`,
          userId: `user-${messageCount}`,
          messageType: messageCount % 2 === 0 ? 'BIRTHDAY' : 'ANNIVERSARY',
          scheduledSendTime: new Date().toISOString(),
          timestamp: Date.now(),
          retryCount: 0,
        });

        const elapsed = performance.now() - start;
        timings.push(elapsed);
        messageCount++;
      }

      const totalTime = performance.now() - startTime;
      const throughput = (messageCount / totalTime) * 1000;

      console.log(`\n${'='.repeat(80)}`);
      console.log(`Throughput Test (60 seconds)`);
      console.log(`${'='.repeat(80)}`);
      console.log(`Messages Published: ${messageCount}`);
      console.log(`Total Time: ${(totalTime / 1000).toFixed(2)}s`);
      console.log(`Throughput: ${throughput.toFixed(2)} msg/s`);
      console.log();

      timings.sort((a, b) => a - b);
      console.log(
        `Latency Stats:
  Mean: ${(timings.reduce((a, b) => a + b, 0) / timings.length).toFixed(2)}ms
  P50:  ${timings[Math.floor(timings.length * 0.5)].toFixed(2)}ms
  P95:  ${timings[Math.floor(timings.length * 0.95)].toFixed(2)}ms
  P99:  ${timings[Math.floor(timings.length * 0.99)].toFixed(2)}ms`
      );
      console.log(`${'='.repeat(80)}\n`);

      // Target: >20 msg/s (baseline), >100 msg/s (optimized)
      expect(throughput).toBeGreaterThan(20);
    }, 120000);
  });
});

/**
 * Save benchmark results to file
 */
async function saveResults(name: string, result: BenchmarkResult): Promise<void> {
  const fs = await import('fs/promises');
  const path = await import('path');

  const resultsDir = path.join(process.cwd(), 'perf-results');
  await fs.mkdir(resultsDir, { recursive: true });

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `${name}-${timestamp}.json`;
  const filepath = path.join(resultsDir, filename);

  await fs.writeFile(filepath, JSON.stringify(result, null, 2));

  console.log(`Results saved to: ${filepath}`);
}
