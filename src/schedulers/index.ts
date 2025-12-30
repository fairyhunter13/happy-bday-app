/**
 * Scheduler Manager
 *
 * Central orchestration for all CRON schedulers.
 *
 * Responsibilities:
 * - Initialize all schedulers
 * - Start/stop functionality
 * - Graceful shutdown
 * - Health check aggregation
 * - Monitoring and metrics
 *
 * Schedulers managed:
 * 1. DailyBirthdayScheduler - Runs at midnight UTC
 * 2. MinuteEnqueueScheduler - Runs every minute
 * 3. RecoveryScheduler - Runs every 10 minutes
 *
 * Features:
 * - Production-ready error handling
 * - Graceful shutdown with cleanup
 * - Health monitoring for all schedulers
 * - Comprehensive logging
 */

import { dailyBirthdayScheduler } from './daily-birthday.scheduler.js';
import { minuteEnqueueScheduler } from './minute-enqueue.scheduler.js';
import { recoveryScheduler } from './recovery.scheduler.js';
import { logger } from '../config/logger.js';

export interface SchedulerHealth {
  name: string;
  healthy: boolean;
  status: {
    isRunning: boolean;
    isScheduled: boolean;
    schedule: string;
    lastRunTime: Date | null;
  };
}

export interface SchedulerManagerStatus {
  allHealthy: boolean;
  schedulers: SchedulerHealth[];
  startTime: Date | null;
  uptime: number;
}

export class SchedulerManager {
  private startTime: Date | null = null;
  private isStarted = false;

  /**
   * Initialize and start all schedulers
   */
  public async start(): Promise<void> {
    if (this.isStarted) {
      logger.warn('SchedulerManager already started');
      return;
    }

    logger.info('='.repeat(80));
    logger.info('Starting Scheduler Manager');
    logger.info('='.repeat(80));

    try {
      // Start Daily Birthday Scheduler
      logger.info('Starting DailyBirthdayScheduler...');
      dailyBirthdayScheduler.start();
      logger.info('DailyBirthdayScheduler started');

      // Start Minute Enqueue Scheduler
      logger.info('Starting MinuteEnqueueScheduler...');
      await minuteEnqueueScheduler.start();
      logger.info('MinuteEnqueueScheduler started');

      // Start Recovery Scheduler
      logger.info('Starting RecoveryScheduler...');
      recoveryScheduler.start();
      logger.info('RecoveryScheduler started');

      this.startTime = new Date();
      this.isStarted = true;

      logger.info('='.repeat(80));
      logger.info('All schedulers started successfully');
      logger.info('='.repeat(80));
      logger.info('');
      logger.info('Scheduler configuration:');
      logger.info(`  - Daily Birthday: ${dailyBirthdayScheduler.getStatus().schedule} (UTC)`);
      logger.info(`  - Minute Enqueue: ${minuteEnqueueScheduler.getStatus().schedule} (UTC)`);
      logger.info(`  - Recovery: ${recoveryScheduler.getStatus().schedule} (UTC)`);
      logger.info('');
    } catch (error) {
      logger.error(
        {
          error: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
        },
        'Failed to start schedulers'
      );
      throw error;
    }
  }

  /**
   * Stop all schedulers
   */
  public stop(): void {
    if (!this.isStarted) {
      logger.warn('SchedulerManager not started');
      return;
    }

    logger.info('='.repeat(80));
    logger.info('Stopping Scheduler Manager');
    logger.info('='.repeat(80));

    try {
      // Stop Daily Birthday Scheduler
      logger.info('Stopping DailyBirthdayScheduler...');
      dailyBirthdayScheduler.stop();
      logger.info('DailyBirthdayScheduler stopped');

      // Stop Minute Enqueue Scheduler
      logger.info('Stopping MinuteEnqueueScheduler...');
      minuteEnqueueScheduler.stop();
      logger.info('MinuteEnqueueScheduler stopped');

      // Stop Recovery Scheduler
      logger.info('Stopping RecoveryScheduler...');
      recoveryScheduler.stop();
      logger.info('RecoveryScheduler stopped');

      this.isStarted = false;

      logger.info('='.repeat(80));
      logger.info('All schedulers stopped successfully');
      logger.info('='.repeat(80));
    } catch (error) {
      logger.error(
        {
          error: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
        },
        'Error stopping schedulers'
      );
      throw error;
    }
  }

  /**
   * Graceful shutdown
   *
   * Waits for currently running jobs to complete before stopping
   */
  public async gracefulShutdown(timeoutMs = 30000): Promise<void> {
    logger.info({ timeoutMs }, 'Starting graceful shutdown of schedulers');

    const startTime = Date.now();

    // Wait for jobs to complete (with timeout)
    const checkInterval = 500; // Check every 500ms
    const maxWaitTime = timeoutMs;

    while (Date.now() - startTime < maxWaitTime) {
      const allIdle =
        !dailyBirthdayScheduler.getStatus().isRunning &&
        !minuteEnqueueScheduler.getStatus().isRunning &&
        !recoveryScheduler.getStatus().isRunning;

      if (allIdle) {
        logger.info('All scheduler jobs completed, proceeding with shutdown');
        break;
      }

      logger.debug('Waiting for scheduler jobs to complete...');
      await new Promise((resolve) => setTimeout(resolve, checkInterval));
    }

    const elapsedTime = Date.now() - startTime;

    if (elapsedTime >= maxWaitTime) {
      logger.warn(
        { elapsedTimeMs: elapsedTime, timeoutMs: maxWaitTime },
        'Graceful shutdown timeout reached, forcing shutdown'
      );
    } else {
      logger.info({ elapsedTimeMs: elapsedTime }, 'Graceful shutdown wait completed');
    }

    // Stop all schedulers
    this.stop();
  }

  /**
   * Get health status of all schedulers
   */
  public getHealthStatus(): SchedulerManagerStatus {
    const schedulers: SchedulerHealth[] = [
      {
        name: 'DailyBirthdayScheduler',
        healthy: dailyBirthdayScheduler.isHealthy(),
        status: {
          isRunning: dailyBirthdayScheduler.getStatus().isRunning,
          isScheduled: dailyBirthdayScheduler.getStatus().isScheduled,
          schedule: dailyBirthdayScheduler.getStatus().schedule,
          lastRunTime: dailyBirthdayScheduler.getStatus().lastRunTime,
        },
      },
      {
        name: 'MinuteEnqueueScheduler',
        healthy: minuteEnqueueScheduler.isHealthy(),
        status: {
          isRunning: minuteEnqueueScheduler.getStatus().isRunning,
          isScheduled: minuteEnqueueScheduler.getStatus().isScheduled,
          schedule: minuteEnqueueScheduler.getStatus().schedule,
          lastRunTime: minuteEnqueueScheduler.getStatus().lastRunTime,
        },
      },
      {
        name: 'RecoveryScheduler',
        healthy: recoveryScheduler.isHealthy(),
        status: {
          isRunning: recoveryScheduler.getStatus().isRunning,
          isScheduled: recoveryScheduler.getStatus().isScheduled,
          schedule: recoveryScheduler.getStatus().schedule,
          lastRunTime: recoveryScheduler.getStatus().lastRunTime,
        },
      },
    ];

    const allHealthy = schedulers.every((s) => s.healthy);

    const uptime = this.startTime ? Date.now() - this.startTime.getTime() : 0;

    return {
      allHealthy,
      schedulers,
      startTime: this.startTime,
      uptime,
    };
  }

  /**
   * Get detailed statistics for all schedulers
   */
  public getDetailedStats(): {
    dailyBirthday: ReturnType<typeof dailyBirthdayScheduler.getStatus>;
    minuteEnqueue: ReturnType<typeof minuteEnqueueScheduler.getStatus>;
    recovery: ReturnType<typeof recoveryScheduler.getStatus>;
    recoveryMetrics: ReturnType<typeof recoveryScheduler.getMetrics>;
  } {
    return {
      dailyBirthday: dailyBirthdayScheduler.getStatus(),
      minuteEnqueue: minuteEnqueueScheduler.getStatus(),
      recovery: recoveryScheduler.getStatus(),
      recoveryMetrics: recoveryScheduler.getMetrics(),
    };
  }

  /**
   * Check if scheduler manager is started
   */
  public isRunning(): boolean {
    return this.isStarted;
  }

  /**
   * Manually trigger all schedulers (for testing/debugging)
   */
  public async triggerAll(): Promise<void> {
    logger.info('Manually triggering all schedulers');

    await dailyBirthdayScheduler.triggerManually();
    await minuteEnqueueScheduler.triggerManually();
    await recoveryScheduler.triggerManually();

    logger.info('All schedulers triggered successfully');
  }

  /**
   * Manually trigger a specific scheduler
   */
  public async triggerScheduler(name: 'daily' | 'minute' | 'recovery'): Promise<void> {
    logger.info({ scheduler: name }, 'Manually triggering scheduler');

    switch (name) {
      case 'daily':
        await dailyBirthdayScheduler.triggerManually();
        break;
      case 'minute':
        await minuteEnqueueScheduler.triggerManually();
        break;
      case 'recovery':
        await recoveryScheduler.triggerManually();
        break;
      default:
        throw new Error(`Unknown scheduler: ${name}`);
    }

    logger.info({ scheduler: name }, 'Scheduler triggered successfully');
  }
}

// Export singleton instance
export const schedulerManager = new SchedulerManager();

// Export individual schedulers for direct access if needed
export { dailyBirthdayScheduler, minuteEnqueueScheduler, recoveryScheduler };
