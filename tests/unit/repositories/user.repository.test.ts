import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { UserRepository } from '../../../src/repositories/user.repository.js';
import { UniqueConstraintError, NotFoundError, DatabaseError } from '../../../src/utils/errors.js';
import type { User } from '../../../src/db/schema/users.js';

/**
 * Unit Tests: UserRepository
 *
 * Tests all repository methods with mocked database:
 * - CRUD operations
 * - Birthday/anniversary queries
 * - Transaction support
 * - Error handling
 */
describe('UserRepository', () => {
  let repository: UserRepository;
  let mockDb: any;

  const mockUser: User = {
    id: '123e4567-e89b-12d3-a456-426614174000',
    firstName: 'John',
    lastName: 'Doe',
    email: 'john@example.com',
    timezone: 'America/New_York',
    birthdayDate: new Date('1990-12-30'),
    anniversaryDate: new Date('2015-05-15'),
    locationCity: 'New York',
    locationCountry: 'USA',
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
  };

  beforeEach(() => {
    vi.resetAllMocks();

    // Create chainable mock database
    mockDb = {
      select: vi.fn().mockReturnThis(),
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue([mockUser]),
      offset: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
      values: vi.fn().mockReturnThis(),
      returning: vi.fn().mockResolvedValue([mockUser]),
      update: vi.fn().mockReturnThis(),
      set: vi.fn().mockReturnThis(),
      transaction: vi.fn(),
    };

    repository = new UserRepository(mockDb);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('findById', () => {
    it('should find user by ID', async () => {
      mockDb.limit.mockResolvedValue([mockUser]);

      const result = await repository.findById(mockUser.id);

      expect(result).toEqual(mockUser);
      expect(mockDb.select).toHaveBeenCalled();
    });

    it('should return null for non-existent user', async () => {
      mockDb.limit.mockResolvedValue([]);

      const result = await repository.findById('non-existent-id');

      expect(result).toBeNull();
    });

    it('should throw DatabaseError on database failure', async () => {
      mockDb.limit.mockRejectedValue(new Error('Connection failed'));

      await expect(repository.findById(mockUser.id)).rejects.toThrow(DatabaseError);
    });

    it('should use provided transaction', async () => {
      const mockTx = {
        select: vi.fn().mockReturnThis(),
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([mockUser]),
      };

      const result = await repository.findById(mockUser.id, mockTx as any);

      expect(result).toEqual(mockUser);
      expect(mockTx.select).toHaveBeenCalled();
    });
  });

  describe('findByEmail', () => {
    it('should find user by email', async () => {
      mockDb.limit.mockResolvedValue([mockUser]);

      const result = await repository.findByEmail(mockUser.email);

      expect(result).toEqual(mockUser);
    });

    it('should return null for non-existent email', async () => {
      mockDb.limit.mockResolvedValue([]);

      const result = await repository.findByEmail('unknown@example.com');

      expect(result).toBeNull();
    });

    it('should throw DatabaseError on database failure', async () => {
      mockDb.limit.mockRejectedValue(new Error('Connection failed'));

      await expect(repository.findByEmail(mockUser.email)).rejects.toThrow(DatabaseError);
    });
  });

  describe('findAll', () => {
    it('should find all users with default filters', async () => {
      // Mock the chainable query for findAll
      const mockQuery = [mockUser];
      mockDb.offset.mockResolvedValue(mockQuery);

      const result = await repository.findAll();

      expect(result).toEqual([mockUser]);
    });

    it('should apply email filter', async () => {
      mockDb.offset.mockResolvedValue([mockUser]);

      await repository.findAll({ email: 'john@example.com', limit: 10, offset: 0 });

      expect(mockDb.where).toHaveBeenCalled();
    });

    it('should apply timezone filter', async () => {
      mockDb.offset.mockResolvedValue([mockUser]);

      await repository.findAll({ timezone: 'America/New_York', limit: 10, offset: 0 });

      expect(mockDb.where).toHaveBeenCalled();
    });

    it('should apply hasBirthday filter (true)', async () => {
      mockDb.offset.mockResolvedValue([mockUser]);

      await repository.findAll({ hasBirthday: true, limit: 10, offset: 0 });

      expect(mockDb.where).toHaveBeenCalled();
    });

    it('should apply hasBirthday filter (false)', async () => {
      mockDb.offset.mockResolvedValue([]);

      await repository.findAll({ hasBirthday: false, limit: 10, offset: 0 });

      expect(mockDb.where).toHaveBeenCalled();
    });

    it('should apply hasAnniversary filter (true)', async () => {
      mockDb.offset.mockResolvedValue([mockUser]);

      await repository.findAll({ hasAnniversary: true, limit: 10, offset: 0 });

      expect(mockDb.where).toHaveBeenCalled();
    });

    it('should apply hasAnniversary filter (false)', async () => {
      mockDb.offset.mockResolvedValue([]);

      await repository.findAll({ hasAnniversary: false, limit: 10, offset: 0 });

      expect(mockDb.where).toHaveBeenCalled();
    });

    it('should apply limit and offset', async () => {
      mockDb.offset.mockResolvedValue([mockUser]);

      await repository.findAll({ limit: 20, offset: 10 });

      expect(mockDb.limit).toHaveBeenCalledWith(20);
      expect(mockDb.offset).toHaveBeenCalledWith(10);
    });

    it('should use default limit and offset', async () => {
      mockDb.offset.mockResolvedValue([mockUser]);

      await repository.findAll();

      expect(mockDb.limit).toHaveBeenCalledWith(10);
      expect(mockDb.offset).toHaveBeenCalledWith(0);
    });

    it('should throw DatabaseError on failure', async () => {
      mockDb.offset.mockRejectedValue(new Error('Query failed'));

      await expect(repository.findAll()).rejects.toThrow(DatabaseError);
    });
  });

  describe('create', () => {
    it('should create a new user', async () => {
      // Mock findByEmail to return null (no existing user)
      mockDb.limit.mockResolvedValue([]);
      mockDb.returning.mockResolvedValue([mockUser]);

      const result = await repository.create({
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@example.com',
        timezone: 'America/New_York',
      });

      expect(result).toEqual(mockUser);
      expect(mockDb.insert).toHaveBeenCalled();
    });

    it('should throw UniqueConstraintError for duplicate email', async () => {
      // Mock findByEmail to return existing user
      mockDb.limit.mockResolvedValue([mockUser]);

      await expect(
        repository.create({
          firstName: 'John',
          lastName: 'Doe',
          email: 'john@example.com',
          timezone: 'America/New_York',
        })
      ).rejects.toThrow(UniqueConstraintError);
    });

    it('should handle PostgreSQL unique constraint error', async () => {
      mockDb.limit.mockResolvedValue([]);
      mockDb.returning.mockRejectedValue({ code: '23505' });

      await expect(
        repository.create({
          firstName: 'John',
          lastName: 'Doe',
          email: 'john@example.com',
          timezone: 'America/New_York',
        })
      ).rejects.toThrow(UniqueConstraintError);
    });

    it('should throw DatabaseError for other errors', async () => {
      mockDb.limit.mockResolvedValue([]);
      mockDb.returning.mockRejectedValue(new Error('Connection failed'));

      await expect(
        repository.create({
          firstName: 'John',
          lastName: 'Doe',
          email: 'john@example.com',
          timezone: 'America/New_York',
        })
      ).rejects.toThrow(DatabaseError);
    });

    it('should include optional fields', async () => {
      mockDb.limit.mockResolvedValue([]);
      mockDb.returning.mockResolvedValue([mockUser]);

      await repository.create({
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@example.com',
        timezone: 'America/New_York',
        birthdayDate: new Date('1990-01-15'),
        anniversaryDate: new Date('2015-06-20'),
        locationCity: 'Boston',
        locationCountry: 'USA',
      });

      expect(mockDb.values).toHaveBeenCalled();
    });
  });

  describe('update', () => {
    it('should update user with partial data', async () => {
      // First call for findById, second for returning
      mockDb.limit.mockResolvedValue([mockUser]);
      mockDb.returning.mockResolvedValue([{ ...mockUser, firstName: 'Jane' }]);

      const result = await repository.update(mockUser.id, { firstName: 'Jane' });

      expect(result.firstName).toBe('Jane');
      expect(mockDb.update).toHaveBeenCalled();
    });

    it('should throw NotFoundError for non-existent user', async () => {
      mockDb.limit.mockResolvedValue([]);

      await expect(repository.update('non-existent-id', { firstName: 'Jane' })).rejects.toThrow(
        NotFoundError
      );
    });

    it('should check for email conflict when updating email', async () => {
      // First call returns existing user, second call for email check
      mockDb.limit
        .mockResolvedValueOnce([mockUser])
        .mockResolvedValueOnce([{ ...mockUser, id: 'other-id', email: 'other@example.com' }]);

      await expect(repository.update(mockUser.id, { email: 'other@example.com' })).rejects.toThrow(
        UniqueConstraintError
      );
    });

    it('should allow updating to same email', async () => {
      mockDb.limit.mockResolvedValueOnce([mockUser]).mockResolvedValueOnce([mockUser]);
      mockDb.returning.mockResolvedValue([mockUser]);

      const result = await repository.update(mockUser.id, { email: mockUser.email });

      expect(result).toBeDefined();
    });

    it('should handle PostgreSQL unique constraint error', async () => {
      mockDb.limit.mockResolvedValue([mockUser]);
      mockDb.returning.mockRejectedValue({ code: '23505' });

      await expect(
        repository.update(mockUser.id, { email: 'duplicate@example.com' })
      ).rejects.toThrow(UniqueConstraintError);
    });

    it('should throw DatabaseError for other errors', async () => {
      mockDb.limit.mockResolvedValue([mockUser]);
      mockDb.returning.mockRejectedValue(new Error('Connection failed'));

      await expect(repository.update(mockUser.id, { firstName: 'Jane' })).rejects.toThrow(
        DatabaseError
      );
    });
  });

  describe('delete', () => {
    it('should soft delete user', async () => {
      mockDb.limit.mockResolvedValue([mockUser]);
      mockDb.returning.mockResolvedValue([{ ...mockUser, deletedAt: new Date() }]);

      const result = await repository.delete(mockUser.id);

      expect(result.deletedAt).not.toBeNull();
    });

    it('should throw NotFoundError for non-existent user', async () => {
      mockDb.limit.mockResolvedValue([]);

      await expect(repository.delete('non-existent-id')).rejects.toThrow(NotFoundError);
    });

    it('should throw DatabaseError on failure', async () => {
      mockDb.limit.mockResolvedValue([mockUser]);
      mockDb.returning.mockRejectedValue(new Error('Delete failed'));

      await expect(repository.delete(mockUser.id)).rejects.toThrow(DatabaseError);
    });
  });

  describe('findBirthdaysToday', () => {
    it('should find users with birthdays today', async () => {
      // Need to mock the full chain for this query
      mockDb.where.mockResolvedValue([mockUser]);

      const result = await repository.findBirthdaysToday();

      expect(Array.isArray(result)).toBe(true);
    });

    it('should filter by timezone when provided', async () => {
      mockDb.where.mockResolvedValue([mockUser]);

      await repository.findBirthdaysToday('America/New_York');

      expect(mockDb.where).toHaveBeenCalled();
    });

    it('should throw DatabaseError on failure', async () => {
      mockDb.where.mockRejectedValue(new Error('Query failed'));

      await expect(repository.findBirthdaysToday()).rejects.toThrow(DatabaseError);
    });
  });

  describe('findAnniversariesToday', () => {
    it('should find users with anniversaries today', async () => {
      mockDb.where.mockResolvedValue([mockUser]);

      const result = await repository.findAnniversariesToday();

      expect(Array.isArray(result)).toBe(true);
    });

    it('should filter by timezone when provided', async () => {
      mockDb.where.mockResolvedValue([mockUser]);

      await repository.findAnniversariesToday('America/New_York');

      expect(mockDb.where).toHaveBeenCalled();
    });

    it('should throw DatabaseError on failure', async () => {
      mockDb.where.mockRejectedValue(new Error('Query failed'));

      await expect(repository.findAnniversariesToday()).rejects.toThrow(DatabaseError);
    });
  });

  describe('transaction', () => {
    it('should execute callback within transaction', async () => {
      const callback = vi.fn().mockResolvedValue(mockUser);
      mockDb.transaction.mockImplementation((cb: any) => cb(mockDb));

      await repository.transaction(callback);

      expect(mockDb.transaction).toHaveBeenCalled();
    });

    it('should throw DatabaseError on transaction failure', async () => {
      mockDb.transaction.mockRejectedValue(new Error('Transaction failed'));

      await expect(repository.transaction(async () => mockUser)).rejects.toThrow(DatabaseError);
    });

    it('should pass transaction instance to callback', async () => {
      const mockTx = { id: 'mock-tx' };
      mockDb.transaction.mockImplementation((cb: any) => cb(mockTx));

      let receivedTx: any = null;
      await repository.transaction(async (tx) => {
        receivedTx = tx;
        return mockUser;
      });

      expect(receivedTx).toEqual(mockTx);
    });
  });

  describe('edge cases', () => {
    it('should handle user with null optional fields', async () => {
      const userWithNulls = {
        ...mockUser,
        birthdayDate: null,
        anniversaryDate: null,
        locationCity: null,
        locationCountry: null,
      };
      mockDb.limit.mockResolvedValue([userWithNulls]);

      const result = await repository.findById(mockUser.id);

      expect(result?.birthdayDate).toBeNull();
      expect(result?.anniversaryDate).toBeNull();
    });

    it('should handle empty result sets', async () => {
      mockDb.offset.mockResolvedValue([]);

      const result = await repository.findAll();

      expect(result).toEqual([]);
    });

    it('should handle special characters in email', async () => {
      const specialEmail = 'john+tag@example.com';
      mockDb.limit.mockResolvedValue([{ ...mockUser, email: specialEmail }]);

      const result = await repository.findByEmail(specialEmail);

      expect(result?.email).toBe(specialEmail);
    });
  });
});
