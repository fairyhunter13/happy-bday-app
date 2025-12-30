/**
 * Unit tests for DailyBirthdayScheduler
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { DailyBirthdayScheduler } from '../../../src/schedulers/daily-birthday.scheduler.js';
import * as schedulerServiceModule from '../../../src/services/scheduler.service.js';

// Mock the scheduler service
vi.mock('../../../src/services/scheduler.service.js', () => ({
  schedulerService: {
    preCalculateTodaysBirthdays: vi.fn(),
  },
}));

describe('DailyBirthdayScheduler', () => {
  let scheduler: DailyBirthdayScheduler;

  beforeEach(() => {
    scheduler = new DailyBirthdayScheduler();
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
      expect(status.schedule).toBe('0 0 * * *'); // midnight UTC
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
    it('should execute job successfully and log statistics', async () => {
      const mockStats = {
        totalBirthdays: 10,
        totalAnniversaries: 5,
        messagesScheduled: 15,
        duplicatesSkipped: 2,
        errors: [],
      };

      vi.spyOn(schedulerServiceModule.schedulerService, 'preCalculateTodaysBirthdays')
        .mockResolvedValue(mockStats);

      await scheduler.triggerManually();

      const status = scheduler.getStatus();
      expect(status.lastRunTime).toBeTruthy();
      expect(status.lastRunStats).toEqual({
        totalBirthdays: 10,
        totalAnniversaries: 5,
        messagesScheduled: 15,
        duplicatesSkipped: 2,
        errorCount: 0,
      });
    });

    it('should handle errors during job execution', async () => {
      vi.spyOn(schedulerServiceModule.schedulerService, 'preCalculateTodaysBirthdays')
        .mockRejectedValue(new Error('Database connection failed'));

      await scheduler.triggerManually();

      const status = scheduler.getStatus();
      expect(status.lastRunTime).toBeTruthy();
      expect(status.lastRunStats).toBeNull();
    });

    it('should log individual errors from stats', async () => {
      const mockStats = {
        totalBirthdays: 10,
        totalAnniversaries: 5,
        messagesScheduled: 13,
        duplicatesSkipped: 0,
        errors: [
          { userId: 'user-1', error: 'Invalid timezone' },
          { userId: 'user-2', error: 'Missing birthday date' },
        ],
      };

      vi.spyOn(schedulerServiceModule.schedulerService, 'preCalculateTodaysBirthdays')
        .mockResolvedValue(mockStats);

      await scheduler.triggerManually();

      const status = scheduler.getStatus();
      expect(status.lastRunStats?.errorCount).toBe(2);
    });

    it('should prevent concurrent job execution', async () => {
      let resolveJob: () => void;
      const jobPromise = new Promise<void>((resolve) => {
        resolveJob = resolve;
      });

      vi.spyOn(schedulerServiceModule.schedulerService, 'preCalculateTodaysBirthdays')
        .mockImplementation(async () => {
          await jobPromise;
          return {
            totalBirthdays: 0,
            totalAnniversaries: 0,
            messagesScheduled: 0,
            duplicatesSkipped: 0,
            errors: [],
          };
        });

      // Start first job
      const job1 = scheduler.triggerManually();

      // Try to start second job (should be skipped)
      await scheduler.triggerManually();

      // Complete first job
      resolveJob!();
      await job1;

      // Should only have been called once
      expect(schedulerServiceModule.schedulerService.preCalculateTodaysBirthdays).toHaveBeenCalledTimes(1);
    });
  });

  describe('getStatus', () => {
    it('should return correct initial status', () => {
      const status = scheduler.getStatus();

      expect(status).toEqual({
        isRunning: false,
        isScheduled: false,
        schedule: '0 0 * * *',
        lastRunTime: null,
        lastRunStats: null,
      });
    });

    it('should return correct status after starting', () => {
      scheduler.start();
      const status = scheduler.getStatus();

      expect(status.isScheduled).toBe(true);
      expect(status.schedule).toBe('0 0 * * *');
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
      vi.spyOn(schedulerServiceModule.schedulerService, 'preCalculateTodaysBirthdays')
        .mockResolvedValue({
          totalBirthdays: 5,
          totalAnniversaries: 0,
          messagesScheduled: 5,
          duplicatesSkipped: 0,
          errors: [],
        });

      scheduler.start();
      await scheduler.triggerManually();

      expect(scheduler.isHealthy()).toBe(true);
    });

    it('should return false after failed run', async () => {
      vi.spyOn(schedulerServiceModule.schedulerService, 'preCalculateTodaysBirthdays')
        .mockRejectedValue(new Error('Failed'));

      scheduler.start();
      await scheduler.triggerManually();

      expect(scheduler.isHealthy()).toBe(false);
    });

    it('should return false if last run was too long ago', async () => {
      vi.spyOn(schedulerServiceModule.schedulerService, 'preCalculateTodaysBirthdays')
        .mockResolvedValue({
          totalBirthdays: 0,
          totalAnniversaries: 0,
          messagesScheduled: 0,
          duplicatesSkipped: 0,
          errors: [],
        });

      scheduler.start();
      await scheduler.triggerManually();

      // Manually set last run time to 26 hours ago
      const status = scheduler.getStatus();
      if (status.lastRunTime) {
        const oldDate = new Date(Date.now() - 26 * 60 * 60 * 1000);
        // @ts-expect-error - Accessing private property for testing
        scheduler.lastRunTime = oldDate;
      }

      expect(scheduler.isHealthy()).toBe(false);
    });
  });

  describe('triggerManually', () => {
    it('should manually trigger job execution', async () => {
      const mockStats = {
        totalBirthdays: 3,
        totalAnniversaries: 0,
        messagesScheduled: 3,
        duplicatesSkipped: 0,
        errors: [],
      };

      vi.spyOn(schedulerServiceModule.schedulerService, 'preCalculateTodaysBirthdays')
        .mockResolvedValue(mockStats);

      await scheduler.triggerManually();

      expect(schedulerServiceModule.schedulerService.preCalculateTodaysBirthdays).toHaveBeenCalled();

      const status = scheduler.getStatus();
      expect(status.lastRunStats?.totalBirthdays).toBe(3);
    });
  });
});
