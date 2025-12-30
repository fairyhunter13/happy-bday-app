import { z } from 'zod';
import { DateTime } from 'luxon';

/**
 * User validation schemas using Zod
 * Validates user input for create/update operations
 */

/**
 * Custom validator for IANA timezone format
 */
const timezoneSchema = z.string().refine(
  (tz) => {
    try {
      // Validate using Luxon's timezone list
      const dt = DateTime.now().setZone(tz);
      return dt.isValid;
    } catch {
      return false;
    }
  },
  {
    message: 'Invalid IANA timezone format (e.g., "America/New_York", "Europe/London")',
  }
);

/**
 * Custom validator for date strings (YYYY-MM-DD)
 */
const dateStringSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format')
  .refine(
    (dateStr) => {
      try {
        const dt = DateTime.fromISO(dateStr);
        return dt.isValid;
      } catch {
        return false;
      }
    },
    {
      message: 'Invalid date value',
    }
  );

/**
 * Schema for creating a new user
 */
export const createUserSchema = z.object({
  firstName: z
    .string()
    .min(1, 'First name is required')
    .max(100, 'First name must be at most 100 characters')
    .trim(),

  lastName: z
    .string()
    .min(1, 'Last name is required')
    .max(100, 'Last name must be at most 100 characters')
    .trim(),

  email: z
    .string()
    .email('Invalid email format')
    .max(255, 'Email must be at most 255 characters')
    .toLowerCase()
    .trim(),

  timezone: timezoneSchema,

  birthdayDate: dateStringSchema.optional(),

  anniversaryDate: dateStringSchema.optional(),

  locationCity: z.string().max(100, 'City must be at most 100 characters').trim().optional(),

  locationCountry: z.string().max(100, 'Country must be at most 100 characters').trim().optional(),
});

/**
 * Schema for updating a user
 * All fields are optional for partial updates
 */
export const updateUserSchema = z.object({
  firstName: z
    .string()
    .min(1, 'First name cannot be empty')
    .max(100, 'First name must be at most 100 characters')
    .trim()
    .optional(),

  lastName: z
    .string()
    .min(1, 'Last name cannot be empty')
    .max(100, 'Last name must be at most 100 characters')
    .trim()
    .optional(),

  email: z
    .string()
    .email('Invalid email format')
    .max(255, 'Email must be at most 255 characters')
    .toLowerCase()
    .trim()
    .optional(),

  timezone: timezoneSchema.optional(),

  birthdayDate: dateStringSchema.nullable().optional(),

  anniversaryDate: dateStringSchema.nullable().optional(),

  locationCity: z
    .string()
    .max(100, 'City must be at most 100 characters')
    .trim()
    .nullable()
    .optional(),

  locationCountry: z
    .string()
    .max(100, 'Country must be at most 100 characters')
    .trim()
    .nullable()
    .optional(),
});

/**
 * Schema for user ID parameter validation
 */
export const userIdParamSchema = z.object({
  id: z.string().uuid('Invalid user ID format'),
});

// Type inference for TypeScript
export type CreateUserInput = z.infer<typeof createUserSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
export type UserIdParam = z.infer<typeof userIdParamSchema>;
