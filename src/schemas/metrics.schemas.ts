/**
 * Metrics API Schemas
 *
 * OpenAPI 3.1 schemas for Prometheus metrics endpoints.
 */

/**
 * Prometheus metrics text format schema
 */
export const PrometheusMetricsSchema = {
  type: 'string',
  description: 'Prometheus metrics in exposition format (text/plain)',
  example: `# HELP http_requests_total Total number of HTTP requests
# TYPE http_requests_total counter
http_requests_total{method="GET",route="/api/v1/users",status="200"} 1234
http_requests_total{method="POST",route="/api/v1/users",status="201"} 567

# HELP http_request_duration_seconds HTTP request duration in seconds
# TYPE http_request_duration_seconds histogram
http_request_duration_seconds_bucket{le="0.005"} 100
http_request_duration_seconds_bucket{le="0.01"} 250
http_request_duration_seconds_bucket{le="0.025"} 450
http_request_duration_seconds_bucket{le="+Inf"} 500
http_request_duration_seconds_sum 12.5
http_request_duration_seconds_count 500

# HELP db_connections_active Active database connections
# TYPE db_connections_active gauge
db_connections_active 10

# HELP messages_sent_total Total messages sent
# TYPE messages_sent_total counter
messages_sent_total{type="birthday"} 1000
messages_sent_total{type="anniversary"} 500

# HELP scheduler_runs_total Total scheduler runs
# TYPE scheduler_runs_total counter
scheduler_runs_total{scheduler="daily-birthday-scheduler"} 100
scheduler_runs_total{scheduler="minute-enqueue-scheduler"} 3600`,
} as const;

/**
 * Metrics summary JSON response schema
 * Matches the structure returned by metricsService.getMetricValues()
 */
export const MetricsSummarySchema = {
  type: 'object',
  properties: {
    scheduledTotal: {
      type: 'number',
      description: 'Total messages scheduled',
      example: 100,
    },
    sentTotal: {
      type: 'number',
      description: 'Total messages sent',
      example: 95,
    },
    failedTotal: {
      type: 'number',
      description: 'Total messages failed',
      example: 5,
    },
    apiRequestsTotal: {
      type: 'number',
      description: 'Total API requests',
      example: 1000,
    },
    queueDepth: {
      type: 'object',
      description: 'Queue depth by queue name',
      additionalProperties: {
        type: 'number',
      },
      example: {
        birthday_messages: 150,
      },
    },
    activeWorkers: {
      type: 'object',
      description: 'Active workers by worker type',
      additionalProperties: {
        type: 'number',
      },
      example: {
        message_consumer: 5,
      },
    },
    circuitBreakerStatus: {
      type: 'object',
      description: 'Circuit breaker status by service name (0=closed, 1=open)',
      additionalProperties: {
        type: 'number',
      },
      example: {
        message_api: 0,
      },
    },
  },
  examples: [
    {
      summary: 'Metrics summary',
      value: {
        scheduledTotal: 100,
        sentTotal: 95,
        failedTotal: 5,
        apiRequestsTotal: 1000,
        queueDepth: {
          birthday_messages: 150,
        },
        activeWorkers: {
          message_consumer: 5,
        },
        circuitBreakerStatus: {
          message_api: 0,
        },
      },
    },
  ],
} as const;

/**
 * Metrics summary success response
 */
export const MetricsSummaryResponseSchema = {
  type: 'object',
  required: ['success', 'data', 'timestamp'],
  properties: {
    success: {
      type: 'boolean',
      example: true,
    },
    data: MetricsSummarySchema,
    timestamp: {
      type: 'string',
      format: 'date-time',
      example: '2025-12-30T10:30:00.000Z',
    },
  },
} as const;

// Export route schemas
export const PrometheusMetricsRouteSchema = {
  tags: ['Metrics'],
  summary: 'Get Prometheus metrics',
  description: `Prometheus metrics endpoint in exposition format for scraping.

**Metrics Included:**
- \`http_requests_total\` - Total HTTP requests by method, route, and status
- \`http_request_duration_seconds\` - HTTP request duration histogram
- \`db_connections_active\` - Active database connections
- \`messages_sent_total\` - Total messages sent by type
- \`messages_failed_total\` - Failed message deliveries
- \`scheduler_runs_total\` - Scheduler execution counts
- \`scheduler_errors_total\` - Scheduler errors
- \`process_cpu_usage\` - CPU usage percentage
- \`process_memory_bytes\` - Memory usage

**Prometheus Configuration:**
\`\`\`yaml
scrape_configs:
  - job_name: 'birthday-scheduler'
    scrape_interval: 15s
    static_configs:
      - targets: ['localhost:3000']
    metrics_path: '/metrics'
\`\`\`

**No Rate Limit** - Designed for frequent Prometheus scraping`,
  operationId: 'getPrometheusMetrics',
  response: {
    200: {
      description: 'Prometheus metrics in text format',
      content: {
        'text/plain; version=0.0.4': {
          schema: PrometheusMetricsSchema,
        },
      },
    },
  },
} as const;

export const MetricsSummaryRouteSchema = {
  tags: ['Metrics'],
  summary: 'Get metrics summary (JSON)',
  description: `Metrics summary in JSON format for debugging and dashboards.

**Use Cases:**
- Debugging and development
- Custom dashboards
- API monitoring tools

**Note:** For production monitoring, use the \`/metrics\` endpoint with Prometheus.

**No Rate Limit**`,
  operationId: 'getMetricsSummary',
  response: {
    200: {
      description: 'Metrics summary in JSON format',
      content: {
        'application/json': {
          schema: MetricsSummaryResponseSchema,
        },
      },
    },
  },
} as const;
