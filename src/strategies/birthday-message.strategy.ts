import type { User } from '../db/schema/users.js';
import type {
  MessageStrategy,
  MessageContext,
  Schedule,
  ValidationResult,
} from './message-strategy.interface.js';
import { timezoneService, type TimezoneService } from '../services/timezone.service.js';
import { logger } from '../config/logger.js';

/**
 * BirthdayMessageStrategy
 *
 * Implements the MessageStrategy interface for birthday messages.
 *
 * Features:
 * - Checks if today is the user's birthday (month/day match) in their timezone
 * - Calculates 9am local time for sending
 * - Composes personalized birthday message with name
 * - Validates user has birthday_date and timezone
 * - Handles leap year birthdays (Feb 29 -> Feb 28 in non-leap years)
 *
 * Message format: "Hey, {firstName} {lastName} it's your birthday"
 *
 * @example
 * ```typescript
 * const strategy = new BirthdayMessageStrategy();
 * const user = {
 *   id: '123',
 *   firstName: 'John',
 *   lastName: 'Doe',
 *   birthdayDate: new Date('1990-12-30'),
 *   timezone: 'America/New_York'
 * };
 *
 * // Check if message should be sent
 * const shouldSend = await strategy.shouldSend(user, new Date('2025-12-30'));
 * // Returns true if today is Dec 30 in New York timezone
 *
 * // Calculate send time
 * const sendTime = strategy.calculateSendTime(user, new Date('2025-12-30'));
 * // Returns: 2025-12-30T14:00:00.000Z (9am EST = 2pm UTC)
 *
 * // Compose message
 * const context = { currentYear: 2025, currentDate: new Date('2025-12-30'), userTimezone: 'America/New_York' };
 * const message = await strategy.composeMessage(user, context);
 * // Returns: "Hey, John Doe it's your birthday"
 * ```
 */
export class BirthdayMessageStrategy implements MessageStrategy {
  readonly messageType = 'BIRTHDAY';

  constructor(private readonly _tzService: TimezoneService = timezoneService) {
    logger.debug('BirthdayMessageStrategy initialized');
  }

  /**
   * Check if today is the user's birthday in their timezone
   *
   * Uses timezone-aware date matching (month/day) to determine if today is the birthday.
   * Handles special cases:
   * - Leap year birthdays (Feb 29): Celebrated on Feb 28 in non-leap years
   * - Timezone boundaries: Uses user's local date, not UTC date
   *
   * @param user - User to check
   * @param date - Date to check (usually today in UTC)
   * @returns Promise<boolean> - true if today is birthday in user's timezone
   */
  async shouldSend(user: User, _date: Date): Promise<boolean> {
    try {
      // Validate user has birthday date
      if (!user.birthdayDate) {
        logger.debug(
          { userId: user.id, messageType: this.messageType },
          'User has no birthday date, skipping'
        );
        return false;
      }

      // Check if today is birthday in user's timezone
      const isBirthday = this._tzService.isBirthdayToday(user.birthdayDate, user.timezone);

      if (isBirthday) {
        logger.info(
          {
            userId: user.id,
            messageType: this.messageType,
            birthdayDate: user.birthdayDate,
            timezone: user.timezone,
          },
          'Birthday detected for user'
        );
      }

      return isBirthday;
    } catch (error) {
      logger.error(
        {
          userId: user.id,
          messageType: this.messageType,
          error: error instanceof Error ? error.message : String(error),
        },
        'Failed to check if should send birthday message'
      );
      return false;
    }
  }

  /**
   * Calculate the exact time to send the birthday message in UTC
   *
   * Converts 9am in the user's local timezone to UTC timestamp.
   * Handles DST transitions automatically using the timezone service.
   *
   * @param user - User to send message to
   * @param date - Date to send message (usually today)
   * @returns Date - UTC timestamp for message send time (9am local time)
   *
   * @throws ValidationError if timezone is invalid
   */
  calculateSendTime(user: User, _date: Date): Date {
    if (!user.birthdayDate) {
      throw new Error('User has no birthday date');
    }

    // Calculate 9am local time in UTC
    const sendTime = this._tzService.calculateSendTime(user.birthdayDate, user.timezone);

    logger.debug(
      {
        userId: user.id,
        messageType: this.messageType,
        timezone: user.timezone,
        sendTime: sendTime.toISOString(),
      },
      'Calculated birthday message send time'
    );

    return sendTime;
  }

  /**
   * Compose personalized birthday message
   *
   * Format: "Hey, {firstName} {lastName} it's your birthday"
   *
   * Future enhancements could include:
   * - Age calculation: "Happy 35th birthday!"
   * - Custom messages based on age milestones
   * - Localization support
   *
   * @param user - User to compose message for
   * @param context - Additional context (currently unused, reserved for future enhancements)
   * @returns Promise<string> - Composed birthday message
   */
  async composeMessage(user: User, _context: MessageContext): Promise<string> {
    const message = `Hey, ${user.firstName} ${user.lastName} it's your birthday`;

    logger.debug(
      {
        userId: user.id,
        messageType: this.messageType,
        messageLength: message.length,
      },
      'Composed birthday message'
    );

    return message;
  }

  /**
   * Get schedule configuration for birthday messages
   *
   * Birthdays are sent:
   * - Cadence: YEARLY (once per year)
   * - Trigger field: birthdayDate
   * - Send time: 9am local time (default)
   *
   * @returns Schedule - Schedule configuration
   */
  getSchedule(): Schedule {
    return {
      cadence: 'YEARLY',
      triggerField: 'birthdayDate',
      sendHour: 9,
      sendMinute: 0,
    };
  }

  /**
   * Validate that user has all required data for birthday messages
   *
   * Required fields:
   * - birthdayDate: User's birthday date (month/day)
   * - timezone: User's IANA timezone identifier
   * - firstName: User's first name (for message composition)
   * - lastName: User's last name (for message composition)
   *
   * @param user - User to validate
   * @returns ValidationResult - Validation result with errors
   */
  validate(user: User): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Check required fields
    if (!user.birthdayDate) {
      errors.push('Birthday date is required');
    }

    if (!user.timezone) {
      errors.push('Timezone is required');
    } else if (!this._tzService.isValidTimezone(user.timezone)) {
      errors.push(`Invalid timezone: ${user.timezone}`);
    }

    if (!user.firstName) {
      errors.push('First name is required');
    }

    if (!user.lastName) {
      errors.push('Last name is required');
    }

    // Check for potential issues (warnings)
    if (user.birthdayDate) {
      const year = user.birthdayDate.getFullYear();
      const currentYear = new Date().getFullYear();

      if (year > currentYear) {
        warnings.push(`Birthday year ${year} is in the future`);
      }

      if (year < 1900) {
        warnings.push(`Birthday year ${year} seems unusually old`);
      }
    }

    const isValid = errors.length === 0;

    if (!isValid) {
      logger.warn(
        {
          userId: user.id,
          messageType: this.messageType,
          errors,
          warnings,
        },
        'User validation failed for birthday message'
      );
    }

    return {
      valid: isValid,
      errors,
      warnings,
    };
  }
}
