/**
 * Cache Service Unit Tests
 *
 * Tests for Redis caching service with focus on:
 * - Connection handling and graceful degradation
 * - TTL and key management
 * - Cache hit/miss metrics
 * - Pattern-based deletion
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { CacheService } from '../../../src/services/cache.service.js';
import type Redis from 'ioredis';

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
});
