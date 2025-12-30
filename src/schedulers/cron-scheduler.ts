/**
 * CRON Scheduler
 *
 * Manages all CRON jobs for the birthday message scheduler:
 * 1. Daily job (00:00 UTC) - Pre-calculate birthdays for the day
 * 2. Minute job (every minute) - Enqueue upcoming messages
 * 3. Recovery job (every 10 minutes) - Recover missed messages
 *
 * Uses node-cron for reliable job scheduling
 */

import cron from 'node-cron';
import { schedulerService } from '../services/scheduler.service.js';
import { logger } from '../config/logger.js';
import { env } from '../config/environment.js';

/**
 * CRON job configuration
 */
interface CronJobConfig {
  name: string;
  schedule: string;
  enabled: boolean;
  job: ReturnType<typeof cron.schedule> | null;
}

/**
 * CRON Scheduler class
 * Manages all scheduled jobs for the birthday message system
 */
export class CronScheduler {
  private jobs: Map<string, CronJobConfig> = new Map();
  private isInitialized = false;

  constructor() {
    logger.info('CronScheduler initialized');
  }

  /**
   * Initialize and start all CRON jobs
   */
  async start(): Promise<void> {
    if (this.isInitialized) {
      logger.warn('CronScheduler already initialized');
      return;
    }

    logger.info('Starting CRON scheduler...');

    try {
      // 1. Daily birthday precalculation job (00:00 UTC)
      this.registerJob('daily-precalculation', {
        name: 'Daily Birthday Precalculation',
        schedule: env.CRON_DAILY_SCHEDULE || '0 0 * * *', // Every day at midnight UTC
        enabled: env.CRON_DAILY_ENABLED !== 'false',
        job: null,
      });

      // 2. Minute job to enqueue upcoming messages (every minute)
      this.registerJob('minute-enqueue', {
        name: 'Minute Message Enqueue',
        schedule: env.CRON_MINUTE_SCHEDULE || '* * * * *', // Every minute
        enabled: env.CRON_MINUTE_ENABLED !== 'false',
        job: null,
      });

      // 3. Recovery job for missed messages (every 10 minutes)
      this.registerJob('recovery', {
        name: 'Recovery Job',
        schedule: env.CRON_RECOVERY_SCHEDULE || '*/10 * * * *', // Every 10 minutes
        enabled: env.CRON_RECOVERY_ENABLED !== 'false',
        job: null,
      });

      // Start all enabled jobs
      this.startAllJobs();

      this.isInitialized = true;
      logger.info('CRON scheduler started successfully');
    } catch (error) {
      logger.error(
        { error: error instanceof Error ? error.message : String(error) },
        'Failed to start CRON scheduler'
      );
      throw error;
    }
  }

  /**
   * Register a CRON job
   * @private
   */
  private registerJob(key: string, config: CronJobConfig): void {
    this.jobs.set(key, config);
    logger.debug({ job: key, schedule: config.schedule }, 'CRON job registered');
  }

  /**
   * Start all enabled CRON jobs
   * @private
   */
  private startAllJobs(): void {
    for (const [key, config] of this.jobs) {
      if (config.enabled) {
        this.startJob(key);
      } else {
        logger.info({ job: key }, 'CRON job disabled, skipping');
      }
    }
  }

  /**
   * Start a specific CRON job
   * @private
   */
  private startJob(key: string): void {
    const config = this.jobs.get(key);

    if (!config) {
      logger.error({ job: key }, 'CRON job not found');
      return;
    }

    if (config.job) {
      logger.warn({ job: key }, 'CRON job already running');
      return;
    }

    // Validate cron schedule
    if (!cron.validate(config.schedule)) {
      logger.error({ job: key, schedule: config.schedule }, 'Invalid CRON schedule');
      return;
    }

    // Create job handler based on job type
    const handler = this.getJobHandler(key);

    if (!handler) {
      logger.error({ job: key }, 'No handler found for CRON job');
      return;
    }

    // Create and start the CRON job
    config.job = cron.schedule(
      config.schedule,
      async () => {
        logger.info({ job: key }, 'CRON job triggered');
        const startTime = Date.now();

        try {
          await handler();
          const duration = Date.now() - startTime;
          logger.info({ job: key, duration }, 'CRON job completed successfully');
        } catch (error) {
          const duration = Date.now() - startTime;
          logger.error(
            {
              job: key,
              duration,
              error: error instanceof Error ? error.message : String(error),
            },
            'CRON job failed'
          );
        }
      },
      {
        timezone: 'UTC',
      } as any
    );

    logger.info({ job: key, schedule: config.schedule }, 'CRON job started');
  }

  /**
   * Get job handler function based on job key
   * @private
   */
  private getJobHandler(key: string): (() => Promise<void>) | null {
    switch (key) {
      case 'daily-precalculation':
        return async () => {
          logger.info('Running daily birthday precalculation...');
          const stats = await schedulerService.preCalculateTodaysBirthdays();
          logger.info(
            {
              totalBirthdays: stats.totalBirthdays,
              totalAnniversaries: stats.totalAnniversaries,
              messagesScheduled: stats.messagesScheduled,
              duplicatesSkipped: stats.duplicatesSkipped,
              errorCount: stats.errors.length,
            },
            'Daily precalculation completed'
          );
        };

      case 'minute-enqueue':
        return async () => {
          logger.debug('Running minute enqueue job...');
          const enqueued = await schedulerService.enqueueUpcomingMessages();
          if (enqueued > 0) {
            logger.info({ enqueued }, 'Messages enqueued');
          }
        };

      case 'recovery':
        return async () => {
          logger.info('Running recovery job...');
          const stats = await schedulerService.recoverMissedMessages();
          logger.info(
            {
              totalMissed: stats.totalMissed,
              recovered: stats.recovered,
              failed: stats.failed,
              errorCount: stats.errors.length,
            },
            'Recovery job completed'
          );
        };

      default:
        return null;
    }
  }

  /**
   * Stop all CRON jobs
   */
  async stop(): Promise<void> {
    logger.info('Stopping CRON scheduler...');

    for (const [key, config] of this.jobs) {
      if (config.job) {
        config.job.stop();
        config.job = null;
        logger.info({ job: key }, 'CRON job stopped');
      }
    }

    this.isInitialized = false;
    logger.info('CRON scheduler stopped successfully');
  }

  /**
   * Get status of all CRON jobs
   */
  getStatus(): Array<{
    name: string;
    schedule: string;
    enabled: boolean;
    running: boolean;
  }> {
    const status: Array<{
      name: string;
      schedule: string;
      enabled: boolean;
      running: boolean;
    }> = [];

    for (const [, config] of this.jobs) {
      status.push({
        name: config.name,
        schedule: config.schedule,
        enabled: config.enabled,
        running: config.job !== null,
      });
    }

    return status;
  }

  /**
   * Manually trigger a specific job (useful for testing)
   */
  async triggerJob(jobKey: string): Promise<void> {
    logger.info({ job: jobKey }, 'Manually triggering CRON job');

    const handler = this.getJobHandler(jobKey);

    if (!handler) {
      throw new Error(`No handler found for job: ${jobKey}`);
    }

    const startTime = Date.now();

    try {
      await handler();
      const duration = Date.now() - startTime;
      logger.info({ job: jobKey, duration }, 'Manual job trigger completed');
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error(
        {
          job: jobKey,
          duration,
          error: error instanceof Error ? error.message : String(error),
        },
        'Manual job trigger failed'
      );
      throw error;
    }
  }
}

// Export singleton instance
export const cronScheduler = new CronScheduler();
