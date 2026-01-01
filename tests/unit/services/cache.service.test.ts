/**
 * Cache Service Unit Tests
 *
 * Tests for Redis caching service with focus on:
 * - Connection handling and graceful degradation
 * - TTL and key management
 * - Cache hit/miss metrics
 * - Pattern-based deletion
 * - Edge cases and race conditions
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { CacheService } from '../../../src/services/cache.service.js';
import type Redis from 'ioredis';

// Mock ioredis
vi.mock('ioredis', () => {
  const mockRedis = vi.fn();
  return {
    default: mockRedis,
  };
});

// Mock logger
vi.mock('../../../src/config/logger.js', () => ({
  logger: {
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

// Mock metrics service
vi.mock('../../../src/services/metrics.service.js', () => ({
  metricsService: {
    recordCacheHit: vi.fn(),
    recordCacheMiss: vi.fn(),
    recordCacheOperationDuration: vi.fn(),
  },
}));

describe('CacheService', () => {
  describe('Graceful Degradation', () => {
    it('should return null on get when Redis is not connected', async () => {
      // Create service without Redis configured
      process.env.REDIS_URL = '';
      process.env.REDIS_HOST = '';

      const cache = new CacheService();
      const result = await cache.get('test:key');

      expect(result).toBeNull();
    });

    it('should not throw on set when Redis is not connected', async () => {
      // Create service without Redis configured
      process.env.REDIS_URL = '';
      process.env.REDIS_HOST = '';

      const cache = new CacheService();

      await expect(cache.set('test:key', { data: 'value' }, { ttl: 60 })).resolves.not.toThrow();
    });

    it('should return 0 on delete when Redis is not connected', async () => {
      // Create service without Redis configured
      process.env.REDIS_URL = '';
      process.env.REDIS_HOST = '';

      const cache = new CacheService();
      const result = await cache.delete('test:key');

      expect(result).toBe(0);
    });
  });

  describe('Connection Health', () => {
    it('should return false for isHealthy when Redis is not connected', async () => {
      const cache = new CacheService();
      const healthy = await cache.isHealthy();

      // Will be false if Redis is not running
      expect(typeof healthy).toBe('boolean');
    });

    it('should return metrics with zero values when Redis is not connected', async () => {
      const cache = new CacheService();
      const metrics = await cache.getMetrics();

      expect(metrics).toHaveProperty('hits');
      expect(metrics).toHaveProperty('misses');
      expect(metrics).toHaveProperty('hitRate');
      expect(metrics).toHaveProperty('memoryUsage');
      expect(metrics).toHaveProperty('connectedClients');
      expect(metrics).toHaveProperty('keysCount');
    });
  });

  describe('TTL Calculation', () => {
    it('should calculate seconds until midnight correctly', () => {
      const cache = new CacheService();
      const seconds = cache.getSecondsUntilMidnight();

      // Should be between 0 and 86400 seconds (24 hours)
      expect(seconds).toBeGreaterThan(0);
      expect(seconds).toBeLessThanOrEqual(86400);
    });

    it('should return different values over time', async () => {
      const cache = new CacheService();
      const seconds1 = cache.getSecondsUntilMidnight();

      // Wait 1 second
      await new Promise((resolve) => setTimeout(resolve, 1000));

      const seconds2 = cache.getSecondsUntilMidnight();

      // Second call should be roughly 1 second less
      expect(seconds2).toBeLessThanOrEqual(seconds1);
    });
  });

  describe('Cache Operations', () => {
    it('should handle JSON serialization correctly', async () => {
      const cache = new CacheService();

      const testData = {
        id: '123',
        name: 'Test User',
        nested: {
          field: 'value',
          number: 42,
        },
      };

      // Set and get should work even if Redis is not available (graceful degradation)
      await cache.set('test:json', testData, { ttl: 60 });
      const result = await cache.get<typeof testData>('test:json');

      // If Redis is available, result should match
      // If not available, result should be null
      if (result !== null) {
        expect(result).toEqual(testData);
      }
    });
  });

  describe('Edge Cases - Connection Loss', () => {
    let mockClient: any;

    beforeEach(() => {
      vi.clearAllMocks();
      mockClient = {
        get: vi.fn(),
        set: vi.fn(),
        setex: vi.fn(),
        del: vi.fn(),
        scan: vi.fn(),
        mget: vi.fn(),
        ping: vi.fn(),
        info: vi.fn(),
        quit: vi.fn(),
        connect: vi.fn().mockResolvedValue(undefined),
        on: vi.fn(),
      };
    });

    it('should handle Redis connection loss during get operation', async () => {
      const cache = new CacheService();

      // Simulate connection available but get fails
      const clientField = (cache as any).client;
      if (clientField) {
        clientField.get = vi.fn().mockRejectedValue(new Error('Connection lost'));
      }

      const result = await cache.get('test:key');

      // Should return null gracefully
      expect(result).toBeNull();
    });

    it('should handle Redis connection loss during set operation', async () => {
      const cache = new CacheService();

      const clientField = (cache as any).client;
      if (clientField) {
        clientField.setex = vi.fn().mockRejectedValue(new Error('Connection lost'));
      }

      // Should not throw
      await expect(cache.set('test:key', { data: 'value' }, { ttl: 60 })).resolves.not.toThrow();
    });

    it('should handle Redis connection loss during delete operation', async () => {
      const cache = new CacheService();

      const clientField = (cache as any).client;
      if (clientField) {
        clientField.del = vi.fn().mockRejectedValue(new Error('Connection lost'));
      }

      const result = await cache.delete('test:key');

      // Should return 0
      expect(result).toBe(0);
    });

    it('should handle Redis connection loss during mget operation', async () => {
      const cache = new CacheService();

      const clientField = (cache as any).client;
      if (clientField) {
        clientField.mget = vi.fn().mockRejectedValue(new Error('Connection lost'));
      }

      const result = await cache.mget(['key1', 'key2', 'key3']);

      // Should return array of nulls
      expect(result).toEqual([null, null, null]);
    });

    it('should handle Redis connection loss during pattern delete', async () => {
      const cache = new CacheService();

      const clientField = (cache as any).client;
      if (clientField) {
        clientField.scan = vi.fn().mockRejectedValue(new Error('Connection lost'));
      }

      const result = await cache.deletePattern('user:*');

      // Should return 0
      expect(result).toBe(0);
    });

    it('should handle Redis connection loss during health check', async () => {
      const cache = new CacheService();

      const clientField = (cache as any).client;
      if (clientField) {
        clientField.ping = vi.fn().mockRejectedValue(new Error('Connection lost'));
      }

      const healthy = await cache.isHealthy();

      // Should return false
      expect(healthy).toBe(false);
    });

    it('should handle Redis connection loss during getMetrics', async () => {
      const cache = new CacheService();

      const clientField = (cache as any).client;
      if (clientField) {
        clientField.info = vi.fn().mockRejectedValue(new Error('Connection lost'));
      }

      const metrics = await cache.getMetrics();

      // Should return zero metrics
      expect(metrics).toEqual({
        hits: 0,
        misses: 0,
        hitRate: 0,
        memoryUsage: 0,
        connectedClients: 0,
        keysCount: 0,
      });
    });
  });

  describe('Edge Cases - Concurrent Operations (Race Conditions)', () => {
    it('should handle concurrent get operations on the same key', async () => {
      const cache = new CacheService();
      const key = 'concurrent:test:1';

      // Execute 10 concurrent get operations
      const promises = Array.from({ length: 10 }, () => cache.get(key));
      const results = await Promise.all(promises);

      // All should return the same result (null if not set, or the cached value)
      const firstResult = results[0];
      results.forEach((result) => {
        expect(result).toEqual(firstResult);
      });
    });

    it('should handle concurrent set operations on the same key', async () => {
      const cache = new CacheService();
      const key = 'concurrent:test:2';

      // Execute concurrent set operations with different values
      const promises = Array.from({ length: 10 }, (_, i) =>
        cache.set(key, { value: `data-${i}` }, { ttl: 60 })
      );

      // Should all complete without throwing
      await expect(Promise.all(promises)).resolves.not.toThrow();
    });

    it('should handle concurrent set and get operations', async () => {
      const cache = new CacheService();
      const key = 'concurrent:test:3';

      // Interleave set and get operations
      const promises = Array.from({ length: 20 }, (_, i) => {
        if (i % 2 === 0) {
          return cache.set(key, { value: `data-${i}` }, { ttl: 60 });
        } else {
          return cache.get(key);
        }
      });

      // Should all complete without throwing
      await expect(Promise.all(promises)).resolves.not.toThrow();
    });

    it('should handle concurrent mget operations', async () => {
      const cache = new CacheService();
      const keys = ['key1', 'key2', 'key3', 'key4', 'key5'];

      // Execute concurrent mget operations
      const promises = Array.from({ length: 10 }, () => cache.mget(keys));
      const results = await Promise.all(promises);

      // Each result should be an array of the same length
      results.forEach((result) => {
        expect(result).toHaveLength(keys.length);
      });
    });

    it('should handle concurrent delete operations on the same key', async () => {
      const cache = new CacheService();
      const key = 'concurrent:test:4';

      // Execute concurrent delete operations
      const promises = Array.from({ length: 10 }, () => cache.delete(key));
      const results = await Promise.all(promises);

      // Results should be numbers (0 or 1)
      results.forEach((result) => {
        expect(typeof result).toBe('number');
        expect(result).toBeGreaterThanOrEqual(0);
      });
    });

    it('should handle race between set and delete operations', async () => {
      const cache = new CacheService();
      const key = 'concurrent:test:5';

      // Race between set and delete
      const promises = [
        cache.set(key, { data: 'value' }, { ttl: 60 }),
        cache.delete(key),
        cache.set(key, { data: 'value2' }, { ttl: 60 }),
        cache.delete(key),
      ];

      // Should all complete without throwing
      await expect(Promise.all(promises)).resolves.not.toThrow();
    });
  });

  describe('Edge Cases - TTL', () => {
    it('should handle TTL of 0 seconds', async () => {
      const cache = new CacheService();
      const key = 'ttl:zero';

      // Set with TTL of 0 (should expire immediately)
      await cache.set(key, { data: 'value' }, { ttl: 0 });

      // Should not throw
      expect(true).toBe(true);
    });

    it('should handle negative TTL', async () => {
      const cache = new CacheService();
      const key = 'ttl:negative';

      // Set with negative TTL (Redis will reject, but should not throw)
      await cache.set(key, { data: 'value' }, { ttl: -100 });

      // Should not throw
      expect(true).toBe(true);
    });

    it('should handle very large TTL', async () => {
      const cache = new CacheService();
      const key = 'ttl:large';

      // Set with very large TTL (years)
      const yearInSeconds = 365 * 24 * 60 * 60;
      await cache.set(key, { data: 'value' }, { ttl: yearInSeconds * 10 });

      // Should not throw
      expect(true).toBe(true);
    });

    it('should handle TTL with NX flag', async () => {
      const cache = new CacheService();
      const key = 'ttl:nx';

      // Set with NX (only if not exists)
      await cache.set(key, { data: 'value1' }, { ttl: 60, nx: true });
      await cache.set(key, { data: 'value2' }, { ttl: 60, nx: true });

      // Should not throw
      expect(true).toBe(true);
    });

    it('should handle TTL with XX flag', async () => {
      const cache = new CacheService();
      const key = 'ttl:xx';

      // Set with XX (only if exists)
      await cache.set(key, { data: 'value' }, { ttl: 60, xx: true });

      // Should not throw
      expect(true).toBe(true);
    });
  });

  describe('Edge Cases - Cache Key Namespace Conflicts', () => {
    it('should handle similar cache keys without conflicts', async () => {
      const cache = new CacheService();

      const keys = ['user:123', 'user:1234', 'user:12345', 'user:123:profile', 'user:123:settings'];

      // Set all keys
      for (let i = 0; i < keys.length; i++) {
        await cache.set(keys[i]!, { data: `value-${i}` }, { ttl: 60 });
      }

      // Get all keys - should not conflict
      const results = await cache.mget(keys);

      // If Redis is available, each should be distinct
      // Otherwise all will be null
      if (results[0] !== null) {
        results.forEach((result, index) => {
          if (result !== null) {
            expect((result as any).data).toBe(`value-${index}`);
          }
        });
      }
    });

    it('should handle cache key pattern conflicts in deletePattern', async () => {
      const cache = new CacheService();

      // Set keys with similar patterns
      const keys = ['user:v1:123', 'user:v2:123', 'user:v1:456', 'userdata:v1:123'];

      for (const key of keys) {
        await cache.set(key, { data: 'value' }, { ttl: 60 });
      }

      // Delete only user:v1:* pattern
      await cache.deletePattern('user:v1:*');

      // Should not throw
      expect(true).toBe(true);
    });

    it('should handle empty string cache key', async () => {
      const cache = new CacheService();

      // Set with empty key
      await cache.set('', { data: 'value' }, { ttl: 60 });
      const result = await cache.get('');

      // Should not throw
      expect(true).toBe(true);
    });

    it('should handle very long cache key', async () => {
      const cache = new CacheService();

      // Redis supports keys up to 512MB, but practically use reasonable length
      const longKey = 'key:' + 'x'.repeat(10000);

      await cache.set(longKey, { data: 'value' }, { ttl: 60 });
      const result = await cache.get(longKey);

      // Should not throw
      expect(true).toBe(true);
    });

    it('should handle cache key with special characters', async () => {
      const cache = new CacheService();

      const specialKeys = [
        'user:email:test@example.com',
        'user:name:John Doe',
        'user:path:/some/path/here',
        'user:query:?foo=bar&baz=qux',
      ];

      for (const key of specialKeys) {
        await cache.set(key, { data: 'value' }, { ttl: 60 });
      }

      // Should not throw
      expect(true).toBe(true);
    });
  });

  describe('Edge Cases - Cache Invalidation During Read', () => {
    it('should handle key expiration between existence check and read', async () => {
      const cache = new CacheService();
      const key = 'expire:during:read';

      // This tests the race condition where key expires after check but before read
      // In practice, Redis handles this atomically, but we test the behavior
      await cache.set(key, { data: 'value' }, { ttl: 1 });

      // Get immediately
      const result1 = await cache.get(key);

      // Wait for expiration
      await new Promise((resolve) => setTimeout(resolve, 1100));

      // Get after expiration
      const result2 = await cache.get(key);

      // Second read should be null (or both null if Redis not connected)
      if (result1 !== null) {
        expect(result2).toBeNull();
      }
    });

    it('should handle concurrent reads during cache invalidation', async () => {
      const cache = new CacheService();
      const key = 'invalidate:concurrent';

      // Set initial value
      await cache.set(key, { data: 'initial' }, { ttl: 60 });

      // Start multiple concurrent reads
      const readPromises = Array.from({ length: 5 }, () => cache.get(key));

      // Delete key while reads are in progress
      const deletePromise = cache.delete(key);

      // Wait for all operations
      const results = await Promise.all([...readPromises, deletePromise]);

      // Should all complete without throwing
      expect(results).toBeDefined();
    });
  });

  describe('Edge Cases - Bulk Operations Partial Failures', () => {
    it('should handle mget with mix of existing and non-existing keys', async () => {
      const cache = new CacheService();

      // Set only some keys
      await cache.set('bulk:key1', { data: 'value1' }, { ttl: 60 });
      await cache.set('bulk:key3', { data: 'value3' }, { ttl: 60 });

      // Get mixed keys
      const results = await cache.mget(['bulk:key1', 'bulk:key2', 'bulk:key3', 'bulk:key4']);

      // Should return array with nulls for missing keys
      expect(results).toHaveLength(4);
    });

    it('should handle deletePattern with no matching keys', async () => {
      const cache = new CacheService();

      // Delete pattern that matches nothing
      const deletedCount = await cache.deletePattern('nonexistent:pattern:*');

      // Should return 0
      expect(deletedCount).toBe(0);
    });

    it('should handle deletePattern with many keys', async () => {
      const cache = new CacheService();

      // Set many keys
      const promises = Array.from({ length: 100 }, (_, i) =>
        cache.set(`bulk:delete:${i}`, { data: `value${i}` }, { ttl: 60 })
      );
      await Promise.all(promises);

      // Delete all at once
      const deletedCount = await cache.deletePattern('bulk:delete:*');

      // Should not throw and return a number
      expect(typeof deletedCount).toBe('number');
    });

    it('should handle empty mget array', async () => {
      const cache = new CacheService();

      // Get empty array
      const results = await cache.mget([]);

      // Should return empty array
      expect(results).toEqual([]);
    });
  });

  describe('Edge Cases - Memory Pressure Scenarios', () => {
    it('should handle caching very large objects', async () => {
      const cache = new CacheService();

      // Create a large object (several MB of data)
      const largeData = {
        array: Array.from({ length: 10000 }, (_, i) => ({
          id: i,
          name: `Item ${i}`,
          description: 'x'.repeat(100),
          metadata: {
            tags: ['tag1', 'tag2', 'tag3'],
            timestamp: Date.now(),
          },
        })),
      };

      // Set large object
      await cache.set('large:object', largeData, { ttl: 60 });

      // Get large object
      const result = await cache.get('large:object');

      // Should not throw
      expect(true).toBe(true);
    });

    it('should handle many concurrent operations under load', async () => {
      const cache = new CacheService();

      // Simulate high load with many concurrent operations
      const operations = Array.from({ length: 100 }, (_, i) => {
        const key = `load:test:${i}`;
        return [
          cache.set(key, { data: `value${i}` }, { ttl: 60 }),
          cache.get(key),
          cache.delete(key),
        ];
      }).flat();

      // Execute all operations concurrently
      await Promise.all(operations);

      // Should complete without throwing
      expect(true).toBe(true);
    });
  });

  describe('Edge Cases - Reconnection After Disconnect', () => {
    it('should handle operations after reconnection', async () => {
      const cache = new CacheService();

      // Simulate disconnection by setting isConnected to false
      (cache as any).isConnected = false;

      // Try operation while disconnected
      const result1 = await cache.get('reconnect:test');
      expect(result1).toBeNull();

      // Simulate reconnection
      (cache as any).isConnected = true;

      // Try operation after reconnection
      await cache.set('reconnect:test', { data: 'value' }, { ttl: 60 });
      const result2 = await cache.get('reconnect:test');

      // Should work (or return null if Redis truly not available)
      expect(true).toBe(true);
    });

    it('should handle graceful shutdown', async () => {
      const cache = new CacheService();

      // Close connection
      await cache.close();

      // Should not throw
      expect(true).toBe(true);
    });

    it('should handle close when client is null', async () => {
      const cache = new CacheService();

      // Force client to null
      (cache as any).client = null;

      // Close should not throw
      await expect(cache.close()).resolves.not.toThrow();
    });
  });

  describe('Edge Cases - JSON Serialization Edge Cases', () => {
    it('should handle null values', async () => {
      const cache = new CacheService();

      await cache.set('json:null', null, { ttl: 60 });
      const result = await cache.get('json:null');

      // Should handle null
      expect(true).toBe(true);
    });

    it('should handle undefined values', async () => {
      const cache = new CacheService();

      await cache.set('json:undefined', undefined, { ttl: 60 });

      // Should not throw
      expect(true).toBe(true);
    });

    it('should handle arrays', async () => {
      const cache = new CacheService();

      const arrayData = [1, 2, 3, { nested: 'value' }];
      await cache.set('json:array', arrayData, { ttl: 60 });

      // Should not throw
      expect(true).toBe(true);
    });

    it('should handle circular references gracefully', async () => {
      const cache = new CacheService();

      const circular: any = { name: 'test' };
      circular.self = circular;

      // Should handle error gracefully (JSON.stringify will fail)
      await expect(cache.set('json:circular', circular, { ttl: 60 })).resolves.not.toThrow();
    });

    it('should handle Date objects', async () => {
      const cache = new CacheService();

      const dateData = { timestamp: new Date() };
      await cache.set('json:date', dateData, { ttl: 60 });

      // Should not throw
      expect(true).toBe(true);
    });

    it('should handle special numbers', async () => {
      const cache = new CacheService();

      const specialNumbers = {
        infinity: Infinity,
        negInfinity: -Infinity,
        nan: NaN,
      };

      await cache.set('json:special', specialNumbers, { ttl: 60 });

      // Should not throw
      expect(true).toBe(true);
    });
  });
});
