import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend, Counter } from 'k6/metrics';
import { randomString } from 'https://jslib.k6.io/k6-utils/1.2.0/index.js';

// Custom metrics
const errorRate = new Rate('errors');
const createUserDuration = new Trend('create_user_duration');
const readUserDuration = new Trend('read_user_duration');
const updateUserDuration = new Trend('update_user_duration');
const deleteUserDuration = new Trend('delete_user_duration');
const usersCreated = new Counter('users_created');
const usersRead = new Counter('users_read');
const usersUpdated = new Counter('users_updated');
const usersDeleted = new Counter('users_deleted');
const operationsFailed = new Counter('operations_failed');

// CI mode detection
const isCI = __ENV.CI === 'true';

// Load stages based on environment
const LOAD_STAGES = isCI
  ? [
      { duration: '30s', target: 50 },   // CI: Ramp to 50 users
      { duration: '1m', target: 200 },   // CI: Ramp to 200 users
      { duration: '3m', target: 200 },   // CI: Sustain for 3 minutes
      { duration: '1m', target: 0 },     // CI: Ramp down
    ]  // Total: ~5.5 minutes (leaving 4.5 min buffer for setup)
  : [
      { duration: '2m', target: 100 },   // Full: Ramp up to 100 users
      { duration: '3m', target: 500 },   // Full: Ramp up to 500 users
      { duration: '5m', target: 1000 },  // Full: Ramp up to 1000 users
      { duration: '30m', target: 1000 }, // Full: Sustain 1000 users for 30 minutes
      { duration: '5m', target: 0 },     // Full: Ramp down
    ];

/**
 * K6 Performance Test: API Load Test
 *
 * Tests all CRUD operations for /api/v1/users endpoint:
 * - POST /api/v1/users (create users)
 * - GET /api/v1/users/:id (read users)
 * - PUT /api/v1/users/:id (update users)
 * - DELETE /api/v1/users/:id (delete users)
 *
 * Load profile (CI mode: ~5.5 min test + 4.5 min setup buffer = 10 min total):
 * - Ramp up: 0 → 50 → 200 users over 1.5 minutes
 * - Sustained: 200 users for 3 minutes
 * - Ramp down: 1 minute
 *
 * Load profile (Full mode: ~45 min total):
 * - Ramp up: 0 → 100 → 500 → 1000 users over 10 minutes
 * - Sustained: 30 minutes at 1000 concurrent users
 * - Ramp down: 5 minutes
 *
 * Thresholds:
 * - p95 < 500ms
 * - p99 < 1000ms
 * - Error rate < 1%
 */
export const options = {
  scenarios: {
    api_crud_load_test: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: LOAD_STAGES,
      gracefulRampDown: '30s',
    },
  },
  thresholds: {
    http_req_duration: [
      'p(95)<500',  // 95% of requests must complete below 500ms
      'p(99)<1000', // 99% of requests must complete below 1s
    ],
    http_req_failed: ['rate<0.01'], // <1% error rate
    errors: ['rate<0.01'],
    create_user_duration: ['p(95)<500', 'p(99)<1000'],
    read_user_duration: ['p(95)<300', 'p(99)<500'],
    update_user_duration: ['p(95)<500', 'p(99)<1000'],
    delete_user_duration: ['p(95)<400', 'p(99)<800'],
  },
  summaryTrendStats: ['avg', 'min', 'med', 'max', 'p(90)', 'p(95)', 'p(99)', 'p(99.9)'],
};

// Configuration
const API_BASE_URL = __ENV.API_URL || 'http://localhost:3000';
const TIMEZONES = [
  'America/New_York',
  'America/Los_Angeles',
  'Europe/London',
  'Asia/Tokyo',
  'Australia/Sydney',
  'America/Chicago',
  'Europe/Paris',
  'Asia/Singapore',
];

// Shared data between VUs
let createdUserIds = [];

/**
 * Generate random user payload
 */
function generateUserPayload() {
  const id = randomString(8);
  return {
    firstName: `User${id}`,
    lastName: `Test${id}`,
    email: `user-${id}-${Date.now()}@example.com`,
    timezone: TIMEZONES[Math.floor(Math.random() * TIMEZONES.length)],
    birthdayDate: `199${Math.floor(Math.random() * 10)}-${String(Math.floor(Math.random() * 12) + 1).padStart(2, '0')}-${String(Math.floor(Math.random() * 28) + 1).padStart(2, '0')}`,
    anniversaryDate: `20${String(10 + Math.floor(Math.random() * 15))}-${String(Math.floor(Math.random() * 12) + 1).padStart(2, '0')}-${String(Math.floor(Math.random() * 28) + 1).padStart(2, '0')}`,
    locationCity: `City${Math.floor(Math.random() * 100)}`,
    locationCountry: `Country${Math.floor(Math.random() * 50)}`,
  };
}

/**
 * Test CREATE user endpoint
 */
function testCreateUser() {
  const payload = generateUserPayload();
  const startTime = Date.now();

  const res = http.post(`${API_BASE_URL}/api/v1/users`, JSON.stringify(payload), {
    headers: {
      'Content-Type': 'application/json',
    },
    timeout: '30s',
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
    'create: duration < 500ms': () => duration < 500,
  });

  if (success) {
    usersCreated.add(1);
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
    operationsFailed.add(1);
    errorRate.add(1);
    console.error(`Create failed: ${res.status} - ${res.body}`);
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
    timeout: '30s',
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
    'read: duration < 300ms': () => duration < 300,
  });

  if (success) {
    usersRead.add(1);
  } else {
    operationsFailed.add(1);
    errorRate.add(1);
    console.error(`Read failed: ${res.status} - ${res.body}`);
  }

  return success;
}

/**
 * Test UPDATE user endpoint
 */
function testUpdateUser(userId) {
  if (!userId) return false;

  const updatePayload = {
    firstName: `Updated${randomString(4)}`,
    lastName: `User${randomString(4)}`,
    locationCity: `NewCity${Math.floor(Math.random() * 1000)}`,
  };

  const startTime = Date.now();

  const res = http.put(
    `${API_BASE_URL}/api/v1/users/${userId}`,
    JSON.stringify(updatePayload),
    {
      headers: {
        'Content-Type': 'application/json',
      },
      timeout: '30s',
    }
  );

  const duration = Date.now() - startTime;
  updateUserDuration.add(duration);

  const success = check(res, {
    'update: status is 200': (r) => r.status === 200,
    'update: data updated': (r) => {
      try {
        const body = JSON.parse(r.body);
        return body.data && body.data.firstName === updatePayload.firstName;
      } catch {
        return false;
      }
    },
    'update: duration < 500ms': () => duration < 500,
  });

  if (success) {
    usersUpdated.add(1);
  } else {
    operationsFailed.add(1);
    errorRate.add(1);
    console.error(`Update failed: ${res.status} - ${res.body}`);
  }

  return success;
}

/**
 * Test DELETE user endpoint
 */
function testDeleteUser(userId) {
  if (!userId) return false;

  const startTime = Date.now();

  const res = http.del(`${API_BASE_URL}/api/v1/users/${userId}`, null, {
    timeout: '30s',
  });

  const duration = Date.now() - startTime;
  deleteUserDuration.add(duration);

  const success = check(res, {
    'delete: status is 200': (r) => r.status === 200,
    'delete: success response': (r) => {
      try {
        const body = JSON.parse(r.body);
        return body.success === true;
      } catch {
        return false;
      }
    },
    'delete: duration < 400ms': () => duration < 400,
  });

  if (success) {
    usersDeleted.add(1);
  } else {
    operationsFailed.add(1);
    errorRate.add(1);
    console.error(`Delete failed: ${res.status} - ${res.body}`);
  }

  return success;
}

/**
 * Main test function
 */
export default function () {
  // Simulate realistic user behavior with CRUD operations
  const operation = Math.random();

  if (operation < 0.4) {
    // 40% CREATE operations
    const userId = testCreateUser();
    if (userId) {
      sleep(0.5);
      // Verify creation with READ
      testReadUser(userId);
    }
  } else if (operation < 0.7) {
    // 30% READ operations
    if (createdUserIds.length > 0) {
      const userId = createdUserIds[Math.floor(Math.random() * createdUserIds.length)];
      testReadUser(userId);
    } else {
      // Create a user if none exist
      testCreateUser();
    }
  } else if (operation < 0.9) {
    // 20% UPDATE operations
    if (createdUserIds.length > 0) {
      const userId = createdUserIds[Math.floor(Math.random() * createdUserIds.length)];
      testUpdateUser(userId);
    } else {
      testCreateUser();
    }
  } else {
    // 10% DELETE operations
    if (createdUserIds.length > 0) {
      const index = Math.floor(Math.random() * createdUserIds.length);
      const userId = createdUserIds[index];
      const success = testDeleteUser(userId);
      if (success) {
        // Remove from array if deletion successful
        createdUserIds.splice(index, 1);
      }
    }
  }

  // Realistic think time between operations
  sleep(Math.random() * 2 + 0.5); // 0.5-2.5 seconds
}

/**
 * Setup function (runs once at start)
 */
export function setup() {
  console.log('=== Starting API Load Test ===');
  console.log(`API URL: ${API_BASE_URL}`);
  console.log(`Mode: ${isCI ? 'CI (optimized for speed)' : 'Full (production simulation)'}`);
  console.log('Test scenario: CRUD operations on /api/v1/users');

  if (isCI) {
    console.log('Load profile: 0 → 50 → 200 users over 1.5 minutes');
    console.log('Sustained load: 200 users for 3 minutes');
    console.log('Expected operations: ~8,000 total requests');
  } else {
    console.log('Load profile: 0 → 100 → 500 → 1000 users over 10 minutes');
    console.log('Sustained load: 1000 users for 30 minutes');
    console.log('Expected operations: ~100,000 total requests');
  }

  // Health check
  const warmupRes = http.get(`${API_BASE_URL}/health`);
  check(warmupRes, {
    'API is healthy': (r) => r.status === 200,
  });

  if (warmupRes.status !== 200) {
    throw new Error('API health check failed - aborting test');
  }

  return { startTime: new Date() };
}

/**
 * Teardown function (runs once at end)
 */
export function teardown(data) {
  const endTime = new Date();
  const duration = (endTime - data.startTime) / 1000 / 60; // minutes

  console.log('\n=== API Load Test Complete ===');
  console.log(`Duration: ${duration.toFixed(2)} minutes`);
  console.log(`Users Created: ${usersCreated.count}`);
  console.log(`Users Read: ${usersRead.count}`);
  console.log(`Users Updated: ${usersUpdated.count}`);
  console.log(`Users Deleted: ${usersDeleted.count}`);
  console.log(`Operations Failed: ${operationsFailed.count}`);
  console.log(
    `Success Rate: ${(((usersCreated.count + usersRead.count + usersUpdated.count + usersDeleted.count) / (usersCreated.count + usersRead.count + usersUpdated.count + usersDeleted.count + operationsFailed.count)) * 100).toFixed(2)}%`
  );
}

/**
 * Handle summary data
 */
export function handleSummary(data) {
  return {
    'perf-results/api-load-summary.json': JSON.stringify(data, null, 2),
    stdout: textSummary(data, { indent: ' ', enableColors: true }),
  };
}

// Helper function for text summary
function textSummary(data, options = {}) {
  const indent = options.indent || '';
  let summary = '\n';

  summary += `${indent}=== API Load Test Summary ===\n\n`;

  // Request metrics
  if (data.metrics.http_req_duration) {
    summary += `${indent}HTTP Request Duration:\n`;
    const reqDuration = data.metrics.http_req_duration.values;
    summary += `${indent}  avg: ${reqDuration.avg?.toFixed(2)}ms\n`;
    summary += `${indent}  min: ${reqDuration.min?.toFixed(2)}ms\n`;
    summary += `${indent}  med: ${reqDuration.med?.toFixed(2)}ms\n`;
    summary += `${indent}  max: ${reqDuration.max?.toFixed(2)}ms\n`;
    summary += `${indent}  p(95): ${reqDuration['p(95)']?.toFixed(2)}ms\n`;
    summary += `${indent}  p(99): ${reqDuration['p(99)']?.toFixed(2)}ms\n\n`;
  }

  // Operation-specific metrics
  const operations = [
    'create_user_duration',
    'read_user_duration',
    'update_user_duration',
    'delete_user_duration',
  ];

  operations.forEach((op) => {
    if (data.metrics[op]) {
      summary += `${indent}${op.replace(/_/g, ' ').toUpperCase()}:\n`;
      const values = data.metrics[op].values;
      summary += `${indent}  p(95): ${values['p(95)']?.toFixed(2)}ms\n`;
      summary += `${indent}  p(99): ${values['p(99)']?.toFixed(2)}ms\n\n`;
    }
  });

  return summary;
}
