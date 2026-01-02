/**
 * Test Stability Utilities
 *
 * Provides utilities for deterministic, stable tests:
 * - Time control for consistent date/time handling
 * - Eventually() assertions for async conditions
 * - Database test context for isolation
 * - Wait utilities for condition polling
 *
 * Purpose: Eliminate flakiness by controlling non-deterministic factors
 */

import { DateTime } from 'luxon';
import type { MessageLog } from '../../src/db/schema/message-logs.js';
import { messageLogRepository } from '../../src/repositories/message-log.repository.js';

/**
 * Time Control Utilities
 *
 * Provides consistent time handling for tests:
 * - All times are in UTC
 * - Fixed reference times for consistent test data
 * - Helper functions for common time operations
 */
export class TimeControl {
  /**
   * Get a fixed reference time for today at 9:00 AM UTC
   * Use this for scheduling messages in tests
   */
  static getTodayAt9AM(): Date {
    return DateTime.now()
      .setZone('UTC')
      .set({ hour: 9, minute: 0, second: 0, millisecond: 0 })
      .toJSDate();
  }

  /**
   * Get a fixed reference time for today at 10:00 AM UTC
   */
  static getTodayAt10AM(): Date {
    return DateTime.now()
      .setZone('UTC')
      .set({ hour: 10, minute: 0, second: 0, millisecond: 0 })
      .toJSDate();
  }

  /**
   * Get start of day in UTC
   */
  static getStartOfDay(): Date {
    return DateTime.now().setZone('UTC').startOf('day').toJSDate();
  }

  /**
   * Get end of day in UTC
   */
  static getEndOfDay(): Date {
    return DateTime.now().setZone('UTC').endOf('day').toJSDate();
  }

  /**
   * Add milliseconds to a date
   */
  static addMilliseconds(date: Date, ms: number): Date {
    return new Date(date.getTime() + ms);
  }

  /**
   * Add seconds to a date
   */
  static addSeconds(date: Date, seconds: number): Date {
    return TimeControl.addMilliseconds(date, seconds * 1000);
  }

  /**
   * Add minutes to a date
   */
  static addMinutes(date: Date, minutes: number): Date {
    return TimeControl.addSeconds(date, minutes * 60);
  }

  /**
   * Check if a date is in the past
   */
  static isInPast(date: Date): boolean {
    return date.getTime() < Date.now();
  }

  /**
   * Check if a date is in the future
   */
  static isInFuture(date: Date): boolean {
    return date.getTime() > Date.now();
  }
}

/**
 * Wait for a condition to become true
 *
 * Polls a condition function until it returns true or timeout is reached.
 * Useful for waiting for async operations to complete.
 *
 * @param condition - Function that returns true when condition is met
 * @param options - Timeout and interval configuration
 * @returns Promise that resolves when condition is met
 * @throws Error if timeout is reached
 */
export async function waitForCondition(
  condition: () => Promise<boolean> | boolean,
  options: {
    timeout?: number;
    interval?: number;
    errorMessage?: string;
  } = {}
): Promise<void> {
  const {
    timeout = 10000,
    interval = 100,
    errorMessage = 'Condition not met within timeout',
  } = options;

  const startTime = Date.now();

  while (Date.now() - startTime < timeout) {
    const result = await condition();
    if (result) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, interval));
  }

  throw new Error(errorMessage);
}

/**
 * Eventually assertion wrapper
 *
 * Retries an assertion until it passes or timeout is reached.
 * Useful for assertions on eventually-consistent systems.
 *
 * @param assertion - Async function containing assertions
 * @param options - Timeout and interval configuration
 * @returns Promise that resolves when assertion passes
 * @throws The last assertion error if timeout is reached
 */
export async function eventually(
  assertion: () => Promise<void>,
  options: {
    timeout?: number;
    interval?: number;
  } = {}
): Promise<void> {
  const { timeout = 10000, interval = 100 } = options;

  const startTime = Date.now();
  let lastError: Error | null = null;

  while (Date.now() - startTime < timeout) {
    try {
      await assertion();
      return; // Assertion passed
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      await new Promise((resolve) => setTimeout(resolve, interval));
    }
  }

  // Timeout reached, throw last error
  throw (
    lastError || new Error('Eventually assertion failed: no error captured but timeout reached')
  );
}

/**
 * Database Test Context
 *
 * Provides utilities for database operations in tests:
 * - Cleanup helpers
 * - Data creation helpers
 * - Isolation utilities
 */
export class DatabaseTestContext {
  /**
   * Delete all message logs for a specific user
   * Useful for cleaning up test data
   */
  static async cleanupUserMessages(userId: string): Promise<void> {
    const messages = await messageLogRepository.findByUserId(userId);
    // Note: Would need a delete method in repository
    // For now, this documents the intent
    console.log(`Would cleanup ${messages.length} messages for user ${userId}`);
  }

  /**
   * Wait for a message to reach a specific status
   */
  static async waitForMessageStatus(
    messageId: string,
    expectedStatus: string,
    options: { timeout?: number; interval?: number } = {}
  ): Promise<MessageLog> {
    let message: MessageLog | null = null;

    await waitForCondition(
      async () => {
        message = await messageLogRepository.findById(messageId);
        return message?.status === expectedStatus;
      },
      {
        ...options,
        errorMessage: `Message ${messageId} did not reach status ${expectedStatus} within timeout`,
      }
    );

    if (!message) {
      throw new Error(`Message ${messageId} not found after status check`);
    }

    return message;
  }

  /**
   * Wait for scheduler stats to meet criteria
   */
  static async waitForSchedulerStats(
    criteria: {
      minScheduled?: number;
      minQueued?: number;
      minSent?: number;
    },
    options: { timeout?: number; interval?: number } = {}
  ): Promise<void> {
    await eventually(async () => {
      const stats = await messageLogRepository.findAll({
        status: criteria.minScheduled ? 'SCHEDULED' : undefined,
        limit: 10000,
      });

      const scheduledCount = stats.filter((m) => m.status === 'SCHEDULED').length;
      const queuedCount = stats.filter((m) => m.status === 'QUEUED').length;
      const sentCount = stats.filter((m) => m.status === 'SENT').length;

      if (criteria.minScheduled && scheduledCount < criteria.minScheduled) {
        throw new Error(
          `Expected at least ${criteria.minScheduled} scheduled messages, got ${scheduledCount}`
        );
      }

      if (criteria.minQueued && queuedCount < criteria.minQueued) {
        throw new Error(
          `Expected at least ${criteria.minQueued} queued messages, got ${queuedCount}`
        );
      }

      if (criteria.minSent && sentCount < criteria.minSent) {
        throw new Error(`Expected at least ${criteria.minSent} sent messages, got ${sentCount}`);
      }
    }, options);
  }
}

/**
 * Test Data Generators
 *
 * Provides consistent test data generation:
 * - UUIDs
 * - Idempotency keys
 * - Message content
 */
export class TestDataGenerator {
  private static counter = 0;

  /**
   * Generate a unique idempotency key for testing
   * Format: test-{timestamp}-{counter}
   */
  static generateIdempotencyKey(): string {
    TestDataGenerator.counter += 1;
    return `test-${Date.now()}-${TestDataGenerator.counter}`;
  }

  /**
   * Generate test message content
   */
  static generateMessageContent(type: 'BIRTHDAY' | 'ANNIVERSARY'): string {
    return type === 'BIRTHDAY'
      ? 'Happy Birthday! Have a wonderful day!'
      : 'Happy Anniversary! Celebrating your special day!';
  }

  /**
   * Reset counter (useful for test isolation)
   */
  static reset(): void {
    TestDataGenerator.counter = 0;
  }
}
