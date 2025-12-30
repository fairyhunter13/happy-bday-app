/**
 * Message Rescheduling Service
 *
 * Handles rescheduling of messages when user timezone or dates change.
 * This service:
 * 1. Finds all future scheduled messages for a user
 * 2. Deletes old scheduled messages
 * 3. Recalculates send times with new timezone/dates
 * 4. Creates new message log entries
 *
 * Used by PUT /api/v1/users/:id endpoint when timezone, birthday, or anniversary changes.
 */

import { logger } from '../config/logger.js';
import { userRepository, type UserRepository } from '../repositories/user.repository.js';
import {
  messageLogRepository,
  type MessageLogRepository,
} from '../repositories/message-log.repository.js';
import { timezoneService, type TimezoneService } from './timezone.service.js';
import { idempotencyService, type IdempotencyService } from './idempotency.service.js';
import { MessageStatus } from '../db/schema/message-logs.js';
import type { CreateMessageLogDto } from '../types/dto.js';
import { DatabaseError, NotFoundError } from '../utils/errors.js';

/**
 * User update changes that require rescheduling
 */
export interface RescheduleChanges {
  timezone?: string;
  birthdayDate?: Date | null;
  anniversaryDate?: Date | null;
}

/**
 * Rescheduling result statistics
 */
export interface RescheduleResult {
  userId: string;
  deletedMessages: number;
  rescheduledMessages: number;
  errors: Array<{ messageType: string; error: string }>;
  success: boolean;
}

/**
 * MessageRescheduleService
 *
 * Service to handle message rescheduling when user data changes.
 *
 * @example
 * const service = new MessageRescheduleService();
 * const result = await service.rescheduleMessagesForUser(userId, {
 *   timezone: 'America/Los_Angeles'
 * });
 */
export class MessageRescheduleService {
  constructor(
    private readonly userRepo: UserRepository = userRepository,
    private readonly messageLogRepo: MessageLogRepository = messageLogRepository,
    private readonly timezoneService: TimezoneService = timezoneService,
    private readonly idempotencyService: IdempotencyService = idempotencyService
  ) {
    logger.debug('MessageRescheduleService initialized');
  }

  /**
   * Reschedule messages for a user after timezone or date changes
   *
   * @param userId - User ID
   * @param changes - Changes to user data (timezone, birthdayDate, anniversaryDate)
   * @returns Rescheduling result with statistics
   *
   * @throws {NotFoundError} If user not found
   * @throws {DatabaseError} If database operation fails
   */
  async rescheduleMessagesForUser(
    userId: string,
    changes: RescheduleChanges
  ): Promise<RescheduleResult> {
    logger.info(
      {
        userId,
        hasTimezoneChange: !!changes.timezone,
        hasBirthdayChange: changes.birthdayDate !== undefined,
        hasAnniversaryChange: changes.anniversaryDate !== undefined,
      },
      'Starting message rescheduling'
    );

    const result: RescheduleResult = {
      userId,
      deletedMessages: 0,
      rescheduledMessages: 0,
      errors: [],
      success: false,
    };

    try {
      // 1. Get user with updated data
      const user = await this.userRepo.findById(userId);

      if (!user) {
        throw new NotFoundError(`User with ID ${userId} not found`);
      }

      // 2. Find all future scheduled messages for this user
      const now = new Date();
      const futureMessages = await this.messageLogRepo.findAll({
        userId,
        status: MessageStatus.SCHEDULED,
        scheduledAfter: now,
      });

      logger.info(
        { userId, futureMessagesCount: futureMessages.length },
        'Found future scheduled messages'
      );

      if (futureMessages.length === 0) {
        logger.info({ userId }, 'No future messages to reschedule');
        result.success = true;
        return result;
      }

      // 3. Delete old scheduled messages
      for (const message of futureMessages) {
        try {
          await this.messageLogRepo.delete(message.id);
          result.deletedMessages++;

          logger.debug(
            { messageId: message.id, messageType: message.messageType },
            'Deleted old scheduled message'
          );
        } catch (error) {
          logger.error(
            {
              messageId: message.id,
              error: error instanceof Error ? error.message : String(error),
            },
            'Failed to delete old scheduled message'
          );

          result.errors.push({
            messageType: message.messageType,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }

      // 4. Recalculate and create new messages
      // Use updated timezone or existing timezone
      const timezone = changes.timezone || user.timezone;

      // Reschedule birthday messages if birthday date exists
      if (user.birthdayDate && changes.birthdayDate !== null) {
        const birthdayDate = changes.birthdayDate || user.birthdayDate;

        try {
          // Check if today is birthday in new timezone
          const isBirthdayToday = this.timezoneService.isBirthdayToday(birthdayDate, timezone);

          if (isBirthdayToday) {
            // Calculate new send time with updated timezone
            const sendTime = this.timezoneService.calculateSendTime(birthdayDate, timezone);

            // Only reschedule if send time is in the future
            if (sendTime > now) {
              await this.createRescheduledMessage(
                user.id,
                'BIRTHDAY',
                sendTime,
                timezone,
                `Hey ${user.firstName}, happy birthday!`
              );

              result.rescheduledMessages++;
            } else {
              logger.debug(
                { userId, sendTime, now },
                'Birthday send time in past, skipping reschedule'
              );
            }
          }
        } catch (error) {
          logger.error(
            {
              userId,
              error: error instanceof Error ? error.message : String(error),
            },
            'Failed to reschedule birthday message'
          );

          result.errors.push({
            messageType: 'BIRTHDAY',
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }

      // Reschedule anniversary messages if anniversary date exists
      if (user.anniversaryDate && changes.anniversaryDate !== null) {
        const anniversaryDate = changes.anniversaryDate || user.anniversaryDate;

        try {
          // Check if today is anniversary in new timezone
          const isAnniversaryToday = this.timezoneService.isBirthdayToday(
            anniversaryDate,
            timezone
          );

          if (isAnniversaryToday) {
            // Calculate new send time with updated timezone
            const sendTime = this.timezoneService.calculateSendTime(anniversaryDate, timezone);

            // Only reschedule if send time is in the future
            if (sendTime > now) {
              await this.createRescheduledMessage(
                user.id,
                'ANNIVERSARY',
                sendTime,
                timezone,
                `Hey ${user.firstName}, happy work anniversary!`
              );

              result.rescheduledMessages++;
            } else {
              logger.debug(
                { userId, sendTime, now },
                'Anniversary send time in past, skipping reschedule'
              );
            }
          }
        } catch (error) {
          logger.error(
            {
              userId,
              error: error instanceof Error ? error.message : String(error),
            },
            'Failed to reschedule anniversary message'
          );

          result.errors.push({
            messageType: 'ANNIVERSARY',
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }

      result.success = result.errors.length === 0;

      logger.info(
        {
          userId,
          deletedMessages: result.deletedMessages,
          rescheduledMessages: result.rescheduledMessages,
          errorCount: result.errors.length,
          success: result.success,
        },
        'Message rescheduling completed'
      );

      return result;
    } catch (error) {
      logger.error(
        {
          userId,
          error: error instanceof Error ? error.message : String(error),
        },
        'Message rescheduling failed'
      );

      throw new DatabaseError('Failed to reschedule messages', { userId, error });
    }
  }

  /**
   * Create a rescheduled message with new send time
   * @private
   */
  private async createRescheduledMessage(
    userId: string,
    messageType: 'BIRTHDAY' | 'ANNIVERSARY',
    sendTime: Date,
    timezone: string,
    messageContent: string
  ): Promise<void> {
    // Generate idempotency key
    const idempotencyKey = this.idempotencyService.generateKey(
      userId,
      messageType,
      sendTime,
      timezone
    );

    // Check if message already exists (shouldn't happen, but safety check)
    const existing = await this.messageLogRepo.checkIdempotency(idempotencyKey);

    if (existing) {
      logger.warn(
        { userId, messageType, idempotencyKey, existingId: existing.id },
        'Rescheduled message already exists, skipping'
      );
      return;
    }

    // Create new message log entry
    const messageData: CreateMessageLogDto = {
      userId,
      messageType,
      messageContent,
      scheduledSendTime: sendTime,
      idempotencyKey,
      status: MessageStatus.SCHEDULED,
      retryCount: 0,
    };

    await this.messageLogRepo.create(messageData);

    logger.info(
      {
        userId,
        messageType,
        scheduledSendTime: sendTime,
        timezone,
        idempotencyKey,
      },
      'Rescheduled message created successfully'
    );
  }

  /**
   * Delete all future scheduled messages for a user
   * Used when user is soft-deleted
   *
   * @param userId - User ID
   * @returns Number of messages deleted
   */
  async deleteFutureMessagesForUser(userId: string): Promise<number> {
    logger.info({ userId }, 'Deleting all future scheduled messages');

    try {
      const now = new Date();
      const futureMessages = await this.messageLogRepo.findAll({
        userId,
        status: MessageStatus.SCHEDULED,
        scheduledAfter: now,
      });

      let deleted = 0;

      for (const message of futureMessages) {
        try {
          await this.messageLogRepo.delete(message.id);
          deleted++;
        } catch (error) {
          logger.error(
            {
              messageId: message.id,
              error: error instanceof Error ? error.message : String(error),
            },
            'Failed to delete future message'
          );
        }
      }

      logger.info({ userId, deleted }, 'Future messages deleted');

      return deleted;
    } catch (error) {
      logger.error(
        {
          userId,
          error: error instanceof Error ? error.message : String(error),
        },
        'Failed to delete future messages'
      );

      throw new DatabaseError('Failed to delete future messages', { userId, error });
    }
  }

  /**
   * Get statistics about scheduled messages for a user
   *
   * @param userId - User ID
   * @returns Message statistics
   */
  async getMessageStats(userId: string): Promise<{
    totalScheduled: number;
    birthdayMessages: number;
    anniversaryMessages: number;
    nextScheduled: Date | null;
  }> {
    try {
      const now = new Date();
      const futureMessages = await this.messageLogRepo.findAll({
        userId,
        status: MessageStatus.SCHEDULED,
        scheduledAfter: now,
      });

      const birthdayMessages = futureMessages.filter((m) => m.messageType === 'BIRTHDAY').length;
      const anniversaryMessages = futureMessages.filter(
        (m) => m.messageType === 'ANNIVERSARY'
      ).length;

      const nextScheduled =
        futureMessages.length > 0
          ? futureMessages.sort(
              (a, b) => a.scheduledSendTime.getTime() - b.scheduledSendTime.getTime()
            )[0]!.scheduledSendTime
          : null;

      return {
        totalScheduled: futureMessages.length,
        birthdayMessages,
        anniversaryMessages,
        nextScheduled,
      };
    } catch (error) {
      logger.error(
        {
          userId,
          error: error instanceof Error ? error.message : String(error),
        },
        'Failed to get message stats'
      );

      throw new DatabaseError('Failed to get message stats', { userId, error });
    }
  }
}

// Export singleton instance
export const messageRescheduleService = new MessageRescheduleService();
