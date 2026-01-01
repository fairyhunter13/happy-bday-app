/**
 * Cached User Repository
 *
 * Wrapper around UserRepository that adds Redis caching layer.
 *
 * Cache Strategy (as defined in redis-caching-strategy.md):
 * - User by ID: 1 hour TTL, eventual consistency
 * - User by Email: 1 hour TTL, eventual consistency
 * - Birthdays Today: Until midnight UTC, weak consistency
 * - Anniversaries Today: Until midnight UTC, weak consistency
 *
 * IMPORTANT RULES:
 * 1. NEVER use cached data within database transactions
 * 2. ALWAYS read from database for transactional operations
 * 3. Invalidate cache AFTER transaction commits (not during)
 * 4. Use appropriate consistency model for each operation
 *
 * @example
 * // For non-transactional reads (controllers, read-only operations)
 * const user = await cachedUserRepo.findById(id);
 *
 * // For transactional operations (use UserRepository directly)
 * await db.transaction(async (tx) => {
 *   const user = await userRepo.findById(id, tx); // NO CACHE
 * });
 */

import { cacheService, type CacheService } from '../services/cache.service.js';
import { userRepository, type UserRepository } from './user.repository.js';
import type { User } from '../db/schema/users.js';
import type { CreateUserDto, UpdateUserDto, UserFiltersDto } from '../types/dto.js';
import { logger } from '../config/logger.js';
import { metricsService } from '../services/metrics.service.js';

/**
 * Cache key versioning for safe migrations
 * Increment version when cache structure changes
 */
const CACHE_VERSION = 'v1';

/**
 * Cache TTLs (in seconds)
 */
const CACHE_TTL = {
  USER: 3600, // 1 hour
  BIRTHDAYS_TODAY: 0, // Calculated dynamically (until midnight)
  ANNIVERSARIES_TODAY: 0, // Calculated dynamically (until midnight)
} as const;

/**
 * CachedUserRepository
 *
 * Provides caching layer for user operations with proper consistency guarantees.
 */
export class CachedUserRepository {
  constructor(
    private readonly _userRepo: UserRepository = userRepository,
    private readonly _cache: CacheService = cacheService
  ) {
    logger.info('CachedUserRepository initialized');
  }

  /**
   * Get cache key for user by ID
   */
  private getUserCacheKey(userId: string): string {
    return `user:${CACHE_VERSION}:${userId}`;
  }

  /**
   * Get cache key for user by email
   */
  private getUserEmailCacheKey(email: string): string {
    return `user:email:${CACHE_VERSION}:${email}`;
  }

  /**
   * Get cache key for birthdays today
   */
  private getBirthdaysTodayCacheKey(): string {
    return `birthdays:today:${CACHE_VERSION}`;
  }

  /**
   * Get cache key for anniversaries today
   */
  private getAnniversariesTodayCacheKey(): string {
    return `anniversaries:today:${CACHE_VERSION}`;
  }

  /**
   * Find user by ID with caching
   *
   * Uses eventual consistency - safe for non-transactional reads.
   * DO NOT use within database transactions.
   *
   * @param id - User UUID
   * @returns User or null if not found
   */
  async findById(id: string): Promise<User | null> {
    const cacheKey = this.getUserCacheKey(id);

    // Try cache first
    const cached = await this._cache.get<User>(cacheKey);
    if (cached) {
      logger.debug({ id, source: 'cache' }, 'User found in cache');
      return cached;
    }

    // Cache miss - fetch from database
    const user = await this._userRepo.findById(id);

    if (user) {
      // Warm cache for next request
      await this._cache.set(cacheKey, user, { ttl: CACHE_TTL.USER });
      logger.debug({ id, source: 'database' }, 'User cached from database');
    }

    return user;
  }

  /**
   * Find user by email with caching
   *
   * Uses eventual consistency - safe for non-transactional reads.
   * DO NOT use within database transactions.
   *
   * @param email - User email
   * @returns User or null if not found
   */
  async findByEmail(email: string): Promise<User | null> {
    const cacheKey = this.getUserEmailCacheKey(email);

    // Try cache first
    const cached = await this._cache.get<User>(cacheKey);
    if (cached) {
      logger.debug({ email, source: 'cache' }, 'User found in cache by email');
      return cached;
    }

    // Cache miss - fetch from database
    const user = await this._userRepo.findByEmail(email);

    if (user) {
      // Cache both email and ID lookups
      await this._cache.set(cacheKey, user, { ttl: CACHE_TTL.USER });
      await this._cache.set(this.getUserCacheKey(user.id), user, { ttl: CACHE_TTL.USER });
      logger.debug({ email, source: 'database' }, 'User cached from database by email');
    }

    return user;
  }

  /**
   * Find all users with optional filters
   *
   * NOTE: This operation is NOT cached as it can return different results
   * based on filters and is typically used for admin operations.
   *
   * @param filters - Optional query filters
   * @returns Array of users
   */
  findAll(filters?: UserFiltersDto): Promise<User[]> {
    // No caching for list operations (too many permutations)
    return this._userRepo.findAll(filters);
  }

  /**
   * Find users with birthdays today with caching
   *
   * Uses weak consistency with daily refresh.
   * Cache expires at midnight UTC when new day begins.
   *
   * @param timezone - Optional timezone filter
   * @returns Users with birthdays today
   */
  async findBirthdaysToday(timezone?: string): Promise<User[]> {
    // Only cache when no timezone filter (global birthday list)
    if (timezone) {
      // Timezone-specific queries are not cached
      return this._userRepo.findBirthdaysToday(timezone);
    }

    const cacheKey = this.getBirthdaysTodayCacheKey();

    // Try cache first
    const cached = await this._cache.get<User[]>(cacheKey);
    if (cached) {
      logger.debug({ count: cached.length, source: 'cache' }, 'Birthdays today found in cache');
      metricsService.recordBirthdayScheduledToday('UTC', 'BIRTHDAY');
      return cached;
    }

    // Cache miss - fetch from database
    const users = await this._userRepo.findBirthdaysToday();

    if (users.length > 0) {
      // Cache until midnight UTC
      const ttl = this._cache.getSecondsUntilMidnight();
      await this._cache.set(cacheKey, users, { ttl });
      logger.debug(
        { count: users.length, ttl, source: 'database' },
        'Birthdays today cached from database'
      );
    }

    return users;
  }

  /**
   * Find users with anniversaries today with caching
   *
   * Uses weak consistency with daily refresh.
   * Cache expires at midnight UTC when new day begins.
   *
   * @param timezone - Optional timezone filter
   * @returns Users with anniversaries today
   */
  async findAnniversariesToday(timezone?: string): Promise<User[]> {
    // Only cache when no timezone filter (global anniversary list)
    if (timezone) {
      // Timezone-specific queries are not cached
      return this._userRepo.findAnniversariesToday(timezone);
    }

    const cacheKey = this.getAnniversariesTodayCacheKey();

    // Try cache first
    const cached = await this._cache.get<User[]>(cacheKey);
    if (cached) {
      logger.debug({ count: cached.length, source: 'cache' }, 'Anniversaries today found in cache');
      metricsService.recordBirthdayScheduledToday('UTC', 'ANNIVERSARY');
      return cached;
    }

    // Cache miss - fetch from database
    const users = await this._userRepo.findAnniversariesToday();

    if (users.length > 0) {
      // Cache until midnight UTC
      const ttl = this._cache.getSecondsUntilMidnight();
      await this._cache.set(cacheKey, users, { ttl });
      logger.debug(
        { count: users.length, ttl, source: 'database' },
        'Anniversaries today cached from database'
      );
    }

    return users;
  }

  /**
   * Create new user
   *
   * NOTE: Does NOT use cache for creation (strong consistency required).
   * Optionally warms cache after successful creation.
   *
   * @param data - User creation data
   * @returns Created user
   */
  async create(data: CreateUserDto): Promise<User> {
    // Create in database (no cache)
    const user = await this._userRepo.create(data);

    // Optionally warm cache after creation
    await this.warmCache(user);

    return user;
  }

  /**
   * Update user
   *
   * NOTE: Does NOT use cache for update (strong consistency required).
   * Invalidates cache after successful update.
   *
   * @param id - User UUID
   * @param data - User update data
   * @returns Updated user
   */
  async update(id: string, data: UpdateUserDto): Promise<User> {
    // Get old user data for cache invalidation
    const oldUser = await this._userRepo.findById(id);

    // Update in database (no cache)
    const updatedUser = await this._userRepo.update(id, data);

    // Invalidate cache after update
    await this.invalidateUser(id, oldUser?.email, data.email);

    // If birthday/anniversary dates changed, invalidate daily caches
    if (
      data.birthdayDate !== undefined ||
      data.anniversaryDate !== undefined ||
      oldUser?.birthdayDate !== updatedUser.birthdayDate ||
      oldUser?.anniversaryDate !== updatedUser.anniversaryDate
    ) {
      await this.invalidateDailyCaches();
    }

    return updatedUser;
  }

  /**
   * Soft delete user
   *
   * NOTE: Does NOT use cache for deletion (strong consistency required).
   * Invalidates cache after successful deletion.
   *
   * @param id - User UUID
   * @returns Deleted user
   */
  async delete(id: string): Promise<User> {
    // Get user data for cache invalidation
    const user = await this._userRepo.findById(id);

    // Delete in database (no cache)
    const deletedUser = await this._userRepo.delete(id);

    // Invalidate cache after deletion
    await this.invalidateUser(id, user?.email);

    // Invalidate daily caches (user won't receive messages anymore)
    await this.invalidateDailyCaches();

    return deletedUser;
  }

  /**
   * Warm cache for a user
   *
   * Useful after creation or when you know the user will be accessed soon.
   *
   * @param user - User to cache
   */
  async warmCache(user: User): Promise<void> {
    try {
      const userKey = this.getUserCacheKey(user.id);
      const emailKey = this.getUserEmailCacheKey(user.email);

      await this._cache.set(userKey, user, { ttl: CACHE_TTL.USER });
      await this._cache.set(emailKey, user, { ttl: CACHE_TTL.USER });

      logger.debug({ userId: user.id, email: user.email }, 'User cache warmed');
    } catch (error) {
      // Log but don't throw - cache warming is non-critical
      logger.warn(
        { userId: user.id, error: error instanceof Error ? error.message : String(error) },
        'Failed to warm user cache'
      );
    }
  }

  /**
   * Invalidate user cache
   *
   * Call this AFTER transaction commits.
   * Removes both ID and email cache entries.
   *
   * @param userId - User ID
   * @param oldEmail - Old email (if email was changed)
   * @param newEmail - New email (if email was changed)
   */
  async invalidateUser(userId: string, oldEmail?: string, newEmail?: string): Promise<void> {
    try {
      const keysToDelete: string[] = [this.getUserCacheKey(userId)];

      if (oldEmail) {
        keysToDelete.push(this.getUserEmailCacheKey(oldEmail));
      }

      if (newEmail && newEmail !== oldEmail) {
        keysToDelete.push(this.getUserEmailCacheKey(newEmail));
      }

      // Delete all keys
      await Promise.all(keysToDelete.map((key) => this._cache.delete(key)));

      logger.debug({ userId, keys: keysToDelete }, 'User cache invalidated');
    } catch (error) {
      // Log but don't throw - cache invalidation failure is non-critical
      logger.warn(
        {
          userId,
          error: error instanceof Error ? error.message : String(error),
        },
        'Failed to invalidate user cache'
      );
    }
  }

  /**
   * Invalidate daily birthday/anniversary caches
   *
   * Call this when user data changes that affects birthday/anniversary lists.
   */
  async invalidateDailyCaches(): Promise<void> {
    try {
      await Promise.all([
        this._cache.delete(this.getBirthdaysTodayCacheKey()),
        this._cache.delete(this.getAnniversariesTodayCacheKey()),
      ]);

      logger.debug('Daily birthday/anniversary caches invalidated');
    } catch (error) {
      // Log but don't throw - cache invalidation failure is non-critical
      logger.warn(
        { error: error instanceof Error ? error.message : String(error) },
        'Failed to invalidate daily caches'
      );
    }
  }

  /**
   * Execute a callback within a transaction
   *
   * NOTE: Within transactions, use UserRepository methods directly (not cached).
   * This method delegates to UserRepository.transaction().
   *
   * @param callback - Transaction callback
   * @returns Result of callback
   */
  async transaction<T>(callback: Parameters<UserRepository['transaction']>[0]): Promise<T> {
    return (await this._userRepo.transaction(callback)) as T;
  }
}

// Export singleton instance
export const cachedUserRepository = new CachedUserRepository();
