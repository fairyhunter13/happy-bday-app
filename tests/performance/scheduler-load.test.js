import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend, Counter, Gauge } from 'k6/metrics';
import { randomString } from 'https://jslib.k6.io/k6-utils/1.2.0/index.js';

// Custom metrics
const errorRate = new Rate('errors');
const schedulerExecutionTime = new Trend('scheduler_execution_time');
const enqueueRate = new Trend('enqueue_rate'); // messages/second
const databaseQueryTime = new Trend('database_query_time');
const birthdaysProcessed = new Counter('birthdays_processed');
const anniversariesProcessed = new Counter('anniversaries_processed');
const messagesEnqueued = new Counter('messages_enqueued');
const duplicatesSkipped = new Counter('duplicates_skipped');
const schedulerErrors = new Counter('scheduler_errors');
const activeSchedulers = new Gauge('active_schedulers');

/**
 * K6 Performance Test: Scheduler Load Test
 *
 * Simulates scheduler performance under production load:
 * - Daily scheduler: 10,000 birthdays/day
 * - Minute scheduler: 500 messages/minute processing
 * - Database query performance measurement
 * - Enqueue rate measurement
 *
 * Thresholds:
 * - Scheduler execution < 30s for 10,000 records
 * - Enqueue rate > 100 msg/s
 * - Database queries < 200ms p95
 * - Error rate < 0.5%
 */
export const options = {
  scenarios: {
    // Test daily scheduler with 10,000 birthdays
    daily_scheduler_load: {
      executor: 'constant-vus',
      vus: 1,
      duration: '10m',
      exec: 'testDailyScheduler',
      tags: { scheduler: 'daily' },
    },
    // Test minute scheduler with high enqueue rate
    minute_scheduler_load: {
      executor: 'constant-arrival-rate',
      rate: 500, // 500 messages per minute
      timeUnit: '1m',
      duration: '15m',
      preAllocatedVUs: 50,
      maxVUs: 100,
      exec: 'testMinuteScheduler',
      tags: { scheduler: 'minute' },
      startTime: '10m', // Start after daily test
    },
    // Test database query performance
    database_query_load: {
      executor: 'ramping-vus',
      startVUs: 1,
      stages: [
        { duration: '2m', target: 10 },
        { duration: '5m', target: 50 },
        { duration: '3m', target: 10 },
      ],
      exec: 'testDatabaseQueries',
      tags: { scheduler: 'database' },
      startTime: '25m', // Start after minute test
    },
  },
  thresholds: {
    'scheduler_execution_time{scheduler:daily}': ['p(95)<30000'], // <30s
    'enqueue_rate{scheduler:minute}': ['avg>100'], // >100 msg/s
    'database_query_time{scheduler:database}': ['p(95)<200'], // <200ms
    'http_req_duration{scheduler:daily}': ['p(95)<30000'],
    'http_req_duration{scheduler:minute}': ['p(95)<1000'],
    'http_req_duration{scheduler:database}': ['p(95)<200'],
    'http_req_failed': ['rate<0.005'], // <0.5% errors
    errors: ['rate<0.005'],
  },
  summaryTrendStats: ['avg', 'min', 'med', 'max', 'p(90)', 'p(95)', 'p(99)'],
};

// Configuration
const API_BASE_URL = __ENV.API_URL || 'http://localhost:3000';
const DB_API_URL = `${API_BASE_URL}/internal/db-stats`;
const SCHEDULER_API_URL = `${API_BASE_URL}/internal/scheduler`;

const TIMEZONES = [
  'America/New_York',
  'America/Los_Angeles',
  'America/Chicago',
  'America/Denver',
  'Europe/London',
  'Europe/Paris',
  'Asia/Tokyo',
  'Asia/Singapore',
  'Australia/Sydney',
  'Pacific/Auckland',
];

/**
 * Create test users in bulk for scheduler testing
 */
function setupTestUsers(count) {
  const users = [];
  const today = new Date();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');

  for (let i = 0; i < count; i++) {
    const id = randomString(8);
    users.push({
      firstName: `SchedulerTest${id}`,
      lastName: `User${i}`,
      email: `scheduler-test-${id}-${i}@example.com`,
      timezone: TIMEZONES[Math.floor(Math.random() * TIMEZONES.length)],
      // Half birthdays, half anniversaries, all today
      birthdayDate: i % 2 === 0 ? `199${Math.floor(Math.random() * 10)}-${month}-${day}` : null,
      anniversaryDate:
        i % 2 === 1 ? `20${String(10 + Math.floor(Math.random() * 10))}-${month}-${day}` : null,
      locationCity: `City${Math.floor(Math.random() * 100)}`,
      locationCountry: `Country${Math.floor(Math.random() * 50)}`,
    });
  }

  return users;
}

/**
 * Create users via API
 */
function createUsers(users) {
  const batch = http.batch(
    users.map((user) => [
      'POST',
      `${API_BASE_URL}/api/v1/users`,
      JSON.stringify(user),
      {
        headers: { 'Content-Type': 'application/json' },
      },
    ])
  );

  let successCount = 0;
  batch.forEach((res) => {
    if (res.status === 201) {
      successCount++;
    }
  });

  return successCount;
}

/**
 * Test daily scheduler execution
 */
export function testDailyScheduler() {
  activeSchedulers.add(1);

  // Simulate daily scheduler trigger
  const startTime = Date.now();

  const res = http.post(
    `${SCHEDULER_API_URL}/daily-birthdays`,
    JSON.stringify({
      date: new Date().toISOString().split('T')[0],
      forceRun: true,
    }),
    {
      headers: {
        'Content-Type': 'application/json',
        'X-Internal-API': 'scheduler-test',
      },
      timeout: '60s',
    }
  );

  const executionTime = Date.now() - startTime;
  schedulerExecutionTime.add(executionTime);

  const success = check(res, {
    'daily scheduler: status is 200': (r) => r.status === 200,
    'daily scheduler: execution < 30s': () => executionTime < 30000,
    'daily scheduler: has stats': (r) => {
      try {
        const body = JSON.parse(r.body);
        return (
          body.totalBirthdays !== undefined &&
          body.totalAnniversaries !== undefined &&
          body.messagesScheduled !== undefined
        );
      } catch {
        return false;
      }
    },
  });

  if (success) {
    try {
      const stats = JSON.parse(res.body);
      birthdaysProcessed.add(stats.totalBirthdays || 0);
      anniversariesProcessed.add(stats.totalAnniversaries || 0);
      messagesEnqueued.add(stats.messagesScheduled || 0);
      duplicatesSkipped.add(stats.duplicatesSkipped || 0);

      // Calculate enqueue rate
      if (executionTime > 0) {
        const rate = (stats.messagesScheduled || 0) / (executionTime / 1000);
        enqueueRate.add(rate);
      }
    } catch (e) {
      console.error('Failed to parse daily scheduler response:', e);
      schedulerErrors.add(1);
      errorRate.add(1);
    }
  } else {
    schedulerErrors.add(1);
    errorRate.add(1);
    console.error(`Daily scheduler failed: ${res.status} - ${res.body}`);
  }

  activeSchedulers.add(-1);
  sleep(60); // Wait 1 minute between runs
}

/**
 * Test minute scheduler (enqueue pending messages)
 */
export function testMinuteScheduler() {
  activeSchedulers.add(1);

  const startTime = Date.now();

  const res = http.post(
    `${SCHEDULER_API_URL}/minute-enqueue`,
    JSON.stringify({
      timestamp: new Date().toISOString(),
      forceRun: true,
    }),
    {
      headers: {
        'Content-Type': 'application/json',
        'X-Internal-API': 'scheduler-test',
      },
      timeout: '30s',
    }
  );

  const executionTime = Date.now() - startTime;

  const success = check(res, {
    'minute scheduler: status is 200': (r) => r.status === 200,
    'minute scheduler: execution < 1s': () => executionTime < 1000,
    'minute scheduler: has enqueued count': (r) => {
      try {
        const body = JSON.parse(r.body);
        return body.messagesEnqueued !== undefined;
      } catch {
        return false;
      }
    },
  });

  if (success) {
    try {
      const stats = JSON.parse(res.body);
      messagesEnqueued.add(stats.messagesEnqueued || 0);

      // Calculate enqueue rate
      if (executionTime > 0 && stats.messagesEnqueued > 0) {
        const rate = stats.messagesEnqueued / (executionTime / 1000);
        enqueueRate.add(rate);
      }
    } catch (e) {
      console.error('Failed to parse minute scheduler response:', e);
      schedulerErrors.add(1);
      errorRate.add(1);
    }
  } else {
    schedulerErrors.add(1);
    errorRate.add(1);
    console.error(`Minute scheduler failed: ${res.status} - ${res.body}`);
  }

  activeSchedulers.add(-1);
  sleep(0.5); // Small delay
}

/**
 * Test database query performance
 */
export function testDatabaseQueries() {
  const queries = [
    // Query today's birthdays
    {
      name: 'today_birthdays',
      endpoint: '/internal/query/birthdays-today',
    },
    // Query today's anniversaries
    {
      name: 'today_anniversaries',
      endpoint: '/internal/query/anniversaries-today',
    },
    // Query pending messages
    {
      name: 'pending_messages',
      endpoint: '/internal/query/pending-messages',
    },
    // Query message logs
    {
      name: 'message_logs',
      endpoint: '/internal/query/message-logs',
    },
  ];

  const query = queries[Math.floor(Math.random() * queries.length)];
  const startTime = Date.now();

  const res = http.get(`${API_BASE_URL}${query.endpoint}`, {
    timeout: '10s',
    tags: { query: query.name },
  });

  const queryTime = Date.now() - startTime;
  databaseQueryTime.add(queryTime, { query: query.name });

  check(res, {
    [`${query.name}: status is 200`]: (r) => r.status === 200,
    [`${query.name}: query < 200ms`]: () => queryTime < 200,
    [`${query.name}: has results`]: (r) => {
      try {
        const body = JSON.parse(r.body);
        return Array.isArray(body.results);
      } catch {
        return false;
      }
    },
  });

  sleep(0.1);
}

/**
 * Setup function
 */
export function setup() {
  console.log('=== Starting Scheduler Load Test ===');
  console.log(`API URL: ${API_BASE_URL}`);
  console.log('Test scenarios:');
  console.log('  1. Daily scheduler: 10,000 birthdays/day');
  console.log('  2. Minute scheduler: 500 messages/minute');
  console.log('  3. Database queries: High concurrency');

  // Health check
  const warmupRes = http.get(`${API_BASE_URL}/health`);
  if (warmupRes.status !== 200) {
    throw new Error('API health check failed - aborting test');
  }

  // Create test users for scheduler testing
  console.log('Creating test users (this may take a few minutes)...');

  const userBatches = 100; // Create 10,000 users in batches of 100
  const batchSize = 100;
  let totalCreated = 0;

  for (let i = 0; i < userBatches; i++) {
    const users = setupTestUsers(batchSize);
    const created = createUsers(users);
    totalCreated += created;

    if (i % 10 === 0) {
      console.log(`Created ${totalCreated} test users...`);
    }
  }

  console.log(`Test users created: ${totalCreated}`);

  return {
    startTime: new Date(),
    usersCreated: totalCreated,
  };
}

/**
 * Teardown function
 */
export function teardown(data) {
  const endTime = new Date();
  const duration = (endTime - data.startTime) / 1000 / 60; // minutes

  console.log('\n=== Scheduler Load Test Complete ===');
  console.log(`Duration: ${duration.toFixed(2)} minutes`);
  console.log(`Test Users Created: ${data.usersCreated}`);
  console.log(`Birthdays Processed: ${birthdaysProcessed.count}`);
  console.log(`Anniversaries Processed: ${anniversariesProcessed.count}`);
  console.log(`Messages Enqueued: ${messagesEnqueued.count}`);
  console.log(`Duplicates Skipped: ${duplicatesSkipped.count}`);
  console.log(`Scheduler Errors: ${schedulerErrors.count}`);

  if (messagesEnqueued.count > 0) {
    const avgEnqueueRate = messagesEnqueued.count / (duration * 60);
    console.log(`Average Enqueue Rate: ${avgEnqueueRate.toFixed(2)} msg/s`);
  }
}

/**
 * Handle summary
 */
export function handleSummary(data) {
  return {
    'perf-results/scheduler-load-summary.json': JSON.stringify(data, null, 2),
    stdout: textSummary(data),
  };
}

function textSummary(data) {
  let summary = '\n=== Scheduler Load Test Summary ===\n\n';

  // Scheduler execution times
  if (data.metrics.scheduler_execution_time) {
    summary += 'Daily Scheduler Execution:\n';
    const exec = data.metrics.scheduler_execution_time.values;
    summary += `  avg: ${(exec.avg / 1000).toFixed(2)}s\n`;
    summary += `  p(95): ${(exec['p(95)'] / 1000).toFixed(2)}s\n`;
    summary += `  p(99): ${(exec['p(99)'] / 1000).toFixed(2)}s\n\n`;
  }

  // Enqueue rate
  if (data.metrics.enqueue_rate) {
    summary += 'Enqueue Rate:\n';
    const rate = data.metrics.enqueue_rate.values;
    summary += `  avg: ${rate.avg?.toFixed(2)} msg/s\n`;
    summary += `  max: ${rate.max?.toFixed(2)} msg/s\n\n`;
  }

  // Database queries
  if (data.metrics.database_query_time) {
    summary += 'Database Query Performance:\n';
    const db = data.metrics.database_query_time.values;
    summary += `  p(95): ${db['p(95)']?.toFixed(2)}ms\n`;
    summary += `  p(99): ${db['p(99)']?.toFixed(2)}ms\n\n`;
  }

  return summary;
}
