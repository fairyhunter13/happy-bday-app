/**
 * Error Response Schemas
 *
 * RFC 9457 Problem Details for HTTP APIs compliant error schemas.
 * Reference: https://www.rfc-editor.org/rfc/rfc9457.html
 */

/**
 * Base error response schema (RFC 9457 compatible)
 */
export const ErrorResponseSchema = {
  type: 'object',
  required: ['error', 'timestamp', 'path'],
  properties: {
    error: {
      type: 'object',
      required: ['code', 'message'],
      properties: {
        code: {
          type: 'string',
          description: 'Machine-readable error code',
          example: 'VALIDATION_ERROR',
        },
        message: {
          type: 'string',
          description: 'Human-readable error message',
          example: 'The request contains invalid data',
        },
        details: {
          type: 'object',
          description: 'Additional error details',
          nullable: true,
        },
      },
    },
    timestamp: {
      type: 'string',
      format: 'date-time',
      description: 'ISO 8601 timestamp when error occurred',
      example: '2025-12-30T10:30:00.000Z',
    },
    path: {
      type: 'string',
      description: 'Request path that caused the error',
      example: '/api/v1/users',
    },
  },
} as const;

/**
 * 400 Bad Request - Validation Error
 */
export const BadRequestSchema = {
  ...ErrorResponseSchema,
  description: 'Bad Request - Invalid input data',
  example: {
    error: {
      code: 'VALIDATION_ERROR',
      message: 'Invalid request data',
      details: {
        fields: {
          email: 'Invalid email format',
          timezone: 'Invalid IANA timezone format (e.g., "America/New_York")',
        },
      },
    },
    timestamp: '2025-12-30T10:30:00.000Z',
    path: '/api/v1/users',
  },
} as const;

/**
 * 404 Not Found Error
 */
export const NotFoundSchema = {
  ...ErrorResponseSchema,
  description: 'Not Found - Resource does not exist',
  example: {
    error: {
      code: 'NOT_FOUND',
      message: 'User not found',
    },
    timestamp: '2025-12-30T10:30:00.000Z',
    path: '/api/v1/users/550e8400-e29b-41d4-a716-446655440000',
  },
} as const;

/**
 * 409 Conflict Error
 */
export const ConflictSchema = {
  ...ErrorResponseSchema,
  description: 'Conflict - Resource already exists or state conflict',
  example: {
    error: {
      code: 'EMAIL_ALREADY_EXISTS',
      message: 'A user with this email already exists',
      details: {
        email: 'user@example.com',
        conflictingResource: 'user',
      },
    },
    timestamp: '2025-12-30T10:30:00.000Z',
    path: '/api/v1/users',
  },
} as const;

/**
 * 429 Too Many Requests - Rate Limit Exceeded
 */
export const RateLimitSchema = {
  ...ErrorResponseSchema,
  description: 'Too Many Requests - Rate limit exceeded',
  example: {
    error: {
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'Rate limit exceeded, retry in 60 seconds',
    },
    timestamp: '2025-12-30T10:30:00.000Z',
    path: '/api/v1/users',
  },
} as const;

/**
 * 500 Internal Server Error
 */
export const InternalServerErrorSchema = {
  ...ErrorResponseSchema,
  description: 'Internal Server Error - Unexpected server error',
  example: {
    error: {
      code: 'INTERNAL_SERVER_ERROR',
      message: 'An unexpected error occurred',
    },
    timestamp: '2025-12-30T10:30:00.000Z',
    path: '/api/v1/users',
  },
} as const;

/**
 * 503 Service Unavailable
 */
export const ServiceUnavailableSchema = {
  ...ErrorResponseSchema,
  description: 'Service Unavailable - Service is temporarily unavailable',
  example: {
    error: {
      code: 'SERVICE_UNAVAILABLE',
      message: 'Database connection unavailable',
      details: {
        service: 'database',
        status: 'unhealthy',
      },
    },
    timestamp: '2025-12-30T10:30:00.000Z',
    path: '/health',
  },
} as const;

/**
 * Standard error responses for endpoints
 */
export const StandardErrorResponses = {
  400: {
    description: 'Bad Request - Invalid input data',
    content: {
      'application/json': {
        schema: BadRequestSchema,
      },
    },
  },
  404: {
    description: 'Not Found - Resource does not exist',
    content: {
      'application/json': {
        schema: NotFoundSchema,
      },
    },
  },
  429: {
    description: 'Too Many Requests - Rate limit exceeded',
    content: {
      'application/json': {
        schema: RateLimitSchema,
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
} as const;
