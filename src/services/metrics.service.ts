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
 * - Business metrics (birthdays, templates, users)
 * - Performance metrics (cache, connections, batching)
 * - Queue metrics (RabbitMQ specifics)
 * - HTTP client metrics
 * - System metrics (file descriptors, V8 heap)
 *
 * Features:
 * - Default labels (service, environment, version)
 * - Type-safe metric recording
 * - Prometheus exposition format
 * - 100+ custom metrics for comprehensive observability
 */

import { Registry, Counter, Gauge, Histogram, Summary, collectDefaultMetrics } from 'prom-client';
import { env } from '../config/environment.js';
import { logger } from '../config/logger.js';

/**
 * Metrics Service for Prometheus monitoring
 * Contains 100+ custom metrics across multiple categories
 */
export class MetricsService {
  private readonly registry: Registry;
  private readonly defaultLabels: Record<string, string>;

  // ============================================
  // COUNTER METRICS (Original - 10 metrics)
  // ============================================
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
  public readonly externalApiErrorsTotal: Counter;
  public readonly circuitBreakerTripsTotal: Counter;

  // ============================================
  // BUSINESS METRICS - Counters (15 new metrics)
  // ============================================
  /** Total birthdays processed today */
  public readonly birthdaysProcessedTotal: Counter;
  /** Birthdays scheduled for today (daily count) */
  public readonly birthdaysScheduledTodayTotal: Counter;
  /** Birthday messages by strategy type */
  public readonly birthdayMessagesByStrategyTotal: Counter;
  /** Message template usage by template name */
  public readonly messageTemplateUsageTotal: Counter;
  /** User creation events */
  public readonly userCreationsTotal: Counter;
  /** User deletion events */
  public readonly userDeletionsTotal: Counter;
  /** Configuration changes by type */
  public readonly configurationChangesTotal: Counter;
  /** Feature usage tracking */
  public readonly featureUsageTotal: Counter;
  /** Messages delivered by hour */
  public readonly messageDeliveryByHourTotal: Counter;
  /** Birthday greeting types sent */
  public readonly birthdayGreetingTypesTotal: Counter;
  /** Notification preferences changed */
  public readonly notificationPreferencesChangedTotal: Counter;
  /** User login events */
  public readonly userLoginsTotal: Counter;
  /** Subscription events */
  public readonly subscriptionEventsTotal: Counter;
  /** Webhook deliveries */
  public readonly webhookDeliveriesTotal: Counter;
  /** Email bounces */
  public readonly emailBouncesTotal: Counter;
  /** SMS delivery status */
  public readonly smsDeliveryStatusTotal: Counter;
  /** Push notification status */
  public readonly pushNotificationStatusTotal: Counter;

  // ============================================
  // QUEUE METRICS - Counters (10 new metrics)
  // ============================================
  /** Publisher confirms received */
  public readonly publisherConfirmsTotal: Counter;
  /** Message acknowledgments */
  public readonly messageAcksTotal: Counter;
  /** Message negative acknowledgments */
  public readonly messageNacksTotal: Counter;
  /** Message redeliveries */
  public readonly messageRedeliveriesTotal: Counter;
  /** Queue bindings created */
  public readonly queueBindingsCreatedTotal: Counter;
  /** Channel opens */
  public readonly channelOpensTotal: Counter;
  /** Channel closes */
  public readonly channelClosesTotal: Counter;
  /** Connection recoveries */
  public readonly connectionRecoveriesTotal: Counter;
  /** Queue purges */
  public readonly queuePurgesTotal: Counter;
  /** Exchange declarations */
  public readonly exchangeDeclarationsTotal: Counter;

  // ============================================
  // PERFORMANCE METRICS - Counters (5 new metrics)
  // ============================================
  /** Cache hits */
  public readonly cacheHitsTotal: Counter;
  /** Cache misses */
  public readonly cacheMissesTotal: Counter;
  /** Cache evictions */
  public readonly cacheEvictionsTotal: Counter;
  /** Connection pool timeouts */
  public readonly connectionPoolTimeoutsTotal: Counter;
  /** Garbage collection events */
  public readonly gcEventsTotal: Counter;

  // ============================================
  // DATABASE METRICS - Counters (5 new metrics)
  // ============================================
  /** Database deadlocks */
  public readonly databaseDeadlocksTotal: Counter;
  /** Database transaction commits */
  public readonly databaseCommitsTotal: Counter;
  /** Database transaction rollbacks */
  public readonly databaseRollbacksTotal: Counter;
  /** Database checkpoint completions */
  public readonly databaseCheckpointsTotal: Counter;
  /** Database table sequential scans */
  public readonly databaseSeqScansTotal: Counter;

  // ============================================
  // HTTP CLIENT METRICS - Counters (5 new metrics)
  // ============================================
  /** HTTP client retry attempts */
  public readonly httpClientRetriesTotal: Counter;
  /** HTTP client timeouts */
  public readonly httpClientTimeoutsTotal: Counter;
  /** HTTP connection reuse */
  public readonly httpConnectionReuseTotal: Counter;
  /** HTTP DNS lookups */
  public readonly httpDnsLookupsTotal: Counter;
  /** HTTP TLS handshakes */
  public readonly httpTlsHandshakesTotal: Counter;

  // ============================================
  // API PERFORMANCE METRICS - Counters (10 new metrics)
  // ============================================
  /** API errors by endpoint and error code */
  public readonly apiErrorsTotal: Counter;
  /** API requests by status code range (2xx, 3xx, 4xx, 5xx) */
  public readonly apiRequestsByStatusRangeTotal: Counter;
  /** Slow API requests (exceeding threshold) */
  public readonly apiSlowRequestsTotal: Counter;
  /** API request timeouts */
  public readonly apiTimeoutsTotal: Counter;
  /** API validation errors */
  public readonly apiValidationErrorsTotal: Counter;
  /** API payload parsing errors */
  public readonly apiPayloadErrorsTotal: Counter;
  /** API circuit breaker trips */
  public readonly apiCircuitBreakerTripsTotal: Counter;
  /** API request retries by client */
  public readonly apiClientRetriesTotal: Counter;
  /** API CORS rejections */
  public readonly apiCorsRejectionsTotal: Counter;
  /** API content negotiation failures */
  public readonly apiContentNegotiationFailuresTotal: Counter;

  // ============================================
  // SCHEDULER METRICS - Counters (15 new metrics)
  // ============================================
  /** Scheduler jobs scheduled */
  public readonly schedulerJobsScheduledTotal: Counter;
  /** Scheduler jobs executed */
  public readonly schedulerJobsExecutedTotal: Counter;
  /** Scheduler job failures */
  public readonly schedulerJobFailuresTotal: Counter;
  /** Scheduler job skipped (due to overlap) */
  public readonly schedulerJobsSkippedTotal: Counter;
  /** Scheduler job cancellations */
  public readonly schedulerJobCancellationsTotal: Counter;
  /** Scheduler job timeouts */
  public readonly schedulerJobTimeoutsTotal: Counter;
  /** Scheduler recovery events */
  public readonly schedulerRecoveryEventsTotal: Counter;
  /** Scheduler missed executions */
  public readonly schedulerMissedExecutionsTotal: Counter;
  /** Scheduler job retries */
  public readonly schedulerJobRetriesTotal: Counter;
  /** Scheduler cron parse errors */
  public readonly schedulerCronParseErrorsTotal: Counter;
  /** Birthday scan completions */
  public readonly birthdayScanCompletionsTotal: Counter;
  /** Birthday scan errors */
  public readonly birthdayScanErrorsTotal: Counter;
  /** Timezone processing completions */
  public readonly timezoneProcessingCompletionsTotal: Counter;
  /** Scheduled message dispatches */
  public readonly scheduledMessageDispatchesTotal: Counter;
  /** Scheduler health check executions */
  public readonly schedulerHealthChecksTotal: Counter;

  // ============================================
  // BUSINESS METRICS - Counters Extended (10 new metrics)
  // ============================================
  /** User updates by field */
  public readonly userUpdatesTotal: Counter;
  /** Messages sent by channel type */
  public readonly messagesByChannelTotal: Counter;
  /** Messages sent by priority */
  public readonly messagesByPriorityTotal: Counter;
  /** User timezone changes */
  public readonly userTimezoneChangesTotal: Counter;
  /** Birthday date updates */
  public readonly birthdayDateUpdatesTotal: Counter;
  /** Opt-in events */
  public readonly userOptInsTotal: Counter;
  /** Opt-out events */
  public readonly userOptOutsTotal: Counter;
  /** Message personalization usage */
  public readonly messagePersonalizationUsageTotal: Counter;
  /** Bulk operations performed */
  public readonly bulkOperationsTotal: Counter;
  /** Data export requests */
  public readonly dataExportRequestsTotal: Counter;

  // ============================================
  // DATABASE OPERATIONS - Counters Extended (10 new metrics)
  // ============================================
  /** Database query errors by type */
  public readonly databaseQueryErrorsTotal: Counter;
  /** Database connection errors */
  public readonly databaseConnectionErrorsTotal: Counter;
  /** Database slow queries */
  public readonly databaseSlowQueriesTotal: Counter;
  /** Database prepared statement executions */
  public readonly databasePreparedStatementsTotal: Counter;
  /** Database index scans */
  public readonly databaseIndexScansTotal: Counter;
  /** Database full table scans */
  public readonly databaseFullTableScansTotal: Counter;
  /** Database constraint violations */
  public readonly databaseConstraintViolationsTotal: Counter;
  /** Database migration executions */
  public readonly databaseMigrationsTotal: Counter;
  /** Database vacuum operations */
  public readonly databaseVacuumOperationsTotal: Counter;
  /** Database analyze operations */
  public readonly databaseAnalyzeOperationsTotal: Counter;

  // ============================================
  // MESSAGE QUEUE - Counters Extended (10 new metrics)
  // ============================================
  /** Dead letter queue message additions */
  public readonly dlqMessagesAddedTotal: Counter;
  /** Dead letter queue message processed */
  public readonly dlqMessagesProcessedTotal: Counter;
  /** Queue overflow events */
  public readonly queueOverflowEventsTotal: Counter;
  /** Message expiration events */
  public readonly messageExpirationsTotal: Counter;
  /** Message priority upgrades */
  public readonly messagePriorityUpgradesTotal: Counter;
  /** Queue consumer restarts */
  public readonly queueConsumerRestartsTotal: Counter;
  /** Message deduplication events */
  public readonly messageDeduplicationsTotal: Counter;
  /** Message batching events */
  public readonly messageBatchingEventsTotal: Counter;
  /** Queue failover events */
  public readonly queueFailoverEventsTotal: Counter;
  /** Message compression events */
  public readonly messageCompressionEventsTotal: Counter;

  // ============================================
  // GAUGE METRICS (Original - 7 metrics)
  // ============================================
  public readonly queueDepth: Gauge;
  public readonly activeWorkers: Gauge;
  public readonly databaseConnections: Gauge;
  public readonly circuitBreakerOpen: Gauge;
  public readonly dlqDepth: Gauge;
  public readonly activeUsers: Gauge;
  public readonly pendingMessages: Gauge;

  // ============================================
  // BUSINESS METRICS - Gauges (10 new metrics)
  // ============================================
  /** Number of birthdays today */
  public readonly birthdaysToday: Gauge;
  /** Number of pending birthdays to process */
  public readonly birthdaysPending: Gauge;
  /** User timezone distribution */
  public readonly userTimezoneDistribution: Gauge;
  /** Peak hour messaging load */
  public readonly peakHourMessagingLoad: Gauge;
  /** Active message templates count */
  public readonly activeMessageTemplates: Gauge;
  /** Users by subscription tier */
  public readonly usersByTier: Gauge;
  /** Scheduled jobs count */
  public readonly scheduledJobsCount: Gauge;
  /** Failed jobs in retry queue */
  public readonly failedJobsRetryQueue: Gauge;
  /** Active webhooks count */
  public readonly activeWebhooksCount: Gauge;
  /** Notification queue backlog */
  public readonly notificationQueueBacklog: Gauge;

  // ============================================
  // PERFORMANCE METRICS - Gauges (10 new metrics)
  // ============================================
  /** Cache hit rate percentage */
  public readonly cacheHitRate: Gauge;
  /** Connection pool wait time */
  public readonly connectionPoolWaitTime: Gauge;
  /** Current batch processing size */
  public readonly batchProcessingSize: Gauge;
  /** Event loop utilization percentage */
  public readonly eventLoopUtilization: Gauge;
  /** Memory compression ratio */
  public readonly compressionRatio: Gauge;
  /** Current payload size in bytes */
  public readonly payloadSizeBytes: Gauge;
  /** Node.js active handles count */
  public readonly nodeActiveHandles: Gauge;
  /** Node.js active requests count */
  public readonly nodeActiveRequests: Gauge;
  /** Node.js event loop lag */
  public readonly nodeEventLoopLag: Gauge;
  /** Memory pool utilization */
  public readonly memoryPoolUtilization: Gauge;

  // ============================================
  // QUEUE METRICS - Gauges (10 new metrics)
  // ============================================
  /** Message age in seconds */
  public readonly messageAgeSeconds: Gauge;
  /** Active consumer count */
  public readonly consumerCount: Gauge;
  /** Active channel count */
  public readonly channelCount: Gauge;
  /** Exchange bindings count */
  public readonly exchangeBindingsCount: Gauge;
  /** Prefetch count setting */
  public readonly prefetchCount: Gauge;
  /** Message ack rate */
  public readonly ackRate: Gauge;
  /** Message nack rate */
  public readonly nackRate: Gauge;
  /** Redelivery rate */
  public readonly redeliveryRate: Gauge;
  /** Queue memory usage */
  public readonly queueMemoryUsage: Gauge;
  /** Unacked messages count */
  public readonly unackedMessagesCount: Gauge;

  // ============================================
  // DATABASE METRICS - Gauges (10 new metrics)
  // ============================================
  /** Index hit ratio */
  public readonly indexHitRatio: Gauge;
  /** Buffer cache hit ratio */
  public readonly bufferCacheHitRatio: Gauge;
  /** Database replication lag */
  public readonly replicationLag: Gauge;
  /** Active database transactions */
  public readonly activeTransactions: Gauge;
  /** Database lock wait count */
  public readonly lockWaitCount: Gauge;
  /** Database table size */
  public readonly databaseTableSize: Gauge;
  /** Database index size */
  public readonly databaseIndexSize: Gauge;
  /** Database row estimates */
  public readonly databaseRowEstimates: Gauge;
  /** Database connection age */
  public readonly databaseConnectionAge: Gauge;
  /** Database query queue length */
  public readonly databaseQueryQueueLength: Gauge;

  // ============================================
  // SYSTEM METRICS - Gauges (10 new metrics)
  // ============================================
  /** Process open file descriptors */
  public readonly processOpenFileDescriptors: Gauge;
  /** Process max file descriptors */
  public readonly processMaxFileDescriptors: Gauge;
  /** Process start time */
  public readonly processStartTime: Gauge;
  /** Process uptime seconds */
  public readonly processUptimeSeconds: Gauge;
  /** V8 heap space size by space name */
  public readonly v8HeapSpaceSize: Gauge;
  /** V8 heap statistics */
  public readonly v8HeapStatistics: Gauge;
  /** V8 external memory */
  public readonly v8ExternalMemory: Gauge;
  /** System load average */
  public readonly systemLoadAverage: Gauge;
  /** System free memory */
  public readonly systemFreeMemory: Gauge;
  /** System total memory */
  public readonly systemTotalMemory: Gauge;

  // ============================================
  // API PERFORMANCE METRICS - Gauges (10 new metrics)
  // ============================================
  /** Current active API requests */
  public readonly apiActiveRequests: Gauge;
  /** API request queue length */
  public readonly apiRequestQueueLength: Gauge;
  /** Average API response time (rolling window) */
  public readonly apiAverageResponseTime: Gauge;
  /** API error rate percentage (rolling window) */
  public readonly apiErrorRate: Gauge;
  /** API requests per second (current) */
  public readonly apiRequestsPerSecond: Gauge;
  /** API payload size average */
  public readonly apiPayloadSizeAverage: Gauge;
  /** API connection pool utilization */
  public readonly apiConnectionPoolUtilization: Gauge;
  /** API rate limit remaining */
  public readonly apiRateLimitRemaining: Gauge;
  /** API circuit breaker state (0=closed, 1=open, 0.5=half-open) */
  public readonly apiCircuitBreakerState: Gauge;
  /** API health score (0-100) */
  public readonly apiHealthScore: Gauge;

  // ============================================
  // SCHEDULER METRICS - Gauges (15 new metrics)
  // ============================================
  /** Next scheduled execution timestamp */
  public readonly schedulerNextExecutionTime: Gauge;
  /** Scheduler job lag (seconds behind schedule) */
  public readonly schedulerJobLag: Gauge;
  /** Active scheduled jobs */
  public readonly schedulerActiveJobs: Gauge;
  /** Pending scheduled jobs */
  public readonly schedulerPendingJobs: Gauge;
  /** Running scheduled jobs */
  public readonly schedulerRunningJobs: Gauge;
  /** Scheduler thread pool size */
  public readonly schedulerThreadPoolSize: Gauge;
  /** Scheduler thread pool active */
  public readonly schedulerThreadPoolActive: Gauge;
  /** Scheduler lock status */
  public readonly schedulerLockStatus: Gauge;
  /** Birthdays remaining to process today */
  public readonly birthdaysRemainingToday: Gauge;
  /** Scheduler backlog size */
  public readonly schedulerBacklogSize: Gauge;
  /** Current timezone being processed */
  public readonly schedulerCurrentTimezoneOffset: Gauge;
  /** Scheduler last successful run timestamp */
  public readonly schedulerLastSuccessfulRun: Gauge;
  /** Scheduler consecutive failures */
  public readonly schedulerConsecutiveFailures: Gauge;
  /** Scheduler execution window remaining */
  public readonly schedulerExecutionWindowRemaining: Gauge;
  /** Scheduler resource utilization */
  public readonly schedulerResourceUtilization: Gauge;

  // ============================================
  // DATABASE OPERATIONS - Gauges Extended (10 new metrics)
  // ============================================
  /** Database connection pool size */
  public readonly databasePoolSize: Gauge;
  /** Database connection pool idle connections */
  public readonly databasePoolIdleConnections: Gauge;
  /** Database connection pool waiting requests */
  public readonly databasePoolWaitingRequests: Gauge;
  /** Database query execution queue size */
  public readonly databaseQueryExecutionQueue: Gauge;
  /** Database connection latency */
  public readonly databaseConnectionLatency: Gauge;
  /** Database transaction in progress */
  public readonly databaseTransactionsInProgress: Gauge;
  /** Database replication slots active */
  public readonly databaseReplicationSlotsActive: Gauge;
  /** Database WAL size */
  public readonly databaseWalSize: Gauge;
  /** Database cache size */
  public readonly databaseCacheSize: Gauge;
  /** Database temp files size */
  public readonly databaseTempFilesSize: Gauge;

  // ============================================
  // MESSAGE QUEUE - Gauges Extended (10 new metrics)
  // ============================================
  /** Queue messages ready */
  public readonly queueMessagesReady: Gauge;
  /** Queue messages unacked */
  public readonly queueMessagesUnacked: Gauge;
  /** Queue message publish rate */
  public readonly queuePublishRate: Gauge;
  /** Queue message delivery rate */
  public readonly queueDeliveryRate: Gauge;
  /** Queue consumer utilization */
  public readonly queueConsumerUtilization: Gauge;
  /** DLQ message age (oldest) */
  public readonly dlqOldestMessageAge: Gauge;
  /** Queue connection count */
  public readonly queueConnectionCount: Gauge;
  /** Queue message size average */
  public readonly queueMessageSizeAverage: Gauge;
  /** Queue high watermark */
  public readonly queueHighWatermark: Gauge;
  /** Queue redelivery backoff */
  public readonly queueRedeliveryBackoff: Gauge;

  // ============================================
  // BUSINESS METRICS - Gauges Extended (10 new metrics)
  // ============================================
  /** Total registered users */
  public readonly totalRegisteredUsers: Gauge;
  /** Users by timezone count */
  public readonly usersByTimezone: Gauge;
  /** Messages in send queue */
  public readonly messagesInSendQueue: Gauge;
  /** Average message delivery time */
  public readonly averageMessageDeliveryTime: Gauge;
  /** Daily active users */
  public readonly dailyActiveUsers: Gauge;
  /** Weekly active users */
  public readonly weeklyActiveUsers: Gauge;
  /** Monthly active users */
  public readonly monthlyActiveUsers: Gauge;
  /** Message delivery success rate */
  public readonly messageDeliverySuccessRate: Gauge;
  /** User engagement score */
  public readonly userEngagementScore: Gauge;
  /** Platform health score */
  public readonly platformHealthScore: Gauge;

  // ============================================
  // HISTOGRAM METRICS (Original - 6 metrics)
  // ============================================
  public readonly messageDeliveryDuration: Histogram;
  public readonly apiResponseTime: Histogram;
  public readonly schedulerExecutionDuration: Histogram;
  public readonly externalApiLatency: Histogram;
  public readonly databaseQueryDuration: Histogram;
  public readonly messageTimeToDelivery: Histogram;

  // ============================================
  // PERFORMANCE METRICS - Histograms (5 new metrics)
  // ============================================
  /** Batch processing duration */
  public readonly batchProcessingDuration: Histogram;
  /** GC pause time */
  public readonly gcPauseTime: Histogram;
  /** Connection pool acquisition time */
  public readonly connectionPoolAcquisitionTime: Histogram;
  /** Cache operation duration */
  public readonly cacheOperationDuration: Histogram;
  /** Serialization duration */
  public readonly serializationDuration: Histogram;

  // ============================================
  // QUEUE METRICS - Histograms (5 new metrics)
  // ============================================
  /** Message publish duration */
  public readonly messagePublishDuration: Histogram;
  /** Message consume duration */
  public readonly messageConsumeDuration: Histogram;
  /** Queue wait time */
  public readonly queueWaitTime: Histogram;
  /** Channel operation duration */
  public readonly channelOperationDuration: Histogram;
  /** Message processing latency */
  public readonly messageProcessingLatency: Histogram;

  // ============================================
  // DATABASE METRICS - Histograms (5 new metrics)
  // ============================================
  /** Transaction duration */
  public readonly transactionDuration: Histogram;
  /** Lock wait time */
  public readonly lockWaitTime: Histogram;
  /** Checkpoint duration */
  public readonly checkpointDuration: Histogram;
  /** Connection establishment time */
  public readonly connectionEstablishmentTime: Histogram;
  /** Query planning time */
  public readonly queryPlanningTime: Histogram;

  // ============================================
  // HTTP CLIENT METRICS - Histograms (5 new metrics)
  // ============================================
  /** HTTP request duration */
  public readonly httpRequestDuration: Histogram;
  /** DNS lookup duration */
  public readonly dnsLookupDuration: Histogram;
  /** TLS handshake duration */
  public readonly tlsHandshakeDuration: Histogram;
  /** HTTP request size */
  public readonly httpRequestSize: Histogram;
  /** HTTP response size */
  public readonly httpResponseSize: Histogram;

  // ============================================
  // SUMMARY METRICS (Original - 1 metric)
  // ============================================
  public readonly messageProcessingQuantiles: Summary;

  // ============================================
  // SUMMARY METRICS (4 new metrics)
  // ============================================
  /** API response time quantiles */
  public readonly apiResponseQuantiles: Summary;
  /** Database query quantiles */
  public readonly databaseQueryQuantiles: Summary;
  /** Queue latency quantiles */
  public readonly queueLatencyQuantiles: Summary;
  /** HTTP client latency quantiles */
  public readonly httpClientLatencyQuantiles: Summary;

  // ============================================
  // API PERFORMANCE - Histograms (5 new metrics)
  // ============================================
  /** API endpoint latency by route */
  public readonly apiEndpointLatency: Histogram;
  /** API request body size */
  public readonly apiRequestBodySize: Histogram;
  /** API response body size */
  public readonly apiResponseBodySize: Histogram;
  /** API authentication duration */
  public readonly apiAuthDuration: Histogram;
  /** API middleware duration */
  public readonly apiMiddlewareDuration: Histogram;

  // ============================================
  // SCHEDULER - Histograms (5 new metrics)
  // ============================================
  /** Scheduler job duration by type */
  public readonly schedulerJobDuration: Histogram;
  /** Scheduler job wait time */
  public readonly schedulerJobWaitTime: Histogram;
  /** Birthday scan duration */
  public readonly birthdayScanDuration: Histogram;
  /** Birthday processing duration per message */
  public readonly birthdayProcessingDuration: Histogram;
  /** Timezone batch processing duration */
  public readonly timezoneBatchDuration: Histogram;
  /** Scheduler lock acquisition time */
  public readonly schedulerLockAcquisitionTime: Histogram;

  // ============================================
  // BUSINESS - Histograms (5 new metrics)
  // ============================================
  /** User registration duration */
  public readonly userRegistrationDuration: Histogram;
  /** Message personalization duration */
  public readonly messagePersonalizationDuration: Histogram;
  /** Bulk operation duration */
  public readonly bulkOperationDuration: Histogram;
  /** User data export duration */
  public readonly userDataExportDuration: Histogram;
  /** Template rendering duration */
  public readonly templateRenderingDuration: Histogram;

  // ============================================
  // SUMMARY METRICS - Extended (5 new metrics)
  // ============================================
  /** Scheduler execution quantiles */
  public readonly schedulerExecutionQuantiles: Summary;
  /** Message queue latency quantiles */
  public readonly messageQueueLatencyQuantiles: Summary;
  /** Database connection acquisition quantiles */
  public readonly databaseConnectionQuantiles: Summary;
  /** Business operation duration quantiles */
  public readonly businessOperationQuantiles: Summary;
  /** End-to-end message delivery quantiles */
  public readonly endToEndDeliveryQuantiles: Summary;

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

    this.externalApiErrorsTotal = new Counter({
      name: 'birthday_scheduler_external_api_errors_total',
      help: 'Total external API errors by type',
      labelNames: ['api_name', 'method', 'error_type'],
      registers: [this.registry],
    });

    this.circuitBreakerTripsTotal = new Counter({
      name: 'birthday_scheduler_circuit_breaker_trips_total',
      help: 'Total circuit breaker trips by service',
      labelNames: ['service', 'operation'],
      registers: [this.registry],
    });

    // ============================================
    // BUSINESS METRICS - Counters Initialization
    // ============================================
    this.birthdaysProcessedTotal = new Counter({
      name: 'birthday_scheduler_birthdays_processed_total',
      help: 'Total birthdays processed',
      labelNames: ['status', 'timezone'],
      registers: [this.registry],
    });

    this.birthdaysScheduledTodayTotal = new Counter({
      name: 'birthday_scheduler_birthdays_scheduled_today_total',
      help: 'Total birthdays scheduled for today',
      labelNames: ['timezone', 'message_type'],
      registers: [this.registry],
    });

    this.birthdayMessagesByStrategyTotal = new Counter({
      name: 'birthday_scheduler_birthday_messages_by_strategy_total',
      help: 'Birthday messages by strategy type',
      labelNames: ['strategy', 'status'],
      registers: [this.registry],
    });

    this.messageTemplateUsageTotal = new Counter({
      name: 'birthday_scheduler_message_template_usage_total',
      help: 'Message template usage count',
      labelNames: ['template_name', 'template_version'],
      registers: [this.registry],
    });

    this.userCreationsTotal = new Counter({
      name: 'birthday_scheduler_user_creations_total',
      help: 'Total user creation events',
      labelNames: ['source', 'tier'],
      registers: [this.registry],
    });

    this.userDeletionsTotal = new Counter({
      name: 'birthday_scheduler_user_deletions_total',
      help: 'Total user deletion events',
      labelNames: ['reason', 'tier'],
      registers: [this.registry],
    });

    this.configurationChangesTotal = new Counter({
      name: 'birthday_scheduler_configuration_changes_total',
      help: 'Total configuration changes',
      labelNames: ['config_type', 'change_type'],
      registers: [this.registry],
    });

    this.featureUsageTotal = new Counter({
      name: 'birthday_scheduler_feature_usage_total',
      help: 'Feature usage tracking',
      labelNames: ['feature_name', 'action'],
      registers: [this.registry],
    });

    this.messageDeliveryByHourTotal = new Counter({
      name: 'birthday_scheduler_message_delivery_by_hour_total',
      help: 'Messages delivered by hour of day',
      labelNames: ['hour', 'message_type'],
      registers: [this.registry],
    });

    this.birthdayGreetingTypesTotal = new Counter({
      name: 'birthday_scheduler_birthday_greeting_types_total',
      help: 'Birthday greeting types sent',
      labelNames: ['greeting_type', 'channel'],
      registers: [this.registry],
    });

    this.notificationPreferencesChangedTotal = new Counter({
      name: 'birthday_scheduler_notification_preferences_changed_total',
      help: 'Notification preferences changed',
      labelNames: ['preference_type', 'action'],
      registers: [this.registry],
    });

    this.userLoginsTotal = new Counter({
      name: 'birthday_scheduler_user_logins_total',
      help: 'User login events',
      labelNames: ['method', 'status'],
      registers: [this.registry],
    });

    this.subscriptionEventsTotal = new Counter({
      name: 'birthday_scheduler_subscription_events_total',
      help: 'Subscription events',
      labelNames: ['event_type', 'tier'],
      registers: [this.registry],
    });

    this.webhookDeliveriesTotal = new Counter({
      name: 'birthday_scheduler_webhook_deliveries_total',
      help: 'Webhook delivery events',
      labelNames: ['webhook_type', 'status'],
      registers: [this.registry],
    });

    this.emailBouncesTotal = new Counter({
      name: 'birthday_scheduler_email_bounces_total',
      help: 'Email bounce events',
      labelNames: ['bounce_type', 'reason'],
      registers: [this.registry],
    });

    this.smsDeliveryStatusTotal = new Counter({
      name: 'birthday_scheduler_sms_delivery_status_total',
      help: 'SMS delivery status events',
      labelNames: ['status', 'carrier'],
      registers: [this.registry],
    });

    this.pushNotificationStatusTotal = new Counter({
      name: 'birthday_scheduler_push_notification_status_total',
      help: 'Push notification status events',
      labelNames: ['status', 'platform'],
      registers: [this.registry],
    });

    // ============================================
    // QUEUE METRICS - Counters Initialization
    // ============================================
    this.publisherConfirmsTotal = new Counter({
      name: 'birthday_scheduler_publisher_confirms_total',
      help: 'Publisher confirms received',
      labelNames: ['exchange', 'status'],
      registers: [this.registry],
    });

    this.messageAcksTotal = new Counter({
      name: 'birthday_scheduler_message_acks_total',
      help: 'Message acknowledgments',
      labelNames: ['queue_name', 'consumer_tag'],
      registers: [this.registry],
    });

    this.messageNacksTotal = new Counter({
      name: 'birthday_scheduler_message_nacks_total',
      help: 'Message negative acknowledgments',
      labelNames: ['queue_name', 'reason'],
      registers: [this.registry],
    });

    this.messageRedeliveriesTotal = new Counter({
      name: 'birthday_scheduler_message_redeliveries_total',
      help: 'Message redeliveries',
      labelNames: ['queue_name', 'reason'],
      registers: [this.registry],
    });

    this.queueBindingsCreatedTotal = new Counter({
      name: 'birthday_scheduler_queue_bindings_created_total',
      help: 'Queue bindings created',
      labelNames: ['exchange', 'queue_name'],
      registers: [this.registry],
    });

    this.channelOpensTotal = new Counter({
      name: 'birthday_scheduler_channel_opens_total',
      help: 'Channel open events',
      labelNames: ['connection_name'],
      registers: [this.registry],
    });

    this.channelClosesTotal = new Counter({
      name: 'birthday_scheduler_channel_closes_total',
      help: 'Channel close events',
      labelNames: ['connection_name', 'reason'],
      registers: [this.registry],
    });

    this.connectionRecoveriesTotal = new Counter({
      name: 'birthday_scheduler_connection_recoveries_total',
      help: 'Connection recovery events',
      labelNames: ['connection_name', 'recovery_type'],
      registers: [this.registry],
    });

    this.queuePurgesTotal = new Counter({
      name: 'birthday_scheduler_queue_purges_total',
      help: 'Queue purge events',
      labelNames: ['queue_name'],
      registers: [this.registry],
    });

    this.exchangeDeclarationsTotal = new Counter({
      name: 'birthday_scheduler_exchange_declarations_total',
      help: 'Exchange declaration events',
      labelNames: ['exchange', 'exchange_type'],
      registers: [this.registry],
    });

    // ============================================
    // PERFORMANCE METRICS - Counters Initialization
    // ============================================
    this.cacheHitsTotal = new Counter({
      name: 'birthday_scheduler_cache_hits_total',
      help: 'Cache hits',
      labelNames: ['cache_name', 'key_pattern'],
      registers: [this.registry],
    });

    this.cacheMissesTotal = new Counter({
      name: 'birthday_scheduler_cache_misses_total',
      help: 'Cache misses',
      labelNames: ['cache_name', 'key_pattern'],
      registers: [this.registry],
    });

    this.cacheEvictionsTotal = new Counter({
      name: 'birthday_scheduler_cache_evictions_total',
      help: 'Cache evictions',
      labelNames: ['cache_name', 'eviction_reason'],
      registers: [this.registry],
    });

    this.connectionPoolTimeoutsTotal = new Counter({
      name: 'birthday_scheduler_connection_pool_timeouts_total',
      help: 'Connection pool timeouts',
      labelNames: ['pool_name'],
      registers: [this.registry],
    });

    this.gcEventsTotal = new Counter({
      name: 'birthday_scheduler_gc_events_total',
      help: 'Garbage collection events',
      labelNames: ['gc_type'],
      registers: [this.registry],
    });

    // ============================================
    // DATABASE METRICS - Counters Initialization
    // ============================================
    this.databaseDeadlocksTotal = new Counter({
      name: 'birthday_scheduler_database_deadlocks_total',
      help: 'Database deadlock events',
      labelNames: ['table'],
      registers: [this.registry],
    });

    this.databaseCommitsTotal = new Counter({
      name: 'birthday_scheduler_database_commits_total',
      help: 'Database transaction commits',
      labelNames: ['transaction_type'],
      registers: [this.registry],
    });

    this.databaseRollbacksTotal = new Counter({
      name: 'birthday_scheduler_database_rollbacks_total',
      help: 'Database transaction rollbacks',
      labelNames: ['reason'],
      registers: [this.registry],
    });

    this.databaseCheckpointsTotal = new Counter({
      name: 'birthday_scheduler_database_checkpoints_total',
      help: 'Database checkpoint completions',
      labelNames: ['checkpoint_type'],
      registers: [this.registry],
    });

    this.databaseSeqScansTotal = new Counter({
      name: 'birthday_scheduler_database_seq_scans_total',
      help: 'Database sequential scans',
      labelNames: ['table'],
      registers: [this.registry],
    });

    // ============================================
    // HTTP CLIENT METRICS - Counters Initialization
    // ============================================
    this.httpClientRetriesTotal = new Counter({
      name: 'birthday_scheduler_http_client_retries_total',
      help: 'HTTP client retry attempts',
      labelNames: ['host', 'method', 'status_code'],
      registers: [this.registry],
    });

    this.httpClientTimeoutsTotal = new Counter({
      name: 'birthday_scheduler_http_client_timeouts_total',
      help: 'HTTP client timeout events',
      labelNames: ['host', 'method', 'timeout_type'],
      registers: [this.registry],
    });

    this.httpConnectionReuseTotal = new Counter({
      name: 'birthday_scheduler_http_connection_reuse_total',
      help: 'HTTP connection reuse events',
      labelNames: ['host'],
      registers: [this.registry],
    });

    this.httpDnsLookupsTotal = new Counter({
      name: 'birthday_scheduler_http_dns_lookups_total',
      help: 'HTTP DNS lookup events',
      labelNames: ['host', 'status'],
      registers: [this.registry],
    });

    this.httpTlsHandshakesTotal = new Counter({
      name: 'birthday_scheduler_http_tls_handshakes_total',
      help: 'HTTP TLS handshake events',
      labelNames: ['host', 'tls_version'],
      registers: [this.registry],
    });

    // ============================================
    // API PERFORMANCE METRICS - Counters Initialization
    // ============================================
    this.apiErrorsTotal = new Counter({
      name: 'birthday_scheduler_api_errors_total',
      help: 'API errors by endpoint and error code',
      labelNames: ['endpoint', 'error_code', 'method'],
      registers: [this.registry],
    });

    this.apiRequestsByStatusRangeTotal = new Counter({
      name: 'birthday_scheduler_api_requests_by_status_range_total',
      help: 'API requests by status code range (2xx, 3xx, 4xx, 5xx)',
      labelNames: ['status_range', 'method', 'endpoint'],
      registers: [this.registry],
    });

    this.apiSlowRequestsTotal = new Counter({
      name: 'birthday_scheduler_api_slow_requests_total',
      help: 'Slow API requests exceeding threshold',
      labelNames: ['endpoint', 'method', 'threshold_ms'],
      registers: [this.registry],
    });

    this.apiTimeoutsTotal = new Counter({
      name: 'birthday_scheduler_api_timeouts_total',
      help: 'API request timeouts',
      labelNames: ['endpoint', 'method'],
      registers: [this.registry],
    });

    this.apiValidationErrorsTotal = new Counter({
      name: 'birthday_scheduler_api_validation_errors_total',
      help: 'API validation errors',
      labelNames: ['endpoint', 'field', 'error_type'],
      registers: [this.registry],
    });

    this.apiPayloadErrorsTotal = new Counter({
      name: 'birthday_scheduler_api_payload_errors_total',
      help: 'API payload parsing errors',
      labelNames: ['endpoint', 'error_type'],
      registers: [this.registry],
    });

    this.apiCircuitBreakerTripsTotal = new Counter({
      name: 'birthday_scheduler_api_circuit_breaker_trips_total',
      help: 'API circuit breaker trip events',
      labelNames: ['service', 'endpoint'],
      registers: [this.registry],
    });

    this.apiClientRetriesTotal = new Counter({
      name: 'birthday_scheduler_api_client_retries_total',
      help: 'API client retry attempts',
      labelNames: ['endpoint', 'retry_count'],
      registers: [this.registry],
    });

    this.apiCorsRejectionsTotal = new Counter({
      name: 'birthday_scheduler_api_cors_rejections_total',
      help: 'API CORS rejection events',
      labelNames: ['origin', 'endpoint'],
      registers: [this.registry],
    });

    this.apiContentNegotiationFailuresTotal = new Counter({
      name: 'birthday_scheduler_api_content_negotiation_failures_total',
      help: 'API content negotiation failures',
      labelNames: ['endpoint', 'content_type'],
      registers: [this.registry],
    });

    // ============================================
    // SCHEDULER METRICS - Counters Initialization
    // ============================================
    this.schedulerJobsScheduledTotal = new Counter({
      name: 'birthday_scheduler_scheduler_jobs_scheduled_total',
      help: 'Scheduler jobs scheduled',
      labelNames: ['job_type', 'priority'],
      registers: [this.registry],
    });

    this.schedulerJobsExecutedTotal = new Counter({
      name: 'birthday_scheduler_scheduler_jobs_executed_total',
      help: 'Scheduler jobs executed',
      labelNames: ['job_type', 'status'],
      registers: [this.registry],
    });

    this.schedulerJobFailuresTotal = new Counter({
      name: 'birthday_scheduler_scheduler_job_failures_total',
      help: 'Scheduler job failures',
      labelNames: ['job_type', 'failure_reason'],
      registers: [this.registry],
    });

    this.schedulerJobsSkippedTotal = new Counter({
      name: 'birthday_scheduler_scheduler_jobs_skipped_total',
      help: 'Scheduler jobs skipped due to overlap',
      labelNames: ['job_type', 'skip_reason'],
      registers: [this.registry],
    });

    this.schedulerJobCancellationsTotal = new Counter({
      name: 'birthday_scheduler_scheduler_job_cancellations_total',
      help: 'Scheduler job cancellations',
      labelNames: ['job_type', 'cancellation_reason'],
      registers: [this.registry],
    });

    this.schedulerJobTimeoutsTotal = new Counter({
      name: 'birthday_scheduler_scheduler_job_timeouts_total',
      help: 'Scheduler job timeouts',
      labelNames: ['job_type'],
      registers: [this.registry],
    });

    this.schedulerRecoveryEventsTotal = new Counter({
      name: 'birthday_scheduler_scheduler_recovery_events_total',
      help: 'Scheduler recovery events',
      labelNames: ['recovery_type'],
      registers: [this.registry],
    });

    this.schedulerMissedExecutionsTotal = new Counter({
      name: 'birthday_scheduler_scheduler_missed_executions_total',
      help: 'Scheduler missed executions',
      labelNames: ['job_type', 'miss_reason'],
      registers: [this.registry],
    });

    this.schedulerJobRetriesTotal = new Counter({
      name: 'birthday_scheduler_scheduler_job_retries_total',
      help: 'Scheduler job retries',
      labelNames: ['job_type', 'retry_count'],
      registers: [this.registry],
    });

    this.schedulerCronParseErrorsTotal = new Counter({
      name: 'birthday_scheduler_scheduler_cron_parse_errors_total',
      help: 'Scheduler cron expression parse errors',
      labelNames: ['expression'],
      registers: [this.registry],
    });

    this.birthdayScanCompletionsTotal = new Counter({
      name: 'birthday_scheduler_birthday_scan_completions_total',
      help: 'Birthday scan completions',
      labelNames: ['timezone', 'status'],
      registers: [this.registry],
    });

    this.birthdayScanErrorsTotal = new Counter({
      name: 'birthday_scheduler_birthday_scan_errors_total',
      help: 'Birthday scan errors',
      labelNames: ['timezone', 'error_type'],
      registers: [this.registry],
    });

    this.timezoneProcessingCompletionsTotal = new Counter({
      name: 'birthday_scheduler_timezone_processing_completions_total',
      help: 'Timezone processing completions',
      labelNames: ['timezone', 'status'],
      registers: [this.registry],
    });

    this.scheduledMessageDispatchesTotal = new Counter({
      name: 'birthday_scheduler_scheduled_message_dispatches_total',
      help: 'Scheduled message dispatches',
      labelNames: ['message_type', 'channel'],
      registers: [this.registry],
    });

    this.schedulerHealthChecksTotal = new Counter({
      name: 'birthday_scheduler_scheduler_health_checks_total',
      help: 'Scheduler health check executions',
      labelNames: ['status'],
      registers: [this.registry],
    });

    // ============================================
    // BUSINESS METRICS - Counters Extended Initialization
    // ============================================
    this.userUpdatesTotal = new Counter({
      name: 'birthday_scheduler_user_updates_total',
      help: 'User updates by field',
      labelNames: ['field', 'source'],
      registers: [this.registry],
    });

    this.messagesByChannelTotal = new Counter({
      name: 'birthday_scheduler_messages_by_channel_total',
      help: 'Messages sent by channel type',
      labelNames: ['channel', 'message_type'],
      registers: [this.registry],
    });

    this.messagesByPriorityTotal = new Counter({
      name: 'birthday_scheduler_messages_by_priority_total',
      help: 'Messages sent by priority',
      labelNames: ['priority', 'message_type'],
      registers: [this.registry],
    });

    this.userTimezoneChangesTotal = new Counter({
      name: 'birthday_scheduler_user_timezone_changes_total',
      help: 'User timezone changes',
      labelNames: ['from_timezone', 'to_timezone'],
      registers: [this.registry],
    });

    this.birthdayDateUpdatesTotal = new Counter({
      name: 'birthday_scheduler_birthday_date_updates_total',
      help: 'Birthday date updates',
      labelNames: ['source'],
      registers: [this.registry],
    });

    this.userOptInsTotal = new Counter({
      name: 'birthday_scheduler_user_opt_ins_total',
      help: 'User opt-in events',
      labelNames: ['channel', 'source'],
      registers: [this.registry],
    });

    this.userOptOutsTotal = new Counter({
      name: 'birthday_scheduler_user_opt_outs_total',
      help: 'User opt-out events',
      labelNames: ['channel', 'reason'],
      registers: [this.registry],
    });

    this.messagePersonalizationUsageTotal = new Counter({
      name: 'birthday_scheduler_message_personalization_usage_total',
      help: 'Message personalization usage',
      labelNames: ['personalization_type'],
      registers: [this.registry],
    });

    this.bulkOperationsTotal = new Counter({
      name: 'birthday_scheduler_bulk_operations_total',
      help: 'Bulk operations performed',
      labelNames: ['operation_type', 'status'],
      registers: [this.registry],
    });

    this.dataExportRequestsTotal = new Counter({
      name: 'birthday_scheduler_data_export_requests_total',
      help: 'Data export requests',
      labelNames: ['export_type', 'format'],
      registers: [this.registry],
    });

    // ============================================
    // DATABASE OPERATIONS - Counters Extended Initialization
    // ============================================
    this.databaseQueryErrorsTotal = new Counter({
      name: 'birthday_scheduler_database_query_errors_total',
      help: 'Database query errors by type',
      labelNames: ['query_type', 'error_code'],
      registers: [this.registry],
    });

    this.databaseConnectionErrorsTotal = new Counter({
      name: 'birthday_scheduler_database_connection_errors_total',
      help: 'Database connection errors',
      labelNames: ['error_type', 'pool_name'],
      registers: [this.registry],
    });

    this.databaseSlowQueriesTotal = new Counter({
      name: 'birthday_scheduler_database_slow_queries_total',
      help: 'Database slow queries',
      labelNames: ['query_type', 'table', 'threshold_ms'],
      registers: [this.registry],
    });

    this.databasePreparedStatementsTotal = new Counter({
      name: 'birthday_scheduler_database_prepared_statements_total',
      help: 'Database prepared statement executions',
      labelNames: ['statement_name', 'status'],
      registers: [this.registry],
    });

    this.databaseIndexScansTotal = new Counter({
      name: 'birthday_scheduler_database_index_scans_total',
      help: 'Database index scans',
      labelNames: ['table', 'index_name'],
      registers: [this.registry],
    });

    this.databaseFullTableScansTotal = new Counter({
      name: 'birthday_scheduler_database_full_table_scans_total',
      help: 'Database full table scans',
      labelNames: ['table'],
      registers: [this.registry],
    });

    this.databaseConstraintViolationsTotal = new Counter({
      name: 'birthday_scheduler_database_constraint_violations_total',
      help: 'Database constraint violations',
      labelNames: ['table', 'constraint_type'],
      registers: [this.registry],
    });

    this.databaseMigrationsTotal = new Counter({
      name: 'birthday_scheduler_database_migrations_total',
      help: 'Database migration executions',
      labelNames: ['migration_name', 'status'],
      registers: [this.registry],
    });

    this.databaseVacuumOperationsTotal = new Counter({
      name: 'birthday_scheduler_database_vacuum_operations_total',
      help: 'Database vacuum operations',
      labelNames: ['table', 'vacuum_type'],
      registers: [this.registry],
    });

    this.databaseAnalyzeOperationsTotal = new Counter({
      name: 'birthday_scheduler_database_analyze_operations_total',
      help: 'Database analyze operations',
      labelNames: ['table'],
      registers: [this.registry],
    });

    // ============================================
    // MESSAGE QUEUE - Counters Extended Initialization
    // ============================================
    this.dlqMessagesAddedTotal = new Counter({
      name: 'birthday_scheduler_dlq_messages_added_total',
      help: 'Dead letter queue message additions',
      labelNames: ['queue_name', 'reason'],
      registers: [this.registry],
    });

    this.dlqMessagesProcessedTotal = new Counter({
      name: 'birthday_scheduler_dlq_messages_processed_total',
      help: 'Dead letter queue messages processed',
      labelNames: ['queue_name', 'action'],
      registers: [this.registry],
    });

    this.queueOverflowEventsTotal = new Counter({
      name: 'birthday_scheduler_queue_overflow_events_total',
      help: 'Queue overflow events',
      labelNames: ['queue_name'],
      registers: [this.registry],
    });

    this.messageExpirationsTotal = new Counter({
      name: 'birthday_scheduler_message_expirations_total',
      help: 'Message expiration events',
      labelNames: ['queue_name', 'message_type'],
      registers: [this.registry],
    });

    this.messagePriorityUpgradesTotal = new Counter({
      name: 'birthday_scheduler_message_priority_upgrades_total',
      help: 'Message priority upgrade events',
      labelNames: ['queue_name', 'from_priority', 'to_priority'],
      registers: [this.registry],
    });

    this.queueConsumerRestartsTotal = new Counter({
      name: 'birthday_scheduler_queue_consumer_restarts_total',
      help: 'Queue consumer restart events',
      labelNames: ['queue_name', 'reason'],
      registers: [this.registry],
    });

    this.messageDeduplicationsTotal = new Counter({
      name: 'birthday_scheduler_message_deduplications_total',
      help: 'Message deduplication events',
      labelNames: ['queue_name'],
      registers: [this.registry],
    });

    this.messageBatchingEventsTotal = new Counter({
      name: 'birthday_scheduler_message_batching_events_total',
      help: 'Message batching events',
      labelNames: ['queue_name', 'batch_size'],
      registers: [this.registry],
    });

    this.queueFailoverEventsTotal = new Counter({
      name: 'birthday_scheduler_queue_failover_events_total',
      help: 'Queue failover events',
      labelNames: ['from_queue', 'to_queue'],
      registers: [this.registry],
    });

    this.messageCompressionEventsTotal = new Counter({
      name: 'birthday_scheduler_message_compression_events_total',
      help: 'Message compression events',
      labelNames: ['queue_name', 'compression_type'],
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

    // ============================================
    // BUSINESS METRICS - Gauges Initialization
    // ============================================
    this.birthdaysToday = new Gauge({
      name: 'birthday_scheduler_birthdays_today',
      help: 'Number of birthdays today',
      labelNames: ['timezone'],
      registers: [this.registry],
    });

    this.birthdaysPending = new Gauge({
      name: 'birthday_scheduler_birthdays_pending',
      help: 'Number of pending birthdays to process',
      labelNames: ['priority'],
      registers: [this.registry],
    });

    this.userTimezoneDistribution = new Gauge({
      name: 'birthday_scheduler_user_timezone_distribution',
      help: 'User distribution by timezone',
      labelNames: ['timezone'],
      registers: [this.registry],
    });

    this.peakHourMessagingLoad = new Gauge({
      name: 'birthday_scheduler_peak_hour_messaging_load',
      help: 'Peak hour messaging load',
      labelNames: ['hour'],
      registers: [this.registry],
    });

    this.activeMessageTemplates = new Gauge({
      name: 'birthday_scheduler_active_message_templates',
      help: 'Number of active message templates',
      labelNames: ['template_type'],
      registers: [this.registry],
    });

    this.usersByTier = new Gauge({
      name: 'birthday_scheduler_users_by_tier',
      help: 'Users by subscription tier',
      labelNames: ['tier'],
      registers: [this.registry],
    });

    this.scheduledJobsCount = new Gauge({
      name: 'birthday_scheduler_scheduled_jobs_count',
      help: 'Number of scheduled jobs',
      labelNames: ['job_type', 'status'],
      registers: [this.registry],
    });

    this.failedJobsRetryQueue = new Gauge({
      name: 'birthday_scheduler_failed_jobs_retry_queue',
      help: 'Number of failed jobs in retry queue',
      labelNames: ['job_type'],
      registers: [this.registry],
    });

    this.activeWebhooksCount = new Gauge({
      name: 'birthday_scheduler_active_webhooks_count',
      help: 'Number of active webhooks',
      labelNames: ['webhook_type'],
      registers: [this.registry],
    });

    this.notificationQueueBacklog = new Gauge({
      name: 'birthday_scheduler_notification_queue_backlog',
      help: 'Notification queue backlog',
      labelNames: ['notification_type'],
      registers: [this.registry],
    });

    // ============================================
    // PERFORMANCE METRICS - Gauges Initialization
    // ============================================
    this.cacheHitRate = new Gauge({
      name: 'birthday_scheduler_cache_hit_rate',
      help: 'Cache hit rate percentage',
      labelNames: ['cache_name'],
      registers: [this.registry],
    });

    this.connectionPoolWaitTime = new Gauge({
      name: 'birthday_scheduler_connection_pool_wait_time',
      help: 'Connection pool wait time in milliseconds',
      labelNames: ['pool_name'],
      registers: [this.registry],
    });

    this.batchProcessingSize = new Gauge({
      name: 'birthday_scheduler_batch_processing_size',
      help: 'Current batch processing size',
      labelNames: ['batch_type'],
      registers: [this.registry],
    });

    this.eventLoopUtilization = new Gauge({
      name: 'birthday_scheduler_event_loop_utilization',
      help: 'Event loop utilization percentage',
      registers: [this.registry],
    });

    this.compressionRatio = new Gauge({
      name: 'birthday_scheduler_compression_ratio',
      help: 'Memory compression ratio',
      labelNames: ['compression_type'],
      registers: [this.registry],
    });

    this.payloadSizeBytes = new Gauge({
      name: 'birthday_scheduler_payload_size_bytes',
      help: 'Current payload size in bytes',
      labelNames: ['payload_type'],
      registers: [this.registry],
    });

    this.nodeActiveHandles = new Gauge({
      name: 'birthday_scheduler_node_active_handles',
      help: 'Node.js active handles count',
      registers: [this.registry],
    });

    this.nodeActiveRequests = new Gauge({
      name: 'birthday_scheduler_node_active_requests',
      help: 'Node.js active requests count',
      registers: [this.registry],
    });

    this.nodeEventLoopLag = new Gauge({
      name: 'birthday_scheduler_node_event_loop_lag',
      help: 'Node.js event loop lag in milliseconds',
      registers: [this.registry],
    });

    this.memoryPoolUtilization = new Gauge({
      name: 'birthday_scheduler_memory_pool_utilization',
      help: 'Memory pool utilization percentage',
      labelNames: ['pool_name'],
      registers: [this.registry],
    });

    // ============================================
    // QUEUE METRICS - Gauges Initialization
    // ============================================
    this.messageAgeSeconds = new Gauge({
      name: 'birthday_scheduler_message_age_seconds',
      help: 'Message age in seconds',
      labelNames: ['queue_name'],
      registers: [this.registry],
    });

    this.consumerCount = new Gauge({
      name: 'birthday_scheduler_consumer_count',
      help: 'Active consumer count',
      labelNames: ['queue_name'],
      registers: [this.registry],
    });

    this.channelCount = new Gauge({
      name: 'birthday_scheduler_channel_count',
      help: 'Active channel count',
      labelNames: ['connection_name'],
      registers: [this.registry],
    });

    this.exchangeBindingsCount = new Gauge({
      name: 'birthday_scheduler_exchange_bindings_count',
      help: 'Exchange bindings count',
      labelNames: ['exchange'],
      registers: [this.registry],
    });

    this.prefetchCount = new Gauge({
      name: 'birthday_scheduler_prefetch_count',
      help: 'Prefetch count setting',
      labelNames: ['channel_id'],
      registers: [this.registry],
    });

    this.ackRate = new Gauge({
      name: 'birthday_scheduler_ack_rate',
      help: 'Message ack rate per second',
      labelNames: ['queue_name'],
      registers: [this.registry],
    });

    this.nackRate = new Gauge({
      name: 'birthday_scheduler_nack_rate',
      help: 'Message nack rate per second',
      labelNames: ['queue_name'],
      registers: [this.registry],
    });

    this.redeliveryRate = new Gauge({
      name: 'birthday_scheduler_redelivery_rate',
      help: 'Redelivery rate per second',
      labelNames: ['queue_name'],
      registers: [this.registry],
    });

    this.queueMemoryUsage = new Gauge({
      name: 'birthday_scheduler_queue_memory_usage',
      help: 'Queue memory usage in bytes',
      labelNames: ['queue_name'],
      registers: [this.registry],
    });

    this.unackedMessagesCount = new Gauge({
      name: 'birthday_scheduler_unacked_messages_count',
      help: 'Unacked messages count',
      labelNames: ['queue_name'],
      registers: [this.registry],
    });

    // ============================================
    // DATABASE METRICS - Gauges Initialization
    // ============================================
    this.indexHitRatio = new Gauge({
      name: 'birthday_scheduler_index_hit_ratio',
      help: 'Index hit ratio',
      labelNames: ['table'],
      registers: [this.registry],
    });

    this.bufferCacheHitRatio = new Gauge({
      name: 'birthday_scheduler_buffer_cache_hit_ratio',
      help: 'Buffer cache hit ratio',
      registers: [this.registry],
    });

    this.replicationLag = new Gauge({
      name: 'birthday_scheduler_replication_lag',
      help: 'Database replication lag in milliseconds',
      labelNames: ['replica_name'],
      registers: [this.registry],
    });

    this.activeTransactions = new Gauge({
      name: 'birthday_scheduler_active_transactions',
      help: 'Active database transactions',
      labelNames: ['transaction_type'],
      registers: [this.registry],
    });

    this.lockWaitCount = new Gauge({
      name: 'birthday_scheduler_lock_wait_count',
      help: 'Database lock wait count',
      labelNames: ['lock_type'],
      registers: [this.registry],
    });

    this.databaseTableSize = new Gauge({
      name: 'birthday_scheduler_database_table_size',
      help: 'Database table size in bytes',
      labelNames: ['table'],
      registers: [this.registry],
    });

    this.databaseIndexSize = new Gauge({
      name: 'birthday_scheduler_database_index_size',
      help: 'Database index size in bytes',
      labelNames: ['table', 'index_name'],
      registers: [this.registry],
    });

    this.databaseRowEstimates = new Gauge({
      name: 'birthday_scheduler_database_row_estimates',
      help: 'Database row estimates',
      labelNames: ['table'],
      registers: [this.registry],
    });

    this.databaseConnectionAge = new Gauge({
      name: 'birthday_scheduler_database_connection_age',
      help: 'Database connection age in seconds',
      labelNames: ['connection_id'],
      registers: [this.registry],
    });

    this.databaseQueryQueueLength = new Gauge({
      name: 'birthday_scheduler_database_query_queue_length',
      help: 'Database query queue length',
      registers: [this.registry],
    });

    // ============================================
    // SYSTEM METRICS - Gauges Initialization
    // ============================================
    this.processOpenFileDescriptors = new Gauge({
      name: 'birthday_scheduler_process_open_file_descriptors',
      help: 'Process open file descriptors',
      registers: [this.registry],
    });

    this.processMaxFileDescriptors = new Gauge({
      name: 'birthday_scheduler_process_max_file_descriptors',
      help: 'Process max file descriptors',
      registers: [this.registry],
    });

    this.processStartTime = new Gauge({
      name: 'birthday_scheduler_process_start_time',
      help: 'Process start time as Unix timestamp',
      registers: [this.registry],
    });

    this.processUptimeSeconds = new Gauge({
      name: 'birthday_scheduler_process_uptime_seconds',
      help: 'Process uptime in seconds',
      registers: [this.registry],
    });

    this.v8HeapSpaceSize = new Gauge({
      name: 'birthday_scheduler_v8_heap_space_size',
      help: 'V8 heap space size by space name',
      labelNames: ['space_name'],
      registers: [this.registry],
    });

    this.v8HeapStatistics = new Gauge({
      name: 'birthday_scheduler_v8_heap_statistics',
      help: 'V8 heap statistics',
      labelNames: ['statistic_name'],
      registers: [this.registry],
    });

    this.v8ExternalMemory = new Gauge({
      name: 'birthday_scheduler_v8_external_memory',
      help: 'V8 external memory in bytes',
      registers: [this.registry],
    });

    this.systemLoadAverage = new Gauge({
      name: 'birthday_scheduler_system_load_average',
      help: 'System load average',
      labelNames: ['interval'],
      registers: [this.registry],
    });

    this.systemFreeMemory = new Gauge({
      name: 'birthday_scheduler_system_free_memory',
      help: 'System free memory in bytes',
      registers: [this.registry],
    });

    this.systemTotalMemory = new Gauge({
      name: 'birthday_scheduler_system_total_memory',
      help: 'System total memory in bytes',
      registers: [this.registry],
    });

    // ============================================
    // API PERFORMANCE METRICS - Gauges Initialization
    // ============================================
    this.apiActiveRequests = new Gauge({
      name: 'birthday_scheduler_api_active_requests',
      help: 'Current active API requests',
      labelNames: ['endpoint', 'method'],
      registers: [this.registry],
    });

    this.apiRequestQueueLength = new Gauge({
      name: 'birthday_scheduler_api_request_queue_length',
      help: 'API request queue length',
      registers: [this.registry],
    });

    this.apiAverageResponseTime = new Gauge({
      name: 'birthday_scheduler_api_average_response_time',
      help: 'Average API response time (rolling window) in milliseconds',
      labelNames: ['endpoint'],
      registers: [this.registry],
    });

    this.apiErrorRate = new Gauge({
      name: 'birthday_scheduler_api_error_rate',
      help: 'API error rate percentage (rolling window)',
      labelNames: ['endpoint'],
      registers: [this.registry],
    });

    this.apiRequestsPerSecond = new Gauge({
      name: 'birthday_scheduler_api_requests_per_second',
      help: 'Current API requests per second',
      labelNames: ['endpoint'],
      registers: [this.registry],
    });

    this.apiPayloadSizeAverage = new Gauge({
      name: 'birthday_scheduler_api_payload_size_average',
      help: 'Average API payload size in bytes',
      labelNames: ['endpoint', 'direction'],
      registers: [this.registry],
    });

    this.apiConnectionPoolUtilization = new Gauge({
      name: 'birthday_scheduler_api_connection_pool_utilization',
      help: 'API connection pool utilization percentage',
      registers: [this.registry],
    });

    this.apiRateLimitRemaining = new Gauge({
      name: 'birthday_scheduler_api_rate_limit_remaining',
      help: 'API rate limit remaining',
      labelNames: ['endpoint', 'client_id'],
      registers: [this.registry],
    });

    this.apiCircuitBreakerState = new Gauge({
      name: 'birthday_scheduler_api_circuit_breaker_state',
      help: 'API circuit breaker state (0=closed, 1=open, 0.5=half-open)',
      labelNames: ['service'],
      registers: [this.registry],
    });

    this.apiHealthScore = new Gauge({
      name: 'birthday_scheduler_api_health_score',
      help: 'API health score (0-100)',
      registers: [this.registry],
    });

    // ============================================
    // SCHEDULER METRICS - Gauges Initialization
    // ============================================
    this.schedulerNextExecutionTime = new Gauge({
      name: 'birthday_scheduler_scheduler_next_execution_time',
      help: 'Next scheduled execution timestamp',
      labelNames: ['job_type'],
      registers: [this.registry],
    });

    this.schedulerJobLag = new Gauge({
      name: 'birthday_scheduler_scheduler_job_lag',
      help: 'Scheduler job lag in seconds behind schedule',
      labelNames: ['job_type'],
      registers: [this.registry],
    });

    this.schedulerActiveJobs = new Gauge({
      name: 'birthday_scheduler_scheduler_active_jobs',
      help: 'Active scheduled jobs count',
      labelNames: ['job_type'],
      registers: [this.registry],
    });

    this.schedulerPendingJobs = new Gauge({
      name: 'birthday_scheduler_scheduler_pending_jobs',
      help: 'Pending scheduled jobs count',
      labelNames: ['job_type'],
      registers: [this.registry],
    });

    this.schedulerRunningJobs = new Gauge({
      name: 'birthday_scheduler_scheduler_running_jobs',
      help: 'Currently running scheduled jobs count',
      labelNames: ['job_type'],
      registers: [this.registry],
    });

    this.schedulerThreadPoolSize = new Gauge({
      name: 'birthday_scheduler_scheduler_thread_pool_size',
      help: 'Scheduler thread pool size',
      registers: [this.registry],
    });

    this.schedulerThreadPoolActive = new Gauge({
      name: 'birthday_scheduler_scheduler_thread_pool_active',
      help: 'Scheduler active threads count',
      registers: [this.registry],
    });

    this.schedulerLockStatus = new Gauge({
      name: 'birthday_scheduler_scheduler_lock_status',
      help: 'Scheduler lock status (1=locked, 0=unlocked)',
      labelNames: ['lock_name'],
      registers: [this.registry],
    });

    this.birthdaysRemainingToday = new Gauge({
      name: 'birthday_scheduler_birthdays_remaining_today',
      help: 'Birthdays remaining to process today',
      labelNames: ['timezone'],
      registers: [this.registry],
    });

    this.schedulerBacklogSize = new Gauge({
      name: 'birthday_scheduler_scheduler_backlog_size',
      help: 'Scheduler backlog size',
      labelNames: ['job_type'],
      registers: [this.registry],
    });

    this.schedulerCurrentTimezoneOffset = new Gauge({
      name: 'birthday_scheduler_scheduler_current_timezone_offset',
      help: 'Current timezone offset being processed',
      registers: [this.registry],
    });

    this.schedulerLastSuccessfulRun = new Gauge({
      name: 'birthday_scheduler_scheduler_last_successful_run',
      help: 'Scheduler last successful run timestamp',
      labelNames: ['job_type'],
      registers: [this.registry],
    });

    this.schedulerConsecutiveFailures = new Gauge({
      name: 'birthday_scheduler_scheduler_consecutive_failures',
      help: 'Scheduler consecutive failures count',
      labelNames: ['job_type'],
      registers: [this.registry],
    });

    this.schedulerExecutionWindowRemaining = new Gauge({
      name: 'birthday_scheduler_scheduler_execution_window_remaining',
      help: 'Scheduler execution window remaining in seconds',
      labelNames: ['job_type'],
      registers: [this.registry],
    });

    this.schedulerResourceUtilization = new Gauge({
      name: 'birthday_scheduler_scheduler_resource_utilization',
      help: 'Scheduler resource utilization percentage',
      registers: [this.registry],
    });

    // ============================================
    // DATABASE OPERATIONS - Gauges Extended Initialization
    // ============================================
    this.databasePoolSize = new Gauge({
      name: 'birthday_scheduler_database_pool_size',
      help: 'Database connection pool size',
      labelNames: ['pool_name'],
      registers: [this.registry],
    });

    this.databasePoolIdleConnections = new Gauge({
      name: 'birthday_scheduler_database_pool_idle_connections',
      help: 'Database connection pool idle connections',
      labelNames: ['pool_name'],
      registers: [this.registry],
    });

    this.databasePoolWaitingRequests = new Gauge({
      name: 'birthday_scheduler_database_pool_waiting_requests',
      help: 'Database connection pool waiting requests',
      labelNames: ['pool_name'],
      registers: [this.registry],
    });

    this.databaseQueryExecutionQueue = new Gauge({
      name: 'birthday_scheduler_database_query_execution_queue',
      help: 'Database query execution queue size',
      registers: [this.registry],
    });

    this.databaseConnectionLatency = new Gauge({
      name: 'birthday_scheduler_database_connection_latency',
      help: 'Database connection latency in milliseconds',
      labelNames: ['pool_name'],
      registers: [this.registry],
    });

    this.databaseTransactionsInProgress = new Gauge({
      name: 'birthday_scheduler_database_transactions_in_progress',
      help: 'Database transactions currently in progress',
      labelNames: ['transaction_type'],
      registers: [this.registry],
    });

    this.databaseReplicationSlotsActive = new Gauge({
      name: 'birthday_scheduler_database_replication_slots_active',
      help: 'Database active replication slots',
      registers: [this.registry],
    });

    this.databaseWalSize = new Gauge({
      name: 'birthday_scheduler_database_wal_size',
      help: 'Database WAL size in bytes',
      registers: [this.registry],
    });

    this.databaseCacheSize = new Gauge({
      name: 'birthday_scheduler_database_cache_size',
      help: 'Database cache size in bytes',
      labelNames: ['cache_type'],
      registers: [this.registry],
    });

    this.databaseTempFilesSize = new Gauge({
      name: 'birthday_scheduler_database_temp_files_size',
      help: 'Database temporary files size in bytes',
      registers: [this.registry],
    });

    // ============================================
    // MESSAGE QUEUE - Gauges Extended Initialization
    // ============================================
    this.queueMessagesReady = new Gauge({
      name: 'birthday_scheduler_queue_messages_ready',
      help: 'Queue messages ready for consumption',
      labelNames: ['queue_name'],
      registers: [this.registry],
    });

    this.queueMessagesUnacked = new Gauge({
      name: 'birthday_scheduler_queue_messages_unacked',
      help: 'Queue messages currently unacknowledged',
      labelNames: ['queue_name'],
      registers: [this.registry],
    });

    this.queuePublishRate = new Gauge({
      name: 'birthday_scheduler_queue_publish_rate',
      help: 'Queue message publish rate per second',
      labelNames: ['queue_name'],
      registers: [this.registry],
    });

    this.queueDeliveryRate = new Gauge({
      name: 'birthday_scheduler_queue_delivery_rate',
      help: 'Queue message delivery rate per second',
      labelNames: ['queue_name'],
      registers: [this.registry],
    });

    this.queueConsumerUtilization = new Gauge({
      name: 'birthday_scheduler_queue_consumer_utilization',
      help: 'Queue consumer utilization percentage',
      labelNames: ['queue_name'],
      registers: [this.registry],
    });

    this.dlqOldestMessageAge = new Gauge({
      name: 'birthday_scheduler_dlq_oldest_message_age',
      help: 'DLQ oldest message age in seconds',
      labelNames: ['queue_name'],
      registers: [this.registry],
    });

    this.queueConnectionCount = new Gauge({
      name: 'birthday_scheduler_queue_connection_count',
      help: 'Queue connection count',
      registers: [this.registry],
    });

    this.queueMessageSizeAverage = new Gauge({
      name: 'birthday_scheduler_queue_message_size_average',
      help: 'Queue average message size in bytes',
      labelNames: ['queue_name'],
      registers: [this.registry],
    });

    this.queueHighWatermark = new Gauge({
      name: 'birthday_scheduler_queue_high_watermark',
      help: 'Queue high watermark (max messages seen)',
      labelNames: ['queue_name'],
      registers: [this.registry],
    });

    this.queueRedeliveryBackoff = new Gauge({
      name: 'birthday_scheduler_queue_redelivery_backoff',
      help: 'Queue current redelivery backoff in seconds',
      labelNames: ['queue_name'],
      registers: [this.registry],
    });

    // ============================================
    // BUSINESS METRICS - Gauges Extended Initialization
    // ============================================
    this.totalRegisteredUsers = new Gauge({
      name: 'birthday_scheduler_total_registered_users',
      help: 'Total registered users',
      registers: [this.registry],
    });

    this.usersByTimezone = new Gauge({
      name: 'birthday_scheduler_users_by_timezone',
      help: 'Users count by timezone',
      labelNames: ['timezone'],
      registers: [this.registry],
    });

    this.messagesInSendQueue = new Gauge({
      name: 'birthday_scheduler_messages_in_send_queue',
      help: 'Messages currently in send queue',
      labelNames: ['message_type'],
      registers: [this.registry],
    });

    this.averageMessageDeliveryTime = new Gauge({
      name: 'birthday_scheduler_average_message_delivery_time',
      help: 'Average message delivery time in seconds',
      labelNames: ['message_type'],
      registers: [this.registry],
    });

    this.dailyActiveUsers = new Gauge({
      name: 'birthday_scheduler_daily_active_users',
      help: 'Daily active users count',
      registers: [this.registry],
    });

    this.weeklyActiveUsers = new Gauge({
      name: 'birthday_scheduler_weekly_active_users',
      help: 'Weekly active users count',
      registers: [this.registry],
    });

    this.monthlyActiveUsers = new Gauge({
      name: 'birthday_scheduler_monthly_active_users',
      help: 'Monthly active users count',
      registers: [this.registry],
    });

    this.messageDeliverySuccessRate = new Gauge({
      name: 'birthday_scheduler_message_delivery_success_rate',
      help: 'Message delivery success rate percentage',
      labelNames: ['message_type'],
      registers: [this.registry],
    });

    this.userEngagementScore = new Gauge({
      name: 'birthday_scheduler_user_engagement_score',
      help: 'User engagement score (0-100)',
      labelNames: ['segment'],
      registers: [this.registry],
    });

    this.platformHealthScore = new Gauge({
      name: 'birthday_scheduler_platform_health_score',
      help: 'Platform health score (0-100)',
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

    // ============================================
    // PERFORMANCE METRICS - Histograms Initialization
    // ============================================
    this.batchProcessingDuration = new Histogram({
      name: 'birthday_scheduler_batch_processing_duration_seconds',
      help: 'Batch processing duration in seconds',
      labelNames: ['batch_type', 'status'],
      buckets: [0.1, 0.5, 1, 2, 5, 10, 30, 60, 120],
      registers: [this.registry],
    });

    this.gcPauseTime = new Histogram({
      name: 'birthday_scheduler_gc_pause_time_seconds',
      help: 'GC pause time in seconds',
      labelNames: ['gc_type'],
      buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1],
      registers: [this.registry],
    });

    this.connectionPoolAcquisitionTime = new Histogram({
      name: 'birthday_scheduler_connection_pool_acquisition_time_seconds',
      help: 'Connection pool acquisition time in seconds',
      labelNames: ['pool_name'],
      buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1, 2],
      registers: [this.registry],
    });

    this.cacheOperationDuration = new Histogram({
      name: 'birthday_scheduler_cache_operation_duration_seconds',
      help: 'Cache operation duration in seconds',
      labelNames: ['cache_name', 'operation'],
      buckets: [0.0001, 0.0005, 0.001, 0.005, 0.01, 0.05, 0.1],
      registers: [this.registry],
    });

    this.serializationDuration = new Histogram({
      name: 'birthday_scheduler_serialization_duration_seconds',
      help: 'Serialization duration in seconds',
      labelNames: ['format', 'operation'],
      buckets: [0.0001, 0.0005, 0.001, 0.005, 0.01, 0.05, 0.1],
      registers: [this.registry],
    });

    // ============================================
    // QUEUE METRICS - Histograms Initialization
    // ============================================
    this.messagePublishDuration = new Histogram({
      name: 'birthday_scheduler_message_publish_duration_seconds',
      help: 'Message publish duration in seconds',
      labelNames: ['exchange', 'routing_key'],
      buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1],
      registers: [this.registry],
    });

    this.messageConsumeDuration = new Histogram({
      name: 'birthday_scheduler_message_consume_duration_seconds',
      help: 'Message consume duration in seconds',
      labelNames: ['queue_name', 'status'],
      buckets: [0.01, 0.05, 0.1, 0.5, 1, 2, 5, 10],
      registers: [this.registry],
    });

    this.queueWaitTime = new Histogram({
      name: 'birthday_scheduler_queue_wait_time_seconds',
      help: 'Queue wait time in seconds',
      labelNames: ['queue_name'],
      buckets: [0.1, 0.5, 1, 5, 10, 30, 60, 300],
      registers: [this.registry],
    });

    this.channelOperationDuration = new Histogram({
      name: 'birthday_scheduler_channel_operation_duration_seconds',
      help: 'Channel operation duration in seconds',
      labelNames: ['operation'],
      buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1],
      registers: [this.registry],
    });

    this.messageProcessingLatency = new Histogram({
      name: 'birthday_scheduler_message_processing_latency_seconds',
      help: 'Message processing latency in seconds',
      labelNames: ['message_type', 'status'],
      buckets: [0.01, 0.05, 0.1, 0.5, 1, 2, 5, 10, 30],
      registers: [this.registry],
    });

    // ============================================
    // DATABASE METRICS - Histograms Initialization
    // ============================================
    this.transactionDuration = new Histogram({
      name: 'birthday_scheduler_transaction_duration_seconds',
      help: 'Transaction duration in seconds',
      labelNames: ['transaction_type', 'status'],
      buckets: [0.01, 0.05, 0.1, 0.5, 1, 2, 5, 10, 30],
      registers: [this.registry],
    });

    this.lockWaitTime = new Histogram({
      name: 'birthday_scheduler_lock_wait_time_seconds',
      help: 'Lock wait time in seconds',
      labelNames: ['lock_type', 'table'],
      buckets: [0.001, 0.01, 0.1, 0.5, 1, 5, 10, 30],
      registers: [this.registry],
    });

    this.checkpointDuration = new Histogram({
      name: 'birthday_scheduler_checkpoint_duration_seconds',
      help: 'Checkpoint duration in seconds',
      labelNames: ['checkpoint_type'],
      buckets: [0.1, 0.5, 1, 5, 10, 30, 60, 120],
      registers: [this.registry],
    });

    this.connectionEstablishmentTime = new Histogram({
      name: 'birthday_scheduler_connection_establishment_time_seconds',
      help: 'Connection establishment time in seconds',
      labelNames: ['pool_name'],
      buckets: [0.01, 0.05, 0.1, 0.5, 1, 2, 5],
      registers: [this.registry],
    });

    this.queryPlanningTime = new Histogram({
      name: 'birthday_scheduler_query_planning_time_seconds',
      help: 'Query planning time in seconds',
      labelNames: ['query_type'],
      buckets: [0.0001, 0.0005, 0.001, 0.005, 0.01, 0.05, 0.1],
      registers: [this.registry],
    });

    // ============================================
    // HTTP CLIENT METRICS - Histograms Initialization
    // ============================================
    this.httpRequestDuration = new Histogram({
      name: 'birthday_scheduler_http_request_duration_seconds',
      help: 'HTTP request duration in seconds',
      labelNames: ['host', 'method', 'status_code'],
      buckets: [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
      registers: [this.registry],
    });

    this.dnsLookupDuration = new Histogram({
      name: 'birthday_scheduler_dns_lookup_duration_seconds',
      help: 'DNS lookup duration in seconds',
      labelNames: ['host'],
      buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1],
      registers: [this.registry],
    });

    this.tlsHandshakeDuration = new Histogram({
      name: 'birthday_scheduler_tls_handshake_duration_seconds',
      help: 'TLS handshake duration in seconds',
      labelNames: ['host', 'tls_version'],
      buckets: [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2],
      registers: [this.registry],
    });

    this.httpRequestSize = new Histogram({
      name: 'birthday_scheduler_http_request_size_bytes',
      help: 'HTTP request size in bytes',
      labelNames: ['host', 'method'],
      buckets: [100, 500, 1000, 5000, 10000, 50000, 100000, 500000, 1000000],
      registers: [this.registry],
    });

    this.httpResponseSize = new Histogram({
      name: 'birthday_scheduler_http_response_size_bytes',
      help: 'HTTP response size in bytes',
      labelNames: ['host', 'method', 'status_code'],
      buckets: [100, 500, 1000, 5000, 10000, 50000, 100000, 500000, 1000000],
      registers: [this.registry],
    });

    // ============================================
    // API PERFORMANCE - Histograms Initialization
    // ============================================
    this.apiEndpointLatency = new Histogram({
      name: 'birthday_scheduler_api_endpoint_latency_seconds',
      help: 'API endpoint latency by route in seconds',
      labelNames: ['endpoint', 'method', 'status'],
      buckets: [0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5],
      registers: [this.registry],
    });

    this.apiRequestBodySize = new Histogram({
      name: 'birthday_scheduler_api_request_body_size_bytes',
      help: 'API request body size in bytes',
      labelNames: ['endpoint', 'method'],
      buckets: [100, 500, 1000, 5000, 10000, 50000, 100000, 500000, 1000000],
      registers: [this.registry],
    });

    this.apiResponseBodySize = new Histogram({
      name: 'birthday_scheduler_api_response_body_size_bytes',
      help: 'API response body size in bytes',
      labelNames: ['endpoint', 'method', 'status'],
      buckets: [100, 500, 1000, 5000, 10000, 50000, 100000, 500000, 1000000],
      registers: [this.registry],
    });

    this.apiAuthDuration = new Histogram({
      name: 'birthday_scheduler_api_auth_duration_seconds',
      help: 'API authentication duration in seconds',
      labelNames: ['auth_type', 'status'],
      buckets: [0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1],
      registers: [this.registry],
    });

    this.apiMiddlewareDuration = new Histogram({
      name: 'birthday_scheduler_api_middleware_duration_seconds',
      help: 'API middleware execution duration in seconds',
      labelNames: ['middleware_name'],
      buckets: [0.0001, 0.0005, 0.001, 0.005, 0.01, 0.05, 0.1],
      registers: [this.registry],
    });

    // ============================================
    // SCHEDULER - Histograms Initialization
    // ============================================
    this.schedulerJobDuration = new Histogram({
      name: 'birthday_scheduler_scheduler_job_duration_seconds',
      help: 'Scheduler job duration by type in seconds',
      labelNames: ['job_type', 'status'],
      buckets: [0.1, 0.5, 1, 2, 5, 10, 30, 60, 120, 300],
      registers: [this.registry],
    });

    this.schedulerJobWaitTime = new Histogram({
      name: 'birthday_scheduler_scheduler_job_wait_time_seconds',
      help: 'Scheduler job wait time in seconds',
      labelNames: ['job_type'],
      buckets: [0.01, 0.1, 0.5, 1, 5, 10, 30, 60, 300],
      registers: [this.registry],
    });

    this.birthdayScanDuration = new Histogram({
      name: 'birthday_scheduler_birthday_scan_duration_seconds',
      help: 'Birthday scan duration in seconds',
      labelNames: ['timezone', 'status'],
      buckets: [0.1, 0.5, 1, 2, 5, 10, 30, 60, 120],
      registers: [this.registry],
    });

    this.birthdayProcessingDuration = new Histogram({
      name: 'birthday_scheduler_birthday_processing_duration_seconds',
      help: 'Birthday message processing duration in seconds',
      labelNames: ['status', 'strategy'],
      buckets: [0.01, 0.05, 0.1, 0.5, 1, 2, 5, 10],
      registers: [this.registry],
    });

    this.timezoneBatchDuration = new Histogram({
      name: 'birthday_scheduler_timezone_batch_duration_seconds',
      help: 'Timezone batch processing duration in seconds',
      labelNames: ['timezone', 'batch_size'],
      buckets: [0.1, 0.5, 1, 2, 5, 10, 30, 60],
      registers: [this.registry],
    });

    this.schedulerLockAcquisitionTime = new Histogram({
      name: 'birthday_scheduler_scheduler_lock_acquisition_time_seconds',
      help: 'Scheduler lock acquisition time in seconds',
      labelNames: ['lock_name', 'status'],
      buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1, 5],
      registers: [this.registry],
    });

    // ============================================
    // BUSINESS - Histograms Initialization
    // ============================================
    this.userRegistrationDuration = new Histogram({
      name: 'birthday_scheduler_user_registration_duration_seconds',
      help: 'User registration duration in seconds',
      labelNames: ['source', 'status'],
      buckets: [0.1, 0.25, 0.5, 1, 2, 5, 10, 30],
      registers: [this.registry],
    });

    this.messagePersonalizationDuration = new Histogram({
      name: 'birthday_scheduler_message_personalization_duration_seconds',
      help: 'Message personalization duration in seconds',
      labelNames: ['personalization_type'],
      buckets: [0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5],
      registers: [this.registry],
    });

    this.bulkOperationDuration = new Histogram({
      name: 'birthday_scheduler_bulk_operation_duration_seconds',
      help: 'Bulk operation duration in seconds',
      labelNames: ['operation_type', 'batch_size'],
      buckets: [0.5, 1, 2, 5, 10, 30, 60, 120, 300],
      registers: [this.registry],
    });

    this.userDataExportDuration = new Histogram({
      name: 'birthday_scheduler_user_data_export_duration_seconds',
      help: 'User data export duration in seconds',
      labelNames: ['export_type', 'format'],
      buckets: [1, 2, 5, 10, 30, 60, 120, 300, 600],
      registers: [this.registry],
    });

    this.templateRenderingDuration = new Histogram({
      name: 'birthday_scheduler_template_rendering_duration_seconds',
      help: 'Template rendering duration in seconds',
      labelNames: ['template_name'],
      buckets: [0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25],
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

    // ============================================
    // SUMMARY METRICS - New Initialization
    // ============================================
    this.apiResponseQuantiles = new Summary({
      name: 'birthday_scheduler_api_response_quantiles',
      help: 'API response time quantiles',
      labelNames: ['method', 'path'],
      percentiles: [0.5, 0.9, 0.95, 0.99],
      registers: [this.registry],
    });

    this.databaseQueryQuantiles = new Summary({
      name: 'birthday_scheduler_database_query_quantiles',
      help: 'Database query time quantiles',
      labelNames: ['query_type', 'table'],
      percentiles: [0.5, 0.9, 0.95, 0.99],
      registers: [this.registry],
    });

    this.queueLatencyQuantiles = new Summary({
      name: 'birthday_scheduler_queue_latency_quantiles',
      help: 'Queue latency quantiles',
      labelNames: ['queue_name'],
      percentiles: [0.5, 0.9, 0.95, 0.99],
      registers: [this.registry],
    });

    this.httpClientLatencyQuantiles = new Summary({
      name: 'birthday_scheduler_http_client_latency_quantiles',
      help: 'HTTP client latency quantiles',
      labelNames: ['host', 'method'],
      percentiles: [0.5, 0.9, 0.95, 0.99],
      registers: [this.registry],
    });

    // ============================================
    // SUMMARY METRICS - Extended Initialization
    // ============================================
    this.schedulerExecutionQuantiles = new Summary({
      name: 'birthday_scheduler_scheduler_execution_quantiles',
      help: 'Scheduler execution time quantiles',
      labelNames: ['job_type'],
      percentiles: [0.5, 0.9, 0.95, 0.99],
      registers: [this.registry],
    });

    this.messageQueueLatencyQuantiles = new Summary({
      name: 'birthday_scheduler_message_queue_latency_quantiles',
      help: 'Message queue latency quantiles',
      labelNames: ['queue_name', 'operation'],
      percentiles: [0.5, 0.9, 0.95, 0.99],
      registers: [this.registry],
    });

    this.databaseConnectionQuantiles = new Summary({
      name: 'birthday_scheduler_database_connection_quantiles',
      help: 'Database connection acquisition time quantiles',
      labelNames: ['pool_name'],
      percentiles: [0.5, 0.9, 0.95, 0.99],
      registers: [this.registry],
    });

    this.businessOperationQuantiles = new Summary({
      name: 'birthday_scheduler_business_operation_quantiles',
      help: 'Business operation duration quantiles',
      labelNames: ['operation_type'],
      percentiles: [0.5, 0.9, 0.95, 0.99],
      registers: [this.registry],
    });

    this.endToEndDeliveryQuantiles = new Summary({
      name: 'birthday_scheduler_end_to_end_delivery_quantiles',
      help: 'End-to-end message delivery time quantiles',
      labelNames: ['message_type', 'channel'],
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

  // ============================================
  // BUSINESS METRICS - Recording Methods
  // ============================================

  /**
   * Record a birthday processed
   */
  recordBirthdayProcessed(status: string, timezone: string): void {
    this.birthdaysProcessedTotal.inc({ status, timezone });
  }

  /**
   * Record birthday scheduled today
   */
  recordBirthdayScheduledToday(timezone: string, messageType: string): void {
    this.birthdaysScheduledTodayTotal.inc({ timezone, message_type: messageType });
  }

  /**
   * Record birthday message by strategy
   */
  recordBirthdayMessageByStrategy(strategy: string, status: string): void {
    this.birthdayMessagesByStrategyTotal.inc({ strategy, status });
  }

  /**
   * Record birthday processing duration
   */
  recordBirthdayProcessingDuration(
    status: string,
    strategy: string,
    durationSeconds: number
  ): void {
    this.birthdayProcessingDuration.observe({ status, strategy }, durationSeconds);
  }

  /**
   * Record message template usage
   */
  recordMessageTemplateUsage(templateName: string, templateVersion: string = '1.0'): void {
    this.messageTemplateUsageTotal.inc({
      template_name: templateName,
      template_version: templateVersion,
    });
  }

  /**
   * Record template render duration
   */
  recordTemplateRenderDuration(templateName: string, durationSeconds: number): void {
    this.templateRenderingDuration.observe({ template_name: templateName }, durationSeconds);
  }

  /**
   * Record user creation
   */
  recordUserCreation(source: string, tier: string = 'free'): void {
    this.userCreationsTotal.inc({ source, tier });
  }

  /**
   * Record user deletion
   */
  recordUserDeletion(reason: string, tier: string = 'free'): void {
    this.userDeletionsTotal.inc({ reason, tier });
  }

  /**
   * Record user update
   */
  recordUserUpdate(field: string, source: string = 'api'): void {
    this.userUpdatesTotal.inc({ field, source });
  }

  /**
   * Record configuration change
   */
  recordConfigurationChange(configType: string, changeType: string): void {
    this.configurationChangesTotal.inc({ config_type: configType, change_type: changeType });
  }

  /**
   * Record feature usage
   */
  recordFeatureUsage(featureName: string, action: string): void {
    this.featureUsageTotal.inc({ feature_name: featureName, action });
  }

  /**
   * Record message delivery by hour
   */
  recordMessageDeliveryByHour(hour: number, messageType: string): void {
    this.messageDeliveryByHourTotal.inc({ hour: hour.toString(), message_type: messageType });
  }

  /**
   * Record birthday greeting type
   */
  recordBirthdayGreetingType(greetingType: string, channel: string): void {
    this.birthdayGreetingTypesTotal.inc({ greeting_type: greetingType, channel });
  }

  /**
   * Record notification preference change
   */
  recordNotificationPreferenceChange(preferenceType: string, action: string): void {
    this.notificationPreferencesChangedTotal.inc({ preference_type: preferenceType, action });
  }

  /**
   * Record user login
   */
  recordUserLogin(method: string, status: string): void {
    this.userLoginsTotal.inc({ method, status });
  }

  /**
   * Record subscription event
   */
  recordSubscriptionEvent(eventType: string, tier: string): void {
    this.subscriptionEventsTotal.inc({ event_type: eventType, tier });
  }

  /**
   * Record webhook delivery
   */
  recordWebhookDelivery(webhookType: string, status: string): void {
    this.webhookDeliveriesTotal.inc({ webhook_type: webhookType, status });
  }

  /**
   * Record email bounce
   */
  recordEmailBounce(bounceType: string, reason: string): void {
    this.emailBouncesTotal.inc({ bounce_type: bounceType, reason });
  }

  /**
   * Record SMS delivery status
   */
  recordSmsDeliveryStatus(status: string, carrier: string): void {
    this.smsDeliveryStatusTotal.inc({ status, carrier });
  }

  /**
   * Record push notification status
   */
  recordPushNotificationStatus(status: string, platform: string): void {
    this.pushNotificationStatusTotal.inc({ status, platform });
  }

  /**
   * Set birthdays today count
   */
  setBirthdaysToday(timezone: string, count: number): void {
    this.birthdaysToday.set({ timezone }, count);
  }

  /**
   * Set pending birthdays count
   */
  setBirthdaysPending(priority: string, count: number): void {
    this.birthdaysPending.set({ priority }, count);
  }

  /**
   * Set user timezone distribution
   */
  setUserTimezoneDistribution(timezone: string, count: number): void {
    this.userTimezoneDistribution.set({ timezone }, count);
  }

  /**
   * Set peak hour messaging load
   */
  setPeakHourMessagingLoad(hour: number, load: number): void {
    this.peakHourMessagingLoad.set({ hour: hour.toString() }, load);
  }

  /**
   * Set active message templates count
   */
  setActiveMessageTemplates(templateType: string, count: number): void {
    this.activeMessageTemplates.set({ template_type: templateType }, count);
  }

  /**
   * Set users by tier
   */
  setUsersByTier(tier: string, count: number): void {
    this.usersByTier.set({ tier }, count);
  }

  /**
   * Set scheduled jobs count
   */
  setScheduledJobsCount(jobType: string, status: string, count: number): void {
    this.scheduledJobsCount.set({ job_type: jobType, status }, count);
  }

  /**
   * Set failed jobs retry queue count
   */
  setFailedJobsRetryQueue(jobType: string, count: number): void {
    this.failedJobsRetryQueue.set({ job_type: jobType }, count);
  }

  /**
   * Set active webhooks count
   */
  setActiveWebhooksCount(webhookType: string, count: number): void {
    this.activeWebhooksCount.set({ webhook_type: webhookType }, count);
  }

  /**
   * Set notification queue backlog
   */
  setNotificationQueueBacklog(notificationType: string, count: number): void {
    this.notificationQueueBacklog.set({ notification_type: notificationType }, count);
  }

  // ============================================
  // QUEUE METRICS - Recording Methods
  // ============================================

  /**
   * Record publisher confirm
   */
  recordPublisherConfirm(exchange: string, status: string): void {
    this.publisherConfirmsTotal.inc({ exchange, status });
  }

  /**
   * Record message ack
   */
  recordMessageAck(queueName: string, consumerTag: string): void {
    this.messageAcksTotal.inc({ queue_name: queueName, consumer_tag: consumerTag });
  }

  /**
   * Record message nack
   */
  recordMessageNack(queueName: string, reason: string): void {
    this.messageNacksTotal.inc({ queue_name: queueName, reason });
  }

  /**
   * Record message redelivery
   */
  recordMessageRedelivery(queueName: string, reason: string): void {
    this.messageRedeliveriesTotal.inc({ queue_name: queueName, reason });
  }

  /**
   * Record queue binding created
   */
  recordQueueBindingCreated(exchange: string, queueName: string): void {
    this.queueBindingsCreatedTotal.inc({ exchange, queue_name: queueName });
  }

  /**
   * Record channel open
   */
  recordChannelOpen(connectionName: string): void {
    this.channelOpensTotal.inc({ connection_name: connectionName });
  }

  /**
   * Record channel close
   */
  recordChannelClose(connectionName: string, reason: string): void {
    this.channelClosesTotal.inc({ connection_name: connectionName, reason });
  }

  /**
   * Record connection recovery
   */
  recordConnectionRecovery(connectionName: string, recoveryType: string): void {
    this.connectionRecoveriesTotal.inc({
      connection_name: connectionName,
      recovery_type: recoveryType,
    });
  }

  /**
   * Record queue purge
   */
  recordQueuePurge(queueName: string): void {
    this.queuePurgesTotal.inc({ queue_name: queueName });
  }

  /**
   * Record exchange declaration
   */
  recordExchangeDeclaration(exchange: string, exchangeType: string): void {
    this.exchangeDeclarationsTotal.inc({ exchange, exchange_type: exchangeType });
  }

  /**
   * Record DLQ message processing
   */
  recordDlqMessageProcessed(queueName: string, action: 'requeued' | 'discarded' | 'retry'): void {
    this.dlqMessagesProcessedTotal.inc({ queue_name: queueName, action });
  }

  /**
   * Record DLQ message added
   */
  recordDlqMessageAdded(queueName: string): void {
    this.dlqMessagesAddedTotal.inc({ queue_name: queueName });
  }

  /**
   * Set message age
   */
  setMessageAge(queueName: string, ageSeconds: number): void {
    this.messageAgeSeconds.set({ queue_name: queueName }, ageSeconds);
  }

  /**
   * Set consumer count
   */
  setConsumerCount(queueName: string, count: number): void {
    this.consumerCount.set({ queue_name: queueName }, count);
  }

  /**
   * Set channel count
   */
  setChannelCount(connectionName: string, count: number): void {
    this.channelCount.set({ connection_name: connectionName }, count);
  }

  /**
   * Set exchange bindings count
   */
  setExchangeBindingsCount(exchange: string, count: number): void {
    this.exchangeBindingsCount.set({ exchange }, count);
  }

  /**
   * Set prefetch count
   */
  setPrefetchCount(channelId: string, count: number): void {
    this.prefetchCount.set({ channel_id: channelId }, count);
  }

  /**
   * Set ack rate
   */
  setAckRate(queueName: string, rate: number): void {
    this.ackRate.set({ queue_name: queueName }, rate);
  }

  /**
   * Set nack rate
   */
  setNackRate(queueName: string, rate: number): void {
    this.nackRate.set({ queue_name: queueName }, rate);
  }

  /**
   * Set redelivery rate
   */
  setRedeliveryRate(queueName: string, rate: number): void {
    this.redeliveryRate.set({ queue_name: queueName }, rate);
  }

  /**
   * Set queue memory usage
   */
  setQueueMemoryUsage(queueName: string, bytes: number): void {
    this.queueMemoryUsage.set({ queue_name: queueName }, bytes);
  }

  /**
   * Set unacked messages count
   */
  setUnackedMessagesCount(queueName: string, count: number): void {
    this.unackedMessagesCount.set({ queue_name: queueName }, count);
  }

  /**
   * Record message publish duration
   */
  recordMessagePublishDuration(
    exchange: string,
    routingKey: string,
    durationSeconds: number
  ): void {
    this.messagePublishDuration.observe({ exchange, routing_key: routingKey }, durationSeconds);
  }

  /**
   * Record message consume duration
   */
  recordMessageConsumeDuration(queueName: string, status: string, durationSeconds: number): void {
    this.messageConsumeDuration.observe({ queue_name: queueName, status }, durationSeconds);
  }

  /**
   * Record queue wait time
   */
  recordQueueWaitTime(queueName: string, durationSeconds: number): void {
    this.queueWaitTime.observe({ queue_name: queueName }, durationSeconds);
  }

  /**
   * Record channel operation duration
   */
  recordChannelOperationDuration(operation: string, durationSeconds: number): void {
    this.channelOperationDuration.observe({ operation }, durationSeconds);
  }

  /**
   * Record message processing latency
   */
  recordMessageProcessingLatency(
    messageType: string,
    status: string,
    durationSeconds: number
  ): void {
    this.messageProcessingLatency.observe({ message_type: messageType, status }, durationSeconds);
  }

  /**
   * Record queue latency quantiles
   */
  recordQueueLatencyQuantiles(queueName: string, durationSeconds: number): void {
    this.queueLatencyQuantiles.observe({ queue_name: queueName }, durationSeconds);
  }

  // ============================================
  // PERFORMANCE METRICS - Recording Methods
  // ============================================

  /**
   * Record cache hit
   */
  recordCacheHit(cacheName: string = 'redis', keyPattern: string = 'default'): void {
    this.cacheHitsTotal.inc({ cache_name: cacheName, key_pattern: keyPattern });
  }

  /**
   * Record cache miss
   */
  recordCacheMiss(cacheName: string = 'redis', keyPattern: string = 'default'): void {
    this.cacheMissesTotal.inc({ cache_name: cacheName, key_pattern: keyPattern });
  }

  /**
   * Record cache eviction
   */
  recordCacheEviction(cacheName: string = 'redis', evictionReason: string): void {
    this.cacheEvictionsTotal.inc({ cache_name: cacheName, eviction_reason: evictionReason });
  }

  /**
   * Record connection pool timeout
   */
  recordConnectionPoolTimeout(poolName: string): void {
    this.connectionPoolTimeoutsTotal.inc({ pool_name: poolName });
  }

  /**
   * Record GC event
   */
  recordGcEvent(gcType: string): void {
    this.gcEventsTotal.inc({ gc_type: gcType });
  }

  /**
   * Set cache hit rate
   */
  setCacheHitRate(cacheName: string, rate: number): void {
    this.cacheHitRate.set({ cache_name: cacheName }, rate);
  }

  /**
   * Set connection pool wait time
   */
  setConnectionPoolWaitTime(poolName: string, milliseconds: number): void {
    this.connectionPoolWaitTime.set({ pool_name: poolName }, milliseconds);
  }

  /**
   * Set batch processing size
   */
  setBatchProcessingSize(batchType: string, size: number): void {
    this.batchProcessingSize.set({ batch_type: batchType }, size);
  }

  /**
   * Set event loop utilization
   */
  setEventLoopUtilization(utilization: number): void {
    this.eventLoopUtilization.set(utilization);
  }

  /**
   * Set compression ratio
   */
  setCompressionRatio(compressionType: string, ratio: number): void {
    this.compressionRatio.set({ compression_type: compressionType }, ratio);
  }

  /**
   * Set payload size
   */
  setPayloadSize(payloadType: string, bytes: number): void {
    this.payloadSizeBytes.set({ payload_type: payloadType }, bytes);
  }

  /**
   * Set node active handles
   */
  setNodeActiveHandles(count: number): void {
    this.nodeActiveHandles.set(count);
  }

  /**
   * Set node active requests
   */
  setNodeActiveRequests(count: number): void {
    this.nodeActiveRequests.set(count);
  }

  /**
   * Set node event loop lag
   */
  setNodeEventLoopLag(lagMs: number): void {
    this.nodeEventLoopLag.set(lagMs);
  }

  /**
   * Set memory pool utilization
   */
  setMemoryPoolUtilization(poolName: string, utilization: number): void {
    this.memoryPoolUtilization.set({ pool_name: poolName }, utilization);
  }

  /**
   * Record batch processing duration
   */
  recordBatchProcessingDuration(batchType: string, status: string, durationSeconds: number): void {
    this.batchProcessingDuration.observe({ batch_type: batchType, status }, durationSeconds);
  }

  /**
   * Record GC pause time
   */
  recordGcPauseTime(gcType: string, durationSeconds: number): void {
    this.gcPauseTime.observe({ gc_type: gcType }, durationSeconds);
  }

  /**
   * Record connection pool acquisition time
   */
  recordConnectionPoolAcquisitionTime(poolName: string, durationSeconds: number): void {
    this.connectionPoolAcquisitionTime.observe({ pool_name: poolName }, durationSeconds);
  }

  /**
   * Record cache operation duration
   */
  recordCacheOperationDuration(
    cacheName: string,
    operation: string,
    durationSeconds: number
  ): void {
    this.cacheOperationDuration.observe({ cache_name: cacheName, operation }, durationSeconds);
  }

  /**
   * Record serialization duration
   */
  recordSerializationDuration(format: string, operation: string, durationSeconds: number): void {
    this.serializationDuration.observe({ format, operation }, durationSeconds);
  }

  // ============================================
  // DATABASE METRICS - Recording Methods
  // ============================================

  /**
   * Record database deadlock
   */
  recordDatabaseDeadlock(table: string): void {
    this.databaseDeadlocksTotal.inc({ table });
  }

  /**
   * Record database commit
   */
  recordDatabaseCommit(transactionType: string = 'default'): void {
    this.databaseCommitsTotal.inc({ transaction_type: transactionType });
  }

  /**
   * Record database rollback
   */
  recordDatabaseRollback(reason: string): void {
    this.databaseRollbacksTotal.inc({ reason });
  }

  /**
   * Record database checkpoint
   */
  recordDatabaseCheckpoint(checkpointType: string): void {
    this.databaseCheckpointsTotal.inc({ checkpoint_type: checkpointType });
  }

  /**
   * Record database sequential scan
   */
  recordDatabaseSeqScan(table: string): void {
    this.databaseSeqScansTotal.inc({ table });
  }

  /**
   * Set index hit ratio
   */
  setIndexHitRatio(table: string, ratio: number): void {
    this.indexHitRatio.set({ table }, ratio);
  }

  /**
   * Set buffer cache hit ratio
   */
  setBufferCacheHitRatio(ratio: number): void {
    this.bufferCacheHitRatio.set(ratio);
  }

  /**
   * Set replication lag
   */
  setReplicationLag(replicaName: string, lagMs: number): void {
    this.replicationLag.set({ replica_name: replicaName }, lagMs);
  }

  /**
   * Set active transactions
   */
  setActiveTransactions(transactionType: string, count: number): void {
    this.activeTransactions.set({ transaction_type: transactionType }, count);
  }

  /**
   * Set lock wait count
   */
  setLockWaitCount(lockType: string, count: number): void {
    this.lockWaitCount.set({ lock_type: lockType }, count);
  }

  /**
   * Set database table size
   */
  setDatabaseTableSize(table: string, bytes: number): void {
    this.databaseTableSize.set({ table }, bytes);
  }

  /**
   * Set database index size
   */
  setDatabaseIndexSize(table: string, indexName: string, bytes: number): void {
    this.databaseIndexSize.set({ table, index_name: indexName }, bytes);
  }

  /**
   * Set database row estimates
   */
  setDatabaseRowEstimates(table: string, count: number): void {
    this.databaseRowEstimates.set({ table }, count);
  }

  /**
   * Set database connection age
   */
  setDatabaseConnectionAge(connectionId: string, ageSeconds: number): void {
    this.databaseConnectionAge.set({ connection_id: connectionId }, ageSeconds);
  }

  /**
   * Set database query queue length
   */
  setDatabaseQueryQueueLength(length: number): void {
    this.databaseQueryQueueLength.set(length);
  }

  /**
   * Record transaction duration
   */
  recordTransactionDuration(
    transactionType: string,
    status: string,
    durationSeconds: number
  ): void {
    this.transactionDuration.observe(
      { transaction_type: transactionType, status },
      durationSeconds
    );
  }

  /**
   * Record lock wait time
   */
  recordLockWaitTime(lockType: string, table: string, durationSeconds: number): void {
    this.lockWaitTime.observe({ lock_type: lockType, table }, durationSeconds);
  }

  /**
   * Record checkpoint duration
   */
  recordCheckpointDuration(checkpointType: string, durationSeconds: number): void {
    this.checkpointDuration.observe({ checkpoint_type: checkpointType }, durationSeconds);
  }

  /**
   * Record connection establishment time
   */
  recordConnectionEstablishmentTime(poolName: string, durationSeconds: number): void {
    this.connectionEstablishmentTime.observe({ pool_name: poolName }, durationSeconds);
  }

  /**
   * Record query planning time
   */
  recordQueryPlanningTime(queryType: string, durationSeconds: number): void {
    this.queryPlanningTime.observe({ query_type: queryType }, durationSeconds);
  }

  /**
   * Record database query quantiles
   */
  recordDatabaseQueryQuantiles(queryType: string, table: string, durationSeconds: number): void {
    this.databaseQueryQuantiles.observe({ query_type: queryType, table }, durationSeconds);
  }

  // ============================================
  // HTTP CLIENT METRICS - Recording Methods
  // ============================================

  /**
   * Record HTTP client retry
   */
  recordHttpClientRetry(host: string, method: string, statusCode: number): void {
    this.httpClientRetriesTotal.inc({ host, method, status_code: statusCode.toString() });
  }

  /**
   * Record HTTP client timeout
   */
  recordHttpClientTimeout(host: string, method: string, timeoutType: string): void {
    this.httpClientTimeoutsTotal.inc({ host, method, timeout_type: timeoutType });
  }

  /**
   * Record HTTP connection reuse
   */
  recordHttpConnectionReuse(host: string): void {
    this.httpConnectionReuseTotal.inc({ host });
  }

  /**
   * Record HTTP DNS lookup
   */
  recordHttpDnsLookup(host: string, status: string): void {
    this.httpDnsLookupsTotal.inc({ host, status });
  }

  /**
   * Record HTTP TLS handshake
   */
  recordHttpTlsHandshake(host: string, tlsVersion: string): void {
    this.httpTlsHandshakesTotal.inc({ host, tls_version: tlsVersion });
  }

  /**
   * Record HTTP request duration
   */
  recordHttpRequestDuration(
    host: string,
    method: string,
    statusCode: number,
    durationSeconds: number
  ): void {
    this.httpRequestDuration.observe(
      { host, method, status_code: statusCode.toString() },
      durationSeconds
    );
  }

  /**
   * Record DNS lookup duration
   */
  recordDnsLookupDuration(host: string, durationSeconds: number): void {
    this.dnsLookupDuration.observe({ host }, durationSeconds);
  }

  /**
   * Record TLS handshake duration
   */
  recordTlsHandshakeDuration(host: string, tlsVersion: string, durationSeconds: number): void {
    this.tlsHandshakeDuration.observe({ host, tls_version: tlsVersion }, durationSeconds);
  }

  /**
   * Record HTTP request size
   */
  recordHttpRequestSize(host: string, method: string, bytes: number): void {
    this.httpRequestSize.observe({ host, method }, bytes);
  }

  /**
   * Record HTTP response size
   */
  recordHttpResponseSize(host: string, method: string, statusCode: number, bytes: number): void {
    this.httpResponseSize.observe({ host, method, status_code: statusCode.toString() }, bytes);
  }

  /**
   * Record HTTP client latency quantiles
   */
  recordHttpClientLatencyQuantiles(host: string, method: string, durationSeconds: number): void {
    this.httpClientLatencyQuantiles.observe({ host, method }, durationSeconds);
  }

  // ============================================
  // SYSTEM METRICS - Recording Methods
  // ============================================

  /**
   * Set process open file descriptors
   */
  setProcessOpenFileDescriptors(count: number): void {
    this.processOpenFileDescriptors.set(count);
  }

  /**
   * Set process max file descriptors
   */
  setProcessMaxFileDescriptors(count: number): void {
    this.processMaxFileDescriptors.set(count);
  }

  /**
   * Set process start time
   */
  setProcessStartTime(timestamp: number): void {
    this.processStartTime.set(timestamp);
  }

  /**
   * Set process uptime
   */
  setProcessUptimeSeconds(seconds: number): void {
    this.processUptimeSeconds.set(seconds);
  }

  /**
   * Set V8 heap space size
   */
  setV8HeapSpaceSize(spaceName: string, bytes: number): void {
    this.v8HeapSpaceSize.set({ space_name: spaceName }, bytes);
  }

  /**
   * Set V8 heap statistics
   */
  setV8HeapStatistics(statisticName: string, value: number): void {
    this.v8HeapStatistics.set({ statistic_name: statisticName }, value);
  }

  /**
   * Set V8 external memory
   */
  setV8ExternalMemory(bytes: number): void {
    this.v8ExternalMemory.set(bytes);
  }

  /**
   * Set system load average
   */
  setSystemLoadAverage(interval: string, value: number): void {
    this.systemLoadAverage.set({ interval }, value);
  }

  /**
   * Set system free memory
   */
  setSystemFreeMemory(bytes: number): void {
    this.systemFreeMemory.set(bytes);
  }

  /**
   * Set system total memory
   */
  setSystemTotalMemory(bytes: number): void {
    this.systemTotalMemory.set(bytes);
  }

  /**
   * Record API response quantiles
   */
  recordApiResponseQuantiles(method: string, path: string, durationSeconds: number): void {
    this.apiResponseQuantiles.observe({ method, path }, durationSeconds);
  }

  // ============================================
  // SCHEDULER METRICS - Recording Methods
  // ============================================

  /**
   * Record scheduler job skipped (due to overlap or other reasons)
   */
  recordSchedulerJobSkipped(jobType: string, skipReason: string): void {
    this.schedulerJobsSkippedTotal.inc({ job_type: jobType, skip_reason: skipReason });
  }

  /**
   * Record scheduler job failure
   */
  recordSchedulerJobFailure(jobType: string, failureReason: string): void {
    this.schedulerJobFailuresTotal.inc({ job_type: jobType, failure_reason: failureReason });
  }

  /**
   * Record scheduler job scheduled
   */
  recordSchedulerJobScheduled(jobType: string): void {
    this.schedulerJobsScheduledTotal.inc({ job_type: jobType });
  }

  /**
   * Record scheduler job executed
   */
  recordSchedulerJobExecuted(jobType: string, status: string): void {
    this.schedulerJobsExecutedTotal.inc({ job_type: jobType, status });
  }

  /**
   * Record scheduler job cancellation
   */
  recordSchedulerJobCancellation(jobType: string, reason: string): void {
    this.schedulerJobCancellationsTotal.inc({ job_type: jobType, reason });
  }

  /**
   * Record scheduler job timeout
   */
  recordSchedulerJobTimeout(jobType: string): void {
    this.schedulerJobTimeoutsTotal.inc({ job_type: jobType });
  }

  /**
   * Record scheduler recovery event
   */
  recordSchedulerRecoveryEvent(recoveryType: string, status: string): void {
    this.schedulerRecoveryEventsTotal.inc({ recovery_type: recoveryType, status });
  }

  /**
   * Record scheduler missed execution
   */
  recordSchedulerMissedExecution(jobType: string, reason: string): void {
    this.schedulerMissedExecutionsTotal.inc({ job_type: jobType, reason });
  }

  /**
   * Record scheduler job retry
   */
  recordSchedulerJobRetry(jobType: string, retryCount: number): void {
    this.schedulerJobRetriesTotal.inc({ job_type: jobType, retry_count: retryCount.toString() });
  }

  /**
   * Record scheduler cron parse error
   */
  recordSchedulerCronParseError(cronExpression: string): void {
    this.schedulerCronParseErrorsTotal.inc({ cron_expression: cronExpression });
  }

  /**
   * Record birthday scan completion
   */
  recordBirthdayScanCompletion(timezone: string, status: string): void {
    this.birthdayScanCompletionsTotal.inc({ timezone, status });
  }

  /**
   * Record birthday scan error
   */
  recordBirthdayScanError(timezone: string, errorType: string): void {
    this.birthdayScanErrorsTotal.inc({ timezone, error_type: errorType });
  }

  /**
   * Record timezone processing completion
   */
  recordTimezoneProcessingCompletion(timezone: string, messageType: string): void {
    this.timezoneProcessingCompletionsTotal.inc({ timezone, message_type: messageType });
  }

  /**
   * Record scheduled message dispatch
   */
  recordScheduledMessageDispatch(messageType: string, status: string): void {
    this.scheduledMessageDispatchesTotal.inc({ message_type: messageType, status });
  }

  /**
   * Record scheduler health check
   */
  recordSchedulerHealthCheck(jobType: string, status: string): void {
    this.schedulerHealthChecksTotal.inc({ job_type: jobType, status });
  }

  // ============================================
  // API ERROR METRICS - Recording Methods
  // ============================================

  /**
   * Record API validation error
   */
  recordApiValidationError(endpoint: string, errorType: string): void {
    this.apiValidationErrorsTotal.inc({ endpoint, error_type: errorType });
  }

  /**
   * Record external API error
   */
  recordExternalApiError(apiName: string, method: string, errorType: string): void {
    // Use the correct label names matching the counter definition
    this.apiErrorsTotal.inc({ endpoint: apiName, method, error_code: errorType });
  }

  /**
   * Record circuit breaker trip
   */
  recordCircuitBreakerTrip(service: string, endpoint: string): void {
    this.apiCircuitBreakerTripsTotal.inc({ service, endpoint });
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
        String(metric.type) === 'counter'
      ) {
        result.scheduledTotal = metric.values.reduce((sum, v) => sum + (v.value as number), 0);
      } else if (
        metric.name === 'birthday_scheduler_messages_sent_total' &&
        String(metric.type) === 'counter'
      ) {
        result.sentTotal = metric.values.reduce((sum, v) => sum + (v.value as number), 0);
      } else if (
        metric.name === 'birthday_scheduler_messages_failed_total' &&
        String(metric.type) === 'counter'
      ) {
        result.failedTotal = metric.values.reduce((sum, v) => sum + (v.value as number), 0);
      } else if (
        metric.name === 'birthday_scheduler_api_requests_total' &&
        String(metric.type) === 'counter'
      ) {
        result.apiRequestsTotal = metric.values.reduce((sum, v) => sum + (v.value as number), 0);
      } else if (
        metric.name === 'birthday_scheduler_queue_depth' &&
        String(metric.type) === 'gauge'
      ) {
        for (const value of metric.values) {
          const queueName = value.labels.queue_name as string;
          result.queueDepth[queueName] = value.value as number;
        }
      } else if (
        metric.name === 'birthday_scheduler_active_workers' &&
        String(metric.type) === 'gauge'
      ) {
        for (const value of metric.values) {
          const workerType = value.labels.worker_type as string;
          result.activeWorkers[workerType] = value.value as number;
        }
      } else if (
        metric.name === 'birthday_scheduler_circuit_breaker_open' &&
        String(metric.type) === 'gauge'
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
