/**
 * Data Transfer Objects (DTOs) with Zod validation schemas
 *
 * Design considerations:
 * - Zod schemas for runtime validation and type inference
 * - Separate types for Create/Update operations (different required fields)
 * - Timezone validation using IANA timezone database
 * - Email validation using RFC 5322 regex
 * - Date validation for birthday/anniversary dates
 */

import { z } from 'zod';
import { IANAZone } from 'luxon';
import { MessageStatus, MessageType } from '../db/schema/message-logs.js';

/**
 * IANA timezone validation
 * Uses Luxon's IANAZone.isValidZone() for proper timezone validation
 * Common examples: "America/New_York", "Europe/London", "Asia/Tokyo"
 */
const timezoneSchema = z.string().refine(
  (tz) => {
    try {
      // Use IANAZone.isValidZone() to properly validate IANA timezones
      // This correctly rejects invalid timezones like "Invalid/Timezone"
      return IANAZone.isValidZone(tz);
    } catch {
      return false;
    }
  },
  {
    message: 'Invalid IANA timezone format (e.g., "America/New_York", "Europe/London")',
  }
);

/**
 * Email validation using RFC 5322 simplified regex
 */
const emailSchema = z.string().email('Invalid email format');

/**
 * UUID validation
 */
const uuidSchema = z.string().uuid('Invalid UUID format');

/**
 * Date validation - accepts Date object, ISO datetime string, or date string (YYYY-MM-DD)
 */
const dateSchema = z.union([
  z.date(),
  z
    .string()
    .datetime()
    .transform((str) => new Date(str)),
  z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format')
    .transform((str) => new Date(str)),
]);

/**
 * Optional date validation - accepts Date object, ISO datetime string, date string, or undefined
 */
const optionalDateSchema = z.union([
  z.date(),
  z
    .string()
    .datetime()
    .transform((str) => new Date(str)),
  z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format')
    .transform((str) => new Date(str)),
  z.undefined(),
]);

// ============================================================================
// User DTOs
// ============================================================================

/**
 * Create User DTO
 * Used for POST /api/users
 */
export const createUserSchema = z.object({
  firstName: z.string().min(1).max(100, 'First name must be 100 characters or less'),
  lastName: z.string().min(1).max(100, 'Last name must be 100 characters or less'),
  email: emailSchema,
  timezone: timezoneSchema,
  birthdayDate: optionalDateSchema,
  anniversaryDate: optionalDateSchema,
  locationCity: z.string().max(100).optional(),
  locationCountry: z.string().max(100).optional(),
});

export type CreateUserDto = z.infer<typeof createUserSchema>;

/**
 * Update User DTO
 * Used for PATCH /api/users/:id
 * All fields are optional for partial updates
 */
export const updateUserSchema = z.object({
  firstName: z.string().min(1).max(100).optional(),
  lastName: z.string().min(1).max(100).optional(),
  email: emailSchema.optional(),
  timezone: timezoneSchema.optional(),
  birthdayDate: optionalDateSchema,
  anniversaryDate: optionalDateSchema,
  locationCity: z.string().max(100).optional(),
  locationCountry: z.string().max(100).optional(),
});

export type UpdateUserDto = z.infer<typeof updateUserSchema>;

/**
 * User filters for findAll()
 */
export const userFiltersSchema = z.object({
  email: z.string().optional(),
  timezone: z.string().optional(),
  hasBirthday: z.boolean().optional(),
  hasAnniversary: z.boolean().optional(),
  limit: z.number().int().min(1).max(100).default(10),
  offset: z.number().int().min(0).default(0),
});

export type UserFiltersDto = z.infer<typeof userFiltersSchema>;

// ============================================================================
// Message Log DTOs
// ============================================================================

/**
 * Message status enum validation
 */
const messageStatusSchema = z.enum([
  MessageStatus.SCHEDULED,
  MessageStatus.QUEUED,
  MessageStatus.SENDING,
  MessageStatus.SENT,
  MessageStatus.FAILED,
  MessageStatus.RETRYING,
]);

/**
 * Message type enum validation
 */
const messageTypeSchema = z.enum([MessageType.BIRTHDAY, MessageType.ANNIVERSARY]);

/**
 * Create Message Log DTO
 * Used for creating scheduled messages
 */
export const createMessageLogSchema = z.object({
  userId: uuidSchema,
  messageType: messageTypeSchema,
  messageContent: z.string().min(1, 'Message content cannot be empty'),
  scheduledSendTime: dateSchema,
  idempotencyKey: z.string().min(1).max(255),
  status: messageStatusSchema.default(MessageStatus.SCHEDULED),
  retryCount: z.number().int().min(0).default(0),
});

export type CreateMessageLogDto = z.infer<typeof createMessageLogSchema>;

/**
 * Update Message Log DTO
 * Used for updating message status/metadata
 */
export const updateMessageLogSchema = z.object({
  status: messageStatusSchema.optional(),
  actualSendTime: optionalDateSchema,
  retryCount: z.number().int().min(0).optional(),
  lastRetryAt: optionalDateSchema,
  apiResponseCode: z.number().int().optional(),
  apiResponseBody: z.string().optional(),
  errorMessage: z.string().optional(),
});

export type UpdateMessageLogDto = z.infer<typeof updateMessageLogSchema>;

/**
 * Mark as sent DTO
 * Used when message is successfully delivered
 */
export const markAsSentSchema = z.object({
  apiResponseCode: z.number().int(),
  apiResponseBody: z.string(),
});

export type MarkAsSentDto = z.infer<typeof markAsSentSchema>;

/**
 * Mark as failed DTO
 * Used when message delivery fails
 */
export const markAsFailedSchema = z.object({
  errorMessage: z.string().min(1),
  apiResponseCode: z.number().int().optional(),
  apiResponseBody: z.string().optional(),
});

export type MarkAsFailedDto = z.infer<typeof markAsFailedSchema>;

/**
 * Message log filters for queries
 */
export const messageLogFiltersSchema = z.object({
  userId: uuidSchema.optional(),
  messageType: messageTypeSchema.optional(),
  status: messageStatusSchema.optional(),
  scheduledAfter: optionalDateSchema,
  scheduledBefore: optionalDateSchema,
  limit: z.number().int().min(1).max(1000).default(100),
  offset: z.number().int().min(0).default(0),
});

export type MessageLogFiltersDto = z.infer<typeof messageLogFiltersSchema>;
