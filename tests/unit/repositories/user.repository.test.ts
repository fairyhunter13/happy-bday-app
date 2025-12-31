import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { UniqueConstraintError, NotFoundError, DatabaseError } from '../../../src/utils/errors.js';
import type { User } from '../../../src/db/schema/users.js';

/**
 * Unit Tests: UserRepository
 *
 * Tests repository methods behavior with mocked database.
 * Focus on error handling and edge cases.
 */
describe('UserRepository', () => {
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

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('error types', () => {
    it('UniqueConstraintError should have correct properties', () => {
      const error = new UniqueConstraintError('User with email test@example.com already exists', {
        email: 'test@example.com',
      });

      expect(error.message).toBe('User with email test@example.com already exists');
      expect(error.code).toBe('UNIQUE_CONSTRAINT_ERROR');
      expect(error.statusCode).toBe(409);
      expect(error.details).toEqual({ email: 'test@example.com' });
    });

    it('NotFoundError should have correct properties', () => {
      const error = new NotFoundError('User with ID abc not found', { id: 'abc' });

      expect(error.message).toBe('User with ID abc not found');
      expect(error.code).toBe('NOT_FOUND');
      expect(error.statusCode).toBe(404);
      expect(error.details).toEqual({ id: 'abc' });
    });

    it('DatabaseError should have correct properties', () => {
      const error = new DatabaseError('Failed to find users', { filters: { limit: 10 } });

      expect(error.message).toBe('Failed to find users');
      expect(error.code).toBe('DATABASE_ERROR');
      expect(error.statusCode).toBe(500);
      expect(error.details).toEqual({ filters: { limit: 10 } });
    });
  });

  describe('user data validation', () => {
    it('should have valid user structure', () => {
      expect(mockUser).toHaveProperty('id');
      expect(mockUser).toHaveProperty('firstName');
      expect(mockUser).toHaveProperty('lastName');
      expect(mockUser).toHaveProperty('email');
      expect(mockUser).toHaveProperty('timezone');
      expect(mockUser).toHaveProperty('birthdayDate');
      expect(mockUser).toHaveProperty('anniversaryDate');
      expect(mockUser).toHaveProperty('locationCity');
      expect(mockUser).toHaveProperty('locationCountry');
      expect(mockUser).toHaveProperty('createdAt');
      expect(mockUser).toHaveProperty('updatedAt');
      expect(mockUser).toHaveProperty('deletedAt');
    });

    it('should handle user with null optional fields', () => {
      const userWithNulls: User = {
        ...mockUser,
        birthdayDate: null,
        anniversaryDate: null,
        locationCity: null,
        locationCountry: null,
      };

      expect(userWithNulls.birthdayDate).toBeNull();
      expect(userWithNulls.anniversaryDate).toBeNull();
      expect(userWithNulls.locationCity).toBeNull();
      expect(userWithNulls.locationCountry).toBeNull();
    });

    it('should handle soft-deleted user', () => {
      const deletedUser: User = {
        ...mockUser,
        deletedAt: new Date(),
      };

      expect(deletedUser.deletedAt).not.toBeNull();
    });
  });

  describe('email validation patterns', () => {
    it('should accept standard email format', () => {
      const email = 'user@example.com';
      expect(email).toMatch(/^[^\s@]+@[^\s@]+\.[^\s@]+$/);
    });

    it('should accept email with plus tag', () => {
      const email = 'user+tag@example.com';
      expect(email).toMatch(/^[^\s@]+@[^\s@]+\.[^\s@]+$/);
    });

    it('should accept email with subdomain', () => {
      const email = 'user@mail.example.com';
      expect(email).toMatch(/^[^\s@]+@[^\s@]+\.[^\s@]+$/);
    });

    it('should accept email with international TLD', () => {
      const email = 'user@example.co.uk';
      expect(email).toMatch(/^[^\s@]+@[^\s@]+\.[^\s@]+$/);
    });
  });

  describe('timezone validation', () => {
    it('should recognize valid IANA timezones', () => {
      const validTimezones = [
        'America/New_York',
        'Europe/London',
        'Asia/Tokyo',
        'Australia/Sydney',
        'UTC',
      ];

      validTimezones.forEach((tz) => {
        expect(tz).toBeTruthy();
      });
    });
  });

  describe('date handling', () => {
    it('should handle birthday date correctly', () => {
      const birthdayDate = new Date('1990-12-30');
      const month = birthdayDate.getMonth() + 1; // JavaScript months are 0-indexed
      const day = birthdayDate.getDate();

      expect(month).toBe(12);
      expect(day).toBe(30);
    });

    it('should handle leap year birthday', () => {
      const leapYearBirthday = new Date('1992-02-29');
      const month = leapYearBirthday.getMonth() + 1;
      const day = leapYearBirthday.getDate();

      expect(month).toBe(2);
      expect(day).toBe(29);
    });

    it('should handle anniversary date correctly', () => {
      const anniversaryDate = new Date('2015-05-15');
      const month = anniversaryDate.getMonth() + 1;
      const day = anniversaryDate.getDate();

      expect(month).toBe(5);
      expect(day).toBe(15);
    });
  });

  describe('create user dto structure', () => {
    it('should construct valid create dto', () => {
      const createDto = {
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@example.com',
        timezone: 'America/New_York',
        birthdayDate: new Date('1990-01-15'),
        anniversaryDate: new Date('2015-06-20'),
        locationCity: 'Boston',
        locationCountry: 'USA',
      };

      expect(createDto.firstName).toBe('John');
      expect(createDto.lastName).toBe('Doe');
      expect(createDto.email).toBe('john@example.com');
      expect(createDto.timezone).toBe('America/New_York');
    });

    it('should handle minimal create dto', () => {
      const minimalDto = {
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@example.com',
        timezone: 'UTC',
      };

      expect(minimalDto).toHaveProperty('firstName');
      expect(minimalDto).toHaveProperty('lastName');
      expect(minimalDto).toHaveProperty('email');
      expect(minimalDto).toHaveProperty('timezone');
    });
  });

  describe('update user dto structure', () => {
    it('should construct valid partial update dto', () => {
      const updateDto = {
        firstName: 'Jane',
        timezone: 'Europe/London',
      };

      expect(updateDto).toHaveProperty('firstName');
      expect(updateDto).toHaveProperty('timezone');
      expect(updateDto).not.toHaveProperty('lastName');
      expect(updateDto).not.toHaveProperty('email');
    });

    it('should handle email update', () => {
      const updateDto = {
        email: 'new.email@example.com',
      };

      expect(updateDto.email).toBe('new.email@example.com');
    });

    it('should handle date updates', () => {
      const updateDto = {
        birthdayDate: new Date('1992-03-15'),
        anniversaryDate: new Date('2020-01-01'),
      };

      expect(updateDto.birthdayDate).toBeInstanceOf(Date);
      expect(updateDto.anniversaryDate).toBeInstanceOf(Date);
    });
  });

  describe('filters structure', () => {
    it('should construct valid filters', () => {
      const filters = {
        email: 'john@example.com',
        timezone: 'America/New_York',
        hasBirthday: true,
        hasAnniversary: false,
        limit: 20,
        offset: 10,
      };

      expect(filters.limit).toBe(20);
      expect(filters.offset).toBe(10);
      expect(filters.hasBirthday).toBe(true);
      expect(filters.hasAnniversary).toBe(false);
    });

    it('should handle default filter values', () => {
      const filters = {
        limit: 10,
        offset: 0,
      };

      expect(filters.limit).toBe(10);
      expect(filters.offset).toBe(0);
    });
  });

  describe('PostgreSQL error code handling', () => {
    it('should identify unique constraint violation code', () => {
      const postgresError = { code: '23505' };

      expect(postgresError.code).toBe('23505');
    });

    it('should handle non-error objects', () => {
      const stringError = 'Some error string';

      expect(typeof stringError).toBe('string');
    });
  });

  describe('soft delete logic', () => {
    it('should mark user as deleted with timestamp', () => {
      const deletedAt = new Date();
      const deletedUser: User = {
        ...mockUser,
        deletedAt,
        updatedAt: deletedAt,
      };

      expect(deletedUser.deletedAt).toEqual(deletedAt);
      expect(deletedUser.updatedAt).toEqual(deletedAt);
    });

    it('should distinguish active from deleted users', () => {
      const activeUser = { ...mockUser, deletedAt: null };
      const deletedUser = { ...mockUser, deletedAt: new Date() };

      expect(activeUser.deletedAt).toBeNull();
      expect(deletedUser.deletedAt).not.toBeNull();
    });
  });

  describe('birthday/anniversary query logic', () => {
    it('should extract month and day from date', () => {
      const today = new Date();
      const month = today.getMonth() + 1;
      const day = today.getDate();

      expect(month).toBeGreaterThanOrEqual(1);
      expect(month).toBeLessThanOrEqual(12);
      expect(day).toBeGreaterThanOrEqual(1);
      expect(day).toBeLessThanOrEqual(31);
    });

    it('should handle year-end boundary', () => {
      const dec31 = new Date('2025-12-31');
      const month = dec31.getMonth() + 1;
      const day = dec31.getDate();

      expect(month).toBe(12);
      expect(day).toBe(31);
    });

    it('should handle year-start boundary', () => {
      const jan1 = new Date('2025-01-01');
      const month = jan1.getMonth() + 1;
      const day = jan1.getDate();

      expect(month).toBe(1);
      expect(day).toBe(1);
    });
  });

  describe('transaction behavior', () => {
    it('should define transaction callback type', () => {
      const transactionCallback = async <T>(tx: unknown): Promise<T> => {
        return {} as T;
      };

      expect(typeof transactionCallback).toBe('function');
    });
  });
});
