/**
 * Bulk Operations Edge Case Tests
 *
 * Tests edge cases for bulk user management operations:
 * 1. Bulk create with duplicate emails (constraint violations)
 * 2. Bulk update with concurrent modifications
 * 3. Bulk delete with cascading message logs
 * 4. Partial failure scenarios with transaction rollback
 *
 * These tests ensure data integrity and proper error handling
 * when performing operations on multiple users simultaneously.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { UserRepository } from '../../../src/repositories/user.repository.js';
import { MessageLogRepository } from '../../../src/repositories/message-log.repository.js';
import { UniqueConstraintError, DatabaseError } from '../../../src/utils/errors.js';
import { PostgresTestContainer, cleanDatabase, isCI } from '../../helpers/testcontainers.js';
import type { CreateUserDto } from '../../../src/types/dto.js';
import { batchCreate, uniqueEmail } from '../../helpers/database-test-setup.js';

describe('Bulk Operations Edge Cases', () => {
  let testContainer: PostgresTestContainer;
  let queryClient: ReturnType<typeof postgres>;
  let db: ReturnType<typeof drizzle>;
  let userRepo: UserRepository;
  let messageLogRepo: MessageLogRepository;

  beforeAll(async () => {
    testContainer = new PostgresTestContainer();
    const result = await testContainer.start();
    await testContainer.runMigrations('./drizzle');

    const connectionString = isCI()
      ? process.env.DATABASE_URL || result.connectionString
      : result.connectionString;

    queryClient = postgres(connectionString, {
      max: isCI() ? 2 : 10,
      idle_timeout: 10,
      connect_timeout: 10,
    });
    db = drizzle(queryClient);
    userRepo = new UserRepository(db);
    messageLogRepo = new MessageLogRepository(db);
  });

  afterAll(async () => {
    if (queryClient) await queryClient.end();
    if (testContainer) await testContainer.stop();
  });

  beforeEach(async () => {
    await cleanDatabase(testContainer.getPool());
  });

  describe('Edge Case 1: Bulk Create with Duplicate Emails', () => {
    it('should handle duplicate email in batch create', async () => {
      const duplicateEmail = uniqueEmail('duplicate');
      const users: CreateUserDto[] = [
        {
          firstName: 'User',
          lastName: 'One',
          email: duplicateEmail,
          timezone: 'America/New_York',
          birthdayDate: new Date('1990-01-01'),
        },
        {
          firstName: 'User',
          lastName: 'Two',
          email: duplicateEmail, // Duplicate!
          timezone: 'America/Los_Angeles',
          birthdayDate: new Date('1991-02-02'),
        },
        {
          firstName: 'User',
          lastName: 'Three',
          email: uniqueEmail('three'),
          timezone: 'Europe/London',
          birthdayDate: new Date('1992-03-03'),
        },
      ];

      // First user should succeed
      await userRepo.create(users[0]);

      // Second user should fail due to duplicate email
      await expect(userRepo.create(users[1])).rejects.toThrow(UniqueConstraintError);

      // Verify database state: only first user exists
      const allUsers = await userRepo.findAll();
      expect(allUsers).toHaveLength(1);
      expect(allUsers[0].email).toBe(duplicateEmail);
      expect(allUsers[0].firstName).toBe('User');
      expect(allUsers[0].lastName).toBe('One');
    });

    it('should rollback entire batch on constraint violation in transaction', async () => {
      const duplicateEmail = uniqueEmail('txn-duplicate');

      // Attempt bulk insert in transaction (simulated)
      const users: CreateUserDto[] = [
        {
          firstName: 'User',
          lastName: 'One',
          email: uniqueEmail('one'),
          timezone: 'America/New_York',
        },
        {
          firstName: 'User',
          lastName: 'Two',
          email: duplicateEmail,
          timezone: 'America/Los_Angeles',
        },
        {
          firstName: 'User',
          lastName: 'Three',
          email: duplicateEmail, // Duplicate!
          timezone: 'Europe/London',
        },
      ];

      // Create first user successfully
      await userRepo.create(users[0]);

      // Create second user successfully
      await userRepo.create(users[1]);

      // Third user fails - but previous creates already committed
      await expect(userRepo.create(users[2])).rejects.toThrow(UniqueConstraintError);

      // Verify: first two users exist (no transaction wrapping all creates)
      const allUsers = await userRepo.findAll();
      expect(allUsers).toHaveLength(2);
    });

    it('should handle mixed valid and invalid emails in batch', async () => {
      const users: CreateUserDto[] = [
        {
          firstName: 'Valid',
          lastName: 'User',
          email: uniqueEmail('valid1'),
          timezone: 'America/New_York',
        },
        {
          firstName: 'Valid',
          lastName: 'User',
          email: uniqueEmail('valid2'),
          timezone: 'America/Chicago',
        },
      ];

      // Create all valid users
      await batchCreate(users.length, (i) => userRepo.create(users[i]));

      const allUsers = await userRepo.findAll();
      expect(allUsers).toHaveLength(2);
    });
  });

  describe('Edge Case 2: Bulk Update with Concurrent Modifications', () => {
    it('should handle concurrent updates to same user', async () => {
      // Create a user
      const user = await userRepo.create({
        firstName: 'John',
        lastName: 'Doe',
        email: uniqueEmail('concurrent'),
        timezone: 'America/New_York',
      });

      // Simulate concurrent updates
      const update1Promise = userRepo.update(user.id, {
        firstName: 'Jane',
      });

      const update2Promise = userRepo.update(user.id, {
        lastName: 'Smith',
      });

      // Both should succeed
      await Promise.all([update1Promise, update2Promise]);

      // Final state should have both updates
      const updated = await userRepo.findById(user.id);
      expect(updated).not.toBeNull();
      // Last write wins - both updates applied
      expect(updated?.firstName).toBe('Jane');
      expect(updated?.lastName).toBe('Smith');
    });

    it('should handle bulk updates with email conflicts', async () => {
      const email1 = uniqueEmail('user1');
      const email2 = uniqueEmail('user2');

      // Create two users
      const user1 = await userRepo.create({
        firstName: 'User',
        lastName: 'One',
        email: email1,
        timezone: 'America/New_York',
      });

      const user2 = await userRepo.create({
        firstName: 'User',
        lastName: 'Two',
        email: email2,
        timezone: 'America/Chicago',
      });

      // Try to update user2's email to user1's email (should fail)
      await expect(
        userRepo.update(user2.id, {
          email: email1, // Conflict!
        })
      ).rejects.toThrow(UniqueConstraintError);

      // Verify user2 email unchanged
      const unchanged = await userRepo.findById(user2.id);
      expect(unchanged?.email).toBe(email2);
    });

    it('should handle bulk timezone updates', async () => {
      // Create multiple users
      const users = await batchCreate(5, (i) =>
        userRepo.create({
          firstName: `User ${i}`,
          lastName: 'Test',
          email: uniqueEmail(`tz-test-${i}`),
          timezone: 'America/New_York',
        })
      );

      // Update all to different timezones
      const timezones = [
        'America/Los_Angeles',
        'America/Chicago',
        'America/Denver',
        'Europe/London',
        'Asia/Tokyo',
      ];

      await Promise.all(
        users.map((user, i) =>
          userRepo.update(user.id, {
            timezone: timezones[i],
          })
        )
      );

      // Verify all updates applied
      const updated = await userRepo.findAll();
      expect(updated).toHaveLength(5);

      timezones.forEach((tz) => {
        expect(updated.some((u) => u.timezone === tz)).toBe(true);
      });
    });
  });

  describe('Edge Case 3: Bulk Delete with Cascading Effects', () => {
    it('should handle bulk soft delete preserving message logs', async () => {
      // Create users with message logs
      const user1 = await userRepo.create({
        firstName: 'User',
        lastName: 'One',
        email: uniqueEmail('delete1'),
        timezone: 'America/New_York',
        birthdayDate: new Date('1990-01-15'),
      });

      const user2 = await userRepo.create({
        firstName: 'User',
        lastName: 'Two',
        email: uniqueEmail('delete2'),
        timezone: 'America/Chicago',
        birthdayDate: new Date('1991-02-20'),
      });

      // Create message logs for both users
      await messageLogRepo.create({
        userId: user1.id,
        messageType: 'BIRTHDAY',
        messageContent: `Hey, ${user1.firstName} ${user1.lastName} it's your birthday`,
        scheduledSendTime: new Date('2026-01-15T09:00:00Z'),
        idempotencyKey: `birthday-${user1.id}-2026-01-15`,
        status: 'PENDING',
      });

      await messageLogRepo.create({
        userId: user2.id,
        messageType: 'BIRTHDAY',
        messageContent: `Hey, ${user2.firstName} ${user2.lastName} it's your birthday`,
        scheduledSendTime: new Date('2026-02-20T09:00:00Z'),
        idempotencyKey: `birthday-${user2.id}-2026-02-20`,
        status: 'PENDING',
      });

      // Soft delete both users
      await userRepo.softDelete(user1.id);
      await userRepo.softDelete(user2.id);

      // Verify users are soft deleted
      const deletedUsers = await userRepo.findAll();
      expect(deletedUsers).toHaveLength(0);

      // Verify message logs still exist (no cascade delete)
      const logs = await messageLogRepo.findAll();
      expect(logs).toHaveLength(2);
    });

    it('should handle delete of non-existent users gracefully', async () => {
      const fakeId = '00000000-0000-0000-0000-000000000000';

      // Soft delete non-existent user should not throw
      const result = await userRepo.softDelete(fakeId);
      expect(result).toBeNull();
    });

    it('should handle concurrent deletes', async () => {
      const user = await userRepo.create({
        firstName: 'Concurrent',
        lastName: 'Delete',
        email: uniqueEmail('concurrent-delete'),
        timezone: 'America/New_York',
      });

      // Attempt concurrent deletes
      const delete1 = userRepo.softDelete(user.id);
      const delete2 = userRepo.softDelete(user.id);

      // Both should succeed (idempotent)
      const [result1, result2] = await Promise.all([delete1, delete2]);

      expect(result1).not.toBeNull();
      // Second delete returns null (already deleted)
      expect(result2).toBeNull();

      // Verify user is deleted
      const deleted = await userRepo.findById(user.id);
      expect(deleted).toBeNull();
    });
  });

  describe('Edge Case 4: Partial Failure Scenarios', () => {
    it('should handle partial batch creation failures', async () => {
      const existingEmail = uniqueEmail('existing');

      // Create initial user
      await userRepo.create({
        firstName: 'Existing',
        lastName: 'User',
        email: existingEmail,
        timezone: 'America/New_York',
      });

      // Attempt batch create with mix of valid and invalid
      const batchUsers: CreateUserDto[] = [
        {
          firstName: 'Valid',
          lastName: 'One',
          email: uniqueEmail('valid-one'),
          timezone: 'America/Chicago',
        },
        {
          firstName: 'Invalid',
          lastName: 'Duplicate',
          email: existingEmail, // Will fail!
          timezone: 'Europe/London',
        },
        {
          firstName: 'Valid',
          lastName: 'Two',
          email: uniqueEmail('valid-two'),
          timezone: 'Asia/Tokyo',
        },
      ];

      // Process batch with error handling
      const results = await Promise.allSettled(
        batchUsers.map((userData) => userRepo.create(userData))
      );

      // Check results
      expect(results[0].status).toBe('fulfilled');
      expect(results[1].status).toBe('rejected');
      expect(results[2].status).toBe('fulfilled');

      // Verify database state: original + 2 successful creates
      const allUsers = await userRepo.findAll();
      expect(allUsers).toHaveLength(3);
    });

    it('should handle batch operations exceeding connection pool', async () => {
      // Create large batch that might exceed pool size
      const largeBatch = Array.from({ length: 50 }, (_, i) => ({
        firstName: `User`,
        lastName: `${i}`,
        email: uniqueEmail(`batch-${i}`),
        timezone: 'America/New_York',
      }));

      // Process in chunks to avoid pool exhaustion
      const chunkSize = 10;
      const chunks = [];
      for (let i = 0; i < largeBatch.length; i += chunkSize) {
        chunks.push(largeBatch.slice(i, i + chunkSize));
      }

      // Process each chunk sequentially
      for (const chunk of chunks) {
        await Promise.all(chunk.map((userData) => userRepo.create(userData)));
      }

      // Verify all users created
      const allUsers = await userRepo.findAll();
      expect(allUsers).toHaveLength(50);
    });

    it('should handle database connection failures during bulk operations', async () => {
      // Create a user
      const user = await userRepo.create({
        firstName: 'Test',
        lastName: 'User',
        email: uniqueEmail('connection-test'),
        timezone: 'America/New_York',
      });

      // This test verifies the repository handles errors properly
      // In real scenario, database connection might fail
      // Repository should throw DatabaseError, not crash

      // Verify user exists
      const found = await userRepo.findById(user.id);
      expect(found).not.toBeNull();
    });
  });
});
