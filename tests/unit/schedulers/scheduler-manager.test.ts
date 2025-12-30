/**
 * Unit tests for SchedulerManager
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { SchedulerManager } from '../../../src/schedulers/index.js';
import * as dailySchedulerModule from '../../../src/schedulers/daily-birthday.scheduler.js';
import * as minuteSchedulerModule from '../../../src/schedulers/minute-enqueue.scheduler.js';
import * as recoverySchedulerModule from '../../../src/schedulers/recovery.scheduler.js';

// Mock individual schedulers
vi.mock('../../../src/schedulers/daily-birthday.scheduler.js', () => ({
  dailyBirthdayScheduler: {
    start: vi.fn(),
    stop: vi.fn(),
    getStatus: vi.fn().mockReturnValue({
      isRunning: false,
      isScheduled: true,
      schedule: '0 0 * * *',
      lastRunTime: null,
      lastRunStats: null,
    }),
    isHealthy: vi.fn().mockReturnValue(true),
    triggerManually: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock('../../../src/schedulers/minute-enqueue.scheduler.js', () => ({
  minuteEnqueueScheduler: {
    start: vi.fn().mockResolvedValue(undefined),
    stop: vi.fn(),
    getStatus: vi.fn().mockReturnValue({
      isRunning: false,
      isScheduled: true,
      schedule: '* * * * *',
      lastRunTime: null,
      totalEnqueued: 0,
      totalRuns: 0,
      consecutiveFailures: 0,
      averageEnqueuedPerRun: 0,
    }),
    isHealthy: vi.fn().mockReturnValue(true),
    triggerManually: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock('../../../src/schedulers/recovery.scheduler.js', () => ({
  recoveryScheduler: {
    start: vi.fn(),
    stop: vi.fn(),
    getStatus: vi.fn().mockReturnValue({
      isRunning: false,
      isScheduled: true,
      schedule: '*/10 * * * *',
      lastRunTime: null,
      lastRunStats: null,
      totalRecovered: 0,
      totalFailed: 0,
      totalRuns: 0,
      averageRecoveredPerRun: 0,
    }),
    isHealthy: vi.fn().mockReturnValue(true),
    getMetrics: vi.fn().mockReturnValue({
      totalRecovered: 0,
      totalFailed: 0,
      successRate: 0,
      lastRunMissedCount: 0,
      lastRunRecoveryRate: 0,
    }),
    triggerManually: vi.fn().mockResolvedValue(undefined),
  },
}));

describe('SchedulerManager', () => {
  let manager: SchedulerManager;

  beforeEach(() => {
    manager = new SchedulerManager();
    vi.clearAllMocks();
  });

  afterEach(() => {
    if (manager && manager.isRunning()) {
      manager.stop();
    }
  });

  describe('start/stop', () => {
    it('should start all schedulers successfully', async () => {
      await manager.start();

      expect(dailySchedulerModule.dailyBirthdayScheduler.start).toHaveBeenCalled();
      expect(minuteSchedulerModule.minuteEnqueueScheduler.start).toHaveBeenCalled();
      expect(recoverySchedulerModule.recoveryScheduler.start).toHaveBeenCalled();
      expect(manager.isRunning()).toBe(true);
    });

    it('should not start if already started', async () => {
      await manager.start();
      await manager.start(); // Second call

      // Each scheduler should only be started once
      expect(dailySchedulerModule.dailyBirthdayScheduler.start).toHaveBeenCalledTimes(1);
      expect(minuteSchedulerModule.minuteEnqueueScheduler.start).toHaveBeenCalledTimes(1);
      expect(recoverySchedulerModule.recoveryScheduler.start).toHaveBeenCalledTimes(1);
    });

    it('should stop all schedulers successfully', async () => {
      await manager.start();
      manager.stop();

      expect(dailySchedulerModule.dailyBirthdayScheduler.stop).toHaveBeenCalled();
      expect(minuteSchedulerModule.minuteEnqueueScheduler.stop).toHaveBeenCalled();
      expect(recoverySchedulerModule.recoveryScheduler.stop).toHaveBeenCalled();
      expect(manager.isRunning()).toBe(false);
    });

    it('should handle stop when not started', () => {
      manager.stop(); // Should not throw

      expect(manager.isRunning()).toBe(false);
    });

    it('should handle scheduler start failure', async () => {
      vi.spyOn(minuteSchedulerModule.minuteEnqueueScheduler, 'start').mockRejectedValueOnce(
        new Error('RabbitMQ connection failed')
      );

      await expect(manager.start()).rejects.toThrow('RabbitMQ connection failed');
    });
  });

  describe('gracefulShutdown', () => {
    it('should wait for running jobs to complete', async () => {
      await manager.start();

      // Simulate running jobs
      vi.spyOn(dailySchedulerModule.dailyBirthdayScheduler, 'getStatus')
        .mockReturnValueOnce({
          isRunning: true,
          isScheduled: true,
          schedule: '0 0 * * *',
          lastRunTime: null,
          lastRunStats: null,
        })
        .mockReturnValue({
          isRunning: false,
          isScheduled: true,
          schedule: '0 0 * * *',
          lastRunTime: null,
          lastRunStats: null,
        });

      vi.spyOn(minuteSchedulerModule.minuteEnqueueScheduler, 'getStatus').mockReturnValue({
        isRunning: false,
        isScheduled: true,
        schedule: '* * * * *',
        lastRunTime: null,
        totalEnqueued: 0,
        totalRuns: 0,
        consecutiveFailures: 0,
        averageEnqueuedPerRun: 0,
      });

      vi.spyOn(recoverySchedulerModule.recoveryScheduler, 'getStatus').mockReturnValue({
        isRunning: false,
        isScheduled: true,
        schedule: '*/10 * * * *',
        lastRunTime: null,
        lastRunStats: null,
        totalRecovered: 0,
        totalFailed: 0,
        totalRuns: 0,
        averageRecoveredPerRun: 0,
      });

      await manager.gracefulShutdown(5000);

      expect(dailySchedulerModule.dailyBirthdayScheduler.stop).toHaveBeenCalled();
      expect(manager.isRunning()).toBe(false);
    });

    it('should timeout and force shutdown if jobs take too long', async () => {
      await manager.start();

      // Simulate jobs that never complete
      vi.spyOn(dailySchedulerModule.dailyBirthdayScheduler, 'getStatus').mockReturnValue({
        isRunning: true,
        isScheduled: true,
        schedule: '0 0 * * *',
        lastRunTime: null,
        lastRunStats: null,
      });

      vi.spyOn(minuteSchedulerModule.minuteEnqueueScheduler, 'getStatus').mockReturnValue({
        isRunning: false,
        isScheduled: true,
        schedule: '* * * * *',
        lastRunTime: null,
        totalEnqueued: 0,
        totalRuns: 0,
        consecutiveFailures: 0,
        averageEnqueuedPerRun: 0,
      });

      vi.spyOn(recoverySchedulerModule.recoveryScheduler, 'getStatus').mockReturnValue({
        isRunning: false,
        isScheduled: true,
        schedule: '*/10 * * * *',
        lastRunTime: null,
        lastRunStats: null,
        totalRecovered: 0,
        totalFailed: 0,
        totalRuns: 0,
        averageRecoveredPerRun: 0,
      });

      await manager.gracefulShutdown(1000); // 1 second timeout

      // Should still stop despite timeout
      expect(dailySchedulerModule.dailyBirthdayScheduler.stop).toHaveBeenCalled();
      expect(manager.isRunning()).toBe(false);
    });

    it('should immediately shutdown if all jobs idle', async () => {
      await manager.start();

      const startTime = Date.now();
      await manager.gracefulShutdown(30000);
      const elapsedTime = Date.now() - startTime;

      // Should complete quickly (under 1 second)
      expect(elapsedTime).toBeLessThan(1000);
      expect(manager.isRunning()).toBe(false);
    });
  });

  describe('getHealthStatus', () => {
    it('should return health status of all schedulers', async () => {
      await manager.start();

      const health = manager.getHealthStatus();

      expect(health.allHealthy).toBe(true);
      expect(health.schedulers).toHaveLength(3);
      expect(health.schedulers[0]?.name).toBe('DailyBirthdayScheduler');
      expect(health.schedulers[1]?.name).toBe('MinuteEnqueueScheduler');
      expect(health.schedulers[2]?.name).toBe('RecoveryScheduler');
      expect(health.startTime).toBeTruthy();
      expect(health.uptime).toBeGreaterThanOrEqual(0);
    });

    it('should report unhealthy if any scheduler is unhealthy', async () => {
      await manager.start();

      vi.spyOn(dailySchedulerModule.dailyBirthdayScheduler, 'isHealthy').mockReturnValue(false);

      const health = manager.getHealthStatus();

      expect(health.allHealthy).toBe(false);
      expect(health.schedulers[0]?.healthy).toBe(false);
    });

    it('should return correct uptime', async () => {
      await manager.start();

      // Wait a bit
      await new Promise((resolve) => setTimeout(resolve, 100));

      const health = manager.getHealthStatus();

      expect(health.uptime).toBeGreaterThan(90); // At least 90ms
      expect(health.uptime).toBeLessThan(500); // Less than 500ms
    });
  });

  describe('getDetailedStats', () => {
    it('should return detailed statistics for all schedulers', async () => {
      await manager.start();

      const stats = manager.getDetailedStats();

      expect(stats).toHaveProperty('dailyBirthday');
      expect(stats).toHaveProperty('minuteEnqueue');
      expect(stats).toHaveProperty('recovery');
      expect(stats).toHaveProperty('recoveryMetrics');

      expect(stats.dailyBirthday.schedule).toBe('0 0 * * *');
      expect(stats.minuteEnqueue.schedule).toBe('* * * * *');
      expect(stats.recovery.schedule).toBe('*/10 * * * *');
    });
  });

  describe('triggerAll', () => {
    it('should trigger all schedulers manually', async () => {
      await manager.start();

      await manager.triggerAll();

      expect(dailySchedulerModule.dailyBirthdayScheduler.triggerManually).toHaveBeenCalled();
      expect(minuteSchedulerModule.minuteEnqueueScheduler.triggerManually).toHaveBeenCalled();
      expect(recoverySchedulerModule.recoveryScheduler.triggerManually).toHaveBeenCalled();
    });
  });

  describe('triggerScheduler', () => {
    it('should trigger daily scheduler', async () => {
      await manager.start();

      await manager.triggerScheduler('daily');

      expect(dailySchedulerModule.dailyBirthdayScheduler.triggerManually).toHaveBeenCalled();
      expect(minuteSchedulerModule.minuteEnqueueScheduler.triggerManually).not.toHaveBeenCalled();
      expect(recoverySchedulerModule.recoveryScheduler.triggerManually).not.toHaveBeenCalled();
    });

    it('should trigger minute scheduler', async () => {
      await manager.start();

      await manager.triggerScheduler('minute');

      expect(dailySchedulerModule.dailyBirthdayScheduler.triggerManually).not.toHaveBeenCalled();
      expect(minuteSchedulerModule.minuteEnqueueScheduler.triggerManually).toHaveBeenCalled();
      expect(recoverySchedulerModule.recoveryScheduler.triggerManually).not.toHaveBeenCalled();
    });

    it('should trigger recovery scheduler', async () => {
      await manager.start();

      await manager.triggerScheduler('recovery');

      expect(dailySchedulerModule.dailyBirthdayScheduler.triggerManually).not.toHaveBeenCalled();
      expect(minuteSchedulerModule.minuteEnqueueScheduler.triggerManually).not.toHaveBeenCalled();
      expect(recoverySchedulerModule.recoveryScheduler.triggerManually).toHaveBeenCalled();
    });

    it('should throw error for unknown scheduler', async () => {
      await manager.start();

      // @ts-expect-error - Testing invalid input
      await expect(manager.triggerScheduler('invalid')).rejects.toThrow('Unknown scheduler');
    });
  });

  describe('isRunning', () => {
    it('should return false initially', () => {
      expect(manager.isRunning()).toBe(false);
    });

    it('should return true after starting', async () => {
      await manager.start();
      expect(manager.isRunning()).toBe(true);
    });

    it('should return false after stopping', async () => {
      await manager.start();
      manager.stop();
      expect(manager.isRunning()).toBe(false);
    });
  });
});
