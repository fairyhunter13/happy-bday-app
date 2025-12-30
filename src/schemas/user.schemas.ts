/**
 * User API Schemas
 *
 * OpenAPI 3.1 schemas for user management endpoints.
 * Includes comprehensive examples and descriptions.
 */

import {
  SuccessResponseSchema,
  UuidParamSchema,
  TimezoneSchema,
  DateStringSchema,
  NullableDateStringSchema,
  EmailSchema,
} from './common.schemas.js';
import {
  BadRequestSchema,
  NotFoundSchema,
  ConflictSchema,
  RateLimitSchema,
  InternalServerErrorSchema,
} from './error.schemas.js';

/**
 * User object schema with all fields
 */
export const UserSchema = {
  type: 'object',
  required: ['id', 'firstName', 'lastName', 'email', 'timezone', 'createdAt', 'updatedAt'],
  properties: {
    id: {
      type: 'string',
      format: 'uuid',
      description: 'Unique user identifier',
      example: '550e8400-e29b-41d4-a716-446655440000',
    },
    firstName: {
      type: 'string',
      minLength: 1,
      maxLength: 100,
      description: "User's first name",
      example: 'John',
    },
    lastName: {
      type: 'string',
      minLength: 1,
      maxLength: 100,
      description: "User's last name",
      example: 'Doe',
    },
    email: {
      ...EmailSchema,
      description: "User's email address (must be unique)",
      example: 'john.doe@example.com',
    },
    timezone: {
      ...TimezoneSchema,
      description: "User's timezone for message scheduling",
      example: 'America/New_York',
    },
    birthdayDate: {
      ...NullableDateStringSchema,
      description: "User's birthday (month and day used for scheduling)",
      example: '1990-01-15',
    },
    anniversaryDate: {
      ...NullableDateStringSchema,
      description: "User's anniversary date",
      example: '2015-06-20',
    },
    locationCity: {
      type: 'string',
      maxLength: 100,
      nullable: true,
      description: "User's city",
      example: 'New York',
    },
    locationCountry: {
      type: 'string',
      maxLength: 100,
      nullable: true,
      description: "User's country",
      example: 'United States',
    },
    createdAt: {
      type: 'string',
      format: 'date-time',
      description: 'Timestamp when user was created',
      example: '2025-12-30T10:00:00.000Z',
    },
    updatedAt: {
      type: 'string',
      format: 'date-time',
      description: 'Timestamp when user was last updated',
      example: '2025-12-30T10:30:00.000Z',
    },
    deletedAt: {
      type: 'string',
      format: 'date-time',
      nullable: true,
      description: 'Timestamp when user was soft deleted (null if active)',
      example: null,
    },
  },
  examples: [
    {
      id: '550e8400-e29b-41d4-a716-446655440000',
      firstName: 'John',
      lastName: 'Doe',
      email: 'john.doe@example.com',
      timezone: 'America/New_York',
      birthdayDate: '1990-01-15',
      anniversaryDate: '2015-06-20',
      locationCity: 'New York',
      locationCountry: 'United States',
      createdAt: '2025-12-30T10:00:00.000Z',
      updatedAt: '2025-12-30T10:00:00.000Z',
      deletedAt: null,
    },
    {
      id: '6ba7b810-9dad-11d1-80b4-00c04fd430c8',
      firstName: 'Jane',
      lastName: 'Smith',
      email: 'jane.smith@example.com',
      timezone: 'Europe/London',
      birthdayDate: '1985-03-22',
      anniversaryDate: null,
      locationCity: 'London',
      locationCountry: 'United Kingdom',
      createdAt: '2025-12-30T09:00:00.000Z',
      updatedAt: '2025-12-30T09:00:00.000Z',
      deletedAt: null,
    },
  ],
} as const;

/**
 * Create user request body schema
 */
export const CreateUserBodySchema = {
  type: 'object',
  required: ['firstName', 'lastName', 'email', 'timezone'],
  properties: {
    firstName: {
      type: 'string',
      minLength: 1,
      maxLength: 100,
      description: "User's first name",
      example: 'John',
    },
    lastName: {
      type: 'string',
      minLength: 1,
      maxLength: 100,
      description: "User's last name",
      example: 'Doe',
    },
    email: {
      ...EmailSchema,
      description: "User's email address (must be unique across all users)",
      example: 'john.doe@example.com',
    },
    timezone: {
      ...TimezoneSchema,
      description: "User's IANA timezone for scheduling messages at 9 AM local time",
      example: 'America/New_York',
    },
    birthdayDate: {
      ...DateStringSchema,
      description: 'Optional birthday date (year is stored but only month/day used for scheduling)',
      example: '1990-01-15',
    },
    anniversaryDate: {
      ...DateStringSchema,
      description: 'Optional anniversary date',
      example: '2015-06-20',
    },
    locationCity: {
      type: 'string',
      maxLength: 100,
      description: "Optional user's city",
      example: 'New York',
    },
    locationCountry: {
      type: 'string',
      maxLength: 100,
      description: "Optional user's country",
      example: 'United States',
    },
  },
  examples: [
    {
      summary: 'Minimal user (required fields only)',
      value: {
        firstName: 'John',
        lastName: 'Doe',
        email: 'john.doe@example.com',
        timezone: 'America/New_York',
      },
    },
    {
      summary: 'User with birthday',
      value: {
        firstName: 'Jane',
        lastName: 'Smith',
        email: 'jane.smith@example.com',
        timezone: 'Europe/London',
        birthdayDate: '1985-03-22',
        locationCity: 'London',
        locationCountry: 'United Kingdom',
      },
    },
    {
      summary: 'Complete user profile',
      value: {
        firstName: 'Alice',
        lastName: 'Johnson',
        email: 'alice.johnson@example.com',
        timezone: 'Asia/Tokyo',
        birthdayDate: '1992-07-08',
        anniversaryDate: '2018-11-15',
        locationCity: 'Tokyo',
        locationCountry: 'Japan',
      },
    },
  ],
} as const;

/**
 * Update user request body schema
 */
export const UpdateUserBodySchema = {
  type: 'object',
  properties: {
    firstName: {
      type: 'string',
      minLength: 1,
      maxLength: 100,
      description: "User's first name",
      example: 'John',
    },
    lastName: {
      type: 'string',
      minLength: 1,
      maxLength: 100,
      description: "User's last name",
      example: 'Doe',
    },
    email: {
      ...EmailSchema,
      description: "User's email address (must be unique)",
      example: 'john.updated@example.com',
    },
    timezone: {
      ...TimezoneSchema,
      description: "User's timezone",
      example: 'America/Los_Angeles',
    },
    birthdayDate: {
      ...NullableDateStringSchema,
      description: 'Birthday date (set to null to remove)',
      example: '1990-01-15',
    },
    anniversaryDate: {
      ...NullableDateStringSchema,
      description: 'Anniversary date (set to null to remove)',
      example: null,
    },
    locationCity: {
      type: 'string',
      maxLength: 100,
      nullable: true,
      description: 'City (set to null to remove)',
      example: 'San Francisco',
    },
    locationCountry: {
      type: 'string',
      maxLength: 100,
      nullable: true,
      description: 'Country (set to null to remove)',
      example: 'United States',
    },
  },
  examples: [
    {
      summary: 'Update email',
      value: {
        email: 'newemail@example.com',
      },
    },
    {
      summary: 'Update timezone',
      value: {
        timezone: 'America/Los_Angeles',
      },
    },
    {
      summary: 'Update multiple fields',
      value: {
        firstName: 'Jonathan',
        locationCity: 'San Francisco',
        locationCountry: 'United States',
      },
    },
    {
      summary: 'Remove optional fields',
      value: {
        anniversaryDate: null,
        locationCity: null,
        locationCountry: null,
      },
    },
  ],
} as const;

/**
 * User success response schema
 */
export const UserSuccessResponseSchema = {
  type: 'object',
  required: ['success', 'data', 'timestamp'],
  properties: {
    success: {
      type: 'boolean',
      description: 'Indicates successful operation',
      example: true,
    },
    data: UserSchema,
    timestamp: {
      type: 'string',
      format: 'date-time',
      description: 'Response timestamp',
      example: '2025-12-30T10:30:00.000Z',
    },
  },
} as const;

/**
 * Delete user success response
 */
export const DeleteUserSuccessResponseSchema = {
  type: 'object',
  required: ['success', 'data', 'timestamp'],
  properties: {
    success: {
      type: 'boolean',
      example: true,
    },
    data: {
      type: 'object',
      properties: {
        message: {
          type: 'string',
          example: 'User deleted successfully',
        },
      },
    },
    timestamp: {
      type: 'string',
      format: 'date-time',
      example: '2025-12-30T10:30:00.000Z',
    },
  },
} as const;

// Export route schemas
export const CreateUserRouteSchema = {
  tags: ['users'],
  summary: 'Create a new user',
  description: `Create a new user with birthday and anniversary tracking.

**Features:**
- Email must be unique across all users (including soft-deleted users)
- Timezone is used to schedule messages at 9 AM local time
- Birthday and anniversary dates are optional
- Supports soft delete (deleted users can reuse email after deletion)

**Rate Limit:** 10 requests per minute`,
  operationId: 'createUser',
  body: CreateUserBodySchema,
  response: {
    201: {
      description: 'User created successfully',
      content: {
        'application/json': {
          schema: UserSuccessResponseSchema,
          examples: {
            created: {
              summary: 'User created',
              value: {
                success: true,
                data: {
                  id: '550e8400-e29b-41d4-a716-446655440000',
                  firstName: 'John',
                  lastName: 'Doe',
                  email: 'john.doe@example.com',
                  timezone: 'America/New_York',
                  birthdayDate: '1990-01-15',
                  anniversaryDate: '2015-06-20',
                  locationCity: 'New York',
                  locationCountry: 'United States',
                  createdAt: '2025-12-30T10:00:00.000Z',
                  updatedAt: '2025-12-30T10:00:00.000Z',
                  deletedAt: null,
                },
                timestamp: '2025-12-30T10:00:00.000Z',
              },
            },
          },
        },
      },
    },
    400: {
      description: 'Bad Request - Invalid input data',
      content: {
        'application/json': {
          schema: BadRequestSchema,
        },
      },
    },
    409: {
      description: 'Conflict - Email already exists',
      content: {
        'application/json': {
          schema: ConflictSchema,
        },
      },
    },
    429: {
      description: 'Too Many Requests - Rate limit exceeded',
      content: {
        'application/json': {
          schema: RateLimitSchema,
        },
      },
    },
    500: {
      description: 'Internal Server Error',
      content: {
        'application/json': {
          schema: InternalServerErrorSchema,
        },
      },
    },
  },
} as const;

export const GetUserRouteSchema = {
  tags: ['users'],
  summary: 'Get user by ID',
  description: `Retrieve user information by user ID.

**Features:**
- Returns full user profile including optional fields
- Excludes soft-deleted users (returns 404)

**Rate Limit:** 100 requests per minute`,
  operationId: 'getUserById',
  params: UuidParamSchema,
  response: {
    200: {
      description: 'User found',
      content: {
        'application/json': {
          schema: UserSuccessResponseSchema,
        },
      },
    },
    404: {
      description: 'Not Found - User does not exist or was deleted',
      content: {
        'application/json': {
          schema: NotFoundSchema,
        },
      },
    },
    429: {
      description: 'Too Many Requests',
      content: {
        'application/json': {
          schema: RateLimitSchema,
        },
      },
    },
    500: {
      description: 'Internal Server Error',
      content: {
        'application/json': {
          schema: InternalServerErrorSchema,
        },
      },
    },
  },
} as const;

export const UpdateUserRouteSchema = {
  tags: ['users'],
  summary: 'Update user',
  description: `Update user information. Supports partial updates (all fields optional).

**Features:**
- Partial updates supported - only send fields you want to change
- Email must remain unique if changed
- Set optional fields to null to remove them
- Changing timezone reschedules future messages

**Rate Limit:** 20 requests per minute`,
  operationId: 'updateUser',
  params: UuidParamSchema,
  body: UpdateUserBodySchema,
  response: {
    200: {
      description: 'User updated successfully',
      content: {
        'application/json': {
          schema: UserSuccessResponseSchema,
        },
      },
    },
    400: {
      description: 'Bad Request - Invalid input data',
      content: {
        'application/json': {
          schema: BadRequestSchema,
        },
      },
    },
    404: {
      description: 'Not Found - User does not exist',
      content: {
        'application/json': {
          schema: NotFoundSchema,
        },
      },
    },
    409: {
      description: 'Conflict - Email already exists',
      content: {
        'application/json': {
          schema: ConflictSchema,
        },
      },
    },
    429: {
      description: 'Too Many Requests',
      content: {
        'application/json': {
          schema: RateLimitSchema,
        },
      },
    },
    500: {
      description: 'Internal Server Error',
      content: {
        'application/json': {
          schema: InternalServerErrorSchema,
        },
      },
    },
  },
} as const;

export const DeleteUserRouteSchema = {
  tags: ['users'],
  summary: 'Delete user (soft delete)',
  description: `Soft delete a user. The user is marked as deleted but not removed from the database.

**Features:**
- Soft delete - sets deletedAt timestamp
- User data is retained for audit purposes
- Email can be reused after deletion
- Future scheduled messages are cancelled

**Rate Limit:** 10 requests per minute`,
  operationId: 'deleteUser',
  params: UuidParamSchema,
  response: {
    200: {
      description: 'User deleted successfully',
      content: {
        'application/json': {
          schema: DeleteUserSuccessResponseSchema,
          examples: {
            deleted: {
              summary: 'User deleted',
              value: {
                success: true,
                data: {
                  message: 'User deleted successfully',
                },
                timestamp: '2025-12-30T10:30:00.000Z',
              },
            },
          },
        },
      },
    },
    404: {
      description: 'Not Found - User does not exist',
      content: {
        'application/json': {
          schema: NotFoundSchema,
        },
      },
    },
    429: {
      description: 'Too Many Requests',
      content: {
        'application/json': {
          schema: RateLimitSchema,
        },
      },
    },
    500: {
      description: 'Internal Server Error',
      content: {
        'application/json': {
          schema: InternalServerErrorSchema,
        },
      },
    },
  },
} as const;
