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
  }>('/internal/process-message', async (request, reply) => {
    const { userId, messageType, scheduledSendTime, messageContent, idempotencyKey } = request.body;

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
  });

  /**
   * GET /internal/health
   *
   * Internal health check endpoint with more detailed information than /health.
   * Provides system metrics and service status for monitoring.
   */
  fastify.get('/internal/health', async (_request, reply) => {
    return reply.send({
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      version: process.env.npm_package_version || 'unknown',
    });
  });
}
