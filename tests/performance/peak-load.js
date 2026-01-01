import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend, Counter } from 'k6/metrics';

// Custom metrics
const errorRate = new Rate('errors');
const messageProcessingTime = new Trend('message_processing_time');
const messagesProcessed = new Counter('messages_processed');
const messagesFailed = new Counter('messages_failed');

// CI mode detection
const isCI = __ENV.CI === 'true';

/**
 * K6 Performance Test: Peak Load (100+ msg/sec)
 *
 * This test simulates peak load scenarios:
 * - Ramp up from baseline to 100+ msg/sec (peak)
 * - Sustain peak load
 * - Ramp down to baseline
 *
 * CI mode (~5 min total):
 * - Baseline: 1 min at 12 msg/sec
 * - Ramp up: 30s to 100 msg/sec
 * - Peak: 2 min at 100 msg/sec
 * - Stress: 30s at 120 msg/sec
 * - Ramp down: 1 min to baseline
 *
 * Full mode (~11 min total):
 * - Baseline: 2 min at 12 msg/sec
 * - Ramp up: 1 min to 100 msg/sec
 * - Peak: 5 min at 100 msg/sec
 * - Stress: 1 min at 120 msg/sec
 * - Ramp down: 2 min to baseline
 *
 * Thresholds:
 * - Target: <1s p95, <2s p99 latency during peak
 * - Target: <5% error rate
 */
export const options = {
  scenarios: {
    peak_100_msg_sec: {
      executor: 'ramping-arrival-rate',
      startRate: 12,
      timeUnit: '1s',
      preAllocatedVUs: isCI ? 75 : 100,
      maxVUs: isCI ? 150 : 200,
      stages: isCI ? [
        { duration: '1m', target: 12 },   // Baseline: 1 minute at 12 msg/sec
        { duration: '30s', target: 100 }, // Ramp up: 30s to 100 msg/sec
        { duration: '2m', target: 100 },  // Peak: 2 minutes at 100 msg/sec
        { duration: '30s', target: 120 }, // Stress: 30s at 120 msg/sec
        { duration: '1m', target: 12 },   // Ramp down: 1 minute back to baseline
      ] : [
        { duration: '2m', target: 12 },   // Baseline: 2 minutes at 12 msg/sec
        { duration: '1m', target: 100 },  // Ramp up: 1 minute to 100 msg/sec
        { duration: '5m', target: 100 },  // Peak: 5 minutes at 100 msg/sec
        { duration: '1m', target: 120 },  // Stress: 1 minute at 120 msg/sec
        { duration: '2m', target: 12 },   // Ramp down: 2 minutes back to baseline
      ],
    },
  },
  thresholds: {
    http_req_duration: [
      'p(95)<1000', // 95% under 1s (relaxed for peak)
      'p(99)<2000', // 99% under 2s
    ],
    http_req_failed: ['rate<0.05'], // <5% errors acceptable during peak
    errors: ['rate<0.05'],
    message_processing_time: ['p(95)<1000', 'p(99)<2000'],
  },
  summaryTrendStats: ['avg', 'min', 'med', 'max', 'p(90)', 'p(95)', 'p(99)', 'p(99.9)'],
};

// Configuration
const API_BASE_URL = __ENV.API_URL || 'http://localhost:3000';
const MESSAGE_TYPES = ['BIRTHDAY', 'ANNIVERSARY'];

/**
 * Generate random user ID
 */
function generateUserId() {
  return `user-${Math.floor(Math.random() * 1000000)}`;
}

/**
 * Generate random message payload
 */
function generateMessagePayload() {
  const messageType = MESSAGE_TYPES[Math.floor(Math.random() * MESSAGE_TYPES.length)];
  const userId = generateUserId();
  const scheduledTime = new Date();
  scheduledTime.setHours(9, 0, 0, 0);

  return {
    userId,
    messageType,
    scheduledSendTime: scheduledTime.toISOString(),
    messageContent: `Happy ${messageType === 'BIRTHDAY' ? 'birthday' : 'anniversary'}!`,
    idempotencyKey: `${messageType}-${userId}-${Date.now()}`,
  };
}

/**
 * Main test function
 */
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
    'processing time < 1000ms': () => processingTime < 1000,
    'processing time < 2000ms': () => processingTime < 2000,
    'response has body': (r) => r.body && r.body.length > 0,
  });

  if (success) {
    messagesProcessed.add(1);
  } else {
    messagesFailed.add(1);
    errorRate.add(1);
  }

  sleep(0.05); // Minimal sleep for peak load
}

/**
 * Setup function
 */
export function setup() {
  console.log('=== Starting Peak Load Test ===');
  console.log(`API URL: ${API_BASE_URL}`);
  console.log(`Mode: ${isCI ? 'CI (optimized for speed)' : 'Full (production simulation)'}`);
  console.log('Peak target: 100 messages/second');
  console.log('Stress target: 120 messages/second');

  if (isCI) {
    console.log('CI mode: 5 minute test (reduced duration)');
  } else {
    console.log('Full mode: 11 minute test (comprehensive)');
  }

  // Warmup
  const warmupRes = http.get(`${API_BASE_URL}/health`);
  check(warmupRes, {
    'warmup successful': (r) => r.status === 200,
  });

  return { startTime: new Date() };
}

/**
 * Teardown function
 */
export function teardown(data) {
  const endTime = new Date();
  const duration = (endTime - data.startTime) / 1000 / 60; // minutes

  console.log('\n=== Peak Load Test Complete ===');
  console.log(`Duration: ${duration.toFixed(2)} minutes`);
  console.log(`Messages Processed: ${messagesProcessed.count}`);
  console.log(`Messages Failed: ${messagesFailed.count}`);
  console.log(
    `Success Rate: ${((messagesProcessed.count / (messagesProcessed.count + messagesFailed.count)) * 100).toFixed(2)}%`
  );
}

/**
 * Handle summary
 */
export function handleSummary(data) {
  return {
    'perf-results/peak-load-summary.json': JSON.stringify(data, null, 2),
    stdout: JSON.stringify(data, null, 2),
  };
}
