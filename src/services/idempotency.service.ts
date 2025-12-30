import { DateTime } from 'luxon';
import { ValidationError } from '../utils/errors.js';
import { logger } from '../config/logger.js';

/**
 * IdempotencyKey components
 * Format: {userId}:{messageType}:{YYYY-MM-DD}
 */
export interface IdempotencyKeyComponents {
  userId: string;
  messageType: string;
  date: string;
}

/**
 * IdempotencyService
 *
 * Generates and validates idempotency keys to prevent duplicate message sending.
 * Uses format: {userId}:{messageType}:{YYYY-MM-DD}
 *
 * Key responsibilities:
 * - Generate deterministic idempotency keys
 * - Parse idempotency keys back into components
 * - Validate key format
 * - Prevent duplicate messages for the same user, message type, and date
 *
 * @example
 * const key = idempotencyService.generateKey('user-123', 'BIRTHDAY', new Date('2025-12-30'));
 * // Returns: "user-123:BIRTHDAY:2025-12-30"
 */
export class IdempotencyService {
  private readonly SEPARATOR = ':';
  private readonly DATE_FORMAT = 'yyyy-MM-dd';
  private readonly KEY_PATTERN = /^[^:]+:[^:]+:\d{4}-\d{2}-\d{2}$/;

  /**
   * Generate an idempotency key
   *
   * @param userId - User identifier (UUID)
   * @param messageType - Message type (BIRTHDAY, ANNIVERSARY, etc.)
   * @param date - Delivery date
   * @param timezone - Optional timezone for date formatting (defaults to UTC)
   * @returns Idempotency key string
   *
   * @example
   * generateKey('abc-123', 'BIRTHDAY', new Date('2025-12-30'))
   * // Returns: "abc-123:BIRTHDAY:2025-12-30"
   */
  generateKey(userId: string, messageType: string, date: Date, timezone: string = 'UTC'): string {
    // Validate inputs
    if (!userId || typeof userId !== 'string' || userId.trim().length === 0) {
      throw new ValidationError('userId must be a non-empty string');
    }

    if (!messageType || typeof messageType !== 'string' || messageType.trim().length === 0) {
      throw new ValidationError('messageType must be a non-empty string');
    }

    if (!(date instanceof Date) || isNaN(date.getTime())) {
      throw new ValidationError('date must be a valid Date object');
    }

    // Validate that userId and messageType don't contain separator
    if (userId.includes(this.SEPARATOR)) {
      throw new ValidationError(`userId cannot contain separator character '${this.SEPARATOR}'`);
    }

    if (messageType.includes(this.SEPARATOR)) {
      throw new ValidationError(
        `messageType cannot contain separator character '${this.SEPARATOR}'`
      );
    }

    // Format date in the specified timezone
    const dt = DateTime.fromJSDate(date).setZone(timezone);
    if (!dt.isValid) {
      logger.error(
        { userId, messageType, date, timezone, reason: dt.invalidReason },
        'Invalid date for idempotency key generation'
      );
      throw new ValidationError(`Invalid date: ${dt.invalidExplanation}`);
    }

    const dateStr = dt.toFormat(this.DATE_FORMAT);

    // Generate key
    const key = `${userId}${this.SEPARATOR}${messageType}${this.SEPARATOR}${dateStr}`;

    logger.debug(
      { userId, messageType, date: dateStr, timezone, key },
      'Generated idempotency key'
    );

    return key;
  }

  /**
   * Parse an idempotency key into its components
   *
   * @param key - Idempotency key string
   * @returns Parsed components
   *
   * @example
   * parseKey('abc-123:BIRTHDAY:2025-12-30')
   * // Returns: { userId: 'abc-123', messageType: 'BIRTHDAY', date: '2025-12-30' }
   */
  parseKey(key: string): IdempotencyKeyComponents {
    if (!this.validateKey(key)) {
      throw new ValidationError(`Invalid idempotency key format: ${key}`);
    }

    const parts = key.split(this.SEPARATOR);

    // The key format is: userId:messageType:date
    // But userId might contain additional separators in UUIDs (hyphens, not colons)
    // So we need to be careful with parsing

    if (parts.length !== 3) {
      throw new ValidationError(
        `Invalid idempotency key format: expected 3 parts, got ${parts.length}`
      );
    }

    const userId = parts[0];
    const messageType = parts[1];
    const date = parts[2];

    // Validate that parts are not undefined
    if (!userId || !messageType || !date) {
      throw new ValidationError(`Invalid idempotency key: missing parts in ${key}`);
    }

    // Validate date format
    const datePattern = /^\d{4}-\d{2}-\d{2}$/;
    if (!datePattern.test(date)) {
      throw new ValidationError(`Invalid date format in key: ${date}`);
    }

    logger.debug({ key, userId, messageType, date }, 'Parsed idempotency key');

    return {
      userId,
      messageType,
      date,
    };
  }

  /**
   * Validate idempotency key format
   *
   * @param key - Key string to validate
   * @returns true if valid format, false otherwise
   *
   * @example
   * validateKey('abc-123:BIRTHDAY:2025-12-30') // true
   * validateKey('invalid-key') // false
   * validateKey('abc-123:BIRTHDAY') // false (missing date)
   */
  validateKey(key: string): boolean {
    if (!key || typeof key !== 'string') {
      return false;
    }

    // Check against pattern
    if (!this.KEY_PATTERN.test(key)) {
      return false;
    }

    // Additional validation: ensure we have exactly 3 parts
    const parts = key.split(this.SEPARATOR);
    if (parts.length !== 3) {
      return false;
    }

    // Validate each part is non-empty
    if (parts.some((part) => part.trim().length === 0)) {
      return false;
    }

    // Validate date part format
    const datePattern = /^\d{4}-\d{2}-\d{2}$/;
    const datePart = parts[2];
    if (!datePart || !datePattern.test(datePart)) {
      return false;
    }

    // Validate date is actually valid
    const dt = DateTime.fromFormat(datePart, this.DATE_FORMAT);
    if (!dt.isValid) {
      return false;
    }

    return true;
  }

  /**
   * Extract date from idempotency key
   *
   * @param key - Idempotency key string
   * @returns Date object
   */
  extractDate(key: string): Date {
    const components = this.parseKey(key);
    const dt = DateTime.fromFormat(components.date, this.DATE_FORMAT);

    if (!dt.isValid) {
      throw new ValidationError(`Invalid date in key: ${components.date}`);
    }

    return dt.toJSDate();
  }

  /**
   * Extract user ID from idempotency key
   *
   * @param key - Idempotency key string
   * @returns User ID
   */
  extractUserId(key: string): string {
    const components = this.parseKey(key);
    return components.userId;
  }

  /**
   * Extract message type from idempotency key
   *
   * @param key - Idempotency key string
   * @returns Message type
   */
  extractMessageType(key: string): string {
    const components = this.parseKey(key);
    return components.messageType;
  }

  /**
   * Check if two keys are for the same user and date but different message types
   *
   * @param key1 - First idempotency key
   * @param key2 - Second idempotency key
   * @returns true if same user and date, different message type
   */
  isSameUserAndDate(key1: string, key2: string): boolean {
    const components1 = this.parseKey(key1);
    const components2 = this.parseKey(key2);

    return (
      components1.userId === components2.userId &&
      components1.date === components2.date &&
      components1.messageType !== components2.messageType
    );
  }

  /**
   * Generate bulk idempotency keys for multiple users
   *
   * @param users - Array of user IDs
   * @param messageType - Message type
   * @param date - Delivery date
   * @param timezone - Timezone for date formatting
   * @returns Array of idempotency keys
   */
  generateBulkKeys(
    users: string[],
    messageType: string,
    date: Date,
    timezone: string = 'UTC'
  ): string[] {
    return users.map((userId) => this.generateKey(userId, messageType, date, timezone));
  }

  /**
   * Validate bulk idempotency keys
   *
   * @param keys - Array of keys to validate
   * @returns Object with valid and invalid keys
   */
  validateBulkKeys(keys: string[]): {
    valid: string[];
    invalid: string[];
  } {
    const valid: string[] = [];
    const invalid: string[] = [];

    for (const key of keys) {
      if (this.validateKey(key)) {
        valid.push(key);
      } else {
        invalid.push(key);
      }
    }

    return { valid, invalid };
  }
}

// Export singleton instance
export const idempotencyService = new IdempotencyService();
