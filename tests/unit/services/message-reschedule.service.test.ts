import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { MessageRescheduleService } from '../../../src/services/message-reschedule.service.js';
import { MessageStatus } from '../../../src/db/schema/message-logs.js';
import { NotFoundError, DatabaseError } from '../../../src/utils/errors.js';
import type { User } from '../../../src/db/schema/users.js';
import type { MessageLog } from '../../../src/db/schema/message-logs.js';

/**
 * Unit Tests: MessageRescheduleService
 *
 * Tests message rescheduling when user data changes:
 * - Timezone changes
 * - Birthday date changes
 * - Anniversary date changes
 * - Error handling paths
 */
describe('MessageRescheduleService', () => {
  let service: MessageRescheduleService;
  let mockUserRepo: any;
  let mockMessageLogRepo: any;
  let mockTimezoneService: any;
  let mockIdempotencyService: any;

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
    scheduledSendTime: new Date(Date.now() + 60 * 60 * 1000), // 1 hour in future
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
    vi.resetAllMocks();

    // Create mock user repository
    mockUserRepo = {
      findById: vi.fn().mockResolvedValue(mockUser),
    };

    // Create mock message log repository
    mockMessageLogRepo = {
      create: vi.fn().mockResolvedValue(mockMessageLog),
      findAll: vi.fn().mockResolvedValue([mockMessageLog]),
      checkIdempotency: vi.fn().mockResolvedValue(null),
      updateStatus: vi.fn().mockResolvedValue(undefined),
    };

    // Create mock timezone service
    mockTimezoneService = {
      isBirthdayToday: vi.fn().mockReturnValue(true),
      calculateSendTime: vi.fn().mockReturnValue(new Date(Date.now() + 60 * 60 * 1000)),
      isValidTimezone: vi.fn().mockReturnValue(true),
    };

    // Create mock idempotency service
    mockIdempotencyService = {
      generateKey: vi.fn().mockReturnValue('new-idem-key-123'),
    };

    // Create service with mocked dependencies
    service = new MessageRescheduleService(
      mockUserRepo,
      mockMessageLogRepo,
      mockTimezoneService,
      mockIdempotencyService
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('rescheduleMessagesForUser', () => {
    it('should return reschedule result', async () => {
      const result = await service.rescheduleMessagesForUser(mockUser.id, {
        timezone: 'America/Los_Angeles',
      });

      expect(result).toHaveProperty('userId', mockUser.id);
      expect(result).toHaveProperty('deletedMessages');
      expect(result).toHaveProperty('rescheduledMessages');
      expect(result).toHaveProperty('errors');
      expect(result).toHaveProperty('success');
    });

    it('should throw DatabaseError wrapping NotFoundError for non-existent user', async () => {
      mockUserRepo.findById.mockResolvedValue(null);

      await expect(
        service.rescheduleMessagesForUser('non-existent-id', { timezone: 'UTC' })
      ).rejects.toThrow(DatabaseError);
    });

    it('should find future scheduled messages', async () => {
      await service.rescheduleMessagesForUser(mockUser.id, {
        timezone: 'America/Los_Angeles',
      });

      expect(mockMessageLogRepo.findAll).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: mockUser.id,
          status: MessageStatus.SCHEDULED,
        })
      );
    });

    it('should succeed with no future messages', async () => {
      mockMessageLogRepo.findAll.mockResolvedValue([]);

      const result = await service.rescheduleMessagesForUser(mockUser.id, {
        timezone: 'America/Los_Angeles',
      });

      expect(result.success).toBe(true);
      expect(result.deletedMessages).toBe(0);
      expect(result.rescheduledMessages).toBe(0);
    });

    it('should delete old scheduled messages', async () => {
      await service.rescheduleMessagesForUser(mockUser.id, {
        timezone: 'America/Los_Angeles',
      });

      expect(mockMessageLogRepo.updateStatus).toHaveBeenCalledWith(
        mockMessageLog.id,
        MessageStatus.FAILED
      );
    });

    it('should count deleted messages', async () => {
      const messages = [
        { ...mockMessageLog, id: 'msg-1' },
        { ...mockMessageLog, id: 'msg-2' },
      ];
      mockMessageLogRepo.findAll.mockResolvedValue(messages);

      const result = await service.rescheduleMessagesForUser(mockUser.id, {
        timezone: 'America/Los_Angeles',
      });

      expect(result.deletedMessages).toBe(2);
    });

    it('should check if today is birthday in new timezone', async () => {
      await service.rescheduleMessagesForUser(mockUser.id, {
        timezone: 'America/Los_Angeles',
      });

      expect(mockTimezoneService.isBirthdayToday).toHaveBeenCalled();
    });

    it('should calculate new send time', async () => {
      await service.rescheduleMessagesForUser(mockUser.id, {
        timezone: 'America/Los_Angeles',
      });

      expect(mockTimezoneService.calculateSendTime).toHaveBeenCalled();
    });

    it('should generate new idempotency key', async () => {
      await service.rescheduleMessagesForUser(mockUser.id, {
        timezone: 'America/Los_Angeles',
      });

      expect(mockIdempotencyService.generateKey).toHaveBeenCalled();
    });

    it('should create new message log entry', async () => {
      await service.rescheduleMessagesForUser(mockUser.id, {
        timezone: 'America/Los_Angeles',
      });

      expect(mockMessageLogRepo.create).toHaveBeenCalled();
    });

    it('should skip creating message if already exists', async () => {
      mockMessageLogRepo.checkIdempotency.mockResolvedValue(mockMessageLog);

      const result = await service.rescheduleMessagesForUser(mockUser.id, {
        timezone: 'America/Los_Angeles',
      });

      expect(mockMessageLogRepo.create).not.toHaveBeenCalled();
    });

    it('should not reschedule if send time is in the past', async () => {
      mockTimezoneService.calculateSendTime.mockReturnValue(
        new Date(Date.now() - 60 * 60 * 1000) // 1 hour in past
      );

      const result = await service.rescheduleMessagesForUser(mockUser.id, {
        timezone: 'America/Los_Angeles',
      });

      expect(mockMessageLogRepo.create).not.toHaveBeenCalled();
    });

    it('should handle timezone change', async () => {
      const result = await service.rescheduleMessagesForUser(mockUser.id, {
        timezone: 'Asia/Tokyo',
      });

      expect(mockTimezoneService.calculateSendTime).toHaveBeenCalledWith(
        expect.any(Date),
        'Asia/Tokyo'
      );
    });

    it('should handle birthday date change', async () => {
      const newBirthday = new Date('1992-05-25');

      const result = await service.rescheduleMessagesForUser(mockUser.id, {
        birthdayDate: newBirthday,
      });

      expect(result).toBeDefined();
    });

    it('should handle anniversary date change', async () => {
      const newAnniversary = new Date('2018-03-10');

      const result = await service.rescheduleMessagesForUser(mockUser.id, {
        anniversaryDate: newAnniversary,
      });

      expect(result).toBeDefined();
    });

    it('should handle null birthday date (remove birthday)', async () => {
      const result = await service.rescheduleMessagesForUser(mockUser.id, {
        birthdayDate: null,
      });

      expect(result.success).toBe(true);
    });

    it('should handle null anniversary date (remove anniversary)', async () => {
      const result = await service.rescheduleMessagesForUser(mockUser.id, {
        anniversaryDate: null,
      });

      expect(result.success).toBe(true);
    });

    it('should handle delete message errors', async () => {
      mockMessageLogRepo.updateStatus.mockRejectedValue(new Error('Delete failed'));

      const result = await service.rescheduleMessagesForUser(mockUser.id, {
        timezone: 'America/Los_Angeles',
      });

      expect(result.errors).toHaveLength(1);
    });

    it('should handle reschedule errors for birthday', async () => {
      mockMessageLogRepo.create.mockRejectedValue(new Error('Create failed'));

      const result = await service.rescheduleMessagesForUser(mockUser.id, {
        timezone: 'America/Los_Angeles',
      });

      expect(result.errors.some((e: any) => e.messageType === 'BIRTHDAY')).toBe(true);
    });

    it('should handle reschedule errors for anniversary', async () => {
      // First call succeeds (birthday), second fails (anniversary)
      mockMessageLogRepo.create
        .mockResolvedValueOnce(mockMessageLog)
        .mockRejectedValueOnce(new Error('Create failed'));

      const result = await service.rescheduleMessagesForUser(mockUser.id, {
        timezone: 'America/Los_Angeles',
      });

      expect(result.errors.some((e: any) => e.messageType === 'ANNIVERSARY')).toBe(true);
    });

    it('should skip birthday reschedule when not birthday today', async () => {
      mockTimezoneService.isBirthdayToday.mockReturnValue(false);

      const result = await service.rescheduleMessagesForUser(mockUser.id, {
        timezone: 'America/Los_Angeles',
      });

      // Should not call create since birthday is not today
      expect(result.rescheduledMessages).toBe(0);
    });

    it('should use existing timezone if not changed', async () => {
      await service.rescheduleMessagesForUser(mockUser.id, {
        birthdayDate: new Date('1992-05-25'),
      });

      expect(mockTimezoneService.calculateSendTime).toHaveBeenCalledWith(
        expect.any(Date),
        mockUser.timezone
      );
    });

    it('should throw DatabaseError on critical failure', async () => {
      mockUserRepo.findById.mockRejectedValue(new Error('Connection failed'));

      await expect(
        service.rescheduleMessagesForUser(mockUser.id, { timezone: 'UTC' })
      ).rejects.toThrow(DatabaseError);
    });
  });

  describe('deleteFutureMessagesForUser', () => {
    it('should return number of deleted messages', async () => {
      const count = await service.deleteFutureMessagesForUser(mockUser.id);

      expect(typeof count).toBe('number');
    });

    it('should find future scheduled messages', async () => {
      await service.deleteFutureMessagesForUser(mockUser.id);

      expect(mockMessageLogRepo.findAll).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: mockUser.id,
          status: MessageStatus.SCHEDULED,
        })
      );
    });

    it('should update status to FAILED for each message', async () => {
      const messages = [
        { ...mockMessageLog, id: 'msg-1' },
        { ...mockMessageLog, id: 'msg-2' },
      ];
      mockMessageLogRepo.findAll.mockResolvedValue(messages);

      const count = await service.deleteFutureMessagesForUser(mockUser.id);

      expect(count).toBe(2);
      expect(mockMessageLogRepo.updateStatus).toHaveBeenCalledTimes(2);
    });

    it('should return 0 when no messages to delete', async () => {
      mockMessageLogRepo.findAll.mockResolvedValue([]);

      const count = await service.deleteFutureMessagesForUser(mockUser.id);

      expect(count).toBe(0);
    });

    it('should handle individual delete errors', async () => {
      const messages = [
        { ...mockMessageLog, id: 'msg-1' },
        { ...mockMessageLog, id: 'msg-2' },
      ];
      mockMessageLogRepo.findAll.mockResolvedValue(messages);
      mockMessageLogRepo.updateStatus
        .mockResolvedValueOnce(undefined)
        .mockRejectedValueOnce(new Error('Delete failed'));

      const count = await service.deleteFutureMessagesForUser(mockUser.id);

      expect(count).toBe(1);
    });

    it('should throw DatabaseError on findAll failure', async () => {
      mockMessageLogRepo.findAll.mockRejectedValue(new Error('Database error'));

      await expect(service.deleteFutureMessagesForUser(mockUser.id)).rejects.toThrow(DatabaseError);
    });
  });

  describe('getMessageStats', () => {
    it('should return message statistics', async () => {
      const stats = await service.getMessageStats(mockUser.id);

      expect(stats).toHaveProperty('totalScheduled');
      expect(stats).toHaveProperty('birthdayMessages');
      expect(stats).toHaveProperty('anniversaryMessages');
      expect(stats).toHaveProperty('nextScheduled');
    });

    it('should count birthday messages', async () => {
      const messages = [
        { ...mockMessageLog, messageType: 'BIRTHDAY' },
        { ...mockMessageLog, messageType: 'BIRTHDAY', id: 'msg-2' },
      ];
      mockMessageLogRepo.findAll.mockResolvedValue(messages);

      const stats = await service.getMessageStats(mockUser.id);

      expect(stats.birthdayMessages).toBe(2);
    });

    it('should count anniversary messages', async () => {
      const messages = [
        { ...mockMessageLog, messageType: 'ANNIVERSARY' },
        { ...mockMessageLog, messageType: 'ANNIVERSARY', id: 'msg-2' },
        { ...mockMessageLog, messageType: 'ANNIVERSARY', id: 'msg-3' },
      ];
      mockMessageLogRepo.findAll.mockResolvedValue(messages);

      const stats = await service.getMessageStats(mockUser.id);

      expect(stats.anniversaryMessages).toBe(3);
    });

    it('should return total scheduled count', async () => {
      const messages = [
        { ...mockMessageLog, messageType: 'BIRTHDAY' },
        { ...mockMessageLog, messageType: 'ANNIVERSARY', id: 'msg-2' },
      ];
      mockMessageLogRepo.findAll.mockResolvedValue(messages);

      const stats = await service.getMessageStats(mockUser.id);

      expect(stats.totalScheduled).toBe(2);
    });

    it('should return next scheduled date', async () => {
      const earlyDate = new Date(Date.now() + 30 * 60 * 1000);
      const lateDate = new Date(Date.now() + 60 * 60 * 1000);
      const messages = [
        { ...mockMessageLog, scheduledSendTime: lateDate },
        { ...mockMessageLog, id: 'msg-2', scheduledSendTime: earlyDate },
      ];
      mockMessageLogRepo.findAll.mockResolvedValue(messages);

      const stats = await service.getMessageStats(mockUser.id);

      expect(stats.nextScheduled).toEqual(earlyDate);
    });

    it('should return null for nextScheduled when no messages', async () => {
      mockMessageLogRepo.findAll.mockResolvedValue([]);

      const stats = await service.getMessageStats(mockUser.id);

      expect(stats.nextScheduled).toBeNull();
    });

    it('should throw DatabaseError on failure', async () => {
      mockMessageLogRepo.findAll.mockRejectedValue(new Error('Database error'));

      await expect(service.getMessageStats(mockUser.id)).rejects.toThrow(DatabaseError);
    });
  });

  describe('edge cases', () => {
    it('should handle user with no birthday date', async () => {
      const userNoBirthday = { ...mockUser, birthdayDate: null };
      mockUserRepo.findById.mockResolvedValue(userNoBirthday);

      const result = await service.rescheduleMessagesForUser(mockUser.id, {
        timezone: 'UTC',
      });

      expect(result.success).toBe(true);
    });

    it('should handle user with no anniversary date', async () => {
      const userNoAnniversary = { ...mockUser, anniversaryDate: null };
      mockUserRepo.findById.mockResolvedValue(userNoAnniversary);

      const result = await service.rescheduleMessagesForUser(mockUser.id, {
        timezone: 'UTC',
      });

      expect(result.success).toBe(true);
    });

    it('should handle empty changes object', async () => {
      const result = await service.rescheduleMessagesForUser(mockUser.id, {});

      expect(result).toBeDefined();
    });

    it('should handle multiple simultaneous changes', async () => {
      const result = await service.rescheduleMessagesForUser(mockUser.id, {
        timezone: 'Europe/London',
        birthdayDate: new Date('1992-01-15'),
        anniversaryDate: new Date('2020-06-20'),
      });

      expect(result).toBeDefined();
    });
  });
});
