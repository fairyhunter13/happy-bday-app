/**
 * Cache Service
 *
 * Provides Redis caching functionality with:
 * - Generic get/set/delete operations
 * - TTL support
 * - Pattern-based deletion
 * - Connection health monitoring
 * - Metrics integration
 * - Graceful degradation (cache optional)
 *
 * Cache Strategies (from redis-caching-strategy.md):
 * - User profile cache (TTL: 1 hour)
 * - Birthdays today cache (TTL: until midnight)
 * - Scheduler stats cache (TTL: 5 minutes)
 *
 * IMPORTANT: NEVER use cache inside database transactions.
 * Always use database reads for transactional operations.
 */

import Redis, { type RedisOptions } from 'ioredis';
import { env } from '../config/environment.js';
import { logger } from '../config/logger.js';
import { metricsService } from './metrics.service.js';

/**
 * Cache operation options
 */
export interface CacheOptions {
  /** Time-to-live in seconds */
  ttl?: number;
  /** Only set if key does not exist (NX) */
  nx?: boolean;
  /** Only set if key exists (XX) */
  xx?: boolean;
}

/**
 * Cache metrics
 */
export interface CacheMetrics {
  hits: number;
  misses: number;
  hitRate: number;
  memoryUsage: number;
  connectedClients: number;
  keysCount: number;
}

/**
 * CacheService
 *
 * Redis-backed cache service with metrics and health monitoring.
 *
 * @example
 * // Get from cache
 * const user = await cacheService.get<User>('user:v1:123');
 *
 * // Set with TTL
 * await cacheService.set('user:v1:123', user, { ttl: 3600 });
 *
 * // Delete pattern
 * await cacheService.deletePattern('user:v1:*');
 */
export class CacheService {
  private client: Redis | null = null;
  private isConnected: boolean = false;
  private reconnectAttempts: number = 0;
  private readonly maxReconnectAttempts: number = 10;

  constructor() {
    this.initializeClient();
  }

  /**
   * Initialize Redis client with connection handling
   */
  private initializeClient(): void {
    try {
      // Skip if Redis is not configured
      if (!env.REDIS_URL && !env.REDIS_HOST) {
        logger.info('Redis not configured, cache will be disabled');
        return;
      }

      const redisConfig: RedisOptions = env.REDIS_URL
        ? {
            // Use connection URL if provided
            lazyConnect: true,
            retryStrategy: (times) => {
              if (times > this.maxReconnectAttempts) {
                logger.error(
                  { attempts: times },
                  'Max Redis reconnection attempts reached, giving up'
                );
                return null; // Stop retrying
              }
              const delay = Math.min(times * 50, 2000);
              logger.warn({ attempts: times, delay }, 'Retrying Redis connection');
              return delay;
            },
            maxRetriesPerRequest: 3,
            enableReadyCheck: true,
            connectTimeout: 10000,
            // Parse URL if it exists
            ...(env.REDIS_URL ? this.parseRedisUrl(env.REDIS_URL) : {}),
          }
        : {
            // Use individual config
            host: env.REDIS_HOST,
            port: env.REDIS_PORT,
            password: env.REDIS_PASSWORD,
            db: env.REDIS_DB,
            lazyConnect: true,
            retryStrategy: (times) => {
              if (times > this.maxReconnectAttempts) {
                logger.error(
                  { attempts: times },
                  'Max Redis reconnection attempts reached, giving up'
                );
                return null;
              }
              const delay = Math.min(times * 50, 2000);
              logger.warn({ attempts: times, delay }, 'Retrying Redis connection');
              return delay;
            },
            maxRetriesPerRequest: 3,
            enableReadyCheck: true,
            connectTimeout: 10000,
          };

      this.client = new Redis(redisConfig);

      // Event handlers
      this.client.on('connect', () => {
        logger.info('Redis client connecting...');
      });

      this.client.on('ready', () => {
        this.isConnected = true;
        this.reconnectAttempts = 0;
        logger.info('Redis client connected and ready');
      });

      this.client.on('error', (error) => {
        logger.error({ error: error.message }, 'Redis client error');
        // Don't throw - allow graceful degradation
      });

      this.client.on('close', () => {
        this.isConnected = false;
        logger.warn('Redis client connection closed');
      });

      this.client.on('reconnecting', () => {
        this.reconnectAttempts++;
        logger.info({ attempt: this.reconnectAttempts }, 'Redis client reconnecting');
      });

      // Attempt connection
      this.client.connect().catch((error) => {
        logger.error({ error: error.message }, 'Failed to connect to Redis');
        this.isConnected = false;
      });
    } catch (error) {
      logger.error(
        { error: error instanceof Error ? error.message : String(error) },
        'Failed to initialize Redis client'
      );
      this.client = null;
      this.isConnected = false;
    }
  }

  /**
   * Parse Redis URL into connection options
   */
  private parseRedisUrl(url: string): Partial<RedisOptions> {
    try {
      const parsed = new globalThis.URL(url);
      return {
        host: parsed.hostname,
        port: parseInt(parsed.port) || 6379,
        password: parsed.password || undefined,
        db: parsed.pathname ? parseInt(parsed.pathname.slice(1)) : 0,
      };
    } catch (error) {
      logger.error(
        { error: error instanceof Error ? error.message : String(error), url },
        'Failed to parse Redis URL'
      );
      return {};
    }
  }

  /**
   * Get value from cache
   *
   * @param key - Cache key
   * @returns Cached value or null if not found/error
   */
  async get<T>(key: string): Promise<T | null> {
    const startTime = Date.now();

    try {
      // Return null if Redis not available
      if (!this.client || !this.isConnected) {
        logger.debug({ key }, 'Redis not available, cache miss');
        metricsService.recordCacheMiss();
        return null;
      }

      const value = await this.client.get(key);
      const duration = (Date.now() - startTime) / 1000;

      if (value) {
        logger.debug({ key, duration }, 'Cache hit');
        metricsService.recordCacheHit();
        metricsService.recordCacheOperationDuration('redis', 'get', duration);
        return JSON.parse(value) as T;
      }

      logger.debug({ key, duration }, 'Cache miss');
      metricsService.recordCacheMiss();
      metricsService.recordCacheOperationDuration('redis', 'get', duration);
      return null;
    } catch (error) {
      const duration = (Date.now() - startTime) / 1000;
      logger.error(
        { error: error instanceof Error ? error.message : String(error), key, duration },
        'Cache get error'
      );
      metricsService.recordCacheMiss();
      metricsService.recordCacheOperationDuration('redis', 'get', duration);
      return null; // Graceful degradation
    }
  }

  /**
   * Set value in cache
   *
   * @param key - Cache key
   * @param value - Value to cache
   * @param options - Cache options (TTL, etc.)
   */
  async set<T>(key: string, value: T, options?: CacheOptions): Promise<void> {
    const startTime = Date.now();

    try {
      // Skip if Redis not available
      if (!this.client || !this.isConnected) {
        logger.debug({ key }, 'Redis not available, skipping cache set');
        return;
      }

      const serialized = JSON.stringify(value);

      // Handle different set options
      if (options?.ttl) {
        if (options.nx) {
          await this.client.set(key, serialized, 'EX', options.ttl, 'NX');
        } else if (options.xx) {
          await this.client.set(key, serialized, 'EX', options.ttl, 'XX');
        } else {
          await this.client.setex(key, options.ttl, serialized);
        }
      } else {
        if (options?.nx) {
          await this.client.set(key, serialized, 'NX');
        } else if (options?.xx) {
          await this.client.set(key, serialized, 'XX');
        } else {
          await this.client.set(key, serialized);
        }
      }

      const duration = (Date.now() - startTime) / 1000;
      logger.debug({ key, ttl: options?.ttl, duration }, 'Cache set');
      metricsService.recordCacheOperationDuration('redis', 'set', duration);
    } catch (error) {
      const duration = (Date.now() - startTime) / 1000;
      logger.error(
        { error: error instanceof Error ? error.message : String(error), key, duration },
        'Cache set error'
      );
      metricsService.recordCacheOperationDuration('redis', 'set', duration);
      // Don't throw - graceful degradation
    }
  }

  /**
   * Delete key from cache
   *
   * @param key - Cache key to delete
   * @returns Number of keys deleted
   */
  async delete(key: string): Promise<number> {
    const startTime = Date.now();

    try {
      // Skip if Redis not available
      if (!this.client || !this.isConnected) {
        logger.debug({ key }, 'Redis not available, skipping cache delete');
        return 0;
      }

      const result = await this.client.del(key);
      const duration = (Date.now() - startTime) / 1000;

      logger.debug({ key, deleted: result, duration }, 'Cache delete');
      metricsService.recordCacheOperationDuration('redis', 'delete', duration);

      return result;
    } catch (error) {
      const duration = (Date.now() - startTime) / 1000;
      logger.error(
        { error: error instanceof Error ? error.message : String(error), key, duration },
        'Cache delete error'
      );
      metricsService.recordCacheOperationDuration('redis', 'delete', duration);
      return 0;
    }
  }

  /**
   * Delete multiple keys matching a pattern
   *
   * WARNING: Use with caution in production as KEYS command can be slow.
   * For production, consider using SCAN instead.
   *
   * @param pattern - Key pattern (e.g., 'user:v1:*')
   * @returns Number of keys deleted
   */
  async deletePattern(pattern: string): Promise<number> {
    const startTime = Date.now();

    try {
      // Skip if Redis not available
      if (!this.client || !this.isConnected) {
        logger.debug({ pattern }, 'Redis not available, skipping pattern delete');
        return 0;
      }

      // Use SCAN for production-safe iteration
      let cursor = '0';
      let deletedCount = 0;

      do {
        const [nextCursor, keys] = await this.client.scan(cursor, 'MATCH', pattern, 'COUNT', 100);

        cursor = nextCursor;

        if (keys.length > 0) {
          const result = await this.client.del(...keys);
          deletedCount += result;
        }
      } while (cursor !== '0');

      const duration = (Date.now() - startTime) / 1000;

      logger.debug({ pattern, deleted: deletedCount, duration }, 'Cache pattern delete');
      metricsService.recordCacheOperationDuration('redis', 'delete', duration);

      return deletedCount;
    } catch (error) {
      const duration = (Date.now() - startTime) / 1000;
      logger.error(
        { error: error instanceof Error ? error.message : String(error), pattern, duration },
        'Cache pattern delete error'
      );
      metricsService.recordCacheOperationDuration('redis', 'delete', duration);
      return 0;
    }
  }

  /**
   * Get multiple values from cache
   *
   * @param keys - Array of cache keys
   * @returns Array of cached values (null for missing keys)
   */
  async mget<T>(keys: string[]): Promise<(T | null)[]> {
    const startTime = Date.now();

    try {
      // Return all nulls if Redis not available
      if (!this.client || !this.isConnected) {
        logger.debug({ count: keys.length }, 'Redis not available, cache miss for mget');
        keys.forEach(() => metricsService.recordCacheMiss());
        return keys.map(() => null);
      }

      const values = await this.client.mget(...keys);
      const duration = (Date.now() - startTime) / 1000;

      const results = values.map((value, _index) => {
        if (value) {
          metricsService.recordCacheHit();
          return JSON.parse(value) as T;
        }
        metricsService.recordCacheMiss();
        return null;
      });

      logger.debug(
        { count: keys.length, hits: results.filter((r) => r !== null).length, duration },
        'Cache mget'
      );
      metricsService.recordCacheOperationDuration('redis', 'mget', duration);

      return results;
    } catch (error) {
      const duration = (Date.now() - startTime) / 1000;
      logger.error(
        {
          error: error instanceof Error ? error.message : String(error),
          count: keys.length,
          duration,
        },
        'Cache mget error'
      );
      keys.forEach(() => metricsService.recordCacheMiss());
      metricsService.recordCacheOperationDuration('redis', 'mget', duration);
      return keys.map(() => null);
    }
  }

  /**
   * Check if Redis connection is healthy
   *
   * @returns True if connected and responsive
   */
  async isHealthy(): Promise<boolean> {
    try {
      if (!this.client || !this.isConnected) {
        return false;
      }

      // Ping Redis
      const result = await this.client.ping();
      return result === 'PONG';
    } catch (error) {
      logger.error(
        { error: error instanceof Error ? error.message : String(error) },
        'Redis health check failed'
      );
      return false;
    }
  }

  /**
   * Get cache metrics
   *
   * @returns Current cache metrics
   */
  async getMetrics(): Promise<CacheMetrics> {
    try {
      if (!this.client || !this.isConnected) {
        return {
          hits: 0,
          misses: 0,
          hitRate: 0,
          memoryUsage: 0,
          connectedClients: 0,
          keysCount: 0,
        };
      }

      // Get Redis INFO stats
      const info = await this.client.info('stats');
      const memory = await this.client.info('memory');
      const clients = await this.client.info('clients');

      // Parse stats from INFO output
      const parseInfoValue = (infoStr: string, key: string): number => {
        const match = infoStr.match(new RegExp(`${key}:(\\d+)`));
        return match ? parseInt(match[1] ?? '0') : 0;
      };

      const hits = parseInfoValue(info, 'keyspace_hits');
      const misses = parseInfoValue(info, 'keyspace_misses');
      const hitRate = hits + misses > 0 ? hits / (hits + misses) : 0;
      const memoryUsage = parseInfoValue(memory, 'used_memory');
      const connectedClients = parseInfoValue(clients, 'connected_clients');

      // Get total keys count
      const dbInfo = await this.client.info('keyspace');
      const dbMatch = dbInfo.match(/db\d+:keys=(\d+)/);
      const keysCount = dbMatch ? parseInt(dbMatch[1] ?? '0') : 0;

      return {
        hits,
        misses,
        hitRate,
        memoryUsage,
        connectedClients,
        keysCount,
      };
    } catch (error) {
      logger.error(
        { error: error instanceof Error ? error.message : String(error) },
        'Failed to get cache metrics'
      );
      return {
        hits: 0,
        misses: 0,
        hitRate: 0,
        memoryUsage: 0,
        connectedClients: 0,
        keysCount: 0,
      };
    }
  }

  /**
   * Calculate seconds until midnight UTC
   *
   * Used for daily cache TTL (birthdays/anniversaries)
   */
  getSecondsUntilMidnight(): number {
    const now = new Date();
    const midnight = new Date(now);
    midnight.setUTCHours(24, 0, 0, 0);
    return Math.floor((midnight.getTime() - now.getTime()) / 1000);
  }

  /**
   * Gracefully close Redis connection
   */
  async close(): Promise<void> {
    try {
      if (this.client) {
        await this.client.quit();
        logger.info('Redis client closed gracefully');
      }
    } catch (error) {
      logger.error(
        { error: error instanceof Error ? error.message : String(error) },
        'Error closing Redis client'
      );
    }
  }
}

// Export singleton instance
export const cacheService = new CacheService();
