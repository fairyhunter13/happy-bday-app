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
 * AnniversaryMessageStrategy
 *
 * Implements the MessageStrategy interface for work anniversary messages.
 *
 * Features:
 * - Checks if today is the user's anniversary (month/day match) in their timezone
 * - Calculates 9am local time for sending
 * - Composes personalized anniversary message with years of service
 * - Validates user has anniversary_date and timezone
 * - Handles leap year anniversaries (Feb 29 -> Feb 28 in non-leap years)
 *
 * Message format: "Hey, {firstName} {lastName} it's your work anniversary! {years} years with us!"
 *
 * @example
 * ```typescript
 * const strategy = new AnniversaryMessageStrategy();
 * const user = {
 *   id: '123',
 *   firstName: 'John',
 *   lastName: 'Doe',
 *   anniversaryDate: new Date('2020-03-15'),
 *   timezone: 'America/New_York'
 * };
 *
 * // Check if message should be sent
 * const shouldSend = await strategy.shouldSend(user, new Date('2025-03-15'));
 * // Returns true if today is Mar 15 in New York timezone
 *
 * // Calculate send time
 * const sendTime = strategy.calculateSendTime(user, new Date('2025-03-15'));
 * // Returns: 2025-03-15T13:00:00.000Z (9am EDT = 1pm UTC)
 *
 * // Compose message
 * const context = { currentYear: 2025, currentDate: new Date('2025-03-15'), userTimezone: 'America/New_York' };
 * const message = await strategy.composeMessage(user, context);
 * // Returns: "Hey, John Doe it's your work anniversary! 5 years with us!"
 * ```
 */
export class AnniversaryMessageStrategy implements MessageStrategy {
  readonly messageType = 'ANNIVERSARY';

  constructor(private readonly _tzService: TimezoneService = timezoneService) {
    logger.debug('AnniversaryMessageStrategy initialized');
  }

  /**
   * Check if today is the user's work anniversary in their timezone
   *
   * Uses timezone-aware date matching (month/day) to determine if today is the anniversary.
   * Handles special cases:
   * - Leap year anniversaries (Feb 29): Celebrated on Feb 28 in non-leap years
   * - Timezone boundaries: Uses user's local date, not UTC date
   *
   * @param user - User to check
   * @param date - Date to check (usually today in UTC)
   * @returns Promise<boolean> - true if today is anniversary in user's timezone
   */
  async shouldSend(user: User, _date: Date): Promise<boolean> {
    try {
      // Validate user has anniversary date
      if (!user.anniversaryDate) {
        logger.debug(
          { userId: user.id, messageType: this.messageType },
          'User has no anniversary date, skipping'
        );
        return false;
      }

      // Check if today is anniversary in user's timezone
      // Reuse the birthday logic since it's the same month/day matching
      const isAnniversary = this._tzService.isBirthdayToday(user.anniversaryDate, user.timezone);

      if (isAnniversary) {
        logger.info(
          {
            userId: user.id,
            messageType: this.messageType,
            anniversaryDate: user.anniversaryDate,
            timezone: user.timezone,
          },
          'Anniversary detected for user'
        );
      }

      return isAnniversary;
    } catch (error) {
      logger.error(
        {
          userId: user.id,
          messageType: this.messageType,
          error: error instanceof Error ? error.message : String(error),
        },
        'Failed to check if should send anniversary message'
      );
      return false;
    }
  }

  /**
   * Calculate the exact time to send the anniversary message in UTC
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
    if (!user.anniversaryDate) {
      throw new Error('User has no anniversary date');
    }

    // Calculate 9am local time in UTC
    const sendTime = this._tzService.calculateSendTime(user.anniversaryDate, user.timezone);

    logger.debug(
      {
        userId: user.id,
        messageType: this.messageType,
        timezone: user.timezone,
        sendTime: sendTime.toISOString(),
      },
      'Calculated anniversary message send time'
    );

    return sendTime;
  }

  /**
   * Compose personalized anniversary message with years of service
   *
   * Format: "Hey, {firstName} {lastName} it's your work anniversary! {years} years with us!"
   *
   * Calculates years of service based on anniversary date and current year.
   * Special handling:
   * - 1 year: "1 year with us!"
   * - Multiple years: "{years} years with us!"
   *
   * Future enhancements could include:
   * - Milestone messages (5, 10, 20 years)
   * - Custom messages based on years of service
   * - Localization support
   *
   * @param user - User to compose message for
   * @param context - Additional context (currentYear for calculating years of service)
   * @returns Promise<string> - Composed anniversary message
   */
  async composeMessage(user: User, context: MessageContext): Promise<string> {
    if (!user.anniversaryDate) {
      throw new Error('User has no anniversary date');
    }

    // Calculate years of service
    const anniversaryYear = user.anniversaryDate.getFullYear();
    const yearsOfService = context.currentYear - anniversaryYear;

    // Compose message with years of service
    let message: string;
    if (yearsOfService === 1) {
      message = `Hey, ${user.firstName} ${user.lastName} it's your work anniversary! 1 year with us!`;
    } else {
      message = `Hey, ${user.firstName} ${user.lastName} it's your work anniversary! ${yearsOfService} years with us!`;
    }

    logger.debug(
      {
        userId: user.id,
        messageType: this.messageType,
        yearsOfService,
        messageLength: message.length,
      },
      'Composed anniversary message'
    );

    return message;
  }

  /**
   * Get schedule configuration for anniversary messages
   *
   * Anniversaries are sent:
   * - Cadence: YEARLY (once per year)
   * - Trigger field: anniversaryDate
   * - Send time: 9am local time (default)
   *
   * @returns Schedule - Schedule configuration
   */
  getSchedule(): Schedule {
    return {
      cadence: 'YEARLY',
      triggerField: 'anniversaryDate',
      sendHour: 9,
      sendMinute: 0,
    };
  }

  /**
   * Validate that user has all required data for anniversary messages
   *
   * Required fields:
   * - anniversaryDate: User's work anniversary date (month/day/year)
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
    if (!user.anniversaryDate) {
      errors.push('Anniversary date is required');
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
    if (user.anniversaryDate) {
      const year = user.anniversaryDate.getFullYear();
      const currentYear = new Date().getFullYear();

      if (year > currentYear) {
        warnings.push(`Anniversary year ${year} is in the future`);
      }

      if (year < 1950) {
        warnings.push(`Anniversary year ${year} seems unusually old`);
      }

      // Warn if anniversary is very recent (might be a mistake)
      const monthsDiff = (currentYear - year) * 12;
      if (monthsDiff < 1) {
        warnings.push('Anniversary is less than 1 month old');
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
        'User validation failed for anniversary message'
      );
    }

    return {
      valid: isValid,
      errors,
      warnings,
    };
  }
}
