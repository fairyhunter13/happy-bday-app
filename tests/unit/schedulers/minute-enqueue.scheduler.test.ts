/**
 * Unit tests for MinuteEnqueueScheduler
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { MinuteEnqueueScheduler } from '../../../src/schedulers/minute-enqueue.scheduler.js';
import * as schedulerServiceModule from '../../../src/services/scheduler.service.js';
import * as messageLogRepositoryModule from '../../../src/repositories/message-log.repository.js';
import { MessagePublisher } from '../../../src/queue/publisher.js';

// Mock dependencies
vi.mock('../../../src/services/scheduler.service.js', () => ({
  schedulerService: {
    enqueueUpcomingMessages: vi.fn(),
  },
}));

vi.mock('../../../src/repositories/message-log.repository.js', () => ({
  messageLogRepository: {
    findAll: vi.fn(),
  },
}));

vi.mock('../../../src/queue/publisher.js', () => {
  return {
    MessagePublisher: vi.fn().mockImplementation(() => ({
      initialize: vi.fn().mockResolvedValue(undefined),
      publishMessage: vi.fn().mockResolvedValue(undefined),
    })),
  };
});

describe('MinuteEnqueueScheduler', () => {
  let scheduler: MinuteEnqueueScheduler;

  beforeEach(() => {
    scheduler = new MinuteEnqueueScheduler();
    vi.clearAllMocks();
  });

  afterEach(() => {
    if (scheduler) {
      scheduler.stop();
    }
  });

  describe('start/stop', () => {
    it('should start the scheduler successfully', async () => {
      await scheduler.start();

      const status = scheduler.getStatus();
      expect(status.isScheduled).toBe(true);
      expect(status.schedule).toBe('* * * * *'); // every minute
    });

    it('should initialize publisher on start', async () => {
      await scheduler.start();

      // @ts-expect-error - Accessing private property for testing
      expect(scheduler.publisher.initialize).toHaveBeenCalled();
    });

    it('should not start if already started', async () => {
      await scheduler.start();
      await scheduler.start(); // Second call

      const status = scheduler.getStatus();
      expect(status.isScheduled).toBe(true);
    });

    it('should stop the scheduler successfully', async () => {
      await scheduler.start();
      scheduler.stop();

      const status = scheduler.getStatus();
      expect(status.isScheduled).toBe(false);
    });

    it('should handle publisher initialization failure', async () => {
      // @ts-expect-error - Mocking implementation
      MessagePublisher.mockImplementationOnce(() => ({
        initialize: vi.fn().mockRejectedValue(new Error('RabbitMQ connection failed')),
      }));

      const newScheduler = new MinuteEnqueueScheduler();

      await expect(newScheduler.start()).rejects.toThrow('RabbitMQ connection failed');
    });
  });

  describe('executeJob', () => {
    beforeEach(async () => {
      await scheduler.start();
    });

    it('should execute job successfully and enqueue messages', async () => {
      const mockMessages = [
        {
          id: 'msg-1',
          userId: 'user-1',
          messageType: 'BIRTHDAY' as const,
          messageContent: 'Happy Birthday!',
          scheduledSendTime: new Date(),
          idempotencyKey: 'key-1',
          retryCount: 0,
        },
        {
          id: 'msg-2',
          userId: 'user-2',
          messageType: 'BIRTHDAY' as const,
          messageContent: 'Happy Birthday!',
          scheduledSendTime: new Date(),
          idempotencyKey: 'key-2',
          retryCount: 0,
        },
      ];

      vi.spyOn(schedulerServiceModule.schedulerService, 'enqueueUpcomingMessages')
        .mockResolvedValue(2);

      vi.spyOn(messageLogRepositoryModule.messageLogRepository, 'findAll')
        .mockResolvedValue(mockMessages);

      await scheduler.triggerManually();

      const status = scheduler.getStatus();
      expect(status.totalEnqueued).toBe(2);
      expect(status.consecutiveFailures).toBe(0);

      // @ts-expect-error - Accessing private property for testing
      expect(scheduler.publisher.publishMessage).toHaveBeenCalledTimes(2);
    });

    it('should handle zero messages to enqueue', async () => {
      vi.spyOn(schedulerServiceModule.schedulerService, 'enqueueUpcomingMessages')
        .mockResolvedValue(0);

      await scheduler.triggerManually();

      const status = scheduler.getStatus();
      expect(status.totalEnqueued).toBe(0);
    });

    it('should handle errors during job execution', async () => {
      vi.spyOn(schedulerServiceModule.schedulerService, 'enqueueUpcomingMessages')
        .mockRejectedValue(new Error('Database error'));

      await scheduler.triggerManually();

      const status = scheduler.getStatus();
      expect(status.consecutiveFailures).toBe(1);
    });

    it('should track consecutive failures', async () => {
      vi.spyOn(schedulerServiceModule.schedulerService, 'enqueueUpcomingMessages')
        .mockRejectedValue(new Error('Database error'));

      await scheduler.triggerManually();
      await scheduler.triggerManually();
      await scheduler.triggerManually();

      const status = scheduler.getStatus();
      expect(status.consecutiveFailures).toBe(3);
    });

    it('should reset consecutive failures on success', async () => {
      vi.spyOn(schedulerServiceModule.schedulerService, 'enqueueUpcomingMessages')
        .mockRejectedValueOnce(new Error('Database error'))
        .mockResolvedValueOnce(0);

      await scheduler.triggerManually();
      expect(scheduler.getStatus().consecutiveFailures).toBe(1);

      await scheduler.triggerManually();
      expect(scheduler.getStatus().consecutiveFailures).toBe(0);
    });

    it('should prevent concurrent job execution', async () => {
      let resolveJob: () => void;
      const jobPromise = new Promise<void>((resolve) => {
        resolveJob = resolve;
      });

      vi.spyOn(schedulerServiceModule.schedulerService, 'enqueueUpcomingMessages')
        .mockImplementation(async () => {
          await jobPromise;
          return 0;
        });

      // Start first job
      const job1 = scheduler.triggerManually();

      // Try to start second job (should be skipped)
      await scheduler.triggerManually();

      // Complete first job
      resolveJob!();
      await job1;

      // Should only have been called once
      expect(schedulerServiceModule.schedulerService.enqueueUpcomingMessages).toHaveBeenCalledTimes(1);
    });

    it('should handle RabbitMQ publish errors gracefully', async () => {
      const mockMessages = [
        {
          id: 'msg-1',
          userId: 'user-1',
          messageType: 'BIRTHDAY' as const,
          messageContent: 'Happy Birthday!',
          scheduledSendTime: new Date(),
          idempotencyKey: 'key-1',
          retryCount: 0,
        },
      ];

      vi.spyOn(schedulerServiceModule.schedulerService, 'enqueueUpcomingMessages')
        .mockResolvedValue(1);

      vi.spyOn(messageLogRepositoryModule.messageLogRepository, 'findAll')
        .mockResolvedValue(mockMessages);

      // @ts-expect-error - Accessing private property for testing
      scheduler.publisher.publishMessage = vi.fn().mockRejectedValue(new Error('RabbitMQ error'));

      await scheduler.triggerManually();

      // Should still mark as enqueued but log error
      expect(scheduler.getStatus().consecutiveFailures).toBe(0);
    });
  });

  describe('getStatus', () => {
    it('should return correct initial status', () => {
      const status = scheduler.getStatus();

      expect(status).toEqual({
        isRunning: false,
        isScheduled: false,
        schedule: '* * * * *',
        lastRunTime: null,
        totalEnqueued: 0,
        totalRuns: 0,
        consecutiveFailures: 0,
        averageEnqueuedPerRun: 0,
      });
    });

    it('should calculate average enqueued per run correctly', async () => {
      await scheduler.start();

      vi.spyOn(schedulerServiceModule.schedulerService, 'enqueueUpcomingMessages')
        .mockResolvedValueOnce(5)
        .mockResolvedValueOnce(3)
        .mockResolvedValueOnce(2);

      vi.spyOn(messageLogRepositoryModule.messageLogRepository, 'findAll')
        .mockResolvedValue([]);

      await scheduler.triggerManually();
      await scheduler.triggerManually();
      await scheduler.triggerManually();

      const status = scheduler.getStatus();
      expect(status.totalEnqueued).toBe(10);
      expect(status.totalRuns).toBe(3);
      expect(status.averageEnqueuedPerRun).toBeCloseTo(3.33, 1);
    });
  });

  describe('isHealthy', () => {
    it('should return false if not started', () => {
      expect(scheduler.isHealthy()).toBe(false);
    });

    it('should return true if started but never run', async () => {
      await scheduler.start();
      expect(scheduler.isHealthy()).toBe(true);
    });

    it('should return true after successful run', async () => {
      await scheduler.start();

      vi.spyOn(schedulerServiceModule.schedulerService, 'enqueueUpcomingMessages')
        .mockResolvedValue(0);

      await scheduler.triggerManually();

      expect(scheduler.isHealthy()).toBe(true);
    });

    it('should return false with too many consecutive failures', async () => {
      await scheduler.start();

      vi.spyOn(schedulerServiceModule.schedulerService, 'enqueueUpcomingMessages')
        .mockRejectedValue(new Error('Error'));

      await scheduler.triggerManually();
      await scheduler.triggerManually();
      await scheduler.triggerManually();

      expect(scheduler.isHealthy()).toBe(false);
    });

    it('should return false if last run was too long ago', async () => {
      await scheduler.start();

      vi.spyOn(schedulerServiceModule.schedulerService, 'enqueueUpcomingMessages')
        .mockResolvedValue(0);

      await scheduler.triggerManually();

      // Manually set last run time to 3 minutes ago
      // @ts-expect-error - Accessing private property for testing
      scheduler.lastRunTime = new Date(Date.now() - 3 * 60 * 1000);

      expect(scheduler.isHealthy()).toBe(false);
    });
  });

  describe('resetStats', () => {
    it('should reset all statistics', async () => {
      await scheduler.start();

      vi.spyOn(schedulerServiceModule.schedulerService, 'enqueueUpcomingMessages')
        .mockResolvedValue(5);

      vi.spyOn(messageLogRepositoryModule.messageLogRepository, 'findAll')
        .mockResolvedValue([]);

      await scheduler.triggerManually();

      let status = scheduler.getStatus();
      expect(status.totalEnqueued).toBe(5);
      expect(status.totalRuns).toBe(1);

      scheduler.resetStats();

      status = scheduler.getStatus();
      expect(status.totalEnqueued).toBe(0);
      expect(status.totalRuns).toBe(0);
      expect(status.consecutiveFailures).toBe(0);
    });
  });
});
