/**
 * Daily Birthday Scheduler
 *
 * Runs at midnight UTC (00:00) to pre-calculate all birthdays for the day.
 *
 * Responsibilities:
 * - Calls SchedulerService.preCalculateTodaysBirthdays()
 * - Logs comprehensive statistics
 * - Error handling and recovery
 * - Health monitoring
 *
 * Features:
 * - Production-ready error handling
 * - Detailed logging with structured data
 * - Graceful shutdown support
 * - Configurable schedule via environment
 */

import cron from 'node-cron';
import { schedulerService } from '../services/scheduler.service.js';
import { logger } from '../config/logger.js';
import { env } from '../config/environment.js';

export class DailyBirthdayScheduler {
  private task: cron.ScheduledTask | null = null;
  private isRunning = false;
  private lastRunTime: Date | null = null;
  private lastRunStats: {
    totalBirthdays: number;
    totalAnniversaries: number;
    messagesScheduled: number;
    duplicatesSkipped: number;
    errorCount: number;
  } | null = null;

  /**
   * Start the daily scheduler
   */
  public start(): void {
    if (this.task) {
      logger.warn('DailyBirthdayScheduler already started');
      return;
    }

    const schedule = env.CRON_DAILY_SCHEDULE; // Default: '0 0 * * *' (midnight UTC)

    logger.info({ schedule, timezone: 'UTC' }, 'Starting DailyBirthdayScheduler');

    this.task = cron.schedule(
      schedule,
      async () => {
        await this.executeJob();
      },
      {
        scheduled: true,
        timezone: 'UTC',
      }
    );

    logger.info('DailyBirthdayScheduler started successfully');
  }

  /**
   * Stop the daily scheduler
   */
  public stop(): void {
    if (!this.task) {
      logger.warn('DailyBirthdayScheduler not running');
      return;
    }

    logger.info('Stopping DailyBirthdayScheduler...');

    this.task.stop();
    this.task = null;

    logger.info('DailyBirthdayScheduler stopped successfully');
  }

  /**
   * Execute the daily job
   *
   * @private
   */
  private async executeJob(): Promise<void> {
    if (this.isRunning) {
      logger.warn('DailyBirthdayScheduler job already running, skipping this execution');
      return;
    }

    this.isRunning = true;
    const startTime = Date.now();

    logger.info('='.repeat(80));
    logger.info('Starting daily birthday precalculation job');
    logger.info('='.repeat(80));

    try {
      // Execute the precalculation
      const stats = await schedulerService.preCalculateTodaysBirthdays();

      const executionTime = Date.now() - startTime;

      // Store stats for health check
      this.lastRunTime = new Date();
      this.lastRunStats = {
        totalBirthdays: stats.totalBirthdays,
        totalAnniversaries: stats.totalAnniversaries,
        messagesScheduled: stats.messagesScheduled,
        duplicatesSkipped: stats.duplicatesSkipped,
        errorCount: stats.errors.length,
      };

      // Log comprehensive statistics
      logger.info(
        {
          totalBirthdays: stats.totalBirthdays,
          totalAnniversaries: stats.totalAnniversaries,
          messagesScheduled: stats.messagesScheduled,
          duplicatesSkipped: stats.duplicatesSkipped,
          errorCount: stats.errors.length,
          executionTimeMs: executionTime,
          executionTimeSec: (executionTime / 1000).toFixed(2),
        },
        'Daily birthday precalculation completed successfully'
      );

      // Log individual errors if any
      if (stats.errors.length > 0) {
        logger.warn(
          { errorCount: stats.errors.length },
          'Some users had errors during precalculation'
        );

        stats.errors.forEach((error, index) => {
          logger.error(
            {
              errorNumber: index + 1,
              userId: error.userId,
              error: error.error,
            },
            'User precalculation error'
          );
        });
      }

      // Log success metrics
      logger.info('='.repeat(80));
      logger.info('Daily birthday precalculation job completed');
      logger.info(`Total messages scheduled: ${stats.messagesScheduled}`);
      logger.info(`Total birthdays: ${stats.totalBirthdays}`);
      logger.info(`Total anniversaries: ${stats.totalAnniversaries}`);
      logger.info(`Duplicates prevented: ${stats.duplicatesSkipped}`);
      logger.info(`Execution time: ${(executionTime / 1000).toFixed(2)}s`);
      logger.info('='.repeat(80));
    } catch (error) {
      const executionTime = Date.now() - startTime;

      logger.error(
        {
          error: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
          executionTimeMs: executionTime,
        },
        'Daily birthday precalculation job failed'
      );

      // Store error state for health check
      this.lastRunTime = new Date();
      this.lastRunStats = null;

      // In production, you might want to:
      // - Send alert to monitoring system
      // - Trigger recovery mechanism
      // - Log to external error tracking service
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * Manually trigger the job (for testing/debugging)
   */
  public async triggerManually(): Promise<void> {
    logger.info('Manually triggering daily birthday precalculation job');
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
    lastRunStats: typeof this.lastRunStats;
  } {
    return {
      isRunning: this.isRunning,
      isScheduled: this.task !== null,
      schedule: env.CRON_DAILY_SCHEDULE,
      lastRunTime: this.lastRunTime,
      lastRunStats: this.lastRunStats,
    };
  }

  /**
   * Health check
   *
   * Returns whether scheduler is healthy
   * - Should have run in last 25 hours
   * - Last run should have succeeded
   */
  public isHealthy(): boolean {
    if (!this.task) {
      return false; // Not started
    }

    if (!this.lastRunTime) {
      // Never run yet - this is OK if just started
      return true;
    }

    // Check if last run was within 25 hours (allowing 1 hour margin)
    const hoursSinceLastRun = (Date.now() - this.lastRunTime.getTime()) / (1000 * 60 * 60);

    if (hoursSinceLastRun > 25) {
      return false; // Missed execution
    }

    // Check if last run succeeded
    if (this.lastRunStats === null) {
      return false; // Last run failed
    }

    return true;
  }
}

// Export singleton instance
export const dailyBirthdayScheduler = new DailyBirthdayScheduler();
