/**
 * Health Check API Schemas
 *
 * OpenAPI 3.1 schemas for health check endpoints.
 * These endpoints are used by Kubernetes and monitoring systems.
 */

import { ServiceUnavailableSchema, InternalServerErrorSchema } from './error.schemas.js';

/**
 * Service status enum
 */
export const ServiceStatusSchema = {
  type: 'string',
  enum: ['healthy', 'unhealthy'],
  description: 'Health status of a service dependency',
} as const;

/**
 * Overall health status enum
 */
export const HealthStatusSchema = {
  type: 'string',
  enum: ['ok', 'degraded', 'error'],
  description: 'Overall application health status',
} as const;

/**
 * Simple health check response schema (for /health endpoint)
 * Returns basic status without service details
 */
export const SimpleHealthResponseSchema = {
  type: 'object',
  required: ['status', 'timestamp', 'uptime', 'version'],
  properties: {
    status: {
      type: 'string',
      enum: ['ok', 'down'],
      description: 'ok = service running, down = service unavailable',
      example: 'ok',
    },
    timestamp: {
      type: 'string',
      format: 'date-time',
      description: 'Current server timestamp',
      example: '2025-12-30T10:30:00.000Z',
    },
    uptime: {
      type: 'number',
      description: 'Server uptime in seconds',
      example: 3600.5,
    },
    version: {
      type: 'string',
      description: 'Application version',
      example: '1.0.0',
    },
  },
  example: {
    status: 'ok',
    timestamp: '2025-12-30T10:30:00.000Z',
    uptime: 3600.5,
    version: '1.0.0',
  },
} as const;

/**
 * Detailed health check response schema (for /health/detailed endpoint)
 * Returns comprehensive status including all service details
 */
export const HealthResponseSchema = {
  type: 'object',
  required: ['status', 'timestamp', 'uptime', 'version', 'services'],
  properties: {
    status: {
      ...HealthStatusSchema,
      description: 'ok = all services healthy, degraded = some issues, error = critical failure',
      example: 'ok',
    },
    timestamp: {
      type: 'string',
      format: 'date-time',
      description: 'Current server timestamp',
      example: '2025-12-30T10:30:00.000Z',
    },
    uptime: {
      type: 'number',
      description: 'Server uptime in seconds',
      example: 3600.5,
    },
    version: {
      type: 'string',
      description: 'Application version',
      example: '1.0.0',
    },
    services: {
      type: 'object',
      required: ['database', 'rabbitmq'],
      properties: {
        database: {
          ...ServiceStatusSchema,
          description: 'PostgreSQL database connection status',
          example: 'healthy',
        },
        rabbitmq: {
          ...ServiceStatusSchema,
          description: 'RabbitMQ message queue connection status',
          example: 'healthy',
        },
      },
    },
  },
  examples: [
    {
      summary: 'All services healthy',
      value: {
        status: 'ok',
        timestamp: '2025-12-30T10:30:00.000Z',
        uptime: 3600.5,
        version: '1.0.0',
        services: {
          database: 'healthy',
          rabbitmq: 'healthy',
        },
      },
    },
    {
      summary: 'Degraded (RabbitMQ unhealthy)',
      value: {
        status: 'degraded',
        timestamp: '2025-12-30T10:30:00.000Z',
        uptime: 3600.5,
        version: '1.0.0',
        services: {
          database: 'healthy',
          rabbitmq: 'unhealthy',
        },
      },
    },
    {
      summary: 'Error (all services unhealthy)',
      value: {
        status: 'error',
        timestamp: '2025-12-30T10:30:00.000Z',
        uptime: 3600.5,
        version: '1.0.0',
        services: {
          database: 'unhealthy',
          rabbitmq: 'unhealthy',
        },
      },
    },
  ],
} as const;

/**
 * Liveness probe response schema (simple)
 */
export const LivenessResponseSchema = {
  type: 'object',
  required: ['status', 'timestamp'],
  properties: {
    status: {
      type: 'string',
      enum: ['ok'],
      description: 'Always returns ok if server is running',
      example: 'ok',
    },
    timestamp: {
      type: 'string',
      format: 'date-time',
      description: 'Current server timestamp',
      example: '2025-12-30T10:30:00.000Z',
    },
  },
  example: {
    status: 'ok',
    timestamp: '2025-12-30T10:30:00.000Z',
  },
} as const;

/**
 * Readiness probe response schema
 */
export const ReadinessResponseSchema = {
  type: 'object',
  required: ['status', 'timestamp'],
  properties: {
    status: {
      type: 'string',
      enum: ['ready', 'not_ready'],
      description: 'ready if all critical services are healthy',
      example: 'ready',
    },
    timestamp: {
      type: 'string',
      format: 'date-time',
      description: 'Current server timestamp',
      example: '2025-12-30T10:30:00.000Z',
    },
  },
  examples: [
    {
      summary: 'Ready to accept traffic',
      value: {
        status: 'ready',
        timestamp: '2025-12-30T10:30:00.000Z',
      },
    },
    {
      summary: 'Not ready (dependencies unhealthy)',
      value: {
        status: 'not_ready',
        timestamp: '2025-12-30T10:30:00.000Z',
      },
    },
  ],
} as const;

/**
 * Scheduler status object schema
 */
export const SchedulerStatusSchema = {
  type: 'object',
  required: ['name', 'healthy', 'status'],
  properties: {
    name: {
      type: 'string',
      description: 'Scheduler name',
      example: 'daily-birthday-scheduler',
    },
    healthy: {
      type: 'boolean',
      description: 'Whether scheduler is running properly',
      example: true,
    },
    status: {
      type: 'object',
      description: 'Detailed scheduler status information',
      properties: {
        lastRun: {
          type: 'string',
          format: 'date-time',
          nullable: true,
          description: 'Last successful run timestamp',
          example: '2025-12-30T10:00:00.000Z',
        },
        nextRun: {
          type: 'string',
          format: 'date-time',
          nullable: true,
          description: 'Next scheduled run timestamp',
          example: '2025-12-31T10:00:00.000Z',
        },
        runCount: {
          type: 'integer',
          description: 'Total number of runs',
          example: 100,
        },
        errorCount: {
          type: 'integer',
          description: 'Number of failed runs',
          example: 2,
        },
      },
    },
  },
} as const;

/**
 * Scheduler health response schema
 */
export const SchedulerHealthResponseSchema = {
  type: 'object',
  required: ['status', 'timestamp', 'uptime', 'schedulers'],
  properties: {
    status: {
      type: 'string',
      enum: ['ok', 'degraded'],
      description: 'Overall scheduler health status',
      example: 'ok',
    },
    timestamp: {
      type: 'string',
      format: 'date-time',
      description: 'Current timestamp',
      example: '2025-12-30T10:30:00.000Z',
    },
    uptime: {
      type: 'number',
      description: 'Scheduler service uptime in seconds',
      example: 3600.5,
    },
    startTime: {
      type: 'string',
      format: 'date-time',
      nullable: true,
      description: 'When scheduler service started',
      example: '2025-12-30T09:30:00.000Z',
    },
    schedulers: {
      type: 'array',
      items: SchedulerStatusSchema,
      description: 'Status of individual schedulers',
    },
    statistics: {
      type: 'object',
      description: 'Aggregate scheduler statistics',
      properties: {
        totalSchedulers: {
          type: 'integer',
          description: 'Total number of schedulers',
          example: 4,
        },
        healthySchedulers: {
          type: 'integer',
          description: 'Number of healthy schedulers',
          example: 4,
        },
        unhealthySchedulers: {
          type: 'integer',
          description: 'Number of unhealthy schedulers',
          example: 0,
        },
      },
    },
  },
  examples: [
    {
      summary: 'All schedulers healthy',
      value: {
        status: 'ok',
        timestamp: '2025-12-30T10:30:00.000Z',
        uptime: 3600.5,
        startTime: '2025-12-30T09:30:00.000Z',
        schedulers: [
          {
            name: 'daily-birthday-scheduler',
            healthy: true,
            status: {
              lastRun: '2025-12-30T10:00:00.000Z',
              nextRun: '2025-12-31T10:00:00.000Z',
              runCount: 100,
              errorCount: 0,
            },
          },
          {
            name: 'minute-enqueue-scheduler',
            healthy: true,
            status: {
              lastRun: '2025-12-30T10:29:00.000Z',
              nextRun: '2025-12-30T10:30:00.000Z',
              runCount: 3600,
              errorCount: 2,
            },
          },
        ],
        statistics: {
          totalSchedulers: 4,
          healthySchedulers: 4,
          unhealthySchedulers: 0,
        },
      },
    },
    {
      summary: 'One scheduler degraded',
      value: {
        status: 'degraded',
        timestamp: '2025-12-30T10:30:00.000Z',
        uptime: 3600.5,
        startTime: '2025-12-30T09:30:00.000Z',
        schedulers: [
          {
            name: 'daily-birthday-scheduler',
            healthy: false,
            status: {
              lastRun: '2025-12-29T10:00:00.000Z',
              nextRun: null,
              runCount: 99,
              errorCount: 5,
            },
          },
        ],
        statistics: {
          totalSchedulers: 4,
          healthySchedulers: 3,
          unhealthySchedulers: 1,
        },
      },
    },
  ],
} as const;

// Export route schemas
export const HealthRouteSchema = {
  tags: ['health'],
  summary: 'Get application health status',
  description: `Simple health check endpoint for load balancers and basic monitoring.

**Use Cases:**
- Load balancer health checks
- Basic service availability monitoring
- Quick liveness verification

**Status Values:**
- ok: Service is running normally
- down: Service is unavailable

**For detailed service health, use /health/detailed endpoint.**

**No Rate Limit**`,
  operationId: 'getHealth',
  response: {
    200: {
      description: 'Health status retrieved successfully',
      content: {
        'application/json': {
          schema: SimpleHealthResponseSchema,
        },
      },
    },
    500: {
      description: 'Internal Server Error',
      content: {
        'application/json': {
          schema: InternalServerErrorSchema,
        },
      },
    },
  },
} as const;

export const LivenessRouteSchema = {
  tags: ['health'],
  summary: 'Liveness probe (Kubernetes)',
  description: `Simple liveness probe for Kubernetes liveness checks.

**Kubernetes Configuration:**
\`\`\`yaml
livenessProbe:
  httpGet:
    path: /live
    port: 3000
  initialDelaySeconds: 10
  periodSeconds: 10
\`\`\`

**Always returns 200 OK** if the server process is running.

**No Rate Limit**`,
  operationId: 'getLiveness',
  response: {
    200: {
      description: 'Application is alive',
      content: {
        'application/json': {
          schema: LivenessResponseSchema,
        },
      },
    },
  },
} as const;

export const ReadinessRouteSchema = {
  tags: ['health'],
  summary: 'Readiness probe (Kubernetes)',
  description: `Readiness probe for Kubernetes readiness checks.

**Kubernetes Configuration:**
\`\`\`yaml
readinessProbe:
  httpGet:
    path: /ready
    port: 3000
  initialDelaySeconds: 15
  periodSeconds: 5
\`\`\`

**Returns 200 OK** if application is ready to accept traffic (all dependencies healthy).
**Returns 503 Service Unavailable** if dependencies are unhealthy.

**No Rate Limit**`,
  operationId: 'getReadiness',
  response: {
    200: {
      description: 'Application is ready to accept traffic',
      content: {
        'application/json': {
          schema: ReadinessResponseSchema,
        },
      },
    },
    503: {
      description: 'Service Unavailable - Not ready to accept traffic',
      content: {
        'application/json': {
          schema: ServiceUnavailableSchema,
        },
      },
    },
  },
} as const;

export const SchedulerHealthRouteSchema = {
  tags: ['health'],
  summary: 'Get scheduler health status',
  description: `Detailed health information for background schedulers.

**Schedulers Monitored:**
- daily-birthday-scheduler: Schedules daily birthday checks
- minute-enqueue-scheduler: Enqueues messages every minute
- recovery-scheduler: Recovers failed messages
- cron-scheduler: Master scheduler coordinator

**No Rate Limit**`,
  operationId: 'getSchedulerHealth',
  response: {
    200: {
      description: 'Scheduler health status (all schedulers operational)',
      content: {
        'application/json': {
          schema: SchedulerHealthResponseSchema,
        },
      },
    },
    503: {
      description: 'Service Unavailable - One or more schedulers are unhealthy',
      content: {
        'application/json': {
          schema: SchedulerHealthResponseSchema,
        },
      },
    },
  },
} as const;
