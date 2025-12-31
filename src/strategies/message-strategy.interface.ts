import type { User } from '../db/schema/users.js';

/**
 * Message context for composing messages
 * Provides additional information needed for message composition
 */
export interface MessageContext {
  currentYear: number;
  currentDate: Date;
  userTimezone: string;
  [key: string]: unknown; // Allow for additional context properties
}

/**
 * Schedule information for a message type
 * Defines when and how messages should be sent
 */
export interface Schedule {
  cadence: 'YEARLY' | 'MONTHLY' | 'WEEKLY' | 'DAILY' | 'ONCE';
  triggerField: string; // The date field that triggers this message (e.g., 'birthdayDate', 'anniversaryDate')
  sendHour?: number; // Hour to send (default: 9)
  sendMinute?: number; // Minute to send (default: 0)
}

/**
 * Validation result for user data
 */
export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings?: string[];
}

/**
 * MessageStrategy Interface
 *
 * Defines the contract for all message types (Birthday, Anniversary, etc.)
 * Implements the Strategy Pattern to allow adding new message types without modifying core code.
 *
 * Design principles:
 * - Open/Closed Principle: Open for extension (new strategies), closed for modification
 * - Single Responsibility: Each strategy handles one message type
 * - Dependency Inversion: Core code depends on interface, not concrete implementations
 *
 * @example
 * ```typescript
 * class BirthdayMessageStrategy implements MessageStrategy {
 *   readonly messageType = 'BIRTHDAY';
 *
 *   async shouldSend(user: User, date: Date): Promise<boolean> {
 *     return user.birthdayDate?.getMonth() === date.getMonth() &&
 *            user.birthdayDate?.getDate() === date.getDate();
 *   }
 *
 *   calculateSendTime(user: User, date: Date): Date {
 *     return timezoneService.calculateSendTime(user.birthdayDate!, user.timezone);
 *   }
 *
 *   async composeMessage(user: User, context: MessageContext): Promise<string> {
 *     return `Hey, ${user.firstName} ${user.lastName} it's your birthday!`;
 *   }
 *
 *   getSchedule(): Schedule {
 *     return { cadence: 'YEARLY', triggerField: 'birthdayDate' };
 *   }
 *
 *   validate(user: User): ValidationResult {
 *     const errors = [];
 *     if (!user.birthdayDate) errors.push('Birthday date is required');
 *     if (!user.timezone) errors.push('Timezone is required');
 *     return { valid: errors.length === 0, errors };
 *   }
 * }
 * ```
 */
export interface MessageStrategy {
  /**
   * Unique identifier for this message type
   * Must match the MessageType enum values (e.g., 'BIRTHDAY', 'ANNIVERSARY')
   */
  readonly messageType: string;

  /**
   * Determine if a message should be sent for this user on this date
   *
   * Checks if the date matches the user's special date (birthday, anniversary, etc.)
   * in their local timezone. Handles edge cases like leap years and DST.
   *
   * @param user - User to check
   * @param date - Date to check (usually today in UTC)
   * @returns Promise<boolean> - true if message should be sent
   *
   * @example
   * ```typescript
   * const user = { birthdayDate: new Date('1990-12-30'), timezone: 'America/New_York' };
   * const shouldSend = await strategy.shouldSend(user, new Date('2025-12-30'));
   * // Returns true if today is Dec 30 in New York timezone
   * ```
   */
  shouldSend(_user: User, _date: Date): Promise<boolean>;

  /**
   * Calculate the exact time to send the message in UTC
   *
   * Converts the user's local send time (e.g., 9am) to UTC timestamp.
   * Handles DST transitions and timezone offset calculations.
   *
   * @param user - User to send message to
   * @param date - Date to send message (usually today)
   * @returns Date - UTC timestamp for message send time
   *
   * @example
   * ```typescript
   * const user = { birthdayDate: new Date('1990-12-30'), timezone: 'America/New_York' };
   * const sendTime = strategy.calculateSendTime(user, new Date('2025-12-30'));
   * // Returns: 2025-12-30T14:00:00.000Z (9am EST = 2pm UTC)
   * ```
   */
  calculateSendTime(_user: User, _date: Date): Date;

  /**
   * Compose the message content for this user
   *
   * Generates personalized message content using user data and context.
   * Can include calculations like age, years of service, etc.
   *
   * @param user - User to compose message for
   * @param context - Additional context for message composition
   * @returns Promise<string> - Composed message content
   *
   * @example
   * ```typescript
   * const user = { firstName: 'John', lastName: 'Doe', birthdayDate: new Date('1990-12-30') };
   * const context = { currentYear: 2025, currentDate: new Date('2025-12-30') };
   * const message = await strategy.composeMessage(user, context);
   * // Returns: "Hey, John Doe it's your birthday! Happy 35th!"
   * ```
   */
  composeMessage(_user: User, _context: MessageContext): Promise<string>;

  /**
   * Get the schedule configuration for this message type
   *
   * Defines how often messages are sent and which date field triggers them.
   * Used by the scheduler to determine when to check for messages.
   *
   * @returns Schedule - Schedule configuration
   *
   * @example
   * ```typescript
   * const schedule = strategy.getSchedule();
   * // Returns: { cadence: 'YEARLY', triggerField: 'birthdayDate', sendHour: 9, sendMinute: 0 }
   * ```
   */
  getSchedule(): Schedule;

  /**
   * Validate that a user has all required data for this message type
   *
   * Checks that the user has the necessary date fields, timezone, etc.
   * Used to prevent errors when scheduling messages.
   *
   * @param user - User to validate
   * @returns ValidationResult - Validation result with errors
   *
   * @example
   * ```typescript
   * const user = { firstName: 'John', lastName: 'Doe' }; // Missing birthdayDate
   * const result = strategy.validate(user);
   * // Returns: { valid: false, errors: ['Birthday date is required', 'Timezone is required'] }
   * ```
   */
  validate(_user: User): ValidationResult;
}
