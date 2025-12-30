import Fastify, { type FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import { env } from './config/environment.js';
import { logger } from './config/logger.js';
import { healthRoutes } from './routes/health.routes.js';
import { ApplicationError } from './utils/errors.js';
import type { ErrorResponse } from './types/index.js';

/**
 * Create and configure Fastify application instance
 */
export async function createApp(): Promise<FastifyInstance> {
  const app = Fastify({
    logger: logger,
    trustProxy: true,
    requestIdLogLabel: 'requestId',
    disableRequestLogging: false,
    requestIdHeader: 'x-request-id',
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

  // Register rate limiting
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

  // Register Swagger documentation
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

  // Global error handler
  app.setErrorHandler(async (error, request, reply) => {
    const errorResponse: ErrorResponse = {
      error: {
        code: error instanceof ApplicationError ? error.code : 'INTERNAL_SERVER_ERROR',
        message: error.message,
        details: error instanceof ApplicationError ? error.details : undefined,
      },
      timestamp: new Date().toISOString(),
      path: request.url,
    };

    const statusCode = error instanceof ApplicationError ? error.statusCode : 500;

    request.log.error(
      {
        error: error.message,
        stack: error.stack,
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

  // Register user routes
  const { userRoutes } = await import('./routes/user.routes.js');
  await app.register(userRoutes, { prefix: '/api/v1' });

  return app;
}

/**
 * Start the Fastify server
 */
export async function startServer(): Promise<FastifyInstance> {
  const app = await createApp();

  try {
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
      },
      'Server started successfully'
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
