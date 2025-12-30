import { describe, it, expect, beforeEach } from 'vitest';
import { IdempotencyService } from '../../../src/services/idempotency.service.js';
import { ValidationError } from '../../../src/utils/errors.js';

/**
 * Unit Tests: IdempotencyService
 *
 * Tests idempotency key generation, parsing, and validation
 */
describe('IdempotencyService', () => {
  let service: IdempotencyService;

  beforeEach(() => {
    service = new IdempotencyService();
  });

  describe('generateKey', () => {
    it('should generate idempotency key with correct format', () => {
      const userId = 'user-123';
      const messageType = 'BIRTHDAY';
      const date = new Date('2025-12-30');

      const key = service.generateKey(userId, messageType, date);

      expect(key).toBe('user-123:BIRTHDAY:2025-12-30');
    });

    it('should generate different keys for different users', () => {
      const date = new Date('2025-12-30');
      const messageType = 'BIRTHDAY';

      const key1 = service.generateKey('user-1', messageType, date);
      const key2 = service.generateKey('user-2', messageType, date);

      expect(key1).not.toBe(key2);
      expect(key1).toBe('user-1:BIRTHDAY:2025-12-30');
      expect(key2).toBe('user-2:BIRTHDAY:2025-12-30');
    });

    it('should generate different keys for different message types', () => {
      const userId = 'user-123';
      const date = new Date('2025-12-30');

      const birthdayKey = service.generateKey(userId, 'BIRTHDAY', date);
      const anniversaryKey = service.generateKey(userId, 'ANNIVERSARY', date);

      expect(birthdayKey).not.toBe(anniversaryKey);
      expect(birthdayKey).toBe('user-123:BIRTHDAY:2025-12-30');
      expect(anniversaryKey).toBe('user-123:ANNIVERSARY:2025-12-30');
    });

    it('should generate different keys for different dates', () => {
      const userId = 'user-123';
      const messageType = 'BIRTHDAY';

      const key1 = service.generateKey(userId, messageType, new Date('2025-12-30'));
      const key2 = service.generateKey(userId, messageType, new Date('2025-12-31'));

      expect(key1).not.toBe(key2);
      expect(key1).toBe('user-123:BIRTHDAY:2025-12-30');
      expect(key2).toBe('user-123:BIRTHDAY:2025-12-31');
    });

    it('should generate same key for same inputs (deterministic)', () => {
      const userId = 'user-123';
      const messageType = 'BIRTHDAY';
      const date = new Date('2025-12-30');

      const key1 = service.generateKey(userId, messageType, date);
      const key2 = service.generateKey(userId, messageType, date);

      expect(key1).toBe(key2);
    });

    it('should handle UUID user IDs', () => {
      const userId = '123e4567-e89b-12d3-a456-426614174000';
      const messageType = 'BIRTHDAY';
      const date = new Date('2025-12-30');

      const key = service.generateKey(userId, messageType, date);

      expect(key).toBe('123e4567-e89b-12d3-a456-426614174000:BIRTHDAY:2025-12-30');
    });

    it('should use specified timezone for date formatting', () => {
      const userId = 'user-123';
      const messageType = 'BIRTHDAY';
      const date = new Date('2025-12-30T23:00:00Z'); // 11pm UTC

      const utcKey = service.generateKey(userId, messageType, date, 'UTC');
      const nyKey = service.generateKey(userId, messageType, date, 'America/New_York');

      expect(utcKey).toBe('user-123:BIRTHDAY:2025-12-30');
      expect(nyKey).toBe('user-123:BIRTHDAY:2025-12-30'); // Still Dec 30 in NY
    });

    it('should throw ValidationError for empty userId', () => {
      expect(() => service.generateKey('', 'BIRTHDAY', new Date())).toThrow(ValidationError);
    });

    it('should throw ValidationError for empty messageType', () => {
      expect(() => service.generateKey('user-123', '', new Date())).toThrow(ValidationError);
    });

    it('should throw ValidationError for invalid date', () => {
      expect(() => service.generateKey('user-123', 'BIRTHDAY', new Date('invalid'))).toThrow(
        ValidationError
      );
    });

    it('should throw ValidationError if userId contains separator', () => {
      expect(() => service.generateKey('user:123', 'BIRTHDAY', new Date('2025-12-30'))).toThrow(
        ValidationError
      );
    });

    it('should throw ValidationError if messageType contains separator', () => {
      expect(() => service.generateKey('user-123', 'BIRTH:DAY', new Date('2025-12-30'))).toThrow(
        ValidationError
      );
    });
  });

  describe('parseKey', () => {
    it('should parse valid idempotency key', () => {
      const key = 'user-123:BIRTHDAY:2025-12-30';

      const result = service.parseKey(key);

      expect(result).toEqual({
        userId: 'user-123',
        messageType: 'BIRTHDAY',
        date: '2025-12-30',
      });
    });

    it('should parse key with UUID user ID', () => {
      const key = '123e4567-e89b-12d3-a456-426614174000:BIRTHDAY:2025-12-30';

      const result = service.parseKey(key);

      expect(result).toEqual({
        userId: '123e4567-e89b-12d3-a456-426614174000',
        messageType: 'BIRTHDAY',
        date: '2025-12-30',
      });
    });

    it('should parse key with ANNIVERSARY message type', () => {
      const key = 'user-123:ANNIVERSARY:2025-12-30';

      const result = service.parseKey(key);

      expect(result).toEqual({
        userId: 'user-123',
        messageType: 'ANNIVERSARY',
        date: '2025-12-30',
      });
    });

    it('should throw ValidationError for invalid key format', () => {
      const invalidKeys = [
        'invalid-key',
        'user-123:BIRTHDAY', // Missing date
        'user-123-BIRTHDAY-2025-12-30', // Wrong separator
        '', // Empty
        'BIRTHDAY:2025-12-30', // Missing user ID
        'user-123:BIRTHDAY:invalid-date', // Invalid date format
      ];

      invalidKeys.forEach((key) => {
        expect(() => service.parseKey(key)).toThrow(ValidationError);
      });
    });
  });

  describe('validateKey', () => {
    it('should validate correct idempotency key format', () => {
      const validKeys = [
        'user-123:BIRTHDAY:2025-12-30',
        'user-456:ANNIVERSARY:2025-01-15',
        '123e4567-e89b-12d3-a456-426614174000:BIRTHDAY:2025-06-20',
        'abc:BIRTHDAY:2025-12-30',
        'user_123:BIRTHDAY:2025-12-30',
      ];

      validKeys.forEach((key) => {
        expect(service.validateKey(key)).toBe(true);
      });
    });

    it('should reject invalid idempotency key format', () => {
      const invalidKeys = [
        'invalid-key',
        'user-123:BIRTHDAY', // Missing date
        'user-123-2025-12-30', // Missing message type
        '', // Empty
        'BIRTHDAY::2025-12-30', // Empty user ID
        'user-123:BIRTHDAY:2025-13-30', // Invalid month
        'user-123:BIRTHDAY:2025-12-32', // Invalid day
        'user-123:BIRTHDAY:invalid', // Invalid date
        'user-123:BIRTHDAY:2025/12/30', // Wrong date format
      ];

      invalidKeys.forEach((key) => {
        expect(service.validateKey(key)).toBe(false);
      });
    });

    it('should handle null and undefined', () => {
      expect(service.validateKey(null as unknown as string)).toBe(false);
      expect(service.validateKey(undefined as unknown as string)).toBe(false);
    });
  });

  describe('extractDate', () => {
    it('should extract date from key', () => {
      const key = 'user-123:BIRTHDAY:2025-12-30';

      const date = service.extractDate(key);

      expect(date).toBeInstanceOf(Date);
      expect(date.getFullYear()).toBe(2025);
      expect(date.getMonth()).toBe(11); // December (0-indexed)
      expect(date.getDate()).toBe(30);
    });

    it('should throw ValidationError for invalid key', () => {
      expect(() => service.extractDate('invalid-key')).toThrow(ValidationError);
    });
  });

  describe('extractUserId', () => {
    it('should extract user ID from key', () => {
      const key = 'user-123:BIRTHDAY:2025-12-30';

      const userId = service.extractUserId(key);

      expect(userId).toBe('user-123');
    });

    it('should extract UUID user ID', () => {
      const key = '123e4567-e89b-12d3-a456-426614174000:BIRTHDAY:2025-12-30';

      const userId = service.extractUserId(key);

      expect(userId).toBe('123e4567-e89b-12d3-a456-426614174000');
    });
  });

  describe('extractMessageType', () => {
    it('should extract message type from key', () => {
      const key = 'user-123:BIRTHDAY:2025-12-30';

      const messageType = service.extractMessageType(key);

      expect(messageType).toBe('BIRTHDAY');
    });

    it('should extract ANNIVERSARY message type', () => {
      const key = 'user-123:ANNIVERSARY:2025-12-30';

      const messageType = service.extractMessageType(key);

      expect(messageType).toBe('ANNIVERSARY');
    });
  });

  describe('isSameUserAndDate', () => {
    it('should return true for same user and date, different message type', () => {
      const key1 = 'user-123:BIRTHDAY:2025-12-30';
      const key2 = 'user-123:ANNIVERSARY:2025-12-30';

      const result = service.isSameUserAndDate(key1, key2);

      expect(result).toBe(true);
    });

    it('should return false for different users', () => {
      const key1 = 'user-123:BIRTHDAY:2025-12-30';
      const key2 = 'user-456:BIRTHDAY:2025-12-30';

      const result = service.isSameUserAndDate(key1, key2);

      expect(result).toBe(false);
    });

    it('should return false for different dates', () => {
      const key1 = 'user-123:BIRTHDAY:2025-12-30';
      const key2 = 'user-123:BIRTHDAY:2025-12-31';

      const result = service.isSameUserAndDate(key1, key2);

      expect(result).toBe(false);
    });

    it('should return false for same message type', () => {
      const key1 = 'user-123:BIRTHDAY:2025-12-30';
      const key2 = 'user-123:BIRTHDAY:2025-12-30';

      const result = service.isSameUserAndDate(key1, key2);

      expect(result).toBe(false);
    });
  });

  describe('generateBulkKeys', () => {
    it('should generate keys for multiple users', () => {
      const users = ['user-1', 'user-2', 'user-3'];
      const messageType = 'BIRTHDAY';
      const date = new Date('2025-12-30');

      const keys = service.generateBulkKeys(users, messageType, date);

      expect(keys).toHaveLength(3);
      expect(keys[0]).toBe('user-1:BIRTHDAY:2025-12-30');
      expect(keys[1]).toBe('user-2:BIRTHDAY:2025-12-30');
      expect(keys[2]).toBe('user-3:BIRTHDAY:2025-12-30');
    });

    it('should handle empty array', () => {
      const keys = service.generateBulkKeys([], 'BIRTHDAY', new Date('2025-12-30'));

      expect(keys).toHaveLength(0);
    });
  });

  describe('validateBulkKeys', () => {
    it('should separate valid and invalid keys', () => {
      const keys = [
        'user-123:BIRTHDAY:2025-12-30', // Valid
        'invalid-key', // Invalid
        'user-456:ANNIVERSARY:2025-01-15', // Valid
        'user-789:BIRTHDAY', // Invalid (missing date)
      ];

      const result = service.validateBulkKeys(keys);

      expect(result.valid).toHaveLength(2);
      expect(result.invalid).toHaveLength(2);
      expect(result.valid).toContain('user-123:BIRTHDAY:2025-12-30');
      expect(result.valid).toContain('user-456:ANNIVERSARY:2025-01-15');
      expect(result.invalid).toContain('invalid-key');
      expect(result.invalid).toContain('user-789:BIRTHDAY');
    });

    it('should handle all valid keys', () => {
      const keys = ['user-123:BIRTHDAY:2025-12-30', 'user-456:ANNIVERSARY:2025-01-15'];

      const result = service.validateBulkKeys(keys);

      expect(result.valid).toHaveLength(2);
      expect(result.invalid).toHaveLength(0);
    });

    it('should handle all invalid keys', () => {
      const keys = ['invalid-key-1', 'invalid-key-2'];

      const result = service.validateBulkKeys(keys);

      expect(result.valid).toHaveLength(0);
      expect(result.invalid).toHaveLength(2);
    });

    it('should handle empty array', () => {
      const result = service.validateBulkKeys([]);

      expect(result.valid).toHaveLength(0);
      expect(result.invalid).toHaveLength(0);
    });
  });

  describe('edge cases', () => {
    it('should handle leap year dates', () => {
      const userId = 'user-123';
      const messageType = 'BIRTHDAY';
      const leapDate = new Date('2024-02-29');

      const key = service.generateKey(userId, messageType, leapDate);

      expect(key).toBe('user-123:BIRTHDAY:2024-02-29');
      expect(service.validateKey(key)).toBe(true);

      const parsed = service.parseKey(key);
      expect(parsed.date).toBe('2024-02-29');
    });

    it('should handle year boundaries', () => {
      const userId = 'user-123';
      const messageType = 'BIRTHDAY';

      const dec31 = service.generateKey(userId, messageType, new Date('2025-12-31'));
      const jan1 = service.generateKey(userId, messageType, new Date('2026-01-01'));

      expect(dec31).toBe('user-123:BIRTHDAY:2025-12-31');
      expect(jan1).toBe('user-123:BIRTHDAY:2026-01-01');
    });

    it('should handle long user IDs', () => {
      const longUserId = 'a'.repeat(100);
      const messageType = 'BIRTHDAY';
      const date = new Date('2025-12-30');

      const key = service.generateKey(longUserId, messageType, date);

      expect(key).toContain(longUserId);
      expect(service.validateKey(key)).toBe(true);
    });
  });
});
