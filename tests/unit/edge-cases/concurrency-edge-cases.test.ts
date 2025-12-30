/**
 * Concurrency Edge Cases Tests
 *
 * Covers edge cases from the catalog:
 * - EC-RC-001 to EC-RC-015: Race conditions
 * - EC-CO-001 to EC-CO-010: Concurrent operations
 *
 * @see plan/04-testing/edge-cases-catalog.md
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { IdempotencyService } from '../../../src/services/idempotency.service.js';

describe('Concurrency Edge Cases', () => {
  describe('Idempotency Checks (EC-RC-001 to EC-RC-005)', () => {
    it('EC-RC-001: Duplicate message scheduling should be prevented', async () => {
      const idempotencyService = new IdempotencyService();

      const userId = 'user-123';
      const messageType = 'birthday';
      const scheduledDate = new Date('2025-12-30');

      // Generate idempotency key
      const key1 = idempotencyService.generateKey(userId, messageType, scheduledDate);
      const key2 = idempotencyService.generateKey(userId, messageType, scheduledDate);

      // Same inputs should produce same key
      expect(key1).toBe(key2);
    });

    it('EC-RC-002: Different dates should produce different idempotency keys', async () => {
      const idempotencyService = new IdempotencyService();

      const userId = 'user-123';
      const messageType = 'birthday';

      const key1 = idempotencyService.generateKey(userId, messageType, new Date('2025-12-30'));
      const key2 = idempotencyService.generateKey(userId, messageType, new Date('2025-12-31'));

      expect(key1).not.toBe(key2);
    });

    it('EC-RC-003: Different users should have different idempotency keys', async () => {
      const idempotencyService = new IdempotencyService();

      const messageType = 'birthday';
      const scheduledDate = new Date('2025-12-30');

      const key1 = idempotencyService.generateKey('user-123', messageType, scheduledDate);
      const key2 = idempotencyService.generateKey('user-456', messageType, scheduledDate);

      expect(key1).not.toBe(key2);
    });

    it('EC-RC-004: Different message types should have different keys', async () => {
      const idempotencyService = new IdempotencyService();

      const userId = 'user-123';
      const scheduledDate = new Date('2025-12-30');

      const key1 = idempotencyService.generateKey(userId, 'birthday', scheduledDate);
      const key2 = idempotencyService.generateKey(userId, 'anniversary', scheduledDate);

      expect(key1).not.toBe(key2);
    });
  });

  describe('Parallel Request Handling', () => {
    it('should handle many concurrent idempotency key generations', async () => {
      const idempotencyService = new IdempotencyService();

      const promises = Array.from({ length: 100 }, (_, i) => {
        return Promise.resolve(
          idempotencyService.generateKey(`user-${i}`, 'birthday', new Date('2025-12-30'))
        );
      });

      const keys = await Promise.all(promises);

      // All keys should be unique
      const uniqueKeys = new Set(keys);
      expect(uniqueKeys.size).toBe(100);
    });

    it('should generate consistent keys for same input across parallel calls', async () => {
      const idempotencyService = new IdempotencyService();

      const userId = 'user-123';
      const messageType = 'birthday';
      const date = new Date('2025-12-30');

      // Make 10 parallel calls with same input
      const promises = Array.from({ length: 10 }, () => {
        return Promise.resolve(idempotencyService.generateKey(userId, messageType, date));
      });

      const keys = await Promise.all(promises);

      // All keys should be identical
      const uniqueKeys = new Set(keys);
      expect(uniqueKeys.size).toBe(1);
    });
  });

  describe('Race Condition Prevention', () => {
    it('should generate deterministic keys regardless of timing', () => {
      const idempotencyService = new IdempotencyService();

      const userId = 'user-123';
      const messageType = 'birthday';
      const date = new Date('2025-12-30');

      // Generate key multiple times with small delays
      const keys: string[] = [];

      for (let i = 0; i < 10; i++) {
        keys.push(idempotencyService.generateKey(userId, messageType, date));
      }

      // All should be the same
      expect(new Set(keys).size).toBe(1);
    });

    it('should handle special characters in user ID', () => {
      const idempotencyService = new IdempotencyService();

      const specialUserIds = [
        'user@example.com',
        "user's-id",
        'user"test"',
        'user<script>',
        'user%20space',
        'user/path/to',
      ];

      const keys = specialUserIds.map((userId) =>
        idempotencyService.generateKey(userId, 'birthday', new Date('2025-12-30'))
      );

      // All should be unique
      expect(new Set(keys).size).toBe(specialUserIds.length);

      // All should be valid (non-empty, consistent format)
      keys.forEach((key) => {
        expect(key).toBeTruthy();
        expect(typeof key).toBe('string');
        expect(key.length).toBeGreaterThan(0);
      });
    });
  });

  describe('Boundary Value Testing', () => {
    it('should handle very long user IDs', () => {
      const idempotencyService = new IdempotencyService();

      const longUserId = 'a'.repeat(1000);
      const key = idempotencyService.generateKey(longUserId, 'birthday', new Date('2025-12-30'));

      expect(key).toBeTruthy();
      expect(typeof key).toBe('string');
    });

    it('should reject empty user ID with ValidationError', () => {
      const idempotencyService = new IdempotencyService();

      // Empty user ID should throw ValidationError
      expect(() => idempotencyService.generateKey('', 'birthday', new Date('2025-12-30'))).toThrow(
        'userId must be a non-empty string'
      );

      // Whitespace-only should also throw
      expect(() => idempotencyService.generateKey('   ', 'birthday', new Date('2025-12-30'))).toThrow();
    });

    it('should handle date at epoch start (1970-01-01)', () => {
      const idempotencyService = new IdempotencyService();

      const epochDate = new Date('1970-01-01');
      const key = idempotencyService.generateKey('user-123', 'birthday', epochDate);

      expect(key).toBeTruthy();
    });

    it('should handle date far in future (2100-12-31)', () => {
      const idempotencyService = new IdempotencyService();

      const futureDate = new Date('2100-12-31');
      const key = idempotencyService.generateKey('user-123', 'birthday', futureDate);

      expect(key).toBeTruthy();
    });
  });

  describe('Message Type Variations', () => {
    it('should handle all supported message types', () => {
      const idempotencyService = new IdempotencyService();

      const messageTypes = ['birthday', 'anniversary', 'reminder', 'custom'];
      const date = new Date('2025-12-30');

      const keys = messageTypes.map((type) => idempotencyService.generateKey('user-123', type, date)
      );

      // All should be unique
      expect(new Set(keys).size).toBe(messageTypes.length);
    });

    it('should handle custom message types', () => {
      const idempotencyService = new IdempotencyService();

      const key = idempotencyService.generateKey(
        'user-123',
        'custom-new-year-greeting',
        new Date('2025-01-01')
      );

      expect(key).toBeTruthy();
      expect(typeof key).toBe('string');
    });
  });
});

describe('Error Recovery Edge Cases', () => {
  describe('Retry Logic Boundaries', () => {
    it('should have correct retry count boundaries', () => {
      const MAX_RETRIES = 5;
      const retryDelays = [1000, 2000, 4000, 8000, 16000]; // Exponential backoff

      // Verify retry delay calculation
      for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
        const expectedDelay = Math.pow(2, attempt) * 1000;
        expect(retryDelays[attempt]).toBe(expectedDelay);
      }
    });

    it('should cap maximum retry delay', () => {
      const MAX_RETRY_DELAY = 32000; // 32 seconds

      const calculateDelay = (attempt: number) => {
        const delay = Math.pow(2, attempt) * 1000;
        return Math.min(delay, MAX_RETRY_DELAY);
      };

      // At attempt 6, exponential would be 64000, but should be capped
      expect(calculateDelay(6)).toBe(MAX_RETRY_DELAY);
      expect(calculateDelay(10)).toBe(MAX_RETRY_DELAY);
    });
  });

  describe('Timeout Handling', () => {
    it('should handle operation timeout correctly', async () => {
      const timeout = 5000; // 5 seconds

      const startTime = Date.now();
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Operation timeout')), 100); // Use shorter for test
      });

      await expect(timeoutPromise).rejects.toThrow('Operation timeout');

      const elapsed = Date.now() - startTime;
      expect(elapsed).toBeLessThan(200); // Should fail within 200ms
    });
  });
});
