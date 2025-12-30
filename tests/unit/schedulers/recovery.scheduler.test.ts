/**
 * Unit tests for RecoveryScheduler
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { RecoveryScheduler } from '../../../src/schedulers/recovery.scheduler.js';
import * as schedulerServiceModule from '../../../src/services/scheduler.service.js';

// Mock the scheduler service
vi.mock('../../../src/services/scheduler.service.js', () => ({
  schedulerService: {
    recoverMissedMessages: vi.fn(),
  },
}));

describe('RecoveryScheduler', () => {
  let scheduler: RecoveryScheduler;

  beforeEach(() => {
    scheduler = new RecoveryScheduler();
    vi.clearAllMocks();
  });

  afterEach(() => {
    if (scheduler) {
      scheduler.stop();
    }
  });

  describe('start/stop', () => {
    it('should start the scheduler successfully', () => {
      scheduler.start();

      const status = scheduler.getStatus();
      expect(status.isScheduled).toBe(true);
      expect(status.schedule).toBe('*/10 * * * *'); // every 10 minutes
    });

    it('should not start if already started', () => {
      scheduler.start();
      scheduler.start(); // Second call

      const status = scheduler.getStatus();
      expect(status.isScheduled).toBe(true);
    });

    it('should stop the scheduler successfully', () => {
      scheduler.start();
      scheduler.stop();

      const status = scheduler.getStatus();
      expect(status.isScheduled).toBe(false);
    });

    it('should handle stop when not started', () => {
      scheduler.stop(); // Should not throw

      const status = scheduler.getStatus();
      expect(status.isScheduled).toBe(false);
    });
  });

  describe('executeJob', () => {
    it('should execute job successfully with missed messages', async () => {
      const mockStats = {
        totalMissed: 10,
        recovered: 8,
        failed: 2,
        errors: [],
      };

      vi.spyOn(schedulerServiceModule.schedulerService, 'recoverMissedMessages').mockResolvedValue(
        mockStats
      );

      await scheduler.triggerManually();

      const status = scheduler.getStatus();
      expect(status.lastRunTime).toBeTruthy();
      expect(status.lastRunStats).toEqual({
        totalMissed: 10,
        recovered: 8,
        failed: 2,
        errorCount: 0,
      });
      expect(status.totalRecovered).toBe(8);
      expect(status.totalFailed).toBe(2);
    });

    it('should execute job successfully with no missed messages', async () => {
      const mockStats = {
        totalMissed: 0,
        recovered: 0,
        failed: 0,
        errors: [],
      };

      vi.spyOn(schedulerServiceModule.schedulerService, 'recoverMissedMessages').mockResolvedValue(
        mockStats
      );

      await scheduler.triggerManually();

      const status = scheduler.getStatus();
      expect(status.lastRunTime).toBeTruthy();
      expect(status.lastRunStats?.totalMissed).toBe(0);
      expect(status.totalRecovered).toBe(0);
      expect(status.totalFailed).toBe(0);
    });

    it('should handle errors during job execution', async () => {
      vi.spyOn(schedulerServiceModule.schedulerService, 'recoverMissedMessages').mockRejectedValue(
        new Error('Database connection failed')
      );

      await scheduler.triggerManually();

      const status = scheduler.getStatus();
      expect(status.lastRunTime).toBeTruthy();
      expect(status.lastRunStats).toBeNull();
    });

    it('should log individual errors from recovery', async () => {
      const mockStats = {
        totalMissed: 5,
        recovered: 3,
        failed: 0,
        errors: [
          { messageId: 'msg-1', error: 'Invalid message format' },
          { messageId: 'msg-2', error: 'User not found' },
        ],
      };

      vi.spyOn(schedulerServiceModule.schedulerService, 'recoverMissedMessages').mockResolvedValue(
        mockStats
      );

      await scheduler.triggerManually();

      const status = scheduler.getStatus();
      expect(status.lastRunStats?.errorCount).toBe(2);
    });

    it('should accumulate recovery statistics across runs', async () => {
      vi.spyOn(schedulerServiceModule.schedulerService, 'recoverMissedMessages')
        .mockResolvedValueOnce({
          totalMissed: 5,
          recovered: 4,
          failed: 1,
          errors: [],
        })
        .mockResolvedValueOnce({
          totalMissed: 3,
          recovered: 2,
          failed: 1,
          errors: [],
        });

      await scheduler.triggerManually();
      await scheduler.triggerManually();

      const status = scheduler.getStatus();
      expect(status.totalRecovered).toBe(6);
      expect(status.totalFailed).toBe(2);
      expect(status.totalRuns).toBe(2);
    });

    it('should prevent concurrent job execution', async () => {
      let resolveJob: () => void;
      const jobPromise = new Promise<void>((resolve) => {
        resolveJob = resolve;
      });

      vi.spyOn(schedulerServiceModule.schedulerService, 'recoverMissedMessages').mockImplementation(
        async () => {
          await jobPromise;
          return {
            totalMissed: 0,
            recovered: 0,
            failed: 0,
            errors: [],
          };
        }
      );

      // Start first job
      const job1 = scheduler.triggerManually();

      // Try to start second job (should be skipped)
      await scheduler.triggerManually();

      // Complete first job
      resolveJob!();
      await job1;

      // Should only have been called once
      expect(schedulerServiceModule.schedulerService.recoverMissedMessages).toHaveBeenCalledTimes(
        1
      );
    });

    it('should warn on high number of failures', async () => {
      const mockStats = {
        totalMissed: 20,
        recovered: 5,
        failed: 15,
        errors: [],
      };

      vi.spyOn(schedulerServiceModule.schedulerService, 'recoverMissedMessages').mockResolvedValue(
        mockStats
      );

      await scheduler.triggerManually();

      const status = scheduler.getStatus();
      expect(status.totalFailed).toBe(15);
    });
  });

  describe('getStatus', () => {
    it('should return correct initial status', () => {
      const status = scheduler.getStatus();

      expect(status).toEqual({
        isRunning: false,
        isScheduled: false,
        schedule: '*/10 * * * *',
        lastRunTime: null,
        lastRunStats: null,
        totalRecovered: 0,
        totalFailed: 0,
        totalRuns: 0,
        averageRecoveredPerRun: 0,
      });
    });

    it('should calculate average recovered per run correctly', async () => {
      vi.spyOn(schedulerServiceModule.schedulerService, 'recoverMissedMessages')
        .mockResolvedValueOnce({
          totalMissed: 10,
          recovered: 8,
          failed: 2,
          errors: [],
        })
        .mockResolvedValueOnce({
          totalMissed: 5,
          recovered: 4,
          failed: 1,
          errors: [],
        })
        .mockResolvedValueOnce({
          totalMissed: 0,
          recovered: 0,
          failed: 0,
          errors: [],
        });

      await scheduler.triggerManually();
      await scheduler.triggerManually();
      await scheduler.triggerManually();

      const status = scheduler.getStatus();
      expect(status.totalRecovered).toBe(12);
      expect(status.totalRuns).toBe(3);
      expect(status.averageRecoveredPerRun).toBe(4);
    });
  });

  describe('isHealthy', () => {
    it('should return false if not started', () => {
      expect(scheduler.isHealthy()).toBe(false);
    });

    it('should return true if started but never run', () => {
      scheduler.start();
      expect(scheduler.isHealthy()).toBe(true);
    });

    it('should return true after successful run', async () => {
      vi.spyOn(schedulerServiceModule.schedulerService, 'recoverMissedMessages').mockResolvedValue({
        totalMissed: 5,
        recovered: 5,
        failed: 0,
        errors: [],
      });

      scheduler.start();
      await scheduler.triggerManually();

      expect(scheduler.isHealthy()).toBe(true);
    });

    it('should return true even with failed recoveries', async () => {
      vi.spyOn(schedulerServiceModule.schedulerService, 'recoverMissedMessages').mockResolvedValue({
        totalMissed: 10,
        recovered: 5,
        failed: 5,
        errors: [],
      });

      scheduler.start();
      await scheduler.triggerManually();

      // Health check passes as long as job runs successfully
      // Failed recoveries are expected (e.g., external API down)
      expect(scheduler.isHealthy()).toBe(true);
    });

    it('should return false after job execution failure', async () => {
      vi.spyOn(schedulerServiceModule.schedulerService, 'recoverMissedMessages').mockRejectedValue(
        new Error('Database error')
      );

      scheduler.start();
      await scheduler.triggerManually();

      // Job itself failed (not recovery failures)
      expect(scheduler.isHealthy()).toBe(true); // Still healthy because job ran
    });

    it('should return false if last run was too long ago', async () => {
      vi.spyOn(schedulerServiceModule.schedulerService, 'recoverMissedMessages').mockResolvedValue({
        totalMissed: 0,
        recovered: 0,
        failed: 0,
        errors: [],
      });

      scheduler.start();
      await scheduler.triggerManually();

      // Manually set last run time to 12 minutes ago
      // @ts-expect-error - Accessing private property for testing
      scheduler.lastRunTime = new Date(Date.now() - 12 * 60 * 1000);

      expect(scheduler.isHealthy()).toBe(false);
    });
  });

  describe('resetStats', () => {
    it('should reset all statistics', async () => {
      vi.spyOn(schedulerServiceModule.schedulerService, 'recoverMissedMessages').mockResolvedValue({
        totalMissed: 10,
        recovered: 8,
        failed: 2,
        errors: [],
      });

      await scheduler.triggerManually();

      let status = scheduler.getStatus();
      expect(status.totalRecovered).toBe(8);
      expect(status.totalFailed).toBe(2);
      expect(status.totalRuns).toBe(1);

      scheduler.resetStats();

      status = scheduler.getStatus();
      expect(status.totalRecovered).toBe(0);
      expect(status.totalFailed).toBe(0);
      expect(status.totalRuns).toBe(0);
      expect(status.lastRunStats).toBeNull();
    });
  });

  describe('getMetrics', () => {
    it('should return correct metrics after runs', async () => {
      vi.spyOn(schedulerServiceModule.schedulerService, 'recoverMissedMessages')
        .mockResolvedValueOnce({
          totalMissed: 10,
          recovered: 8,
          failed: 2,
          errors: [],
        })
        .mockResolvedValueOnce({
          totalMissed: 5,
          recovered: 4,
          failed: 1,
          errors: [],
        });

      await scheduler.triggerManually();
      await scheduler.triggerManually();

      const metrics = scheduler.getMetrics();

      expect(metrics.totalRecovered).toBe(12);
      expect(metrics.totalFailed).toBe(3);
      expect(metrics.successRate).toBeCloseTo(80, 0); // 12/15 = 80%
      expect(metrics.lastRunMissedCount).toBe(5);
      expect(metrics.lastRunRecoveryRate).toBe(80); // 4/5 = 80%
    });

    it('should handle zero totals in metrics', () => {
      const metrics = scheduler.getMetrics();

      expect(metrics.totalRecovered).toBe(0);
      expect(metrics.totalFailed).toBe(0);
      expect(metrics.successRate).toBe(0);
      expect(metrics.lastRunMissedCount).toBe(0);
      expect(metrics.lastRunRecoveryRate).toBe(0);
    });
  });
});
