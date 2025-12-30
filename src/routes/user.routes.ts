/**
 * User Routes
 *
 * REST API routes for user management with OpenAPI documentation
 */

import type { FastifyInstance, FastifyPluginOptions } from 'fastify';
import { userController } from '../controllers/user.controller.js';

/**
 * OpenAPI schemas for request/response validation
 */
const userSchema = {
  type: 'object',
  properties: {
    id: { type: 'string', format: 'uuid' },
    firstName: { type: 'string' },
    lastName: { type: 'string' },
    email: { type: 'string', format: 'email' },
    timezone: { type: 'string', example: 'America/New_York' },
    birthdayDate: { type: 'string', format: 'date', nullable: true },
    anniversaryDate: { type: 'string', format: 'date', nullable: true },
    locationCity: { type: 'string', nullable: true },
    locationCountry: { type: 'string', nullable: true },
    createdAt: { type: 'string', format: 'date-time' },
    updatedAt: { type: 'string', format: 'date-time' },
    deletedAt: { type: 'string', format: 'date-time', nullable: true },
  },
};

const createUserSchema = {
  type: 'object',
  required: ['firstName', 'lastName', 'email', 'timezone'],
  properties: {
    firstName: { type: 'string', minLength: 1, maxLength: 100 },
    lastName: { type: 'string', minLength: 1, maxLength: 100 },
    email: { type: 'string', format: 'email', maxLength: 255 },
    timezone: { type: 'string', example: 'America/New_York' },
    birthdayDate: { type: 'string', format: 'date', example: '1990-01-15' },
    anniversaryDate: { type: 'string', format: 'date', example: '2015-06-20' },
    locationCity: { type: 'string', maxLength: 100 },
    locationCountry: { type: 'string', maxLength: 100 },
  },
};

const updateUserSchema = {
  type: 'object',
  properties: {
    firstName: { type: 'string', minLength: 1, maxLength: 100 },
    lastName: { type: 'string', minLength: 1, maxLength: 100 },
    email: { type: 'string', format: 'email', maxLength: 255 },
    timezone: { type: 'string', example: 'America/New_York' },
    birthdayDate: { type: 'string', format: 'date', nullable: true },
    anniversaryDate: { type: 'string', format: 'date', nullable: true },
    locationCity: { type: 'string', maxLength: 100, nullable: true },
    locationCountry: { type: 'string', maxLength: 100, nullable: true },
  },
};

const successResponseSchema = {
  type: 'object',
  properties: {
    success: { type: 'boolean', example: true },
    data: { type: 'object' },
    timestamp: { type: 'string', format: 'date-time' },
  },
};

const errorResponseSchema = {
  type: 'object',
  properties: {
    error: {
      type: 'object',
      properties: {
        code: { type: 'string' },
        message: { type: 'string' },
        details: { type: 'object' },
      },
    },
    timestamp: { type: 'string', format: 'date-time' },
    path: { type: 'string' },
  },
};

/**
 * Register user routes with Fastify
 */
export async function userRoutes(
  fastify: FastifyInstance,
  _options: FastifyPluginOptions
): Promise<void> {
  /**
   * POST /api/v1/users - Create new user
   */
  fastify.post(
    '/users',
    {
      schema: {
        tags: ['users'],
        summary: 'Create a new user',
        description: 'Create a new user with birthday and anniversary tracking',
        body: createUserSchema,
        response: {
          201: {
            description: 'User created successfully',
            ...successResponseSchema,
            properties: {
              ...successResponseSchema.properties,
              data: userSchema,
            },
          },
          400: {
            description: 'Validation error',
            ...errorResponseSchema,
          },
          409: {
            description: 'Email already exists',
            ...errorResponseSchema,
          },
        },
      },
      config: {
        rateLimit: {
          max: 10,
          timeWindow: '1 minute',
        },
      },
    },
    userController.create.bind(userController)
  );

  /**
   * GET /api/v1/users/:id - Get user by ID
   */
  fastify.get(
    '/users/:id',
    {
      schema: {
        tags: ['users'],
        summary: 'Get user by ID',
        description: 'Retrieve user information by user ID',
        params: {
          type: 'object',
          required: ['id'],
          properties: {
            id: { type: 'string', format: 'uuid', description: 'User ID' },
          },
        },
        response: {
          200: {
            description: 'User found',
            ...successResponseSchema,
            properties: {
              ...successResponseSchema.properties,
              data: userSchema,
            },
          },
          404: {
            description: 'User not found',
            ...errorResponseSchema,
          },
        },
      },
      config: {
        rateLimit: {
          max: 100,
          timeWindow: '1 minute',
        },
      },
    },
    userController.getById.bind(userController)
  );

  /**
   * PUT /api/v1/users/:id - Update user
   */
  fastify.put(
    '/users/:id',
    {
      schema: {
        tags: ['users'],
        summary: 'Update user',
        description: 'Update user information (partial updates supported)',
        params: {
          type: 'object',
          required: ['id'],
          properties: {
            id: { type: 'string', format: 'uuid', description: 'User ID' },
          },
        },
        body: updateUserSchema,
        response: {
          200: {
            description: 'User updated successfully',
            ...successResponseSchema,
            properties: {
              ...successResponseSchema.properties,
              data: userSchema,
            },
          },
          400: {
            description: 'Validation error',
            ...errorResponseSchema,
          },
          404: {
            description: 'User not found',
            ...errorResponseSchema,
          },
          409: {
            description: 'Email already exists',
            ...errorResponseSchema,
          },
        },
      },
      config: {
        rateLimit: {
          max: 20,
          timeWindow: '1 minute',
        },
      },
    },
    userController.update.bind(userController)
  );

  /**
   * DELETE /api/v1/users/:id - Soft delete user
   */
  fastify.delete(
    '/users/:id',
    {
      schema: {
        tags: ['users'],
        summary: 'Delete user',
        description: 'Soft delete user (marks as deleted without removing from database)',
        params: {
          type: 'object',
          required: ['id'],
          properties: {
            id: { type: 'string', format: 'uuid', description: 'User ID' },
          },
        },
        response: {
          200: {
            description: 'User deleted successfully',
            ...successResponseSchema,
          },
          404: {
            description: 'User not found',
            ...errorResponseSchema,
          },
        },
      },
      config: {
        rateLimit: {
          max: 10,
          timeWindow: '1 minute',
        },
      },
    },
    userController.delete.bind(userController)
  );
}
