/**
 * Metrics API Schemas
 *
 * OpenAPI 3.1 schemas for Prometheus metrics endpoints.
 */

import { SuccessResponseSchema } from './common.schemas.js';

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
 */
export const MetricsSummarySchema = {
  type: 'object',
  properties: {
    http: {
      type: 'object',
      description: 'HTTP request metrics',
      properties: {
        totalRequests: {
          type: 'integer',
          description: 'Total HTTP requests handled',
          example: 10000,
        },
        requestsByMethod: {
          type: 'object',
          description: 'Requests grouped by HTTP method',
          additionalProperties: {
            type: 'integer',
          },
          example: {
            GET: 7000,
            POST: 2000,
            PUT: 800,
            DELETE: 200,
          },
        },
        requestsByStatus: {
          type: 'object',
          description: 'Requests grouped by status code',
          additionalProperties: {
            type: 'integer',
          },
          example: {
            200: 8500,
            201: 1000,
            400: 300,
            404: 100,
            500: 100,
          },
        },
        averageResponseTime: {
          type: 'number',
          description: 'Average response time in milliseconds',
          example: 25.5,
        },
      },
    },
    database: {
      type: 'object',
      description: 'Database connection metrics',
      properties: {
        activeConnections: {
          type: 'integer',
          description: 'Current active database connections',
          example: 10,
        },
        maxConnections: {
          type: 'integer',
          description: 'Maximum allowed connections',
          example: 20,
        },
        totalQueries: {
          type: 'integer',
          description: 'Total database queries executed',
          example: 50000,
        },
      },
    },
    messages: {
      type: 'object',
      description: 'Message sending metrics',
      properties: {
        totalSent: {
          type: 'integer',
          description: 'Total messages sent',
          example: 1500,
        },
        sentByType: {
          type: 'object',
          description: 'Messages sent by type',
          additionalProperties: {
            type: 'integer',
          },
          example: {
            birthday: 1000,
            anniversary: 500,
          },
        },
        failed: {
          type: 'integer',
          description: 'Failed message deliveries',
          example: 50,
        },
        retries: {
          type: 'integer',
          description: 'Message retry attempts',
          example: 75,
        },
      },
    },
    schedulers: {
      type: 'object',
      description: 'Scheduler execution metrics',
      properties: {
        totalRuns: {
          type: 'integer',
          description: 'Total scheduler executions',
          example: 5000,
        },
        runsByScheduler: {
          type: 'object',
          description: 'Runs grouped by scheduler',
          additionalProperties: {
            type: 'integer',
          },
          example: {
            'daily-birthday-scheduler': 100,
            'minute-enqueue-scheduler': 3600,
            'recovery-scheduler': 1000,
            'cron-scheduler': 300,
          },
        },
        errors: {
          type: 'integer',
          description: 'Total scheduler errors',
          example: 10,
        },
      },
    },
    system: {
      type: 'object',
      description: 'System resource metrics',
      properties: {
        uptime: {
          type: 'number',
          description: 'Process uptime in seconds',
          example: 86400,
        },
        memoryUsage: {
          type: 'object',
          properties: {
            heapUsed: {
              type: 'integer',
              description: 'Heap memory used in bytes',
              example: 50000000,
            },
            heapTotal: {
              type: 'integer',
              description: 'Total heap memory in bytes',
              example: 100000000,
            },
            external: {
              type: 'integer',
              description: 'External memory in bytes',
              example: 5000000,
            },
          },
        },
        cpuUsage: {
          type: 'number',
          description: 'CPU usage percentage',
          example: 15.5,
        },
      },
    },
  },
  examples: [
    {
      summary: 'Healthy system metrics',
      value: {
        http: {
          totalRequests: 10000,
          requestsByMethod: {
            GET: 7000,
            POST: 2000,
            PUT: 800,
            DELETE: 200,
          },
          requestsByStatus: {
            200: 8500,
            201: 1000,
            400: 300,
            404: 100,
            500: 100,
          },
          averageResponseTime: 25.5,
        },
        database: {
          activeConnections: 10,
          maxConnections: 20,
          totalQueries: 50000,
        },
        messages: {
          totalSent: 1500,
          sentByType: {
            birthday: 1000,
            anniversary: 500,
          },
          failed: 50,
          retries: 75,
        },
        schedulers: {
          totalRuns: 5000,
          runsByScheduler: {
            'daily-birthday-scheduler': 100,
            'minute-enqueue-scheduler': 3600,
            'recovery-scheduler': 1000,
            'cron-scheduler': 300,
          },
          errors: 10,
        },
        system: {
          uptime: 86400,
          memoryUsage: {
            heapUsed: 50000000,
            heapTotal: 100000000,
            external: 5000000,
          },
          cpuUsage: 15.5,
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
