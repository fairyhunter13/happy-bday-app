import type { FastifyInstance } from 'fastify';
import { messageLogRepository } from '../repositories/message-log.repository.js';
import { MessageStatus, type MessageType } from '../db/schema/message-logs.js';

/**
 * Internal Routes
 *
 * These routes are for internal system use (e.g., performance testing, health checks).
 * They bypass normal authentication and should be blocked from external access via nginx.
 *
 * WARNING: These endpoints should NEVER be exposed to the public internet.
 * They are designed for load testing and internal system operations only.
 */
export async function internalRoutes(fastify: FastifyInstance) {
  /**
   * POST /internal/process-message
   *
   * Internal endpoint for performance testing that bypasses normal authentication.
   * Used by k6 load tests to directly schedule messages for testing throughput.
   *
   * This endpoint is blocked from external access via nginx configuration.
   * Access is only allowed from:
   * - Docker internal networks (172.16.0.0/12, 10.0.0.0/8)
   * - Local development (127.0.0.1)
   * - Load testing containers (k6)
   */
  fastify.post<{
    Body: {
      userId: string;
      messageType: typeof MessageType.BIRTHDAY | typeof MessageType.ANNIVERSARY;
      scheduledSendTime: string;
      messageContent: string;
      idempotencyKey: string;
    };
  }>(
    '/internal/process-message',
    {
      schema: {
        summary: 'Process message for performance testing',
        description:
          'Internal endpoint for load testing that bypasses authentication. Creates message logs directly for throughput testing. Blocked from external access via nginx.',
        tags: ['internal'],
        body: {
          type: 'object',
          required: [
            'userId',
            'messageType',
            'scheduledSendTime',
            'messageContent',
            'idempotencyKey',
          ],
          properties: {
            userId: { type: 'string', format: 'uuid' },
            messageType: { type: 'string', enum: ['BIRTHDAY', 'ANNIVERSARY'] },
            scheduledSendTime: { type: 'string', format: 'date-time' },
            messageContent: { type: 'string' },
            idempotencyKey: { type: 'string' },
          },
        },
        response: {
          201: {
            description: 'Message created successfully',
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              messageId: { type: 'string', format: 'uuid' },
              userId: { type: 'string', format: 'uuid' },
              messageType: { type: 'string' },
              scheduledSendTime: { type: 'string' },
              status: { type: 'string' },
            },
          },
          400: {
            description: 'Missing required fields',
            type: 'object',
            properties: {
              error: { type: 'string' },
              required: { type: 'array', items: { type: 'string' } },
            },
          },
          409: {
            description: 'Idempotency key conflict',
            type: 'object',
            properties: {
              error: { type: 'string' },
              idempotencyKey: { type: 'string' },
            },
          },
          500: {
            description: 'Internal server error',
            type: 'object',
            properties: {
              error: { type: 'string' },
              message: { type: 'string' },
            },
          },
        },
      },
    },
    async (request, reply) => {
      const { userId, messageType, scheduledSendTime, messageContent, idempotencyKey } =
        request.body;

      // Validate required fields
      if (!userId || !messageType || !scheduledSendTime || !messageContent || !idempotencyKey) {
        return reply.status(400).send({
          error: 'Missing required fields',
          required: [
            'userId',
            'messageType',
            'scheduledSendTime',
            'messageContent',
            'idempotencyKey',
          ],
        });
      }

      try {
        // Create message log entry directly for performance testing
        const messageLog = await messageLogRepository.create({
          userId,
          messageType,
          messageContent,
          scheduledSendTime: new Date(scheduledSendTime),
          status: MessageStatus.SCHEDULED,
          retryCount: 0,
          idempotencyKey,
        });

        return reply.status(201).send({
          success: true,
          messageId: messageLog.id,
          userId,
          messageType,
          scheduledSendTime,
          status: messageLog.status,
        });
      } catch (error) {
        fastify.log.error(
          { error, userId, messageType, idempotencyKey },
          'Failed to process internal message'
        );

        // Check if it's an idempotency error
        if (error instanceof Error && error.message.includes('already exists')) {
          return reply.status(409).send({
            error: 'Message with this idempotency key already exists',
            idempotencyKey,
          });
        }

        return reply.status(500).send({
          error: 'Failed to process message',
          message: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }
  );

  /**
   * GET /internal/health
   *
   * Internal health check endpoint with more detailed information than /health.
   * Provides system metrics and service status for monitoring.
   */
  fastify.get(
    '/internal/health',
    {
      schema: {
        summary: 'Internal health check with detailed metrics',
        description:
          'Provides detailed system health information including uptime, memory usage, and version. For internal monitoring and debugging.',
        tags: ['internal'],
        response: {
          200: {
            description: 'System health information',
            type: 'object',
            properties: {
              status: { type: 'string' },
              timestamp: { type: 'string', format: 'date-time' },
              uptime: { type: 'number' },
              memory: {
                type: 'object',
                properties: {
                  rss: { type: 'number' },
                  heapTotal: { type: 'number' },
                  heapUsed: { type: 'number' },
                  external: { type: 'number' },
                  arrayBuffers: { type: 'number' },
                },
              },
              version: { type: 'string' },
            },
          },
        },
      },
    },
    async (_request, reply) => {
      return reply.send({
        status: 'ok',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        version: process.env.npm_package_version || 'unknown',
      });
    }
  );
}
