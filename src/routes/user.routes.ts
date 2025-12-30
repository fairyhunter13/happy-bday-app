/**
 * User Routes
 *
 * REST API routes for user management with comprehensive OpenAPI 3.1 documentation
 */

import type { FastifyInstance, FastifyPluginOptions } from 'fastify';
import { userController } from '../controllers/user.controller.js';
import {
  CreateUserRouteSchema,
  GetUserRouteSchema,
  UpdateUserRouteSchema,
  DeleteUserRouteSchema,
} from '../schemas/index.js';

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
      schema: CreateUserRouteSchema,
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
      schema: GetUserRouteSchema,
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
      schema: UpdateUserRouteSchema,
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
      schema: DeleteUserRouteSchema,
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
