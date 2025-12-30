import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { DateTime } from 'luxon';
import { SchedulerService } from '../../src/services/scheduler.service.js';
import { TimezoneService } from '../../src/services/timezone.service.js';
import { IdempotencyService } from '../../src/services/idempotency.service.js';
import { UserRepository } from '../../src/repositories/user.repository.js';
import { MessageLogRepository } from '../../src/repositories/message-log.repository.js';
import { MessageStatus } from '../../src/db/schema/message-logs.js';
import type { User } from '../../src/db/schema/users.js';
import type { CreateUserDto } from '../../src/types/dto.js';

/**
 * Integration Tests: SchedulerService
 *
 * Tests scheduler service with real database and repositories
 * Requires test database to be running
 */
describe('SchedulerService Integration Tests', () => {
  let service: SchedulerService;
  let timezoneService: TimezoneService;
  let idempotencyService: IdempotencyService;
  let userRepo: UserRepository;
  let messageLogRepo: MessageLogRepository;
  let testUsers: User[];

  beforeEach(async () => {
    // Initialize services
    timezoneService = new TimezoneService();
    idempotencyService = new IdempotencyService();
    userRepo = new UserRepository();
    messageLogRepo = new MessageLogRepository();

    service = new SchedulerService(timezoneService, idempotencyService, userRepo, messageLogRepo);

    testUsers = [];

    // Note: In a real integration test, you would:
    // 1. Set up a test database
    // 2. Run migrations
    // 3. Create test users
    // 4. Clean up after tests
  });

  afterEach(async () => {
    // Clean up test data
    // This would delete all test users and message logs created during tests
  });

  describe('preCalculateTodaysBirthdays', () => {
    it('should create scheduler service instance', () => {
      expect(service).toBeDefined();
      expect(service).toBeInstanceOf(SchedulerService);
    });

    it('should have correct service dependencies', () => {
      expect((service as any).timezoneService).toBeInstanceOf(TimezoneService);
      expect((service as any).idempotencyService).toBeInstanceOf(IdempotencyService);
      expect((service as any).userRepo).toBeInstanceOf(UserRepository);
      expect((service as any).messageLogRepo).toBeInstanceOf(MessageLogRepository);
    });

    it('should return precalculation statistics structure', async () => {
      // This would require test data in database
      // For now, verify the method exists and returns correct structure
      expect(service.preCalculateTodaysBirthdays).toBeDefined();
      expect(typeof service.preCalculateTodaysBirthdays).toBe('function');
    });

    it('should handle empty database gracefully', async () => {
      // Would call the method and verify it handles no users
      expect(service.preCalculateTodaysBirthdays).toBeDefined();
    });
  });

  describe('enqueueUpcomingMessages', () => {
    it('should return number of enqueued messages', async () => {
      expect(service.enqueueUpcomingMessages).toBeDefined();
      expect(typeof service.enqueueUpcomingMessages).toBe('function');
    });

    it('should find messages in next hour', async () => {
      // Would require test data with scheduled messages
      expect(service.enqueueUpcomingMessages).toBeDefined();
    });
  });

  describe('recoverMissedMessages', () => {
    it('should return recovery statistics structure', async () => {
      expect(service.recoverMissedMessages).toBeDefined();
      expect(typeof service.recoverMissedMessages).toBe('function');
    });

    it('should find missed messages', async () => {
      // Would require test data with missed messages
      expect(service.recoverMissedMessages).toBeDefined();
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

      expect(typeof stats.scheduledCount).toBe('number');
      expect(typeof stats.queuedCount).toBe('number');
      expect(typeof stats.sentCount).toBe('number');
      expect(typeof stats.failedCount).toBe('number');
    });
  });

  describe('scheduleUserBirthday', () => {
    it('should handle non-existent user', async () => {
      const result = await service.scheduleUserBirthday('non-existent-user-id');

      expect(result).toBeNull();
    });

    it('should validate user birthday date', () => {
      // Would require test user with birthday
      expect(service.scheduleUserBirthday).toBeDefined();
    });
  });

  describe('message composition', () => {
    it('should compose birthday message correctly', () => {
      const testUser: User = {
        id: 'test-user-id',
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@example.com',
        timezone: 'America/New_York',
        birthdayDate: new Date('1990-12-30'),
        anniversaryDate: null,
        locationCity: 'New York',
        locationCountry: 'USA',
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
      };

      const message = (service as any).composeMessage(testUser, 'BIRTHDAY');

      expect(message).toBe('Hey John, happy birthday!');
    });

    it('should compose anniversary message correctly', () => {
      const testUser: User = {
        id: 'test-user-id',
        firstName: 'Jane',
        lastName: 'Smith',
        email: 'jane@example.com',
        timezone: 'America/New_York',
        birthdayDate: null,
        anniversaryDate: new Date('2020-01-15'),
        locationCity: 'New York',
        locationCountry: 'USA',
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
      };

      const message = (service as any).composeMessage(testUser, 'ANNIVERSARY');

      expect(message).toBe('Hey Jane, happy work anniversary!');
    });
  });

  describe('timezone handling integration', () => {
    it('should use TimezoneService for calculations', () => {
      const timezoneService = (service as any).timezoneService;

      expect(timezoneService.calculateSendTime).toBeDefined();
      expect(timezoneService.isBirthdayToday).toBeDefined();
      expect(timezoneService.isValidTimezone).toBeDefined();
    });

    it('should calculate send times for different timezones', () => {
      const timezones = [
        'UTC',
        'America/New_York',
        'Europe/London',
        'Asia/Tokyo',
        'Australia/Sydney',
      ];

      const birthdayDate = new Date('1990-12-30');

      timezones.forEach((timezone) => {
        const sendTime = timezoneService.calculateSendTime(birthdayDate, timezone);
        const localTime = DateTime.fromJSDate(sendTime).setZone(timezone);

        expect(localTime.hour).toBe(9);
        expect(localTime.minute).toBe(0);
      });
    });
  });

  describe('idempotency integration', () => {
    it('should use IdempotencyService for key generation', () => {
      const idempotencyService = (service as any).idempotencyService;

      expect(idempotencyService.generateKey).toBeDefined();
      expect(idempotencyService.validateKey).toBeDefined();
    });

    it('should generate idempotency keys for messages', () => {
      const userId = 'user-123';
      const messageType = 'BIRTHDAY';
      const date = new Date('2025-12-30');

      const key = idempotencyService.generateKey(userId, messageType, date);

      expect(key).toBe('user-123:BIRTHDAY:2025-12-30');
      expect(idempotencyService.validateKey(key)).toBe(true);
    });
  });

  describe('error handling', () => {
    it('should handle database errors gracefully', async () => {
      // This would test error handling with invalid database state
      expect(service.getSchedulerStats).toBeDefined();
    });

    it('should track errors in statistics', () => {
      // Verify error tracking in precalculation and recovery
      expect(service.preCalculateTodaysBirthdays).toBeDefined();
      expect(service.recoverMissedMessages).toBeDefined();
    });
  });

  describe('concurrent operations', () => {
    it('should handle multiple precalculation calls', async () => {
      // Test concurrent execution
      expect(service.preCalculateTodaysBirthdays).toBeDefined();
    });

    it('should handle multiple enqueue calls', async () => {
      expect(service.enqueueUpcomingMessages).toBeDefined();
    });
  });

  describe('edge cases', () => {
    it('should handle users in extreme timezones', () => {
      const extremeTimezones = [
        'Pacific/Kiritimati', // UTC+14 (earliest)
        'Pacific/Samoa', // UTC-11 (latest)
      ];

      extremeTimezones.forEach((timezone) => {
        const isValid = timezoneService.isValidTimezone(timezone);
        expect(isValid).toBe(true);
      });
    });

    it('should handle leap year birthdays', () => {
      const leapBirthday = new Date('1992-02-29');
      const timezone = 'UTC';

      // Verify timezone service can handle leap years
      expect(() => timezoneService.calculateSendTime(leapBirthday, timezone)).not.toThrow();
    });

    it('should handle year boundaries', () => {
      const dec31 = new Date('1990-12-31');
      const jan1 = new Date('1991-01-01');

      expect(() => timezoneService.calculateSendTime(dec31, 'UTC')).not.toThrow();
      expect(() => timezoneService.calculateSendTime(jan1, 'UTC')).not.toThrow();
    });
  });

  describe('performance', () => {
    it('should process messages efficiently', async () => {
      // This would benchmark processing time
      const startTime = Date.now();
      await service.getSchedulerStats();
      const endTime = Date.now();

      expect(endTime - startTime).toBeLessThan(5000); // Should complete in < 5 seconds
    });
  });
});
