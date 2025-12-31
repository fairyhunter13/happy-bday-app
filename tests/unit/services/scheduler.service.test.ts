import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { SchedulerService } from '../../../src/services/scheduler.service.js';
import { MessageStatus } from '../../../src/db/schema/message-logs.js';
import type { User } from '../../../src/db/schema/users.js';
import type { MessageLog } from '../../../src/db/schema/message-logs.js';

/**
 * Unit Tests: SchedulerService
 *
 * Tests the scheduler service including:
 * - Daily precalculation of birthdays/anniversaries
 * - Message enqueuing
 * - Message recovery
 * - Scheduler statistics
 * - Error handling paths
 */
describe('SchedulerService', () => {
  let service: SchedulerService;
  let mockIdempotencyService: any;
  let mockUserRepo: any;
  let mockMessageLogRepo: any;
  let mockStrategyFactory: any;
  let mockBirthdayStrategy: any;
  let mockAnniversaryStrategy: any;

  const mockUser: User = {
    id: '123e4567-e89b-12d3-a456-426614174000',
    firstName: 'John',
    lastName: 'Doe',
    email: 'john.doe@example.com',
    timezone: 'America/New_York',
    birthdayDate: new Date('1990-12-30'),
    anniversaryDate: new Date('2015-05-15'),
    locationCity: 'New York',
    locationCountry: 'USA',
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
  };

  const mockMessageLog: MessageLog = {
    id: 'msg-123',
    userId: mockUser.id,
    messageType: 'BIRTHDAY',
    messageContent: 'Hey John, happy birthday!',
    status: MessageStatus.SCHEDULED,
    scheduledSendTime: new Date(),
    idempotencyKey: 'idem-key-123',
    retryCount: 0,
    sentAt: null,
    sentResponse: null,
    failedAt: null,
    failureReason: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(() => {
    // Reset all mocks
    vi.resetAllMocks();

    // Create mock idempotency service
    mockIdempotencyService = {
      generateKey: vi.fn().mockReturnValue('idem-key-123'),
    };

    // Create mock user repository (for scheduleUserBirthday which uses _userRepo.findById)
    mockUserRepo = {
      findById: vi.fn().mockResolvedValue(mockUser),
      findBirthdaysToday: vi.fn().mockResolvedValue([mockUser]),
      findAnniversariesToday: vi.fn().mockResolvedValue([mockUser]),
    };

    // Create mock message log repository
    mockMessageLogRepo = {
      create: vi.fn().mockResolvedValue(mockMessageLog),
      findById: vi.fn().mockResolvedValue(mockMessageLog),
      checkIdempotency: vi.fn().mockResolvedValue(null),
      findScheduled: vi.fn().mockResolvedValue([mockMessageLog]),
      findMissed: vi.fn().mockResolvedValue([]),
      findAll: vi.fn().mockResolvedValue([mockMessageLog]),
      updateStatus: vi.fn().mockResolvedValue(undefined),
    };

    // Create mock birthday strategy
    mockBirthdayStrategy = {
      messageType: 'BIRTHDAY',
      validate: vi.fn().mockReturnValue({ valid: true, errors: [] }),
      shouldSend: vi.fn().mockResolvedValue(true),
      calculateSendTime: vi.fn().mockReturnValue(new Date()),
      composeMessage: vi.fn().mockResolvedValue('Hey John, happy birthday!'),
    };

    // Create mock anniversary strategy
    mockAnniversaryStrategy = {
      messageType: 'ANNIVERSARY',
      validate: vi.fn().mockReturnValue({ valid: true, errors: [] }),
      shouldSend: vi.fn().mockResolvedValue(true),
      calculateSendTime: vi.fn().mockReturnValue(new Date()),
      composeMessage: vi.fn().mockResolvedValue('Hey John, happy work anniversary!'),
    };

    // Create mock strategy factory
    mockStrategyFactory = {
      getAllStrategies: vi.fn().mockReturnValue([mockBirthdayStrategy, mockAnniversaryStrategy]),
      get: vi.fn().mockImplementation((type: string) => {
        if (type === 'BIRTHDAY') return mockBirthdayStrategy;
        if (type === 'ANNIVERSARY') return mockAnniversaryStrategy;
        throw new Error(`Unknown strategy type: ${type}`);
      }),
    };

    // Create service with mocked dependencies
    // Constructor order: idempotencyService, userRepo, cachedUserRepo, messageLogRepo, strategyFactory
    // Note: mockUserRepo serves as both _userRepo and _cachedUserRepo since they share findBirthdaysToday/findAnniversariesToday
    service = new SchedulerService(
      mockIdempotencyService,
      mockUserRepo,       // _userRepo (for scheduleUserBirthday)
      mockUserRepo,       // _cachedUserRepo (for preCalculateTodaysBirthdays - needs findBirthdaysToday/findAnniversariesToday)
      mockMessageLogRepo, // _messageLogRepo (for findScheduled, findMissed, findAll, etc.)
      mockStrategyFactory
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('preCalculateTodaysBirthdays', () => {
    it('should return precalculation statistics', async () => {
      const stats = await service.preCalculateTodaysBirthdays();

      expect(stats).toHaveProperty('totalBirthdays');
      expect(stats).toHaveProperty('totalAnniversaries');
      expect(stats).toHaveProperty('messagesScheduled');
      expect(stats).toHaveProperty('duplicatesSkipped');
      expect(stats).toHaveProperty('errors');
    });

    it('should get all strategies from factory', async () => {
      await service.preCalculateTodaysBirthdays();

      expect(mockStrategyFactory.getAllStrategies).toHaveBeenCalled();
    });

    it('should find birthday users', async () => {
      await service.preCalculateTodaysBirthdays();

      expect(mockUserRepo.findBirthdaysToday).toHaveBeenCalled();
    });

    it('should find anniversary users', async () => {
      await service.preCalculateTodaysBirthdays();

      expect(mockUserRepo.findAnniversariesToday).toHaveBeenCalled();
    });

    it('should validate users using strategy', async () => {
      await service.preCalculateTodaysBirthdays();

      expect(mockBirthdayStrategy.validate).toHaveBeenCalled();
    });

    it('should skip users that fail validation', async () => {
      mockBirthdayStrategy.validate.mockReturnValue({
        valid: false,
        errors: ['Missing birthday date'],
      });

      const stats = await service.preCalculateTodaysBirthdays();

      // User should be skipped, no message created
      expect(mockBirthdayStrategy.shouldSend).not.toHaveBeenCalled();
    });

    it('should check shouldSend for each user', async () => {
      await service.preCalculateTodaysBirthdays();

      expect(mockBirthdayStrategy.shouldSend).toHaveBeenCalled();
    });

    it('should skip users when shouldSend returns false', async () => {
      mockBirthdayStrategy.shouldSend.mockResolvedValue(false);

      const stats = await service.preCalculateTodaysBirthdays();

      expect(mockBirthdayStrategy.calculateSendTime).not.toHaveBeenCalled();
    });

    it('should generate idempotency key', async () => {
      await service.preCalculateTodaysBirthdays();

      expect(mockIdempotencyService.generateKey).toHaveBeenCalled();
    });

    it('should check for existing messages', async () => {
      await service.preCalculateTodaysBirthdays();

      expect(mockMessageLogRepo.checkIdempotency).toHaveBeenCalled();
    });

    it('should skip duplicate messages', async () => {
      mockMessageLogRepo.checkIdempotency.mockResolvedValue(mockMessageLog);

      const stats = await service.preCalculateTodaysBirthdays();

      expect(stats.duplicatesSkipped).toBeGreaterThan(0);
      expect(mockMessageLogRepo.create).not.toHaveBeenCalled();
    });

    it('should compose message using strategy', async () => {
      await service.preCalculateTodaysBirthdays();

      expect(mockBirthdayStrategy.composeMessage).toHaveBeenCalled();
    });

    it('should create message log entries', async () => {
      await service.preCalculateTodaysBirthdays();

      expect(mockMessageLogRepo.create).toHaveBeenCalled();
    });

    it('should handle errors for individual users gracefully', async () => {
      mockMessageLogRepo.create.mockRejectedValueOnce(new Error('Database error'));

      const stats = await service.preCalculateTodaysBirthdays();

      expect(stats.errors).toHaveLength(1);
      expect(stats.errors[0]).toHaveProperty('userId');
      expect(stats.errors[0]).toHaveProperty('error');
    });

    it('should throw when strategy factory fails', async () => {
      mockStrategyFactory.getAllStrategies.mockImplementation(() => {
        throw new Error('Strategy factory error');
      });

      await expect(service.preCalculateTodaysBirthdays()).rejects.toThrow();
    });

    it('should count birthdays correctly', async () => {
      const stats = await service.preCalculateTodaysBirthdays();

      expect(stats.totalBirthdays).toBe(1);
    });

    it('should count anniversaries correctly', async () => {
      const stats = await service.preCalculateTodaysBirthdays();

      expect(stats.totalAnniversaries).toBe(1);
    });

    it('should handle empty user lists', async () => {
      mockUserRepo.findBirthdaysToday.mockResolvedValue([]);
      mockUserRepo.findAnniversariesToday.mockResolvedValue([]);

      const stats = await service.preCalculateTodaysBirthdays();

      expect(stats.totalBirthdays).toBe(0);
      expect(stats.totalAnniversaries).toBe(0);
      expect(stats.messagesScheduled).toBe(0);
    });
  });

  describe('enqueueUpcomingMessages', () => {
    it('should return number of enqueued messages', async () => {
      const count = await service.enqueueUpcomingMessages();

      expect(typeof count).toBe('number');
    });

    it('should find scheduled messages in next hour', async () => {
      await service.enqueueUpcomingMessages();

      expect(mockMessageLogRepo.findScheduled).toHaveBeenCalledWith(
        expect.any(Date),
        expect.any(Date)
      );
    });

    it('should update message status to QUEUED', async () => {
      await service.enqueueUpcomingMessages();

      expect(mockMessageLogRepo.updateStatus).toHaveBeenCalledWith(
        mockMessageLog.id,
        MessageStatus.QUEUED
      );
    });

    it('should handle no messages to enqueue', async () => {
      mockMessageLogRepo.findScheduled.mockResolvedValue([]);

      const count = await service.enqueueUpcomingMessages();

      expect(count).toBe(0);
      expect(mockMessageLogRepo.updateStatus).not.toHaveBeenCalled();
    });

    it('should handle multiple messages', async () => {
      const messages = [
        { ...mockMessageLog, id: 'msg-1' },
        { ...mockMessageLog, id: 'msg-2' },
        { ...mockMessageLog, id: 'msg-3' },
      ];
      mockMessageLogRepo.findScheduled.mockResolvedValue(messages);

      const count = await service.enqueueUpcomingMessages();

      expect(count).toBe(3);
      expect(mockMessageLogRepo.updateStatus).toHaveBeenCalledTimes(3);
    });

    it('should handle individual message errors gracefully', async () => {
      const messages = [
        { ...mockMessageLog, id: 'msg-1' },
        { ...mockMessageLog, id: 'msg-2' },
      ];
      mockMessageLogRepo.findScheduled.mockResolvedValue(messages);
      mockMessageLogRepo.updateStatus
        .mockResolvedValueOnce(undefined)
        .mockRejectedValueOnce(new Error('Update failed'));

      const count = await service.enqueueUpcomingMessages();

      expect(count).toBe(1);
    });

    it('should throw on database error', async () => {
      mockMessageLogRepo.findScheduled.mockRejectedValue(new Error('Database error'));

      await expect(service.enqueueUpcomingMessages()).rejects.toThrow();
    });
  });

  describe('recoverMissedMessages', () => {
    it('should return recovery statistics', async () => {
      const stats = await service.recoverMissedMessages();

      expect(stats).toHaveProperty('totalMissed');
      expect(stats).toHaveProperty('recovered');
      expect(stats).toHaveProperty('failed');
      expect(stats).toHaveProperty('errors');
    });

    it('should find missed messages', async () => {
      await service.recoverMissedMessages();

      expect(mockMessageLogRepo.findMissed).toHaveBeenCalled();
    });

    it('should handle no missed messages', async () => {
      mockMessageLogRepo.findMissed.mockResolvedValue([]);

      const stats = await service.recoverMissedMessages();

      expect(stats.totalMissed).toBe(0);
      expect(stats.recovered).toBe(0);
    });

    it('should reset messages to SCHEDULED for retry', async () => {
      const missedMessage = { ...mockMessageLog, retryCount: 1, status: MessageStatus.QUEUED };
      mockMessageLogRepo.findMissed.mockResolvedValue([missedMessage]);

      await service.recoverMissedMessages();

      expect(mockMessageLogRepo.updateStatus).toHaveBeenCalledWith(
        missedMessage.id,
        MessageStatus.SCHEDULED
      );
    });

    it('should mark messages as FAILED after max retries', async () => {
      const missedMessage = { ...mockMessageLog, retryCount: 3, status: MessageStatus.QUEUED };
      mockMessageLogRepo.findMissed.mockResolvedValue([missedMessage]);

      const stats = await service.recoverMissedMessages();

      expect(mockMessageLogRepo.updateStatus).toHaveBeenCalledWith(
        missedMessage.id,
        MessageStatus.FAILED
      );
      expect(stats.failed).toBe(1);
    });

    it('should count recovered messages', async () => {
      const missedMessages = [
        { ...mockMessageLog, id: 'msg-1', retryCount: 0 },
        { ...mockMessageLog, id: 'msg-2', retryCount: 1 },
      ];
      mockMessageLogRepo.findMissed.mockResolvedValue(missedMessages);

      const stats = await service.recoverMissedMessages();

      expect(stats.recovered).toBe(2);
    });

    it('should handle individual recovery errors', async () => {
      const missedMessage = { ...mockMessageLog, retryCount: 0 };
      mockMessageLogRepo.findMissed.mockResolvedValue([missedMessage]);
      mockMessageLogRepo.updateStatus.mockRejectedValue(new Error('Update failed'));

      const stats = await service.recoverMissedMessages();

      expect(stats.errors).toHaveLength(1);
    });

    it('should throw on database error', async () => {
      mockMessageLogRepo.findMissed.mockRejectedValue(new Error('Database error'));

      await expect(service.recoverMissedMessages()).rejects.toThrow();
    });
  });

  describe('getSchedulerStats', () => {
    it('should return scheduler statistics', async () => {
      const stats = await service.getSchedulerStats();

      expect(stats).toHaveProperty('scheduledCount');
      expect(stats).toHaveProperty('queuedCount');
      expect(stats).toHaveProperty('sentCount');
      expect(stats).toHaveProperty('failedCount');
      expect(stats).toHaveProperty('nextScheduled');
    });

    it('should count messages by status', async () => {
      await service.getSchedulerStats();

      expect(mockMessageLogRepo.findAll).toHaveBeenCalledWith(
        expect.objectContaining({
          status: MessageStatus.SCHEDULED,
        })
      );

      expect(mockMessageLogRepo.findAll).toHaveBeenCalledWith(
        expect.objectContaining({
          status: MessageStatus.QUEUED,
        })
      );

      expect(mockMessageLogRepo.findAll).toHaveBeenCalledWith(
        expect.objectContaining({
          status: MessageStatus.SENT,
        })
      );

      expect(mockMessageLogRepo.findAll).toHaveBeenCalledWith(
        expect.objectContaining({
          status: MessageStatus.FAILED,
        })
      );
    });

    it('should get next scheduled message', async () => {
      const futureDate = new Date(Date.now() + 60 * 60 * 1000);
      const futureMessage = { ...mockMessageLog, scheduledSendTime: futureDate };
      mockMessageLogRepo.findScheduled.mockResolvedValue([futureMessage]);

      const stats = await service.getSchedulerStats();

      expect(stats.nextScheduled).toEqual(futureDate);
    });

    it('should return null for nextScheduled when no messages', async () => {
      mockMessageLogRepo.findScheduled.mockResolvedValue([]);

      const stats = await service.getSchedulerStats();

      expect(stats.nextScheduled).toBeNull();
    });

    it('should throw on database error', async () => {
      mockMessageLogRepo.findAll.mockRejectedValue(new Error('Database error'));

      await expect(service.getSchedulerStats()).rejects.toThrow();
    });
  });

  describe('scheduleUserBirthday', () => {
    it('should return scheduled message for valid user', async () => {
      const result = await service.scheduleUserBirthday(mockUser.id);

      expect(result).toHaveProperty('userId');
      expect(result).toHaveProperty('messageType', 'BIRTHDAY');
      expect(result).toHaveProperty('scheduledSendTime');
      expect(result).toHaveProperty('idempotencyKey');
      expect(result).toHaveProperty('messageContent');
    });

    it('should return null for non-existent user', async () => {
      mockUserRepo.findById.mockResolvedValue(null);

      const result = await service.scheduleUserBirthday('non-existent-id');

      expect(result).toBeNull();
    });

    it('should validate user using birthday strategy', async () => {
      await service.scheduleUserBirthday(mockUser.id);

      expect(mockBirthdayStrategy.validate).toHaveBeenCalled();
    });

    it('should return null when validation fails', async () => {
      mockBirthdayStrategy.validate.mockReturnValue({
        valid: false,
        errors: ['Missing birthday'],
      });

      const result = await service.scheduleUserBirthday(mockUser.id);

      expect(result).toBeNull();
    });

    it('should return null when not users birthday', async () => {
      mockBirthdayStrategy.shouldSend.mockResolvedValue(false);

      const result = await service.scheduleUserBirthday(mockUser.id);

      expect(result).toBeNull();
    });

    it('should return null when message already exists', async () => {
      mockMessageLogRepo.checkIdempotency.mockResolvedValue(mockMessageLog);

      const result = await service.scheduleUserBirthday(mockUser.id);

      expect(result).toBeNull();
    });

    it('should create message log entry', async () => {
      await service.scheduleUserBirthday(mockUser.id);

      expect(mockMessageLogRepo.create).toHaveBeenCalled();
    });

    it('should generate idempotency key', async () => {
      await service.scheduleUserBirthday(mockUser.id);

      expect(mockIdempotencyService.generateKey).toHaveBeenCalledWith(
        mockUser.id,
        'BIRTHDAY',
        expect.any(Date),
        mockUser.timezone
      );
    });

    it('should throw on database error', async () => {
      mockUserRepo.findById.mockRejectedValue(new Error('Database error'));

      await expect(service.scheduleUserBirthday(mockUser.id)).rejects.toThrow();
    });
  });

  describe('edge cases', () => {
    it('should handle user with null timezone', async () => {
      const userWithNoTimezone = { ...mockUser, timezone: null as unknown as string };
      mockUserRepo.findBirthdaysToday.mockResolvedValue([userWithNoTimezone]);

      // Should not throw, but validation should fail
      const stats = await service.preCalculateTodaysBirthdays();
      expect(stats).toBeDefined();
    });

    it('should handle large number of users', async () => {
      const manyUsers = Array.from({ length: 100 }, (_, i) => ({
        ...mockUser,
        id: `user-${i}`,
        email: `user${i}@example.com`,
      }));
      mockUserRepo.findBirthdaysToday.mockResolvedValue(manyUsers);

      const stats = await service.preCalculateTodaysBirthdays();

      expect(stats.totalBirthdays).toBe(100);
    });

    it('should handle concurrent precalculation calls', async () => {
      const [stats1, stats2] = await Promise.all([
        service.preCalculateTodaysBirthdays(),
        service.preCalculateTodaysBirthdays(),
      ]);

      expect(stats1).toBeDefined();
      expect(stats2).toBeDefined();
    });
  });
});
