import { DateTime } from 'luxon';
import { idempotencyService, type IdempotencyService } from './idempotency.service.js';
import { userRepository, type UserRepository } from '../repositories/user.repository.js';
import {
  cachedUserRepository,
  type CachedUserRepository,
} from '../repositories/cached-user.repository.js';
import {
  messageLogRepository,
  type MessageLogRepository,
} from '../repositories/message-log.repository.js';
import { MessageStatus } from '../db/schema/message-logs.js';
import type { CreateMessageLogDto } from '../types/dto.js';
import { logger } from '../config/logger.js';
import { DatabaseError } from '../utils/errors.js';
import {
  messageStrategyFactory,
  type MessageStrategy,
  type MessageContext,
} from '../strategies/index.js';
import { metricsService } from './metrics.service.js';

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
    private readonly _idempotencyService: IdempotencyService = idempotencyService,
    private readonly _userRepo: UserRepository = userRepository,
    private readonly _cachedUserRepo: CachedUserRepository = cachedUserRepository,
    private readonly _messageLogRepo: MessageLogRepository = messageLogRepository,
    private readonly _strategyFactory = messageStrategyFactory
  ) {
    logger.info('SchedulerService initialized with strategy factory and caching');
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
    const startTime = Date.now();
    logger.info('Starting daily message precalculation using strategy factory');

    const stats: PrecalculationStats = {
      totalBirthdays: 0,
      totalAnniversaries: 0,
      messagesScheduled: 0,
      duplicatesSkipped: 0,
      errors: [],
    };

    try {
      // Dynamically iterate through all registered strategies
      const strategies = this._strategyFactory.getAllStrategies();

      logger.info(
        { strategyCount: strategies.length, types: strategies.map((s) => s.messageType) },
        'Processing messages for all registered strategies'
      );

      for (const strategy of strategies) {
        const messageType = strategy.messageType;

        // Process messages for this strategy
        const typeStats = await this.processMessagesForStrategy(strategy);

        // Accumulate stats (keep backwards compatibility with totalBirthdays/totalAnniversaries)
        if (messageType === 'BIRTHDAY') {
          stats.totalBirthdays = typeStats.total;
        } else if (messageType === 'ANNIVERSARY') {
          stats.totalAnniversaries = typeStats.total;
        }

        stats.messagesScheduled += typeStats.scheduled;
        stats.duplicatesSkipped += typeStats.duplicates;
        stats.errors.push(...typeStats.errors);
      }

      const duration = (Date.now() - startTime) / 1000;

      logger.info(
        {
          totalBirthdays: stats.totalBirthdays,
          totalAnniversaries: stats.totalAnniversaries,
          messagesScheduled: stats.messagesScheduled,
          duplicatesSkipped: stats.duplicatesSkipped,
          errorCount: stats.errors.length,
        },
        'Daily message precalculation completed'
      );

      // Record metrics
      metricsService.recordSchedulerExecution('daily_precalculation', 'success', duration);

      return stats;
    } catch (error) {
      const duration = (Date.now() - startTime) / 1000;

      logger.error(
        { error: error instanceof Error ? error.message : String(error) },
        'Failed to complete daily precalculation'
      );

      // Record failed execution
      metricsService.recordSchedulerExecution('daily_precalculation', 'failure', duration);

      throw error;
    }
  }

  /**
   * Process messages for a specific strategy
   *
   * Uses the Strategy Pattern to dynamically handle different message types.
   * The strategy determines:
   * - Which users should receive messages
   * - When to send the messages
   * - What the message content should be
   *
   * @private
   */
  private async processMessagesForStrategy(strategy: MessageStrategy): Promise<{
    total: number;
    scheduled: number;
    duplicates: number;
    errors: Array<{ userId: string; error: string }>;
  }> {
    const messageType = strategy.messageType;
    const stats = {
      total: 0,
      scheduled: 0,
      duplicates: 0,
      errors: [] as Array<{ userId: string; error: string }>,
    };

    // Find all users with the relevant date for this strategy
    // Use cached repository for better performance (weak consistency with daily refresh)
    const users =
      messageType === 'BIRTHDAY'
        ? await this._cachedUserRepo.findBirthdaysToday()
        : await this._cachedUserRepo.findAnniversariesToday();

    stats.total = users.length;

    logger.info(
      { messageType, count: users.length, strategyClass: strategy.constructor.name },
      `Found users for ${messageType} messages`
    );

    const now = new Date();

    // Process each user
    for (const user of users) {
      try {
        // Validate user has required data for this strategy
        const validation = strategy.validate(user);
        if (!validation.valid) {
          logger.warn(
            { userId: user.id, messageType, errors: validation.errors },
            'User validation failed for strategy'
          );
          continue;
        }

        // Use strategy to check if message should be sent
        const shouldSend = await strategy.shouldSend(user, now);

        if (!shouldSend) {
          logger.debug(
            { userId: user.id, messageType, timezone: user.timezone },
            'Strategy determined message should not be sent'
          );
          continue;
        }

        // Use strategy to calculate send time (9am local time -> UTC)
        const sendTime = strategy.calculateSendTime(user, now);

        // Generate idempotency key
        const idempotencyKey = this._idempotencyService.generateKey(
          user.id,
          messageType,
          sendTime,
          user.timezone
        );

        // Check if message already exists
        const existing = await this._messageLogRepo.checkIdempotency(idempotencyKey);

        if (existing) {
          logger.debug(
            { userId: user.id, idempotencyKey, existingId: existing.id },
            'Message already scheduled, skipping (idempotency)'
          );
          stats.duplicates++;
          continue;
        }

        // Use strategy to compose message content
        const messageContext: MessageContext = {
          currentYear: now.getFullYear(),
          currentDate: now,
          userTimezone: user.timezone,
        };

        const messageContent = await strategy.composeMessage(user, messageContext);

        // Create message log entry
        const messageData: CreateMessageLogDto = {
          userId: user.id,
          messageType: messageType as 'BIRTHDAY' | 'ANNIVERSARY',
          messageContent,
          scheduledSendTime: sendTime,
          idempotencyKey,
          status: MessageStatus.SCHEDULED,
          retryCount: 0,
        };

        await this._messageLogRepo.create(messageData);

        logger.info(
          {
            userId: user.id,
            messageType,
            scheduledSendTime: sendTime,
            timezone: user.timezone,
            idempotencyKey,
            strategyClass: strategy.constructor.name,
          },
          'Message scheduled successfully using strategy'
        );

        // Record metrics for scheduled message
        metricsService.recordMessageScheduled(messageType, user.timezone);
        metricsService.recordBirthdayScheduledToday(user.timezone, messageType);
        metricsService.recordBirthdayProcessed('scheduled', user.timezone);

        // Record template usage (strategy name as template)
        const templateName = strategy.constructor.name.replace('Strategy', '');
        metricsService.recordMessageTemplateUsage(templateName, '1.0');

        stats.scheduled++;
      } catch (error) {
        logger.error(
          {
            userId: user.id,
            messageType,
            strategyClass: strategy.constructor.name,
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
    const startTime = Date.now();
    logger.debug('Checking for upcoming messages to enqueue');

    try {
      const now = new Date();
      const oneHourFromNow = new Date(now.getTime() + 60 * 60 * 1000);

      // Find scheduled messages in next hour
      const messages = await this._messageLogRepo.findScheduled(now, oneHourFromNow);

      logger.info(
        { count: messages.length, startTime: now, endTime: oneHourFromNow },
        'Found scheduled messages to enqueue'
      );

      let enqueued = 0;

      for (const message of messages) {
        try {
          // Update status to QUEUED
          await this._messageLogRepo.updateStatus(message.id, MessageStatus.QUEUED);

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

      const duration = (Date.now() - startTime) / 1000;

      logger.info({ enqueued }, 'Message enqueueing completed');

      // Record metrics
      metricsService.recordSchedulerExecution('enqueue_messages', 'success', duration);

      return enqueued;
    } catch (error) {
      const duration = (Date.now() - startTime) / 1000;

      logger.error(
        { error: error instanceof Error ? error.message : String(error) },
        'Failed to enqueue upcoming messages'
      );

      // Record failed execution
      metricsService.recordSchedulerExecution('enqueue_messages', 'failure', duration);

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
    const startTime = Date.now();
    logger.info('Starting missed message recovery');

    const stats: RecoveryStats = {
      totalMissed: 0,
      recovered: 0,
      failed: 0,
      errors: [],
    };

    try {
      // Find missed messages
      const missedMessages = await this._messageLogRepo.findMissed();

      stats.totalMissed = missedMessages.length;

      logger.info({ count: missedMessages.length }, 'Found missed messages for recovery');

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

            await this._messageLogRepo.updateStatus(message.id, MessageStatus.FAILED);
            stats.failed++;
            continue;
          }

          // Reset to SCHEDULED for retry
          await this._messageLogRepo.updateStatus(message.id, MessageStatus.SCHEDULED);

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

      const duration = (Date.now() - startTime) / 1000;

      logger.info(
        {
          totalMissed: stats.totalMissed,
          recovered: stats.recovered,
          failed: stats.failed,
          errorCount: stats.errors.length,
        },
        'Missed message recovery completed'
      );

      // Record metrics
      metricsService.recordSchedulerExecution('recovery_job', 'success', duration);

      return stats;
    } catch (error) {
      const duration = (Date.now() - startTime) / 1000;

      logger.error(
        { error: error instanceof Error ? error.message : String(error) },
        'Failed to recover missed messages'
      );

      // Record failed execution
      metricsService.recordSchedulerExecution('recovery_job', 'failure', duration);

      throw new DatabaseError('Failed to recover messages', { error });
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
      const scheduled = await this._messageLogRepo.findAll({
        limit: 10000,
        offset: 0,
        status: MessageStatus.SCHEDULED,
        scheduledAfter: now,
        scheduledBefore: endOfDay,
      });

      const queued = await this._messageLogRepo.findAll({
        limit: 10000,
        offset: 0,
        status: MessageStatus.QUEUED,
      });

      const sent = await this._messageLogRepo.findAll({
        limit: 10000,
        offset: 0,
        status: MessageStatus.SENT,
        scheduledAfter: DateTime.now().startOf('day').toJSDate(),
        scheduledBefore: endOfDay,
      });

      const failed = await this._messageLogRepo.findAll({
        limit: 10000,
        offset: 0,
        status: MessageStatus.FAILED,
        scheduledAfter: DateTime.now().startOf('day').toJSDate(),
        scheduledBefore: endOfDay,
      });

      // Find next scheduled message
      const nextMessages = await this._messageLogRepo.findScheduled(
        now,
        new Date(now.getTime() + 24 * 60 * 60 * 1000)
      );

      const firstNextMessage = nextMessages[0];
      const nextScheduled = firstNextMessage ? firstNextMessage.scheduledSendTime : null;

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
      const user = await this._userRepo.findById(userId);

      if (!user) {
        logger.error({ userId }, 'User not found');
        return null;
      }

      // Get birthday strategy
      const strategy = this._strategyFactory.get('BIRTHDAY');
      const now = new Date();

      // Validate user has required data
      const validation = strategy.validate(user);
      if (!validation.valid) {
        logger.warn({ userId, errors: validation.errors }, 'User validation failed for birthday');
        return null;
      }

      // Check if today is birthday using strategy
      const shouldSend = await strategy.shouldSend(user, now);

      if (!shouldSend) {
        logger.info({ userId, timezone: user.timezone }, 'Not user birthday today');
        return null;
      }

      // Calculate send time using strategy
      const sendTime = strategy.calculateSendTime(user, now);

      // Generate idempotency key
      const idempotencyKey = this._idempotencyService.generateKey(
        user.id,
        'BIRTHDAY',
        sendTime,
        user.timezone
      );

      // Check if already exists
      const existing = await this._messageLogRepo.checkIdempotency(idempotencyKey);

      if (existing) {
        logger.info({ userId, idempotencyKey }, 'Message already scheduled');
        return null;
      }

      // Compose message using strategy
      const messageContext: MessageContext = {
        currentYear: now.getFullYear(),
        currentDate: now,
        userTimezone: user.timezone,
      };

      const messageContent = await strategy.composeMessage(user, messageContext);

      const messageData: CreateMessageLogDto = {
        userId: user.id,
        messageType: 'BIRTHDAY',
        messageContent,
        scheduledSendTime: sendTime,
        idempotencyKey,
        status: MessageStatus.SCHEDULED,
        retryCount: 0,
      };

      await this._messageLogRepo.create(messageData);

      logger.info(
        { userId, scheduledSendTime: sendTime },
        'Birthday message scheduled using strategy'
      );

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
