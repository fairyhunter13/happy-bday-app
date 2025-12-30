# OpenAPI 3.1 Documentation Implementation Research

**Document Version:** 1.0
**Last Updated:** 2025-12-30
**Project:** Birthday Message Scheduler API
**Status:** Research Complete - Ready for Implementation

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [OpenAPI with Fastify](#openapi-with-fastify)
3. [Library Comparison & Recommendations](#library-comparison--recommendations)
4. [Integration with Existing Zod Schemas](#integration-with-existing-zod-schemas)
5. [API Documentation Structure](#api-documentation-structure)
6. [Implementation Architecture](#implementation-architecture)
7. [Step-by-Step Implementation Plan](#step-by-step-implementation-plan)
8. [Endpoint Documentation Examples](#endpoint-documentation-examples)
9. [Vendor API Specification](#vendor-api-specification)
10. [CI/CD Integration](#cicd-integration)
11. [Best Practices & Conventions](#best-practices--conventions)
12. [Code Examples](#code-examples)

---

## Executive Summary

### Objectives

Implement comprehensive OpenAPI 3.1 specification for the Birthday Message Scheduler API to:
- **Auto-generate API documentation** from existing Zod validation schemas
- **Improve developer experience** with interactive Swagger UI
- **Enable SDK generation** for client applications
- **Validate API contracts** in CI/CD pipeline
- **Document all endpoints** with request/response examples

### Current State

✅ **Already Implemented:**
- Fastify with `@fastify/swagger` (v9.4.0)
- Fastify with `@fastify/swagger-ui` (v5.2.0)
- Zod validation schemas (v3.24.1)
- OpenAPI schemas in route definitions
- Swagger UI at `/docs`

### Recommended Approach

**Option:** **Enhance Current Implementation** (NOT migrate to fastify-zod-openapi)

**Rationale:**
1. ✅ Current setup already works and generates OpenAPI 3.0 spec
2. ✅ Manual schemas provide fine-grained control over documentation
3. ✅ No breaking changes or migration required
4. ✅ Team is familiar with current patterns
5. ⚡ Quick wins by enhancing existing schemas

**Enhancement Plan:**
- Upgrade OpenAPI version to 3.1.0 (from 3.0.0)
- Add comprehensive examples and descriptions
- Document error responses (RFC 9457 Problem Details)
- Add rate limiting headers
- Document authentication when implemented
- Add CI/CD validation

---

## OpenAPI with Fastify

### Ecosystem Overview

The Fastify ecosystem offers multiple approaches for OpenAPI documentation:

| Library | Purpose | OpenAPI Version | Zod Integration | Status |
|---------|---------|----------------|-----------------|--------|
| **@fastify/swagger** | Generate OpenAPI from routes | 2.0, 3.0, 3.1 | Manual mapping | ✅ Current |
| **@fastify/swagger-ui** | Serve Swagger UI | N/A | N/A | ✅ Current |
| **fastify-type-provider-zod** | Type provider + schema transform | 3.0, 3.1 | Automatic | Alternative |
| **fastify-zod-openapi** | Full Zod-to-OpenAPI | 3.1 | Native | Alternative |
| **zod-to-json-schema** | Convert Zod → JSON Schema | N/A | Native | Utility |

### Current Implementation Analysis

**File:** `src/app.ts`

```typescript
await app.register(swagger, {
  openapi: {  // ← Currently uses OpenAPI 3.0
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
```

**Strengths:**
- ✅ Simple and explicit
- ✅ No magic or hidden transformations
- ✅ Full control over OpenAPI output
- ✅ Works with existing Zod schemas via manual mapping

**Weaknesses:**
- ⚠️ Duplicates schema definitions (Zod + JSON Schema)
- ⚠️ Manual synchronization required
- ⚠️ No automatic type inference from OpenAPI to TypeScript

---

## Library Comparison & Recommendations

### Option 1: Enhance Current Setup (RECOMMENDED)

**Approach:** Continue using `@fastify/swagger` + manual JSON Schema

**Pros:**
- ✅ Zero migration effort
- ✅ Team already familiar with patterns
- ✅ Full control over documentation
- ✅ Works with existing 47 source files
- ✅ Gradual improvement possible

**Cons:**
- ⚠️ Schema duplication (Zod validator + JSON Schema for docs)
- ⚠️ Manual synchronization needed

**Best for:**
- ✅ Quick wins
- ✅ Stable APIs with infrequent schema changes
- ✅ Teams preferring explicit over implicit

### Option 2: Migrate to fastify-type-provider-zod

**Approach:** Use type provider to auto-generate schemas from Zod

**Implementation:**
```typescript
import {
  serializerCompiler,
  validatorCompiler,
  jsonSchemaTransform
} from 'fastify-type-provider-zod';

app.setValidatorCompiler(validatorCompiler);
app.setSerializerCompiler(serializerCompiler);

await app.register(swagger, {
  openapi: {
    openapi: '3.1.0',  // ← Supports 3.1
    // ...
  },
  transform: jsonSchemaTransform  // ← Auto-convert Zod to JSON Schema
});
```

**Pros:**
- ✅ Single source of truth (Zod schemas)
- ✅ Automatic type inference
- ✅ Less code duplication
- ✅ Supports OpenAPI 3.1

**Cons:**
- ⚠️ Requires refactoring 47 TypeScript files
- ⚠️ Less control over OpenAPI output
- ⚠️ Team learning curve
- ⚠️ Breaking changes to route definitions

**Best for:**
- New projects
- APIs with frequently changing schemas
- Teams prioritizing DRY principles

### Option 3: Migrate to fastify-zod-openapi

**Approach:** Full Zod-first approach with native OpenAPI 3.1 support

**Implementation:**
```typescript
import { extendZodWithOpenApi } from 'zod-openapi';
import { createSerializerCompiler } from 'fastify-zod-openapi';

extendZodWithOpenApi(z);

const userSchema = z.object({
  firstName: z.string(),
  email: z.string().email(),
}).openapi({
  description: 'User object',
  example: { firstName: 'John', email: 'john@example.com' }
});
```

**Pros:**
- ✅ Native OpenAPI 3.1 support
- ✅ Zod schemas with `.openapi()` metadata
- ✅ Best type safety
- ✅ Future-proof

**Cons:**
- ⚠️ Most invasive migration
- ⚠️ Requires changing all Zod schemas
- ⚠️ Relatively new library (less battle-tested)
- ⚠️ Highest learning curve

**Best for:**
- Greenfield projects
- APIs requiring OpenAPI 3.1 features
- Teams wanting best-in-class type safety

### Recommendation: OPTION 1 (Enhance Current Setup)

**Decision:** Stick with current `@fastify/swagger` implementation

**Justification:**
1. ✅ **Pragmatic** - Working code should not be rewritten without strong reason
2. ✅ **Low Risk** - No breaking changes or migration bugs
3. ✅ **Fast ROI** - Can enhance schemas incrementally
4. ✅ **Team Velocity** - No onboarding required
5. ✅ **Sufficient** - Current approach meets all requirements

**Migration Path (Future):**
If schema duplication becomes painful:
1. Phase 1: Enhance current schemas (this phase)
2. Phase 2: Evaluate `fastify-type-provider-zod` in 6 months
3. Phase 3: Migrate if ROI is positive

---

## Integration with Existing Zod Schemas

### Current Pattern (User Routes)

**Zod Validation Schema:**
```typescript
// src/validators/user.validator.ts
export const createUserSchema = z.object({
  firstName: z.string().min(1).max(100).trim(),
  lastName: z.string().min(1).max(100).trim(),
  email: z.string().email().max(255).toLowerCase().trim(),
  timezone: timezoneSchema,
  birthdayDate: dateStringSchema.optional(),
  anniversaryDate: dateStringSchema.optional(),
  locationCity: z.string().max(100).trim().optional(),
  locationCountry: z.string().max(100).trim().optional(),
});
```

**OpenAPI JSON Schema (Routes):**
```typescript
// src/routes/user.routes.ts
const createUserSchema = {
  type: 'object',
  required: ['firstName', 'lastName', 'email', 'timezone'],
  properties: {
    firstName: {
      type: 'string',
      minLength: 1,
      maxLength: 100,
      description: 'User first name',
      example: 'John'
    },
    lastName: {
      type: 'string',
      minLength: 1,
      maxLength: 100,
      description: 'User last name',
      example: 'Doe'
    },
    email: {
      type: 'string',
      format: 'email',
      maxLength: 255,
      description: 'User email address (unique)',
      example: 'john.doe@example.com'
    },
    timezone: {
      type: 'string',
      description: 'IANA timezone identifier',
      example: 'America/New_York',
      pattern: '^[A-Za-z]+/[A-Za-z_]+$'
    },
    birthdayDate: {
      type: 'string',
      format: 'date',
      description: 'User birthday (YYYY-MM-DD)',
      example: '1990-01-15',
      nullable: true
    },
    anniversaryDate: {
      type: 'string',
      format: 'date',
      description: 'Anniversary date (YYYY-MM-DD)',
      example: '2015-06-20',
      nullable: true
    },
    locationCity: {
      type: 'string',
      maxLength: 100,
      description: 'City of residence',
      example: 'New York',
      nullable: true
    },
    locationCountry: {
      type: 'string',
      maxLength: 100,
      description: 'Country of residence',
      example: 'United States',
      nullable: true
    },
  },
};
```

### Enhanced Pattern (Recommended)

**Create Shared Schema Utility:**

```typescript
// src/schemas/openapi.schemas.ts
import { z } from 'zod';

/**
 * Convert Zod schema to OpenAPI-compatible JSON Schema
 * Use for documentation while keeping Zod for runtime validation
 */
export function zodToOpenApi<T extends z.ZodType>(
  zodSchema: T,
  options?: {
    description?: string;
    examples?: unknown[];
  }
) {
  // Manual conversion for now
  // Future: use zod-to-json-schema if needed
  return {
    // ... JSON Schema representation
    ...options,
  };
}

/**
 * Standard error response schema (RFC 9457 Problem Details)
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
          description: 'Machine-readable error code',
          example: 'VALIDATION_ERROR'
        },
        message: {
          type: 'string',
          description: 'Human-readable error message',
          example: 'Invalid email format'
        },
        details: {
          type: 'object',
          description: 'Additional error context (field-specific errors, etc.)',
          additionalProperties: true,
          example: {
            fields: {
              email: 'Invalid email format'
            }
          }
        },
      },
    },
    timestamp: {
      type: 'string',
      format: 'date-time',
      description: 'Error occurrence timestamp (ISO 8601)',
      example: '2025-01-15T09:00:00.000Z'
    },
    path: {
      type: 'string',
      description: 'Request path that caused the error',
      example: '/api/v1/users'
    },
  },
};

/**
 * Standard success response wrapper
 */
export const successResponseSchema = {
  type: 'object',
  required: ['success', 'data', 'timestamp'],
  properties: {
    success: {
      type: 'boolean',
      example: true,
      description: 'Indicates successful operation'
    },
    data: {
      type: 'object',
      description: 'Response payload'
    },
    timestamp: {
      type: 'string',
      format: 'date-time',
      description: 'Response timestamp (ISO 8601)',
      example: '2025-01-15T09:00:00.000Z'
    },
  },
};
```

### Validation Flow

```
┌─────────────┐
│   Request   │
└──────┬──────┘
       │
       ▼
┌─────────────────────┐
│  Zod Validation     │  ← Runtime validation (createUserSchema)
│  (validators/)      │     Throws on invalid data
└──────┬──────────────┘
       │ (valid data)
       ▼
┌─────────────────────┐
│  Route Handler      │
│  (controllers/)     │
└──────┬──────────────┘
       │
       ▼
┌─────────────────────┐
│  Response           │
└─────────────────────┘

Separately:
┌─────────────────────┐
│  OpenAPI Schema     │  ← Documentation only (JSON Schema in routes)
│  (routes/*.routes)  │     Not used for validation
└─────────────────────┘
```

**Key Insight:** Keep Zod and JSON Schema separate
- **Zod:** Runtime validation and TypeScript types
- **JSON Schema:** OpenAPI documentation and Swagger UI
- **Synchronization:** Manual for now (acceptable trade-off)

---

## API Documentation Structure

### Complete Endpoint Inventory

#### User Management Endpoints

| Method | Path | Description | Status |
|--------|------|-------------|--------|
| POST | `/api/v1/users` | Create new user | ✅ Documented |
| GET | `/api/v1/users/:id` | Get user by ID | ✅ Documented |
| PUT | `/api/v1/users/:id` | Update user | ✅ Documented |
| DELETE | `/api/v1/users/:id` | Soft delete user | ✅ Documented |

#### Health Check Endpoints

| Method | Path | Description | Status |
|--------|------|-------------|--------|
| GET | `/health` | Application health | ✅ Documented |
| GET | `/health/live` | Liveness probe (K8s) | ✅ Documented |
| GET | `/health/ready` | Readiness probe (K8s) | ✅ Documented |
| GET | `/health/schedulers` | Scheduler health | ✅ Documented |

#### Metrics Endpoints

| Method | Path | Description | Status |
|--------|------|-------------|--------|
| GET | `/metrics` | Prometheus metrics | ✅ Documented |
| GET | `/metrics/summary` | JSON metrics (debug) | ✅ Documented |

### OpenAPI Tag Structure

```yaml
tags:
  - name: users
    description: User management operations
    externalDocs:
      description: User Management Guide
      url: https://docs.example.com/users

  - name: health
    description: Health check and readiness probes
    externalDocs:
      description: Health Check Guide
      url: https://docs.example.com/health

  - name: metrics
    description: Prometheus metrics and observability
    externalDocs:
      description: Metrics Guide
      url: https://docs.example.com/metrics
```

### Schema Component Organization

```yaml
components:
  schemas:
    # Domain Models
    User:
      type: object
      description: User entity with birthday/anniversary tracking
      # ...

    MessageLog:
      type: object
      description: Message delivery log entry
      # ...

    # Request DTOs
    CreateUserRequest:
      type: object
      description: Request body for creating a new user
      # ...

    UpdateUserRequest:
      type: object
      description: Request body for updating user (partial)
      # ...

    # Response DTOs
    SuccessResponse:
      type: object
      description: Standard success response wrapper
      # ...

    ErrorResponse:
      type: object
      description: Standard error response (RFC 9457)
      # ...

    # Enums
    MessageStatus:
      type: string
      enum: [SCHEDULED, QUEUED, SENDING, SENT, FAILED, RETRYING]
      # ...

    MessageType:
      type: string
      enum: [BIRTHDAY, ANNIVERSARY]
      # ...

  # Reusable Parameters
  parameters:
    userId:
      name: id
      in: path
      required: true
      description: User UUID
      schema:
        type: string
        format: uuid

  # Reusable Responses
  responses:
    BadRequest:
      description: Validation error or malformed request
      content:
        application/json:
          schema:
            $ref: '#/components/schemas/ErrorResponse'
          example:
            error:
              code: VALIDATION_ERROR
              message: Invalid request data
              details:
                fields:
                  email: Invalid email format
            timestamp: 2025-01-15T09:00:00.000Z
            path: /api/v1/users

    NotFound:
      description: Resource not found
      content:
        application/json:
          schema:
            $ref: '#/components/schemas/ErrorResponse'
          example:
            error:
              code: NOT_FOUND
              message: User not found
            timestamp: 2025-01-15T09:00:00.000Z
            path: /api/v1/users/550e8400-e29b-41d4-a716-446655440000

    Conflict:
      description: Resource conflict (e.g., email already exists)
      content:
        application/json:
          schema:
            $ref: '#/components/schemas/ErrorResponse'
          example:
            error:
              code: CONFLICT
              message: Email already exists
              details:
                email: john.doe@example.com
            timestamp: 2025-01-15T09:00:00.000Z
            path: /api/v1/users

    RateLimitExceeded:
      description: Too many requests
      headers:
        X-RateLimit-Limit:
          description: Request limit per window
          schema:
            type: integer
            example: 100
        X-RateLimit-Remaining:
          description: Remaining requests in current window
          schema:
            type: integer
            example: 0
        X-RateLimit-Reset:
          description: Unix timestamp when limit resets
          schema:
            type: integer
            example: 1704110460
        Retry-After:
          description: Seconds to wait before retry
          schema:
            type: integer
            example: 60
      content:
        application/json:
          schema:
            $ref: '#/components/schemas/ErrorResponse'
          example:
            error:
              code: RATE_LIMIT_EXCEEDED
              message: Rate limit exceeded, retry in 60 seconds
            timestamp: 2025-01-15T09:00:00.000Z

    InternalServerError:
      description: Internal server error
      content:
        application/json:
          schema:
            $ref: '#/components/schemas/ErrorResponse'
          example:
            error:
              code: INTERNAL_SERVER_ERROR
              message: An unexpected error occurred
            timestamp: 2025-01-15T09:00:00.000Z
            path: /api/v1/users

  # Security Schemes (for future auth)
  securitySchemes:
    BearerAuth:
      type: http
      scheme: bearer
      bearerFormat: JWT
      description: JWT token obtained from /auth/login

    ApiKeyAuth:
      type: apiKey
      in: header
      name: X-API-Key
      description: API key for service-to-service authentication
```

---

## Implementation Architecture

### Directory Structure

```
src/
├── app.ts                      # Fastify app + @fastify/swagger config
├── routes/
│   ├── user.routes.ts          # User endpoints + OpenAPI schemas
│   ├── health.routes.ts        # Health endpoints + OpenAPI schemas
│   └── metrics.routes.ts       # Metrics endpoints + OpenAPI schemas
├── schemas/
│   ├── openapi.schemas.ts      # Shared OpenAPI schemas (NEW)
│   ├── user.schemas.ts         # User domain schemas (NEW)
│   ├── error.schemas.ts        # Error response schemas (NEW)
│   └── components.ts           # Reusable components ($ref) (NEW)
├── validators/
│   └── user.validator.ts       # Zod validation schemas (EXISTING)
├── controllers/
│   ├── user.controller.ts      # Request handlers
│   ├── health.controller.ts
│   └── metrics.controller.ts
└── types/
    ├── dto.ts                  # Type inference from Zod
    └── index.ts

docs/
└── vendor-specs/
    └── email-service-api-analysis.md  # Vendor API documentation
```

### Schema Organization Strategy

```typescript
// src/schemas/openapi.schemas.ts
export * from './user.schemas.js';
export * from './error.schemas.js';
export * from './components.js';

// src/schemas/user.schemas.ts
export const userSchema = { /* ... */ };
export const createUserRequestSchema = { /* ... */ };
export const updateUserRequestSchema = { /* ... */ };

// src/schemas/error.schemas.ts
export const errorResponseSchema = { /* ... */ };
export const validationErrorSchema = { /* ... */ };

// src/schemas/components.ts
export const components = {
  schemas: { /* ... */ },
  responses: { /* ... */ },
  parameters: { /* ... */ },
};
```

### Route Schema Pattern

```typescript
// src/routes/user.routes.ts
import {
  userSchema,
  createUserRequestSchema,
  updateUserRequestSchema,
} from '../schemas/openapi.schemas.js';

import {
  errorResponseSchema,
  successResponseSchema,
} from '../schemas/openapi.schemas.js';

fastify.post('/users', {
  schema: {
    tags: ['users'],
    summary: 'Create a new user',
    description: 'Create a new user with birthday and anniversary tracking',
    operationId: 'createUser',
    body: createUserRequestSchema,
    response: {
      201: {
        description: 'User created successfully',
        content: {
          'application/json': {
            schema: {
              allOf: [
                successResponseSchema,
                {
                  properties: {
                    data: userSchema
                  }
                }
              ]
            },
            examples: {
              success: {
                summary: 'Successful user creation',
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
                    deletedAt: null
                  },
                  timestamp: '2025-01-15T09:00:00.000Z'
                }
              }
            }
          }
        }
      },
      400: { $ref: '#/components/responses/BadRequest' },
      409: { $ref: '#/components/responses/Conflict' },
      429: { $ref: '#/components/responses/RateLimitExceeded' },
      500: { $ref: '#/components/responses/InternalServerError' }
    }
  },
  config: {
    rateLimit: {
      max: 10,
      timeWindow: '1 minute'
    }
  }
}, userController.create.bind(userController));
```

---

## Step-by-Step Implementation Plan

### Phase 1: Schema Organization (Week 1)

**Goal:** Reorganize OpenAPI schemas into reusable components

**Tasks:**

1. **Create Schema Directories**
   ```bash
   mkdir -p src/schemas
   touch src/schemas/openapi.schemas.ts
   touch src/schemas/user.schemas.ts
   touch src/schemas/error.schemas.ts
   touch src/schemas/components.ts
   ```

2. **Extract Common Schemas**
   - Move `errorResponseSchema` to `error.schemas.ts`
   - Move `successResponseSchema` to `error.schemas.ts`
   - Create reusable response components

3. **Create User Schemas**
   ```typescript
   // src/schemas/user.schemas.ts
   export const userSchema = { /* ... */ };
   export const createUserRequestSchema = { /* ... */ };
   export const updateUserRequestSchema = { /* ... */ };
   ```

4. **Update Route Imports**
   ```typescript
   // Before
   const createUserSchema = { /* inline */ };

   // After
   import { createUserRequestSchema } from '../schemas/user.schemas.js';
   ```

**Deliverables:**
- ✅ `src/schemas/` directory structure
- ✅ Extracted reusable schemas
- ✅ Updated route imports

### Phase 2: Enhance OpenAPI Configuration (Week 1)

**Goal:** Upgrade to OpenAPI 3.1 and add comprehensive metadata

**Tasks:**

1. **Upgrade OpenAPI Version**
   ```typescript
   // src/app.ts
   await app.register(swagger, {
     openapi: {
       openapi: '3.1.0',  // ← Changed from 3.0.0
       info: {
         title: 'Birthday Message Scheduler API',
         description: `
   # Birthday Message Scheduler API

   Timezone-aware birthday message scheduler with support for multiple message types.

   ## Features
   - Timezone-aware scheduling (IANA timezones)
   - Multiple message types (birthday, anniversary)
   - Exactly-once delivery guarantees
   - Comprehensive health checks
   - Prometheus metrics

   ## Rate Limiting
   - User endpoints: 10-100 req/min
   - Health endpoints: Unlimited
   - Metrics endpoints: Unlimited

   ## Authentication
   (Coming soon: JWT Bearer tokens)
         `,
         version: '1.0.0',
         contact: {
           name: 'API Support',
           email: 'api-support@example.com',
           url: 'https://support.example.com'
         },
         license: {
           name: 'MIT',
           url: 'https://opensource.org/licenses/MIT'
         },
         termsOfService: 'https://example.com/terms'
       },
       servers: [
         {
           url: `http://${env.HOST}:${env.PORT}`,
           description: 'Development server'
         },
         {
           url: 'http://localhost:3000',
           description: 'Local development'
         },
         {
           url: 'https://api.example.com',
           description: 'Production server'
         }
       ],
       tags: [
         {
           name: 'users',
           description: 'User management operations',
           externalDocs: {
             description: 'User Management Guide',
             url: 'https://docs.example.com/users'
           }
         },
         {
           name: 'health',
           description: 'Health check and readiness probes',
           externalDocs: {
             description: 'Health Check Guide',
             url: 'https://docs.example.com/health'
           }
         },
         {
           name: 'metrics',
           description: 'Prometheus metrics and observability',
           externalDocs: {
             description: 'Metrics Guide',
             url: 'https://docs.example.com/metrics'
           }
         }
       ],
       components: {
         schemas: components.schemas,
         responses: components.responses,
         parameters: components.parameters,
         securitySchemes: components.securitySchemes
       }
     }
   });
   ```

2. **Update Swagger UI Configuration**
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
       tryItOutEnabled: true
     },
     uiHooks: {
       onRequest: (request, reply, next) => {
         // Add custom headers, logging, etc.
         next();
       }
     },
     staticCSP: true,
     transformStaticCSP: (header) => header,
     transformSpecification: (swaggerObject, request, reply) => {
       // Dynamically modify spec based on request
       return swaggerObject;
     },
     transformSpecificationClone: true
   });
   ```

**Deliverables:**
- ✅ OpenAPI 3.1.0 specification
- ✅ Enhanced API metadata
- ✅ Multiple server configurations
- ✅ Improved Swagger UI

### Phase 3: Document Error Responses (Week 2)

**Goal:** Add comprehensive error documentation following RFC 9457

**Tasks:**

1. **Create Error Schema Library**
   ```typescript
   // src/schemas/error.schemas.ts
   export const errorResponseSchema = {
     type: 'object',
     required: ['error', 'timestamp'],
     properties: {
       error: {
         type: 'object',
         required: ['code', 'message'],
         properties: {
           code: { type: 'string', description: 'Machine-readable error code' },
           message: { type: 'string', description: 'Human-readable error message' },
           details: { type: 'object', additionalProperties: true }
         }
       },
       timestamp: { type: 'string', format: 'date-time' },
       path: { type: 'string' }
     }
   };

   export const validationErrorSchema = {
     allOf: [
       errorResponseSchema,
       {
         properties: {
           error: {
             properties: {
               details: {
                 properties: {
                   fields: {
                     type: 'object',
                     additionalProperties: { type: 'string' },
                     example: {
                       email: 'Invalid email format',
                       timezone: 'Invalid IANA timezone'
                     }
                   }
                 }
               }
             }
           }
         }
       }
     ]
   };
   ```

2. **Create Reusable Error Responses**
   ```typescript
   // src/schemas/components.ts
   export const components = {
     responses: {
       BadRequest: {
         description: 'Validation error or malformed request',
         content: {
           'application/json': {
             schema: validationErrorSchema,
             examples: {
               validationError: {
                 summary: 'Field validation failed',
                 value: {
                   error: {
                     code: 'VALIDATION_ERROR',
                     message: 'Invalid request data',
                     details: {
                       fields: {
                         email: 'Invalid email format'
                       }
                     }
                   },
                   timestamp: '2025-01-15T09:00:00.000Z',
                   path: '/api/v1/users'
                 }
               },
               malformedJson: {
                 summary: 'Malformed JSON payload',
                 value: {
                   error: {
                     code: 'MALFORMED_JSON',
                     message: 'Invalid JSON in request body'
                   },
                   timestamp: '2025-01-15T09:00:00.000Z',
                   path: '/api/v1/users'
                 }
               }
             }
           }
         }
       },
       // ... other error responses
     }
   };
   ```

3. **Update All Route Error Responses**
   ```typescript
   response: {
     200: { /* ... */ },
     400: { $ref: '#/components/responses/BadRequest' },
     404: { $ref: '#/components/responses/NotFound' },
     409: { $ref: '#/components/responses/Conflict' },
     429: { $ref: '#/components/responses/RateLimitExceeded' },
     500: { $ref: '#/components/responses/InternalServerError' }
   }
   ```

**Deliverables:**
- ✅ RFC 9457-compliant error schemas
- ✅ Reusable error response components
- ✅ Multiple error examples per endpoint

### Phase 4: Add Rate Limiting Documentation (Week 2)

**Goal:** Document rate limiting headers and behavior

**Tasks:**

1. **Define Rate Limit Headers**
   ```typescript
   // src/schemas/components.ts
   export const rateLimitHeaders = {
     'X-RateLimit-Limit': {
       description: 'Request limit per time window',
       schema: { type: 'integer', example: 100 }
     },
     'X-RateLimit-Remaining': {
       description: 'Remaining requests in current window',
       schema: { type: 'integer', example: 95 }
     },
     'X-RateLimit-Reset': {
       description: 'Unix timestamp when limit resets',
       schema: { type: 'integer', example: 1704110460 }
     }
   };
   ```

2. **Add Headers to Success Responses**
   ```typescript
   response: {
     200: {
       description: 'User retrieved successfully',
       headers: rateLimitHeaders,
       content: { /* ... */ }
     }
   }
   ```

3. **Update Rate Limit Error Response**
   ```typescript
   components.responses.RateLimitExceeded = {
     description: 'Too many requests - rate limit exceeded',
     headers: {
       ...rateLimitHeaders,
       'Retry-After': {
         description: 'Seconds to wait before retry',
         schema: { type: 'integer', example: 60 }
       }
     },
     content: { /* ... */ }
   };
   ```

**Deliverables:**
- ✅ Rate limit headers documented
- ✅ Rate limit examples
- ✅ Retry-After header

### Phase 5: Add Request/Response Examples (Week 3)

**Goal:** Add comprehensive examples for all endpoints

**Tasks:**

1. **Create Example Library**
   ```typescript
   // src/schemas/examples/user.examples.ts
   export const userExamples = {
     createUser: {
       request: {
         firstName: 'John',
         lastName: 'Doe',
         email: 'john.doe@example.com',
         timezone: 'America/New_York',
         birthdayDate: '1990-01-15',
         anniversaryDate: '2015-06-20',
         locationCity: 'New York',
         locationCountry: 'United States'
       },
       response: {
         success: true,
         data: {
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
           deletedAt: null
         },
         timestamp: '2025-01-15T09:00:00.000Z'
       }
     },
     // ... other examples
   };
   ```

2. **Add Examples to Routes**
   ```typescript
   body: {
     ...createUserRequestSchema,
     examples: {
       minimal: {
         summary: 'Minimal required fields',
         value: {
           firstName: 'John',
           lastName: 'Doe',
           email: 'john@example.com',
           timezone: 'America/New_York'
         }
       },
       complete: {
         summary: 'All fields populated',
         value: userExamples.createUser.request
       }
     }
   }
   ```

**Deliverables:**
- ✅ Example library for all DTOs
- ✅ Multiple examples per endpoint (minimal, complete, edge cases)
- ✅ Improved Swagger UI documentation

### Phase 6: CI/CD Integration (Week 3)

**Goal:** Validate OpenAPI spec in CI/CD pipeline

**Tasks:**

1. **Install Validation Tools**
   ```bash
   npm install --save-dev @apidevtools/swagger-cli
   npm install --save-dev spectral-cli
   ```

2. **Create Validation Scripts**
   ```json
   // package.json
   {
     "scripts": {
       "openapi:validate": "swagger-cli validate dist/openapi.json",
       "openapi:lint": "spectral lint dist/openapi.json",
       "openapi:bundle": "swagger-cli bundle -o dist/openapi.json -t json src/openapi.yaml",
       "openapi:check": "npm run openapi:validate && npm run openapi:lint"
     }
   }
   ```

3. **Export OpenAPI Spec**
   ```typescript
   // src/scripts/export-openapi.ts
   import { writeFile } from 'node:fs/promises';
   import { createApp } from '../app.js';

   async function exportOpenApiSpec() {
     const app = await createApp();
     await app.ready();

     const spec = app.swagger();
     await writeFile(
       'dist/openapi.json',
       JSON.stringify(spec, null, 2)
     );

     console.log('✅ OpenAPI spec exported to dist/openapi.json');
     await app.close();
   }

   exportOpenApiSpec().catch(console.error);
   ```

4. **Add GitHub Actions Workflow**
   ```yaml
   # .github/workflows/openapi.yml
   name: OpenAPI Validation

   on:
     pull_request:
       paths:
         - 'src/routes/**'
         - 'src/schemas/**'
         - 'src/app.ts'

   jobs:
     validate:
       runs-on: ubuntu-latest
       steps:
         - uses: actions/checkout@v4

         - uses: actions/setup-node@v4
           with:
             node-version: '20'
             cache: 'npm'

         - run: npm ci

         - name: Build application
           run: npm run build

         - name: Export OpenAPI spec
           run: npm run openapi:export

         - name: Validate OpenAPI spec
           run: npm run openapi:validate

         - name: Lint OpenAPI spec
           run: npm run openapi:lint

         - name: Upload OpenAPI artifact
           uses: actions/upload-artifact@v4
           with:
             name: openapi-spec
             path: dist/openapi.json
   ```

5. **Create Spectral Ruleset**
   ```yaml
   # .spectral.yml
   extends: spectral:oas
   rules:
     # Enforce operation IDs
     operation-operationId: error

     # Require examples
     oas3-valid-schema-example: error

     # Enforce descriptions
     operation-description: warn
     operation-summary: error

     # Tag validation
     operation-tags: error
     openapi-tags: error

     # Response validation
     operation-success-response: error
     oas3-examples-value-or-externalValue: error

     # Custom rules
     no-$ref-siblings: error
   ```

**Deliverables:**
- ✅ OpenAPI validation in CI/CD
- ✅ Automated spec export
- ✅ Linting with Spectral
- ✅ PR checks for OpenAPI changes

---

## Endpoint Documentation Examples

### Example 1: POST /api/v1/users (Create User)

```typescript
// src/routes/user.routes.ts
fastify.post('/users', {
  schema: {
    tags: ['users'],
    summary: 'Create a new user',
    description: `
Create a new user with birthday and anniversary tracking.

**Features:**
- Automatic timezone validation (IANA format)
- Email uniqueness check
- Soft delete support (emails can be reused after deletion)

**Rate Limiting:**
- 10 requests per minute per IP

**Validation:**
- Email must be unique among non-deleted users
- Timezone must be valid IANA identifier
- Dates must be in YYYY-MM-DD format
    `,
    operationId: 'createUser',
    body: {
      type: 'object',
      required: ['firstName', 'lastName', 'email', 'timezone'],
      properties: {
        firstName: {
          type: 'string',
          minLength: 1,
          maxLength: 100,
          description: 'User first name',
          example: 'John'
        },
        lastName: {
          type: 'string',
          minLength: 1,
          maxLength: 100,
          description: 'User last name',
          example: 'Doe'
        },
        email: {
          type: 'string',
          format: 'email',
          maxLength: 255,
          description: 'User email address (must be unique)',
          example: 'john.doe@example.com'
        },
        timezone: {
          type: 'string',
          pattern: '^[A-Za-z]+/[A-Za-z_]+$',
          description: 'IANA timezone identifier (e.g., "America/New_York")',
          example: 'America/New_York'
        },
        birthdayDate: {
          type: 'string',
          format: 'date',
          description: 'User birthday in YYYY-MM-DD format',
          example: '1990-01-15',
          nullable: true
        },
        anniversaryDate: {
          type: 'string',
          format: 'date',
          description: 'Anniversary date in YYYY-MM-DD format',
          example: '2015-06-20',
          nullable: true
        },
        locationCity: {
          type: 'string',
          maxLength: 100,
          description: 'City of residence',
          example: 'New York',
          nullable: true
        },
        locationCountry: {
          type: 'string',
          maxLength: 100,
          description: 'Country of residence',
          example: 'United States',
          nullable: true
        }
      },
      examples: {
        minimal: {
          summary: 'Minimal required fields',
          value: {
            firstName: 'John',
            lastName: 'Doe',
            email: 'john@example.com',
            timezone: 'America/New_York'
          }
        },
        complete: {
          summary: 'All fields populated',
          value: {
            firstName: 'John',
            lastName: 'Doe',
            email: 'john.doe@example.com',
            timezone: 'America/New_York',
            birthdayDate: '1990-01-15',
            anniversaryDate: '2015-06-20',
            locationCity: 'New York',
            locationCountry: 'United States'
          }
        }
      }
    },
    response: {
      201: {
        description: 'User created successfully',
        headers: {
          'X-RateLimit-Limit': {
            description: 'Request limit per time window',
            schema: { type: 'integer', example: 10 }
          },
          'X-RateLimit-Remaining': {
            description: 'Remaining requests in current window',
            schema: { type: 'integer', example: 9 }
          },
          'X-RateLimit-Reset': {
            description: 'Unix timestamp when limit resets',
            schema: { type: 'integer', example: 1704110460 }
          }
        },
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['success', 'data', 'timestamp'],
              properties: {
                success: { type: 'boolean', example: true },
                data: {
                  type: 'object',
                  properties: {
                    id: { type: 'string', format: 'uuid' },
                    firstName: { type: 'string' },
                    lastName: { type: 'string' },
                    email: { type: 'string', format: 'email' },
                    timezone: { type: 'string' },
                    birthdayDate: { type: 'string', format: 'date', nullable: true },
                    anniversaryDate: { type: 'string', format: 'date', nullable: true },
                    locationCity: { type: 'string', nullable: true },
                    locationCountry: { type: 'string', nullable: true },
                    createdAt: { type: 'string', format: 'date-time' },
                    updatedAt: { type: 'string', format: 'date-time' },
                    deletedAt: { type: 'string', format: 'date-time', nullable: true }
                  }
                },
                timestamp: { type: 'string', format: 'date-time' }
              }
            },
            examples: {
              success: {
                summary: 'Successful user creation',
                value: {
                  success: true,
                  data: {
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
                    deletedAt: null
                  },
                  timestamp: '2025-01-15T09:00:00.000Z'
                }
              }
            }
          }
        }
      },
      400: {
        description: 'Validation error',
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/ErrorResponse' },
            examples: {
              invalidEmail: {
                summary: 'Invalid email format',
                value: {
                  error: {
                    code: 'VALIDATION_ERROR',
                    message: 'Invalid request data',
                    details: {
                      fields: {
                        email: 'Invalid email format'
                      }
                    }
                  },
                  timestamp: '2025-01-15T09:00:00.000Z',
                  path: '/api/v1/users'
                }
              },
              invalidTimezone: {
                summary: 'Invalid IANA timezone',
                value: {
                  error: {
                    code: 'VALIDATION_ERROR',
                    message: 'Invalid IANA timezone format',
                    details: {
                      fields: {
                        timezone: 'Invalid IANA timezone format (e.g., "America/New_York")'
                      }
                    }
                  },
                  timestamp: '2025-01-15T09:00:00.000Z',
                  path: '/api/v1/users'
                }
              }
            }
          }
        }
      },
      409: {
        description: 'Email already exists',
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/ErrorResponse' },
            example: {
              error: {
                code: 'CONFLICT',
                message: 'Email already exists',
                details: {
                  email: 'john.doe@example.com'
                }
              },
              timestamp: '2025-01-15T09:00:00.000Z',
              path: '/api/v1/users'
            }
          }
        }
      },
      429: { $ref: '#/components/responses/RateLimitExceeded' },
      500: { $ref: '#/components/responses/InternalServerError' }
    }
  },
  config: {
    rateLimit: {
      max: 10,
      timeWindow: '1 minute'
    }
  }
}, userController.create.bind(userController));
```

### Example 2: GET /health (Health Check)

```typescript
// src/routes/health.routes.ts
fastify.get('/health', {
  schema: {
    tags: ['health'],
    summary: 'Check application health',
    description: `
Get the current health status of the application and its dependencies.

**Health Checks:**
- Database connectivity (PostgreSQL)
- Message queue connectivity (RabbitMQ)
- System uptime
- Application version

**Use Cases:**
- Kubernetes liveness probes
- Load balancer health checks
- Monitoring dashboards
- Alerting systems

**Status Codes:**
- \`ok\` - All systems operational
- \`degraded\` - Some non-critical systems unavailable
- \`error\` - Critical systems unavailable
    `,
    operationId: 'getHealth',
    response: {
      200: {
        description: 'Health check successful',
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['status', 'timestamp', 'uptime', 'version', 'services'],
              properties: {
                status: {
                  type: 'string',
                  enum: ['ok', 'degraded', 'error'],
                  description: 'Overall health status'
                },
                timestamp: {
                  type: 'string',
                  format: 'date-time',
                  description: 'Health check timestamp'
                },
                uptime: {
                  type: 'number',
                  description: 'Application uptime in seconds'
                },
                version: {
                  type: 'string',
                  description: 'Application version'
                },
                services: {
                  type: 'object',
                  required: ['database', 'rabbitmq'],
                  properties: {
                    database: {
                      type: 'string',
                      enum: ['healthy', 'unhealthy'],
                      description: 'PostgreSQL database status'
                    },
                    rabbitmq: {
                      type: 'string',
                      enum: ['healthy', 'unhealthy'],
                      description: 'RabbitMQ message queue status'
                    }
                  }
                }
              }
            },
            examples: {
              healthy: {
                summary: 'All services healthy',
                value: {
                  status: 'ok',
                  timestamp: '2025-01-15T09:00:00.000Z',
                  uptime: 3600,
                  version: '1.0.0',
                  services: {
                    database: 'healthy',
                    rabbitmq: 'healthy'
                  }
                }
              },
              degraded: {
                summary: 'Database unavailable',
                value: {
                  status: 'degraded',
                  timestamp: '2025-01-15T09:00:00.000Z',
                  uptime: 3600,
                  version: '1.0.0',
                  services: {
                    database: 'unhealthy',
                    rabbitmq: 'healthy'
                  }
                }
              }
            }
          }
        }
      }
    }
  }
}, healthController.getHealth.bind(healthController));
```

### Example 3: GET /metrics (Prometheus Metrics)

```typescript
// src/routes/metrics.routes.ts
fastify.get('/metrics', {
  schema: {
    tags: ['metrics'],
    summary: 'Get Prometheus metrics',
    description: `
Get application metrics in Prometheus exposition format.

**Metrics Included:**
- HTTP request metrics (duration, count, status codes)
- RabbitMQ queue metrics (messages, consumers)
- Database connection pool metrics
- Custom business metrics (messages sent, failed, etc.)

**Format:**
- Prometheus text format (Content-Type: text/plain)
- Compatible with Prometheus, Grafana, etc.

**Use Cases:**
- Prometheus scraping
- Grafana dashboards
- Alerting rules
- Performance monitoring
    `,
    operationId: 'getMetrics',
    response: {
      200: {
        description: 'Prometheus metrics in text format',
        content: {
          'text/plain': {
            schema: {
              type: 'string',
              description: 'Prometheus exposition format'
            },
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
messages_failed_total{message_type="birthday",reason="timeout"} 5`
          }
        }
      }
    }
  }
}, metricsController.getMetrics.bind(metricsController));
```

---

## Vendor API Specification

### Vendor API Documentation

**Location:** `docs/vendor-specs/email-service-api-analysis.md`

**Summary:**
- Vendor API endpoint not publicly accessible
- Standard email service integration pattern documented
- Circuit breaker and retry strategies defined
- Error mapping and monitoring plan included

**See:** [Email Service Vendor API Analysis](/docs/vendor-specs/email-service-api-analysis.md)

**Next Steps:**
1. Contact vendor for official OpenAPI specification
2. Update integration service with real endpoints
3. Implement webhook handler if supported
4. Add vendor-specific monitoring

---

## CI/CD Integration

### Automated OpenAPI Validation

**Goals:**
1. Validate OpenAPI spec on every PR
2. Catch breaking changes before merge
3. Generate spec artifacts
4. Enforce documentation quality

### Validation Tools

| Tool | Purpose | Config File |
|------|---------|-------------|
| **swagger-cli** | Validate OpenAPI syntax | N/A |
| **Spectral** | Lint OpenAPI quality | `.spectral.yml` |
| **openapi-diff** | Detect breaking changes | N/A |

### GitHub Actions Workflow

```yaml
# .github/workflows/openapi-validation.yml
name: OpenAPI Validation

on:
  pull_request:
    paths:
      - 'src/routes/**'
      - 'src/schemas/**'
      - 'src/app.ts'
  push:
    branches:
      - main

jobs:
  validate-openapi:
    runs-on: ubuntu-latest

    steps:
      - name: Checkout code
        uses: actions/checkout@v4
        with:
          fetch-depth: 0  # Full history for openapi-diff

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

      - name: Lint OpenAPI spec
        run: npm run openapi:lint

      - name: Check for breaking changes
        if: github.event_name == 'pull_request'
        uses: oasdiff/oasdiff-action@v0.0.15
        with:
          base: https://api.example.com/openapi.json
          revision: dist/openapi.json
          fail-on-diff: true
          format: text

      - name: Generate OpenAPI documentation
        run: npm run openapi:docs

      - name: Upload OpenAPI spec
        uses: actions/upload-artifact@v4
        with:
          name: openapi-spec
          path: |
            dist/openapi.json
            dist/openapi.html
          retention-days: 30

      - name: Comment PR with spec changes
        if: github.event_name == 'pull_request'
        uses: actions/github-script@v7
        with:
          script: |
            const fs = require('fs');
            const diff = fs.readFileSync('openapi-diff.txt', 'utf8');

            github.rest.issues.createComment({
              issue_number: context.issue.number,
              owner: context.repo.owner,
              repo: context.repo.repo,
              body: `## OpenAPI Changes\n\n\`\`\`diff\n${diff}\n\`\`\``
            });
```

### Pre-commit Hook

```bash
# .husky/pre-commit
#!/bin/sh
. "$(dirname "$0")/_/husky.sh"

# Validate OpenAPI spec if routes changed
if git diff --cached --name-only | grep -qE '^src/(routes|schemas)/'; then
  echo "🔍 Validating OpenAPI spec..."
  npm run openapi:export
  npm run openapi:validate || {
    echo "❌ OpenAPI validation failed"
    exit 1
  }
  echo "✅ OpenAPI validation passed"
fi
```

### NPM Scripts

```json
{
  "scripts": {
    "openapi:export": "tsx src/scripts/export-openapi.ts",
    "openapi:validate": "swagger-cli validate dist/openapi.json",
    "openapi:lint": "spectral lint dist/openapi.json --ruleset .spectral.yml",
    "openapi:bundle": "swagger-cli bundle -o dist/openapi-bundled.json -t json dist/openapi.json",
    "openapi:docs": "redoc-cli bundle dist/openapi.json -o dist/openapi.html",
    "openapi:check": "npm run openapi:export && npm run openapi:validate && npm run openapi:lint",
    "openapi:diff": "oasdiff diff https://api.example.com/openapi.json dist/openapi.json"
  }
}
```

---

## Best Practices & Conventions

### 1. Schema Design Principles

#### Use JSON Schema Draft 2020-12
```yaml
openapi: 3.1.0  # Supports JSON Schema Draft 2020-12
```

#### Prefer `$ref` for Reusability
```typescript
// ✅ Good - Reusable component
response: {
  404: { $ref: '#/components/responses/NotFound' }
}

// ❌ Bad - Inline duplication
response: {
  404: {
    description: 'Not found',
    content: { /* duplicated schema */ }
  }
}
```

#### Use `allOf` for Schema Composition
```typescript
// Compose base + specific fields
const userWithMetadata = {
  allOf: [
    { $ref: '#/components/schemas/User' },
    {
      properties: {
        metadata: { type: 'object' }
      }
    }
  ]
};
```

### 2. Documentation Quality

#### Write Descriptive Summaries
```typescript
// ✅ Good
summary: 'Create a new user with birthday tracking'

// ❌ Bad
summary: 'Create user'
```

#### Provide Multiple Examples
```typescript
examples: {
  minimal: { /* minimal required fields */ },
  complete: { /* all fields populated */ },
  edgeCase: { /* special scenario */ }
}
```

#### Document Error Scenarios
```typescript
response: {
  400: {
    description: 'Validation error',
    content: {
      'application/json': {
        examples: {
          invalidEmail: { /* ... */ },
          invalidTimezone: { /* ... */ },
          missingFields: { /* ... */ }
        }
      }
    }
  }
}
```

### 3. Versioning Strategy

#### URL-Based Versioning
```typescript
// ✅ Current approach
fastify.register(userRoutes, { prefix: '/api/v1' });

// Servers
servers: [
  { url: 'http://localhost:3000/api/v1', description: 'v1' },
  { url: 'http://localhost:3000/api/v2', description: 'v2' }
]
```

#### Version Info Object
```typescript
info: {
  version: '1.0.0',  // API version
  'x-api-version': 'v1',  // Explicit version marker
  'x-changelog': 'https://example.com/changelog'
}
```

### 4. Security Documentation

#### Document Authentication (Future)
```yaml
components:
  securitySchemes:
    BearerAuth:
      type: http
      scheme: bearer
      bearerFormat: JWT
      description: JWT token from /auth/login

security:
  - BearerAuth: []
```

#### Document Rate Limiting
```yaml
x-rate-limit:
  limit: 100
  window: 60s
  scope: ip
```

### 5. Extension Fields (x-*)

#### Custom Metadata
```yaml
paths:
  /api/v1/users:
    post:
      x-rate-limit:
        max: 10
        window: 60s
      x-cost: 1  # API cost units
      x-internal: false  # Public API
```

### 6. Error Response Standards

#### Follow RFC 9457 (Problem Details)
```typescript
{
  "type": "https://example.com/errors/validation-error",
  "title": "Validation Error",
  "status": 400,
  "detail": "Invalid email format",
  "instance": "/api/v1/users",
  "errors": {
    "email": "Invalid email format"
  }
}
```

### 7. Schema Naming Conventions

```typescript
// ✅ Good naming
schemas: {
  User,                    // Domain model
  CreateUserRequest,       // Request DTO
  CreateUserResponse,      // Response DTO
  UserListResponse,        // Collection response
  UserNotFoundError        // Error schema
}

// ❌ Bad naming
schemas: {
  user,           // Lowercase
  UserReq,        // Abbreviated
  UserRes,        // Abbreviated
  Error404        // HTTP code in name
}
```

### 8. Operation IDs

```typescript
// ✅ Good - Descriptive operation IDs
operationId: 'createUser'
operationId: 'getUserById'
operationId: 'updateUser'
operationId: 'deleteUser'

// ❌ Bad
operationId: 'post_users'
operationId: 'operation1'
```

### 9. Tag Organization

```typescript
// ✅ Good - Logical grouping
tags: [
  { name: 'users', description: 'User management' },
  { name: 'health', description: 'Health checks' },
  { name: 'metrics', description: 'Observability' }
]

// Each operation tagged
paths: {
  '/api/v1/users': {
    post: {
      tags: ['users']
    }
  }
}
```

### 10. Deprecation Strategy

```typescript
// Mark deprecated endpoints
paths: {
  '/api/v1/users/legacy': {
    get: {
      deprecated: true,
      'x-deprecation-date': '2025-06-01',
      'x-sunset-date': '2025-12-01',
      'x-alternative': '/api/v2/users'
    }
  }
}
```

---

## Code Examples

### Complete Route Example with All Best Practices

```typescript
// src/routes/user.routes.ts
import type { FastifyInstance, FastifyPluginOptions } from 'fastify';
import { userController } from '../controllers/user.controller.js';
import {
  userSchema,
  createUserRequestSchema,
  updateUserRequestSchema,
  userListResponseSchema,
} from '../schemas/user.schemas.js';
import {
  successResponseSchema,
  errorResponseSchema,
} from '../schemas/openapi.schemas.js';

export async function userRoutes(
  fastify: FastifyInstance,
  _options: FastifyPluginOptions
): Promise<void> {
  // POST /api/v1/users - Create user
  fastify.post('/users', {
    schema: {
      tags: ['users'],
      summary: 'Create a new user',
      description: `
Create a new user with birthday and anniversary tracking.

**Features:**
- Automatic timezone validation
- Email uniqueness check
- Soft delete support

**Rate Limiting:** 10 req/min
**Authentication:** None (public endpoint)
      `,
      operationId: 'createUser',
      body: createUserRequestSchema,
      response: {
        201: {
          description: 'User created successfully',
          headers: {
            'X-RateLimit-Limit': {
              description: 'Request limit per window',
              schema: { type: 'integer', example: 10 }
            },
            'X-RateLimit-Remaining': {
              description: 'Remaining requests',
              schema: { type: 'integer', example: 9 }
            }
          },
          content: {
            'application/json': {
              schema: {
                allOf: [
                  successResponseSchema,
                  {
                    properties: {
                      data: userSchema
                    }
                  }
                ]
              },
              examples: {
                success: {
                  summary: 'Successful creation',
                  value: {
                    success: true,
                    data: {
                      id: '550e8400-e29b-41d4-a716-446655440000',
                      firstName: 'John',
                      lastName: 'Doe',
                      email: 'john.doe@example.com',
                      timezone: 'America/New_York',
                      birthdayDate: '1990-01-15',
                      createdAt: '2025-01-15T09:00:00.000Z',
                      updatedAt: '2025-01-15T09:00:00.000Z'
                    },
                    timestamp: '2025-01-15T09:00:00.000Z'
                  }
                }
              }
            }
          }
        },
        400: { $ref: '#/components/responses/BadRequest' },
        409: { $ref: '#/components/responses/Conflict' },
        429: { $ref: '#/components/responses/RateLimitExceeded' },
        500: { $ref: '#/components/responses/InternalServerError' }
      }
    },
    config: {
      rateLimit: {
        max: 10,
        timeWindow: '1 minute'
      }
    }
  }, userController.create.bind(userController));

  // GET /api/v1/users/:id - Get user
  fastify.get('/users/:id', {
    schema: {
      tags: ['users'],
      summary: 'Get user by ID',
      description: 'Retrieve user information by UUID',
      operationId: 'getUserById',
      params: {
        type: 'object',
        required: ['id'],
        properties: {
          id: {
            type: 'string',
            format: 'uuid',
            description: 'User UUID',
            example: '550e8400-e29b-41d4-a716-446655440000'
          }
        }
      },
      response: {
        200: {
          description: 'User found',
          content: {
            'application/json': {
              schema: {
                allOf: [
                  successResponseSchema,
                  {
                    properties: {
                      data: userSchema
                    }
                  }
                ]
              }
            }
          }
        },
        404: { $ref: '#/components/responses/NotFound' },
        500: { $ref: '#/components/responses/InternalServerError' }
      }
    },
    config: {
      rateLimit: {
        max: 100,
        timeWindow: '1 minute'
      }
    }
  }, userController.getById.bind(userController));
}
```

### Shared Schema Components

```typescript
// src/schemas/components.ts
export const components = {
  schemas: {
    User: {
      type: 'object',
      required: ['id', 'firstName', 'lastName', 'email', 'timezone'],
      properties: {
        id: {
          type: 'string',
          format: 'uuid',
          description: 'Unique user identifier',
          example: '550e8400-e29b-41d4-a716-446655440000'
        },
        firstName: {
          type: 'string',
          minLength: 1,
          maxLength: 100,
          description: 'User first name',
          example: 'John'
        },
        lastName: {
          type: 'string',
          minLength: 1,
          maxLength: 100,
          description: 'User last name',
          example: 'Doe'
        },
        email: {
          type: 'string',
          format: 'email',
          maxLength: 255,
          description: 'User email (unique)',
          example: 'john.doe@example.com'
        },
        timezone: {
          type: 'string',
          pattern: '^[A-Za-z]+/[A-Za-z_]+$',
          description: 'IANA timezone identifier',
          example: 'America/New_York'
        },
        birthdayDate: {
          type: 'string',
          format: 'date',
          nullable: true,
          description: 'Birthday (YYYY-MM-DD)',
          example: '1990-01-15'
        },
        anniversaryDate: {
          type: 'string',
          format: 'date',
          nullable: true,
          description: 'Anniversary (YYYY-MM-DD)',
          example: '2015-06-20'
        },
        createdAt: {
          type: 'string',
          format: 'date-time',
          description: 'Creation timestamp',
          example: '2025-01-15T09:00:00.000Z'
        },
        updatedAt: {
          type: 'string',
          format: 'date-time',
          description: 'Last update timestamp',
          example: '2025-01-15T09:00:00.000Z'
        },
        deletedAt: {
          type: 'string',
          format: 'date-time',
          nullable: true,
          description: 'Soft delete timestamp',
          example: null
        }
      }
    },

    ErrorResponse: {
      type: 'object',
      required: ['error', 'timestamp'],
      properties: {
        error: {
          type: 'object',
          required: ['code', 'message'],
          properties: {
            code: {
              type: 'string',
              description: 'Machine-readable error code',
              example: 'VALIDATION_ERROR'
            },
            message: {
              type: 'string',
              description: 'Human-readable error message',
              example: 'Invalid request data'
            },
            details: {
              type: 'object',
              additionalProperties: true,
              description: 'Additional error context',
              example: {
                fields: {
                  email: 'Invalid email format'
                }
              }
            }
          }
        },
        timestamp: {
          type: 'string',
          format: 'date-time',
          description: 'Error timestamp',
          example: '2025-01-15T09:00:00.000Z'
        },
        path: {
          type: 'string',
          description: 'Request path',
          example: '/api/v1/users'
        }
      }
    }
  },

  responses: {
    BadRequest: {
      description: 'Validation error or malformed request',
      content: {
        'application/json': {
          schema: { $ref: '#/components/schemas/ErrorResponse' },
          examples: {
            validationError: {
              summary: 'Field validation failed',
              value: {
                error: {
                  code: 'VALIDATION_ERROR',
                  message: 'Invalid request data',
                  details: {
                    fields: {
                      email: 'Invalid email format'
                    }
                  }
                },
                timestamp: '2025-01-15T09:00:00.000Z',
                path: '/api/v1/users'
              }
            }
          }
        }
      }
    },

    NotFound: {
      description: 'Resource not found',
      content: {
        'application/json': {
          schema: { $ref: '#/components/schemas/ErrorResponse' },
          example: {
            error: {
              code: 'NOT_FOUND',
              message: 'User not found'
            },
            timestamp: '2025-01-15T09:00:00.000Z',
            path: '/api/v1/users/550e8400-e29b-41d4-a716-446655440000'
          }
        }
      }
    },

    Conflict: {
      description: 'Resource conflict',
      content: {
        'application/json': {
          schema: { $ref: '#/components/schemas/ErrorResponse' },
          example: {
            error: {
              code: 'CONFLICT',
              message: 'Email already exists',
              details: {
                email: 'john.doe@example.com'
              }
            },
            timestamp: '2025-01-15T09:00:00.000Z',
            path: '/api/v1/users'
          }
        }
      }
    },

    RateLimitExceeded: {
      description: 'Too many requests',
      headers: {
        'X-RateLimit-Limit': {
          description: 'Request limit',
          schema: { type: 'integer', example: 100 }
        },
        'X-RateLimit-Remaining': {
          description: 'Remaining requests',
          schema: { type: 'integer', example: 0 }
        },
        'X-RateLimit-Reset': {
          description: 'Reset timestamp',
          schema: { type: 'integer', example: 1704110460 }
        },
        'Retry-After': {
          description: 'Retry delay (seconds)',
          schema: { type: 'integer', example: 60 }
        }
      },
      content: {
        'application/json': {
          schema: { $ref: '#/components/schemas/ErrorResponse' },
          example: {
            error: {
              code: 'RATE_LIMIT_EXCEEDED',
              message: 'Rate limit exceeded, retry in 60 seconds'
            },
            timestamp: '2025-01-15T09:00:00.000Z'
          }
        }
      }
    },

    InternalServerError: {
      description: 'Internal server error',
      content: {
        'application/json': {
          schema: { $ref: '#/components/schemas/ErrorResponse' },
          example: {
            error: {
              code: 'INTERNAL_SERVER_ERROR',
              message: 'An unexpected error occurred'
            },
            timestamp: '2025-01-15T09:00:00.000Z'
          }
        }
      }
    }
  },

  parameters: {
    userId: {
      name: 'id',
      in: 'path',
      required: true,
      description: 'User UUID',
      schema: {
        type: 'string',
        format: 'uuid',
        example: '550e8400-e29b-41d4-a716-446655440000'
      }
    }
  },

  securitySchemes: {
    BearerAuth: {
      type: 'http',
      scheme: 'bearer',
      bearerFormat: 'JWT',
      description: 'JWT token from /auth/login'
    },
    ApiKeyAuth: {
      type: 'apiKey',
      in: 'header',
      name: 'X-API-Key',
      description: 'API key for service auth'
    }
  }
};
```

---

## Summary

### ✅ Recommended Implementation

**Option:** Enhance current `@fastify/swagger` setup (NOT migrate)

**Rationale:**
- Working code should not be rewritten without strong reason
- Current approach sufficient for all requirements
- Quick wins by improving existing schemas
- Zero migration risk

### 📋 Implementation Checklist

**Phase 1: Schema Organization**
- [ ] Create `src/schemas/` directory
- [ ] Extract reusable schemas
- [ ] Update route imports

**Phase 2: OpenAPI Enhancements**
- [ ] Upgrade to OpenAPI 3.1.0
- [ ] Add comprehensive metadata
- [ ] Configure multiple servers

**Phase 3: Error Documentation**
- [ ] Create RFC 9457-compliant error schemas
- [ ] Add reusable error components
- [ ] Document all error scenarios

**Phase 4: Rate Limiting**
- [ ] Document rate limit headers
- [ ] Add rate limit examples
- [ ] Document retry behavior

**Phase 5: Examples**
- [ ] Create example library
- [ ] Add multiple examples per endpoint
- [ ] Include edge cases

**Phase 6: CI/CD**
- [ ] Install validation tools
- [ ] Create validation scripts
- [ ] Add GitHub Actions workflow
- [ ] Configure pre-commit hooks

### 📚 Resources

**Libraries:**
- [@fastify/swagger](https://github.com/fastify/fastify-swagger) - OpenAPI generation
- [@fastify/swagger-ui](https://github.com/fastify/fastify-swagger-ui) - Swagger UI
- [fastify-type-provider-zod](https://github.com/turkerdev/fastify-type-provider-zod) - Alternative approach
- [fastify-zod-openapi](https://github.com/samchungy/fastify-zod-openapi) - Alternative approach

**Validation Tools:**
- [swagger-cli](https://www.npmjs.com/package/@apidevtools/swagger-cli) - Validate OpenAPI
- [Spectral](https://stoplight.io/open-source/spectral) - Lint OpenAPI
- [openapi-diff](https://github.com/OpenAPITools/openapi-diff) - Detect breaking changes

**Documentation:**
- [OpenAPI 3.1 Specification](https://spec.openapis.org/oas/v3.1.0)
- [RFC 9457 - Problem Details](https://www.rfc-editor.org/rfc/rfc9457.html)
- [Fastify Documentation](https://fastify.dev/docs/latest/)

**Guides:**
- [Speakeasy - OpenAPI with Fastify](https://www.speakeasy.com/openapi/frameworks/fastify)
- [Speakeasy - Error Responses](https://www.speakeasy.com/openapi/responses/errors)
- [Speakeasy - Rate Limiting](https://www.speakeasy.com/openapi/responses/rate-limiting)

### 🎯 Success Criteria

**Documentation Quality:**
- ✅ All endpoints documented with examples
- ✅ Error responses follow RFC 9457
- ✅ Rate limiting documented
- ✅ Swagger UI fully functional

**Developer Experience:**
- ✅ Interactive Swagger UI at `/docs`
- ✅ SDK generation possible
- ✅ Clear error messages
- ✅ Comprehensive examples

**CI/CD Integration:**
- ✅ OpenAPI validation in GitHub Actions
- ✅ Breaking change detection
- ✅ Pre-commit validation
- ✅ Automated spec export

**Maintenance:**
- ✅ Schemas organized in `src/schemas/`
- ✅ Reusable components with `$ref`
- ✅ Minimal duplication
- ✅ Clear naming conventions

---

## Sources

- [fastify-type-provider-zod](https://github.com/turkerdev/fastify-type-provider-zod)
- [fastify-zod-openapi](https://github.com/samchungy/fastify-zod-openapi)
- [zod-openapi](https://www.npmjs.com/package/zod-openapi)
- [@fastify/swagger](https://github.com/fastify/fastify-swagger)
- [Speakeasy - OpenAPI with Fastify](https://www.speakeasy.com/openapi/frameworks/fastify)
- [Speakeasy - Error Responses in OpenAPI](https://www.speakeasy.com/openapi/responses/errors)
- [Speakeasy - Rate Limiting in OpenAPI](https://www.speakeasy.com/openapi/responses/rate-limiting)
- [OpenAPI Specification v3.1.0](https://spec.openapis.org/oas/v3.1.0)
- [RFC 9457 - Problem Details for HTTP APIs](https://www.rfc-editor.org/rfc/rfc9457.html)

---

**End of Document**
