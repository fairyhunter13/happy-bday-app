# Metrics Implementation Plan - 100+ Metrics Achievement

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Implementation Strategy](#implementation-strategy)
3. [Metric Naming Conventions](#metric-naming-conventions)
4. [Integration Points Summary](#integration-points-summary)
5. [Implementation Priorities](#implementation-priorities)
6. [Testing Strategy](#testing-strategy)
7. [Monitoring & Validation](#monitoring-validation)
8. [Documentation Updates](#documentation-updates)
9. [Metrics Catalog](#metrics-catalog)
10. [Sample Code Snippets](#sample-code-snippets)
11. [Rollout Plan](#rollout-plan)
12. [Success Criteria](#success-criteria)
13. [Risk Mitigation](#risk-mitigation)
14. [Appendix: Complete Metrics List](#appendix-complete-metrics-list)
15. [Conclusion](#conclusion)

---

**Status**: Implementation Design
**Current Metrics**: ~100 metrics declared (analyzed from metrics.service.ts)
**Target**: 100+ metrics actively collecting data
**Gap**: Need instrumentation/integration in codebase
**Priority**: Critical for Phase 9 completion

---

## Executive Summary

The `MetricsService` class already declares **100+ custom metrics** across 7 categories. However, most metrics are **not actively being collected** in the codebase. This plan provides a comprehensive implementation strategy to instrument the entire application and achieve the 100+ actively reporting metrics target.

### Current State Analysis

**Existing Metrics Declared** (from metrics.service.ts):
- **Counters**: 50 metrics (original 10 + business 15 + queue 10 + performance 5 + database 5 + HTTP client 5)
- **Gauges**: 67 metrics (original 7 + business 10 + performance 10 + queue 10 + database 10 + system 10)
- **Histograms**: 26 metrics (original 6 + performance 5 + queue 5 + database 5 + HTTP client 5)
- **Summaries**: 5 metrics (original 1 + 4 new)

**Total Declared**: 148 custom metrics + default Node.js metrics from prom-client

**Actually Instrumented** (from codebase analysis):
- ✅ HTTP request metrics (middleware)
- ❌ Most business metrics
- ❌ Most queue metrics
- ❌ Most database metrics
- ❌ Performance metrics
- ❌ System metrics

---

## Implementation Strategy

### Phase 1: Core Infrastructure Metrics (P0 - Immediate)

#### 1.1 HTTP/API Metrics Enhancement
**Location**: `src/middleware/metrics.middleware.ts`

**Current Implementation**:
```typescript
// Already implemented:
- recordApiRequest(method, path, status)
- recordApiResponseTime(method, path, status, duration)
```

**Add**:
```typescript
// Response size tracking
const responseSize = JSON.stringify(payload).length;
metricsService.httpResponseSize.observe(
  { host: request.hostname, method, status_code: status.toString() },
  responseSize
);

// Request size tracking
if (request.body) {
  const requestSize = JSON.stringify(request.body).length;
  metricsService.httpRequestSize.observe(
    { host: request.hostname, method },
    requestSize
  );
}

// API response quantiles
metricsService.recordApiResponseQuantiles(method, path, duration);
```

**Integration Point**: Modify `onSend` hook in metrics.middleware.ts (line 57)

---

#### 1.2 Database Metrics Integration
**Location**: `src/db/connection.ts`

**Implementation Strategy**: Create database interceptor/observer

**New File**: `src/db/metrics-interceptor.ts`
```typescript
/**
 * Database Metrics Interceptor
 * Wraps postgres client to track all database operations
 */

import type { Sql } from 'postgres';
import { metricsService } from '../services/metrics.service.js';
import { logger } from '../config/logger.js';

export function createDatabaseMetricsInterceptor(client: Sql) {
  // Wrap query execution
  const originalQuery = client.unsafe.bind(client);

  client.unsafe = async function(query: string, values?: any[]) {
    const startTime = Date.now();
    const queryType = detectQueryType(query);
    const table = extractTableName(query);

    try {
      const result = await originalQuery(query, values);

      // Record successful query
      const duration = (Date.now() - startTime) / 1000;
      metricsService.recordDatabaseQuery(queryType, table, duration);
      metricsService.recordDatabaseQueryQuantiles(queryType, table, duration);

      // Record commit
      if (queryType === 'COMMIT') {
        metricsService.recordDatabaseCommit('manual');
      }

      return result;
    } catch (error) {
      // Record rollback
      if (queryType === 'ROLLBACK') {
        metricsService.recordDatabaseRollback('error');
      }
      throw error;
    }
  };

  // Monitor connection pool
  setInterval(() => {
    const poolStats = getPoolStats(client);
    metricsService.setDatabaseConnections('default', 'active', poolStats.active);
    metricsService.setDatabaseConnections('default', 'idle', poolStats.idle);
  }, 5000);

  return client;
}

function detectQueryType(query: string): string {
  const normalized = query.trim().toUpperCase();
  if (normalized.startsWith('SELECT')) return 'SELECT';
  if (normalized.startsWith('INSERT')) return 'INSERT';
  if (normalized.startsWith('UPDATE')) return 'UPDATE';
  if (normalized.startsWith('DELETE')) return 'DELETE';
  if (normalized.startsWith('BEGIN')) return 'BEGIN';
  if (normalized.startsWith('COMMIT')) return 'COMMIT';
  if (normalized.startsWith('ROLLBACK')) return 'ROLLBACK';
  return 'OTHER';
}

function extractTableName(query: string): string {
  // Extract table name from query
  const match = query.match(/(?:FROM|INTO|UPDATE)\s+([a-zA-Z_][a-zA-Z0-9_]*)/i);
  return match ? match[1] : 'unknown';
}
```

**Integration**: Modify `src/db/connection.ts`:
```typescript
import { createDatabaseMetricsInterceptor } from './metrics-interceptor.js';

export const queryClient = createDatabaseMetricsInterceptor(
  postgres(DATABASE_URL, { ...poolConfig })
);
```

**Priority**: P0
**Estimated Lines**: 150 lines
**Impact**: +15 metrics actively collecting

---

#### 1.3 RabbitMQ Queue Metrics
**Location**: `src/queue/consumer.ts`, `src/queue/publisher.ts`

**Consumer Metrics** (src/queue/consumer.ts):

Add to `handleMessage` method (around line 84):
```typescript
private async handleMessage(msg: ConsumeMessage | null, channel: Channel): Promise<void> {
  if (!msg) {
    logger.warn('Consumer cancelled by server');
    this.isConsuming = false;
    return;
  }

  // Track message age
  const messageTimestamp = msg.properties.timestamp || Date.now();
  const messageAge = (Date.now() - messageTimestamp) / 1000;
  metricsService.setMessageAge(QUEUES.BIRTHDAY_MESSAGES, messageAge);

  // Track unacked messages
  const unackedCount = await this.getUnackedCount(channel);
  metricsService.setUnackedMessagesCount(QUEUES.BIRTHDAY_MESSAGES, unackedCount);

  let job: MessageJob | undefined;

  try {
    // Existing parsing code...

    // Track message consumption start
    const consumeStart = Date.now();

    await this.onMessage(job);

    // Record successful consumption
    const consumeDuration = (Date.now() - consumeStart) / 1000;
    metricsService.recordMessageConsumeDuration(
      QUEUES.BIRTHDAY_MESSAGES,
      'success',
      consumeDuration
    );

    // ACK message
    channel.ack(msg);
    metricsService.recordMessageAck(QUEUES.BIRTHDAY_MESSAGES, this.consumerTag || 'default');

  } catch (error) {
    // Handle error...

    // Record NACK
    metricsService.recordMessageNack(QUEUES.BIRTHDAY_MESSAGES, error.message);

    if (shouldRetry) {
      // Record redelivery
      metricsService.recordMessageRedelivery(QUEUES.BIRTHDAY_MESSAGES, 'retry');
      channel.nack(msg, false, true);
    } else {
      channel.nack(msg, false, false);
    }
  }
}

// Add periodic queue stats collection
private startQueueMonitoring(): void {
  setInterval(async () => {
    const channel = getRabbitMQ().getConsumerChannel();

    // Get queue stats
    const queueInfo = await channel.checkQueue(QUEUES.BIRTHDAY_MESSAGES);
    metricsService.setQueueDepth(QUEUES.BIRTHDAY_MESSAGES, queueInfo.messageCount);
    metricsService.setConsumerCount(QUEUES.BIRTHDAY_MESSAGES, queueInfo.consumerCount);
    metricsService.setQueueMemoryUsage(QUEUES.BIRTHDAY_MESSAGES, queueInfo.messageBytes || 0);

  }, 10000); // Every 10 seconds
}
```

**Publisher Metrics** (src/queue/publisher.ts):

Add to publish method:
```typescript
public async publishMessage(job: MessageJob): Promise<void> {
  const publishStart = Date.now();

  try {
    const channel = this.rabbitMQ.getPublisherChannel();

    await channel.publish(
      EXCHANGES.BIRTHDAY_SCHEDULER,
      job.routingKey || '',
      Buffer.from(JSON.stringify(job)),
      {
        persistent: true,
        timestamp: Date.now(),
        messageId: generateMessageId(),
      }
    );

    // Record successful publish
    const publishDuration = (Date.now() - publishStart) / 1000;
    metricsService.recordMessagePublishDuration(
      EXCHANGES.BIRTHDAY_SCHEDULER,
      job.routingKey || '',
      publishDuration
    );

    metricsService.recordPublisherConfirm(EXCHANGES.BIRTHDAY_SCHEDULER, 'success');

  } catch (error) {
    metricsService.recordPublisherConfirm(EXCHANGES.BIRTHDAY_SCHEDULER, 'failure');
    throw error;
  }
}
```

**Priority**: P0
**Estimated Lines**: 100 lines
**Impact**: +20 metrics actively collecting

---

### Phase 2: Business Metrics (P1 - High Priority)

#### 2.1 User Lifecycle Metrics
**Location**: `src/controllers/user.controller.ts`, `src/repositories/user.repository.ts`

**User Creation** (in createUser handler):
```typescript
// After user creation
metricsService.recordUserCreation('api', 'free'); // or tier from user data
metricsService.recordUserActivity('created', 'api');
```

**User Deletion** (in deleteUser handler):
```typescript
// Before user deletion
metricsService.recordUserDeletion('user_request', user.tier || 'free');
metricsService.recordUserActivity('deleted', 'api');
```

**User Updates**:
```typescript
// In updateUser handler
metricsService.recordUserActivity('updated', 'api');

// If notification preferences changed
if (hasNotificationPreferenceChanged(oldUser, updatedUser)) {
  metricsService.recordNotificationPreferenceChange('email', 'enabled');
}
```

**Periodic User Statistics** (new background task):

**New File**: `src/schedulers/user-metrics.scheduler.ts`
```typescript
/**
 * User Metrics Collection Scheduler
 * Collects aggregate user statistics every 5 minutes
 */

import cron from 'node-cron';
import { userRepository } from '../repositories/user.repository.js';
import { metricsService } from '../services/metrics.service.js';
import { logger } from '../config/logger.js';

export function startUserMetricsScheduler(): void {
  // Run every 5 minutes
  cron.schedule('*/5 * * * *', async () => {
    try {
      // Count users by tier
      const usersByTier = await userRepository.countUsersByTier();
      for (const [tier, count] of Object.entries(usersByTier)) {
        metricsService.setUsersByTier(tier, count);
      }

      // Count users by timezone
      const usersByTimezone = await userRepository.countUsersByTimezone();
      for (const [timezone, count] of Object.entries(usersByTimezone)) {
        metricsService.setUserTimezoneDistribution(timezone, count);
      }

      // Count active users (last 24h, 7d, 30d)
      const activeUsers24h = await userRepository.countActiveUsers(24);
      metricsService.setActiveUsers('24h', activeUsers24h);

      const activeUsers7d = await userRepository.countActiveUsers(168);
      metricsService.setActiveUsers('7d', activeUsers7d);

      const activeUsers30d = await userRepository.countActiveUsers(720);
      metricsService.setActiveUsers('30d', activeUsers30d);

      logger.info('User metrics collected successfully');
    } catch (error) {
      logger.error({ error }, 'Failed to collect user metrics');
    }
  });

  logger.info('User metrics scheduler started');
}
```

Add to `src/repositories/user.repository.ts`:
```typescript
export class UserRepository {
  // Existing methods...

  async countUsersByTier(): Promise<Record<string, number>> {
    const result = await this.db
      .select({
        tier: users.tier,
        count: sql<number>`count(*)::int`
      })
      .from(users)
      .where(eq(users.deletedAt, null))
      .groupBy(users.tier);

    return Object.fromEntries(result.map(r => [r.tier || 'free', r.count]));
  }

  async countUsersByTimezone(): Promise<Record<string, number>> {
    const result = await this.db
      .select({
        timezone: users.timezone,
        count: sql<number>`count(*)::int`
      })
      .from(users)
      .where(eq(users.deletedAt, null))
      .groupBy(users.timezone);

    return Object.fromEntries(result.map(r => [r.timezone, r.count]));
  }

  async countActiveUsers(hours: number): Promise<number> {
    const since = new Date(Date.now() - hours * 60 * 60 * 1000);
    const result = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(users)
      .where(
        and(
          eq(users.deletedAt, null),
          gte(users.updatedAt, since)
        )
      );

    return result[0]?.count || 0;
  }
}
```

**Priority**: P1
**Estimated Lines**: 200 lines
**Impact**: +10 metrics actively collecting

---

#### 2.2 Birthday Processing Metrics
**Location**: `src/schedulers/daily-birthday.scheduler.ts`

**Implementation**:
```typescript
export async function processBirthdaysForTimezone(timezone: string): Promise<void> {
  const startTime = Date.now();

  try {
    // Count birthdays for today in timezone
    const birthdaysToday = await getBirthdaysForTimezone(timezone);
    metricsService.setBirthdaysToday(timezone, birthdaysToday.length);

    // Track pending birthdays
    const pendingCount = birthdaysToday.filter(b => !b.processed).length;
    metricsService.setBirthdaysPending('normal', pendingCount);

    // Process each birthday
    for (const birthday of birthdaysToday) {
      try {
        await processSingleBirthday(birthday);

        // Record successful processing
        metricsService.recordBirthdayProcessed('success', timezone);

        // Record greeting type
        metricsService.recordBirthdayGreetingType('birthday', 'email');

        // Track message by hour
        const hour = new Date().getHours();
        metricsService.recordMessageDeliveryByHour(hour, 'birthday');

      } catch (error) {
        metricsService.recordBirthdayProcessed('failed', timezone);
        logger.error({ error, birthday }, 'Failed to process birthday');
      }
    }

    // Record execution duration
    const duration = (Date.now() - startTime) / 1000;
    metricsService.recordSchedulerExecution('birthday_processing', 'success', duration);

  } catch (error) {
    const duration = (Date.now() - startTime) / 1000;
    metricsService.recordSchedulerExecution('birthday_processing', 'failed', duration);
    throw error;
  }
}
```

**Priority**: P1
**Estimated Lines**: 50 lines
**Impact**: +8 metrics actively collecting

---

#### 2.3 Message Template Metrics
**Location**: `src/strategies/birthday-message.strategy.ts`, `src/strategies/anniversary-message.strategy.ts`

**Implementation**:
```typescript
export class BirthdayMessageStrategy implements IMessageStrategy {
  async generateMessage(user: User): Promise<string> {
    const templateName = this.selectTemplate(user);
    const templateVersion = '1.0'; // or get from config

    // Track template usage
    metricsService.recordMessageTemplateUsage(templateName, templateVersion);

    return this.renderTemplate(templateName, user);
  }
}
```

**Priority**: P1
**Estimated Lines**: 20 lines
**Impact**: +2 metrics actively collecting

---

### Phase 3: Performance & System Metrics (P1)

#### 3.1 Cache Metrics
**Location**: Create new `src/services/cache.service.ts`

**Implementation**:
```typescript
/**
 * Cache Service with Metrics
 * In-memory LRU cache with Prometheus metrics
 */

export class CacheService {
  private cache = new Map<string, CacheEntry>();
  private maxSize: number;

  constructor(maxSize = 1000) {
    this.maxSize = maxSize;
  }

  async get(key: string): Promise<any | null> {
    const entry = this.cache.get(key);

    if (!entry) {
      metricsService.recordCacheMiss('default', this.getKeyPattern(key));
      return null;
    }

    if (this.isExpired(entry)) {
      this.cache.delete(key);
      metricsService.recordCacheMiss('default', this.getKeyPattern(key));
      metricsService.recordCacheEviction('default', 'expired');
      return null;
    }

    metricsService.recordCacheHit('default', this.getKeyPattern(key));
    return entry.value;
  }

  async set(key: string, value: any, ttl = 3600): Promise<void> {
    // Check if eviction needed
    if (this.cache.size >= this.maxSize) {
      const oldestKey = this.cache.keys().next().value;
      this.cache.delete(oldestKey);
      metricsService.recordCacheEviction('default', 'size_limit');
    }

    this.cache.set(key, {
      value,
      expiresAt: Date.now() + ttl * 1000
    });
  }

  // Update cache hit rate every minute
  startMetricsCollection(): void {
    setInterval(() => {
      const hitRate = this.calculateHitRate();
      metricsService.setCacheHitRate('default', hitRate);
    }, 60000);
  }

  private getKeyPattern(key: string): string {
    // Extract pattern (e.g., "user:123" -> "user:*")
    return key.split(':')[0] + ':*';
  }
}

export const cacheService = new CacheService();
```

**Priority**: P1
**Estimated Lines**: 150 lines
**Impact**: +5 metrics actively collecting

---

#### 3.2 Node.js Runtime Metrics
**Location**: `src/services/system-metrics.service.ts` (new file)

**Implementation**:
```typescript
/**
 * System Metrics Collection Service
 * Collects Node.js runtime and system metrics
 */

import { performance } from 'perf_hooks';
import v8 from 'v8';
import os from 'os';
import process from 'process';
import { metricsService } from './metrics.service.js';
import { logger } from '../config/logger.js';

export class SystemMetricsService {
  private startTime: number;
  private eventLoopMonitor: any;

  constructor() {
    this.startTime = Date.now();
    this.setupGcMonitoring();
    this.setupEventLoopMonitoring();
    this.startPeriodicCollection();
  }

  private setupGcMonitoring(): void {
    // Monitor GC events
    const obs = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        const gcType = entry.detail?.kind || 'unknown';
        const duration = entry.duration / 1000; // Convert to seconds

        metricsService.recordGcEvent(gcType);
        metricsService.recordGcPauseTime(gcType, duration);
      }
    });

    obs.observe({ entryTypes: ['gc'] });
  }

  private setupEventLoopMonitoring(): void {
    // Track event loop lag
    let lastCheck = Date.now();

    this.eventLoopMonitor = setInterval(() => {
      const now = Date.now();
      const lag = now - lastCheck - 100; // Expected 100ms interval

      metricsService.setNodeEventLoopLag(lag);

      // Event loop utilization
      const elu = performance.eventLoopUtilization();
      metricsService.setEventLoopUtilization(elu.utilization);

      lastCheck = now;
    }, 100);
  }

  private startPeriodicCollection(): void {
    // Collect system metrics every 15 seconds
    setInterval(() => {
      this.collectSystemMetrics();
      this.collectV8Metrics();
      this.collectProcessMetrics();
    }, 15000);
  }

  private collectSystemMetrics(): void {
    // System memory
    const freeMem = os.freemem();
    const totalMem = os.totalmem();

    metricsService.setSystemFreeMemory(freeMem);
    metricsService.setSystemTotalMemory(totalMem);

    // Load averages
    const loadAvg = os.loadavg();
    metricsService.setSystemLoadAverage('1m', loadAvg[0]);
    metricsService.setSystemLoadAverage('5m', loadAvg[1]);
    metricsService.setSystemLoadAverage('15m', loadAvg[2]);
  }

  private collectV8Metrics(): void {
    // V8 heap statistics
    const heapStats = v8.getHeapStatistics();

    metricsService.setV8HeapStatistics('total_heap_size', heapStats.total_heap_size);
    metricsService.setV8HeapStatistics('used_heap_size', heapStats.used_heap_size);
    metricsService.setV8HeapStatistics('heap_size_limit', heapStats.heap_size_limit);

    // V8 heap spaces
    const heapSpaces = v8.getHeapSpaceStatistics();
    for (const space of heapSpaces) {
      metricsService.setV8HeapSpaceSize(space.space_name, space.space_size);
    }

    // External memory
    metricsService.setV8ExternalMemory(heapStats.external_memory);
  }

  private collectProcessMetrics(): void {
    // Process uptime
    const uptime = process.uptime();
    metricsService.setProcessUptimeSeconds(uptime);

    // Process start time
    metricsService.setProcessStartTime(this.startTime);

    // Active handles and requests
    const handles = (process as any)._getActiveHandles?.()?.length || 0;
    const requests = (process as any)._getActiveRequests?.()?.length || 0;

    metricsService.setNodeActiveHandles(handles);
    metricsService.setNodeActiveRequests(requests);
  }

  stop(): void {
    if (this.eventLoopMonitor) {
      clearInterval(this.eventLoopMonitor);
    }
  }
}

export const systemMetricsService = new SystemMetricsService();
```

**Priority**: P1
**Estimated Lines**: 180 lines
**Impact**: +15 metrics actively collecting

---

#### 3.3 HTTP Client Metrics
**Location**: `src/clients/email-service.client.ts`

**Implementation**:
```typescript
export class EmailServiceClient {
  async sendEmail(email: string, message: string): Promise<void> {
    const startTime = Date.now();
    const host = new URL(this.baseUrl).hostname;

    try {
      // DNS lookup tracking
      const dnsStart = Date.now();
      // Perform DNS lookup
      const dnsDuration = (Date.now() - dnsStart) / 1000;
      metricsService.recordDnsLookupDuration(host, dnsDuration);
      metricsService.recordHttpDnsLookup(host, 'success');

      // Request tracking
      const requestSize = JSON.stringify({ email, message }).length;
      metricsService.recordHttpRequestSize(host, 'POST', requestSize);

      const response = await fetch(this.baseUrl, {
        method: 'POST',
        body: JSON.stringify({ email, message }),
        headers: { 'Content-Type': 'application/json' }
      });

      // Response tracking
      const responseSize = (await response.text()).length;
      const duration = (Date.now() - startTime) / 1000;

      metricsService.recordHttpRequestDuration(host, 'POST', response.status, duration);
      metricsService.recordHttpResponseSize(host, 'POST', response.status, responseSize);
      metricsService.recordHttpClientLatencyQuantiles(host, 'POST', duration);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

    } catch (error) {
      // Track retries and timeouts
      if (error.name === 'TimeoutError') {
        metricsService.recordHttpClientTimeout(host, 'POST', 'request');
      }

      throw error;
    }
  }
}
```

**Priority**: P1
**Estimated Lines**: 60 lines
**Impact**: +8 metrics actively collecting

---

### Phase 4: Security & Operational Metrics (P2)

#### 4.1 Security Metrics
**Location**: `src/middleware/security.middleware.ts` (new file)

**Implementation**:
```typescript
/**
 * Security Events Tracking Middleware
 */

export async function securityMiddleware(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  // Track authentication attempts
  const authHeader = request.headers.authorization;

  if (!authHeader) {
    metricsService.recordSecurityEvent('no_auth_header', 'low');
  }

  // Track suspicious activity
  const suspiciousPatterns = [
    /\.\.\//,  // Path traversal
    /<script>/i,  // XSS attempt
    /union\s+select/i,  // SQL injection
  ];

  const url = request.url;
  for (const pattern of suspiciousPatterns) {
    if (pattern.test(url)) {
      metricsService.recordSecurityEvent('suspicious_request', 'high');
      logger.warn({ url, pattern: pattern.toString() }, 'Suspicious request detected');
    }
  }
}
```

**Rate Limit Integration** (in existing rate limit config):
```typescript
// In app.ts, modify rate limit handler
errorResponseBuilder: (_request, context) => {
  // Track rate limit hits
  metricsService.recordRateLimitHit(
    _request.url,
    context.limit.toString()
  );

  return {
    error: {
      code: 'RATE_LIMIT_EXCEEDED',
      message: `Rate limit exceeded, retry in ${context.after}`,
    },
    timestamp: new Date().toISOString(),
  };
}
```

**Priority**: P2
**Estimated Lines**: 80 lines
**Impact**: +3 metrics actively collecting

---

### Phase 5: Advanced Database Metrics (P2)

#### 5.1 PostgreSQL Statistics Collection
**Location**: `src/services/database-stats.service.ts` (new file)

**Implementation**:
```typescript
/**
 * PostgreSQL Statistics Collection Service
 * Queries pg_stat_* views for detailed database metrics
 */

import { queryClient } from '../db/connection.js';
import { metricsService } from './metrics.service.js';
import { logger } from '../config/logger.js';

export class DatabaseStatsService {
  private collectionInterval: NodeJS.Timeout | null = null;

  startCollection(): void {
    // Collect every 30 seconds
    this.collectionInterval = setInterval(() => {
      this.collectStats().catch(error => {
        logger.error({ error }, 'Failed to collect database stats');
      });
    }, 30000);

    logger.info('Database stats collection started');
  }

  async collectStats(): Promise<void> {
    await Promise.all([
      this.collectTableStats(),
      this.collectIndexStats(),
      this.collectConnectionStats(),
      this.collectCacheStats(),
      this.collectLockStats(),
    ]);
  }

  private async collectTableStats(): Promise<void> {
    const result = await queryClient`
      SELECT
        schemaname,
        relname as table_name,
        n_tup_ins as inserts,
        n_tup_upd as updates,
        n_tup_del as deletes,
        seq_scan,
        idx_scan,
        pg_total_relation_size(relid) as total_bytes,
        n_live_tup as row_estimate
      FROM pg_stat_user_tables
    `;

    for (const row of result) {
      const tableName = row.table_name;

      // Table size
      metricsService.setDatabaseTableSize(tableName, row.total_bytes);

      // Row estimates
      metricsService.setDatabaseRowEstimates(tableName, row.row_estimate);

      // Sequential scans (track if > 1000/min)
      if (row.seq_scan > 1000) {
        metricsService.recordDatabaseSeqScan(tableName);
      }

      // Index hit ratio
      const totalScans = row.seq_scan + row.idx_scan;
      if (totalScans > 0) {
        const indexHitRatio = row.idx_scan / totalScans;
        metricsService.setIndexHitRatio(tableName, indexHitRatio);
      }
    }
  }

  private async collectIndexStats(): Promise<void> {
    const result = await queryClient`
      SELECT
        schemaname,
        tablename,
        indexname,
        pg_relation_size(indexrelid) as index_size
      FROM pg_stat_user_indexes
    `;

    for (const row of result) {
      metricsService.setDatabaseIndexSize(
        row.tablename,
        row.indexname,
        row.index_size
      );
    }
  }

  private async collectConnectionStats(): Promise<void> {
    const result = await queryClient`
      SELECT
        count(*) as total,
        count(*) FILTER (WHERE state = 'active') as active,
        count(*) FILTER (WHERE state = 'idle') as idle,
        max(EXTRACT(EPOCH FROM (now() - backend_start))) as max_conn_age
      FROM pg_stat_activity
      WHERE datname = current_database()
    `;

    const stats = result[0];
    metricsService.setDatabaseConnections('postgres', 'active', stats.active);
    metricsService.setDatabaseConnections('postgres', 'idle', stats.idle);

    if (stats.max_conn_age) {
      metricsService.setDatabaseConnectionAge('max', stats.max_conn_age);
    }
  }

  private async collectCacheStats(): Promise<void> {
    const result = await queryClient`
      SELECT
        sum(heap_blks_read) as heap_read,
        sum(heap_blks_hit) as heap_hit,
        sum(idx_blks_read) as idx_read,
        sum(idx_blks_hit) as idx_hit
      FROM pg_statio_user_tables
    `;

    const stats = result[0];
    const totalReads = stats.heap_read + stats.heap_hit;

    if (totalReads > 0) {
      const cacheHitRatio = stats.heap_hit / totalReads;
      metricsService.setBufferCacheHitRatio(cacheHitRatio);
    }
  }

  private async collectLockStats(): Promise<void> {
    const result = await queryClient`
      SELECT
        mode,
        count(*) as lock_count
      FROM pg_locks
      WHERE granted = false
      GROUP BY mode
    `;

    for (const row of result) {
      metricsService.setLockWaitCount(row.mode, row.lock_count);
    }
  }

  stop(): void {
    if (this.collectionInterval) {
      clearInterval(this.collectionInterval);
    }
  }
}

export const databaseStatsService = new DatabaseStatsService();
```

**Priority**: P2
**Estimated Lines**: 200 lines
**Impact**: +12 metrics actively collecting

---

## Metric Naming Conventions

Following **Prometheus best practices**:

### Format

```
<namespace>_<subsystem>_<metric_name>_<unit>
```

### Examples

```

# Counters (total suffix)

birthday_scheduler_messages_sent_total
birthday_scheduler_user_creations_total
birthday_scheduler_http_requests_total

# Gauges (current value)

birthday_scheduler_queue_depth
birthday_scheduler_active_workers
birthday_scheduler_cache_hit_rate

# Histograms (with _bucket, _sum, _count)

birthday_scheduler_api_response_time_seconds
birthday_scheduler_database_query_duration_seconds

# Summaries (with quantiles)

birthday_scheduler_message_processing_quantiles
```

### Label Strategies

**Good Labels** (low cardinality):
- `method`: GET, POST, PUT, DELETE
- `status`: success, failure, timeout
- `queue_name`: predefined queue names
- `message_type`: birthday, anniversary
- `timezone`: IANA timezone identifiers (limited set)

**Avoid** (high cardinality):
- User IDs
- Email addresses
- Timestamps
- Random UUIDs
- Full URLs

### Label Limits

- **Maximum labels per metric**: 10
- **Maximum label cardinality**: 1000 values
- **Total unique time series**: < 10,000

---

## Integration Points Summary

### Files to Modify

| File | Changes | New Lines | Priority |
|------|---------|-----------|----------|
| `src/middleware/metrics.middleware.ts` | Add request/response size tracking | 20 | P0 |
| `src/db/connection.ts` | Integrate metrics interceptor | 10 | P0 |
| `src/queue/consumer.ts` | Add queue metrics | 80 | P0 |
| `src/queue/publisher.ts` | Add publish metrics | 30 | P0 |
| `src/controllers/user.controller.ts` | Add user lifecycle metrics | 30 | P1 |
| `src/repositories/user.repository.ts` | Add count methods | 60 | P1 |
| `src/schedulers/daily-birthday.scheduler.ts` | Add birthday metrics | 50 | P1 |
| `src/strategies/*.ts` | Add template metrics | 20 | P1 |
| `src/clients/email-service.client.ts` | Add HTTP client metrics | 60 | P1 |
| `src/app.ts` | Add rate limit metrics | 10 | P2 |

### New Files to Create

| File | Purpose | Lines | Priority |
|------|---------|-------|----------|
| `src/db/metrics-interceptor.ts` | Database query tracking | 150 | P0 |
| `src/services/system-metrics.service.ts` | Node.js runtime metrics | 180 | P1 |
| `src/schedulers/user-metrics.scheduler.ts` | User statistics collection | 80 | P1 |
| `src/services/cache.service.ts` | Cache with metrics | 150 | P1 |
| `src/services/database-stats.service.ts` | PostgreSQL stats collection | 200 | P2 |
| `src/middleware/security.middleware.ts` | Security event tracking | 80 | P2 |

**Total New Code**: ~1,190 lines

---

## Implementation Priorities

### P0 (Critical - Week 1)
**Goal**: Get core infrastructure metrics collecting
- [x] Database metrics interceptor - Implemented in: `src/db/interceptors/metrics-interceptor.ts`
- [ ] Queue metrics (consumer + publisher)
- [ ] HTTP response/request size tracking

**Expected Metrics Active**: +35

### P1 (High - Week 2)
**Goal**: Add business and performance metrics
- [ ] User lifecycle metrics
- [ ] Birthday processing metrics
- [x] System/runtime metrics - Implemented in: `src/services/system-metrics.service.ts`
- [ ] HTTP client metrics
- [x] Cache service with metrics - Implemented in: `src/services/cache.service.ts`

**Expected Metrics Active**: +38

### P2 (Medium - Week 3)
**Goal**: Complete advanced metrics
- [ ] Security metrics
- [ ] Advanced database stats
- [ ] Webhook metrics (if applicable)

**Expected Metrics Active**: +15

### Total Expected Active Metrics
**P0 + P1 + P2**: ~88 new actively collecting metrics
**Already Active**: ~10 (HTTP middleware)
**Total**: **~98 actively collecting metrics**

---

## Testing Strategy

### Unit Tests
**Location**: `tests/unit/services/metrics.service.test.ts`

```typescript
describe('MetricsService', () => {
  beforeEach(() => {
    metricsService.resetMetrics();
  });

  describe('Database Metrics', () => {
    it('should record database query duration', async () => {
      metricsService.recordDatabaseQuery('SELECT', 'users', 0.05);

      const metrics = await metricsService.getMetrics();
      expect(metrics).toContain('birthday_scheduler_database_query_duration_seconds');
    });

    it('should track connection pool state', () => {
      metricsService.setDatabaseConnections('default', 'active', 5);
      metricsService.setDatabaseConnections('default', 'idle', 3);

      // Verify metrics are set
    });
  });

  describe('Queue Metrics', () => {
    it('should track message consumption', async () => {
      metricsService.recordMessageConsumeDuration('birthday_queue', 'success', 0.1);

      const metrics = await metricsService.getMetrics();
      expect(metrics).toContain('birthday_scheduler_message_consume_duration_seconds');
    });
  });
});
```

### Integration Tests
**Location**: `tests/integration/metrics/metrics-collection.test.ts`

```typescript
describe('Metrics Collection Integration', () => {
  it('should collect metrics from real database queries', async () => {
    // Execute real query
    await userRepository.findById('test-id');

    // Verify metric was recorded
    const metrics = await metricsService.getMetrics();
    expect(metrics).toMatch(/birthday_scheduler_database_query_duration_seconds.*SELECT/);
  });

  it('should collect queue metrics from real messages', async () => {
    // Publish message
    await publisher.publishMessage({...});

    // Verify publish metric
    const metrics = await metricsService.getMetrics();
    expect(metrics).toContain('birthday_scheduler_message_publish_duration_seconds');
  });
});
```

### E2E Metrics Tests
**Location**: `tests/e2e/metrics/prometheus-scrape.test.ts`

```typescript
describe('Prometheus Metrics Endpoint', () => {
  it('should expose metrics in Prometheus format', async () => {
    const response = await fetch('http://localhost:3000/metrics');
    const text = await response.text();

    expect(text).toContain('# HELP birthday_scheduler_messages_sent_total');
    expect(text).toContain('# TYPE birthday_scheduler_messages_sent_total counter');
  });

  it('should have at least 100 custom metrics', async () => {
    const response = await fetch('http://localhost:3000/metrics');
    const text = await response.text();

    const metricCount = (text.match(/# TYPE birthday_scheduler_/g) || []).length;
    expect(metricCount).toBeGreaterThanOrEqual(100);
  });

  it('should update metrics in real-time', async () => {
    // Create user
    await createUser({...});

    // Fetch metrics
    const metrics = await fetchMetrics();
    expect(metrics).toContain('birthday_scheduler_user_creations_total 1');
  });
});
```

### Performance Tests
**Location**: `tests/performance/metrics-overhead.test.js` (k6)

```javascript
import http from 'k6/http';
import { check } from 'k6';

export let options = {
  scenarios: {
    metrics_overhead: {
      executor: 'constant-vus',
      vus: 50,
      duration: '1m',
    },
  },
  thresholds: {
    'http_req_duration{endpoint:with_metrics}': ['p95<100'],
    'http_req_duration{endpoint:metrics_scrape}': ['p95<50'],
  },
};

export default function() {
  // Test API with metrics
  const res1 = http.get('http://localhost:3000/api/v1/users');
  check(res1, {
    'API responds successfully': (r) => r.status === 200,
  });

  // Test metrics endpoint
  const res2 = http.get('http://localhost:3000/metrics');
  check(res2, {
    'Metrics endpoint responds': (r) => r.status === 200,
    'Contains custom metrics': (r) => r.body.includes('birthday_scheduler_'),
  });
}
```

---

## Monitoring & Validation

### Grafana Dashboard Queries

**Total Metrics Count**:
```promql
count({__name__=~"birthday_scheduler_.*"})
```

**Custom Metrics Only**:
```promql
count({__name__=~"birthday_scheduler_.*", __name__!~".*process_.*|.*nodejs_.*"})
```

**Metric Categories**:
```promql

# Counters

count({__name__=~"birthday_scheduler_.*_total"})

# Gauges

count({__name__=~"birthday_scheduler_.*", __name__!~".*_total|.*_seconds.*"})

# Histograms

count({__name__=~"birthday_scheduler_.*_seconds_bucket"})

# Summaries

count({__name__=~"birthday_scheduler_.*_quantiles"})
```

### Health Check Integration

Add to `src/services/health-check.service.ts`:

```typescript
async getMetricsHealth(): Promise<{
  status: string;
  totalMetrics: number;
  activeMetrics: number;
  target: number;
}> {
  const metricsText = await metricsService.getMetrics();
  const lines = metricsText.split('\n');

  // Count TYPE declarations
  const totalMetrics = lines.filter(l => l.startsWith('# TYPE birthday_scheduler_')).length;

  // Count metrics with values
  const activeMetrics = lines.filter(l =>
    l.match(/^birthday_scheduler_\w+/) && !l.startsWith('#')
  ).length;

  return {
    status: totalMetrics >= 100 ? 'healthy' : 'degraded',
    totalMetrics,
    activeMetrics,
    target: 100,
  };
}
```

---

## Documentation Updates

### Files to Update

1. **README.md**
   - Add metrics section
   - Document Prometheus integration
   - List key metrics

2. **docs/MONITORING.md** (new)
   - Complete metrics catalog
   - Grafana dashboard setup
   - Alert rules examples

3. **docs/API.md**
   - Document `/metrics` endpoint
   - Explain metric types
   - Provide query examples

### Metrics Catalog Template

```markdown

## Metrics Catalog

### HTTP/API Metrics (10 metrics)

| Metric Name | Type | Labels | Description |
|-------------|------|--------|-------------|
| `birthday_scheduler_api_requests_total` | Counter | method, path, status | Total API requests |
| `birthday_scheduler_api_response_time_seconds` | Histogram | method, path, status | API response duration |
...

### Database Metrics (20 metrics)

...

### Queue Metrics (15 metrics)

...
```

---

## Sample Code Snippets

### 1. Fastify Plugin for Metrics

```typescript
// src/plugins/metrics.plugin.ts

import fp from 'fastify-plugin';
import type { FastifyPluginAsync } from 'fastify';
import { systemMetricsService } from '../services/system-metrics.service.js';
import { databaseStatsService } from '../services/database-stats.service.js';
import { cacheService } from '../services/cache.service.js';

const metricsPlugin: FastifyPluginAsync = async (fastify) => {
  // Start all metric collection services
  systemMetricsService; // Auto-starts on construction
  databaseStatsService.startCollection();
  cacheService.startMetricsCollection();

  // Cleanup on shutdown
  fastify.addHook('onClose', async () => {
    systemMetricsService.stop();
    databaseStatsService.stop();
  });
};

export default fp(metricsPlugin, {
  name: 'metrics-plugin',
  dependencies: [],
});
```

### 2. Database Transaction Wrapper

```typescript
// src/db/transaction.ts

export async function withTransaction<T>(
  callback: (tx: any) => Promise<T>
): Promise<T> {
  const startTime = Date.now();

  try {
    await queryClient.begin(async (tx) => {
      const result = await callback(tx);

      // Record commit
      metricsService.recordDatabaseCommit('explicit');
      const duration = (Date.now() - startTime) / 1000;
      metricsService.recordTransactionDuration('explicit', 'success', duration);

      return result;
    });
  } catch (error) {
    // Record rollback
    metricsService.recordDatabaseRollback(error.message);
    const duration = (Date.now() - startTime) / 1000;
    metricsService.recordTransactionDuration('explicit', 'failed', duration);

    throw error;
  }
}
```

### 3. Queue Health Monitor

```typescript
// src/queue/health-monitor.ts

export class QueueHealthMonitor {
  private checkInterval: NodeJS.Timeout;

  start(): void {
    this.checkInterval = setInterval(async () => {
      const channel = getRabbitMQ().getConsumerChannel();

      try {
        const queueInfo = await channel.checkQueue(QUEUES.BIRTHDAY_MESSAGES);

        // Update metrics
        metricsService.setQueueDepth(QUEUES.BIRTHDAY_MESSAGES, queueInfo.messageCount);
        metricsService.setConsumerCount(QUEUES.BIRTHDAY_MESSAGES, queueInfo.consumerCount);

        // Check for problems
        if (queueInfo.messageCount > 10000) {
          logger.warn({ depth: queueInfo.messageCount }, 'Queue depth is high');
          metricsService.recordSecurityEvent('high_queue_depth', 'medium');
        }

        if (queueInfo.consumerCount === 0) {
          logger.error('No consumers connected to queue');
          metricsService.recordSecurityEvent('no_consumers', 'critical');
        }

      } catch (error) {
        logger.error({ error }, 'Failed to check queue health');
      }
    }, 15000); // Every 15 seconds
  }

  stop(): void {
    clearInterval(this.checkInterval);
  }
}
```

---

## Rollout Plan

### Week 1: P0 Implementation

- **Monday-Tuesday**: Database metrics interceptor
- **Wednesday-Thursday**: Queue metrics (consumer + publisher)
- **Friday**: HTTP metrics enhancements + testing

**Deliverable**: 35+ metrics actively collecting

### Week 2: P1 Implementation

- **Monday**: User lifecycle metrics
- **Tuesday**: Birthday processing metrics
- **Wednesday**: System/runtime metrics
- **Thursday**: HTTP client + cache metrics
- **Friday**: Integration testing + validation

**Deliverable**: 73+ total metrics actively collecting

### Week 3: P2 + Finalization

- **Monday**: Security metrics
- **Tuesday**: Advanced database stats
- **Wednesday**: Complete testing suite
- **Thursday**: Documentation updates
- **Friday**: Final validation + deployment

**Deliverable**: 100+ metrics actively collecting, fully documented

---

## Success Criteria

### Quantitative

- ✅ 100+ custom metrics declared in MetricsService
- ✅ 90+ metrics actively collecting data
- ✅ All metrics follow Prometheus naming conventions
- ✅ Label cardinality < 1000 per metric
- ✅ Metrics endpoint response time < 50ms (p95)
- ✅ Test coverage > 80% for metrics code

### Qualitative

- ✅ Comprehensive observability across all system components
- ✅ Clear metric descriptions and documentation
- ✅ Grafana dashboards showing all key metrics
- ✅ Alert rules configured for critical metrics
- ✅ Runbook documentation for metric interpretation

---

## Risk Mitigation

### Performance Impact
**Risk**: Metrics collection adds overhead
**Mitigation**:
- Use efficient prom-client library
- Batch metric updates where possible
- Limit collection frequency (15-30s intervals)
- Monitor metrics endpoint latency

### Label Cardinality Explosion
**Risk**: Too many unique label combinations
**Mitigation**:
- Normalize paths (replace IDs with :id)
- Limit timezone labels to active timezones
- Avoid user-specific labels
- Monitor cardinality with Prometheus

### Missing Data
**Risk**: Metrics not collecting in production
**Mitigation**:
- Comprehensive integration tests
- Metrics health check endpoint
- Alert on missing metrics
- Regular validation in staging

---

## Appendix: Complete Metrics List

### Already Implemented (10)

1. ✅ `birthday_scheduler_messages_scheduled_total`
2. ✅ `birthday_scheduler_messages_sent_total`
3. ✅ `birthday_scheduler_messages_failed_total`
4. ✅ `birthday_scheduler_api_requests_total`
5. ✅ `birthday_scheduler_api_response_time_seconds`
6. ✅ `birthday_scheduler_queue_depth`
7. ✅ `birthday_scheduler_active_workers`
8. ✅ `birthday_scheduler_database_connections`
9. ✅ `birthday_scheduler_circuit_breaker_open`
10. ✅ `birthday_scheduler_message_delivery_duration_seconds`

### To Instrument - P0 (35)

**Database** (15):
11. `birthday_scheduler_database_query_duration_seconds`
12. `birthday_scheduler_database_query_quantiles`
13. `birthday_scheduler_database_commits_total`
14. `birthday_scheduler_database_rollbacks_total`
15. `birthday_scheduler_transaction_duration_seconds`
16. `birthday_scheduler_index_hit_ratio`
17. `birthday_scheduler_buffer_cache_hit_ratio`
18. `birthday_scheduler_database_table_size`
19. `birthday_scheduler_database_index_size`
20. `birthday_scheduler_database_row_estimates`
21. `birthday_scheduler_active_transactions`
22. `birthday_scheduler_lock_wait_count`
23. `birthday_scheduler_lock_wait_time_seconds`
24. `birthday_scheduler_database_seq_scans_total`
25. `birthday_scheduler_database_deadlocks_total`

**Queue** (20):
26. `birthday_scheduler_message_publish_duration_seconds`
27. `birthday_scheduler_message_consume_duration_seconds`
28. `birthday_scheduler_message_acks_total`
29. `birthday_scheduler_message_nacks_total`
30. `birthday_scheduler_message_redeliveries_total`
31. `birthday_scheduler_publisher_confirms_total`
32. `birthday_scheduler_queue_wait_time_seconds`
33. `birthday_scheduler_message_age_seconds`
34. `birthday_scheduler_consumer_count`
35. `birthday_scheduler_channel_count`
36. `birthday_scheduler_unacked_messages_count`
37. `birthday_scheduler_queue_memory_usage`
38. `birthday_scheduler_ack_rate`
39. `birthday_scheduler_nack_rate`
40. `birthday_scheduler_redelivery_rate`
41. `birthday_scheduler_channel_opens_total`
42. `birthday_scheduler_channel_closes_total`
43. `birthday_scheduler_connection_recoveries_total`
44. `birthday_scheduler_queue_purges_total`
45. `birthday_scheduler_exchange_declarations_total`

### To Instrument - P1 (38)

**Business** (18):
46. `birthday_scheduler_birthdays_processed_total`
47. `birthday_scheduler_birthdays_today`
48. `birthday_scheduler_birthdays_pending`
49. `birthday_scheduler_user_creations_total`
50. `birthday_scheduler_user_deletions_total`
51. `birthday_scheduler_message_template_usage_total`
52. `birthday_scheduler_user_timezone_distribution`
53. `birthday_scheduler_users_by_tier`
54. `birthday_scheduler_active_users`
55. `birthday_scheduler_birthday_greeting_types_total`
56. `birthday_scheduler_message_delivery_by_hour_total`
57. `birthday_scheduler_notification_preferences_changed_total`
58. `birthday_scheduler_user_logins_total`
59. `birthday_scheduler_subscription_events_total`
60. `birthday_scheduler_webhook_deliveries_total`
61. `birthday_scheduler_email_bounces_total`
62. `birthday_scheduler_active_message_templates`
63. `birthday_scheduler_scheduled_jobs_count`

**HTTP Client** (8):
64. `birthday_scheduler_http_request_duration_seconds`
65. `birthday_scheduler_http_request_size_bytes`
66. `birthday_scheduler_http_response_size_bytes`
67. `birthday_scheduler_http_client_retries_total`
68. `birthday_scheduler_http_client_timeouts_total`
69. `birthday_scheduler_http_client_latency_quantiles`
70. `birthday_scheduler_dns_lookup_duration_seconds`
71. `birthday_scheduler_http_dns_lookups_total`

**System/Performance** (12):
72. `birthday_scheduler_cache_hits_total`
73. `birthday_scheduler_cache_misses_total`
74. `birthday_scheduler_cache_evictions_total`
75. `birthday_scheduler_cache_hit_rate`
76. `birthday_scheduler_node_event_loop_lag`
77. `birthday_scheduler_event_loop_utilization`
78. `birthday_scheduler_node_active_handles`
79. `birthday_scheduler_node_active_requests`
80. `birthday_scheduler_gc_events_total`
81. `birthday_scheduler_gc_pause_time_seconds`
82. `birthday_scheduler_system_load_average`
83. `birthday_scheduler_system_free_memory`

### To Instrument - P2 (15)

**Security** (3):
84. `birthday_scheduler_security_events_total`
85. `birthday_scheduler_rate_limit_hits_total`
86. `birthday_scheduler_auth_failures_total`

**Advanced DB** (6):
87. `birthday_scheduler_database_connection_age`
88. `birthday_scheduler_database_query_queue_length`
89. `birthday_scheduler_replication_lag`
90. `birthday_scheduler_checkpoint_duration_seconds`
91. `birthday_scheduler_connection_establishment_time_seconds`
92. `birthday_scheduler_query_planning_time_seconds`

**Advanced System** (6):
93. `birthday_scheduler_v8_heap_space_size`
94. `birthday_scheduler_v8_heap_statistics`
95. `birthday_scheduler_v8_external_memory`
96. `birthday_scheduler_process_uptime_seconds`
97. `birthday_scheduler_process_open_file_descriptors`
98. `birthday_scheduler_memory_pool_utilization`

**Total Custom Metrics**: 98+ (excluding default Node.js metrics)

---

## Conclusion

This implementation plan provides a comprehensive, phased approach to achieving 100+ actively collecting Prometheus metrics. By focusing on P0 items first (database and queue metrics), we establish the critical infrastructure monitoring. P1 items add business intelligence and performance insights, while P2 items complete the observability picture with security and advanced metrics.

The plan is designed to be:
- **Incremental**: Can be implemented in phases
- **Testable**: Each phase includes validation
- **Performant**: Minimizes overhead through efficient collection
- **Maintainable**: Follows Prometheus best practices
- **Documented**: Complete catalog and runbooks

**Estimated Effort**: 3 weeks (1 developer)
**Risk Level**: Low (existing metric declarations reduce risk)
**Impact**: High (complete observability across entire system)
