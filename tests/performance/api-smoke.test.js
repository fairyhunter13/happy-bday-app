import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';
import { randomString } from 'https://jslib.k6.io/k6-utils/1.2.0/index.js';

// Custom metrics
const errorRate = new Rate('errors');
const createUserDuration = new Trend('create_user_duration');
const readUserDuration = new Trend('read_user_duration');

/**
 * K6 Performance Smoke Test
 *
 * Quick performance validation for CI pipeline:
 * - Tests basic CRUD operations
 * - Verifies response times under light load
 * - Catches major performance regressions
 *
 * Duration: ~2.5 minutes (CI-friendly)
 * Load: 10 concurrent users
 */
export const options = {
  scenarios: {
    smoke_test: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '30s', target: 10 },  // Ramp up to 10 users
        { duration: '1m', target: 10 },   // Sustained load
        { duration: '30s', target: 0 },   // Ramp down
      ],
      gracefulRampDown: '10s',
    },
  },
  thresholds: {
    http_req_duration: [
      'p(95)<1000',  // 95% of requests must complete below 1s
      'p(99)<2000',  // 99% of requests must complete below 2s
    ],
    http_req_failed: ['rate<0.05'], // <5% error rate for smoke test
    errors: ['rate<0.05'],
    create_user_duration: ['p(95)<1000'],
    read_user_duration: ['p(95)<500'],
  },
};

// Configuration
const API_BASE_URL = __ENV.API_URL || 'http://localhost:3000';
const TIMEZONES = [
  'America/New_York',
  'America/Los_Angeles',
  'Europe/London',
  'Asia/Tokyo',
];

// Track created users for cleanup/read operations
const createdUserIds = [];

/**
 * Generate random user payload
 */
function generateUserPayload() {
  const id = randomString(8);
  return {
    firstName: `Smoke${id}`,
    lastName: `Test${id}`,
    email: `smoke-${id}-${Date.now()}@example.com`,
    timezone: TIMEZONES[Math.floor(Math.random() * TIMEZONES.length)],
    birthdayDate: `1990-${String(Math.floor(Math.random() * 12) + 1).padStart(2, '0')}-${String(Math.floor(Math.random() * 28) + 1).padStart(2, '0')}`,
  };
}

/**
 * Test CREATE user endpoint
 */
function testCreateUser() {
  const payload = generateUserPayload();
  const startTime = Date.now();

  const res = http.post(`${API_BASE_URL}/api/v1/users`, JSON.stringify(payload), {
    headers: { 'Content-Type': 'application/json' },
    timeout: '10s',
  });

  const duration = Date.now() - startTime;
  createUserDuration.add(duration);

  const success = check(res, {
    'create: status is 201': (r) => r.status === 201,
    'create: has user ID': (r) => {
      try {
        const body = JSON.parse(r.body);
        return body.data && body.data.id;
      } catch {
        return false;
      }
    },
  });

  if (success) {
    try {
      const body = JSON.parse(res.body);
      if (body.data && body.data.id) {
        createdUserIds.push(body.data.id);
        return body.data.id;
      }
    } catch (e) {
      console.error('Failed to parse create response:', e);
    }
  } else {
    errorRate.add(1);
  }

  return null;
}

/**
 * Test READ user endpoint
 */
function testReadUser(userId) {
  if (!userId) return false;

  const startTime = Date.now();

  const res = http.get(`${API_BASE_URL}/api/v1/users/${userId}`, {
    timeout: '10s',
  });

  const duration = Date.now() - startTime;
  readUserDuration.add(duration);

  const success = check(res, {
    'read: status is 200': (r) => r.status === 200,
    'read: has user data': (r) => {
      try {
        const body = JSON.parse(r.body);
        return body.data && body.data.id === userId;
      } catch {
        return false;
      }
    },
  });

  if (!success) {
    errorRate.add(1);
  }

  return success;
}

/**
 * Main test function
 */
export default function () {
  // Simple alternating pattern: CREATE, then READ
  const userId = testCreateUser();

  if (userId) {
    sleep(0.2);
    testReadUser(userId);
  }

  // Brief pause between iterations
  sleep(Math.random() * 0.5 + 0.2);
}

/**
 * Setup function
 */
export function setup() {
  console.log('=== Starting API Smoke Test ===');
  console.log(`API URL: ${API_BASE_URL}`);

  // Health check
  const healthRes = http.get(`${API_BASE_URL}/health`);
  const healthy = check(healthRes, {
    'API is healthy': (r) => r.status === 200,
  });

  if (!healthy) {
    throw new Error('API health check failed - aborting smoke test');
  }

  return { startTime: new Date() };
}

/**
 * Teardown function
 */
export function teardown(data) {
  const endTime = new Date();
  const duration = (endTime - data.startTime) / 1000;
  console.log(`\n=== Smoke Test Complete (${duration.toFixed(1)}s) ===`);
}

/**
 * Handle summary data
 */
export function handleSummary(data) {
  const passed = !data.root_group.checks?.some(c => c.fails > 0);
  const thresholdsPassed = !Object.values(data.metrics).some(m => m.thresholds?.some(t => !t.ok));

  console.log(`\nSmoke Test: ${passed && thresholdsPassed ? 'PASSED' : 'FAILED'}`);

  return {
    'perf-results/smoke-test-summary.json': JSON.stringify(data, null, 2),
    stdout: generateSummary(data),
  };
}

function generateSummary(data) {
  let summary = '\n=== Performance Smoke Test Results ===\n\n';

  if (data.metrics.http_req_duration) {
    const d = data.metrics.http_req_duration.values;
    summary += `HTTP Requests:\n`;
    summary += `  avg: ${d.avg?.toFixed(0)}ms | p95: ${d['p(95)']?.toFixed(0)}ms | p99: ${d['p(99)']?.toFixed(0)}ms\n\n`;
  }

  if (data.metrics.create_user_duration) {
    const d = data.metrics.create_user_duration.values;
    summary += `Create User: p95=${d['p(95)']?.toFixed(0)}ms\n`;
  }

  if (data.metrics.read_user_duration) {
    const d = data.metrics.read_user_duration.values;
    summary += `Read User: p95=${d['p(95)']?.toFixed(0)}ms\n`;
  }

  return summary;
}
