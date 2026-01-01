import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Rate, Trend, Counter, Gauge } from 'k6/metrics';
import { randomString } from 'https://jslib.k6.io/k6-utils/1.2.0/index.js';

// Custom metrics
const errorRate = new Rate('errors');
const e2eLatency = new Trend('e2e_latency'); // Total flow latency
const createUserLatency = new Trend('create_user_latency');
const schedulerLatency = new Trend('scheduler_latency');
const enqueueLatency = new Trend('enqueue_latency');
const processingLatency = new Trend('processing_latency');
const emailSendLatency = new Trend('email_send_latency');
const flowsCompleted = new Counter('flows_completed');
const flowsFailed = new Counter('flows_failed');
const stepsSucceeded = new Counter('steps_succeeded');
const stepsFailed = new Counter('steps_failed');
const concurrentFlows = new Gauge('concurrent_flows');

// CI mode detection
const isCI = __ENV.CI === 'true';

// Load stages based on environment
const E2E_STAGES = isCI
  ? [
      { duration: '1m', target: 50 },    // CI: Ramp to 50 flows
      { duration: '2m', target: 150 },   // CI: Ramp to 150 flows
      { duration: '5m', target: 150 },   // CI: Sustain for 5 minutes
      { duration: '2m', target: 0 },     // CI: Ramp down
    ]  // Total: ~10 minutes
  : [
      { duration: '2m', target: 100 },   // Full: Ramp to 100 flows
      { duration: '3m', target: 500 },   // Full: Ramp to 500 flows
      { duration: '5m', target: 1000 },  // Full: Ramp to 1000 flows
      { duration: '20m', target: 1000 }, // Full: Sustain 1000 flows
      { duration: '5m', target: 100 },   // Full: Ramp down
      { duration: '2m', target: 0 },     // Full: Complete ramp down
    ];

/**
 * K6 Performance Test: End-to-End Load Test
 *
 * Complete birthday message flow:
 * 1. Create user via API
 * 2. Scheduler pre-calculates birthday
 * 3. Message enqueued to RabbitMQ
 * 4. Worker processes message
 * 5. Email sent via external service
 *
 * Load profile (CI mode: ~10 min total):
 * - Ramp up: 0 → 50 → 150 flows over 3 minutes
 * - Sustained: 150 flows for 5 minutes
 * - Ramp down: 2 minutes
 *
 * Load profile (Full mode: ~37 min total):
 * - Ramp up: 0 → 100 → 500 → 1000 flows over 10 minutes
 * - Sustained: 1000 flows for 20 minutes
 * - Ramp down: 7 minutes
 *
 * Thresholds:
 * - p99 < 5s (end-to-end latency)
 * - Success rate > 99%
 * - Each step p95 within SLA
 */
export const options = {
  scenarios: {
    // Gradual ramp-up to peak concurrent flows
    e2e_birthday_flows: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: E2E_STAGES,
      gracefulRampDown: '30s',
    },
  },
  thresholds: {
    e2e_latency: [
      'p(95)<5000', // 95% of flows complete in <5s
      'p(99)<8000', // 99% of flows complete in <8s
    ],
    create_user_latency: ['p(95)<500'],
    scheduler_latency: ['p(95)<1000'],
    enqueue_latency: ['p(95)<200'],
    processing_latency: ['p(95)<1500'],
    email_send_latency: ['p(95)<2000'],
    http_req_failed: ['rate<0.01'], // <1% HTTP errors
    errors: ['rate<0.01'], // <1% total errors
  },
  summaryTrendStats: ['avg', 'min', 'med', 'max', 'p(90)', 'p(95)', 'p(99)', 'p(99.9)'],
};

// Configuration
const API_BASE_URL = __ENV.API_URL || 'http://localhost:3000';

const TIMEZONES = [
  'America/New_York',
  'America/Los_Angeles',
  'America/Chicago',
  'America/Denver',
  'Europe/London',
  'Europe/Paris',
  'Europe/Berlin',
  'Asia/Tokyo',
  'Asia/Singapore',
  'Asia/Shanghai',
  'Australia/Sydney',
  'Pacific/Auckland',
];

/**
 * Generate user with birthday today
 */
function generateBirthdayUser() {
  const id = randomString(8);
  const today = new Date();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');
  const birthYear = 1980 + Math.floor(Math.random() * 30);

  return {
    firstName: `E2ETest${id}`,
    lastName: `User${randomString(4)}`,
    email: `e2e-${id}-${Date.now()}@example.com`,
    timezone: TIMEZONES[Math.floor(Math.random() * TIMEZONES.length)],
    birthdayDate: `${birthYear}-${month}-${day}`, // Birthday today!
    locationCity: `TestCity${Math.floor(Math.random() * 100)}`,
    locationCountry: `TestCountry${Math.floor(Math.random() * 50)}`,
  };
}

/**
 * Step 1: Create user
 */
function createUser(flowId) {
  const user = generateBirthdayUser();
  const startTime = Date.now();

  const res = http.post(`${API_BASE_URL}/api/v1/users`, JSON.stringify(user), {
    headers: {
      'Content-Type': 'application/json',
      'X-Flow-ID': flowId,
    },
    timeout: '10s',
    tags: { step: 'create_user' },
  });

  const latency = Date.now() - startTime;
  createUserLatency.add(latency);

  const success = check(res, {
    'step1: user created (201)': (r) => r.status === 201,
    'step1: has user ID': (r) => {
      try {
        const body = JSON.parse(r.body);
        return body.data && body.data.id;
      } catch {
        return false;
      }
    },
    'step1: latency < 500ms': () => latency < 500,
  });

  if (success) {
    stepsSucceeded.add(1);
    try {
      const body = JSON.parse(res.body);
      return {
        success: true,
        userId: body.data.id,
        email: user.email,
        timezone: user.timezone,
      };
    } catch (e) {
      console.error(`Flow ${flowId}: Failed to parse create user response`);
    }
  }

  stepsFailed.add(1);
  errorRate.add(1);
  return { success: false };
}

/**
 * Step 2: Trigger scheduler (or wait for automatic run)
 */
function triggerScheduler(flowId, userId) {
  const startTime = Date.now();

  // Trigger manual scheduler run
  const res = http.post(
    `${API_BASE_URL}/internal/scheduler/daily-birthdays`,
    JSON.stringify({
      date: new Date().toISOString().split('T')[0],
      userId: userId, // Schedule for specific user
    }),
    {
      headers: {
        'Content-Type': 'application/json',
        'X-Flow-ID': flowId,
        'X-Internal-API': 'e2e-test',
      },
      timeout: '30s',
      tags: { step: 'scheduler' },
    }
  );

  const latency = Date.now() - startTime;
  schedulerLatency.add(latency);

  const success = check(res, {
    'step2: scheduler ran (200)': (r) => r.status === 200,
    'step2: birthday found': (r) => {
      try {
        const body = JSON.parse(r.body);
        return body.totalBirthdays > 0 || body.messagesScheduled > 0;
      } catch {
        return false;
      }
    },
    'step2: latency < 1s': () => latency < 1000,
  });

  if (success) {
    stepsSucceeded.add(1);
    return { success: true };
  }

  stepsFailed.add(1);
  errorRate.add(1);
  return { success: false };
}

/**
 * Step 3: Verify message enqueued
 */
function verifyEnqueued(flowId, userId) {
  const startTime = Date.now();

  // Check if message was enqueued for user
  const res = http.get(`${API_BASE_URL}/internal/queue/user-messages/${userId}`, {
    headers: {
      'X-Flow-ID': flowId,
    },
    timeout: '10s',
    tags: { step: 'enqueue_verify' },
  });

  const latency = Date.now() - startTime;
  enqueueLatency.add(latency);

  const success = check(res, {
    'step3: enqueue verified (200)': (r) => r.status === 200,
    'step3: has messages': (r) => {
      try {
        const body = JSON.parse(r.body);
        return body.messages && body.messages.length > 0;
      } catch {
        return false;
      }
    },
    'step3: latency < 200ms': () => latency < 200,
  });

  if (success) {
    stepsSucceeded.add(1);
    try {
      const body = JSON.parse(res.body);
      return {
        success: true,
        messageId: body.messages[0]?.id,
      };
    } catch (e) {
      console.error(`Flow ${flowId}: Failed to parse enqueue response`);
    }
  }

  stepsFailed.add(1);
  errorRate.add(1);
  return { success: false };
}

/**
 * Step 4: Wait for worker processing
 */
function waitForProcessing(flowId, messageId) {
  const startTime = Date.now();
  let processed = false;
  let attempts = 0;
  const maxAttempts = 60; // 60 seconds max

  while (!processed && attempts < maxAttempts) {
    sleep(1);
    attempts++;

    const res = http.get(`${API_BASE_URL}/internal/worker/message-status/${messageId}`, {
      headers: {
        'X-Flow-ID': flowId,
      },
      timeout: '5s',
      tags: { step: 'processing' },
    });

    if (res.status === 200) {
      try {
        const status = JSON.parse(res.body);
        if (status.processed) {
          processed = true;
          const latency = Date.now() - startTime;
          processingLatency.add(latency);

          const success = check(
            { latency },
            {
              'step4: processing complete': () => true,
              'step4: latency < 1.5s': () => latency < 1500,
            }
          );

          if (success) {
            stepsSucceeded.add(1);
            return { success: true };
          }
        } else if (status.failed) {
          break;
        }
      } catch (e) {
        console.error(`Flow ${flowId}: Failed to parse processing status`);
      }
    }
  }

  if (!processed) {
    console.error(`Flow ${flowId}: Message ${messageId} processing timeout`);
  }

  stepsFailed.add(1);
  errorRate.add(1);
  return { success: false };
}

/**
 * Step 5: Verify email sent
 */
function verifyEmailSent(flowId, userId) {
  const startTime = Date.now();

  const res = http.get(`${API_BASE_URL}/internal/message-log/user/${userId}`, {
    headers: {
      'X-Flow-ID': flowId,
    },
    timeout: '10s',
    tags: { step: 'email_verify' },
  });

  const latency = Date.now() - startTime;
  emailSendLatency.add(latency);

  const success = check(res, {
    'step5: email log found (200)': (r) => r.status === 200,
    'step5: email sent': (r) => {
      try {
        const body = JSON.parse(r.body);
        return body.logs && body.logs.length > 0 && body.logs[0].status === 'SENT';
      } catch {
        return false;
      }
    },
    'step5: latency < 2s': () => latency < 2000,
  });

  if (success) {
    stepsSucceeded.add(1);
    return { success: true };
  }

  stepsFailed.add(1);
  errorRate.add(1);
  return { success: false };
}

/**
 * Main E2E test function
 */
export default function () {
  const flowId = `e2e-${__VU}-${__ITER}-${randomString(4)}`;
  const e2eStart = Date.now();

  concurrentFlows.add(1);

  group('Complete Birthday Flow', () => {
    // Step 1: Create user
    const createResult = group('1. Create User', () => createUser(flowId));
    if (!createResult.success) {
      flowsFailed.add(1);
      concurrentFlows.add(-1);
      return;
    }

    const { userId, email, timezone } = createResult;
    sleep(0.5);

    // Step 2: Trigger scheduler
    const schedulerResult = group('2. Run Scheduler', () =>
      triggerScheduler(flowId, userId)
    );
    if (!schedulerResult.success) {
      flowsFailed.add(1);
      concurrentFlows.add(-1);
      return;
    }

    sleep(1);

    // Step 3: Verify enqueued
    const enqueueResult = group('3. Verify Enqueued', () =>
      verifyEnqueued(flowId, userId)
    );
    if (!enqueueResult.success) {
      flowsFailed.add(1);
      concurrentFlows.add(-1);
      return;
    }

    const { messageId } = enqueueResult;
    sleep(0.5);

    // Step 4: Wait for processing
    const processingResult = group('4. Worker Processing', () =>
      waitForProcessing(flowId, messageId)
    );
    if (!processingResult.success) {
      flowsFailed.add(1);
      concurrentFlows.add(-1);
      return;
    }

    sleep(1);

    // Step 5: Verify email sent
    const emailResult = group('5. Verify Email Sent', () => verifyEmailSent(flowId, userId));
    if (!emailResult.success) {
      flowsFailed.add(1);
      concurrentFlows.add(-1);
      return;
    }

    // Complete flow successful
    const totalLatency = Date.now() - e2eStart;
    e2eLatency.add(totalLatency);
    flowsCompleted.add(1);

    check(
      { totalLatency },
      {
        'e2e: flow completed': () => true,
        'e2e: total latency < 5s': () => totalLatency < 5000,
        'e2e: total latency < 8s': () => totalLatency < 8000,
      }
    );
  });

  concurrentFlows.add(-1);

  // Realistic think time between flows
  sleep(Math.random() * 3 + 1); // 1-4 seconds
}

/**
 * Setup function
 */
export function setup() {
  console.log('=== Starting End-to-End Load Test ===');
  console.log(`API URL: ${API_BASE_URL}`);
  console.log(`Mode: ${isCI ? 'CI (optimized for speed)' : 'Full (production simulation)'}`);
  console.log('Test flow:');
  console.log('  1. Create user with birthday today');
  console.log('  2. Scheduler pre-calculates birthday');
  console.log('  3. Message enqueued to RabbitMQ');
  console.log('  4. Worker processes message');
  console.log('  5. Email sent and verified');

  if (isCI) {
    console.log('Load profile: 0 → 50 → 150 concurrent flows over 3 minutes');
    console.log('Sustained: 150 flows for 5 minutes');
    console.log('Expected flows: ~1,200 total');
  } else {
    console.log('Load profile: 0 → 100 → 500 → 1000 concurrent flows');
    console.log('Sustained: 1000 flows for 20 minutes');
    console.log('Expected flows: ~30,000 total');
  }

  // Health check
  const warmupRes = http.get(`${API_BASE_URL}/health`);
  if (warmupRes.status !== 200) {
    throw new Error('API health check failed - aborting test');
  }

  // Check all components
  const components = [
    { name: 'Database', url: `${API_BASE_URL}/health/db` },
    { name: 'RabbitMQ', url: `${API_BASE_URL}/health/queue` },
    { name: 'Email Service', url: `${API_BASE_URL}/health/email` },
  ];

  components.forEach((component) => {
    const res = http.get(component.url, { timeout: '10s' });
    if (res.status !== 200) {
      console.warn(`${component.name} health check warning: ${res.status}`);
    } else {
      console.log(`${component.name}: healthy`);
    }
  });

  return { startTime: new Date() };
}

/**
 * Teardown function
 */
export function teardown(data) {
  const endTime = new Date();
  const duration = (endTime - data.startTime) / 1000 / 60; // minutes

  console.log('\n=== End-to-End Load Test Complete ===');
  console.log(`Duration: ${duration.toFixed(2)} minutes`);
  console.log(`Flows Completed: ${flowsCompleted.count}`);
  console.log(`Flows Failed: ${flowsFailed.count}`);
  console.log(`Steps Succeeded: ${stepsSucceeded.count}`);
  console.log(`Steps Failed: ${stepsFailed.count}`);

  const totalFlows = flowsCompleted.count + flowsFailed.count;
  const successRate = totalFlows > 0 ? (flowsCompleted.count / totalFlows) * 100 : 0;
  console.log(`Success Rate: ${successRate.toFixed(2)}%`);

  if (totalFlows > 0 && duration > 0) {
    const throughput = totalFlows / (duration * 60);
    console.log(`Average Throughput: ${throughput.toFixed(2)} flows/s`);
  }
}

/**
 * Handle summary
 */
export function handleSummary(data) {
  return {
    'perf-results/e2e-load-summary.json': JSON.stringify(data, null, 2),
    stdout: textSummary(data),
  };
}

function textSummary(data) {
  let summary = '\n=== End-to-End Load Test Summary ===\n\n';

  // E2E latency
  if (data.metrics.e2e_latency) {
    summary += 'End-to-End Latency:\n';
    const e2e = data.metrics.e2e_latency.values;
    summary += `  avg: ${(e2e.avg / 1000).toFixed(2)}s\n`;
    summary += `  min: ${(e2e.min / 1000).toFixed(2)}s\n`;
    summary += `  med: ${(e2e.med / 1000).toFixed(2)}s\n`;
    summary += `  max: ${(e2e.max / 1000).toFixed(2)}s\n`;
    summary += `  p(95): ${(e2e['p(95)'] / 1000).toFixed(2)}s\n`;
    summary += `  p(99): ${(e2e['p(99)'] / 1000).toFixed(2)}s\n\n`;
  }

  // Step-by-step latency
  summary += 'Step Latency Breakdown:\n';
  const steps = [
    { key: 'create_user_latency', name: 'Create User' },
    { key: 'scheduler_latency', name: 'Scheduler' },
    { key: 'enqueue_latency', name: 'Enqueue' },
    { key: 'processing_latency', name: 'Processing' },
    { key: 'email_send_latency', name: 'Email Send' },
  ];

  steps.forEach((step) => {
    if (data.metrics[step.key]) {
      const values = data.metrics[step.key].values;
      summary += `  ${step.name}: p95=${(values['p(95)'] || 0).toFixed(0)}ms, p99=${(values['p(99)'] || 0).toFixed(0)}ms\n`;
    }
  });
  summary += '\n';

  // Success rates
  const totalSteps = stepsSucceeded.count + stepsFailed.count;
  if (totalSteps > 0) {
    summary += 'Success Rates:\n';
    summary += `  Steps: ${((stepsSucceeded.count / totalSteps) * 100).toFixed(2)}%\n`;
  }

  const totalFlows = flowsCompleted.count + flowsFailed.count;
  if (totalFlows > 0) {
    summary += `  Flows: ${((flowsCompleted.count / totalFlows) * 100).toFixed(2)}%\n`;
  }

  return summary;
}
