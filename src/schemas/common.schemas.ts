/**
 * Common OpenAPI Schemas
 *
 * Reusable schema components used across multiple endpoints.
 * These schemas follow OpenAPI 3.1 specification.
 */

/**
 * Standard success response wrapper
 */
export const SuccessResponseSchema = {
  type: 'object',
  required: ['success', 'data', 'timestamp'],
  properties: {
    success: {
      type: 'boolean',
      description: 'Indicates successful operation',
      example: true,
    },
    data: {
      type: 'object',
      description: 'Response payload',
    },
    timestamp: {
      type: 'string',
      format: 'date-time',
      description: 'ISO 8601 timestamp of the response',
      example: '2025-12-30T10:30:00.000Z',
    },
  },
} as const;

/**
 * UUID parameter schema
 */
export const UuidParamSchema = {
  type: 'object',
  required: ['id'],
  properties: {
    id: {
      type: 'string',
      format: 'uuid',
      description: 'UUID identifier',
      example: '550e8400-e29b-41d4-a716-446655440000',
    },
  },
} as const;

/**
 * Pagination query parameters
 */
export const PaginationQuerySchema = {
  type: 'object',
  properties: {
    limit: {
      type: 'integer',
      minimum: 1,
      maximum: 100,
      default: 10,
      description: 'Number of items to return',
      example: 10,
    },
    offset: {
      type: 'integer',
      minimum: 0,
      default: 0,
      description: 'Number of items to skip',
      example: 0,
    },
  },
} as const;

/**
 * IANA timezone schema
 */
export const TimezoneSchema = {
  type: 'string',
  description: 'IANA timezone identifier',
  pattern: '^[A-Za-z]+/[A-Za-z_]+$',
  example: 'America/New_York',
  examples: [
    'America/New_York',
    'Europe/London',
    'Asia/Tokyo',
    'Australia/Sydney',
    'America/Los_Angeles',
  ],
} as const;

/**
 * Date string schema (YYYY-MM-DD)
 */
export const DateStringSchema = {
  type: 'string',
  format: 'date',
  description: 'Date in YYYY-MM-DD format',
  pattern: '^\\d{4}-\\d{2}-\\d{2}$',
  example: '1990-01-15',
} as const;

/**
 * Nullable date string schema
 */
export const NullableDateStringSchema = {
  ...DateStringSchema,
  nullable: true,
  example: null,
} as const;

/**
 * Email schema
 */
export const EmailSchema = {
  type: 'string',
  format: 'email',
  maxLength: 255,
  description: 'RFC 5322 compliant email address',
  example: 'user@example.com',
} as const;

/**
 * Rate limit headers
 */
export const RateLimitHeaders = {
  'X-RateLimit-Limit': {
    description: 'Maximum number of requests allowed in time window',
    schema: {
      type: 'integer',
      example: 100,
    },
  },
  'X-RateLimit-Remaining': {
    description: 'Number of requests remaining in current time window',
    schema: {
      type: 'integer',
      example: 95,
    },
  },
  'X-RateLimit-Reset': {
    description: 'Time when the rate limit resets (Unix timestamp)',
    schema: {
      type: 'integer',
      example: 1704027000,
    },
  },
  'Retry-After': {
    description: 'Seconds until rate limit resets',
    schema: {
      type: 'integer',
      example: 60,
    },
  },
} as const;

/**
 * Request ID header
 */
export const RequestIdHeader = {
  'X-Request-Id': {
    description: 'Unique request identifier for tracing',
    schema: {
      type: 'string',
      format: 'uuid',
      example: '550e8400-e29b-41d4-a716-446655440000',
    },
  },
} as const;
