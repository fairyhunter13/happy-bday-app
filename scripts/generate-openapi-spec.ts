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
  MessageLog: {
    $id: 'MessageLog',
    type: 'object',
    properties: {
      id: { type: 'string', format: 'uuid' },
      userId: { type: 'string', format: 'uuid' },
      messageType: { type: 'string', enum: ['BIRTHDAY', 'ANNIVERSARY'] },
      status: { type: 'string', enum: ['PENDING', 'QUEUED', 'SENT', 'FAILED'] },
      scheduledSendTime: { type: 'string', format: 'date-time' },
      sentAt: { type: 'string', format: 'date-time', nullable: true },
      messageContent: { type: 'string', nullable: true },
      retryCount: { type: 'integer' },
      errorMessage: { type: 'string', nullable: true },
      createdAt: { type: 'string', format: 'date-time' },
      updatedAt: { type: 'string', format: 'date-time' },
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
  PaginatedResponse: {
    $id: 'PaginatedResponse',
    type: 'object',
    properties: {
      success: { type: 'boolean', examples: [true] },
      data: { type: 'array', items: { type: 'object' } },
      meta: {
        type: 'object',
        properties: {
          total: { type: 'integer' },
          page: { type: 'integer' },
          limit: { type: 'integer' },
          totalPages: { type: 'integer' },
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
- **Message Scheduling**: Automatic message scheduling based on user timezone
- **Message Logs**: Track all scheduled and sent messages
- **Health Monitoring**: System health and readiness endpoints

## Architecture
- **Database**: PostgreSQL with Drizzle ORM
- **Queue**: RabbitMQ for message processing
- **Scheduler**: CRON-based scheduling with timezone awareness
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
        { name: 'health', description: 'Health check endpoints' },
        { name: 'users', description: 'User management operations' },
        { name: 'messages', description: 'Message log operations' },
        { name: 'scheduler', description: 'Scheduler operations' },
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

  // User routes
  app.post('/api/v1/users', {
    schema: {
      tags: ['users'],
      summary: 'Create a new user',
      description: 'Create a new user with timezone support',
      body: { $ref: 'CreateUserRequest#' },
      response: {
        201: { $ref: 'SuccessResponse#' },
        400: { $ref: 'ErrorResponse#' },
        409: { $ref: 'ErrorResponse#' },
      },
    },
    handler: async () => ({}),
  });

  app.get('/api/v1/users', {
    schema: {
      tags: ['users'],
      summary: 'List all users',
      description: 'Get a paginated list of users',
      querystring: {
        type: 'object',
        properties: {
          page: { type: 'integer', minimum: 1, default: 1 },
          limit: { type: 'integer', minimum: 1, maximum: 100, default: 20 },
          timezone: { type: 'string' },
        },
      },
      response: {
        200: { $ref: 'PaginatedResponse#' },
      },
    },
    handler: async () => ({}),
  });

  app.get('/api/v1/users/:id', {
    schema: {
      tags: ['users'],
      summary: 'Get user by ID',
      description: 'Retrieve a specific user by their ID',
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
      description: 'Update an existing user',
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
      description: 'Soft delete a user',
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

  // Message log routes
  app.get('/api/v1/messages', {
    schema: {
      tags: ['messages'],
      summary: 'List message logs',
      description: 'Get a paginated list of message logs',
      querystring: {
        type: 'object',
        properties: {
          page: { type: 'integer', minimum: 1, default: 1 },
          limit: { type: 'integer', minimum: 1, maximum: 100, default: 20 },
          status: { type: 'string', enum: ['PENDING', 'QUEUED', 'SENT', 'FAILED'] },
          userId: { type: 'string', format: 'uuid' },
          messageType: { type: 'string', enum: ['BIRTHDAY', 'ANNIVERSARY'] },
        },
      },
      response: {
        200: { $ref: 'PaginatedResponse#' },
      },
    },
    handler: async () => ({}),
  });

  app.get('/api/v1/messages/:id', {
    schema: {
      tags: ['messages'],
      summary: 'Get message log by ID',
      description: 'Retrieve a specific message log by its ID',
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

  // Scheduler routes
  app.get('/api/v1/scheduler/status', {
    schema: {
      tags: ['scheduler'],
      summary: 'Get scheduler status',
      description: 'Check the status of all schedulers',
      response: {
        200: { $ref: 'SuccessResponse#' },
      },
    },
    handler: async () => ({}),
  });

  app.post('/api/v1/scheduler/trigger', {
    schema: {
      tags: ['scheduler'],
      summary: 'Trigger scheduler manually',
      description: 'Manually trigger the message scheduler',
      body: {
        type: 'object',
        properties: {
          type: { type: 'string', enum: ['minute', 'daily'] },
        },
      },
      response: {
        200: { $ref: 'SuccessResponse#' },
        400: { $ref: 'ErrorResponse#' },
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
