import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend, Counter, Gauge } from 'k6/metrics';
import { randomString } from 'https://jslib.k6.io/k6-utils/1.2.0/index.js';

// Custom metrics
const errorRate = new Rate('errors');
const messageProcessingTime = new Trend('message_processing_time');
const workerThroughput = new Trend('worker_throughput'); // messages/second
const retryLatency = new Trend('retry_latency');
const messagesProcessed = new Counter('messages_processed');
const messagesEnqueued = new Counter('messages_enqueued');
const messagesFailed = new Counter('messages_failed');
const messagesRetried = new Counter('messages_retried');
const activeWorkers = new Gauge('active_workers');
const queueDepth = new Gauge('queue_depth');

// CI mode detection
const isCI = __ENV.CI === 'true';

// Scenario configurations based on environment
const WORKER_SCENARIOS = isCI
  ? {
      // CI mode: optimized scenarios (~10 min total)
      single_worker_baseline: {
        executor: 'constant-arrival-rate',
        rate: 80, // 80 messages/min
        timeUnit: '1m',
        duration: '2m',
        preAllocatedVUs: 8,
        maxVUs: 15,
        exec: 'testWorkerProcessing',
        tags: { workers: '1', scenario: 'baseline' },
        env: { WORKER_COUNT: '1' },
      },
      five_workers_medium: {
        executor: 'constant-arrival-rate',
        rate: 150, // 150 messages/min
        timeUnit: '1m',
        duration: '3m',
        preAllocatedVUs: 15,
        maxVUs: 30,
        exec: 'testWorkerProcessing',
        tags: { workers: '5', scenario: 'medium' },
        env: { WORKER_COUNT: '5' },
        startTime: '2m',
      },
      ten_workers_high: {
        executor: 'constant-arrival-rate',
        rate: 250, // 250 messages/min
        timeUnit: '1m',
        duration: '3m',
        preAllocatedVUs: 25,
        maxVUs: 50,
        exec: 'testWorkerProcessing',
        tags: { workers: '10', scenario: 'high' },
        env: { WORKER_COUNT: '10' },
        startTime: '5m',
      },
      failure_retry_test: {
        executor: 'constant-arrival-rate',
        rate: 100, // 100 messages/min
        timeUnit: '1m',
        duration: '2m',
        preAllocatedVUs: 15,
        maxVUs: 30,
        exec: 'testFailureRetry',
        tags: { workers: '10', scenario: 'failure' },
        env: { WORKER_COUNT: '10' },
        startTime: '8m',
      },
    }
  : {
      // Full mode: original scenarios (~30 min total)
      single_worker_baseline: {
        executor: 'constant-arrival-rate',
        rate: 100,
        timeUnit: '1m',
        duration: '5m',
        preAllocatedVUs: 10,
        maxVUs: 20,
        exec: 'testWorkerProcessing',
        tags: { workers: '1', scenario: 'baseline' },
        env: { WORKER_COUNT: '1' },
      },
      five_workers_medium: {
        executor: 'constant-arrival-rate',
        rate: 500,
        timeUnit: '1m',
        duration: '5m',
        preAllocatedVUs: 50,
        maxVUs: 100,
        exec: 'testWorkerProcessing',
        tags: { workers: '5', scenario: 'medium' },
        env: { WORKER_COUNT: '5' },
        startTime: '5m',
      },
      ten_workers_high: {
        executor: 'constant-arrival-rate',
        rate: 1000,
        timeUnit: '1m',
        duration: '10m',
        preAllocatedVUs: 100,
        maxVUs: 200,
        exec: 'testWorkerProcessing',
        tags: { workers: '10', scenario: 'high' },
        env: { WORKER_COUNT: '10' },
        startTime: '10m',
      },
      ten_workers_peak: {
        executor: 'constant-arrival-rate',
        rate: 2000,
        timeUnit: '1m',
        duration: '5m',
        preAllocatedVUs: 200,
        maxVUs: 300,
        exec: 'testWorkerProcessing',
        tags: { workers: '10', scenario: 'peak' },
        env: { WORKER_COUNT: '10' },
        startTime: '20m',
      },
      failure_retry_test: {
        executor: 'constant-arrival-rate',
        rate: 200,
        timeUnit: '1m',
        duration: '5m',
        preAllocatedVUs: 30,
        maxVUs: 50,
        exec: 'testFailureRetry',
        tags: { workers: '10', scenario: 'failure' },
        env: { WORKER_COUNT: '10' },
        startTime: '25m',
      },
    };

/**
 * K6 Performance Test: Worker Throughput Test
 *
 * Tests worker pool processing performance:
 * - Multiple workers processing messages
 * - Throughput measurement (messages/second)
 * - Failed message handling and retry logic
 * - Worker scaling efficiency
 *
 * CI mode (~10 min total):
 * 1. Baseline: 1 worker, 80 messages/min for 2 minutes
 * 2. Medium: 5 workers, 150 messages/min for 3 minutes
 * 3. High: 10 workers, 250 messages/min for 3 minutes
 * 4. Failure: Retry testing 100 messages/min for 2 minutes
 *
 * Full mode (~30 min total):
 * 1. Baseline: 1 worker, 100 messages/min for 5 minutes
 * 2. Medium: 5 workers, 500 messages/min for 5 minutes
 * 3. High: 10 workers, 1000 messages/min for 10 minutes
 * 4. Peak: 10 workers, 2000 messages/min for 5 minutes
 * 5. Failure: Retry testing 200 messages/min for 5 minutes
 *
 * Thresholds:
 * - Throughput > 50 msg/s (10 workers)
 * - Retry latency < 2s
 * - Processing time p95 < 1s
 * - Error rate < 1%
 */
export const options = {
  scenarios: WORKER_SCENARIOS,
  thresholds: {
    'worker_throughput{workers:10}': ['avg>50'], // >50 msg/s with 10 workers
    'message_processing_time{scenario:baseline}': ['p(95)<500'],
    'message_processing_time{scenario:medium}': ['p(95)<800'],
    'message_processing_time{scenario:high}': ['p(95)<1000'],
    'message_processing_time{scenario:peak}': ['p(95)<1500'],
    'retry_latency{scenario:failure}': ['p(95)<2000'],
    'http_req_failed': ['rate<0.01'], // <1% error rate
    errors: ['rate<0.01'],
  },
  summaryTrendStats: ['avg', 'min', 'med', 'max', 'p(90)', 'p(95)', 'p(99)'],
};

// Configuration
const API_BASE_URL = __ENV.API_URL || 'http://localhost:3000';
const QUEUE_API_URL = `${API_BASE_URL}/internal/queue`;
const WORKER_API_URL = `${API_BASE_URL}/internal/worker`;

const MESSAGE_TYPES = ['BIRTHDAY', 'ANNIVERSARY'];

/**
 * Generate message payload for enqueuing
 */
function generateMessagePayload() {
  const messageType = MESSAGE_TYPES[Math.floor(Math.random() * MESSAGE_TYPES.length)];
  const userId = `user-${randomString(8)}`;

  return {
    userId,
    messageType,
    scheduledSendTime: new Date().toISOString(),
    messageContent: `Happy ${messageType.toLowerCase()}! 🎉`,
    recipientEmail: `${userId}@example.com`,
    idempotencyKey: `${messageType}-${userId}-${Date.now()}`,
    metadata: {
      timezone: 'America/New_York',
      language: 'en',
      testMessage: true,
    },
  };
}

/**
 * Test worker message processing
 */
export function testWorkerProcessing() {
  const workerCount = __ENV.WORKER_COUNT || '10';
  activeWorkers.add(parseInt(workerCount));

  // Enqueue message to RabbitMQ
  const message = generateMessagePayload();
  const enqueueStart = Date.now();

  const enqueueRes = http.post(
    `${QUEUE_API_URL}/enqueue`,
    JSON.stringify(message),
    {
      headers: {
        'Content-Type': 'application/json',
        'X-Worker-Count': workerCount,
      },
      timeout: '10s',
    }
  );

  const enqueueSuccess = check(enqueueRes, {
    'enqueue: status is 201': (r) => r.status === 201,
    'enqueue: has message ID': (r) => {
      try {
        const body = JSON.parse(r.body);
        return body.messageId !== undefined;
      } catch {
        return false;
      }
    },
  });

  if (enqueueSuccess) {
    messagesEnqueued.add(1);

    // Get message ID for tracking
    let messageId;
    try {
      const body = JSON.parse(enqueueRes.body);
      messageId = body.messageId;
    } catch (e) {
      console.error('Failed to parse enqueue response:', e);
    }

    // Poll for message processing completion
    if (messageId) {
      const processingStart = Date.now();
      let processed = false;
      let attempts = 0;
      const maxAttempts = 30; // 30 seconds max wait

      while (!processed && attempts < maxAttempts) {
        sleep(1);
        attempts++;

        const statusRes = http.get(`${WORKER_API_URL}/message-status/${messageId}`, {
          timeout: '5s',
        });

        if (statusRes.status === 200) {
          try {
            const status = JSON.parse(statusRes.body);
            if (status.processed) {
              processed = true;
              const processingTime = Date.now() - processingStart;
              messageProcessingTime.add(processingTime);
              messagesProcessed.add(1);

              // Calculate throughput
              const throughput = 1000 / processingTime; // messages per second
              workerThroughput.add(throughput);

              // Update queue depth
              if (status.queueDepth !== undefined) {
                queueDepth.add(status.queueDepth);
              }

              break;
            } else if (status.failed) {
              messagesFailed.add(1);
              errorRate.add(1);
              break;
            }
          } catch (e) {
            console.error('Failed to parse status response:', e);
          }
        }
      }

      if (!processed && attempts >= maxAttempts) {
        console.error(`Message ${messageId} processing timeout`);
        messagesFailed.add(1);
        errorRate.add(1);
      }
    }
  } else {
    messagesFailed.add(1);
    errorRate.add(1);
    console.error(`Enqueue failed: ${enqueueRes.status} - ${enqueueRes.body}`);
  }

  sleep(0.1);
}

/**
 * Test failure and retry mechanism
 */
export function testFailureRetry() {
  // Enqueue message that will fail (simulate email service failure)
  const message = generateMessagePayload();
  message.metadata.simulateFailure = true; // Flag to trigger failure

  const enqueueRes = http.post(
    `${QUEUE_API_URL}/enqueue`,
    JSON.stringify(message),
    {
      headers: {
        'Content-Type': 'application/json',
        'X-Simulate-Failure': 'true',
      },
      timeout: '10s',
    }
  );

  if (enqueueRes.status === 201) {
    messagesEnqueued.add(1);

    let messageId;
    try {
      const body = JSON.parse(enqueueRes.body);
      messageId = body.messageId;
    } catch (e) {
      console.error('Failed to parse enqueue response:', e);
    }

    if (messageId) {
      // Wait for initial processing and failure
      sleep(2);

      // Check retry status
      const retryStart = Date.now();
      const retryRes = http.get(`${WORKER_API_URL}/retry-status/${messageId}`, {
        timeout: '5s',
      });

      const retryTime = Date.now() - retryStart;
      retryLatency.add(retryTime);

      const retrySuccess = check(retryRes, {
        'retry: status is 200': (r) => r.status === 200,
        'retry: has retry count': (r) => {
          try {
            const body = JSON.parse(r.body);
            return body.retryCount !== undefined;
          } catch {
            return false;
          }
        },
        'retry: latency < 2s': () => retryTime < 2000,
      });

      if (retrySuccess) {
        try {
          const retryStatus = JSON.parse(retryRes.body);
          messagesRetried.add(retryStatus.retryCount || 0);
        } catch (e) {
          console.error('Failed to parse retry response:', e);
        }
      } else {
        errorRate.add(1);
      }
    }
  } else {
    messagesFailed.add(1);
    errorRate.add(1);
  }

  sleep(0.5);
}

/**
 * Setup function
 */
export function setup() {
  console.log('=== Starting Worker Throughput Test ===');
  console.log(`API URL: ${API_BASE_URL}`);
  console.log(`Mode: ${isCI ? 'CI (optimized for speed)' : 'Full (production simulation)'}`);
  console.log('Test scenarios:');

  if (isCI) {
    console.log('  1. Baseline: 1 worker @ 80 msg/min (2m)');
    console.log('  2. Medium: 5 workers @ 150 msg/min (3m)');
    console.log('  3. High: 10 workers @ 250 msg/min (3m)');
    console.log('  4. Failure: Retry testing @ 100 msg/min (2m)');
    console.log('Expected total: ~1,410 messages processed');
  } else {
    console.log('  1. Baseline: 1 worker @ 100 msg/min (5m)');
    console.log('  2. Medium: 5 workers @ 500 msg/min (5m)');
    console.log('  3. High: 10 workers @ 1000 msg/min (10m)');
    console.log('  4. Peak: 10 workers @ 2000 msg/min (5m)');
    console.log('  5. Failure: Retry testing @ 200 msg/min (5m)');
    console.log('Expected total: ~10,000 messages processed');
  }

  // Health check
  const warmupRes = http.get(`${API_BASE_URL}/health`);
  if (warmupRes.status !== 200) {
    throw new Error('API health check failed - aborting test');
  }

  // Check RabbitMQ connection
  const queueRes = http.get(`${QUEUE_API_URL}/health`, {
    timeout: '10s',
  });

  if (queueRes.status !== 200) {
    throw new Error('RabbitMQ health check failed - aborting test');
  }

  // Get initial queue stats
  const statsRes = http.get(`${QUEUE_API_URL}/stats`, {
    timeout: '10s',
  });

  let initialQueueDepth = 0;
  if (statsRes.status === 200) {
    try {
      const stats = JSON.parse(statsRes.body);
      initialQueueDepth = stats.queueDepth || 0;
      console.log(`Initial queue depth: ${initialQueueDepth}`);
    } catch (e) {
      console.error('Failed to parse queue stats:', e);
    }
  }

  return {
    startTime: new Date(),
    initialQueueDepth,
  };
}

/**
 * Teardown function
 */
export function teardown(data) {
  const endTime = new Date();
  const duration = (endTime - data.startTime) / 1000 / 60; // minutes

  console.log('\n=== Worker Throughput Test Complete ===');
  console.log(`Duration: ${duration.toFixed(2)} minutes`);
  console.log(`Messages Enqueued: ${messagesEnqueued.count}`);
  console.log(`Messages Processed: ${messagesProcessed.count}`);
  console.log(`Messages Failed: ${messagesFailed.count}`);
  console.log(`Messages Retried: ${messagesRetried.count}`);

  const successRate =
    (messagesProcessed.count / (messagesProcessed.count + messagesFailed.count)) * 100;
  console.log(`Success Rate: ${successRate.toFixed(2)}%`);

  if (duration > 0 && messagesProcessed.count > 0) {
    const avgThroughput = messagesProcessed.count / (duration * 60);
    console.log(`Average Throughput: ${avgThroughput.toFixed(2)} msg/s`);
  }

  // Get final queue stats
  const statsRes = http.get(`${QUEUE_API_URL}/stats`, {
    timeout: '10s',
  });

  if (statsRes.status === 200) {
    try {
      const stats = JSON.parse(statsRes.body);
      console.log(`Final queue depth: ${stats.queueDepth || 0}`);
      console.log(
        `Queue depth change: ${(stats.queueDepth || 0) - data.initialQueueDepth}`
      );
    } catch (e) {
      console.error('Failed to parse final queue stats:', e);
    }
  }
}

/**
 * Handle summary
 */
export function handleSummary(data) {
  return {
    'perf-results/worker-throughput-summary.json': JSON.stringify(data, null, 2),
    stdout: textSummary(data),
  };
}

function textSummary(data) {
  let summary = '\n=== Worker Throughput Test Summary ===\n\n';

  // Throughput by worker count
  summary += 'Worker Throughput (msg/s):\n';
  ['1', '5', '10'].forEach((workers) => {
    const metricKey = `worker_throughput{workers:${workers}}`;
    if (data.metrics[metricKey]) {
      const throughput = data.metrics[metricKey].values;
      summary += `  ${workers} worker(s): ${throughput.avg?.toFixed(2)} msg/s\n`;
    }
  });
  summary += '\n';

  // Processing time by scenario
  summary += 'Message Processing Time:\n';
  ['baseline', 'medium', 'high', 'peak'].forEach((scenario) => {
    const metricKey = `message_processing_time{scenario:${scenario}}`;
    if (data.metrics[metricKey]) {
      const time = data.metrics[metricKey].values;
      summary += `  ${scenario}: p95=${time['p(95)']?.toFixed(2)}ms, p99=${time['p(99)']?.toFixed(2)}ms\n`;
    }
  });
  summary += '\n';

  // Retry metrics
  if (data.metrics.retry_latency) {
    summary += 'Retry Performance:\n';
    const retry = data.metrics.retry_latency.values;
    summary += `  p95: ${retry['p(95)']?.toFixed(2)}ms\n`;
    summary += `  p99: ${retry['p(99)']?.toFixed(2)}ms\n\n`;
  }

  // Scaling efficiency
  summary += 'Scaling Efficiency Analysis:\n';
  const throughput1 = data.metrics['worker_throughput{workers:1}']?.values.avg;
  const throughput5 = data.metrics['worker_throughput{workers:5}']?.values.avg;
  const throughput10 = data.metrics['worker_throughput{workers:10}']?.values.avg;

  if (throughput1 && throughput10) {
    const efficiency = (throughput10 / (throughput1 * 10)) * 100;
    summary += `  10 workers efficiency: ${efficiency.toFixed(1)}%\n`;
    summary += `  Expected: 90% (linear scaling)\n`;
  }

  if (throughput1 && throughput5) {
    const efficiency5 = (throughput5 / (throughput1 * 5)) * 100;
    summary += `  5 workers efficiency: ${efficiency5.toFixed(1)}%\n`;
  }

  return summary;
}
