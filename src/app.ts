import Fastify, { type FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import compress from '@fastify/compress';
import fastifyStatic from '@fastify/static';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import path from 'path';
import { fileURLToPath } from 'url';
import { constants } from 'zlib';
import { env } from './config/environment.js';
import { logger } from './config/logger.js';
import { healthRoutes } from './routes/health.routes.js';
import { metricsRoutes } from './routes/metrics.routes.js';
import { metricsMiddleware } from './middleware/metrics.middleware.js';
import { ApplicationError } from './utils/errors.js';
import type { ErrorResponse } from './types/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Create and configure Fastify application instance
 */
export async function createApp(): Promise<FastifyInstance> {
  // Fastify v5 uses loggerInstance for external pino loggers
  const loggerConfig = env.NODE_ENV === 'test' ? { logger: false } : { loggerInstance: logger };

  const app = Fastify({
    ...loggerConfig,
    trustProxy: true,
    requestIdLogLabel: 'requestId',
    disableRequestLogging: false,
    requestIdHeader: 'x-request-id',
    ajv: {
      customOptions: {
        // Disable strict mode to allow OpenAPI-specific keywords like 'example'
        strict: false,
      },
    },
  });

  // Register security plugins
  await app.register(helmet, {
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        scriptSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", 'data:', 'https:'],
      },
    },
  });

  // Register CORS
  await app.register(cors, {
    origin: env.NODE_ENV === 'production' ? false : true,
    credentials: true,
  });

  // Register rate limiting (conditionally enabled via RATE_LIMIT_ENABLED env var)
  // For performance testing, set RATE_LIMIT_ENABLED=false to disable rate limiting entirely
  logger.info(
    {
      RATE_LIMIT_ENABLED: env.RATE_LIMIT_ENABLED,
      RATE_LIMIT_ENABLED_TYPE: typeof env.RATE_LIMIT_ENABLED,
      RATE_LIMIT_ENABLED_RAW: process.env.RATE_LIMIT_ENABLED,
      willRegister: env.RATE_LIMIT_ENABLED === true,
    },
    'Rate limiting configuration check'
  );

  if (env.RATE_LIMIT_ENABLED === true) {
    await app.register(rateLimit, {
      max: env.RATE_LIMIT_MAX_REQUESTS,
      timeWindow: env.RATE_LIMIT_WINDOW_MS,
      errorResponseBuilder: (_request, context) => {
        return {
          error: {
            code: 'RATE_LIMIT_EXCEEDED',
            message: `Rate limit exceeded, retry in ${context.after}`,
          },
          timestamp: new Date().toISOString(),
        };
      },
    });
    logger.info(
      {
        enabled: true,
        maxRequests: env.RATE_LIMIT_MAX_REQUESTS,
        windowMs: env.RATE_LIMIT_WINDOW_MS,
      },
      'Rate limiting ENABLED'
    );
  } else {
    logger.warn(
      {
        RATE_LIMIT_ENABLED: env.RATE_LIMIT_ENABLED,
        reason: 'RATE_LIMIT_ENABLED is not true',
      },
      'Rate limiting is DISABLED - use only in performance testing environments'
    );
  }

  // Register response compression (gzip/brotli)
  // Performance optimization: 70-80% smaller responses
  await app.register(compress, {
    global: true,
    threshold: 1024, // Compress responses > 1KB
    encodings: ['gzip', 'deflate', 'br'], // Support gzip, deflate, and brotli
    brotliOptions: {
      params: {
        [constants.BROTLI_PARAM_MODE]: constants.BROTLI_MODE_TEXT,
        [constants.BROTLI_PARAM_QUALITY]: 4, // Balance between compression and speed
      },
    },
    zlibOptions: {
      level: 6, // Default compression level (balance speed/size)
    },
  });

  // Register Swagger documentation (OpenAPI 3.1)
  await app.register(swagger, {
    openapi: {
      openapi: '3.1.0',
      info: {
        title: 'Birthday Message Scheduler API',
        description: `# Birthday Message Scheduler API

Timezone-aware birthday and anniversary message scheduler with exactly-once delivery guarantees.

## Features

- **Timezone-aware scheduling** - Uses IANA timezone identifiers for accurate local time delivery
- **Multiple message types** - Support for birthday and anniversary messages
- **Exactly-once delivery** - Idempotent message handling prevents duplicates
- **Soft delete support** - Email reuse after user deletion
- **Comprehensive health checks** - Kubernetes-ready liveness and readiness probes
- **Prometheus metrics** - Production-ready observability and monitoring
- **Rate limiting** - Configurable rate limits per endpoint

## Message Scheduling

Messages are scheduled to be sent at **9:00 AM local time** based on the user's timezone:
- Birthday messages: Sent on the anniversary of the birth date
- Anniversary messages: Sent on the anniversary date

## Rate Limiting

Different rate limits apply to different endpoint categories:

| Endpoint Category | Rate Limit |
|------------------|------------|
| User Create (POST) | 10 requests/minute |
| User Update (PUT) | 20 requests/minute |
| User Read (GET) | 100 requests/minute |
| User Delete (DELETE) | 10 requests/minute |
| Health Checks | Unlimited |
| Metrics | Unlimited |

## Error Handling

All error responses follow [RFC 9457 Problem Details for HTTP APIs](https://www.rfc-editor.org/rfc/rfc9457.html) standard.

## External Dependencies

- **Vendor Email Service**: See [Email Service Integration](https://github.com/fairyhunter13/happy-bday-app/blob/main/docs/vendor-specs/EMAIL_SERVICE_INTEGRATION.md)`,
        version: '1.0.0',
        contact: {
          name: 'API Support Team',
          email: 'support@birthday-scheduler.example.com',
          url: 'https://github.com/fairyhunter13/happy-bday-app',
        },
        license: {
          name: 'MIT',
          url: 'https://opensource.org/licenses/MIT',
        },
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
          description: 'Production environment',
        },
      ],
      tags: [
        {
          name: 'users',
          description:
            'User management operations - Create, read, update, and delete users with birthday/anniversary tracking',
        },
        {
          name: 'health',
          description:
            'Health check endpoints for monitoring, orchestration, and Kubernetes probes',
        },
        {
          name: 'Metrics',
          description: 'Prometheus metrics endpoints for observability and monitoring',
        },
        {
          name: 'internal',
          description:
            'Internal endpoints for system operations and performance testing - blocked from external access via nginx',
        },
      ],
      externalDocs: {
        description: 'Full API Documentation and Integration Guides',
        url: 'https://github.com/fairyhunter13/happy-bday-app/blob/main/docs/API.md',
      },
    },
  });

  // Register static file server for custom Swagger UI CSS
  await app.register(fastifyStatic, {
    root: path.join(__dirname, '..', 'public'),
    prefix: '/public/',
  });

  await app.register(swaggerUi, {
    routePrefix: '/docs',
    uiConfig: {
      docExpansion: 'list',
      deepLinking: true,
      displayOperationId: true,
      defaultModelsExpandDepth: 3,
      defaultModelExpandDepth: 3,
      displayRequestDuration: true,
      filter: true,
      showExtensions: true,
      showCommonExtensions: true,
      tryItOutEnabled: true,
    },
    theme: {
      title: 'Birthday Message Scheduler API Documentation',
      css: [
        {
          filename: 'swagger-ui-custom.css',
          content:
            'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap',
        },
      ],
    },
    staticCSP: true,
    transformStaticCSP: (header) => header,
    uiHooks: {
      onRequest(_request, _reply, next) {
        next();
      },
      preHandler(_request, _reply, next) {
        next();
      },
    },
  });

  // Register metrics middleware (for HTTP request tracking)
  app.addHook('onRequest', metricsMiddleware);

  // Global error handler
  app.setErrorHandler(async (error, request, reply) => {
    const err = error as Error & { validation?: unknown; statusCode?: number };

    // Handle Fastify validation errors (from Ajv schema validation)
    if (err.validation) {
      const errorResponse: ErrorResponse = {
        error: {
          code: 'VALIDATION_ERROR',
          message: err.message,
          details: err.validation,
        },
        timestamp: new Date().toISOString(),
        path: request.url,
      };

      request.log.warn(
        {
          error: err.message,
          validation: err.validation,
          code: 'VALIDATION_ERROR',
        },
        'Validation error occurred'
      );

      await reply.status(400).send(errorResponse);
      return;
    }

    const errorResponse: ErrorResponse = {
      error: {
        code: error instanceof ApplicationError ? error.code : 'INTERNAL_SERVER_ERROR',
        message: err.message,
        details: error instanceof ApplicationError ? error.details : undefined,
      },
      timestamp: new Date().toISOString(),
      path: request.url,
    };

    const statusCode = error instanceof ApplicationError ? error.statusCode : err.statusCode || 500;

    request.log.error(
      {
        error: err.message,
        stack: err.stack,
        code: errorResponse.error.code,
      },
      'Request error occurred'
    );

    await reply.status(statusCode).send(errorResponse);
  });

  // Not found handler
  app.setNotFoundHandler(async (request, reply) => {
    const errorResponse: ErrorResponse = {
      error: {
        code: 'NOT_FOUND',
        message: `Route ${request.method}:${request.url} not found`,
      },
      timestamp: new Date().toISOString(),
      path: request.url,
    };

    await reply.status(404).send(errorResponse);
  });

  // Register routes
  await app.register(healthRoutes);

  // Register metrics routes (no rate limiting for Prometheus scraping)
  await app.register(metricsRoutes);

  // Register user routes
  const { userRoutes } = await import('./routes/user.routes.js');
  await app.register(userRoutes, { prefix: '/api/v1' });

  // Register internal routes (for performance testing and system operations)
  // These routes are blocked from external access via nginx configuration
  const { internalRoutes } = await import('./routes/internal.routes.js');
  await app.register(internalRoutes);

  // Type assertion needed because Fastify v5 loggerInstance creates a more specific type
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return app as any as FastifyInstance;
}

/**
 * Start the Fastify server
 */
export async function startServer(): Promise<FastifyInstance> {
  logger.info('Creating Fastify application...');
  const app = await createApp();
  logger.info('Fastify application created');

  try {
    logger.info(
      {
        port: env.PORT,
        host: env.HOST,
      },
      'Starting server...'
    );

    await app.listen({
      port: env.PORT,
      host: env.HOST,
    });

    logger.info(
      {
        port: env.PORT,
        host: env.HOST,
        env: env.NODE_ENV,
        docs: `http://${env.HOST}:${env.PORT}/docs`,
        health: `http://${env.HOST}:${env.PORT}/health`,
      },
      'Server started successfully and ready to accept connections'
    );

    return app;
  } catch (error) {
    logger.error(error, 'Failed to start server');
    throw error;
  }
}

/**
 * Graceful shutdown handler
 */
export async function shutdownServer(app: FastifyInstance): Promise<void> {
  logger.info('Shutting down server gracefully...');

  try {
    await app.close();
    logger.info('Server shut down successfully');
  } catch (error) {
    logger.error(error, 'Error during shutdown');
    throw error;
  }
}
