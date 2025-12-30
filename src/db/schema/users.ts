import { pgTable, uuid, varchar, date, timestamp, index } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

/**
 * Users table - stores user information with birthday/anniversary dates
 *
 * Design considerations:
 * - IANA timezone storage (e.g., "America/New_York") for DST handling
 * - Soft delete support via deleted_at
 * - Separate date fields for different message types (birthday_date, anniversary_date)
 * - Partial indexes for performance (only non-deleted users)
 */
export const users = pgTable(
  'users',
  {
    id: uuid('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),

    firstName: varchar('first_name', { length: 100 }).notNull(),

    lastName: varchar('last_name', { length: 100 }).notNull(),

    email: varchar('email', { length: 255 }).notNull().unique(),

    // IANA timezone identifier (e.g., "America/New_York", "Europe/London")
    // This handles DST automatically when using date-fns-tz or luxon
    timezone: varchar('timezone', { length: 100 }).notNull(),

    // Date fields for different message types
    // Stored as DATE (not TIMESTAMP) - only month/day matters
    birthdayDate: date('birthday_date', { mode: 'date' }),

    anniversaryDate: date('anniversary_date', { mode: 'date' }),

    // Optional location metadata
    locationCity: varchar('location_city', { length: 100 }),

    locationCountry: varchar('location_country', { length: 100 }),

    // Timestamps
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),

    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),

    // Soft delete support
    deletedAt: timestamp('deleted_at', { withTimezone: true, mode: 'date' }),
  },
  (table) => ({
    // Partial index: birthday_date (only non-deleted users with birthday_date)
    // WHERE clause reduces index size and improves query performance
    birthdayDateIdx: index('idx_users_birthday_date')
      .on(table.birthdayDate)
      .where(sql`${table.deletedAt} IS NULL AND ${table.birthdayDate} IS NOT NULL`),

    // Partial index: anniversary_date (only non-deleted users with anniversary_date)
    anniversaryDateIdx: index('idx_users_anniversary_date')
      .on(table.anniversaryDate)
      .where(sql`${table.deletedAt} IS NULL AND ${table.anniversaryDate} IS NOT NULL`),

    // Composite index: birthday_date + timezone
    // Optimizes queries like: "Find all users with birthday today in timezone X"
    birthdayTimezoneIdx: index('idx_users_birthday_timezone')
      .on(table.birthdayDate, table.timezone)
      .where(sql`${table.deletedAt} IS NULL`),

    // Unique email index (only non-deleted users)
    // Allows email reuse after soft delete
    emailUniqueIdx: index('idx_users_email_unique')
      .on(table.email)
      .where(sql`${table.deletedAt} IS NULL`),
  })
);

// Type inference for select/insert operations
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
