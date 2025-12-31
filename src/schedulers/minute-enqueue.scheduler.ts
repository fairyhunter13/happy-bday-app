/**
 * Minute Enqueue Scheduler
 *
 * Runs every minute to enqueue messages scheduled in the next hour.
 *
 * Responsibilities:
 * - Calls SchedulerService.enqueueUpcomingMessages()
 * - Finds messages scheduled in next hour
 * - Updates message status to QUEUED
 * - Logs enqueued message count
 *
 * Features:
 * - High-frequency execution (every minute)
 * - Minimal logging to avoid noise
 * - Fast execution (<1 second)
 * - Graceful error handling
 */

import cron from 'node-cron';
import { schedulerService } from '../services/scheduler.service.js';
import { MessagePublisher } from '../queue/publisher.js';
import { messageLogRepository } from '../repositories/message-log.repository.js';
import { logger } from '../config/logger.js';
import { env } from '../config/environment.js';
import { MessageStatus } from '../db/schema/message-logs.js';

export class MinuteEnqueueScheduler {
  private task: ReturnType<typeof cron.schedule> | null = null;
  private isRunning = false;
  private lastRunTime: Date | null = null;
  private totalEnqueued = 0;
  private totalRuns = 0;
  private consecutiveFailures = 0;
  private publisher: MessagePublisher;

  constructor() {
    this.publisher = new MessagePublisher();
  }

  /**
   * Initialize publisher and start the scheduler
   */
  public async start(): Promise<void> {
    if (this.task) {
      logger.warn('MinuteEnqueueScheduler already started');
      return;
    }

    // Initialize publisher
    try {
      await this.publisher.initialize();
    } catch (error) {
      logger.error(
        { error: error instanceof Error ? error.message : String(error) },
        'Failed to initialize MessagePublisher'
      );
      throw error;
    }

    const schedule = env.CRON_MINUTE_SCHEDULE; // Default: '* * * * *' (every minute)

    logger.info({ schedule, timezone: 'UTC' }, 'Starting MinuteEnqueueScheduler');

    this.task = cron.schedule(
      schedule,
      async () => {
        await this.executeJob();
      },
      {
        timezone: 'UTC',
      } as { timezone: string }
    );

    logger.info('MinuteEnqueueScheduler started successfully');
  }

  /**
   * Stop the minute scheduler
   */
  public stop(): void {
    if (!this.task) {
      logger.warn('MinuteEnqueueScheduler not running');
      return;
    }

    logger.info('Stopping MinuteEnqueueScheduler...');

    this.task.stop();
    this.task = null;

    logger.info('MinuteEnqueueScheduler stopped successfully');
  }

  /**
   * Execute the minute job
   *
   * @private
   */
  private async executeJob(): Promise<void> {
    if (this.isRunning) {
      logger.warn('MinuteEnqueueScheduler job already running, skipping this execution');
      return;
    }

    this.isRunning = true;
    this.totalRuns++;
    const startTime = Date.now();

    try {
      // Find messages to enqueue
      const count = await schedulerService.enqueueUpcomingMessages();

      if (count > 0) {
        // Fetch the enqueued messages and publish to RabbitMQ
        const now = new Date();
        const oneHourFromNow = new Date(now.getTime() + 60 * 60 * 1000);

        const messages = await messageLogRepository.findAll({
          status: MessageStatus.QUEUED,
          scheduledAfter: now,
          scheduledBefore: oneHourFromNow,
          limit: 100,
          offset: 0,
        });

        // Publish to RabbitMQ
        let publishedCount = 0;
        for (const message of messages) {
          try {
            await this.publisher.publishMessage({
              messageId: message.id,
              userId: message.userId,
              messageType: message.messageType as 'BIRTHDAY' | 'ANNIVERSARY',
              scheduledSendTime: message.scheduledSendTime.toISOString(),
              timestamp: Date.now(),
              retryCount: message.retryCount,
            });

            publishedCount++;
          } catch (error) {
            logger.error(
              {
                messageId: message.id,
                error: error instanceof Error ? error.message : String(error),
              },
              'Failed to publish message to RabbitMQ'
            );
          }
        }

        const executionTime = Date.now() - startTime;

        logger.info(
          {
            enqueued: count,
            published: publishedCount,
            executionTimeMs: executionTime,
          },
          'Messages enqueued and published to RabbitMQ'
        );

        this.totalEnqueued += count;
      } else {
        // Only log debug level when no messages (reduces noise)
        logger.debug('No messages to enqueue in next hour');
      }

      this.lastRunTime = new Date();
      this.consecutiveFailures = 0;
    } catch (error) {
      this.consecutiveFailures++;

      const executionTime = Date.now() - startTime;

      logger.error(
        {
          error: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
          executionTimeMs: executionTime,
          consecutiveFailures: this.consecutiveFailures,
        },
        'Minute enqueue job failed'
      );

      // Alert if too many consecutive failures
      if (this.consecutiveFailures >= 5) {
        logger.fatal(
          { consecutiveFailures: this.consecutiveFailures },
          'MinuteEnqueueScheduler has failed 5 times consecutively - critical issue!'
        );
      }
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * Manually trigger the job (for testing/debugging)
   */
  public async triggerManually(): Promise<void> {
    logger.info('Manually triggering minute enqueue job');
    await this.executeJob();
  }

  /**
   * Get scheduler status and health
   */
  public getStatus(): {
    isRunning: boolean;
    isScheduled: boolean;
    schedule: string;
    lastRunTime: Date | null;
    totalEnqueued: number;
    totalRuns: number;
    consecutiveFailures: number;
    averageEnqueuedPerRun: number;
  } {
    return {
      isRunning: this.isRunning,
      isScheduled: this.task !== null,
      schedule: env.CRON_MINUTE_SCHEDULE,
      lastRunTime: this.lastRunTime,
      totalEnqueued: this.totalEnqueued,
      totalRuns: this.totalRuns,
      consecutiveFailures: this.consecutiveFailures,
      averageEnqueuedPerRun: this.totalRuns > 0 ? this.totalEnqueued / this.totalRuns : 0,
    };
  }

  /**
   * Health check
   *
   * Returns whether scheduler is healthy
   * - Should have run in last 2 minutes
   * - Should not have too many consecutive failures
   */
  public isHealthy(): boolean {
    if (!this.task) {
      return false; // Not started
    }

    // Check for consecutive failures first (applies even if never successfully run)
    if (this.consecutiveFailures >= 3) {
      return false; // Too many failures
    }

    if (!this.lastRunTime) {
      // Never run yet - this is OK if just started
      return true;
    }

    // Check if last run was within 2 minutes
    const minutesSinceLastRun = (Date.now() - this.lastRunTime.getTime()) / (1000 * 60);

    if (minutesSinceLastRun > 2) {
      return false; // Missed execution
    }

    return true;
  }

  /**
   * Reset statistics (useful for testing)
   */
  public resetStats(): void {
    this.totalEnqueued = 0;
    this.totalRuns = 0;
    this.consecutiveFailures = 0;
    logger.info('MinuteEnqueueScheduler statistics reset');
  }
}

// Export singleton instance
export const minuteEnqueueScheduler = new MinuteEnqueueScheduler();
