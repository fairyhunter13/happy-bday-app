/**
 * Metrics Service
 *
 * Comprehensive Prometheus metrics for monitoring the birthday message scheduler.
 * Provides counters, gauges, histograms, and summaries for tracking:
 * - Message scheduling and delivery
 * - Queue depth and worker health
 * - API performance and errors
 * - Database connections
 * - Circuit breaker status
 *
 * Features:
 * - Default labels (service, environment, version)
 * - Type-safe metric recording
 * - Prometheus exposition format
 */

import { Registry, Counter, Gauge, Histogram, Summary, collectDefaultMetrics } from 'prom-client';
import { env } from '../config/environment.js';
import { logger } from '../config/logger.js';

/**
 * Metrics Service for Prometheus monitoring
 */
export class MetricsService {
  private readonly registry: Registry;
  private readonly defaultLabels: Record<string, string>;

  // Counter metrics
  public readonly messagesScheduledTotal: Counter;
  public readonly messagesSentTotal: Counter;
  public readonly messagesFailedTotal: Counter;
  public readonly apiRequestsTotal: Counter;
  public readonly userActivityTotal: Counter;
  public readonly messageRetriesTotal: Counter;
  public readonly externalApiCallsTotal: Counter;
  public readonly securityEventsTotal: Counter;
  public readonly rateLimitHitsTotal: Counter;
  public readonly authFailuresTotal: Counter;

  // Gauge metrics
  public readonly queueDepth: Gauge;
  public readonly activeWorkers: Gauge;
  public readonly databaseConnections: Gauge;
  public readonly circuitBreakerOpen: Gauge;
  public readonly dlqDepth: Gauge;
  public readonly activeUsers: Gauge;
  public readonly pendingMessages: Gauge;

  // Histogram metrics
  public readonly messageDeliveryDuration: Histogram;
  public readonly apiResponseTime: Histogram;
  public readonly schedulerExecutionDuration: Histogram;
  public readonly externalApiLatency: Histogram;
  public readonly databaseQueryDuration: Histogram;
  public readonly messageTimeToDelivery: Histogram;

  // Summary metrics
  public readonly messageProcessingQuantiles: Summary;

  constructor() {
    // Create registry
    this.registry = new Registry();

    // Default labels applied to all metrics
    this.defaultLabels = {
      service: 'birthday-message-scheduler',
      environment: env.NODE_ENV || 'development',
      version: process.env.npm_package_version || '1.0.0',
    };

    this.registry.setDefaultLabels(this.defaultLabels);

    // Collect default metrics (CPU, memory, event loop lag, etc.)
    collectDefaultMetrics({
      register: this.registry,
      prefix: 'birthday_scheduler_',
      gcDurationBuckets: [0.001, 0.01, 0.1, 1, 2, 5],
    });

    // Initialize Counter metrics
    this.messagesScheduledTotal = new Counter({
      name: 'birthday_scheduler_messages_scheduled_total',
      help: 'Total number of messages scheduled',
      labelNames: ['message_type', 'timezone'],
      registers: [this.registry],
    });

    this.messagesSentTotal = new Counter({
      name: 'birthday_scheduler_messages_sent_total',
      help: 'Total number of messages successfully sent',
      labelNames: ['message_type', 'status_code'],
      registers: [this.registry],
    });

    this.messagesFailedTotal = new Counter({
      name: 'birthday_scheduler_messages_failed_total',
      help: 'Total number of messages that failed to send',
      labelNames: ['message_type', 'error_type', 'retry_count'],
      registers: [this.registry],
    });

    this.apiRequestsTotal = new Counter({
      name: 'birthday_scheduler_api_requests_total',
      help: 'Total number of API requests',
      labelNames: ['method', 'path', 'status'],
      registers: [this.registry],
    });

    this.userActivityTotal = new Counter({
      name: 'birthday_scheduler_user_activity_total',
      help: 'Total user activity events',
      labelNames: ['activity_type', 'user_segment'],
      registers: [this.registry],
    });

    this.messageRetriesTotal = new Counter({
      name: 'birthday_scheduler_message_retries_total',
      help: 'Total number of message retry attempts',
      labelNames: ['message_type', 'retry_reason'],
      registers: [this.registry],
    });

    this.externalApiCallsTotal = new Counter({
      name: 'birthday_scheduler_external_api_calls_total',
      help: 'Total external API calls',
      labelNames: ['api_name', 'endpoint', 'status'],
      registers: [this.registry],
    });

    this.securityEventsTotal = new Counter({
      name: 'birthday_scheduler_security_events_total',
      help: 'Total security events',
      labelNames: ['event_type', 'severity'],
      registers: [this.registry],
    });

    this.rateLimitHitsTotal = new Counter({
      name: 'birthday_scheduler_rate_limit_hits_total',
      help: 'Total rate limit hits',
      labelNames: ['endpoint', 'limit_type'],
      registers: [this.registry],
    });

    this.authFailuresTotal = new Counter({
      name: 'birthday_scheduler_auth_failures_total',
      help: 'Total authentication failures',
      labelNames: ['failure_type', 'endpoint'],
      registers: [this.registry],
    });

    // Initialize Gauge metrics
    this.queueDepth = new Gauge({
      name: 'birthday_scheduler_queue_depth',
      help: 'Current depth of message queue',
      labelNames: ['queue_name'],
      registers: [this.registry],
    });

    this.activeWorkers = new Gauge({
      name: 'birthday_scheduler_active_workers',
      help: 'Number of active worker processes',
      labelNames: ['worker_type'],
      registers: [this.registry],
    });

    this.databaseConnections = new Gauge({
      name: 'birthday_scheduler_database_connections',
      help: 'Number of active database connections',
      labelNames: ['pool_name', 'state'],
      registers: [this.registry],
    });

    this.circuitBreakerOpen = new Gauge({
      name: 'birthday_scheduler_circuit_breaker_open',
      help: 'Circuit breaker status (1 = open, 0 = closed)',
      labelNames: ['service_name'],
      registers: [this.registry],
    });

    this.dlqDepth = new Gauge({
      name: 'birthday_scheduler_dlq_depth',
      help: 'Dead letter queue depth',
      labelNames: ['queue_name'],
      registers: [this.registry],
    });

    this.activeUsers = new Gauge({
      name: 'birthday_scheduler_active_users',
      help: 'Number of active users',
      labelNames: ['time_window'],
      registers: [this.registry],
    });

    this.pendingMessages = new Gauge({
      name: 'birthday_scheduler_pending_messages',
      help: 'Number of pending messages by type',
      labelNames: ['message_type', 'status'],
      registers: [this.registry],
    });

    // Initialize Histogram metrics
    this.messageDeliveryDuration = new Histogram({
      name: 'birthday_scheduler_message_delivery_duration_seconds',
      help: 'Duration of message delivery in seconds',
      labelNames: ['message_type', 'status'],
      buckets: [0.1, 0.5, 1, 2, 5, 10, 30],
      registers: [this.registry],
    });

    this.apiResponseTime = new Histogram({
      name: 'birthday_scheduler_api_response_time_seconds',
      help: 'API response time in seconds',
      labelNames: ['method', 'path', 'status'],
      buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1, 2, 5],
      registers: [this.registry],
    });

    this.schedulerExecutionDuration = new Histogram({
      name: 'birthday_scheduler_execution_duration_seconds',
      help: 'Scheduler job execution duration in seconds',
      labelNames: ['job_type', 'status'],
      buckets: [0.1, 0.5, 1, 5, 10, 30, 60, 120],
      registers: [this.registry],
    });

    this.externalApiLatency = new Histogram({
      name: 'birthday_scheduler_external_api_latency_seconds',
      help: 'External API call latency in seconds',
      labelNames: ['api_name', 'endpoint', 'status'],
      buckets: [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
      registers: [this.registry],
    });

    this.databaseQueryDuration = new Histogram({
      name: 'birthday_scheduler_database_query_duration_seconds',
      help: 'Database query duration in seconds',
      labelNames: ['query_type', 'table'],
      buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1, 5],
      registers: [this.registry],
    });

    this.messageTimeToDelivery = new Histogram({
      name: 'birthday_scheduler_message_time_to_delivery_seconds',
      help: 'Time from scheduling to delivery in seconds',
      labelNames: ['message_type'],
      buckets: [1, 5, 10, 30, 60, 300, 600, 1800, 3600],
      registers: [this.registry],
    });

    // Initialize Summary metrics
    this.messageProcessingQuantiles = new Summary({
      name: 'birthday_scheduler_message_processing_quantiles',
      help: 'Message processing time quantiles',
      labelNames: ['message_type'],
      percentiles: [0.5, 0.9, 0.95, 0.99],
      registers: [this.registry],
    });

    logger.info(
      { defaultLabels: this.defaultLabels },
      'MetricsService initialized with Prometheus registry'
    );
  }

  /**
   * Record a scheduled message
   */
  recordMessageScheduled(messageType: string, timezone: string): void {
    this.messagesScheduledTotal.inc({ message_type: messageType, timezone });
  }

  /**
   * Record a sent message
   */
  recordMessageSent(messageType: string, statusCode: number): void {
    this.messagesSentTotal.inc({ message_type: messageType, status_code: statusCode.toString() });
  }

  /**
   * Record a failed message
   */
  recordMessageFailed(messageType: string, errorType: string, retryCount: number): void {
    this.messagesFailedTotal.inc({
      message_type: messageType,
      error_type: errorType,
      retry_count: retryCount.toString(),
    });
  }

  /**
   * Record an API request
   */
  recordApiRequest(method: string, path: string, status: number): void {
    this.apiRequestsTotal.inc({ method, path, status: status.toString() });
  }

  /**
   * Set queue depth
   */
  setQueueDepth(queueName: string, depth: number): void {
    this.queueDepth.set({ queue_name: queueName }, depth);
  }

  /**
   * Set active workers count
   */
  setActiveWorkers(workerType: string, count: number): void {
    this.activeWorkers.set({ worker_type: workerType }, count);
  }

  /**
   * Set database connections
   */
  setDatabaseConnections(poolName: string, state: 'active' | 'idle', count: number): void {
    this.databaseConnections.set({ pool_name: poolName, state }, count);
  }

  /**
   * Set circuit breaker status
   */
  setCircuitBreakerStatus(serviceName: string, isOpen: boolean): void {
    this.circuitBreakerOpen.set({ service_name: serviceName }, isOpen ? 1 : 0);
  }

  /**
   * Record message delivery duration
   */
  recordMessageDeliveryDuration(
    messageType: string,
    status: string,
    durationSeconds: number
  ): void {
    this.messageDeliveryDuration.observe({ message_type: messageType, status }, durationSeconds);
  }

  /**
   * Record API response time
   */
  recordApiResponseTime(
    method: string,
    path: string,
    status: number,
    durationSeconds: number
  ): void {
    this.apiResponseTime.observe({ method, path, status: status.toString() }, durationSeconds);
  }

  /**
   * Record scheduler execution duration
   */
  recordSchedulerExecution(jobType: string, status: string, durationSeconds: number): void {
    this.schedulerExecutionDuration.observe({ job_type: jobType, status }, durationSeconds);
  }

  /**
   * Record message processing time for quantiles
   */
  recordMessageProcessing(messageType: string, durationSeconds: number): void {
    this.messageProcessingQuantiles.observe({ message_type: messageType }, durationSeconds);
  }

  /**
   * Record user activity
   */
  recordUserActivity(activityType: string, userSegment: string = 'default'): void {
    this.userActivityTotal.inc({ activity_type: activityType, user_segment: userSegment });
  }

  /**
   * Record message retry
   */
  recordMessageRetry(messageType: string, retryReason: string): void {
    this.messageRetriesTotal.inc({ message_type: messageType, retry_reason: retryReason });
  }

  /**
   * Record external API call
   */
  recordExternalApiCall(
    apiName: string,
    endpoint: string,
    status: number,
    durationSeconds: number
  ): void {
    this.externalApiCallsTotal.inc({ api_name: apiName, endpoint, status: status.toString() });
    this.externalApiLatency.observe(
      { api_name: apiName, endpoint, status: status.toString() },
      durationSeconds
    );
  }

  /**
   * Record security event
   */
  recordSecurityEvent(eventType: string, severity: 'low' | 'medium' | 'high' | 'critical'): void {
    this.securityEventsTotal.inc({ event_type: eventType, severity });
  }

  /**
   * Record rate limit hit
   */
  recordRateLimitHit(endpoint: string, limitType: string = 'default'): void {
    this.rateLimitHitsTotal.inc({ endpoint, limit_type: limitType });
  }

  /**
   * Record authentication failure
   */
  recordAuthFailure(failureType: string, endpoint: string): void {
    this.authFailuresTotal.inc({ failure_type: failureType, endpoint });
  }

  /**
   * Set DLQ depth
   */
  setDlqDepth(queueName: string, depth: number): void {
    this.dlqDepth.set({ queue_name: queueName }, depth);
  }

  /**
   * Set active users count
   */
  setActiveUsers(timeWindow: string, count: number): void {
    this.activeUsers.set({ time_window: timeWindow }, count);
  }

  /**
   * Set pending messages count
   */
  setPendingMessages(messageType: string, status: string, count: number): void {
    this.pendingMessages.set({ message_type: messageType, status }, count);
  }

  /**
   * Record database query duration
   */
  recordDatabaseQuery(queryType: string, table: string, durationSeconds: number): void {
    this.databaseQueryDuration.observe({ query_type: queryType, table }, durationSeconds);
  }

  /**
   * Record message time to delivery
   */
  recordTimeToDelivery(messageType: string, durationSeconds: number): void {
    this.messageTimeToDelivery.observe({ message_type: messageType }, durationSeconds);
  }

  /**
   * Get metrics in Prometheus exposition format
   *
   * @returns Prometheus-formatted metrics string
   */
  async getMetrics(): Promise<string> {
    return this.registry.metrics();
  }

  /**
   * Get metrics content type
   *
   * @returns Prometheus content type
   */
  getContentType(): string {
    return this.registry.contentType;
  }

  /**
   * Reset all metrics (useful for testing)
   */
  resetMetrics(): void {
    this.registry.resetMetrics();
    logger.info('All metrics reset');
  }

  /**
   * Get registry instance (for custom metrics)
   */
  getRegistry(): Registry {
    return this.registry;
  }

  /**
   * Get current metric values (for health checks and debugging)
   */
  async getMetricValues(): Promise<{
    scheduledTotal: number;
    sentTotal: number;
    failedTotal: number;
    apiRequestsTotal: number;
    queueDepth: Record<string, number>;
    activeWorkers: Record<string, number>;
    circuitBreakerStatus: Record<string, number>;
  }> {
    const metrics = await this.registry.getMetricsAsJSON();

    // Extract values from metrics
    const result = {
      scheduledTotal: 0,
      sentTotal: 0,
      failedTotal: 0,
      apiRequestsTotal: 0,
      queueDepth: {} as Record<string, number>,
      activeWorkers: {} as Record<string, number>,
      circuitBreakerStatus: {} as Record<string, number>,
    };

    for (const metric of metrics) {
      if (
        metric.name === 'birthday_scheduler_messages_scheduled_total' &&
        metric.type === 'counter'
      ) {
        result.scheduledTotal = metric.values.reduce((sum, v) => sum + (v.value as number), 0);
      } else if (
        metric.name === 'birthday_scheduler_messages_sent_total' &&
        metric.type === 'counter'
      ) {
        result.sentTotal = metric.values.reduce((sum, v) => sum + (v.value as number), 0);
      } else if (
        metric.name === 'birthday_scheduler_messages_failed_total' &&
        metric.type === 'counter'
      ) {
        result.failedTotal = metric.values.reduce((sum, v) => sum + (v.value as number), 0);
      } else if (
        metric.name === 'birthday_scheduler_api_requests_total' &&
        metric.type === 'counter'
      ) {
        result.apiRequestsTotal = metric.values.reduce((sum, v) => sum + (v.value as number), 0);
      } else if (metric.name === 'birthday_scheduler_queue_depth' && metric.type === 'gauge') {
        for (const value of metric.values) {
          const queueName = value.labels.queue_name as string;
          result.queueDepth[queueName] = value.value as number;
        }
      } else if (metric.name === 'birthday_scheduler_active_workers' && metric.type === 'gauge') {
        for (const value of metric.values) {
          const workerType = value.labels.worker_type as string;
          result.activeWorkers[workerType] = value.value as number;
        }
      } else if (
        metric.name === 'birthday_scheduler_circuit_breaker_open' &&
        metric.type === 'gauge'
      ) {
        for (const value of metric.values) {
          const serviceName = value.labels.service_name as string;
          result.circuitBreakerStatus[serviceName] = value.value as number;
        }
      }
    }

    return result;
  }
}

// Export singleton instance
export const metricsService = new MetricsService();
