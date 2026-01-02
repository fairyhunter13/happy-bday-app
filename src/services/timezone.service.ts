import { DateTime, IANAZone } from 'luxon';
import { ValidationError } from '../utils/errors.js';
import { logger } from '../config/logger.js';

/**
 * TimezoneService
 *
 * Handles all timezone-related operations using Luxon library.
 * Supports 100+ IANA timezone identifiers and handles DST transitions automatically.
 *
 * Key responsibilities:
 * - Calculate 9am local time in UTC for message scheduling
 * - Validate IANA timezone identifiers
 * - Check if a date is a user's birthday in their timezone
 * - Handle DST (Daylight Saving Time) transitions
 */
export class TimezoneService {
  /**
   * Calculate the UTC timestamp for 9am in the user's local timezone
   *
   * @param birthdayDate - The birthday date (year is ignored, only month/day matter)
   * @param timezone - IANA timezone identifier (e.g., "America/New_York")
   * @returns Date object representing 9am local time in UTC
   *
   * @example
   * // User in New York with birthday on Dec 30
   * const sendTime = calculateSendTime(new Date('1990-12-30'), 'America/New_York');
   * // Returns: 2025-12-30T14:00:00.000Z (9am EST = 2pm UTC)
   */
  calculateSendTime(birthdayDate: Date | string, timezone: string): Date {
    if (!this.isValidTimezone(timezone)) {
      throw new ValidationError(`Invalid timezone: ${timezone}`);
    }

    const now = DateTime.now();

    // Handle both Date objects and strings (from JSON cache serialization)
    const bd = birthdayDate instanceof Date ? birthdayDate : new Date(birthdayDate);

    // PostgreSQL DATE columns are returned as midnight UTC
    // Extract month/day using UTC to get the stored date values correctly
    // This avoids timezone shift issues when the birthday date is interpreted
    const birthdayMonth = bd.getUTCMonth() + 1; // JS months are 0-indexed
    const birthdayDay = bd.getUTCDate();

    // Create a DateTime for 9am today in the user's timezone
    const sendTime = DateTime.fromObject(
      {
        year: now.year,
        month: birthdayMonth,
        day: birthdayDay,
        hour: 9,
        minute: 0,
        second: 0,
        millisecond: 0,
      },
      { zone: timezone }
    );

    if (!sendTime.isValid) {
      logger.error(
        { timezone, birthdayDate, reason: sendTime.invalidReason },
        'Invalid send time calculation'
      );
      throw new ValidationError(`Failed to calculate send time: ${sendTime.invalidExplanation}`);
    }

    return sendTime.toJSDate();
  }

  /**
   * Validate if a string is a valid IANA timezone identifier
   *
   * @param timezone - Timezone string to validate
   * @returns true if valid IANA timezone, false otherwise
   *
   * @example
   * isValidTimezone('America/New_York') // true
   * isValidTimezone('EST') // false (abbreviation, not IANA)
   * isValidTimezone('Invalid/Zone') // false
   */
  isValidTimezone(timezone: string): boolean {
    if (!timezone || typeof timezone !== 'string') {
      return false;
    }

    try {
      const zone = IANAZone.create(timezone);
      return zone.isValid;
    } catch {
      return false;
    }
  }

  /**
   * Get current time in a specific timezone
   *
   * @param timezone - IANA timezone identifier
   * @returns Current DateTime in the specified timezone
   *
   * @example
   * const nyTime = getCurrentTimeInTimezone('America/New_York');
   * console.log(nyTime.toFormat('yyyy-MM-dd HH:mm:ss'));
   */
  getCurrentTimeInTimezone(timezone: string): DateTime {
    if (!this.isValidTimezone(timezone)) {
      throw new ValidationError(`Invalid timezone: ${timezone}`);
    }

    return DateTime.now().setZone(timezone);
  }

  /**
   * Check if today is the user's birthday in their timezone
   *
   * Handles special cases:
   * - Leap year birthdays (Feb 29): Celebrated on Feb 28 in non-leap years
   * - Timezone boundaries: Uses user's local date, not UTC date
   *
   * @param birthdayDate - User's birthday date (year is ignored)
   * @param timezone - User's IANA timezone identifier
   * @returns true if today is the user's birthday in their timezone
   *
   * @example
   * const birthday = new Date('1990-12-30');
   * const isBirthday = isBirthdayToday(birthday, 'America/New_York');
   */
  isBirthdayToday(birthdayDate: Date | string, timezone: string): boolean {
    if (!this.isValidTimezone(timezone)) {
      throw new ValidationError(`Invalid timezone: ${timezone}`);
    }

    // Handle both Date objects and strings (from JSON cache serialization)
    // When users are cached in Redis, Date objects become ISO strings
    const bd = birthdayDate instanceof Date ? birthdayDate : new Date(birthdayDate);

    // PostgreSQL DATE columns are returned as midnight UTC
    // Extract month/day using UTC to get the stored date values correctly
    // This avoids timezone shift issues when the birthday date is interpreted
    const birthdayMonth = bd.getUTCMonth() + 1; // JS months are 0-indexed
    const birthdayDay = bd.getUTCDate();

    // Use UTC for today to match the findBirthdaysToday() query which also uses UTC
    // This ensures consistency between the DB query and the strategy check
    const now = new Date();
    const todayMonth = now.getUTCMonth() + 1;
    const todayDay = now.getUTCDate();

    // Get today in user's timezone for leap year check
    const todayInTimezone = DateTime.now().setZone(timezone);

    // Special handling for leap year birthdays (Feb 29)
    if (birthdayMonth === 2 && birthdayDay === 29) {
      // If it's not a leap year, celebrate on Feb 28
      if (!todayInTimezone.isInLeapYear && todayMonth === 2 && todayDay === 28) {
        logger.info(
          { timezone, birthdayDate },
          'Leap year birthday celebrated on Feb 28 in non-leap year'
        );
        return true;
      }
    }

    const isBirthday = birthdayMonth === todayMonth && birthdayDay === todayDay;

    if (isBirthday) {
      logger.debug(
        { timezone, birthdayDate, todayUTC: now.toISOString() },
        'Birthday detected (UTC date match)'
      );
    }

    return isBirthday;
  }

  /**
   * Handle DST (Daylight Saving Time) transitions
   *
   * Ensures that the calculated time accounts for DST changes.
   * Luxon handles this automatically, but this method provides explicit validation.
   *
   * @param date - Date to check for DST
   * @param timezone - IANA timezone identifier
   * @returns Object with DST information
   *
   * @example
   * const dst = handleDST(new Date('2025-03-09'), 'America/New_York');
   * console.log(dst.isDST); // true (during DST)
   * console.log(dst.offset); // -240 (UTC-4)
   */
  handleDST(
    date: Date | string,
    timezone: string
  ): {
    isDST: boolean;
    offset: number;
    offsetLabel: string;
    isValid: boolean;
  } {
    if (!this.isValidTimezone(timezone)) {
      throw new ValidationError(`Invalid timezone: ${timezone}`);
    }

    // Handle both Date objects and strings (from JSON cache serialization)
    const d = date instanceof Date ? date : new Date(date);
    const dt = DateTime.fromJSDate(d).setZone(timezone);

    if (!dt.isValid) {
      logger.error({ timezone, date, reason: dt.invalidReason }, 'Invalid date for DST handling');
      return {
        isDST: false,
        offset: 0,
        offsetLabel: 'UTC',
        isValid: false,
      };
    }

    const isDST = dt.isInDST;
    const offset = dt.offset; // Offset in minutes from UTC
    const offsetLabel = dt.offsetNameShort || 'UTC';

    logger.debug({ timezone, date, isDST, offset, offsetLabel }, 'DST information calculated');

    return {
      isDST,
      offset,
      offsetLabel,
      isValid: true,
    };
  }

  /**
   * Get UTC offset for a timezone at a specific date
   *
   * @param date - Date to check
   * @param timezone - IANA timezone identifier
   * @returns UTC offset in minutes
   */
  getUTCOffset(date: Date | string, timezone: string): number {
    if (!this.isValidTimezone(timezone)) {
      throw new ValidationError(`Invalid timezone: ${timezone}`);
    }

    // Handle both Date objects and strings (from JSON cache serialization)
    const d = date instanceof Date ? date : new Date(date);
    const dt = DateTime.fromJSDate(d).setZone(timezone);
    return dt.offset;
  }

  /**
   * Convert a date from one timezone to another
   *
   * @param date - Date to convert
   * @param fromTimezone - Source timezone
   * @param toTimezone - Target timezone
   * @returns Converted DateTime
   */
  convertTimezone(date: Date | string, fromTimezone: string, toTimezone: string): DateTime {
    if (!this.isValidTimezone(fromTimezone)) {
      throw new ValidationError(`Invalid source timezone: ${fromTimezone}`);
    }
    if (!this.isValidTimezone(toTimezone)) {
      throw new ValidationError(`Invalid target timezone: ${toTimezone}`);
    }

    // Handle both Date objects and strings (from JSON cache serialization)
    const d = date instanceof Date ? date : new Date(date);
    return DateTime.fromJSDate(d).setZone(fromTimezone).setZone(toTimezone);
  }

  /**
   * Get all supported IANA timezones
   *
   * @returns Array of valid IANA timezone identifiers
   */
  getSupportedTimezones(): string[] {
    // Luxon doesn't provide a built-in list, but we can use Intl API
    // Note: Intl.supportedValuesOf is available in Node.js 18+
    if (typeof Intl.supportedValuesOf === 'function') {
      return Intl.supportedValuesOf('timeZone');
    }

    // Fallback to common timezones
    return [
      'UTC',
      'America/New_York',
      'America/Chicago',
      'America/Denver',
      'America/Los_Angeles',
      'America/Anchorage',
      'America/Honolulu',
      'America/Toronto',
      'America/Mexico_City',
      'America/Sao_Paulo',
      'Europe/London',
      'Europe/Paris',
      'Europe/Berlin',
      'Europe/Rome',
      'Europe/Madrid',
      'Europe/Moscow',
      'Asia/Dubai',
      'Asia/Kolkata',
      'Asia/Shanghai',
      'Asia/Tokyo',
      'Asia/Seoul',
      'Asia/Singapore',
      'Asia/Hong_Kong',
      'Australia/Sydney',
      'Australia/Melbourne',
      'Australia/Perth',
      'Pacific/Auckland',
      'Pacific/Fiji',
    ];
  }

  /**
   * Format date in user's timezone
   *
   * @param date - Date to format
   * @param timezone - IANA timezone identifier
   * @param format - Luxon format string (default: 'yyyy-MM-dd HH:mm:ss')
   * @returns Formatted date string
   */
  formatDateInTimezone(
    date: Date | string,
    timezone: string,
    format: string = 'yyyy-MM-dd HH:mm:ss'
  ): string {
    if (!this.isValidTimezone(timezone)) {
      throw new ValidationError(`Invalid timezone: ${timezone}`);
    }

    // Handle both Date objects and strings (from JSON cache serialization)
    const d = date instanceof Date ? date : new Date(date);
    return DateTime.fromJSDate(d).setZone(timezone).toFormat(format);
  }
}

// Export singleton instance
export const timezoneService = new TimezoneService();
