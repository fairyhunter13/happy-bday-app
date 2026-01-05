/**
 * Generate OpenAPI Specification
 *
 * This script generates the OpenAPI spec without starting
 * the full server or connecting to external services.
 */

import Fastify from 'fastify';
import fastifySwagger from '@fastify/swagger';
import { writeFileSync, mkdirSync } from 'fs';
import { dirname } from 'path';

// Schema definitions
const schemas = {
  User: {
    $id: 'User',
    type: 'object',
    properties: {
      id: { type: 'string', format: 'uuid' },
      firstName: { type: 'string' },
      lastName: { type: 'string' },
      email: { type: 'string', format: 'email' },
      timezone: { type: 'string', examples: ['America/New_York'] },
      birthdayDate: { type: 'string', format: 'date-time', nullable: true },
      anniversaryDate: { type: 'string', format: 'date-time', nullable: true },
      locationCity: { type: 'string', nullable: true },
      locationCountry: { type: 'string', nullable: true },
      createdAt: { type: 'string', format: 'date-time' },
      updatedAt: { type: 'string', format: 'date-time' },
    },
  },
  CreateUserRequest: {
    $id: 'CreateUserRequest',
    type: 'object',
    required: ['firstName', 'lastName', 'email', 'timezone'],
    properties: {
      firstName: { type: 'string', minLength: 1, maxLength: 100 },
      lastName: { type: 'string', minLength: 1, maxLength: 100 },
      email: { type: 'string', format: 'email' },
      timezone: { type: 'string', examples: ['America/New_York'] },
      birthdayDate: { type: 'string', format: 'date-time' },
      anniversaryDate: { type: 'string', format: 'date-time' },
      locationCity: { type: 'string', maxLength: 100 },
      locationCountry: { type: 'string', maxLength: 100 },
    },
  },
  UpdateUserRequest: {
    $id: 'UpdateUserRequest',
    type: 'object',
    properties: {
      firstName: { type: 'string', minLength: 1, maxLength: 100 },
      lastName: { type: 'string', minLength: 1, maxLength: 100 },
      email: { type: 'string', format: 'email' },
      timezone: { type: 'string', examples: ['America/New_York'] },
      birthdayDate: { type: 'string', format: 'date-time', nullable: true },
      anniversaryDate: { type: 'string', format: 'date-time', nullable: true },
      locationCity: { type: 'string', maxLength: 100, nullable: true },
      locationCountry: { type: 'string', maxLength: 100, nullable: true },
    },
  },
  HealthResponse: {
    $id: 'HealthResponse',
    type: 'object',
    properties: {
      status: { type: 'string', enum: ['healthy', 'unhealthy'] },
      timestamp: { type: 'string', format: 'date-time' },
      uptime: { type: 'number' },
      version: { type: 'string' },
    },
  },
  ErrorResponse: {
    $id: 'ErrorResponse',
    type: 'object',
    properties: {
      success: { type: 'boolean', examples: [false] },
      error: {
        type: 'object',
        properties: {
          code: { type: 'string' },
          message: { type: 'string' },
          details: { type: 'object' },
        },
      },
    },
  },
  SuccessResponse: {
    $id: 'SuccessResponse',
    type: 'object',
    properties: {
      success: { type: 'boolean', examples: [true] },
      data: { type: 'object' },
      meta: {
        type: 'object',
        properties: {
          timestamp: { type: 'string', format: 'date-time' },
          requestId: { type: 'string' },
        },
      },
    },
  },
};

async function generateOpenAPISpec() {
  const app = Fastify({ logger: false });

  // Register Swagger with OpenAPI configuration
  await app.register(fastifySwagger, {
    openapi: {
      openapi: '3.0.3',
      info: {
        title: 'Birthday Message Scheduler API',
        description: `
## Overview
Production-ready API for scheduling birthday and anniversary messages with timezone support.

## Features
- **User Management**: CRUD operations for users with timezone support
- **Message Scheduling**: Automatic message scheduling based on user timezone (at 9am local time)
- **Health Monitoring**: System health and readiness endpoints
- **Prometheus Metrics**: Production-ready observability and monitoring
- **Redis Caching**: High-performance caching for improved response times

## Architecture

| Component | Technology | Purpose |
|-----------|------------|---------|
| **Database** | PostgreSQL + Drizzle ORM | Persistent data storage |
| **Queue** | RabbitMQ | Message processing and delivery |
| **Cache** | Redis | High-performance caching |
| **Scheduler** | CRON-based | Timezone-aware scheduling |

## Caching Strategy

This API uses Redis caching to improve performance and reduce database load:

### Cached Data

| Data | TTL | Key Pattern |
|------|-----|-------------|
| User by ID | 1 hour | \`user:v1:{id}\` |
| User by Email | 1 hour | \`user:email:v1:{email}\` |
| Birthdays Today | Until midnight | \`birthdays:today:v1\` |
| Anniversaries Today | Until midnight | \`anniversaries:today:v1\` |

### Cache Behavior

- **GET requests**: Served from cache when available (eventual consistency)
- **POST requests**: Cache warmed after creation for faster subsequent reads
- **PUT/DELETE requests**: Cache invalidated after modification to ensure consistency
- **Graceful degradation**: API works without Redis (cache is optional)

### Consistency Models

- **Strong consistency**: Write operations always hit the database
- **Eventual consistency**: Read operations may return cached data (up to 1 hour stale)
- **Weak consistency**: Daily lists (birthdays/anniversaries) refresh at midnight UTC
        `.trim(),
        version: '1.0.0',
        contact: {
          name: 'API Support',
          email: 'support@example.com',
        },
        license: {
          name: 'MIT',
          url: 'https://opensource.org/licenses/MIT',
        },
      },
      servers: [
        {
          url: 'http://localhost:3000',
          description: 'Development server',
        },
        {
          url: 'https://api.example.com',
          description: 'Production server',
        },
      ],
      tags: [
        { name: 'health', description: 'Health check endpoints for monitoring and orchestration' },
        { name: 'metrics', description: 'Prometheus metrics endpoints for observability' },
        { name: 'users', description: 'User management operations (CRUD)' },
      ],
    },
  });

  // Add schemas to Fastify
  for (const [, schema] of Object.entries(schemas)) {
    app.addSchema(schema);
  }

  // Health routes
  app.get('/health', {
    schema: {
      tags: ['health'],
      summary: 'Health check',
      description: 'Check if the service is running',
      response: {
        200: { $ref: 'HealthResponse#' },
      },
    },
    handler: async () => ({}),
  });

  app.get('/ready', {
    schema: {
      tags: ['health'],
      summary: 'Readiness check',
      description: 'Check if the service is ready to accept requests',
      response: {
        200: { $ref: 'HealthResponse#' },
        503: { $ref: 'ErrorResponse#' },
      },
    },
    handler: async () => ({}),
  });

  app.get('/live', {
    schema: {
      tags: ['health'],
      summary: 'Liveness check',
      description: 'Kubernetes liveness probe - checks if the service is alive',
      response: {
        200: { $ref: 'HealthResponse#' },
      },
    },
    handler: async () => ({}),
  });

  app.get('/health/schedulers', {
    schema: {
      tags: ['health'],
      summary: 'Scheduler health check',
      description: 'Check the health status of all CRON schedulers',
      response: {
        200: { $ref: 'SuccessResponse#' },
      },
    },
    handler: async () => ({}),
  });

  // Metrics routes
  app.get('/metrics', {
    schema: {
      tags: ['metrics'],
      summary: 'Prometheus metrics',
      description: 'Get Prometheus-formatted metrics for monitoring',
      response: {
        200: {
          type: 'string',
          description: 'Prometheus text format metrics',
        },
      },
    },
    handler: async () => ({}),
  });

  app.get('/metrics/summary', {
    schema: {
      tags: ['metrics'],
      summary: 'Metrics summary',
      description: 'Get a JSON summary of all metrics for debugging',
      response: {
        200: { $ref: 'SuccessResponse#' },
      },
    },
    handler: async () => ({}),
  });

  // User routes
  app.post('/api/v1/users', {
    schema: {
      tags: ['users'],
      summary: 'Create a new user',
      description:
        "Create a new user with timezone support. The system will automatically schedule birthday and anniversary messages at 9am in the user's local timezone. Cache is warmed after successful creation for faster subsequent reads.",
      body: { $ref: 'CreateUserRequest#' },
      response: {
        201: { $ref: 'SuccessResponse#' },
        400: { $ref: 'ErrorResponse#' },
        409: { $ref: 'ErrorResponse#' },
      },
    },
    handler: async () => ({}),
  });

  app.get('/api/v1/users/:id', {
    schema: {
      tags: ['users'],
      summary: 'Get user by ID',
      description:
        'Retrieve a specific user by their UUID. Results may be served from cache (up to 1 hour stale).',
      params: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
        },
        required: ['id'],
      },
      response: {
        200: { $ref: 'SuccessResponse#' },
        404: { $ref: 'ErrorResponse#' },
      },
    },
    handler: async () => ({}),
  });

  app.put('/api/v1/users/:id', {
    schema: {
      tags: ['users'],
      summary: 'Update user',
      description:
        'Update an existing user. If birthday or anniversary date is changed, the system will automatically reschedule the corresponding messages. Cache is invalidated after update to ensure consistency.',
      params: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
        },
        required: ['id'],
      },
      body: { $ref: 'UpdateUserRequest#' },
      response: {
        200: { $ref: 'SuccessResponse#' },
        400: { $ref: 'ErrorResponse#' },
        404: { $ref: 'ErrorResponse#' },
        409: { $ref: 'ErrorResponse#' },
      },
    },
    handler: async () => ({}),
  });

  app.delete('/api/v1/users/:id', {
    schema: {
      tags: ['users'],
      summary: 'Delete user',
      description:
        'Soft delete a user. The user record is marked as deleted but retained in the database. Any pending messages for this user will be cancelled. Cache is invalidated after deletion.',
      params: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
        },
        required: ['id'],
      },
      response: {
        200: { $ref: 'SuccessResponse#' },
        404: { $ref: 'ErrorResponse#' },
      },
    },
    handler: async () => ({}),
  });

  // Generate the spec
  await app.ready();
  const spec = app.swagger();

  // Ensure docs directory exists
  const outputPath = 'docs/openapi.json';
  mkdirSync(dirname(outputPath), { recursive: true });

  // Write the spec
  writeFileSync(outputPath, JSON.stringify(spec, null, 2));
  console.log(`OpenAPI spec generated: ${outputPath}`);

  await app.close();
}

generateOpenAPISpec().catch((error) => {
  console.error('Failed to generate OpenAPI spec:', error);
  process.exit(1);
});
