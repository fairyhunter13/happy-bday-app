/**
 * Unit tests for UserRepository
 *
 * Tests:
 * - CRUD operations
 * - Soft delete functionality
 * - Email uniqueness
 * - Birthday/anniversary queries
 * - Transaction support
 * - Error handling
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { UserRepository } from '../../../src/repositories/user.repository.js';
import { DatabaseError, NotFoundError, UniqueConstraintError } from '../../../src/utils/errors.js';
import { PostgresTestContainer, cleanDatabase } from '../../helpers/testcontainers.js';
import type { CreateUserDto, UpdateUserDto } from '../../../src/types/dto.js';
import { DateTime } from 'luxon';

describe('UserRepository', () => {
  let testContainer: PostgresTestContainer;
  let queryClient: ReturnType<typeof postgres>;
  let db: ReturnType<typeof drizzle>;
  let repository: UserRepository;

  beforeAll(async () => {
    // Start PostgreSQL container
    testContainer = new PostgresTestContainer();
    const { connectionString, pool } = await testContainer.start();

    // Run migrations
    await testContainer.runMigrations('./drizzle');

    // Create Drizzle instance
    queryClient = postgres(connectionString);
    db = drizzle(queryClient);
    repository = new UserRepository(db);
  });

  afterAll(async () => {
    if (queryClient) {
      await queryClient.end();
    }
    if (testContainer) {
      await testContainer.stop();
    }
  });

  beforeEach(async () => {
    // Clean database before each test
    await cleanDatabase(testContainer.getPool());
  });

  describe('findById', () => {
    it('should find user by ID', async () => {
      // Create user
      const userData: CreateUserDto = {
        firstName: 'John',
        lastName: 'Doe',
        email: 'john.doe@example.com',
        timezone: 'America/New_York',
        birthdayDate: new Date('1990-05-15'),
      };
      const created = await repository.create(userData);

      // Find by ID
      const found = await repository.findById(created.id);

      expect(found).not.toBeNull();
      expect(found?.id).toBe(created.id);
      expect(found?.email).toBe(userData.email);
      expect(found?.firstName).toBe(userData.firstName);
    });

    it('should return null for non-existent user', async () => {
      const found = await repository.findById('00000000-0000-0000-0000-000000000000');
      expect(found).toBeNull();
    });

    it('should not find soft-deleted users', async () => {
      // Create and delete user
      const userData: CreateUserDto = {
        firstName: 'Jane',
        lastName: 'Doe',
        email: 'jane.doe@example.com',
        timezone: 'Europe/London',
      };
      const created = await repository.create(userData);
      await repository.delete(created.id);

      // Try to find deleted user
      const found = await repository.findById(created.id);
      expect(found).toBeNull();
    });
  });

  describe('findByEmail', () => {
    it('should find user by email', async () => {
      const userData: CreateUserDto = {
        firstName: 'Alice',
        lastName: 'Smith',
        email: 'alice.smith@example.com',
        timezone: 'Asia/Tokyo',
      };
      await repository.create(userData);

      const found = await repository.findByEmail(userData.email);

      expect(found).not.toBeNull();
      expect(found?.email).toBe(userData.email);
    });

    it('should return null for non-existent email', async () => {
      const found = await repository.findByEmail('nonexistent@example.com');
      expect(found).toBeNull();
    });

    it('should not find soft-deleted users by email', async () => {
      const userData: CreateUserDto = {
        firstName: 'Bob',
        lastName: 'Johnson',
        email: 'bob.johnson@example.com',
        timezone: 'America/Los_Angeles',
      };
      const created = await repository.create(userData);
      await repository.delete(created.id);

      const found = await repository.findByEmail(userData.email);
      expect(found).toBeNull();
    });
  });

  describe('findAll', () => {
    it('should find all users', async () => {
      // Create multiple users
      const users: CreateUserDto[] = [
        {
          firstName: 'User1',
          lastName: 'Test',
          email: 'user1@example.com',
          timezone: 'America/New_York',
        },
        {
          firstName: 'User2',
          lastName: 'Test',
          email: 'user2@example.com',
          timezone: 'Europe/London',
        },
      ];

      for (const user of users) {
        await repository.create(user);
      }

      const found = await repository.findAll();

      expect(found).toHaveLength(2);
    });

    it('should filter by email', async () => {
      const userData: CreateUserDto = {
        firstName: 'Filter',
        lastName: 'Test',
        email: 'filter@example.com',
        timezone: 'UTC',
      };
      await repository.create(userData);

      const found = await repository.findAll({ email: 'filter@example.com' });

      expect(found).toHaveLength(1);
      expect(found[0]?.email).toBe(userData.email);
    });

    it('should filter by timezone', async () => {
      const users: CreateUserDto[] = [
        {
          firstName: 'User1',
          lastName: 'Test',
          email: 'user1@example.com',
          timezone: 'America/New_York',
        },
        {
          firstName: 'User2',
          lastName: 'Test',
          email: 'user2@example.com',
          timezone: 'Europe/London',
        },
      ];

      for (const user of users) {
        await repository.create(user);
      }

      const found = await repository.findAll({ timezone: 'America/New_York' });

      expect(found).toHaveLength(1);
      expect(found[0]?.timezone).toBe('America/New_York');
    });

    it('should filter by hasBirthday', async () => {
      const users: CreateUserDto[] = [
        {
          firstName: 'WithBday',
          lastName: 'Test',
          email: 'with@example.com',
          timezone: 'UTC',
          birthdayDate: new Date('1990-01-01'),
        },
        {
          firstName: 'WithoutBday',
          lastName: 'Test',
          email: 'without@example.com',
          timezone: 'UTC',
        },
      ];

      for (const user of users) {
        await repository.create(user);
      }

      const found = await repository.findAll({ hasBirthday: true });

      expect(found).toHaveLength(1);
      expect(found[0]?.firstName).toBe('WithBday');
    });

    it('should respect limit and offset', async () => {
      // Create 5 users
      for (let i = 0; i < 5; i++) {
        await repository.create({
          firstName: `User${i}`,
          lastName: 'Test',
          email: `user${i}@example.com`,
          timezone: 'UTC',
        });
      }

      const page1 = await repository.findAll({ limit: 2, offset: 0 });
      const page2 = await repository.findAll({ limit: 2, offset: 2 });

      expect(page1).toHaveLength(2);
      expect(page2).toHaveLength(2);
      expect(page1[0]?.email).not.toBe(page2[0]?.email);
    });
  });

  describe('create', () => {
    it('should create a new user', async () => {
      const userData: CreateUserDto = {
        firstName: 'New',
        lastName: 'User',
        email: 'new.user@example.com',
        timezone: 'America/Chicago',
        birthdayDate: new Date('1995-07-20'),
        anniversaryDate: new Date('2020-06-15'),
        locationCity: 'Chicago',
        locationCountry: 'USA',
      };

      const created = await repository.create(userData);

      expect(created.id).toBeDefined();
      expect(created.firstName).toBe(userData.firstName);
      expect(created.lastName).toBe(userData.lastName);
      expect(created.email).toBe(userData.email);
      expect(created.timezone).toBe(userData.timezone);
      expect(created.locationCity).toBe(userData.locationCity);
      expect(created.createdAt).toBeInstanceOf(Date);
      expect(created.updatedAt).toBeInstanceOf(Date);
    });

    it('should throw UniqueConstraintError for duplicate email', async () => {
      const userData: CreateUserDto = {
        firstName: 'Duplicate',
        lastName: 'Email',
        email: 'duplicate@example.com',
        timezone: 'UTC',
      };

      await repository.create(userData);

      await expect(repository.create(userData)).rejects.toThrow(UniqueConstraintError);
    });

    it('should allow email reuse after soft delete', async () => {
      const userData: CreateUserDto = {
        firstName: 'Reuse',
        lastName: 'Email',
        email: 'reuse@example.com',
        timezone: 'UTC',
      };

      const first = await repository.create(userData);
      await repository.delete(first.id);

      // Should succeed - email can be reused after soft delete
      const second = await repository.create(userData);
      expect(second.id).toBeDefined();
      expect(second.id).not.toBe(first.id);
    });
  });

  describe('update', () => {
    it('should update user fields', async () => {
      const userData: CreateUserDto = {
        firstName: 'Original',
        lastName: 'Name',
        email: 'original@example.com',
        timezone: 'UTC',
      };

      const created = await repository.create(userData);

      const updates: UpdateUserDto = {
        firstName: 'Updated',
        lastName: 'Name2',
        locationCity: 'New City',
      };

      const updated = await repository.update(created.id, updates);

      expect(updated.firstName).toBe('Updated');
      expect(updated.lastName).toBe('Name2');
      expect(updated.locationCity).toBe('New City');
      expect(updated.email).toBe(userData.email); // Unchanged
    });

    it('should update email if unique', async () => {
      const userData: CreateUserDto = {
        firstName: 'Test',
        lastName: 'User',
        email: 'old@example.com',
        timezone: 'UTC',
      };

      const created = await repository.create(userData);

      const updated = await repository.update(created.id, {
        email: 'new@example.com',
      });

      expect(updated.email).toBe('new@example.com');
    });

    it('should throw UniqueConstraintError when updating to existing email', async () => {
      const user1: CreateUserDto = {
        firstName: 'User',
        lastName: 'One',
        email: 'user1@example.com',
        timezone: 'UTC',
      };

      const user2: CreateUserDto = {
        firstName: 'User',
        lastName: 'Two',
        email: 'user2@example.com',
        timezone: 'UTC',
      };

      await repository.create(user1);
      const created2 = await repository.create(user2);

      await expect(repository.update(created2.id, { email: 'user1@example.com' })).rejects.toThrow(
        UniqueConstraintError
      );
    });

    it('should throw NotFoundError for non-existent user', async () => {
      await expect(
        repository.update('00000000-0000-0000-0000-000000000000', {
          firstName: 'Updated',
        })
      ).rejects.toThrow(NotFoundError);
    });
  });

  describe('delete', () => {
    it('should soft delete user', async () => {
      const userData: CreateUserDto = {
        firstName: 'Delete',
        lastName: 'Me',
        email: 'delete@example.com',
        timezone: 'UTC',
      };

      const created = await repository.create(userData);
      const deleted = await repository.delete(created.id);

      expect(deleted.deletedAt).toBeInstanceOf(Date);

      // Verify user is not findable
      const found = await repository.findById(created.id);
      expect(found).toBeNull();
    });

    it('should throw NotFoundError for non-existent user', async () => {
      await expect(repository.delete('00000000-0000-0000-0000-000000000000')).rejects.toThrow(
        NotFoundError
      );
    });

    it('should throw NotFoundError when deleting already deleted user', async () => {
      const userData: CreateUserDto = {
        firstName: 'Delete',
        lastName: 'Twice',
        email: 'delete.twice@example.com',
        timezone: 'UTC',
      };

      const created = await repository.create(userData);
      await repository.delete(created.id);

      await expect(repository.delete(created.id)).rejects.toThrow(NotFoundError);
    });
  });

  describe('findBirthdaysToday', () => {
    it('should find users with birthdays today', async () => {
      const today = DateTime.now();

      const userWithBdayToday: CreateUserDto = {
        firstName: 'Birthday',
        lastName: 'Today',
        email: 'bday@example.com',
        timezone: 'UTC',
        birthdayDate: new Date(1990, today.month - 1, today.day),
      };

      const userWithDifferentBday: CreateUserDto = {
        firstName: 'Birthday',
        lastName: 'Different',
        email: 'different@example.com',
        timezone: 'UTC',
        birthdayDate: new Date(1990, 0, 1), // Jan 1
      };

      await repository.create(userWithBdayToday);
      await repository.create(userWithDifferentBday);

      const found = await repository.findBirthdaysToday();

      expect(found).toHaveLength(1);
      expect(found[0]?.email).toBe('bday@example.com');
    });

    it('should filter by timezone', async () => {
      const today = DateTime.now();

      const users: CreateUserDto[] = [
        {
          firstName: 'NY',
          lastName: 'User',
          email: 'ny@example.com',
          timezone: 'America/New_York',
          birthdayDate: new Date(1990, today.month - 1, today.day),
        },
        {
          firstName: 'London',
          lastName: 'User',
          email: 'london@example.com',
          timezone: 'Europe/London',
          birthdayDate: new Date(1990, today.month - 1, today.day),
        },
      ];

      for (const user of users) {
        await repository.create(user);
      }

      const found = await repository.findBirthdaysToday('America/New_York');

      expect(found).toHaveLength(1);
      expect(found[0]?.email).toBe('ny@example.com');
    });

    it('should not include users without birthday dates', async () => {
      const today = DateTime.now();

      const userWithBday: CreateUserDto = {
        firstName: 'Has',
        lastName: 'Birthday',
        email: 'has@example.com',
        timezone: 'UTC',
        birthdayDate: new Date(1990, today.month - 1, today.day),
      };

      const userWithoutBday: CreateUserDto = {
        firstName: 'No',
        lastName: 'Birthday',
        email: 'no@example.com',
        timezone: 'UTC',
      };

      await repository.create(userWithBday);
      await repository.create(userWithoutBday);

      const found = await repository.findBirthdaysToday();

      expect(found).toHaveLength(1);
      expect(found[0]?.email).toBe('has@example.com');
    });
  });

  describe('findAnniversariesToday', () => {
    it('should find users with anniversaries today', async () => {
      const today = DateTime.now();

      const userWithAnnivToday: CreateUserDto = {
        firstName: 'Anniversary',
        lastName: 'Today',
        email: 'anniv@example.com',
        timezone: 'UTC',
        anniversaryDate: new Date(2015, today.month - 1, today.day),
      };

      const userWithDifferentAnniv: CreateUserDto = {
        firstName: 'Anniversary',
        lastName: 'Different',
        email: 'different@example.com',
        timezone: 'UTC',
        anniversaryDate: new Date(2015, 0, 1), // Jan 1
      };

      await repository.create(userWithAnnivToday);
      await repository.create(userWithDifferentAnniv);

      const found = await repository.findAnniversariesToday();

      expect(found).toHaveLength(1);
      expect(found[0]?.email).toBe('anniv@example.com');
    });
  });

  describe('transaction', () => {
    it('should commit transaction on success', async () => {
      const result = await repository.transaction(async (tx) => {
        const user1: CreateUserDto = {
          firstName: 'Transaction',
          lastName: 'User1',
          email: 'tx1@example.com',
          timezone: 'UTC',
        };

        const user2: CreateUserDto = {
          firstName: 'Transaction',
          lastName: 'User2',
          email: 'tx2@example.com',
          timezone: 'UTC',
        };

        await repository.create(user1, tx);
        await repository.create(user2, tx);

        return 'success';
      });

      expect(result).toBe('success');

      // Verify both users were created
      const user1 = await repository.findByEmail('tx1@example.com');
      const user2 = await repository.findByEmail('tx2@example.com');

      expect(user1).not.toBeNull();
      expect(user2).not.toBeNull();
    });

    it('should rollback transaction on error', async () => {
      await expect(
        repository.transaction(async (tx) => {
          const user: CreateUserDto = {
            firstName: 'Rollback',
            lastName: 'Test',
            email: 'rollback@example.com',
            timezone: 'UTC',
          };

          await repository.create(user, tx);

          // Force error
          throw new Error('Transaction failed');
        })
      ).rejects.toThrow('Transaction failed');

      // Verify user was not created
      const found = await repository.findByEmail('rollback@example.com');
      expect(found).toBeNull();
    });
  });
});
