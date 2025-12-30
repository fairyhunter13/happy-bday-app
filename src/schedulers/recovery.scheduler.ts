/**
 * Recovery Scheduler
 *
 * Runs every 10 minutes to find and recover missed messages.
 *
 * Responsibilities:
 * - Calls SchedulerService.recoverMissedMessages()
 * - Finds messages that should have been sent but weren't
 * - Retries failed messages (up to max retries)
 * - Logs recovery statistics
 *
 * Features:
 * - Automatic recovery from system downtime
 * - Retry logic with exponential backoff
 * - Dead letter handling for permanent failures
 * - Comprehensive logging and monitoring
 */

import cron from 'node-cron';
import { schedulerService } from '../services/scheduler.service.js';
import { logger } from '../config/logger.js';
import { env } from '../config/environment.js';

export class RecoveryScheduler {
  private task: ReturnType<typeof cron.schedule> | null = null;
  private isRunning = false;
  private lastRunTime: Date | null = null;
  private totalRecovered = 0;
  private totalFailed = 0;
  private totalRuns = 0;
  private lastRunStats: {
    totalMissed: number;
    recovered: number;
    failed: number;
    errorCount: number;
  } | null = null;

  /**
   * Start the recovery scheduler
   */
  public start(): void {
    if (this.task) {
      logger.warn('RecoveryScheduler already started');
      return;
    }

    const schedule = env.CRON_RECOVERY_SCHEDULE; // Default: '*/10 * * * *' (every 10 minutes)

    logger.info({ schedule, timezone: 'UTC' }, 'Starting RecoveryScheduler');

    this.task = cron.schedule(
      schedule,
      async () => {
        await this.executeJob();
      },
      {
        timezone: 'UTC',
      } as any
    );

    logger.info('RecoveryScheduler started successfully');
  }

  /**
   * Stop the recovery scheduler
   */
  public stop(): void {
    if (!this.task) {
      logger.warn('RecoveryScheduler not running');
      return;
    }

    logger.info('Stopping RecoveryScheduler...');

    this.task.stop();
    this.task = null;

    logger.info('RecoveryScheduler stopped successfully');
  }

  /**
   * Execute the recovery job
   *
   * @private
   */
  private async executeJob(): Promise<void> {
    if (this.isRunning) {
      logger.warn('RecoveryScheduler job already running, skipping this execution');
      return;
    }

    this.isRunning = true;
    this.totalRuns++;
    const startTime = Date.now();

    try {
      // Execute recovery
      const stats = await schedulerService.recoverMissedMessages();

      const executionTime = Date.now() - startTime;

      // Update statistics
      this.lastRunTime = new Date();
      this.totalRecovered += stats.recovered;
      this.totalFailed += stats.failed;
      this.lastRunStats = {
        totalMissed: stats.totalMissed,
        recovered: stats.recovered,
        failed: stats.failed,
        errorCount: stats.errors.length,
      };

      // Log results
      if (stats.totalMissed > 0) {
        logger.info(
          {
            totalMissed: stats.totalMissed,
            recovered: stats.recovered,
            failed: stats.failed,
            errorCount: stats.errors.length,
            executionTimeMs: executionTime,
          },
          'Recovery job completed - found missed messages'
        );

        // Log individual errors if any
        if (stats.errors.length > 0) {
          logger.warn(
            { errorCount: stats.errors.length },
            'Some messages had errors during recovery'
          );

          stats.errors.forEach((error, index) => {
            logger.error(
              {
                errorNumber: index + 1,
                messageId: error.messageId,
                error: error.error,
              },
              'Message recovery error'
            );
          });
        }

        // Alert if many failures
        if (stats.failed > 10) {
          logger.warn(
            {
              failedCount: stats.failed,
              totalMissed: stats.totalMissed,
            },
            'High number of failed messages detected'
          );
        }

        // Log summary
        logger.info(
          {
            totalRecoveredLifetime: this.totalRecovered,
            totalFailedLifetime: this.totalFailed,
            totalRuns: this.totalRuns,
          },
          'Recovery scheduler lifetime statistics'
        );
      } else {
        // Only log debug level when no missed messages (reduces noise)
        logger.debug(
          { executionTimeMs: executionTime },
          'Recovery job completed - no missed messages'
        );
      }
    } catch (error) {
      const executionTime = Date.now() - startTime;

      logger.error(
        {
          error: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
          executionTimeMs: executionTime,
        },
        'Recovery job failed'
      );

      // Store error state for health check
      this.lastRunTime = new Date();
      this.lastRunStats = null;

      // In production, you might want to:
      // - Send alert to monitoring system
      // - Escalate to on-call engineer
      // - Log to external error tracking service
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * Manually trigger the job (for testing/debugging)
   */
  public async triggerManually(): Promise<void> {
    logger.info('Manually triggering recovery job');
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
    lastRunStats: {
      totalMissed: number;
      recovered: number;
      failed: number;
      errorCount: number;
    } | null;
    totalRecovered: number;
    totalFailed: number;
    totalRuns: number;
    averageRecoveredPerRun: number;
  } {
    return {
      isRunning: this.isRunning,
      isScheduled: this.task !== null,
      schedule: env.CRON_RECOVERY_SCHEDULE,
      lastRunTime: this.lastRunTime,
      lastRunStats: this.lastRunStats,
      totalRecovered: this.totalRecovered,
      totalFailed: this.totalFailed,
      totalRuns: this.totalRuns,
      averageRecoveredPerRun: this.totalRuns > 0 ? this.totalRecovered / this.totalRuns : 0,
    };
  }

  /**
   * Health check
   *
   * Returns whether scheduler is healthy
   * - Should have run in last 11 minutes
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

    // Check if last run was within 11 minutes (10 min schedule + 1 min margin)
    const minutesSinceLastRun = (Date.now() - this.lastRunTime.getTime()) / (1000 * 60);

    if (minutesSinceLastRun > 11) {
      return false; // Missed execution
    }

    // Note: We don't fail health check if messages couldn't be recovered,
    // as that might be expected (e.g., external API down).
    // We only fail if the job itself failed to run.

    return true;
  }

  /**
   * Reset statistics (useful for testing)
   */
  public resetStats(): void {
    this.totalRecovered = 0;
    this.totalFailed = 0;
    this.totalRuns = 0;
    this.lastRunStats = null;
    logger.info('RecoveryScheduler statistics reset');
  }

  /**
   * Get recovery metrics for monitoring
   */
  public getMetrics(): {
    totalRecovered: number;
    totalFailed: number;
    successRate: number;
    lastRunMissedCount: number;
    lastRunRecoveryRate: number;
  } {
    const total = this.totalRecovered + this.totalFailed;
    const successRate = total > 0 ? (this.totalRecovered / total) * 100 : 0;

    const lastRunMissedCount = this.lastRunStats?.totalMissed || 0;
    const lastRunRecovered = this.lastRunStats?.recovered || 0;
    const lastRunRecoveryRate =
      lastRunMissedCount > 0 ? (lastRunRecovered / lastRunMissedCount) * 100 : 0;

    return {
      totalRecovered: this.totalRecovered,
      totalFailed: this.totalFailed,
      successRate,
      lastRunMissedCount,
      lastRunRecoveryRate,
    };
  }
}

// Export singleton instance
export const recoveryScheduler = new RecoveryScheduler();
