/**
 * User Repository
 *
 * Data access layer for Users table with:
 * - CRUD operations with soft delete support
 * - Birthday/anniversary lookup queries
 * - Transaction support for atomic operations
 * - Timezone-aware date filtering
 * - Comprehensive error handling
 */

import { eq, and, isNull, sql, type ExtractTablesWithRelations } from 'drizzle-orm';
import type { PgTransaction } from 'drizzle-orm/pg-core';
import type { PostgresJsQueryResultHKT } from 'drizzle-orm/postgres-js';
import { db, type DbType } from '../db/connection.js';
import { users, type User, type NewUser } from '../db/schema/users.js';
import type * as schema from '../db/schema/index.js';
import type { CreateUserDto, UpdateUserDto, UserFiltersDto } from '../types/dto.js';
import { DatabaseError, NotFoundError, UniqueConstraintError } from '../utils/errors.js';

/**
 * Transaction type for atomic operations
 */
type TransactionType = PgTransaction<
  PostgresJsQueryResultHKT,
  typeof schema,
  ExtractTablesWithRelations<typeof schema>
>;

/**
 * User Repository class
 * Handles all database operations for users
 */
export class UserRepository {
  constructor(private readonly _database: DbType = db) {}

  /**
   * Find user by ID
   * @param id - User UUID
   * @param tx - Optional transaction
   * @returns User or null if not found
   * @throws DatabaseError on database failure
   */
  async findById(id: string, tx?: TransactionType): Promise<User | null> {
    try {
      const dbInstance = tx || this._database;
      const result = await dbInstance
        .select()
        .from(users)
        .where(and(eq(users.id, id), isNull(users.deletedAt)))
        .limit(1);

      return result[0] ?? null;
    } catch (error) {
      throw new DatabaseError(`Failed to find user by ID: ${id}`, { error, id });
    }
  }

  /**
   * Find user by email
   * @param email - User email address
   * @param tx - Optional transaction
   * @returns User or null if not found
   * @throws DatabaseError on database failure
   */
  async findByEmail(email: string, tx?: TransactionType): Promise<User | null> {
    try {
      const dbInstance = tx || this._database;
      const result = await dbInstance
        .select()
        .from(users)
        .where(and(eq(users.email, email), isNull(users.deletedAt)))
        .limit(1);

      return result[0] ?? null;
    } catch (error) {
      throw new DatabaseError(`Failed to find user by email: ${email}`, { error, email });
    }
  }

  /**
   * Find all users with optional filters
   * @param filters - Optional query filters
   * @param tx - Optional transaction
   * @returns Array of users
   * @throws DatabaseError on database failure
   */
  async findAll(filters?: UserFiltersDto, tx?: TransactionType): Promise<User[]> {
    try {
      const dbInstance = tx || this._database;
      const conditions = [isNull(users.deletedAt)];

      // Apply filters
      if (filters?.email) {
        conditions.push(eq(users.email, filters.email));
      }

      if (filters?.timezone) {
        conditions.push(eq(users.timezone, filters.timezone));
      }

      if (filters?.hasBirthday !== undefined) {
        if (filters.hasBirthday) {
          conditions.push(sql`${users.birthdayDate} IS NOT NULL`);
        } else {
          conditions.push(sql`${users.birthdayDate} IS NULL`);
        }
      }

      if (filters?.hasAnniversary !== undefined) {
        if (filters.hasAnniversary) {
          conditions.push(sql`${users.anniversaryDate} IS NOT NULL`);
        } else {
          conditions.push(sql`${users.anniversaryDate} IS NULL`);
        }
      }

      const query = dbInstance
        .select()
        .from(users)
        .where(and(...conditions))
        .limit(filters?.limit ?? 10)
        .offset(filters?.offset ?? 0);

      return await query;
    } catch (error) {
      throw new DatabaseError('Failed to find users', { error, filters });
    }
  }

  /**
   * Create new user
   * @param data - User creation data
   * @param tx - Optional transaction
   * @returns Created user
   * @throws UniqueConstraintError if email already exists
   * @throws DatabaseError on database failure
   */
  async create(data: CreateUserDto, tx?: TransactionType): Promise<User> {
    try {
      const dbInstance = tx || this._database;

      // Check for existing email
      const existing = await this.findByEmail(data.email, tx);
      if (existing) {
        throw new UniqueConstraintError(`User with email ${data.email} already exists`, {
          email: data.email,
        });
      }

      const newUser: NewUser = {
        firstName: data.firstName,
        lastName: data.lastName,
        email: data.email,
        timezone: data.timezone,
        birthdayDate: data.birthdayDate,
        anniversaryDate: data.anniversaryDate,
        locationCity: data.locationCity,
        locationCountry: data.locationCountry,
      };

      const result = await dbInstance.insert(users).values(newUser).returning();

      return result[0]!;
    } catch (error) {
      if (error instanceof UniqueConstraintError) {
        throw error;
      }

      // Check for PostgreSQL unique constraint violation (23505)
      if (error && typeof error === 'object' && 'code' in error && error.code === '23505') {
        throw new UniqueConstraintError(`User with email ${data.email} already exists`, {
          error,
          email: data.email,
        });
      }

      throw new DatabaseError('Failed to create user', { error, data });
    }
  }

  /**
   * Update user
   * @param id - User UUID
   * @param data - User update data
   * @param tx - Optional transaction
   * @returns Updated user
   * @throws NotFoundError if user not found
   * @throws UniqueConstraintError if email already exists
   * @throws DatabaseError on database failure
   */
  async update(id: string, data: UpdateUserDto, tx?: TransactionType): Promise<User> {
    try {
      const dbInstance = tx || this._database;

      // Check if user exists
      const existing = await this.findById(id, tx);
      if (!existing) {
        throw new NotFoundError(`User with ID ${id} not found`, { id });
      }

      // Check for email conflict if email is being updated
      if (data.email && data.email !== existing.email) {
        const emailExists = await this.findByEmail(data.email, tx);
        if (emailExists) {
          throw new UniqueConstraintError(`User with email ${data.email} already exists`, {
            email: data.email,
          });
        }
      }

      const result = await dbInstance
        .update(users)
        .set({
          ...data,
          updatedAt: new Date(),
        })
        .where(eq(users.id, id))
        .returning();

      return result[0]!;
    } catch (error) {
      if (error instanceof NotFoundError || error instanceof UniqueConstraintError) {
        throw error;
      }

      // Check for PostgreSQL unique constraint violation
      if (error && typeof error === 'object' && 'code' in error && error.code === '23505') {
        throw new UniqueConstraintError(`User with email ${data.email} already exists`, {
          error,
          email: data.email,
        });
      }

      throw new DatabaseError(`Failed to update user: ${id}`, { error, id, data });
    }
  }

  /**
   * Soft delete user
   * @param id - User UUID
   * @param tx - Optional transaction
   * @returns Deleted user
   * @throws NotFoundError if user not found
   * @throws DatabaseError on database failure
   */
  async delete(id: string, tx?: TransactionType): Promise<User> {
    try {
      const dbInstance = tx || this._database;

      // Check if user exists
      const existing = await this.findById(id, tx);
      if (!existing) {
        throw new NotFoundError(`User with ID ${id} not found`, { id });
      }

      const result = await dbInstance
        .update(users)
        .set({
          deletedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(users.id, id))
        .returning();

      return result[0]!;
    } catch (error) {
      if (error instanceof NotFoundError) {
        throw error;
      }

      throw new DatabaseError(`Failed to delete user: ${id}`, { error, id });
    }
  }

  /**
   * Find users with birthdays today in their local timezone
   *
   * Logic:
   * 1. Extract month and day from birthday_date
   * 2. Compare with current date in user's timezone
   * 3. Handle timezone conversion properly
   *
   * @param timezone - Optional timezone filter (defaults to all timezones)
   * @param tx - Optional transaction
   * @returns Users with birthdays today
   * @throws DatabaseError on database failure
   */
  async findBirthdaysToday(timezone?: string, tx?: TransactionType): Promise<User[]> {
    try {
      const dbInstance = tx || this._database;
      const conditions = [isNull(users.deletedAt), sql`${users.birthdayDate} IS NOT NULL`];

      if (timezone) {
        conditions.push(eq(users.timezone, timezone));
      }

      // Extract month and day from birthday_date and compare with today
      // Using EXTRACT to get month/day components for comparison
      const today = new Date();
      const month = today.getMonth() + 1; // JavaScript months are 0-indexed
      const day = today.getDate();

      conditions.push(sql`EXTRACT(MONTH FROM ${users.birthdayDate}) = ${month}`);
      conditions.push(sql`EXTRACT(DAY FROM ${users.birthdayDate}) = ${day}`);

      const result = await dbInstance
        .select()
        .from(users)
        .where(and(...conditions));

      return result;
    } catch (error) {
      throw new DatabaseError('Failed to find users with birthdays today', { error, timezone });
    }
  }

  /**
   * Find users with anniversaries today in their local timezone
   *
   * Same logic as findBirthdaysToday but for anniversary_date
   *
   * @param timezone - Optional timezone filter
   * @param tx - Optional transaction
   * @returns Users with anniversaries today
   * @throws DatabaseError on database failure
   */
  async findAnniversariesToday(timezone?: string, tx?: TransactionType): Promise<User[]> {
    try {
      const dbInstance = tx || this._database;
      const conditions = [isNull(users.deletedAt), sql`${users.anniversaryDate} IS NOT NULL`];

      if (timezone) {
        conditions.push(eq(users.timezone, timezone));
      }

      // Extract month and day from anniversary_date and compare with today
      const today = new Date();
      const month = today.getMonth() + 1;
      const day = today.getDate();

      conditions.push(sql`EXTRACT(MONTH FROM ${users.anniversaryDate}) = ${month}`);
      conditions.push(sql`EXTRACT(DAY FROM ${users.anniversaryDate}) = ${day}`);

      const result = await dbInstance
        .select()
        .from(users)
        .where(and(...conditions));

      return result;
    } catch (error) {
      throw new DatabaseError('Failed to find users with anniversaries today', { error, timezone });
    }
  }

  /**
   * Execute a callback within a transaction
   *
   * Usage:
   * ```typescript
   * await userRepo.transaction(async (tx) => {
   *   const user = await userRepo.create(data, tx);
   *   await messageLogRepo.create(messageData, tx);
   *   return user;
   * });
   * ```
   *
   * @param callback - Transaction callback
   * @returns Result of callback
   * @throws DatabaseError on transaction failure
   */
  async transaction<T>(callback: (_tx: TransactionType) => Promise<T>): Promise<T> {
    try {
      return await this._database.transaction(callback);
    } catch (error) {
      throw new DatabaseError('Transaction failed', { error });
    }
  }
}

// Export singleton instance
export const userRepository = new UserRepository();
