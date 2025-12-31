/**
 * Queue message types and interfaces
 */

import { z } from 'zod';
import { MessageType } from '../db/schema/message-logs.js';

/**
 * Message job payload
 * Published to RabbitMQ queue for worker processing
 */
export const messageJobSchema = z.object({
  messageId: z.string().uuid(),
  userId: z.string().uuid(),
  messageType: z.enum([MessageType.BIRTHDAY, MessageType.ANNIVERSARY]),
  scheduledSendTime: z.string().datetime(),
  // Optional metadata
  retryCount: z.number().int().min(0).default(0),
  timestamp: z.number().int().positive(),
});

export type MessageJob = z.infer<typeof messageJobSchema>;

/**
 * Message handler function type
 */
export type MessageHandler = (_job: MessageJob) => Promise<void>;

/**
 * Queue statistics
 */
export interface QueueStats {
  messages: number;
  messagesReady: number;
  messagesUnacknowledged: number;
  consumers: number;
}

/**
 * Consumer options
 */
export interface ConsumerOptions {
  prefetch?: number;
  onMessage: MessageHandler;
  onError?: (_error: Error, _job?: MessageJob) => void | Promise<void>;
}
