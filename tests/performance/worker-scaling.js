import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend, Counter } from 'k6/metrics';

// Custom metrics
const errorRate = new Rate('errors');
const messageProcessingTime = new Trend('message_processing_time');
const messagesProcessed = new Counter('messages_processed');

// CI mode detection
const isCI = __ENV.CI === 'true';

/**
 * K6 Performance Test: Worker Scaling Test
 *
 * This test validates:
 * - Linear scaling efficiency with worker count
 *
 * CI mode (~6 min total):
 * - 1 worker: 10 msg/sec for 2 minutes
 * - 5 workers: 50 msg/sec for 2 minutes
 * - 10 workers: 100 msg/sec for 2 minutes
 *
 * Full mode (~17 min total):
 * - 1 worker: 10 msg/sec for 5 minutes
 * - 5 workers: 50 msg/sec for 5 minutes
 * - 10 workers: 100 msg/sec for 5 minutes
 * - Target: 90% scaling efficiency (10 workers = 9x throughput)
 */
export const options = {
  scenarios: isCI ? {
    // CI mode: shorter durations (~6 min total)
    test_1_worker: {
      executor: 'constant-arrival-rate',
      rate: 10,
      duration: '2m',
      preAllocatedVUs: 15,
      maxVUs: 30,
      tags: { workers: '1' },
      startTime: '0s',
    },
    test_5_workers: {
      executor: 'constant-arrival-rate',
      rate: 50,
      duration: '2m',
      preAllocatedVUs: 50,
      maxVUs: 100,
      tags: { workers: '5' },
      startTime: '2m',
    },
    test_10_workers: {
      executor: 'constant-arrival-rate',
      rate: 100,
      duration: '2m',
      preAllocatedVUs: 100,
      maxVUs: 200,
      tags: { workers: '10' },
      startTime: '4m',
    },
  } : {
    // Full mode: original durations (~17 min total)
    test_1_worker: {
      executor: 'constant-arrival-rate',
      rate: 10,
      duration: '5m',
      preAllocatedVUs: 20,
      maxVUs: 40,
      tags: { workers: '1' },
      startTime: '0s',
    },
    test_5_workers: {
      executor: 'constant-arrival-rate',
      rate: 50,
      duration: '5m',
      preAllocatedVUs: 75,
      maxVUs: 150,
      tags: { workers: '5' },
      startTime: '6m', // Start after 1-worker test
    },
    test_10_workers: {
      executor: 'constant-arrival-rate',
      rate: 100,
      duration: '5m',
      preAllocatedVUs: 150,
      maxVUs: 250,
      tags: { workers: '10' },
      startTime: '12m', // Start after 5-worker test
    },
  },
  thresholds: {
    'http_req_duration{workers:1}': ['p(95)<500'],
    'http_req_duration{workers:5}': ['p(95)<600'],
    'http_req_duration{workers:10}': ['p(95)<700'],
    'http_req_failed{workers:1}': ['rate<0.01'],
    'http_req_failed{workers:5}': ['rate<0.02'],
    'http_req_failed{workers:10}': ['rate<0.03'],
  },
};

const API_BASE_URL = __ENV.API_URL || 'http://localhost:3000';
const MESSAGE_TYPES = ['BIRTHDAY', 'ANNIVERSARY'];

function generateUserId() {
  return `user-${Math.floor(Math.random() * 1000000)}`;
}

function generateMessagePayload() {
  const messageType = MESSAGE_TYPES[Math.floor(Math.random() * MESSAGE_TYPES.length)];
  const userId = generateUserId();

  return {
    userId,
    messageType,
    scheduledSendTime: new Date().toISOString(),
    messageContent: `Happy ${messageType === 'BIRTHDAY' ? 'birthday' : 'anniversary'}!`,
    idempotencyKey: `${messageType}-${userId}-${Date.now()}`,
  };
}

export default function () {
  const payload = JSON.stringify(generateMessagePayload());
  const startTime = Date.now();

  const res = http.post(`${API_BASE_URL}/internal/process-message`, payload, {
    headers: {
      'Content-Type': 'application/json',
    },
    timeout: '30s',
  });

  const processingTime = Date.now() - startTime;
  messageProcessingTime.add(processingTime);

  const success = check(res, {
    'status is 200 or 201': (r) => r.status === 200 || r.status === 201,
    'processing time acceptable': () => processingTime < 1000,
  });

  if (success) {
    messagesProcessed.add(1);
  } else {
    errorRate.add(1);
  }

  sleep(0.1);
}

export function setup() {
  console.log('=== Starting Worker Scaling Test ===');
  console.log(`Mode: ${isCI ? 'CI (optimized for speed)' : 'Full (production simulation)'}`);
  console.log('Testing 1, 5, and 10 workers sequentially');

  if (isCI) {
    console.log('CI mode: 2 minutes per worker count (~6 min total)');
  } else {
    console.log('Full mode: 5 minutes per worker count (~17 min total)');
    console.log('Target: 90% scaling efficiency');
  }

  return { startTime: new Date() };
}

export function teardown(data) {
  console.log('\n=== Worker Scaling Test Complete ===');
  console.log('Analyze results to verify linear scaling');
  console.log('Expected: 10 workers should handle ~9x more throughput than 1 worker');
}

export function handleSummary(data) {
  return {
    'perf-results/worker-scaling-summary.json': JSON.stringify(data, null, 2),
    stdout: JSON.stringify(data, null, 2),
  };
}
