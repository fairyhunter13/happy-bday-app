/**
 * Unit tests for UserController
 *
 * Tests:
 * - Create user with validation
 * - Get user by ID
 * - Update user with partial updates
 * - Delete user (soft delete)
 * - Error handling (400, 404, 409)
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { UserController } from '../../../src/controllers/user.controller.js';
import { UserRepository } from '../../../src/repositories/user.repository.js';
import type { FastifyRequest, FastifyReply } from 'fastify';
import {
  UniqueConstraintError,
  NotFoundError,
  ValidationError,
} from '../../../src/utils/errors.js';

describe('UserController', () => {
  let controller: UserController;
  let mockRepository: UserRepository;
  let mockRequest: Partial<FastifyRequest>;
  let mockReply: Partial<FastifyReply>;

  beforeEach(() => {
    // Create mock repository
    mockRepository = {
      create: vi.fn(),
      findById: vi.fn(),
      findByEmail: vi.fn(),
      findAll: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      findBirthdaysToday: vi.fn(),
      findAnniversariesToday: vi.fn(),
      transaction: vi.fn(),
    } as any;

    controller = new UserController(mockRepository);

    // Create mock request/reply
    mockRequest = {
      body: {},
      params: {},
      url: '/api/v1/users',
    };

    mockReply = {
      status: vi.fn().mockReturnThis(),
      send: vi.fn().mockReturnThis(),
    };
  });

  describe('create', () => {
    it('should create a new user with valid data', async () => {
      const userData = {
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@example.com',
        timezone: 'America/New_York',
        birthdayDate: '1990-01-15T00:00:00.000Z',
      };

      const createdUser = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        ...userData,
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
        anniversaryDate: null,
        locationCity: null,
        locationCountry: null,
      };

      mockRequest.body = userData;
      (mockRepository.create as any).mockResolvedValue(createdUser);
      (mockReply.status as any).mockReturnValue(mockReply);

      await controller.create(mockRequest as FastifyRequest, mockReply as FastifyReply);

      expect(mockReply.status).toHaveBeenCalledWith(201);
      expect(mockReply.send).toHaveBeenCalled();
      expect(mockRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          firstName: userData.firstName,
          email: userData.email.toLowerCase(),
          timezone: userData.timezone,
        })
      );
    });

    it('should return 400 for invalid email', async () => {
      mockRequest.body = {
        firstName: 'John',
        lastName: 'Doe',
        email: 'invalid-email',
        timezone: 'America/New_York',
      };

      (mockReply.status as any).mockReturnValue(mockReply);

      await expect(
        controller.create(mockRequest as FastifyRequest, mockReply as FastifyReply)
      ).rejects.toThrow();
    });

    it('should return 400 for invalid timezone', async () => {
      mockRequest.body = {
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@example.com',
        timezone: 'Invalid/Timezone',
      };

      (mockReply.status as any).mockReturnValue(mockReply);

      await expect(
        controller.create(mockRequest as FastifyRequest, mockReply as FastifyReply)
      ).rejects.toThrow();
    });

    it('should return 409 for duplicate email', async () => {
      const userData = {
        firstName: 'John',
        lastName: 'Doe',
        email: 'duplicate@example.com',
        timezone: 'America/New_York',
      };

      mockRequest.body = userData;
      (mockRepository.create as any).mockRejectedValue(
        new UniqueConstraintError('Email already exists', { email: userData.email })
      );

      await expect(
        controller.create(mockRequest as FastifyRequest, mockReply as FastifyReply)
      ).rejects.toThrow(UniqueConstraintError);
    });

    it('should preserve email case as provided', async () => {
      // Note: dto.ts schema does not normalize email case
      const userData = {
        firstName: 'John',
        lastName: 'Doe',
        email: 'John@Example.COM',
        timezone: 'America/New_York',
      };

      const createdUser = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        ...userData,
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
        birthdayDate: null,
        anniversaryDate: null,
        locationCity: null,
        locationCountry: null,
      };

      mockRequest.body = userData;
      (mockRepository.create as any).mockResolvedValue(createdUser);
      (mockReply.status as any).mockReturnValue(mockReply);

      await controller.create(mockRequest as FastifyRequest, mockReply as FastifyReply);

      const callArgs = (mockRepository.create as any).mock.calls[0][0];
      expect(callArgs.email).toBe('John@Example.COM');
    });

    it('should preserve whitespace in name fields as provided', async () => {
      // Note: dto.ts schema does not trim whitespace from name fields
      const userData = {
        firstName: '  John  ',
        lastName: '  Doe  ',
        email: 'john@example.com',
        timezone: 'America/New_York',
      };

      const createdUser = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        ...userData,
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
        birthdayDate: null,
        anniversaryDate: null,
        locationCity: null,
        locationCountry: null,
      };

      mockRequest.body = userData;
      (mockRepository.create as any).mockResolvedValue(createdUser);
      (mockReply.status as any).mockReturnValue(mockReply);

      await controller.create(mockRequest as FastifyRequest, mockReply as FastifyReply);

      const callArgs = (mockRepository.create as any).mock.calls[0][0];
      expect(callArgs.firstName).toBe('  John  ');
      expect(callArgs.lastName).toBe('  Doe  ');
    });
  });

  describe('getById', () => {
    it('should get user by ID', async () => {
      const userId = '123e4567-e89b-12d3-a456-426614174000';
      const user = {
        id: userId,
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@example.com',
        timezone: 'America/New_York',
        birthdayDate: new Date('1990-01-15'),
        anniversaryDate: null,
        locationCity: null,
        locationCountry: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
      };

      mockRequest.params = { id: userId };
      mockRequest.url = `/api/v1/users/${userId}`;
      (mockRepository.findById as any).mockResolvedValue(user);
      (mockReply.status as any).mockReturnValue(mockReply);

      await controller.getById(mockRequest as FastifyRequest, mockReply as FastifyReply);

      expect(mockRepository.findById).toHaveBeenCalledWith(userId);
      expect(mockReply.status).toHaveBeenCalledWith(200);
      expect(mockReply.send).toHaveBeenCalled();
    });

    it('should return 404 for non-existent user', async () => {
      const userId = '123e4567-e89b-12d3-a456-426614174000';

      mockRequest.params = { id: userId };
      mockRequest.url = `/api/v1/users/${userId}`;
      (mockRepository.findById as any).mockResolvedValue(null);
      (mockReply.status as any).mockReturnValue(mockReply);

      await controller.getById(mockRequest as FastifyRequest, mockReply as FastifyReply);

      expect(mockReply.status).toHaveBeenCalledWith(404);
      expect(mockReply.send).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.objectContaining({
            code: 'NOT_FOUND',
          }),
        })
      );
    });

    it('should not return soft-deleted users', async () => {
      const userId = '123e4567-e89b-12d3-a456-426614174000';

      mockRequest.params = { id: userId };
      mockRequest.url = `/api/v1/users/${userId}`;
      (mockRepository.findById as any).mockResolvedValue(null);
      (mockReply.status as any).mockReturnValue(mockReply);

      await controller.getById(mockRequest as FastifyRequest, mockReply as FastifyReply);

      expect(mockReply.status).toHaveBeenCalledWith(404);
    });
  });

  describe('update', () => {
    it('should update user with partial data', async () => {
      const userId = '123e4567-e89b-12d3-a456-426614174000';
      const updateData = {
        firstName: 'Jane',
        timezone: 'Europe/London',
      };

      const updatedUser = {
        id: userId,
        firstName: 'Jane',
        lastName: 'Doe',
        email: 'john@example.com',
        timezone: 'Europe/London',
        birthdayDate: new Date('1990-01-15'),
        anniversaryDate: null,
        locationCity: null,
        locationCountry: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
      };

      mockRequest.params = { id: userId };
      mockRequest.body = updateData;
      (mockRepository.update as any).mockResolvedValue(updatedUser);
      (mockReply.status as any).mockReturnValue(mockReply);

      await controller.update(mockRequest as FastifyRequest, mockReply as FastifyReply);

      expect(mockRepository.update).toHaveBeenCalledWith(userId, expect.any(Object));
      expect(mockReply.status).toHaveBeenCalledWith(200);
      expect(mockReply.send).toHaveBeenCalled();
    });

    it('should return 404 for non-existent user', async () => {
      const userId = '123e4567-e89b-12d3-a456-426614174000';

      mockRequest.params = { id: userId };
      mockRequest.body = { firstName: 'Jane' };
      (mockRepository.update as any).mockRejectedValue(
        new NotFoundError('User not found', { id: userId })
      );

      await expect(
        controller.update(mockRequest as FastifyRequest, mockReply as FastifyReply)
      ).rejects.toThrow(NotFoundError);
    });

    it('should return 409 for duplicate email', async () => {
      const userId = '123e4567-e89b-12d3-a456-426614174000';

      mockRequest.params = { id: userId };
      mockRequest.body = { email: 'existing@example.com' };
      (mockRepository.update as any).mockRejectedValue(
        new UniqueConstraintError('Email already exists', { email: 'existing@example.com' })
      );

      await expect(
        controller.update(mockRequest as FastifyRequest, mockReply as FastifyReply)
      ).rejects.toThrow(UniqueConstraintError);
    });

    it('should return 400 for invalid data', async () => {
      const userId = '123e4567-e89b-12d3-a456-426614174000';

      mockRequest.params = { id: userId };
      mockRequest.body = { email: 'invalid-email' };

      await expect(
        controller.update(mockRequest as FastifyRequest, mockReply as FastifyReply)
      ).rejects.toThrow();
    });

    it('should allow updating dates to undefined', async () => {
      // Note: dto.ts optionalDateSchema accepts undefined, not null
      const userId = '123e4567-e89b-12d3-a456-426614174000';
      const updateData = {
        birthdayDate: undefined,
        anniversaryDate: undefined,
      };

      const updatedUser = {
        id: userId,
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@example.com',
        timezone: 'America/New_York',
        birthdayDate: null,
        anniversaryDate: null,
        locationCity: null,
        locationCountry: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
      };

      mockRequest.params = { id: userId };
      mockRequest.body = updateData;
      (mockRepository.update as any).mockResolvedValue(updatedUser);
      (mockReply.status as any).mockReturnValue(mockReply);

      await controller.update(mockRequest as FastifyRequest, mockReply as FastifyReply);

      expect(mockReply.status).toHaveBeenCalledWith(200);
    });
  });

  describe('delete', () => {
    it('should soft delete user', async () => {
      const userId = '123e4567-e89b-12d3-a456-426614174000';

      mockRequest.params = { id: userId };
      (mockRepository.delete as any).mockResolvedValue({
        id: userId,
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@example.com',
        timezone: 'America/New_York',
        birthdayDate: null,
        anniversaryDate: null,
        locationCity: null,
        locationCountry: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: new Date(),
      });
      (mockReply.status as any).mockReturnValue(mockReply);

      await controller.delete(mockRequest as FastifyRequest, mockReply as FastifyReply);

      expect(mockRepository.delete).toHaveBeenCalledWith(userId);
      expect(mockReply.status).toHaveBeenCalledWith(200);
      expect(mockReply.send).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({
            message: 'User deleted successfully',
            userId: userId,
          }),
        })
      );
    });

    it('should return 404 for non-existent user', async () => {
      const userId = '123e4567-e89b-12d3-a456-426614174000';

      mockRequest.params = { id: userId };
      (mockRepository.delete as any).mockRejectedValue(
        new NotFoundError('User not found', { id: userId })
      );

      await expect(
        controller.delete(mockRequest as FastifyRequest, mockReply as FastifyReply)
      ).rejects.toThrow(NotFoundError);
    });

    it('should return 404 for already deleted user', async () => {
      const userId = '123e4567-e89b-12d3-a456-426614174000';

      mockRequest.params = { id: userId };
      (mockRepository.delete as any).mockRejectedValue(
        new NotFoundError('User not found', { id: userId })
      );

      await expect(
        controller.delete(mockRequest as FastifyRequest, mockReply as FastifyReply)
      ).rejects.toThrow(NotFoundError);
    });
  });
});
