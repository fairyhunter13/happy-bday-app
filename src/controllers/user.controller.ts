/**
 * User Controller
 *
 * REST API endpoints for User CRUD operations:
 * - POST /api/v1/users - Create user
 * - GET /api/v1/users/:id - Get user by ID
 * - PUT /api/v1/users/:id - Update user
 * - DELETE /api/v1/users/:id - Soft delete user
 */

import type { FastifyReply, FastifyRequest } from 'fastify';
import { UserRepository } from '../repositories/user.repository.js';
import { MessageRescheduleService } from '../services/message-reschedule.service.js';
import { createUserSchema, updateUserSchema } from '../types/dto.js';
import { createSuccessResponse } from '../utils/response.js';
import { ValidationError } from '../utils/errors.js';
import { logger } from '../config/logger.js';

/**
 * Request interfaces for type safety
 */
interface CreateUserRequest {
  Body: unknown;
}

interface GetUserRequest {
  Params: {
    id: string;
  };
}

interface UpdateUserRequest {
  Params: {
    id: string;
  };
  Body: unknown;
}

interface DeleteUserRequest {
  Params: {
    id: string;
  };
}

/**
 * User Controller class
 * Handles all user-related HTTP requests
 */
export class UserController {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly messageRescheduleService: MessageRescheduleService = new MessageRescheduleService()
  ) {}

  /**
   * Create a new user
   * POST /api/v1/users
   *
   * @param request - Fastify request with user data in body
   * @param reply - Fastify reply
   * @returns 201 Created with user data
   * @throws 400 Bad Request on validation error
   * @throws 409 Conflict if email already exists
   */
  async create(request: FastifyRequest<CreateUserRequest>, reply: FastifyReply): Promise<void> {
    // Validate request body
    const validationResult = createUserSchema.safeParse(request.body);

    if (!validationResult.success) {
      throw new ValidationError('Invalid user data', {
        errors: validationResult.error.format(),
      });
    }

    const userData = validationResult.data;

    logger.info({ email: userData.email }, 'Creating new user');

    // Create user via repository
    const user = await this.userRepository.create(userData);

    logger.info({ userId: user.id, email: user.email }, 'User created successfully');

    // Return 201 Created
    await reply.status(201).send(createSuccessResponse(user));
  }

  /**
   * Get user by ID
   * GET /api/v1/users/:id
   *
   * @param request - Fastify request with user ID in params
   * @param reply - Fastify reply
   * @returns 200 OK with user data
   * @throws 404 Not Found if user doesn't exist
   */
  async getById(request: FastifyRequest<GetUserRequest>, reply: FastifyReply): Promise<void> {
    const { id } = request.params;

    logger.debug({ userId: id }, 'Fetching user by ID');

    const user = await this.userRepository.findById(id);

    if (!user) {
      await reply.status(404).send({
        error: {
          code: 'NOT_FOUND',
          message: `User with ID ${id} not found`,
        },
        timestamp: new Date().toISOString(),
        path: request.url,
      });
      return;
    }

    await reply.status(200).send(createSuccessResponse(user));
  }

  /**
   * Update user by ID
   * PUT /api/v1/users/:id
   *
   * @param request - Fastify request with user ID in params and update data in body
   * @param reply - Fastify reply
   * @returns 200 OK with updated user data
   * @throws 400 Bad Request on validation error
   * @throws 404 Not Found if user doesn't exist
   * @throws 409 Conflict if email already exists
   */
  async update(request: FastifyRequest<UpdateUserRequest>, reply: FastifyReply): Promise<void> {
    const { id } = request.params;

    // Validate request body
    const validationResult = updateUserSchema.safeParse(request.body);

    if (!validationResult.success) {
      throw new ValidationError('Invalid user data', {
        errors: validationResult.error.format(),
      });
    }

    const updateData = validationResult.data;

    logger.info({ userId: id, updates: Object.keys(updateData) }, 'Updating user');

    // Update user via repository
    const updatedUser = await this.userRepository.update(id, updateData);

    logger.info({ userId: id }, 'User updated successfully');

    // Trigger message rescheduling if timezone or dates changed
    if (
      updateData.timezone ||
      updateData.birthdayDate !== undefined ||
      updateData.anniversaryDate !== undefined
    ) {
      logger.info({ userId: id }, 'User dates/timezone updated - triggering message rescheduling');

      try {
        const rescheduleResult = await this.messageRescheduleService.rescheduleMessagesForUser(id, {
          timezone: updateData.timezone,
          birthdayDate: updateData.birthdayDate,
          anniversaryDate: updateData.anniversaryDate,
        });

        logger.info(
          {
            userId: id,
            deletedMessages: rescheduleResult.deletedMessages,
            rescheduledMessages: rescheduleResult.rescheduledMessages,
            success: rescheduleResult.success,
          },
          'Message rescheduling completed'
        );
      } catch (error) {
        // Log error but don't fail the user update
        logger.error(
          {
            userId: id,
            error: error instanceof Error ? error.message : String(error),
          },
          'Message rescheduling failed, but user update succeeded'
        );
      }
    }

    await reply.status(200).send(createSuccessResponse(updatedUser));
  }

  /**
   * Soft delete user by ID
   * DELETE /api/v1/users/:id
   *
   * @param request - Fastify request with user ID in params
   * @param reply - Fastify reply
   * @returns 200 OK with success message
   * @throws 404 Not Found if user doesn't exist
   */
  async delete(request: FastifyRequest<DeleteUserRequest>, reply: FastifyReply): Promise<void> {
    const { id } = request.params;

    logger.info({ userId: id }, 'Soft deleting user');

    // Soft delete user via repository
    await this.userRepository.delete(id);

    logger.info({ userId: id }, 'User deleted successfully');

    // Return success message
    await reply.status(200).send(
      createSuccessResponse({
        message: 'User deleted successfully',
        userId: id,
      })
    );
  }
}

// Export singleton instance
export const userController = new UserController(new UserRepository());
