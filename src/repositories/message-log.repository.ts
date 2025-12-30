/**
 * Message Log Repository
 *
 * Data access layer for Message Logs table with:
 * - Message creation with idempotency checks
 * - Status tracking (SCHEDULED → QUEUED → SENDING → SENT/FAILED)
 * - Time-based queries for scheduler
 * - Missed message detection
 * - Transaction support
 * - Comprehensive error handling
 */

import { eq, and, gte, lte, inArray, sql } from 'drizzle-orm';
import type { PgTransaction } from 'drizzle-orm/pg-core';
import type { PostgresJsQueryResultHKT } from 'drizzle-orm/postgres-js';
import type { ExtractTablesWithRelations } from 'drizzle-orm';
import { db, type DbType } from '../db/connection.js';
import * as schema from '../db/schema/index.js';
import {
  messageLogs,
  type MessageLog,
  type NewMessageLog,
  MessageStatus,
  type MessageStatusType,
} from '../db/schema/message-logs.js';
import type {
  CreateMessageLogDto,
  MarkAsSentDto,
  MarkAsFailedDto,
  MessageLogFiltersDto,
} from '../types/dto.js';
import { DatabaseError, NotFoundError, UniqueConstraintError } from '../utils/errors.js';

/**
 * Transaction type for atomic operations
 */
type TransactionType = PgTransaction<
  PostgresJsQueryResultHKT,
  typeof schema,
  ExtractTablesWithRelations<typeof schema>
>;

/**
 * Message Log Repository class
 * Handles all database operations for message logs
 */
export class MessageLogRepository {
  constructor(private readonly database: DbType = db) {}

  /**
   * Find message log by ID
   * @param id - Message log UUID
   * @param tx - Optional transaction
   * @returns Message log or null if not found
   * @throws DatabaseError on database failure
   */
  async findById(id: string, tx?: TransactionType): Promise<MessageLog | null> {
    try {
      const dbInstance = tx || this.database;
      const result = await dbInstance
        .select()
        .from(messageLogs)
        .where(eq(messageLogs.id, id))
        .limit(1);

      return result[0] ?? null;
    } catch (error) {
      throw new DatabaseError(`Failed to find message log by ID: ${id}`, { error, id });
    }
  }

  /**
   * Find all message logs for a user
   * @param userId - User UUID
   * @param tx - Optional transaction
   * @returns Array of message logs
   * @throws DatabaseError on database failure
   */
  async findByUserId(userId: string, tx?: TransactionType): Promise<MessageLog[]> {
    try {
      const dbInstance = tx || this.database;
      const result = await dbInstance
        .select()
        .from(messageLogs)
        .where(eq(messageLogs.userId, userId))
        .orderBy(sql`${messageLogs.scheduledSendTime} DESC`);

      return result;
    } catch (error) {
      throw new DatabaseError(`Failed to find message logs for user: ${userId}`, { error, userId });
    }
  }

  /**
   * Find scheduled messages in time range
   *
   * Used by scheduler to find messages that need to be enqueued
   *
   * @param startTime - Start of time range
   * @param endTime - End of time range
   * @param tx - Optional transaction
   * @returns Array of message logs
   * @throws DatabaseError on database failure
   */
  async findScheduled(startTime: Date, endTime: Date, tx?: TransactionType): Promise<MessageLog[]> {
    try {
      const dbInstance = tx || this.database;
      const result = await dbInstance
        .select()
        .from(messageLogs)
        .where(
          and(
            eq(messageLogs.status, MessageStatus.SCHEDULED),
            gte(messageLogs.scheduledSendTime, startTime),
            lte(messageLogs.scheduledSendTime, endTime)
          )
        )
        .orderBy(messageLogs.scheduledSendTime);

      return result;
    } catch (error) {
      throw new DatabaseError('Failed to find scheduled messages', { error, startTime, endTime });
    }
  }

  /**
   * Find missed messages that should have been sent
   *
   * Returns messages with:
   * - Status: SCHEDULED, QUEUED, or RETRYING
   * - Scheduled send time in the past (older than 5 minutes)
   *
   * Used for recovery/monitoring to detect stuck messages
   *
   * @param tx - Optional transaction
   * @returns Array of missed message logs
   * @throws DatabaseError on database failure
   */
  async findMissed(tx?: TransactionType): Promise<MessageLog[]> {
    try {
      const dbInstance = tx || this.database;
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);

      const result = await dbInstance
        .select()
        .from(messageLogs)
        .where(
          and(
            inArray(messageLogs.status, [
              MessageStatus.SCHEDULED,
              MessageStatus.QUEUED,
              MessageStatus.RETRYING,
            ]),
            lte(messageLogs.scheduledSendTime, fiveMinutesAgo)
          )
        )
        .orderBy(messageLogs.scheduledSendTime);

      return result;
    } catch (error) {
      throw new DatabaseError('Failed to find missed messages', { error });
    }
  }

  /**
   * Find message logs with filters
   * @param filters - Query filters
   * @param tx - Optional transaction
   * @returns Array of message logs
   * @throws DatabaseError on database failure
   */
  async findAll(filters?: MessageLogFiltersDto, tx?: TransactionType): Promise<MessageLog[]> {
    try {
      const dbInstance = tx || this.database;
      const conditions = [];

      if (filters?.userId) {
        conditions.push(eq(messageLogs.userId, filters.userId));
      }

      if (filters?.messageType) {
        conditions.push(eq(messageLogs.messageType, filters.messageType));
      }

      if (filters?.status) {
        conditions.push(eq(messageLogs.status, filters.status));
      }

      if (filters?.scheduledAfter) {
        conditions.push(gte(messageLogs.scheduledSendTime, filters.scheduledAfter));
      }

      if (filters?.scheduledBefore) {
        conditions.push(lte(messageLogs.scheduledSendTime, filters.scheduledBefore));
      }

      const query = dbInstance
        .select()
        .from(messageLogs)
        .where(conditions.length > 0 ? and(...conditions) : undefined)
        .orderBy(sql`${messageLogs.scheduledSendTime} DESC`)
        .limit(filters?.limit ?? 100)
        .offset(filters?.offset ?? 0);

      return await query;
    } catch (error) {
      throw new DatabaseError('Failed to find message logs', { error, filters });
    }
  }

  /**
   * Create message log
   * @param data - Message log creation data
   * @param tx - Optional transaction
   * @returns Created message log
   * @throws UniqueConstraintError if idempotency key already exists
   * @throws DatabaseError on database failure
   */
  async create(data: CreateMessageLogDto, tx?: TransactionType): Promise<MessageLog> {
    try {
      const dbInstance = tx || this.database;

      // Check idempotency key
      const existing = await this.checkIdempotency(data.idempotencyKey, tx);
      if (existing) {
        throw new UniqueConstraintError(
          `Message with idempotency key ${data.idempotencyKey} already exists`,
          { idempotencyKey: data.idempotencyKey, existingId: existing.id }
        );
      }

      const newMessageLog: NewMessageLog = {
        userId: data.userId,
        messageType: data.messageType,
        messageContent: data.messageContent,
        scheduledSendTime: data.scheduledSendTime,
        idempotencyKey: data.idempotencyKey,
        status: data.status ?? MessageStatus.SCHEDULED,
        retryCount: data.retryCount ?? 0,
      };

      const result = await dbInstance.insert(messageLogs).values(newMessageLog).returning();

      return result[0]!;
    } catch (error) {
      if (error instanceof UniqueConstraintError) {
        throw error;
      }

      // Check for PostgreSQL unique constraint violation (23505)
      if (error && typeof error === 'object' && 'code' in error && error.code === '23505') {
        throw new UniqueConstraintError(
          `Message with idempotency key ${data.idempotencyKey} already exists`,
          { error, idempotencyKey: data.idempotencyKey }
        );
      }

      throw new DatabaseError('Failed to create message log', { error, data });
    }
  }

  /**
   * Update message status
   * @param id - Message log UUID
   * @param status - New status
   * @param tx - Optional transaction
   * @returns Updated message log
   * @throws NotFoundError if message not found
   * @throws DatabaseError on database failure
   */
  async updateStatus(
    id: string,
    status: MessageStatusType,
    tx?: TransactionType
  ): Promise<MessageLog> {
    try {
      const dbInstance = tx || this.database;

      // Check if message exists
      const existing = await this.findById(id, tx);
      if (!existing) {
        throw new NotFoundError(`Message log with ID ${id} not found`, { id });
      }

      const result = await dbInstance
        .update(messageLogs)
        .set({
          status,
          updatedAt: new Date(),
        })
        .where(eq(messageLogs.id, id))
        .returning();

      return result[0]!;
    } catch (error) {
      if (error instanceof NotFoundError) {
        throw error;
      }

      throw new DatabaseError(`Failed to update message status: ${id}`, { error, id, status });
    }
  }

  /**
   * Mark message as sent
   *
   * Updates:
   * - status → SENT
   * - actualSendTime → now
   * - apiResponseCode
   * - apiResponseBody
   *
   * @param id - Message log UUID
   * @param response - API response data
   * @param tx - Optional transaction
   * @returns Updated message log
   * @throws NotFoundError if message not found
   * @throws DatabaseError on database failure
   */
  async markAsSent(id: string, response: MarkAsSentDto, tx?: TransactionType): Promise<MessageLog> {
    try {
      const dbInstance = tx || this.database;

      // Check if message exists
      const existing = await this.findById(id, tx);
      if (!existing) {
        throw new NotFoundError(`Message log with ID ${id} not found`, { id });
      }

      const result = await dbInstance
        .update(messageLogs)
        .set({
          status: MessageStatus.SENT,
          actualSendTime: new Date(),
          apiResponseCode: response.apiResponseCode,
          apiResponseBody: response.apiResponseBody,
          updatedAt: new Date(),
        })
        .where(eq(messageLogs.id, id))
        .returning();

      return result[0]!;
    } catch (error) {
      if (error instanceof NotFoundError) {
        throw error;
      }

      throw new DatabaseError(`Failed to mark message as sent: ${id}`, { error, id, response });
    }
  }

  /**
   * Mark message as failed
   *
   * Updates:
   * - status → FAILED or RETRYING (based on retry count)
   * - retryCount → increment
   * - lastRetryAt → now
   * - errorMessage
   * - apiResponseCode (optional)
   * - apiResponseBody (optional)
   *
   * @param id - Message log UUID
   * @param errorData - Error data
   * @param maxRetries - Maximum retry attempts (default: 3)
   * @param tx - Optional transaction
   * @returns Updated message log
   * @throws NotFoundError if message not found
   * @throws DatabaseError on database failure
   */
  async markAsFailed(
    id: string,
    errorData: MarkAsFailedDto,
    maxRetries: number = 3,
    tx?: TransactionType
  ): Promise<MessageLog> {
    try {
      const dbInstance = tx || this.database;

      // Check if message exists
      const existing = await this.findById(id, tx);
      if (!existing) {
        throw new NotFoundError(`Message log with ID ${id} not found`, { id });
      }

      const newRetryCount = existing.retryCount + 1;
      const status = newRetryCount >= maxRetries ? MessageStatus.FAILED : MessageStatus.RETRYING;

      const result = await dbInstance
        .update(messageLogs)
        .set({
          status,
          retryCount: newRetryCount,
          lastRetryAt: new Date(),
          errorMessage: errorData.errorMessage,
          apiResponseCode: errorData.apiResponseCode,
          apiResponseBody: errorData.apiResponseBody,
          updatedAt: new Date(),
        })
        .where(eq(messageLogs.id, id))
        .returning();

      return result[0]!;
    } catch (error) {
      if (error instanceof NotFoundError) {
        throw error;
      }

      throw new DatabaseError(`Failed to mark message as failed: ${id}`, { error, id, errorData });
    }
  }

  /**
   * Check if message with idempotency key exists
   *
   * @param key - Idempotency key
   * @param tx - Optional transaction
   * @returns Message log or null if not found
   * @throws DatabaseError on database failure
   */
  async checkIdempotency(key: string, tx?: TransactionType): Promise<MessageLog | null> {
    try {
      const dbInstance = tx || this.database;
      const result = await dbInstance
        .select()
        .from(messageLogs)
        .where(eq(messageLogs.idempotencyKey, key))
        .limit(1);

      return result[0] ?? null;
    } catch (error) {
      throw new DatabaseError(`Failed to check idempotency key: ${key}`, { error, key });
    }
  }

  /**
   * Execute a callback within a transaction
   *
   * Usage:
   * ```typescript
   * await messageLogRepo.transaction(async (tx) => {
   *   const message = await messageLogRepo.create(data, tx);
   *   await messageLogRepo.updateStatus(message.id, 'QUEUED', tx);
   *   return message;
   * });
   * ```
   *
   * @param callback - Transaction callback
   * @returns Result of callback
   * @throws DatabaseError on transaction failure
   */
  async transaction<T>(callback: (tx: TransactionType) => Promise<T>): Promise<T> {
    try {
      return await this.database.transaction(callback);
    } catch (error) {
      throw new DatabaseError('Transaction failed', { error });
    }
  }
}

// Export singleton instance
export const messageLogRepository = new MessageLogRepository();
