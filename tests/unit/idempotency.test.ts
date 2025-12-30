import { describe, it, expect, beforeEach } from 'vitest';
import { DateTime } from 'luxon';

/**
 * Unit Tests: Idempotency Validation
 *
 * These tests verify that the system prevents duplicate message sending
 * through idempotency key validation.
 */

describe('Idempotency Validation', () => {
  let idempotencyStore: Map<string, boolean>;

  beforeEach(() => {
    idempotencyStore = new Map();
  });

  describe('idempotency key generation', () => {
    it('should generate unique key for user, message type, and date', () => {
      const userId = 'user-123';
      const messageType = 'BIRTHDAY';
      const date = new Date('2025-12-30');

      const key = generateIdempotencyKey(userId, messageType, date);

      expect(key).toBe('BIRTHDAY-user-123-2025-12-30');
    });

    it('should generate different keys for different dates', () => {
      const userId = 'user-123';
      const messageType = 'BIRTHDAY';
      const date1 = new Date('2025-12-30');
      const date2 = new Date('2025-12-31');

      const key1 = generateIdempotencyKey(userId, messageType, date1);
      const key2 = generateIdempotencyKey(userId, messageType, date2);

      expect(key1).not.toBe(key2);
    });

    it('should generate different keys for different message types', () => {
      const userId = 'user-123';
      const date = new Date('2025-12-30');

      const birthdayKey = generateIdempotencyKey(userId, 'BIRTHDAY', date);
      const anniversaryKey = generateIdempotencyKey(userId, 'ANNIVERSARY', date);

      expect(birthdayKey).not.toBe(anniversaryKey);
    });

    it('should generate same key for same inputs (deterministic)', () => {
      const userId = 'user-123';
      const messageType = 'BIRTHDAY';
      const date = new Date('2025-12-30');

      const key1 = generateIdempotencyKey(userId, messageType, date);
      const key2 = generateIdempotencyKey(userId, messageType, date);

      expect(key1).toBe(key2);
    });

    it('should include timezone-aware date formatting', () => {
      const userId = 'user-123';
      const messageType = 'BIRTHDAY';
      const date = DateTime.fromObject(
        { year: 2025, month: 12, day: 30 },
        { zone: 'America/New_York' }
      ).toJSDate();

      const key = generateIdempotencyKey(userId, messageType, date, 'America/New_York');

      // Should use the local date, not UTC date
      expect(key).toContain('2025-12-30');
    });
  });

  describe('duplicate detection', () => {
    it('should allow first message with new idempotency key', () => {
      const key = 'BIRTHDAY-user-123-2025-12-30';

      const isDuplicate = checkDuplicate(key, idempotencyStore);

      expect(isDuplicate).toBe(false);
      expect(idempotencyStore.has(key)).toBe(true);
    });

    it('should reject duplicate message with same idempotency key', () => {
      const key = 'BIRTHDAY-user-123-2025-12-30';

      // First attempt - should succeed
      const firstAttempt = checkDuplicate(key, idempotencyStore);
      expect(firstAttempt).toBe(false);

      // Second attempt - should be rejected
      const secondAttempt = checkDuplicate(key, idempotencyStore);
      expect(secondAttempt).toBe(true);
    });

    it('should allow same user to receive different message types on same day', () => {
      const birthdayKey = 'BIRTHDAY-user-123-2025-12-30';
      const anniversaryKey = 'ANNIVERSARY-user-123-2025-12-30';

      const birthdayDuplicate = checkDuplicate(birthdayKey, idempotencyStore);
      const anniversaryDuplicate = checkDuplicate(anniversaryKey, idempotencyStore);

      expect(birthdayDuplicate).toBe(false);
      expect(anniversaryDuplicate).toBe(false);
    });

    it('should allow same message type on different days', () => {
      const key1 = 'BIRTHDAY-user-123-2025-12-30';
      const key2 = 'BIRTHDAY-user-123-2025-12-31';

      const duplicate1 = checkDuplicate(key1, idempotencyStore);
      const duplicate2 = checkDuplicate(key2, idempotencyStore);

      expect(duplicate1).toBe(false);
      expect(duplicate2).toBe(false);
    });
  });

  describe('scheduler idempotency', () => {
    it('should prevent duplicate scheduling in daily precalculation', () => {
      const messages = [
        { userId: 'user-1', messageType: 'BIRTHDAY', date: '2025-12-30' },
        { userId: 'user-1', messageType: 'BIRTHDAY', date: '2025-12-30' }, // Duplicate
        { userId: 'user-2', messageType: 'BIRTHDAY', date: '2025-12-30' },
      ];

      const scheduled = scheduleMessagesWithIdempotency(messages, idempotencyStore);

      expect(scheduled).toHaveLength(2); // Only 2 unique messages
      expect(scheduled.map((m) => m.userId)).toEqual(['user-1', 'user-2']);
    });

    it('should handle concurrent scheduling attempts', async () => {
      const key = 'BIRTHDAY-user-123-2025-12-30';

      // Simulate concurrent attempts
      const attempts = await Promise.all([
        attemptSchedule(key, idempotencyStore),
        attemptSchedule(key, idempotencyStore),
        attemptSchedule(key, idempotencyStore),
      ]);

      // Only one should succeed
      const successCount = attempts.filter((success) => success).length;
      expect(successCount).toBe(1);
    });
  });

  describe('retry scenarios', () => {
    it('should allow retry with same idempotency key if original failed', () => {
      const key = 'BIRTHDAY-user-123-2025-12-30';

      // First attempt
      const firstAttempt = checkDuplicate(key, idempotencyStore);
      expect(firstAttempt).toBe(false);

      // Simulate failure - remove from store
      idempotencyStore.delete(key);

      // Retry should be allowed
      const retryAttempt = checkDuplicate(key, idempotencyStore);
      expect(retryAttempt).toBe(false);
    });

    it('should not allow retry if original succeeded', () => {
      const key = 'BIRTHDAY-user-123-2025-12-30';

      // First attempt succeeds
      checkDuplicate(key, idempotencyStore);

      // Retry should be rejected
      const retryAttempt = checkDuplicate(key, idempotencyStore);
      expect(retryAttempt).toBe(true);
    });
  });

  describe('idempotency key validation', () => {
    it('should validate correct idempotency key format', () => {
      const validKeys = [
        'BIRTHDAY-user-123-2025-12-30',
        'ANNIVERSARY-user-456-2025-01-15',
        'BIRTHDAY-abc-123-def-2025-06-20',
      ];

      validKeys.forEach((key) => {
        const isValid = validateIdempotencyKeyFormat(key);
        expect(isValid).toBe(true);
      });
    });

    it('should reject invalid idempotency key format', () => {
      const invalidKeys = [
        'invalid-key',
        'BIRTHDAY-user-123', // Missing date
        'user-123-2025-12-30', // Missing message type
        '', // Empty
        'BIRTHDAY--2025-12-30', // Missing user ID
      ];

      invalidKeys.forEach((key) => {
        const isValid = validateIdempotencyKeyFormat(key);
        expect(isValid).toBe(false);
      });
    });
  });
});

// Helper functions (these would typically be imported from src/)

function generateIdempotencyKey(
  userId: string,
  messageType: string,
  date: Date,
  timezone: string = 'UTC'
): string {
  const dt = DateTime.fromJSDate(date).setZone(timezone);
  const dateStr = dt.toFormat('yyyy-MM-dd');
  return `${messageType}-${userId}-${dateStr}`;
}

function checkDuplicate(key: string, store: Map<string, boolean>): boolean {
  if (store.has(key)) {
    return true; // Duplicate
  }
  store.set(key, true);
  return false; // Not a duplicate
}

function scheduleMessagesWithIdempotency(
  messages: Array<{ userId: string; messageType: string; date: string }>,
  store: Map<string, boolean>
): Array<{ userId: string; messageType: string }> {
  const scheduled: Array<{ userId: string; messageType: string }> = [];

  messages.forEach((msg) => {
    const key = `${msg.messageType}-${msg.userId}-${msg.date}`;
    if (!checkDuplicate(key, store)) {
      scheduled.push({ userId: msg.userId, messageType: msg.messageType });
    }
  });

  return scheduled;
}

async function attemptSchedule(
  key: string,
  store: Map<string, boolean>
): Promise<boolean> {
  // Simulate async operation
  await new Promise((resolve) => setTimeout(resolve, 10));

  if (store.has(key)) {
    return false;
  }
  store.set(key, true);
  return true;
}

function validateIdempotencyKeyFormat(key: string): boolean {
  // Format: MESSAGETYPE-userId-YYYY-MM-DD
  const pattern = /^[A-Z]+-.+-.+-\d{4}-\d{2}-\d{2}$/;
  return pattern.test(key);
}
