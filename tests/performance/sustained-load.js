import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend, Counter } from 'k6/metrics';
import { generatePerformanceUserId, PERF_CONFIG } from './utils.js';

// Custom metrics
const errorRate = new Rate('errors');
const messageProcessingTime = new Trend('message_processing_time');
const messagesProcessed = new Counter('messages_processed');
const messagesFailed = new Counter('messages_failed');

/**
 * K6 Performance Test: Sustained Load (1M messages/day simulation)
 *
 * This test simulates:
 * - 1,000,000 messages per day = 11.5 messages/second sustained
 * - 24 hour duration
 * - Target: <500ms p95, <1s p99 latency
 * - Target: <1% error rate
 */
export const options = {
  scenarios: {
    sustained_1m_per_day: {
      executor: 'constant-arrival-rate',
      rate: 12, // 11.5 msg/sec rounded to 12
      timeUnit: '1s',
      duration: '24h', // Full day test
      preAllocatedVUs: 50,
      maxVUs: 100,
    },
  },
  thresholds: {
    http_req_duration: [
      'p(95)<500', // 95% of requests must complete below 500ms
      'p(99)<1000', // 99% of requests must complete below 1s
    ],
    http_req_failed: ['rate<0.01'], // <1% error rate
    errors: ['rate<0.01'],
    message_processing_time: ['p(95)<500', 'p(99)<1000'],
  },
  summaryTrendStats: ['avg', 'min', 'med', 'max', 'p(90)', 'p(95)', 'p(99)', 'p(99.9)'],
};

// Configuration
const API_BASE_URL = __ENV.API_URL || 'http://localhost:3000';
const MESSAGE_TYPES = PERF_CONFIG.MESSAGE_TYPES;

/**
 * Generate random message payload
 */
function generateMessagePayload() {
  const messageType = MESSAGE_TYPES[Math.floor(Math.random() * MESSAGE_TYPES.length)];
  const userId = generatePerformanceUserId();
  const scheduledTime = new Date();
  scheduledTime.setHours(9, 0, 0, 0); // 9am send time

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
    'status is 200': (r) => r.status === 200,
    'status is 201': (r) => r.status === 201,
    'processing time < 500ms': () => processingTime < 500,
    'processing time < 1000ms': () => processingTime < 1000,
    'response has body': (r) => r.body && r.body.length > 0,
  });

  if (success) {
    messagesProcessed.add(1);
  } else {
    messagesFailed.add(1);
    errorRate.add(1);
    console.error(`Request failed: ${res.status} - ${res.body}`);
  }

  // Small sleep to simulate realistic load
  sleep(0.1);
}

/**
 * Setup function (runs once per VU at start)
 */
export function setup() {
  console.log('Starting sustained load test...');
  console.log(`API URL: ${API_BASE_URL}`);
  console.log('Target: 11.5 messages/second for 24 hours');
  console.log('Expected total: ~1,000,000 messages');

  // Warmup request
  const warmupRes = http.get(`${API_BASE_URL}/health`);
  check(warmupRes, {
    'warmup successful': (r) => r.status === 200,
  });

  return { startTime: new Date() };
}

/**
 * Teardown function (runs once at end)
 */
export function teardown(data) {
  const endTime = new Date();
  const duration = (endTime - data.startTime) / 1000 / 60 / 60; // hours

  console.log('\n=== Sustained Load Test Complete ===');
  console.log(`Duration: ${duration.toFixed(2)} hours`);
  console.log(`Messages Processed: ${messagesProcessed.count}`);
  console.log(`Messages Failed: ${messagesFailed.count}`);
  console.log(
    `Success Rate: ${((messagesProcessed.count / (messagesProcessed.count + messagesFailed.count)) * 100).toFixed(2)}%`
  );
}

/**
 * Handle summary data
 */
export function handleSummary(data) {
  return {
    'perf-results/sustained-load-summary.json': JSON.stringify(data, null, 2),
    stdout: textSummary(data, { indent: ' ', enableColors: true }),
  };
}

// Helper function for text summary
function textSummary(data, options = {}) {
  const indent = options.indent || '';
  let summary = '\n';

  summary += `${indent}Test Summary:\n`;
  summary += `${indent}============\n\n`;

  for (const [name, scenario] of Object.entries(data.metrics)) {
    if (scenario.values) {
      summary += `${indent}${name}:\n`;
      for (const [key, value] of Object.entries(scenario.values)) {
        summary += `${indent}  ${key}: ${value}\n`;
      }
      summary += '\n';
    }
  }

  return summary;
}
