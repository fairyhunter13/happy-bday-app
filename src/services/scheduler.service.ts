import { DateTime } from 'luxon';
import { timezoneService, TimezoneService } from './timezone.service.js';
import { idempotencyService, IdempotencyService } from './idempotency.service.js';
import { userRepository, UserRepository } from '../repositories/user.repository.js';
import { messageLogRepository, MessageLogRepository } from '../repositories/message-log.repository.js';
import { MessageStatus, MessageType } from '../db/schema/message-logs.js';
import type { User } from '../db/schema/users.js';
import type { CreateMessageLogDto } from '../types/dto.js';
import { logger } from '../config/logger.js';
import { DatabaseError } from '../utils/errors.js';

/**
 * Message schedule information
 */
export interface ScheduledMessage {
  userId: string;
  messageType: string;
  scheduledSendTime: Date;
  idempotencyKey: string;
  messageContent: string;
}

/**
 * Recovery statistics
 */
export interface RecoveryStats {
  totalMissed: number;
  recovered: number;
  failed: number;
  errors: Array<{ messageId: string; error: string }>;
}

/**
 * Daily precalculation statistics
 */
export interface PrecalculationStats {
  totalBirthdays: number;
  totalAnniversaries: number;
  messagesScheduled: number;
  duplicatesSkipped: number;
  errors: Array<{ userId: string; error: string }>;
}

/**
 * SchedulerService
 *
 * Orchestrates the scheduling and enqueueing of birthday/anniversary messages.
 *
 * Job responsibilities:
 * 1. Daily job (00:00 UTC): Pre-calculate all birthdays for the day across all timezones
 * 2. Minute job: Enqueue messages scheduled in the next hour
 * 3. Recovery job: Find and retry missed messages
 *
 * Design patterns:
 * - Strategy Pattern: Different message types (birthday, anniversary)
 * - Repository Pattern: Data access abstraction
 * - Service Layer Pattern: Business logic separation
 *
 * @example
 * const scheduler = new SchedulerService();
 * await scheduler.preCalculateTodaysBirthdays();
 * await scheduler.enqueueUpcomingMessages();
 */
export class SchedulerService {
  constructor(
    private readonly timezoneService: TimezoneService = timezoneService,
    private readonly idempotencyService: IdempotencyService = idempotencyService,
    private readonly userRepo: UserRepository = userRepository,
    private readonly messageLogRepo: MessageLogRepository = messageLogRepository
  ) {
    logger.info('SchedulerService initialized');
  }

  /**
   * Daily job: Pre-calculate all birthdays/anniversaries for today
   *
   * Runs at 00:00 UTC daily
   * - Finds all users with birthdays today (in their local timezone)
   * - Calculates 9am local time -> UTC send time
   * - Creates message log entries with SCHEDULED status
   * - Uses idempotency keys to prevent duplicates
   *
   * @returns Statistics about messages scheduled
   */
  async preCalculateTodaysBirthdays(): Promise<PrecalculationStats> {
    logger.info('Starting daily birthday precalculation');

    const stats: PrecalculationStats = {
      totalBirthdays: 0,
      totalAnniversaries: 0,
      messagesScheduled: 0,
      duplicatesSkipped: 0,
      errors: [],
    };

    try {
      // Process birthdays
      const birthdayStats = await this.processMessagesForType('BIRTHDAY');
      stats.totalBirthdays = birthdayStats.total;
      stats.messagesScheduled += birthdayStats.scheduled;
      stats.duplicatesSkipped += birthdayStats.duplicates;
      stats.errors.push(...birthdayStats.errors);

      // Process anniversaries
      const anniversaryStats = await this.processMessagesForType('ANNIVERSARY');
      stats.totalAnniversaries = anniversaryStats.total;
      stats.messagesScheduled += anniversaryStats.scheduled;
      stats.duplicatesSkipped += anniversaryStats.duplicates;
      stats.errors.push(...anniversaryStats.errors);

      logger.info(
        {
          totalBirthdays: stats.totalBirthdays,
          totalAnniversaries: stats.totalAnniversaries,
          messagesScheduled: stats.messagesScheduled,
          duplicatesSkipped: stats.duplicatesSkipped,
          errorCount: stats.errors.length,
        },
        'Daily birthday precalculation completed'
      );

      return stats;
    } catch (error) {
      logger.error(
        { error: error instanceof Error ? error.message : String(error) },
        'Failed to complete daily precalculation'
      );
      throw error;
    }
  }

  /**
   * Process messages for a specific type (BIRTHDAY or ANNIVERSARY)
   *
   * @private
   */
  private async processMessagesForType(messageType: 'BIRTHDAY' | 'ANNIVERSARY'): Promise<{
    total: number;
    scheduled: number;
    duplicates: number;
    errors: Array<{ userId: string; error: string }>;
  }> {
    const stats = {
      total: 0,
      scheduled: 0,
      duplicates: 0,
      errors: [] as Array<{ userId: string; error: string }>,
    };

    // Find all users with birthdays/anniversaries today
    const users =
      messageType === 'BIRTHDAY'
        ? await this.userRepo.findBirthdaysToday()
        : await this.userRepo.findAnniversariesToday();

    stats.total = users.length;

    logger.info(
      { messageType, count: users.length },
      `Found users with ${messageType.toLowerCase()}s today`
    );

    // Process each user
    for (const user of users) {
      try {
        // Verify it's actually their birthday in their timezone
        const relevantDate = messageType === 'BIRTHDAY' ? user.birthdayDate : user.anniversaryDate;

        if (!relevantDate) {
          logger.warn(
            { userId: user.id, messageType },
            `User has no ${messageType.toLowerCase()} date, skipping`
          );
          continue;
        }

        const isBirthday = this.timezoneService.isBirthdayToday(relevantDate, user.timezone);

        if (!isBirthday) {
          logger.debug(
            { userId: user.id, timezone: user.timezone },
            `Not ${messageType.toLowerCase()} in user's timezone, skipping`
          );
          continue;
        }

        // Calculate send time (9am local time -> UTC)
        const sendTime = this.timezoneService.calculateSendTime(relevantDate, user.timezone);

        // Generate idempotency key
        const idempotencyKey = this.idempotencyService.generateKey(
          user.id,
          messageType,
          sendTime,
          user.timezone
        );

        // Check if message already exists
        const existing = await this.messageLogRepo.checkIdempotency(idempotencyKey);

        if (existing) {
          logger.debug(
            { userId: user.id, idempotencyKey, existingId: existing.id },
            'Message already scheduled, skipping (idempotency)'
          );
          stats.duplicates++;
          continue;
        }

        // Create message content
        const messageContent = this.composeMessage(user, messageType);

        // Create message log entry
        const messageData: CreateMessageLogDto = {
          userId: user.id,
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
            userId: user.id,
            messageType,
            scheduledSendTime: sendTime,
            timezone: user.timezone,
            idempotencyKey,
          },
          'Message scheduled successfully'
        );

        stats.scheduled++;
      } catch (error) {
        logger.error(
          {
            userId: user.id,
            messageType,
            error: error instanceof Error ? error.message : String(error),
          },
          'Failed to schedule message for user'
        );

        stats.errors.push({
          userId: user.id,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    return stats;
  }

  /**
   * Minute job: Enqueue messages scheduled in the next hour
   *
   * Runs every minute
   * - Finds SCHEDULED messages in next hour
   * - Updates status to QUEUED
   * - Messages are then picked up by workers from RabbitMQ
   *
   * @returns Number of messages enqueued
   */
  async enqueueUpcomingMessages(): Promise<number> {
    logger.debug('Checking for upcoming messages to enqueue');

    try {
      const now = new Date();
      const oneHourFromNow = new Date(now.getTime() + 60 * 60 * 1000);

      // Find scheduled messages in next hour
      const messages = await this.messageLogRepo.findScheduled(now, oneHourFromNow);

      logger.info(
        { count: messages.length, startTime: now, endTime: oneHourFromNow },
        'Found scheduled messages to enqueue'
      );

      let enqueued = 0;

      for (const message of messages) {
        try {
          // Update status to QUEUED
          await this.messageLogRepo.updateStatus(message.id, MessageStatus.QUEUED);

          logger.info(
            {
              messageId: message.id,
              userId: message.userId,
              messageType: message.messageType,
              scheduledSendTime: message.scheduledSendTime,
            },
            'Message enqueued successfully'
          );

          enqueued++;

          // Note: In production, this would also publish to RabbitMQ
          // For now, we just update the status
        } catch (error) {
          logger.error(
            {
              messageId: message.id,
              error: error instanceof Error ? error.message : String(error),
            },
            'Failed to enqueue message'
          );
        }
      }

      logger.info({ enqueued }, 'Message enqueueing completed');

      return enqueued;
    } catch (error) {
      logger.error(
        { error: error instanceof Error ? error.message : String(error) },
        'Failed to enqueue upcoming messages'
      );
      throw new DatabaseError('Failed to enqueue messages', { error });
    }
  }

  /**
   * Recovery job: Find and retry missed messages
   *
   * Runs every 10 minutes
   * - Finds messages that should have been sent but weren't
   * - Retries failed messages (up to max retries)
   * - Logs errors for manual investigation
   *
   * @returns Recovery statistics
   */
  async recoverMissedMessages(): Promise<RecoveryStats> {
    logger.info('Starting missed message recovery');

    const stats: RecoveryStats = {
      totalMissed: 0,
      recovered: 0,
      failed: 0,
      errors: [],
    };

    try {
      // Find missed messages
      const missedMessages = await this.messageLogRepo.findMissed();

      stats.totalMissed = missedMessages.length;

      logger.info(
        { count: missedMessages.length },
        'Found missed messages for recovery'
      );

      for (const message of missedMessages) {
        try {
          // Check retry count
          const maxRetries = 3;

          if (message.retryCount >= maxRetries) {
            logger.error(
              {
                messageId: message.id,
                userId: message.userId,
                retryCount: message.retryCount,
              },
              'Message exceeded max retries, marking as failed'
            );

            await this.messageLogRepo.updateStatus(message.id, MessageStatus.FAILED);
            stats.failed++;
            continue;
          }

          // Reset to SCHEDULED for retry
          await this.messageLogRepo.updateStatus(message.id, MessageStatus.SCHEDULED);

          logger.info(
            {
              messageId: message.id,
              userId: message.userId,
              retryCount: message.retryCount,
            },
            'Message recovered and rescheduled'
          );

          stats.recovered++;
        } catch (error) {
          logger.error(
            {
              messageId: message.id,
              error: error instanceof Error ? error.message : String(error),
            },
            'Failed to recover message'
          );

          stats.errors.push({
            messageId: message.id,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }

      logger.info(
        {
          totalMissed: stats.totalMissed,
          recovered: stats.recovered,
          failed: stats.failed,
          errorCount: stats.errors.length,
        },
        'Missed message recovery completed'
      );

      return stats;
    } catch (error) {
      logger.error(
        { error: error instanceof Error ? error.message : String(error) },
        'Failed to recover missed messages'
      );
      throw new DatabaseError('Failed to recover messages', { error });
    }
  }

  /**
   * Compose message content based on type
   *
   * @private
   */
  private composeMessage(user: User, messageType: string): string {
    if (messageType === 'BIRTHDAY') {
      return `Hey ${user.firstName}, happy birthday!`;
    } else if (messageType === 'ANNIVERSARY') {
      return `Hey ${user.firstName}, happy work anniversary!`;
    } else {
      return `Hey ${user.firstName}, happy ${messageType.toLowerCase()}!`;
    }
  }

  /**
   * Get scheduler statistics
   *
   * @returns Current scheduler statistics
   */
  async getSchedulerStats(): Promise<{
    scheduledCount: number;
    queuedCount: number;
    sentCount: number;
    failedCount: number;
    nextScheduled: Date | null;
  }> {
    try {
      const now = new Date();
      const endOfDay = DateTime.now().endOf('day').toJSDate();

      // Count by status
      const scheduled = await this.messageLogRepo.findAll({
        status: MessageStatus.SCHEDULED,
        scheduledAfter: now,
        scheduledBefore: endOfDay,
      });

      const queued = await this.messageLogRepo.findAll({
        status: MessageStatus.QUEUED,
      });

      const sent = await this.messageLogRepo.findAll({
        status: MessageStatus.SENT,
        scheduledAfter: DateTime.now().startOf('day').toJSDate(),
        scheduledBefore: endOfDay,
      });

      const failed = await this.messageLogRepo.findAll({
        status: MessageStatus.FAILED,
        scheduledAfter: DateTime.now().startOf('day').toJSDate(),
        scheduledBefore: endOfDay,
      });

      // Find next scheduled message
      const nextMessages = await this.messageLogRepo.findScheduled(
        now,
        new Date(now.getTime() + 24 * 60 * 60 * 1000)
      );

      const nextScheduled = nextMessages.length > 0 ? nextMessages[0]!.scheduledSendTime : null;

      return {
        scheduledCount: scheduled.length,
        queuedCount: queued.length,
        sentCount: sent.length,
        failedCount: failed.length,
        nextScheduled,
      };
    } catch (error) {
      logger.error(
        { error: error instanceof Error ? error.message : String(error) },
        'Failed to get scheduler stats'
      );
      throw new DatabaseError('Failed to get scheduler stats', { error });
    }
  }

  /**
   * Manually trigger birthday calculation for a specific user
   * Useful for testing and debugging
   *
   * @param userId - User ID
   * @returns Scheduled message or null if not applicable
   */
  async scheduleUserBirthday(userId: string): Promise<ScheduledMessage | null> {
    try {
      const user = await this.userRepo.findById(userId);

      if (!user) {
        logger.error({ userId }, 'User not found');
        return null;
      }

      if (!user.birthdayDate) {
        logger.warn({ userId }, 'User has no birthday date');
        return null;
      }

      // Check if today is birthday
      const isBirthday = this.timezoneService.isBirthdayToday(user.birthdayDate, user.timezone);

      if (!isBirthday) {
        logger.info({ userId, timezone: user.timezone }, 'Not user birthday today');
        return null;
      }

      // Calculate send time
      const sendTime = this.timezoneService.calculateSendTime(user.birthdayDate, user.timezone);

      // Generate idempotency key
      const idempotencyKey = this.idempotencyService.generateKey(
        user.id,
        'BIRTHDAY',
        sendTime,
        user.timezone
      );

      // Check if already exists
      const existing = await this.messageLogRepo.checkIdempotency(idempotencyKey);

      if (existing) {
        logger.info({ userId, idempotencyKey }, 'Message already scheduled');
        return null;
      }

      // Create message
      const messageContent = this.composeMessage(user, 'BIRTHDAY');

      const messageData: CreateMessageLogDto = {
        userId: user.id,
        messageType: 'BIRTHDAY',
        messageContent,
        scheduledSendTime: sendTime,
        idempotencyKey,
        status: MessageStatus.SCHEDULED,
        retryCount: 0,
      };

      await this.messageLogRepo.create(messageData);

      logger.info({ userId, scheduledSendTime: sendTime }, 'Birthday message scheduled');

      return {
        userId: user.id,
        messageType: 'BIRTHDAY',
        scheduledSendTime: sendTime,
        idempotencyKey,
        messageContent,
      };
    } catch (error) {
      logger.error(
        { userId, error: error instanceof Error ? error.message : String(error) },
        'Failed to schedule user birthday'
      );
      throw error;
    }
  }
}

// Export singleton instance
export const schedulerService = new SchedulerService();
