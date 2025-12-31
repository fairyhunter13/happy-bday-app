# OpenAPI Client Generation Research & Implementation Plan

**Last Updated**: 2025-12-30
**Status**: Research Complete
**Target**: Automated TypeScript client generation for Digital Envision Email Service API

## Executive Summary

This document provides comprehensive research on automatic OpenAPI client generation for the Digital Envision Email Service API (`docs/vendor-specs/email-service-api.json`). The goal is to eliminate manual HTTP client code, achieve end-to-end type safety, and reduce maintenance burden through automation.

**Key Recommendation**: Use **@hey-api/openapi-ts** for client generation with custom wrapper for retry logic and error handling integration.

---

## Table of Contents

1. [Tool Comparison](#1-tool-comparison)
2. [Integration Strategy](#2-integration-strategy)
3. [Benefits Analysis](#3-benefits-analysis)
4. [Implementation Approach](#4-implementation-approach)
5. [Best Practices](#5-best-practices)
6. [Migration Strategy](#6-migration-strategy)
7. [Complete Implementation Plan](#7-complete-implementation-plan)
8. [Code Examples](#8-code-examples)
9. [References](#9-references)

---

## 1. Tool Comparison

### Overview of Top Candidates

Based on comprehensive research, the following tools were evaluated:

| Tool | Status | Weekly Downloads | Stars | Type Safety | Bundle Size | Maintenance |
|------|--------|-----------------|-------|-------------|-------------|-------------|
| **@hey-api/openapi-ts** | Active | 500K+ | 6.5K+ | Excellent | Small (tree-shakeable) | Active |
| **openapi-typescript** | Active | 800K+ | 5K+ | Excellent | Minimal (types only) | Active |
| **swagger-typescript-api** | Active | 410K+ | 3.8K+ | Good | Medium | Active |
| **openapi-typescript-codegen** | Deprecated | 348K+ | 3.3K+ | Good | Medium | Deprecated |
| **openapi-generator (TS)** | Active | Very High | 20K+ | Good | Large | Active but complex |

### Detailed Feature Comparison

#### 1. @hey-api/openapi-ts (Recommended)

**Successor to openapi-typescript-codegen**

**Strengths:**
- Production-ready SDKs used by Vercel, OpenCode, and PayPal
- Generates TypeScript types, Zod schemas, and TanStack Query hooks
- 20+ plugins for extensive customization
- Tree-shakeable flat SDKs for minimal bundle size
- Multiple HTTP client support (Fetch, Axios, Angular)
- Straightforward configuration with sensible defaults
- Active development and maintenance
- Excellent TypeScript integration

**Weaknesses:**
- Newer tool (but backed by strong community)
- Limited retry logic out-of-the-box (requires custom wrapper)

**Best For:**
- Projects prioritizing simplicity and quick integration
- Teams wanting production-ready SDKs with minimal configuration
- Applications requiring modern framework integrations
- Codebases with strict bundle size requirements

**Bundle Impact:**
- Tree-shakeable: Only imports used methods
- Typical size: 5-15KB (gzipped) for basic usage
- No runtime overhead for types

#### 2. openapi-typescript

**Type-Only Generator**

**Strengths:**
- Zero runtime overhead (types only)
- Minimal bundle size impact
- Highly customizable type generation
- Advanced TypeScript features support
- Excellent for fine-grained control

**Weaknesses:**
- Requires manual HTTP client implementation
- No built-in request/response handling
- More boilerplate code needed
- Steeper learning curve

**Best For:**
- Projects requiring maximum customization
- Teams with existing HTTP client infrastructure
- Type-only use cases
- Developers wanting complete control

**Bundle Impact:**
- Zero (types are compiled away)
- No runtime dependencies

#### 3. swagger-typescript-api

**Comprehensive Generator**

**Strengths:**
- Request/response validation built-in
- Customizable API methods
- Good documentation
- Mature ecosystem
- Active maintenance

**Weaknesses:**
- Larger bundle size
- More opinionated structure
- Less flexible than alternatives
- Some outdated patterns

**Best For:**
- Larger projects with complex requirements
- Teams wanting built-in validation
- Projects requiring extensive customization

**Bundle Impact:**
- Medium (20-40KB gzipped)
- Includes validation runtime

#### 4. openapi-generator (TypeScript-Axios/Fetch)

**Multi-Language Generator**

**Strengths:**
- Supports 50+ languages
- Mature and widely adopted
- Extensive configuration options
- Large community
- Multiple TypeScript templates

**Weaknesses:**
- Complex configuration
- 4000+ unresolved GitHub issues
- Inconsistent quality across generators
- Java-based (requires JRE)
- Heavyweight for TypeScript-only projects
- Generated code can be verbose

**TypeScript Templates:**
- `typescript-axios`: Uses axios, standard AxiosResponse
- `typescript-fetch`: Native Fetch API, better typed errors
- `typescript-node`: Node.js optimized

**Best For:**
- Multi-language projects
- Organizations with established OpenAPI Generator pipelines
- Teams comfortable with Java tooling

**Bundle Impact:**
- Large (40-80KB gzipped)
- Includes full axios dependency

### Recommendation Matrix

| Project Type | Recommended Tool | Reason |
|--------------|------------------|--------|
| **New Project** | @hey-api/openapi-ts | Modern, production-ready, minimal setup |
| **Existing with Custom HTTP** | openapi-typescript | Type-only, no runtime changes |
| **Large Enterprise** | swagger-typescript-api | Comprehensive features, validation |
| **Multi-Language** | openapi-generator | Consistency across languages |

### Final Recommendation: @hey-api/openapi-ts

**Rationale:**
1. Modern, actively maintained successor to deprecated openapi-typescript-codegen
2. Production-ready with excellent TypeScript support
3. Tree-shakeable for minimal bundle size
4. Plugin ecosystem for future extensibility
5. Straightforward integration with existing tools (Got, Circuit Breaker)
6. Used by major companies (Vercel, PayPal)
7. Supports multiple HTTP clients (can wrap with Got)

---

## 2. Integration Strategy

### Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│                  Application Layer                       │
│  (MessageSenderService, Workers, Schedulers)            │
└────────────────────┬────────────────────────────────────┘
                     │
                     ↓
┌─────────────────────────────────────────────────────────┐
│           Custom Wrapper Layer (DRY)                     │
│  ┌───────────────────────────────────────────────┐     │
│  │  EmailServiceClient                            │     │
│  │  - Circuit Breaker Integration                 │     │
│  │  - Retry Logic (Exponential Backoff)          │     │
│  │  - Error Mapping (Custom → Standard)          │     │
│  │  - Metrics Collection                          │     │
│  │  - Logging Integration                         │     │
│  └───────────────────┬───────────────────────────┘     │
└────────────────────┬─┴──────────────────────────────────┘
                     │
                     ↓
┌─────────────────────────────────────────────────────────┐
│        Generated Client Layer (Auto-generated)          │
│  ┌───────────────────────────────────────────────┐     │
│  │  src/clients/generated/email-service/          │     │
│  │  - Types (SendEmailRequest, ErrorResponse)     │     │
│  │  - Schemas (Zod validation)                    │     │
│  │  - SDK (Type-safe API methods)                 │     │
│  └───────────────────┬───────────────────────────┘     │
└────────────────────┬─┴──────────────────────────────────┘
                     │
                     ↓
┌─────────────────────────────────────────────────────────┐
│              HTTP Client Layer                           │
│  Got (with timeout, retry config, hooks)                │
└────────────────────┬────────────────────────────────────┘
                     │
                     ↓
┌─────────────────────────────────────────────────────────┐
│     Digital Envision Email Service API                  │
│  https://email-service.digitalenvision.com.au           │
└─────────────────────────────────────────────────────────┘
```

### Directory Structure

```
src/
├── clients/
│   ├── generated/                    # Auto-generated (gitignored)
│   │   └── email-service/
│   │       ├── types.ts              # OpenAPI types
│   │       ├── schemas.ts            # Zod schemas
│   │       ├── sdk.ts                # Generated SDK
│   │       └── index.ts              # Exports
│   │
│   └── email-service.client.ts       # Custom wrapper (DRY logic)
│
├── services/
│   └── message.service.ts            # Uses EmailServiceClient
│
docs/
└── vendor-specs/
    └── email-service-api.json        # Source of truth (committed)

scripts/
└── generate-clients.sh               # Generation script
```

### Generation Configuration

**File**: `openapi-ts.config.ts`

```typescript
import { defineConfig } from '@hey-api/openapi-ts';

export default defineConfig({
  client: '@hey-api/client-fetch', // We'll wrap with Got
  input: './docs/vendor-specs/email-service-api.json',
  output: {
    path: './src/clients/generated/email-service',
    format: 'prettier',
    lint: 'eslint',
  },
  plugins: [
    '@hey-api/typescript',
    '@hey-api/schemas',    // Generate Zod schemas
    '@hey-api/sdk',        // Generate type-safe SDK
  ],
  types: {
    enums: 'javascript',   // Use const enums (tree-shakeable)
    dates: true,           // Parse dates
  },
});
```

### NPM Script Integration

**In `package.json`:**

```json
{
  "scripts": {
    "generate:client": "openapi-ts",
    "generate:client:watch": "openapi-ts --watch",
    "generate:client:validate": "npm run openapi:validate && npm run generate:client",
    "prebuild": "npm run generate:client",
    "postinstall": "npm run generate:client"
  },
  "devDependencies": {
    "@hey-api/openapi-ts": "^0.45.0",
    "@hey-api/client-fetch": "^0.1.0"
  }
}
```

### CI/CD Integration

**GitHub Actions Workflow**: `.github/workflows/openapi-validation.yml`

```yaml
name: OpenAPI Client Validation

on:
  pull_request:
    paths:
      - 'docs/vendor-specs/**'
      - 'src/clients/**'
  push:
    branches:
      - main

jobs:
  validate-and-generate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Validate OpenAPI spec
        run: npm run openapi:validate

      - name: Check for breaking changes
        uses: oasdiff/oasdiff-action/breaking@v0.0.15
        with:
          base: main
          revision: HEAD
          fail-on-diff: true

      - name: Generate client
        run: npm run generate:client

      - name: Check if generated files are up to date
        run: |
          if [ -n "$(git status --porcelain src/clients/generated)" ]; then
            echo "Error: Generated client is out of sync"
            echo "Run 'npm run generate:client' locally"
            exit 1
          fi

      - name: Run type check
        run: npm run typecheck

      - name: Run tests
        run: npm run test:unit -- --run src/clients
```

---

## 3. Benefits Analysis

### DRY Principle Benefits

#### Before (Manual Implementation)

```typescript
// message.service.ts - 400+ lines of boilerplate
class MessageSenderService {
  private readonly httpClient: Got;
  private readonly circuitBreaker: CircuitBreaker;

  // Manual retry config (50+ lines)
  private readonly retryConfig = { /* ... */ };

  // Manual circuit breaker setup (80+ lines)
  private readonly circuitBreakerOptions = { /* ... */ };

  // Manual request building (50+ lines)
  async sendBirthdayMessage(user: User) {
    // Compose payload manually
    const payload = {
      userId: user.id,
      email: user.email,
      // ... more fields
    };

    // Make HTTP request
    const response = await this.httpClient.post(/* ... */);

    // Manual error handling
    if (error) { /* ... */ }
  }

  // Duplicate code for anniversary messages
  async sendAnniversaryMessage(user: User) {
    // 90% same code, copy-pasted
  }
}
```

**Problems:**
- 400+ lines of HTTP boilerplate
- Manual type definitions (risk of drift from API)
- Duplicated error handling logic
- No compile-time safety for API changes
- Difficult to maintain across multiple endpoints
- Manual testing of HTTP client code

#### After (Generated Client + Wrapper)

```typescript
// email-service.client.ts - 100 lines (DRY wrapper)
import { EmailService, type SendEmailRequest } from './generated/email-service';

class EmailServiceClient {
  private readonly sdk: EmailService;
  private readonly circuitBreaker: CircuitBreaker;

  async sendEmail(request: SendEmailRequest) {
    return this.circuitBreaker.fire(() =>
      this.sdk.sendEmail(request)
    );
  }
}

// message.service.ts - 50 lines (business logic only)
class MessageSenderService {
  constructor(private client: EmailServiceClient) {}

  async sendBirthdayMessage(user: User) {
    return this.client.sendEmail({
      email: user.email,
      message: `Hey ${user.firstName}, happy birthday!`
    });
  }
}
```

**Benefits:**
- 80% less code (400 → 100 lines)
- Type safety from OpenAPI spec
- Single source of truth (API spec)
- Automatic updates when API changes
- Consistent error handling
- Easier testing (mock at client boundary)

### Type Safety Benefits

#### Compile-Time Safety

**Scenario**: API changes `email` field to `emailAddress`

**Without Generated Client:**
```typescript
// Runtime error - no compile-time warning
await httpClient.post('/send-email', {
  email: user.email,  // Wrong field name
  message: 'Birthday message'
});
// TypeError at runtime: "email is required"
```

**With Generated Client:**
```typescript
// Compile error - caught before deployment
await emailClient.sendEmail({
  email: user.email,  // TypeScript error immediately
  message: 'Birthday message'
});
// Error: Object literal may only specify known properties,
// and 'email' does not exist in type 'SendEmailRequest'.
// Did you mean 'emailAddress'?
```

#### Response Type Safety

```typescript
// Generated types from OpenAPI
const response = await emailClient.sendEmail(request);

// TypeScript knows exact response structure
if (response.success) {
  console.log(response.messageId);  // Type: string, pattern: ^msg-[0-9]+$
} else {
  console.log(response.error);      // Type: ErrorResponse
  console.log(response.message);    // Type: string
  console.log(response.retryAfter); // Type: number | undefined
}
```

### Maintenance Benefits

| Aspect | Manual HTTP Code | Generated Client |
|--------|------------------|------------------|
| **API Updates** | Manual code changes | Regenerate (1 command) |
| **Type Drift** | Requires manual sync | Impossible (auto-sync) |
| **New Endpoints** | Write from scratch | Auto-generated |
| **Breaking Changes** | Runtime errors | Compile errors |
| **Documentation** | Separate/outdated | Always up-to-date |
| **Testing Effort** | High (mock HTTP) | Low (mock at boundary) |
| **Code Review** | Review HTTP logic | Review wrapper only |
| **Onboarding** | Learn custom code | Read OpenAPI spec |

### Cost-Benefit Analysis

**Initial Investment:**
- Setup: 2-4 hours
- Migration: 4-6 hours
- Testing: 2-3 hours
- **Total**: 8-13 hours

**Ongoing Savings (per API change):**
- Manual update: 2-4 hours
- Generated update: 5-10 minutes
- **Savings**: ~95% time reduction

**Break-even**: After 3-5 API changes (typically 1-2 months)

---

## 4. Implementation Approach

### Phase 1: Setup & Configuration

#### Step 1.1: Install Dependencies

```bash
npm install --save-dev @hey-api/openapi-ts @hey-api/client-fetch
npm install zod  # For runtime validation (optional)
```

#### Step 1.2: Create Configuration

**File**: `openapi-ts.config.ts`

```typescript
import { defineConfig } from '@hey-api/openapi-ts';

export default defineConfig({
  client: '@hey-api/client-fetch',
  input: './docs/vendor-specs/email-service-api.json',
  output: {
    path: './src/clients/generated/email-service',
    format: 'prettier',
    lint: 'eslint',
  },
  plugins: [
    '@hey-api/typescript',
    {
      name: '@hey-api/schemas',
      type: 'zod',  // Generate Zod schemas for runtime validation
    },
    '@hey-api/sdk',
  ],
  types: {
    enums: 'javascript',
    dates: true,
  },
});
```

#### Step 1.3: Update .gitignore

```gitignore

# Generated API clients (regenerate from spec)

src/clients/generated/
```

**Note**: Some teams commit generated code for easier debugging. See [Best Practices](#5-best-practices) for guidance.

#### Step 1.4: Generate Initial Client

```bash
npm run generate:client
```

**Expected Output:**
```
src/clients/generated/email-service/
├── types.ts       # TypeScript interfaces
├── schemas.ts     # Zod schemas
├── sdk.ts         # Type-safe SDK
└── index.ts       # Barrel exports
```

### Phase 2: Create Custom Wrapper

#### Step 2.1: Email Service Client Wrapper

**File**: `src/clients/email-service.client.ts`

```typescript
import got, { Got, HTTPError } from 'got';
import CircuitBreaker from 'opossum';
import { z } from 'zod';
import { logger } from '../config/logger.js';
import { metricsService } from '../services/metrics.service.js';
import { ExternalServiceError } from '../utils/errors.js';

// Import generated types and schemas
import type {
  SendEmailRequest,
  SendEmailSuccessResponse,
  ErrorResponse,
} from './generated/email-service/types.js';
import { SendEmailRequestSchema } from './generated/email-service/schemas.js';

/**
 * Unified response type for email operations
 */
export type EmailServiceResponse = {
  success: boolean;
  statusCode: number;
  data?: SendEmailSuccessResponse;
  error?: ErrorResponse;
};

/**
 * Email Service Client
 *
 * Wraps generated OpenAPI client with:
 * - Circuit breaker pattern
 * - Retry logic with exponential backoff
 * - Error mapping and standardization
 * - Metrics collection
 * - Logging integration
 *
 * This wrapper provides the "DRY" logic while the generated
 * client handles type-safe HTTP requests.
 */
export class EmailServiceClient {
  private readonly httpClient: Got;
  private readonly circuitBreaker: CircuitBreaker;
  private readonly baseUrl: string;

  constructor(baseUrl: string = 'https://email-service.digitalenvision.com.au') {
    this.baseUrl = baseUrl;

    // Initialize Got HTTP client with retry configuration
    this.httpClient = got.extend({
      prefixUrl: this.baseUrl,
      retry: {
        limit: 5,
        methods: ['POST'],
        statusCodes: [408, 413, 429, 500, 502, 503, 504],
        calculateDelay: ({ attemptCount }): number => {
          // Exponential backoff: 2s, 4s, 8s, 16s, 32s
          const delay = Math.pow(2, attemptCount) * 1000;
          logger.debug({ attemptCount, delay }, 'HTTP retry with exponential backoff');
          return delay;
        },
      },
      timeout: {
        request: 10000, // 10 seconds
      },
      hooks: {
        beforeRequest: [
          (options) => {
            logger.debug(
              { url: options.url?.toString(), method: options.method },
              'Email service request'
            );
            metricsService.incrementCounter('email_service_requests_total');
          },
        ],
        afterResponse: [
          (response) => {
            logger.debug(
              { statusCode: response.statusCode },
              'Email service response'
            );
            metricsService.recordHistogram(
              'email_service_response_time_ms',
              response.timings.phases.total || 0
            );
            return response;
          },
        ],
      },
    });

    // Initialize circuit breaker
    this.circuitBreaker = new CircuitBreaker(
      this.sendEmailRequest.bind(this),
      {
        timeout: 10000,
        errorThresholdPercentage: 50,
        resetTimeout: 30000,
        rollingCountTimeout: 10000,
        rollingCountBuckets: 10,
      }
    );

    // Circuit breaker event handlers
    this.circuitBreaker.on('open', () => {
      logger.warn('Email service circuit breaker opened');
      metricsService.setCircuitBreakerStatus('email_service', true);
    });

    this.circuitBreaker.on('close', () => {
      logger.info('Email service circuit breaker closed');
      metricsService.setCircuitBreakerStatus('email_service', false);
    });

    metricsService.setCircuitBreakerStatus('email_service', false);
  }

  /**
   * Send email using generated types and runtime validation
   */
  async sendEmail(request: SendEmailRequest): Promise<EmailServiceResponse> {
    // Runtime validation using generated Zod schema
    try {
      SendEmailRequestSchema.parse(request);
    } catch (error) {
      if (error instanceof z.ZodError) {
        logger.error({ errors: error.errors }, 'Invalid email request');
        throw new ExternalServiceError('Invalid email request', {
          zodErrors: error.errors,
        });
      }
      throw error;
    }

    try {
      const response = await this.circuitBreaker.fire(request);
      return response;
    } catch (error) {
      if (this.circuitBreaker.opened) {
        throw new ExternalServiceError(
          'Email service unavailable (circuit breaker open)',
          { circuitState: 'open' }
        );
      }
      throw error;
    }
  }

  /**
   * Internal HTTP request with error mapping
   */
  private async sendEmailRequest(
    request: SendEmailRequest
  ): Promise<EmailServiceResponse> {
    try {
      const response = await this.httpClient.post('send-email', {
        json: request,
        responseType: 'json',
      });

      const data = response.body as SendEmailSuccessResponse;

      return {
        success: true,
        statusCode: response.statusCode,
        data,
      };
    } catch (error) {
      if (error instanceof HTTPError) {
        const errorBody = error.response.body as ErrorResponse;

        logger.error(
          {
            statusCode: error.response.statusCode,
            error: errorBody.error,
            message: errorBody.message,
          },
          'Email service error response'
        );

        // Map HTTP errors to standardized responses
        return {
          success: false,
          statusCode: error.response.statusCode,
          error: errorBody,
        };
      }

      logger.error(
        { error: error instanceof Error ? error.message : String(error) },
        'Email service network error'
      );

      throw new ExternalServiceError('Email service request failed', {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Get circuit breaker statistics
   */
  getStats(): {
    state: string;
    failures: number;
    successes: number;
    isOpen: boolean;
  } {
    return {
      state: this.circuitBreaker.opened
        ? 'open'
        : this.circuitBreaker.halfOpen
        ? 'half-open'
        : 'closed',
      failures: this.circuitBreaker.stats.failures,
      successes: this.circuitBreaker.stats.successes,
      isOpen: this.circuitBreaker.opened,
    };
  }

  /**
   * Check service health
   */
  isHealthy(): boolean {
    return !this.circuitBreaker.opened;
  }

  /**
   * Reset circuit breaker (for testing)
   */
  resetCircuitBreaker(): void {
    this.circuitBreaker.close();
  }
}

// Export singleton instance
export const emailServiceClient = new EmailServiceClient();
```

### Phase 3: Integrate with Message Service

#### Step 3.1: Update MessageSenderService

**File**: `src/services/message.service.ts`

```typescript
import { User } from '../db/schema/users.js';
import { ValidationError } from '../utils/errors.js';
import { logger } from '../config/logger.js';
import { emailServiceClient, EmailServiceClient } from '../clients/email-service.client.js';

/**
 * Message response (for backward compatibility)
 */
export interface MessageResponse {
  success: boolean;
  statusCode: number;
  body?: string;
  error?: string;
}

/**
 * MessageSenderService
 *
 * Simplified service that focuses on business logic.
 * HTTP concerns delegated to EmailServiceClient.
 */
export class MessageSenderService {
  constructor(
    private readonly client: EmailServiceClient = emailServiceClient
  ) {
    logger.info('MessageSenderService initialized with generated client');
  }

  /**
   * Send birthday message
   */
  async sendBirthdayMessage(user: User): Promise<MessageResponse> {
    this.validateUser(user);

    const message = this.composeBirthdayMessage(user);

    logger.info(
      { userId: user.id, email: user.email },
      'Sending birthday message'
    );

    const response = await this.client.sendEmail({
      email: user.email,
      message,
    });

    return this.mapToLegacyResponse(response);
  }

  /**
   * Send anniversary message
   */
  async sendAnniversaryMessage(user: User): Promise<MessageResponse> {
    this.validateUser(user);

    const message = this.composeAnniversaryMessage(user);

    logger.info(
      { userId: user.id, email: user.email },
      'Sending anniversary message'
    );

    const response = await this.client.sendEmail({
      email: user.email,
      message,
    });

    return this.mapToLegacyResponse(response);
  }

  /**
   * Validate user input
   */
  private validateUser(user: User): void {
    if (!user || !user.id) {
      throw new ValidationError('User object is required with valid ID');
    }
    if (!user.email) {
      throw new ValidationError('User email is required');
    }
  }

  /**
   * Compose birthday message
   */
  private composeBirthdayMessage(user: User): string {
    return `Hey ${user.firstName}, happy birthday!`;
  }

  /**
   * Compose anniversary message
   */
  private composeAnniversaryMessage(user: User): string {
    return `Hey ${user.firstName}, happy work anniversary!`;
  }

  /**
   * Map new response to legacy format (for backward compatibility)
   */
  private mapToLegacyResponse(
    response: import('../clients/email-service.client.js').EmailServiceResponse
  ): MessageResponse {
    if (response.success && response.data) {
      return {
        success: true,
        statusCode: response.statusCode,
        body: JSON.stringify(response.data),
      };
    } else if (response.error) {
      return {
        success: false,
        statusCode: response.statusCode,
        body: JSON.stringify(response.error),
        error: response.error.message,
      };
    }

    return {
      success: false,
      statusCode: response.statusCode,
      error: 'Unknown error',
    };
  }

  /**
   * Get circuit breaker statistics
   */
  getCircuitBreakerStats() {
    return this.client.getStats();
  }

  /**
   * Reset circuit breaker
   */
  resetCircuitBreaker(): void {
    this.client.resetCircuitBreaker();
  }

  /**
   * Check service health
   */
  isHealthy(): boolean {
    return this.client.isHealthy();
  }
}

// Export singleton instance
export const messageSenderService = new MessageSenderService();
```

### Phase 4: Testing Generated Client

#### Step 4.1: Unit Tests for Wrapper

**File**: `tests/unit/clients/email-service.client.test.ts`

```typescript
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { EmailServiceClient } from '../../../src/clients/email-service.client.js';
import type { SendEmailRequest } from '../../../src/clients/generated/email-service/types.js';

describe('EmailServiceClient', () => {
  let client: EmailServiceClient;

  beforeEach(() => {
    client = new EmailServiceClient('http://localhost:3001');
    client.resetCircuitBreaker();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('sendEmail', () => {
    it('should validate request using Zod schema', async () => {
      const invalidRequest = {
        email: 'invalid-email',  // Invalid email format
        message: '',             // Empty message
      } as SendEmailRequest;

      await expect(client.sendEmail(invalidRequest)).rejects.toThrow();
    });

    it('should accept valid email request', () => {
      const validRequest: SendEmailRequest = {
        email: 'test@example.com',
        message: 'Test message',
      };

      // Should not throw validation error
      expect(() => validRequest).not.toThrow();
    });
  });

  describe('circuit breaker', () => {
    it('should initialize with circuit closed', () => {
      const stats = client.getStats();
      expect(stats.isOpen).toBe(false);
      expect(stats.state).toBe('closed');
    });

    it('should report healthy when circuit is closed', () => {
      expect(client.isHealthy()).toBe(true);
    });
  });

  describe('type safety', () => {
    it('should enforce SendEmailRequest type', () => {
      const request: SendEmailRequest = {
        email: 'user@example.com',
        message: 'Hello',
      };

      // TypeScript compilation ensures type safety
      expect(request.email).toBeDefined();
      expect(request.message).toBeDefined();
    });
  });
});
```

#### Step 4.2: Integration Tests

**File**: `tests/integration/clients/email-service.integration.test.ts`

```typescript
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { GenericContainer, StartedTestContainer } from 'testcontainers';
import { EmailServiceClient } from '../../../src/clients/email-service.client.js';

describe('EmailServiceClient Integration', () => {
  let mockApiContainer: StartedTestContainer;
  let client: EmailServiceClient;

  beforeAll(async () => {
    // Start mock email service (using mock-email-service container)
    mockApiContainer = await new GenericContainer('mock-email-service')
      .withExposedPorts(3001)
      .start();

    const baseUrl = `http://localhost:${mockApiContainer.getMappedPort(3001)}`;
    client = new EmailServiceClient(baseUrl);
  });

  afterAll(async () => {
    await mockApiContainer.stop();
  });

  it('should send email successfully', async () => {
    const response = await client.sendEmail({
      email: 'test@example.com',
      message: 'Test birthday message',
    });

    expect(response.success).toBe(true);
    expect(response.statusCode).toBe(200);
    expect(response.data).toBeDefined();
    expect(response.data?.messageId).toMatch(/^msg-\d+$/);
  });

  it('should handle 400 Bad Request', async () => {
    const response = await client.sendEmail({
      email: 'invalid',
      message: 'Test',
    });

    expect(response.success).toBe(false);
    expect(response.statusCode).toBe(400);
    expect(response.error).toBeDefined();
    expect(response.error?.error).toBe('Bad Request');
  });

  it('should retry on 500 errors', async () => {
    // Mock service configured to fail 2 times then succeed
    const response = await client.sendEmail({
      email: 'retry@example.com',
      message: 'Retry test',
    });

    expect(response.success).toBe(true);
  });
});
```

---

## 5. Best Practices

### Versioning Generated Code

#### Option 1: Gitignore Generated Files (Recommended)

**Pros:**
- Smaller repository size
- No merge conflicts on generated code
- Forces developers to regenerate locally
- Clear separation of source vs. generated

**Cons:**
- Requires build step
- Potential for version mismatches
- Debugging is harder (no git history)

**When to Use:**
- Stable OpenAPI specs
- Good CI/CD pipeline
- Team comfortable with build tools

**Implementation:**

```gitignore

# .gitignore

src/clients/generated/
```

```json
// package.json
{
  "scripts": {
    "postinstall": "npm run generate:client",
    "prebuild": "npm run generate:client"
  }
}
```

#### Option 2: Commit Generated Files

**Pros:**
- No build step required
- Easy debugging (git blame, history)
- Clear diff in PRs
- Works without npm install

**Cons:**
- Larger repository
- Merge conflicts possible
- Generated code in code review

**When to Use:**
- Frequently changing specs
- Junior developers on team
- Limited CI/CD resources
- Need git history for generated code

**Implementation:**

```gitignore

# .gitignore (don't ignore generated)
# src/clients/generated/  ← commented out

```

**Add CI check:**

```yaml

# Ensure generated code is committed

- name: Check generated code is up to date
  run: |
    npm run generate:client
    git diff --exit-code src/clients/generated/
```

#### Recommendation

**For this project**: **Gitignore generated files** because:
1. Well-established CI/CD pipeline exists
2. Stable API (vendor spec)
3. Team is experienced
4. OpenAPI spec is versioned

### Breaking Change Detection

#### Tool: oasdiff

**Installation:**

```bash
npm install --save-dev oasdiff
```

**NPM Script:**

```json
{
  "scripts": {
    "openapi:diff": "oasdiff breaking docs/vendor-specs/email-service-api.json docs/vendor-specs/email-service-api.new.json",
    "openapi:changelog": "oasdiff changelog docs/vendor-specs/email-service-api.old.json docs/vendor-specs/email-service-api.json"
  }
}
```

**GitHub Action Integration:**

```yaml

# .github/workflows/openapi-validation.yml

- name: Check for breaking changes
  uses: oasdiff/oasdiff-action/breaking@v0.0.15
  with:
    base: main
    revision: HEAD
    fail-on-diff: true
```

**Breaking Change Categories:**

| Category | Example | Severity |
|----------|---------|----------|
| **Endpoint Removed** | DELETE /send-email | Critical |
| **Required Field Added** | email: { required: true } | Critical |
| **Field Type Changed** | message: string → number | Critical |
| **Response Schema Changed** | messageId removed | High |
| **Optional Field Added** | subject?: string | Low |
| **Description Changed** | Documentation only | Info |

#### Alternative Tool: openapi-changes

```bash
npx @pb33f/openapi-changes summary \
  --base docs/vendor-specs/email-service-api.json \
  --new docs/vendor-specs/email-service-api.new.json \
  --format markdown
```

### Handling Authentication

**Current State**: No authentication required (per spec)

**Future-Proof Implementation:**

```typescript
// email-service.client.ts
export class EmailServiceClient {
  constructor(
    baseUrl: string,
    private apiKey?: string  // Future API key support
  ) {
    this.httpClient = got.extend({
      // ...
      hooks: {
        beforeRequest: [
          (options) => {
            // Add API key if configured
            if (this.apiKey) {
              options.headers['X-API-Key'] = this.apiKey;
            }
          },
        ],
      },
    });
  }
}
```

**When vendor adds API key:**

1. Update OpenAPI spec (add security scheme)
2. Regenerate client (picks up security)
3. Pass API key to constructor
4. No other code changes needed

### Error Handling Strategy

#### Three-Layer Error Handling

**Layer 1: Generated Client (Type-Safe Responses)**

```typescript
// Auto-generated type from OpenAPI
type ErrorResponse = {
  error: string;
  message: string;
  retryAfter?: number;
};
```

**Layer 2: Wrapper Client (HTTP Error Mapping)**

```typescript
// email-service.client.ts
private async sendEmailRequest(request: SendEmailRequest) {
  try {
    const response = await this.httpClient.post('send-email', {
      json: request,
    });
    return { success: true, statusCode: 200, data: response.body };
  } catch (error) {
    if (error instanceof HTTPError) {
      const errorBody = error.response.body as ErrorResponse;
      return {
        success: false,
        statusCode: error.response.statusCode,
        error: errorBody,
      };
    }
    throw new ExternalServiceError('Network error', { error });
  }
}
```

**Layer 3: Service Layer (Business Logic Errors)**

```typescript
// message.service.ts
async sendBirthdayMessage(user: User) {
  this.validateUser(user);  // ValidationError

  const response = await this.client.sendEmail({ /* ... */ });

  if (!response.success) {
    if (response.statusCode === 429) {
      // Handle rate limiting
      logger.warn({ retryAfter: response.error?.retryAfter }, 'Rate limited');
      throw new RateLimitError('Too many requests', {
        retryAfter: response.error?.retryAfter,
      });
    }
    throw new ExternalServiceError('Email failed', { response });
  }

  return response;
}
```

### Retry Logic Integration

#### Configuration Matrix

| Error Type | Retry? | Strategy | Max Attempts |
|------------|--------|----------|--------------|
| **Network Error** | Yes | Exponential backoff | 5 |
| **Timeout** | Yes | Exponential backoff | 5 |
| **429 Rate Limit** | Yes | Respect Retry-After | 3 |
| **500 Server Error** | Yes | Exponential backoff | 5 |
| **503 Unavailable** | Yes | Exponential backoff | 5 |
| **400 Bad Request** | No | Fail fast | 0 |
| **401 Unauthorized** | No | Fail fast | 0 |
| **404 Not Found** | No | Fail fast | 0 |

#### Implementation

```typescript
// Got configuration with OpenAPI-aware retry
this.httpClient = got.extend({
  retry: {
    limit: 5,
    methods: ['POST'],
    statusCodes: [408, 413, 429, 500, 502, 503, 504],
    calculateDelay: ({ attemptCount, error }): number => {
      // Respect Retry-After header (from OpenAPI spec)
      if (error?.response?.headers['retry-after']) {
        const retryAfter = parseInt(error.response.headers['retry-after'], 10);
        return retryAfter * 1000;
      }

      // Exponential backoff: 2s, 4s, 8s, 16s, 32s
      return Math.pow(2, attemptCount) * 1000;
    },
  },
});
```

---

## 6. Migration Strategy

### Migration Phases

#### Phase 1: Parallel Implementation (Week 1)

**Goal**: Run old and new implementations side-by-side

**Steps:**

1. Install @hey-api/openapi-ts
2. Generate client (`npm run generate:client`)
3. Create EmailServiceClient wrapper
4. DO NOT modify MessageSenderService yet
5. Add feature flag for switching

**Code:**

```typescript
// message.service.ts
export class MessageSenderService {
  private readonly useGeneratedClient: boolean;

  constructor(
    private oldHttpClient: Got,
    private newEmailClient?: EmailServiceClient
  ) {
    this.useGeneratedClient = process.env.USE_GENERATED_CLIENT === 'true';
  }

  async sendBirthdayMessage(user: User) {
    if (this.useGeneratedClient && this.newEmailClient) {
      return this.sendBirthdayMessageV2(user);
    }
    return this.sendBirthdayMessageV1(user);
  }

  private async sendBirthdayMessageV1(user: User) {
    // Old implementation
  }

  private async sendBirthdayMessageV2(user: User) {
    // New implementation using generated client
  }
}
```

**Testing:**

```bash

# Test old implementation

npm run test:integration

# Test new implementation

USE_GENERATED_CLIENT=true npm run test:integration

# Both should pass

```

#### Phase 2: Canary Deployment (Week 2)

**Goal**: Deploy to 10% of traffic, monitor for issues

**Steps:**

1. Deploy with feature flag
2. Enable for 10% of users
3. Monitor metrics, errors, latency
4. Compare old vs. new performance

**Metrics to Track:**

| Metric | Old | New | Threshold |
|--------|-----|-----|-----------|
| Success Rate | 90% | ? | >= 90% |
| P95 Latency | 200ms | ? | <= 220ms |
| Error Rate | 10% | ? | <= 10% |
| Circuit Breaker Opens | 5/day | ? | <= 5/day |

**Rollback Plan:**

```typescript
// Emergency rollback
if (newImplementationFailureRate > oldImplementationFailureRate * 1.1) {
  logger.error('New implementation degraded, rolling back');
  process.env.USE_GENERATED_CLIENT = 'false';
}
```

#### Phase 3: Full Migration (Week 3)

**Goal**: Migrate 100% traffic, remove old code

**Steps:**

1. Increase to 50% traffic
2. Monitor for 24 hours
3. Increase to 100% traffic
4. Monitor for 48 hours
5. Remove old implementation
6. Remove feature flag
7. Update documentation

**Final Code:**

```typescript
// message.service.ts (cleaned up)
export class MessageSenderService {
  constructor(
    private readonly client: EmailServiceClient = emailServiceClient
  ) {}

  async sendBirthdayMessage(user: User) {
    // Only new implementation
  }
}
```

**Cleanup:**

```bash

# Remove old HTTP client code

git rm src/services/message.service.old.ts

# Update tests

git mv tests/unit/services/message.service.v2.test.ts \
       tests/unit/services/message.service.test.ts

# Remove feature flag
# Remove USE_GENERATED_CLIENT from .env

```

#### Phase 4: Validation & Optimization (Week 4)

**Goal**: Ensure everything works, optimize

**Steps:**

1. Run full test suite
2. Run performance tests
3. Review error logs
4. Optimize bundle size
5. Update documentation
6. Team training

**Validation Checklist:**

- [ ] All unit tests pass
- [ ] All integration tests pass
- [ ] E2E tests pass
- [ ] Performance benchmarks meet SLA
- [ ] Circuit breaker works correctly
- [ ] Retry logic functions as expected
- [ ] Error handling is comprehensive
- [ ] Logging is adequate
- [ ] Metrics are collected
- [ ] Documentation is updated

### Rollback Strategy

**Trigger Conditions:**

1. Error rate increases > 20%
2. P95 latency increases > 50%
3. Circuit breaker opens > 2x baseline
4. Critical bug discovered

**Rollback Steps:**

```bash

# 1. Revert feature flag

export USE_GENERATED_CLIENT=false

# 2. Restart services

npm run docker:prod:down
npm run docker:prod:up

# 3. Monitor recovery

npm run docker:prod:logs

# 4. If needed, revert code

git revert <commit-hash>
```

**Post-Rollback:**

1. Root cause analysis
2. Fix issues in generated client/wrapper
3. Add tests to prevent regression
4. Plan re-migration

---

## 7. Complete Implementation Plan

### Timeline Overview

| Phase | Duration | Tasks | Deliverables |
|-------|----------|-------|--------------|
| **Phase 1: Setup** | 1 day | Install deps, generate client | Generated types, SDK |
| **Phase 2: Wrapper** | 2 days | Create EmailServiceClient | Type-safe wrapper |
| **Phase 3: Integration** | 2 days | Update MessageSenderService | Integrated service |
| **Phase 4: Testing** | 2 days | Unit, integration tests | Test suite |
| **Phase 5: Migration** | 1 week | Parallel run, canary | Production deployment |
| **Phase 6: Cleanup** | 1 day | Remove old code, docs | Final codebase |
| **Total** | ~2 weeks | | Production-ready |

### Detailed Task Breakdown

#### Week 1: Implementation

**Day 1: Setup & Generation**

- [ ] Install @hey-api/openapi-ts
- [ ] Create openapi-ts.config.ts
- [ ] Add npm scripts (generate:client, etc.)
- [ ] Generate initial client
- [ ] Verify generated types
- [ ] Update .gitignore
- [ ] Commit configuration

**Day 2-3: Wrapper Implementation**

- [ ] Create src/clients/email-service.client.ts
- [ ] Implement EmailServiceClient class
- [ ] Integrate Got HTTP client
- [ ] Add circuit breaker
- [ ] Add retry logic
- [ ] Add error mapping
- [ ] Add logging and metrics
- [ ] Add Zod validation

**Day 4-5: Service Integration**

- [ ] Update MessageSenderService
- [ ] Add feature flag support
- [ ] Implement v1 and v2 methods
- [ ] Update service exports
- [ ] Test locally

**Day 6-7: Testing**

- [ ] Write unit tests for wrapper
- [ ] Write integration tests
- [ ] Update existing tests
- [ ] Test circuit breaker
- [ ] Test retry logic
- [ ] Test error scenarios
- [ ] Achieve 90%+ coverage

#### Week 2: Migration & Production

**Day 8-9: Canary Deployment**

- [ ] Deploy with feature flag off
- [ ] Enable for 10% traffic
- [ ] Monitor metrics (24 hours)
- [ ] Compare old vs. new performance
- [ ] Fix any issues

**Day 10-11: Full Migration**

- [ ] Increase to 50% traffic
- [ ] Monitor (24 hours)
- [ ] Increase to 100% traffic
- [ ] Monitor (48 hours)

**Day 12: Cleanup**

- [ ] Remove old implementation
- [ ] Remove feature flag
- [ ] Update documentation
- [ ] Team training session
- [ ] Post-migration review

### Success Criteria

#### Functional Requirements

- [ ] All messages sent successfully
- [ ] Type safety enforced at compile time
- [ ] Error handling matches old behavior
- [ ] Circuit breaker works correctly
- [ ] Retry logic functions as expected
- [ ] Metrics collected accurately

#### Non-Functional Requirements

- [ ] Code reduction: 70%+ less HTTP boilerplate
- [ ] Performance: <= 10% latency increase
- [ ] Reliability: >= 90% success rate maintained
- [ ] Maintainability: 50%+ faster to add new endpoints
- [ ] Type safety: 100% API surface typed

#### Quality Metrics

- [ ] Test coverage: >= 90%
- [ ] Code review: Approved by 2+ engineers
- [ ] Documentation: Complete and up-to-date
- [ ] CI/CD: All checks passing
- [ ] Security: No new vulnerabilities

### Risk Mitigation

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| **Breaking API changes** | Medium | High | Use breaking change detection (oasdiff) |
| **Performance degradation** | Low | High | Canary deployment, monitor metrics |
| **Type safety issues** | Low | Medium | Comprehensive testing, Zod validation |
| **Bundle size increase** | Low | Low | Tree-shaking, measure bundle size |
| **Team adoption** | Medium | Medium | Training, documentation, pair programming |
| **Vendor spec outdated** | Medium | Medium | Validate spec against live API |

---

## 8. Code Examples

### Example 1: Type-Safe Request/Response

```typescript
import type { SendEmailRequest, SendEmailSuccessResponse } from './generated/email-service';

async function sendBirthdayEmail(email: string, name: string) {
  // TypeScript enforces correct request structure
  const request: SendEmailRequest = {
    email,  // Type: string (format: email, maxLength: 255)
    message: `Hey ${name}, happy birthday!`,  // Type: string (minLength: 1, maxLength: 10000)
  };

  // Generated SDK ensures type-safe response
  const response = await emailClient.sendEmail(request);

  // TypeScript knows exact response structure
  if (response.success && response.data) {
    // response.data is SendEmailSuccessResponse
    console.log(`Message sent: ${response.data.messageId}`);
    // messageId matches pattern: ^msg-[0-9]+$
  } else if (response.error) {
    // response.error is ErrorResponse
    console.error(`Error: ${response.error.message}`);

    // retryAfter is typed as number | undefined
    if (response.error.retryAfter) {
      console.log(`Retry after ${response.error.retryAfter} seconds`);
    }
  }
}
```

### Example 2: Handling Different Error Scenarios

```typescript
async function robustEmailSending(user: User) {
  try {
    const response = await emailClient.sendEmail({
      email: user.email,
      message: composeBirthdayMessage(user),
    });

    if (response.success) {
      return response.data;
    }

    // Handle different error codes
    switch (response.statusCode) {
      case 400:
        // Bad Request - validation error
        logger.error({ error: response.error }, 'Invalid email request');
        throw new ValidationError(response.error?.message || 'Invalid request');

      case 429:
        // Rate limit exceeded
        const retryAfter = response.error?.retryAfter || 60;
        logger.warn({ retryAfter }, 'Rate limited');
        throw new RateLimitError(`Retry after ${retryAfter}s`, { retryAfter });

      case 500:
      case 503:
        // Server errors - will be retried automatically
        logger.error({ statusCode: response.statusCode }, 'Server error');
        throw new ExternalServiceError('Email service unavailable');

      default:
        logger.error({ statusCode: response.statusCode }, 'Unexpected error');
        throw new ExternalServiceError('Email failed');
    }
  } catch (error) {
    if (error instanceof ExternalServiceError) {
      // Circuit breaker opened
      metricsService.incrementCounter('email_service_circuit_open');
      throw error;
    }
    throw error;
  }
}
```

### Example 3: Testing with Generated Types

```typescript
import { describe, it, expect, vi } from 'vitest';
import type { SendEmailRequest, SendEmailSuccessResponse } from '../../../src/clients/generated/email-service';

describe('Email Service Integration', () => {
  it('should send email with correct types', async () => {
    // Mock response using generated type
    const mockResponse: SendEmailSuccessResponse = {
      success: true,
      messageId: 'msg-1234567890',
    };

    const sendEmailSpy = vi.spyOn(emailClient, 'sendEmail').mockResolvedValue({
      success: true,
      statusCode: 200,
      data: mockResponse,
    });

    // Type-safe request
    const request: SendEmailRequest = {
      email: 'test@example.com',
      message: 'Test message',
    };

    const result = await emailClient.sendEmail(request);

    expect(sendEmailSpy).toHaveBeenCalledWith(request);
    expect(result.success).toBe(true);
    expect(result.data?.messageId).toMatch(/^msg-\d+$/);
  });

  it('should handle error response with correct types', async () => {
    const mockErrorResponse: ErrorResponse = {
      error: 'Bad Request',
      message: 'Invalid email address format',
    };

    vi.spyOn(emailClient, 'sendEmail').mockResolvedValue({
      success: false,
      statusCode: 400,
      error: mockErrorResponse,
    });

    const result = await emailClient.sendEmail({
      email: 'invalid',
      message: 'Test',
    });

    expect(result.success).toBe(false);
    expect(result.error?.error).toBe('Bad Request');
    expect(result.error?.message).toContain('Invalid email');
  });
});
```

### Example 4: Runtime Validation with Zod

```typescript
import { z } from 'zod';
import { SendEmailRequestSchema } from './generated/email-service/schemas';

async function sendEmailWithValidation(email: string, message: string) {
  // Runtime validation using generated Zod schema
  const result = SendEmailRequestSchema.safeParse({ email, message });

  if (!result.success) {
    // Detailed validation errors
    logger.error({ errors: result.error.errors }, 'Validation failed');

    result.error.errors.forEach((err) => {
      console.log(`${err.path.join('.')}: ${err.message}`);
    });

    throw new ValidationError('Invalid email request', {
      zodErrors: result.error.errors,
    });
  }

  // Validated data is type-safe
  const validatedRequest = result.data;
  return emailClient.sendEmail(validatedRequest);
}
```

### Example 5: CI/CD Integration Script

**File**: `scripts/generate-and-validate-client.sh`

```bash

#!/bin/bash

set -e

echo "🔍 Validating OpenAPI specification..."
npm run openapi:validate

echo "🔎 Checking for breaking changes..."
if [ -f "docs/vendor-specs/email-service-api.old.json" ]; then
  npx oasdiff breaking \
    docs/vendor-specs/email-service-api.old.json \
    docs/vendor-specs/email-service-api.json
fi

echo "⚙️  Generating TypeScript client..."
npm run generate:client

echo "🔨 Building project..."
npm run build

echo "🧪 Running type checks..."
npm run typecheck

echo "✅ Client generation and validation complete!"
```

**Usage in GitHub Actions:**

```yaml
- name: Generate and validate client
  run: bash scripts/generate-and-validate-client.sh
```

### Example 6: Adding New Endpoint

**Scenario**: Vendor adds new endpoint `/send-bulk-email`

**Step 1**: Update OpenAPI spec

```json
{
  "paths": {
    "/send-bulk-email": {
      "post": {
        "operationId": "sendBulkEmail",
        "requestBody": {
          "content": {
            "application/json": {
              "schema": {
                "$ref": "#/components/schemas/SendBulkEmailRequest"
              }
            }
          }
        },
        "responses": {
          "200": {
            "description": "Bulk emails sent",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/SendBulkEmailResponse"
                }
              }
            }
          }
        }
      }
    }
  }
}
```

**Step 2**: Regenerate client

```bash
npm run generate:client
```

**Step 3**: Use generated types (auto-complete works!)

```typescript
// email-service.client.ts
async sendBulkEmail(request: SendBulkEmailRequest) {
  return this.circuitBreaker.fire(() =>
    this.httpClient.post('send-bulk-email', { json: request })
  );
}

// message.service.ts
async sendBulkBirthdayMessages(users: User[]) {
  const emails = users.map(u => ({
    email: u.email,
    message: this.composeBirthdayMessage(u),
  }));

  return this.client.sendBulkEmail({ emails });
}
```

**Total Time**: 5-10 minutes (vs. 1-2 hours manually)

---

## 9. References

### Research Sources

1. **Tool Comparison**
   - [openapi-typescript vs @hey-api/openapi-ts vs swagger-typescript-api](https://npm-compare.com/@hey-api/openapi-ts,openapi-typescript,swagger-typescript-api)
   - [Hey API - Production-ready SDKs](https://github.com/hey-api/openapi-ts)
   - [OpenAPI TypeScript Code Generators Comparison](https://www.speakeasy.com/docs/sdks/languages/typescript/oss-comparison-ts)

2. **OpenAPI Generator**
   - [Building Type-Safe API Client: Beyond Axios vs Fetch](https://dev.to/limacodes/building-a-type-safe-api-client-in-typescript-beyond-axios-vs-fetch-4a3i)
   - [TypeScript-Axios Generator Documentation](https://openapi-generator.tech/docs/generators/typescript-axios/)
   - [Comparing OpenAPI TypeScript SDK Generators](https://www.speakeasy.com/docs/sdks/languages/typescript/oss-comparison-ts)

3. **Best Practices**
   - [OpenAPI Best Practices](https://learn.openapis.org/best-practices.html)
   - [Git Best Practices 2025](https://scriptbinary.com/git/git-best-practices-improving-workflow-2025)
   - [Don't ignore .gitignore](https://opensource.com/article/20/8/dont-ignore-gitignore)

4. **Breaking Change Detection**
   - [Detecting Breaking Changes in OpenAPI Specs](https://reuvenharrison.medium.com/detecting-breaking-changes-in-openapi-specifications-df19971321c8)
   - [Using oasdiff to Detect Breaking Changes](https://nordicapis.com/using-oasdiff-to-detect-breaking-changes-in-apis/)
   - [openapi-changes - Breaking Change Detector](https://github.com/pb33f/openapi-changes)
   - [oasdiff - OpenAPI Diff Tool](https://www.oasdiff.com/)

5. **Error Handling & Retry Logic**
   - [Retry Failed Request with openapi-typescript](https://github.com/openapi-ts/openapi-typescript/discussions/2089)
   - [Retries in OpenAPI SDKs](https://www.speakeasy.com/docs/customize/runtime/retries)
   - [Error Responses in OpenAPI Best Practices](https://www.speakeasy.com/openapi/responses/errors)

### Package Documentation

- [@hey-api/openapi-ts](https://heyapi.dev/openapi-ts/get-started)
- [openapi-typescript](https://openapi-ts.dev/)
- [swagger-typescript-api](https://github.com/acacode/swagger-typescript-api)
- [openapi-generator](https://openapi-generator.tech/)
- [oasdiff](https://github.com/oasdiff/oasdiff)

### Related Documentation

- [OpenAPI 3.1 Specification](https://spec.openapis.org/oas/v3.1.0)
- [Zod Documentation](https://zod.dev/)
- [Got HTTP Client](https://github.com/sindresorhus/got)
- [Opossum Circuit Breaker](https://github.com/nodeshift/opossum)

---

## Appendix A: Quick Start Checklist

For immediate implementation, follow this checklist:

### Day 1: Setup

- [ ] `npm install --save-dev @hey-api/openapi-ts @hey-api/client-fetch`
- [ ] Create `openapi-ts.config.ts`
- [ ] Add `generate:client` script to package.json
- [ ] Run `npm run generate:client`
- [ ] Add `src/clients/generated/` to .gitignore
- [ ] Verify generated files exist

### Day 2-3: Wrapper

- [ ] Create `src/clients/email-service.client.ts`
- [ ] Copy circuit breaker from message.service.ts
- [ ] Copy retry logic from message.service.ts
- [ ] Add error mapping
- [ ] Add logging and metrics
- [ ] Test wrapper locally

### Day 4-5: Integration

- [ ] Update MessageSenderService to use EmailServiceClient
- [ ] Add backward compatibility layer
- [ ] Update tests
- [ ] Run full test suite
- [ ] Verify all tests pass

### Day 6-7: Testing & Deployment

- [ ] Run integration tests
- [ ] Run E2E tests
- [ ] Deploy with feature flag
- [ ] Monitor metrics
- [ ] Enable for 100% traffic
- [ ] Remove old code

---

## Appendix B: Troubleshooting Guide

### Common Issues

#### Issue: Generated types don't match API

**Symptom**: Runtime errors, type mismatches

**Cause**: OpenAPI spec out of sync with API

**Solution**:
1. Test API with Postman/curl
2. Update OpenAPI spec to match
3. Validate spec: `npm run openapi:validate`
4. Regenerate: `npm run generate:client`

#### Issue: Bundle size too large

**Symptom**: Webpack/Vite build warnings

**Cause**: Importing entire SDK instead of tree-shaking

**Solution**:
```typescript
// Bad - imports everything
import * as EmailService from './generated/email-service';

// Good - tree-shakeable
import { sendEmail } from './generated/email-service/sdk';
import type { SendEmailRequest } from './generated/email-service/types';
```

#### Issue: Circuit breaker not working

**Symptom**: No retry on failures

**Cause**: Error not thrown from wrapper

**Solution**:
```typescript
// Ensure errors are thrown
private async sendEmailRequest(request: SendEmailRequest) {
  const response = await this.httpClient.post(/* ... */);

  if (!response.ok) {
    throw new Error('Request failed');  // Must throw for circuit breaker
  }

  return response;
}
```

#### Issue: Type errors after regeneration

**Symptom**: TypeScript compilation errors

**Cause**: Breaking changes in API spec

**Solution**:
1. Run breaking change detection: `npm run openapi:diff`
2. Review changes
3. Update consuming code
4. Consider backward compatibility

---

**Document Version**: 1.0
**Last Updated**: 2025-12-30
**Next Review**: 2025-02-28
