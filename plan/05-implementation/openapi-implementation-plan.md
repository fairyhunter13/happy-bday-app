# OpenAPI 3.1 Implementation Plan

**Document Version:** 1.0
**Created:** 2025-12-30
**Project:** Birthday Message Scheduler API
**Status:** Ready for Implementation

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Phase 0: Current State Assessment](#phase-0-current-state-assessment)
3. [Phase 1: Upgrade to OpenAPI 3.1](#phase-1-upgrade-to-openapi-31)
4. [Phase 2: Schema Organization](#phase-2-schema-organization)
5. [Phase 3: Comprehensive Examples](#phase-3-comprehensive-examples)
6. [Phase 4: Error Documentation](#phase-4-error-documentation)
7. [Phase 5: CI/CD Integration](#phase-5-cicd-integration)
8. [Phase 6: Swagger UI Enhancement](#phase-6-swagger-ui-enhancement)
9. [Testing Procedures](#testing-procedures)
10. [Timeline and Resources](#timeline-and-resources)

---

## Executive Summary

### Objective

Enhance the existing OpenAPI documentation for the Birthday Message Scheduler API by upgrading to OpenAPI 3.1, improving schema organization, adding comprehensive examples, documenting error responses following RFC 9457, and integrating validation into the CI/CD pipeline.

### Current State

**Existing Implementation:**
- Fastify with `@fastify/swagger` (v9.4.0)
- Fastify with `@fastify/swagger-ui` (v5.2.0)
- OpenAPI 3.0 specification
- Swagger UI at `/docs`
- 10 documented endpoints across 3 route files

**Endpoints:**
- User Management: POST, GET, PUT, DELETE `/api/v1/users`
- Health Checks: GET `/health`, `/ready`, `/live`, `/health/schedulers`
- Metrics: GET `/metrics`, `/metrics/summary`

### Recommended Approach

**Decision:** Enhance current `@fastify/swagger` implementation (NOT migrate)

**Rationale:**
1. Working code should not be rewritten without strong justification
2. Current approach meets all requirements
3. Quick wins by improving existing schemas
4. Zero migration risk
5. Team familiarity with current patterns

### Success Criteria

- All 10 endpoints have comprehensive OpenAPI 3.1 documentation
- Error responses follow RFC 9457 Problem Details standard
- Reusable schema components eliminate duplication
- Comprehensive examples for all request/response scenarios
- CI/CD validation catches documentation issues before merge
- Improved Swagger UI developer experience

---

## Phase 0: Current State Assessment

**Duration:** 1 day
**Priority:** High

### Objectives

Review the existing Swagger/OpenAPI setup to understand what's working and what needs improvement.

### Current Implementation Analysis

#### File: `src/app.ts`

**Swagger Configuration:**
```typescript
await app.register(swagger, {
  openapi: {
    info: {
      title: 'Birthday Message Scheduler API',
      description: 'Timezone-aware birthday message scheduler backend',
      version: '1.0.0',
    },
    servers: [
      {
        url: `http://${env.HOST}:${env.PORT}`,
        description: 'Development server',
      },
    ],
    tags: [
      { name: 'health', description: 'Health check endpoints' },
      { name: 'users', description: 'User management endpoints' },
      { name: 'Metrics', description: 'Prometheus metrics endpoints' },
    ],
  },
});

await app.register(swaggerUi, {
  routePrefix: '/docs',
  uiConfig: {
    docExpansion: 'list',
    deepLinking: true,
  },
});
```

**Strengths:**
- Basic OpenAPI configuration in place
- Swagger UI accessible at `/docs`
- Tags properly defined for endpoint organization

**Weaknesses:**
- Using OpenAPI 3.0 instead of 3.1
- Minimal API metadata (no contact, license, external docs)
- Single server configuration
- No reusable components defined
- Limited Swagger UI customization

#### File: `src/routes/user.routes.ts`

**Current Schema Pattern:**
```typescript
const userSchema = {
  type: 'object',
  properties: {
    id: { type: 'string', format: 'uuid' },
    firstName: { type: 'string' },
    // ... other fields
  },
};

const createUserSchema = {
  type: 'object',
  required: ['firstName', 'lastName', 'email', 'timezone'],
  properties: {
    firstName: { type: 'string', minLength: 1, maxLength: 100 },
    // ... other fields
  },
};
```

**Issues Identified:**
1. Schema duplication across route files
2. No comprehensive descriptions or examples
3. Limited error response documentation
4. No RFC 9457-compliant error schemas
5. Rate limiting not documented in OpenAPI
6. Missing `operationId` on most endpoints

#### File: `src/routes/health.routes.ts`

**Current Documentation:**
```typescript
fastify.get('/health', {
  schema: {
    description: 'Get application health status',
    tags: ['health'],
    response: {
      200: {
        type: 'object',
        properties: {
          status: { type: 'string', enum: ['ok', 'degraded', 'error'] },
          // ... other fields
        },
      },
    },
  },
});
```

**Issues:**
- No examples in response schemas
- Missing detailed descriptions
- No error response documentation

#### File: `src/routes/metrics.routes.ts`

**Current Documentation:**
```typescript
app.get('/metrics', {
  schema: {
    description: 'Get Prometheus metrics in exposition format',
    tags: ['Metrics'],
    response: {
      200: {
        description: 'Prometheus metrics',
        type: 'string',
      },
    },
  },
});
```

**Issues:**
- No example Prometheus output
- Missing content-type specification
- No description of metrics included

### Assessment Summary

**What's Working:**
- Basic OpenAPI structure in place
- All endpoints have schema definitions
- Swagger UI functional
- Tags properly organized

**What Needs Improvement:**
- Upgrade to OpenAPI 3.1
- Extract reusable schema components
- Add comprehensive examples
- Document error responses (RFC 9457)
- Add rate limiting documentation
- Improve API metadata
- Add CI/CD validation

### Deliverables

- Current state documentation (this section)
- List of endpoints requiring enhancement
- Gap analysis for OpenAPI 3.1 compliance
- Risk assessment (minimal - enhancement only)

---

## Phase 1: Upgrade to OpenAPI 3.1

**Duration:** 2 days
**Priority:** High
**Dependencies:** Phase 0 complete

### Objectives

1. Upgrade OpenAPI specification from 3.0 to 3.1
2. Add comprehensive API metadata
3. Configure multiple server environments
4. Enhance Swagger UI configuration
5. Add external documentation links

### Implementation Steps

#### Step 1.1: Update OpenAPI Version and Metadata

**File:** `src/app.ts`

**Changes:**
```typescript
await app.register(swagger, {
  openapi: {
    openapi: '3.1.0',  // ← Upgraded from 3.0.0
    info: {
      title: 'Birthday Message Scheduler API',
      description: `

# Birthday Message Scheduler API

Timezone-aware birthday message scheduler with support for multiple message types.

## Features

- **Timezone-aware scheduling** - Uses IANA timezone identifiers
- **Multiple message types** - Birthday and anniversary messages
- **Exactly-once delivery** - Idempotent message handling
- **Comprehensive health checks** - Kubernetes-ready probes
- **Prometheus metrics** - Production-ready observability
- **Soft delete support** - Email reuse after deletion

## Rate Limiting

- **User endpoints:** 10-100 requests/minute
- **Health endpoints:** Unlimited
- **Metrics endpoints:** Unlimited

## Authentication

Authentication coming soon. Currently all endpoints are public.
      `,
      version: '1.0.0',
      contact: {
        name: 'API Support Team',
        email: 'api-support@example.com',
        url: 'https://support.example.com',
      },
      license: {
        name: 'MIT',
        url: 'https://opensource.org/licenses/MIT',
      },
      termsOfService: 'https://example.com/terms',
    },
    servers: [
      {
        url: `http://${env.HOST}:${env.PORT}`,
        description: 'Development server',
      },
      {
        url: 'http://localhost:3000',
        description: 'Local development',
      },
      {
        url: 'https://api-staging.example.com',
        description: 'Staging environment',
      },
      {
        url: 'https://api.example.com',
        description: 'Production server',
      },
    ],
    tags: [
      {
        name: 'users',
        description: 'User management operations',
        externalDocs: {
          description: 'User Management Guide',
          url: 'https://docs.example.com/users',
        },
      },
      {
        name: 'health',
        description: 'Health check and readiness probes',
        externalDocs: {
          description: 'Health Check Guide',
          url: 'https://docs.example.com/health',
        },
      },
      {
        name: 'Metrics',
        description: 'Prometheus metrics and observability',
        externalDocs: {
          description: 'Metrics Guide',
          url: 'https://docs.example.com/metrics',
        },
      },
    ],
    externalDocs: {
      description: 'Complete API Documentation',
      url: 'https://docs.example.com',
    },
  },
});
```

#### Step 1.2: Enhance Swagger UI Configuration

**File:** `src/app.ts`

**Changes:**
```typescript
await app.register(swaggerUi, {
  routePrefix: '/docs',
  uiConfig: {
    docExpansion: 'list',           // Expand tag list by default
    deepLinking: true,               // Enable deep linking
    displayOperationId: true,        // Show operation IDs
    displayRequestDuration: true,    // Show request timing
    filter: true,                    // Enable search filter
    showExtensions: true,            // Show x-* extensions
    tryItOutEnabled: true,           // Enable "Try it out" by default
    persistAuthorization: true,      // Remember auth between page loads
    syntaxHighlight: {
      activate: true,
      theme: 'monokai',
    },
  },
  uiHooks: {
    onRequest: (request, reply, next) => {
      // Add custom logging for docs access
      request.log.info(
        { path: request.url, ip: request.ip },
        'Swagger UI accessed'
      );
      next();
    },
  },
  staticCSP: true,
  transformStaticCSP: (header) => header,
  transformSpecification: (swaggerObject, request, reply) => {
    // Dynamically set server URL based on request
    swaggerObject.servers = [
      {
        url: `${request.protocol}://${request.hostname}`,
        description: 'Current server',
      },
      ...swaggerObject.servers,
    ];
    return swaggerObject;
  },
  transformSpecificationClone: true,
});
```

#### Step 1.3: Verify OpenAPI 3.1 Features

**OpenAPI 3.1 New Features to Leverage:**

1. **JSON Schema 2020-12 Support**
   - Use `null` type instead of `nullable: true`
   - Use `const` for constant values
   - Use `prefixItems` for tuple validation

2. **Webhooks Support** (for future)
```
   webhooks:
     messageDelivered:
       post:
         requestBody:
           content:
             application/json:
               schema:
                 $ref: '#/components/schemas/MessageEvent'
   ```

3. **License Object** (added in Step 1.1)

4. **Info Description** (supports CommonMark)

### Testing Procedures

#### Test 1.1: Verify OpenAPI 3.1 Specification

```bash

# Start the application

npm run dev

# Export OpenAPI spec

curl http://localhost:3000/docs/json > openapi.json

# Verify version

grep '"openapi": "3.1.0"' openapi.json

# Validate spec

npm install -g @apidevtools/swagger-cli
swagger-cli validate openapi.json
```

**Expected Result:**
- OpenAPI version is 3.1.0
- No validation errors
- All metadata fields present

#### Test 1.2: Verify Swagger UI Enhancements

```bash

# Open browser

open http://localhost:3000/docs

# Verify UI features:
# - Search filter box present
# - Operation IDs displayed
# - "Try it out" enabled by default
# - Syntax highlighting active
# - External docs links present

```

**Expected Result:**
- All UI enhancements visible
- External documentation links clickable
- Multiple servers selectable in dropdown

### Deliverables

- Updated `src/app.ts` with OpenAPI 3.1 configuration
- Enhanced Swagger UI with improved UX
- Validation passing for OpenAPI 3.1 spec
- Documentation for new features

### Time Estimate

- Configuration updates: 4 hours
- Testing and validation: 2 hours
- Documentation: 2 hours
- **Total: 8 hours (1 day)**

---

## Phase 2: Schema Organization

**Duration:** 3 days
**Priority:** High
**Dependencies:** Phase 1 complete

### Objectives

1. Create reusable schema components
2. Extract common schemas to dedicated files
3. Eliminate schema duplication
4. Organize schemas by domain
5. Add comprehensive field descriptions

### Implementation Steps

#### Step 2.1: Create Schema Directory Structure

```bash
mkdir -p src/schemas
touch src/schemas/index.ts
touch src/schemas/user.schemas.ts
touch src/schemas/error.schemas.ts
touch src/schemas/health.schemas.ts
touch src/schemas/metrics.schemas.ts
touch src/schemas/components.ts
```

#### Step 2.2: Create User Domain Schemas

**File:** `src/schemas/user.schemas.ts`

```typescript
/**
 * User Domain OpenAPI Schemas
 *
 * JSON Schema definitions for user-related requests and responses
 */

/**
 * User entity schema
 * Represents a complete user object from the database
 */
export const userSchema = {
  type: 'object',
  required: [
    'id',
    'firstName',
    'lastName',
    'email',
    'timezone',
    'createdAt',
    'updatedAt',
  ],
  properties: {
    id: {
      type: 'string',
      format: 'uuid',
      description: 'Unique user identifier (UUID v4)',
      example: '550e8400-e29b-41d4-a716-446655440000',
    },
    firstName: {
      type: 'string',
      minLength: 1,
      maxLength: 100,
      description: 'User first name',
      example: 'John',
    },
    lastName: {
      type: 'string',
      minLength: 1,
      maxLength: 100,
      description: 'User last name',
      example: 'Doe',
    },
    email: {
      type: 'string',
      format: 'email',
      maxLength: 255,
      description: 'User email address (unique, case-insensitive)',
      example: 'john.doe@example.com',
    },
    timezone: {
      type: 'string',
      pattern: '^[A-Za-z]+/[A-Za-z_]+$',
      description: 'IANA timezone identifier (e.g., America/New_York)',
      example: 'America/New_York',
    },
    birthdayDate: {
      type: 'string',
      format: 'date',
      nullable: true,
      description: 'User birthday in YYYY-MM-DD format',
      example: '1990-01-15',
    },
    anniversaryDate: {
      type: 'string',
      format: 'date',
      nullable: true,
      description: 'Anniversary date in YYYY-MM-DD format',
      example: '2015-06-20',
    },
    locationCity: {
      type: 'string',
      maxLength: 100,
      nullable: true,
      description: 'City of residence',
      example: 'New York',
    },
    locationCountry: {
      type: 'string',
      maxLength: 100,
      nullable: true,
      description: 'Country of residence',
      example: 'United States',
    },
    createdAt: {
      type: 'string',
      format: 'date-time',
      description: 'User creation timestamp (ISO 8601)',
      example: '2025-01-15T09:00:00.000Z',
    },
    updatedAt: {
      type: 'string',
      format: 'date-time',
      description: 'Last update timestamp (ISO 8601)',
      example: '2025-01-15T09:00:00.000Z',
    },
    deletedAt: {
      type: 'string',
      format: 'date-time',
      nullable: true,
      description: 'Soft delete timestamp (null if not deleted)',
      example: null,
    },
  },
  example: {
    id: '550e8400-e29b-41d4-a716-446655440000',
    firstName: 'John',
    lastName: 'Doe',
    email: 'john.doe@example.com',
    timezone: 'America/New_York',
    birthdayDate: '1990-01-15',
    anniversaryDate: '2015-06-20',
    locationCity: 'New York',
    locationCountry: 'United States',
    createdAt: '2025-01-15T09:00:00.000Z',
    updatedAt: '2025-01-15T09:00:00.000Z',
    deletedAt: null,
  },
} as const;

/**
 * Create user request schema
 * Request body for POST /api/v1/users
 */
export const createUserRequestSchema = {
  type: 'object',
  required: ['firstName', 'lastName', 'email', 'timezone'],
  properties: {
    firstName: {
      type: 'string',
      minLength: 1,
      maxLength: 100,
      description: 'User first name (trimmed)',
      example: 'John',
    },
    lastName: {
      type: 'string',
      minLength: 1,
      maxLength: 100,
      description: 'User last name (trimmed)',
      example: 'Doe',
    },
    email: {
      type: 'string',
      format: 'email',
      maxLength: 255,
      description:
        'User email address (must be unique, automatically lowercased and trimmed)',
      example: 'john.doe@example.com',
    },
    timezone: {
      type: 'string',
      pattern: '^[A-Za-z]+/[A-Za-z_]+$',
      description:
        'IANA timezone identifier (e.g., "America/New_York", "Europe/London")',
      example: 'America/New_York',
    },
    birthdayDate: {
      type: 'string',
      format: 'date',
      description: 'User birthday in YYYY-MM-DD format (optional)',
      example: '1990-01-15',
    },
    anniversaryDate: {
      type: 'string',
      format: 'date',
      description: 'Anniversary date in YYYY-MM-DD format (optional)',
      example: '2015-06-20',
    },
    locationCity: {
      type: 'string',
      maxLength: 100,
      description: 'City of residence (optional, trimmed)',
      example: 'New York',
    },
    locationCountry: {
      type: 'string',
      maxLength: 100,
      description: 'Country of residence (optional, trimmed)',
      example: 'United States',
    },
  },
} as const;

/**
 * Update user request schema
 * Request body for PUT /api/v1/users/:id
 */
export const updateUserRequestSchema = {
  type: 'object',
  properties: {
    firstName: {
      type: 'string',
      minLength: 1,
      maxLength: 100,
      description: 'User first name (trimmed)',
      example: 'John',
    },
    lastName: {
      type: 'string',
      minLength: 1,
      maxLength: 100,
      description: 'User last name (trimmed)',
      example: 'Doe',
    },
    email: {
      type: 'string',
      format: 'email',
      maxLength: 255,
      description:
        'User email address (must be unique, automatically lowercased and trimmed)',
      example: 'john.doe@example.com',
    },
    timezone: {
      type: 'string',
      pattern: '^[A-Za-z]+/[A-Za-z_]+$',
      description: 'IANA timezone identifier',
      example: 'America/New_York',
    },
    birthdayDate: {
      type: 'string',
      format: 'date',
      nullable: true,
      description: 'User birthday in YYYY-MM-DD format (set to null to clear)',
      example: '1990-01-15',
    },
    anniversaryDate: {
      type: 'string',
      format: 'date',
      nullable: true,
      description:
        'Anniversary date in YYYY-MM-DD format (set to null to clear)',
      example: '2015-06-20',
    },
    locationCity: {
      type: 'string',
      maxLength: 100,
      nullable: true,
      description: 'City of residence (set to null to clear, trimmed)',
      example: 'New York',
    },
    locationCountry: {
      type: 'string',
      maxLength: 100,
      nullable: true,
      description: 'Country of residence (set to null to clear, trimmed)',
      example: 'United States',
    },
  },
} as const;

/**
 * User ID parameter schema
 * Path parameter for /api/v1/users/:id
 */
export const userIdParamSchema = {
  type: 'object',
  required: ['id'],
  properties: {
    id: {
      type: 'string',
      format: 'uuid',
      description: 'User UUID',
      example: '550e8400-e29b-41d4-a716-446655440000',
    },
  },
} as const;
```

#### Step 2.3: Create Error Response Schemas (RFC 9457)

**File:** `src/schemas/error.schemas.ts`

```typescript
/**
 * Error Response Schemas
 *
 * RFC 9457-compliant error response schemas
 * See: https://www.rfc-editor.org/rfc/rfc9457.html
 */

/**
 * Base error response schema
 * Follows RFC 9457 Problem Details for HTTP APIs
 */
export const errorResponseSchema = {
  type: 'object',
  required: ['error', 'timestamp'],
  properties: {
    error: {
      type: 'object',
      required: ['code', 'message'],
      properties: {
        code: {
          type: 'string',
          description: 'Machine-readable error code (uppercase snake_case)',
          example: 'VALIDATION_ERROR',
        },
        message: {
          type: 'string',
          description: 'Human-readable error message',
          example: 'Invalid request data',
        },
        details: {
          type: 'object',
          additionalProperties: true,
          description: 'Additional error context (field-specific errors, etc.)',
          example: {
            fields: {
              email: 'Invalid email format',
            },
          },
        },
      },
    },
    timestamp: {
      type: 'string',
      format: 'date-time',
      description: 'Error occurrence timestamp (ISO 8601)',
      example: '2025-01-15T09:00:00.000Z',
    },
    path: {
      type: 'string',
      description: 'Request path that caused the error',
      example: '/api/v1/users',
    },
  },
} as const;

/**
 * Validation error response schema
 * Extends base error with field-specific validation errors
 */
export const validationErrorSchema = {
  allOf: [
    errorResponseSchema,
    {
      properties: {
        error: {
          properties: {
            code: {
              const: 'VALIDATION_ERROR',
            },
            details: {
              type: 'object',
              required: ['fields'],
              properties: {
                fields: {
                  type: 'object',
                  additionalProperties: { type: 'string' },
                  description: 'Map of field names to validation error messages',
                  example: {
                    email: 'Invalid email format',
                    timezone: 'Invalid IANA timezone',
                  },
                },
              },
            },
          },
        },
      },
    },
  ],
} as const;

/**
 * Success response wrapper schema
 * Standard wrapper for successful API responses
 */
export const successResponseSchema = {
  type: 'object',
  required: ['success', 'data', 'timestamp'],
  properties: {
    success: {
      type: 'boolean',
      const: true,
      description: 'Indicates successful operation',
      example: true,
    },
    data: {
      type: 'object',
      description: 'Response payload (type varies by endpoint)',
    },
    timestamp: {
      type: 'string',
      format: 'date-time',
      description: 'Response timestamp (ISO 8601)',
      example: '2025-01-15T09:00:00.000Z',
    },
  },
} as const;
```

#### Step 2.4: Create Health Check Schemas

**File:** `src/schemas/health.schemas.ts`

```typescript
/**
 * Health Check Schemas
 *
 * OpenAPI schemas for health check endpoints
 */

/**
 * Health check response schema
 * GET /health
 */
export const healthResponseSchema = {
  type: 'object',
  required: ['status', 'timestamp', 'uptime', 'version', 'services'],
  properties: {
    status: {
      type: 'string',
      enum: ['ok', 'degraded', 'error'],
      description:
        'Overall health status (ok = all services healthy, degraded = some services down, error = critical services down)',
      example: 'ok',
    },
    timestamp: {
      type: 'string',
      format: 'date-time',
      description: 'Health check timestamp (ISO 8601)',
      example: '2025-01-15T09:00:00.000Z',
    },
    uptime: {
      type: 'number',
      description: 'Application uptime in seconds',
      example: 3600,
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
          type: 'string',
          enum: ['healthy', 'unhealthy'],
          description: 'PostgreSQL database connection status',
          example: 'healthy',
        },
        rabbitmq: {
          type: 'string',
          enum: ['healthy', 'unhealthy'],
          description: 'RabbitMQ message queue connection status',
          example: 'healthy',
        },
      },
    },
  },
} as const;

/**
 * Readiness probe response schema
 * GET /ready
 */
export const readinessResponseSchema = {
  type: 'object',
  required: ['status', 'timestamp'],
  properties: {
    status: {
      type: 'string',
      enum: ['ready', 'not_ready'],
      description: 'Application readiness status',
      example: 'ready',
    },
    timestamp: {
      type: 'string',
      format: 'date-time',
      description: 'Probe timestamp (ISO 8601)',
      example: '2025-01-15T09:00:00.000Z',
    },
  },
} as const;

/**
 * Liveness probe response schema
 * GET /live
 */
export const livenessResponseSchema = {
  type: 'object',
  required: ['status', 'timestamp'],
  properties: {
    status: {
      type: 'string',
      enum: ['alive'],
      const: 'alive',
      description: 'Application liveness status (always "alive" if responding)',
      example: 'alive',
    },
    timestamp: {
      type: 'string',
      format: 'date-time',
      description: 'Probe timestamp (ISO 8601)',
      example: '2025-01-15T09:00:00.000Z',
    },
  },
} as const;

/**
 * Scheduler health response schema
 * GET /health/schedulers
 */
export const schedulerHealthResponseSchema = {
  type: 'object',
  required: ['status', 'timestamp', 'uptime', 'schedulers'],
  properties: {
    status: {
      type: 'string',
      enum: ['ok', 'degraded'],
      description: 'Scheduler health status',
      example: 'ok',
    },
    timestamp: {
      type: 'string',
      format: 'date-time',
      description: 'Health check timestamp (ISO 8601)',
      example: '2025-01-15T09:00:00.000Z',
    },
    uptime: {
      type: 'number',
      description: 'Scheduler service uptime in seconds',
      example: 3600,
    },
    startTime: {
      type: 'string',
      format: 'date-time',
      nullable: true,
      description: 'Scheduler service start time (ISO 8601)',
      example: '2025-01-15T08:00:00.000Z',
    },
    schedulers: {
      type: 'array',
      description: 'List of active schedulers and their status',
      items: {
        type: 'object',
        properties: {
          name: {
            type: 'string',
            description: 'Scheduler name',
            example: 'BirthdayScheduler',
          },
          healthy: {
            type: 'boolean',
            description: 'Scheduler health status',
            example: true,
          },
          status: {
            type: 'object',
            description: 'Scheduler-specific status details',
            additionalProperties: true,
          },
        },
      },
    },
    statistics: {
      type: 'object',
      description: 'Scheduler statistics',
      additionalProperties: true,
    },
  },
} as const;
```

#### Step 2.5: Create Metrics Schemas

**File:** `src/schemas/metrics.schemas.ts`

```typescript
/**
 * Metrics Schemas
 *
 * OpenAPI schemas for Prometheus metrics endpoints
 */

/**
 * Prometheus metrics response schema
 * GET /metrics
 */
export const prometheusMetricsSchema = {
  type: 'string',
  description: 'Prometheus exposition format (text/plain)',
  example: `# HELP http_request_duration_seconds HTTP request duration

# TYPE http_request_duration_seconds histogram

http_request_duration_seconds_bucket{le="0.05",method="GET",route="/api/v1/users/:id",status_code="200"} 100
http_request_duration_seconds_bucket{le="0.1",method="GET",route="/api/v1/users/:id",status_code="200"} 150
http_request_duration_seconds_sum{method="GET",route="/api/v1/users/:id",status_code="200"} 12.5
http_request_duration_seconds_count{method="GET",route="/api/v1/users/:id",status_code="200"} 200

# HELP messages_sent_total Total messages sent
# TYPE messages_sent_total counter

messages_sent_total{message_type="birthday"} 1500
messages_sent_total{message_type="anniversary"} 800

# HELP messages_failed_total Total messages failed
# TYPE messages_failed_total counter

messages_failed_total{message_type="birthday",reason="rate_limit"} 10
messages_failed_total{message_type="birthday",reason="timeout"} 5`,
} as const;

/**
 * Metrics summary response schema
 * GET /metrics/summary
 */
export const metricsSummarySchema = {
  type: 'object',
  required: ['success', 'data', 'timestamp'],
  properties: {
    success: {
      type: 'boolean',
      example: true,
    },
    data: {
      type: 'object',
      description: 'Metrics summary in JSON format',
      additionalProperties: true,
    },
    timestamp: {
      type: 'string',
      format: 'date-time',
      example: '2025-01-15T09:00:00.000Z',
    },
  },
} as const;
```

#### Step 2.6: Create Reusable Components Registry

**File:** `src/schemas/components.ts`

```typescript
/**
 * OpenAPI Reusable Components
 *
 * Central registry of reusable OpenAPI components
 * These are referenced using $ref in route schemas
 */

import {
  errorResponseSchema,
  validationErrorSchema,
  successResponseSchema,
} from './error.schemas.js';
import {
  userSchema,
  createUserRequestSchema,
  updateUserRequestSchema,
} from './user.schemas.js';
import {
  healthResponseSchema,
  readinessResponseSchema,
  livenessResponseSchema,
  schedulerHealthResponseSchema,
} from './health.schemas.js';
import {
  prometheusMetricsSchema,
  metricsSummarySchema,
} from './metrics.schemas.js';

/**
 * Rate limit headers
 * Used in all rate-limited endpoints
 */
export const rateLimitHeaders = {
  'X-RateLimit-Limit': {
    description: 'Request limit per time window',
    schema: { type: 'integer', example: 100 },
  },
  'X-RateLimit-Remaining': {
    description: 'Remaining requests in current window',
    schema: { type: 'integer', example: 95 },
  },
  'X-RateLimit-Reset': {
    description: 'Unix timestamp when limit resets',
    schema: { type: 'integer', example: 1704110460 },
  },
} as const;

/**
 * OpenAPI components object
 * Register all reusable components here
 */
export const components = {
  schemas: {
    // Domain models
    User: userSchema,

    // Request DTOs
    CreateUserRequest: createUserRequestSchema,
    UpdateUserRequest: updateUserRequestSchema,

    // Response DTOs
    SuccessResponse: successResponseSchema,
    ErrorResponse: errorResponseSchema,
    ValidationError: validationErrorSchema,

    // Health schemas
    HealthResponse: healthResponseSchema,
    ReadinessResponse: readinessResponseSchema,
    LivenessResponse: livenessResponseSchema,
    SchedulerHealthResponse: schedulerHealthResponseSchema,

    // Metrics schemas
    PrometheusMetrics: prometheusMetricsSchema,
    MetricsSummary: metricsSummarySchema,
  },

  responses: {
    /**
     * 400 Bad Request - Validation error
     */
    BadRequest: {
      description: 'Validation error or malformed request',
      content: {
        'application/json': {
          schema: { $ref: '#/components/schemas/ValidationError' },
          examples: {
            validationError: {
              summary: 'Field validation failed',
              value: {
                error: {
                  code: 'VALIDATION_ERROR',
                  message: 'Invalid request data',
                  details: {
                    fields: {
                      email: 'Invalid email format',
                    },
                  },
                },
                timestamp: '2025-01-15T09:00:00.000Z',
                path: '/api/v1/users',
              },
            },
            malformedJson: {
              summary: 'Malformed JSON payload',
              value: {
                error: {
                  code: 'MALFORMED_JSON',
                  message: 'Invalid JSON in request body',
                },
                timestamp: '2025-01-15T09:00:00.000Z',
                path: '/api/v1/users',
              },
            },
          },
        },
      },
    },

    /**
     * 404 Not Found
     */
    NotFound: {
      description: 'Resource not found',
      content: {
        'application/json': {
          schema: { $ref: '#/components/schemas/ErrorResponse' },
          example: {
            error: {
              code: 'NOT_FOUND',
              message: 'User not found',
            },
            timestamp: '2025-01-15T09:00:00.000Z',
            path: '/api/v1/users/550e8400-e29b-41d4-a716-446655440000',
          },
        },
      },
    },

    /**
     * 409 Conflict
     */
    Conflict: {
      description: 'Resource conflict (e.g., email already exists)',
      content: {
        'application/json': {
          schema: { $ref: '#/components/schemas/ErrorResponse' },
          example: {
            error: {
              code: 'CONFLICT',
              message: 'Email already exists',
              details: {
                email: 'john.doe@example.com',
              },
            },
            timestamp: '2025-01-15T09:00:00.000Z',
            path: '/api/v1/users',
          },
        },
      },
    },

    /**
     * 429 Too Many Requests - Rate limit exceeded
     */
    RateLimitExceeded: {
      description: 'Too many requests - rate limit exceeded',
      headers: {
        ...rateLimitHeaders,
        'Retry-After': {
          description: 'Seconds to wait before retry',
          schema: { type: 'integer', example: 60 },
        },
      },
      content: {
        'application/json': {
          schema: { $ref: '#/components/schemas/ErrorResponse' },
          example: {
            error: {
              code: 'RATE_LIMIT_EXCEEDED',
              message: 'Rate limit exceeded, retry in 60 seconds',
            },
            timestamp: '2025-01-15T09:00:00.000Z',
          },
        },
      },
    },

    /**
     * 500 Internal Server Error
     */
    InternalServerError: {
      description: 'Internal server error',
      content: {
        'application/json': {
          schema: { $ref: '#/components/schemas/ErrorResponse' },
          example: {
            error: {
              code: 'INTERNAL_SERVER_ERROR',
              message: 'An unexpected error occurred',
            },
            timestamp: '2025-01-15T09:00:00.000Z',
            path: '/api/v1/users',
          },
        },
      },
    },

    /**
     * 503 Service Unavailable
     */
    ServiceUnavailable: {
      description: 'Service temporarily unavailable',
      content: {
        'application/json': {
          schema: { $ref: '#/components/schemas/ErrorResponse' },
          example: {
            error: {
              code: 'SERVICE_UNAVAILABLE',
              message: 'Service is temporarily unavailable',
            },
            timestamp: '2025-01-15T09:00:00.000Z',
          },
        },
      },
    },
  },

  parameters: {
    /**
     * User ID path parameter
     */
    userId: {
      name: 'id',
      in: 'path',
      required: true,
      description: 'User UUID',
      schema: {
        type: 'string',
        format: 'uuid',
        example: '550e8400-e29b-41d4-a716-446655440000',
      },
    },
  },

  /**
   * Security schemes (for future authentication)
   */
  securitySchemes: {
    BearerAuth: {
      type: 'http',
      scheme: 'bearer',
      bearerFormat: 'JWT',
      description: 'JWT token obtained from /auth/login endpoint',
    },
    ApiKeyAuth: {
      type: 'apiKey',
      in: 'header',
      name: 'X-API-Key',
      description: 'API key for service-to-service authentication',
    },
  },
} as const;
```

#### Step 2.7: Create Main Schema Export

**File:** `src/schemas/index.ts`

```typescript
/**
 * Schema Module Exports
 *
 * Central export point for all OpenAPI schemas
 */

export * from './user.schemas.js';
export * from './error.schemas.js';
export * from './health.schemas.js';
export * from './metrics.schemas.js';
export * from './components.js';
```

#### Step 2.8: Update App Configuration

**File:** `src/app.ts`

Add components to OpenAPI configuration:

```typescript
import { components } from './schemas/components.js';

await app.register(swagger, {
  openapi: {
    openapi: '3.1.0',
    // ... existing config ...
    components: {
      schemas: components.schemas,
      responses: components.responses,
      parameters: components.parameters,
      securitySchemes: components.securitySchemes,
    },
  },
});
```

### Testing Procedures

#### Test 2.1: Verify Schema Files Created

```bash

# Check directory structure

ls -la src/schemas/

# Expected files:
# - index.ts
# - user.schemas.ts
# - error.schemas.ts
# - health.schemas.ts
# - metrics.schemas.ts
# - components.ts

```

#### Test 2.2: Verify TypeScript Compilation

```bash
npm run build

# Should compile without errors
# Check dist/schemas/ directory created

```

#### Test 2.3: Verify Schema Registration

```bash

# Start application

npm run dev

# Export OpenAPI spec

curl http://localhost:3000/docs/json > openapi.json

# Verify components registered

jq '.components.schemas | keys' openapi.json

# Should show: User, CreateUserRequest, ErrorResponse, etc.

jq '.components.responses | keys' openapi.json

# Should show: BadRequest, NotFound, Conflict, etc.

```

### Deliverables

- Organized schema directory structure (`src/schemas/`)
- Domain-specific schema files (user, error, health, metrics)
- Reusable components registry
- Updated app configuration with components
- All TypeScript files compile successfully

### Time Estimate

- Create directory structure: 1 hour
- Create schema files: 8 hours
- Update app configuration: 1 hour
- Testing and validation: 2 hours
- **Total: 12 hours (1.5 days)**

---

## Phase 3: Comprehensive Examples

**Duration:** 2 days
**Priority:** Medium
**Dependencies:** Phase 2 complete

### Objectives

1. Add comprehensive request/response examples to all endpoints
2. Create example library for reusable examples
3. Include edge cases and error scenarios
4. Improve Swagger UI "Try it out" experience

### Implementation Steps

#### Step 3.1: Create Example Library

**File:** `src/schemas/examples/user.examples.ts`

```typescript
/**
 * User Endpoint Examples
 *
 * Comprehensive examples for user management endpoints
 */

export const userExamples = {
  /**
   * POST /api/v1/users examples
   */
  createUser: {
    minimal: {
      summary: 'Minimal required fields only',
      description: 'Create user with only required fields (firstName, lastName, email, timezone)',
      value: {
        firstName: 'John',
        lastName: 'Doe',
        email: 'john.doe@example.com',
        timezone: 'America/New_York',
      },
    },
    complete: {
      summary: 'All fields populated',
      description: 'Create user with all optional fields included',
      value: {
        firstName: 'Jane',
        lastName: 'Smith',
        email: 'jane.smith@example.com',
        timezone: 'Europe/London',
        birthdayDate: '1992-03-20',
        anniversaryDate: '2018-07-15',
        locationCity: 'London',
        locationCountry: 'United Kingdom',
      },
    },
    timezones: {
      summary: 'Different timezone examples',
      description: 'Valid IANA timezone identifiers',
      value: {
        firstName: 'Yuki',
        lastName: 'Tanaka',
        email: 'yuki.tanaka@example.com',
        timezone: 'Asia/Tokyo',
        birthdayDate: '1988-11-05',
      },
    },
  },

  /**
   * PUT /api/v1/users/:id examples
   */
  updateUser: {
    partialUpdate: {
      summary: 'Update specific fields only',
      description: 'Partial update - only changed fields',
      value: {
        email: 'newemail@example.com',
        locationCity: 'San Francisco',
      },
    },
    clearOptionalFields: {
      summary: 'Clear optional fields',
      description: 'Set optional fields to null to clear them',
      value: {
        birthdayDate: null,
        anniversaryDate: null,
        locationCity: null,
        locationCountry: null,
      },
    },
    completeUpdate: {
      summary: 'Update all fields',
      description: 'Full update with all fields',
      value: {
        firstName: 'John',
        lastName: 'Doe',
        email: 'updated@example.com',
        timezone: 'America/Los_Angeles',
        birthdayDate: '1990-01-15',
        anniversaryDate: '2015-06-20',
        locationCity: 'Los Angeles',
        locationCountry: 'United States',
      },
    },
  },

  /**
   * Success response examples
   */
  successResponses: {
    created: {
      summary: 'User created successfully',
      value: {
        success: true,
        data: {
          id: '550e8400-e29b-41d4-a716-446655440000',
          firstName: 'John',
          lastName: 'Doe',
          email: 'john.doe@example.com',
          timezone: 'America/New_York',
          birthdayDate: '1990-01-15',
          anniversaryDate: null,
          locationCity: 'New York',
          locationCountry: 'United States',
          createdAt: '2025-01-15T09:00:00.000Z',
          updatedAt: '2025-01-15T09:00:00.000Z',
          deletedAt: null,
        },
        timestamp: '2025-01-15T09:00:00.000Z',
      },
    },
    retrieved: {
      summary: 'User retrieved successfully',
      value: {
        success: true,
        data: {
          id: '550e8400-e29b-41d4-a716-446655440000',
          firstName: 'Jane',
          lastName: 'Smith',
          email: 'jane.smith@example.com',
          timezone: 'Europe/London',
          birthdayDate: '1992-03-20',
          anniversaryDate: '2018-07-15',
          locationCity: 'London',
          locationCountry: 'United Kingdom',
          createdAt: '2025-01-14T10:30:00.000Z',
          updatedAt: '2025-01-15T08:45:00.000Z',
          deletedAt: null,
        },
        timestamp: '2025-01-15T09:00:00.000Z',
      },
    },
    updated: {
      summary: 'User updated successfully',
      value: {
        success: true,
        data: {
          id: '550e8400-e29b-41d4-a716-446655440000',
          firstName: 'John',
          lastName: 'Doe',
          email: 'updated@example.com',
          timezone: 'America/Los_Angeles',
          birthdayDate: '1990-01-15',
          anniversaryDate: '2015-06-20',
          locationCity: 'Los Angeles',
          locationCountry: 'United States',
          createdAt: '2025-01-10T12:00:00.000Z',
          updatedAt: '2025-01-15T09:00:00.000Z',
          deletedAt: null,
        },
        timestamp: '2025-01-15T09:00:00.000Z',
      },
    },
    deleted: {
      summary: 'User deleted successfully',
      value: {
        success: true,
        data: {
          message: 'User deleted successfully',
        },
        timestamp: '2025-01-15T09:00:00.000Z',
      },
    },
  },

  /**
   * Error response examples
   */
  errorResponses: {
    invalidEmail: {
      summary: 'Invalid email format',
      value: {
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid request data',
          details: {
            fields: {
              email: 'Invalid email format',
            },
          },
        },
        timestamp: '2025-01-15T09:00:00.000Z',
        path: '/api/v1/users',
      },
    },
    invalidTimezone: {
      summary: 'Invalid IANA timezone',
      value: {
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid IANA timezone format',
          details: {
            fields: {
              timezone: 'Invalid IANA timezone format (e.g., "America/New_York")',
            },
          },
        },
        timestamp: '2025-01-15T09:00:00.000Z',
        path: '/api/v1/users',
      },
    },
    invalidDate: {
      summary: 'Invalid date format',
      value: {
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid date format',
          details: {
            fields: {
              birthdayDate: 'Date must be in YYYY-MM-DD format',
            },
          },
        },
        timestamp: '2025-01-15T09:00:00.000Z',
        path: '/api/v1/users',
      },
    },
    emailConflict: {
      summary: 'Email already exists',
      value: {
        error: {
          code: 'CONFLICT',
          message: 'Email already exists',
          details: {
            email: 'john.doe@example.com',
          },
        },
        timestamp: '2025-01-15T09:00:00.000Z',
        path: '/api/v1/users',
      },
    },
    userNotFound: {
      summary: 'User not found',
      value: {
        error: {
          code: 'NOT_FOUND',
          message: 'User not found',
        },
        timestamp: '2025-01-15T09:00:00.000Z',
        path: '/api/v1/users/550e8400-e29b-41d4-a716-446655440000',
      },
    },
  },
} as const;
```

#### Step 3.2: Create Health Check Examples

**File:** `src/schemas/examples/health.examples.ts`

```typescript
/**
 * Health Check Examples
 */

export const healthExamples = {
  /**
   * GET /health examples
   */
  health: {
    allHealthy: {
      summary: 'All services healthy',
      value: {
        status: 'ok',
        timestamp: '2025-01-15T09:00:00.000Z',
        uptime: 3600,
        version: '1.0.0',
        services: {
          database: 'healthy',
          rabbitmq: 'healthy',
        },
      },
    },
    degraded: {
      summary: 'Database connection issues',
      value: {
        status: 'degraded',
        timestamp: '2025-01-15T09:00:00.000Z',
        uptime: 3600,
        version: '1.0.0',
        services: {
          database: 'unhealthy',
          rabbitmq: 'healthy',
        },
      },
    },
    error: {
      summary: 'Critical services down',
      value: {
        status: 'error',
        timestamp: '2025-01-15T09:00:00.000Z',
        uptime: 3600,
        version: '1.0.0',
        services: {
          database: 'unhealthy',
          rabbitmq: 'unhealthy',
        },
      },
    },
  },

  /**
   * GET /ready examples
   */
  readiness: {
    ready: {
      summary: 'Application ready',
      value: {
        status: 'ready',
        timestamp: '2025-01-15T09:00:00.000Z',
      },
    },
    notReady: {
      summary: 'Application not ready',
      value: {
        status: 'not_ready',
        timestamp: '2025-01-15T09:00:00.000Z',
      },
    },
  },

  /**
   * GET /live examples
   */
  liveness: {
    alive: {
      summary: 'Application alive',
      value: {
        status: 'alive',
        timestamp: '2025-01-15T09:00:00.000Z',
      },
    },
  },

  /**
   * GET /health/schedulers examples
   */
  schedulers: {
    healthy: {
      summary: 'All schedulers healthy',
      value: {
        status: 'ok',
        timestamp: '2025-01-15T09:00:00.000Z',
        uptime: 3600,
        startTime: '2025-01-15T08:00:00.000Z',
        schedulers: [
          {
            name: 'BirthdayScheduler',
            healthy: true,
            status: {
              lastRun: '2025-01-15T08:55:00.000Z',
              nextRun: '2025-01-15T09:00:00.000Z',
            },
          },
          {
            name: 'AnniversaryScheduler',
            healthy: true,
            status: {
              lastRun: '2025-01-15T08:55:00.000Z',
              nextRun: '2025-01-15T09:00:00.000Z',
            },
          },
        ],
        statistics: {
          totalRuns: 120,
          failedRuns: 0,
        },
      },
    },
    degraded: {
      summary: 'Some schedulers unhealthy',
      value: {
        status: 'degraded',
        timestamp: '2025-01-15T09:00:00.000Z',
        uptime: 3600,
        startTime: '2025-01-15T08:00:00.000Z',
        schedulers: [
          {
            name: 'BirthdayScheduler',
            healthy: false,
            status: {
              lastRun: '2025-01-15T08:45:00.000Z',
              error: 'Database connection timeout',
            },
          },
          {
            name: 'AnniversaryScheduler',
            healthy: true,
            status: {
              lastRun: '2025-01-15T08:55:00.000Z',
              nextRun: '2025-01-15T09:00:00.000Z',
            },
          },
        ],
        statistics: {
          totalRuns: 120,
          failedRuns: 5,
        },
      },
    },
  },
} as const;
```

#### Step 3.3: Update User Routes with Examples

**File:** `src/routes/user.routes.ts`

```typescript
import { userExamples } from '../schemas/examples/user.examples.js';
import {
  userSchema,
  createUserRequestSchema,
  updateUserRequestSchema,
  userIdParamSchema,
} from '../schemas/index.js';
import { components, rateLimitHeaders } from '../schemas/index.js';

export async function userRoutes(
  fastify: FastifyInstance,
  _options: FastifyPluginOptions
): Promise<void> {
  /**
   * POST /api/v1/users - Create new user
   */
  fastify.post(
    '/users',
    {
      schema: {
        tags: ['users'],
        summary: 'Create a new user',
        description: `
Create a new user with birthday and anniversary tracking.

**Features:**
- Automatic timezone validation (IANA format)
- Email uniqueness check (case-insensitive)
- Soft delete support (emails can be reused after deletion)
- All string fields are automatically trimmed
- Email is automatically lowercased

**Rate Limiting:** 10 requests per minute per IP

**Validation:**
- Email must be unique among non-deleted users
- Timezone must be valid IANA identifier
- Dates must be in YYYY-MM-DD format
        `,
        operationId: 'createUser',
        body: {
          content: {
            'application/json': {
              schema: createUserRequestSchema,
              examples: userExamples.createUser,
            },
          },
        },
        response: {
          201: {
            description: 'User created successfully',
            headers: rateLimitHeaders,
            content: {
              'application/json': {
                schema: {
                  allOf: [
                    { $ref: '#/components/schemas/SuccessResponse' },
                    {
                      properties: {
                        data: { $ref: '#/components/schemas/User' },
                      },
                    },
                  ],
                },
                examples: {
                  created: userExamples.successResponses.created,
                },
              },
            },
          },
          400: {
            $ref: '#/components/responses/BadRequest',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ValidationError' },
                examples: {
                  invalidEmail: userExamples.errorResponses.invalidEmail,
                  invalidTimezone: userExamples.errorResponses.invalidTimezone,
                  invalidDate: userExamples.errorResponses.invalidDate,
                },
              },
            },
          },
          409: {
            $ref: '#/components/responses/Conflict',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
                examples: {
                  emailConflict: userExamples.errorResponses.emailConflict,
                },
              },
            },
          },
          429: { $ref: '#/components/responses/RateLimitExceeded' },
          500: { $ref: '#/components/responses/InternalServerError' },
        },
      },
      config: {
        rateLimit: {
          max: 10,
          timeWindow: '1 minute',
        },
      },
    },
    userController.create.bind(userController)
  );

  /**
   * GET /api/v1/users/:id - Get user by ID
   */
  fastify.get(
    '/users/:id',
    {
      schema: {
        tags: ['users'],
        summary: 'Get user by ID',
        description: `
Retrieve user information by UUID.

**Note:** Deleted users (soft delete) are not returned.

**Rate Limiting:** 100 requests per minute per IP
        `,
        operationId: 'getUserById',
        params: userIdParamSchema,
        response: {
          200: {
            description: 'User found',
            headers: rateLimitHeaders,
            content: {
              'application/json': {
                schema: {
                  allOf: [
                    { $ref: '#/components/schemas/SuccessResponse' },
                    {
                      properties: {
                        data: { $ref: '#/components/schemas/User' },
                      },
                    },
                  ],
                },
                examples: {
                  retrieved: userExamples.successResponses.retrieved,
                },
              },
            },
          },
          404: {
            $ref: '#/components/responses/NotFound',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
                examples: {
                  notFound: userExamples.errorResponses.userNotFound,
                },
              },
            },
          },
          500: { $ref: '#/components/responses/InternalServerError' },
        },
      },
      config: {
        rateLimit: {
          max: 100,
          timeWindow: '1 minute',
        },
      },
    },
    userController.getById.bind(userController)
  );

  /**
   * PUT /api/v1/users/:id - Update user
   */
  fastify.put(
    '/users/:id',
    {
      schema: {
        tags: ['users'],
        summary: 'Update user',
        description: `
Update user information. Supports partial updates.

**Features:**
- Partial updates supported (only send changed fields)
- Set optional fields to null to clear them
- Email uniqueness validation (excluding current user)
- All string fields are automatically trimmed
- Email is automatically lowercased

**Rate Limiting:** 20 requests per minute per IP

**Note:** Cannot update deleted users
        `,
        operationId: 'updateUser',
        params: userIdParamSchema,
        body: {
          content: {
            'application/json': {
              schema: updateUserRequestSchema,
              examples: userExamples.updateUser,
            },
          },
        },
        response: {
          200: {
            description: 'User updated successfully',
            headers: rateLimitHeaders,
            content: {
              'application/json': {
                schema: {
                  allOf: [
                    { $ref: '#/components/schemas/SuccessResponse' },
                    {
                      properties: {
                        data: { $ref: '#/components/schemas/User' },
                      },
                    },
                  ],
                },
                examples: {
                  updated: userExamples.successResponses.updated,
                },
              },
            },
          },
          400: {
            $ref: '#/components/responses/BadRequest',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ValidationError' },
                examples: {
                  invalidEmail: userExamples.errorResponses.invalidEmail,
                  invalidTimezone: userExamples.errorResponses.invalidTimezone,
                },
              },
            },
          },
          404: {
            $ref: '#/components/responses/NotFound',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
                examples: {
                  notFound: userExamples.errorResponses.userNotFound,
                },
              },
            },
          },
          409: {
            $ref: '#/components/responses/Conflict',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
                examples: {
                  emailConflict: userExamples.errorResponses.emailConflict,
                },
              },
            },
          },
          429: { $ref: '#/components/responses/RateLimitExceeded' },
          500: { $ref: '#/components/responses/InternalServerError' },
        },
      },
      config: {
        rateLimit: {
          max: 20,
          timeWindow: '1 minute',
        },
      },
    },
    userController.update.bind(userController)
  );

  /**
   * DELETE /api/v1/users/:id - Soft delete user
   */
  fastify.delete(
    '/users/:id',
    {
      schema: {
        tags: ['users'],
        summary: 'Delete user',
        description: `
Soft delete user (marks as deleted without removing from database).

**Features:**
- Soft delete - data preserved for audit
- Email becomes available for reuse after deletion
- Deleted users excluded from GET queries

**Rate Limiting:** 10 requests per minute per IP

**Note:** Cannot delete already deleted users
        `,
        operationId: 'deleteUser',
        params: userIdParamSchema,
        response: {
          200: {
            description: 'User deleted successfully',
            headers: rateLimitHeaders,
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/SuccessResponse' },
                examples: {
                  deleted: userExamples.successResponses.deleted,
                },
              },
            },
          },
          404: {
            $ref: '#/components/responses/NotFound',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
                examples: {
                  notFound: userExamples.errorResponses.userNotFound,
                },
              },
            },
          },
          429: { $ref: '#/components/responses/RateLimitExceeded' },
          500: { $ref: '#/components/responses/InternalServerError' },
        },
      },
      config: {
        rateLimit: {
          max: 10,
          timeWindow: '1 minute',
        },
      },
    },
    userController.delete.bind(userController)
  );
}
```

### Testing Procedures

#### Test 3.1: Verify Examples in Swagger UI

```bash

# Start application

npm run dev

# Open Swagger UI

open http://localhost:3000/docs

# Test for each endpoint:
# 1. Expand endpoint
# 2. Click "Try it out"
# 3. Select different examples from dropdown
# 4. Verify example data populates correctly
# 5. Execute request and verify response matches examples

```

**Expected Result:**
- All endpoints have multiple examples
- Examples are properly formatted
- "Try it out" works with example data
- Response examples match actual API responses

### Deliverables

- Example library files created
- All endpoints updated with comprehensive examples
- Multiple request/response examples per endpoint
- Edge cases and error scenarios documented

### Time Estimate

- Create example libraries: 4 hours
- Update route files: 4 hours
- Testing in Swagger UI: 2 hours
- **Total: 10 hours (1.25 days)**

---

## Phase 4: Error Documentation

**Duration:** 1 day
**Priority:** Medium
**Dependencies:** Phase 2 complete

### Objectives

1. Document all error responses following RFC 9457
2. Add comprehensive error examples
3. Document rate limiting behavior
4. Add headers documentation

### Implementation Complete

This phase is already complete from Phase 2 and Phase 3:

- RFC 9457-compliant error schemas created (`src/schemas/error.schemas.ts`)
- Reusable error response components registered (`src/schemas/components.ts`)
- Error examples added to all endpoints (Phase 3)
- Rate limiting headers documented

### Verification Steps

#### Verify 4.1: RFC 9457 Compliance

```bash

# Export OpenAPI spec

curl http://localhost:3000/docs/json > openapi.json

# Check error response structure

jq '.components.schemas.ErrorResponse' openapi.json

# Verify required fields: error, timestamp
# Verify error object has: code, message, details

```

#### Verify 4.2: Error Examples Present

```bash

# Check error examples in spec

jq '.components.responses.BadRequest.content."application/json".examples' openapi.json

# Should show multiple error examples per error type

```

### Time Estimate

- **Total: 2 hours (verification only, implementation in Phase 2/3)**

---

## Phase 5: CI/CD Integration

**Duration:** 2 days
**Priority:** High
**Dependencies:** Phase 1-4 complete

### Objectives

1. Install OpenAPI validation tools
2. Create NPM scripts for validation
3. Add GitHub Actions workflow
4. Configure Spectral linting
5. Add pre-commit hooks
6. Implement breaking change detection

### Implementation Steps

#### Step 5.1: Install Validation Tools

```bash

# Install OpenAPI validation tools

npm install --save-dev @apidevtools/swagger-cli
npm install --save-dev @stoplight/spectral-cli
npm install --save-dev husky
npm install --save-dev lint-staged

# Initialize husky

npx husky-init && npm install
```

#### Step 5.2: Create OpenAPI Export Script

**File:** `src/scripts/export-openapi.ts`

```typescript
/**
 * Export OpenAPI Specification
 *
 * Generates OpenAPI JSON spec from running application
 */

import { writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { createApp } from '../app.js';

async function exportOpenApiSpec(): Promise<void> {
  console.log('🔄 Starting OpenAPI spec export...');

  const app = await createApp();
  await app.ready();

  const spec = app.swagger();

  // Ensure dist directory exists
  await mkdir('dist', { recursive: true });

  // Write JSON spec
  const jsonPath = join('dist', 'openapi.json');
  await writeFile(jsonPath, JSON.stringify(spec, null, 2));
  console.log(`✅ OpenAPI spec exported to ${jsonPath}`);

  // Optionally write YAML spec
  // const yaml = await import('yaml');
  // const yamlPath = join('dist', 'openapi.yaml');
  // await writeFile(yamlPath, yaml.stringify(spec));
  // console.log(`✅ OpenAPI spec exported to ${yamlPath}`);

  await app.close();
  console.log('✨ Export complete!');
}

exportOpenApiSpec().catch((error) => {
  console.error('❌ Failed to export OpenAPI spec:', error);
  process.exit(1);
});
```

#### Step 5.3: Create NPM Scripts

**File:** `package.json`

Add scripts section:

```json
{
  "scripts": {
    "openapi:export": "tsx src/scripts/export-openapi.ts",
    "openapi:validate": "swagger-cli validate dist/openapi.json",
    "openapi:lint": "spectral lint dist/openapi.json --ruleset .spectral.yml",
    "openapi:bundle": "swagger-cli bundle -o dist/openapi-bundled.json -t json dist/openapi.json",
    "openapi:check": "npm run openapi:export && npm run openapi:validate && npm run openapi:lint",
    "openapi:docs": "redoc-cli bundle dist/openapi.json -o dist/openapi.html --title 'Birthday Message Scheduler API'",
    "pre-commit": "lint-staged"
  }
}
```

#### Step 5.4: Configure Spectral Linting

**File:** `.spectral.yml`

```yaml
extends: spectral:oas

rules:
  # Enforce operation IDs
  operation-operationId: error
  operation-operationId-valid-in-url: error

  # Require examples
  oas3-valid-schema-example: error
  oas3-examples-value-or-externalValue: error

  # Enforce descriptions
  operation-description: warn
  operation-summary: error
  info-description: error
  tag-description: error

  # Tag validation
  operation-tags: error
  openapi-tags: error
  operation-tag-defined: error

  # Response validation
  operation-success-response: error
  oas3-operation-security-defined: off # Auth not implemented yet

  # Schema validation
  oas3-schema: error
  oas3-valid-media-example: error

  # Custom rules
  no-$ref-siblings: error

  # Require contact info
  info-contact: warn
  contact-properties: warn

  # Require license
  info-license: warn
  license-url: warn

  # Parameter validation
  oas3-parameter-description: warn
  path-params: error
  oas3-unused-component: warn

# Custom rule definitions

overrides:
  - files:
      - '**#/components/schemas/**'
    rules:
      oas3-schema:
        severity: error
```

#### Step 5.5: Configure Lint-Staged

**File:** `.lintstagedrc.json`

```json
{
  "src/**/*.ts": [
    "eslint --fix",
    "prettier --write"
  ],
  "src/routes/**/*.ts": [
    "npm run openapi:check"
  ],
  "src/schemas/**/*.ts": [
    "npm run openapi:check"
  ]
}
```

#### Step 5.6: Create GitHub Actions Workflow

**File:** `.github/workflows/openapi-validation.yml`

```yaml
name: OpenAPI Validation

on:
  pull_request:
    paths:
      - 'src/routes/**'
      - 'src/schemas/**'
      - 'src/app.ts'
      - 'package.json'
  push:
    branches:
      - main

jobs:
  validate-openapi:
    runs-on: ubuntu-latest
    name: Validate OpenAPI Specification

    steps:
      - name: Checkout code
        uses: actions/checkout@v4
        with:
          fetch-depth: 0 # Full history for diff

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Build application
        run: npm run build

      - name: Export OpenAPI spec
        run: npm run openapi:export

      - name: Validate OpenAPI syntax
        run: npm run openapi:validate

      - name: Lint OpenAPI spec with Spectral
        run: npm run openapi:lint

      - name: Generate OpenAPI documentation
        run: |
          npm install -g redoc-cli
          npm run openapi:docs

      - name: Check for breaking changes (PR only)
        if: github.event_name == 'pull_request'
        uses: oasdiff/oasdiff-action@v0.0.15
        with:
          base: 'https://raw.githubusercontent.com/${{ github.repository }}/main/dist/openapi.json'
          revision: 'dist/openapi.json'
          fail-on-diff: false # Warning only
          format: markdown

      - name: Upload OpenAPI artifacts
        uses: actions/upload-artifact@v4
        with:
          name: openapi-spec-${{ github.sha }}
          path: |
            dist/openapi.json
            dist/openapi.html
          retention-days: 30

      - name: Comment PR with validation results
        if: github.event_name == 'pull_request'
        uses: actions/github-script@v7
        with:
          script: |
            const fs = require('fs');

            // Read validation results
            let comment = '## OpenAPI Validation Results\n\n';
            comment += '✅ OpenAPI specification is valid\n\n';

            // Add Spectral results if available
            try {
              const spectralOutput = fs.readFileSync('spectral-output.txt', 'utf8');
              if (spectralOutput) {
                comment += '### Spectral Linting\n\n';
                comment += '```\n' + spectralOutput + '\n```\n\n';
              }
            } catch (e) {
              comment += '### Spectral Linting\n\n✅ No issues found\n\n';
            }

            comment += '### Artifacts\n\n';
            comment += '- [OpenAPI JSON Spec](${{ steps.upload.outputs.artifact-url }})\n';
            comment += '- [OpenAPI HTML Docs](${{ steps.upload.outputs.artifact-url }})\n';

            // Post comment
            github.rest.issues.createComment({
              issue_number: context.issue.number,
              owner: context.repo.owner,
              repo: context.repo.repo,
              body: comment
            });
```

#### Step 5.7: Configure Pre-Commit Hook

**File:** `.husky/pre-commit`

```bash

#!/bin/sh

. "$(dirname "$0")/_/husky.sh"

# Run lint-staged

npx lint-staged

# Validate OpenAPI spec if routes or schemas changed

if git diff --cached --name-only | grep -qE '^src/(routes|schemas)/'; then
  echo "🔍 Validating OpenAPI spec..."
  npm run openapi:check || {
    echo "❌ OpenAPI validation failed"
    echo "Run 'npm run openapi:check' to see errors"
    exit 1
  }
  echo "✅ OpenAPI validation passed"
fi
```

Make it executable:

```bash
chmod +x .husky/pre-commit
```

### Testing Procedures

#### Test 5.1: Verify NPM Scripts

```bash

# Test export

npm run openapi:export

# Should create dist/openapi.json

# Test validation

npm run openapi:validate

# Should pass with no errors

# Test linting

npm run openapi:lint

# Should pass Spectral rules

# Test full check

npm run openapi:check

# Should run all validations

```

#### Test 5.2: Test Pre-Commit Hook

```bash

# Make change to route file

echo "// test comment" >> src/routes/user.routes.ts

# Stage change

git add src/routes/user.routes.ts

# Attempt commit

git commit -m "test: verify pre-commit hook"

# Should trigger OpenAPI validation
# Restore file after test

git restore src/routes/user.routes.ts
```

#### Test 5.3: Verify GitHub Actions Workflow

```bash

# Create test branch

git checkout -b test/openapi-validation

# Make change to schema

echo "// test change" >> src/schemas/user.schemas.ts

# Commit and push

git add .
git commit -m "test: verify GitHub Actions"
git push origin test/openapi-validation

# Create PR on GitHub
# Verify workflow runs successfully

```

### Deliverables

- OpenAPI validation tools installed
- NPM scripts for validation
- Spectral linting configuration
- GitHub Actions workflow
- Pre-commit hooks configured
- All validations passing

### Time Estimate

- Install tools and configure: 4 hours
- Create scripts and workflows: 4 hours
- Testing and debugging: 4 hours
- Documentation: 2 hours
- **Total: 14 hours (1.75 days)**

---

## Phase 6: Swagger UI Enhancement

**Duration:** 1 day
**Priority:** Low
**Dependencies:** Phase 1-5 complete

### Objectives

1. Enhance Swagger UI visual appearance
2. Add custom branding
3. Improve navigation and UX
4. Add authentication UI (for future)
5. Add custom CSS styling

### Implementation Steps

#### Step 6.1: Enhanced Swagger UI Configuration

**File:** `src/app.ts`

Update Swagger UI registration:

```typescript
await app.register(swaggerUi, {
  routePrefix: '/docs',
  uiConfig: {
    docExpansion: 'list',
    deepLinking: true,
    displayOperationId: true,
    displayRequestDuration: true,
    filter: true,
    showExtensions: true,
    tryItOutEnabled: true,
    persistAuthorization: true,
    syntaxHighlight: {
      activate: true,
      theme: 'monokai',
    },
    // Custom layout
    defaultModelsExpandDepth: 3,
    defaultModelExpandDepth: 3,
    defaultModelRendering: 'model',
    displayRequestDuration: true,
    showCommonExtensions: true,
    showExtensions: true,
    // Try it out defaults
    requestSnippetsEnabled: true,
    requestSnippets: {
      generators: {
        curl_bash: {
          title: 'cURL (bash)',
          syntax: 'bash',
        },
        curl_powershell: {
          title: 'cURL (PowerShell)',
          syntax: 'powershell',
        },
        curl_cmd: {
          title: 'cURL (CMD)',
          syntax: 'bash',
        },
      },
    },
  },
  uiHooks: {
    onRequest: (request, reply, next) => {
      request.log.info(
        {
          path: request.url,
          ip: request.ip,
          userAgent: request.headers['user-agent'],
        },
        'Swagger UI accessed'
      );
      next();
    },
  },
  staticCSP: true,
  transformStaticCSP: (header) => header,
  transformSpecification: (swaggerObject, request, reply) => {
    // Add current server
    swaggerObject.servers = [
      {
        url: `${request.protocol}://${request.hostname}${
          request.hostname === 'localhost' ? `:${env.PORT}` : ''
        }`,
        description: 'Current server',
      },
      ...swaggerObject.servers,
    ];

    // Add custom info
    swaggerObject.info['x-logo'] = {
      url: 'https://example.com/logo.png',
      altText: 'Birthday Message Scheduler',
    };

    return swaggerObject;
  },
  transformSpecificationClone: true,

  // Custom theming
  theme: {
    title: 'Birthday Message Scheduler API Documentation',
    css: [
      {
        filename: 'custom-swagger-ui.css',
        content: `
          /* Custom Swagger UI Styles */

          /* Brand colors */
          :root {
            --primary-color: #4a90e2;
            --success-color: #52c41a;
            --warning-color: #faad14;
            --error-color: #f5222d;
          }

          /* Header customization */
          .swagger-ui .topbar {
            background-color: var(--primary-color);
            border-bottom: 3px solid #357abd;
          }

          .swagger-ui .topbar .link {
            display: none;
          }

          /* Info section */
          .swagger-ui .info {
            margin: 30px 0;
          }

          .swagger-ui .info .title {
            font-size: 2.5em;
            color: var(--primary-color);
          }

          /* Operation methods */
          .swagger-ui .opblock.opblock-post {
            border-color: var(--success-color);
            background: rgba(82, 196, 26, 0.1);
          }

          .swagger-ui .opblock.opblock-get {
            border-color: var(--primary-color);
            background: rgba(74, 144, 226, 0.1);
          }

          .swagger-ui .opblock.opblock-put {
            border-color: var(--warning-color);
            background: rgba(250, 173, 20, 0.1);
          }

          .swagger-ui .opblock.opblock-delete {
            border-color: var(--error-color);
            background: rgba(245, 34, 45, 0.1);
          }

          /* Response highlights */
          .swagger-ui .responses-inner h4,
          .swagger-ui .responses-inner h5 {
            font-size: 14px;
            font-weight: 600;
          }

          .swagger-ui .response .response-col_status {
            font-size: 16px;
            font-weight: 700;
          }

          /* Code blocks */
          .swagger-ui .highlight-code {
            border-radius: 4px;
          }

          /* Try it out button */
          .swagger-ui .try-out__btn {
            background-color: var(--primary-color);
            color: white;
            border: none;
            padding: 8px 16px;
            border-radius: 4px;
            font-weight: 600;
          }

          .swagger-ui .btn.execute {
            background-color: var(--success-color);
            color: white;
            border: none;
            padding: 10px 20px;
            border-radius: 4px;
            font-weight: 600;
          }

          /* Model section */
          .swagger-ui .model {
            font-family: 'Monaco', 'Menlo', monospace;
          }

          /* Scrollbar customization */
          .swagger-ui ::-webkit-scrollbar {
            width: 10px;
            height: 10px;
          }

          .swagger-ui ::-webkit-scrollbar-track {
            background: #f1f1f1;
          }

          .swagger-ui ::-webkit-scrollbar-thumb {
            background: #888;
            border-radius: 5px;
          }

          .swagger-ui ::-webkit-scrollbar-thumb:hover {
            background: #555;
          }
        `,
      },
    ],
  },
});
```

#### Step 6.2: Add Custom Landing Page

**File:** `src/routes/docs.routes.ts`

```typescript
/**
 * Documentation Landing Page Routes
 */

import type { FastifyInstance } from 'fastify';

export async function docsRoutes(app: FastifyInstance): Promise<void> {
  /**
   * Redirect / to /docs for convenience
   */
  app.get('/', async (_request, reply) => {
    return reply.redirect(301, '/docs');
  });

  /**
   * API documentation landing page
   */
  app.get('/api-docs', async (_request, reply) => {
    const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Birthday Message Scheduler API Documentation</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
            line-height: 1.6;
            color: #333;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 20px;
        }

        .container {
            max-width: 1000px;
            background: white;
            border-radius: 10px;
            padding: 40px;
            box-shadow: 0 10px 40px rgba(0,0,0,0.2);
        }

        h1 {
            color: #667eea;
            font-size: 2.5em;
            margin-bottom: 10px;
        }

        .subtitle {
            color: #666;
            font-size: 1.2em;
            margin-bottom: 30px;
        }

        .section {
            margin-bottom: 30px;
        }

        .section h2 {
            color: #764ba2;
            margin-bottom: 15px;
            font-size: 1.5em;
        }

        .features {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
            gap: 20px;
            margin-top: 20px;
        }

        .feature {
            padding: 20px;
            background: #f8f9fa;
            border-radius: 8px;
            border-left: 4px solid #667eea;
        }

        .feature h3 {
            color: #667eea;
            margin-bottom: 10px;
        }

        .cta-buttons {
            display: flex;
            gap: 15px;
            margin-top: 30px;
            flex-wrap: wrap;
        }

        .btn {
            display: inline-block;
            padding: 12px 30px;
            text-decoration: none;
            border-radius: 5px;
            font-weight: 600;
            transition: transform 0.2s, box-shadow 0.2s;
        }

        .btn:hover {
            transform: translateY(-2px);
            box-shadow: 0 5px 15px rgba(0,0,0,0.2);
        }

        .btn-primary {
            background: #667eea;
            color: white;
        }

        .btn-secondary {
            background: #764ba2;
            color: white;
        }

        .btn-outline {
            background: transparent;
            border: 2px solid #667eea;
            color: #667eea;
        }

        .endpoints {
            background: #f8f9fa;
            border-radius: 8px;
            padding: 20px;
            margin-top: 20px;
        }

        .endpoint {
            display: flex;
            align-items: center;
            padding: 10px;
            margin: 5px 0;
            background: white;
            border-radius: 4px;
        }

        .method {
            padding: 4px 8px;
            border-radius: 4px;
            font-weight: 600;
            font-size: 0.85em;
            margin-right: 15px;
            min-width: 60px;
            text-align: center;
        }

        .method.post { background: #52c41a; color: white; }
        .method.get { background: #4a90e2; color: white; }
        .method.put { background: #faad14; color: white; }
        .method.delete { background: #f5222d; color: white; }

        .path {
            font-family: 'Monaco', 'Menlo', monospace;
            color: #666;
        }

        .stats {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
            gap: 15px;
            margin-top: 20px;
        }

        .stat {
            text-align: center;
            padding: 20px;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            border-radius: 8px;
        }

        .stat-number {
            font-size: 2em;
            font-weight: 700;
        }

        .stat-label {
            font-size: 0.9em;
            opacity: 0.9;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>🎂 Birthday Message Scheduler API</h1>
        <p class="subtitle">Timezone-aware birthday message scheduler with comprehensive API documentation</p>

        <div class="section">
            <h2>Quick Start</h2>
            <div class="cta-buttons">
                <a href="/docs" class="btn btn-primary">Interactive API Docs (Swagger UI)</a>
                <a href="/docs/json" class="btn btn-secondary">OpenAPI 3.1 Spec (JSON)</a>
                <a href="https://docs.example.com" class="btn btn-outline">Full Documentation</a>
            </div>
        </div>

        <div class="section">
            <h2>📊 API Overview</h2>
            <div class="stats">
                <div class="stat">
                    <div class="stat-number">10</div>
                    <div class="stat-label">Endpoints</div>
                </div>
                <div class="stat">
                    <div class="stat-number">3</div>
                    <div class="stat-label">Resource Types</div>
                </div>
                <div class="stat">
                    <div class="stat-number">3.1</div>
                    <div class="stat-label">OpenAPI Version</div>
                </div>
                <div class="stat">
                    <div class="stat-number">1.0.0</div>
                    <div class="stat-label">API Version</div>
                </div>
            </div>
        </div>

        <div class="section">
            <h2>✨ Key Features</h2>
            <div class="features">
                <div class="feature">
                    <h3>🌍 Timezone-Aware</h3>
                    <p>Full IANA timezone support for accurate message scheduling across the globe</p>
                </div>
                <div class="feature">
                    <h3>🔒 Rate Limited</h3>
                    <p>Built-in rate limiting (10-100 req/min) with clear error messages</p>
                </div>
                <div class="feature">
                    <h3>📝 RFC 9457 Compliant</h3>
                    <p>Standardized error responses following Problem Details specification</p>
                </div>
                <div class="feature">
                    <h3>📊 Observable</h3>
                    <p>Prometheus metrics and comprehensive health checks</p>
                </div>
                <div class="feature">
                    <h3>🔄 Idempotent</h3>
                    <p>Exactly-once message delivery with idempotency guarantees</p>
                </div>
                <div class="feature">
                    <h3>🗑️ Soft Delete</h3>
                    <p>Preserve data integrity with soft delete support</p>
                </div>
            </div>
        </div>

        <div class="section">
            <h2>🔌 Available Endpoints</h2>
            <div class="endpoints">
                <div class="endpoint">
                    <span class="method post">POST</span>
                    <span class="path">/api/v1/users</span>
                </div>
                <div class="endpoint">
                    <span class="method get">GET</span>
                    <span class="path">/api/v1/users/:id</span>
                </div>
                <div class="endpoint">
                    <span class="method put">PUT</span>
                    <span class="path">/api/v1/users/:id</span>
                </div>
                <div class="endpoint">
                    <span class="method delete">DELETE</span>
                    <span class="path">/api/v1/users/:id</span>
                </div>
                <div class="endpoint">
                    <span class="method get">GET</span>
                    <span class="path">/health</span>
                </div>
                <div class="endpoint">
                    <span class="method get">GET</span>
                    <span class="path">/ready</span>
                </div>
                <div class="endpoint">
                    <span class="method get">GET</span>
                    <span class="path">/live</span>
                </div>
                <div class="endpoint">
                    <span class="method get">GET</span>
                    <span class="path">/health/schedulers</span>
                </div>
                <div class="endpoint">
                    <span class="method get">GET</span>
                    <span class="path">/metrics</span>
                </div>
                <div class="endpoint">
                    <span class="method get">GET</span>
                    <span class="path">/metrics/summary</span>
                </div>
            </div>
        </div>
    </div>
</body>
</html>
    `;

    return reply.type('text/html').send(html);
  });
}
```

Register in `src/app.ts`:

```typescript
import { docsRoutes } from './routes/docs.routes.js';

// Register documentation routes
await app.register(docsRoutes);
```

### Testing Procedures

#### Test 6.1: Verify Enhanced UI

```bash

# Start application

npm run dev

# Open Swagger UI

open http://localhost:3000/docs

# Verify enhancements:
# - Custom styling applied
# - Brand colors visible
# - Request snippets available
# - Syntax highlighting works
# - Navigation smooth

```

#### Test 6.2: Test Landing Page

```bash

# Open landing page

open http://localhost:3000/api-docs

# Verify:
# - Proper styling
# - All links work
# - Stats display correctly
# - Endpoints list complete

```

### Deliverables

- Enhanced Swagger UI with custom styling
- Custom landing page
- Improved navigation and UX
- Better visual hierarchy

### Time Estimate

- Custom styling: 3 hours
- Landing page: 2 hours
- Testing and refinement: 2 hours
- **Total: 7 hours (1 day)**

---

## Testing Procedures

### Integration Testing

#### Test Suite 1: Full OpenAPI Validation

**File:** `tests/openapi.test.ts`

```typescript
import { test } from 'node:test';
import assert from 'node:assert';
import { createApp } from '../src/app.js';

test('OpenAPI specification', async (t) => {
  const app = await createApp();
  await app.ready();

  await t.test('should be valid OpenAPI 3.1', () => {
    const spec = app.swagger();
    assert.strictEqual(spec.openapi, '3.1.0');
  });

  await t.test('should have required metadata', () => {
    const spec = app.swagger();
    assert.ok(spec.info.title);
    assert.ok(spec.info.version);
    assert.ok(spec.info.description);
    assert.ok(spec.info.contact);
    assert.ok(spec.info.license);
  });

  await t.test('should have all endpoints documented', () => {
    const spec = app.swagger();
    const paths = Object.keys(spec.paths);

    // User endpoints
    assert.ok(paths.includes('/api/v1/users'));
    assert.ok(paths.includes('/api/v1/users/{id}'));

    // Health endpoints
    assert.ok(paths.includes('/health'));
    assert.ok(paths.includes('/ready'));
    assert.ok(paths.includes('/live'));
    assert.ok(paths.includes('/health/schedulers'));

    // Metrics endpoints
    assert.ok(paths.includes('/metrics'));
    assert.ok(paths.includes('/metrics/summary'));
  });

  await t.test('should have reusable components', () => {
    const spec = app.swagger();
    assert.ok(spec.components.schemas);
    assert.ok(spec.components.responses);
    assert.ok(spec.components.parameters);
    assert.ok(spec.components.securitySchemes);
  });

  await t.test('all endpoints should have operationId', () => {
    const spec = app.swagger();
    for (const [path, pathItem] of Object.entries(spec.paths)) {
      for (const [method, operation] of Object.entries(pathItem)) {
        if (['get', 'post', 'put', 'delete', 'patch'].includes(method)) {
          assert.ok(
            operation.operationId,
            `${method.toUpperCase()} ${path} missing operationId`
          );
        }
      }
    }
  });

  await app.close();
});
```

Run tests:

```bash
npm test tests/openapi.test.ts
```

### Manual Testing Checklist

#### Checklist 1: Swagger UI Verification

- [ ] Swagger UI loads at `/docs`
- [ ] Custom styling applied
- [ ] All endpoints visible
- [ ] Examples populate in "Try it out"
- [ ] Error examples display correctly
- [ ] Request/response formats correct
- [ ] Authentication section visible (for future)
- [ ] Search filter works
- [ ] Deep linking works

#### Checklist 2: OpenAPI Spec Validation

- [ ] Spec exports successfully
- [ ] Version is 3.1.0
- [ ] All metadata present
- [ ] Components registered
- [ ] No validation errors
- [ ] Spectral linting passes
- [ ] Breaking change detection works

#### Checklist 3: CI/CD Pipeline

- [ ] GitHub Actions workflow triggers
- [ ] Validation passes in CI
- [ ] Artifacts uploaded
- [ ] PR comments posted
- [ ] Pre-commit hook works
- [ ] Lint-staged runs correctly

---

## Timeline and Resources

### Phase Summary

| Phase | Duration | Dependencies | Priority |
|-------|----------|--------------|----------|
| Phase 0: Current State Assessment | 1 day | None | High |
| Phase 1: Upgrade to OpenAPI 3.1 | 1 day | Phase 0 | High |
| Phase 2: Schema Organization | 1.5 days | Phase 1 | High |
| Phase 3: Comprehensive Examples | 1.25 days | Phase 2 | Medium |
| Phase 4: Error Documentation | 0.25 days | Phase 2 | Medium |
| Phase 5: CI/CD Integration | 1.75 days | Phase 1-4 | High |
| Phase 6: Swagger UI Enhancement | 1 day | Phase 1-5 | Low |

**Total Duration:** 7.75 days (approximately 2 weeks)

### Resource Requirements

**Personnel:**
- 1 Backend Developer (full-time)
- 1 DevOps Engineer (for Phase 5, 2 days)
- 1 Technical Writer (for review, 1 day)

**Tools & Dependencies:**
- `@fastify/swagger` (already installed)
- `@fastify/swagger-ui` (already installed)
- `@apidevtools/swagger-cli` (new)
- `@stoplight/spectral-cli` (new)
- `husky` (new)
- `lint-staged` (new)
- `redoc-cli` (optional, for HTML docs)

**Budget:**
- Zero additional costs (all open-source tools)
- Estimated developer time: ~80 hours

### Implementation Schedule

**Week 1:**
- Days 1-2: Phase 0 & Phase 1 (Assessment + OpenAPI 3.1 upgrade)
- Days 3-4: Phase 2 (Schema organization)
- Day 5: Phase 3 (Start examples)

**Week 2:**
- Days 1-2: Phase 3 & Phase 4 (Complete examples + error docs)
- Days 3-4: Phase 5 (CI/CD integration)
- Day 5: Phase 6 (Swagger UI enhancement) + buffer

### Risk Assessment

**Low Risk:**
- Enhancement-only approach
- No breaking changes
- Existing functionality unchanged
- Incremental implementation

**Mitigation:**
- Comprehensive testing at each phase
- Pre-commit hooks prevent bad commits
- CI/CD validation catches issues early
- Can roll back individual phases if needed

---

## Conclusion

This implementation plan provides a comprehensive, step-by-step guide to upgrading the Birthday Message Scheduler API's OpenAPI documentation to version 3.1 with:

1. **Organized Schema Architecture** - Reusable components eliminate duplication
2. **Comprehensive Documentation** - Examples, descriptions, and error scenarios
3. **RFC 9457 Compliance** - Standardized error responses
4. **CI/CD Integration** - Automated validation prevents documentation drift
5. **Enhanced Developer Experience** - Improved Swagger UI and custom landing page

The enhancement-only approach minimizes risk while delivering significant improvements to API documentation quality and developer experience.

**Next Steps:**
1. Review and approve this plan
2. Begin Phase 0 (current state assessment)
3. Proceed through phases sequentially
4. Validate at each phase before continuing
5. Deploy to production after Phase 5 completion

---

**Document End**
